import express, { Router, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import {
  generateSoalFromMateri,
  solveQuestionFromBoard,
  periksaDanPakaiKuota,
  getInfoKuota,
  cekBatasHarian,
  catatPemakaianAi,
  obrolDenganAI,
  generateKuisPapan,
} from '../ai/ai.js';
import { config } from '../config.js';

export const aiRouter = Router();

// Batas body JSON khusus rute AI: 12 MB (mendukung lampiran gambar & dokumen)
aiRouter.use(express.json({ limit: '12mb' }));

// Rate limiter khusus endpoint AI: maksimal 25 request per 5 menit per IP
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 25,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { pesan: 'Terlalu banyak permintaan AI. Silakan tunggu beberapa menit.' },
});

aiRouter.use(aiLimiter);
aiRouter.use(authMiddleware);
aiRouter.use(roleMiddleware(['guru', 'admin']));

// GET /api/ai/kuota - Ambil info kuota harian guru
aiRouter.get('/kuota', async (req: AuthRequest, res: Response) => {
  try {
    const kuota = await getInfoKuota(req.user!.id);
    return res.json({
      ...kuota,
      hasApiKey: Boolean(config.aiApiKey),
      model: config.aiModel || 'gemini-1.5-flash (terintegrasi)',
    });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal memeriksa kuota AI.' });
  }
});

// Skema validasi POST /api/ai/soal & POST /api/ai/generate-soal
const buatSoalSchema = z.preprocess(
  (val: any) => {
    if (typeof val === 'object' && val !== null) {
      return {
        materi: val.materi,
        jumlah: val.jumlah ?? val.jumlahSoal ?? 5,
        tingkat: val.tingkat ?? val.jenjang ?? 'SD',
        kesulitan: val.kesulitan ?? 'sedang',
      };
    }
    return val;
  },
  z.object({
    materi: z.string().trim().min(20, 'Teks materi minimal 20 karakter agar AI dapat menyusun soal yang mendidik.'),
    jumlah: z.coerce.number().int().min(1).max(15).default(5),
    tingkat: z.enum(['SD', 'SMP']).default('SD'),
    kesulitan: z.enum(['mudah', 'sedang', 'sulit']).default('sedang'),
  })
);

// Handler bersama untuk buat soal dari teks materi
const handleBuatSoal = async (req: AuthRequest, res: Response) => {
  try {
    const parsed = buatSoalSchema.parse(req.body);

    // 1. Periksa batas kuota harian
    const kuotaCheck = await periksaDanPakaiKuota(req.user!.id);
    if (!kuotaCheck.bisaPakai) {
      return res.status(429).json({
        sukses: false,
        pesan: `Batas kuota harian AI Anda (${kuotaCheck.batasHarian} request/hari) telah tercapai. Kuota akan direset besok hari.`,
        kuota: kuotaCheck,
      });
    }

    // 2. Generate soal
    const { soal, dariCache } = await generateSoalFromMateri({
      materi: parsed.materi,
      jumlah: parsed.jumlah,
      tingkat: parsed.tingkat,
      kesulitan: parsed.kesulitan,
    });

    return res.json({
      sukses: true,
      pesan: `Berhasil membuat ${soal.length} soal dengan AI.`,
      soal,
      questions: soal, // Kompatibilitas alias frontend
      dariCache,
      kuota: {
        sisaKuota: kuotaCheck.sisaKuota,
        totalTerpakai: kuotaCheck.totalTerpakai,
        batasHarian: kuotaCheck.batasHarian,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ sukses: false, pesan: err.issues[0]?.message || 'Input materi tidak valid.' });
    }
    return res.status(500).json({ sukses: false, pesan: err.message || 'Gagal menghasilkan soal dengan AI.' });
  }
};

// POST /api/ai/soal dan POST /api/ai/generate-soal
aiRouter.post('/soal', handleBuatSoal);
aiRouter.post('/generate-soal', handleBuatSoal);

