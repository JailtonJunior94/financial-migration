import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const writeFileAtomic = async (
  targetPath: string,
  content: string,
): Promise<void> => {
  const directory = dirname(targetPath);
  await mkdir(directory, { recursive: true });
  const tempPath = join(
    directory,
    `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  try {
    await writeFile(tempPath, content, "utf8");
    await rename(tempPath, targetPath);
  } catch (error) {
    try {
      await import("node:fs/promises").then((fs) =>
        fs.rm(tempPath, { force: true }),
      );
    } catch {
      // ignore cleanup failure
    }
    throw error;
  }
};
