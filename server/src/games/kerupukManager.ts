import { prisma } from '../db.js';
import type { KunciPilihan } from '../utils/questionOptions.js';
import { mapDbQuestionForGame } from '../utils/questionOptions.js';
import {
  ActivePresentationKerupuk,
  HasilGachaGigitan,
  KonfigurasiKerupukSolo,
  RiwayatGigitanItem,
  SoalKerupuk,
  SoalTampilKerupuk,
  SoloKerupukState,
  StateKerupukSolo,
  TipeGigitan,
  bangunKonfigurasiKerupukSolo,
  buatStateKerupukAwal,
  hitungHasilJawabanKerupukSolo,
  serialisasiSoalTampilKerupuk,
  siapkanAntreanSoalKerupuk,
  siapkanPresentasiSoalDariAntrean,
  validasiProbabilitas,
} from './makanKerupuk.js';

export type { SoalKerupuk };
export const siapkanAntreanSoal = siapkanAntreanSoalKerupuk;

export interface LaporanKerupukSolo {
  sessionId: string;
  playMode: 'SOLO';
  templateId: string;
  templateJudul: string;
  statusAkhir: 'FINISHED' | 'STOPPED';
  dihentikanManual: boolean;
  konfigurasi: KonfigurasiKerupukSolo;
  targetKerupuk: number;
  sisaKerupuk: number;
  progresPersen: number;
  skorTotal: number;
  skorPembelajaran: number;
  skorDasarBenar: number;
  totalBonusStreak: number;
  kaliBonusStreak: number;
  bonusKeberuntungan: number;
  bonusPenyelesaian: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakTertinggi: number;
  rataRataWaktuJawabMs: number;
  durasiBermainMs: number;
  statistikGigitan: Record<TipeGigitan, number>;
  riwayatGigitan: RiwayatGigitanItem[];
  totalSoalBank: number;
}

export interface SesiKerupukSoloActive {
  sessionId: string;
  playMode: 'SOLO';
  templateId: string;
  templateJudul: string;
  hostId: string;
  state: StateKerupukSolo;
  config: KonfigurasiKerupukSolo;
  questions: SoalKerupuk[];
  antreanSoalIds: string[];
  terakhirSoalId?: string;
  nomorSoalCounter: number;
  activePresentation: ActivePresentationKerupuk | null;
  pausedAtMs?: number;
  pemainState: SoloKerupukState;
  questionStatsMap: Map<string, { jumlahBenar: number; jumlahSalah: number }>;
  hasil?: LaporanKerupukSolo;
}

const sesiKerupukMap = new Map<string, SesiKerupukSoloActive>();

function buatPresentasiSoalSolo(
  sesi: SesiKerupukSoloActive,
  sekarangMs: number = Date.now()
): ActivePresentationKerupuk {
  sesi.nomorSoalCounter += 1;
  const hasil = siapkanPresentasiSoalDariAntrean(
    sesi.questions,
    sesi.antreanSoalIds,
    sesi.terakhirSoalId,
    sesi.nomorSoalCounter,
    sekarangMs
  );
  sesi.antreanSoalIds = hasil.antreanBaru;
  sesi.terakhirSoalId = hasil.terakhirSoalIdBaru;
  return hasil.presentation;
}

function bangunLaporanAkhirSolo(
  sesi: SesiKerupukSoloActive,
  statusAkhir: 'FINISHED' | 'STOPPED',
  sekarangMs: number = Date.now()
): LaporanKerupukSolo {
  const st = sesi.pemainState;
  const totalJawab = st.totalBenar + st.totalSalah;
  const akurasiPersen = totalJawab > 0 ? Math.round((st.totalBenar / totalJawab) * 100) : 0;
  const durasiBermainMs =
    st.waktuMulaiMs !== null ? Math.max(0, (st.waktuSelesaiMs ?? sekarangMs) - st.waktuMulaiMs) : 0;

  return {
    sessionId: sesi.sessionId,
    playMode: 'SOLO',
    templateId: sesi.templateId,
    templateJudul: sesi.templateJudul,
    statusAkhir,
    dihentikanManual: statusAkhir === 'STOPPED',
    konfigurasi: sesi.config,
    targetKerupuk: sesi.config.targetKerupuk,
    sisaKerupuk: st.sisaKerupuk,
    progresPersen: st.progresPersen,
    skorTotal: st.skorTotal,
    skorPembelajaran: st.skorPembelajaran,
    skorDasarBenar: st.skorDasarBenar,
    totalBonusStreak: st.totalBonusStreak,
    kaliBonusStreak: st.kaliBonusStreak,
    bonusKeberuntungan: st.bonusKeberuntungan,
    bonusPenyelesaian: st.bonusPenyelesaian,
    totalBenar: st.totalBenar,
    totalSalah: st.totalSalah,
    akurasiPersen,
    streakTertinggi: st.streakTertinggi,
    rataRataWaktuJawabMs: st.rataRataWaktuJawabMs,
    durasiBermainMs,
    statistikGigitan: { ...st.statistikGigitan },
    riwayatGigitan: [...st.riwayatGigitan],
    totalSoalBank: sesi.questions.length,
  };
}

