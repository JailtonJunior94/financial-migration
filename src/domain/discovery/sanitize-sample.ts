import type { LegacyDatabase, SanitizedSample } from "./types.ts";

const SENSITIVE_NAME_PATTERNS = [
  /password/i,
  /senha/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /cvv|cvc|security[_-]?code/i,
  /private[_-]?key/i,
];

const CARD_NUMBER_NAME_PATTERNS = [
  /card[_-]?number/i,
  /numero[_-]?cartao/i,
  /card[_-]?pan/i,
  /pan/i,
  /card[_-]?digits/i,
];

const isSensitiveColumnName = (columnName: string): boolean =>
  SENSITIVE_NAME_PATTERNS.some((pattern) => pattern.test(columnName));

const isCardNumberColumnName = (columnName: string): boolean =>
  CARD_NUMBER_NAME_PATTERNS.some((pattern) => pattern.test(columnName));

const MAX_STRING_LENGTH = 200;

const truncateString = (value: string): string => {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_LENGTH)}…`;
};

const maskCardNumber = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) {
    return "[REDACTED]";
  }
  return `****${digits.slice(-4)}`;
};

const sanitizeValue = (columnName: string, value: unknown): unknown => {
  if (value === null || value === undefined) {
    return null;
  }

  if (isSensitiveColumnName(columnName)) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    if (isCardNumberColumnName(columnName)) {
      return maskCardNumber(value);
    }
    return truncateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Uint8Array || ArrayBuffer.isView(value)) {
    return `[BINARY:${(value as Uint8Array).byteLength}]`;
  }

  return "[UNSUPPORTED]";
};

export const sanitizeSample = (
  database: LegacyDatabase,
  tableName: string,
  primaryKey: string,
  fields: Record<string, unknown>,
): SanitizedSample => ({
  database,
  tableName,
  primaryKey,
  fields: Object.fromEntries(
    Object.entries(fields).map(([columnName, value]) => [
      columnName,
      sanitizeValue(columnName, value),
    ]),
  ),
});
