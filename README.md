# Platform Klien Ekspor — Web

Repositori untuk aplikasi web klien ekspor.

**Repo pendamping:** [aplikasi mobile](https://github.com/muchlisbstg/export-client-mobile)

## Cakupan produk

Aplikasi ini ditujukan bagi klien yang menjalankan kegiatan perdagangan ekspor. Cakupan produk mengecualikan pertambangan/ekstraksi, alkohol dan wine, serta produk babi atau turunannya.

## Integrasi dengan aplikasi mobile

Aplikasi web dan mobile dirancang sebagai dua klien terpisah yang menggunakan **satu backend/API bersama**. Sinkronisasi data pengguna dilakukan melalui backend tersebut—bukan dengan menyinkronkan kode antar-repo atau menghubungkan perangkat secara langsung.

Agar kedua aplikasi tetap kompatibel:

- keduanya harus mengacu pada kontrak API dan versi endpoint yang sama;
- autentikasi dan data bersama dikelola oleh backend;
- perubahan model data, validasi, paginasi, dan format error perlu diterapkan konsisten pada kedua klien;
- alamat API dikonfigurasi melalui environment (misalnya `API_BASE_URL`), bukan ditanam di kode;
- token dan rahasia tidak boleh disimpan di repo.

## Status

Repo saat ini berisi dokumentasi awal saja. Framework web, backend/API, autentikasi, dan implementasi aplikasi belum dipilih atau dibuat. Karena itu, sinkronisasi runtime belum aktif; bagian di atas adalah pola integrasi yang akan digunakan saat implementasi dimulai.
