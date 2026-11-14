import crypto from 'crypto';
import {
  KonfigurasiPanjatPinang,
  PesertaPanjatState,
  PresentasiSoalPanjat,
  OpsiPilihanPanjat,
  SoalPanjat,
  HasilJawabanPanjat,
  RiwayatPosisiEntry,
  RiwayatRintanganEntry,
  EfekAktifPanjat,
  RngRintangan,
  bangunKonfigurasiPanjatPinang,
  buatPresentasiSoalPanjat,
  prosesJawabanPanjatPinang,
  urutkanLeaderboardPanjatPinang,
} from './panjatPinang.js';
import { multiManager } from './multiManager.js';
import { prisma } from '../db.js';
import { mapDbQuestionForGame } from '../utils/questionOptions.js';

export interface SoalPublikPanjat {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  totalSoalTemplate: number;
  teks: string;
  pilihan: OpsiPilihanPanjat[];
  isBonusKulitPisang: boolean;
  ditampilkanPadaMs: number;
}

export interface LeaderboardItemPanjat {
  peringkat: number;
  id: string;
  nama: string;
  connected: boolean;
  posisi: number;
  poinBonus: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakSaatIni: number;
  streakTertinggi: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs: number | null;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  efekAktif: EfekAktifPanjat;
  jatuhKeDasar?: number;
}

export interface LaporanPemainPanjat {
  peringkat: number;
  id: string;
  nama: string;
  posisiAkhir: number;
  poinBonus: number;
  status: 'bermain' | 'selesai';
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakTertinggi: number;
  streakSaatIni: number;
  rataRataWaktuJawabMs: number;
  waktuSelesaiMs: number | null;
  riwayatRintangan: RiwayatRintanganEntry[];
  riwayatPosisi: RiwayatPosisiEntry[];
  jatuhKeDasar?: number;
}

export interface LaporanAkhirPanjatPinang {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  konfigurasi: KonfigurasiPanjatPinang;
  totalPeserta: number;
  totalSelesai: number;
  totalSoalTemplate: number;
  totalJawabanBenar: number;
  totalJawabanSalah: number;
  dihentikanManual: boolean;
  mulaiPadaMs: number | null;
  selesaiPadaMs: number;
  leaderboard: LeaderboardItemPanjat[];
  laporanPemain: LaporanPemainPanjat[];
  podium: {
    juara1?: LeaderboardItemPanjat;
    juara2?: LeaderboardItemPanjat;
    juara3?: LeaderboardItemPanjat;
  };
}

export interface SesiPanjatActive {
  sessionId: string;
  token: string;
  templateId: string;
  templateJudul: string;
  hostId: string;
  hostSocketId?: string;
  status: 'lobi' | 'jalan' | 'jeda' | 'selesai';
  pausedAtMs?: number | null;
  config: KonfigurasiPanjatPinang;
  peserta: Map<string, PesertaPanjatState>;
  totalSoal: number;
  questions: SoalPanjat[];
  gameMulaiPadaMs: number | null;
  processedPresentations: Set<string>;
  hasil?: LaporanAkhirPanjatPinang;
}

const sesiPanjatMap = new Map<string, SesiPanjatActive>();
const tokenToSessionIdMap = new Map<string, string>();
const dbWriteQueues = new Map<string, Promise<void>>();

/**
 * Menjalankan operasi penulisan database secara berurutan per sesi agar konsisten
 * saat puluhan pemain menjawab bersamaan pada SQLite.
 */
function antrekanPenulisanDb(sessionId: string, task: () => Promise<void>): Promise<void> {
  const previous = dbWriteQueues.get(sessionId) || Promise.resolve();
  const next = previous
    .catch(() => {
      // Abaikan error sebelumnya agar antrean tidak macet permanen
    })
    .then(task);
  dbWriteQueues.set(sessionId, next);
  return next;
}

/**
 * Mengacak urutan ID soal memakai Fisher-Yates dengan crypto.randomInt
 * dan menghindari pengulangan soal yang sama berturut-turut bila alternatif tersedia.
 */
export function siapkanAntreanSoalPanjat(
  questions: SoalPanjat[],
  terakhirSoalId?: string
): string[] {
  if (!questions || questions.length === 0) return [];
  const ids = questions.map((q) => q.id);

  for (let i = ids.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = ids[i];
    ids[i] = ids[j];
    ids[j] = tmp;
  }

  if (ids.length > 1 && terakhirSoalId && ids[0] === terakhirSoalId) {
    const tmp = ids[0];
    ids[0] = ids[1];
    ids[1] = tmp;
  }

  return ids;
}

function formatLeaderboardItem(p: PesertaPanjatState, peringkat: number): LeaderboardItemPanjat {
  const totalJawab = p.totalBenar + p.totalSalah;
  const akurasiPersen = totalJawab > 0 ? Math.round((p.totalBenar / totalJawab) * 100) : 0;

  return {
    peringkat,
    id: p.id,
    nama: p.nama,
    connected: p.connected,
    posisi: p.posisi,
    poinBonus: p.poinBonus,
    totalBenar: p.totalBenar,
    totalSalah: p.totalSalah,
    akurasiPersen,
    streakSaatIni: p.streakSaatIni,
    streakTertinggi: p.streakTertinggi,
    status: p.status,
    waktuSelesaiMs: p.waktuSelesaiMs,
    rataRataWaktuJawabMs: p.rataRataWaktuJawabMs,
    jumlahJawab: p.jumlahJawab,
    efekAktif: { ...p.efekAktif },
    jatuhKeDasar: p.jatuhKeDasar ?? 0,
  };
}

