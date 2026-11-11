# Discere

Platform kelas interaktif untuk guru: **papan tulis digital tak terbatas** untuk menjelaskan materi (seperti TV layar sentuh), lalu guru memilih **game lomba 17 Agustusan** (tarik tambang, dst.) yang soalnya sesuai materi. Jawaban benar membuat tim maju. Ada fitur **AI** untuk membuat soal dari materi dan menjawab soal yang dilingkari di papan tulis.

Dibuat untuk **LOGICODIX 2026 Hackathon Competition**, subtema **Smart & Fun Education**. Karya berupa MVP berbasis Web, harus **bisa dijalankan di localhost** saat Grand Final, dengan source code di repository GitHub.

Ada 2 jenis pengguna utama: **Guru** (daftar dan login) dan **Siswa** (tanpa akun, cukup token sesi dan nama panggilan). Ditambah **Admin** untuk mengelola platform, dengan akses yang sengaja dibatasi demi privasi guru.

## URUTAN KERJA (BACA DULU SEBELUM MENGERJAKAN APA PUN)

1. Baca `CLAUDE.md` ini sampai selesai.
2. Jalankan `git status` dan `git log --oneline -5`. Pastikan tidak ada perubahan yang belum di-commit dari pekerjaan sebelumnya.
3. Buka folder `referensi-desain/`: `PRD.md` (dokumen kebutuhan lengkap), `discere-v5.html` (referensi desain dan mesin kanvas 2D), dan `prototipe-lomba-pintar.html` (prototipe lama). Prototipe dipakai **hanya** untuk memahami alur interaksi dan aturan game. **Jangan meniru tampilannya**, karena desain papan tulis mengikuti `referensi-desain/discere-v5.html`.
4. Kerjakan **satu tahap saja** sesuai "Urutan Pengerjaan Modul". Jangan melompat ke tahap berikutnya sebelum tahap ini jalan dan di-commit.
5. Tulis kode mengikuti ATURAN PENULISAN KODE.
6. Setelah selesai: jalankan aplikasi, uji alurnya, lalu **commit** sesuai ATURAN GIT DAN TRANSPARANSI.

Kalau ada perbedaan antara `PRD.md`, prototipe, dan `CLAUDE.md`, **`CLAUDE.md` yang jadi acuan final**.

## ATURAN GIT DAN TRANSPARANSI (WAJIB DIPATUHI)

Peraturan lomba mewajibkan karya yang transparan dan bisa dipertanggungjawabkan, jadi riwayat Git harus menunjukkan proses pengerjaan yang jujur dan bertahap.

1. **Setiap selesai mengerjakan 1 fitur atau 1 tugas yang sudah jalan, langsung `git add` dan `git commit` sebelum lanjut ke hal lain.** Jangan menumpuk banyak fitur dalam satu commit, dan jangan menunggu akhir hari atau akhir tahap.
2. Sebelum commit, pastikan aplikasi **bisa dijalankan** dan perintah `npm run build` serta `npm run typecheck` lolos tanpa error. Jangan commit kode yang rusak.
3. Format pesan commit (Bahasa Indonesia, singkat, jelas, bentuk perintah):
   - `feat: tambah halaman daftar dan login guru`
   - `fix: perbaiki posisi tali saat jawaban benar bersamaan`
   - `refactor: pisahkan aturan tarik tambang dari handler socket`
   - `docs: perbarui README bagian cara menjalankan`
   - `chore: tambah .gitignore dan skrip db:seed`
   Satu commit = satu perubahan yang bisa dijelaskan dalam satu kalimat.
4. **Jangan pernah mengubah riwayat**: dilarang `git push --force`, `git rebase`, `git reset --hard` ke commit yang sudah di-push, `git commit --amend` setelah di-push, dan menghapus commit atau tag. Kalau ada kesalahan, perbaiki lewat commit baru.
5. Jangan mengubah `git config` (nama dan email pembuat commit). Commit memakai identitas pemilik project apa adanya.
6. **Jangan commit**: file `.env`, `node_modules/`, hasil build (`dist/`), file database (`*.db`, `*.sqlite`), dan kunci API. Pastikan `.gitignore` sudah memuatnya sejak commit pertama. Sediakan `.env.example` tanpa nilai rahasia.
7. Setelah SETIAP commit, langsung `git push` ke remote. Dilarang menumpuk commit yang belum di-push. Kalau remote belum diatur, beri tahu pemilik project.
8. Setelah **tiap tahap selesai**, beri tag sederhana: `git tag tahap-1`, `tahap-2`, dst., lalu push tag.
9. Setelah commit, tuliskan di balasan: hash singkat dan pesan commit, serta ringkasan apa yang sudah jalan dan apa yang belum.
10. **Batas submission:** Sabtu, 14 November 2026 (ikuti jam resmi dari panitia). Setelah batas waktu itu **tidak boleh ada commit atau perubahan apa pun**. Versi yang dinilai adalah commit terakhir sebelum batas waktu.
11. Penggunaan AI dalam pengembangan (kode ditulis dengan bantuan AI agent) dan sebagai fitur aplikasi **dicatat terbuka** di `README.md` pada bagian "Penggunaan AI". Jangan menyembunyikan atau menyamarkannya.

## ATURAN PENULISAN KODE (WAJIB DIPATUHI)

