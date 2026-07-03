import { describe, expect, test } from "bun:test";
import {
  DISCOVERY_DATABASES,
  DISCOVERY_SCOPE,
  isTableInScope,
} from "../../../src/domain/discovery/scope.ts";
import {
  resolveSemanticMetadata,
  resolveSemanticRole,
} from "../../../src/domain/discovery/table-role-matrix.ts";

describe("table role matrix", () => {
  test("toda tabela do escopo tem papel semântico mapeado", () => {
    for (const database of DISCOVERY_DATABASES) {
      for (const tableName of DISCOVERY_SCOPE[database]) {
        expect(isTableInScope(database, tableName)).toBe(true);
        const metadata = resolveSemanticMetadata(database, tableName);
        expect(metadata.role).not.toBe("unknown");
        expect(metadata.rationale.length).toBeGreaterThan(0);
        expect(metadata.risks.length).toBeGreaterThan(0);
      }
    }
  });

  test("mapeia AccountControlDB.Cards como registro de cartão", () => {
    const metadata = resolveSemanticMetadata("AccountControlDB", "Cards");

    expect(metadata.role).toBe("card_register");
    expect(metadata.granularity).toBe("register");
    expect(metadata.hasDirectUserLink).toBe(true);
  });

  test("mapeia AccountControlDB.Accounts com regra afirmativa", () => {
    const metadata = resolveSemanticMetadata("AccountControlDB", "Accounts");

    expect(metadata.role).toBe("account_register");
    expect(metadata.hasDirectUserLink).toBe(true);
    expect(metadata.rationale).toContain("RF-13A");
  });

  test("headers de fatura são agregados e não publicáveis diretamente", () => {
    const accountInvoice = resolveSemanticMetadata(
      "AccountControlDB",
      "Invoices",
    );
    const financialInvoice = resolveSemanticMetadata(
      "FinancialControlDB",
      "Invoice",
    );

    expect(accountInvoice.role).toBe("invoice_header");
    expect(accountInvoice.granularity).toBe("aggregate");
    expect(accountInvoice.rationale).toContain("não para publicação direta");

    expect(financialInvoice.role).toBe("invoice_header");
    expect(financialInvoice.granularity).toBe("aggregate");
  });

  test("itens detalhados são publicáveis como transactions", () => {
    const invoiceItem = resolveSemanticMetadata(
      "FinancialControlDB",
      "InvoiceItem",
    );
    const billItem = resolveSemanticMetadata("FinancialControlDB", "BillItem");
    const transactionItem = resolveSemanticMetadata(
      "FinancialControlDB",
      "TransactionItem",
    );

    expect(invoiceItem.role).toBe("invoice_item");
    expect(invoiceItem.granularity).toBe("detail");
    expect(billItem.role).toBe("bill_item");
    expect(transactionItem.role).toBe("transaction_item");
  });

  test("tabelas fora da matriz retornam unknown com risco de revisão", () => {
    const metadata = resolveSemanticMetadata(
      "AccountControlDB",
      "UnknownTable",
    );

    expect(metadata.role).toBe("unknown");
    expect(metadata.risks[0]).toContain("não mapeado");
  });

  test("resolveSemanticRole retorna o papel correto", () => {
    expect(resolveSemanticRole("FinancialControlDB", "Card")).toBe(
      "card_register",
    );
    expect(resolveSemanticRole("FinancialControlDB", "Bill")).toBe(
      "bill_header",
    );
  });
});
