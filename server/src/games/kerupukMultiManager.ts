import crypto from 'crypto';
import { prisma } from '../db.js';
import type { KunciPilihan } from '../utils/questionOptions.js';
import { mapDbQuestionForGame, extractActiveOptions } from '../utils/questionOptions.js';
import {
  ActivePresentationKerupuk,
  HasilGachaGigitan,
  KonfigurasiKerupukMulti,
  RiwayatGigitanItem,
  SoalKerupuk,
  SoalTampilKerupuk,
  SoloKerupukState,
  TipeGigitan,
  bangunKonfigurasiKerupukMulti,
  buatStateKerupukAwal,
  hitungHasilJawabanKerupukSolo,
  normalisasiKodeJawaban,
  serialisasiSoalTampilKerupuk,
  siapkanAntreanSoalKerupuk,
  siapkanPresentasiSoalDariAntrean,
  urutkanLeaderboardKerupuk,
  validasiProbabilitas,
} from './makanKerupuk.js';
import { multiManager } from './multiManager.js';
import { panjatPinangManager } from './panjatPinangManager.js';
import { balapKarungManager } from './balapKarungManager.js';

export interface PesertaKerupukMultiInternal {
  id: string;
  secretToken: string;
  socketId: string;
  nama: string;
  connected: boolean;
  state: SoloKerupukState;
  antreanSoalIds: string[];
  terakhirSoalId?: string;
  nomorSoalPemain: number;
  activePresentation: ActivePresentationKerupuk | null;
}

export interface PesertaKerupukMultiView {
  peringkat?: number;
  id: string;
  nama: string;
  connected: boolean;
  sisaKerupuk: number;
  targetKerupuk: number;
  sisaPersen: number;
  progresPersen: number;
  skorTotal: number;
  skorPembelajaran: number;
  skorDasarBenar: number;
  totalBonusStreak: number;
  bonusKeberuntungan: number;
  bonusPenyelesaian: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakBenar: number;
  streakTertinggi: number;
  selesaiKerupuk: boolean;
  waktuSelesaiMs: number | null;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  terakhirGigitan: HasilGachaGigitan | null;
  statistikGigitan: Record<TipeGigitan, number>;
}

export interface HasilAkhirKerupukMulti {
  sessionId: string;
  playMode: 'MULTIPLAYER';
  templateId: string;
  templateJudul: string;
  dihentikanManual: boolean;
  konfigurasi: KonfigurasiKerupukMulti;
  leaderboard: PesertaKerupukMultiView[];
  podium: {
    juara1?: PesertaKerupukMultiView;
    juara2?: PesertaKerupukMultiView;
    juara3?: PesertaKerupukMultiView;
  };
  totalPeserta: number;
  totalSoalBank: number;
  totalJawabanBenar: number;
  totalJawabanSalah: number;
  totalKerupukHabis: number;
  questions?: Array<{
    id: string;
    urutan: number;
    teks: string;
    opsiList: Array<{ key: string; teks: string }>;
    jawabanBenarKode: string;
    jawabanBenarTeks: string;
    penjelasan: string | null;
  }>;
  daftarPesertaLog?: Array<{
    id: string;
    nama: string;
    riwayatGigitan: RiwayatGigitanItem[];
  }>;
}

export interface SesiKerupukMultiActive {
  sessionId: string;
  playMode: 'MULTIPLAYER';
  token: string;
  templateId: string;
  templateJudul: string;
  hostId: string;
  hostSocketId?: string;
  status: 'lobi' | 'jalan' | 'selesai';
  mulaiPadaMs?: number | null;
  config: KonfigurasiKerupukMulti;
  questions: SoalKerupuk[];
  peserta: Map<string, PesertaKerupukMultiInternal>;
  questionStatsMap: Map<string, { jumlahBenar: number; jumlahSalah: number }>;
  totalGigitanKelas: number;
  hasil?: HasilAkhirKerupukMulti;
}

const sesiMultiMap = new Map<string, SesiKerupukMultiActive>();
const tokenToMultiSessionIdMap = new Map<string, string>();

