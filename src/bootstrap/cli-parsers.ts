import { z } from "zod";
import type { ClassifiedTransaction } from "../domain/classification/types.ts";
import type {
  CanonicalFactKey,
  ConsolidatedCard,
  ConsolidatedTransaction,
  LegacySourceRef,
  ReviewableIssue,
  UserEligibilityScope,
} from "../domain/consolidation/types.ts";
import type { FinancialDiscoverySnapshot } from "../domain/discovery/types.ts";

const legacyDatabaseSchema = z.enum(["AccountControlDB", "FinancialControlDB"]);

const legacySourceRefSchema = z.object({
  database: legacyDatabaseSchema,
  table: z.string().min(1),
  primaryKey: z.string().min(1),
});

const canonicalFactKeySchema = z.object({
  resource: z.enum(["transaction", "card"]),
  userId: z.string().min(1),
  occurredOn: z.string().min(1),
  normalizedDescription: z.string().min(1),
  normalizedAmountMinorUnits: z
    .string()
    .min(1)
    .transform((value) => BigInt(value)),
  currency: z.string().min(1),
  paymentContext: z.unknown(),
  installmentContext: z.unknown(),
});

const userEligibilityScopeSchema = z.object({
  targetUser: z.object({
    id: z.string().uuid(),
    email: z.string().min(1),
    whatsappNumber: z.string().min(1),
    status: z.enum(["ACTIVE", "INACTIVE"]),
  }),
  matchedLegacyUsers: legacySourceRefSchema.array(),
  evidence: z
    .object({
      legacyRef: legacySourceRefSchema,
      signalKind: z.enum([
        "name",
        "email",
        "phone",
        "card",
        "recurring_history",
        "consistent_relationship",
        "affirmative_account_rule",
      ]),
      value: z.string().min(1),
    })
    .array(),
  status: z.enum([
    "eligible",
    "blocked_no_strong_signal",
    "blocked_inconsistent_target_user",
    "blocked_not_active",
  ]),
});

const reviewableIssueSchema = z.object({
  issueId: z.string().min(1),
  kind: z.enum([
    "user-eligibility",
    "reconciliation-conflict",
    "missing-income-taxonomy",
    "unknown-payment-method",
    "destination-divergence",
    "semantic-mismatch",
  ]),
  severity: z.enum(["warning", "blocking"]),
  factKey: canonicalFactKeySchema.optional(),
  legacyRefs: legacySourceRefSchema.array(),
  reason: z.string().min(1),
  evidence: z.record(z.string(), z.unknown()),
  blockedAt: z.string().min(1),
});

const financialDiscoverySnapshotSchema = z.object({
  discoveredAt: z.string().min(1),
  databases: legacyDatabaseSchema.array(),
  tables: z
    .object({
      metadata: z.object({
        database: legacyDatabaseSchema,
        schemaName: z.string().min(1),
        tableName: z.string().min(1),
        columns: z.unknown().array(),
        indexes: z.unknown().array(),
        estimatedRowCount: z.number().int().nonnegative(),
        sampleSize: z.number().int().nonnegative(),
      }),
      semantic: z.object({
        role: z.enum([
          "card_register",
          "account_register",
          "invoice_header",
          "invoice_item",
          "transaction_header",
          "transaction_item",
          "bill_header",
          "bill_item",
          "unknown",
        ]),
        granularity: z.enum(["aggregate", "detail", "register"]),
        hasDirectUserLink: z.boolean(),
        userLinkInference: z.string().optional(),
        rationale: z.string().min(1),
        risks: z.string().array(),
      }),
      samples: z
        .object({
          database: legacyDatabaseSchema,
          tableName: z.string().min(1),
          primaryKey: z.string().min(1),
          fields: z.record(z.string(), z.unknown()),
        })
        .array(),
    })
    .array(),
});

const moneyAmountSchema = z.object({
  minorUnits: z
    .string()
    .min(1)
    .transform((value) => BigInt(value)),
  scale: z.number().int().min(0).max(18),
  currency: z.string().min(1),
});

const occurrenceDateSchema = z.object({
  value: z.string().min(1),
  sourceField: z.string().min(1),
  fallbackUsed: z.boolean(),
});

