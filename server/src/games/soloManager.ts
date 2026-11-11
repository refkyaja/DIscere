import { prisma } from '../db.js';
import { mapDbQuestionForGame } from '../utils/questionOptions.js';
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

export interface JawabanSisiSolo {
  choiceId?: string;
  kodeDipilih: string;
  benar: boolean;
  waktuJawabMs: number;
}

export interface RondeSoloAktif {
  nomorRonde: number;
  soalTim1: PresentasiSoalTarik;
  soalTim2: PresentasiSoalTarik;
  dimulaiPadaMs: number;
  berakhirPadaMs: number;
  sisaWaktuMsSaatJeda?: number;
  jawabanTim1: JawabanSisiSolo | null;
  jawabanTim2: JawabanSisiSolo | null;
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

function sinkronkanRingkasanStat(stat: StatistikPemainSolo): void {
  stat.akurasiPersen =
    stat.jumlahJawab > 0 ? Math.round((stat.totalBenar / stat.jumlahJawab) * 100) : 0;
  stat.rataRataWaktuJawabMs =
    stat.jumlahJawab > 0 ? Math.round(stat.totalWaktuJawabMs / stat.jumlahJawab) : 0;
}

function prosesStatistikSisiRonde(
  sesi: ActiveSoloSession,
  stat: StatistikPemainSolo,
  jawaban: JawabanSisiSolo | null
): { benar: boolean; bonusDidapat: number } {
  const benar = Boolean(jawaban?.benar);
  stat.jumlahJawab += 1;
  if (benar) {
    stat.totalBenar += 1;
  } else {
    stat.totalSalah += 1;
  }
  if (jawaban) {
    stat.totalWaktuJawabMs += jawaban.waktuJawabMs;
  }

  const st = perbaruiStreakIndividu({
    streakSaatIni: stat.streakSaatIni,
    streakTertinggi: stat.streakTertinggi,
    milestone3SudahDapat: stat.milestone3Sudah,
    milestone5SudahDapat: stat.milestone5Sudah,
    benar,
    bonusAktif: sesi.config.bonusAktif,
  });

  stat.streakSaatIni = st.streakBaru;
  stat.streakTertinggi = st.streakTertinggiBaru;
  stat.milestone3Sudah = st.milestone3SudahDapat;
  stat.milestone5Sudah = st.milestone5SudahDapat;
  stat.totalBonusStreak += st.bonusDidapat;

  stat.powerUpTersedia = tentukanHadiahPowerUp({
    powerUpAktif: sesi.config.powerUpAktif,
    bankSaatIni: stat.powerUpTersedia,
    streakBaru: stat.streakSaatIni,
    akurasiRondePersen: 0,
  });

  sinkronkanRingkasanStat(stat);
  return { benar, bonusDidapat: st.bonusDidapat };
}

function catatStatSoalDanLog(
  sesi: ActiveSoloSession,
  nomorRonde: number,
  tim: TimTarikTambang,
  pres: PresentasiSoalTarik,
  jawaban: JawabanSisiSolo | null,
  benar: boolean,
  posisiSetelah: number
): void {
  const qStat = sesi.questionStatsMap.get(pres.questionId) || {
    jumlahBenar: 0,
    jumlahSalah: 0,
  };
  if (benar) qStat.jumlahBenar += 1;
  else qStat.jumlahSalah += 1;
  sesi.questionStatsMap.set(pres.questionId, qStat);

  sesi.logJawaban.push({
    questionId: pres.questionId,
    nomorSoal: nomorRonde,
    nomorRonde,
    teksSoal: pres.teks,
    tim,
    jawabanDipilih: jawaban?.kodeDipilih || '-',
    jawabanBenar: pres.jawabanBenarKode,
    benar,
    waktuJawabMs: jawaban?.waktuJawabMs ?? 0,
    posisiSetelah,
  });
}

function kloningStatPemain(stat: StatistikPemainSolo): StatistikPemainSolo {
  return {
    ...stat,
    riwayatPowerUp: [...stat.riwayatPowerUp],
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

  sinkronkanRingkasanStat(sesi.tim1);
  sinkronkanRingkasanStat(sesi.tim2);

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
    akurasiTim1: sesi.tim1.akurasiPersen,
    akurasiTim2: sesi.tim2.akurasiPersen,
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
    riwayatTali: [...sesi.riwayatTali],
    riwayatRonde: [...sesi.riwayatRonde],
    statistikPemain: [kloningStatPemain(sesi.tim1), kloningStatPemain(sesi.tim2)],
  };
}

function evaluasiDanTutupRondeInternal(sesi: ActiveSoloSession): {
  hasilRonde: RiwayatRondeSolo;
  selesai: boolean;
} {
  const ronde = sesi.rondeAktif;
  if (!ronde) {
    throw new Error('Belum ada ronde aktif pada sesi ini.');
  }
  if (ronde.ditutup && ronde.hasilRonde) {
    return {
      hasilRonde: ronde.hasilRonde,
      selesai: sesi.state === 'FINISHED',
    };
  }
  if (ronde.sedangDiproses) {
    throw new Error('Evaluasi ronde sedang berlangsung.');
  }

  ronde.sedangDiproses = true;
  ronde.ditutup = true;

  const j1 = ronde.jawabanTim1;
  const j2 = ronde.jawabanTim2;

  const res1 = prosesStatistikSisiRonde(sesi, sesi.tim1, j1);
  const res2 = prosesStatistikSisiRonde(sesi, sesi.tim2, j2);
  if (res1.benar) sesi.skorMerah += 1;
  if (res2.benar) sesi.skorPutih += 1;

  const posisiSebelum = sesi.taliPosition;
  const evalRonde = evaluasiRondeTarikTambang({
    mode: 'SOLO',
    posisiLama: posisiSebelum,
    tim1Benar: res1.benar ? 1 : 0,
    tim1TotalAnggota: 1,
    tim2Benar: res2.benar ? 1 : 0,
    tim2TotalAnggota: 1,
    bonusStreakTim1: res1.bonusDidapat,
    bonusStreakTim2: res2.bonusDidapat,
    bonusAktif: sesi.config.bonusAktif,
    powerUpTim1Aktif: ronde.powerUpTim1Dipakai,
    powerUpTim2Aktif: ronde.powerUpTim2Dipakai,
    batasMenang: sesi.config.batasMenang,
  });

  sesi.taliPosition = evalRonde.posisiBaru;

  const riwayatItem: RiwayatRondeSolo = {
    nomorRonde: ronde.nomorRonde,
    tim1QuestionId: ronde.soalTim1.questionId,
    tim2QuestionId: ronde.soalTim2.questionId,
    tim1Teks: ronde.soalTim1.teks,
    tim2Teks: ronde.soalTim2.teks,
    tim1Benar: res1.benar,
    tim2Benar: res2.benar,
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

  catatStatSoalDanLog(sesi, ronde.nomorRonde, 'merah', ronde.soalTim1, j1, res1.benar, evalRonde.posisiBaru);
  catatStatSoalDanLog(sesi, ronde.nomorRonde, 'putih', ronde.soalTim2, j2, res2.benar, evalRonde.posisiBaru);

  const selesai = cekKondisiSelesai(evalRonde.posisiBaru, sesi.config.batasMenang);
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

  async pulihkanSesiDariDb(sessionId: string): Promise<ActiveSoloSession | null> {
    const existing = sesiSoloMap.get(sessionId);
    if (existing) return existing;

    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: {
          include: { questions: { orderBy: { urutan: 'asc' } } },
        },
        result: true,
      },
    });

