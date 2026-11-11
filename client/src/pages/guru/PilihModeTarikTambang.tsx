import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import KarakterTarikTambang from '../siswa/KarakterTarikTambang';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  Monitor,
  PenTool,
  Play,
  Plus,
  QrCode,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';

type PlayModeTarik = 'SOLO' | 'MULTIPLAYER';
type SumberSoalTarik = 'bank_soal' | 'manual' | 'ai';
type KesulitanSoalTarik = 'mudah' | 'sedang' | 'sulit';

interface TemplateSummary {
  id: string;
  judul: string;
  game: string;
  mode: string;
  resmi?: boolean;
  _count?: { questions: number };
}

interface QuestionDetail {
  id?: string;
  urutan: number;
  teks: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  jawabanBenar: 'A' | 'B' | 'C';
  penjelasan: string;
  kesulitan: KesulitanSoalTarik;
  dibuatAi?: boolean;
}

const LABEL_KESULITAN: Record<KesulitanSoalTarik, string> = {
  mudah: 'Mudah',
  sedang: 'Sedang',
  sulit: 'Sulit',
};

function buatSoalKosong(urutan: number, kesulitan: KesulitanSoalTarik): QuestionDetail {
  return {
    urutan,
    teks: '',
    opsiA: '',
    opsiB: '',
    opsiC: '',
    jawabanBenar: 'A',
    penjelasan: '',
    kesulitan,
  };
}

