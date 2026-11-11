import crypto from 'crypto';
import {
  KonfigurasiBalapKarung,
  PesertaBalapKarungState,
  PresentasiSoalBalap,
  OpsiPilihanBalap,
  SoalBalapKarung,
  HasilJawabanBalap,
  RiwayatJarakEntry,
  RiwayatRintanganBalapEntry,
  EfekAktifBalap,
  RngBalapKarung,
  bangunKonfigurasiBalapKarung,
  buatPresentasiSoalBalap,
  prosesJawabanBalapKarung,
  urutkanLeaderboardBalapKarung,
} from './balapKarung.js';
import { multiManager } from './multiManager.js';
import { panjatPinangManager } from './panjatPinangManager.js';
import { prisma } from '../db.js';
import { mapDbQuestionForGame } from '../utils/questionOptions.js';

export interface SoalPublikBalap {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  totalSoalTemplate: number;
  teks: string;
  pilihan: OpsiPilihanBalap[];
  ditampilkanPadaMs: number;
}

export interface LeaderboardItemBalap {
  peringkat: number;
  id: string;
  nama: string;
  connected: boolean;
  jarak: number;
  targetJarak: number;
  keseimbangan: number;
  jumlahJatuh: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakSaatIni: number;
  streakTertinggi: number;
  totalBonusStreakKali: number;
  totalBonusStreakMeter: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs: number | null;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  efekAktif: EfekAktifBalap;
}

export interface LaporanPemainBalap {
  peringkat: number;
  id: string;
  nama: string;
  jarakAkhir: number;
  targetJarak: number;
  keseimbanganAkhir: number;
  jumlahJatuh: number;
  status: 'bermain' | 'selesai';
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakTertinggi: number;
  streakSaatIni: number;
  totalBonusStreakKali: number;
  totalBonusStreakMeter: number;
  rataRataWaktuJawabMs: number;
  waktuSelesaiMs: number | null;
  riwayatRintangan: RiwayatRintanganBalapEntry[];
  riwayatJarak: RiwayatJarakEntry[];
}

export interface LaporanAkhirBalapKarung {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  konfigurasi: KonfigurasiBalapKarung;
  totalPeserta: number;
  totalSelesai: number;
  totalSoalTemplate: number;
  totalJawabanBenar: number;
  totalJawabanSalah: number;
  totalJatuhKelas: number;
  dihentikanManual: boolean;
  mulaiPadaMs: number | null;
  selesaiPadaMs: number;
  leaderboard: LeaderboardItemBalap[];
  laporanPemain: LaporanPemainBalap[];
  podium: {
    juara1?: LeaderboardItemBalap;
    juara2?: LeaderboardItemBalap;
    juara3?: LeaderboardItemBalap;
  };
}

export interface SesiBalapKarungActive {
  sessionId: string;
  token: string;
  templateId: string;
  templateJudul: string;
  hostId: string;
  hostSocketId?: string;
  status: 'lobi' | 'jalan' | 'selesai';
  config: KonfigurasiBalapKarung;
  peserta: Map<string, PesertaBalapKarungState>;
  totalSoal: number;
  questions: SoalBalapKarung[];
  gameMulaiPadaMs: number | null;
  processedPresentations: Set<string>;
  hasil?: LaporanAkhirBalapKarung;
}

interface StoredEfekMetaBalap {
  perisai?: boolean;
  lompatanKuat?: boolean;
  jalanBerlumpur?: boolean;
  bonus3DalamStreak?: boolean;
  bonus5DalamStreak?: boolean;
  totalBonusStreakKali?: number;
  totalBonusStreakMeter?: number;
}

const sesiBalapMap = new Map<string, SesiBalapKarungActive>();
const tokenToSessionIdMap = new Map<string, string>();
const dbWriteQueues = new Map<string, Promise<void>>();

/**
 * Antrean penulisan database berurutan per sesi agar aman pada lonjakan jawaban bersamaan di SQLite.
 */
function antrekanPenulisanDb(sessionId: string, task: () => Promise<void>): Promise<void> {
  const previous = dbWriteQueues.get(sessionId) || Promise.resolve();
  const next = previous
    .catch(() => {
      // Abaikan kegagalan task sebelumnya agar antrean tidak terkunci
    })
    .then(task);
  dbWriteQueues.set(sessionId, next);
  return next;
}

/**
 * Mengacak daftar ID soal dengan Fisher-Yates (crypto.randomInt) dan mencegah pengulangan beruntun.
 */
