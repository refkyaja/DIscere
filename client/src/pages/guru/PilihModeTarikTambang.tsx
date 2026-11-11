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
} from '../../components';
import type {
  KesulitanTarik,
  KonfigurasiTarikTambangPayload,
} from './ModalKonfigurasiTarikTambang';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Flag,
  Flame,
  Monitor,
  Play,
  QrCode,
  Scale,
  Sliders,
  Swords,
  Users,
  Zap,
} from 'lucide-react';

export type PlayModeTarik = 'MULTIPLAYER' | 'SOLO';
export type PresetBatasTarik = '25' | '50' | '75' | '100' | 'custom';

interface TemplateDetail {
  id: string;
  judul: string;
  game: string;
  mode: string;
  resmi?: boolean;
  questions?: Array<{ id: string; kesulitan?: string | null }>;
  _count?: { questions: number };
}

const BATAS_PRESETS: Array<{ key: Exclude<PresetBatasTarik, 'custom'>; val: number; label: string }> = [
  { key: '25', val: 25, label: 'Kilat (±25)' },
  { key: '50', val: 50, label: 'Cepat (±50)' },
  { key: '75', val: 75, label: 'Sedang (±75)' },
  { key: '100', val: 100, label: 'Klasik (±100)' },
];

const LABEL_KESULITAN: Record<KesulitanTarik, string> = {
  mudah: 'Mudah',
  sedang: 'Sedang',
  sulit: 'Sulit',
};

