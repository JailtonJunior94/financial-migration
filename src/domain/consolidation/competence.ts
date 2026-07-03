import { DomainError } from "../common/errors.ts";
import { type Result, failure, success } from "../common/result.ts";

const ISO_DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}/;

export const deriveCompetence = (
  isoDate: string,
): Result<string, DomainError> => {
  const value = isoDate.trim();

  if (value.length === 0) {
    return failure(
      new DomainError(
        "INVALID_OCCURRENCE_DATE",
        "Data de ocorrência não pode ser vazia para derivar competência.",
      ),
    );
  }

  const match = ISO_DATE_PREFIX_PATTERN.exec(value);
  if (!match) {
    return failure(
      new DomainError(
        "INVALID_OCCURRENCE_DATE",
        `Data '${value}' não possui prefixo ISO válível para competência.`,
        { value },
      ),
    );
  }

  const [year, month] = match[0].split("-");
  return success(`${year}-${month}`);
};
