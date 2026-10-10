import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogShareUrl, parseCatalogShareState } from "../src/catalog-share-link.ts";

test("parses search, facet filters, and sort settings from a shared URL", () => {
  assert.deepEqual(parseCatalogShareState("?q=kopi%20arabika&category=Minuman&origin=Sulawesi&unit=kg&sort=name&direction=desc"), {
    query: "kopi arabika",
    category: "Minuman",
    origin: "Sulawesi",
    unit: "kg",
    sortField: "name",
    sortDirection: "desc",
  });
});

test("uses safe defaults for missing and unsupported URL values", () => {
  assert.deepEqual(parseCatalogShareState("?sort=price&direction=sideways"), {
    query: "",
    category: "",
    origin: "",
    unit: "",
    sortField: "default",
    sortDirection: "asc",
  });
});

test("builds a route-preserving link that restores state and lands on the catalog", () => {
  const link = new URL(buildCatalogShareUrl("https://example.test/client?campaign=october&q=stale#inquiry", {
    query: "kopi arabika",
    category: "Minuman",
    origin: "Sulawesi Selatan",
    unit: "kg",
    sortField: "name",
    sortDirection: "desc",
  }));

  assert.equal(link.pathname, "/client");
  assert.equal(link.searchParams.get("campaign"), "october");
  assert.deepEqual(parseCatalogShareState(link.search), {
    query: "kopi arabika",
    category: "Minuman",
    origin: "Sulawesi Selatan",
    unit: "kg",
    sortField: "name",
    sortDirection: "desc",
  });
  assert.equal(link.hash, "#catalog");
});

test("omits empty filters and default sort values", () => {
  const link = new URL(buildCatalogShareUrl("https://example.test/", {
    query: "  ",
    category: "",
    origin: "",
    unit: "",
    sortField: "default",
    sortDirection: "desc",
  }));

  assert.equal(link.search, "");
  assert.equal(link.hash, "#catalog");
});
