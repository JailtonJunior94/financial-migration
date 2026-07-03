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

const makeScope = (): UserEligibilityScope => ({
  targetUser: {
    id: targetUserId,
    email: "jailton.junior94@outlook.com",
    whatsappNumber: "+5511986896322",
    status: "ACTIVE",
  },
  matchedLegacyUsers: [],
  evidence: [],
  status: "eligible",
});

const makeLogger = (): LoggerPort => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});

class FixtureFactReader implements LegacyFinancialFactReaderPort {
  constructor(private readonly facts: LegacyFact[]) {}

  async readEligibleFacts(
    input: ReadEligibleFactsInput,
  ): Promise<LegacyFactBatch> {
    const cursor = input.cursor ? Number(input.cursor) : 0;
    const batchSize = input.batchSize;
    const batch = this.facts.slice(cursor, cursor + batchSize);
    const nextCursor =
      cursor + batch.length < this.facts.length
        ? String(cursor + batch.length)
        : undefined;

    return { facts: batch, nextCursor };
  }
}

describe("consolidation integration", () => {
  test("fluxo elegibilidade + consolidação de cartão e não-cartão", async () => {
    const facts: LegacyFact[] = [
      {
        ref: {
          database: "FinancialControlDB",
          table: "InvoiceItem",
          primaryKey: "1",
        },
        fields: {
          description: "Supermercado Central",
          amount: 200,
          purchaseDate: "2026-01-10",
          installmentNumber: 1,
          totalInstallments: 2,
        },
      },
      {
        ref: {
          database: "FinancialControlDB",
          table: "TransactionItem",
          primaryKey: "2",
        },
        fields: {
          description: "Transferência salarial",
          amount: 5000,
          transactionDate: "2026-01-05",
          kind: "income",
        },
      },
      {
        ref: {
          database: "AccountControlDB",
          table: "Accounts",
          primaryKey: "3",
        },
        fields: {
          name: "Conta Corrente",
          amount: -150,
          accountDate: "2026-01-03",
        },
      },
    ];

    const useCase = new ConsolidateFinancialFactsUseCase(
      new FixtureFactReader(facts),
      makeLogger(),
    );

    const result = await useCase.execute({
      eligibilityScope: makeScope(),
      currency: "BRL",
      cardBusinessKeys: { "1": "visa-1234" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.transactions).toHaveLength(4);
    expect(result.value.issues).toHaveLength(0);

    const cardTransactions = result.value.transactions.filter(
      (t) => t.paymentMethod.kind === "credit_card",
    );
    expect(cardTransactions).toHaveLength(2);
    const firstCardTransaction = cardTransactions[0];
    if (!firstCardTransaction) return;

    expect(firstCardTransaction.installmentPlan.totalInstallments).toBe(2);

    const incomeTransaction = result.value.transactions.find(
      (t) => t.kind === "income" && t.paymentMethod.kind === "ted",
    );
    expect(incomeTransaction).toBeDefined();

    const accountTransaction = result.value.transactions.find(
      (t) => t.paymentMethod.kind === "other_bank_transfer",
    );
    expect(accountTransaction).toBeDefined();
  });

  test("detecta conflito material em fixture controlada", async () => {
    const facts: LegacyFact[] = [
      {
        ref: {
          database: "FinancialControlDB",
          table: "TransactionItem",
          primaryKey: "1",
        },
        fields: {
          description: "Lançamento duplicado",
          amount: 100,
          transactionDate: "2026-01-10",
          kind: "expense",
        },
      },
      {
        ref: {
          database: "FinancialControlDB",
          table: "TransactionItem",
          primaryKey: "2",
        },
        fields: {
          description: "Lançamento duplicado",
          amount: 100,
          transactionDate: "2026-01-10",
          kind: "income",
        },
      },
    ];

    const useCase = new ConsolidateFinancialFactsUseCase(
      new FixtureFactReader(facts),
      makeLogger(),
    );

    const result = await useCase.execute({
      eligibilityScope: makeScope(),
      currency: "BRL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.transactions).toHaveLength(0);
    expect(result.value.issues).toHaveLength(1);
    const conflictIssue = result.value.issues[0];
    if (!conflictIssue) return;

    expect(conflictIssue.kind).toBe("reconciliation-conflict");
  });
});
