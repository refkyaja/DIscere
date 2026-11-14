import { Router, Response, Request } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { getNetworkBaseUrl } from '../utils/network.js';
import { mapDbQuestionForGame, SoalRecordForGame } from '../utils/questionOptions.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { getSesiIO } from '../realtime/sesi.js';
import { soloManager } from '../games/soloManager.js';
import { multiManager } from '../games/multiManager.js';
import {
  bangunKonfigurasiTarikTambang,
  filterBankSoalSetara,
  konfigurasiTarikTambangSchema,
  KonfigurasiTarikTambang,
  SoalBankTarikTambang,
  TimTarikTambang,
} from '../games/tarikTambang.js';

function normalisasiKodeTim(raw?: string | null): TimTarikTambang | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  if (cleaned === 'merah' || cleaned === 'tim1' || cleaned === '1' || cleaned === 'kiri') {
    return 'merah';
  }
  if (cleaned === 'putih' || cleaned === 'biru' || cleaned === 'tim2' || cleaned === '2' || cleaned === 'kanan') {
    return 'putih';
  }
  return null;
}
import { kerupukManager } from '../games/kerupukManager.js';
import { kerupukMultiManager } from '../games/kerupukMultiManager.js';
import {
  bangunKonfigurasiKerupukSolo,
  bangunKonfigurasiKerupukMulti,
  konfigurasiKerupukSoloSchema,
  konfigurasiKerupukMultiSchema,
  validasiProbabilitas,
} from '../games/makanKerupuk.js';
import { panjatPinangManager } from '../games/panjatPinangManager.js';
import { panjatPinangSoloManager } from '../games/panjatPinangSoloManager.js';
import {
  bangunKonfigurasiPanjatPinang,
  konfigurasiPanjatPinangSchema,
} from '../games/panjatPinang.js';
import { balapKarungManager } from '../games/balapKarungManager.js';
import { balapKarungSoloManager } from '../games/balapKarungSoloManager.js';
import {
  bangunKonfigurasiBalapKarung,
  konfigurasiBalapKarungSchema,
} from '../games/balapKarung.js';
import { bersihkanTimerSesi } from '../realtime/sesi.js';

export const sesiRouter = Router();

type ResolvedSessionManager =
  | { kind: 'balap_solo'; session: NonNullable<ReturnType<typeof balapKarungSoloManager.dapatkanSesi>> }
  | { kind: 'balap_multi'; session: NonNullable<ReturnType<typeof balapKarungManager.dapatkanSesi>> }
  | { kind: 'panjat_solo'; session: NonNullable<ReturnType<typeof panjatPinangSoloManager.dapatkanSesi>> }
  | { kind: 'panjat_multi'; session: NonNullable<ReturnType<typeof panjatPinangManager.dapatkanSesi>> }
  | { kind: 'kerupuk_multi'; session: NonNullable<ReturnType<typeof kerupukMultiManager.dapatkanSesi>> }
  | { kind: 'kerupuk_solo'; session: NonNullable<ReturnType<typeof kerupukManager.dapatkanSesi>> }
  | { kind: 'tarik_multi'; session: NonNullable<ReturnType<typeof multiManager.dapatkanSesi>> }
  | { kind: 'tarik_solo'; session: NonNullable<ReturnType<typeof soloManager.dapatkanSesi>> };

async function resolveSessionAnyManager(id: string): Promise<ResolvedSessionManager | null> {
  // Cek semua manager in-memory terlebih dahulu agar bebas latency DB beruntun
  const bSolo = balapKarungSoloManager.dapatkanSesi(id);
  if (bSolo) return { kind: 'balap_solo', session: bSolo };
  const bMulti = balapKarungManager.dapatkanSesi(id);
  if (bMulti) return { kind: 'balap_multi', session: bMulti };
  const pSolo = panjatPinangSoloManager.dapatkanSesi(id);
  if (pSolo) return { kind: 'panjat_solo', session: pSolo };
  const pMulti = panjatPinangManager.dapatkanSesi(id);
  if (pMulti) return { kind: 'panjat_multi', session: pMulti };
  const kMulti = kerupukMultiManager.dapatkanSesi(id);
  if (kMulti) return { kind: 'kerupuk_multi', session: kMulti };
  const kSolo = kerupukManager.dapatkanSesi(id);
  if (kSolo) return { kind: 'kerupuk_solo', session: kSolo };
  const tMulti = multiManager.dapatkanSesi(id);
  if (tMulti) return { kind: 'tarik_multi', session: tMulti };
  const tSolo = soloManager.dapatkanSesi(id);
  if (tSolo) return { kind: 'tarik_solo', session: tSolo };

  // Fallback pemulihan DB: 1 query ringan untuk menentukan game & mode sesi
  const dbMeta = await prisma.session.findUnique({
    where: { id },
    select: { mode: true, template: { select: { game: true } } },
  });
  if (!dbMeta) return null;

  const g = dbMeta.template?.game || 'tarik_tambang';
  const m = dbMeta.mode || 'solo';

  if (g === 'balap_karung') {
    if (m === 'solo') {
      const s = await balapKarungSoloManager.pulihkanSesiDariDb(id);
      return s ? { kind: 'balap_solo', session: s } : null;
    }
    const s = await balapKarungManager.pulihkanSesiDariDb(id);
    return s ? { kind: 'balap_multi', session: s } : null;
  }
  if (g === 'panjat_pinang') {
    if (m === 'solo') {
      const s = await panjatPinangSoloManager.pulihkanSesiDariDb(id);
      return s ? { kind: 'panjat_solo', session: s } : null;
    }
    const s = await panjatPinangManager.pulihkanSesiDariDb(id);
    return s ? { kind: 'panjat_multi', session: s } : null;
  }
  if (g === 'makan_kerupuk') {
    if (m === 'multi') {
      const s = await kerupukMultiManager.pulihkanSesiDariDb(id);
      return s ? { kind: 'kerupuk_multi', session: s } : null;
    }
    const s = await kerupukManager.pulihkanSesiDariDb(id);
    return s ? { kind: 'kerupuk_solo', session: s } : null;
  }

  if (m === 'multi') {
    const s = await multiManager.pulihkanSesiDariDb(id);
    return s ? { kind: 'tarik_multi', session: s } : null;
  }
  const s = await soloManager.pulihkanSesiDariDb(id);
  return s ? { kind: 'tarik_solo', session: s } : null;
}

async function cekMultiAtauPulihkanSoloTarik(
  sessionId: string,
  hostId: string
): Promise<'MULTI' | 'OK'> {
  if (soloManager.dapatkanSesi(sessionId, hostId)) {
    return 'OK';
  }
  if (multiManager.dapatkanSesi(sessionId)) {
    return 'MULTI';
  }
  const resolved = await resolveSessionAnyManager(sessionId);
  if (resolved?.kind === 'tarik_multi') return 'MULTI';
  return 'OK';
}

function isTokenDipakaiDiMemori(token: string): boolean {
  return (
    Boolean(balapKarungManager.dapatkanSesiDariToken(token)) ||
    Boolean(panjatPinangManager.dapatkanSesiDariToken(token)) ||
    Boolean(kerupukMultiManager.dapatkanSesiDariToken(token)) ||
    Boolean(multiManager.dapatkanSesiDariToken(token))
  );
}

function mapQuestionsForTarikTambang(
  questions: SoalRecordForGame[]
): SoalBankTarikTambang[] {
  return questions.map(mapDbQuestionForGame);
}

function parseTarikTambangConfigFromJson(
  rawJson: string | null | undefined
): Partial<KonfigurasiTarikTambang> | undefined {
  if (!rawJson) return undefined;
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed?.config && typeof parsed.config === 'object') {
      return parsed.config as Partial<KonfigurasiTarikTambang>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function serializeMultiTarikSession(
  sesi: ReturnType<typeof multiManager.dapatkanSesi> & object,
  qrDataUrl: string,
  joinUrl: string,
  networkUrl: string
) {
  return {
    sessionId: sesi.sessionId,
    game: 'tarik_tambang' as const,
    mode: 'multi' as const,
    playMode: 'MULTIPLAYER' as const,
    token: sesi.token,
    qrDataUrl,
    joinUrl,
    networkUrl,
    templateId: sesi.templateId,
    templateJudul: sesi.templateJudul,
    status: sesi.status,
    config: sesi.config,
    totalSoal: sesi.totalSoal,
    taliPosition: sesi.taliPosition,
    skorMerah: sesi.skorMerah,
    skorPutih: sesi.skorPutih,
    matchStartedAtMs: sesi.matchStartedAtMs,
    matchEndsAt: sesi.matchEndsAtMs,
    durasiLombaDetik: sesi.config.durasiLombaDetik,
    powerUpTim1: {
      bank: sesi.powerUpTim1.bank,
      aktifBerikutnya: sesi.powerUpTim1.aktifBerikutnya,
    },
    powerUpTim2: {
      bank: sesi.powerUpTim2.bank,
      aktifBerikutnya: sesi.powerUpTim2.aktifBerikutnya,
    },
    totalPeserta: sesi.peserta.size,
    daftarPeserta: multiManager.dapatkanDaftarPeserta(sesi.sessionId),
    isFinished: sesi.status === 'selesai',
    hasil: sesi.hasil || null,
  };
}

async function generateTokenUnikSemuaGame(): Promise<string> {
  for (let i = 0; i < 200; i++) {
    const token = crypto.randomInt(100000, 1000000).toString();
    if (isTokenDipakaiDiMemori(token)) continue;
    const existsDb = await prisma.session.findFirst({
      where: { token, status: { in: ['lobi', 'jalan'] } },
      select: { id: true },
    });
    if (!existsDb) return token;
  }
  throw new Error('Gagal menghasilkan token sesi unik.');
}

// 0. GET /api/sesi/token/:token - Publik: Cek validitas token sesi untuk siswa bergabung
sesiRouter.get('/token/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;
    if (
      soloManager.dapatkanSesi(token) ||
      kerupukManager.dapatkanSesi(token) ||
      balapKarungSoloManager.dapatkanSesi(token) ||
      panjatPinangSoloManager.dapatkanSesi(token)
    ) {
      return res.status(400).json({
        valid: false,
        pesan: 'Mode Solo tidak memakai kode PIN dan tidak menerima peserta siswa.',
      });
    }
    if (!token || token.length !== 6) {
      if (token) {
        const soloDb = await prisma.session.findUnique({
          where: { id: token },
          select: { mode: true },
        });
        if (soloDb?.mode === 'solo') {
          return res.status(400).json({
            valid: false,
            pesan: 'Mode Solo tidak memakai kode PIN dan tidak menerima peserta siswa.',
          });
        }
      }
      return res.status(400).json({ valid: false, pesan: 'Kode token harus terdiri dari 6 angka.' });
    }

    // 0b. Cek di in-memory balapKarungManager (Game Balap Karung Challenge)
    const activeBalap = balapKarungManager.dapatkanSesiDariToken(token);
    if (activeBalap) {
      if (activeBalap.status === 'selesai') {
        return res.status(400).json({ valid: false, pesan: 'Sesi Balap Karung ini sudah selesai.' });
      }
      return res.json({
        valid: true,
        sessionId: activeBalap.sessionId,
        templateJudul: activeBalap.templateJudul,
        game: 'balap_karung',
        status: activeBalap.status,
        totalPeserta: activeBalap.peserta.size,
        maxPeserta: activeBalap.config.maxPeserta,
        allowLateJoin: activeBalap.config.allowLateJoin,
      });
    }

    // 0. Cek di in-memory panjatPinangManager (Game Panjat Pinang)
    const activePanjat = panjatPinangManager.dapatkanSesiDariToken(token);
    if (activePanjat) {
      if (activePanjat.status === 'selesai') {
        return res.status(400).json({ valid: false, pesan: 'Sesi Panjat Pinang ini sudah selesai.' });
      }
      return res.json({
        valid: true,
        sessionId: activePanjat.sessionId,
        templateJudul: activePanjat.templateJudul,
        game: 'panjat_pinang',
        status: activePanjat.status,
        totalPeserta: activePanjat.peserta.size,
        maxPeserta: activePanjat.config.maxPeserta,
        allowLateJoin: activePanjat.config.allowLateJoin,
      });
    }

    // 1. Cek di in-memory kerupukMultiManager (Game Makan Kerupuk Mode Multiplayer)
    const activeKerupukMulti = kerupukMultiManager.dapatkanSesiDariToken(token);
    if (activeKerupukMulti) {
      if (activeKerupukMulti.status === 'selesai') {
        return res.status(400).json({ valid: false, pesan: 'Sesi Makan Kerupuk ini sudah selesai.' });
      }
      return res.json({
        valid: true,
        sessionId: activeKerupukMulti.sessionId,
        templateJudul: activeKerupukMulti.templateJudul,
        game: 'makan_kerupuk',
        playMode: 'MULTIPLAYER',
        status: activeKerupukMulti.status,
        totalPeserta: activeKerupukMulti.peserta.size,
        maxPeserta: activeKerupukMulti.config.maxPeserta,
        allowLateJoin: activeKerupukMulti.config.allowLateJoin,
      });
    }

    // 2. Cek di in-memory multiManager (Game Tarik Tambang Multiplayer)
    const active = multiManager.dapatkanSesiDariToken(token);
    if (active) {
      if (active.status === 'selesai') {
        return res.status(400).json({ valid: false, pesan: 'Sesi permainan ini sudah selesai.' });
      }
      return res.json({
        valid: true,
        sessionId: active.sessionId,
        templateJudul: active.templateJudul,
        game: 'tarik_tambang',
        playMode: 'MULTIPLAYER',
        status: active.status,
        totalPeserta: active.peserta.size,
        maxPeserta: active.config.maxPeserta,
        allowLateJoin: active.config.allowLateJoin,
      });
    }

    // 3. Cek di database jika belum termuat di memori
    const sessionDb = await prisma.session.findFirst({
      where: { token, status: { in: ['lobi', 'jalan'] } },
      include: {
        template: {
          select: { judul: true, id: true, game: true },
        },
      },
    });

    if (!sessionDb) {
      return res.status(404).json({ valid: false, pesan: 'Kode token tidak ditemukan atau sudah tidak aktif.' });
    }

    if (sessionDb.mode === 'solo') {
      return res.status(400).json({
        valid: false,
        pesan: 'Sesi ini berjalan dalam Mode Solo di satu perangkat dan tidak memakai PIN.',
      });
    }

    return res.json({
      valid: true,
      sessionId: sessionDb.id,
      templateJudul: sessionDb.template.judul,
      game: sessionDb.template.game,
      status: sessionDb.status,
      totalPeserta: 0,
    });
  } catch (err: any) {
    return res.status(500).json({ valid: false, pesan: err.message || 'Gagal memeriksa token.' });
  }
});

