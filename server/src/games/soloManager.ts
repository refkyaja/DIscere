import crypto from 'crypto';
import {
  TimTarikTambang,
  KodePowerUpTarikTambang,
  KonfigurasiTarikTambang,
  PresentasiSoalTarikTambang,
  SoalBankTarikTambang,
  BOT_PRESET_TARIK,
  bangunKonfigurasiTarikTambang,
  filterBankSoalSetara,
  siapkanAntreanSoalTarik,
  buatPresentasiSoalTarik,
  validasiJawabanTarikTambang,
  serialisasiSoalUntukClient,
  perbaruiStreakIndividu,
  tentukanHadiahPowerUp,
  evaluasiTarikanSolo,
  cekKondisiSelesai,
  tentukanPemenang,
  ambilKataTerpelesetTarik,
  acakArray,
} from './tarikTambang.js';
import { prisma } from '../db.js';
import { mapDbQuestionForGame } from '../utils/questionOptions.js';

const TX_TIMEOUT = { maxWait: 10000, timeout: 15000 } as const;

export type SoloState = 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED';
export type SoalSesi = SoalBankTarikTambang;

export interface SisiPowerUpSolo {
  tim: TimTarikTambang;
  bank: KodePowerUpTarikTambang | null;
  aktifBerikutnya: KodePowerUpTarikTambang | null;
}

export interface StatistikPemainSolo {
  tim: TimTarikTambang;
  nama: string;
  isBot: boolean;
  totalBenar: number;
  totalSalah: number;
  totalDijawab: number;
  akurasiPersen: number;
  streakSaatIni: number;
  streakTertinggi: number;
  milestone3SudahDapat: boolean;
  milestone5SudahDapat: boolean;
  rataRataWaktuJawabMs: number;
  totalWaktuJawabMs: number;
  jumlahJawab: number;
  nomorSoal: number;
  soalTerakhirId: string | null;
  antreanSoal: SoalBankTarikTambang[];
  presentasiAktif: PresentasiSoalTarikTambang | null;
  lastActivityAtMs: number;
}

export interface FeedbackAksiTarikSolo {
  tim: TimTarikTambang;
  nama: string;
  benar: boolean;
  timedOut: boolean;
  slipQuote: string | null;
  jawabanBenarKode: string;
  jawabanBenarTeks: string;
  penjelasan: string | null;
  posisiSebelum: number;
  posisiBaru: number;
  deltaTali: number;
  streakSaatIni: number;
  bonusStreakDidapat: number;
  selesaiBaru: boolean;
}

export interface LaporanTarikTambangSolo {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  playMode: 'SOLO';
  alasanSelesai: 'garis_menang' | 'waktu_habis' | 'manual';
  konfigurasi: KonfigurasiTarikTambang;
  timMenang: TimTarikTambang | 'seri';
  namaTim1: string;
  namaTim2: string;
  posisiAkhir: number;
  skorMerah: number;
  skorPutih: number;
  totalSoalDijawab: number;
  akurasiTim1Persen: number;
  akurasiTim2Persen: number;
  pemain1Stat: {
    nama: string;
    isBot: boolean;
    totalBenar: number;
    totalSalah: number;
    akurasiPersen: number;
    streakTertinggi: number;
  };
  pemain2Stat: {
    nama: string;
    isBot: boolean;
    totalBenar: number;
    totalSalah: number;
    akurasiPersen: number;
    streakTertinggi: number;
  };
  dihentikanManual: boolean;
  selesaiPada: string;
  questionStats: Array<{
    questionId: string;
    nomorSoal: number;
    teksSoal: string;
    jumlahBenar: number;
    jumlahSalah: number;
  }>;
}

export interface ActiveSoloSession {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  hostId: string;
  state: SoloState;
  config: KonfigurasiTarikTambang;
  poolSetara: SoalBankTarikTambang[];
  questions: SoalBankTarikTambang[];
  taliPosition: number;
  skorMerah: number;
  skorPutih: number;
  totalSoalDijawab: number;
  pemain1: StatistikPemainSolo;
  pemain2: StatistikPemainSolo;
  powerUpTim1: SisiPowerUpSolo;
  powerUpTim2: SisiPowerUpSolo;
  questionStatsMap: Map<string, { jumlahBenar: number; jumlahSalah: number }>;
  elapsedActiveMs: number;
  lastResumedAtMs: number | null;
  matchTimer: NodeJS.Timeout | null;
  savedToDb: boolean;
  savingPromise: Promise<void> | null;
  createdAt: number;
  hasil?: LaporanTarikTambangSolo;
}

function buatStatistikPemainAwal(
  tim: TimTarikTambang,
  nama: string,
  isBot: boolean
): StatistikPemainSolo {
  return {
    tim,
    nama,
    isBot,
    totalBenar: 0,
    totalSalah: 0,
    totalDijawab: 0,
    akurasiPersen: 0,
    streakSaatIni: 0,
    streakTertinggi: 0,
    milestone3SudahDapat: false,
    milestone5SudahDapat: false,
    rataRataWaktuJawabMs: 0,
    totalWaktuJawabMs: 0,
    jumlahJawab: 0,
    nomorSoal: 0,
    soalTerakhirId: null,
    antreanSoal: [],
    presentasiAktif: null,
    lastActivityAtMs: Date.now(),
  };
}

