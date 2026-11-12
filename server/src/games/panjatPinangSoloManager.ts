import crypto from 'crypto';
import { prisma } from '../db.js';
import {
  HasilJawabanPanjat,
  KonfigurasiPanjatPinang,
  KunciPilihan,
  PesertaPanjatState,
  PresentasiSoalPanjat,
  RiwayatJawabanEntry,
  RiwayatPosisiEntry,
  RiwayatRintanganEntry,
  RngRintangan,
  SoalPanjat,
  bangunKonfigurasiPanjatPinang,
  buatPresentasiSoalPanjat,
  prosesJawabanPanjatPinang,
  urutkanLeaderboardPanjatPinang,
} from './panjatPinang.js';
import {
  LaporanAkhirPanjatPinang,
  LeaderboardItemPanjat,
  SesiPanjatActive,
  buatLaporanAkhirPanjat,
  panjatPinangManager,
  siapkanAntreanSoalPanjat,
} from './panjatPinangManager.js';

export type StatePanjatPinangSolo = 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED' | 'STOPPED';
export type SlotPemainSoloPanjat = 'pemain1' | 'pemain2';

export interface SoalAktifPanjatSolo {
  presentationId: string;
  questionId: string;
  urutanSoal: number;
  totalSoal: number;
  teks: string;
  opsi: Array<{
    choiceId: string;
    key: KunciPilihan;
    teks: string;
  }>;
  ditampilkanPadaMs: number;
  isBonusKulitPisang: boolean;
}

export interface FeedbackAksiPanjatSolo {
  slot: SlotPemainSoloPanjat;
  nama: string;
  benar: boolean;
  timedOut: boolean;
  isBonusKulitPisang: boolean;
  jawabanDipilihKey: string | null;
  kunciKey: string;
  penjelasan: string | null;
  posisiSebelum: number;
  posisiBaru: number;
  perubahanPosisi: number;
  bonusStreakDidapat: number;
  bonusPeganganKuatDidapat: number;
  penaltiTiangLicin: number;
  perisaiDigunakan: boolean;
  perisaiDiperoleh: boolean;
  rintanganBaru: RiwayatRintanganEntry | null;
  selesaiBaru: boolean;
  waktuJawabMs: number;
  timestampMs: number;
}

export interface PesertaClientPanjatSolo {
  id: string;
  slot: SlotPemainSoloPanjat;
  nama: string;
  isBot: boolean;
  posisi: number;
  poinBonus: number;
  totalBenar: number;
  totalSalah: number;
  streakSaatIni: number;
  streakTertinggi: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs: number | null;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  efekAktif: {
    tiangLicin: boolean;
    perisaiKulitPisang: boolean;
    peganganKuat: boolean;
    menungguBonusKulitPisang: boolean;
  };
  riwayatPosisi: RiwayatPosisiEntry[];
  riwayatRintangan: RiwayatRintanganEntry[];
  riwayatJawaban: RiwayatJawabanEntry[];
  soalAktif: SoalAktifPanjatSolo | null;
}

export interface QuestionStatPanjatSolo {
  questionId: string;
  nomorSoal: number;
  teksSoal: string;
  jumlahBenar: number;
  jumlahSalah: number;
}

export interface SesiPanjatPinangSoloActive {
  sessionId: string;
  hostId: string;
  templateId: string;
  templateJudul: string;
  state: StatePanjatPinangSolo;
  status: 'lobi' | 'jalan' | 'selesai';
  config: KonfigurasiPanjatPinang;
  questions: SoalPanjat[];
  totalSoal: number;
  pemain1: PesertaPanjatState;
  pemain2: PesertaPanjatState;
  isBotLawan: boolean;
  botNextActionAtMs: number | null;
  mulaiPadaMs: number | null;
  pausedPadaMs: number | null;
  totalPausedMs: number;
  selesaiPadaMs: number | null;
  terakhirFeedback: FeedbackAksiPanjatSolo | null;
  processedPresentations: Set<string>;
  hasil?: LaporanAkhirPanjatPinang;
}

export interface SesiPanjatPinangSoloClient {
  sessionId: string;
  game: 'panjat_pinang';
  mode: 'solo';
  playMode: 'SOLO';
  state: StatePanjatPinangSolo;
  status: 'lobi' | 'jalan' | 'selesai';
  templateId: string;
  templateJudul: string;
  totalSoal: number;
  config: KonfigurasiPanjatPinang;
  isBotLawan: boolean;
  pemain1: PesertaClientPanjatSolo;
  pemain2: PesertaClientPanjatSolo;
  mulaiPadaMs: number | null;
  pausedPadaMs: number | null;
  totalPausedMs: number;
  selesaiPadaMs: number | null;
  botNextActionAtMs: number | null;
  terakhirFeedback: FeedbackAksiPanjatSolo | null;
  leaderboard: LeaderboardItemPanjat[];
  isFinished: boolean;
  winnerSlot: SlotPemainSoloPanjat | 'SERI' | null;
  winnerNama: string | null;
  hasil: LaporanAkhirPanjatPinang | null;
  questionStats: QuestionStatPanjatSolo[];
}

export interface RngBotPanjat {
  akurasiRoll: () => number;
  delayRoll: () => number;
  pilihanSalahIndex: (count: number) => number;
}

const defaultRngBot: RngBotPanjat = {
  akurasiRoll: () => Math.random(),
  delayRoll: () => Math.random(),
  pilihanSalahIndex: (count) => Math.floor(Math.random() * count),
};

const BOT_PARAM_BY_KESULITAN: Record<
  KonfigurasiPanjatPinang['kesulitanBot'],
  { accuracy: number; minDelayMs: number; maxDelayMs: number }
> = {
  santai: { accuracy: 0.62, minDelayMs: 3200, maxDelayMs: 5600 },
  sedang: { accuracy: 0.78, minDelayMs: 2100, maxDelayMs: 3900 },
  cepat: { accuracy: 0.9, minDelayMs: 1200, maxDelayMs: 2500 },
};

const sesiPanjatSoloMap = new Map<string, SesiPanjatPinangSoloActive>();
const dbWriteQueues = new Map<string, Promise<void>>();

function antrekanPenulisanDb(sessionId: string, task: () => Promise<void>): Promise<void> {
  const prev = dbWriteQueues.get(sessionId) || Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  dbWriteQueues.set(sessionId, next);
  return next;
}