const installmentPlanSchema = z.object({
  groupKey: z.string().min(1),
  currentInstallment: z.number().int().positive(),
  totalInstallments: z.number().int().positive(),
});

const paymentMethodSchema = z.union([
  z.object({
    kind: z.literal("credit_card"),
    cardBusinessKey: z.string().min(1),
  }),
  z.object({
    kind: z.literal("debit_card"),
    cardBusinessKey: z.string().min(1),
  }),
  z.object({ kind: z.literal("pix") }),
  z.object({ kind: z.literal("ted") }),
  z.object({ kind: z.literal("other_bank_transfer") }),
  z.object({ kind: z.literal("cash") }),
  z.object({ kind: z.literal("unknown") }),
]);

const consolidatedCardSchema = z.object({
  businessKey: z.string().min(1),
  nickname: z.string().min(1),
  bank: z.string().min(1),
  closingDay: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31),
  expirationDate: z.string().min(1).optional(),
  legacyRefs: legacySourceRefSchema.array(),
  ownerEvidence: z
    .object({
      legacyRef: legacySourceRefSchema,
      signalKind: z.enum([
        "name",
        "email",
        "phone",
        "card",
        "recurring_history",
        "consistent_relationship",
        "affirmative_account_rule",
      ]),
      value: z.string().min(1),
    })
    .array(),
  reconciliationStatus: z.enum([
    "pending",
    "reconciled",
    "conflict",
    "blocked",
  ]),
});

const consolidatedTransactionSchema = z.object({
  factKey: canonicalFactKeySchema,
  kind: z.enum(["expense", "income"]),
  occurredOn: occurrenceDateSchema,
  competence: z.string().min(1),
  description: z.string().min(1),
  amount: moneyAmountSchema,
  categoryCandidate: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      kind: z.enum(["expense", "income"]),
    })
    .optional(),
  subcategoryCandidate: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
    })
    .optional(),
  paymentMethod: paymentMethodSchema,
  cardBinding: z.string().optional(),
  installmentPlan: installmentPlanSchema,
  legacyRefs: legacySourceRefSchema.array(),
  sourceSummary: z.object({
    primarySource: legacyDatabaseSchema,
    secondarySources: legacyDatabaseSchema.array(),
    notes: z.string().array(),
  }),
});

const classifiedTransactionSchema = z.object({
  transaction: consolidatedTransactionSchema,
  categoryId: z.string().min(1),
  subcategoryId: z.string().min(1).optional(),
  paymentMethod: paymentMethodSchema,
  suggestedByOpenRouter: z.boolean(),
});

const cast = <T>(value: unknown): T => value as T;

export const parseEligibilityScope = (raw: unknown): UserEligibilityScope =>
  cast<UserEligibilityScope>(userEligibilityScopeSchema.parse(raw));

export const parseConsolidatedTransactions = (
  raw: unknown,
): { transactions: ConsolidatedTransaction[] } =>
  cast<{ transactions: ConsolidatedTransaction[] }>(
    z
      .object({ transactions: consolidatedTransactionSchema.array() })
      .parse(raw),
  );

export const parseClassifiedOutput = (
  raw: unknown,
): {
  classified: ClassifiedTransaction[];
  blocked: ReviewableIssue[];
} =>
  cast<{ classified: ClassifiedTransaction[]; blocked: ReviewableIssue[] }>(
    z
      .object({
        classified: classifiedTransactionSchema.array(),
        blocked: reviewableIssueSchema.array(),
      })
      .parse(raw),
  );

export const parseIssues = (raw: unknown): ReviewableIssue[] =>
  cast<ReviewableIssue[]>(reviewableIssueSchema.array().parse(raw));

export const parseCards = (raw: unknown): { cards: ConsolidatedCard[] } =>
  cast<{ cards: ConsolidatedCard[] }>(
    z.object({ cards: consolidatedCardSchema.array() }).parse(raw),
  );

export const parseDiscoverySnapshot = (
  raw: unknown,
): FinancialDiscoverySnapshot =>
  cast<FinancialDiscoverySnapshot>(financialDiscoverySnapshotSchema.parse(raw));
