import { z } from 'zod';

export const KODE_OPSI_VALID = ['A', 'B', 'C', 'D', 'E'] as const;
export type KunciPilihan = (typeof KODE_OPSI_VALID)[number];

export interface SoalOpsiFields {
  opsiA: string;
  opsiB: string;
  opsiC?: string | null;
  opsiD?: string | null;
  opsiE?: string | null;
}

export interface SoalRecordForGame extends SoalOpsiFields {
  id: string;
  urutan: number;
  teks: string;
  jawabanBenar: string;
  penjelasan: string | null;
  kesulitan?: string | null;
}

/** Mengubah teks opsi opsional menjadi null jika kosong/whitespace. */
export function normalizeOptionalOption(val?: string | null): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Mengambil daftar opsi aktif berurutan dari A hingga E tanpa celah kosong. */
export function extractActiveOptions(
  soal: SoalOpsiFields
): Array<{ key: KunciPilihan; teks: string }> {
  const result: Array<{ key: KunciPilihan; teks: string }> = [
    { key: 'A', teks: (soal.opsiA || '').trim() },
    { key: 'B', teks: (soal.opsiB || '').trim() },
  ];

  const c = normalizeOptionalOption(soal.opsiC);
  if (!c) return result;
  result.push({ key: 'C', teks: c });

  const d = normalizeOptionalOption(soal.opsiD);
  if (!d) return result;
  result.push({ key: 'D', teks: d });

  const e = normalizeOptionalOption(soal.opsiE);
  if (!e) return result;
  result.push({ key: 'E', teks: e });

  return result;
}

/** Memastikan kode kunci berada pada rentang A..E dan cocok dengan opsi aktif. */
export function normalizeOptionKey(
  raw: string,
  allowedKeys?: KunciPilihan[],
  fallback: KunciPilihan = 'A'
): KunciPilihan {
  const cleaned = String(raw || '').trim().toUpperCase();
  const isKnown = (KODE_OPSI_VALID as readonly string[]).includes(cleaned);
  if (isKnown) {
    const key = cleaned as KunciPilihan;
    if (!allowedKeys || allowedKeys.includes(key)) {
      return key;
    }
  }
  return allowedKeys && allowedKeys.length > 0 ? allowedKeys[0] : fallback;
}

const optionalTrimmedString = z
  .string()
  .nullable()
  .optional()
  .transform((val) => normalizeOptionalOption(val));

/** Skema validasi soal pilihan ganda dinamis (2 hingga 5 opsi: A sampai E). */
export const questionInputSchema = z
  .object({
    id: z.string().optional(),
    urutan: z.number().int().default(0),
    teks: z.string().trim().min(1, 'Teks soal wajib diisi.'),
    opsiA: z.string().trim().min(1, 'Pilihan A wajib diisi.'),
    opsiB: z.string().trim().min(1, 'Pilihan B wajib diisi.'),
    opsiC: optionalTrimmedString,
    opsiD: optionalTrimmedString,
    opsiE: optionalTrimmedString,
    jawabanBenar: z
      .string()
      .transform((v) => v.trim().toUpperCase())
      .pipe(
        z.enum(KODE_OPSI_VALID, {
          message: 'Jawaban benar harus berupa A, B, C, D, atau E.',
        })
      ),
    penjelasan: z.string().nullable().optional(),
    kesulitan: z.enum(['mudah', 'sedang', 'sulit']).default('sedang'),
    dibuatAi: z.boolean().default(false),
  })
  .superRefine((q, ctx) => {
    if (q.opsiD && !q.opsiC) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pilihan C wajib diisi sebelum menambahkan Pilihan D.',
        path: ['opsiC'],
      });
    }
    if (q.opsiE && (!q.opsiC || !q.opsiD)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pilihan C dan D wajib diisi sebelum menambahkan Pilihan E.',
        path: ['opsiD'],
      });
    }

    const availableMap: Record<KunciPilihan, string | null> = {
      A: q.opsiA,
      B: q.opsiB,
      C: q.opsiC,
      D: q.opsiD,
      E: q.opsiE,
    };

    if (!availableMap[q.jawabanBenar]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Kunci jawaban "${q.jawabanBenar}" tidak valid karena Pilihan ${q.jawabanBenar} masih kosong.`,
        path: ['jawabanBenar'],
      });
    }
  });

export type ValidatedQuestionInput = z.infer<typeof questionInputSchema>;

/** Menyusun objek kolom database saat membuat/menyalin soal ke Prisma. */
export function buildPrismaQuestionData(
  q: {
    urutan?: number;
    teks: string;
    opsiA: string;
    opsiB: string;
    opsiC?: string | null;
    opsiD?: string | null;
    opsiE?: string | null;
    jawabanBenar: string;
    penjelasan?: string | null;
    kesulitan?: string | null;
    dibuatAi?: boolean;
  },
  fallbackIndex: number
) {
  return {
    urutan: q.urutan || fallbackIndex + 1,
    teks: q.teks,
    opsiA: q.opsiA,
    opsiB: q.opsiB,
    opsiC: normalizeOptionalOption(q.opsiC),
    opsiD: normalizeOptionalOption(q.opsiD),
    opsiE: normalizeOptionalOption(q.opsiE),
    jawabanBenar: q.jawabanBenar,
    penjelasan: q.penjelasan || null,
    kesulitan: q.kesulitan || 'sedang',
    dibuatAi: Boolean(q.dibuatAi),
  };
}

/** Pemetaan standar record Question database menjadi struktur soal game manager. */
export function mapDbQuestionForGame(q: SoalRecordForGame) {
  return {
    id: q.id,
    urutan: q.urutan,
    teks: q.teks,
    opsiA: q.opsiA,
    opsiB: q.opsiB,
    opsiC: q.opsiC ?? null,
    opsiD: q.opsiD ?? null,
    opsiE: q.opsiE ?? null,
    jawabanBenar: q.jawabanBenar,
    penjelasan: q.penjelasan,
    kesulitan: q.kesulitan || 'sedang',
  };
}

