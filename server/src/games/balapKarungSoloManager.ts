import crypto from 'crypto';
import {
  KonfigurasiBalapKarung,
  PesertaBalapKarungState,
  PresentasiSoalBalap,
  OpsiPilihanBalap,
  SoalBalapKarung,
  HasilJawabanBalap,
  RiwayatJarakEntry,
  RiwayatRintanganBalapEntry,
  KesulitanBotBalap,
  KATA_TERSANDUNG_BALAP,
  bangunKonfigurasiBalapKarung,
  buatPresentasiSoalBalap,
  prosesJawabanBalapKarung,
  urutkanLeaderboardBalapKarung,
} from './balapKarung.js';
import {
  LeaderboardItemBalap,
  LaporanAkhirBalapKarung,
  LaporanPemainBalap,
  siapkanAntreanSoalBalap,
} from './balapKarungManager.js';
import { prisma } from '../db.js';
import { mapDbQuestionForGame } from '../utils/questionOptions.js';

export type StateBalapKarungSolo = 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED' | 'STOPPED';
export type SlotPemainSoloBalap = 'pemain1' | 'pemain2';

export interface SoalAktifBalapSolo {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  totalSoalBank: number;
  teks: string;
  pilihan: OpsiPilihanBalap[];
  ditampilkanPadaMs: number;
  waktuPerSoalDetik: number;
}

export interface PesertaClientBalapSolo {
  slot: SlotPemainSoloBalap;
  id: string;
  nama: string;
  isBot: boolean;
  jarak: number;
  targetJarak: number;
  keseimbangan: number;
  jumlahJatuh: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakSaatIni: number;
  streakTertinggi: number;
  totalBonusStreakKali: number;
  totalBonusStreakMeter: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs: number | null;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  efekAktif: PesertaBalapKarungState['efekAktif'];
  riwayatRintangan: RiwayatRintanganBalapEntry[];
  soalAktif: SoalAktifBalapSolo | null;
}

export interface FeedbackAksiBalapSolo {
  slot: SlotPemainSoloBalap;
  nama: string;
  benar: boolean;
  timedOut?: boolean;
  stumbleQuote?: string | null;
  jawabanBenarKode: string;
  jawabanBenarTeks: string;
  penjelasan: string | null;
  jarakSebelum: number;
  jarakBaru: number;
  perubahanJarak: number;
  keseimbanganBaru: number;
  streakSaatIni: number;
  bonusStreakJarakDidapat: number;
  bonusStreakKeseimbanganDidapat: number;
  bonusLompatanKuatDidapat: number;
  penaltiJalanBerlumpurDipakai: number;
  terjatuh: boolean;
  penaltiJatuhJarak: number;
  perisaiDigunakan: boolean;
  rintanganBaru: RiwayatRintanganBalapEntry | null;
  selesaiBaru: boolean;
}

export interface SesiBalapKarungSoloActive {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  hostId: string;
  state: StateBalapKarungSolo;
  config: KonfigurasiBalapKarung;
  questions: SoalBalapKarung[];
  pemain1: PesertaBalapKarungState;
  pemain2: PesertaBalapKarungState;
  gameMulaiPadaMs: number | null;
  lastBotTickMs: number;
  processedPresentations: Set<string>;
  questionStatsMap: Map<string, { benar: number; salah: number }>;
  hasil?: LaporanAkhirBalapKarung & {
    questionStats?: Array<{
      questionId: string;
      nomorSoal: number;
      teksSoal: string;
      jumlahBenar: number;
      jumlahSalah: number;
    }>;
  };
}

export interface SesiBalapKarungSoloClient {
  sessionId: string;
  game: 'balap_karung';
  mode: 'solo';
  playMode: 'SOLO';
  templateId: string;
  templateJudul: string;
  state: StateBalapKarungSolo;
  config: KonfigurasiBalapKarung;
  totalSoalBank: number;
  pemain1: PesertaClientBalapSolo;
  pemain2: PesertaClientBalapSolo;
  leaderboard: LeaderboardItemBalap[];
  isFinished: boolean;
  hasil: SesiBalapKarungSoloActive['hasil'] | null;
}

const sesiSoloBalapMap = new Map<string, SesiBalapKarungSoloActive>();

const BOT_CONFIG_MAP = {
  santai: { minCooldownMs: 4200, thinkMinMs: 4200, thinkMaxMs: 5200, accuracyPercent: 50 },
  sedang: { minCooldownMs: 3600, thinkMinMs: 3600, thinkMaxMs: 4600, accuracyPercent: 65 },
  cepat: { minCooldownMs: 3000, thinkMinMs: 3000, thinkMaxMs: 4000, accuracyPercent: 80 },
} as const;

