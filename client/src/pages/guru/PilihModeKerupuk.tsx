import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import {
  PlayModeKerupuk,
  ProbabilitasConfig,
  KesulitanKerupuk,
  TargetKerupukPreset,
  TARGET_PRESETS,
  PRESET_DATA,
  hitungPoinPengurangan,
} from './ModalKonfigurasiKerupuk';
import {
  ArrowLeft,
  Users,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  Target,
  Sparkles,
  Play,
  Loader2,
  BookOpen,
  UserCheck,
  QrCode,
  Trophy,
  Sliders,
  Plus,
  ExternalLink,
} from 'lucide-react';

interface TemplateItem {
  id: string;
  judul: string;
  game: string;
  mode: string;
  resmi?: boolean;
  _count?: { questions: number };
}

interface QuestionItem {
  id?: string;
  urutan: number;
  teks: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  jawabanBenar: 'A' | 'B' | 'C';
  penjelasan?: string | null;
  dibuatAi?: boolean;
}

interface TemplateDetail {
  id: string;
  judul: string;
  game: 'tarik_tambang' | 'makan_kerupuk' | 'panjat_pinang' | 'balap_karung';
  mode: 'solo' | 'multi';
  resmi: boolean;
  questions: QuestionItem[];
}

type StepKerupuk = 'PILIH_MODE' | 'KONFIGURASI';

