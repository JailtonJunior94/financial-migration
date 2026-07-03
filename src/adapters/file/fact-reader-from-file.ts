import { readFile } from "node:fs/promises";
import type {
  LegacyFactBatch,
  LegacyFinancialFactReaderPort,
  ReadEligibleFactsInput,
} from "../../application/ports/legacy-financial-fact-reader-port.ts";
import type { LegacyFact } from "../../application/ports/legacy-financial-fact-reader-port.ts";

export class FactReaderFromFile implements LegacyFinancialFactReaderPort {
  constructor(private readonly filePath: string) {}

  async readEligibleFacts(
    input: ReadEligibleFactsInput,
  ): Promise<LegacyFactBatch> {
    const raw = await readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as { facts?: LegacyFact[] };
    const facts = parsed.facts ?? [];

    const cursor = input.cursor ? Number(input.cursor) : 0;
    const batch = facts.slice(cursor, cursor + input.batchSize);
    const nextCursor =
      cursor + batch.length < facts.length
        ? String(cursor + batch.length)
        : undefined;

    return { facts: batch, nextCursor };
  }
}
