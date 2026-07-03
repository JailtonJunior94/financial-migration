import type { PaymentContext } from "../consolidation/canonical-fact-key.ts";
import type { InstallmentPlan } from "../consolidation/installment-plan.ts";
import type { MoneyAmount } from "../consolidation/money-amount.ts";
import { moneyAmountsAreEqual } from "../consolidation/money-amount.ts";
import type { TransactionKind } from "../consolidation/types.ts";

export type CanonicalTransactionPayload = {
  readonly kind: TransactionKind;
  readonly occurredOn: string;
  readonly competence: string;
  readonly description: string;
  readonly amount: MoneyAmount;
  readonly categoryId: string;
  readonly subcategoryId?: string;
  readonly paymentContext: PaymentContext;
  readonly installmentPlan: InstallmentPlan;
};

const paymentContextsAreEqual = (
  left: PaymentContext,
  right: PaymentContext,
): boolean => {
  if (left.kind !== right.kind) {
    return false;
  }

  switch (left.kind) {
    case "credit-card":
    case "debit-card":
      return (
        right.kind === left.kind &&
        left.cardBusinessKey === right.cardBusinessKey
      );
    case "bank-transfer":
      return right.kind === "bank-transfer" && left.method === right.method;
    case "cash":
    case "unknown":
      return right.kind === left.kind;
  }
};

const installmentPlansAreEqual = (
  left: InstallmentPlan,
  right: InstallmentPlan,
): boolean =>
  left.groupKey === right.groupKey &&
  left.currentInstallment === right.currentInstallment &&
  left.totalInstallments === right.totalInstallments;

export const buildCanonicalPayload = (input: {
  readonly kind: TransactionKind;
  readonly occurredOn: string;
  readonly competence: string;
  readonly description: string;
  readonly amount: MoneyAmount;
  readonly categoryId: string;
  readonly subcategoryId?: string;
  readonly paymentContext: PaymentContext;
  readonly installmentPlan: InstallmentPlan;
}): CanonicalTransactionPayload => {
  const payload: CanonicalTransactionPayload = {
    kind: input.kind,
    occurredOn: input.occurredOn,
    competence: input.competence,
    description: input.description,
    amount: input.amount,
    categoryId: input.categoryId,
    paymentContext: input.paymentContext,
    installmentPlan: input.installmentPlan,
  };

  if (input.subcategoryId !== undefined) {
    return { ...payload, subcategoryId: input.subcategoryId };
  }

  return payload;
};

export const transactionPayloadsAreEqual = (
  left: CanonicalTransactionPayload,
  right: CanonicalTransactionPayload,
): boolean => {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.occurredOn !== right.occurredOn) {
    return false;
  }

  if (left.competence !== right.competence) {
    return false;
  }

  if (left.description !== right.description) {
    return false;
  }

  if (!moneyAmountsAreEqual(left.amount, right.amount)) {
    return false;
  }

  if (left.categoryId !== right.categoryId) {
    return false;
  }

  if (left.subcategoryId !== right.subcategoryId) {
    return false;
  }

  if (!paymentContextsAreEqual(left.paymentContext, right.paymentContext)) {
    return false;
  }

  if (!installmentPlansAreEqual(left.installmentPlan, right.installmentPlan)) {
    return false;
  }

  return true;
};
