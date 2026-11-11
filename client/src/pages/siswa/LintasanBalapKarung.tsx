import { Flag, Shield, Zap, CloudRain, Scale, AlertTriangle } from 'lucide-react';
import KarakterBalapKarung, { EkspresiBalapKarung } from './KarakterBalapKarung';

export interface EfekAktifBalapVisual {
  perisai?: boolean;
  lompatanKuat?: boolean;
  jalanBerlumpur?: boolean;
}

interface LintasanBalapKarungProps {
  jarak: number;
  targetJarak: number;
  keseimbangan: number;
  keseimbanganAktif?: boolean;
  namaPemain?: string;
  efekAktif?: EfekAktifBalapVisual;
  lastDeltaJarak?: number | null;
  ekspresi?: EkspresiBalapKarung;
  terjatuh?: boolean;
  streak?: number;
  status?: 'bermain' | 'selesai';
  compact?: boolean;
}

export default function LintasanBalapKarung({
  jarak,
  targetJarak,
  keseimbangan,
  keseimbanganAktif = true,
  namaPemain,
  efekAktif,
  lastDeltaJarak,
  ekspresi = 'netral',
  terjatuh = false,
  streak = 0,
  status = 'bermain',
  compact = false,
}: LintasanBalapKarungProps) {
  const safeTarget = Math.max(10, targetJarak || 100);
  const safeJarak = Math.max(0, Math.min(safeTarget, Math.round(jarak)));
  const safeBalance = Math.max(0, Math.min(100, Math.round(keseimbangan)));
  const progressRatio = safeJarak / safeTarget;
  const isFinis = safeJarak >= safeTarget || status === 'selesai';

  // Petakan jarak 0..targetJarak ke posisi horizontal 8%..88% di dalam lintasan
  const leftPercent = 8 + progressRatio * 80;

  const hasPerisai = Boolean(efekAktif?.perisai);
  const hasLompatKuat = Boolean(efekAktif?.lompatanKuat);
  const hasLumpur = Boolean(efekAktif?.jalanBerlumpur);

  const resolvedEkspresi: EkspresiBalapKarung = isFinis
    ? 'puncak'
    : terjatuh
    ? 'terjatuh'
    : ekspresi && ekspresi !== 'netral'
    ? ekspresi
    : lastDeltaJarak !== undefined && lastDeltaJarak !== null && lastDeltaJarak > 0
    ? 'bahagia'
    : lastDeltaJarak !== undefined && lastDeltaJarak !== null && lastDeltaJarak < 0
    ? 'sedih'
    : 'netral';

  const trackHeight = compact ? 'h-24' : 'h-32 sm:h-36';

  return (
    <div className="w-full space-y-2 select-none">
      {/* Arena Lintasan Horizontal */}
      <div
        className={`relative w-full ${trackHeight} rounded-2xl bg-gradient-to-b from-sky-950/70 via-emerald-950/60 to-amber-950/80 border border-slate-700/80 overflow-hidden shadow-inner px-3 flex flex-col justify-end`}
      >
        {/* Garis Lintasan Rumput & Penanda Jarak */}
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-amber-900/70 via-amber-800/40 to-transparent border-t border-amber-700/30 pointer-events-none" />

        {/* Marker 0%, 50%, Finis */}
        <div className="absolute inset-x-6 top-2 bottom-2 pointer-events-none">
          {/* Garis Start */}
          <div className="absolute left-0 inset-y-0 border-l-2 border-dashed border-emerald-400/50 flex flex-col justify-start">
            <span className="text-[9px] font-mono font-bold text-emerald-300/80 pl-1">0m</span>
          </div>
          {/* Marker Tengah */}
          <div className="absolute left-1/2 inset-y-0 border-l border-dashed border-slate-500/40 flex flex-col justify-start">
            <span className="text-[9px] font-mono text-slate-400 pl-1">
              {Math.round(safeTarget / 2)}m
            </span>
          </div>
          {/* Garis Finis */}
          <div className="absolute right-0 inset-y-0 border-r-2 border-dashed border-amber-400/80 flex flex-col items-end justify-start">
            <span className="inline-flex items-center gap-0.5 text-[9px] font-mono font-black text-amber-300 pr-1">
              <Flag className="w-2.5 h-2.5 text-red-400 fill-red-500" />
              {safeTarget}m
            </span>
          </div>
        </div>

        {/* Genangan lumpur jika debuff Jalan Berlumpur sedang aktif */}
        {hasLumpur && (
          <div
            style={{ left: `${Math.min(92, leftPercent + 6)}%` }}
            className="absolute bottom-1 -translate-x-1/2 w-12 h-3 rounded-full bg-amber-900/90 border border-amber-700/80 opacity-85 pointer-events-none"
            title="Jalan Berlumpur Aktif"
          />
        )}

        {/* Karakter Pembalap Karung Bergerak Horizontal */}
        <div
          style={{ left: `${leftPercent}%` }}
          className="absolute bottom-1.5 -translate-x-1/2 z-20 transition-all duration-500 ease-out motion-reduce:transition-none flex flex-col items-center"
        >
          {/* Floating badge perubahan jarak / terjatuh */}
          {terjatuh ? (
            <span className="mb-0.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black shadow flex items-center gap-0.5 whitespace-nowrap">
              <AlertTriangle className="w-2.5 h-2.5" /> JATUH!
            </span>
          ) : (
            lastDeltaJarak !== undefined &&
            lastDeltaJarak !== null &&
            lastDeltaJarak !== 0 && (
              <span
                className={`mb-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black font-mono shadow whitespace-nowrap ${
                  lastDeltaJarak > 0
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {lastDeltaJarak > 0 ? `+${lastDeltaJarak}m` : `${lastDeltaJarak}m`}
              </span>
            )
          )}

          <div className="relative">
            <KarakterBalapKarung
              nama={namaPemain}
              ekspresi={resolvedEkspresi}
              pose={terjatuh ? 'terjatuh' : 'balap'}
              size={compact ? 'xs' : 'sm'}
              streak={streak}
              perisai={hasPerisai}
            />

            {/* Badge status efek aktif */}
            {hasPerisai && (
              <span
                className="absolute -right-1 top-0 bg-sky-400 text-slate-950 rounded-full p-0.5 shadow"
                title="Perisai Aktif"
              >
                <Shield className="w-2.5 h-2.5" />
              </span>
            )}
            {hasLompatKuat && (
              <span
                className="absolute -left-1 top-0 bg-amber-400 text-slate-950 rounded-full p-0.5 shadow"
                title="Lompatan Kuat Aktif"
              >
                <Zap className="w-2.5 h-2.5" />
              </span>
            )}
            {hasLumpur && (
              <span
                className="absolute -right-1 bottom-1 bg-amber-700 text-amber-100 rounded-full p-0.5 shadow"
                title="Jalan Berlumpur Aktif"
              >
                <CloudRain className="w-2.5 h-2.5" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bar Jarak & Indikator Keseimbangan */}
      <div className={`grid gap-2 ${keseimbanganAktif ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Jarak Tempuh */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold mb-1">
            <span className="text-slate-300 truncate max-w-[140px]">
              {namaPemain ? `${namaPemain} • Jarak` : 'Jarak Tempuh'}
            </span>
            <span className={`font-mono font-black ${isFinis ? 'text-amber-400' : 'text-emerald-300'}`}>
              {safeJarak} m / {safeTarget} m
            </span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.min(100, Math.round(progressRatio * 100))}%` }}
              className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${
                isFinis
                  ? 'bg-amber-400'
                  : 'bg-gradient-to-r from-[#D7262E] via-amber-400 to-emerald-400'
              }`}
            />
          </div>
        </div>

        {/* Keseimbangan */}
        {keseimbanganAktif && (
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold mb-1">
              <span className="text-slate-300 flex items-center gap-1">
                <Scale className="w-3 h-3 text-sky-400" />
                Keseimbangan
              </span>
              <span
                className={`font-mono font-black ${
                  safeBalance >= 60
                    ? 'text-sky-300'
                    : safeBalance >= 25
                    ? 'text-amber-300'
                    : 'text-rose-400'
                }`}
              >
                {safeBalance}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                style={{ width: `${safeBalance}%` }}
                className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${
                  safeBalance >= 60
                    ? 'bg-gradient-to-r from-sky-500 to-emerald-400'
                    : safeBalance >= 25
                    ? 'bg-amber-400'
                    : 'bg-rose-500 motion-safe:animate-pulse'
                }`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

