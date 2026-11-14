import { Users, Minus, Plus } from 'lucide-react';

export interface KapasitasPesertaControlProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  className?: string;
}

export function KapasitasPesertaControl({
  value,
  onChange,
  min = 1,
  max = 45,
  label = 'Kapasitas Peserta (1–45 Siswa)',
  className = '',
}: KapasitasPesertaControlProps) {
  const clampedValue = Math.min(max, Math.max(min, value));
  const pct = Math.round(((clampedValue - min) / (max - min)) * 100);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Label & Badge Jumlah Siswa */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="text-xs font-bold uppercase tracking-wider text-[#6b7d6c] flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[#1d3b2e]" />
          <span>{label}</span>
        </label>
        <span className="font-extrabold text-xs px-2.5 py-0.5 bg-[#1d3b2e] text-[#f4ecd8] rounded-full font-mono shadow-xs">
          {clampedValue} Siswa
        </span>
      </div>

      {/* Stepper (-) dan (+) dengan Slider Track yang Terisi */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, clampedValue - 1))}
          disabled={clampedValue <= min}
          className="w-8 h-8 rounded-xl bg-[#ece4d5] hover:bg-[#dfd5c2] active:scale-95 text-[#1d3b2e] flex items-center justify-center font-black cursor-pointer transition-all border border-[#d4c8b0] disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          title="Kurangi kapasitas"
          aria-label="Kurangi kapasitas"
        >
          <Minus className="w-4 h-4" />
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
          className="w-8 h-8 rounded-xl bg-[#ece4d5] hover:bg-[#dfd5c2] active:scale-95 text-[#1d3b2e] flex items-center justify-center font-black cursor-pointer transition-all border border-[#d4c8b0] disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          title="Tambah kapasitas"
          aria-label="Tambah kapasitas"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
