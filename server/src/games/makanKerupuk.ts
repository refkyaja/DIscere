import crypto from 'crypto';
import { z } from 'zod';
import {
  KODE_OPSI_VALID,
  KunciPilihan,
  extractActiveOptions,
} from '../utils/questionOptions.js';

/**
 * Modul Domain Bersama (Shared Engine) Game Edukasi: Makan Kerupuk Challenge
 * Digunakan bersama oleh Mode Solo (Perangkat Guru) dan Mode Multiplayer (HP Siswa):
 * - Konfigurasi target kerupuk & probabilitas gigitan immutable
 * - Pengacakan soal Fisher-Yates (crypto.randomInt) & anti-repeat berurutan
 * - Pembentukan & validasi presentasi soal aman berbasis presentationId & choiceId
 * - Undian RNG gigitan kerupuk di backend
 * - Kalkulasi skor terpisah (Pembelajaran, Streak 3, Keberuntungan, Penyelesaian)
 * - Kriteria pengurutan leaderboard Multiplayer
 */

export type PlayModeKerupuk = 'SOLO' | 'MULTIPLAYER';
export type TipeGigitan = 'besar' | 'sedang' | 'kecil' | 'sangat_kecil' | 'zonk';
export type KesulitanKerupuk = 'mudah' | 'normal' | 'sulit' | 'custom';
export type TargetKerupukPreset = '50' | '100' | '150' | '200' | 'custom';
export type StateKerupukSolo = 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED' | 'STOPPED';

export interface SoalKerupuk {
  id: string;
  urutan: number;
  teks: string;
  opsiA: string;
  opsiB: string;
  opsiC?: string | null;
  opsiD?: string | null;
  opsiE?: string | null;
  jawabanBenar: string;
  penjelasan: string | null;
}

export interface ProbabilitasConfig {
  besar: number;        // -40% target, +40 poin keberuntungan
  sedang: number;       // -25% target, +25 poin keberuntungan
  kecil: number;        // -10% target, +10 poin keberuntungan
  sangat_kecil: number; // -5% target,  +5 poin keberuntungan (Gigitan Mini)
  zonk: number;         // 0% target,   +0 poin keberuntungan
}

export interface KonfigurasiKerupukSolo {
  targetKerupuk: number;
  targetPreset: TargetKerupukPreset;
  kesulitan: KesulitanKerupuk;
  probabilitas: ProbabilitasConfig;
  waktuPerSoalDetik: number;
}

export interface KonfigurasiKerupukMulti extends KonfigurasiKerupukSolo {
  maxPeserta: number;
  allowLateJoin: boolean;
  jumlahTim: 3 | 4;
}

export interface HasilGachaGigitan {
  tipe: TipeGigitan;
  label: string;
  berkurangPersen: number;
  penguranganPoinTarget: number;
  penguranganEfektifPoin: number;
  poinGigitan: number;
}

export interface PilihanSoalKerupuk {
  choiceId: string;
  label: KunciPilihan;
  teks: string;
}

export interface SoalTampilKerupuk {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  totalSoalBank: number;
  teks: string;
  pilihan: PilihanSoalKerupuk[];
  waktuPerSoalDetik?: number;
  berakhirPadaMs?: number;
  serverNowMs?: number;
}

export interface ActivePresentationKerupuk {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  teks: string;
  pilihanList: PilihanSoalKerupuk[];
  pilihanMap: Map<string, KunciPilihan>;
  correctChoiceId: string;
  jawabanBenarKode: KunciPilihan;
  penjelasan: string | null;
  tampilPadaMs: number;
  pausedDurationMs: number;
}

export interface RiwayatGigitanItem {
  urutan: number;
  questionId: string;
  nomorSoal: number;
  benar: boolean;
  tipe: TipeGigitan | 'salah';
  label: string;
  penguranganPoin: number;
  poinPembelajaranDidapat: number;
  poinStreakDidapat: number;
  poinKeberuntunganDidapat: number;
  poinPenyelesaianDidapat: number;
  totalPoinDidapat: number;
  sisaKerupukSetelah: number;
  waktuJawabMs: number;
  timestamp: number;
}

