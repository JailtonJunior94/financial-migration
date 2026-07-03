import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ReviewArtifactPort } from "../../application/ports/review-artifact-port.ts";
import type { ReviewableIssue } from "../../domain/consolidation/types.ts";
import { writeFileAtomic } from "./atomic-write.ts";

export class FileReviewArtifactStore implements ReviewArtifactPort {
  constructor(private readonly directoryPath: string) {}

  async append(scope: string, issue: ReviewableIssue): Promise<void> {
    const path = this.resolvePath(scope);
    const lines = await this.readLines(path);
    lines.push(JSON.stringify(this.sanitizeIssue(issue)));
    await writeFileAtomic(path, `${lines.join("\n")}\n`);
  }

  async read(scope: string): Promise<readonly ReviewableIssue[]> {
    const path = this.resolvePath(scope);
    const lines = await this.readLines(path);
    return lines
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as ReviewableIssue);
  }

  async listScopes(): Promise<readonly string[]> {
    try {
      const entries = await readdir(this.directoryPath);
      return entries
        .filter((entry) => entry.endsWith(".ndjson"))
        .map((entry) => entry.replace(/\.ndjson$/, ""));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async reset(scope?: string): Promise<void> {
    if (!scope) {
      await rm(this.directoryPath, { recursive: true, force: true });
      await mkdir(this.directoryPath, { recursive: true });
      return;
    }

    await rm(this.resolvePath(scope), { force: true });
  }

  private resolvePath(scope: string): string {
    const safeScope = scope.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.directoryPath, `${safeScope}.ndjson`);
  }

  private async readLines(path: string): Promise<string[]> {
    try {
      const raw = await readFile(path, "utf8");
      return raw.split("\n").filter((line) => line.length > 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private sanitizeIssue(issue: ReviewableIssue): ReviewableIssue {
    const base: ReviewableIssue = {
      ...issue,
      evidence: this.sanitizeEvidence(issue.evidence),
    };

    if (issue.factKey) {
      return { ...base, factKey: issue.factKey };
    }

    return base;
  }

  private sanitizeEvidence(
    evidence: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(evidence)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("token") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("cpf") ||
        lowerKey.includes("cardnumber") ||
        lowerKey.includes("card_number")
      ) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
