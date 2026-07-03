import { describe, expect, test } from "bun:test";
import type { ClockPort } from "../../src/application/ports/clock-port.ts";
import type { LoggerPort } from "../../src/application/ports/logger-port.ts";
import type { ProgressStorePort } from "../../src/application/ports/progress-store-port.ts";
import type { ReviewArtifactPort } from "../../src/application/ports/review-artifact-port.ts";
import type { TransactionTargetPort } from "../../src/application/ports/transaction-target-port.ts";
import { PublishTransactionsUseCase } from "../../src/application/use-cases/publish-transactions.ts";
import type { ClassifiedTransaction } from "../../src/domain/classification/types.ts";
import { createCanonicalFactKey } from "../../src/domain/consolidation/canonical-fact-key.ts";
import { createInstallmentPlan } from "../../src/domain/consolidation/installment-plan.ts";
import { createMoneyAmount } from "../../src/domain/consolidation/money-amount.ts";
import { createOccurrenceDate } from "../../src/domain/consolidation/occurrence-date.ts";
import type {
  ConsolidatedTransaction,
  LegacySourceRef,
  PaymentMethod,
} from "../../src/domain/consolidation/types.ts";
import type {
  PublishableTransaction,
  RemoteTransactionMatch,
  RemoteTransactionRecord,
} from "../../src/domain/publication/types.ts";

const targetUserId = "06edc407-4f63-42e8-b07c-946b9ef0a19c";
const legacyRef: LegacySourceRef = {
  database: "FinancialControlDB",
  table: "TransactionItem",
  primaryKey: "1",
};

const fixedClock: ClockPort = {
  nowIso: () => "2026-01-15T12:00:00.000Z",
};

const makeLogger = (): LoggerPort => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});

const makeMoney = (minorUnits: bigint) => {
  const result = createMoneyAmount(minorUnits, 2, "BRL");
  if (!result.ok) throw new Error("Invalid money amount");
  return result.value;
};

const makeFactKey = (description: string) => {
  const result = createCanonicalFactKey(
    "transaction",
    targetUserId,
    "2026-01-15",
    description,
    makeMoney(1000n),
    { kind: "bank-transfer", method: "pix" },
    { kind: "single" },
  );
  if (!result.ok) throw new Error("Invalid fact key");
  return result.value;
};

const makeTransaction = (
  description: string,
  paymentMethod: PaymentMethod,
): ConsolidatedTransaction => {
  const dateResult = createOccurrenceDate("2026-01-15", "TransactionDate");
  if (!dateResult.ok) throw new Error("Invalid date");
  const planResult = createInstallmentPlan(description, 1, 1);
  if (!planResult.ok) throw new Error("Invalid plan");

  return {
    factKey: makeFactKey(description),
    kind: "expense",
    occurredOn: dateResult.value,
    competence: "2026-01",
    description,
    amount: makeMoney(1000n),
    paymentMethod,
    installmentPlan: planResult.value,
    legacyRefs: [legacyRef],
    sourceSummary: {
      primarySource: "FinancialControlDB",
      secondarySources: [],
      notes: [],
    },
  };
};

const makeClassified = (
  description: string,
  paymentMethod: PaymentMethod,
  subcategoryId?: string,
): ClassifiedTransaction => {
  const classified: ClassifiedTransaction = {
    transaction: makeTransaction(description, paymentMethod),
    categoryId: "cat-expense",
    paymentMethod,
    suggestedByOpenRouter: false,
  };

  if (subcategoryId !== undefined) {
    return { ...classified, subcategoryId };
  }

  return classified;
};

class InMemoryTransactionTarget implements TransactionTargetPort {
  readonly created: {
    readonly input: PublishableTransaction;
    readonly idempotencyKey: string;
  }[] = [];

  constructor(
    private readonly existing: RemoteTransactionMatch[] = [],
    private readonly failOnCreate = false,
  ) {}

  async findByBusinessKey(): Promise<RemoteTransactionMatch | undefined> {
    return this.existing[0];
  }

  async create(
    input: PublishableTransaction,
    idempotencyKey: string,
  ): Promise<RemoteTransactionRecord> {
    if (this.failOnCreate) {
      throw new Error("connection refused");
    }

    this.created.push({ input, idempotencyKey });
    return {
      remoteId: `remote-${input.description}`,
      factKeyHash: "ignored",
      createdAt: fixedClock.nowIso(),
    };
  }
}

class InMemoryProgressStore implements ProgressStorePort {
  private readonly records = new Map<string, unknown>();

  async read(scope: string): Promise<undefined> {
    return this.records.get(scope) as undefined;
  }

  async write(scope: string, value: unknown): Promise<void> {
    this.records.set(scope, value);
  }
}

class InMemoryReviewArtifactStore implements ReviewArtifactPort {
  readonly issues: { scope: string; issue: unknown }[] = [];

  async append(scope: string, issue: unknown): Promise<void> {
    this.issues.push({ scope, issue });
  }
}

