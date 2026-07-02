import { describe, expect, mock, test } from "bun:test";
import type { CheckpointPort } from "../../src/application/ports/checkpoint-port.ts";
import type { ClockPort } from "../../src/application/ports/clock-port.ts";
import type { LoggerPort } from "../../src/application/ports/logger-port.ts";
import type { SourceRecordReaderPort } from "../../src/application/ports/source-record-reader-port.ts";
import type { TargetPostPort } from "../../src/application/ports/target-post-port.ts";
import { SyncPilotEntityUseCase } from "../../src/application/use-cases/sync-pilot-entity.ts";
import { buildFingerprint } from "../../src/domain/sync/build-fingerprint.ts";

describe("SyncPilotEntityUseCase", () => {
  test("skips already fingerprinted records", async () => {
    const fingerprint = buildFingerprint({
      source: "source-a",
      entity: "dbo.Customer",
      externalId: "1",
      capturedAt: "2026-01-01T00:00:00.000Z",
      payload: { id: 1, externalId: "1", name: "Alice" },
    });

    const reader: SourceRecordReaderPort = {
      read: async () => ({
        records: [
          {
            source: "source-a",
            entity: "dbo.Customer",
            primaryKey: "1",
            capturedAt: "2026-01-01T00:00:00.000Z",
            fields: { id: 1, externalId: "1", name: "Alice" },
          },
        ],
        nextCursor: undefined,
      }),
    };

    const targetPost = mock(async () => ({
      remoteId: "remote-1",
      status: "accepted" as const,
    }));
    const target: TargetPostPort = { post: targetPost };

    const writes: unknown[] = [];
    const checkpoint: CheckpointPort = {
      read: async () => ({
        processedKeys: {
          [fingerprint.key]: fingerprint.hash,
        },
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      write: async (_scope, value) => {
        writes.push(value);
      },
      list: async () => ({}),
      reset: async () => {},
    };

    const clock: ClockPort = { nowIso: () => "2026-01-01T00:00:00.000Z" };
    const logger: LoggerPort = {
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    const useCase = new SyncPilotEntityUseCase({
      reader,
      target,
      checkpoint,
      clock,
      logger,
    });
    const result = await useCase.execute(
      {
        source: "source-a",
        schemaName: "dbo",
        tableName: "Customer",
        score: 99,
        reasons: [],
        selectedAt: "2026-01-01T00:00:00.000Z",
      },
      false,
    );

    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(targetPost).not.toHaveBeenCalled();
    expect(writes.length).toBe(1);
  });
});
