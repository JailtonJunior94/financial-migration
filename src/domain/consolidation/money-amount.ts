import { DomainError } from "../common/errors.ts";
import { type Result, failure, success } from "../common/result.ts";

export type MoneyAmount = {
  readonly minorUnits: bigint;
  readonly scale: number;
  readonly currency: string;
};

const ISO_4217_PATTERN = /^[A-Z]{3}$/;
const MAX_SCALE = 18;

const halfEvenRound = (value: bigint, scale: number): bigint => {
  if (scale <= 0) {
    return value;
  }

  const divisor = 10n ** BigInt(scale);
  const halfDivisor = divisor / 2n;
  const remainder = value % divisor;
  const truncated = value / divisor;

  if (remainder < 0) {
    const absRemainder = -remainder;
    if (absRemainder > halfDivisor) {
      return truncated - 1n;
    }
    if (absRemainder < halfDivisor) {
      return truncated;
    }
    return truncated % 2n === 0n ? truncated : truncated - 1n;
  }

  if (remainder > halfDivisor) {
    return truncated + 1n;
  }
  if (remainder < halfDivisor) {
    return truncated;
  }
  return truncated % 2n === 0n ? truncated : truncated + 1n;
};

export const createMoneyAmount = (
  minorUnits: bigint,
  scale: number,
  currency: string,
): Result<MoneyAmount, DomainError> => {
  if (!Number.isInteger(scale) || scale < 0 || scale > MAX_SCALE) {
    return failure(
      new DomainError(
        "INVALID_MONEY_AMOUNT",
        "Escala monetária deve ser um inteiro entre 0 e 18.",
        { scale },
      ),
    );
  }

  const normalizedCurrency = currency.trim().toUpperCase();
  if (!ISO_4217_PATTERN.test(normalizedCurrency)) {
    return failure(
      new DomainError(
        "INVALID_MONEY_AMOUNT",
        "Moeda deve seguir o formato ISO 4217 de três letras.",
        { currency },
      ),
    );
  }

  return success({
    minorUnits,
    scale,
    currency: normalizedCurrency,
  });
};

export const normalizeMoneyAmount = (
  amount: MoneyAmount,
  targetScale: number,
): Result<MoneyAmount, DomainError> => {
  if (
    !Number.isInteger(targetScale) ||
    targetScale < 0 ||
    targetScale > MAX_SCALE
  ) {
    return failure(
      new DomainError(
        "INVALID_MONEY_AMOUNT",
        "Escala alvo deve ser um inteiro entre 0 e 18.",
        { targetScale },
      ),
    );
  }

  if (targetScale === amount.scale) {
    return success(amount);
  }

  if (targetScale > amount.scale) {
    const factor = 10n ** BigInt(targetScale - amount.scale);
    return success({
      minorUnits: amount.minorUnits * factor,
      scale: targetScale,
      currency: amount.currency,
    });
  }

  const scaleDown = amount.scale - targetScale;
  const roundedMinorUnits = halfEvenRound(amount.minorUnits, scaleDown);

  return success({
    minorUnits: roundedMinorUnits,
    scale: targetScale,
    currency: amount.currency,
  });
};

export const moneyAmountsAreEqual = (
  left: MoneyAmount,
  right: MoneyAmount,
): boolean => {
  if (left.currency !== right.currency) {
    return false;
  }

  const normalizedLeft = normalizeMoneyAmount(
    left,
    Math.max(left.scale, right.scale),
  );
  const normalizedRight = normalizeMoneyAmount(
    right,
    Math.max(left.scale, right.scale),
  );

  if (!normalizedLeft.ok || !normalizedRight.ok) {
    return false;
  }

  return normalizedLeft.value.minorUnits === normalizedRight.value.minorUnits;
};

export const formatMoneyAmount = (amount: MoneyAmount): string => {
  const sign = amount.minorUnits < 0n ? "-" : "";
  const absMinorUnits =
    amount.minorUnits < 0n ? -amount.minorUnits : amount.minorUnits;
  const divisor = 10n ** BigInt(amount.scale);
  const integerPart = absMinorUnits / divisor;
  const fractionalPart = absMinorUnits % divisor;
  const paddedFraction = fractionalPart.toString().padStart(amount.scale, "0");

  if (amount.scale === 0) {
    return `${sign}${integerPart} ${amount.currency}`;
  }

  return `${sign}${integerPart}.${paddedFraction} ${amount.currency}`;
};
