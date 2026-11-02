# Catatan verifikasi implementasi

Verifikasi dilakukan 2 November 2026 dengan data uji sintetis, bukan laporan lapangan.

| Pemeriksaan                                                      | Hasil                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| Backend auth/role/ownership/workflow/media/GPS/CSRF/refresh      | 18 tes lulus pada SQLite lokal                          |
| Suite backend yang sama pada PostgreSQL 17 di sandbox            | 18 tes lulus                                            |
| Kesamaan pixel preprocessing Colab dan API                       | Lulus dengan test double model; tidak mengukur accuracy |
| Client API: refresh bersama, error jaringan/login, 204, URL Maps | 5 tes lulus                                             |
| Presentasi status workflow web                                   | 2 tes lulus                                             |
| TypeScript web/mobile/shared client                              | Lulus                                                   |
| Build produksi Next.js                                           | Lulus lokal dan image Linux sandbox                     |
| Bundle Android Expo                                              | Export berhasil; ini belum merupakan APK signed         |
| Browser E2E: foto/GPS/User/Admin/status/390px                    | Lulus                                                   |
| Browser E2E: izin GPS ditolak dan teks dipertahankan             | Lulus                                                   |
| Compose PostgreSQL/API/web/proxy                                 | Berjalan; endpoint readiness siap                       |
| Model terlatih >=80% pada test set                               | Belum tersedia; menunggu Anda menjalankan Colab         |
| Uji APK pada Android fisik                                       | Menunggu build EAS dan instalasi perangkat              |
| Video pengumpulan                                                | Menunggu rekaman setelah integrasi final                |

Sumber lisensi dataset telah diperiksa melalui metadata resmi UCI, dataset ID 908. Kutipan sumber menyebut: RealWaste, Single, Iranmanesh, Raad, Wollongong City Council, CC BY 4.0. Source: https://archive.ics.uci.edu/api/dataset?id=908.

Peringatan tooling saat pengujian: Starlette memberikan deprecation warning untuk integrasi httpx TestClient. Tes tetap lulus. Audit dependency JS menemukan dua advisory moderate dan tidak menemukan high/critical pada pemeriksaan produksi saat ini; rincian dan perbaikan berikutnya perlu mengikuti hasil audit lockfile aktual.

Keberhasilan source/build tidak menandakan persyaratan ML, APK, dan video sudah selesai. Checklist pengumpulan tetap memisahkan hasil yang sudah diverifikasi dari artefak eksternal yang belum ada.
