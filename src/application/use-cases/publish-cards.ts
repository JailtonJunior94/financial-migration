import { ApplicationError } from "../../domain/common/errors.ts";
import { type Result, failure, success } from "../../domain/common/result.ts";
import type {
  ConsolidatedCard,
  ReviewableIssue,
} from "../../domain/consolidation/types.ts";
import { buildCardIdempotencyKey } from "../../domain/publication/card-idempotency.ts";
import type {
  PublishableCard,
  RemoteCardBinding,
} from "../../domain/publication/types.ts";
import type { CardTargetPort } from "../ports/card-target-port.ts";
import type { ClockPort } from "../ports/clock-port.ts";
import type { LoggerPort } from "../ports/logger-port.ts";
import type { RemoteBindingStorePort } from "../ports/remote-binding-store-port.ts";

export type PublishCardsInput = {
  readonly userId: string;
  readonly cards: readonly ConsolidatedCard[];
};

export type PublishCardsOutput = {
  readonly published: readonly RemoteCardBinding[];
  readonly skipped: readonly RemoteCardBinding[];
  readonly issues: readonly ReviewableIssue[];
};

type PublishCardsDependencies = {
  readonly cardTarget: CardTargetPort;
  readonly bindingStore: RemoteBindingStorePort;
  readonly clock: ClockPort;
  readonly logger: LoggerPort;
};

export class PublishCardsUseCase {
  constructor(private readonly dependencies: PublishCardsDependencies) {}

  async execute(
    input: PublishCardsInput,
  ): Promise<Result<PublishCardsOutput, ApplicationError>> {
    this.dependencies.logger.info("Iniciando cadastro prévio de cartões.", {
      userId: input.userId,
      cardCount: input.cards.length,
    });

    const published: RemoteCardBinding[] = [];
    const skipped: RemoteCardBinding[] = [];
    const issues: ReviewableIssue[] = [];

    try {
      for (const card of input.cards) {
        const validationIssue = this.validateCard(card);
        if (validationIssue) {
          issues.push(validationIssue);
          continue;
        }

        const existingBinding = await this.findExistingBinding(card);
        if (existingBinding) {
          skipped.push(existingBinding);
          continue;
        }

        const remoteMatch =
          await this.dependencies.cardTarget.findByBusinessKey({
            businessKey: card.businessKey,
            userId: input.userId,
          });

        if (remoteMatch) {
          const bindings = await this.persistBindings(
            card,
            remoteMatch.remoteId,
          );
          skipped.push(...bindings);
          continue;
        }

        const publishableCard: PublishableCard = {
          businessKey: card.businessKey,
          nickname: card.nickname,
          bank: card.bank,
          dueDay: card.dueDay,
          ...(card.closingDay !== undefined
            ? { closingDay: card.closingDay }
            : {}),
          legacyRefs: card.legacyRefs,
        };

        const idempotencyKey = buildCardIdempotencyKey(
          input.userId,
          card.businessKey,
        );

        const remoteRecord = await this.dependencies.cardTarget.create(
          publishableCard,
          idempotencyKey,
        );

        const bindings = await this.persistBindings(
          card,
          remoteRecord.remoteId,
        );
        published.push(...bindings);
      }
    } catch (error) {
      return failure(
        new ApplicationError(
          "INTEGRATION_FAILURE",
          "Falha ao publicar cartões no destino.",
          {
            userId: input.userId,
            cause: error instanceof Error ? error.message : String(error),
          },
        ),
      );
    }

    this.dependencies.logger.info("Cadastro prévio de cartões concluído.", {
      userId: input.userId,
      publishedCount: published.length,
      skippedCount: skipped.length,
      issueCount: issues.length,
    });

    return success({ published, skipped, issues });
  }

  private validateCard(card: ConsolidatedCard): ReviewableIssue | undefined {
    const missingFields: string[] = [];

    if (!card.nickname || card.nickname.trim().length === 0) {
      missingFields.push("nickname");
    }

    if (!card.bank || card.bank.trim().length === 0) {
      missingFields.push("bank");
    }

    if (card.dueDay === undefined || card.dueDay < 1 || card.dueDay > 31) {
      missingFields.push("dueDay");
    }

    if (missingFields.length === 0) {
      return undefined;
    }

    return {
      issueId: `card-invalid-${card.businessKey}`,
      kind: "semantic-mismatch",
      severity: "blocking",
      legacyRefs: card.legacyRefs,
      reason:
        "Cartão consolidado não possui campos obrigatórios para publicação.",
      evidence: { missingFields },
      blockedAt: this.dependencies.clock.nowIso(),
    };
  }

  private async findExistingBinding(
    card: ConsolidatedCard,
  ): Promise<RemoteCardBinding | undefined> {
    for (const ref of card.legacyRefs) {
      const binding = await this.dependencies.bindingStore.readCard(ref);
      if (binding) {
        return binding;
      }
    }

    return undefined;
  }

  private async persistBindings(
    card: ConsolidatedCard,
    remoteId: string,
  ): Promise<RemoteCardBinding[]> {
    const boundAt = this.dependencies.clock.nowIso();
    const bindings: RemoteCardBinding[] = [];

    for (const ref of card.legacyRefs) {
      const binding: RemoteCardBinding = {
        legacyRef: ref,
        remoteId,
        businessKey: card.businessKey,
        boundAt,
      };

      await this.dependencies.bindingStore.writeCard(binding);
      bindings.push(binding);
    }

    return bindings;
  }
}
