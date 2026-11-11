import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';

// Skema Soal dari AI
export const aiQuestionSchema = z
  .object({
    teks: z.string().min(5, 'Teks soal minimal 5 karakter.'),
    opsiA: z.string().min(1, 'Opsi A wajib diisi.'),
    opsiB: z.string().min(1, 'Opsi B wajib diisi.'),
    opsiC: z.string().min(1, 'Opsi C wajib diisi.'),
    jawabanBenar: z.enum(['A', 'B', 'C']),
    penjelasan: z.string().min(1, 'Penjelasan wajib diisi.'),
    kesulitan: z.enum(['mudah', 'sedang', 'sulit']).optional().default('sedang'),
    dibuatAi: z.literal(true),
  })
  .refine(
    (q) => {
      const a = q.opsiA.trim().toLowerCase();
      const b = q.opsiB.trim().toLowerCase();
      const c = q.opsiC.trim().toLowerCase();
      return a !== b && b !== c && a !== c;
    },
    { message: 'Ketiga pilihan jawaban soal AI harus berbeda satu sama lain.' }
  );

export const aiGenerateQuestionsResponseSchema = z.object({
  soal: z.array(aiQuestionSchema).min(1),
});

export type AiQuestion = z.infer<typeof aiQuestionSchema>;

// Skema Jawaban Soal dari Papan Tulis (Tanya AI)
export const aiSolveBoardSchema = z.object({
  jawaban: z.string().min(1),
  rumus: z.string().optional().default('-'),
  langkah: z.string().min(1),
  dibuatAi: z.literal(true),
});

export type AiSolveBoardResult = z.infer<typeof aiSolveBoardSchema>;

/**
 * Buat hash SHA-256 untuk kunci cache AI
 */
