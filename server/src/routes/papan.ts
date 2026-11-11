import express, { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { broadcastTokenRevocation, syncBoardMemoryFromData } from '../realtime/papan.js';
import { getNetworkBaseUrl } from '../utils/network.js';

export const papanRouter = Router();

// Batas body JSON khusus rute papan 8 MB
papanRouter.use(express.json({ limit: '8mb' }));

// ============================================================================
// 1. RUTE PUBLIK: Validasi Token Berbagi Papan (Viewer / Editor)
// ============================================================================

// GET /api/papan/share/:token - Ambil informasi papan via token berbagi tanpa login
papanRouter.get('/share/:token', async (req, res: Response) => {
  try {
    const token = req.params.token as string;
    if (!token) {
      return res.status(400).json({ pesan: 'Token berbagi wajib disertakan.' });
    }

    const share = await prisma.boardShare.findUnique({
      where: { token },
      include: {
        board: {
          select: {
            id: true,
            judul: true,
            data: true,
            ownerId: true,
            updatedAt: true,
            owner: { select: { nama: true, sekolah: true } },
          },
        },
      },
    });

    if (!share || !share.aktif) {
      return res.status(404).json({
        pesan: 'Tautan berbagi tidak ditemukan atau akses telah dicabut oleh pemilik papan.',
      });
    }

    return res.json({
      share: {
        id: share.id,
        token: share.token,
        peran: share.peran, // 'viewer' | 'editor'
        boardId: share.boardId,
        judul: share.board.judul,
        data: share.board.data,
        pemilik: share.board.owner.nama,
        updatedAt: share.board.updatedAt,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal memvalidasi token berbagi.' });
  }
});

// Helper validasi format data kanvas (mendukung format v1 tunggal dan format v2 multi-halaman/slide)
export const isValidCanvasData = (parsed: any): boolean => {
  if (!parsed || typeof parsed !== 'object') return false;
  // Format v1: { versi: 1, objs: [...] }
  if (parsed.versi === 1 && Array.isArray(parsed.objs)) return true;
  // Format v2: { versi: 2, pages: [...] }
  if (parsed.versi === 2 && Array.isArray(parsed.pages)) return true;
  // Format kompatibel: objek memiliki array objs atau pages
  if (Array.isArray(parsed.objs) || Array.isArray(parsed.pages)) return true;
  return false;
};

// PUT /api/papan/share/:token - Simpan perubahan kanvas oleh Editor via token berbagi
const simpanShareSchema = z.object({
  data: z.union([
    z.string().refine((str) => {
      try {
        const parsed = JSON.parse(str);
        return isValidCanvasData(parsed);
      } catch {
        return false;
      }
    }, 'Format data kanvas tidak valid'),
    z.object({
      versi: z.number().int().min(1).max(2).optional(),
      objs: z.array(z.any()).optional(),
      pages: z.array(z.any()).optional(),
      currentPageIndex: z.number().int().optional(),
    }).refine(isValidCanvasData, 'Format data kanvas tidak valid'),
  ]).transform((val) => (typeof val === 'string' ? val : JSON.stringify(val))),
});

papanRouter.put('/share/:token', async (req, res: Response) => {
  try {
    const token = req.params.token as string;
    const { data } = simpanShareSchema.parse(req.body);

    const share = await prisma.boardShare.findUnique({
      where: { token },
    });

    if (!share || !share.aktif) {
      return res.status(403).json({
        pesan: 'Akses ditolak: Tautan berbagi tidak valid atau telah dicabut.',
      });
    }

    if (share.peran !== 'editor') {
      return res.status(403).json({
        pesan: 'Akses ditolak: Peran Anda hanya Viewer dan tidak diizinkan menyimpan perubahan.',
      });
    }

    const updatedBoard = await prisma.board.update({
      where: { id: share.boardId },
      data: {
        data,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        judul: true,
        updatedAt: true,
      },
    });

    syncBoardMemoryFromData(share.boardId, data, updatedBoard.judul);

    return res.json({
      pesan: 'Perubahan papan berhasil disimpan.',
      board: updatedBoard,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ pesan: err.issues[0]?.message || 'Input tidak valid.' });
    }
    return res.status(500).json({ pesan: err.message || 'Gagal menyimpan data papan.' });
  }
});

// ============================================================================
// 2. RUTE TERLINDUNGI GURU: Kelola Papan Tulis Milik Guru
// ============================================================================
papanRouter.use(authMiddleware);
papanRouter.use(roleMiddleware('guru'));

// GET /api/papan - Daftar papan tulis milik guru (id, judul, updatedAt)
papanRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const boards = await prisma.board.findMany({
      where: { ownerId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        judul: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return res.json({ boards });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal memuat daftar papan tulis.' });
  }
});

// POST /api/papan - Buat papan tulis baru
const buatPapanSchema = z.object({
  judul: z.string().trim().min(1).max(60).optional(),
});

papanRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = buatPapanSchema.parse(req.body || {});
    const judul = parsed.judul || 'Papan Pembelajaran Baru';

    // Inisialisasi kanvas kosong dalam format versi 1
    const defaultData = JSON.stringify({
      versi: 1,
      objs: [],
    });

    const board = await prisma.board.create({
      data: {
        ownerId: req.user!.id,
        judul,
        data: defaultData,
      },
    });

    return res.status(201).json({
      pesan: 'Papan tulis baru berhasil dibuat.',
      board: {
        id: board.id,
        judul: board.judul,
        data: board.data,
        ownerId: board.ownerId,
        updatedAt: board.updatedAt,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ pesan: err.issues[0]?.message || 'Input tidak valid.' });
    }
    return res.status(500).json({ pesan: err.message || 'Gagal membuat papan tulis.' });
  }
});