export function siapkanAntreanSoalBalap(
  questions: SoalBalapKarung[],
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

function serializeEfekMeta(p: PesertaBalapKarungState): string {
  const payload: StoredEfekMetaBalap = {
    perisai: p.efekAktif.perisai,
    lompatanKuat: p.efekAktif.lompatanKuat,
    jalanBerlumpur: p.efekAktif.jalanBerlumpur,
    bonus3DalamStreak: p.bonus3DalamStreak,
    bonus5DalamStreak: p.bonus5DalamStreak,
    totalBonusStreakKali: p.totalBonusStreakKali,
    totalBonusStreakMeter: p.totalBonusStreakMeter,
  };
  return JSON.stringify(payload);
}

function parseEfekMeta(raw?: string | null): StoredEfekMetaBalap {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StoredEfekMetaBalap;
  } catch {
    return {};
  }
}

function formatLeaderboardItem(
  p: PesertaBalapKarungState,
  peringkat: number,
  targetJarak: number
): LeaderboardItemBalap {
  const totalJawab = p.totalBenar + p.totalSalah;
  const akurasiPersen = totalJawab > 0 ? Math.round((p.totalBenar / totalJawab) * 100) : 0;

  return {
    peringkat,
    id: p.id,
    nama: p.nama,
    connected: p.connected,
    jarak: p.jarak,
    targetJarak,
    keseimbangan: p.keseimbangan,
    jumlahJatuh: p.jumlahJatuh,
    totalBenar: p.totalBenar,
    totalSalah: p.totalSalah,
    akurasiPersen,
    streakSaatIni: p.streakSaatIni,
    streakTertinggi: p.streakTertinggi,
    totalBonusStreakKali: p.totalBonusStreakKali,
    totalBonusStreakMeter: p.totalBonusStreakMeter,
    status: p.status,
    waktuSelesaiMs: p.waktuSelesaiMs,
    rataRataWaktuJawabMs: p.rataRataWaktuJawabMs,
    jumlahJawab: p.jumlahJawab,
    efekAktif: { ...p.efekAktif },
  };
}

function formatPresentasiPublik(
  pres: PresentasiSoalBalap,
  totalSoalTemplate: number
): SoalPublikBalap {
  return {
    presentationId: pres.presentationId,
    questionId: pres.questionId,
    nomorSoal: pres.nomorSoal,
    totalSoalTemplate,
    teks: pres.teks,
    pilihan: pres.pilihan,
    ditampilkanPadaMs: pres.ditampilkanPadaMs,
  };
}