export function generateAiHash(input: string, options: Record<string, any> = {}): string {
  const payload = JSON.stringify({ input: input.trim(), ...options });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Dapatkan tanggal hari ini dalam format YYYY-MM-DD (WIB / Local)
 */
export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Periksa kuota harian AI guru
 */
export async function periksaDanPakaiKuota(userId: string): Promise<{
  bisaPakai: boolean;
  sisaKuota: number;
  totalTerpakai: number;
  batasHarian: number;
}> {
  const tanggal = getTodayString();
  const batasHarian = config.aiBatasHarian;

  const usage = await prisma.aiUsage.findUnique({
    where: {
      userId_tanggal: {
        userId,
        tanggal,
      },
    },
  });

  const totalTerpakai = usage ? usage.jumlah : 0;
  const sisaKuota = Math.max(0, batasHarian - totalTerpakai);

  if (totalTerpakai >= batasHarian) {
    return {
      bisaPakai: false,
      sisaKuota: 0,
      totalTerpakai,
      batasHarian,
    };
  }

  // Tambah pemakaian
  await prisma.aiUsage.upsert({
    where: {
      userId_tanggal: {
        userId,
        tanggal,
      },
    },
    update: {
      jumlah: { increment: 1 },
    },
    create: {
      userId,
      tanggal,
      jumlah: 1,
    },
  });

  return {
    bisaPakai: true,
    sisaKuota: sisaKuota - 1,
    totalTerpakai: totalTerpakai + 1,
    batasHarian,
  };
}

/**
 * Dapatkan info kuota saat ini tanpa menambah pemakaian
 */
export async function getInfoKuota(userId: string): Promise<{
  sisaKuota: number;
  totalTerpakai: number;
  batasHarian: number;
}> {
  const tanggal = getTodayString();
  const batasHarian = config.aiBatasHarian;

  const usage = await prisma.aiUsage.findUnique({
    where: {
      userId_tanggal: {
        userId,
        tanggal,
      },
    },
  });

  const totalTerpakai = usage ? usage.jumlah : 0;
  const sisaKuota = Math.max(0, batasHarian - totalTerpakai);

  return {
    sisaKuota,
    totalTerpakai,
    batasHarian,
  };
}

/**
 * Generator fallback cerdas untuk pembuatan soal dari materi
 * Dipakai saat offline atau ketika API key tidak disetel
 */
function generateFallbackQuestions(
  materi: string,
  jumlah: number,
  tingkat: 'SD' | 'SMP',
  kesulitan: 'mudah' | 'sedang' | 'sulit' = 'sedang'
): AiQuestion[] {
  const cleanMateri = materi.trim();
  const sentences = cleanMateri
    .split(/[.\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  const hasil: AiQuestion[] = [];
  const targetJumlah = Math.min(Math.max(jumlah, 1), 15);

  for (let i = 0; i < targetJumlah; i++) {
    const kalimat = sentences[i % sentences.length] || `Materi pokok pembelajaran bab ke-${i + 1}`;
    const kataKunci = kalimat.split(' ').filter((w) => w.length > 4);
    const subjek = kataKunci[0] || 'Konsep ini';
    const detail = kataKunci.slice(1, 4).join(' ') || 'pembahasan materi';

    let teks = '';
    let opsiA = '';
    let opsiB = '';
    let opsiC = '';
    let jawabanBenar: 'A' | 'B' | 'C' = 'A';
    let penjelasan = '';

    const pola = i % 3;
    if (pola === 0) {
      teks = `Berdasarkan materi yang dipelajari, apakah pengertian utama dari ${subjek}?`;
      opsiA = `${subjek} merupakan prinsip dasar yang berkaitan dengan ${detail}.`;
      opsiB = `${subjek} adalah komponen sekunder yang tidak memiliki pengaruh.`;
      opsiC = `${subjek} merupakan variabel acak yang selalu berubah tanpa pola.`;
      jawabanBenar = 'A';
      penjelasan = `Sesuai materi, ${subjek} adalah prinsip dasar yang berkaitan dengan ${detail}.`;
    } else if (pola === 1) {
      teks = `Manakah pernyataan yang paling tepat mengenai ${detail} untuk jenjang ${tingkat}?`;
      opsiA = `Pernyataan tersebut bersifat terbalik dan berlawanan dengan fakta.`;
      opsiB = `Pernyataan yang tepat adalah ${kalimat.slice(0, 60)}.`;
      opsiC = `Hal tersebut belum pernah dibuktikan secara ilmiah.`;
      jawabanBenar = 'B';
      penjelasan = `Pernyataan yang tepat selaras dengan isi teks: ${kalimat.slice(0, 70)}.`;
    } else {
      teks = `Apa kesimpulan utama yang dapat diambil dari pembahasan tentang ${subjek}?`;
      opsiA = `Semua bagian dapat berjalan secara terpisah tanpa kaitan.`;
      opsiB = `Hasil akhirnya selalu bernilai nol pada kondisi apa pun.`;
      opsiC = `Konsep ini membuktikan bahwa ${subjek} terintegrasi erat dengan ${detail}.`;
      jawabanBenar = 'C';
      penjelasan = `Secara logis materi menekankan hubungan erat antara ${subjek} dan ${detail}.`;
    }

    hasil.push({
      teks,
      opsiA,
      opsiB,
      opsiC,
      jawabanBenar,
      penjelasan,
      kesulitan,
      dibuatAi: true,
    });
  }

  return hasil;
}

/**
 * Panggil AI untuk Membuat Soal dari Materi Pembelajaran
 */
export async function generateSoalFromMateri(params: {
  materi: string;
  jumlah: number;
  tingkat: 'SD' | 'SMP';
  kesulitan?: 'mudah' | 'sedang' | 'sulit';
}): Promise<{ soal: AiQuestion[]; dariCache: boolean }> {
  const { materi, jumlah, tingkat, kesulitan = 'sedang' } = params;
  const hash = generateAiHash(materi, { jumlah, tingkat, kesulitan, jenis: 'soal' });

  // 1. Cek Cache Database
  const cached = await prisma.aiCache.findUnique({
    where: { hash },
  });

  if (cached) {
    try {
      const parsed = JSON.parse(cached.hasil);
      const validated = aiGenerateQuestionsResponseSchema.parse(parsed);
      return { soal: validated.soal, dariCache: true };
    } catch {
      // Abaikan jika cache korup
    }
  }

  let daftarSoal: AiQuestion[] = [];

  // 2. Panggil API AI jika API Key tersedia
  if (config.aiApiKey) {
    try {
      const model = config.aiModel || 'gemini-1.5-flash';
      const prompt = `Anda adalah asisten guru cerdas untuk platform Discere.
Buatlah ${jumlah} soal pilihan ganda berdasarkan teks materi berikut untuk tingkat ${tingkat} dengan tingkat kesulitan "${kesulitan}".
Kriteria wajib:
1. Setiap soal memiliki teks soal yang jelas, mendidik, dan tingkat kesulitan "${kesulitan}".
2. Tepat memiliki 3 pilihan jawaban berbeda: opsiA, opsiB, opsiC.
3. Tentukan jawabanBenar persis salah satu dari: "A", "B", atau "C".
4. Berikan penjelasan singkat mengapa jawaban tersebut benar.
5. Format jawaban WAJIB berupa JSON murni tanpa markdown, tanpa tanda kutip backtick, dengan struktur:
{"soal": [{"teks": "...", "opsiA": "...", "opsiB": "...", "opsiC": "...", "jawabanBenar": "A", "penjelasan": "...", "kesulitan": "${kesulitan}", "dibuatAi": true}]}

Materi:
${materi}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.aiApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          const validated = aiGenerateQuestionsResponseSchema.parse(parsed);
          daftarSoal = validated.soal;
        }
      }
    } catch (err) {
      console.warn('Panggilan API AI gagal, beralih ke generator edukatif terstruktur:', err);
    }
  }

  // 3. Gunakan fallback cerdas jika API Key tidak ada atau gagal
  if (daftarSoal.length === 0) {
    daftarSoal = generateFallbackQuestions(materi, jumlah, tingkat, kesulitan);
  }

  // 4. Simpan ke Cache
  try {
    await prisma.aiCache.upsert({
      where: { hash },
      update: { hasil: JSON.stringify({ soal: daftarSoal }) },
      create: {
        hash,
        jenis: 'soal',
        hasil: JSON.stringify({ soal: daftarSoal }),
      },
    });
  } catch (cacheErr) {
    console.warn('Gagal menyimpan cache AI:', cacheErr);
  }

  return { soal: daftarSoal, dariCache: false };
}

/**
 * Parse teks balasan AI sesuai format yang diminta:
 * "Jawaban: ...", "Rumus: ...", "Langkah: ..."
 */
function parseAiAnswerFormat(rawText: string): { jawaban: string; rumus: string; langkah: string } {
  const clean = rawText.replace(/\*\*/g, '').replace(/###?/g, '').trim();

  // Coba parse JSON terlebih dahulu
  if (clean.startsWith('{') && clean.endsWith('}')) {
    try {
      const j = JSON.parse(clean);
      if (j.jawaban) {
        return {
          jawaban: String(j.jawaban).trim(),
          rumus: j.rumus ? String(j.rumus).trim() : '-',
          langkah: j.langkah ? String(j.langkah).trim() : '-',
        };
      }
    } catch {
      // lanjut ke text parsing
    }
  }

  let jawaban = '';
  let rumus = '-';
  let langkah = '';
  let currentSection: 'jawaban' | 'rumus' | 'langkah' | '' = '';

  const lines = clean.split('\n');
  for (const line of lines) {
    const l = line.trim();
    if (/^Jawaban\s*:/i.test(l)) {
      jawaban = l.replace(/^Jawaban\s*:/i, '').trim();
      currentSection = 'jawaban';
    } else if (/^Rumus\s*:/i.test(l)) {
      const val = l.replace(/^Rumus\s*:/i, '').trim();
      rumus = val || '-';
      currentSection = 'rumus';
    } else if (/^Langkah\s*:/i.test(l)) {
      langkah = l.replace(/^Langkah\s*:/i, '').trim();
      currentSection = 'langkah';
    } else if (l) {
      if (currentSection === 'jawaban' && !langkah && rumus === '-') {
        jawaban += '\n' + l;
      } else if (currentSection === 'rumus') {
        rumus += '\n' + l;
      } else if (currentSection === 'langkah') {
        langkah += (langkah ? '\n' : '') + l;
      } else if (!jawaban) {
        jawaban = l;
      }
    }
  }

  return {
    jawaban: jawaban || clean || 'Tidak dapat membaca gambar dengan jelas.',
    rumus: rumus || '-',
    langkah: langkah || '-',
  };
}

/**
 * Panggil AI untuk Menjawab Soal yang Dilingkari di Papan Tulis (Tanya AI)
 */
export async function solveQuestionFromBoard(params: {
  imageBase64: string;
  pertanyaan?: string;
}): Promise<{ hasil: AiSolveBoardResult; dariCache: boolean }> {
  const { imageBase64, pertanyaan } = params;
  const hash = generateAiHash(imageBase64.slice(0, 4000), {
    pertanyaan: pertanyaan?.trim() || '',
    jenis: 'jawab',
  });

  // 1. Cek Cache di tabel ai_cache
  const cached = await prisma.aiCache.findUnique({
    where: { hash },
  });

  if (cached) {
    try {
      const parsed = JSON.parse(cached.hasil);
      const validated = aiSolveBoardSchema.parse(parsed);
      return { hasil: validated, dariCache: true };
    } catch {
      // Abaikan jika cache rusak
    }
  }

  let hasilJawaban: AiSolveBoardResult | null = null;

  // Jika API Key tidak ada, berikan pesan ramah terstruktur tanpa error
  if (!config.aiApiKey) {
    hasilJawaban = {
      jawaban: 'Kunci AI_API_KEY belum dikonfigurasi di server (.env).',
      rumus: '-',
      langkah: 'Silakan atur variabel AI_API_KEY dan AI_MODEL di .env agar asisten AI dapat menganalisis gambar papan tulis.',
      dibuatAi: true,
    };
  } else {
    // 2. Panggil API AI memakai fetch dari server (tanpa library tambahan)
    try {
      const model = config.aiModel || 'gemini-1.5-flash';
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

      const promptTeks = `Kamu asisten guru; gambar adalah potongan papan tulis berisi soal atau materi; jawab singkat; format persis:
Jawaban: ...
Rumus: ... (tulis dengan simbol biasa, tanpa LaTeX)
Langkah: ...
tanpa markdown; kalau bukan soal hitungan, bagian Rumus boleh dilewati; kalau gambar tidak terbaca, katakan terus terang.${pertanyaan ? `\nPermintaan khusus guru: ${pertanyaan}` : ''}`;

      // A. Dukung Google Generative AI (Gemini)
      if (!model.includes('claude') && !model.includes('anthropic')) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.aiApiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptTeks },
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textOut) {
            const parsed = parseAiAnswerFormat(textOut);
            hasilJawaban = {
              jawaban: parsed.jawaban,
              rumus: parsed.rumus,
              langkah: parsed.langkah,
              dibuatAi: true,
            };
          }
        }
      } else {
        // B. Dukung Anthropic (Claude) jika dikonfigurasi
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.aiApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1200,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: 'image/png',
                      data: cleanBase64,
                    },
                  },
                  {
                    type: 'text',
                    text: promptTeks,
                  },
                ],
              },
            ],
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          const textOut = (data.content || []).map((c: any) => c.text || '').join('');
          if (textOut) {
            const parsed = parseAiAnswerFormat(textOut);
            hasilJawaban = {
              jawaban: parsed.jawaban,
              rumus: parsed.rumus,
              langkah: parsed.langkah,
              dibuatAi: true,
            };
          }
        }
      }
    } catch (err) {
      console.warn('Panggilan Tanya AI Vision gagal:', err);
    }
  }

  // Fallback jika pemanggilan gagal atau gambar tidak terbaca
  if (!hasilJawaban) {
    hasilJawaban = {
      jawaban: 'Maaf, gambar soal pada kanvas belum terbaca dengan jelas.',
      rumus: '-',
      langkah: 'Pastikan coretan soal atau tulisan di papan terlihat jelas dan lingkari kembali dengan rapi.',
      dibuatAi: true,
    };
  }

  // 3. Simpan ke Cache ai_cache
  try {
    await prisma.aiCache.upsert({
      where: { hash },
      update: { hasil: JSON.stringify(hasilJawaban) },
      create: {
        hash,
        jenis: 'jawab',
        hasil: JSON.stringify(hasilJawaban),
      },
    });
  } catch (cacheErr) {
    console.warn('Gagal menyimpan cache Tanya AI:', cacheErr);
  }

  return { hasil: hasilJawaban, dariCache: false };
}

/**
 * Generator Kuis Interaktif Papan Tulis dengan AI (Topik dan/atau Gambar Kanvas)
 */
export async function generateKuisPapan(params: {
  userId: string;
  topik?: string;
  gambarPapan?: string;
  jumlah?: number;
  tingkat?: 'SD' | 'SMP';
  game?: string;
  simpanTemplate?: boolean;
}): Promise<{
  soal: AiQuestion[];
  template?: any;
}> {
  const {
    userId,
    topik = '',
    gambarPapan,
    jumlah = 5,
    tingkat = 'SD',
    game = 'tarik_tambang',
    simpanTemplate = false,
  } = params;

  const targetJumlah = Math.min(Math.max(jumlah, 1), 10);
  let daftarSoal: AiQuestion[] = [];

  // Panggil AI (Gemini atau Anthropic) jika API Key tersedia
  if (config.aiApiKey) {
    try {
      const model = config.aiModel || 'gemini-1.5-flash';
      const cleanBase64 = gambarPapan ? gambarPapan.replace(/^data:image\/\w+;base64,/, '') : '';

      const promptTeks = `Anda adalah asisten guru cerdas untuk platform pembelajaran interaktif Discere.
Tugas Anda: Buatlah ${targetJumlah} soal pilihan ganda untuk kuis kelas tingkat ${tingkat}${topik ? ` dengan topik "${topik}"` : ''}${gambarPapan ? '. Analisis materi, rumus, tulisan, diagram, atau peta konsep pada gambar kanvas papan tulis yang dilampirkan dan jadikan sebagai rujukan utama soal kuis.' : ''}.

Kriteria wajib:
1. Soal mendidik, bahasa ramah siswa, jelas dan mudah dipahami.
2. Setiap soal tepat memiliki 3 pilihan jawaban: opsiA, opsiB, opsiC.
3. Tentukan jawabanBenar persis salah satu dari: "A", "B", atau "C".
4. Berikan penjelasan edukatif singkat.
5. Format jawaban WAJIB berupa JSON murni tanpa markdown, tanpa backtick, dengan skema:
{"soal": [{"teks": "...", "opsiA": "...", "opsiB": "...", "opsiC": "...", "jawabanBenar": "A", "penjelasan": "...", "dibuatAi": true}]}`;

      const isClaude = model.includes('claude') || model.includes('anthropic');
      if (!isClaude) {
        // Endpoint Google Generative AI (Gemini)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.aiApiKey}`;
        const parts: any[] = [{ text: promptTeks }];
        if (cleanBase64) {
          parts.push({
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64,
            },
          });
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            const validated = aiGenerateQuestionsResponseSchema.parse(parsed);
            daftarSoal = validated.soal;
          }
        }
      } else {
        // Claude / Anthropic
        const userContent: any[] = [];
        if (cleanBase64) {
          userContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: cleanBase64,
            },
          });
        }
        userContent.push({ type: 'text', text: promptTeks });

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': config.aiApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 3000,
            messages: [{ role: 'user', content: userContent }],
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          const rawText = (data.content || []).map((c: any) => c.text || '').join('');
          const m = rawText.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = JSON.parse(m[0]);
            const validated = aiGenerateQuestionsResponseSchema.parse(parsed);
            daftarSoal = validated.soal;
          }
        }
      }
    } catch (err) {
      console.warn('Panggilan AI Kuis gagal, beralih ke generator edukatif terstruktur:', err);
    }
  }

  // Fallback cerdas jika AI offline/gagal
  if (daftarSoal.length === 0) {
    const materiTeks = topik || 'Materi Inti Pembelajaran di Papan Tulis';
    daftarSoal = generateFallbackQuestions(materiTeks, targetJumlah, tingkat);
  }

  let createdTemplate = null;
  if (simpanTemplate && daftarSoal.length > 0) {
    const judulTemplate = `Kuis AI: ${(topik || 'Papan Tulis').slice(0, 32)}`;
    const resolvedMode = game === 'panjat_pinang' || game === 'balap_karung' ? 'multi' : 'solo';
    try {
      createdTemplate = await prisma.$transaction(async (tx) => {
        const t = await tx.template.create({
          data: {
            ownerId: userId,
            judul: judulTemplate,
            game: game || 'tarik_tambang',
            mode: resolvedMode,
            resmi: false,
          },
        });

        await tx.question.createMany({
          data: daftarSoal.map((q, idx) => ({
            templateId: t.id,
            urutan: idx + 1,
            teks: q.teks,
            opsiA: q.opsiA,
            opsiB: q.opsiB,
            opsiC: q.opsiC,
            jawabanBenar: q.jawabanBenar,
            penjelasan: q.penjelasan || null,
            dibuatAi: true,
          })),
        });

        return t;
      });
    } catch (dbErr) {
      console.warn('Gagal menyimpan template kuis ke database:', dbErr);
    }
  }

  return {
    soal: daftarSoal,
    template: createdTemplate,
  };
}

