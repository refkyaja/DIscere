import crypto from 'crypto';
import { z } from 'zod';
import {
  KODE_OPSI_VALID,
  KunciPilihan,
  extractActiveOptions,
  normalizeOptionKey,
} from '../utils/questionOptions.js';

export type { KunciPilihan };

export const POSISI_AWAL_TALI = 0;
export const BATAS_MIN_TALI = -100;
export const BATAS_MAX_TALI = 100;
export const MAKS_GERAK_PER_RONDE = 25;
export const BONUS_STREAK_3 = 5;
export const BONUS_STREAK_5 = 10;
export const BONUS_KOMPAKAN_80 = 5;
export const BONUS_KOMPAKAN_100 = 10;

export const KATA_TERPELESET_TARIK: readonly string[] = [
  'Ups!',
  'Aduh!',
  'Waduh!',
  'Terpeleset!',
] as const;

export type TimTarikTambang = 'merah' | 'putih';
export type KesulitanTarikTambang = 'semua' | 'mudah' | 'sedang' | 'sulit';
export type TipeLawanSoloTarik = 'lokal' | 'bot';
export type KesulitanBotTarik = 'mudah' | 'sedang' | 'sulit';
export type KodePowerUpTarikTambang =
  | 'tarikan_super'
  | 'pertahanan_kuat'
  | 'semangat_tim';

export const BOT_PRESET_TARIK: Record<
  KesulitanBotTarik,
  { akurasi: number; minDelayMs: number; maxDelayMs: number }
> = {
  mudah: { akurasi: 0.5, minDelayMs: 3500, maxDelayMs: 6500 },
  sedang: { akurasi: 0.65, minDelayMs: 2800, maxDelayMs: 5200 },
  sulit: { akurasi: 0.82, minDelayMs: 2200, maxDelayMs: 4200 },
};

export interface OpsiPilihanPresentasi {
  choiceId: string;
  key: KunciPilihan;
  teks: string;
}

export interface SoalBankTarikTambang {
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
  kesulitan: string;
}

export interface PresentasiSoalTarikTambang {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  totalSoalBank: number;
  teks: string;
  kesulitan: string;
  pilihanList: OpsiPilihanPresentasi[];
  correctChoiceId: string;
  jawabanBenarKode: KunciPilihan;
  jawabanBenarTeks: string;
  penjelasan: string | null;
  ditampilkanPadaMs: number;
  waktuPerSoalDetik: number;
}

export interface KonfigurasiTarikTambang {
  sumberSoal: 'bank_soal';
  kesulitan: KesulitanTarikTambang;
  durasiRonde: 15 | 20 | 30;
  durasiLombaDetik: number;
  waktuPerSoalDetik: number;
  tarikBenarSolo: number;
  mundurSalahSolo: number;
  kekuatanTimMulti: number;
  rasioTerpeleset: number;
  tipeLawanSolo: TipeLawanSoloTarik;
  kesulitanBot: KesulitanBotTarik;
  bonusAktif: boolean;
  powerUpAktif: boolean;
  namaTim1: string;
  namaTim2: string;
  maxPeserta: number;
  batasMenang: number;
  allowLateJoin: boolean;
}

export const konfigurasiTarikTambangSchema = z.object({
  sumberSoal: z.literal('bank_soal').default('bank_soal'),
  kesulitan: z.enum(['semua', 'mudah', 'sedang', 'sulit']).default('semua'),
  durasiRonde: z
    .union([z.literal(15), z.literal(20), z.literal(30)])
    .default(20),
  durasiLombaDetik: z.number().int().min(30).max(900).default(180),
  waktuPerSoalDetik: z.number().int().min(5).max(120).default(10),
  tarikBenarSolo: z.number().int().min(1).max(50).default(10),
  mundurSalahSolo: z.number().int().min(0).max(50).default(4),
  kekuatanTimMulti: z.number().int().min(5).max(100).default(40),
  rasioTerpeleset: z.number().min(0).max(1).default(0.4),
  tipeLawanSolo: z.enum(['lokal', 'bot']).default('lokal'),
  kesulitanBot: z.enum(['mudah', 'sedang', 'sulit']).default('sedang'),
  bonusAktif: z.boolean().default(false),
  powerUpAktif: z.boolean().default(false),
  namaTim1: z.string().trim().min(1).max(40).default('Tim Merah'),
  namaTim2: z.string().trim().min(1).max(40).default('Tim Biru'),
  maxPeserta: z.number().int().min(2).max(100).default(36),
  batasMenang: z.number().int().min(10).max(200).default(100),
  allowLateJoin: z.boolean().default(false),
});

