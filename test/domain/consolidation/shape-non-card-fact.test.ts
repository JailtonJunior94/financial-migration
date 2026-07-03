import { describe, expect, test } from "bun:test";
import type { LegacyFact } from "../../../src/application/ports/legacy-financial-fact-reader-port.ts";
import { shapeNonCardFact } from "../../../src/domain/consolidation/shape-non-card-fact.ts";

const targetUserId = "06edc407-4f63-42e8-b07c-946b9ef0a19c";

const makeFact = (
  database: "AccountControlDB" | "FinancialControlDB",
  table: string,
  primaryKey: string,
  fields: Record<string, unknown>,
): LegacyFact => ({
  ref: { database, table, primaryKey },
  fields,
});

describe("shapeNonCardFact", () => {
  test("transforma Accounts em despesa bancária", () => {
    const fact = makeFact("AccountControlDB", "Accounts", "acc-1", {
      name: "Conta Corrente",
      amount: -1200.5,
      accountDate: "2026-01-15",
      createdAt: "2026-01-15T00:00:00Z",
    });

    const result = shapeNonCardFact(fact, {
      userId: targetUserId,
      currency: "BRL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.description).toBe("Conta Corrente");
    expect(result.value.paymentMethod.kind).toBe("other_bank_transfer");
    expect(result.value.installmentPlan.totalInstallments).toBe(1);
    expect(result.value.occurredOn.sourceField).toBe("AccountDate");
  });

  test("detecta pix por evidência em BillItem", () => {
    const fact = makeFact("FinancialControlDB", "BillItem", "bi-1", {
      description: "Pagamento via PIX",
      amount: 89.9,
      billDate: "2026-02-20",
    });

    const result = shapeNonCardFact(fact, {
      userId: targetUserId,
      currency: "BRL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.paymentMethod).toEqual({ kind: "pix" });
    expect(result.value.factKey.paymentContext).toEqual({
      kind: "bank-transfer",
      method: "pix",
    });
  });

  test("detecta TED por evidência em TransactionItem", () => {
    const fact = makeFact("FinancialControlDB", "TransactionItem", "ti-1", {
      description: "TED recebida",
      amount: 3500,
      transactionDate: "2026-03-10",
      kind: "income",
    });

    const result = shapeNonCardFact(fact, {
      userId: targetUserId,
      currency: "BRL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.kind).toBe("income");
    expect(result.value.paymentMethod).toEqual({ kind: "ted" });
  });

  test("usa CreatedAt como fallback de data", () => {
    const fact = makeFact("FinancialControlDB", "TransactionItem", "ti-2", {
      description: "Débito automático",
      amount: 99.9,
      createdAt: "2026-04-01T00:00:00Z",
    });

    const result = shapeNonCardFact(fact, {
      userId: targetUserId,
      currency: "BRL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.occurredOn.sourceField).toBe("CreatedAt");
    expect(result.value.occurredOn.fallbackUsed).toBe(true);
  });

  test("rejeita fato sem valor", () => {
    const fact = makeFact("FinancialControlDB", "BillItem", "bi-2", {
      description: "Sem valor",
      billDate: "2026-01-10",
    });

    const result = shapeNonCardFact(fact, {
      userId: targetUserId,
      currency: "BRL",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_MONEY_AMOUNT");
    }
  });

  test("rejeita fato sem data", () => {
    const fact = makeFact("AccountControlDB", "Accounts", "acc-2", {
      name: "Sem data",
      amount: 10,
    });

    const result = shapeNonCardFact(fact, {
      userId: targetUserId,
      currency: "BRL",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_OCCURRENCE_DATE");
    }
  });

  test("detecta dinheiro por evidência", () => {
    const fact = makeFact("FinancialControlDB", "TransactionItem", "ti-3", {
      description: "Pagamento em dinheiro",
      amount: 45,
      transactionDate: "2026-05-01",
    });

    const result = shapeNonCardFact(fact, {
      userId: targetUserId,
      currency: "BRL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.paymentMethod).toEqual({ kind: "cash" });
  });
});