function hitungDelayBotMs(
  kesulitanBot: KonfigurasiPanjatPinang['kesulitanBot'],
  rngBot: RngBotPanjat = defaultRngBot
): number {
  const param = BOT_PARAM_BY_KESULITAN[kesulitanBot] || BOT_PARAM_BY_KESULITAN.sedang;
  const roll = Math.min(0.999999, Math.max(0, rngBot.delayRoll()));
  return Math.round(param.minDelayMs + roll * (param.maxDelayMs - param.minDelayMs));
}

function buatPesertaSoloKosong(
  id: string,
  nama: string,
  questions: SoalPanjat[]
): PesertaPanjatState {
  return {
    id,
    secretToken: crypto.randomUUID(),
    socketId: '',
    nama,
    connected: true,
    posisi: 0,
    poinBonus: 0,
    totalBenar: 0,
    totalSalah: 0,
    streakSaatIni: 0,
    streakTertinggi: 0,
    bonus3DalamStreak: false,
    bonus5DalamStreak: false,
    status: 'bermain',
    waktuSelesaiMs: null,
    selesaiPada: null,
    totalWaktuJawabMs: 0,
    jumlahJawab: 0,
    rataRataWaktuJawabMs: 0,
    efekAktif: {
      tiangLicin: false,
      perisaiKulitPisang: false,
      peganganKuat: false,
      menungguBonusKulitPisang: false,
    },
    riwayatPosisi: [],
    riwayatRintangan: [],
    riwayatJawaban: [],
    antreanSoal: siapkanAntreanSoalPanjat(questions),
    terakhirSoalId: undefined,
    presentasiAktif: null,
    nomorSoalPemain: 0,
  };
}

function formatPresentasiUntukSoloClient(
  presentasi: PresentasiSoalPanjat | null,
  totalSoal: number
): SoalAktifPanjatSolo | null {
  if (!presentasi) return null;
  return {
    presentationId: presentasi.presentationId,
    questionId: presentasi.questionId,
    urutanSoal: presentasi.nomorSoal,
    totalSoal,
    teks: presentasi.teks,
    opsi: presentasi.pilihan,
    ditampilkanPadaMs: presentasi.ditampilkanPadaMs,
    isBonusKulitPisang: presentasi.isBonusKulitPisang,
  };
}

function toPesertaClient(
  p: PesertaPanjatState,
  slot: SlotPemainSoloPanjat,
  isBot: boolean,
  totalSoal: number
): PesertaClientPanjatSolo {
  return {
    id: p.id,
    slot,
    nama: p.nama,
    isBot,
    posisi: p.posisi,
    poinBonus: p.poinBonus,
    totalBenar: p.totalBenar,
    totalSalah: p.totalSalah,
    streakSaatIni: p.streakSaatIni,
    streakTertinggi: p.streakTertinggi,
    status: p.status,
    waktuSelesaiMs: p.waktuSelesaiMs,
    rataRataWaktuJawabMs: p.rataRataWaktuJawabMs,
    jumlahJawab: p.jumlahJawab,
    efekAktif: { ...p.efekAktif },
    riwayatPosisi: [...p.riwayatPosisi],
    riwayatRintangan: [...p.riwayatRintangan],
    riwayatJawaban: [...p.riwayatJawaban],
    soalAktif: formatPresentasiUntukSoloClient(p.presentasiAktif, totalSoal),
  };
}

function toSesiPanjatActive(sesi: SesiPanjatPinangSoloActive): SesiPanjatActive {
  const pesertaMap = new Map<string, PesertaPanjatState>();
  pesertaMap.set(sesi.pemain1.id, sesi.pemain1);
  pesertaMap.set(sesi.pemain2.id, sesi.pemain2);

  return {
    sessionId: sesi.sessionId,
    token: '',
    templateId: sesi.templateId,
    templateJudul: sesi.templateJudul,
    hostId: sesi.hostId,
    status: sesi.status,
    config: sesi.config,
    peserta: pesertaMap,
    totalSoal: sesi.totalSoal,
    questions: sesi.questions,
    gameMulaiPadaMs: sesi.mulaiPadaMs,
    processedPresentations: sesi.processedPresentations,
    hasil: sesi.hasil,
  };
}

function buildQuestionStats(sesi: SesiPanjatPinangSoloActive): QuestionStatPanjatSolo[] {
  const statMap = new Map<string, { benar: number; salah: number }>();
  for (const q of sesi.questions) {
    statMap.set(q.id, { benar: 0, salah: 0 });
  }
  for (const p of [sesi.pemain1, sesi.pemain2]) {
    for (const jw of p.riwayatJawaban) {
      const cur = statMap.get(jw.questionId) || { benar: 0, salah: 0 };
      if (jw.benar) cur.benar += 1;
      else cur.salah += 1;
      statMap.set(jw.questionId, cur);
    }
  }
  return sesi.questions.map((q) => {
    const st = statMap.get(q.id) || { benar: 0, salah: 0 };
    return {
      questionId: q.id,
      nomorSoal: q.urutan,
      teksSoal: q.teks,
      jumlahBenar: st.benar,
      jumlahSalah: st.salah,
    };
  });
}

function tentukanPemenangSolo(sesi: SesiPanjatPinangSoloActive): {
  winnerSlot: SlotPemainSoloPanjat | 'SERI' | null;
  winnerNama: string | null;
} {
  if (sesi.state !== 'FINISHED' && sesi.state !== 'STOPPED') {
    return { winnerSlot: null, winnerNama: null };
  }

  const p1 = sesi.pemain1;
  const p2 = sesi.pemain2;

  const semuaIdentik =
    p1.status === p2.status &&
    p1.waktuSelesaiMs === p2.waktuSelesaiMs &&
    p1.posisi === p2.posisi &&
    p1.poinBonus === p2.poinBonus &&
    p1.rataRataWaktuJawabMs === p2.rataRataWaktuJawabMs &&
    p1.totalBenar === p2.totalBenar &&
    p1.streakTertinggi === p2.streakTertinggi;

  if (semuaIdentik) {
    return { winnerSlot: 'SERI', winnerNama: 'Seri' };
  }

  const sorted = urutkanLeaderboardPanjatPinang([p1, p2]);
  const juara1 = sorted[0];
  return {
    winnerSlot: juara1.id === p1.id ? 'pemain1' : 'pemain2',
    winnerNama: juara1.nama,
  };
}