// GET /api/papan/:id - Ambil detail papan tulis
papanRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const board = await prisma.board.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, nama: true } },
      },
    });

    if (!board) {
      return res.status(404).json({ pesan: 'Papan tulis tidak ditemukan.' });
    }

    if (board.ownerId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke papan ini.' });
    }

    return res.json({
      board: {
        id: board.id,
        judul: board.judul,
        data: board.data,
        ownerId: board.ownerId,
        ownerName: board.owner.nama,
        updatedAt: board.updatedAt,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal memuat papan tulis.' });
  }
});

// PUT /api/papan/:id - Simpan data kanvas / judul oleh pemilik
const putPapanSchema = z.object({
  judul: z.string().trim().min(1).max(60).optional(),
  data: z.union([
    z.string().refine((str) => {
      try {
        const parsed = JSON.parse(str);
        return isValidCanvasData(parsed);
      } catch {
        return false;
      }
    }, 'Format data kanvas tidak valid'),
    z.object({
      versi: z.number().int().min(1).max(2).optional(),
      objs: z.array(z.any()).optional(),
      pages: z.array(z.any()).optional(),
      currentPageIndex: z.number().int().optional(),
    }).refine(isValidCanvasData, 'Format data kanvas tidak valid'),
  ]).transform((val) => (typeof val === 'string' ? val : JSON.stringify(val))).optional(),
});

papanRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { data, judul } = putPapanSchema.parse(req.body);

    const board = await prisma.board.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!board) {
      return res.status(404).json({ pesan: 'Papan tulis tidak ditemukan.' });
    }

    if (board.ownerId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses mengubah papan ini.' });
    }

    const updated = await prisma.board.update({
      where: { id },
      data: {
        ...(data ? { data } : {}),
        ...(judul ? { judul } : {}),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        judul: true,
        updatedAt: true,
      },
    });

    if (data || judul) {
      syncBoardMemoryFromData(id, data, updated.judul);
    }

    return res.json({
      pesan: 'Papan tulis berhasil disimpan.',
      board: updated,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ pesan: err.issues[0]?.message || 'Input tidak valid.' });
    }
    return res.status(500).json({ pesan: err.message || 'Gagal menyimpan perubahan papan.' });
  }
});

// PATCH /api/papan/:id/judul - Ganti judul papan tulis
const patchJudulSchema = z.object({
  judul: z.string().min(1, 'Judul papan tidak boleh kosong').max(100, 'Judul papan maksimal 100 karakter'),
});

papanRouter.patch('/:id/judul', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { judul } = patchJudulSchema.parse(req.body);

    const board = await prisma.board.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!board) {
      return res.status(404).json({ pesan: 'Papan tulis tidak ditemukan.' });
    }

    if (board.ownerId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses mengubah papan ini.' });
    }

    const updated = await prisma.board.update({
      where: { id },
      data: {
        judul: judul.trim(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        judul: true,
        updatedAt: true,
      },
    });

    return res.json({
      pesan: 'Judul papan tulis berhasil diperbarui.',
      board: updated,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ pesan: err.issues[0]?.message || 'Input tidak valid.' });
    }
    return res.status(500).json({ pesan: err.message || 'Gagal mengubah judul papan.' });
  }
});

