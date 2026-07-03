import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { RemoteBindingStorePort } from "../../application/ports/remote-binding-store-port.ts";
import type { LegacySourceRef } from "../../domain/consolidation/types.ts";
import type { RemoteCardBinding } from "../../domain/publication/types.ts";
import { writeFileAtomic } from "./atomic-write.ts";

export class FileRemoteBindingStore implements RemoteBindingStorePort {
  constructor(private readonly directoryPath: string) {}

  async readCard(ref: LegacySourceRef): Promise<RemoteCardBinding | undefined> {
    try {
      const raw = await readFile(this.resolvePath(ref), "utf8");
      return JSON.parse(raw) as RemoteCardBinding;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async writeCard(binding: RemoteCardBinding): Promise<void> {
    await writeFileAtomic(
      this.resolvePath(binding.legacyRef),
      JSON.stringify(binding, null, 2),
    );
  }

  async list(): Promise<readonly RemoteCardBinding[]> {
    try {
      const entries = await readdir(this.directoryPath);
      const bindings: RemoteCardBinding[] = [];
      for (const entry of entries) {
        if (!entry.endsWith(".json")) {
          continue;
        }
        const raw = await readFile(join(this.directoryPath, entry), "utf8");
        bindings.push(JSON.parse(raw) as RemoteCardBinding);
      }
      return bindings;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async reset(ref?: LegacySourceRef): Promise<void> {
    if (!ref) {
      await rm(this.directoryPath, { recursive: true, force: true });
      await mkdir(this.directoryPath, { recursive: true });
      return;
    }

    await rm(this.resolvePath(ref), { force: true });
  }

  private resolvePath(ref: LegacySourceRef): string {
    const safeDatabase = ref.database.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeTable = ref.table.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safePrimaryKey = ref.primaryKey.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(
      this.directoryPath,
      `${safeDatabase}-${safeTable}-${safePrimaryKey}.json`,
    );
  }
}
