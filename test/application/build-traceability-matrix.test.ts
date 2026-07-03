import { describe, expect, test } from "bun:test";
import type { LoggerPort } from "../../src/application/ports/logger-port.ts";
import { BuildTraceabilityMatrixUseCase } from "../../src/application/use-cases/build-traceability-matrix.ts";
import { canonicalFactKeyHash } from "../../src/domain/consolidation/canonical-fact-key.ts";
import type { CanonicalFactKey } from "../../src/domain/consolidation/canonical-fact-key.ts";
import type { LegacySourceRef } from "../../src/domain/consolidation/types.ts";

const makeLogger = (): LoggerPort => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});

const userId = "06edc407-4f63-42e8-b07c-946b9ef0a19c";

const makeFactKey = (description: string): CanonicalFactKey => ({
  resource: "transaction",
  userId,
  occurredOn: "2026-01-10",
  normalizedDescription: description,
  normalizedAmountMinorUnits: 10000n,
  currency: "BRL",
  paymentContext: { kind: "bank-transfer", method: "pix" },
  installmentContext: { kind: "single" },
});

const makeSourceRef = (
  database: LegacySourceRef["database"],
  table: string,
  primaryKey: string,
): LegacySourceRef => ({ database, table, primaryKey });

describe("BuildTraceabilityMatrixUseCase", () => {
  test("mapeia source ref até destino publicado", () => {
    const sourceRef = makeSourceRef(
      "FinancialControlDB",
      "TransactionItem",
      "1",
    );
    const factKey = makeFactKey("supermercado");

    const useCase = new BuildTraceabilityMatrixUseCase(makeLogger());
    const matrix = useCase.execute({
      eligibilityStatus: "eligible",
      targetUserId: userId,
      sourceRefs: [sourceRef],
      transactions: [{ factKey, legacyRefs: [sourceRef] }],
      classified: [
        {
          transaction: { factKey } as never,
          categoryId: "cat-1",
          subcategoryId: "sub-1",
          paymentMethod: { kind: "pix" },
          suggestedByOpenRouter: false,
        },
      ],
      issues: [],
      publishedTransactions: [
        {
          remoteId: "remote-tx-1",
          factKeyHash: canonicalFactKeyHash(factKey),
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(matrix.rows).toHaveLength(1);
    const row = matrix.rows[0];
    expect(row?.consolidationStatus).toBe("included");
    expect(row?.classificationStatus).toBe("classified");
    expect(row?.remoteId).toBe("remote-tx-1");
    expect(row?.categoryId).toBe("cat-1");
  });

  test("marca source ref excluída com issue de bloqueio", () => {
    const sourceRef = makeSourceRef(
      "FinancialControlDB",
      "TransactionItem",
      "1",
    );

    const useCase = new BuildTraceabilityMatrixUseCase(makeLogger());
    const matrix = useCase.execute({
      eligibilityStatus: "eligible",
      targetUserId: userId,
      sourceRefs: [sourceRef],
      transactions: [],
      classified: [],
      issues: [
        {
          issueId: "issue-1",
          kind: "semantic-mismatch",
          severity: "blocking",
          legacyRefs: [sourceRef],
          reason: "Fato não pôde ser shaped.",
          evidence: {},
          blockedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const row = matrix.rows[0];
    expect(row?.consolidationStatus).toBe("excluded");
    expect(row?.issueKind).toBe("semantic-mismatch");
  });

  test("marca transação bloqueada na classificação", () => {
    const sourceRef = makeSourceRef(
      "FinancialControlDB",
      "TransactionItem",
      "1",
    );
    const factKey = makeFactKey("internet");

    const useCase = new BuildTraceabilityMatrixUseCase(makeLogger());
    const matrix = useCase.execute({
      eligibilityStatus: "eligible",
      targetUserId: userId,
      sourceRefs: [sourceRef],
      transactions: [{ factKey, legacyRefs: [sourceRef] }],
      classified: [],
      issues: [
        {
          issueId: "issue-1",
          kind: "unknown-payment-method",
          severity: "blocking",
          factKey,
          legacyRefs: [sourceRef],
          reason: "Método de pagamento desconhecido.",
          evidence: {},
          blockedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const row = matrix.rows[0];
    expect(row?.classificationStatus).toBe("blocked");
    expect(row?.issueKind).toBe("unknown-payment-method");
  });
});
