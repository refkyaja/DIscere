import crypto from 'crypto';
import { z } from 'zod';

/**
 * Logika inti (Single Source of Truth) permainan Tarik Tambang Challenge Discere.
 * Mendukung mode SOLO (Local 1 vs 1) dan MULTIPLAYER (Team Multiplayer)
 * dengan konsistensi aturan posisi [-100..+100], akurasi, bonus streak,
 * bonus kekompakan, power-up terkendali backend, dan pasangan soal setara.
 */

export type TimTarikTambang = 'merah' | 'putih';
export type HasilPemenang = 'merah' | 'putih' | 'seri';
export type PlayModeTarikTambang = 'SOLO' | 'MULTIPLAYER';
export type KesulitanSoalTarik = 'mudah' | 'sedang' | 'sulit';
export type JenisPowerUpTarik = 'semangat_tim' | 'pertahanan_kuat' | 'tarikan_super';

export const POSISI_AWAL_TALI = 0;
export const BATAS_MIN_TALI = -100; // Kemenangan Tim 2 (Biru / Kanan)
export const BATAS_MAX_TALI = 100; // Kemenangan Tim 1 (Merah / Kiri)
export const MAKS_GERAK_PER_RONDE = 25;
export const KONTRIBUSI_DASAR_SOLO = 15;

export const LABEL_KESULITAN_TARIK: Record<KesulitanSoalTarik, string> = {
  mudah: 'Mudah',
  sedang: 'Sedang',
  sulit: 'Sulit',
};

export const INFO_POWERUP_TARIK: Record<
  JenisPowerUpTarik,
  { nama: string; deskripsi: string; nilai: number }
> = {
  semangat_tim: {
    nama: 'Semangat Tim',
    deskripsi: 'Bonus tarikan +5 poin pada ronde berikutnya.',
    nilai: 5,
  },
  pertahanan_kuat: {
    nama: 'Pertahanan Kuat',
    deskripsi: 'Mengurangi tarikan lawan sebesar 5 poin pada ronde berikutnya.',
    nilai: 5,
  },
  tarikan_super: {
    nama: 'Tarikan Super',
    deskripsi: 'Bonus tarikan +10 poin pada ronde berikutnya.',
    nilai: 10,
  },
};

export const konfigurasiTarikTambangSchema = z.object({
  sumberSoal: z.enum(['bank_soal', 'manual', 'ai']).default('bank_soal'),
  kesulitan: z.enum(['mudah', 'sedang', 'sulit']).default('sedang'),
  durasiRonde: z.union([z.literal(15), z.literal(20), z.literal(30)]).default(20),
  bonusAktif: z.boolean().default(true),
  powerUpAktif: z.boolean().default(true),
  namaTim1: z
    .string()
    .trim()
    .min(2, 'Nama Tim 1 minimal 2 karakter.')
    .max(32, 'Nama Tim 1 maksimal 32 karakter.')
    .default('Tim Merah'),
  namaTim2: z
    .string()
    .trim()
    .min(2, 'Nama Tim 2 minimal 2 karakter.')
    .max(32, 'Nama Tim 2 maksimal 32 karakter.')
    .default('Tim Biru'),
  maxPeserta: z.number().int().min(2).max(200).default(60),
});

export interface KonfigurasiTarikTambang {
  sumberSoal: 'bank_soal' | 'manual' | 'ai';
  kesulitan: KesulitanSoalTarik;
  durasiRonde: 15 | 20 | 30;
  bonusAktif: boolean;
  powerUpAktif: boolean;
  namaTim1: string;
  namaTim2: string;
  maxPeserta: number;
}

export function bangunKonfigurasiTarikTambang(
  rawInput?: Partial<KonfigurasiTarikTambang>
): KonfigurasiTarikTambang {
  const parsed = konfigurasiTarikTambangSchema.parse(rawInput || {});
  return {
    sumberSoal: parsed.sumberSoal,
    kesulitan: parsed.kesulitan,
    durasiRonde: parsed.durasiRonde,
    bonusAktif: parsed.bonusAktif,
    powerUpAktif: parsed.powerUpAktif,
    namaTim1: parsed.namaTim1,
    namaTim2: parsed.namaTim2,
    maxPeserta: parsed.maxPeserta,
  };
}

