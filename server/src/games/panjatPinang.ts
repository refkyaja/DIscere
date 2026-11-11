import crypto from 'crypto';
import { z } from 'zod';
import {
  KODE_OPSI_VALID,
  KunciPilihan,
  extractActiveOptions,
  normalizeOptionKey,
} from '../utils/questionOptions.js';

export type { KunciPilihan };

export type KesulitanPanjatPinang = 'mudah' | 'normal' | 'sulit' | 'custom';

export type JenisRintangan =
  | 'tiang_licin'
  | 'kulit_pisang'
  | 'pegangan_kuat'
  | 'hadiah_kejutan';

export interface PresetPanjatPinangConfig {
  naikBenar: number;
  turunSalah: number;
  bonusStreak3: number;
  bonusStreak5: number;
}

export const PRESET_PANJAT_PINANG: Record<
  Exclude<KesulitanPanjatPinang, 'custom'>,
  PresetPanjatPinangConfig
> = {
  mudah: {
    naikBenar: 15,
    turunSalah: 3,
    bonusStreak3: 5,
    bonusStreak5: 10,
  },
  normal: {
    naikBenar: 10,
    turunSalah: 5,
    bonusStreak3: 5,
    bonusStreak5: 10,
  },
  sulit: {
    naikBenar: 7,
    turunSalah: 10,
    bonusStreak3: 5,
    bonusStreak5: 10,
  },
};

export const DAFTAR_RINTANGAN_RESMI: readonly JenisRintangan[] = [
  'tiang_licin',
  'kulit_pisang',
  'pegangan_kuat',
  'hadiah_kejutan',
] as const;

export const konfigurasiPanjatPinangSchema = z.object({
  kesulitan: z.enum(['mudah', 'normal', 'sulit', 'custom']).default('normal'),
  naikBenar: z
    .number()
    .int('Kenaikan jawaban benar harus bilangan bulat.')
    .min(1, 'Kenaikan jawaban benar minimal 1%.')
    .max(50, 'Kenaikan jawaban benar maksimal 50%.')
    .optional(),
  turunSalah: z
    .number()
    .int('Penurunan jawaban salah harus bilangan bulat.')
    .min(0, 'Penurunan jawaban salah minimal 0%.')
    .max(50, 'Penurunan jawaban salah maksimal 50%.')
    .optional(),
  bonusStreakAktif: z.boolean().default(true),
  bonusStreak3: z
    .number()
    .int('Bonus streak 3 harus bilangan bulat.')
    .min(0, 'Bonus streak 3 minimal 0%.')
    .max(50, 'Bonus streak 3 maksimal 50%.')
    .default(5),
  bonusStreak5: z
    .number()
    .int('Bonus streak 5 harus bilangan bulat.')
    .min(0, 'Bonus streak 5 minimal 0%.')
    .max(50, 'Bonus streak 5 maksimal 50%.')
    .default(10),
  rintanganAktif: z.boolean().default(false),
  rintanganDipilih: z
    .array(z.enum(['tiang_licin', 'kulit_pisang', 'pegangan_kuat', 'hadiah_kejutan']))
    .default(['tiang_licin', 'kulit_pisang', 'pegangan_kuat', 'hadiah_kejutan']),
  penurunanTiangLicin: z
    .number()
    .int('Penurunan tiang licin harus bilangan bulat.')
    .min(1, 'Penurunan tiang licin minimal 1%.')
    .max(30, 'Penurunan tiang licin maksimal 30%.')
    .default(5),
  bonusPeganganKuat: z
    .number()
    .int('Bonus pegangan kuat harus bilangan bulat.')
    .min(1, 'Bonus pegangan kuat minimal 1%.')
    .max(30, 'Bonus pegangan kuat maksimal 30%.')
    .default(5),
  hadiahKejutanMode: z.enum(['posisi', 'poin']).default('posisi'),
  hadiahKejutanNilai: z
    .number()
    .int('Nilai hadiah kejutan harus bilangan bulat.')
    .min(1, 'Nilai hadiah kejutan minimal 1.')
    .max(500, 'Nilai hadiah kejutan maksimal 500.')
    .default(5),
  peluangRintanganPersen: z
    .number()
    .int('Peluang rintangan harus bilangan bulat.')
    .min(5, 'Peluang rintangan minimal 5%.')
    .max(60, 'Peluang rintangan maksimal 60%.')
    .default(25),
  maxPeserta: z
    .number()
    .int('Kapasitas peserta harus bilangan bulat.')
    .min(1, 'Minimal 1 peserta.')
    .max(200, 'Maksimal 200 peserta dalam satu sesi.')
    .default(100),
  allowLateJoin: z.boolean().default(true),
});

