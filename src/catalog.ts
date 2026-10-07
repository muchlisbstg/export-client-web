export type CatalogProduct = {
  name: string;
  category: string;
  origin: string;
};

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
