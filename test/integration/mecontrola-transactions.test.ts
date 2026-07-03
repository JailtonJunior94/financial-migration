import { afterEach, describe, expect, test } from "bun:test";
import { MecontrolaTransactionTargetAdapter } from "../../src/adapters/http/mecontrola-transactions.ts";
import { ApplicationError } from "../../src/domain/common/errors.ts";

const targetUserId = "06edc407-4f63-42e8-b07c-946b9ef0a19c";

const makeAdapter = (baseUrl: string) =>
  new MecontrolaTransactionTargetAdapter({
    baseUrl,
    gatewayAuth: {
      userId: targetUserId,
      gatewaySecretHex: "secret",
    },
  });

describe("MecontrolaTransactionTargetAdapter integration", () => {
  let server: ReturnType<typeof Bun.serve> | undefined;

  afterEach(() => {
    server?.stop();
    server = undefined;
  });

  test("findByBusinessKey encontra transação por external_id", async () => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/api/v1/transactions") {
          return Response.json({
            items: [
              {
                id: "tx-123",
                user_id: targetUserId,
                kind: "expense",
                occurred_on: "2026-01-15",
                competence: "2026-01",
                description: "Supermercado",
                amount_minor_units: "1000",
                scale: 2,
                currency: "BRL",
                category_id: "cat-1",
                payment_context: { kind: "bank-transfer", method: "pix" },
                installment_plan: {
                  group_key: "group-1",
                  current_installment: 1,
                  total_installments: 1,
                },
                external_id: "fact-hash-1",
                created_at: "2026-01-15T12:00:00.000Z",
              },
            ],
          });
        }
        return new Response("not found", { status: 404 });
      },
    });

    const adapter = makeAdapter(`http://localhost:${server.port}`);
    const match = await adapter.findByBusinessKey({
      factKeyHash: "fact-hash-1",
      userId: targetUserId,
    });

    expect(match).toBeDefined();
    expect(match?.remoteId).toBe("tx-123");
    expect(match?.equivalent).toBe(true);
  });

  test("findByBusinessKey retorna undefined quando não há correspondência", async () => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/api/v1/transactions") {
          return Response.json({
            items: [
              {
                id: "tx-456",
                kind: "expense",
                occurred_on: "2026-01-15",
                competence: "2026-01",
                description: "Farmácia",
                amount_minor_units: "500",
                scale: 2,
                currency: "BRL",
                category_id: "cat-2",
                payment_context: { kind: "bank-transfer", method: "pix" },
                installment_plan: {
                  group_key: "group-2",
                  current_installment: 1,
                  total_installments: 1,
                },
                external_id: "fact-hash-2",
                created_at: "2026-01-15T12:00:00.000Z",
              },
            ],
          });
        }
        return new Response("not found", { status: 404 });
      },
    });

    const adapter = makeAdapter(`http://localhost:${server.port}`);
    const match = await adapter.findByBusinessKey({
      factKeyHash: "fact-hash-1",
      userId: targetUserId,
    });

    expect(match).toBeUndefined();
  });

  test("findByBusinessKey percorre paginação por cursor", async () => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/api/v1/transactions") {
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
                  id: "tx-789",
                  kind: "expense",
                  occurred_on: "2026-01-15",
                  competence: "2026-01",
                  description: "Supermercado",
                  amount_minor_units: "1000",
                  scale: 2,
                  currency: "BRL",
                  category_id: "cat-1",
                  payment_context: { kind: "bank-transfer", method: "pix" },
                  installment_plan: {
                    group_key: "group-1",
                    current_installment: 1,
                    total_installments: 1,
                  },
                  external_id: "fact-hash-3",
                  created_at: "2026-01-15T12:00:00.000Z",
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
      factKeyHash: "fact-hash-3",
      userId: targetUserId,
    });

    expect(match?.remoteId).toBe("tx-789");
  });

  test("create envia corpo e headers esperados", async () => {
    const receivedHeaders: Record<string, string> = {};
    let receivedBody: Record<string, unknown> | undefined;

    server = Bun.serve({
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        if (
          url.pathname === "/api/v1/transactions" &&
          request.method === "POST"
        ) {
          request.headers.forEach((value, key) => {
            receivedHeaders[key] = value;
          });
          receivedBody = (await request.json()) as Record<string, unknown>;
          return Response.json(
            {
              id: "new-tx-id",
              kind: "expense",
              occurred_on: "2026-01-15",
              competence: "2026-01",
              description: "Supermercado",
              amount_minor_units: "1000",
              scale: 2,
              currency: "BRL",
              category_id: "cat-1",
              payment_context: { kind: "bank-transfer", method: "pix" },
              installment_plan: {
                group_key: "group-1",
                current_installment: 1,
                total_installments: 1,
              },
              external_id: "fact-hash-1",
              created_at: "2026-01-15T12:00:00.000Z",
            },
            { status: 201 },
          );
        }
        return new Response("not found", { status: 404 });
      },
    });

    const adapter = makeAdapter(`http://localhost:${server.port}`);
    const factKey = {
      resource: "transaction" as const,
      userId: targetUserId,
      occurredOn: "2026-01-15",
      normalizedDescription: "supermercado",
      normalizedAmountMinorUnits: 1000n,
      currency: "BRL",
      paymentContext: {
        kind: "bank-transfer" as const,
        method: "pix" as const,
      },
      installmentContext: { kind: "single" as const },
    };

    const record = await adapter.create(
      {
        factKey,
        kind: "expense",
        occurredOn: "2026-01-15",
        competence: "2026-01",
        description: "Supermercado",
        amount: {
          minorUnits: 1000n,
          scale: 2,
          currency: "BRL",
        },
        categoryId: "cat-1",
        paymentContext: { kind: "bank-transfer", method: "pix" },
        installmentPlan: {
          groupKey: "group-1",
          currentInstallment: 1,
          totalInstallments: 1,
        },
        legacyRefs: [],
      },
      "idempotency-key-1",
    );

    expect(record.remoteId).toBe("new-tx-id");
    expect(receivedHeaders["x-user-id"]).toBe(targetUserId);
    expect(receivedHeaders["x-gateway-timestamp"]).toBeDefined();
    expect(receivedHeaders["x-gateway-auth"]).toBeDefined();
    expect(receivedHeaders["idempotency-key"]).toBe("idempotency-key-1");
    expect(receivedHeaders["content-type"]).toBe("application/json");

    expect(receivedBody?.kind).toBe("expense");
    expect(receivedBody?.external_id).toBeDefined();
    expect(receivedBody?.amount_minor_units).toBe("1000");
    expect(receivedBody?.payment_context).toEqual({
      kind: "bank-transfer",
      method: "pix",
    });
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
          factKey: {
            resource: "transaction",
            userId: targetUserId,
            occurredOn: "2026-01-15",
            normalizedDescription: "supermercado",
            normalizedAmountMinorUnits: 1000n,
            currency: "BRL",
            paymentContext: { kind: "bank-transfer", method: "pix" },
            installmentContext: { kind: "single" },
          },
          kind: "expense",
          occurredOn: "2026-01-15",
          competence: "2026-01",
          description: "Supermercado",
          amount: {
            minorUnits: 1000n,
            scale: 2,
            currency: "BRL",
          },
          categoryId: "cat-1",
          paymentContext: { kind: "bank-transfer", method: "pix" },
          installmentPlan: {
            groupKey: "group-1",
            currentInstallment: 1,
            totalInstallments: 1,
          },
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
          factKey: {
            resource: "transaction",
            userId: targetUserId,
            occurredOn: "2026-01-15",
            normalizedDescription: "supermercado",
            normalizedAmountMinorUnits: 1000n,
            currency: "BRL",
            paymentContext: { kind: "bank-transfer", method: "pix" },
            installmentContext: { kind: "single" },
          },
          kind: "expense",
          occurredOn: "2026-01-15",
          competence: "2026-01",
          description: "Supermercado",
          amount: {
            minorUnits: 1000n,
            scale: 2,
            currency: "BRL",
          },
          categoryId: "cat-1",
          paymentContext: { kind: "bank-transfer", method: "pix" },
          installmentPlan: {
            groupKey: "group-1",
            currentInstallment: 1,
            totalInstallments: 1,
          },
          legacyRefs: [],
        },
        "idempotency-key-1",
      ),
    ).rejects.toThrow(ApplicationError);
  });

  test("findByBusinessKey faz retry em falha transiente", async () => {
    let attempts = 0;
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/api/v1/transactions") {
          attempts += 1;
          if (attempts < 3) {
            return new Response("connection refused", { status: 503 });
          }
          return Response.json({
            items: [
              {
                id: "tx-retry",
                kind: "expense",
                occurred_on: "2026-01-15",
                competence: "2026-01",
                description: "Supermercado",
                amount_minor_units: "1000",
                scale: 2,
                currency: "BRL",
                category_id: "cat-1",
                payment_context: { kind: "bank-transfer", method: "pix" },
                installment_plan: {
                  group_key: "group-1",
                  current_installment: 1,
                  total_installments: 1,
                },
                external_id: "fact-hash-retry",
                created_at: "2026-01-15T12:00:00.000Z",
              },
            ],
          });
        }
        return new Response("not found", { status: 404 });
      },
    });

    const adapter = makeAdapter(`http://localhost:${server.port}`);
    const match = await adapter.findByBusinessKey({
      factKeyHash: "fact-hash-retry",
      userId: targetUserId,
    });

    expect(attempts).toBeGreaterThanOrEqual(3);
    expect(match?.remoteId).toBe("tx-retry");
  });
});