function hitungAkurasi(benar: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((benar / total) * 100);
}

function hitungElapsedMs(sesi: ActiveSoloSession): number {
  const runningMs =
    sesi.state === 'PLAYING' && sesi.lastResumedAtMs
      ? Math.max(0, Date.now() - sesi.lastResumedAtMs)
      : 0;
  return sesi.elapsedActiveMs + runningMs;
}

function hitungSisaDetik(sesi: ActiveSoloSession): number {
  const totalMs = Math.max(30, sesi.config.durasiLombaDetik || 180) * 1000;
  const sisaMs = Math.max(0, totalMs - hitungElapsedMs(sesi));
  return Math.ceil(sisaMs / 1000);
}

function bersihkanTimerSesi(sesi: ActiveSoloSession) {
  if (sesi.matchTimer) {
    clearTimeout(sesi.matchTimer);
    sesi.matchTimer = null;
  }
}

function terapkanSoalBerikutnya(
  sesi: ActiveSoloSession,
  pemain: StatistikPemainSolo
): PresentasiSoalTarikTambang {
  if (pemain.antreanSoal.length === 0) {
    pemain.antreanSoal = siapkanAntreanSoalTarik(
      sesi.poolSetara,
      pemain.soalTerakhirId
    );
  }
  const soal = pemain.antreanSoal.shift()!;
  pemain.nomorSoal += 1;
  pemain.soalTerakhirId = soal.id;
  const pres = buatPresentasiSoalTarik(
    soal,
    pemain.nomorSoal,
    sesi.poolSetara.length,
    sesi.config.waktuPerSoalDetik,
    true
  );
  pemain.presentasiAktif = pres;
  pemain.lastActivityAtMs = Date.now();
  return pres;
}

function bangunLaporanAkhirSolo(
  sesi: ActiveSoloSession,
  alasanSelesai: 'garis_menang' | 'waktu_habis' | 'manual'
): LaporanTarikTambangSolo {
  const timMenang = tentukanPemenang(sesi.taliPosition);
  const akurasi1 = hitungAkurasi(sesi.pemain1.totalBenar, sesi.pemain1.totalDijawab);
  const akurasi2 = hitungAkurasi(sesi.pemain2.totalBenar, sesi.pemain2.totalDijawab);

  return {
    sessionId: sesi.sessionId,
    templateId: sesi.templateId,
    templateJudul: sesi.templateJudul,
    playMode: 'SOLO',
    alasanSelesai,
    konfigurasi: sesi.config,
    timMenang,
    namaTim1: sesi.pemain1.nama,
    namaTim2: sesi.pemain2.nama,
    posisiAkhir: sesi.taliPosition,
    skorMerah: sesi.skorMerah,
    skorPutih: sesi.skorPutih,
    totalSoalDijawab: sesi.totalSoalDijawab,
    akurasiTim1Persen: akurasi1,
    akurasiTim2Persen: akurasi2,
    pemain1Stat: {
      nama: sesi.pemain1.nama,
      isBot: sesi.pemain1.isBot,
      totalBenar: sesi.pemain1.totalBenar,
      totalSalah: sesi.pemain1.totalSalah,
      akurasiPersen: akurasi1,
      streakTertinggi: sesi.pemain1.streakTertinggi,
    },
    pemain2Stat: {
      nama: sesi.pemain2.nama,
      isBot: sesi.pemain2.isBot,
      totalBenar: sesi.pemain2.totalBenar,
      totalSalah: sesi.pemain2.totalSalah,
      akurasiPersen: akurasi2,
      streakTertinggi: sesi.pemain2.streakTertinggi,
    },
    dihentikanManual: alasanSelesai === 'manual',
    selesaiPada: new Date().toISOString(),
    questionStats: sesi.questions.map((q) => {
      const stat = sesi.questionStatsMap.get(q.id) || { jumlahBenar: 0, jumlahSalah: 0 };
      return {
        questionId: q.id,
        nomorSoal: q.urutan,
        teksSoal: q.teks,
        jumlahBenar: stat.jumlahBenar,
        jumlahSalah: stat.jumlahSalah,
      };
    }),
  };
}

class SoloSessionManager {
  private sessions = new Map<string, ActiveSoloSession>();

  private jadwalkanMatchTimer(sesi: ActiveSoloSession) {
    bersihkanTimerSesi(sesi);
    if (sesi.state !== 'PLAYING') return;
    const totalMs = Math.max(30, sesi.config.durasiLombaDetik || 180) * 1000;
    const sisaMs = Math.max(50, totalMs - hitungElapsedMs(sesi));
    sesi.matchTimer = setTimeout(() => {
      if (sesi.state !== 'PLAYING') return;
      this.selesaikanInternal(sesi, 'waktu_habis');
      void this.simpanHasilKeDatabase(sesi).catch(() => {});
    }, sisaMs);
  }