export interface SoloKerupukState {
  sisaKerupuk: number;
  targetKerupuk: number;
  progresPersen: number;
  sisaPersen: number;
  skorTotal: number;
  skorPembelajaran: number;   // Jawaban benar (+100) + bonus streak (+50 saat mencapai streak 3)
  skorDasarBenar: number;     // Akumulasi +100 jawaban benar
  totalBonusStreak: number;   // Akumulasi +50 setiap rangkaian mencapai 3
  kaliBonusStreak: number;
  bonusKeberuntungan: number; // Akumulasi poin dari ukuran gigitan
  bonusPenyelesaian: number;  // +100 diberikan 1x tepat saat sisaKerupuk mencapai 0
  totalBenar: number;
  totalSalah: number;
  streakBenar: number;
  streakTertinggi: number;
  bonusStreakDiberikanPadaRangkaian: boolean;
  selesaiKerupuk: boolean;
  waktuMulaiMs: number | null;
  waktuSelesaiMs: number | null;
  totalWaktuJawabMs: number;
  jumlahJawab: number;
  rataRataWaktuJawabMs: number;
  terakhirGigitan: HasilGachaGigitan | null;
  riwayatGigitan: RiwayatGigitanItem[];
  statistikGigitan: Record<TipeGigitan, number>;
}

export const TARGET_KERUPUK_PRESETS: readonly number[] = [50, 100, 150, 200];

export const PRESET_PROBABILITAS: Record<'normal' | 'mudah' | 'sulit', Readonly<ProbabilitasConfig>> = {
  normal: Object.freeze({
    besar: 15,
    sedang: 25,
    kecil: 35,
    sangat_kecil: 20,
    zonk: 5,
  }),
  mudah: Object.freeze({
    besar: 35,
    sedang: 30,
    kecil: 20,
    sangat_kecil: 12,
    zonk: 3,
  }),
  sulit: Object.freeze({
    besar: 5,
    sedang: 15,
    kecil: 30,
    sangat_kecil: 35,
    zonk: 15,
  }),
};

export interface GigitanSpec {
  label: string;
  persen: number;
  poin: number;
}

export const GIGITAN_INFO: Record<TipeGigitan, GigitanSpec> = {
  besar: { label: 'Gigitan Besar', persen: 40, poin: 40 },
  sedang: { label: 'Gigitan Sedang', persen: 25, poin: 25 },
  kecil: { label: 'Gigitan Kecil', persen: 10, poin: 10 },
  sangat_kecil: { label: 'Gigitan Mini', persen: 5, poin: 5 },
  zonk: { label: 'Zonk! Meleset', persen: 0, poin: 0 },
};

export const probabilitasSchema = z
  .object({
    besar: z.number().finite().min(0, 'Probabilitas tidak boleh negatif.'),
    sedang: z.number().finite().min(0, 'Probabilitas tidak boleh negatif.'),
    kecil: z.number().finite().min(0, 'Probabilitas tidak boleh negatif.'),
    sangat_kecil: z.number().finite().min(0, 'Probabilitas tidak boleh negatif.'),
    zonk: z.number().finite().min(0, 'Probabilitas tidak boleh negatif.'),
  })
  .refine(
    (p) => Math.abs(p.besar + p.sedang + p.kecil + p.sangat_kecil + p.zonk - 100) < 0.001,
    { message: 'Total seluruh probabilitas gigitan harus tepat 100%.' }
  );

export const konfigurasiKerupukSoloSchema = z.object({
  targetKerupuk: z
    .number()
    .int('Target kerupuk harus berupa bilangan bulat.')
    .min(10, 'Target kerupuk minimal 10 poin.')
    .max(1000, 'Target kerupuk maksimal 1000 poin.')
    .default(100),
  targetPreset: z.enum(['50', '100', '150', '200', 'custom']).optional(),
  kesulitan: z.enum(['mudah', 'normal', 'sulit', 'custom']).default('normal'),
  probabilitas: probabilitasSchema.optional(),
  waktuPerSoalDetik: z.number().int().min(5).max(120).default(15),
});

