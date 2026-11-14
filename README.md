# Discere

**Platform Pembelajaran Interaktif: Papan Tulis Digital Kolaboratif dan Game Edukasi Bertema Tradisional Indonesia**

Dikembangkan oleh **Tim Timber** dari **SMKN 13 Bandung** untuk ajang **LOGICODIX 2026 Hackathon Competition** dengan subtema **Smart & Fun Education**.

**Tagline:** *Belajar Serius, Bermain Gembira!*

---

## 1. Project Title

# Discere

Nama **Discere** diambil dari bahasa Latin yang berarti *"belajar"*. Discere dirancang sebagai ekosistem pembelajaran modern yang menyatukan media penyampaian materi visual berbasis papan tulis digital dengan sistem evaluasi interaktif berbasis gamifikasi perlombaan tradisional nusantara.

| Informasi Proyek | Keterangan |
|---|---|
| **Nama Aplikasi** | Discere |
| **Kategori** | Web Application (Full-Stack Monorepo) |
| **Subtema** | Smart & Fun Education |
| **Kompetisi** | LOGICODIX 2026 Hackathon Competition |
| **Institusi** | SMKN 13 Bandung |
| **Tahun Pengembangan** | 2026 |
| **Status Repositori** | Aktif / Siap Diuji (*Production Ready*) |

---

## 2. Deskripsi Project

Discere adalah platform pembelajaran berbasis web yang menjembatani kebutuhan guru dalam menyampaikan materi secara visual sekaligus mengadakan asesmen formatif yang menyenangkan di dalam kelas.

Platform ini mengintegrasikan dua pilar utama dalam satu atap:
1. **Papan Tulis Digital Real-Time**: Kanvas vektor nirbatas (*infinite-like 2D canvas*) yang mendukung berbagai alat gambar, bentuk geometris, pengetikan teks, tabel interaktif, sisip gambar, autosave otomatis, serta kolaborasi antar-pengguna secara langsung (*multi-cursor live collaboration*).
2. **Game Edukasi Bertema Perlombaan 17 Agustus**: Sistem kuis interaktif yang mengadaptasi 4 permainan tradisional Indonesia: **Tarik Tambang**, **Balap Karung**, **Panjat Pinang**, dan **Makan Kerupuk**. Permainan dapat dimainkan dalam mode **Solo (Duel 1 vs 1)** langsung di satu layar proyektor melawan AI Bot atau pemain lokal, maupun mode **Multiplayer Kelas** di mana hingga 40 siswa bergabung serentak menggunakan ponsel pintar mereka melalui token PIN atau pemindaian QR Code tanpa perlu mendaftar akun.

Platform ini juga dilengkapi dengan integrasi **Kecerdasan Buatan (Google Gemini API)** untuk membantu guru memproduksi bank soal pilihan ganda secara instan dari dokumen materi serta asisten papan tulis pintar untuk membedah langkah penyelesaian soal secara otomatis.

---

## 3. Latar Belakang dan Tujuan

### Latar Belakang Permasalahan
1. **Kejenuhan Evaluasi Konvensional**: Asesmen formatif di kelas sering kali masih didominasi lembar kerja statis atau kuis digital monoton yang menurunkan atensi dan motivasi belajar peserta didik.
2. **Fragmentasi Alat Bantu Mengajar**: Guru kerap kali harus berpindah-pindah platform—satu aplikasi untuk mencorat-coret materi visual, aplikasi lain untuk kuis, dan platform lain untuk analisis nilai siswa.
3. **Friksi Akses Peserta Didik**: Banyak platform evaluasi mengharuskan siswa mengunduh aplikasi terpisah atau melalui proses registrasi akun yang menyita waktu jam pelajaran.
4. **Beban Kerja Penyusunan Asesmen**: Guru membutuhkan waktu signifikan untuk merumuskan variasi soal evaluasi yang kontekstual dan berkualitas setiap pertemuan kelas.

### Tujuan Pengembangan
- **Meningkatkan Keterlibatan Siswa**: Mengubah evaluasi belajar menjadi ajang kolaboratif yang menggugah semangat kebersamaan dan sportivitas melalui tema festival tradisional Indonesia.
- **Efisiensi Kerja Pendidik**: Menyediakan satu wadah terpadu untuk menerangkan materi (*Whiteboard*), membuat bank soal (*AI Generator*), menyelenggarakan lomba kelas (*Live Games*), hingga melihat rekapitulasi analitik ketuntasan belajar (*Heatmap & Leaderboard*).
- **Aksesibilitas Tanpa Batas**: Memberikan kemudahan bagi siswa untuk langsung bergabung dalam hitungan detik hanya dengan memindai QR Code atau mengetik PIN 6-digit tanpa batasan perangkat dan tanpa registrasi akun.

