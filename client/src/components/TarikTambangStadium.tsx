import { useEffect, useId, useMemo, useState } from 'react';
import { ArrowLeft, Pause, Play, StopCircle, Volume2, VolumeX } from 'lucide-react';
import './tarikTambangFestival.css';

const SKINS = ['#ffd9a8', '#e8b27d', '#c58c5a', '#f3c99b'];
const HAIRS = ['#2b2a4a', '#6b3b1e', '#111111', '#4a2c17'];
const RED_CROWD_SHIRTS = ['#e2312d', '#ff6b57', '#ffb81c', '#d9483b', '#f28b82'];
const BLUE_CROWD_SHIRTS = ['#1d8fe0', '#38bdf8', '#ffb81c', '#2563eb', '#60a5fa'];

const PULLER_SKINS: ReadonlyArray<{ sk: string; sh: string }> = [
  { sk: '#f2c18f', sh: '#d9a06e' },
  { sk: '#c98d5b', sh: '#a8703f' },
  { sk: '#ffd9a8', sh: '#e6b883' },
  { sk: '#a8703f', sh: '#8a5a30' },
];

const PULLER_HAIRS = [
  'M17 27Q15 11 31 12Q46 12 45 27Q38 19 29 21Q22 21 17 27Z',
  'M16 28L13 14L22 18L26 8L33 15L40 9L42 17L49 15L45 27Q38 19 29 21Q22 21 16 28Z',
  'M16 27Q12 8 31 10Q50 10 45 27Q38 17 29 20Q22 20 16 27Z',
];

export interface TarikActionPulse {
  id: string;
  side: 'l' | 'r';
  kind: 'heave' | 'jerk' | 'slip';
  pullerIdx?: number;
  bubble?: string | null;
}

export interface TarikAvatarSvgProps {
  color?: string;
  side?: 'l' | 'r';
  size?: number;
}

export function TarikAvatarSvg({
  color = '#e2312d',
  side = 'l',
  size = 44,
}: TarikAvatarSvgProps) {
  const isRight = side === 'r';
  const skin = isRight ? '#c98d5b' : '#f2c18f';
  const hair = isRight ? '#6b3b1e' : '#2b2a4a';
  const hairPath = isRight
    ? 'M9 19L8 11L13 13L15 6L20 11L25 6L27 13L32 11L31 19Q20 11 9 19Z'
    : 'M9 19Q9 7 20 8Q31 7 31 19Q20 12 9 19Z';

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ flex: 'none' }}>
      <rect width="40" height="40" rx="10" fill="#fff3d6" />
      <rect x="9" y="30" width="22" height="10" rx="5" fill={color} />
      <circle cx="20" cy="20" r="11" fill={skin} stroke="#2b2a4a" strokeWidth="2" />
      <path d={hairPath} fill={hair} />
      <path d="M10 17Q20 8 30 17" stroke="#e2312d" strokeWidth="4" fill="none" />
      <path d="M10 20.5Q20 12.5 30 20.5" stroke="#ffffff" strokeWidth="3" fill="none" />
      <circle cx="16" cy="23" r="1.6" fill="#2b2a4a" />
      <circle cx="24" cy="23" r="1.6" fill="#2b2a4a" />
      <path d="M16 28q4 3 8 0" stroke="#2b2a4a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export interface TarikPullerSvgProps {
  shirtColor: string;
  skinColor?: string;
  shadowSkinColor?: string;
  hairColor?: string;
  hairPath?: string;
  numLabel?: string;
  mirrored?: boolean;
}

/**
 * Karakter penarik tali atletik bergaya Festival 17 Agustus (proporsi 100x130).
 * Memiliki variasi gaya rambut, warna kulit, celana pendek putih, ikat kepala Merah-Putih,
 * dan kelas animasi `.bd`, `.lb`, `.lf`, `.tail`, `.ap`, `.au`, `.mo`, `.smi`.
 */
