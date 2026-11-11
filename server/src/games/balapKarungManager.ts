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
  EfekAktifBalap,
  RngBalapKarung,
  KodeTimBalap,
  TIM_BALAP_RESMI,
  KATA_TERSANDUNG_BALAP,
  bangunKonfigurasiBalapKarung,
  buatPresentasiSoalBalap,
  prosesJawabanBalapKarung,
  urutkanLeaderboardBalapKarung,
} from './balapKarung.js';
import { extractActiveOptions, normalizeOptionKey } from '../utils/questionOptions.js';
import { multiManager } from './multiManager.js';
import { panjatPinangManager } from './panjatPinangManager.js';
import { prisma } from '../db.js';
import { mapDbQuestionForGame } from '../utils/questionOptions.js';

export interface SoalPublikBalap {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  totalSoalTemplate: number;
  teks: string;
  pilihan: OpsiPilihanBalap[];
  ditampilkanPadaMs: number;
  waktuPerSoalDetik?: number;
  berakhirPadaMs?: number;
}

export interface TeamBalapState {
  id: KodeTimBalap;
  nama: string;
  warna: string;
  meter: number;
  selesaiPadaMs: number | null;
}

export interface AnggotaTimRingkas {
  id: string;
  nama: string;
  connected: boolean;
  totalBenar: number;
  totalSalah: number;
}

export interface RingkasanTimBalap {
  id: KodeTimBalap;
  nama: string;
  warna: string;
  meter: number;
  meterRaw: number;
  targetJarak: number;
  persen: number;
  isWinner: boolean;
  selesaiPadaMs: number | null;
  anggota: AnggotaTimRingkas[];
}

export interface LeaderboardItemBalap {
  peringkat: number;
  id: string;
  nama: string;
  tim?: KodeTimBalap | null;
  connected: boolean;
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
  efekAktif: EfekAktifBalap;
}

export interface LaporanPemainBalap {
  peringkat: number;
  id: string;
  nama: string;
  jarakAkhir: number;
  targetJarak: number;
  keseimbanganAkhir: number;
  jumlahJatuh: number;
  status: 'bermain' | 'selesai';
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakTertinggi: number;
  streakSaatIni: number;
  totalBonusStreakKali: number;
  totalBonusStreakMeter: number;
  rataRataWaktuJawabMs: number;
  waktuSelesaiMs: number | null;
  riwayatRintangan: RiwayatRintanganBalapEntry[];
  riwayatJarak: RiwayatJarakEntry[];
}

export interface QuestionStatItemBalap {
  questionId: string;
  nomorSoal: number;
  teksSoal: string;
  jumlahBenar: number;
  jumlahSalah: number;
}

export interface LaporanTimItemBalap {
  peringkat: number;
  id: KodeTimBalap;
  nama: string;
  warna: string;
  meter: number;
  meterRaw: number;
  targetJarak: number;
  isWinner: boolean;
  totalBenar: number;
  totalSalah: number;
  anggota: Array<{
    id: string;
    nama: string;
    totalBenar: number;
    totalSalah: number;
  }>;
}

export interface HeatmapCellBalap {
  questionId: string;
  ok: boolean | null;
  jawabanKey: string | null;
  jawabanTeks: string | null;
  timedOut: boolean;
  percobaanCount: number;
}

export interface HeatmapQuestionInfoBalap {
  questionId: string;
  nomorSoal: number;
  teks: string;
  opsiList: Array<{ key: string; teks: string }>;
  jawabanBenarKode: string;
  jawabanBenarTeks: string;
  penjelasan: string | null;
  firstCorrectCount: number;
  firstSeenCount: number;
  persenBenar: number | null;
}

export interface HeatmapTeamGroupBalap {
  timId: KodeTimBalap;
  namaTim: string;
  warna: string;
  rows: Array<{
    pesertaId: string;
    nama: string;
    benarPertamaCount: number;
    dilihatCount: number;
    cells: HeatmapCellBalap[];
  }>;
}

export interface AnalisisHeatmapBalap {
  questions: HeatmapQuestionInfoBalap[];
  teams: HeatmapTeamGroupBalap[];
  hardestQuestionId: string | null;
  defaultQuestionId: string | null;
}

export interface LaporanAkhirBalapKarung {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  konfigurasi: KonfigurasiBalapKarung;
  totalPeserta: number;
  totalSelesai: number;
  totalSoalTemplate: number;
  totalJawabanBenar: number;
  totalJawabanSalah: number;
  totalJatuhKelas: number;
  dihentikanManual: boolean;
  mulaiPadaMs: number | null;
  selesaiPadaMs: number;
  timPemenang?: KodeTimBalap | null;
  namaTimPemenang?: string | null;
  laporanTim?: LaporanTimItemBalap[];
  analisisHeatmap?: AnalisisHeatmapBalap;
  leaderboard: LeaderboardItemBalap[];
  laporanPemain: LaporanPemainBalap[];
  podium: {
    juara1?: LeaderboardItemBalap;
    juara2?: LeaderboardItemBalap;
    juara3?: LeaderboardItemBalap;
  };
  questionStats?: QuestionStatItemBalap[];
}

export interface SesiBalapKarungActive {
  sessionId: string;
  token: string;
  templateId: string;
  templateJudul: string;
  hostId: string;
  hostSocketId?: string;
  status: 'lobi' | 'jalan' | 'selesai';
  config: KonfigurasiBalapKarung;
  teams: Map<KodeTimBalap, TeamBalapState>;
  timPemenang: KodeTimBalap | null;
  peserta: Map<string, PesertaBalapKarungState>;
  totalSoal: number;
  questions: SoalBalapKarung[];
  gameMulaiPadaMs: number | null;
  processedPresentations: Set<string>;
  hasil?: LaporanAkhirBalapKarung;
}

interface StoredEfekMetaBalap {
  perisai?: boolean;
  lompatanKuat?: boolean;
  jalanBerlumpur?: boolean;
  bonus3DalamStreak?: boolean;
  bonus5DalamStreak?: boolean;
  totalBonusStreakKali?: number;
  totalBonusStreakMeter?: number;
}

const sesiBalapMap = new Map<string, SesiBalapKarungActive>();
const tokenToSessionIdMap = new Map<string, string>();
const dbWriteQueues = new Map<string, Promise<void>>();

/**
 * Antrean penulisan database berurutan per sesi agar aman pada lonjakan jawaban bersamaan di SQLite.
 */
function antrekanPenulisanDb(sessionId: string, task: () => Promise<void>): Promise<void> {
  const previous = dbWriteQueues.get(sessionId) || Promise.resolve();
  const next = previous
    .catch(() => {
      // Abaikan kegagalan task sebelumnya agar antrean tidak terkunci
    })
    .then(task);
  dbWriteQueues.set(sessionId, next);
  return next;
}

/**
 * Mengacak daftar ID soal dengan Fisher-Yates (crypto.randomInt) dan mencegah pengulangan beruntun.
 */
export function siapkanAntreanSoalBalap(
  questions: SoalBalapKarung[],
  terakhirSoalId?: string
): string[] {
  if (!questions || questions.length === 0) return [];
  const ids = questions.map((q) => q.id);

  for (let i = ids.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = ids[i];
    ids[i] = ids[j];
    ids[j] = tmp;
  }

  if (ids.length > 1 && terakhirSoalId && ids[0] === terakhirSoalId) {
    const tmp = ids[0];
    ids[0] = ids[1];
    ids[1] = tmp;
  }

  return ids;
}