---

## 4. Fitur Utama

### A. Papan Tulis Digital Kolaboratif (Interactive Whiteboard)
- **Engine Vektor HTML5 Canvas 2D**: Responsif, presisi tinggi, dan mulus untuk perangkat layar sentuh, stylus, maupun mouse desktop.
- **Peralatan Lengkap**: Pena biasa, kuas kaligrafi, penghapus (*eraser*), bentuk dasar geometris (garis, persegi, lingkaran, panah), blok teks bebas, tabel matriks data, dan pengunggah gambar (*image insert*).
- **Kolaborasi Multi-Pengguna Real-Time**: Sinkronisasi jalur coretan, perpindahan elemen, dan visualisasi kursor kolaborator secara langsung menggunakan Socket.IO.
- **Sistem Hak Akses Berbagi**: Guru dapat membagikan tautan papan dengan peran **Editor** (dapat mengedit bersama) atau **Viewer** (hanya melihat tampilan guru secara langsung).
- **Manajemen Riwayat & Ekspor**: Mendukung *Undo/Redo stack*, penyimpanan otomatis (*debounced autosave*), ekspor visual ke format gambar PNG kualitas tinggi, serta ekspor struktur dokumen JSON.

### B. Empat Permainan Edukasi Tradisional (Dual Mode: Solo & Multi)

| Permainan | Mekanika Permainan | Mode Solo (1 vs 1) | Mode Multiplayer (Kelas) |
|---|---|---|---|
| **Tarik Tambang** | Setiap jawaban benar menghasilkan gaya tarikan tali menuju sisi tim. Tim dengan tarikan terkuat atau yang berhasil menarik bendera melewati batas menang. | Duel layar terbelah (*split-screen*) melawan AI Bot atau kawan sebangku pada 1 perangkat guru. | Kelas dibagi menjadi 2 tim seimbang (Merah vs Biru). Seluruh siswa menjawab cepat di HP masing-masing untuk mengakumulasikan tarikan tali. |
| **Balap Karung** | Karung melompat maju saat menjawab benar dan terkena penalti mundur/tersandung jika salah atau kehabisan waktu. | Adu cepat 2 peserta melintasi lintasan meteran hingga mencapai garis finis. | Siswa dibagi ke dalam 3 atau 4 tim lintasan balap karung serempak dengan papan peringkat tim *real-time*. |
| **Panjat Pinang** | Peserta memanjat tiang pinang licin. Terdapat rintangan licin (*oli/lumpur*) dan hadiah kejutan (*power-up bonus*) di ketinggian tertentu. | Dua pemanjat berlomba mencapai puncak tiang 100% terlebih dahulu pada layar proyektor. | Adu ketangkasan antar-regu kelas dalam menaklukkan puncak tiang pinang dengan heatmap ketepatan jawaban. |
| **Makan Kerupuk** | Kerupuk virtual tergantung pada tali bergoyang. Jawaban benar memberikan gigitan sukses untuk menghabiskan kerupuk lebih cepat. | Menghabiskan kerupuk kepingan demi kepingan melawan ritme kecerdasan Bot AI. | Seluruh siswa di kelas berkompetisi individu/tim untuk menghabiskan kerupuk tercepat dengan animasi gigitan dinamis. |

### C. Kecerdasan Buatan (Google Gemini API)
- **AI Soal Generator**: Menghasilkan 1 hingga 20 soal pilihan ganda secara terstruktur (teks pertanyaan, opsi A–E, kunci jawaban, dan pembahasan) hanya dari input teks ringkasan materi pelajaran.
- **Tanya AI Papan Tulis**: Guru dapat menyeleksi bidang tertentu pada kanvas papan tulis dan meminta AI membedah rumus, menerjemahkan bahasa, atau memberikan uraian materi pendukung.
- **Obrolan Asisten Pembelajaran**: Asisten percakapan interaktif bagi guru untuk berkonsultasi seputar silabus atau inspirasi metode mengajar.
- **Optimalisasi Token & Cache**: Setiap permintaan AI dilengkapi hashing SHA-256 untuk mendeteksi *cache hit*, meminimalkan latensi, serta menghemat kuota harian.

### D. Portal Guru (Teacher Dashboard)
- Pengelolaan pustaka template kuis pribadi dan template resmi bawaan sistem.
- Monitoring ruang tunggu (*waiting room*), penguncian ruangan (*lock lobby*), dan kontrol pelepasan siswa (*kick participant*).
- Riwayat sesi tanding lengkap dengan podium juara, persentase akurasi, dan matriks *heatmap* analisis butir soal untuk mengidentifikasi materi yang belum dikuasai kelas.

