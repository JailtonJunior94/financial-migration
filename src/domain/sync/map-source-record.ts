import { DomainError } from "../common/errors.ts";
import { type Result, failure, success } from "../common/result.ts";
import type { PilotAggregate, SourceRecord } from "./types.ts";

const ensureString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

export const mapSourceRecordToPilotAggregate = (
  record: SourceRecord,
): Result<PilotAggregate, DomainError> => {
  const externalId =
    ensureString(record.fields.externalId) ?? record.primaryKey;

  if (!externalId) {
    return failure(
      new DomainError(
        "INVALID_SOURCE_RECORD",
        "Source record is missing a stable externalId.",
        {
          entity: record.entity,
        },
      ),
    );
  }

  return success({
    source: record.source,
    entity: record.entity,
    externalId,
    capturedAt: record.capturedAt,
    payload: record.fields,
  });
};
