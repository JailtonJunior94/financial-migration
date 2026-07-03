import { DomainError } from "../common/errors.ts";
import { type Result, failure, success } from "../common/result.ts";
import type {
  EligibilityStatus,
  LegacyDatabase,
  LegacySourceRef,
  TargetUser,
  UserEligibilityScope,
  UserEvidence,
} from "./types.ts";

const TARGET_NAME = "jailton";

export type LegacyUserCandidate = {
  readonly ref: LegacySourceRef;
  readonly name?: string;
  readonly signals: readonly UserEvidence[];
};

export type EligibilityDecisionInput = {
  readonly targetUser: TargetUser;
  readonly candidates: readonly LegacyUserCandidate[];
  readonly affirmativeAccountRefs: readonly LegacySourceRef[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const normalizeText = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Mn}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export const nameContainsJailton = (name: string): boolean =>
  normalizeText(name).includes(TARGET_NAME);

export const normalizePhone = (phone: string): string =>
  phone.replace(/\D/g, "");

export const createUserEvidence = (
  legacyRef: LegacySourceRef,
  signalKind: UserEvidence["signalKind"],
  value: string,
): UserEvidence => ({
  legacyRef,
  signalKind,
  value: value.trim(),
});

export const createLegacyUserCandidate = (
  database: LegacyDatabase,
  table: string,
  primaryKey: string,
  name: string | undefined,
  signals: readonly UserEvidence[],
): LegacyUserCandidate => {
  const candidate: LegacyUserCandidate = {
    ref: { database, table, primaryKey },
    signals,
  };

  if (name !== undefined) {
    return { ...candidate, name: name.trim() };
  }

  return candidate;
};

export type SignalStrength = "trigger" | "strong";

export const signalStrength = (
  signalKind: UserEvidence["signalKind"],
): SignalStrength => {
  switch (signalKind) {
    case "name":
      return "trigger";
    case "email":
    case "phone":
    case "card":
    case "recurring_history":
    case "consistent_relationship":
    case "affirmative_account_rule":
      return "strong";
  }
};

export const isStrongSignal = (signal: UserEvidence): boolean =>
  signalStrength(signal.signalKind) === "strong";

export const hasStrongConfirmationSignal = (
  candidate: LegacyUserCandidate,
): boolean => candidate.signals.some(isStrongSignal);

const matchesTargetEmail = (
  signal: UserEvidence,
  targetUser: TargetUser,
): boolean =>
  signal.signalKind === "email" &&
  signal.value.toLowerCase() === targetUser.email.toLowerCase();

const matchesTargetPhone = (
  signal: UserEvidence,
  targetUser: TargetUser,
): boolean =>
  signal.signalKind === "phone" &&
  normalizePhone(signal.value) === normalizePhone(targetUser.whatsappNumber);

const signalConflictsWithTargetUser = (
  signal: UserEvidence,
  targetUser: TargetUser,
): boolean => {
  if (signal.signalKind === "email") {
    return signal.value.toLowerCase() !== targetUser.email.toLowerCase();
  }
  if (signal.signalKind === "phone") {
    return (
      normalizePhone(signal.value) !== normalizePhone(targetUser.whatsappNumber)
    );
  }
  return false;
};

export const hasConflictingStrongSignals = (
  candidates: readonly LegacyUserCandidate[],
  targetUser: TargetUser,
): boolean =>
  candidates
    .filter(hasStrongConfirmationSignal)
    .some((candidate) =>
      candidate.signals.some(
        (signal) =>
          isStrongSignal(signal) &&
          signalConflictsWithTargetUser(signal, targetUser),
      ),
    );

const validateTargetUser = (
  targetUser: TargetUser,
): Result<void, DomainError> => {
  if (!UUID_PATTERN.test(targetUser.id)) {
    return failure(
      new DomainError(
        "USER_NOT_ELIGIBLE",
        "ID do usuário destino deve ser um UUID válido.",
        { userId: targetUser.id },
      ),
    );
  }

  const normalizedEmail = targetUser.email.trim().toLowerCase();
  if (normalizedEmail.length === 0) {
    return failure(
      new DomainError(
        "USER_NOT_ELIGIBLE",
        "E-mail do usuário destino deve ser informado.",
      ),
    );
  }

  const normalizedPhone = normalizePhone(targetUser.whatsappNumber);
  if (normalizedPhone.length === 0) {
    return failure(
      new DomainError(
        "USER_NOT_ELIGIBLE",
        "Número de WhatsApp do usuário destino deve ser informado.",
      ),
    );
  }

  if (targetUser.status !== "ACTIVE" && targetUser.status !== "INACTIVE") {
    return failure(
      new DomainError(
        "USER_NOT_ELIGIBLE",
        "Status do usuário destino deve ser ACTIVE ou INACTIVE.",
        { status: targetUser.status },
      ),
    );
  }

  return success(undefined);
};

const isNameMatchedCandidate = (candidate: LegacyUserCandidate): boolean =>
  candidate.name !== undefined && nameContainsJailton(candidate.name);

const isAffirmativeAccount = (
  candidate: LegacyUserCandidate,
  affirmativeRefs: readonly LegacySourceRef[],
): boolean =>
  affirmativeRefs.some(
    (ref) =>
      ref.database === candidate.ref.database &&
      ref.table === candidate.ref.table &&
      ref.primaryKey === candidate.ref.primaryKey,
  );

const isMatchedCandidate = (
  candidate: LegacyUserCandidate,
  affirmativeRefs: readonly LegacySourceRef[],
): boolean =>
  isNameMatchedCandidate(candidate) ||
  isAffirmativeAccount(candidate, affirmativeRefs);

export const decideEligibilityScope = (
  input: EligibilityDecisionInput,
): Result<UserEligibilityScope, DomainError> => {
  const validation = validateTargetUser(input.targetUser);
  if (!validation.ok) {
    return failure(validation.error);
  }

  if (input.targetUser.status !== "ACTIVE") {
    return success({
      targetUser: input.targetUser,
      matchedLegacyUsers: [],
      evidence: [],
      status: "blocked_not_active",
    });
  }

  const matchedCandidates = input.candidates.filter((candidate) =>
    isMatchedCandidate(candidate, input.affirmativeAccountRefs),
  );

  const allEvidence: UserEvidence[] = [
    ...matchedCandidates.flatMap((candidate) => candidate.signals.slice()),
    ...input.affirmativeAccountRefs.map((ref) =>
      createUserEvidence(
        ref,
        "affirmative_account_rule",
        "AccountControlDB.Accounts",
      ),
    ),
  ];

  const matchedLegacyUsers = matchedCandidates.map(
    (candidate) => candidate.ref,
  );

  if (
    hasConflictingStrongSignals(matchedCandidates, input.targetUser) ||
    hasConflictingStrongSignals(
      input.candidates.filter((candidate) =>
        isAffirmativeAccount(candidate, input.affirmativeAccountRefs),
      ),
      input.targetUser,
    )
  ) {
    return success({
      targetUser: input.targetUser,
      matchedLegacyUsers,
      evidence: allEvidence,
      status: "blocked_inconsistent_target_user",
    });
  }

  const nameMatchedWithStrongSignal = matchedCandidates.some(
    (candidate) =>
      isNameMatchedCandidate(candidate) &&
      hasStrongConfirmationSignal(candidate),
  );

  const hasAffirmativeAccount = input.affirmativeAccountRefs.length > 0;

  if (!nameMatchedWithStrongSignal && !hasAffirmativeAccount) {
    return success({
      targetUser: input.targetUser,
      matchedLegacyUsers,
      evidence: allEvidence,
      status: "blocked_no_strong_signal",
    });
  }

  return success({
    targetUser: input.targetUser,
    matchedLegacyUsers,
    evidence: allEvidence,
    status: "eligible",
  });
};

export const eligibilityStatusIsBlocking = (
  status: EligibilityStatus,
): boolean => status !== "eligible";
