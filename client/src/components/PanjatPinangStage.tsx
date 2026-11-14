import React, { useId, useMemo } from 'react';
import { ArrowLeft, RotateCcw, Pause, Play, StopCircle } from 'lucide-react';
import './balapKarungFestival.css';
import { PanjatClimberAvatar, ClimberLook } from './PanjatClimberAvatar';

export interface TiangStageItem {
  id: string;
  label: string;
  warna: string;
  posisiPersen: number; // 0..100
  jatuhBebas?: boolean;
  bubbleText?: string;
  isPuncak?: boolean;
  ekspresi?: 'netral' | 'bahagia' | 'sedih' | 'puncak';
  xPct: number; // 0..100
}

export interface PanjatPinangStageProps {
  tiangList: TiangStageItem[];
  crowdCheer?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
  statusLabel?: string;
  targetLabel?: string;
  ruleSummary?: string;
  onBack?: () => void;
  backLabel?: string;
  onUlang?: () => void;
  onTogglePause?: () => void;
  isPaused?: boolean;
  onStop?: () => void;
  stopLabel?: string;
  extraBadges?: React.ReactNode;
}

const ZONES_OLI = [
  [120, 165],
  [205, 250],
] as const;

const ANC_ROPES = [25, 50, 75] as const;
const PH = 340;
const HC = 96;

