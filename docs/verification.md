# Catatan verifikasi implementasi

## Migrasi Node.js dan FastAPI ML, 3 November 2026

Backend bisnis dipindahkan ke Node.js/Fastify; FastAPI hanya mengerjakan inferensi. Pengujian integrasi PostgreSQL 17 terisolasi: 21 tes lulus, termasuk workflow, kepemilikan, cookie/CSRF, refresh replay serentak, dan perlindungan Admin terakhir. Dua tes unit Node.js untuk normalisasi foto dan fallback ML serta dua tes Python untuk layanan ML/preprocessing juga lulus. TypeScript seluruh workspace, unit test client/web, build Next.js, dan export Android lulus. Hasil prediksi dan kesiapan ada di [pemeriksaan model](backend-migration-checks.json); alur laporan API langsung ada di [hasil API](backend-node-live-api.json).

Snapshot database/media deployment lama dipulihkan pada Compose terisolasi. Login hash Argon2 lama, access JWT lama, rotasi refresh lama, foto lama yang identik checksum, kategori manual, perubahan status, dan arsip berhasil diuji. Model asli pada layanan ML terpisah memprediksi gambar testing organik, kertas, dan plastik dengan benar, menggunakan versi `mobilenetv2-20261102T140525Z`. Pengujian ini memverifikasi migrasi dan integrasi; angka accuracy testing tetap berasal dari evaluasi Colab yang diarsipkan.

Demo Node.js dengan model nyata sempat berjalan setelah migrasi, lalu container, image proyek, volume data, cache build, dan source di sandbox dihapus atas permintaan pemilik pada 3 November 2026. URL lama kini tidak melayani aplikasi. Backup privat pra-migrasi tetap tersedia lokal di `D:\Assesment\infra\backups`.

Catatan di bawah mempertahankan hasil verifikasi implementasi awal sebelum migrasi.

Verifikasi dilakukan 2 November 2026 dengan data uji sintetis, bukan laporan lapangan; tabel ini mencatat kondisi pada tanggal tersebut.

[CI GitHub pada commit 45a292d](https://github.com/MuhamadHilalFakhri/smart-waste/actions/runs/41456519419) memverifikasi backend PostgreSQL, kontrak API, TypeScript, unit test, build web, export Android, dan browser E2E. Panduan menjalankan kembali demo dan memasang model ada di [operasional](operations.md).

| Pemeriksaan                                                      | Hasil                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Backend auth/role/ownership/workflow/media/GPS/CSRF/refresh      | 18 tes lulus pada SQLite lokal                                   |
| Suite backend yang sama pada PostgreSQL 17 di sandbox            | 18 tes lulus                                                     |
| Kesamaan pixel preprocessing Colab dan API                       | Lulus dengan test double model; tidak mengukur accuracy          |
| Client API: refresh bersama, error jaringan/login, 204, URL Maps | 5 tes lulus                                                      |
| Presentasi status workflow web                                   | 2 tes lulus                                                      |
| TypeScript web/mobile/shared client                              | Lulus                                                            |
| Build produksi Next.js                                           | Lulus lokal dan image Linux sandbox                              |
| Bundle Android Expo                                              | Export dan APK EAS signed selesai; lihat mobile-build.md         |
| Browser E2E: foto/GPS/User/Admin/status/390px                    | Lulus                                                            |
| Browser E2E: izin GPS ditolak dan teks dipertahankan             | Lulus                                                            |
| Compose PostgreSQL/API/web/proxy                                 | Berjalan; endpoint readiness siap                                |
| Snapshot database/media dan restore terisolasi                   | Checksum valid; 1 Admin dan 0 laporan dipulihkan ke database uji |
| Model terlatih >=80% pada test set                               | Lulus: 97,32% pada 336 gambar testing di Colab T4                |
| Uji APK pada Android fisik                                       | APK tersedia; pengujian perangkat fisik menunggu                 |
| Video pengumpulan                                                | Menunggu rekaman setelah integrasi final                         |

Sumber lisensi dataset telah diperiksa melalui metadata resmi UCI, dataset ID 908. Kutipan sumber menyebut: RealWaste, Single, Iranmanesh, Raad, Wollongong City Council, CC BY 4.0. Source: https://archive.ics.uci.edu/api/dataset?id=908.

Peringatan tooling saat pengujian: Starlette memberikan deprecation warning untuk integrasi httpx TestClient. Tes tetap lulus. Audit dependency JS menemukan dua advisory moderate dan tidak menemukan high/critical. Dependensi transitif tooling Expo: [minimatch globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249) dan [glob cancellation bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). Keduanya terkait pemrosesan glob filesystem, bukan endpoint upload aplikasi. Pembaruan mengikuti kompatibilitas SDK Expo; tidak dipaksa lintas major tanpa pengujian native.

Model nyata dan evaluasi testing sudah diverifikasi; pengujian APK pada perangkat fisik dan video masih memerlukan penyelesaian terpisah. Checklist pengumpulan tetap memisahkan hasil yang sudah diverifikasi dari artefak eksternal yang belum ada.
