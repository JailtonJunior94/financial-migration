import {
  type SemanticSuggestion,
  classifyTransaction,
} from "../../domain/classification/classify-transaction.ts";
import type {
  CategoryCatalog,
  CategoryDictionaryPage,
  ClassificationOutcome,
} from "../../domain/classification/types.ts";
import type { ConsolidatedTransaction } from "../../domain/consolidation/types.ts";
import type { CategoryCatalogPort } from "../ports/category-catalog-port.ts";
import type { LoggerPort } from "../ports/logger-port.ts";
import type { SemanticEnrichmentPort } from "../ports/semantic-enrichment-port.ts";

export type ClassifyConsolidatedTransactionsInput = {
  readonly transactions: readonly ConsolidatedTransaction[];
};

export type ClassifyConsolidatedTransactionsOutput = {
  readonly classified: Extract<
    ClassificationOutcome,
    { kind: "classified" }
  >["classified"][];
  readonly blocked: Extract<
    ClassificationOutcome,
    { kind: "blocked" }
  >["issue"][];
};

export class ClassifyConsolidatedTransactionsUseCase {
  constructor(
    private readonly categoryCatalog: CategoryCatalogPort,
    private readonly semanticEnrichment: SemanticEnrichmentPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(
    input: ClassifyConsolidatedTransactionsInput,
  ): Promise<ClassifyConsolidatedTransactionsOutput> {
    this.logger.info("Iniciando classificação de transações consolidadas.", {
      transactionCount: input.transactions.length,
    });

    const expenseCatalog = await this.categoryCatalog.listByKind("expense");
    const incomeCatalog = await this.categoryCatalog.listByKind("income");
    const dictionary = await this.categoryCatalog.searchDictionary({
      term: "",
    });

    const classified: ClassifyConsolidatedTransactionsOutput["classified"] = [];
    const blocked: ClassifyConsolidatedTransactionsOutput["blocked"] = [];

    for (const transaction of input.transactions) {
      const catalog =
        transaction.kind === "income" ? incomeCatalog : expenseCatalog;
      const semanticSuggestion =
        await this.fetchSemanticSuggestion(transaction);

      const outcome = classifyTransaction(
        transaction,
        catalog,
        dictionary,
        semanticSuggestion,
      );

      if (outcome.kind === "classified") {
        classified.push(outcome.classified);
      } else {
        blocked.push(outcome.issue);
      }
    }

    this.logger.info("Classificação de transações consolidadas concluída.", {
      classifiedCount: classified.length,
      blockedCount: blocked.length,
    });

    return { classified, blocked };
  }

  private async fetchSemanticSuggestion(
    transaction: ConsolidatedTransaction,
  ): Promise<SemanticSuggestion | undefined> {
    try {
      return await this.semanticEnrichment.suggest({
        description: transaction.description,
        kind: transaction.kind,
      });
    } catch (error) {
      this.logger.warn(
        "Enriquecimento semântico falhou; prosseguindo sem sugestão.",
        {
          description: transaction.description,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return undefined;
    }
  }
}