/**
 * Menormalkan kode tim dari frontend/API ke kunci kanonis 'merah' (Tim 1) | 'putih' (Tim 2)
 */
export function normalisasiKodeTim(raw?: string | null): TimTarikTambang | null {
  const clean = (raw || '').trim().toLowerCase();
  if (clean === 'merah' || clean === 'tim1' || clean === '1') return 'merah';
  if (clean === 'putih' || clean === 'biru' || clean === 'tim2' || clean === '2') return 'putih';
  return null;
}

export interface SoalBankTarikTambang {
  id: string;
  urutan: number;
  teks: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  jawabanBenar: string;
  penjelasan: string | null;
  kesulitan?: string | null;
}

export interface PilihanSoalTarikPublic {
  choiceId: string;
  label: 'A' | 'B' | 'C';
  teks: string;
}

export interface PresentasiSoalTarik {
  presentationId: string;
  questionId: string;
  kesulitan: KesulitanSoalTarik;
  teks: string;
  pilihanList: Array<{
    choiceId: string;
    originalKey: 'A' | 'B' | 'C';
    label: 'A' | 'B' | 'C';
    teks: string;
  }>;
  correctChoiceId: string;
  jawabanBenarKode: 'A' | 'B' | 'C';
  jawabanBenarTeks: string;
  penjelasan: string | null;
}

export interface AntreanSoalSetaraResult {
  soalTim1: SoalBankTarikTambang;
  soalTim2: SoalBankTarikTambang;
  antreanSisa: SoalBankTarikTambang[];
}

export function validasiStrukturSoal(q: SoalBankTarikTambang): boolean {
  const teks = (q.teks || '').trim();
  const a = (q.opsiA || '').trim();
  const b = (q.opsiB || '').trim();
  const c = (q.opsiC || '').trim();
  const kunci = (q.jawabanBenar || '').trim().toUpperCase();
  return Boolean(
    teks.length > 0 &&
      a.length > 0 &&
      b.length > 0 &&
      c.length > 0 &&
      (kunci === 'A' || kunci === 'B' || kunci === 'C')
  );
}

/**
 * Memfilter bank soal agar hanya memakai soal valid berkesulitan setara.
 * Melempar error jelas jika tidak ada minimal 2 soal setara untuk Tim 1 dan Tim 2.
 */
export function filterBankSoalSetara(
  semuaSoal: SoalBankTarikTambang[],
  kesulitanTarget: KesulitanSoalTarik
): SoalBankTarikTambang[] {
  const validSoal = semuaSoal.filter(validasiStrukturSoal);
  if (validSoal.length < 2) {
    throw new Error(
      'Bank soal minimal harus memiliki 2 soal valid berbeda agar Tim 1 dan Tim 2 mendapat soal berbeda tiap ronde.'
    );
  }

  const cocok = validSoal.filter(
    (q) => ((q.kesulitan || 'sedang').toLowerCase() as KesulitanSoalTarik) === kesulitanTarget
  );

  if (cocok.length < 2) {
    throw new Error(
      `Bank soal hanya memiliki ${cocok.length} soal tingkat kesulitan "${LABEL_KESULITAN_TARIK[kesulitanTarget]}". Minimal dibutuhkan 2 soal dengan tingkat kesulitan setara untuk membuat pasangan soal Tim 1 dan Tim 2.`
    );
  }

  return cocok;
}

export function acakArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Mengambil pasangan soal berbeda dengan tingkat kesulitan setara untuk Tim 1 & Tim 2.
 * Menghindari soal yang sama persis muncul berturut-turut di tim yang sama bila tersedia.
 */