export function sanitizePesertaKerupukMulti(p: PesertaKerupukMultiInternal): PesertaKerupukMultiView {
  const st = p.state;
  const totalJawab = st.totalBenar + st.totalSalah;
  return {
    id: p.id,
    nama: p.nama,
    connected: p.connected,
    sisaKerupuk: st.sisaKerupuk,
    targetKerupuk: st.targetKerupuk,
    sisaPersen: st.sisaPersen,
    progresPersen: st.progresPersen,
    skorTotal: st.skorTotal,
    skorPembelajaran: st.skorPembelajaran,
    skorDasarBenar: st.skorDasarBenar,
    totalBonusStreak: st.totalBonusStreak,
    bonusKeberuntungan: st.bonusKeberuntungan,
    bonusPenyelesaian: st.bonusPenyelesaian,
    totalBenar: st.totalBenar,
    totalSalah: st.totalSalah,
    akurasiPersen: totalJawab > 0 ? Math.round((st.totalBenar / totalJawab) * 100) : 0,
    streakBenar: st.streakBenar,
    streakTertinggi: st.streakTertinggi,
    selesaiKerupuk: st.selesaiKerupuk,
    waktuSelesaiMs: st.waktuSelesaiMs,
    rataRataWaktuJawabMs: st.rataRataWaktuJawabMs,
    jumlahJawab: st.jumlahJawab,
    terakhirGigitan: st.terakhirGigitan,
    statistikGigitan: { ...st.statistikGigitan },
  };
}

function siapkanSoalUntukPeserta(
  sesi: SesiKerupukMultiActive,
  peserta: PesertaKerupukMultiInternal,
  sekarangMs: number = Date.now()
): SoalTampilKerupuk | null {
  if (sesi.status !== 'jalan') return null;
  if (peserta.state.selesaiKerupuk || peserta.state.sisaKerupuk <= 0) return null;

  peserta.nomorSoalPemain += 1;
  const { presentation, antreanBaru, terakhirSoalIdBaru } = siapkanPresentasiSoalDariAntrean(
    sesi.questions,
    peserta.antreanSoalIds,
    peserta.terakhirSoalId,
    peserta.nomorSoalPemain,
    sekarangMs
  );
  peserta.antreanSoalIds = antreanBaru;
  peserta.terakhirSoalId = terakhirSoalIdBaru;
  peserta.activePresentation = presentation;

  return serialisasiSoalTampilKerupuk(presentation, sesi.questions.length);
}

