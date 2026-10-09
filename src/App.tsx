import { useEffect, useRef, useState, type FormEvent } from "react";
import { catalogSortOptions, filterProducts, getActiveCatalogFilters, getCategories, getFacetCounts, getOrigins, getDifferingComparisonFields, sortProducts, toggleCompareSelection, MAX_COMPARE_PRODUCTS, type CatalogSortDirection, type CatalogSortField } from "./catalog";
import { validateInquiryField, validateInquiryForm, type InquiryField, type InquiryFieldErrors } from "./rfq-validation";

type Product = {
  id: string;
  name: string;
  category: string;
  origin: string;
  unit: string;
};

type InquiryStatus = {
  status: string;
  createdAt: string;
  productName: string;
};

const initialForm = {
  customerName: "",
  customerEmail: "",
  destinationCountry: "",
  productId: "",
  quantity: "1000",
};

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedOrigin, setSelectedOrigin] = useState("");
  const [catalogSortField, setCatalogSortField] = useState<CatalogSortField>("default");
  const [catalogSortDirection, setCatalogSortDirection] = useState<CatalogSortDirection>("asc");
  const [compareProductIds, setCompareProductIds] = useState<string[]>([]);
  const catalogSearchRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState<InquiryFieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingInput, setTrackingInput] = useState("");
  const [trackedInquiry, setTrackedInquiry] = useState<InquiryStatus | null>(null);

  async function loadProducts() {
    setLoading(true);
    setError("");
    setCatalogError("");
    try {
      const response = await fetch("/api/v1/products");
      if (!response.ok) throw new Error("Katalog belum dapat dimuat.");
      const result = (await response.json()) as { data: Product[] };
      setProducts(result.data);
      setForm((current) => ({ ...current, productId: current.productId || result.data[0]?.id || "" }));
    } catch (caught) {
      setCatalogError(caught instanceof Error ? caught.message : "API tidak dapat dihubungi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const visibleProducts = sortProducts(filterProducts(products, catalogQuery, selectedCategory, selectedOrigin), catalogSortField, catalogSortDirection);
  const categories = getCategories(products);
  const origins = getOrigins(products);
  const categoryFacetProducts = filterProducts(products, catalogQuery, "", selectedOrigin);
  const originFacetProducts = filterProducts(products, catalogQuery, selectedCategory, "");
  const categoryFacetCounts = getFacetCounts(categoryFacetProducts, "category");
  const originFacetCounts = getFacetCounts(originFacetProducts, "origin");
  const activeCatalogFilters = getActiveCatalogFilters(catalogQuery, selectedCategory, selectedOrigin);
  const hasActiveCatalogFilters = activeCatalogFilters.length > 0;
  const comparedProducts = products.filter((product) => compareProductIds.includes(product.id));
  const differingComparisonFields = getDifferingComparisonFields(comparedProducts);

  function toggleCompare(productId: string) {
    setCompareProductIds((current) => toggleCompareSelection(current, productId));
  }

  function resetCatalogFilters() {
    setCatalogQuery("");
    setSelectedCategory("");
    setSelectedOrigin("");
    catalogSearchRef.current?.focus();
  }

  function clearCatalogFilter(key: "search" | "category" | "origin") {
    if (key === "search") setCatalogQuery("");
    else if (key === "category") setSelectedCategory("");
    else setSelectedOrigin("");
  }

  function updateInquiryField(field: InquiryField, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const message = validateInquiryField(field, value);
      const next = { ...current };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setTrackedInquiry(null);
    const errors = validateInquiryForm(form);
    setFieldErrors(errors);
    const firstInvalidField = (Object.keys(errors) as InquiryField[])[0];
    if (firstInvalidField) {
      requestAnimationFrame(() => document.getElementById(`rfq-${firstInvalidField}`)?.focus());
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customerName: form.customerName.trim(),
          customerEmail: form.customerEmail.trim(),
          destinationCountry: form.destinationCountry.trim(),
          productId: form.productId.trim(),
          quantity: Number(form.quantity),
        }),
      });
      const result = (await response.json()) as { trackingCode?: string; error?: string };
      if (!response.ok || !result.trackingCode) {
        if (result.error === "rate_limit_exceeded") throw new Error("Batas permintaan tercapai. Coba lagi beberapa menit lagi.");
        throw new Error(result.error === "product_not_found" ? "Produk tidak ditemukan." : "Periksa kembali data permintaan.");
      }
      setTrackingCode(result.trackingCode);
      setTrackingInput(result.trackingCode);
      setForm((current) => ({ ...initialForm, productId: current.productId }));
      setFieldErrors({});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Permintaan gagal dikirim.");
    } finally {
      setSubmitting(false);
    }
  }

  async function trackInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setTrackedInquiry(null);
    const code = trackingInput.trim().toUpperCase();
    try {
      const response = await fetch(`/api/v1/inquiries/${encodeURIComponent(code)}`);
      const result = (await response.json()) as { data?: InquiryStatus; error?: string };
      if (!response.ok || !result.data) {
        if (result.error === "rate_limit_exceeded") throw new Error("Batas pelacakan tercapai. Coba lagi beberapa menit lagi.");
        throw new Error(result.error === "inquiry_not_found" ? "Permintaan tidak ditemukan." : "Kode pelacakan tidak valid.");
      }
      setTrackedInquiry(result.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status belum dapat dimuat.");
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Export Client beranda">
          <span className="brand-mark">E</span>
          <span>Export<span className="brand-light">Client</span></span>
        </a>
        <span className="sync-pill"><span className="status-dot" /> Peer API · web + mobile + desktop</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">PORTAL KLIEN EKSPOR</p>
          <h1>Permintaan ekspor,<br /><em>lebih terhubung.</em></h1>
          <p className="hero-description">Jelajahi katalog demo, ajukan permintaan penawaran, dan lanjutkan pelacakan dari web, mobile, maupun desktop.</p>
          <a className="text-link" href="#catalog">Jelajahi katalog <span aria-hidden="true">↓</span></a>
        </div>
        <div className="hero-card" aria-label="Ringkasan produk demo">
          <div className="card-topline"><span>PORTOFOLIO</span><span className="card-index">01 / 03</span></div>
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="hero-seal"><span>EC</span></div>
          <div className="hero-card-footer"><span>INDONESIA<br /><small>ORIGIN MARKET</small></span><span className="seal-line" /><span>EXPORT<br /><small>CLIENT PORTAL</small></span></div>
        </div>
      </section>

      <section className="section" id="catalog">
        <div className="section-heading">
          <div><p className="eyebrow">01 — KATALOG</p><h2>Produk pilihan</h2></div>
          <p className="section-note">Data contoh untuk pengembangan awal.<br />Konfirmasi ketersediaan sebelum transaksi.</p>
        </div>
        {loading ? <p className="quiet-message">Memuat katalog…</p> : catalogError ? (
          <div className="catalog-load-error" role="alert">
            <div><strong>Katalog tidak dapat dimuat</strong><p>{catalogError}</p></div>
            <button type="button" onClick={() => void loadProducts()}>Coba lagi</button>
          </div>
        ) : products.length === 0 ? <p className="quiet-message">Katalog kosong.</p> : (
          <>
            <div className="catalog-controls" aria-label="Pencarian dan filter katalog">
              <div className="catalog-search-row">
                <label className="catalog-search">
                  <span className="catalog-search-icon" aria-hidden="true">⌕</span>
                  <span className="sr-only">Cari nama, kategori, atau asal</span>
                  <input
                    ref={catalogSearchRef}
                    type="search"
                    value={catalogQuery}
                    onChange={(event) => setCatalogQuery(event.target.value)}
                    placeholder="Cari nama, kategori, atau asal…"
                    autoComplete="off"
                  />
                  {catalogQuery && <button type="button" aria-label="Hapus teks pencarian" onClick={() => { setCatalogQuery(""); catalogSearchRef.current?.focus(); }}>×</button>}
                </label>
                {hasActiveCatalogFilters && <button className="catalog-reset" type="button" onClick={resetCatalogFilters}>Reset filter</button>}
              </div>
              <div className="catalog-filter-row">
                <span className="catalog-filter-label">Kategori</span>
                <div className="catalog-chips" role="group" aria-label="Filter berdasarkan kategori">
                  {["", ...categories].map((category) => (
                    <button
                      className="catalog-chip"
                      key={category || "all"}
                      type="button"
                      aria-pressed={selectedCategory === category}
                      onClick={() => setSelectedCategory(category)}
                    >{category ? `${category} (${categoryFacetCounts.get(category) ?? 0})` : `Semua (${categoryFacetProducts.length})`}</button>
                  ))}
                </div>
              </div>
              <div className="catalog-filter-row">
                <span className="catalog-filter-label">Asal</span>
                <div className="catalog-chips" role="group" aria-label="Filter berdasarkan asal">
                  {["", ...origins].map((origin) => (
                    <button
                      className="catalog-chip"
                      key={origin || "all-origins"}
                      type="button"
                      aria-pressed={selectedOrigin === origin}
                      onClick={() => setSelectedOrigin(origin)}
                    >{origin ? `${origin} (${originFacetCounts.get(origin) ?? 0})` : `Semua asal (${originFacetProducts.length})`}</button>
                  ))}
                </div>
              </div>
              <div className="catalog-filter-row">
                <span className="catalog-filter-label">Urutkan</span>
                <div className="catalog-chips" role="group" aria-label="Urutkan produk">
                  {catalogSortOptions.map(({ field, label }) => (
                    <button
                      className="catalog-chip"
                      key={field}
                      type="button"
                      aria-pressed={catalogSortField === field}
                      onClick={() => { setCatalogSortField(field); setCatalogSortDirection("asc"); }}
                    >{label}</button>
                  ))}
                  {catalogSortField !== "default" && (
                    <button
                      className="catalog-chip"
                      type="button"
                      aria-pressed={catalogSortDirection === "desc"}
                      aria-label={`Urutan ${catalogSortDirection === "asc" ? "A sampai Z" : "Z sampai A"}; ubah ke ${catalogSortDirection === "asc" ? "Z sampai A" : "A sampai Z"}`}
                      onClick={() => setCatalogSortDirection((direction) => direction === "asc" ? "desc" : "asc")}
                    >{catalogSortDirection === "asc" ? "A–Z" : "Z–A"}</button>
                  )}
                </div>
              </div>
            </div>
            {activeCatalogFilters.length > 0 && <div className="catalog-active-filters" role="group" aria-label="Filter aktif">
              <span className="catalog-active-label">Filter aktif</span>
              {activeCatalogFilters.map((filter) => {
                const label = filter.key === "search" ? "Pencarian" : filter.key === "category" ? "Kategori" : "Asal";
                return <span className="catalog-active-chip" key={filter.key}><span>{label}: {filter.value}</span><button type="button" aria-label={`Hapus filter ${label.toLowerCase()}: ${filter.value}`} onClick={() => clearCatalogFilter(filter.key)}>×</button></span>;
              })}
            </div>}
            <div className="catalog-results-toolbar">
              <p className="catalog-result-count" role="status" aria-live="polite"><strong>{visibleProducts.length}</strong> dari {products.length} produk</p>
              <span className="catalog-compare-count" role="status" aria-live="polite">Pembanding: {comparedProducts.length}/{MAX_COMPARE_PRODUCTS}</span>
            </div>
            {visibleProducts.length === 0 ? (
              <div className="catalog-empty-state" role="status">
                <strong>Tidak ada produk yang cocok</strong>
                <p>Coba kata lain atau hapus filter untuk melihat semua produk.</p>
                <button type="button" onClick={resetCatalogFilters}>Hapus filter</button>
              </div>
            ) : (
              <div className="product-grid">
                {visibleProducts.map((product) => {
                  const index = products.findIndex((item) => item.id === product.id);
                  return (
                    <article className="product-card" key={product.id}>
                      <div className={`product-art art-${index % 3}`}><span className="product-number">{String(index + 1).padStart(2, "0")}</span><span className="product-stamp">{product.origin}</span></div>
                      <div className="product-details"><span className="product-category">{product.category}</span><h3>{product.name}</h3><p>Asal {product.origin} <span>·</span> Satuan {product.unit}</p><button className={`compare-toggle${compareProductIds.includes(product.id) ? " is-selected" : ""}`} type="button" aria-pressed={compareProductIds.includes(product.id)} disabled={!compareProductIds.includes(product.id) && compareProductIds.length >= MAX_COMPARE_PRODUCTS} onClick={() => toggleCompare(product.id)}>{compareProductIds.includes(product.id) ? "✓ Ditambahkan" : "Bandingkan"}</button></div>
                    </article>
                  );
                })}
              </div>
            )}
            {compareProductIds.length > 0 && <section className="catalog-compare-panel" aria-label="Perbandingan produk">
              <div className="catalog-compare-heading"><div><h3>Perbandingan produk</h3><p role="status" aria-live="polite">{comparedProducts.length} dari {MAX_COMPARE_PRODUCTS} dipilih · atribut dari katalog API</p></div><button type="button" onClick={() => setCompareProductIds([])}>Hapus semua</button></div>
              {comparedProducts.length < 2 ? <p className="catalog-compare-hint">Pilih setidaknya satu produk lagi untuk membandingkan detail.</p> : <div className="catalog-compare-table-wrap"><table className="catalog-compare-table"><thead><tr><th scope="col">Detail</th>{comparedProducts.map((product) => <th scope="col" key={product.id}><span>{product.name}</span><button type="button" aria-label={`Hapus ${product.name} dari perbandingan`} onClick={() => toggleCompare(product.id)}>×</button></th>)}</tr></thead><tbody><tr><th scope="row">Kategori</th>{comparedProducts.map((product) => <td key={product.id} className={differingComparisonFields.includes("category") ? "is-different" : undefined}>{differingComparisonFields.includes("category") && <span className="catalog-compare-difference">Berbeda</span>}{product.category}</td>)}</tr><tr><th scope="row">Asal</th>{comparedProducts.map((product) => <td key={product.id} className={differingComparisonFields.includes("origin") ? "is-different" : undefined}>{differingComparisonFields.includes("origin") && <span className="catalog-compare-difference">Berbeda</span>}{product.origin}</td>)}</tr><tr><th scope="row">Satuan</th>{comparedProducts.map((product) => <td key={product.id} className={differingComparisonFields.includes("unit") ? "is-different" : undefined}>{differingComparisonFields.includes("unit") && <span className="catalog-compare-difference">Berbeda</span>}{product.unit}</td>)}</tr></tbody></table></div>}
            </section>}
          </>
        )}
      </section>

      <section className="action-grid" id="inquiry">
        <div className="form-panel">
          <div className="section-heading compact"><div><p className="eyebrow">02 — RFQ</p><h2>Ajukan penawaran</h2></div></div>
          <p className="form-intro">Isi kebutuhan Anda. Permintaan tersimpan pada backend lokal dan direplikasi ke peer yang dikonfigurasi.</p>
          <form className="form-grid" onSubmit={submitInquiry} noValidate>
            <label htmlFor="rfq-customerName">Nama lengkap<input id="rfq-customerName" required autoComplete="name" value={form.customerName} onChange={(event) => updateInquiryField("customerName", event.target.value)} aria-invalid={Boolean(fieldErrors.customerName)} aria-describedby={fieldErrors.customerName ? "rfq-customerName-error" : undefined} placeholder="Nama Anda" />{fieldErrors.customerName && <span className="field-error" id="rfq-customerName-error" aria-live="polite">{fieldErrors.customerName}</span>}</label>
            <label htmlFor="rfq-customerEmail">Email kerja<input id="rfq-customerEmail" required type="email" autoComplete="email" value={form.customerEmail} onChange={(event) => updateInquiryField("customerEmail", event.target.value)} aria-invalid={Boolean(fieldErrors.customerEmail)} aria-describedby={fieldErrors.customerEmail ? "rfq-customerEmail-error" : undefined} placeholder="nama@perusahaan.com" />{fieldErrors.customerEmail && <span className="field-error" id="rfq-customerEmail-error" aria-live="polite">{fieldErrors.customerEmail}</span>}</label>
            <label htmlFor="rfq-destinationCountry">Negara tujuan<input id="rfq-destinationCountry" required autoComplete="country-name" value={form.destinationCountry} onChange={(event) => updateInquiryField("destinationCountry", event.target.value)} aria-invalid={Boolean(fieldErrors.destinationCountry)} aria-describedby={fieldErrors.destinationCountry ? "rfq-destinationCountry-error" : undefined} placeholder="Contoh: Jepang" />{fieldErrors.destinationCountry && <span className="field-error" id="rfq-destinationCountry-error" aria-live="polite">{fieldErrors.destinationCountry}</span>}</label>
            <label htmlFor="rfq-productId">Produk<select id="rfq-productId" required value={form.productId} onChange={(event) => updateInquiryField("productId", event.target.value)} aria-invalid={Boolean(fieldErrors.productId)} aria-describedby={fieldErrors.productId ? "rfq-productId-error" : undefined}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>{fieldErrors.productId && <span className="field-error" id="rfq-productId-error" aria-live="polite">{fieldErrors.productId}</span>}</label>
            <label className="full-width" htmlFor="rfq-quantity">Jumlah (kg)<input id="rfq-quantity" required type="number" min="0" max="1000000" step="any" value={form.quantity} onChange={(event) => updateInquiryField("quantity", event.target.value)} aria-invalid={Boolean(fieldErrors.quantity)} aria-describedby={fieldErrors.quantity ? "rfq-quantity-error" : undefined} />{fieldErrors.quantity && <span className="field-error" id="rfq-quantity-error" aria-live="polite">{fieldErrors.quantity}</span>}</label>
            <button className="primary-button full-width" type="submit" disabled={submitting || loading || products.length === 0}>{submitting ? "Mengirim…" : "Kirim permintaan"}<span aria-hidden="true">↗</span></button>
          </form>
          {trackingCode && <div className="success-box" role="status"><strong>Permintaan tersimpan.</strong><span>Kode pelacakan Anda (simpan untuk digunakan di web, mobile, atau desktop yang tersinkron):</span><code>{trackingCode}</code></div>}
        </div>

        <div className="tracking-panel">
          <p className="eyebrow">03 — STATUS</p><h2>Lanjutkan dari<br />perangkat lain.</h2>
          <p className="form-intro">Masukkan kode pelacakan yang diterima saat mengirim permintaan di salah satu aplikasi.</p>
          <form className="tracking-form" onSubmit={trackInquiry}>
            <label htmlFor="tracking-code">Kode pelacakan</label>
            <div className="tracking-input-row"><input id="tracking-code" required value={trackingInput} onChange={(event) => setTrackingInput(event.target.value)} placeholder="Contoh: A1B2C3…" autoCapitalize="characters" /><button type="submit" aria-label="Lacak permintaan">→</button></div>
          </form>
          {trackedInquiry && <div className="tracking-result" role="status"><span className="status-dot" /><div><strong>{trackedInquiry.status === "received" ? "Diterima" : trackedInquiry.status}</strong><span>{trackedInquiry.productName} · {new Date(trackedInquiry.createdAt).toLocaleString("id-ID")}</span></div></div>}
          {error && <p className="error-message" role="alert">{error}</p>}
          <div className="privacy-note"><span className="lock-icon">⌑</span><span>Kode pelacakan bersifat privat. Jangan bagikan kepada orang lain.</span></div>
        </div>
      </section>

      <footer className="footer"><span>ExportClient · MVP</span><span>Data demo · belum untuk transaksi</span></footer>
    </main>
  );
}
