import type {
  ConsolidatedTransaction,
  PaymentMethod,
  ReviewableIssue,
} from "../consolidation/types.ts";

export type CategoryKind = "expense" | "income";

export type Category = {
  readonly id: string;
  readonly name: string;
  readonly kind: CategoryKind;
  readonly deprecated: boolean;
  readonly subcategories: readonly Subcategory[];
};

export type Subcategory = {
  readonly id: string;
  readonly name: string;
  readonly deprecated: boolean;
};

export type CategoryCatalog = {
  readonly kind: CategoryKind;
  readonly categories: readonly Category[];
};

export type CategoryDictionaryEntry = {
  readonly id: string;
  readonly term: string;
  readonly categoryId: string;
  readonly subcategoryId?: string;
  readonly kind: CategoryKind;
  readonly deprecated: boolean;
};

export type CategoryDictionaryPage = {
  readonly entries: readonly CategoryDictionaryEntry[];
  readonly nextPageToken?: string;
};

export type CategoryDictionarySearch = {
  readonly term: string;
  readonly kind?: CategoryKind;
  readonly pageSize?: number;
  readonly pageToken?: string;
};

export type ClassificationStatus =
  | "classified"
  | "blocked_missing_taxonomy"
  | "blocked_ambiguous"
  | "pending_review";

export type ClassificationResult = {
  readonly status: ClassificationStatus;
  readonly category?: Category;
  readonly subcategory?: Subcategory;
  readonly suggestedByOpenRouter?: boolean;
  readonly blockReason?: string;
};

export type ClassifiedTransaction = {
  readonly transaction: ConsolidatedTransaction;
  readonly categoryId: string;
  readonly subcategoryId?: string;
  readonly paymentMethod: PaymentMethod;
  readonly suggestedByOpenRouter: boolean;
};

export type ClassificationOutcome =
  | { readonly kind: "classified"; classified: ClassifiedTransaction }
  | { readonly kind: "blocked"; issue: ReviewableIssue };
