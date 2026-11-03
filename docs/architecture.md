# Arsitektur dan ERD

Smart Waste menggunakan Node.js/Fastify untuk fitur bisnis dan FastAPI khusus inferensi ML. Next.js dan Expo mengonsumsi API Node.js dengan kontrak OpenAPI yang sama. Node.js mengelola autentikasi, izin, pengguna, laporan, status, statistik, database, dan foto. FastAPI menerima gambar melalui jaringan privat, melakukan preprocessing Pillow, lalu menjalankan model TensorFlow. Layanan ML tidak memiliki database, login pengguna, atau endpoint laporan. Model tidak melakukan panggilan ke OpenAI dan tidak memerlukan API key penyedia AI.

```mermaid
flowchart LR
  Web[Next.js / browser] --> Proxy[Reverse proxy HTTPS]
  Mobile[APK Expo] --> Proxy
  Proxy --> Next[Next.js server]
  Proxy --> API[Node.js / Fastify]
  API --> DB[(PostgreSQL)]
  API --> Media[(Volume media)]
  API --> ML[FastAPI ML privat]
  ML --> Model[Model Keras lokal]
  Colab[Google Colab training] --> Artifacts[Model + metadata + evaluasi]
  Artifacts --> Model
```

```mermaid
erDiagram
  USERS ||--o{ REPORTS : owns
  USERS ||--o{ REFRESH_SESSIONS : authenticates
  USERS ||--o{ REPORT_STATUS_HISTORY : acts
  REPORTS ||--|{ REPORT_STATUS_HISTORY : records
  REPORTS ||--|{ PREDICTIONS : classifies
  USERS {
    uuid id PK
    string name
    string email UK
    string password_hash
    string role
    boolean active
    timestamptz created_at
  }
  REFRESH_SESSIONS {
    uuid id PK
    uuid user_id FK
    string token_hash
    string csrf_token
    timestamptz expires_at
    boolean revoked
  }
  REPORTS {
    uuid id PK
    uuid owner_id FK
    text description
    string category
    float latitude
    float longitude
    float accuracy
    string image_path
    string status
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }
  REPORT_STATUS_HISTORY {
    uuid id PK
    uuid report_id FK
    uuid actor_id FK
    string previous_status
    string next_status
    text note
    timestamptz created_at
  }
  PREDICTIONS {
    uuid id PK
    uuid report_id FK
    string image_path
    string category
    float confidence
    string model_version
    string outcome
    text probabilities_json
    timestamptz created_at
  }
```

## Keputusan data

- Role: `admin`, `user`. Status: `pending`, `in_progress`, `completed`, `rejected`. Kategori: `organic`, `paper`, `plastic`.
- Registrasi publik mengabaikan role tambahan dan selalu menghasilkan User. Akun nonaktif dan sesi revoked tidak dapat menggunakan access token yang belum kedaluwarsa sekalipun.
- User hanya mengedit/mengarsipkan laporan Pending miliknya. Admin dapat mengoreksi data semua laporan dan mengarsipkannya; status final tidak dibuka ulang.
- Semua foto tersimpan dengan nama UUID acak. Tidak ada media publik tanpa pemeriksaan izin. Foto asli diganti oleh JPEG yang dinormalisasi dan tanpa EXIF.
- Soft delete mempertahankan audit dan foto. Tidak ada fitur hard delete dalam aplikasi.
- Prediksi saat submit dihitung kembali oleh server, tidak dipercayai dari payload client. Mengubah foto membuat catatan prediksi baru; mengoreksi kategori tidak mengubah hasil AI asli.
- Filter tanggal menggunakan hari UTC secara inklusif; antarmuka menampilkan waktu sesuai zona perangkat.
- PostgreSQL dipakai pada development, deployment, dan pengujian integrasi. Migrasi SQL Node.js mempertahankan tabel deployment lama; Alembic tidak lagi dijalankan.
- Foto untuk penyimpanan dinormalisasi Sharp tanpa EXIF. Layanan ML menerima upload asli dan menjalankan canonicalization Pillow yang sama dengan dataset Colab sebelum inferensi; hasil disimpan terpisah dari kategori manual.
- Hanya Node.js yang mengakses PostgreSQL dan volume media. Model di-mount read-only pada layanan ML. Token internal ML dipisahkan dari JWT secret dan tidak diberikan kepada web/mobile.

## Keamanan sesi

Access JWT 15 menit memuat subject dan ID sesi. Refresh opaque 7 hari disimpan sebagai SHA256, dirotasi, dan penggunaan ulang token lama mencabut seluruh sesi tersebut. Browser memakai cookie HttpOnly Secure pada HTTPS; mutation memakai CSRF token yang terikat sesi dan pengecekan Origin. Mobile menyimpan token di SecureStore dan mengirim Bearer, tidak menggunakan cookie.

Rate limit login/register adalah in-memory per worker, 10 percobaan per 15 menit. Jalankan satu worker API pada demo. Untuk deployment multiworker gunakan limiter bersama seperti Redis sebelum memperluas kapasitas. Proxy API hanya internal dan meneruskan alamat client; jangan membuka port API langsung dengan konfigurasi trusted proxy ini.
