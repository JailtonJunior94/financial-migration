import { describe, expect, test } from "bun:test";
import { buildFingerprint } from "../../src/domain/sync/build-fingerprint.ts";

describe("buildFingerprint", () => {
  test("returns a stable key and hash", () => {
    const fingerprint = buildFingerprint({
      source: "source-a",
      entity: "dbo.Customer",
      externalId: "42",
      capturedAt: "2026-01-01T00:00:00.000Z",
      payload: { id: 42, name: "Alice" },
    });

    expect(fingerprint.key).toBe("source-a:dbo.Customer:42");
    expect(fingerprint.hash.length).toBe(64);
  });
});
