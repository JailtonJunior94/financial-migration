import { describe, expect, test } from "bun:test";
import {
  createLegacyUserCandidate,
  createUserEvidence,
  decideEligibilityScope,
  eligibilityStatusIsBlocking,
  hasConflictingStrongSignals,
  hasStrongConfirmationSignal,
  nameContainsJailton,
  normalizePhone,
  normalizeText,
  signalStrength,
} from "../../../src/domain/consolidation/eligibility.ts";
import type {
  LegacySourceRef,
  TargetUser,
} from "../../../src/domain/consolidation/types.ts";

const targetUser: TargetUser = {
  id: "06edc407-4f63-42e8-b07c-946b9ef0a19c",
  email: "jailton.junior94@outlook.com",
  whatsappNumber: "+5511986896322",
  status: "ACTIVE",
};

const makeRef = (
  database: LegacySourceRef["database"],
  table: string,
  primaryKey: string,
): LegacySourceRef => ({ database, table, primaryKey });

const makeCandidate = (
  ref: LegacySourceRef,
  name: string | undefined,
  signals: ReturnType<typeof createUserEvidence>[],
) =>
  createLegacyUserCandidate(
    ref.database,
    ref.table,
    ref.primaryKey,
    name,
    signals,
  );

describe("normalizeText", () => {
  test("remove acentos e converte para minúsculas", () => {
    expect(normalizeText("Jáíltön")).toBe("jailton");
  });

  test("remove caracteres não alfanuméricos e colapsa espaços", () => {
    expect(normalizeText("Jailton C. Junior")).toBe("jailton c junior");
  });

  test("ignora diferença de caixa", () => {
    expect(normalizeText("JAILTON")).toBe("jailton");
  });
});

describe("nameContainsJailton", () => {
  test("reconhece nome com Jailton independente de acentos e caixa", () => {
    expect(nameContainsJailton("Jailton Junior")).toBe(true);
    expect(nameContainsJailton("JÁILTON JUNIOR")).toBe(true);
    expect(nameContainsJailton("Maria Jailton Souza")).toBe(true);
  });

  test("rejeita nome sem Jailton", () => {
    expect(nameContainsJailton("João da Silva")).toBe(false);
    expect(nameContainsJailton("")).toBe(false);
  });
});

describe("normalizePhone", () => {
  test("remove todos os caracteres não numéricos", () => {
    expect(normalizePhone("+55 (11) 98689-6322")).toBe("5511986896322");
  });
});

describe("signalStrength", () => {
  test("nome é apenas gatilho inicial", () => {
    expect(signalStrength("name")).toBe("trigger");
  });

  test("email, telefone, cartão, histórico recorrente e relacionamento consistente são fortes", () => {
    expect(signalStrength("email")).toBe("strong");
    expect(signalStrength("phone")).toBe("strong");
    expect(signalStrength("card")).toBe("strong");
    expect(signalStrength("recurring_history")).toBe("strong");
    expect(signalStrength("consistent_relationship")).toBe("strong");
    expect(signalStrength("affirmative_account_rule")).toBe("strong");
  });
});

describe("hasStrongConfirmationSignal", () => {
  test("candidato com apenas nome não tem sinal forte", () => {
    const candidate = makeCandidate(
      makeRef("FinancialControlDB", "Card", "card-1"),
      "Jailton Junior",
      [
        createUserEvidence(
          makeRef("FinancialControlDB", "Card", "card-1"),
          "name",
          "Jailton Junior",
        ),
      ],
    );

    expect(hasStrongConfirmationSignal(candidate)).toBe(false);
  });

  test("candidato com email matching tem sinal forte", () => {
    const ref = makeRef("FinancialControlDB", "Card", "card-1");
    const candidate = makeCandidate(ref, "Jailton Junior", [
      createUserEvidence(ref, "name", "Jailton Junior"),
      createUserEvidence(ref, "email", "jailton.junior94@outlook.com"),
    ]);

    expect(hasStrongConfirmationSignal(candidate)).toBe(true);
  });
});