export const konfigurasiKerupukMultiSchema = konfigurasiKerupukSoloSchema.extend({
  maxPeserta: z
    .number()
    .int('Kapasitas peserta harus berupa bilangan bulat.')
    .min(5, 'Kapasitas peserta minimal 5 siswa.')
    .max(200, 'Kapasitas peserta maksimal 200 siswa.')
    .default(40),
  allowLateJoin: z.boolean().default(true),
  jumlahTim: z
    .preprocess((v) => (v === 4 || v === '4' ? 4 : 3), z.union([z.literal(3), z.literal(4)]))
    .default(3),
});

export function validasiProbabilitas(prob: ProbabilitasConfig): {
  valid: boolean;
  total: number;
  pesanError?: string;
} {
  if (!prob || typeof prob !== 'object') {
    return { valid: false, total: 0, pesanError: 'Konfigurasi probabilitas wajib diisi.' };
  }

  const keys: TipeGigitan[] = ['besar', 'sedang', 'kecil', 'sangat_kecil', 'zonk'];
  let total = 0;

  for (const key of keys) {
    const val = Number(prob[key]);
    if (!Number.isFinite(val) || val < 0) {
      return {
        valid: false,
        total: 0,
        pesanError: `Nilai probabilitas "${key}" harus berupa angka non-negatif.`,
      };
    }
    total += val;
  }

  if (Math.abs(total - 100) > 0.001) {
    return {
      valid: false,
      total: Number(total.toFixed(2)),
      pesanError: `Total probabilitas gigitan harus tepat 100% (saat ini: ${total}%).`,
    };
  }

  return { valid: true, total: 100 };
}

export function bangunKonfigurasiKerupukSolo(
  input?: Partial<{
    targetKerupuk: number;
    targetPreset: TargetKerupukPreset;
    kesulitan: KesulitanKerupuk;
    probabilitas: ProbabilitasConfig;
    waktuPerSoalDetik: number;
  }>
): KonfigurasiKerupukSolo {
  const targetKerupuk = input?.targetKerupuk ?? 100;
  if (!Number.isInteger(targetKerupuk) || targetKerupuk < 10 || targetKerupuk > 1000) {
    throw new Error('Target kerupuk harus bilangan bulat antara 10 hingga 1000 poin.');
  }

  const targetPreset: TargetKerupukPreset =
    input?.targetPreset ??
    (TARGET_KERUPUK_PRESETS.includes(targetKerupuk)
      ? (String(targetKerupuk) as TargetKerupukPreset)
      : 'custom');

  const kesulitan: KesulitanKerupuk = input?.kesulitan ?? 'normal';

  let rawProb: ProbabilitasConfig;
  if (kesulitan === 'custom' || input?.probabilitas) {
    rawProb = {
      besar: Number(input?.probabilitas?.besar ?? PRESET_PROBABILITAS.normal.besar),
      sedang: Number(input?.probabilitas?.sedang ?? PRESET_PROBABILITAS.normal.sedang),
      kecil: Number(input?.probabilitas?.kecil ?? PRESET_PROBABILITAS.normal.kecil),
      sangat_kecil: Number(
        input?.probabilitas?.sangat_kecil ?? PRESET_PROBABILITAS.normal.sangat_kecil
      ),
      zonk: Number(input?.probabilitas?.zonk ?? PRESET_PROBABILITAS.normal.zonk),
    };
  } else {
    rawProb = { ...PRESET_PROBABILITAS[kesulitan] };
  }

  const cek = validasiProbabilitas(rawProb);
  if (!cek.valid) {
    throw new Error(cek.pesanError || 'Konfigurasi probabilitas tidak valid.');
  }

  const waktuPerSoalDetik =
    typeof input?.waktuPerSoalDetik === 'number' && Number.isInteger(input.waktuPerSoalDetik)
      ? Math.max(5, Math.min(120, input.waktuPerSoalDetik))
      : 15;

  return Object.freeze({
    targetKerupuk,
    targetPreset,
    kesulitan,
    probabilitas: Object.freeze({ ...rawProb }),
    waktuPerSoalDetik,
  });
}

