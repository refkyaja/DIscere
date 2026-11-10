import { useState, useMemo, useEffect } from 'react';
import { Modal } from '../../components';
import {
  Sparkles,
  Target,
  Play,
  AlertTriangle,
  CheckCircle2,
  Monitor,
  Users,
  Sliders,
  UserCheck,
} from 'lucide-react';

export type PlayModeKerupuk = 'SOLO' | 'MULTIPLAYER';

export interface ProbabilitasConfig {
  besar: number;
  sedang: number;
  kecil: number;
  sangat_kecil: number;
  zonk: number;
}

export type KesulitanKerupuk = 'mudah' | 'normal' | 'sulit' | 'custom';
export type TargetKerupukPreset = '50' | '100' | '150' | '200' | 'custom';

export interface KonfigurasiKerupukPayload {
  playMode: PlayModeKerupuk;
  targetKerupuk: number;
  targetPreset: TargetKerupukPreset;
  kesulitan: KesulitanKerupuk;
  probabilitas: ProbabilitasConfig;
  maxPeserta?: number;
  allowLateJoin?: boolean;
}

interface ModalKonfigurasiKerupukProps {
  isOpen: boolean;
  onClose: () => void;
  templateJudul: string;
  totalSoal: number;
  defaultPlayMode?: PlayModeKerupuk;
  onMulai: (config: KonfigurasiKerupukPayload) => void;
  loading?: boolean;
}

export const TARGET_PRESETS: Array<{
  value: number;
  key: TargetKerupukPreset;
  label: string;
  desc: string;
}> = [
  { value: 50, key: '50', label: '50 Poin', desc: 'Cepat (~2-4 benar)' },
  { value: 100, key: '100', label: '100 Poin', desc: 'Standar Kelas' },
  { value: 150, key: '150', label: '150 Poin', desc: 'Sedang-Panjang' },
  { value: 200, key: '200', label: '200 Poin', desc: 'Maraton Seru' },
];

export const PRESET_DATA: Record<
  'mudah' | 'normal' | 'sulit',
  { label: string; deskripsi: string; probabilitas: ProbabilitasConfig }
> = {
  mudah: {
    label: 'Mudah (Ceria)',
    deskripsi: 'Peluang gigitan besar tinggi, zonk sangat jarang',
    probabilitas: { besar: 35, sedang: 30, kecil: 20, sangat_kecil: 12, zonk: 3 },
  },
  normal: {
    label: 'Normal (Seimbang)',
    deskripsi: 'Kombinasi gigitan seimbang (standar kelas)',
    probabilitas: { besar: 15, sedang: 25, kecil: 35, sangat_kecil: 20, zonk: 5 },
  },
  sulit: {
    label: 'Sulit (Tantangan)',
    deskripsi: 'Dominasi gigitan kecil/mini dengan peluang zonk 15%',
    probabilitas: { besar: 5, sedang: 15, kecil: 30, sangat_kecil: 35, zonk: 15 },
  },
};

export function hitungPoinPengurangan(persen: number, target: number): number {
  if (persen <= 0) return 0;
  return Math.max(1, Math.round((target * persen) / 100));
}

