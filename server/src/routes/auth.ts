import { Router, Request } from 'express';
import { z } from 'zod';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { COOKIE_NAME, authMiddleware, AuthRequest } from '../middleware/auth.js';

export const authRouter = Router();

function isSecureRequest(req: Request): boolean {
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
  }
  if (Array.isArray(forwardedProto) && forwardedProto.length > 0) {
    return forwardedProto[0].trim().toLowerCase() === 'https';
  }
  return Boolean(req.secure);
}

function buildAuthCookieOptions(req: Request) {
  return {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax' as const,
    path: '/',
  };
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { pesan: 'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.' },
});

const daftarSchema = z.object({
  nama: z.string({ message: 'Nama wajib diisi.' }).min(2, 'Nama minimal 2 karakter.'),
  email: z.string({ message: 'Email wajib diisi.' }).email('Format email tidak valid.'),
  kataSandi: z.string({ message: 'Kata sandi wajib diisi.' }).min(8, 'Kata sandi minimal 8 karakter.'),
  sekolah: z.string().optional(),
});

const masukSchema = z.object({
  email: z.string({ message: 'Email wajib diisi.' }).email('Format email tidak valid.'),
  kataSandi: z.string({ message: 'Kata sandi wajib diisi.' }).min(1, 'Kata sandi wajib diisi.'),
});

// POST /api/auth/daftar
authRouter.post('/daftar', authRateLimiter, async (req, res, next) => {
  try {
    const validData = daftarSchema.parse(req.body);
    const emailNorm = validData.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: emailNorm },
    });

    if (existingUser) {
      return res.status(400).json({
        pesan: 'Email sudah terdaftar. Silakan gunakan email lain atau masuk.',
      });
    }

    const passwordHash = await bcryptjs.hash(validData.kataSandi, 10);

    const user = await prisma.user.create({
      data: {
        nama: validData.nama.trim(),
        email: emailNorm,
        passwordHash,
        role: 'guru', // Role selalu guru untuk pendaftaran publik
        sekolah: validData.sekolah?.trim() || null,
        status: 'aktif',
      },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        sekolah: true,
        status: true,
      },
    });

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
      expiresIn: '7d',
    });

    res.cookie(COOKIE_NAME, token, {
      ...buildAuthCookieOptions(req),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      pesan: 'Pendaftaran berhasil.',
      user,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/auth/masuk
authRouter.post('/masuk', authRateLimiter, async (req, res, next) => {
  try {
    const validData = masukSchema.parse(req.body);
    const emailNorm = validData.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: emailNorm },
    });

    if (!user) {
      return res.status(401).json({
        pesan: 'Email atau kata sandi tidak cocok.',
      });
    }

    const passwordMatch = await bcryptjs.compare(validData.kataSandi, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({
        pesan: 'Email atau kata sandi tidak cocok.',
      });
    }

    if (user.status !== 'aktif') {
      return res.status(403).json({
        pesan: 'Akun Anda telah dinonaktifkan. Silakan hubungi administrator.',
      });
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
      expiresIn: '7d',
    });

    res.cookie(COOKIE_NAME, token, {
      ...buildAuthCookieOptions(req),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      pesan: 'Berhasil masuk.',
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role,
        sekolah: user.sekolah,
        status: user.status,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/auth/keluar
authRouter.post('/keluar', (req, res) => {
  res.clearCookie(COOKIE_NAME, buildAuthCookieOptions(req));

  return res.json({
    pesan: 'Berhasil keluar.',
  });
});

// GET /api/auth/saya
authRouter.get('/saya', authMiddleware, (req: AuthRequest, res) => {
  return res.json({
    user: req.user,
  });
});

const profilSchema = z.object({
  nama: z.string({ message: 'Nama wajib diisi.' }).min(2, 'Nama minimal 2 karakter.'),
  sekolah: z.string().optional().nullable(),
});

const gantiKataSandiSchema = z.object({
  kataSandiLama: z.string({ message: 'Kata sandi lama wajib diisi.' }).min(1, 'Kata sandi lama wajib diisi.'),
  kataSandiBaru: z.string({ message: 'Kata sandi baru wajib diisi.' }).min(8, 'Kata sandi baru minimal 8 karakter.'),
});

// PUT /api/auth/profil - Perbarui data profil guru atau admin
authRouter.put('/profil', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const validData = profilSchema.parse(req.body);
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        nama: validData.nama.trim(),
        sekolah: validData.sekolah ? validData.sekolah.trim() : null,
      },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        sekolah: true,
        status: true,
      },
    });

    return res.json({
      pesan: 'Profil berhasil diperbarui.',
      user: updated,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ pesan: error.issues[0]?.message || 'Input profil tidak valid.' });
    }
    const err = error as Error;
    return res.status(500).json({ pesan: err.message || 'Gagal memperbarui profil.' });
  }
});

// PUT /api/auth/kata-sandi - Ganti kata sandi
authRouter.put('/kata-sandi', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const validData = gantiKataSandiSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ pesan: 'Pengguna tidak ditemukan.' });
    }

    const cocok = await bcryptjs.compare(validData.kataSandiLama, user.passwordHash);
    if (!cocok) {
      return res.status(400).json({ pesan: 'Kata sandi lama tidak sesuai.' });
    }

    const passwordHash = await bcryptjs.hash(validData.kataSandiBaru, 10);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash },
    });

    return res.json({ pesan: 'Kata sandi berhasil diperbarui.' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ pesan: error.issues[0]?.message || 'Input kata sandi tidak valid.' });
    }
    const err = error as Error;
    return res.status(500).json({ pesan: err.message || 'Gagal memperbarui kata sandi.' });
  }
});
