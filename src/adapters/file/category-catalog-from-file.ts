import { readFile } from "node:fs/promises";
import type { CategoryCatalogPort } from "../../application/ports/category-catalog-port.ts";
import type {
  CategoryCatalog,
  CategoryDictionaryPage,
  CategoryDictionarySearch,
  CategoryKind,
} from "../../domain/classification/types.ts";

export class CategoryCatalogFromFile implements CategoryCatalogPort {
  constructor(private readonly filePath: string) {}

  async listByKind(kind: CategoryKind): Promise<CategoryCatalog> {
    const raw = await readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as {
      expense?: CategoryCatalog;
      income?: CategoryCatalog;
    };
    const catalog = parsed[kind];
    if (!catalog) {
      return { kind, categories: [] };
    }
    return catalog;
  }

  async searchDictionary(
    _input: CategoryDictionarySearch,
  ): Promise<CategoryDictionaryPage> {
    const raw = await readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as {
      dictionary?: CategoryDictionaryPage;
    };
    return parsed.dictionary ?? { entries: [] };
  }
}
