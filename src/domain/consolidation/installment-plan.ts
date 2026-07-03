import { DomainError } from "../common/errors.ts";
import { type Result, failure, success } from "../common/result.ts";

export type InstallmentPlan = {
  readonly groupKey: string;
  readonly currentInstallment: number;
  readonly totalInstallments: number;
};

export const createInstallmentPlan = (
  groupKey: string,
  currentInstallment: number,
  totalInstallments: number,
): Result<InstallmentPlan, DomainError> => {
  const key = groupKey.trim();

  if (key.length === 0) {
    return failure(
      new DomainError(
        "INVALID_INSTALLMENT_PLAN",
        "Chave de agrupamento do parcelamento não pode ser vazia.",
      ),
    );
  }

  if (
    !Number.isInteger(currentInstallment) ||
    !Number.isInteger(totalInstallments) ||
    currentInstallment < 1 ||
    totalInstallments < 1
  ) {
    return failure(
      new DomainError(
        "INVALID_INSTALLMENT_PLAN",
        "Parcela atual e quantidade total devem ser inteiros positivos.",
        { currentInstallment, totalInstallments },
      ),
    );
  }

  if (currentInstallment > totalInstallments) {
    return failure(
      new DomainError(
        "INVALID_INSTALLMENT_PLAN",
        "Parcela atual não pode ser maior que a quantidade total de parcelas.",
        { currentInstallment, totalInstallments },
      ),
    );
  }

  return success({
    groupKey: key,
    currentInstallment,
    totalInstallments,
  });
};

export const isSinglePayment = (plan: InstallmentPlan): boolean =>
  plan.totalInstallments === 1;