export default function PilihModeTarikTambang() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTemplateId = searchParams.get('templateId') || '';
  const queryKembali = searchParams.get('kembali') || '/guru';

  const [step, setStep] = useState<'pilih_mode' | 'konfigurasi'>('pilih_mode');
  const [playMode, setPlayMode] = useState<PlayModeTarik>('SOLO');

  // Daftar template bank soal
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(queryTemplateId);
  const [templateQuestions, setTemplateQuestions] = useState<QuestionDetail[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Pengaturan bersama Tarik Tambang Dual Mode
  const [sumberSoal, setSumberSoal] = useState<SumberSoalTarik>('bank_soal');
  const [kesulitan, setKesulitan] = useState<KesulitanSoalTarik>('sedang');
  const [durasiRonde, setDurasiRonde] = useState<15 | 20 | 30>(20);
  const [bonusAktif, setBonusAktif] = useState<boolean>(true);
  const [powerUpAktif, setPowerUpAktif] = useState<boolean>(true);
  const [namaTim1, setNamaTim1] = useState<string>('Tim Merah');
  const [namaTim2, setNamaTim2] = useState<string>('Tim Biru');
  const [maxPeserta, setMaxPeserta] = useState<number>(60);

  // Soal Manual inline (ketika sumberSoal === 'manual')
  const [judulBaruManual, setJudulBaruManual] = useState<string>('Tarik Tambang Kelas');
  const [manualQuestions, setManualQuestions] = useState<QuestionDetail[]>([
    buatSoalKosong(1, 'sedang'),
    buatSoalKosong(2, 'sedang'),
  ]);

  // Soal AI (ketika sumberSoal === 'ai')
  const [judulBaruAi, setJudulBaruAi] = useState<string>('Kuis AI Tarik Tambang');
  const [aiMateri, setAiMateri] = useState<string>('');
  const [aiTingkat, setAiTingkat] = useState<'SD' | 'SMP'>('SD');
  const [aiJumlah, setAiJumlah] = useState<number>(6);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<QuestionDetail[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadTemplates() {
      try {
        setLoadingTemplates(true);
        const [resSaya, resPustaka] = await Promise.all([
          apiRequest<{ templates: TemplateSummary[] }>('/template'),
          apiRequest<{ templates: TemplateSummary[] }>('/template/pustaka').catch(() => ({
            templates: [],
          })),
        ]);
        if (!active) return;

        const all = [
          ...(resSaya.templates || []),
          ...(resPustaka.templates || []).map((t) => ({ ...t, resmi: true })),
        ];

        const sorted = [...all].sort((a, b) => {
          const aT = a.game === 'tarik_tambang' ? 0 : 1;
          const bT = b.game === 'tarik_tambang' ? 0 : 1;
          return aT - bT;
        });

        setTemplates(sorted);
        if (queryTemplateId && sorted.some((t) => t.id === queryTemplateId)) {
          setSelectedTemplateId(queryTemplateId);
        } else if (sorted.length > 0) {
          setSelectedTemplateId(sorted[0].id);
        }
      } catch (err: any) {
        if (active) setErrorPesan(err.pesan || 'Gagal memuat bank soal.');
      } finally {
        if (active) setLoadingTemplates(false);
      }
    }
    loadTemplates();
    return () => {
      active = false;
    };
  }, [queryTemplateId]);

  // Muat detail soal dari template yang dipilih untuk menghitung ketersediaan per kesulitan
  useEffect(() => {
    if (!selectedTemplateId || sumberSoal !== 'bank_soal') return;
    let active = true;
    async function loadDetail() {
      try {
        setLoadingQuestions(true);
        const res = await apiRequest<{ template: { questions: QuestionDetail[] } }>(
          `/template/${selectedTemplateId}`
        );
        if (!active) return;
        setTemplateQuestions(
          (res.template?.questions || []).map((q, idx) => ({
            ...q,
            urutan: q.urutan || idx + 1,
            kesulitan: ((q.kesulitan || 'sedang').toLowerCase() as KesulitanSoalTarik),
          }))
        );
      } catch {
        if (active) setTemplateQuestions([]);
      } finally {
        if (active) setLoadingQuestions(false);
      }
    }
    loadDetail();
    return () => {
      active = false;
    };
  }, [selectedTemplateId, sumberSoal]);

  const jumlahSoalSetaraBank = useMemo(() => {
    return templateQuestions.filter(
      (q) =>
        (q.kesulitan || 'sedang').toLowerCase() === kesulitan &&
        q.teks.trim().length > 0 &&
        q.opsiA.trim().length > 0 &&
        q.opsiB.trim().length > 0 &&
        q.opsiC.trim().length > 0
    ).length;
  }, [templateQuestions, kesulitan]);

  const countPerKesulitan = useMemo(() => {
    const counts: Record<KesulitanSoalTarik, number> = { mudah: 0, sedang: 0, sulit: 0 };
    for (const q of templateQuestions) {
      const k = ((q.kesulitan || 'sedang').toLowerCase() as KesulitanSoalTarik);
      if (k in counts) counts[k] += 1;
    }
    return counts;
  }, [templateQuestions]);

  // Otomatis pindah kesulitan ke yang tersedia >= 2 bila template dipilih tidak punya kesulitan default
  useEffect(() => {
    if (sumberSoal !== 'bank_soal' || templateQuestions.length === 0) return;
    if (countPerKesulitan[kesulitan] < 2) {
      const fallback = (['sedang', 'mudah', 'sulit'] as KesulitanSoalTarik[]).find(
        (k) => countPerKesulitan[k] >= 2
      );
      if (fallback) setKesulitan(fallback);
    }
  }, [templateQuestions, countPerKesulitan, kesulitan, sumberSoal]);

  const handlePilihMode = (modeDipilih: PlayModeTarik) => {
    setPlayMode(modeDipilih);
    setErrorPesan(null);
    setStep('konfigurasi');
  };

  const handleGenerateAi = async () => {
    if (aiMateri.trim().length < 20) {
      setErrorPesan('Teks materi AI minimal 20 karakter agar soal akurat.');
      return;
    }
    try {
      setAiLoading(true);
      setErrorPesan(null);
      const res = await apiRequest<{ soal: any[] }>('/ai/soal', {
        method: 'POST',
        body: JSON.stringify({
          materi: aiMateri.trim(),
          jumlah: aiJumlah,
          tingkat: aiTingkat,
          kesulitan,
        }),
      });
      const list: QuestionDetail[] = (res.soal || []).map((q, idx) => ({
        urutan: idx + 1,
        teks: q.teks || '',
        opsiA: q.opsiA || '',
        opsiB: q.opsiB || '',
        opsiC: q.opsiC || '',
        jawabanBenar: (q.jawabanBenar || 'A').toUpperCase() as 'A' | 'B' | 'C',
        penjelasan: q.penjelasan || '',
        kesulitan,
        dibuatAi: true,
      }));
      if (list.length < 2) {
        throw new Error('Minimal dibutuhkan 2 soal valid dari AI.');
      }
      setAiQuestions(list);
    } catch (err: any) {
      setErrorPesan(err.pesan || err.message || 'Gagal menghasilkan soal AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleMulaiPermainan = async () => {
    setErrorPesan(null);
    const tim1Clean = namaTim1.trim() || 'Tim Merah';
    const tim2Clean = namaTim2.trim() || 'Tim Biru';
    if (tim1Clean.length < 2 || tim2Clean.length < 2) {
      setErrorPesan('Nama kedua tim minimal 2 karakter.');
      return;
    }

    try {
      setSubmitting(true);
      let finalTemplateId = selectedTemplateId;

      if (sumberSoal === 'manual') {
        const validManual = manualQuestions.filter(
          (q) => q.teks.trim() && q.opsiA.trim() && q.opsiB.trim() && q.opsiC.trim()
        );
        if (validManual.length < 2) {
          throw new Error('Minimal isi 2 soal lengkap pada mode Input Manual.');
        }
        const created = await apiRequest<{ template: { id: string } }>('/template', {
          method: 'POST',
          body: JSON.stringify({
            judul: judulBaruManual.trim() || 'Tarik Tambang Manual',
            game: 'tarik_tambang',
            mode: playMode === 'MULTIPLAYER' ? 'multi' : 'solo',
            questions: validManual.map((q, i) => ({
              urutan: i + 1,
              teks: q.teks.trim(),
              opsiA: q.opsiA.trim(),
              opsiB: q.opsiB.trim(),
              opsiC: q.opsiC.trim(),
              jawabanBenar: q.jawabanBenar,
              penjelasan: q.penjelasan.trim(),
              kesulitan,
              dibuatAi: false,
            })),
          }),
        });
        finalTemplateId = created.template.id;
      } else if (sumberSoal === 'ai') {
        if (aiQuestions.length < 2) {
          throw new Error('Klik "Generate Soal AI" terlebih dahulu (minimal 2 soal).');
        }
        const created = await apiRequest<{ template: { id: string } }>('/template', {
          method: 'POST',
          body: JSON.stringify({
            judul: judulBaruAi.trim() || 'Tarik Tambang AI',
            game: 'tarik_tambang',
            mode: playMode === 'MULTIPLAYER' ? 'multi' : 'solo',
            questions: aiQuestions.map((q, i) => ({
              urutan: i + 1,
              teks: q.teks.trim(),
              opsiA: q.opsiA.trim(),
              opsiB: q.opsiB.trim(),
              opsiC: q.opsiC.trim(),
              jawabanBenar: q.jawabanBenar,
              penjelasan: q.penjelasan.trim(),
              kesulitan,
              dibuatAi: true,
            })),
          }),
        });
        finalTemplateId = created.template.id;
      } else {
        if (!finalTemplateId) {
          throw new Error('Pilih template bank soal terlebih dahulu.');
        }
        if (jumlahSoalSetaraBank < 2) {
          throw new Error(
            `Bank soal hanya memiliki ${jumlahSoalSetaraBank} soal dengan kesulitan "${LABEL_KESULITAN[kesulitan]}". Minimal 2 soal setara dibutuhkan.`
          );
        }
      }

      const payload: Record<string, any> = {
        templateId: finalTemplateId,
        game: 'tarik_tambang',
        playMode,
        mode: playMode === 'MULTIPLAYER' ? 'multi' : 'solo',
        autoStart: playMode === 'SOLO',
        tarikTambangConfig: {
          sumberSoal,
          kesulitan,
          durasiRonde,
          bonusAktif,
          powerUpAktif,
          namaTim1: tim1Clean,
          namaTim2: tim2Clean,
          maxPeserta: playMode === 'MULTIPLAYER' ? maxPeserta : 2,
        },
      };

      const res = await apiRequest<{ session: { id: string } }>('/sesi', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      navigate(`/guru/sesi/${res.session.id}`);
    } catch (err: any) {
      setErrorPesan(err.pesan || err.message || 'Gagal memulai permainan Tarik Tambang.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="portal-bg min-h-screen px-4 py-6 sm:px-8 sm:py-8">
      <div className="max-w-5xl mx-auto">
        {/* Bar Navigasi Atas */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <button
            type="button"
            onClick={() => (step === 'konfigurasi' ? setStep('pilih_mode') : navigate(queryKembali))}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#fbf6e9]/95 text-[#1d3b2e] font-bold border-2 border-[#d3c7a7] shadow-[0_3px_0_rgba(0,0,0,0.2)] hover:bg-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{step === 'konfigurasi' ? 'Kembali Pilih Mode' : 'Kembali ke Dashboard'}</span>
          </button>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#244a39] border border-[#f2c230]/40 text-[#f2c230] text-xs font-extrabold uppercase tracking-wider">
            <Trophy className="w-4 h-4" />
            <span>Tarik Tambang Challenge Dual Mode</span>
          </div>
        </div>

        {/* LANGKAH 1: PILIH MODE PERMAINAN */}
        {step === 'pilih_mode' && (
          <div className="space-y-6">
            <div className="bg-[#fbf6e9] rounded-3xl p-6 sm:p-8 border-2 border-[#e0d5b8] shadow-[0_8px_0_rgba(0,0,0,0.2)]">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-[#c8362f]/10 text-[#c8362f] font-extrabold text-xs uppercase tracking-wider mb-2">
                    Pemilihan Mode Permainan
                  </span>
                  <h1 className="portal-cv text-4xl sm:text-5xl text-[#1d3b2e] leading-tight">
                    Pilih Arena Tarik Tambang
                  </h1>
                  <p className="text-[#4a6252] font-semibold mt-2 max-w-2xl">
                    Dua siswa langsung bertanding di satu layar guru, atau ajak seluruh kelas
                    bergabung lewat PIN &amp; QR Code dalam mode tim Multiplayer.
                  </p>
                </div>

                <div className="flex items-end gap-2 bg-[#f1e7ce] px-5 py-3 rounded-2xl border border-[#d6c8a4]">
                  <KarakterTarikTambang tim="merah" pose="tarik" ekspresi="semangat" size="md" />
                  <span className="portal-cv text-2xl text-[#b45309] pb-4">VS</span>
                  <KarakterTarikTambang tim="putih" pose="tarik" ekspresi="semangat" size="md" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Kartu Mode A: Solo Mode — Local 1 vs 1 */}
              <div className="bg-[#fbf6e9] rounded-3xl p-6 sm:p-7 border-2 border-[#c8362f]/70 shadow-[0_8px_0_rgba(0,0,0,0.22)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#c8362f] text-white flex items-center justify-center shadow">
                      <Monitor className="w-6 h-6" />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[#c8362f]/15 text-[#c8362f] text-xs font-black uppercase">
                      Local 1 vs 1
                    </span>
                  </div>

                  <h2 className="text-2xl font-black text-[#1d3b2e] mb-2">
                    Solo Mode — Duel 1 Perangkat
                  </h2>
                  <p className="text-sm text-[#4a6252] font-medium leading-relaxed mb-5">
                    Dua siswa bertanding secara bersamaan di satu perangkat guru dengan tampilan
                    layar terbelah kiri &amp; kanan. Langsung dimulai tanpa PIN atau QR Code.
                  </p>

                  <ul className="space-y-2.5 text-sm font-bold text-[#2b4d3c] mb-6">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#c8362f] shrink-0" />
                      <span>Layar terbelah: Tim 1 (Merah) vs Tim 2 (Biru)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#c8362f] shrink-0" />
                      <span>2 soal setara berbeda secara simultan &amp; timer sinkron</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#c8362f] shrink-0" />
                      <span>Tanpa PIN, tanpa QR Code, tanpa ruang tunggu siswa</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handlePilihMode('SOLO')}
                  className="w-full py-3.5 px-5 rounded-2xl bg-[#c8362f] hover:bg-[#b02b24] text-white font-black text-base shadow-[0_4px_0_#7f1d1d] active:translate-y-0.5 transition-all inline-flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Mainkan Solo</span>
                </button>
              </div>

              {/* Kartu Mode B: Multiplayer Mode — Team Multiplayer */}
              <div className="bg-[#fbf6e9] rounded-3xl p-6 sm:p-7 border-2 border-[#2563eb]/70 shadow-[0_8px_0_rgba(0,0,0,0.22)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#2563eb] text-white flex items-center justify-center shadow">
                      <Users className="w-6 h-6" />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[#2563eb]/15 text-[#2563eb] text-xs font-black uppercase">
                      Team Multiplayer
                    </span>
                  </div>

                  <h2 className="text-2xl font-black text-[#1d3b2e] mb-2">
                    Multiplayer Mode — Lomba Kelas
                  </h2>
                  <p className="text-sm text-[#4a6252] font-medium leading-relaxed mb-5">
                    Siswa bergabung menggunakan perangkat masing-masing via PIN / QR Code (~40+
                    siswa), dibagi otomatis ke dua tim, dan bertarung serentak per ronde.
                  </p>

                  <ul className="space-y-2.5 text-sm font-bold text-[#2b4d3c] mb-6">
                    <li className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-[#2563eb] shrink-0" />
                      <span>Lobi PIN &amp; QR Code + acak ulang / pindah anggota tim</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#2563eb] shrink-0" />
                      <span>Soal berbeda antar tim &amp; akurasi kolektif (skala -100..+100)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#2563eb] shrink-0" />
                      <span>Bonus Streak individu, Bonus Kekompakan Tim &amp; Power-Up</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handlePilihMode('MULTIPLAYER')}
                  className="w-full py-3.5 px-5 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-black text-base shadow-[0_4px_0_#1e3a8a] active:translate-y-0.5 transition-all inline-flex items-center justify-center gap-2"
                >
                  <Users className="w-5 h-5" />
                  <span>Mainkan Multiplayer</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LANGKAH 2: PENGATURAN SESUAI MODE */}
        {step === 'konfigurasi' && (
          <div className="space-y-6">
            {/* Header Mode Aktif */}
            <div className="bg-[#fbf6e9] rounded-3xl p-6 border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow ${
                    playMode === 'SOLO' ? 'bg-[#c8362f]' : 'bg-[#2563eb]'
                  }`}
                >
                  {playMode === 'SOLO' ? <Monitor className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                </div>
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#6b7d6c]">
                    Pengaturan Permainan
                  </div>
                  <h1 className="text-2xl font-black text-[#1d3b2e]">
                    {playMode === 'SOLO'
                      ? 'Solo Mode (Local 1 vs 1)'
                      : 'Multiplayer Mode (Team Multiplayer)'}
                  </h1>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep('pilih_mode')}
                className="px-4 py-2 rounded-xl bg-[#f1e7ce] hover:bg-[#e5d8b8] text-[#1d3b2e] font-bold text-sm border border-[#d6c8a4]"
              >
                Ganti Mode
              </button>
            </div>

            {errorPesan && (
              <div className="p-4 rounded-2xl bg-[#fde8e7] border-2 border-[#c8362f] text-[#961e19] font-bold flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{errorPesan}</span>
              </div>
            )}

            {/* Bagian A: Sumber Soal & Tingkat Kesulitan */}
            <div className="bg-[#fbf6e9] rounded-3xl p-6 sm:p-7 border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)] space-y-5">
              <div>
                <h2 className="text-lg font-black text-[#1d3b2e] flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#c8362f]" />
                  <span>1. Sumber &amp; Tingkat Kesulitan Soal</span>
                </h2>
                <p className="text-xs text-[#6b7d6c] font-semibold mt-0.5">
                  Tim 1 dan Tim 2 menerima soal yang berbeda namun berkesulitan setara tiap ronde.
                </p>
              </div>

              {/* Tab Sumber Soal */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'bank_soal', label: 'Bank Soal Tersimpan', icon: BookOpen },
                  { id: 'manual', label: 'Tambah Soal Manual', icon: PenTool },
                  { id: 'ai', label: 'Generate AI', icon: Sparkles },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = sumberSoal === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSumberSoal(opt.id as SumberSoalTarik);
                        setErrorPesan(null);
                      }}
                      className={`p-3.5 rounded-2xl border-2 text-left flex items-center gap-3 font-bold transition-all ${
                        active
                          ? 'bg-[#1d3b2e] text-[#fbf6e9] border-[#1d3b2e] shadow'
                          : 'bg-[#f4ecd9] text-[#1d3b2e] border-[#d9cba7] hover:bg-[#ede2c8]'
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="text-sm">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Pilih Kesulitan */}
              <div>
                <label className="block text-sm font-extrabold text-[#1d3b2e] mb-2">
                  Tingkat Kesulitan Soal yang Dipakai
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['mudah', 'sedang', 'sulit'] as KesulitanSoalTarik[]).map((lvl) => {
                    const active = kesulitan === lvl;
                    const infoCount =
                      sumberSoal === 'bank_soal' ? ` (${countPerKesulitan[lvl]} soal)` : '';
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setKesulitan(lvl)}
                        className={`py-2.5 px-3 rounded-xl border-2 text-sm font-extrabold transition-all ${
                          active
                            ? 'bg-[#b45309] text-white border-[#92400e]'
                            : 'bg-white text-[#1d3b2e] border-[#d6c8a4] hover:bg-[#f4ecd9]'
                        }`}
                      >
                        {LABEL_KESULITAN[lvl]}
                        {infoCount && (
                          <span className="block text-[11px] font-semibold opacity-85">
                            {infoCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detail per Sumber Soal */}
              {sumberSoal === 'bank_soal' && (
                <div className="space-y-3 pt-2">
                  <label className="block text-sm font-extrabold text-[#1d3b2e]">
                    Pilih Paket Soal dari Bank Soal
                  </label>
                  {loadingTemplates ? (
                    <div className="flex items-center gap-2 text-sm text-[#6b7d6c] py-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memuat bank soal...</span>
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="p-4 rounded-xl bg-[#f4ecd9] text-sm font-semibold text-[#6b7d6c]">
                      Belum ada template tersimpan. Gunakan tab "Tambah Soal Manual" atau "Generate
                      AI" di atas.
                    </div>
                  ) : (
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white border-2 border-[#d6c8a4] text-[#1d3b2e] font-bold"
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.judul} {t.resmi ? '(Pustaka Resmi)' : ''} —{' '}
                          {t._count?.questions ?? '?'} soal
                        </option>
                      ))}
                    </select>
                  )}

                  {!loadingQuestions && selectedTemplateId && (
                    <div
                      className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                        jumlahSoalSetaraBank >= 2
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {jumlahSoalSetaraBank >= 2 ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>
                            Tersedia {jumlahSoalSetaraBank} soal setara tingkat{' '}
                            {LABEL_KESULITAN[kesulitan]} — siap dipasangkan untuk kedua tim!
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>
                            Hanya {jumlahSoalSetaraBank} soal tingkat {LABEL_KESULITAN[kesulitan]}.
                            Pilih tingkat kesulitan lain yang memiliki minimal 2 soal atau buat soal
                            manual/AI.
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {sumberSoal === 'manual' && (
                <div className="space-y-4 pt-2 border-t border-[#e0d5b8]">
                  <div>
                    <label className="block text-sm font-extrabold text-[#1d3b2e] mb-1">
                      Judul Paket Soal Baru
                    </label>
                    <input
                      type="text"
                      value={judulBaruManual}
                      onChange={(e) => setJudulBaruManual(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-[#d6c8a4] font-bold text-[#1d3b2e]"
                      placeholder="Misal: Kuis Kemerdekaan Kelas 5"
                    />
                  </div>

                  {manualQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-[#f4ecd9]/80 border border-[#d6c8a4] space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-[#1d3b2e]">
                          Soal #{idx + 1} ({LABEL_KESULITAN[kesulitan]})
                        </span>
                        {manualQuestions.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              setManualQuestions((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-[#c8362f] hover:underline text-xs font-bold inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={q.teks}
                        onChange={(e) =>
                          setManualQuestions((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, teks: e.target.value } : item))
                          )
                        }
                        placeholder="Tulis pertanyaan di sini..."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#d6c8a4] text-sm font-semibold text-[#1d3b2e]"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {(['A', 'B', 'C'] as const).map((k) => {
                          const keyField = k === 'A' ? 'opsiA' : k === 'B' ? 'opsiB' : 'opsiC';
                          return (
                            <input
                              key={k}
                              type="text"
                              value={q[keyField]}
                              onChange={(e) =>
                                setManualQuestions((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, [keyField]: e.target.value } : item
                                  )
                                )
                              }
                              placeholder={`Pilihan ${k}`}
                              className="px-3 py-2 rounded-xl bg-white border border-[#d6c8a4] text-sm font-medium text-[#1d3b2e]"
                            />
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <label className="text-xs font-extrabold text-[#1d3b2e]">
                          Kunci Jawaban:
                        </label>
                        <select
                          value={q.jawabanBenar}
                          onChange={(e) =>
                            setManualQuestions((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, jawabanBenar: e.target.value as 'A' | 'B' | 'C' }
                                  : item
                              )
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-white border border-[#d6c8a4] text-sm font-bold text-[#1d3b2e]"
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </select>
                        <input
                          type="text"
                          value={q.penjelasan}
                          onChange={(e) =>
                            setManualQuestions((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, penjelasan: e.target.value } : item
                              )
                            )
                          }
                          placeholder="Pembahasan singkat (opsional)"
                          className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-white border border-[#d6c8a4] text-xs font-medium text-[#1d3b2e]"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setManualQuestions((prev) => [
                        ...prev,
                        buatSoalKosong(prev.length + 1, kesulitan),
                      ])
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#f1e7ce] hover:bg-[#e5d8b8] text-[#1d3b2e] text-xs font-extrabold border border-[#d6c8a4]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Soal</span>
                  </button>
                </div>
              )}

              {sumberSoal === 'ai' && (
                <div className="space-y-4 pt-2 border-t border-[#e0d5b8]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-extrabold text-[#1d3b2e] mb-1">
                        Judul Paket Soal AI
                      </label>
                      <input
                        type="text"
                        value={judulBaruAi}
                        onChange={(e) => setJudulBaruAi(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#d6c8a4] text-sm font-bold text-[#1d3b2e]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-extrabold text-[#1d3b2e] mb-1">
                          Jenjang
                        </label>
                        <select
                          value={aiTingkat}
                          onChange={(e) => setAiTingkat(e.target.value as 'SD' | 'SMP')}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#d6c8a4] text-sm font-bold text-[#1d3b2e]"
                        >
                          <option value="SD">SD</option>
                          <option value="SMP">SMP</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-extrabold text-[#1d3b2e] mb-1">
                          Jumlah
                        </label>
                        <input
                          type="number"
                          min={2}
                          max={15}
                          value={aiJumlah}
                          onChange={(e) =>
                            setAiJumlah(Math.max(2, Math.min(15, Number(e.target.value) || 6)))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#d6c8a4] text-sm font-bold text-[#1d3b2e]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-[#1d3b2e] mb-1">
                      Materi atau Topik Soal (minimal 20 karakter)
                    </label>
                    <textarea
                      rows={3}
                      value={aiMateri}
                      onChange={(e) => setAiMateri(e.target.value)}
                      placeholder="Tempel ringkasan materi IPA, IPS, Matematika, Sejarah Indonesia..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-[#d6c8a4] text-sm font-medium text-[#1d3b2e]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={handleGenerateAi}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white font-extrabold text-sm shadow disabled:opacity-60"
                    >
                      {aiLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      <span>{aiLoading ? 'Menyusun Soal AI...' : 'Generate Soal AI'}</span>
                    </button>
                    {aiQuestions.length > 0 && (
                      <span className="text-xs font-extrabold text-emerald-700">
                        {aiQuestions.length} soal tingkat {LABEL_KESULITAN[kesulitan]} siap
                        digunakan!
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bagian B: Aturan Ronde, Tim & Mode */}
            <div className="bg-[#fbf6e9] rounded-3xl p-6 sm:p-7 border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)] space-y-5">
              <h2 className="text-lg font-black text-[#1d3b2e] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#2563eb]" />
                <span>2. Aturan Ronde &amp; Mekanisme Tarikan</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-extrabold text-[#1d3b2e] mb-1">
                    Nama Tim 1 (Kiri / Merah)
                  </label>
                  <input
                    type="text"
                    maxLength={32}
                    value={namaTim1}
                    onChange={(e) => setNamaTim1(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-[#d9544c] font-bold text-[#c8362f]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-extrabold text-[#1d3b2e] mb-1">
                    Nama Tim 2 (Kanan / Biru)
                  </label>
                  <input
                    type="text"
                    maxLength={32}
                    value={namaTim2}
                    onChange={(e) => setNamaTim2(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-[#3b82f6] font-bold text-[#2563eb]"
                  />
                </div>
              </div>

              {/* Durasi Ronde */}
              <div>
                <label className="block text-sm font-extrabold text-[#1d3b2e] mb-2">
                  Durasi Timer per Ronde
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {([15, 20, 30] as const).map((detik) => (
                    <button
                      key={detik}
                      type="button"
                      onClick={() => setDurasiRonde(detik)}
                      className={`py-2.5 rounded-xl border-2 text-sm font-black transition-all ${
                        durasiRonde === detik
                          ? 'bg-[#1d3b2e] text-white border-[#1d3b2e]'
                          : 'bg-white text-[#1d3b2e] border-[#d6c8a4] hover:bg-[#f4ecd9]'
                      }`}
                    >
                      {detik} Detik
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle Bonus & Power-Up */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-start gap-3 p-4 rounded-2xl bg-[#f4ecd9] border border-[#d6c8a4] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bonusAktif}
                    onChange={(e) => setBonusAktif(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-[#c8362f]"
                  />
                  <div>
                    <div className="font-black text-sm text-[#1d3b2e] flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-[#b45309]" />
                      <span>Aktifkan Bonus Streak &amp; Kekompakan</span>
                    </div>
                    <p className="text-xs text-[#6b7d6c] font-semibold mt-0.5">
                      Streak 3 (+5) / 5 (+10)
                      {playMode === 'MULTIPLAYER'
                        ? ', plus Bonus Kekompakan Tim (≥80%: +5, 100%: +10)'
                        : ''}
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-2xl bg-[#f4ecd9] border border-[#d6c8a4] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={powerUpAktif}
                    onChange={(e) => setPowerUpAktif(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-[#2563eb]"
                  />
                  <div>
                    <div className="font-black text-sm text-[#1d3b2e] flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-[#2563eb]" />
                      <span>Aktifkan Sistem Power-Up</span>
                    </div>
                    <p className="text-xs text-[#6b7d6c] font-semibold mt-0.5">
                      Semangat Tim (+5), Pertahanan Kuat (-5 lawan), Tarikan Super (+10). Maks 1
                      aktif.
                    </p>
                  </div>
                </label>
              </div>

              {/* Pengaturan Khusus Multiplayer (KHUSUS MULTIPLAYER ONLY) */}
              {playMode === 'MULTIPLAYER' ? (
                <div className="p-4 rounded-2xl bg-[#eff6ff] border border-[#93c5fd] space-y-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-black text-sm text-[#1e3a8a]">
                        Kapasitas Maksimal Siswa di Lobi
                      </div>
                      <p className="text-xs text-[#3b5998] font-medium">
                        Mendukung ~40+ siswa dalam 1 kelas dengan pembagian tim otomatis seimbang
                        tanpa bot.
                      </p>
                    </div>
                    <input
                      type="number"
                      min={2}
                      max={200}
                      value={maxPeserta}
                      onChange={(e) =>
                        setMaxPeserta(Math.max(2, Math.min(200, Number(e.target.value) || 60)))
                      }
                      className="w-24 px-3 py-2 rounded-xl bg-white border-2 border-[#3b82f6] font-black text-center text-[#1e3a8a]"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-[#fdf2f2] border border-[#f5c2c0] text-xs font-bold text-[#961e19]">
                  Mode Solo Local 1 vs 1 akan langsung membuka layar pertandingan terbelah dua di
                  perangkat ini tanpa PIN, tanpa QR Code, dan tanpa ruang tunggu peserta.
                </div>
              )}

              {/* Tombol Aksi Utama */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleMulaiPermainan}
                  className={`w-full py-4 px-6 rounded-2xl text-white font-black text-lg shadow-lg transition-all inline-flex items-center justify-center gap-2.5 disabled:opacity-60 ${
                    playMode === 'SOLO'
                      ? 'bg-[#c8362f] hover:bg-[#b02b24] shadow-[0_5px_0_#7f1d1d]'
                      : 'bg-[#2563eb] hover:bg-[#1d4ed8] shadow-[0_5px_0_#1e3a8a]'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Menyiapkan Arena Tarik Tambang...</span>
                    </>
                  ) : playMode === 'SOLO' ? (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      <span>Mulai Duel Solo 1 vs 1</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-5 h-5" />
                      <span>Buka Lobi PIN &amp; QR Multiplayer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

