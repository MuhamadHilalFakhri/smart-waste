# Smart Waste

Sistem pelaporan sampah dengan website Next.js, aplikasi Android Expo, backend FastAPI/PostgreSQL, dan klasifikasi Organic Waste, Paper Waste, Plastic Waste menggunakan TensorFlow. Bahasa antarmuka Indonesia.

## Status pengumpulan

Demo: [Smart Waste](https://8080-001m6e4ck17dvek9788p0t5q4fm.sbx.sandboxes-cloud.docker.com). Daftar sebagai User untuk mencoba laporan. Kredensial Admin disimpan privat oleh pemilik deployment.

Kode aplikasi, migrasi, kontrak API, notebook Colab, konfigurasi deployment, dan panduan tersedia. Dataset berisi 2.234 gambar unik. Model nyata hasil Colab mencapai **97,32% accuracy pada 336 gambar testing** dan telah aktif di demo; lihat [evaluasi lengkap](ml/evaluation/README.md). APK dan video diverifikasi terpisah melalui [checklist pengumpulan](docs/submission.md).

## Struktur

| Direktori           | Isi                                                |
| ------------------- | -------------------------------------------------- |
| apps/web            | Next.js App Router, Admin dan User                 |
| apps/mobile         | Expo/React Native, Android                         |
| services/api        | FastAPI modular, database, migrasi, pengujian      |
| packages/api-client | OpenAPI dan client TypeScript bersama              |
| ml                  | Source persiapan dataset, training, notebook Colab |
| infra               | Compose, reverse proxy, bootstrap, backup/restore  |
| docs                | ERD, API, desain, evaluasi kesiapan, naskah video  |

Gunakan Node.js 22+, pnpm 10.32.1, Python 3.12, serta Docker dengan Compose v2. Dependensi JS dipin oleh pnpm-lock.yaml. Dependensi runtime API dan ML dikunci melalui services/api/uv.lock dan requirements.lock; image produksi memakai lock tersebut. Dependensi notebook dipin di ml/requirements.txt.

## Jalankan seluruh layanan dengan Docker

1. Salin `infra/.env.example` menjadi `infra/.env`. Isi password PostgreSQL (hex/URL-safe), JWT secret acak minimal 32 karakter, email Admin, dan password Admin minimal 12 karakter. Jangan commit file ini.
2. Untuk lokal: PUBLIC_ORIGIN=http://localhost:8080, COOKIE_SECURE=false, BIND_ADDRESS=127.0.0.1. Untuk sandbox HTTPS: PUBLIC_ORIGIN harus sama persis dengan origin demo, COOKIE_SECURE=true, BIND_ADDRESS=0.0.0.0.
3. Dari root jalankan `sh infra/bootstrap.sh`. Di Windows gunakan Git Bash atau `docker compose --env-file infra/.env -f infra/compose.yaml up -d --build --wait`.
4. Buka http://localhost:8080 untuk lokal. Migrasi dan seed Admin berjalan saat API mulai. Seed tidak mengganti password Admin yang sudah ada.
5. Masuk memakai email/password Admin dari file environment lokal. Daftar User melalui web atau APK. Jangan mempublikasikan kredensial Admin di README atau video.

Compose hanya membuka proxy port 8080. PostgreSQL dan API tidak dipublikasikan langsung. Data database/media tersimpan di named volumes. `docker compose down` mempertahankan volume; jangan memakai `down -v` jika data harus dipertahankan.

## Development tanpa Docker

Backend memakai SQLite sebagai fallback lokal untuk memulai cepat, tetapi deployment/CI memakai PostgreSQL. Di `services/api`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e '.[test]'
$env:JWT_SECRET = 'local-only-change-me-at-least-32-characters'
$env:ADMIN_EMAIL = 'admin@example.com'
# Isi ADMIN_PASSWORD lewat environment lokal; minimal 12 karakter.
alembic upgrade head
python -m smart_waste.cli seed-admin
uvicorn smart_waste.main:app --host 127.0.0.1 --port 8000
```

Untuk PostgreSQL, atur DATABASE_URL di `services/api/.env` sesuai contoh sebelum migrasi. Dari root, jalankan `pnpm install --frozen-lockfile` lalu `pnpm dev:web`. Website lokal http://localhost:3000 mem-proxy `/api` ke localhost:8000. Pastikan ALLOWED_ORIGINS mencantumkan origin web.

## Mobile dan APK

Salin `apps/mobile/.env.example` ke `.env`, tetapkan EXPO_PUBLIC_API_URL ke URL backend HTTPS dengan akhiran `/api/v1`. URL harus dapat diakses dari ponsel; `localhost` pada ponsel bukan laptop. Untuk development jalankan `pnpm dev:mobile`.

Build pengumpulan:

```text
cd apps/mobile
pnpm dlx eas-cli login
pnpm dlx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://URL-DEMO/api/v1 --visibility plaintext
pnpm dlx eas-cli build --platform android --profile preview
```

Project Expo pemilik adalah [maykiddd/smart-waste](https://expo.dev/accounts/maykiddd/projects/smart-waste), ditautkan di app.config.ts. Untuk fork, ganti owner/projectId dengan project Anda sendiri. Login dan signing/keystore memerlukan akses akun pemilik. Profil preview menghasilkan APK yang berjalan tanpa Metro. Jangan memasukkan secret ke variabel EXPO_PUBLIC_ karena nilainya tertanam dalam APK. Unduh APK aktual dari build, hitung checksum, dan uji pada perangkat Android sebelum mengumpulkan.

## Model Colab

Buka [notebook training](ml/Smart_Waste_Training.ipynb) di Google Colab, pilih GPU, dan ikuti [panduan ML](ml/README.md). Setelah selesai, ekstrak artefak ke `ml/artifacts/`. Rebuild/restart API dengan TensorFlow terpasang (`pip install -e '.[ml]'` untuk lokal). `/api/health` menunjukkan `model_loaded`.

Tanpa model, laporan manual tetap dapat dibuat dan AI mengembalikan 503 dengan pesan yang jelas. Model demo saat ini sudah terpasang, accuracy testing aktual 97,32%, melampaui target 80%. Evaluasi ini berlaku pada subset tiga kelas RealWaste; model tidak memiliki kelas 'bukan sampah' dan kategori tetap dapat dikoreksi User.

## Kontrak API dan pengujian

```text
# di services/api dengan environment lokal aktif
python -m smart_waste.cli openapi
pytest -q
ruff check src tests
# di root
pnpm api:generate
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @smart-waste/mobile export
```

Pengujian auth/izin menggunakan test database terisolasi; TEST_DATABASE_URL dapat diarahkan ke database PostgreSQL khusus pengujian. Jangan arahkan ke database aktif: suite membuat dan menghapus tabel. Mock prediksi pada pengujian kontrak hanya menguji alur koreksi; bukan bukti accuracy ML. CI juga memeriksa OpenAPI yang dihasilkan tidak berbeda dari kontrak tersimpan.

Dokumentasi interaktif: `/api/docs`; [panduan API](docs/api.md), [arsitektur dan ERD](docs/architecture.md), [arah desain](docs/design.md).

## Deployment di sandbox

Salin source bersih ke workspace sandbox, siapkan `infra/.env` dan model secara terpisah, kemudian jalankan bootstrap. Publikasikan hanya port proxy: `sbx --cloud ports codex-large --publish 8080`. Gunakan URL HTTPS yang dikembalikan sebagai PUBLIC_ORIGIN dan API URL APK. Pembukaan URL publik dilakukan setelah review konfigurasi dan data.

Sandbox Anda memakai timer restart 24 jam. Setelah restart, jalankan kembali `sh infra/bootstrap.sh` bila layanan belum pulih. Satu perintah pemulihan adalah cakupan demo yang disepakati; proyek tidak menjanjikan hosting tanpa interupsi. Compute Docker ditagihkan selama sandbox hidup, termasuk ketika aplikasi idle.

## Backup, privasi, dan distribusi

`sh infra/backup.sh` menghentikan sementara writer API untuk snapshot database/media yang konsisten dan kemudian menyalakannya lagi. Simpan backup di luar sandbox dan batasi aksesnya. Restore memerlukan konfirmasi eksplisit: lihat `infra/restore.sh`; prosedur mengganti database aktif. Environment dan model disimpan serta dipulihkan terpisah dari backup data pengguna.

Koordinat, foto, email, dan riwayat hanya untuk pemilik serta Admin. Gunakan akun/foto sintetis untuk demo; minta persetujuan sebelum memakai data orang lain. Repository public tidak berisi environment, token, password, model besar, data database, atau upload. Dataset RealWaste mengikuti lisensi/atribusi sumbernya. Lihat [naskah video](docs/demo-script.md) dan [checklist pengumpulan](docs/submission.md).
