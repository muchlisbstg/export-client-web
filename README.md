# Platform Klien Ekspor — Web

Aplikasi web sekaligus server API bersama untuk [aplikasi mobile](https://github.com/muchlisbstg/export-client-mobile-sync). Kedua klien membaca katalog dan membuat/melacak permintaan penawaran melalui backend yang sama.

## Jalankan lokal

Gunakan Node.js 22 atau lebih baru.

```bash
npm ci
cp .env.example .env
npm run dev
```

Jalankan smoke test API dengan `npm test`; tes menggunakan database sementara dan memeriksa validasi, RFQ, pelacakan, serta rate limit.

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

API membatasi pembuatan RFQ menjadi 10 request dan lookup menjadi 60 request per 15 menit per IP; nilainya dapat diatur lewat `.env.example`. `TRUST_PROXY_HOPS` default 0. Ubah hanya jika jumlah reverse proxy tepercaya diketahui tepat, agar alamat klien tidak mudah dipalsukan untuk melewati batas. Limiter memakai memori per proses: reset saat server dimulai ulang, tidak berbagi hitungan antar-instance, dan pengguna di balik NAT yang sama berbagi kuota. Untuk multi-instance perlu shared store. Ini mengurangi spam, tetapi bukan pengganti autentikasi.

Kode pelacakan adalah rahasia pembawa: siapa pun yang memilikinya dapat membaca status dan nama produk, tetapi API tidak mengembalikan nama atau email pemohon. Data kontak disimpan lokal di SQLite untuk tindak lanjut, namun MVP ini belum memiliki login, kontrol admin, atau kebijakan retensi. Jangan gunakan untuk transaksi/klien nyata sebelum autentikasi, pengamanan dan retensi data pribadi, TLS, backup, serta penyimpanan persisten yang sesuai deployment tersedia.
