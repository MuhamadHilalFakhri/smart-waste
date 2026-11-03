# Operasional deployment

## Status deployment

- Repository: [smart-waste](https://github.com/MuhamadHilalFakhri/smart-waste).
- Deployment sandbox lama dihapus atas permintaan pemilik pada 3 November 2026, termasuk container, image proyek, database/media, source salinan, dan cache build.
- Sandbox `codex-large` masih ada, tetapi workspace `/home/agent/workspace/smart-waste` telah dihapus. URL demo lama tidak lagi melayani aplikasi.
- Backup database/media dan source privat sebelum migrasi tersedia di `D:\Assesment\infra\backups`. File environment lokal tetap diabaikan Git.

File environment deployment berikutnya harus disimpan privat sebagai `infra/.env`. Salinan kredensial lama tersimpan privat di `D:\Assesment\infra\.env.demo`, diabaikan Git. Jangan mengunggah file ini, menampilkannya saat rekaman, atau memasukkannya ke issue.

## Memulai kembali

Untuk menjalankan deployment baru, siapkan sandbox dan konfigurasi privat, lalu jalankan:

```sh
cd /home/agent/workspace/smart-waste
sh infra/bootstrap.sh
```

Dari laptop dengan Docker Sandbox CLI yang sudah login, perintah setara:

```powershell
sbx --cloud exec codex-large sh -lc 'cd /home/agent/workspace/smart-waste && sh infra/bootstrap.sh'
```

Periksa `/api/ready`: status harus `ready`. `model_loaded: false` berarti layanan bisnis siap, tetapi AI belum terpasang. `/api/health` melaporkan keadaan layanan dan model. Bila sandbox dibuat ulang atau URL berubah, perbarui PUBLIC_ORIGIN melalui `infra/configure_origin.py` dan bangun APK kembali dengan EXPO_PUBLIC_API_URL yang baru.

Compose memiliki restart policy untuk container, tetapi tidak mengandalkan sandbox memulihkan daemon/aplikasi secara otomatis. Bootstrap telah dijalankan ulang dengan database yang tetap tersimpan; restart keseluruhan sandbox belum digunakan sebagai uji penerimaan.

## Integrasi hasil Colab

1. Jalankan [notebook Colab](https://colab.research.google.com/github/MuhamadHilalFakhri/smart-waste/blob/main/ml/Smart_Waste_Training.ipynb) dengan GPU T4.
2. Ekstrak ZIP hasil ke `ml/artifacts` secara lokal. Jalankan `python ml/verify_artifacts.py ml/artifacts` dengan dependensi ML terpasang.
3. Review evaluasi testing asli, minimal 80%, label dan checksum. Simpan artefak asli sebelum melakukan perubahan. Jika kurang dari target, catat kegagalan; source yang berjalan tidak menggantikan kriteria ML.
4. Salin isi artefak ke `ml/artifacts` di sandbox melalui kanal privat. Direktori ini di-mount read-only di layanan `ml`.
5. Restart ML: `docker compose --env-file infra/.env -f infra/compose.yaml restart ml`. Periksa readiness Node.js menunjukkan model dimuat dan lakukan prediksi gambar nyata dari ketiga kelas.
6. Uji alur lengkap web dan APK, termasuk koreksi kategori dan confidence rendah. Publikasikan model/evaluasi sebagai release artifacts setelah review, sertakan checksum model.

## Backup dan restore

Jalankan `sh infra/backup.sh`. API berhenti sementara selama snapshot konsisten, lalu dimulai lagi. Salin direktori backup dari `infra/backups` ke penyimpanan privat di luar sandbox; volume sandbox saja tidak melindungi dari penghapusan sandbox.

Untuk memeriksa snapshot tanpa mengganti data aktif:

```sh
sh infra/verify_backup.sh backups/NAMA-SNAPSHOT
```

Restore yang mengganti data aktif membutuhkan tindakan eksplisit:

```sh
CONFIRM_RESTORE=replace-current-data sh infra/restore.sh backups/NAMA-SNAPSHOT
```

Environment dan model tidak masuk snapshot database/media; cadangkan keduanya terpisah. Simpan keystore melalui akun EAS pemilik dan batasi aksesnya. APK memakai API publik yang tertanam saat build; token sesi pengguna tetap berada di SecureStore perangkat.