export function ambilPasanganSoalSetara(
  poolSetara: SoalBankTarikTambang[],
  antreanSaatIni: SoalBankTarikTambang[],
  terakhirTim1Id?: string,
  terakhirTim2Id?: string,
  acak: boolean = true
): AntreanSoalSetaraResult {
  if (poolSetara.length < 2) {
    throw new Error('Minimal dibutuhkan 2 soal dengan tingkat kesulitan setara.');
  }

  let antrean = [...antreanSaatIni];
  if (antrean.length < 2) {
    antrean = acak ? acakArray(poolSetara) : [...poolSetara];
  }

  // Pilih soal Tim 1 (hindari pengulangan berturut-turut jika ada pilihan lain)
  let idx1 = 0;
  if (terakhirTim1Id && antrean.length >= 2) {
    const altIdx = antrean.findIndex((q) => q.id !== terakhirTim1Id);
    if (altIdx !== -1 && (antrean[0].id === terakhirTim1Id || acak)) {
      if (antrean[0].id === terakhirTim1Id) idx1 = altIdx;
    }
  }
  const soalTim1 = antrean.splice(idx1, 1)[0];

  if (antrean.length === 0) {
    const poolLain = poolSetara.filter((q) => q.id !== soalTim1.id);
    antrean = acak ? acakArray(poolLain) : [...poolLain];
  }

  // Pilih soal Tim 2 yang pasti berbeda dari soalTim1 dan usahakan tidak ulang terakhirTim2Id
  let idx2 = antrean.findIndex(
    (q) => q.id !== soalTim1.id && (!terakhirTim2Id || q.id !== terakhirTim2Id)
  );
  if (idx2 === -1) {
    idx2 = antrean.findIndex((q) => q.id !== soalTim1.id);
  }

  let soalTim2: SoalBankTarikTambang;
  if (idx2 !== -1) {
    soalTim2 = antrean.splice(idx2, 1)[0];
  } else {
    const kandidat = poolSetara.filter((q) => q.id !== soalTim1.id);
    soalTim2 = (acak ? acakArray(kandidat) : kandidat)[0];
  }

  return {
    soalTim1,
    soalTim2,
    antreanSisa: antrean,
  };
}

/**
 * Membuat presentasi soal aman untuk 1 tim dalam satu ronde dengan choiceId unik
 */
export function buatPresentasiSoalTarik(
  soal: SoalBankTarikTambang,
  kesulitanDefault: KesulitanSoalTarik = 'sedang',
  acakPilihan: boolean = false
): PresentasiSoalTarik {
  const keys: Array<'A' | 'B' | 'C'> = acakPilihan ? acakArray(['A', 'B', 'C']) : ['A', 'B', 'C'];
  const teksMap: Record<'A' | 'B' | 'C', string> = {
    A: soal.opsiA,
    B: soal.opsiB,
    C: soal.opsiC,
  };
  const labelDisplay: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
  const kunciKode = ((soal.jawabanBenar || 'A').trim().toUpperCase() as 'A' | 'B' | 'C');

  const pilihanList = keys.map((origKey, idx) => ({
    choiceId: `tt_${crypto.randomUUID().slice(0, 12)}`,
    originalKey: origKey,
    label: labelDisplay[idx],
    teks: teksMap[origKey],
  }));

  const benarEntry = pilihanList.find((p) => p.originalKey === kunciKode) || pilihanList[0];

  return {
    presentationId: `pres_tt_${crypto.randomUUID().slice(0, 12)}`,
    questionId: soal.id,
    kesulitan: ((soal.kesulitan || kesulitanDefault).toLowerCase() as KesulitanSoalTarik),
    teks: soal.teks,
    pilihanList,
    correctChoiceId: benarEntry.choiceId,
    jawabanBenarKode: benarEntry.label,
    jawabanBenarTeks: benarEntry.teks,
    penjelasan: soal.penjelasan || null,
  };
}

