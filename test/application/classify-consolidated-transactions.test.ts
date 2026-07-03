import { describe, expect, test } from "bun:test";
import type { CategoryCatalogPort } from "../../src/application/ports/category-catalog-port.ts";
import type { SemanticEnrichmentPort } from "../../src/application/ports/semantic-enrichment-port.ts";
import { ClassifyConsolidatedTransactionsUseCase } from "../../src/application/use-cases/classify-consolidated-transactions.ts";
import type { SemanticSuggestion } from "../../src/domain/classification/classify-transaction.ts";
import type {
  CategoryCatalog,
  CategoryDictionaryPage,
} from "../../src/domain/classification/types.ts";
import { createCanonicalFactKey } from "../../src/domain/consolidation/canonical-fact-key.ts";
import { createInstallmentPlan } from "../../src/domain/consolidation/installment-plan.ts";
import { createMoneyAmount } from "../../src/domain/consolidation/money-amount.ts";
import { createOccurrenceDate } from "../../src/domain/consolidation/occurrence-date.ts";
import type {
  ConsolidatedTransaction,
  LegacySourceRef,
  PaymentMethod,
} from "../../src/domain/consolidation/types.ts";

const targetUserId = "06edc407-4f63-42e8-b07c-946b9ef0a19c";
const legacyRef: LegacySourceRef = {
  database: "FinancialControlDB",
  table: "TransactionItem",
  primaryKey: "1",
};

const makeMoney = (minorUnits: bigint) => {
  const result = createMoneyAmount(minorUnits, 2, "BRL");
  if (!result.ok) throw new Error("Invalid money amount");
  return result.value;
};

const makeFactKey = (description: string) => {
  const result = createCanonicalFactKey(
    "transaction",
    targetUserId,
    "2026-01-15",
    description,
    makeMoney(1000n),
    { kind: "bank-transfer", method: "pix" },
    { kind: "single" },
  );
  if (!result.ok) throw new Error("Invalid fact key");
  return result.value;
};

const makeTransaction = (
  description: string,
  kind: "expense" | "income",
  paymentMethod: PaymentMethod,
): ConsolidatedTransaction => {
  const dateResult = createOccurrenceDate("2026-01-15", "TransactionDate");
  if (!dateResult.ok) throw new Error("Invalid date");
  const planResult = createInstallmentPlan(description, 1, 1);
  if (!planResult.ok) throw new Error("Invalid plan");

  return {
    factKey: makeFactKey(description),
    kind,
    occurredOn: dateResult.value,
    competence: "2026-01",
    description,
    amount: makeMoney(1000n),
    paymentMethod,
    installmentPlan: planResult.value,
    legacyRefs: [legacyRef],
    sourceSummary: {
      primarySource: "FinancialControlDB",
      secondarySources: [],
      notes: [],
    },
  };
};

const makeCategoryCatalog = (kind: "expense" | "income"): CategoryCatalog => ({
  kind,
  categories: [
    {
      id: `cat-${kind}`,
      name: kind === "expense" ? "Alimentação" : "Salário",
      kind,
      deprecated: false,
      subcategories: [
        {
          id: `sub-${kind}`,
          name: kind === "expense" ? "Supermercado" : "Mensal",
          deprecated: false,
        },
      ],
    },
  ],
});

const makeDictionary = (): CategoryDictionaryPage => ({
  entries: [
    {
      id: "dict-expense",
      term: "supermercado",
      categoryId: "cat-expense",
      subcategoryId: "sub-expense",
      kind: "expense",
      deprecated: false,
    },
    {
      id: "dict-income",
      term: "salário",
      categoryId: "cat-income",
      subcategoryId: "sub-income",
      kind: "income",
      deprecated: false,
    },
  ],
});

class InMemoryCategoryCatalog implements CategoryCatalogPort {
  async listByKind(kind: "expense" | "income"): Promise<CategoryCatalog> {
    return makeCategoryCatalog(kind);
  }

  async searchDictionary(): Promise<CategoryDictionaryPage> {
    return makeDictionary();
  }
}

class InMemorySemanticEnrichment implements SemanticEnrichmentPort {
  constructor(private readonly suggestion?: SemanticSuggestion) {}

  async suggest() {
    return this.suggestion;
  }
}

const makeLogger = () => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});

describe("ClassifyConsolidatedTransactionsUseCase", () => {
  test("classifica despesas e receitas em lote", async () => {
    const useCase = new ClassifyConsolidatedTransactionsUseCase(
      new InMemoryCategoryCatalog(),
      new InMemorySemanticEnrichment(),
      makeLogger(),
    );

    const result = await useCase.execute({
      transactions: [
        makeTransaction("Compra no supermercado", "expense", { kind: "pix" }),
        makeTransaction("Salário mensal", "income", { kind: "ted" }),
      ],
    });

    expect(result.classified).toHaveLength(2);
    expect(result.blocked).toHaveLength(0);
  });

  test("bloqueia transação com método de pagamento desconhecido", async () => {
    const useCase = new ClassifyConsolidatedTransactionsUseCase(
      new InMemoryCategoryCatalog(),
      new InMemorySemanticEnrichment(),
      makeLogger(),
    );

    const result = await useCase.execute({
      transactions: [
        makeTransaction("Compra no supermercado", "expense", {
          kind: "unknown",
        }),
      ],
    });

    expect(result.classified).toHaveLength(0);
    expect(result.blocked).toHaveLength(1);
    expect(result.blocked[0]?.kind).toBe("unknown-payment-method");
  });

  test("continua processando mesmo quando enriquecimento semântico falha", async () => {
    const failingEnrichment: SemanticEnrichmentPort = {
      suggest: async () => {
        throw new Error("OpenRouter unavailable");
      },
    };

    const useCase = new ClassifyConsolidatedTransactionsUseCase(
      new InMemoryCategoryCatalog(),
      failingEnrichment,
      makeLogger(),
    );

    const result = await useCase.execute({
      transactions: [
        makeTransaction("Compra no supermercado", "expense", { kind: "pix" }),
      ],
    });

    expect(result.classified).toHaveLength(1);
    expect(result.blocked).toHaveLength(0);
  });
});
