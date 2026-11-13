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
  PlayModeKerupuk,
  ProbabilitasConfig,
  KesulitanKerupuk,
  TargetKerupukPreset,
  TARGET_PRESETS,
  PRESET_DATA,
  hitungPoinPengurangan,
} from './ModalKonfigurasiKerupuk';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Keyboard,
  Monitor,
  QrCode,
  Sliders,
  Swords,
  Target,
  Trophy,
  UserCheck,
  Users,
  Volume2,
  Minus,
  Plus,
} from 'lucide-react';

interface TemplateDetail {
  id: string;
  judul: string;
  game: string;
  mode: string;
  resmi?: boolean;
  questions?: Array<{ id: string }>;
  _count?: { questions: number };
}

const DESKRIPSI_RINGKAS_PRESET: Record<'mudah' | 'normal' | 'sulit', string> = {
  mudah: 'Besar 35% · Zonk 3%',
  normal: 'Besar 15% · Zonk 5%',
  sulit: 'Mini 35% · Zonk 15%',
};

export default function PilihModeKerupuk() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTemplateId = searchParams.get('templateId') || '';
  const queryKembali = resolveGuruReturnUrl(searchParams.get('kembali'));
  const queryModeParam = searchParams.get('mode');

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetail | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const hasSyncedInitialMode = useRef(false);

  const [playMode, setPlayMode] = useState<PlayModeKerupuk>(() =>
    queryModeParam === 'solo'
      ? 'SOLO'
      : queryModeParam === 'multi'
      ? 'MULTIPLAYER'
      : 'MULTIPLAYER'
  );

  // Aturan Inti Kerupuk
  const [targetPreset, setTargetPreset] = useState<TargetKerupukPreset>('100');
  const [customTargetInput, setCustomTargetInput] = useState<string>('120');
  const [kesulitan, setKesulitan] = useState<KesulitanKerupuk>('normal');
  const [probabilitas, setProbabilitas] = useState<ProbabilitasConfig>({
    ...PRESET_DATA.normal.probabilitas,
  });
  const [showAdvancedRules, setShowAdvancedRules] = useState<boolean>(false);

  // Pengaturan Khusus Multiplayer
  const [maxPeserta, setMaxPeserta] = useState<number>(40);
  const [allowLateJoin] = useState<boolean>(true);
  const [jumlahTim, setJumlahTim] = useState<3 | 4>(3);

  // Pengaturan Khusus Solo 1 vs 1
  const [tipeLawanSolo, setTipeLawanSolo] = useState<'bot' | 'lokal'>('bot');
  const [kesulitanBot, setKesulitanBot] = useState<'mudah' | 'sedang' | 'sulit'>('sedang');
  const [namaPemain1, setNamaPemain1] = useState<string>('Pemain 1');
  const [namaPemain2, setNamaPemain2] = useState<string>('Lawan Bot');

  const handleUbahLawanSolo = (tipe: 'bot' | 'lokal') => {
    setTipeLawanSolo(tipe);
    if (tipe === 'bot') {
      if (!namaPemain2 || namaPemain2 === 'Pemain 2') setNamaPemain2('Lawan Bot');
    } else {
      if (!namaPemain2 || namaPemain2 === 'Lawan Bot') setNamaPemain2('Pemain 2');
    }
  };

  useEffect(() => {
    let active = true;
    hasSyncedInitialMode.current = false;

    async function loadTemplate() {
      if (!queryTemplateId) {
        setSelectedTemplate(null);
        setErrorPesan(
          'Template kuis belum dipilih. Silakan pilih kuis Makan Kerupuk dari Dashboard atau Papan Tulis terlebih dahulu.'
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
        if (tmpl.game && tmpl.game !== 'makan_kerupuk') {
          setSelectedTemplate(null);
          setErrorPesan(
            `Template "${tmpl.judul}" bukan diperuntukkan untuk Makan Kerupuk Challenge.`
          );
          return;
        }

        setSelectedTemplate(tmpl);
        if (!hasSyncedInitialMode.current) {
          hasSyncedInitialMode.current = true;
          if (queryModeParam === 'solo') {
            setPlayMode('SOLO');
          } else if (queryModeParam === 'multi') {
            setPlayMode('MULTIPLAYER');
          } else if (tmpl.mode === 'solo') {
            setPlayMode('SOLO');
          } else {
            setPlayMode('MULTIPLAYER');
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
  }, [queryTemplateId, queryModeParam]);

  const jumlahSoal =
    selectedTemplate?.questions?.length ?? selectedTemplate?._count?.questions ?? 0;

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

  const handlePilihKesulitan = (key: KesulitanKerupuk) => {
    setKesulitan(key);
    if (key === 'custom') {
      setShowAdvancedRules(true);
    } else {
      setProbabilitas({ ...PRESET_DATA[key].probabilitas });
    }
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
        tipeLawanSolo,
        kesulitanBot,
        namaPemain1: namaPemain1.trim() || 'Pemain 1',
        namaPemain2:
          namaPemain2.trim() || (tipeLawanSolo === 'bot' ? 'Lawan Bot' : 'Pemain 2'),
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
                kerupukConfig: baseKerupuk,
              }
            : {
                kerupukMultiConfig: {
                  ...baseKerupuk,
                  maxPeserta,
                  allowLateJoin,
                  jumlahTim,
                },
              }),
        }),
      });

      const backTarget = `/guru/makan-kerupuk?templateId=${encodeURIComponent(
        selectedTemplate.id
      )}&kembali=${encodeURIComponent(queryKembali)}`;
      navigate(`/guru/sesi/${res.session.id}?kembali=${encodeURIComponent(backTarget)}`);
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal membuat sesi Makan Kerupuk Challenge.'));
    } finally {
      setSubmitting(false);
    }
  };

  const labelKesulitanAktif =
    kesulitan === 'custom' ? 'Kustom' : PRESET_DATA[kesulitan].label;

  return (
    <GameConfigPageShell
      loading={loadingTemplate}
      loadingText="Menyiapkan Pengaturan Makan Kerupuk..."
      title="Makan Kerupuk Challenge"
      subtitle="Atur mode permainan, target poin kerupuk, peserta, dan peluang gigitan sebelum memulai lomba."
      errorMessage={errorPesan}
      templateTitle={selectedTemplate?.judul}
      isOfficialTemplate={Boolean(selectedTemplate?.resmi)}
      questionCount={jumlahSoal}
      missingTemplateMessage="Tidak dapat memuat pengaturan karena materi kuis Makan Kerupuk belum tersedia."
    >
      <form onSubmit={handleMulaiPermainan} className="space-y-6">
        {/* 1. Pengaturan Umum */}
        <GameConfigSection
          title="1. Pengaturan Umum"
          description="Pilih mode permainan (Multiplayer atau Solo), tentukan alokasi tim & kapasitas peserta untuk mode multi, atau tentukan lawan tanding (Bot AI vs Teman Asli) untuk mode solo."
        >
          <div className="space-y-5">
            {/* 1A. Pilihan Mode Permainan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <GameModeCard
                selected={playMode === 'MULTIPLAYER'}
                variant="green"
                onClick={() => setPlayMode('MULTIPLAYER')}
                badgeIcon={<Users className="w-3.5 h-3.5" />}
                badgeLabel="Multiplayer Siswa"
                title="Siswa Bermain di HP • Lomba Kerupuk Individu"
                description="Guru membuka PIN & QR Code untuk ruang lomba siswa. Siswa menjawab kuis dari perangkat pribadi untuk menggigit kerupuk dan bersaing di leaderboard real-time."
                features={[
                  { icon: <QrCode className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'PIN & QR Gabung' },
                  { icon: <Users className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'Hingga 40 Siswa' },
                  { icon: <Trophy className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'Leaderboard Real-Time' },
                  { icon: <Target className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'Kerupuk Per Individu' },
                ]}
              />

              <GameModeCard
                selected={playMode === 'SOLO'}
                variant="red"
                onClick={() => setPlayMode('SOLO')}
                badgeIcon={<Monitor className="w-3.5 h-3.5" />}
                badgeLabel="Solo Mode (1 vs 1)"
                title="Satu Perangkat Guru • 1 vs 1 di Layar Proyektor"
                description="Tanpa HP siswa, PIN, atau QR Code. Dua kontestan (1 vs 1) adu cepat menghabiskan kerupuk melawan Bot AI otomatis atau teman duel lokal di kelas."
                features={[
                  { icon: <Monitor className="w-3.5 h-3.5" />, label: 'Tanpa PIN / QR Code' },
                  { icon: <Swords className="w-3.5 h-3.5" />, label: 'Tepat 2 Avatar (1 vs 1)' },
                  { icon: <Bot className="w-3.5 h-3.5" />, label: 'Lawan Bot / Duel Lokal' },
                  { icon: <Keyboard className="w-3.5 h-3.5" />, label: 'Mouse / Keyboard / Sentuh' },
                ]}
              />
            </div>

            {/* 1B. Rincian Konfigurasi Mode Terpilih */}
            {playMode === 'MULTIPLAYER' ? (
              <div className="portal-card p-5 space-y-4">
                <GameConfigCardHeader
                  icon={<UserCheck className="w-4 h-4 text-[#1d3b2e]" />}
                  title="Pengaturan Tim & Peserta"
                  tagLabel={`${jumlahTim} Tim • Maks ${maxPeserta} Siswa`}
                  tagColor="green"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  {/* Kolom Kiri: Kapasitas Peserta dengan kontrol gaya volume 1 - 45 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#6b7d6c] flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-[#1d3b2e]" />
                        <span>Maksimal Peserta (1–45 Siswa)</span>
                      </label>
                      <span className="font-extrabold text-xs px-2.5 py-0.5 bg-[#1d3b2e] text-[#f4ecd8] rounded-full font-mono shadow-xs">
                        {maxPeserta} Siswa
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 p-2 bg-[#fffdf6] border-2 border-[#e0d5b8] rounded-2xl shadow-xs">
                      <button
                        type="button"
                        onClick={() => setMaxPeserta((prev) => Math.max(1, prev - 1))}
                        className="w-8 h-8 rounded-xl bg-[#ece4d5] hover:bg-[#dfd5c2] active:scale-95 text-[#1d3b2e] flex items-center justify-center font-black cursor-pointer transition-all border border-[#d4c8b0]"
                        title="Kurangi kapasitas"
                        aria-label="Kurangi kapasitas"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <div className="flex-1 relative flex items-center px-1">
                        <input
                          type="range"
                          min={1}
                          max={45}
                          step={1}
                          value={maxPeserta}
                          onChange={(e) => setMaxPeserta(Number(e.target.value))}
                          className="w-full accent-[#1d3b2e] cursor-pointer h-2 bg-[#ece4d5] rounded-lg appearance-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setMaxPeserta((prev) => Math.min(45, prev + 1))}
                        className="w-8 h-8 rounded-xl bg-[#ece4d5] hover:bg-[#dfd5c2] active:scale-95 text-[#1d3b2e] flex items-center justify-center font-black cursor-pointer transition-all border border-[#d4c8b0]"
                        title="Tambah kapasitas"
                        aria-label="Tambah kapasitas"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Kolom Kanan: Jumlah Tim Lomba */}
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
                </div>
              </div>
            ) : (
              <div className="portal-card p-5 space-y-4">
                <GameConfigCardHeader
                  icon={<Swords className="w-4 h-4 text-[#c8362f]" />}
                  title="Pengaturan Duel 1 vs 1"
                  tagLabel="Tepat 2 Avatar"
                  tagColor="red"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleUbahLawanSolo('bot')}
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
                      1 pemain menjawab soal langsung di proyektor melawan bot otomatis.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUbahLawanSolo('lokal')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      tipeLawanSolo === 'lokal'
                        ? 'bg-[#c8362f] text-[#f4ecd8] border-[#c8362f]'
                        : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#c8362f]/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-xs">
                      <Users className="w-4 h-4" /> Teman Asli / Duel Lokal
                    </div>
                    <p
                      className={`text-[11px] mt-1 leading-snug ${
                        tipeLawanSolo === 'lokal' ? 'text-[#f4ecd8]/85' : 'text-[#6b7d6c]'
                      }`}
                    >
                      2 siswa adu cepat makan kerupuk kiri vs kanan pada 1 layar kelas.
                    </p>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <label className="font-bold text-[#c8362f] block mb-1">
                      Nama Pemain 1 (Kiri)
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
                      {tipeLawanSolo === 'bot' ? 'Nama Lawan (Bot)' : 'Nama Pemain 2 (Kanan)'}
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

                {tipeLawanSolo === 'bot' && (
                  <div className="pt-2 border-t border-dashed border-[#e0d5b8]">
                    <label className="text-xs font-bold text-[#6b7d6c] block mb-1.5">
                      Tingkat Kesulitan Bot AI
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { key: 'mudah', label: 'Mudah' },
                          { key: 'sedang', label: 'Sedang' },
                          { key: 'sulit', label: 'Sulit' },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setKesulitanBot(item.key)}
                          className={`py-2 px-2 rounded-xl border-2 text-xs font-extrabold capitalize transition-all cursor-pointer ${
                            kesulitanBot === item.key
                              ? 'bg-[#1d3b2e] text-[#f4ecd8] border-[#1d3b2e]'
                              : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-dashed border-[#e0d5b8] text-[11px] text-[#6b7d6c]">
                  💡 <strong>Pintasan:</strong> Tekan pilihan di layar atau keyboard{' '}
                  <strong className="font-mono text-[#1d3b2e]">A–E</strong> /{' '}
                  <strong className="font-mono text-[#1d3b2e]">1–5</strong> untuk langsung menggigit kerupuk.
                </div>
              </div>
            )}
          </div>
        </GameConfigSection>

        {/* 2. Pengaturan Khusus Makan Kerupuk */}
        <GameConfigSection
          title="2. Pengaturan Khusus Makan Kerupuk"
          description="Sesuaikan target poin kerupuk untuk dituntaskan, serta distribusi tingkat kesulitan dan probabilitas gigitan."
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Kolom Kiri: Target Poin Kerupuk */}
            <div className="lg:col-span-5 space-y-5">
              {/* Target Poin Kerupuk */}
              <div className="portal-card p-5 space-y-4">
                <GameConfigCardHeader
                  icon={<Target className="w-4 h-4 text-[#c8362f]" />}
                  title="Target Poin Kerupuk"
                  tagLabel={isValidTarget ? `${targetKerupuk} pt` : 'Invalid'}
                  tagColor="yellow"
                />

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                  {TARGET_PRESETS.map((p) => {
                    const active = targetPreset === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setTargetPreset(p.key)}
                        className={`py-2.5 px-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-[#c8362f] text-[#f4ecd8] border-[#c8362f] shadow-xs'
                            : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                        }`}
                      >
                        <div className="text-xs font-extrabold">{p.label}</div>
                        <div
                          className={`text-[10px] mt-0.5 ${
                            active ? 'text-[#f4ecd8]/85' : 'text-[#6b7d6c]'
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
                    className={`py-2.5 px-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      targetPreset === 'custom'
                        ? 'bg-[#c8362f] text-[#f4ecd8] border-[#c8362f] shadow-xs'
                        : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                    }`}
                  >
                    <div className="text-xs font-extrabold">Kustom</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        targetPreset === 'custom' ? 'text-[#f4ecd8]/85' : 'text-[#6b7d6c]'
                      }`}
                    >
                      10–1000 pt
                    </div>
                  </button>
                </div>

                {targetPreset === 'custom' && (
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs font-bold text-[#6b7d6c] shrink-0">
                      Target (10–1000 pt):
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      value={customTargetInput}
                      onChange={(e) => setCustomTargetInput(e.target.value)}
                      className="portal-input max-w-[120px] font-mono font-bold text-center"
                    />
                  </div>
                )}

                <div className="pt-3 border-t border-dashed border-[#e0d5b8] text-xs text-[#6b7d6c] space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Target menghabiskan kerupuk:</span>
                    <strong className="text-[#1d3b2e] font-mono text-sm">
                      {isValidTarget ? `${targetKerupuk} poin` : 'Tidak valid (10–1000)'}
                    </strong>
                  </div>
                  {isValidTarget && (
                    <div className="text-[11px] font-semibold text-[#1d3b2e]/80">
                      Dampak gigitan: Besar -{hitungPoinPengurangan(40, targetKerupuk)} · Sedang -
                      {hitungPoinPengurangan(25, targetKerupuk)} · Kecil -
                      {hitungPoinPengurangan(10, targetKerupuk)} · Mini -
                      {hitungPoinPengurangan(5, targetKerupuk)} pt
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Kesulitan, Peluang Gigitan & Tombol Mulai */}
            <div className="lg:col-span-7 portal-card p-5 sm:p-6 space-y-5">
              <GameConfigCardHeader
                icon={<Sliders className="w-4 h-4 text-[#c8362f]" />}
                title="Kesulitan & Peluang Gigitan"
                tagLabel={`${Math.round(totalPersen * 10) / 10}% Total`}
                tagColor={isValidProb ? 'green' : 'red'}
              />

              {/* Ringkasan Peluang Aktif */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#1d3b2e]">
                    Distribusi Gigitan Saat Ini
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-extrabold ${
                      isValidProb ? 'text-emerald-700' : 'text-[#c8362f]'
                    }`}
                  >
                    {isValidProb ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Tepat 100%
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" /> Wajib 100%
                      </>
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs">
                  {[
                    { key: 'besar' as const, label: 'Besar (-40%)', val: probabilitas.besar, isZonk: false },
                    { key: 'sedang' as const, label: 'Sedang (-25%)', val: probabilitas.sedang, isZonk: false },
                    { key: 'kecil' as const, label: 'Kecil (-10%)', val: probabilitas.kecil, isZonk: false },
                    { key: 'sangat_kecil' as const, label: 'Mini (-5%)', val: probabilitas.sangat_kecil, isZonk: false },
                    { key: 'zonk' as const, label: 'Zonk (0%)', val: probabilitas.zonk, isZonk: true },
                  ].map((p, idx, arr) => (
                    <div key={p.key} className="inline-flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          p.isZonk ? 'bg-[#c8362f]' : 'bg-[#1d3b2e]/50'
                        }`}
                      />
                      <span className={p.isZonk ? 'text-[#c8362f] font-semibold' : 'text-[#3d4d42] font-medium'}>
                        {p.label}:{' '}
                        <strong
                          className={`font-mono ${
                            p.isZonk ? 'font-black text-[#c8362f]' : 'font-extrabold text-[#1d3b2e]'
                          }`}
                        >
                          {p.val}%
                        </strong>
                      </span>
                      {idx < arr.length - 1 && (
                        <span className="text-[#d7caa7] ml-2 select-none font-normal">•</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ringkasan Mekanika */}
              <div className="border-l-4 border-[#d7caa7] pl-3.5 py-0.5 text-xs text-[#1d3b2e] leading-relaxed">
                <strong>Mekanika Makan Kerupuk:</strong> Setiap jawaban benar bernilai{' '}
                <strong className="font-mono">+100 pt</strong> + undian ukuran gigitan otomatis
                dari server. Mencapai rangkaian{' '}
                <strong className="font-mono">Streak 3</strong> memberi bonus{' '}
                <strong className="font-mono">+50 pt</strong>, dan menghabiskan kerupuk (0 pt
                tersisa) memberi bonus penyelesaian <strong className="font-mono">+100 pt</strong>.
              </div>

              {/* Preset Kesulitan */}
              <div className="pt-4 border-t border-dashed border-[#e0d5b8]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-[#1d3b2e]">
                    Tingkat Kesulitan &amp; Peluang Gigitan
                  </span>
                  <span className="text-[11px] font-bold text-[#6b7d6c]">
                    {labelKesulitanAktif}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(['mudah', 'normal', 'sulit', 'custom'] as KesulitanKerupuk[]).map((key) => {
                    const active = kesulitan === key;
                    const info =
                      key === 'custom'
                        ? { label: 'Kustom', desc: 'Atur semua peluang' }
                        : {
                            label: PRESET_DATA[key].label,
                            desc: DESKRIPSI_RINGKAS_PRESET[key],
                          };
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handlePilihKesulitan(key)}
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
              </div>

              {/* Pengaturan Lanjutan (Slider Peluang Gigitan & Zonk) */}
              <div className="pt-3 border-t border-dashed border-[#e0d5b8]">
                <button
                  type="button"
                  onClick={() => setShowAdvancedRules((prev) => !prev)}
                  className="w-full py-1 text-xs font-extrabold text-[#1d3b2e] hover:text-[#c8362f] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-[#c8362f]" />
                    Pengaturan Lanjutan (Atur Rincian Peluang Gigitan &amp; Zonk)
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-[#6b7d6c]">
                    {kesulitan === 'custom' ? 'Kustom Aktif' : PRESET_DATA[kesulitan].label}
                    {showAdvancedRules ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </button>
              </div>

              {showAdvancedRules && (
                <div className="space-y-3 pt-1">
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
                    <div
                      key={item.key}
                      id={`slider-gigitan-${item.key}`}
                      tabIndex={-1}
                      className="p-2 rounded-xl transition-colors focus:bg-[#f6ebd4] focus:outline-none"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-[#1d3b2e] mb-1">
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
                            className="w-16 px-2 py-0.5 text-right font-mono text-xs bg-[#fcf8ed] border border-[#e0d5b8] rounded-lg font-bold"
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

                  {!isValidProb && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] font-bold text-[#c8362f] flex items-center justify-between gap-2">
                      <span>Total seluruh probabilitas saat ini {totalPersen}%. Wajib tepat 100%.</span>
                      <button
                        type="button"
                        onClick={() => handlePilihKesulitan('normal')}
                        className="px-2.5 py-1 rounded-lg bg-white border border-red-300 text-[#c8362f] hover:bg-red-100 font-extrabold shrink-0 cursor-pointer"
                      >
                        Reset Normal
                      </button>
                    </div>
                  )}
                </div>
              )}

              {jumlahSoal === 0 && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-[#c8362f] flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Template kuis ini belum memiliki soal. Tambahkan minimal 1 soal sebelum memulai sesi.
                  </span>
                  {selectedTemplate && !selectedTemplate.resmi && (
                    <button
                      type="button"
                      onClick={() => navigate(`/guru/template/${selectedTemplate.id}/ubah`)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white border border-red-300 text-[#c8362f] hover:bg-red-100 font-extrabold cursor-pointer"
                    >
                      Buka Editor Soal <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              <GameConfigFooter
                canSubmit={canSubmit}
                submitting={submitting}
                isSolo={playMode === 'SOLO'}
                submitLabel={
                  playMode === 'MULTIPLAYER'
                    ? 'Buat Sesi Multiplayer & Buka Lobi PIN'
                    : 'Mulai Makan Kerupuk Solo'
                }
              />
            </div>
          </div>
        </GameConfigSection>
      </form>
    </GameConfigPageShell>
  );
}
