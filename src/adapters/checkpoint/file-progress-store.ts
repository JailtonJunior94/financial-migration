import { readFile, rm } from "node:fs/promises";
import type { ProgressStorePort } from "../../application/ports/progress-store-port.ts";
import type { PipelineProgress } from "../../domain/publication/types.ts";
import { writeFileAtomic } from "./atomic-write.ts";

type ProgressDocument = Record<string, PipelineProgress>;

export class FileProgressStore implements ProgressStorePort {
  constructor(private readonly filePath: string) {}

  async read(scope: string): Promise<PipelineProgress | undefined> {
    const document = await this.load();
    return document[scope];
  }

  async write(scope: string, value: PipelineProgress): Promise<void> {
    const document = await this.load();
    document[scope] = value;
    await this.persist(document);
  }

  async list(): Promise<Record<string, PipelineProgress>> {
    return this.load();
  }

  async reset(scope?: string): Promise<void> {
    if (!scope) {
      await rm(this.filePath, { force: true });
      return;
    }

    const document = await this.load();
    delete document[scope];
    await this.persist(document);
  }

  private async load(): Promise<ProgressDocument> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as ProgressDocument;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  private async persist(document: ProgressDocument): Promise<void> {
    await writeFileAtomic(this.filePath, JSON.stringify(document, null, 2));
  }
}