export function bangunKonfigurasiTarikTambang(
  raw?: Partial<KonfigurasiTarikTambang>
): KonfigurasiTarikTambang {
  const cleaned: Record<string, unknown> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if (v !== undefined) cleaned[k] = v;
    }
  }
  return konfigurasiTarikTambangSchema.parse(cleaned);
}

export function acakArray<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function ambilKataTerpelesetTarik(): string {
  return KATA_TERPELESET_TARIK[
    crypto.randomInt(0, KATA_TERPELESET_TARIK.length)
  ];
}

export function normalisasiTingkatKesulitanSoal(
  raw?: string | null
): Exclude<KesulitanTarikTambang, 'semua'> {
  const v = (raw || 'sedang').trim().toLowerCase();
  if (v === 'mudah' || v === 'easy') return 'mudah';
  if (v === 'sulit' || v === 'hard') return 'sulit';
  return 'sedang';
}

/**
 * Filter pool soal bank. Untuk 'semua', seluruh soal bank dipakai langsung agar
 * analisis heatmap mencakup seluruh soal. Untuk tingkat tertentu, minimal 2 soal.
 */
export function filterBankSoalSetara(
  questions: SoalBankTarikTambang[],
  kesulitan: KesulitanTarikTambang
): SoalBankTarikTambang[] {
  if (kesulitan === 'semua') {
    if (questions.length < 2) {
      throw new Error(
        'Bank soal tidak mencukupi (minimal butuh 2 soal) untuk memulai Tarik Tambang.'
      );
    }
    return [...questions];
  }
  const matched = questions.filter(
    (q) => normalisasiTingkatKesulitanSoal(q.kesulitan) === kesulitan
  );
  if (matched.length < 2) {
    throw new Error(
      `Bank soal untuk tingkat kesulitan "${kesulitan}" tidak mencukupi (minimal butuh 2 soal, tersedia ${matched.length}).`
    );
  }
  return matched;
}

/**
 * Menyiapkan antrean soal acak per pemain tanpa pengulangan sebelum bank habis,
 * serta menghindari soal awal yang sama persis dengan soal terakhir sebelum reset.
 */
export function siapkanAntreanSoalTarik(
  pool: SoalBankTarikTambang[],
  soalTerakhirId?: string | null
): SoalBankTarikTambang[] {
  const shuffled = acakArray(pool);
  if (
    soalTerakhirId &&
    shuffled.length > 1 &&
    shuffled[0]?.id === soalTerakhirId
  ) {
    const first = shuffled.shift()!;
    shuffled.push(first);
  }
  return shuffled;
}