export function bangunKonfigurasiKerupukMulti(
  input?: Partial<{
    targetKerupuk: number;
    targetPreset: TargetKerupukPreset;
    kesulitan: KesulitanKerupuk;
    probabilitas: ProbabilitasConfig;
    waktuPerSoalDetik: number;
    maxPeserta: number;
    allowLateJoin: boolean;
    jumlahTim: 3 | 4;
  }>
): KonfigurasiKerupukMulti {
  const base = bangunKonfigurasiKerupukSolo(input);
  const maxPeserta =
    typeof input?.maxPeserta === 'number' && Number.isInteger(input.maxPeserta)
      ? Math.max(5, Math.min(200, input.maxPeserta))
      : 40;
  const allowLateJoin = input?.allowLateJoin ?? true;
  const jumlahTim: 3 | 4 = input?.jumlahTim === 4 ? 4 : 3;

  return Object.freeze({
    ...base,
    maxPeserta,
    allowLateJoin,
    jumlahTim,
  });
}

export function hitungPenguranganGigitan(tipe: TipeGigitan, targetKerupuk: number): number {
  const spec = GIGITAN_INFO[tipe];
  if (spec.persen <= 0) return 0;
  return Math.max(1, Math.round((targetKerupuk * spec.persen) / 100));
}

export function hitungPersentaseKerupuk(sisaKerupuk: number, targetKerupuk: number): {
  progresPersen: number;
  sisaPersen: number;
} {
  const safeTarget = Math.max(1, targetKerupuk);
  const clampedSisa = Math.max(0, Math.min(safeTarget, sisaKerupuk));
  const sisaPersen = Math.min(100, Math.max(0, Math.round((clampedSisa / safeTarget) * 100)));
  const progresPersen = Math.min(100, Math.max(0, 100 - sisaPersen));
  return { progresPersen, sisaPersen };
}

export function normalisasiKodeJawaban(raw: string): KunciPilihan {
  const cleaned = String(raw || '').trim().toUpperCase();
  if ((KODE_OPSI_VALID as readonly string[]).includes(cleaned)) {
    return cleaned as KunciPilihan;
  }
  throw new Error(`Kode kunci jawaban "${raw}" tidak valid pada bank soal.`);
}

/**
 * Mengacak ID soal dengan algoritma Fisher-Yates berbasis crypto.randomInt.
 * Mencegah soal pertama siklus baru sama dengan soal terakhir yang tampil jika bank > 1.
 */
export function siapkanAntreanSoalKerupuk(
  questions: SoalKerupuk[],
  terakhirSoalId?: string
): string[] {
  if (!questions || questions.length === 0) return [];
  const ids = questions.map((q) => q.id);

  for (let i = ids.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const temp = ids[i];
    ids[i] = ids[j];
    ids[j] = temp;
  }

  if (ids.length > 1 && terakhirSoalId && ids[0] === terakhirSoalId) {
    const swapIdx = crypto.randomInt(1, ids.length);
    const temp = ids[0];
    ids[0] = ids[swapIdx];
    ids[swapIdx] = temp;
  }

  return ids;
}

/**
 * Mengambil & membentuk presentasi soal aman berbasis presentationId + choiceId
 * untuk satu pemain (guru pada Solo atau tiap siswa pada Multiplayer).
 */
export function siapkanPresentasiSoalDariAntrean(
  questions: SoalKerupuk[],
  antreanSoalIds: string[],
  terakhirSoalId: string | undefined,
  nomorSoalBaru: number,
  sekarangMs: number = Date.now()
): {
  presentation: ActivePresentationKerupuk;
  antreanBaru: string[];
  terakhirSoalIdBaru: string;
} {
  if (!questions || questions.length === 0) {
    throw new Error('Bank soal kosong. Tambahkan minimal 1 soal untuk memulai permainan.');
  }

  const queue = antreanSoalIds.length > 0
    ? [...antreanSoalIds]
    : siapkanAntreanSoalKerupuk(questions, terakhirSoalId);

  const nextQuestionId = queue.shift();
  const soal = questions.find((q) => q.id === nextQuestionId) || questions[0];

  const presentationId = crypto.randomUUID();
  const pilihanRaw = extractActiveOptions(soal);
  const rawKunci = normalisasiKodeJawaban(soal.jawabanBenar);
  const jawabanBenarKode: KunciPilihan = pilihanRaw.some((p) => p.key === rawKunci)
    ? rawKunci
    : pilihanRaw[0].key;

  const pilihanMap = new Map<string, KunciPilihan>();
  let correctChoiceId = '';

  const pilihanList: PilihanSoalKerupuk[] = pilihanRaw.map((item) => {
    const choiceId = `${presentationId}_${item.key}_${crypto.randomBytes(4).toString('hex')}`;
    pilihanMap.set(choiceId, item.key);
    if (item.key === jawabanBenarKode) {
      correctChoiceId = choiceId;
    }
    return {
      choiceId,
      label: item.key,
      teks: item.teks,
    };
  });

  return {
    presentation: {
      presentationId,
      questionId: soal.id,
      nomorSoal: nomorSoalBaru,
      teks: soal.teks,
      pilihanList,
      pilihanMap,
      correctChoiceId,
      jawabanBenarKode,
      penjelasan: soal.penjelasan,
      tampilPadaMs: sekarangMs,
      pausedDurationMs: 0,
    },
    antreanBaru: queue,
    terakhirSoalIdBaru: soal.id,
  };
}

