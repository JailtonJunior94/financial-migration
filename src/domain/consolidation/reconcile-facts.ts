import { canonicalFactKeyHash } from "./canonical-fact-key.ts";
import { createReviewableIssue } from "./reviewable-issue.ts";
import type { ConsolidatedTransaction, ReviewableIssue } from "./types.ts";

const transactionsAreEquivalent = (
  left: ConsolidatedTransaction,
  right: ConsolidatedTransaction,
): boolean =>
  left.kind === right.kind &&
  left.occurredOn.value === right.occurredOn.value &&
  left.amount.minorUnits === right.amount.minorUnits &&
  left.amount.scale === right.amount.scale &&
  left.amount.currency === right.amount.currency;

const mergeTransactions = (
  left: ConsolidatedTransaction,
  right: ConsolidatedTransaction,
): ConsolidatedTransaction => {
  const mergedLegacyRefs = [...left.legacyRefs, ...right.legacyRefs];
  const mergedSecondarySources = [
    ...left.sourceSummary.secondarySources,
    ...right.sourceSummary.secondarySources,
    right.sourceSummary.primarySource,
  ].filter(
    (source, index, self) =>
      self.indexOf(source) === index &&
      source !== left.sourceSummary.primarySource,
  );

  return {
    ...left,
    legacyRefs: mergedLegacyRefs,
    sourceSummary: {
      ...left.sourceSummary,
      secondarySources: mergedSecondarySources,
      notes: [
        ...left.sourceSummary.notes,
        `Reconciliado com ${right.sourceSummary.primarySource}.${right.legacyRefs[0]?.table ?? ""}.${right.legacyRefs[0]?.primaryKey ?? ""}.`,
      ],
    },
  };
};

export type ReconcileFactsResult = {
  readonly transactions: ConsolidatedTransaction[];
  readonly issues: ReviewableIssue[];
};

export const reconcileFacts = (
  transactions: readonly ConsolidatedTransaction[],
): ReconcileFactsResult => {
  const groups = new Map<string, ConsolidatedTransaction[]>();

  for (const transaction of transactions) {
    const hash = canonicalFactKeyHash(transaction.factKey);
    const group = groups.get(hash) ?? [];
    group.push(transaction);
    groups.set(hash, group);
  }

  const reconciled: ConsolidatedTransaction[] = [];
  const issues: ReviewableIssue[] = [];

  for (const [hash, group] of groups) {
    if (group.length === 0) {
      continue;
    }

    if (group.length === 1) {
      const single = group[0];
      if (single) {
        reconciled.push(single);
      }
      continue;
    }

    const first = group[0];
    if (!first) {
      continue;
    }

    const rest = group.slice(1);
    const hasConflict = rest.some(
      (item) => !transactionsAreEquivalent(first, item),
    );

    if (hasConflict) {
      issues.push(
        createReviewableIssue({
          kind: "reconciliation-conflict",
          reason:
            "Conflito material entre fontes para o mesmo fato canônico; revisão manual necessária.",
          factKey: first.factKey,
          legacyRefs: group.flatMap((item) => item.legacyRefs),
          evidence: {
            factKeyHash: hash,
            sourceCount: group.length,
            primarySources: group.map(
              (item) => item.sourceSummary.primarySource,
            ),
          },
        }),
      );
      continue;
    }

    const merged = rest.reduce(
      (acc, item) => mergeTransactions(acc, item),
      first,
    );
    reconciled.push(merged);
  }

  return { transactions: reconciled, issues };
};