### E. Portal Administrator (Supervision & Governance)
- Pengawasan kesehatan sistem dan statistik agregat penggunaan platform.
- Manajemen status akun guru (aktivasi, penangguhan, atau nonaktivasi).
- Pengelolaan template kuis resmi yang dapat diakses oleh seluruh pendidik.
- Log audit keamanan aktivitas administratif dan pemantauan utilisasi kuota AI harian.

---

## 5. Tech Stack

Discere dibangun menggunakan arsitektur modern berbasis monorepo TypeScript dengan standar performa dan skalabilitas tinggi:

### Frontend (`client/`)
| Teknologi | Versi | Peran & Kegunaan |
|---|---|---|
| **React** | `^19.3.1` | Pustaka antarmuka deklaratif berbasis komponen terbaru |
| **Vite** | `^8.3.6` | Frontend build tool berkecapatan tinggi dengan HMR instan |
| **React Router** | `^7.18.5` | Manajemen routing aplikasi SPA |
| **TailwindCSS** | `^4.3.5` | Framework styling utilitas terkini via `@tailwindcss/vite` |
| **Socket.IO Client** | `^4.8.4` | Klien komunikasi dua arah berbasis WebSocket |
| **Lucide React** | `^1.70.0` | Ikonografi modern dan konsisten |
| **Zod** | `^4.6.7` | Validasi skema tipe data runtime |
| **Web Audio API** | Native Browser | Audio synthesizer prosedural untuk efek suara game tanpa aset audio eksternal |

### Backend (`server/`)
| Teknologi | Versi | Peran & Kegunaan |
|---|---|---|
| **Node.js** | `>=20.x` (LTS) | Lingkungan runtime server asynchronous |
| **Express.js** | `^5.3.0` | Framework RESTful API minimalis dan tangguh versi terbaru |
| **Socket.IO** | `^4.8.4` | Engine komunikasi real-time untuk sinkronisasi game dan papan tulis |
| **Prisma ORM** | `^7.10.1` | ORM modern dengan schema declarations & automated migrations |
| **Database Adapter** | `@prisma/adapter-better-sqlite3`<br>`@prisma/adapter-pg` | Driver adapter fleksibel untuk SQLite lokal maupun PostgreSQL produksi |
| **Keamanan & Auth** | `bcryptjs` `^3.0.3`<br>`jsonwebtoken` `^9.0.3` | Hashing kata sandi searah dan otorisasi sesi berbasis JWT via HTTP-only cookie |
| **AI Integration** | Google Gemini API | Model `gemini-2.5-flash` untuk kuis generator dan analisis kontekstual |
| **Utility** | `qrcode` `^1.5.4`<br>`express-rate-limit` `^8.7.3` | Pembuatan QR Code otomatis dan perlindungan brute-force API |

### Pengujian & Kualitas (`root`)
| Alat | Versi | Peran |
|---|---|---|
| **Playwright Test** | `^1.65.1` | Automated End-to-End (E2E) testing lintas viewport |
| **Concurrently** | `^9.1.2` | Menjalankan klien dan server secara paralel dalam pengembangan |
| **TypeScript** | `~5.8.0` / `^7.0.2` | Static type checking end-to-end |

---

## 6. Arsitektur Sistem

Discere menerapkan pemisahan tugas (*separation of concerns*) yang jelas antara penyajian grafis di sisi peramban, *in-memory state machine* real-time di server, dan lapisan penyimpanan data terstruktur.

