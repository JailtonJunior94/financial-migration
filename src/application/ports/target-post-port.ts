import type {
  IdempotencyFingerprint,
  PilotAggregate,
} from "../../domain/sync/types.ts";

export type TargetPostResult = {
  remoteId: string;
  status: "accepted" | "duplicate";
};

export interface TargetPostPort {
  post(
    aggregate: PilotAggregate,
    fingerprint: IdempotencyFingerprint,
  ): Promise<TargetPostResult>;
}
