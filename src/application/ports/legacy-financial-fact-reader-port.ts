import type {
  LegacySourceRef,
  UserEligibilityScope,
} from "../../domain/consolidation/types.ts";

export type ReadEligibleFactsInput = {
  readonly eligibilityScope: UserEligibilityScope;
  readonly cursor?: string | undefined;
  readonly batchSize: number;
};

export type LegacyFact = {
  readonly ref: LegacySourceRef;
  readonly fields: Record<string, unknown>;
};

export type LegacyFactBatch = {
  readonly facts: readonly LegacyFact[];
  readonly nextCursor?: string | undefined;
};

export interface LegacyFinancialFactReaderPort {
  readEligibleFacts(input: ReadEligibleFactsInput): Promise<LegacyFactBatch>;
}
