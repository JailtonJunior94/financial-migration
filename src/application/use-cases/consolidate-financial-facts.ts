import { ApplicationError } from "../../domain/common/errors.ts";
import { type Result, failure, success } from "../../domain/common/result.ts";
import { reconcileFacts } from "../../domain/consolidation/reconcile-facts.ts";
import { shapeInvoiceItem } from "../../domain/consolidation/shape-invoice-item.ts";
import { shapeNonCardFact } from "../../domain/consolidation/shape-non-card-fact.ts";
import type {
  ConsolidatedTransaction,
  LegacySourceRef,
  ReviewableIssue,
  UserEligibilityScope,
} from "../../domain/consolidation/types.ts";
import { validateInvoiceTotals } from "../../domain/consolidation/validate-invoice-totals.ts";
import type {
  LegacyFact,
  LegacyFinancialFactReaderPort,
} from "../ports/legacy-financial-fact-reader-port.ts";
import type { LoggerPort } from "../ports/logger-port.ts";

export type ConsolidateFinancialFactsInput = {
  readonly eligibilityScope: UserEligibilityScope;
  readonly currency: string;
  readonly cardBusinessKeys?: Readonly<Record<string, string>>;
  readonly invoiceCompetences?: Readonly<Record<string, string>>;
};

export type ConsolidateFinancialFactsOutput = {
  readonly transactions: readonly ConsolidatedTransaction[];
  readonly issues: readonly ReviewableIssue[];
};

const isInvoiceItemLike = (tableName: string): boolean => {
  const normalized = tableName.toLowerCase();
  return normalized === "invoiceitem" || normalized === "invoice_item";
};

const isCardRelatedDetail = (tableName: string): boolean => {
  const normalized = tableName.toLowerCase();
  return isInvoiceItemLike(normalized);
};

export class ConsolidateFinancialFactsUseCase {
  constructor(
    private readonly factReader: LegacyFinancialFactReaderPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(
    input: ConsolidateFinancialFactsInput,
  ): Promise<Result<ConsolidateFinancialFactsOutput, ApplicationError>> {
    this.logger.info("Iniciando consolidação de fatos financeiros.", {
      userId: input.eligibilityScope.targetUser.id,
      status: input.eligibilityScope.status,
    });

    if (input.eligibilityScope.status !== "eligible") {
      return success({ transactions: [], issues: [] });
    }

    const allRawFacts: LegacyFact[] = [];
    const allFacts: ConsolidatedTransaction[] = [];
    const allIssues: ReviewableIssue[] = [];

    try {
      let cursor: string | undefined;
      do {
        const batch = await this.factReader.readEligibleFacts({
          eligibilityScope: input.eligibilityScope,
          batchSize: 100,
          cursor,
        });

        for (const fact of batch.facts) {
          allRawFacts.push(fact);
          const shaped = this.shapeFact(fact, input);
          if (!shaped.ok) {
            allIssues.push({
              issueId: `shape-error-${fact.ref.database}-${fact.ref.table}-${fact.ref.primaryKey}`,
              kind: "semantic-mismatch",
              severity: "blocking",
              legacyRefs: [fact.ref],
              reason: shaped.error.message,
              evidence: {
                errorCode: shaped.error.code,
                fields: Object.keys(fact.fields),
              },
              blockedAt: new Date().toISOString(),
            });
            continue;
          }

          allFacts.push(...shaped.value);
        }

        cursor = batch.nextCursor;
      } while (cursor);
    } catch (error) {
      return failure(
        new ApplicationError(
          "SOURCE_READ_FAILURE",
          "Falha ao ler fatos elegíveis para consolidação.",
          {
            userId: input.eligibilityScope.targetUser.id,
            cause: error instanceof Error ? error.message : String(error),
          },
        ),
      );
    }

    const invoiceTotalValidation = validateInvoiceTotals(allRawFacts);
    const reconciliation = reconcileFacts(allFacts);

    this.logger.info("Consolidação de fatos financeiros concluída.", {
      shapedCount: allFacts.length,
      reconciledCount: reconciliation.transactions.length,
      conflictCount: reconciliation.issues.length,
      invoiceTotalIssueCount: invoiceTotalValidation.issues.length,
    });

    return success({
      transactions: reconciliation.transactions,
      issues: [
        ...allIssues,
        ...invoiceTotalValidation.issues,
        ...reconciliation.issues,
      ],
    });
  }

  private shapeFact(
    fact: LegacyFact,
    input: ConsolidateFinancialFactsInput,
  ): Result<readonly ConsolidatedTransaction[], ApplicationError> {
    const tableName = fact.ref.table;

    if (isCardRelatedDetail(tableName)) {
      const cardKey = input.cardBusinessKeys?.[fact.ref.primaryKey];
      const competence =
        input.invoiceCompetences?.[fact.ref.primaryKey] ??
        this.inferCompetenceFromFact(fact.fields);

      if (!cardKey) {
        return failure(
          new ApplicationError(
            "INVALID_SOURCE_RECORD",
            "InvoiceItem exige chave de negócio do cartão.",
            { ref: fact.ref },
          ),
        );
      }

      const shaped = shapeInvoiceItem(fact, {
        userId: input.eligibilityScope.targetUser.id,
        cardBusinessKey: cardKey,
        invoiceCompetence: competence,
        currency: input.currency,
      });

      if (!shaped.ok) {
        return failure(
          new ApplicationError(
            shaped.error.code,
            shaped.error.message,
            shaped.error.details,
          ),
        );
      }

      return success(shaped.value);
    }

    const shaped = shapeNonCardFact(fact, {
      userId: input.eligibilityScope.targetUser.id,
      currency: input.currency,
    });

    if (!shaped.ok) {
      return failure(
        new ApplicationError(
          shaped.error.code,
          shaped.error.message,
          shaped.error.details,
        ),
      );
    }

    return success([shaped.value]);
  }

  private inferCompetenceFromFact(fields: Record<string, unknown>): string {
    const competence =
      typeof fields.competence === "string" && fields.competence.length > 0
        ? fields.competence
        : undefined;

    const date =
      typeof fields.date === "string" && fields.date.length > 0
        ? fields.date
        : typeof fields.purchaseDate === "string" &&
            fields.purchaseDate.length > 0
          ? fields.purchaseDate
          : typeof fields.createdAt === "string" && fields.createdAt.length > 0
            ? fields.createdAt
            : undefined;

    if (competence) {
      return competence;
    }

    if (date) {
      const [year, month] = date.split("-");
      if (year && month) {
        return `${year}-${month}`;
      }
    }

    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }
}
