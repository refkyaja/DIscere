# Dokumentasi Playwright End-to-End (E2E) Testing — Discere

Dokumen ini berisi panduan lengkap setup, arsitektur, eksekusi, serta pemeliharaan automated test menggunakan **Playwright Test** pada project **Discere**.

---

## 1. Ringkasan & Arsitektur Pengujian

Discere mengimplementasikan automated testing berbasis browser (Chromium) untuk memastikan seluruh fitur utama, alur permainan, dan tampilan antarmuka (UI/UX) bekerja sempurna dari sudut pandang pengguna akhir.

### Ruang Lingkup Pengujian
1. **Homepage & Navigasi**: Memastikan beranda termuat dengan cepat, elemen brand & tombol CTA berfungsi, serta bebas dari crash/error JavaScript.
2. **Pengaturan Game (Game Settings)**: Memastikan form konfigurasi untuk keempat game (Tarik Tambang, Balap Karung, Panjat Pinang, Makan Kerupuk) dapat memuat template kuis, mengubah opsi, dan memvalidasi ketersediaan soal.
3. **Gameplay 4 Permainan Tradisional**:
   - **Tarik Tambang**: Pengoperasian mode solo duel, menjawab pertanyaan, kalkulasi pergeseran tali, serta penyelesaian permainan.
   - **Balap Karung**: Memilih mode solo, menjawab soal, pergerakan/lompatan karung, dan feedback jawaban.
   - **Panjat Pinang**: Visualisasi arena dan tiang pinang (*bamboo rod*), interaksi memilih jawaban bertingkat, dan status skor pendakian.
   - **Makan Kerupuk**: Mekanisme memilih kepingan opsi jawaban kerupuk (`.kp-op`), feedback status benar/salah, dan progres permainan.
4. **Hasil Permainan (Game Result)**: Verifikasi podium juara, akurasi skor peserta, tombol *"Main lagi"*, dan navigasi kembali ke dashboard guru.
5. **Responsivitas UI/UX**: Uji tampilan pada 3 kelas viewport standar: **Desktop** (1280x720), **Tablet** (768x1024), dan **Mobile** (375x667).

---

## 2. Struktur Folder Pengujian

Testing diletakkan pada folder root `tests/` dengan hierarki berikut:

```text
tests/
├── e2e/
│   ├── homepage.spec.ts        # Tes Homepage, elemen hero, navbar, konsol error
│   ├── settings.spec.ts        # Tes form pengaturan ke-4 jenis permainan
│   ├── tarik-tambang.spec.ts   # Tes gameplay Tarik Tambang
│   ├── balap-karung.spec.ts    # Tes gameplay Balap Karung
│   ├── panjat-pinang.spec.ts   # Tes gameplay Panjat Pinang
│   ├── makan-kerupuk.spec.ts   # Tes gameplay Makan Kerupuk
│   ├── game-result.spec.ts     # Tes layar akhir / podium / ringkasan hasil
│   └── responsive-ui.spec.ts   # Tes responsif Desktop, Tablet, & Mobile
├── fixtures/
│   └── auth.ts                 # Fixture custom: sesi login otomatis (guruPage)
└── utils/
    └── helpers.ts              # Helper login, kredensial demo, resolusi template kuis
```

---

## 3. Konfigurasi Playwright

Konfigurasi tersimpan pada file `playwright.config.ts`:
- **Base URL**: `http://localhost:5173` (didukung env `BASE_URL`).
- **Web Server Orchestration**: Otomatis menjalankan `npm run dev` dan memverifikasi kesiapan backend melalui `http://localhost:5173/api/health`.
- **Worker**: Dikonfigurasi `workers: 1` untuk mencegah *race condition* sesi database dan WebSocket real-time.
- **Artifacts on Failure**:
  - Screenshot otomatis diambil jika ada kegagalan (`only-on-failure`).
  - Video rekaman layar disimpan saat gagal (`retain-on-failure`).
  - Playwright Trace viewer aktif pada retry (`on-first-retry`).

---

## 4. Cara Menjalankan Pengujian

Pastikan dependency telah terinstal dan database telah di-seed terlebih dahulu:

