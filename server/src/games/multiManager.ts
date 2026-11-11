import crypto from 'crypto';
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
  acakArray,
  perbaruiStreakIndividu,
  tentukanHadiahPowerUp,
  evaluasiRondeTarikTambang,
  cekKondisiSelesai,
  tentukanPemenang,
  normalisasiKodeTim,
} from './tarikTambang.js';

export type SoalMulti = SoalBankTarikTambang;

export interface PesertaMulti {
  id: string;
  pesertaSecret: string;
  socketId: string;
  nama: string;
  tim: TimTarikTambang | null;
  connected: boolean;
  terakhirAktif: number;
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
}

export interface JawabanPesertaSoal {
  pesertaId: string;
  tim: TimTarikTambang;
  jawaban: string;
  benar: boolean;
  waktuJawabMs: number;
  bonusStreakDidapat: number;
}

export interface RiwayatRondeMulti {
  nomorRonde: number;
  tim1QuestionId: string;
  tim2QuestionId: string;
  tim1Teks: string;
  tim2Teks: string;
  tim1Kunci: string;
  tim2Kunci: string;
  tim1Penjelasan: string | null;
  tim2Penjelasan: string | null;
  tim1BenarCount: number;
  tim1AnggotaCount: number;
  tim2BenarCount: number;
  tim2AnggotaCount: number;
  akurasiTim1: number;
  akurasiTim2: number;
  selisihKekuatan: number;
  bonusStreakTim1: number;
  bonusStreakTim2: number;
  bonusKekompakanTim1: number;
  bonusKekompakanTim2: number;
  powerUpTim1Dipakai: JenisPowerUpTarik | null;
  powerUpTim2Dipakai: JenisPowerUpTarik | null;
  bonusPowerUpNet: number;
  posisiSebelum: number;
  perubahanTali: number;
  posisiSesudah: number;
}

export interface RondeMultiAktif {
  nomorRonde: number;
  soalTim1: PresentasiSoalTarik;
  soalTim2: PresentasiSoalTarik;
  anggotaAwalTim1: number;
  anggotaAwalTim2: number;
  dimulaiPadaMs: number;
  berakhirPadaMs: number;
  jawabanMap: Map<string, JawabanPesertaSoal>;
  powerUpTim1Dipakai: JenisPowerUpTarik | null;
  powerUpTim2Dipakai: JenisPowerUpTarik | null;
  ditutup: boolean;
  sedangDiproses: boolean;
  hasilRonde: RiwayatRondeMulti | null;
}

export interface LaporanPemainMulti {
  id: string;
  nama: string;
  tim: TimTarikTambang;
  totalBenar: number;
  totalSalah: number;
  jumlahJawab: number;
  akurasiPersen: number;
  streakTertinggi: number;
  totalBonusStreak: number;
  rataRataWaktuJawabMs: number;
}

export interface LaporanTarikTambangMulti {
  sessionId: string;
  playMode: 'MULTIPLAYER';
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
  totalPeserta: number;
  totalJawabanBenar: number;
  totalJawabanSalah: number;
  totalBonusStreakTim1: number;
  totalBonusStreakTim2: number;
  totalBonusKekompakanTim1: number;
  totalBonusKekompakanTim2: number;
  penggunaanPowerUp: {
    tim1: Array<{ ronde: number; tipe: JenisPowerUpTarik; nama: string }>;
    tim2: Array<{ ronde: number; tipe: JenisPowerUpTarik; nama: string }>;
  };
  durasiPermainanMs: number;
  riwayatTali: Array<{ ronde: number; posisi: number; perubahan: number }>;
  riwayatRonde: RiwayatRondeMulti[];
  statistikPemain: LaporanPemainMulti[];
}

export interface TeamPowerUpState {
  bank: JenisPowerUpTarik | null;
  aktifBerikutnya: JenisPowerUpTarik | null;
  riwayat: Array<{ ronde: number; tipe: JenisPowerUpTarik }>;
}

export interface SesiMultiplayerActive {
  sessionId: string;
  playMode: 'MULTIPLAYER';
  token: string;
  templateId: string;
  templateJudul: string;
  hostId: string;
  hostSocketId?: string;
  status: 'lobi' | 'jalan' | 'selesai';
  config: KonfigurasiTarikTambang;
  peserta: Map<string, PesertaMulti>;
  poolSetara: SoalBankTarikTambang[];
  antreanSoal: SoalBankTarikTambang[];
  terakhirTim1Id?: string;
  terakhirTim2Id?: string;
  nomorRondeCounter: number;
  currentQuestionIndex: number;
  totalSoal: number;
  questions: SoalBankTarikTambang[];
  taliPosition: number;
  skorMerah: number;
  skorPutih: number;
  powerUpTim1: TeamPowerUpState;
  powerUpTim2: TeamPowerUpState;
  totalBonusStreakTim1: number;
  totalBonusStreakTim2: number;
  totalBonusKekompakanTim1: number;
  totalBonusKekompakanTim2: number;
  soalMulaiPada?: number;
  soalBerakhirPada?: number;
  timerHandle?: NodeJS.Timeout;
  intermissionHandle?: NodeJS.Timeout;
  rondeAktif: RondeMultiAktif | null;
  riwayatRonde: RiwayatRondeMulti[];
  riwayatTali: Array<{ ronde: number; posisi: number; perubahan: number }>;
  // Alias untuk kompatibilitas laporan per-soal
  jawabanPerSoal: Map<string, Map<string, JawabanPesertaSoal>>;
  questionStatsMap: Map<string, { jumlahBenar: number; jumlahSalah: number }>;
  waktuMulaiMs: number | null;
  waktuSelesaiMs: number | null;
  hasil?: LaporanTarikTambangMulti;
}