describe("hasConflictingStrongSignals", () => {
  test("detecta email forte divergente do target user", () => {
    const ref = makeRef("FinancialControlDB", "Card", "card-1");
    const candidates = [
      makeCandidate(ref, "Jailton Junior", [
        createUserEvidence(ref, "email", "outro@email.com"),
      ]),
    ];

    expect(hasConflictingStrongSignals(candidates, targetUser)).toBe(true);
  });

  test("detecta telefone forte divergente do target user", () => {
    const ref = makeRef("FinancialControlDB", "Card", "card-1");
    const candidates = [
      makeCandidate(ref, "Jailton Junior", [
        createUserEvidence(ref, "phone", "+5511999999999"),
      ]),
    ];

    expect(hasConflictingStrongSignals(candidates, targetUser)).toBe(true);
  });

  test("não considera conflito quando sinais fortes batem com target user", () => {
    const ref = makeRef("FinancialControlDB", "Card", "card-1");
    const candidates = [
      makeCandidate(ref, "Jailton Junior", [
        createUserEvidence(ref, "email", "jailton.junior94@outlook.com"),
        createUserEvidence(ref, "phone", "+5511986896322"),
      ]),
    ];

    expect(hasConflictingStrongSignals(candidates, targetUser)).toBe(false);
  });

  test("não considera conflito para sinais fortes que não identificam usuário", () => {
    const ref = makeRef("FinancialControlDB", "Card", "card-1");
    const candidates = [
      makeCandidate(ref, "Jailton Junior", [
        createUserEvidence(ref, "card", "****1234"),
        createUserEvidence(ref, "recurring_history", "netflix"),
      ]),
    ];

    expect(hasConflictingStrongSignals(candidates, targetUser)).toBe(false);
  });
});

