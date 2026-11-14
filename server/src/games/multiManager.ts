import crypto from 'crypto';
import {
  TimTarikTambang,
  KodePowerUpTarikTambang,
  KonfigurasiTarikTambang,
  PresentasiSoalTarikTambang,
  SoalBankTarikTambang,
  AnalisisHeatmapTarik,
  RiwayatJawabanSiswaTarik,
  bangunKonfigurasiTarikTambang,
  filterBankSoalSetara,
  siapkanAntreanSoalTarik,
  buatPresentasiSoalTarik,
  validasiJawabanTarikTambang,
  serialisasiSoalUntukClient,
  perbaruiStreakIndividu,
  tentukanHadiahPowerUp,
  evaluasiTarikanMulti,
  cekKondisiSelesai,
  tentukanPemenang,
  ambilKataTerpelesetTarik,
  bangunAnalisisHeatmapTarik,
} from './tarikTambang.js';
import { prisma } from '../db.js';
import { mapDbQuestionForGame } from '../utils/questionOptions.js';

const TX_TIMEOUT = { maxWait: 10000, timeout: 15000 } as const;

export type SoalMulti = SoalBankTarikTambang;

export interface PesertaMulti {
  id: string;
  secretToken: string;
  socketId: string;
  nama: string;
  tim: TimTarikTambang | null;
  connected: boolean;
  totalBenar: number;
  totalSalah: number;
  jumlahJawab: number;
  totalWaktuJawabMs: number;
  rataRataWaktuJawabMs: number;
  streakSaatIni: number;
  streakTertinggi: number;
  milestone3SudahDapat: boolean;
  milestone5SudahDapat: boolean;
  nomorSoalPemain: number;
  soalTerakhirId: string | null;
  antreanSoal: SoalBankTarikTambang[];
  presentasiAktif: PresentasiSoalTarikTambang | null;
  questionEndsAtMs: number | null;
  riwayatJawaban: RiwayatJawabanSiswaTarik[];
}

export interface TimPowerUpMulti {
  tim: TimTarikTambang;
  bank: KodePowerUpTarikTambang | null;
  aktifBerikutnya: KodePowerUpTarikTambang | null;
}

export interface LaporanSiswaMulti {
  id: string;
  nama: string;
  tim: TimTarikTambang;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakTertinggi: number;
  rataRataWaktuJawabMs: number;
}

export interface RingkasanTimMulti {
  id: TimTarikTambang;
  nama: string;
  warna: string;
  jumlahAnggota: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
}

export interface LaporanTarikTambangMulti {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  playMode: 'MULTIPLAYER';
  alasanSelesai: 'garis_menang' | 'waktu_habis' | 'manual';
  konfigurasi: KonfigurasiTarikTambang;
  timMenang: TimTarikTambang | 'seri';
  namaTim1: string;
  namaTim2: string;
  posisiAkhir: number;
  skorMerah: number;
  skorPutih: number;
  totalPeserta: number;
  totalSoalDijawab: number;
  akurasiTim1: number;
  akurasiTim2: number;
  akurasiTim1Persen: number;
  akurasiTim2Persen: number;
  teamSummary: RingkasanTimMulti[];
  analisisHeatmap: AnalisisHeatmapTarik;
  laporanSiswa: LaporanSiswaMulti[];
  questionStats: Array<{
    questionId: string;
    nomorSoal: number;
    teksSoal: string;
    jumlahBenar: number;
    jumlahSalah: number;
  }>;
  dihentikanManual: boolean;
  selesaiPada: string;
}

export interface SesiMultiplayerActive {
  sessionId: string;
  token: string;
  hostId: string;
  hostSocketId: string | null;
  templateId: string;
  templateJudul: string;
  status: 'lobi' | 'jalan' | 'jeda' | 'selesai';
  pausedAtMs?: number | null;
  config: KonfigurasiTarikTambang;
  poolSetara: SoalBankTarikTambang[];
  questions: SoalBankTarikTambang[];
  totalSoal: number;
  taliPosition: number;
  skorMerah: number;
  skorPutih: number;
  totalSoalDijawab: number;
  peserta: Map<string, PesertaMulti>;
  powerUpTim1: TimPowerUpMulti;
  powerUpTim2: TimPowerUpMulti;
  questionStatsMap: Map<string, { jumlahBenar: number; jumlahSalah: number }>;
  matchStartedAtMs: number | null;
  matchEndsAtMs: number | null;
  savedToDb: boolean;
  savingPromise: Promise<void> | null;
  hasil?: LaporanTarikTambangMulti;
}

function hitungAkurasi(benar: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((benar / total) * 100);
}

