import type { CheckpointRecord } from "../../domain/sync/types.ts";

export interface CheckpointPort {
  read(scope: string): Promise<CheckpointRecord | undefined>;
  write(scope: string, value: CheckpointRecord): Promise<void>;
  list(): Promise<Record<string, CheckpointRecord>>;
  reset(scope?: string): Promise<void>;
}
