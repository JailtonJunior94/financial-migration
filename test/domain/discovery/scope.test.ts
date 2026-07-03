import { describe, expect, test } from "bun:test";
import {
  DISCOVERY_DATABASES,
  DISCOVERY_SCOPE,
  expectedTableCount,
  isTableInScope,
} from "../../../src/domain/discovery/scope.ts";

describe("discovery scope", () => {
  test("cobre exatamente as tabelas de RF-01 e RF-02", () => {
    expect(DISCOVERY_DATABASES).toEqual([
      "AccountControlDB",
      "FinancialControlDB",
    ]);
    expect(DISCOVERY_SCOPE.AccountControlDB).toEqual([
      "Cards",
      "Accounts",
      "Invoices",
    ]);
    expect(DISCOVERY_SCOPE.FinancialControlDB).toEqual([
      "Bill",
      "BillItem",
      "Card",
      "Invoice",
      "InvoiceItem",
      "Transaction",
      "TransactionItem",
    ]);
  });

  test("conta o total esperado de tabelas", () => {
    expect(expectedTableCount()).toBe(10);
  });

  test("isTableInScope reconhece tabelas no escopo", () => {
    expect(isTableInScope("AccountControlDB", "Cards")).toBe(true);
    expect(isTableInScope("FinancialControlDB", "InvoiceItem")).toBe(true);
  });

  test("isTableInScope rejeita tabelas fora do escopo", () => {
    expect(isTableInScope("AccountControlDB", "Users")).toBe(false);
    expect(isTableInScope("FinancialControlDB", "Cards")).toBe(false);
  });
});