/** Mengonversi 1 soal menjadi presentasi teracak dengan `choiceId` aman dari kebocoran kunci. */
export function buatPresentasiSoalTarik(
  soal: SoalBankTarikTambang,
  nomorSoal: number,
  totalSoalBank: number,
  waktuPerSoalDetik: number,
  shuffleOptions: boolean = true
): PresentasiSoalTarikTambang {
  const activeOps = extractActiveOptions(soal);
  const allowedKeys = activeOps.map((o) => o.key);
  const trueOrigKey = normalizeOptionKey(soal.jawabanBenar, allowedKeys);
  const orderedOps = shuffleOptions ? acakArray(activeOps) : activeOps;

  let correctChoiceId = '';
  let jawabanBenarKode: KunciPilihan = 'A';
  let jawabanBenarTeks = '';

  const pilihanList: OpsiPilihanPresentasi[] = orderedOps.map((opt, idx) => {
    const displayKey = KODE_OPSI_VALID[idx];
    const choiceId = crypto.randomUUID();
    if (opt.key === trueOrigKey) {
      correctChoiceId = choiceId;
      jawabanBenarKode = displayKey;
      jawabanBenarTeks = opt.teks;
    }
    return {
      choiceId,
      key: displayKey,
      teks: opt.teks,
    };
  });

  if (!correctChoiceId && pilihanList.length > 0) {
    correctChoiceId = pilihanList[0].choiceId;
    jawabanBenarKode = pilihanList[0].key;
    jawabanBenarTeks = pilihanList[0].teks;
  }

  return {
    presentationId: crypto.randomUUID(),
    questionId: soal.id,
    nomorSoal,
    totalSoalBank,
    teks: soal.teks,
    kesulitan: normalisasiTingkatKesulitanSoal(soal.kesulitan),
    pilihanList,
    correctChoiceId,
    jawabanBenarKode,
    jawabanBenarTeks,
    penjelasan: soal.penjelasan ?? null,
    ditampilkanPadaMs: Date.now(),
    waktuPerSoalDetik,
  };
}

/** Helper kompatibilitas untuk mengambil pasangan soal acak dari pool setara. */
export function ambilPasanganSoalSetara(
  pool: SoalBankTarikTambang[],
  sudahTerpakaiIds: string[] = [],
  lastTim1QuestionId?: string,
  lastTim2QuestionId?: string,
  shuffleOptions: boolean = true
): {
  soalTim1: SoalBankTarikTambang;
  soalTim2: SoalBankTarikTambang;
  presTim1: PresentasiSoalTarikTambang;
  presTim2: PresentasiSoalTarikTambang;
  poolReset: boolean;
} {
  if (pool.length < 2) {
    throw new Error('Minimal dibutuhkan 2 soal untuk Tarik Tambang.');
  }
  const used = new Set(sudahTerpakaiIds);
  let avail = pool.filter((q) => !used.has(q.id));
  let poolReset = false;
  if (avail.length < 2) {
    avail = [...pool];
    poolReset = true;
  }
  const candidates1 = avail.filter((q) => q.id !== lastTim1QuestionId);
  const pick1Pool = candidates1.length > 0 ? candidates1 : avail;
  const soalTim1 = pick1Pool[crypto.randomInt(0, pick1Pool.length)];
  const remaining = avail.filter((q) => q.id !== soalTim1.id);
  const candidates2 = remaining.filter((q) => q.id !== lastTim2QuestionId);
  const pick2Pool =
    candidates2.length > 0
      ? candidates2
      : remaining.length > 0
        ? remaining
        : pool.filter((q) => q.id !== soalTim1.id);
  const soalTim2 = pick2Pool[crypto.randomInt(0, pick2Pool.length)];

  return {
    soalTim1,
    soalTim2,
    presTim1: buatPresentasiSoalTarik(soalTim1, 1, pool.length, 15, shuffleOptions),
    presTim2: buatPresentasiSoalTarik(soalTim2, 1, pool.length, 15, shuffleOptions),
    poolReset,
  };
}

export function serialisasiSoalUntukClient(pres: PresentasiSoalTarikTambang) {
  const byKey = new Map<KunciPilihan, string>();
  for (const ch of pres.pilihanList) {
    byKey.set(ch.key, ch.teks);
  }
  return {
    presentationId: pres.presentationId,
    id: pres.questionId,
    questionId: pres.questionId,
    nomorSoal: pres.nomorSoal,
    totalSoal: pres.totalSoalBank,
    totalSoalBank: pres.totalSoalBank,
    teks: pres.teks,
    kesulitan: pres.kesulitan,
    opsiA: byKey.get('A') || '',
    opsiB: byKey.get('B') || '',
    opsiC: byKey.get('C') ?? null,
    opsiD: byKey.get('D') ?? null,
    opsiE: byKey.get('E') ?? null,
    pilihan: pres.pilihanList.map((c) => ({
      choiceId: c.choiceId,
      label: c.key,
      key: c.key,
      teks: c.teks,
    })),
    ditampilkanPadaMs: pres.ditampilkanPadaMs,
    waktuPerSoalDetik: pres.waktuPerSoalDetik,
  };
}

