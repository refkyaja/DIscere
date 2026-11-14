import { Volume, Volume1, Volume2, Users, Minus, Plus } from 'lucide-react';

export interface KapasitasPesertaControlProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  subLabel?: string;
  className?: string;
}

const PRESETS = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30 (Kelas)' },
  { value: 40, label: '40' },
  { value: 45, label: '45 (Maks)' },
];

export function KapasitasPesertaControl({
  value,
  onChange,
  min = 1,
  max = 45,
  label = 'Kapasitas Peserta (1–45 Siswa)',
  subLabel,
  className = '',
}: KapasitasPesertaControlProps) {
  const clampedValue = Math.min(max, Math.max(min, value));
  const pct = Math.round(((clampedValue - min) / (max - min)) * 100);

  // Status teks dinamis sesuai kapasitas
  const statusDeskripsi =
    clampedValue >= 45
      ? 'Kapasitas penuh lobi'
      : clampedValue >= 30
      ? 'Ukuran 1 kelas standar'
      : clampedValue >= 15
      ? 'Kelompok lomba sedang'
      : 'Kelompok kecil';

  return (
    <div
      className={`bg-[#fffdf6] border-2 border-[#e0d5b8] rounded-2xl p-3.5 sm:p-4 shadow-sm transition-all hover:border-[#cfc19f] ${className}`}
    >
      {/* Header Info */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#ede5d4] border border-[#d8cdb4] text-[#1d3b2e] flex items-center justify-center shrink-0 shadow-2xs">
            {clampedValue <= 12 ? (
              <Volume className="w-4 h-4" />
            ) : clampedValue <= 28 ? (
              <Volume1 className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-black uppercase tracking-wider text-[#1d3b2e] block truncate">
              {label}
            </span>
            <span className="text-[11px] font-semibold text-[#6b7d6c] block truncate">
              {subLabel || statusDeskripsi}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-[#1d3b2e] text-[#f4ecd8] px-3 py-1 rounded-xl font-mono border border-[#163a2b] shadow-xs shrink-0">
          <Users className="w-3.5 h-3.5 text-[#f2c230]" />
          <span className="font-black text-sm text-[#f2c230]">{clampedValue}</span>
          <span className="text-xs text-[#cfd9c3] font-semibold">Siswa</span>
        </div>
      </div>

      {/* Kontrol Stepper & Slider Volume */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 sm:gap-3 bg-[#f7f2e4] p-2 sm:p-2.5 rounded-xl border border-[#e2d8c3]">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, clampedValue - 1))}
            disabled={clampedValue <= min}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#ece4d5] hover:bg-[#dfd5c2] active:translate-y-0.5 active:shadow-none text-[#1d3b2e] flex items-center justify-center font-black cursor-pointer transition-all border-2 border-[#d4c8b0] shadow-[0_2px_0_#baa88e] disabled:opacity-35 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none shrink-0"
            title="Kurangi 1 siswa"
            aria-label="Kurangi kapasitas peserta"
          >
            <Minus className="w-4 h-4 stroke-[2.5]" />
          </button>

          <div className="flex-1 relative flex items-center px-1">
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={clampedValue}
              onChange={(e) => onChange(Number(e.target.value))}
              aria-label={label}
              className="discere-range-slider"
              style={{
                background: `linear-gradient(to right, #1d3b2e 0%, #1d3b2e ${pct}%, #dfd5be ${pct}%, #dfd5be 100%)`,
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => onChange(Math.min(max, clampedValue + 1))}
            disabled={clampedValue >= max}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#ece4d5] hover:bg-[#dfd5c2] active:translate-y-0.5 active:shadow-none text-[#1d3b2e] flex items-center justify-center font-black cursor-pointer transition-all border-2 border-[#d4c8b0] shadow-[0_2px_0_#baa88e] disabled:opacity-35 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none shrink-0"
            title="Tambah 1 siswa"
            aria-label="Tambah kapasitas peserta"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Legend Nilai Slider */}
        <div className="flex justify-between items-center px-2 text-[10px] font-bold text-[#8a988b] font-mono select-none">
          <span>{min}</span>
          <span className="hidden sm:inline">15</span>
          <span>30</span>
          <span>{max} (Maks)</span>
        </div>
      </div>

      {/* Preset Cepat */}
      <div className="pt-2 border-t border-dashed border-[#e4dbca] flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-bold text-[#7d8c7e] mr-0.5">Preset:</span>
        {PRESETS.map((preset) => {
          const isActive = clampedValue === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border active:scale-95 ${
                isActive
                  ? 'bg-[#1d3b2e] text-[#f2c230] border-[#163a2b] shadow-xs scale-102'
                  : 'bg-[#ede5d4] text-[#4a5c4e] border-[#d8cdb4] hover:bg-[#e2d8c3]'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