// Skema validasi POST /api/ai/jawab
const jawabPapanSchema = z.object({
  gambar: z.string().min(10, 'Gambar area soal wajib disertakan.').optional(),
  imageBase64: z.string().min(10).optional(),
  pertanyaan: z.string().max(500, 'Pertanyaan maksimal 500 karakter.').optional(),
}).refine((data) => data.gambar || data.imageBase64, {
  message: 'Gambar area soal wajib disertakan.',
});

// POST /api/ai/jawab - Jawab soal yang dilingkari guru di papan tulis
aiRouter.post('/jawab', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = jawabPapanSchema.parse(req.body);
    const gambarData = parsed.gambar || parsed.imageBase64 || '';

    // 1. Periksa batas kuota harian per guru
    const kuotaCheck = await periksaDanPakaiKuota(req.user!.id);
    if (!kuotaCheck.bisaPakai) {
      return res.status(429).json({
        pesan: `Batas kuota harian Tanya AI (${kuotaCheck.batasHarian} request/hari) telah tercapai. Kuota akan direset besok.`,
        kuota: kuotaCheck,
      });
    }

    // 2. Panggil analisis soal dari potongan kanvas
    const { hasil, dariCache } = await solveQuestionFromBoard({
      imageBase64: gambarData,
      pertanyaan: parsed.pertanyaan,
    });

    return res.json({
      jawaban: hasil.jawaban,
      rumus: hasil.rumus || '-',
      langkah: hasil.langkah,
      dariCache,
      hasil,
      kuota: {
        sisaKuota: kuotaCheck.sisaKuota,
        totalTerpakai: kuotaCheck.totalTerpakai,
        batasHarian: kuotaCheck.batasHarian,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ pesan: err.issues[0]?.message || 'Data gambar tidak valid.' });
    }
    return res.status(500).json({ pesan: 'Gagal memproses Tanya AI dari kanvas. Silakan coba kembali.' });
  }
});

// Skema validasi POST /api/ai/obrol
const validImageMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

const lampiranSchema = z.object({
  jenis: z.enum(['gambar', 'pdf', 'teks']),
  nama: z.string().min(1, 'Nama file lampiran wajib ada.').max(255),
  mt: z.string().optional(),
  data: z.string().optional(),
  teks: z.string().max(30000, 'Teks lampiran maksimal 30.000 karakter.').optional(),
}).superRefine((l, ctx) => {
  if (l.jenis === 'gambar') {
    if (!l.data) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data gambar wajib disertakan.',
      });
      return;
    }
    const mt = l.mt?.toLowerCase() || '';
    // Ekstrak MIME dari data URL jika mt tidak disertakan
    let detectedMime = mt;
    if (!detectedMime && l.data.startsWith('data:')) {
      const match = l.data.match(/^data:([^;]+);/);
      if (match) detectedMime = match[1].toLowerCase();
    }
    if (!detectedMime || !validImageMimes.includes(detectedMime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Format gambar tidak didukung. Hanya gambar PNG, JPG, GIF, atau WebP yang diizinkan.',
      });
    }
  } else if (l.jenis === 'pdf') {
    if (!l.data) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data dokumen PDF wajib disertakan.',
      });
    }
  } else if (l.jenis === 'teks') {
    if (typeof l.teks !== 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Isi teks lampiran wajib berupa string.',
      });
    }
  }
});

const pesanObrolItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  teks: z.string().max(8000, 'Teks pesan maksimal 8.000 karakter.'),
  lampiran: z.array(lampiranSchema).max(4, 'Maksimal 4 lampiran diperbolehkan.').optional(),
});

const obrolRequestSchema = z.object({
  pesan: z.array(pesanObrolItemSchema).min(1, 'Minimal satu pesan harus dikirim.').max(20, 'Maksimal 20 riwayat pesan.'),
}).superRefine((data, ctx) => {
  const n = data.pesan.length;
  for (let i = 0; i < n; i++) {
    const item = data.pesan[i];
    const isLast = (i === n - 1);
    const hasAttachments = Boolean(item.lampiran && item.lampiran.length > 0);
    if (hasAttachments) {
      // Tolak jika lampiran berada di pesan non-terakhir atau bukan pesan user
      if (!isLast || item.role !== 'user') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Lampiran hanya boleh disertakan pada pesan pengguna terakhir.',
          path: ['pesan', i, 'lampiran'],
        });
      }
    }
  }
});

