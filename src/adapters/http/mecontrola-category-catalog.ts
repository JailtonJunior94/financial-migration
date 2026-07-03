import { z } from "zod";
import type { CategoryCatalogPort } from "../../application/ports/category-catalog-port.ts";
import type {
  CategoryCatalog,
  CategoryDictionaryPage,
  CategoryDictionarySearch,
  CategoryKind,
} from "../../domain/classification/types.ts";
import { ApplicationError } from "../../domain/common/errors.ts";
import {
  type GatewayAuthConfig,
  buildGatewayAuthHeaders,
} from "./gateway-auth.ts";

const categoryKindSchema: z.ZodType<CategoryKind> = z.enum([
  "expense",
  "income",
]);

const subcategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  deprecated: z.boolean().default(false),
});

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: categoryKindSchema,
  deprecated: z.boolean().default(false),
  subcategories: z.array(subcategorySchema),
});

const categoryCatalogResponseSchema = z.object({
  kind: categoryKindSchema,
  categories: z.array(categorySchema),
});

const categoryCatalogSchema = categoryCatalogResponseSchema.transform(
  (data): CategoryCatalog => ({
    kind: data.kind,
    categories: data.categories.map((category) => ({
      ...category,
      subcategories: category.subcategories.map((sub) => ({ ...sub })),
    })),
  }),
);

const categoryDictionaryEntrySchema = z.object({
  id: z.string().min(1),
  term: z.string().min(1),
  categoryId: z.string().min(1),
  subcategoryId: z.string().min(1).optional(),
  kind: categoryKindSchema,
  deprecated: z.boolean().default(false),
});

const categoryDictionaryPageResponseSchema = z.object({
  entries: z.array(categoryDictionaryEntrySchema),
  nextPageToken: z.string().min(1).optional(),
});

const categoryDictionaryPageSchema =
  categoryDictionaryPageResponseSchema.transform(
    (data): CategoryDictionaryPage => ({
      entries: data.entries.map((entry) => {
        const mapped = {
          id: entry.id,
          term: entry.term,
          categoryId: entry.categoryId,
          kind: entry.kind,
          deprecated: entry.deprecated,
        };
        if (entry.subcategoryId) {
          return { ...mapped, subcategoryId: entry.subcategoryId };
        }
        return mapped;
      }),
      ...(data.nextPageToken ? { nextPageToken: data.nextPageToken } : {}),
    }),
  );

export type MecontrolaCategoryCatalogConfig = {
  readonly baseUrl: string;
  readonly gatewayAuth: GatewayAuthConfig;
};

export class MecontrolaCategoryCatalogAdapter implements CategoryCatalogPort {
  constructor(private readonly config: MecontrolaCategoryCatalogConfig) {}

  async listByKind(kind: CategoryKind): Promise<CategoryCatalog> {
    const url = new URL("/api/v1/categories", this.config.baseUrl);
    url.searchParams.set("kind", kind);
    url.searchParams.set("include_deprecated", "false");

    const response = await this.fetchJson(url);
    const parsed = categoryCatalogSchema.safeParse(response);

    if (!parsed.success) {
      throw new ApplicationError(
        "MISSING_TAXONOMY",
        "Resposta de categorias não segue o contrato esperado.",
        { kind, issues: parsed.error.issues },
      );
    }

    return parsed.data;
  }

  async searchDictionary(
    input: CategoryDictionarySearch,
  ): Promise<CategoryDictionaryPage> {
    const url = new URL(
      "/api/v1/category-dictionary/search",
      this.config.baseUrl,
    );

    if (input.kind) {
      url.searchParams.set("kind", input.kind);
    }
    if (input.pageSize && input.pageSize > 0) {
      url.searchParams.set("page_size", input.pageSize.toString());
    }
    if (input.pageToken) {
      url.searchParams.set("page_token", input.pageToken);
    }
    url.searchParams.set("term", input.term);

    const response = await this.fetchJson(url);
    const parsed = categoryDictionaryPageSchema.safeParse(response);

    if (!parsed.success) {
      throw new ApplicationError(
        "MISSING_TAXONOMY",
        "Resposta do dicionário de categorias não segue o contrato esperado.",
        { term: input.term, issues: parsed.error.issues },
      );
    }

    return parsed.data;
  }

  private async fetchJson(url: URL): Promise<unknown> {
    const headers = buildGatewayAuthHeaders(this.config.gatewayAuth);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });

    if (!response.ok) {
      throw new ApplicationError(
        "INTEGRATION_FAILURE",
        "Falha ao consultar taxonomia do destino.",
        {
          url: url.toString(),
          status: response.status,
        },
      );
    }

    try {
      return (await response.json()) as unknown;
    } catch (error) {
      throw new ApplicationError(
        "INTEGRATION_FAILURE",
        "Resposta da taxonomia não é JSON válido.",
        {
          url: url.toString(),
          cause: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }
}
