# Training Smart Waste

Buka `Smart_Waste_Training.ipynb` di Google Colab dan pilih GPU T4. Jalankan sel secara berurutan. Source notebook berasal dari `prepare_dataset.py` dan `train.py`; setelah mengubah source, jalankan `python build_notebook.py`.

## Dataset

RealWaste: Single, S., Iranmanesh, S., & Raad, R. (2023). UCI Machine Learning Repository. DOI: https://doi.org/10.24432/C5SS4G. Halaman sumber: https://archive.ics.uci.edu/dataset/908/realwaste. Lisensi yang dicantumkan UCI adalah CC BY 4.0; verifikasi halaman sumber dan simpan salinan atribusi bersama distribusi dataset. Jangan mengubah lisensi dataset menjadi lisensi kode proyek.

Food Organics dan Vegetation digabung sebagai `organic`, Paper menjadi `paper`, Plastic menjadi `plastic`. Cardboard tidak termasuk. Semua foto relevan digunakan setelah validasi, deduplikasi SHA256/dHash, dan pengecualian kelompok dengan label bertentangan. `dataset_summary.json` mencatat jumlah aktual, file sumber, checksum arsip, dan alasan pengecualian. Tidak ada dataset atau jumlah kelas yang dikarang di repository.

Setelah satu wakil dipilih per kelompok duplikat, split stratified menghasilkan 70/15/15 dengan seed 42 (pembulatan mengikuti jumlah gambar). Tidak ada augmentasi test/validation, bobot kelas dihitung dari training saja. Data test tidak dipakai memilih checkpoint. Persiapan aktual menghasilkan 2.234 gambar; lihat [rincian dataset](../docs/dataset.md) dan manifest di `manifests/`.

## Kontrak artefak

Salin isi `smart-waste-artifacts.zip` hasil Colab ke `ml/artifacts/` (diabaikan Git). API memerlukan `model.keras` dan `metadata.json`; urutan label **organic, paper, plastic**, RGB 224x224 bilinear, nilai input 0..255. Rescaling MobileNetV2 berada di dalam model, jangan dilakukan dua kali. Canonicalization foto training sama dengan server: EXIF transpose, RGB, maksimal 2048 px, JPEG quality 88.

Hasil wajib: `evaluation.json`, `classification_report.txt`, `confusion_matrix.png`, `training_curves.png`, `training_history.json`, `manifest.csv`, `dataset_summary.json`, `test_predictions.npz`, model, metadata. Publikasikan artefak model/evaluasi sebagai GitHub Release, sertakan checksum. Dataset lengkap dapat diserahkan sebagai arsip sumber beserta link UCI dan manifest subset.

Setelah mengekstrak hasil Colab, dari root jalankan `python ml/verify_artifacts.py ml/artifacts`. Perintah memeriksa checksum model, kontrak label/preprocessing, pemisahan data, serta menghitung ulang accuracy/confusion matrix/classification report dari prediksi tersimpan. Exit code 1 berarti target belum tercapai atau artefak tidak valid; hasil tidak diganti. Pemeriksaan ini tidak menggantikan pemuatan model dan inferensi nyata di API.

Status saat scaffold: **belum ada model terlatih dan belum ada hasil accuracy**. Jika testing <80%, kriteria belum terpenuhi; jangan mengganti hasil dengan angka contoh. Susun eksperimen berikut berdasarkan validation, jaga test set tetap terpisah, dan dokumentasikan riwayat eksperimen. Model tiga kelas tidak memiliki kelas 'bukan sampah'; confidence tinggi bukan bukti objek berada dalam domain training.
