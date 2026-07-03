import { describe, expect, test } from "bun:test";
import {
  createMoneyAmount,
  formatMoneyAmount,
  moneyAmountsAreEqual,
  normalizeMoneyAmount,
} from "../../../src/domain/consolidation/money-amount.ts";

describe("createMoneyAmount", () => {
  test("cria valor monetário com escala e moeda válidos", () => {
    const result = createMoneyAmount(12345n, 2, "BRL");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.minorUnits).toBe(12345n);
      expect(result.value.scale).toBe(2);
      expect(result.value.currency).toBe("BRL");
    }
  });

  test("normaliza moeda para maiúsculas", () => {
    const result = createMoneyAmount(100n, 0, "brl");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.currency).toBe("BRL");
    }
  });

  test("rejeita escala negativa", () => {
    const result = createMoneyAmount(100n, -1, "BRL");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_MONEY_AMOUNT");
    }
  });

  test("rejeita escala acima do máximo permitido", () => {
    const result = createMoneyAmount(100n, 19, "BRL");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_MONEY_AMOUNT");
    }
  });

  test("rejeita moeda fora do formato ISO 4217", () => {
    const result = createMoneyAmount(100n, 2, "reais");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_MONEY_AMOUNT");
    }
  });
});

describe("normalizeMoneyAmount", () => {
  test("mantém inalterado quando escala é igual", () => {
    const amount = createMoneyAmount(100n, 2, "BRL");
    if (!amount.ok) return;

    const normalized = normalizeMoneyAmount(amount.value, 2);

    expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      expect(normalized.value.minorUnits).toBe(100n);
      expect(normalized.value.scale).toBe(2);
    }
  });

  test("aumenta escala multiplicando minorUnits", () => {
    const amount = createMoneyAmount(1n, 0, "BRL");
    if (!amount.ok) return;

    const normalized = normalizeMoneyAmount(amount.value, 3);

    expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      expect(normalized.value.minorUnits).toBe(1000n);
      expect(normalized.value.scale).toBe(3);
    }
  });

  test("reduz escala com arredondamento half-even para cima", () => {
    const amount = createMoneyAmount(105n, 2, "BRL");
    if (!amount.ok) return;

    const normalized = normalizeMoneyAmount(amount.value, 1);

    expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      expect(normalized.value.minorUnits).toBe(10n);
    }
  });

  test("reduz escala com arredondamento half-even para baixo", () => {
    const amount = createMoneyAmount(104n, 2, "BRL");
    if (!amount.ok) return;

    const normalized = normalizeMoneyAmount(amount.value, 1);

    expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      expect(normalized.value.minorUnits).toBe(10n);
    }
  });

  test("arredonda para par mais próximo em caso de meio", () => {
    const amount = createMoneyAmount(105n, 2, "BRL");
    if (!amount.ok) return;

    const normalized = normalizeMoneyAmount(amount.value, 1);

    expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      expect(normalized.value.minorUnits).toBe(10n);
    }
  });

  test("arredonda para par mais próximo em caso de meio com inteiro par", () => {
    const amount = createMoneyAmount(115n, 2, "BRL");
    if (!amount.ok) return;

    const normalized = normalizeMoneyAmount(amount.value, 1);

    expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      expect(normalized.value.minorUnits).toBe(12n);
    }
  });

  test("rejeita escala alvo inválida", () => {
    const amount = createMoneyAmount(100n, 2, "BRL");
    if (!amount.ok) return;

    const normalized = normalizeMoneyAmount(amount.value, 20);

    expect(normalized.ok).toBe(false);
    if (!normalized.ok) {
      expect(normalized.error.code).toBe("INVALID_MONEY_AMOUNT");
    }
  });
});

describe("moneyAmountsAreEqual", () => {
  test("considera iguais valores equivalentes em escalas diferentes", () => {
    const left = createMoneyAmount(100n, 2, "BRL");
    const right = createMoneyAmount(1000n, 3, "BRL");
    if (!left.ok || !right.ok) return;

    expect(moneyAmountsAreEqual(left.value, right.value)).toBe(true);
  });

  test("considera diferentes valores distintos", () => {
    const left = createMoneyAmount(100n, 2, "BRL");
    const right = createMoneyAmount(101n, 2, "BRL");
    if (!left.ok || !right.ok) return;

    expect(moneyAmountsAreEqual(left.value, right.value)).toBe(false);
  });

  test("considera diferentes moedas distintas", () => {
    const left = createMoneyAmount(100n, 2, "BRL");
    const right = createMoneyAmount(100n, 2, "USD");
    if (!left.ok || !right.ok) return;

    expect(moneyAmountsAreEqual(left.value, right.value)).toBe(false);
  });
});

describe("formatMoneyAmount", () => {
  test("formata valor com duas casas decimais", () => {
    const amount = createMoneyAmount(12345n, 2, "BRL");
    if (!amount.ok) return;

    expect(formatMoneyAmount(amount.value)).toBe("123.45 BRL");
  });

  test("formata valor negativo", () => {
    const amount = createMoneyAmount(-500n, 2, "BRL");
    if (!amount.ok) return;

    expect(formatMoneyAmount(amount.value)).toBe("-5.00 BRL");
  });

  test("formata valor sem casas decimais", () => {
    const amount = createMoneyAmount(42n, 0, "BRL");
    if (!amount.ok) return;

    expect(formatMoneyAmount(amount.value)).toBe("42 BRL");
  });
});
