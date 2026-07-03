import { describe, expect, test } from "bun:test";
import type { LegacyFact } from "../../../src/application/ports/legacy-financial-fact-reader-port.ts";
import { canonicalFactKeyHash } from "../../../src/domain/consolidation/canonical-fact-key.ts";
import { shapeInvoiceItem } from "../../../src/domain/consolidation/shape-invoice-item.ts";

const targetUserId = "06edc407-4f63-42e8-b07c-946b9ef0a19c";

const makeInvoiceItem = (
  primaryKey: string,
  fields: Record<string, unknown>,
): LegacyFact => ({
  ref: {
    database: "FinancialControlDB",
    table: "InvoiceItem",
    primaryKey,
  },
  fields,
});

describe("shapeInvoiceItem", () => {
  test("cria transação única para pagamento à vista", () => {
    const fact = makeInvoiceItem("ii-1", {
      description: "Supermercado Central",
      amount: 150.75,
      purchaseDate: "2026-01-10",
      createdAt: "2026-01-10T12:00:00Z",
    });

    const result = shapeInvoiceItem(fact, {
      userId: targetUserId,
      cardBusinessKey: "visa-1234",
      invoiceCompetence: "2026-01",
      currency: "BRL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
    const transaction = result.value[0];
    if (!transaction) return;

    expect(transaction.kind).toBe("expense");
    expect(transaction.description).toBe("Supermercado Central");
    expect(transaction.paymentMethod).toEqual({
      kind: "credit_card",
      cardBusinessKey: "visa-1234",
    });
    expect(transaction.installmentPlan.totalInstallments).toBe(1);
    expect(transaction.competence).toBe("2026-01");
    expect(transaction.cardBinding).toBe("visa-1234");
    expect(transaction.occurredOn.value).toBe("2026-01-10");
  });

  test("cria uma transação por parcela efetiva quando parcela atual é 1", () => {
    const fact = makeInvoiceItem("ii-2", {
      description: "Compra parcelada",
      amount: 300,
      purchaseDate: "2026-02-05",
      installmentNumber: 1,
      totalInstallments: 3,
    });

    const result = shapeInvoiceItem(fact, {
      userId: targetUserId,
      cardBusinessKey: "mastercard-5678",
      invoiceCompetence: "2026-02",
      currency: "BRL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(3);

    const installments = result.value.map((t) => t.installmentPlan);
    expect(installments[0]).toEqual(
      expect.objectContaining({ currentInstallment: 1, totalInstallments: 3 }),
    );
    expect(installments[1]).toEqual(
      expect.objectContaining({ currentInstallment: 2, totalInstallments: 3 }),
    );
    expect(installments[2]).toEqual(
      expect.objectContaining({ currentInstallment: 3, totalInstallments: 3 }),
    );

    const hashes = result.value.map((t) => canonicalFactKeyHash(t.factKey));
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(3);
  });

  test("cria apenas a parcela atual quando índice é maior que 1", () => {
    const fact = makeInvoiceItem("ii-3", {
      description: "Parcela 2",
      amount: 100,
      purchaseDate: "2026-03-01",
      installmentNumber: 2,
      totalInstallments: 5,
    });

    const result = shapeInvoiceItem(fact, {
      userId: targetUserId,
      cardBusinessKey: "visa-1234",
      invoiceCompetence: "2026-03",
      currency: "BRL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
    const singleTransaction = result.value[0];
    if (!singleTransaction) return;

    expect(singleTransaction.installmentPlan).toEqual(
      expect.objectContaining({ currentInstallment: 2, totalInstallments: 5 }),
    );
  });

  test("usar CreatedAt como fallback de data", () => {
    const fact = makeInvoiceItem("ii-4", {
      description: "Compra sem data",
      amount: 50,
      createdAt: "2026-04-01T00:00:00Z",
    });

    const result = shapeInvoiceItem(fact, {
      userId: targetUserId,
      cardBusinessKey: "visa-1234",
      invoiceCompetence: "2026-04",
      currency: "BRL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const fallbackTransaction = result.value[0];
    if (!fallbackTransaction) return;

    expect(fallbackTransaction.occurredOn.value).toBe("2026-04-01T00:00:00Z");
    expect(fallbackTransaction.occurredOn.fallbackUsed).toBe(true);
  });

  test("rejeita InvoiceItem sem amount", () => {
    const fact = makeInvoiceItem("ii-5", {
      description: "Sem valor",
      purchaseDate: "2026-01-10",
    });

    const result = shapeInvoiceItem(fact, {
      userId: targetUserId,
      cardBusinessKey: "visa-1234",
      invoiceCompetence: "2026-01",
      currency: "BRL",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_MONEY_AMOUNT");
    }
  });

  test("preserva vínculo de cartão no fato canônico", () => {
    const fact = makeInvoiceItem("ii-6", {
      description: "Combustível",
      amount: 200,
      purchaseDate: "2026-05-10",
    });

    const result = shapeInvoiceItem(fact, {
      userId: targetUserId,
      cardBusinessKey: "visa-1234",
      invoiceCompetence: "2026-05",
      currency: "BRL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const cardTransaction = result.value[0];
    if (!cardTransaction) return;

    expect(cardTransaction.factKey.paymentContext).toEqual({
      kind: "credit-card",
      cardBusinessKey: "visa-1234",
    });
  });
});