export function serialisasiSoalTampilKerupuk(
  pres: ActivePresentationKerupuk | null,
  totalSoalBank: number,
  waktuPerSoalDetik: number = 15
): SoalTampilKerupuk | null {
  if (!pres) return null;
  const durasiSec = Math.max(5, waktuPerSoalDetik);
  const nowMs = Date.now();
  return {
    presentationId: pres.presentationId,
    questionId: pres.questionId,
    nomorSoal: pres.nomorSoal,
    totalSoalBank,
    teks: pres.teks,
    pilihan: pres.pilihanList.map((p) => ({
      choiceId: p.choiceId,
      label: p.label,
      teks: p.teks,
    })),
    waktuPerSoalDetik: durasiSec,
    berakhirPadaMs: pres.tampilPadaMs + durasiSec * 1000,
    serverNowMs: nowMs,
  };
}

export function drawGachaGigitan(
  prob: ProbabilitasConfig,
  targetKerupuk: number = 100,
  randomNormalized?: number
): HasilGachaGigitan {
  const keys: TipeGigitan[] = ['besar', 'sedang', 'kecil', 'sangat_kecil', 'zonk'];
  const validKeys = keys.filter((k) => Number(prob[k]) > 0);
  if (validKeys.length === 0) {
    throw new Error('Tidak ada probabilitas gigitan positif yang dapat diundi.');
  }

  let rollPercent: number;
  if (typeof randomNormalized === 'number') {
    rollPercent = Math.min(99.999999, Math.max(0, randomNormalized * 100));
  } else {
    const r = crypto.randomInt(0, 10000);
    rollPercent = r / 100;
  }

  let kumulatif = 0;
  let terpilih: TipeGigitan = validKeys[validKeys.length - 1];

  for (const key of validKeys) {
    kumulatif += Number(prob[key]);
    if (rollPercent < kumulatif) {
      terpilih = key;
      break;
    }
  }

  const info = GIGITAN_INFO[terpilih];
  const penguranganPoinTarget = hitungPenguranganGigitan(terpilih, targetKerupuk);

  return {
    tipe: terpilih,
    label: info.label,
    berkurangPersen: info.persen,
    penguranganPoinTarget,
    penguranganEfektifPoin: penguranganPoinTarget,
    poinGigitan: info.poin,
  };
}

export function buatStateKerupukAwal(
  targetKerupuk: number,
  waktuMulaiMs: number | null = null
): SoloKerupukState {
  return {
    sisaKerupuk: targetKerupuk,
    targetKerupuk,
    progresPersen: 0,
    sisaPersen: 100,
    skorTotal: 0,
    skorPembelajaran: 0,
    skorDasarBenar: 0,
    totalBonusStreak: 0,
    kaliBonusStreak: 0,
    bonusKeberuntungan: 0,
    bonusPenyelesaian: 0,
    totalBenar: 0,
    totalSalah: 0,
    streakBenar: 0,
    streakTertinggi: 0,
    bonusStreakDiberikanPadaRangkaian: false,
    selesaiKerupuk: false,
    waktuMulaiMs,
    waktuSelesaiMs: null,
    totalWaktuJawabMs: 0,
    jumlahJawab: 0,
    rataRataWaktuJawabMs: 0,
    terakhirGigitan: null,
    riwayatGigitan: [],
    statistikGigitan: {
      besar: 0,
      sedang: 0,
      kecil: 0,
      sangat_kecil: 0,
      zonk: 0,
    },
  };
}