export default function ModalKonfigurasiKerupuk({
  isOpen,
  onClose,
  templateJudul,
  totalSoal,
  defaultPlayMode = 'MULTIPLAYER',
  onMulai,
  loading = false,
}: ModalKonfigurasiKerupukProps) {
  const [playMode, setPlayMode] = useState<PlayModeKerupuk>(defaultPlayMode);
  const [targetPreset, setTargetPreset] = useState<TargetKerupukPreset>('100');
  const [customTargetInput, setCustomTargetInput] = useState<string>('120');

  const [kesulitan, setKesulitan] = useState<KesulitanKerupuk>('normal');
  const [probabilitas, setProbabilitas] = useState<ProbabilitasConfig>(
    PRESET_DATA.normal.probabilitas
  );

  // Pengaturan khusus Multiplayer
  const [maxPeserta, setMaxPeserta] = useState<number>(45);
  const [allowLateJoin, setAllowLateJoin] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setPlayMode(defaultPlayMode);
      setTargetPreset('100');
      setCustomTargetInput('120');
      setKesulitan('normal');
      setProbabilitas({ ...PRESET_DATA.normal.probabilitas });
      setMaxPeserta(45);
      setAllowLateJoin(true);
    }
  }, [isOpen, defaultPlayMode]);

  const targetKerupuk = useMemo(() => {
    if (targetPreset === 'custom') {
      const parsed = parseInt(customTargetInput, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return parseInt(targetPreset, 10);
  }, [targetPreset, customTargetInput]);

  const isValidTarget = Number.isInteger(targetKerupuk) && targetKerupuk >= 10 && targetKerupuk <= 1000;

  const totalPersen = useMemo(() => {
    return (
      Number(probabilitas.besar || 0) +
      Number(probabilitas.sedang || 0) +
      Number(probabilitas.kecil || 0) +
      Number(probabilitas.sangat_kecil || 0) +
      Number(probabilitas.zonk || 0)
    );
  }, [probabilitas]);

  const isValidProb = Math.abs(totalPersen - 100) < 0.001;
  const hasQuestions = totalSoal > 0;
  const canSubmit = isValidTarget && isValidProb && hasQuestions && !loading;

  const handlePilihPresetKesulitan = (key: 'mudah' | 'normal' | 'sulit') => {
    setKesulitan(key);
    setProbabilitas({ ...PRESET_DATA[key].probabilitas });
  };

  const updateNilaiProb = (key: keyof ProbabilitasConfig, val: number) => {
    const cleanVal = Number.isFinite(val) ? Math.max(0, Math.min(100, val)) : 0;
    setKesulitan('custom');
    setProbabilitas((prev) => ({
      ...prev,
      [key]: cleanVal,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onMulai({
      playMode,
      targetKerupuk,
      targetPreset,
      kesulitan,
      probabilitas,
      ...(playMode === 'MULTIPLAYER' ? { maxPeserta, allowLateJoin } : {}),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pilih Mode & Konfigurasi — Makan Kerupuk Challenge"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-[#1d3b2e]">
        {/* Header Ringkasan Materi */}
        <div className="bg-[#f4ecd9] border border-[#e0d5b8] p-3.5 rounded-xl flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6b7d6c] block">
              Materi Pertanyaan Dipilih
            </span>
            <h4 className="font-bold text-sm leading-snug">{templateJudul}</h4>
          </div>
          <span className="portal-tag yellow font-bold shrink-0">{totalSoal} Soal</span>
        </div>

        {!hasQuestions && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Template ini belum memiliki soal. Tambahkan minimal 1 soal sebelum memulai permainan.
            </span>
          </div>
        )}

        {/* 1. Pemilihan Mode Permainan (Dua Pilihan Mode) */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider block">
            1. Pilih Mode Permainan
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPlayMode('MULTIPLAYER')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                playMode === 'MULTIPLAYER'
                  ? 'bg-[#1d3b2e] text-white border-[#1d3b2e] shadow-md'
                  : 'bg-[#fcf8ed] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <Users className="w-4 h-4 text-[#f2c230]" />
                  <span>Multiplayer Mode</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    playMode === 'MULTIPLAYER' ? 'bg-[#f2c230] text-[#1d3b2e]' : 'bg-[#f4ecd9] text-[#6b7d6c]'
                  }`}
                >
                  HP Siswa
                </span>
              </div>
              <p className={`text-[11px] leading-snug ${playMode === 'MULTIPLAYER' ? 'text-white/85' : 'text-[#6b7d6c]'}`}>
                Siswa bergabung dengan PIN &amp; QR, punya kerupuk sendiri, leaderboard real-time (hingga 40+ siswa).
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPlayMode('SOLO')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                playMode === 'SOLO'
                  ? 'bg-[#c8362f] text-white border-[#c8362f] shadow-md'
                  : 'bg-[#fcf8ed] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#c8362f]/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <Monitor className="w-4 h-4" />
                  <span>Solo Mode (Perangkat Guru)</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    playMode === 'SOLO' ? 'bg-white text-[#c8362f]' : 'bg-[#f4ecd9] text-[#6b7d6c]'
                  }`}
                >
                  1 Perangkat
                </span>
              </div>
              <p className={`text-[11px] leading-snug ${playMode === 'SOLO' ? 'text-white/90' : 'text-[#6b7d6c]'}`}>
                Guru langsung memainkan &amp; menampilkannya di proyektor kelas tanpa perlu siswa bergabung atau PIN/QR.
              </p>
            </button>
          </div>
        </div>

        {/* 2. Target Poin Kerupuk (Aturan Inti Bersama) */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-[#c8362f]" />
            2. Target Poin Kerupuk
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
                      ? 'bg-[#c8362f] text-white border-[#c8362f] shadow-sm'
                      : 'bg-[#fcf8ed] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#c8362f]/50'
                  }`}
                >
                  <div className="text-xs font-extrabold">{p.label}</div>
                  <div className={`text-[10px] mt-0.5 ${aktif ? 'text-white/85' : 'text-[#6b7d6c]'}`}>
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
                  ? 'bg-[#1d3b2e] text-white border-[#1d3b2e] shadow-sm'
                  : 'bg-[#fcf8ed] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
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
            <div className="flex flex-wrap items-center gap-3 bg-[#fcf8ed] border border-[#e0d5b8] p-3 rounded-xl">
              <label className="text-xs font-bold">Masukkan Target Poin:</label>
              <input
                type="number"
                min={10}
                max={1000}
                step={1}
                value={customTargetInput}
                onChange={(e) => setCustomTargetInput(e.target.value)}
                className="w-28 px-3 py-1.5 bg-white border border-[#e0d5b8] rounded-lg text-sm font-mono font-bold text-[#1d3b2e] focus:outline-none"
              />
              {!isValidTarget && (
                <span className="text-xs font-bold text-red-600">
                  Target harus bilangan bulat 10–1000.
                </span>
              )}
            </div>
          )}

          {isValidTarget && (
            <div className="flex flex-wrap gap-2 text-[11px] bg-white/70 border border-[#e0d5b8] px-3 py-2 rounded-xl">
              <span className="font-bold text-[#6b7d6c]">Pengurangan ({targetKerupuk} pt):</span>
              <span className="font-semibold text-amber-800">
                Besar -{hitungPoinPengurangan(40, targetKerupuk)}pt
              </span>
              <span>•</span>
              <span className="font-semibold text-emerald-800">
                Sedang -{hitungPoinPengurangan(25, targetKerupuk)}pt
              </span>
              <span>•</span>
              <span className="font-semibold text-blue-800">
                Kecil -{hitungPoinPengurangan(10, targetKerupuk)}pt
              </span>
              <span>•</span>
              <span className="font-semibold text-slate-700">
                Mini -{hitungPoinPengurangan(5, targetKerupuk)}pt
              </span>
              <span>•</span>
              <span className="font-semibold text-red-700">Zonk -0pt</span>
            </div>
          )}
        </div>

        {/* 3. Probabilitas Gigitan (Aturan Inti Bersama) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#c8362f]" />
              3. Preset Kesulitan &amp; Probabilitas Gigitan
            </label>
            <span className="text-[11px] font-bold text-[#6b7d6c] flex items-center gap-1">
              <Sliders className="w-3 h-3" />
              {kesulitan === 'custom' ? 'Kustom' : PRESET_DATA[kesulitan].label}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PRESET_DATA) as Array<'mudah' | 'normal' | 'sulit'>).map((key) => {
              const p = PRESET_DATA[key];
              const isSelected = kesulitan === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePilihPresetKesulitan(key)}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1d3b2e] text-white border-[#1d3b2e] shadow-sm'
                      : 'bg-[#fcf8ed] text-[#1d3b2e] border-[#e0d5b8] hover:border-[#1d3b2e]/50'
                  }`}
                >
                  <div className="text-xs font-bold">{p.label}</div>
                  <div
                    className={`text-[10px] leading-tight mt-0.5 ${
                      isSelected ? 'text-white/80' : 'text-[#6b7d6c]'
                    }`}
                  >
                    {p.deskripsi}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-2 bg-[#fcf8ed] border border-[#e0d5b8] p-3 rounded-xl">
            {[
              { key: 'besar' as const, nama: 'Besar (-40%, +40 pt)', accent: 'accent-[#1d3b2e]' },
              { key: 'sedang' as const, nama: 'Sedang (-25%, +25 pt)', accent: 'accent-[#1d3b2e]' },
              { key: 'kecil' as const, nama: 'Kecil (-10%, +10 pt)', accent: 'accent-[#1d3b2e]' },
              { key: 'sangat_kecil' as const, nama: 'Mini (-5%, +5 pt)', accent: 'accent-[#1d3b2e]' },
              { key: 'zonk' as const, nama: 'Zonk / Tidak Menggigit (0%, +0 pt)', accent: 'accent-[#c8362f]' },
            ].map((item) => (
              <div key={item.key}>
                <div className="flex items-center justify-between text-xs font-bold mb-0.5">
                  <span>{item.nama}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={probabilitas[item.key]}
                      onChange={(e) =>
                        updateNilaiProb(item.key, parseFloat(e.target.value || '0'))
                      }
                      className="w-12 px-1 py-0.5 text-right font-mono text-xs bg-white border border-[#e0d5b8] rounded"
                    />
                    <span className="font-mono text-xs">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={probabilitas[item.key]}
                  onChange={(e) => updateNilaiProb(item.key, parseInt(e.target.value, 10))}
                  className={`w-full ${item.accent} h-1.5 bg-[#e0d5b8] rounded-lg appearance-none cursor-pointer`}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold">Total Probabilitas:</span>
            <div
              className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md ${
                isValidProb ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
              }`}
            >
              {isValidProb ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Tepat 100% (Valid)
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" /> {totalPersen}% (Wajib Tepat 100%)
                </>
              )}
            </div>
          </div>
        </div>

        {/* 4. Pengaturan Tambahan Khusus Multiplayer */}
        {playMode === 'MULTIPLAYER' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="bg-[#fcf8ed] border border-[#e0d5b8] p-3 rounded-xl">
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#1d3b2e]" /> Kapasitas Siswa
              </label>
              <select
                value={maxPeserta}
                onChange={(e) => setMaxPeserta(parseInt(e.target.value, 10))}
                className="w-full p-2 bg-white border border-[#e0d5b8] rounded-lg text-xs font-bold text-[#1d3b2e]"
              >
                <option value={20}>20 Siswa</option>
                <option value={30}>30 Siswa</option>
                <option value={45}>45 Siswa (Standar 1 Kelas)</option>
                <option value={60}>60 Siswa</option>
                <option value={100}>100 Siswa</option>
              </select>
            </div>

            <div className="flex items-center justify-between bg-[#fcf8ed] border border-[#e0d5b8] p-3 rounded-xl">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#1d3b2e] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[#1d3b2e]">Siswa Susulan</p>
                  <p className="text-[11px] text-[#6b7d6c]">Bisa gabung setelah dimulai</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={allowLateJoin}
                onChange={(e) => setAllowLateJoin(e.target.checked)}
                className="w-4 h-4 accent-[#1d3b2e] cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="flex justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#e0d5b8] text-xs font-bold rounded-lg text-[#1d3b2e] hover:bg-[#f7f2e4] transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={`px-5 py-2 text-xs font-bold rounded-lg flex items-center gap-2 text-white shadow-sm transition-all ${
              !canSubmit
                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                : playMode === 'MULTIPLAYER'
                ? 'bg-[#1d3b2e] hover:bg-[#254b3b] cursor-pointer'
                : 'bg-[#c8362f] hover:bg-[#b02d27] cursor-pointer'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            {loading
              ? 'Menyiapkan Sesi...'
              : playMode === 'MULTIPLAYER'
              ? 'Buat Sesi & Buka Lobi PIN'
              : 'Mulai Permainan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