```mermaid
flowchart TD
    subgraph Frontend_Klien ["Frontend (React 19, Vite, TailwindCSS v4)"]
        UI_PUBLIC["Halaman Publik: Beranda, Gabung Siswa, Masuk"]
        UI_GURU["Portal Guru: Dashboard, Pengaturan Game, Riwayat"]
        UI_ADMIN["Portal Admin: Statistik, Kelola Guru, Template Pustaka"]
        UI_CANVAS["Engine Papan Tulis: HTML5 Canvas 2D & Collaborative Sync"]
        UI_HOST["Layar Host Game: Proyektor Tarik Tambang, Balap Karung, Pinang, Kerupuk"]
        UI_PLAYER["Layar Kuis Siswa: PIN Token, Kartu Soal Real-Time di Ponsel"]
    end

    subgraph Backend_Server ["Backend Server (Node.js & Express 5)"]
        REST_ROUTER["REST API Gateway (/api/auth, /api/template, /api/sesi, /api/papan)"]
        AI_ENGINE["AI Processing Service (Prompting, Output Validation, SHA Cache)"]
        SOCKET_HUB["Socket.IO Hub (Connection Recovery, Event Dispatcher)"]

        subgraph In_Memory_State ["In-Memory Game & Session Managers"]
            MGR_SOLO["Solo Game Managers (Tarik, Balap, Pinang, Kerupuk 1 vs 1)"]
            MGR_MULTI["Multiplayer Game Managers (40 Siswa, Tim Balance, Timer Otoritatif)"]
            MGR_BOARD["Board Room Manager (Live Cursor & Stroke Broadcast)"]
        end
    end

    subgraph Storage_Layer ["Penyimpanan Data & AI"]
        PRISMA_CLIENT["Prisma ORM Client (Driver Adapters)"]
        DB_SQLITE[("SQLite Database (dev.db) / PostgreSQL (Supabase)")]
        GEMINI_CLOUD["Google Gemini AI API (gemini-2.5-flash)"]
    end

    UI_PUBLIC -->|HTTP Fetch / JSON| REST_ROUTER
    UI_GURU -->|HTTP Fetch / Cookies| REST_ROUTER
    UI_ADMIN -->|HTTP Fetch / Cookies| REST_ROUTER
    UI_CANVAS <-->|WebSocket: papan:ubah, kursor| MGR_BOARD
    UI_CANVAS -->|Autosave REST| REST_ROUTER
    UI_HOST <-->|WebSocket: sesi:mulai, update game, akhiri| SOCKET_HUB
    UI_PLAYER <-->|WebSocket: jawab:kirim, status ronde| SOCKET_HUB

    SOCKET_HUB --> MGR_SOLO
    SOCKET_HUB --> MGR_MULTI
    SOCKET_HUB --> MGR_BOARD
    REST_ROUTER --> AI_ENGINE
    AI_ENGINE <-->|HTTPS API & Caching| GEMINI_CLOUD

    REST_ROUTER --> PRISMA_CLIENT
    MGR_SOLO -->|Simpan Laporan & Hasil| PRISMA_CLIENT
    MGR_MULTI -->|Simpan Laporan & Hasil| PRISMA_CLIENT
    AI_ENGINE -->|Catat Log Penggunaan & Cache| PRISMA_CLIENT
    PRISMA_CLIENT --> DB_SQLITE
```

---

## 7. Struktur Folder Project

Monorepo Discere ditata dengan struktur yang rapi dan terisolasi:

```text
DIscere/
├── .github/                     # Konfigurasi workflow CI/CD
├── client/                      # Aplikasi Frontend (React 19 + Vite)
│   ├── public/                  # Aset publik statis (favicon, logo, manifest)
│   ├── src/
│   │   ├── assets/              # Gambar ilustrasi dan ikon lokal
│   │   ├── components/          # Komponen antarmuka (GameConfig, Stadium, Modal, Papan)
│   │   ├── pages/               # Halaman aplikasi
│   │   │   ├── admin/           # Dashboard administrator
│   │   │   ├── game/            # Layar Host pertandingan (Solo & Multiplayer)
│   │   │   ├── guru/            # Dashboard guru, form template, pemilih mode game
│   │   │   ├── papan/           # Halaman kanvas papan tulis interaktif
│   │   │   ├── publik/          # Landing page, halaman masuk & daftar
│   │   │   └── siswa/           # Halaman ruang tunggu & layar jawab soal siswa
│   │   ├── App.tsx              # Router deklaratif React Router v7
│   │   └── main.tsx             # Entry point klien
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                      # Aplikasi Backend (Express 5 + Prisma)
│   ├── prisma/
│   │   ├── migrations/          # Berkas riwayat migrasi skema database
│   │   ├── schema.prisma        # Skema Prisma untuk PostgreSQL
│   │   ├── schema.sqlite.prisma # Skema Prisma untuk SQLite lokal
│   │   └── seed.ts              # Script pengisian data awal (Admin, Guru, Template Kuis)
│   ├── src/
│   │   ├── ai/                  # Logika prompt & integrasi Google Gemini API
│   │   ├── games/               # Mesin aturan dan state manager 4 game
│   │   ├── middleware/          # Middleware autentikasi JWT, validasi role, & error handler
│   │   ├── realtime/            # Handler event WebSocket Socket.IO (sesi & papan)
│   │   ├── routes/              # Controller REST API (auth, template, sesi, papan, ai, admin)
│   │   ├── utils/               # Helper jaringan lokal IP, kalkulasi skor, filter pencarian
│   │   ├── config.ts            # Manajemen konfigurasi environment
│   │   ├── db.ts                # Inisialisasi Prisma Client & driver adapter dinamis
│   │   └── index.ts             # Server entry point HTTP & Socket.IO
│   ├── package.json
│   └── tsconfig.json
├── tests/                       # Automated End-to-End Testing (Playwright)
│   ├── e2e/                     # Test spec (homepage, settings, 4 gameplay, hasil, responsif)
│   ├── fixtures/                # Custom auth fixture (guruPage)
│   └── utils/                   # Test helper fungsi login & pemilihan template kuis
├── .env.example                 # Template variabel lingkungan
├── .gitignore                   # Daftar pengabaian berkas Git
├── Claude.md                    # Pedoman rekayasa & konvensi tim
├── package.json                 # Monorepo root package & script orchestrator
├── playwright.config.ts         # Konfigurasi pengujian Playwright
├── PLAYWRIGHT_TESTING.md        # Panduan teknis lengkap E2E testing
└── README.md                    # Dokumentasi utama proyek
```

