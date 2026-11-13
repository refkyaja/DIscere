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
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Flag,
  Flame,
  Monitor,
  Play,
  QrCode,
  Shuffle,
  Sliders,
  Swords,
  Timer,
  Users,
  Zap,
  Volume2,
  Minus,
  Plus,
} from 'lucide-react';

export type PlayModeTarik = 'MULTIPLAYER' | 'SOLO';
export type TipeLawanSoloTarik = 'bot' | 'lokal';
export type KesulitanBotTarik = 'mudah' | 'sedang' | 'sulit';
export type PresetBatasTarik = '25' | '50' | '75' | '100' | 'custom';

interface TemplateDetail {
  id: string;
  judul: string;
  game: string;
  mode: string;
  resmi?: boolean;
  questions?: Array<{ id: string }>;
  _count?: { questions: number };
}

const BATAS_PRESETS: Array<{ key: Exclude<PresetBatasTarik, 'custom'>; val: number; label: string }> = [
  { key: '25', val: 25, label: 'Kilat (±25)' },
  { key: '50', val: 50, label: 'Cepat (±50)' },
  { key: '75', val: 75, label: 'Sedang (±75)' },
  { key: '100', val: 100, label: 'Klasik (±100)' },
];

const DURASI_LOMBA_PRESETS: Array<{ val: number; label: string }> = [
  { val: 120, label: '2:00 (Cepat)' },
  { val: 180, label: '3:00 (Standar)' },
  { val: 300, label: '5:00 (Panjang)' },
];

const WAKTU_SOAL_PRESETS = [10, 15, 20, 30];

