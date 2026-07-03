import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { FileReviewArtifactStore } from "../../src/adapters/checkpoint/file-review-artifact-store.ts";
import type { ReviewableIssue } from "../../src/domain/consolidation/types.ts";

const directoryPath = "./tmp/test-review-artifacts";

afterEach(async () => {
  await rm(directoryPath, { recursive: true, force: true });
});

const makeIssue = (id: string): ReviewableIssue => ({
  issueId: id,
  kind: "unknown-payment-method",
  severity: "blocking",
  legacyRefs: [
    {
      database: "FinancialControlDB",
      table: "TransactionItem",
      primaryKey: "1",
    },
  ],
  reason: "Método de pagamento não pôde ser provado.",
  evidence: { description: "Transferência" },
  blockedAt: "2026-01-01T00:00:00.000Z",
});

describe("FileReviewArtifactStore", () => {
  test("appends issues as sanitized NDJSON", async () => {
    const store = new FileReviewArtifactStore(directoryPath);
    await store.append("consolidation", makeIssue("issue-1"));
    await store.append("consolidation", makeIssue("issue-2"));

    const issues = await store.read("consolidation");
    expect(issues).toHaveLength(2);
    expect(issues[0]?.issueId).toBe("issue-1");
    expect(issues[1]?.issueId).toBe("issue-2");
  });

  test("redacts sensitive evidence fields", async () => {
    const store = new FileReviewArtifactStore(directoryPath);
    const issue: ReviewableIssue = {
      ...makeIssue("issue-secret"),
      evidence: {
        cardNumber: "1234567890123456",
        token: "super-secret",
        description: "ok",
      },
    };

    await store.append("consolidation", issue);
    const issues = await store.read("consolidation");
    const loaded = issues[0];
    expect(loaded?.evidence.cardNumber).toBe("[REDACTED]");
    expect(loaded?.evidence.token).toBe("[REDACTED]");
    expect(loaded?.evidence.description).toBe("ok");
  });

  test("lists scopes", async () => {
    const store = new FileReviewArtifactStore(directoryPath);
    await store.append("scope-a", makeIssue("a-1"));
    await store.append("scope-b", makeIssue("b-1"));

    const scopes = await store.listScopes();
    expect(scopes).toContain("scope-a");
    expect(scopes).toContain("scope-b");
  });

  test("returns empty array for missing scope", async () => {
    const store = new FileReviewArtifactStore(directoryPath);
    const issues = await store.read("missing");
    expect(issues).toHaveLength(0);
  });

  test("resets a specific scope", async () => {
    const store = new FileReviewArtifactStore(directoryPath);
    await store.append("scope-a", makeIssue("a-1"));
    await store.reset("scope-a");
    const issues = await store.read("scope-a");
    expect(issues).toHaveLength(0);
  });

  test("resets all scopes", async () => {
    const store = new FileReviewArtifactStore(directoryPath);
    await store.append("scope-a", makeIssue("a-1"));
    await store.append("scope-b", makeIssue("b-1"));
    await store.reset();

    const scopes = await store.listScopes();
    expect(scopes).toHaveLength(0);
  });
});