---

## 8. Prasyarat Instalasi

Sebelum memulai instalasi, pastikan lingkungan komputer Anda telah memenuhi persyaratan berikut:

| Komponen | Versi yang Direkomendasikan | Catatan |
|---|---|---|
| **Node.js** | `>= 20.18.0` (LTS) atau `v22.x` | Diuji kompatibel hingga Node.js v24 |
| **npm** | `>= 10.x` | Bawaan Node.js |
| **Git** | Versi terbaru | Untuk kloning repositori |
| **Peramban Web** | Google Chrome / Chromium / Edge | Untuk menjalankan aplikasi & automated test |

---

## 9. Panduan Instalasi dan Setup

Ikuti tahapan berikut secara berurutan untuk memasang project di komputer lokal:

### 1. Kloning Repositori
```bash
git clone https://github.com/refkyaja/DIscere.git
cd DIscere
```

### 2. Pasang Seluruh Dependensi
Jalankan perintah instalasi di root direktori (npm workspaces akan secara otomatis memasang dependensi root, client, dan server):
```bash
npm install
```

### 3. Siapkan Konfigurasi Environment
Salin template variabel lingkungan:
- **Linux / macOS:**
  ```bash
  cp .env.example .env
  ```
- **Windows (PowerShell / Command Prompt):**
  ```powershell
  copy .env.example .env
  ```

### 4. Setup Database dan Seed Data
Jalankan migrasi Prisma dan seed data awal:
```bash
# Menyiapkan skema database lokal
npm run db:migrate

# Mengisi akun demo (Admin & Guru) serta materi kuis 4 permainan
npm run db:seed
```

---

## 10. Konfigurasi Environment Variables

Konfigurasi aplikasi disimpan di file `.env` pada direktori root project. Berikut adalah daftar variabel yang tersedia:

```env
# ===================================================================
# 1. Konfigurasi Server
# ===================================================================
PORT=3000

# ===================================================================
# 2. Konfigurasi Basis Data
# ===================================================================
# Opsi A: SQLite Lokal (Direkomendasikan untuk pengembangan offline)
DATABASE_URL="file:./dev.db"

# Opsi B: PostgreSQL / Supabase (Untuk pengujian lingkungan produksi)
# DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# ===================================================================
# 3. Kunci Rahasia Autentikasi JWT
# ===================================================================
JWT_SECRET="ganti_dengan_string_acak_panjang_dan_rahasia_minimal_32_karakter"

# ===================================================================
# 4. Integrasi Google Gemini AI (Opsional pada saat offline)
# ===================================================================
AI_API_KEY=""
AI_MODEL="gemini-2.5-flash"
AI_BATAS_HARIAN=30
AI_BATAS_OBROL=40

# ===================================================================
# 5. Kredensial Akun Demonstrasi (Digunakan oleh script db:seed)
# ===================================================================
SEED_ADMIN_EMAIL="admin@discere.local"
SEED_ADMIN_PASSWORD="AdminDiscere2026!"
SEED_GURU_EMAIL="guru@discere.local"
SEED_GURU_PASSWORD="GuruDiscere2026!"
```

> [!IMPORTANT]
> **Keamanan Kredensial:** Jangan pernah melakukan commit file `.env` yang memuat API Key asli atau kredensial produksi ke repositori publik.

---

## 11. Cara Menjalankan Frontend dan Backend

### A. Mode Pengembangan (Development)
Untuk menjalankan frontend (Vite) dan backend (Express) secara serentak dalam satu terminal:
```bash
npm run dev
```

