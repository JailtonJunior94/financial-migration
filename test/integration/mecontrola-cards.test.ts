import { afterEach, describe, expect, test } from "bun:test";
import { MecontrolaCardTargetAdapter } from "../../src/adapters/http/mecontrola-cards.ts";
import { ApplicationError } from "../../src/domain/common/errors.ts";

const targetUserId = "06edc407-4f63-42e8-b07c-946b9ef0a19c";

const makeAdapter = (baseUrl: string) =>
  new MecontrolaCardTargetAdapter({
    baseUrl,
    gatewayAuth: {
      userId: targetUserId,
      gatewaySecretHex: "secret",
    },
  });

describe("MecontrolaCardTargetAdapter integration", () => {
  let server: ReturnType<typeof Bun.serve> | undefined;

  afterEach(() => {
    server?.stop();
    server = undefined;
  });

  test("findByBusinessKey encontra cartão equivalente", async () => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/api/v1/cards") {
          return Response.json({
            items: [
              {
                id: "card-123",
                user_id: targetUserId,
                nickname: "Nu Pessoal",
                bank: "nubank",
                closing_day: 3,
                due_day: 10,
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            ],
          });
        }
        return new Response("not found", { status: 404 });
      },
    });

    const adapter = makeAdapter(`http://localhost:${server.port}`);
    const match = await adapter.findByBusinessKey({
      businessKey: "nubank",
      userId: targetUserId,
    });

    expect(match).toBeDefined();
    expect(match?.remoteId).toBe("card-123");
    expect(match?.businessKey).toBe("nubank");
  });

  test("findByBusinessKey retorna undefined quando não há correspondência", async () => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/api/v1/cards") {
          return Response.json({
            items: [
              {
                id: "card-456",
                user_id: targetUserId,
                nickname: "Outro",
                bank: "outrobanco",
                due_day: 5,
                created_at: "2026-01-01T00:00:00.000Z",
              },
            ],
          });
        }
        return new Response("not found", { status: 404 });
      },
    });

    const adapter = makeAdapter(`http://localhost:${server.port}`);
    const match = await adapter.findByBusinessKey({
      businessKey: "nubank",
      userId: targetUserId,
    });

    expect(match).toBeUndefined();
  });

  test("findByBusinessKey percorre paginação por cursor", async () => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/api/v1/cards") {
          const cursor = url.searchParams.get("cursor");
          if (!cursor) {
            return Response.json({
              items: [],
              next_cursor: "page-2",
            });
          }
          if (cursor === "page-2") {
            return Response.json({
              items: [
                {
                  id: "card-789",
                  user_id: targetUserId,
                  nickname: "Nu Pessoal",
                  bank: "nubank",
                  due_day: 10,
                  created_at: "2026-01-01T00:00:00.000Z",
                },
              ],
            });
          }
        }
        return new Response("not found", { status: 404 });
      },
    });

    const adapter = makeAdapter(`http://localhost:${server.port}`);
    const match = await adapter.findByBusinessKey({
      businessKey: "nubank",
      userId: targetUserId,
    });

    expect(match?.remoteId).toBe("card-789");
  });

  test("create envia corpo e headers esperados", async () => {
    const receivedHeaders: Record<string, string> = {};
    let receivedBody: Record<string, unknown> | undefined;

    server = Bun.serve({
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/api/v1/cards" && request.method === "POST") {
          request.headers.forEach((value, key) => {
            receivedHeaders[key] = value;
          });
          receivedBody = (await request.json()) as Record<string, unknown>;
          return Response.json(
            {
              id: "new-card-id",
              user_id: targetUserId,
              nickname: "Nu Pessoal",
              bank: "Nubank",
              due_day: 10,
              created_at: "2026-01-15T12:00:00.000Z",
            },
            { status: 201 },
          );
        }
        return new Response("not found", { status: 404 });
      },
    });

    const adapter = makeAdapter(`http://localhost:${server.port}`);
    const record = await adapter.create(
      {
        businessKey: "nubank",
        nickname: "Nu Pessoal",
        bank: "Nubank",
        dueDay: 10,
        legacyRefs: [],
      },
      "idempotency-key-1",
    );

    expect(record.remoteId).toBe("new-card-id");
    expect(record.businessKey).toBe("nubank");
    expect(record.createdAt).toBe("2026-01-15T12:00:00.000Z");

    expect(receivedHeaders["x-user-id"]).toBe(targetUserId);
    expect(receivedHeaders["x-gateway-timestamp"]).toBeDefined();
    expect(receivedHeaders["x-gateway-auth"]).toBeDefined();
    expect(receivedHeaders["idempotency-key"]).toBe("idempotency-key-1");
    expect(receivedHeaders["content-type"]).toBe("application/json");

    expect(receivedBody?.nickname).toBe("Nu Pessoal");
    expect(receivedBody?.bank).toBe("Nubank");
    expect(receivedBody?.due_day).toBe(10);
  });

  test("create lança ApplicationError quando API retorna erro", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return new Response("Conflict", { status: 409 });
      },
    });

    const adapter = makeAdapter(`http://localhost:${server.port}`);

    await expect(
      adapter.create(
        {
          businessKey: "nubank",
          nickname: "Nu Pessoal",
          bank: "Nubank",
          dueDay: 10,
          legacyRefs: [],
        },
        "idempotency-key-1",
      ),
    ).rejects.toThrow(ApplicationError);
  });

  test("create lança ApplicationError quando resposta não segue contrato", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({ unexpected: true }, { status: 201 });
      },
    });

    const adapter = makeAdapter(`http://localhost:${server.port}`);

    await expect(
      adapter.create(
        {
          businessKey: "nubank",
          nickname: "Nu Pessoal",
          bank: "Nubank",
          dueDay: 10,
          legacyRefs: [],
        },
        "idempotency-key-1",
      ),
    ).rejects.toThrow(ApplicationError);
  });
});
