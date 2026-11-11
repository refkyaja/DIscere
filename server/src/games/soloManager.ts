import { prisma } from '../db.js';
import {
  TimTarikTambang,
  HasilPemenang,
  KonfigurasiTarikTambang,
  JenisPowerUpTarik,
  PresentasiSoalTarik,
  SoalBankTarikTambang,
  POSISI_AWAL_TALI,
  INFO_POWERUP_TARIK,
  bangunKonfigurasiTarikTambang,
  filterBankSoalSetara,
  ambilPasanganSoalSetara,
  buatPresentasiSoalTarik,
  serialisasiSoalUntukClient,
  validasiJawabanPresentasi,
  perbaruiStreakIndividu,
  tentukanHadiahPowerUp,
  evaluasiRondeTarikTambang,
  cekKondisiSelesai,
  tentukanPemenang,
  normalisasiKodeTim,
} from './tarikTambang.js';

export type GameState = 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED';
export type SoalSesi = SoalBankTarikTambang;

export interface StatistikPemainSolo {
  tim: TimTarikTambang;
  nama: string;
  totalBenar: number;
  totalSalah: number;
  jumlahJawab: number;
  akurasiPersen: number;
  streakSaatIni: number;
  streakTertinggi: number;
  milestone3Sudah: boolean;
  milestone5Sudah: boolean;
  totalBonusStreak: number;
  totalWaktuJawabMs: number;
  rataRataWaktuJawabMs: number;
  powerUpTersedia: JenisPowerUpTarik | null;
  powerUpAktifRondeBerikutnya: JenisPowerUpTarik | null;
  jumlahPowerUpDipakai: number;
  riwayatPowerUp: Array<{ ronde: number; tipe: JenisPowerUpTarik }>;
}

export interface LogJawabanItem {
  questionId: string;
  nomorSoal: number;
  nomorRonde: number;
  teksSoal: string;
  tim: TimTarikTambang;
  jawabanDipilih: string;
  jawabanBenar: string;
  benar: boolean;
  waktuJawabMs: number;
  posisiSetelah: number;
}

export interface RiwayatRondeSolo {
  nomorRonde: number;
  tim1QuestionId: string;
  tim2QuestionId: string;
  tim1Teks: string;
  tim2Teks: string;
  tim1Benar: boolean;
  tim2Benar: boolean;
  tim1JawabanKode: string | null;
  tim2JawabanKode: string | null;
  tim1Kunci: string;
  tim2Kunci: string;
  tim1Penjelasan: string | null;
  tim2Penjelasan: string | null;
  posisiSebelum: number;
  perubahanTali: number;
  posisiSesudah: number;
  selisihKekuatan: number;
  bonusStreakNet: number;
  bonusPowerUpNet: number;
  powerUpTim1Dipakai: JenisPowerUpTarik | null;
  powerUpTim2Dipakai: JenisPowerUpTarik | null;
}

export interface RondeSoloAktif {
  nomorRonde: number;
  soalTim1: PresentasiSoalTarik;
  soalTim2: PresentasiSoalTarik;
  dimulaiPadaMs: number;
  berakhirPadaMs: number;
  sisaWaktuMsSaatJeda?: number;
  jawabanTim1: {
    choiceId?: string;
    kodeDipilih: string;
    benar: boolean;
    waktuJawabMs: number;
  } | null;
  jawabanTim2: {
    choiceId?: string;
    kodeDipilih: string;
    benar: boolean;
    waktuJawabMs: number;
  } | null;
  powerUpTim1Dipakai: JenisPowerUpTarik | null;
  powerUpTim2Dipakai: JenisPowerUpTarik | null;
  ditutup: boolean;
  sedangDiproses: boolean;
  hasilRonde: RiwayatRondeSolo | null;
}

export interface LaporanTarikTambangSolo {
  sessionId: string;
  playMode: 'SOLO';
  templateId: string;
  templateJudul: string;
  konfigurasi: KonfigurasiTarikTambang;
  timMenang: HasilPemenang;
  posisiAkhir: number;
  jumlahRonde: number;
  skorMerah: number;
  skorPutih: number;
  akurasiTim1: number;
  akurasiTim2: number;
  totalBenar: number;
  totalSalah: number;
  bonusStreakTim1: number;
  bonusStreakTim2: number;
  penggunaanPowerUp: {
    tim1: Array<{ ronde: number; tipe: JenisPowerUpTarik; nama: string }>;
    tim2: Array<{ ronde: number; tipe: JenisPowerUpTarik; nama: string }>;
  };
  durasiPermainanMs: number;
  riwayatTali: Array<{ ronde: number; posisi: number; perubahan: number }>;
  riwayatRonde: RiwayatRondeSolo[];
  statistikPemain: StatistikPemainSolo[];
}

