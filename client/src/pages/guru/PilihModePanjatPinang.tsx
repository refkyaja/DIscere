import { useState, useEffect } from 'react';
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
  JenisRintangan,
  KesulitanPanjatPinang,
  KonfigurasiPanjatPinangPayload,
} from './ModalKonfigurasiPanjatPinang';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Droplets,
  ExternalLink,
  Flag,
  Flame,
  Gift,
  HandMetal,
  Lock,
  Monitor,
  QrCode,
  Shield,
  ShieldAlert,
  Sliders,
  Trophy,
  UserCheck,
  Users,
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

const PRESET_PANJAT: Record<
  Exclude<KesulitanPanjatPinang, 'custom'>,
  {
    label: string;
    desc: string;
    naikBenar: number;
    turunSalah: number;
    bonusStreak3: number;
    bonusStreak5: number;
  }
> = {
  mudah: {
    label: 'Mudah (Santai)',
    desc: '+15% / -3% • Streak +5/+10%',
    naikBenar: 15,
    turunSalah: 3,
    bonusStreak3: 5,
    bonusStreak5: 10,
  },
  normal: {
    label: 'Normal (Seimbang)',
    desc: '+10% / -5% • Streak +5/+10%',
    naikBenar: 10,
    turunSalah: 5,
    bonusStreak3: 5,
    bonusStreak5: 10,
  },
  sulit: {
    label: 'Sulit (Tantangan)',
    desc: '+7% / -10% • Streak +5/+10%',
    naikBenar: 7,
    turunSalah: 10,
    bonusStreak3: 5,
    bonusStreak5: 10,
  },
};

