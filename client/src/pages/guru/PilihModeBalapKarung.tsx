import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import {
  extractApiErrorMessage,
  GameConfigCardHeader,
  GameConfigFooter,
  GameConfigPageShell,
  GameConfigSection,
  GameModeCard,
  resolveGuruReturnUrl,
} from '../../components';
import {
  Users,
  Monitor,
  AlertTriangle,
  Play,
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
  Clock,
  ChevronDown,
  ChevronUp,
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

interface TemplateDetail {
  id: string;
  judul: string;
  game: string;
  mode: string;
  resmi?: boolean;
  questions?: Array<{ id: string }>;
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
  const queryKembali = resolveGuruReturnUrl(searchParams.get('kembali'));

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetail | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const hasSyncedInitialMode = useRef(false);

  // Mode utama (Multiplayer Tim vs Solo 1 vs 1)
  const [playMode, setPlayMode] = useState<PlayModeBalapKarung>('MULTIPLAYER');
  const hasCustomTimer = useRef(false);

  // Target jarak
  const [presetJarak, setPresetJarak] = useState<PresetJarakBalap>('normal');
  const [targetCustomInput, setTargetCustomInput] = useState<string>('120');
  const [waktuPerSoalDetik, setWaktuPerSoalDetik] = useState<number>(10);

  // Solo 1 vs 1 Settings
  const [tipeLawanSolo, setTipeLawanSolo] = useState<TipeLawanSoloBalap>('bot');
  const [kesulitanBot, setKesulitanBot] = useState<KesulitanBotBalap>('sedang');
  const [namaPemain1, setNamaPemain1] = useState<string>('Pemain 1');
  const [namaPemain2, setNamaPemain2] = useState<string>('Lawan Bot');

  // Multiplayer Tim Settings
  const [jumlahTim, setJumlahTim] = useState<3 | 4>(3);
  const [maxPeserta, setMaxPeserta] = useState<number>(36);
  const [allowLateJoin, setAllowLateJoin] = useState<boolean>(true);
  const [showAdvancedRules, setShowAdvancedRules] = useState<boolean>(false);

  // Kesulitan, Keseimbangan & Streak (default bersih sesuai mode festival: +10m / -3m)
  const [kesulitan, setKesulitan] = useState<KesulitanBalap>('normal');
  const [lompatBenar, setLompatBenar] = useState<number>(10);
  const [turunSalah, setTurunSalah] = useState<number>(3);
  const [keseimbanganAktif, setKeseimbanganAktif] = useState<boolean>(false);
  const [keseimbanganBenar, setKeseimbanganBenar] = useState<number>(5);
  const [keseimbanganSalah, setKeseimbanganSalah] = useState<number>(20);
  const [penurunanJatuhJarak, setPenurunanJatuhJarak] = useState<number>(5);
  const [pemulihanJatuhKeseimbangan, setPemulihanJatuhKeseimbangan] = useState<number>(50);

  const [bonusStreakAktif, setBonusStreakAktif] = useState<boolean>(false);
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
    hasSyncedInitialMode.current = false;

    async function loadTemplate() {
      if (!queryTemplateId) {
        setSelectedTemplate(null);
        setErrorPesan(
          'Template kuis belum dipilih. Silakan pilih kuis Balap Karung dari Dashboard atau Papan Tulis terlebih dahulu.'
        );
        setLoadingTemplate(false);
        return;
      }

      try {
        setLoadingTemplate(true);
        setErrorPesan(null);
        const res = await apiRequest<{ template: TemplateDetail }>(
          `/template/${encodeURIComponent(queryTemplateId)}`
        );
        if (!active) return;

        const tmpl = res.template;
        if (tmpl.game && tmpl.game !== 'balap_karung') {
          setSelectedTemplate(null);
          setErrorPesan(
            `Template "${tmpl.judul}" bukan diperuntukkan untuk Balap Karung Challenge.`
          );
          return;
        }

        setSelectedTemplate(tmpl);
        if (!hasSyncedInitialMode.current) {
          hasSyncedInitialMode.current = true;
          if (tmpl.mode === 'solo') {
            setPlayMode('SOLO');
            if (!hasCustomTimer.current) setWaktuPerSoalDetik(15);
          } else if (tmpl.mode === 'multi') {
            setPlayMode('MULTIPLAYER');
            if (!hasCustomTimer.current) setWaktuPerSoalDetik(10);
          }
        }
      } catch (err: unknown) {
        if (active) {
          setSelectedTemplate(null);
          setErrorPesan(extractApiErrorMessage(err, 'Gagal memuat detail template kuis.'));
        }
      } finally {
        if (active) setLoadingTemplate(false);
      }
    }

    loadTemplate();
    return () => {
      active = false;
    };
  }, [queryTemplateId]);

  const jumlahSoal =
    selectedTemplate?.questions?.length ?? selectedTemplate?._count?.questions ?? 0;

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

  const handleUbahPlayMode = (nextMode: PlayModeBalapKarung) => {
    setPlayMode(nextMode);
    if (!hasCustomTimer.current) {
      setWaktuPerSoalDetik(nextMode === 'SOLO' ? 15 : 10);
    }
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

      const timerClamped = Math.min(120, Math.max(5, Math.round(waktuPerSoalDetik) || 15));
      const balapKarungConfig = {
        presetJarak,
        targetJarak: targetJarakFinal,
        jumlahTim,
        waktuPerSoalDetik: timerClamped,
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
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal membuat sesi Balap Karung Challenge.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GameConfigPageShell
      loading={loadingTemplate}
      loadingText="Menyiapkan Pengaturan Balap Karung..."
      title="Balap Karung Challenge"
      subtitle="Atur mode permainan, target lintasan, keseimbangan, dan rintangan sebelum memulai lomba."
      errorMessage={errorPesan}
      templateTitle={selectedTemplate?.judul}
      isOfficialTemplate={Boolean(selectedTemplate?.resmi)}
      questionCount={jumlahSoal}
      missingTemplateMessage="Tidak dapat memuat pengaturan karena materi kuis Balap Karung belum tersedia."
    >
      <form onSubmit={handleMulaiPermainan} className="space-y-6">
        {/* 1. Pilih Mode Permainan */}
        <GameConfigSection
          title="1. Pilih Mode Permainan"
          description="Multiplayer membagi siswa ke 3 atau 4 tim di HP masing-masing; Solo Mode menyajikan duel 1 vs 1 di satu layar proyektor."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <GameModeCard
              selected={playMode === 'MULTIPLAYER'}
              variant="green"
              onClick={() => handleUbahPlayMode('MULTIPLAYER')}
              badgeIcon={<Users className="w-3.5 h-3.5" />}
              badgeLabel="Multiplayer Tim"
              title="Siswa Bermain di HP • Adu Cepat 3–4 Tim"
              description="Guru membuka PIN & QR Code lalu memilih 3 atau 4 tim. Peserta otomatis dibagi merata dan setiap jawaban benar memajukan tim menuju garis finis."
              features={[
                { icon: <QrCode className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'PIN & QR Gabung' },
                { icon: <Users className="w-3.5 h-3.5 text-[#f2c230]" />, label: '3 atau 4 Tim Seimbang' },
                { icon: <Trophy className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'Podium Tim Real-Time' },
                { icon: <Flag className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'Heatmap Analisis Soal' },
              ]}
            />

            <GameModeCard
              selected={playMode === 'SOLO'}
              variant="red"
              onClick={() => handleUbahPlayMode('SOLO')}
              badgeIcon={<Monitor className="w-3.5 h-3.5" />}
              badgeLabel="Solo Mode (1 vs 1)"
              title="Satu Perangkat Guru • 1 vs 1 dengan Lawan"
              description="Tanpa HP siswa, PIN, atau QR Code. Di layar proyektor hanya tampil tepat 2 avatar balap karung (1 vs 1) melawan Bot AI atau pemain ke-2 lokal."
              features={[
                { icon: <Monitor className="w-3.5 h-3.5" />, label: 'Tanpa PIN / QR Code' },
                { icon: <Swords className="w-3.5 h-3.5" />, label: 'Tepat 2 Avatar (1 vs 1)' },
                { icon: <Bot className="w-3.5 h-3.5" />, label: 'Lawan Bot / Duel Lokal' },
                { icon: <Play className="w-3.5 h-3.5" />, label: 'Kontrol Jeda & Ulang' },
              ]}
            />
          </div>
        </GameConfigSection>

        {/* 2. Konfigurasi Parameter Lomba */}
        <GameConfigSection
          title="2. Pengaturan Aturan & Lintasan"
          description="Sesuaikan target jarak, aturan lawan atau kapasitas peserta, tingkat kesulitan, keseimbangan, dan rintangan."
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Kolom Kiri: Target Jarak & Pengaturan Peserta/Lawan */}
            <div className="lg:col-span-5 space-y-5">
              {/* Target Jarak Finis */}
              <div className="portal-card p-5 space-y-4">
                <GameConfigCardHeader
                  icon={<Flag className="w-4 h-4 text-[#c8362f]" />}
                  title="Target Jarak Finis"
                  tagLabel={isValidTarget ? `${targetJarakFinal} m` : 'Invalid'}
                  tagColor="yellow"
                />

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2">
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
                            className={`py-2.5 px-2 rounded-xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                              active
                                ? 'bg-[#c8362f] text-[#f4ecd8] border-[#c8362f] shadow-xs'
                                : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
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
                          className="portal-input max-w-[120px] font-mono font-bold text-center"
                        />
                      </div>
                    )}

                    <div className="pt-3 border-t border-dashed border-[#e0d5b8] text-xs text-[#6b7d6c] flex items-center justify-between">
                      <span>Garis finis ditetapkan pada:</span>
                      <strong className="text-[#1d3b2e] font-mono text-sm">
                        {isValidTarget ? `${targetJarakFinal} meter` : 'Tidak valid (10–1000m)'}
                      </strong>
                    </div>
                  </div>

                  {/* Pengaturan Khusus Solo 1 vs 1 ATAU Multiplayer */}
                  {playMode === 'SOLO' ? (
                    <div className="portal-card p-5 space-y-4">
                      <GameConfigCardHeader
                        icon={<Swords className="w-4 h-4 text-[#c8362f]" />}
                        title="Pengaturan Duel 1 vs 1"
                        tagLabel="Tepat 2 Avatar"
                        tagColor="red"
                      />

                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleUbahTipeLawanSolo('bot')}
                          className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                            tipeLawanSolo === 'bot'
                              ? 'bg-[#c8362f] text-[#f4ecd8] border-[#c8362f]'
                              : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#c8362f]/50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-extrabold text-xs">
                            <Bot className="w-4 h-4" /> Lawan Bot AI
                          </div>
                          <p
                            className={`text-[11px] mt-1 leading-snug ${
                              tipeLawanSolo === 'bot' ? 'text-[#f4ecd8]/85' : 'text-[#6b7d6c]'
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
                              ? 'bg-[#c8362f] text-[#f4ecd8] border-[#c8362f]'
                              : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#c8362f]/50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-extrabold text-xs">
                            <Users className="w-4 h-4" /> Duel Lokal (2 Orang)
                          </div>
                          <p
                            className={`text-[11px] mt-1 leading-snug ${
                              tipeLawanSolo === 'lokal' ? 'text-[#f4ecd8]/85' : 'text-[#6b7d6c]'
                            }`}
                          >
                            2 peserta adu cepat kiri vs kanan pada 1 layar bersama.
                          </p>
                        </button>
                      </div>

                      {tipeLawanSolo === 'bot' && (
                        <div>
                          <label className="text-[11px] font-bold text-[#6b7d6c] uppercase tracking-wider block mb-1.5">
                            Kecepatan &amp; Akurasi Lawan Bot
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {(
                              [
                                { key: 'santai', label: 'Bot Mudah', desc: '50% benar' },
                                { key: 'sedang', label: 'Bot Sedang', desc: '65% benar' },
                                { key: 'cepat', label: 'Bot Sulit', desc: '80% benar' },
                              ] as const
                            ).map((b) => (
                              <button
                                key={b.key}
                                type="button"
                                onClick={() => setKesulitanBot(b.key)}
                                className={`py-2 px-2 rounded-xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                                  kesulitanBot === b.key
                                    ? 'bg-[#1d3b2e] text-[#f4ecd8] border-[#1d3b2e]'
                                    : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8]'
                                }`}
                              >
                                <div>{b.label}</div>
                                <div className="text-[10px] font-normal opacity-80">{b.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                        <div>
                          <label className="font-bold text-[#c8362f] block mb-1">
                            Nama Avatar 1 (Kiri)
                          </label>
                          <input
                            type="text"
                            maxLength={24}
                            value={namaPemain1}
                            onChange={(e) => setNamaPemain1(e.target.value)}
                            className="portal-input font-bold"
                            placeholder="Pemain 1"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-[#1e40af] block mb-1">
                            {tipeLawanSolo === 'bot'
                              ? 'Nama Lawan (Bot)'
                              : 'Nama Avatar 2 (Kanan)'}
                          </label>
                          <input
                            type="text"
                            maxLength={24}
                            value={namaPemain2}
                            onChange={(e) => setNamaPemain2(e.target.value)}
                            className="portal-input font-bold"
                            placeholder={tipeLawanSolo === 'bot' ? 'Lawan Bot' : 'Pemain 2'}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="portal-card p-5 space-y-4">
                      <GameConfigCardHeader
                        icon={<UserCheck className="w-4 h-4 text-[#1d3b2e]" />}
                        title="Pengaturan Tim & Peserta"
                        tagLabel={`${jumlahTim} Tim Aktif`}
                        tagColor="green"
                      />

                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-[#6b7d6c] block mb-1.5">
                          Jumlah Tim Lomba (Bisa Diubah Lagi di Lobi)
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          {([3, 4] as const).map((n) => {
                            const active = jumlahTim === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setJumlahTim(n)}
                                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                                  active
                                    ? 'bg-[#1d3b2e] text-[#f4ecd8] border-[#1d3b2e] shadow-xs'
                                    : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                                }`}
                              >
                                <div className="font-extrabold text-xs">{n} Tim Seimbang</div>
                                <div
                                  className={`text-[10px] mt-0.5 ${
                                    active ? 'text-[#cfd9c3]' : 'text-[#6b7d6c]'
                                  }`}
                                >
                                  {n === 3
                                    ? 'Merah · Biru · Hijau'
                                    : 'Merah · Biru · Hijau · Kuning'}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-[#6b7d6c] block mb-1.5">
                          Maksimal Peserta (1–36 siswa / 1 kelas)
                        </label>
                        <select
                          value={maxPeserta}
                          onChange={(e) => setMaxPeserta(Number(e.target.value))}
                          className="portal-select font-bold"
                        >
                          <option value={12}>Maksimal 12 Siswa</option>
                          <option value={24}>Maksimal 24 Siswa</option>
                          <option value={30}>Maksimal 30 Siswa</option>
                          <option value={36}>Maksimal 36 Siswa</option>
                        </select>
                      </div>

                      <label className="flex items-center justify-between gap-3 pt-3 border-t border-dashed border-[#e0d5b8] cursor-pointer">
                        <div>
                          <div className="text-xs font-extrabold text-[#1d3b2e]">
                            Izinkan Gabung Susulan
                          </div>
                          <div className="text-[11px] text-[#6b7d6c]">
                            Siswa yang terlambat tetap otomatis masuk tim paling kosong
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

                {/* Kolom Kanan: Timer Soal, Aturan Lomba & Opsional Lanjutan */}
                <div className="lg:col-span-7 portal-card p-5 sm:p-6 space-y-5">
                  <GameConfigCardHeader
                    icon={<Sliders className="w-4 h-4 text-[#c8362f]" />}
                    title="Waktu Soal & Aturan Balap"
                    tagLabel={`${waktuPerSoalDetik} detik / soal`}
                    tagColor="green"
                  />

                  {/* Timer Per Soal */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#1d3b2e]">
                        <Clock className="w-4 h-4 text-[#c8362f]" /> Batas Waktu per Soal
                      </span>
                      <span className="text-[11px] font-bold text-[#6b7d6c]">
                        {playMode === 'MULTIPLAYER'
                          ? 'Default tim: 10 detik (tersandung jika habis)'
                          : 'Default solo: 15 detik (-3m jika habis)'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {[10, 15, 20, 30].map((detik) => {
                        const active = waktuPerSoalDetik === detik;
                        return (
                          <button
                            key={detik}
                            type="button"
                            onClick={() => {
                              hasCustomTimer.current = true;
                              setWaktuPerSoalDetik(detik);
                            }}
                            className={`px-3 py-2 rounded-xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                              active
                                ? 'bg-[#1d3b2e] text-[#f4ecd8] border-[#1d3b2e]'
                                : 'bg-[#fcf8ed] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                            }`}
                          >
                            {detik} detik
                          </button>
                        );
                      })}
                      <div className="flex items-center gap-1.5 ml-auto text-xs">
                        <span className="text-[11px] font-bold text-[#6b7d6c]">Kustom:</span>
                        <input
                          type="number"
                          min={5}
                          max={120}
                          value={waktuPerSoalDetik}
                          onChange={(e) => {
                            hasCustomTimer.current = true;
                            setWaktuPerSoalDetik(
                              Math.min(120, Math.max(5, Number(e.target.value) || 5))
                            );
                          }}
                          className="w-16 px-2 py-1.5 rounded-xl bg-white border-2 border-[#e0d5b8] text-center font-mono font-bold text-[#1d3b2e]"
                        />
                        <span className="text-[11px] font-bold text-[#6b7d6c]">dtk</span>
                      </div>
                    </div>
                  </div>

                  {/* Ringkasan Mekanika */}
                  <div className="border-l-4 border-[#d7caa7] pl-3.5 py-0.5 text-xs text-[#1d3b2e] leading-relaxed space-y-1">
                    {playMode === 'MULTIPLAYER' ? (
                      <p>
                        <strong>Mekanika Multiplayer Tim:</strong> Siswa dibagi merata ke{' '}
                        <strong>{jumlahTim} tim</strong>. Jawaban benar memajukan tim sebesar{' '}
                        <strong className="font-mono">+{lompatBenar}m ÷ anggota tim</strong>; salah atau
                        waktu habis{' '}
                        {turunSalah > 0 ? (
                          <>
                            memundurkan tim <strong className="font-mono">-{turunSalah}m ÷ anggota tim</strong>
                          </>
                        ) : (
                          'memicu tersandung tanpa mundur'
                        )}{' '}
                        agar ukuran tim yang berbeda tetap adil.
                        {(keseimbanganAktif || bonusStreakAktif || rintanganAktif) && (
                          <>
                            {' '}
                            Opsi aktif:{' '}
                            <strong>
                              {[
                                keseimbanganAktif ? 'Keseimbangan' : '',
                                bonusStreakAktif ? 'Bonus Streak' : '',
                                rintanganAktif ? 'Rintangan' : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </strong>
                            .
                          </>
                        )}
                      </p>
                    ) : (
                      <p>
                        <strong>Mekanika Solo 1 vs 1:</strong> Setiap jawaban benar melompat{' '}
                        <strong className="font-mono">+{lompatBenar}m</strong>; salah atau
                        waktu habis{' '}
                        {turunSalah > 0 ? (
                          <>
                            mundur <strong className="font-mono">-{turunSalah}m</strong>
                          </>
                        ) : (
                          'tidak mengurangi jarak'
                        )}
                        . Soal diacak tanpa pengulangan hingga habis lalu diacak ulang.
                      </p>
                    )}
                    {jumlahSoal > 0 && isValidTarget && (
                      <p className="text-[11px] text-[#6b7d6c] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>
                          Bank <strong>{jumlahSoal} soal</strong> · Butuh{' '}
                          <strong>{Math.ceil(targetJarakFinal / Math.max(1, lompatBenar))} benar</strong>{' '}
                          untuk mencapai <strong>{targetJarakFinal}m</strong> (tidak otomatis dibagi jumlah soal).
                        </span>
                        {Math.max(1, Math.round(targetJarakFinal / jumlahSoal)) !== lompatBenar && (
                          <button
                            type="button"
                            onClick={() => {
                              setKesulitan('custom');
                              setLompatBenar(
                                Math.min(100, Math.max(1, Math.round(targetJarakFinal / jumlahSoal)))
                              );
                            }}
                            className="font-extrabold text-[#c8362f] underline cursor-pointer"
                          >
                            Sesuaikan langkah ({jumlahSoal} soal → +
                            {Math.min(100, Math.max(1, Math.round(targetJarakFinal / jumlahSoal)))}m)
                          </button>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Preset Kesulitan (Langkah Solo & Tim) */}
                  <div className="pt-4 border-t border-dashed border-[#e0d5b8]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-extrabold text-[#1d3b2e]">
                        {playMode === 'MULTIPLAYER'
                          ? 'Skala Langkah & Opsi Tambahan'
                          : 'Kecepatan Langkah Lompatan'}
                      </span>
                      <span className="text-[11px] font-bold text-[#6b7d6c]">
                        {kesulitan === 'custom' ? 'Kustom' : PRESET_KESULITAN[kesulitan].label}
                      </span>
                    </div>
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
                              ? 'bg-[#1d3b2e] text-[#f4ecd8] border-[#1d3b2e] shadow-xs'
                              : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                          }`}
                        >
                          <div className="text-xs font-extrabold">{info.label}</div>
                          <div
                            className={`text-[10px] mt-0.5 leading-tight ${
                              active ? 'text-[#cfd9c3]' : 'text-[#6b7d6c]'
                            }`}
                          >
                            {info.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {kesulitan === 'custom' && (
                    <div className="pt-3 mt-3 border-t border-dashed border-[#e0d5b8] grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="font-bold text-[11px] block mb-1">
                          Lompat Benar (+m)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={lompatBenar}
                          onChange={(e) =>
                            setLompatBenar(
                              Math.min(100, Math.max(1, Number(e.target.value) || 1))
                            )
                          }
                          className="portal-input text-center font-mono font-bold py-1.5"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-[11px] block mb-1">
                          Turun Salah (-m)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={turunSalah}
                          onChange={(e) =>
                            setTurunSalah(
                              Math.min(100, Math.max(0, Number(e.target.value) || 0))
                            )
                          }
                          className="portal-input text-center font-mono font-bold py-1.5"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-[11px] block mb-1">
                          Jatuh Turun (-m)
                        </label>
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
                          className="portal-input text-center font-mono font-bold py-1.5"
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
                          className="portal-input text-center font-mono font-bold py-1.5"
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
                          className="portal-input text-center font-mono font-bold py-1.5"
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
                          className="portal-input text-center font-mono font-bold py-1.5"
                        />
                      </div>
                    </div>
                  )}
                  </div>

                  {/* Pengaturan Lanjutan (Opsional: Keseimbangan, Streak & Rintangan) */}
                  <div className="pt-3 border-t border-dashed border-[#e0d5b8]">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedRules((prev) => !prev)}
                      className="w-full py-1 text-xs font-extrabold text-[#1d3b2e] hover:text-[#c8362f] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Sliders className="w-3.5 h-3.5 text-[#c8362f]" />
                        Pengaturan Lanjutan (Keseimbangan, Bonus Streak &amp; Rintangan)
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-[#6b7d6c]">
                        {keseimbanganAktif || bonusStreakAktif || rintanganAktif
                          ? 'Aktif Sebagian'
                          : 'Default Bersih'}
                        {showAdvancedRules ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </span>
                    </button>
                  </div>

                  {showAdvancedRules && (
                    <div className="space-y-4">
                  {/* Keseimbangan & Bonus Streak */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <label className="flex items-start justify-between gap-2.5 cursor-pointer py-1">
                      <div>
                        <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#1d3b2e]">
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

                    <div className="space-y-2 py-1">
                      <label className="flex items-start justify-between gap-2.5 cursor-pointer">
                        <div>
                          <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#1d3b2e]">
                            <Flame className="w-3.5 h-3.5 text-orange-500" /> Bonus Streak
                          </span>
                          <p className="text-[11px] text-[#6b7d6c] mt-0.5 leading-snug">
                            Streak 3: +{bonusStreak3Jarak}m
                            {keseimbanganAktif ? ` & +${bonusStreak3Keseimbangan}%` : ''}, Streak 5:
                            +{bonusStreak5Jarak}m.
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
                        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-dashed border-[#e0d5b8] text-[10px]">
                          <div>
                            <label className="font-semibold block">Streak 3 (m)</label>
                            <input
                              type="number"
                              min={0}
                              max={50}
                              value={bonusStreak3Jarak}
                              onChange={(e) =>
                                setBonusStreak3Jarak(
                                  Math.min(50, Math.max(0, Number(e.target.value) || 0))
                                )
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
                                setBonusStreak5Jarak(
                                  Math.min(50, Math.max(0, Number(e.target.value) || 0))
                                )
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
                  <div className="pt-3 border-t border-dashed border-[#e0d5b8] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#1d3b2e]">
                          <ShieldAlert className="w-4 h-4 text-[#c8362f]" /> Rintangan &amp; Power-Up
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
                      <div className="space-y-3 pt-3 border-t-2 border-dashed border-[#e0d5b8]">
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

                                <div className="flex items-center justify-between gap-2 text-[10px] border-t border-dashed border-[#e0d5b8] pt-1">
                                  <span className="font-semibold text-[#6b7d6c]">
                                    Bobot peluang:
                                  </span>
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

                        <div className="flex items-center justify-between gap-2 text-[11px] pt-2 border-t border-dashed border-[#e0d5b8]">
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
                    </div>
                  )}

                  {jumlahSoal === 0 && (
                    <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-[#c8362f]">
                      Template kuis ini belum memiliki soal. Tambahkan minimal 1 soal sebelum memulai sesi.
                    </div>
                  )}

                  {/* Tombol Mulai */}
                  <GameConfigFooter
                    canSubmit={canSubmit}
                    submitting={submitting}
                    isSolo={playMode === 'SOLO'}
                    submitLabel={
                      playMode === 'MULTIPLAYER'
                        ? 'Buat Sesi Multiplayer & Buka Lobi PIN'
                        : 'Mulai Balap Karung Solo (1 vs 1)'
                    }
                  />
                </div>
              </div>
        </GameConfigSection>
      </form>
    </GameConfigPageShell>
  );
}
