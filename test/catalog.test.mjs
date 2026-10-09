import assert from "node:assert/strict";
import test from "node:test";
import { filterProducts, getCategories, getFacetCounts, getOrigins, sortProducts, toggleCompareSelection, MAX_COMPARE_PRODUCTS } from "../src/catalog.ts";

const products = [
  { id: "coffee", name: "Kopi Arabika", category: "Kopi", origin: "Indonesia", unit: "kg" },
  { id: "cocoa", name: "Biji Kakao Fermentasi", category: "Kakao", origin: "Ekuador", unit: "kg" },
  { id: "vanilla", name: "Vanila Bourbon", category: "Rempah", origin: "Réunion", unit: "kg" },
  { id: "cafe", name: "Café au lait", category: "Cafe", origin: "Côte d'Ivoire", unit: "kg" },
];

test("search matches product name, category, and origin", () => {
  assert.deepEqual(filterProducts(products, "arabika").map((item) => item.id), ["coffee"]);
  assert.deepEqual(filterProducts(products, "rempah").map((item) => item.id), ["vanilla"]);
  assert.deepEqual(filterProducts(products, "ekuador").map((item) => item.id), ["cocoa"]);
});

test("search ignores letter case, surrounding whitespace, and Unicode accents", () => {
  assert.deepEqual(filterProducts(products, "  KOPI  ").map((item) => item.id), ["coffee"]);
  assert.deepEqual(filterProducts(products, "reunion").map((item) => item.id), ["vanilla"]);
  assert.deepEqual(filterProducts(products, "cote d'ivoire").map((item) => item.id), ["cafe"]);
});

test("categories are unique, dynamic, and alphabetically sorted", () => {
  const extended = [...products, { ...products[0], id: "coffee-2" }, { ...products[0], category: "Biji", id: "new" }];
  assert.deepEqual(getCategories(extended), ["Biji", "Cafe", "Kakao", "Kopi", "Rempah"]);
});

test("origins are unique, dynamic, and alphabetically sorted", () => {
  const extended = [...products, { ...products[0], id: "coffee-2" }, { ...products[0], origin: "Bali", id: "new" }];
  assert.deepEqual(getOrigins(extended), ["Bali", "Côte d'Ivoire", "Ekuador", "Indonesia", "Réunion"]);
});

test("facet counts reflect the other active filter and omit empty values", () => {
  const categoriesForIndonesia = getFacetCounts(filterProducts(products, "", "", "Indonesia"), "category");
  assert.deepEqual([...categoriesForIndonesia], [["Kopi", 1]]);
  const originsForCoffee = getFacetCounts(filterProducts(products, "", "Kopi"), "origin");
  assert.deepEqual([...originsForCoffee], [["Indonesia", 1]]);
  const sparse = getFacetCounts([...products, { ...products[0], id: "missing-category", category: "" }], "category");
  assert.equal(sparse.has(""), false);
});

test("text and category filters combine with AND", () => {
  assert.deepEqual(filterProducts(products, "Indonesia", "Kopi").map((item) => item.id), ["coffee"]);
  assert.deepEqual(filterProducts(products, "Indonesia", "Kakao"), []);
});

test("text, category, and origin filters combine with AND", () => {
  assert.deepEqual(filterProducts(products, "kopi", "Kopi", "Indonesia").map((item) => item.id), ["coffee"]);
  assert.deepEqual(filterProducts(products, "", "Kopi", "Ekuador"), []);
});

test("an API category named all remains a real, filterable category", () => {
  const catalog = [...products, { ...products[0], id: "literal-all", category: "all" }];
  assert.deepEqual(filterProducts(catalog, "", "all").map((item) => item.id), ["literal-all"]);
  assert.deepEqual(getCategories(catalog).filter((category) => category === "all"), ["all"]);
});

test("distinct API category strings remain separately filterable despite accent-insensitive text search", () => {
  const catalog = [
    { ...products[0], id: "accented", category: "Café" },
    { ...products[1], id: "plain", category: "Cafe" },
  ];
  assert.equal(getCategories(catalog).length, 2);
  assert.deepEqual(filterProducts(catalog, "", "Café").map((item) => item.id), ["accented"]);
});

test("no-match search returns an empty list", () => {
  assert.deepEqual(filterProducts(products, "produk yang tidak ada"), []);
});

test("filtering returns a new result without mutating the source array", () => {
  const originalOrder = products.map((item) => item.id);
  const result = filterProducts(products, "cocoa");
  assert.notEqual(result, products);
  assert.deepEqual(products.map((item) => item.id), originalOrder);
});

const sortableProducts = [
  { id: "zulu", name: "Zebra", category: "Rempah", origin: "Zambia", unit: "kg" },
  { id: "name-two-a", name: "Produk 2", category: "Minuman", origin: "Bali", unit: "bag" },
  { id: "name-two-b", name: "Produk 2", category: "Minuman", origin: "Bali", unit: "box" },
  { id: "name-ten", name: "Produk 10", category: "Bahan", origin: "Jakarta", unit: "g" },
];

test("local sorting supports each existing catalog field with Indonesian natural ordering", () => {
  assert.deepEqual(sortProducts(sortableProducts, "name").map((item) => item.id), ["name-two-a", "name-two-b", "name-ten", "zulu"]);
  assert.deepEqual(sortProducts(sortableProducts, "category").map((item) => item.id), ["name-ten", "name-two-a", "name-two-b", "zulu"]);
  assert.deepEqual(sortProducts(sortableProducts, "origin").map((item) => item.id), ["name-two-a", "name-two-b", "name-ten", "zulu"]);
  assert.deepEqual(sortProducts(sortableProducts, "unit").map((item) => item.id), ["name-two-a", "name-two-b", "name-ten", "zulu"]);
});

test("descending sorting is stable for ties and sorting a filtered list leaves source order unchanged", () => {
  const originalOrder = sortableProducts.map((item) => item.id);
  const descending = sortProducts(sortableProducts, "name", "desc");
  assert.deepEqual(descending.map((item) => item.id), ["zulu", "name-ten", "name-two-a", "name-two-b"]);
  const filteredSorted = sortProducts(filterProducts(sortableProducts, "produk"), "name", "desc");
  assert.deepEqual(filteredSorted.map((item) => item.id), ["name-ten", "name-two-a", "name-two-b"]);
  assert.deepEqual(sortProducts(sortableProducts, "default").map((item) => item.id), originalOrder);
  assert.notEqual(sortProducts(sortableProducts, "default"), sortableProducts);
  assert.deepEqual(sortableProducts.map((item) => item.id), originalOrder);
});

test("comparison selection toggles ids in order, removes selected ids, and never mutates input", () => {
  const selected = ["coffee", "cocoa"];
  assert.deepEqual(toggleCompareSelection(selected, "vanilla"), ["coffee", "cocoa", "vanilla"]);
  assert.deepEqual(toggleCompareSelection(selected, "coffee"), ["cocoa"]);
  assert.deepEqual(selected, ["coffee", "cocoa"]);
});

test("comparison selection enforces the three-product cap and cleans duplicate ids", () => {
  assert.equal(MAX_COMPARE_PRODUCTS, 3);
  assert.deepEqual(toggleCompareSelection(["coffee", "cocoa", "vanilla"], "tea"), ["coffee", "cocoa", "vanilla"]);
  assert.deepEqual(toggleCompareSelection(["coffee", "coffee", ""], "tea"), ["coffee", "tea"]);
  assert.deepEqual(toggleCompareSelection([], "", 3), []);
});