export function validasiJawabanTarikTambang(
  pres: PresentasiSoalTarikTambang,
  input: { choiceId?: string; jawabanDipilih?: string; timedOut?: boolean }
): {
  benar: boolean;
  timedOut: boolean;
  choiceDipilih: OpsiPilihanPresentasi | null;
  kodeDipilih: string | null;
  teksDipilih: string | null;
} {
  if (input.timedOut) {
    return {
      benar: false,
      timedOut: true,
      choiceDipilih: null,
      kodeDipilih: null,
      teksDipilih: null,
    };
  }

  let matched: OpsiPilihanPresentasi | undefined;
  const rawChoiceId =
    typeof input.choiceId === 'string' ? input.choiceId.trim() : '';
  if (rawChoiceId) {
    matched = pres.pilihanList.find((c) => c.choiceId === rawChoiceId);
  }

  if (!matched && typeof input.jawabanDipilih === 'string') {
    const cleaned = input.jawabanDipilih.trim();
    const upper = cleaned.toUpperCase();
    matched =
      pres.pilihanList.find((c) => c.key === upper) ||
      pres.pilihanList.find(
        (c) => c.teks.trim().toLowerCase() === cleaned.toLowerCase()
      );
  }

  if (!matched) {
    throw new Error('Pilihan jawaban tidak valid untuk soal ini.');
  }

  return {
    benar: matched.choiceId === pres.correctChoiceId,
    timedOut: false,
    choiceDipilih: matched,
    kodeDipilih: matched.key,
    teksDipilih: matched.teks,
  };
}

export function perbaruiStreakIndividu(params: {
  streakSaatIni: number;
  streakTertinggi: number;
  milestone3SudahDapat: boolean;
  milestone5SudahDapat: boolean;
  benar: boolean;
  bonusAktif: boolean;
}): {
  streakBaru: number;
  streakTertinggiBaru: number;
  bonusDidapat: number;
  milestone3SudahDapat: boolean;
  milestone5SudahDapat: boolean;
} {
  if (!params.benar) {
    return {
      streakBaru: 0,
      streakTertinggiBaru: params.streakTertinggi,
      bonusDidapat: 0,
      milestone3SudahDapat: false,
      milestone5SudahDapat: false,
    };
  }

  const streakBaru = params.streakSaatIni + 1;
  const streakTertinggiBaru = Math.max(params.streakTertinggi, streakBaru);

  let bonusDidapat = 0;
  let milestone3SudahDapat = params.milestone3SudahDapat;
  let milestone5SudahDapat = params.milestone5SudahDapat;

  if (params.bonusAktif) {
    if (streakBaru >= 3 && !milestone3SudahDapat) {
      bonusDidapat += BONUS_STREAK_3;
      milestone3SudahDapat = true;
    }
    if (streakBaru >= 5 && !milestone5SudahDapat) {
      bonusDidapat += BONUS_STREAK_5;
      milestone5SudahDapat = true;
    }
  }

  return {
    streakBaru,
    streakTertinggiBaru,
    bonusDidapat,
    milestone3SudahDapat,
    milestone5SudahDapat,
  };
}

export function hitungBonusKekompakan(
  jumlahBenar: number,
  totalAnggota: number,
  bonusAktif: boolean
): number {
  if (!bonusAktif || totalAnggota <= 0) return 0;
  const akurasi = (jumlahBenar / totalAnggota) * 100;
  if (akurasi >= 100) return BONUS_KOMPAKAN_100;
  if (akurasi >= 80) return BONUS_KOMPAKAN_80;
  return 0;
}

export function tentukanHadiahPowerUp(params: {
  powerUpAktif: boolean;
  bankSaatIni: KodePowerUpTarikTambang | null;
  streakBaru: number;
  akurasiRondePersen: number;
}): KodePowerUpTarikTambang | null {
  if (!params.powerUpAktif || params.bankSaatIni !== null) {
    return params.bankSaatIni;
  }
  if (params.streakBaru >= 5) return 'tarikan_super';
  if (params.akurasiRondePersen >= 100) return 'semangat_tim';
  if (params.streakBaru >= 3) return 'pertahanan_kuat';
  return null;
}