function buatPesertaKosong(
  id: string,
  nama: string,
  config: KonfigurasiBalapKarung,
  questions: SoalBalapKarung[]
): PesertaBalapKarungState {
  return {
    id,
    secretToken: crypto.randomUUID(),
    socketId: '',
    nama,
    connected: true,
    jarak: 0,
    keseimbangan: config.keseimbanganAktif ? 100 : 100,
    jumlahJatuh: 0,
    totalBenar: 0,
    totalSalah: 0,
    streakSaatIni: 0,
    streakTertinggi: 0,
    bonus3DalamStreak: false,
    bonus5DalamStreak: false,
    totalBonusStreakKali: 0,
    totalBonusStreakMeter: 0,
    status: 'bermain',
    waktuSelesaiMs: null,
    selesaiPada: null,
    totalWaktuJawabMs: 0,
    jumlahJawab: 0,
    rataRataWaktuJawabMs: 0,
    efekAktif: {
      perisai: false,
      lompatanKuat: false,
      jalanBerlumpur: false,
    },
    riwayatJarak: [],
    riwayatRintangan: [],
    riwayatJawaban: [],
    antreanSoal: siapkanAntreanSoalBalap(questions),
    terakhirSoalId: undefined,
    presentasiAktif: null,
    nomorSoalPemain: 0,
  };
}

function serializeEfekMeta(p: PesertaBalapKarungState): string {
  return JSON.stringify({
    perisai: p.efekAktif.perisai,
    lompatanKuat: p.efekAktif.lompatanKuat,
    jalanBerlumpur: p.efekAktif.jalanBerlumpur,
    bonus3DalamStreak: p.bonus3DalamStreak,
    bonus5DalamStreak: p.bonus5DalamStreak,
    totalBonusStreakKali: p.totalBonusStreakKali,
    totalBonusStreakMeter: p.totalBonusStreakMeter,
  });
}

function parseEfekMeta(raw?: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return {};
  }
}

function siapkanSoalUntukPeserta(
  peserta: PesertaBalapKarungState,
  questions: SoalBalapKarung[],
  nowMs: number = Date.now()
): PresentasiSoalBalap | null {
  if (!questions || questions.length === 0) return null;
  if (peserta.antreanSoal.length === 0) {
    peserta.antreanSoal = siapkanAntreanSoalBalap(questions, peserta.terakhirSoalId);
  }
  const nextId = peserta.antreanSoal.shift() || questions[0].id;
  const soal = questions.find((q) => q.id === nextId) || questions[0];

  peserta.nomorSoalPemain += 1;
  peserta.terakhirSoalId = soal.id;
  const pres = buatPresentasiSoalBalap(soal, peserta.nomorSoalPemain, nowMs);
  peserta.presentasiAktif = pres;
  return pres;
}

function formatLeaderboardItemSolo(
  p: PesertaBalapKarungState,
  peringkat: number,
  targetJarak: number
): LeaderboardItemBalap {
  const totalJawab = p.totalBenar + p.totalSalah;
  const akurasiPersen = totalJawab > 0 ? Math.round((p.totalBenar / totalJawab) * 100) : 0;
  return {
    peringkat,
    id: p.id,
    nama: p.nama,
    connected: true,
    jarak: p.jarak,
    targetJarak,
    keseimbangan: p.keseimbangan,
    jumlahJatuh: p.jumlahJatuh,
    totalBenar: p.totalBenar,
    totalSalah: p.totalSalah,
    akurasiPersen,
    streakSaatIni: p.streakSaatIni,
    streakTertinggi: p.streakTertinggi,
    totalBonusStreakKali: p.totalBonusStreakKali,
    totalBonusStreakMeter: p.totalBonusStreakMeter,
    status: p.status,
    waktuSelesaiMs: p.waktuSelesaiMs,
    rataRataWaktuJawabMs: p.rataRataWaktuJawabMs,
    jumlahJawab: p.jumlahJawab,
    efekAktif: { ...p.efekAktif },
  };
}

function formatPesertaClient(
  p: PesertaBalapKarungState,
  slot: SlotPemainSoloBalap,
  config: KonfigurasiBalapKarung,
  totalSoalBank: number,
  exposeSoal: boolean
): PesertaClientBalapSolo {
  const totalJawab = p.totalBenar + p.totalSalah;
  const akurasiPersen = totalJawab > 0 ? Math.round((p.totalBenar / totalJawab) * 100) : 0;
  return {
    slot,
    id: p.id,
    nama: p.nama,
    isBot: slot === 'pemain2' && config.tipeLawanSolo === 'bot',
    jarak: p.jarak,
    targetJarak: config.targetJarak,
    keseimbangan: config.keseimbanganAktif ? p.keseimbangan : 100,
    jumlahJatuh: p.jumlahJatuh,
    totalBenar: p.totalBenar,
    totalSalah: p.totalSalah,
    akurasiPersen,
    streakSaatIni: p.streakSaatIni,
    streakTertinggi: p.streakTertinggi,
    totalBonusStreakKali: p.totalBonusStreakKali,
    totalBonusStreakMeter: p.totalBonusStreakMeter,
    status: p.status,
    waktuSelesaiMs: p.waktuSelesaiMs,
    rataRataWaktuJawabMs: p.rataRataWaktuJawabMs,
    jumlahJawab: p.jumlahJawab,
    efekAktif: { ...p.efekAktif },
    riwayatRintangan: [...p.riwayatRintangan],
    soalAktif:
      exposeSoal && p.presentasiAktif
        ? {
            presentationId: p.presentasiAktif.presentationId,
            questionId: p.presentasiAktif.questionId,
            nomorSoal: p.presentasiAktif.nomorSoal,
            totalSoalBank,
            teks: p.presentasiAktif.teks,
            pilihan: p.presentasiAktif.pilihan,
            ditampilkanPadaMs: p.presentasiAktif.ditampilkanPadaMs,
            waktuPerSoalDetik: config.waktuPerSoalDetik,
          }
        : null,
  };
}

