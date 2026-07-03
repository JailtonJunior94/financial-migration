import { describe, expect, test } from "bun:test";
import {
  createInstallmentPlan,
  isSinglePayment,
} from "../../../src/domain/consolidation/installment-plan.ts";

describe("createInstallmentPlan", () => {
  test("cria parcelamento válido", () => {
    const result = createInstallmentPlan("purchase-123", 2, 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.groupKey).toBe("purchase-123");
      expect(result.value.currentInstallment).toBe(2);
      expect(result.value.totalInstallments).toBe(10);
    }
  });

  test("permite pagamento único", () => {
    const result = createInstallmentPlan("purchase-456", 1, 1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.currentInstallment).toBe(1);
      expect(result.value.totalInstallments).toBe(1);
    }
  });

  test("rejeita chave de agrupamento vazia", () => {
    const result = createInstallmentPlan("", 1, 1);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INSTALLMENT_PLAN");
    }
  });

  test("rejeita parcela atual menor que 1", () => {
    const result = createInstallmentPlan("purchase-123", 0, 10);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INSTALLMENT_PLAN");
    }
  });

  test("rejeita total de parcelas menor que 1", () => {
    const result = createInstallmentPlan("purchase-123", 1, 0);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INSTALLMENT_PLAN");
    }
  });

  test("rejeita parcela atual maior que total", () => {
    const result = createInstallmentPlan("purchase-123", 11, 10);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INSTALLMENT_PLAN");
    }
  });

  test("rejeita valores não inteiros", () => {
    const result = createInstallmentPlan("purchase-123", 1.5, 10);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INSTALLMENT_PLAN");
    }
  });
});

describe("isSinglePayment", () => {
  test("retorna true para pagamento único", () => {
    const plan = createInstallmentPlan("purchase-456", 1, 1);
    if (!plan.ok) return;

    expect(isSinglePayment(plan.value)).toBe(true);
  });

  test("retorna false para parcelado", () => {
    const plan = createInstallmentPlan("purchase-789", 2, 5);
    if (!plan.ok) return;

    expect(isSinglePayment(plan.value)).toBe(false);
  });
});
