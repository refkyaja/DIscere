import { Router, Response, Request } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import crypto from 'crypto';
import os from 'os';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { mapDbQuestionForGame, SoalRecordForGame } from '../utils/questionOptions.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { soloManager } from '../games/soloManager.js';
import { multiManager } from '../games/multiManager.js';
import {
  bangunKonfigurasiTarikTambang,
  filterBankSoalSetara,
  konfigurasiTarikTambangSchema,
  KonfigurasiTarikTambang,
  normalisasiKodeTim,
  serialisasiSoalUntukClient,
  SoalBankTarikTambang,
} from '../games/tarikTambang.js';
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
import {
  bangunKonfigurasiPanjatPinang,
  konfigurasiPanjatPinangSchema,
} from '../games/panjatPinang.js';
import { balapKarungManager } from '../games/balapKarungManager.js';
import {
  bangunKonfigurasiBalapKarung,
  konfigurasiBalapKarungSchema,
} from '../games/balapKarung.js';

export const sesiRouter = Router();

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
  const ronde = sesi.rondeAktif;
  const soalTim1 =
    ronde && sesi.status === 'jalan'
      ? serialisasiSoalUntukClient(
          ronde.soalTim1,
          ronde.nomorRonde,
          ronde.berakhirPadaMs,
          sesi.config.durasiRonde
        )
      : null;
  const soalTim2 =
    ronde && sesi.status === 'jalan'
      ? serialisasiSoalUntukClient(
          ronde.soalTim2,
          ronde.nomorRonde,
          ronde.berakhirPadaMs,
          sesi.config.durasiRonde
        )
      : null;

  let dijawab1 = 0;
  let dijawab2 = 0;
  if (ronde) {
    for (const j of ronde.jawabanMap.values()) {
      if (j.tim === 'merah') dijawab1++;
      else dijawab2++;
    }
  }

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
    nomorRonde: ronde?.nomorRonde ?? sesi.nomorRondeCounter,
    currentQuestionIndex: sesi.currentQuestionIndex,
    totalSoal: sesi.totalSoal,
    taliPosition: sesi.taliPosition,
    skorMerah: sesi.skorMerah,
    skorPutih: sesi.skorPutih,
    powerUpTim1: {
      bank: sesi.powerUpTim1.bank,
      aktifBerikutnya: sesi.powerUpTim1.aktifBerikutnya,
    },
    powerUpTim2: {
      bank: sesi.powerUpTim2.bank,
      aktifBerikutnya: sesi.powerUpTim2.aktifBerikutnya,
    },
    totalPeserta: sesi.peserta.size,
    daftarPeserta: Array.from(sesi.peserta.values()).map((p) => ({
      id: p.id,
      nama: p.nama,
      tim: p.tim,
      connected: p.connected,
      totalBenar: p.totalBenar,
      totalSalah: p.totalSalah,
      jumlahJawab: p.jumlahJawab,
      akurasiPersen: p.jumlahJawab > 0 ? Math.round((p.totalBenar / p.jumlahJawab) * 100) : 0,
      streakSaatIni: p.streakSaatIni,
      streakTertinggi: p.streakTertinggi,
    })),
    rondeSaatIni:
      ronde && sesi.status === 'jalan'
        ? {
            nomorRonde: ronde.nomorRonde,
            dimulaiPadaMs: ronde.dimulaiPadaMs,
            berakhirPadaMs: ronde.berakhirPadaMs,
            ditutup: ronde.ditutup,
            progressTim1: { dijawab: dijawab1, total: ronde.anggotaAwalTim1 },
            progressTim2: { dijawab: dijawab2, total: ronde.anggotaAwalTim2 },
            powerUpTim1Dipakai: ronde.powerUpTim1Dipakai,
            powerUpTim2Dipakai: ronde.powerUpTim2Dipakai,
            soalTim1,
            soalTim2,
            hasilRonde: ronde.ditutup ? ronde.hasilRonde : null,
          }
        : null,
    soalSaatIni: soalTim1,
    riwayatTali: sesi.riwayatTali,
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