  private selesaikanInternal(
    sesi: ActiveSoloSession,
    alasan: 'garis_menang' | 'waktu_habis' | 'manual'
  ) {
    if (sesi.state === 'FINISHED') return;
    sesi.elapsedActiveMs = hitungElapsedMs(sesi);
    sesi.lastResumedAtMs = null;
    bersihkanTimerSesi(sesi);
    sesi.state = 'FINISHED';
    sesi.hasil = bangunLaporanAkhirSolo(sesi, alasan);
  }

  private selesaikanJikaWaktuHabis(sesi: ActiveSoloSession): boolean {
    if (sesi.state !== 'PLAYING') return false;
    const totalMs = Math.max(30, sesi.config.durasiLombaDetik || 180) * 1000;
    if (hitungElapsedMs(sesi) >= totalMs) {
      this.selesaikanInternal(sesi, 'waktu_habis');
      return true;
    }
    return false;
  }

  inisialisasiSesi(
    sessionId: string,
    hostId: string,
    template: { id: string; judul: string },
    questions: SoalSesi[],
    rawConfig?: Partial<KonfigurasiTarikTambang>
  ): ActiveSoloSession {
    if (!questions || questions.length < 2) {
      throw new Error('Minimal dibutuhkan 2 soal dalam template untuk mode Solo 1 vs 1.');
    }

    const prev = this.sessions.get(sessionId);
    if (prev) bersihkanTimerSesi(prev);

    const config = bangunKonfigurasiTarikTambang(rawConfig);
    const poolSetara = filterBankSoalSetara(questions, config.kesulitan);
    const questionStatsMap = new Map<string, { jumlahBenar: number; jumlahSalah: number }>();
    for (const q of questions) {
      questionStatsMap.set(q.id, { jumlahBenar: 0, jumlahSalah: 0 });
    }

    const isBot = config.tipeLawanSolo === 'bot';
    const namaTim1Raw = config.namaTim1.trim();
    const namaTim1 = !namaTim1Raw || namaTim1Raw === 'Tim Merah' ? 'Pemain 1' : namaTim1Raw;
    const namaTim2Raw = config.namaTim2.trim();
    const namaTim2 =
      !namaTim2Raw || namaTim2Raw === 'Tim Biru' || namaTim2Raw === 'Lawan Bot'
        ? isBot
          ? 'Bot'
          : 'Pemain 2'
        : namaTim2Raw;

    const sesi: ActiveSoloSession = {
      sessionId,
      templateId: template.id,
      templateJudul: template.judul,
      hostId,
      state: 'READY',
      config: { ...config, namaTim1, namaTim2 },
      poolSetara,
      questions,
      taliPosition: 0,
      skorMerah: 0,
      skorPutih: 0,
      totalSoalDijawab: 0,
      pemain1: buatStatistikPemainAwal('merah', namaTim1, false),
      pemain2: buatStatistikPemainAwal('putih', namaTim2, isBot),
      powerUpTim1: { tim: 'merah', bank: null, aktifBerikutnya: null },
      powerUpTim2: { tim: 'putih', bank: null, aktifBerikutnya: null },
      questionStatsMap,
      elapsedActiveMs: 0,
      lastResumedAtMs: null,
      matchTimer: null,
      savedToDb: false,
      savingPromise: null,
      createdAt: Date.now(),
    };

    this.sessions.set(sessionId, sesi);
    return sesi;
  }

  mulaiSesi(sessionId: string, hostId: string): ActiveSoloSession {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Solo tidak ditemukan.');
    }
    if (sesi.state === 'FINISHED') {
      throw new Error('Permainan sudah selesai dan tidak dapat dimulai ulang.');
    }
    if (sesi.state === 'PLAYING') {
      return sesi;
    }

