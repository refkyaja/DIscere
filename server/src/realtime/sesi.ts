import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import {
  multiManager,
  PesertaMulti,
  SesiMultiplayerActive,
} from '../games/multiManager.js';
import { soloManager } from '../games/soloManager.js';
import { panjatPinangManager } from '../games/panjatPinangManager.js';
import { PesertaPanjatState } from '../games/panjatPinang.js';
import { balapKarungManager } from '../games/balapKarungManager.js';
import { PesertaBalapKarungState } from '../games/balapKarung.js';
import { kerupukMultiManager } from '../games/kerupukMultiManager.js';
import { kerupukManager } from '../games/kerupukManager.js';
import { prisma } from '../db.js';
import { getVerifiedUserIdFromSocket } from './socketAuth.js';

function pastikanHostSesi(
  socket: Socket,
  expectedHostId: string
): { ok: true; userId: string } | { ok: false; pesan: string } {
  const userId = getVerifiedUserIdFromSocket(socket);
  if (!userId) {
    return {
      ok: false,
      pesan: 'Akses ditolak: autentikasi guru diperlukan untuk mengendalikan sesi.',
    };
  }
  if (userId !== expectedHostId) {
    return {
      ok: false,
      pesan: 'Akses ditolak: Anda bukan guru pembuat sesi ini.',
    };
  }
  return { ok: true, userId };
}

const hostSessionPayloadSchema = z.object({
  sessionId: z.string().min(1, 'ID sesi wajib diisi.'),
  hostId: z.string().optional(),
});

const pindahTimPayloadSchema = z.object({
  sessionId: z.string().min(1, 'ID sesi wajib diisi.'),
  pesertaId: z.string().min(1, 'ID peserta wajib diisi.'),
  timTujuan: z.string().min(1, 'Tim tujuan wajib diisi.'),
  hostId: z.string().optional(),
});

const kickPesertaPayloadSchema = z.object({
  sessionId: z.string().min(1, 'ID sesi wajib diisi.'),
  pesertaId: z.string().min(1, 'ID peserta wajib diisi.'),
  hostId: z.string().optional(),
});

const ubahJumlahTimPayloadSchema = z.object({
  sessionId: z.string().min(1, 'ID sesi wajib diisi.'),
  jumlahTim: z.union([z.literal(3), z.literal(4)]),
  hostId: z.string().optional(),
});

const pendingNextSoalPanjatTimers = new Map<string, NodeJS.Timeout>();
const pendingNextSoalBalapTimers = new Map<string, NodeJS.Timeout>();
const pendingNextSoalKerupukTimers = new Map<string, NodeJS.Timeout>();
const pendingNextSoalTarikTimers = new Map<string, NodeJS.Timeout>();
const tarikQuestionTimeoutTimers = new Map<string, NodeJS.Timeout>();
const tarikMatchTimers = new Map<string, NodeJS.Timeout>();

function clearPendingTimersForPeserta(
  timerMap: Map<string, NodeJS.Timeout>,
  pesertaIds: Iterable<string>
): void {
  for (const pId of pesertaIds) {
    const t = timerMap.get(pId);
    if (t) {
      clearTimeout(t);
      timerMap.delete(pId);
    }
  }
}

/**
 * Membersihkan seluruh timer tertunda milik peserta pada suatu sesi sebelum sesi dihapus dari memori/DB.
 */
export function bersihkanTimerSesi(sessionId: string): void {
  const sesiBalap = balapKarungManager.dapatkanSesi(sessionId);
  if (sesiBalap) {
    clearPendingTimersForPeserta(pendingNextSoalBalapTimers, sesiBalap.peserta.keys());
  }
  const sesiPanjat = panjatPinangManager.dapatkanSesi(sessionId);
  if (sesiPanjat) {
    clearPendingTimersForPeserta(pendingNextSoalPanjatTimers, sesiPanjat.peserta.keys());
  }
  const sesiKerupuk = kerupukMultiManager.dapatkanSesi(sessionId);
  if (sesiKerupuk) {
    clearPendingTimersForPeserta(pendingNextSoalKerupukTimers, sesiKerupuk.peserta.keys());
  }
  const matchTimerTarik = tarikMatchTimers.get(sessionId);
  if (matchTimerTarik) {
    clearTimeout(matchTimerTarik);
    tarikMatchTimers.delete(sessionId);
  }
  const sesiTarik = multiManager.dapatkanSesi(sessionId);
  if (sesiTarik) {
    clearPendingTimersForPeserta(pendingNextSoalTarikTimers, sesiTarik.peserta.keys());
    clearPendingTimersForPeserta(tarikQuestionTimeoutTimers, sesiTarik.peserta.keys());
  }
}

const gabungSchema = z.object({
  token: z.string().min(4, 'Token sesi wajib diisi.'),
  nama: z.string().min(1, 'Nama panggilan wajib diisi.'),
  pesertaId: z.string().optional(),
  pesertaSecret: z.string().optional(),
});

const jawabPanjatSchema = z.object({
  sessionId: z.string().min(1),
  pesertaId: z.string().min(1),
  pesertaSecret: z.string().optional(),
  presentationId: z.string().optional(),
  questionId: z.string().optional(),
  id: z.string().optional(),
  choiceId: z.string().optional(),
  jawaban: z.string().optional(),
  timedOut: z.boolean().optional(),
});

function sanitizePesertaBalap(p: PesertaBalapKarungState, targetJarak: number) {
  const totalJawab = p.totalBenar + p.totalSalah;
  return {
    id: p.id,
    nama: p.nama,
    tim: p.tim || null,
    connected: p.connected,
    jarak: p.jarak,
    targetJarak,
    keseimbangan: p.keseimbangan,
    jumlahJatuh: p.jumlahJatuh,
    totalBenar: p.totalBenar,
    totalSalah: p.totalSalah,
    akurasiPersen: totalJawab > 0 ? Math.round((p.totalBenar / totalJawab) * 100) : 0,
    streakSaatIni: p.streakSaatIni,
    streakTertinggi: p.streakTertinggi,
    totalBonusStreakKali: p.totalBonusStreakKali,
    totalBonusStreakMeter: p.totalBonusStreakMeter,
    status: p.status,
    waktuSelesaiMs: p.waktuSelesaiMs,
    rataRataWaktuJawabMs: p.rataRataWaktuJawabMs,
    jumlahJawab: p.jumlahJawab,
    efekAktif: { ...p.efekAktif },
    riwayatRintangan: p.riwayatRintangan.slice(-15),
  };
}

function sanitizePesertaPanjat(p: PesertaPanjatState) {
  const totalJawab = p.totalBenar + p.totalSalah;
  return {
    id: p.id,
    nama: p.nama,
    connected: p.connected,
    posisi: p.posisi,
    poinBonus: p.poinBonus,
    totalBenar: p.totalBenar,
    totalSalah: p.totalSalah,
    akurasiPersen: totalJawab > 0 ? Math.round((p.totalBenar / totalJawab) * 100) : 0,
    streakSaatIni: p.streakSaatIni,
    streakTertinggi: p.streakTertinggi,
    status: p.status,
    waktuSelesaiMs: p.waktuSelesaiMs,
    rataRataWaktuJawabMs: p.rataRataWaktuJawabMs,
    jumlahJawab: p.jumlahJawab,
    efekAktif: { ...p.efekAktif },
    riwayatRintangan: p.riwayatRintangan.slice(-15),
  };
}

function formatDaftarPesertaTarik(sesi: SesiMultiplayerActive) {
  return multiManager.dapatkanDaftarPeserta(sesi.sessionId);
}

async function sinkronkanRoomTimTarikTambang(io: Server, sesi: SesiMultiplayerActive) {
  const sockets = await io.in(`session:${sesi.sessionId}`).fetchSockets();
  const bySocketId = new Map<string, PesertaMulti>();
  for (const p of sesi.peserta.values()) {
    bySocketId.set(p.socketId, p);
  }
  for (const s of sockets) {
    if (s.id === sesi.hostSocketId) continue;
    const p = bySocketId.get(s.id);
    s.leave(`session:${sesi.sessionId}:merah`);
    s.leave(`session:${sesi.sessionId}:putih`);
    if (p?.tim) {
      s.join(`session:${sesi.sessionId}:${p.tim}`);
    }
  }
}

