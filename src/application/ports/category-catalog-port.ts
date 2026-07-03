import type {
  CategoryCatalog,
  CategoryDictionaryPage,
  CategoryDictionarySearch,
  CategoryKind,
} from "../../domain/classification/types.ts";

export interface CategoryCatalogPort {
  listByKind(kind: CategoryKind): Promise<CategoryCatalog>;
  searchDictionary(
    input: CategoryDictionarySearch,
  ): Promise<CategoryDictionaryPage>;
}
