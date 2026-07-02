import type { PilotEntitySelection } from "../../domain/schema/types.ts";
import { buildFingerprint } from "../../domain/sync/build-fingerprint.ts";
import { mapSourceRecordToPilotAggregate } from "../../domain/sync/map-source-record.ts";
import type { CheckpointRecord, SyncCursor } from "../../domain/sync/types.ts";
import type { CheckpointPort } from "../ports/checkpoint-port.ts";
import type { ClockPort } from "../ports/clock-port.ts";
import type { LoggerPort } from "../ports/logger-port.ts";
import type { SourceRecordReaderPort } from "../ports/source-record-reader-port.ts";
import type { TargetPostPort } from "../ports/target-post-port.ts";

type SyncPilotEntityDependencies = {
  reader: SourceRecordReaderPort;
  target: TargetPostPort;
  checkpoint: CheckpointPort;
  clock: ClockPort;
  logger: LoggerPort;
};

export class SyncPilotEntityUseCase {
  constructor(private readonly dependencies: SyncPilotEntityDependencies) {}

  async execute(
    selection: PilotEntitySelection,
    dryRun: boolean,
  ): Promise<{
    processed: number;
    skipped: number;
    lastCursor?: SyncCursor;
  }> {
    const scope = `${selection.source}:${selection.schemaName}.${selection.tableName}`;
    const existingCheckpoint = await this.dependencies.checkpoint.read(scope);

    let processed = 0;
    let skipped = 0;
    let cursor = existingCheckpoint?.cursor;
    let processedKeys = existingCheckpoint?.processedKeys ?? {};

    while (true) {
      const batch = await this.dependencies.reader.read(selection, cursor);
      if (batch.records.length === 0) {
        break;
      }

      for (const record of batch.records) {
        const mapped = mapSourceRecordToPilotAggregate(record);
        if (!mapped.ok) {
          throw mapped.error;
        }

        const fingerprint = buildFingerprint(mapped.value);
        if (processedKeys[fingerprint.key] === fingerprint.hash) {
          skipped += 1;
          continue;
        }

        if (!dryRun) {
          await this.dependencies.target.post(mapped.value, fingerprint);
        }

        processedKeys = {
          ...processedKeys,
          [fingerprint.key]: fingerprint.hash,
        };
        processed += 1;
      }

      cursor = batch.nextCursor;
      const checkpointRecord: CheckpointRecord = {
        processedKeys,
        updatedAt: this.dependencies.clock.nowIso(),
      };
      if (cursor) {
        checkpointRecord.cursor = cursor;
      }
      await this.dependencies.checkpoint.write(scope, checkpointRecord);

      if (!batch.nextCursor) {
        break;
      }
    }

    this.dependencies.logger.info("Pilot sync finished.", {
      scope,
      dryRun,
      processed,
      skipped,
      cursor,
    });

    return cursor
      ? { processed, skipped, lastCursor: cursor }
      : { processed, skipped };
  }
}
