import { DomainError } from "../common/errors.ts";
import { type Result, failure, success } from "../common/result.ts";
import { type MoneyAmount, createMoneyAmount } from "./money-amount.ts";

const isNumeric = (value: unknown): value is number | string | bigint =>
  typeof value === "number" ||
  typeof value === "bigint" ||
  (typeof value === "string" &&
    value.trim().length > 0 &&
    !Number.isNaN(Number(value)));

const halfEvenRound = (value: number): bigint => {
  const floor = Math.floor(value);
  const remainder = value - floor;

  if (remainder < 0.5) {
    return BigInt(floor);
  }

  if (remainder > 0.5) {
    return BigInt(Math.ceil(value));
  }

  return BigInt(floor % 2 === 0 ? floor : floor + 1);
};

const numberToMinorUnits = (value: number, scale: number): bigint => {
  const sign = value < 0 ? -1n : 1n;
  const absValue = Math.abs(value);
  const factor = 10 ** scale;
  const scaled = absValue * factor;
  return halfEvenRound(scaled) * sign;
};

export const normalizeAmount = (
  value: unknown,
  currency: string,
  scale = 2,
): Result<MoneyAmount, DomainError> => {
  if (!isNumeric(value)) {
    return failure(
      new DomainError(
        "INVALID_MONEY_AMOUNT",
        "Valor monetário deve ser numérico.",
        { value },
      ),
    );
  }

  if (typeof value === "bigint") {
    return createMoneyAmount(value, scale, currency);
  }

  const numeric = typeof value === "number" ? value : Number(value);
  const minorUnits = numberToMinorUnits(numeric, scale);

  return createMoneyAmount(minorUnits, scale, currency);
};
