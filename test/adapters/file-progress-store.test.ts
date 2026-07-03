import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { FileProgressStore } from "../../src/adapters/checkpoint/file-progress-store.ts";

const filePath = "./tmp/test-progress.json";

afterEach(async () => {
  await rm(filePath, { force: true });
});

describe("FileProgressStore", () => {
  test("persists and loads progress records", async () => {
    const store = new FileProgressStore(filePath);
    await store.write("scope-1", {
      scope: "scope-1",
      stage: "consolidation",
      processedCount: 10,
      blockedCount: 1,
      reconciledCount: 9,
      publishedCount: 0,
      skippedCount: 0,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const loaded = await store.read("scope-1");
    expect(loaded?.processedCount).toBe(10);
    expect(loaded?.blockedCount).toBe(1);
    expect(loaded?.stage).toBe("consolidation");
  });

  test("lists all progress records", async () => {
    const store = new FileProgressStore(filePath);
    await store.write("scope-1", {
      scope: "scope-1",
      stage: "discovery",
      processedCount: 5,
      blockedCount: 0,
      reconciledCount: 0,
      publishedCount: 0,
      skippedCount: 0,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await store.write("scope-2", {
      scope: "scope-2",
      stage: "classification",
      processedCount: 8,
      blockedCount: 2,
      reconciledCount: 6,
      publishedCount: 0,
      skippedCount: 0,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const list = await store.list();
    expect(Object.keys(list)).toHaveLength(2);
    expect(list["scope-1"]?.stage).toBe("discovery");
    expect(list["scope-2"]?.stage).toBe("classification");
  });

  test("resets a specific scope", async () => {
    const store = new FileProgressStore(filePath);
    await store.write("scope-1", {
      scope: "scope-1",
      stage: "discovery",
      processedCount: 5,
      blockedCount: 0,
      reconciledCount: 0,
      publishedCount: 0,
      skippedCount: 0,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await store.reset("scope-1");
    const loaded = await store.read("scope-1");
    expect(loaded).toBeUndefined();
  });

  test("returns undefined for missing scope", async () => {
    const store = new FileProgressStore(filePath);
    const loaded = await store.read("missing");
    expect(loaded).toBeUndefined();
  });
});