function serializeEfekMeta(p: PesertaBalapKarungState): string {
  const payload: StoredEfekMetaBalap = {
    perisai: p.efekAktif.perisai,
    lompatanKuat: p.efekAktif.lompatanKuat,
    jalanBerlumpur: p.efekAktif.jalanBerlumpur,
    bonus3DalamStreak: p.bonus3DalamStreak,
    bonus5DalamStreak: p.bonus5DalamStreak,
    totalBonusStreakKali: p.totalBonusStreakKali,
    totalBonusStreakMeter: p.totalBonusStreakMeter,
  };
  return JSON.stringify(payload);
}

function parseEfekMeta(raw?: string | null): StoredEfekMetaBalap {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StoredEfekMetaBalap;
  } catch {
    return {};
  }
}

function buatPetaTimAwal(): Map<KodeTimBalap, TeamBalapState> {
  const m = new Map<KodeTimBalap, TeamBalapState>();
  for (const def of TIM_BALAP_RESMI) {
    m.set(def.id, {
      id: def.id,
      nama: def.nama,
      warna: def.warna,
      meter: 0,
      selesaiPadaMs: null,
    });
  }
  return m;
}

function dapatkanDefinisiTimAktif(jumlahTim: 3 | 4) {
  return TIM_BALAP_RESMI.slice(0, jumlahTim === 4 ? 4 : 3);
}

function pilihTimSeimbang(sesi: SesiBalapKarungActive): KodeTimBalap {
  const aktif = dapatkanDefinisiTimAktif(sesi.config.jumlahTim);
  const counts = new Map<KodeTimBalap, number>();
  for (const t of aktif) counts.set(t.id, 0);

  for (const p of sesi.peserta.values()) {
    if (p.tim && counts.has(p.tim)) {
      counts.set(p.tim, (counts.get(p.tim) || 0) + 1);
    }
  }

  let bestId: KodeTimBalap = aktif[0].id;
  let minCount = Number.MAX_SAFE_INTEGER;
  for (const t of aktif) {
    const c = counts.get(t.id) || 0;
    if (c < minCount) {
      minCount = c;
      bestId = t.id;
    }
  }
  return bestId;
}

function bangunRingkasanTim(
  sesi: SesiBalapKarungActive,
  sortByRank: boolean = false
): RingkasanTimBalap[] {
  const aktifDefs = dapatkanDefinisiTimAktif(sesi.config.jumlahTim);
  const target = sesi.config.targetJarak || 100;

  const list: RingkasanTimBalap[] = aktifDefs.map((def) => {
    const tState = sesi.teams.get(def.id);
    const meterRaw = Math.max(0, tState?.meter ?? 0);
    const meter = Math.round(meterRaw);
    const anggota: AnggotaTimRingkas[] = Array.from(sesi.peserta.values())
      .filter((p) => p.tim === def.id)
      .map((p) => ({
        id: p.id,
        nama: p.nama,
        connected: p.connected,
        totalBenar: p.totalBenar,
        totalSalah: p.totalSalah,
      }));

    return {
      id: def.id,
      nama: def.nama,
      warna: def.warna,
      meter,
      meterRaw,
      targetJarak: target,
      persen: target > 0 ? Math.min(100, Math.round((meterRaw / target) * 100)) : 0,
      isWinner: sesi.timPemenang === def.id,
      selesaiPadaMs: tState?.selesaiPadaMs ?? null,
      anggota,
    };
  });

  if (sortByRank) {
    list.sort((a, b) => {
      if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
      if (Math.abs(b.meterRaw - a.meterRaw) > 0.0001) return b.meterRaw - a.meterRaw;
      const tA = a.selesaiPadaMs ?? Number.MAX_SAFE_INTEGER;
      const tB = b.selesaiPadaMs ?? Number.MAX_SAFE_INTEGER;
      if (tA !== tB) return tA - tB;
      const benarA = a.anggota.reduce((s, m) => s + m.totalBenar, 0);
      const benarB = b.anggota.reduce((s, m) => s + m.totalBenar, 0);
      if (benarB !== benarA) return benarB - benarA;
      return a.nama.localeCompare(b.nama);
    });
  }

  return list;
}