1. **TypeScript** di frontend dan backend dengan mode `strict`. Dilarang memakai `any` kecuali benar-benar tidak bisa dihindari, dan kalau dipakai beri alasan singkat.
2. **Kode harus sederhana dan mudah dibaca.** Tidak boleh ada dependency injection container, repository pattern, abstract class berlapis, atau generic yang rumit. Logika cukup di handler route atau fungsi biasa dalam satu file per modul.
3. Pakai `if`, `for`, `async/await`, dan query Prisma biasa. Hindari rantai `reduce` panjang, ternary bersarang, dan trik yang sulit dibaca.
4. **Yang penting jalan dan tidak error.** Utamakan kode yang lurus daripada kode yang pintar.
5. Nama variabel dan fungsi boleh campur Indonesia/Inggris (`daftarSoal`, `hitungPosisiTali`, `createSession`), tapi konsisten dalam satu file.
6. Semua teks untuk pengguna (label, tombol, pesan sukses, pesan error, validasi) ditulis dalam **Bahasa Indonesia**.
7. **Setiap input dari klien divalidasi di server dengan Zod** (body, query, params, dan data event Socket.IO). Pesan error validasi dalam Bahasa Indonesia.
8. Struktur database hanya berubah lewat **migration Prisma**. Data awal lewat seed.
9. Akses database hanya lewat Prisma. Kalau terpaksa memakai query mentah, wajib pakai parameter terikat, tidak boleh menyambung string dari input pengguna.
10. Komentar boleh dipakai **singkat dalam Bahasa Indonesia** untuk logika yang tidak jelas (misalnya aturan perhitungan tali). Jangan berlebihan, jangan mengomentari hal yang sudah jelas dari kodenya.
11. Library tambahan di luar daftar "Tech Stack" harus **ditanyakan dulu** ke pemilik project.
12. Fitur yang tidak ada di `CLAUDE.md` ini tidak boleh ditambahkan hanya karena kelihatan bagus. Prototipe dan PRD dipakai untuk memahami, bukan untuk menambah fitur.
13. Cek dokumentasi resmi **versi yang terpasang** untuk library yang API-nya berubah antar versi mayor (terutama **Prisma**, **React Router**). Jangan mencampur gaya import atau API versi lama.

Aturan ini berlaku untuk semua perubahan berikutnya, tanpa perlu diingatkan lagi.

## Konsep Produk

**Masalah:** guru SD sampai SMP kesulitan menjaga keterlibatan siswa saat menjelaskan dan menguji materi, karena alat yang ada terpisah-pisah dan tidak semua kelas bisa memakai HP.

**Solusi:** satu tempat untuk menjelaskan (papan tulis digital) dan menguji (game lomba 17-an). Dua mode main menjawab masalah perangkat:

- **Solo (satu layar bersama):** hanya layar guru. Perwakilan tim maju bergantian dan menyentuh jawaban. Tidak perlu HP.
- **Multiplayer (HP masing-masing):** siswa masuk dengan token, dibagi ke dua tim, menjawab dari HP, dan tali bergerak real-time di layar guru.

**Alur utama:**
1. Guru daftar dan login, lalu masuk dashboard.
2. Guru membuat **template** (materi, game, mode, soal manual atau dibuat AI).
3. Guru membuka **papan tulis** untuk menjelaskan materi.
4. Dari papan tulis, guru membuka sidebar **Template Game** di kanan dan memilih template.
5. Mode Solo langsung mulai. Mode Multiplayer menampilkan token, siswa bergabung, lalu guru menekan **Mulai lomba**.
6. Hasil sesi tersimpan di riwayat guru (skor tim dan soal yang paling sering salah).

**Target pengguna awal:** siswa SD kelas atas sampai SMP. Mode TK (soal gambar + suara) hanya dicatat sebagai pengembangan lanjutan.

## Role dan Hak Akses

| Fitur                                              | Admin | Guru | Siswa |
| -------------------------------------------------- | :---: | :--: | :---: |
| Lihat halaman publik (landing, fitur, dokumentasi) | Ya    | Ya   | Ya    |
| Daftar dan login                                   | Ya    | Ya   | Tidak (tanpa akun) |
| Buat, ubah, hapus template dan soal sendiri        | Tidak | Ya   | Tidak |
| Papan tulis dan kolaborasi                         | Tidak | Ya   | Hanya lewat tautan undangan |
| Mulai sesi game, lihat riwayat hasil sendiri       | Tidak | Ya   | Tidak |
| Masuk sesi dengan token dan nama panggilan         | Tidak | Tidak | Ya   |
| Statistik platform (angka agregat)                 | Ya    | Tidak | Tidak |
| Kelola akun guru (nonaktifkan, reset, hapus)       | Ya    | Tidak | Tidak |
| Pustaka template resmi                             | Ya (buat) | Ya (salin) | Tidak |
| Lihat isi papan tulis, soal privat, hasil sesi guru | **Tidak** | Ya (miliknya) | Tidak |

- Pengecekan role dilakukan **di server** (middleware), bukan hanya menyembunyikan menu.
- Guru hanya bisa membuka data miliknya sendiri. Selalu cek `owner_id` sebelum menampilkan atau menyimpan.
- Akun dengan `status = nonaktif` ditolak saat login dengan pesan jelas.
- Setelah login, arahkan sesuai role: guru ke `/guru`, admin ke `/admin`.

## Tech Stack

Gunakan **versi stabil terbaru** dari setiap paket, dan cek dokumentasinya. Semua aset harus **dipaket lokal** (tanpa CDN) supaya aplikasi jalan tanpa internet. Hanya fitur AI yang butuh internet.

