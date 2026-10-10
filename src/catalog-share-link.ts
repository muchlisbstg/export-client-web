import type { CatalogSortDirection, CatalogSortField } from "./catalog";

export type CatalogShareState = {
  query: string;
  category: string;
  origin: string;
  unit: string;
  sortField: CatalogSortField;
  sortDirection: CatalogSortDirection;
};

const sortFields: readonly CatalogSortField[] = ["default", "name", "category", "origin", "unit"];
const catalogParamKeys = ["q", "category", "origin", "unit", "sort", "direction"] as const;

/** Read client-side catalog state from a URL search string, ignoring unsupported sort values. */
export function parseCatalogShareState(search: string): CatalogShareState {
  const params = new URLSearchParams(search);
  const requestedSort = params.get("sort");
  const sortField = sortFields.includes(requestedSort as CatalogSortField) ? requestedSort as CatalogSortField : "default";
  const requestedDirection = params.get("direction");

  return {
    query: params.get("q") ?? "",
    category: params.get("category") ?? "",
    origin: params.get("origin") ?? "",
    unit: params.get("unit") ?? "",
    sortField,
    sortDirection: requestedDirection === "desc" ? "desc" : "asc",
  };
}

/** Build a link to this client that restores the supplied catalog filters and sort. */
export function buildCatalogShareUrl(currentUrl: string, state: CatalogShareState): string {
  const url = new URL(currentUrl);
  for (const key of catalogParamKeys) url.searchParams.delete(key);

  if (state.query.trim()) url.searchParams.set("q", state.query);
  if (state.category) url.searchParams.set("category", state.category);
  if (state.origin) url.searchParams.set("origin", state.origin);
  if (state.unit) url.searchParams.set("unit", state.unit);
  if (state.sortField !== "default") {
    url.searchParams.set("sort", state.sortField);
    if (state.sortDirection === "desc") url.searchParams.set("direction", "desc");
  }

  url.hash = "catalog";
  return url.toString();
}