export interface ActiveSoloSession {
  sessionId: string;
  playMode: 'SOLO';
  templateId: string;
  templateJudul: string;
  hostId: string;
  state: GameState;
  config: KonfigurasiTarikTambang;
  poolSetara: SoalBankTarikTambang[];
  antreanSoal: SoalBankTarikTambang[];
  terakhirTim1Id?: string;
  terakhirTim2Id?: string;
  nomorRondeCounter: number;
  taliPosition: number;
  skorMerah: number;
  skorPutih: number;
  totalSoal: number;
  questions: SoalBankTarikTambang[];
  tim1: StatistikPemainSolo;
  tim2: StatistikPemainSolo;
  rondeAktif: RondeSoloAktif | null;
  rondeMenungguLanjut: boolean;
  riwayatRonde: RiwayatRondeSolo[];
  riwayatTali: Array<{ ronde: number; posisi: number; perubahan: number }>;
  logJawaban: LogJawabanItem[];
  questionStatsMap: Map<string, { jumlahBenar: number; jumlahSalah: number }>;
  waktuMulaiMs: number | null;
  waktuSelesaiMs: number | null;
  hasil?: LaporanTarikTambangSolo;
}

function buatStatistikPemainAwal(tim: TimTarikTambang, nama: string): StatistikPemainSolo {
  return {
    tim,
    nama,
    totalBenar: 0,
    totalSalah: 0,
    jumlahJawab: 0,
    akurasiPersen: 0,
    streakSaatIni: 0,
    streakTertinggi: 0,
    milestone3Sudah: false,
    milestone5Sudah: false,
    totalBonusStreak: 0,
    totalWaktuJawabMs: 0,
    rataRataWaktuJawabMs: 0,
    powerUpTersedia: null,
    powerUpAktifRondeBerikutnya: null,
    jumlahPowerUpDipakai: 0,
    riwayatPowerUp: [],
  };
}

const sesiSoloMap = new Map<string, ActiveSoloSession>();

function siapkanRondeBerikutnya(sesi: ActiveSoloSession): RondeSoloAktif {
  const { soalTim1, soalTim2, antreanSisa } = ambilPasanganSoalSetara(
    sesi.poolSetara,
    sesi.antreanSoal,
    sesi.terakhirTim1Id,
    sesi.terakhirTim2Id,
    true
  );

  sesi.antreanSoal = antreanSisa;
  sesi.terakhirTim1Id = soalTim1.id;
  sesi.terakhirTim2Id = soalTim2.id;
  sesi.nomorRondeCounter += 1;

  const now = Date.now();
  const durasiMs = sesi.config.durasiRonde * 1000;

  const pu1 = sesi.tim1.powerUpAktifRondeBerikutnya;
  const pu2 = sesi.tim2.powerUpAktifRondeBerikutnya;
  sesi.tim1.powerUpAktifRondeBerikutnya = null;
  sesi.tim2.powerUpAktifRondeBerikutnya = null;

  if (pu1) {
    sesi.tim1.jumlahPowerUpDipakai += 1;
    sesi.tim1.riwayatPowerUp.push({ ronde: sesi.nomorRondeCounter, tipe: pu1 });
  }
  if (pu2) {
    sesi.tim2.jumlahPowerUpDipakai += 1;
    sesi.tim2.riwayatPowerUp.push({ ronde: sesi.nomorRondeCounter, tipe: pu2 });
  }

  const ronde: RondeSoloAktif = {
    nomorRonde: sesi.nomorRondeCounter,
    soalTim1: buatPresentasiSoalTarik(soalTim1, sesi.config.kesulitan, true),
    soalTim2: buatPresentasiSoalTarik(soalTim2, sesi.config.kesulitan, true),
    dimulaiPadaMs: now,
    berakhirPadaMs: now + durasiMs,
    jawabanTim1: null,
    jawabanTim2: null,
    powerUpTim1Dipakai: pu1,
    powerUpTim2Dipakai: pu2,
    ditutup: false,
    sedangDiproses: false,
    hasilRonde: null,
  };

  sesi.rondeAktif = ronde;
  sesi.rondeMenungguLanjut = false;
  return ronde;
}