function susunLaporanAkhirMulti(
  sesi: SesiMultiplayerActive,
  alasanSelesai: 'garis_menang' | 'waktu_habis' | 'manual'
): LaporanTarikTambangMulti {
  const allStudents = Array.from(sesi.peserta.values());
  const merahMembers = allStudents.filter((p) => p.tim === 'merah');
  const biruMembers = allStudents.filter((p) => p.tim === 'putih');

  const mBenar = merahMembers.reduce((s, p) => s + p.totalBenar, 0);
  const mSalah = merahMembers.reduce((s, p) => s + p.totalSalah, 0);
  const bBenar = biruMembers.reduce((s, p) => s + p.totalBenar, 0);
  const bSalah = biruMembers.reduce((s, p) => s + p.totalSalah, 0);

  const akurasi1 = hitungAkurasi(mBenar, mBenar + mSalah);
  const akurasi2 = hitungAkurasi(bBenar, bBenar + bSalah);
  const timMenang = tentukanPemenang(sesi.taliPosition);

  const teamsMeta: Array<{ id: TimTarikTambang; nama: string; warna: string }> = [
    { id: 'merah', nama: sesi.config.namaTim1, warna: '#e2312d' },
    { id: 'putih', nama: sesi.config.namaTim2, warna: '#1d8fe0' },
  ];

  const teamSummary: RingkasanTimMulti[] = [
    {
      id: 'merah',
      nama: sesi.config.namaTim1,
      warna: '#e2312d',
      jumlahAnggota: merahMembers.length,
      totalBenar: mBenar,
      totalSalah: mSalah,
      akurasiPersen: akurasi1,
    },
    {
      id: 'putih',
      nama: sesi.config.namaTim2,
      warna: '#1d8fe0',
      jumlahAnggota: biruMembers.length,
      totalBenar: bBenar,
      totalSalah: bSalah,
      akurasiPersen: akurasi2,
    },
  ];

  const laporanSiswa: LaporanSiswaMulti[] = allStudents
    .map((p) => ({
      id: p.id,
      nama: p.nama,
      tim: (p.tim || 'merah') as TimTarikTambang,
      totalBenar: p.totalBenar,
      totalSalah: p.totalSalah,
      akurasiPersen: hitungAkurasi(p.totalBenar, p.totalBenar + p.totalSalah),
      streakTertinggi: p.streakTertinggi,
      rataRataWaktuJawabMs: p.rataRataWaktuJawabMs,
    }))
    .sort((a, b) => b.totalBenar - a.totalBenar || b.akurasiPersen - a.akurasiPersen);

  const analisisHeatmap = bangunAnalisisHeatmapTarik(
    sesi.poolSetara,
    teamsMeta,
    allStudents.map((s) => ({
      id: s.id,
      nama: s.nama,
      tim: s.tim,
      riwayatJawaban: s.riwayatJawaban,
    }))
  );

  return {
    sessionId: sesi.sessionId,
    templateId: sesi.templateId,
    templateJudul: sesi.templateJudul,
    playMode: 'MULTIPLAYER',
    alasanSelesai,
    konfigurasi: sesi.config,
    timMenang,
    namaTim1: sesi.config.namaTim1,
    namaTim2: sesi.config.namaTim2,
    posisiAkhir: sesi.taliPosition,
    skorMerah: sesi.skorMerah,
    skorPutih: sesi.skorPutih,
    totalPeserta: allStudents.length,
    totalSoalDijawab: sesi.totalSoalDijawab,
    akurasiTim1: akurasi1,
    akurasiTim2: akurasi2,
    akurasiTim1Persen: akurasi1,
    akurasiTim2Persen: akurasi2,
    teamSummary,
    analisisHeatmap,
    laporanSiswa,
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
    dihentikanManual: alasanSelesai === 'manual',
    selesaiPada: new Date().toISOString(),
  };
}

class MultiSessionManager {
  private sessions = new Map<string, SesiMultiplayerActive>();
  private tokenToSessionId = new Map<string, string>();
  private socketToPeserta = new Map<string, { sessionId: string; pesertaId: string }>();

  inisialisasiSesi(
    sessionId: string,
    token: string,
    hostId: string,
    template: { id: string; judul: string },
    questions: SoalBankTarikTambang[],
    rawConfig?: Partial<KonfigurasiTarikTambang>
  ): SesiMultiplayerActive {
    if (!questions || questions.length < 2) {
      throw new Error('Minimal dibutuhkan 2 soal untuk sesi Multiplayer Tarik Tambang.');
    }

    const config = bangunKonfigurasiTarikTambang(rawConfig);
    const poolSetara = filterBankSoalSetara(questions, config.kesulitan);
    const questionStatsMap = new Map<string, { jumlahBenar: number; jumlahSalah: number }>();
    for (const q of questions) {
      questionStatsMap.set(q.id, { jumlahBenar: 0, jumlahSalah: 0 });
    }

    const sesi: SesiMultiplayerActive = {
      sessionId,
      token,
      hostId,
      hostSocketId: null,
      templateId: template.id,
      templateJudul: template.judul,
      status: 'lobi',
      config,
      poolSetara,
      questions,
      totalSoal: poolSetara.length,
      taliPosition: 0,
      skorMerah: 0,
      skorPutih: 0,
      totalSoalDijawab: 0,
      peserta: new Map(),
      powerUpTim1: { tim: 'merah', bank: null, aktifBerikutnya: null },
      powerUpTim2: { tim: 'putih', bank: null, aktifBerikutnya: null },
      questionStatsMap,
      matchStartedAtMs: null,
      matchEndsAtMs: null,
      pausedAtMs: null,
      savedToDb: false,
      savingPromise: null,
    };

    this.sessions.set(sessionId, sesi);
    this.tokenToSessionId.set(token, sessionId);
    return sesi;
  }

