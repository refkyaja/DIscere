import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import {
  buildPrismaQuestionData,
  questionInputSchema,
} from '../utils/questionOptions.js';

export const templateRouter = Router();

// Seluruh rute template mewajibkan login dengan role guru
templateRouter.use(authMiddleware);
templateRouter.use(roleMiddleware('guru'));

const templateInputSchema = z.object({
  judul: z.string().min(3, 'Judul template minimal 3 karakter.'),
  game: z
    .enum(['tarik_tambang', 'makan_kerupuk', 'panjat_pinang', 'balap_karung'])
    .default('tarik_tambang'),
  mode: z.enum(['solo', 'multi']).default('solo'),
  questions: z.array(questionInputSchema).min(1, 'Minimal sertakan 1 soal dalam template.'),
});

// GET /api/template - Daftar template milik guru
templateRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string)?.trim();
    const where: any = { ownerId: req.user!.id };

    if (q) {
      where.judul = { contains: q };
    }

    const templates = await prisma.template.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });

    return res.json({ templates });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal memuat template.' });
  }
});

// GET /api/template/pustaka - Daftar template resmi dari admin
templateRouter.get('/pustaka', async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string)?.trim();
    const where: any = { resmi: true };

    if (q) {
      where.judul = { contains: q };
    }

    const templates = await prisma.template.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });

    return res.json({ templates });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal memuat pustaka template.' });
  }
});

// GET /api/template/:id - Detail template dan soal-soalnya
templateRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const template = await prisma.template.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { urutan: 'asc' },
        },
      },
    });

    if (!template) {
      return res.status(404).json({ pesan: 'Template tidak ditemukan.' });
    }

    // Hanya pemilik atau template resmi yang dapat dibuka
    if (template.ownerId !== req.user!.id && !template.resmi) {
      return res.status(403).json({ pesan: 'Anda tidak memiliki hak akses ke template ini.' });
    }

    return res.json({ template });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal memuat detail template.' });
  }
});

// POST /api/template - Buat template baru
templateRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = templateInputSchema.parse(req.body);
    const resolvedMode =
      parsed.game === 'panjat_pinang' || parsed.game === 'balap_karung' ? 'multi' : parsed.mode;

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.template.create({
        data: {
          ownerId: req.user!.id,
          judul: parsed.judul,
          game: parsed.game,
          mode: resolvedMode,
          resmi: false,
        },
      });

      if (parsed.questions.length > 0) {
        await tx.question.createMany({
          data: parsed.questions.map((q, index) => ({
            templateId: created.id,
            ...buildPrismaQuestionData(q, index),
          })),
        });
      }

      return created;
    });

    const fullTemplate = await prisma.template.findUnique({
      where: { id: template.id },
      include: { questions: { orderBy: { urutan: 'asc' } } },
    });

    return res.status(201).json({
      pesan: 'Template berhasil dibuat.',
      template: fullTemplate,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ pesan: err.issues[0]?.message || 'Input tidak valid.' });
    }
    return res.status(500).json({ pesan: err.message || 'Gagal membuat template.' });
  }
});

// PUT /api/template/:id - Perbarui template
templateRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.template.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ pesan: 'Template tidak ditemukan.' });
    }

    if (existing.ownerId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak dapat mengubah template milik guru lain.' });
    }

    const parsed = templateInputSchema.parse(req.body);
    const resolvedMode =
      parsed.game === 'panjat_pinang' || parsed.game === 'balap_karung' ? 'multi' : parsed.mode;

    await prisma.$transaction(async (tx) => {
      await tx.template.update({
        where: { id },
        data: {
          judul: parsed.judul,
          game: parsed.game,
          mode: resolvedMode,
        },
      });

      // Hapus soal lama dan buat baru sesuai daftar yang diedit
      await tx.question.deleteMany({ where: { templateId: id } });

      await tx.question.createMany({
        data: parsed.questions.map((q, index) => ({
          templateId: id,
          ...buildPrismaQuestionData(q, index),
        })),
      });
    });

    const updated = await prisma.template.findUnique({
      where: { id },
      include: { questions: { orderBy: { urutan: 'asc' } } },
    });

    return res.json({
      pesan: 'Template berhasil diperbarui.',
      template: updated,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ pesan: err.issues[0]?.message || 'Input tidak valid.' });
    }
    return res.status(500).json({ pesan: err.message || 'Gagal memperbarui template.' });
  }
});

// DELETE /api/template/:id - Hapus template
templateRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.template.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ pesan: 'Template tidak ditemukan.' });
    }

    if (existing.ownerId !== req.user!.id) {
      return res.status(403).json({ pesan: 'Anda tidak dapat menghapus template milik guru lain.' });
    }

    await prisma.template.delete({ where: { id } });

    return res.json({ pesan: 'Template berhasil dihapus.' });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal menghapus template.' });
  }
});

// POST /api/template/:id/duplikat - Duplikat template (bisa dari pustaka resmi atau template sendiri)
templateRouter.post('/:id/duplikat', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const asal = await prisma.template.findUnique({
      where: { id },
      include: { questions: { orderBy: { urutan: 'asc' } } },
    });

    if (!asal) {
      return res.status(404).json({ pesan: 'Template asal tidak ditemukan.' });
    }

    // Bisa menduplikat milik sendiri atau template resmi
    if (asal.ownerId !== req.user!.id && !asal.resmi) {
      return res.status(403).json({ pesan: 'Anda tidak berwenang menduplikat template ini.' });
    }

    const duplikat = await prisma.$transaction(async (tx) => {
      const baru = await tx.template.create({
        data: {
          ownerId: req.user!.id,
          judul: `${asal.judul} (Salinan)`,
          game: asal.game,
          mode: asal.mode,
          resmi: false,
        },
      });

      if (asal.questions.length > 0) {
        await tx.question.createMany({
          data: asal.questions.map((q, idx) => ({
            templateId: baru.id,
            ...buildPrismaQuestionData(q, idx),
          })),
        });
      }

      return baru;
    });

    const fullDuplikat = await prisma.template.findUnique({
      where: { id: duplikat.id },
      include: { questions: { orderBy: { urutan: 'asc' } } },
    });

    return res.status(201).json({
      pesan: 'Template berhasil disalin ke pustaka Anda.',
      template: fullDuplikat,
    });
  } catch (err: any) {
    return res.status(500).json({ pesan: err.message || 'Gagal menduplikat template.' });
  }
});
