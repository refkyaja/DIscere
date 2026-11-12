import { Shield, HandMetal, Droplets, Flag, Trophy, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import KarakterPanjatPinang, { EkspresiKarakterPanjat } from './KarakterPanjatPinang';
import { hitungGeometriTiangPanjat } from './panjatPinangVisualMath';

export interface EfekAktifVisual {
  tiangLicin?: boolean;
  perisaiKulitPisang?: boolean;
  peganganKuat?: boolean;
  menungguBonusKulitPisang?: boolean;
}

export interface TiangPinangVisualProps {
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

const WORLD_PARALLAX_CLOUDS = [
  { bottomPct: 22, leftClass: 'left-3', sizeClass: 'w-12 h-3.5 opacity-80' },
  { bottomPct: 44, rightClass: 'right-4', sizeClass: 'w-14 h-4 opacity-75' },
  { bottomPct: 66, leftClass: 'left-5', sizeClass: 'w-16 h-4.5 opacity-80' },
  { bottomPct: 84, rightClass: 'right-6', sizeClass: 'w-11 h-3.5 opacity-75' },
] as const;

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
  const geom = hitungGeometriTiangPanjat({ posisi, status, compact });
  const {
    safePosisi,
    isPuncak,
    worldHeightPct,
    cameraTranslateYPct,
    revealFromBottomPct,
    topClipPct,
    bottomCalc,
  } = geom;

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

  const animClass = isPuncak
    ? 'motion-safe:panjat-anim-summit'
    : lastDelta !== undefined && lastDelta !== null && lastDelta > 0
    ? 'motion-safe:panjat-anim-climb'
    : lastDelta !== undefined && lastDelta !== null && lastDelta < 0
    ? 'motion-safe:panjat-anim-slip'
    : '';

  const cameraTransitionDuration = isPuncak ? 'duration-700' : 'duration-500';
  const trackInsetClass = compact ? 'top-[30px] bottom-[10px]' : 'top-[56px] bottom-[24px]';
  const poleInsetClass = compact ? 'top-[24px] bottom-[10px]' : 'top-[46px] bottom-[22px]';
  const segmentCount = compact ? 10 : 16;
  const rulerMarks = compact ? ([100, 75, 50, 25] as const) : ([100, 75, 50, 25] as const);

  return (
    <div
      className={
        compact
          ? 'flex flex-col items-center gap-2 select-none'
          : 'w-full md:h-full md:flex-1 flex flex-col items-center gap-3 select-none'
      }
      data-panjat-posisi={safePosisi}
      data-panjat-reveal={revealFromBottomPct}
      data-panjat-puncak={isPuncak ? 'true' : 'false'}
    >
      {/* Viewport Kamera Progressive Pole Reveal */}
      <div
        className={
          compact
            ? `relative h-44 w-[124px] rounded-2xl border-2 overflow-hidden shadow-sm transition-colors duration-500 motion-reduce:transition-none ${
                isPuncak ? 'border-[#ffb81c] ring-2 ring-[#ffb81c]/45' : 'border-[#f0dfb4]'
              }`
            : `relative w-full h-[275px] min-h-[275px] sm:h-[320px] sm:min-h-[320px] md:flex-1 md:h-auto md:min-h-[400px] rounded-[22px] border-[2.5px] overflow-hidden shadow-inner transition-colors duration-500 motion-reduce:transition-none ${
                isPuncak ? 'border-[#ffb81c] ring-2 ring-[#ffb81c]/35' : 'border-[#f0dfb4]'
              }`
        }
        style={{
          background: isPuncak
            ? 'linear-gradient(180deg, #4cb8ff 0%, #bfe6ff 55%, #fff6d6 100%)'
            : safePosisi >= 70
            ? 'linear-gradient(180deg, #57beff 0%, #c6ebff 62%, #eefaff 100%)'
            : 'linear-gradient(180deg, #74ccff 0%, #d2efff 62%, #edf9ff 100%)',
        }}
      >
        {/* Langit Atas Statis + Matahari + Indikator Ketinggian */}
        <div
          className={`absolute rounded-full bg-[#ffd23f] pointer-events-none ${
            compact ? 'top-2 right-2 w-4 h-4' : 'top-3 right-4 w-9 h-9'
          }`}
          style={{
            boxShadow: compact
              ? '0 0 0 4px rgba(255,210,63,0.3)'
              : '0 0 0 8px rgba(255,210,63,0.32), 0 0 0 18px rgba(255,210,63,0.16)',
          }}
        />

        {!compact && (
          <div className="absolute bottom-8 right-2.5 z-30 pointer-events-none">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-black border shadow-xs backdrop-blur-[2px] ${
                isPuncak
                  ? 'bg-[#fff3c4]/95 border-[#ffb81c] text-[#7a5200]'
                  : 'bg-white/85 border-[#f0dfb4] text-[#2b2a4a]'
              }`}
            >
              {isPuncak ? <Sparkles className="w-3 h-3 text-[#e6a100]" /> : <Flag className="w-3 h-3 text-[#e2312d]" />}
              {safePosisi}%
            </span>
          </div>
        )}

        {/* Kilau Perayaan Puncak */}
        {isPuncak && (
          <div
            className={`absolute inset-x-0 top-0 pointer-events-none bg-gradient-to-b from-[#ffb81c]/35 to-transparent ${
              compact ? 'h-16' : 'h-36'
            }`}
          />
        )}

        {/* Kontainer Dunia (Camera Pan + Smooth Pull-Back di 100%) */}
        <div
          data-panjat-camera="true"
          style={{
            height: `${worldHeightPct}%`,
            transform: `translate3d(0, ${cameraTranslateYPct}%, 0)`,
          }}
          className={`absolute inset-x-0 bottom-0 will-change-transform transition-[transform,height] ${cameraTransitionDuration} ease-out motion-reduce:transition-none`}
        >
          {/* Awan Paralaks Ketinggian di dalam Dunia */}
          {WORLD_PARALLAX_CLOUDS.map((cloud, idx) => (
            <div
              key={idx}
              style={{ bottom: `${cloud.bottomPct}%` }}
              className={`absolute rounded-full bg-white shadow-xs pointer-events-none ${
                'leftClass' in cloud ? cloud.leftClass : cloud.rightClass
              } ${compact ? 'w-7 h-2 opacity-75' : cloud.sizeClass}`}
            />
          ))}

          {/* Batang Tiang Pinang Tunggal Tinggi Penuh (TIDAK terpotong di tengah langit, utuh hingga puncak) */}
          <div
            data-panjat-pole-rod="true"
            className={`absolute ${poleInsetClass} left-1/2 -translate-x-1/2 ${
              compact ? 'w-3 rounded-t-md border' : 'w-5 sm:w-6 rounded-t-lg border-2'
            } shadow-md overflow-hidden border-[#6b4423] bg-gradient-to-r from-[#8d5c2b] via-[#d99b52] to-[#8d5c2b]`}
          >
            <div className="h-full w-full flex flex-col justify-evenly opacity-50">
              {Array.from({ length: segmentCount }).map((_, idx) => (
                <div key={idx} className={compact ? 'h-[1px] bg-[#6b4423]' : 'h-[1.5px] bg-[#6b4423]'} />
              ))}
            </div>
            {hasLicin && (
              <div className="absolute inset-0 bg-gradient-to-b from-sky-200/80 via-cyan-100/70 to-sky-300/80 motion-safe:animate-pulse motion-reduce:animate-none" />
            )}
          </div>

          {/* Lapisan Progressive Pole Reveal & Masking Puncak Hadiah (Terbuka mulus seiring mendekati puncak) */}
          <div
            data-panjat-pole-mask="true"
            style={{ clipPath: `inset(${topClipPct}% 0 0 0)` }}
            className={`absolute inset-0 will-change-[clip-path] transition-[clip-path] ${cameraTransitionDuration} ease-out motion-reduce:transition-none flex flex-col justify-between ${
              compact ? 'px-1.5 pt-1' : 'pt-2'
            }`}
          >
            {/* Puncak Hadiah 100%, Roda Bambu & Bendera Merah-Putih (Baru terbuka saat mendekati atas) */}
            {compact ? (
              <div className="relative z-10 flex flex-col items-center pointer-events-none">
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#fffdf6] border border-[#ffb81c] shadow-xs">
                  <Flag className="w-2.5 h-2.5 text-[#e2312d] fill-[#e2312d]" />
                  <Trophy className="w-3 h-3 text-[#e6a100]" />
                </div>
                <div className="w-12 h-1.5 rounded-full bg-gradient-to-r from-[#8d5c2b] via-[#ffb81c] to-[#8d5c2b] border border-[#b87800] mt-0.5 flex items-center justify-around">
                  <span className="w-1 h-1.5 bg-[#e2312d] rounded-b-xs translate-y-0.5" />
                  <span className="w-1 h-1.5 bg-[#ffb81c] rounded-b-xs translate-y-0.5" />
                  <span className="w-1 h-1.5 bg-[#1d8fe0] rounded-b-xs translate-y-0.5" />
                </div>
              </div>
            ) : (
              <div className="relative z-10 flex flex-col items-center px-2 pointer-events-none">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fffdf6] border-2 border-[#ffb81c] shadow-sm ${
                    isPuncak ? 'motion-safe:animate-bounce' : ''
                  }`}
                  style={isPuncak ? { animationDuration: '1.6s' } : undefined}
                >
                  <Flag className="w-3.5 h-3.5 text-[#e2312d] fill-[#e2312d] shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#7a5200]">
                    Puncak 100%
                  </span>
                  <Trophy className="w-3.5 h-3.5 text-[#e6a100] shrink-0" />
                </div>
                <div className="relative w-24 sm:w-28 h-2.5 rounded-full bg-gradient-to-r from-[#8d5c2b] via-[#ffb81c] to-[#8d5c2b] border border-[#b87800] shadow-sm mt-1 flex items-center justify-around">
                  <span className="w-2 h-3 bg-[#e2312d] rounded-b-sm translate-y-1.5 shadow-xs" />
                  <span className="w-2 h-3 bg-[#ffb81c] rounded-b-sm translate-y-1.5 shadow-xs" />
                  <span className="w-2 h-3 bg-white border border-[#f0dfb4] rounded-b-sm translate-y-1.5 shadow-xs" />
                  <span className="w-2 h-3 bg-[#1d8fe0] rounded-b-sm translate-y-1.5 shadow-xs" />
                </div>
              </div>
            )}

            {/* Garis Skala Ketinggian Dunia (Terungkap seiring tiang memanjang ke atas) */}
            <div
              className={`absolute ${
                compact ? 'inset-x-1.5' : 'inset-x-3 sm:inset-x-4 pl-3'
              } ${trackInsetClass} pointer-events-none`}
            >
              {rulerMarks.map((mark) => {
                const isTarget = mark === 100;
                return (
                  <div
                    key={mark}
                    style={{ bottom: `${mark}%` }}
                    className={`absolute inset-x-0 translate-y-1/2 flex items-center ${
                      compact ? 'gap-1' : 'gap-2'
                    }`}
                  >
                    <span
                      className={
                        compact
                          ? `text-[8px] font-mono font-extrabold w-6 text-right ${
                              isTarget ? 'text-[#b81f1c]' : 'text-[#2b2a4a]/65'
                            }`
                          : `text-[10px] sm:text-[11px] font-mono font-extrabold w-9 text-right shrink-0 ${
                              isTarget ? 'text-[#b81f1c]' : 'text-[#2b2a4a]/75'
                            }`
                      }
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
                    {!compact && isTarget && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#e2312d] text-white border border-white shadow-xs shrink-0">
                        Target
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Alas Tanah Rumput Festival di Dasar Tiang (0%) */}
            {compact ? (
              <div className="relative z-10 h-2.5 w-full rounded-b-md bg-gradient-to-b from-[#5fb84f] to-[#3f9b46] border-t-2 border-[#35833b]" />
            ) : (
              <div className="relative z-10 h-6 w-full bg-gradient-to-b from-[#5fb84f] to-[#3f9b46] border-t-2 border-[#35833b] flex items-center justify-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-white drop-shadow-xs">
                  Garis Awal • 0%
                </span>
              </div>
            )}
          </div>

          {/* Zona Track Karakter Pemanjat (Terikat erat pada permukaan tiang terlihat 0..100%) */}
          <div className={`absolute inset-x-0 ${trackInsetClass} pointer-events-none`}>
            {/* Penanda titik aktif di penggaris kiri */}
            {!compact && (
              <div
                style={{ bottom: `calc(${safePosisi}% - ${(safePosisi / 100) * 10}px)` }}
                className="absolute left-2 sm:left-2.5 z-10 flex items-center transition-[bottom] duration-500 ease-out motion-reduce:transition-none"
              >
                <span className="w-3 h-3 rounded-full bg-[#e2312d] border-2 border-white shadow-sm" />
              </div>
            )}

            <div
              data-panjat-character="true"
              style={{ bottom: bottomCalc }}
              className="absolute left-1/2 -translate-x-1/2 z-20 transition-[bottom] duration-500 ease-out motion-reduce:transition-none flex items-center justify-center"
            >
              <div
                key={`char-${compact ? 'compact' : 'full'}-${reactionNonce}`}
                className={`relative flex items-center justify-center ${
                  compact ? 'rounded-xl' : 'rounded-2xl p-1'
                } ${animClass} ${
                  compact
                    ? ''
                    : isPuncak
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
                  size={compact ? 'xs' : 'lg'}
                  streak={streak}
                />

                {!compact && hasPerisai && (
                  <span
                    className="absolute -right-1.5 -top-1.5 bg-[#1f9d55] text-white rounded-full p-1 shadow-md border-2 border-white"
                    title="Perisai Kulit Pisang Aktif"
                  >
                    <Shield className="w-3 h-3" />
                  </span>
                )}
                {!compact && hasPegangan && (
                  <span
                    className="absolute -left-1.5 -top-1.5 bg-[#ffb81c] text-[#4a3000] rounded-full p-1 shadow-md border-2 border-white"
                    title="Pegangan Kuat Aktif"
                  >
                    <HandMetal className="w-3 h-3" />
                  </span>
                )}
                {!compact && hasLicin && (
                  <span
                    className="absolute -right-1.5 bottom-0 bg-[#1d8fe0] text-white rounded-full p-1 shadow-md border-2 border-white"
                    title="Awas Tiang Licin"
                  >
                    <Droplets className="w-3 h-3" />
                  </span>
                )}
                {!compact && isPuncak && (
                  <span className="absolute -left-2 -top-2 bg-[#ffb81c] text-[#4a3000] rounded-full p-1 shadow-md border border-white">
                    <Sparkles className="w-3 h-3" />
                  </span>
                )}

                {lastDelta !== undefined && lastDelta !== null && lastDelta !== 0 && (
                  <span
                    key={`delta-${reactionNonce}`}
                    className={`absolute left-full top-1/2 -translate-y-1/2 rounded-full font-extrabold font-mono flex items-center gap-0.5 shadow-md whitespace-nowrap motion-safe:panjat-anim-feedback ${
                      compact
                        ? 'ml-1 px-1.5 py-0.2 text-[9px] border'
                        : 'ml-1.5 sm:ml-2 px-2 py-0.5 text-[11px] sm:text-xs border-2'
                    } ${
                      lastDelta > 0
                        ? 'bg-[#e9f9ef] text-[#1f9d55] border-[#1f9d55]'
                        : 'bg-[#fdecec] text-[#d63b3b] border-[#d63b3b]'
                    }`}
                  >
                    {!compact &&
                      (lastDelta > 0 ? (
                        <ArrowUp className="w-3 h-3 stroke-[3]" />
                      ) : (
                        <ArrowDown className="w-3 h-3 stroke-[3]" />
                      ))}
                    {lastDelta > 0 ? `+${lastDelta}%` : `${lastDelta}%`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Progres Opsional */}
      {showProgressFooter && (
        <div className={compact ? 'w-full max-w-[140px] space-y-1' : 'w-full max-w-[260px] space-y-1'}>
          <div
            className={`flex items-center justify-between font-extrabold ${
              compact ? 'text-[11px]' : 'text-xs'
            }`}
          >
            <span className={`text-[#2b2a4a] truncate ${compact ? 'max-w-[88px]' : 'max-w-[160px]'}`}>
              {namaPemain || 'Ketinggian'}
            </span>
            <span className={`font-mono font-black ${isPuncak ? 'text-[#e6a100]' : 'text-[#1f9d55]'}`}>
              {safePosisi}%
            </span>
          </div>
          <div
            className={`w-full bg-[#f0dfb4] rounded-full overflow-hidden border border-[#e6cfa0] ${
              compact ? 'h-2' : 'h-2.5'
            }`}
          >
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