| Bagian          | Pilihan                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| Runtime         | Node.js LTS                                                             |
| Frontend        | **Vite + React + TypeScript**, `react-router`                           |
| Styling         | **Tailwind CSS** (build lewat Vite, bukan CDN), ikon `lucide-react`     |
| Font            | `@fontsource` (Baloo 2 untuk judul, Inter untuk isi), dipaket lokal     |
| Kanvas          | **Canvas 2D buatan sendiri (mesin dari referensi-desain/discere-v5.html)** |
| Backend         | **Node.js + Express + TypeScript**                                      |
| Real-time       | **Socket.IO** (server dan client)                                       |
| Database        | **PostgreSQL (Supabase)** lewat **Prisma ORM**                          |
| Validasi        | **Zod**                                                                 |
| Autentikasi     | Email + password, hash dengan `bcryptjs`, sesi JWT di cookie `httpOnly` (`SameSite=Lax`) |
| Pembatas request| `express-rate-limit` (khusus login, daftar, dan endpoint AI)            |
| QR token        | `qrcode` (membuat QR untuk token sesi)                                  |
| AI              | Panggilan API dari **server**; nama model dan kunci dari `.env`         |
| Skrip dev       | `concurrently`, `tsx`                                                   |

**Catatan database:** Database menggunakan **PostgreSQL (Supabase)** lewat Prisma ORM. Semua data tersimpan aman di cloud sehingga deployment backend bersifat stateless dan bebas risiko data hilang saat server restart.

**Catatan jaringan:** server berjalan di `0.0.0.0` dan mencetak alamat IP laptop (contoh `http://192.168.1.5:3000`) saat start. HP siswa membuka alamat itu lewat WiFi yang sama. Kamera dan GPS tidak dipakai, jadi HTTPS tidak diperlukan.

## Struktur Project

```
discere/
├── CLAUDE.md
├── README.md                       cara menjalankan, fitur, arsitektur, penggunaan AI
├── .env.example                    contoh isi .env (tanpa nilai rahasia)
├── .gitignore
├── package.json                    workspaces: client dan server, skrip dev/build/start
├── referensi-desain/               discere-v5.html, PRD.md, prototipe lama (tidak ikut dikembangkan)
├── client/
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                 daftar route
│       ├── lib/                    api.ts (fetch ke server), socket.ts, tipe bersama
│       ├── components/             tombol, kartu, modal, toast (kecil dan dipakai ulang)
│       ├── pages/
│       │   ├── publik/             Landing, Fitur, Kelebihan, Dokumentasi, Daftar, Login
│       │   ├── guru/               Dashboard, Template, TemplateForm, Riwayat, Pengaturan
│       │   ├── papan/              PapanTulis, engine/, components/, papan.css, sidebar game
│       │   ├── game/               LayarHost (layar guru), Lobi, TarikTambang
│       │   ├── siswa/              Masuk (token + nama), Main (layar HP siswa)
│       │   └── admin/              Statistik, KelolaGuru, PustakaTemplate, PemakaianAI
│       └── styles/
└── server/
    ├── prisma/
    │   ├── schema.prisma
    │   ├── migrations/
    │   └── seed.ts
    └── src/
        ├── index.ts                Express + Socket.IO, serve client/dist saat production
        ├── config.ts               baca .env
        ├── middleware/             auth.ts, role.ts, error.ts
        ├── routes/                 auth.ts, template.ts, papan.ts, sesi.ts, ai.ts, admin.ts
        ├── games/                  tarikTambang.ts (aturan permainan)
        ├── realtime/               sesi.ts (event game), papan.ts (event kolaborasi)
        ├── ai/                     ai.ts (panggil AI, validasi Zod, cache)
        └── db.ts                   instance Prisma
```

Satu file per modul, tanpa lapisan tambahan. `games/tarikTambang.ts` berisi fungsi murni untuk aturan (hitung posisi tali, tentukan pemenang) supaya mudah diuji dan nanti game lain bisa ditambah dengan pola yang sama.

## Desain dan Tampilan

Gaya **modern, bersih, dan ramah anak**, bernuansa 17 Agustusan tanpa terlihat norak. Mobile-first untuk halaman siswa. Halaman guru dan papan tulis dioptimalkan untuk laptop, layar besar, dan layar sentuh.

| Elemen                | Aturan                                                                          |
| --------------------- | ------------------------------------------------------------------------------- |
| Warna utama           | Merah `#D7262E` (tombol utama, aksen, tim Merah)                                |
| Warna aksen           | Kuning `#F5B700` (tombol AI, sorotan), biru tua `#1E2A5A` (teks judul, tim Putih) |
| Netral                | Latar `slate-50`, kartu putih, teks `slate-800`, garis `slate-200`              |
| Bentuk                | Sudut membulat besar (`rounded-2xl`), bayangan halus, ruang kosong yang lega    |
| Tombol                | Utama merah penuh, sekunder outline, tinggi nyaman disentuh (minimal 44px)      |
| Mode gelap            | Didukung lewat `prefers-color-scheme` untuk halaman publik dan dashboard; kanvas papan tulis tetap terang |
| Gaya papan tulis      | panel melayang gelap di atas kanvas terang bertitik, ikuti discere-v5.html     |
| Animasi               | Halus, hormati `prefers-reduced-motion`                                         |
| Aksesibilitas         | Kontras jelas, fokus keyboard terlihat, `aria-label` pada tombol ikon           |

- Dilarang meniru tampilan prototipe lama.
- Tidak memakai emoji sebagai ikon antarmuka (gunakan `lucide-react`). Emoji boleh di konten ramah anak seperti hasil game.
- Semua halaman harus rapi di HP, terutama layar siswa.

## Halaman Publik

Memakai layout dengan navbar dan footer. Navbar: **Fitur, Kelebihan, Dokumentasi**, tombol **Masuk** dan **Daftar Gratis**.