    if (!sessionDb || sessionDb.template.game !== 'tarik_tambang' || sessionDb.mode !== 'solo') {
      return null;
    }

    let parsedConfig: Partial<KonfigurasiTarikTambang> | undefined;
    if (sessionDb.konfigurasi) {
      try {
        const parsed = JSON.parse(sessionDb.konfigurasi);
        parsedConfig = parsed?.config || parsed;
      } catch {
        parsedConfig = undefined;
      }
    }

    try {
      const mappedQuestions = sessionDb.template.questions.map(mapDbQuestionForGame);
      const sesi = this.inisialisasiSesi(
        sessionDb.id,
        sessionDb.hostId,
        { id: sessionDb.template.id, judul: sessionDb.template.judul },
        mappedQuestions,
        parsedConfig
      );

      sesi.waktuMulaiMs = sessionDb.mulaiPada ? sessionDb.mulaiPada.getTime() : null;

      if (sessionDb.status === 'selesai') {
        sesi.state = 'FINISHED';
        sesi.waktuSelesaiMs = sessionDb.selesaiPada ? sessionDb.selesaiPada.getTime() : Date.now();
        if (sessionDb.result) {
          sesi.taliPosition = sessionDb.result.posisiAkhir;
          sesi.skorMerah = sessionDb.result.skorMerah;
          sesi.skorPutih = sessionDb.result.skorPutih;
        }
        sesi.hasil = (await this.muatLaporanDariDatabase(sessionDb.id)) || undefined;
      } else if (sessionDb.status === 'jalan') {
        this.mulaiSesi(sessionDb.id, sessionDb.hostId);
      }

      return sesi;
    } catch {
      return null;
    }
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

