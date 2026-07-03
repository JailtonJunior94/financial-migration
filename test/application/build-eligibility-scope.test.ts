import { beforeEach, describe, expect, test } from "bun:test";
import type { LegacyUserCandidateSourcePort } from "../../src/application/ports/legacy-user-candidate-source-port.ts";
import type { LoggerPort } from "../../src/application/ports/logger-port.ts";
import { BuildEligibilityScopeUseCase } from "../../src/application/use-cases/build-eligibility-scope.ts";
import {
  createLegacyUserCandidate,
  createUserEvidence,
} from "../../src/domain/consolidation/eligibility.ts";
import type {
  LegacySourceRef,
  TargetUser,
} from "../../src/domain/consolidation/types.ts";

const targetUser: TargetUser = {
  id: "06edc407-4f63-42e8-b07c-946b9ef0a19c",
  email: "jailton.junior94@outlook.com",
  whatsappNumber: "+5511986896322",
  status: "ACTIVE",
};

const makeLogger = (): LoggerPort => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});

const makeRef = (
  database: LegacySourceRef["database"],
  table: string,
  primaryKey: string,
): LegacySourceRef => ({ database, table, primaryKey });

describe("BuildEligibilityScopeUseCase", () => {
  test("resolve elegível quando candidato tem nome Jailton e email matching", async () => {
    const ref = makeRef("FinancialControlDB", "Card", "card-1");
    const source: LegacyUserCandidateSourcePort = {
      loadCandidates: async () => [
        createLegacyUserCandidate(
          ref.database,
          ref.table,
          ref.primaryKey,
          "Jailton Junior",
          [
            createUserEvidence(ref, "name", "Jailton Junior"),
            createUserEvidence(ref, "email", "jailton.junior94@outlook.com"),
          ],
        ),
      ],
    };

    const useCase = new BuildEligibilityScopeUseCase(source, makeLogger());
    const result = await useCase.execute(targetUser);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("eligible");
      expect(result.value.matchedLegacyUsers).toEqual([ref]);
    }
  });

  test("resolve bloqueado quando candidato tem apenas nome Jailton", async () => {
    const ref = makeRef("FinancialControlDB", "Card", "card-1");
    const source: LegacyUserCandidateSourcePort = {
      loadCandidates: async () => [
        createLegacyUserCandidate(
          ref.database,
          ref.table,
          ref.primaryKey,
          "Jailton Junior",
          [createUserEvidence(ref, "name", "Jailton Junior")],
        ),
      ],
    };

    const useCase = new BuildEligibilityScopeUseCase(source, makeLogger());
    const result = await useCase.execute(targetUser);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("blocked_no_strong_signal");
    }
  });

  test("aplica regra afirmativa para AccountControlDB.Accounts", async () => {
    const ref = makeRef("AccountControlDB", "Accounts", "account-1");
    const source: LegacyUserCandidateSourcePort = {
      loadCandidates: async () => [
        createLegacyUserCandidate(
          ref.database,
          ref.table,
          ref.primaryKey,
          "Conta Corrente",
          [],
        ),
      ],
    };

    const useCase = new BuildEligibilityScopeUseCase(source, makeLogger());
    const result = await useCase.execute(targetUser);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("eligible");
      expect(
        result.value.evidence.some(
          (e) => e.signalKind === "affirmative_account_rule",
        ),
      ).toBe(true);
    }
  });

  test("retorna erro de aplicação quando fonte de candidatos falha", async () => {
    const source: LegacyUserCandidateSourcePort = {
      loadCandidates: async () => {
        throw new Error("connection lost");
      },
    };

    const useCase = new BuildEligibilityScopeUseCase(source, makeLogger());
    const result = await useCase.execute(targetUser);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SOURCE_READ_FAILURE");
    }
  });

  test("propaga erro de domínio quando target user é inválido", async () => {
    const source: LegacyUserCandidateSourcePort = {
      loadCandidates: async () => [],
    };

    const useCase = new BuildEligibilityScopeUseCase(source, makeLogger());
    const result = await useCase.execute({ ...targetUser, id: "não-uuid" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("USER_NOT_ELIGIBLE");
    }
  });
});
