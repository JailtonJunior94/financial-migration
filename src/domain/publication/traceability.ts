import type { ClassifiedTransaction } from "../classification/types.ts";
import { canonicalFactKeyHash } from "../consolidation/canonical-fact-key.ts";
import type { CanonicalFactKey } from "../consolidation/canonical-fact-key.ts";
import type {
  LegacySourceRef,
  ReviewableIssue,
  ReviewableIssueKind,
} from "../consolidation/types.ts";
import type { RemoteCardBinding, RemoteTransactionRecord } from "./types.ts";

export type TraceabilityRow = {
  readonly sourceRef: LegacySourceRef;
  readonly factKeyHash?: string | undefined;
  readonly consolidationStatus: "included" | "excluded";
  readonly classificationStatus?: "classified" | "blocked" | undefined;
  readonly destinationResource?: "transaction" | "card" | undefined;
  readonly remoteId?: string | undefined;
  readonly categoryId?: string | undefined;
  readonly subcategoryId?: string | undefined;
  readonly issueId?: string | undefined;
  readonly issueKind?: ReviewableIssueKind | undefined;
  readonly blockedAt?: string | undefined;
};

export type TraceabilityMatrix = {
  readonly generatedAt: string;
  readonly eligibilityStatus?: string | undefined;
  readonly targetUserId?: string | undefined;
  readonly rows: readonly TraceabilityRow[];
};

export type BuildTraceabilityMatrixInput = {
  readonly eligibilityStatus?: string | undefined;
  readonly targetUserId?: string | undefined;
  readonly sourceRefs: readonly LegacySourceRef[];
  readonly transactions: ReadonlyArray<{
    readonly factKey: CanonicalFactKey;
    readonly legacyRefs: readonly LegacySourceRef[];
  }>;
  readonly classified: readonly ClassifiedTransaction[];
  readonly issues: readonly ReviewableIssue[];
  readonly cardBindings?: readonly RemoteCardBinding[] | undefined;
  readonly publishedTransactions?:
    | readonly RemoteTransactionRecord[]
    | undefined;
};

const refsAreEqual = (a: LegacySourceRef, b: LegacySourceRef): boolean =>
  a.database === b.database &&
  a.table === b.table &&
  a.primaryKey === b.primaryKey;

const issueAppliesToRef = (
  issue: ReviewableIssue,
  ref: LegacySourceRef,
): boolean => issue.legacyRefs.some((issueRef) => refsAreEqual(issueRef, ref));

export const buildTraceabilityMatrix = (
  input: BuildTraceabilityMatrixInput,
): TraceabilityMatrix => {
  const factKeyHashes = new Map<CanonicalFactKey, string>();

  const hashOf = (factKey: CanonicalFactKey): string => {
    const cached = factKeyHashes.get(factKey);
    if (cached) {
      return cached;
    }
    const hash = canonicalFactKeyHash(factKey);
    factKeyHashes.set(factKey, hash);
    return hash;
  };

  const classificationByHash = new Map<string, ClassifiedTransaction>();
  for (const item of input.classified) {
    classificationByHash.set(hashOf(item.transaction.factKey), item);
  }

  const issuesByRef = new Map<string, ReviewableIssue[]>();
  const issuesByHash = new Map<string, ReviewableIssue[]>();
  for (const issue of input.issues) {
    if (issue.factKey) {
      const hash = hashOf(issue.factKey);
      const list = issuesByHash.get(hash) ?? [];
      list.push(issue);
      issuesByHash.set(hash, list);
    }
    for (const ref of issue.legacyRefs) {
      const key = `${ref.database}:${ref.table}:${ref.primaryKey}`;
      const list = issuesByRef.get(key) ?? [];
      list.push(issue);
      issuesByRef.set(key, list);
    }
  }

  const publishedByHash = new Map<string, RemoteTransactionRecord>();
  for (const record of input.publishedTransactions ?? []) {
    publishedByHash.set(record.factKeyHash, record);
  }

  const bindingsByRef = new Map<string, RemoteCardBinding>();
  for (const binding of input.cardBindings ?? []) {
    const key = `${binding.legacyRef.database}:${binding.legacyRef.table}:${binding.legacyRef.primaryKey}`;
    bindingsByRef.set(key, binding);
  }

  const sourceToTransaction = new Map<
    string,
    { hash: string; factKey: CanonicalFactKey }
  >();

  for (const transaction of input.transactions) {
    const hash = hashOf(transaction.factKey);
    for (const ref of transaction.legacyRefs) {
      const key = `${ref.database}:${ref.table}:${ref.primaryKey}`;
      sourceToTransaction.set(key, { hash, factKey: transaction.factKey });
    }
  }

  const rows: TraceabilityRow[] = [];

  for (const sourceRef of input.sourceRefs) {
    const key = `${sourceRef.database}:${sourceRef.table}:${sourceRef.primaryKey}`;
    const transaction = sourceToTransaction.get(key);
    const binding = bindingsByRef.get(key);
    const refIssues = issuesByRef.get(key) ?? [];

    if (transaction) {
      const classified = classificationByHash.get(transaction.hash);
      const hashIssues = issuesByHash.get(transaction.hash) ?? [];
      const allIssues = [...refIssues, ...hashIssues];
      const blockingIssue =
        allIssues.find((issue) => issue.severity === "blocking") ??
        allIssues[0];
      const published = publishedByHash.get(transaction.hash);

      rows.push({
        sourceRef,
        factKeyHash: transaction.hash,
        consolidationStatus: "included",
        classificationStatus: blockingIssue
          ? "blocked"
          : classified
            ? "classified"
            : undefined,
        destinationResource: binding ? "card" : "transaction",
        remoteId: binding?.remoteId ?? published?.remoteId,
        categoryId: classified?.categoryId,
        subcategoryId: classified?.subcategoryId,
        issueId: blockingIssue?.issueId,
        issueKind: blockingIssue?.kind,
        blockedAt: blockingIssue?.blockedAt,
      });
    } else {
      const blockingIssue =
        refIssues.find((issue) => issue.severity === "blocking") ??
        refIssues[0];
      rows.push({
        sourceRef,
        consolidationStatus: "excluded",
        issueId: blockingIssue?.issueId,
        issueKind: blockingIssue?.kind,
        blockedAt: blockingIssue?.blockedAt,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    eligibilityStatus: input.eligibilityStatus,
    targetUserId: input.targetUserId,
    rows,
  };
};