export interface KonfigurasiPanjatPinang {
  kesulitan: KesulitanPanjatPinang;
  naikBenar: number;
  turunSalah: number;
  bonusStreakAktif: boolean;
  bonusStreak3: number;
  bonusStreak5: number;
  rintanganAktif: boolean;
  rintanganDipilih: JenisRintangan[];
  penurunanTiangLicin: number;
  bonusPeganganKuat: number;
  hadiahKejutanMode: 'posisi' | 'poin';
  hadiahKejutanNilai: number;
  peluangRintanganPersen: number;
  maxPeserta: number;
  allowLateJoin: boolean;
}

/**
 * Membangun snapshot konfigurasi immutable untuk sesi Panjat Pinang.
 */
export function bangunKonfigurasiPanjatPinang(
  rawInput?: Partial<KonfigurasiPanjatPinang>
): KonfigurasiPanjatPinang {
  const parsed = konfigurasiPanjatPinangSchema.parse(rawInput || {});
  const kesulitan = parsed.kesulitan;

  const presetBase =
    kesulitan === 'custom'
      ? PRESET_PANJAT_PINANG.normal
      : PRESET_PANJAT_PINANG[kesulitan];

  const naikBenar =
    kesulitan === 'custom' ? (parsed.naikBenar ?? presetBase.naikBenar) : presetBase.naikBenar;
  const turunSalah =
    kesulitan === 'custom' ? (parsed.turunSalah ?? presetBase.turunSalah) : presetBase.turunSalah;
  const bonusStreak3 =
    kesulitan === 'custom' ? parsed.bonusStreak3 : presetBase.bonusStreak3;
  const bonusStreak5 =
    kesulitan === 'custom' ? parsed.bonusStreak5 : presetBase.bonusStreak5;

  const uniqueRintangan = Array.from(new Set(parsed.rintanganDipilih));
  const rintanganAktif = parsed.rintanganAktif && uniqueRintangan.length > 0;
  const hadiahKejutanNilai =
    parsed.hadiahKejutanMode === 'posisi'
      ? Math.min(50, Math.max(1, parsed.hadiahKejutanNilai))
      : Math.min(500, Math.max(1, parsed.hadiahKejutanNilai));

  return Object.freeze({
    kesulitan,
    naikBenar,
    turunSalah,
    bonusStreakAktif: parsed.bonusStreakAktif,
    bonusStreak3,
    bonusStreak5,
    rintanganAktif,
    rintanganDipilih: uniqueRintangan,
    penurunanTiangLicin: parsed.penurunanTiangLicin,
    bonusPeganganKuat: parsed.bonusPeganganKuat,
    hadiahKejutanMode: parsed.hadiahKejutanMode,
    hadiahKejutanNilai,
    peluangRintanganPersen: parsed.peluangRintanganPersen,
    maxPeserta: parsed.maxPeserta,
    allowLateJoin: parsed.allowLateJoin,
  });
}

export interface OpsiPilihanPanjat {
  choiceId: string;
  key: KunciPilihan;
  teks: string;
}

export interface PresentasiSoalPanjat {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  teks: string;
  pilihan: OpsiPilihanPanjat[];
  kunciKey: KunciPilihan;
  kunciChoiceId: string;
  isBonusKulitPisang: boolean;
  ditampilkanPadaMs: number;
}

export interface EfekAktifPanjat {
  tiangLicin: boolean;
  perisaiKulitPisang: boolean;
  peganganKuat: boolean;
  menungguBonusKulitPisang: boolean;
}

export interface RiwayatPosisiEntry {
  urutan: number;
  questionId: string;
  posisiSebelum: number;
  perubahan: number;
  posisiSesudah: number;
  alasan: string;
  timestampMs: number;
}