/** Evaluasi delta tali pada Solo Duel Kontinu (HTML: +10 benar, -4 salah * arah tim). */
export function evaluasiTarikanSolo(params: {
  posisiLama: number;
  tim: TimTarikTambang;
  benar: boolean;
  config: KonfigurasiTarikTambang;
  bonusStreak?: number;
  powerUpAktif?: KodePowerUpTarikTambang | null;
  powerUpLawan?: KodePowerUpTarikTambang | null;
}): {
  deltaTali: number;
  posisiBaru: number;
} {
  const dir = params.tim === 'merah' ? 1 : -1;
  const batas = Math.max(10, params.config.batasMenang || BATAS_MAX_TALI);
  let besaran = 0;

  if (params.benar) {
    besaran = params.config.tarikBenarSolo + (params.bonusStreak || 0);
    if (params.powerUpAktif === 'tarikan_super') besaran += 10;
    else if (params.powerUpAktif === 'semangat_tim') besaran += 5;
    if (params.powerUpLawan === 'pertahanan_kuat') {
      besaran = Math.max(1, besaran - 5);
    }
  } else {
    besaran = -params.config.mundurSalahSolo;
  }

  const rawDelta = Math.round(dir * besaran * 10) / 10;
  const posisiBaru = Math.max(
    -batas,
    Math.min(batas, Math.round((params.posisiLama + rawDelta) * 10) / 10)
  );
  return {
    deltaTali: Math.round((posisiBaru - params.posisiLama) * 10) / 10,
    posisiBaru,
  };
}

/**
 * Evaluasi delta tali pada Multiplayer Kontinu (HTML: k = 40 / sz(t), benar = +d*k,
 * salah/waktu habis = -d*k*0.4).
 */
export function evaluasiTarikanMulti(params: {
  posisiLama: number;
  tim: TimTarikTambang;
  jumlahAnggotaTim: number;
  benar: boolean;
  config: KonfigurasiTarikTambang;
  bonusStreak?: number;
  powerUpAktif?: KodePowerUpTarikTambang | null;
  powerUpLawan?: KodePowerUpTarikTambang | null;
}): {
  deltaTali: number;
  posisiBaru: number;
  kekuatanSatuan: number;
} {
  const dir = params.tim === 'merah' ? 1 : -1;
  const sz = Math.max(1, params.jumlahAnggotaTim);
  const batas = Math.max(10, params.config.batasMenang || BATAS_MAX_TALI);
  const k = params.config.kekuatanTimMulti / sz;

  let besaran = 0;
  if (params.benar) {
    besaran = k + (params.bonusStreak ? params.bonusStreak / Math.max(1, sz * 0.5) : 0);
    if (params.powerUpAktif === 'tarikan_super') besaran += Math.max(4, k * 0.5);
    else if (params.powerUpAktif === 'semangat_tim') besaran += Math.max(2, k * 0.25);
    if (params.powerUpLawan === 'pertahanan_kuat') {
      besaran = Math.max(0.5, besaran * 0.7);
    }
  } else {
    besaran = -(k * params.config.rasioTerpeleset);
  }

  const rawDelta = dir * besaran;
  const posisiBaru = Math.max(
    -batas,
    Math.min(batas, Math.round((params.posisiLama + rawDelta) * 10) / 10)
  );

  return {
    deltaTali: Math.round((posisiBaru - params.posisiLama) * 10) / 10,
    posisiBaru,
    kekuatanSatuan: Math.round(k * 10) / 10,
  };
}

