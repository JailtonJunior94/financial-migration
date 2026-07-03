import { createHash } from "node:crypto";

export const buildTransactionIdempotencyKey = (
  userId: string,
  factKeyHash: string,
): string =>
  createHash("sha256")
    .update(`${userId.trim().toLowerCase()}:${factKeyHash}:transaction`)
    .digest("hex");
