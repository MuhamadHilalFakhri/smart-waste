# Checklist pengumpulan

Status di bawah adalah status artefak, bukan klaim semua hasil eksternal sudah selesai.

| Ketentuan                | Lokasi / tindakan                                                                                    | Status                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Repository GitHub public | [MuhamadHilalFakhri/smart-waste](https://github.com/MuhamadHilalFakhri/smart-waste)                  | Source diterbitkan setelah review secret             |
| Demo website             | [Smart Waste HTTPS](https://8080-001m6e4ck17dvek9788p0t5q4fm.sbx.sandboxes-cloud.docker.com)         | Aktif; model nyata terpasang                         |
| APK Android              | [Release APK](https://github.com/MuhamadHilalFakhri/smart-waste/releases/tag/v0.1.0-android)         | APK signed selesai; uji Android fisik menunggu       |
| Dokumentasi API          | docs/api.md, OpenAPI JSON, /api/docs                                                                 | Source tersedia                                      |
| Schema / ERD             | docs/architecture.md, migrasi Alembic                                                                | Source tersedia                                      |
| Source/model ML          | [Source dan release model](https://github.com/MuhamadHilalFakhri/smart-waste/releases/tag/v0.1.0-ml) | Model Colab aktif; release public tersedia           |
| Dataset/sumber           | [Sumber, lisensi, jumlah, manifest](dataset.md)                                                      | 2.234 gambar unik disiapkan; gambar diunduh terpisah |
| Evaluasi model           | evaluation.json, grafik, classification report                                                       | 97,32% testing; 336 gambar, evaluasi asli tersedia   |
| README                   | Panduan setup dan penggunaan root                                                                    | Source tersedia                                      |
| Video <=10 menit         | docs/demo-script.md, URL video akhir                                                                 | Menunggu perekaman Anda                              |

Sebelum menyerahkan: isi URL nyata, versi/tag commit, SHA256 model/APK, jumlah dataset per split, accuracy testing, hasil pengujian, dan tanggal uji demo. Jangan mengganti status dengan 'selesai' hanya karena source ada.
