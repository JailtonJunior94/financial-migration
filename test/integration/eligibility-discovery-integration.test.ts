import { describe, expect, test } from "bun:test";
import type { LegacyUserCandidateSourcePort } from "../../src/application/ports/legacy-user-candidate-source-port.ts";
import type { LoggerPort } from "../../src/application/ports/logger-port.ts";
import { BuildEligibilityScopeUseCase } from "../../src/application/use-cases/build-eligibility-scope.ts";
import {
  createLegacyUserCandidate,
  createUserEvidence,
} from "../../src/domain/consolidation/eligibility.ts";
import type { TargetUser } from "../../src/domain/consolidation/types.ts";

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

describe("eligibility discovery integration", () => {
  test("fluxo discovery controlado -> elegível com segundo sinal forte", async () => {
    const cardRef = {
      database: "FinancialControlDB" as const,
      table: "Card",
      primaryKey: "1",
    };
    const invoiceItemRef = {
      database: "FinancialControlDB" as const,
      table: "InvoiceItem",
      primaryKey: "100",
    };
    const source: LegacyUserCandidateSourcePort = {
      loadCandidates: async () => [
        createLegacyUserCandidate(
          cardRef.database,
          cardRef.table,
          cardRef.primaryKey,
          "Jailton Junior",
          [
            createUserEvidence(cardRef, "name", "Jailton Junior"),
            createUserEvidence(
              cardRef,
              "email",
              "jailton.junior94@outlook.com",
            ),
          ],
        ),
        createLegacyUserCandidate(
          invoiceItemRef.database,
          invoiceItemRef.table,
          invoiceItemRef.primaryKey,
          "Jailton Junior",
          [
            createUserEvidence(invoiceItemRef, "name", "Jailton Junior"),
            createUserEvidence(invoiceItemRef, "phone", "+5511986896322"),
          ],
        ),
      ],
    };

    const useCase = new BuildEligibilityScopeUseCase(source, makeLogger());
    const result = await useCase.execute(targetUser);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("eligible");
      expect(result.value.matchedLegacyUsers).toHaveLength(2);
      expect(result.value.evidence.length).toBeGreaterThanOrEqual(4);
    }
  });

  test("fluxo discovery controlado -> bloqueado por falta de segundo sinal", async () => {
    const cardRef = {
      database: "FinancialControlDB" as const,
      table: "Card",
      primaryKey: "1",
    };
    const source: LegacyUserCandidateSourcePort = {
      loadCandidates: async () => [
        createLegacyUserCandidate(
          cardRef.database,
          cardRef.table,
          cardRef.primaryKey,
          "Jailton Junior",
          [createUserEvidence(cardRef, "name", "Jailton Junior")],
        ),
      ],
    };

    const useCase = new BuildEligibilityScopeUseCase(source, makeLogger());
    const result = await useCase.execute(targetUser);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("blocked_no_strong_signal");
      expect(result.value.matchedLegacyUsers).toHaveLength(1);
    }
  });

  test("fluxo discovery controlado -> bloqueado por conflito entre sinais fortes", async () => {
    const cardRef = {
      database: "FinancialControlDB" as const,
      table: "Card",
      primaryKey: "1",
    };
    const source: LegacyUserCandidateSourcePort = {
      loadCandidates: async () => [
        createLegacyUserCandidate(
          cardRef.database,
          cardRef.table,
          cardRef.primaryKey,
          "Jailton Junior",
          [
            createUserEvidence(cardRef, "name", "Jailton Junior"),
            createUserEvidence(cardRef, "email", "outro@email.com"),
          ],
        ),
      ],
    };

    const useCase = new BuildEligibilityScopeUseCase(source, makeLogger());
    const result = await useCase.execute(targetUser);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("blocked_inconsistent_target_user");
    }
  });

  test("fluxo discovery controlado -> regra afirmativa de Accounts mantém elegibilidade", async () => {
    const accountRef = {
      database: "AccountControlDB" as const,
      table: "Accounts",
      primaryKey: "1",
    };
    const source: LegacyUserCandidateSourcePort = {
      loadCandidates: async () => [
        createLegacyUserCandidate(
          accountRef.database,
          accountRef.table,
          accountRef.primaryKey,
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
      expect(result.value.matchedLegacyUsers).toEqual([accountRef]);
      expect(
        result.value.evidence.some(
          (e) => e.signalKind === "affirmative_account_rule",
        ),
      ).toBe(true);
    }
  });
});