export interface RiwayatRintanganEntry {
  id: string;
  tipe: JenisRintangan | 'perisai_terpakai';
  judul: string;
  deskripsi: string;
  efekNilai: number;
  satuan: '%' | 'poin' | 'perisai' | 'bonus_soal';
  timestampMs: number;
}

export interface RiwayatJawabanEntry {
  presentationId: string;
  questionId: string;
  choiceId: string;
  jawabanKey: KunciPilihan;
  benar: boolean;
  isBonusKulitPisang: boolean;
  waktuJawabMs: number;
  perubahanPosisi: number;
  posisiSesudah: number;
  timestampMs: number;
}

export interface PesertaPanjatState {
  id: string;
  secretToken: string;
  socketId: string;
  nama: string;
  connected: boolean;
  posisi: number;
  poinBonus: number;
  totalBenar: number;
  totalSalah: number;
  streakSaatIni: number;
  streakTertinggi: number;
  bonus3DalamStreak: boolean;
  bonus5DalamStreak: boolean;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs: number | null;
  selesaiPada: number | null;
  totalWaktuJawabMs: number;
  jumlahJawab: number;
  rataRataWaktuJawabMs: number;
  efekAktif: EfekAktifPanjat;
  riwayatPosisi: RiwayatPosisiEntry[];
  riwayatRintangan: RiwayatRintanganEntry[];
  riwayatJawaban: RiwayatJawabanEntry[];
  antreanSoal: string[];
  terakhirSoalId?: string;
  presentasiAktif: PresentasiSoalPanjat | null;
  nomorSoalPemain: number;
}

