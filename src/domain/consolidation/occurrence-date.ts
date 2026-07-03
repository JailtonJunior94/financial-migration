import { DomainError } from "../common/errors.ts";
import { type Result, failure, success } from "../common/result.ts";

export type OccurrenceDate = {
  readonly value: string;
  readonly sourceField: string;
  readonly fallbackUsed: boolean;
};

const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z?)?$/;

const isValidDate = (isoValue: string): boolean => {
  if (!ISO_DATE_PATTERN.test(isoValue)) {
    return false;
  }

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const [datePart] = isoValue.split("T");
  if (!datePart) {
    return false;
  }

  const parts = datePart.split("-");
  if (parts.length !== 3) {
    return false;
  }

  const [yearString, monthString, dayString] = parts;
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

export const createOccurrenceDate = (
  rawValue: string,
  sourceField: string,
  fallbackUsed = false,
): Result<OccurrenceDate, DomainError> => {
  const value = rawValue.trim();

  if (value.length === 0) {
    return failure(
      new DomainError(
        "INVALID_OCCURRENCE_DATE",
        "Data de ocorrência não pode ser vazia.",
        { sourceField },
      ),
    );
  }

  if (!isValidDate(value)) {
    return failure(
      new DomainError(
        "INVALID_OCCURRENCE_DATE",
        `Data de ocorrência '${value}' não é uma data ISO válida.`,
        { sourceField, value },
      ),
    );
  }

  const field = sourceField.trim();
  if (field.length === 0) {
    return failure(
      new DomainError(
        "INVALID_OCCURRENCE_DATE",
        "Campo de origem da data deve ser informado.",
      ),
    );
  }

  return success({
    value,
    sourceField: field,
    fallbackUsed,
  });
};

export const createOccurrenceDateFromFact = (
  factDate: string | undefined,
  factField: string,
  createdAt: string | undefined,
): Result<OccurrenceDate, DomainError> => {
  if (factDate && factDate.trim().length > 0) {
    return createOccurrenceDate(factDate.trim(), factField, false);
  }

  if (createdAt && createdAt.trim().length > 0) {
    return createOccurrenceDate(createdAt.trim(), "CreatedAt", true);
  }

  return failure(
    new DomainError(
      "INVALID_OCCURRENCE_DATE",
      "Nenhuma data de fato ou de cadastro disponível para ocorrência.",
      { factField },
    ),
  );
};
