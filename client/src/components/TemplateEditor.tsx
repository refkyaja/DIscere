import React, { useState } from 'react';
import { apiRequest } from '../lib/api';
import { Modal } from './Modal';
import {
  Plus,
  Minus,
  X,
  Trash2,
  Save,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Edit3,
} from 'lucide-react';
import {
  parseAiQuizText,
  PROMPT_TEMPLATE,
  KODE_OPSI_SOAL,
  hitungJumlahOpsiAktif,
  type QuestionItem,
  type KunciOpsi,
} from '../lib/quizParser';

export const GAME_LABELS: Record<string, string> = {
  tarik_tambang: 'Tarik Tambang',
  makan_kerupuk: 'Makan Kerupuk',
  panjat_pinang: 'Panjat Pinang',
  balap_karung: 'Balap Karung',
};

export function formatLabelGame(game?: string): string {
  return GAME_LABELS[game || 'tarik_tambang'] || 'Tarik Tambang';
}

export interface TemplateEditorInitialData {
  judul: string;
  game: string;
  mode: 'solo' | 'multi';
  questions: QuestionItem[];
}

export interface TemplateEditorPayload {
  judul: string;
  game: string;
  mode: 'solo' | 'multi';
  questions: Array<{
    urutan: number;
    teks: string;
    opsiA: string;
    opsiB: string;
    opsiC: string | null;
    opsiD?: string | null;
    opsiE?: string | null;
    jawabanBenar: KunciOpsi;
    penjelasan: string | null;
    kesulitan: 'mudah' | 'sedang' | 'sulit';
    dibuatAi: boolean;
  }>;
}

export interface TemplateEditorProps {
  initialData?: TemplateEditorInitialData;
  onSubmit: (payload: TemplateEditorPayload) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  judulPlaceholder?: string;
  externalError?: string | null;
}

function createEmptyQuestion(urutan = 1): QuestionItem {
  return {
    urutan,
    teks: '',
    opsiA: '',
    opsiB: '',
    opsiC: '',
    opsiD: '',
    opsiE: '',
    opsiAktif: 3,
    jawabanBenar: 'A',
    penjelasan: '',
    kesulitan: 'sedang',
    dibuatAi: false,
  };
}

