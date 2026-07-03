import { describe, expect, test } from "bun:test";
import {
  createOccurrenceDate,
  createOccurrenceDateFromFact,
} from "../../../src/domain/consolidation/occurrence-date.ts";

describe("createOccurrenceDate", () => {
  test("cria data de ocorrência com campo fonte", () => {
    const result = createOccurrenceDate("2026-01-15", "PurchaseDate");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.value).toBe("2026-01-15");
      expect(result.value.sourceField).toBe("PurchaseDate");
      expect(result.value.fallbackUsed).toBe(false);
    }
  });

  test("aceita data ISO completa", () => {
    const result = createOccurrenceDate(
      "2026-01-15T10:30:00.000Z",
      "TransactionDate",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.value).toBe("2026-01-15T10:30:00.000Z");
    }
  });

  test("rejeita valor vazio", () => {
    const result = createOccurrenceDate("", "PurchaseDate");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_OCCURRENCE_DATE");
    }
  });

  test("rejeita data inválida", () => {
    const result = createOccurrenceDate("não-é-data", "PurchaseDate");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_OCCURRENCE_DATE");
    }
  });

  test("rejeita data numericamente inválida", () => {
    const result = createOccurrenceDate("2026-02-30", "PurchaseDate");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_OCCURRENCE_DATE");
    }
  });

  test("rejeita campo fonte vazio", () => {
    const result = createOccurrenceDate("2026-01-15", "  ");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_OCCURRENCE_DATE");
    }
  });

  test("preserva flag de fallback", () => {
    const result = createOccurrenceDate("2026-01-15", "CreatedAt", true);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fallbackUsed).toBe(true);
    }
  });
});

describe("createOccurrenceDateFromFact", () => {
  test("usa data do fato quando disponível", () => {
    const result = createOccurrenceDateFromFact(
      "2026-01-15",
      "PurchaseDate",
      "2026-01-10T00:00:00Z",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.value).toBe("2026-01-15");
      expect(result.value.sourceField).toBe("PurchaseDate");
      expect(result.value.fallbackUsed).toBe(false);
    }
  });

  test("usa CreatedAt como fallback quando fato não existe", () => {
    const result = createOccurrenceDateFromFact(
      undefined,
      "PurchaseDate",
      "2026-01-10T00:00:00Z",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sourceField).toBe("CreatedAt");
      expect(result.value.fallbackUsed).toBe(true);
    }
  });

  test("rejeita quando nenhuma data está disponível", () => {
    const result = createOccurrenceDateFromFact(
      undefined,
      "PurchaseDate",
      undefined,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_OCCURRENCE_DATE");
    }
  });
});
