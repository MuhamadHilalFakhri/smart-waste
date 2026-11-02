# APK Android preview

Build EAS 4601d205-bf55-45b4-addc-58697450fcae selesai pada 2 November 2026. Profil preview menghasilkan APK release internal dengan JavaScript/Hermes bundle tertanam dan URL API demo HTTPS yang sebenarnya.

- [Halaman instalasi EAS](https://expo.dev/accounts/maykiddd/projects/smart-waste/builds/4601d205-bf55-45b4-addc-58697450fcae)
- Salinan lokal pemilik: apps/mobile/dist/smart-waste-preview.apk (diabaikan Git).
- Ukuran: 68.200.514 byte.
- SHA256: 882611220e2770c9a39a3c1c32ee823a05216c843bd08a59908277b9e22543b1.
- Paket: id.smartwaste.assessment, versi 1.0.0, versionCode 1.
- Tanda tangan APK Signature Scheme v2 diverifikasi memakai Google Android apksig 9.5.0; hasil verified=true, errors kosong. JAR v1 tidak digunakan.
- SHA256 sertifikat: bbe7e20d50e57eadcf47e1c382ffe4b5f860b8b81428a871c4a26153aa7c121e.

[Metadata verifikasi build](android-build.json) mencatat URL artefak dan checksum. Keystore tersimpan privat di akun EAS pemilik; kunci tidak disertakan dalam APK atau repository. Verifier berasal dari [Google Maven](https://developer.android.com/build/remote-repositories) dan implementasi [apksig resmi](https://android.googlesource.com/platform/tools/apksig).

APK dikemas untuk berjalan tanpa Metro/laptop, tetapi **pengujian pada perangkat Android fisik masih menunggu**. Instal pada perangkat Android milik penguji, lalu uji register/login, kamera/galeri, penolakan izin, lokasi GPS, prediksi AI, koreksi kategori, pengiriman laporan, dan perubahan status Admin. Gunakan foto uji dan jangan merekam token/password.

URL API tertanam di APK; jika URL sandbox diganti, buat build baru. Simpan APK sebagai release artifact untuk pengumpulan agar tidak hanya bergantung pada retensi unduhan EAS.