function buildLeaderboardSolo(sesi: SesiPanjatPinangSoloActive): LeaderboardItemPanjat[] {
  const sorted = urutkanLeaderboardPanjatPinang([sesi.pemain1, sesi.pemain2]);
  return sorted.map((p, idx) => {
    const totalJawab = p.totalBenar + p.totalSalah;
    const akurasiPersen = totalJawab > 0 ? Math.round((p.totalBenar / totalJawab) * 100) : 0;
    return {
      peringkat: idx + 1,
      id: p.id,
      nama: p.nama,
      connected: p.connected,
      posisi: p.posisi,
      poinBonus: p.poinBonus,
      totalBenar: p.totalBenar,
      totalSalah: p.totalSalah,
      akurasiPersen,
      streakSaatIni: p.streakSaatIni,
      streakTertinggi: p.streakTertinggi,
      status: p.status,
      waktuSelesaiMs: p.waktuSelesaiMs,
      rataRataWaktuJawabMs: p.rataRataWaktuJawabMs,
      jumlahJawab: p.jumlahJawab,
      efekAktif: { ...p.efekAktif },
    };
  });
}

function siapkanSoalUntukSlot(
  sesi: SesiPanjatPinangSoloActive,
  slot: SlotPemainSoloPanjat,
  nowMs: number = Date.now()
): PresentasiSoalPanjat | null {
  if (sesi.state !== 'PLAYING' || sesi.questions.length === 0) return null;

  const peserta = slot === 'pemain1' ? sesi.pemain1 : sesi.pemain2;
  if (peserta.status === 'selesai' || peserta.posisi >= 100) return null;

  if (peserta.presentasiAktif) {
    return peserta.presentasiAktif;
  }

  if (!peserta.antreanSoal || peserta.antreanSoal.length === 0) {
    peserta.antreanSoal = siapkanAntreanSoalPanjat(sesi.questions, peserta.terakhirSoalId);
  }

  const nextQuestionId = peserta.antreanSoal.shift();
  if (!nextQuestionId) return null;

  const soal = sesi.questions.find((q) => q.id === nextQuestionId);
  if (!soal) return null;

  peserta.nomorSoalPemain += 1;
  const isBonus = Boolean(peserta.efekAktif.menungguBonusKulitPisang);
  const presentasi = buatPresentasiSoalPanjat(soal, peserta.nomorSoalPemain, isBonus, nowMs);

  peserta.terakhirSoalId = soal.id;
  peserta.presentasiAktif = presentasi;
  return presentasi;
}

function serialisasiKonfigurasiDb(sesi: SesiPanjatPinangSoloActive): string {
  return JSON.stringify({
    playMode: 'SOLO',
    state: sesi.state,
    totalPausedMs: sesi.totalPausedMs,
    pausedPadaMs: sesi.pausedPadaMs,
    isBotLawan: sesi.isBotLawan,
    pemain1Id: sesi.pemain1.id,
    pemain2Id: sesi.pemain2.id,
    pemain1Efek: sesi.pemain1.efekAktif,
    pemain2Efek: sesi.pemain2.efekAktif,
    config: sesi.config,
  });
}

function buildPlayerDbPayload(p: PesertaPanjatState) {
  return {
    nama: p.nama,
    posisi: p.posisi,
    poinBonus: p.poinBonus,
    totalBenar: p.totalBenar,
    totalSalah: p.totalSalah,
    streakSaatIni: p.streakSaatIni,
    streakTertinggi: p.streakTertinggi,
    totalWaktuJawabMs: p.totalWaktuJawabMs,
    jumlahJawab: p.jumlahJawab,
    status: p.status,
    waktuSelesaiMs: p.waktuSelesaiMs,
    selesaiPada: p.selesaiPada ? new Date(p.selesaiPada) : null,
    riwayatPosisi: JSON.stringify(p.riwayatPosisi),
    riwayatRintangan: JSON.stringify(p.riwayatRintangan),
    riwayatJawaban: JSON.stringify(p.riwayatJawaban),
  };
}

function buildEffectiveStartMs(sesi: SesiPanjatPinangSoloActive, nowMs: number): number {
  const baseStart = sesi.mulaiPadaMs ?? nowMs;
  return Math.min(nowMs, baseStart + sesi.totalPausedMs);
}

