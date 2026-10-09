import assert from "node:assert/strict";
import test from "node:test";
import { formatCatalogShare } from "../src/catalog-share.ts";

const products = [
  { name: "Kopi Gayo", category: "Biji kopi", origin: "Aceh", unit: "kg" },
  { name: "Kakao", category: "Kakao", origin: "Sulawesi", unit: "kg" },
];

test("formats the supplied result order and active filter/sort context", () => {
  assert.equal(formatCatalogShare([products[1], products[0]], {
    query: " kopi ", category: "Biji kopi", origin: "Aceh", sortField: "name", sortDirection: "desc",
  }), [
    "Katalog ekspor — 2 produk",
    'Filter: Pencarian: "kopi"; Kategori: "Biji kopi"; Asal: "Aceh"',
    "Urutan: Nama (Z–A)",
    "",
    "1. Kakao — Kakao · Sulawesi · per kg",
    "2. Kopi Gayo — Biji kopi · Aceh · per kg",
  ].join("\n"));
});

test("cleans whitespace in catalog values and filter text", () => {
  assert.equal(formatCatalogShare([{ name: "  Kopi\n  Gayo ", category: "", origin: "Aceh", unit: "" }], { query: "\n kopi   " }), [
    "Katalog ekspor — 1 produk",
    'Filter: Pencarian: "kopi"',
    "",
    "1. Kopi Gayo — Aceh",
  ].join("\n"));
});

test("reports empty results and does not mutate the product list", () => {
  const input = products.map((product) => ({ ...product }));
  const snapshot = structuredClone(input);
  assert.equal(formatCatalogShare([], { category: "Rempah" }), [
    "Katalog ekspor — 0 produk",
    'Filter: Kategori: "Rempah"',
    "",
    "Tidak ada produk yang cocok.",
  ].join("\n"));
  formatCatalogShare(input);
  assert.deepEqual(input, snapshot);
});