**Landing (`/`)**, urutan bagian dari atas:
1. **Hero:** judul, satu kalimat penjelasan, tombol Masuk dan Daftar Gratis, ilustrasi animasi tarik tambang interaktif.
2. **Masalah:** kelas membosankan dan tidak semua siswa punya HP.
3. **Cara kerja:** 3 langkah (Buat template, Jelaskan di papan tulis, Main game lomba).
4. **Fitur:** papan tulis tak terbatas, AI pembuat soal, game 17-an, dua mode main, kolaborasi.
5. **Kelebihan:** siswa tanpa akun, jalan di kelas tanpa HP, hemat sumber daya, privasi data.
6. **Dokumentasi ringkas:** panduan singkat guru dan tanya jawab (FAQ) interaktif.
   - **Exclusive Accordion FAQ:** Memuat 6 pertanyaan resmi seputar AI, mode solo vs multiplayer, lomba 17-an, privasi sesi, kompatibilitas mapel, dan status biaya (Logicodix 2026). Membuka satu pertanyaan otomatis menutup pertanyaan sebelumnya.
7. **Footer 5 Kolom:**
   - Kolom 1 (Discere): Brand, moto, dan deskripsi singkat platform.
   - Kolom 2 (Jelajahi): Tautan cepat ke bagian Beranda, Fitur, Template, dan Demo Papan Tulis.
   - Kolom 3 (Untuk guru): Tautan Masuk, Daftar Akun, Pustaka Template, dan Panduan Mengajar.
   - Kolom 4 (Proyek): Repositori GitHub, tautan internal ke `/dokumentasi`, pelaporan masalah (GitHub Issues), dan Kontak WhatsApp tim (`+62 858-8545-5853`).
   - Kolom 5 (Tentang kami): Keterangan kompetisi LOGICODIX 2026, subtema Smart & Fun Education, dan hak cipta.

**Daftar (`/daftar`) & Login (`/masuk`):** 
- Desain visual bertema ruang kelas sekolah Indonesia: papan tulis hijau tua dengan serat kapur diagonal, tali gantung papan dengan 3 titik cincin melengkung, serta animasi teks sambutan dinamis.
- Daftar: nama, email, kata sandi (minimal 8 karakter), nama sekolah.
- Login: email dan kata sandi.
- Halaman **Dokumentasi (`/dokumentasi`)** berdiri sebagai rute mandiri yang memuat panduan komprehensif bagi guru.

## Dashboard Guru (`/guru`)

Layout: sidebar kiri responsif yang dapat diciutkan (Ringkasan, Template, Papan Tulis, Riwayat, Pengaturan) dan area konten di kanan.
- **Navigasi Bersih:** Saat kembali ke menu utama Ringkasan, URL otomatis dibersihkan ke `/guru` tanpa query parameter `?tab=ringkasan`.
- **Sidebar Ringkas:** Saat sidebar diciutkan, logo/ikon Discere otomatis mengecil dan berada tepat di tengah (`margin: 0 auto`).

**Ringkasan** (halaman awal):
- Kartu angka: jumlah template, sesi yang pernah dijalankan, dan papan tersimpan.
- Dua tombol besar: **Template Baru** dan **Buka Papan Tulis**.
- Daftar **Template terbaru** (3 sampai 5) dengan tombol Mulai.
- **Sesi terakhir:** tim pemenang dan tanggal.

**Template:** kartu-kartu template (judul, game, mode, jumlah soal) dengan aksi **Mulai, Ubah, Duplikat, Hapus**, plus pencarian. Tab kedua **Pustaka Resmi** berisi template contoh dari admin yang bisa **disalin** ke milik guru.

**Template Baru / Ubah (`/guru/template/baru`):** 
- **Tampilan Penuh Tanpa Sidebar:** Saat menyusun materi/soal, form ditampilkan layar penuh tanpa sidebar kiri agar guru dapat fokus sepenuhnya pada penyusunan soal.
- **Header Form:** Tombol navigasi "Kembali ke Daftar Template" diposisikan di pojok kanan atas header sejajar judul form.
- Form berisi Judul materi, Game (tarik tambang), Mode (Solo atau Multiplayer), dan daftar soal tanpa batasan jenjang yang kaku. Soal dapat diisi **manual** atau dibuat otomatis lewat **Buat soal dengan AI** (ditandai label "Dibuat AI").

**Riwayat:** daftar sesi (tanggal, template, tim pemenang, skor akhir). Detail sesi menampilkan **soal yang paling sering salah** (statistik per soal). Tidak ada nama siswa.

**Papan Tulis:** daftar papan tersimpan (judul, terakhir diubah), tombol buka, ganti nama, hapus.

**Pengaturan & Profil:** profil (nama, sekolah), ganti kata sandi dengan kolom kata sandi baru dan konfirmasi kata sandi yang sejajar seimbang, tema tampilan, dan hapus akun (menghapus semua data milik guru).

**Cara masuk ke papan tulis:** dua jalur.
- Dari Ringkasan atau menu: tombol **Buka Papan Tulis** (papan baru) atau memilih papan tersimpan.
- Saat mengajar, di dalam papan tulis, tombol **Template Game** di sidebar kanan membuka daftar template guru. Klik satu template untuk memulai kuis tanpa keluar dari papan.

## Papan Tulis (`/papan/:id`)

Layar penuh, kanvas **tak terbatas** (pan dan zoom), dibangun dengan **Canvas 2D buatan sendiri** (mesin dari `referensi-desain/discere-v5.html`). Semua ID objek memakai UUID (`crypto.randomUUID()`).

