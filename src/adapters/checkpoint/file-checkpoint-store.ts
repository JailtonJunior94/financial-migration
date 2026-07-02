import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CheckpointPort } from "../../application/ports/checkpoint-port.ts";
import type { CheckpointRecord } from "../../domain/sync/types.ts";

type CheckpointDocument = Record<string, CheckpointRecord>;

export class FileCheckpointStore implements CheckpointPort {
  constructor(private readonly filePath: string) {}

  async read(scope: string): Promise<CheckpointRecord | undefined> {
    const document = await this.load();
    return document[scope];
  }

  async write(scope: string, value: CheckpointRecord): Promise<void> {
    const document = await this.load();
    document[scope] = value;
    await this.persist(document);
  }

  async list(): Promise<Record<string, CheckpointRecord>> {
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

  private async load(): Promise<CheckpointDocument> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as CheckpointDocument;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  private async persist(document: CheckpointDocument): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(document, null, 2), "utf8");
  }
}
