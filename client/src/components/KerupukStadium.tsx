import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Pause, Play, StopCircle, Volume2, VolumeX } from 'lucide-react';
import './kerupukFestival.css';

/* ============================================================================
   PALET WARNA & BENTUK KARAKTER FESTIVAL 17 AGUSTUS
   ============================================================================ */

const SKINS = ['#ffd9a8', '#e8b27d', '#c58c5a', '#f2c08d', '#a8703f'];
const HAIRS = ['#241a14', '#4a2c17', '#111111', '#6b3b1e'];
const PANTS = ['#2b4a8a', '#3a3a3a', '#7a3fd0', '#1f7a5a', '#8a5a30', '#c2332f'];

const CROWD_SHIRTS = [
  '#e2312d',
  '#ffffff',
  '#1d8fe0',
  '#ffb81c',
  '#1f9d55',
  '#ff7a59',
  '#c2332f',
  '#7a3fd0',
];
const CROWD_SKINS = ['#ffd9a8', '#e8b27d', '#c58c5a', '#f3c99b'];
const CROWD_HAIRS = ['#2b2a4a', '#4a2c17', '#111111', '#6b3b1e'];

const CAP_PATH = 'M28 48Q32 24 60 22Q88 24 92 48Q60 36 28 48Z';
const SPIKY_HAIR =
  'M26 50L24 26L38 34L46 14L58 28L72 12L78 30L94 24L92 50Q60 36 26 50Z';

/* ============================================================================
   KOMPONEN KARAKTER PESERTA 17 AGUSTUS (SVG)
   ============================================================================ */

export interface ContestantCharSvgProps {
  shirtColor: string;
  index?: number;
  className?: string;
  size?: number;
}