function bangunLaporanAkhirSolo(sesi: ActiveSoloSession): LaporanTarikTambangSolo {
  const timMenang = tentukanPemenang(sesi.taliPosition);
  const totalBenar = sesi.tim1.totalBenar + sesi.tim2.totalBenar;
  const totalSalah = sesi.tim1.totalSalah + sesi.tim2.totalSalah;

  const akurasi1 =
    sesi.tim1.jumlahJawab > 0
      ? Math.round((sesi.tim1.totalBenar / sesi.tim1.jumlahJawab) * 100)
      : 0;
  const akurasi2 =
    sesi.tim2.jumlahJawab > 0
      ? Math.round((sesi.tim2.totalBenar / sesi.tim2.jumlahJawab) * 100)
      : 0;

  sesi.tim1.akurasiPersen = akurasi1;
  sesi.tim1.rataRataWaktuJawabMs =
    sesi.tim1.jumlahJawab > 0 ? Math.round(sesi.tim1.totalWaktuJawabMs / sesi.tim1.jumlahJawab) : 0;
  sesi.tim2.akurasiPersen = akurasi2;
  sesi.tim2.rataRataWaktuJawabMs =
    sesi.tim2.jumlahJawab > 0 ? Math.round(sesi.tim2.totalWaktuJawabMs / sesi.tim2.jumlahJawab) : 0;

  const endMs = sesi.waktuSelesaiMs ?? Date.now();
  const durasiPermainanMs = sesi.waktuMulaiMs ? Math.max(0, endMs - sesi.waktuMulaiMs) : 0;

  return {
    sessionId: sesi.sessionId,
    playMode: 'SOLO',
    templateId: sesi.templateId,
    templateJudul: sesi.templateJudul,
    konfigurasi: sesi.config,
    timMenang,
    posisiAkhir: sesi.taliPosition,
    jumlahRonde: sesi.riwayatRonde.length,
    skorMerah: sesi.skorMerah,
    skorPutih: sesi.skorPutih,
    akurasiTim1: akurasi1,
    akurasiTim2: akurasi2,
    totalBenar,
    totalSalah,
    bonusStreakTim1: sesi.tim1.totalBonusStreak,
    bonusStreakTim2: sesi.tim2.totalBonusStreak,
    penggunaanPowerUp: {
      tim1: sesi.tim1.riwayatPowerUp.map((r) => ({
        ...r,
        nama: INFO_POWERUP_TARIK[r.tipe].nama,
      })),
      tim2: sesi.tim2.riwayatPowerUp.map((r) => ({
        ...r,
        nama: INFO_POWERUP_TARIK[r.tipe].nama,
      })),
    },
    durasiPermainanMs,
    riwayatTali: sesi.riwayatTali,
    riwayatRonde: sesi.riwayatRonde,
    statistikPemain: [sesi.tim1, sesi.tim2],
  };
}

