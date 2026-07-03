import { describe, expect, test } from "bun:test";
import type { LegacyFact } from "../../../src/application/ports/legacy-financial-fact-reader-port.ts";
import { validateInvoiceTotals } from "../../../src/domain/consolidation/validate-invoice-totals.ts";

const buildFact = (
  database: "AccountControlDB" | "FinancialControlDB",
  table: string,
  primaryKey: string,
  fields: Record<string, unknown>,
): LegacyFact => ({
  ref: { database, table, primaryKey },
  fields,
});

describe("validateInvoiceTotals", () => {
  test("retorna vazio quando não há faturas", () => {
    const facts: LegacyFact[] = [
      buildFact("FinancialControlDB", "Bill", "1", { total: 100 }),
    ];

    const result = validateInvoiceTotals(facts);
    expect(result.issues).toHaveLength(0);
  });

  test("retorna vazio quando não há itens", () => {
    const facts: LegacyFact[] = [
      buildFact("FinancialControlDB", "Invoice", "1", { total: 100 }),
    ];

    const result = validateInvoiceTotals(facts);
    expect(result.issues).toHaveLength(0);
  });

  test("não gera issue quando total da fatura bate com soma dos itens", () => {
    const facts: LegacyFact[] = [
      buildFact("FinancialControlDB", "Invoice", "inv-1", { total: 150 }),
      buildFact("FinancialControlDB", "InvoiceItem", "item-1", {
        invoiceId: "inv-1",
        amount: 100,
      }),
      buildFact("FinancialControlDB", "InvoiceItem", "item-2", {
        invoiceId: "inv-1",
        amount: 50,
      }),
    ];

    const result = validateInvoiceTotals(facts);
    expect(result.issues).toHaveLength(0);
  });

  test("gera issue quando total da fatura diverge da soma dos itens", () => {
    const facts: LegacyFact[] = [
      buildFact("FinancialControlDB", "Invoice", "inv-1", { total: 200 }),
      buildFact("FinancialControlDB", "InvoiceItem", "item-1", {
        invoiceId: "inv-1",
        amount: 100,
      }),
      buildFact("FinancialControlDB", "InvoiceItem", "item-2", {
        invoiceId: "inv-1",
        amount: 50,
      }),
    ];

    const result = validateInvoiceTotals(facts);
    expect(result.issues).toHaveLength(1);
    const issue = result.issues[0];
    expect(issue).not.toBeUndefined();
    expect(issue!.kind).toBe("reconciliation-conflict");
    expect(issue!.severity).toBe("blocking");
    expect(issue!.reason).toContain("Divergência material");
  });

  test("agrupa itens de AccountControlDB.Invoices corretamente", () => {
    const facts: LegacyFact[] = [
      buildFact("AccountControlDB", "Invoices", "inv-ac-1", { total: 80 }),
      buildFact("AccountControlDB", "InvoiceItem", "item-ac-1", {
        invoiceId: "inv-ac-1",
        amount: 80,
      }),
    ];

    const result = validateInvoiceTotals(facts);
    expect(result.issues).toHaveLength(0);
  });

  test("ignora itens sem vínculo de invoiceId", () => {
    const facts: LegacyFact[] = [
      buildFact("FinancialControlDB", "Invoice", "inv-1", { total: 100 }),
      buildFact("FinancialControlDB", "InvoiceItem", "item-1", {
        amount: 100,
      }),
    ];

    const result = validateInvoiceTotals(facts);
    expect(result.issues).toHaveLength(0);
  });

  test("não gera issue quando header não possui total", () => {
    const facts: LegacyFact[] = [
      buildFact("FinancialControlDB", "Invoice", "inv-1", {
        date: "2024-01-15",
      }),
      buildFact("FinancialControlDB", "InvoiceItem", "item-1", {
        invoiceId: "inv-1",
        amount: 100,
      }),
    ];

    const result = validateInvoiceTotals(facts);
    expect(result.issues).toHaveLength(0);
  });

  test("soma múltiplas faturas independentemente", () => {
    const facts: LegacyFact[] = [
      buildFact("FinancialControlDB", "Invoice", "inv-1", { total: 100 }),
      buildFact("FinancialControlDB", "InvoiceItem", "item-1", {
        invoiceId: "inv-1",
        amount: 100,
      }),
      buildFact("FinancialControlDB", "Invoice", "inv-2", { total: 50 }),
      buildFact("FinancialControlDB", "InvoiceItem", "item-2", {
        invoiceId: "inv-2",
        amount: 60,
      }),
    ];

    const result = validateInvoiceTotals(facts);
    expect(result.issues).toHaveLength(1);
    const issue = result.issues[0];
    expect(issue).not.toBeUndefined();
    expect(issue!.evidence.invoiceId).toBe("inv-2");
  });
});
