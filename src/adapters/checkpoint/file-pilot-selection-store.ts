import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PilotEntitySelection } from "../../domain/schema/types.ts";

export class FilePilotSelectionStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<PilotEntitySelection | undefined> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as PilotEntitySelection;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async write(selection: PilotEntitySelection): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(selection, null, 2), "utf8");
  }
}
