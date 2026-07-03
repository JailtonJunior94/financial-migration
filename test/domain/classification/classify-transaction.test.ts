import { describe, expect, test } from "bun:test";
import {
  type SemanticSuggestion,
  classifyTransaction,
} from "../../../src/domain/classification/classify-transaction.ts";
import type {
  CategoryCatalog,
  CategoryDictionaryPage,
} from "../../../src/domain/classification/types.ts";
import { createCanonicalFactKey } from "../../../src/domain/consolidation/canonical-fact-key.ts";
import { createInstallmentPlan } from "../../../src/domain/consolidation/installment-plan.ts";
import { createMoneyAmount } from "../../../src/domain/consolidation/money-amount.ts";
import { createOccurrenceDate } from "../../../src/domain/consolidation/occurrence-date.ts";
import type {
  ConsolidatedTransaction,
  LegacySourceRef,
  PaymentMethod,
} from "../../../src/domain/consolidation/types.ts";

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
  const amount = makeMoney(1000n);
  const result = createCanonicalFactKey(
    "transaction",
    targetUserId,
    "2026-01-15",
    description,
    amount,
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

const expenseCatalog: CategoryCatalog = {
  kind: "expense",
  categories: [
    {
      id: "cat-food",
      name: "Alimentação",
      kind: "expense",
      deprecated: false,
      subcategories: [
        { id: "sub-grocery", name: "Supermercado", deprecated: false },
      ],
    },
  ],
};

const incomeCatalog: CategoryCatalog = {
  kind: "income",
  categories: [
    {
      id: "cat-salary",
      name: "Salário",
      kind: "income",
      deprecated: false,
      subcategories: [{ id: "sub-wage", name: "Mensal", deprecated: false }],
    },
  ],
};

const emptyCatalog = (kind: "expense" | "income"): CategoryCatalog => ({
  kind,
  categories: [],
});

const dictionary: CategoryDictionaryPage = {
  entries: [
    {
      id: "dict-grocery",
      term: "supermercado",
      categoryId: "cat-food",
      subcategoryId: "sub-grocery",
      kind: "expense",
      deprecated: false,
    },
  ],
};

const emptyDictionary: CategoryDictionaryPage = { entries: [] };

describe("classifyTransaction", () => {
  test("classifica despesa por candidato válido", () => {
    const transaction: ConsolidatedTransaction = {
      ...makeTransaction("Supermercado Central", "expense", { kind: "pix" }),
      categoryCandidate: {
        id: "cat-food",
        name: "Alimentação",
        kind: "expense",
      },
      subcategoryCandidate: { id: "sub-grocery", name: "Supermercado" },
    };

    const outcome = classifyTransaction(
      transaction,
      expenseCatalog,
      emptyDictionary,
    );

    expect(outcome.kind).toBe("classified");
    if (outcome.kind === "classified") {
      expect(outcome.classified.categoryId).toBe("cat-food");
      expect(outcome.classified.subcategoryId).toBe("sub-grocery");
      expect(outcome.classified.suggestedByOpenRouter).toBe(false);
    }
  });

  test("classifica despesa por dicionário", () => {
    const transaction = makeTransaction("Compra no supermercado", "expense", {
      kind: "pix",
    });

    const outcome = classifyTransaction(
      transaction,
      expenseCatalog,
      dictionary,
    );

    expect(outcome.kind).toBe("classified");
    if (outcome.kind === "classified") {
      expect(outcome.classified.categoryId).toBe("cat-food");
      expect(outcome.classified.subcategoryId).toBe("sub-grocery");
      expect(outcome.classified.suggestedByOpenRouter).toBe(false);
    }
  });

  test("bloqueia quando método de pagamento é desconhecido", () => {
    const transaction = makeTransaction("Compra no supermercado", "expense", {
      kind: "unknown",
    });

    const outcome = classifyTransaction(
      transaction,
      expenseCatalog,
      dictionary,
    );

    expect(outcome.kind).toBe("blocked");
    if (outcome.kind === "blocked") {
      expect(outcome.issue.kind).toBe("unknown-payment-method");
    }
  });

  test("bloqueia receita quando taxonomia não tem cobertura", () => {
    const transaction = makeTransaction("Salário", "income", { kind: "ted" });

    const outcome = classifyTransaction(
      transaction,
      emptyCatalog("income"),
      emptyDictionary,
    );

    expect(outcome.kind).toBe("blocked");
    if (outcome.kind === "blocked") {
      expect(outcome.issue.kind).toBe("missing-income-taxonomy");
    }
  });

  test("classifica receita quando taxonomia possui cobertura", () => {
    const transaction = makeTransaction("Salário mensal", "income", {
      kind: "ted",
    });
    const incomeDictionary: CategoryDictionaryPage = {
      entries: [
        {
          id: "dict-salary",
          term: "salário",
          categoryId: "cat-salary",
          subcategoryId: "sub-wage",
          kind: "income",
          deprecated: false,
        },
      ],
    };

    const outcome = classifyTransaction(
      transaction,
      incomeCatalog,
      incomeDictionary,
    );

    expect(outcome.kind).toBe("classified");
    if (outcome.kind === "classified") {
      expect(outcome.classified.categoryId).toBe("cat-salary");
      expect(outcome.classified.subcategoryId).toBe("sub-wage");
    }
  });

  test("usa sugestão do OpenRouter quando validada pela taxonomia", () => {
    const transaction = makeTransaction("Restaurante", "expense", {
      kind: "pix",
    });
    const suggestion: SemanticSuggestion = {
      categoryName: "Alimentação",
      subcategoryName: "Supermercado",
    };

    const outcome = classifyTransaction(
      transaction,
      expenseCatalog,
      emptyDictionary,
      suggestion,
    );

    expect(outcome.kind).toBe("classified");
    if (outcome.kind === "classified") {
      expect(outcome.classified.categoryId).toBe("cat-food");
      expect(outcome.classified.subcategoryId).toBe("sub-grocery");
      expect(outcome.classified.suggestedByOpenRouter).toBe(true);
    }
  });

  test("ignora sugestão do OpenRouter quando não validada pela taxonomia", () => {
    const transaction = makeTransaction("Restaurante", "expense", {
      kind: "pix",
    });
    const suggestion: SemanticSuggestion = {
      categoryName: "Categoria Inexistente",
    };

    const outcome = classifyTransaction(
      transaction,
      expenseCatalog,
      emptyDictionary,
      suggestion,
    );

    expect(outcome.kind).toBe("blocked");
  });

  test("bloqueia quando nenhuma regra encontra categoria", () => {
    const transaction = makeTransaction("Lançamento misterioso", "expense", {
      kind: "pix",
    });

    const outcome = classifyTransaction(
      transaction,
      expenseCatalog,
      emptyDictionary,
    );

    expect(outcome.kind).toBe("blocked");
    if (outcome.kind === "blocked") {
      expect(outcome.issue.kind).toBe("semantic-mismatch");
    }
  });
});