export function TarikPullerSvg({
  shirtColor,
  skinColor = '#f2c18f',
  shadowSkinColor = '#d9a06e',
  hairColor = '#2b2a4a',
  hairPath = PULLER_HAIRS[0],
  numLabel,
  mirrored = false,
}: TarikPullerSvgProps) {
  return (
    <svg viewBox="0 0 100 130" aria-hidden="true">
      {/* Bayangan Rumput */}
      <ellipse cx="46" cy="125" rx="34" ry="4.5" fill="rgba(0,0,0,0.2)" />

      {/* Kaki Belakang & Celana Putih */}
      <g className="lg lb">
        <path d="M46 86L33 103" stroke="#ffffff" strokeWidth="14" strokeLinecap="round" />
        <path d="M33 103L19 120" stroke={skinColor} strokeWidth="8.5" strokeLinecap="round" />
        <ellipse cx="17" cy="122" rx="10" ry="4.5" fill="#2b2a4a" />
      </g>

      {/* Kaki Depan & Celana Putih */}
      <g className="lg lf">
        <path d="M52 86L70 100" stroke="#ffffff" strokeWidth="14" strokeLinecap="round" />
        <path d="M70 100L65 120" stroke={skinColor} strokeWidth="8.5" strokeLinecap="round" />
        <ellipse cx="68" cy="122" rx="10" ry="4.5" fill="#2b2a4a" />
      </g>

      {/* Tubuh Condong Menarik Tali */}
      <g className="bd">
        {/* Lengan Belakang */}
        <g className="ap">
          <path
            d="M40 50L62 61L83 59"
            stroke={shadowSkinColor}
            strokeWidth="7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="84" cy="59" r="5" fill={shadowSkinColor} />
        </g>

        {/* Kaos Tim + Selempang Putih + Nomor Punggung */}
        <path d="M50 85L36 52" stroke="#2b2a4a" strokeWidth="30" strokeLinecap="round" />
        <path d="M50 85L36 52" stroke={shirtColor} strokeWidth="25" strokeLinecap="round" />
        <path d="M41 62L53 67" stroke="#ffffff" strokeWidth="3" opacity="0.7" />
        {numLabel && (
          <text
            x="42"
            y="80"
            textAnchor="middle"
            fontFamily="Baloo 2, sans-serif"
            fontWeight="800"
            fontSize="17"
            fill="#ffffff"
            transform={
              mirrored
                ? 'rotate(-24 42 68) translate(42 0) scale(-1 1) translate(-42 0)'
                : 'rotate(-24 42 68)'
            }
          >
            {numLabel}
          </text>
        )}

        {/* Lengan Depan Menggenggam Tali (y ~ 60) */}
        <g className="ap">
          <path
            d="M35 54L60 65L84 62"
            stroke={skinColor}
            strokeWidth="7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="85" cy="62" r="5.5" fill={skinColor} />
        </g>

        {/* Lengan Selebrasi Menang */}
        <g className="au">
          <path
            d="M38 52L52 32L60 12M35 54L20 36L13 18"
            stroke={skinColor}
            strokeWidth="7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="60" cy="11" r="5" fill={skinColor} />
          <circle cx="13" cy="17" r="5" fill={skinColor} />
        </g>

        {/* Ekor Ikat Kepala Merah-Putih */}
        <g className="tail">
          <path d="M18 25Q8 23 1 30" stroke="#e2312d" strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <path d="M18 28Q9 31 3 38" stroke="#ffffff" strokeWidth="3.6" fill="none" strokeLinecap="round" />
        </g>

        {/* Kepala, Telinga, Rambut Bervariasi & Ikat Kepala */}
        <circle cx="31" cy="29" r="14" fill={skinColor} stroke="#2b2a4a" strokeWidth="3" />
        <circle cx="21" cy="32" r="3" fill={skinColor} stroke="#2b2a4a" strokeWidth="1.5" />
        <path d={hairPath} fill={hairColor} />
        <path d="M17 24Q31 16 46 23" stroke="#e2312d" strokeWidth="5" fill="none" />
        <path d="M17 28.5Q31 20.5 46 27.5" stroke="#ffffff" strokeWidth="4" fill="none" />

        {/* Mata, Alis, Rona Pipi & Mulut Ekspresif */}
        <circle cx="38" cy="31" r="3.2" fill="#ffffff" stroke="#2b2a4a" strokeWidth="1" />
        <circle cx="39.3" cy="31" r="1.7" fill="#2b2a4a" />
        <path d="M34 26L43 29" stroke="#2b2a4a" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="41" cy="37" r="2.6" fill="#ff8a8a" opacity="0.55" />
        <path
          className="mo"
          d="M33 38Q38 35.5 43 38L42 42Q38 44 34 42Z"
          fill="#7a1f1f"
          stroke="#2b2a4a"
          strokeWidth="1.2"
        />
        <path
          className="smi"
          d="M32 38q6 8 12 0"
          stroke="#2b2a4a"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export interface TarikTambangStadiumProps {
  title?: string;
  subtitle?: string;
  modeChip?: string;
  statusLabel?: string;
  timeText?: string;
  timeWarning?: boolean;
  taliPosition: number;
  batasMenang: number;
  namaTim1: string;
  namaTim2: string;
  skorMerah: number;
  skorPutih: number;
  tim1Meta?: string;
  tim2Meta?: string;
  leftPullerCount?: number;
  rightPullerCount?: number;
  variant?: 'solo' | 'multi';
  isPlaying?: boolean;
  isPaused?: boolean;
  winnerSide?: 'merah' | 'putih' | 'seri' | null;
  actionPulse?: TarikActionPulse | null;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onTogglePause?: () => void;
  onStop?: () => void;
  onBack?: () => void;
  backLabel?: string;
}

export function TarikTambangStadium({
  title = 'Tarik Tambang Kuis',
  subtitle = 'LOMBA 17 AGUSTUS',
  modeChip,
  statusLabel,
  timeText = '3:00',
  timeWarning = false,
  taliPosition,
  batasMenang,
  namaTim1,
  namaTim2,
  skorMerah,
  skorPutih,
  tim1Meta,
  tim2Meta,
  leftPullerCount = 1,
  rightPullerCount = 1,
  variant = 'solo',
  isPlaying = false,
  isPaused = false,
  winnerSide = null,
  actionPulse = null,
  isMuted,
  onToggleMute,
  onTogglePause,
  onStop,
  onBack,
  backLabel = 'Kembali',
}: TarikTambangStadiumProps) {
  const reactId = useId().replace(/:/g, '');
  const townPatternId = `tt-town-${reactId}`;

  const [ephemeralPulse, setEphemeralPulse] = useState<{
    id: string;
    side: 'l' | 'r';
    kind: 'heave' | 'jerk' | 'slip';
    pullerIdx: number;
    bubble: string | null;
  } | null>(null);

  useEffect(() => {
    if (!actionPulse) return;
    const clampedIdx =
      actionPulse.pullerIdx !== undefined ? Math.max(0, actionPulse.pullerIdx) : 0;
    setEphemeralPulse({
      id: actionPulse.id,
      side: actionPulse.side,
      kind: actionPulse.kind,
      pullerIdx: clampedIdx,
      bubble: actionPulse.bubble || null,
    });
    const timer = window.setTimeout(() => {
      setEphemeralPulse((prev) => (prev?.id === actionPulse.id ? null : prev));
    }, 1050);
    return () => window.clearTimeout(timer);
  }, [actionPulse]);

  const clampedBatas = Math.max(10, batasMenang || 100);
  const ratio = Math.max(-1, Math.min(1, taliPosition / clampedBatas));
  // Tim Merah ada di kiri: posisi positif (+) menggeser tali & grup ke KIRI menuju Zona Menang Merah (.zl)
  const shiftPct = Number((-ratio * 16).toFixed(3));
  const scaleLeftPct = Number((50 - ratio * 44).toFixed(2));

  const leftCount = variant === 'solo' ? 1 : Math.max(1, Math.min(5, leftPullerCount));
  const rightCount = variant === 'solo' ? 1 : Math.max(1, Math.min(5, rightPullerCount));

  const leftSpectators = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        idx: i,
        width: 30 + ((i * 5) % 9),
        shirt: RED_CROWD_SHIRTS[i % RED_CROWD_SHIRTS.length],
        skin: SKINS[(i * 3) % SKINS.length],
        hair: HAIRS[(i * 5) % HAIRS.length],
        delay: (((i * 29) % 14) / 10).toFixed(2),
        hasFlag: i % 4 === 0,
      })),
    []
  );

  const rightSpectators = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        idx: i,
        width: 30 + ((i * 7) % 9),
        shirt: BLUE_CROWD_SHIRTS[i % BLUE_CROWD_SHIRTS.length],
        skin: SKINS[(i * 2 + 1) % SKINS.length],
        hair: HAIRS[(i * 3 + 1) % HAIRS.length],
        delay: (((i * 33) % 14) / 10).toFixed(2),
        hasFlag: i % 4 === 2,
      })),
    []
  );

  const buntTop = useMemo(() => Array.from({ length: 44 }, (_, i) => i), []);
  const buntBot = useMemo(() => Array.from({ length: 44 }, (_, i) => i), []);

  const confettiItems = useMemo(() => {
    if (!winnerSide || winnerSide === 'seri') return [];
    const palette =
      winnerSide === 'merah'
        ? ['#e2312d', '#ffb81c', '#ffffff', '#ff6b57']
        : ['#1d8fe0', '#ffb81c', '#ffffff', '#38bdf8'];
    return Array.from({ length: 48 }, (_, i) => ({
      id: i,
      left: `${((i * 19 + 5) % 96).toFixed(1)}%`,
      color: palette[i % palette.length],
      dur: `${(1.8 + (i % 7) * 0.28).toFixed(2)}s`,
      delay: `${((i % 10) * 0.14).toFixed(2)}s`,
    }));
  }, [winnerSide]);

  const leftCheer =
    winnerSide === 'merah' || (ephemeralPulse?.side === 'l' && ephemeralPulse.kind === 'heave');
  const rightCheer =
    winnerSide === 'putih' || (ephemeralPulse?.side === 'r' && ephemeralPulse.kind === 'heave');

  const centerReadout =
    Math.abs(taliPosition) < 0.5
      ? 'SEIMBANG'
      : taliPosition > 0
        ? `+${Math.round(taliPosition)} ${namaTim1.split(' ').slice(-1)[0]?.toUpperCase()}`
        : `+${Math.round(Math.abs(taliPosition))} ${namaTim2.split(' ').slice(-1)[0]?.toUpperCase()}`;

  const renderPuller = (side: 'l' | 'r', idx: number, total: number) => {
    const isLeft = side === 'l';
    const gap = Math.min(8, 26 / Math.max(total - 1, 1));
    const leftPosPct =
      variant === 'solo'
        ? isLeft
          ? 36
          : 64
        : total === 1
          ? isLeft
            ? 38
            : 62
          : isLeft
            ? 46 - idx * gap
            : 54 + idx * gap;

    const mappedPulseIdx =
      ephemeralPulse && ephemeralPulse.side === side
        ? ephemeralPulse.pullerIdx % total
        : -1;

    let animClass = '';
    let bubbleText: string | null = null;
    if (ephemeralPulse && ephemeralPulse.side === side) {
      if (ephemeralPulse.kind === 'slip' && idx === mappedPulseIdx) {
        animClass = 'slip';
        bubbleText = ephemeralPulse.bubble;
      } else if (ephemeralPulse.kind === 'heave') {
        animClass = 'heave';
        if (idx === mappedPulseIdx) {
          bubbleText = ephemeralPulse.bubble || 'TARIK!';
        }
      } else if (ephemeralPulse.kind === 'jerk') {
        animClass = 'jerk';
      }
    }

    const paletteIdx =
      variant === 'solo'
        ? isLeft
          ? 0
          : 1
        : total === 1 && !isLeft
          ? 1
          : idx;
    const skinPair = PULLER_SKINS[paletteIdx % PULLER_SKINS.length];
    const hairColor = HAIRS[(paletteIdx * 3) % HAIRS.length];
    const hairPath = PULLER_HAIRS[paletteIdx % PULLER_HAIRS.length];
    const shirtColor = isLeft ? '#e2312d' : '#1d8fe0';
    const numLabel = variant === 'solo' ? (isLeft ? '1' : '2') : undefined;

    return (
      <div
        key={`${side}-${idx}`}
        className={`tt-pu ${animClass}`}
        style={{
          left: `${leftPosPct}%`,
          zIndex: variant === 'solo' ? 20 : 20 - idx,
          ['--i' as any]: idx,
        }}
      >
        {bubbleText && (
          <div key={ephemeralPulse?.id} className="tt-say">
            {bubbleText}
          </div>
        )}
        <div className="tt-pf">
          <div className="tt-pa">
            <TarikPullerSvg
              shirtColor={shirtColor}
              skinColor={skinPair.sk}
              shadowSkinColor={skinPair.sh}
              hairColor={hairColor}
              hairPath={hairPath}
              numLabel={numLabel}
              mirrored={!isLeft}
            />
          </div>
          <div className="tt-dust" />
          <div className="tt-dz">✦ ✦</div>
        </div>
      </div>
    );
  };

  return (
    <section className={`tt-stage ${isPaused ? 'paused' : ''}`}>
      {/* Atas: Langit, Kota/Desa, Bendera, Penonton Merah vs Biru, Spanduk & HUD */}
      <div className="tt-sc">
        {/* Top Floating HUD */}
        <div className="tt-top">
          {onBack && (
            <button type="button" onClick={onBack} className="tt-ib" title={backLabel}>
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{backLabel}</span>
            </button>
          )}
          <div>
            <small>{subtitle}</small>
            <h1>{title}</h1>
          </div>
          {modeChip && <span className="tt-chip">{modeChip}</span>}
          {statusLabel && (
            <span className={`tt-chip ${isPlaying ? 'live' : 'gold'}`}>{statusLabel}</span>
          )}
          <div className={`tt-tmr ${timeWarning ? 'warn' : ''}`} title="Sisa Waktu Lomba">
            {timeText}
          </div>
          <div className="tt-sp" />
          {onTogglePause && (
            <button type="button" onClick={onTogglePause} className="tt-ib">
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              <span className="hidden sm:inline">{isPaused ? 'Lanjut' : 'Jeda'}</span>
            </button>
          )}
          {onStop && (
            <button type="button" onClick={onStop} className="tt-ib danger">
              <StopCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Akhiri</span>
            </button>
          )}
          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              className="tt-ib"
              title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
              aria-label={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Matahari & Awan */}
        <div className="tt-sun" />
        <div className="tt-cloud" style={{ width: 110, top: 128, left: '30%' }} />
        <div
          className="tt-cloud"
          style={{ width: 90, top: 150, left: '64%', animationDuration: '100s' }}
        />

        {/* Latar Perkampungan + Bukit + Gedung */}
        <svg className="tt-sky" height="150" aria-hidden="true">
          <defs>
            <pattern id={townPatternId} width="600" height="150" patternUnits="userSpaceOnUse">
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
              <rect x="560" y="33" width="34" height="11" fill="#ffffff" />
              <path d="M0 150V100Q150 70 300 100T600 100V150Z" fill="#9fd685" />
              <rect x="478" y="95" width="8" height="40" fill="#6b4423" />
              <circle cx="482" cy="80" r="26" fill="#2f8f3f" />
              <rect x="16" y="105" width="7" height="35" fill="#6b4423" />
              <circle cx="20" cy="92" r="18" fill="#2f8f3f" />
            </pattern>
          </defs>
          <rect width="100%" height="150" fill={`url(#${townPatternId})`} />
        </svg>

        {/* Bendera Tiang Kiri & Kanan */}
        <div className="tt-pole l2" aria-hidden="true">
          <i />
        </div>
        <div className="tt-pole r2" aria-hidden="true">
          <i />
        </div>

        {/* Rumbai Bendera Atas + Spanduk Dirgahayu */}
        <div className="tt-bunt bt" aria-hidden="true">
          {buntTop.map((i) => (
            <i key={i} />
          ))}
        </div>
        <div className="tt-ban">DIRGAHAYU REPUBLIK INDONESIA KE-81</div>

        {/* Penonton Terbelah Kiri (Merah) vs Kanan (Biru) — seluruh bendera tetap Merah-Putih */}
        <div className="tt-crowd" aria-hidden="true">
          {[
            { key: 'cl', list: leftSpectators, cheer: leftCheer },
            { key: 'cr', list: rightSpectators, cheer: rightCheer },
          ].map((group) => (
            <div key={group.key} className={`tt-crowd-side ${group.cheer ? 'cheer' : ''}`}>
              {group.list.map((sp) => (
                <svg
                  key={`${group.key}-${sp.idx}`}
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
          ))}
        </div>

        {/* Rumbai Bawah + Tembok Pembatas */}
        <div className="tt-bunt bb" aria-hidden="true">
          {buntBot.map((i) => (
            <i key={i} />
          ))}
        </div>
        <div className="tt-wall">
          <span className="tt-disp">17 AGUSTUS 1945 • MERDEKA!!</span>
        </div>
      </div>

      {/* Lapangan Tarik Tambang Hijau Bergaris */}
      <div className="tt-field">
        <div className="tt-zl" />
        <div className="tt-zr" />
        <div className="tt-c0" />
        <div className="tt-zt left">ZONA MENANG {namaTim1.toUpperCase()}</div>
        <div className="tt-zt right">ZONA MENANG {namaTim2.toUpperCase()}</div>

        {/* Confetti Kemenangan */}
        {confettiItems.map((c) => (
          <div
            key={c.id}
            className="tt-cf"
            style={{
              left: c.left,
              background: c.color,
              animationDuration: c.dur,
              animationDelay: c.delay,
            }}
          />
        ))}

        {/* Kartu Skor Kiri vs Tengah vs Kanan */}
        <div className="tt-info">
          <div className="tt-tc" style={{ ['--c' as any]: '#e2312d' }}>
            <TarikAvatarSvg color="#e2312d" side="l" size={44} />
            <div className="min-w-0">
              <b className="truncate">{namaTim1}</b>
              <small>
                Benar: {skorMerah}
                {tim1Meta ? ` • ${tim1Meta}` : ''}
              </small>
            </div>
          </div>

          <div className="tt-rl">
            <small>TARGET ±{clampedBatas}</small>
            <b>{centerReadout}</b>
          </div>

          <div className="tt-tc r" style={{ ['--c' as any]: '#1d8fe0' }}>
            <TarikAvatarSvg color="#1d8fe0" side="r" size={44} />
            <div className="min-w-0">
              <b className="truncate">{namaTim2}</b>
              <small>
                Benar: {skorPutih}
                {tim2Meta ? ` • ${tim2Meta}` : ''}
              </small>
            </div>
          </div>
        </div>

        {/* Arena Pergeseran Tali & Tim Penarik */}
        <div className={`tt-arena ${variant === 'solo' ? 'solo' : ''}`}>
          <div className="tt-grp" style={{ ['--s' as any]: shiftPct }}>
            <div
              className={`tt-team t1 ${isPlaying && !winnerSide ? 'pull' : ''} ${
                winnerSide === 'merah' ? 'win' : winnerSide === 'putih' ? 'fall' : ''
              }`}
            >
              {Array.from({ length: leftCount }, (_, idx) => renderPuller('l', idx, leftCount))}
            </div>

            <div
              className={`tt-team t2 ${isPlaying && !winnerSide ? 'pull' : ''} ${
                winnerSide === 'putih' ? 'win' : winnerSide === 'merah' ? 'fall' : ''
              }`}
            >
              {Array.from({ length: rightCount }, (_, idx) => renderPuller('r', idx, rightCount))}
            </div>

            <div className={`tt-rope ${variant === 'solo' ? 'solo' : ''} ${isPlaying && !winnerSide ? 'go' : ''}`} />

            {/* Bendera Merah-Putih Penanda Tengah Tali */}
            <svg className="tt-mkr" viewBox="0 0 28 46" aria-hidden="true">
              <rect x="12" y="0" width="4" height="10" fill="#5d3a14" />
              <rect x="3" y="8" width="22" height="16" fill="#e2312d" stroke="#2b2a4a" strokeWidth="2" />
              <rect x="3" y="24" width="22" height="16" fill="#ffffff" stroke="#2b2a4a" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Indikator Skala Posisi Tali Bawah */}
        <div className="tt-scale" aria-label="Skala posisi tali">
          <span style={{ left: 0 }}>{namaTim1.toUpperCase()}</span>
          <span style={{ left: '50%', transform: 'translateX(-50%)' }}>TENGAH</span>
          <span style={{ right: 0 }}>{namaTim2.toUpperCase()}</span>
          <i style={{ left: `${scaleLeftPct}%` }} />
        </div>
      </div>
    </section>
  );
}
