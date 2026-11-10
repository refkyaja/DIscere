import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { multiManager, SesiMultiplayerActive } from '../games/multiManager.js';
import { panjatPinangManager } from '../games/panjatPinangManager.js';
import { PesertaPanjatState } from '../games/panjatPinang.js';
import { balapKarungManager } from '../games/balapKarungManager.js';
import { PesertaBalapKarungState } from '../games/balapKarung.js';
import { kerupukMultiManager } from '../games/kerupukMultiManager.js';
import { kerupukManager } from '../games/kerupukManager.js';
import { prisma } from '../db.js';

const pendingNextSoalPanjatTimers = new Map<string, NodeJS.Timeout>();
const pendingNextSoalBalapTimers = new Map<string, NodeJS.Timeout>();
const pendingNextSoalKerupukTimers = new Map<string, NodeJS.Timeout>();

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
});

function sanitizePesertaBalap(p: PesertaBalapKarungState, targetJarak: number) {
  const totalJawab = p.totalBenar + p.totalSalah;
  return {
    id: p.id,
    nama: p.nama,
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

export function setupMultiplayerSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    // 1. Siswa atau Peserta bergabung ke room sesi (Tarik Tambang, Makan Kerupuk, atau Panjat Pinang)
    socket.on(
      'sesi:gabung',
      async (
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
          const sesiTarikCek =
            !sesiBalapCek && !sesiPanjatCek && !sesiKerupukCek
              ? multiManager.dapatkanSesiDariToken(token)
              : undefined;

          // Hanya query database 1 kali jika token belum termuat di memori server
          if (!sesiBalapCek && !sesiPanjatCek && !sesiKerupukCek && !sesiTarikCek) {
            const dbSesi = await prisma.session.findFirst({
              where: { token, status: { in: ['lobi', 'jalan'] } },
              include: { template: { select: { game: true } } },
            });
            if (dbSesi?.template.game === 'makan_kerupuk' && dbSesi.mode === 'solo') {
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
              totalSoal: sesi.totalSoal,
              soalAktif: soalAktifData,
            });

            io.to(roomName).emit('lobi:update', {
              game: 'balap_karung',
              totalPeserta: sesi.peserta.size,
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
            pesertaId
          );

          // Masuk ke room socket sesi
          const roomName = `session:${sesi.sessionId}`;
          socket.join(roomName);

          const daftarPeserta = Array.from(sesi.peserta.values()).map((p) => ({
            id: p.id,
            nama: p.nama,
            tim: p.tim,
            connected: p.connected,
          }));

          // Balas ke siswa
          const soalAktif =
            sesi.status === 'jalan' ? sesi.questions[sesi.currentQuestionIndex] : null;

          const sudahJawabSoalAktif =
            soalAktif && sesi.jawabanPerSoal.get(soalAktif.id)?.has(peserta.id);

          callback?.({
            success: true,
            game: 'tarik_tambang',
            isReconnect,
            pesertaId: peserta.id,
            sessionId: sesi.sessionId,
            templateJudul: sesi.templateJudul,
            status: sesi.status,
            tim: peserta.tim,
            taliPosition: sesi.taliPosition,
            skorMerah: sesi.skorMerah,
            skorPutih: sesi.skorPutih,
            currentQuestionIndex: sesi.currentQuestionIndex,
            totalSoal: sesi.totalSoal,
            soalAktif: soalAktif
              ? {
                  id: soalAktif.id,
                  nomorSoal: sesi.currentQuestionIndex + 1,
                  totalSoal: sesi.totalSoal,
                  teks: soalAktif.teks,
                  opsiA: soalAktif.opsiA,
                  opsiB: soalAktif.opsiB,
                  opsiC: soalAktif.opsiC,
                  endsAt: sesi.soalBerakhirPada,
                }
              : null,
            sudahJawabSoalAktif: Boolean(sudahJawabSoalAktif),
          });

          // Siarkan pembaruan lobi ke semua orang di room (host & siswa)
          io.to(roomName).emit('lobi:update', {
            game: 'tarik_tambang',
            totalPeserta: sesi.peserta.size,
            daftarPeserta,
          });
        } catch (err: any) {
          callback?.({ success: false, pesan: err.message || 'Gagal bergabung ke sesi.' });
        }
      }
    );

    // 2. Host (Guru) bergabung dan mengikat socket ke room sesi
    socket.on('sesi:host_join', async (data: { sessionId: string }) => {
      const { sessionId } = data || {};
      if (!sessionId) return;

      if (kerupukManager.dapatkanSesi(sessionId)) {
        socket.emit('sesi:error', {
          pesan: 'Mode Solo Makan Kerupuk dijalankan lokal di perangkat guru tanpa ruang Socket.IO.',
        });
        return;
      }

      // 0b. Cek sesi Balap Karung Challenge
      let sesiBalap = balapKarungManager.dapatkanSesi(sessionId);
      if (!sesiBalap) {
        sesiBalap = (await balapKarungManager.pulihkanSesiDariDb(sessionId)) || undefined;
      }
      if (sesiBalap) {
        sesiBalap.hostSocketId = socket.id;
        const roomName = `session:${sesiBalap.sessionId}`;
        socket.join(roomName);

        const leaderboard = balapKarungManager.dapatkanLeaderboard(sesiBalap.sessionId);
        socket.emit('lobi:update', {
          game: 'balap_karung',
          totalPeserta: sesiBalap.peserta.size,
          leaderboard,
          daftarPeserta: leaderboard,
        });
        socket.emit('balap:update', {
          leaderboard,
          totalPeserta: sesiBalap.peserta.size,
        });
        return;
      }

      // 0. Cek sesi Panjat Pinang
      let sesiPanjat = panjatPinangManager.dapatkanSesi(sessionId);
      if (!sesiPanjat) {
        sesiPanjat = (await panjatPinangManager.pulihkanSesiDariDb(sessionId)) || undefined;
      }
      if (sesiPanjat) {
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
        return;
      }

      // 0c. Sesi Makan Kerupuk Multiplayer
      let sesiKerupuk = kerupukMultiManager.dapatkanSesi(sessionId);
      if (!sesiKerupuk) {
        sesiKerupuk = (await kerupukMultiManager.pulihkanSesiDariDb(sessionId)) || undefined;
      }
      if (sesiKerupuk) {
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
        return;
      }

      // B. Sesi Tarik Tambang
      const sesi = multiManager.dapatkanSesi(sessionId);
      if (sesi) {
        sesi.hostSocketId = socket.id;
        const roomName = `session:${sesi.sessionId}`;
        socket.join(roomName);

        const daftarPeserta = Array.from(sesi.peserta.values()).map((p) => ({
          id: p.id,
          nama: p.nama,
          tim: p.tim,
          connected: p.connected,
        }));

        socket.emit('lobi:update', {
          game: 'tarik_tambang',
          totalPeserta: sesi.peserta.size,
          daftarPeserta,
        });
      }
    });

    // 3. Guru menekan tombol "Mulai Permainan"
    socket.on(
      'sesi:mulai',
      async (
        data: { sessionId: string; hostId?: string },
        callback?: (res: any) => void
      ) => {
        try {
          const { sessionId } = data || {};

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
            const isStudentSocket = Array.from(sesiBalapTarget.peserta.values()).some(
              (p) => p.socketId === socket.id
            );
            if (isStudentSocket) {
              callback?.({ success: false, pesan: 'Hanya guru yang dapat memulai permainan.' });
              return;
            }
            if (data?.hostId && data.hostId !== sesiBalapTarget.hostId) {
              callback?.({ success: false, pesan: 'Anda bukan pemilik sesi ini.' });
              return;
            }

            const sesi = balapKarungManager.mulaiPermainan(sessionId, sesiBalapTarget.hostId);
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
            io.to(roomName).emit('game:mulai', {
              game: 'balap_karung',
              totalSoal: sesi.totalSoal,
              config: sesi.config,
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
            const isStudentSocket = Array.from(sesiPanjatTarget.peserta.values()).some(
              (p) => p.socketId === socket.id
            );
            if (isStudentSocket) {
              callback?.({ success: false, pesan: 'Hanya guru yang dapat memulai permainan.' });
              return;
            }
            if (data?.hostId && data.hostId !== sesiPanjatTarget.hostId) {
              callback?.({ success: false, pesan: 'Anda bukan pemilik sesi ini.' });
              return;
            }

            const sesi = panjatPinangManager.mulaiPermainan(sessionId, sesiPanjatTarget.hostId);
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
            const isStudentSocket = Array.from(sesiKerupukTarget.peserta.values()).some(
              (p) => p.socketId === socket.id
            );
            if (isStudentSocket) {
              callback?.({ success: false, pesan: 'Hanya guru host yang dapat memulai lomba.' });
              return;
            }
            if (data?.hostId && data.hostId !== sesiKerupukTarget.hostId) {
              callback?.({ success: false, pesan: 'Identitas host tidak sesuai dengan pembuat sesi.' });
              return;
            }

            const sesi = kerupukMultiManager.mulaiPermainan(sessionId, sesiKerupukTarget.hostId);
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

          // B. Sesi Tarik Tambang
          const sesiTarget = multiManager.dapatkanSesi(sessionId);
          if (!sesiTarget) {
            callback?.({ success: false, pesan: 'Sesi tidak ditemukan.' });
            return;
          }

          const sesi = multiManager.mulaiPermainan(sessionId, sesiTarget.hostId);
          const roomName = `session:${sesi.sessionId}`;

          // Update status di database menjadi 'jalan'
          await prisma.session.update({
            where: { id: sessionId },
            data: { status: 'jalan', mulaiPada: new Date() },
          });

          // Siarkan pembagian tim ke semua peserta
          const daftarPeserta = Array.from(sesi.peserta.values()).map((p) => ({
            id: p.id,
            nama: p.nama,
            tim: p.tim,
            connected: p.connected,
          }));

          io.to(roomName).emit('teams_assigned', {
            daftarPeserta,
          });

          // Mulai soal pertama (index 0)
          mulaiSoalIndex(io, sesi, 0);

          callback?.({ success: true, pesan: 'Permainan dimulai!' });
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
          questionId?: string;
          id?: string;
          jawaban: string;
        },
        callback?: (res: any) => void
      ) => {
        try {
          const { sessionId, pesertaId, jawaban } = data || {};
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
            });

            const roomName = `session:${sesiBalap.sessionId}`;
            const pUpdated = hasil.hasilJawaban.pesertaUpdated;
            const sanitizedPemain = sanitizePesertaBalap(pUpdated, sesiBalap.config.targetJarak);

            const feedbackPayload = {
              success: true,
              game: 'balap_karung',
              benar: hasil.hasilJawaban.benar,
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

            // Kirim event jatuh eksplisit ke siswa ketika keseimbangan menyentuh 0%
            if (hasil.hasilJawaban.terjatuh) {
              socket.emit('pemain:jatuh', {
                game: 'balap_karung',
                pesertaId: pUpdated.id,
                penaltiJarakJatuh: hasil.hasilJawaban.penaltiJatuhJarak,
                perisaiDigunakan: hasil.hasilJawaban.perisaiDigunakan,
                jarakBaru: hasil.hasilJawaban.jarakBaru,
                keseimbanganBaru: hasil.hasilJawaban.keseimbanganBaru,
                jumlahJatuh: pUpdated.jumlahJatuh,
                pesan: hasil.hasilJawaban.perisaiDigunakan
                  ? 'Perisai melindungimu saat keseimbangan habis!'
                  : `Keseimbangan habis! Kamu terjatuh dan mundur ${hasil.hasilJawaban.penaltiJatuhJarak} m.`,
              });
            }

            io.to(roomName).emit('balap:update', {
              leaderboard: hasil.leaderboard,
              totalPeserta: sesiBalap.peserta.size,
              terakhirAksi: {
                pesertaId: pUpdated.id,
                nama: pUpdated.nama,
                benar: hasil.hasilJawaban.benar,
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

            if (hasil.pemainSelesai) {
              socket.emit('pemain:selesai', {
                game: 'balap_karung',
                peserta: sanitizedPemain,
                pesan: `Selamat! Kamu berhasil melintasi garis finis ${sesiBalap.config.targetJarak} meter!`,
              });
              return;
            }

            const timer = setTimeout(() => {
              pendingNextSoalBalapTimers.delete(bk.pesertaId);
              const sesiCheck = balapKarungManager.dapatkanSesi(bk.sessionId);
              if (!sesiCheck || sesiCheck.status !== 'jalan') return;
              const nextSoal = balapKarungManager.dapatkanSoalAktifPeserta(
                bk.sessionId,
                bk.pesertaId
              );
              if (nextSoal) {
                socket.emit('soal:tampil', {
                  game: 'balap_karung',
                  ...nextSoal,
                });
              }
            }, 1400);
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

          // B. Sesi Tarik Tambang
          const sesi = multiManager.dapatkanSesi(sessionId);
          if (!sesi) return;

          const targetQuestionId =
            rawQId && rawQId !== 'undefined' && rawQId !== 'null'
              ? rawQId
              : sesi.questions[sesi.currentQuestionIndex]?.id;

          const hasil = multiManager.prosesJawabanSiswa(
            sessionId,
            pesertaId,
            targetQuestionId,
            jawaban
          );

          const roomName = `session:${sesi.sessionId}`;

          const feedbackPayload = {
            success: true,
            game: 'tarik_tambang',
            benar: hasil.benar,
            jawabanBenar: hasil.jawabanBenar,
            penjelasan: hasil.penjelasan,
          };

          // Kirim feedback personal ke siswa yang menjawab
          callback?.(feedbackPayload);
          // Siarkan event langsung personal ke socket siswa (kompatibilitas penuh)
          socket.emit('jawab:hasil', feedbackPayload);

          const mapJawaban = sesi.jawabanPerSoal.get(targetQuestionId);
          const answeredCount = mapJawaban ? mapJawaban.size : 0;
          const activeCount = Array.from(sesi.peserta.values()).filter((p) => p.connected).length;

          // Siarkan pergerakan tali & skor terbaru ke seluruh ruangan
          io.to(roomName).emit('tali:update', {
            taliPosition: hasil.taliPosition,
            skorMerah: hasil.skorMerah,
            skorPutih: hasil.skorPutih,
            answeredCount,
            totalCount: Math.max(activeCount, sesi.peserta.size),
          });

          // Jika tali mencapai ujung atau semua siswa sudah menjawab
          if (hasil.gameSelesai || hasil.semuaSelesai) {
            if (sesi.timerHandle) {
              clearTimeout(sesi.timerHandle);
              sesi.timerHandle = undefined;
            }
            // Eksekusi penutupan soal secara aman
            tutupSoalAktif(io, sesi);
          }
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
      });

    // 5. Guru mengakhiri permainan secara manual
    socket.on(
      'sesi:akhiri_manual',
      async (data: { sessionId: string; hostId?: string }, callback?: (res: any) => void) => {
        try {
          const { sessionId } = data || {};

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
            const isStudentSocket = Array.from(sesiBalap.peserta.values()).some(
              (p) => p.socketId === socket.id
            );
            if (isStudentSocket) {
              callback?.({ success: false, pesan: 'Hanya guru yang dapat mengakhiri permainan.' });
              return;
            }
            if (data?.hostId && data.hostId !== sesiBalap.hostId) {
              callback?.({ success: false, pesan: 'Anda bukan pemilik sesi ini.' });
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
            const isStudentSocket = Array.from(sesiPanjat.peserta.values()).some(
              (p) => p.socketId === socket.id
            );
            if (isStudentSocket) {
              callback?.({ success: false, pesan: 'Hanya guru yang dapat mengakhiri permainan.' });
              return;
            }
            if (data?.hostId && data.hostId !== sesiPanjat.hostId) {
              callback?.({ success: false, pesan: 'Anda bukan pemilik sesi ini.' });
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
            const isStudentSocket = Array.from(sesiKerupuk.peserta.values()).some(
              (p) => p.socketId === socket.id
            );
            if (isStudentSocket) {
              callback?.({ success: false, pesan: 'Siswa tidak berwenang mengakhiri sesi.' });
              return;
            }
            if (data?.hostId && data.hostId !== sesiKerupuk.hostId) {
              callback?.({ success: false, pesan: 'Identitas host tidak valid.' });
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
          const sesi = multiManager.akhiriPermainan(sessionId);
          await simpanHasilMultiKeDatabase(sesi);

          const roomName = `session:${sesi.sessionId}`;
          io.to(roomName).emit('sesi:selesai', {
            game: 'tarik_tambang',
            hasil: sesi.hasil,
          });

          callback?.({ success: true, hasil: sesi.hasil });
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
      const { sessionId } = multiManager.putusKoneksiPeserta(socket.id);
      if (sessionId) {
        const sesi = multiManager.dapatkanSesi(sessionId);
        if (sesi) {
          const roomName = `session:${sesi.sessionId}`;
          const daftarPeserta = Array.from(sesi.peserta.values()).map((p) => ({
            id: p.id,
            nama: p.nama,
            tim: p.tim,
            connected: p.connected,
          }));

          io.to(roomName).emit('lobi:update', {
            game: 'tarik_tambang',
            totalPeserta: sesi.peserta.size,
            daftarPeserta,
          });
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// HELPER TARIK TAMBANG MULTIPLAYER
// ---------------------------------------------------------------------------

/**
 * Menyiapkan dan menyiarkan soal aktif beserta timer server 15 detik
 */
function mulaiSoalIndex(io: Server, sesi: SesiMultiplayerActive, index: number) {
  sesi.currentQuestionIndex = index;
  const soalAktif = sesi.questions[index];
  if (!soalAktif) return;

  const { soalBerakhirPada } = multiManager.mulaiTimerSoal(sesi.sessionId, 15);

  const roomName = `session:${sesi.sessionId}`;
  const totalPesertaAktif = Array.from(sesi.peserta.values()).filter((p) => p.connected).length;

  io.to(roomName).emit('soal:tampil', {
    game: 'tarik_tambang',
    questionIndex: index,
    nomorSoal: index + 1,
    totalSoal: sesi.totalSoal,
    id: soalAktif.id,
    questionId: soalAktif.id,
    teks: soalAktif.teks,
    opsiA: soalAktif.opsiA,
    opsiB: soalAktif.opsiB,
    opsiC: soalAktif.opsiC,
    endsAt: soalBerakhirPada,
    duration: 15,
    answeredCount: 0,
    totalCount: Math.max(totalPesertaAktif, sesi.peserta.size),
  });

  // Pasang timer 15 detik di server
  sesi.timerHandle = setTimeout(() => {
    tutupSoalAktif(io, sesi);
  }, 15000);
}

/**
 * Menutup soal aktif, mengecek kondisi kemenangan, dan melanjutkan atau mengakhiri
 */
async function tutupSoalAktif(io: Server, sesi: SesiMultiplayerActive) {
  if (sesi.timerHandle) {
    clearTimeout(sesi.timerHandle);
    sesi.timerHandle = undefined;
  }

  const hasilTutup = multiManager.selesaikanSoalAktif(sesi.sessionId);
  const roomName = `session:${sesi.sessionId}`;

  // Hitung statistik jawaban pada soal ini
  const mapJawaban = sesi.jawabanPerSoal.get(sesi.questions[hasilTutup.questionIndex]?.id);
  let benarCount = 0;
  let salahCount = 0;
  if (mapJawaban) {
    for (const j of mapJawaban.values()) {
      if (j.benar) benarCount++;
      else salahCount++;
    }
  }

  // Beri tahu seluruh pemain bahwa soal telah selesai
  io.to(roomName).emit('soal:selesai', {
    game: 'tarik_tambang',
    questionIndex: hasilTutup.questionIndex,
    jawabanBenar: hasilTutup.jawabanBenar,
    penjelasan: hasilTutup.penjelasan,
    taliPosition: hasilTutup.posisiTali,
    skorMerah: hasilTutup.skorMerah,
    skorPutih: hasilTutup.skorPutih,
    isGameFinished: hasilTutup.isGameFinished,
    stats: {
      benar: benarCount,
      salah: salahCount,
      tidakJawab: Math.max(0, sesi.peserta.size - (benarCount + salahCount)),
    },
  });

  if (hasilTutup.isGameFinished) {
    await simpanHasilMultiKeDatabase(sesi);
    io.to(roomName).emit('sesi:selesai', {
      game: 'tarik_tambang',
      hasil: sesi.hasil,
    });
  } else {
    // Intermission 3 detik agar siswa membaca pembahasan dan host melihat rekap
    sesi.intermissionHandle = setTimeout(() => {
      const nextIndex = multiManager.lanjutKeSoalBerikutnya(sesi.sessionId);
      mulaiSoalIndex(io, sesi, nextIndex);
    }, 3000);
  }
}

/**
 * Menyimpan hasil akhir permainan multiplayer ke database via Prisma transaksi
 */
export async function simpanHasilMultiKeDatabase(sesi: SesiMultiplayerActive) {
  const hasil = sesi.hasil;
  if (!hasil) return;

  await prisma.$transaction(async (tx) => {
    // 1. Update status sesi
    await tx.session.update({
      where: { id: sesi.sessionId },
      data: {
        status: 'selesai',
        selesaiPada: new Date(),
      },
    });

    // 2. Simpan atau perbarui SessionResult
    await tx.sessionResult.upsert({
      where: { sessionId: sesi.sessionId },
      update: {
        timMenang: hasil.timMenang,
        posisiAkhir: hasil.posisiAkhir,
        skorMerah: hasil.skorMerah,
        skorPutih: hasil.skorPutih,
      },
      create: {
        sessionId: sesi.sessionId,
        timMenang: hasil.timMenang,
        posisiAkhir: hasil.posisiAkhir,
        skorMerah: hasil.skorMerah,
        skorPutih: hasil.skorPutih,
      },
    });

    // 3. Simpan question_stats per soal
    await tx.questionStat.deleteMany({
      where: { sessionId: sesi.sessionId },
    });

    for (const soal of sesi.questions) {
      const mapJawaban = sesi.jawabanPerSoal.get(soal.id);
      let jBenar = 0;
      let jSalah = 0;

      if (mapJawaban) {
        for (const j of mapJawaban.values()) {
          if (j.benar) jBenar++;
          else jSalah++;
        }
      }

      await tx.questionStat.create({
        data: {
          sessionId: sesi.sessionId,
          questionId: soal.id,
          jumlahBenar: jBenar,
          jumlahSalah: jSalah,
        },
      });
    }
  });
}