export interface SoalPanjat {
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

/**
 * Menghasilkan ID pilihan yang stabil dan terikat langsung pada ID soal serta huruf opsi.
 */
export function buatChoiceId(questionId: string, key: KunciPilihan): string {
  return `${questionId}::${key}`;
}

/**
 * Membangun presentasi soal unik untuk satu kali kesempatan menjawab pemain.
 */
export function buatPresentasiSoalPanjat(
  soal: SoalPanjat,
  nomorSoal: number,
  isBonusKulitPisang: boolean,
  ditampilkanPadaMs: number = Date.now()
): PresentasiSoalPanjat {
  const activeOpsi = extractActiveOptions(soal);
  const kunciKey = normalizeOptionKey(
    soal.jawabanBenar,
    activeOpsi.map((o) => o.key),
    'A'
  );

  const pilihan: OpsiPilihanPanjat[] = activeOpsi.map((opsi) => ({
    choiceId: buatChoiceId(soal.id, opsi.key),
    key: opsi.key,
    teks: opsi.teks,
  }));

  return {
    presentationId: crypto.randomUUID(),
    questionId: soal.id,
    nomorSoal,
    teks: soal.teks,
    pilihan,
    kunciKey,
    kunciChoiceId: buatChoiceId(soal.id, kunciKey),
    isBonusKulitPisang,
    ditampilkanPadaMs,
  };
}

/**
 * Memvalidasi pilihan siswa berbasis choiceId stabil (tidak bergantung pada indeks array atau teks).
 */
export function validasiPilihanDenganChoiceId(
  presentasi: PresentasiSoalPanjat,
  choiceId?: string,
  fallbackKey?: string
): { valid: boolean; dipilih: OpsiPilihanPanjat | null; benar: boolean } {
  let targetChoiceId = (choiceId || '').trim();
  if (!targetChoiceId && fallbackKey) {
    const k = fallbackKey.trim().toUpperCase();
    if ((KODE_OPSI_VALID as readonly string[]).includes(k)) {
      targetChoiceId = buatChoiceId(presentasi.questionId, k as KunciPilihan);
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

export interface RngRintangan {
  peluangPercent(): number; // mengembalikan angka bulat 0..99
  pilihIndex(maxExclusive: number): number;
}

const defaultRngRintangan: RngRintangan = {
  peluangPercent: () => crypto.randomInt(0, 100),
  pilihIndex: (maxExclusive: number) => crypto.randomInt(0, maxExclusive),
};

/**
 * Memutar peluang rintangan di backend setelah pertanyaan reguler dijawab.
 */
export function putarRintanganBackend(
  peserta: PesertaPanjatState,
  config: KonfigurasiPanjatPinang,
  nowMs: number,
  rng: RngRintangan = defaultRngRintangan
): RiwayatRintanganEntry | null {
  if (!config.rintanganAktif || config.rintanganDipilih.length === 0) {
    return null;
  }
  if (peserta.status === 'selesai' || peserta.posisi >= 100) {
    return null;
  }

  // Hindari menumpuk status rintangan yang sama secara berulang
  const kandidat = config.rintanganDipilih.filter((jenis) => {
    if (jenis === 'tiang_licin' && peserta.efekAktif.tiangLicin) return false;
    if (
      jenis === 'kulit_pisang' &&
      (peserta.efekAktif.perisaiKulitPisang || peserta.efekAktif.menungguBonusKulitPisang)
    ) {
      return false;
    }
    if (jenis === 'pegangan_kuat' && peserta.efekAktif.peganganKuat) return false;
    return true;
  });

  if (kandidat.length === 0) {
    return null;
  }

  const roll = rng.peluangPercent();
  if (roll >= config.peluangRintanganPersen) {
    return null;
  }

  const terpilih = kandidat[rng.pilihIndex(kandidat.length)];
  const entryId = crypto.randomUUID();

  if (terpilih === 'tiang_licin') {
    peserta.efekAktif.tiangLicin = true;
    const log: RiwayatRintanganEntry = {
      id: entryId,
      tipe: 'tiang_licin',
      judul: 'Awas Tiang Licin!',
      deskripsi: `Tiang terasa licin! Jika soal berikutnya salah, turun tambahan ${config.penurunanTiangLicin}%.`,
      efekNilai: config.penurunanTiangLicin,
      satuan: '%',
      timestampMs: nowMs,
    };
    peserta.riwayatRintangan.push(log);
    return log;
  }

  if (terpilih === 'kulit_pisang') {
    peserta.efekAktif.menungguBonusKulitPisang = true;
    const log: RiwayatRintanganEntry = {
      id: entryId,
      tipe: 'kulit_pisang',
      judul: 'Kulit Pisang! Soal Bonus',
      deskripsi:
        'Jawab benar pertanyaan bonus berikutnya untuk mendapat perisai penahan 1 efek penurunan tambahan.',
      efekNilai: 1,
      satuan: 'bonus_soal',
      timestampMs: nowMs,
    };
    peserta.riwayatRintangan.push(log);
    return log;
  }

  if (terpilih === 'pegangan_kuat') {
    peserta.efekAktif.peganganKuat = true;
    const log: RiwayatRintanganEntry = {
      id: entryId,
      tipe: 'pegangan_kuat',
      judul: 'Pegangan Kuat!',
      deskripsi: `Jawaban benar berikutnya mendapat bonus kenaikan +${config.bonusPeganganKuat}% (sekali pakai).`,
      efekNilai: config.bonusPeganganKuat,
      satuan: '%',
      timestampMs: nowMs,
    };
    peserta.riwayatRintangan.push(log);
    return log;
  }

  // Hadiah Kejutan: langsung berlaku satu kali per aktivasi
  if (config.hadiahKejutanMode === 'poin') {
    peserta.poinBonus += config.hadiahKejutanNilai;
    const log: RiwayatRintanganEntry = {
      id: entryId,
      tipe: 'hadiah_kejutan',
      judul: 'Hadiah Kejutan!',
      deskripsi: `Mendapat bonus +${config.hadiahKejutanNilai} poin kejutan.`,
      efekNilai: config.hadiahKejutanNilai,
      satuan: 'poin',
      timestampMs: nowMs,
    };
    peserta.riwayatRintangan.push(log);
    return log;
  }

  // Mode posisi untuk Hadiah Kejutan
  const posisiSebelum = peserta.posisi;
  const posisiSesudah = Math.min(100, posisiSebelum + config.hadiahKejutanNilai);
  const perubahan = posisiSesudah - posisiSebelum;
  peserta.posisi = posisiSesudah;

  if (perubahan > 0) {
    peserta.riwayatPosisi.push({
      urutan: peserta.riwayatPosisi.length + 1,
      questionId: 'hadiah_kejutan',
      posisiSebelum,
      perubahan,
      posisiSesudah,
      alasan: `Hadiah Kejutan (+${perubahan}%)`,
      timestampMs: nowMs,
    });
  }

  const log: RiwayatRintanganEntry = {
    id: entryId,
    tipe: 'hadiah_kejutan',
    judul: 'Hadiah Kejutan!',
    deskripsi: `Dorongan kejutan naik +${perubahan}% ketinggian!`,
    efekNilai: perubahan,
    satuan: '%',
    timestampMs: nowMs,
  };
  peserta.riwayatRintangan.push(log);
  return log;
}

export interface ProsesJawabanPanjatParams {
  peserta: PesertaPanjatState;
  presentasi: PresentasiSoalPanjat;
  choiceId?: string;
  fallbackJawabanKey?: string;
  config: KonfigurasiPanjatPinang;
  gameMulaiPadaMs: number;
  nowMs?: number;
  rngRintangan?: RngRintangan;
}

export interface HasilJawabanPanjat {
  benar: boolean;
  pilihanDipilih: OpsiPilihanPanjat;
  isBonusKulitPisang: boolean;
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
  pesertaUpdated: PesertaPanjatState;
}

/**
 * Mengkloning state peserta secara mendalam agar pembaruan berlangsung aman.
 */
export function clonePesertaPanjat(p: PesertaPanjatState): PesertaPanjatState {
  return {
    ...p,
    efekAktif: { ...p.efekAktif },
    riwayatPosisi: [...p.riwayatPosisi],
    riwayatRintangan: [...p.riwayatRintangan],
    riwayatJawaban: [...p.riwayatJawaban],
    antreanSoal: [...p.antreanSoal],
    presentasiAktif: p.presentasiAktif ? { ...p.presentasiAktif } : null,
  };
}

/**
 * Memproses satu jawaban siswa secara deterministik di backend.
 */
export function prosesJawabanPanjatPinang(
  params: ProsesJawabanPanjatParams
): HasilJawabanPanjat {
  const {
    peserta,
    presentasi,
    choiceId,
    fallbackJawabanKey,
    config,
    gameMulaiPadaMs,
    nowMs = Date.now(),
    rngRintangan = defaultRngRintangan,
  } = params;

  if (peserta.status === 'selesai' || peserta.posisi >= 100) {
    throw new Error('Anda sudah mencapai puncak 100% dan tidak dapat menjawab lagi.');
  }

  const cekPilihan = validasiPilihanDenganChoiceId(presentasi, choiceId, fallbackJawabanKey);
  if (!cekPilihan.valid || !cekPilihan.dipilih) {
    throw new Error('Pilihan jawaban tidak valid untuk soal yang aktif.');
  }

  const updated = clonePesertaPanjat(peserta);
  const benar = cekPilihan.benar;
  const waktuJawabMs = Math.max(1, nowMs - presentasi.ditampilkanPadaMs);

  updated.totalWaktuJawabMs += waktuJawabMs;
  updated.jumlahJawab += 1;
  updated.rataRataWaktuJawabMs = Math.round(updated.totalWaktuJawabMs / updated.jumlahJawab);

  // Konsumsi presentasi aktif agar tidak dapat diproses ulang
  updated.presentasiAktif = null;

  const posisiSebelum = updated.posisi;
  let perubahanPosisi = 0;
  let bonusStreakDidapat = 0;
  let bonusPeganganKuatDidapat = 0;
  let penaltiTiangLicin = 0;
  let perisaiDigunakan = false;
  let perisaiDiperoleh = false;
  let rintanganBaru: RiwayatRintanganEntry | null = null;

  if (presentasi.isBonusKulitPisang) {
    // Pertanyaan bonus Kulit Pisang: menjawab benar memberi perisai, salah tidak menurunkan posisi
    updated.efekAktif.menungguBonusKulitPisang = false;

    if (benar) {
      updated.totalBenar += 1;
      updated.efekAktif.perisaiKulitPisang = true;
      perisaiDiperoleh = true;
      const log: RiwayatRintanganEntry = {
        id: crypto.randomUUID(),
        tipe: 'kulit_pisang',
        judul: 'Perisai Kulit Pisang Diperoleh!',
        deskripsi: 'Berhasil menjawab soal bonus. Terlindungi dari 1 efek penurunan tambahan.',
        efekNilai: 1,
        satuan: 'perisai',
        timestampMs: nowMs,
      };
      updated.riwayatRintangan.push(log);
    } else {
      updated.totalSalah += 1;
      const log: RiwayatRintanganEntry = {
        id: crypto.randomUUID(),
        tipe: 'kulit_pisang',
        judul: 'Gagal Mendapat Perisai',
        deskripsi: 'Jawaban soal bonus belum tepat. Posisi tidak turun, namun tanpa perlindungan.',
        efekNilai: 0,
        satuan: 'perisai',
        timestampMs: nowMs,
      };
      updated.riwayatRintangan.push(log);
    }
  } else {
    // Pertanyaan reguler
    let delta = 0;
    const catatanAlasan: string[] = [];

    if (benar) {
      updated.totalBenar += 1;
      updated.streakSaatIni += 1;
      if (updated.streakSaatIni > updated.streakTertinggi) {
        updated.streakTertinggi = updated.streakSaatIni;
      }

      delta += config.naikBenar;
      catatanAlasan.push(`Benar +${config.naikBenar}%`);

      // Milestone bonus streak (hanya 1 kali per rangkaian streak)
      if (config.bonusStreakAktif) {
        if (updated.streakSaatIni === 3 && !updated.bonus3DalamStreak) {
          delta += config.bonusStreak3;
          bonusStreakDidapat += config.bonusStreak3;
          updated.bonus3DalamStreak = true;
          catatanAlasan.push(`Streak 3 +${config.bonusStreak3}%`);
        }
        if (updated.streakSaatIni === 5 && !updated.bonus5DalamStreak) {
          delta += config.bonusStreak5;
          bonusStreakDidapat += config.bonusStreak5;
          updated.bonus5DalamStreak = true;
          catatanAlasan.push(`Streak 5 +${config.bonusStreak5}%`);
        }
      }

      // Pegangan Kuat: bonus tambahan 1 kali pada jawaban benar
      if (updated.efekAktif.peganganKuat) {
        delta += config.bonusPeganganKuat;
        bonusPeganganKuatDidapat = config.bonusPeganganKuat;
        updated.efekAktif.peganganKuat = false;
        catatanAlasan.push(`Pegangan Kuat +${config.bonusPeganganKuat}%`);
      }

      // Melewati bagian tiang licin dengan aman jika menjawab benar
      if (updated.efekAktif.tiangLicin) {
        updated.efekAktif.tiangLicin = false;
      }
    } else {
      updated.totalSalah += 1;
      updated.streakSaatIni = 0;
      updated.bonus3DalamStreak = false;
      updated.bonus5DalamStreak = false;

      delta -= config.turunSalah;
      catatanAlasan.push(`Salah -${config.turunSalah}%`);

      // Cek Tiang Licin dan Perisai Kulit Pisang saat salah
      if (updated.efekAktif.tiangLicin) {
        updated.efekAktif.tiangLicin = false;
        if (updated.efekAktif.perisaiKulitPisang) {
          updated.efekAktif.perisaiKulitPisang = false;
          perisaiDigunakan = true;
          catatanAlasan.push('Perisai tahan Tiang Licin');
          updated.riwayatRintangan.push({
            id: crypto.randomUUID(),
            tipe: 'perisai_terpakai',
            judul: 'Perisai Kulit Pisang Aktif!',
            deskripsi: 'Berhasil menahan efek penurunan tambahan Tiang Licin.',
            efekNilai: 0,
            satuan: 'perisai',
            timestampMs: nowMs,
          });
        } else {
          delta -= config.penurunanTiangLicin;
          penaltiTiangLicin = config.penurunanTiangLicin;
          catatanAlasan.push(`Tiang Licin -${config.penurunanTiangLicin}%`);
        }
      }
    }

    // Batasi posisi selalu dalam rentang 0%..100%
    const posisiBaru = Math.max(0, Math.min(100, posisiSebelum + delta));
    perubahanPosisi = posisiBaru - posisiSebelum;
    updated.posisi = posisiBaru;

    updated.riwayatPosisi.push({
      urutan: updated.riwayatPosisi.length + 1,
      questionId: presentasi.questionId,
      posisiSebelum,
      perubahan: perubahanPosisi,
      posisiSesudah: posisiBaru,
      alasan: catatanAlasan.join(', '),
      timestampMs: nowMs,
    });

    // Putar rintangan jika masih dalam permainan (belum 100%)
    if (updated.posisi < 100) {
      rintanganBaru = putarRintanganBackend(updated, config, nowMs, rngRintangan);
    }
  }

  // Catat riwayat jawaban
  updated.riwayatJawaban.push({
    presentationId: presentasi.presentationId,
    questionId: presentasi.questionId,
    choiceId: cekPilihan.dipilih.choiceId,
    jawabanKey: cekPilihan.dipilih.key,
    benar,
    isBonusKulitPisang: presentasi.isBonusKulitPisang,
    waktuJawabMs,
    perubahanPosisi: updated.posisi - posisiSebelum,
    posisiSesudah: updated.posisi,
    timestampMs: nowMs,
  });

  // Cek apakah mencapai puncak 100% (baik dari jawaban maupun hadiah kejutan posisi)
  let selesaiBaru = false;
  if (updated.posisi >= 100 && updated.status !== 'selesai') {
    updated.posisi = 100;
    updated.status = 'selesai';
    updated.selesaiPada = nowMs;
    updated.waktuSelesaiMs = Math.max(1, nowMs - gameMulaiPadaMs);
    updated.efekAktif.menungguBonusKulitPisang = false;
    updated.efekAktif.tiangLicin = false;
    selesaiBaru = true;
  }

  return {
    benar,
    pilihanDipilih: cekPilihan.dipilih,
    isBonusKulitPisang: presentasi.isBonusKulitPisang,
    posisiSebelum,
    posisiBaru: updated.posisi,
    perubahanPosisi: updated.posisi - posisiSebelum,
    bonusStreakDidapat,
    bonusPeganganKuatDidapat,
    penaltiTiangLicin,
    perisaiDigunakan,
    perisaiDiperoleh,
    rintanganBaru,
    selesaiBaru,
    waktuJawabMs,
    pesertaUpdated: updated,
  };
}

/**
 * Mengurutkan leaderboard Panjat Pinang sesuai 5 kriteria resmi:
 * 1. Pemain selesai (100%) di atas pemain yang belum selesai.
 * 2. Sesama selesai: waktu penyelesaian tercepat (waktuSelesaiMs asc).
 * 3. Belum selesai: posisi ketinggian tertinggi (posisi desc).
 * 4. Posisi sama: jumlah jawaban benar terbanyak (totalBenar desc).
 * 5. Masih sama: rata-rata waktu menjawab tercepat (rataRataWaktuJawabMs asc).
 * 6. Tie-break konsisten: poinBonus desc -> nama asc -> id asc.
 */
export function urutkanLeaderboardPanjatPinang(
  pesertaList: PesertaPanjatState[]
): PesertaPanjatState[] {
  return [...pesertaList].sort((a, b) => {
    const aSelesai = a.status === 'selesai' || a.posisi >= 100;
    const bSelesai = b.status === 'selesai' || b.posisi >= 100;

    // 1. Selesai di atas belum selesai
    if (aSelesai !== bSelesai) {
      return aSelesai ? -1 : 1;
    }

    // 2. Sesama selesai: waktu penyelesaian paling awal
    if (aSelesai && bSelesai) {
      const tA = a.waktuSelesaiMs ?? Number.MAX_SAFE_INTEGER;
      const tB = b.waktuSelesaiMs ?? Number.MAX_SAFE_INTEGER;
      if (tA !== tB) {
        return tA - tB;
      }
    }

    // 3. Posisi ketinggian tertinggi
    if (b.posisi !== a.posisi) {
      return b.posisi - a.posisi;
    }

    // 4. Jumlah jawaban benar terbanyak
    if (b.totalBenar !== a.totalBenar) {
      return b.totalBenar - a.totalBenar;
    }

    // 5. Rata-rata waktu menjawab tercepat
    const rA = a.jumlahJawab > 0 ? a.rataRataWaktuJawabMs : Number.MAX_SAFE_INTEGER;
    const rB = b.jumlahJawab > 0 ? b.rataRataWaktuJawabMs : Number.MAX_SAFE_INTEGER;
    if (rA !== rB) {
      return rA - rB;
    }

    // 6. Tie-break deterministik konsisten
    if (b.poinBonus !== a.poinBonus) {
      return b.poinBonus - a.poinBonus;
    }

    const cmpNama = a.nama.localeCompare(b.nama);
    if (cmpNama !== 0) {
      return cmpNama;
    }

    return a.id.localeCompare(b.id);
  });
}