function evaluasiDanTutupRondeInternal(sesi: ActiveSoloSession): {
  hasilRonde: RiwayatRondeSolo;
  selesai: boolean;
} {
  const ronde = sesi.rondeAktif!;
  if (ronde.ditutup && ronde.hasilRonde) {
    return {
      hasilRonde: ronde.hasilRonde,
      selesai: sesi.state === 'FINISHED',
    };
  }

  ronde.sedangDiproses = true;
  ronde.ditutup = true;

  const j1 = ronde.jawabanTim1;
  const j2 = ronde.jawabanTim2;
  const tim1Benar = Boolean(j1?.benar);
  const tim2Benar = Boolean(j2?.benar);

  // Perbarui statistik jawaban tim 1 (termasuk tidak menjawab = gagal / reset streak)
  sesi.tim1.jumlahJawab += 1;
  if (tim1Benar) {
    sesi.tim1.totalBenar += 1;
    sesi.tim1.totalWaktuJawabMs += j1?.waktuJawabMs ?? 0;
  } else {
    sesi.tim1.totalSalah += 1;
    if (j1) sesi.tim1.totalWaktuJawabMs += j1.waktuJawabMs;
  }

  // Perbarui statistik jawaban tim 2
  sesi.tim2.jumlahJawab += 1;
  if (tim2Benar) {
    sesi.tim2.totalBenar += 1;
    sesi.tim2.totalWaktuJawabMs += j2?.waktuJawabMs ?? 0;
  } else {
    sesi.tim2.totalSalah += 1;
    if (j2) sesi.tim2.totalWaktuJawabMs += j2.waktuJawabMs;
  }

  // Streak individu
  const st1 = perbaruiStreakIndividu({
    streakSaatIni: sesi.tim1.streakSaatIni,
    streakTertinggi: sesi.tim1.streakTertinggi,
    milestone3SudahDapat: sesi.tim1.milestone3Sudah,
    milestone5SudahDapat: sesi.tim1.milestone5Sudah,
    benar: tim1Benar,
    bonusAktif: sesi.config.bonusAktif,
  });
  sesi.tim1.streakSaatIni = st1.streakBaru;
  sesi.tim1.streakTertinggi = st1.streakTertinggiBaru;
  sesi.tim1.milestone3Sudah = st1.milestone3SudahDapat;
  sesi.tim1.milestone5Sudah = st1.milestone5SudahDapat;
  sesi.tim1.totalBonusStreak += st1.bonusDidapat;

  const st2 = perbaruiStreakIndividu({
    streakSaatIni: sesi.tim2.streakSaatIni,
    streakTertinggi: sesi.tim2.streakTertinggi,
    milestone3SudahDapat: sesi.tim2.milestone3Sudah,
    milestone5SudahDapat: sesi.tim2.milestone5Sudah,
    benar: tim2Benar,
    bonusAktif: sesi.config.bonusAktif,
  });
  sesi.tim2.streakSaatIni = st2.streakBaru;
  sesi.tim2.streakTertinggi = st2.streakTertinggiBaru;
  sesi.tim2.milestone3Sudah = st2.milestone3SudahDapat;
  sesi.tim2.milestone5Sudah = st2.milestone5SudahDapat;
  sesi.tim2.totalBonusStreak += st2.bonusDidapat;

  const posisiSebelum = sesi.taliPosition;
  const evalRonde = evaluasiRondeTarikTambang({
    mode: 'SOLO',
    posisiLama: posisiSebelum,
    tim1Benar: tim1Benar ? 1 : 0,
    tim1TotalAnggota: 1,
    tim2Benar: tim2Benar ? 1 : 0,
    tim2TotalAnggota: 1,
    bonusStreakTim1: st1.bonusDidapat,
    bonusStreakTim2: st2.bonusDidapat,
    bonusAktif: sesi.config.bonusAktif,
    powerUpTim1Aktif: ronde.powerUpTim1Dipakai,
    powerUpTim2Aktif: ronde.powerUpTim2Dipakai,
  });

  sesi.taliPosition = evalRonde.posisiBaru;
  sesi.tim1.akurasiPersen =
    sesi.tim1.jumlahJawab > 0
      ? Math.round((sesi.tim1.totalBenar / sesi.tim1.jumlahJawab) * 100)
      : 0;
  sesi.tim2.akurasiPersen =
    sesi.tim2.jumlahJawab > 0
      ? Math.round((sesi.tim2.totalBenar / sesi.tim2.jumlahJawab) * 100)
      : 0;

  // Hadiah power-up adil apabila slot kosong & mencapai milestone streak
  sesi.tim1.powerUpTersedia = tentukanHadiahPowerUp({
    powerUpAktif: sesi.config.powerUpAktif,
    bankSaatIni: sesi.tim1.powerUpTersedia,
    streakBaru: sesi.tim1.streakSaatIni,
    akurasiRondePersen: 0,
  });
  sesi.tim2.powerUpTersedia = tentukanHadiahPowerUp({
    powerUpAktif: sesi.config.powerUpAktif,
    bankSaatIni: sesi.tim2.powerUpTersedia,
    streakBaru: sesi.tim2.streakSaatIni,
    akurasiRondePersen: 0,
  });

  const riwayatItem: RiwayatRondeSolo = {
    nomorRonde: ronde.nomorRonde,
    tim1QuestionId: ronde.soalTim1.questionId,
    tim2QuestionId: ronde.soalTim2.questionId,
    tim1Teks: ronde.soalTim1.teks,
    tim2Teks: ronde.soalTim2.teks,
    tim1Benar,
    tim2Benar,
    tim1JawabanKode: j1?.kodeDipilih ?? null,
    tim2JawabanKode: j2?.kodeDipilih ?? null,
    tim1Kunci: ronde.soalTim1.jawabanBenarKode,
    tim2Kunci: ronde.soalTim2.jawabanBenarKode,
    tim1Penjelasan: ronde.soalTim1.penjelasan,
    tim2Penjelasan: ronde.soalTim2.penjelasan,
    posisiSebelum,
    perubahanTali: evalRonde.perubahanTali,
    posisiSesudah: evalRonde.posisiBaru,
    selisihKekuatan: evalRonde.selisihKekuatan,
    bonusStreakNet: evalRonde.bonusStreakNet,
    bonusPowerUpNet: evalRonde.bonusPowerUpNet,
    powerUpTim1Dipakai: ronde.powerUpTim1Dipakai,
    powerUpTim2Dipakai: ronde.powerUpTim2Dipakai,
  };

  ronde.hasilRonde = riwayatItem;
  ronde.sedangDiproses = false;
  sesi.riwayatRonde.push(riwayatItem);
  sesi.riwayatTali.push({
    ronde: ronde.nomorRonde,
    posisi: evalRonde.posisiBaru,
    perubahan: evalRonde.perubahanTali,
  });

  // Catat log jawaban & statistik soal
  const qStat1 = sesi.questionStatsMap.get(ronde.soalTim1.questionId) || {
    jumlahBenar: 0,
    jumlahSalah: 0,
  };
  if (tim1Benar) qStat1.jumlahBenar += 1;
  else qStat1.jumlahSalah += 1;
  sesi.questionStatsMap.set(ronde.soalTim1.questionId, qStat1);

  const qStat2 = sesi.questionStatsMap.get(ronde.soalTim2.questionId) || {
    jumlahBenar: 0,
    jumlahSalah: 0,
  };
  if (tim2Benar) qStat2.jumlahBenar += 1;
  else qStat2.jumlahSalah += 1;
  sesi.questionStatsMap.set(ronde.soalTim2.questionId, qStat2);

  sesi.logJawaban.push({
    questionId: ronde.soalTim1.questionId,
    nomorSoal: ronde.nomorRonde,
    nomorRonde: ronde.nomorRonde,
    teksSoal: ronde.soalTim1.teks,
    tim: 'merah',
    jawabanDipilih: j1?.kodeDipilih || '-',
    jawabanBenar: ronde.soalTim1.jawabanBenarKode,
    benar: tim1Benar,
    waktuJawabMs: j1?.waktuJawabMs ?? 0,
    posisiSetelah: evalRonde.posisiBaru,
  });
  sesi.logJawaban.push({
    questionId: ronde.soalTim2.questionId,
    nomorSoal: ronde.nomorRonde,
    nomorRonde: ronde.nomorRonde,
    teksSoal: ronde.soalTim2.teks,
    tim: 'putih',
    jawabanDipilih: j2?.kodeDipilih || '-',
    jawabanBenar: ronde.soalTim2.jawabanBenarKode,
    benar: tim2Benar,
    waktuJawabMs: j2?.waktuJawabMs ?? 0,
    posisiSetelah: evalRonde.posisiBaru,
  });

  const selesai = cekKondisiSelesai(evalRonde.posisiBaru);
  if (selesai) {
    sesi.state = 'FINISHED';
    sesi.waktuSelesaiMs = Date.now();
    sesi.rondeMenungguLanjut = false;
    sesi.hasil = bangunLaporanAkhirSolo(sesi);
  } else {
    sesi.rondeMenungguLanjut = true;
  }

  return { hasilRonde: riwayatItem, selesai };
}

