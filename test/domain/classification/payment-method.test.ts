import { describe, expect, test } from "bun:test";
import {
  inferPaymentMethod,
  paymentMethodIsProvable,
} from "../../../src/domain/classification/payment-method.ts";

describe("inferPaymentMethod", () => {
  test("retorna credit_card quando há vínculo de cartão", () => {
    const result = inferPaymentMethod({
      sourceTable: "InvoiceItem",
      description: "Supermercado",
      hasCardBinding: true,
      cardBusinessKey: "card-123",
    });

    expect(result).toEqual({
      kind: "credit_card",
      cardBusinessKey: "card-123",
    });
  });

  test("retorna credit_card para InvoiceItem com cardBusinessKey mesmo sem hasCardBinding", () => {
    const result = inferPaymentMethod({
      sourceTable: "InvoiceItem",
      description: "Supermercado",
      hasCardBinding: false,
      cardBusinessKey: "card-123",
    });

    expect(result).toEqual({
      kind: "credit_card",
      cardBusinessKey: "card-123",
    });
  });

  test("detecta pix por evidência na descrição", () => {
    const result = inferPaymentMethod({
      sourceTable: "TransactionItem",
      description: "Pagamento via pix",
      hasCardBinding: false,
    });

    expect(result).toEqual({ kind: "pix" });
  });

  test("detecta pix por evidência explícita", () => {
    const result = inferPaymentMethod({
      sourceTable: "BillItem",
      description: "Transferência",
      hasCardBinding: false,
      pixEvidence: true,
    });

    expect(result).toEqual({ kind: "pix" });
  });

  test("detecta ted por evidência na descrição", () => {
    const result = inferPaymentMethod({
      sourceTable: "TransactionItem",
      description: "TED enviada",
      hasCardBinding: false,
    });

    expect(result).toEqual({ kind: "ted" });
  });

  test("detecta transferência genérica como ted", () => {
    const result = inferPaymentMethod({
      sourceTable: "BillItem",
      description: "Transferência bancária",
      hasCardBinding: false,
    });

    expect(result).toEqual({ kind: "ted" });
  });

  test("detecta dinheiro", () => {
    const result = inferPaymentMethod({
      sourceTable: "TransactionItem",
      description: "Pagamento em dinheiro",
      hasCardBinding: false,
    });

    expect(result).toEqual({ kind: "cash" });
  });

  test("retorna other_bank_transfer para Accounts sem evidência forte", () => {
    const result = inferPaymentMethod({
      sourceTable: "Accounts",
      description: "Débito automático",
      hasCardBinding: false,
    });

    expect(result).toEqual({ kind: "other_bank_transfer" });
  });

  test("retorna unknown quando não há evidência suficiente", () => {
    const result = inferPaymentMethod({
      sourceTable: "OtherTable",
      description: "Lançamento genérico",
      hasCardBinding: false,
    });

    expect(result).toEqual({ kind: "unknown" });
  });
});

describe("paymentMethodIsProvable", () => {
  test("considera pix como provável", () => {
    expect(paymentMethodIsProvable({ kind: "pix" })).toBe(true);
  });

  test("considera unknown como não provável", () => {
    expect(paymentMethodIsProvable({ kind: "unknown" })).toBe(false);
  });
});
