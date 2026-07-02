export type DomainErrorCode =
  | "INVALID_CONFIG"
  | "INVALID_SOURCE_RECORD"
  | "INVALID_ENTITY_SELECTION"
  | "INVALID_PAYLOAD"
  | "CHECKPOINT_FAILURE"
  | "INTEGRATION_FAILURE";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: DomainErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}
