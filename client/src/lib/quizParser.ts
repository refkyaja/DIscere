export interface QuestionItem {
  urutan: number;
  teks: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  jawabanBenar: 'A' | 'B' | 'C';
  penjelasan?: string;
  kesulitan?: 'mudah' | 'sedang' | 'sulit';
  dibuatAi?: boolean;
}

export const PROMPT_TEMPLATE = `Buatkan [jumlah] soal pilihan ganda tentang [topik] untuk kuis interaktif (3 pilihan jawaban: A, B, C), masing-masing dengan format persis seperti contoh ini:

1. Apa ibu kota Indonesia?
A. Bandung
B. Jakarta
C. Surabaya
Jawaban: B
Pembahasan: Jakarta adalah ibu kota Indonesia

Pisahkan tiap soal dengan baris kosong. Jangan pakai markdown (bold/italic), jangan kasih judul atau intro di awal, dan jangan tambahkan teks lain di luar format itu.`;

export const CONTOH_TEXT = `1. Apa ibu kota negara Indonesia?
A. Bandung
B. Jakarta
C. Surabaya
Jawaban: B
Pembahasan: Jakarta merupakan ibu kota negara Indonesia saat ini.

2. Lambang sila pertama dalam Pancasila adalah...
A. Bintang emas
B. Rantai baja
C. Pohon beringin
Jawaban: A
Pembahasan: Bintang emas berlatar hitam melambangkan sila Ketuhanan Yang Maha Esa.

3. Hasil dari 25 + 15 × 2 adalah...
A. 80
B. 55
C. 70
Jawaban: B
Pembahasan: Operasi perkalian dikerjakan terlebih dahulu: 15 × 2 = 30, lalu 25 + 30 = 55.`;

export function parseAiQuizText(rawText: string): QuestionItem[] {
  if (!rawText.trim()) return [];

  // 1. Bersihkan formatting markdown & escape backslash dari ChatGPT/Claude
  const textClean = rawText
    .replace(/\r\n/g, '\n')
    // Hapus escape backslash markdown (misal: 1\., A\., atau backslash di akhir baris \)
    .replace(/\\([.\-_*+?^=!:${}()|[\]\/\\])/g, '$1')
    .replace(/\\$/gm, '')
    .replace(/\\/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '');

  // 2. Pisahkan blok soal berdasarkan pola penomoran baru di awal baris:
  // Contoh: 1. atau 1) atau (1) atau [1] atau Soal 1: atau Pertanyaan 1:
  const rawBlocks = textClean.split(/(?:^|\n)(?=(?:(?:Soal|Pertanyaan)\s*)?(?:\(?\d+[\.\)\:\-]|\[\d+\]|\b\d+[\.\)]))\s*/i);

  const hasil: QuestionItem[] = [];

  for (const block of rawBlocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;

    let teksSoal = '';
    let opsiA = '';
    let opsiB = '';
    let opsiC = '';
    let opsiD = '';
    let opsiE = '';
    let jawabanBenar: 'A' | 'B' | 'C' = 'A';
    let kunciDitemukan = '';
    let penjelasan = '';

    for (const line of lines) {
      // 1. Baris pertanyaan utama (angka diikuti titik/kurung/titik-dua)
      const soalMatch = line.match(/^(?:(?:Soal|Pertanyaan)\s*)?(?:\(?\d+[\.\)\:\-]|\[\d+\])\s*(.+)$/i);
      if (soalMatch && !teksSoal) {
        teksSoal = soalMatch[1].trim();
        continue;
      }

      // 2. Opsi A, B, C, D, E (mendukung A., A), (A), [A], A:, a.)
      const opsiMatch = line.match(/^(?:\(?([A-Ea-e])[\.\)\:\-]|\[([A-Ea-e])\])\s*(.+)$/i);
      if (opsiMatch) {
        const huruf = (opsiMatch[1] || opsiMatch[2]).toUpperCase();
        const isi = opsiMatch[3].trim();
        if (huruf === 'A') opsiA = isi;
        else if (huruf === 'B') opsiB = isi;
        else if (huruf === 'C') opsiC = isi;
        else if (huruf === 'D') opsiD = isi;
        else if (huruf === 'E') opsiE = isi;
        continue;
      }

      // 3. Kunci Jawaban (Jawaban: B, Kunci: B, Kunci Jawaban: B. Kupu-kupu, Jawaban Benar: B)
      const kunciMatch = line.match(/^(?:Jawaban(?: Benar)?|Kunci(?: Jawaban)?)\s*:?\s*(?:\(?([A-Ea-e])[\.\)]?|[A-Ea-e]\b)/i);
      if (kunciMatch) {
        kunciDitemukan = (kunciMatch[1] || kunciMatch[0].slice(-1)).toUpperCase();
        continue;
      }

      // 4. Pembahasan / Penjelasan
      const pembahasanMatch = line.match(/^(?:Pembahasan|Penjelasan)\s*:?\s*(.+)$/i);
      if (pembahasanMatch) {
        penjelasan = pembahasanMatch[1].trim();
        continue;
      }

      // 5. Sambungan teks atau baris lain
      if (!teksSoal && !opsiMatch && !kunciMatch && !pembahasanMatch) {
        teksSoal = line;
      } else if (penjelasan) {
        penjelasan += ' ' + line;
      } else if (teksSoal && !opsiA) {
        teksSoal += ' ' + line;
      }
    }

    // Pastikan pertanyaan dan minimal opsi A & B ada
    if (teksSoal && opsiA && opsiB) {
      // Jika opsi C kosong tetapi ada D
      if (!opsiC && opsiD) opsiC = opsiD;

      // Adaptasi kunci jika jatuh di D atau E agar cocok dengan 3 opsi mini-game Discere
      if (kunciDitemukan === 'D' && opsiD) {
        opsiC = opsiD;
        jawabanBenar = 'C';
      } else if (kunciDitemukan === 'E' && opsiE) {
        opsiC = opsiE;
        jawabanBenar = 'C';
      } else if (['A', 'B', 'C'].includes(kunciDitemukan)) {
        jawabanBenar = kunciDitemukan as 'A' | 'B' | 'C';
      }

      hasil.push({
        urutan: hasil.length + 1,
        teks: teksSoal,
        opsiA,
        opsiB,
        opsiC: opsiC || 'Pilihan lainnya',
        jawabanBenar,
        penjelasan,
        dibuatAi: true,
      });
    }
  }

  return hasil;
}
