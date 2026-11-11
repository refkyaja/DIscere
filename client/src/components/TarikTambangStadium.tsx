import { useEffect, useId, useMemo, useState } from 'react';
import { ArrowLeft, Pause, Play, StopCircle, Volume2, VolumeX } from 'lucide-react';
import './tarikTambangFestival.css';

const SKINS = ['#ffd9a8', '#e8b27d', '#c58c5a', '#f3c99b'];
const HAIRS = ['#2b2a4a', '#4a2c17', '#111111', '#6b3b1e'];
const RED_CROWD_SHIRTS = ['#e2312d', '#ff6b57', '#ffb81c', '#d9483b', '#f28b82'];
const BLUE_CROWD_SHIRTS = ['#1d8fe0', '#38bdf8', '#ffb81c', '#2563eb', '#60a5fa'];

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
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      style={{ flex: 'none', transform: side === 'r' ? 'scaleX(-1)' : undefined }}
    >
      <circle cx="24" cy="24" r="22" fill="#fffdf6" stroke={color} strokeWidth="3" />
      <path d="M11 40c2-8 24-8 26 0" fill={color} stroke="#2b2a4a" strokeWidth="2.5" />
      <circle cx="24" cy="20" r="10" fill="#ffd9a8" stroke="#2b2a4a" strokeWidth="2.5" />
      <path d="M14 16Q24 9 34 16l0 4Q24 14 14 20Z" fill="#e2312d" stroke="#2b2a4a" strokeWidth="2" />
      <path d="M14 18Q24 12 34 18" stroke="#ffffff" strokeWidth="2.5" fill="none" />
      <circle cx="20.5" cy="21.5" r="1.5" fill="#2b2a4a" />
      <circle cx="27.5" cy="21.5" r="1.5" fill="#2b2a4a" />
      <path d="M20 26q4 4 8 0" stroke="#2b2a4a" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export interface TarikPullerSvgProps {
  shirtColor: string;
  skinColor?: string;
  hairColor?: string;
  numLabel?: string;
  mirrored?: boolean;
}

/**
 * Karakter penarik tali bergaya kartun Festival 17 Agustus (proporsi 100x130).
 * Menggunakan kelas `.bd`, `.lb`, `.lf`, `.tail`, `.ap`, `.au`, `.mo`, `.smi`
 * agar selaras dengan animasi CSS strain/heave/jerk/slip/win/fall.
 */
