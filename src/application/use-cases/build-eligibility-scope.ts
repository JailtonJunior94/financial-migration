import { ApplicationError } from "../../domain/common/errors.ts";
import { type Result, failure, success } from "../../domain/common/result.ts";
import {
  type EligibilityDecisionInput,
  decideEligibilityScope,
} from "../../domain/consolidation/eligibility.ts";
import type { TargetUser } from "../../domain/consolidation/types.ts";
import type { UserEligibilityScope } from "../../domain/consolidation/types.ts";
import type { LegacyUserCandidateSourcePort } from "../ports/legacy-user-candidate-source-port.ts";
import type { LoggerPort } from "../ports/logger-port.ts";

export class BuildEligibilityScopeUseCase {
  constructor(
    private readonly candidateSource: LegacyUserCandidateSourcePort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(
    targetUser: TargetUser,
  ): Promise<Result<UserEligibilityScope, ApplicationError>> {
    this.logger.info(
      "Iniciando resolução de elegibilidade do usuário destino.",
      {
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email,
      },
    );

    let candidates: EligibilityDecisionInput["candidates"];
    try {
      candidates = await this.candidateSource.loadCandidates();
    } catch (error) {
      return failure(
        new ApplicationError(
          "SOURCE_READ_FAILURE",
          "Falha ao carregar candidatos de usuário legado.",
          {
            targetUserId: targetUser.id,
            cause: error instanceof Error ? error.message : String(error),
          },
        ),
      );
    }

    const affirmativeAccountRefs = candidates
      .filter(
        (candidate) =>
          candidate.ref.database === "AccountControlDB" &&
          candidate.ref.table === "Accounts",
      )
      .map((candidate) => candidate.ref);

    const decision = decideEligibilityScope({
      targetUser,
      candidates,
      affirmativeAccountRefs,
    });

    if (!decision.ok) {
      this.logger.error(
        "Elegibilidade do usuário destino bloqueada por erro de domínio.",
        {
          targetUserId: targetUser.id,
          errorCode: decision.error.code,
          errorMessage: decision.error.message,
        },
      );
      return failure(
        new ApplicationError(
          decision.error.code,
          decision.error.message,
          decision.error.details,
        ),
      );
    }

    const scope = decision.value;
    if (scope.status === "eligible") {
      this.logger.info("Usuário destino elegível para migração.", {
        targetUserId: targetUser.id,
        matchedLegacyUsersCount: scope.matchedLegacyUsers.length,
        evidenceCount: scope.evidence.length,
      });
    } else {
      this.logger.warn("Usuário destino bloqueado para migração.", {
        targetUserId: targetUser.id,
        status: scope.status,
        matchedLegacyUsersCount: scope.matchedLegacyUsers.length,
        evidenceCount: scope.evidence.length,
      });
    }

    return success(scope);
  }
}
