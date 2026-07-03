export type DomainErrorCode =
  | "INVALID_CONFIG"
  | "INVALID_SOURCE_RECORD"
  | "INVALID_ENTITY_SELECTION"
  | "INVALID_PAYLOAD"
  | "CHECKPOINT_FAILURE"
  | "INTEGRATION_FAILURE"
  | "INVALID_MONEY_AMOUNT"
  | "INVALID_OCCURRENCE_DATE"
  | "INVALID_CANONICAL_FACT_KEY"
  | "INVALID_INSTALLMENT_PLAN"
  | "USER_NOT_ELIGIBLE"
  | "RECONCILIATION_CONFLICT"
  | "MISSING_TAXONOMY"
  | "UNKNOWN_PAYMENT_METHOD"
  | "SOURCE_READ_FAILURE";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: DomainErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message, { cause: details });
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export class ApplicationError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: DomainErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message, { cause: details });
    this.name = "ApplicationError";
    this.code = code;
    this.details = details;
  }
}
