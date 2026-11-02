# Checklist pengumpulan

Status di bawah adalah status artefak, bukan klaim semua hasil eksternal sudah selesai.

| Ketentuan                | Lokasi / tindakan                                  | Status awal                                 |
| ------------------------ | -------------------------------------------------- | ------------------------------------------- |
| Repository GitHub public | Publish repository source setelah review secret    | Menunggu publikasi                          |
| Demo website             | Compose sandbox, URL HTTPS dari port proxy         | Menunggu deployment/publication             |
| APK Android              | EAS preview, unggah sebagai release artifact       | Menunggu login Expo, URL API, build         |
| Dokumentasi API          | docs/api.md, OpenAPI JSON, /api/docs               | Source tersedia                             |
| Schema / ERD             | docs/architecture.md, migrasi Alembic              | Source tersedia                             |
| Source/model ML          | ml/, GitHub Release untuk model.keras              | Notebook tersedia; model menunggu Colab     |
| Dataset/sumber           | UCI RealWaste, manifest dan summary hasil notebook | Menunggu eksekusi persiapan dataset         |
| Evaluasi model           | evaluation.json, grafik, classification report     | Menunggu training; belum ada angka accuracy |
| README                   | Panduan setup dan penggunaan root                  | Source tersedia                             |
| Video <=10 menit         | docs/demo-script.md, URL video akhir               | Menunggu perekaman Anda                     |

Sebelum menyerahkan: isi URL nyata, versi/tag commit, SHA256 model/APK, jumlah dataset per split, accuracy testing, hasil pengujian, dan tanggal uji demo. Jangan mengganti status dengan 'selesai' hanya karena source ada.
