import { describe, expect, test } from "bun:test";
import { deriveCompetence } from "../../../src/domain/consolidation/competence.ts";

describe("deriveCompetence", () => {
  test("extrai ano e mês de data ISO simples", () => {
    const result = deriveCompetence("2026-01-15");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("2026-01");
    }
  });

  test("extrai ano e mês de timestamp ISO", () => {
    const result = deriveCompetence("2026-12-31T23:59:59.000Z");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("2026-12");
    }
  });

  test("rejeita valor vazio", () => {
    const result = deriveCompetence("");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_OCCURRENCE_DATE");
    }
  });

  test("rejeita data sem prefixo ISO", () => {
    const result = deriveCompetence("15/01/2026");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_OCCURRENCE_DATE");
    }
  });
});