function formatPresentasiPublik(
  pres: PresentasiSoalPanjat,
  totalSoalTemplate: number
): SoalPublikPanjat {
  return {
    presentationId: pres.presentationId,
    questionId: pres.questionId,
    nomorSoal: pres.nomorSoal,
    totalSoalTemplate,
    teks: pres.teks,
    pilihan: pres.pilihan,
    isBonusKulitPisang: pres.isBonusKulitPisang,
    ditampilkanPadaMs: pres.ditampilkanPadaMs,
  };
}

export function buatLaporanAkhirPanjat(
  sesi: SesiPanjatActive,
  dihentikanManual: boolean,
  selesaiPadaMs: number = Date.now()
): LaporanAkhirPanjatPinang {
  const sorted = urutkanLeaderboardPanjatPinang(Array.from(sesi.peserta.values()));
  const leaderboard = sorted.map((p, idx) => formatLeaderboardItem(p, idx + 1));

  let totalJawabanBenar = 0;
  let totalJawabanSalah = 0;
  let totalSelesai = 0;

  const laporanPemain: LaporanPemainPanjat[] = sorted.map((p, idx) => {
    totalJawabanBenar += p.totalBenar;
    totalJawabanSalah += p.totalSalah;
    if (p.status === 'selesai') totalSelesai += 1;

    const totalJawab = p.totalBenar + p.totalSalah;
    const akurasiPersen = totalJawab > 0 ? Math.round((p.totalBenar / totalJawab) * 100) : 0;

    return {
      peringkat: idx + 1,
      id: p.id,
      nama: p.nama,
      posisiAkhir: p.posisi,
      poinBonus: p.poinBonus,
      status: p.status,
      totalBenar: p.totalBenar,
      totalSalah: p.totalSalah,
      akurasiPersen,
      streakTertinggi: p.streakTertinggi,
      streakSaatIni: p.streakSaatIni,
      rataRataWaktuJawabMs: p.rataRataWaktuJawabMs,
      waktuSelesaiMs: p.waktuSelesaiMs,
      riwayatRintangan: [...p.riwayatRintangan],
      riwayatPosisi: [...p.riwayatPosisi],
      jatuhKeDasar: p.jatuhKeDasar ?? 0,
    };
  });

  return {
    sessionId: sesi.sessionId,
    templateId: sesi.templateId,
    templateJudul: sesi.templateJudul,
    konfigurasi: sesi.config,
    totalPeserta: sorted.length,
    totalSelesai,
    totalSoalTemplate: sesi.totalSoal,
    totalJawabanBenar,
    totalJawabanSalah,
    dihentikanManual,
    mulaiPadaMs: sesi.gameMulaiPadaMs,
    selesaiPadaMs,
    leaderboard,
    laporanPemain,
    podium: {
      juara1: leaderboard[0],
      juara2: leaderboard[1],
      juara3: leaderboard[2],
    },
  };
}