export interface HasilProsesJawabanKerupuk {
  benar: boolean;
  poinDidapat: number;
  poinDasar: number;
  bonusStreak: number;
  bonusPenyelesaian: number;
  gacha: HasilGachaGigitan | null;
  sisaKerupukBaru: number;
  progresPersenBaru: number;
  selesaiBaru: boolean;
  stateUpdated: SoloKerupukState;
  gigitanLogItem: RiwayatGigitanItem;
}

/**
 * Mesin inti kalkulasi jawaban, undian gigitan, streak, & skor Makan Kerupuk Challenge.
 * Dipakai identik oleh Solo Mode maupun setiap peserta pada Multiplayer Mode.
 */
export function hitungHasilJawabanKerupukSolo(
  state: SoloKerupukState,
  config: KonfigurasiKerupukSolo,
  soalMeta: { questionId: string; nomorSoal: number },
  benar: boolean,
  waktuJawabMs: number,
  sekarangMs: number = Date.now(),
  randomNormalized?: number
): HasilProsesJawabanKerupuk {
  if (state.selesaiKerupuk || state.sisaKerupuk <= 0) {
    throw new Error('Permainan sudah selesai (kerupuk sudah habis).');
  }

  const safeWaktuMs = Math.max(0, Math.round(waktuJawabMs));
  const updated: SoloKerupukState = {
    ...state,
    riwayatGigitan: [...state.riwayatGigitan],
    statistikGigitan: { ...state.statistikGigitan },
  };

  updated.jumlahJawab += 1;
  updated.totalWaktuJawabMs += safeWaktuMs;
  updated.rataRataWaktuJawabMs = Math.round(updated.totalWaktuJawabMs / updated.jumlahJawab);

  if (!benar) {
    updated.totalSalah += 1;
    updated.streakBenar = 0;
    updated.bonusStreakDiberikanPadaRangkaian = false;

    const logSalah: RiwayatGigitanItem = {
      urutan: updated.riwayatGigitan.length + 1,
      questionId: soalMeta.questionId,
      nomorSoal: soalMeta.nomorSoal,
      benar: false,
      tipe: 'salah',
      label: 'Jawaban Salah (Tidak Menggigit)',
      penguranganPoin: 0,
      poinPembelajaranDidapat: 0,
      poinStreakDidapat: 0,
      poinKeberuntunganDidapat: 0,
      poinPenyelesaianDidapat: 0,
      totalPoinDidapat: 0,
      sisaKerupukSetelah: updated.sisaKerupuk,
      waktuJawabMs: safeWaktuMs,
      timestamp: sekarangMs,
    };
    updated.riwayatGigitan.push(logSalah);

    return {
      benar: false,
      poinDidapat: 0,
      poinDasar: 0,
      bonusStreak: 0,
      bonusPenyelesaian: 0,
      gacha: null,
      sisaKerupukBaru: updated.sisaKerupuk,
      progresPersenBaru: updated.progresPersen,
      selesaiBaru: false,
      stateUpdated: updated,
      gigitanLogItem: logSalah,
    };
  }

  const poinDasar = 100;
  updated.totalBenar += 1;
  updated.skorDasarBenar += poinDasar;
  updated.streakBenar += 1;
  if (updated.streakBenar > updated.streakTertinggi) {
    updated.streakTertinggi = updated.streakBenar;
  }

  let bonusStreak = 0;
  if (updated.streakBenar === 3 && !updated.bonusStreakDiberikanPadaRangkaian) {
    bonusStreak = 50;
    updated.bonusStreakDiberikanPadaRangkaian = true;
    updated.totalBonusStreak += bonusStreak;
    updated.kaliBonusStreak += 1;
  }

  updated.skorPembelajaran += poinDasar + bonusStreak;

  const gachaRaw = drawGachaGigitan(config.probabilitas, config.targetKerupuk, randomNormalized);
  const sisaSebelum = updated.sisaKerupuk;
  const sisaBaru = Math.max(0, sisaSebelum - gachaRaw.penguranganPoinTarget);
  const penguranganEfektif = sisaSebelum - sisaBaru;

  const gacha: HasilGachaGigitan = {
    ...gachaRaw,
    penguranganEfektifPoin: penguranganEfektif,
  };

  updated.statistikGigitan[gacha.tipe] += 1;
  updated.bonusKeberuntungan += gacha.poinGigitan;
  updated.sisaKerupuk = sisaBaru;
  updated.terakhirGigitan = gacha;

  const { progresPersen, sisaPersen } = hitungPersentaseKerupuk(sisaBaru, config.targetKerupuk);
  updated.progresPersen = progresPersen;
  updated.sisaPersen = sisaPersen;

  let bonusPenyelesaian = 0;
  let selesaiBaru = false;
  if (sisaBaru === 0 && !updated.selesaiKerupuk) {
    bonusPenyelesaian = 100;
    updated.bonusPenyelesaian = 100;
    updated.selesaiKerupuk = true;
    updated.waktuSelesaiMs = sekarangMs;
    selesaiBaru = true;
  }

  const poinDidapat = poinDasar + bonusStreak + gacha.poinGigitan + bonusPenyelesaian;
  updated.skorTotal =
    updated.skorPembelajaran + updated.bonusKeberuntungan + updated.bonusPenyelesaian;

  const logBenar: RiwayatGigitanItem = {
    urutan: updated.riwayatGigitan.length + 1,
    questionId: soalMeta.questionId,
    nomorSoal: soalMeta.nomorSoal,
    benar: true,
    tipe: gacha.tipe,
    label: gacha.label,
    penguranganPoin: penguranganEfektif,
    poinPembelajaranDidapat: poinDasar,
    poinStreakDidapat: bonusStreak,
    poinKeberuntunganDidapat: gacha.poinGigitan,
    poinPenyelesaianDidapat: bonusPenyelesaian,
    totalPoinDidapat: poinDidapat,
    sisaKerupukSetelah: sisaBaru,
    waktuJawabMs: safeWaktuMs,
    timestamp: sekarangMs,
  };
  updated.riwayatGigitan.push(logBenar);

  return {
    benar: true,
    poinDidapat,
    poinDasar,
    bonusStreak,
    bonusPenyelesaian,
    gacha,
    sisaKerupukBaru: sisaBaru,
    progresPersenBaru: progresPersen,
    selesaiBaru,
    stateUpdated: updated,
    gigitanLogItem: logBenar,
  };
}

