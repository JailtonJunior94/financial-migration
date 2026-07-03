import { createHash } from "node:crypto";

export const buildCardIdempotencyKey = (
  userId: string,
  businessKey: string,
): string =>
  createHash("sha256")
    .update(`${userId.trim().toLowerCase()}:${businessKey}:card`)
    .digest("hex");
