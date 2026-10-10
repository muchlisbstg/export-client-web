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

/** Filter comparison-selected products from a displayed catalog without mutating it. */
export function filterOutComparedProducts<T extends { id: string }>(products: readonly T[], comparedIds: readonly string[]): T[] {
  const compared = new Set(comparedIds);
  return products.filter((product) => !compared.has(product.id));
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

export type ActiveCatalogFilter = { key: "search" | "category" | "origin" | "unit"; value: string };

/** Describe active filters in a stable order for the removable filter summary. */
export function getActiveCatalogFilters(query: string, category: string, origin: string, unit = ""): ActiveCatalogFilter[] {
  const filters: ActiveCatalogFilter[] = [];
  const trimmedQuery = query.trim();
  if (trimmedQuery) filters.push({ key: "search", value: trimmedQuery });
  if (category) filters.push({ key: "category", value: category });
  if (origin) filters.push({ key: "origin", value: origin });
  if (unit) filters.push({ key: "unit", value: unit });
  return filters;
}

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

export function getOrigins<T extends CatalogProduct>(products: readonly T[]): string[] {
  const origins = new Set(products.map((product) => product.origin).filter(Boolean));
  return [...origins].sort((a, b) => a.localeCompare(b, "id-ID", { sensitivity: "base" }));
}

export function getUnits<T extends CatalogProduct>(products: readonly T[]): string[] {
  const units = new Set(products.map((product) => product.unit).filter((unit): unit is string => Boolean(unit)));
  return [...units].sort((a, b) => a.localeCompare(b, "id-ID", { sensitivity: "base" }));
}

export type CatalogFacetField = "category" | "origin" | "unit";

/** Count non-empty facet values in the supplied, already-filtered catalog subset. */
export function getFacetCounts<T extends Pick<CatalogProduct, CatalogFacetField>>(
  products: readonly T[],
  field: CatalogFacetField,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const product of products) {
    const value = product[field];
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function filterProducts<T extends CatalogProduct>(
  products: readonly T[],
  query = "",
  selectedCategory = "",
  selectedOrigin = "",
  selectedUnit = "",
): T[] {
  const normalizedQuery = normalizeForSearch(query);
  return products.filter((product) => {
    const matchesCategory = selectedCategory === "" || product.category === selectedCategory;
    const matchesOrigin = selectedOrigin === "" || product.origin === selectedOrigin;
    const matchesUnit = selectedUnit === "" || product.unit === selectedUnit;
    const searchableText = normalizeForSearch([product.name, product.category, product.origin, product.unit].filter(Boolean).join(" "));
    return matchesCategory && matchesOrigin && matchesUnit && (!normalizedQuery || searchableText.includes(normalizedQuery));
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


/** Choose all comparison attributes by default, or only attributes with differing values. */
export function getComparisonFieldsToDisplay<T extends ComparisonAttributes>(
  products: readonly T[],
  onlyDifferences: boolean,
): ComparisonField[] {
  return onlyDifferences ? getDifferingComparisonFields(products) : [...comparisonFields];
}

const comparisonShareLabels: Record<ComparisonField, string> = {
  category: "Kategori",
  origin: "Asal",
  unit: "Satuan",
};

const comparisonCsvLabels: Record<ComparisonField, string> = comparisonShareLabels;

function escapeComparisonCsvCell(value: unknown): string {
  const text = String(value ?? "");
  const safeText = /^[\t\r\n ]*[=+\-@]/u.test(text) ? `\t${text}` : text;
  return `"${safeText.replace(/"/gu, '""')}"`;
}

/** Format the current comparison as spreadsheet-safe RFC 4180 CSV. */
export function formatComparisonCsv<T extends ComparisonAttributes & { name: string }>(
  products: readonly T[],
  visibleFields: readonly ComparisonField[],
): string {
  if (products.length < 2) return "";

  const rows: string[][] = [
    ["Detail", ...products.map((product) => product.name)],
    ...visibleFields.map((field) => [comparisonCsvLabels[field], ...products.map((product) => product[field])]),
  ];
  return rows.map((row) => row.map(escapeComparisonCsvCell).join(",")).join("\r\n");
}

function cleanComparisonShareValue(value: unknown, fallback = "—"): string {
  return String(value ?? "").replace(/\s+/gu, " ").trim() || fallback;
}

/** Format only the selected products and fields currently shown in the comparison. */
export function formatComparisonShare<T extends ComparisonAttributes & { name: string }>(
  products: readonly T[],
  visibleFields: readonly ComparisonField[],
  differingFields: readonly ComparisonField[],
): string {
  const lines = [`Perbandingan produk — ${products.length} produk`];
  if (products.length < 2) {
    lines.push("", "Pilih setidaknya dua produk untuk membandingkan.");
    return lines.join("\n");
  }

  lines.push("", `Produk: ${products.map((product) => cleanComparisonShareValue(product.name, "Tanpa nama")).join(" | ")}`);
  if (visibleFields.length === 0) {
    lines.push("", "Tidak ada atribut yang berbeda pada pilihan ini.");
    return lines.join("\n");
  }

  for (const field of visibleFields) {
    const values = products.map((product) => cleanComparisonShareValue(product[field]));
    lines.push(`${comparisonShareLabels[field]}: ${values.join(" | ")}${differingFields.includes(field) ? " (berbeda)" : ""}`);
  }
  return lines.join("\n");
}
