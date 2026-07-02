import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { FileCheckpointStore } from "../../src/adapters/checkpoint/file-checkpoint-store.ts";

const filePath = "./tmp/test-checkpoints.json";

afterEach(async () => {
  await rm(filePath, { force: true });
});

describe("FileCheckpointStore", () => {
  test("persists and loads checkpoints", async () => {
    const store = new FileCheckpointStore(filePath);
    await store.write("scope-1", {
      processedKeys: { "a:b:1": "hash" },
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const loaded = await store.read("scope-1");
    expect(loaded?.processedKeys["a:b:1"]).toBe("hash");
  });
});