// DELETE /api/papan/:id - Hapus papan tulis
papanRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const board = await prisma.board.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!board) {
      return res.status(404).json({ pesan: 'Papan tulis tidak ditemukan.' });
    }

    if (board.ownerId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak berwenang menghapus papan ini.' });
    }

    await prisma.board.delete({
      where: { id },
    });

    return res.json({ pesan: 'Papan tulis berhasil dihapus.' });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal menghapus papan tulis.' });
  }
});

// GET /api/papan/:id/bagikan - Cek status tautan berbagi aktif (hanya pemilik)
papanRouter.get('/:id/bagikan', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const board = await prisma.board.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!board) {
      return res.status(404).json({ pesan: 'Papan tulis tidak ditemukan.' });
    }

    if (board.ownerId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak berwenang melihat tautan berbagi papan ini.' });
    }

    const share = await prisma.boardShare.findFirst({
      where: { boardId: id, aktif: true },
      orderBy: { updatedAt: 'desc' },
    });

    const baseUrl = getNetworkBaseUrl(req);

    if (!share) {
      return res.json({
        aktif: false,
        token: null,
        peran: 'viewer',
        joinUrl: null,
        networkUrl: baseUrl,
      });
    }

    return res.json({
      aktif: true,
      token: share.token,
      peran: share.peran,
      joinUrl: `${baseUrl}/b/${share.token}`,
      networkUrl: baseUrl,
    });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal memeriksa status tautan berbagi.' });
  }
});

// POST /api/papan/:id/bagikan - Buat atau perbarui satu tautan aktif untuk papan (hanya pemilik)
const bagikanSchema = z.object({
  peran: z.enum(['viewer', 'editor'], {
    message: "Peran harus berupa 'viewer' atau 'editor'.",
  }),
});

papanRouter.post('/:id/bagikan', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { peran } = bagikanSchema.parse(req.body);

    const board = await prisma.board.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!board) {
      return res.status(404).json({ pesan: 'Papan tulis tidak ditemukan.' });
    }

    if (board.ownerId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak berwenang membagikan papan ini.' });
    }

    // Cari tautan aktif dengan peran yang sama, jika ada gunakan kembali, atau jika belum ada buat token baru untuk peran tersebut
    let share = await prisma.boardShare.findFirst({
      where: { boardId: id, peran, aktif: true },
    });

    if (!share) {
      // Buat tautan baru dengan token acak panjang yang sulit ditebak (32 karakter hex)
      const token = crypto.randomBytes(16).toString('hex');
      share = await prisma.boardShare.create({
        data: {
          boardId: id,
          token,
          peran,
          aktif: true,
        },
      });
    }

    const baseUrl = getNetworkBaseUrl(req);
    const joinUrl = `${baseUrl}/b/${share.token}`;

    return res.status(201).json({
      pesan: `Tautan ${peran === 'editor' ? 'Editor' : 'Viewer'} siap dibagikan.`,
      token: share.token,
      share: {
        id: share.id,
        token: share.token,
        peran: share.peran,
        joinUrl,
        networkUrl: baseUrl,
        aktif: share.aktif,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ pesan: err.issues[0]?.message || 'Input tidak valid.' });
    }
    return res.status(500).json({ pesan: err.message || 'Gagal membuat atau memperbarui tautan berbagi.' });
  }
});

// DELETE /api/papan/bagi/:token - Cabut tautan berbagi papan (hanya pemilik)
papanRouter.delete('/bagi/:token', async (req: AuthRequest, res: Response) => {
  try {
    const token = req.params.token as string;

    const share = await prisma.boardShare.findUnique({
      where: { token },
      include: {
        board: { select: { id: true, ownerId: true } },
      },
    });

    if (!share) {
      return res.status(404).json({ pesan: 'Tautan berbagi tidak ditemukan.' });
    }

    if (share.board.ownerId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak berwenang mencabut tautan papan ini.' });
    }

    // Tandai tidak aktif
    await prisma.boardShare.update({
      where: { id: share.id },
      data: {
        aktif: false,
        updatedAt: new Date(),
      },
    });

    // Beritahu ruang kolaborasi Socket.IO bahwa token ini telah dicabut
    try {
      broadcastTokenRevocation(share.boardId, token);
    } catch (err) {
      console.error('Gagal menyiarkan pembatalan akses socket:', err);
    }

    return res.json({ pesan: 'Tautan berbagi berhasil dicabut.' });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal mencabut tautan berbagi.' });
  }
});