const makeUseCase = (
  target: TransactionTargetPort,
  progressStore: ProgressStorePort = new InMemoryProgressStore(),
  reviewArtifactStore: ReviewArtifactPort = new InMemoryReviewArtifactStore(),
) =>
  new PublishTransactionsUseCase({
    transactionTarget: target,
    progressStore,
    reviewArtifactStore,
    clock: fixedClock,
    logger: makeLogger(),
  });

describe("PublishTransactionsUseCase", () => {
  test("publica transação quando não existe no destino", async () => {
    const target = new InMemoryTransactionTarget();
    const useCase = makeUseCase(target);
    const classified = makeClassified("Compra no supermercado", {
      kind: "pix",
    });

    const result = await useCase.execute({
      scope: "transaction_publication",
      userId: targetUserId,
      classified: [classified],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.published).toHaveLength(1);
    expect(result.value.skipped).toHaveLength(0);
    expect(result.value.blocked).toHaveLength(0);
    expect(target.created).toHaveLength(1);
    expect(target.created[0]?.input.description).toBe("Compra no supermercado");
    expect(target.created[0]?.idempotencyKey).toMatch(/^[a-f0-9]{64}$/);
  });

  test("pula transação quando destino já possui equivalente", async () => {
    const classified = makeClassified("Compra no supermercado", {
      kind: "pix",
    });
    const target = new InMemoryTransactionTarget([
      {
        remoteId: "remote-123",
        factKeyHash: "ignored",
        equivalent: true,
      },
    ]);
    const useCase = makeUseCase(target);

    const result = await useCase.execute({
      scope: "transaction_publication",
      userId: targetUserId,
      classified: [classified],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.published).toHaveLength(0);
    expect(result.value.skipped).toHaveLength(1);
    expect(result.value.blocked).toHaveLength(0);
    expect(target.created).toHaveLength(0);
    expect(result.value.skipped[0]?.remoteId).toBe("remote-123");
  });

  test("bloqueia transação quando destino possui divergência material", async () => {
    const classified = makeClassified("Compra no supermercado", {
      kind: "pix",
    });
    const target = new InMemoryTransactionTarget([
      {
        remoteId: "remote-456",
        factKeyHash: "ignored",
        equivalent: false,
      },
    ]);
    const reviewStore = new InMemoryReviewArtifactStore();
    const useCase = makeUseCase(target, undefined, reviewStore);

    const result = await useCase.execute({
      scope: "transaction_publication",
      userId: targetUserId,
      classified: [classified],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.published).toHaveLength(0);
    expect(result.value.skipped).toHaveLength(0);
    expect(result.value.blocked).toHaveLength(1);
    expect(target.created).toHaveLength(0);

    const issue = result.value.blocked[0];
    expect(issue?.kind).toBe("destination-divergence");
    expect(reviewStore.issues).toHaveLength(1);
  });

  test("bloqueia transação com método de pagamento desconhecido", async () => {
    const target = new InMemoryTransactionTarget();
    const useCase = makeUseCase(target);
    const classified = makeClassified("Compra no supermercado", {
      kind: "unknown",
    });

    const result = await useCase.execute({
      scope: "transaction_publication",
      userId: targetUserId,
      classified: [classified],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.published).toHaveLength(0);
    expect(result.value.skipped).toHaveLength(0);
    expect(result.value.blocked).toHaveLength(1);
    expect(target.created).toHaveLength(0);

    const issue = result.value.blocked[0];
    expect(issue?.kind).toBe("unknown-payment-method");
  });

  test("persiste progresso operacional ao concluir", async () => {
    const target = new InMemoryTransactionTarget();
    const progressStore = new InMemoryProgressStore();
    const useCase = makeUseCase(target, progressStore);

    const result = await useCase.execute({
      scope: "transaction_publication",
      userId: targetUserId,
      classified: [
        makeClassified("Compra A", { kind: "pix" }),
        makeClassified("Compra B", { kind: "pix" }),
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const progress = await progressStore.read("transaction_publication");
    expect(progress).toBeDefined();
    expect(progress).toMatchObject({
      scope: "transaction_publication",
      stage: "transaction_publication",
      processedCount: 2,
      publishedCount: 2,
      skippedCount: 0,
      blockedCount: 0,
      reconciledCount: 0,
    });
  });

  test("retorna erro tipado quando criação remota falha", async () => {
    const target = new InMemoryTransactionTarget([], true);
    const useCase = makeUseCase(target);

    const result = await useCase.execute({
      scope: "transaction_publication",
      userId: targetUserId,
      classified: [makeClassified("Compra", { kind: "pix" })],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTEGRATION_FAILURE");
    }
  });

  test("preserva subcategoryId no payload publicado quando informado", async () => {
    const target = new InMemoryTransactionTarget();
    const useCase = makeUseCase(target);

    await useCase.execute({
      scope: "transaction_publication",
      userId: targetUserId,
      classified: [
        makeClassified("Compra no supermercado", { kind: "pix" }, "sub-1"),
      ],
    });

    expect(target.created[0]?.input.subcategoryId).toBe("sub-1");
  });
});