export const soloManager = {
  inisialisasiSesi(
    sessionId: string,
    hostId: string,
    template: { id: string; judul: string },
    questions: SoalBankTarikTambang[],
    rawConfig?: Partial<KonfigurasiTarikTambang>
  ): ActiveSoloSession {
    const config = bangunKonfigurasiTarikTambang(rawConfig);
    const poolSetara = filterBankSoalSetara(questions, config.kesulitan);

    const sesi: ActiveSoloSession = {
      sessionId,
      playMode: 'SOLO',
      templateId: template.id,
      templateJudul: template.judul,
      hostId,
      state: 'READY',
      config,
      poolSetara,
      antreanSoal: [],
      nomorRondeCounter: 0,
      taliPosition: POSISI_AWAL_TALI,
      skorMerah: 0,
      skorPutih: 0,
      totalSoal: poolSetara.length,
      questions: poolSetara,
      tim1: buatStatistikPemainAwal('merah', config.namaTim1),
      tim2: buatStatistikPemainAwal('putih', config.namaTim2),
      rondeAktif: null,
      rondeMenungguLanjut: false,
      riwayatRonde: [],
      riwayatTali: [{ ronde: 0, posisi: POSISI_AWAL_TALI, perubahan: 0 }],
      logJawaban: [],
      questionStatsMap: new Map(),
      waktuMulaiMs: null,
      waktuSelesaiMs: null,
    };

    sesiSoloMap.set(sessionId, sesi);
    return sesi;
  },

  dapatkanSesi(sessionId: string, hostId?: string): ActiveSoloSession | undefined {
    const sesi = sesiSoloMap.get(sessionId);
    if (!sesi) return undefined;
    if (hostId && sesi.hostId !== hostId) return undefined;
    return sesi;
  },

  mulaiSesi(sessionId: string, hostId: string): ActiveSoloSession {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) throw new Error('Sesi tidak ditemukan atau Anda tidak berwenang.');
    if (sesi.state === 'FINISHED') throw new Error('Permainan pada sesi ini sudah selesai.');

    sesi.state = 'PLAYING';
    if (!sesi.waktuMulaiMs) sesi.waktuMulaiMs = Date.now();
    if (!sesi.rondeAktif || sesi.rondeAktif.ditutup) {
      siapkanRondeBerikutnya(sesi);
    }
    return sesi;
  },

  ubahStateSesi(
    sessionId: string,
    hostId: string,
    stateBaru: 'PLAYING' | 'PAUSED'
  ): ActiveSoloSession {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) throw new Error('Sesi tidak ditemukan atau Anda tidak berwenang.');
    if (sesi.state === 'FINISHED') throw new Error('Permainan pada sesi ini sudah selesai.');

    if (stateBaru === 'PAUSED' && sesi.state === 'PLAYING' && sesi.rondeAktif && !sesi.rondeAktif.ditutup) {
      sesi.rondeAktif.sisaWaktuMsSaatJeda = Math.max(
        1000,
        sesi.rondeAktif.berakhirPadaMs - Date.now()
      );
    } else if (stateBaru === 'PLAYING' && sesi.state === 'PAUSED' && sesi.rondeAktif && !sesi.rondeAktif.ditutup) {
      const sisa = sesi.rondeAktif.sisaWaktuMsSaatJeda ?? sesi.config.durasiRonde * 1000;
      sesi.rondeAktif.berakhirPadaMs = Date.now() + sisa;
      sesi.rondeAktif.sisaWaktuMsSaatJeda = undefined;
    }

    sesi.state = stateBaru;
    return sesi;
  },

  aktifkanPowerUp(
    sessionId: string,
    hostId: string,
    timRaw: string
  ): {
    tim: TimTarikTambang;
    powerUp: JenisPowerUpTarik;
    sesi: ActiveSoloSession;
  } {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) throw new Error('Sesi tidak ditemukan atau Anda tidak berwenang.');
    if (sesi.state !== 'PLAYING') {
      throw new Error('Power-up hanya dapat diaktifkan saat permainan berlangsung.');
    }
    if (!sesi.config.powerUpAktif) {
      throw new Error('Fitur power-up tidak diaktifkan pada sesi ini.');
    }

    const tim = normalisasiKodeTim(timRaw);
    if (!tim) throw new Error('Kode tim tidak valid.');

    const stat = tim === 'merah' ? sesi.tim1 : sesi.tim2;
    if (!stat.powerUpTersedia) {
      throw new Error('Tim belum memiliki power-up untuk diaktifkan.');
    }

    const powerUp = stat.powerUpTersedia;
    const ronde = sesi.rondeAktif;

    // Jika ronde sedang berjalan dan tim belum menjawab & belum mengaktifkan power-up pada ronde ini, aktifkan langsung atau untuk ronde berikutnya
    if (ronde && !ronde.ditutup) {
      const sudahJawab = tim === 'merah' ? Boolean(ronde.jawabanTim1) : Boolean(ronde.jawabanTim2);
      const sudahPakaiRondeIni =
        tim === 'merah' ? ronde.powerUpTim1Dipakai !== null : ronde.powerUpTim2Dipakai !== null;

      if (!sudahJawab && !sudahPakaiRondeIni) {
        stat.powerUpTersedia = null;
        if (tim === 'merah') ronde.powerUpTim1Dipakai = powerUp;
        else ronde.powerUpTim2Dipakai = powerUp;
        stat.jumlahPowerUpDipakai += 1;
        stat.riwayatPowerUp.push({ ronde: ronde.nomorRonde, tipe: powerUp });
        return { tim, powerUp, sesi };
      }
    }

    if (stat.powerUpAktifRondeBerikutnya !== null) {
      throw new Error('Sudah ada power-up yang diaktifkan untuk ronde berikutnya (maksimal 1).');
    }

    stat.powerUpTersedia = null;
    stat.powerUpAktifRondeBerikutnya = powerUp;
    return { tim, powerUp, sesi };
  },

  prosesJawaban(
    sessionId: string,
    hostId: string,
    input: {
      tim: string;
      presentationId?: string;
      questionId?: string;
      choiceId?: string;
      jawabanDipilih?: string;
    }
  ): {
    sesi: ActiveSoloSession;
    tim: TimTarikTambang;
    sudahMenjawab: boolean;
    rondeSelesai: boolean;
    hasilRonde: RiwayatRondeSolo | null;
    selesai: boolean;
    benar: boolean;
  } {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) throw new Error('Sesi tidak ditemukan atau Anda tidak berwenang.');
    if (sesi.state !== 'PLAYING') {
      throw new Error('Permainan sedang tidak aktif (READY/PAUSED/FINISHED).');
    }

    const ronde = sesi.rondeAktif;
    if (!ronde || ronde.ditutup || ronde.sedangDiproses) {
      throw new Error('Ronde aktif sudah ditutup. Tunggu ronde berikutnya dimulai.');
    }

    // Tolak jawaban terlambat melewati batas waktu ronde + toleransi jaringan 600ms
    if (Date.now() > ronde.berakhirPadaMs + 600) {
      throw new Error('Waktu ronde telah habis. Jawaban terlambat ditolak.');
    }

    const tim = normalisasiKodeTim(input.tim);
    if (!tim) throw new Error('Identitas tim tidak valid.');

    const sudahJawabSisi =
      tim === 'merah' ? ronde.jawabanTim1 !== null : ronde.jawabanTim2 !== null;
    if (sudahJawabSisi) {
      throw new Error(
        `Sisi ${tim === 'merah' ? sesi.config.namaTim1 : sesi.config.namaTim2} sudah mengunci jawaban pada ronde ini.`
      );
    }

    const presTarget = tim === 'merah' ? ronde.soalTim1 : ronde.soalTim2;
    const presLawan = tim === 'merah' ? ronde.soalTim2 : ronde.soalTim1;

    // Anti-lintas-sisi: tolak jika presentationId adalah milik tim lawan
    if (input.presentationId && input.presentationId === presLawan.presentationId) {
      throw new Error('Tidak dapat menjawab soal milik sisi lawan.');
    }
    if (input.presentationId && input.presentationId !== presTarget.presentationId) {
      throw new Error('Soal yang dijawab bukan milik ronde aktif.');
    }
    if (
      input.questionId &&
      input.questionId !== 'undefined' &&
      input.questionId !== 'null' &&
      input.questionId !== presTarget.questionId
    ) {
      throw new Error('ID soal tidak cocok dengan soal aktif tim ini.');
    }

    const hasilVal = validasiJawabanPresentasi(presTarget, {
      choiceId: input.choiceId,
      jawaban: input.jawabanDipilih,
    });

    const now = Date.now();
    const recordJawaban = {
      choiceId: input.choiceId,
      kodeDipilih: hasilVal.kodeDipilih,
      benar: hasilVal.benar,
      waktuJawabMs: Math.max(100, now - ronde.dimulaiPadaMs),
    };

    if (tim === 'merah') {
      ronde.jawabanTim1 = recordJawaban;
      if (hasilVal.benar) sesi.skorMerah += 1;
    } else {
      ronde.jawabanTim2 = recordJawaban;
      if (hasilVal.benar) sesi.skorPutih += 1;
    }

    // Jika kedua sisi sudah menjawab, langsung evaluasi dan tutup ronde
    if (ronde.jawabanTim1 && ronde.jawabanTim2) {
      const { hasilRonde, selesai } = evaluasiDanTutupRondeInternal(sesi);
      return {
        sesi,
        tim,
        sudahMenjawab: true,
        rondeSelesai: true,
        hasilRonde,
        selesai,
        benar: hasilVal.benar,
      };
    }

    return {
      sesi,
      tim,
      sudahMenjawab: true,
      rondeSelesai: false,
      hasilRonde: null,
      selesai: false,
      benar: hasilVal.benar,
    };
  },

  tutupRonde(
    sessionId: string,
    hostId: string
  ): {
    sesi: ActiveSoloSession;
    hasilRonde: RiwayatRondeSolo;
    selesai: boolean;
  } {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) throw new Error('Sesi tidak ditemukan atau Anda tidak berwenang.');
    if (!sesi.rondeAktif) throw new Error('Belum ada ronde aktif.');

    const { hasilRonde, selesai } = evaluasiDanTutupRondeInternal(sesi);
    return { sesi, hasilRonde, selesai };
  },

  lanjutRondeBerikutnya(sessionId: string, hostId: string): ActiveSoloSession {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) throw new Error('Sesi tidak ditemukan atau Anda tidak berwenang.');
    if (sesi.state === 'FINISHED') throw new Error('Permainan sudah selesai.');
    if (sesi.state !== 'PLAYING') throw new Error('Permainan tidak sedang berjalan.');

    if (sesi.rondeAktif && !sesi.rondeAktif.ditutup) {
      const { selesai } = evaluasiDanTutupRondeInternal(sesi);
      if (selesai) return sesi;
    }

    siapkanRondeBerikutnya(sesi);
    return sesi;
  },

  selesaikanSesi(sessionId: string, hostId: string): ActiveSoloSession {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) throw new Error('Sesi tidak ditemukan atau Anda tidak berwenang.');

    sesi.state = 'FINISHED';
    sesi.waktuSelesaiMs = Date.now();
    sesi.rondeMenungguLanjut = false;
    sesi.hasil = bangunLaporanAkhirSolo(sesi);
    return sesi;
  },

  serialisasiUntukClient(sesi: ActiveSoloSession) {
    const r = sesi.rondeAktif;
    const sedangTampil =
      (sesi.state === 'PLAYING' || sesi.state === 'PAUSED') && r !== null;

    const soalTim1Client =
      sedangTampil && r
        ? serialisasiSoalUntukClient(
            r.soalTim1,
            r.nomorRonde,
            r.berakhirPadaMs,
            sesi.config.durasiRonde
          )
        : null;

    const soalTim2Client =
      sedangTampil && r
        ? serialisasiSoalUntukClient(
            r.soalTim2,
            r.nomorRonde,
            r.berakhirPadaMs,
            sesi.config.durasiRonde
          )
        : null;

    return {
      sessionId: sesi.sessionId,
      game: 'tarik_tambang' as const,
      mode: 'solo' as const,
      playMode: 'SOLO' as const,
      templateId: sesi.templateId,
      templateJudul: sesi.templateJudul,
      state: sesi.state,
      config: sesi.config,
      totalSoal: sesi.totalSoal,
      nomorRonde: r?.nomorRonde ?? sesi.nomorRondeCounter,
      taliPosition: sesi.taliPosition,
      skorMerah: sesi.skorMerah,
      skorPutih: sesi.skorPutih,
      tim1: {
        ...sesi.tim1,
      },
      tim2: {
        ...sesi.tim2,
      },
      rondeSaatIni:
        sedangTampil && r
          ? {
              nomorRonde: r.nomorRonde,
              dimulaiPadaMs: r.dimulaiPadaMs,
              berakhirPadaMs: r.berakhirPadaMs,
              sisaWaktuMsSaatJeda: r.sisaWaktuMsSaatJeda,
              ditutup: r.ditutup,
              tim1SudahJawab: r.jawabanTim1 !== null,
              tim2SudahJawab: r.jawabanTim2 !== null,
              powerUpTim1Dipakai: r.powerUpTim1Dipakai,
              powerUpTim2Dipakai: r.powerUpTim2Dipakai,
              soalTim1: soalTim1Client,
              soalTim2: soalTim2Client,
              // Hanya kirim kunci jawaban & evaluasi SETELAH ronde ditutup!
              hasilRonde: r.ditutup ? r.hasilRonde : null,
            }
          : null,
      // Alias kompatibilitas untuk test/pemanggil lama
      soalSaatIni: soalTim1Client,
      riwayatTali: sesi.riwayatTali,
      isFinished: sesi.state === 'FINISHED',
      hasil: sesi.hasil || null,
    };
  },

  async simpanHasilKeDatabase(sesi: ActiveSoloSession): Promise<void> {
    if (!sesi.hasil) return;
    const laporan = sesi.hasil;

    await prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: sesi.sessionId },
        data: {
          status: 'selesai',
          token: null,
          mode: 'solo',
          selesaiPada: new Date(),
          konfigurasi: JSON.stringify({
            playMode: 'SOLO',
            config: sesi.config,
            laporanTarikSolo: laporan,
          }),
        },
      });

      await tx.sessionResult.upsert({
        where: { sessionId: sesi.sessionId },
        update: {
          timMenang: laporan.timMenang,
          posisiAkhir: laporan.posisiAkhir,
          skorMerah: laporan.skorMerah,
          skorPutih: laporan.skorPutih,
        },
        create: {
          sessionId: sesi.sessionId,
          timMenang: laporan.timMenang,
          posisiAkhir: laporan.posisiAkhir,
          skorMerah: laporan.skorMerah,
          skorPutih: laporan.skorPutih,
        },
      });

      await tx.sessionPlayer.deleteMany({ where: { sessionId: sesi.sessionId } });
      for (const p of laporan.statistikPemain) {
        await tx.sessionPlayer.create({
          data: {
            id: `${sesi.sessionId}_${p.tim}`,
            sessionId: sesi.sessionId,
            nama: p.nama,
            tim: p.tim === 'merah' ? 'tim1' : 'tim2',
            posisi: laporan.posisiAkhir,
            efekAktif: JSON.stringify({
              riwayatPowerUp: p.riwayatPowerUp,
              bonusStreak: p.totalBonusStreak,
            }),
            poinBonus: p.totalBonusStreak,
            totalBenar: p.totalBenar,
            totalSalah: p.totalSalah,
            streakSaatIni: p.streakSaatIni,
            streakTertinggi: p.streakTertinggi,
            totalWaktuJawabMs: p.totalWaktuJawabMs,
            jumlahJawab: p.jumlahJawab,
            status: 'selesai',
            selesaiPada: new Date(),
          },
        });
      }

      await tx.questionStat.deleteMany({ where: { sessionId: sesi.sessionId } });
      for (const [questionId, stat] of sesi.questionStatsMap.entries()) {
        await tx.questionStat.create({
          data: {
            sessionId: sesi.sessionId,
            questionId,
            jumlahBenar: stat.jumlahBenar,
            jumlahSalah: stat.jumlahSalah,
          },
        });
      }
    });
  },

  async muatLaporanDariDatabase(sessionId: string): Promise<LaporanTarikTambangSolo | null> {
    const db = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { result: true },
    });
    if (!db || db.mode !== 'solo') return null;

    if (db.konfigurasi) {
      try {
        const parsed = JSON.parse(db.konfigurasi);
        if (parsed?.laporanTarikSolo) {
          return parsed.laporanTarikSolo as LaporanTarikTambangSolo;
        }
      } catch {
        // lanjut fallback
      }
    }
    return null;
  },

  hapusSesi(sessionId: string): void {
    sesiSoloMap.delete(sessionId);
  },
};