export default function PilihModeKerupuk() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTemplateId = searchParams.get('templateId') || '';
  const queryKembali = searchParams.get('kembali') || '/guru';
  const queryModeParam = searchParams.get('mode');

  const initialMode: PlayModeKerupuk | null =
    queryModeParam === 'solo'
      ? 'SOLO'
      : queryModeParam === 'multi'
      ? 'MULTIPLAYER'
      : null;

  const [step, setStep] = useState<StepKerupuk>(
    initialMode ? 'KONFIGURASI' : 'PILIH_MODE'
  );
  const [playMode, setPlayMode] = useState<PlayModeKerupuk>(
    initialMode || 'SOLO'
  );

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(queryTemplateId);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);

  // Detail pertanyaan template aktif (untuk pratinjau & tambah pertanyaan cepat di Solo Mode)
  const [templateDetail, setTemplateDetail] = useState<TemplateDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [tampilTambahSoal, setTampilTambahSoal] = useState(false);
  const [savingSoal, setSavingSoal] = useState(false);
  const [soalBaruError, setSoalBaruError] = useState<string | null>(null);
  const [soalBaru, setSoalBaru] = useState<{
    teks: string;
    opsiA: string;
    opsiB: string;
    opsiC: string;
    jawabanBenar: 'A' | 'B' | 'C';
    penjelasan: string;
  }>({
    teks: '',
    opsiA: '',
    opsiB: '',
    opsiC: '',
    jawabanBenar: 'A',
    penjelasan: '',
  });

  // Aturan Permainan Inti
  const [targetPreset, setTargetPreset] = useState<TargetKerupukPreset>('100');
  const [customTargetInput, setCustomTargetInput] = useState<string>('120');
  const [kesulitan, setKesulitan] = useState<KesulitanKerupuk>('normal');
  const [probabilitas, setProbabilitas] = useState<ProbabilitasConfig>({
    ...PRESET_DATA.normal.probabilitas,
  });

  // Pengaturan Khusus Multiplayer (tidak ditampilkan pada Solo Mode)
  const [maxPeserta, setMaxPeserta] = useState<number>(45);
  const [allowLateJoin, setAllowLateJoin] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoadingTemplates(true);
        const [resSaya, resPustaka] = await Promise.all([
          apiRequest<{ templates: TemplateItem[] }>('/template'),
          apiRequest<{ templates: TemplateItem[] }>('/template/pustaka').catch(() => ({
            templates: [],
          })),
        ]);
        if (!active) return;

        const all = [
          ...(resSaya.templates || []),
          ...(resPustaka.templates || []).map((t) => ({ ...t, resmi: true })),
        ];

        const sorted = [...all].sort((a, b) => {
          const aK = a.game === 'makan_kerupuk' ? 0 : 1;
          const bK = b.game === 'makan_kerupuk' ? 0 : 1;
          return aK - bK;
        });

        setTemplates(sorted);
        if (queryTemplateId && sorted.some((t) => t.id === queryTemplateId)) {
          setSelectedTemplateId(queryTemplateId);
        } else if (sorted.length > 0) {
          setSelectedTemplateId(sorted[0].id);
        }
      } catch (err: any) {
        if (active) setErrorPesan(err.pesan || 'Gagal memuat daftar template soal.');
      } finally {
        if (active) setLoadingTemplates(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [queryTemplateId]);

  const loadTemplateDetail = useCallback(async (tplId: string) => {
    if (!tplId) {
      setTemplateDetail(null);
      return;
    }
    try {
      setLoadingDetail(true);
      const res = await apiRequest<{ template: TemplateDetail }>(`/template/${tplId}`);
      setTemplateDetail(res.template);
    } catch {
      setTemplateDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (step === 'KONFIGURASI' && selectedTemplateId) {
      loadTemplateDetail(selectedTemplateId);
    }
  }, [step, selectedTemplateId, loadTemplateDetail]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const jumlahSoal =
    templateDetail?.id === selectedTemplateId
      ? templateDetail.questions.length
      : selectedTemplate?._count?.questions ?? 0;

  const targetKerupuk = useMemo(() => {
    if (targetPreset === 'custom') {
      const parsed = parseInt(customTargetInput, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return parseInt(targetPreset, 10);
  }, [targetPreset, customTargetInput]);

  const isValidTarget =
    Number.isInteger(targetKerupuk) && targetKerupuk >= 10 && targetKerupuk <= 1000;

  const totalPersen = useMemo(
    () =>
      Number(probabilitas.besar || 0) +
      Number(probabilitas.sedang || 0) +
      Number(probabilitas.kecil || 0) +
      Number(probabilitas.sangat_kecil || 0) +
      Number(probabilitas.zonk || 0),
    [probabilitas]
  );

  const isValidProb = Math.abs(totalPersen - 100) < 0.001;
  const canSubmit =
    Boolean(selectedTemplate) && jumlahSoal > 0 && isValidTarget && isValidProb && !submitting;

  const handlePilihModeDanLanjut = (modeDipilih: PlayModeKerupuk) => {
    setPlayMode(modeDipilih);
    setErrorPesan(null);
    setStep('KONFIGURASI');
  };

  const handlePilihKesulitan = (key: 'mudah' | 'normal' | 'sulit') => {
    setKesulitan(key);
    setProbabilitas({ ...PRESET_DATA[key].probabilitas });
  };

  const updateNilaiProb = (key: keyof ProbabilitasConfig, val: number) => {
    const clean = Number.isFinite(val) ? Math.max(0, Math.min(100, val)) : 0;
    setKesulitan('custom');
    setProbabilitas((prev) => ({ ...prev, [key]: clean }));
  };

  const handleSimpanSoalBaru = async () => {
    if (!templateDetail) return;
    if (
      !soalBaru.teks.trim() ||
      !soalBaru.opsiA.trim() ||
      !soalBaru.opsiB.trim() ||
      !soalBaru.opsiC.trim()
    ) {
      setSoalBaruError('Teks pertanyaan dan seluruh pilihan jawaban A, B, dan C wajib diisi.');
      return;
    }

    try {
      setSavingSoal(true);
      setSoalBaruError(null);

      let targetTemplate = templateDetail;
      let addedToOwnedCopy = false;

      // Bila template berasal dari pustaka resmi platform, salin dulu ke milik guru
      if (targetTemplate.resmi || selectedTemplate?.resmi) {
        const resDup = await apiRequest<{ template: TemplateDetail }>(
          `/template/${targetTemplate.id}/duplikat`,
          { method: 'POST' }
        );
        targetTemplate = resDup.template;
        addedToOwnedCopy = true;
      }

      const nextQuestions = [
        ...targetTemplate.questions.map((q, idx) => ({
          urutan: idx + 1,
          teks: q.teks,
          opsiA: q.opsiA,
          opsiB: q.opsiB,
          opsiC: q.opsiC,
          jawabanBenar: q.jawabanBenar,
          penjelasan: q.penjelasan || null,
          dibuatAi: Boolean(q.dibuatAi),
        })),
        {
          urutan: targetTemplate.questions.length + 1,
          teks: soalBaru.teks.trim(),
          opsiA: soalBaru.opsiA.trim(),
          opsiB: soalBaru.opsiB.trim(),
          opsiC: soalBaru.opsiC.trim(),
          jawabanBenar: soalBaru.jawabanBenar,
          penjelasan: soalBaru.penjelasan.trim() || null,
          dibuatAi: false,
        },
      ];

      const resUpd = await apiRequest<{ template: TemplateDetail }>(
        `/template/${targetTemplate.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            judul: targetTemplate.judul,
            game: targetTemplate.game,
            mode: targetTemplate.mode,
            questions: nextQuestions,
          }),
        }
      );

      const updated = resUpd.template;
      setTemplateDetail(updated);
      setTemplates((prev) => {
        if (addedToOwnedCopy) {
          const itemBaru: TemplateItem = {
            id: updated.id,
            judul: updated.judul,
            game: updated.game,
            mode: updated.mode,
            resmi: false,
            _count: { questions: updated.questions.length },
          };
          return [itemBaru, ...prev];
        }
        return prev.map((t) =>
          t.id === updated.id
            ? { ...t, _count: { questions: updated.questions.length } }
            : t
        );
      });
      setSelectedTemplateId(updated.id);
      setSoalBaru({
        teks: '',
        opsiA: '',
        opsiB: '',
        opsiC: '',
        jawabanBenar: 'A',
        penjelasan: '',
      });
      setTampilTambahSoal(false);
    } catch (err: any) {
      setSoalBaruError(err.pesan || 'Gagal menambahkan pertanyaan baru.');
    } finally {
      setSavingSoal(false);
    }
  };

  const handleMulaiPermainan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedTemplate) return;

    try {
      setSubmitting(true);
      setErrorPesan(null);

      const baseKerupuk = {
        targetKerupuk,
        targetPreset,
        kesulitan,
        probabilitas,
      };

      const isSolo = playMode === 'SOLO';

      const res = await apiRequest<{ session: { id: string } }>('/sesi', {
        method: 'POST',
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          game: 'makan_kerupuk',
          mode: isSolo ? 'solo' : 'multi',
          playMode,
          ...(isSolo
            ? {
                autoStart: true,
                kerupukConfig: baseKerupuk,
              }
            : {
                kerupukMultiConfig: {
                  ...baseKerupuk,
                  maxPeserta,
                  allowLateJoin,
                },
              }),
        }),
      });

      const backTarget = `/guru/makan-kerupuk?templateId=${encodeURIComponent(
        selectedTemplate.id
      )}&kembali=${encodeURIComponent(queryKembali)}`;
      navigate(`/guru/sesi/${res.session.id}?kembali=${encodeURIComponent(backTarget)}`);
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal membuat sesi Makan Kerupuk Challenge.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4ecd8] text-[#1d3b2e] flex flex-col">
      {/* Header Utama */}
      <header className="bg-[#1d3b2e] text-[#f4ecd8] border-b-4 border-[#c8362f] px-4 sm:px-8 py-4 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                step === 'KONFIGURASI' ? setStep('PILIH_MODE') : navigate(queryKembali)
              }
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              title={step === 'KONFIGURASI' ? 'Kembali ke Pemilihan Mode' : 'Kembali ke Dashboard'}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#f2c230] block">
                Lomba Digital 17 Agustus • DISCERE
              </span>
              <h1 className="text-xl sm:text-2xl font-black">
                Makan Kerupuk Challenge
                {step === 'KONFIGURASI' && (
                  <span className="ml-2 text-xs sm:text-sm font-extrabold px-2.5 py-0.5 rounded-full bg-white/15 align-middle">
                    {playMode === 'SOLO' ? 'Solo Mode — Perangkat Guru' : 'Multiplayer Mode — HP Siswa'}
                  </span>
                )}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/guru/template/baru')}
            className="px-4 py-2 rounded-xl bg-[#f4ecd8] text-[#1d3b2e] font-bold text-xs hover:bg-white transition-colors cursor-pointer"
          >
            + Buat Template Kuis Baru
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {errorPesan && (
          <div className="bg-red-100 border border-red-300 text-red-900 px-4 py-3 rounded-2xl text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorPesan}</span>
          </div>
        )}

        {/* ============================================================
            TAHAP 1: PILIH MODE PERMAINAN (SOLO VS MULTIPLAYER)
            ============================================================ */}
        {step === 'PILIH_MODE' && (
          <section className="space-y-6">
            <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-6 shadow-xs">
              <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#c8362f] mb-1">
                <Sparkles className="w-4 h-4" /> Langkah 1 dari 2
              </span>
              <h2 className="text-2xl font-black text-[#1d3b2e]">
                Pilih Cara Bermain di Kelas
              </h2>
              <p className="text-sm text-[#6b7d6c] mt-1">
                Pilih <strong>Solo Mode</strong> untuk langsung bermain di perangkat guru tanpa PIN/QR maupun HP siswa, atau pilih <strong>Multiplayer Mode</strong> bila seluruh siswa ikut bergabung dari HP masing-masing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Kartu A: Solo Mode (Teacher Device) */}
              <button
                type="button"
                onClick={() => handlePilihModeDanLanjut('SOLO')}
                className="p-7 rounded-3xl border-3 border-[#e0d5b8] bg-[#fcf8ed] hover:bg-[#c8362f] hover:text-white hover:border-[#1d3b2e] text-[#1d3b2e] text-left transition-all cursor-pointer flex flex-col justify-between gap-5 shadow-md group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f6d9d3] group-hover:bg-white text-[#c8362f] text-xs font-black uppercase">
                      <Monitor className="w-4 h-4" /> Solo Mode (Perangkat Guru)
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#c8362f] text-white group-hover:bg-[#1d3b2e]">
                      Langsung Main →
                    </span>
                  </div>
                  <h3 className="text-2xl font-black">
                    Satu Perangkat Guru di Layar Proyektor
                  </h3>
                  <p className="text-sm leading-relaxed text-[#6b7d6c] group-hover:text-white/90">
                    Tidak memakai PIN, QR Code, maupun ruang tunggu siswa. Atur target kerupuk dan soal, tekan <strong>Mulai Permainan</strong>, lalu jawab pertanyaan langsung di layar ini.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs font-bold pt-4 border-t border-[#e0d5b8] group-hover:border-white/20">
                  <span className="flex items-center gap-1.5">
                    <Monitor className="w-4 h-4" /> Tanpa PIN &amp; QR Code
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Play className="w-4 h-4" /> Langsung Soal #1
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Karakter 2D Proyektor
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Target className="w-4 h-4" /> Mouse / Keyboard / Sentuh
                  </span>
                </div>
              </button>

              {/* Kartu B: Multiplayer Mode */}
              <button
                type="button"
                onClick={() => handlePilihModeDanLanjut('MULTIPLAYER')}
                className="p-7 rounded-3xl border-3 border-[#e0d5b8] bg-[#fcf8ed] hover:bg-[#1d3b2e] hover:text-[#f4ecd8] hover:border-[#f2c230] text-[#1d3b2e] text-left transition-all cursor-pointer flex flex-col justify-between gap-5 shadow-md group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f2c230] text-[#1d3b2e] text-xs font-black uppercase">
                      <Users className="w-4 h-4" /> Multiplayer Mode (HP Siswa)
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#1d3b2e] text-[#f4ecd8] group-hover:bg-[#f2c230] group-hover:text-[#1d3b2e]">
                      Lobi PIN &amp; QR →
                    </span>
                  </div>
                  <h3 className="text-2xl font-black">
                    Setiap Siswa Bermain di HP Masing-Masing
                  </h3>
                  <p className="text-sm leading-relaxed text-[#6b7d6c] group-hover:text-white/85">
                    Guru menghasilkan PIN &amp; QR Code untuk ruang lomba siswa. Siswa menjawab kuis dari perangkat pribadi dan bersaing di leaderboard real-time.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs font-bold pt-4 border-t border-[#e0d5b8] group-hover:border-white/15">
                  <span className="flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-[#c8362f] group-hover:text-[#f2c230]" /> PIN &amp; QR Gabung
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-[#c8362f] group-hover:text-[#f2c230]" /> Leaderboard Real-Time
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#c8362f] group-hover:text-[#f2c230]" /> Hingga 40+ Siswa
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-[#c8362f] group-hover:text-[#f2c230]" /> Kerupuk Per Individu
                  </span>
                </div>
              </button>
            </div>
          </section>
        )}

        {/* ============================================================
            TAHAP 2: KONFIGURASI SESUAI MODE YANG DIPILIH
            ============================================================ */}
        {step === 'KONFIGURASI' && (
          <form onSubmit={handleMulaiPermainan} className="space-y-6">
            {/* Banner Status Mode Aktif & Tombol Ganti Mode */}
            <div
              className={`rounded-3xl p-5 border-2 flex flex-wrap items-center justify-between gap-4 shadow-xs ${
                playMode === 'SOLO'
                  ? 'bg-[#c8362f] text-white border-[#a22721]'
                  : 'bg-[#1d3b2e] text-[#f4ecd8] border-[#f2c230]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/15">
                  {playMode === 'SOLO' ? (
                    <Monitor className="w-6 h-6" />
                  ) : (
                    <Users className="w-6 h-6 text-[#f2c230]" />
                  )}
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider opacity-85 block">
                    Langkah 2 dari 2 • Konfigurasi Permainan
                  </span>
                  <h2 className="text-lg sm:text-xl font-black">
                    {playMode === 'SOLO'
                      ? 'Solo Mode — Langsung Dimainkan di Perangkat Guru'
                      : 'Multiplayer Mode — Lobi PIN & QR Siswa'}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep('PILIH_MODE')}
                className="px-4 py-2 rounded-xl bg-white text-[#1d3b2e] font-black text-xs hover:bg-[#f4ecd8] transition-colors cursor-pointer"
              >
                ← Ganti Mode
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Kolom Kiri: Bank Soal + Daftar Pertanyaan + Target Kerupuk */}
              <div className="lg:col-span-6 space-y-5">
                {/* Bank Soal & Pratinjau Pertanyaan */}
                <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-[#c8362f]" /> 1. Materi &amp; Pertanyaan Kuis
                    </label>
                    {selectedTemplate && !selectedTemplate.resmi && (
                      <button
                        type="button"
                        onClick={() => navigate(`/guru/template/${selectedTemplate.id}/ubah`)}
                        className="text-[11px] font-bold text-[#1d3b2e] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        Editor Lengkap <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {loadingTemplates ? (
                    <div className="py-6 flex items-center justify-center gap-2 text-xs font-bold text-[#6b7d6c]">
                      <Loader2 className="w-4 h-4 animate-spin" /> Memuat template kuis...
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">
                      Belum ada template kuis. Silakan buat template baru terlebih dahulu.
                    </div>
                  ) : (
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => {
                        setSelectedTemplateId(e.target.value);
                        setTampilTambahSoal(false);
                        setSoalBaruError(null);
                      }}
                      className="w-full p-3 rounded-xl bg-white border-2 border-[#e0d5b8] font-bold text-sm text-[#1d3b2e] focus:outline-none focus:border-[#1d3b2e]"
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.judul} ({t._count?.questions ?? 0} soal)
                          {t.resmi ? ' — Resmi Platform' : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {selectedTemplate && jumlahSoal === 0 && (
                    <div className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-xl">
                      Template terpilih tidak memiliki soal (0 soal). Tambah pertanyaan di bawah atau pilih template lain.
                    </div>
                  )}

                  {/* Khusus Solo Mode: Pratinjau Daftar Pertanyaan + Tambah Soal Cepat */}
                  {playMode === 'SOLO' && selectedTemplate && (
                    <div className="space-y-3 pt-2 border-t border-[#e0d5b8]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[#1d3b2e]">
                          Daftar Pertanyaan ({jumlahSoal} soal siap dimainkan)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTampilTambahSoal((v) => !v);
                            setSoalBaruError(null);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1d3b2e] hover:bg-[#254b3b] text-white text-[11px] font-bold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {tampilTambahSoal ? 'Batal Tambah' : 'Tambah Pertanyaan'}
                        </button>
                      </div>

                      {tampilTambahSoal && (
                        <div className="bg-white border-2 border-[#c8362f]/40 rounded-2xl p-4 space-y-3">
                          <div className="text-xs font-black text-[#c8362f]">
                            Tambah Pertanyaan ke{' '}
                            {selectedTemplate.resmi
                              ? `"${selectedTemplate.judul} (Salinan)"`
                              : `"${selectedTemplate.judul}"`}
                          </div>
                          {soalBaruError && (
                            <div className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg">
                              {soalBaruError}
                            </div>
                          )}
                          <input
                            type="text"
                            placeholder="Tulis teks pertanyaan..."
                            value={soalBaru.teks}
                            onChange={(e) =>
                              setSoalBaru((p) => ({ ...p, teks: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-[#e0d5b8] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1d3b2e]"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Pilihan A"
                              value={soalBaru.opsiA}
                              onChange={(e) =>
                                setSoalBaru((p) => ({ ...p, opsiA: e.target.value }))
                              }
                              className="px-2.5 py-1.5 border border-[#e0d5b8] rounded-lg text-xs font-medium"
                            />
                            <input
                              type="text"
                              placeholder="Pilihan B"
                              value={soalBaru.opsiB}
                              onChange={(e) =>
                                setSoalBaru((p) => ({ ...p, opsiB: e.target.value }))
                              }
                              className="px-2.5 py-1.5 border border-[#e0d5b8] rounded-lg text-xs font-medium"
                            />
                            <input
                              type="text"
                              placeholder="Pilihan C"
                              value={soalBaru.opsiC}
                              onChange={(e) =>
                                setSoalBaru((p) => ({ ...p, opsiC: e.target.value }))
                              }
                              className="px-2.5 py-1.5 border border-[#e0d5b8] rounded-lg text-xs font-medium"
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold">Jawaban Benar:</span>
                              {(['A', 'B', 'C'] as const).map((kode) => (
                                <button
                                  key={kode}
                                  type="button"
                                  onClick={() =>
                                    setSoalBaru((p) => ({ ...p, jawabanBenar: kode }))
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer ${
                                    soalBaru.jawabanBenar === kode
                                      ? 'bg-[#c8362f] text-white'
                                      : 'bg-[#f4ecd8] text-[#1d3b2e]'
                                  }`}
                                >
                                  {kode}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              disabled={savingSoal}
                              onClick={handleSimpanSoalBaru}
                              className="px-3.5 py-1.5 rounded-lg bg-[#c8362f] hover:bg-[#b02d27] text-white text-xs font-black disabled:opacity-60 cursor-pointer"
                            >
                              {savingSoal ? 'Menyimpan...' : 'Simpan Pertanyaan'}
                            </button>
                          </div>
                        </div>
                      )}

                      {loadingDetail ? (
                        <div className="py-3 flex items-center gap-2 text-xs text-[#6b7d6c]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat daftar soal...
                        </div>
                      ) : templateDetail && templateDetail.questions.length > 0 ? (
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {templateDetail.questions.map((q, idx) => (
                            <div
                              key={q.id || idx}
                              className="bg-white border border-[#e0d5b8] rounded-xl px-3 py-2 text-xs flex items-start justify-between gap-2"
                            >
                              <span className="font-semibold text-[#1d3b2e] line-clamp-2">
                                <span className="font-black text-[#c8362f] mr-1">
                                  #{idx + 1}
                                </span>
                                {q.teks}
                              </span>
                              <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[10px]">
                                Kunci: {q.jawabanBenar}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Target Poin Kerupuk */}
                <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 space-y-3 shadow-xs">
                  <label className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-[#c8362f]" /> 2. Target Poin Kerupuk
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {TARGET_PRESETS.map((p) => {
                      const aktif = targetPreset === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setTargetPreset(p.key)}
                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                            aktif
                              ? 'bg-[#c8362f] text-white border-[#c8362f]'
                              : 'bg-white text-[#1d3b2e] border-[#e0d5b8] hover:border-[#c8362f]/50'
                          }`}
                        >
                          <div className="text-xs font-extrabold">{p.label}</div>
                          <div
                            className={`text-[10px] mt-0.5 ${
                              aktif ? 'text-white/85' : 'text-[#6b7d6c]'
                            }`}
                          >
                            {p.desc}
                          </div>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setTargetPreset('custom')}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        targetPreset === 'custom'
                          ? 'bg-[#1d3b2e] text-white border-[#1d3b2e]'
                          : 'bg-white text-[#1d3b2e] border-[#e0d5b8]'
                      }`}
                    >
                      <div className="text-xs font-extrabold">Kustom</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          targetPreset === 'custom' ? 'text-white/85' : 'text-[#6b7d6c]'
                        }`}
                      >
                        10 – 1000 pt
                      </div>
                    </button>
                  </div>

                  {targetPreset === 'custom' && (
                    <div className="flex items-center gap-3 bg-white border border-[#e0d5b8] p-3 rounded-xl">
                      <span className="text-xs font-bold">Target Poin:</span>
                      <input
                        type="number"
                        min={10}
                        max={1000}
                        step={1}
                        value={customTargetInput}
                        onChange={(e) => setCustomTargetInput(e.target.value)}
                        className="w-28 px-3 py-1.5 border border-[#e0d5b8] rounded-lg text-sm font-mono font-bold"
                      />
                    </div>
                  )}

                  {isValidTarget && (
                    <div className="flex flex-wrap gap-2 text-[11px] bg-white border border-[#e0d5b8] p-2.5 rounded-xl">
                      <span className="font-bold text-[#6b7d6c]">
                        Dampak ({targetKerupuk} pt):
                      </span>
                      <span className="font-semibold">
                        Besar -{hitungPoinPengurangan(40, targetKerupuk)}pt
                      </span>
                      <span>•</span>
                      <span className="font-semibold">
                        Sedang -{hitungPoinPengurangan(25, targetKerupuk)}pt
                      </span>
                      <span>•</span>
                      <span className="font-semibold">
                        Kecil -{hitungPoinPengurangan(10, targetKerupuk)}pt
                      </span>
                      <span>•</span>
                      <span className="font-semibold">
                        Mini -{hitungPoinPengurangan(5, targetKerupuk)}pt
                      </span>
                    </div>
                  )}
                </div>

                {/* Opsi Khusus Multiplayer (TIDAK ADA pada Solo Mode) */}
                {playMode === 'MULTIPLAYER' && (
                  <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 shadow-xs">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Kapasitas Siswa
                      </label>
                      <select
                        value={maxPeserta}
                        onChange={(e) => setMaxPeserta(parseInt(e.target.value, 10))}
                        className="w-full p-2.5 bg-white border border-[#e0d5b8] rounded-xl text-xs font-bold"
                      >
                        <option value={20}>20 Siswa</option>
                        <option value={30}>30 Siswa</option>
                        <option value={45}>45 Siswa (Rekomendasi Kelas)</option>
                        <option value={60}>60 Siswa</option>
                        <option value={100}>100 Siswa</option>
                      </select>
                    </div>

                    <label className="flex items-center justify-between bg-white border border-[#e0d5b8] p-3 rounded-xl cursor-pointer">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-[#1d3b2e]" />
                        <div>
                          <div className="text-xs font-bold">Siswa Susulan</div>
                          <div className="text-[10px] text-[#6b7d6c]">
                            Gabung saat lomba jalan
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowLateJoin}
                        onChange={(e) => setAllowLateJoin(e.target.checked)}
                        className="w-4 h-4 accent-[#1d3b2e]"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Kolom Kanan: Probabilitas & Tombol Mulai */}
              <div className="lg:col-span-6 bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#c8362f]" /> 3. Tingkat Kesulitan &amp; Peluang Gigitan
                  </label>
                  <span className="text-[11px] font-bold text-[#6b7d6c] flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5" />
                    {kesulitan === 'custom' ? 'Kustom' : PRESET_DATA[kesulitan].label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PRESET_DATA) as Array<'mudah' | 'normal' | 'sulit'>).map(
                    (key) => {
                      const p = PRESET_DATA[key];
                      const active = kesulitan === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handlePilihKesulitan(key)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'bg-[#1d3b2e] text-white border-[#1d3b2e]'
                              : 'bg-white text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                          }`}
                        >
                          <div className="text-xs font-bold">{p.label}</div>
                          <div
                            className={`text-[10px] mt-0.5 leading-tight ${
                              active ? 'text-white/80' : 'text-[#6b7d6c]'
                            }`}
                          >
                            {p.deskripsi}
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>

                <div className="space-y-2.5 bg-white border border-[#e0d5b8] p-4 rounded-2xl">
                  {[
                    {
                      key: 'besar' as const,
                      label: 'Gigitan Besar (-40%, +40 pt)',
                      cls: 'accent-[#1d3b2e]',
                    },
                    {
                      key: 'sedang' as const,
                      label: 'Gigitan Sedang (-25%, +25 pt)',
                      cls: 'accent-[#1d3b2e]',
                    },
                    {
                      key: 'kecil' as const,
                      label: 'Gigitan Kecil (-10%, +10 pt)',
                      cls: 'accent-[#1d3b2e]',
                    },
                    {
                      key: 'sangat_kecil' as const,
                      label: 'Gigitan Mini (-5%, +5 pt)',
                      cls: 'accent-[#1d3b2e]',
                    },
                    {
                      key: 'zonk' as const,
                      label: 'Zonk / Tidak Menggigit (0%, +0 pt)',
                      cls: 'accent-[#c8362f]',
                    },
                  ].map((item) => (
                    <div key={item.key}>
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span>{item.label}</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={probabilitas[item.key]}
                            onChange={(e) =>
                              updateNilaiProb(item.key, parseFloat(e.target.value || '0'))
                            }
                            className="w-14 px-1.5 py-0.5 text-right font-mono text-xs bg-[#fcf8ed] border border-[#e0d5b8] rounded"
                          />
                          <span className="font-mono text-xs">%</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={probabilitas[item.key]}
                        onChange={(e) =>
                          updateNilaiProb(item.key, parseInt(e.target.value, 10))
                        }
                        className={`w-full ${item.cls} h-2 bg-[#e0d5b8] rounded-lg appearance-none cursor-pointer`}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Total Probabilitas:</span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-lg ${
                      isValidProb
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {isValidProb ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Tepat 100% (Siap)
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" /> {totalPersen}% (Wajib 100%)
                      </>
                    )}
                  </span>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={`w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 shadow-md transition-all ${
                      !canSubmit
                        ? 'bg-slate-400 cursor-not-allowed opacity-60'
                        : playMode === 'MULTIPLAYER'
                        ? 'bg-[#1d3b2e] hover:bg-[#254b3b] cursor-pointer'
                        : 'bg-[#c8362f] hover:bg-[#b02d27] cursor-pointer'
                    }`}
                  >
                    <Play className="w-5 h-5 fill-current" />
                    {submitting
                      ? 'Mempersiapkan Permainan...'
                      : playMode === 'MULTIPLAYER'
                      ? 'Buat Sesi & Buka Lobi PIN'
                      : 'Mulai Permainan'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
