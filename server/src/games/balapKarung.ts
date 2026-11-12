import crypto from 'crypto';
import { z } from 'zod';
import {
  KODE_OPSI_VALID,
  KunciPilihan,
  extractActiveOptions,
  normalizeOptionKey,
} from '../utils/questionOptions.js';

export type { KunciPilihan };

export type PresetJarakBalapKarung = 'pendek' | 'normal' | 'panjang' | 'custom';
export type KesulitanBalapKarung = 'mudah' | 'normal' | 'sulit' | 'custom';
export type JenisRintanganBalap =
  | 'kulit_pisang'
  | 'perisai'
  | 'lompatan_kuat'
  | 'jalan_berlumpur';

export const TARGET_JARAK_PRESET: Record<
  Exclude<PresetJarakBalapKarung, 'custom'>,
  number
> = {
  pendek: 50,
  normal: 100,
  panjang: 150,
};

export interface PresetKesulitanBalapConfig {
  lompatBenar: number;
  turunSalah: number;
  keseimbanganBenar: number;
  keseimbanganSalah: number;
  bonusStreak3Jarak: number;
  bonusStreak5Jarak: number;
  bonusStreak3Keseimbangan: number;
  penurunanJatuhJarak: number;
  pemulihanJatuhKeseimbangan: number;
}

export const PRESET_KESULITAN_BALAP_KARUNG: Record<
  Exclude<KesulitanBalapKarung, 'custom'>,
  PresetKesulitanBalapConfig
> = {
  mudah: {
    lompatBenar: 15,
    turunSalah: 3,
    keseimbanganBenar: 5,
    keseimbanganSalah: 10,
    bonusStreak3Jarak: 5,
    bonusStreak5Jarak: 10,
    bonusStreak3Keseimbangan: 10,
    penurunanJatuhJarak: 5,
    pemulihanJatuhKeseimbangan: 50,
  },
  normal: {
    lompatBenar: 10,
    turunSalah: 3,
    keseimbanganBenar: 5,
    keseimbanganSalah: 20,
    bonusStreak3Jarak: 5,
    bonusStreak5Jarak: 10,
    bonusStreak3Keseimbangan: 10,
    penurunanJatuhJarak: 5,
    pemulihanJatuhKeseimbangan: 50,
  },
  sulit: {
    lompatBenar: 7,
    turunSalah: 5,
    keseimbanganBenar: 5,
    keseimbanganSalah: 25,
    bonusStreak3Jarak: 5,
    bonusStreak5Jarak: 10,
    bonusStreak3Keseimbangan: 10,
    penurunanJatuhJarak: 5,
    pemulihanJatuhKeseimbangan: 50,
  },
};

export const DAFTAR_RINTANGAN_BALAP_RESMI: readonly JenisRintanganBalap[] = [
  'kulit_pisang',
  'perisai',
  'lompatan_kuat',
  'jalan_berlumpur',
] as const;

export type TipeLawanSoloBalap = 'bot' | 'lokal';
export type KesulitanBotBalap = 'santai' | 'sedang' | 'cepat';
export type KodeTimBalap = 'merah' | 'biru' | 'hijau' | 'kuning';

export const TIM_BALAP_RESMI: readonly { id: KodeTimBalap; nama: string; warna: string }[] = [
  { id: 'merah', nama: 'Tim Merah', warna: '#e2312d' },
  { id: 'biru', nama: 'Tim Biru', warna: '#1d8fe0' },
  { id: 'hijau', nama: 'Tim Hijau', warna: '#1f9d55' },
  { id: 'kuning', nama: 'Tim Kuning', warna: '#e6a100' },
] as const;

export const KATA_TERSANDUNG_BALAP: readonly string[] = [
  'Aduh!',
  'Waduh!',
  'Yah salah~',
  'Ups, kurang tepat!',
  'Auw!',
] as const;

export function hitungLangkahTimBalap(
  targetJarak: number,
  jumlahAnggotaTim: number,
  langkahDasar?: number
): number {
  const anggotaValid = Math.max(1, jumlahAnggotaTim);
  const dasar =
    typeof langkahDasar === 'number' && langkahDasar >= 0 ? langkahDasar : targetJarak * 0.125;
  return dasar / anggotaValid;
}

export const probabilitasRintanganBalapSchema = z.object({
  kulit_pisang: z.number().int().min(0).max(100),
  perisai: z.number().int().min(0).max(100),
  lompatan_kuat: z.number().int().min(0).max(100),
  jalan_berlumpur: z.number().int().min(0).max(100),
});

