import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import {
  ArrowLeft,
  Users,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  Play,
  Loader2,
  BookOpen,
  UserCheck,
  QrCode,
  Trophy,
  Flag,
  Sliders,
  Scale,
  Flame,
  ShieldAlert,
  Shield,
  Zap,
  CloudRain,
  Bot,
  Swords,
} from 'lucide-react';

export type PlayModeBalapKarung = 'MULTIPLAYER' | 'SOLO';
export type PresetJarakBalap = 'pendek' | 'normal' | 'panjang' | 'custom';
export type KesulitanBalap = 'mudah' | 'normal' | 'sulit' | 'custom';
export type TipeLawanSoloBalap = 'bot' | 'lokal';
export type KesulitanBotBalap = 'santai' | 'sedang' | 'cepat';
export type JenisRintanganBalap =
  | 'kulit_pisang'
  | 'perisai'
  | 'lompatan_kuat'
  | 'jalan_berlumpur';

export interface ProbabilitasRintanganBalap {
  kulit_pisang: number;
  perisai: number;
  lompatan_kuat: number;
  jalan_berlumpur: number;
}

interface TemplateItem {
  id: string;
  judul: string;
  game: string;
  mode: string;
  resmi?: boolean;
  _count?: { questions: number };
}

const JARAK_MAP: Record<Exclude<PresetJarakBalap, 'custom'>, number> = {
  pendek: 50,
  normal: 100,
  panjang: 150,
};

const PRESET_KESULITAN = {
  mudah: {
    label: 'Mudah (Santai)',
    desc: '+15m / -3m • Keseimbangan -10%',
    lompatBenar: 15,
    turunSalah: 3,
    keseimbanganBenar: 5,
    keseimbanganSalah: 10,
  },
  normal: {
    label: 'Normal (Seimbang)',
    desc: '+10m / -3m • Keseimbangan -20%',
    lompatBenar: 10,
    turunSalah: 3,
    keseimbanganBenar: 5,
    keseimbanganSalah: 20,
  },
  sulit: {
    label: 'Sulit (Tantangan)',
    desc: '+7m / -5m • Keseimbangan -25%',
    lompatBenar: 7,
    turunSalah: 5,
    keseimbanganBenar: 5,
    keseimbanganSalah: 25,
  },
};