export function PanjatPinangStage({
  tiangList,
  crowdCheer = false,
  className = '',
  title,
  subtitle,
  statusLabel,
  targetLabel,
  ruleSummary,
  onBack,
  backLabel = 'Pengaturan',
  onUlang,
  onTogglePause,
  isPaused,
  onStop,
  stopLabel = 'Akhiri',
  extraBadges,
}: PanjatPinangStageProps) {
  const reactId = useId().replace(/:/g, '');
  const patternId = `pp-town-${reactId}`;

  // 46 bendera bunting atas dan bawah
  const buntings = useMemo(() => Array.from({ length: 46 }, (_, i) => i), []);

  // 34 penonton belakang
  const crowdBack = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => ({
        idx: i,
        w: 28 + ((i * 7) % 9),
        c: ['#e2312d', '#ffffff', '#1d8fe0', '#ffb81c', '#1f9d55', '#ff7a59', '#7a3fd0'][i % 7],
        sk: ['#ffd9a8', '#e8b27d', '#c58c5a', '#f3c99b'][i % 4],
        hr: ['#2b2a4a', '#4a2c17', '#111111', '#6b3b1e'][(i * 3) % 4],
        flag: i % 3 === 0,
      })),
    []
  );

  // Genangan air lumpur acak stabil
  const puddles = useMemo(
    () => [
      { left: 12, top: 25, w: 90 },
      { left: 38, top: 45, w: 120 },
      { left: 62, top: 20, w: 85 },
      { left: 82, top: 55, w: 105 },
      { left: 24, top: 70, w: 110 },
      { left: 74, top: 78, w: 95 },
    ],
    []
  );

  return (
    <div
      className={`relative w-full overflow-hidden select-none shadow-md ${className}`}
      style={
        {
          '--H': '560px',
          '--hz': '230px',
          '--PH': '340px',
          height: '560px',
          background: 'linear-gradient(180deg, #69c6ff 0%, #cdeeff 42%, #f4fbff 100%)',
          borderBottom: '4px solid #7a4e22',
        } as React.CSSProperties
      }
    >
      {/* 0. Top Floating HUD (Persis Desain panjat-pinang-solo.html .top) */}
      {title && (
        <header
          className="absolute z-30 top-3 left-3 right-3 max-w-[1100px] mx-auto bg-[#fffaf0]/95 border-2 border-[#e6d3ae] rounded-2xl p-2.5 sm:p-3 shadow-md flex flex-col gap-1.5 pointer-events-auto"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1.5 rounded-xl bg-[#fff3d6] border border-[#f0dfb4] text-[#2b2a4a] hover:bg-[#fde9b8] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{backLabel}</span>
              </button>
            )}

            <h1 className="text-base sm:text-lg font-extrabold text-[#2b2a4a] font-['Baloo_2',cursive]">
              {title}
            </h1>

            {subtitle && (
              <span className="bk-chip text-xs">
                {subtitle}
              </span>
            )}

            {statusLabel && (
              <span className="bk-chip live text-xs">
                {statusLabel}
              </span>
            )}

            {targetLabel && (
              <span className="bk-chip yellow text-xs">
                {targetLabel}
              </span>
            )}

            {extraBadges}

            {onUlang && (
              <button
                type="button"
                onClick={onUlang}
                className="inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1 rounded-xl bg-[#fff3d6] border border-[#f0dfb4] text-[#2b2a4a] hover:bg-[#fde9b8] transition-colors cursor-pointer ml-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ulang</span>
              </button>
            )}
          </div>

          {(ruleSummary || onTogglePause || onStop) && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f0dfb4]/60 pt-1 text-xs">
              <span className="text-[#6b6a85] font-extrabold">
                {ruleSummary}
              </span>

              <div className="flex items-center gap-2 ml-auto">
                {onTogglePause && (
                  <button
                    type="button"
                    onClick={onTogglePause}
                    className="inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1 rounded-xl bg-[#fff0c9] border border-[#f3d37a] text-[#7a5200] hover:bg-[#ffe39c] transition-colors cursor-pointer"
                  >
                    {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    <span>{isPaused ? 'Lanjutkan' : 'Jeda'}</span>
                  </button>
                )}

                {onStop && (
                  <button
                    type="button"
                    onClick={onStop}
                    className="inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1 rounded-xl bg-[#ffe3e1] border border-[#f5b5b1] text-[#a3201c] hover:bg-[#fcd0cd] transition-colors cursor-pointer"
                  >
                    <StopCircle className="w-3 h-3" />
                    <span>{stopLabel}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </header>
      )}

      {/* 1. Matahari Kuning Berpendar */}
      <div
        className="absolute rounded-full"
        style={{
          left: '8%',
          top: '120px',
          width: '62px',
          height: '62px',
          background: '#ffd23f',
          boxShadow: '0 0 0 12px rgba(255,210,63,.3), 0 0 0 26px rgba(255,210,63,.15)',
          zIndex: 1,
        }}
      />

      {/* 2. Awan Putih Bergerak */}
      <div
        className="bk-cloud"
        style={{ width: '110px', top: '140px', left: '30%', zIndex: 1 }}
      />
      <div
        className="bk-cloud"
        style={{ width: '90px', top: '168px', left: '64%', animationDuration: '100s', zIndex: 1 }}
      />

      {/* 3. Skyline Rumah & Pepohonan Latar Belakang */}
      <svg
        className="absolute left-0 right-0 w-full"
        style={{ top: 'calc(var(--hz) - 164px)', height: '150px', zIndex: 2 }}
        height="150"
        aria-hidden="true"
      >
        <defs>
          <pattern id={patternId} width="600" height="150" patternUnits="userSpaceOnUse">
            <rect x="60" y="35" width="60" height="110" fill="#ddcdb7" stroke="#7b6f5c" strokeWidth="2" />
            <path d="M55 35h70l-35-22z" fill="#d4452f" />
            <g fill="#fff6c2">
              <rect x="72" y="52" width="9" height="11" />
              <rect x="98" y="52" width="9" height="11" />
              <rect x="72" y="76" width="9" height="11" />
              <rect x="98" y="76" width="9" height="11" />
            </g>
            <rect x="330" y="62" width="70" height="90" fill="#ddcdb7" stroke="#7b6f5c" strokeWidth="2" />
            <path d="M325 62h80l-40-20z" fill="#d4452f" />
            <g fill="#fff6c2">
              <rect x="344" y="78" width="9" height="11" />
              <rect x="376" y="78" width="9" height="11" />
            </g>
            <rect x="220" y="55" width="20" height="95" fill="#8e949c" />
            <rect x="250" y="72" width="20" height="78" fill="#a2a8b0" />
            <path d="M560 20V140" stroke="#7b6f5c" strokeWidth="3" />
            <rect x="560" y="22" width="34" height="11" fill="#e2312d" />
            <rect x="560" y="33" width="34" height="11" fill="#fff" />
            <path d="M0 150V100Q150 70 300 100T600 100V150Z" fill="#9fd685" />
            <rect x="478" y="95" width="8" height="40" fill="#6b4423" />
            <circle cx="482" cy="80" r="26" fill="#2f8f3f" />
            <rect x="16" y="105" width="7" height="35" fill="#6b4423" />
            <circle cx="20" cy="92" r="18" fill="#2f8f3f" />
          </pattern>
        </defs>
        <rect width="100%" height="150" fill={`url(#${patternId})`} />
      </svg>

      {/* 4. Tiang Bambu Umbul-Umbul */}
      {[9, 33, 67, 91].map((pos) => (
        <div
          key={pos}
          className="absolute"
          style={{
            left: `${pos}%`,
            bottom: 'calc(var(--H) - var(--hz) - 4px)',
            width: '4px',
            height: '190px',
            background: '#6b4a2f',
            zIndex: 1,
          }}
        >
          <div
            className="absolute"
            style={{
              left: '4px',
              top: '0px',
              width: '34px',
              height: '16px',
              background: 'linear-gradient(#e2312d 50%, #fff 50%)',
            }}
          />
        </div>
      ))}

      {/* 5. Penonton Belakang Pagar */}
      <div
        className={`absolute left-0 right-0 flex items-end justify-around px-1 ${
          crowdCheer ? 'cheer' : ''
        }`}
        style={{
          top: 'calc(var(--hz) - 100px)',
          height: '104px',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        {crowdBack.map((sp) => (
          <svg
            key={sp.idx}
            width={sp.w}
            viewBox="0 -16 40 92"
            className="bk-spec"
            style={{ animationDelay: `-${(sp.idx * 0.2).toFixed(2)}s` }}
          >
            <ellipse cx="20" cy="74" rx="15" ry="2.6" fill="rgba(0,0,0,.22)" />
            <rect x="11" y="50" width="8" height="22" rx="3" fill="#2b4a8a" />
            <rect x="21" y="50" width="8" height="22" rx="3" fill="#2b4a8a" />
            {sp.flag ? (
              <>
                <path d="M37 16V-12" stroke="#6b4423" strokeWidth="2" />
                <path d="M37 -12h12v5h-12z" fill="#e2312d" />
                <path d="M37 -7h12v5h-12z" fill="#fff" stroke="#ddd" strokeWidth="0.5" />
              </>
            ) : null}
            <rect x="8" y="30" width="24" height="26" rx="8" fill={sp.c} />
            <circle cx="20" cy="19" r="10" fill={sp.sk} />
            <path d="M10 18Q20 4 30 18Q20 11 10 18Z" fill={sp.hr} />
          </svg>
        ))}
      </div>

      {/* 6. Pagar Kayu */}
      <div
        className="absolute left-0 right-0"
        style={{
          top: 'calc(var(--hz) - 16px)',
          height: '36px',
          zIndex: 3,
          background: 'repeating-linear-gradient(90deg, #c58b49 0 14px, #8f5f2b 14px 17px)',
          borderTop: '5px solid #7a4e22',
        }}
      />

      {/* 7. Bendera Bunting Atas & Bawah */}
      <div
        className="absolute left-0 right-0 flex justify-between"
        style={{
          top: '74px',
          zIndex: 4,
          pointerEvents: 'none',
          background: 'linear-gradient(#5a4a3a, #5a4a3a) 0 2px/100% 2px no-repeat',
        }}
      >
        {buntings.map((b) => (
          <i
            key={b}
            style={{
              borderLeft: '9px solid transparent',
              borderRight: '9px solid transparent',
              borderTop: `20px solid ${b % 2 === 0 ? '#e2312d' : '#ffffff'}`,
            }}
          />
        ))}
      </div>

      <div
        className="absolute left-0 right-0 flex justify-between"
        style={{
          top: 'calc(var(--hz) - 22px)',
          zIndex: 4,
          pointerEvents: 'none',
          background: 'linear-gradient(#5a4a3a, #5a4a3a) 0 2px/100% 2px no-repeat',
        }}
      >
        {buntings.map((b) => (
          <i
            key={b}
            style={{
              borderLeft: '9px solid transparent',
              borderRight: '9px solid transparent',
              borderTop: `20px solid ${b % 2 === 0 ? '#e2312d' : '#ffffff'}`,
            }}
          />
        ))}
      </div>

      {/* 8. Tiang Bendera Kiri & Kanan Berdiri */}
      <div
        className="absolute bottom-0"
        style={{
          left: '1.5%',
          width: '5px',
          height: 'calc(var(--H) - 100px)',
          background: '#7b6f5c',
          zIndex: 3,
        }}
      >
        <i
          className="absolute"
          style={{
            left: '5px',
            top: '4px',
            width: '70px',
            height: '44px',
            background: 'linear-gradient(#e2312d 50%, #fff 50%)',
            border: '2px solid #ccc',
          }}
        />
      </div>
      <div
        className="absolute bottom-0"
        style={{
          right: '1.5%',
          width: '5px',
          height: 'calc(var(--H) - 100px)',
          background: '#7b6f5c',
          zIndex: 3,
        }}
      >
        <i
          className="absolute"
          style={{
            right: '5px',
            top: '4px',
            width: '70px',
            height: '44px',
            background: 'linear-gradient(#e2312d 50%, #fff 50%)',
            border: '2px solid #ccc',
          }}
        />
      </div>

      {/* 9. Spanduk Kain Merah DIRGAHAYU REPUBLIK INDONESIA */}
      <div
        className="absolute left-1/2 text-center text-white font-extrabold uppercase"
        style={{
          top: '96px',
          transform: 'translateX(-50%)',
          width: 'min(520px, 70%)',
          background: 'linear-gradient(#e2312d, #b81f1c)',
          fontFamily: "'Baloo 2', cursive, sans-serif",
          fontSize: 'clamp(0.75rem, 1.8vw, 1.1rem)',
          letterSpacing: '0.05em',
          padding: '3px 14px',
          border: '3px solid #fff',
          borderRadius: '10px',
          boxShadow: '0 4px 0 rgba(0,0,0,.2)',
          zIndex: 4,
        }}
      >
        DIRGAHAYU REPUBLIK INDONESIA KE-81
      </div>

      {/* 10. Lapisan Tanah Lumpur & Genangan Air */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{
          top: 'var(--hz)',
          background:
            'radial-gradient(rgba(255,255,255,.07) 1px,transparent 1.6px) 0 0/13px 13px, radial-gradient(rgba(0,0,0,.16) 1px,transparent 1.8px) 6px 6px/17px 17px, linear-gradient(#85603a,#694529 40%,#563721)',
          zIndex: 1,
        }}
      >
        {/* Rumput di tepian atas tanah */}
        <div
          className="absolute left-0 right-0 top-0 h-6"
          style={{
            background:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='22'%3E%3Cpath d='M6 22L8 8L11 22M14 22L18 4L21 22M26 22L30 10L33 22M38 22L40 12L43 22' fill='%2345a447'/%3E%3C/svg%3E\") repeat-x 0 0/48px 22px",
          }}
        />

        {/* Genangan air lumpur memantul */}
        {puddles.map((p, idx) => (
          <div
            key={idx}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.w}px`,
              height: `${p.w * 0.28}px`,
              background:
                'radial-gradient(ellipse at 35% 30%,rgba(255,255,255,.75),rgba(140,185,210,.62) 38%,rgba(78,110,128,.68))',
              boxShadow: 'inset 0 3px 7px rgba(0,0,0,.4), 0 0 0 3px rgba(60,40,22,.5)',
            }}
          />
        ))}
      </div>

      {/* 11. ARENA TIANG-TIANG PINANG BERDIRI BERSAMA (#field) */}
      <div className="absolute inset-0" style={{ zIndex: 5, pointerEvents: 'none' }}>
        {tiangList.map((t) => {
          const safeP = Math.max(0, Math.min(100, t.posisiPersen));
          // y = p / 100 * (PH - HC * 0.62)
          const climberY = Math.round((safeP / 100) * (PH - HC * 0.62));

          return (
            <div
              key={t.id}
              className={`absolute ${t.jatuhBebas ? 'panjat-pole-shake' : ''}`}
              style={{
                left: `${t.xPct}%`,
                bottom: '60px',
                width: 0,
                height: 0,
                zIndex: 10,
              }}
            >
              {/* Batang Tiang Pinang */}
              <div
                className="absolute"
                style={{
                  left: '-13px',
                  bottom: 0,
                  width: '26px',
                  height: `${PH}px`,
                  borderRadius: '7px 7px 3px 3px',
                  background:
                    'repeating-linear-gradient(0deg,transparent 0 34px,rgba(0,0,0,.25) 34px 37px),linear-gradient(90deg,#5d3a14,#c98f55 42%,#8a5a2b 72%,#4f3210)',
                  boxShadow: '3px 0 6px rgba(0,0,0,.25)',
                }}
              >
                {/* Zona Pelumas Oli */}
                {ZONES_OLI.map((z, zi) => (
                  <div
                    key={zi}
                    className="absolute"
                    style={{
                      left: '-2px',
                      right: '-2px',
                      bottom: `${z[0]}px`,
                      height: `${z[1] - z[0]}px`,
                      borderRadius: '6px',
                      background: 'linear-gradient(90deg,#0d0703,#3a230f 38%,#150b04 72%,#070402)',
                      boxShadow: '0 0 8px rgba(0,0,0,.5)',
                    }}
                  />
                ))}
              </div>

              {/* Tali Pengikat di 25%, 50%, 75% */}
              {ANC_ROPES.map((a) => {
                const yRope = Math.round((a / 100) * (PH - HC * 0.62)) + 16;
                return (
                  <div
                    key={a}
                    className="absolute"
                    style={{
                      left: '-19px',
                      bottom: `${yRope}px`,
                      width: '38px',
                      height: '11px',
                      borderRadius: '6px',
                      background: 'repeating-linear-gradient(90deg,#e2312d 0 6px,#fff 6px 12px)',
                      border: '1.5px solid #5d3a14',
                      zIndex: 2,
                      boxShadow: '0 2px 0 rgba(0,0,0,.25)',
                    }}
                  >
                    <i
                      style={{
                        position: 'absolute',
                        left: '44px',
                        top: '-2px',
                        font: "800 0.65rem 'Nunito', sans-serif",
                        fontStyle: 'normal',
                        color: '#fff',
                        textShadow: '0 1px 2px #000',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {a}%
                    </i>
                  </div>
                );
              })}

              {/* Roda Hadiah Puncak (PRIZE) */}
              <svg
                className="absolute"
                style={{
                  left: '-90px',
                  bottom: `${PH - 84}px`,
                  width: '180px',
                  overflow: 'visible',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
                viewBox="0 -16 180 146"
                aria-hidden="true"
              >
                <rect x="12" y="46" width="156" height="8" rx="4" fill="#8a5a2b" stroke="#5d3a14" strokeWidth="2" />
                <circle cx="90" cy="26" r="24" fill="none" stroke="#8a5a2b" strokeWidth="5" />
                <path d="M90 2V50M66 26H114M73 9L107 43M107 9L73 43" stroke="#8a5a2b" strokeWidth="2.5" />
                <path d="M90 2V-12" stroke="#5d3a14" strokeWidth="2" />
                <rect x="90" y="-12" width="16" height="5" fill="#e2312d" />
                <rect x="90" y="-7" width="16" height="5" fill="#fff" stroke="#ddd" strokeWidth="0.5" />
                {/* Kado 1 */}
                <g>
                  <path d="M24 54V66" stroke="#5d3a14" strokeWidth="2" />
                  <rect x="12" y="66" width="24" height="22" fill="#e2312d" stroke="#2b2a4a" strokeWidth="2" />
                  <path d="M24 66v22M12 77h24" stroke="#fff" strokeWidth="3" />
                </g>
                {/* Ember/Panci */}
                <g>
                  <path d="M58 54V64" stroke="#5d3a14" strokeWidth="2" />
                  <rect x="44" y="64" width="28" height="22" rx="3" fill="#2b2a4a" />
                  <rect x="48" y="68" width="20" height="14" fill="#7fd0ff" />
                </g>
                {/* Sepeda Mini */}
                <g>
                  <path d="M122 54V62" stroke="#5d3a14" strokeWidth="2" />
                  <circle cx="110" cy="84" r="9" fill="none" stroke="#2b2a4a" strokeWidth="2.5" />
                  <circle cx="134" cy="84" r="9" fill="none" stroke="#2b2a4a" strokeWidth="2.5" />
                  <path d="M110 84L118 70L134 84M118 70H128M122 62V70" stroke="#e2312d" strokeWidth="2.5" fill="none" />
                </g>
                {/* Kado Emas */}
                <g>
                  <path d="M156 54V62" stroke="#5d3a14" strokeWidth="2" />
                  <rect x="144" y="62" width="24" height="28" fill="#ffb81c" stroke="#2b2a4a" strokeWidth="2" />
                  <path d="M144 70h24M144 78h24M144 86h24" stroke="#e2312d" strokeWidth="3" />
                </g>
              </svg>

              {/* Label Nama Pemain di Dasar Tiang */}
              <div
                className="absolute text-center text-white font-extrabold"
                style={{
                  left: '-62px',
                  width: '124px',
                  bottom: '-36px',
                  background: t.warna,
                  border: '2px solid #fff',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontFamily: "'Baloo 2', cursive, sans-serif",
                  fontSize: '0.85rem',
                  zIndex: 30,
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </div>

              {/* Karakter Pemanjat 2D (Sesuai Desain panjat-pinang-solo.html pup(L)) */}
              {(() => {
                const climberLook: ClimberLook =
                  t.id === 'pemain1'
                    ? { skin: '#d9a066', hair: '#241a14', hs: 0, tp: 'none', sh: '#e2312d', bulk: true }
                    : t.id === 'pemain2'
                    ? { skin: '#8d5a3b', hair: '#111', hs: 1, tp: 'none', sh: '#1d8fe0', bulk: true }
                    : { skin: '#d9a066', hair: '#241a14', hs: 0, tp: 'none', sh: t.warna || '#e2312d', bulk: true };

                const climberState =
                  t.posisiPersen >= 100
                    ? 'win'
                    : t.jatuhBebas
                    ? 'sl'
                    : t.posisiPersen > 0
                    ? 'cl'
                    : 'idle';

                return (
                  <div
                    className={`absolute ${t.jatuhBebas ? 'panjat-anim-free' : ''}`}
                    style={{
                      transform: 'translateX(-50%)',
                      left: '0px',
                      bottom: `${climberY}px`,
                      width: `${Math.round(HC * 0.64 * 1.32)}px`,
                      height: `${HC}px`,
                      transition: t.jatuhBebas
                        ? 'bottom 1.4s cubic-bezier(.5,0,.85,.45)'
                        : 'bottom 0.85s cubic-bezier(.3,.8,.3,1)',
                      zIndex: 12,
                    }}
                  >
                    {/* Balon Kata Feedback di Atas Karakter */}
                    {t.bubbleText && (
                      <div
                        className={`absolute left-1/2 -top-7 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-xs font-black shadow-md border-2 whitespace-nowrap z-40 ${
                          t.bubbleText.includes('-') || t.bubbleText.includes('!') || t.bubbleText.includes('Aaaah')
                            ? 'bg-[#fdecec] text-[#d63b3b] border-[#f4b6b6]'
                            : 'bg-[#e9f9ef] text-[#1f9d55] border-[#9de0b6]'
                        }`}
                        style={{ animation: 'ppPop 1.35s forwards' }}
                      >
                        {t.bubbleText}
                      </div>
                    )}

                    <PanjatClimberAvatar
                      look={climberLook}
                      state={climberState}
                      width={Math.round(HC * 0.64 * 1.32)}
                      height={HC}
                    />
                  </div>
                );
              })()}

              {/* Percikan Lumpur Saat Jatuh Bebas ke Dasar */}
              {t.jatuhBebas && (
                <>
                  {[-30, -15, 0, 15, 30].map((dx, pidx) => (
                    <span
                      key={pidx}
                      className="panjat-mud-particle"
                      style={
                        {
                          left: `${dx}px`,
                          '--dx': `${dx * 2}px`,
                          '--dy': `${-20 - Math.abs(dx)}px`,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 12. Penonton Depan di Sekeliling Panggung */}
      <div
        className={`absolute left-0 right-0 bottom-1 flex items-end justify-around px-3 ${
          crowdCheer ? 'cheer' : ''
        }`}
        style={{ zIndex: 15, pointerEvents: 'none' }}
      >
        {crowdBack.slice(0, 22).map((sp) => (
          <svg
            key={`f-${sp.idx}`}
            width={sp.w + 6}
            viewBox="0 -16 40 92"
            className="bk-spec"
            style={{ animationDelay: `-${(sp.idx * 0.15).toFixed(2)}s` }}
          >
            <ellipse cx="20" cy="74" rx="15" ry="2.6" fill="rgba(0,0,0,.22)" />
            <rect x="11" y="50" width="8" height="22" rx="3" fill="#2b4a8a" />
            <rect x="21" y="50" width="8" height="22" rx="3" fill="#2b4a8a" />
            <rect x="8" y="30" width="24" height="26" rx="8" fill={sp.c} />
            <circle cx="20" cy="19" r="10" fill={sp.sk} />
            <path d="M10 18Q20 4 30 18Q20 11 10 18Z" fill={sp.hr} />
          </svg>
        ))}
      </div>
    </div>
  );
}