Layanan akan aktif pada alamat:
- **Frontend Klien:** `http://localhost:5173`
- **Backend REST API & WebSocket:** `http://localhost:3000`
- **Health Check API:** `http://localhost:3000/api/health`

*(Vite dev server pada port 5173 telah dikonfigurasi dengan reverse-proxy internal untuk otomatis meneruskan rute `/api` dan `/socket.io` ke port 3000).*

### B. Mode Produksi (Production Build & Run)
1. Lakukan kompilasi seluruh aset frontend dan backend:
   ```bash
   npm run build
   ```
2. Jalankan server produksi:
   ```bash
   npm start
   ```
   Aplikasi akan melayani API dan antarmuka terpadu pada `http://localhost:3000`.

### C. Menjalankan Automated End-to-End Testing (Playwright)
Discere dilengkapi dengan 18 skenario E2E test yang menguji fungsionalitas seluruh fitur dan 4 gameplay secara otomatis:
```bash
# Jalankan seluruh test suite (headless)
npm run test:e2e

# Jalankan Playwright dalam mode antarmuka visual interaktif
npm run test:e2e:ui

# Tampilkan laporan HTML hasil pengetesan
npm run test:e2e:report
```

---

## 12. Informasi Database dan Migrasi

Discere menggunakan **Prisma 7** yang dikombinasikan dengan driver adapter dinamis (`@prisma/adapter-better-sqlite3` dan `@prisma/adapter-pg`). Arsitektur ini memungkinkan aplikasi bekerja secara luring (*offline*) dengan SQLite saat demonstrasi, maupun beralih ke PostgreSQL terdistribusi tanpa mengubah satu baris pun kode logika bisnis.

### Skema Entitas Utama (ERD Ringkas)
- **`User`**: Menyimpan kredensial guru dan admin dengan role-based access control.
- **`Template` & `Question`**: Menyimpan pustaka kuis, pilihan ganda A–E, bobot, dan pembahasan.
- **`Session` & `SessionPlayer`**: Mengelola status sesi aktif, konfigurasi permainan, peserta yang tergabung, dan alokasi tim.
- **`SessionResult` & `QuestionStat`**: Rekapitulasi podium pemenang, akurasi, waktu penyelesaian, dan analisis butir soal.
- **`Board` & `BoardShare`**: Menyimpan dokumen vektor kanvas papan tulis serta token izin berbagi kolaborator.
- **`AiCache`, `AiUsage`, & `AdminLog`**: Caching respons AI berbasis hash SHA-256, batas kuota harian, dan audit trail aksi admin.

### Perintah Pengelolaan Database
```bash
# Melakukan migrasi skema database di server
npm run db:migrate

# Mengisi data awal (akun demo & contoh materi kuis)
npm run db:seed

# Menghasilkan ulang Prisma Client setelah perubahan skema
npm --prefix server run db:generate
```

---

## 13. Dokumentasi API (Endpoints)

Backend Discere mengekspos endpoint RESTful yang terstruktur:

### 1. Autentikasi (`/api/auth`)
| Method | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| `POST` | `/api/auth/register` | Publik | Mendaftarkan akun guru baru |
| `POST` | `/api/auth/login` | Publik | Masuk dengan email & password (mengembalikan cookie JWT) |
| `GET` | `/api/auth/me` | Autentikasi | Mendapatkan data profil sesi saat ini |
| `POST` | `/api/auth/logout` | Autentikasi | Menghapus cookie sesi autentikasi |

