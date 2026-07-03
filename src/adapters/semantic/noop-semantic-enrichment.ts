import type {
  SemanticEnrichmentInput,
  SemanticEnrichmentPort,
} from "../../application/ports/semantic-enrichment-port.ts";
import type { SemanticSuggestion } from "../../domain/classification/classify-transaction.ts";

export class NoOpSemanticEnrichmentAdapter implements SemanticEnrichmentPort {
  async suggest(
    _input: SemanticEnrichmentInput,
  ): Promise<SemanticSuggestion | undefined> {
    return undefined;
  }
}