function buatLaporanAkhirSolo(
  sesi: SesiBalapKarungSoloActive,
  dihentikanManual: boolean,
  selesaiPadaMs: number = Date.now()
): SesiBalapKarungSoloActive['hasil'] {
  const sorted = urutkanLeaderboardBalapKarung(
    [sesi.pemain1, sesi.pemain2],
    sesi.config.targetJarak
  );
  const leaderboard = sorted.map((p, idx) =>
    formatLeaderboardItemSolo(p, idx + 1, sesi.config.targetJarak)
  );

  let totalJawabanBenar = 0;
  let totalJawabanSalah = 0;
  let totalSelesai = 0;
  let totalJatuhKelas = 0;

  const laporanPemain: LaporanPemainBalap[] = sorted.map((p, idx) => {
    totalJawabanBenar += p.totalBenar;
    totalJawabanSalah += p.totalSalah;
    totalJatuhKelas += p.jumlahJatuh;
    if (p.status === 'selesai') totalSelesai += 1;
    const totalJawab = p.totalBenar + p.totalSalah;
    const akurasiPersen = totalJawab > 0 ? Math.round((p.totalBenar / totalJawab) * 100) : 0;

    return {
      peringkat: idx + 1,
      id: p.id,
      nama: p.nama,
      jarakAkhir: p.jarak,
      targetJarak: sesi.config.targetJarak,
      keseimbanganAkhir: sesi.config.keseimbanganAktif ? p.keseimbangan : 100,
      jumlahJatuh: p.jumlahJatuh,
      status: p.status,
      totalBenar: p.totalBenar,
      totalSalah: p.totalSalah,
      akurasiPersen,
      streakTertinggi: p.streakTertinggi,
      streakSaatIni: p.streakSaatIni,
      totalBonusStreakKali: p.totalBonusStreakKali,
      totalBonusStreakMeter: p.totalBonusStreakMeter,
      rataRataWaktuJawabMs: p.rataRataWaktuJawabMs,
      waktuSelesaiMs: p.waktuSelesaiMs,
      riwayatRintangan: [...p.riwayatRintangan],
      riwayatJarak: [...p.riwayatJarak],
    };
  });

  const questionStats = sesi.questions.map((q) => {
    const st = sesi.questionStatsMap.get(q.id) || { benar: 0, salah: 0 };
    return {
      questionId: q.id,
      nomorSoal: q.urutan,
      teksSoal: q.teks,
      jumlahBenar: st.benar,
      jumlahSalah: st.salah,
    };
  });

  return {
    sessionId: sesi.sessionId,
    templateId: sesi.templateId,
    templateJudul: sesi.templateJudul,
    konfigurasi: sesi.config,
    totalPeserta: 2,
    totalSelesai,
    totalSoalTemplate: sesi.questions.length,
    totalJawabanBenar,
    totalJawabanSalah,
    totalJatuhKelas,
    dihentikanManual,
    mulaiPadaMs: sesi.gameMulaiPadaMs,
    selesaiPadaMs,
    leaderboard,
    laporanPemain,
    podium: {
      juara1: leaderboard[0],
      juara2: leaderboard[1],
    },
    questionStats,
  };
}

function bangunFeedback(
  slot: SlotPemainSoloBalap,
  pesertaNama: string,
  presentasi: PresentasiSoalBalap,
  penjelasan: string | null,
  hasilJawaban: HasilJawabanBalap
): FeedbackAksiBalapSolo {
  const opsiBenar = presentasi.pilihan.find((o) => o.choiceId === presentasi.kunciChoiceId);
  const stumbleQuote = !hasilJawaban.benar
    ? KATA_TERSANDUNG_BALAP[crypto.randomInt(0, KATA_TERSANDUNG_BALAP.length)] || 'Aduh!'
    : null;
  return {
    slot,
    nama: pesertaNama,
    benar: hasilJawaban.benar,
    timedOut: hasilJawaban.timedOut,
    stumbleQuote,
    jawabanBenarKode: presentasi.kunciKey,
    jawabanBenarTeks: opsiBenar?.teks || '',
    penjelasan,
    jarakSebelum: hasilJawaban.jarakSebelum,
    jarakBaru: hasilJawaban.jarakBaru,
    perubahanJarak: hasilJawaban.perubahanJarak,
    keseimbanganBaru: hasilJawaban.keseimbanganBaru,
    streakSaatIni: hasilJawaban.pesertaUpdated.streakSaatIni,
    bonusStreakJarakDidapat: hasilJawaban.bonusStreakJarakDidapat,
    bonusStreakKeseimbanganDidapat: hasilJawaban.bonusStreakKeseimbanganDidapat,
    bonusLompatanKuatDidapat: hasilJawaban.bonusLompatanKuatDidapat,
    penaltiJalanBerlumpurDipakai: hasilJawaban.penaltiJalanBerlumpurDipakai,
    terjatuh: hasilJawaban.terjatuh,
    penaltiJatuhJarak: hasilJawaban.penaltiJatuhJarak,
    perisaiDigunakan: hasilJawaban.perisaiDigunakan,
    rintanganBaru: hasilJawaban.rintanganBaru,
    selesaiBaru: hasilJawaban.selesaiBaru,
  };
}