// ----------------------------------------------------
// Modul Obrolan Asisten AI di Papan Tulis
// ----------------------------------------------------

export interface AiPesanLampiran {
  jenis: 'gambar' | 'pdf' | 'teks';
  nama: string;
  mt?: string;
  data?: string; // base64
  teks?: string;
}

export interface AiPesanItem {
  role: 'user' | 'assistant';
  teks: string;
  lampiran?: AiPesanLampiran[];
}

export const PROMPT_SISTEM_OBROL = `Kamu adalah asisten AI untuk guru di papan tulis pembelajaran Discere. Jawab dalam bahasa Indonesia kecuali diminta lain. Jelas, ringkas, dan bantu langkah demi langkah bila perlu. Pengguna adalah guru SD sampai SMP, jadi gunakan bahasa yang cocok bila diminta membuat materi untuk siswa. Jangan meminta atau menyimpan data pribadi siswa. Kalau tidak yakin atau lampiran tidak terbaca, katakan terus terang.`;

/**
 * Periksa kuota harian berdasarkan jenis fitur AI (soal, jawab, obrol)
 */
export async function cekBatasHarian(
  userId: string,
  jenis: 'soal' | 'jawab' | 'obrol' = 'obrol'
): Promise<{
  bisaPakai: boolean;
  sisaKuota: number;
  totalTerpakai: number;
  batasHarian: number;
}> {
  const tanggal = getTodayString();
  const batasHarian = jenis === 'obrol' ? config.aiBatasObrol : config.aiBatasHarian;

  const usage = await prisma.aiUsage.findUnique({
    where: {
      userId_tanggal: {
        userId,
        tanggal,
      },
    },
  });

  const totalTerpakai = usage ? usage.jumlah : 0;
  const sisaKuota = Math.max(0, batasHarian - totalTerpakai);

  return {
    bisaPakai: totalTerpakai < batasHarian,
    sisaKuota,
    totalTerpakai,
    batasHarian,
  };
}