// POST /api/ai/obrol - Obrolan interaktif asisten AI di papan tulis
aiRouter.post('/obrol', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = obrolRequestSchema.parse(req.body);

    // 1. Periksa batas kuota harian khusus obrolan (AI_BATAS_OBROL, default 40)
    const kuotaCheck = await cekBatasHarian(req.user!.id, 'obrol');
    if (!kuotaCheck.bisaPakai) {
      return res.status(429).json({
        pesan: `Batas kuota harian obrolan AI (${kuotaCheck.batasHarian} request/hari) telah tercapai. Kuota akan direset besok hari.`,
      });
    }

    // 2. Hubungi AI lewat orkestrator backend
    const { jawaban } = await obrolDenganAI({
      pesan: parsed.pesan,
    });

    // 3. Catat pemakaian jika berhasil
    await catatPemakaianAi(req.user!.id);

    return res.json({ jawaban });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      const firstIssue = err.issues[0]?.message || 'Format permintaan obrolan tidak valid.';
      return res.status(400).json({ pesan: firstIssue });
    }
    const safeMessage = err?.message && !err.message.includes('at ')
      ? err.message
      : 'Gagal menghubungi asisten AI. Silakan coba kembali sesaat lagi.';
    return res.status(500).json({ pesan: safeMessage });
  }
});

// Skema validasi POST /api/ai/kuis-papan
const kuisPapanSchema = z.object({
  topik: z.string().max(200, 'Topik maksimal 200 karakter.').optional(),
  gambarPapan: z.string().min(10, 'Gambar papan tidak valid.').optional(),
  jumlah: z.number().int().min(1).max(10).default(5),
  tingkat: z.enum(['SD', 'SMP']).default('SD'),
  game: z.enum(['tarik_tambang', 'panjat_pinang', 'balap_karung']).default('tarik_tambang'),
  simpanTemplate: z.boolean().default(true),
}).refine((data) => (data.topik && data.topik.trim().length > 0) || Boolean(data.gambarPapan), {
  message: 'Wajib mengisi topik materi atau melampirkan gambar isi papan tulis.',
});

// POST /api/ai/kuis-papan - Buat kuis interaktif AI dari topik & isi papan tulis
aiRouter.post('/kuis-papan', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = kuisPapanSchema.parse(req.body);

    // 1. Periksa batas kuota harian
    const kuotaCheck = await periksaDanPakaiKuota(req.user!.id);
    if (!kuotaCheck.bisaPakai) {
      return res.status(429).json({
        pesan: `Batas kuota harian AI Anda (${kuotaCheck.batasHarian} request/hari) telah tercapai. Kuota akan direset besok hari.`,
        kuota: kuotaCheck,
      });
    }

    // 2. Generate kuis dari topik dan/atau kanvas
    const hasil = await generateKuisPapan({
      userId: req.user!.id,
      topik: parsed.topik?.trim(),
      gambarPapan: parsed.gambarPapan,
      jumlah: parsed.jumlah,
      tingkat: parsed.tingkat,
      game: parsed.game,
      simpanTemplate: parsed.simpanTemplate,
    });

    return res.json({
      pesan: `Berhasil membuat ${hasil.soal.length} soal kuis dengan AI.`,
      soal: hasil.soal,
      template: hasil.template,
      kuota: {
        sisaKuota: kuotaCheck.sisaKuota,
        totalTerpakai: kuotaCheck.totalTerpakai,
        batasHarian: kuotaCheck.batasHarian,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ pesan: err.issues[0]?.message || 'Input kuis tidak valid.' });
    }
    const safeMessage = err?.message && !err.message.includes('at ')
      ? err.message
      : 'Gagal membuat kuis dengan AI. Silakan coba kembali.';
    return res.status(500).json({ pesan: safeMessage });
  }
});