```bash
# Pastikan migrasi & database seed telah tersedia
npm run db:seed -w server
```

### A. Menjalankan Seluruh Test Suite (Headless)
```bash
npm run test:e2e
```
*atau menggunakan npx secara langsung:*
```bash
npx playwright test
```

### B. Menjalankan Test Secara Spesifik
```bash
# Uji satu file spesifik (contoh: Tarik Tambang)
npx playwright test tests/e2e/tarik-tambang.spec.ts

# Uji berdasarkan tag/nama skenario
npx playwright test -g "Makan Kerupuk"

# Uji tampilan responsif saja
npx playwright test tests/e2e/responsive-ui.spec.ts
```

### C. Menjalankan Test dengan UI Mode Interaktif
Playwright UI Mode memungkinkan debugging visual interaktif, time-travel debugging, dan inspeksi DOM real-time:
```bash
npm run test:e2e:ui
```

### D. Melihat Laporan HTML Lengkap
Setelah testing selesai, laporan interaktif dapat dibuka dengan perintah:
```bash
npm run test:e2e:report
```

---

## 5. Ringkasan Skenario Pengujian

| File Test | Jumlah Kasus | Deskripsi Skenario Utama |
|---|:---:|---|
| `homepage.spec.ts` | 2 | Memeriksa loading homepage tanpa crash JavaScript, verifikasi hero section, dan tautan navbar (Masuk, Gabung). |
| `settings.spec.ts` | 4 | Membuka form pengaturan untuk Tarik Tambang, Balap Karung, Panjat Pinang, dan Makan Kerupuk, serta menguji interaksi perubahan parameter input. |
| `tarik-tambang.spec.ts` | 1 | Login guru, inisialisasi sesi Tarik Tambang Solo, membuka arena host, klik jawaban peserta, verifikasi feedback visual. |
| `balap-karung.spec.ts` | 1 | Inisialisasi sesi Balap Karung Solo, klik tombol mulai lomba, verifikasi kartu soal & pilihan opsi, feedback status jawaban. |
| `panjat-pinang.spec.ts` | 1 | Inisialisasi sesi Panjat Pinang Solo, verifikasi render arena & tiang pinang, memilih jawaban kuis, verifikasi feedback. |
| `makan-kerupuk.spec.ts` | 1 | Inisialisasi sesi Makan Kerupuk Solo, mulai lomba, verifikasi tombol opsi kerupuk `.kp-op`, verifikasi kalkulasi status jawaban. |
| `game-result.spec.ts` | 1 | Memulai pertandingan, mengakhiri laga, verifikasi kartu juara/podium hasil akhir, tombol *Main lagi*, dan tombol *Selesai/Kembali*. |
| `responsive-ui.spec.ts` | 7 | Verifikasi viewport Desktop (1280x720), Tablet (768x1024), dan Mobile (375x667) pada Landing Page, Halaman Gabung Siswa, dan Dashboard Guru tanpa *blank screen* / *overflow*. |

**Total Keseluruhan:** **18 Automated Test Cases (100% Passed)**.

---

## 6. Rekomendasi Pemeliharaan & Praktik Terbaik

1. **Selalu Gunakan Semantic Locators**: Utamakan `page.getByRole()`, `page.locator('button')` dengan filter teks atau atribut fungsional stabil (misal `button.kp-op`, `[data-panjat-pole-rod]`), hindari selector CSS rentan seperti tag hierarchy panjang (`div > div:nth-child(2) > span`).
2. **Ketersediaan Soal Minimal**: Aturan bisnis Discere mensyaratkan template memiliki minimal 2 soal untuk membuka tombol mulai. Selalu gunakan helper `getTemplateIdForGame()` untuk memastikan template yang diuji memenuhi syarat kuorum soal.
3. **Isolasi Database & Worker**: Mengingat aplikasi menggunakan Socket.IO dan SQLite dengan *file lock*, pertahankan `workers: 1` saat menguji flow gameplay real-time untuk mencegah perebutan koneksi antar-proses.
4. **CI/CD Integration**: Konfigurasi Playwright di atas sudah siap diintegrasikan pada GitHub Actions / GitLab CI menggunakan command `npm run test:e2e` dengan environment `CI=true`.

