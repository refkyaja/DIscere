-- ==============================================================================
-- DISCERE PLATFORM - SUPABASE POSTGRESQL DDL & SEED SCRIPT
-- ==============================================================================
-- Cara Menggunakan di Supabase:
-- 1. Buka Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Pilih Project Anda -> Klik menu "SQL Editor" di bilah sisi kiri
-- 3. Buat "New query", salin dan tempel (paste) seluruh isi file ini, lalu klik "Run".
-- 4. Semua tabel (12 tabel), relasi ON DELETE CASCADE, indeks, dan data awal siap digunakan!
-- ==============================================================================

-- Aktifkan ekstensi pgcrypto untuk fungsi gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TABEL: users
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'guru',
  sekolah TEXT,
  status TEXT NOT NULL DEFAULT 'aktif',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 2. TABEL: templates
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "ownerId" TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  judul TEXT NOT NULL,
  game TEXT NOT NULL DEFAULT 'tarik_tambang',
  mode TEXT NOT NULL DEFAULT 'solo',
  resmi BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_owner ON public.templates("ownerId");
CREATE INDEX IF NOT EXISTS idx_templates_resmi ON public.templates(resmi);

-- ==============================================================================
-- 3. TABEL: questions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "templateId" TEXT NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  urutan INTEGER NOT NULL DEFAULT 0,
  teks TEXT NOT NULL,
  "opsiA" TEXT NOT NULL,
  "opsiB" TEXT NOT NULL,
  "opsiC" TEXT,
  "opsiD" TEXT,
  "opsiE" TEXT,
  "jawabanBenar" TEXT NOT NULL,
  penjelasan TEXT,
  kesulitan TEXT NOT NULL DEFAULT 'sedang',
  "dibuatAi" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS kesulitan TEXT NOT NULL DEFAULT 'sedang';

CREATE INDEX IF NOT EXISTS idx_questions_template ON public.questions("templateId");

-- ==============================================================================
-- 4. TABEL: sessions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "templateId" TEXT NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  "hostId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT,
  mode TEXT NOT NULL DEFAULT 'solo',
  status TEXT NOT NULL DEFAULT 'lobi',
  konfigurasi TEXT,
  "mulaiPada" TIMESTAMPTZ,
  "selesaiPada" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_host ON public.sessions("hostId");
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);

