# Arah desain Smart Waste

Identitas: layanan lingkungan modern, tema terang, hijau tua, latar netral hangat, bahasa Indonesia. Wordmark menggunakan nama produk tanpa logo/aset tambahan. Tidak ada avatar, klaim statistik, atau foto sampah contoh yang disamarkan sebagai laporan nyata.

- Warna utama #185B42 dan teks #172D27 menonjolkan tindakan serta keterbacaan pada latar #F6F6EF. Status memakai label teks, bukan warna saja.
- Manrope untuk judul memberi karakter ramah dengan bentuk terbuka; DM Sans untuk isi dan formulir menjaga keterbacaan. System font menjadi fallback; mobile memakai system font native.
- Web: navigasi Ringkasan, Laporan, Pengguna untuk Admin. Laporan menggunakan foto karena bukti visual adalah isi utama; statistik hanya berasal dari backend.
- Mobile: Ringkasan, Riwayat, Buat laporan. Tombol minimal 44 px, label input eksplisit, dukungan pembaca layar dan teks yang dapat membungkus.
- ENERGY 2 / RHYTHM 2 / MOTION 1. Aksen terarah pada tindakan utama; tidak ada animasi dekoratif. Ritme memakai ringkasan total, statistik status, komposisi kategori, dan daftar laporan sesuai fungsi masing-masing.
- Form mengikuti urutan Foto, Keterangan, Lokasi, Konfirmasi. Ketika izin lokasi/foto ditolak atau AI gagal, tampilkan instruksi yang membantu dan pertahankan data yang telah diisi.
- Periksa keyboard, fokus, kontras, loading/error/empty, layar 390 px dan desktop. Hindari menilai berdasarkan screenshot happy path saja.
