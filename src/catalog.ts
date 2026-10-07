export type CatalogProduct = {
  name: string;
  category: string;
  origin: string;
  unit?: string;
};

export type CatalogSortField = "default" | "name" | "category" | "origin" | "unit";
export type CatalogSortDirection = "asc" | "desc";

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
