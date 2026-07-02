import type { SourceSystem } from "../schema/types.ts";

export type SourceRecord = {
  source: SourceSystem;
  entity: string;
  primaryKey: string;
  capturedAt: string;
  fields: Record<string, unknown>;
};

export type PilotAggregate = {
  source: SourceSystem;
  entity: string;
  externalId: string;
  capturedAt: string;
  payload: Record<string, unknown>;
};

export type IdempotencyFingerprint = {
  key: string;
  hash: string;
};

export type SyncCursor = {
  entity: string;
  lastPrimaryKey?: string;
};

export type CheckpointRecord = {
  cursor?: SyncCursor;
  processedKeys: Record<string, string>;
  updatedAt: string;
};