**Tools di sisi kiri (ikon + label kecil):** Tanya AI (kuning, paling atas), Pilih, Tangan, Laser, Pena (3 gaya: pulpen, spidol, pensil), Hapus (pemotong coretan), Bentuk (dasar, poligon, bintang, panah), Teks, Tabel, Isi warna, Pipet, Upload gambar.

**Bar atas kontekstual:** muncul sesuai tool/objek aktif. Untuk pena: warna, ukuran kuas, opasitas, gaya pena. Untuk penghapus: ukuran penghapus. Untuk bentuk: warna, tebal garis, opasitas. Untuk teks: warna, ukuran font. Untuk tabel: warna garis. Untuk isi: palet warna. Untuk laser: pilihan warna laser. Untuk pilih: hint, tombol Duplikat dan Hapus.

**Pojok kanan atas:** tombol Undo, Redo, Game, Avatar peserta, Presentasi, dan tombol Bagikan (Share). **Pojok kanan bawah:** kontrol zoom (perkecil, persentase / reset 100%, perbesar, toggle grid, pusatkan).

**Fitur papan tulis:**
- View pan & zoom (0.1x hingga 4x, scroll, wheel, tool Tangan, spasi untuk geser).
- Grid titik yang menyesuaikan level zoom.
- Pena/spidol/pensil dengan kurva kuadratik halus.
- Penghapus cerdas yang **memotong coretan** (`cutStroke` dan `eraseSeg`), bukan sekadar menghapus per objek utuh.
- Bentuk lengkap (UP, SHP: poligon, bintang, panah, kurva, kotak, elips).
- Teks dengan font "Plus Jakarta Sans" (dimuat lokal via `@fontsource/plus-jakarta-sans`). Batas teks maksimal 5000 karakter.
- Tabel dengan ukuran dinamis dan edit sel lewat klik dua kali.
- Isi warna (fill) untuk bentuk, kotak teks, dan tabel.
- Pipet warna (EyeDropper API dengan fallback pemilih HSV).
- Unggah, seret-lepas (drag-and-drop), dan tempel (paste) gambar dengan pengecilan otomatis (maksimal 1280px JPEG 0.8 sebelum disimpan).
- Jejak laser pointer interaktif yang memudar halus (900 ms).
- Mode presentasi layar penuh.
- Pintasan keyboard lengkap (V H L P E S T B F I A U, Ctrl+Z, Ctrl+Y, Ctrl+D, Ctrl+/-, Spasi untuk pan, Delete, Esc).
- Undo / redo berbasis **operasi lokal** `{tambah: Obj[], hapus: Obj[], ubah: {sebelum: Obj, sesudah: Obj}[]}`, batas 60 entri, dengan pemancaran event `ubah` `{tambah, ubah, hapus: string[]}` dan fungsi `terapkanOps(ops)` untuk sinkronisasi external.
- Properti `hanyaLihat` pada Board untuk mode Viewer (hanya Tangan, Laser, dan Zoom yang diizinkan).
- Format penyimpanan data kanvas: `{ versi: 1, objs: Obj[] }` (tidak menyimpan properti internal cache). Autosave ke database dengan debounce 2 detik, plus cadangan ke localStorage jika simpan server gagal.

**Fitur AI di papan (Tanya AI):**
1. Guru menekan tombol **Tanya AI**, lalu **melingkari** soal atau area di kanvas.
2. Muncul kotak kecil di dekat area: input **"Butuh apa?"** (boleh kosong).
3. Area itu diekspor jadi gambar (`toDataURL` dengan `left/top/width/height`), dikirim ke `POST /api/ai/jawab` bersama pertanyaan guru.
4. Server memanggil AI dan mengembalikan **Jawaban, Rumus, Langkah** dalam teks biasa (tanpa markdown, tanpa LaTeX).
5. Hasil muncul sebagai **kartu di samping soal** pada kanvas, berlabel **"Dibuat AI"**, dan bisa dipindah atau dihapus seperti objek lain.

**Kolaborasi lewat tautan:**
- Tombol **Bagikan** membuat tautan `/b/:tokenBagi` dengan peran **Viewer** (hanya melihat) atau **Editor** (boleh menggambar). Guru bisa mengganti peran atau **mencabut** tautan kapan saja.
- Siapa pun yang punya tautan bisa membuka tanpa akun (cukup memasukkan nama panggilan).
- Sinkronisasi lewat Socket.IO, room per papan. Perubahan dikirim per objek (id, data), aturan **yang terakhir menulis menang**. **Server mengecek peran di setiap perubahan** (Viewer yang mengirim perubahan ditolak).
- Tampilkan alamat dengan IP jaringan lokal di dialog Bagikan (bukan `localhost`) supaya bisa dibuka dari perangkat lain di WiFi yang sama.
- Fitur kursor tiap orang bersifat P1.

## Game dan Mode Main

Pertama dan wajib: **Tarik Tambang**. Game lain (balap karung, panjat pinang) hanya ditambah kalau waktu tersisa.

**Aturan tarik tambang:**
- Dua tim: **Merah** (kiri) dan **Putih** (kanan). Tali punya penanda bendera di tengah.
- Posisi tali dari **-8 sampai +8** (0 = tengah). Tim Merah menarik ke arah negatif, Putih ke positif.
- **Jawaban benar menarik tali 1 langkah** ke arah timnya. Jawaban salah tidak mengubah apa pun.
- **Menang** kalau tali mencapai -8 atau +8, atau kalau soal habis dan tali lebih dekat ke salah satu tim. Kalau tepat 0 saat soal habis: seri (opsional 1 soal tambahan).
- Soal ditampilkan berurutan sesuai template.

