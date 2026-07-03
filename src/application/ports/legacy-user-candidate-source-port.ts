import type { LegacyUserCandidate } from "../../domain/consolidation/eligibility.ts";

export interface LegacyUserCandidateSourcePort {
  loadCandidates(): Promise<readonly LegacyUserCandidate[]>;
}
