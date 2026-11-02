# Dataset RealWaste

Sumber: [UCI RealWaste](https://archive.ics.uci.edu/dataset/908/realwaste), DOI [10.24432/C5SS4G](https://doi.org/10.24432/C5SS4G). Atribusi: Single, Iranmanesh, Raad, Wollongong City Council. Metadata resmi UCI menyebut lisensi **CC BY 4.0**. Pertahankan atribusi dan tautan lisensi ketika mendistribusikan gambar. Pipeline mengubah orientasi, mengonversi RGB/JPEG, dan membatasi resolusi; dataset asli tidak diubah di sumbernya.

Persiapan aktual dijalankan 2 November 2026. Arsip sumber SHA256: `1ede08b32358ee62065bcc1c8cb47a2ece04e8dff5b1fb53342bb8750895b2f3`.

| Kelas                                | Train | Validation | Test | Total |
| ------------------------------------ | ----: | ---------: | ---: | ----: |
| Organic (Food Organics + Vegetation) |   586 |        126 |  126 |   838 |
| Paper                                |   342 |         73 |   74 |   489 |
| Plastic                              |   635 |        136 |  136 |   907 |
| Total                                |  1563 |        335 |  336 |  2234 |

Sebanyak 2.268 gambar relevan diperiksa; 34 dikeluarkan oleh kebijakan duplikasi. SHA256 identik atau jarak dHash <=4 digabungkan; kelompok berlabel bertentangan dikeluarkan, kelompok lainnya menyisakan satu wakil. Setelah deduplikasi, stratifikasi 70/15/15 menggunakan seed 42 memastikan kelompok duplikat tidak melintasi split. Pembulatan jumlah gambar menyebabkan selisih kecil dari persentase tepat.

[Manifest](../ml/manifests/manifest.csv) mencatat path portabel, path sumber, kategori, checksum, kelompok, dan split setiap gambar. [Ringkasan](../ml/manifests/dataset_summary.json) juga mencatat gambar yang dikeluarkan. Keduanya berasal dari eksekusi persiapan, bukan hasil training.

Unduh ulang melalui `python ml/prepare_dataset.py --root ml/data` setelah memasang dependensi `ml/requirements.txt`, atau jalankan sel persiapan notebook Colab. Gambar dan arsip berada di direktori yang diabaikan Git. Manifest yang dihasilkan Colab harus sama dengan manifest repository sebelum training; laporkan perubahan sumber atau versi dependensi bila berbeda. Accuracy, confusion matrix, dan classification report tetap menunggu training nyata.