// Seluruh rute sesi berikut membutuhkan autentikasi
sesiRouter.use(authMiddleware);

// DELETE /api/sesi/:id - Hapus sesi permainan milik guru atau admin
sesiRouter.delete('/:id', roleMiddleware(['guru', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const session = await prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({ pesan: 'Sesi tidak ditemukan.' });
    }

    if (session.hostId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ pesan: 'Anda tidak berwenang menghapus sesi ini.' });
    }

    bersihkanTimerSesi(id);
    balapKarungSoloManager.hapusSesi(id);
    balapKarungManager.hapusSesi(id);
    panjatPinangSoloManager.hapusSesi(id);
    panjatPinangManager.hapusSesi(id);
    kerupukManager.hapusSesi(id);
    kerupukMultiManager.hapusSesi(id);
    soloManager.hapusSesi(id);
    multiManager.hapusSesi(id);

    await prisma.session.delete({
      where: { id },
    });

    return res.json({ pesan: 'Sesi berhasil dihapus.' });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal menghapus sesi.' });
  }
});

// Rute operasional sesi lainnya khusus role guru
sesiRouter.use(roleMiddleware('guru'));

// 1. GET /api/sesi/riwayat - Daftar riwayat sesi milik guru
sesiRouter.get('/riwayat', async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        hostId: req.user!.id,
        status: 'selesai',
      },
      orderBy: { selesaiPada: 'desc' },
      include: {
        template: {
          select: {
            id: true,
            judul: true,
            game: true,
            mode: true,
          },
        },
        result: true,
        _count: {
          select: {
            questionStats: true,
          },
        },
      },
    });

    const riwayat = sessions.map((s) => ({
      id: s.id,
      templateId: s.templateId,
      templateJudul: s.template.judul,
      game: s.template.game,
      mode: s.mode.toUpperCase(),
      status: s.status,
      tanggal: s.selesaiPada || s.createdAt,
      timMenang: s.result?.timMenang || 'seri',
      posisiAkhir: s.result?.posisiAkhir ?? 0,
      skorMerah: s.result?.skorMerah ?? 0,
      skorPutih: s.result?.skorPutih ?? 0,
      totalSoal: s._count.questionStats,
    }));

    return res.json({ riwayat });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal memuat riwayat permainan.' });
  }
});

// 2. GET /api/sesi/riwayat/:id - Detail spesifik riwayat guru termasuk analisis soal paling sering salah
sesiRouter.get('/riwayat/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        template: {
          include: {
            questions: { orderBy: { urutan: 'asc' } },
          },
        },
        result: true,
        questionStats: {
          include: {
            question: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ pesan: 'Sesi riwayat tidak ditemukan.' });
    }

    if (session.hostId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak dapat melihat riwayat milik guru lain.' });
    }

    // Hitung total benar dan salah dari question stats
    let totalBenar = 0;
    let totalSalah = 0;
    let soalPalingSeringSalah: any = null;
    let maxSalah = -1;

    const statsPerSoal = session.questionStats.map((qs) => {
      totalBenar += qs.jumlahBenar;
      totalSalah += qs.jumlahSalah;

      if (qs.jumlahSalah > maxSalah) {
        maxSalah = qs.jumlahSalah;
        soalPalingSeringSalah = {
          questionId: qs.questionId,
          urutan: qs.question.urutan,
          teks: qs.question.teks,
          jumlahSalah: qs.jumlahSalah,
          jumlahBenar: qs.jumlahBenar,
          penjelasan: qs.question.penjelasan,
        };
      }

      return {
        questionId: qs.questionId,
        urutan: qs.question.urutan,
        teks: qs.question.teks,
        opsiA: qs.question.opsiA,
        opsiB: qs.question.opsiB,
        opsiC: qs.question.opsiC,
        opsiD: qs.question.opsiD,
        opsiE: qs.question.opsiE,
        jawabanBenar: qs.question.jawabanBenar,
        penjelasan: qs.question.penjelasan,
        jumlahBenar: qs.jumlahBenar,
        jumlahSalah: qs.jumlahSalah,
      };
    });

    // Jika tidak ada yang salah sama sekali
    if (maxSalah <= 0) {
      soalPalingSeringSalah = null;
    }

    const laporanPanjatPinang =
      session.template.game === 'panjat_pinang'
        ? session.mode === 'solo'
          ? await panjatPinangSoloManager.muatLaporanDariDatabase(session.id)
          : await panjatPinangManager.muatLaporanDariDatabase(session.id)
        : null;

    const laporanBalapKarung =
      session.template.game === 'balap_karung'
        ? session.mode === 'solo'
          ? await balapKarungSoloManager.muatLaporanDariDatabase(session.id)
          : await balapKarungManager.muatLaporanDariDatabase(session.id)
        : null;

    const laporanKerupukSolo =
      session.template.game === 'makan_kerupuk' && session.mode === 'solo'
        ? await kerupukManager.muatLaporanDariDatabase(session.id)
        : null;

    const laporanKerupukMulti =
      session.template.game === 'makan_kerupuk' && session.mode === 'multi'
        ? await kerupukMultiManager.muatLaporanDariDatabase(session.id)
        : null;

    const laporanTarikSolo =
      session.template.game === 'tarik_tambang' && session.mode === 'solo'
        ? await soloManager.muatLaporanDariDatabase(session.id)
        : null;

    const laporanTarikMulti =
      session.template.game === 'tarik_tambang' && session.mode === 'multi'
        ? await multiManager.muatLaporanDariDatabase(session.id)
        : null;

    return res.json({
      detail: {
        sessionId: session.id,
        templateJudul: session.template.judul,
        game: session.template.game,
        mode: session.mode.toUpperCase(),
        tanggal: session.selesaiPada || session.createdAt,
        timMenang: session.result?.timMenang || 'seri',
        posisiAkhir: session.result?.posisiAkhir ?? 0,
        skorMerah: session.result?.skorMerah ?? 0,
        skorPutih: session.result?.skorPutih ?? 0,
        totalBenar,
        totalSalah,
        totalSoalDimainkan: session.questionStats.length,
        statsPerSoal,
        soalPalingSeringSalah,
        laporanTarikSolo,
        laporanTarikMulti,
        laporanPanjatPinang,
        laporanBalapKarung,
        laporanKerupukSolo,
        laporanKerupukMulti,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal memuat detail riwayat.' });
  }
});

// 3. POST /api/sesi - Buat sesi (Solo, Tarik Tambang Multi, Makan Kerupuk, atau Panjat Pinang)
const buatSesiSchema = z.object({
  templateId: z.string().min(1, 'ID template wajib disertakan.'),
  mode: z.enum(['solo', 'multi']).optional(),
  playMode: z.enum(['SOLO', 'MULTIPLAYER']).optional(),
  autoStart: z.boolean().optional(),
  game: z.enum(['tarik_tambang', 'makan_kerupuk', 'panjat_pinang', 'balap_karung']).optional(),
  tarikTambangConfig: konfigurasiTarikTambangSchema.optional(),
  kerupukConfig: konfigurasiKerupukSoloSchema.optional(),
  kerupukMultiConfig: konfigurasiKerupukMultiSchema.optional(),
  probabilitas: z
    .object({
      besar: z.number(),
      sedang: z.number(),
      kecil: z.number(),
      sangat_kecil: z.number(),
      zonk: z.number(),
    })
    .optional(),
  panjatPinangConfig: konfigurasiPanjatPinangSchema.optional(),
  balapKarungConfig: konfigurasiBalapKarungSchema.optional(),
  maxPeserta: z.number().int().min(1).max(200).optional(),
  durasiSoalDetik: z.number().int().min(5).max(120).optional(),
  allowLateJoin: z.boolean().optional(),
  jumlahTim: z.union([z.literal(3), z.literal(4)]).optional(),
});

sesiRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = buatSesiSchema.parse(req.body);
    const templateId = parsed.templateId;

    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: {
        questions: { orderBy: { urutan: 'asc' } },
      },
    });

    if (!template) {
      return res.status(404).json({ pesan: 'Template tidak ditemukan.' });
    }

    if (!template.resmi && template.ownerId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke template ini.' });
    }

    // Pastikan template memiliki soal
    if (!template.questions || template.questions.length === 0) {
      return res.status(400).json({
        pesan: 'Template ini belum memiliki soal. Silakan tambahkan soal terlebih dahulu.',
      });
    }

    const targetGame = parsed.game || template.game || 'tarik_tambang';

    // -------------------------------------------------------------
    // CABANG 0B: Game Balap Karung Challenge (Dual-Mode: SOLO / MULTIPLAYER)
    // -------------------------------------------------------------
    if (targetGame === 'balap_karung') {
      const requestedSolo =
        parsed.playMode === 'SOLO' ||
        parsed.mode === 'solo' ||
        (!parsed.playMode && !parsed.mode && template.mode === 'solo');

      if (requestedSolo) {
        const rawSoloCfg = parsed.balapKarungConfig || {};
        const configSnapshot = bangunKonfigurasiBalapKarung({
          waktuPerSoalDetik: 15,
          ...rawSoloCfg,
          maxPeserta: 2,
          allowLateJoin: false,
        });
        const autoStart = parsed.autoStart === true;

        const session = await prisma.session.create({
          data: {
            templateId: template.id,
            hostId: req.user!.id,
            mode: 'solo',
            token: null,
            status: autoStart ? 'jalan' : 'lobi',
            mulaiPada: autoStart ? new Date() : null,
            konfigurasi: JSON.stringify({
              playMode: 'SOLO',
              config: configSnapshot,
            }),
          },
        });

        const activeSoloBalap = balapKarungSoloManager.inisialisasiSesi(
          session.id,
          req.user!.id,
          { id: template.id, judul: template.judul },
          template.questions.map(mapDbQuestionForGame),
          configSnapshot,
          autoStart
        );

        return res.status(201).json({
          pesan: 'Sesi Mode Solo Balap Karung Challenge siap dimulai.',
          session: {
            id: session.id,
            ...balapKarungSoloManager.serialisasiUntukClient(activeSoloBalap),
          },
        });
      }

      const rawMultiCfg = parsed.balapKarungConfig || {};
      const configSnapshot = bangunKonfigurasiBalapKarung({
        waktuPerSoalDetik: 10,
        jumlahTim: 3,
        ...rawMultiCfg,
        ...(parsed.maxPeserta ? { maxPeserta: parsed.maxPeserta } : {}),
        ...(parsed.allowLateJoin !== undefined ? { allowLateJoin: parsed.allowLateJoin } : {}),
      });

      const token = await generateTokenUnikSemuaGame();
      const baseUrl = getNetworkBaseUrl(req);
      const joinUrl = `${baseUrl}/main?token=${token}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });

      const session = await prisma.session.create({
        data: {
          templateId: template.id,
          hostId: req.user!.id,
          mode: 'multi',
          token,
          status: 'lobi',
          konfigurasi: JSON.stringify(configSnapshot),
        },
      });

      const activeSession = balapKarungManager.inisialisasiSesi(
        session.id,
        token,
        req.user!.id,
        { id: template.id, judul: template.judul },
        template.questions.map(mapDbQuestionForGame),
        configSnapshot
      );

      return res.status(201).json({
        pesan: 'Sesi Balap Karung Challenge berhasil dibuat.',
        session: {
          id: session.id,
          game: 'balap_karung',
          mode: 'multi',
          playMode: 'MULTIPLAYER',
          token,
          qrDataUrl,
          joinUrl,
          networkUrl: baseUrl,
          templateId: template.id,
          templateJudul: template.judul,
          status: 'lobi',
          totalSoal: activeSession.totalSoal,
          config: activeSession.config,
        },
      });
    }

    // -------------------------------------------------------------
    // CABANG 0: Game Panjat Pinang (Dual-Mode: SOLO / MULTIPLAYER)
    // -------------------------------------------------------------
    if (targetGame === 'panjat_pinang') {
      const requestedSolo =
        parsed.playMode === 'SOLO' ||
        parsed.mode === 'solo' ||
        (!parsed.playMode && !parsed.mode && template.mode === 'solo');

      if (requestedSolo) {
        const rawSoloCfg = parsed.panjatPinangConfig || {};
        const configSnapshot = bangunKonfigurasiPanjatPinang({
          waktuPerSoalDetik: 15,
          ...rawSoloCfg,
          maxPeserta: 2,
          allowLateJoin: false,
        });
        const autoStart = parsed.autoStart === true;

        const session = await prisma.session.create({
          data: {
            templateId: template.id,
            hostId: req.user!.id,
            mode: 'solo',
            token: null,
            status: autoStart ? 'jalan' : 'lobi',
            mulaiPada: autoStart ? new Date() : null,
            konfigurasi: JSON.stringify({
              playMode: 'SOLO',
              config: configSnapshot,
            }),
          },
        });

        const activeSoloPanjat = panjatPinangSoloManager.inisialisasiSesi(
          session.id,
          req.user!.id,
          { id: template.id, judul: template.judul },
          template.questions.map(mapDbQuestionForGame),
          configSnapshot,
          autoStart
        );

        await panjatPinangSoloManager.simpanStatusKeDatabase(activeSoloPanjat);

        return res.status(201).json({
          pesan: 'Sesi Mode Solo Panjat Pinang Challenge siap dimulai.',
          session: {
            id: session.id,
            ...panjatPinangSoloManager.serialisasiUntukClient(activeSoloPanjat),
          },
        });
      }

      const configSnapshot = bangunKonfigurasiPanjatPinang({
        ...(parsed.panjatPinangConfig || {}),
        ...(parsed.maxPeserta ? { maxPeserta: parsed.maxPeserta } : {}),
        ...(parsed.allowLateJoin !== undefined ? { allowLateJoin: parsed.allowLateJoin } : {}),
      });

      const token = await generateTokenUnikSemuaGame();
      const baseUrl = getNetworkBaseUrl(req);
      const joinUrl = `${baseUrl}/main?token=${token}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });

      const session = await prisma.session.create({
        data: {
          templateId: template.id,
          hostId: req.user!.id,
          mode: 'multi',
          token,
          status: 'lobi',
          konfigurasi: JSON.stringify(configSnapshot),
        },
      });

      const activeSession = panjatPinangManager.inisialisasiSesi(
        session.id,
        token,
        req.user!.id,
        { id: template.id, judul: template.judul },
        template.questions.map(mapDbQuestionForGame),
        configSnapshot
      );

      return res.status(201).json({
        pesan: 'Sesi Panjat Pinang berhasil dibuat.',
        session: {
          id: session.id,
          game: 'panjat_pinang',
          mode: 'multi',
          token,
          qrDataUrl,
          joinUrl,
          networkUrl: baseUrl,
          templateId: template.id,
          templateJudul: template.judul,
          status: 'lobi',
          totalSoal: activeSession.totalSoal,
          config: activeSession.config,
        },
      });
    }

    // -------------------------------------------------------------
    // CABANG A: Game Makan Kerupuk Challenge (Dual-Mode: SOLO / MULTIPLAYER)
    // -------------------------------------------------------------
    if (targetGame === 'makan_kerupuk') {
      const requestedMulti =
        parsed.playMode === 'MULTIPLAYER' ||
        parsed.mode === 'multi' ||
        Boolean(parsed.kerupukMultiConfig) ||
        (!parsed.playMode && !parsed.mode && !parsed.kerupukConfig && template.mode === 'multi');

      const mergedProb =
        parsed.kerupukMultiConfig?.probabilitas ||
        parsed.kerupukConfig?.probabilitas ||
        parsed.probabilitas;

      if (mergedProb) {
        const validasi = validasiProbabilitas(mergedProb);
        if (!validasi.valid) {
          return res.status(400).json({
            pesan: validasi.pesanError || 'Total probabilitas gigitan harus tepat 100%.',
          });
        }
      }

      if (requestedMulti) {
        const configSnapshot = bangunKonfigurasiKerupukMulti({
          ...(parsed.kerupukConfig || {}),
          ...(parsed.kerupukMultiConfig || {}),
          ...(parsed.probabilitas ? { probabilitas: parsed.probabilitas } : {}),
          ...(parsed.maxPeserta ? { maxPeserta: parsed.maxPeserta } : {}),
          ...(parsed.allowLateJoin !== undefined ? { allowLateJoin: parsed.allowLateJoin } : {}),
          jumlahTim: parsed.kerupukMultiConfig?.jumlahTim || parsed.jumlahTim || 3,
        });

        const token = await generateTokenUnikSemuaGame();
        const baseUrl = getNetworkBaseUrl(req);
        const joinUrl = `${baseUrl}/main?token=${token}`;
        const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });

        const session = await prisma.session.create({
          data: {
            templateId: template.id,
            hostId: req.user!.id,
            mode: 'multi',
            token,
            status: 'lobi',
            konfigurasi: JSON.stringify({
              playMode: 'MULTIPLAYER',
              config: configSnapshot,
            }),
          },
        });

        const activeMultiKerupuk = kerupukMultiManager.inisialisasiSesi(
          session.id,
          token,
          req.user!.id,
          { id: template.id, judul: template.judul },
          template.questions.map(mapDbQuestionForGame),
          configSnapshot
        );

        return res.status(201).json({
          pesan: 'Sesi Multiplayer Makan Kerupuk Challenge siap dibuka.',
          session: {
            id: session.id,
            sessionId: session.id,
            game: 'makan_kerupuk',
            mode: 'multi',
            playMode: 'MULTIPLAYER',
            token,
            qrDataUrl,
            joinUrl,
            networkUrl: baseUrl,
            templateId: template.id,
            templateJudul: template.judul,
            status: 'lobi',
            totalSoalBank: activeMultiKerupuk.questions.length,
            totalSoal: activeMultiKerupuk.questions.length,
            config: activeMultiKerupuk.config,
          },
        });
      }

      // Cabang SOLO (Teacher Device)
      const mergedKerupukInput = {
        ...(parsed.kerupukConfig || {}),
        ...(parsed.probabilitas ? { probabilitas: parsed.probabilitas } : {}),
      };

      const configSnapshot = bangunKonfigurasiKerupukSolo(mergedKerupukInput);
      const shouldAutoStart = parsed.autoStart === true;

      const session = await prisma.session.create({
        data: {
          templateId: template.id,
          hostId: req.user!.id,
          mode: 'solo',
          token: null,
          status: shouldAutoStart ? 'jalan' : 'lobi',
          mulaiPada: shouldAutoStart ? new Date() : null,
          konfigurasi: JSON.stringify({
            playMode: 'SOLO',
            config: configSnapshot,
          }),
        },
      });

      const activeSession = kerupukManager.inisialisasiSesi(
        session.id,
        req.user!.id,
        { id: template.id, judul: template.judul },
        template.questions.map(mapDbQuestionForGame),
        configSnapshot
      );

      if (shouldAutoStart) {
        kerupukManager.mulaiPermainan(session.id, req.user!.id);
      }

      return res.status(201).json({
        pesan: shouldAutoStart
          ? 'Permainan Mode Solo Makan Kerupuk Challenge langsung dimulai.'
          : 'Sesi Mode Solo Makan Kerupuk Challenge siap dimulai.',
        session: {
          id: session.id,
          ...kerupukManager.serialisasiSesiUntukClient(activeSession),
        },
      });
    }

    // -------------------------------------------------------------
    // CABANG B: Game Tarik Tambang (Solo Local 1v1 / Team Multiplayer)
    // -------------------------------------------------------------
    const targetMode =
      parsed.playMode === 'MULTIPLAYER'
        ? 'multi'
        : parsed.playMode === 'SOLO'
          ? 'solo'
          : parsed.mode || (template.mode === 'multi' ? 'multi' : 'solo');

    const rawTarikConfig: Partial<KonfigurasiTarikTambang> = {
      ...(parsed.tarikTambangConfig || {}),
      ...(parsed.durasiSoalDetik && [15, 20, 30].includes(parsed.durasiSoalDetik)
        ? { durasiRonde: parsed.durasiSoalDetik as 15 | 20 | 30 }
        : {}),
      ...(parsed.maxPeserta ? { maxPeserta: parsed.maxPeserta } : {}),
    };

    const mappedQuestions = mapQuestionsForTarikTambang(template.questions);
    if (!req.body?.tarikTambangConfig?.kesulitan) {
      rawTarikConfig.kesulitan = 'semua';
    }

    const configTarik = bangunKonfigurasiTarikTambang(rawTarikConfig);

    // Validasi pool soal setara sebelum membuat record sesi di DB
    try {
      filterBankSoalSetara(mappedQuestions, configTarik.kesulitan);
    } catch (poolErr: any) {
      return res.status(400).json({ pesan: poolErr.message });
    }

    if (targetMode === 'multi') {
      const token = await generateTokenUnikSemuaGame();
      const baseUrl = getNetworkBaseUrl(req);
      const joinUrl = `${baseUrl}/main?token=${token}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });

      const session = await prisma.session.create({
        data: {
          templateId: template.id,
          hostId: req.user!.id,
          mode: 'multi',
          token,
          status: 'lobi',
          konfigurasi: JSON.stringify({
            playMode: 'MULTIPLAYER',
            config: configTarik,
          }),
        },
      });

      const activeSession = multiManager.inisialisasiSesi(
        session.id,
        token,
        req.user!.id,
        { id: template.id, judul: template.judul },
        mappedQuestions,
        configTarik
      );

      return res.status(201).json({
        pesan: 'Sesi Tarik Tambang Multiplayer berhasil dibuat.',
        session: {
          id: session.id,
          game: 'tarik_tambang',
          mode: 'multi',
          playMode: 'MULTIPLAYER',
          token,
          qrDataUrl,
          joinUrl,
          networkUrl: baseUrl,
          templateId: template.id,
          templateJudul: template.judul,
          status: 'lobi',
          totalSoal: activeSession.totalSoal,
          config: activeSession.config,
        },
      });
    }

    // Mode Solo — Local 1 vs 1 (tanpa token/PIN/QR/lobi)
    const shouldAutoStart = parsed.autoStart === true;
    const session = await prisma.session.create({
      data: {
        templateId: template.id,
        hostId: req.user!.id,
        mode: 'solo',
        token: null,
        status: shouldAutoStart ? 'jalan' : 'lobi',
        mulaiPada: shouldAutoStart ? new Date() : null,
        konfigurasi: JSON.stringify({
          playMode: 'SOLO',
          config: configTarik,
        }),
      },
    });

    const activeSession = soloManager.inisialisasiSesi(
      session.id,
      req.user!.id,
      { id: template.id, judul: template.judul },
      mappedQuestions,
      configTarik
    );

    if (shouldAutoStart) {
      soloManager.mulaiSesi(session.id, req.user!.id);
    }

    return res.status(201).json({
      pesan: shouldAutoStart
        ? 'Permainan Solo 1 vs 1 dimulai!'
        : 'Sesi Tarik Tambang Solo berhasil dibuat.',
      session: {
        id: session.id,
        ...soloManager.serialisasiUntukClient(activeSession),
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ pesan: err.issues[0]?.message || 'Input tidak valid.' });
    }
    return res.status(500).json({ pesan: err.message || 'Gagal membuat sesi permainan.' });
  }
});

// 4. GET /api/sesi/:id - Ambil detail sesi Solo, Tarik Tambang, Makan Kerupuk, atau Panjat Pinang aktif
sesiRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const resolved = await resolveSessionAnyManager(id);
    if (!resolved) {
      return res.status(404).json({ pesan: 'Sesi permainan tidak ditemukan.' });
    }

    if (resolved.kind === 'balap_solo') {
      const activeBalapSolo = resolved.session;
      if (activeBalapSolo.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      return res.json({
        session: balapKarungSoloManager.serialisasiUntukClient(activeBalapSolo),
      });
    }

    if (resolved.kind === 'balap_multi') {
      const activeBalap = resolved.session;
      if (activeBalap.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      const baseUrl = getNetworkBaseUrl(req);
      const joinUrl = `${baseUrl}/main?token=${activeBalap.token}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });
      const leaderboard = balapKarungManager.dapatkanLeaderboard(activeBalap.sessionId);
      const teams = balapKarungManager.dapatkanRingkasanTim(activeBalap.sessionId);

      return res.json({
        session: {
          sessionId: activeBalap.sessionId,
          game: 'balap_karung',
          mode: 'multi',
          token: activeBalap.token,
          qrDataUrl,
          joinUrl,
          networkUrl: baseUrl,
          templateId: activeBalap.templateId,
          templateJudul: activeBalap.templateJudul,
          status: activeBalap.status,
          totalSoal: activeBalap.totalSoal,
          totalPeserta: activeBalap.peserta.size,
          config: activeBalap.config,
          teams,
          timPemenang: activeBalap.timPemenang,
          leaderboard,
          daftarPeserta: leaderboard,
          isFinished: activeBalap.status === 'selesai',
          hasil: activeBalap.hasil || null,
        },
      });
    }

    if (resolved.kind === 'panjat_solo') {
      const activePanjatSolo = resolved.session;
      if (activePanjatSolo.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      return res.json({
        session: panjatPinangSoloManager.serialisasiUntukClient(activePanjatSolo),
      });
    }

    if (resolved.kind === 'panjat_multi') {
      const activePanjat = resolved.session;
      if (activePanjat.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      const baseUrl = getNetworkBaseUrl(req);
      const joinUrl = `${baseUrl}/main?token=${activePanjat.token}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });
      const leaderboard = panjatPinangManager.dapatkanLeaderboard(activePanjat.sessionId);

      return res.json({
        session: {
          sessionId: activePanjat.sessionId,
          game: 'panjat_pinang',
          mode: 'multi',
          token: activePanjat.token,
          qrDataUrl,
          joinUrl,
          networkUrl: baseUrl,
          templateId: activePanjat.templateId,
          templateJudul: activePanjat.templateJudul,
          status: activePanjat.status,
          totalSoal: activePanjat.totalSoal,
          totalPeserta: activePanjat.peserta.size,
          config: activePanjat.config,
          leaderboard,
          daftarPeserta: leaderboard,
          isFinished: activePanjat.status === 'selesai',
          hasil: activePanjat.hasil || null,
        },
      });
    }

    if (resolved.kind === 'kerupuk_multi') {
      const activeKerupukMulti = resolved.session;
      if (activeKerupukMulti.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      const baseUrl = getNetworkBaseUrl(req);
      const joinUrl = `${baseUrl}/main?token=${activeKerupukMulti.token}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });
      const leaderboard = kerupukMultiManager.dapatkanLeaderboard(activeKerupukMulti.sessionId);

      return res.json({
        session: {
          sessionId: activeKerupukMulti.sessionId,
          game: 'makan_kerupuk',
          mode: 'multi',
          playMode: 'MULTIPLAYER',
          token: activeKerupukMulti.token,
          qrDataUrl,
          joinUrl,
          networkUrl: baseUrl,
          templateId: activeKerupukMulti.templateId,
          templateJudul: activeKerupukMulti.templateJudul,
          status: activeKerupukMulti.status,
          totalSoalBank: activeKerupukMulti.questions.length,
          totalSoal: activeKerupukMulti.questions.length,
          totalPeserta: activeKerupukMulti.peserta.size,
          config: activeKerupukMulti.config,
          leaderboard,
          daftarPeserta: leaderboard,
          isFinished: activeKerupukMulti.status === 'selesai',
          hasil: activeKerupukMulti.hasil || null,
        },
      });
    }

    if (resolved.kind === 'kerupuk_solo') {
      const activeKerupuk = resolved.session;
      if (activeKerupuk.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      return res.json({
        session: kerupukManager.serialisasiSesiUntukClient(activeKerupuk),
      });
    }

    if (resolved.kind === 'tarik_multi') {
      const activeMulti = resolved.session;
      if (activeMulti.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      const baseUrl = getNetworkBaseUrl(req);
      const joinUrl = `${baseUrl}/main?token=${activeMulti.token}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });
      return res.json({
        session: serializeMultiTarikSession(activeMulti, qrDataUrl, joinUrl, baseUrl),
      });
    }

    const activeSession = resolved.session;
    if (activeSession.hostId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
    }

    return res.json({
      session: soloManager.serialisasiUntukClient(activeSession),
    });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal memuat detail sesi.' });
  }
});

// 5. POST /api/sesi/:id/mulai - Mulai permainan Solo (Tarik Tambang atau Makan Kerupuk)
sesiRouter.post('/:id/mulai', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const resolved = await resolveSessionAnyManager(id);

    if (resolved?.kind === 'panjat_solo') {
      const kesulitanBotReq = req.body?.kesulitanBot as 'santai' | 'sedang' | 'cepat' | 'mudah' | 'sulit' | undefined;
      if (kesulitanBotReq) {
        const mappedBot =
          kesulitanBotReq === 'mudah'
            ? 'santai'
            : kesulitanBotReq === 'sulit'
              ? 'cepat'
              : kesulitanBotReq;
        panjatPinangSoloManager.ubahKesulitanBot(id, req.user!.id, mappedBot);
      }
      const sesiPanjatSolo = panjatPinangSoloManager.mulaiSesi(id, req.user!.id);
      return res.json({
        pesan: 'Permainan Panjat Pinang Solo 1 vs 1 dimulai.',
        session: panjatPinangSoloManager.serialisasiUntukClient(sesiPanjatSolo),
      });
    }

    if (resolved?.kind === 'balap_solo') {
      const kesulitanBotReq = req.body?.kesulitanBot as 'santai' | 'sedang' | 'cepat' | 'mudah' | 'sulit' | undefined;
      const sesiBalapSolo = balapKarungSoloManager.mulaiSesi(id, req.user!.id, {
        kesulitanBot: kesulitanBotReq,
      });
      await prisma.session.update({
        where: { id },
        data: {
          status: 'jalan',
          mulaiPada: new Date(),
          konfigurasi: JSON.stringify({
            playMode: 'SOLO',
            config: sesiBalapSolo.config,
          }),
        },
      });
      return res.json({
        pesan: 'Permainan Balap Karung Solo 1 vs 1 dimulai.',
        session: balapKarungSoloManager.serialisasiUntukClient(sesiBalapSolo),
      });
    }

    if (resolved?.kind === 'kerupuk_solo') {
      const sesiKerupuk = kerupukManager.mulaiPermainan(id, req.user!.id);
      await prisma.session.update({
        where: { id },
        data: { status: 'jalan', mulaiPada: new Date() },
      });
      return res.json({
        pesan: 'Permainan Makan Kerupuk Challenge dimulai.',
        session: kerupukManager.serialisasiSesiUntukClient(sesiKerupuk),
      });
    }

    if (resolved?.kind === 'tarik_multi') {
      return res
        .status(400)
        .json({ pesan: 'Sesi Multiplayer harus dimulai melalui ruang lobi realtime.' });
    }
    if (resolved?.kind !== 'tarik_solo' || !soloManager.dapatkanSesi(id, req.user!.id)) {
      return res.status(404).json({ pesan: 'Sesi permainan tidak ditemukan.' });
    }

    const sesi = soloManager.mulaiSesi(id, req.user!.id);

    // Update status di DB menjadi 'jalan'
    await prisma.session.update({
      where: { id },
      data: {
        status: 'jalan',
        mulaiPada: new Date(),
      },
    });

    return res.json({
      pesan: 'Permainan Solo 1 vs 1 dimulai.',
      session: soloManager.serialisasiUntukClient(sesi),
    });
  } catch (err: any) {
    return res.status(400).json({ pesan: err.message || 'Gagal memulai permainan.' });
  }
});

// 5b. PATCH /api/sesi/:id/pengaturan - Update cepat pengaturan Balap Karung sebelum dimulai (Bot / Jumlah Tim)
const pengaturanBalapSchema = z
  .object({
    kesulitanBot: z.enum(['santai', 'sedang', 'cepat', 'mudah', 'sulit']).optional(),
    jumlahTim: z.union([z.literal(3), z.literal(4)]).optional(),
  })
  .refine((v) => Boolean(v.kesulitanBot || v.jumlahTim), {
    message: 'Minimal sertakan kesulitanBot atau jumlahTim.',
  });

sesiRouter.patch('/:id/pengaturan', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { kesulitanBot, jumlahTim } = pengaturanBalapSchema.parse(req.body);

    const activeSoloPanjat =
      panjatPinangSoloManager.dapatkanSesi(id) ||
      (await panjatPinangSoloManager.pulihkanSesiDariDb(id));
    if (activeSoloPanjat && kesulitanBot) {
      const mappedBot =
        kesulitanBot === 'mudah'
          ? 'santai'
          : kesulitanBot === 'sulit'
            ? 'cepat'
            : kesulitanBot;
      const updatedSoloPanjat = panjatPinangSoloManager.ubahKesulitanBot(
        id,
        req.user!.id,
        mappedBot
      );
      return res.json({
        pesan: 'Kesulitan Bot diperbarui.',
        session: panjatPinangSoloManager.serialisasiUntukClient(updatedSoloPanjat),
      });
    }

    const activeSolo =
      balapKarungSoloManager.dapatkanSesi(id) ||
      (await balapKarungSoloManager.pulihkanSesiDariDb(id));
    if (activeSolo && kesulitanBot) {
      const updatedSolo = balapKarungSoloManager.ubahKesulitanBot(
        id,
        req.user!.id,
        kesulitanBot
      );
      await prisma.session.update({
        where: { id },
        data: {
          konfigurasi: JSON.stringify({
            playMode: 'SOLO',
            config: updatedSolo.config,
          }),
        },
      });
      return res.json({
        pesan: 'Kesulitan Bot diperbarui.',
        session: balapKarungSoloManager.serialisasiUntukClient(updatedSolo),
      });
    }

    const activeMulti =
      balapKarungManager.dapatkanSesi(id) ||
      (await balapKarungManager.pulihkanSesiDariDb(id));
    if (activeMulti && (jumlahTim === 3 || jumlahTim === 4)) {
      const updatedMulti = await balapKarungManager.ubahJumlahTim(
        id,
        req.user!.id,
        jumlahTim
      );
      return res.json({
        pesan: `Jumlah tim diperbarui menjadi ${jumlahTim} tim.`,
        config: updatedMulti.sesi.config,
        teams: updatedMulti.teams,
        leaderboard: updatedMulti.leaderboard,
      });
    }

    const activeKerupukMulti = kerupukMultiManager.dapatkanSesi(id);
    if (activeKerupukMulti && (jumlahTim === 3 || jumlahTim === 4)) {
      const updatedKerupuk = await kerupukMultiManager.ubahJumlahTim(
        id,
        req.user!.id,
        jumlahTim
      );
      return res.json({
        pesan: `Jumlah tim diperbarui menjadi ${jumlahTim} tim.`,
        config: updatedKerupuk.sesi.config,
        leaderboard: updatedKerupuk.leaderboard,
      });
    }

    return res.status(404).json({ pesan: 'Sesi atau pengaturan yang diminta tidak ditemukan.' });
  } catch (err: any) {
    return res.status(400).json({ pesan: err.message || 'Gagal memperbarui pengaturan sesi.' });
  }
});

// 6. POST /api/sesi/:id/state - Pause / Resume permainan
const stateSchema = z.object({
  state: z.enum(['PLAYING', 'PAUSED']),
});

sesiRouter.post('/:id/state', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { state } = stateSchema.parse(req.body);
    const resolved = await resolveSessionAnyManager(id);

    if (resolved?.kind === 'panjat_solo') {
      const sesiPanjatSolo = panjatPinangSoloManager.ubahStateSesi(
        id,
        req.user!.id,
        state === 'PAUSED' ? 'pause' : 'resume'
      );
      return res.json({
        pesan: `Permainan berhasil di-${state === 'PAUSED' ? 'jeda' : 'lanjutkan'}.`,
        state: sesiPanjatSolo.state,
        session: panjatPinangSoloManager.serialisasiUntukClient(sesiPanjatSolo),
      });
    }

    if (resolved?.kind === 'balap_solo') {
      const sesiBalapSolo = balapKarungSoloManager.ubahStateSesi(id, req.user!.id, state);
      return res.json({
        pesan: `Permainan berhasil di-${state === 'PAUSED' ? 'jeda' : 'lanjutkan'}.`,
        state: sesiBalapSolo.state,
        session: balapKarungSoloManager.serialisasiUntukClient(sesiBalapSolo),
      });
    }

    if (resolved?.kind === 'kerupuk_solo') {
      const sesiKerupuk = kerupukManager.ubahStatePermainan(id, req.user!.id, state);
      return res.json({
        pesan: `Permainan berhasil di-${state === 'PAUSED' ? 'jeda' : 'lanjutkan'}.`,
        state: sesiKerupuk.state,
        session: kerupukManager.serialisasiSesiUntukClient(sesiKerupuk),
      });
    }

    if (resolved?.kind === 'balap_multi') {
      const io = getSesiIO();
      if (state === 'PAUSED') {
        balapKarungManager.jedaPermainan(id, req.user!.id);
        io?.to(`session:${id}`).emit('game:jeda', {
          game: 'balap_karung',
          sessionId: id,
          status: 'jeda',
          serverTime: Date.now(),
          pesan: 'Permainan dijeda oleh Guru.',
        });
      } else {
        const { pauseDuration } = balapKarungManager.lanjutPermainan(id, req.user!.id);
        io?.to(`session:${id}`).emit('game:lanjut', {
          game: 'balap_karung',
          sessionId: id,
          status: 'jalan',
          pauseDuration,
          serverTime: Date.now(),
          pesan: 'Permainan dilanjutkan.',
        });
      }
      return res.json({
        pesan: `Permainan berhasil di-${state === 'PAUSED' ? 'jeda' : 'lanjutkan'}.`,
        status: state === 'PAUSED' ? 'jeda' : 'jalan',
        isPaused: state === 'PAUSED',
      });
    }

    if (resolved?.kind === 'panjat_multi') {
      const io = getSesiIO();
      if (state === 'PAUSED') {
        panjatPinangManager.jedaPermainan(id, req.user!.id);
        io?.to(`session:${id}`).emit('game:jeda', {
          game: 'panjat_pinang',
          sessionId: id,
          status: 'jeda',
          serverTime: Date.now(),
          pesan: 'Permainan dijeda oleh Guru.',
        });
      } else {
        const { pauseDuration } = panjatPinangManager.lanjutPermainan(id, req.user!.id);
        io?.to(`session:${id}`).emit('game:lanjut', {
          game: 'panjat_pinang',
          sessionId: id,
          status: 'jalan',
          pauseDuration,
          serverTime: Date.now(),
          pesan: 'Permainan dilanjutkan.',
        });
      }
      return res.json({
        pesan: `Permainan berhasil di-${state === 'PAUSED' ? 'jeda' : 'lanjutkan'}.`,
        status: state === 'PAUSED' ? 'jeda' : 'jalan',
        isPaused: state === 'PAUSED',
      });
    }

    if (resolved?.kind === 'kerupuk_multi') {
      const io = getSesiIO();
      if (state === 'PAUSED') {
        kerupukMultiManager.jedaPermainan(id, req.user!.id);
        io?.to(`session:${id}`).emit('game:jeda', {
          game: 'makan_kerupuk',
          sessionId: id,
          status: 'jeda',
          serverTime: Date.now(),
          pesan: 'Permainan dijeda oleh Guru.',
        });
      } else {
        const { pauseDuration } = kerupukMultiManager.lanjutPermainan(id, req.user!.id);
        io?.to(`session:${id}`).emit('game:lanjut', {
          game: 'makan_kerupuk',
          sessionId: id,
          status: 'jalan',
          pauseDuration,
          serverTime: Date.now(),
          pesan: 'Permainan dilanjutkan.',
        });
      }
      return res.json({
        pesan: `Permainan berhasil di-${state === 'PAUSED' ? 'jeda' : 'lanjutkan'}.`,
        status: state === 'PAUSED' ? 'jeda' : 'jalan',
        isPaused: state === 'PAUSED',
      });
    }

    if (resolved?.kind === 'tarik_multi') {
      const io = getSesiIO();
      if (state === 'PAUSED') {
        multiManager.jedaPermainan(id, req.user!.id);
        io?.to(`session:${id}`).emit('game:jeda', {
          game: 'tarik_tambang',
          sessionId: id,
          status: 'jeda',
          serverTime: Date.now(),
          pesan: 'Permainan dijeda oleh Guru.',
        });
      } else {
        const { pauseDuration } = multiManager.lanjutPermainan(id, req.user!.id);
        io?.to(`session:${id}`).emit('game:lanjut', {
          game: 'tarik_tambang',
          sessionId: id,
          status: 'jalan',
          pauseDuration,
          matchEndsAt: resolved.session.matchEndsAtMs,
          serverTime: Date.now(),
          pesan: 'Permainan dilanjutkan.',
        });
      }
      return res.json({
        pesan: `Permainan berhasil di-${state === 'PAUSED' ? 'jeda' : 'lanjutkan'}.`,
        status: state === 'PAUSED' ? 'jeda' : 'jalan',
        isPaused: state === 'PAUSED',
      });
    }

    const sesi = soloManager.ubahStateSesi(id, req.user!.id, state);

    return res.json({
      pesan: `Permainan berhasil di-${state === 'PAUSED' ? 'jeda' : 'lanjutkan'}.`,
      state: sesi.state,
      session: soloManager.serialisasiUntukClient(sesi),
    });
  } catch (err: any) {
    return res.status(400).json({ pesan: err.message || 'Gagal mengubah status permainan.' });
  }
});

// 7. POST /api/sesi/:id/jawab - Kirim jawaban Solo (Makan Kerupuk atau Tarik Tambang)
const jawabKerupukSchema = z.object({
  presentationId: z.string().min(1, 'ID presentasi soal wajib disertakan.'),
  choiceId: z.string().min(1, 'ID pilihan jawaban wajib disertakan.'),
  questionId: z.string().optional(),
});

const jawabSchema = z.object({
  tim: z.string().min(1, 'Identitas tim wajib disertakan.'),
  presentationId: z.string().optional(),
  choiceId: z.string().optional(),
  questionId: z.string().optional(),
  jawabanDipilih: z.string().optional(),
  timedOut: z.boolean().optional(),
});

const jawabBalapSoloSchema = z
  .object({
    slot: z.enum(['pemain1', 'pemain2']).default('pemain1'),
    presentationId: z.string().min(1, 'ID presentasi soal wajib disertakan.'),
    choiceId: z.string().optional(),
    questionId: z.string().optional(),
    timedOut: z.boolean().optional(),
  })
  .refine((v) => v.timedOut === true || Boolean(v.choiceId && v.choiceId.trim().length > 0), {
    message: 'ID pilihan jawaban wajib disertakan.',
  });

sesiRouter.post('/:id/jawab', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const resolved = await resolveSessionAnyManager(id);

    if (resolved?.kind === 'panjat_solo') {
      const inputPanjat = jawabBalapSoloSchema.parse(req.body);
      const hasilPanjat = panjatPinangSoloManager.prosesJawaban(id, req.user!.id, {
        slot: inputPanjat.slot,
        presentationId: inputPanjat.presentationId,
        choiceId: inputPanjat.choiceId,
        questionId: inputPanjat.questionId,
        timedOut: Boolean(inputPanjat.timedOut),
      });

      if (hasilPanjat.isFinished) {
        await panjatPinangSoloManager.simpanHasilKeDatabase(hasilPanjat.sesi);
      }

      return res.json({
        game: 'panjat_pinang',
        slot: hasilPanjat.feedback.slot,
        feedback: hasilPanjat.feedback,
        hasilJawaban: hasilPanjat.hasilJawaban,
        isFinished: hasilPanjat.isFinished,
        session: panjatPinangSoloManager.serialisasiUntukClient(hasilPanjat.sesi),
      });
    }

    if (resolved?.kind === 'balap_solo') {
      const inputBalap = jawabBalapSoloSchema.parse(req.body);
      const hasilBalap = balapKarungSoloManager.prosesJawaban(id, req.user!.id, {
        slot: inputBalap.slot,
        presentationId: inputBalap.presentationId,
        choiceId: inputBalap.choiceId,
        questionId: inputBalap.questionId,
        timedOut: Boolean(inputBalap.timedOut),
      });

      if (hasilBalap.selesai) {
        await balapKarungSoloManager.simpanHasilKeDatabase(id);
      }

      return res.json({
        game: 'balap_karung',
        slot: hasilBalap.slot,
        feedback: hasilBalap.feedback,
        hasilJawaban: hasilBalap.hasilJawaban,
        isFinished: hasilBalap.selesai,
        session: balapKarungSoloManager.serialisasiUntukClient(hasilBalap.sesi),
      });
    }

    if (resolved?.kind === 'kerupuk_solo') {
      const inputKerupuk = jawabKerupukSchema.parse(req.body);
      const hasilKerupuk = kerupukManager.prosesJawaban(id, req.user!.id, {
        presentationId: inputKerupuk.presentationId,
        choiceId: inputKerupuk.choiceId,
        questionId: inputKerupuk.questionId,
      });

      if (hasilKerupuk.isFinished) {
        await kerupukManager.simpanHasilKeDatabase(id);
      }

      return res.json({
        game: 'makan_kerupuk',
        benar: hasilKerupuk.benar,
        jawabanBenar: hasilKerupuk.jawabanBenarKode,
        jawabanBenarKode: hasilKerupuk.jawabanBenarKode,
        jawabanBenarTeks: hasilKerupuk.jawabanBenarTeks,
        penjelasan: hasilKerupuk.penjelasan,
        poinDidapat: hasilKerupuk.poinDidapat,
        poinDasar: hasilKerupuk.poinDasar,
        bonusStreak: hasilKerupuk.bonusStreak,
        bonusPenyelesaian: hasilKerupuk.bonusPenyelesaian,
        gacha: hasilKerupuk.gacha,
        sisaKerupuk: hasilKerupuk.sisaKerupuk,
        targetKerupuk: hasilKerupuk.targetKerupuk,
        progresPersen: hasilKerupuk.progresPersen,
        sisaPersen: hasilKerupuk.sisaPersen,
        skorTotal: hasilKerupuk.skorTotal,
        skorPembelajaran: hasilKerupuk.skorPembelajaran,
        bonusKeberuntungan: hasilKerupuk.bonusKeberuntungan,
        bonusPenyelesaianTotal: hasilKerupuk.bonusPenyelesaianTotal,
        streakBenar: hasilKerupuk.streakBenar,
        isFinished: hasilKerupuk.isFinished,
        soalBerikutnya: hasilKerupuk.soalBerikutnya,
        gigitanLogItem: hasilKerupuk.gigitanLogItem,
        session: kerupukManager.serialisasiSesiUntukClient(hasilKerupuk.sesi),
      });
    }

    if (resolved?.kind === 'tarik_multi') {
      return res
        .status(400)
        .json({ pesan: 'Sesi Multiplayer tidak dapat dijawab melalui endpoint Solo.' });
    }

    const input = jawabSchema.parse(req.body);
    const timNorm = normalisasiKodeTim(input.tim);
    if (!timNorm) {
      return res.status(400).json({ pesan: 'Tim tidak valid.' });
    }

    const hasilProses = soloManager.prosesJawaban(id, req.user!.id, {
      tim: timNorm,
      presentationId: input.presentationId,
      choiceId: input.choiceId,
      questionId: input.questionId,
      jawabanDipilih: input.jawabanDipilih,
      timedOut: Boolean(input.timedOut),
    });

    const { sesi, tim, benar, sudahMenjawab, rondeSelesai, hasilRonde, feedback, selesai } = hasilProses;

    if (selesai) {
      await soloManager.simpanHasilKeDatabase(sesi);
    }

    return res.json({
      game: 'tarik_tambang',
      tim,
      benar,
      sudahMenjawab,
      rondeSelesai,
      hasilRonde,
      feedback,
      taliPosition: sesi.taliPosition,
      skorMerah: sesi.skorMerah,
      skorPutih: sesi.skorPutih,
      isFinished: selesai,
      winner: sesi.hasil?.timMenang || null,
      session: soloManager.serialisasiUntukClient(sesi),
    });
  } catch (err: any) {
    return res.status(400).json({ pesan: err.message || 'Gagal memproses jawaban.' });
  }
});

// 7b. POST /api/sesi/:id/tutup-ronde - Tutup ronde Solo 1 vs 1 saat waktu habis / evaluasi manual
sesiRouter.post('/:id/tutup-ronde', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    if ((await cekMultiAtauPulihkanSoloTarik(id, req.user!.id)) === 'MULTI') {
      return res
        .status(400)
        .json({ pesan: 'Ronde Multiplayer dikendalikan otomatis oleh server.' });
    }
    const { sesi, hasilRonde, selesai } = soloManager.tutupRonde(id, req.user!.id);
    if (selesai) {
      await soloManager.simpanHasilKeDatabase(sesi);
    }
    return res.json({
      pesan: 'Ronde berhasil ditutup dan dievaluasi.',
      hasilRonde,
      isFinished: selesai,
      session: soloManager.serialisasiUntukClient(sesi),
    });
  } catch (err: any) {
    return res.status(400).json({ pesan: err.message || 'Gagal menutup ronde.' });
  }
});

// 7c. POST /api/sesi/:id/lanjut-ronde - Lanjut ke ronde berikutnya pada Solo 1 vs 1
sesiRouter.post('/:id/lanjut-ronde', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    if ((await cekMultiAtauPulihkanSoloTarik(id, req.user!.id)) === 'MULTI') {
      return res
        .status(400)
        .json({ pesan: 'Ronde Multiplayer berlanjut otomatis melalui ruang realtime.' });
    }
    const sesi = soloManager.lanjutRondeBerikutnya(id, req.user!.id);
    return res.json({
      pesan: 'Ronde berikutnya dimulai.',
      isFinished: sesi.state === 'FINISHED',
      session: soloManager.serialisasiUntukClient(sesi),
    });
  } catch (err: any) {
    return res.status(400).json({ pesan: err.message || 'Gagal melanjutkan ke ronde berikutnya.' });
  }
});

// 7d. POST /api/sesi/:id/powerup - Aktifkan power-up tim pada Solo 1 vs 1
const powerUpSchema = z.object({
  tim: z.string().min(1, 'Tim wajib diisi.'),
});

sesiRouter.post('/:id/powerup', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { tim: timRaw } = powerUpSchema.parse(req.body);
    if ((await cekMultiAtauPulihkanSoloTarik(id, req.user!.id)) === 'MULTI') {
      return res
        .status(400)
        .json({ pesan: 'Power-up Multiplayer diaktifkan melalui Socket.IO siswa.' });
    }
    const hasil = soloManager.aktifkanPowerUp(id, req.user!.id, timRaw);
    return res.json({
      pesan: 'Power-up berhasil diaktifkan untuk ronde berikutnya.',
      tim: hasil.tim,
      powerUp: hasil.powerUp,
      session: soloManager.serialisasiUntukClient(hasil.sesi),
    });
  } catch (err: any) {
    return res.status(400).json({ pesan: err.message || 'Gagal mengaktifkan power-up.' });
  }
});

// 7e. POST /api/sesi/:id/bot-langkah - Jalankan 1 langkah Bot AI pada Solo vs Bot (Balap Karung / Tarik Tambang)
sesiRouter.post('/:id/bot-langkah', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const resolved = await resolveSessionAnyManager(id);
    if (resolved?.kind === 'panjat_solo') {
      const resBot = panjatPinangSoloManager.jalankanLangkahBot(id, req.user!.id);
      if (resBot.isFinished) {
        await panjatPinangSoloManager.simpanHasilKeDatabase(resBot.sesi);
      }

      return res.json({
        executed: resBot.acted,
        feedback: resBot.feedback,
        isFinished: resBot.isFinished,
        session: panjatPinangSoloManager.serialisasiUntukClient(resBot.sesi),
      });
    }

    if (resolved?.kind === 'balap_solo') {
      const resBot = balapKarungSoloManager.jalankanLangkahBot(id, req.user!.id);
      if (resBot.selesai) {
        await balapKarungSoloManager.simpanHasilKeDatabase(id);
      }

      return res.json({
        executed: resBot.executed,
        feedback: resBot.feedback,
        isFinished: resBot.selesai,
        session: balapKarungSoloManager.serialisasiUntukClient(resBot.sesi),
      });
    }

    if (resolved?.kind !== 'tarik_solo' || resolved.session.hostId !== req.user!.id) {
      return res.status(404).json({ pesan: 'Sesi Solo vs Bot tidak ditemukan.' });
    }

    const resBotTarik = soloManager.jalankanLangkahBot(id, req.user!.id);
    if (resBotTarik.selesai) {
      await soloManager.simpanHasilKeDatabase(resBotTarik.sesi);
    }

    return res.json({
      executed: resBotTarik.executed,
      chosenChoiceId: resBotTarik.chosenChoiceId,
      feedback: resBotTarik.feedback,
      isFinished: resBotTarik.selesai,
      session: soloManager.serialisasiUntukClient(resBotTarik.sesi),
    });
  } catch (err: any) {
    return res.status(400).json({ pesan: err.message || 'Gagal menjalankan langkah bot.' });
  }
});

// 8. POST /api/sesi/:id/selesai - Akhiri permainan secara manual oleh guru
sesiRouter.post('/:id/selesai', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const resolved = await resolveSessionAnyManager(id);

    if (resolved?.kind === 'panjat_solo') {
      const sesiPanjatSolo = panjatPinangSoloManager.hentikanPermainan(id, req.user!.id);
      await panjatPinangSoloManager.simpanHasilKeDatabase(sesiPanjatSolo);
      return res.json({
        pesan: 'Permainan Panjat Pinang Solo berhasil dihentikan.',
        hasil: sesiPanjatSolo.hasil,
        session: panjatPinangSoloManager.serialisasiUntukClient(sesiPanjatSolo),
      });
    }

    if (resolved?.kind === 'balap_solo') {
      const sesiBalapSolo = balapKarungSoloManager.hentikanPermainan(id, req.user!.id);
      await balapKarungSoloManager.simpanHasilKeDatabase(id);
      return res.json({
        pesan: 'Permainan Balap Karung Solo berhasil dihentikan.',
        hasil: sesiBalapSolo.hasil,
        session: balapKarungSoloManager.serialisasiUntukClient(sesiBalapSolo),
      });
    }

    if (resolved?.kind === 'kerupuk_solo') {
      const sesiKerupuk = kerupukManager.hentikanPermainan(id, req.user!.id);
      await kerupukManager.simpanHasilKeDatabase(id);
      return res.json({
        pesan: 'Permainan Makan Kerupuk berhasil dihentikan.',
        hasil: sesiKerupuk.hasil,
        session: kerupukManager.serialisasiSesiUntukClient(sesiKerupuk),
      });
    }

    if (resolved?.kind === 'tarik_multi') {
      return res
        .status(400)
        .json({ pesan: 'Sesi Multiplayer harus diakhiri melalui ruang lobi realtime.' });
    }

    const sesi = soloManager.selesaikanSesi(id, req.user!.id);

    await soloManager.simpanHasilKeDatabase(sesi);

    return res.json({
      pesan: 'Permainan berhasil diakhiri.',
      hasil: sesi.hasil,
      session: soloManager.serialisasiUntukClient(sesi),
    });
  } catch (err: any) {
    return res.status(400).json({ pesan: err.message || 'Gagal mengakhiri permainan.' });
  }
});

// 8b. POST /api/sesi/:id/ulang - Mulai ulang sesi Makan Kerupuk / Balap Karung Solo ke READY bersih
sesiRouter.post('/:id/ulang', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const resolved = await resolveSessionAnyManager(id);

    if (resolved?.kind === 'panjat_solo') {
      const activePanjatSolo = resolved.session;
      if (activePanjatSolo.state === 'FINISHED' || activePanjatSolo.state === 'STOPPED') {
        return res.status(400).json({
          pesan:
            'Sesi yang sudah selesai tidak dapat direset in-place agar riwayat tetap terjaga. Gunakan Main Lagi untuk membuat sesi baru.',
        });
      }

      const sesiReset = await panjatPinangSoloManager.ulangPermainan(id, req.user!.id);
      return res.json({
        pesan: 'Permainan Panjat Pinang Solo dikembalikan ke posisi awal (READY).',
        session: panjatPinangSoloManager.serialisasiUntukClient(sesiReset),
      });
    }

    if (resolved?.kind === 'balap_solo') {
      const activeBalapSolo = resolved.session;
      if (activeBalapSolo.state === 'FINISHED' || activeBalapSolo.state === 'STOPPED') {
        return res.status(400).json({
          pesan:
            'Sesi yang sudah selesai tidak dapat direset in-place agar riwayat tetap terjaga. Gunakan Main Lagi untuk membuat sesi baru.',
        });
      }

      const sesiReset = balapKarungSoloManager.ulangPermainan(id, req.user!.id);
      await prisma.session.update({
        where: { id },
        data: {
          status: 'lobi',
          mulaiPada: null,
          selesaiPada: null,
        },
      });

      return res.json({
        pesan: 'Permainan Balap Karung Solo dikembalikan ke posisi awal (READY).',
        session: balapKarungSoloManager.serialisasiUntukClient(sesiReset),
      });
    }

    if (resolved?.kind !== 'kerupuk_solo') {
      if (resolved?.kind !== 'tarik_solo' || resolved.session.hostId !== req.user!.id) {
        return res.status(404).json({ pesan: 'Sesi Solo tidak ditemukan.' });
      }
      const activeTarikSolo = resolved.session;
      if (activeTarikSolo.state === 'FINISHED') {
        return res.status(400).json({
          pesan:
            'Sesi yang sudah selesai tidak dapat direset in-place agar riwayat tetap terjaga. Gunakan Main Lagi untuk membuat sesi baru.',
        });
      }
      const autoStart = req.body?.autoStart === true;
      const sesiReset = soloManager.ulangPermainan(id, req.user!.id, autoStart);
      await prisma.session.update({
        where: { id },
        data: {
          status: autoStart ? 'jalan' : 'lobi',
          mulaiPada: autoStart ? new Date() : null,
          selesaiPada: null,
        },
      });
      return res.json({
        pesan: 'Permainan Tarik Tambang Solo dikembalikan ke posisi awal.',
        session: soloManager.serialisasiUntukClient(sesiReset),
      });
    }

    const activeKerupuk = resolved.session;

    if (activeKerupuk.state === 'FINISHED' || activeKerupuk.state === 'STOPPED') {
      return res.status(400).json({
        pesan:
          'Sesi yang sudah selesai tidak dapat direset in-place agar riwayat tetap terjaga. Gunakan Main Lagi untuk membuat sesi baru.',
      });
    }

    const autoStart = req.body?.autoStart === true;
    const sesiReset = kerupukManager.ulangPermainan(id, req.user!.id, autoStart);
    await prisma.session.update({
      where: { id },
      data: {
        status: autoStart ? 'jalan' : 'lobi',
        mulaiPada: autoStart ? new Date() : null,
        selesaiPada: null,
        konfigurasi: JSON.stringify(sesiReset.config),
      },
    });

    return res.json({
      pesan: 'Permainan Makan Kerupuk dikembalikan ke posisi awal (READY).',
      session: kerupukManager.serialisasiSesiUntukClient(sesiReset),
    });
  } catch (err: any) {
    return res.status(400).json({ pesan: err.message || 'Gagal mengulang permainan.' });
  }
});

// 9. GET /api/sesi/:id/hasil - Ambil hasil permainan Solo, Makan Kerupuk, atau Panjat Pinang
sesiRouter.get('/:id/hasil', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    // 0a. Cek Balap Karung Solo (memori)
    const activeBalapSolo = balapKarungSoloManager.dapatkanSesi(id);
    if (activeBalapSolo && activeBalapSolo.hasil) {
      if (activeBalapSolo.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      return res.json({
        hasil: {
          ...activeBalapSolo.hasil,
          game: 'balap_karung',
        },
      });
    }

    // 0b. Cek Balap Karung Challenge (memori atau database)
    const activeBalap = balapKarungManager.dapatkanSesi(id);
    if (activeBalap) {
      if (activeBalap.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      const laporan =
        activeBalap.hasil || balapKarungManager.dapatkanLaporanSementara(activeBalap.sessionId);
      if (laporan) {
        return res.json({
          hasil: {
            ...laporan,
            game: 'balap_karung',
          },
        });
      }
    }

    // 0. Cek Panjat Pinang (memori atau database)
    const activePanjatSolo = panjatPinangSoloManager.dapatkanSesi(id);
    if (activePanjatSolo) {
      if (activePanjatSolo.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      const serialized = panjatPinangSoloManager.serialisasiUntukClient(activePanjatSolo);
      const laporan =
        serialized.hasil ||
        (await panjatPinangSoloManager.muatLaporanDariDatabase(activePanjatSolo.sessionId));
      if (laporan) {
        return res.json({
          hasil: {
            ...laporan,
            game: 'panjat_pinang',
            questionStats: serialized.questionStats,
          },
        });
      }
    }

    const activePanjat = panjatPinangManager.dapatkanSesi(id);
    if (activePanjat) {
      if (activePanjat.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      const laporan =
        activePanjat.hasil || panjatPinangManager.dapatkanLaporanSementara(activePanjat.sessionId);
      if (laporan) {
        return res.json({
          hasil: {
            ...laporan,
            game: 'panjat_pinang',
          },
        });
      }
    }

    // A1. Cek di memori kerupukMultiManager (Makan Kerupuk Mode Multiplayer)
    const activeKerupukMulti = kerupukMultiManager.dapatkanSesi(id);
    if (activeKerupukMulti) {
      if (activeKerupukMulti.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      if (activeKerupukMulti.hasil) {
        return res.json({
          hasil: {
            ...activeKerupukMulti.hasil,
            game: 'makan_kerupuk',
          },
        });
      }
    }

    // A2. Cek di memori kerupukManager (Makan Kerupuk Mode Solo)
    const activeKerupuk = kerupukManager.dapatkanSesi(id);
    if (activeKerupuk) {
      if (activeKerupuk.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      if (activeKerupuk.hasil) {
        return res.json({
          hasil: {
            ...activeKerupuk.hasil,
            game: 'makan_kerupuk',
          },
        });
      }
    }

    // B1. Cek di memori multiManager (Tarik Tambang Multiplayer)
    const activeMulti = multiManager.dapatkanSesi(id);
    if (activeMulti) {
      if (activeMulti.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      if (activeMulti.status === 'selesai' && activeMulti.hasil) {
        return res.json({
          hasil: {
            ...activeMulti.hasil,
            game: 'tarik_tambang',
          },
        });
      }
    }

    // B2. Cek di memori soloManager (Tarik Tambang Solo)
    const activeSession = soloManager.dapatkanSesi(id, req.user!.id);
    if (activeSession && activeSession.state === 'FINISHED' && activeSession.hasil) {
      return res.json({
        hasil: {
          ...activeSession.hasil,
          game: 'tarik_tambang',
        },
      });
    }

    // Ambil dari database jika di memori sudah tidak ada
    const sessionDb = await prisma.session.findUnique({
      where: { id },
      include: {
        template: {
          include: { questions: { orderBy: { urutan: 'asc' } } },
        },
        result: true,
        questionStats: {
          include: { question: true },
        },
      },
    });

    if (!sessionDb) {
      return res.status(404).json({ pesan: 'Sesi permainan tidak ditemukan.' });
    }

    if (sessionDb.hostId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
    }

    if (sessionDb.status !== 'selesai' || !sessionDb.result) {
      return res.status(400).json({ pesan: 'Sesi ini belum memiliki hasil akhir.' });
    }

    if (sessionDb.template.game === 'makan_kerupuk') {
      const laporanDb =
        sessionDb.mode === 'multi'
          ? await kerupukMultiManager.muatLaporanDariDatabase(sessionDb.id)
          : await kerupukManager.muatLaporanDariDatabase(sessionDb.id);
      if (laporanDb) {
        return res.json({
          hasil: {
            ...laporanDb,
            game: 'makan_kerupuk',
            questionStats: sessionDb.questionStats.map((qs) => ({
              questionId: qs.questionId,
              nomorSoal: qs.question.urutan,
              teksSoal: qs.question.teks,
              jumlahBenar: qs.jumlahBenar,
              jumlahSalah: qs.jumlahSalah,
            })),
          },
        });
      }
    }

    if (sessionDb.template.game === 'balap_karung') {
      const laporanDb =
        sessionDb.mode === 'solo'
          ? await balapKarungSoloManager.muatLaporanDariDatabase(sessionDb.id)
          : await balapKarungManager.muatLaporanDariDatabase(sessionDb.id);
      if (laporanDb) {
        return res.json({
          hasil: {
            ...laporanDb,
            game: 'balap_karung',
            questionStats: sessionDb.questionStats.map((qs) => ({
              questionId: qs.questionId,
              nomorSoal: qs.question.urutan,
              teksSoal: qs.question.teks,
              jumlahBenar: qs.jumlahBenar,
              jumlahSalah: qs.jumlahSalah,
            })),
          },
        });
      }
    }

    if (sessionDb.template.game === 'panjat_pinang') {
      const laporanDb =
        sessionDb.mode === 'solo'
          ? await panjatPinangSoloManager.muatLaporanDariDatabase(sessionDb.id)
          : await panjatPinangManager.muatLaporanDariDatabase(sessionDb.id);
      if (laporanDb) {
        return res.json({
          hasil: {
            ...laporanDb,
            game: 'panjat_pinang',
            questionStats: sessionDb.questionStats.map((qs) => ({
              questionId: qs.questionId,
              nomorSoal: qs.question.urutan,
              teksSoal: qs.question.teks,
              jumlahBenar: qs.jumlahBenar,
              jumlahSalah: qs.jumlahSalah,
            })),
          },
        });
      }
    }

    if (sessionDb.template.game === 'tarik_tambang') {
      const laporanDb =
        sessionDb.mode === 'multi'
          ? await multiManager.muatLaporanDariDatabase(sessionDb.id)
          : await soloManager.muatLaporanDariDatabase(sessionDb.id);
      if (laporanDb) {
        return res.json({
          hasil: {
            ...laporanDb,
            game: 'tarik_tambang',
            questionStats: sessionDb.questionStats.map((qs) => ({
              questionId: qs.questionId,
              nomorSoal: qs.question.urutan,
              teksSoal: qs.question.teks,
              jumlahBenar: qs.jumlahBenar,
              jumlahSalah: qs.jumlahSalah,
            })),
          },
        });
      }
    }

    const totalBenar = sessionDb.questionStats.reduce((acc, q) => acc + q.jumlahBenar, 0);
    const totalSalah = sessionDb.questionStats.reduce((acc, q) => acc + q.jumlahSalah, 0);

    return res.json({
      hasil: {
        sessionId: sessionDb.id,
        templateJudul: sessionDb.template.judul,
        templateId: sessionDb.templateId,
        timMenang: sessionDb.result.timMenang,
        posisiAkhir: sessionDb.result.posisiAkhir,
        skorMerah: sessionDb.result.skorMerah,
        skorPutih: sessionDb.result.skorPutih,
        totalSoal: sessionDb.template.questions.length,
        totalBenar,
        totalSalah,
        questionStats: sessionDb.questionStats.map((qs) => ({
          nomorSoal: qs.question.urutan,
          teksSoal: qs.question.teks,
          benar: qs.jumlahBenar > 0,
        })),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal memuat hasil permainan.' });
  }
});

// 10. POST /api/sesi/:id/main-lagi - Buat sesi baru dari template yang sama
sesiRouter.post('/:id/main-lagi', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const sessionLama = await prisma.session.findUnique({
      where: { id },
      include: {
        template: {
          include: { questions: { orderBy: { urutan: 'asc' } } },
        },
      },
    });

    if (!sessionLama) {
      return res.status(404).json({ pesan: 'Sesi lama tidak ditemukan.' });
    }

    if (sessionLama.hostId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak berwenang atas sesi ini.' });
    }

    // Buat sesi baru sesuai game & mode sesi sebelumnya
    if (sessionLama.template.game === 'makan_kerupuk') {
      let configSebelumnya: any;
      if (sessionLama.konfigurasi) {
        try {
          const parsedKonf = JSON.parse(sessionLama.konfigurasi);
          configSebelumnya = parsedKonf?.config || parsedKonf;
        } catch {
          configSebelumnya = undefined;
        }
      }

      if (sessionLama.mode === 'multi') {
        const configSnapshot = bangunKonfigurasiKerupukMulti(configSebelumnya);
        const token = await generateTokenUnikSemuaGame();
        const baseUrl = getNetworkBaseUrl(req);
        const joinUrl = `${baseUrl}/main?token=${token}`;
        const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });

        const sessionBaru = await prisma.session.create({
          data: {
            templateId: sessionLama.templateId,
            hostId: req.user!.id,
            mode: 'multi',
            token,
            status: 'lobi',
            konfigurasi: JSON.stringify({
              playMode: 'MULTIPLAYER',
              config: configSnapshot,
            }),
          },
        });

        kerupukMultiManager.inisialisasiSesi(
          sessionBaru.id,
          token,
          req.user!.id,
          { id: sessionLama.template.id, judul: sessionLama.template.judul },
          sessionLama.template.questions.map(mapDbQuestionForGame),
          configSnapshot
        );

        return res.status(201).json({
          pesan: 'Sesi Multiplayer Makan Kerupuk baru berhasil dibuat.',
          sessionId: sessionBaru.id,
          session: { id: sessionBaru.id },
          game: 'makan_kerupuk',
          mode: 'multi',
          playMode: 'MULTIPLAYER',
          token,
          qrDataUrl,
          joinUrl,
        });
      }

      const configSnapshot = bangunKonfigurasiKerupukSolo(configSebelumnya);
      const shouldAutoStart = req.body?.autoStart === true;

      const sessionBaru = await prisma.session.create({
        data: {
          templateId: sessionLama.templateId,
          hostId: req.user!.id,
          mode: 'solo',
          token: null,
          status: shouldAutoStart ? 'jalan' : 'lobi',
          mulaiPada: shouldAutoStart ? new Date() : null,
          konfigurasi: JSON.stringify({
            playMode: 'SOLO',
            config: configSnapshot,
          }),
        },
      });

      const activeBaru = kerupukManager.inisialisasiSesi(
        sessionBaru.id,
        req.user!.id,
        { id: sessionLama.template.id, judul: sessionLama.template.judul },
        sessionLama.template.questions.map(mapDbQuestionForGame),
        configSnapshot
      );

      if (shouldAutoStart) {
        kerupukManager.mulaiPermainan(sessionBaru.id, req.user!.id);
      }

      return res.status(201).json({
        pesan: shouldAutoStart
          ? 'Permainan Mode Solo Makan Kerupuk baru langsung dimulai.'
          : 'Sesi Mode Solo Makan Kerupuk baru siap dimulai.',
        sessionId: sessionBaru.id,
        session: {
          id: sessionBaru.id,
          ...kerupukManager.serialisasiSesiUntukClient(activeBaru),
        },
        game: 'makan_kerupuk',
      });
    }

    if (sessionLama.template.game === 'balap_karung') {
      let configSebelumnya: any;
      if (sessionLama.konfigurasi) {
        try {
          const parsedKonf = JSON.parse(sessionLama.konfigurasi);
          configSebelumnya = parsedKonf?.config || parsedKonf;
        } catch {
          configSebelumnya = undefined;
        }
      }

      if (sessionLama.mode === 'solo') {
        const configSnapshot = bangunKonfigurasiBalapKarung({
          ...(configSebelumnya || {}),
          maxPeserta: 2,
          allowLateJoin: false,
        });
        const autoStart = req.body?.autoStart === true;

        const sessionBaru = await prisma.session.create({
          data: {
            templateId: sessionLama.templateId,
            hostId: req.user!.id,
            mode: 'solo',
            token: null,
            status: autoStart ? 'jalan' : 'lobi',
            mulaiPada: autoStart ? new Date() : null,
            konfigurasi: JSON.stringify({
              playMode: 'SOLO',
              config: configSnapshot,
            }),
          },
        });

        const activeSoloBalap = balapKarungSoloManager.inisialisasiSesi(
          sessionBaru.id,
          req.user!.id,
          { id: sessionLama.template.id, judul: sessionLama.template.judul },
          sessionLama.template.questions.map(mapDbQuestionForGame),
          configSnapshot,
          autoStart
        );

        return res.status(201).json({
          pesan: 'Sesi Solo Balap Karung baru berhasil dibuat.',
          sessionId: sessionBaru.id,
          game: 'balap_karung',
          mode: 'solo',
          playMode: 'SOLO',
          session: {
            id: sessionBaru.id,
            ...balapKarungSoloManager.serialisasiUntukClient(activeSoloBalap),
          },
        });
      }

      const requestedJumlahTim =
        req.body?.jumlahTim === 3 || req.body?.jumlahTim === 4
          ? req.body.jumlahTim
          : undefined;
      const configSnapshot = bangunKonfigurasiBalapKarung({
        waktuPerSoalDetik: 10,
        jumlahTim: 3,
        ...(configSebelumnya || {}),
        ...(requestedJumlahTim ? { jumlahTim: requestedJumlahTim } : {}),
      });
      const token = await generateTokenUnikSemuaGame();
      const baseUrl = getNetworkBaseUrl(req);
      const joinUrl = `${baseUrl}/main?token=${token}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });

      const sessionBaru = await prisma.session.create({
        data: {
          templateId: sessionLama.templateId,
          hostId: req.user!.id,
          mode: 'multi',
          token,
          status: 'lobi',
          konfigurasi: JSON.stringify(configSnapshot),
        },
      });

      balapKarungManager.inisialisasiSesi(
        sessionBaru.id,
        token,
        req.user!.id,
        { id: sessionLama.template.id, judul: sessionLama.template.judul },
        sessionLama.template.questions.map(mapDbQuestionForGame),
        configSnapshot
      );

      return res.status(201).json({
        pesan: 'Sesi Balap Karung baru berhasil dibuat.',
        sessionId: sessionBaru.id,
        session: { id: sessionBaru.id },
        game: 'balap_karung',
        mode: 'multi',
        playMode: 'MULTIPLAYER',
        token,
        qrDataUrl,
        joinUrl,
      });
    }

    if (sessionLama.template.game === 'panjat_pinang') {
      let configSebelumnya: any;
      if (sessionLama.konfigurasi) {
        try {
          const parsedKonf = JSON.parse(sessionLama.konfigurasi);
          configSebelumnya =
            parsedKonf?.config && typeof parsedKonf.config === 'object'
              ? parsedKonf.config
              : parsedKonf;
        } catch {
          configSebelumnya = undefined;
        }
      }

      if (sessionLama.mode === 'solo') {
        const configSnapshot = bangunKonfigurasiPanjatPinang({
          waktuPerSoalDetik: 15,
          ...configSebelumnya,
          maxPeserta: 2,
          allowLateJoin: false,
        });
        const sessionBaru = await prisma.session.create({
          data: {
            templateId: sessionLama.templateId,
            hostId: req.user!.id,
            mode: 'solo',
            token: null,
            status: 'lobi',
            konfigurasi: JSON.stringify({
              playMode: 'SOLO',
              config: configSnapshot,
            }),
          },
        });
        const activeSolo = panjatPinangSoloManager.inisialisasiSesi(
          sessionBaru.id,
          req.user!.id,
          { id: sessionLama.template.id, judul: sessionLama.template.judul },
          sessionLama.template.questions.map(mapDbQuestionForGame),
          configSnapshot,
          false
        );
        await panjatPinangSoloManager.simpanStatusKeDatabase(activeSolo);
        return res.status(201).json({
          pesan: 'Sesi Panjat Pinang Solo baru berhasil dibuat.',
          sessionId: sessionBaru.id,
          session: {
            id: sessionBaru.id,
            ...panjatPinangSoloManager.serialisasiUntukClient(activeSolo),
          },
          game: 'panjat_pinang',
          mode: 'solo',
          playMode: 'SOLO',
        });
      }

      const configSnapshot = bangunKonfigurasiPanjatPinang(configSebelumnya);
      const token = await generateTokenUnikSemuaGame();
      const baseUrl = getNetworkBaseUrl(req);
      const joinUrl = `${baseUrl}/main?token=${token}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });

      const sessionBaru = await prisma.session.create({
        data: {
          templateId: sessionLama.templateId,
          hostId: req.user!.id,
          mode: 'multi',
          token,
          status: 'lobi',
          konfigurasi: JSON.stringify(configSnapshot),
        },
      });

      panjatPinangManager.inisialisasiSesi(
        sessionBaru.id,
        token,
        req.user!.id,
        { id: sessionLama.template.id, judul: sessionLama.template.judul },
        sessionLama.template.questions.map(mapDbQuestionForGame),
        configSnapshot
      );

      return res.status(201).json({
        pesan: 'Sesi Panjat Pinang baru berhasil dibuat.',
        sessionId: sessionBaru.id,
        session: { id: sessionBaru.id },
        game: 'panjat_pinang',
        token,
        qrDataUrl,
        joinUrl,
      });
    }

    const savedConfig = parseTarikTambangConfigFromJson(sessionLama.konfigurasi);
    const mappedQuestions = mapQuestionsForTarikTambang(sessionLama.template.questions);

    if (sessionLama.mode === 'multi') {
      const token = await generateTokenUnikSemuaGame();
      const baseUrl = getNetworkBaseUrl(req);
      const joinUrl = `${baseUrl}/main?token=${token}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });

      const configTarik = bangunKonfigurasiTarikTambang(savedConfig);
      const sessionBaru = await prisma.session.create({
        data: {
          templateId: sessionLama.templateId,
          hostId: req.user!.id,
          mode: 'multi',
          token,
          status: 'lobi',
          konfigurasi: JSON.stringify({
            playMode: 'MULTIPLAYER',
            config: configTarik,
          }),
        },
      });

      multiManager.inisialisasiSesi(
        sessionBaru.id,
        token,
        req.user!.id,
        { id: sessionLama.template.id, judul: sessionLama.template.judul },
        mappedQuestions,
        configTarik
      );

      return res.status(201).json({
        pesan: 'Sesi Tarik Tambang Multiplayer baru berhasil dibuat.',
        sessionId: sessionBaru.id,
        game: 'tarik_tambang',
        playMode: 'MULTIPLAYER',
        token,
        qrDataUrl,
        joinUrl,
      });
    }

    // Default: Mode Solo 1 vs 1
    const configTarik = bangunKonfigurasiTarikTambang(savedConfig);
    const autoStart = req.body?.autoStart === true;

    const sessionBaru = await prisma.session.create({
      data: {
        templateId: sessionLama.templateId,
        hostId: req.user!.id,
        mode: 'solo',
        token: null,
        status: autoStart ? 'jalan' : 'lobi',
        mulaiPada: autoStart ? new Date() : null,
        konfigurasi: JSON.stringify({
          playMode: 'SOLO',
          config: configTarik,
        }),
      },
    });

    const activeSolo = soloManager.inisialisasiSesi(
      sessionBaru.id,
      req.user!.id,
      { id: sessionLama.template.id, judul: sessionLama.template.judul },
      mappedQuestions,
      configTarik
    );

    if (autoStart) {
      soloManager.mulaiSesi(sessionBaru.id, req.user!.id);
    }

    return res.status(201).json({
      pesan: 'Sesi Solo baru berhasil dibuat.',
      sessionId: sessionBaru.id,
      game: 'tarik_tambang',
      playMode: 'SOLO',
      session: soloManager.serialisasiUntukClient(activeSolo),
    });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal membuat sesi main lagi.' });
  }
});