/**
 * Catat pemakaian AI ke tabel ai_usage
 */
export async function catatPemakaianAi(userId: string): Promise<void> {
  const tanggal = getTodayString();
  await prisma.aiUsage.upsert({
    where: {
      userId_tanggal: {
        userId,
        tanggal,
      },
    },
    update: {
      jumlah: { increment: 1 },
    },
    create: {
      userId,
      tanggal,
      jumlah: 1,
    },
  });
}

/**
 * Fungsi pembungkus panggilAI generik dengan fetch, AbortSignal 60 detik,
 * dan pemetaan error ramah Bahasa Indonesia.
 */
export async function panggilAI(params: {
  sistem: string;
  pesan: string;
  maxToken?: number;
}): Promise<string> {
  if (!config.aiApiKey) {
    return 'Kunci AI_API_KEY belum dikonfigurasi di server (.env).';
  }

  const model = config.aiModel || 'gemini-1.5-flash';
  const maxToken = params.maxToken || 2000;

  try {
    const isClaude = model.includes('claude') || model.includes('anthropic');
    if (!isClaude) {
      // Endpoint Gemini
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.aiApiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: params.sistem }],
          },
          contents: [{ parts: [{ text: params.pesan }] }],
          generationConfig: {
            maxOutputTokens: maxToken,
          },
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) {
        throw new Error(`API AI mengembalikan status ${res.status}`);
      }
      const data = (await res.json()) as any;
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // Endpoint Claude
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.aiApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          system: params.sistem,
          max_tokens: maxToken,
          messages: [{ role: 'user', content: params.pesan }],
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) {
        throw new Error(`API AI mengembalikan status ${res.status}`);
      }
      const data = (await res.json()) as any;
      return (data.content || []).map((c: any) => c.text || '').join('');
    }
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new Error('Permintaan ke AI terlalu lama atau batas waktu terlampaui.');
    }
    throw new Error('Gagal menghubungi layanan AI. Silakan coba sesaat lagi.');
  }
}

