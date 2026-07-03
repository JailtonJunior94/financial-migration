import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { buildTransactionIdempotencyKey } from "../../../src/domain/publication/transaction-idempotency.ts";

const targetUserId = "06edc407-4f63-42e8-b07c-946b9ef0a19c";

const expectedKey = (userId: string, factKeyHash: string): string =>
  createHash("sha256")
    .update(`${userId.toLowerCase()}:${factKeyHash}:transaction`)
    .digest("hex");

describe("buildTransactionIdempotencyKey", () => {
  test("produz chave determinística a partir de usuário e fact key hash", () => {
    const factKeyHash = "abc123";
    const key = buildTransactionIdempotencyKey(targetUserId, factKeyHash);

    expect(key).toBe(expectedKey(targetUserId, factKeyHash));
  });

  test("normaliza userId para minúsculas e trim", () => {
    const factKeyHash = "abc123";
    const lowerKey = buildTransactionIdempotencyKey(
      targetUserId.toLowerCase(),
      factKeyHash,
    );
    const upperKey = buildTransactionIdempotencyKey(
      targetUserId.toUpperCase(),
      factKeyHash,
    );
    const spacedKey = buildTransactionIdempotencyKey(
      `  ${targetUserId}  `,
      factKeyHash,
    );

    expect(lowerKey).toBe(upperKey);
    expect(lowerKey).toBe(spacedKey);
  });
});