### 2. Template Kuis (`/api/template`)
| Method | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/template` | Guru | Mengambil seluruh template kuis milik guru yang login |
| `GET` | `/api/template/pustaka` | Guru | Mengambil daftar template resmi bawaan sistem |
| `GET` | `/api/template/:id` | Guru | Mengambil detail template dan daftar pertanyaan |
| `POST` | `/api/template` | Guru | Membuat template kuis baru beserta butir soal |
| `PUT` | `/api/template/:id` | Guru | Memperbarui isi dan konfigurasi template |
| `DELETE` | `/api/template/:id` | Guru | Menghapus template kuis |

### 3. Sesi Permainan (`/api/sesi`)
| Method | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| `POST` | `/api/sesi` | Guru | Membuka sesi baru (Solo / Multiplayer untuk salah satu dari 4 game) |
| `GET` | `/api/sesi/:id` | Guru / Publik | Mengambil data dan status permainan sesi |
| `GET` | `/api/sesi/token/:token` | Siswa | Memvalidasi token PIN 6-digit untuk bergabung ke lobi |
| `POST` | `/api/sesi/:id/mulai` | Guru | Mengubah status sesi menjadi `PLAYING` dan memulai ronde |
| `POST` | `/api/sesi/:id/jeda` | Guru | Menjeda sementara pertandingan |
| `POST` | `/api/sesi/:id/lanjut` | Guru | Melanjutkan pertandingan yang dijeda |
| `POST` | `/api/sesi/:id/selesai` | Guru | Mengakhiri pertandingan dan menghitung rekapitulasi nilai |
| `POST` | `/api/sesi/:id/jawab` | Guru | Mengirimkan jawaban peserta pada mode Solo (Duel 1 vs 1) |

### 4. Papan Tulis Digital (`/api/papan`)
| Method | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/papan` | Guru | Mengambil daftar seluruh papan tulis milik guru |
| `GET` | `/api/papan/:id` | Guru / Editor | Memuat data elemen kanvas papan tulis |
| `POST` | `/api/papan` | Guru | Membuat lembar papan tulis baru |
| `PUT` | `/api/papan/:id` | Guru / Editor | Menyimpan data elemen kanvas (*autosave debounced*) |
| `DELETE` | `/api/papan/:id` | Guru | Menghapus papan tulis |
| `POST` | `/api/papan/:id/share` | Guru | Membuat tautan token kolaborasi (Editor / Viewer) |
| `GET` | `/api/papan/shared/:token` | Publik | Membuka papan tulis kolaboratif melalui tautan berbagi |

### 5. Kecerdasan Buatan (`/api/ai`)
| Method | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| `POST` | `/api/ai/generate-soal` | Guru | Menghasilkan kumpulan soal otomatis dari teks materi |
| `POST` | `/api/ai/tanya-papan` | Guru | Menganalisis potongan gambar kanvas papan tulis |
| `POST` | `/api/ai/chat` | Guru | Konsultasi materi interaktif dengan asisten AI |
| `GET` | `/api/ai/quota` | Guru | Menampilkan sisa limit kuota harian guru |