export const konfigurasiBalapKarungSchema = z
  .object({
    presetJarak: z.enum(['pendek', 'normal', 'panjang', 'custom']).default('normal'),
    targetJarak: z
      .number()
      .int('Target jarak harus bilangan bulat.')
      .min(10, 'Target jarak minimal 10 meter.')
      .max(1000, 'Target jarak maksimal 1000 meter.')
      .optional(),
    kesulitan: z.enum(['mudah', 'normal', 'sulit', 'custom']).default('normal'),
    lompatBenar: z
      .number()
      .int('Jarak lompatan benar harus bilangan bulat.')
      .min(1, 'Jarak lompatan benar minimal 1 meter.')
      .max(100, 'Jarak lompatan benar maksimal 100 meter.')
      .optional(),
    turunSalah: z
      .number()
      .int('Pengurangan jarak salah harus bilangan bulat.')
      .min(0, 'Pengurangan jarak salah minimal 0 meter.')
      .max(100, 'Pengurangan jarak salah maksimal 100 meter.')
      .optional(),
    keseimbanganAktif: z.boolean().default(true),
    keseimbanganBenar: z
      .number()
      .int('Pemulihan keseimbangan benar harus bilangan bulat.')
      .min(0, 'Pemulihan keseimbangan minimal 0%.')
      .max(50, 'Pemulihan keseimbangan maksimal 50%.')
      .optional(),
    keseimbanganSalah: z
      .number()
      .int('Pengurangan keseimbangan salah harus bilangan bulat.')
      .min(0, 'Pengurangan keseimbangan minimal 0%.')
      .max(100, 'Pengurangan keseimbangan maksimal 100%.')
      .optional(),
    bonusStreakAktif: z.boolean().default(true),
    bonusStreak3Jarak: z
      .number()
      .int('Bonus streak 3 harus bilangan bulat.')
      .min(0)
      .max(50)
      .default(5),
    bonusStreak5Jarak: z
      .number()
      .int('Bonus streak 5 harus bilangan bulat.')
      .min(0)
      .max(50)
      .default(10),
    bonusStreak3Keseimbangan: z
      .number()
      .int('Bonus keseimbangan streak 3 harus bilangan bulat.')
      .min(0)
      .max(50)
      .default(10),
    penurunanJatuhJarak: z
      .number()
      .int('Pengurangan jarak akibat jatuh harus bilangan bulat.')
      .min(0)
      .max(50)
      .default(5),
    pemulihanJatuhKeseimbangan: z
      .number()
      .int('Keseimbangan setelah jatuh harus bilangan bulat.')
      .min(10, 'Pemulihan keseimbangan minimal 10%.')
      .max(100, 'Pemulihan keseimbangan maksimal 100%.')
      .default(50),
    rintanganAktif: z.boolean().default(false),
    rintanganDipilih: z
      .array(z.enum(['kulit_pisang', 'perisai', 'lompatan_kuat', 'jalan_berlumpur']))
      .default(['kulit_pisang', 'perisai', 'lompatan_kuat', 'jalan_berlumpur']),
    peluangRintanganPersen: z
      .number()
      .int('Peluang kemunculan rintangan harus bilangan bulat.')
      .min(5, 'Peluang rintangan minimal 5%.')
      .max(50, 'Peluang rintangan maksimal 50%.')
      .default(20),
    probabilitasRintangan: probabilitasRintanganBalapSchema.default({
      kulit_pisang: 25,
      perisai: 25,
      lompatan_kuat: 25,
      jalan_berlumpur: 25,
    }),
    penurunanKulitPisang: z.number().int().min(1).max(50).default(15),
    bonusLompatanKuat: z.number().int().min(1).max(30).default(5),
    penaltiJalanBerlumpur: z.number().int().min(1).max(30).default(5),
    maxPeserta: z
      .preprocess((v) => {
        if (v === undefined || v === null || v === '') return 40;
        const num = Number(v);
        if (!Number.isFinite(num)) return 40;
        return Math.min(40, Math.max(1, Math.round(num)));
      }, z.number().int().min(1).max(40))
      .default(40),
    allowLateJoin: z.boolean().default(true),
    jumlahTim: z
      .preprocess((v) => (v === 4 || v === '4' ? 4 : 3), z.union([z.literal(3), z.literal(4)]))
      .default(3),
    waktuPerSoalDetik: z.number().int().min(5).max(120).default(15),
    tipeLawanSolo: z.enum(['bot', 'lokal']).default('bot'),
    kesulitanBot: z
      .preprocess((v) => {
        if (v === 'mudah' || v === 'santai') return 'santai';
        if (v === 'sulit' || v === 'cepat') return 'cepat';
        return 'sedang';
      }, z.enum(['santai', 'sedang', 'cepat']))
      .default('sedang'),
    namaPemain1: z.string().trim().min(1).max(24).default('Pemain 1'),
    namaPemain2: z.string().trim().min(1).max(24).default('Lawan Bot'),
  })
  .superRefine((val, ctx) => {
    const rintanganAktifDipilih = val.keseimbanganAktif
      ? val.rintanganDipilih
      : val.rintanganDipilih.filter((j) => j !== 'kulit_pisang' && j !== 'perisai');

    if (val.rintanganAktif && rintanganAktifDipilih.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['rintanganDipilih'],
        message: 'Pilih minimal satu rintangan yang sesuai dengan aturan keseimbangan aktif.',
      });
    }
    if (val.rintanganAktif && rintanganAktifDipilih.length > 0) {
      const totalSelectedWeight = rintanganAktifDipilih.reduce(
        (acc, key) => acc + (val.probabilitasRintangan[key] || 0),
        0
      );
      if (totalSelectedWeight <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['probabilitasRintangan'],
          message: 'Total bobot peluang untuk rintangan yang dipilih harus lebih besar dari 0.',
        });
      }
    }
  });