export const panjatPinangSoloManager = {
  inisialisasiSesi(
    sessionId: string,
    hostId: string,
    template: { id: string; judul: string },
    questions: SoalPanjat[],
    userConfig?: Partial<KonfigurasiPanjatPinang>,
    autoStart: boolean = false,
    nowMs: number = Date.now()
  ): SesiPanjatPinangSoloActive {
    if (!questions || questions.length === 0) {
      throw new Error('Template belum memiliki soal. Tambahkan minimal 1 soal sebelum membuat sesi.');
    }

    const config = bangunKonfigurasiPanjatPinang({
      ...userConfig,
      maxPeserta: 2,
      allowLateJoin: false,
    });

    const isBotLawan = config.tipeLawanSolo === 'bot';
    const nama1 = config.namaPemain1 || 'Pemain 1';
    const nama2 = config.namaPemain2 || (isBotLawan ? 'Lawan Bot' : 'Pemain 2');

    const sesi: SesiPanjatPinangSoloActive = {
      sessionId,
      hostId,
      templateId: template.id,
      templateJudul: template.judul,
      state: autoStart ? 'PLAYING' : 'READY',
      status: autoStart ? 'jalan' : 'lobi',
      config,
      questions,
      totalSoal: questions.length,
      pemain1: buatPesertaSoloKosong(crypto.randomUUID(), nama1, questions),
      pemain2: buatPesertaSoloKosong(crypto.randomUUID(), nama2, questions),
      isBotLawan,
      botNextActionAtMs: null,
      mulaiPadaMs: autoStart ? nowMs : null,
      pausedPadaMs: null,
      totalPausedMs: 0,
      selesaiPadaMs: null,
      terakhirFeedback: null,
      processedPresentations: new Set(),
    };

    if (autoStart) {
      siapkanSoalUntukSlot(sesi, 'pemain1', nowMs);
      siapkanSoalUntukSlot(sesi, 'pemain2', nowMs);
      if (isBotLawan) {
        sesi.botNextActionAtMs = nowMs + hitungDelayBotMs(config.kesulitanBot);
      }
    }

    sesiPanjatSoloMap.set(sessionId, sesi);
    return sesi;
  },

  dapatkanSesi(sessionId: string, hostId?: string): SesiPanjatPinangSoloActive | undefined {
    const sesi = sesiPanjatSoloMap.get(sessionId);
    if (!sesi) return undefined;
    if (hostId && sesi.hostId !== hostId) return undefined;
    return sesi;
  },

  hapusSesi(sessionId: string): void {
    sesiPanjatSoloMap.delete(sessionId);
  },

  async pulihkanSesiDariDb(sessionId: string): Promise<SesiPanjatPinangSoloActive | null> {
    const existing = sesiPanjatSoloMap.get(sessionId);
    if (existing) return existing;

    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: {
          include: {
            questions: { orderBy: { urutan: 'asc' } },
          },
        },
        players: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (
      !sessionDb ||
      sessionDb.template.game !== 'panjat_pinang' ||
      sessionDb.mode !== 'solo'
    ) {
      return null;
    }

    let rawParsed: Record<string, unknown> = {};
    if (sessionDb.konfigurasi) {
      try {
        const parsed = JSON.parse(sessionDb.konfigurasi);
        if (parsed && typeof parsed === 'object') {
          rawParsed = parsed as Record<string, unknown>;
        }
      } catch {
        rawParsed = {};
      }
    }

    const rawConfig =
      rawParsed.config && typeof rawParsed.config === 'object'
        ? (rawParsed.config as Partial<KonfigurasiPanjatPinang>)
        : (rawParsed as Partial<KonfigurasiPanjatPinang>);

    const config = bangunKonfigurasiPanjatPinang({
      ...rawConfig,
      maxPeserta: 2,
      allowLateJoin: false,
    });
    const isBotLawan =
      typeof rawParsed.isBotLawan === 'boolean'
        ? rawParsed.isBotLawan
        : config.tipeLawanSolo === 'bot';

    const questions: SoalPanjat[] = sessionDb.template.questions.map((q) => ({
      id: q.id,
      urutan: q.urutan,
      teks: q.teks,
      opsiA: q.opsiA,
      opsiB: q.opsiB,
      opsiC: q.opsiC,
      opsiD: q.opsiD,
      opsiE: q.opsiE,
      jawabanBenar: q.jawabanBenar,
      penjelasan: q.penjelasan,
    }));

    const parseJsonArray = <T>(raw: string | null | undefined): T[] => {
      if (!raw) return [];
      try {
        const val = JSON.parse(raw);
        return Array.isArray(val) ? (val as T[]) : [];
      } catch {
        return [];
      }
    };

    const hydratePeserta = (
      pl: (typeof sessionDb.players)[number] | undefined,
      fallbackId: string,
      fallbackNama: string,
      savedEfekRaw?: unknown
    ): PesertaPanjatState => {
      const efekSaved =
        savedEfekRaw && typeof savedEfekRaw === 'object'
          ? (savedEfekRaw as Partial<PesertaPanjatState['efekAktif']>)
          : {};
      const efekAktif = {
        tiangLicin: Boolean(efekSaved.tiangLicin),
        perisaiKulitPisang: Boolean(efekSaved.perisaiKulitPisang),
        peganganKuat: Boolean(efekSaved.peganganKuat),
        menungguBonusKulitPisang: Boolean(efekSaved.menungguBonusKulitPisang),
      };
      if (!pl) {
        const kosong = buatPesertaSoloKosong(fallbackId, fallbackNama, questions);
        kosong.efekAktif = efekAktif;
        return kosong;
      }
      const riwayatPosisi = parseJsonArray<RiwayatPosisiEntry>(pl.riwayatPosisi);
      const riwayatRintangan = parseJsonArray<RiwayatRintanganEntry>(pl.riwayatRintangan);
      const riwayatJawaban = parseJsonArray<RiwayatJawabanEntry>(pl.riwayatJawaban);
      const lastJawaban = riwayatJawaban[riwayatJawaban.length - 1];
      return {
        id: pl.id,
        secretToken: crypto.randomUUID(),
        socketId: '',
        nama: pl.nama,
        connected: true,
        posisi: pl.posisi,
        poinBonus: pl.poinBonus,
        totalBenar: pl.totalBenar,
        totalSalah: pl.totalSalah,
        streakSaatIni: pl.streakSaatIni,
        streakTertinggi: pl.streakTertinggi,
        bonus3DalamStreak: pl.streakSaatIni >= 3,
        bonus5DalamStreak: pl.streakSaatIni >= 5,
        status: pl.status === 'selesai' ? 'selesai' : 'bermain',
        waktuSelesaiMs: pl.waktuSelesaiMs,
        selesaiPada: pl.selesaiPada ? pl.selesaiPada.getTime() : null,
        totalWaktuJawabMs: pl.totalWaktuJawabMs,
        jumlahJawab: pl.jumlahJawab,
        rataRataWaktuJawabMs:
          pl.jumlahJawab > 0 ? Math.round(pl.totalWaktuJawabMs / pl.jumlahJawab) : 0,
        efekAktif,
        riwayatPosisi,
        riwayatRintangan,
        riwayatJawaban,
        antreanSoal: siapkanAntreanSoalPanjat(questions, lastJawaban?.questionId),
        terakhirSoalId: lastJawaban?.questionId,
        presentasiAktif: null,
        nomorSoalPemain: riwayatJawaban.length,
      };
    };

    const storedP1Id = typeof rawParsed.pemain1Id === 'string' ? rawParsed.pemain1Id : '';
    const storedP2Id = typeof rawParsed.pemain2Id === 'string' ? rawParsed.pemain2Id : '';
    const pl1 =
      (storedP1Id && sessionDb.players.find((p) => p.id === storedP1Id)) || sessionDb.players[0];
    const pl2 =
      (storedP2Id && sessionDb.players.find((p) => p.id === storedP2Id)) ||
      sessionDb.players.find((p) => p.id !== pl1?.id);

    const pemain1 = hydratePeserta(
      pl1,
      storedP1Id || crypto.randomUUID(),
      config.namaPemain1 || 'Pemain 1',
      rawParsed.pemain1Efek
    );
    const pemain2 = hydratePeserta(
      pl2,
      storedP2Id || crypto.randomUUID(),
      config.namaPemain2 || (isBotLawan ? 'Lawan Bot' : 'Pemain 2'),
      rawParsed.pemain2Efek
    );

    const savedState = rawParsed.state as StatePanjatPinangSolo | undefined;
    let state: StatePanjatPinangSolo;
    if (sessionDb.status === 'lobi') {
      state = 'READY';
    } else if (sessionDb.status === 'jalan') {
      state = savedState === 'PAUSED' ? 'PAUSED' : 'PLAYING';
    } else {
      state = savedState === 'STOPPED' ? 'STOPPED' : 'FINISHED';
    }

    const processedPresentations = new Set<string>();
    for (const p of [pemain1, pemain2]) {
      for (const jw of p.riwayatJawaban) {
        if (jw.presentationId) processedPresentations.add(jw.presentationId);
      }
    }

    const nowMs = Date.now();
    const sesi: SesiPanjatPinangSoloActive = {
      sessionId: sessionDb.id,
      hostId: sessionDb.hostId,
      templateId: sessionDb.templateId,
      templateJudul: sessionDb.template.judul,
      state,
      status:
        sessionDb.status === 'lobi' || sessionDb.status === 'jalan'
          ? sessionDb.status
          : 'selesai',
      config,
      questions,
      totalSoal: questions.length,
      pemain1,
      pemain2,
      isBotLawan,
      botNextActionAtMs: state === 'PLAYING' && isBotLawan ? nowMs + hitungDelayBotMs(config.kesulitanBot) : null,
      mulaiPadaMs: sessionDb.mulaiPada ? sessionDb.mulaiPada.getTime() : null,
      pausedPadaMs: typeof rawParsed.pausedPadaMs === 'number' ? rawParsed.pausedPadaMs : null,
      totalPausedMs: typeof rawParsed.totalPausedMs === 'number' ? rawParsed.totalPausedMs : 0,
      selesaiPadaMs: sessionDb.selesaiPada ? sessionDb.selesaiPada.getTime() : null,
      terakhirFeedback: null,
      processedPresentations,
    };

    if (state === 'PLAYING') {
      siapkanSoalUntukSlot(sesi, 'pemain1', nowMs);
      siapkanSoalUntukSlot(sesi, 'pemain2', nowMs);
    } else if (state === 'FINISHED' || state === 'STOPPED') {
      sesi.hasil = buatLaporanAkhirPanjat(
        toSesiPanjatActive(sesi),
        state === 'STOPPED',
        sesi.selesaiPadaMs || nowMs
      );
    }

    sesiPanjatSoloMap.set(sessionId, sesi);
    return sesi;
  },

  mulaiSesi(
    sessionId: string,
    hostId: string,
    nowMs: number = Date.now(),
    rngBot: RngBotPanjat = defaultRngBot
  ): SesiPanjatPinangSoloActive {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Panjat Pinang Solo tidak ditemukan.');
    }
    if (sesi.state === 'PLAYING') {
      return sesi;
    }
    if (sesi.state === 'FINISHED' || sesi.state === 'STOPPED') {
      throw new Error('Permainan sudah berakhir. Gunakan fitur Main Lagi atau Ulang Permainan.');
    }
    if (sesi.questions.length === 0) {
      throw new Error('Sesi tidak dapat dimulai karena bank soal kosong.');
    }

    sesi.state = 'PLAYING';
    sesi.status = 'jalan';
    sesi.mulaiPadaMs = nowMs;
    sesi.pausedPadaMs = null;
    sesi.totalPausedMs = 0;

    siapkanSoalUntukSlot(sesi, 'pemain1', nowMs);
    siapkanSoalUntukSlot(sesi, 'pemain2', nowMs);
    if (sesi.isBotLawan) {
      sesi.botNextActionAtMs = nowMs + hitungDelayBotMs(sesi.config.kesulitanBot, rngBot);
    }

    void this.simpanStatusKeDatabase(sesi);
    return sesi;
  },

  ubahKesulitanBot(
    sessionId: string,
    hostId: string,
    kesulitanBot: KonfigurasiPanjatPinang['kesulitanBot'],
    nowMs: number = Date.now()
  ): SesiPanjatPinangSoloActive {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Panjat Pinang Solo tidak ditemukan.');
    }

    sesi.config = bangunKonfigurasiPanjatPinang({
      ...sesi.config,
      kesulitanBot,
      maxPeserta: 2,
      allowLateJoin: false,
    });

    if (sesi.isBotLawan && sesi.state === 'PLAYING') {
      const targetBaru = nowMs + hitungDelayBotMs(sesi.config.kesulitanBot);
      if (sesi.botNextActionAtMs === null || targetBaru < sesi.botNextActionAtMs) {
        sesi.botNextActionAtMs = targetBaru;
      }
    }

    void this.simpanStatusKeDatabase(sesi);
    return sesi;
  },

  ubahStateSesi(
    sessionId: string,
    hostId: string,
    aksi: 'pause' | 'resume' | 'start',
    nowMs: number = Date.now()
  ): SesiPanjatPinangSoloActive {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Panjat Pinang Solo tidak ditemukan.');
    }

    if (aksi === 'start') {
      return this.mulaiSesi(sessionId, hostId, nowMs);
    }

    if (aksi === 'pause') {
      if (sesi.state !== 'PLAYING') {
        throw new Error('Permainan hanya dapat dijeda saat sedang berlangsung.');
      }
      sesi.state = 'PAUSED';
      sesi.pausedPadaMs = nowMs;
      void this.simpanStatusKeDatabase(sesi);
      return sesi;
    }

    // resume
    if (sesi.state !== 'PAUSED') {
      throw new Error('Permainan tidak sedang dijeda.');
    }

    const pauseDelta = sesi.pausedPadaMs ? Math.max(0, nowMs - sesi.pausedPadaMs) : 0;
    sesi.totalPausedMs += pauseDelta;
    sesi.pausedPadaMs = null;
    sesi.state = 'PLAYING';

    if (sesi.pemain1.presentasiAktif) {
      sesi.pemain1.presentasiAktif.ditampilkanPadaMs += pauseDelta;
    } else {
      siapkanSoalUntukSlot(sesi, 'pemain1', nowMs);
    }

    if (sesi.pemain2.presentasiAktif) {
      sesi.pemain2.presentasiAktif.ditampilkanPadaMs += pauseDelta;
    } else {
      siapkanSoalUntukSlot(sesi, 'pemain2', nowMs);
    }

    if (sesi.isBotLawan) {
      sesi.botNextActionAtMs =
        sesi.botNextActionAtMs !== null
          ? Math.max(nowMs + 450, sesi.botNextActionAtMs + pauseDelta)
          : nowMs + hitungDelayBotMs(sesi.config.kesulitanBot);
    }

    void this.simpanStatusKeDatabase(sesi);
    return sesi;
  },

  _eksekusiJawabanSlot(
    sesi: SesiPanjatPinangSoloActive,
    slot: SlotPemainSoloPanjat,
    params: {
      presentationId?: string;
      questionId?: string;
      choiceId?: string;
      jawaban?: string;
      timedOut?: boolean;
      nowMs?: number;
      rngRintangan?: RngRintangan;
      rngBot?: RngBotPanjat;
    }
  ): {
    sesi: SesiPanjatPinangSoloActive;
    hasilJawaban: HasilJawabanPanjat;
    feedback: FeedbackAksiPanjatSolo;
    isFinished: boolean;
  } {
    const nowMs = params.nowMs ?? Date.now();

    if (sesi.state === 'PAUSED') {
      throw new Error('Permainan sedang dijeda.');
    }
    if (sesi.state !== 'PLAYING') {
      throw new Error('Permainan belum dimulai atau sudah berakhir.');
    }

    const peserta = slot === 'pemain1' ? sesi.pemain1 : sesi.pemain2;
    if (peserta.status === 'selesai' || peserta.posisi >= 100) {
      throw new Error('Pemain sudah mencapai puncak 100%.');
    }

    const presentasi = peserta.presentasiAktif;
    if (!presentasi) {
      throw new Error('Tidak ada pertanyaan aktif untuk pemain ini.');
    }

    if (params.presentationId && presentasi.presentationId !== params.presentationId) {
      throw new Error('Pertanyaan sudah kedaluwarsa atau jawaban sudah diproses.');
    }
    if (params.questionId && presentasi.questionId !== params.questionId) {
      throw new Error('Identitas pertanyaan tidak sesuai.');
    }
    if (sesi.processedPresentations.has(presentasi.presentationId)) {
      throw new Error('Jawaban ganda terdeteksi.');
    }

    sesi.processedPresentations.add(presentasi.presentationId);

    const effectiveStartMs = buildEffectiveStartMs(sesi, nowMs);
    let hasilJawaban: HasilJawabanPanjat;
    try {
      hasilJawaban = prosesJawabanPanjatPinang({
        peserta,
        presentasi,
        choiceId: params.choiceId,
        fallbackJawabanKey: params.jawaban,
        timedOut: Boolean(params.timedOut),
        config: sesi.config,
        gameMulaiPadaMs: effectiveStartMs,
        nowMs,
        rngRintangan: params.rngRintangan,
      });
    } catch (err) {
      sesi.processedPresentations.delete(presentasi.presentationId);
      throw err;
    }

    if (slot === 'pemain1') {
      sesi.pemain1 = hasilJawaban.pesertaUpdated;
    } else {
      sesi.pemain2 = hasilJawaban.pesertaUpdated;
    }

    const soal = sesi.questions.find((q) => q.id === presentasi.questionId);
    const feedback: FeedbackAksiPanjatSolo = {
      slot,
      nama: hasilJawaban.pesertaUpdated.nama,
      benar: hasilJawaban.benar,
      timedOut: Boolean(hasilJawaban.timedOut),
      isBonusKulitPisang: hasilJawaban.isBonusKulitPisang,
      jawabanDipilihKey: hasilJawaban.pilihanDipilih?.key || null,
      kunciKey: presentasi.kunciKey,
      penjelasan: soal?.penjelasan || null,
      posisiSebelum: hasilJawaban.posisiSebelum,
      posisiBaru: hasilJawaban.posisiBaru,
      perubahanPosisi: hasilJawaban.perubahanPosisi,
      bonusStreakDidapat: hasilJawaban.bonusStreakDidapat,
      bonusPeganganKuatDidapat: hasilJawaban.bonusPeganganKuatDidapat,
      penaltiTiangLicin: hasilJawaban.penaltiTiangLicin,
      perisaiDigunakan: hasilJawaban.perisaiDigunakan,
      perisaiDiperoleh: hasilJawaban.perisaiDiperoleh,
      rintanganBaru: hasilJawaban.rintanganBaru,
      selesaiBaru: hasilJawaban.selesaiBaru,
      waktuJawabMs: hasilJawaban.waktuJawabMs,
      timestampMs: nowMs,
    };

    sesi.terakhirFeedback = feedback;

    const isFinished =
      hasilJawaban.pesertaUpdated.status === 'selesai' ||
      hasilJawaban.pesertaUpdated.posisi >= 100;

    if (isFinished) {
      sesi.state = 'FINISHED';
      sesi.status = 'selesai';
      sesi.selesaiPadaMs = nowMs;
      sesi.botNextActionAtMs = null;
      sesi.pemain1.presentasiAktif = null;
      sesi.pemain2.presentasiAktif = null;
      sesi.hasil = buatLaporanAkhirPanjat(toSesiPanjatActive(sesi), false, nowMs);
    } else {
      siapkanSoalUntukSlot(sesi, slot, nowMs);
      if (slot === 'pemain2' && sesi.isBotLawan) {
        sesi.botNextActionAtMs = nowMs + hitungDelayBotMs(sesi.config.kesulitanBot, params.rngBot);
      }
      void this.simpanProgresPemainKeDatabase(sesi, hasilJawaban.pesertaUpdated);
    }

    return { sesi, hasilJawaban, feedback, isFinished };
  },

  prosesJawaban(
    sessionId: string,
    hostId: string,
    params: {
      slot?: SlotPemainSoloPanjat;
      pesertaId?: string;
      presentationId?: string;
      questionId?: string;
      choiceId?: string;
      jawaban?: string;
      timedOut?: boolean;
      nowMs?: number;
      rngRintangan?: RngRintangan;
    }
  ): {
    sesi: SesiPanjatPinangSoloActive;
    hasilJawaban: HasilJawabanPanjat;
    feedback: FeedbackAksiPanjatSolo;
    isFinished: boolean;
  } {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Panjat Pinang Solo tidak ditemukan.');
    }

    let slot: SlotPemainSoloPanjat = 'pemain1';
    if (params.slot === 'pemain2' || params.slot === 'pemain1') {
      slot = params.slot;
    } else if (params.pesertaId) {
      if (params.pesertaId === sesi.pemain2.id) slot = 'pemain2';
      else if (params.pesertaId === sesi.pemain1.id) slot = 'pemain1';
    }

    if (slot === 'pemain2' && sesi.isBotLawan) {
      throw new Error('Lawan Bot dikendalikan otomatis oleh sistem.');
    }

    return this._eksekusiJawabanSlot(sesi, slot, params);
  },

  jalankanLangkahBot(
    sessionId: string,
    hostId: string,
    options?: {
      nowMs?: number;
      forceStep?: boolean;
      rngBot?: RngBotPanjat;
      rngRintangan?: RngRintangan;
    }
  ): {
    acted: boolean;
    sesi: SesiPanjatPinangSoloActive;
    feedback: FeedbackAksiPanjatSolo | null;
    isFinished: boolean;
  } {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Panjat Pinang Solo tidak ditemukan.');
    }

    const nowMs = options?.nowMs ?? Date.now();
    const rngBot = options?.rngBot ?? defaultRngBot;

    if (!sesi.isBotLawan || sesi.state !== 'PLAYING') {
      return { acted: false, sesi, feedback: null, isFinished: false };
    }

    if (sesi.pemain2.status === 'selesai' || sesi.pemain2.posisi >= 100) {
      return { acted: false, sesi, feedback: null, isFinished: false };
    }

    let presentasi = sesi.pemain2.presentasiAktif;
    if (!presentasi) {
      presentasi = siapkanSoalUntukSlot(sesi, 'pemain2', nowMs);
      if (!presentasi) {
        return { acted: false, sesi, feedback: null, isFinished: false };
      }
      if (sesi.botNextActionAtMs === null) {
        sesi.botNextActionAtMs = nowMs + hitungDelayBotMs(sesi.config.kesulitanBot, rngBot);
      }
    }

    if (!options?.forceStep && sesi.botNextActionAtMs !== null && nowMs < sesi.botNextActionAtMs) {
      return { acted: false, sesi, feedback: null, isFinished: false };
    }

    const botParam = BOT_PARAM_BY_KESULITAN[sesi.config.kesulitanBot] || BOT_PARAM_BY_KESULITAN.sedang;
    const jawabBenar = rngBot.akurasiRoll() < botParam.accuracy;

    const opsiBenar = presentasi.pilihan.find((o) => o.key === presentasi!.kunciKey);
    const opsiSalahList = presentasi.pilihan.filter((o) => o.key !== presentasi!.kunciKey);

    let chosenOption = opsiBenar || presentasi.pilihan[0];
    if (!jawabBenar && opsiSalahList.length > 0) {
      const idx = Math.min(
        opsiSalahList.length - 1,
        Math.max(0, rngBot.pilihanSalahIndex(opsiSalahList.length))
      );
      chosenOption = opsiSalahList[idx];
    }

    const res = this._eksekusiJawabanSlot(sesi, 'pemain2', {
      presentationId: presentasi.presentationId,
      questionId: presentasi.questionId,
      choiceId: chosenOption.choiceId,
      nowMs,
      rngRintangan: options?.rngRintangan,
      rngBot,
    });

    return {
      acted: true,
      sesi: res.sesi,
      feedback: res.feedback,
      isFinished: res.isFinished,
    };
  },

  hentikanPermainan(
    sessionId: string,
    hostId: string,
    nowMs: number = Date.now()
  ): SesiPanjatPinangSoloActive {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Panjat Pinang Solo tidak ditemukan.');
    }

    if (sesi.state === 'FINISHED' || sesi.state === 'STOPPED') {
      return sesi;
    }

    sesi.state = 'STOPPED';
    sesi.status = 'selesai';
    sesi.selesaiPadaMs = nowMs;
    sesi.botNextActionAtMs = null;
    sesi.pemain1.presentasiAktif = null;
    sesi.pemain2.presentasiAktif = null;
    sesi.hasil = buatLaporanAkhirPanjat(toSesiPanjatActive(sesi), true, nowMs);
    return sesi;
  },

  async ulangPermainan(
    sessionId: string,
    hostId: string,
    autoStart: boolean = false,
    nowMs: number = Date.now()
  ): Promise<SesiPanjatPinangSoloActive> {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Panjat Pinang Solo tidak ditemukan.');
    }

    sesi.pemain1 = buatPesertaSoloKosong(sesi.pemain1.id, sesi.pemain1.nama, sesi.questions);
    sesi.pemain2 = buatPesertaSoloKosong(sesi.pemain2.id, sesi.pemain2.nama, sesi.questions);
    sesi.state = autoStart ? 'PLAYING' : 'READY';
    sesi.status = autoStart ? 'jalan' : 'lobi';
    sesi.mulaiPadaMs = autoStart ? nowMs : null;
    sesi.pausedPadaMs = null;
    sesi.totalPausedMs = 0;
    sesi.selesaiPadaMs = null;
    sesi.botNextActionAtMs = null;
    sesi.terakhirFeedback = null;
    sesi.processedPresentations.clear();
    sesi.hasil = undefined;

    if (autoStart) {
      siapkanSoalUntukSlot(sesi, 'pemain1', nowMs);
      siapkanSoalUntukSlot(sesi, 'pemain2', nowMs);
      if (sesi.isBotLawan) {
        sesi.botNextActionAtMs = nowMs + hitungDelayBotMs(sesi.config.kesulitanBot);
      }
    }

    await antrekanPenulisanDb(sesi.sessionId, async () => {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.sessionResult.deleteMany({ where: { sessionId: sesi.sessionId } });
          await tx.questionStat.deleteMany({ where: { sessionId: sesi.sessionId } });
          await tx.sessionPlayer.deleteMany({ where: { sessionId: sesi.sessionId } });
          await tx.session.update({
            where: { id: sesi.sessionId },
            data: {
              status: sesi.status,
              mulaiPada: sesi.mulaiPadaMs ? new Date(sesi.mulaiPadaMs) : null,
              selesaiPada: null,
              konfigurasi: serialisasiKonfigurasiDb(sesi),
            },
          });
        });
      } catch {
        // Abaikan jika sesi in-memory murni (pengujian)
      }
    });

    return sesi;
  },

  async simpanProgresPemainKeDatabase(
    sesi: SesiPanjatPinangSoloActive,
    p: PesertaPanjatState
  ): Promise<void> {
    return antrekanPenulisanDb(sesi.sessionId, async () => {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.session.update({
            where: { id: sesi.sessionId },
            data: { konfigurasi: serialisasiKonfigurasiDb(sesi) },
          });
          const payload = buildPlayerDbPayload(p);
          await tx.sessionPlayer.upsert({
            where: { id: p.id },
            update: payload,
            create: {
              id: p.id,
              sessionId: sesi.sessionId,
              ...payload,
            },
          });
        });
      } catch {
        // Abaikan pada unit test in-memory
      }
    });
  },

  async simpanStatusKeDatabase(sesi: SesiPanjatPinangSoloActive): Promise<void> {
    return antrekanPenulisanDb(sesi.sessionId, async () => {
      try {
        await prisma.session.update({
          where: { id: sesi.sessionId },
          data: {
            status: sesi.status,
            mulaiPada: sesi.mulaiPadaMs ? new Date(sesi.mulaiPadaMs) : null,
            selesaiPada: sesi.selesaiPadaMs ? new Date(sesi.selesaiPadaMs) : null,
            konfigurasi: serialisasiKonfigurasiDb(sesi),
          },
        });
      } catch {
        // Abaikan pada unit test in-memory
      }
    });
  },

  async simpanHasilKeDatabase(sesi: SesiPanjatPinangSoloActive): Promise<void> {
    const nowMs = sesi.selesaiPadaMs || Date.now();
    const hasil =
      sesi.hasil || buatLaporanAkhirPanjat(toSesiPanjatActive(sesi), sesi.state === 'STOPPED', nowMs);
    sesi.hasil = hasil;

    const winner = tentukanPemenangSolo(sesi);
    const stats = buildQuestionStats(sesi);

    return antrekanPenulisanDb(sesi.sessionId, async () => {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.session.update({
            where: { id: sesi.sessionId },
            data: {
              status: 'selesai',
              mulaiPada: sesi.mulaiPadaMs ? new Date(sesi.mulaiPadaMs) : null,
              selesaiPada: new Date(hasil.selesaiPadaMs),
              konfigurasi: serialisasiKonfigurasiDb(sesi),
            },
          });

          await tx.sessionResult.upsert({
            where: { sessionId: sesi.sessionId },
            update: {
              timMenang: winner.winnerNama || hasil.podium.juara1?.nama || 'Selesai',
              posisiAkhir: hasil.podium.juara1?.posisi ?? 0,
              skorMerah: hasil.totalSelesai,
              skorPutih: hasil.totalPeserta,
            },
            create: {
              sessionId: sesi.sessionId,
              timMenang: winner.winnerNama || hasil.podium.juara1?.nama || 'Selesai',
              posisiAkhir: hasil.podium.juara1?.posisi ?? 0,
              skorMerah: hasil.totalSelesai,
              skorPutih: hasil.totalPeserta,
            },
          });

          for (const p of [sesi.pemain1, sesi.pemain2]) {
            const payload = buildPlayerDbPayload(p);
            await tx.sessionPlayer.upsert({
              where: { id: p.id },
              update: payload,
              create: {
                id: p.id,
                sessionId: sesi.sessionId,
                ...payload,
              },
            });
          }

          await tx.questionStat.deleteMany({
            where: { sessionId: sesi.sessionId },
          });

          for (const st of stats) {
            await tx.questionStat.create({
              data: {
                sessionId: sesi.sessionId,
                questionId: st.questionId,
                jumlahBenar: st.jumlahBenar,
                jumlahSalah: st.jumlahSalah,
              },
            });
          }
        });
      } catch {
        // Sesi in-memory test
      }
    });
  },

  serialisasiUntukClient(sesi: SesiPanjatPinangSoloActive): SesiPanjatPinangSoloClient {
    const isFinished = sesi.state === 'FINISHED' || sesi.state === 'STOPPED';
    const winner = tentukanPemenangSolo(sesi);
    return {
      sessionId: sesi.sessionId,
      game: 'panjat_pinang',
      mode: 'solo',
      playMode: 'SOLO',
      state: sesi.state,
      status: sesi.status,
      templateId: sesi.templateId,
      templateJudul: sesi.templateJudul,
      totalSoal: sesi.totalSoal,
      config: sesi.config,
      isBotLawan: sesi.isBotLawan,
      pemain1: toPesertaClient(sesi.pemain1, 'pemain1', false, sesi.totalSoal),
      pemain2: toPesertaClient(sesi.pemain2, 'pemain2', sesi.isBotLawan, sesi.totalSoal),
      mulaiPadaMs: sesi.mulaiPadaMs,
      pausedPadaMs: sesi.pausedPadaMs,
      totalPausedMs: sesi.totalPausedMs,
      selesaiPadaMs: sesi.selesaiPadaMs,
      botNextActionAtMs: sesi.botNextActionAtMs,
      terakhirFeedback: sesi.terakhirFeedback,
      leaderboard: buildLeaderboardSolo(sesi),
      isFinished,
      winnerSlot: winner.winnerSlot,
      winnerNama: winner.winnerNama,
      hasil:
        isFinished
          ? sesi.hasil ||
            buatLaporanAkhirPanjat(
              toSesiPanjatActive(sesi),
              sesi.state === 'STOPPED',
              sesi.selesaiPadaMs || Date.now()
            )
          : null,
      questionStats: buildQuestionStats(sesi),
    };
  },

  async muatLaporanDariDatabase(sessionId: string): Promise<LaporanAkhirPanjatPinang | null> {
    const inMem = this.dapatkanSesi(sessionId);
    if (inMem?.hasil) return inMem.hasil;
    if (inMem) {
      return buatLaporanAkhirPanjat(
        toSesiPanjatActive(inMem),
        inMem.state === 'STOPPED',
        inMem.selesaiPadaMs || Date.now()
      );
    }

    const pulihan = await this.pulihkanSesiDariDb(sessionId);
    if (pulihan) {
      return (
        pulihan.hasil ||
        buatLaporanAkhirPanjat(
          toSesiPanjatActive(pulihan),
          pulihan.state === 'STOPPED',
          pulihan.selesaiPadaMs || Date.now()
        )
      );
    }

    return panjatPinangManager.muatLaporanDariDatabase(sessionId);
  },
};
