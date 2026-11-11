import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { prisma } from '../db.js';
import { getVerifiedUserIdFromSocket } from './socketAuth.js';

// ============================================================================
// TIPE & STRUKTUR DATA DI MEMORI
// ============================================================================

export interface PesertaPapan {
  socketId: string;
  nama: string;
  peran: 'editor' | 'viewer';
  isOwner: boolean;
  token?: string;
  boardId: string;
}

interface BoardMemory {
  boardId: string;
  judul: string;
  versi: 1 | 2;
  pages: any[] | null;
  currentPageIndex: number;
  objs: Map<string, any>; // id -> Objek Kanvas pada halaman aktif / versi 1
  debounceTimer: NodeJS.Timeout | null;
}

// In-memory cache per papan tulis
const boardMemoryMap = new Map<string, BoardMemory>();

// In-memory tracking peserta per ruang papan: boardId -> Map<socketId, PesertaPapan>
const boardRooms = new Map<string, Map<string, PesertaPapan>>();

// Rate limiting sederhana: socketId -> { count: number, resetAt: number }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// ============================================================================
// VALIDASI ZOD OPERASI KANVAS
// ============================================================================

const canvasObjSchema = z.object({
  id: z.string().min(1).max(100),
  color: z.string().max(40).optional(),
  size: z.number().max(500).optional(),
  op: z.number().min(0).max(1).optional(),
  fill: z.string().max(40).nullable().optional(),
  type: z.enum(['stroke', 'shape', 'text', 'table', 'image', 'formula', 'conn']),
}).passthrough().refine((obj) => {
  // Batas keamanan: teks maksimal 20000 karakter, coretan maksimal 20000 titik
  if (obj.type === 'text') {
    const txt = (obj as any).text;
    if (typeof txt === 'string' && txt.length > 20000) return false;
  }
  if (obj.type === 'stroke') {
    const pts = (obj as any).pts;
    if (Array.isArray(pts) && pts.length > 20000) return false;
  }
  return true;
}, { message: 'Objek melebihi batas keamanan ukuran.' });

const opsSchema = z.object({
  boardId: z.string().min(1),
  tambah: z.array(canvasObjSchema).optional(),
  ubah: z.array(canvasObjSchema).optional(),
  hapus: z.array(z.string().min(1).max(100)).optional(),
});

// ============================================================================
// HELPER OTORISASI & DATABASE
// ============================================================================

function parseBoardDataSnapshot(rawData: unknown): {
  versi: 1 | 2;
  pages: any[] | null;
  currentPageIndex: number;
  objs: any[];
} {
  try {
    const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : (rawData as any);
    if (!parsed || typeof parsed !== 'object') {
      return { versi: 1, pages: null, currentPageIndex: 0, objs: [] };
    }

    if (parsed.versi === 2 && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
      const idx =
        typeof parsed.currentPageIndex === 'number' &&
        Number.isInteger(parsed.currentPageIndex) &&
        parsed.currentPageIndex >= 0 &&
        parsed.currentPageIndex < parsed.pages.length
          ? parsed.currentPageIndex
          : 0;
      const activeObjs = Array.isArray(parsed.objs)
        ? parsed.objs
        : Array.isArray(parsed.pages[idx]?.objs)
          ? parsed.pages[idx].objs
          : [];
      return {
        versi: 2,
        pages: parsed.pages,
        currentPageIndex: idx,
        objs: activeObjs,
      };
    }

    return {
      versi: 1,
      pages: null,
      currentPageIndex: 0,
      objs: Array.isArray(parsed.objs) ? parsed.objs : [],
    };
  } catch (err) {
    console.error('Gagal membaca data papan:', err);
    return { versi: 1, pages: null, currentPageIndex: 0, objs: [] };
  }
}