export function ContestantCharSvg({
  shirtColor,
  index = 0,
  className = '',
}: ContestantCharSvgProps) {
  const k = SKINS[(index * 2 + 1) % SKINS.length];
  const h = HAIRS[(index * 3) % HAIRS.length];
  const p = PANTS[(index * 5 + 2) % PANTS.length];
  const st = index % 6;

  const amMap: Array<[number, number]> = [
    [-14, 20],
    [-4, 8],
    [-8, 12],
    [-14, 20],
    [-22, 26],
    [-12, 16],
  ];
  const am = amMap[st] || [-14, 20];
  const isRightArmWave = st === 3 || st === 5;
  const legHeight = st === 2 ? 86 : 60;

  return (
    <svg
      viewBox="0 0 120 232"
      aria-hidden="true"
      className={className}
      style={
        {
          ['--a1' as any]: `${am[0]}deg`,
          ['--a2' as any]: `${am[1]}deg`,
        } as React.CSSProperties
      }
    >
      {/* Bayangan di Rumput */}
      <ellipse cx="60" cy="226" rx="40" ry="5.5" fill="rgba(0,0,0,0.22)" />

      {/* Kaki & Celana Putih / Olahraga */}
      <g className="kp-lgs">
        <rect x="48" y="128" width="10" height="90" rx="5" fill={k} stroke="#0f3d2e" strokeWidth="2.5" />
        <rect x="62" y="128" width="10" height="90" rx="5" fill={k} stroke="#0f3d2e" strokeWidth="2.5" />
        <rect x="46" y="128" width="14" height={legHeight} rx="6" fill={p} stroke="#0f3d2e" strokeWidth="2.5" />
        <rect x="60" y="128" width="14" height={legHeight} rx="6" fill={p} stroke="#0f3d2e" strokeWidth="2.5" />
        <ellipse cx="49" cy="221" rx="12" ry="6" fill="#ffffff" stroke="#0f3d2e" strokeWidth="2.5" />
        <ellipse cx="71" cy="221" rx="12" ry="6" fill="#ffffff" stroke="#0f3d2e" strokeWidth="2.5" />
        <path d="M40 219h12M62 219h12" stroke="#e2312d" strokeWidth="2.5" />
      </g>

      {/* Rok / Celana Panjang tambahan jika tipe tertentu */}
      {st === 1 || st === 4 ? (
        <path
          d="M46 140L40 190H80L74 140Z"
          fill={p}
          stroke="#0f3d2e"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      ) : st === 2 ? (
        <path
          d="M46 140L41 212H79L74 140Z"
          fill={p}
          stroke="#0f3d2e"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      ) : null}

      {/* Tubuh Bagian Atas & Baju */}
      <g className="kp-up">
        {/* Leher */}
        <rect x="53" y="82" width="14" height="30" fill={k} stroke="#0f3d2e" strokeWidth="2.5" />
        {/* Kaos Tim */}
        <rect x="44" y="99" width="32" height="58" rx="12" fill={shirtColor} stroke="#0f3d2e" strokeWidth="2.5" />
        <path d="M44 148H76" stroke="#0f3d2e" strokeOpacity="0.25" strokeWidth="3" />

        {/* Motif / Nomor Baju */}
        {st === 0 && (
          <>
            <path d="M53 99L60 110L67 99" fill="#ffffff" stroke="#0f3d2e" strokeWidth="2" />
            <path d="M64 124h8v8h-8z" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2" />
          </>
        )}
        {st === 1 && (
          <>
            <rect x="44" y="118" width="32" height="6" fill="#ffffff" opacity="0.9" />
            <rect x="44" y="130" width="32" height="4" fill="#ffffff" opacity="0.65" />
          </>
        )}
        {st === 2 && (
          <>
            <path d="M53 99L60 108L67 99" fill="#ffffff" stroke="#0f3d2e" strokeWidth="2" />
            <circle cx="60" cy="120" r="4" fill="#ffd23f" stroke="#0f3d2e" strokeWidth="1.5" />
          </>
        )}
        {st === 3 && (
          <text
            x="60"
            y="141"
            textAnchor="middle"
            fontFamily="Baloo 2, sans-serif"
            fontWeight="800"
            fontSize="24"
            fill="#ffffff"
          >
            {index + 1}
          </text>
        )}
        {st === 4 && (
          <>
            <path d="M51 99V157M69 99V157" stroke="#0f3d2e" strokeOpacity="0.4" strokeWidth="3" />
            <circle cx="51" cy="112" r="2.6" fill="#ffd23f" />
            <circle cx="69" cy="112" r="2.6" fill="#ffd23f" />
          </>
        )}
        {st === 5 && (
          <path
            d="M60 111l4.5 9 10 1.2-7.3 6.8 2 9.8-9.2-5-9.2 5 2-9.8-7.3-6.8 10-1.2z"
            fill="#ffd23f"
          />
        )}

        {/* Lengan Kiri */}
        <g className="kp-aL">
          <path
            d="M46 108L39 132L41 151"
            stroke={k}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M46 108L42 120" stroke={shirtColor} strokeWidth="11" strokeLinecap="round" />
          <circle cx="41" cy="152" r="5" fill={k} />
        </g>

        {/* Lengan Kanan */}
        <g className={`kp-aR ${isRightArmWave ? 'wv' : ''}`}>
          <path
            d="M74 108L81 132L79 151"
            stroke={k}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M74 108L78 120" stroke={shirtColor} strokeWidth="11" strokeLinecap="round" />
          <circle cx="79" cy="152" r="5" fill={k} />
        </g>

        {/* Kepala & Raut Muka */}
        <g className="kp-hd">
          <g transform="translate(60 96) scale(0.78) translate(-60 -96)">
            {/* Telinga */}
            <circle cx="26" cy="64" r="7" fill={k} stroke="#0f3d2e" strokeWidth="2.5" />
            <circle cx="94" cy="64" r="7" fill={k} stroke="#0f3d2e" strokeWidth="2.5" />

            {/* Wajah */}
            <circle cx="60" cy="60" r="34" fill={k} stroke="#0f3d2e" strokeWidth="3.5" />

            {/* Rambut Belakang / Gaya */}
            {st === 1 && <path d="M90 50Q118 50 108 94Q100 72 88 64Z" fill={h} />}
            {st === 4 && (
              <>
                <circle cx="20" cy="46" r="11" fill={h} />
                <circle cx="100" cy="46" r="11" fill={h} />
              </>
            )}

            {/* Rambut Atas */}
            {st === 3 ? (
              [36, 48, 60, 72, 84].map((x, j) => (
                <circle
                  key={j}
                  cx={x}
                  cy={[38, 29, 25, 29, 38][j]}
                  r="11"
                  fill={h}
                />
              ))
            ) : st === 5 ? (
              <path d={SPIKY_HAIR} fill={h} />
            ) : (
              <path d={CAP_PATH} fill={h} />
            )}

            {/* Ikat Kepala Merah Putih Khas 17 Agustus */}
            <path
              d="M27 50Q60 36 93 50L92 58Q60 46 28 58Z"
              fill="#ffffff"
              stroke="#0f3d2e"
              strokeWidth="2.5"
            />
            <path
              d="M27.5 50Q60 36 92.5 50L92 54Q60 41 28 54Z"
              fill="#e2312d"
            />

            {/* Mata & Alis */}
            <ellipse cx="47" cy="66" rx="6.5" ry="7.5" fill="#ffffff" stroke="#0f3d2e" strokeWidth="2" />
            <ellipse cx="73" cy="66" rx="6.5" ry="7.5" fill="#ffffff" stroke="#0f3d2e" strokeWidth="2" />
            <circle cx="47" cy="63.5" r="3.4" fill="#0f3d2e" />
            <circle cx="73" cy="63.5" r="3.4" fill="#0f3d2e" />

            {/* Pipi Merona Ceria */}
            <circle cx="38" cy="78" r="6" fill="#ff9d94" opacity="0.7" />
            <circle cx="82" cy="78" r="6" fill="#ff9d94" opacity="0.7" />

            {/* Ekspresi Mulut Berbagai State: */}
            {/* .m0: Senyum Santai (Default) */}
            <path
              className="kp-m0"
              d="M50 82Q60 90 70 82"
              stroke="#0f3d2e"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />

            {/* .m1: Mulut Terbuka Siap Menggigit (Lunge) */}
            <g className="kp-m1">
              <ellipse cx="60" cy="86" rx="10" ry="12" fill="#6b1d1d" stroke="#0f3d2e" strokeWidth="2.5" />
              <ellipse cx="60" cy="92" rx="6" ry="4" fill="#ff7f7f" />
            </g>

            {/* .m2: Mulut Mengunyah Renyah (Chewing) */}
            <ellipse
              className="kp-m2"
              cx="60"
              cy="85"
              rx="8"
              ry="7"
              fill="#6b1d1d"
              stroke="#0f3d2e"
              strokeWidth="2.5"
            />

            {/* .m3: Mulut Cemberut Meleset (Oops / Miss) */}
            <path
              className="kp-m3"
              d="M50 90Q60 80 70 90"
              stroke="#0f3d2e"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />

            {/* .m4: Senyum Menang Puas Kerupuk Ludes (Win) */}
            <path
              className="kp-m4"
              d="M46 80Q60 98 74 80Z"
              fill="#6b1d1d"
              stroke="#0f3d2e"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />

            {/* .sw: Tetesan Keringat ketika Meleset tertiup angin */}
            <path
              className="kp-sw"
              d="M96 40q-5 9 0 12q5-3 0-12z"
              fill="#7fd0ff"
              stroke="#1d8fe0"
              strokeWidth="1.5"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}

/* ============================================================================
   KERUPUK GANTUNG DENGAN MASK GIGITAN DINAMIS (SVG)
   ============================================================================ */

export interface HangingKerupukSvgProps {
  maskId: string;
  eatenFraction: number; // 0 (utuh) s.d. 1 (ludes)
}

export function HangingKerupukSvg({ maskId, eatenFraction }: HangingKerupukSvgProps) {
  const clamped = Math.max(0, Math.min(1, eatenFraction));
  const cutY = 124 * (1 - clamped);

  return (
    <svg className="kp-kr" viewBox="0 0 100 112" aria-hidden="true">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-5" y="-5" width="110" height="130">
          <rect x="-5" y="-5" width="110" height="130" fill="#ffffff" />
          <g
            className="kp-cut"
            style={{
              transform: `translateY(${cutY}px)`,
              transition: 'transform 0.7s cubic-bezier(0.3, 1.3, 0.5, 1)',
            }}
          >
            <rect x="-10" y="0" width="120" height="140" fill="#000000" />
            {[0, 1, 2, 3, 4, 5, 6].map((k) => (
              <circle key={k} cx={k * 16 - 6} cy="0" r="9" fill="#000000" />
            ))}
          </g>
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        {/* Badan Kerupuk Renyah Bergelombang */}
        <path
          d="M16 8Q50 -2 84 8Q98 14 96 42Q99 72 90 96Q70 110 42 108Q10 111 6 88Q0 52 8 24Q10 10 16 8Z"
          fill="#fbe3b9"
          stroke="#e0aa6a"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        {/* Guratan / Kerutan Tepung Putih Renyah */}
        <path
          d="M22 38Q36 28 50 38T78 38M22 58Q36 48 50 58T78 58M22 78Q36 68 50 78T78 78"
          stroke="#e8b878"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
        {/* Bintik Gurih */}
        <g fill="#e8b878">
          <circle cx="30" cy="24" r="1.8" />
          <circle cx="68" cy="22" r="1.8" />
          <circle cx="76" cy="92" r="1.8" />
          <circle cx="28" cy="94" r="1.8" />
        </g>
      </g>
    </svg>
  );
}

/* ============================================================================
   PENONTON SVG BERSORAK (SPECTATORS)
   ============================================================================ */

function SpectatorPerson({
  width,
  shirt,
  skin,
  hair,
  hasFlag,
  idx = 0,
}: {
  width: number;
  shirt: string;
  skin: string;
  hair: string;
  hasFlag: boolean;
  idx?: number;
}) {
  const pants = ['#2b4a8a', '#3a3a3a', '#6b3b1e', '#1f7a5a'][idx % 4];
  const delay = (((idx * 37) % 15) / 10).toFixed(2);
  const isHijab = idx % 5 === 2;

  return (
    <svg
      width={width}
      viewBox="0 -16 40 92"
      style={{ animationDelay: `-${delay}s` }}
      aria-hidden="true"
    >
      <ellipse cx="20" cy="74" rx="15" ry="2.6" fill="rgba(0,0,0,0.22)" />
      <rect x="11" y="50" width="8" height="22" rx="3" fill={pants} stroke="#2b2a4a" strokeWidth="1.2" />
      <rect x="21" y="50" width="8" height="22" rx="3" fill={pants} stroke="#2b2a4a" strokeWidth="1.2" />
      <ellipse cx="14.5" cy="73" rx="6" ry="2.8" fill="#2b2a4a" />
      <ellipse cx="25.5" cy="73" rx="6" ry="2.8" fill="#2b2a4a" />

      {/* Lengan Kiri */}
      <g className="kp-aL">
        <path d="M9 34L4 52" stroke={skin} strokeWidth="4.6" strokeLinecap="round" />
        <path d="M9 34L6 42" stroke={shirt} strokeWidth="6" strokeLinecap="round" />
      </g>

      {/* Lengan Kanan + Bendera Merah Putih jika ada */}
      {hasFlag ? (
        <>
          <path d="M37 16V-12" stroke="#6b4423" strokeWidth="2" />
          <path d="M37 -12h12v5h-12z" fill="#e2312d" />
          <path d="M37 -7h12v5h-12z" fill="#ffffff" stroke="#dddddd" strokeWidth="0.5" />
          <path
            d="M31 34L37 24L37 15"
            stroke={skin}
            strokeWidth="4.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      ) : (
        <g className="kp-aR">
          <path d="M31 34L36 52" stroke={skin} strokeWidth="4.6" strokeLinecap="round" />
          <path d="M31 34L34 42" stroke={shirt} strokeWidth="6" strokeLinecap="round" />
        </g>
      )}

      {/* Badan */}
      <rect x="8" y="30" width="24" height="26" rx="8" fill={shirt} stroke="#2b2a4a" strokeWidth="1.2" />
      <circle cx="20" cy="19" r="10" fill={isHijab ? pants : skin} stroke="#2b2a4a" strokeWidth="1.2" />
      {isHijab ? (
        <ellipse cx="20" cy="20" rx="7" ry="7.5" fill={skin} />
      ) : (
        <path d="M10 18Q20 4 30 18Q20 11 10 18Z" fill={hair} />
      )}
      <circle cx="17" cy="20" r="1.1" fill="#2b2a4a" />
      <circle cx="23" cy="20" r="1.1" fill="#2b2a4a" />
      <path d="M17.5 24Q20 26 22.5 24" stroke="#8a2a2a" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

/* ============================================================================
   INTERFACES & TYPES
   ============================================================================ */

export interface KerupukActionPulse {
  id: number;
  laneIdx: number;
  type: 'bite' | 'miss' | 'win';
  lucky?: boolean;
  text?: string;
}

export interface KerupukLaneItem {
  id: string | number;
  nama: string;
  warna: string;
  eatenFraction: number; // 0 s.d. 1
  skor?: number;
  benar?: number;
  salah?: number;
  streak?: number;
  subText?: string;
  isWinner?: boolean;
}

export interface KerupukStadiumProps {
  title: string;
  subtitle?: string;
  statusLabel: string;
  statusTone?: 'idle' | 'live' | 'done';
  timerText?: string;
  targetText?: string;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onBack?: () => void;
  backLabel?: string;
  isPaused?: boolean;
  onTogglePause?: () => void;
  onStop?: () => void;
  stopLabel?: string;
  lanes: KerupukLaneItem[];
  actionPulse?: KerupukActionPulse | null;
  crowdCheer?: boolean;
  kerupukWidth?: number;
}

const SAY_NYAM = ['Nyam!', 'Krauk!', 'Renyah!', 'Hap!', 'Krenyes!'];

/* ============================================================================
   KOMPONEN PANGGUNG LOMBA MAKAN KERUPUK (FESTIVAL STADIUM)
   ============================================================================ */

export function KerupukStadium({
  title,
  subtitle,
  statusLabel,
  statusTone = 'idle',
  timerText,
  targetText,
  isMuted,
  onToggleMute,
  onBack,
  backLabel = 'Kembali',
  isPaused,
  onTogglePause,
  onStop,
  stopLabel = 'Akhiri',
  lanes,
  actionPulse,
  crowdCheer = false,
  kerupukWidth,
}: KerupukStadiumProps) {
  const reactId = useId().replace(/:/g, '');
  const townPatternId = `kp-town-pat-${reactId}`;
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Status visual per lane: class states, crumbs, speech bubble, wind/leaves
  const [laneClasses, setLaneClasses] = useState<Record<number, { ch: string; pend: string }>>({});
  const [bubbles, setBubbles] = useState<
    Array<{ id: string; laneIdx: number; text: string; tone: 'g' | 'b' }>
  >([]);
  const [crumbs, setCrumbs] = useState<
    Array<{ id: string; laneIdx: number; left: number; dx: number; dy: number }>
  >([]);
  const [winds, setWinds] = useState<Array<{ id: string; laneIdx: number; top: number; width: number }>>([]);
  const [leaves, setLeaves] = useState<Array<{ id: string; laneIdx: number; top: number; delay: number }>>([]);
  const [confettiList, setConfettiList] = useState<
    Array<{ id: string; left: number; color: string; duration: number; delay: number }>
  >([]);
  const [isGusting, setIsGusting] = useState(false);

  // Penonton Belakang
  const backSpectators = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => ({
        idx: i,
        width: 30 + ((i * 7) % 8),
        shirt: CROWD_SHIRTS[i % CROWD_SHIRTS.length],
        skin: CROWD_SKINS[(i * 3) % CROWD_SKINS.length],
        hair: CROWD_HAIRS[(i * 5) % CROWD_HAIRS.length],
        hasFlag: i % 4 === 0,
      })),
    []
  );

  // Penonton Samping Kiri & Kanan
  const leftSpectators = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        idx: i,
        width: 44 + i * 4,
        shirt: CROWD_SHIRTS[(i * 2) % CROWD_SHIRTS.length],
        skin: CROWD_SKINS[i % CROWD_SKINS.length],
        hair: CROWD_HAIRS[i % CROWD_HAIRS.length],
        hasFlag: i % 2 === 0,
      })),
    []
  );

  const rightSpectators = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        idx: i,
        width: 44 + i * 4,
        shirt: CROWD_SHIRTS[(i * 3 + 1) % CROWD_SHIRTS.length],
        skin: CROWD_SKINS[(i + 1) % CROWD_SKINS.length],
        hair: CROWD_HAIRS[(i + 2) % CROWD_HAIRS.length],
        hasFlag: i % 2 === 1,
      })),
    []
  );

  const buntTop = useMemo(() => Array.from({ length: 46 }, (_, i) => i), []);
  const buntBot = useMemo(() => Array.from({ length: 46 }, (_, i) => i), []);

  // Hitung lebar kerupuk otomatis agar pas dengan jumlah tim (2 s.d. 4)
  const laneCount = Math.max(1, lanes.length);
  const defaultKw =
    laneCount <= 2 ? 66 : laneCount === 3 ? 58 : 50;
  const kw = kerupukWidth || defaultKw;

  // Tanggapi aksi real-time (bite / miss / win)
  useEffect(() => {
    if (!actionPulse) return;
    const { laneIdx, type, lucky, text } = actionPulse;

    if (type === 'bite') {
      // 1. Karakter meloncat siap menggigit
      setLaneClasses((prev) => ({
        ...prev,
        [laneIdx]: { ch: 'lunge open', pend: '' },
      }));

      const t1 = setTimeout(() => {
        // 2. Karakter mengunyah + kerupuk bergoyang
        setLaneClasses((prev) => ({
          ...prev,
          [laneIdx]: { ch: 'chew', pend: 'jig' },
        }));

        // Munculkan remah-remah kerupuk berhamburan
        const newCrumbs = Array.from({ length: 9 }, (_, k) => ({
          id: `${actionPulse.id}-cr-${k}`,
          laneIdx,
          left: 40 + Math.random() * 20,
          dx: Math.random() * 70 - 35,
          dy: 40 + Math.random() * 50,
        }));
        setCrumbs((prev) => [...prev, ...newCrumbs]);
        setTimeout(() => {
          setCrumbs((prev) => prev.filter((c) => !newCrumbs.some((nc) => nc.id === c.id)));
        }, 900);

        // Gelembung ucap "Nyam!" / "Gigitan jumbo!"
        const bubbleText =
          text || (lucky ? 'Gigitan jumbo!' : SAY_NYAM[Math.floor(Math.random() * SAY_NYAM.length)]);
        const bubbleId = `${actionPulse.id}-say`;
        setBubbles((prev) => [...prev, { id: bubbleId, laneIdx, text: bubbleText, tone: 'g' }]);
        setTimeout(() => {
          setBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
        }, 1250);
      }, 230);

      const t2 = setTimeout(() => {
        setLaneClasses((prev) => ({
          ...prev,
          [laneIdx]: { ch: '', pend: '' },
        }));
      }, 1050);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else if (type === 'miss') {
      // Kerupuk berayun kencang tertiup angin
      setLaneClasses((prev) => ({
        ...prev,
        [laneIdx]: { ch: 'lunge open', pend: 'blow' },
      }));

      // Hembusan garis angin putih & daun melayang
      const newWinds = Array.from({ length: 4 }, (_, k) => ({
        id: `${actionPulse.id}-wd-${k}`,
        laneIdx,
        top: 10 + k * 26,
        width: 50 + k * 14,
      }));
      const newLeaves = Array.from({ length: 3 }, (_, k) => ({
        id: `${actionPulse.id}-lf-${k}`,
        laneIdx,
        top: 20 + k * 22,
        delay: 0.1 + k * 0.15,
      }));
      setWinds((prev) => [...prev, ...newWinds]);
      setLeaves((prev) => [...prev, ...newLeaves]);
      setIsGusting(true);

      const tGust = setTimeout(() => setIsGusting(false), 1400);
      const tW = setTimeout(() => {
        setWinds((prev) => prev.filter((w) => !newWinds.some((nw) => nw.id === w.id)));
        setLeaves((prev) => prev.filter((l) => !newLeaves.some((nl) => nl.id === l.id)));
      }, 1400);

      const t1 = setTimeout(() => {
        setLaneClasses((prev) => ({
          ...prev,
          [laneIdx]: { ch: 'oops', pend: 'blow' },
        }));
      }, 340);

      const t2 = setTimeout(() => {
        setLaneClasses((prev) => ({
          ...prev,
          [laneIdx]: { ch: '', pend: '' },
        }));
      }, 1500);

      // Gelembung "Meleset!"
      const bubbleId = `${actionPulse.id}-say-b`;
      setBubbles((prev) => [
        ...prev,
        { id: bubbleId, laneIdx, text: text || 'Meleset!', tone: 'b' },
      ]);
      const tB = setTimeout(() => {
        setBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
      }, 1250);

      return () => {
        clearTimeout(tGust);
        clearTimeout(tW);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(tB);
      };
    } else if (type === 'win') {
      // Kemenangan kerupuk ludes
      setLaneClasses((prev) => ({
        ...prev,
        [laneIdx]: { ch: 'win', pend: '' },
      }));

      const bubbleId = `${actionPulse.id}-say-win`;
      setBubbles((prev) => [
        ...prev,
        { id: bubbleId, laneIdx, text: text || 'LUDES!', tone: 'g' },
      ]);

      // Hujan konfeti merah putih
      const newConfetti = Array.from({ length: 46 }, (_, i) => ({
        id: `${actionPulse.id}-cft-${i}`,
        left: Math.random() * 100,
        color: i % 2 === 0 ? '#e2312d' : '#ffffff',
        duration: 2.2 + Math.random() * 2,
        delay: Math.random() * 1.2,
      }));
      setConfettiList(newConfetti);
      const tCft = setTimeout(() => setConfettiList([]), 6000);

      return () => {
        clearTimeout(tCft);
      };
    }
  }, [actionPulse]);

  return (
    <section
      ref={stageRef}
      className={`kp-stage ${isPaused ? 'paused' : ''} ${isGusting ? 'gust' : ''}`}
      style={
        {
          ['--kw' as any]: `${kw}px`,
        } as React.CSSProperties
      }
    >
      {/* Top Floating HUD */}
      <header className="kp-top">
        {onBack && (
          <button type="button" onClick={onBack} className="kp-ib" title={backLabel}>
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{backLabel}</span>
          </button>
        )}

        <div>
          <small>{subtitle || 'MAKAN KERUPUK • FESTIVAL 17 AGUSTUS'}</small>
          <h1>{title}</h1>
        </div>

        {targetText && <span className="kp-chip gold">{targetText}</span>}

        <span
          className={`kp-chip ${
            statusTone === 'live' ? 'live' : statusTone === 'done' ? 'gold' : ''
          }`}
        >
          {statusLabel}
        </span>

        {timerText && (
          <div className="kp-tmr" title="Waktu Lomba">
            {timerText}
          </div>
        )}

        <div className="kp-sp" />

        {onTogglePause && (
          <button type="button" onClick={onTogglePause} className="kp-ib">
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span className="hidden sm:inline">{isPaused ? 'Lanjut' : 'Jeda'}</span>
          </button>
        )}

        {onStop && (
          <button type="button" onClick={onStop} className="kp-ib danger">
            <StopCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{stopLabel}</span>
          </button>
        )}

        {onToggleMute && (
          <button
            type="button"
            onClick={onToggleMute}
            className="kp-ib"
            title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
            aria-label={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isMuted ? 'Mati' : 'Nyala'}</span>
          </button>
        )}
      </header>

      {/* Matahari & Awan Bergerak */}
      <div className="kp-sun" />
      <div className="kp-cloud" style={{ width: 110, top: 150, left: '30%' }} />
      <div
        className="kp-cloud"
        style={{ width: 90, top: 176, left: '64%', animationDuration: '100s' }}
      />

      {/* Pemandangan Kota/Desa 17 Agustus SVG */}
      <svg className="kp-sky" height="150" aria-hidden="true">
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

      {/* Penonton Belakang & Samping */}
      <div className={`kp-crowds ${crowdCheer ? 'cheer' : ''}`} aria-hidden="true">
        <div className="kp-crowd back">
          {backSpectators.map((sp) => (
            <SpectatorPerson
              key={sp.idx}
              width={sp.width}
              shirt={sp.shirt}
              skin={sp.skin}
              hair={sp.hair}
              hasFlag={sp.hasFlag}
              idx={sp.idx}
            />
          ))}
        </div>
        <div className="kp-crowd side-l">
          {leftSpectators.map((sp) => (
            <div key={`l-${sp.idx}`} style={{ marginBottom: 4 }}>
              <SpectatorPerson
                width={sp.width}
                shirt={sp.shirt}
                skin={sp.skin}
                hair={sp.hair}
                hasFlag={sp.hasFlag}
                idx={sp.idx}
              />
            </div>
          ))}
        </div>
        <div className="kp-crowd side-r">
          {rightSpectators.map((sp) => (
            <div key={`r-${sp.idx}`} style={{ marginBottom: 4 }}>
              <SpectatorPerson
                width={sp.width}
                shirt={sp.shirt}
                skin={sp.skin}
                hair={sp.hair}
                hasFlag={sp.hasFlag}
                idx={sp.idx}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Pagar Kayu */}
      <div className="kp-fence" />

      {/* Rumbai Bendera Bawah & Tiang Bendera Kiri-Kanan */}
      <div className="kp-bunt bb" aria-hidden="true">
        {buntBot.map((i) => (
          <i key={i} />
        ))}
      </div>
      <div className="kp-pole l2" aria-hidden="true">
        <i />
      </div>
      <div className="kp-pole r2" aria-hidden="true">
        <i />
      </div>

      {/* Rumbai Atas & Spanduk Dirgahayu */}
      <div className="kp-bunt bt" aria-hidden="true">
        {buntTop.map((i) => (
          <i key={i} />
        ))}
      </div>
      <div className="kp-ban">DIRGAHAYU REPUBLIK INDONESIA KE-81</div>

      {/* Alas Rumput & Tanah Cokelat */}
      <div className="kp-gnd" />

      {/* Palang Kayu Gantungan Kerupuk */}
      <div className="kp-rw">
        <div className="kp-post" style={{ left: 0 }} />
        <div className="kp-post" style={{ right: 0 }} />
        <div className="kp-bar">
          <i style={{ left: 6 }} />
          <i style={{ left: 30, borderTopColor: '#ffffff' }} />
          <i style={{ right: 6 }} />
          <i style={{ right: 30, borderTopColor: '#ffffff' }} />
        </div>

        {/* Lintasan Peserta Lomba */}
        <div className="flex gap-4 sm:gap-6 items-start justify-center">
          {lanes.map((lane, idx) => {
            const laneMaskId = `kp-mk-${reactId}-${idx}`;
            const cls = laneClasses[idx] || { ch: '', pend: '' };
            const isWinner = Boolean(lane.isWinner || (cls.ch && cls.ch.includes('win')));

            return (
              <div
                key={lane.id}
                className="kp-ct"
                style={
                  {
                    ['--fr' as any]: Math.max(0, Math.min(1, lane.eatenFraction)),
                    ['--d' as any]: idx,
                  } as React.CSSProperties
                }
              >
                {/* Gelembung Ucap */}
                {bubbles
                  .filter((b) => b.laneIdx === idx)
                  .map((b) => (
                    <span key={b.id} className={`kp-say ${b.tone}`}>
                      {b.text}
                    </span>
                  ))}

                {/* Hembusan Angin & Daun Melayang saat meleset */}
                {winds
                  .filter((w) => w.laneIdx === idx)
                  .map((w) => (
                    <i
                      key={w.id}
                      className="kp-wd"
                      style={{ top: `${w.top}%`, width: `${w.width}px` }}
                    />
                  ))}
                {leaves
                  .filter((l) => l.laneIdx === idx)
                  .map((l) => (
                    <i
                      key={l.id}
                      className="kp-lf"
                      style={{ top: `${l.top}%`, animationDelay: `${l.delay}s` }}
                    />
                  ))}

                {/* Remah-remah Kerupuk Berhamburan */}
                {crumbs
                  .filter((c) => c.laneIdx === idx)
                  .map((c) => (
                    <i
                      key={c.id}
                      className="kp-cr"
                      style={
                        {
                          left: `${c.left}%`,
                          ['--dx' as any]: `${c.dx}px`,
                          ['--dy' as any]: `${c.dy}px`,
                        } as React.CSSProperties
                      }
                    />
                  ))}

                {/* Tali & Kerupuk Tergantung */}
                <div className={`kp-pend ${cls.pend}`}>
                  <div className="kp-str" />
                  <HangingKerupukSvg
                    maskId={laneMaskId}
                    eatenFraction={lane.eatenFraction}
                  />
                </div>

                {/* Karakter Atletik di Bawah Kerupuk */}
                <div className={`kp-ch ${cls.ch} ${isWinner ? 'win' : ''}`}>
                  <ContestantCharSvg
                    shirtColor={lane.warna}
                    index={idx}
                  />
                </div>

                {/* Label Nama Peserta / Tim */}
                <div className="kp-nm">
                  <b>{lane.nama}</b>
                  {lane.subText && <small>{lane.subText}</small>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Konfeti Kemenangan */}
      {confettiList.map((cf) => (
        <i
          key={cf.id}
          className="kp-cft"
          style={{
            left: `${cf.left}%`,
            background: cf.color,
            border: '1px solid #e2312d',
            animationDuration: `${cf.duration}s`,
            animationDelay: `${cf.delay}s`,
          }}
        />
      ))}
    </section>
  );
}

/* ============================================================================
   KOMPONEN HEATMAP ANALISIS PER-SOAL X PER-SISWA (MULTIPLAYER & RIWAYAT)
   ============================================================================ */

export interface HeatmapQuestionInfoKerupuk {
  questionId: string;
  nomorSoal: number;
  teks: string;
  opsiList: Array<{ key: string; teks: string }>;
  jawabanBenarKode: string;
  jawabanBenarTeks: string;
  penjelasan: string | null;
  firstCorrectCount: number;
  firstSeenCount: number;
  persenBenar: number | null;
}

export interface HeatmapCellKerupuk {
  questionId: string;
  ok: boolean | null;
  jawabanKey: string | null;
  jawabanTeks: string | null;
  timedOut: boolean;
  percobaanCount: number;
}

export interface HeatmapTeamGroupKerupuk {
  timId: string;
  namaTim: string;
  warna: string;
  rows: Array<{
    pesertaId: string;
    nama: string;
    benarPertamaCount: number;
    dilihatCount: number;
    cells: HeatmapCellKerupuk[];
  }>;
}

export interface AnalisisHeatmapKerupukData {
  questions: HeatmapQuestionInfoKerupuk[];
  teams: HeatmapTeamGroupKerupuk[];
  hardestQuestionId: string | null;
  defaultQuestionId: string | null;
}

export function KerupukHeatmapMatrix({
  heatmap,
}: {
  heatmap: AnalisisHeatmapKerupukData;
}) {
  const [selectedQId, setSelectedQId] = useState<string>(
    heatmap.defaultQuestionId || heatmap.questions[0]?.questionId || ''
  );

  useEffect(() => {
    setSelectedQId(heatmap.defaultQuestionId || heatmap.questions[0]?.questionId || '');
  }, [heatmap.defaultQuestionId, heatmap.questions]);

  const selectedQ =
    heatmap.questions.find((q) => q.questionId === selectedQId) || heatmap.questions[0];
  const selectedIdx = heatmap.questions.findIndex((q) => q.questionId === selectedQ?.questionId);

  if (!heatmap.questions || heatmap.questions.length === 0) {
    return null;
  }

  const isHardest = Boolean(
    heatmap.hardestQuestionId && selectedQ && selectedQ.questionId === heatmap.hardestQuestionId
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xl font-extrabold text-[#0f3d2e]">
            Analisis Soal &amp; Jawaban Siswa
          </h3>
          <p className="text-xs font-bold text-[#6d7a6f]">
            Klik nomor soal atau sel ✓ / ✗ untuk melihat rincian jawaban pertama setiap siswa.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold text-[#6d7a6f]">
          <span className="inline-flex items-center gap-1">
            <span className="kp-cell ok !w-5 !h-5 !text-[11px] inline-flex items-center justify-center">
              ✓
            </span>{' '}
            Benar
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="kp-cell no !w-5 !h-5 !text-[11px] inline-flex items-center justify-center">
              ✗
            </span>{' '}
            Salah
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="kp-cell na !w-5 !h-5 !text-[11px] inline-flex items-center justify-center">
              ·
            </span>{' '}
            Belum muncul
          </span>
        </div>
      </div>

      {/* Tabel Matriks Heatmap */}
      <div className="kp-hm-wrap">
        <table className="kp-hm">
          <thead>
            <tr>
              <th className="nm">Nama Siswa</th>
              {heatmap.questions.map((q, idx) => (
                <th key={q.questionId}>
                  <button
                    type="button"
                    onClick={() => setSelectedQId(q.questionId)}
                    className={`kp-qbtn ${q.questionId === selectedQ?.questionId ? 'on' : ''}`}
                    title={`Soal ${idx + 1}: ${q.teks}`}
                  >
                    {idx + 1}
                  </button>
                </th>
              ))}
              <th className="kp-sum">Benar</th>
            </tr>
          </thead>

          <tbody>
            {heatmap.teams.map((grp) => (
              <React.Fragment key={grp.timId}>
                <tr className="kp-band">
                  <th colSpan={heatmap.questions.length + 2}>
                    <span style={{ background: grp.warna }}>{grp.namaTim}</span>
                  </th>
                </tr>
                {grp.rows.length === 0 ? (
                  <tr>
                    <td colSpan={heatmap.questions.length + 2} className="text-xs italic text-[#6d7a6f] py-2">
                      Belum ada siswa di tim ini
                    </td>
                  </tr>
                ) : (
                  grp.rows.map((row) => (
                    <tr key={row.pesertaId}>
                      <td className="nm">{row.nama}</td>
                      {row.cells.map((cell) => (
                        <td key={cell.questionId}>
                          <button
                            type="button"
                            onClick={() => setSelectedQId(cell.questionId)}
                            className={`kp-cell ${
                              cell.ok === true ? 'ok' : cell.ok === false ? 'no' : 'na'
                            }`}
                            title={`${row.nama}, Soal: ${
                              cell.ok === true ? 'Benar' : cell.ok === false ? 'Salah' : 'Belum Dijawab'
                            }`}
                          >
                            {cell.ok === true ? '✓' : cell.ok === false ? '✗' : '·'}
                          </button>
                        </td>
                      ))}
                      <td className="kp-sum">
                        {row.benarPertamaCount}/{row.dilihatCount}
                      </td>
                    </tr>
                  ))
                )}
              </React.Fragment>
            ))}
          </tbody>

          <tfoot>
            <tr className="kp-foot">
              <th className="nm">% Benar</th>
              {heatmap.questions.map((q) => (
                <td key={q.questionId}>
                  {q.persenBenar === null ? '–' : `${q.persenBenar}%`}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Rincian Soal yang Dipilih (Question Inspector) */}
      {selectedQ && (
        <div className="kp-qd">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4>
              Soal {selectedIdx >= 0 ? selectedIdx + 1 : selectedQ.nomorSoal}
              {isHardest && (
                <span className="ml-2 text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                  • Paling banyak salah
                </span>
              )}
            </h4>
            <div className="text-xs font-bold text-[#6d7a6f]">
              Tingkat Keberhasilan:{' '}
              <strong className="text-[#0f3d2e]">
                {selectedQ.firstCorrectCount} dari {selectedQ.firstSeenCount} siswa (
                {selectedQ.persenBenar === null ? '0%' : `${selectedQ.persenBenar}%`})
              </strong>
            </div>
          </div>

          <p className="mt-1 text-sm font-extrabold text-[#0f3d2e]">{selectedQ.teks}</p>

          {/* Opsi Pilihan Jawaban */}
          <div className="flex flex-wrap gap-2 my-2.5">
            {selectedQ.opsiList.map((o) => {
              const isCorrect = o.key === selectedQ.jawabanBenarKode;
              return (
                <span
                  key={o.key}
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    isCorrect
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-extrabold'
                      : 'bg-white border-[#e6d3ae] text-[#0f3d2e]'
                  }`}
                >
                  {isCorrect ? '✓ ' : ''}
                  <strong>{o.key}.</strong> {o.teks}
                </span>
              );
            })}
          </div>

          {selectedQ.penjelasan && (
            <p className="text-xs text-[#6d7a6f] bg-white p-2.5 rounded-xl border border-[#e6d3ae] mb-3">
              <strong>Penjelasan:</strong> {selectedQ.penjelasan}
            </p>
          )}

          {/* Jawaban Siswa per Tim */}
          <div className="space-y-3 mt-3 pt-3 border-t border-[#e6d3ae]">
            {heatmap.teams.map((grp) => {
              const rowsWithCell = grp.rows
                .map((r) => {
                  const c = r.cells.find((cell) => cell.questionId === selectedQ.questionId);
                  return { row: r, cell: c };
                })
                .filter((item) => item.cell && item.cell.ok !== null);

              if (rowsWithCell.length === 0) return null;

              return (
                <div key={grp.timId} className="space-y-1">
                  <div className="text-xs font-black uppercase tracking-wider" style={{ color: grp.warna }}>
                    {grp.namaTim}
                  </div>
                  <ul className="kp-pl3">
                    {rowsWithCell.map(({ row, cell }) => {
                      if (!cell) return null;
                      const isOk = cell.ok === true;
                      return (
                        <li key={row.pesertaId} className={isOk ? 'ok' : 'no'}>
                          <b>{row.nama}</b>
                          <span>
                            {cell.timedOut
                              ? 'Waktu habis'
                              : cell.jawabanKey
                              ? `Memilih ${cell.jawabanKey}: ${cell.jawabanTeks || ''}`
                              : '–'}
                          </span>
                          <i className={`kp-bd ${isOk ? 'ok' : 'no'}`}>
                            {isOk ? '✓ Benar' : '✗ Salah'}
                          </i>
                          {!isOk && (
                            <em>
                              Koreksi: jawaban yang benar adalah {selectedQ.jawabanBenarKode}.{' '}
                              {selectedQ.jawabanBenarTeks}
                            </em>
                          )}
                          {cell.percobaanCount > 1 && (
                            <small>
                              ↺ muncul {cell.percobaanCount}× (poin dihitung dari jawaban pertama)
                            </small>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