export default function PilihModeBalapKarung() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTemplateId = searchParams.get('templateId') || '';
  const queryKembali = searchParams.get('kembali') || '/guru';

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(queryTemplateId);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const hasSyncedInitialMode = useRef(false);

  // Mode utama (Multiplayer vs Solo 1 vs 1)
  const [playMode, setPlayMode] = useState<PlayModeBalapKarung>('MULTIPLAYER');

  // Target jarak
  const [presetJarak, setPresetJarak] = useState<PresetJarakBalap>('normal');
  const [targetCustomInput, setTargetCustomInput] = useState<string>('120');

  // Solo 1 vs 1 Settings
  const [tipeLawanSolo, setTipeLawanSolo] = useState<TipeLawanSoloBalap>('bot');
  const [kesulitanBot, setKesulitanBot] = useState<KesulitanBotBalap>('sedang');
  const [namaPemain1, setNamaPemain1] = useState<string>('Pemain 1');
  const [namaPemain2, setNamaPemain2] = useState<string>('Lawan Bot');

  // Multiplayer Settings
  const [maxPeserta, setMaxPeserta] = useState<number>(100);
  const [allowLateJoin, setAllowLateJoin] = useState<boolean>(true);

  // Kesulitan, Keseimbangan & Streak
  const [kesulitan, setKesulitan] = useState<KesulitanBalap>('normal');
  const [lompatBenar, setLompatBenar] = useState<number>(10);
  const [turunSalah, setTurunSalah] = useState<number>(3);
  const [keseimbanganAktif, setKeseimbanganAktif] = useState<boolean>(true);
  const [keseimbanganBenar, setKeseimbanganBenar] = useState<number>(5);
  const [keseimbanganSalah, setKeseimbanganSalah] = useState<number>(20);
  const [penurunanJatuhJarak, setPenurunanJatuhJarak] = useState<number>(5);
  const [pemulihanJatuhKeseimbangan, setPemulihanJatuhKeseimbangan] = useState<number>(50);

  const [bonusStreakAktif, setBonusStreakAktif] = useState<boolean>(true);
  const [bonusStreak3Jarak, setBonusStreak3Jarak] = useState<number>(5);
  const [bonusStreak5Jarak, setBonusStreak5Jarak] = useState<number>(10);
  const [bonusStreak3Keseimbangan, setBonusStreak3Keseimbangan] = useState<number>(10);

  // Rintangan Opsional
  const [rintanganAktif, setRintanganAktif] = useState<boolean>(false);
  const [rintanganDipilih, setRintanganDipilih] = useState<JenisRintanganBalap[]>([
    'kulit_pisang',
    'perisai',
    'lompatan_kuat',
    'jalan_berlumpur',
  ]);
  const [peluangRintanganPersen, setPeluangRintanganPersen] = useState<number>(20);
  const [probabilitasRintangan, setProbabilitasRintangan] =
    useState<ProbabilitasRintanganBalap>({
      kulit_pisang: 25,
      perisai: 25,
      lompatan_kuat: 25,
      jalan_berlumpur: 25,
    });
  const [penurunanKulitPisang, setPenurunanKulitPisang] = useState<number>(15);
  const [bonusLompatanKuat, setBonusLompatanKuat] = useState<number>(5);
  const [penaltiJalanBerlumpur, setPenaltiJalanBerlumpur] = useState<number>(5);

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
          const aB = a.game === 'balap_karung' ? 0 : 1;
          const bB = b.game === 'balap_karung' ? 0 : 1;
          return aB - bB;
        });

        setTemplates(sorted);
        let initialTmpl: TemplateItem | undefined;
        if (queryTemplateId) {
          initialTmpl = sorted.find((t) => t.id === queryTemplateId);
        }
        if (!initialTmpl && sorted.length > 0) {
          initialTmpl = sorted[0];
        }
        if (initialTmpl) {
          setSelectedTemplateId(initialTmpl.id);
          if (!hasSyncedInitialMode.current) {
            hasSyncedInitialMode.current = true;
            if (initialTmpl.mode === 'solo') {
              setPlayMode('SOLO');
            }
          }
        }
      } catch (err: any) {
        if (active) setErrorPesan(err.pesan || 'Gagal memuat daftar template kuis.');
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

  const targetJarakFinal = useMemo(() => {
    if (presetJarak === 'custom') {
      const parsed = parseInt(targetCustomInput, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return JARAK_MAP[presetJarak];
  }, [presetJarak, targetCustomInput]);

  const isValidTarget =
    Number.isInteger(targetJarakFinal) && targetJarakFinal >= 10 && targetJarakFinal <= 1000;

  const rintanganTersediaDipilih = useMemo(
    () =>
      keseimbanganAktif
        ? rintanganDipilih
        : rintanganDipilih.filter((j) => j !== 'kulit_pisang' && j !== 'perisai'),
    [keseimbanganAktif, rintanganDipilih]
  );

  const totalBobotDipilih = rintanganTersediaDipilih.reduce(
    (sum, k) => sum + (probabilitasRintangan[k] || 0),
    0
  );

  const rintanganValid =
    !rintanganAktif || (rintanganTersediaDipilih.length > 0 && totalBobotDipilih > 0);

  const soloNamesValid =
    playMode !== 'SOLO' || (namaPemain1.trim().length >= 1 && namaPemain2.trim().length >= 1);

  const canSubmit =
    Boolean(selectedTemplate) &&
    jumlahSoal > 0 &&
    isValidTarget &&
    rintanganValid &&
    soloNamesValid &&
    !submitting;

  const pilihPresetKesulitan = (mode: KesulitanBalap) => {
    setKesulitan(mode);
    if (mode !== 'custom') {
      const p = PRESET_KESULITAN[mode];
      setLompatBenar(p.lompatBenar);
      setTurunSalah(p.turunSalah);
      setKeseimbanganBenar(p.keseimbanganBenar);
      setKeseimbanganSalah(p.keseimbanganSalah);
      setBonusStreak3Jarak(5);
      setBonusStreak5Jarak(10);
      setBonusStreak3Keseimbangan(10);
      setPenurunanJatuhJarak(5);
      setPemulihanJatuhKeseimbangan(50);
    }
  };

  const toggleRintangan = (jenis: JenisRintanganBalap) => {
    setRintanganDipilih((prev) =>
      prev.includes(jenis) ? prev.filter((item) => item !== jenis) : [...prev, jenis]
    );
  };

  const handleUbahTipeLawanSolo = (tipe: TipeLawanSoloBalap) => {
    setTipeLawanSolo(tipe);
    if (tipe === 'bot' && (namaPemain2 === 'Pemain 2' || !namaPemain2.trim())) {
      setNamaPemain2('Lawan Bot');
    } else if (tipe === 'lokal' && (namaPemain2 === 'Lawan Bot' || !namaPemain2.trim())) {
      setNamaPemain2('Pemain 2');
    }
  };

  const bagiRataBobot = () => {
    const aktif = rintanganTersediaDipilih;
    if (aktif.length === 0) return;
    const base = Math.floor(100 / aktif.length);
    const remainder = 100 - base * aktif.length;
    const next: ProbabilitasRintanganBalap = {
      kulit_pisang: 0,
      perisai: 0,
      lompatan_kuat: 0,
      jalan_berlumpur: 0,
    };
    aktif.forEach((key, idx) => {
      next[key] = base + (idx === 0 ? remainder : 0);
    });
    setProbabilitasRintangan(next);
  };

  const daftarRintanganDinamis = useMemo(
    () => [
      {
        id: 'kulit_pisang' as JenisRintanganBalap,
        nama: 'Kulit Pisang',
        ringkas: `Mengurangi keseimbangan -${penurunanKulitPisang}%.`,
        Icon: AlertTriangle,
        perluKeseimbangan: true,
      },
      {
        id: 'perisai' as JenisRintanganBalap,
        nama: 'Perisai Keseimbangan',
        ringkas: 'Tahan pengurangan jarak 1x saat jatuh.',
        Icon: Shield,
        perluKeseimbangan: true,
      },
      {
        id: 'lompatan_kuat' as JenisRintanganBalap,
        nama: 'Lompatan Kuat',
        ringkas: `Bonus +${bonusLompatanKuat} meter di lompatan benar berikutnya.`,
        Icon: Zap,
        perluKeseimbangan: false,
      },
      {
        id: 'jalan_berlumpur' as JenisRintanganBalap,
        nama: 'Jalan Berlumpur',
        ringkas: `Kurangi lompatan benar berikutnya -${penaltiJalanBerlumpur} meter.`,
        Icon: CloudRain,
        perluKeseimbangan: false,
      },
    ],
    [penurunanKulitPisang, bonusLompatanKuat, penaltiJalanBerlumpur]
  );

  const handleMulaiPermainan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedTemplate) return;

    try {
      setSubmitting(true);
      setErrorPesan(null);

      const balapKarungConfig = {
        presetJarak,
        targetJarak: targetJarakFinal,
        kesulitan,
        lompatBenar,
        turunSalah,
        keseimbanganAktif,
        keseimbanganBenar,
        keseimbanganSalah,
        bonusStreakAktif,
        bonusStreak3Jarak,
        bonusStreak5Jarak,
        bonusStreak3Keseimbangan,
        penurunanJatuhJarak,
        pemulihanJatuhKeseimbangan,
        rintanganAktif,
        rintanganDipilih: rintanganTersediaDipilih,
        peluangRintanganPersen,
        probabilitasRintangan,
        penurunanKulitPisang,
        bonusLompatanKuat,
        penaltiJalanBerlumpur,
        maxPeserta: playMode === 'MULTIPLAYER' ? maxPeserta : 2,
        allowLateJoin: playMode === 'MULTIPLAYER' ? allowLateJoin : false,
        tipeLawanSolo,
        kesulitanBot,
        namaPemain1: namaPemain1.trim() || 'Pemain 1',
        namaPemain2:
          namaPemain2.trim() || (tipeLawanSolo === 'bot' ? 'Lawan Bot' : 'Pemain 2'),
      };

      const res = await apiRequest<{ session: { id: string } }>('/sesi', {
        method: 'POST',
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          game: 'balap_karung',
          mode: playMode === 'MULTIPLAYER' ? 'multi' : 'solo',
          playMode,
          balapKarungConfig,
        }),
      });

      const backTarget = `/guru/balap-karung?templateId=${encodeURIComponent(
        selectedTemplate.id
      )}&kembali=${encodeURIComponent(queryKembali)}`;
      navigate(`/guru/sesi/${res.session.id}?kembali=${encodeURIComponent(backTarget)}`);
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal membuat sesi Balap Karung Challenge.');
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
              <h1 className="text-xl sm:text-2xl font-black">Balap Karung Challenge</h1>
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
          {/* 1. Pilih Mode Permainan */}
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-black text-[#1d3b2e]">1. Pilih Mode Permainan</h2>
              <p className="text-xs text-[#6b7d6c]">
                Gunakan Multiplayer agar lintasan menyesuaikan jumlah siswa lewat HP masing-masing, atau Solo Mode untuk duel 1 vs 1 di satu layar proyektor.
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
                    Guru menghasilkan PIN &amp; QR Code. Jumlah avatar dan lintasan balap pada layar otomatis menyesuaikan seluruh siswa yang bergabung.
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
                    <Users className="w-3.5 h-3.5 text-[#f2c230]" /> Sesuai Jumlah Siswa
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-[#f2c230]" /> Lintasan Per Pelari
                  </span>
                </div>
              </button>

              {/* Kartu B: Solo Mode (1 vs 1) */}
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
                      <Monitor className="w-3.5 h-3.5" /> Solo Mode (1 vs 1)
                    </div>
                    {playMode === 'SOLO' && <CheckCircle2 className="w-6 h-6 text-white" />}
                  </div>
                  <h3 className="text-xl font-black">
                    Satu Perangkat Guru • 1 vs 1 dengan Lawan
                  </h3>
                  <p
                    className={`text-xs leading-relaxed ${
                      playMode === 'SOLO' ? 'text-white/90' : 'text-[#6b7d6c]'
                    }`}
                  >
                    Tanpa HP siswa, PIN, atau QR Code. Di layar proyektor hanya tampil tepat 2 avatar balap karung (1 vs 1) melawan Bot AI atau pemain ke-2 lokal.
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
                    <Swords className="w-3.5 h-3.5" /> Tepat 2 Avatar (1 vs 1)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" /> Lawan Bot / Duel Lokal
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5" /> Kontrol Jeda &amp; Ulang
                  </span>
                </div>
              </button>
            </div>
          </section>

          {/* 2 & 3. Grid Konfigurasi */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Kolom Kiri: Template, Target Jarak, & Pengaturan Mode */}
            <div className="lg:col-span-5 space-y-5">
              {/* Pilih Template */}
              <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#1d3b2e]">
                  <BookOpen className="w-4 h-4 text-[#c8362f]" />
                  <span>2. Pilih Template Kuis</span>
                </div>

                {loadingTemplates ? (
                  <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#6b7d6c]">
                    <Loader2 className="w-4 h-4 animate-spin" /> Memuat daftar kuis...
                  </div>
                ) : templates.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    Belum ada template kuis. Silakan buat template baru terlebih dahulu.
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-[#e0d5b8] text-sm font-bold text-[#1d3b2e] focus:border-[#1d3b2e] outline-none"
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.judul} ({t._count?.questions ?? 0} soal)
                          {t.resmi ? ' ★ Resmi' : ''}
                        </option>
                      ))}
                    </select>

                    {selectedTemplate && (
                      <div className="flex items-center justify-between text-xs text-[#6b7d6c] px-1">
                        <span>
                          Bank soal:{' '}
                          <strong className="text-[#1d3b2e]">{jumlahSoal} pertanyaan</strong>
                        </span>
                        <span className="font-mono uppercase text-[10px] px-2 py-0.5 rounded bg-[#f4ecd8] border border-[#e0d5b8]">
                          Acak Berulang
                        </span>
                      </div>
                    )}

                    {selectedTemplate && jumlahSoal === 0 && (
                      <p className="text-xs text-[#c8362f] font-bold">
                        Template ini belum memiliki soal. Tambahkan minimal 1 soal dulu.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Target Jarak Finis */}
              <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#1d3b2e]">
                  <Flag className="w-4 h-4 text-[#c8362f]" />
                  <span>3. Target Jarak Finis (Meter)</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { key: 'pendek', label: 'Pendek (50m)' },
                      { key: 'normal', label: 'Normal (100m)' },
                      { key: 'panjang', label: 'Panjang (150m)' },
                      { key: 'custom', label: 'Kustom' },
                    ] as const
                  ).map((item) => {
                    const active = presetJarak === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setPresetJarak(item.key)}
                        className={`py-2.5 px-2 rounded-xl border-2 text-xs font-black transition-all cursor-pointer ${
                          active
                            ? 'bg-[#c8362f] text-white border-[#c8362f]'
                            : 'bg-white text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {presetJarak === 'custom' && (
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs font-bold text-[#6b7d6c] shrink-0">
                      Jarak (10–1000 m):
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      value={targetCustomInput}
                      onChange={(e) => setTargetCustomInput(e.target.value)}
                      className="w-28 px-3 py-1.5 rounded-xl bg-white border-2 border-[#e0d5b8] font-mono font-bold text-sm text-center"
                    />
                  </div>
                )}

                <div className="p-3 rounded-xl bg-[#f4ecd9] border border-[#e0d5b8] text-xs text-[#6b7d6c] flex items-center justify-between">
                  <span>Garis finis ditetapkan pada:</span>
                  <strong className="text-[#1d3b2e] font-mono text-sm">
                    {isValidTarget ? `${targetJarakFinal} m` : 'Tidak valid'}
                  </strong>
                </div>
              </div>

              {/* Pengaturan Khusus Solo 1 vs 1 ATAU Multiplayer */}
              {playMode === 'SOLO' ? (
                <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#c8362f]">
                      <Swords className="w-4 h-4" />
                      <span>Pengaturan Duel 1 vs 1 (Solo)</span>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#f6d9d3] text-[#c8362f]">
                      Tepat 2 Avatar
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUbahTipeLawanSolo('bot')}
                      className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        tipeLawanSolo === 'bot'
                          ? 'bg-[#c8362f] text-white border-[#c8362f]'
                          : 'bg-white text-[#1d3b2e] border-[#e0d5b8] hover:border-[#c8362f]/50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-black text-xs">
                        <Bot className="w-4 h-4" /> Lawan Bot AI
                      </div>
                      <p
                        className={`text-[10px] mt-1 ${
                          tipeLawanSolo === 'bot' ? 'text-white/85' : 'text-[#6b7d6c]'
                        }`}
                      >
                        1 pemain jawab kuis melawan Bot otomatis di layar.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUbahTipeLawanSolo('lokal')}
                      className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        tipeLawanSolo === 'lokal'
                          ? 'bg-[#c8362f] text-white border-[#c8362f]'
                          : 'bg-white text-[#1d3b2e] border-[#e0d5b8] hover:border-[#c8362f]/50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-black text-xs">
                        <Users className="w-4 h-4" /> Duel Lokal (2 Orang)
                      </div>
                      <p
                        className={`text-[10px] mt-1 ${
                          tipeLawanSolo === 'lokal' ? 'text-white/85' : 'text-[#6b7d6c]'
                        }`}
                      >
                        2 peserta adu cepat kiri vs kanan pada 1 layar bersama.
                      </p>
                    </button>
                  </div>

                  {tipeLawanSolo === 'bot' && (
                    <div>
                      <label className="text-[11px] font-bold text-[#6b7d6c] block mb-1.5">
                        Kecepatan &amp; Akurasi Lawan Bot
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { key: 'santai', label: 'Santai', desc: '58% benar' },
                            { key: 'sedang', label: 'Sedang', desc: '74% benar' },
                            { key: 'cepat', label: 'Cepat', desc: '88% benar' },
                          ] as const
                        ).map((b) => (
                          <button
                            key={b.key}
                            type="button"
                            onClick={() => setKesulitanBot(b.key)}
                            className={`py-2 px-2 rounded-xl border-2 text-xs font-black transition-all cursor-pointer ${
                              kesulitanBot === b.key
                                ? 'bg-[#1d3b2e] text-white border-[#1d3b2e]'
                                : 'bg-white text-[#1d3b2e] border-[#e0d5b8]'
                            }`}
                          >
                            <div>{b.label}</div>
                            <div className="text-[10px] font-normal opacity-80">{b.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-[#c8362f] block mb-1">
                        Nama Avatar 1 (Kiri)
                      </label>
                      <input
                        type="text"
                        maxLength={24}
                        value={namaPemain1}
                        onChange={(e) => setNamaPemain1(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border-2 border-[#e0d5b8] font-bold"
                        placeholder="Pemain 1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#2563eb] block mb-1">
                        {tipeLawanSolo === 'bot' ? 'Nama Lawan (Bot)' : 'Nama Avatar 2 (Kanan)'}
                      </label>
                      <input
                        type="text"
                        maxLength={24}
                        value={namaPemain2}
                        onChange={(e) => setNamaPemain2(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border-2 border-[#e0d5b8] font-bold"
                        placeholder={tipeLawanSolo === 'bot' ? 'Lawan Bot' : 'Pemain 2'}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#1d3b2e]">
                    <UserCheck className="w-4 h-4 text-[#1d3b2e]" />
                    <span>Pengaturan Peserta Multiplayer</span>
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1.5">
                      Maksimal Peserta (1–200 siswa)
                    </label>
                    <div className="flex items-center gap-3">
                      <select
                        value={maxPeserta}
                        onChange={(e) => setMaxPeserta(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-white border-2 border-[#e0d5b8] font-bold text-xs"
                      >
                        <option value={40}>Maksimal 40 Siswa</option>
                        <option value={60}>Maksimal 60 Siswa</option>
                        <option value={100}>Maksimal 100 Siswa</option>
                        <option value={200}>Maksimal 200 Siswa</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-[#e0d5b8] cursor-pointer">
                    <div>
                      <div className="text-xs font-bold">Izinkan Gabung Susulan</div>
                      <div className="text-[11px] text-[#6b7d6c]">
                        Siswa yang terlambat tetap bisa masuk setelah game dimulai
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowLateJoin}
                      onChange={(e) => setAllowLateJoin(e.target.checked)}
                      className="w-5 h-5 accent-[#1d3b2e]"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Kolom Kanan: Tingkat Kesulitan, Keseimbangan, Streak & Rintangan */}
            <div className="lg:col-span-7 bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#1d3b2e]">
                  <Sliders className="w-4 h-4 text-[#c8362f]" />
                  <span>4. Kesulitan, Keseimbangan &amp; Rintangan</span>
                </div>
                <span className="text-xs font-bold text-[#6b7d6c]">
                  {kesulitan === 'custom'
                    ? 'Pengaturan Kustom'
                    : PRESET_KESULITAN[kesulitan].label}
                </span>
              </div>

              {/* Preset Kesulitan */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(['mudah', 'normal', 'sulit', 'custom'] as KesulitanBalap[]).map((key) => {
                  const active = kesulitan === key;
                  const info =
                    key === 'custom'
                      ? { label: 'Kustom', desc: 'Atur semua parameter' }
                      : PRESET_KESULITAN[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pilihPresetKesulitan(key)}
                      className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-[#1d3b2e] text-white border-[#1d3b2e]'
                          : 'bg-white text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                      }`}
                    >
                      <div className="text-xs font-bold">{info.label}</div>
                      <div
                        className={`text-[10px] mt-0.5 leading-tight ${
                          active ? 'text-white/80' : 'text-[#6b7d6c]'
                        }`}
                      >
                        {info.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {kesulitan === 'custom' && (
                <div className="bg-white border border-[#e0d5b8] rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-[11px] block mb-1">Lompat Benar (+m)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={lompatBenar}
                      onChange={(e) =>
                        setLompatBenar(Math.min(100, Math.max(1, Number(e.target.value) || 1)))
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-[11px] block mb-1">Turun Salah (-m)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={turunSalah}
                      onChange={(e) =>
                        setTurunSalah(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-[11px] block mb-1">Jatuh Turun (-m)</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={penurunanJatuhJarak}
                      onChange={(e) =>
                        setPenurunanJatuhJarak(
                          Math.min(50, Math.max(0, Number(e.target.value) || 0))
                        )
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-[11px] block mb-1">
                      Keseimbangan Benar (+%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={keseimbanganBenar}
                      onChange={(e) =>
                        setKeseimbanganBenar(
                          Math.min(50, Math.max(0, Number(e.target.value) || 0))
                        )
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-[11px] block mb-1">
                      Keseimbangan Salah (-%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={keseimbanganSalah}
                      onChange={(e) =>
                        setKeseimbanganSalah(
                          Math.min(100, Math.max(0, Number(e.target.value) || 0))
                        )
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-[11px] block mb-1">
                      Pulih Setelah Jatuh (%)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={pemulihanJatuhKeseimbangan}
                      onChange={(e) =>
                        setPemulihanJatuhKeseimbangan(
                          Math.min(100, Math.max(10, Number(e.target.value) || 10))
                        )
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Keseimbangan & Bonus Streak */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="p-3.5 bg-white border border-[#e0d5b8] rounded-2xl flex items-start justify-between gap-2.5 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-sky-600" /> Sistem Keseimbangan
                    </span>
                    <p className="text-[11px] text-[#6b7d6c] mt-0.5 leading-snug">
                      Jika 0%, pemain terjatuh (-{penurunanJatuhJarak}m) lalu pulih{' '}
                      {pemulihanJatuhKeseimbangan}%.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={keseimbanganAktif}
                    onChange={(e) => setKeseimbanganAktif(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded accent-[#1d3b2e]"
                  />
                </label>

                <div className="p-3.5 bg-white border border-[#e0d5b8] rounded-2xl space-y-2">
                  <label className="flex items-start justify-between gap-2.5 cursor-pointer">
                    <div>
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-orange-500" /> Bonus Streak
                      </span>
                      <p className="text-[11px] text-[#6b7d6c] mt-0.5 leading-snug">
                        Streak 3: +{bonusStreak3Jarak}m
                        {keseimbanganAktif ? ` & +${bonusStreak3Keseimbangan}%` : ''}, Streak 5: +
                        {bonusStreak5Jarak}m.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={bonusStreakAktif}
                      onChange={(e) => setBonusStreakAktif(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded accent-[#1d3b2e]"
                    />
                  </label>

                  {bonusStreakAktif && kesulitan === 'custom' && (
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#e0d5b8] text-[10px]">
                      <div>
                        <label className="font-semibold block">Streak 3 (m)</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={bonusStreak3Jarak}
                          onChange={(e) =>
                            setBonusStreak3Jarak(Math.min(50, Math.max(0, Number(e.target.value) || 0)))
                          }
                          className="w-full px-1.5 py-1 rounded bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="font-semibold block">Streak 5 (m)</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={bonusStreak5Jarak}
                          onChange={(e) =>
                            setBonusStreak5Jarak(Math.min(50, Math.max(0, Number(e.target.value) || 0)))
                          }
                          className="w-full px-1.5 py-1 rounded bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="font-semibold block">Bal S3 (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={bonusStreak3Keseimbangan}
                          onChange={(e) =>
                            setBonusStreak3Keseimbangan(
                              Math.min(50, Math.max(0, Number(e.target.value) || 0))
                            )
                          }
                          className="w-full px-1.5 py-1 rounded bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Rintangan & Power-Up */}
              <div className="p-4 bg-white border border-[#e0d5b8] rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-600" /> Rintangan &amp; Power-Up
                      Opsional
                    </span>
                    <p className="text-[11px] text-[#6b7d6c]">
                      Diundi otomatis oleh server saat pemain menjawab benar.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={rintanganAktif}
                    onChange={(e) => setRintanganAktif(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#1d3b2e] cursor-pointer"
                  />
                </div>

                {rintanganAktif && (
                  <div className="space-y-3 pt-2 border-t border-[#e0d5b8]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {daftarRintanganDinamis.map((item) => {
                        const terblokirKeseimbangan =
                          item.perluKeseimbangan && !keseimbanganAktif;
                        const aktif =
                          !terblokirKeseimbangan && rintanganDipilih.includes(item.id);
                        const IconComponent = item.Icon;
                        return (
                          <div
                            key={item.id}
                            className={`p-2.5 rounded-xl border text-xs transition-all space-y-1.5 ${
                              terblokirKeseimbangan
                                ? 'bg-slate-50 border-slate-200 opacity-55'
                                : aktif
                                ? 'bg-[#fcf8ed] border-[#1d3b2e] shadow-xs'
                                : 'bg-[#f4ecd9]/50 border-[#e0d5b8] opacity-75'
                            }`}
                          >
                            <button
                              type="button"
                              disabled={terblokirKeseimbangan}
                              onClick={() => toggleRintangan(item.id)}
                              className="w-full flex items-start gap-2 text-left cursor-pointer disabled:cursor-not-allowed"
                            >
                              <IconComponent className="w-4 h-4 shrink-0 mt-0.5 text-[#c8362f]" />
                              <div className="min-w-0 flex-1">
                                <div className="font-bold flex items-center justify-between gap-1">
                                  <span>{item.nama}</span>
                                  <span className="text-[10px] font-black">
                                    {terblokirKeseimbangan
                                      ? 'PERLU KESEIMBANGAN'
                                      : aktif
                                      ? 'AKTIF'
                                      : 'NONAKTIF'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-[#6b7d6c] leading-snug">
                                  {item.ringkas}
                                </p>
                              </div>
                            </button>

                            <div className="flex items-center justify-between gap-2 text-[10px] border-t border-[#e0d5b8]/60 pt-1">
                              <span className="font-semibold text-[#6b7d6c]">Bobot peluang:</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                disabled={terblokirKeseimbangan || !aktif}
                                value={probabilitasRintangan[item.id]}
                                onChange={(e) =>
                                  setProbabilitasRintangan((prev) => ({
                                    ...prev,
                                    [item.id]: Math.min(
                                      100,
                                      Math.max(0, Number(e.target.value) || 0)
                                    ),
                                  }))
                                }
                                className="w-16 px-1.5 py-0.5 rounded border border-[#d6c9a9] text-center font-mono font-bold bg-white disabled:opacity-50"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <label className="font-bold block mb-1">Peluang Muncul (%)</label>
                        <input
                          type="number"
                          min={5}
                          max={50}
                          value={peluangRintanganPersen}
                          onChange={(e) =>
                            setPeluangRintanganPersen(
                              Math.min(50, Math.max(5, Number(e.target.value) || 5))
                            )
                          }
                          className="w-full px-2 py-1 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="font-bold block mb-1">Kulit Pisang (-%)</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          disabled={!keseimbanganAktif}
                          value={penurunanKulitPisang}
                          onChange={(e) =>
                            setPenurunanKulitPisang(
                              Math.min(50, Math.max(1, Number(e.target.value) || 1))
                            )
                          }
                          className="w-full px-2 py-1 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="font-bold block mb-1">Lompat Kuat (+m)</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={bonusLompatanKuat}
                          onChange={(e) =>
                            setBonusLompatanKuat(
                              Math.min(30, Math.max(1, Number(e.target.value) || 1))
                            )
                          }
                          className="w-full px-2 py-1 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="font-bold block mb-1">Lumpur (-m)</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={penaltiJalanBerlumpur}
                          onChange={(e) =>
                            setPenaltiJalanBerlumpur(
                              Math.min(30, Math.max(1, Number(e.target.value) || 1))
                            )
                          }
                          className="w-full px-2 py-1 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] bg-[#fcf8ed] border border-[#e0d5b8] rounded-xl px-3 py-2">
                      <span>
                        Total bobot aktif:{' '}
                        <strong className="font-mono">{totalBobotDipilih}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={bagiRataBobot}
                        className="px-2.5 py-1 rounded-lg bg-[#f4ecd8] hover:bg-[#e5dabf] font-bold text-[#1d3b2e] cursor-pointer"
                      >
                        Bagi Rata 100%
                      </button>
                    </div>

                    {!rintanganValid && (
                      <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-[11px] font-bold text-red-700">
                        {rintanganTersediaDipilih.length === 0
                          ? 'Pilih minimal 1 rintangan yang aktif.'
                          : 'Total bobot peluang untuk rintangan yang dipilih harus lebih dari 0.'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tombol Mulai */}
              <div className="pt-2">
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
                    : 'Mulai Balap Karung Solo (1 vs 1)'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
