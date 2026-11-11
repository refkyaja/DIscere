import React, { useState } from 'react';
import { Modal } from '../../components';
import {
  Flame,
  ShieldAlert,
  Users,
  Droplets,
  Shield,
  HandMetal,
  Gift,
  Play,
  Sliders,
} from 'lucide-react';

export type KesulitanPanjatPinang = 'mudah' | 'normal' | 'sulit' | 'custom';
export type JenisRintangan =
  | 'tiang_licin'
  | 'kulit_pisang'
  | 'pegangan_kuat'
  | 'hadiah_kejutan';

export interface KonfigurasiPanjatPinangPayload {
  kesulitan: KesulitanPanjatPinang;
  naikBenar: number;
  turunSalah: number;
  bonusStreakAktif: boolean;
  bonusStreak3: number;
  bonusStreak5: number;
  rintanganAktif: boolean;
  rintanganDipilih: JenisRintangan[];
  penurunanTiangLicin: number;
  bonusPeganganKuat: number;
  hadiahKejutanMode: 'posisi' | 'poin';
  hadiahKejutanNilai: number;
  peluangRintanganPersen: number;
  maxPeserta: number;
  allowLateJoin: boolean;
}

interface ModalKonfigurasiPanjatPinangProps {
  isOpen: boolean;
  onClose: () => void;
  templateJudul: string;
  totalSoal: number;
  onMulai: (config: KonfigurasiPanjatPinangPayload) => void;
  loading?: boolean;
}

const PRESET_PANJAT: Record<
  'mudah' | 'normal' | 'sulit',
  { naikBenar: number; turunSalah: number; bonusStreak3: number; bonusStreak5: number }
> = {
  mudah: { naikBenar: 15, turunSalah: 3, bonusStreak3: 5, bonusStreak5: 10 },
  normal: { naikBenar: 10, turunSalah: 5, bonusStreak3: 5, bonusStreak5: 10 },
  sulit: { naikBenar: 7, turunSalah: 10, bonusStreak3: 5, bonusStreak5: 10 },
};

const RINTANGAN_OPTIONS: Array<{
  id: JenisRintangan;
  nama: string;
  deskripsi: string;
  ikon: React.ReactNode;
}> = [
  {
    id: 'tiang_licin',
    nama: 'Tiang Licin',
    deskripsi: 'Jika terkena efek dan menjawab salah, pemain turun tambahan (default -5%).',
    ikon: <Droplets className="w-4 h-4 text-sky-600" />,
  },
  {
    id: 'kulit_pisang',
    nama: 'Kulit Pisang',
    deskripsi: 'Memicu soal bonus. Jawab benar memberi perisai pelindung 1 efek turun tambahan.',
    ikon: <Shield className="w-4 h-4 text-emerald-600" />,
  },
  {
    id: 'pegangan_kuat',
    nama: 'Pegangan Kuat',
    deskripsi: 'Jawaban benar berikutnya memperoleh bonus kenaikan tambahan +5% (1 kali pakai).',
    ikon: <HandMetal className="w-4 h-4 text-amber-600" />,
  },
  {
    id: 'hadiah_kejutan',
    nama: 'Hadiah Kejutan',
    deskripsi: 'Memberikan bonus posisi atau poin sekali pakai sesuai pengaturan guru.',
    ikon: <Gift className="w-4 h-4 text-[#D7262E]" />,
  },
];

