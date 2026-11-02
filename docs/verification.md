# Catatan verifikasi implementasi

Verifikasi dilakukan 2 November 2026 dengan data uji sintetis, bukan laporan lapangan.

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