function getNetworkBaseUrl(req: Request): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return `http://${iface.address}:${config.port}`;
      }
    }
  }
  return `http://${req.hostname || 'localhost'}:${config.port}`;
}

// 0. GET /api/sesi/token/:token - Publik: Cek validitas token sesi untuk siswa bergabung
sesiRouter.get('/token/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;
    if (soloManager.dapatkanSesi(token) || kerupukManager.dapatkanSesi(token)) {
      return res.status(400).json({
        valid: false,
        pesan: 'Mode Solo dimainkan lokal tanpa PIN dan tidak menerima peserta siswa.',
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
            pesan: 'Mode Solo dimainkan lokal tanpa PIN dan tidak menerima peserta siswa.',
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
        status: active.status,
        totalPeserta: active.peserta.size,
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

// Seluruh rute sesi berikut membutuhkan login sebagai guru
sesiRouter.use(authMiddleware);
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
        ? await panjatPinangManager.muatLaporanDariDatabase(session.id)
        : null;

    const laporanBalapKarung =
      session.template.game === 'balap_karung'
        ? await balapKarungManager.muatLaporanDariDatabase(session.id)
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

    // Pastikan template memiliki soal
    if (!template.questions || template.questions.length === 0) {
      return res.status(400).json({
        pesan: 'Template ini belum memiliki soal. Silakan tambahkan soal terlebih dahulu.',
      });
    }

    const targetGame = parsed.game || template.game || 'tarik_tambang';

    // -------------------------------------------------------------
    // CABANG 0B: Game Balap Karung Challenge (Individual Multiplayer)
    // -------------------------------------------------------------
    if (targetGame === 'balap_karung') {
      const configSnapshot = bangunKonfigurasiBalapKarung({
        ...(parsed.balapKarungConfig || {}),
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
    // CABANG 0: Game Panjat Pinang (Individual Multiplayer)
    // -------------------------------------------------------------
    if (targetGame === 'panjat_pinang') {
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

      const session = await prisma.session.create({
        data: {
          templateId: template.id,
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

      const activeSession = kerupukManager.inisialisasiSesi(
        session.id,
        req.user!.id,
        { id: template.id, judul: template.judul },
        template.questions.map(mapDbQuestionForGame),
        configSnapshot
      );

      return res.status(201).json({
        pesan: 'Sesi Mode Solo Makan Kerupuk Challenge siap dimulai.',
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
    const kesulitanEksplisit = req.body?.tarikTambangConfig?.kesulitan;
    if (!kesulitanEksplisit) {
      const tersedia = (['sedang', 'mudah', 'sulit'] as const).find((lvl) => {
        try {
          filterBankSoalSetara(mappedQuestions, lvl);
          return true;
        } catch {
          return false;
        }
      });
      if (tersedia) {
        rawTarikConfig.kesulitan = tersedia;
      }
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

    // 0b. Cek di in-memory balapKarungManager atau pulihkan dari DB jika Balap Karung
    let activeBalap = balapKarungManager.dapatkanSesi(id);
    if (!activeBalap) {
      activeBalap = (await balapKarungManager.pulihkanSesiDariDb(id)) || undefined;
    }
    if (activeBalap) {
      if (activeBalap.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      const baseUrl = getNetworkBaseUrl(req);
      const joinUrl = `${baseUrl}/main?token=${activeBalap.token}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });
      const leaderboard = balapKarungManager.dapatkanLeaderboard(activeBalap.sessionId);

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
          leaderboard,
          daftarPeserta: leaderboard,
          isFinished: activeBalap.status === 'selesai',
          hasil: activeBalap.hasil || null,
        },
      });
    }

    // 0. Cek di in-memory panjatPinangManager atau pulihkan dari DB jika Panjat Pinang
    let activePanjat = panjatPinangManager.dapatkanSesi(id);
    if (!activePanjat) {
      activePanjat = (await panjatPinangManager.pulihkanSesiDariDb(id)) || undefined;
    }
    if (activePanjat) {
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

    // A1. Cek di in-memory kerupukMultiManager atau pulihkan dari DB (Makan Kerupuk Multiplayer)
    let activeKerupukMulti = kerupukMultiManager.dapatkanSesi(id);
    if (!activeKerupukMulti) {
      activeKerupukMulti = (await kerupukMultiManager.pulihkanSesiDariDb(id)) || undefined;
    }
    if (activeKerupukMulti) {
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

    // A2. Cek di in-memory kerupukManager atau pulihkan dari DB (Makan Kerupuk Solo)
    let activeKerupuk = kerupukManager.dapatkanSesi(id);
    if (!activeKerupuk) {
      activeKerupuk = (await kerupukManager.pulihkanSesiDariDb(id)) || undefined;
    }
    if (activeKerupuk) {
      if (activeKerupuk.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }
      return res.json({
        session: kerupukManager.serialisasiSesiUntukClient(activeKerupuk),
      });
    }

    // B. Cek di in-memory multiManager (Tarik Tambang Multiplayer)
    const activeMulti = multiManager.dapatkanSesi(id);
    if (activeMulti) {
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

    // B2. Cek di in-memory active solo manager (Tarik Tambang Solo 1 vs 1)
    let activeSession = soloManager.dapatkanSesi(id, req.user!.id);

    // C. Jika belum ada di memori (misal guru me-refresh browser), pulihkan dari database
    if (!activeSession) {
      const sessionDb = await prisma.session.findUnique({
        where: { id },
        include: {
          template: {
            include: { questions: { orderBy: { urutan: 'asc' } } },
          },
          result: true,
        },
      });

      if (!sessionDb) {
        return res.status(404).json({ pesan: 'Sesi permainan tidak ditemukan.' });
      }

      if (sessionDb.hostId !== req.user!.id) {
        return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke sesi ini.' });
      }

      const savedConfig = parseTarikTambangConfigFromJson(sessionDb.konfigurasi);
      const mappedQuestions = mapQuestionsForTarikTambang(sessionDb.template.questions);

      // Jika sesi multiplayer
      if (sessionDb.mode === 'multi') {
        const token = sessionDb.token || (await generateTokenUnikSemuaGame());
        const baseUrl = getNetworkBaseUrl(req);
        const joinUrl = `${baseUrl}/main?token=${token}`;
        const qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 2, width: 320 });

        if (sessionDb.status === 'selesai') {
          const laporanMulti = await multiManager.muatLaporanDariDatabase(sessionDb.id);
          return res.json({
            session: {
              sessionId: sessionDb.id,
              game: 'tarik_tambang',
              mode: 'multi',
              playMode: 'MULTIPLAYER',
              token,
              qrDataUrl,
              joinUrl,
              networkUrl: baseUrl,
              templateId: sessionDb.templateId,
              templateJudul: sessionDb.template.judul,
              hostId: sessionDb.hostId,
              status: 'selesai',
              config: savedConfig || null,
              taliPosition: sessionDb.result?.posisiAkhir ?? 0,
              skorMerah: sessionDb.result?.skorMerah ?? 0,
              skorPutih: sessionDb.result?.skorPutih ?? 0,
              totalSoal: sessionDb.template.questions.length,
              totalPeserta: laporanMulti?.statistikPemain.length ?? 0,
              daftarPeserta: laporanMulti?.statistikPemain ?? [],
              isFinished: true,
              hasil: laporanMulti,
            },
          });
        }

        const multi = multiManager.inisialisasiSesi(
          sessionDb.id,
          token,
          sessionDb.hostId,
          { id: sessionDb.template.id, judul: sessionDb.template.judul },
          mappedQuestions,
          savedConfig
        );

        return res.json({
          session: serializeMultiTarikSession(multi, qrDataUrl, joinUrl, baseUrl),
        });
      }

      // Jika sesi sudah selesai di database (Solo)
      if (sessionDb.status === 'selesai') {
        const laporanSolo = await soloManager.muatLaporanDariDatabase(sessionDb.id);
        return res.json({
          session: {
            sessionId: sessionDb.id,
            game: 'tarik_tambang',
            mode: 'solo',
            playMode: 'SOLO',
            templateId: sessionDb.templateId,
            templateJudul: sessionDb.template.judul,
            hostId: sessionDb.hostId,
            state: 'FINISHED',
            config: savedConfig || null,
            taliPosition: sessionDb.result?.posisiAkhir ?? 0,
            skorMerah: sessionDb.result?.skorMerah ?? 0,
            skorPutih: sessionDb.result?.skorPutih ?? 0,
            totalSoal: sessionDb.template.questions.length,
            isFinished: true,
            hasil: laporanSolo,
          },
        });
      }

      // Inisialisasi ulang ke memori jika sesi masih aktif (Solo)
      activeSession = soloManager.inisialisasiSesi(
        sessionDb.id,
        req.user!.id,
        { id: sessionDb.template.id, judul: sessionDb.template.judul },
        mappedQuestions,
        savedConfig
      );

      if (sessionDb.status === 'jalan') {
        soloManager.mulaiSesi(sessionDb.id, req.user!.id);
      }
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

    // A. Cek apakah sesi ini adalah Makan Kerupuk Challenge Solo
    let activeKerupuk = kerupukManager.dapatkanSesi(id);
    if (!activeKerupuk) {
      activeKerupuk = (await kerupukManager.pulihkanSesiDariDb(id)) || undefined;
    }
    if (activeKerupuk) {
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

    // B. Tarik Tambang Solo
    if (multiManager.dapatkanSesi(id)) {
      return res
        .status(400)
        .json({ pesan: 'Sesi Multiplayer harus dimulai melalui ruang lobi realtime.' });
    }

    let activeSession = soloManager.dapatkanSesi(id, req.user!.id);

    if (!activeSession) {
      // Coba pulihkan dari DB
      const sessionDb = await prisma.session.findUnique({
        where: { id },
        include: {
          template: { include: { questions: { orderBy: { urutan: 'asc' } } } },
        },
      });

      if (!sessionDb || sessionDb.hostId !== req.user!.id) {
        return res.status(404).json({ pesan: 'Sesi permainan tidak ditemukan.' });
      }
      if (sessionDb.mode === 'multi') {
        return res
          .status(400)
          .json({ pesan: 'Sesi Multiplayer harus dimulai melalui ruang lobi realtime.' });
      }

      activeSession = soloManager.inisialisasiSesi(
        sessionDb.id,
        req.user!.id,
        { id: sessionDb.template.id, judul: sessionDb.template.judul },
        mapQuestionsForTarikTambang(sessionDb.template.questions),
        parseTarikTambangConfigFromJson(sessionDb.konfigurasi)
      );
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

// 6. POST /api/sesi/:id/state - Pause / Resume permainan
const stateSchema = z.object({
  state: z.enum(['PLAYING', 'PAUSED']),
});

sesiRouter.post('/:id/state', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { state } = stateSchema.parse(req.body);

    const activeKerupuk =
      kerupukManager.dapatkanSesi(id) || (await kerupukManager.pulihkanSesiDariDb(id));
    if (activeKerupuk) {
      const sesiKerupuk = kerupukManager.ubahStatePermainan(id, req.user!.id, state);
      return res.json({
        pesan: `Permainan berhasil di-${state === 'PAUSED' ? 'jeda' : 'lanjutkan'}.`,
        state: sesiKerupuk.state,
        session: kerupukManager.serialisasiSesiUntukClient(sesiKerupuk),
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
});

sesiRouter.post('/:id/jawab', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const activeKerupuk =
      kerupukManager.dapatkanSesi(id) || (await kerupukManager.pulihkanSesiDariDb(id));
    if (activeKerupuk) {
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

    if (multiManager.dapatkanSesi(id)) {
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
    });

    const { sesi, tim, sudahMenjawab, rondeSelesai, hasilRonde, selesai } = hasilProses;

    if (selesai) {
      await soloManager.simpanHasilKeDatabase(sesi);
    }

    return res.json({
      game: 'tarik_tambang',
      tim,
      sudahMenjawab,
      rondeSelesai,
      // Kunci jawaban & penjelasan hanya diungkap setelah ronde ditutup
      hasilRonde: rondeSelesai ? hasilRonde : null,
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

// 8. POST /api/sesi/:id/selesai - Akhiri permainan secara manual oleh guru
sesiRouter.post('/:id/selesai', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const activeKerupuk =
      kerupukManager.dapatkanSesi(id) || (await kerupukManager.pulihkanSesiDariDb(id));
    if (activeKerupuk) {
      const sesiKerupuk = kerupukManager.hentikanPermainan(id, req.user!.id);
      await kerupukManager.simpanHasilKeDatabase(id);
      return res.json({
        pesan: 'Permainan Makan Kerupuk berhasil dihentikan.',
        hasil: sesiKerupuk.hasil,
        session: kerupukManager.serialisasiSesiUntukClient(sesiKerupuk),
      });
    }

    if (multiManager.dapatkanSesi(id)) {
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

// 8b. POST /api/sesi/:id/ulang - Mulai ulang sesi Makan Kerupuk aktif ke status READY bersih
sesiRouter.post('/:id/ulang', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const activeKerupuk =
      kerupukManager.dapatkanSesi(id) || (await kerupukManager.pulihkanSesiDariDb(id));

    if (!activeKerupuk) {
      return res.status(404).json({ pesan: 'Sesi Makan Kerupuk tidak ditemukan.' });
    }

    if (activeKerupuk.state === 'FINISHED' || activeKerupuk.state === 'STOPPED') {
      return res.status(400).json({
        pesan:
          'Sesi yang sudah selesai tidak dapat direset in-place agar riwayat tetap terjaga. Gunakan Main Lagi untuk membuat sesi baru.',
      });
    }

    const sesiReset = kerupukManager.ulangPermainan(id, req.user!.id);
    await prisma.session.update({
      where: { id },
      data: {
        status: 'lobi',
        mulaiPada: null,
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
      const laporanDb = await balapKarungManager.muatLaporanDariDatabase(sessionDb.id);
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
      const laporanDb = await panjatPinangManager.muatLaporanDariDatabase(sessionDb.id);
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

      const activeBaru = kerupukManager.inisialisasiSesi(
        sessionBaru.id,
        req.user!.id,
        { id: sessionLama.template.id, judul: sessionLama.template.judul },
        sessionLama.template.questions.map(mapDbQuestionForGame),
        configSnapshot
      );

      return res.status(201).json({
        pesan: 'Sesi Mode Solo Makan Kerupuk baru siap dimulai.',
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
          configSebelumnya = JSON.parse(sessionLama.konfigurasi);
        } catch {
          configSebelumnya = undefined;
        }
      }
      const configSnapshot = bangunKonfigurasiBalapKarung(configSebelumnya);
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
        token,
        qrDataUrl,
        joinUrl,
      });
    }

    if (sessionLama.template.game === 'panjat_pinang') {
      let configSebelumnya: any;
      if (sessionLama.konfigurasi) {
        try {
          configSebelumnya = JSON.parse(sessionLama.konfigurasi);
        } catch {
          configSebelumnya = undefined;
        }
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

// 11. DELETE /api/sesi/:id - Hapus sesi permainan milik guru atau admin
sesiRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
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

    await prisma.session.delete({
      where: { id },
    });

    return res.json({ pesan: 'Sesi berhasil dihapus.' });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal menghapus sesi.' });
  }
});