export const kerupukMultiManager = {
  generateUniqueToken(): string {
    for (let i = 0; i < 200; i++) {
      const token = crypto.randomInt(100000, 1000000).toString();
      const collision =
        tokenToMultiSessionIdMap.has(token) ||
        Boolean(multiManager.dapatkanSesiDariToken(token)) ||
        Boolean(panjatPinangManager.dapatkanSesiDariToken(token)) ||
        Boolean(balapKarungManager.dapatkanSesiDariToken(token));
      if (!collision) return token;
    }
    throw new Error('Gagal menghasilkan token PIN unik untuk Makan Kerupuk Multiplayer.');
  },

  inisialisasiSesi(
    sessionId: string,
    token: string,
    hostId: string,
    template: { id: string; judul: string },
    questions: SoalKerupuk[],
    userConfig?: Partial<KonfigurasiKerupukMulti>
  ): SesiKerupukMultiActive {
    if (!questions || questions.length === 0) {
      throw new Error('Template tidak memiliki soal. Tambahkan minimal 1 soal terlebih dahulu.');
    }

    if (userConfig?.probabilitas) {
      const cek = validasiProbabilitas(userConfig.probabilitas);
      if (!cek.valid) {
        throw new Error(cek.pesanError || 'Konfigurasi probabilitas tidak valid.');
      }
    }

    if (tokenToMultiSessionIdMap.has(token)) {
      const oldId = tokenToMultiSessionIdMap.get(token)!;
      this.hapusSesi(oldId);
    }

    const configSnapshot = bangunKonfigurasiKerupukMulti(userConfig);

    const sesi: SesiKerupukMultiActive = {
      sessionId,
      playMode: 'MULTIPLAYER',
      token,
      templateId: template.id,
      templateJudul: template.judul,
      hostId,
      status: 'lobi',
      mulaiPadaMs: null,
      config: configSnapshot,
      questions: [...questions],
      peserta: new Map(),
      questionStatsMap: new Map(),
      totalGigitanKelas: 0,
    };

    sesiMultiMap.set(sessionId, sesi);
    tokenToMultiSessionIdMap.set(token, sessionId);
    return sesi;
  },

  dapatkanSesi(sessionId: string): SesiKerupukMultiActive | undefined {
    return sesiMultiMap.get(sessionId);
  },

  dapatkanSesiDariToken(token: string): SesiKerupukMultiActive | undefined {
    const sid = tokenToMultiSessionIdMap.get(token);
    if (!sid) return undefined;
    return sesiMultiMap.get(sid);
  },

  gabungPeserta(
    token: string,
    nama: string,
    socketId: string,
    existingPesertaId?: string,
    existingSecret?: string
  ): {
    sesi: SesiKerupukMultiActive;
    peserta: PesertaKerupukMultiInternal;
    isReconnect: boolean;
  } {
    const sesi = this.dapatkanSesiDariToken(token);
    if (!sesi) {
      throw new Error('Sesi Makan Kerupuk Multiplayer tidak ditemukan atau token tidak valid.');
    }
    if (sesi.status === 'selesai') {
      throw new Error('Sesi Makan Kerupuk ini sudah selesai.');
    }

    const cleanNama = nama.trim().slice(0, 25);
    if (!cleanNama) {
      throw new Error('Nama panggilan wajib diisi.');
    }

    // 1. Reconnect menggunakan pesertaId (+ verifikasi secret jika ada)
    if (existingPesertaId && sesi.peserta.has(existingPesertaId)) {
      const p = sesi.peserta.get(existingPesertaId)!;
      if (!existingSecret || p.secretToken === existingSecret) {
        p.socketId = socketId;
        p.connected = true;
        return { sesi, peserta: p, isReconnect: true };
      }
    }

    // 2. Reconnect nama sama yang terputus
    for (const p of sesi.peserta.values()) {
      if (!p.connected && p.nama.toLowerCase() === cleanNama.toLowerCase()) {
        p.socketId = socketId;
        p.connected = true;
        return { sesi, peserta: p, isReconnect: true };
      }
    }

    // 3. Cek izin gabung susulan
    if (sesi.status === 'jalan' && !sesi.config.allowLateJoin) {
      throw new Error('Permainan sudah dimulai dan guru tidak mengizinkan peserta susulan.');
    }

    // 4. Cek batas kapasitas
    if (sesi.peserta.size >= sesi.config.maxPeserta) {
      throw new Error(
        `Kapasitas sesi penuh (maksimum ${sesi.config.maxPeserta} peserta).`
      );
    }

    // 5. Pastikan nama panggilan unik
    let finalNama = cleanNama;
    let dup = 1;
    while (
      Array.from(sesi.peserta.values()).some(
        (p) => p.connected && p.nama.toLowerCase() === finalNama.toLowerCase()
      )
    ) {
      dup += 1;
      finalNama = `${cleanNama} (${dup})`;
    }

    const pesertaId = crypto.randomUUID();
    const pesertaBaru: PesertaKerupukMultiInternal = {
      id: pesertaId,
      secretToken: crypto.randomUUID(),
      socketId,
      nama: finalNama,
      connected: true,
      state: buatStateKerupukAwal(sesi.config.targetKerupuk, sesi.status === 'jalan' ? Date.now() : null),
      antreanSoalIds: siapkanAntreanSoalKerupuk(sesi.questions),
      nomorSoalPemain: 0,
      activePresentation: null,
    };

    sesi.peserta.set(pesertaId, pesertaBaru);
    return { sesi, peserta: pesertaBaru, isReconnect: false };
  },

  putusKoneksiPeserta(socketId: string): { sessionId?: string; pesertaId?: string } {
    for (const sesi of sesiMultiMap.values()) {
      for (const [id, p] of sesi.peserta.entries()) {
        if (p.socketId === socketId) {
          p.connected = false;
          return { sessionId: sesi.sessionId, pesertaId: id };
        }
      }
    }
    return {};
  },

  /**
   * Mengacak urutan peserta di lobi Makan Kerupuk.
   */
  acakUrutanPeserta(sessionId: string, hostId: string): PesertaKerupukMultiView[] {
    const sesi = sesiMultiMap.get(sessionId);
    if (!sesi || sesi.hostId !== hostId) {
      throw new Error('Sesi Makan Kerupuk tidak ditemukan atau Anda bukan pemilik sesi.');
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
   * Mengeluarkan (kick) siswa dari lobi permainan Makan Kerupuk.
   */
  async keluarkanPeserta(
    sessionId: string,
    hostId: string,
    pesertaId: string
  ): Promise<PesertaKerupukMultiInternal> {
    const sesi = sesiMultiMap.get(sessionId);
    if (!sesi || sesi.hostId !== hostId) {
      throw new Error('Sesi Makan Kerupuk tidak ditemukan atau Anda bukan pemilik sesi.');
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

  mulaiPermainan(sessionId: string, hostId: string): SesiKerupukMultiActive {
    const sesi = sesiMultiMap.get(sessionId);
    if (!sesi || sesi.hostId !== hostId) {
      throw new Error('Sesi Makan Kerupuk tidak ditemukan atau Anda bukan pemilik sesi.');
    }
    if (sesi.status !== 'lobi') {
      throw new Error('Permainan pada sesi ini sudah dimulai.');
    }
    if (sesi.peserta.size === 0) {
      throw new Error('Belum ada siswa yang bergabung di lobi.');
    }

    const now = Date.now();
    sesi.status = 'jalan';
    sesi.mulaiPadaMs = now;
    for (const p of sesi.peserta.values()) {
      p.antreanSoalIds = siapkanAntreanSoalKerupuk(sesi.questions);
      p.nomorSoalPemain = 0;
      p.terakhirSoalId = undefined;
      p.activePresentation = null;
      p.state = buatStateKerupukAwal(sesi.config.targetKerupuk, now);
    }

    return sesi;
  },

  dapatkanSoalAktifPeserta(sessionId: string, pesertaId: string): SoalTampilKerupuk | null {
    const sesi = sesiMultiMap.get(sessionId);
    if (!sesi || sesi.status !== 'jalan') return null;

    const peserta = sesi.peserta.get(pesertaId);
    if (!peserta || peserta.state.selesaiKerupuk || peserta.state.sisaKerupuk <= 0) {
      return null;
    }

    if (peserta.activePresentation) {
      return serialisasiSoalTampilKerupuk(peserta.activePresentation, sesi.questions.length);
    }

    return siapkanSoalUntukPeserta(sesi, peserta);
  },

  ambilSoalBerikutnyaUntukPeserta(sessionId: string, pesertaId: string): SoalTampilKerupuk | null {
    const sesi = sesiMultiMap.get(sessionId);
    if (!sesi || sesi.status !== 'jalan') return null;

    const peserta = sesi.peserta.get(pesertaId);
    if (!peserta || peserta.state.selesaiKerupuk || peserta.state.sisaKerupuk <= 0) {
      return null;
    }

    if (peserta.activePresentation) {
      return serialisasiSoalTampilKerupuk(peserta.activePresentation, sesi.questions.length);
    }

    return siapkanSoalUntukPeserta(sesi, peserta);
  },

  prosesJawabanSiswa(
    sessionId: string,
    pesertaId: string,
    input: {
      presentationId?: string;
      choiceId?: string;
      questionId?: string;
      jawaban?: string;
    },
    pesertaSecret?: string,
    options?: { randomNormalized?: number; nowMs?: number }
  ): {
    pesertaView: PesertaKerupukMultiView;
    leaderboard: PesertaKerupukMultiView[];
    benar: boolean;
    jawabanBenarKode: KunciPilihan;
    jawabanBenarTeks: string;
    penjelasan: string | null;
    poinDidapat: number;
    poinDasar: number;
    bonusStreak: number;
    bonusPenyelesaian: number;
    gacha: HasilGachaGigitan | null;
    sisaKerupukBaru: number;
    progresPersenBaru: number;
    pemainSelesai: boolean;
    gameSelesaiSemuaHabis: boolean;
    soalBerikutnya: SoalTampilKerupuk | null;
    gigitanLogItem: RiwayatGigitanItem;
  } {
    const sesi = sesiMultiMap.get(sessionId);
    if (!sesi) throw new Error('Sesi Makan Kerupuk tidak ditemukan.');
    if (sesi.status !== 'jalan') {
      throw new Error('Permainan tidak sedang berjalan atau sudah selesai.');
    }

    const peserta = sesi.peserta.get(pesertaId);
    if (!peserta) throw new Error('Peserta tidak terdaftar dalam sesi ini.');

    if (pesertaSecret && peserta.secretToken !== pesertaSecret) {
      throw new Error('Identitas peserta tidak valid (secret tidak cocok).');
    }

    if (peserta.state.selesaiKerupuk || peserta.state.sisaKerupuk <= 0) {
      throw new Error('Kerupuk Anda sudah habis (0%). Anda telah menyelesaikan perlombaan!');
    }

    const activePres = peserta.activePresentation;
    if (!activePres) {
      throw new Error('Tidak ada soal aktif untuk Anda saat ini.');
    }

    if (input.presentationId && input.presentationId !== activePres.presentationId) {
      throw new Error('ID presentasi soal tidak cocok atau jawaban sudah dikirim sebelumnya.');
    }

    if (input.questionId && input.questionId !== 'undefined' && input.questionId !== 'null' && input.questionId !== activePres.questionId) {
      throw new Error('ID soal tidak cocok dengan soal aktif Anda.');
    }

    let benar = false;
    if (input.choiceId) {
      if (!activePres.pilihanMap.has(input.choiceId)) {
        throw new Error('ID pilihan jawaban tidak valid.');
      }
      benar = input.choiceId === activePres.correctChoiceId;
    } else if (input.jawaban) {
      const cleaned = normalisasiKodeJawaban(input.jawaban);
      benar = cleaned === activePres.jawabanBenarKode;
    } else {
      throw new Error('Pilihan jawaban wajib dikirimkan.');
    }

    const pilihanBenarObj = activePres.pilihanList.find(
      (p) => p.choiceId === activePres.correctChoiceId
    );

    // Kosongkan activePresentation segera untuk mencegah double submission
    peserta.activePresentation = null;

    const sekarangMs = options?.nowMs ?? Date.now();
    const waktuJawabMs = Math.max(50, sekarangMs - activePres.tampilPadaMs);

    const prevStat = sesi.questionStatsMap.get(activePres.questionId) || {
      jumlahBenar: 0,
      jumlahSalah: 0,
    };
    if (benar) {
      prevStat.jumlahBenar += 1;
      sesi.totalGigitanKelas += 1;
    } else {
      prevStat.jumlahSalah += 1;
    }
    sesi.questionStatsMap.set(activePres.questionId, prevStat);

    const hasilKalkulasi = hitungHasilJawabanKerupukSolo(
      peserta.state,
      sesi.config,
      { questionId: activePres.questionId, nomorSoal: activePres.nomorSoal },
      benar,
      waktuJawabMs,
      sekarangMs,
      options?.randomNormalized
    );

    peserta.state = hasilKalkulasi.stateUpdated;

    const pemainSelesai = peserta.state.selesaiKerupuk || peserta.state.sisaKerupuk <= 0;

    // Cek apakah semua peserta terhubung telah menghabiskan kerupuk
    const pesertaAktif = Array.from(sesi.peserta.values()).filter((p) => p.connected);
    const semuaPeserta = Array.from(sesi.peserta.values());
    const targetCek = pesertaAktif.length > 0 ? pesertaAktif : semuaPeserta;
    const gameSelesaiSemuaHabis =
      targetCek.length > 0 &&
      targetCek.every((p) => p.state.selesaiKerupuk || p.state.sisaKerupuk <= 0);

    // Siapkan soal berikutnya hanya jika pemain ini belum habis kerupuknya & game masih jalan
    let soalBerikutnya: SoalTampilKerupuk | null = null;
    if (!pemainSelesai && !gameSelesaiSemuaHabis) {
      soalBerikutnya = siapkanSoalUntukPeserta(sesi, peserta, sekarangMs);
    }

    const leaderboard = this.dapatkanLeaderboard(sessionId);

    return {
      pesertaView: sanitizePesertaKerupukMulti(peserta),
      leaderboard,
      benar,
      jawabanBenarKode: activePres.jawabanBenarKode,
      jawabanBenarTeks: pilihanBenarObj?.teks || '',
      penjelasan: activePres.penjelasan,
      poinDidapat: hasilKalkulasi.poinDidapat,
      poinDasar: hasilKalkulasi.poinDasar,
      bonusStreak: hasilKalkulasi.bonusStreak,
      bonusPenyelesaian: hasilKalkulasi.bonusPenyelesaian,
      gacha: hasilKalkulasi.gacha,
      sisaKerupukBaru: hasilKalkulasi.sisaKerupukBaru,
      progresPersenBaru: hasilKalkulasi.progresPersenBaru,
      pemainSelesai,
      gameSelesaiSemuaHabis,
      soalBerikutnya,
      gigitanLogItem: hasilKalkulasi.gigitanLogItem,
    };
  },

  dapatkanLeaderboard(sessionId: string): PesertaKerupukMultiView[] {
    const sesi = sesiMultiMap.get(sessionId);
    if (!sesi) return [];

    const views = Array.from(sesi.peserta.values()).map((p) => sanitizePesertaKerupukMulti(p));
    const sorted = urutkanLeaderboardKerupuk(views);
    return sorted.map((v, idx) => ({ ...v, peringkat: idx + 1 }));
  },

  akhiriPermainan(sessionId: string, dihentikanManual: boolean = false): HasilAkhirKerupukMulti {
    const sesi = sesiMultiMap.get(sessionId);
    if (!sesi) throw new Error('Sesi Makan Kerupuk tidak ditemukan.');

    sesi.status = 'selesai';
    for (const p of sesi.peserta.values()) {
      p.activePresentation = null;
    }

    const leaderboard = this.dapatkanLeaderboard(sessionId);
    let totalJawabanBenar = 0;
    let totalJawabanSalah = 0;
    let totalKerupukHabis = 0;

    for (const p of leaderboard) {
      totalJawabanBenar += p.totalBenar;
      totalJawabanSalah += p.totalSalah;
      if (p.selesaiKerupuk || p.sisaKerupuk === 0) {
        totalKerupukHabis += 1;
      }
    }

    const questions = sesi.questions.map((q, idx) => {
      const activeOpsi = extractActiveOptions(q);
      const kunciKode = normalisasiKodeJawaban(q.jawabanBenar);
      const kunciOpsi = activeOpsi.find((o) => o.key === kunciKode) || activeOpsi[0];
      return {
        id: q.id,
        urutan: q.urutan || idx + 1,
        teks: q.teks,
        opsiList: activeOpsi.map((o) => ({ key: o.key, teks: o.teks })),
        jawabanBenarKode: kunciKode,
        jawabanBenarTeks: kunciOpsi?.teks || '',
        penjelasan: q.penjelasan || null,
      };
    });

    const daftarPesertaLog = Array.from(sesi.peserta.values()).map((p) => ({
      id: p.id,
      nama: p.nama,
      riwayatGigitan: [...p.state.riwayatGigitan],
    }));

    const hasil: HasilAkhirKerupukMulti = {
      sessionId: sesi.sessionId,
      playMode: 'MULTIPLAYER',
      templateId: sesi.templateId,
      templateJudul: sesi.templateJudul,
      dihentikanManual,
      konfigurasi: sesi.config,
      leaderboard,
      podium: {
        juara1: leaderboard[0],
        juara2: leaderboard[1],
        juara3: leaderboard[2],
      },
      totalPeserta: leaderboard.length,
      totalSoalBank: sesi.questions.length,
      totalJawabanBenar,
      totalJawabanSalah,
      totalKerupukHabis,
      questions,
      daftarPesertaLog,
    };

    sesi.hasil = hasil;
    return hasil;
  },

  async simpanHasilKeDatabase(sessionId: string): Promise<void> {
    const sesi = sesiMultiMap.get(sessionId);
    if (!sesi || !sesi.hasil) return;

    const hasil = sesi.hasil;
    const juara1 = hasil.podium.juara1;

    await prisma.$transaction(
      async (tx) => {
        await tx.session.update({
          where: { id: sesi.sessionId },
          data: {
            status: 'selesai',
            mode: 'multi',
            selesaiPada: new Date(),
            konfigurasi: JSON.stringify({
              playMode: 'MULTIPLAYER',
              config: sesi.config,
              laporanKerupukMulti: hasil,
            }),
          },
        });

        await tx.sessionResult.upsert({
          where: { sessionId: sesi.sessionId },
          update: {
            timMenang: juara1?.nama || 'Selesai',
            posisiAkhir: juara1?.progresPersen ?? 0,
            skorMerah: juara1?.skorTotal ?? 0,
            skorPutih: hasil.totalKerupukHabis,
          },
          create: {
            sessionId: sesi.sessionId,
            timMenang: juara1?.nama || 'Selesai',
            posisiAkhir: juara1?.progresPersen ?? 0,
            skorMerah: juara1?.skorTotal ?? 0,
            skorPutih: hasil.totalKerupukHabis,
          },
        });

        await tx.sessionPlayer.deleteMany({
          where: { sessionId: sesi.sessionId },
        });

        const playersData = Array.from(sesi.peserta.values()).map((p) => {
          const st = p.state;
          return {
            id: p.id,
            sessionId: sesi.sessionId,
            nama: p.nama,
            posisi: st.progresPersen,
            keseimbangan: st.sisaPersen,
            jumlahJatuh: 0,
            efekAktif: JSON.stringify({
              skorTotal: st.skorTotal,
              skorPembelajaran: st.skorPembelajaran,
              skorDasarBenar: st.skorDasarBenar,
              totalBonusStreak: st.totalBonusStreak,
              bonusKeberuntungan: st.bonusKeberuntungan,
              bonusPenyelesaian: st.bonusPenyelesaian,
              sisaKerupuk: st.sisaKerupuk,
              targetKerupuk: st.targetKerupuk,
              statistikGigitan: st.statistikGigitan,
            }),
            poinBonus: st.bonusKeberuntungan + st.bonusPenyelesaian,
            totalBenar: st.totalBenar,
            totalSalah: st.totalSalah,
            streakSaatIni: st.streakBenar,
            streakTertinggi: st.streakTertinggi,
            totalWaktuJawabMs: st.totalWaktuJawabMs,
            jumlahJawab: st.jumlahJawab,
            status: st.selesaiKerupuk ? 'selesai' : 'bermain',
            waktuSelesaiMs: st.waktuSelesaiMs
              ? (sesi.mulaiPadaMs
                  ? Math.max(1, Math.min(2147483647, st.waktuSelesaiMs - sesi.mulaiPadaMs))
                  : Math.min(st.waktuSelesaiMs, 2147483647))
              : null,
            selesaiPada: st.waktuSelesaiMs ? new Date(st.waktuSelesaiMs) : null,
            riwayatJawaban: JSON.stringify(st.riwayatGigitan),
          };
        });

        if (playersData.length > 0) {
          await tx.sessionPlayer.createMany({
            data: playersData,
          });
        }

        await tx.questionStat.deleteMany({
          where: { sessionId: sesi.sessionId },
        });

        const statsData = Array.from(sesi.questionStatsMap.entries()).map(([questionId, stat]) => ({
          sessionId: sesi.sessionId,
          questionId,
          jumlahBenar: stat.jumlahBenar,
          jumlahSalah: stat.jumlahSalah,
        }));

        if (statsData.length > 0) {
          await tx.questionStat.createMany({
            data: statsData,
          });
        }
      },
      {
        timeout: 30000,
        maxWait: 10000,
      }
    );
  },

  async muatLaporanDariDatabase(sessionId: string): Promise<HasilAkhirKerupukMulti | null> {
    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: { include: { questions: true } },
        players: true,
        result: true,
      },
    });

    if (!sessionDb || sessionDb.template.game !== 'makan_kerupuk' || sessionDb.mode !== 'multi') {
      return null;
    }

    if (sessionDb.konfigurasi) {
      try {
        const parsed = JSON.parse(sessionDb.konfigurasi);
        if (parsed?.laporanKerupukMulti) {
          return parsed.laporanKerupukMulti as HasilAkhirKerupukMulti;
        }
      } catch {
        // lanjut fallback dari SessionPlayer rows
      }
    }

    if (sessionDb.status !== 'selesai' && !sessionDb.result) return null;

    let conf: KonfigurasiKerupukMulti = bangunKonfigurasiKerupukMulti();
    if (sessionDb.konfigurasi) {
      try {
        const parsed = JSON.parse(sessionDb.konfigurasi);
        conf = bangunKonfigurasiKerupukMulti(parsed?.config || parsed);
      } catch {
        // default
      }
    }

    const playerViews: PesertaKerupukMultiView[] = sessionDb.players.map((pl) => {
      let extra: any = {};
      try {
        extra = JSON.parse(pl.efekAktif || '{}');
      } catch {
        extra = {};
      }
      const totalJawab = pl.totalBenar + pl.totalSalah;
      return {
        id: pl.id,
        nama: pl.nama,
        connected: false,
        sisaKerupuk: typeof extra.sisaKerupuk === 'number' ? extra.sisaKerupuk : conf.targetKerupuk,
        targetKerupuk: extra.targetKerupuk ?? conf.targetKerupuk,
        sisaPersen: pl.keseimbangan,
        progresPersen: pl.posisi,
        skorTotal: extra.skorTotal ?? 0,
        skorPembelajaran: extra.skorPembelajaran ?? 0,
        skorDasarBenar: extra.skorDasarBenar ?? 0,
        totalBonusStreak: extra.totalBonusStreak ?? 0,
        bonusKeberuntungan: extra.bonusKeberuntungan ?? 0,
        bonusPenyelesaian: extra.bonusPenyelesaian ?? 0,
        totalBenar: pl.totalBenar,
        totalSalah: pl.totalSalah,
        akurasiPersen: totalJawab > 0 ? Math.round((pl.totalBenar / totalJawab) * 100) : 0,
        streakBenar: pl.streakSaatIni,
        streakTertinggi: pl.streakTertinggi,
        selesaiKerupuk: pl.status === 'selesai',
        waktuSelesaiMs: pl.waktuSelesaiMs ?? null,
        rataRataWaktuJawabMs:
          pl.jumlahJawab > 0 ? Math.round(pl.totalWaktuJawabMs / pl.jumlahJawab) : 0,
        jumlahJawab: pl.jumlahJawab,
        terakhirGigitan: null,
        statistikGigitan: extra.statistikGigitan || {
          besar: 0,
          sedang: 0,
          kecil: 0,
          sangat_kecil: 0,
          zonk: 0,
        },
      };
    });

    const leaderboard = urutkanLeaderboardKerupuk(playerViews).map((v, i) => ({
      ...v,
      peringkat: i + 1,
    }));

    return {
      sessionId: sessionDb.id,
      playMode: 'MULTIPLAYER',
      templateId: sessionDb.templateId,
      templateJudul: sessionDb.template.judul,
      dihentikanManual: false,
      konfigurasi: conf,
      leaderboard,
      podium: {
        juara1: leaderboard[0],
        juara2: leaderboard[1],
        juara3: leaderboard[2],
      },
      totalPeserta: leaderboard.length,
      totalSoalBank: sessionDb.template.questions.length,
      totalJawabanBenar: leaderboard.reduce((a, b) => a + b.totalBenar, 0),
      totalJawabanSalah: leaderboard.reduce((a, b) => a + b.totalSalah, 0),
      totalKerupukHabis: leaderboard.filter((p) => p.selesaiKerupuk || p.sisaKerupuk === 0).length,
    };
  },

  async pulihkanSesiDariDb(sessionId: string): Promise<SesiKerupukMultiActive | null> {
    const existing = sesiMultiMap.get(sessionId);
    if (existing) return existing;

    const sessionDb = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: { include: { questions: { orderBy: { urutan: 'asc' } } } },
      },
    });

    if (!sessionDb || sessionDb.template.game !== 'makan_kerupuk' || sessionDb.mode !== 'multi') {
      return null;
    }

    let rawConfig: any;
    let hasilDb: HasilAkhirKerupukMulti | undefined;
    if (sessionDb.konfigurasi) {
      try {
        const parsed = JSON.parse(sessionDb.konfigurasi);
        rawConfig = parsed?.config || parsed;
        if (parsed?.laporanKerupukMulti) {
          hasilDb = parsed.laporanKerupukMulti as HasilAkhirKerupukMulti;
        }
      } catch {
        rawConfig = undefined;
      }
    }

    const config = bangunKonfigurasiKerupukMulti(rawConfig);
    const questions: SoalKerupuk[] = sessionDb.template.questions.map(mapDbQuestionForGame);

    const token = sessionDb.token || this.generateUniqueToken();
    const sesi = this.inisialisasiSesi(
      sessionDb.id,
      token,
      sessionDb.hostId,
      { id: sessionDb.template.id, judul: sessionDb.template.judul },
      questions,
      config
    );

    if (sessionDb.status === 'selesai') {
      sesi.status = 'selesai';
      sesi.hasil = hasilDb || (await this.muatLaporanDariDatabase(sessionId)) || undefined;
    }

    return sesi;
  },

  hapusSesi(sessionId: string): void {
    const sesi = sesiMultiMap.get(sessionId);
    if (sesi) {
      tokenToMultiSessionIdMap.delete(sesi.token);
      sesiMultiMap.delete(sessionId);
    }
  },
};

