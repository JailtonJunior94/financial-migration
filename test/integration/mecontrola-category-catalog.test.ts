import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { MecontrolaCategoryCatalogAdapter } from "../../src/adapters/http/mecontrola-category-catalog.ts";
import { ApplicationError } from "../../src/domain/common/errors.ts";

describe("MecontrolaCategoryCatalogAdapter integration", () => {
  let server: ReturnType<typeof Bun.serve> | undefined;

  afterEach(() => {
    server?.stop();
    server = undefined;
  });

  test("lista categorias com headers de gateway", async () => {
    const receivedHeaders: Record<string, string> = {};

    server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/api/v1/categories") {
          request.headers.forEach((value, key) => {
            receivedHeaders[key] = value;
          });
          return Response.json({
            kind: "expense",
            categories: [
              {
                id: "cat-1",
                name: "Alimentação",
                kind: "expense",
                deprecated: false,
                subcategories: [
                  { id: "sub-1", name: "Supermercado", deprecated: false },
                ],
              },
            ],
          });
        }
        return new Response("not found", { status: 404 });
      },
    });

    const adapter = new MecontrolaCategoryCatalogAdapter({
      baseUrl: `http://localhost:${server.port}`,
      gatewayAuth: {
        userId: "06edc407-4f63-42e8-b07c-946b9ef0a19c",
        gatewaySecretHex: "secret",
      },
    });

    const catalog = await adapter.listByKind("expense");

    expect(catalog.kind).toBe("expense");
    expect(catalog.categories).toHaveLength(1);
    expect(receivedHeaders["x-user-id"]).toBe(
      "06edc407-4f63-42e8-b07c-946b9ef0a19c",
    );
    expect(receivedHeaders["x-gateway-timestamp"]).toBeDefined();
    expect(receivedHeaders["x-gateway-auth"]).toBeDefined();
  });

  test("busca no dicionário por termo", async () => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/api/v1/category-dictionary/search") {
          const term = url.searchParams.get("term");
          if (term === "supermercado") {
            return Response.json({
              entries: [
                {
                  id: "dict-1",
                  term: "supermercado",
                  categoryId: "cat-1",
                  subcategoryId: "sub-1",
                  kind: "expense",
                },
              ],
            });
          }
        }
        return new Response("not found", { status: 404 });
      },
    });

    const adapter = new MecontrolaCategoryCatalogAdapter({
      baseUrl: `http://localhost:${server.port}`,
      gatewayAuth: {
        userId: "06edc407-4f63-42e8-b07c-946b9ef0a19c",
        gatewaySecretHex: "secret",
      },
    });

    const page = await adapter.searchDictionary({ term: "supermercado" });

    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]?.categoryId).toBe("cat-1");
  });

  test("lança ApplicationError quando resposta não segue contrato", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({ unexpected: true });
      },
    });

    const adapter = new MecontrolaCategoryCatalogAdapter({
      baseUrl: `http://localhost:${server.port}`,
      gatewayAuth: {
        userId: "06edc407-4f63-42e8-b07c-946b9ef0a19c",
        gatewaySecretHex: "secret",
      },
    });

    await expect(adapter.listByKind("expense")).rejects.toThrow(
      ApplicationError,
    );
  });

  test("lança ApplicationError quando API retorna erro HTTP", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return new Response("Internal Server Error", { status: 500 });
      },
    });

    const adapter = new MecontrolaCategoryCatalogAdapter({
      baseUrl: `http://localhost:${server.port}`,
      gatewayAuth: {
        userId: "06edc407-4f63-42e8-b07c-946b9ef0a19c",
        gatewaySecretHex: "secret",
      },
    });

    await expect(adapter.listByKind("expense")).rejects.toThrow(
      ApplicationError,
    );
  });
});
