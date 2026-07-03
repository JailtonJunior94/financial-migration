import type { CanonicalFactKey } from "./canonical-fact-key.ts";
import type { InstallmentPlan } from "./installment-plan.ts";
import type { MoneyAmount } from "./money-amount.ts";
import type { OccurrenceDate } from "./occurrence-date.ts";

export type { CanonicalFactKey };

export type LegacyDatabase = "AccountControlDB" | "FinancialControlDB";

export type LegacySourceRef = {
  readonly database: LegacyDatabase;
  readonly table: string;
  readonly primaryKey: string;
};

export type EligibilityStatus =
  | "eligible"
  | "blocked_no_strong_signal"
  | "blocked_inconsistent_target_user"
  | "blocked_not_active";

export type TargetUser = {
  readonly id: string;
  readonly email: string;
  readonly whatsappNumber: string;
  readonly status: "ACTIVE" | "INACTIVE";
};

export type UserEvidence = {
  readonly legacyRef: LegacySourceRef;
  readonly signalKind:
    | "name"
    | "email"
    | "phone"
    | "card"
    | "recurring_history"
    | "consistent_relationship"
    | "affirmative_account_rule";
  readonly value: string;
};

export type UserEligibilityScope = {
  readonly targetUser: TargetUser;
  readonly matchedLegacyUsers: readonly LegacySourceRef[];
  readonly evidence: readonly UserEvidence[];
  readonly status: EligibilityStatus;
};

export type ReconciliationStatus =
  | "pending"
  | "reconciled"
  | "conflict"
  | "blocked";

export type ConsolidatedCard = {
  readonly businessKey: string;
  readonly nickname: string;
  readonly bank: string;
  readonly closingDay?: number;
  readonly dueDay: number;
  readonly expirationDate?: string;
  readonly legacyRefs: readonly LegacySourceRef[];
  readonly ownerEvidence: readonly UserEvidence[];
  readonly reconciliationStatus: ReconciliationStatus;
};

export type TransactionKind = "expense" | "income";

export type PaymentMethod =
  | { readonly kind: "credit_card"; readonly cardBusinessKey: string }
  | { readonly kind: "debit_card"; readonly cardBusinessKey: string }
  | { readonly kind: "pix" }
  | { readonly kind: "ted" }
  | { readonly kind: "other_bank_transfer" }
  | { readonly kind: "cash" }
  | { readonly kind: "unknown" };

export type CategoryCandidate = {
  readonly id: string;
  readonly name: string;
  readonly kind: TransactionKind;
};

export type SubcategoryCandidate = {
  readonly id: string;
  readonly name: string;
};

export type SourceSummary = {
  readonly primarySource: LegacyDatabase;
  readonly secondarySources: readonly LegacyDatabase[];
  readonly notes: readonly string[];
};

export type ConsolidatedTransaction = {
  readonly factKey: CanonicalFactKey;
  readonly kind: TransactionKind;
  readonly occurredOn: OccurrenceDate;
  readonly competence: string;
  readonly description: string;
  readonly amount: MoneyAmount;
  readonly categoryCandidate?: CategoryCandidate;
  readonly subcategoryCandidate?: SubcategoryCandidate;
  readonly paymentMethod: PaymentMethod;
  readonly cardBinding?: string;
  readonly installmentPlan: InstallmentPlan;
  readonly legacyRefs: readonly LegacySourceRef[];
  readonly sourceSummary: SourceSummary;
};

export type ReviewableIssueKind =
  | "user-eligibility"
  | "reconciliation-conflict"
  | "missing-income-taxonomy"
  | "unknown-payment-method"
  | "destination-divergence"
  | "semantic-mismatch";

export type ReviewableIssueSeverity = "warning" | "blocking";

export type ReviewableIssue = {
  readonly issueId: string;
  readonly kind: ReviewableIssueKind;
  readonly severity: ReviewableIssueSeverity;
  readonly factKey?: CanonicalFactKey;
  readonly legacyRefs: readonly LegacySourceRef[];
  readonly reason: string;
  readonly evidence: Record<string, unknown>;
  readonly blockedAt: string;
};