**Mode Solo (`/guru/sesi/:id`, layar guru):**
- Tidak ada token. Soal tampil besar dengan 3 tombol pilihan besar.
- Tim bergantian (indikator "Giliran: Tim Merah/Putih"). Perwakilan tim menyentuh jawaban.
- Setelah dipilih, jawaban benar ditandai hijau sebentar, lalu lanjut ke soal berikutnya dan giliran berpindah.

**Mode Multiplayer:**
- Server membuat sesi dengan **token 6 angka** yang unik selama sesi aktif. Layar guru menampilkan token besar, **QR**, dan alamat server.
- Siswa membuka alamat server (`/main`), memasukkan **token** dan **nama panggilan**, lalu masuk lobi. Maksimal **40 siswa** per sesi. Bergabung hanya saat status lobi. Siswa yang terputus bisa masuk lagi dengan token dan nama yang sama.
- Saat guru menekan **Mulai lomba**, server **membagi tim secara acak dan seimbang**.
- Setiap soal: waktu **15 detik**. Soal berikutnya muncul setelah semua menjawab atau waktu habis. Setiap siswa hanya dihitung **satu kali per soal**.
- Setelah menjawab, HP siswa menampilkan benar atau salah; kalau salah, tampil **penjelasan** yang sudah tersimpan di soal (tidak memanggil AI saat bermain).
- **Semua perhitungan skor dan posisi tali dilakukan di server**, tidak di HP.
- Status sesi yang cepat berubah (posisi tali, siapa sudah menjawab, timer) disimpan **di memori server**. Ke database hanya dicatat sesi, hasil akhir, dan statistik per soal.
- Nama panggilan siswa hanya ada di memori selama sesi dan **tidak disimpan** ke database.

**Event Socket.IO (nama konsisten):**

| Event              | Arah              | Fungsi                                   |
| ------------------ | ----------------- | ---------------------------------------- |
| `sesi:gabung`      | siswa → server    | Masuk dengan token dan nama              |
| `lobi:update`      | server → semua    | Daftar siswa dan tim                     |
| `sesi:mulai`       | guru → server     | Memulai lomba                            |
| `soal:tampil`      | server → semua    | Soal, pilihan, batas waktu               |
| `jawab:kirim`      | siswa → server    | Mengirim pilihan jawaban                 |
| `jawab:hasil`      | server → siswa    | Benar/salah + penjelasan                 |
| `tali:update`      | server → semua    | Posisi tali terbaru                      |
| `sesi:selesai`     | server → semua    | Pemenang dan skor akhir                  |
| `papan:gabung`     | klien → server    | Masuk ke ruang kolaborasi papan          |
| `papan:ubah`       | klien ↔ server    | Perubahan objek papan (kolaborasi)       |
| `papan:peserta`    | server → semua    | Daftar orang yang membuka papan          |

## Fitur AI

Semua panggilan AI lewat **server**. Kunci API dan nama model dari `.env` (`AI_API_KEY`, `AI_MODEL`), tidak pernah dikirim ke browser dan tidak ditulis di kode. Kalau kunci tidak ada atau AI gagal, tombol AI tampil nonaktif dengan pesan ramah dan **aplikasi tetap bisa dipakai** (soal manual).

1. **Buat soal dari materi** (`POST /api/ai/soal`): input teks materi, jumlah soal (5 sampai 15), tingkat (SD/SMP). AI diminta menjawab dalam **JSON terstruktur** berisi: teks soal, 3 opsi, jawaban benar, dan penjelasan singkat. Server **memvalidasi dengan Zod** (tepat 3 opsi, satu jawaban benar valid) dan menolak hasil yang tidak sesuai.
2. **Jawab soal dari papan tulis** (`POST /api/ai/jawab`): lihat bagian Papan Tulis. Input berupa gambar area terpilih dan pertanyaan opsional.
3. **Penjelasan jawaban salah** dibuat **saat soal dibuat** dan disimpan di soal, bukan saat bermain.
4. **Obrolan AI di papan tulis** (`POST /api/ai/obrol`): guru berinteraksi dengan asisten AI melalui bar prompt dan panel obrolan di papan tulis, dapat menyertakan lampiran gambar, PDF, file teks, atau tangkapan papan saat ini. Riwayat obrolan hanya hidup di memori klien (hilang saat halaman dimuat ulang, tidak disimpan ke database). Setiap balasan AI berlabel "Dibuat AI" dan dapat ditambahkan ke papan sebagai kartu catatan. Dibatasi oleh batas harian `AI_BATAS_OBROL` (default 40 per hari per guru).

**Etika dan efisiensi (dinilai juri):**
- Hasil AI selalu berlabel **"Dibuat AI"**, dan soal dari AI **wajib ditinjau guru** sebelum disimpan.
- **Cache** hasil di tabel `ai_cache` (kunci: hash input + pengaturan) supaya input yang sama tidak memanggil AI lagi.
- **Batas pemakaian** per guru per hari (`AI_BATAS_HARIAN` di `.env`, default 30) dan `express-rate-limit` di endpoint AI.
- Tampilkan peringatan di form AI: **jangan memasukkan data pribadi siswa**.
- Prompt dan batasan keluaran (bahasa Indonesia, singkat, tanpa markdown) ditulis di satu file `server/src/ai/ai.ts`.

## Dashboard Admin (`/admin`)