export interface RankableKerupukPlayer {
  id: string;
  nama: string;
  skorTotal: number;
  totalBenar: number;
  sisaKerupuk: number;
  sisaPersen: number;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
}

/**
 * Kriteria pengurutan leaderboard Multiplayer Makan Kerupuk Challenge:
 * 1. Total skor tertinggi (skorTotal desc)
 * 2. Jumlah jawaban benar terbanyak (totalBenar desc)
 * 3. Persentase kerupuk tersisa paling sedikit (sisaPersen asc)
 * 4. Rata-rata waktu menjawab paling cepat (rataRataWaktuJawabMs asc)
 * 5. Tie-break konsisten: nama alfabetis asc, lalu ID
 */
export function urutkanLeaderboardKerupuk<T extends RankableKerupukPlayer>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (b.skorTotal !== a.skorTotal) {
      return b.skorTotal - a.skorTotal;
    }
    if (b.totalBenar !== a.totalBenar) {
      return b.totalBenar - a.totalBenar;
    }
    if (a.sisaPersen !== b.sisaPersen) {
      return a.sisaPersen - b.sisaPersen;
    }
    const waktuA = a.jumlahJawab > 0 ? a.rataRataWaktuJawabMs : Number.MAX_SAFE_INTEGER;
    const waktuB = b.jumlahJawab > 0 ? b.rataRataWaktuJawabMs : Number.MAX_SAFE_INTEGER;
    if (waktuA !== waktuB) {
      return waktuA - waktuB;
    }
    const cmpNama = a.nama.localeCompare(b.nama);
    if (cmpNama !== 0) return cmpNama;
    return a.id.localeCompare(b.id);
  });
}
