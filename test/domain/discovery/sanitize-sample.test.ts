import { describe, expect, test } from "bun:test";
import { sanitizeSample } from "../../../src/domain/discovery/sanitize-sample.ts";

describe("sanitizeSample", () => {
  test("preserva valores primitivos e normaliza datas", () => {
    const result = sanitizeSample("FinancialControlDB", "InvoiceItem", "1", {
      id: 1,
      amount: 123.45,
      is_active: true,
      description: "Supermercado",
      created_at: new Date("2026-01-15T00:00:00.000Z"),
      metadata: null,
    });

    expect(result.fields.id).toBe(1);
    expect(result.fields.amount).toBe(123.45);
    expect(result.fields.is_active).toBe(true);
    expect(result.fields.description).toBe("Supermercado");
    expect(result.fields.created_at).toBe("2026-01-15T00:00:00.000Z");
    expect(result.fields.metadata).toBeNull();
  });

  test("mascara números de cartão mantendo os últimos quatro dígitos", () => {
    const result = sanitizeSample("AccountControlDB", "Cards", "10", {
      id: 10,
      card_number: "4111111111111111",
      masked_pan: "411111######1111",
    });

    expect(result.fields.card_number).toBe("****1111");
    expect(result.fields.masked_pan).toBe("****1111");
  });

  test("reduz a amostra de cartão quando há menos de quatro dígitos", () => {
    const result = sanitizeSample("AccountControlDB", "Cards", "11", {
      card_number: "123",
    });

    expect(result.fields.card_number).toBe("[REDACTED]");
  });

  test("redige campos sensíveis por nome", () => {
    const result = sanitizeSample(
      "FinancialControlDB",
      "TransactionItem",
      "99",
      {
        id: 99,
        password: "secret123",
        access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        api_key: "pk_live_123456",
        cvv: "123",
        private_key: "-----BEGIN RSA PRIVATE KEY-----",
      },
    );

    expect(result.fields.password).toBe("[REDACTED]");
    expect(result.fields.access_token).toBe("[REDACTED]");
    expect(result.fields.api_key).toBe("[REDACTED]");
    expect(result.fields.cvv).toBe("[REDACTED]");
    expect(result.fields.private_key).toBe("[REDACTED]");
  });

  test("trunca strings longas", () => {
    const longDescription = "a".repeat(300);
    const result = sanitizeSample("FinancialControlDB", "BillItem", "5", {
      id: 5,
      description: longDescription,
    });

    const sanitized = result.fields.description as string;
    expect(sanitized.length).toBe(201);
    expect(sanitized.endsWith("…")).toBe(true);
  });

  test("representa dados binários sem expor conteúdo", () => {
    const result = sanitizeSample("FinancialControlDB", "Card", "7", {
      id: 7,
      thumbnail: new Uint8Array([1, 2, 3, 4, 5]),
    });

    expect(result.fields.thumbnail).toBe("[BINARY:5]");
  });

  test("preserva database, tableName e primaryKey no snapshot", () => {
    const result = sanitizeSample("AccountControlDB", "Accounts", "42", {
      id: 42,
    });

    expect(result.database).toBe("AccountControlDB");
    expect(result.tableName).toBe("Accounts");
    expect(result.primaryKey).toBe("42");
  });
});