export interface ProbabilitasRintanganBalap {
  kulit_pisang: number;
  perisai: number;
  lompatan_kuat: number;
  jalan_berlumpur: number;
}

export interface KonfigurasiBalapKarung {
  presetJarak: PresetJarakBalapKarung;
  targetJarak: number;
  kesulitan: KesulitanBalapKarung;
  lompatBenar: number;
  turunSalah: number;
  keseimbanganAktif: boolean;
  keseimbanganBenar: number;
  keseimbanganSalah: number;
  bonusStreakAktif: boolean;
  bonusStreak3Jarak: number;
  bonusStreak5Jarak: number;
  bonusStreak3Keseimbangan: number;
  penurunanJatuhJarak: number;
  pemulihanJatuhKeseimbangan: number;
  rintanganAktif: boolean;
  rintanganDipilih: JenisRintanganBalap[];
  peluangRintanganPersen: number;
  probabilitasRintangan: ProbabilitasRintanganBalap;
  penurunanKulitPisang: number;
  bonusLompatanKuat: number;
  penaltiJalanBerlumpur: number;
  maxPeserta: number;
  allowLateJoin: boolean;
  jumlahTim: 3 | 4;
  waktuPerSoalDetik: number;
  tipeLawanSolo: TipeLawanSoloBalap;
  kesulitanBot: KesulitanBotBalap;
  namaPemain1: string;
  namaPemain2: string;
}

/**
 * Membangun snapshot konfigurasi immutable untuk satu sesi Balap Karung Challenge.
 */
export function bangunKonfigurasiBalapKarung(
  rawInput?: Partial<KonfigurasiBalapKarung>
): KonfigurasiBalapKarung {
  const parsed = konfigurasiBalapKarungSchema.parse(rawInput || {});

  const targetJarak =
    parsed.presetJarak === 'custom'
      ? parsed.targetJarak ?? TARGET_JARAK_PRESET.normal
      : TARGET_JARAK_PRESET[parsed.presetJarak];

  const presetBase =
    parsed.kesulitan === 'custom'
      ? PRESET_KESULITAN_BALAP_KARUNG.normal
      : PRESET_KESULITAN_BALAP_KARUNG[parsed.kesulitan];

  const isCustomKesulitan = parsed.kesulitan === 'custom';

  const lompatBenar = isCustomKesulitan
    ? parsed.lompatBenar ?? presetBase.lompatBenar
    : presetBase.lompatBenar;
  const turunSalah = isCustomKesulitan
    ? parsed.turunSalah ?? presetBase.turunSalah
    : presetBase.turunSalah;
  const keseimbanganBenar = isCustomKesulitan
    ? parsed.keseimbanganBenar ?? presetBase.keseimbanganBenar
    : presetBase.keseimbanganBenar;
  const keseimbanganSalah = isCustomKesulitan
    ? parsed.keseimbanganSalah ?? presetBase.keseimbanganSalah
    : presetBase.keseimbanganSalah;
  const bonusStreak3Jarak = isCustomKesulitan
    ? parsed.bonusStreak3Jarak
    : presetBase.bonusStreak3Jarak;
  const bonusStreak5Jarak = isCustomKesulitan
    ? parsed.bonusStreak5Jarak
    : presetBase.bonusStreak5Jarak;
  const bonusStreak3Keseimbangan = isCustomKesulitan
    ? parsed.bonusStreak3Keseimbangan
    : presetBase.bonusStreak3Keseimbangan;
  const penurunanJatuhJarak = isCustomKesulitan
    ? parsed.penurunanJatuhJarak
    : presetBase.penurunanJatuhJarak;
  const pemulihanJatuhKeseimbangan = isCustomKesulitan
    ? parsed.pemulihanJatuhKeseimbangan
    : presetBase.pemulihanJatuhKeseimbangan;

  const uniqueRintangan = Array.from(new Set(parsed.rintanganDipilih));
  const rintanganAktif = parsed.rintanganAktif && uniqueRintangan.length > 0;

  return Object.freeze({
    presetJarak: parsed.presetJarak,
    targetJarak,
    kesulitan: parsed.kesulitan,
    lompatBenar,
    turunSalah,
    keseimbanganAktif: parsed.keseimbanganAktif,
    keseimbanganBenar,
    keseimbanganSalah,
    bonusStreakAktif: parsed.bonusStreakAktif,
    bonusStreak3Jarak,
    bonusStreak5Jarak,
    bonusStreak3Keseimbangan,
    penurunanJatuhJarak,
    pemulihanJatuhKeseimbangan,
    rintanganAktif,
    rintanganDipilih: Object.freeze([...uniqueRintangan]) as JenisRintanganBalap[],
    peluangRintanganPersen: parsed.peluangRintanganPersen,
    probabilitasRintangan: Object.freeze({ ...parsed.probabilitasRintangan }),
    penurunanKulitPisang: parsed.penurunanKulitPisang,
    bonusLompatanKuat: parsed.bonusLompatanKuat,
    penaltiJalanBerlumpur: parsed.penaltiJalanBerlumpur,
    maxPeserta: parsed.maxPeserta,
    allowLateJoin: parsed.allowLateJoin,
    jumlahTim: parsed.jumlahTim,
    waktuPerSoalDetik: parsed.waktuPerSoalDetik,
    tipeLawanSolo: parsed.tipeLawanSolo,
    kesulitanBot: parsed.kesulitanBot,
    namaPemain1: parsed.namaPemain1 || 'Pemain 1',
    namaPemain2:
      parsed.namaPemain2 || (parsed.tipeLawanSolo === 'bot' ? 'Lawan Bot' : 'Pemain 2'),
  });
}