export const kerupukManager = {
  inisialisasiSesi(
    sessionId: string,
    hostId: string,
    template: { id: string; judul: string },
    questions: SoalKerupuk[],
    userConfig?: Partial<KonfigurasiKerupukSolo>
  ): SesiKerupukSoloActive {
    if (!questions || questions.length === 0) {
      throw new Error('Template tidak memiliki soal. Tambahkan minimal 1 soal terlebih dahulu.');
    }

    if (userConfig?.probabilitas) {
      const cek = validasiProbabilitas(userConfig.probabilitas);
      if (!cek.valid) {
        throw new Error(cek.pesanError || 'Konfigurasi probabilitas tidak valid.');
      }
    }

    const configSnapshot = bangunKonfigurasiKerupukSolo(userConfig);
    const antreanSoalIds = siapkanAntreanSoalKerupuk(questions);

    const sesi: SesiKerupukSoloActive = {
      sessionId,
      playMode: 'SOLO',
      templateId: template.id,
      templateJudul: template.judul,
      hostId,
      state: 'READY',
      config: configSnapshot,
      questions: [...questions],
      antreanSoalIds,
      nomorSoalCounter: 0,
      activePresentation: null,
      pemainState: buatStateKerupukAwal(configSnapshot.targetKerupuk),
      questionStatsMap: new Map(),
    };

    sesiKerupukMap.set(sessionId, sesi);
    return sesi;
  },

  dapatkanSesi(sessionId: string): SesiKerupukSoloActive | undefined {
    return sesiKerupukMap.get(sessionId);
  },

  mulaiPermainan(sessionId: string, hostId: string): SesiKerupukSoloActive {
    const sesi = sesiKerupukMap.get(sessionId);
    if (!sesi) throw new Error('Sesi Makan Kerupuk Solo tidak ditemukan.');
    if (sesi.hostId !== hostId) {
      throw new Error('Anda tidak memiliki hak akses untuk mengendalikan sesi ini.');
    }
    if (sesi.state !== 'READY') {
      throw new Error(`Permainan tidak dapat dimulai karena berstatus ${sesi.state}.`);
    }
    if (sesi.questions.length === 0) {
      throw new Error('Bank soal kosong. Permainan tidak dapat dimulai.');
    }

    const now = Date.now();
    sesi.state = 'PLAYING';
    sesi.pemainState.waktuMulaiMs = now;
    sesi.activePresentation = buatPresentasiSoalSolo(sesi, now);
    return sesi;
  },

  jedaPermainan(sessionId: string, hostId: string): SesiKerupukSoloActive {
    const sesi = sesiKerupukMap.get(sessionId);
    if (!sesi) throw new Error('Sesi Makan Kerupuk Solo tidak ditemukan.');
    if (sesi.hostId !== hostId) {
      throw new Error('Anda tidak memiliki hak akses untuk mengendalikan sesi ini.');
    }
    if (sesi.state !== 'PLAYING') {
      throw new Error(`Permainan hanya dapat dijeda saat berstatus PLAYING (saat ini: ${sesi.state}).`);
    }

    sesi.state = 'PAUSED';
    sesi.pausedAtMs = Date.now();
    return sesi;
  },

  lanjutPermainan(sessionId: string, hostId: string): SesiKerupukSoloActive {
    const sesi = sesiKerupukMap.get(sessionId);
    if (!sesi) throw new Error('Sesi Makan Kerupuk Solo tidak ditemukan.');
    if (sesi.hostId !== hostId) {
      throw new Error('Anda tidak memiliki hak akses untuk mengendalikan sesi ini.');
    }
    if (sesi.state !== 'PAUSED') {
      throw new Error(`Permainan hanya dapat dilanjutkan dari status PAUSED (saat ini: ${sesi.state}).`);
    }

    const now = Date.now();
    if (sesi.pausedAtMs && sesi.activePresentation) {
      sesi.activePresentation.pausedDurationMs += Math.max(0, now - sesi.pausedAtMs);
    }
    sesi.pausedAtMs = undefined;
    sesi.state = 'PLAYING';
    return sesi;
  },

  ubahStatePermainan(
    sessionId: string,
    hostId: string,
    targetState: 'PLAYING' | 'PAUSED'
  ): SesiKerupukSoloActive {
    if (targetState === 'PAUSED') {
      return this.jedaPermainan(sessionId, hostId);
    }
    return this.lanjutPermainan(sessionId, hostId);
  },

  prosesJawaban(
    sessionId: string,
    hostId: string,
    input: {
      presentationId: string;
      choiceId: string;
      questionId?: string;
    },
    options?: {
      randomNormalized?: number;
      nowMs?: number;
    }
  ): {
    sesi: SesiKerupukSoloActive;
    benar: boolean;
    jawabanBenarKode: KunciPilihan;
    jawabanBenarTeks: string;
    penjelasan: string | null;
    poinDidapat: number;
    poinDasar: number;
    bonusStreak: number;
    bonusPenyelesaian: number;
    gacha: HasilGachaGigitan | null;
    sisaKerupuk: number;
    targetKerupuk: number;
    progresPersen: number;
    sisaPersen: number;
    skorTotal: number;
    skorPembelajaran: number;
    bonusKeberuntungan: number;
    bonusPenyelesaianTotal: number;
    streakBenar: number;
    isFinished: boolean;
    soalBerikutnya: SoalTampilKerupuk | null;
    gigitanLogItem: RiwayatGigitanItem;
  } {
    const sesi = sesiKerupukMap.get(sessionId);
    if (!sesi) throw new Error('Sesi Makan Kerupuk Solo tidak ditemukan.');
    if (sesi.hostId !== hostId) {
      throw new Error('Anda tidak memiliki hak akses ke sesi ini.');
    }

    if (sesi.state === 'PAUSED') {
      throw new Error('Permainan sedang dijeda (PAUSED). Lanjutkan terlebih dahulu untuk menjawab.');
    }
    if (sesi.state === 'READY') {
      throw new Error('Permainan belum dimulai (READY). Tekan Mulai terlebih dahulu.');
    }
    if (sesi.state === 'FINISHED' || sesi.state === 'STOPPED') {
      throw new Error(`Permainan sudah berakhir (${sesi.state}). Jawaban baru tidak diterima.`);
    }

    const activePres = sesi.activePresentation;
    if (!activePres) {
      throw new Error('Tidak ada soal aktif saat ini.');
    }

    if (!input.presentationId || input.presentationId !== activePres.presentationId) {
      throw new Error('ID presentasi soal tidak cocok atau soal sudah dijawab sebelumnya.');
    }

    if (input.questionId && input.questionId !== activePres.questionId) {
      throw new Error('ID soal tidak sesuai dengan soal yang sedang ditampilkan.');
    }

    if (!input.choiceId || !activePres.pilihanMap.has(input.choiceId)) {
      throw new Error('ID pilihan jawaban tidak valid untuk soal aktif.');
    }

    const sekarangMs = options?.nowMs ?? Date.now();
    const waktuJawabMs = Math.max(
      0,
      sekarangMs - activePres.tampilPadaMs - activePres.pausedDurationMs
    );

    const benar = input.choiceId === activePres.correctChoiceId;
    const pilihanBenarObj = activePres.pilihanList.find(
      (p) => p.choiceId === activePres.correctChoiceId
    );

    const prevStat = sesi.questionStatsMap.get(activePres.questionId) || {
      jumlahBenar: 0,
      jumlahSalah: 0,
    };
    if (benar) {
      prevStat.jumlahBenar += 1;
    } else {
      prevStat.jumlahSalah += 1;
    }
    sesi.questionStatsMap.set(activePres.questionId, prevStat);

    const hasilKalkulasi = hitungHasilJawabanKerupukSolo(
      sesi.pemainState,
      sesi.config,
      { questionId: activePres.questionId, nomorSoal: activePres.nomorSoal },
      benar,
      waktuJawabMs,
      sekarangMs,
      options?.randomNormalized
    );

    sesi.pemainState = hasilKalkulasi.stateUpdated;

    let soalBerikutnya: SoalTampilKerupuk | null = null;
    if (hasilKalkulasi.selesaiBaru || sesi.pemainState.sisaKerupuk <= 0) {
      sesi.state = 'FINISHED';
      sesi.activePresentation = null;
      sesi.hasil = bangunLaporanAkhirSolo(sesi, 'FINISHED', sekarangMs);
    } else {
      const nextPres = buatPresentasiSoalSolo(sesi, sekarangMs);
      sesi.activePresentation = nextPres;
      soalBerikutnya = serialisasiSoalTampilKerupuk(nextPres, sesi.questions.length);
    }

    return {
      sesi,
      benar,
      jawabanBenarKode: activePres.jawabanBenarKode,
      jawabanBenarTeks: pilihanBenarObj?.teks || '',
      penjelasan: activePres.penjelasan,
      poinDidapat: hasilKalkulasi.poinDidapat,
      poinDasar: hasilKalkulasi.poinDasar,
      bonusStreak: hasilKalkulasi.bonusStreak,
      bonusPenyelesaian: hasilKalkulasi.bonusPenyelesaian,
      gacha: hasilKalkulasi.gacha,
      sisaKerupuk: sesi.pemainState.sisaKerupuk,
      targetKerupuk: sesi.config.targetKerupuk,
      progresPersen: sesi.pemainState.progresPersen,
      sisaPersen: sesi.pemainState.sisaPersen,
      skorTotal: sesi.pemainState.skorTotal,
      skorPembelajaran: sesi.pemainState.skorPembelajaran,
      bonusKeberuntungan: sesi.pemainState.bonusKeberuntungan,
      bonusPenyelesaianTotal: sesi.pemainState.bonusPenyelesaian,
      streakBenar: sesi.pemainState.streakBenar,
      isFinished: sesi.state === 'FINISHED',
      soalBerikutnya,
      gigitanLogItem: hasilKalkulasi.gigitanLogItem,
    };
  },

  hentikanPermainan(sessionId: string, hostId: string): SesiKerupukSoloActive {
    const sesi = sesiKerupukMap.get(sessionId);
    if (!sesi) throw new Error('Sesi Makan Kerupuk Solo tidak ditemukan.');
    if (sesi.hostId !== hostId) {
      throw new Error('Anda tidak memiliki hak akses untuk menghentikan sesi ini.');
    }
    if (sesi.state === 'FINISHED' || sesi.state === 'STOPPED') {
      throw new Error(`Permainan sudah berakhir (${sesi.state}).`);
    }

    const now = Date.now();
    sesi.state = 'STOPPED';
    sesi.pausedAtMs = undefined;
    sesi.activePresentation = null;
    sesi.pemainState.waktuSelesaiMs = now;
    sesi.hasil = bangunLaporanAkhirSolo(sesi, 'STOPPED', now);
    return sesi;
  },

  ulangPermainan(
    sessionId: string,
    hostId: string,
    autoStart: boolean = false
  ): SesiKerupukSoloActive {
    const sesi = sesiKerupukMap.get(sessionId);
    if (!sesi) throw new Error('Sesi Makan Kerupuk Solo tidak ditemukan.');
    if (sesi.hostId !== hostId) {
      throw new Error('Anda tidak memiliki hak akses untuk mengulang sesi ini.');
    }

    sesi.state = 'READY';
    sesi.pausedAtMs = undefined;
    sesi.activePresentation = null;
    sesi.terakhirSoalId = undefined;
    sesi.nomorSoalCounter = 0;
    sesi.antreanSoalIds = siapkanAntreanSoalKerupuk(sesi.questions);
    sesi.pemainState = buatStateKerupukAwal(sesi.config.targetKerupuk);
    sesi.questionStatsMap = new Map();
    sesi.hasil = undefined;

    if (autoStart) {
      const now = Date.now();
      sesi.state = 'PLAYING';
      sesi.pemainState.waktuMulaiMs = now;
      sesi.activePresentation = buatPresentasiSoalSolo(sesi, now);
    }

    return sesi;
  },

  serialisasiSesiUntukClient(sesi: SesiKerupukSoloActive) {
    const st = sesi.pemainState;
    return {
      sessionId: sesi.sessionId,
      game: 'makan_kerupuk' as const,
      mode: 'solo' as const,
      playMode: 'SOLO' as const,
      templateId: sesi.templateId,
      templateJudul: sesi.templateJudul,
      state: sesi.state,
      config: sesi.config,
      totalSoalBank: sesi.questions.length,
      sisaKerupuk: st.sisaKerupuk,
      targetKerupuk: st.targetKerupuk,
      progresPersen: st.progresPersen,
      sisaPersen: st.sisaPersen,
      skorTotal: st.skorTotal,
      skorPembelajaran: st.skorPembelajaran,
      skorDasarBenar: st.skorDasarBenar,
      totalBonusStreak: st.totalBonusStreak,
      kaliBonusStreak: st.kaliBonusStreak,
      bonusKeberuntungan: st.bonusKeberuntungan,
      bonusPenyelesaian: st.bonusPenyelesaian,
      totalBenar: st.totalBenar,
      totalSalah: st.totalSalah,
      streakBenar: st.streakBenar,
      streakTertinggi: st.streakTertinggi,
      rataRataWaktuJawabMs: st.rataRataWaktuJawabMs,
      terakhirGigitan: st.terakhirGigitan,
      riwayatGigitan: st.riwayatGigitan,
      statistikGigitan: st.statistikGigitan,
      soalSaatIni:
        sesi.state === 'PLAYING' || sesi.state === 'PAUSED'
          ? serialisasiSoalTampilKerupuk(sesi.activePresentation, sesi.questions.length)
          : null,
      isFinished: sesi.state === 'FINISHED' || sesi.state === 'STOPPED',
      hasil: sesi.hasil || null,
    };
  },

  async simpanHasilKeDatabase(sessionId: string): Promise<void> {
    const sesi = sesiKerupukMap.get(sessionId);
    if (!sesi || !sesi.hasil) return;

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
            laporanKerupukSolo: laporan,
          }),
        },
      });

      await tx.sessionResult.upsert({
        where: { sessionId: sesi.sessionId },
        update: {
          timMenang: laporan.statusAkhir === 'FINISHED' ? 'Selesai (Ludes)' : 'Dihentikan Guru',
          posisiAkhir: laporan.progresPersen,
          skorMerah: laporan.skorTotal,
          skorPutih: laporan.sisaKerupuk,
        },
        create: {
          sessionId: sesi.sessionId,
          timMenang: laporan.statusAkhir === 'FINISHED' ? 'Selesai (Ludes)' : 'Dihentikan Guru',
          posisiAkhir: laporan.progresPersen,
          skorMerah: laporan.skorTotal,
          skorPutih: laporan.sisaKerupuk,
        },
      });

      await tx.questionStat.deleteMany({
        where: { sessionId: sesi.sessionId },
      });

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

  async muatLaporanDariDatabase(sessionId: string): Promise<LaporanKerupukSolo | null> {
    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: {
          include: { questions: true },
        },
        result: true,
        questionStats: true,
      },
    });

    if (!sessionDb || sessionDb.template.game !== 'makan_kerupuk' || sessionDb.mode !== 'solo') {
      return null;
    }

    if (sessionDb.konfigurasi) {
      try {
        const parsed = JSON.parse(sessionDb.konfigurasi);
        if (parsed?.laporanKerupukSolo) {
          return {
            playMode: 'SOLO',
            ...parsed.laporanKerupukSolo,
          } as LaporanKerupukSolo;
        }
      } catch {
        // fallback ke result DB
      }
    }

    if (!sessionDb.result) return null;

    let parsedConfig: KonfigurasiKerupukSolo = bangunKonfigurasiKerupukSolo();
    if (sessionDb.konfigurasi) {
      try {
        const raw = JSON.parse(sessionDb.konfigurasi);
        parsedConfig = bangunKonfigurasiKerupukSolo(raw?.config || raw);
      } catch {
        // default
      }
    }

    const totalBenar = sessionDb.questionStats.reduce((a, b) => a + b.jumlahBenar, 0);
    const totalSalah = sessionDb.questionStats.reduce((a, b) => a + b.jumlahSalah, 0);
    const totalJawab = totalBenar + totalSalah;

    return {
      sessionId: sessionDb.id,
      playMode: 'SOLO',
      templateId: sessionDb.templateId,
      templateJudul: sessionDb.template.judul,
      statusAkhir: sessionDb.result.skorPutih === 0 ? 'FINISHED' : 'STOPPED',
      dihentikanManual: sessionDb.result.skorPutih > 0,
      konfigurasi: parsedConfig,
      targetKerupuk: parsedConfig.targetKerupuk,
      sisaKerupuk: sessionDb.result.skorPutih,
      progresPersen: sessionDb.result.posisiAkhir,
      skorTotal: sessionDb.result.skorMerah,
      skorPembelajaran: 0,
      skorDasarBenar: 0,
      totalBonusStreak: 0,
      kaliBonusStreak: 0,
      bonusKeberuntungan: 0,
      bonusPenyelesaian: sessionDb.result.skorPutih === 0 ? 100 : 0,
      totalBenar,
      totalSalah,
      akurasiPersen: totalJawab > 0 ? Math.round((totalBenar / totalJawab) * 100) : 0,
      streakTertinggi: 0,
      rataRataWaktuJawabMs: 0,
      durasiBermainMs: 0,
      statistikGigitan: { besar: 0, sedang: 0, kecil: 0, sangat_kecil: 0, zonk: 0 },
      riwayatGigitan: [],
      totalSoalBank: sessionDb.template.questions.length,
    };
  },

  async pulihkanSesiDariDb(sessionId: string): Promise<SesiKerupukSoloActive | null> {
    const existing = sesiKerupukMap.get(sessionId);
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

    if (!sessionDb || sessionDb.template.game !== 'makan_kerupuk' || sessionDb.mode !== 'solo') {
      return null;
    }

    let rawConfig: any;
    let laporanDb: LaporanKerupukSolo | undefined;
    if (sessionDb.konfigurasi) {
      try {
        const parsed = JSON.parse(sessionDb.konfigurasi);
        rawConfig = parsed?.config || parsed;
        if (parsed?.laporanKerupukSolo) {
          laporanDb = parsed.laporanKerupukSolo as LaporanKerupukSolo;
        }
      } catch {
        rawConfig = undefined;
      }
    }

    const config = bangunKonfigurasiKerupukSolo(rawConfig);
    const questions: SoalKerupuk[] = sessionDb.template.questions.map(mapDbQuestionForGame);

    if (sessionDb.status === 'selesai') {
      const laporan = laporanDb || (await this.muatLaporanDariDatabase(sessionId)) || undefined;
      const stateSelesai: StateKerupukSolo =
        laporan?.statusAkhir === 'FINISHED' ? 'FINISHED' : 'STOPPED';
      const st = buatStateKerupukAwal(config.targetKerupuk);
      if (laporan) {
        st.sisaKerupuk = laporan.sisaKerupuk;
        st.progresPersen = laporan.progresPersen;
        st.sisaPersen = 100 - laporan.progresPersen;
        st.skorTotal = laporan.skorTotal;
        st.skorPembelajaran = laporan.skorPembelajaran;
        st.skorDasarBenar = laporan.skorDasarBenar;
        st.totalBonusStreak = laporan.totalBonusStreak;
        st.kaliBonusStreak = laporan.kaliBonusStreak;
        st.bonusKeberuntungan = laporan.bonusKeberuntungan;
        st.bonusPenyelesaian = laporan.bonusPenyelesaian;
        st.totalBenar = laporan.totalBenar;
        st.totalSalah = laporan.totalSalah;
        st.streakTertinggi = laporan.streakTertinggi;
        st.rataRataWaktuJawabMs = laporan.rataRataWaktuJawabMs;
        st.statistikGigitan = laporan.statistikGigitan;
        st.riwayatGigitan = laporan.riwayatGigitan;
        st.selesaiKerupuk = laporan.statusAkhir === 'FINISHED';
      }

      const restoredFinished: SesiKerupukSoloActive = {
        sessionId: sessionDb.id,
        playMode: 'SOLO',
        templateId: sessionDb.templateId,
        templateJudul: sessionDb.template.judul,
        hostId: sessionDb.hostId,
        state: stateSelesai,
        config,
        questions,
        antreanSoalIds: [],
        nomorSoalCounter: laporan ? laporan.riwayatGigitan.length : 0,
        activePresentation: null,
        pemainState: st,
        questionStatsMap: new Map(),
        hasil: laporan,
      };
      sesiKerupukMap.set(sessionId, restoredFinished);
      return restoredFinished;
    }

    if (questions.length === 0) {
      return null;
    }

    const restored = this.inisialisasiSesi(
      sessionDb.id,
      sessionDb.hostId,
      { id: sessionDb.template.id, judul: sessionDb.template.judul },
      questions,
      config
    );

    if (sessionDb.status === 'jalan') {
      return this.mulaiPermainan(sessionDb.id, sessionDb.hostId);
    }

    return restored;
  },

  hapusSesi(sessionId: string): void {
    sesiKerupukMap.delete(sessionId);
  },
};
