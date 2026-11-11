import React, { useMemo } from 'react';
import { Volume2, VolumeX, ArrowLeft, Pause, Play, StopCircle } from 'lucide-react';
import './balapKarungFestival.css';

const SPECTATOR_COLORS = [
  ['#e2312d', '#ffb81c'],
  ['#1d8fe0', '#ffd23f'],
  ['#1f9d55', '#ffffff'],
  ['#7a3fd0', '#ff8a65'],
  ['#f97316', '#38bdf8'],
  ['#ec4899', '#fde047'],
];

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
 * Cangkang panggung Festival 17 Agustus (HUD atas, langit biru, awan, desa, penonton bersorak,
 * bendera segitiga merah-putih, dinding MERDEKA!!, serta alas rumput dan sungai).
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
  const spectators = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        idx: i,
        shirt: SPECTATOR_COLORS[i % SPECTATOR_COLORS.length][0],
        accent: SPECTATOR_COLORS[i % SPECTATOR_COLORS.length][1],
        delay: ((i * 137) % 1000) / 1000,
        hasFlag: i % 3 === 0,
      })),
    []
  );

  const buntings = useMemo(() => Array.from({ length: 30 }, (_, i) => i), []);

  const statusClass =
    statusTone === 'live' ? 'bk-chip live' : statusTone === 'done' ? 'bk-chip blue' : 'bk-chip';

  return (
    <section className="bk-stage">
      {/* Langit + Matahari + Awan + Pemandangan Desa */}
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
                <span className="hidden md:inline-block bk-chip red">{subtitle}</span>
              )}
              <span className={statusClass}>{statusLabel}</span>
              {targetLabel && <span className="bk-chip">{targetLabel}</span>}
              {extraBadges}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {ruleSummary && (
                <span className="hidden sm:inline-block text-xs font-extrabold text-[#6b6a85] bg-[#fff3d6]/80 px-2.5 py-1 rounded-full border border-[#f0dfb4]">
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
        <div
          className="bk-cloud"
          style={{ width: 92, height: 28, top: 22, left: '8%', animationDuration: '44s' }}
        />
        <div
          className="bk-cloud"
          style={{
            width: 68,
            height: 22,
            top: 44,
            left: '36%',
            animationDuration: '58s',
            animationDelay: '-18s',
          }}
        />
        <div
          className="bk-cloud"
          style={{
            width: 108,
            height: 30,
            top: 18,
            left: '68%',
            animationDuration: '50s',
            animationDelay: '-30s',
          }}
        />

        {/* Latar Perkampungan + Pepohonan + Bendera Merah-Putih */}
        <svg className="bk-town" viewBox="0 0 1200 150" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 150 L0 105 Q180 65 360 100 T760 95 T1200 102 L1200 150 Z" fill="#9fd685" />
          {[40, 230, 480, 690, 910, 1090].map((x, idx) => (
            <g key={x} transform={`translate(${x}, ${idx % 2 === 0 ? 52 : 60})`}>
              <rect x="6" y="34" width="66" height="44" fill="#ddcdb7" stroke="#bfa98e" strokeWidth="2" />
              <polygon points="0,36 39,10 78,36" fill="#d4452f" />
              <rect x="16" y="46" width="14" height="14" rx="2" fill="#fff6c2" />
              <rect x="46" y="46" width="16" height="32" rx="2" fill="#9e6b43" />
              <circle cx="96" cy="54" r="18" fill="#2f8f3f" />
              <circle cx="110" cy="58" r="14" fill="#3da44d" />
              <rect x="93" y="68" width="6" height="16" fill="#7c5230" />
            </g>
          ))}
          {/* Tiang Bendera Merah-Putih */}
          <g transform="translate(600, 18)">
            <rect x="0" y="0" width="4" height="96" fill="#6b7280" />
            <rect x="4" y="4" width="42" height="14" fill="#e2312d" />
            <rect x="4" y="18" width="42" height="14" fill="#ffffff" />
          </g>
        </svg>

        {/* Penonton Bersorak */}
        <div className={`bk-crowd ${crowdCheer ? 'cheer' : ''}`}>
          {spectators.map((sp) => (
            <svg
              key={sp.idx}
              className="bk-spec"
              viewBox="0 0 28 50"
              style={{ animationDelay: `${sp.delay}s` }}
              aria-hidden="true"
            >
              <circle cx="14" cy="14" r="7" fill="#ffd9a8" stroke="#6b4423" strokeWidth="1.5" />
              <path d="M7 11 Q14 4 21 11 Z" fill="#2b2a4a" />
              <rect x="6" y="22" width="16" height="22" rx="6" fill={sp.shirt} stroke="#2b2a4a" strokeWidth="1.5" />
              {sp.hasFlag && (
                <>
                  <line x1="23" y1="6" x2="23" y2="30" stroke="#7c5230" strokeWidth="1.6" />
                  <rect x="23" y="6" width="10" height="4" fill="#e2312d" />
                  <rect x="23" y="10" width="10" height="4" fill="#ffffff" />
                </>
              )}
              <circle cx="14" cy="29" r="3" fill={sp.accent} opacity="0.85" />
            </svg>
          ))}
        </div>
      </div>

      {/* Bendera Segitiga Merah-Putih + Tembok MERDEKA!! */}
      <div className="bk-bunt">
        {buntings.map((idx) => (
          <div key={idx} className={`bk-bunt-tri ${idx % 2 === 1 ? 'w' : ''}`} />
        ))}
      </div>
      <div className="bk-wall">
        <span className="bk-merdeka">MERDEKA!! • DIRGAHAYU • 17 AGUSTUS</span>
      </div>

      {children}

      <div className="bk-grass" />
      <div className="bk-river" />
    </section>
  );
}