export function serialisasiSoalUntukClient(
  pres: PresentasiSoalTarik,
  nomorRonde: number,
  endsAt?: number,
  durasiDetik?: number
) {
  return {
    presentationId: pres.presentationId,
    id: pres.questionId,
    questionId: pres.questionId,
    nomorSoal: nomorRonde,
    nomorRonde,
    kesulitan: pres.kesulitan,
    teks: pres.teks,
    opsiA: pres.pilihanList[0]?.teks || '',
    opsiB: pres.pilihanList[1]?.teks || '',
    opsiC: pres.pilihanList[2]?.teks || '',
    pilihan: pres.pilihanList.map((p) => ({
      choiceId: p.choiceId,
      label: p.label,
      teks: p.teks,
    })),
    endsAt,
    duration: durasiDetik,
  };
}

/**
 * Memvalidasi jawaban masuk berdasarkan choiceId atau fallback teks/A/B/C
 */
export function validasiJawabanPresentasi(
  pres: PresentasiSoalTarik,
  input: { choiceId?: string; jawaban?: string }
): {
  benar: boolean;
  kodeDipilih: string;
} {
  if (input.choiceId) {
    const picked = pres.pilihanList.find((p) => p.choiceId === input.choiceId);
    if (!picked) {
      throw new Error('Pilihan jawaban tidak ditemukan pada soal aktif.');
    }
    return {
      benar: picked.choiceId === pres.correctChoiceId,
      kodeDipilih: picked.label,
    };
  }

  const raw = (input.jawaban || '').trim().toUpperCase();
  if (!raw) {
    throw new Error('Jawaban wajib dipilih.');
  }

  const byLabel = pres.pilihanList.find(
    (p) => p.label === raw || p.teks.trim().toUpperCase() === raw
  );
  if (byLabel) {
    return {
      benar: byLabel.choiceId === pres.correctChoiceId,
      kodeDipilih: byLabel.label,
    };
  }

  return {
    benar: raw === pres.jawabanBenarKode,
    kodeDipilih: raw,
  };
}

export function clampTali(nilai: number, min: number = BATAS_MIN_TALI, max: number = BATAS_MAX_TALI): number {
  return Math.max(min, Math.min(max, nilai));
}

export function hitungAkurasiTim(jumlahBenar: number, jumlahAnggotaAwalRonde: number): number {
  if (jumlahAnggotaAwalRonde <= 0) return 0;
  return Number(((jumlahBenar / jumlahAnggotaAwalRonde) * 100).toFixed(2));
}

/**
 * Bonus kekompakan tim (khusus Multiplayer):
 * - 100% menjawab benar -> +10 (tertinggi saja)
 * - >= 80% menjawab benar -> +5
 */
export function hitungBonusKekompakan(
  jumlahBenar: number,
  jumlahAnggotaAwalRonde: number,
  bonusAktif: boolean
): number {
  if (!bonusAktif || jumlahAnggotaAwalRonde <= 0) return 0;
  const rasio = jumlahBenar / jumlahAnggotaAwalRonde;
  if (rasio >= 1) return 10;
  if (rasio >= 0.8) return 5;
  return 0;
}

/**
 * Pembaruan streak individu & perhitungan milestone bonus streak (+5 di streak 3, +10 di streak 5).
 * Bonus milestone tidak diberikan berulang kali dalam streak yang sama.
 */
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
  milestone3SudahDapat: boolean;
  milestone5SudahDapat: boolean;
  bonusDidapat: number;
} {
  if (!params.benar) {
    return {
      streakBaru: 0,
      streakTertinggiBaru: params.streakTertinggi,
      milestone3SudahDapat: false,
      milestone5SudahDapat: false,
      bonusDidapat: 0,
    };
  }

  const streakBaru = params.streakSaatIni + 1;
  const streakTertinggiBaru = Math.max(params.streakTertinggi, streakBaru);
  let milestone3Sudah = params.milestone3SudahDapat;
  let milestone5Sudah = params.milestone5SudahDapat;
  let bonusDidapat = 0;

  if (params.bonusAktif) {
    if (streakBaru >= 5 && !milestone5Sudah) {
      bonusDidapat = 10;
      milestone5Sudah = true;
      milestone3Sudah = true;
    } else if (streakBaru >= 3 && !milestone3Sudah) {
      bonusDidapat = 5;
      milestone3Sudah = true;
    }
  }

  return {
    streakBaru,
    streakTertinggiBaru,
    milestone3SudahDapat: milestone3Sudah,
    milestone5SudahDapat: milestone5Sudah,
    bonusDidapat,
  };
}

