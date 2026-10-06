import { useEffect, useState, type FormEvent } from "react";

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
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingInput, setTrackingInput] = useState("");
  const [trackedInquiry, setTrackedInquiry] = useState<InquiryStatus | null>(null);

  async function loadProducts() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/products");
      if (!response.ok) throw new Error("Katalog belum dapat dimuat.");
      const result = (await response.json()) as { data: Product[] };
      setProducts(result.data);
      setForm((current) => ({ ...current, productId: current.productId || result.data[0]?.id || "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "API tidak dapat dihubungi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setTrackedInquiry(null);
    try {
      const response = await fetch("/api/v1/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, quantity: Number(form.quantity) }),
      });
      const result = (await response.json()) as { trackingCode?: string; error?: string };
      if (!response.ok || !result.trackingCode) {
        if (result.error === "rate_limit_exceeded") throw new Error("Batas permintaan tercapai. Coba lagi beberapa menit lagi.");
        throw new Error(result.error === "product_not_found" ? "Produk tidak ditemukan." : "Periksa kembali data permintaan.");
      }
      setTrackingCode(result.trackingCode);
      setTrackingInput(result.trackingCode);
      setForm((current) => ({ ...initialForm, productId: current.productId }));
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
        <span className="sync-pill"><span className="status-dot" /> API bersama · web + mobile</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">PORTAL KLIEN EKSPOR</p>
          <h1>Permintaan ekspor,<br /><em>lebih terhubung.</em></h1>
          <p className="hero-description">Jelajahi katalog demo, ajukan permintaan penawaran, dan lanjutkan pelacakan dari aplikasi web maupun mobile.</p>
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
        {loading ? <p className="quiet-message">Memuat katalog…</p> : products.length === 0 ? <p className="quiet-message">Katalog kosong.</p> : (
          <div className="product-grid">
            {products.map((product, index) => (
              <article className="product-card" key={product.id}>
                <div className={`product-art art-${index % 3}`}><span className="product-number">0{index + 1}</span><span className="product-stamp">{product.origin}</span></div>
                <div className="product-details"><span className="product-category">{product.category}</span><h3>{product.name}</h3><p>Asal {product.origin} <span>·</span> Satuan {product.unit}</p></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="action-grid" id="inquiry">
        <div className="form-panel">
          <div className="section-heading compact"><div><p className="eyebrow">02 — RFQ</p><h2>Ajukan penawaran</h2></div></div>
          <p className="form-intro">Isi kebutuhan Anda. Permintaan tersimpan di API bersama dan dapat dilacak melalui aplikasi mobile.</p>
          <form className="form-grid" onSubmit={submitInquiry}>
            <label>Nama lengkap<input required minLength={2} maxLength={120} autoComplete="name" value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} placeholder="Nama Anda" /></label>
            <label>Email kerja<input required type="email" maxLength={254} autoComplete="email" value={form.customerEmail} onChange={(event) => setForm({ ...form, customerEmail: event.target.value })} placeholder="nama@perusahaan.com" /></label>
            <label>Negara tujuan<input required minLength={2} maxLength={80} autoComplete="country-name" value={form.destinationCountry} onChange={(event) => setForm({ ...form, destinationCountry: event.target.value })} placeholder="Contoh: Jepang" /></label>
            <label>Produk<select required value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
            <label className="full-width">Jumlah (kg)<input required type="number" min="1" max="1000000" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
            <button className="primary-button full-width" type="submit" disabled={submitting || loading || products.length === 0}>{submitting ? "Mengirim…" : "Kirim permintaan"}<span aria-hidden="true">↗</span></button>
          </form>
          {trackingCode && <div className="success-box" role="status"><strong>Permintaan tersimpan.</strong><span>Kode pelacakan Anda (simpan untuk digunakan di web atau mobile):</span><code>{trackingCode}</code></div>}
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