export default function PilihModeTarikTambang() {
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

  const [playMode, setPlayMode] = useState<PlayModeTarik>(() =>
    queryModeParam === 'multi' ? 'MULTIPLAYER' : 'SOLO'
  );

  // Target Garis Menang & Durasi Lomba
  const [presetBatas, setPresetBatas] = useState<PresetBatasTarik>('100');
  const [batasCustomInput, setBatasCustomInput] = useState<string>('80');
  const [durasiLombaDetik, setDurasiLombaDetik] = useState<number>(180);

  // Tim & Mode Lawan Solo / Kapasitas Multi (Maks 40 / Kelas)
  const [tipeLawanSolo, setTipeLawanSolo] = useState<TipeLawanSoloTarik>('bot');
  const [kesulitanBot, setKesulitanBot] = useState<KesulitanBotTarik>('sedang');
  const [namaTim1, setNamaTim1] = useState<string>(() =>
    queryModeParam === 'multi' ? 'Tim Merah' : 'Pemain 1'
  );
  const [namaTim2, setNamaTim2] = useState<string>(() =>
    queryModeParam === 'multi' ? 'Tim Biru' : 'Bot'
  );
  const [maxPeserta, setMaxPeserta] = useState<number>(40);

  // Skala Tarikan & Waktu Soal
  const [waktuPerSoalDetik, setWaktuPerSoalDetik] = useState<number>(10);
  const [tarikBenarSolo, setTarikBenarSolo] = useState<number>(10);
  const [mundurSalahSolo, setMundurSalahSolo] = useState<number>(4);
  const [kekuatanTimMulti, setKekuatanTimMulti] = useState<number>(40);

  // Aturan Tambahan Opsional
  const [bonusAktif, setBonusAktif] = useState<boolean>(false);
  const [powerUpAktif, setPowerUpAktif] = useState<boolean>(false);
  const [showAdvancedRules, setShowAdvancedRules] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    hasSyncedInitialMode.current = false;

    async function loadTemplate() {
      if (!queryTemplateId) {
        setSelectedTemplate(null);
        setErrorPesan(
          'Template kuis belum dipilih. Silakan pilih kuis Tarik Tambang dari Dashboard terlebih dahulu.'
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
        if (tmpl.game && tmpl.game !== 'tarik_tambang') {
          setSelectedTemplate(null);
          setErrorPesan(
            `Template "${tmpl.judul}" bukan diperuntukkan untuk Tarik Tambang Kuis.`
          );
          return;
        }

        setSelectedTemplate(tmpl);

        if (!hasSyncedInitialMode.current) {
          hasSyncedInitialMode.current = true;
          const resolvedMode: PlayModeTarik =
            queryModeParam === 'multi'
              ? 'MULTIPLAYER'
              : queryModeParam === 'solo'
                ? 'SOLO'
                : tmpl.mode === 'multi'
                  ? 'MULTIPLAYER'
                  : 'SOLO';
          setPlayMode(resolvedMode);
          syncNamesForMode(resolvedMode);
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
  const cukupSoal = jumlahSoal >= 2;

  const batasMenangFinal = useMemo(() => {
    if (presetBatas === 'custom') {
      const parsed = parseInt(batasCustomInput, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return parseInt(presetBatas, 10);
  }, [presetBatas, batasCustomInput]);

  const batasValid =
    Number.isInteger(batasMenangFinal) && batasMenangFinal >= 10 && batasMenangFinal <= 200;
  const durasiValid = Number.isInteger(durasiLombaDetik) && durasiLombaDetik >= 30 && durasiLombaDetik <= 900;
  const timValid = namaTim1.trim().length >= 2 && namaTim2.trim().length >= 2;

  const canSubmit =
    Boolean(selectedTemplate) &&
    cukupSoal &&
    batasValid &&
    durasiValid &&
    timValid &&
    !submitting;

  const syncNamesForMode = (
    nextMode: PlayModeTarik,
    lawan: TipeLawanSoloTarik = tipeLawanSolo
  ) => {
    if (nextMode === 'SOLO') {
      setNamaTim1((prev) => (!prev.trim() || prev === 'Tim Merah' ? 'Pemain 1' : prev));
      setNamaTim2((prev) =>
        !prev.trim() || prev === 'Tim Biru' || prev === 'Lawan Bot'
          ? lawan === 'bot'
            ? 'Bot'
            : 'Pemain 2'
          : prev
      );
    } else {
      setNamaTim1((prev) => (!prev.trim() || prev === 'Pemain 1' ? 'Tim Merah' : prev));
      setNamaTim2((prev) =>
        !prev.trim() || prev === 'Bot' || prev === 'Pemain 2' || prev === 'Lawan Bot'
          ? 'Tim Biru'
          : prev
      );
    }
  };

  const handleSelectPlayMode = (nextMode: PlayModeTarik) => {
    setPlayMode(nextMode);
    syncNamesForMode(nextMode);
  };

  const handleUbahLawanSolo = (nextType: TipeLawanSoloTarik) => {
    setTipeLawanSolo(nextType);
    if (
      nextType === 'bot' &&
      (!namaTim2.trim() || namaTim2 === 'Pemain 2' || namaTim2 === 'Tim Biru' || namaTim2 === 'Lawan Bot')
    ) {
      setNamaTim2('Bot');
    } else if (
      nextType === 'lokal' &&
      (!namaTim2.trim() || namaTim2 === 'Bot' || namaTim2 === 'Lawan Bot' || namaTim2 === 'Tim Biru')
    ) {
      setNamaTim2('Pemain 2');
    }
  };

  const formatClockLabel = (detik: number) => {
    const m = Math.floor(detik / 60);
    const s = detik % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const statusLanjutan =
    bonusAktif && powerUpAktif
      ? 'Bonus Streak + Power-Up'
      : bonusAktif
        ? 'Bonus Streak Aktif'
        : powerUpAktif
          ? 'Power-Up Aktif'
          : 'Murni Tarik Cepat (Standar)';

  const handleMulaiPermainan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedTemplate) return;

    try {
      setSubmitting(true);
      setErrorPesan(null);

      const isMulti = playMode === 'MULTIPLAYER';
      const tarikTambangConfig = {
        sumberSoal: 'bank_soal',
        kesulitan: 'semua',
        durasiLombaDetik,
        waktuPerSoalDetik,
        durasiRonde: Math.min(30, Math.max(15, waktuPerSoalDetik)),
        tarikBenarSolo,
        mundurSalahSolo,
        kekuatanTimMulti,
        rasioTerpeleset: 0.4,
        tipeLawanSolo,
        kesulitanBot,
        bonusAktif,
        powerUpAktif,
        namaTim1: namaTim1.trim() || (isMulti ? 'Tim Merah' : 'Pemain 1'),
        namaTim2:
          namaTim2.trim() ||
          (isMulti ? 'Tim Biru' : tipeLawanSolo === 'bot' ? 'Bot' : 'Pemain 2'),
        maxPeserta: isMulti ? maxPeserta : 2,
        batasMenang: batasMenangFinal,
      };

      const res = await apiRequest<{ session: { id: string } }>('/sesi', {
        method: 'POST',
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          game: 'tarik_tambang',
          mode: isMulti ? 'multi' : 'solo',
          playMode,
          autoStart: false,
          tarikTambangConfig,
        }),
      });

      navigate(`/guru/sesi/${res.session.id}?kembali=${encodeURIComponent(queryKembali)}`);
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal membuat sesi Tarik Tambang Kuis.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GameConfigPageShell
      loading={loadingTemplate}
      loadingText="Menyiapkan Pengaturan Tarik Tambang..."
      title="Tarik Tambang Kuis"
      subtitle="Atur mode permainan, durasi lomba, target garis menang, dan aturan tarikan sebelum bertanding."
      errorMessage={errorPesan}
      templateTitle={selectedTemplate?.judul}
      isOfficialTemplate={Boolean(selectedTemplate?.resmi)}
      questionCount={jumlahSoal}
      missingTemplateMessage="Tidak dapat memuat pengaturan karena materi kuis Tarik Tambang belum tersedia."
    >
      <form onSubmit={handleMulaiPermainan} className="space-y-6">
        {/* 1. Pengaturan Umum */}
        <GameConfigSection
          title="1. Pengaturan Umum"
          description="Pilih mode permainan (Multiplayer Tim atau Solo 1 vs 1), tentukan identitas tim & kapasitas kelas untuk mode multi, atau tentukan lawan tanding (Bot AI vs Teman Asli) untuk mode solo."
        >
          <div className="space-y-5">
            {/* 1A. Pilihan Mode Permainan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <GameModeCard
                selected={playMode === 'MULTIPLAYER'}
                variant="green"
                onClick={() => handleSelectPlayMode('MULTIPLAYER')}
                badgeIcon={<Users className="w-3.5 h-3.5" />}
                badgeLabel="Multiplayer Tim"
                title="Siswa Bermain di HP • Tarik Tambang 2 Tim"
                description="Guru membuka PIN & QR Code untuk hingga 40 siswa dalam 1 kelas. Soal mengalir berurutan di HP tanpa henti, setiap jawaban benar menarik tali!"
                features={[
                  { icon: <QrCode className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'PIN & QR Gabung' },
                  { icon: <Users className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'Tim Merah vs Biru' },
                  { icon: <Timer className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'Kuis Real-Time 10 dtk/Soal' },
                  { icon: <Zap className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'Podium & Heatmap Analisis' },
                ]}
              />

              <GameModeCard
                selected={playMode === 'SOLO'}
                variant="red"
                onClick={() => handleSelectPlayMode('SOLO')}
                badgeIcon={<Monitor className="w-3.5 h-3.5" />}
                badgeLabel="Solo Mode (1 vs 1)"
                title="Satu Layar Proyektor • Duel Cepat 1 vs 1"
                description="Tanpa HP siswa atau PIN. Dua kartu soal tampil bersebelahan di layar guru — jawab cepat tanpa menunggu ronde melawan Bot AI atau Pemain 2 Lokal."
                features={[
                  { icon: <Monitor className="w-3.5 h-3.5" />, label: 'Tanpa PIN / QR Code' },
                  { icon: <Bot className="w-3.5 h-3.5" />, label: 'Lawan Bot AI / Lokal' },
                  { icon: <Swords className="w-3.5 h-3.5" />, label: 'Duel Kiri vs Kanan Berkelanjutan' },
                  { icon: <Play className="w-3.5 h-3.5" />, label: 'Kontrol Jeda & Ulang' },
                ]}
              />
            </div>

            {/* 1B. Rincian Konfigurasi Mode Terpilih */}
            <div className="portal-card p-5 space-y-4">
              <GameConfigCardHeader
                icon={
                  playMode === 'MULTIPLAYER' ? (
                    <Users className="w-4 h-4 text-[#1d3b2e]" />
                  ) : (
                    <Swords className="w-4 h-4 text-[#c8362f]" />
                  )
                }
                title={playMode === 'MULTIPLAYER' ? 'Tim & Kapasitas Kelas' : 'Pengaturan Duel 1 vs 1'}
                tagLabel={playMode === 'MULTIPLAYER' ? `Maks ${maxPeserta} Siswa` : '2 Sisi Layar'}
                tagColor={playMode === 'MULTIPLAYER' ? 'green' : 'red'}
              />

              {playMode === 'SOLO' && (
                <div className="space-y-3">
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
                        1 pemain menjawab cepat melawan Bot otomatis.
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
                        <Users className="w-4 h-4" /> Teman Asli / Pemain 2 (Lokal)
                      </div>
                      <p
                        className={`text-[11px] mt-1 leading-snug ${
                          tipeLawanSolo === 'lokal' ? 'text-[#f4ecd8]/85' : 'text-[#6b7d6c]'
                        }`}
                      >
                        2 siswa adu cepat kiri vs kanan pada 1 layar bersama.
                      </p>
                    </button>
                  </div>

                  {tipeLawanSolo === 'bot' && (
                    <div>
                      <label className="text-xs font-bold text-[#6b7d6c] block mb-1.5">
                        Tingkat Kesulitan Bot
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['mudah', 'sedang', 'sulit'] as KesulitanBotTarik[]).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setKesulitanBot(lvl)}
                            className={`py-2 px-2 rounded-xl border-2 text-xs font-extrabold capitalize cursor-pointer ${
                              kesulitanBot === lvl
                                ? 'bg-[#1d3b2e] text-[#f4ecd8] border-[#1d3b2e]'
                                : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8]'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-[#c8362f] block mb-1">
                    {playMode === 'MULTIPLAYER' ? 'Nama Tim Kiri' : 'Nama Pemain Kiri'}
                  </label>
                  <input
                    type="text"
                    maxLength={32}
                    value={namaTim1}
                    onChange={(e) => setNamaTim1(e.target.value)}
                    className="portal-input font-bold"
                    placeholder={playMode === 'MULTIPLAYER' ? 'Tim Merah' : 'Pemain 1'}
                  />
                </div>
                <div>
                  <label className="font-bold text-[#1e40af] block mb-1">
                    {playMode === 'MULTIPLAYER' ? 'Nama Tim Kanan' : 'Nama Lawan Kanan'}
                  </label>
                  <input
                    type="text"
                    maxLength={32}
                    value={namaTim2}
                    onChange={(e) => setNamaTim2(e.target.value)}
                    className="portal-input font-bold"
                    placeholder={
                      playMode === 'MULTIPLAYER'
                        ? 'Tim Biru'
                        : tipeLawanSolo === 'bot'
                          ? 'Bot'
                          : 'Pemain 2'
                    }
                  />
                </div>
              </div>

              {!timValid && (
                <p className="text-[11px] font-bold text-[#c8362f]">
                  Nama masing-masing tim minimal 2 karakter.
                </p>
              )}

              {playMode === 'MULTIPLAYER' && (
                <div className="pt-3 border-t border-dashed border-[#e0d5b8]">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#6b7d6c] flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-[#1d3b2e]" />
                      <span>Kapasitas Peserta (1–45 Siswa)</span>
                    </label>
                    <span className="font-extrabold text-xs px-2.5 py-0.5 bg-[#1d3b2e] text-[#f4ecd8] rounded-full font-mono shadow-xs">
                      {maxPeserta} Siswa
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 p-2 bg-[#fffdf6] border-2 border-[#e0d5b8] rounded-2xl shadow-xs max-w-md">
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
              )}
            </div>
          </div>
        </GameConfigSection>

        {/* 2. Pengaturan Khusus Tarik Tambang */}
        <GameConfigSection
          title="2. Pengaturan Khusus Tarik Tambang"
          description="Sesuaikan target garis menang, durasi lomba, kekuatan tarikan tali, dan opsi mekanika lanjutan."
        >
          <div className="space-y-6">
            {/* Target Batas Menang & Jam Lomba */}
            <div className="portal-card p-5 space-y-4">
              <GameConfigCardHeader
                icon={<Flag className="w-4 h-4 text-[#c8362f]" />}
                title="Target Garis Menang & Durasi Lomba"
                tagLabel={`Waktu ${formatClockLabel(durasiLombaDetik)}`}
                tagColor="green"
              />

              <div>
                <label className="text-xs font-bold text-[#6b7d6c] block mb-2">
                  Batas Tarikan Menang (±10 sampai ±200)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {BATAS_PRESETS.map((item) => {
                    const active = presetBatas === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setPresetBatas(item.key)}
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
                  <button
                    type="button"
                    onClick={() => setPresetBatas('custom')}
                    className={`py-2.5 px-2 rounded-xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                      presetBatas === 'custom'
                        ? 'bg-[#c8362f] text-[#f4ecd8] border-[#c8362f] shadow-xs'
                        : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                    }`}
                  >
                    Kustom
                  </button>
                </div>

                {presetBatas === 'custom' && (
                  <div className="flex items-center gap-3 pt-2">
                    <label className="text-xs font-bold text-[#6b7d6c] shrink-0">
                      Batas (10–200):
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={200}
                      value={batasCustomInput}
                      onChange={(e) => setBatasCustomInput(e.target.value)}
                      className="portal-input max-w-[120px] font-mono font-bold text-center"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-dashed border-[#e0d5b8] space-y-2">
                <label className="text-xs font-bold text-[#6b7d6c] block">
                  Durasi Pertandingan Keseluruhan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DURASI_LOMBA_PRESETS.map((d) => (
                    <button
                      key={d.val}
                      type="button"
                      onClick={() => setDurasiLombaDetik(d.val)}
                      className={`py-2 px-2 rounded-xl border-2 text-xs font-extrabold cursor-pointer transition-all ${
                        durasiLombaDetik === d.val
                          ? 'bg-[#1d3b2e] text-[#f4ecd8] border-[#1d3b2e]'
                          : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Kecepatan Soal, Skala Tarikan & Mekanika Tambang */}
            <div className="portal-card p-5 space-y-5">
            <GameConfigCardHeader
              icon={<Clock className="w-4 h-4 text-[#c8362f]" />}
              title="Kecepatan Soal & Skala Tarikan"
              tagLabel={
                playMode === 'MULTIPLAYER'
                  ? `${waktuPerSoalDetik} dtk/soal • Tim ${kekuatanTimMulti}`
                  : `+${tarikBenarSolo} / -${mundurSalahSolo}`
              }
              tagColor="green"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Kiri: Waktu & Skala */}
              <div className="space-y-4">
                {playMode === 'MULTIPLAYER' ? (
                  <>
                    <div>
                      <label className="text-xs font-bold text-[#6b7d6c] block mb-2">
                        Batas Waktu per Soal di HP Siswa (detik)
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {WAKTU_SOAL_PRESETS.map((det) => (
                          <button
                            key={det}
                            type="button"
                            onClick={() => setWaktuPerSoalDetik(det)}
                            className={`px-3.5 py-2 rounded-xl border-2 text-xs font-extrabold cursor-pointer ${
                              waktuPerSoalDetik === det
                                ? 'bg-[#1d3b2e] text-[#f4ecd8] border-[#1d3b2e]'
                                : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8]'
                            }`}
                          >
                            {det} detik
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-dashed border-[#e0d5b8]">
                      <div className="flex items-center justify-between text-xs font-bold text-[#1d3b2e] mb-1">
                        <span>Total Kekuatan Tarik Tim</span>
                        <span className="font-mono">{kekuatanTimMulti} poin ÷ anggota</span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={80}
                        step={5}
                        value={kekuatanTimMulti}
                        onChange={(e) => setKekuatanTimMulti(Number(e.target.value))}
                        className="w-full accent-[#c8362f] cursor-pointer"
                      />
                      <p className="text-[11px] text-[#6b7d6c] mt-1">
                        Salah atau waktu habis otomatis mengurangi tarikan tim (terpeleset 40%).
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-[#1f9d55] block mb-1">
                        Tarikan Benar (+)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={tarikBenarSolo}
                        onChange={(e) =>
                          setTarikBenarSolo(Math.max(1, Math.min(50, Number(e.target.value) || 10)))
                        }
                        className="portal-input font-mono font-bold text-center"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#d63b3b] block mb-1">
                        Mundur Terpeleset (−)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={mundurSalahSolo}
                        onChange={(e) =>
                          setMundurSalahSolo(Math.max(0, Math.min(30, Number(e.target.value) || 0)))
                        }
                        className="portal-input font-mono font-bold text-center"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Kanan: Sumber Bank Soal */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#6b7d6c] flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5 text-[#1d3b2e]" />
                  Sumber Soal dari Bank Soal ({jumlahSoal} tersedia)
                </label>
                <p className="text-xs text-[#6b7d6c] leading-relaxed">
                  Seluruh soal dari template dipilih otomatis dan diacak berulang selama pertandingan berlangsung.
                </p>

                {!cukupSoal && (
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-[#c8362f] flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Minimal butuh 2 soal dari template untuk bermain.
                    </span>
                    {selectedTemplate && !selectedTemplate.resmi && (
                      <button
                        type="button"
                        onClick={() => navigate(`/guru/template/${selectedTemplate.id}/ubah`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-red-300 text-[#c8362f] hover:bg-red-100 font-extrabold cursor-pointer"
                      >
                        Edit Soal <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Pengaturan Lanjutan (Opsional) */}
            <div className="pt-3 border-t border-dashed border-[#e0d5b8]">
              <button
                type="button"
                onClick={() => setShowAdvancedRules((prev) => !prev)}
                className="w-full py-1 text-xs font-extrabold text-[#1d3b2e] hover:text-[#c8362f] flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-[#c8362f]" />
                  Opsi Tambahan (Bonus Streak &amp; Power-Up)
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-[#6b7d6c]">
                  {statusLanjutan}
                  {showAdvancedRules ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              </button>

              {showAdvancedRules && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                  <label className="flex items-start justify-between gap-2.5 cursor-pointer py-1">
                    <div>
                      <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#1d3b2e]">
                        <Flame className="w-3.5 h-3.5 text-orange-500" /> Bonus Streak
                      </span>
                      <p className="text-[11px] text-[#6b7d6c] mt-0.5 leading-snug">
                        Streak 3 beruntun memberi +5 ekstra, Streak 5 memberi +10 ekstra.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={bonusAktif}
                      onChange={(e) => setBonusAktif(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded accent-[#1d3b2e]"
                    />
                  </label>

                  <label className="flex items-start justify-between gap-2.5 cursor-pointer py-1">
                    <div>
                      <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#1d3b2e]">
                        <Zap className="w-3.5 h-3.5 text-sky-600" /> Power-Up Spesial
                      </span>
                      <p className="text-[11px] text-[#6b7d6c] mt-0.5 leading-snug">
                        Beri Semangat, Pertahanan Kuat, dan Tarikan Super saat streak tinggi.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={powerUpAktif}
                      onChange={(e) => setPowerUpAktif(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded accent-[#1d3b2e]"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
          </div>
        </GameConfigSection>

        <GameConfigFooter
          canSubmit={canSubmit}
          submitting={submitting}
          isSolo={playMode === 'SOLO'}
          submitLabel={
            playMode === 'MULTIPLAYER'
              ? 'Buka Lobi & Kode PIN Kelas'
              : 'Buka Arena Solo (1 vs 1)'
          }
        />
      </form>
    </GameConfigPageShell>
  );
}
