import React, { useState } from 'react';
import { Modal } from '../../components';
import {
  Flag,
  Flame,
  Scale,
  ShieldAlert,
  Shield,
  Zap,
  CloudRain,
  AlertTriangle,
  Users,
  Play,
  Sliders,
} from 'lucide-react';

export type PresetJarakBalap = 'pendek' | 'normal' | 'panjang' | 'custom';
export type KesulitanBalap = 'mudah' | 'normal' | 'sulit' | 'custom';
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

export interface KonfigurasiBalapKarungPayload {
  presetJarak: PresetJarakBalap;
  targetJarak: number;
  kesulitan: KesulitanBalap;
  lompatBenar: number;
  turunSalah: number;
  keseimbanganAktif: boolean;
  keseimbanganBenar: number;
  keseimbanganSalah: number;
  bonusStreakAktif: boolean;
  bonusStreak3Jarak: number;
  bonusStreak5Jarak: number;
  bonusStreak3Keseimbangan: number;
  penurunanJatuhJarak: number;
  pemulihanJatuhKeseimbangan: number;
  rintanganAktif: boolean;
  rintanganDipilih: JenisRintanganBalap[];
  peluangRintanganPersen: number;
  probabilitasRintangan: ProbabilitasRintanganBalap;
  penurunanKulitPisang: number;
  bonusLompatanKuat: number;
  penaltiJalanBerlumpur: number;
  maxPeserta: number;
  allowLateJoin: boolean;
}

interface ModalKonfigurasiBalapKarungProps {
  isOpen: boolean;
  onClose: () => void;
  templateJudul: string;
  totalSoal: number;
  onMulai: (config: KonfigurasiBalapKarungPayload) => void;
  loading?: boolean;
}

const JARAK_MAP: Record<Exclude<PresetJarakBalap, 'custom'>, number> = {
  pendek: 50,
  normal: 100,
  panjang: 150,
};

const PRESET_KESULITAN = {
  mudah: {
    label: 'Mudah',
    desc: '+15 m / -3 m • Keseimbangan -10%',
    lompatBenar: 15,
    turunSalah: 3,
    keseimbanganBenar: 5,
    keseimbanganSalah: 10,
  },
  normal: {
    label: 'Normal',
    desc: '+10 m / -3 m • Keseimbangan -20%',
    lompatBenar: 10,
    turunSalah: 3,
    keseimbanganBenar: 5,
    keseimbanganSalah: 20,
  },
  sulit: {
    label: 'Sulit',
    desc: '+7 m / -5 m • Keseimbangan -25%',
    lompatBenar: 7,
    turunSalah: 5,
    keseimbanganBenar: 5,
    keseimbanganSalah: 25,
  },
};

const DAFTAR_RINTANGAN: Array<{
  id: JenisRintanganBalap;
  nama: string;
  ringkas: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'kulit_pisang',
    nama: 'Kulit Pisang',
    ringkas: 'Mengurangi keseimbangan -15%.',
    Icon: AlertTriangle,
  },
  {
    id: 'perisai',
    nama: 'Perisai Keseimbangan',
    ringkas: 'Tahan pengurangan jarak 1x saat jatuh.',
    Icon: Shield,
  },
  {
    id: 'lompatan_kuat',
    nama: 'Lompatan Kuat',
    ringkas: 'Bonus +5 meter di lompatan benar berikutnya.',
    Icon: Zap,
  },
  {
    id: 'jalan_berlumpur',
    nama: 'Jalan Berlumpur',
    ringkas: 'Kurangi lompatan benar berikutnya -5 meter.',
    Icon: CloudRain,
  },
];