export interface SoalBalapKarung {
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

export interface OpsiPilihanBalap {
  choiceId: string;
  key: KunciPilihan;
  teks: string;
}

export interface PresentasiSoalBalap {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  urutanSoal?: number;
  teks: string;
  pilihan: OpsiPilihanBalap[];
  kunciKey: KunciPilihan;
  kunciChoiceId: string;
  ditampilkanPadaMs: number;
}

export interface EfekAktifBalap {
  perisai: boolean;
  lompatanKuat: boolean;
  jalanBerlumpur: boolean;
}

export interface RiwayatJarakEntry {
  urutan: number;
  questionId: string;
  jarakSebelum: number;
  perubahanJarak: number;
  jarakSesudah: number;
  keseimbanganSebelum: number;
  keseimbanganSesudah: number;
  alasan: string;
  timestampMs: number;
}

export interface RiwayatRintanganBalapEntry {
  id: string;
  tipe: JenisRintanganBalap | 'perisai_terpakai' | 'terjatuh';
  judul: string;
  deskripsi: string;
  efekNilai: number;
  satuan: '%' | 'm' | 'perisai' | 'jatuh';
  timestampMs: number;
}

export interface RiwayatJawabanBalapEntry {
  presentationId: string;
  questionId: string;
  urutanSoal?: number;
  choiceId: string;
  jawabanKey: KunciPilihan | 'TIMEOUT';
  jawabanTeks?: string | null;
  timedOut?: boolean;
  percobaanKe?: number;
  benar: boolean;
  waktuJawabMs: number;
  perubahanJarak: number;
  jarakSesudah: number;
  keseimbanganSesudah: number;
  terjatuh: boolean;
  timestampMs: number;
}

export interface PesertaBalapKarungState {
  id: string;
  secretToken: string;
  socketId: string;
  nama: string;
  tim?: KodeTimBalap | null;
  connected: boolean;
  jarak: number; // >= 0 (meter), boleh melebihi targetJarak saat lompatan terakhir
  keseimbangan: number; // 0 .. 100 (%)
  jumlahJatuh: number;
  totalBenar: number;
  totalSalah: number;
  streakSaatIni: number;
  streakTertinggi: number;
  bonus3DalamStreak: boolean;
  bonus5DalamStreak: boolean;
  totalBonusStreakKali: number;
  totalBonusStreakMeter: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs: number | null;
  selesaiPada: number | null;
  totalWaktuJawabMs: number;
  jumlahJawab: number;
  rataRataWaktuJawabMs: number;
  efekAktif: EfekAktifBalap;
  riwayatJarak: RiwayatJarakEntry[];
  riwayatRintangan: RiwayatRintanganBalapEntry[];
  riwayatJawaban: RiwayatJawabanBalapEntry[];
  antreanSoal: string[];
  terakhirSoalId?: string;
  presentasiAktif: PresentasiSoalBalap | null;
  nomorSoalPemain: number;
}

export interface RngBalapKarung {
  peluangPercent(): number; // 0..99
  rollWeight(maxExclusive: number): number; // 0 .. maxExclusive - 1
}

const defaultRngBalap: RngBalapKarung = {
  peluangPercent: () => crypto.randomInt(0, 100),
  rollWeight: (maxExclusive: number) => crypto.randomInt(0, Math.max(1, maxExclusive)),
};

/**
 * Menghasilkan choiceId unik yang terikat pada ID pertanyaan dan opsi jawaban.
 */
export function buatChoiceIdBalap(questionId: string, key: KunciPilihan): string {
  return `${questionId}::${key}`;
}

/**
 * Membangun presentasi soal unik per kemunculan agar validasi tahan replay & indeks array.
 */
export function buatPresentasiSoalBalap(
  soal: SoalBalapKarung,
  nomorSoal: number,
  ditampilkanPadaMs: number = Date.now()
): PresentasiSoalBalap {
  const activeOpsi = extractActiveOptions(soal);
  const kunciKey = normalizeOptionKey(
    soal.jawabanBenar,
    activeOpsi.map((o) => o.key),
    'A'
  );

  const pilihan: OpsiPilihanBalap[] = activeOpsi.map((opsi) => ({
    choiceId: buatChoiceIdBalap(soal.id, opsi.key),
    key: opsi.key,
    teks: opsi.teks,
  }));

  return {
    presentationId: crypto.randomUUID(),
    questionId: soal.id,
    nomorSoal,
    urutanSoal: soal.urutan,
    teks: soal.teks,
    pilihan,
    kunciKey,
    kunciChoiceId: buatChoiceIdBalap(soal.id, kunciKey),
    ditampilkanPadaMs,
  };
}

/**
 * Memvalidasi jawaban siswa berdasarkan choiceId stabil di server.
 */
export function validasiPilihanBalapDenganChoiceId(
  presentasi: PresentasiSoalBalap,
  choiceId?: string,
  fallbackKey?: string
): { valid: boolean; dipilih: OpsiPilihanBalap | null; benar: boolean } {
  let targetChoiceId = (choiceId || '').trim();
  if (!targetChoiceId && fallbackKey) {
    const k = fallbackKey.trim().toUpperCase();
    if ((KODE_OPSI_VALID as readonly string[]).includes(k)) {
      targetChoiceId = buatChoiceIdBalap(presentasi.questionId, k as KunciPilihan);
    }
  }

  if (!targetChoiceId) {
    return { valid: false, dipilih: null, benar: false };
  }

  const dipilih = presentasi.pilihan.find((p) => p.choiceId === targetChoiceId) || null;
  if (!dipilih) {
    return { valid: false, dipilih: null, benar: false };
  }

  return {
    valid: true,
    dipilih,
    benar: dipilih.choiceId === presentasi.kunciChoiceId,
  };
}

export function clonePesertaBalap(p: PesertaBalapKarungState): PesertaBalapKarungState {
  return {
    ...p,
    efekAktif: { ...p.efekAktif },
    riwayatJarak: [...p.riwayatJarak],
    riwayatRintangan: [...p.riwayatRintangan],
    riwayatJawaban: [...p.riwayatJawaban],
    antreanSoal: [...p.antreanSoal],
    presentasiAktif: p.presentasiAktif
      ? { ...p.presentasiAktif, pilihan: [...p.presentasiAktif.pilihan] }
      : null,
  };
}

/**
 * Mengundi jenis rintangan secara berbobot memakai RNG backend ketika rintangan aktif.
 */
export function putarRintanganBalapKarung(
  peserta: PesertaBalapKarungState,
  config: KonfigurasiBalapKarung,
  nowMs: number,
  rng: RngBalapKarung = defaultRngBalap
): RiwayatRintanganBalapEntry | null {
  if (!config.rintanganAktif || config.rintanganDipilih.length === 0) {
    return null;
  }

  if (peserta.status === 'selesai' || peserta.jarak >= config.targetJarak) {
    return null;
  }

  const roll = rng.peluangPercent();
  if (roll >= config.peluangRintanganPersen) {
    return null;
  }

  const kandidat = config.rintanganDipilih.filter((jenis) => {
    if (!config.keseimbanganAktif && (jenis === 'kulit_pisang' || jenis === 'perisai')) {
      return false;
    }
    return (config.probabilitasRintangan[jenis] || 0) > 0;
  });
  if (kandidat.length === 0) {
    return null;
  }

  const totalWeight = kandidat.reduce(
    (sum, jenis) => sum + config.probabilitasRintangan[jenis],
    0
  );
  const pickRoll = rng.rollWeight(totalWeight);

  let cumulative = 0;
  let terpilih: JenisRintanganBalap = kandidat[0];
  for (const jenis of kandidat) {
    cumulative += config.probabilitasRintangan[jenis];
    if (pickRoll < cumulative) {
      terpilih = jenis;
      break;
    }
  }

  let log: RiwayatRintanganBalapEntry;

  switch (terpilih) {
    case 'kulit_pisang': {
      const sebelum = peserta.keseimbangan;
      const sesudah = config.keseimbanganAktif
        ? Math.max(0, sebelum - config.penurunanKulitPisang)
        : 100;
      peserta.keseimbangan = sesudah;
      log = {
        id: crypto.randomUUID(),
        tipe: 'kulit_pisang',
        judul: 'Terinjak Kulit Pisang!',
        deskripsi: `Keseimbangan berkurang ${config.penurunanKulitPisang}% menjadi ${sesudah}%.`,
        efekNilai: config.keseimbanganAktif ? sesudah - sebelum : 0,
        satuan: '%',
        timestampMs: nowMs,
      };
      break;
    }
    case 'perisai': {
      peserta.efekAktif.perisai = true;
      log = {
        id: crypto.randomUUID(),
        tipe: 'perisai',
        judul: 'Mendapat Perisai Keseimbangan!',
        deskripsi: 'Melindungi dari pengurangan jarak pada 1 kejadian jatuh berikutnya.',
        efekNilai: 1,
        satuan: 'perisai',
        timestampMs: nowMs,
      };
      break;
    }
    case 'lompatan_kuat': {
      peserta.efekAktif.lompatanKuat = true;
      log = {
        id: crypto.randomUUID(),
        tipe: 'lompatan_kuat',
        judul: 'Lompatan Kuat Siap!',
        deskripsi: `Bonus +${config.bonusLompatanKuat} meter pada jawaban benar berikutnya.`,
        efekNilai: config.bonusLompatanKuat,
        satuan: 'm',
        timestampMs: nowMs,
      };
      break;
    }
    case 'jalan_berlumpur': {
      peserta.efekAktif.jalanBerlumpur = true;
      log = {
        id: crypto.randomUUID(),
        tipe: 'jalan_berlumpur',
        judul: 'Memasuki Jalan Berlumpur!',
        deskripsi: `Lompatan benar berikutnya berkurang ${config.penaltiJalanBerlumpur} meter.`,
        efekNilai: -config.penaltiJalanBerlumpur,
        satuan: 'm',
        timestampMs: nowMs,
      };
      break;
    }
  }

  peserta.riwayatRintangan.push(log);
  return log;
}

export interface ProsesJawabanBalapParams {
  peserta: PesertaBalapKarungState;
  presentasi: PresentasiSoalBalap;
  choiceId?: string;
  fallbackJawabanKey?: string;
  timedOut?: boolean;
  config: KonfigurasiBalapKarung;
  gameMulaiPadaMs: number;
  nowMs?: number;
  rngRintangan?: RngBalapKarung;
}

export interface HasilJawabanBalap {
  benar: boolean;
  timedOut: boolean;
  pilihanDipilih: OpsiPilihanBalap | null;
  jarakSebelum: number;
  jarakBaru: number;
  perubahanJarak: number;
  keseimbanganSebelum: number;
  keseimbanganBaru: number;
  perubahanKeseimbangan: number;
  bonusStreakJarakDidapat: number;
  bonusStreakKeseimbanganDidapat: number;
  bonusLompatanKuatDidapat: number;
  penaltiJalanBerlumpurDipakai: number;
  terjatuh: boolean;
  penaltiJatuhJarak: number;
  perisaiDigunakan: boolean;
  rintanganBaru: RiwayatRintanganBalapEntry | null;
  selesaiBaru: boolean;
  waktuJawabMs: number;
  pesertaUpdated: PesertaBalapKarungState;
}

/**
 * Mengeksekusi seluruh aturan Balap Karung Challenge pada satu jawaban siswa secara atomik di backend.
 */
export function prosesJawabanBalapKarung(
  params: ProsesJawabanBalapParams
): HasilJawabanBalap {
  const {
    peserta,
    presentasi,
    choiceId,
    fallbackJawabanKey,
    timedOut = false,
    config,
    gameMulaiPadaMs,
    nowMs = Date.now(),
    rngRintangan = defaultRngBalap,
  } = params;

  if (peserta.status === 'selesai' || peserta.jarak >= config.targetJarak) {
    throw new Error('Anda sudah mencapai garis finis dan menyelesaikan perlombaan.');
  }

  let cekPilihan: { valid: boolean; dipilih: OpsiPilihanBalap | null; benar: boolean };
  if (timedOut) {
    cekPilihan = { valid: true, dipilih: null, benar: false };
  } else {
    cekPilihan = validasiPilihanBalapDenganChoiceId(
      presentasi,
      choiceId,
      fallbackJawabanKey
    );
    if (!cekPilihan.valid || !cekPilihan.dipilih) {
      throw new Error('Pilihan jawaban tidak valid untuk soal yang aktif.');
    }
  }

  const updated = clonePesertaBalap(peserta);
  const benar = cekPilihan.benar;
  const waktuJawabMs = Math.max(1, nowMs - presentasi.ditampilkanPadaMs);

  updated.totalWaktuJawabMs += waktuJawabMs;
  updated.jumlahJawab += 1;
  updated.rataRataWaktuJawabMs = Math.round(updated.totalWaktuJawabMs / updated.jumlahJawab);
  updated.presentasiAktif = null;

  const jarakSebelum = updated.jarak;
  const keseimbanganSebelum = config.keseimbanganAktif ? updated.keseimbangan : 100;

  let bonusStreakJarakDidapat = 0;
  let bonusStreakKeseimbanganDidapat = 0;
  let bonusLompatanKuatDidapat = 0;
  let penaltiJalanBerlumpurDipakai = 0;
  let terjatuh = false;
  let penaltiJatuhJarak = 0;
  let perisaiDigunakan = false;
  let rintanganBaru: RiwayatRintanganBalapEntry | null = null;

  const alasanList: string[] = [];

  if (benar) {
    updated.totalBenar += 1;
    updated.streakSaatIni += 1;
    if (updated.streakSaatIni > updated.streakTertinggi) {
      updated.streakTertinggi = updated.streakSaatIni;
    }

    let langkahJarak = config.lompatBenar;
    let tambahKeseimbangan = config.keseimbanganAktif ? config.keseimbanganBenar : 0;
    alasanList.push(`Benar +${config.lompatBenar}m`);

    // Milestone streak 3 & 5 (masing-masing 1 kali per rangkaian streak)
    if (config.bonusStreakAktif) {
      if (updated.streakSaatIni === 3 && !updated.bonus3DalamStreak) {
        langkahJarak += config.bonusStreak3Jarak;
        bonusStreakJarakDidapat += config.bonusStreak3Jarak;
        updated.bonus3DalamStreak = true;
        updated.totalBonusStreakKali += 1;
        updated.totalBonusStreakMeter += config.bonusStreak3Jarak;
        alasanList.push(`Streak 3 +${config.bonusStreak3Jarak}m`);

        if (config.keseimbanganAktif && config.bonusStreak3Keseimbangan > 0) {
          tambahKeseimbangan += config.bonusStreak3Keseimbangan;
          bonusStreakKeseimbanganDidapat = config.bonusStreak3Keseimbangan;
          alasanList.push(`Keseimbangan Streak +${config.bonusStreak3Keseimbangan}%`);
        }
      }
      if (updated.streakSaatIni === 5 && !updated.bonus5DalamStreak) {
        langkahJarak += config.bonusStreak5Jarak;
        bonusStreakJarakDidapat += config.bonusStreak5Jarak;
        updated.bonus5DalamStreak = true;
        updated.totalBonusStreakKali += 1;
        updated.totalBonusStreakMeter += config.bonusStreak5Jarak;
        alasanList.push(`Streak 5 +${config.bonusStreak5Jarak}m`);
      }
    }

    // Power-up Lompatan Kuat (1 kali pakai)
    if (updated.efekAktif.lompatanKuat) {
      langkahJarak += config.bonusLompatanKuat;
      bonusLompatanKuatDidapat = config.bonusLompatanKuat;
      updated.efekAktif.lompatanKuat = false;
      alasanList.push(`Lompatan Kuat +${config.bonusLompatanKuat}m`);
    }

    // Rintangan Jalan Berlumpur (1 kali pakai; hasil akhir lompatan benar min 0m)
    if (updated.efekAktif.jalanBerlumpur) {
      langkahJarak -= config.penaltiJalanBerlumpur;
      penaltiJalanBerlumpurDipakai = config.penaltiJalanBerlumpur;
      updated.efekAktif.jalanBerlumpur = false;
      alasanList.push(`Jalan Berlumpur -${config.penaltiJalanBerlumpur}m`);
    }

    langkahJarak = Math.max(0, langkahJarak);
    updated.jarak = Math.max(0, jarakSebelum + langkahJarak);
    updated.keseimbangan = config.keseimbanganAktif
      ? Math.min(100, Math.max(0, keseimbanganSebelum + tambahKeseimbangan))
      : 100;
  } else {
    updated.totalSalah += 1;
    updated.streakSaatIni = 0;
    updated.bonus3DalamStreak = false;
    updated.bonus5DalamStreak = false;

    updated.jarak = Math.max(0, jarakSebelum - config.turunSalah);
    alasanList.push(timedOut ? `Waktu habis -${config.turunSalah}m` : `Salah -${config.turunSalah}m`);

    updated.keseimbangan = config.keseimbanganAktif
      ? Math.max(0, keseimbanganSebelum - config.keseimbanganSalah)
      : 100;
    if (config.keseimbanganAktif) {
      alasanList.push(`Keseimbangan -${config.keseimbanganSalah}%`);
    }
  }

  // Helper internal: memproses kejadian jatuh tepat 1 kali jika keseimbangan == 0% sebelum finis
  const prosesJatuhSekali = (sumber: string) => {
    if (
      !config.keseimbanganAktif ||
      updated.keseimbangan > 0 ||
      updated.status === 'selesai' ||
      updated.jarak >= config.targetJarak ||
      terjatuh
    ) {
      return;
    }

    terjatuh = true;
    updated.jumlahJatuh += 1;

    if (updated.efekAktif.perisai) {
      updated.efekAktif.perisai = false;
      perisaiDigunakan = true;
      penaltiJatuhJarak = 0;
      updated.keseimbangan = config.pemulihanJatuhKeseimbangan;
      alasanList.push('Perisai melindungi saat jatuh');
      updated.riwayatRintangan.push({
        id: crypto.randomUUID(),
        tipe: 'perisai_terpakai',
        judul: 'Perisai Menahan Jatuh!',
        deskripsi: `Keseimbangan habis (${sumber}), namun jarak aman berkat perisai. Keseimbangan pulih ke ${config.pemulihanJatuhKeseimbangan}%.`,
        efekNilai: 0,
        satuan: 'perisai',
        timestampMs: nowMs,
      });
    } else {
      const pra = updated.jarak;
      updated.jarak = Math.max(0, pra - config.penurunanJatuhJarak);
      penaltiJatuhJarak = pra - updated.jarak;
      updated.keseimbangan = config.pemulihanJatuhKeseimbangan;
      alasanList.push(`Terjatuh -${penaltiJatuhJarak}m, Keseimbangan pulih ${config.pemulihanJatuhKeseimbangan}%`);
      updated.riwayatRintangan.push({
        id: crypto.randomUUID(),
        tipe: 'terjatuh',
        judul: 'Pemain Terjatuh!',
        deskripsi: `Keseimbangan 0% (${sumber}). Jarak berkurang ${penaltiJatuhJarak} m dan keseimbangan pulih ke ${config.pemulihanJatuhKeseimbangan}%.`,
        efekNilai: -penaltiJatuhJarak,
        satuan: 'jatuh',
        timestampMs: nowMs,
      });
    }
  };

  let selesaiBaru = false;
  if (updated.jarak >= config.targetJarak) {
    updated.status = 'selesai';
    updated.selesaiPada = nowMs;
    updated.waktuSelesaiMs = Math.max(1, nowMs - gameMulaiPadaMs);
    selesaiBaru = true;
  } else {
    // 1. Cek jatuh langsung akibat keseimbangan 0% setelah jawaban salah
    if (config.keseimbanganAktif && updated.keseimbangan <= 0) {
      prosesJatuhSekali('jawaban salah');
    }

    // 2. Undi rintangan/power-up opsional hanya pada jawaban benar & belum finis
    if (benar) {
      rintanganBaru = putarRintanganBalapKarung(updated, config, nowMs, rngRintangan);
      if (rintanganBaru) {
        alasanList.push(rintanganBaru.judul);
        // Jika Kulit Pisang menjatuhkan keseimbangan tepat ke 0%, proses kejadian jatuh sekali
        if (config.keseimbanganAktif && updated.keseimbangan <= 0) {
          prosesJatuhSekali('terinjak kulit pisang');
        }
      }
    }
  }

  updated.riwayatJarak.push({
    urutan: updated.riwayatJarak.length + 1,
    questionId: presentasi.questionId,
    jarakSebelum,
    perubahanJarak: updated.jarak - jarakSebelum,
    jarakSesudah: updated.jarak,
    keseimbanganSebelum,
    keseimbanganSesudah: updated.keseimbangan,
    alasan: alasanList.join(', '),
    timestampMs: nowMs,
  });

  const percobaanKe =
    updated.riwayatJawaban.filter((r) => r.questionId === presentasi.questionId).length + 1;

  updated.riwayatJawaban.push({
    presentationId: presentasi.presentationId,
    questionId: presentasi.questionId,
    urutanSoal: presentasi.urutanSoal,
    choiceId: cekPilihan.dipilih?.choiceId || 'TIMEOUT',
    jawabanKey: cekPilihan.dipilih?.key || 'TIMEOUT',
    jawabanTeks: cekPilihan.dipilih?.teks || null,
    timedOut,
    percobaanKe,
    benar,
    waktuJawabMs,
    perubahanJarak: updated.jarak - jarakSebelum,
    jarakSesudah: updated.jarak,
    keseimbanganSesudah: updated.keseimbangan,
    terjatuh,
    timestampMs: nowMs,
  });

  return {
    benar,
    timedOut,
    pilihanDipilih: cekPilihan.dipilih,
    jarakSebelum,
    jarakBaru: updated.jarak,
    perubahanJarak: updated.jarak - jarakSebelum,
    keseimbanganSebelum,
    keseimbanganBaru: updated.keseimbangan,
    perubahanKeseimbangan: updated.keseimbangan - keseimbanganSebelum,
    bonusStreakJarakDidapat,
    bonusStreakKeseimbanganDidapat,
    bonusLompatanKuatDidapat,
    penaltiJalanBerlumpurDipakai,
    terjatuh,
    penaltiJatuhJarak,
    perisaiDigunakan,
    rintanganBaru,
    selesaiBaru,
    waktuJawabMs,
    pesertaUpdated: updated,
  };
}

/**
 * Mengurutkan leaderboard Balap Karung Challenge sesuai 5 kriteria berurutan:
 * 1. Pemain finis di atas pemain belum finis.
 * 2. Sesama finis: waktu finis paling awal (waktuSelesaiMs asc).
 * 3. Belum finis: jarak tempuh tertinggi (jarak desc).
 * 4. Jarak sama: jumlah jawaban benar terbanyak (totalBenar desc).
 * 5. Masih sama: rata-rata waktu respons tercepat (rataRataWaktuJawabMs asc).
 */
export function urutkanLeaderboardBalapKarung(
  pesertaList: PesertaBalapKarungState[],
  targetJarak: number
): PesertaBalapKarungState[] {
  return [...pesertaList].sort((a, b) => {
    const aFinis = a.status === 'selesai' || a.jarak >= targetJarak;
    const bFinis = b.status === 'selesai' || b.jarak >= targetJarak;

    // 1. Sudah finis di atas belum finis
    if (aFinis !== bFinis) {
      return aFinis ? -1 : 1;
    }

    // 2. Sesama finis: waktu finis paling awal
    if (aFinis && bFinis) {
      const tA = a.waktuSelesaiMs ?? Number.MAX_SAFE_INTEGER;
      const tB = b.waktuSelesaiMs ?? Number.MAX_SAFE_INTEGER;
      if (tA !== tB) {
        return tA - tB;
      }
    }

    // 3. Jarak tempuh tertinggi
    if (b.jarak !== a.jarak) {
      return b.jarak - a.jarak;
    }

    // 4. Jumlah jawaban benar terbanyak
    if (b.totalBenar !== a.totalBenar) {
      return b.totalBenar - a.totalBenar;
    }

    // 5. Rata-rata waktu respons tercepat
    const rA = a.jumlahJawab > 0 ? a.rataRataWaktuJawabMs : Number.MAX_SAFE_INTEGER;
    const rB = b.jumlahJawab > 0 ? b.rataRataWaktuJawabMs : Number.MAX_SAFE_INTEGER;
    if (rA !== rB) {
      return rA - rB;
    }

    // 6. Tie-break deterministik
    if (a.jumlahJatuh !== b.jumlahJatuh) {
      return a.jumlahJatuh - b.jumlahJatuh;
    }
    const cmpNama = a.nama.localeCompare(b.nama);
    if (cmpNama !== 0) {
      return cmpNama;
    }
    return a.id.localeCompare(b.id);
  });
}
