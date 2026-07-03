import { createHash } from "node:crypto";
import type { CanonicalFactKey } from "./canonical-fact-key.ts";
import type {
  LegacySourceRef,
  ReviewableIssue,
  ReviewableIssueKind,
} from "./types.ts";

const issueDigest = (parts: Record<string, unknown>): string =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);

const factKeyToComparable = (
  factKey: CanonicalFactKey,
): Record<string, unknown> => ({
  resource: factKey.resource,
  userId: factKey.userId,
  occurredOn: factKey.occurredOn,
  normalizedDescription: factKey.normalizedDescription,
  normalizedAmountMinorUnits: factKey.normalizedAmountMinorUnits.toString(),
  currency: factKey.currency,
  paymentContext: factKey.paymentContext,
  installmentContext: factKey.installmentContext,
});

export const createReviewableIssue = (params: {
  kind: ReviewableIssueKind;
  reason: string;
  factKey?: CanonicalFactKey;
  legacyRefs: readonly LegacySourceRef[];
  evidence?: Record<string, unknown>;
  severity?: ReviewableIssue["severity"];
}): ReviewableIssue => {
  const { kind, reason, factKey, legacyRefs, evidence, severity } = params;
  const blockedAt = new Date().toISOString();

  const resolvedSeverity =
    severity ??
    (kind === "unknown-payment-method" || kind === "missing-income-taxonomy"
      ? ("blocking" as const)
      : ("warning" as const));

  const base = {
    issueId: issueDigest({
      kind,
      reason,
      factKey: factKey ? factKeyToComparable(factKey) : undefined,
      legacyRefs,
      blockedAt,
    }),
    kind,
    severity: resolvedSeverity,
    legacyRefs,
    reason,
    evidence: evidence ?? {},
    blockedAt,
  };

  if (factKey) {
    return { ...base, factKey };
  }

  return base;
};