function parseJsonArraySafe<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function rekonstruksiPemainBalapSoloDariDb(
  target: PesertaBalapKarungState,
  pl: {
    id: string;
    nama: string;
    posisi: number;
    keseimbangan: number;
    jumlahJatuh: number;
    efekAktif: string;
    totalBenar: number;
    totalSalah: number;
    streakSaatIni: number;
    streakTertinggi: number;
    totalWaktuJawabMs: number;
    jumlahJawab: number;
    status: string;
    waktuSelesaiMs: number | null;
    selesaiPada: Date | null;
    riwayatPosisi: string;
    riwayatRintangan: string;
    riwayatJawaban: string;
  } | undefined,
  keseimbanganAktif: boolean
): PesertaBalapKarungState {
  if (!pl) return target;
  const riwayatJarak = parseJsonArraySafe<RiwayatJarakEntry>(pl.riwayatPosisi);
  const riwayatRintangan = parseJsonArraySafe<RiwayatRintanganBalapEntry>(pl.riwayatRintangan);
  const riwayatJawaban = parseJsonArraySafe<PesertaBalapKarungState['riwayatJawaban'][number]>(
    pl.riwayatJawaban
  );
  const meta = parseEfekMeta(pl.efekAktif);

  return {
    ...target,
    id: pl.id,
    nama: pl.nama,
    jarak: pl.posisi,
    keseimbangan: keseimbanganAktif ? pl.keseimbangan : 100,
    jumlahJatuh: pl.jumlahJatuh,
    totalBenar: pl.totalBenar,
    totalSalah: pl.totalSalah,
    streakSaatIni: pl.streakSaatIni,
    streakTertinggi: pl.streakTertinggi,
    bonus3DalamStreak: Boolean(meta.bonus3DalamStreak ?? pl.streakSaatIni >= 3),
    bonus5DalamStreak: Boolean(meta.bonus5DalamStreak ?? pl.streakSaatIni >= 5),
    totalBonusStreakKali: meta.totalBonusStreakKali ?? 0,
    totalBonusStreakMeter: meta.totalBonusStreakMeter ?? 0,
    status: pl.status === 'selesai' ? 'selesai' : 'bermain',
    waktuSelesaiMs: pl.waktuSelesaiMs,
    selesaiPada: pl.selesaiPada ? pl.selesaiPada.getTime() : null,
    totalWaktuJawabMs: pl.totalWaktuJawabMs,
    jumlahJawab: pl.jumlahJawab,
    rataRataWaktuJawabMs:
      pl.jumlahJawab > 0 ? Math.round(pl.totalWaktuJawabMs / pl.jumlahJawab) : 0,
    efekAktif: {
      perisai: Boolean(meta.perisai),
      lompatanKuat: Boolean(meta.lompatanKuat),
      jalanBerlumpur: Boolean(meta.jalanBerlumpur),
    },
    riwayatJarak,
    riwayatRintangan,
    riwayatJawaban,
    nomorSoalPemain: riwayatJawaban.length,
  };
}

