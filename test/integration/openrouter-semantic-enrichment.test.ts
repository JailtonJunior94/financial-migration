import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { OpenRouterSemanticEnrichmentAdapter } from "../../src/adapters/semantic/openrouter-semantic-enrichment.ts";

describe("OpenRouterSemanticEnrichmentAdapter integration", () => {
  let server: ReturnType<typeof Bun.serve> | undefined;

  afterEach(() => {
    server?.stop();
    server = undefined;
  });

  test("extrai sugestão de JSON na resposta", async () => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/api/v1/chat/completions") {
          return Response.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    categoryName: "Alimentação",
                    subcategoryName: "Supermercado",
                  }),
                },
              },
            ],
          });
        }
        return new Response("not found", { status: 404 });
      },
    });

    const adapter = new OpenRouterSemanticEnrichmentAdapter({
      baseUrl: `http://localhost:${server.port}`,
      apiKey: "test-key",
      model: "test-model",
    });

    const suggestion = await adapter.suggest({
      description: "Compra no supermercado",
      kind: "expense",
    });

    expect(suggestion).toEqual({
      categoryName: "Alimentação",
      subcategoryName: "Supermercado",
    });
  });

  test("retorna undefined quando resposta não contém JSON válido", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({
          choices: [
            {
              message: {
                content: "não é json",
              },
            },
          ],
        });
      },
    });

    const adapter = new OpenRouterSemanticEnrichmentAdapter({
      baseUrl: `http://localhost:${server.port}`,
      apiKey: "test-key",
      model: "test-model",
    });

    const suggestion = await adapter.suggest({
      description: "Compra",
      kind: "expense",
    });

    expect(suggestion).toBeUndefined();
  });

  test("retorna undefined quando categoria não é informada", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({ subcategoryName: "Supermercado" }),
              },
            },
          ],
        });
      },
    });

    const adapter = new OpenRouterSemanticEnrichmentAdapter({
      baseUrl: `http://localhost:${server.port}`,
      apiKey: "test-key",
      model: "test-model",
    });

    const suggestion = await adapter.suggest({
      description: "Compra",
      kind: "expense",
    });

    expect(suggestion).toBeUndefined();
  });
});