describe("decideEligibilityScope", () => {
  test("rejeita target user com UUID inválido", () => {
    const result = decideEligibilityScope({
      targetUser: { ...targetUser, id: "não-uuid" },
      candidates: [],
      affirmativeAccountRefs: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("USER_NOT_ELIGIBLE");
    }
  });

  test("rejeita target user sem e-mail", () => {
    const result = decideEligibilityScope({
      targetUser: { ...targetUser, email: "   " },
      candidates: [],
      affirmativeAccountRefs: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("USER_NOT_ELIGIBLE");
    }
  });

  test("rejeita target user sem telefone", () => {
    const result = decideEligibilityScope({
      targetUser: { ...targetUser, whatsappNumber: "" },
      candidates: [],
      affirmativeAccountRefs: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("USER_NOT_ELIGIBLE");
    }
  });

  test("bloqueia target user inativo", () => {
    const result = decideEligibilityScope({
      targetUser: { ...targetUser, status: "INACTIVE" },
      candidates: [],
      affirmativeAccountRefs: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("blocked_not_active");
      expect(result.value.matchedLegacyUsers).toHaveLength(0);
    }
  });

  test("bloqueia candidato Jailton sem segundo sinal forte", () => {
    const ref = makeRef("FinancialControlDB", "Card", "card-1");
    const result = decideEligibilityScope({
      targetUser,
      candidates: [
        makeCandidate(ref, "Jailton Junior", [
          createUserEvidence(ref, "name", "Jailton Junior"),
        ]),
      ],
      affirmativeAccountRefs: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("blocked_no_strong_signal");
    }
  });

  test("torna elegível candidato Jailton com email matching", () => {
    const ref = makeRef("FinancialControlDB", "Card", "card-1");
    const result = decideEligibilityScope({
      targetUser,
      candidates: [
        makeCandidate(ref, "Jailton Junior", [
          createUserEvidence(ref, "name", "Jailton Junior"),
          createUserEvidence(ref, "email", "jailton.junior94@outlook.com"),
        ]),
      ],
      affirmativeAccountRefs: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("eligible");
      expect(result.value.matchedLegacyUsers).toEqual([ref]);
      expect(result.value.evidence).toHaveLength(2);
    }
  });

  test("torna elegível candidato Jailton com telefone matching", () => {
    const ref = makeRef("FinancialControlDB", "Card", "card-1");
    const result = decideEligibilityScope({
      targetUser,
      candidates: [
        makeCandidate(ref, "Jailton Junior", [
          createUserEvidence(ref, "name", "Jailton Junior"),
          createUserEvidence(ref, "phone", "+55 11 98689-6322"),
        ]),
      ],
      affirmativeAccountRefs: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("eligible");
    }
  });

  test("torna elegível candidato Jailton com sinal de cartão", () => {
    const ref = makeRef("FinancialControlDB", "Card", "card-1");
    const result = decideEligibilityScope({
      targetUser,
      candidates: [
        makeCandidate(ref, "Jailton Junior", [
          createUserEvidence(ref, "name", "Jailton Junior"),
          createUserEvidence(ref, "card", "****1234"),
        ]),
      ],
      affirmativeAccountRefs: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("eligible");
    }
  });

  test("bloqueia conflito entre sinais fortes e target user", () => {
    const ref = makeRef("FinancialControlDB", "Card", "card-1");
    const result = decideEligibilityScope({
      targetUser,
      candidates: [
        makeCandidate(ref, "Jailton Junior", [
          createUserEvidence(ref, "name", "Jailton Junior"),
          createUserEvidence(ref, "email", "outro@email.com"),
        ]),
      ],
      affirmativeAccountRefs: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("blocked_inconsistent_target_user");
    }
  });

  test("aplica regra afirmativa para AccountControlDB.Accounts sem exigir segundo sinal", () => {
    const ref = makeRef("AccountControlDB", "Accounts", "account-1");
    const result = decideEligibilityScope({
      targetUser,
      candidates: [
        makeCandidate(ref, "Conta Corrente", [
          createUserEvidence(ref, "consistent_relationship", "user_id"),
        ]),
      ],
      affirmativeAccountRefs: [ref],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("eligible");
      expect(result.value.matchedLegacyUsers).toEqual([ref]);
      expect(
        result.value.evidence.some(
          (e) => e.signalKind === "affirmative_account_rule",
        ),
      ).toBe(true);
    }
  });

  test("bloqueia target user inativo mesmo com regra afirmativa", () => {
    const ref = makeRef("AccountControlDB", "Accounts", "account-1");
    const result = decideEligibilityScope({
      targetUser: { ...targetUser, status: "INACTIVE" },
      candidates: [makeCandidate(ref, "Conta Corrente", [])],
      affirmativeAccountRefs: [ref],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("blocked_not_active");
    }
  });

  test("bloqueia conflito em regra afirmativa de Accounts", () => {
    const accountRef = makeRef("AccountControlDB", "Accounts", "account-1");
    const cardRef = makeRef("FinancialControlDB", "Card", "card-1");
    const result = decideEligibilityScope({
      targetUser,
      candidates: [
        makeCandidate(accountRef, "Conta Corrente", [
          createUserEvidence(accountRef, "email", "outro@email.com"),
        ]),
        makeCandidate(cardRef, "Jailton Junior", [
          createUserEvidence(cardRef, "name", "Jailton Junior"),
          createUserEvidence(cardRef, "email", "jailton.junior94@outlook.com"),
        ]),
      ],
      affirmativeAccountRefs: [accountRef],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("blocked_inconsistent_target_user");
    }
  });

  test("ignora candidatos cujo nome não contém Jailton e não têm regra afirmativa", () => {
    const ref = makeRef("FinancialControlDB", "Card", "card-1");
    const result = decideEligibilityScope({
      targetUser,
      candidates: [
        makeCandidate(ref, "João da Silva", [
          createUserEvidence(ref, "email", "jailton.junior94@outlook.com"),
        ]),
      ],
      affirmativeAccountRefs: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("blocked_no_strong_signal");
      expect(result.value.matchedLegacyUsers).toHaveLength(0);
    }
  });

  test("consolida múltiplos matched legacy users elegíveis", () => {
    const cardRef = makeRef("FinancialControlDB", "Card", "card-1");
    const invoiceItemRef = makeRef("FinancialControlDB", "InvoiceItem", "ii-1");
    const result = decideEligibilityScope({
      targetUser,
      candidates: [
        makeCandidate(cardRef, "Jailton Junior", [
          createUserEvidence(cardRef, "name", "Jailton Junior"),
          createUserEvidence(cardRef, "email", "jailton.junior94@outlook.com"),
        ]),
        makeCandidate(invoiceItemRef, "Jailton Junior", [
          createUserEvidence(invoiceItemRef, "name", "Jailton Junior"),
          createUserEvidence(invoiceItemRef, "phone", "+5511986896322"),
        ]),
      ],
      affirmativeAccountRefs: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("eligible");
      expect(result.value.matchedLegacyUsers).toHaveLength(2);
    }
  });
});

describe("eligibilityStatusIsBlocking", () => {
  test("apenas eligible não bloqueia", () => {
    expect(eligibilityStatusIsBlocking("eligible")).toBe(false);
    expect(eligibilityStatusIsBlocking("blocked_no_strong_signal")).toBe(true);
    expect(
      eligibilityStatusIsBlocking("blocked_inconsistent_target_user"),
    ).toBe(true);
    expect(eligibilityStatusIsBlocking("blocked_not_active")).toBe(true);
  });
});
