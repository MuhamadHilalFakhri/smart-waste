# Panduan API

Kontrak lengkap: `packages/api-client/openapi.json`. Saat server berjalan: `/api/docs`, `/api/redoc`, `/api/openapi.json`. Kontrak frontend dihasilkan dengan `pnpm api:generate`, setelah `python -m smart_waste.cli openapi` dari direktori API.

| Metode               | Endpoint `/api/v1`     | Akses / perilaku                                           |
| -------------------- | ---------------------- | ---------------------------------------------------------- |
| POST                 | `/auth/register`       | Nama, email, password minimal 10; selalu User              |
| POST                 | `/auth/login`          | Email/password; cookie web atau token mobile               |
| GET                  | `/auth/me`             | Identitas pengguna aktif                                   |
| POST                 | `/auth/refresh`        | Rotasi refresh token; reuse mencabut sesi                  |
| POST                 | `/auth/logout`         | Cabut sesi dan hapus cookie                                |
| GET / POST           | `/reports`             | List terfilter atau create multipart                       |
| GET / PATCH / DELETE | `/reports/{id}`        | Detail, edit multipart, soft delete                        |
| GET                  | `/reports/{id}/photo`  | JPEG, pemilik atau Admin                                   |
| PATCH                | `/reports/{id}/status` | Admin, JSON status/note                                    |
| GET                  | `/dashboard`           | Statistik terfilter sesuai role                            |
| GET / POST           | `/users`               | Admin, daftar atau buat pengguna                           |
| PATCH                | `/users/{id}`          | Admin, nama/role/active; nonaktif menggantikan delete akun |
| POST                 | `/predictions`         | Auth, satu `photo` multipart; 503 bila model tidak siap    |

## Auth mobile dan curl

Kirim `X-Client-Type: mobile` ke register/login/refresh/logout. Respons login mengandung `user`, `access_token`, `refresh_token`; kirim `Authorization: Bearer ACCESS_TOKEN` pada permintaan berikutnya. Refresh/logout menerima JSON `{"refresh_token":"..."}`. Jangan menaruh token dalam source, URL, atau README.

Browser mengirim credentials cookie dan `X-CSRF-Token` dari cookie `sw_csrf` untuk POST/PATCH/DELETE setelah login. Cookie autentikasi tidak dapat dibaca JavaScript. Login/register memeriksa Origin tanpa membutuhkan sesi terdahulu.

Create/edit laporan menggunakan multipart: `description`, `category`, `latitude`, `longitude`, `accuracy` opsional, `photo` (wajib saat create, opsional saat edit). Latitude -90..90, longitude -180..180, description 10..5000. Foto maksimal 10 MB.

Prediksi: `{category, confidence, probabilities, model_version, outcome}`. Nilai kategori `organic|paper|plastic`. Confidence adalah skor model, bukan jaminan gambar berada dalam tiga kelas tersebut. Jika prediksi gagal, create laporan tetap dapat menggunakan kategori manual.

Query laporan: `q`, `status`, `category`, `start_date`, `end_date`, `page` (mulai 1), `page_size` (1..100, default 12). Respons list `{items,total,page,page_size}`. Dashboard menerima filter status/kategori/tanggal, bukan pencarian teks. Daftar pengguna menerima q dan pagination.

Kesalahan memakai `{detail, errors?}` tanpa memasukkan password/input mentah: 401 sesi tidak valid, 403 izin/CSRF/Origin, 404 objek tidak ditemukan atau bukan milik pengguna, 409 konflik workflow/email/Admin terakhir, 413 ukuran unggahan, 422 validasi, 429 batas percobaan, 503 ML belum tersedia. Detail laporan menyertakan `history` dan `predictions`.

`/api/health` mengembalikan liveness dan `model_loaded`; `/api/ready` memeriksa koneksi database. Business API boleh siap tanpa model agar fallback manual berfungsi. Pengumpulan akhir tetap memerlukan model asli dan target evaluasi yang tercapai.
