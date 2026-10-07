import assert from "node:assert/strict";
import test from "node:test";
import { validateInquiryField, validateInquiryForm } from "../src/rfq-validation.ts";

const validForm = {
  customerName: "Sari Export",
  customerEmail: "sari@example.co.id",
  destinationCountry: "Jepang",
  productId: "coffee-arabica",
  quantity: "1000",
};

test("accepts trimmed values at contract boundaries and positive fractional quantities", () => {
  assert.deepEqual(validateInquiryForm({
    customerName: ` ${"N".repeat(120)} `,
    customerEmail: ` ${"a".repeat(242)}@example.co `,
    destinationCountry: ` ${"C".repeat(80)} `,
    productId: "P".repeat(80),
    quantity: "0.5",
  }), {});
});

test("reports required, format, and range errors by field", () => {
  assert.deepEqual(validateInquiryForm({
    customerName: " ", customerEmail: "not-an-email", destinationCountry: "X",
    productId: "", quantity: "0",
  }), {
    customerName: "Nama wajib diisi minimal 2 karakter.",
    customerEmail: "Masukkan alamat email yang valid.",
    destinationCountry: "Negara tujuan wajib diisi minimal 2 karakter.",
    productId: "Pilih produk.",
    quantity: "Jumlah harus lebih dari 0.",
  });
});

test("enforces maximum lengths and the API quantity ceiling", () => {
  assert.equal(validateInquiryField("customerName", "N".repeat(121)), "Nama maksimal 120 karakter.");
  assert.equal(validateInquiryField("customerEmail", `${"a".repeat(244)}@example.co`), "Email maksimal 254 karakter.");
  assert.equal(validateInquiryField("destinationCountry", "C".repeat(81)), "Negara tujuan maksimal 80 karakter.");
  assert.equal(validateInquiryField("productId", "P".repeat(81)), "Pilihan produk tidak valid.");
  assert.equal(validateInquiryField("quantity", "1000001"), "Jumlah maksimal 1.000.000.");
});

test("rejects malformed email and non-finite quantities", () => {
  assert.notEqual(validateInquiryField("customerEmail", "a..b@example.com"), "");
  assert.notEqual(validateInquiryField("customerEmail", "a@example"), "");
  assert.notEqual(validateInquiryField("quantity", "Infinity"), "");
  assert.notEqual(validateInquiryField("quantity", ""), "");
});

test("accepts the existing API payload shape without changing its field names", () => {
  assert.deepEqual(validateInquiryForm(validForm), {});
});