### 6. Layanan Admin & Sistem
| Method | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/health` | Publik | Health-check status server |
| `GET` | `/api/info/server` | Guru | Mendapatkan informasi IP lokal LAN untuk QR Code |
| `GET` | `/api/admin/stats` | Admin | Ringkasan statistik pengguna, sesi, dan aktivitas |
| `GET` | `/api/admin/users` | Admin | Daftar dan kontrol status aktif pengguna |

---

## 14. Panduan Penggunaan

### Akun Demonstrasi (Evaluasi Dewan Juri)
Untuk mempermudah peninjauan langsung, script seed menyediakan dua akun terverifikasi:

| Akun | Email | Kata Sandi | Kegunaan |
|---|---|---|---|
| **Administrator** | `admin@discere.local` | `AdminDiscere2026!` | Pengawasan platform, manajemen guru, dan pustaka template |
| **Guru Demo** | `guru@discere.local` | `GuruDiscere2026!` | Dilengkapi contoh papan tulis dan template kuis 4 game siap main |

### Skenario 1: Menjalankan Game Solo (1 vs 1) di Kelas
1. Guru login melalui halaman `/masuk` dengan akun guru.
2. Pada Dashboard Guru, pilih materi kuis pada kartu salah satu game (misal: *Tarik Tambang*).
3. Di halaman Pengaturan Game, klik opsi **"Solo Mode (1 vs 1)"**, tentukan lawan (AI Bot atau Pemain Lokal), lalu klik **"Buka Arena Solo"**.
4. Guru menekan tombol **"Mulai Lomba"** di layar proyektor.
5. Pemain 1 dan Pemain 2 (atau Bot) menjawab pertanyaan yang muncul di layar proyektor secara bergantian/adu cepat.
6. Permainan berakhir otomatis jika batas waktu habis atau target menang tercapai, menampilkan podium juara dan opsi *Main lagi*.

### Skenario 2: Menjalankan Game Multiplayer Massal (Ponsel Siswa)
1. Guru memilih materi kuis dan memilih opsi **"Multiplayer Tim"** pada halaman Pengaturan Game.
2. Klik tombol **"Buat Sesi Multiplayer & Buka Lobi PIN"**.
3. Layar proyektor akan menampilkan **6-digit PIN** dan **QR Code**.
4. Siswa membuka menu **Gabung Permainan** (`/join`), mengetik PIN atau memindai QR Code, lalu memasukkan nama panggilan mereka.
5. Guru melihat daftar siswa yang bergabung pada denah kelas virtual di layar proyektor.
6. Guru mengklik **"Mulai Game"**. Soal akan mengalir langsung ke layar ponsel masing-masing siswa secara *real-time*.

### Skenario 3: Menggunakan Papan Tulis Kolaboratif & Asisten AI
1. Pada menu dashboard guru, buka tab **Papan Tulis** dan buat lembar kerja baru.
2. Gunakan berbagai alat gambar, penulisan rumus, dan bentuk geometri pada kanvas.
3. Klik tombol **Bagikan** untuk menyalin tautan kolaborasi bagi siswa atau guru mitra.
4. Gunakan fitur **Tanya AI** untuk menanyakan langkah penyelesaian soal matematika/sains langsung pada materi yang ditulis di kanvas.

---

## 15. Deployment

### Status Deployment Saat Ini
Saat ini repositori Discere dioptimalkan untuk pengujian lokal terpadu (*Local Full-Stack Monorepo*) dengan dukungan SQLite nir-konfigurasi serta opsi beralih ke PostgreSQL terdistribusi (misalnya melalui Supabase).

### Langkah Menyiapkan Server Produksi Mandiri (Self-Hosted VPS)
1. **Build Klien dan Server:**
   ```bash
   npm run build
   ```
2. **Konfigurasi Lingkungan Produksi:**
   - Atur `NODE_ENV=production`
   - Gunakan `DATABASE_URL` PostgreSQL yang telah terkonfigurasi connection pooler.
   - Atur `JWT_SECRET` yang kuat (minimal 32 karakter acak).
3. **Jalankan Aplikasi:**
   ```bash
   npm start
   ```
   *Rekomendasi:* Gunakan process manager seperti **PM2** (`pm2 start server/dist/index.js --name discere-backend`) dan reverse proxy **Nginx** dengan sertifikat SSL/TLS (Let's Encrypt).

> [!NOTE]
> **Rencana Pengembangan Deployment (TODO):**
> - Penambahan `Dockerfile` dan `docker-compose.yml` multi-stage untuk orkestrasi container backend dan frontend otomatis.
> - Konfigurasi pipeline deployment otomatis via GitHub Actions menuju cloud provider seperti Vercel / Railway / VPS.

---

## 16. Tim Pengembang

Proyek ini dirancang dan dikembangkan dengan dedikasi tinggi oleh **Tim Timber** dari **SMKN 13 Bandung**:

| Anggota Tim | Peran & Tanggung Jawab Utama | Kontak / GitHub |
|---|---|---|
| **Refky** | **Lead Frontend & Canvas Architect**<br>- Perancangan antarmuka Landing Page & Halaman Publik.<br>- Pengembangan engine Papan Tulis Digital (HTML5 Canvas 2D) & sinkronisasi live cursor.<br>- Desain antarmuka Portal Guru dan Admin. | [@refkyaja](https://github.com/refkyaja) |
| **Kaka** | **Full-Stack Logic & Dashboard Lead**<br>- Arsitektur logika sistem dan alur state pada Dashboard Guru & Admin.<br>- Perancangan form konfigurasi game dan sistem pembagian tim.<br>- Manajemen skema database Prisma dan otentikasi JWT. | [@Kalzz76](https://github.com/Kalzz76) |
| **Alip** | **Game Engine & Audio Designer**<br>- Pengembangan logika 4 mesin game (Tarik Tambang, Balap Karung, Panjat Pinang, Makan Kerupuk).<br>- Sintesis efek audio prosedural dengan Web Audio API.<br>- Koordinasi administrasi tim dan pengujian skenario lomba. | [@lemonade199](https://github.com/lemonade199) |

---

## 17. Atribusi & Lisensi

- **Lisensi Proyek**: Dikembangkan khusus untuk keperluan kompetisi **LOGICODIX 2026 Hackathon Competition**. Hak cipta kode sumber melekat pada Tim Timber, SMKN 13 Bandung.
- **Tipografi**: Font *Baloo 2*, *Inter*, dan *Plus Jakarta Sans* dilisensikan di bawah [SIL Open Font License 1.1](https://scripts.sil.org/OFL).
- **Ikon**: Disediakan oleh [Lucide Icons](https://lucide.dev) di bawah lisensi ISC.
- **Audio**: 100% disintesis secara prosedural melalui Web Audio API bawaan peramban web tanpa menggunakan berkas sampel audio berhak cipta pihak ketiga.

---

<p align="center">
  <b>Discere — Belajar Serius, Bermain Gembira!</b><br>
  <i>Tim Timber • SMKN 13 Bandung • LOGICODIX 2026</i>
</p>
