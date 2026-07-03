import type {
  CanonicalFactKey,
  PaymentContext,
} from "../consolidation/canonical-fact-key.ts";
import type { InstallmentPlan } from "../consolidation/installment-plan.ts";
import type { MoneyAmount } from "../consolidation/money-amount.ts";
import type {
  LegacySourceRef,
  TransactionKind,
} from "../consolidation/types.ts";
import type { CanonicalTransactionPayload } from "./payload-canonical.ts";

export type PipelineStage =
  | "discovery"
  | "eligibility"
  | "consolidation"
  | "classification"
  | "card_publication"
  | "transaction_publication";

export type PipelineProgress = {
  readonly scope: string;
  readonly stage: PipelineStage;
  readonly processedCount: number;
  readonly blockedCount: number;
  readonly reconciledCount: number;
  readonly publishedCount: number;
  readonly skippedCount: number;
  readonly lastCursor?: string;
  readonly updatedAt: string;
};

export type PublishableCard = {
  readonly businessKey: string;
  readonly nickname: string;
  readonly bank: string;
  readonly dueDay: number;
  readonly closingDay?: number;
  readonly legacyRefs: readonly LegacySourceRef[];
};

export type PublishableTransaction = {
  readonly factKey: CanonicalFactKey;
  readonly kind: TransactionKind;
  readonly occurredOn: string;
  readonly competence: string;
  readonly description: string;
  readonly amount: MoneyAmount;
  readonly categoryId: string;
  readonly subcategoryId?: string;
  readonly paymentContext: PaymentContext;
  readonly installmentPlan: InstallmentPlan;
  readonly legacyRefs: readonly LegacySourceRef[];
};

export type RemoteCardMatch = {
  readonly remoteId: string;
  readonly businessKey: string;
};

export type RemoteCardRecord = {
  readonly remoteId: string;
  readonly businessKey: string;
  readonly createdAt: string;
};

export type RemoteCardBinding = {
  readonly legacyRef: LegacySourceRef;
  readonly remoteId: string;
  readonly businessKey: string;
  readonly boundAt: string;
};

export type RemoteTransactionMatch = {
  readonly remoteId: string;
  readonly factKeyHash: string;
  readonly equivalent: boolean;
  readonly payload?: CanonicalTransactionPayload;
};

export type RemoteTransactionRecord = {
  readonly remoteId: string;
  readonly factKeyHash: string;
  readonly createdAt: string;
};

export type PublicationDecision =
  | { readonly kind: "publish"; readonly idempotencyKey: string }
  | { readonly kind: "skip"; readonly reason: "already_exists_equivalent" }
  | {
      readonly kind: "block";
      readonly reason:
        | "destination_divergence"
        | "unknown_payment_method"
        | "missing_taxonomy";
    };