export function TarikPullerSvg({
  shirtColor,
  skinColor = '#ffd9a8',
  hairColor = '#2b2a4a',
  numLabel,
  mirrored = false,
}: TarikPullerSvgProps) {
  return (
    <svg viewBox="0 0 100 130" aria-hidden="true">
      {/* Bayangan Rumput */}
      <ellipse cx="48" cy="126" rx="26" ry="5" fill="rgba(0,0,0,0.22)" />

      {/* Kaki Belakang & Sepatu */}
      <g className="lb">
        <path
          d="M44 86L28 118"
          stroke="#2b2a4a"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M44 86L28 118"
          stroke="#3b4166"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <ellipse cx="26" cy="121" rx="9" ry="5" fill="#1f2338" stroke="#2b2a4a" strokeWidth="2.5" />
      </g>

      {/* Kaki Depan & Sepatu */}
      <g className="lf">
        <path
          d="M52 86L72 118"
          stroke="#2b2a4a"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M52 86L72 118"
          stroke="#48507d"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <ellipse cx="75" cy="121" rx="9" ry="5" fill="#1f2338" stroke="#2b2a4a" strokeWidth="2.5" />
      </g>

      {/* Tubuh Bagian Atas */}
      <g className="bd">
        {/* Ekor Ikat Kepala Merah-Putih */}
        <g className="tail">
          <path d="M18 24L4 19L8 27Z" fill="#e2312d" stroke="#2b2a4a" strokeWidth="2" />
          <path d="M18 27L5 31L9 36Z" fill="#ffffff" stroke="#2b2a4a" strokeWidth="2" />
        </g>

        {/* Baju / Kaos Tim */}
        <rect
          x="30"
          y="46"
          width="36"
          height="42"
          rx="12"
          fill={shirtColor}
          stroke="#2b2a4a"
          strokeWidth="3.2"
        />

        {numLabel && (
          <text
            x="48"
            y="74"
            fontSize="14"
            fontWeight="800"
            textAnchor="middle"
            fill="#ffffff"
            fontFamily="Baloo 2, sans-serif"
            transform={mirrored ? 'translate(96, 0) scale(-1, 1)' : undefined}
          >
            {numLabel}
          </text>
        )}

        {/* Kepala, Rambut, & Ikat Kepala Merah-Putih */}
        <circle cx="48" cy="28" r="20" fill={skinColor} stroke="#2b2a4a" strokeWidth="3.2" />
        <path
          d="M28 24c1-13 38-13 40 0c-6-6-34-6-40 0Z"
          fill={hairColor}
        />
        <path
          d="M28 21Q48 11 68 21L68 27Q48 17 28 27Z"
          fill="#ffffff"
          stroke="#2b2a4a"
          strokeWidth="2.6"
        />
        <path d="M28 21Q48 11 68 21L68 24Q48 14 28 24Z" fill="#e2312d" />

        {/* Mata */}
        <circle cx="54" cy="31" r="2.4" fill="#2b2a4a" />
        <circle cx="62" cy="30" r="2.2" fill="#2b2a4a" />
        <path d="M51 27l6 -2" stroke="#2b2a4a" strokeWidth="2" strokeLinecap="round" />

        {/* Mulut Normal / Mengejan vs Menang */}
        <path
          className="mo"
          d="M52 38h10"
          stroke="#2b2a4a"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          className="smi"
          d="M50 36q7 9 14 0Z"
          fill="#c2332f"
          stroke="#2b2a4a"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Lengan Menggenggam Tali (y=60 agar sejajar tali .rope) */}
        <g className="ap">
          <path
            d="M42 54L68 60M56 54L80 60"
            stroke="#2b2a4a"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M42 54L68 60M56 54L80 60"
            stroke={skinColor}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <circle cx="68" cy="60" r="4.8" fill={skinColor} stroke="#2b2a4a" strokeWidth="2.2" />
          <circle cx="80" cy="60" r="4.8" fill={skinColor} stroke="#2b2a4a" strokeWidth="2.2" />
        </g>

        {/* Lengan Mengangkat Selebrasi Menang */}
        <g className="au">
          <path
            d="M35 52L20 26M60 52L76 24"
            stroke="#2b2a4a"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M35 52L20 26M60 52L76 24"
            stroke={skinColor}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <circle cx="20" cy="25" r="4.8" fill={skinColor} stroke="#2b2a4a" strokeWidth="2.2" />
          <circle cx="76" cy="23" r="4.8" fill={skinColor} stroke="#2b2a4a" strokeWidth="2.2" />
        </g>
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
    const leftPosPct =
      variant === 'solo'
        ? isLeft
          ? 32
          : 68
        : isLeft
          ? 35 - idx * 6
          : 65 + idx * 6;

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

    const skinColor = SKINS[(idx * 3 + (isLeft ? 0 : 1)) % SKINS.length];
    const hairColor = HAIRS[(idx * 5 + (isLeft ? 0 : 2)) % HAIRS.length];
    const shirtColor = isLeft ? '#e2312d' : '#1d8fe0';
    const numLabel = variant === 'solo' ? (isLeft ? '#1' : '#2') : `${idx + 1}`;

    return (
      <div
        key={`${side}-${idx}`}
        className={`tt-pu ${animClass}`}
        style={{ left: `${leftPosPct}%`, ['--i' as any]: idx }}
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
              skinColor={skinColor}
              hairColor={hairColor}
              numLabel={numLabel}
              mirrored={!isLeft}
            />
          </div>
          <div className="tt-dust" />
          <div className="tt-dz">z z</div>
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

        {/* Penonton Terbelah Kiri (Merah) vs Kanan (Biru) */}
        <div className="tt-crowd" aria-hidden="true">
          <div className={`tt-crowd-side ${leftCheer ? 'cheer' : ''}`}>
            {leftSpectators.map((sp) => (
              <svg
                key={`cl-${sp.idx}`}
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
          <div className={`tt-crowd-side ${rightCheer ? 'cheer' : ''}`}>
            {rightSpectators.map((sp) => (
              <svg
                key={`cr-${sp.idx}`}
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
                    <path d="M37 -12h12v5h-12z" fill="#1d8fe0" />
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
        <div className="tt-arena">
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

            {/* Pita Merah-Putih Penanda Tengah Tali */}
            <svg className="tt-mkr" viewBox="0 0 28 46" aria-hidden="true">
              <rect x="11" y="0" width="6" height="14" rx="3" fill="#e2312d" stroke="#2b2a4a" strokeWidth="2" />
              <path d="M14 14L6 40L14 35Z" fill="#e2312d" stroke="#2b2a4a" strokeWidth="2" />
              <path d="M14 14L22 40L14 35Z" fill="#ffffff" stroke="#2b2a4a" strokeWidth="2" />
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
