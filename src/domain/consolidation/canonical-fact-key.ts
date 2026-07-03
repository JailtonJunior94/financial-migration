import { createHash } from "node:crypto";
import { DomainError } from "../common/errors.ts";
import { type Result, failure, success } from "../common/result.ts";
import type { MoneyAmount } from "./money-amount.ts";

export type PaymentContext =
  | { readonly kind: "credit-card"; readonly cardBusinessKey: string }
  | { readonly kind: "debit-card"; readonly cardBusinessKey: string }
  | { readonly kind: "bank-transfer"; readonly method: "pix" | "ted" | "other" }
  | { readonly kind: "cash" }
  | { readonly kind: "unknown" };

export type InstallmentContext =
  | { readonly kind: "single" }
  | {
      readonly kind: "installment";
      readonly groupKey: string;
      readonly current: number;
      readonly total: number;
    };

export type CanonicalFactKey = {
  readonly resource: "transaction" | "card";
  readonly userId: string;
  readonly occurredOn: string;
  readonly normalizedDescription: string;
  readonly normalizedAmountMinorUnits: bigint;
  readonly currency: string;
  readonly paymentContext: PaymentContext;
  readonly installmentContext: InstallmentContext;
};

const normalizeDescription = (description: string): string =>
  description
    .normalize("NFD")
    .replace(/\p{Mn}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const validateUuid = (value: string): boolean => {
  const pattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return pattern.test(value);
};

export const createCanonicalFactKey = (
  resource: "transaction" | "card",
  userId: string,
  occurredOn: string,
  description: string,
  amount: MoneyAmount,
  paymentContext: PaymentContext,
  installmentContext: InstallmentContext,
): Result<CanonicalFactKey, DomainError> => {
  const normalizedUserId = userId.trim().toLowerCase();
  if (!validateUuid(normalizedUserId)) {
    return failure(
      new DomainError(
        "INVALID_CANONICAL_FACT_KEY",
        "userId deve ser um UUID válido.",
        { userId },
      ),
    );
  }

  const normalizedDescription = normalizeDescription(description);
  if (normalizedDescription.length === 0) {
    return failure(
      new DomainError(
        "INVALID_CANONICAL_FACT_KEY",
        "Descrição normalizada não pode ficar vazia.",
        { description },
      ),
    );
  }

  if (amount.currency.length === 0) {
    return failure(
      new DomainError(
        "INVALID_CANONICAL_FACT_KEY",
        "Moeda do valor deve ser informada.",
      ),
    );
  }

  return success({
    resource,
    userId: normalizedUserId,
    occurredOn: occurredOn.trim(),
    normalizedDescription,
    normalizedAmountMinorUnits: amount.minorUnits,
    currency: amount.currency,
    paymentContext,
    installmentContext,
  });
};

export const canonicalFactKeyToString = (key: CanonicalFactKey): string =>
  JSON.stringify({
    resource: key.resource,
    userId: key.userId,
    occurredOn: key.occurredOn,
    normalizedDescription: key.normalizedDescription,
    normalizedAmountMinorUnits: key.normalizedAmountMinorUnits.toString(),
    currency: key.currency,
    paymentContext: key.paymentContext,
    installmentContext: key.installmentContext,
  });

export const canonicalFactKeyHash = (key: CanonicalFactKey): string =>
  createHash("sha256").update(canonicalFactKeyToString(key)).digest("hex");
