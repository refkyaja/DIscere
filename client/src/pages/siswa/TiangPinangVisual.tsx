import { Shield, HandMetal, Droplets, Flag, Trophy, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import KarakterPanjatPinang, { EkspresiKarakterPanjat } from './KarakterPanjatPinang';

export interface EfekAktifVisual {
  tiangLicin?: boolean;
  perisaiKulitPisang?: boolean;
  peganganKuat?: boolean;
  menungguBonusKulitPisang?: boolean;
}

interface TiangPinangVisualProps {
  posisi: number; // 0..100 dari backend
  namaPemain?: string;
  efekAktif?: EfekAktifVisual;
  lastDelta?: number | null;
  ekspresi?: EkspresiKarakterPanjat;
  streak?: number;
  status?: 'bermain' | 'selesai';
  compact?: boolean;
  showProgressFooter?: boolean;
  reactionNonce?: number;
}

export default function TiangPinangVisual({
  posisi,
  namaPemain,
  efekAktif,
  lastDelta,
  ekspresi = 'netral',
  streak = 0,
  status = 'bermain',
  compact = false,
  showProgressFooter = true,
  reactionNonce = 0,
}: TiangPinangVisualProps) {
  const safePosisi = Math.max(0, Math.min(100, Math.round(posisi)));
  const isPuncak = safePosisi >= 100 || status === 'selesai';

  const hasLicin = Boolean(efekAktif?.tiangLicin);
  const hasPerisai = Boolean(efekAktif?.perisaiKulitPisang);
  const hasPegangan = Boolean(efekAktif?.peganganKuat);

  const resolvedEkspresi: EkspresiKarakterPanjat = isPuncak
    ? 'puncak'
    : ekspresi && ekspresi !== 'netral'
    ? ekspresi
    : lastDelta !== undefined && lastDelta !== null && lastDelta > 0
    ? 'bahagia'
    : lastDelta !== undefined && lastDelta !== null && lastDelta < 0
    ? 'sedih'
    : 'netral';

  const animClass =
    isPuncak
      ? 'motion-safe:panjat-anim-summit'
      : lastDelta !== undefined && lastDelta !== null && lastDelta > 0
      ? 'motion-safe:panjat-anim-climb'
      : lastDelta !== undefined && lastDelta !== null && lastDelta < 0
      ? 'motion-safe:panjat-anim-slip'
      : '';

  // Tinggi karakter dalam piksel sesuai size SVG (aspect 120:130 + padding p-1)
  // compact: 'xs' -> ~46px | full: 'lg' (99px) + p-1 (8px) ~= 108px
  const charHeightPx = compact ? 46 : 108;

  // Rumus bottom terkalibrasi di dalam zona lintasan agar kepala & kaki karakter
  // tidak pernah terpotong oleh container pada 0% maupun 100%.
  const bottomCalc = `calc(${safePosisi}% - ${(safePosisi / 100) * charHeightPx}px)`;

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-2 select-none">
        <div className="relative h-44 w-28 rounded-2xl bg-gradient-to-b from-sky-900/60 via-slate-800/80 to-emerald-950/70 border border-slate-700/80 overflow-hidden shadow-inner flex flex-col justify-between p-2">
          {/* Garis skala ringkas */}
          <div className="absolute inset-x-2 top-8 bottom-3 pointer-events-none">
            {[100, 50, 0].map((mark) => (
              <div
                key={mark}
                style={{ bottom: `${mark}%` }}
                className="absolute inset-x-0 flex items-center gap-1"
              >
                <span className="text-[8px] font-mono font-bold text-slate-400/75 w-6 text-right">
                  {mark}%
                </span>
                <div className="flex-1 border-t border-dashed border-slate-600/45" />
              </div>
            ))}
          </div>

          {/* Puncak hadiah */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/50">
              <Flag className="w-2.5 h-2.5 text-red-400 fill-red-500" />
              <Trophy className="w-3 h-3 text-amber-400" />
            </div>
            <div className="w-12 h-1.5 rounded-full bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 border border-amber-300 mt-0.5" />
          </div>

          {/* Batang tiang */}
          <div className="absolute top-7 bottom-2.5 left-1/2 -translate-x-1/2 w-3 rounded-t-md shadow-md overflow-hidden border border-amber-900/60 bg-gradient-to-r from-amber-800 via-amber-500 to-amber-700">
            <div className="h-full w-full flex flex-col justify-evenly opacity-40">
              <div className="h-[1px] bg-amber-950" />
              <div className="h-[1px] bg-amber-950" />
              <div className="h-[1px] bg-amber-950" />
              <div className="h-[1px] bg-amber-950" />
            </div>
            {hasLicin && (
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-300/60 via-sky-200/40 to-cyan-400/60 animate-pulse motion-reduce:animate-none" />
            )}
          </div>

          {/* Zona Track Karakter (compact) */}
          <div className="absolute inset-x-0 top-8 bottom-3 pointer-events-none">
            <div
              style={{ bottom: bottomCalc }}
              className="absolute left-1/2 -translate-x-1/2 z-20 transition-[bottom] duration-500 ease-out motion-reduce:transition-none flex flex-col items-center"
            >
              {lastDelta !== undefined && lastDelta !== null && lastDelta !== 0 && (
                <span
                  className={`mb-0.5 px-1 py-0.2 rounded-full text-[9px] font-black font-mono flex items-center gap-0.5 shadow ${
                    lastDelta > 0
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {lastDelta > 0 ? `+${lastDelta}%` : `${lastDelta}%`}
                </span>
              )}
              <div
                key={`char-compact-${reactionNonce}`}
                className={`relative flex items-center justify-center rounded-xl ${animClass}`}
              >
                <KarakterPanjatPinang
                  nama={namaPemain}
                  ekspresi={resolvedEkspresi}
                  pose="panjat"
                  size="xs"
                  streak={streak}
                />
              </div>
            </div>
          </div>

          <div className="relative z-10 h-2 w-full rounded-b-md bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 border-t border-emerald-400/40" />
        </div>

        {showProgressFooter && (
          <div className="w-full max-w-[140px] space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-300 truncate max-w-[88px]">
                {namaPemain || 'Ketinggian'}
              </span>
              <span className={`font-mono font-black ${isPuncak ? 'text-amber-400' : 'text-white'}`}>
                {safePosisi}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-0.5">
              <div
                style={{ width: `${safePosisi}%` }}
                className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${
                  isPuncak
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                    : 'bg-gradient-to-r from-[#D7262E] via-amber-400 to-emerald-400'
                }`}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full md:h-full md:flex-1 flex flex-col items-center gap-3 select-none">
      {/* Arena Tiang Pinang Skala Penuh */}
      <div className="relative w-full h-[275px] min-h-[275px] sm:h-[320px] sm:min-h-[320px] md:flex-1 md:h-auto md:min-h-[400px] rounded-2xl bg-gradient-to-b from-[#0b1b3a] via-[#0f2247]/90 to-[#0c2d27] border border-slate-700/80 overflow-hidden shadow-inner flex flex-col justify-between">
        {/* Dekorasi Latar Langit Karnaval Halus */}
        <div
          className="absolute inset-0 pointer-events-none opacity-45"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(250, 204, 21, 0.14), transparent 45%), radial-gradient(circle at 82% 28%, rgba(56, 189, 248, 0.12), transparent 42%)',
          }}
        />

        {/* Kilau Perayaan saat Mencapai Puncak 100% */}
        {isPuncak && (
          <div className="absolute inset-x-0 top-0 h-32 pointer-events-none bg-gradient-to-b from-amber-400/20 to-transparent" />
        )}

        {/* Garis Skala Ketinggian 25%, 50%, 75%, 100% (0% ditampilkan pada alas rumput bawah) */}
        <div className="absolute inset-x-3 sm:inset-x-4 top-[56px] bottom-[20px] pointer-events-none">
          {[100, 75, 50, 25].map((mark) => {
            const isTarget = mark === 100;
            return (
              <div
                key={mark}
                style={{ bottom: `${mark}%` }}
                className="absolute inset-x-0 translate-y-1/2 flex items-center gap-2"
              >
                <span
                  className={`text-[10px] sm:text-[11px] font-mono font-extrabold w-9 text-right shrink-0 ${
                    isTarget ? 'text-amber-300' : 'text-slate-400/85'
                  }`}
                >
                  {mark}%
                </span>
                <div
                  className={`flex-1 ${
                    isTarget
                      ? 'border-t-2 border-dashed border-amber-400/70'
                      : 'border-t border-dashed border-slate-500/35'
                  }`}
                />
                {isTarget && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/40 shrink-0">
                    Target
                  </span>
                )}
              </div>
            );
          })}

          {/* Penanda Posisi Ketinggian Pemain Aktif di Penggaris Kiri */}
          <div
            style={{ bottom: `calc(${safePosisi}% - ${(safePosisi / 100) * 10}px)` }}
            className="absolute left-0 z-10 flex items-center transition-[bottom] duration-500 ease-out motion-reduce:transition-none"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-slate-950 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
          </div>
        </div>

        {/* Roda Hadiah Puncak 100% + Bendera Merah Putih */}
        <div className="relative z-10 flex flex-col items-center pt-2 px-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/85 border border-amber-400/60 shadow-md">
            <Flag className="w-3.5 h-3.5 text-red-400 fill-red-500 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
              Puncak 100%
            </span>
            <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          </div>
          {/* Roda bambu puncak + gantungan hadiah 17-an */}
          <div className="relative w-24 sm:w-28 h-2.5 rounded-full bg-gradient-to-r from-amber-700 via-yellow-400 to-amber-700 border border-amber-300 shadow-lg mt-1 flex items-center justify-around">
            <span className="w-2 h-3 bg-[#D7262E] rounded-b-sm translate-y-1.5 shadow-xs" />
            <span className="w-2 h-3 bg-amber-300 rounded-b-sm translate-y-1.5 shadow-xs" />
            <span className="w-2 h-3 bg-white rounded-b-sm translate-y-1.5 shadow-xs" />
            <span className="w-2 h-3 bg-sky-400 rounded-b-sm translate-y-1.5 shadow-xs" />
          </div>
        </div>

        {/* Batang Tiang Pinang Vertikal di Tengah */}
        <div className="absolute top-[46px] bottom-[18px] left-1/2 -translate-x-1/2 w-5 sm:w-6 rounded-t-lg shadow-lg overflow-hidden border border-amber-950/70 bg-gradient-to-r from-amber-800 via-amber-500 to-amber-700">
          {/* Ruas bambu/batang pinang */}
          <div className="h-full w-full flex flex-col justify-evenly opacity-45">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="h-[1.5px] bg-amber-950/80" />
            ))}
          </div>
          {/* Kilau minyak saat Tiang Licin aktif */}
          {hasLicin && (
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-300/65 via-sky-200/45 to-cyan-400/65 animate-pulse motion-reduce:animate-none" />
          )}
        </div>

        {/* Zona Lintasan Karakter Pemanjat (0..100% bebas terpotong) */}
        <div className="absolute inset-x-0 top-[56px] bottom-[20px] pointer-events-none">
          <div
            style={{ bottom: bottomCalc }}
            className="absolute left-1/2 -translate-x-1/2 z-20 transition-[bottom] duration-500 ease-out motion-reduce:transition-none flex items-center justify-center"
          >
            {/* Karakter 2D Pemanjat Panjat Pinang dengan aura & animasi naik/turun */}
            <div
              key={`char-full-${reactionNonce}`}
              className={`relative flex items-center justify-center rounded-2xl p-1 ${animClass} ${
                isPuncak
                  ? 'ring-2 ring-amber-300/80 bg-amber-400/15'
                  : hasPerisai
                  ? 'ring-2 ring-emerald-400/70 bg-emerald-500/15'
                  : hasPegangan
                  ? 'ring-2 ring-amber-400/60 bg-amber-500/15'
                  : hasLicin
                  ? 'ring-2 ring-cyan-300/70 bg-sky-500/15'
                  : ''
              }`}
            >
              <KarakterPanjatPinang
                nama={namaPemain}
                ekspresi={resolvedEkspresi}
                pose="panjat"
                size="lg"
                streak={streak}
              />

              {/* Ikon Status Efek Aktif menempel di sudut karakter */}
              {hasPerisai && (
                <span
                  className="absolute -right-1.5 -top-1.5 bg-emerald-400 text-slate-950 rounded-full p-1 shadow-md border border-slate-900"
                  title="Perisai Kulit Pisang Aktif"
                >
                  <Shield className="w-3 h-3" />
                </span>
              )}
              {hasPegangan && (
                <span
                  className="absolute -left-1.5 -top-1.5 bg-amber-400 text-slate-950 rounded-full p-1 shadow-md border border-slate-900"
                  title="Pegangan Kuat Aktif"
                >
                  <HandMetal className="w-3 h-3" />
                </span>
              )}
              {hasLicin && (
                <span
                  className="absolute -right-1.5 bottom-0 bg-cyan-400 text-slate-950 rounded-full p-1 shadow-md border border-slate-900"
                  title="Awas Tiang Licin"
                >
                  <Droplets className="w-3 h-3" />
                </span>
              )}

              {/* Sparkle Puncak */}
              {isPuncak && (
                <span className="absolute -left-2 -top-2 bg-amber-400 text-slate-950 rounded-full p-1 shadow-md">
                  <Sparkles className="w-3 h-3" />
                </span>
              )}

              {/* Delta badge di samping kanan karakter agar bebas terpotong saat posisi 100% */}
              {lastDelta !== undefined && lastDelta !== null && lastDelta !== 0 && (
                <span
                  key={`delta-${reactionNonce}`}
                  className={`absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full text-[11px] font-black font-mono flex items-center gap-0.5 shadow-lg whitespace-nowrap motion-safe:panjat-anim-feedback ${
                    lastDelta > 0
                      ? 'bg-emerald-500 text-slate-950 border border-emerald-200'
                      : 'bg-rose-500 text-white border border-rose-300'
                  }`}
                >
                  {lastDelta > 0 ? (
                    <ArrowUp className="w-3 h-3 stroke-[3]" />
                  ) : (
                    <ArrowDown className="w-3 h-3 stroke-[3]" />
                  )}
                  {lastDelta > 0 ? `+${lastDelta}%` : `${lastDelta}%`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Alas Tanah Rumput di Bawah Tiang */}
        <div className="relative z-10 h-5 w-full bg-gradient-to-r from-emerald-800 via-emerald-600 to-emerald-800 border-t-2 border-emerald-400/50 flex items-center justify-center">
          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-100/85">
            Garis Awal • 0%
          </span>
        </div>
      </div>

      {/* Footer opsional (diaktifkan untuk grid host compact; dimatikan di layar siswa agar tidak duplikat) */}
      {showProgressFooter && (
        <div className="w-full max-w-[260px] space-y-1">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-300 truncate max-w-[160px]">
              {namaPemain || 'Ketinggian'}
            </span>
            <span className={`font-mono font-black ${isPuncak ? 'text-amber-400' : 'text-white'}`}>
              {safePosisi}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-0.5">
            <div
              style={{ width: `${safePosisi}%` }}
              className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${
                isPuncak
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                  : 'bg-gradient-to-r from-[#D7262E] via-amber-400 to-emerald-400'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