const sesiMultiMap = new Map<string, SesiMultiplayerActive>();
const tokenToSessionIdMap = new Map<string, string>();

function hitungJumlahAnggotaTim(sesi: SesiMultiplayerActive): { tim1: number; tim2: number } {
  let tim1 = 0;
  let tim2 = 0;
  for (const p of sesi.peserta.values()) {
    if (p.tim === 'merah') tim1++;
    else if (p.tim === 'putih') tim2++;
  }
  return { tim1, tim2 };
}

function susunLaporanAkhirMulti(sesi: SesiMultiplayerActive): LaporanTarikTambangMulti {
  const timMenang = tentukanPemenang(sesi.taliPosition);
  let totalBenar = 0;
  let totalSalah = 0;
  let sumBenar1 = 0;
  let sumJawab1 = 0;
  let sumBenar2 = 0;
  let sumJawab2 = 0;

  const statistikPemain: LaporanPemainMulti[] = [];
  for (const p of sesi.peserta.values()) {
    totalBenar += p.totalBenar;
    totalSalah += p.totalSalah;
    const ak = p.jumlahJawab > 0 ? Math.round((p.totalBenar / p.jumlahJawab) * 100) : 0;
    const avgMs = p.jumlahJawab > 0 ? Math.round(p.totalWaktuJawabMs / p.jumlahJawab) : 0;
    p.akurasiPersen = ak;
    p.rataRataWaktuJawabMs = avgMs;

    if (p.tim === 'merah') {
      sumBenar1 += p.totalBenar;
      sumJawab1 += p.jumlahJawab;
    } else if (p.tim === 'putih') {
      sumBenar2 += p.totalBenar;
      sumJawab2 += p.jumlahJawab;
    }

    if (p.tim) {
      statistikPemain.push({
        id: p.id,
        nama: p.nama,
        tim: p.tim,
        totalBenar: p.totalBenar,
        totalSalah: p.totalSalah,
        jumlahJawab: p.jumlahJawab,
        akurasiPersen: ak,
        streakTertinggi: p.streakTertinggi,
        totalBonusStreak: p.totalBonusStreak,
        rataRataWaktuJawabMs: avgMs,
      });
    }
  }

  statistikPemain.sort((a, b) => b.totalBenar - a.totalBenar || a.rataRataWaktuJawabMs - b.rataRataWaktuJawabMs);

  const endMs = sesi.waktuSelesaiMs ?? Date.now();
  const durasiPermainanMs = sesi.waktuMulaiMs ? Math.max(0, endMs - sesi.waktuMulaiMs) : 0;

  return {
    sessionId: sesi.sessionId,
    playMode: 'MULTIPLAYER',
    templateId: sesi.templateId,
    templateJudul: sesi.templateJudul,
    konfigurasi: sesi.config,
    timMenang,
    posisiAkhir: sesi.taliPosition,
    jumlahRonde: sesi.riwayatRonde.length,
    skorMerah: sesi.skorMerah,
    skorPutih: sesi.skorPutih,
    akurasiTim1: sumJawab1 > 0 ? Math.round((sumBenar1 / sumJawab1) * 100) : 0,
    akurasiTim2: sumJawab2 > 0 ? Math.round((sumBenar2 / sumJawab2) * 100) : 0,
    totalPeserta: sesi.peserta.size,
    totalJawabanBenar: totalBenar,
    totalJawabanSalah: totalSalah,
    totalBonusStreakTim1: sesi.totalBonusStreakTim1,
    totalBonusStreakTim2: sesi.totalBonusStreakTim2,
    totalBonusKekompakanTim1: sesi.totalBonusKekompakanTim1,
    totalBonusKekompakanTim2: sesi.totalBonusKekompakanTim2,
    penggunaanPowerUp: {
      tim1: sesi.powerUpTim1.riwayat.map((r) => ({ ...r, nama: INFO_POWERUP_TARIK[r.tipe].nama })),
      tim2: sesi.powerUpTim2.riwayat.map((r) => ({ ...r, nama: INFO_POWERUP_TARIK[r.tipe].nama })),
    },
    durasiPermainanMs,
    riwayatTali: sesi.riwayatTali,
    riwayatRonde: sesi.riwayatRonde,
    statistikPemain,
  };
}

