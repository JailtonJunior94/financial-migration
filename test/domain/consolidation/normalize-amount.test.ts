import { describe, expect, test } from "bun:test";
import { normalizeAmount } from "../../../src/domain/consolidation/normalize-amount.ts";

describe("normalizeAmount", () => {
  test("converte número inteiro para minorUnits", () => {
    const result = normalizeAmount(100, "BRL", 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.minorUnits).toBe(10000n);
      expect(result.value.scale).toBe(2);
      expect(result.value.currency).toBe("BRL");
    }
  });

  test("converte número decimal com half-even", () => {
    const result = normalizeAmount(10.555, "BRL", 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.minorUnits).toBe(1056n);
    }
  });

  test("converte string numérica", () => {
    const result = normalizeAmount("250.99", "BRL", 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.minorUnits).toBe(25099n);
    }
  });

  test("converte bigint diretamente", () => {
    const result = normalizeAmount(500n, "BRL", 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.minorUnits).toBe(500n);
    }
  });

  test("rejeita valor não numérico", () => {
    const result = normalizeAmount("não é número", "BRL", 2);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_MONEY_AMOUNT");
    }
  });

  test("rejeita valor indefinido", () => {
    const result = normalizeAmount(undefined, "BRL", 2);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_MONEY_AMOUNT");
    }
  });

  test("aplica half-even para meio exato em número par", () => {
    const result = normalizeAmount(2.05, "BRL", 1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.minorUnits).toBe(20n);
    }
  });

  test("aplica half-even para meio exato em número ímpar", () => {
    const result = normalizeAmount(2.15, "BRL", 1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.minorUnits).toBe(22n);
    }
  });

  test("preserva sinal negativo", () => {
    const result = normalizeAmount(-49.9, "BRL", 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.minorUnits).toBe(-4990n);
    }
  });
});