/** Rumus ronde lama tetap diekspor untuk kompatibilitas modul uji. */
export function evaluasiRondeTarikTambang(params: {
  mode: 'SOLO' | 'MULTI';
  posisiLama: number;
  tim1Benar: number;
  tim1TotalAnggota: number;
  tim2Benar: number;
  tim2TotalAnggota: number;
  bonusStreakTim1: number;
  bonusStreakTim2: number;
  bonusAktif: boolean;
  powerUpTim1Aktif: KodePowerUpTarikTambang | null;
  powerUpTim2Aktif: KodePowerUpTarikTambang | null;
  batasMenang?: number;
}) {
  const {
    mode,
    posisiLama,
    tim1Benar,
    tim1TotalAnggota,
    tim2Benar,
    tim2TotalAnggota,
    bonusStreakTim1,
    bonusStreakTim2,
    bonusAktif,
    powerUpTim1Aktif,
    powerUpTim2Aktif,
    batasMenang = BATAS_MAX_TALI,
  } = params;

  const baseTim1 =
    mode === 'SOLO'
      ? tim1Benar > 0
        ? 15
        : 0
      : Math.round((tim1Benar / Math.max(1, tim1TotalAnggota)) * 15);
  const baseTim2 =
    mode === 'SOLO'
      ? tim2Benar > 0
        ? 15
        : 0
      : Math.round((tim2Benar / Math.max(1, tim2TotalAnggota)) * 15);

  const bonusKompakTim1 =
    mode === 'MULTI'
      ? hitungBonusKekompakan(tim1Benar, tim1TotalAnggota, bonusAktif)
      : 0;
  const bonusKompakTim2 =
    mode === 'MULTI'
      ? hitungBonusKekompakan(tim2Benar, tim2TotalAnggota, bonusAktif)
      : 0;

  let puBoostTim1 = 0;
  if (powerUpTim1Aktif === 'tarikan_super') puBoostTim1 += 10;
  else if (powerUpTim1Aktif === 'semangat_tim') puBoostTim1 += 5;

  let puBoostTim2 = 0;
  if (powerUpTim2Aktif === 'tarikan_super') puBoostTim2 += 10;
  else if (powerUpTim2Aktif === 'semangat_tim') puBoostTim2 += 5;

  let kekuatanTim1 =
    baseTim1 + (bonusAktif ? bonusStreakTim1 : 0) + bonusKompakTim1 + puBoostTim1;
  let kekuatanTim2 =
    baseTim2 + (bonusAktif ? bonusStreakTim2 : 0) + bonusKompakTim2 + puBoostTim2;

  if (powerUpTim2Aktif === 'pertahanan_kuat' && kekuatanTim1 > 0) {
    kekuatanTim1 = Math.max(0, kekuatanTim1 - 5);
  }
  if (powerUpTim1Aktif === 'pertahanan_kuat' && kekuatanTim2 > 0) {
    kekuatanTim2 = Math.max(0, kekuatanTim2 - 5);
  }

  const selisihKasar = kekuatanTim1 - kekuatanTim2;
  const perubahanTali = Math.max(
    -MAKS_GERAK_PER_RONDE,
    Math.min(MAKS_GERAK_PER_RONDE, selisihKasar)
  );
  const batasEfektif = Math.max(10, Math.min(200, Math.round(batasMenang)));
  const posisiBaru = Math.max(
    -batasEfektif,
    Math.min(batasEfektif, posisiLama + perubahanTali)
  );

  return {
    kekuatanTim1,
    kekuatanTim2,
    perubahanTali,
    posisiBaru,
  };
}

export function cekKondisiSelesai(
  posisi: number,
  batasMenang: number = BATAS_MAX_TALI
): boolean {
  const batas = Math.max(10, Math.round(batasMenang));
  return Math.abs(posisi) >= batas;
}

export function tentukanPemenang(posisi: number): TimTarikTambang | 'seri' {
  if (posisi > 0) return 'merah';
  if (posisi < 0) return 'putih';
  return 'seri';
}

/* ============================================================================
 * Pembangun Heatmap Analisis Per-Soal x Per-Siswa (Format Kompatibel UI)
 * ============================================================================ */

export interface RiwayatJawabanSiswaTarik {
  questionId: string;
  benar: boolean;
  timedOut: boolean;
  jawabanKey: string | null;
  jawabanTeks: string | null;
}