    sesi.state = 'PLAYING';
    sesi.elapsedActiveMs = 0;
    sesi.lastResumedAtMs = Date.now();
    terapkanSoalBerikutnya(sesi, sesi.pemain1);
    terapkanSoalBerikutnya(sesi, sesi.pemain2);
    this.jadwalkanMatchTimer(sesi);
    return sesi;
  }

  ubahStateSesi(
    sessionId: string,
    hostId: string,
    nextState: 'PLAYING' | 'PAUSED'
  ): ActiveSoloSession {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Solo tidak ditemukan.');
    }
    if (sesi.state === 'READY') {
      throw new Error('Permainan belum dimulai. Gunakan tombol Mulai terlebih dahulu.');
    }
    if (sesi.state === 'FINISHED') {
      throw new Error('Permainan sudah selesai dan tidak dapat diubah lagi.');
    }

    if (nextState === 'PAUSED' && sesi.state === 'PLAYING') {
      sesi.elapsedActiveMs = hitungElapsedMs(sesi);
      sesi.lastResumedAtMs = null;
      bersihkanTimerSesi(sesi);
      sesi.state = 'PAUSED';
    } else if (nextState === 'PLAYING' && sesi.state === 'PAUSED') {
      sesi.state = 'PLAYING';
      sesi.lastResumedAtMs = Date.now();
      if (!sesi.pemain1.presentasiAktif) terapkanSoalBerikutnya(sesi, sesi.pemain1);
      if (!sesi.pemain2.presentasiAktif) terapkanSoalBerikutnya(sesi, sesi.pemain2);
      this.jadwalkanMatchTimer(sesi);
    }

    return sesi;
  }

  aktifkanPowerUp(
    sessionId: string,
    hostId: string,
    timRaw: string
  ): {
    tim: TimTarikTambang;
    powerUp: KodePowerUpTarikTambang;
    sesi: ActiveSoloSession;
  } {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Solo tidak ditemukan.');
    }
    if (!sesi.config.powerUpAktif) {
      throw new Error('Fitur Power-Up dinonaktifkan untuk sesi ini.');
    }
    if (sesi.state === 'FINISHED') {
      throw new Error('Permainan sudah selesai.');
    }

    const tim: TimTarikTambang =
      timRaw === 'tim1' || timRaw === 'merah' ? 'merah' : 'putih';
    const puObj = tim === 'merah' ? sesi.powerUpTim1 : sesi.powerUpTim2;

    if (!puObj.bank) {
      throw new Error('Tim belum memiliki Power-Up untuk diaktifkan.');
    }
    if (puObj.aktifBerikutnya) {
      throw new Error('Power-Up sudah aktif dan menunggu dipakai.');
    }

    puObj.aktifBerikutnya = puObj.bank;
    puObj.bank = null;

    return { tim, powerUp: puObj.aktifBerikutnya, sesi };
  }

  prosesJawaban(
    sessionId: string,
    hostId: string,
    input: {
      tim: TimTarikTambang;
      presentationId?: string;
      choiceId?: string;
      questionId?: string;
      jawabanDipilih?: string;
      timedOut?: boolean;
    }
  ): {
    sesi: ActiveSoloSession;
    tim: TimTarikTambang;
    benar: boolean;
    sudahMenjawab: boolean;
    rondeSelesai: boolean;
    hasilRonde: null;
    feedback: FeedbackAksiTarikSolo;
    selesai: boolean;
  } {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Solo tidak ditemukan.');
    }

    if (this.selesaikanJikaWaktuHabis(sesi)) {
      const pemainTimeout = input.tim === 'merah' ? sesi.pemain1 : sesi.pemain2;
      return {
        sesi,
        tim: input.tim,
        benar: false,
        sudahMenjawab: false,
        rondeSelesai: true,
        hasilRonde: null,
        feedback: {
          tim: input.tim,
          nama: pemainTimeout.nama,
          benar: false,
          timedOut: true,
          slipQuote: 'Waktu habis!',
          jawabanBenarKode: '',
          jawabanBenarTeks: '',
          penjelasan: null,
          posisiSebelum: sesi.taliPosition,
          posisiBaru: sesi.taliPosition,
          deltaTali: 0,
          streakSaatIni: pemainTimeout.streakSaatIni,
          bonusStreakDidapat: 0,
          selesaiBaru: true,
        },
        selesai: true,
      };
    }

    if (sesi.state !== 'PLAYING') {
      throw new Error('Permainan sedang tidak berlangsung.');
    }

    const pemain = input.tim === 'merah' ? sesi.pemain1 : sesi.pemain2;
    const pres = pemain.presentasiAktif;
    if (!pres) {
      throw new Error('Soal untuk sisi ini belum tersedia.');
    }

    if (input.presentationId && input.presentationId !== pres.presentationId) {
      throw new Error('Soal ini sudah dijawab atau kedaluwarsa.');
    }

    const val = validasiJawabanTarikTambang(pres, {
      choiceId: input.choiceId,
      jawabanDipilih: input.jawabanDipilih,
      timedOut: input.timedOut,
    });

    const elapsedJawabMs = Math.max(
      200,
      Math.min(30000, Date.now() - (pres.ditampilkanPadaMs || Date.now()))
    );
    pemain.jumlahJawab += 1;
    pemain.totalWaktuJawabMs += elapsedJawabMs;
    pemain.rataRataWaktuJawabMs = Math.round(pemain.totalWaktuJawabMs / pemain.jumlahJawab);

    pemain.totalDijawab += 1;
    sesi.totalSoalDijawab += 1;

    if (val.benar) {
      pemain.totalBenar += 1;
    } else {
      pemain.totalSalah += 1;
    }
    pemain.akurasiPersen = hitungAkurasi(pemain.totalBenar, pemain.totalDijawab);

    sesi.skorMerah = sesi.pemain1.totalBenar;
    sesi.skorPutih = sesi.pemain2.totalBenar;

    const qStat = sesi.questionStatsMap.get(pres.questionId) || {
      jumlahBenar: 0,
      jumlahSalah: 0,
    };
    if (val.benar) qStat.jumlahBenar += 1;
    else qStat.jumlahSalah += 1;
    sesi.questionStatsMap.set(pres.questionId, qStat);

    const streakRes = perbaruiStreakIndividu({
      streakSaatIni: pemain.streakSaatIni,
      streakTertinggi: pemain.streakTertinggi,
      milestone3SudahDapat: pemain.milestone3SudahDapat,
      milestone5SudahDapat: pemain.milestone5SudahDapat,
      benar: val.benar,
      bonusAktif: sesi.config.bonusAktif,
    });
    pemain.streakSaatIni = streakRes.streakBaru;
    pemain.streakTertinggi = streakRes.streakTertinggiBaru;
    pemain.milestone3SudahDapat = streakRes.milestone3SudahDapat;
    pemain.milestone5SudahDapat = streakRes.milestone5SudahDapat;

    const myPu = input.tim === 'merah' ? sesi.powerUpTim1 : sesi.powerUpTim2;
    const oppPu = input.tim === 'merah' ? sesi.powerUpTim2 : sesi.powerUpTim1;
    const activeAtk = myPu.aktifBerikutnya;
    const activeOpp = oppPu.aktifBerikutnya;

    const posisiSebelum = sesi.taliPosition;
    const evalPull = evaluasiTarikanSolo({
      posisiLama: posisiSebelum,
      tim: input.tim,
      benar: val.benar,
      config: sesi.config,
      bonusStreak: streakRes.bonusDidapat,
      powerUpAktif: activeAtk,
      powerUpLawan: activeOpp,
    });
    sesi.taliPosition = evalPull.posisiBaru;

    if (val.benar && activeAtk) myPu.aktifBerikutnya = null;
    if (val.benar && activeOpp === 'pertahanan_kuat') oppPu.aktifBerikutnya = null;

    myPu.bank = tentukanHadiahPowerUp({
      powerUpAktif: sesi.config.powerUpAktif,
      bankSaatIni: myPu.bank,
      streakBaru: pemain.streakSaatIni,
      akurasiRondePersen: val.benar ? 100 : 0,
    });

    const selesai = cekKondisiSelesai(sesi.taliPosition, sesi.config.batasMenang);
    if (selesai) {
      this.selesaikanInternal(sesi, 'garis_menang');
    } else {
      terapkanSoalBerikutnya(sesi, pemain);
    }

    const slipQuote = !val.benar ? ambilKataTerpelesetTarik() : null;

    return {
      sesi,
      tim: input.tim,
      benar: val.benar,
      sudahMenjawab: true,
      rondeSelesai: true,
      hasilRonde: null,
      feedback: {
        tim: input.tim,
        nama: pemain.nama,
        benar: val.benar,
        timedOut: val.timedOut,
        slipQuote,
        jawabanBenarKode: pres.jawabanBenarKode,
        jawabanBenarTeks: pres.jawabanBenarTeks,
        penjelasan: pres.penjelasan,
        posisiSebelum,
        posisiBaru: sesi.taliPosition,
        deltaTali: evalPull.deltaTali,
        streakSaatIni: pemain.streakSaatIni,
        bonusStreakDidapat: streakRes.bonusDidapat,
        selesaiBaru: selesai,
      },
      selesai,
    };
  }

  jalankanLangkahBot(
    sessionId: string,
    hostId: string
  ): {
    executed: boolean;
    chosenChoiceId: string | null;
    feedback: FeedbackAksiTarikSolo | null;
    selesai: boolean;
    sesi: ActiveSoloSession;
  } {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Solo tidak ditemukan.');
    }
    if (sesi.config.tipeLawanSolo !== 'bot') {
      throw new Error('Sesi ini menggunakan lawan Pemain 2 Lokal, bukan Bot AI.');
    }
    if (this.selesaikanJikaWaktuHabis(sesi)) {
      return {
        executed: false,
        chosenChoiceId: null,
        feedback: null,
        selesai: true,
        sesi,
      };
    }
    if (sesi.state !== 'PLAYING' || !sesi.pemain2.presentasiAktif) {
      return {
        executed: false,
        chosenChoiceId: null,
        feedback: null,
        selesai: sesi.state === 'FINISHED',
        sesi,
      };
    }

    const pres = sesi.pemain2.presentasiAktif;
    const preset = BOT_PRESET_TARIK[sesi.config.kesulitanBot] || BOT_PRESET_TARIK.sedang;
    const roll = crypto.randomInt(0, 1000) / 1000;
    const wantsCorrect = roll < preset.akurasi;

    const wrongChoices = pres.pilihanList.filter((c) => c.choiceId !== pres.correctChoiceId);
    const chosenChoice = wantsCorrect
      ? pres.pilihanList.find((c) => c.choiceId === pres.correctChoiceId) || pres.pilihanList[0]
      : wrongChoices.length > 0
        ? acakArray(wrongChoices)[0]
        : pres.pilihanList[0];

    const res = this.prosesJawaban(sessionId, hostId, {
      tim: 'putih',
      presentationId: pres.presentationId,
      choiceId: chosenChoice.choiceId,
    });

    return {
      executed: true,
      chosenChoiceId: chosenChoice.choiceId,
      feedback: res.feedback,
      selesai: res.selesai,
      sesi: res.sesi,
    };
  }

  /** Kompatibilitas endpoint /tutup-ronde untuk sesi terpulihkan / timeout. */
  tutupRonde(
    sessionId: string,
    hostId: string
  ): {
    sesi: ActiveSoloSession;
    hasilRonde: null;
    selesai: boolean;
  } {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Solo tidak ditemukan.');
    }
    this.selesaikanJikaWaktuHabis(sesi);
    return {
      sesi,
      hasilRonde: null,
      selesai: sesi.state === 'FINISHED',
    };
  }

  /** Kompatibilitas endpoint /lanjut-ronde. */
  lanjutRondeBerikutnya(sessionId: string, hostId: string): ActiveSoloSession {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Solo tidak ditemukan.');
    }
    this.selesaikanJikaWaktuHabis(sesi);
    if (sesi.state === 'PLAYING') {
      if (!sesi.pemain1.presentasiAktif) terapkanSoalBerikutnya(sesi, sesi.pemain1);
      if (!sesi.pemain2.presentasiAktif) terapkanSoalBerikutnya(sesi, sesi.pemain2);
    }
    return sesi;
  }

  ulangPermainan(
    sessionId: string,
    hostId: string,
    autoStart: boolean = false
  ): ActiveSoloSession {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Solo tidak ditemukan.');
    }
    bersihkanTimerSesi(sesi);
    sesi.taliPosition = 0;
    sesi.skorMerah = 0;
    sesi.skorPutih = 0;
    sesi.totalSoalDijawab = 0;
    sesi.elapsedActiveMs = 0;
    sesi.lastResumedAtMs = null;
    sesi.hasil = undefined;
    sesi.savedToDb = false;

    const isBot = sesi.config.tipeLawanSolo === 'bot';
    sesi.pemain1 = buatStatistikPemainAwal('merah', sesi.config.namaTim1, false);
    sesi.pemain2 = buatStatistikPemainAwal('putih', sesi.config.namaTim2, isBot);
    sesi.powerUpTim1 = { tim: 'merah', bank: null, aktifBerikutnya: null };
    sesi.powerUpTim2 = { tim: 'putih', bank: null, aktifBerikutnya: null };
    for (const q of sesi.questions) {
      sesi.questionStatsMap.set(q.id, { jumlahBenar: 0, jumlahSalah: 0 });
    }

    if (autoStart) {
      sesi.state = 'PLAYING';
      sesi.lastResumedAtMs = Date.now();
      terapkanSoalBerikutnya(sesi, sesi.pemain1);
      terapkanSoalBerikutnya(sesi, sesi.pemain2);
      this.jadwalkanMatchTimer(sesi);
    } else {
      sesi.state = 'READY';
    }

    return sesi;
  }

  selesaikanSesi(sessionId: string, hostId: string): ActiveSoloSession {
    const sesi = this.dapatkanSesi(sessionId, hostId);
    if (!sesi) {
      throw new Error('Sesi Solo tidak ditemukan.');
    }
    if (sesi.state === 'FINISHED') {
      return sesi;
    }
    this.selesaikanInternal(sesi, 'manual');
    return sesi;
  }

  dapatkanSesi(sessionId: string, hostId?: string): ActiveSoloSession | undefined {
    const s = this.sessions.get(sessionId);
    if (!s) return undefined;
    if (hostId && s.hostId !== hostId) return undefined;
    return s;
  }

  async pulihkanSesiDariDb(sessionId: string): Promise<ActiveSoloSession | null> {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;

    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: {
          include: {
            questions: { orderBy: { urutan: 'asc' } },
          },
        },
        result: true,
        questionStats: {
          include: { question: true },
        },
      },
    });

    if (!sessionDb || sessionDb.mode !== 'solo' || sessionDb.template.game !== 'tarik_tambang') {
      return null;
    }

    let rawConfig: Partial<KonfigurasiTarikTambang> | undefined;
    if (sessionDb.konfigurasi) {
      try {
        const parsed = JSON.parse(sessionDb.konfigurasi);
        rawConfig = (parsed?.config || parsed) as Partial<KonfigurasiTarikTambang>;
      } catch {
        rawConfig = undefined;
      }
    }

    const mapped = sessionDb.template.questions.map(mapDbQuestionForGame);
    if (mapped.length < 2) return null;

    const sesi = this.inisialisasiSesi(
      sessionDb.id,
      sessionDb.hostId,
      { id: sessionDb.templateId, judul: sessionDb.template.judul },
      mapped,
      rawConfig
    );

    if (sessionDb.status === 'selesai') {
      sesi.state = 'FINISHED';
      sesi.taliPosition = sessionDb.result?.posisiAkhir ?? 0;
      sesi.skorMerah = sessionDb.result?.skorMerah ?? 0;
      sesi.skorPutih = sessionDb.result?.skorPutih ?? 0;
      sesi.savedToDb = true;
      const laporanDb = await this.muatLaporanDariDatabase(sessionDb.id);
      if (laporanDb) {
        sesi.hasil = laporanDb;
      } else {
        sesi.hasil = bangunLaporanAkhirSolo(sesi, 'manual');
      }
    } else if (sessionDb.status === 'jalan') {
      sesi.state = 'PLAYING';
      const elapsedFromDb = sessionDb.mulaiPada
        ? Math.max(0, Date.now() - sessionDb.mulaiPada.getTime())
        : 0;
      sesi.elapsedActiveMs = elapsedFromDb;
      sesi.lastResumedAtMs = Date.now();
      terapkanSoalBerikutnya(sesi, sesi.pemain1);
      terapkanSoalBerikutnya(sesi, sesi.pemain2);
      if (!this.selesaikanJikaWaktuHabis(sesi)) {
        this.jadwalkanMatchTimer(sesi);
      } else {
        void this.simpanHasilKeDatabase(sesi).catch(() => {});
      }
    }

    return sesi;
  }

  hapusSesi(sessionId: string) {
    const s = this.sessions.get(sessionId);
    if (s) bersihkanTimerSesi(s);
    this.sessions.delete(sessionId);
  }

  async simpanHasilKeDatabase(sesi: ActiveSoloSession) {
    if (sesi.savedToDb) return;
    if (sesi.savingPromise) {
      await sesi.savingPromise;
      return;
    }

    const runSave = async () => {
      if (!sesi.hasil) {
        sesi.hasil = bangunLaporanAkhirSolo(sesi, 'manual');
      }

      const timMenang = sesi.hasil.timMenang;

      await prisma.$transaction(
        async (tx) => {
          const updatedSession = await tx.session.update({
            where: { id: sesi.sessionId },
            data: {
              status: 'selesai',
              selesaiPada: new Date(),
              konfigurasi: JSON.stringify({
                playMode: 'SOLO',
                config: sesi.config,
                laporanTarikSolo: sesi.hasil,
              }),
            },
          });

          await tx.sessionResult.upsert({
            where: { sessionId: updatedSession.id },
            update: {
              timMenang,
              posisiAkhir: Math.round(sesi.taliPosition),
              skorMerah: sesi.skorMerah,
              skorPutih: sesi.skorPutih,
            },
            create: {
              sessionId: updatedSession.id,
              timMenang,
              posisiAkhir: Math.round(sesi.taliPosition),
              skorMerah: sesi.skorMerah,
              skorPutih: sesi.skorPutih,
            },
          });

          await tx.sessionPlayer.deleteMany({
            where: { sessionId: updatedSession.id },
          });

          await tx.sessionPlayer.createMany({
            data: [sesi.pemain1, sesi.pemain2].map((pm, idx) => ({
              id: `${updatedSession.id}-solo-p${idx + 1}`,
              sessionId: updatedSession.id,
              nama: pm.nama,
              tim: pm.tim,
              totalBenar: pm.totalBenar,
              totalSalah: pm.totalSalah,
              streakSaatIni: pm.streakSaatIni,
              streakTertinggi: pm.streakTertinggi,
              totalWaktuJawabMs: pm.totalWaktuJawabMs,
              jumlahJawab: pm.totalDijawab,
              status: 'selesai',
              selesaiPada: new Date(),
            })),
          });

          await tx.questionStat.deleteMany({
            where: { sessionId: updatedSession.id },
          });

          const statEntries = Array.from(sesi.questionStatsMap.entries()).filter(
            ([, stat]) => stat.jumlahBenar > 0 || stat.jumlahSalah > 0
          );
          if (statEntries.length > 0) {
            await tx.questionStat.createMany({
              data: statEntries.map(([questionId, stat]) => ({
                sessionId: updatedSession.id,
                questionId,
                jumlahBenar: stat.jumlahBenar,
                jumlahSalah: stat.jumlahSalah,
              })),
            });
          }
        },
        TX_TIMEOUT
      );

      sesi.savedToDb = true;
    };

    sesi.savingPromise = runSave().finally(() => {
      sesi.savingPromise = null;
    });

    await sesi.savingPromise;
  }

  async muatLaporanDariDatabase(
    sessionId: string
  ): Promise<LaporanTarikTambangSolo | null> {
    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: { include: { questions: { orderBy: { urutan: 'asc' } } } },
        result: true,
        questionStats: { include: { question: true } },
      },
    });
    if (!sessionDb || sessionDb.mode !== 'solo') return null;

    if (sessionDb.konfigurasi) {
      try {
        const parsed = JSON.parse(sessionDb.konfigurasi);
        if (parsed?.laporanTarikSolo) {
          return parsed.laporanTarikSolo as LaporanTarikTambangSolo;
        }
      } catch {
        // Fallback ke rekonstruksi dari DB result
      }
    }

    const totalJawab = sessionDb.questionStats.reduce(
      (sum, q) => sum + q.jumlahBenar + q.jumlahSalah,
      0
    );

    const parsedCfg = sessionDb.konfigurasi
      ? (() => {
          try {
            const p = JSON.parse(sessionDb.konfigurasi);
            return p?.config || p;
          } catch {
            return undefined;
          }
        })()
      : undefined;
    const config = bangunKonfigurasiTarikTambang(parsedCfg);

    return {
      sessionId: sessionDb.id,
      templateId: sessionDb.templateId,
      templateJudul: sessionDb.template.judul,
      playMode: 'SOLO',
      alasanSelesai: 'manual',
      konfigurasi: config,
      timMenang: (sessionDb.result?.timMenang as TimTarikTambang | 'seri') || 'seri',
      namaTim1: config.namaTim1,
      namaTim2: config.namaTim2,
      posisiAkhir: sessionDb.result?.posisiAkhir ?? 0,
      skorMerah: sessionDb.result?.skorMerah ?? 0,
      skorPutih: sessionDb.result?.skorPutih ?? 0,
      totalSoalDijawab: totalJawab,
      akurasiTim1Persen: 0,
      akurasiTim2Persen: 0,
      pemain1Stat: {
        nama: config.namaTim1,
        isBot: false,
        totalBenar: sessionDb.result?.skorMerah ?? 0,
        totalSalah: 0,
        akurasiPersen: 0,
        streakTertinggi: 0,
      },
      pemain2Stat: {
        nama: config.namaTim2,
        isBot: config.tipeLawanSolo === 'bot',
        totalBenar: sessionDb.result?.skorPutih ?? 0,
        totalSalah: 0,
        akurasiPersen: 0,
        streakTertinggi: 0,
      },
      dihentikanManual: true,
      selesaiPada: (sessionDb.selesaiPada || new Date()).toISOString(),
      questionStats: sessionDb.questionStats.map((qs) => ({
        questionId: qs.questionId,
        nomorSoal: qs.question.urutan,
        teksSoal: qs.question.teks,
        jumlahBenar: qs.jumlahBenar,
        jumlahSalah: qs.jumlahSalah,
      })),
    };
  }

  serialisasiUntukClient(sesi: ActiveSoloSession) {
    this.selesaikanJikaWaktuHabis(sesi);
    if (sesi.state === 'FINISHED' && !sesi.savedToDb) {
      void this.simpanHasilKeDatabase(sesi).catch(() => {});
    }

    const totalMs = Math.max(30, sesi.config.durasiLombaDetik || 180) * 1000;
    const sisaMs = Math.max(0, totalMs - hitungElapsedMs(sesi));
    const matchEndsAt =
      sesi.state === 'PLAYING' ? Date.now() + sisaMs : null;

    return {
      sessionId: sesi.sessionId,
      game: 'tarik_tambang' as const,
      mode: 'solo' as const,
      playMode: 'SOLO' as const,
      templateId: sesi.templateId,
      templateJudul: sesi.templateJudul,
      state: sesi.state,
      config: sesi.config,
      taliPosition: sesi.taliPosition,
      skorMerah: sesi.skorMerah,
      skorPutih: sesi.skorPutih,
      totalSoalDijawab: sesi.totalSoalDijawab,
      totalSoalBank: sesi.poolSetara.length,
      durasiLombaDetik: sesi.config.durasiLombaDetik,
      sisaWaktuDetik: hitungSisaDetik(sesi),
      matchEndsAt,
      pemain1: {
        tim: sesi.pemain1.tim,
        nama: sesi.pemain1.nama,
        isBot: sesi.pemain1.isBot,
        totalBenar: sesi.pemain1.totalBenar,
        totalSalah: sesi.pemain1.totalSalah,
        totalDijawab: sesi.pemain1.totalDijawab,
        akurasiPersen: sesi.pemain1.akurasiPersen,
        streakSaatIni: sesi.pemain1.streakSaatIni,
        streakTertinggi: sesi.pemain1.streakTertinggi,
        soalAktif: sesi.pemain1.presentasiAktif
          ? serialisasiSoalUntukClient(sesi.pemain1.presentasiAktif)
          : null,
      },
      pemain2: {
        tim: sesi.pemain2.tim,
        nama: sesi.pemain2.nama,
        isBot: sesi.pemain2.isBot,
        totalBenar: sesi.pemain2.totalBenar,
        totalSalah: sesi.pemain2.totalSalah,
        totalDijawab: sesi.pemain2.totalDijawab,
        akurasiPersen: sesi.pemain2.akurasiPersen,
        streakSaatIni: sesi.pemain2.streakSaatIni,
        streakTertinggi: sesi.pemain2.streakTertinggi,
        soalAktif: sesi.pemain2.presentasiAktif
          ? serialisasiSoalUntukClient(sesi.pemain2.presentasiAktif)
          : null,
      },
      powerUpTim1: { ...sesi.powerUpTim1 },
      powerUpTim2: { ...sesi.powerUpTim2 },
      isFinished: sesi.state === 'FINISHED',
      hasil: sesi.hasil || null,
    };
  }
}

export const soloManager = new SoloSessionManager();
