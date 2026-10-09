export type CatalogProduct = {
  name: string;
  category: string;
  origin: string;
  unit?: string;
};

export type CatalogSortField = "default" | "name" | "category" | "origin" | "unit";
export type CatalogSortDirection = "asc" | "desc";
export type ComparisonField = "category" | "origin" | "unit";

export const MAX_COMPARE_PRODUCTS = 3;
const comparisonFields: readonly ComparisonField[] = ["category", "origin", "unit"];
type ComparisonAttributes = { category: string; origin: string; unit: string };

/** Toggle a product in a client-only comparison selection without mutating the input. */
export function toggleCompareSelection(
  comparedIds: readonly string[],
  productId: string,
  limit = MAX_COMPARE_PRODUCTS,
): string[] {
  const uniqueIds = [...new Set(comparedIds.filter(Boolean))];
  if (uniqueIds.includes(productId)) return uniqueIds.filter((id) => id !== productId);
  const safeLimit = Math.max(0, Math.floor(limit));
  if (!productId || uniqueIds.length >= safeLimit) return uniqueIds;
  return [...uniqueIds, productId];
}

/** Return catalog attributes whose values differ across the selected products. */
export function getDifferingComparisonFields<T extends ComparisonAttributes>(products: readonly T[]): ComparisonField[] {
  return comparisonFields.filter((field) => new Set(products.map((product) => product[field])).size > 1);
}

export const catalogSortOptions: ReadonlyArray<{ field: CatalogSortField; label: string }> = [
  { field: "default", label: "Urutan awal" },
  { field: "name", label: "Nama" },
  { field: "category", label: "Kategori" },
  { field: "origin", label: "Asal" },
  { field: "unit", label: "Satuan" },
];

function normalizeForSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("id-ID")
    .trim();
}

export function getCategories<T extends CatalogProduct>(products: readonly T[]): string[] {
  const categories = new Set(products.map((product) => product.category).filter(Boolean));
  return [...categories].sort((a, b) => a.localeCompare(b, "id-ID", { sensitivity: "base" }));
}

export function filterProducts<T extends CatalogProduct>(
  products: readonly T[],
  query = "",
  selectedCategory = "",
): T[] {
  const normalizedQuery = normalizeForSearch(query);
  return products.filter((product) => {
    const matchesCategory = selectedCategory === "" || product.category === selectedCategory;
    const searchableText = normalizeForSearch(`${product.name} ${product.category} ${product.origin}`);
    return matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
  });
}

/** Sort a copy of the currently loaded catalog; equal values retain their input order. */
export function sortProducts<T extends CatalogProduct>(
  products: readonly T[],
  field: CatalogSortField = "default",
  direction: CatalogSortDirection = "asc",
): T[] {
  if (field === "default") return [...products];

  const collator = new Intl.Collator("id-ID", { sensitivity: "base", numeric: true });
  const multiplier = direction === "asc" ? 1 : -1;
  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const result = collator.compare(String(a.product[field] ?? "").trim(), String(b.product[field] ?? "").trim());
      return result === 0 ? a.index - b.index : result * multiplier;
    })
    .map(({ product }) => product);
}