export default function ModalKonfigurasiBalapKarung({
  isOpen,
  onClose,
  templateJudul,
  totalSoal,
  onMulai,
  loading = false,
}: ModalKonfigurasiBalapKarungProps) {
  const [presetJarak, setPresetJarak] = useState<PresetJarakBalap>('normal');
  const [targetCustom, setTargetCustom] = useState<number>(100);

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

  const [maxPeserta, setMaxPeserta] = useState<number>(36);
  const [allowLateJoin, setAllowLateJoin] = useState<boolean>(true);

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

  const totalBobotRintangan =
    probabilitasRintangan.kulit_pisang +
    probabilitasRintangan.perisai +
    probabilitasRintangan.lompatan_kuat +
    probabilitasRintangan.jalan_berlumpur;

  const totalBobotDipilih = rintanganDipilih.reduce(
    (sum, k) => sum + (probabilitasRintangan[k] || 0),
    0
  );

  const rintanganValid =
    !rintanganAktif ||
    (rintanganDipilih.length > 0 && totalBobotRintangan === 100 && totalBobotDipilih > 0);

  const targetJarakFinal =
    presetJarak === 'custom' ? Math.min(1000, Math.max(10, targetCustom)) : JARAK_MAP[presetJarak];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rintanganValid || totalSoal <= 0 || loading) return;

    onMulai({
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
      rintanganDipilih,
      peluangRintanganPersen,
      probabilitasRintangan,
      penurunanKulitPisang,
      bonusLompatanKuat,
      penaltiJalanBerlumpur,
      maxPeserta,
      allowLateJoin,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pengaturan Balap Karung Challenge"
      maxWidth="lg"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4 text-[#1d3b2e] max-h-[78vh] overflow-y-auto pr-1"
      >
        {/* Banner Materi */}
        <div className="bg-[#fcf8ed] border border-[#e0d5b8] rounded-xl p-3.5 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7d6c] block">
              Materi Balap Karung Challenge
            </span>
            <p className="font-bold text-sm text-[#1d3b2e] line-clamp-1">{templateJudul}</p>
          </div>
          <span
            className={`px-2.5 py-1 text-xs font-bold rounded-lg shrink-0 ${
              totalSoal > 0 ? 'bg-[#1d3b2e] text-[#f4ecd8]' : 'bg-red-100 text-red-700'
            }`}
          >
            {totalSoal} Soal
          </span>
        </div>

        {totalSoal <= 0 && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
            Template ini belum memiliki soal. Tambahkan minimal 1 soal sebelum memulai sesi.
          </div>
        )}

        {/* 1. Target Jarak */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[#1d3b2e] flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5 text-[#c8362f]" /> Target Jarak Finis
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['pendek', 'normal', 'panjang', 'custom'] as PresetJarakBalap[]).map((p) => {
              const aktif = presetJarak === p;
              const label =
                p === 'pendek'
                  ? 'Pendek (50m)'
                  : p === 'normal'
                  ? 'Normal (100m)'
                  : p === 'panjang'
                  ? 'Panjang (150m)'
                  : 'Custom';
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPresetJarak(p)}
                  className={`p-2.5 rounded-xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                    aktif
                      ? 'bg-[#1d3b2e] border-[#1d3b2e] text-[#f4ecd8]'
                      : 'bg-[#fcf8ed] border-[#e0d5b8] text-[#1d3b2e] hover:border-[#1d3b2e]/50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {presetJarak === 'custom' && (
            <div className="bg-[#f4ecd9] border border-[#e0d5b8] rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
              <span className="font-bold">Masukkan Target Jarak (10–1000 m):</span>
              <input
                type="number"
                min={10}
                max={1000}
                value={targetCustom}
                onChange={(e) => setTargetCustom(Number(e.target.value))}
                className="portal-input py-1 text-center font-mono font-bold w-28"
              />
            </div>
          )}
        </div>

        {/* 2. Tingkat Kesulitan */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[#1d3b2e] flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#c8362f]" /> Tingkat Kesulitan & Lompatan
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['mudah', 'normal', 'sulit', 'custom'] as KesulitanBalap[]).map((key) => {
              const aktif = kesulitan === key;
              const info =
                key === 'custom'
                  ? { label: 'Custom', desc: 'Atur manual semua parameter' }
                  : PRESET_KESULITAN[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pilihPresetKesulitan(key)}
                  className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    aktif
                      ? 'bg-[#1d3b2e] border-[#1d3b2e] text-[#f4ecd8] shadow-sm'
                      : 'bg-[#fcf8ed] border-[#e0d5b8] text-[#1d3b2e] hover:border-[#1d3b2e]/50'
                  }`}
                >
                  <div className="font-extrabold text-xs">{info.label}</div>
                  <div className={`text-[10px] mt-0.5 ${aktif ? 'text-[#cfd9c3]' : 'text-[#6b7d6c]'}`}>
                    {info.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {kesulitan === 'custom' && (
            <div className="bg-[#f4ecd9] border border-[#e0d5b8] rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="font-bold text-[11px] block mb-1">Lompat Benar (m)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={lompatBenar}
                  onChange={(e) => setLompatBenar(Math.min(100, Math.max(1, Number(e.target.value))))}
                  className="portal-input py-1 text-center font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-[11px] block mb-1">Turun Salah (m)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={turunSalah}
                  onChange={(e) => setTurunSalah(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="portal-input py-1 text-center font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-[11px] block mb-1">Jatuh Turun (m)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={penurunanJatuhJarak}
                  onChange={(e) =>
                    setPenurunanJatuhJarak(Math.min(50, Math.max(0, Number(e.target.value))))
                  }
                  className="portal-input py-1 text-center font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-[11px] block mb-1">Keseimbangan Benar (+%)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={keseimbanganBenar}
                  onChange={(e) =>
                    setKeseimbanganBenar(Math.min(50, Math.max(0, Number(e.target.value))))
                  }
                  className="portal-input py-1 text-center font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-[11px] block mb-1">Keseimbangan Salah (-%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={keseimbanganSalah}
                  onChange={(e) =>
                    setKeseimbanganSalah(Math.min(100, Math.max(0, Number(e.target.value))))
                  }
                  className="portal-input py-1 text-center font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-[11px] block mb-1">Pulih Setelah Jatuh (%)</label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={pemulihanJatuhKeseimbangan}
                  onChange={(e) =>
                    setPemulihanJatuhKeseimbangan(
                      Math.min(100, Math.max(10, Number(e.target.value)))
                    )
                  }
                  className="portal-input py-1 text-center font-mono font-bold"
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. Sistem Keseimbangan & Bonus Streak */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 bg-[#fcf8ed] border border-[#e0d5b8] rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-sky-600" /> Sistem Keseimbangan
                </span>
                <p className="text-[11px] text-[#6b7d6c]">
                  Jika 0%, pemain terjatuh (-{penurunanJatuhJarak}m) lalu pulih {pemulihanJatuhKeseimbangan}%.
                </p>
              </div>
              <input
                type="checkbox"
                checked={keseimbanganAktif}
                onChange={(e) => setKeseimbanganAktif(e.target.checked)}
                className="w-4 h-4 rounded accent-[#1d3b2e]"
              />
            </div>
          </div>

          <div className="p-3 bg-[#fcf8ed] border border-[#e0d5b8] rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-500" /> Bonus Streak
                </span>
                <p className="text-[11px] text-[#6b7d6c]">
                  Streak 3: +{bonusStreak3Jarak}m & +{bonusStreak3Keseimbangan}%, Streak 5: +{bonusStreak5Jarak}m.
                </p>
              </div>
              <input
                type="checkbox"
                checked={bonusStreakAktif}
                onChange={(e) => setBonusStreakAktif(e.target.checked)}
                className="w-4 h-4 rounded accent-[#1d3b2e]"
              />
            </div>

            {bonusStreakAktif && kesulitan === 'custom' && (
              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#e0d5b8] text-[11px]">
                <div>
                  <label className="font-semibold block">Streak 3 (m)</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={bonusStreak3Jarak}
                    onChange={(e) => setBonusStreak3Jarak(Math.max(0, Number(e.target.value)))}
                    className="portal-input py-1 text-center font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold block">Streak 5 (m)</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={bonusStreak5Jarak}
                    onChange={(e) => setBonusStreak5Jarak(Math.max(0, Number(e.target.value)))}
                    className="portal-input py-1 text-center font-mono font-bold"
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
                      setBonusStreak3Keseimbangan(Math.min(50, Math.max(0, Number(e.target.value))))
                    }
                    className="portal-input py-1 text-center font-mono font-bold"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Rintangan Opsional */}
        <div className="p-3.5 bg-[#fcf8ed] border border-[#e0d5b8] rounded-xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> Rintangan & Power-Up
              </span>
              <p className="text-[11px] text-[#6b7d6c]">
                Diundi secara adil di server berdasarkan peluang dan bobot valid (100%).
              </p>
            </div>
            <input
              type="checkbox"
              checked={rintanganAktif}
              onChange={(e) => setRintanganAktif(e.target.checked)}
              className="w-4 h-4 rounded accent-[#1d3b2e]"
            />
          </div>

          {rintanganAktif && (
            <div className="space-y-3 pt-2 border-t border-[#e0d5b8]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DAFTAR_RINTANGAN.map((item) => {
                  const aktif = rintanganDipilih.includes(item.id);
                  const IconComponent = item.Icon;
                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border text-xs transition-all space-y-1.5 ${
                        aktif ? 'bg-white border-[#1d3b2e] shadow-xs' : 'bg-[#f4ecd9]/60 border-[#e0d5b8] opacity-70'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleRintangan(item.id)}
                        className="w-full flex items-start gap-2 text-left cursor-pointer"
                      >
                        <IconComponent className="w-4 h-4 shrink-0 mt-0.5 text-[#c8362f]" />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold flex items-center justify-between gap-1">
                            <span>{item.nama}</span>
                            <span className="text-[10px] font-black">{aktif ? 'AKTIF' : 'NONAKTIF'}</span>
                          </div>
                          <p className="text-[10px] text-[#6b7d6c] leading-snug">{item.ringkas}</p>
                        </div>
                      </button>
                      <div className="flex items-center justify-between gap-2 text-[10px] border-t border-[#e0d5b8]/60 pt-1">
                        <span className="font-semibold text-[#6b7d6c]">Bobot peluang (%):</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={probabilitasRintangan[item.id]}
                          onChange={(e) =>
                            setProbabilitasRintangan((prev) => ({
                              ...prev,
                              [item.id]: Math.min(100, Math.max(0, Number(e.target.value))),
                            }))
                          }
                          className="w-16 px-1.5 py-0.5 rounded border border-[#d6c9a9] text-center font-mono font-bold bg-[#fcf8ed]"
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
                      setPeluangRintanganPersen(Math.min(50, Math.max(5, Number(e.target.value))))
                    }
                    className="portal-input py-1 text-center font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Kulit Pisang (-%)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={penurunanKulitPisang}
                    onChange={(e) =>
                      setPenurunanKulitPisang(Math.min(50, Math.max(1, Number(e.target.value))))
                    }
                    className="portal-input py-1 text-center font-mono font-bold"
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
                      setBonusLompatanKuat(Math.min(30, Math.max(1, Number(e.target.value))))
                    }
                    className="portal-input py-1 text-center font-mono font-bold"
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
                      setPenaltiJalanBerlumpur(Math.min(30, Math.max(1, Number(e.target.value))))
                    }
                    className="portal-input py-1 text-center font-mono font-bold"
                  />
                </div>
              </div>

              {!rintanganValid && (
                <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-[11px] font-bold text-red-700">
                  {rintanganDipilih.length === 0
                    ? 'Pilih minimal 1 rintangan.'
                    : totalBobotRintangan !== 100
                    ? `Total bobot keempat rintangan harus tepat 100% (saat ini ${totalBobotRintangan}%).`
                    : 'Total bobot untuk rintangan yang dipilih harus > 0.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. Kapasitas & Late Join */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="font-bold block mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Kapasitas Peserta
            </label>
            <select
              value={maxPeserta}
              onChange={(e) => setMaxPeserta(Number(e.target.value))}
              className="portal-select"
            >
              <option value={12}>Maksimal 12 Siswa</option>
              <option value={24}>Maksimal 24 Siswa</option>
              <option value={30}>Maksimal 30 Siswa</option>
              <option value={36}>Maksimal 36 Siswa</option>
            </select>
          </div>
          <label className="p-3 bg-[#fcf8ed] border border-[#e0d5b8] rounded-xl flex items-center justify-between gap-2 cursor-pointer">
            <div>
              <span className="font-bold block">Izinkan Gabung Susulan</span>
              <span className="text-[11px] text-[#6b7d6c]">Siswa telat tetap bisa masuk</span>
            </div>
            <input
              type="checkbox"
              checked={allowLateJoin}
              onChange={(e) => setAllowLateJoin(e.target.checked)}
              className="w-4 h-4 rounded accent-[#1d3b2e]"
            />
          </label>
        </div>

        <div className="pt-2 border-t border-[#e0d5b8] flex justify-end gap-2">
          <button type="button" onClick={onClose} className="portal-btn ghost sm">
            Batal
          </button>
          <button
            type="submit"
            disabled={loading || totalSoal <= 0 || !rintanganValid}
            className="portal-btn red sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? 'Menyiapkan...' : 'Buka Lobi Balap Karung'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