export interface AnalisisHeatmapTarik {
  questions: Array<{
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
  }>;
  teams: Array<{
    timId: string;
    namaTim: string;
    warna: string;
    rows: Array<{
      pesertaId: string;
      nama: string;
      benarPertamaCount: number;
      dilihatCount: number;
      cells: Array<{
        questionId: string;
        ok: boolean | null;
        jawabanKey: string | null;
        jawabanTeks: string | null;
        timedOut: boolean;
        percobaanCount: number;
      }>;
    }>;
  }>;
  hardestQuestionId: string | null;
  defaultQuestionId: string | null;
}

export function bangunAnalisisHeatmapTarik(
  questions: SoalBankTarikTambang[],
  teamsMeta: Array<{ id: TimTarikTambang; nama: string; warna: string }>,
  students: Array<{
    id: string;
    nama: string;
    tim: TimTarikTambang | null;
    riwayatJawaban: RiwayatJawabanSiswaTarik[];
  }>
): AnalisisHeatmapTarik {
  const sortedQuestions = [...questions].sort((a, b) => a.urutan - b.urutan);
  const firstAttemptByStudent = new Map<
    string,
    Map<string, RiwayatJawabanSiswaTarik & { count: number }>
  >();

  for (const st of students) {
    const qMap = new Map<string, RiwayatJawabanSiswaTarik & { count: number }>();
    for (const log of st.riwayatJawaban) {
      const prev = qMap.get(log.questionId);
      if (!prev) {
        qMap.set(log.questionId, { ...log, count: 1 });
      } else {
        prev.count += 1;
      }
    }
    firstAttemptByStudent.set(st.id, qMap);
  }

  let hardestQuestionId: string | null = null;
  let hardestPct = 2;

  const qInfos = sortedQuestions.map((q, idx) => {
    const opsiList = extractActiveOptions(q);
    const allowed = opsiList.map((o) => o.key);
    const trueKey = normalizeOptionKey(q.jawabanBenar, allowed);
    const trueOpt = opsiList.find((o) => o.key === trueKey) || opsiList[0];

    let seen = 0;
    let correct = 0;
    for (const st of students) {
      const attempt = firstAttemptByStudent.get(st.id)?.get(q.id);
      if (attempt) {
        seen += 1;
        if (attempt.benar) correct += 1;
      }
    }
    const pct = seen > 0 ? Math.round((correct / seen) * 100) : null;
    if (seen > 0 && correct / seen < hardestPct) {
      hardestPct = correct / seen;
      hardestQuestionId = q.id;
    }

    return {
      questionId: q.id,
      nomorSoal: idx + 1,
      teks: q.teks,
      opsiList,
      jawabanBenarKode: trueKey,
      jawabanBenarTeks: trueOpt?.teks || '',
      penjelasan: q.penjelasan ?? null,
      firstCorrectCount: correct,
      firstSeenCount: seen,
      persenBenar: pct,
    };
  });

  const teams = teamsMeta.map((tm) => {
    const members = students.filter((s) => s.tim === tm.id);
    const rows = members.map((st) => {
      const qMap = firstAttemptByStudent.get(st.id) || new Map();
      let benarPertamaCount = 0;
      let dilihatCount = 0;
      const cells = sortedQuestions.map((q) => {
        const attempt = qMap.get(q.id);
        if (!attempt) {
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
        if (attempt.benar) benarPertamaCount += 1;
        return {
          questionId: q.id,
          ok: attempt.benar,
          jawabanKey: attempt.jawabanKey,
          jawabanTeks: attempt.jawabanTeks,
          timedOut: attempt.timedOut,
          percobaanCount: attempt.count,
        };
      });

      return {
        pesertaId: st.id,
        nama: st.nama,
        benarPertamaCount,
        dilihatCount,
        cells,
      };
    });

    return {
      timId: tm.id,
      namaTim: tm.nama,
      warna: tm.warna,
      rows,
    };
  });

  return {
    questions: qInfos,
    teams,
    hardestQuestionId: hardestPct < 1 ? hardestQuestionId : null,
    defaultQuestionId: hardestQuestionId || qInfos[0]?.questionId || null,
  };
}