export const panjatPinangManager = {
  /**
   * Menghasilkan token 6 digit unik yang tidak bertabrakan dengan sesi game aktif lain.
   */
  generateUniqueToken(): string {
    let token = '';
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 200) {
      attempts++;
      token = crypto.randomInt(100000, 1000000).toString();
      exists =
        tokenToSessionIdMap.has(token) ||
        Boolean(multiManager.dapatkanSesiDariToken(token));
    }

    if (exists) {
      throw new Error('Gagal menghasilkan token unik untuk sesi Panjat Pinang.');
    }

    return token;
  },

  /**
   * Menginisialisasi sesi Panjat Pinang dengan snapshot konfigurasi immutable.
   */
  inisialisasiSesi(
    sessionId: string,
    token: string,
    hostId: string,
    template: { id: string; judul: string },
    questions: SoalPanjat[],
    userConfig?: Partial<KonfigurasiPanjatPinang>
  ): SesiPanjatActive {
    if (!questions || questions.length === 0) {
      throw new Error('Template belum memiliki soal. Tambahkan minimal 1 soal sebelum membuat sesi.');
    }

    if (tokenToSessionIdMap.has(token)) {
      const oldId = tokenToSessionIdMap.get(token)!;
      this.hapusSesi(oldId);
    }

    const config = bangunKonfigurasiPanjatPinang(userConfig);

    const sesi: SesiPanjatActive = {
      sessionId,
      token,
      templateId: template.id,
      templateJudul: template.judul,
      hostId,
      status: 'lobi',
      config,
      peserta: new Map(),
      totalSoal: questions.length,
      questions,
      gameMulaiPadaMs: null,
      pausedAtMs: null,
      processedPresentations: new Set(),
    };

    sesiPanjatMap.set(sessionId, sesi);
    tokenToSessionIdMap.set(token, sessionId);
    return sesi;
  },

  dapatkanSesi(sessionId: string): SesiPanjatActive | undefined {
    return sesiPanjatMap.get(sessionId);
  },

  dapatkanSesiDariToken(token: string): SesiPanjatActive | undefined {
    const sessionId = tokenToSessionIdMap.get(token);
    if (!sessionId) return undefined;
    return sesiPanjatMap.get(sessionId);
  },

  /**
   * Memulihkan sesi Panjat Pinang dari database ke memori apabila server baru restart.
   */
  async pulihkanSesiDariDb(sessionId: string): Promise<SesiPanjatActive | null> {
    const existing = this.dapatkanSesi(sessionId);
    if (existing) return existing;

    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: { include: { questions: { orderBy: { urutan: 'asc' } } } },
        players: true,
      },
    });

    if (!sessionDb || sessionDb.template.game !== 'panjat_pinang') {
      return null;
    }

    let parsedConfig: Partial<KonfigurasiPanjatPinang> | undefined;
    if (sessionDb.konfigurasi) {
      try {
        parsedConfig = JSON.parse(sessionDb.konfigurasi);
      } catch {
        parsedConfig = undefined;
      }
    }

    const token = sessionDb.token || this.generateUniqueToken();
    const sesi = this.inisialisasiSesi(
      sessionDb.id,
      token,
      sessionDb.hostId,
      { id: sessionDb.template.id, judul: sessionDb.template.judul },
      sessionDb.template.questions.map(mapDbQuestionForGame),
      parsedConfig
    );

    sesi.status =
      sessionDb.status === 'jalan'
        ? 'jalan'
        : sessionDb.status === 'selesai'
        ? 'selesai'
        : 'lobi';
    sesi.gameMulaiPadaMs = sessionDb.mulaiPada ? sessionDb.mulaiPada.getTime() : null;

    for (const pl of sessionDb.players) {
      let riwayatPosisi: RiwayatPosisiEntry[] = [];
      let riwayatRintangan: RiwayatRintanganEntry[] = [];
      let riwayatJawaban: PesertaPanjatState['riwayatJawaban'] = [];
      try {
        riwayatPosisi = JSON.parse(pl.riwayatPosisi || '[]');
      } catch {
        riwayatPosisi = [];
      }
      try {
        riwayatRintangan = JSON.parse(pl.riwayatRintangan || '[]');
      } catch {
        riwayatRintangan = [];
      }
      try {
        riwayatJawaban = JSON.parse(pl.riwayatJawaban || '[]');
      } catch {
        riwayatJawaban = [];
      }

      const restored: PesertaPanjatState = {
        id: pl.id,
        secretToken: crypto.randomUUID(),
        socketId: '',
        nama: pl.nama,
        connected: false,
        posisi: pl.posisi,
        poinBonus: pl.poinBonus,
        totalBenar: pl.totalBenar,
        totalSalah: pl.totalSalah,
        streakSaatIni: pl.streakSaatIni,
        streakTertinggi: pl.streakTertinggi,
        bonus3DalamStreak: pl.streakSaatIni >= 3,
        bonus5DalamStreak: pl.streakSaatIni >= 5,
        status: pl.status === 'selesai' ? 'selesai' : 'bermain',
        waktuSelesaiMs: pl.waktuSelesaiMs,
        selesaiPada: pl.selesaiPada ? pl.selesaiPada.getTime() : null,
        totalWaktuJawabMs: pl.totalWaktuJawabMs,
        jumlahJawab: pl.jumlahJawab,
        rataRataWaktuJawabMs: pl.jumlahJawab > 0 ? Math.round(pl.totalWaktuJawabMs / pl.jumlahJawab) : 0,
        efekAktif: {
          tiangLicin: false,
          perisaiKulitPisang: false,
          peganganKuat: false,
          menungguBonusKulitPisang: false,
        },
        riwayatPosisi,
        riwayatRintangan,
        riwayatJawaban,
        antreanSoal: siapkanAntreanSoalPanjat(sesi.questions),
        presentasiAktif: null,
        nomorSoalPemain: riwayatJawaban.length,
      };
      for (const jw of riwayatJawaban) {
        sesi.processedPresentations.add(jw.presentationId);
      }
      sesi.peserta.set(pl.id, restored);
    }

    if (sesi.status === 'selesai') {
      sesi.hasil = buatLaporanAkhirPanjat(
        sesi,
        true,
        sessionDb.selesaiPada ? sessionDb.selesaiPada.getTime() : Date.now()
      );
    }

    return sesi;
  },

  /**
   * Mendaftarkan siswa baru ke sesi atau memulihkan koneksi siswa (reconnect).
   */
  gabungPeserta(
    token: string,
    nama: string,
    socketId: string,
    existingPesertaId?: string,
    pesertaSecret?: string
  ): {
    sesi: SesiPanjatActive;
    peserta: PesertaPanjatState;
    isReconnect: boolean;
  } {
    const sesi = this.dapatkanSesiDariToken(token);
    if (!sesi) {
      throw new Error('Sesi Panjat Pinang tidak ditemukan atau kode PIN tidak valid.');
    }

    if (sesi.status === 'selesai') {
      throw new Error('Permainan Panjat Pinang pada sesi ini telah berakhir.');
    }

    const cleanNama = nama.trim().slice(0, 25);
    if (!cleanNama) {
      throw new Error('Nama panggilan wajib diisi.');
    }

    // 1. Reconnect berdasarkan existingPesertaId + validasi secretToken (cegah pembajakan sesi aktif)
    if (existingPesertaId && sesi.peserta.has(existingPesertaId)) {
      const p = sesi.peserta.get(existingPesertaId)!;
      const secretCocok = Boolean(pesertaSecret && p.secretToken === pesertaSecret);
      const bolehPulihkanPutus = !pesertaSecret && !p.connected;
      if (secretCocok || bolehPulihkanPutus) {
        p.socketId = socketId;
        p.connected = true;
        return { sesi, peserta: p, isReconnect: true };
      }
    }

    // 2. Reconnect berdasarkan nama yang persis sama saat status offline (disconnect)
    if (!existingPesertaId) {
      for (const p of sesi.peserta.values()) {
        if (p.nama.toLowerCase() === cleanNama.toLowerCase() && !p.connected) {
          p.socketId = socketId;
          p.connected = true;
          return { sesi, peserta: p, isReconnect: true };
        }
      }
    }

    // 3. Cek izin late join
    if (sesi.status === 'jalan' && !sesi.config.allowLateJoin) {
      throw new Error('Permainan sudah dimulai dan guru menutup pendaftaran susulan.');
    }

    // 4. Cek kapasitas maksimum peserta
    if (sesi.peserta.size >= sesi.config.maxPeserta) {
      throw new Error(
        `Kapasitas sesi penuh (maksimum ${sesi.config.maxPeserta} peserta). Hubungi guru Anda.`
      );
    }

    // 5. Pastikan nama panggilan unik untuk peserta aktif
    let finalNama = cleanNama;
    let duplicateIndex = 1;
    while (
      Array.from(sesi.peserta.values()).some(
        (p) => p.nama.toLowerCase() === finalNama.toLowerCase()
      )
    ) {
      duplicateIndex++;
      finalNama = `${cleanNama} (${duplicateIndex})`;
    }

    const pesertaId = crypto.randomUUID();
    const pesertaBaru: PesertaPanjatState = {
      id: pesertaId,
      secretToken: crypto.randomUUID(),
      socketId,
      nama: finalNama,
      connected: true,
      posisi: 0,
      poinBonus: 0,
      totalBenar: 0,
      totalSalah: 0,
      streakSaatIni: 0,
      streakTertinggi: 0,
      bonus3DalamStreak: false,
      bonus5DalamStreak: false,
      status: 'bermain',
      waktuSelesaiMs: null,
      selesaiPada: null,
      totalWaktuJawabMs: 0,
      jumlahJawab: 0,
      rataRataWaktuJawabMs: 0,
      efekAktif: {
        tiangLicin: false,
        perisaiKulitPisang: false,
        peganganKuat: false,
        menungguBonusKulitPisang: false,
      },
      riwayatPosisi: [],
      riwayatRintangan: [],
      riwayatJawaban: [],
      antreanSoal: siapkanAntreanSoalPanjat(sesi.questions),
      terakhirSoalId: undefined,
      presentasiAktif: null,
      nomorSoalPemain: 0,
    };

    sesi.peserta.set(pesertaId, pesertaBaru);

    // Simpan peserta baru ke database secara aman (non-blocking pada antrean sesi)
    void this.simpanPesertaKeDatabase(sesi.sessionId, pesertaBaru);

    return { sesi, peserta: pesertaBaru, isReconnect: false };
  },

  /**
   * Menandai peserta terputus saat koneksi socket terputus. Jika sesi masih di lobi, peserta dihapus dari sesi.
   */
  putusKoneksiPeserta(socketId: string): { sessionId?: string; pesertaId?: string; wasRemoved?: boolean } {
    for (const sesi of sesiPanjatMap.values()) {
      for (const [id, p] of sesi.peserta.entries()) {
        if (p.socketId === socketId) {
          if (sesi.status === 'lobi') {
            sesi.peserta.delete(id);
            return { sessionId: sesi.sessionId, pesertaId: id, wasRemoved: true };
          }
          p.connected = false;
          return { sessionId: sesi.sessionId, pesertaId: id, wasRemoved: false };
        }
      }
    }
    return {};
  },

  /**
   * Mengacak urutan peserta di lobi Panjat Pinang.
   */
  acakUrutanPeserta(sessionId: string, hostId: string): LeaderboardItemPanjat[] {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || sesi.hostId !== hostId) {
      throw new Error('Sesi tidak ditemukan atau Anda bukan pemilik sesi.');
    }
    if (sesi.status !== 'lobi') {
      throw new Error('Acak urutan hanya dapat dilakukan saat masih di lobi.');
    }

    const list = Array.from(sesi.peserta.entries());
    for (let i = list.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
    sesi.peserta = new Map(list);
    return this.dapatkanLeaderboard(sessionId);
  },

  /**
   * Mengeluarkan (kick) siswa dari lobi permainan Panjat Pinang.
   */
  async keluarkanPeserta(
    sessionId: string,
    hostId: string,
    pesertaId: string
  ): Promise<PesertaPanjatState> {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || sesi.hostId !== hostId) {
      throw new Error('Sesi tidak ditemukan atau Anda bukan pemilik sesi.');
    }
    if (sesi.status !== 'lobi') {
      throw new Error('Hanya dapat mengeluarkan siswa saat masih di lobi.');
    }
    const p = sesi.peserta.get(pesertaId);
    if (!p) {
      throw new Error('Peserta tidak ditemukan.');
    }
    sesi.peserta.delete(pesertaId);

    await prisma.sessionPlayer.deleteMany({
      where: { id: pesertaId, sessionId: sesi.sessionId },
    }).catch(() => {});

    return p;
  },

  /**
   * Memulai permainan Panjat Pinang oleh guru.
   * Konfigurasi tidak dapat diubah lagi setelah titik ini.
   */
  mulaiPermainan(sessionId: string, hostId: string): SesiPanjatActive {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || sesi.hostId !== hostId) {
      throw new Error('Sesi tidak ditemukan atau Anda bukan pemilik sesi.');
    }

    if (sesi.status !== 'lobi') {
      throw new Error('Permainan pada sesi ini sudah dimulai sebelumnya.');
    }

    if (sesi.peserta.size === 0) {
      throw new Error('Belum ada siswa yang bergabung di lobi.');
    }

    if (sesi.questions.length === 0) {
      throw new Error('Sesi tidak dapat dimulai karena bank soal kosong.');
    }

    sesi.status = 'jalan';
    sesi.gameMulaiPadaMs = Date.now();

    for (const peserta of sesi.peserta.values()) {
      peserta.posisi = 0;
      peserta.poinBonus = 0;
      peserta.status = 'bermain';
      peserta.antreanSoal = siapkanAntreanSoalPanjat(sesi.questions);
      peserta.terakhirSoalId = undefined;
      peserta.presentasiAktif = null;
      peserta.nomorSoalPemain = 0;
    }

    return sesi;
  },

  /**
   * Menjeda jalannya lomba Panjat Pinang oleh guru.
   */
  jedaPermainan(sessionId: string, hostId?: string): SesiPanjatActive {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) throw new Error('Sesi Panjat Pinang tidak ditemukan.');
    if (hostId && sesi.hostId !== hostId) {
      throw new Error('Hanya guru pemilik sesi yang berhak menjeda.');
    }
    if (sesi.status !== 'jalan') {
      throw new Error('Hanya permainan yang sedang berlangsung yang dapat dijeda.');
    }
    sesi.status = 'jeda';
    sesi.pausedAtMs = Date.now();
    return sesi;
  },

  /**
   * Melanjutkan lomba Panjat Pinang setelah dijeda.
   */
  lanjutPermainan(
    sessionId: string,
    hostId?: string
  ): { sesi: SesiPanjatActive; pauseDuration: number } {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) throw new Error('Sesi Panjat Pinang tidak ditemukan.');
    if (hostId && sesi.hostId !== hostId) {
      throw new Error('Hanya guru pemilik sesi yang berhak melanjutkan.');
    }
    if (sesi.status !== 'jeda') {
      throw new Error('Permainan tidak sedang dalam kondisi jeda.');
    }
    const pauseDuration = Math.max(0, Date.now() - (sesi.pausedAtMs || Date.now()));
    for (const p of sesi.peserta.values()) {
      if (p.presentasiAktif) {
        p.presentasiAktif.ditampilkanPadaMs += pauseDuration;
      }
    }
    sesi.status = 'jalan';
    sesi.pausedAtMs = null;
    return { sesi, pauseDuration };
  },

  /**
   * Mengambil soal berikutnya untuk seorang siswa secara independen.
   */
  ambilSoalBerikutnyaUntukPeserta(
    sessionId: string,
    pesertaId: string
  ): SoalPublikPanjat | null {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || sesi.status !== 'jalan') return null;

    const peserta = sesi.peserta.get(pesertaId);
    if (!peserta) return null;

    if (peserta.status === 'selesai' || peserta.posisi >= 100) {
      return null;
    }

    if (sesi.questions.length === 0) return null;

    if (!peserta.antreanSoal || peserta.antreanSoal.length === 0) {
      peserta.antreanSoal = siapkanAntreanSoalPanjat(sesi.questions, peserta.terakhirSoalId);
    }

    const nextQuestionId = peserta.antreanSoal.shift();
    if (!nextQuestionId) return null;

    const soal = sesi.questions.find((q) => q.id === nextQuestionId);
    if (!soal) return null;

    peserta.nomorSoalPemain += 1;
    const isBonus = Boolean(peserta.efekAktif.menungguBonusKulitPisang);
    const presentasi = buatPresentasiSoalPanjat(
      soal,
      peserta.nomorSoalPemain,
      isBonus,
      Date.now()
    );

    peserta.terakhirSoalId = soal.id;
    peserta.presentasiAktif = presentasi;

    return formatPresentasiPublik(presentasi, sesi.totalSoal);
  },

  /**
   * Mengambil soal aktif siswa (misal saat reconnect) atau membuat soal baru bila belum ada.
   */
  dapatkanSoalAktifPeserta(
    sessionId: string,
    pesertaId: string
  ): SoalPublikPanjat | null {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || sesi.status !== 'jalan') return null;

    const peserta = sesi.peserta.get(pesertaId);
    if (!peserta || peserta.status === 'selesai' || peserta.posisi >= 100) return null;

    if (peserta.presentasiAktif) {
      return formatPresentasiPublik(peserta.presentasiAktif, sesi.totalSoal);
    }

    return this.ambilSoalBerikutnyaUntukPeserta(sessionId, pesertaId);
  },

  /**
   * Memproses jawaban siswa secara aman dan konsisten.
   */
  prosesJawabanSiswa(params: {
    sessionId: string;
    pesertaId: string;
    pesertaSecret?: string;
    socketId?: string;
    presentationId?: string;
    questionId?: string;
    choiceId?: string;
    jawaban?: string;
    nowMs?: number;
    rngRintangan?: RngRintangan;
  }): {
    hasilJawaban: HasilJawabanPanjat;
    kunciKey: string;
    penjelasan: string | null;
    leaderboard: LeaderboardItemPanjat[];
    pemainSelesai: boolean;
    semuaPemainSelesai: boolean;
  } {
    const {
      sessionId,
      pesertaId,
      pesertaSecret,
      socketId,
      presentationId,
      questionId,
      choiceId,
      jawaban,
      nowMs = Date.now(),
      rngRintangan,
    } = params;

    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) {
      throw new Error('Sesi Panjat Pinang tidak ditemukan.');
    }

    if (sesi.status === 'jeda') {
      throw new Error('Permainan sedang dijeda oleh Guru.');
    }

    if (sesi.status !== 'jalan') {
      throw new Error('Permainan telah berakhir atau belum dimulai. Jawaban tidak diterima.');
    }

    const peserta = sesi.peserta.get(pesertaId);
    if (!peserta) {
      throw new Error('Identitas pemain tidak terdaftar dalam sesi ini.');
    }

    // Verifikasi kecocokan identitas pengirim (anti-spoofing antar perangkat)
    if (pesertaSecret && peserta.secretToken !== pesertaSecret) {
      throw new Error('Token identitas pemain tidak sah.');
    }
    if (!pesertaSecret && socketId && peserta.socketId && peserta.socketId !== socketId) {
      throw new Error('Perangkat pengirim tidak cocok dengan sesi pemain.');
    }

    if (peserta.status === 'selesai' || peserta.posisi >= 100) {
      throw new Error('Anda sudah mencapai puncak 100% dan menyelesaikan permainan.');
    }

    const presentasi = peserta.presentasiAktif;
    if (!presentasi) {
      throw new Error('Tidak ada pertanyaan aktif atau jawaban untuk soal ini sudah diproses.');
    }

    // Anti-duplicate & replay check via presentationId
    if (presentationId && presentasi.presentationId !== presentationId) {
      throw new Error('Pertanyaan sudah kedaluwarsa atau jawaban sudah pernah dikirimkan.');
    }
    if (sesi.processedPresentations.has(presentasi.presentationId)) {
      throw new Error('Jawaban ganda terdeteksi dan ditolak oleh server.');
    }
    if (questionId && presentasi.questionId !== questionId) {
      throw new Error('Identitas pertanyaan tidak sesuai dengan soal aktif Anda.');
    }

    // Tandai presentationId telah diproses sebelum eksekusi kalkulasi (guard sinkron)
    sesi.processedPresentations.add(presentasi.presentationId);

    let hasilJawaban: HasilJawabanPanjat;
    try {
      hasilJawaban = prosesJawabanPanjatPinang({
        peserta,
        presentasi,
        choiceId,
        fallbackJawabanKey: jawaban,
        config: sesi.config,
        gameMulaiPadaMs: sesi.gameMulaiPadaMs || nowMs,
        nowMs,
        rngRintangan,
      });
    } catch (err) {
      // Kembalikan hak jawab hanya jika validasi input gagal (misal choiceId cacat)
      sesi.processedPresentations.delete(presentasi.presentationId);
      throw err;
    }

    // Perbarui state pemain di memori secara atomik
    sesi.peserta.set(pesertaId, hasilJawaban.pesertaUpdated);

    const soalData = sesi.questions.find((q) => q.id === presentasi.questionId);
    const semuaPemainSelesai =
      sesi.peserta.size > 0 &&
      Array.from(sesi.peserta.values()).every((p) => p.status === 'selesai' || p.posisi >= 100);

    const leaderboard = this.dapatkanLeaderboard(sessionId);

    // Sinkronkan progres pemain secara berurutan ke SQLite tanpa memblokir socket utama
    void this.simpanPesertaKeDatabase(sesi.sessionId, hasilJawaban.pesertaUpdated);

    return {
      hasilJawaban,
      kunciKey: presentasi.kunciKey,
      penjelasan: soalData?.penjelasan || null,
      leaderboard,
      pemainSelesai: hasilJawaban.pesertaUpdated.status === 'selesai',
      semuaPemainSelesai,
    };
  },

  /**
   * Mendapatkan leaderboard terurut berdasarkan 5 kriteria resmi Panjat Pinang.
   */
  dapatkanLeaderboard(sessionId: string): LeaderboardItemPanjat[] {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) return [];
    const sorted = urutkanLeaderboardPanjatPinang(Array.from(sesi.peserta.values()));
    return sorted.map((p, idx) => formatLeaderboardItem(p, idx + 1));
  },

  /**
   * Mendapatkan objek leaderboard terpublikasi lengkap dengan daftar laporan pemain.
   */
  dapatkanLaporanSementara(sessionId: string): LaporanAkhirPanjatPinang | null {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) return null;
    if (sesi.hasil) return sesi.hasil;
    return buatLaporanAkhirPanjat(sesi, false, Date.now());
  },

  /**
   * Mengakhiri sesi permainan (otomatis jika semua 100%, atau manual oleh guru).
   */
  akhiriPermainan(sessionId: string, dihentikanManual: boolean = true): LaporanAkhirPanjatPinang {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) {
      throw new Error('Sesi Panjat Pinang tidak ditemukan.');
    }

    if (sesi.status === 'selesai' && sesi.hasil) {
      return sesi.hasil;
    }

    sesi.status = 'selesai';
    const hasil = buatLaporanAkhirPanjat(sesi, dihentikanManual, Date.now());
    sesi.hasil = hasil;

    return hasil;
  },

  /**
   * Menyimpan atau memperbarui satu record SessionPlayer di database secara aman.
   */
  async simpanPesertaKeDatabase(sessionId: string, p: PesertaPanjatState): Promise<void> {
    return antrekanPenulisanDb(sessionId, async () => {
      try {
        await prisma.sessionPlayer.upsert({
          where: { id: p.id },
          update: {
            nama: p.nama,
            posisi: p.posisi,
            poinBonus: p.poinBonus,
            totalBenar: p.totalBenar,
            totalSalah: p.totalSalah,
            streakSaatIni: p.streakSaatIni,
            streakTertinggi: p.streakTertinggi,
            totalWaktuJawabMs: p.totalWaktuJawabMs,
            jumlahJawab: p.jumlahJawab,
            status: p.status,
            waktuSelesaiMs: p.waktuSelesaiMs,
            selesaiPada: p.selesaiPada ? new Date(p.selesaiPada) : null,
            riwayatPosisi: JSON.stringify(p.riwayatPosisi),
            riwayatRintangan: JSON.stringify(p.riwayatRintangan),
            riwayatJawaban: JSON.stringify(p.riwayatJawaban),
          },
          create: {
            id: p.id,
            sessionId,
            nama: p.nama,
            posisi: p.posisi,
            poinBonus: p.poinBonus,
            totalBenar: p.totalBenar,
            totalSalah: p.totalSalah,
            streakSaatIni: p.streakSaatIni,
            streakTertinggi: p.streakTertinggi,
            totalWaktuJawabMs: p.totalWaktuJawabMs,
            jumlahJawab: p.jumlahJawab,
            status: p.status,
            waktuSelesaiMs: p.waktuSelesaiMs,
            selesaiPada: p.selesaiPada ? new Date(p.selesaiPada) : null,
            riwayatPosisi: JSON.stringify(p.riwayatPosisi),
            riwayatRintangan: JSON.stringify(p.riwayatRintangan),
            riwayatJawaban: JSON.stringify(p.riwayatJawaban),
          },
        });
      } catch {
        // Sesi mungkin tidak tersimpan di DB dalam unit test in-memory murni; abaikan dengan aman
      }
    });
  },

  /**
   * Menyimpan hasil akhir, seluruh pemain, dan statistik per soal ke database dalam 1 transaksi.
   */
  async simpanHasilAkhirKeDatabase(sessionId: string): Promise<void> {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || !sesi.hasil) return;
    const hasil = sesi.hasil;

    return antrekanPenulisanDb(sessionId, async () => {
      await prisma.$transaction(async (tx) => {
        await tx.session.update({
          where: { id: sesi.sessionId },
          data: {
            status: 'selesai',
            selesaiPada: new Date(hasil.selesaiPadaMs),
            konfigurasi: JSON.stringify(sesi.config),
          },
        });

        const pemenangNama = hasil.podium.juara1?.nama || 'Selesai';
        const posisiPuncak = hasil.podium.juara1?.posisi ?? 0;

        await tx.sessionResult.upsert({
          where: { sessionId: sesi.sessionId },
          update: {
            timMenang: pemenangNama,
            posisiAkhir: posisiPuncak,
            skorMerah: hasil.totalSelesai,
            skorPutih: hasil.totalPeserta,
          },
          create: {
            sessionId: sesi.sessionId,
            timMenang: pemenangNama,
            posisiAkhir: posisiPuncak,
            skorMerah: hasil.totalSelesai,
            skorPutih: hasil.totalPeserta,
          },
        });

        // Simpan seluruh pemain secara konsisten
        for (const p of sesi.peserta.values()) {
          await tx.sessionPlayer.upsert({
            where: { id: p.id },
            update: {
              nama: p.nama,
              posisi: p.posisi,
              poinBonus: p.poinBonus,
              totalBenar: p.totalBenar,
              totalSalah: p.totalSalah,
              streakSaatIni: p.streakSaatIni,
              streakTertinggi: p.streakTertinggi,
              totalWaktuJawabMs: p.totalWaktuJawabMs,
              jumlahJawab: p.jumlahJawab,
              status: p.status,
              waktuSelesaiMs: p.waktuSelesaiMs,
              selesaiPada: p.selesaiPada ? new Date(p.selesaiPada) : null,
              riwayatPosisi: JSON.stringify(p.riwayatPosisi),
              riwayatRintangan: JSON.stringify(p.riwayatRintangan),
              riwayatJawaban: JSON.stringify(p.riwayatJawaban),
            },
            create: {
              id: p.id,
              sessionId: sesi.sessionId,
              nama: p.nama,
              posisi: p.posisi,
              poinBonus: p.poinBonus,
              totalBenar: p.totalBenar,
              totalSalah: p.totalSalah,
              streakSaatIni: p.streakSaatIni,
              streakTertinggi: p.streakTertinggi,
              totalWaktuJawabMs: p.totalWaktuJawabMs,
              jumlahJawab: p.jumlahJawab,
              status: p.status,
              waktuSelesaiMs: p.waktuSelesaiMs,
              selesaiPada: p.selesaiPada ? new Date(p.selesaiPada) : null,
              riwayatPosisi: JSON.stringify(p.riwayatPosisi),
              riwayatRintangan: JSON.stringify(p.riwayatRintangan),
              riwayatJawaban: JSON.stringify(p.riwayatJawaban),
            },
          });
        }

        // Hitung statistik agregat per soal dari seluruh riwayat jawaban pemain
        const statPerSoal = new Map<string, { benar: number; salah: number }>();
        for (const q of sesi.questions) {
          statPerSoal.set(q.id, { benar: 0, salah: 0 });
        }
        for (const p of sesi.peserta.values()) {
          for (const j of p.riwayatJawaban) {
            const cur = statPerSoal.get(j.questionId) || { benar: 0, salah: 0 };
            if (j.benar) cur.benar += 1;
            else cur.salah += 1;
            statPerSoal.set(j.questionId, cur);
          }
        }

        await tx.questionStat.deleteMany({
          where: { sessionId: sesi.sessionId },
        });

        for (const [questionId, st] of statPerSoal.entries()) {
          await tx.questionStat.create({
            data: {
              sessionId: sesi.sessionId,
              questionId,
              jumlahBenar: st.benar,
              jumlahSalah: st.salah,
            },
          });
        }
      });
    });
  },

  /**
   * Memuat laporan lengkap Panjat Pinang dari memori atau database tanpa mencemari peta sesi aktif.
   */
  async muatLaporanDariDatabase(sessionId: string): Promise<LaporanAkhirPanjatPinang | null> {
    const inMem = this.dapatkanSesi(sessionId);
    if (inMem?.hasil) return inMem.hasil;
    if (inMem) return buatLaporanAkhirPanjat(inMem, false, Date.now());

    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: { include: { questions: { orderBy: { urutan: 'asc' } } } },
        players: true,
      },
    });

    if (!sessionDb || sessionDb.template.game !== 'panjat_pinang') {
      return null;
    }

    let parsedConfig: Partial<KonfigurasiPanjatPinang> | undefined;
    if (sessionDb.konfigurasi) {
      try {
        parsedConfig = JSON.parse(sessionDb.konfigurasi);
      } catch {
        parsedConfig = undefined;
      }
    }

    const config = bangunKonfigurasiPanjatPinang(parsedConfig);
    const pesertaMap = new Map<string, PesertaPanjatState>();

    for (const pl of sessionDb.players) {
      let riwayatPosisi: RiwayatPosisiEntry[] = [];
      let riwayatRintangan: RiwayatRintanganEntry[] = [];
      let riwayatJawaban: PesertaPanjatState['riwayatJawaban'] = [];
      try {
        riwayatPosisi = JSON.parse(pl.riwayatPosisi || '[]');
      } catch {
        riwayatPosisi = [];
      }
      try {
        riwayatRintangan = JSON.parse(pl.riwayatRintangan || '[]');
      } catch {
        riwayatRintangan = [];
      }
      try {
        riwayatJawaban = JSON.parse(pl.riwayatJawaban || '[]');
      } catch {
        riwayatJawaban = [];
      }

      pesertaMap.set(pl.id, {
        id: pl.id,
        secretToken: '',
        socketId: '',
        nama: pl.nama,
        connected: false,
        posisi: pl.posisi,
        poinBonus: pl.poinBonus,
        totalBenar: pl.totalBenar,
        totalSalah: pl.totalSalah,
        streakSaatIni: pl.streakSaatIni,
        streakTertinggi: pl.streakTertinggi,
        bonus3DalamStreak: pl.streakSaatIni >= 3,
        bonus5DalamStreak: pl.streakSaatIni >= 5,
        status: pl.status === 'selesai' ? 'selesai' : 'bermain',
        waktuSelesaiMs: pl.waktuSelesaiMs,
        selesaiPada: pl.selesaiPada ? pl.selesaiPada.getTime() : null,
        totalWaktuJawabMs: pl.totalWaktuJawabMs,
        jumlahJawab: pl.jumlahJawab,
        rataRataWaktuJawabMs:
          pl.jumlahJawab > 0 ? Math.round(pl.totalWaktuJawabMs / pl.jumlahJawab) : 0,
        efekAktif: {
          tiangLicin: false,
          perisaiKulitPisang: false,
          peganganKuat: false,
          menungguBonusKulitPisang: false,
        },
        riwayatPosisi,
        riwayatRintangan,
        riwayatJawaban,
        antreanSoal: [],
        presentasiAktif: null,
        nomorSoalPemain: riwayatJawaban.length,
      });
    }

    const tempSesi: SesiPanjatActive = {
      sessionId: sessionDb.id,
      token: sessionDb.token || '',
      templateId: sessionDb.templateId,
      templateJudul: sessionDb.template.judul,
      hostId: sessionDb.hostId,
      status: 'selesai',
      config,
      peserta: pesertaMap,
      totalSoal: sessionDb.template.questions.length,
      questions: [],
      gameMulaiPadaMs: sessionDb.mulaiPada ? sessionDb.mulaiPada.getTime() : null,
      processedPresentations: new Set(),
    };

    const allSelesai =
      pesertaMap.size > 0 && Array.from(pesertaMap.values()).every((p) => p.status === 'selesai');

    return buatLaporanAkhirPanjat(
      tempSesi,
      !allSelesai,
      sessionDb.selesaiPada ? sessionDb.selesaiPada.getTime() : Date.now()
    );
  },

  /**
   * Menghapus sesi Panjat Pinang dari memori server.
   */
  hapusSesi(sessionId: string): void {
    const sesi = sesiPanjatMap.get(sessionId);
    if (sesi) {
      tokenToSessionIdMap.delete(sesi.token);
      sesiPanjatMap.delete(sessionId);
    }
    dbWriteQueues.delete(sessionId);
  },

  batalkanSesi(sessionId: string): SesiPanjatActive | null {
    const sesi = sesiPanjatMap.get(sessionId);
    if (!sesi) return null;
    this.hapusSesi(sessionId);
    return sesi;
  },

  dapatkanSemuaSesi(): SesiPanjatActive[] {
    return Array.from(sesiPanjatMap.values());
  },
};