export function setupMultiplayerSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    // 1. Siswa atau Peserta bergabung ke room sesi (Tarik Tambang, Makan Kerupuk, atau Panjat Pinang)
    const handleSesiGabung = async (
      data: { token: string; nama: string; pesertaId?: string; pesertaSecret?: string },
      callback?: (res: any) => void
    ) => {
        try {
          const parsedGabung = gabungSchema.safeParse(data || {});
          if (!parsedGabung.success) {
            callback?.({
              success: false,
              pesan: parsedGabung.error.issues[0]?.message || 'Token dan nama panggilan wajib diisi.',
            });
            return;
          }
          const { token, nama, pesertaId, pesertaSecret } = parsedGabung.data;

          // Tolak eksplisit bila token atau ID merujuk pada sesi Solo Makan Kerupuk
          if (kerupukManager.dapatkanSesi(token)) {
            callback?.({
              success: false,
              pesan: 'Sesi Solo Makan Kerupuk tidak menggunakan ruang peserta maupun siswa.',
            });
            return;
          }

          // Cek seluruh manager aktif di memori terlebih dahulu agar zero query SQLite saat 40+ siswa gabung paralel
          let sesiBalapCek = balapKarungManager.dapatkanSesiDariToken(token);
          let sesiPanjatCek = !sesiBalapCek ? panjatPinangManager.dapatkanSesiDariToken(token) : undefined;
          let sesiKerupukCek =
            !sesiBalapCek && !sesiPanjatCek
              ? kerupukMultiManager.dapatkanSesiDariToken(token)
              : undefined;
          let sesiTarikCek =
            !sesiBalapCek && !sesiPanjatCek && !sesiKerupukCek
              ? multiManager.dapatkanSesiDariToken(token)
              : undefined;

          // Hanya query database 1 kali jika token belum termuat di memori server
          if (!sesiBalapCek && !sesiPanjatCek && !sesiKerupukCek && !sesiTarikCek) {
            const dbSesi = await prisma.session.findFirst({
              where: { token, status: { in: ['lobi', 'jalan'] } },
              include: { template: { select: { game: true } } },
            });
            if (
              dbSesi?.mode === 'solo' &&
              (dbSesi.template.game === 'makan_kerupuk' || dbSesi.template.game === 'tarik_tambang')
            ) {
              callback?.({
                success: false,
                pesan: 'Mode Solo dimainkan langsung oleh guru di perangkat utama dan tidak menerima siswa.',
              });
              return;
            }
            if (dbSesi?.template.game === 'balap_karung') {
              sesiBalapCek = (await balapKarungManager.pulihkanSesiDariDb(dbSesi.id)) || undefined;
            } else if (dbSesi?.template.game === 'panjat_pinang') {
              sesiPanjatCek = (await panjatPinangManager.pulihkanSesiDariDb(dbSesi.id)) || undefined;
            } else if (dbSesi?.template.game === 'makan_kerupuk' && dbSesi.mode === 'multi') {
              sesiKerupukCek = (await kerupukMultiManager.pulihkanSesiDariDb(dbSesi.id)) || undefined;
            } else if (dbSesi?.template.game === 'tarik_tambang' && dbSesi.mode === 'multi') {
              sesiTarikCek = (await multiManager.pulihkanSesiDariDb(dbSesi.id)) || undefined;
            }
          }

          // 0b. CABANG BALAP KARUNG CHALLENGE
          if (sesiBalapCek) {
            const { sesi, peserta, isReconnect } = balapKarungManager.gabungPeserta(
              token,
              nama,
              socket.id,
              pesertaId,
              pesertaSecret
            );

            const roomName = `session:${sesi.sessionId}`;
            socket.join(roomName);

            const soalAktifData =
              sesi.status === 'jalan' && peserta.status === 'bermain'
                ? balapKarungManager.dapatkanSoalAktifPeserta(sesi.sessionId, peserta.id)
                : null;

            const leaderboard = balapKarungManager.dapatkanLeaderboard(sesi.sessionId);
            const teams = balapKarungManager.dapatkanRingkasanTim(sesi.sessionId);

            callback?.({
              success: true,
              game: 'balap_karung',
              isReconnect,
              pesertaId: peserta.id,
              pesertaSecret: peserta.secretToken,
              sessionId: sesi.sessionId,
              templateJudul: sesi.templateJudul,
              status: sesi.status,
              config: sesi.config,
              peserta: sanitizePesertaBalap(peserta, sesi.config.targetJarak),
              leaderboard,
              teams,
              totalSoal: sesi.totalSoal,
              soalAktif: soalAktifData,
            });

            io.to(roomName).emit('lobi:update', {
              game: 'balap_karung',
              totalPeserta: sesi.peserta.size,
              config: sesi.config,
              teams,
              leaderboard,
              daftarPeserta: leaderboard,
            });

            if (sesi.status === 'jalan' && soalAktifData) {
              socket.emit('soal:tampil', {
                game: 'balap_karung',
                ...soalAktifData,
              });
            }
            return;
          }

          // 0. CABANG PANJAT PINANG CHALLENGE
          if (sesiPanjatCek) {
            const { sesi, peserta, isReconnect } = panjatPinangManager.gabungPeserta(
              token,
              nama,
              socket.id,
              pesertaId,
              pesertaSecret
            );

            const roomName = `session:${sesi.sessionId}`;
            socket.join(roomName);

            const soalAktifData =
              sesi.status === 'jalan' && peserta.status === 'bermain'
                ? panjatPinangManager.dapatkanSoalAktifPeserta(sesi.sessionId, peserta.id)
                : null;

            const leaderboard = panjatPinangManager.dapatkanLeaderboard(sesi.sessionId);

            callback?.({
              success: true,
              game: 'panjat_pinang',
              isReconnect,
              pesertaId: peserta.id,
              pesertaSecret: peserta.secretToken,
              sessionId: sesi.sessionId,
              templateJudul: sesi.templateJudul,
              status: sesi.status,
              config: sesi.config,
              peserta: sanitizePesertaPanjat(peserta),
              leaderboard,
              totalSoal: sesi.totalSoal,
              soalAktif: soalAktifData,
            });

            io.to(roomName).emit('lobi:update', {
              game: 'panjat_pinang',
              totalPeserta: sesi.peserta.size,
              leaderboard,
              daftarPeserta: leaderboard,
            });

            if (sesi.status === 'jalan' && soalAktifData) {
              socket.emit('soal:tampil', {
                game: 'panjat_pinang',
                ...soalAktifData,
              });
            }
            return;
          }

          // 0c. CABANG MAKAN KERUPUK CHALLENGE (MODE MULTIPLAYER)
          if (sesiKerupukCek) {
            const { sesi, peserta, isReconnect } = kerupukMultiManager.gabungPeserta(
              token,
              nama,
              socket.id,
              pesertaId,
              pesertaSecret
            );

            const roomName = `session:${sesi.sessionId}`;
            socket.join(roomName);

            const soalAktifData =
              sesi.status === 'jalan' &&
              !peserta.state.selesaiKerupuk &&
              peserta.state.sisaKerupuk > 0
                ? kerupukMultiManager.dapatkanSoalAktifPeserta(sesi.sessionId, peserta.id)
                : null;

            const leaderboard = kerupukMultiManager.dapatkanLeaderboard(sesi.sessionId);
            const pesertaView = leaderboard.find((p) => p.id === peserta.id);

            callback?.({
              success: true,
              game: 'makan_kerupuk',
              playMode: 'MULTIPLAYER',
              isReconnect,
              pesertaId: peserta.id,
              pesertaSecret: peserta.secretToken,
              sessionId: sesi.sessionId,
              templateJudul: sesi.templateJudul,
              status: sesi.status,
              config: sesi.config,
              peserta: pesertaView,
              leaderboard,
              totalSoal: sesi.questions.length,
              soalAktif: soalAktifData,
              sudahJawabSoalAktif: false,
            });

            io.to(roomName).emit('lobi:update', {
              game: 'makan_kerupuk',
              totalPeserta: sesi.peserta.size,
              leaderboard,
              daftarPeserta: leaderboard,
            });

            io.to(roomName).emit('kerupuk:update', {
              leaderboard,
              answeredCount: sesi.totalGigitanKelas,
              totalCount: sesi.peserta.size,
            });

            if (sesi.status === 'jalan' && soalAktifData) {
              socket.emit('soal:tampil', {
                game: 'makan_kerupuk',
                ...soalAktifData,
              });
            }
            return;
          }

          // B. CABANG TARIK TAMBANG MULTIPLAYER
          const { sesi, peserta, isReconnect } = multiManager.gabungPeserta(
            token,
            nama,
            socket.id,
            pesertaId,
            pesertaSecret
          );

          const roomName = `session:${sesi.sessionId}`;
          socket.join(roomName);
          socket.leave(`session:${sesi.sessionId}:merah`);
          socket.leave(`session:${sesi.sessionId}:putih`);
          if (peserta.tim) {
            socket.join(`session:${sesi.sessionId}:${peserta.tim}`);
          }

          const daftarPeserta = formatDaftarPesertaTarik(sesi);

          let soalAktif = null;
          if (sesi.status === 'jalan') {
            armTarikMatchTimer(io, sesi);
            soalAktif =
              multiManager.dapatkanSoalAktifPeserta(sesi.sessionId, peserta.id) ||
              multiManager.siapkanSoalBerikutnyaPeserta(sesi.sessionId, peserta.id);
            if (soalAktif) {
              armTarikQuestionTimeout(
                io,
                sesi,
                peserta.id,
                soalAktif.presentationId,
                soalAktif.endsAt
              );
            }
          }

          const powerUpTim =
            peserta.tim === 'merah'
              ? {
                  bank: sesi.powerUpTim1.bank,
                  aktifBerikutnya: sesi.powerUpTim1.aktifBerikutnya,
                }
              : peserta.tim === 'putih'
                ? {
                    bank: sesi.powerUpTim2.bank,
                    aktifBerikutnya: sesi.powerUpTim2.aktifBerikutnya,
                  }
                : { bank: null, aktifBerikutnya: null };

          callback?.({
            success: true,
            game: 'tarik_tambang',
            playMode: 'MULTIPLAYER',
            isReconnect,
            pesertaId: peserta.id,
            pesertaSecret: peserta.secretToken,
            sessionId: sesi.sessionId,
            templateJudul: sesi.templateJudul,
            status: sesi.status,
            config: sesi.config,
            tim: peserta.tim,
            namaTim1: sesi.config.namaTim1,
            namaTim2: sesi.config.namaTim2,
            taliPosition: sesi.taliPosition,
            skorMerah: sesi.skorMerah,
            skorPutih: sesi.skorPutih,
            matchEndsAt: sesi.matchEndsAtMs,
            durasiLombaDetik: sesi.config.durasiLombaDetik,
            powerUpTim,
            pesertaStat: {
              totalBenar: peserta.totalBenar,
              totalSalah: peserta.totalSalah,
              jumlahJawab: peserta.jumlahJawab,
              akurasiPersen:
                peserta.jumlahJawab > 0
                  ? Math.round((peserta.totalBenar / peserta.jumlahJawab) * 100)
                  : 0,
              streakSaatIni: peserta.streakSaatIni,
              streakTertinggi: peserta.streakTertinggi,
            },
            soalAktif,
            daftarPeserta,
            ...multiManager.serialisasiPowerUpInfo(sesi),
            hasil: sesi.status === 'selesai' ? sesi.hasil : undefined,
          });

          io.to(roomName).emit('lobi:update', {
            game: 'tarik_tambang',
            playMode: 'MULTIPLAYER',
            status: sesi.status,
            totalPeserta: sesi.peserta.size,
            daftarPeserta,
            taliPosition: sesi.taliPosition,
            skorMerah: sesi.skorMerah,
            skorPutih: sesi.skorPutih,
            matchEndsAt: sesi.matchEndsAtMs,
            durasiLombaDetik: sesi.config.durasiLombaDetik,
            config: sesi.config,
            ...multiManager.serialisasiPowerUpInfo(sesi),
          });
        } catch (err: any) {
          callback?.({ success: false, pesan: err.message || 'Gagal bergabung ke sesi.' });
        }
      };

    socket.on('sesi:gabung', handleSesiGabung);
    socket.on('sesi:reconnect', handleSesiGabung);

    // 2. Host (Guru) bergabung dan mengikat socket ke room sesi
    socket.on(
      'sesi:host_join',
      async (data: { sessionId?: string }, callback?: (res: any) => void) => {
        const parsed = hostSessionPayloadSchema.safeParse(data || {});
        if (!parsed.success) {
          const pesan = parsed.error.issues[0]?.message || 'ID sesi wajib diisi.';
          socket.emit('sesi:error', { pesan });
          callback?.({ success: false, pesan });
          return;
        }
        const { sessionId } = parsed.data;

        if (kerupukManager.dapatkanSesi(sessionId)) {
          const pesan = 'Mode Solo Makan Kerupuk dijalankan lokal di perangkat guru tanpa ruang Socket.IO.';
          socket.emit('sesi:error', { pesan });
          callback?.({ success: false, pesan });
          return;
        }

        // Cek in-memory managers dulu sebelum DB recovery agar beban koneksi minim
        let sesiBalap = balapKarungManager.dapatkanSesi(sessionId);
        let sesiPanjat = panjatPinangManager.dapatkanSesi(sessionId);
        let sesiKerupuk = kerupukMultiManager.dapatkanSesi(sessionId);
        let sesi = multiManager.dapatkanSesi(sessionId);
        let sesiSoloCek = soloManager.dapatkanSesi(sessionId);

        if (!sesiBalap && !sesiPanjat && !sesiKerupuk && !sesi && !sesiSoloCek) {
          const dbMeta = await prisma.session.findUnique({
            where: { id: sessionId },
            select: { mode: true, template: { select: { game: true } } },
          });
          const g = dbMeta?.template?.game || 'tarik_tambang';
          const m = dbMeta?.mode || 'multi';
          if (g === 'balap_karung' && m !== 'solo') {
            sesiBalap = (await balapKarungManager.pulihkanSesiDariDb(sessionId)) || undefined;
          } else if (g === 'panjat_pinang') {
            sesiPanjat = (await panjatPinangManager.pulihkanSesiDariDb(sessionId)) || undefined;
          } else if (g === 'makan_kerupuk' && m === 'multi') {
            sesiKerupuk = (await kerupukMultiManager.pulihkanSesiDariDb(sessionId)) || undefined;
          } else if (g === 'tarik_tambang') {
            if (m === 'multi') {
              sesi = (await multiManager.pulihkanSesiDariDb(sessionId)) || undefined;
            } else {
              sesiSoloCek = (await soloManager.pulihkanSesiDariDb(sessionId)) || undefined;
            }
          }
        }

        // B. Cek sesi Solo Tarik Tambang (tolak keras jika session adalah mode SOLO)
        if (sesiSoloCek) {
          const pesan = 'Mode Solo dimainkan langsung di perangkat guru tanpa ruang multiplayer.';
          socket.emit('sesi:error', { pesan });
          callback?.({ success: false, pesan });
          return;
        }

        // 0b. Cek sesi Balap Karung Challenge
        if (sesiBalap) {
          const auth = pastikanHostSesi(socket, sesiBalap.hostId);
          if (!auth.ok) {
            socket.emit('sesi:error', { pesan: auth.pesan });
            callback?.({ success: false, pesan: auth.pesan });
            return;
          }

          sesiBalap.hostSocketId = socket.id;
          const roomName = `session:${sesiBalap.sessionId}`;
          socket.join(roomName);

          const leaderboard = balapKarungManager.dapatkanLeaderboard(sesiBalap.sessionId);
          const teams = balapKarungManager.dapatkanRingkasanTim(sesiBalap.sessionId);
          socket.emit('lobi:update', {
            game: 'balap_karung',
            totalPeserta: sesiBalap.peserta.size,
            config: sesiBalap.config,
            teams,
            leaderboard,
            daftarPeserta: leaderboard,
          });
          socket.emit('balap:update', {
            teams,
            leaderboard,
            totalPeserta: sesiBalap.peserta.size,
          });
          callback?.({ success: true });
          return;
        }

        // 0. Cek sesi Panjat Pinang
        if (sesiPanjat) {
          const auth = pastikanHostSesi(socket, sesiPanjat.hostId);
          if (!auth.ok) {
            socket.emit('sesi:error', { pesan: auth.pesan });
            callback?.({ success: false, pesan: auth.pesan });
            return;
          }

          sesiPanjat.hostSocketId = socket.id;
          const roomName = `session:${sesiPanjat.sessionId}`;
          socket.join(roomName);

          const leaderboard = panjatPinangManager.dapatkanLeaderboard(sesiPanjat.sessionId);
          socket.emit('lobi:update', {
            game: 'panjat_pinang',
            totalPeserta: sesiPanjat.peserta.size,
            leaderboard,
            daftarPeserta: leaderboard,
          });
          socket.emit('panjat:update', {
            leaderboard,
            totalPeserta: sesiPanjat.peserta.size,
          });
          callback?.({ success: true });
          return;
        }

        // 0c. Sesi Makan Kerupuk Multiplayer
        if (sesiKerupuk) {
          const auth = pastikanHostSesi(socket, sesiKerupuk.hostId);
          if (!auth.ok) {
            socket.emit('sesi:error', { pesan: auth.pesan });
            callback?.({ success: false, pesan: auth.pesan });
            return;
          }

          sesiKerupuk.hostSocketId = socket.id;
          const roomName = `session:${sesiKerupuk.sessionId}`;
          socket.join(roomName);

          const leaderboard = kerupukMultiManager.dapatkanLeaderboard(sesiKerupuk.sessionId);
          socket.emit('lobi:update', {
            game: 'makan_kerupuk',
            totalPeserta: sesiKerupuk.peserta.size,
            leaderboard,
            daftarPeserta: leaderboard,
          });
          socket.emit('kerupuk:update', {
            leaderboard,
            answeredCount: sesiKerupuk.totalGigitanKelas,
            totalCount: sesiKerupuk.peserta.size,
          });
          callback?.({ success: true });
          return;
        }

        if (sesi) {
          const auth = pastikanHostSesi(socket, sesi.hostId);
          if (!auth.ok) {
            socket.emit('sesi:error', { pesan: auth.pesan });
            callback?.({ success: false, pesan: auth.pesan });
            return;
          }

          sesi.hostSocketId = socket.id;
          const roomName = `session:${sesi.sessionId}`;
          socket.join(roomName);
          socket.leave(`session:${sesi.sessionId}:merah`);
          socket.leave(`session:${sesi.sessionId}:putih`);

          const daftarPeserta = formatDaftarPesertaTarik(sesi);

          socket.emit('lobi:update', {
            game: 'tarik_tambang',
            playMode: 'MULTIPLAYER',
            totalPeserta: sesi.peserta.size,
            daftarPeserta,
            config: sesi.config,
            status: sesi.status,
            taliPosition: sesi.taliPosition,
            skorMerah: sesi.skorMerah,
            skorPutih: sesi.skorPutih,
            matchEndsAt: sesi.matchEndsAtMs,
            durasiLombaDetik: sesi.config.durasiLombaDetik,
            ...multiManager.serialisasiPowerUpInfo(sesi),
            hasil: sesi.status === 'selesai' ? sesi.hasil : undefined,
          });

          if (sesi.status === 'jalan') {
            armTarikMatchTimer(io, sesi);
          } else if (sesi.status === 'selesai' && sesi.hasil) {
            socket.emit('sesi:selesai', {
              game: 'tarik_tambang',
              hasil: sesi.hasil,
            });
          }
          callback?.({ success: true });
          return;
        }

        const pesan = 'Sesi tidak ditemukan.';
        socket.emit('sesi:error', { pesan });
        callback?.({ success: false, pesan });
      }
    );

    // 2b. Guru mengacak ulang pembagian tim / posisi peserta sebelum permainan dimulai (lobi only)
    const handleAcakSemua = async (
      data: { sessionId: string; hostId?: string },
      callback?: (res: any) => void
    ) => {
      try {
        const parsed = hostSessionPayloadSchema.safeParse(data || {});
        if (!parsed.success) {
          return callback?.({ success: false, pesan: parsed.error.issues[0]?.message || 'ID sesi wajib diisi.' });
        }
        const { sessionId } = parsed.data;

        // 1. Tarik Tambang
        const sesiTarik = multiManager.dapatkanSesi(sessionId) || (await multiManager.pulihkanSesiDariDb(sessionId));
        if (sesiTarik) {
          const auth = pastikanHostSesi(socket, sesiTarik.hostId);
          if (!auth.ok) return callback?.({ success: false, pesan: auth.pesan });
          multiManager.acakUlangTim(sessionId, auth.userId);
          await sinkronkanRoomTimTarikTambang(io, sesiTarik);
          const daftarPeserta = formatDaftarPesertaTarik(sesiTarik);
          const roomName = `session:${sesiTarik.sessionId}`;
          io.to(roomName).emit('lobi:update', {
            game: 'tarik_tambang',
            playMode: 'MULTIPLAYER',
            status: sesiTarik.status,
            totalPeserta: sesiTarik.peserta.size,
            daftarPeserta,
            config: sesiTarik.config,
          });
          io.to(roomName).emit('teams_assigned', { daftarPeserta });
          return callback?.({ success: true, daftarPeserta });
        }

        // 2. Balap Karung
        const sesiBalap = balapKarungManager.dapatkanSesi(sessionId) || (await balapKarungManager.pulihkanSesiDariDb(sessionId));
        if (sesiBalap) {
          const auth = pastikanHostSesi(socket, sesiBalap.hostId);
          if (!auth.ok) return callback?.({ success: false, pesan: auth.pesan });
          const res = await balapKarungManager.acakUlangTim(sessionId, auth.userId);
          const roomName = `session:${sesiBalap.sessionId}`;
          io.to(roomName).emit('lobi:update', {
            game: 'balap_karung',
            status: sesiBalap.status,
            totalPeserta: sesiBalap.peserta.size,
            teams: res.teams,
            leaderboard: res.leaderboard,
          });
          return callback?.({ success: true, teams: res.teams, leaderboard: res.leaderboard });
        }

        // 3. Panjat Pinang
        const sesiPanjat = panjatPinangManager.dapatkanSesi(sessionId) || (await panjatPinangManager.pulihkanSesiDariDb(sessionId));
        if (sesiPanjat) {
          const auth = pastikanHostSesi(socket, sesiPanjat.hostId);
          if (!auth.ok) return callback?.({ success: false, pesan: auth.pesan });
          const leaderboard = panjatPinangManager.acakUrutanPeserta(sessionId, auth.userId);
          const roomName = `session:${sesiPanjat.sessionId}`;
          io.to(roomName).emit('lobi:update', {
            game: 'panjat_pinang',
            status: sesiPanjat.status,
            totalPeserta: sesiPanjat.peserta.size,
            leaderboard,
          });
          return callback?.({ success: true, leaderboard });
        }

        // 4. Makan Kerupuk
        const sesiKerupuk = kerupukMultiManager.dapatkanSesi(sessionId) || (await kerupukMultiManager.pulihkanSesiDariDb(sessionId));
        if (sesiKerupuk) {
          const auth = pastikanHostSesi(socket, sesiKerupuk.hostId);
          if (!auth.ok) return callback?.({ success: false, pesan: auth.pesan });
          const leaderboard = kerupukMultiManager.acakUrutanPeserta(sessionId, auth.userId);
          const roomName = `session:${sesiKerupuk.sessionId}`;
          io.to(roomName).emit('lobi:update', {
            game: 'makan_kerupuk',
            status: sesiKerupuk.status,
            totalPeserta: sesiKerupuk.peserta.size,
            leaderboard,
          });
          return callback?.({ success: true, leaderboard });
        }

        return callback?.({ success: false, pesan: 'Sesi multiplayer tidak ditemukan.' });
      } catch (err: any) {
        callback?.({ success: false, pesan: err.message || 'Gagal mengacak tim / urutan.' });
      }
    };

    socket.on('sesi:acak_tim', handleAcakSemua);
    socket.on('sesi:acak_peserta', handleAcakSemua);

    // 2d. Guru mengeluarkan (kick) siswa dari lobi permainan
    socket.on(
      'sesi:kick_peserta',
      async (
        data: { sessionId: string; pesertaId: string; hostId?: string },
        callback?: (res: any) => void
      ) => {
        try {
          const parsed = kickPesertaPayloadSchema.safeParse(data || {});
          if (!parsed.success) {
            return callback?.({ success: false, pesan: parsed.error.issues[0]?.message || 'Data kick tidak lengkap.' });
          }
          const { sessionId, pesertaId } = parsed.data;

          // 1. Tarik Tambang
          const sesiTarik = multiManager.dapatkanSesi(sessionId) || (await multiManager.pulihkanSesiDariDb(sessionId));
          if (sesiTarik) {
            const auth = pastikanHostSesi(socket, sesiTarik.hostId);
            if (!auth.ok) return callback?.({ success: false, pesan: auth.pesan });
            const p = multiManager.keluarkanPeserta(sessionId, auth.userId, pesertaId);
            if (p.socketId) {
              io.to(p.socketId).emit('sesi:dikick', { pesan: 'Anda telah dikeluarkan dari lobi oleh guru.' });
            }
            const daftarPeserta = formatDaftarPesertaTarik(sesiTarik);
            const roomName = `session:${sesiTarik.sessionId}`;
            io.to(roomName).emit('lobi:update', {
              game: 'tarik_tambang',
              playMode: 'MULTIPLAYER',
              status: sesiTarik.status,
              totalPeserta: sesiTarik.peserta.size,
              daftarPeserta,
              config: sesiTarik.config,
            });
            io.to(roomName).emit('teams_assigned', { daftarPeserta });
            return callback?.({ success: true });
          }

          // 2. Balap Karung
          const sesiBalap = balapKarungManager.dapatkanSesi(sessionId) || (await balapKarungManager.pulihkanSesiDariDb(sessionId));
          if (sesiBalap) {
            const auth = pastikanHostSesi(socket, sesiBalap.hostId);
            if (!auth.ok) return callback?.({ success: false, pesan: auth.pesan });
            const p = await balapKarungManager.keluarkanPeserta(sessionId, auth.userId, pesertaId);
            if (p.socketId) {
              io.to(p.socketId).emit('sesi:dikick', { pesan: 'Anda telah dikeluarkan dari lobi oleh guru.' });
            }
            const roomName = `session:${sesiBalap.sessionId}`;
            io.to(roomName).emit('lobi:update', {
              game: 'balap_karung',
              status: sesiBalap.status,
              totalPeserta: sesiBalap.peserta.size,
              teams: balapKarungManager.dapatkanRingkasanTim(sesiBalap.sessionId),
              leaderboard: balapKarungManager.dapatkanLeaderboard(sesiBalap.sessionId),
            });
            return callback?.({ success: true });
          }

          // 3. Panjat Pinang
          const sesiPanjat = panjatPinangManager.dapatkanSesi(sessionId) || (await panjatPinangManager.pulihkanSesiDariDb(sessionId));
          if (sesiPanjat) {
            const auth = pastikanHostSesi(socket, sesiPanjat.hostId);
            if (!auth.ok) return callback?.({ success: false, pesan: auth.pesan });
            const p = await panjatPinangManager.keluarkanPeserta(sessionId, auth.userId, pesertaId);
            if (p.socketId) {
              io.to(p.socketId).emit('sesi:dikick', { pesan: 'Anda telah dikeluarkan dari lobi oleh guru.' });
            }
            const roomName = `session:${sesiPanjat.sessionId}`;
            io.to(roomName).emit('lobi:update', {
              game: 'panjat_pinang',
              status: sesiPanjat.status,
              totalPeserta: sesiPanjat.peserta.size,
              leaderboard: panjatPinangManager.dapatkanLeaderboard(sesiPanjat.sessionId),
            });
            return callback?.({ success: true });
          }

          // 4. Makan Kerupuk
          const sesiKerupuk = kerupukMultiManager.dapatkanSesi(sessionId) || (await kerupukMultiManager.pulihkanSesiDariDb(sessionId));
          if (sesiKerupuk) {
            const auth = pastikanHostSesi(socket, sesiKerupuk.hostId);
            if (!auth.ok) return callback?.({ success: false, pesan: auth.pesan });
            const p = await kerupukMultiManager.keluarkanPeserta(sessionId, auth.userId, pesertaId);
            if (p.socketId) {
              io.to(p.socketId).emit('sesi:dikick', { pesan: 'Anda telah dikeluarkan dari lobi oleh guru.' });
            }
            const roomName = `session:${sesiKerupuk.sessionId}`;
            io.to(roomName).emit('lobi:update', {
              game: 'makan_kerupuk',
              status: sesiKerupuk.status,
              totalPeserta: sesiKerupuk.peserta.size,
              leaderboard: kerupukMultiManager.dapatkanLeaderboard(sesiKerupuk.sessionId),
            });
            return callback?.({ success: true });
          }

          return callback?.({ success: false, pesan: 'Sesi multiplayer tidak ditemukan.' });
        } catch (err: any) {
          callback?.({ success: false, pesan: err.message || 'Gagal mengeluarkan siswa.' });
        }
      }
    );

    // 2b-bis. Siswa keluar dari sesi secara sukarela (misal klik tombol keluar di ruang tunggu)
    socket.on(
      'sesi:peserta_keluar',
      async (
        data: { sessionId: string; pesertaId: string; pesertaSecret?: string },
        callback?: (res: any) => void
      ) => {
        try {
          const { sessionId, pesertaId } = data || {};
          if (!sessionId || !pesertaId) return callback?.({ success: false });

          // 1. Tarik Tambang
          const sesiTarik = multiManager.dapatkanSesi(sessionId);
          if (sesiTarik && sesiTarik.peserta.has(pesertaId)) {
            sesiTarik.peserta.delete(pesertaId);
            const daftarPeserta = formatDaftarPesertaTarik(sesiTarik);
            const roomName = `session:${sesiTarik.sessionId}`;
            io.to(roomName).emit('lobi:update', {
              game: 'tarik_tambang',
              playMode: 'MULTIPLAYER',
              status: sesiTarik.status,
              totalPeserta: sesiTarik.peserta.size,
              daftarPeserta,
              config: sesiTarik.config,
            });
            io.to(roomName).emit('teams_assigned', { daftarPeserta });
            socket.leave(roomName);
            return callback?.({ success: true });
          }

          // 2. Balap Karung
          const sesiBalap = balapKarungManager.dapatkanSesi(sessionId);
          if (sesiBalap && sesiBalap.peserta.has(pesertaId)) {
            sesiBalap.peserta.delete(pesertaId);
            const roomName = `session:${sesiBalap.sessionId}`;
            const teams = balapKarungManager.dapatkanRingkasanTim(sesiBalap.sessionId);
            const leaderboard = balapKarungManager.dapatkanLeaderboard(sesiBalap.sessionId);
            io.to(roomName).emit('lobi:update', {
              game: 'balap_karung',
              status: sesiBalap.status,
              totalPeserta: sesiBalap.peserta.size,
              teams,
              leaderboard,
              daftarPeserta: leaderboard,
            });
            socket.leave(roomName);
            return callback?.({ success: true });
          }

          // 3. Panjat Pinang
          const sesiPanjat = panjatPinangManager.dapatkanSesi(sessionId);
          if (sesiPanjat && sesiPanjat.peserta.has(pesertaId)) {
            sesiPanjat.peserta.delete(pesertaId);
            const roomName = `session:${sesiPanjat.sessionId}`;
            const leaderboard = panjatPinangManager.dapatkanLeaderboard(sesiPanjat.sessionId);
            io.to(roomName).emit('lobi:update', {
              game: 'panjat_pinang',
              status: sesiPanjat.status,
              totalPeserta: sesiPanjat.peserta.size,
              leaderboard,
              daftarPeserta: leaderboard,
            });
            socket.leave(roomName);
            return callback?.({ success: true });
          }

          // 4. Makan Kerupuk
          const sesiKerupuk = kerupukMultiManager.dapatkanSesi(sessionId);
          if (sesiKerupuk && sesiKerupuk.peserta.has(pesertaId)) {
            sesiKerupuk.peserta.delete(pesertaId);
            const roomName = `session:${sesiKerupuk.sessionId}`;
            const leaderboard = kerupukMultiManager.dapatkanLeaderboard(sesiKerupuk.sessionId);
            io.to(roomName).emit('lobi:update', {
              game: 'makan_kerupuk',
              status: sesiKerupuk.status,
              totalPeserta: sesiKerupuk.peserta.size,
              leaderboard,
              daftarPeserta: leaderboard,
            });
            socket.leave(roomName);
            return callback?.({ success: true });
          }

          return callback?.({ success: true });
        } catch (err: any) {
          callback?.({ success: false, pesan: err?.message || 'Gagal memproses keluar.' });
        }
      }
    );

    // 2c. Guru memindahkan siswa ke tim lain sebelum permainan dimulai (lobi only)
    socket.on(
      'sesi:pindah_tim',
      async (
        data: { sessionId: string; pesertaId: string; timTujuan: string; hostId?: string },
        callback?: (res: any) => void
      ) => {
        try {
          const parsed = pindahTimPayloadSchema.safeParse(data || {});
          if (!parsed.success) {
            return callback?.({ success: false, pesan: 'Data pemindahan tim tidak lengkap.' });
          }
          const { sessionId, pesertaId, timTujuan } = parsed.data;
          let sesiTarget = multiManager.dapatkanSesi(sessionId);
          if (!sesiTarget) {
            if (soloManager.dapatkanSesi(sessionId) || (await soloManager.pulihkanSesiDariDb(sessionId))) {
              return callback?.({
                success: false,
                pesan: 'Mode Solo tidak memiliki fitur pindah tim.',
              });
            }
            sesiTarget = (await multiManager.pulihkanSesiDariDb(sessionId)) || undefined;
          }
          if (!sesiTarget) {
            return callback?.({ success: false, pesan: 'Sesi tidak ditemukan.' });
          }

          const auth = pastikanHostSesi(socket, sesiTarget.hostId);
          if (!auth.ok) {
            return callback?.({ success: false, pesan: auth.pesan });
          }

          const lowerTim = timTujuan.trim().toLowerCase();
          const timNormal: 'merah' | 'putih' | null =
            lowerTim === 'merah' || lowerTim === 'tim1' || lowerTim === 'tim_a'
              ? 'merah'
              : lowerTim === 'putih' || lowerTim === 'biru' || lowerTim === 'tim2' || lowerTim === 'tim_b'
                ? 'putih'
                : null;
          if (!timNormal) {
            return callback?.({ success: false, pesan: 'Tim tujuan tidak dikenali.' });
          }

          multiManager.pindahTimPeserta(
            sessionId,
            auth.userId,
            pesertaId,
            timNormal
          );
          await sinkronkanRoomTimTarikTambang(io, sesiTarget);

          const daftarPeserta = formatDaftarPesertaTarik(sesiTarget);
          const roomName = `session:${sesiTarget.sessionId}`;
          io.to(roomName).emit('lobi:update', {
            game: 'tarik_tambang',
            playMode: 'MULTIPLAYER',
            status: sesiTarget.status,
            totalPeserta: sesiTarget.peserta.size,
            daftarPeserta,
            config: sesiTarget.config,
          });
          io.to(roomName).emit('teams_assigned', { daftarPeserta });

          callback?.({ success: true, daftarPeserta });
        } catch (err: any) {
          callback?.({ success: false, pesan: err.message || 'Gagal memindahkan tim siswa.' });
        }
      }
    );

    // 2d. Aktivasi Power-Up Tim Tarik Tambang (berlaku pada tarikan berikutnya)
    socket.on(
      'powerup:aktifkan',
      (
        data: { sessionId: string; tim?: string; pesertaId?: string; pesertaSecret?: string },
        callback?: (res: any) => void
      ) => {
        try {
          const { sessionId, tim, pesertaId, pesertaSecret } = data || {};
          if (!sessionId) return callback?.({ success: false, pesan: 'ID sesi wajib diisi.' });
          if (soloManager.dapatkanSesi(sessionId)) {
            return callback?.({
              success: false,
              pesan: 'Mode Solo menggunakan endpoint REST power-up.',
            });
          }
          if (!pesertaId) {
            return callback?.({
              success: false,
              pesan: 'Identitas peserta wajib diisi untuk mengaktifkan Power-Up.',
            });
          }
          const sesiCheck = multiManager.dapatkanSesi(sessionId);
          const pesertaCheck = sesiCheck?.peserta.get(pesertaId);
          if (!pesertaCheck) {
            return callback?.({ success: false, pesan: 'Peserta tidak ditemukan di sesi.' });
          }
          if (pesertaSecret && pesertaCheck.secretToken !== pesertaSecret) {
            return callback?.({ success: false, pesan: 'Token autentikasi peserta tidak valid.' });
          }
          if (!pesertaSecret && pesertaCheck.socketId && pesertaCheck.socketId !== socket.id) {
            return callback?.({ success: false, pesan: 'Socket peserta tidak sesuai.' });
          }

          const res = multiManager.aktifkanPowerUpTim(sessionId, pesertaId, tim);

          io.to(`session:${sessionId}`).emit('powerup:update', {
            game: 'tarik_tambang',
            tim: res.tim,
            powerUpDiaktifkan: res.powerUp,
            ...multiManager.serialisasiPowerUpInfo(res.sesi),
          });

          callback?.({ success: true, tim: res.tim, powerUp: res.powerUp });
        } catch (err: any) {
          callback?.({ success: false, pesan: err.message || 'Gagal mengaktifkan power-up.' });
        }
      }
    );

    // 2b. Host mengubah jumlah tim (3 atau 4 tim) di Lobi Balap Karung Multiplayer
    socket.on(
      'balap:ubah_jumlah_tim',
      async (
        data: { sessionId: string; hostId?: string; jumlahTim: 3 | 4 },
        callback?: (res: any) => void
      ) => {
        try {
          const parsed = ubahJumlahTimPayloadSchema.safeParse(data || {});
          if (!parsed.success) {
            callback?.({
              success: false,
              pesan: parsed.error.issues[0]?.message || 'Data perubahan jumlah tim tidak valid.',
            });
            return;
          }
          const { sessionId, jumlahTim } = parsed.data;
          let sesiBalap = balapKarungManager.dapatkanSesi(sessionId);
          if (!sesiBalap) {
            sesiBalap = (await balapKarungManager.pulihkanSesiDariDb(sessionId)) || undefined;
          }
          if (!sesiBalap) {
            callback?.({ success: false, pesan: 'Sesi Balap Karung tidak ditemukan.' });
            return;
          }
          const auth = pastikanHostSesi(socket, sesiBalap.hostId);
          if (!auth.ok) {
            callback?.({ success: false, pesan: auth.pesan });
            return;
          }

          const updated = await balapKarungManager.ubahJumlahTim(
            sessionId,
            auth.userId,
            jumlahTim
          );
          const roomName = `session:${sesiBalap.sessionId}`;
          io.to(roomName).emit('lobi:update', {
            game: 'balap_karung',
            totalPeserta: updated.sesi.peserta.size,
            config: updated.sesi.config,
            teams: updated.teams,
            leaderboard: updated.leaderboard,
            daftarPeserta: updated.leaderboard,
          });
          callback?.({
            success: true,
            config: updated.sesi.config,
            teams: updated.teams,
            leaderboard: updated.leaderboard,
          });
        } catch (err: any) {
          callback?.({ success: false, pesan: err.message || 'Gagal mengubah jumlah tim.' });
        }
      }
    );

    // 3. Guru menekan tombol "Mulai Permainan"
    socket.on(
      'sesi:mulai',
      async (
        data: { sessionId: string; hostId?: string },
        callback?: (res: any) => void
      ) => {
        try {
          const parsed = hostSessionPayloadSchema.safeParse(data || {});
          if (!parsed.success) {
            callback?.({
              success: false,
              pesan: parsed.error.issues[0]?.message || 'ID sesi wajib diisi.',
            });
            return;
          }
          const { sessionId } = parsed.data;

          if (kerupukManager.dapatkanSesi(sessionId)) {
            callback?.({
              success: false,
              pesan: 'Sesi Solo Makan Kerupuk dikendalikan langsung oleh guru tanpa ruang tunggu Multiplayer.',
            });
            return;
          }

          // 0b. Sesi Balap Karung Challenge
          const sesiBalapTarget = balapKarungManager.dapatkanSesi(sessionId);
          if (sesiBalapTarget) {
            const auth = pastikanHostSesi(socket, sesiBalapTarget.hostId);
            if (!auth.ok) {
              callback?.({ success: false, pesan: auth.pesan });
              return;
            }

            const sesi = balapKarungManager.mulaiPermainan(sessionId, auth.userId);
            const roomName = `session:${sesi.sessionId}`;

            await prisma.session.update({
              where: { id: sessionId },
              data: {
                status: 'jalan',
                mulaiPada: new Date(sesi.gameMulaiPadaMs || Date.now()),
                konfigurasi: JSON.stringify(sesi.config),
              },
            });

            const leaderboardAwal = balapKarungManager.dapatkanLeaderboard(sesi.sessionId);
            const teamsAwal = balapKarungManager.dapatkanRingkasanTim(sesi.sessionId);
            io.to(roomName).emit('game:mulai', {
              game: 'balap_karung',
              totalSoal: sesi.totalSoal,
              config: sesi.config,
              teams: teamsAwal,
              leaderboard: leaderboardAwal,
            });

            for (const p of sesi.peserta.values()) {
              if (p.connected && p.socketId) {
                const soalData = balapKarungManager.ambilSoalBerikutnyaUntukPeserta(
                  sesi.sessionId,
                  p.id
                );
                if (soalData) {
                  io.to(p.socketId).emit('soal:tampil', {
                    game: 'balap_karung',
                    ...soalData,
                  });
                }
              }
            }

            callback?.({ success: true, pesan: 'Balap Karung Challenge dimulai!' });
            return;
          }

          // 0. Sesi Panjat Pinang
          const sesiPanjatTarget = panjatPinangManager.dapatkanSesi(sessionId);
          if (sesiPanjatTarget) {
            const auth = pastikanHostSesi(socket, sesiPanjatTarget.hostId);
            if (!auth.ok) {
              callback?.({ success: false, pesan: auth.pesan });
              return;
            }

            const sesi = panjatPinangManager.mulaiPermainan(sessionId, auth.userId);
            const roomName = `session:${sesi.sessionId}`;

            await prisma.session.update({
              where: { id: sessionId },
              data: {
                status: 'jalan',
                mulaiPada: new Date(sesi.gameMulaiPadaMs || Date.now()),
                konfigurasi: JSON.stringify(sesi.config),
              },
            });

            const leaderboardAwal = panjatPinangManager.dapatkanLeaderboard(sesi.sessionId);
            io.to(roomName).emit('game:mulai', {
              game: 'panjat_pinang',
              totalSoal: sesi.totalSoal,
              config: sesi.config,
              leaderboard: leaderboardAwal,
            });

            for (const p of sesi.peserta.values()) {
              if (p.connected && p.socketId) {
                const soalData = panjatPinangManager.ambilSoalBerikutnyaUntukPeserta(
                  sesi.sessionId,
                  p.id
                );
                if (soalData) {
                  io.to(p.socketId).emit('soal:tampil', {
                    game: 'panjat_pinang',
                    ...soalData,
                  });
                }
              }
            }

            callback?.({ success: true, pesan: 'Lomba Panjat Pinang dimulai!' });
            return;
          }

          // 0c. Sesi Makan Kerupuk Multiplayer
          const sesiKerupukTarget = kerupukMultiManager.dapatkanSesi(sessionId);
          if (sesiKerupukTarget) {
            const auth = pastikanHostSesi(socket, sesiKerupukTarget.hostId);
            if (!auth.ok) {
              callback?.({ success: false, pesan: auth.pesan });
              return;
            }

            const sesi = kerupukMultiManager.mulaiPermainan(sessionId, auth.userId);
            const roomName = `session:${sesi.sessionId}`;

            await prisma.session.update({
              where: { id: sessionId },
              data: { status: 'jalan', mulaiPada: new Date() },
            });

            io.to(roomName).emit('game:mulai', {
              game: 'makan_kerupuk',
              totalSoal: sesi.questions.length,
              config: sesi.config,
            });

            for (const p of sesi.peserta.values()) {
              if (p.connected && p.socketId) {
                const soalData = kerupukMultiManager.ambilSoalBerikutnyaUntukPeserta(
                  sesi.sessionId,
                  p.id
                );
                if (soalData) {
                  io.to(p.socketId).emit('soal:tampil', {
                    game: 'makan_kerupuk',
                    ...soalData,
                  });
                }
              }
            }

            callback?.({ success: true, pesan: 'Lomba Makan Kerupuk Challenge dimulai!' });
            return;
          }

          // B. Sesi Tarik Tambang (tolak jika sesi merupakan mode SOLO)
          let sesiTarget = multiManager.dapatkanSesi(sessionId);
          if (!sesiTarget) {
            if (soloManager.dapatkanSesi(sessionId) || (await soloManager.pulihkanSesiDariDb(sessionId))) {
              callback?.({
                success: false,
                pesan: 'Mode Solo tidak dijalankan melalui ruang multiplayer.',
              });
              return;
            }
            sesiTarget = (await multiManager.pulihkanSesiDariDb(sessionId)) || undefined;
          }
          if (!sesiTarget) {
            callback?.({ success: false, pesan: 'Sesi tidak ditemukan.' });
            return;
          }

          const auth = pastikanHostSesi(socket, sesiTarget.hostId);
          if (!auth.ok) {
            callback?.({ success: false, pesan: auth.pesan });
            return;
          }

          const sesi = multiManager.mulaiPermainan(sessionId, auth.userId);
          const roomName = `session:${sesi.sessionId}`;

          // Update status di database menjadi 'jalan'
          await prisma.session.update({
            where: { id: sessionId },
            data: { status: 'jalan', mulaiPada: new Date(sesi.matchStartedAtMs || Date.now()) },
          });

          await sinkronkanRoomTimTarikTambang(io, sesi);

          const daftarPeserta = formatDaftarPesertaTarik(sesi);

          io.to(roomName).emit('teams_assigned', {
            daftarPeserta,
          });

          io.to(roomName).emit('game:mulai', {
            game: 'tarik_tambang',
            playMode: 'MULTIPLAYER',
            sessionId: sesi.sessionId,
            status: 'jalan',
            taliPosition: sesi.taliPosition,
            skorMerah: sesi.skorMerah,
            skorPutih: sesi.skorPutih,
            matchEndsAt: sesi.matchEndsAtMs,
            durasiLombaDetik: sesi.config.durasiLombaDetik,
            daftarPeserta,
            config: sesi.config,
          });

          // Mulai match continuous: kirimkan soal acak individual ke tiap siswa & nyalakan match timer 3:00
          await mulaiMatchTarikTambang(io, sesi);

          callback?.({ success: true, status: 'jalan', pesan: 'Permainan dimulai!' });
        } catch (err: any) {
          callback?.({ success: false, pesan: err.message || 'Gagal memulai permainan.' });
        }
      }
    );

    // 4. Siswa mengirimkan jawaban
    socket.on(
      'jawab:kirim',
      async (
        data: {
          sessionId: string;
          pesertaId: string;
          pesertaSecret?: string;
          presentationId?: string;
          questionId?: string;
          id?: string;
          choiceId?: string;
          jawaban?: string;
        },
        callback?: (res: any) => void
      ) => {
        try {
          const {
            sessionId,
            pesertaId,
            jawaban,
            pesertaSecret,
            presentationId,
            choiceId,
          } = data || {};
          const rawQId = data?.questionId || data?.id;

          if (kerupukManager.dapatkanSesi(sessionId)) {
            callback?.({
              success: false,
              pesan: 'Sesi Solo Makan Kerupuk tidak menerima jawaban peserta melalui Socket.IO.',
            });
            return;
          }

          // 0b. Sesi Balap Karung Challenge
          const sesiBalap = balapKarungManager.dapatkanSesi(sessionId);
          if (sesiBalap) {
            const parsedJawab = jawabPanjatSchema.safeParse(data || {});
            if (!parsedJawab.success) {
              callback?.({
                success: false,
                pesan: parsedJawab.error.issues[0]?.message || 'Format jawaban tidak valid.',
              });
              return;
            }

            const bk = parsedJawab.data;
            const hasil = balapKarungManager.prosesJawabanSiswa({
              sessionId: bk.sessionId,
              pesertaId: bk.pesertaId,
              pesertaSecret: bk.pesertaSecret,
              socketId: socket.id,
              presentationId: bk.presentationId,
              questionId: bk.questionId || bk.id,
              choiceId: bk.choiceId,
              jawaban: bk.jawaban,
              timedOut: bk.timedOut,
            });

            const roomName = `session:${sesiBalap.sessionId}`;
            const pUpdated = hasil.hasilJawaban.pesertaUpdated;
            const sanitizedPemain = sanitizePesertaBalap(pUpdated, sesiBalap.config.targetJarak);

            const feedbackPayload = {
              success: true,
              game: 'balap_karung',
              benar: hasil.hasilJawaban.benar,
              timedOut: hasil.hasilJawaban.timedOut,
              terpeleset: hasil.terpeleset,
              stumbleQuote: hasil.stumbleQuote,
              timPeserta: hasil.timPeserta,
              stepTim: hasil.stepTim,
              teams: hasil.teams,
              kunciKey: hasil.kunciKey,
              jawabanBenar: hasil.kunciKey,
              penjelasan: hasil.penjelasan,
              jarakSebelum: hasil.hasilJawaban.jarakSebelum,
              jarakBaru: hasil.hasilJawaban.jarakBaru,
              perubahanJarak: hasil.hasilJawaban.perubahanJarak,
              targetJarak: sesiBalap.config.targetJarak,
              keseimbanganSebelum: hasil.hasilJawaban.keseimbanganSebelum,
              keseimbanganBaru: hasil.hasilJawaban.keseimbanganBaru,
              perubahanKeseimbangan: hasil.hasilJawaban.perubahanKeseimbangan,
              bonusStreakJarakDidapat: hasil.hasilJawaban.bonusStreakJarakDidapat,
              bonusStreakKeseimbanganDidapat: hasil.hasilJawaban.bonusStreakKeseimbanganDidapat,
              bonusLompatanKuatDidapat: hasil.hasilJawaban.bonusLompatanKuatDidapat,
              penaltiJalanBerlumpurDipakai: hasil.hasilJawaban.penaltiJalanBerlumpurDipakai,
              terjatuh: hasil.hasilJawaban.terjatuh,
              penaltiJatuhJarak: hasil.hasilJawaban.penaltiJatuhJarak,
              perisaiDigunakan: hasil.hasilJawaban.perisaiDigunakan,
              rintanganBaru: hasil.hasilJawaban.rintanganBaru,
              selesaiBaru: hasil.hasilJawaban.selesaiBaru,
              waktuJawabMs: hasil.hasilJawaban.waktuJawabMs,
              pesertaUpdated: sanitizedPemain,
            };

            callback?.(feedbackPayload);
            socket.emit('jawab:hasil', feedbackPayload);

            io.to(roomName).emit('balap:update', {
              teams: hasil.teams,
              leaderboard: hasil.leaderboard,
              totalPeserta: sesiBalap.peserta.size,
              terakhirAksi: {
                pesertaId: pUpdated.id,
                nama: pUpdated.nama,
                tim: hasil.timPeserta,
                benar: hasil.hasilJawaban.benar,
                timedOut: hasil.hasilJawaban.timedOut,
                terpeleset: hasil.terpeleset,
                stumbleQuote: hasil.stumbleQuote,
                stepTim: hasil.stepTim,
                timMenangId: hasil.timMenangId,
                timMenangNama: hasil.timMenangNama,
                jarakSebelum: hasil.hasilJawaban.jarakSebelum,
                jarakBaru: hasil.hasilJawaban.jarakBaru,
                perubahanJarak: hasil.hasilJawaban.perubahanJarak,
                keseimbanganBaru: hasil.hasilJawaban.keseimbanganBaru,
                streakSaatIni: pUpdated.streakSaatIni,
                terjatuh: hasil.hasilJawaban.terjatuh,
                penaltiJatuhJarak: hasil.hasilJawaban.penaltiJatuhJarak,
                perisaiDigunakan: hasil.hasilJawaban.perisaiDigunakan,
                rintanganBaru: hasil.hasilJawaban.rintanganBaru,
                selesaiBaru: hasil.hasilJawaban.selesaiBaru,
              },
            });

            const existingTimer = pendingNextSoalBalapTimers.get(bk.pesertaId);
            if (existingTimer) {
              clearTimeout(existingTimer);
              pendingNextSoalBalapTimers.delete(bk.pesertaId);
            }

            if (hasil.semuaPemainSelesai) {
              const laporanAkhir = balapKarungManager.akhiriPermainan(sesiBalap.sessionId, false);
              await balapKarungManager.simpanHasilAkhirKeDatabase(sesiBalap.sessionId);
              io.to(roomName).emit('sesi:selesai', {
                game: 'balap_karung',
                hasil: laporanAkhir,
              });
              return;
            }

            const timer = setTimeout(() => {
              pendingNextSoalBalapTimers.delete(bk.pesertaId);
              const sesiCheck = balapKarungManager.dapatkanSesi(bk.sessionId);
              if (!sesiCheck || sesiCheck.status !== 'jalan') return;
              const pNow = sesiCheck.peserta.get(bk.pesertaId);
              if (!pNow) return;
              const nextSoal = balapKarungManager.dapatkanSoalAktifPeserta(
                bk.sessionId,
                bk.pesertaId
              );
              if (nextSoal) {
                const payload = {
                  game: 'balap_karung',
                  ...nextSoal,
                };
                if (pNow.socketId) {
                  io.to(pNow.socketId).emit('soal:tampil', payload);
                } else {
                  socket.emit('soal:tampil', payload);
                }
              }
            }, 950);
            pendingNextSoalBalapTimers.set(bk.pesertaId, timer);

            return;
          }

          // 0. Sesi Panjat Pinang
          const sesiPanjat = panjatPinangManager.dapatkanSesi(sessionId);
          if (sesiPanjat) {
            const parsedJawab = jawabPanjatSchema.safeParse(data || {});
            if (!parsedJawab.success) {
              callback?.({
                success: false,
                pesan: parsedJawab.error.issues[0]?.message || 'Format jawaban tidak valid.',
              });
              return;
            }

            const pj = parsedJawab.data;
            const hasil = panjatPinangManager.prosesJawabanSiswa({
              sessionId: pj.sessionId,
              pesertaId: pj.pesertaId,
              pesertaSecret: pj.pesertaSecret,
              socketId: socket.id,
              presentationId: pj.presentationId,
              questionId: pj.questionId || pj.id,
              choiceId: pj.choiceId,
              jawaban: pj.jawaban,
            });

            const roomName = `session:${sesiPanjat.sessionId}`;
            const pUpdated = hasil.hasilJawaban.pesertaUpdated;
            const sanitizedPemain = sanitizePesertaPanjat(pUpdated);

            const feedbackPayload = {
              success: true,
              game: 'panjat_pinang',
              benar: hasil.hasilJawaban.benar,
              kunciKey: hasil.kunciKey,
              jawabanBenar: hasil.kunciKey,
              penjelasan: hasil.penjelasan,
              isBonusKulitPisang: hasil.hasilJawaban.isBonusKulitPisang,
              posisiSebelum: hasil.hasilJawaban.posisiSebelum,
              posisiBaru: hasil.hasilJawaban.posisiBaru,
              perubahanPosisi: hasil.hasilJawaban.perubahanPosisi,
              bonusStreakDidapat: hasil.hasilJawaban.bonusStreakDidapat,
              bonusPeganganKuatDidapat: hasil.hasilJawaban.bonusPeganganKuatDidapat,
              penaltiTiangLicin: hasil.hasilJawaban.penaltiTiangLicin,
              perisaiDigunakan: hasil.hasilJawaban.perisaiDigunakan,
              perisaiDiperoleh: hasil.hasilJawaban.perisaiDiperoleh,
              rintanganBaru: hasil.hasilJawaban.rintanganBaru,
              selesaiBaru: hasil.hasilJawaban.selesaiBaru,
              waktuJawabMs: hasil.hasilJawaban.waktuJawabMs,
              pesertaUpdated: sanitizedPemain,
            };

            callback?.(feedbackPayload);
            socket.emit('jawab:hasil', feedbackPayload);

            io.to(roomName).emit('panjat:update', {
              leaderboard: hasil.leaderboard,
              totalPeserta: sesiPanjat.peserta.size,
              terakhirAksi: {
                pesertaId: pUpdated.id,
                nama: pUpdated.nama,
                benar: hasil.hasilJawaban.benar,
                isBonusKulitPisang: hasil.hasilJawaban.isBonusKulitPisang,
                posisiSebelum: hasil.hasilJawaban.posisiSebelum,
                posisiBaru: hasil.hasilJawaban.posisiBaru,
                perubahanPosisi: hasil.hasilJawaban.perubahanPosisi,
                streakSaatIni: pUpdated.streakSaatIni,
                rintanganBaru: hasil.hasilJawaban.rintanganBaru,
                perisaiDigunakan: hasil.hasilJawaban.perisaiDigunakan,
                perisaiDiperoleh: hasil.hasilJawaban.perisaiDiperoleh,
                selesaiBaru: hasil.hasilJawaban.selesaiBaru,
              },
            });

            // Bersihkan timer pending lama untuk pemain ini jika masih ada
            const existingTimer = pendingNextSoalPanjatTimers.get(pj.pesertaId);
            if (existingTimer) {
              clearTimeout(existingTimer);
              pendingNextSoalPanjatTimers.delete(pj.pesertaId);
            }

            if (hasil.semuaPemainSelesai) {
              const laporanAkhir = panjatPinangManager.akhiriPermainan(sesiPanjat.sessionId, false);
              await panjatPinangManager.simpanHasilAkhirKeDatabase(sesiPanjat.sessionId);
              io.to(roomName).emit('sesi:selesai', {
                game: 'panjat_pinang',
                hasil: laporanAkhir,
              });
              return;
            }

            if (hasil.pemainSelesai) {
              socket.emit('pemain:selesai', {
                game: 'panjat_pinang',
                peserta: sanitizedPemain,
                pesan: 'Selamat! Kamu berhasil mencapai puncak 100%!',
              });
              return;
            }

            const timer = setTimeout(() => {
              pendingNextSoalPanjatTimers.delete(pj.pesertaId);
              const sesiCheck = panjatPinangManager.dapatkanSesi(pj.sessionId);
              if (!sesiCheck || sesiCheck.status !== 'jalan') return;
              const nextSoal = panjatPinangManager.dapatkanSoalAktifPeserta(
                pj.sessionId,
                pj.pesertaId
              );
              if (nextSoal) {
                socket.emit('soal:tampil', {
                  game: 'panjat_pinang',
                  ...nextSoal,
                });
              }
            }, 1400);
            pendingNextSoalPanjatTimers.set(pj.pesertaId, timer);

            return;
          }

          // 0c. Sesi Makan Kerupuk Multiplayer
          const sesiKerupuk = kerupukMultiManager.dapatkanSesi(sessionId);
          if (sesiKerupuk) {
            const pk = jawabPanjatSchema.parse(data);
            const targetQuestionId =
              pk.questionId || (pk.id && pk.id !== 'undefined' && pk.id !== 'null' ? pk.id : undefined);

            const hasil = kerupukMultiManager.prosesJawabanSiswa(
              pk.sessionId,
              pk.pesertaId,
              {
                presentationId: pk.presentationId,
                choiceId: pk.choiceId,
                questionId: targetQuestionId,
                jawaban: pk.jawaban,
              },
              pk.pesertaSecret
            );

            const roomName = `session:${sesiKerupuk.sessionId}`;
            const feedbackPayload = {
              success: true,
              game: 'makan_kerupuk',
              benar: hasil.benar,
              jawabanBenar: hasil.jawabanBenarKode,
              jawabanBenarTeks: hasil.jawabanBenarTeks,
              penjelasan: hasil.penjelasan,
              poinDidapat: hasil.poinDidapat,
              poinDasar: hasil.poinDasar,
              bonusStreak: hasil.bonusStreak,
              bonusPenyelesaian: hasil.bonusPenyelesaian,
              gacha: hasil.gacha,
              sisaKerupukBaru: hasil.sisaKerupukBaru,
              progresPersenBaru: hasil.progresPersenBaru,
              selesaiBaru: hasil.pemainSelesai,
              pesertaUpdated: hasil.pesertaView,
              gigitanLogItem: hasil.gigitanLogItem,
            };

            callback?.(feedbackPayload);
            socket.emit('jawab:hasil', feedbackPayload);

            io.to(roomName).emit('kerupuk:update', {
              leaderboard: hasil.leaderboard,
              answeredCount: sesiKerupuk.totalGigitanKelas,
              totalCount: sesiKerupuk.peserta.size,
              terakhirJawab: {
                pesertaId: pk.pesertaId,
                nama: hasil.pesertaView.nama,
                benar: hasil.benar,
                gacha: hasil.gacha,
                sisaKerupuk: hasil.pesertaView.sisaKerupuk,
                sisaPersen: hasil.pesertaView.sisaPersen,
              },
            });

            if (hasil.gameSelesaiSemuaHabis) {
              const existingTimer = pendingNextSoalKerupukTimers.get(pk.pesertaId);
              if (existingTimer) {
                clearTimeout(existingTimer);
                pendingNextSoalKerupukTimers.delete(pk.pesertaId);
              }
              const hasilAkhir = kerupukMultiManager.akhiriPermainan(sesiKerupuk.sessionId, false);
              await kerupukMultiManager.simpanHasilKeDatabase(sesiKerupuk.sessionId);
              io.to(roomName).emit('sesi:selesai', {
                game: 'makan_kerupuk',
                hasil: hasilAkhir,
              });
              return;
            }

            if (hasil.pemainSelesai) {
              const existingTimer = pendingNextSoalKerupukTimers.get(pk.pesertaId);
              if (existingTimer) {
                clearTimeout(existingTimer);
                pendingNextSoalKerupukTimers.delete(pk.pesertaId);
              }
              socket.emit('pemain:selesai', {
                game: 'makan_kerupuk',
                peserta: hasil.pesertaView,
                pesan: 'Selamat! Kerupukmu telah habis 100%!',
              });
              return;
            }

            const existingTimer = pendingNextSoalKerupukTimers.get(pk.pesertaId);
            if (existingTimer) {
              clearTimeout(existingTimer);
            }
            const timer = setTimeout(() => {
              pendingNextSoalKerupukTimers.delete(pk.pesertaId);
              const sesiCheck = kerupukMultiManager.dapatkanSesi(pk.sessionId);
              if (!sesiCheck || sesiCheck.status !== 'jalan') return;
              const nextSoal = kerupukMultiManager.dapatkanSoalAktifPeserta(
                pk.sessionId,
                pk.pesertaId
              );
              if (nextSoal) {
                socket.emit('soal:tampil', {
                  game: 'makan_kerupuk',
                  ...nextSoal,
                });
              }
            }, 1400);
            pendingNextSoalKerupukTimers.set(pk.pesertaId, timer);

            return;
          }

          // B. Sesi Tarik Tambang (tolak jika mode SOLO)
          if (soloManager.dapatkanSesi(sessionId)) {
            callback?.({
              success: false,
              pesan: 'Mode Solo tidak menerima jawaban melalui event multiplayer.',
            });
            return;
          }

          const sesi = multiManager.dapatkanSesi(sessionId);
          if (!sesi) {
            callback?.({ success: false, pesan: 'Sesi permainan tidak ditemukan.' });
            return;
          }

          const peserta = sesi.peserta.get(pesertaId);
          if (!peserta) {
            callback?.({ success: false, pesan: 'Peserta tidak ditemukan di sesi.' });
            return;
          }

          if (pesertaSecret && peserta.secretToken !== pesertaSecret) {
            callback?.({ success: false, pesan: 'Token autentikasi peserta tidak valid.' });
            return;
          }
          if (!pesertaSecret && peserta.socketId && peserta.socketId !== socket.id) {
            callback?.({ success: false, pesan: 'Identitas socket peserta tidak cocok.' });
            return;
          }

          await eksekusiJawabSiswaTarik(
            io,
            sesi,
            peserta,
            {
              presentationId: presentationId || rawQId,
              choiceId,
              jawaban,
              timedOut: Boolean((data as any)?.timedOut),
            },
            socket,
            callback
          );
        } catch (err: any) {
          callback?.({ success: false, pesan: err.message || 'Gagal memproses jawaban.' });
        }
      }
    );

    // 4b. Siswa meminta soal berikutnya secara langsung (misalnya menekan tombol "Lanjut" tanpa menunggu jeda)
    socket.on(
      'soal:lanjut',
      (data: { sessionId: string; pesertaId: string; pesertaSecret?: string }) => {
        const { sessionId, pesertaId, pesertaSecret } = data || {};
        if (!sessionId || !pesertaId) return;

        // 0b. Balap Karung Challenge
        const sesiBalap = balapKarungManager.dapatkanSesi(sessionId);
        if (sesiBalap) {
          if (sesiBalap.status !== 'jalan') return;
          const pesertaBalap = sesiBalap.peserta.get(pesertaId);
          if (!pesertaBalap) return;
          if (pesertaSecret && pesertaBalap.secretToken !== pesertaSecret) return;
          if (!pesertaSecret && pesertaBalap.socketId && pesertaBalap.socketId !== socket.id) {
            return;
          }
          if (
            pesertaBalap.status === 'selesai' ||
            pesertaBalap.jarak >= sesiBalap.config.targetJarak
          ) {
            return;
          }

          const existingTimer = pendingNextSoalBalapTimers.get(pesertaId);
          if (existingTimer) {
            clearTimeout(existingTimer);
            pendingNextSoalBalapTimers.delete(pesertaId);
          }

          const nextSoal = balapKarungManager.dapatkanSoalAktifPeserta(sessionId, pesertaId);
          if (nextSoal) {
            socket.emit('soal:tampil', {
              game: 'balap_karung',
              ...nextSoal,
            });
          }
          return;
        }

        // 0. Panjat Pinang
        const sesiPanjat = panjatPinangManager.dapatkanSesi(sessionId);
        if (sesiPanjat) {
          if (sesiPanjat.status !== 'jalan') return;
          const pesertaPanjat = sesiPanjat.peserta.get(pesertaId);
          if (!pesertaPanjat) return;
          if (pesertaSecret && pesertaPanjat.secretToken !== pesertaSecret) return;
          if (pesertaPanjat.status === 'selesai' || pesertaPanjat.posisi >= 100) return;

          const existingTimer = pendingNextSoalPanjatTimers.get(pesertaId);
          if (existingTimer) {
            clearTimeout(existingTimer);
            pendingNextSoalPanjatTimers.delete(pesertaId);
          }

          const nextSoal = panjatPinangManager.dapatkanSoalAktifPeserta(sessionId, pesertaId);
          if (nextSoal) {
            socket.emit('soal:tampil', {
              game: 'panjat_pinang',
              ...nextSoal,
            });
          }
          return;
        }

        // 0c. Makan Kerupuk Multiplayer
        const sesiKerupuk = kerupukMultiManager.dapatkanSesi(sessionId);
        if (sesiKerupuk) {
          if (sesiKerupuk.status !== 'jalan') return;
          const pesertaK = sesiKerupuk.peserta.get(pesertaId);
          if (!pesertaK) return;
          if (pesertaSecret && pesertaK.secretToken !== pesertaSecret) return;
          if (pesertaK.state.selesaiKerupuk || pesertaK.state.sisaKerupuk <= 0) return;

          const existingTimer = pendingNextSoalKerupukTimers.get(pesertaId);
          if (existingTimer) {
            clearTimeout(existingTimer);
            pendingNextSoalKerupukTimers.delete(pesertaId);
          }

          const nextSoal = kerupukMultiManager.dapatkanSoalAktifPeserta(sessionId, pesertaId);
          if (nextSoal) {
            socket.emit('soal:tampil', {
              game: 'makan_kerupuk',
              ...nextSoal,
            });
          }
          return;
        }

        // B. Tarik Tambang Multiplayer
        const sesiTarik = multiManager.dapatkanSesi(sessionId);
        if (sesiTarik) {
          if (sesiTarik.status !== 'jalan') return;
          const pesertaTarik = sesiTarik.peserta.get(pesertaId);
          if (!pesertaTarik) return;
          if (pesertaSecret && pesertaTarik.secretToken !== pesertaSecret) return;
          if (!pesertaSecret && pesertaTarik.socketId && pesertaTarik.socketId !== socket.id) return;

          const existingTimer = pendingNextSoalTarikTimers.get(pesertaId);
          if (existingTimer) {
            clearTimeout(existingTimer);
            pendingNextSoalTarikTimers.delete(pesertaId);
            const nextSoal = multiManager.siapkanSoalBerikutnyaPeserta(sessionId, pesertaId);
            if (nextSoal) {
              socket.emit('soal:tampil', nextSoal);
              armTarikQuestionTimeout(
                io,
                sesiTarik,
                pesertaId,
                nextSoal.presentationId,
                nextSoal.endsAt
              );
            }
            return;
          }

          const aktifSoal = multiManager.dapatkanSoalAktifPeserta(sessionId, pesertaId);
          if (aktifSoal) {
            socket.emit('soal:tampil', aktifSoal);
          }
          return;
        }
      });

    // 5. Guru mengakhiri permainan secara manual
    socket.on(
      'sesi:akhiri_manual',
      async (data: { sessionId: string; hostId?: string }, callback?: (res: any) => void) => {
        try {
          const parsed = hostSessionPayloadSchema.safeParse(data || {});
          if (!parsed.success) {
            callback?.({
              success: false,
              pesan: parsed.error.issues[0]?.message || 'ID sesi wajib diisi.',
            });
            return;
          }
          const { sessionId } = parsed.data;

          if (kerupukManager.dapatkanSesi(sessionId)) {
            callback?.({
              success: false,
              pesan: 'Sesi Solo Makan Kerupuk dihentikan langsung melalui kontrol perangkat guru.',
            });
            return;
          }

          // 0b. Sesi Balap Karung Challenge
          const sesiBalap = balapKarungManager.dapatkanSesi(sessionId);
          if (sesiBalap) {
            const auth = pastikanHostSesi(socket, sesiBalap.hostId);
            if (!auth.ok) {
              callback?.({ success: false, pesan: auth.pesan });
              return;
            }

            for (const pId of sesiBalap.peserta.keys()) {
              const t = pendingNextSoalBalapTimers.get(pId);
              if (t) {
                clearTimeout(t);
                pendingNextSoalBalapTimers.delete(pId);
              }
            }

            const hasil = balapKarungManager.akhiriPermainan(sessionId, true);
            await balapKarungManager.simpanHasilAkhirKeDatabase(sessionId);

            const roomName = `session:${sesiBalap.sessionId}`;
            io.to(roomName).emit('sesi:selesai', {
              game: 'balap_karung',
              hasil,
            });

            callback?.({ success: true, hasil });
            return;
          }

          // 0. Sesi Panjat Pinang
          const sesiPanjat = panjatPinangManager.dapatkanSesi(sessionId);
          if (sesiPanjat) {
            const auth = pastikanHostSesi(socket, sesiPanjat.hostId);
            if (!auth.ok) {
              callback?.({ success: false, pesan: auth.pesan });
              return;
            }

            for (const pId of sesiPanjat.peserta.keys()) {
              const t = pendingNextSoalPanjatTimers.get(pId);
              if (t) {
                clearTimeout(t);
                pendingNextSoalPanjatTimers.delete(pId);
              }
            }

            const hasil = panjatPinangManager.akhiriPermainan(sessionId, true);
            await panjatPinangManager.simpanHasilAkhirKeDatabase(sessionId);

            const roomName = `session:${sesiPanjat.sessionId}`;
            io.to(roomName).emit('sesi:selesai', {
              game: 'panjat_pinang',
              hasil,
            });

            callback?.({ success: true, hasil });
            return;
          }

          // 0c. Sesi Makan Kerupuk Multiplayer
          const sesiKerupuk = kerupukMultiManager.dapatkanSesi(sessionId);
          if (sesiKerupuk) {
            const auth = pastikanHostSesi(socket, sesiKerupuk.hostId);
            if (!auth.ok) {
              callback?.({ success: false, pesan: auth.pesan });
              return;
            }

            for (const pId of sesiKerupuk.peserta.keys()) {
              const t = pendingNextSoalKerupukTimers.get(pId);
              if (t) {
                clearTimeout(t);
                pendingNextSoalKerupukTimers.delete(pId);
              }
            }

            const hasil = kerupukMultiManager.akhiriPermainan(sessionId, true);
            await kerupukMultiManager.simpanHasilKeDatabase(sessionId);

            const roomName = `session:${sesiKerupuk.sessionId}`;
            io.to(roomName).emit('sesi:selesai', {
              game: 'makan_kerupuk',
              hasil,
            });

            callback?.({ success: true, hasil });
            return;
          }

          // B. Sesi Tarik Tambang
          let sesiTarget = multiManager.dapatkanSesi(sessionId);
          if (!sesiTarget) {
            if (soloManager.dapatkanSesi(sessionId) || (await soloManager.pulihkanSesiDariDb(sessionId))) {
              callback?.({
                success: false,
                pesan: 'Mode Solo diakhiri langsung melalui layar guru.',
              });
              return;
            }
            sesiTarget = (await multiManager.pulihkanSesiDariDb(sessionId)) || undefined;
          }
          if (!sesiTarget) {
            callback?.({ success: false, pesan: 'Sesi tidak ditemukan.' });
            return;
          }

          const auth = pastikanHostSesi(socket, sesiTarget.hostId);
          if (!auth.ok) {
            callback?.({ success: false, pesan: auth.pesan });
            return;
          }

          const hasil = await akhiriMatchTarikTambang(io, sessionId, 'manual');
          callback?.({ success: true, hasil });
        } catch (err: any) {
          callback?.({ success: false, pesan: err.message || 'Gagal mengakhiri permainan.' });
        }
      }
    );

    // 6. Penanganan siswa atau host disconnect
    socket.on('disconnect', () => {
      // 0c. Cek apakah socket berasal dari peserta Makan Kerupuk Multiplayer
      const { sessionId: kerupukSessionId, pesertaId: kerupukPesertaId } =
        kerupukMultiManager.putusKoneksiPeserta(socket.id);
      if (kerupukSessionId) {
        if (kerupukPesertaId) {
          const t = pendingNextSoalKerupukTimers.get(kerupukPesertaId);
          if (t) {
            clearTimeout(t);
            pendingNextSoalKerupukTimers.delete(kerupukPesertaId);
          }
        }
        const sesi = kerupukMultiManager.dapatkanSesi(kerupukSessionId);
        if (sesi) {
          const roomName = `session:${sesi.sessionId}`;
          const leaderboard = kerupukMultiManager.dapatkanLeaderboard(sesi.sessionId);
          io.to(roomName).emit('lobi:update', {
            game: 'makan_kerupuk',
            totalPeserta: sesi.peserta.size,
            leaderboard,
            daftarPeserta: leaderboard,
          });
        }
        return;
      }

      // 0b. Cek apakah socket berasal dari peserta Balap Karung Challenge
      const { sessionId: balapSessionId, pesertaId: balapPesertaId } =
        balapKarungManager.putusKoneksiPeserta(socket.id);
      if (balapSessionId) {
        if (balapPesertaId) {
          const t = pendingNextSoalBalapTimers.get(balapPesertaId);
          if (t) {
            clearTimeout(t);
            pendingNextSoalBalapTimers.delete(balapPesertaId);
          }
        }
        const sesi = balapKarungManager.dapatkanSesi(balapSessionId);
        if (sesi) {
          const roomName = `session:${sesi.sessionId}`;
          const leaderboard = balapKarungManager.dapatkanLeaderboard(sesi.sessionId);
          io.to(roomName).emit('lobi:update', {
            game: 'balap_karung',
            totalPeserta: sesi.peserta.size,
            leaderboard,
            daftarPeserta: leaderboard,
          });
          if (sesi.status === 'jalan') {
            io.to(roomName).emit('balap:update', {
              leaderboard,
              totalPeserta: sesi.peserta.size,
            });
          }
        }
        return;
      }

      // 0. Cek apakah socket berasal dari peserta Panjat Pinang
      const { sessionId: panjatSessionId, pesertaId: panjatPesertaId } =
        panjatPinangManager.putusKoneksiPeserta(socket.id);
      if (panjatSessionId) {
        if (panjatPesertaId) {
          const t = pendingNextSoalPanjatTimers.get(panjatPesertaId);
          if (t) {
            clearTimeout(t);
            pendingNextSoalPanjatTimers.delete(panjatPesertaId);
          }
        }
        const sesi = panjatPinangManager.dapatkanSesi(panjatSessionId);
        if (sesi) {
          const roomName = `session:${sesi.sessionId}`;
          const leaderboard = panjatPinangManager.dapatkanLeaderboard(sesi.sessionId);
          io.to(roomName).emit('lobi:update', {
            game: 'panjat_pinang',
            totalPeserta: sesi.peserta.size,
            leaderboard,
            daftarPeserta: leaderboard,
          });
          if (sesi.status === 'jalan') {
            io.to(roomName).emit('panjat:update', {
              leaderboard,
              totalPeserta: sesi.peserta.size,
            });
          }
        }
        return;
      }

      // Cek apakah socket berasal dari peserta Tarik Tambang
      const dcTarik = multiManager.andaiTerputus(socket.id);
      if (dcTarik) {
        const { sesi } = dcTarik;
        const roomName = `session:${sesi.sessionId}`;
        const daftarPeserta = formatDaftarPesertaTarik(sesi);

        io.to(roomName).emit('lobi:update', {
          game: 'tarik_tambang',
          playMode: 'MULTIPLAYER',
          status: sesi.status,
          totalPeserta: sesi.peserta.size,
          daftarPeserta,
          config: sesi.config,
        });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// HELPER TARIK TAMBANG MULTIPLAYER (CONTINUOUS REAL-TIME MATCH)
// ---------------------------------------------------------------------------

function clearTarikStudentTimers(pesertaId: string): void {
  const nextTimer = pendingNextSoalTarikTimers.get(pesertaId);
  if (nextTimer) {
    clearTimeout(nextTimer);
    pendingNextSoalTarikTimers.delete(pesertaId);
  }
  const timeoutTimer = tarikQuestionTimeoutTimers.get(pesertaId);
  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
    tarikQuestionTimeoutTimers.delete(pesertaId);
  }
}

function armTarikQuestionTimeout(
  io: Server,
  sesi: SesiMultiplayerActive,
  pesertaId: string,
  presentationId: string,
  questionEndsAtMs: number
): void {
  const existing = tarikQuestionTimeoutTimers.get(pesertaId);
  if (existing) clearTimeout(existing);

  const delayMs = Math.max(1200, questionEndsAtMs - Date.now() + 900);
  const timer = setTimeout(() => {
    tarikQuestionTimeoutTimers.delete(pesertaId);
    const sesiCheck = multiManager.dapatkanSesi(sesi.sessionId);
    if (!sesiCheck || sesiCheck.status !== 'jalan') return;
    const pCheck = sesiCheck.peserta.get(pesertaId);
    if (!pCheck || pCheck.presentasiAktif?.presentationId !== presentationId) return;

    const targetSocket = pCheck.socketId ? io.sockets.sockets.get(pCheck.socketId) : undefined;
    void eksekusiJawabSiswaTarik(
      io,
      sesiCheck,
      pCheck,
      { presentationId, timedOut: true },
      targetSocket
    ).catch((err) => {
      console.error('[tarik_tambang timeout error]:', err);
    });
  }, delayMs);

  tarikQuestionTimeoutTimers.set(pesertaId, timer);
}

async function akhiriMatchTarikTambang(
  io: Server,
  sessionId: string,
  alasan: 'garis_menang' | 'waktu_habis' | 'manual'
) {
  const sesi = multiManager.dapatkanSesi(sessionId);
  if (!sesi) return null;

  bersihkanTimerSesi(sessionId);
  const hasil = multiManager.akhiriPermainan(sessionId, alasan);
  await multiManager.simpanHasilKeDatabase(sesi);

  io.to(`session:${sessionId}`).emit('sesi:selesai', {
    game: 'tarik_tambang',
    hasil,
  });

  return hasil;
}

function armTarikMatchTimer(io: Server, sesi: SesiMultiplayerActive): void {
  const existing = tarikMatchTimers.get(sesi.sessionId);
  if (existing) clearTimeout(existing);
  if (sesi.status !== 'jalan') return;

  const endMs =
    sesi.matchEndsAtMs || Date.now() + Math.max(30, sesi.config.durasiLombaDetik || 180) * 1000;
  const remainingMs = endMs - Date.now();
  if (remainingMs <= 0) {
    void akhiriMatchTarikTambang(io, sesi.sessionId, 'waktu_habis');
    return;
  }

  const timer = setTimeout(() => {
    tarikMatchTimers.delete(sesi.sessionId);
    void akhiriMatchTarikTambang(io, sesi.sessionId, 'waktu_habis');
  }, remainingMs);
  tarikMatchTimers.set(sesi.sessionId, timer);
}

async function eksekusiJawabSiswaTarik(
  io: Server,
  sesi: SesiMultiplayerActive,
  peserta: PesertaMulti,
  input: {
    presentationId?: string;
    choiceId?: string;
    jawaban?: string;
    timedOut?: boolean;
  },
  studentSocket?: Socket,
  callback?: (res: any) => void
): Promise<void> {
  clearTarikStudentTimers(peserta.id);

  const hasil = multiManager.prosesJawabanSiswa(sesi.sessionId, peserta.id, {
    presentationId: input.presentationId,
    choiceId: input.choiceId,
    jawabanDipilih: input.jawaban,
    timedOut: input.timedOut,
  });

  const feedbackPayload = {
    success: true,
    game: 'tarik_tambang' as const,
    benar: hasil.benar,
    timedOut: hasil.timedOut,
    slipQuote: hasil.slipQuote,
    deltaTali: hasil.deltaTali,
    taliPosition: hasil.taliPosition,
    skorMerah: hasil.skorMerah,
    skorPutih: hasil.skorPutih,
    jawabanBenarKode: hasil.jawabanBenarKode,
    jawabanBenarTeks: hasil.jawabanBenarTeks,
    penjelasan: hasil.penjelasan,
    pesertaUpdated: {
      id: hasil.peserta.id,
      nama: hasil.peserta.nama,
      tim: hasil.peserta.tim,
      totalBenar: hasil.peserta.totalBenar,
      totalSalah: hasil.peserta.totalSalah,
      jumlahJawab: hasil.peserta.jumlahJawab,
      streakSaatIni: hasil.peserta.streakSaatIni,
      streakTertinggi: hasil.peserta.streakTertinggi,
    },
  };

  callback?.(feedbackPayload);
  if (studentSocket) {
    studentSocket.emit('jawab:hasil', feedbackPayload);
  } else if (peserta.socketId) {
    io.to(peserta.socketId).emit('jawab:hasil', feedbackPayload);
  }

  const roomName = `session:${sesi.sessionId}`;
  io.to(roomName).emit('tali:update', {
    game: 'tarik_tambang',
    taliPosition: hasil.taliPosition,
    skorMerah: hasil.skorMerah,
    skorPutih: hasil.skorPutih,
    batasMenang: sesi.config.batasMenang,
    daftarPeserta: formatDaftarPesertaTarik(sesi),
    aksi: {
      side: hasil.tim === 'merah' ? 'l' : 'r',
      action: hasil.benar ? 'pull' : 'slip',
      pullerIdx: hasil.pullerIdx,
      playerId: hasil.peserta.id,
      playerName: hasil.peserta.nama,
      timedOut: hasil.timedOut,
      quote: hasil.slipQuote,
      deltaTali: hasil.deltaTali,
    },
    ...multiManager.serialisasiPowerUpInfo(sesi),
  });

  if (hasil.selesai) {
    bersihkanTimerSesi(sesi.sessionId);
    await multiManager.simpanHasilKeDatabase(sesi);
    io.to(roomName).emit('sesi:selesai', {
      game: 'tarik_tambang',
      hasil: hasil.hasil,
    });
    return;
  }

  const timer = setTimeout(() => {
    pendingNextSoalTarikTimers.delete(peserta.id);
    const sesiCheck = multiManager.dapatkanSesi(sesi.sessionId);
    if (!sesiCheck || sesiCheck.status !== 'jalan') return;
    const pNow = sesiCheck.peserta.get(peserta.id);
    if (!pNow) return;

    const nextSoal = multiManager.siapkanSoalBerikutnyaPeserta(sesiCheck.sessionId, pNow.id);
    if (nextSoal) {
      if (pNow.socketId) {
        io.to(pNow.socketId).emit('soal:tampil', nextSoal);
      }
      armTarikQuestionTimeout(
        io,
        sesiCheck,
        pNow.id,
        nextSoal.presentationId,
        nextSoal.endsAt
      );
    }
  }, 900);

  pendingNextSoalTarikTimers.set(peserta.id, timer);
}

async function mulaiMatchTarikTambang(io: Server, sesi: SesiMultiplayerActive): Promise<void> {
  if (sesi.status !== 'jalan') return;
  await sinkronkanRoomTimTarikTambang(io, sesi);
  armTarikMatchTimer(io, sesi);

  for (const p of sesi.peserta.values()) {
    const soalData =
      multiManager.dapatkanSoalAktifPeserta(sesi.sessionId, p.id) ||
      multiManager.siapkanSoalBerikutnyaPeserta(sesi.sessionId, p.id);
    if (!soalData) continue;
    if (p.socketId) {
      io.to(p.socketId).emit('soal:tampil', soalData);
    }
    armTarikQuestionTimeout(io, sesi, p.id, soalData.presentationId, soalData.endsAt);
  }
}
