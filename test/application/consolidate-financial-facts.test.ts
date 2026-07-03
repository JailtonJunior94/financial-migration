import { describe, expect, test } from "bun:test";
import type {
  LegacyFact,
  LegacyFactBatch,
  LegacyFinancialFactReaderPort,
  ReadEligibleFactsInput,
} from "../../src/application/ports/legacy-financial-fact-reader-port.ts";
import type { LoggerPort } from "../../src/application/ports/logger-port.ts";
import { ConsolidateFinancialFactsUseCase } from "../../src/application/use-cases/consolidate-financial-facts.ts";
import type { UserEligibilityScope } from "../../src/domain/consolidation/types.ts";

const targetUserId = "06edc407-4f63-42e8-b07c-946b9ef0a19c";

const makeScope = (
  status: UserEligibilityScope["status"],
): UserEligibilityScope => ({
  targetUser: {
    id: targetUserId,
    email: "jailton.junior94@outlook.com",
    whatsappNumber: "+5511986896322",
    status: "ACTIVE",
  },
  matchedLegacyUsers: [],
  evidence: [],
  status,
});

const makeLogger = (): LoggerPort => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});

class InMemoryFactReader implements LegacyFinancialFactReaderPort {
  constructor(private readonly batches: LegacyFactBatch[]) {}

  async readEligibleFacts(
    _input: ReadEligibleFactsInput,
  ): Promise<LegacyFactBatch> {
    const batch = this.batches.shift();
    if (!batch) {
      return { facts: [] };
    }
    return batch;
  }
}

const makeInvoiceItem = (
  primaryKey: string,
  fields: Record<string, unknown>,
): LegacyFact => ({
  ref: { database: "FinancialControlDB", table: "InvoiceItem", primaryKey },
  fields,
});

const makeTransactionItem = (
  primaryKey: string,
  fields: Record<string, unknown>,
): LegacyFact => ({
  ref: { database: "FinancialControlDB", table: "TransactionItem", primaryKey },
  fields,
});

describe("ConsolidateFinancialFactsUseCase", () => {
  test("retorna vazio quando escopo não é elegível", async () => {
    const useCase = new ConsolidateFinancialFactsUseCase(
      new InMemoryFactReader([]),
      makeLogger(),
    );

    const result = await useCase.execute({
      eligibilityScope: makeScope("blocked_no_strong_signal"),
      currency: "BRL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.transactions).toHaveLength(0);
    expect(result.value.issues).toHaveLength(0);
  });

  test("consolida InvoiceItem e TransactionItem em um lote", async () => {
    const reader = new InMemoryFactReader([
      {
        facts: [
          makeInvoiceItem("ii-1", {
            description: "Supermercado",
            amount: 100,
            purchaseDate: "2026-01-10",
          }),
          makeTransactionItem("ti-1", {
            description: "Pagamento via pix",
            amount: 50,
            transactionDate: "2026-01-11",
          }),
        ],
      },
    ]);

    const useCase = new ConsolidateFinancialFactsUseCase(reader, makeLogger());

    const result = await useCase.execute({
      eligibilityScope: makeScope("eligible"),
      currency: "BRL",
      cardBusinessKeys: { "ii-1": "visa-1234" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.transactions).toHaveLength(2);
    expect(result.value.issues).toHaveLength(0);

    const cardTransaction = result.value.transactions.find(
      (t) => t.paymentMethod.kind === "credit_card",
    );
    expect(cardTransaction).toBeDefined();
    expect(cardTransaction?.cardBinding).toBe("visa-1234");

    const pixTransaction = result.value.transactions.find(
      (t) => t.paymentMethod.kind === "pix",
    );
    expect(pixTransaction).toBeDefined();
  });

  test("reconcilia fatos equivalentes cross-source", async () => {
    const reader = new InMemoryFactReader([
      {
        facts: [
          makeTransactionItem("ti-1", {
            description: "Internet",
            amount: 100,
            transactionDate: "2026-01-10",
          }),
          {
            ref: {
              database: "AccountControlDB",
              table: "Accounts",
              primaryKey: "acc-1",
            },
            fields: {
              name: "Internet",
              amount: 100,
              accountDate: "2026-01-10",
            },
          },
        ],
      },
    ]);

    const useCase = new ConsolidateFinancialFactsUseCase(reader, makeLogger());

    const result = await useCase.execute({
      eligibilityScope: makeScope("eligible"),
      currency: "BRL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.transactions).toHaveLength(1);
    const reconciled = result.value.transactions[0];
    if (!reconciled) return;

    expect(reconciled.legacyRefs).toHaveLength(2);
  });

  test("pagina leitura até esgotar cursor", async () => {
    const reader = new InMemoryFactReader([
      {
        facts: [
          makeInvoiceItem("ii-1", {
            description: "Compra 1",
            amount: 10,
            purchaseDate: "2026-01-01",
          }),
        ],
        nextCursor: "page-2",
      },
      {
        facts: [
          makeInvoiceItem("ii-2", {
            description: "Compra 2",
            amount: 20,
            purchaseDate: "2026-01-02",
          }),
        ],
      },
    ]);

    const useCase = new ConsolidateFinancialFactsUseCase(reader, makeLogger());

    const result = await useCase.execute({
      eligibilityScope: makeScope("eligible"),
      currency: "BRL",
      cardBusinessKeys: { "ii-1": "visa-1234", "ii-2": "visa-1234" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.transactions).toHaveLength(2);
  });

  test("retorna erro quando leitura falha", async () => {
    const failingReader: LegacyFinancialFactReaderPort = {
      readEligibleFacts: async () => {
        throw new Error("connection lost");
      },
    };

    const useCase = new ConsolidateFinancialFactsUseCase(
      failingReader,
      makeLogger(),
    );

    const result = await useCase.execute({
      eligibilityScope: makeScope("eligible"),
      currency: "BRL",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SOURCE_READ_FAILURE");
    }
  });

  test("gera issue quando InvoiceItem não tem cardBusinessKey", async () => {
    const reader = new InMemoryFactReader([
      {
        facts: [
          makeInvoiceItem("ii-1", {
            description: "Supermercado",
            amount: 100,
            purchaseDate: "2026-01-10",
          }),
        ],
      },
    ]);

    const useCase = new ConsolidateFinancialFactsUseCase(reader, makeLogger());

    const result = await useCase.execute({
      eligibilityScope: makeScope("eligible"),
      currency: "BRL",
      cardBusinessKeys: {},
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.transactions).toHaveLength(0);
    expect(result.value.issues).toHaveLength(1);
  });
});