function buildBoardPayload(mem: BoardMemory): Record<string, any> {
  const objsArray = Array.from(mem.objs.values());
  if (mem.versi === 2 && Array.isArray(mem.pages) && mem.pages.length > 0) {
    const idx = Math.min(Math.max(0, mem.currentPageIndex), mem.pages.length - 1);
    const updatedPages = mem.pages.map((page, i) =>
      i === idx && page && typeof page === 'object' ? { ...page, objs: objsArray } : page
    );
    mem.pages = updatedPages;
    mem.currentPageIndex = idx;
    return {
      versi: 2,
      pages: updatedPages,
      currentPageIndex: idx,
      objs: objsArray,
    };
  }

  return {
    versi: 1,
    objs: objsArray,
  };
}

export function syncBoardMemoryFromData(boardId: string, rawData?: unknown, judul?: string): void {
  const mem = boardMemoryMap.get(boardId);
  if (!mem) return;

  if (mem.debounceTimer) {
    clearTimeout(mem.debounceTimer);
    mem.debounceTimer = null;
  }

  if (judul !== undefined) {
    mem.judul = judul;
  }

  if (rawData !== undefined) {
    const snapshot = parseBoardDataSnapshot(rawData);
    mem.versi = snapshot.versi;
    mem.pages = snapshot.pages;
    mem.currentPageIndex = snapshot.currentPageIndex;
    mem.objs.clear();
    for (const obj of snapshot.objs) {
      if (obj && obj.id) {
        mem.objs.set(obj.id, obj);
      }
    }
  }
}

async function getOrLoadBoard(boardId: string): Promise<BoardMemory | null> {
  const existing = boardMemoryMap.get(boardId);
  if (existing) return existing;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { id: true, judul: true, data: true },
  });

  if (!board) return null;

  const snapshot = parseBoardDataSnapshot(board.data);
  const objsMap = new Map<string, any>();
  for (const obj of snapshot.objs) {
    if (obj && obj.id) {
      objsMap.set(obj.id, obj);
    }
  }

  const mem: BoardMemory = {
    boardId,
    judul: board.judul,
    versi: snapshot.versi,
    pages: snapshot.pages,
    currentPageIndex: snapshot.currentPageIndex,
    objs: objsMap,
    debounceTimer: null,
  };

  boardMemoryMap.set(boardId, mem);
  return mem;
}