export default function PilihModePanjatPinang() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTemplateId = searchParams.get('templateId') || '';
  const queryKembali = searchParams.get('kembali') || '/guru';

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetail | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);

  // Parameter Panjat Pinang
  const [kesulitan, setKesulitan] = useState<KesulitanPanjatPinang>('normal');
  const [naikBenar, setNaikBenar] = useState<number>(10);
  const [turunSalah, setTurunSalah] = useState<number>(5);
  const [bonusStreakAktif, setBonusStreakAktif] = useState<boolean>(true);
  const [bonusStreak3, setBonusStreak3] = useState<number>(5);
  const [bonusStreak5, setBonusStreak5] = useState<number>(10);

  const [rintanganAktif, setRintanganAktif] = useState<boolean>(true);
  const [rintanganDipilih, setRintanganDipilih] = useState<JenisRintangan[]>([
    'tiang_licin',
    'kulit_pisang',
    'pegangan_kuat',
    'hadiah_kejutan',
  ]);
  const [penurunanTiangLicin, setPenurunanTiangLicin] = useState<number>(5);
  const [bonusPeganganKuat, setBonusPeganganKuat] = useState<number>(5);
  const [hadiahKejutanMode, setHadiahKejutanMode] = useState<'posisi' | 'poin'>('posisi');
  const [hadiahKejutanNilai, setHadiahKejutanNilai] = useState<number>(5);
  const [peluangRintanganPersen, setPeluangRintanganPersen] = useState<number>(25);

  const [maxPeserta, setMaxPeserta] = useState<number>(100);
  const [allowLateJoin, setAllowLateJoin] = useState<boolean>(true);
  const [showAdvancedRules, setShowAdvancedRules] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    async function loadTemplate() {
      if (!queryTemplateId) {
        setSelectedTemplate(null);
        setErrorPesan(
          'Template kuis belum dipilih. Silakan pilih kuis Panjat Pinang dari Dashboard atau Papan Tulis terlebih dahulu.'
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
        if (tmpl.game && tmpl.game !== 'panjat_pinang') {
          setSelectedTemplate(null);
          setErrorPesan(
            `Template "${tmpl.judul}" bukan diperuntukkan untuk Panjat Pinang Challenge.`
          );
          return;
        }

        setSelectedTemplate(tmpl);
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

  const rintanganValid = !rintanganAktif || rintanganDipilih.length > 0;
  const canSubmit =
    Boolean(selectedTemplate) && jumlahSoal > 0 && rintanganValid && !submitting;

  const pilihPresetKesulitan = (mode: KesulitanPanjatPinang) => {
    setKesulitan(mode);
    if (mode !== 'custom') {
      const p = PRESET_PANJAT[mode];
      setNaikBenar(p.naikBenar);
      setTurunSalah(p.turunSalah);
      setBonusStreak3(p.bonusStreak3);
      setBonusStreak5(p.bonusStreak5);
    }
  };

  const toggleRintanganItem = (jenis: JenisRintangan) => {
    setRintanganDipilih((prev) =>
      prev.includes(jenis) ? prev.filter((item) => item !== jenis) : [...prev, jenis]
    );
  };

  const daftarRintangan: Array<{
    id: JenisRintangan;
    nama: string;
    ringkas: string;
    Icon: typeof Droplets;
  }> = [
    {
      id: 'tiang_licin',
      nama: 'Tiang Licin',
      ringkas: `Bila salah berikutnya, turun ekstra -${penurunanTiangLicin}%.`,
      Icon: Droplets,
    },
    {
      id: 'kulit_pisang',
      nama: 'Kulit Pisang',
      ringkas: 'Memicu soal bonus untuk memperoleh 1x perisai pelindung.',
      Icon: Shield,
    },
    {
      id: 'pegangan_kuat',
      nama: 'Pegangan Kuat',
      ringkas: `Bonus naik ekstra +${bonusPeganganKuat}% di jawaban benar berikutnya.`,
      Icon: HandMetal,
    },
    {
      id: 'hadiah_kejutan',
      nama: 'Hadiah Kejutan',
      ringkas:
        hadiahKejutanMode === 'posisi'
          ? `Memberikan dorongan ketinggian +${hadiahKejutanNilai}% sekali pakai.`
          : `Memberikan bonus +${hadiahKejutanNilai} poin tambahan.`,
      Icon: Gift,
    },
  ];

  const handleMulaiPermainan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedTemplate) return;

    try {
      setSubmitting(true);
      setErrorPesan(null);

      const panjatPinangConfig: KonfigurasiPanjatPinangPayload = {
        kesulitan,
        naikBenar: Math.max(1, Math.min(50, Math.round(naikBenar) || 10)),
        turunSalah: Math.max(0, Math.min(50, Math.round(turunSalah) || 0)),
        bonusStreakAktif,
        bonusStreak3: Math.max(0, Math.min(50, Math.round(bonusStreak3) || 0)),
        bonusStreak5: Math.max(0, Math.min(50, Math.round(bonusStreak5) || 0)),
        rintanganAktif: rintanganAktif && rintanganDipilih.length > 0,
        rintanganDipilih,
        penurunanTiangLicin: Math.max(1, Math.min(30, Math.round(penurunanTiangLicin) || 5)),
        bonusPeganganKuat: Math.max(1, Math.min(30, Math.round(bonusPeganganKuat) || 5)),
        hadiahKejutanMode,
        hadiahKejutanNilai:
          hadiahKejutanMode === 'posisi'
            ? Math.max(1, Math.min(50, Math.round(hadiahKejutanNilai) || 5))
            : Math.max(1, Math.min(500, Math.round(hadiahKejutanNilai) || 50)),
        peluangRintanganPersen: Math.max(5, Math.min(60, Math.round(peluangRintanganPersen) || 25)),
        maxPeserta,
        allowLateJoin,
      };

      const res = await apiRequest<{ session: { id: string } }>('/sesi', {
        method: 'POST',
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          game: 'panjat_pinang',
          mode: 'multi',
          panjatPinangConfig,
        }),
      });

      const backTarget = `/guru/panjat-pinang?templateId=${encodeURIComponent(
        selectedTemplate.id
      )}&kembali=${encodeURIComponent(queryKembali)}`;
      navigate(`/guru/sesi/${res.session.id}?kembali=${encodeURIComponent(backTarget)}`);
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal membuat sesi Panjat Pinang Challenge.'));
    } finally {
      setSubmitting(false);
    }
  };

  const labelKesulitan =
    kesulitan === 'custom' ? 'Kustom' : PRESET_PANJAT[kesulitan].label;

  const statusLanjutan =
    bonusStreakAktif && rintanganAktif
      ? 'Aktif Semua'
      : bonusStreakAktif || rintanganAktif
      ? 'Aktif Sebagian'
      : 'Nonaktif';

  return (
    <GameConfigPageShell
      loading={loadingTemplate}
      loadingText="Menyiapkan Pengaturan Panjat Pinang..."
      title="Panjat Pinang Challenge"
      subtitle="Atur pergerakan tiang, kapasitas peserta, bonus streak, dan rintangan sebelum memulai lomba."
      onBack={() => navigate(queryKembali)}
      errorMessage={errorPesan}
      templateTitle={selectedTemplate?.judul}
      isOfficialTemplate={Boolean(selectedTemplate?.resmi)}
      questionCount={jumlahSoal}
      missingTemplateMessage="Tidak dapat memuat pengaturan karena materi kuis Panjat Pinang belum tersedia."
    >
      <form onSubmit={handleMulaiPermainan} className="space-y-6">
        {/* 1. Pilih Mode Permainan */}
        <GameConfigSection
          title="1. Pilih Mode Permainan"
          description="Panjat Pinang mempertandingkan seluruh siswa secara individu lewat HP masing-masing menuju puncak tiang 100%."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <GameModeCard
              selected={true}
              variant="green"
              badgeIcon={<Users className="w-3.5 h-3.5" />}
              badgeLabel="Multiplayer Individu"
              title="Siswa Bermain di HP • Lomba Panjat 100%"
              description="Guru membuka PIN & QR Code untuk ruang lomba. Setiap siswa memanjat tiangnya sendiri dari HP dan bersaing menuju puncak 100% di layar proyektor."
              features={[
                { icon: <QrCode className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'PIN & QR Gabung' },
                { icon: <Users className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'Tiang Per Individu' },
                { icon: <Trophy className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'Podium & Peringkat Live' },
                { icon: <Flag className="w-3.5 h-3.5 text-[#f2c230]" />, label: 'Heatmap Analisis Soal' },
              ]}
            />

            <GameModeCard
              selected={false}
              variant="red"
              disabled={true}
              badgeIcon={<Monitor className="w-3.5 h-3.5" />}
              badgeLabel="Solo Mode • Belum Tersedia"
              rightBadge={
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#f4ecd9] text-[#6b7d6c] border border-[#d7caa7]">
                  <Lock className="w-3 h-3" /> Khusus Multiplayer
                </span>
              }
              title="Khusus Lomba Individu via HP Siswa"
              description="Mode Solo satu perangkat tidak tersedia untuk Panjat Pinang. Gunakan mode Multiplayer Individu agar setiap siswa dapat berlomba dari perangkat masing-masing."
              features={[
                { icon: <Users className="w-3.5 h-3.5" />, label: 'Hingga 200 Peserta' },
                { icon: <Flame className="w-3.5 h-3.5" />, label: 'Bonus Streak 3 & 5' },
                { icon: <ShieldAlert className="w-3.5 h-3.5" />, label: '4 Rintangan & Kejutan' },
                { icon: <Clock className="w-3.5 h-3.5" />, label: 'Tanpa Timer Global' },
              ]}
            />
          </div>
        </GameConfigSection>

        {/* 2. Pengaturan Aturan & Tiang */}
        <GameConfigSection
          title="2. Pengaturan Aturan & Tiang"
          description="Sesuaikan kapasitas peserta, kecepatan memanjat, bonus streak, dan rintangan kejutan di tiang pinang."
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Kolom Kiri: Target Puncak & Peserta */}
            <div className="lg:col-span-5 space-y-5">
              {/* Target Puncak Tiang */}
              <div className="portal-card p-5 space-y-4">
                <GameConfigCardHeader
                  icon={<Flag className="w-4 h-4 text-[#c8362f]" />}
                  title="Target Puncak Tiang"
                  tagLabel="100 %"
                  tagColor="yellow"
                />

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { pct: '0%', label: 'Mulai Bawah' },
                    { pct: '50%', label: 'Tengah Tiang' },
                    { pct: '100%', label: 'Puncak Juara' },
                  ].map((tier, idx) => (
                    <div
                      key={tier.pct}
                      className={`py-2.5 px-2 rounded-xl border-2 text-center ${
                        idx === 2
                          ? 'bg-[#c8362f] text-[#f4ecd8] border-[#c8362f]'
                          : 'bg-[#fffdf6] text-[#1d3b2e] border-[#e0d5b8]'
                      }`}
                    >
                      <div className="font-mono font-extrabold text-sm">{tier.pct}</div>
                      <div
                        className={`text-[10px] font-bold mt-0.5 ${
                          idx === 2 ? 'text-[#f4ecd8]/90' : 'text-[#6b7d6c]'
                        }`}
                      >
                        {tier.label}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-[#f4ecd9] border border-dashed border-[#d7caa7] text-xs text-[#6b7d6c] flex items-center justify-between">
                  <span>Garis puncak ditetapkan pada:</span>
                  <strong className="text-[#1d3b2e] font-mono text-sm">100% ketinggian</strong>
                </div>
              </div>

              {/* Pengaturan Peserta & Lobi */}
              <div className="portal-card p-5 space-y-4">
                <GameConfigCardHeader
                  icon={<UserCheck className="w-4 h-4 text-[#1d3b2e]" />}
                  title="Pengaturan Peserta & Lobi"
                  tagLabel={`${maxPeserta} Siswa`}
                  tagColor="green"
                />

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#6b7d6c] block mb-1.5">
                    Maksimal Peserta (1–200 siswa)
                  </label>
                  <select
                    value={maxPeserta}
                    onChange={(e) => setMaxPeserta(Number(e.target.value))}
                    className="portal-select font-bold"
                  >
                    <option value={40}>Maksimal 40 Siswa (1 Kelas)</option>
                    <option value={60}>Maksimal 60 Siswa (Kelas Besar)</option>
                    <option value={100}>Maksimal 100 Siswa (Standar)</option>
                    <option value={200}>Maksimal 200 Siswa (Maksimum)</option>
                  </select>
                </div>

                <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#fffdf6] border-2 border-[#e0d5b8] cursor-pointer">
                  <div>
                    <div className="text-xs font-extrabold text-[#1d3b2e]">
                      Izinkan Gabung Susulan
                    </div>
                    <div className="text-[11px] text-[#6b7d6c]">
                      Siswa yang terlambat tetap dapat bergabung walau lomba sudah berjalan
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
            </div>

            {/* Kolom Kanan: Pergerakan Tiang, Kesulitan & Pengaturan Lanjutan */}
            <div className="lg:col-span-7 portal-card p-5 sm:p-6 space-y-5">
              <GameConfigCardHeader
                icon={<Sliders className="w-4 h-4 text-[#c8362f]" />}
                title="Pergerakan Tiang & Aturan Panjat"
                tagLabel={`+${naikBenar}% / -${turunSalah}%`}
                tagColor="green"
              />

              {/* Informasi Timer Fleksibel */}
              <div className="p-4 rounded-2xl bg-[#fffdf6] border-2 border-[#e0d5b8] space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#1d3b2e]">
                    <Clock className="w-4 h-4 text-[#c8362f]" /> Durasi Permainan
                  </span>
                  <span className="text-[11px] font-bold text-[#6b7d6c]">
                    Fleksibel • Tanpa batas waktu global
                  </span>
                </div>
                <p className="text-[11px] text-[#6b7d6c] leading-relaxed">
                  Konfigurasi dikunci saat sesi dimulai dan lomba berjalan terus hingga seluruh siswa
                  mencapai 100% atau guru menekan <strong className="text-[#1d3b2e]">Akhiri Lomba</strong>.
                </p>
              </div>

              {/* Ringkasan Mekanika */}
              <div className="p-3.5 rounded-2xl bg-[#f4ecd9]/80 border border-dashed border-[#d7caa7] text-xs text-[#1d3b2e] leading-relaxed">
                <strong>Mekanika Panjat Pinang:</strong> Setiap jawaban benar menaikkan posisi
                sejauh <strong className="font-mono">+{naikBenar}%</strong>; jawaban salah
                meluncur turun <strong className="font-mono">-{turunSalah}%</strong>. Urutan soal
                diacak setiap siswa tanpa pengulangan berturut-turut.
              </div>

              {/* Tingkat Kesulitan & Pergerakan */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#1d3b2e]">
                    Kecepatan Naik &amp; Turun Tiang
                  </span>
                  <span className="text-[11px] font-bold text-[#6b7d6c]">{labelKesulitan}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(['mudah', 'normal', 'sulit', 'custom'] as KesulitanPanjatPinang[]).map(
                    (key) => {
                      const active = kesulitan === key;
                      const info =
                        key === 'custom'
                          ? { label: 'Kustom', desc: 'Atur semua parameter' }
                          : PRESET_PANJAT[key];
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
                    }
                  )}
                </div>

                {kesulitan === 'custom' && (
                  <div className="bg-[#fffdf6] border-2 border-[#e0d5b8] rounded-2xl p-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-[11px] block mb-1">
                        Naik Jawaban Benar (+%)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={naikBenar}
                        onChange={(e) =>
                          setNaikBenar(Math.min(50, Math.max(1, Number(e.target.value) || 1)))
                        }
                        className="portal-input text-center font-mono font-bold py-1.5"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[11px] block mb-1">
                        Turun Jawaban Salah (-%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={turunSalah}
                        onChange={(e) =>
                          setTurunSalah(Math.min(50, Math.max(0, Number(e.target.value) || 0)))
                        }
                        className="portal-input text-center font-mono font-bold py-1.5"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Pengaturan Lanjutan (Bonus Streak & Rintangan) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedRules((prev) => !prev)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-dashed border-[#d7caa7] bg-[#fcf8ed] hover:bg-[#f4ecd8] text-xs font-extrabold text-[#1d3b2e] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-[#c8362f]" />
                    Pengaturan Lanjutan (Bonus Streak &amp; Sistem Rintangan)
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
                <div className="space-y-4">
                  {/* Bonus Streak */}
                  <div className="p-3.5 bg-[#fffdf6] border-2 border-[#e0d5b8] rounded-2xl space-y-2.5">
                    <label className="flex items-start justify-between gap-2.5 cursor-pointer">
                      <div>
                        <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#1d3b2e]">
                          <Flame className="w-3.5 h-3.5 text-orange-500" /> Bonus Streak Berturut-turut
                        </span>
                        <p className="text-[11px] text-[#6b7d6c] mt-0.5 leading-snug">
                          Streak 3 (+{bonusStreak3}%) dan Streak 5 (+{bonusStreak5}%) per rangkaian benar.
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
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed border-[#e0d5b8] text-[11px]">
                        <div>
                          <label className="font-semibold block mb-1">Bonus Streak 3 (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={bonusStreak3}
                            onChange={(e) =>
                              setBonusStreak3(Math.min(50, Math.max(0, Number(e.target.value) || 0)))
                            }
                            className="w-full px-2 py-1 rounded bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-semibold block mb-1">Bonus Streak 5 (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={bonusStreak5}
                            onChange={(e) =>
                              setBonusStreak5(Math.min(50, Math.max(0, Number(e.target.value) || 0)))
                            }
                            className="w-full px-2 py-1 rounded bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sistem Rintangan & Kejutan */}
                  <div className="p-4 bg-[#fffdf6] border-2 border-[#e0d5b8] rounded-2xl space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#1d3b2e]">
                          <ShieldAlert className="w-4 h-4 text-[#c8362f]" /> Rintangan &amp; Kejutan Tiang
                        </span>
                        <p className="text-[11px] text-[#6b7d6c]">
                          Diundi otomatis oleh server selama pendakian berlangsung.
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
                          {daftarRintangan.map((item) => {
                            const aktif = rintanganDipilih.includes(item.id);
                            const IconComponent = item.Icon;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => toggleRintanganItem(item.id)}
                                className={`p-2.5 rounded-xl border text-xs text-left transition-all flex items-start gap-2 cursor-pointer ${
                                  aktif
                                    ? 'bg-[#fcf8ed] border-[#1d3b2e] shadow-xs'
                                    : 'bg-[#f4ecd9]/50 border-[#e0d5b8] opacity-75'
                                }`}
                              >
                                <IconComponent className="w-4 h-4 shrink-0 mt-0.5 text-[#c8362f]" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold flex items-center justify-between gap-1">
                                    <span>{item.nama}</span>
                                    <span className="text-[10px] font-black">
                                      {aktif ? 'AKTIF' : 'NONAKTIF'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[#6b7d6c] leading-snug">
                                    {item.ringkas}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <label className="font-bold block mb-1">Peluang Muncul (%)</label>
                            <select
                              value={peluangRintanganPersen}
                              onChange={(e) => setPeluangRintanganPersen(Number(e.target.value))}
                              className="w-full px-2 py-1.5 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] font-bold"
                            >
                              <option value={15}>15% (Jarang)</option>
                              <option value={25}>25% (Seimbang)</option>
                              <option value={35}>35% (Seru)</option>
                              <option value={50}>50% (Ramai)</option>
                            </select>
                          </div>

                          {rintanganDipilih.includes('tiang_licin') && (
                            <div>
                              <label className="font-bold block mb-1">Tiang Licin (-%)</label>
                              <input
                                type="number"
                                min={1}
                                max={30}
                                value={penurunanTiangLicin}
                                onChange={(e) =>
                                  setPenurunanTiangLicin(
                                    Math.min(30, Math.max(1, Number(e.target.value) || 1))
                                  )
                                }
                                className="w-full px-2 py-1 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                              />
                            </div>
                          )}

                          {rintanganDipilih.includes('pegangan_kuat') && (
                            <div>
                              <label className="font-bold block mb-1">Pegangan Kuat (+%)</label>
                              <input
                                type="number"
                                min={1}
                                max={30}
                                value={bonusPeganganKuat}
                                onChange={(e) =>
                                  setBonusPeganganKuat(
                                    Math.min(30, Math.max(1, Number(e.target.value) || 1))
                                  )
                                }
                                className="w-full px-2 py-1 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                              />
                            </div>
                          )}
                        </div>

                        {rintanganDipilih.includes('hadiah_kejutan') && (
                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                            <div>
                              <label className="font-bold block mb-1">Jenis Hadiah Kejutan</label>
                              <select
                                value={hadiahKejutanMode}
                                onChange={(e) => {
                                  const mode = e.target.value as 'posisi' | 'poin';
                                  setHadiahKejutanMode(mode);
                                  setHadiahKejutanNilai(mode === 'posisi' ? 5 : 50);
                                }}
                                className="w-full px-2 py-1.5 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] font-bold"
                              >
                                <option value="posisi">Bonus Ketinggian (%)</option>
                                <option value="poin">Bonus Poin Tambahan</option>
                              </select>
                            </div>
                            <div>
                              <label className="font-bold block mb-1">
                                Nilai Hadiah ({hadiahKejutanMode === 'posisi' ? '%' : 'poin'})
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={hadiahKejutanMode === 'posisi' ? 50 : 500}
                                value={hadiahKejutanNilai}
                                onChange={(e) =>
                                  setHadiahKejutanNilai(
                                    Math.max(1, Number(e.target.value) || 1)
                                  )
                                }
                                className="w-full px-2 py-1 rounded-lg bg-[#fcf8ed] border border-[#e0d5b8] text-center font-mono font-bold"
                              />
                            </div>
                          </div>
                        )}

                        {!rintanganValid && (
                          <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-[11px] font-bold text-red-700">
                            Pilih minimal 1 rintangan yang aktif, atau nonaktifkan sakelar rintangan di atas.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
                modeSummary={`Multiplayer Individu (${labelKesulitan} · +${naikBenar}% / -${turunSalah}%)`}
                canSubmit={canSubmit}
                submitting={submitting}
                isSolo={false}
                submitLabel="Buat Sesi Multiplayer & Buka Lobi PIN"
              />
            </div>
          </div>
        </GameConfigSection>
      </form>
    </GameConfigPageShell>
  );
}

