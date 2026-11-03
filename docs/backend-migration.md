# Migrasi backend Node.js dan layanan ML

Node.js/Fastify melayani seluruh endpoint `/api/v1` untuk web dan Android. FastAPI hanya menjalankan `/predict` dan `/health` pada network privat. Proxy, domain demo, cookie, format JWT/refresh token, kategori, status, dan respons bisnis dipertahankan. APK yang memakai URL demo yang sama tidak memerlukan build ulang untuk perubahan backend ini.

## Database dan sesi lama

Migrasi `services/api/migrations/001_initial.sql` kompatibel dengan tabel PostgreSQL dari Alembic versi awal. Migrator memakai transaksi dan advisory lock, membuat tabel yang belum ada, memeriksa kolom bisnis, dan mencatat checksum pada `schema_migrations`. Tabel `alembic_version` lama dapat tetap ada untuk provenance; migrator tidak menghapus atau mengganti data bisnis. Seed mempertahankan password Admin yang sudah ada.

Argon2 dari Python dapat diverifikasi oleh backend Node.js. JWT tetap HS256 dengan issuer `smart-waste`, audience `smart-waste-clients`, subject UUID dan ID sesi; JWT_SECRET harus dipertahankan. Refresh token dan hash SHA256 tetap memakai format yang sama. Jangan mengganti JWT_SECRET selama migrasi jika sesi lama ingin tetap berlaku.

## Urutan deployment

1. Jalankan backup database/media menggunakan konfigurasi yang sedang aktif. Simpan source/image lama serta environment privat untuk rollback.
2. Uji backend baru pada PostgreSQL terisolasi. Uji salinan database lama sebelum mengganti layanan aktif.
3. Tambahkan ML_SERVICE_TOKEN acak minimal 32 karakter ke environment privat. Compose memberikan token yang sama kepada Node.js dan ML. Tidak ada token ini di APK.
4. Build image `api` dan `ml` terlebih dahulu. Model lama tetap di `ml/artifacts`, sekarang dipasang read-only pada `ml`.
5. Ganti layanan dengan Compose. Node.js menjalankan migrasi SQL dan seed idempotent saat startup. Database/media memakai named volume yang sama dan UID proses 999 dipertahankan.
6. Periksa `/api/ready` menampilkan `backend: nodejs` dan `model_loaded: true`. Periksa login dengan akun lama, sesi pra-migrasi, foto lama, prediksi ketiga kelas, dan workflow laporan.

## Rollback

Jika aplikasi baru belum layak, kembalikan source/Compose dan tag image API lama, lalu jalankan kembali layanan lama menggunakan volume yang sama. Migrasi awal Node.js hanya menambahkan pencatatan migrasi, sehingga skema bisnis tetap kompatibel. Pemulihan snapshot database/media hanya dilakukan bila diperlukan dan dengan persetujuan mengganti data aktif; snapshot menghapus perubahan yang dibuat setelah waktu backup.

## Perilaku saat ML gagal

Node.js memvalidasi dan menyimpan foto JPEG tanpa EXIF menggunakan Sharp. Untuk inferensi, upload asli diteruskan ke FastAPI yang mempertahankan canonicalization Pillow serta resize RGB 224×224 dari training. Model dan hasil evaluasi 97,32% tidak dilatih ulang atau diubah. Jika ML terputus, timeout, atau respons tidak valid, Node.js tetap menerima laporan berkategori manual dan mencatat prediksi sebagai `unavailable`. Endpoint prediksi mandiri memberi 503.
