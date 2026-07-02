import { createHash } from "node:crypto";
import type { IdempotencyFingerprint, PilotAggregate } from "./types.ts";

export const buildFingerprint = (
  aggregate: PilotAggregate,
): IdempotencyFingerprint => {
  const canonicalPayload = JSON.stringify({
    source: aggregate.source,
    entity: aggregate.entity,
    externalId: aggregate.externalId,
    payload: aggregate.payload,
  });

  return {
    key: `${aggregate.source}:${aggregate.entity}:${aggregate.externalId}`,
    hash: createHash("sha256").update(canonicalPayload).digest("hex"),
  };
};