export const multiManager = {
  generateUniqueToken(): string {
    let token = '';
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 100) {
      attempts++;
      token = Math.floor(100000 + Math.random() * 900000).toString();
      exists = tokenToSessionIdMap.has(token);
    }

    if (exists) {
      throw new Error('Gagal menghasilkan token unik. Silakan coba lagi.');
    }
    return token;
  },

  inisialisasiSesi(
    sessionId: string,
    token: string,
    hostId: string,
    template: { id: string; judul: string },
    questions: SoalBankTarikTambang[],
    rawConfig?: Partial<KonfigurasiTarikTambang>
  ): SesiMultiplayerActive {
    if (tokenToSessionIdMap.has(token)) {
      const oldId = tokenToSessionIdMap.get(token)!;
      this.hapusSesi(oldId);
    }

    const config = bangunKonfigurasiTarikTambang(rawConfig);
    const poolSetara = filterBankSoalSetara(questions, config.kesulitan);

    const sesi: SesiMultiplayerActive = {
      sessionId,
      playMode: 'MULTIPLAYER',
      token,
      templateId: template.id,
      templateJudul: template.judul,
      hostId,
      status: 'lobi',
      config,
      peserta: new Map(),
      poolSetara,
      antreanSoal: [],
      nomorRondeCounter: 0,
      currentQuestionIndex: 0,
      totalSoal: poolSetara.length,
      questions: poolSetara,
      taliPosition: POSISI_AWAL_TALI,
      skorMerah: 0,
      skorPutih: 0,
      powerUpTim1: { bank: null, aktifBerikutnya: null, riwayat: [] },
      powerUpTim2: { bank: null, aktifBerikutnya: null, riwayat: [] },
      totalBonusStreakTim1: 0,
      totalBonusStreakTim2: 0,
      totalBonusKekompakanTim1: 0,
      totalBonusKekompakanTim2: 0,
      rondeAktif: null,
      riwayatRonde: [],
      riwayatTali: [{ ronde: 0, posisi: POSISI_AWAL_TALI, perubahan: 0 }],
      jawabanPerSoal: new Map(),
      questionStatsMap: new Map(),
      waktuMulaiMs: null,
      waktuSelesaiMs: null,
    };

    sesiMultiMap.set(sessionId, sesi);
    tokenToSessionIdMap.set(token, sessionId);
    return sesi;
  },

  dapatkanSesi(sessionId: string): SesiMultiplayerActive | undefined {
    return sesiMultiMap.get(sessionId);
  },

  dapatkanSesiDariToken(token: string): SesiMultiplayerActive | undefined {
    const sessionId = tokenToSessionIdMap.get(token);
    if (!sessionId) return undefined;
    return sesiMultiMap.get(sessionId);
  },

  async pulihkanSesiDariDb(sessionId: string): Promise<SesiMultiplayerActive | null> {
    const existing = sesiMultiMap.get(sessionId);
    if (existing) return existing;

    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: {
          include: { questions: { orderBy: { urutan: 'asc' } } },
        },
        players: true,
        result: true,
      },
    });

    if (!sessionDb || sessionDb.template.game !== 'tarik_tambang' || sessionDb.mode !== 'multi') {
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
      const token = sessionDb.token || this.generateUniqueToken();
      const mappedQuestions = sessionDb.template.questions.map(mapDbQuestionForGame);
      const sesi = this.inisialisasiSesi(
        sessionDb.id,
        token,
        sessionDb.hostId,
        { id: sessionDb.template.id, judul: sessionDb.template.judul },
        mappedQuestions,
        parsedConfig
      );

      sesi.status =
        sessionDb.status === 'jalan'
          ? 'jalan'
          : sessionDb.status === 'selesai'
            ? 'selesai'
            : 'lobi';
      sesi.waktuMulaiMs = sessionDb.mulaiPada ? sessionDb.mulaiPada.getTime() : null;
      sesi.waktuSelesaiMs = sessionDb.selesaiPada ? sessionDb.selesaiPada.getTime() : null;

      if (sessionDb.result) {
        sesi.taliPosition = sessionDb.result.posisiAkhir;
        sesi.skorMerah = sessionDb.result.skorMerah;
        sesi.skorPutih = sessionDb.result.skorPutih;
      }

      for (const pl of sessionDb.players) {
        const tim: TimTarikTambang = pl.tim === 'tim2' || pl.tim === 'putih' ? 'putih' : 'merah';
        const jumlahJawab = pl.jumlahJawab || pl.totalBenar + pl.totalSalah;
        sesi.peserta.set(pl.id, {
          id: pl.id,
          pesertaSecret: crypto.randomUUID(),
          socketId: '',
          nama: pl.nama,
          tim,
          connected: false,
          terakhirAktif: Date.now(),
          totalBenar: pl.totalBenar,
          totalSalah: pl.totalSalah,
          jumlahJawab,
          akurasiPersen: jumlahJawab > 0 ? Math.round((pl.totalBenar / jumlahJawab) * 100) : 0,
          streakSaatIni: pl.streakSaatIni,
          streakTertinggi: pl.streakTertinggi,
          milestone3Sudah: pl.streakSaatIni >= 3,
          milestone5Sudah: pl.streakSaatIni >= 5,
          totalBonusStreak: pl.poinBonus,
          totalWaktuJawabMs: pl.totalWaktuJawabMs,
          rataRataWaktuJawabMs:
            jumlahJawab > 0 ? Math.round(pl.totalWaktuJawabMs / jumlahJawab) : 0,
        });
      }

      if (sesi.status === 'selesai') {
        sesi.hasil = (await this.muatLaporanDariDatabase(sessionDb.id)) || undefined;
      }

      return sesi;
    } catch {
      return null;
    }
  },

  gabungPeserta(
    token: string,
    nama: string,
    socketId: string,
    existingPesertaId?: string,
    existingSecret?: string
  ): {
    sesi: SesiMultiplayerActive;
    peserta: PesertaMulti;
    isReconnect: boolean;
  } {
    const sesi = this.dapatkanSesiDariToken(token);
    if (!sesi) {
      throw new Error('Kode token sesi tidak ditemukan atau permainan telah selesai.');
    }

    const cleanNama = nama.trim();
    if (!cleanNama) {
      throw new Error('Nama panggilan wajib diisi.');
    }

    // 1. Cek Reconnect berdasarkan existingPesertaId
    if (existingPesertaId && sesi.peserta.has(existingPesertaId)) {
      const p = sesi.peserta.get(existingPesertaId)!;
      if (existingSecret && p.pesertaSecret !== existingSecret) {
        throw new Error('Kredensial peserta tidak cocok saat menghubungkan ulang.');
      }
      p.socketId = socketId;
      p.connected = true;
      p.terakhirAktif = Date.now();
      return { sesi, peserta: p, isReconnect: true };
    }

    // 2. Cek Reconnect berdasarkan nama panggilan yang sama pada sesi berjalan
    for (const p of sesi.peserta.values()) {
      if (p.nama.toLowerCase() === cleanNama.toLowerCase()) {
        if (sesi.status === 'jalan' && p.connected) {
          throw new Error(`Nama "${cleanNama}" sedang aktif digunakan siswa lain.`);
        }
        p.socketId = socketId;
        p.connected = true;
        p.terakhirAktif = Date.now();
        return { sesi, peserta: p, isReconnect: true };
      }
    }

    // 3. Siswa yang terlambat bergabung tidak boleh masuk ke pertandingan yang sudah berjalan
    if (sesi.status !== 'lobi') {
      throw new Error('Permainan sudah dimulai. Siswa baru tidak dapat bergabung setelah lomba berjalan.');
    }

    // 4. Batas kapasitas peserta fleksibel (sesuai config)
    if (sesi.peserta.size >= sesi.config.maxPeserta) {
      throw new Error(`Lobi sudah penuh (maksimal ${sesi.config.maxPeserta} siswa).`);
    }

    // 5. Bagi ke tim yang lebih sedikit secara otomatis & seimbang (tanpa bot)
    const { tim1, tim2 } = hitungJumlahAnggotaTim(sesi);
    const assignedTeam: TimTarikTambang = tim1 <= tim2 ? 'merah' : 'putih';

    const pesertaId = `p_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const pesertaSecret = crypto.randomUUID().slice(0, 12);
    const pesertaBaru: PesertaMulti = {
      id: pesertaId,
      pesertaSecret,
      socketId,
      nama: cleanNama,
      tim: assignedTeam,
      connected: true,
      terakhirAktif: Date.now(),
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
    };

    sesi.peserta.set(pesertaId, pesertaBaru);
    return { sesi, peserta: pesertaBaru, isReconnect: false };
  },

  putusKoneksiPeserta(socketId: string): { sessionId?: string; pesertaId?: string } {
    for (const sesi of sesiMultiMap.values()) {
      for (const [id, p] of sesi.peserta.entries()) {
        if (p.socketId === socketId) {
          p.connected = false;
          p.terakhirAktif = Date.now();
          return { sessionId: sesi.sessionId, pesertaId: id };
        }
      }
    }
    return {};
  },

  bagiTimSeimbang(sesi: SesiMultiplayerActive): void {
    const listPeserta = acakArray(Array.from(sesi.peserta.values()));
    if (listPeserta.length < 2) {
      throw new Error('Minimal harus ada 2 peserta untuk memulai lomba tarik tambang.');
    }

    listPeserta.forEach((p, idx) => {
      p.tim = idx % 2 === 0 ? 'merah' : 'putih';
    });
  },

  /**
   * Guru mengacak ulang pembagian tim sebelum permainan dimulai (lobi)
   */
  acakUlangTim(sessionId: string, hostId: string): SesiMultiplayerActive {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || sesi.hostId !== hostId) {
      throw new Error('Sesi tidak ditemukan atau Anda bukan pemilik sesi.');
    }
    if (sesi.status !== 'lobi') {
      throw new Error('Pengacakan tim hanya dapat dilakukan sebelum permainan dimulai.');
    }
    this.bagiTimSeimbang(sesi);
    return sesi;
  },

  /**
   * Guru memindahkan anggota tim sebelum permainan dimulai (lobi).
   * Ditolak tegas setelah permainan dimulai!
   */
  pindahTimPeserta(
    sessionId: string,
    hostId: string,
    pesertaId: string,
    timTujuanRaw: string
  ): SesiMultiplayerActive {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || sesi.hostId !== hostId) {
      throw new Error('Sesi tidak ditemukan atau Anda bukan pemilik sesi.');
    }
    if (sesi.status !== 'lobi') {
      throw new Error('Siswa tidak dapat berpindah tim setelah pertandingan dimulai.');
    }
    const p = sesi.peserta.get(pesertaId);
    if (!p) {
      throw new Error('Peserta tidak ditemukan.');
    }
    const timTujuan = normalisasiKodeTim(timTujuanRaw);
    if (!timTujuan) {
      throw new Error('Tim tujuan tidak valid.');
    }
    p.tim = timTujuan;
    return sesi;
  },

  mulaiPermainan(sessionId: string, hostId: string): SesiMultiplayerActive {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi || sesi.hostId !== hostId) {
      throw new Error('Sesi tidak ditemukan atau Anda bukan pemilik sesi.');
    }
    if (sesi.status !== 'lobi') {
      throw new Error('Permainan pada sesi ini sudah dimulai sebelumnya.');
    }

    if (sesi.peserta.size < 2) {
      throw new Error('Minimal dibutuhkan 2 peserta di lobi untuk memulai permainan.');
    }

    // Pastikan setiap siswa sudah memiliki tim dan kedua tim tidak kosong
    const { tim1, tim2 } = hitungJumlahAnggotaTim(sesi);
    if (tim1 === 0 || tim2 === 0 || tim1 + tim2 < sesi.peserta.size) {
      this.bagiTimSeimbang(sesi);
    }

    sesi.status = 'jalan';
    sesi.waktuMulaiMs = Date.now();
    sesi.currentQuestionIndex = 0;
    sesi.taliPosition = POSISI_AWAL_TALI;
    sesi.skorMerah = 0;
    sesi.skorPutih = 0;

    return sesi;
  },

  mulaiRondeBaru(sessionId: string): RondeMultiAktif {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');

    if (sesi.timerHandle) {
      clearTimeout(sesi.timerHandle);
      sesi.timerHandle = undefined;
    }

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
    sesi.currentQuestionIndex = sesi.nomorRondeCounter - 1;

    const { tim1, tim2 } = hitungJumlahAnggotaTim(sesi);
    const now = Date.now();
    const endsAt = now + sesi.config.durasiRonde * 1000;

    sesi.soalMulaiPada = now;
    sesi.soalBerakhirPada = endsAt;

    const pu1 = sesi.powerUpTim1.aktifBerikutnya;
    const pu2 = sesi.powerUpTim2.aktifBerikutnya;
    sesi.powerUpTim1.aktifBerikutnya = null;
    sesi.powerUpTim2.aktifBerikutnya = null;

    if (pu1) sesi.powerUpTim1.riwayat.push({ ronde: sesi.nomorRondeCounter, tipe: pu1 });
    if (pu2) sesi.powerUpTim2.riwayat.push({ ronde: sesi.nomorRondeCounter, tipe: pu2 });

    const ronde: RondeMultiAktif = {
      nomorRonde: sesi.nomorRondeCounter,
      soalTim1: buatPresentasiSoalTarik(soalTim1, sesi.config.kesulitan, true),
      soalTim2: buatPresentasiSoalTarik(soalTim2, sesi.config.kesulitan, true),
      anggotaAwalTim1: Math.max(1, tim1),
      anggotaAwalTim2: Math.max(1, tim2),
      dimulaiPadaMs: now,
      berakhirPadaMs: endsAt,
      jawabanMap: new Map(),
      powerUpTim1Dipakai: pu1,
      powerUpTim2Dipakai: pu2,
      ditutup: false,
      sedangDiproses: false,
      hasilRonde: null,
    };

    sesi.rondeAktif = ronde;
    return ronde;
  },

  /**
   * Mengaktifkan Power-Up milik tim tertentu untuk ronde berikutnya (maks 1 aktif, anti-tumpuk)
   */
  aktifkanPowerUpTim(
    sessionId: string,
    timRaw: string,
    pesertaId?: string,
    pesertaSecret?: string
  ): {
    tim: TimTarikTambang;
    powerUp: JenisPowerUpTarik;
    sesi: SesiMultiplayerActive;
  } {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');
    if (sesi.status !== 'jalan') {
      throw new Error('Power-up hanya dapat diaktifkan saat pertandingan berjalan.');
    }
    if (!sesi.config.powerUpAktif) {
      throw new Error('Power-up dinonaktifkan pada pengaturan permainan ini.');
    }

    let tim = normalisasiKodeTim(timRaw);
    if (pesertaId) {
      const p = sesi.peserta.get(pesertaId);
      if (!p || !p.tim) throw new Error('Peserta tidak valid.');
      if (pesertaSecret && p.pesertaSecret !== pesertaSecret) {
        throw new Error('Kredensial peserta tidak valid.');
      }
      tim = p.tim;
    }

    if (!tim) throw new Error('Tim tidak valid.');

    const puState = tim === 'merah' ? sesi.powerUpTim1 : sesi.powerUpTim2;
    if (!puState.bank) {
      throw new Error('Tim belum memiliki power-up tersedia.');
    }
    if (puState.aktifBerikutnya !== null) {
      throw new Error('Power-up untuk ronde berikutnya sudah diaktifkan.');
    }

    const powerUp = puState.bank;
    puState.bank = null;
    puState.aktifBerikutnya = powerUp;

    return { tim, powerUp, sesi };
  },

  /**
   * Menjaga kompatibilitas pemanggilan test lama `mulaiTimerSoal`
   */
  mulaiTimerSoal(
    sessionId: string,
    durasiDetik?: number
  ): { soalMulaiPada: number; soalBerakhirPada: number } {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');
    if (!sesi.rondeAktif || sesi.rondeAktif.ditutup) {
      if (durasiDetik && (durasiDetik === 15 || durasiDetik === 20 || durasiDetik === 30)) {
        sesi.config.durasiRonde = durasiDetik;
      }
      const r = this.mulaiRondeBaru(sessionId);
      return { soalMulaiPada: r.dimulaiPadaMs, soalBerakhirPada: r.berakhirPadaMs };
    }
    const durasiMs = (durasiDetik ?? sesi.config.durasiRonde) * 1000;
    const now = Date.now();
    sesi.rondeAktif.dimulaiPadaMs = now;
    sesi.rondeAktif.berakhirPadaMs = now + durasiMs;
    sesi.soalMulaiPada = now;
    sesi.soalBerakhirPada = now + durasiMs;
    return { soalMulaiPada: now, soalBerakhirPada: now + durasiMs };
  },

  prosesJawabanSiswa(
    sessionId: string,
    pesertaId: string,
    input: {
      presentationId?: string;
      questionId?: string;
      choiceId?: string;
      jawaban?: string;
      pesertaSecret?: string;
    }
  ): {
    tim: TimTarikTambang;
    benar: boolean;
    kodeDipilih: string;
    taliPosition: number;
    skorMerah: number;
    skorPutih: number;
    progressTim1: { dijawab: number; total: number };
    progressTim2: { dijawab: number; total: number };
    semuaSelesai: boolean;
  } {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) throw new Error('Sesi permainan tidak ditemukan.');
    if (sesi.status !== 'jalan') throw new Error('Permainan tidak sedang aktif.');

    const ronde = sesi.rondeAktif;
    if (!ronde || ronde.ditutup || ronde.sedangDiproses) {
      throw new Error('Ronde ini sudah ditutup. Tunggu ronde berikutnya dimulai.');
    }

    const peserta = sesi.peserta.get(pesertaId);
    if (!peserta || !peserta.tim) {
      throw new Error('Peserta tidak valid atau belum memiliki tim.');
    }
    if (input.pesertaSecret && peserta.pesertaSecret !== input.pesertaSecret) {
      throw new Error('Kredensial peserta tidak valid.');
    }

    // Tolak jawaban terlambat melewati batas waktu ronde + toleransi 600ms
    if (Date.now() > ronde.berakhirPadaMs + 600) {
      throw new Error('Waktu untuk menjawab ronde ini telah habis.');
    }

    // Tolak duplikasi jawaban siswa pada ronde aktif
    if (ronde.jawabanMap.has(pesertaId)) {
      throw new Error('Anda sudah mengirim jawaban untuk ronde ini.');
    }

    const presTim = peserta.tim === 'merah' ? ronde.soalTim1 : ronde.soalTim2;
    const presLawan = peserta.tim === 'merah' ? ronde.soalTim2 : ronde.soalTim1;

    if (input.presentationId && input.presentationId === presLawan.presentationId) {
      throw new Error('Tidak dapat menjawab soal milik tim lawan.');
    }
    if (input.presentationId && input.presentationId !== presTim.presentationId) {
      throw new Error('Soal yang dikirim tidak sesuai dengan ronde aktif.');
    }
    if (
      input.questionId &&
      input.questionId !== 'undefined' &&
      input.questionId !== 'null' &&
      input.questionId !== presTim.questionId
    ) {
      throw new Error('Soal yang dijawab bukan soal aktif tim Anda.');
    }

    const { benar, kodeDipilih } = validasiJawabanPresentasi(presTim, {
      choiceId: input.choiceId,
      jawaban: input.jawaban,
    });

    const waktuJawabMs = Math.max(80, Date.now() - ronde.dimulaiPadaMs);

    // Update statistik individual (streak + bonus milestone sekali per siklus)
    peserta.jumlahJawab += 1;
    peserta.totalWaktuJawabMs += waktuJawabMs;
    if (benar) {
      peserta.totalBenar += 1;
      if (peserta.tim === 'merah') sesi.skorMerah += 1;
      else sesi.skorPutih += 1;
    } else {
      peserta.totalSalah += 1;
    }

    const st = perbaruiStreakIndividu({
      streakSaatIni: peserta.streakSaatIni,
      streakTertinggi: peserta.streakTertinggi,
      milestone3SudahDapat: peserta.milestone3Sudah,
      milestone5SudahDapat: peserta.milestone5Sudah,
      benar,
      bonusAktif: sesi.config.bonusAktif,
    });
    peserta.streakSaatIni = st.streakBaru;
    peserta.streakTertinggi = st.streakTertinggiBaru;
    peserta.milestone3Sudah = st.milestone3SudahDapat;
    peserta.milestone5Sudah = st.milestone5SudahDapat;
    peserta.totalBonusStreak += st.bonusDidapat;
    peserta.akurasiPersen = Math.round((peserta.totalBenar / peserta.jumlahJawab) * 100);
    peserta.rataRataWaktuJawabMs = Math.round(peserta.totalWaktuJawabMs / peserta.jumlahJawab);

    const record: JawabanPesertaSoal = {
      pesertaId,
      tim: peserta.tim,
      jawaban: kodeDipilih,
      benar,
      waktuJawabMs,
      bonusStreakDidapat: st.bonusDidapat,
    };

    ronde.jawabanMap.set(pesertaId, record);

    let perSoalMap = sesi.jawabanPerSoal.get(presTim.questionId);
    if (!perSoalMap) {
      perSoalMap = new Map();
      sesi.jawabanPerSoal.set(presTim.questionId, perSoalMap);
    }
    perSoalMap.set(pesertaId, record);

    const qStat = sesi.questionStatsMap.get(presTim.questionId) || {
      jumlahBenar: 0,
      jumlahSalah: 0,
    };
    if (benar) qStat.jumlahBenar += 1;
    else qStat.jumlahSalah += 1;
    sesi.questionStatsMap.set(presTim.questionId, qStat);

    let dijawab1 = 0;
    let dijawab2 = 0;
    for (const j of ronde.jawabanMap.values()) {
      if (j.tim === 'merah') dijawab1++;
      else dijawab2++;
    }

    const totalAktifPeserta = Array.from(sesi.peserta.values()).filter((p) => p.connected && p.tim).length;
    const targetJawab = Math.max(totalAktifPeserta, sesi.peserta.size);
    const semuaSelesai = ronde.jawabanMap.size >= Math.max(1, targetJawab);

    return {
      tim: peserta.tim,
      benar,
      kodeDipilih,
      taliPosition: sesi.taliPosition,
      skorMerah: sesi.skorMerah,
      skorPutih: sesi.skorPutih,
      progressTim1: { dijawab: dijawab1, total: ronde.anggotaAwalTim1 },
      progressTim2: { dijawab: dijawab2, total: ronde.anggotaAwalTim2 },
      semuaSelesai,
    };
  },

  /**
   * Menutup ronde aktif secara atomik, menghitung akurasi tim, bonus, pergerakan tali,
   * serta memeriksa kondisi kemenangan [-100 .. +100].
   */
  selesaikanSoalAktif(sessionId: string): {
    hasilRonde: RiwayatRondeMulti;
    isGameFinished: boolean;
  } {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');

    if (sesi.timerHandle) {
      clearTimeout(sesi.timerHandle);
      sesi.timerHandle = undefined;
    }

    const ronde = sesi.rondeAktif;
    if (!ronde) throw new Error('Belum ada ronde aktif.');

    // Proteksi idempoten: cegah evaluasi ronde dua kali
    if (ronde.ditutup && ronde.hasilRonde) {
      return {
        hasilRonde: ronde.hasilRonde,
        isGameFinished: sesi.status === 'selesai',
      };
    }

    ronde.sedangDiproses = true;
    ronde.ditutup = true;

    // Reset streak siswa yang tidak menjawab pada ronde ini
    for (const p of sesi.peserta.values()) {
      if (p.tim && !ronde.jawabanMap.has(p.id)) {
        p.streakSaatIni = 0;
        p.milestone3Sudah = false;
        p.milestone5Sudah = false;
      }
    }

    let tim1BenarCount = 0;
    let tim2BenarCount = 0;
    let streakTim1Raw = 0;
    let streakTim2Raw = 0;

    for (const j of ronde.jawabanMap.values()) {
      if (j.tim === 'merah') {
        if (j.benar) tim1BenarCount++;
        streakTim1Raw += j.bonusStreakDidapat;
      } else {
        if (j.benar) tim2BenarCount++;
        streakTim2Raw += j.bonusStreakDidapat;
      }
    }

    // Batasi kontribusi bonus streak ronde per tim maksimal +10 agar seimbang terhadap batas gerak 25 poin
    const bonusStreakTim1 = Math.min(10, streakTim1Raw);
    const bonusStreakTim2 = Math.min(10, streakTim2Raw);

    const posisiSebelum = sesi.taliPosition;
    const evalRonde = evaluasiRondeTarikTambang({
      mode: 'MULTIPLAYER',
      posisiLama: posisiSebelum,
      tim1Benar: tim1BenarCount,
      tim1TotalAnggota: ronde.anggotaAwalTim1,
      tim2Benar: tim2BenarCount,
      tim2TotalAnggota: ronde.anggotaAwalTim2,
      bonusStreakTim1,
      bonusStreakTim2,
      bonusAktif: sesi.config.bonusAktif,
      powerUpTim1Aktif: ronde.powerUpTim1Dipakai,
      powerUpTim2Aktif: ronde.powerUpTim2Dipakai,
      batasMenang: sesi.config.batasMenang,
    });

    sesi.taliPosition = evalRonde.posisiBaru;
    sesi.totalBonusStreakTim1 += bonusStreakTim1;
    sesi.totalBonusStreakTim2 += bonusStreakTim2;
    sesi.totalBonusKekompakanTim1 += evalRonde.bonusKekompakanTim1;
    sesi.totalBonusKekompakanTim2 += evalRonde.bonusKekompakanTim2;

    // Hadiah Power-Up adil bila bank tim kosong & akurasi tim di ronde >= 80% / 100%
    sesi.powerUpTim1.bank = tentukanHadiahPowerUp({
      powerUpAktif: sesi.config.powerUpAktif,
      bankSaatIni: sesi.powerUpTim1.bank,
      streakBaru: 0,
      akurasiRondePersen: evalRonde.akurasiTim1,
    });
    sesi.powerUpTim2.bank = tentukanHadiahPowerUp({
      powerUpAktif: sesi.config.powerUpAktif,
      bankSaatIni: sesi.powerUpTim2.bank,
      streakBaru: 0,
      akurasiRondePersen: evalRonde.akurasiTim2,
    });

    const hasilRonde: RiwayatRondeMulti = {
      nomorRonde: ronde.nomorRonde,
      tim1QuestionId: ronde.soalTim1.questionId,
      tim2QuestionId: ronde.soalTim2.questionId,
      tim1Teks: ronde.soalTim1.teks,
      tim2Teks: ronde.soalTim2.teks,
      tim1Kunci: ronde.soalTim1.jawabanBenarKode,
      tim2Kunci: ronde.soalTim2.jawabanBenarKode,
      tim1Penjelasan: ronde.soalTim1.penjelasan,
      tim2Penjelasan: ronde.soalTim2.penjelasan,
      tim1BenarCount,
      tim1AnggotaCount: ronde.anggotaAwalTim1,
      tim2BenarCount,
      tim2AnggotaCount: ronde.anggotaAwalTim2,
      akurasiTim1: evalRonde.akurasiTim1,
      akurasiTim2: evalRonde.akurasiTim2,
      selisihKekuatan: evalRonde.selisihKekuatan,
      bonusStreakTim1,
      bonusStreakTim2,
      bonusKekompakanTim1: evalRonde.bonusKekompakanTim1,
      bonusKekompakanTim2: evalRonde.bonusKekompakanTim2,
      powerUpTim1Dipakai: ronde.powerUpTim1Dipakai,
      powerUpTim2Dipakai: ronde.powerUpTim2Dipakai,
      bonusPowerUpNet: evalRonde.bonusPowerUpNet,
      posisiSebelum,
      perubahanTali: evalRonde.perubahanTali,
      posisiSesudah: evalRonde.posisiBaru,
    };

    ronde.hasilRonde = hasilRonde;
    ronde.sedangDiproses = false;
    sesi.riwayatRonde.push(hasilRonde);
    sesi.riwayatTali.push({
      ronde: ronde.nomorRonde,
      posisi: evalRonde.posisiBaru,
      perubahan: evalRonde.perubahanTali,
    });

    const isGameFinished = cekKondisiSelesai(evalRonde.posisiBaru, sesi.config.batasMenang);
    if (isGameFinished) {
      this.akhiriPermainan(sessionId);
    }

    return {
      hasilRonde,
      isGameFinished,
    };
  },

  dapatkanSoalAktifUntukTim(
    sesi: SesiMultiplayerActive,
    tim: TimTarikTambang
  ): ReturnType<typeof serialisasiSoalUntukClient> | null {
    const r = sesi.rondeAktif;
    if (!r || sesi.status !== 'jalan') return null;
    const pres = tim === 'merah' ? r.soalTim1 : r.soalTim2;
    return serialisasiSoalUntukClient(pres, r.nomorRonde, r.berakhirPadaMs, sesi.config.durasiRonde);
  },

  akhiriPermainan(sessionId: string): SesiMultiplayerActive {
    const sesi = this.dapatkanSesi(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');

    if (sesi.timerHandle) {
      clearTimeout(sesi.timerHandle);
      sesi.timerHandle = undefined;
    }
    if (sesi.intermissionHandle) {
      clearTimeout(sesi.intermissionHandle);
      sesi.intermissionHandle = undefined;
    }

    sesi.status = 'selesai';
    sesi.waktuSelesaiMs = Date.now();
    sesi.hasil = susunLaporanAkhirMulti(sesi);
    return sesi;
  },

  async simpanHasilKeDatabase(sesi: SesiMultiplayerActive): Promise<void> {
    if (!sesi.hasil) return;
    const laporan = sesi.hasil;

    await prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: sesi.sessionId },
        data: {
          status: 'selesai',
          selesaiPada: new Date(),
          konfigurasi: JSON.stringify({
            playMode: 'MULTIPLAYER',
            config: sesi.config,
            laporanTarikMulti: laporan,
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
            id: p.id,
            sessionId: sesi.sessionId,
            nama: p.nama,
            tim: p.tim === 'merah' ? 'tim1' : 'tim2',
            posisi: laporan.posisiAkhir,
            poinBonus: p.totalBonusStreak,
            totalBenar: p.totalBenar,
            totalSalah: p.totalSalah,
            streakTertinggi: p.streakTertinggi,
            totalWaktuJawabMs: p.rataRataWaktuJawabMs * p.jumlahJawab,
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

  async muatLaporanDariDatabase(sessionId: string): Promise<LaporanTarikTambangMulti | null> {
    const db = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!db || db.mode !== 'multi' || !db.konfigurasi) return null;
    try {
      const parsed = JSON.parse(db.konfigurasi);
      if (parsed?.laporanTarikMulti) return parsed.laporanTarikMulti as LaporanTarikTambangMulti;
    } catch {
      return null;
    }
    return null;
  },

  hapusSesi(sessionId: string): void {
    const sesi = sesiMultiMap.get(sessionId);
    if (sesi) {
      if (sesi.timerHandle) clearTimeout(sesi.timerHandle);
      if (sesi.intermissionHandle) clearTimeout(sesi.intermissionHandle);
      tokenToSessionIdMap.delete(sesi.token);
      sesiMultiMap.delete(sessionId);
    }
  },
};
