import { useState, useEffect, useMemo } from 'react';
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
  Play,
  Loader2,
  BookOpen,
  UserCheck,
  QrCode,
  Trophy,
  Sliders,
} from 'lucide-react';

interface TemplateItem {
  id: string;
  judul: string;
  game: string;
  mode: string;
  resmi?: boolean;
  _count?: { questions: number };
}

export default function PilihModeKerupuk() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTemplateId = searchParams.get('templateId') || '';
  const queryKembali = searchParams.get('kembali') || '/guru';

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(queryTemplateId);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);

  // Mode & Aturan Inti Bersama
  const [playMode, setPlayMode] = useState<PlayModeKerupuk>('MULTIPLAYER');
  const [targetPreset, setTargetPreset] = useState<TargetKerupukPreset>('100');
  const [customTargetInput, setCustomTargetInput] = useState<string>('120');
  const [kesulitan, setKesulitan] = useState<KesulitanKerupuk>('normal');
  const [probabilitas, setProbabilitas] = useState<ProbabilitasConfig>({
    ...PRESET_DATA.normal.probabilitas,
  });

  // Pengaturan Multiplayer
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

        // Prioritaskan template makan_kerupuk di urutan teratas, tetap sediakan kuis lain
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

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const jumlahSoal = selectedTemplate?._count?.questions ?? 0;

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

  const handlePilihKesulitan = (key: 'mudah' | 'normal' | 'sulit') => {
    setKesulitan(key);
    setProbabilitas({ ...PRESET_DATA[key].probabilitas });
  };

  const updateNilaiProb = (key: keyof ProbabilitasConfig, val: number) => {
    const clean = Number.isFinite(val) ? Math.max(0, Math.min(100, val)) : 0;
    setKesulitan('custom');
    setProbabilitas((prev) => ({ ...prev, [key]: clean }));
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

      const res = await apiRequest<{ session: { id: string } }>('/sesi', {
        method: 'POST',
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          game: 'makan_kerupuk',
          mode: playMode === 'MULTIPLAYER' ? 'multi' : 'solo',
          playMode,
          ...(playMode === 'MULTIPLAYER'
            ? {
                kerupukMultiConfig: {
                  ...baseKerupuk,
                  maxPeserta,
                  allowLateJoin,
                },
              }
            : { kerupukConfig: baseKerupuk }),
        }),
      });

      const backTarget = `/guru/makan-kerupuk?templateId=${encodeURIComponent(selectedTemplate.id)}&kembali=${encodeURIComponent(queryKembali)}`;
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
              onClick={() => navigate(queryKembali)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#f2c230] block">
                Lomba Digital 17 Agustus • DISCERE
              </span>
              <h1 className="text-xl sm:text-2xl font-black">Makan Kerupuk Challenge</h1>
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

        <form onSubmit={handleMulaiPermainan} className="space-y-6">
          {/* 1. Dua Pilihan Mode Permainan */}
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-black text-[#1d3b2e]">1. Pilih Mode Permainan</h2>
              <p className="text-xs text-[#6b7d6c]">
                Gunakan Multiplayer untuk seluruh siswa lewat HP masing-masing, atau Solo Mode jika kelas memakai satu perangkat proyektor.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Kartu A: Multiplayer Mode */}
              <button
                type="button"
                onClick={() => setPlayMode('MULTIPLAYER')}
                className={`p-6 rounded-3xl border-3 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                  playMode === 'MULTIPLAYER'
                    ? 'bg-[#1d3b2e] text-[#f4ecd8] border-[#f2c230] shadow-xl'
                    : 'bg-[#fcf8ed] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f2c230] text-[#1d3b2e] text-xs font-black uppercase">
                      <Users className="w-3.5 h-3.5" /> Multiplayer Mode
                    </div>
                    {playMode === 'MULTIPLAYER' && (
                      <CheckCircle2 className="w-6 h-6 text-[#f2c230]" />
                    )}
                  </div>
                  <h3 className="text-xl font-black">
                    Setiap Siswa Bermain di HP Masing-Masing
                  </h3>
                  <p
                    className={`text-xs leading-relaxed ${
                      playMode === 'MULTIPLAYER' ? 'text-white/85' : 'text-[#6b7d6c]'
                    }`}
                  >
                    Guru menghasilkan PIN &amp; QR Code, siswa menjawab kuis secara mandiri, dan leaderboard proyektor bergerak real-time.
                  </p>
                </div>

                <div
                  className={`grid grid-cols-2 gap-2 text-[11px] font-bold pt-3 border-t ${
                    playMode === 'MULTIPLAYER' ? 'border-white/15' : 'border-[#e0d5b8]'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-[#f2c230]" /> PIN &amp; QR Gabung
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-[#f2c230]" /> Leaderboard Real-Time
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#f2c230]" /> Hingga 40+ Siswa
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[#f2c230]" /> Kerupuk Per Individu
                  </span>
                </div>
              </button>

              {/* Kartu B: Solo Mode (Teacher Device) */}
              <button
                type="button"
                onClick={() => setPlayMode('SOLO')}
                className={`p-6 rounded-3xl border-3 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                  playMode === 'SOLO'
                    ? 'bg-[#c8362f] text-white border-[#1d3b2e] shadow-xl'
                    : 'bg-[#fcf8ed] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#c8362f]/50'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase ${
                        playMode === 'SOLO'
                          ? 'bg-white text-[#c8362f]'
                          : 'bg-[#f6d9d3] text-[#c8362f]'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" /> Solo Mode (Teacher Device)
                    </div>
                    {playMode === 'SOLO' && <CheckCircle2 className="w-6 h-6 text-white" />}
                  </div>
                  <h3 className="text-xl font-black">
                    Satu Perangkat Guru di Layar Proyektor
                  </h3>
                  <p
                    className={`text-xs leading-relaxed ${
                      playMode === 'SOLO' ? 'text-white/90' : 'text-[#6b7d6c]'
                    }`}
                  >
                    Tidak membutuhkan HP siswa, PIN, atau QR Code. Guru memandu &amp; menjawab soal langsung melalui mouse, keyboard, atau sentuhan.
                  </p>
                </div>

                <div
                  className={`grid grid-cols-2 gap-2 text-[11px] font-bold pt-3 border-t ${
                    playMode === 'SOLO' ? 'border-white/20' : 'border-[#e0d5b8]'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5" /> Tanpa PIN / QR Code
                  </span>
                  <span className="flex items-center gap-1.5">
                    Karakter 2D Proyektor
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5" /> Kontrol Jeda &amp; Ulang
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Fokus Kuis Klasikal
                  </span>
                </div>
              </button>
            </div>
          </section>

          {/* 2. Pilih Template Soal & Aturan Permainan */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Kolom Kiri: Pilih Bank Soal + Target */}
            <div className="lg:col-span-6 space-y-5">
              <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 space-y-3 shadow-xs">
                <label className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#c8362f]" /> 2. Pilih Template Kuis
                </label>

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
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
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
                    Template terpilih tidak memiliki soal (0 soal). Pilih template lain atau tambah soal.
                  </div>
                )}
              </div>

              {/* Target Poin Kerupuk */}
              <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 space-y-3 shadow-xs">
                <label className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-[#c8362f]" /> 3. Target Poin Kerupuk
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
                    <span className="font-bold text-[#6b7d6c]">Dampak ({targetKerupuk} pt):</span>
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

              {/* Opsi Tambahan Bila Multiplayer */}
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
                        <div className="text-[10px] text-[#6b7d6c]">Gabung saat lomba jalan</div>
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

            {/* Kolom Kanan: Probabilitas & Preset Kesulitan */}
            <div className="lg:col-span-6 bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  4. Probabilitas Gigitan
                </label>
                <span className="text-[11px] font-bold text-[#6b7d6c] flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5" />
                  {kesulitan === 'custom' ? 'Kustom' : PRESET_DATA[kesulitan].label}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PRESET_DATA) as Array<'mudah' | 'normal' | 'sulit'>).map((key) => {
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
                })}
              </div>

              <div className="space-y-2.5 bg-white border border-[#e0d5b8] p-4 rounded-2xl">
                {[
                  { key: 'besar' as const, label: 'Gigitan Besar (-40%, +40 pt)', cls: 'accent-[#1d3b2e]' },
                  { key: 'sedang' as const, label: 'Gigitan Sedang (-25%, +25 pt)', cls: 'accent-[#1d3b2e]' },
                  { key: 'kecil' as const, label: 'Gigitan Kecil (-10%, +10 pt)', cls: 'accent-[#1d3b2e]' },
                  { key: 'sangat_kecil' as const, label: 'Gigitan Mini (-5%, +5 pt)', cls: 'accent-[#1d3b2e]' },
                  { key: 'zonk' as const, label: 'Zonk / Tidak Menggigit (0%, +0 pt)', cls: 'accent-[#c8362f]' },
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
                      onChange={(e) => updateNilaiProb(item.key, parseInt(e.target.value, 10))}
                      className={`w-full ${item.cls} h-2 bg-[#e0d5b8] rounded-lg appearance-none cursor-pointer`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Total Probabilitas:</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-lg ${
                    isValidProb ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
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
                  className={`w-full py-3.5 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
                    !canSubmit
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : playMode === 'MULTIPLAYER'
                      ? 'bg-[#1d3b2e] hover:bg-[#254b3b] cursor-pointer'
                      : 'bg-[#c8362f] hover:bg-[#b02d27] cursor-pointer'
                  }`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  {submitting
                    ? 'Mempersiapkan Sesi...'
                    : playMode === 'MULTIPLAYER'
                    ? 'Buat Sesi Multiplayer & Buka Lobi PIN'
                    : 'Mulai Solo Mode di Proyektor'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