  private siapkanSoalUntukPesertaInternal(
    sesi: SesiMultiplayerActive,
    p: PesertaMulti
  ): PresentasiSoalTarikTambang {
    if (p.antreanSoal.length === 0) {
      p.antreanSoal = siapkanAntreanSoalTarik(sesi.poolSetara, p.soalTerakhirId);
    }
    const soal = p.antreanSoal.shift()!;
    p.nomorSoalPemain += 1;
    p.soalTerakhirId = soal.id;
    const pres = buatPresentasiSoalTarik(
      soal,
      p.nomorSoalPemain,
      sesi.poolSetara.length,
      sesi.config.waktuPerSoalDetik,
      true
    );
    p.presentasiAktif = pres;
    p.questionEndsAtMs = Date.now() + sesi.config.waktuPerSoalDetik * 1000;
    return pres;
  }

  async pulihkanSesiDariDb(sessionId: string): Promise<SesiMultiplayerActive | null> {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;

    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: { include: { questions: { orderBy: { urutan: 'asc' } } } },
        result: true,
        questionStats: { include: { question: true } },
      },
    });

    if (
      !sessionDb ||
      sessionDb.mode !== 'multi' ||
      sessionDb.template.game !== 'tarik_tambang' ||
      !sessionDb.token
    ) {
      return null;
    }

    let parsedJson: any = {};
    if (sessionDb.konfigurasi) {
      try {
        parsedJson = JSON.parse(sessionDb.konfigurasi);
      } catch {
        parsedJson = {};
      }
    }

    const mapped = sessionDb.template.questions.map(mapDbQuestionForGame);
    if (mapped.length < 2) return null;

    const sesi = this.inisialisasiSesi(
      sessionDb.id,
      sessionDb.token,
      sessionDb.hostId,
      { id: sessionDb.templateId, judul: sessionDb.template.judul },
      mapped,
      parsedJson?.config || parsedJson
    );

    if (Array.isArray(parsedJson?.pesertaSnapshot)) {
      for (const snap of parsedJson.pesertaSnapshot) {
        const tim: TimTarikTambang =
          snap.tim === 'putih' ? 'putih' : 'merah';
        sesi.peserta.set(snap.id, {
          id: snap.id,
          secretToken: snap.secretToken || crypto.randomUUID(),
          socketId: '',
          nama: snap.nama,
          tim,
          connected: false,
          totalBenar: snap.totalBenar ?? 0,
          totalSalah: snap.totalSalah ?? 0,
          jumlahJawab: (snap.totalBenar ?? 0) + (snap.totalSalah ?? 0),
          totalWaktuJawabMs: 0,
          rataRataWaktuJawabMs: snap.rataRataWaktuJawabMs ?? 0,
          streakSaatIni: snap.streakSaatIni ?? 0,
          streakTertinggi: snap.streakTertinggi ?? 0,
          milestone3SudahDapat: false,
          milestone5SudahDapat: false,
          nomorSoalPemain: snap.nomorSoalPemain ?? 0,
          soalTerakhirId: null,
          antreanSoal: [],
          presentasiAktif: null,
          questionEndsAtMs: null,
          riwayatJawaban: Array.isArray(snap.riwayatJawaban) ? snap.riwayatJawaban : [],
        });
      }
    }

    if (sessionDb.status === 'selesai') {
      sesi.status = 'selesai';
      sesi.taliPosition = sessionDb.result?.posisiAkhir ?? 0;
      sesi.skorMerah = sessionDb.result?.skorMerah ?? 0;
      sesi.skorPutih = sessionDb.result?.skorPutih ?? 0;
      sesi.savedToDb = true;
      sesi.hasil =
        parsedJson?.laporanTarikMulti ||
        susunLaporanAkhirMulti(sesi, 'manual');
    } else if (sessionDb.status === 'jalan') {
      sesi.status = 'jalan';
      const durasiMs = Math.max(30, sesi.config.durasiLombaDetik || 180) * 1000;
      const started = sessionDb.mulaiPada?.getTime() || Date.now();
      sesi.matchStartedAtMs = started;
      sesi.matchEndsAtMs = started + durasiMs;
      for (const p of sesi.peserta.values()) {
        if (!p.presentasiAktif) {
          this.siapkanSoalUntukPesertaInternal(sesi, p);
        }
      }
    }

    return sesi;
  }

  dapatkanSesi(sessionId: string): SesiMultiplayerActive | undefined {
    return this.sessions.get(sessionId);
  }

  dapatkanSesiDariToken(token: string): SesiMultiplayerActive | undefined {
    const id = this.tokenToSessionId.get(token);
    return id ? this.sessions.get(id) : undefined;
  }

  dapatkanInfoSocket(socketId: string) {
    return this.socketToPeserta.get(socketId);
  }

  gabungPeserta(
    token: string,
    nama: string,
    socketId: string,
    reconnectPesertaId?: string,
    reconnectSecret?: string
  ): {
    peserta: PesertaMulti;
    sesi: SesiMultiplayerActive;
    isReconnect: boolean;
  } {
    const sesi = this.dapatkanSesiDariToken(token);
    if (!sesi) {
      throw new Error('Kode PIN tidak ditemukan atau sesi telah berakhir.');
    }

    if (reconnectPesertaId) {
      const existing = sesi.peserta.get(reconnectPesertaId);
      if (existing) {
        if (existing.secretToken && existing.secretToken !== reconnectSecret) {
          throw new Error('Token autentikasi peserta tidak valid.');
        }
        if (existing.socketId) {
          this.socketToPeserta.delete(existing.socketId);
        }
        existing.socketId = socketId;
        existing.connected = true;
        this.socketToPeserta.set(socketId, {
          sessionId: sesi.sessionId,
          pesertaId: existing.id,
        });
        return { peserta: existing, sesi, isReconnect: true };
      }
    }

    const cleanName = nama.trim();
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Nama panggilan minimal 2 karakter.');
    }

    if (sesi.status === 'selesai') {
      throw new Error('Permainan sudah selesai.');
    }
    if (sesi.status === 'jalan' && !sesi.config.allowLateJoin) {
      throw new Error('Permainan sudah dimulai. Peserta baru tidak dapat bergabung.');
    }

    if (sesi.peserta.size >= sesi.config.maxPeserta) {
      throw new Error(`Ruang sudah penuh (maksimal ${sesi.config.maxPeserta} siswa).`);
    }

    const dup = Array.from(sesi.peserta.values()).find(
      (p) => p.nama.toLowerCase() === cleanName.toLowerCase()
    );
    if (dup) {
      throw new Error(`Nama "${cleanName}" sudah digunakan di ruang ini.`);
    }

    const all = Array.from(sesi.peserta.values());
    const cMerah = all.filter((p) => p.tim === 'merah').length;
    const cBiru = all.filter((p) => p.tim === 'putih').length;
    const tim: TimTarikTambang = cMerah <= cBiru ? 'merah' : 'putih';

    const peserta: PesertaMulti = {
      id: crypto.randomUUID(),
      secretToken: crypto.randomUUID(),
      socketId,
      nama: cleanName,
      tim,
      connected: true,
      totalBenar: 0,
      totalSalah: 0,
      jumlahJawab: 0,
      totalWaktuJawabMs: 0,
      rataRataWaktuJawabMs: 0,
      streakSaatIni: 0,
      streakTertinggi: 0,
      milestone3SudahDapat: false,
      milestone5SudahDapat: false,
      nomorSoalPemain: 0,
      soalTerakhirId: null,
      antreanSoal: [],
      presentasiAktif: null,
      questionEndsAtMs: null,
      riwayatJawaban: [],
    };

    if (sesi.status === 'jalan') {
      this.siapkanSoalUntukPesertaInternal(sesi, peserta);
    }

    sesi.peserta.set(peserta.id, peserta);
    this.socketToPeserta.set(socketId, {
      sessionId: sesi.sessionId,
      pesertaId: peserta.id,
    });

    return { peserta, sesi, isReconnect: false };
  }

  andaiTerputus(socketId: string) {
    const info = this.socketToPeserta.get(socketId);
    if (!info) return null;
    this.socketToPeserta.delete(socketId);
    const sesi = this.sessions.get(info.sessionId);
    if (!sesi) return null;
    const p = sesi.peserta.get(info.pesertaId);
    if (!p) return null;
    if (sesi.status === 'lobi') {
      sesi.peserta.delete(info.pesertaId);
      return { sesi, peserta: p, wasRemoved: true };
    }
    p.connected = false;
    return { sesi, peserta: p, wasRemoved: false };
  }

  acakUlangTim(sessionId: string, hostId: string): PesertaMulti[] {
    const sesi = this.sessions.get(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');
    if (sesi.hostId !== hostId) throw new Error('Tidak memiliki otoritas atas sesi ini.');
    if (sesi.status !== 'lobi') {
      throw new Error('Acak tim hanya dapat dilakukan saat di lobi sebelum mulai.');
    }

    const list = Array.from(sesi.peserta.values());
    for (let i = list.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
    list.forEach((p, idx) => {
      p.tim = idx % 2 === 0 ? 'merah' : 'putih';
    });
    return list;
  }

  pindahTimPeserta(
    sessionId: string,
    hostId: string,
    pesertaId: string,
    timTujuan: TimTarikTambang
  ): PesertaMulti {
    const sesi = this.sessions.get(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');
    if (sesi.hostId !== hostId) throw new Error('Tidak memiliki otoritas.');
    if (sesi.status !== 'lobi') {
      throw new Error('Tidak dapat memindahkan tim setelah permainan dimulai.');
    }
    const p = sesi.peserta.get(pesertaId);
    if (!p) throw new Error('Peserta tidak ditemukan.');
    p.tim = timTujuan;
    return p;
  }

  keluarkanPeserta(sessionId: string, hostId: string, pesertaId: string): PesertaMulti {
    const sesi = this.sessions.get(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');
    if (sesi.hostId !== hostId) throw new Error('Tidak memiliki otoritas atas sesi ini.');
    if (sesi.status !== 'lobi') {
      throw new Error('Hanya dapat mengeluarkan siswa saat masih di lobi.');
    }
    const p = sesi.peserta.get(pesertaId);
    if (!p) throw new Error('Peserta tidak ditemukan.');
    sesi.peserta.delete(pesertaId);
    return p;
  }

  mulaiPermainan(sessionId: string, hostId: string): SesiMultiplayerActive {
    const sesi = this.sessions.get(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');
    if (sesi.hostId !== hostId) throw new Error('Hanya guru pembuat sesi yang bisa memulai.');
    if (sesi.status !== 'lobi') throw new Error('Permainan sudah dimulai atau selesai.');
    if (sesi.peserta.size < 1) {
      throw new Error('Minimal butuh 1 siswa di lobi sebelum memulai lomba.');
    }

    const merahCount = Array.from(sesi.peserta.values()).filter((p) => p.tim === 'merah').length;
    const biruCount = Array.from(sesi.peserta.values()).filter((p) => p.tim === 'putih').length;
    if (sesi.peserta.size >= 2 && (merahCount === 0 || biruCount === 0)) {
      this.acakUlangTim(sessionId, hostId);
    }

    const now = Date.now();
    const durasiMs = Math.max(30, sesi.config.durasiLombaDetik || 180) * 1000;
    sesi.status = 'jalan';
    sesi.matchStartedAtMs = now;
    sesi.matchEndsAtMs = now + durasiMs;

    for (const p of sesi.peserta.values()) {
      p.totalBenar = 0;
      p.totalSalah = 0;
      p.jumlahJawab = 0;
      p.totalWaktuJawabMs = 0;
      p.rataRataWaktuJawabMs = 0;
      p.streakSaatIni = 0;
      p.streakTertinggi = 0;
      p.nomorSoalPemain = 0;
      p.antreanSoal = [];
      p.riwayatJawaban = [];
      p.presentasiAktif = null;
      p.questionEndsAtMs = 0;
    }

    return sesi;
  }

  jedaPermainan(sessionId: string, hostId: string): SesiMultiplayerActive {
    const sesi = this.sessions.get(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');
    if (sesi.hostId !== hostId) throw new Error('Hanya guru pemilik sesi yang berhak menjeda.');
    if (sesi.status !== 'jalan') {
      throw new Error('Hanya permainan yang sedang berlangsung yang dapat dijeda.');
    }
    sesi.status = 'jeda';
    sesi.pausedAtMs = Date.now();
    return sesi;
  }

  lanjutPermainan(
    sessionId: string,
    hostId: string
  ): { sesi: SesiMultiplayerActive; pauseDuration: number } {
    const sesi = this.sessions.get(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');
    if (sesi.hostId !== hostId) throw new Error('Hanya guru pemilik sesi yang berhak melanjutkan.');
    if (sesi.status !== 'jeda') {
      throw new Error('Permainan tidak sedang dalam kondisi jeda.');
    }
    const pauseDuration = Math.max(0, Date.now() - (sesi.pausedAtMs || Date.now()));
    if (sesi.matchEndsAtMs) {
      sesi.matchEndsAtMs += pauseDuration;
    }
    for (const p of sesi.peserta.values()) {
      if (p.questionEndsAtMs) {
        p.questionEndsAtMs += pauseDuration;
      }
    }
    sesi.status = 'jalan';
    sesi.pausedAtMs = null;
    return { sesi, pauseDuration };
  }

  dapatkanSoalAktifPeserta(sessionId: string, pesertaId: string) {
    const sesi = this.sessions.get(sessionId);
    if (!sesi || sesi.status !== 'jalan') return null;
    const p = sesi.peserta.get(pesertaId);
    if (!p) return null;
    if (!p.presentasiAktif) {
      this.siapkanSoalUntukPesertaInternal(sesi, p);
    }
    if (!p.presentasiAktif) return null;
    return {
      game: 'tarik_tambang' as const,
      ...serialisasiSoalUntukClient(p.presentasiAktif),
      endsAt: p.questionEndsAtMs || Date.now() + sesi.config.waktuPerSoalDetik * 1000,
      duration: sesi.config.waktuPerSoalDetik,
      matchEndsAt: sesi.matchEndsAtMs,
      serverNowMs: Date.now(),
    };
  }

  siapkanSoalBerikutnyaPeserta(sessionId: string, pesertaId: string) {
    const sesi = this.sessions.get(sessionId);
    if (!sesi || sesi.status !== 'jalan') return null;
    const p = sesi.peserta.get(pesertaId);
    if (!p) return null;
    const pres = this.siapkanSoalUntukPesertaInternal(sesi, p);
    return {
      game: 'tarik_tambang' as const,
      ...serialisasiSoalUntukClient(pres),
      endsAt: p.questionEndsAtMs || Date.now() + sesi.config.waktuPerSoalDetik * 1000,
      duration: sesi.config.waktuPerSoalDetik,
      matchEndsAt: sesi.matchEndsAtMs,
      serverNowMs: Date.now(),
    };
  }

  aktifkanPowerUpTim(
    sessionId: string,
    pesertaId: string,
    timRaw?: string
  ): {
    tim: TimTarikTambang;
    powerUp: KodePowerUpTarikTambang;
    pesertaNama: string;
    sesi: SesiMultiplayerActive;
  } {
    const sesi = this.sessions.get(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');
    if (!sesi.config.powerUpAktif) {
      throw new Error('Power-Up dinonaktifkan pada sesi ini.');
    }
    const p = sesi.peserta.get(pesertaId);
    if (!p || !p.tim) throw new Error('Peserta tidak ditemukan di ruang.');
    if (timRaw && timRaw !== p.tim) {
      throw new Error('Tidak dapat mengaktifkan Power-Up milik tim lawan.');
    }

    const pu = p.tim === 'merah' ? sesi.powerUpTim1 : sesi.powerUpTim2;
    if (!pu.bank) throw new Error('Tim belum memiliki Power-Up untuk diaktifkan.');
    if (pu.aktifBerikutnya) throw new Error('Power-Up sudah diaktifkan.');

    pu.aktifBerikutnya = pu.bank;
    pu.bank = null;
    return { tim: p.tim, powerUp: pu.aktifBerikutnya, pesertaNama: p.nama, sesi };
  }

  prosesJawabanSiswa(
    sessionId: string,
    pesertaId: string,
    input: {
      presentationId?: string;
      choiceId?: string;
      jawabanDipilih?: string;
      timedOut?: boolean;
    }
  ): {
    sesi: SesiMultiplayerActive;
    peserta: PesertaMulti;
    tim: TimTarikTambang;
    benar: boolean;
    timedOut: boolean;
    slipQuote: string | null;
    deltaTali: number;
    taliPosition: number;
    skorMerah: number;
    skorPutih: number;
    pullerIdx: number;
    jawabanBenarKode: string;
    jawabanBenarTeks: string;
    penjelasan: string | null;
    selesai: boolean;
    hasil?: LaporanTarikTambangMulti;
  } {
    const sesi = this.sessions.get(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');
    if (sesi.status === 'jeda') {
      throw new Error('Permainan sedang dijeda oleh Guru.');
    }
    if (sesi.status !== 'jalan') {
      throw new Error('Permainan sedang tidak berlangsung.');
    }

    const p = sesi.peserta.get(pesertaId);
    if (!p || !p.tim) throw new Error('Peserta tidak valid.');
    const pres = p.presentasiAktif;
    if (!pres) {
      throw new Error('Soal berikutnya sedang disiapkan, mohon tunggu sebentar.');
    }

    if (input.presentationId && input.presentationId !== pres.presentationId) {
      throw new Error('Soal tidak cocok atau milik siswa lain.');
    }

    const val = validasiJawabanTarikTambang(pres, {
      choiceId: input.choiceId,
      jawabanDipilih: input.jawabanDipilih,
      timedOut: input.timedOut,
    });

    // Kosongkan presentasi aktif segera agar tidak bisa double-submit
    p.presentasiAktif = null;
    p.questionEndsAtMs = null;

    const jawMs = Math.max(
      200,
      Math.min(60000, Date.now() - (pres.ditampilkanPadaMs || Date.now()))
    );
    p.jumlahJawab += 1;
    p.totalWaktuJawabMs += jawMs;
    p.rataRataWaktuJawabMs = Math.round(p.totalWaktuJawabMs / p.jumlahJawab);
    sesi.totalSoalDijawab += 1;

    if (val.benar) {
      p.totalBenar += 1;
    } else {
      p.totalSalah += 1;
    }

    p.riwayatJawaban.push({
      questionId: pres.questionId,
      benar: val.benar,
      timedOut: val.timedOut,
      jawabanKey: val.kodeDipilih,
      jawabanTeks: val.teksDipilih,
    });

    const qStat = sesi.questionStatsMap.get(pres.questionId) || {
      jumlahBenar: 0,
      jumlahSalah: 0,
    };
    if (val.benar) qStat.jumlahBenar += 1;
    else qStat.jumlahSalah += 1;
    sesi.questionStatsMap.set(pres.questionId, qStat);

    const streakRes = perbaruiStreakIndividu({
      streakSaatIni: p.streakSaatIni,
      streakTertinggi: p.streakTertinggi,
      milestone3SudahDapat: p.milestone3SudahDapat,
      milestone5SudahDapat: p.milestone5SudahDapat,
      benar: val.benar,
      bonusAktif: sesi.config.bonusAktif,
    });
    p.streakSaatIni = streakRes.streakBaru;
    p.streakTertinggi = streakRes.streakTertinggiBaru;
    p.milestone3SudahDapat = streakRes.milestone3SudahDapat;
    p.milestone5SudahDapat = streakRes.milestone5SudahDapat;

    const teamMembers = Array.from(sesi.peserta.values()).filter((m) => m.tim === p.tim);
    const pullerIdx = Math.max(0, teamMembers.findIndex((m) => m.id === p.id));

    const myPu = p.tim === 'merah' ? sesi.powerUpTim1 : sesi.powerUpTim2;
    const oppPu = p.tim === 'merah' ? sesi.powerUpTim2 : sesi.powerUpTim1;
    const evalPull = evaluasiTarikanMulti({
      posisiLama: sesi.taliPosition,
      tim: p.tim,
      jumlahAnggotaTim: teamMembers.length,
      benar: val.benar,
      config: sesi.config,
      bonusStreak: streakRes.bonusDidapat,
      powerUpAktif: myPu.aktifBerikutnya,
      powerUpLawan: oppPu.aktifBerikutnya,
    });

    sesi.taliPosition = evalPull.posisiBaru;
    if (val.benar && myPu.aktifBerikutnya) myPu.aktifBerikutnya = null;
    if (val.benar && oppPu.aktifBerikutnya === 'pertahanan_kuat') oppPu.aktifBerikutnya = null;

    myPu.bank = tentukanHadiahPowerUp({
      powerUpAktif: sesi.config.powerUpAktif,
      bankSaatIni: myPu.bank,
      streakBaru: p.streakSaatIni,
      akurasiRondePersen: val.benar ? 100 : 0,
    });

    const allStudents = Array.from(sesi.peserta.values());
    sesi.skorMerah = allStudents
      .filter((s) => s.tim === 'merah')
      .reduce((acc, s) => acc + s.totalBenar, 0);
    sesi.skorPutih = allStudents
      .filter((s) => s.tim === 'putih')
      .reduce((acc, s) => acc + s.totalBenar, 0);

    const slipQuote = !val.benar ? ambilKataTerpelesetTarik() : null;
    const selesai = cekKondisiSelesai(sesi.taliPosition, sesi.config.batasMenang);
    let hasil: LaporanTarikTambangMulti | undefined;
    if (selesai) {
      hasil = this.akhiriPermainan(sessionId, 'garis_menang');
    }

    return {
      sesi,
      peserta: p,
      tim: p.tim,
      benar: val.benar,
      timedOut: val.timedOut,
      slipQuote,
      deltaTali: evalPull.deltaTali,
      taliPosition: sesi.taliPosition,
      skorMerah: sesi.skorMerah,
      skorPutih: sesi.skorPutih,
      pullerIdx,
      jawabanBenarKode: pres.jawabanBenarKode,
      jawabanBenarTeks: pres.jawabanBenarTeks,
      penjelasan: pres.penjelasan,
      selesai,
      hasil,
    };
  }

  akhiriPermainan(
    sessionId: string,
    reasonOrManual: 'garis_menang' | 'waktu_habis' | 'manual' | boolean = 'manual'
  ): LaporanTarikTambangMulti {
    const sesi = this.sessions.get(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');
    if (sesi.status === 'selesai' && sesi.hasil) {
      return sesi.hasil;
    }

    const alasan: 'garis_menang' | 'waktu_habis' | 'manual' =
      reasonOrManual === true
        ? 'manual'
        : reasonOrManual === false
          ? 'garis_menang'
          : reasonOrManual;

    sesi.status = 'selesai';
    for (const p of sesi.peserta.values()) {
      p.presentasiAktif = null;
      p.questionEndsAtMs = null;
    }
    sesi.hasil = susunLaporanAkhirMulti(sesi, alasan);
    return sesi.hasil;
  }

  dapatkanDaftarPeserta(sessionId: string) {
    const sesi = this.sessions.get(sessionId);
    if (!sesi) return [];
    return Array.from(sesi.peserta.values()).map((p) => {
      const total = p.totalBenar + p.totalSalah;
      return {
        id: p.id,
        nama: p.nama,
        tim: p.tim,
        connected: p.connected,
        totalBenar: p.totalBenar,
        totalSalah: p.totalSalah,
        jumlahJawab: p.jumlahJawab,
        akurasiPersen: total > 0 ? Math.round((p.totalBenar / total) * 100) : 0,
        streakSaatIni: p.streakSaatIni,
        streakTertinggi: p.streakTertinggi,
      };
    });
  }

  serialisasiPowerUpInfo(sesi: SesiMultiplayerActive) {
    return {
      powerUpTim1: { ...sesi.powerUpTim1 },
      powerUpTim2: { ...sesi.powerUpTim2 },
    };
  }

  async simpanHasilKeDatabase(sesi: SesiMultiplayerActive) {
    if (sesi.savedToDb) return;
    if (sesi.savingPromise) {
      await sesi.savingPromise;
      return;
    }

    const runSave = async () => {
      if (!sesi.hasil) {
        sesi.hasil = susunLaporanAkhirMulti(sesi, 'manual');
      }

      const pesertaSnapshot = Array.from(sesi.peserta.values()).map((p) => ({
        id: p.id,
        nama: p.nama,
        tim: p.tim,
        totalBenar: p.totalBenar,
        totalSalah: p.totalSalah,
        streakTertinggi: p.streakTertinggi,
        rataRataWaktuJawabMs: p.rataRataWaktuJawabMs,
        riwayatJawaban: p.riwayatJawaban,
      }));

      await prisma.$transaction(
        async (tx) => {
          const updatedSession = await tx.session.update({
            where: { id: sesi.sessionId },
            data: {
              status: 'selesai',
              selesaiPada: new Date(),
              konfigurasi: JSON.stringify({
                playMode: 'MULTIPLAYER',
                config: sesi.config,
                pesertaSnapshot,
                laporanTarikMulti: sesi.hasil,
              }),
            },
          });

          await tx.sessionResult.upsert({
            where: { sessionId: updatedSession.id },
            update: {
              timMenang: sesi.hasil!.timMenang,
              posisiAkhir: Math.round(sesi.taliPosition),
              skorMerah: sesi.skorMerah,
              skorPutih: sesi.skorPutih,
            },
            create: {
              sessionId: updatedSession.id,
              timMenang: sesi.hasil!.timMenang,
              posisiAkhir: Math.round(sesi.taliPosition),
              skorMerah: sesi.skorMerah,
              skorPutih: sesi.skorPutih,
            },
          });

          await tx.sessionPlayer.deleteMany({
            where: { sessionId: updatedSession.id },
          });

          const allStudents = Array.from(sesi.peserta.values());
          if (allStudents.length > 0) {
            await tx.sessionPlayer.createMany({
              data: allStudents.map((p) => ({
                id: `${updatedSession.id}-${p.id}`,
                sessionId: updatedSession.id,
                nama: p.nama,
                tim: p.tim || 'merah',
                totalBenar: p.totalBenar,
                totalSalah: p.totalSalah,
                streakSaatIni: p.streakSaatIni,
                streakTertinggi: p.streakTertinggi,
                totalWaktuJawabMs: p.totalWaktuJawabMs,
                jumlahJawab: p.jumlahJawab,
                status: 'selesai',
                selesaiPada: new Date(),
                riwayatJawaban: JSON.stringify(p.riwayatJawaban),
              })),
            });
          }

          await tx.questionStat.deleteMany({
            where: { sessionId: updatedSession.id },
          });

          const statEntries = Array.from(sesi.questionStatsMap.entries()).filter(
            ([, s]) => s.jumlahBenar > 0 || s.jumlahSalah > 0
          );
          if (statEntries.length > 0) {
            await tx.questionStat.createMany({
              data: statEntries.map(([questionId, s]) => ({
                sessionId: updatedSession.id,
                questionId,
                jumlahBenar: s.jumlahBenar,
                jumlahSalah: s.jumlahSalah,
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
  ): Promise<LaporanTarikTambangMulti | null> {
    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: { include: { questions: { orderBy: { urutan: 'asc' } } } },
        result: true,
        questionStats: { include: { question: true } },
      },
    });
    if (!sessionDb || sessionDb.mode !== 'multi') return null;

    if (sessionDb.konfigurasi) {
      try {
        const parsed = JSON.parse(sessionDb.konfigurasi);
        if (parsed?.laporanTarikMulti) {
          return parsed.laporanTarikMulti as LaporanTarikTambangMulti;
        }
      } catch {
        // fallback ke rekonstruksi dasar
      }
    }

    const config = bangunKonfigurasiTarikTambang(undefined);
    const emptyHeatmap = bangunAnalisisHeatmapTarik(
      sessionDb.template.questions.map(mapDbQuestionForGame),
      [
        { id: 'merah', nama: config.namaTim1, warna: '#e2312d' },
        { id: 'putih', nama: config.namaTim2, warna: '#1d8fe0' },
      ],
      []
    );

    return {
      sessionId: sessionDb.id,
      templateId: sessionDb.templateId,
      templateJudul: sessionDb.template.judul,
      playMode: 'MULTIPLAYER',
      alasanSelesai: 'manual',
      konfigurasi: config,
      timMenang: (sessionDb.result?.timMenang as TimTarikTambang | 'seri') || 'seri',
      namaTim1: config.namaTim1,
      namaTim2: config.namaTim2,
      posisiAkhir: sessionDb.result?.posisiAkhir ?? 0,
      skorMerah: sessionDb.result?.skorMerah ?? 0,
      skorPutih: sessionDb.result?.skorPutih ?? 0,
      totalPeserta: 0,
      totalSoalDijawab: sessionDb.questionStats.reduce(
        (acc, q) => acc + q.jumlahBenar + q.jumlahSalah,
        0
      ),
      akurasiTim1: 0,
      akurasiTim2: 0,
      akurasiTim1Persen: 0,
      akurasiTim2Persen: 0,
      teamSummary: [
        {
          id: 'merah',
          nama: config.namaTim1,
          warna: '#e2312d',
          jumlahAnggota: 0,
          totalBenar: sessionDb.result?.skorMerah ?? 0,
          totalSalah: 0,
          akurasiPersen: 0,
        },
        {
          id: 'putih',
          nama: config.namaTim2,
          warna: '#1d8fe0',
          jumlahAnggota: 0,
          totalBenar: sessionDb.result?.skorPutih ?? 0,
          totalSalah: 0,
          akurasiPersen: 0,
        },
      ],
      analisisHeatmap: emptyHeatmap,
      laporanSiswa: [],
      questionStats: sessionDb.questionStats.map((qs) => ({
        questionId: qs.questionId,
        nomorSoal: qs.question.urutan,
        teksSoal: qs.question.teks,
        jumlahBenar: qs.jumlahBenar,
        jumlahSalah: qs.jumlahSalah,
      })),
      dihentikanManual: true,
      selesaiPada: (sessionDb.selesaiPada || new Date()).toISOString(),
    };
  }

  hapusSesi(sessionId: string) {
    const sesi = this.sessions.get(sessionId);
    if (!sesi) return;
    this.tokenToSessionId.delete(sesi.token);
    for (const [sockId, info] of Array.from(this.socketToPeserta.entries())) {
      if (info.sessionId === sessionId) {
        this.socketToPeserta.delete(sockId);
      }
    }
    this.sessions.delete(sessionId);
  }

  batalkanSesi(sessionId: string): SesiMultiplayerActive | null {
    const sesi = this.sessions.get(sessionId);
    if (!sesi) return null;
    this.hapusSesi(sessionId);
    return sesi;
  }

  dapatkanSemuaSesi(): SesiMultiplayerActive[] {
    return Array.from(this.sessions.values());
  }
}

export const multiManager = new MultiSessionManager();
