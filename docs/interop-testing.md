# Verifikasi interoperabilitas tiga backend

Runbook ini menjalankan backend Web, Mobile, dan Desktop yang sebenarnya secara lokal untuk memeriksa kontrak sinkronisasi lintas repositori. Harness memakai tiga inquiry sintetis, port loopback yang dipilih secara dinamis, dan database SQLite sementara; ia tidak membaca database aplikasi atau memakai data klien nyata. Ini adalah verifikasi tes lokal, bukan deployment atau uji produksi.

## Menjalankan secara lokal

Gunakan Node.js 22 atau lebih baru. Siapkan ketiga checkout dan pasang dependensi masing-masing:

```bash
WORKSPACE=/path/ke/folder-checkout
(cd "$WORKSPACE/export-client-web-sync" && npm ci)
(cd "$WORKSPACE/export-client-mobile-sync" && npm ci)
(cd "$WORKSPACE/export-client-desktop-sync" && npm ci)
```

Jalankan harness dari repositori Web:

```bash
cd "$WORKSPACE/export-client-web-sync"
npm run test:interop
```

Secara default, harness mengharapkan ketiga folder repo berada sejajar. Jika checkout Mobile atau Desktop ada di lokasi lain, jalankan dari root Web dengan path absolut:

```bash
MOBILE_REPO=/path/absolut/export-client-mobile-sync \
DESKTOP_REPO=/path/absolut/export-client-desktop-sync \
npm run test:interop
```

Harness membuat konfigurasi kosong untuk proses Web dan Mobile, memberi setiap server path database sementara, lalu menutup layanan dan menghapus folder sementara pada akhir tes. Secret yang dipakai hanya nilai fixture untuk tes dan tidak dimaksudkan untuk penggunaan selain tes.

## Cakupan yang diverifikasi

Harness membuat satu inquiry sintetis dari setiap backend. Setelah replikasi, setiap database harus berisi tepat tiga record (sembilan baris total), mempertahankan `originNodeId`, dan memiliki outbox kosong. Endpoint pelacakan pada ketiga backend juga harus menampilkan status, waktu pembuatan, dan nama produk tanpa membuka email pelanggan.

Pada setiap backend, harness mengirim ulang record yang identik dan mengharapkan respons duplikat tanpa baris tambahan. Ia juga mengirim payload berbeda dengan ID yang sama serta ID baru yang memakai tracking code lama; keduanya harus ditolak dengan HTTP 409, mencatat konflik, dan mempertahankan semua field record asli. Hasil yang lulus mencakup tiga replay duplikat, tiga konflik payload, tiga benturan tracking-code, serta enam catatan konflik tersimpan.

Ketiga workflow CI—Web, Mobile, dan Desktop—menjalankan interoperabilitas saat push dan pull request. Workflow Web juga mendukung pemicu manual dan jadwal harian terhadap versi `main` Mobile dan Desktop; pada pull request, repo yang sedang diuji dipasangkan dengan `main` dua repo lainnya.

## Batas verifikasi

Tes ini memverifikasi perilaku kontrak dan replikasi dengan data fixture lokal. Tes ini tidak memutuskan atau menerapkan autentikasi pengguna, administrasi, retensi data, deployment, atau penggunaan produksi; jangan gunakan data klien nyata.
