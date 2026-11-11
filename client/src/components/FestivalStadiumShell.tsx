import React, { useMemo, useId } from 'react';
import { Volume2, VolumeX, ArrowLeft, Pause, Play, StopCircle } from 'lucide-react';
import './balapKarungFestival.css';

const CROWD_SHIRTS = [
  '#e2312d',
  '#1d8fe0',
  '#ffb81c',
  '#7a3fd0',
  '#1f9d55',
  '#ff7a59',
  '#2bb6a8',
];
const CROWD_SKINS = ['#ffd9a8', '#e8b27d', '#c58c5a', '#f3c99b'];
const CROWD_HAIRS = ['#2b2a4a', '#4a2c17', '#111111', '#6b3b1e'];

export interface FestivalStadiumShellProps {
  title: string;
  subtitle?: string;
  statusLabel: string;
  statusTone?: 'idle' | 'live' | 'done';
  targetLabel?: string;
  ruleSummary?: string;
  crowdCheer?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onBack?: () => void;
  backLabel?: string;
  isPaused?: boolean;
  onTogglePause?: () => void;
  onStop?: () => void;
  stopLabel?: string;
  extraBadges?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Cangkang panggung Festival 17 Agustus (HUD atas, langit biru, awan, pemandangan kota/desa,
 * penonton bersorak, bendera segitiga merah-putih, dinding MERDEKA!!, serta alas rumput & sungai).
 * Dipakai bersama oleh Balap Karung Challenge dan Panjat Pinang Challenge.
 */
export function FestivalStadiumShell({
  title,
  subtitle,
  statusLabel,
  statusTone = 'idle',
  targetLabel,
  ruleSummary,
  crowdCheer = false,
  isMuted,
  onToggleMute,
  onBack,
  backLabel = 'Kembali',
  isPaused,
  onTogglePause,
  onStop,
  stopLabel = 'Akhiri',
  extraBadges,
  children,
}: FestivalStadiumShellProps) {
  const reactId = useId().replace(/:/g, '');
  const townPatternId = `bk-town-pat-${reactId}`;

  const spectators = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        idx: i,
        width: 34 + ((i * 7) % 13),
        shirt: CROWD_SHIRTS[i % CROWD_SHIRTS.length],
        skin: CROWD_SKINS[(i * 3) % CROWD_SKINS.length],
        hair: CROWD_HAIRS[(i * 5) % CROWD_HAIRS.length],
        delay: (((i * 37) % 15) / 10).toFixed(2),
        hasFlag: i % 5 === 0,
      })),
    []
  );

  const buntings = useMemo(() => Array.from({ length: 48 }, (_, i) => i), []);

  const statusClass =
    statusTone === 'live' ? 'bk-chip live' : statusTone === 'done' ? 'bk-chip blue' : 'bk-chip blue';

  return (
    <section className="bk-stage">
      {/* Langit + Matahari + Awan + Pemandangan Kota/Desa + Penonton + Bunting + Tembok */}
      <div className="bk-sky">
        {/* Top Floating HUD */}
        <div className="bk-top">
          <div className="bk-top-bar">
            <div className="bk-brand">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1.5 rounded-xl bg-[#fff3d6] border border-[#f0dfb4] text-[#2b2a4a] hover:bg-[#fde9b8] transition-colors cursor-pointer"
                  title={backLabel}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{backLabel}</span>
                </button>
              )}
              <span className="bk-h font-extrabold text-lg sm:text-xl text-[#2b2a4a] tracking-tight">
                {title}
              </span>
              {subtitle && (
                <span className="hidden md:inline-block bk-chip green">{subtitle}</span>
              )}
              <span className={statusClass}>{statusLabel}</span>
              {targetLabel && <span className="bk-chip yellow">{targetLabel}</span>}
              {extraBadges}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {ruleSummary && (
                <span className="hidden sm:inline-block text-xs font-extrabold text-[#6b6a85] px-1">
                  {ruleSummary}
                </span>
              )}

              {onTogglePause && (
                <button
                  type="button"
                  onClick={onTogglePause}
                  className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1.5 rounded-xl bg-[#fff3d6] border border-[#f0dfb4] text-[#2b2a4a] hover:bg-[#fde9b8] cursor-pointer"
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{isPaused ? 'Lanjut' : 'Jeda'}</span>
                </button>
              )}

              {onStop && (
                <button
                  type="button"
                  onClick={onStop}
                  className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1.5 rounded-xl bg-[#fdecec] border border-[#f4b6b6] text-[#b81f1c] hover:bg-[#fbd5d5] cursor-pointer"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span>{stopLabel}</span>
                </button>
              )}

              {onToggleMute && (
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="p-1.5 rounded-xl bg-[#fff3d6] border border-[#f0dfb4] text-[#2b2a4a] hover:bg-[#fde9b8] cursor-pointer"
                  title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
                  aria-label={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bk-sun" />
        <div className="bk-cloud" style={{ width: 110, top: 78, left: '30%' }} />
        <div
          className="bk-cloud"
          style={{ width: 90, top: 96, left: '62%', animationDuration: '98s' }}
        />
        <div
          className="bk-cloud"
          style={{ width: 120, top: 72, left: '84%', animationDuration: '115s' }}
        />

        {/* Latar Perkampungan + Gedung Kota + Bendera + Bukit + Pepohonan (Pattern Tiling Penuh 100%) */}
        <svg className="bk-town" height="150" aria-hidden="true">
          <defs>
            <pattern id={townPatternId} width="600" height="150" patternUnits="userSpaceOnUse">
              {/* Rumah Kiri (2 lantai) */}
              <rect
                x="60"
                y="35"
                width="60"
                height="110"
                fill="#ddcdb7"
                stroke="#7b6f5c"
                strokeWidth="2"
              />
              <path d="M55 35h70l-35-22z" fill="#d4452f" />
              <g fill="#fff6c2">
                <rect x="72" y="52" width="9" height="11" />
                <rect x="98" y="52" width="9" height="11" />
                <rect x="72" y="76" width="9" height="11" />
                <rect x="98" y="76" width="9" height="11" />
              </g>

              {/* Rumah Tengah Lebar */}
              <rect
                x="330"
                y="62"
                width="70"
                height="90"
                fill="#ddcdb7"
                stroke="#7b6f5c"
                strokeWidth="2"
              />
              <path d="M325 62h80l-40-20z" fill="#d4452f" />
              <g fill="#fff6c2">
                <rect x="344" y="78" width="9" height="11" />
                <rect x="376" y="78" width="9" height="11" />
              </g>

              {/* Siluet Gedung Kota */}
              <rect x="220" y="55" width="20" height="95" fill="#8e949c" />
              <rect x="250" y="72" width="20" height="78" fill="#a2a8b0" />

              {/* Tiang & Bendera Merah-Putih */}
              <path d="M560 20V140" stroke="#7b6f5c" strokeWidth="3" />
              <rect x="560" y="22" width="34" height="11" fill="#e2312d" />
              <rect x="560" y="33" width="34" height="11" fill="#ffffff" />

              {/* Bukit Hijau Bergelombang */}
              <path d="M0 150V100Q150 70 300 100T600 100V150Z" fill="#9fd685" />

              {/* Pepohonan */}
              <rect x="478" y="95" width="8" height="40" fill="#6b4423" />
              <circle cx="482" cy="80" r="26" fill="#2f8f3f" />
              <rect x="16" y="105" width="7" height="35" fill="#6b4423" />
              <circle cx="20" cy="92" r="18" fill="#2f8f3f" />
            </pattern>
          </defs>
          <rect width="100%" height="150" fill={`url(#${townPatternId})`} />
        </svg>

        {/* Penonton Bersorak dengan Tangan Terangkat & Bendera Mini */}
        <div className={`bk-crowd ${crowdCheer ? 'cheer' : ''}`} aria-hidden="true">
          {spectators.map((sp) => (
            <svg
              key={sp.idx}
              className="bk-spec"
              width={sp.width}
              viewBox="0 -16 40 76"
              style={{ animationDelay: `-${sp.delay}s` }}
            >
              <path
                d="M9 40L3 16M31 40L37 16"
                stroke={sp.skin}
                strokeWidth="5"
                strokeLinecap="round"
              />
              {sp.hasFlag && (
                <>
                  <path d="M37 16V-12" stroke="#6b4423" strokeWidth="2" />
                  <path d="M37 -12h12v5h-12z" fill="#e2312d" />
                  <path d="M37 -7h12v5h-12z" fill="#ffffff" stroke="#dddddd" strokeWidth="0.5" />
                </>
              )}
              <rect x="8" y="30" width="24" height="30" rx="8" fill={sp.shirt} />
              <circle cx="20" cy="19" r="10" fill={sp.skin} />
              <path d="M10 18Q20 4 30 18Q20 11 10 18Z" fill={sp.hair} />
              <ellipse cx="20" cy="23" rx="3" ry="2.4" fill="#8a2a2a" />
            </svg>
          ))}
        </div>

        {/* Bendera Segitiga Merah-Putih + Tembok MERDEKA!! */}
        <div className="bk-bunt" aria-hidden="true">
          {buntings.map((idx) => (
            <div key={idx} className={`bk-bunt-tri ${idx % 2 === 1 ? 'w' : ''}`} />
          ))}
        </div>
        <div className="bk-wall">
          <span className="bk-merdeka">MERDEKA!!</span>
        </div>
      </div>

      {children}

      <div className="bk-grass" />
      <div className="bk-river" />
    </section>
  );
}