export default function ModalKonfigurasiPanjatPinang({
  isOpen,
  onClose,
  templateJudul,
  totalSoal,
  onMulai,
  loading = false,
}: ModalKonfigurasiPanjatPinangProps) {
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

  const pilihPreset = (mode: KesulitanPanjatPinang) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalSoal <= 0) return;

    onMulai({
      kesulitan,
      naikBenar: Math.max(1, Math.min(50, naikBenar)),
      turunSalah: Math.max(0, Math.min(50, turunSalah)),
      bonusStreakAktif,
      bonusStreak3: Math.max(0, Math.min(50, bonusStreak3)),
      bonusStreak5: Math.max(0, Math.min(50, bonusStreak5)),
      rintanganAktif: rintanganAktif && rintanganDipilih.length > 0,
      rintanganDipilih,
      penurunanTiangLicin: Math.max(1, Math.min(30, penurunanTiangLicin)),
      bonusPeganganKuat: Math.max(1, Math.min(30, bonusPeganganKuat)),
      hadiahKejutanMode,
      hadiahKejutanNilai:
        hadiahKejutanMode === 'posisi'
          ? Math.max(1, Math.min(50, hadiahKejutanNilai))
          : Math.max(1, Math.min(500, hadiahKejutanNilai)),
      peluangRintanganPersen: Math.max(5, Math.min(60, peluangRintanganPersen)),
      maxPeserta,
      allowLateJoin,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pengaturan Lomba Panjat Pinang"
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
              Materi Lomba Panjat Pinang
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

        {/* 1. Tingkat Kesulitan & Nilai Naik/Turun */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-[#D7262E]" /> Tingkat Kesulitan & Pergerakan Tiang
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { id: 'mudah', label: 'Mudah', desc: '+15% / -3%' },
                { id: 'normal', label: 'Normal', desc: '+10% / -5%' },
                { id: 'sulit', label: 'Sulit', desc: '+7% / -10%' },
                { id: 'custom', label: 'Custom', desc: 'Atur Sendiri' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => pilihPreset(opt.id)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  kesulitan === opt.id
                    ? 'bg-[#1d3b2e] text-white border-[#1d3b2e] shadow-sm'
                    : 'bg-white text-[#1d3b2e] border-[#e0d5b8] hover:bg-[#f7f2e4]'
                }`}
              >
                <div className="text-xs font-black">{opt.label}</div>
                <div
                  className={`text-[10px] font-semibold mt-0.5 ${
                    kesulitan === opt.id ? 'text-[#f2c230]' : 'text-[#6b7d6c]'
                  }`}
                >
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>

          {/* Detail nilai & input custom */}
          <div className="grid grid-cols-2 gap-3 bg-[#fcf8ed] border border-[#e0d5b8] p-3 rounded-xl">
            <div>
              <label className="text-[11px] font-bold block mb-1">
                Kenaikan Jawaban Benar (%)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={naikBenar}
                disabled={kesulitan !== 'custom'}
                onChange={(e) => {
                  setKesulitan('custom');
                  setNaikBenar(Number(e.target.value) || 1);
                }}
                className="w-full p-2 bg-white border border-[#e0d5b8] rounded-lg text-xs font-mono font-bold disabled:bg-[#f4ecd8]"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold block mb-1">
                Penurunan Jawaban Salah (%)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={turunSalah}
                disabled={kesulitan !== 'custom'}
                onChange={(e) => {
                  setKesulitan('custom');
                  setTurunSalah(Math.max(0, Number(e.target.value) || 0));
                }}
                className="w-full p-2 bg-white border border-[#e0d5b8] rounded-lg text-xs font-mono font-bold disabled:bg-[#f4ecd8]"
              />
            </div>
          </div>
        </div>

        {/* 2. Pengaturan Bonus Streak */}
        <div className="bg-[#fcf8ed] border border-[#e0d5b8] p-3.5 rounded-xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-600" />
              <div>
                <div className="text-xs font-bold">Sistem Bonus Streak Berturut-turut</div>
                <div className="text-[11px] text-[#6b7d6c]">
                  Streak 3 (+{bonusStreak3}%) dan Streak 5 (+{bonusStreak5}%) per rangkaian benar.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBonusStreakAktif((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                bonusStreakAktif
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {bonusStreakAktif ? 'Aktif' : 'Nonaktif'}
            </button>
          </div>

          {bonusStreakAktif && kesulitan === 'custom' && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#e0d5b8]">
              <div>
                <label className="text-[11px] font-bold block mb-1">Bonus Streak 3 (%)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={bonusStreak3}
                  onChange={(e) => setBonusStreak3(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full p-1.5 bg-white border border-[#e0d5b8] rounded-lg text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1">Bonus Streak 5 (%)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={bonusStreak5}
                  onChange={(e) => setBonusStreak5(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full p-1.5 bg-white border border-[#e0d5b8] rounded-lg text-xs font-mono font-bold"
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. Pengaturan Rintangan Opsional */}
        <div className="bg-[#fcf8ed] border border-[#e0d5b8] p-3.5 rounded-xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#D7262E]" />
              <div>
                <div className="text-xs font-bold">Sistem Rintangan & Kejutan (Opsional)</div>
                <div className="text-[11px] text-[#6b7d6c]">
                  Tambahkan tantangan seru yang ditentukan penuh oleh server.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRintanganAktif((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                rintanganAktif ? 'bg-[#D7262E] text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {rintanganAktif ? 'Aktif' : 'Nonaktif'}
            </button>
          </div>

          {rintanganAktif && (
            <div className="space-y-3 pt-2 border-t border-[#e0d5b8]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RINTANGAN_OPTIONS.map((item) => {
                  const checked = rintanganDipilih.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                        checked
                          ? 'bg-white border-[#1d3b2e] shadow-sm'
                          : 'bg-[#f4ecd8]/50 border-[#e0d5b8] opacity-70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRintanganItem(item.id)}
                        className="mt-1 accent-[#1d3b2e]"
                      />
                      <div className="space-y-0.5 text-xs">
                        <div className="font-bold flex items-center gap-1.5">
                          {item.ikon}
                          <span>{item.nama}</span>
                        </div>
                        <p className="text-[10px] text-[#6b7d6c] leading-snug">
                          {item.deskripsi}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {rintanganDipilih.length === 0 && (
                <p className="text-[11px] font-bold text-[#c8362f]">
                  Pilih minimal 1 rintangan agar sistem rintangan aktif, atau matikan sakelar di atas.
                </p>
              )}

              {/* Pengaturan detail rintangan terpilih */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {rintanganDipilih.includes('tiang_licin') && (
                  <div>
                    <label className="text-[10px] font-bold block mb-1">
                      Turun Ekstra Tiang Licin (%)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={penurunanTiangLicin}
                      onChange={(e) => setPenurunanTiangLicin(Number(e.target.value) || 5)}
                      className="w-full p-1.5 bg-white border border-[#e0d5b8] rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                )}
                {rintanganDipilih.includes('pegangan_kuat') && (
                  <div>
                    <label className="text-[10px] font-bold block mb-1">
                      Bonus Pegangan Kuat (%)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={bonusPeganganKuat}
                      onChange={(e) => setBonusPeganganKuat(Number(e.target.value) || 5)}
                      className="w-full p-1.5 bg-white border border-[#e0d5b8] rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold block mb-1">
                    Peluang Muncul (%)
                  </label>
                  <select
                    value={peluangRintanganPersen}
                    onChange={(e) => setPeluangRintanganPersen(Number(e.target.value))}
                    className="w-full p-1.5 bg-white border border-[#e0d5b8] rounded-lg text-xs font-bold"
                  >
                    <option value={15}>15% (Jarang)</option>
                    <option value={25}>25% (Seimbang)</option>
                    <option value={35}>35% (Seru)</option>
                  </select>
                </div>
              </div>

              {rintanganDipilih.includes('hadiah_kejutan') && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold block mb-1">
                      Jenis Hadiah Kejutan
                    </label>
                    <select
                      value={hadiahKejutanMode}
                      onChange={(e) => {
                        const mode = e.target.value as 'posisi' | 'poin';
                        setHadiahKejutanMode(mode);
                        setHadiahKejutanNilai(mode === 'posisi' ? 5 : 50);
                      }}
                      className="w-full p-1.5 bg-white border border-[#e0d5b8] rounded-lg text-xs font-bold"
                    >
                      <option value="posisi">Bonus Ketinggian (%)</option>
                      <option value="poin">Bonus Poin Tambahan</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block mb-1">
                      Nilai Hadiah ({hadiahKejutanMode === 'posisi' ? '%' : 'poin'})
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={hadiahKejutanMode === 'posisi' ? 50 : 500}
                      value={hadiahKejutanNilai}
                      onChange={(e) => setHadiahKejutanNilai(Number(e.target.value) || 5)}
                      className="w-full p-1.5 bg-white border border-[#e0d5b8] rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Kapasitas Peserta & Gabung Susulan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-[#fcf8ed] border border-[#e0d5b8] p-3 rounded-xl">
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#1d3b2e]" /> Kapasitas Siswa
            </label>
            <select
              value={maxPeserta}
              onChange={(e) => setMaxPeserta(Number(e.target.value))}
              className="w-full p-2 bg-white border border-[#e0d5b8] rounded-lg text-xs font-bold text-[#1d3b2e]"
            >
              <option value={40}>40 Siswa (1 Kelas)</option>
              <option value={60}>60 Siswa (Kelas Besar)</option>
              <option value={100}>100 Siswa (Standar)</option>
              <option value={200}>200 Siswa (Maksimum)</option>
            </select>
          </div>

          <div className="bg-[#fcf8ed] border border-[#e0d5b8] p-3 rounded-xl flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold flex items-center gap-1.5">
                Gabung Susulan
              </div>
              <p className="text-[10px] text-[#6b7d6c]">
                Izinkan siswa masuk walau lomba sudah mulai
              </p>
            </div>
            <input
              type="checkbox"
              checked={allowLateJoin}
              onChange={(e) => setAllowLateJoin(e.target.checked)}
              className="w-4 h-4 accent-[#1d3b2e] cursor-pointer"
            />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] font-semibold text-amber-900">
          Catatan: Konfigurasi akan dikunci sebagai snapshot saat sesi dimulai dan permainan berlangsung tanpa timer global sampai seluruh siswa mencapai 100% atau Anda menekan Akhiri Permainan.
        </div>

        {/* Tombol Aksi */}
        <div className="flex justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 border border-[#e0d5b8] rounded-xl text-xs font-bold text-[#1d3b2e] hover:bg-[#f7f2e4] cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading || totalSoal <= 0}
            className="px-5 py-2.5 bg-[#D7262E] hover:bg-[#b81e25] disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{loading ? 'Menyiapkan Sesi...' : 'Buat Sesi Panjat Pinang'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