Admin adalah **pengelola platform**, bukan pengawas isi milik guru.
- **Navigasi Bersih & Sidebar:** Saat kembali ke menu Ringkasan, URL otomatis dibersihkan ke `/admin`. Sidebar kiri dapat diciutkan dengan logo Discere yang otomatis berada di tengah saat ciut.
- **Form Pustaka Resmi (Layar Penuh):** Saat admin membuat atau menyunting template resmi (`pustakaView === 'form'`), form ditampilkan layar penuh tanpa sidebar navigasi, dengan tombol "Kembali ke Pustaka Resmi" di pojok kanan atas header form.
- **Profil Admin:** Field kata sandi baru dan konfirmasi kata sandi baru disusun seimbang berdampingan.

Isi untuk versi lomba:
- **Statistik platform:** jumlah guru, template, sesi, papan, dan grafik pemakaian per hari. **Hanya angka agregat.**
- **Kelola guru:** daftar akun (nama, email, sekolah, status), pencarian, aksi **nonaktifkan/aktifkan, reset kata sandi, hapus akun**. Menghapus akun ikut menghapus datanya.
- **Pustaka template resmi:** admin membuat, mengubah, dan menghapus template contoh (misalnya soal kelas 5 SD) yang bisa disalin guru.
- **Pemakaian AI:** jumlah panggilan per hari dan pengaturan batas harian per guru (agregat).
- **Log tindakan admin:** siapa menonaktifkan, mereset, atau menghapus akun siapa dan kapan. Ini mengawasi **admin**, bukan guru.

**Yang TIDAK BOLEH bisa dilihat atau dibuka admin** (jangan buat halaman atau endpoint untuk ini):
- isi papan tulis guru,
- template dan soal yang masih privat,
- hasil sesi dan statistik per soal milik guru,
- apa pun tentang siswa.

Template guru **privat secara bawaan**. Pengecualian hanya jika guru sendiri memilih membagikannya ke pustaka (ditunda, lihat Catatan Penting).

## Database

Skema ditulis di `server/prisma/schema.prisma`. Nama model dan field memakai Bahasa Indonesia atau Inggris secara konsisten, dengan `id` bawaan dan `createdAt`/`updatedAt`.

| Tabel             | Kolom penting                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `users`           | id, nama, email (unik), passwordHash, role (`guru`/`admin`), sekolah, status (`aktif`/`nonaktif`)      |
| `templates`       | id, ownerId (null untuk resmi), judul, game, mode (`solo`/`multi`), resmi (boolean)                    |
| `questions`       | id, templateId, urutan, teks, opsiA, opsiB, opsiC, jawabanBenar (`A`/`B`/`C`), penjelasan, dibuatAi   |
| `sessions`        | id, templateId, hostId, token, mode, status (`lobi`/`jalan`/`selesai`), mulaiPada, selesaiPada         |
| `session_results` | id, sessionId, timMenang (`merah`/`putih`/`seri`), posisiAkhir, skorMerah, skorPutih                   |
| `question_stats`  | id, sessionId, questionId, jumlahBenar, jumlahSalah                                                    |
| `boards`          | id, ownerId, judul, data (JSON { versi: 1, objs: [...] }), updatedAt                  |
| `board_shares`    | id, boardId, token (unik), peran (`viewer`/`editor`), aktif (boolean)                                  |
| `ai_cache`        | hash (unik), jenis, hasil (JSON), createdAt                                                            |
| `ai_usage`        | id, userId, tanggal, jumlah                                                                            |
| `admin_logs`      | id, adminId, aksi, target, createdAt                                                                   |

**Seed:** 1 akun admin (kata sandi dari `.env`), 1 akun guru demo, dua template contoh (Pecahan kelas 5, Sejarah proklamasi), dan beberapa template resmi.

## API (ringkasan)

Semua di bawah `/api`, body JSON, divalidasi Zod. Rute selain publik memakai middleware `auth` dan `role`.

| Area      | Endpoint                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------- |
| Auth      | `POST /auth/daftar`, `POST /auth/masuk`, `POST /auth/keluar`, `GET /auth/saya`                 |
| Template  | `GET/POST /template`, `GET/PUT/DELETE /template/:id`, `POST /template/:id/duplikat`, `GET /template/pustaka` |
| Sesi      | `POST /sesi` (buat dari template), `GET /sesi/riwayat`, `GET /sesi/:id/statistik`              |
| Papan     | `GET/POST /papan`, `GET/PUT/DELETE /papan/:id`, `POST /papan/:id/bagikan`, `DELETE /papan/bagi/:token` |
| AI        | `POST /ai/soal`, `POST /ai/jawab`, `POST /ai/obrol`                                            |
| Admin     | `GET /admin/statistik`, `GET /admin/guru`, `PATCH /admin/guru/:id`, `DELETE /admin/guru/:id`, `/admin/pustaka`, `GET /admin/ai`, `GET /admin/log` |

## Keamanan dan Privasi

- Kata sandi disimpan dengan hash `bcryptjs`, tidak pernah ditampilkan atau dicatat di log. Kata sandi minimal 8 karakter.
- Cookie sesi `httpOnly`, `SameSite=Lax`. Rate limit pada login, daftar, dan AI.
- Pengecekan role dan kepemilikan **di server** untuk setiap data guru.
- Token sesi dan token bagi papan bersifat acak dan sulit ditebak. Peran Viewer/Editor dicek **di server** pada setiap perubahan papan.
- **Data seminimal mungkin:** siswa tanpa akun, nama panggilan tidak disimpan, tidak mengumpulkan data pribadi yang tidak dipakai.
- Pesan error teknis (exception, stack trace) tidak boleh ditampilkan mentah ke pengguna.
- File `.env` tidak ikut di-commit. Siapkan halaman **Kebijakan Privasi** singkat (apa yang dicatat, siapa yang bisa melihat, cara menghapus akun).
- Data anak butuh kehati-hatian ekstra. Kalau suatu saat dipakai sungguhan di sekolah, tinjau kebijakan privasi dengan pihak yang paham hukum (UU PDP No. 27 Tahun 2022).

