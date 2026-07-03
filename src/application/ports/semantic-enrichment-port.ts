import type { SemanticSuggestion } from "../../domain/classification/classify-transaction.ts";

export type SemanticEnrichmentInput = {
  readonly description: string;
  readonly kind: "expense" | "income";
};

export interface SemanticEnrichmentPort {
  suggest(
    input: SemanticEnrichmentInput,
  ): Promise<SemanticSuggestion | undefined>;
}