/** Editor materi & soal kuis bersama untuk portal Guru dan Pustaka Resmi Admin. */
export function TemplateEditor({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Simpan Template',
  judulPlaceholder = 'Contoh: Pecahan Campuran Kelas 5 atau Sejarah Proklamasi',
  externalError = null,
}: TemplateEditorProps) {
  const initialGame = initialData?.game || 'tarik_tambang';
  const initialMode: 'solo' | 'multi' =
    initialGame === 'panjat_pinang'
      ? 'multi'
      : initialData?.mode || 'solo';

  const [judul, setJudul] = useState(initialData?.judul ?? '');
  const [game, setGame] = useState(initialGame);
  const [mode, setMode] = useState<'solo' | 'multi'>(initialMode);
  const [questions, setQuestions] = useState<QuestionItem[]>(() =>
    initialData?.questions && initialData.questions.length > 0
      ? initialData.questions.map((q, idx) => {
          const aktif = hitungJumlahOpsiAktif(q);
          const validKeys = KODE_OPSI_SOAL.slice(0, aktif);
          return {
            urutan: q.urutan || idx + 1,
            teks: q.teks || '',
            opsiA: q.opsiA || '',
            opsiB: q.opsiB || '',
            opsiC: q.opsiC || '',
            opsiD: q.opsiD || '',
            opsiE: q.opsiE || '',
            opsiAktif: aktif,
            jawabanBenar: validKeys.includes(q.jawabanBenar) ? q.jawabanBenar : 'A',
            penjelasan: q.penjelasan || '',
            kesulitan: q.kesulitan || 'sedang',
            dibuatAi: Boolean(q.dibuatAi),
          };
        })
      : [createEmptyQuestion(1)]
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);

  // Mode Input: manual (Input Manual) | tempel_ai (Tempel Teks AI)
  const [modeInput, setModeInput] = useState<'manual' | 'tempel_ai'>('manual');
  const [teksTempelAi, setTeksTempelAi] = useState('');
  const [errorTempel, setErrorTempel] = useState<string | null>(null);
  const [suksesTempel, setSuksesTempel] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

  // State Generator Soal AI (Modal Otomatis)
  const [modalAiOpen, setModalAiOpen] = useState(false);
  const [aiMateri, setAiMateri] = useState('');
  const [aiJumlah, setAiJumlah] = useState<number>(5);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuksesPesan, setAiSuksesPesan] = useState<string | null>(null);

  const bukaModalAi = () => {
    setAiError(null);
    setAiSuksesPesan(null);
    setModalAiOpen(true);
  };

  const handleGenerateAi = async () => {
    if (!aiMateri.trim() || aiMateri.trim().length < 20) {
      setAiError('Teks materi minimal 20 karakter agar AI dapat menyusun soal yang mendidik.');
      return;
    }

    try {
      setAiLoading(true);
      setAiError(null);
      const res = await apiRequest<{
        sukses?: boolean;
        soal?: Array<{
          urutan?: number;
          teks: string;
          opsiA: string;
          opsiB: string;
          opsiC?: string | null;
          opsiD?: string | null;
          opsiE?: string | null;
          jawabanBenar: KunciOpsi;
          penjelasan?: string;
          kesulitan?: 'mudah' | 'sedang' | 'sulit';
        }>;
        questions?: Array<{
          urutan?: number;
          teks: string;
          opsiA: string;
          opsiB: string;
          opsiC?: string | null;
          opsiD?: string | null;
          opsiE?: string | null;
          jawabanBenar: KunciOpsi;
          penjelasan?: string;
          kesulitan?: 'mudah' | 'sedang' | 'sulit';
        }>;
      }>('/ai/soal', {
        method: 'POST',
        body: JSON.stringify({
          materi: aiMateri.trim(),
          jumlah: aiJumlah,
          jumlahSoal: aiJumlah,
        }),
      });

      const daftarSoal = res.soal || res.questions || [];

      if (daftarSoal.length > 0) {
        const aiQuestionsFormatted: QuestionItem[] = daftarSoal.map((q, idx) => {
          const aktif = hitungJumlahOpsiAktif(q);
          const validKeys = KODE_OPSI_SOAL.slice(0, aktif);
          return {
            urutan: idx + 1,
            teks: q.teks,
            opsiA: q.opsiA,
            opsiB: q.opsiB,
            opsiC: q.opsiC || '',
            opsiD: q.opsiD || '',
            opsiE: q.opsiE || '',
            opsiAktif: aktif,
            jawabanBenar: validKeys.includes(q.jawabanBenar) ? q.jawabanBenar : 'A',
            penjelasan: q.penjelasan || '',
            kesulitan: q.kesulitan || 'sedang',
            dibuatAi: true,
          };
        });

        setQuestions(aiQuestionsFormatted);
        setModeInput('manual');
        setAiSuksesPesan(`Berhasil menghasilkan ${aiQuestionsFormatted.length} soal kuis!`);

        setTimeout(() => {
          setModalAiOpen(false);
          setAiSuksesPesan(null);
          setAiMateri('');
        }, 1200);
      } else {
        setAiError('Tidak ada soal yang berhasil dihasilkan. Silakan coba lagi.');
      }
    } catch (err: any) {
      setAiError(err.pesan || 'Gagal menghasilkan soal dengan AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSalinPrompt = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT_TEMPLATE);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      alert('Gagal menyalin otomatis. Anda dapat menyalin teks prompt di dalam kotak secara manual.');
    }
  };

  const handleKonversiTeksAi = () => {
    setErrorTempel(null);
    setSuksesTempel(null);

    if (!teksTempelAi.trim()) {
      setErrorTempel('Silakan tempelkan teks hasil generate dari ChatGPT / Claude terlebih dahulu.');
      return;
    }

    const hasilParse = parseAiQuizText(teksTempelAi);
    if (hasilParse.length === 0) {
      setErrorTempel(
        'Format teks belum terbaca dengan tepat. Pastikan terdapat nomor soal, minimal opsi A dan B (hingga E), serta baris "Jawaban: X" sesuai contoh format.'
      );
      return;
    }

    setQuestions(
      hasilParse.map((q) => ({
        ...q,
        opsiC: q.opsiC || '',
        opsiD: q.opsiD || '',
        opsiE: q.opsiE || '',
        opsiAktif: q.opsiAktif ?? hitungJumlahOpsiAktif(q),
        kesulitan: q.kesulitan || 'sedang',
      }))
    );
    setSuksesTempel(
      `Berhasil mengimpor ${hasilParse.length} butir soal dari AI! Anda dapat meninjau dan mengeditnya di bawah.`
    );
    setModeInput('manual');
  };

  const handleTambahSoal = () => {
    setQuestions((prev) => [...prev, createEmptyQuestion(prev.length + 1)]);
  };

  const handleHapusSoal = (index: number) => {
    if (questions.length <= 1) {
      alert('Template wajib memiliki minimal 1 soal.');
      return;
    }
    setQuestions((prev) =>
      prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, urutan: i + 1 }))
    );
  };

  const handleUpdateSoal = (
    index: number,
    field: keyof QuestionItem,
    value: any
  ) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleTambahOpsi = (index: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q;
        const aktif = Math.min(5, Math.max(2, q.opsiAktif ?? hitungJumlahOpsiAktif(q)) + 1);
        return { ...q, opsiAktif: aktif };
      })
    );
  };

  const handleHapusOpsi = (index: number, keyDihapus?: KunciOpsi) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q;
        const currentAktif = Math.max(2, Math.min(5, q.opsiAktif ?? hitungJumlahOpsiAktif(q)));
        if (currentAktif <= 2) return q;

        const targetKey = keyDihapus ?? KODE_OPSI_SOAL[currentAktif - 1];
        const removeIdx = KODE_OPSI_SOAL.indexOf(targetKey);
        if (removeIdx < 0 || removeIdx >= currentAktif) return q;

        const aktifValues = KODE_OPSI_SOAL.slice(0, currentAktif).map((k) => {
          const fk = `opsi${k}` as 'opsiA' | 'opsiB' | 'opsiC' | 'opsiD' | 'opsiE';
          return (q[fk] as string) || '';
        });

        const keyIdx = KODE_OPSI_SOAL.indexOf(q.jawabanBenar);
        const remainingValues = aktifValues.filter((_, idx) => idx !== removeIdx);
        const newAktif = remainingValues.length;

        let newJawaban: KunciOpsi = 'A';
        if (keyIdx !== removeIdx && keyIdx >= 0 && keyIdx < currentAktif) {
          const shiftedIdx = keyIdx > removeIdx ? keyIdx - 1 : keyIdx;
          newJawaban = KODE_OPSI_SOAL[shiftedIdx] || 'A';
        }

        return {
          ...q,
          opsiA: remainingValues[0] || '',
          opsiB: remainingValues[1] || '',
          opsiC: remainingValues[2] || '',
          opsiD: remainingValues[3] || '',
          opsiE: remainingValues[4] || '',
          opsiAktif: newAktif,
          jawabanBenar: newJawaban,
        };
      })
    );
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPesan(null);

    if (!judul.trim()) {
      setErrorPesan('Judul materi wajib diisi.');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.teks.trim()) {
        setErrorPesan(`Teks pertanyaan soal #${i + 1} belum diisi.`);
        setModeInput('manual');
        return;
      }
      const activeCount = Math.min(5, Math.max(2, q.opsiAktif ?? hitungJumlahOpsiAktif(q)));
      const activeKeys = KODE_OPSI_SOAL.slice(0, activeCount);
      const adaOpsiKosong = activeKeys.some((k) => {
        const fk = `opsi${k}` as 'opsiA' | 'opsiB' | 'opsiC' | 'opsiD' | 'opsiE';
        return !((q[fk] as string) || '').trim();
      });
      if (adaOpsiKosong) {
        setErrorPesan(
          `Semua pilihan jawaban aktif (${activeKeys.join(', ')}) pada soal #${i + 1} wajib diisi.`
        );
        setModeInput('manual');
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload: TemplateEditorPayload = {
        judul: judul.trim(),
        game,
        mode,
        questions: questions.map((q, idx) => {
          const activeCount = Math.min(5, Math.max(2, q.opsiAktif ?? hitungJumlahOpsiAktif(q)));
          const activeKeys = KODE_OPSI_SOAL.slice(0, activeCount);
          return {
            urutan: idx + 1,
            teks: q.teks.trim(),
            opsiA: q.opsiA.trim(),
            opsiB: q.opsiB.trim(),
            opsiC: activeCount >= 3 ? (q.opsiC || '').trim() : null,
            opsiD: activeCount >= 4 ? (q.opsiD || '').trim() : null,
            opsiE: activeCount >= 5 ? (q.opsiE || '').trim() : null,
            jawabanBenar: activeKeys.includes(q.jawabanBenar) ? q.jawabanBenar : 'A',
            penjelasan: q.penjelasan ? q.penjelasan.trim() : null,
            kesulitan: q.kesulitan || 'sedang',
            dibuatAi: Boolean(q.dibuatAi),
          };
        }),
      };

      await onSubmit(payload);
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal menyimpan template.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayedError = errorPesan || externalError;

  return (
    <>
      {displayedError && (
        <div className="portal-banner error mb-6">
          <AlertTriangle className="w-5 h-5 shrink-0 text-[#c8362f]" />
          <span className="font-bold text-[#c8362f]">{displayedError}</span>
        </div>
      )}

      <form onSubmit={handleSimpan} className="space-y-6">
        {/* Metadata Template dalam Card Kertas Krem */}
        <div className="portal-card p-6 space-y-4">
          <h2 className="portal-cv text-2xl text-[#1d3b2e]">Informasi Utama Materi</h2>

          <div>
            <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1.5">
              Judul Materi / Topik Soal
            </label>
            <input
              type="text"
              placeholder={judulPlaceholder}
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              className="portal-input font-bold text-base"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1.5">
                Jenis Game
              </label>
              <select
                value={game}
                onChange={(e) => {
                  const newGame = e.target.value;
                  setGame(newGame);
                  if (newGame === 'panjat_pinang') {
                    setMode('multi');
                  }
                }}
                className="portal-select"
              >
                <option value="tarik_tambang">Tarik Tambang Edukasi (Beregu / Solo)</option>
                <option value="makan_kerupuk">Makan Kerupuk Challenge (Dual Mode: Multi / Solo)</option>
                <option value="panjat_pinang">Panjat Pinang (Individu Multiplayer)</option>
                <option value="balap_karung">Balap Karung Challenge (Dual Mode: Multi / Solo)</option>
              </select>
              <span className="text-[11px] text-[#6b7d6c] mt-1 block">
                {game === 'makan_kerupuk'
                  ? 'Mendukung Multiplayer (HP siswa) dan Solo Mode (1 perangkat guru di proyektor) saat memulai permainan.'
                  : game === 'panjat_pinang'
                  ? 'Lomba memanjat tiang pinang menuju puncak 100% dengan bonus streak dan rintangan opsional.'
                  : game === 'balap_karung'
                  ? 'Lomba balap karung Dual Mode: Multiplayer lewat HP siswa maupun Solo 1 vs 1 di layar proyektor.'
                  : 'Game lomba tarik tambang klasik untuk Discere.'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1.5">
                Mode Permainan Default
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'solo' | 'multi')}
                className="portal-select"
              >
                <option value="multi">
                  {game === 'tarik_tambang'
                    ? 'Mode Multiplayer (Team Multiplayer via PIN & QR)'
                    : 'Mode Multiplayer (HP Siswa Masing-Masing)'}
                </option>
                {game !== 'panjat_pinang' && (
                  <option value="solo">
                    {game === 'makan_kerupuk'
                      ? 'Mode Solo (Satu Perangkat Guru / Proyektor)'
                      : game === 'balap_karung'
                      ? 'Mode Solo (Duel 1 vs 1 di Layar Proyektor)'
                      : game === 'tarik_tambang'
                      ? 'Mode Solo (Duel 1 vs 1 pada Satu Perangkat Guru)'
                      : 'Mode Solo (Satu Layar Bersama)'}
                  </option>
                )}
              </select>
              <span className="text-[11px] text-[#6b7d6c] mt-1 block">
                {game === 'makan_kerupuk' || game === 'balap_karung'
                  ? 'Saat memulai permainan nanti, Anda tetap bebas memilih Multiplayer maupun Solo Mode.'
                  : game === 'tarik_tambang'
                  ? 'Mode permainan Tarik Tambang (Solo 1 vs 1 atau Team Multiplayer) ditetapkan langsung melalui pilihan template ini.'
                  : game === 'panjat_pinang'
                  ? 'Setiap siswa bergabung menggunakan HP masing-masing dan bertanding secara individu.'
                  : 'Pilih cara siswa berpartisipasi dalam sesi kelas.'}
              </span>
            </div>
          </div>
        </div>

        {/* Bagian Soal: Tab Switcher (Input Manual & Tempel Teks AI) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="portal-seg">
              <button
                type="button"
                className={modeInput === 'manual' ? 'on' : ''}
                onClick={() => setModeInput('manual')}
              >
                <Edit3 className="w-4 h-4 inline-block mr-1.5" />
                Input Manual ({questions.length})
              </button>
              <button
                type="button"
                className={modeInput === 'tempel_ai' ? 'on' : ''}
                onClick={() => setModeInput('tempel_ai')}
              >
                Tempel Teks (AI)
              </button>
            </div>

            {modeInput === 'manual' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={bukaModalAi}
                  className="portal-btn sm"
                  style={{ background: '#f2c230', color: '#1d3b2e' }}
                  title="Buat soal instan dari rangkuman materi dengan AI Discere"
                >
                  <span>AI Otomatis</span>
                </button>
              </div>
            )}
          </div>

          {suksesTempel && (
            <div className="portal-banner success">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <div className="flex-1 text-xs">
                <span className="font-bold block text-emerald-800">{suksesTempel}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuksesTempel(null)}
                className="text-xs font-bold underline text-emerald-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {/* TAB 1: TEMPEL TEKS AI (PERSIS FORMAT REFERENSI CHATGPT / CLAUDE) */}
          {modeInput === 'tempel_ai' && (
            <div className="space-y-5">
              {/* Kotak Prompt Siap Pakai */}
              <div
                className="portal-card p-6 space-y-3"
                style={{ background: '#f5eee0', border: '2px dashed #d6c6a5' }}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-[#1d3b2e] text-base">
                      Belum punya soal? Salin prompt ini untuk AI
                    </h3>
                    <p className="text-xs text-[#6b7d6c] mt-0.5">
                      Kirimkan prompt ini ke ChatGPT, Claude, atau DeepSeek untuk menghasilkan butir soal yang siap ditempel.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSalinPrompt}
                    className="portal-btn sm shrink-0"
                    style={{
                      background: promptCopied ? '#2e7d32' : '#8a6a00',
                      color: '#ffffff',
                    }}
                  >
                    {promptCopied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Salin Prompt</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-[#244335] text-[#f4ecd8] font-mono text-xs leading-relaxed overflow-x-auto border border-[#163a2b] shadow-inner">
                  <pre className="whitespace-pre-wrap">{PROMPT_TEMPLATE}</pre>
                </div>

                <p className="text-xs text-[#6b7d6c] flex items-center gap-1.5 pt-1">
                  <span>💡</span>
                  <span>
                    <strong>Tips:</strong> Ganti{' '}
                    <code className="px-1.5 py-0.5 rounded bg-[#e8deca] text-[#1d3b2e]">[jumlah]</code> dan{' '}
                    <code className="px-1.5 py-0.5 rounded bg-[#e8deca] text-[#1d3b2e]">[topik]</code> sebelum
                    dikirim ke ChatGPT / Claude.
                  </span>
                </p>
              </div>

              {/* Kotak Tempel Teks Hasil AI */}
              <div className="portal-card p-6 space-y-4">
                <div className="border-b border-[#e0d5b8] pb-3">
                  <h3 className="portal-cv text-2xl text-[#1d3b2e]">
                    Tempelkan Teks Hasil Generate AI (ChatGPT / Claude)
                  </h3>
                  <p className="text-xs text-[#6b7d6c] mt-0.5">
                    Tempelkan teks daftar soal di bawah. Sistem DISCERE akan otomatis mengekstrak nomor soal, opsi A–E (minimal A dan B), serta kunci jawaban.
                  </p>
                </div>

                {errorTempel && (
                  <div className="portal-banner error">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-[#c8362f]" />
                    <span className="font-bold text-[#c8362f] text-xs">{errorTempel}</span>
                  </div>
                )}

                <div>
                  <textarea
                    rows={10}
                    value={teksTempelAi}
                    onChange={(e) => setTeksTempelAi(e.target.value)}
                    placeholder="Paste teks daftar soal di sini...&#10;&#10;Contoh format:&#10;1. Apa ibu kota Indonesia?&#10;A. Bandung&#10;B. Jakarta&#10;C. Surabaya&#10;Jawaban: B&#10;Pembahasan: Jakarta adalah ibu kota Indonesia"
                    className="portal-input font-mono text-xs leading-relaxed"
                  />
                  <div className="flex items-center justify-between text-[11px] text-[#6b7d6c] mt-1.5">
                    <span>{teksTempelAi.length} karakter</span>
                    <span>Format: Nomor, Pertanyaan, Opsi A–E (min A–B), Jawaban: X</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e0d5b8]">
                  <div className="flex items-center gap-2">
                    {teksTempelAi && (
                      <button
                        type="button"
                        onClick={() => {
                          setTeksTempelAi('');
                          setErrorTempel(null);
                        }}
                        className="portal-btn ghost sm"
                      >
                        Bersihkan
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleKonversiTeksAi}
                      className="portal-btn red sm"
                      disabled={!teksTempelAi.trim()}
                    >
                      <span>Konversi & Masukkan ke Soal</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INPUT MANUAL (DAFTAR KARTU SOAL) */}
          {modeInput === 'manual' && (
            <div className="space-y-4">
              {questions.map((soal, index) => (
                <div key={index} className="portal-card p-6 space-y-4 relative">
                  <div className="flex items-center justify-between border-b-2 border-dashed border-[#e0d5b8] pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="portal-cv text-2xl text-[#c8362f]">
                        Soal #{index + 1}
                      </span>
                      {soal.dibuatAi && (
                        <span className="portal-tag yellow">
                          Dibuat AI
                        </span>
                      )}
                    </div>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleHapusSoal(index)}
                        className="portal-btn ghost-red sm"
                        title="Hapus Soal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#6b7d6c] uppercase tracking-wider mb-1">
                      Teks Pertanyaan Kuis
                    </label>
                    <textarea
                      rows={2}
                      className="portal-input font-medium"
                      placeholder={`Tuliskan pertanyaan soal nomor ${index + 1}...`}
                      value={soal.teks}
                      onChange={(e) => handleUpdateSoal(index, 'teks', e.target.value)}
                      required
                    />
                  </div>

                  {/* Pilihan Jawaban Dinamis (2–5 Opsi: A–E) */}
                  {(() => {
                    const activeCount = Math.min(
                      5,
                      Math.max(2, soal.opsiAktif ?? hitungJumlahOpsiAktif(soal))
                    );
                    const activeKeys = KODE_OPSI_SOAL.slice(0, activeCount);
                    const nextKey = KODE_OPSI_SOAL[activeCount];

                    return (
                      <div className="space-y-3 pt-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="block text-xs font-bold text-[#6b7d6c] uppercase tracking-wider">
                            Pilihan Jawaban &amp; Kunci Benar ({activeCount} Opsi &bull; Min 2, Maks E)
                          </label>
                          <div className="flex items-center gap-1.5">
                            {activeCount > 2 && (
                              <button
                                type="button"
                                onClick={() => handleHapusOpsi(index)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#fbf6e9] text-[#6b7d6c] border border-[#e0d5b8] hover:text-[#c8362f] hover:border-[#c8362f] transition-colors cursor-pointer"
                                title={`Kurangi opsi terakhir (${activeKeys[activeKeys.length - 1]})`}
                              >
                                <Minus className="w-3 h-3" />
                                <span>Kurangi ({activeKeys[activeKeys.length - 1]})</span>
                              </button>
                            )}
                            {activeCount < 5 && nextKey && (
                              <button
                                type="button"
                                onClick={() => handleTambahOpsi(index)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#f8e7b0] text-[#1d3b2e] border border-[#e2c66d] hover:bg-[#f2c230] transition-colors cursor-pointer"
                                title={`Tambah Pilihan ${nextKey} (maksimal sampai E)`}
                              >
                                <Plus className="w-3 h-3" />
                                <span>Tambah Opsi {nextKey}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {activeKeys.map((opsiKey) => {
                          const fieldKey = `opsi${opsiKey}` as keyof QuestionItem;
                          const isSelected = soal.jawabanBenar === opsiKey;

                          return (
                            <div key={opsiKey} className="flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateSoal(index, 'jawabanBenar', opsiKey)}
                                className={`w-10 h-10 rounded-xl font-extrabold flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#1f4a37] text-[#f4ecd8] shadow-md ring-2 ring-[#f2c230]'
                                    : 'bg-[#f4ecd9] text-[#1d3b2e] hover:bg-[#e0d5b8]'
                                }`}
                                title={`Jadikan Opsi ${opsiKey} sebagai Kunci Jawaban`}
                              >
                                {opsiKey}
                              </button>
                              <input
                                type="text"
                                className="portal-input flex-1"
                                placeholder={`Jawaban untuk Pilihan ${opsiKey}...`}
                                value={(soal[fieldKey] as string) || ''}
                                onChange={(e) => handleUpdateSoal(index, fieldKey, e.target.value)}
                                required
                              />
                              {isSelected && (
                                <span className="portal-tag green shrink-0">
                                  ✓ Kunci Benar
                                </span>
                              )}
                              {activeCount > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleHapusOpsi(index, opsiKey)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[#6b7d6c] hover:text-[#c8362f] hover:bg-[#fdecec] transition-colors cursor-pointer"
                                  title={`Hapus Opsi ${opsiKey}`}
                                  aria-label={`Hapus Opsi ${opsiKey}`}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-xs font-bold text-[#6b7d6c] uppercase tracking-wider mb-1">
                      Penjelasan Pembahasan (Opsional)
                    </label>
                    <input
                      type="text"
                      className="portal-input text-xs"
                      placeholder="Contoh: Penjelasan materi mengapa jawaban ini benar..."
                      value={soal.penjelasan || ''}
                      onChange={(e) => handleUpdateSoal(index, 'penjelasan', e.target.value)}
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleTambahSoal}
                className="portal-btn ghost w-full justify-center py-3"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Soal Berikutnya</span>
              </button>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-dashed border-[#f4ecd8]/30">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="portal-btn ghost"
          >
            Batal
          </button>
          <button type="submit" disabled={submitting} className="portal-btn red">
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Menyimpan...' : submitLabel}</span>
          </button>
        </div>
      </form>

      {/* Modal Generator Soal AI */}
      <Modal
        isOpen={modalAiOpen}
        onClose={() => !aiLoading && setModalAiOpen(false)}
        title="Buat Soal Otomatis dengan AI"
        maxWidth="lg"
      >
        <div className="space-y-3.5">
          {aiError && (
            <div className="p-3 rounded-2xl bg-[#fde8e7] border border-[#c8362f]/40 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#c8362f]" />
              <span className="text-xs font-bold text-[#c8362f]">{aiError}</span>
            </div>
          )}

          {aiSuksesPesan && (
            <div className="p-3 rounded-2xl bg-[#e8f5e9] border border-[#2e7d32]/40 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2e7d32]" />
              <span className="text-xs font-bold text-[#1b5e20]">{aiSuksesPesan}</span>
            </div>
          )}

          {/* Input Materi */}
          <div>
            <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1">
              Teks Rangkuman Materi Pembelajaran
            </label>
            <textarea
              rows={3}
              disabled={aiLoading}
              className="portal-input text-xs leading-relaxed"
              placeholder="Tempelkan ringkasan materi pembelajaran atau bab buku di sini (minimal 20 karakter)... Contoh: Perkembangbiakan tumbuhan secara generatif melibatkan penyerbukan dan pembuahan melalui serbuk sari dan putik..."
              value={aiMateri}
              onChange={(e) => setAiMateri(e.target.value)}
            />
            <span className="text-[11px] text-[#6b7d6c] mt-0.5 block">
              {aiMateri.length} karakter (minimal 20 karakter)
            </span>
          </div>

          {/* Pilihan Pengaturan AI */}
          <div>
            <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1">
              Jumlah Soal
            </label>
            <select
              disabled={aiLoading}
              value={aiJumlah}
              onChange={(e) => setAiJumlah(parseInt(e.target.value, 10))}
              className="portal-select"
            >
              <option value={5}>5 Soal (Rekomendasi Cepat)</option>
              <option value={8}>8 Soal</option>
              <option value={10}>10 Soal (Lomba Standar)</option>
              <option value={15}>15 Soal (Maksimal)</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[#e0d5b8]">
            <button
              type="button"
              className="portal-btn ghost sm"
              onClick={() => setModalAiOpen(false)}
              disabled={aiLoading}
            >
              Batal
            </button>
            <button
              type="button"
              className="portal-btn red sm"
              onClick={handleGenerateAi}
              disabled={aiLoading || aiMateri.trim().length < 20}
            >
              <span>{aiLoading ? 'Menyusun Soal...' : 'Buat Soal Sekarang'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