export default function PilihModeTarikTambang() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTemplateId = searchParams.get('templateId') || '';
  const queryKembali = searchParams.get('kembali') || '/guru';
  const queryModeParam = searchParams.get('mode');

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetail | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const hasSyncedInitialMode = useRef(false);

  const [playMode, setPlayMode] = useState<PlayModeTarik>(() =>
    queryModeParam === 'multi' ? 'MULTIPLAYER' : 'SOLO'
  );

  // Target Kemenangan Tali
  const [presetBatas, setPresetBatas] = useState<PresetBatasTarik>('100');
  const [batasCustomInput, setBatasCustomInput] = useState<string>('80');

  // Pengaturan Tim & Peserta
  const [namaTim1, setNamaTim1] = useState<string>('Tim Merah');
  const [namaTim2, setNamaTim2] = useState<string>('Tim Biru');
  const [maxPeserta, setMaxPeserta] = useState<number>(60);

  // Waktu Ronde, Kesulitan Soal Setara & Lanjutan
  const [durasiRonde, setDurasiRonde] = useState<15 | 20 | 30>(20);
  const [kesulitan, setKesulitan] = useState<KesulitanTarik>('sedang');
  const [bonusAktif, setBonusAktif] = useState<boolean>(true);
  const [powerUpAktif, setPowerUpAktif] = useState<boolean>(true);
  const [showAdvancedRules, setShowAdvancedRules] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    hasSyncedInitialMode.current = false;

    async function loadTemplate() {
      if (!queryTemplateId) {
        setSelectedTemplate(null);
        setErrorPesan(
          'Template kuis belum dipilih. Silakan pilih kuis Tarik Tambang dari Dashboard atau Papan Tulis terlebih dahulu.'
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
            `Template "${tmpl.judul}" bukan diperuntukkan untuk Tarik Tambang Challenge.`
          );
          return;
        }

        setSelectedTemplate(tmpl);
        const qs = tmpl.questions || [];
        const counts: Record<KesulitanTarik, number> = { mudah: 0, sedang: 0, sulit: 0 };
        for (const q of qs) {
          const lvl = ((q.kesulitan || 'sedang').toLowerCase() as KesulitanTarik);
          if (lvl in counts) counts[lvl] += 1;
        }
        const preferred = (['sedang', 'mudah', 'sulit'] as KesulitanTarik[]).find(
          (k) => counts[k] >= 2
        );
        if (preferred) setKesulitan(preferred);

        if (!hasSyncedInitialMode.current) {
          hasSyncedInitialMode.current = true;
          if (queryModeParam === 'multi') {
            setPlayMode('MULTIPLAYER');
          } else if (queryModeParam === 'solo') {
            setPlayMode('SOLO');
          } else if (tmpl.mode === 'multi') {
            setPlayMode('MULTIPLAYER');
          } else {
            setPlayMode('SOLO');
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

  const questions = selectedTemplate?.questions || [];
  const jumlahSoal =
    selectedTemplate?.questions?.length ?? selectedTemplate?._count?.questions ?? 0;

  const countsPerKesulitan = useMemo(() => {
    const counts: Record<KesulitanTarik, number> = { mudah: 0, sedang: 0, sulit: 0 };
    for (const q of questions) {
      const lvl = ((q.kesulitan || 'sedang').toLowerCase() as KesulitanTarik);
      if (lvl in counts) counts[lvl] += 1;
    }
    return counts;
  }, [questions]);

  const soalSetaraTerpilih = countsPerKesulitan[kesulitan];
  const cukupSoal = questions.length === 0 ? jumlahSoal >= 2 : soalSetaraTerpilih >= 2;

  const batasMenangFinal = useMemo(() => {
    if (presetBatas === 'custom') {
      const parsed = parseInt(batasCustomInput, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return parseInt(presetBatas, 10);
  }, [presetBatas, batasCustomInput]);

  const batasValid =
    Number.isInteger(batasMenangFinal) && batasMenangFinal >= 10 && batasMenangFinal <= 100;
  const timValid = namaTim1.trim().length >= 2 && namaTim2.trim().length >= 2;

  const canSubmit =
    Boolean(selectedTemplate) &&
    cukupSoal &&
    batasValid &&
    timValid &&
    !submitting;

  const statusLanjutan =
    bonusAktif && powerUpAktif
      ? 'Aktif Semua'
      : bonusAktif || powerUpAktif
      ? 'Aktif Sebagian'
      : 'Nonaktif';

  const handleMulaiPermainan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedTemplate) return;

    try {
      setSubmitting(true);
      setErrorPesan(null);

      const isMulti = playMode === 'MULTIPLAYER';
      const tarikTambangConfig: KonfigurasiTarikTambangPayload = {
        sumberSoal: 'bank_soal',
        kesulitan,
        durasiRonde,
        bonusAktif,
        powerUpAktif,
        namaTim1: namaTim1.trim() || 'Tim Merah',
        namaTim2: namaTim2.trim() || 'Tim Biru',
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
          autoStart: !isMulti,
          tarikTambangConfig,
        }),
      });

      const backTarget = `/guru/tarik-tambang?templateId=${encodeURIComponent(
        selectedTemplate.id
      )}&kembali=${encodeURIComponent(queryKembali)}`;
      navigate(`/guru/sesi/${res.session.id}?kembali=${encodeURIComponent(backTarget)}`);
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal membuat sesi Tarik Tambang Challenge.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GameConfigPageShell
      loading={loadingTemplate}
      loadingText="Menyiapkan Pengaturan Tarik Tambang..."
      title="Tarik Tambang Challenge"
      subtitle="Atur mode permainan, batas kemenangan tali, nama tim, durasi ronde, dan kesetaraan soal sebelum lomba."
      onBack={() => navigate(queryKembali)}
      errorMessage={errorPesan}
      templateTitle={selectedTemplate?.judul}
      isOfficialTemplate={Boolean(selectedTemplate?.resmi)}
      questionCount={jumlahSoal}
      missingTemplateMessage="Tidak dapat memuat pengaturan karena materi kuis Tarik Tambang belum tersedia."
    >
      <form onSubmit={handleMulaiPermainan} className="space-y-6">
        {/* 1. Pilih Mode Permainan */}
        <GameConfigSection
          title="1. Pilih Mode Permainan"
          description="Multiplayer membagi siswa ke 2 tim di HP masing-masing; Solo Mode menyajikan duel 1 vs 1 langsung di satu layar proyektor."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <GameModeCard
              selected={playMode === 'MULTIPLAYER'}
              variant="green"
              onClick={() => setPlayMode('MULTIPLAYER')}
              badgeIcon={<Users className="w-3.5 h-3.5" />}
              badgeLabel="Multiplayer Tim"
              title="Siswa Bermain di HP • Adu Tarik 2 Tim"
              description="Guru membuka PIN & QR Code lalu siswa otomatis masuk ke Tim Kiri atau Tim Kanan. Akurasi dan kekompakan menjawab menarik tambang setiap ronde."
              features={[
                { icon: <QrCode className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'PIN & QR Gabung' },
                { icon: <Users className="w-3.5 h-3.5 text-[#f2c230]" />, label: '2 Tim Seimbang' },
                { icon: <Scale className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'Soal Setara Otomatis' },
                { icon: <Zap className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'Power-Up & Streak Tim' },
              ]}
            />

            <GameModeCard
              selected={playMode === 'SOLO'}
              variant="red"
              onClick={() => setPlayMode('SOLO')}
              badgeIcon={<Monitor className="w-3.5 h-3.5" />}
              badgeLabel="Solo Mode (1 vs 1)"
              title="Satu Perangkat Guru • Duel Kiri vs Kanan"
              description="Tanpa HP siswa, PIN, atau QR Code. Dua pemain atau perwakilan tim langsung berhadapan di satu layar proyektor dengan soal setara tiap ronde."
              features={[
                { icon: <Monitor className="w-3.5 h-3.5" />, label: 'Tanpa PIN / QR Code' },
                { icon: <Swords className="w-3.5 h-3.5" />, label: 'Duel 2 Sisi (1 vs 1)' },
                { icon: <Scale className="w-3.5 h-3.5" />, label: 'Soal Setara Otomatis' },
                { icon: <Play className="w-3.5 h-3.5" />, label: 'Kontrol Jeda & Ulang' },
              ]}
            />
          </div>
        </GameConfigSection>

        {/* 2. Pengaturan Aturan & Arena */}
        <GameConfigSection
          title="2. Pengaturan Aturan & Arena"
          description="Sesuaikan batas kemenangan tali, nama kedua tim, durasi ronde, kesulitan soal setara, dan fitur bonus."
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Kolom Kiri: Batas Kemenangan & Tim */}
            <div className="lg:col-span-5 space-y-5">
              {/* Batasan Menang Tali */}
              <div className="portal-card p-5 space-y-4">
                <GameConfigCardHeader
                  icon={<Flag className="w-4 h-4 text-[#c8362f]" />}
                  title="Batasan Menang Tali"
                  tagLabel={batasValid ? `±${batasMenangFinal} pt` : 'Invalid'}
                  tagColor="yellow"
                />

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                  {BATAS_PRESETS.map((opsi) => {
                    const active = presetBatas === opsi.key;
                    return (
                      <button
                        key={opsi.key}
                        type="button"
                        onClick={() => setPresetBatas(opsi.key)}
                        className={`py-2.5 px-2 rounded-xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                          active
                            ? 'bg-[#c8362f] text-[#f4ecd8] border-[#c8362f] shadow-xs'
                            : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                        }`}
                      >
                        {opsi.label}
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
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs font-bold text-[#6b7d6c] shrink-0">
                      Batas (10–100 poin):
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={batasCustomInput}
                      onChange={(e) => setBatasCustomInput(e.target.value)}
                      className="portal-input max-w-[120px] font-mono font-bold text-center"
                    />
                  </div>
                )}

                <div className="p-3 rounded-xl bg-[#f4ecd9] border border-dashed border-[#d7caa7] text-xs text-[#6b7d6c] space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Target kemenangan tali:</span>
                    <strong className="text-[#1d3b2e] font-mono text-sm">
                      {batasValid ? `±${batasMenangFinal} poin` : 'Tidak valid (10–100)'}
                    </strong>
                  </div>
                  {batasValid && (
                    <div className="text-[11px] font-semibold text-[#1d3b2e]/80">
                      {namaTim1.trim() || 'Tim Merah'} menang di +{batasMenangFinal} ·{' '}
                      {namaTim2.trim() || 'Tim Biru'} menang di -{batasMenangFinal}
                    </div>
                  )}
                </div>
              </div>

              {/* Pengaturan Tim & Peserta */}
              <div className="portal-card p-5 space-y-4">
                <GameConfigCardHeader
                  icon={
                    playMode === 'MULTIPLAYER' ? (
                      <Users className="w-4 h-4 text-[#1d3b2e]" />
                    ) : (
                      <Swords className="w-4 h-4 text-[#c8362f]" />
                    )
                  }
                  title="Pengaturan Tim & Peserta"
                  tagLabel={playMode === 'MULTIPLAYER' ? '2 Tim Aktif' : 'Duel 1 vs 1'}
                  tagColor={playMode === 'MULTIPLAYER' ? 'green' : 'red'}
                />

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-[#c8362f] block mb-1">
                      Nama Tim 1 (Kiri)
                    </label>
                    <input
                      type="text"
                      maxLength={32}
                      value={namaTim1}
                      onChange={(e) => setNamaTim1(e.target.value)}
                      className="portal-input font-bold"
                      placeholder="Tim Merah"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-[#1e40af] block mb-1">
                      Nama Tim 2 (Kanan)
                    </label>
                    <input
                      type="text"
                      maxLength={32}
                      value={namaTim2}
                      onChange={(e) => setNamaTim2(e.target.value)}
                      className="portal-input font-bold"
                      placeholder="Tim Biru"
                    />
                  </div>
                </div>

                {!timValid && (
                  <p className="text-[11px] font-bold text-[#c8362f]">
                    Nama masing-masing tim minimal 2 karakter.
                  </p>
                )}

                {playMode === 'MULTIPLAYER' ? (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#6b7d6c] block mb-1.5">
                      Maksimal Peserta (2–200 siswa)
                    </label>
                    <select
                      value={maxPeserta}
                      onChange={(e) => setMaxPeserta(Number(e.target.value))}
                      className="portal-select font-bold"
                    >
                      <option value={30}>Maksimal 30 Siswa</option>
                      <option value={40}>Maksimal 40 Siswa</option>
                      <option value={60}>Maksimal 60 Siswa (Standar)</option>
                      <option value={100}>Maksimal 100 Siswa</option>
                      <option value={200}>Maksimal 200 Siswa</option>
                    </select>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-[#fffdf6] border-2 border-[#e0d5b8] text-xs text-[#6b7d6c]">
                    <div className="font-extrabold text-[#1d3b2e]">Duel Lokal Tanpa PIN</div>
                    <p className="text-[11px] mt-0.5 leading-snug">
                      Kedua sisi tampil bersamaan di satu layar proyektor dan menjawab pasangan soal setara secara adil.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Kolom Kanan: Waktu Ronde, Kesulitan Soal Setara & Lanjutan */}
            <div className="lg:col-span-7 portal-card p-5 sm:p-6 space-y-5">
              <GameConfigCardHeader
                icon={<Sliders className="w-4 h-4 text-[#c8362f]" />}
                title="Waktu Ronde & Aturan Tarik"
                tagLabel={`${durasiRonde} detik / ronde`}
                tagColor="green"
              />

              {/* Timer Per Ronde */}
              <div className="p-4 rounded-2xl bg-[#fffdf6] border-2 border-[#e0d5b8] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#1d3b2e]">
                    <Clock className="w-4 h-4 text-[#c8362f]" /> Durasi Timer per Ronde
                  </span>
                  <span className="text-[11px] font-bold text-[#6b7d6c]">
                    Kedua tim menjawab serentak sebelum tali bergerak
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([15, 20, 30] as const).map((detik) => {
                    const active = durasiRonde === detik;
                    return (
                      <button
                        key={detik}
                        type="button"
                        onClick={() => setDurasiRonde(detik)}
                        className={`px-3 py-2.5 rounded-xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                          active
                            ? 'bg-[#1d3b2e] text-[#f4ecd8] border-[#1d3b2e]'
                            : 'bg-[#fcf8ed] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                        }`}
                      >
                        {detik} Detik
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ringkasan Mekanika */}
              <div className="p-3.5 rounded-2xl bg-[#f4ecd9]/80 border border-dashed border-[#d7caa7] text-xs text-[#1d3b2e] leading-relaxed">
                <strong>Mekanika Tarik Tambang:</strong> Setiap ronde, Tim Kiri dan Tim Kanan
                mendapatkan <strong>2 soal berbeda dengan tingkat kesulitan setara</strong>.
                Selisih akurasi &amp; kecepatan menarik posisi tali ke arah tim terkuat hingga
                mencapai batas <strong className="font-mono">±{batasValid ? batasMenangFinal : 100}</strong>.
              </div>

              {/* Tingkat Kesulitan Soal Setara */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#1d3b2e]">
                    Tingkat Kesulitan Soal Setara (Pool Soal)
                  </span>
                  <span className="text-[11px] font-bold text-[#6b7d6c]">
                    {LABEL_KESULITAN[kesulitan]} ({soalSetaraTerpilih} soal)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['mudah', 'sedang', 'sulit'] as KesulitanTarik[]).map((lvl) => {
                    const active = kesulitan === lvl;
                    const cnt = countsPerKesulitan[lvl];
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setKesulitan(lvl)}
                        className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-[#1d3b2e] text-[#f4ecd8] border-[#1d3b2e] shadow-xs'
                            : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                        }`}
                      >
                        <div className="text-xs font-extrabold">{LABEL_KESULITAN[lvl]}</div>
                        <div
                          className={`text-[10px] mt-0.5 leading-tight ${
                            active ? 'text-[#cfd9c3]' : 'text-[#6b7d6c]'
                          }`}
                        >
                          {cnt} soal tersedia {cnt < 2 ? '(kurang)' : '(siap)'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {!cukupSoal && (
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-[#c8362f] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        Minimal dibutuhkan 2 soal tingkat {LABEL_KESULITAN[kesulitan]} agar Tim 1
                        dan Tim 2 mendapat soal berbeda setiap ronde.
                      </span>
                    </div>
                    {selectedTemplate && !selectedTemplate.resmi && (
                      <button
                        type="button"
                        onClick={() => navigate(`/guru/template/${selectedTemplate.id}/ubah`)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white border border-red-300 text-[#c8362f] hover:bg-red-100 font-extrabold cursor-pointer"
                      >
                        Edit Soal <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Pengaturan Lanjutan (Bonus Streak & Power-Up) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedRules((prev) => !prev)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-dashed border-[#d7caa7] bg-[#fcf8ed] hover:bg-[#f4ecd8] text-xs font-extrabold text-[#1d3b2e] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-[#c8362f]" />
                    Pengaturan Lanjutan (Bonus Streak &amp; Sistem Power-Up)
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
              </div>

              {showAdvancedRules && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="p-3.5 bg-[#fffdf6] border-2 border-[#e0d5b8] rounded-2xl flex items-start justify-between gap-2.5 cursor-pointer">
                    <div>
                      <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#1d3b2e]">
                        <Flame className="w-3.5 h-3.5 text-orange-500" /> Bonus Streak
                        {playMode === 'MULTIPLAYER' ? ' & Kekompakan' : ''}
                      </span>
                      <p className="text-[11px] text-[#6b7d6c] mt-0.5 leading-snug">
                        Streak 3 memberi tarikan +5, Streak 5 memberi +10 poin tambahan.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={bonusAktif}
                      onChange={(e) => setBonusAktif(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded accent-[#1d3b2e]"
                    />
                  </label>

                  <label className="p-3.5 bg-[#fffdf6] border-2 border-[#e0d5b8] rounded-2xl flex items-start justify-between gap-2.5 cursor-pointer">
                    <div>
                      <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#1d3b2e]">
                        <Zap className="w-3.5 h-3.5 text-sky-600" /> Sistem Power-Up
                      </span>
                      <p className="text-[11px] text-[#6b7d6c] mt-0.5 leading-snug">
                        Semangat (+5), Pertahanan Tahan (-5 lawan), dan Tarikan Super (+10).
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

              <GameConfigFooter
                modeSummary={
                  playMode === 'MULTIPLAYER'
                    ? `Multiplayer Tim (${durasiRonde}dtk/ronde · ±${batasMenangFinal} pt)`
                    : `Solo 1 vs 1 (${namaTim1.trim() || 'Tim Merah'} vs ${
                        namaTim2.trim() || 'Tim Biru'
                      } · ${durasiRonde}dtk)`
                }
                canSubmit={canSubmit}
                submitting={submitting}
                isSolo={playMode === 'SOLO'}
                submitLabel={
                  playMode === 'MULTIPLAYER'
                    ? 'Buat Sesi Multiplayer & Buka Lobi PIN'
                    : 'Mulai Tarik Tambang Solo (1 vs 1)'
                }
              />
            </div>
          </div>
        </GameConfigSection>
      </form>
    </GameConfigPageShell>
  );
}