export function buatLaporanAkhirBalap(
  sesi: SesiBalapKarungActive,
  dihentikanManual: boolean,
  selesaiPadaMs: number = Date.now()
): LaporanAkhirBalapKarung {
  const sorted = urutkanLeaderboardBalapKarung(
    Array.from(sesi.peserta.values()),
    sesi.config.targetJarak
  );
  const leaderboard = sorted.map((p, idx) =>
    formatLeaderboardItem(p, idx + 1, sesi.config.targetJarak)
  );

  let totalJawabanBenar = 0;
  let totalJawabanSalah = 0;
  let totalSelesai = 0;
  let totalJatuhKelas = 0;

  const laporanPemain: LaporanPemainBalap[] = sorted.map((p, idx) => {
    totalJawabanBenar += p.totalBenar;
    totalJawabanSalah += p.totalSalah;
    totalJatuhKelas += p.jumlahJatuh;
    if (p.status === 'selesai') totalSelesai += 1;

    const totalJawab = p.totalBenar + p.totalSalah;
    const akurasiPersen = totalJawab > 0 ? Math.round((p.totalBenar / totalJawab) * 100) : 0;

    return {
      peringkat: idx + 1,
      id: p.id,
      nama: p.nama,
      jarakAkhir: p.jarak,
      targetJarak: sesi.config.targetJarak,
      keseimbanganAkhir: p.keseimbangan,
      jumlahJatuh: p.jumlahJatuh,
      status: p.status,
      totalBenar: p.totalBenar,
      totalSalah: p.totalSalah,
      akurasiPersen,
      streakTertinggi: p.streakTertinggi,
      streakSaatIni: p.streakSaatIni,
      totalBonusStreakKali: p.totalBonusStreakKali,
      totalBonusStreakMeter: p.totalBonusStreakMeter,
      rataRataWaktuJawabMs: p.rataRataWaktuJawabMs,
      waktuSelesaiMs: p.waktuSelesaiMs,
      riwayatRintangan: [...p.riwayatRintangan],
      riwayatJarak: [...p.riwayatJarak],
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
    totalJatuhKelas,
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

export const balapKarungManager = {
  /**
   * Menghasilkan token 6 digit unik yang bebas tabrakan antar seluruh game aktif.
   */
  generateUniqueToken(): string {
    let token = '';
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 250) {
      attempts++;
      token = crypto.randomInt(100000, 1000000).toString();
      exists =
        tokenToSessionIdMap.has(token) ||
        Boolean(multiManager.dapatkanSesiDariToken(token)) ||
        Boolean(panjatPinangManager.dapatkanSesiDariToken(token));
    }

    if (exists) {
      throw new Error('Gagal menghasilkan token unik untuk sesi Balap Karung.');
    }

    return token;
  },

  /**
   * Menginisialisasi sesi Balap Karung Challenge di memori server dengan snapshot aturan immutable.
   */
  inisialisasiSesi(
    sessionId: string,
    token: string,
    hostId: string,
    template: { id: string; judul: string },
    questions: SoalBalapKarung[],
    userConfig?: Partial<KonfigurasiBalapKarung>
  ): SesiBalapKarungActive {
    if (!questions || questions.length === 0) {
      throw new Error('Template belum memiliki soal. Tambahkan minimal 1 soal sebelum membuat sesi.');
    }

    if (tokenToSessionIdMap.has(token)) {
      const oldId = tokenToSessionIdMap.get(token)!;
      this.hapusSesi(oldId);
    }

    const config = bangunKonfigurasiBalapKarung(userConfig);

    const sesi: SesiBalapKarungActive = {
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
      processedPresentations: new Set(),
    };

    sesiBalapMap.set(sessionId, sesi);
    tokenToSessionIdMap.set(token, sessionId);
    return sesi;
  },

  dapatkanSesi(sessionId: string): SesiBalapKarungActive | undefined {
    return sesiBalapMap.get(sessionId);
  },

  dapatkanSesiDariToken(token: string): SesiBalapKarungActive | undefined {
    const id = tokenToSessionIdMap.get(token);
    if (!id) return undefined;
    return sesiBalapMap.get(id);
  },

  /**
   * Memulihkan sesi Balap Karung aktif dari SQLite bila server sempat restart.
   */
  async pulihkanSesiDariDb(sessionId: string): Promise<SesiBalapKarungActive | null> {
    const existing = sesiBalapMap.get(sessionId);
    if (existing) return existing;

    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: {
          include: {
            questions: { orderBy: { urutan: 'asc' } },
          },
        },
        players: true,
      },
    });

    if (!sessionDb || sessionDb.template.game !== 'balap_karung' || !sessionDb.token) {
      return null;
    }

    if (sessionDb.template.questions.length === 0) {
      return null;
    }

    let parsedConfig: Partial<KonfigurasiBalapKarung> | undefined;
    if (sessionDb.konfigurasi) {
      try {
        parsedConfig = JSON.parse(sessionDb.konfigurasi);
      } catch {
        parsedConfig = undefined;
      }
    }

    const sesi = this.inisialisasiSesi(
      sessionDb.id,
      sessionDb.token,
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
      let riwayatJarak: RiwayatJarakEntry[] = [];
      let riwayatRintangan: RiwayatRintanganBalapEntry[] = [];
      let riwayatJawaban: PesertaBalapKarungState['riwayatJawaban'] = [];
      try {
        riwayatJarak = JSON.parse(pl.riwayatPosisi || '[]');
      } catch {
        riwayatJarak = [];
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

      const efekMeta = parseEfekMeta(pl.efekAktif);

      const restored: PesertaBalapKarungState = {
        id: pl.id,
        secretToken: crypto.randomUUID(),
        socketId: '',
        nama: pl.nama,
        connected: false,
        jarak: pl.posisi,
        keseimbangan: sesi.config.keseimbanganAktif ? pl.keseimbangan : 100,
        jumlahJatuh: pl.jumlahJatuh,
        totalBenar: pl.totalBenar,
        totalSalah: pl.totalSalah,
        streakSaatIni: pl.streakSaatIni,
        streakTertinggi: pl.streakTertinggi,
        bonus3DalamStreak: Boolean(efekMeta.bonus3DalamStreak ?? pl.streakSaatIni >= 3),
        bonus5DalamStreak: Boolean(efekMeta.bonus5DalamStreak ?? pl.streakSaatIni >= 5),
        totalBonusStreakKali: efekMeta.totalBonusStreakKali ?? 0,
        totalBonusStreakMeter: efekMeta.totalBonusStreakMeter ?? 0,
        status: pl.status === 'selesai' ? 'selesai' : 'bermain',
        waktuSelesaiMs: pl.waktuSelesaiMs,
        selesaiPada: pl.selesaiPada ? pl.selesaiPada.getTime() : null,
        totalWaktuJawabMs: pl.totalWaktuJawabMs,
        jumlahJawab: pl.jumlahJawab,
        rataRataWaktuJawabMs:
          pl.jumlahJawab > 0 ? Math.round(pl.totalWaktuJawabMs / pl.jumlahJawab) : 0,
        efekAktif: {
          perisai: Boolean(efekMeta.perisai),
          lompatanKuat: Boolean(efekMeta.lompatanKuat),
          jalanBerlumpur: Boolean(efekMeta.jalanBerlumpur),
        },
        riwayatJarak,
        riwayatRintangan,
        riwayatJawaban,
        antreanSoal: siapkanAntreanSoalBalap(sesi.questions),
        presentasiAktif: null,
        nomorSoalPemain: riwayatJawaban.length,
      };
      for (const jw of riwayatJawaban) {
        sesi.processedPresentations.add(jw.presentationId);
      }
      sesi.peserta.set(pl.id, restored);
    }

    if (sesi.status === 'selesai') {
      sesi.hasil = buatLaporanAkhirBalap(
        sesi,
        true,
        sessionDb.selesaiPada ? sessionDb.selesaiPada.getTime() : Date.now()
      );
    }

    return sesi;
  },

  /**
   * Mendaftarkan pemain baru atau memulihkan reconnect dengan validasi identitas pesertaSecret.
   */
  gabungPeserta(
    token: string,
    nama: string,
    socketId: string,
    existingPesertaId?: string,
    pesertaSecret?: string
  ): {
    sesi: SesiBalapKarungActive;
    peserta: PesertaBalapKarungState;
    isReconnect: boolean;
  } {
    const sesi = this.dapatkanSesiDariToken(token);
    if (!sesi) {
      throw new Error('Kode token tidak ditemukan atau sesi Balap Karung telah berakhir.');
    }

    if (sesi.status === 'selesai') {
      throw new Error('Sesi permainan ini sudah berakhir.');
    }

    const cleanNama = nama.trim();
    if (!cleanNama) {
      throw new Error('Nama panggilan wajib diisi.');
    }

    if (existingPesertaId && sesi.peserta.has(existingPesertaId)) {
      const p = sesi.peserta.get(existingPesertaId)!;
      const secretCocok = Boolean(pesertaSecret && p.secretToken === pesertaSecret);
      if (secretCocok || !p.connected) {
        p.socketId = socketId;
        p.connected = true;
        return { sesi, peserta: p, isReconnect: true };
      }
      throw new Error('Sesi pemain tidak dapat diambil alih dari perangkat lain.');
    }

    if (sesi.status === 'jalan' && !sesi.config.allowLateJoin) {
      throw new Error('Sesi Balap Karung sedang berlangsung dan tidak menerima pemain baru.');
    }

    if (sesi.peserta.size >= sesi.config.maxPeserta) {
      throw new Error(
        `Kapasitas sesi Balap Karung telah penuh (maksimal ${sesi.config.maxPeserta} pemain).`
      );
    }

    const namaSama = Array.from(sesi.peserta.values()).find(
      (p) => p.nama.toLowerCase() === cleanNama.toLowerCase()
    );
    if (namaSama) {
      if (!namaSama.connected) {
        namaSama.socketId = socketId;
        namaSama.connected = true;
        return { sesi, peserta: namaSama, isReconnect: true };
      }
      throw new Error(`Nama "${cleanNama}" sudah dipakai peserta lain dalam sesi ini.`);
    }

    const peserta: PesertaBalapKarungState = {
      id: crypto.randomUUID(),
      secretToken: crypto.randomUUID(),
      socketId,
      nama: cleanNama,
      connected: true,
      jarak: 0,
      keseimbangan: 100,
      jumlahJatuh: 0,
      totalBenar: 0,
      totalSalah: 0,
      streakSaatIni: 0,
      streakTertinggi: 0,
      bonus3DalamStreak: false,
      bonus5DalamStreak: false,
      totalBonusStreakKali: 0,
      totalBonusStreakMeter: 0,
      status: 'bermain',
      waktuSelesaiMs: null,
      selesaiPada: null,
      totalWaktuJawabMs: 0,
      jumlahJawab: 0,
      rataRataWaktuJawabMs: 0,
      efekAktif: {
        perisai: false,
        lompatanKuat: false,
        jalanBerlumpur: false,
      },
      riwayatJarak: [],
      riwayatRintangan: [],
      riwayatJawaban: [],
      antreanSoal:
        sesi.status === 'jalan' ? siapkanAntreanSoalBalap(sesi.questions) : [],
      presentasiAktif: null,
      nomorSoalPemain: 0,
    };

    sesi.peserta.set(peserta.id, peserta);
    void this.sinkronkanPesertaKeDb(sesi.sessionId, peserta);

    return { sesi, peserta, isReconnect: false };
  },

  /**
   * Menandai koneksi socket terputus tanpa menghilangkan progres pemain.
   */
  putusKoneksiPeserta(socketId: string): { sessionId?: string; pesertaId?: string } {
    for (const sesi of sesiBalapMap.values()) {
      for (const p of sesi.peserta.values()) {
        if (p.socketId === socketId) {
          p.connected = false;
          return { sessionId: sesi.sessionId, pesertaId: p.id };
        }
      }
    }
    return {};
  },

  /**
   * Guru memulai lomba Balap Karung Challenge (hanya pemilik sesi).
   */
  mulaiPermainan(sessionId: string, hostId?: string): SesiBalapKarungActive {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) {
      throw new Error('Sesi Balap Karung tidak ditemukan.');
    }

    if (hostId && sesi.hostId !== hostId) {
      throw new Error('Hanya guru pemilik sesi yang berhak memulai permainan.');
    }

    if (sesi.status !== 'lobi') {
      throw new Error('Permainan pada sesi ini sudah dimulai sebelumnya.');
    }

    if (sesi.peserta.size === 0) {
      throw new Error('Belum ada siswa yang bergabung di ruang tunggu.');
    }

    if (sesi.questions.length === 0) {
      throw new Error('Bank soal kosong; tambahkan minimal 1 soal sebelum memulai.');
    }

    sesi.status = 'jalan';
    sesi.gameMulaiPadaMs = Date.now();

    for (const peserta of sesi.peserta.values()) {
      peserta.jarak = 0;
      peserta.keseimbangan = 100;
      peserta.jumlahJatuh = 0;
      peserta.status = 'bermain';
      peserta.antreanSoal = siapkanAntreanSoalBalap(sesi.questions);
      peserta.terakhirSoalId = undefined;
      peserta.presentasiAktif = null;
      peserta.nomorSoalPemain = 0;
    }

    return sesi;
  },

  /**
   * Mengambil soal berikutnya untuk seorang siswa dari antrean acaknya.
   */
  ambilSoalBerikutnyaUntukPeserta(
    sessionId: string,
    pesertaId: string
  ): SoalPublikBalap | null {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || sesi.status !== 'jalan') return null;

    const peserta = sesi.peserta.get(pesertaId);
    if (!peserta) return null;

    if (peserta.status === 'selesai' || peserta.jarak >= sesi.config.targetJarak) {
      return null;
    }

    if (sesi.questions.length === 0) return null;

    if (!peserta.antreanSoal || peserta.antreanSoal.length === 0) {
      peserta.antreanSoal = siapkanAntreanSoalBalap(sesi.questions, peserta.terakhirSoalId);
    }

    const nextQuestionId = peserta.antreanSoal.shift();
    if (!nextQuestionId) return null;

    const soal = sesi.questions.find((q) => q.id === nextQuestionId);
    if (!soal) return null;

    peserta.nomorSoalPemain += 1;
    const presentasi = buatPresentasiSoalBalap(soal, peserta.nomorSoalPemain, Date.now());

    peserta.terakhirSoalId = soal.id;
    peserta.presentasiAktif = presentasi;

    return formatPresentasiPublik(presentasi, sesi.totalSoal);
  },

  /**
   * Mengambil soal yang sedang aktif bagi siswa (misal reconnect) atau menyiapkan yang baru.
   */
  dapatkanSoalAktifPeserta(
    sessionId: string,
    pesertaId: string
  ): SoalPublikBalap | null {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || sesi.status !== 'jalan') return null;

    const peserta = sesi.peserta.get(pesertaId);
    if (!peserta || peserta.status === 'selesai' || peserta.jarak >= sesi.config.targetJarak) {
      return null;
    }

    if (peserta.presentasiAktif) {
      return formatPresentasiPublik(peserta.presentasiAktif, sesi.totalSoal);
    }

    return this.ambilSoalBerikutnyaUntukPeserta(sessionId, pesertaId);
  },

  /**
   * Memproses jawaban siswa dengan perlindungan duplikat, replay, spoofing, dan batas finis.
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
    rngRintangan?: RngBalapKarung;
  }): {
    hasilJawaban: HasilJawabanBalap;
    kunciKey: string;
    penjelasan: string | null;
    leaderboard: LeaderboardItemBalap[];
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
      throw new Error('Sesi Balap Karung tidak ditemukan.');
    }

    if (sesi.status !== 'jalan') {
      throw new Error('Permainan telah berakhir atau belum dimulai. Jawaban tidak diterima.');
    }

    const peserta = sesi.peserta.get(pesertaId);
    if (!peserta) {
      throw new Error('Identitas pemain tidak terdaftar dalam sesi ini.');
    }

    if (pesertaSecret && peserta.secretToken !== pesertaSecret) {
      throw new Error('Token identitas pemain tidak sah.');
    }
    if (!pesertaSecret && socketId && peserta.socketId && peserta.socketId !== socketId) {
      throw new Error('Perangkat pengirim tidak cocok dengan sesi pemain.');
    }

    if (peserta.status === 'selesai' || peserta.jarak >= sesi.config.targetJarak) {
      throw new Error('Anda sudah mencapai garis finis dan menyelesaikan perlombaan.');
    }

    const presentasi = peserta.presentasiAktif;
    if (!presentasi) {
      throw new Error('Tidak ada pertanyaan aktif atau jawaban untuk soal ini sudah diproses.');
    }

    if (presentationId && presentasi.presentationId !== presentationId) {
      throw new Error('Pertanyaan sudah kedaluwarsa atau jawaban sudah pernah dikirim.');
    }
    if (sesi.processedPresentations.has(presentasi.presentationId)) {
      throw new Error('Jawaban ganda terdeteksi dan ditolak oleh server.');
    }
    if (questionId && presentasi.questionId !== questionId) {
      throw new Error('Identitas pertanyaan tidak sesuai dengan soal aktif Anda.');
    }

    // Tandai presentasi secara sinkron sebelum proses & penyimpanan
    sesi.processedPresentations.add(presentasi.presentationId);

    let hasilJawaban: HasilJawabanBalap;
    try {
      hasilJawaban = prosesJawabanBalapKarung({
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
      sesi.processedPresentations.delete(presentasi.presentationId);
      throw err;
    }

    sesi.peserta.set(peserta.id, hasilJawaban.pesertaUpdated);
    void this.sinkronkanPesertaKeDb(sesi.sessionId, hasilJawaban.pesertaUpdated);

    const soalAsli = sesi.questions.find((q) => q.id === presentasi.questionId);
    const semuaPemain = Array.from(sesi.peserta.values());
    const semuaPemainSelesai =
      semuaPemain.length > 0 &&
      semuaPemain.every(
        (p) => p.status === 'selesai' || p.jarak >= sesi.config.targetJarak
      );

    return {
      hasilJawaban,
      kunciKey: presentasi.kunciKey,
      penjelasan: soalAsli?.penjelasan || null,
      leaderboard: this.dapatkanLeaderboard(sesi.sessionId),
      pemainSelesai: hasilJawaban.selesaiBaru,
      semuaPemainSelesai,
    };
  },

  dapatkanLeaderboard(sessionId: string): LeaderboardItemBalap[] {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) return [];
    const sorted = urutkanLeaderboardBalapKarung(
      Array.from(sesi.peserta.values()),
      sesi.config.targetJarak
    );
    return sorted.map((p, idx) =>
      formatLeaderboardItem(p, idx + 1, sesi.config.targetJarak)
    );
  },

  dapatkanLaporanSementara(sessionId: string): LaporanAkhirBalapKarung | null {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) return null;
    return buatLaporanAkhirBalap(sesi, false, Date.now());
  },

  /**
   * Mengakhiri sesi Balap Karung Challenge (otomatis ketika semua finis atau manual oleh guru).
   */
  akhiriPermainan(sessionId: string, dihentikanManual: boolean = false): LaporanAkhirBalapKarung {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) {
      throw new Error('Sesi Balap Karung tidak ditemukan.');
    }

    if (sesi.status === 'selesai' && sesi.hasil) {
      return sesi.hasil;
    }

    sesi.status = 'selesai';
    const hasil = buatLaporanAkhirBalap(sesi, dihentikanManual, Date.now());
    sesi.hasil = hasil;
    return hasil;
  },

  async sinkronkanPesertaKeDb(
    sessionId: string,
    p: PesertaBalapKarungState
  ): Promise<void> {
    return antrekanPenulisanDb(sessionId, async () => {
      try {
        await prisma.sessionPlayer.upsert({
          where: { id: p.id },
          update: {
            nama: p.nama,
            posisi: p.jarak,
            keseimbangan: p.keseimbangan,
            jumlahJatuh: p.jumlahJatuh,
            efekAktif: serializeEfekMeta(p),
            totalBenar: p.totalBenar,
            totalSalah: p.totalSalah,
            streakSaatIni: p.streakSaatIni,
            streakTertinggi: p.streakTertinggi,
            totalWaktuJawabMs: p.totalWaktuJawabMs,
            jumlahJawab: p.jumlahJawab,
            status: p.status,
            waktuSelesaiMs: p.waktuSelesaiMs,
            selesaiPada: p.selesaiPada ? new Date(p.selesaiPada) : null,
            riwayatPosisi: JSON.stringify(p.riwayatJarak),
            riwayatRintangan: JSON.stringify(p.riwayatRintangan),
            riwayatJawaban: JSON.stringify(p.riwayatJawaban),
          },
          create: {
            id: p.id,
            sessionId,
            nama: p.nama,
            posisi: p.jarak,
            keseimbangan: p.keseimbangan,
            jumlahJatuh: p.jumlahJatuh,
            efekAktif: serializeEfekMeta(p),
            totalBenar: p.totalBenar,
            totalSalah: p.totalSalah,
            streakSaatIni: p.streakSaatIni,
            streakTertinggi: p.streakTertinggi,
            totalWaktuJawabMs: p.totalWaktuJawabMs,
            jumlahJawab: p.jumlahJawab,
            status: p.status,
            waktuSelesaiMs: p.waktuSelesaiMs,
            selesaiPada: p.selesaiPada ? new Date(p.selesaiPada) : null,
            riwayatPosisi: JSON.stringify(p.riwayatJarak),
            riwayatRintangan: JSON.stringify(p.riwayatRintangan),
            riwayatJawaban: JSON.stringify(p.riwayatJawaban),
          },
        });
      } catch {
        // Aman diabaikan bila sesi hanya berjalan di unit test in-memory tanpa row DB
      }
    });
  },

  /**
   * Menyimpan seluruh hasil akhir, pemain, dan statistik soal ke SQLite dalam 1 transaksi.
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
        const jarakTertinggi = hasil.podium.juara1?.jarak ?? 0;

        await tx.sessionResult.upsert({
          where: { sessionId: sesi.sessionId },
          update: {
            timMenang: pemenangNama,
            posisiAkhir: jarakTertinggi,
            skorMerah: hasil.totalSelesai,
            skorPutih: hasil.totalPeserta,
          },
          create: {
            sessionId: sesi.sessionId,
            timMenang: pemenangNama,
            posisiAkhir: jarakTertinggi,
            skorMerah: hasil.totalSelesai,
            skorPutih: hasil.totalPeserta,
          },
        });

        for (const p of sesi.peserta.values()) {
          await tx.sessionPlayer.upsert({
            where: { id: p.id },
            update: {
              nama: p.nama,
              posisi: p.jarak,
              keseimbangan: p.keseimbangan,
              jumlahJatuh: p.jumlahJatuh,
              efekAktif: serializeEfekMeta(p),
              totalBenar: p.totalBenar,
              totalSalah: p.totalSalah,
              streakSaatIni: p.streakSaatIni,
              streakTertinggi: p.streakTertinggi,
              totalWaktuJawabMs: p.totalWaktuJawabMs,
              jumlahJawab: p.jumlahJawab,
              status: p.status,
              waktuSelesaiMs: p.waktuSelesaiMs,
              selesaiPada: p.selesaiPada ? new Date(p.selesaiPada) : null,
              riwayatPosisi: JSON.stringify(p.riwayatJarak),
              riwayatRintangan: JSON.stringify(p.riwayatRintangan),
              riwayatJawaban: JSON.stringify(p.riwayatJawaban),
            },
            create: {
              id: p.id,
              sessionId: sesi.sessionId,
              nama: p.nama,
              posisi: p.jarak,
              keseimbangan: p.keseimbangan,
              jumlahJatuh: p.jumlahJatuh,
              efekAktif: serializeEfekMeta(p),
              totalBenar: p.totalBenar,
              totalSalah: p.totalSalah,
              streakSaatIni: p.streakSaatIni,
              streakTertinggi: p.streakTertinggi,
              totalWaktuJawabMs: p.totalWaktuJawabMs,
              jumlahJawab: p.jumlahJawab,
              status: p.status,
              waktuSelesaiMs: p.waktuSelesaiMs,
              selesaiPada: p.selesaiPada ? new Date(p.selesaiPada) : null,
              riwayatPosisi: JSON.stringify(p.riwayatJarak),
              riwayatRintangan: JSON.stringify(p.riwayatRintangan),
              riwayatJawaban: JSON.stringify(p.riwayatJawaban),
            },
          });
        }

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
   * Memuat laporan lengkap Balap Karung dari memori atau SQLite tanpa mencemari peta sesi aktif.
   */
  async muatLaporanDariDatabase(sessionId: string): Promise<LaporanAkhirBalapKarung | null> {
    const inMem = this.dapatkanSesi(sessionId);
    if (inMem?.hasil) return inMem.hasil;
    if (inMem) return buatLaporanAkhirBalap(inMem, false, Date.now());

    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: { include: { questions: { orderBy: { urutan: 'asc' } } } },
        players: true,
      },
    });

    if (!sessionDb || sessionDb.template.game !== 'balap_karung') {
      return null;
    }

    let parsedConfig: Partial<KonfigurasiBalapKarung> | undefined;
    if (sessionDb.konfigurasi) {
      try {
        parsedConfig = JSON.parse(sessionDb.konfigurasi);
      } catch {
        parsedConfig = undefined;
      }
    }

    const config = bangunKonfigurasiBalapKarung(parsedConfig);
    const pesertaMap = new Map<string, PesertaBalapKarungState>();

    for (const pl of sessionDb.players) {
      let riwayatJarak: RiwayatJarakEntry[] = [];
      let riwayatRintangan: RiwayatRintanganBalapEntry[] = [];
      let riwayatJawaban: PesertaBalapKarungState['riwayatJawaban'] = [];
      try {
        riwayatJarak = JSON.parse(pl.riwayatPosisi || '[]');
      } catch {
        riwayatJarak = [];
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

      const efekMeta = parseEfekMeta(pl.efekAktif);

      pesertaMap.set(pl.id, {
        id: pl.id,
        secretToken: '',
        socketId: '',
        nama: pl.nama,
        connected: false,
        jarak: pl.posisi,
        keseimbangan: config.keseimbanganAktif ? pl.keseimbangan : 100,
        jumlahJatuh: pl.jumlahJatuh,
        totalBenar: pl.totalBenar,
        totalSalah: pl.totalSalah,
        streakSaatIni: pl.streakSaatIni,
        streakTertinggi: pl.streakTertinggi,
        bonus3DalamStreak: Boolean(efekMeta.bonus3DalamStreak ?? pl.streakSaatIni >= 3),
        bonus5DalamStreak: Boolean(efekMeta.bonus5DalamStreak ?? pl.streakSaatIni >= 5),
        totalBonusStreakKali: efekMeta.totalBonusStreakKali ?? 0,
        totalBonusStreakMeter: efekMeta.totalBonusStreakMeter ?? 0,
        status: pl.status === 'selesai' ? 'selesai' : 'bermain',
        waktuSelesaiMs: pl.waktuSelesaiMs,
        selesaiPada: pl.selesaiPada ? pl.selesaiPada.getTime() : null,
        totalWaktuJawabMs: pl.totalWaktuJawabMs,
        jumlahJawab: pl.jumlahJawab,
        rataRataWaktuJawabMs:
          pl.jumlahJawab > 0 ? Math.round(pl.totalWaktuJawabMs / pl.jumlahJawab) : 0,
        efekAktif: {
          perisai: Boolean(efekMeta.perisai),
          lompatanKuat: Boolean(efekMeta.lompatanKuat),
          jalanBerlumpur: Boolean(efekMeta.jalanBerlumpur),
        },
        riwayatJarak,
        riwayatRintangan,
        riwayatJawaban,
        antreanSoal: [],
        presentasiAktif: null,
        nomorSoalPemain: riwayatJawaban.length,
      });
    }

    const tempSesi: SesiBalapKarungActive = {
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

    return buatLaporanAkhirBalap(
      tempSesi,
      !allSelesai,
      sessionDb.selesaiPada ? sessionDb.selesaiPada.getTime() : Date.now()
    );
  },

  hapusSesi(sessionId: string): void {
    const sesi = sesiBalapMap.get(sessionId);
    if (sesi) {
      tokenToSessionIdMap.delete(sesi.token);
      sesiBalapMap.delete(sessionId);
    }
    dbWriteQueues.delete(sessionId);
  },
};
