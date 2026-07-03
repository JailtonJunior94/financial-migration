import { z } from "zod";
import type {
  SemanticEnrichmentInput,
  SemanticEnrichmentPort,
} from "../../application/ports/semantic-enrichment-port.ts";
import type { SemanticSuggestion } from "../../domain/classification/classify-transaction.ts";
import { ApplicationError } from "../../domain/common/errors.ts";

const openRouterResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string(),
        }),
      }),
    )
    .min(1),
});

const suggestionSchema = z.object({
  categoryName: z.string().min(1).optional(),
  subcategoryName: z.string().min(1).optional(),
});

export type OpenRouterSemanticEnrichmentConfig = {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
};

export class OpenRouterSemanticEnrichmentAdapter
  implements SemanticEnrichmentPort
{
  constructor(private readonly config: OpenRouterSemanticEnrichmentConfig) {}

  async suggest(
    input: SemanticEnrichmentInput,
  ): Promise<SemanticSuggestion | undefined> {
    const response = await fetch(
      `${this.config.baseUrl}/api/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: "system",
              content:
                "Você é um assistente de classificação financeira. Responda apenas com um objeto JSON contendo 'categoryName' e 'subcategoryName' quando possível. Nunca decida autonomamente a categoria final; a resposta será validada contra a taxonomia oficial.",
            },
            {
              role: "user",
              content: `Classifique semanticamente a seguinte transação de ${input.kind}: "${input.description}".`,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new ApplicationError(
        "INTEGRATION_FAILURE",
        "Falha ao consultar OpenRouter para enriquecimento semântico.",
        { status: response.status },
      );
    }

    const raw = (await response.json()) as unknown;
    const parsed = openRouterResponseSchema.safeParse(raw);

    if (!parsed.success) {
      throw new ApplicationError(
        "INTEGRATION_FAILURE",
        "Resposta do OpenRouter não segue o formato esperado.",
        { issues: parsed.error.issues },
      );
    }

    const firstChoice = parsed.data.choices[0];
    if (!firstChoice) {
      return undefined;
    }

    const content = firstChoice.message.content;
    let json: unknown;

    try {
      json = JSON.parse(content);
    } catch {
      return undefined;
    }

    const suggestion = suggestionSchema.safeParse(json);

    if (!suggestion.success || !suggestion.data.categoryName) {
      return undefined;
    }

    const result: SemanticSuggestion = {
      categoryName: suggestion.data.categoryName,
    };

    if (suggestion.data.subcategoryName) {
      return { ...result, subcategoryName: suggestion.data.subcategoryName };
    }

    return result;
  }
}