/**
 * Menentukan pemberian Power-Up ke bank tim secara adil (maksimal 1 tersimpan, tidak ditumpuk).
 */
export function tentukanHadiahPowerUp(params: {
  powerUpAktif: boolean;
  bankSaatIni: JenisPowerUpTarik | null;
  streakBaru: number;
  akurasiRondePersen: number;
}): JenisPowerUpTarik | null {
  if (!params.powerUpAktif || params.bankSaatIni !== null) {
    return params.bankSaatIni;
  }

  if (params.streakBaru >= 5 || params.akurasiRondePersen >= 100) {
    return 'tarikan_super';
  }
  if (params.streakBaru === 3 || params.akurasiRondePersen >= 80) {
    const opsi: JenisPowerUpTarik[] = ['semangat_tim', 'pertahanan_kuat'];
    return opsi[crypto.randomInt(0, opsi.length)];
  }
  return null;
}

export interface EvaluasiRondeInput {
  mode: PlayModeTarikTambang;
  posisiLama: number;
  tim1Benar: number;
  tim1TotalAnggota: number;
  tim2Benar: number;
  tim2TotalAnggota: number;
  bonusStreakTim1: number;
  bonusStreakTim2: number;
  bonusAktif: boolean;
  powerUpTim1Aktif: JenisPowerUpTarik | null;
  powerUpTim2Aktif: JenisPowerUpTarik | null;
}

export interface EvaluasiRondeOutput {
  akurasiTim1: number;
  akurasiTim2: number;
  selisihKekuatan: number;
  bonusStreakNet: number;
  bonusKekompakanTim1: number;
  bonusKekompakanTim2: number;
  bonusKekompakanNet: number;
  bonusPowerUpTim1: number;
  bonusPowerUpTim2: number;
  pertahananTim1Aktif: boolean;
  pertahananTim2Aktif: boolean;
  bonusPowerUpNet: number;
  perubahanTali: number;
  posisiBaru: number;
}

/**
 * Mengevaluasi hasil satu ronde secara konsisten untuk Solo & Multiplayer:
 * T = clamp(Selisih Kekuatan + Bonus Streak + Bonus Kekompakan + Bonus Power-up, -25, 25)
 * Posisi Baru = clamp(Posisi Lama + T, -100, 100)
 */