    if (sesi.state === 'READY') {
      if (stateBaru === 'PLAYING') {
        return this.mulaiSesi(sessionId, hostId);
      }
      throw new Error('Permainan belum dimulai sehingga tidak dapat dijeda.');
    }

    const now = Date.now();
    if (
      stateBaru === 'PAUSED' &&
      sesi.state === 'PLAYING' &&
      sesi.rondeAktif &&
      !sesi.rondeAktif.ditutup
    ) {
      sesi.rondeAktif.sisaWaktuMsSaatJeda = Math.max(
        250,
        sesi.rondeAktif.berakhirPadaMs - now
      );
    } else if (
      stateBaru === 'PLAYING' &&
      sesi.state === 'PAUSED' &&
      sesi.rondeAktif &&
      !sesi.rondeAktif.ditutup
    ) {
      const durasiMs = sesi.config.durasiRonde * 1000;
      const sisa = sesi.rondeAktif.sisaWaktuMsSaatJeda ?? durasiMs;
      sesi.rondeAktif.berakhirPadaMs = now + sisa;
      sesi.rondeAktif.dimulaiPadaMs = now - Math.max(0, durasiMs - sisa);
      sesi.rondeAktif.sisaWaktuMsSaatJeda = undefined;
    }

    sesi.state = stateBaru;
    return sesi;
  },

  /**
   * Mengaktifkan Power-Up milik tim untuk ronde berikutnya (maksimal 1 aktif, tidak dapat ditumpuk).
   */
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
    if (stat.powerUpAktifRondeBerikutnya !== null) {
      throw new Error('Sudah ada power-up yang diaktifkan untuk ronde berikutnya (maksimal 1).');
    }

    const powerUp = stat.powerUpTersedia;
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
    const now = Date.now();
    if (now > ronde.berakhirPadaMs + 600) {
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

    // Anti-lintas-sisi: tolak jika presentationId milik sisi lawan
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

    const recordJawaban: JawabanSisiSolo = {
      choiceId: input.choiceId,
      kodeDipilih: hasilVal.kodeDipilih,
      benar: hasilVal.benar,
      waktuJawabMs: Math.max(100, now - ronde.dimulaiPadaMs),
    };

    if (tim === 'merah') {
      ronde.jawabanTim1 = recordJawaban;
    } else {
      ronde.jawabanTim2 = recordJawaban;
    }

    // Jika kedua sisi sudah menjawab, evaluasi & tutup ronde (tanpa bocor skor sebelum tutup)
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

    if (sesi.rondeAktif.ditutup && sesi.rondeAktif.hasilRonde) {
      return {
        sesi,
        hasilRonde: sesi.rondeAktif.hasilRonde,
        selesai: sesi.state === 'FINISHED',
      };
    }

    if (sesi.state !== 'PLAYING') {
      throw new Error('Ronde hanya dapat ditutup saat permainan sedang berjalan.');
    }

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

    if (sesi.state === 'FINISHED' && sesi.hasil) {
      return sesi;
    }

    if (sesi.rondeAktif && !sesi.rondeAktif.ditutup) {
      if (sesi.rondeAktif.jawabanTim1 || sesi.rondeAktif.jawabanTim2) {
        evaluasiDanTutupRondeInternal(sesi);
      } else {
        sesi.rondeAktif.ditutup = true;
      }
    }

    if (sesi.state !== 'FINISHED') {
      sesi.state = 'FINISHED';
      sesi.waktuSelesaiMs = Date.now();
    }
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
      tim1: kloningStatPemain(sesi.tim1),
      tim2: kloningStatPemain(sesi.tim2),
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
      soalSaatIni: soalTim1Client,
      riwayatTali: [...sesi.riwayatTali],
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
          mulaiPada: sesi.waktuMulaiMs ? new Date(sesi.waktuMulaiMs) : undefined,
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
      include: {
        template: true,
        result: true,
        players: true,
      },
    });
    if (!db || db.mode !== 'solo') return null;

    let parsedConfig: Partial<KonfigurasiTarikTambang> | undefined;
    if (db.konfigurasi) {
      try {
        const parsed = JSON.parse(db.konfigurasi);
        if (parsed?.laporanTarikSolo) {
          return parsed.laporanTarikSolo as LaporanTarikTambangSolo;
        }
        if (parsed?.config) {
          parsedConfig = parsed.config;
        }
      } catch {
        // lanjut fallback rekonstruksi DB
      }
    }

    if (!db.result) return null;

    const configFallback = bangunKonfigurasiTarikTambang(parsedConfig);
    const p1Db = db.players.find((p) => p.tim === 'tim1');
    const p2Db = db.players.find((p) => p.tim === 'tim2');

    const susunStatFallback = (
      tim: TimTarikTambang,
      namaDefault: string,
      p?: typeof p1Db
    ): StatistikPemainSolo => {
      const stat = buatStatistikPemainAwal(tim, p?.nama || namaDefault);
      if (p) {
        stat.totalBenar = p.totalBenar;
        stat.totalSalah = p.totalSalah;
        stat.jumlahJawab = p.jumlahJawab || p.totalBenar + p.totalSalah;
        stat.streakSaatIni = p.streakSaatIni;
        stat.streakTertinggi = p.streakTertinggi;
        stat.totalBonusStreak = p.poinBonus;
        stat.totalWaktuJawabMs = p.totalWaktuJawabMs;
        sinkronkanRingkasanStat(stat);
      }
      return stat;
    };

    const tim1 = susunStatFallback('merah', configFallback.namaTim1, p1Db);
    const tim2 = susunStatFallback('putih', configFallback.namaTim2, p2Db);
    const durasiMs =
      db.mulaiPada && db.selesaiPada
        ? Math.max(0, db.selesaiPada.getTime() - db.mulaiPada.getTime())
        : 0;

    return {
      sessionId: db.id,
      playMode: 'SOLO',
      templateId: db.templateId,
      templateJudul: db.template.judul,
      konfigurasi: configFallback,
      timMenang: (db.result.timMenang as HasilPemenang) || tentukanPemenang(db.result.posisiAkhir),
      posisiAkhir: db.result.posisiAkhir,
      jumlahRonde: Math.max(tim1.jumlahJawab, tim2.jumlahJawab),
      skorMerah: db.result.skorMerah,
      skorPutih: db.result.skorPutih,
      akurasiTim1: tim1.akurasiPersen,
      akurasiTim2: tim2.akurasiPersen,
      totalBenar: tim1.totalBenar + tim2.totalBenar,
      totalSalah: tim1.totalSalah + tim2.totalSalah,
      bonusStreakTim1: tim1.totalBonusStreak,
      bonusStreakTim2: tim2.totalBonusStreak,
      penggunaanPowerUp: { tim1: [], tim2: [] },
      durasiPermainanMs: durasiMs,
      riwayatTali: [{ ronde: 0, posisi: POSISI_AWAL_TALI, perubahan: 0 }],
      riwayatRonde: [],
      statistikPemain: [tim1, tim2],
    };
  },

  hapusSesi(sessionId: string): void {
    sesiSoloMap.delete(sessionId);
  },
};