async function saveBoardToDatabase(boardId: string): Promise<void> {
  const mem = boardMemoryMap.get(boardId);
  if (!mem) return;

  const serialized = JSON.stringify(buildBoardPayload(mem));

  try {
    await prisma.board.update({
      where: { id: boardId },
      data: {
        data: serialized,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    console.error(`Gagal menyimpan data papan ${boardId} ke database:`, err);
  }
}

function broadcastPeserta(io: Server, boardId: string): void {
  const roomMap = boardRooms.get(boardId);
  const daftarPeserta = roomMap
    ? Array.from(roomMap.values()).map((p) => ({
        id: p.socketId,
        nama: p.nama,
        peran: p.peran,
      }))
    : [];

  io.to(`papan:${boardId}`).emit('papan:peserta', daftarPeserta);
}

// ============================================================================
// SOCKET HANDLER UTAMA
// ============================================================================

let boardIoServer: Server | null = null;

export function broadcastTokenRevocation(boardId: string, token: string): void {
  if (boardIoServer) {
    boardIoServer.to(`papan:${boardId}`).emit('papan:akses_dicabut', { token });
  }
}

export function setupBoardSocket(io: Server) {
  boardIoServer = io;
  io.on('connection', (socket: Socket) => {
    // ------------------------------------------------------------------------
    // 1. papan:gabung {boardId ATAU token, nama}
    // ------------------------------------------------------------------------
    socket.on(
      'papan:gabung',
      async (
        data: { boardId?: string; token?: string; nama: string; userId?: string },
        callback?: (res: any) => void
      ) => {
        try {
          const rawNama = (data?.nama || '').trim();
          if (rawNama.length < 2 || rawNama.length > 20) {
            callback?.({
              success: false,
              pesan: 'Nama panggilan harus antara 2 hingga 20 karakter.',
            });
            return;
          }

          let boardId = data?.boardId;
          const token = data?.token;
          let peran: 'editor' | 'viewer' = 'viewer';
          let isOwner = false;

          // A. Jalur Token Berbagi
          if (token) {
            const share = await prisma.boardShare.findUnique({
              where: { token },
              include: {
                board: { select: { id: true, judul: true } },
              },
            });

            if (!share || !share.aktif) {
              callback?.({
                success: false,
                pesan: 'Tautan berbagi tidak valid atau telah dicabut oleh pemilik papan.',
              });
              return;
            }

            boardId = share.boardId;
            peran = share.peran === 'editor' ? 'editor' : 'viewer';
          }
          // B. Jalur Pemilik (Login)
          else if (boardId) {
            const socketUserId = getVerifiedUserIdFromSocket(socket);
            if (!socketUserId) {
              callback?.({
                success: false,
                pesan: 'Akses ditolak: Anda harus login untuk membuka papan ini tanpa tautan.',
              });
              return;
            }

            const board = await prisma.board.findUnique({
              where: { id: boardId },
              select: { ownerId: true },
            });

            if (!board || board.ownerId !== socketUserId) {
              callback?.({
                success: false,
                pesan: 'Akses ditolak: Anda bukan pemilik papan ini.',
              });
              return;
            }

            peran = 'editor';
            isOwner = true;
          } else {
            callback?.({
              success: false,
              pesan: 'Parameter boardId atau token wajib disertakan.',
            });
            return;
          }

          // Cek batas maksimal peserta (40 peserta)
          if (!boardRooms.has(boardId)) {
            boardRooms.set(boardId, new Map());
          }
          const roomMap = boardRooms.get(boardId)!;

          if (roomMap.size >= 40 && !roomMap.has(socket.id)) {
            callback?.({
              success: false,
              pesan: 'Papan kolaborasi telah mencapai kapasitas maksimal (40 peserta).',
            });
            return;
          }

          // Masuk room Socket.IO: format papan:{id}
          const roomName = `papan:${boardId}`;
          socket.join(roomName);

          roomMap.set(socket.id, {
            socketId: socket.id,
            nama: rawNama,
            peran,
            isOwner,
            token,
            boardId,
          });

          // Muat atau ambil memori papan
          const mem = await getOrLoadBoard(boardId);
          if (!mem) {
            callback?.({
              success: false,
              pesan: 'Papan tulis tidak ditemukan di database.',
            });
            return;
          }

          // Siarkan daftar peserta ke semua orang di room
          broadcastPeserta(io, boardId);

          // Kembalikan callback sukses dengan snapshot data kanvas dan peran
          callback?.({
            success: true,
            boardId,
            judul: mem.judul,
            peran,
            isOwner,
            data: buildBoardPayload(mem),
          });
        } catch (err: any) {
          console.error('Error pada papan:gabung:', err);
          callback?.({
            success: false,
            pesan: err.message || 'Terjadi kesalahan saat bergabung ke papan.',
          });
        }
      }
    );

    // ------------------------------------------------------------------------
    // 2. papan:ubah {boardId, tambah, ubah, hapus}
    // ------------------------------------------------------------------------
    socket.on('papan:ubah', async (data: any, callback?: (res: any) => void) => {
      try {
        // Rate limiting: max 50 pesan per detik
        const now = Date.now();
        const rl = rateLimitMap.get(socket.id) || { count: 0, resetAt: now + 1000 };
        if (now > rl.resetAt) {
          rl.count = 1;
          rl.resetAt = now + 1000;
        } else {
          rl.count++;
          if (rl.count > 50) {
            callback?.({ success: false, pesan: 'Pengiriman perubahan terlalu cepat (rate limit).' });
            return;
          }
        }
        rateLimitMap.set(socket.id, rl);

        // Validasi payload dengan Zod
        const parsed = opsSchema.parse(data);
        const { boardId, tambah, ubah, hapus } = parsed;

        const roomMap = boardRooms.get(boardId);
        const peserta = roomMap?.get(socket.id);

        if (!peserta) {
          callback?.({ success: false, pesan: 'Anda belum bergabung di ruang papan ini.' });
          return;
        }

        // KEAMANAN KETAT: Server MENOLAK jika peran viewer
        if (peserta.peran === 'viewer') {
          callback?.({
            success: false,
            pesan: 'Akses ditolak: Viewer hanya dapat melihat dan tidak diizinkan mengubah kanvas.',
          });
          return;
        }

        const mem = await getOrLoadBoard(boardId);
        if (!mem) {
          callback?.({ success: false, pesan: 'Papan tulis tidak ditemukan.' });
          return;
        }

        // Aturan konflik: yang terakhir menulis menang, per objek berdasarkan id
        if (hapus && hapus.length > 0) {
          for (const id of hapus) {
            mem.objs.delete(id);
          }
        }

        if (ubah && ubah.length > 0) {
          for (const obj of ubah) {
            mem.objs.set(obj.id, obj);
          }
        }

        if (tambah && tambah.length > 0) {
          for (const obj of tambah) {
            mem.objs.set(obj.id, obj);
          }
        }

        // Siarkan perubahan ke klien lain di room papan:{id} (bukan ke pengirim)
        const roomName = `papan:${boardId}`;
        socket.to(roomName).emit('papan:ubah', {
          dariSocketId: socket.id,
          tambah: tambah || [],
          ubah: ubah || [],
          hapus: hapus || [],
        });

        // Debounce simpan ke database 2 detik setelah perubahan
        if (mem.debounceTimer) {
          clearTimeout(mem.debounceTimer);
        }
        mem.debounceTimer = setTimeout(() => {
          mem.debounceTimer = null;
          saveBoardToDatabase(boardId);
        }, 2000);

        callback?.({ success: true });
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          callback?.({ success: false, pesan: err.issues[0]?.message || 'Format perubahan tidak valid.' });
          return;
        }
        callback?.({ success: false, pesan: err.message || 'Gagal menerapkan perubahan kanvas.' });
      }
    });

    // ------------------------------------------------------------------------
    // 2b. papan:coret_live {boardId, stroke} (Streaming coretan langsung saat menggambar)
    // ------------------------------------------------------------------------
    socket.on('papan:coret_live', (data: { boardId?: string; stroke?: any }) => {
      try {
        if (!data?.boardId || !data?.stroke) return;
        const roomMap = boardRooms.get(data.boardId);
        const peserta = roomMap?.get(socket.id);
        if (!peserta || peserta.peran === 'viewer') return;

        // Siarkan langsung ke peserta lain di room (volatil, tidak disimpan DB)
        socket.to(`papan:${data.boardId}`).emit('papan:coret_live', {
          socketId: socket.id,
          dariSocketId: socket.id,
          stroke: data.stroke,
        });
      } catch (err) {
        // abaikan
      }
    });

    // ------------------------------------------------------------------------
    // 2c. papan:coret_selesai {boardId}
    // ------------------------------------------------------------------------
    socket.on('papan:coret_selesai', (data: { boardId?: string }) => {
      try {
        if (!data?.boardId) return;
        socket.to(`papan:${data.boardId}`).emit('papan:coret_selesai', {
          socketId: socket.id,
          dariSocketId: socket.id,
        });
      } catch (err) {
        // abaikan
      }
    });

    // ------------------------------------------------------------------------
    // 2d. papan:geser_live {boardId, objs} (Streaming posisi objek yang sedang digeser)
    // ------------------------------------------------------------------------
    socket.on('papan:geser_live', (data: { boardId?: string; objs?: any[] }) => {
      try {
        if (!data?.boardId || !data?.objs) return;
        const roomMap = boardRooms.get(data.boardId);
        const peserta = roomMap?.get(socket.id);
        if (!peserta || peserta.peran === 'viewer') return;

        socket.to(`papan:${data.boardId}`).emit('papan:geser_live', {
          socketId: socket.id,
          dariSocketId: socket.id,
          objs: data.objs,
        });
      } catch (err) {
        // abaikan
      }
    });

    // ------------------------------------------------------------------------
    // 2e. papan:geser_selesai {boardId}
    // ------------------------------------------------------------------------
    socket.on('papan:geser_selesai', (data: { boardId?: string }) => {
      try {
        if (!data?.boardId) return;
        socket.to(`papan:${data.boardId}`).emit('papan:geser_selesai', {
          socketId: socket.id,
          dariSocketId: socket.id,
        });
      } catch (err) {
        // abaikan
      }
    });

    // ------------------------------------------------------------------------
    // 2f. papan:hapus_live {boardId, removedIds, addedObjs} (Streaming pratinjau pemotongan/penghapusan)
    // ------------------------------------------------------------------------
    socket.on('papan:hapus_live', (data: { boardId?: string; removedIds?: string[]; addedObjs?: any[] }) => {
      try {
        if (!data?.boardId) return;
        const roomMap = boardRooms.get(data.boardId);
        const peserta = roomMap?.get(socket.id);
        if (!peserta || peserta.peran === 'viewer') return;

        socket.to(`papan:${data.boardId}`).emit('papan:hapus_live', {
          socketId: socket.id,
          dariSocketId: socket.id,
          removedIds: data.removedIds || [],
          addedObjs: data.addedObjs || [],
        });
      } catch (err) {
        // abaikan
      }
    });

    // ------------------------------------------------------------------------
    // 2g. papan:hapus_selesai {boardId}
    // ------------------------------------------------------------------------
    socket.on('papan:hapus_selesai', (data: { boardId?: string }) => {
      try {
        if (!data?.boardId) return;
        socket.to(`papan:${data.boardId}`).emit('papan:hapus_selesai', {
          socketId: socket.id,
          dariSocketId: socket.id,
        });
      } catch (err) {
        // abaikan
      }
    });

    // ------------------------------------------------------------------------
    // 3. papan:cabut_akses {boardId, token}
    // ------------------------------------------------------------------------
    socket.on(
      'papan:cabut_akses',
      async (
        data: { boardId?: string; token?: string },
        callback?: (res: { success: boolean; pesan?: string }) => void
      ) => {
        try {
          if (!data?.boardId || !data?.token) {
            callback?.({ success: false, pesan: 'Parameter boardId dan token wajib diisi.' });
            return;
          }

          const userId = getVerifiedUserIdFromSocket(socket);
          if (!userId) {
            callback?.({
              success: false,
              pesan: 'Akses ditolak: Anda harus login untuk mencabut tautan berbagi.',
            });
            return;
          }

          const board = await prisma.board.findUnique({
            where: { id: data.boardId },
            select: { ownerId: true },
          });

          if (!board) {
            callback?.({ success: false, pesan: 'Papan tulis tidak ditemukan.' });
            return;
          }

          if (board.ownerId !== userId) {
            callback?.({
              success: false,
              pesan: 'Akses ditolak: hanya pemilik papan yang dapat mencabut tautan berbagi.',
            });
            return;
          }

          await prisma.boardShare.updateMany({
            where: { boardId: data.boardId, token: data.token },
            data: { aktif: false },
          });
          broadcastTokenRevocation(data.boardId, data.token);
          callback?.({ success: true });
        } catch (err) {
          console.error('Gagal mencabut akses via socket:', err);
          callback?.({ success: false, pesan: 'Gagal mencabut akses via socket.' });
        }
      }
    );

    // ------------------------------------------------------------------------
    // 4. Disconnect: bersihkan peserta & simpan jika peserta terakhir keluar
    // ------------------------------------------------------------------------
    socket.on('disconnect', async () => {
      rateLimitMap.delete(socket.id);

      for (const [boardId, roomMap] of boardRooms.entries()) {
        if (roomMap.has(socket.id)) {
          roomMap.delete(socket.id);

          // Siarkan pembaruan peserta
          broadcastPeserta(io, boardId);

          // Jika peserta terakhir keluar: segera simpan keadaan papan ke database
          if (roomMap.size === 0) {
            boardRooms.delete(boardId);

            const mem = boardMemoryMap.get(boardId);
            if (mem) {
              if (mem.debounceTimer) {
                clearTimeout(mem.debounceTimer);
                mem.debounceTimer = null;
              }
              await saveBoardToDatabase(boardId);
              // Bersihkan cache memori papan saat tidak ada peserta
              boardMemoryMap.delete(boardId);
            }
          }
          break;
        }
      }
    });
  });
}