## Menjalankan dan Kebutuhan Final

Skrip di `package.json` (root):

| Perintah             | Fungsi                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| `npm install`        | Pasang semua dependency (client dan server)                            |
| `npm run db:migrate` | Jalankan migrasi Prisma                                                |
| `npm run db:seed`    | Isi data awal                                                          |
| `npm run dev`        | Jalankan client dan server bersamaan (mode pengembangan)               |
| `npm run build`      | Build client dan server                                                |
| `npm run typecheck`  | Cek TypeScript di client dan server                                    |
| `npm start`          | Jalankan **satu proses** yang melayani API + hasil build client        |

- Saat Grand Final, aplikasi harus jalan di laptop dengan `npm install` lalu `npm start`, tanpa hosting. Pastikan **Node.js LTS terpasang** di laptop itu.
- Siapkan file `.env` di laptop final (salinan dari `.env.example`). AI butuh internet, bagian lain tidak.
- Cadangan kalau WiFi bermasalah: **Mode Solo** (tidak butuh HP atau jaringan).

## Dokumentasi (dinilai juri)

`README.md` wajib berisi: deskripsi singkat, daftar fitur, tech stack, **cara instalasi dan menjalankan**, akun demo, struktur folder, **diagram arsitektur sederhana** (Mermaid), bagian **Penggunaan AI** (sebagai alat pengembangan dan sebagai fitur aplikasi, secara terbuka), dan tangkapan layar. Perbarui README setiap kali ada fitur besar selesai.

## Urutan Pengerjaan Modul

Kerjakan bertahap. Setelah tiap fitur selesai: jalankan, uji, **commit**. Setelah tiap tahap: beri **tag** dan push. Jangan lanjut ke tahap berikutnya kalau tahap ini belum jalan.

| Hari (2026)    | Tahap                                   | Hasil yang diuji                                                           | Status |
| -------------- | --------------------------------------- | -------------------------------------------------------------------------- | :----: |
| Minggu, 8 Nov  | **1. Fondasi**                          | Repo, struktur, Prisma + migrasi + seed, daftar/login/keluar, middleware role | Selesai |
|                | **2. Halaman publik**                   | Landing (hero, fitur, demo, FAQ accordion, footer 5 kolom), Dokumentasi, Daftar, Login | Selesai |
| Senin, 9 Nov   | **3. Dashboard guru dan template**      | Ringkasan, CRUD template dan soal manual, duplikat, pustaka resmi, full-width form | Selesai |
| Selasa, 10 Nov | **4. Game Solo**                        | Tarik tambang Mode Solo penuh dari awal sampai layar hasil, riwayat tersimpan | Selesai |
| Rabu, 11 Nov   | **5. Multiplayer**                      | Token, QR, lobi, HP nyata bermain, tali real-time di server, penjelasan jawaban | Selesai |
| Kamis, 12 Nov  | **6. Papan tulis dan kolaborasi**       | Kanvas Canvas 2D tak terbatas, semua tools, simpan otomatis, sidebar game, tautan Viewer/Editor | Selesai |
| Jumat, 13 Nov  | **7. AI dan Admin**                     | Soal dari AI, Tanya AI (lingkari soal), Obrolan AI papan, cache dan batas harian, dashboard admin | Selesai |
| Sabtu, 14 Nov  | **8. Poles dan submit**                 | Perbaiki UX & navigasi, penataan responsif, README + diagram, video demo, submit | **Sedang Berjalan** |

**Prioritas kalau waktu mepet** (potong dari bawah):
- **P0 (wajib):** tahap 1 sampai 5, ditambah soal AI dan Tanya AI dasar.
- **P1:** kolaborasi Viewer/Editor, dashboard admin, kalkulator papan, kursor kolaborator.
- **P2:** game kedua, mode TK, ekspor papan ke PNG/PDF.

**Video demo (3 sampai 5 menit, tanpa suara narasi):** guru membuat template dengan AI, mengajar di papan tulis, melingkari soal untuk dijawab AI, memulai game Solo, lalu Multiplayer dengan beberapa HP, hasil, dan riwayat. Tambahkan teks singkat di layar karena tidak ada narasi.

## Catatan Penting

- Struktur database hanya lewat migration. Kalau perlu kolom baru, buat migration baru, jangan edit migration lama yang sudah dijalankan.
- Semua teks, pesan, dan label dalam Bahasa Indonesia.
- Konten penjelasan di landing dan dokumentasi ditulis di komponen halaman, tapi teks soal dan template selalu dari database.
- Hapus data yang masih dipakai (misalnya template yang punya sesi) harus memberi pesan jelas atau menghapus berantai dengan konfirmasi, jangan biarkan error database muncul mentah.
- Hapus selalu dengan konfirmasi di antarmuka.
- **Belum dikerjakan (ditunda, jangan ditambahkan kecuali diminta):** mode TK (soal gambar + suara), game selain tarik tambang (kecuali P2), template dibagikan ke pustaka umum dan moderasinya, login siswa, akun sekolah/organisasi, ekspor papan ke PPT, kursor real-time yang rumit, pindah ke PostgreSQL, hosting online, dan aplikasi mobile.