export const balapKarungSoloManager = {
  inisialisasiSesi(
    sessionId: string,
    hostId: string,
    templateMeta: { id: string; judul: string },
    questions: SoalBalapKarung[],
    rawConfig?: Partial<KonfigurasiBalapKarung>,
    autoStart: boolean = false
  ): SesiBalapKarungSoloActive {
    const config = bangunKonfigurasiBalapKarung(rawConfig);
    const namaP1 = config.namaPemain1.trim() || 'Pemain 1';
    const namaP2 =
      config.namaPemain2.trim() || (config.tipeLawanSolo === 'bot' ? 'Lawan Bot' : 'Pemain 2');

    const sesi: SesiBalapKarungSoloActive = {
      sessionId,
      templateId: templateMeta.id,
      templateJudul: templateMeta.judul,
      hostId,
      state: 'READY',
      config,
      questions: [...questions],
      pemain1: buatPesertaKosong(`${sessionId}__p1`, namaP1, config, questions),
      pemain2: buatPesertaKosong(`${sessionId}__p2`, namaP2, config, questions),
      gameMulaiPadaMs: null,
      lastBotTickMs: 0,
      processedPresentations: new Set<string>(),
      questionStatsMap: new Map(),
    };

    sesiSoloBalapMap.set(sessionId, sesi);

    if (autoStart) {
      this.mulaiSesi(sessionId, hostId);
    }

    return sesi;
  },

  dapatkanSesi(sessionId: string, hostId?: string): SesiBalapKarungSoloActive | undefined {
    const sesi = sesiSoloBalapMap.get(sessionId);
    if (!sesi) return undefined;
    if (hostId && sesi.hostId !== hostId) return undefined;
    return sesi;
  },

  async pulihkanSesiDariDb(sessionId: string): Promise<SesiBalapKarungSoloActive | null> {
    const existing = sesiSoloBalapMap.get(sessionId);
    if (existing) return existing;

    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: { include: { questions: { orderBy: { urutan: 'asc' } } } },
        players: true,
        questionStats: true,
        result: true,
      },
    });

    if (!sessionDb || sessionDb.template.game !== 'balap_karung' || sessionDb.mode !== 'solo') {
      return null;
    }

    let parsedConfig: Partial<KonfigurasiBalapKarung> | undefined;
    if (sessionDb.konfigurasi) {
      try {
        const rawJson = JSON.parse(sessionDb.konfigurasi);
        parsedConfig = rawJson?.config || rawJson;
      } catch {
        parsedConfig = undefined;
      }
    }

    const mappedQuestions = sessionDb.template.questions.map(mapDbQuestionForGame);
    const sesi = this.inisialisasiSesi(
      sessionDb.id,
      sessionDb.hostId,
      { id: sessionDb.template.id, judul: sessionDb.template.judul },
      mappedQuestions,
      parsedConfig,
      false
    );

    sesi.gameMulaiPadaMs = sessionDb.mulaiPada ? sessionDb.mulaiPada.getTime() : null;

    if (sessionDb.status === 'jalan') {
      sesi.state = 'PLAYING';
      sesi.gameMulaiPadaMs = sesi.gameMulaiPadaMs || Date.now();
    } else if (sessionDb.status === 'selesai') {
      sesi.state = 'FINISHED';
    } else {
      sesi.state = 'READY';
    }

    const p1Db = sessionDb.players.find((p) => p.id.endsWith('__p1')) || sessionDb.players[0];
    const p2Db = sessionDb.players.find((p) => p.id.endsWith('__p2')) || sessionDb.players[1];

    sesi.pemain1 = rekonstruksiPemainBalapSoloDariDb(
      sesi.pemain1,
      p1Db,
      sesi.config.keseimbanganAktif
    );
    sesi.pemain2 = rekonstruksiPemainBalapSoloDariDb(
      sesi.pemain2,
      p2Db,
      sesi.config.keseimbanganAktif
    );

    for (const st of sessionDb.questionStats) {
      sesi.questionStatsMap.set(st.questionId, { benar: st.jumlahBenar, salah: st.jumlahSalah });
    }

    if (sesi.state === 'PLAYING') {
      if (!sesi.pemain1.presentasiAktif) {
        siapkanSoalUntukPeserta(sesi.pemain1, sesi.questions, Date.now());
      }
      if (sesi.config.tipeLawanSolo === 'lokal' && !sesi.pemain2.presentasiAktif) {
        siapkanSoalUntukPeserta(sesi.pemain2, sesi.questions, Date.now());
      }
    }

    if (sesi.state === 'FINISHED') {
      const adaYangFinis =
        sesi.pemain1.status === 'selesai' || sesi.pemain2.status === 'selesai';
      sesi.state = adaYangFinis ? 'FINISHED' : 'STOPPED';
      sesi.hasil = buatLaporanAkhirSolo(
        sesi,
        !adaYangFinis,
        sessionDb.selesaiPada ? sessionDb.selesaiPada.getTime() : Date.now()
      );
    }

    return sesi;
  },

  ubahKesulitanBot(
    sessionId: string,
    hostId: string,
    kesulitanBot: KesulitanBotBalap | 'mudah' | 'sulit'
  ): SesiBalapKarungSoloActive {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Balap Karung Solo tidak ditemukan.');
    }
    if (sesi.state !== 'READY') {
      throw new Error('Tingkat bot hanya dapat diubah sebelum lomba dimulai.');
    }
    const normalized: KesulitanBotBalap =
      kesulitanBot === 'mudah' || kesulitanBot === 'santai'
        ? 'santai'
        : kesulitanBot === 'sulit' || kesulitanBot === 'cepat'
        ? 'cepat'
        : 'sedang';
    sesi.config = bangunKonfigurasiBalapKarung({
      ...sesi.config,
      kesulitanBot: normalized,
    });
    return sesi;
  },

  mulaiSesi(
    sessionId: string,
    hostId: string,
    opts?: { kesulitanBot?: KesulitanBotBalap | 'mudah' | 'sulit' }
  ): SesiBalapKarungSoloActive {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Balap Karung Solo tidak ditemukan.');
    }
    if (sesi.questions.length === 0) {
      throw new Error('Template soal kosong, tidak dapat memulai permainan.');
    }

    if (sesi.state === 'FINISHED' || sesi.state === 'STOPPED') {
      throw new Error('Sesi sudah berakhir.');
    }

    if (opts?.kesulitanBot && sesi.state === 'READY') {
      this.ubahKesulitanBot(sessionId, hostId, opts.kesulitanBot);
    }

    const nowMs = Date.now();
    if (!sesi.gameMulaiPadaMs) {
      sesi.gameMulaiPadaMs = nowMs;
    }
    sesi.state = 'PLAYING';
    sesi.lastBotTickMs = nowMs;

    if (!sesi.pemain1.presentasiAktif && sesi.pemain1.status !== 'selesai') {
      siapkanSoalUntukPeserta(sesi.pemain1, sesi.questions, nowMs);
    }
    if (
      sesi.config.tipeLawanSolo === 'lokal' &&
      !sesi.pemain2.presentasiAktif &&
      sesi.pemain2.status !== 'selesai'
    ) {
      siapkanSoalUntukPeserta(sesi.pemain2, sesi.questions, nowMs);
    }

    return sesi;
  },

  ubahStateSesi(
    sessionId: string,
    hostId: string,
    targetState: 'PLAYING' | 'PAUSED'
  ): SesiBalapKarungSoloActive {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Balap Karung Solo tidak ditemukan.');
    }
    if (sesi.state === 'FINISHED' || sesi.state === 'STOPPED') {
      throw new Error('Permainan yang telah berakhir tidak dapat dijeda atau dilanjutkan.');
    }

    const nowMs = Date.now();
    sesi.state = targetState;
    if (targetState === 'PLAYING') {
      if (!sesi.gameMulaiPadaMs) sesi.gameMulaiPadaMs = nowMs;
      sesi.lastBotTickMs = nowMs;
      if (sesi.pemain1.presentasiAktif) {
        sesi.pemain1.presentasiAktif.ditampilkanPadaMs = nowMs;
      } else {
        siapkanSoalUntukPeserta(sesi.pemain1, sesi.questions, nowMs);
      }
      if (sesi.config.tipeLawanSolo === 'lokal') {
        if (sesi.pemain2.presentasiAktif) {
          sesi.pemain2.presentasiAktif.ditampilkanPadaMs = nowMs;
        } else {
          siapkanSoalUntukPeserta(sesi.pemain2, sesi.questions, nowMs);
        }
      }
    }
    return sesi;
  },

  prosesJawaban(
    sessionId: string,
    hostId: string,
    params: {
      slot: SlotPemainSoloBalap;
      presentationId: string;
      choiceId?: string;
      questionId?: string;
      timedOut?: boolean;
    }
  ): {
    slot: SlotPemainSoloBalap;
    hasilJawaban: HasilJawabanBalap;
    feedback: FeedbackAksiBalapSolo;
    selesai: boolean;
    sesi: SesiBalapKarungSoloActive;
  } {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Balap Karung Solo tidak ditemukan.');
    }
    if (sesi.state !== 'PLAYING') {
      throw new Error('Permainan tidak sedang berlangsung.');
    }

    const slot = params.slot;
    if (slot === 'pemain2' && sesi.config.tipeLawanSolo === 'bot') {
      throw new Error('Slot lawan dikendalikan otomatis oleh Bot pada mode Solo vs Bot.');
    }

    const targetPeserta = slot === 'pemain1' ? sesi.pemain1 : sesi.pemain2;
    const presentasi = targetPeserta.presentasiAktif;
    if (!presentasi) {
      throw new Error('Tidak ada pertanyaan aktif untuk pemain tersebut.');
    }
    if (params.presentationId && presentasi.presentationId !== params.presentationId) {
      throw new Error('Pertanyaan sudah kedaluwarsa atau jawaban sudah diproses.');
    }
    if (sesi.processedPresentations.has(presentasi.presentationId)) {
      throw new Error('Jawaban ganda terdeteksi dan ditolak.');
    }
    if (params.questionId && presentasi.questionId !== params.questionId) {
      throw new Error('ID pertanyaan tidak sesuai.');
    }

    sesi.processedPresentations.add(presentasi.presentationId);

    const nowMs = Date.now();
    let hasilJawaban: HasilJawabanBalap;
    try {
      hasilJawaban = prosesJawabanBalapKarung({
        peserta: targetPeserta,
        presentasi,
        choiceId: params.choiceId,
        timedOut: Boolean(params.timedOut),
        config: sesi.config,
        gameMulaiPadaMs: sesi.gameMulaiPadaMs || nowMs,
        nowMs,
      });
    } catch (err) {
      sesi.processedPresentations.delete(presentasi.presentationId);
      throw err;
    }

    const curStat = sesi.questionStatsMap.get(presentasi.questionId) || { benar: 0, salah: 0 };
    if (hasilJawaban.benar) curStat.benar += 1;
    else curStat.salah += 1;
    sesi.questionStatsMap.set(presentasi.questionId, curStat);

    const soalAsli = sesi.questions.find((q) => q.id === presentasi.questionId);
    const feedback = bangunFeedback(
      slot,
      targetPeserta.nama,
      presentasi,
      soalAsli?.penjelasan || null,
      hasilJawaban
    );

    if (slot === 'pemain1') {
      sesi.pemain1 = hasilJawaban.pesertaUpdated;
    } else {
      sesi.pemain2 = hasilJawaban.pesertaUpdated;
    }

    if (hasilJawaban.selesaiBaru) {
      sesi.state = 'FINISHED';
      sesi.pemain1.presentasiAktif = null;
      sesi.pemain2.presentasiAktif = null;
      sesi.hasil = buatLaporanAkhirSolo(sesi, false, nowMs);
      return {
        slot,
        hasilJawaban,
        feedback,
        selesai: true,
        sesi,
      };
    }

    const pesertaUpdated = slot === 'pemain1' ? sesi.pemain1 : sesi.pemain2;
    siapkanSoalUntukPeserta(pesertaUpdated, sesi.questions, nowMs);

    return {
      slot,
      hasilJawaban,
      feedback,
      selesai: false,
      sesi,
    };
  },

  jalankanLangkahBot(
    sessionId: string,
    hostId: string
  ): {
    executed: boolean;
    feedback: FeedbackAksiBalapSolo | null;
    selesai: boolean;
    sesi: SesiBalapKarungSoloActive;
  } {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Balap Karung Solo tidak ditemukan.');
    }

    if (
      sesi.config.tipeLawanSolo !== 'bot' ||
      sesi.state !== 'PLAYING' ||
      sesi.pemain2.status === 'selesai'
    ) {
      return {
        executed: false,
        feedback: null,
        selesai: sesi.state === 'FINISHED' || sesi.state === 'STOPPED',
        sesi,
      };
    }

    const nowMs = Date.now();
    const botCfg = BOT_CONFIG_MAP[sesi.config.kesulitanBot] || BOT_CONFIG_MAP.sedang;

    if (nowMs - sesi.lastBotTickMs < botCfg.minCooldownMs) {
      return {
        executed: false,
        feedback: null,
        selesai: false,
        sesi,
      };
    }

    sesi.lastBotTickMs = nowMs;

    const simulatedThinkMs = crypto.randomInt(botCfg.thinkMinMs, botCfg.thinkMaxMs + 1);
    const presentasi = siapkanSoalUntukPeserta(
      sesi.pemain2,
      sesi.questions,
      nowMs - simulatedThinkMs
    );

    if (!presentasi || presentasi.pilihan.length === 0) {
      return { executed: false, feedback: null, selesai: false, sesi };
    }

    const shouldCorrect = crypto.randomInt(0, 100) < botCfg.accuracyPercent;
    const wrongChoices = presentasi.pilihan.filter((o) => o.choiceId !== presentasi.kunciChoiceId);
    const chosen =
      shouldCorrect || wrongChoices.length === 0
        ? presentasi.pilihan.find((o) => o.choiceId === presentasi.kunciChoiceId) ||
          presentasi.pilihan[0]
        : wrongChoices[crypto.randomInt(0, wrongChoices.length)];

    sesi.processedPresentations.add(presentasi.presentationId);

    const hasilJawaban = prosesJawabanBalapKarung({
      peserta: sesi.pemain2,
      presentasi,
      choiceId: chosen.choiceId,
      config: sesi.config,
      gameMulaiPadaMs: sesi.gameMulaiPadaMs || nowMs,
      nowMs,
    });

    const soalAsli = sesi.questions.find((q) => q.id === presentasi.questionId);
    const feedback = bangunFeedback(
      'pemain2',
      sesi.pemain2.nama,
      presentasi,
      soalAsli?.penjelasan || null,
      hasilJawaban
    );

    sesi.pemain2 = hasilJawaban.pesertaUpdated;

    if (hasilJawaban.selesaiBaru) {
      sesi.state = 'FINISHED';
      sesi.pemain1.presentasiAktif = null;
      sesi.pemain2.presentasiAktif = null;
      sesi.hasil = buatLaporanAkhirSolo(sesi, false, nowMs);
      return { executed: true, feedback, selesai: true, sesi };
    }

    return { executed: true, feedback, selesai: false, sesi };
  },

  hentikanPermainan(sessionId: string, hostId: string): SesiBalapKarungSoloActive {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Balap Karung Solo tidak ditemukan.');
    }

    if (sesi.state !== 'FINISHED' && sesi.state !== 'STOPPED') {
      sesi.state = 'STOPPED';
      sesi.pemain1.presentasiAktif = null;
      sesi.pemain2.presentasiAktif = null;
      sesi.hasil = buatLaporanAkhirSolo(sesi, true, Date.now());
    }

    return sesi;
  },

  ulangPermainan(sessionId: string, hostId: string): SesiBalapKarungSoloActive {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Balap Karung Solo tidak ditemukan.');
    }
    if (sesi.state === 'FINISHED' || sesi.state === 'STOPPED') {
      throw new Error(
        'Sesi yang sudah selesai tidak dapat direset in-place agar riwayat tetap terjaga.'
      );
    }

    const namaP1 = sesi.pemain1.nama;
    const namaP2 = sesi.pemain2.nama;

    sesi.state = 'READY';
    sesi.gameMulaiPadaMs = null;
    sesi.lastBotTickMs = 0;
    sesi.processedPresentations.clear();
    sesi.questionStatsMap.clear();
    sesi.hasil = undefined;
    sesi.pemain1 = buatPesertaKosong(`${sesi.sessionId}__p1`, namaP1, sesi.config, sesi.questions);
    sesi.pemain2 = buatPesertaKosong(`${sesi.sessionId}__p2`, namaP2, sesi.config, sesi.questions);

    return sesi;
  },

  async simpanHasilKeDatabase(sessionId: string): Promise<void> {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || !sesi.hasil) return;
    const hasil = sesi.hasil;

    const pesertaList = [sesi.pemain1, sesi.pemain2];

    await prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: sesi.sessionId },
        data: {
          status: 'selesai',
          selesaiPada: new Date(hasil.selesaiPadaMs),
          konfigurasi: JSON.stringify({
            playMode: 'SOLO',
            config: sesi.config,
          }),
        },
      });

      const pemenangNama = hasil.podium.juara1?.nama || sesi.pemain1.nama;
      const jarakTertinggi = hasil.podium.juara1?.jarak ?? 0;

      await tx.sessionResult.upsert({
        where: { sessionId: sesi.sessionId },
        update: {
          timMenang: pemenangNama,
          posisiAkhir: jarakTertinggi,
          skorMerah: hasil.totalSelesai,
          skorPutih: hasil.totalPeserta,
        },
        create: {
          sessionId: sesi.sessionId,
          timMenang: pemenangNama,
          posisiAkhir: jarakTertinggi,
          skorMerah: hasil.totalSelesai,
          skorPutih: hasil.totalPeserta,
        },
      });

      for (const p of pesertaList) {
        await tx.sessionPlayer.upsert({
          where: { id: p.id },
          update: {
            nama: p.nama,
            posisi: p.jarak,
            keseimbangan: p.keseimbangan,
            jumlahJatuh: p.jumlahJatuh,
            efekAktif: serializeEfekMeta(p),
            totalBenar: p.totalBenar,
            totalSalah: p.totalSalah,
            streakSaatIni: p.streakSaatIni,
            streakTertinggi: p.streakTertinggi,
            totalWaktuJawabMs: p.totalWaktuJawabMs,
            jumlahJawab: p.jumlahJawab,
            status: p.status,
            waktuSelesaiMs: p.waktuSelesaiMs,
            selesaiPada: p.selesaiPada ? new Date(p.selesaiPada) : null,
            riwayatPosisi: JSON.stringify(p.riwayatJarak),
            riwayatRintangan: JSON.stringify(p.riwayatRintangan),
            riwayatJawaban: JSON.stringify(p.riwayatJawaban),
          },
          create: {
            id: p.id,
            sessionId: sesi.sessionId,
            nama: p.nama,
            posisi: p.jarak,
            keseimbangan: p.keseimbangan,
            jumlahJatuh: p.jumlahJatuh,
            efekAktif: serializeEfekMeta(p),
            totalBenar: p.totalBenar,
            totalSalah: p.totalSalah,
            streakSaatIni: p.streakSaatIni,
            streakTertinggi: p.streakTertinggi,
            totalWaktuJawabMs: p.totalWaktuJawabMs,
            jumlahJawab: p.jumlahJawab,
            status: p.status,
            waktuSelesaiMs: p.waktuSelesaiMs,
            selesaiPada: p.selesaiPada ? new Date(p.selesaiPada) : null,
            riwayatPosisi: JSON.stringify(p.riwayatJarak),
            riwayatRintangan: JSON.stringify(p.riwayatRintangan),
            riwayatJawaban: JSON.stringify(p.riwayatJawaban),
          },
        });
      }

      await tx.questionStat.deleteMany({
        where: { sessionId: sesi.sessionId },
      });

      for (const [questionId, st] of sesi.questionStatsMap.entries()) {
        await tx.questionStat.create({
          data: {
            sessionId: sesi.sessionId,
            questionId,
            jumlahBenar: st.benar,
            jumlahSalah: st.salah,
          },
        });
      }
    });
  },

  serialisasiUntukClient(sesi: SesiBalapKarungSoloActive): SesiBalapKarungSoloClient {
    const sorted = urutkanLeaderboardBalapKarung(
      [sesi.pemain1, sesi.pemain2],
      sesi.config.targetJarak
    );
    const leaderboard = sorted.map((p, idx) =>
      formatLeaderboardItemSolo(p, idx + 1, sesi.config.targetJarak)
    );
    const sedangJalan = sesi.state === 'PLAYING' || sesi.state === 'PAUSED';

    return {
      sessionId: sesi.sessionId,
      game: 'balap_karung',
      mode: 'solo',
      playMode: 'SOLO',
      templateId: sesi.templateId,
      templateJudul: sesi.templateJudul,
      state: sesi.state,
      config: sesi.config,
      totalSoalBank: sesi.questions.length,
      pemain1: formatPesertaClient(
        sesi.pemain1,
        'pemain1',
        sesi.config,
        sesi.questions.length,
        sedangJalan
      ),
      pemain2: formatPesertaClient(
        sesi.pemain2,
        'pemain2',
        sesi.config,
        sesi.questions.length,
        sedangJalan && sesi.config.tipeLawanSolo === 'lokal'
      ),
      leaderboard,
      isFinished: sesi.state === 'FINISHED' || sesi.state === 'STOPPED',
      hasil: sesi.hasil || null,
    };
  },

  async muatLaporanDariDatabase(sessionId: string): Promise<LaporanAkhirBalapKarung | null> {
    const existing = this.dapatkanSesi(sessionId);
    if (existing?.hasil) return existing.hasil;
    const restored = await this.pulihkanSesiDariDb(sessionId);
    if (!restored) return null;
    if (restored.hasil) return restored.hasil;
    return buatLaporanAkhirSolo(restored, false, Date.now()) ?? null;
  },

  hapusSesi(sessionId: string): void {
    sesiSoloBalapMap.delete(sessionId);
  },
};