-- ==============================================================================
-- 5. TABEL: session_players
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.session_players (
  id TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  tim TEXT,
  posisi INTEGER NOT NULL DEFAULT 0,
  keseimbangan INTEGER NOT NULL DEFAULT 100,
  "jumlahJatuh" INTEGER NOT NULL DEFAULT 0,
  "efekAktif" TEXT NOT NULL DEFAULT '{}',
  "poinBonus" INTEGER NOT NULL DEFAULT 0,
  "totalBenar" INTEGER NOT NULL DEFAULT 0,
  "totalSalah" INTEGER NOT NULL DEFAULT 0,
  "streakSaatIni" INTEGER NOT NULL DEFAULT 0,
  "streakTertinggi" INTEGER NOT NULL DEFAULT 0,
  "totalWaktuJawabMs" INTEGER NOT NULL DEFAULT 0,
  "jumlahJawab" INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'bermain',
  "waktuSelesaiMs" INTEGER,
  "selesaiPada" TIMESTAMPTZ,
  "riwayatPosisi" TEXT NOT NULL DEFAULT '[]',
  "riwayatRintangan" TEXT NOT NULL DEFAULT '[]',
  "riwayatJawaban" TEXT NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.session_players ADD COLUMN IF NOT EXISTS tim TEXT;

CREATE INDEX IF NOT EXISTS idx_session_players_session ON public.session_players("sessionId");

-- ==============================================================================
-- 6. TABEL: session_results
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.session_results (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sessionId" TEXT NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  "timMenang" TEXT NOT NULL,
  "posisiAkhir" INTEGER NOT NULL DEFAULT 0,
  "skorMerah" INTEGER NOT NULL DEFAULT 0,
  "skorPutih" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 7. TABEL: question_stats
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.question_stats (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sessionId" TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  "questionId" TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  "jumlahBenar" INTEGER NOT NULL DEFAULT 0,
  "jumlahSalah" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_stats_session ON public.question_stats("sessionId");
CREATE INDEX IF NOT EXISTS idx_question_stats_question ON public.question_stats("questionId");

-- ==============================================================================
-- 8. TABEL: boards
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.boards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "ownerId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  judul TEXT NOT NULL DEFAULT 'Papan Tanpa Judul',
  data TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boards_owner ON public.boards("ownerId");

-- ==============================================================================
-- 9. TABEL: board_shares
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.board_shares (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "boardId" TEXT NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  peran TEXT NOT NULL DEFAULT 'viewer',
  aktif BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_shares_board ON public.board_shares("boardId");

-- ==============================================================================
-- 10. TABEL: ai_cache
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ai_cache (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  hash TEXT NOT NULL UNIQUE,
  jenis TEXT NOT NULL,
  hasil TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON public.ai_cache(hash);

-- ==============================================================================
-- 11. TABEL: ai_usage
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tanggal TEXT NOT NULL,
  jumlah INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ai_usage_user_tanggal UNIQUE ("userId", tanggal)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON public.ai_usage("userId");
CREATE INDEX IF NOT EXISTS idx_ai_usage_tanggal ON public.ai_usage(tanggal);

-- ==============================================================================
-- 12. TABEL: admin_logs
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "adminId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  aksi TEXT NOT NULL,
  target TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON public.admin_logs("adminId");

-- ==============================================================================
-- SEED DATA AWAL (Pengguna & Template Resmi)
-- ==============================================================================

-- 1. Insert Akun Administrator (Password default: AdminDiscere2026!)
INSERT INTO public.users (id, nama, email, "passwordHash", role, sekolah, status)
VALUES (
  'usr_admin_default',
  'Administrator Discere',
  'admin@discere.local',
  '$2b$10$Tf6epNHJd.F26/fUTvHBJeGsE8/SK0YYLcb8yl6YprwWt1nNeLYcS',
  'admin',
  'Pusat Discere',
  'aktif'
)
ON CONFLICT (email) DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  nama = EXCLUDED.nama,
  status = 'aktif';

-- 2. Insert Akun Guru Demo (Password default: GuruDiscere2026!)
INSERT INTO public.users (id, nama, email, "passwordHash", role, sekolah, status)
VALUES (
  'usr_guru_demo',
  'Guru Demo',
  'guru@discere.local',
  '$2b$10$qKxnw0Gessog5G48T7zc6.ucuQsiEa9fskk.cGK02yReCjC7wdYLC',
  'guru',
  'SD Negeri Merdeka 01',
  'aktif'
)
ON CONFLICT (email) DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  nama = EXCLUDED.nama,
  status = 'aktif';

-- 3. Insert Template Resmi: Matematika Dasar (Tarik Tambang)
INSERT INTO public.templates (id, "ownerId", judul, game, mode, resmi)
VALUES ('tpl_resmi_mtk', NULL, 'Matematika Dasar: Operasi Hitung Campuran', 'tarik_tambang', 'solo', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.questions (id, "templateId", urutan, teks, "opsiA", "opsiB", "opsiC", "jawabanBenar", penjelasan)
VALUES
('q_mtk_1', 'tpl_resmi_mtk', 1, 'Berapakah hasil dari 15 + 25 × 2?', '65', '80', '50', 'A', 'Operasi perkalian didahulukan: 25 × 2 = 50, lalu 15 + 50 = 65.'),
('q_mtk_2', 'tpl_resmi_mtk', 2, 'Hasil dari (50 - 20) : 5 adalah...', '6', '8', '10', 'A', 'Operasi di dalam kurung didahulukan: 50 - 20 = 30, lalu 30 : 5 = 6.'),
('q_mtk_3', 'tpl_resmi_mtk', 3, 'Berapakah hasil perhitungan dari 12 × 4 - 18 : 2?', '39', '42', '30', 'A', '12 × 4 = 48 dan 18 : 2 = 9. Jadi 48 - 9 = 39.'),
('q_mtk_4', 'tpl_resmi_mtk', 4, 'Hasil dari 100 - 25 × 3 + 15 adalah...', '40', '240', '50', 'A', '25 × 3 = 75. Maka 100 - 75 + 15 = 25 + 15 = 40.'),
('q_mtk_5', 'tpl_resmi_mtk', 5, 'Berapakah nilai dari (16 + 24) × (10 - 7)?', '120', '100', '140', 'A', '(16 + 24) = 40 dan (10 - 7) = 3. Maka 40 × 3 = 120.')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Template Resmi: IPA Sistem Tata Surya (Tarik Tambang)
INSERT INTO public.templates (id, "ownerId", judul, game, mode, resmi)
VALUES ('tpl_resmi_ipa', NULL, 'Ilmu Pengetahuan Alam: Sistem Tata Surya', 'tarik_tambang', 'multi', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.questions (id, "templateId", urutan, teks, "opsiA", "opsiB", "opsiC", "jawabanBenar", penjelasan)
VALUES
('q_ipa_1', 'tpl_resmi_ipa', 1, 'Planet terdekat dari matahari dalam tata surya adalah...', 'Merkurius', 'Venus', 'Mars', 'A', 'Merkurius adalah planet dengan orbit paling dekat dengan matahari.'),
('q_ipa_2', 'tpl_resmi_ipa', 2, 'Planet yang dikenal sebagai "Planet Merah" adalah...', 'Jupiter', 'Mars', 'Saturnus', 'B', 'Mars tampak kemerahan karena tanahnya kaya akan besi oksida.'),
('q_ipa_3', 'tpl_resmi_ipa', 3, 'Planet terbesar dalam tata surya kita adalah...', 'Saturnus', 'Jupiter', 'Neptunus', 'B', 'Jupiter adalah planet raksasa gas dengan massa dan ukuran terbesar.'),
('q_ipa_4', 'tpl_resmi_ipa', 4, 'Pusat tata surya yang dikelilingi oleh planet-planet adalah...', 'Bumi', 'Matahari', 'Bulan', 'B', 'Matahari adalah pusat tata surya.'),
('q_ipa_5', 'tpl_resmi_ipa', 5, 'Benda langit yang mengelilingi planet disebut...', 'Satelit', 'Komet', 'Asteroid', 'A', 'Satelit alami (seperti Bulan bagi Bumi) bergerak mengelilingi planet.')
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Template Resmi: Bahasa Indonesia (Tarik Tambang)
INSERT INTO public.templates (id, "ownerId", judul, game, mode, resmi)
VALUES ('tpl_resmi_bindo', NULL, 'Bahasa Indonesia: Antonim dan Sinonim', 'tarik_tambang', 'solo', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.questions (id, "templateId", urutan, teks, "opsiA", "opsiB", "opsiC", "jawabanBenar", penjelasan)
VALUES
('q_bin_1', 'tpl_resmi_bindo', 1, 'Antonim (lawan kata) dari kata "LUAS" adalah...', 'Sempit', 'Besar', 'Panjang', 'A', 'Lawan kata dari sesuatu yang luas adalah sempit.'),
('q_bin_2', 'tpl_resmi_bindo', 2, 'Sinonim (persamaan kata) dari kata "GEMBIRA" adalah...', 'Sedih', 'Senang', 'Marah', 'B', 'Gembira memiliki makna yang sama dengan senang atau bahagia.'),
('q_bin_3', 'tpl_resmi_bindo', 3, 'Antonim dari kata "KOLOT" adalah...', 'Modern', 'Kuno', 'Lama', 'A', 'Kolot berarti berpikiran kuno, sehingga lawan katanya adalah modern.'),
('q_bin_4', 'tpl_resmi_bindo', 4, 'Sinonim dari kata "PANDAI" adalah...', 'Pintar', 'Rajin', 'Tekun', 'A', 'Kata pandai memiliki arti yang sepadan dengan pintar atau cerdas.'),
('q_bin_5', 'tpl_resmi_bindo', 5, 'Antonim dari kata "BERANI" adalah...', 'Gagah', 'Takut', 'Kuat', 'B', 'Lawan dari sikap berani adalah takut atau penakut.')
ON CONFLICT (id) DO NOTHING;

-- 6. Insert Template Resmi: Panjat Pinang
INSERT INTO public.templates (id, "ownerId", judul, game, mode, resmi)
VALUES ('tpl_resmi_panjat', NULL, 'Panjat Pinang 17-an: Pengetahuan Umum Nusantara', 'panjat_pinang', 'multi', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.questions (id, "templateId", urutan, teks, "opsiA", "opsiB", "opsiC", "jawabanBenar", penjelasan)
VALUES
('q_panjat_1', 'tpl_resmi_panjat', 1, 'Semboyan resmi bangsa Indonesia yang terdapat pada lambang Garuda Pancasila adalah...', 'Bhinneka Tunggal Ika', 'Tut Wuri Handayani', 'Ing Ngarsa Sung Tuladha', 'A', 'Bhinneka Tunggal Ika berarti berbeda-beda tetapi tetap satu jua.'),
('q_panjat_2', 'tpl_resmi_panjat', 2, 'Lagu kebangsaan Indonesia Raya pertama kali diciptakan oleh...', 'Ismail Marzuki', 'W.R. Supratman', 'Ibu Sud', 'B', 'W.R. Supratman menciptakan lagu kebangsaan Indonesia Raya.'),
('q_panjat_3', 'tpl_resmi_panjat', 3, 'Pulau terluas yang dimiliki oleh negara Indonesia adalah...', 'Pulau Jawa', 'Pulau Kalimantan', 'Pulau Bali', 'B', 'Kalimantan adalah pulau terluas yang dimiliki wilayah Indonesia.'),
('q_panjat_4', 'tpl_resmi_panjat', 4, 'Lomba memanjat batang pinang yang dilumuri pelumas pada perayaan 17 Agustus disebut...', 'Tarik Tambang', 'Balap Karung', 'Panjat Pinang', 'C', 'Panjat Pinang adalah lomba tradisional 17 Agustus.'),
('q_panjat_5', 'tpl_resmi_panjat', 5, 'Dasar negara Republik Indonesia adalah...', 'Pancasila', 'Sumpah Pemuda', 'Proklamasi', 'A', 'Pancasila adalah dasar negara Republik Indonesia.')
ON CONFLICT (id) DO NOTHING;

-- 7. Insert Template Resmi: Balap Karung
INSERT INTO public.templates (id, "ownerId", judul, game, mode, resmi)
VALUES ('tpl_resmi_karung', NULL, 'Balap Karung 17-an: Cerdas Cermat Merdeka', 'balap_karung', 'multi', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.questions (id, "templateId", urutan, teks, "opsiA", "opsiB", "opsiC", "jawabanBenar", penjelasan)
VALUES
('q_karung_1', 'tpl_resmi_karung', 1, 'Bendera kebangsaan negara Indonesia bernama...', 'Sang Saka Merah Putih', 'Dwi Warna Biru Putih', 'Panji Nusantara', 'A', 'Sang Saka Merah Putih adalah sebutan bendera kebangsaan RI.'),
('q_karung_2', 'tpl_resmi_karung', 2, 'Siapakah bapak Proklamator kemerdekaan Indonesia bersama Ir. Soekarno?', 'Ki Hajar Dewantara', 'Drs. Mohammad Hatta', 'Jenderal Sudirman', 'B', 'Ir. Soekarno dan Drs. Mohammad Hatta adalah Proklamator RI.'),
('q_karung_3', 'tpl_resmi_karung', 3, 'Hasil dari 125 + 75 - 50 adalah...', '150', '175', '200', 'A', '125 + 75 = 200, lalu 200 - 50 = 150.'),
('q_karung_4', 'tpl_resmi_karung', 4, 'Ibu kota negara Indonesia yang baru di Kalimantan Timur bernama...', 'Nusantara', 'Balikpapan', 'Samarinda', 'A', 'Ibu Kota Nusantara (IKN) berlokasi di Kalimantan Timur.'),
('q_karung_5', 'tpl_resmi_karung', 5, 'Warna merah pada bendera merah putih melambangkan...', 'Keberanian', 'Kesucian', 'Kemakmuran', 'A', 'Merah melambangkan keberanian, putih melambangkan kesucian.')
ON CONFLICT (id) DO NOTHING;

-- 8. Insert Template Guru Demo: Pecahan Kelas 5
INSERT INTO public.templates (id, "ownerId", judul, game, mode, resmi)
VALUES ('tpl_guru_pecahan', 'usr_guru_demo', 'Pecahan Kelas 5', 'tarik_tambang', 'solo', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.questions (id, "templateId", urutan, teks, "opsiA", "opsiB", "opsiC", "jawabanBenar", penjelasan)
VALUES
('q_pecah_1', 'tpl_guru_pecahan', 1, 'Hasil dari 1/2 + 1/4 adalah...', '3/4', '2/6', '1/8', 'A', 'Samakan penyebut menjadi 4: 2/4 + 1/4 = 3/4.'),
('q_pecah_2', 'tpl_guru_pecahan', 2, 'Bentuk desimal dari 3/5 adalah...', '0,5', '0,6', '0,75', 'B', '3 dibagi 5 sama dengan 0,6.'),
('q_pecah_3', 'tpl_guru_pecahan', 3, 'Hasil dari 3/4 - 1/2 adalah...', '1/4', '2/4', '1/2', 'A', 'Samakan penyebut: 3/4 - 2/4 = 1/4.'),
('q_pecah_4', 'tpl_guru_pecahan', 4, 'Bentuk persen dari 1/4 adalah...', '20%', '25%', '40%', 'B', '1/4 dikalikan 100% sama dengan 25%.'),
('q_pecah_5', 'tpl_guru_pecahan', 5, 'Pecahan yang senilai dengan 2/3 adalah...', '4/6', '3/4', '4/9', 'A', 'Pembilang dan penyebut dikalikan 2 menghasilkan 4/6.'),
('q_pecah_6', 'tpl_guru_pecahan', 6, 'Hasil dari 2/3 × 3/4 adalah...', '5/7', '1/2', '6/7', 'B', '2/3 × 3/4 = 6/12 = 1/2 setelah disederhanakan.')
ON CONFLICT (id) DO NOTHING;
