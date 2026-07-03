import type { CanonicalFactKey } from "../consolidation/canonical-fact-key.ts";
import { createReviewableIssue } from "../consolidation/reviewable-issue.ts";
import type {
  ConsolidatedTransaction,
  PaymentMethod,
} from "../consolidation/types.ts";
import { paymentMethodIsProvable } from "./payment-method.ts";
import type {
  Category,
  CategoryCatalog,
  CategoryDictionaryPage,
  ClassificationOutcome,
  Subcategory,
} from "./types.ts";

export type SemanticSuggestion = {
  readonly categoryName?: string;
  readonly subcategoryName?: string;
};

type CategoryMapping = {
  readonly categoryId: string;
  readonly subcategoryId?: string;
  readonly source: "candidate" | "dictionary" | "openrouter";
};

const normalizeForMatching = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Mn}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

const hasActiveCategories = (catalog: CategoryCatalog): boolean =>
  catalog.categories.some(
    (category) =>
      !category.deprecated &&
      category.subcategories.some((sub) => !sub.deprecated),
  );

const findCategoryById = (
  catalog: CategoryCatalog,
  categoryId: string,
): Category | undefined =>
  catalog.categories.find((c) => c.id === categoryId && !c.deprecated);

const findSubcategoryById = (
  category: Category,
  subcategoryId?: string,
): Subcategory | undefined =>
  subcategoryId
    ? category.subcategories.find(
        (s) => s.id === subcategoryId && !s.deprecated,
      )
    : undefined;

const buildMapping = (
  categoryId: string,
  subcategory: Subcategory | undefined,
  source: CategoryMapping["source"],
): CategoryMapping => {
  const mapping: CategoryMapping = { categoryId, source };
  if (subcategory) {
    return { ...mapping, subcategoryId: subcategory.id };
  }
  return mapping;
};

const findByCandidate = (
  transaction: ConsolidatedTransaction,
  catalog: CategoryCatalog,
): CategoryMapping | undefined => {
  if (!transaction.categoryCandidate) {
    return undefined;
  }

  const category = findCategoryById(catalog, transaction.categoryCandidate.id);
  if (!category) {
    return undefined;
  }

  const subcategory = transaction.subcategoryCandidate
    ? findSubcategoryById(category, transaction.subcategoryCandidate.id)
    : undefined;

  return buildMapping(category.id, subcategory, "candidate");
};

const findByDictionary = (
  transaction: ConsolidatedTransaction,
  catalog: CategoryCatalog,
  dictionary: CategoryDictionaryPage,
): CategoryMapping | undefined => {
  const normalizedDescription = normalizeForMatching(transaction.description);

  for (const entry of dictionary.entries) {
    if (entry.deprecated) {
      continue;
    }

    const normalizedTerm = normalizeForMatching(entry.term);
    if (
      normalizedDescription.includes(normalizedTerm) ||
      normalizedTerm.includes(normalizedDescription)
    ) {
      const category = findCategoryById(catalog, entry.categoryId);
      if (!category) {
        continue;
      }

      const subcategory = entry.subcategoryId
        ? findSubcategoryById(category, entry.subcategoryId)
        : undefined;

      return buildMapping(category.id, subcategory, "dictionary");
    }
  }

  return undefined;
};

const findBySemanticSuggestion = (
  transaction: ConsolidatedTransaction,
  catalog: CategoryCatalog,
  suggestion: SemanticSuggestion,
): CategoryMapping | undefined => {
  if (!suggestion.categoryName) {
    return undefined;
  }

  const normalizedSuggestedCategory = normalizeForMatching(
    suggestion.categoryName,
  );

  for (const category of catalog.categories) {
    if (category.deprecated) {
      continue;
    }

    if (normalizeForMatching(category.name) === normalizedSuggestedCategory) {
      let subcategory: Subcategory | undefined;
      if (suggestion.subcategoryName) {
        const normalizedSuggestedSubcategory = normalizeForMatching(
          suggestion.subcategoryName,
        );
        subcategory = category.subcategories.find(
          (s) =>
            !s.deprecated &&
            normalizeForMatching(s.name) === normalizedSuggestedSubcategory,
        );
      }

      return buildMapping(category.id, subcategory, "openrouter");
    }
  }

  return undefined;
};

const buildClassified = (
  transaction: ConsolidatedTransaction,
  mapping: CategoryMapping,
  paymentMethod: PaymentMethod,
): ClassificationOutcome => {
  const classified: import("./types.ts").ClassifiedTransaction = {
    transaction,
    categoryId: mapping.categoryId,
    paymentMethod,
    suggestedByOpenRouter: mapping.source === "openrouter",
  };

  if (mapping.subcategoryId) {
    return {
      kind: "classified",
      classified: { ...classified, subcategoryId: mapping.subcategoryId },
    };
  }

  return { kind: "classified", classified };
};

const buildBlocked = (
  transaction: ConsolidatedTransaction,
  kind:
    | "missing-income-taxonomy"
    | "unknown-payment-method"
    | "semantic-mismatch",
  reason: string,
  evidence?: Record<string, unknown>,
): ClassificationOutcome => ({
  kind: "blocked",
  issue: createReviewableIssue({
    kind,
    reason,
    factKey: transaction.factKey,
    legacyRefs: transaction.legacyRefs,
    evidence: evidence ?? {},
  }),
});

export const classifyTransaction = (
  transaction: ConsolidatedTransaction,
  catalog: CategoryCatalog,
  dictionary: CategoryDictionaryPage,
  semanticSuggestion?: SemanticSuggestion,
): ClassificationOutcome => {
  if (!paymentMethodIsProvable(transaction.paymentMethod)) {
    return buildBlocked(
      transaction,
      "unknown-payment-method",
      "Método de pagamento não pôde ser provado para o fato consolidado.",
      { paymentMethod: transaction.paymentMethod },
    );
  }

  if (transaction.kind === "income" && !hasActiveCategories(catalog)) {
    return buildBlocked(
      transaction,
      "missing-income-taxonomy",
      "Taxonomia de receitas não possui cobertura ativa no destino.",
      { kind: transaction.kind },
    );
  }

  const candidateMapping = findByCandidate(transaction, catalog);
  if (candidateMapping) {
    return buildClassified(
      transaction,
      candidateMapping,
      transaction.paymentMethod,
    );
  }

  const dictionaryMapping = findByDictionary(transaction, catalog, dictionary);
  if (dictionaryMapping) {
    return buildClassified(
      transaction,
      dictionaryMapping,
      transaction.paymentMethod,
    );
  }

  if (semanticSuggestion) {
    const suggestionMapping = findBySemanticSuggestion(
      transaction,
      catalog,
      semanticSuggestion,
    );
    if (suggestionMapping) {
      return buildClassified(
        transaction,
        suggestionMapping,
        transaction.paymentMethod,
      );
    }
  }

  return buildBlocked(
    transaction,
    "semantic-mismatch",
    `Nenhuma categoria/subcategoria válida encontrada para '${transaction.description}'.`,
    { kind: transaction.kind, description: transaction.description },
  );
};

export const classifiedToPublishable = (
  classified: import("./types.ts").ClassifiedTransaction,
): {
  readonly factKey: CanonicalFactKey;
  readonly categoryId: string;
  readonly subcategoryId?: string;
  readonly paymentMethod: PaymentMethod;
} => {
  const publishable = {
    factKey: classified.transaction.factKey,
    categoryId: classified.categoryId,
    paymentMethod: classified.paymentMethod,
  };

  if (classified.subcategoryId) {
    return { ...publishable, subcategoryId: classified.subcategoryId };
  }

  return publishable;
};
