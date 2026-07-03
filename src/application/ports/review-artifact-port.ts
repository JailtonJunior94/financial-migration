import type { ReviewableIssue } from "../../domain/consolidation/types.ts";

export interface ReviewArtifactPort {
  append(scope: string, issue: ReviewableIssue): Promise<void>;
}
