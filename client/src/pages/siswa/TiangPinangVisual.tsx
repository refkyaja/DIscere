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
        <div
          className={`relative h-44 w-28 rounded-2xl bg-gradient-to-b from-[#6cc8ff] via-[#cdeeff] to-[#eaf8ff] border-2 overflow-hidden shadow-sm flex flex-col justify-between p-2 ${
            isPuncak ? 'border-[#ffb81c] ring-2 ring-[#ffb81c]/45' : 'border-[#f0dfb4]'
          }`}
        >
          {/* Awan dekoratif cerah */}
          <div className="absolute top-3 left-2 w-7 h-2.5 rounded-full bg-white/80 pointer-events-none" />
          <div className="absolute top-5 right-2 w-6 h-2 rounded-full bg-white/75 pointer-events-none" />

          {/* Garis skala ringkas */}
          <div className="absolute inset-x-2 top-8 bottom-3 pointer-events-none">
            {[100, 50, 0].map((mark) => (
              <div
                key={mark}
                style={{ bottom: `${mark}%` }}
                className="absolute inset-x-0 flex items-center gap-1"
              >
                <span
                  className={`text-[8px] font-mono font-extrabold w-6 text-right ${
                    mark === 100 ? 'text-[#b81f1c]' : 'text-[#2b2a4a]/65'
                  }`}
                >
                  {mark}%
                </span>
                <div
                  className={`flex-1 border-t border-dashed ${
                    mark === 100 ? 'border-[#e2312d]/50' : 'border-[#2b2a4a]/20'
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Puncak hadiah */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#fffdf6] border border-[#ffb81c] shadow-xs">
              <Flag className="w-2.5 h-2.5 text-[#e2312d] fill-[#e2312d]" />
              <Trophy className="w-3 h-3 text-[#e6a100]" />
            </div>
            <div className="w-12 h-1.5 rounded-full bg-gradient-to-r from-[#8d5c2b] via-[#ffb81c] to-[#8d5c2b] border border-[#b87800] mt-0.5" />
          </div>

          {/* Batang tiang */}
          <div className="absolute top-7 bottom-2.5 left-1/2 -translate-x-1/2 w-3 rounded-t-md shadow-sm overflow-hidden border border-[#6b4423] bg-gradient-to-r from-[#8d5c2b] via-[#d99b52] to-[#8d5c2b]">
            <div className="h-full w-full flex flex-col justify-evenly opacity-45">
              <div className="h-[1px] bg-[#6b4423]" />
              <div className="h-[1px] bg-[#6b4423]" />
              <div className="h-[1px] bg-[#6b4423]" />
              <div className="h-[1px] bg-[#6b4423]" />
            </div>
            {hasLicin && (
              <div className="absolute inset-0 bg-gradient-to-b from-sky-200/80 via-cyan-100/70 to-sky-300/80 animate-pulse motion-reduce:animate-none" />
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
                  className={`mb-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-black font-mono flex items-center gap-0.5 shadow-sm border ${
                    lastDelta > 0
                      ? 'bg-[#e9f9ef] text-[#1f9d55] border-[#1f9d55]'
                      : 'bg-[#fdecec] text-[#d63b3b] border-[#d63b3b]'
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

          <div className="relative z-10 h-2.5 w-full rounded-b-md bg-gradient-to-b from-[#5fb84f] to-[#3f9b46] border-t-2 border-[#35833b]" />
        </div>

        {showProgressFooter && (
          <div className="w-full max-w-[140px] space-y-1">
            <div className="flex items-center justify-between text-[11px] font-extrabold">
              <span className="text-[#2b2a4a] truncate max-w-[88px]">
                {namaPemain || 'Ketinggian'}
              </span>
              <span className={`font-mono font-black ${isPuncak ? 'text-[#e6a100]' : 'text-[#1f9d55]'}`}>
                {safePosisi}%
              </span>
            </div>
            <div className="w-full h-2 bg-[#f0dfb4] rounded-full overflow-hidden border border-[#e6cfa0]">
              <div
                style={{ width: `${safePosisi}%` }}
                className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${
                  isPuncak
                    ? 'bg-gradient-to-r from-[#ffb81c] to-[#ffd23f]'
                    : 'bg-gradient-to-r from-[#e2312d] via-[#ffb81c] to-[#1f9d55]'
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
      {/* Arena Tiang Pinang Skala Penuh (Tema Festival 17 Agustus Cerah) */}
      <div
        className={`relative w-full h-[275px] min-h-[275px] sm:h-[320px] sm:min-h-[320px] md:flex-1 md:h-auto md:min-h-[400px] rounded-[22px] bg-gradient-to-b from-[#6cc8ff] via-[#cdeeff] to-[#eaf8ff] border-[2.5px] overflow-hidden shadow-inner flex flex-col justify-between ${
          isPuncak ? 'border-[#ffb81c] ring-2 ring-[#ffb81c]/35' : 'border-[#f0dfb4]'
        }`}
      >
        {/* Matahari & Awan Karnaval */}
        <div
          className="absolute top-3 right-4 w-9 h-9 rounded-full bg-[#ffd23f] pointer-events-none"
          style={{ boxShadow: '0 0 0 8px rgba(255,210,63,0.32), 0 0 0 18px rgba(255,210,63,0.16)' }}
        />
        <div className="absolute top-5 left-5 w-16 h-5 rounded-full bg-white/85 shadow-xs pointer-events-none" />
        <div className="absolute top-12 right-12 w-12 h-4 rounded-full bg-white/80 shadow-xs pointer-events-none" />

        {/* Kilau Perayaan saat Mencapai Puncak 100% */}
        {isPuncak && (
          <div className="absolute inset-x-0 top-0 h-32 pointer-events-none bg-gradient-to-b from-[#ffb81c]/35 to-transparent" />
        )}

        {/* Garis Skala Ketinggian 25%, 50%, 75%, 100% */}
        <div className="absolute inset-x-3 sm:inset-x-4 top-[56px] bottom-[24px] pointer-events-none">
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
                    isTarget ? 'text-[#b81f1c]' : 'text-[#2b2a4a]/75'
                  }`}
                >
                  {mark}%
                </span>
                <div
                  className={`flex-1 ${
                    isTarget
                      ? 'border-t-2 border-dashed border-[#e2312d]/65'
                      : 'border-t border-dashed border-[#2b2a4a]/20'
                  }`}
                />
                {isTarget && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#e2312d] text-white border border-white shadow-xs shrink-0">
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
            <span className="w-3 h-3 rounded-full bg-[#e2312d] border-2 border-white shadow-sm" />
          </div>
        </div>

        {/* Roda Hadiah Puncak 100% + Bendera Merah Putih */}
        <div className="relative z-10 flex flex-col items-center pt-2 px-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fffdf6] border-2 border-[#ffb81c] shadow-sm">
            <Flag className="w-3.5 h-3.5 text-[#e2312d] fill-[#e2312d] shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider text-[#7a5200]">
              Puncak 100%
            </span>
            <Trophy className="w-3.5 h-3.5 text-[#e6a100] shrink-0" />
          </div>
          {/* Roda bambu puncak + gantungan hadiah 17-an */}
          <div className="relative w-24 sm:w-28 h-2.5 rounded-full bg-gradient-to-r from-[#8d5c2b] via-[#ffb81c] to-[#8d5c2b] border border-[#b87800] shadow-sm mt-1 flex items-center justify-around">
            <span className="w-2 h-3 bg-[#e2312d] rounded-b-sm translate-y-1.5 shadow-xs" />
            <span className="w-2 h-3 bg-[#ffb81c] rounded-b-sm translate-y-1.5 shadow-xs" />
            <span className="w-2 h-3 bg-white border border-[#f0dfb4] rounded-b-sm translate-y-1.5 shadow-xs" />
            <span className="w-2 h-3 bg-[#1d8fe0] rounded-b-sm translate-y-1.5 shadow-xs" />
          </div>
        </div>

        {/* Batang Tiang Pinang Vertikal di Tengah */}
        <div className="absolute top-[46px] bottom-[22px] left-1/2 -translate-x-1/2 w-5 sm:w-6 rounded-t-lg shadow-md overflow-hidden border-2 border-[#6b4423] bg-gradient-to-r from-[#8d5c2b] via-[#d99b52] to-[#8d5c2b]">
          {/* Ruas bambu/batang pinang */}
          <div className="h-full w-full flex flex-col justify-evenly opacity-50">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="h-[1.5px] bg-[#6b4423]" />
            ))}
          </div>
          {/* Kilau minyak saat Tiang Licin aktif */}
          {hasLicin && (
            <div className="absolute inset-0 bg-gradient-to-b from-sky-200/80 via-cyan-100/70 to-sky-300/80 animate-pulse motion-reduce:animate-none" />
          )}
        </div>

        {/* Zona Lintasan Karakter Pemanjat (0..100% bebas terpotong) */}
        <div className="absolute inset-x-0 top-[56px] bottom-[24px] pointer-events-none">
          <div
            style={{ bottom: bottomCalc }}
            className="absolute left-1/2 -translate-x-1/2 z-20 transition-[bottom] duration-500 ease-out motion-reduce:transition-none flex items-center justify-center"
          >
            {/* Karakter 2D Pemanjat Panjat Pinang dengan aura & animasi naik/turun */}
            <div
              key={`char-full-${reactionNonce}`}
              className={`relative flex items-center justify-center rounded-2xl p-1 ${animClass} ${
                isPuncak
                  ? 'ring-2 ring-[#ffb81c] bg-[#fff3c4]/70'
                  : hasPerisai
                  ? 'ring-2 ring-[#1f9d55] bg-[#e9f9ef]/70'
                  : hasPegangan
                  ? 'ring-2 ring-[#e6a100] bg-[#fff8dc]/70'
                  : hasLicin
                  ? 'ring-2 ring-[#1d8fe0] bg-[#e9f4ff]/70'
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
                  className="absolute -right-1.5 -top-1.5 bg-[#1f9d55] text-white rounded-full p-1 shadow-md border-2 border-white"
                  title="Perisai Kulit Pisang Aktif"
                >
                  <Shield className="w-3 h-3" />
                </span>
              )}
              {hasPegangan && (
                <span
                  className="absolute -left-1.5 -top-1.5 bg-[#ffb81c] text-[#4a3000] rounded-full p-1 shadow-md border-2 border-white"
                  title="Pegangan Kuat Aktif"
                >
                  <HandMetal className="w-3 h-3" />
                </span>
              )}
              {hasLicin && (
                <span
                  className="absolute -right-1.5 bottom-0 bg-[#1d8fe0] text-white rounded-full p-1 shadow-md border-2 border-white"
                  title="Awas Tiang Licin"
                >
                  <Droplets className="w-3 h-3" />
                </span>
              )}

              {/* Sparkle Puncak */}
              {isPuncak && (
                <span className="absolute -left-2 -top-2 bg-[#ffb81c] text-[#4a3000] rounded-full p-1 shadow-md border border-white">
                  <Sparkles className="w-3 h-3" />
                </span>
              )}

              {/* Delta badge di samping kanan karakter agar bebas terpotong saat posisi 100% */}
              {lastDelta !== undefined && lastDelta !== null && lastDelta !== 0 && (
                <span
                  key={`delta-${reactionNonce}`}
                  className={`absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-0.5 rounded-full text-xs font-extrabold font-mono flex items-center gap-0.5 shadow-md whitespace-nowrap border-2 motion-safe:panjat-anim-feedback ${
                    lastDelta > 0
                      ? 'bg-[#e9f9ef] text-[#1f9d55] border-[#1f9d55]'
                      : 'bg-[#fdecec] text-[#d63b3b] border-[#d63b3b]'
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

        {/* Alas Tanah Rumput Festival di Bawah Tiang */}
        <div className="relative z-10 h-6 w-full bg-gradient-to-b from-[#5fb84f] to-[#3f9b46] border-t-2 border-[#35833b] flex items-center justify-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-white drop-shadow-xs">
            Garis Awal • 0%
          </span>
        </div>
      </div>

      {/* Footer opsional (diaktifkan untuk grid host compact; dimatikan di layar siswa agar tidak duplikat) */}
      {showProgressFooter && (
        <div className="w-full max-w-[260px] space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="text-[#2b2a4a] truncate max-w-[160px]">
              {namaPemain || 'Ketinggian'}
            </span>
            <span className={`font-mono font-black ${isPuncak ? 'text-[#e6a100]' : 'text-[#1f9d55]'}`}>
              {safePosisi}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#f0dfb4] rounded-full overflow-hidden border border-[#e6cfa0]">
            <div
              style={{ width: `${safePosisi}%` }}
              className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${
                isPuncak
                  ? 'bg-gradient-to-r from-[#ffb81c] to-[#ffd23f]'
                  : 'bg-gradient-to-r from-[#e2312d] via-[#ffb81c] to-[#1f9d55]'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