function formatLeaderboardItem(
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
    tim: p.tim || null,
    connected: p.connected,
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

function formatPresentasiPublik(
  pres: PresentasiSoalBalap,
  totalSoalTemplate: number,
  waktuPerSoalDetik: number
): SoalPublikBalap {
  return {
    presentationId: pres.presentationId,
    questionId: pres.questionId,
    nomorSoal: pres.nomorSoal,
    totalSoalTemplate,
    teks: pres.teks,
    pilihan: pres.pilihan,
    ditampilkanPadaMs: pres.ditampilkanPadaMs,
    waktuPerSoalDetik,
    berakhirPadaMs: pres.ditampilkanPadaMs + waktuPerSoalDetik * 1000,
  };
}

export function buatLaporanAkhirBalap(
  sesi: SesiBalapKarungActive,
  dihentikanManual: boolean,
  selesaiPadaMs: number = Date.now()
): LaporanAkhirBalapKarung {
  const sorted = urutkanLeaderboardBalapKarung(
    Array.from(sesi.peserta.values()),
    sesi.config.targetJarak
  );
  const leaderboard = sorted.map((p, idx) =>
    formatLeaderboardItem(p, idx + 1, sesi.config.targetJarak)
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
      keseimbanganAkhir: p.keseimbangan,
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

  const statPerSoal = new Map<string, { benar: number; salah: number }>();
  for (const p of sorted) {
    for (const jw of p.riwayatJawaban) {
      const prev = statPerSoal.get(jw.questionId) || { benar: 0, salah: 0 };
      if (jw.benar) prev.benar += 1;
      else prev.salah += 1;
      statPerSoal.set(jw.questionId, prev);
    }
  }

  const questionStats: QuestionStatItemBalap[] = sesi.questions
    .map((q) => {
      const st = statPerSoal.get(q.id);
      if (!st) return null;
      return {
        questionId: q.id,
        nomorSoal: q.urutan,
        teksSoal: q.teks,
        jumlahBenar: st.benar,
        jumlahSalah: st.salah,
      };
    })
    .filter((item): item is QuestionStatItemBalap => item !== null);

  const rankedTeamsRaw = bangunRingkasanTim(sesi, true);
  if (!sesi.timPemenang && rankedTeamsRaw.length > 0 && sesi.peserta.size > 0) {
    // Jika dihentikan manual, tim teratas menjadi juara sementara
    const topTeam = rankedTeamsRaw[0];
    if (topTeam && (topTeam.meterRaw > 0 || topTeam.anggota.length > 0)) {
      rankedTeamsRaw[0] = { ...topTeam, isWinner: true };
    }
  }
  const timPemenangKode = sesi.timPemenang || rankedTeamsRaw.find((t) => t.isWinner)?.id || null;
  const namaTimPemenang =
    rankedTeamsRaw.find((t) => t.id === timPemenangKode)?.nama || null;

  const laporanTim: LaporanTimItemBalap[] = rankedTeamsRaw.map((t, idx) => ({
    peringkat: idx + 1,
    id: t.id,
    nama: t.nama,
    warna: t.warna,
    meter: t.meter,
    meterRaw: Number(t.meterRaw.toFixed(2)),
    targetJarak: t.targetJarak,
    isWinner: idx === 0 && (t.isWinner || timPemenangKode === t.id),
    totalBenar: t.anggota.reduce((s, a) => s + a.totalBenar, 0),
    totalSalah: t.anggota.reduce((s, a) => s + a.totalSalah, 0),
    anggota: t.anggota.map((a) => ({
      id: a.id,
      nama: a.nama,
      totalBenar: a.totalBenar,
      totalSalah: a.totalSalah,
    })),
  }));

  // Bangun matriks heatmap per-soal x per-siswa (berbasis jawaban pertama per soal)
  const semuaSiswa = Array.from(sesi.peserta.values());
  const questionsInfo: HeatmapQuestionInfoBalap[] = sesi.questions.map((q, qIdx) => {
    const activeOpsi = extractActiveOptions(q);
    const kunciKode = normalizeOptionKey(
      q.jawabanBenar,
      activeOpsi.map((o) => o.key),
      'A'
    );
    const kunciOpsi = activeOpsi.find((o) => o.key === kunciKode) || activeOpsi[0];

    let firstCorrectCount = 0;
    let firstSeenCount = 0;
    for (const p of semuaSiswa) {
      const firstAttempt = p.riwayatJawaban.find((r) => r.questionId === q.id);
      if (firstAttempt) {
        firstSeenCount += 1;
        if (firstAttempt.benar) firstCorrectCount += 1;
      }
    }

    return {
      questionId: q.id,
      nomorSoal: q.urutan || qIdx + 1,
      teks: q.teks,
      opsiList: activeOpsi.map((o) => ({ key: o.key, teks: o.teks })),
      jawabanBenarKode: kunciKode,
      jawabanBenarTeks: kunciOpsi?.teks || '',
      penjelasan: q.penjelasan || null,
      firstCorrectCount,
      firstSeenCount,
      persenBenar:
        firstSeenCount > 0 ? Math.round((firstCorrectCount / firstSeenCount) * 100) : null,
    };
  });

  const aktifDefs = dapatkanDefinisiTimAktif(sesi.config.jumlahTim);
  const heatmapTeams: HeatmapTeamGroupBalap[] = aktifDefs.map((def) => {
    const members = semuaSiswa
      .filter((p) => p.tim === def.id)
      .sort((a, b) => a.nama.localeCompare(b.nama));
    return {
      timId: def.id,
      namaTim: def.nama,
      warna: def.warna,
      rows: members.map((p) => {
        let benarPertamaCount = 0;
        let dilihatCount = 0;
        const cells: HeatmapCellBalap[] = sesi.questions.map((q) => {
          const attempts = p.riwayatJawaban.filter((r) => r.questionId === q.id);
          const first = attempts[0];
          if (!first) {
            return {
              questionId: q.id,
              ok: null,
              jawabanKey: null,
              jawabanTeks: null,
              timedOut: false,
              percobaanCount: 0,
            };
          }
          dilihatCount += 1;
          if (first.benar) benarPertamaCount += 1;
          return {
            questionId: q.id,
            ok: first.benar,
            jawabanKey: first.jawabanKey,
            jawabanTeks: first.jawabanTeks || null,
            timedOut: Boolean(first.timedOut || first.jawabanKey === 'TIMEOUT'),
            percobaanCount: attempts.length,
          };
        });
        return {
          pesertaId: p.id,
          nama: p.nama,
          benarPertamaCount,
          dilihatCount,
          cells,
        };
      }),
    };
  });

  let hardestQuestionId: string | null = null;
  let worstPct = 101;
  for (const qi of questionsInfo) {
    if (qi.persenBenar !== null && qi.persenBenar < worstPct) {
      worstPct = qi.persenBenar;
      hardestQuestionId = qi.questionId;
    }
  }
  const defaultQuestionId =
    hardestQuestionId || questionsInfo[0]?.questionId || null;

  const analisisHeatmap: AnalisisHeatmapBalap = {
    questions: questionsInfo,
    teams: heatmapTeams,
    hardestQuestionId: worstPct < 100 ? hardestQuestionId : null,
    defaultQuestionId,
  };

  return {
    sessionId: sesi.sessionId,
    templateId: sesi.templateId,
    templateJudul: sesi.templateJudul,
    konfigurasi: sesi.config,
    totalPeserta: sorted.length,
    totalSelesai,
    totalSoalTemplate: sesi.totalSoal,
    totalJawabanBenar,
    totalJawabanSalah,
    totalJatuhKelas,
    dihentikanManual,
    mulaiPadaMs: sesi.gameMulaiPadaMs,
    selesaiPadaMs,
    timPemenang: timPemenangKode,
    namaTimPemenang,
    laporanTim,
    analisisHeatmap,
    leaderboard,
    laporanPemain,
    podium: {
      juara1: leaderboard[0],
      juara2: leaderboard[1],
      juara3: leaderboard[2],
    },
    questionStats,
  };
}

export const balapKarungManager = {
  /**
   * Menghasilkan token 6 digit unik yang bebas tabrakan antar seluruh game aktif.
   */
  generateUniqueToken(): string {
    let token = '';
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 250) {
      attempts++;
      token = crypto.randomInt(100000, 1000000).toString();
      exists =
        tokenToSessionIdMap.has(token) ||
        Boolean(multiManager.dapatkanSesiDariToken(token)) ||
        Boolean(panjatPinangManager.dapatkanSesiDariToken(token));
    }

    if (exists) {
      throw new Error('Gagal menghasilkan token unik untuk sesi Balap Karung.');
    }

    return token;
  },

  /**
   * Menginisialisasi sesi Balap Karung Challenge di memori server dengan snapshot aturan immutable.
   */
  inisialisasiSesi(
    sessionId: string,
    token: string,
    hostId: string,
    template: { id: string; judul: string },
    questions: SoalBalapKarung[],
    userConfig?: Partial<KonfigurasiBalapKarung>
  ): SesiBalapKarungActive {
    if (!questions || questions.length === 0) {
      throw new Error('Template belum memiliki soal. Tambahkan minimal 1 soal sebelum membuat sesi.');
    }

    if (tokenToSessionIdMap.has(token)) {
      const oldId = tokenToSessionIdMap.get(token)!;
      this.hapusSesi(oldId);
    }

    const config = bangunKonfigurasiBalapKarung(userConfig);

    const sesi: SesiBalapKarungActive = {
      sessionId,
      token,
      templateId: template.id,
      templateJudul: template.judul,
      hostId,
      status: 'lobi',
      config,
      teams: buatPetaTimAwal(),
      timPemenang: null,
      peserta: new Map(),
      totalSoal: questions.length,
      questions,
      gameMulaiPadaMs: null,
      processedPresentations: new Set(),
    };

    sesiBalapMap.set(sessionId, sesi);
    tokenToSessionIdMap.set(token, sessionId);
    return sesi;
  },

  dapatkanSesi(sessionId: string): SesiBalapKarungActive | undefined {
    return sesiBalapMap.get(sessionId);
  },

  dapatkanSesiDariToken(token: string): SesiBalapKarungActive | undefined {
    const id = tokenToSessionIdMap.get(token);
    if (!id) return undefined;
    return sesiBalapMap.get(id);
  },

  /**
   * Memulihkan sesi Balap Karung aktif dari SQLite bila server sempat restart.
   */
  async pulihkanSesiDariDb(sessionId: string): Promise<SesiBalapKarungActive | null> {
    const existing = sesiBalapMap.get(sessionId);
    if (existing) return existing;

    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: {
          include: {
            questions: { orderBy: { urutan: 'asc' } },
          },
        },
        players: true,
      },
    });

    if (!sessionDb || sessionDb.template.game !== 'balap_karung' || sessionDb.mode === 'solo' || !sessionDb.token) {
      return null;
    }

    if (sessionDb.template.questions.length === 0) {
      return null;
    }

    let parsedConfig: Partial<KonfigurasiBalapKarung> | undefined;
    let storedTeamMeters: Record<string, { meter?: number; selesaiPadaMs?: number | null }> | null =
      null;
    let storedTimPemenang: KodeTimBalap | null = null;
    if (sessionDb.konfigurasi) {
      try {
        const rawJson = JSON.parse(sessionDb.konfigurasi);
        parsedConfig = rawJson?.config || rawJson;
        if (rawJson?.teamMeters && typeof rawJson.teamMeters === 'object') {
          storedTeamMeters = rawJson.teamMeters;
        }
        if (
          rawJson?.timPemenang &&
          ['merah', 'biru', 'hijau', 'kuning'].includes(rawJson.timPemenang)
        ) {
          storedTimPemenang = rawJson.timPemenang as KodeTimBalap;
        }
      } catch {
        parsedConfig = undefined;
      }
    }

    const sesi = this.inisialisasiSesi(
      sessionDb.id,
      sessionDb.token,
      sessionDb.hostId,
      { id: sessionDb.template.id, judul: sessionDb.template.judul },
      sessionDb.template.questions.map(mapDbQuestionForGame),
      parsedConfig
    );

    if (storedTeamMeters) {
      for (const [kode, info] of Object.entries(storedTeamMeters)) {
        const tState = sesi.teams.get(kode as KodeTimBalap);
        if (tState && info) {
          tState.meter = Number(info.meter ?? 0);
          tState.selesaiPadaMs = info.selesaiPadaMs ?? null;
        }
      }
    }
    sesi.timPemenang = storedTimPemenang;

    sesi.status =
      sessionDb.status === 'jalan'
        ? 'jalan'
        : sessionDb.status === 'selesai'
        ? 'selesai'
        : 'lobi';
    sesi.gameMulaiPadaMs = sessionDb.mulaiPada ? sessionDb.mulaiPada.getTime() : null;

    for (const pl of sessionDb.players) {
      let riwayatJarak: RiwayatJarakEntry[] = [];
      let riwayatRintangan: RiwayatRintanganBalapEntry[] = [];
      let riwayatJawaban: PesertaBalapKarungState['riwayatJawaban'] = [];
      try {
        riwayatJarak = JSON.parse(pl.riwayatPosisi || '[]');
      } catch {
        riwayatJarak = [];
      }
      try {
        riwayatRintangan = JSON.parse(pl.riwayatRintangan || '[]');
      } catch {
        riwayatRintangan = [];
      }
      try {
        riwayatJawaban = JSON.parse(pl.riwayatJawaban || '[]');
      } catch {
        riwayatJawaban = [];
      }

      const efekMeta = parseEfekMeta(pl.efekAktif);

      const timRestored: KodeTimBalap =
        pl.tim && ['merah', 'biru', 'hijau', 'kuning'].includes(pl.tim)
          ? (pl.tim as KodeTimBalap)
          : pilihTimSeimbang(sesi);

      const restored: PesertaBalapKarungState = {
        id: pl.id,
        secretToken: crypto.randomUUID(),
        socketId: '',
        nama: pl.nama,
        tim: timRestored,
        connected: false,
        jarak: pl.posisi,
        keseimbangan: sesi.config.keseimbanganAktif ? pl.keseimbangan : 100,
        jumlahJatuh: pl.jumlahJatuh,
        totalBenar: pl.totalBenar,
        totalSalah: pl.totalSalah,
        streakSaatIni: pl.streakSaatIni,
        streakTertinggi: pl.streakTertinggi,
        bonus3DalamStreak: Boolean(efekMeta.bonus3DalamStreak ?? pl.streakSaatIni >= 3),
        bonus5DalamStreak: Boolean(efekMeta.bonus5DalamStreak ?? pl.streakSaatIni >= 5),
        totalBonusStreakKali: efekMeta.totalBonusStreakKali ?? 0,
        totalBonusStreakMeter: efekMeta.totalBonusStreakMeter ?? 0,
        status: pl.status === 'selesai' ? 'selesai' : 'bermain',
        waktuSelesaiMs: pl.waktuSelesaiMs,
        selesaiPada: pl.selesaiPada ? pl.selesaiPada.getTime() : null,
        totalWaktuJawabMs: pl.totalWaktuJawabMs,
        jumlahJawab: pl.jumlahJawab,
        rataRataWaktuJawabMs:
          pl.jumlahJawab > 0 ? Math.round(pl.totalWaktuJawabMs / pl.jumlahJawab) : 0,
        efekAktif: {
          perisai: Boolean(efekMeta.perisai),
          lompatanKuat: Boolean(efekMeta.lompatanKuat),
          jalanBerlumpur: Boolean(efekMeta.jalanBerlumpur),
        },
        riwayatJarak,
        riwayatRintangan,
        riwayatJawaban,
        antreanSoal: siapkanAntreanSoalBalap(sesi.questions),
        presentasiAktif: null,
        nomorSoalPemain: riwayatJawaban.length,
      };
      for (const jw of riwayatJawaban) {
        sesi.processedPresentations.add(jw.presentationId);
      }
      sesi.peserta.set(pl.id, restored);
    }

    if (sesi.status === 'selesai') {
      const allSelesai =
        sesi.peserta.size > 0 &&
        Array.from(sesi.peserta.values()).every((p) => p.status === 'selesai');
      sesi.hasil = buatLaporanAkhirBalap(
        sesi,
        !allSelesai,
        sessionDb.selesaiPada ? sessionDb.selesaiPada.getTime() : Date.now()
      );
    }

    return sesi;
  },

  /**
   * Mendaftarkan pemain baru atau memulihkan reconnect dengan validasi identitas pesertaSecret.
   */
  gabungPeserta(
    token: string,
    nama: string,
    socketId: string,
    existingPesertaId?: string,
    pesertaSecret?: string
  ): {
    sesi: SesiBalapKarungActive;
    peserta: PesertaBalapKarungState;
    isReconnect: boolean;
  } {
    const sesi = this.dapatkanSesiDariToken(token);
    if (!sesi) {
      throw new Error('Kode token tidak ditemukan atau sesi Balap Karung telah berakhir.');
    }

    if (sesi.status === 'selesai') {
      throw new Error('Sesi permainan ini sudah berakhir.');
    }

    const cleanNama = nama.trim();
    if (!cleanNama) {
      throw new Error('Nama panggilan wajib diisi.');
    }

    if (existingPesertaId && sesi.peserta.has(existingPesertaId)) {
      const p = sesi.peserta.get(existingPesertaId)!;
      const secretCocok = Boolean(pesertaSecret && p.secretToken === pesertaSecret);
      if (secretCocok || !p.connected) {
        p.socketId = socketId;
        p.connected = true;
        return { sesi, peserta: p, isReconnect: true };
      }
      throw new Error('Sesi pemain tidak dapat diambil alih dari perangkat lain.');
    }

    if (sesi.status === 'jalan' && !sesi.config.allowLateJoin) {
      throw new Error('Sesi Balap Karung sedang berlangsung dan tidak menerima pemain baru.');
    }

    if (sesi.peserta.size >= sesi.config.maxPeserta) {
      throw new Error(
        `Kapasitas sesi Balap Karung telah penuh (maksimal ${sesi.config.maxPeserta} pemain).`
      );
    }

    const namaSama = Array.from(sesi.peserta.values()).find(
      (p) => p.nama.toLowerCase() === cleanNama.toLowerCase()
    );
    if (namaSama) {
      if (!namaSama.connected) {
        namaSama.socketId = socketId;
        namaSama.connected = true;
        return { sesi, peserta: namaSama, isReconnect: true };
      }
      throw new Error(`Nama "${cleanNama}" sudah dipakai peserta lain dalam sesi ini.`);
    }

    const timDipilih = pilihTimSeimbang(sesi);

    const peserta: PesertaBalapKarungState = {
      id: crypto.randomUUID(),
      secretToken: crypto.randomUUID(),
      socketId,
      nama: cleanNama,
      tim: timDipilih,
      connected: true,
      jarak: 0,
      keseimbangan: 100,
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
      antreanSoal:
        sesi.status === 'jalan' ? siapkanAntreanSoalBalap(sesi.questions) : [],
      presentasiAktif: null,
      nomorSoalPemain: 0,
    };

    sesi.peserta.set(peserta.id, peserta);
    void this.sinkronkanPesertaKeDb(sesi.sessionId, peserta);

    return { sesi, peserta, isReconnect: false };
  },

  /**
   * Menandai koneksi socket terputus tanpa menghilangkan progres pemain.
   */
  putusKoneksiPeserta(socketId: string): { sessionId?: string; pesertaId?: string } {
    for (const sesi of sesiBalapMap.values()) {
      for (const p of sesi.peserta.values()) {
        if (p.socketId === socketId) {
          p.connected = false;
          return { sessionId: sesi.sessionId, pesertaId: p.id };
        }
      }
    }
    return {};
  },

  /**
   * Mengubah jumlah tim (3 atau 4 tim) saat masih di ruang tunggu & membagi ulang siswa secara adil.
   */
  async ubahJumlahTim(
    sessionId: string,
    hostId: string,
    jumlahTim: 3 | 4
  ): Promise<{
    sesi: SesiBalapKarungActive;
    teams: RingkasanTimBalap[];
    leaderboard: LeaderboardItemBalap[];
  }> {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) {
      throw new Error('Sesi Balap Karung tidak ditemukan.');
    }
    if (sesi.hostId !== hostId) {
      throw new Error('Hanya guru pemilik sesi yang berhak mengubah jumlah tim.');
    }
    if (sesi.status !== 'lobi') {
      throw new Error('Jumlah tim hanya dapat diubah sebelum lomba dimulai.');
    }

    const nextCount: 3 | 4 = jumlahTim === 4 ? 4 : 3;
    sesi.config = Object.freeze({ ...sesi.config, jumlahTim: nextCount });
    sesi.teams = buatPetaTimAwal();
    sesi.timPemenang = null;

    const defs = dapatkanDefinisiTimAktif(nextCount);
    const semua = Array.from(sesi.peserta.values());
    semua.forEach((p, idx) => {
      p.tim = defs[idx % nextCount].id;
    });

    await antrekanPenulisanDb(sessionId, async () => {
      await prisma.session.update({
        where: { id: sesi.sessionId },
        data: { konfigurasi: JSON.stringify(sesi.config) },
      });
      for (const p of semua) {
        await prisma.sessionPlayer.updateMany({
          where: { id: p.id, sessionId: sesi.sessionId },
          data: { tim: p.tim || 'merah' },
        });
      }
    });

    return {
      sesi,
      teams: bangunRingkasanTim(sesi),
      leaderboard: this.dapatkanLeaderboard(sesi.sessionId),
    };
  },

  dapatkanRingkasanTim(sessionId: string, sortByRank: boolean = false): RingkasanTimBalap[] {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) return [];
    return bangunRingkasanTim(sesi, sortByRank);
  },

  /**
   * Guru memulai lomba Balap Karung Challenge (hanya pemilik sesi).
   */
  mulaiPermainan(sessionId: string, hostId?: string): SesiBalapKarungActive {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) {
      throw new Error('Sesi Balap Karung tidak ditemukan.');
    }

    if (hostId && sesi.hostId !== hostId) {
      throw new Error('Hanya guru pemilik sesi yang berhak memulai permainan.');
    }

    if (sesi.status !== 'lobi') {
      throw new Error('Permainan pada sesi ini sudah dimulai sebelumnya.');
    }

    if (sesi.peserta.size === 0) {
      throw new Error('Belum ada siswa yang bergabung di ruang tunggu.');
    }

    if (sesi.questions.length === 0) {
      throw new Error('Bank soal kosong; tambahkan minimal 1 soal sebelum memulai.');
    }

    sesi.status = 'jalan';
    sesi.gameMulaiPadaMs = Date.now();
    sesi.teams = buatPetaTimAwal();
    sesi.timPemenang = null;

    for (const peserta of sesi.peserta.values()) {
      if (!peserta.tim) {
        peserta.tim = pilihTimSeimbang(sesi);
      }
      peserta.jarak = 0;
      peserta.keseimbangan = 100;
      peserta.jumlahJatuh = 0;
      peserta.totalBenar = 0;
      peserta.totalSalah = 0;
      peserta.status = 'bermain';
      peserta.riwayatJawaban = [];
      peserta.riwayatJarak = [];
      peserta.riwayatRintangan = [];
      peserta.antreanSoal = siapkanAntreanSoalBalap(sesi.questions);
      peserta.terakhirSoalId = undefined;
      peserta.presentasiAktif = null;
      peserta.nomorSoalPemain = 0;
    }

    return sesi;
  },

  /**
   * Mengambil soal berikutnya untuk seorang siswa dari antrean acaknya.
   */
  ambilSoalBerikutnyaUntukPeserta(
    sessionId: string,
    pesertaId: string
  ): SoalPublikBalap | null {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || sesi.status !== 'jalan') return null;

    const peserta = sesi.peserta.get(pesertaId);
    if (!peserta) return null;

    if (peserta.status === 'selesai' || peserta.jarak >= sesi.config.targetJarak) {
      return null;
    }

    if (sesi.questions.length === 0) return null;

    if (!peserta.antreanSoal || peserta.antreanSoal.length === 0) {
      peserta.antreanSoal = siapkanAntreanSoalBalap(sesi.questions, peserta.terakhirSoalId);
    }

    const nextQuestionId = peserta.antreanSoal.shift();
    if (!nextQuestionId) return null;

    const soal = sesi.questions.find((q) => q.id === nextQuestionId);
    if (!soal) return null;

    peserta.nomorSoalPemain += 1;
    const presentasi = buatPresentasiSoalBalap(soal, peserta.nomorSoalPemain, Date.now());

    peserta.terakhirSoalId = soal.id;
    peserta.presentasiAktif = presentasi;

    return formatPresentasiPublik(
      presentasi,
      sesi.totalSoal,
      sesi.config.waktuPerSoalDetik
    );
  },

  /**
   * Mengambil soal yang sedang aktif bagi siswa (misal reconnect) atau menyiapkan yang baru.
   */
  dapatkanSoalAktifPeserta(
    sessionId: string,
    pesertaId: string
  ): SoalPublikBalap | null {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || sesi.status !== 'jalan') return null;

    const peserta = sesi.peserta.get(pesertaId);
    if (!peserta || peserta.status === 'selesai' || peserta.jarak >= sesi.config.targetJarak) {
      return null;
    }

    if (peserta.presentasiAktif) {
      return formatPresentasiPublik(
        peserta.presentasiAktif,
        sesi.totalSoal,
        sesi.config.waktuPerSoalDetik
      );
    }

    return this.ambilSoalBerikutnyaUntukPeserta(sessionId, pesertaId);
  },

  /**
   * Memproses jawaban siswa dengan perlindungan duplikat, replay, spoofing, serta pembaruan skor tim adil.
   */
  prosesJawabanSiswa(params: {
    sessionId: string;
    pesertaId: string;
    pesertaSecret?: string;
    socketId?: string;
    presentationId?: string;
    questionId?: string;
    choiceId?: string;
    jawaban?: string;
    timedOut?: boolean;
    nowMs?: number;
    rngRintangan?: RngBalapKarung;
  }): {
    hasilJawaban: HasilJawabanBalap;
    kunciKey: string;
    penjelasan: string | null;
    leaderboard: LeaderboardItemBalap[];
    teams: RingkasanTimBalap[];
    timPeserta: KodeTimBalap;
    stepTim: number;
    terpeleset: boolean;
    stumbleQuote: string | null;
    timMenangId: KodeTimBalap | null;
    timMenangNama: string | null;
    pemainSelesai: boolean;
    semuaPemainSelesai: boolean;
  } {
    const {
      sessionId,
      pesertaId,
      pesertaSecret,
      socketId,
      presentationId,
      questionId,
      choiceId,
      jawaban,
      timedOut = false,
      nowMs = Date.now(),
      rngRintangan,
    } = params;

    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) {
      throw new Error('Sesi Balap Karung tidak ditemukan.');
    }

    if (sesi.status !== 'jalan') {
      throw new Error('Permainan telah berakhir atau belum dimulai. Jawaban tidak diterima.');
    }

    const peserta = sesi.peserta.get(pesertaId);
    if (!peserta) {
      throw new Error('Identitas pemain tidak terdaftar dalam sesi ini.');
    }

    if (pesertaSecret && peserta.secretToken !== pesertaSecret) {
      throw new Error('Token identitas pemain tidak sah.');
    }
    if (!pesertaSecret && socketId && peserta.socketId && peserta.socketId !== socketId) {
      throw new Error('Perangkat pengirim tidak cocok dengan sesi pemain.');
    }

    if (sesi.timPemenang || peserta.status === 'selesai') {
      throw new Error('Perlombaan tim telah selesai.');
    }

    const presentasi = peserta.presentasiAktif;
    if (!presentasi) {
      throw new Error('Tidak ada pertanyaan aktif atau jawaban untuk soal ini sudah diproses.');
    }

    if (presentationId && presentasi.presentationId !== presentationId) {
      throw new Error('Pertanyaan sudah kedaluwarsa atau jawaban sudah pernah dikirim.');
    }
    if (sesi.processedPresentations.has(presentasi.presentationId)) {
      throw new Error('Jawaban ganda terdeteksi dan ditolak oleh server.');
    }
    if (questionId && presentasi.questionId !== questionId) {
      throw new Error('Identitas pertanyaan tidak sesuai dengan soal aktif Anda.');
    }

    // Tandai presentasi secara sinkron sebelum proses & penyimpanan
    sesi.processedPresentations.add(presentasi.presentationId);

    // Siapkan konteks tim terlebih dahulu agar langkah, penalti, streak, keseimbangan,
    // dan rintangan berjalan sesuai konfigurasi guru & dinormalisasi adil per anggota tim.
    const timKode: KodeTimBalap = peserta.tim || pilihTimSeimbang(sesi);
    const jumlahAnggotaTim = Math.max(
      1,
      Array.from(sesi.peserta.values()).filter((p) => (p.tim || timKode) === timKode).length
    );

    const tState = sesi.teams.get(timKode) || {
      id: timKode,
      nama: TIM_BALAP_RESMI.find((t) => t.id === timKode)?.nama || 'Tim Merah',
      warna: TIM_BALAP_RESMI.find((t) => t.id === timKode)?.warna || '#e2312d',
      meter: 0,
      selesaiPadaMs: null,
    };
    const teamMeterBefore = tState.meter;

    // Gunakan targetJarak besar sementara agar kelulusan tetap ditentukan mutlak oleh posisi tim
    const teamConfigForAttempt: KonfigurasiBalapKarung = Object.freeze({
      ...sesi.config,
      targetJarak: Number.MAX_SAFE_INTEGER,
    });
    const pesertaForAttempt: PesertaBalapKarungState = {
      ...peserta,
      tim: timKode,
      status: 'bermain',
      jarak: teamMeterBefore * jumlahAnggotaTim,
    };

    let hasilJawaban: HasilJawabanBalap;
    try {
      hasilJawaban = prosesJawabanBalapKarung({
        peserta: pesertaForAttempt,
        presentasi,
        choiceId,
        fallbackJawabanKey: jawaban,
        timedOut,
        config: teamConfigForAttempt,
        gameMulaiPadaMs: sesi.gameMulaiPadaMs || nowMs,
        nowMs,
        rngRintangan,
      });
    } catch (err) {
      sesi.processedPresentations.delete(presentasi.presentationId);
      throw err;
    }

    hasilJawaban.pesertaUpdated.tim = timKode;
    hasilJawaban.pesertaUpdated.status = 'bermain';
    hasilJawaban.pesertaUpdated.selesaiPada = null;
    hasilJawaban.pesertaUpdated.waktuSelesaiMs = null;
    hasilJawaban.selesaiBaru = false;

    const rawTeamDelta = hasilJawaban.jarakBaru - teamMeterBefore * jumlahAnggotaTim;
    const stepTim = rawTeamDelta / jumlahAnggotaTim;
    const meterSesudah = Math.max(0, teamMeterBefore + stepTim);
    const actualTeamDelta = meterSesudah - teamMeterBefore;

    tState.meter = meterSesudah;
    sesi.teams.set(timKode, tState);

    let terpeleset = false;
    let stumbleQuote: string | null = null;
    let timMenangId: KodeTimBalap | null = null;
    let timMenangNama: string | null = null;

    if (!hasilJawaban.benar) {
      terpeleset = true;
      stumbleQuote =
        KATA_TERSANDUNG_BALAP[crypto.randomInt(0, KATA_TERSANDUNG_BALAP.length)] || 'Aduh!';
    }

    if (tState.meter >= sesi.config.targetJarak - 1e-6) {
      if (tState.meter < sesi.config.targetJarak) {
        tState.meter = sesi.config.targetJarak;
      }
      tState.selesaiPadaMs = nowMs;
      sesi.teams.set(timKode, tState);
      sesi.timPemenang = timKode;
      timMenangId = timKode;
      timMenangNama = tState.nama;
      hasilJawaban.selesaiBaru = true;
      hasilJawaban.pesertaUpdated.status = 'selesai';
      hasilJawaban.pesertaUpdated.selesaiPada = nowMs;
      hasilJawaban.pesertaUpdated.waktuSelesaiMs = Math.max(
        1,
        nowMs - (sesi.gameMulaiPadaMs || nowMs)
      );
    }

    const roundedBefore = Number(teamMeterBefore.toFixed(2));
    const roundedAfter = Number(tState.meter.toFixed(2));
    const roundedDelta = Number(actualTeamDelta.toFixed(2));

    hasilJawaban.jarakSebelum = roundedBefore;
    hasilJawaban.jarakBaru = roundedAfter;
    hasilJawaban.perubahanJarak = roundedDelta;

    const lastJarakIdx = hasilJawaban.pesertaUpdated.riwayatJarak.length - 1;
    if (lastJarakIdx >= 0) {
      hasilJawaban.pesertaUpdated.riwayatJarak[lastJarakIdx] = {
        ...hasilJawaban.pesertaUpdated.riwayatJarak[lastJarakIdx],
        jarakSebelum: roundedBefore,
        perubahanJarak: roundedDelta,
        jarakSesudah: roundedAfter,
      };
    }

    const lastJawIdx = hasilJawaban.pesertaUpdated.riwayatJawaban.length - 1;
    if (lastJawIdx >= 0) {
      hasilJawaban.pesertaUpdated.riwayatJawaban[lastJawIdx] = {
        ...hasilJawaban.pesertaUpdated.riwayatJawaban[lastJawIdx],
        perubahanJarak: roundedDelta,
        jarakSesudah: roundedAfter,
      };
    }

    // Jarak individu disimpan sebagai posisi tim rounded agar DB & leaderboard konsisten
    hasilJawaban.pesertaUpdated.jarak = Math.round(tState.meter);

    sesi.peserta.set(peserta.id, hasilJawaban.pesertaUpdated);
    void this.sinkronkanPesertaKeDb(sesi.sessionId, hasilJawaban.pesertaUpdated);

    const soalAsli = sesi.questions.find((q) => q.id === presentasi.questionId);
    const lombaSelesai = Boolean(sesi.timPemenang);

    return {
      hasilJawaban,
      kunciKey: presentasi.kunciKey,
      penjelasan: soalAsli?.penjelasan || null,
      leaderboard: this.dapatkanLeaderboard(sesi.sessionId),
      teams: this.dapatkanRingkasanTim(sesi.sessionId),
      timPeserta: timKode,
      stepTim: roundedDelta,
      terpeleset,
      stumbleQuote,
      timMenangId,
      timMenangNama,
      pemainSelesai: Boolean(timMenangId),
      semuaPemainSelesai: lombaSelesai,
    };
  },

  dapatkanLeaderboard(sessionId: string): LeaderboardItemBalap[] {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) return [];
    const sorted = urutkanLeaderboardBalapKarung(
      Array.from(sesi.peserta.values()),
      sesi.config.targetJarak
    );
    return sorted.map((p, idx) =>
      formatLeaderboardItem(p, idx + 1, sesi.config.targetJarak)
    );
  },

  dapatkanLaporanSementara(sessionId: string): LaporanAkhirBalapKarung | null {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) return null;
    return buatLaporanAkhirBalap(sesi, false, Date.now());
  },

  /**
   * Mengakhiri sesi Balap Karung Challenge (otomatis ketika semua finis atau manual oleh guru).
   */
  akhiriPermainan(sessionId: string, dihentikanManual: boolean = false): LaporanAkhirBalapKarung {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) {
      throw new Error('Sesi Balap Karung tidak ditemukan.');
    }

    if (sesi.status === 'selesai' && sesi.hasil) {
      return sesi.hasil;
    }

    sesi.status = 'selesai';
    const hasil = buatLaporanAkhirBalap(sesi, dihentikanManual, Date.now());
    sesi.hasil = hasil;
    return hasil;
  },

  async sinkronkanPesertaKeDb(
    sessionId: string,
    p: PesertaBalapKarungState
  ): Promise<void> {
    return antrekanPenulisanDb(sessionId, async () => {
      try {
        await prisma.sessionPlayer.upsert({
          where: { id: p.id },
          update: {
            nama: p.nama,
            tim: p.tim || null,
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
            sessionId,
            nama: p.nama,
            tim: p.tim || null,
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
      } catch {
        // Aman diabaikan bila sesi hanya berjalan di unit test in-memory tanpa row DB
      }
    });
  },

  /**
   * Menyimpan seluruh hasil akhir, pemain, dan statistik soal ke SQLite dalam 1 transaksi.
   */
  async simpanHasilAkhirKeDatabase(sessionId: string): Promise<void> {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || !sesi.hasil) return;
    const hasil = sesi.hasil;

    return antrekanPenulisanDb(sessionId, async () => {
      const teamMetersSnapshot: Record<string, { meter: number; selesaiPadaMs: number | null }> = {};
      for (const [k, v] of sesi.teams.entries()) {
        teamMetersSnapshot[k] = {
          meter: Number(v.meter.toFixed(2)),
          selesaiPadaMs: v.selesaiPadaMs,
        };
      }

      await prisma.$transaction(async (tx) => {
        await tx.session.update({
          where: { id: sesi.sessionId },
          data: {
            status: 'selesai',
            selesaiPada: new Date(hasil.selesaiPadaMs),
            konfigurasi: JSON.stringify({
              playMode: 'MULTIPLAYER',
              config: sesi.config,
              teamMeters: teamMetersSnapshot,
              timPemenang: hasil.timPemenang || sesi.timPemenang || null,
            }),
          },
        });

        const pemenangTim = hasil.laporanTim?.[0];
        const pemenangNama =
          hasil.namaTimPemenang ||
          pemenangTim?.nama ||
          hasil.podium.juara1?.nama ||
          'Selesai';
        const jarakTertinggi = pemenangTim?.meter ?? hasil.podium.juara1?.jarak ?? 0;

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

        for (const p of sesi.peserta.values()) {
          await tx.sessionPlayer.upsert({
            where: { id: p.id },
            update: {
              nama: p.nama,
              tim: p.tim || null,
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
              tim: p.tim || null,
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

        const statPerSoal = new Map<string, { benar: number; salah: number }>();
        for (const q of sesi.questions) {
          statPerSoal.set(q.id, { benar: 0, salah: 0 });
        }
        for (const p of sesi.peserta.values()) {
          for (const j of p.riwayatJawaban) {
            const cur = statPerSoal.get(j.questionId) || { benar: 0, salah: 0 };
            if (j.benar) cur.benar += 1;
            else cur.salah += 1;
            statPerSoal.set(j.questionId, cur);
          }
        }

        await tx.questionStat.deleteMany({
          where: { sessionId: sesi.sessionId },
        });

        const statsData = Array.from(statPerSoal.entries()).map(([questionId, st]) => ({
          sessionId: sesi.sessionId,
          questionId,
          jumlahBenar: st.benar,
          jumlahSalah: st.salah,
        }));
        if (statsData.length > 0) {
          await tx.questionStat.createMany({ data: statsData });
        }
      }, { maxWait: 10000, timeout: 15000 });
    });
  },

  /**
   * Memuat laporan lengkap Balap Karung dari memori atau SQLite tanpa mencemari peta sesi aktif.
   */
  async muatLaporanDariDatabase(sessionId: string): Promise<LaporanAkhirBalapKarung | null> {
    const inMem = this.dapatkanSesi(sessionId);
    if (inMem?.hasil) return inMem.hasil;
    if (inMem) return buatLaporanAkhirBalap(inMem, false, Date.now());

    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: { include: { questions: { orderBy: { urutan: 'asc' } } } },
        players: true,
      },
    });

    if (!sessionDb || sessionDb.template.game !== 'balap_karung') {
      return null;
    }

    let parsedConfig: Partial<KonfigurasiBalapKarung> | undefined;
    let storedTeamMeters: Record<string, { meter?: number; selesaiPadaMs?: number | null }> | null =
      null;
    let storedTimPemenang: KodeTimBalap | null = null;
    if (sessionDb.konfigurasi) {
      try {
        const rawJson = JSON.parse(sessionDb.konfigurasi);
        parsedConfig = rawJson?.config || rawJson;
        if (rawJson?.teamMeters && typeof rawJson.teamMeters === 'object') {
          storedTeamMeters = rawJson.teamMeters;
        }
        if (
          rawJson?.timPemenang &&
          ['merah', 'biru', 'hijau', 'kuning'].includes(rawJson.timPemenang)
        ) {
          storedTimPemenang = rawJson.timPemenang as KodeTimBalap;
        }
      } catch {
        parsedConfig = undefined;
      }
    }

    const config = bangunKonfigurasiBalapKarung(parsedConfig);
    const pesertaMap = new Map<string, PesertaBalapKarungState>();
    const defs = dapatkanDefinisiTimAktif(config.jumlahTim);
    const loadedQuestions = sessionDb.template.questions.map(mapDbQuestionForGame);

    sessionDb.players.forEach((pl, plIdx) => {
      let riwayatJarak: RiwayatJarakEntry[] = [];
      let riwayatRintangan: RiwayatRintanganBalapEntry[] = [];
      let riwayatJawaban: PesertaBalapKarungState['riwayatJawaban'] = [];
      try {
        riwayatJarak = JSON.parse(pl.riwayatPosisi || '[]');
      } catch {
        riwayatJarak = [];
      }
      try {
        riwayatRintangan = JSON.parse(pl.riwayatRintangan || '[]');
      } catch {
        riwayatRintangan = [];
      }
      try {
        riwayatJawaban = JSON.parse(pl.riwayatJawaban || '[]');
      } catch {
        riwayatJawaban = [];
      }

      const efekMeta = parseEfekMeta(pl.efekAktif);
      const timValid =
        pl.tim && ['merah', 'biru', 'hijau', 'kuning'].includes(pl.tim)
          ? (pl.tim as KodeTimBalap)
          : defs[plIdx % defs.length]?.id || 'merah';

      pesertaMap.set(pl.id, {
        id: pl.id,
        secretToken: '',
        socketId: '',
        nama: pl.nama,
        tim: timValid,
        connected: false,
        jarak: pl.posisi,
        keseimbangan: config.keseimbanganAktif ? pl.keseimbangan : 100,
        jumlahJatuh: pl.jumlahJatuh,
        totalBenar: pl.totalBenar,
        totalSalah: pl.totalSalah,
        streakSaatIni: pl.streakSaatIni,
        streakTertinggi: pl.streakTertinggi,
        bonus3DalamStreak: Boolean(efekMeta.bonus3DalamStreak ?? pl.streakSaatIni >= 3),
        bonus5DalamStreak: Boolean(efekMeta.bonus5DalamStreak ?? pl.streakSaatIni >= 5),
        totalBonusStreakKali: efekMeta.totalBonusStreakKali ?? 0,
        totalBonusStreakMeter: efekMeta.totalBonusStreakMeter ?? 0,
        status: pl.status === 'selesai' ? 'selesai' : 'bermain',
        waktuSelesaiMs: pl.waktuSelesaiMs,
        selesaiPada: pl.selesaiPada ? pl.selesaiPada.getTime() : null,
        totalWaktuJawabMs: pl.totalWaktuJawabMs,
        jumlahJawab: pl.jumlahJawab,
        rataRataWaktuJawabMs:
          pl.jumlahJawab > 0 ? Math.round(pl.totalWaktuJawabMs / pl.jumlahJawab) : 0,
        efekAktif: {
          perisai: Boolean(efekMeta.perisai),
          lompatanKuat: Boolean(efekMeta.lompatanKuat),
          jalanBerlumpur: Boolean(efekMeta.jalanBerlumpur),
        },
        riwayatJarak,
        riwayatRintangan,
        riwayatJawaban,
        antreanSoal: [],
        presentasiAktif: null,
        nomorSoalPemain: riwayatJawaban.length,
      });
    });

    const teamsMap = buatPetaTimAwal();
    if (storedTeamMeters) {
      for (const [kode, info] of Object.entries(storedTeamMeters)) {
        const tState = teamsMap.get(kode as KodeTimBalap);
        if (tState && info) {
          tState.meter = Number(info.meter ?? 0);
          tState.selesaiPadaMs = info.selesaiPadaMs ?? null;
        }
      }
    }

    const tempSesi: SesiBalapKarungActive = {
      sessionId: sessionDb.id,
      token: sessionDb.token || '',
      templateId: sessionDb.templateId,
      templateJudul: sessionDb.template.judul,
      hostId: sessionDb.hostId,
      status: 'selesai',
      config,
      teams: teamsMap,
      timPemenang: storedTimPemenang,
      peserta: pesertaMap,
      totalSoal: sessionDb.template.questions.length,
      questions: loadedQuestions,
      gameMulaiPadaMs: sessionDb.mulaiPada ? sessionDb.mulaiPada.getTime() : null,
      processedPresentations: new Set(),
    };

    const allSelesai =
      Boolean(storedTimPemenang) ||
      (pesertaMap.size > 0 && Array.from(pesertaMap.values()).every((p) => p.status === 'selesai'));

    return buatLaporanAkhirBalap(
      tempSesi,
      !allSelesai,
      sessionDb.selesaiPada ? sessionDb.selesaiPada.getTime() : Date.now()
    );
  },

  hapusSesi(sessionId: string): void {
    const sesi = sesiBalapMap.get(sessionId);
    if (sesi) {
      tokenToSessionIdMap.delete(sesi.token);
      sesiBalapMap.delete(sessionId);
    }
    dbWriteQueues.delete(sessionId);
  },
};