export function evaluasiRondeTarikTambang(input: EvaluasiRondeInput): EvaluasiRondeOutput {
  const akurasiTim1 = hitungAkurasiTim(input.tim1Benar, input.tim1TotalAnggota);
  const akurasiTim2 = hitungAkurasiTim(input.tim2Benar, input.tim2TotalAnggota);

  let selisihKekuatan = 0;
  if (input.mode === 'SOLO') {
    const k1 = input.tim1Benar > 0 ? KONTRIBUSI_DASAR_SOLO : 0;
    const k2 = input.tim2Benar > 0 ? KONTRIBUSI_DASAR_SOLO : 0;
    selisihKekuatan = k1 - k2;
  } else {
    selisihKekuatan = Number((akurasiTim1 - akurasiTim2).toFixed(2));
  }

  const bonusKekompakanTim1 =
    input.mode === 'MULTIPLAYER'
      ? hitungBonusKekompakan(input.tim1Benar, input.tim1TotalAnggota, input.bonusAktif)
      : 0;
  const bonusKekompakanTim2 =
    input.mode === 'MULTIPLAYER'
      ? hitungBonusKekompakan(input.tim2Benar, input.tim2TotalAnggota, input.bonusAktif)
      : 0;

  const bonusStreakNet = input.bonusStreakTim1 - input.bonusStreakTim2;
  const bonusKekompakanNet = bonusKekompakanTim1 - bonusKekompakanTim2;

  const bonusPowerUpTim1 =
    input.powerUpTim1Aktif === 'tarikan_super'
      ? 10
      : input.powerUpTim1Aktif === 'semangat_tim'
      ? 5
      : 0;
  const bonusPowerUpTim2 =
    input.powerUpTim2Aktif === 'tarikan_super'
      ? 10
      : input.powerUpTim2Aktif === 'semangat_tim'
      ? 5
      : 0;

  const pertahananTim1 = input.powerUpTim1Aktif === 'pertahanan_kuat';
  const pertahananTim2 = input.powerUpTim2Aktif === 'pertahanan_kuat';

  let rawT = selisihKekuatan + bonusStreakNet + bonusKekompakanNet + (bonusPowerUpTim1 - bonusPowerUpTim2);

  // Pertahanan Kuat mengurangi tarikan lawan sebesar 5 poin bila tali sedang tertarik ke arah lawan
  let reduksiPertahananTim1 = 0;
  let reduksiPertahananTim2 = 0;
  if (pertahananTim1 && rawT < 0) {
    const setelah = Math.min(0, rawT + 5);
    reduksiPertahananTim1 = setelah - rawT; // bernilai positif (+ up to 5) mengimbangi tarikan lawan
    rawT = setelah;
  }
  if (pertahananTim2 && rawT > 0) {
    const setelah = Math.max(0, rawT - 5);
    reduksiPertahananTim2 = rawT - setelah;
    rawT = setelah;
  }

  const perubahanTali = clampTali(Math.round(rawT), -MAKS_GERAK_PER_RONDE, MAKS_GERAK_PER_RONDE);
  const posisiBaru = clampTali(input.posisiLama + perubahanTali, BATAS_MIN_TALI, BATAS_MAX_TALI);

  return {
    akurasiTim1,
    akurasiTim2,
    selisihKekuatan: Math.round(selisihKekuatan),
    bonusStreakNet,
    bonusKekompakanTim1,
    bonusKekompakanTim2,
    bonusKekompakanNet,
    bonusPowerUpTim1: bonusPowerUpTim1 + reduksiPertahananTim1,
    bonusPowerUpTim2: bonusPowerUpTim2 + reduksiPertahananTim2,
    pertahananTim1Aktif: pertahananTim1,
    pertahananTim2Aktif: pertahananTim2,
    bonusPowerUpNet:
      bonusPowerUpTim1 - bonusPowerUpTim2 + reduksiPertahananTim1 - reduksiPertahananTim2,
    perubahanTali,
    posisiBaru,
  };
}

/**
 * Helper kompatibilitas untuk panggilan tunggal sederhana:
 * Tim 1 ('merah') benar -> +KONTRIBUSI_DASAR_SOLO, Tim 2 ('putih') benar -> -KONTRIBUSI_DASAR_SOLO
 */
export function hitungPosisiTali(
  posisiSaatIni: number,
  tim: TimTarikTambang,
  benar: boolean
): number {
  if (!benar) return posisiSaatIni;
  if (tim === 'merah') {
    return clampTali(posisiSaatIni + KONTRIBUSI_DASAR_SOLO, BATAS_MIN_TALI, BATAS_MAX_TALI);
  }
  return clampTali(posisiSaatIni - KONTRIBUSI_DASAR_SOLO, BATAS_MIN_TALI, BATAS_MAX_TALI);
}

export function cekKondisiSelesai(posisiTali: number): boolean {
  return posisiTali >= BATAS_MAX_TALI || posisiTali <= BATAS_MIN_TALI;
}

/**
 * Menentukan pemenang:
 * - posisi > 0  -> Tim 1 ('merah') menang
 * - posisi < 0  -> Tim 2 ('putih') menang
 * - posisi == 0 -> Seri
 */
export function tentukanPemenang(posisiTali: number): HasilPemenang {
  if (posisiTali > 0) return 'merah';
  if (posisiTali < 0) return 'putih';
  return 'seri';
}
