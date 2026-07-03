import type { ClassifiedTransaction } from "../../domain/classification/types.ts";
import { ApplicationError } from "../../domain/common/errors.ts";
import { type Result, failure, success } from "../../domain/common/result.ts";
import { canonicalFactKeyHash } from "../../domain/consolidation/canonical-fact-key.ts";
import { paymentMethodIsProvable } from "../../domain/consolidation/payment-method.ts";
import { createReviewableIssue } from "../../domain/consolidation/reviewable-issue.ts";
import type { ReviewableIssue } from "../../domain/consolidation/types.ts";
import {
  buildCanonicalPayload,
  transactionPayloadsAreEqual,
} from "../../domain/publication/payload-canonical.ts";
import { paymentMethodToPaymentContext } from "../../domain/publication/payment-method-to-context.ts";
import { buildTransactionIdempotencyKey } from "../../domain/publication/transaction-idempotency.ts";
import type {
  PipelineProgress,
  PublishableTransaction,
  RemoteTransactionRecord,
} from "../../domain/publication/types.ts";
import type { ClockPort } from "../ports/clock-port.ts";
import type { LoggerPort } from "../ports/logger-port.ts";
import type { ProgressStorePort } from "../ports/progress-store-port.ts";
import type { ReviewArtifactPort } from "../ports/review-artifact-port.ts";
import type { TransactionTargetPort } from "../ports/transaction-target-port.ts";

export type PublishTransactionsInput = {
  readonly scope: string;
  readonly userId: string;
  readonly classified: readonly ClassifiedTransaction[];
};

export type PublishTransactionsOutput = {
  readonly published: readonly RemoteTransactionRecord[];
  readonly skipped: readonly RemoteTransactionRecord[];
  readonly blocked: readonly ReviewableIssue[];
};

type PublishTransactionsDependencies = {
  readonly transactionTarget: TransactionTargetPort;
  readonly progressStore: ProgressStorePort;
  readonly reviewArtifactStore: ReviewArtifactPort;
  readonly clock: ClockPort;
  readonly logger: LoggerPort;
};

export class PublishTransactionsUseCase {
  constructor(private readonly dependencies: PublishTransactionsDependencies) {}

  async execute(
    input: PublishTransactionsInput,
  ): Promise<Result<PublishTransactionsOutput, ApplicationError>> {
    this.dependencies.logger.info(
      "Iniciando publicação idempotente de transações.",
      {
        scope: input.scope,
        userId: input.userId,
        transactionCount: input.classified.length,
      },
    );

    const published: RemoteTransactionRecord[] = [];
    const skipped: RemoteTransactionRecord[] = [];
    const blocked: ReviewableIssue[] = [];

    try {
      for (const classified of input.classified) {
        const outcome = await this.processTransaction(
          input.scope,
          input.userId,
          classified,
        );

        if (outcome.kind === "published") {
          published.push(outcome.record);
        } else if (outcome.kind === "skipped") {
          skipped.push(outcome.record);
        } else {
          blocked.push(outcome.issue);
          await this.dependencies.reviewArtifactStore.append(
            input.scope,
            outcome.issue,
          );
        }
      }
    } catch (error) {
      return failure(
        new ApplicationError(
          "INTEGRATION_FAILURE",
          "Falha ao publicar transações no destino.",
          {
            scope: input.scope,
            userId: input.userId,
            cause: error instanceof Error ? error.message : String(error),
          },
        ),
      );
    }

    await this.writeProgress({
      scope: input.scope,
      stage: "transaction_publication",
      processedCount: input.classified.length,
      blockedCount: blocked.length,
      reconciledCount: skipped.length,
      publishedCount: published.length,
      skippedCount: skipped.length,
    });

    this.dependencies.logger.info(
      "Publicação idempotente de transações concluída.",
      {
        scope: input.scope,
        publishedCount: published.length,
        skippedCount: skipped.length,
        blockedCount: blocked.length,
      },
    );

    return success({ published, skipped, blocked });
  }

  private async processTransaction(
    scope: string,
    userId: string,
    classified: ClassifiedTransaction,
  ): Promise<
    | { kind: "published"; record: RemoteTransactionRecord }
    | { kind: "skipped"; record: RemoteTransactionRecord }
    | { kind: "blocked"; issue: ReviewableIssue }
  > {
    const validationIssue = this.validateClassified(classified);
    if (validationIssue) {
      return { kind: "blocked", issue: validationIssue };
    }

    const publishable = this.toPublishable(classified);
    const factKeyHash = canonicalFactKeyHash(publishable.factKey);

    const remoteMatch =
      await this.dependencies.transactionTarget.findByBusinessKey({
        factKeyHash,
        userId,
      });

    if (remoteMatch) {
      const localPayload = buildCanonicalPayload(publishable);
      const equivalent =
        remoteMatch.equivalent ||
        (remoteMatch.payload
          ? transactionPayloadsAreEqual(localPayload, remoteMatch.payload)
          : false);

      if (equivalent) {
        return {
          kind: "skipped",
          record: {
            remoteId: remoteMatch.remoteId,
            factKeyHash,
            createdAt: this.dependencies.clock.nowIso(),
          },
        };
      }

      return {
        kind: "blocked",
        issue: createReviewableIssue({
          kind: "destination-divergence",
          reason:
            "Transação já existe no destino com payload divergente do consolidado.",
          factKey: publishable.factKey,
          legacyRefs: classified.transaction.legacyRefs,
          evidence: {
            remoteId: remoteMatch.remoteId,
            factKeyHash,
          },
        }),
      };
    }

    const idempotencyKey = buildTransactionIdempotencyKey(userId, factKeyHash);
    const record = await this.dependencies.transactionTarget.create(
      publishable,
      idempotencyKey,
    );

    return { kind: "published", record };
  }

  private validateClassified(
    classified: ClassifiedTransaction,
  ): ReviewableIssue | undefined {
    if (!paymentMethodIsProvable(classified.paymentMethod)) {
      return createReviewableIssue({
        kind: "unknown-payment-method",
        reason: "Método de pagamento não pôde ser provado para publicação.",
        factKey: classified.transaction.factKey,
        legacyRefs: classified.transaction.legacyRefs,
        evidence: { paymentMethod: classified.paymentMethod },
      });
    }

    return undefined;
  }

  private toPublishable(
    classified: ClassifiedTransaction,
  ): PublishableTransaction {
    const transaction = classified.transaction;

    const publishable: PublishableTransaction = {
      factKey: transaction.factKey,
      kind: transaction.kind,
      occurredOn: transaction.occurredOn.value,
      competence: transaction.competence,
      description: transaction.description,
      amount: transaction.amount,
      categoryId: classified.categoryId,
      paymentContext: paymentMethodToPaymentContext(classified.paymentMethod),
      installmentPlan: transaction.installmentPlan,
      legacyRefs: transaction.legacyRefs,
    };

    if (classified.subcategoryId !== undefined) {
      return { ...publishable, subcategoryId: classified.subcategoryId };
    }

    return publishable;
  }

  private async writeProgress(progress: Omit<PipelineProgress, "updatedAt">) {
    try {
      await this.dependencies.progressStore.write(progress.scope, {
        ...progress,
        updatedAt: this.dependencies.clock.nowIso(),
      });
    } catch (error) {
      this.dependencies.logger.warn(
        "Falha ao persistir progresso operacional; publicação permanece segura por GET-before-POST.",
        {
          scope: progress.scope,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }
}