/**
 * Panggil AI untuk obrolan interaktif asisten papan tulis (POST /api/ai/obrol)
 */
export async function obrolDenganAI(params: {
  pesan: AiPesanItem[];
}): Promise<{ jawaban: string }> {
  const { pesan } = params;

  // 1. Pangkas ke 10 pesan terakhir dan wajib diawali oleh pesan role 'user'
  let riwayat = pesan.slice(-10);
  while (riwayat.length > 0 && riwayat[0].role !== 'user') {
    riwayat.shift();
  }

  if (riwayat.length === 0) {
    return {
      jawaban: 'Silakan ajukan pertanyaan atau lampirkan materi pembelajaran.',
    };
  }

  // 2. Jika API key belum diatur, kembalikan respon ramah tanpa error
  if (!config.aiApiKey) {
    const pesanTerakhir = riwayat[riwayat.length - 1];
    const userPrompt = pesanTerakhir?.teks?.toLowerCase() || '';

    let jawabanFallback =
      'Halo Guru! Saya adalah Asisten AI Pembelajaran Discere di papan tulis. ' +
      'Kunci `AI_API_KEY` belum dikonfigurasi di server (.env). Anda dapat mengatur `AI_API_KEY` dan `AI_MODEL` ' +
      'agar saya dapat memberikan analisis cerdas dan materi lengkap secara real-time.';

    if (userPrompt.includes('soal') || userPrompt.includes('kuis')) {
      jawabanFallback += '\n\nContoh ide soal matematika:\n1. 15 x 6 = ? (Jawaban: 90)\n2. 125 : 5 = ? (Jawaban: 25)';
    } else if (userPrompt.includes('ringkas') || userPrompt.includes('materi')) {
      jawabanFallback += '\n\nTips Mengajar: Gunakan visual diagram atau tabel di papan tulis untuk memperjelas konsep bagi siswa.';
    }

    return { jawaban: jawabanFallback };
  }

  const model = config.aiModel || 'gemini-1.5-flash';
  const isClaude = model.includes('claude') || model.includes('anthropic');

  try {
    if (!isClaude) {
      // ----------------------------------------
      // Implementasi Google Generative AI (Gemini)
      // ----------------------------------------
      const contents = riwayat.map((p) => {
        const role = p.role === 'user' ? 'user' : 'model';
        const parts: any[] = [];

        // Gabungkan teks dengan lampiran teks jika ada
        let teksUtuh = p.teks || '';
        if (p.lampiran && p.lampiran.length > 0) {
          for (const lamp of p.lampiran) {
            if (lamp.jenis === 'teks' && lamp.teks) {
              teksUtuh += `\n\n[File: ${lamp.nama}]\n${lamp.teks}`;
            }
          }
        }

        if (teksUtuh) {
          parts.push({ text: teksUtuh });
        }

        // Lampiran gambar dan PDF (inlineData)
        if (p.lampiran && p.lampiran.length > 0) {
          for (const lamp of p.lampiran) {
            if (lamp.data) {
              const cleanBase64 = lamp.data.replace(/^data:[^;]+;base64,/, '');
              const mime =
                lamp.mt ||
                (lamp.jenis === 'pdf' ? 'application/pdf' : 'image/png');

              parts.push({
                inlineData: {
                  mimeType: mime,
                  data: cleanBase64,
                },
              });
            }
          }
        }

        if (parts.length === 0) {
          parts.push({ text: 'Jelaskan materi ini.' });
        }

        return { role, parts };
      });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.aiApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: PROMPT_SISTEM_OBROL }],
          },
          contents,
          generationConfig: {
            maxOutputTokens: 2500,
          },
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        throw new Error(`Layanan AI memberikan kode respon ${response.status}`);
      }

      const data = (await response.json()) as any;
      const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOut) {
        return { jawaban: 'Maaf, asisten AI tidak memberikan teks balasan.' };
      }

      return { jawaban: textOut.trim() };
    } else {
      // ----------------------------------------
      // Implementasi Anthropic (Claude)
      // ----------------------------------------
      const messages = riwayat.map((p) => {
        const role = p.role;
        const content: any[] = [];
        let teksUtuh = p.teks || '';

        if (p.lampiran && p.lampiran.length > 0) {
          for (const lamp of p.lampiran) {
            if (lamp.jenis === 'teks' && lamp.teks) {
              teksUtuh += `\n\n[File: ${lamp.nama}]\n${lamp.teks}`;
            } else if (lamp.jenis === 'gambar' && lamp.data) {
              const cleanBase64 = lamp.data.replace(/^data:[^;]+;base64,/, '');
              content.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: lamp.mt || 'image/png',
                  data: cleanBase64,
                },
              });
            } else if (lamp.jenis === 'pdf' && lamp.data) {
              const cleanBase64 = lamp.data.replace(/^data:[^;]+;base64,/, '');
              content.push({
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: cleanBase64,
                },
              });
            }
          }
        }

        content.push({
          type: 'text',
          text: teksUtuh || 'Jelaskan materi ini.',
        });

        return { role, content };
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.aiApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2500,
          system: PROMPT_SISTEM_OBROL,
          messages,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        throw new Error(`Layanan AI memberikan kode respon ${response.status}`);
      }

      const data = (await response.json()) as any;
      const textOut = (data.content || []).map((c: any) => c.text || '').join('');
      if (!textOut) {
        return { jawaban: 'Maaf, asisten AI tidak memberikan teks balasan.' };
      }

      return { jawaban: textOut.trim() };
    }
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new Error('Waktu respon AI terlalu lama (melebihi 60 detik).');
    }
    throw new Error('Gagal menghubungi layanan AI. Silakan coba kembali.');
  }
}
