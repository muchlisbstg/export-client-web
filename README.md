# Platform Klien Ekspor — Web

Aplikasi web sekaligus server API bersama untuk [aplikasi mobile](https://github.com/muchlisbstg/export-client-mobile). Kedua klien membaca katalog dan membuat/melacak permintaan penawaran melalui backend yang sama.

## Jalankan lokal

Gunakan Node.js 22 atau lebih baru.

```bash
npm ci
cp .env.example .env
npm run dev
```

Frontend tersedia di `http://localhost:5173`, API di `http://localhost:4000`. Database SQLite dibuat otomatis di `data/export-client.sqlite` dan tidak dimasukkan ke Git.

Untuk menjalankan build web melalui server API:

```bash
npm run build
NODE_ENV=production npm start
```

Buka `http://localhost:4000`. Server harus memakai penyimpanan disk yang persisten agar data demo tidak hilang ketika layanan dimulai ulang.

## Sinkronisasi dengan mobile

Kontrak bersama ada di [`docs/openapi.yaml`](docs/openapi.yaml). Produk yang tersedia berasal dari API. Permintaan yang dibuat dari web atau mobile tersimpan pada database yang sama; kode pelacakan 24 karakter dapat digunakan di kedua aplikasi untuk melihat status.

Agar mobile dapat menghubungi server dari emulator atau perangkat fisik, atur `EXPO_PUBLIC_API_URL` di repo mobile ke alamat server yang dapat dijangkau perangkat. Detailnya ada di README repo mobile.

## Cakupan dan keamanan MVP

Seed produk hanya data contoh, bukan penawaran atau ketersediaan nyata. Ruang lingkup produk mengecualikan pertambangan/ekstraksi, alkohol dan wine, serta produk babi atau turunannya.

Kode pelacakan adalah rahasia pembawa: siapa pun yang memilikinya dapat membaca status dan nama produk, tetapi API tidak mengembalikan nama atau email pemohon. Data kontak disimpan lokal di SQLite untuk tindak lanjut, namun MVP ini belum memiliki login, kontrol admin, atau kebijakan retensi. Sebelum menangani transaksi/klien nyata, tambahkan autentikasi, perlindungan spam, pengamanan dan retensi data pribadi, TLS, backup, serta penyimpanan persisten yang sesuai deployment.
