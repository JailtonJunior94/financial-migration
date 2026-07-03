import { describe, expect, test } from "bun:test";
import { createCanonicalFactKey } from "../../../src/domain/consolidation/canonical-fact-key.ts";
import { createInstallmentPlan } from "../../../src/domain/consolidation/installment-plan.ts";
import { createMoneyAmount } from "../../../src/domain/consolidation/money-amount.ts";
import { createOccurrenceDate } from "../../../src/domain/consolidation/occurrence-date.ts";
import { reconcileFacts } from "../../../src/domain/consolidation/reconcile-facts.ts";
import type {
  CanonicalFactKey,
  ConsolidatedTransaction,
  LegacySourceRef,
  PaymentMethod,
} from "../../../src/domain/consolidation/types.ts";

const targetUserId = "06edc407-4f63-42e8-b07c-946b9ef0a19c";

const makeMoney = (minorUnits: bigint) => {
  const result = createMoneyAmount(minorUnits, 2, "BRL");
  if (!result.ok) throw new Error("Invalid money");
  return result.value;
};

const makeDate = (value: string) => {
  const result = createOccurrenceDate(value, "PurchaseDate");
  if (!result.ok) throw new Error("Invalid date");
  return result.value;
};

const makePlan = (groupKey: string) => {
  const result = createInstallmentPlan(groupKey, 1, 1);
  if (!result.ok) throw new Error("Invalid plan");
  return result.value;
};

const paymentMethodToContext = (
  paymentMethod: PaymentMethod,
):
  | { kind: "credit-card"; cardBusinessKey: string }
  | { kind: "debit-card"; cardBusinessKey: string }
  | { kind: "bank-transfer"; method: "pix" | "ted" | "other" }
  | { kind: "cash" }
  | { kind: "unknown" } => {
  switch (paymentMethod.kind) {
    case "credit_card":
      return {
        kind: "credit-card",
        cardBusinessKey: paymentMethod.cardBusinessKey,
      };
    case "debit_card":
      return {
        kind: "debit-card",
        cardBusinessKey: paymentMethod.cardBusinessKey,
      };
    case "pix":
      return { kind: "bank-transfer", method: "pix" };
    case "ted":
      return { kind: "bank-transfer", method: "ted" };
    case "other_bank_transfer":
      return { kind: "bank-transfer", method: "other" };
    case "cash":
      return { kind: "cash" };
    case "unknown":
      return { kind: "unknown" };
  }
};

const makeFactKey = (
  description: string,
  amountMinorUnits: bigint,
  paymentMethod: PaymentMethod,
) => {
  const result = createCanonicalFactKey(
    "transaction",
    targetUserId,
    "2026-01-15",
    description,
    makeMoney(amountMinorUnits),
    paymentMethodToContext(paymentMethod),
    { kind: "single" },
  );
  if (!result.ok) throw new Error("Invalid fact key");
  return result.value;
};

const makeTransaction = (
  ref: LegacySourceRef,
  description: string,
  amountMinorUnits: bigint,
  paymentMethod: PaymentMethod,
  overrides?: { kind?: "expense" | "income"; factKey?: CanonicalFactKey },
): ConsolidatedTransaction => ({
  factKey:
    overrides?.factKey ??
    makeFactKey(description, amountMinorUnits, paymentMethod),
  kind: overrides?.kind ?? "expense",
  occurredOn: makeDate("2026-01-15"),
  competence: "2026-01",
  description,
  amount: makeMoney(amountMinorUnits),
  paymentMethod,
  installmentPlan: makePlan(`${ref.database}.${ref.table}.${ref.primaryKey}`),
  legacyRefs: [ref],
  sourceSummary: {
    primarySource: ref.database,
    secondarySources: [],
    notes: [],
  },
});

describe("reconcileFacts", () => {
  test("mantém transação única inalterada", () => {
    const transaction = makeTransaction(
      { database: "FinancialControlDB", table: "InvoiceItem", primaryKey: "1" },
      "Supermercado",
      1000n,
      { kind: "credit_card", cardBusinessKey: "visa-1234" },
    );

    const result = reconcileFacts([transaction]);

    expect(result.transactions).toHaveLength(1);
    expect(result.issues).toHaveLength(0);
    expect(result.transactions[0]).toEqual(transaction);
  });

  test("merge transações equivalentes cross-source", () => {
    const financial = makeTransaction(
      { database: "FinancialControlDB", table: "InvoiceItem", primaryKey: "1" },
      "Supermercado",
      1000n,
      { kind: "credit_card", cardBusinessKey: "visa-1234" },
    );
    const account = makeTransaction(
      { database: "AccountControlDB", table: "Invoices", primaryKey: "1" },
      "Supermercado",
      1000n,
      { kind: "credit_card", cardBusinessKey: "visa-1234" },
    );

    const result = reconcileFacts([financial, account]);

    expect(result.transactions).toHaveLength(1);
    expect(result.issues).toHaveLength(0);
    const merged = result.transactions[0];
    if (!merged) return;

    expect(merged.legacyRefs).toHaveLength(2);
    expect(merged.sourceSummary.secondarySources).toContain("AccountControlDB");
  });

  test("bloqueia conflito material entre fontes com mesma chave canônica", () => {
    const sharedFactKey = makeFactKey("Supermercado", 1000n, {
      kind: "credit_card",
      cardBusinessKey: "visa-1234",
    });

    const financial = makeTransaction(
      { database: "FinancialControlDB", table: "InvoiceItem", primaryKey: "1" },
      "Supermercado",
      1000n,
      { kind: "credit_card", cardBusinessKey: "visa-1234" },
      { factKey: sharedFactKey },
    );
    const account = makeTransaction(
      { database: "AccountControlDB", table: "Invoices", primaryKey: "1" },
      "Supermercado",
      1000n,
      { kind: "credit_card", cardBusinessKey: "visa-1234" },
      { factKey: sharedFactKey, kind: "income" },
    );

    const result = reconcileFacts([financial, account]);

    expect(result.transactions).toHaveLength(0);
    expect(result.issues).toHaveLength(1);
    const issue = result.issues[0];
    if (!issue) return;

    expect(issue.kind).toBe("reconciliation-conflict");
    expect(issue.legacyRefs).toHaveLength(2);
  });

  test("agrupa por chave canônica independentemente de descrição original", () => {
    const a = makeTransaction(
      { database: "FinancialControlDB", table: "InvoiceItem", primaryKey: "1" },
      "Supermercado Central",
      500n,
      { kind: "credit_card", cardBusinessKey: "visa-1234" },
    );
    const b = makeTransaction(
      { database: "AccountControlDB", table: "Invoices", primaryKey: "2" },
      "SUPERMERCADO central",
      500n,
      { kind: "credit_card", cardBusinessKey: "visa-1234" },
    );

    const result = reconcileFacts([a, b]);

    expect(result.transactions).toHaveLength(1);
    expect(result.issues).toHaveLength(0);
  });

  test("não mescla transações com chaves canônicas distintas", () => {
    const a = makeTransaction(
      { database: "FinancialControlDB", table: "InvoiceItem", primaryKey: "1" },
      "Supermercado",
      1000n,
      { kind: "credit_card", cardBusinessKey: "visa-1234" },
    );
    const b = makeTransaction(
      { database: "FinancialControlDB", table: "InvoiceItem", primaryKey: "2" },
      "Farmácia",
      5000n,
      { kind: "credit_card", cardBusinessKey: "visa-1234" },
    );

    const result = reconcileFacts([a, b]);

    expect(result.transactions).toHaveLength(2);
    expect(result.issues).toHaveLength(0);
  });
});
