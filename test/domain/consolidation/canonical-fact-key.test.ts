import { describe, expect, test } from "bun:test";
import {
  canonicalFactKeyHash,
  canonicalFactKeyToString,
  createCanonicalFactKey,
} from "../../../src/domain/consolidation/canonical-fact-key.ts";
import { createMoneyAmount } from "../../../src/domain/consolidation/money-amount.ts";

describe("createCanonicalFactKey", () => {
  test("cria chave canônica para transação", () => {
    const amount = createMoneyAmount(9990n, 2, "BRL");
    if (!amount.ok) return;

    const result = createCanonicalFactKey(
      "transaction",
      "06edc407-4f63-42e8-b07c-946b9ef0a19c",
      "2026-01-15",
      "Supermercado Central",
      amount.value,
      { kind: "credit-card", cardBusinessKey: "card-123" },
      { kind: "single" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.resource).toBe("transaction");
      expect(result.value.userId).toBe("06edc407-4f63-42e8-b07c-946b9ef0a19c");
      expect(result.value.normalizedDescription).toBe("supermercado central");
      expect(result.value.normalizedAmountMinorUnits).toBe(9990n);
      expect(result.value.currency).toBe("BRL");
    }
  });

  test("rejeita userId que não é UUID", () => {
    const amount = createMoneyAmount(100n, 2, "BRL");
    if (!amount.ok) return;

    const result = createCanonicalFactKey(
      "transaction",
      "não-é-uuid",
      "2026-01-15",
      "Descrição",
      amount.value,
      { kind: "cash" },
      { kind: "single" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_CANONICAL_FACT_KEY");
    }
  });

  test("rejeita descrição vazia após normalização", () => {
    const amount = createMoneyAmount(100n, 2, "BRL");
    if (!amount.ok) return;

    const result = createCanonicalFactKey(
      "transaction",
      "06edc407-4f63-42e8-b07c-946b9ef0a19c",
      "2026-01-15",
      "!!!",
      amount.value,
      { kind: "cash" },
      { kind: "single" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_CANONICAL_FACT_KEY");
    }
  });

  test("rejeita moeda ausente", () => {
    const amount = { minorUnits: 100n, scale: 2, currency: "" };

    const result = createCanonicalFactKey(
      "transaction",
      "06edc407-4f63-42e8-b07c-946b9ef0a19c",
      "2026-01-15",
      "Descrição",
      amount,
      { kind: "cash" },
      { kind: "single" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_CANONICAL_FACT_KEY");
    }
  });
});

describe("canonicalFactKeyToString", () => {
  test("produz representação determinística", () => {
    const amount = createMoneyAmount(500n, 2, "BRL");
    if (!amount.ok) return;

    const keyResult = createCanonicalFactKey(
      "transaction",
      "06edc407-4f63-42e8-b07c-946b9ef0a19c",
      "2026-01-15",
      "Descrição Teste",
      amount.value,
      { kind: "bank-transfer", method: "pix" },
      { kind: "installment", groupKey: "g1", current: 1, total: 3 },
    );
    if (!keyResult.ok) return;

    const serialized = canonicalFactKeyToString(keyResult.value);

    expect(serialized).toContain('"resource":"transaction"');
    expect(serialized).toContain('"normalizedAmountMinorUnits":"500"');
    expect(serialized).toContain('"kind":"bank-transfer"');
    expect(serialized).toContain('"method":"pix"');
  });
});

describe("canonicalFactKeyHash", () => {
  test("produz hash SHA-256 hexadecimal de 64 caracteres", () => {
    const amount = createMoneyAmount(500n, 2, "BRL");
    if (!amount.ok) return;

    const keyResult = createCanonicalFactKey(
      "transaction",
      "06edc407-4f63-42e8-b07c-946b9ef0a19c",
      "2026-01-15",
      "Descrição Teste",
      amount.value,
      { kind: "bank-transfer", method: "pix" },
      { kind: "single" },
    );
    if (!keyResult.ok) return;

    const hash = canonicalFactKeyHash(keyResult.value);

    expect(hash.length).toBe(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  test("produz hash idêntico para chaves equivalentes", () => {
    const amount = createMoneyAmount(500n, 2, "BRL");
    if (!amount.ok) return;

    const keyA = createCanonicalFactKey(
      "transaction",
      "06edc407-4f63-42e8-b07c-946b9ef0a19c",
      "2026-01-15",
      "Descrição Teste",
      amount.value,
      { kind: "bank-transfer", method: "pix" },
      { kind: "single" },
    );
    const keyB = createCanonicalFactKey(
      "transaction",
      "06EDC407-4F63-42E8-B07C-946B9EF0A19C",
      "2026-01-15",
      "  Descrição   Teste  ",
      amount.value,
      { kind: "bank-transfer", method: "pix" },
      { kind: "single" },
    );

    if (!keyA.ok || !keyB.ok) return;

    expect(canonicalFactKeyHash(keyA.value)).toBe(
      canonicalFactKeyHash(keyB.value),
    );
  });
});
