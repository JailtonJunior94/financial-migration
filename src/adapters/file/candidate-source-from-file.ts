import { readFile } from "node:fs/promises";
import type { LegacyUserCandidateSourcePort } from "../../application/ports/legacy-user-candidate-source-port.ts";
import type { LegacyUserCandidate } from "../../domain/consolidation/eligibility.ts";

export class CandidateSourceFromFile implements LegacyUserCandidateSourcePort {
  constructor(private readonly filePath: string) {}

  async loadCandidates(): Promise<readonly LegacyUserCandidate[]> {
    const raw = await readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as { candidates?: LegacyUserCandidate[] };
    return parsed.candidates ?? [];
  }
}
