import React, { useId, useMemo, useState, useEffect } from 'react';
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

/**
 * Komponen Penonton 2D persis person(...) di panjat-pinang-solo.html
 */
function PanjatPerson({
  w,
  c,
  sk,
  hr,
  flag,
  animDelay,
  idx = 0,
}: {
  w: number;
  c: string;
  sk: string;
  hr: string;
  flag: boolean;
  animDelay?: string;
  idx?: number;
}) {
  const pc = ['#2b4a8a', '#3a3a3a', '#6b3b1e', '#1f7a5a'][idx % 4];
  return (
    <svg
      width={w}
      viewBox="0 -16 40 92"
      className="panjat-person"
      style={{ animationDelay: animDelay }}
      aria-hidden="true"
    >
      <ellipse cx="20" cy="74" rx="15" ry="2.6" fill="rgba(0,0,0,.22)" />
      <rect x="11" y="50" width="8" height="22" rx="3" fill={pc} stroke="#2b2a4a" strokeWidth="1.2" />
      <rect x="21" y="50" width="8" height="22" rx="3" fill={pc} stroke="#2b2a4a" strokeWidth="1.2" />
      <ellipse cx="14.5" cy="73" rx="6" ry="2.8" fill="#2b2a4a" />
      <ellipse cx="25.5" cy="73" rx="6" ry="2.8" fill="#2b2a4a" />
      <g className="sL">
        <path d="M9 34L4 52" stroke={sk} strokeWidth="4.6" strokeLinecap="round" />
        <path d="M9 34L6 42" stroke={c} strokeWidth="6" strokeLinecap="round" />
      </g>
      {flag ? (
        <>
          <path d="M37 16V-12" stroke="#6b4423" strokeWidth="2" />
          <path d="M37 -12h12v5h-12z" fill="#e2312d" />
          <path d="M37 -7h12v5h-12z" fill="#fff" stroke="#ddd" strokeWidth="0.5" />
          <path
            d="M31 34L37 24L37 15"
            stroke={sk}
            strokeWidth="4.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      ) : (
        <g className="sR">
          <path d="M31 34L36 52" stroke={sk} strokeWidth="4.6" strokeLinecap="round" />
          <path d="M31 34L34 42" stroke={c} strokeWidth="6" strokeLinecap="round" />
        </g>
      )}
      <rect x="8" y="30" width="24" height="26" rx="8" fill={c} stroke="#2b2a4a" strokeWidth="1.2" />
      <circle cx="20" cy="19" r="10" fill={sk} stroke="#2b2a4a" strokeWidth="1.2" />
      <path d="M10 18Q20 4 30 18Q20 11 10 18Z" fill={hr} />
      <circle cx="17" cy="20" r="1.1" fill="#2b2a4a" />
      <circle cx="23" cy="20" r="1.1" fill="#2b2a4a" />
      <path d="M17.5 24Q20 26 22.5 24" stroke="#8a2a2a" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

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

  // 34 penonton belakang pagar kayu (#cb di panjat-pinang-solo.html)
  const crowdBack = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        idx: i,
        w: 28 + ((i * 7) % 9),
        c: ['#e2312d', '#ffffff', '#1d8fe0', '#ffb81c', '#1f9d55', '#ff7a59', '#7a3fd0'][i % 7],
        sk: ['#ffd9a8', '#e8b27d', '#c58c5a', '#f3c99b'][i % 4],
        hr: ['#2b2a4a', '#4a2c17', '#111111', '#6b3b1e'][(i * 3) % 4],
        flag: i % 3 === 0,
      })),
    []
  );

  // 7 genangan air lumpur alami memantul kilau air
  const puddles = useMemo(
    () => [
      { left: 12, top: 28, w: 90 },
      { left: 48, top: 18, w: 110 },
      { left: 84, top: 32, w: 95 },
      { left: 23, top: 55, w: 125 },
      { left: 72, top: 60, w: 130 },
      { left: 45, top: 75, w: 100 },
      { left: 88, top: 80, w: 85 },
    ],
    []
  );

  // 6 rumpun rumput alami di tanah lumpur
  const grassTufts = useMemo(
    () => [
      { left: 10, top: 35, w: 70 },
      { left: 22, top: 65, w: 80 },
      { left: 46, top: 25, w: 60 },
      { left: 58, top: 82, w: 90 },
      { left: 80, top: 40, w: 75 },
      { left: 90, top: 72, w: 65 },
    ],
    []
  );

  // 12 bercak lumpur pekat
  const mudDrops = useMemo(
    () => [
      { left: 8, top: 20, w: 14, h: 8 },
      { left: 18, top: 40, w: 18, h: 9 },
      { left: 35, top: 15, w: 12, h: 6 },
      { left: 54, top: 30, w: 16, h: 8 },
      { left: 66, top: 18, w: 20, h: 10 },
      { left: 80, top: 22, w: 14, h: 7 },
      { left: 15, top: 78, w: 18, h: 9 },
      { left: 38, top: 65, w: 22, h: 11 },
      { left: 62, top: 72, w: 16, h: 8 },
      { left: 78, top: 85, w: 15, h: 7 },
      { left: 94, top: 55, w: 20, h: 10 },
      { left: 50, top: 90, w: 14, h: 7 },
    ],
    []
  );

  // Penonton di lapangan lumpur (#cl persis panjat-pinang-solo.html)
  // Tersebar di 5 kedalaman perspektif dan otomatis menghindari tiang-tiang
  const mudSpectators = useMemo(() => {
    const polesX = tiangList.map((t) => t.xPct);
    const skColors = ['#ffd9a8', '#e8b27d', '#c58c5a', '#f3c99b'];
    const hrColors = ['#2b2a4a', '#4a2c17', '#111111', '#6b3b1e'];
    const shirtColors = [
      '#e2312d',
      '#ffffff',
      '#1d8fe0',
      '#ffb81c',
      '#1f9d55',
      '#ff7a59',
      '#c2332f',
      '#7a3fd0',
    ];

    // 5 baris kedalaman dari atas tanah lumpur sampai bagian bawah panggung
    const depthRows = [
      { topPct: 47, baseW: 24 },
      { topPct: 58, baseW: 28 },
      { topPct: 69, baseW: 32 },
      { topPct: 80, baseW: 36 },
      { topPct: 91, baseW: 40 },
    ];

    const isNearPole = (x: number) => polesX.some((px) => Math.abs(x - px) < 8.5);

    const list: Array<{
      id: string;
      leftPct: number;
      topPct: number;
      w: number;
      c: string;
      sk: string;
      hr: string;
      flag: boolean;
      animDelay: string;
      idx: number;
    }> = [];

    let count = 0;
    depthRows.forEach((row, rowIdx) => {
      const step = 4.8;
      for (let x = 3; x <= 97; x += step) {
        const jitterX = ((count * 7) % 5) - 2;
        const actualX = Math.max(2, Math.min(98, x + jitterX));

        if (isNearPole(actualX)) continue;

        const tooClose = list.some(
          (p) => Math.abs(p.topPct - row.topPct) < 3 && Math.abs(p.leftPct - actualX) < 4.2
        );
        if (tooClose) continue;

        const jitterW = (count * 3) % 4;
        const w = row.baseW + jitterW;
        const jitterY = (((count * 11) % 5) - 2) * 0.8;
        const finalTop = Math.max(46, Math.min(94, row.topPct + jitterY));

        list.push({
          id: `mud-spec-${rowIdx}-${count}`,
          leftPct: actualX,
          topPct: finalTop,
          w,
          c: shirtColors[(count * 3) % shirtColors.length],
          sk: skColors[count % skColors.length],
          hr: hrColors[(count * 2) % hrColors.length],
          flag: count % 3 === 0,
          animDelay: `-${((count * 0.23) % 1.6).toFixed(2)}s`,
          idx: count,
        });

        count++;
      }
    });

    return list;
  }, [tiangList]);

  // Sorak penonton berkala yang hidup
  const [crowdSay, setCrowdSay] = useState<{
    specIndex: number;
    text: string;
    isGreen: boolean;
  } | null>(null);

  useEffect(() => {
    const cheerTextsGood = [
      'Mantap!',
      'Ayo naik!',
      'Keren!',
      'Terus semangat!',
      'Hebat, lanjut!',
      'Jangan berhenti!',
      'Sikat!',
      'Merdeka!',
      'Pasti bisa!',
    ];

    const cheerTextsIdle = [
      'Ayo ayo!',
      'Semangat!',
      'Pasti bisa!',
      'Merdeka!',
      'Gas terus!',
      'Kuat-kuat!',
      'Tarik napas!',
    ];

    const intervalId = window.setInterval(() => {
      if (mudSpectators.length === 0) return;
      const randomSpecIdx = Math.floor(Math.random() * mudSpectators.length);
      const isCheer = crowdCheer;
      const texts = isCheer ? cheerTextsGood : cheerTextsIdle;
      const text = texts[Math.floor(Math.random() * texts.length)];
      setCrowdSay({
        specIndex: randomSpecIdx,
        text,
        isGreen: isCheer,
      });

      const timeoutId = window.setTimeout(() => {
        setCrowdSay((prev) => (prev?.specIndex === randomSpecIdx ? null : prev));
      }, 2500);

      return () => window.clearTimeout(timeoutId);
    }, 3800);

    return () => window.clearInterval(intervalId);
  }, [mudSpectators, crowdCheer]);

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

      {/* 5. Penonton Belakang Pagar Kayu (#cb di panjat-pinang-solo.html) */}
      <div
        className={`absolute left-0 right-0 flex items-end justify-around px-1 ${
          crowdCheer ? 'panjat-cheer' : ''
        }`}
        style={{
          top: 'calc(var(--hz) - 100px)',
          height: '104px',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        {crowdBack.map((sp) => (
          <PanjatPerson
            key={`cb-${sp.idx}`}
            w={sp.w}
            c={sp.c}
            sk={sp.sk}
            hr={sp.hr}
            flag={sp.flag}
            animDelay={`-${(sp.idx * 0.2).toFixed(2)}s`}
            idx={sp.idx}
          />
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

      {/* 7. Bendera Bunting Atas & Bawah Berkibar */}
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
            key={`bt-${b}`}
            className="panjat-bunt-flag"
            style={{
              borderLeft: '9px solid transparent',
              borderRight: '9px solid transparent',
              borderTop: `20px solid ${b % 2 === 0 ? '#e2312d' : '#ffffff'}`,
              animationDelay: b % 2 === 0 ? '0s' : '0.4s',
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
            key={`bb-${b}`}
            className="panjat-bunt-flag"
            style={{
              borderLeft: '9px solid transparent',
              borderRight: '9px solid transparent',
              borderTop: `20px solid ${b % 2 === 0 ? '#e2312d' : '#ffffff'}`,
              animationDelay: b % 2 === 0 ? '0s' : '0.4s',
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

      {/* 10. Lapisan Tanah Lumpur, Genangan Air Berkilau, Rumput & Bercak */}
      <div className="panjat-gnd">
        {/* Rumput di tepian atas tanah */}
        <div className="panjat-gnd-grass" />

        {/* Genangan air lumpur memantul dengan kilau air (.pud) */}
        {puddles.map((p, idx) => (
          <div
            key={`pud-${idx}`}
            className="panjat-pud"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.w}px`,
              height: `${p.w * 0.28}px`,
              animationDelay: `-${(idx * 0.7).toFixed(1)}s`,
            }}
          />
        ))}

        {/* Rumpun rumput alami di tanah lumpur (.gt) */}
        {grassTufts.map((gt, idx) => (
          <div
            key={`gt-${idx}`}
            className="panjat-gt"
            style={{
              left: `${gt.left}%`,
              top: `${gt.top}%`,
              width: `${gt.w}px`,
            }}
          />
        ))}

        {/* Bercak lumpur pekat (.mdd) */}
        {mudDrops.map((md, idx) => (
          <div
            key={`md-${idx}`}
            className="panjat-mdd"
            style={{
              left: `${md.left}%`,
              top: `${md.top}%`,
              width: `${md.w}px`,
              height: `${md.h}px`,
            }}
          />
        ))}
      </div>

      {/* 10.5 PENONTON DI LAPANGAN LUMPUR (#cl di panjat-pinang-solo.html) */}
      <div
        className={`panjat-crowd-ground ${crowdCheer ? 'panjat-cheer' : ''}`}
        style={{ zIndex: 6, pointerEvents: 'none' }}
      >
        {mudSpectators.map((sp) => {
          const hasSay = crowdSay && crowdSay.specIndex === sp.idx;
          return (
            <div
              key={sp.id}
              style={{
                position: 'absolute',
                left: `${sp.leftPct}%`,
                top: `${sp.topPct}%`,
                transform: 'translate(-50%, -100%)',
                zIndex: Math.round(sp.topPct),
              }}
            >
              {hasSay && (
                <span className={`panjat-crowd-say ${crowdSay.isGreen ? 'green' : ''}`}>
                  {crowdSay.text}
                </span>
              )}
              <PanjatPerson
                w={sp.w}
                c={sp.c}
                sk={sp.sk}
                hr={sp.hr}
                flag={sp.flag}
                animDelay={sp.animDelay}
                idx={sp.idx}
              />
            </div>
          );
        })}
      </div>

      {/* 11. ARENA TIANG-TIANG PINANG BERDIRI BERSAMA (#field) */}
      <div className="absolute inset-0" style={{ zIndex: 10, pointerEvents: 'none' }}>
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
                zIndex: 20,
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

              {/* Tali Pengikat di 25%, 50%, 75% (.anc) */}
              {ANC_ROPES.map((a) => {
                const yRope = Math.round((a / 100) * (PH - HC * 0.62)) + 16;
                return (
                  <div
                    key={a}
                    className="panjat-anc"
                    style={{
                      bottom: `${yRope}px`,
                    }}
                  >
                    <i>{a}%</i>
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

              {/* Label Nama Pemain di Dasar Tiang (.panjat-sgn) */}
              <div
                className="panjat-sgn"
                style={{
                  background: t.warna,
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
                      zIndex: 25,
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
    </div>
  );
}
