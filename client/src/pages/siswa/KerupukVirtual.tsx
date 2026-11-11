import { useEffect, useState } from 'react';
import { Pause } from 'lucide-react';

export interface HasilGachaGigitanProps {
  tipe: 'besar' | 'sedang' | 'kecil' | 'sangat_kecil' | 'zonk';
  label: string;
  berkurangPersen: number;
  penguranganEfektifPoin?: number;
  poinGigitan: number;
}

export type MoodKarakterKerupuk =
  | 'idle'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'besar'
  | 'sedang'
  | 'kecil'
  | 'sangat_kecil'
  | 'zonk'
  | 'salah'
  | 'win'
  | 'stopped';

interface KerupukVirtualProps {
  /** Persentase kerupuk tersisa [0..100] */
  sisaKerupuk: number;
  /** Sisa poin target (untuk tampilan Mode Solo berbasis poin) */
  sisaPoin?: number;
  /** Total target poin kerupuk */
  targetPoin?: number;
  terakhirGigitan?: HasilGachaGigitanProps | null;
  namaPemain?: string;
  size?: 'sm' | 'md' | 'lg' | 'projector';
  /** Menampilkan karakter 2D peserta lomba makan kerupuk tepat di bawah tali */
  showCharacter?: boolean;
  /** Mood karakter 2D yang sedang berlangsung */
  mood?: MoodKarakterKerupuk;
  /** ID pemicu setiap jawaban baru agar animasi terpicu ulang */
  reactionNonce?: number;
}

export default function KerupukVirtual({
  sisaKerupuk,
  sisaPoin,
  targetPoin,
  terakhirGigitan,
  namaPemain,
  size = 'md',
  showCharacter = false,
  mood = 'idle',
  reactionNonce = 0,
}: KerupukVirtualProps) {
  const [animasiChomp, setAnimasiChomp] = useState(false);
  const [tampilEfekGigit, setTampilEfekGigit] = useState(false);

  const clampedSisaPersen = Math.max(0, Math.min(100, sisaKerupuk));
  const progresPersen = Math.max(0, Math.min(100, 100 - clampedSisaPersen));

  useEffect(() => {
    if (terakhirGigitan || reactionNonce > 0) {
      setAnimasiChomp(true);
      setTampilEfekGigit(true);
      const t1 = setTimeout(() => setAnimasiChomp(false), 750);
      const t2 = setTimeout(() => setTampilEfekGigit(false), 1850);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [terakhirGigitan, sisaKerupuk, reactionNonce]);

  const dimensi = {
    sm: { w: 120, h: 150 },
    md: { w: 200, h: 240 },
    lg: { w: 260, h: 290 },
    projector: { w: 320, h: 330 },
  }[size];

  // Skala proporsional ukuran kerupuk berdasarkan sisa target [0..100]
  const crackerScale =
    clampedSisaPersen <= 0 ? 0 : Math.max(0.28, 0.28 + (clampedSisaPersen / 100) * 0.72);

  const renderKerupukBody = () => {
    if (clampedSisaPersen <= 0) {
      return (
        <g transform="translate(100, 92)">
          <circle cx="-18" cy="18" r="2.5" fill="#f5e6c4" />
          <circle cx="14" cy="24" r="3" fill="#e5c88a" />
          <circle cx="4" cy="36" r="2" fill="#f5e6c4" />
          <circle cx="-8" cy="28" r="2" fill="#d9b673" />
          <text
            x="0"
            y="8"
            textAnchor="middle"
            fill="#1d3b2e"
            fontSize="11"
            fontWeight="900"
            letterSpacing="0.5"
          >
            HABIS!
          </text>
        </g>
      );
    }

    const baseFill = '#f8e9c7';
    const crustStroke = '#d6b072';

    return (
      <g
        transform={`translate(100, 102) scale(${crackerScale})`}
        filter="url(#shadowKerupuk)"
        className="motion-reduce:transition-none transition-transform duration-500"
      >
        {/* Bentuk kerupuk melingkar berlekuk khas kerupuk kampung */}
        <path
          d={
            clampedSisaPersen > 70
              ? 'M -34 -34 C -15 -45, 15 -45, 34 -34 C 46 -15, 46 15, 34 34 C 15 46, -15 46, -34 34 C -46 15, -46 -15, -34 -34 Z'
              : clampedSisaPersen > 35
              ? 'M -34 -34 C -15 -45, 15 -45, 34 -34 C 37 -12, 22 -4, 30 12 C 18 19, 25 32, 12 36 C -15 44, -36 30, -39 10 C -44 -12, -39 -22, -34 -34 Z'
              : 'M -30 -34 C -12 -44, 15 -43, 28 -30 C 16 -18, 22 -6, 8 4 C 12 16, -8 24, -18 14 C -28 24, -38 8, -33 -12 C -38 -20, -34 -28, -30 -34 Z'
          }
          fill={baseFill}
          stroke={crustStroke}
          strokeWidth="3"
        />

        {/* Pori-pori & ulir kerupuk khas */}
        <path
          d="M -20 -16 Q 0 -26, 18 -14 M -22 2 Q -2 -10, 14 2"
          fill="none"
          stroke="#e4cb96"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {clampedSisaPersen > 45 && (
          <path
            d="M -14 18 Q 2 10, 16 20"
            fill="none"
            stroke="#e4cb96"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
        <circle cx="-14" cy="-6" r="2.2" fill="#e4cb96" />
        <circle cx="8" cy="-8" r="2" fill="#e4cb96" />
        <circle cx="-5" cy="9" r="2.5" fill="#e4cb96" />
      </g>
    );
  };

  const renderKarakter2D = () => {
    if (!showCharacter) return null;

    const isChomping = animasiChomp && ['besar', 'sedang', 'kecil', 'sangat_kecil'].includes(mood);
    const isWin = mood === 'win' || clampedSisaPersen === 0;
    const isZonk = mood === 'zonk';
    const isWrong = mood === 'salah';
    const isPaused = mood === 'paused';

    const bounceY = isChomping ? -16 : isWin ? -10 : isZonk ? 3 : 0;

    return (
      <g
        transform={`translate(100, ${215 + bounceY})`}
        className="motion-reduce:transition-none transition-transform duration-300"
      >
        {/* Bayangan Lantai */}
        <ellipse cx="0" cy="46" rx="44" ry="8" fill="#1d3b2e" opacity="0.14" />

        {/* Badan Baju Merdeka Merah-Putih */}
        <path
          d="M -28 18 C -28 -2, 28 -2, 28 18 L 32 42 L -32 42 Z"
          fill="#c8362f"
          stroke="#1d3b2e"
          strokeWidth="2.5"
        />
        {/* Rompi/Kerapian Kerah Putih */}
        <path d="M -14 4 L 0 18 L 14 4 Z" fill="#fcf8ed" stroke="#1d3b2e" strokeWidth="1.5" />

        {/* Tangan (Aturan lomba: tangan di belakang punggung, KECUALI saat menang mengangkat piala/sorak) */}
        {isWin ? (
          <>
            <path
              d="M -28 14 Q -46 -8, -42 -26"
              fill="none"
              stroke="#f1c29b"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M 28 14 Q 46 -8, 42 -26"
              fill="none"
              stroke="#f1c29b"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <circle cx="-42" cy="-28" r="5" fill="#f1c29b" stroke="#1d3b2e" strokeWidth="1.5" />
            <circle cx="42" cy="-28" r="5" fill="#f1c29b" stroke="#1d3b2e" strokeWidth="1.5" />
          </>
        ) : (
          <>
            <path
              d="M -28 16 Q -34 28, -24 36"
              fill="none"
              stroke="#f1c29b"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M 28 16 Q 34 28, 24 36"
              fill="none"
              stroke="#f1c29b"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Kepala Karakter */}
        <circle cx="0" cy="-22" r="28" fill="#f5c9a6" stroke="#1d3b2e" strokeWidth="2.5" />

        {/* Telinga */}
        <circle cx="-28" cy="-22" r="5.5" fill="#f1c29b" stroke="#1d3b2e" strokeWidth="2" />
        <circle cx="28" cy="-22" r="5.5" fill="#f1c29b" stroke="#1d3b2e" strokeWidth="2" />

        {/* Rambut & Ikat Kepala Merah Putih 17-an */}
        <path
          d="M -27 -28 C -26 -54, 26 -54, 27 -28 Z"
          fill="#26292e"
          stroke="#1d3b2e"
          strokeWidth="2"
        />
        <rect
          x="-27"
          y="-34"
          width="54"
          height="6"
          rx="2"
          fill="#c8362f"
          stroke="#1d3b2e"
          strokeWidth="1.5"
        />
        <rect x="-27" y="-28" width="54" height="4" fill="#ffffff" stroke="#1d3b2e" strokeWidth="1.5" />

        {/* Rona Pipi */}
        <circle cx="-16" cy="-14" r="4" fill="#ef6b63" opacity="0.45" />
        <circle cx="16" cy="-14" r="4" fill="#ef6b63" opacity="0.45" />

        {/* Mata */}
        {isPaused ? (
          <>
            <path d="M -14 -20 L -6 -20" stroke="#1d3b2e" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 6 -20 L 14 -20" stroke="#1d3b2e" strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : isZonk || isWrong ? (
          <>
            <path
              d="M -14 -24 L -7 -17 M -7 -24 L -14 -17"
              stroke="#1d3b2e"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
            <path
              d="M 7 -24 L 14 -17 M 14 -24 L 7 -17"
              stroke="#1d3b2e"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
          </>
        ) : mood === 'besar' || isWin ? (
          <>
            <path
              d="M -15 -18 Q -10 -26, -5 -18"
              fill="none"
              stroke="#1d3b2e"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M 5 -18 Q 10 -26, 15 -18"
              fill="none"
              stroke="#1d3b2e"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <circle cx="-10" cy="-21" r="3.2" fill="#1d3b2e" />
            <circle cx="10" cy="-21" r="3.2" fill="#1d3b2e" />
            <circle cx="-9" cy="-22" r="1.1" fill="#ffffff" />
            <circle cx="11" cy="-22" r="1.1" fill="#ffffff" />
          </>
        )}

        {/* Mulut & Reaksi */}
        {isWin ? (
          <path
            d="M -10 -10 Q 0 2, 10 -10 Z"
            fill="#9e1b18"
            stroke="#1d3b2e"
            strokeWidth="2"
          />
        ) : isWrong || isZonk ? (
          <path
            d="M -9 -6 Q 0 -13, 9 -6"
            fill="none"
            stroke="#1d3b2e"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ) : mood === 'besar' ? (
          <ellipse cx="0" cy="-9" rx="10" ry="8" fill="#881313" stroke="#1d3b2e" strokeWidth="2" />
        ) : mood === 'sedang' || isChomping ? (
          <ellipse cx="0" cy="-10" rx="7" ry="6" fill="#881313" stroke="#1d3b2e" strokeWidth="2" />
        ) : (
          <ellipse cx="0" cy="-10" rx="4.5" ry="3.5" fill="#9e2a2b" stroke="#1d3b2e" strokeWidth="1.8" />
        )}

        {/* Keringat / Efek Angin Zonk */}
        {isWrong && (
          <path
            d="M 21 -30 Q 25 -22, 21 -18 Q 17 -22, 21 -30 Z"
            fill="#60a5fa"
            stroke="#1d4ed8"
            strokeWidth="1"
          />
        )}
        {isZonk && (
          <path
            d="M 28 -14 Q 40 -18, 36 -8 Q 44 -6, 32 -2"
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </g>
    );
  };

  return (
    <div className="flex flex-col items-center select-none relative w-full">
      {/* Wadah Visual Kerupuk + Karakter 2D */}
      <div
        className={`relative motion-reduce:transition-none transition-transform duration-300 ${
          animasiChomp ? 'scale-[1.03]' : ''
        }`}
        style={{
          width: dimensi.w,
          height: showCharacter ? dimensi.h + 45 : dimensi.h,
        }}
      >
        <svg
          viewBox={showCharacter ? '0 0 200 285' : '0 0 200 220'}
          className="w-full h-full drop-shadow-md overflow-visible"
        >
          <defs>
            <filter id="shadowKerupuk" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* Galah Bambu Atas Lomba */}
          <rect x="8" y="4" width="184" height="8" rx="4" fill="#b48a4e" stroke="#6b4f23" strokeWidth="1.5" />
          {/* Bendera hias kecil Merah-Putih */}
          <polygon points="18,12 32,12 25,22" fill="#c8362f" />
          <polygon points="36,12 50,12 43,22" fill="#ffffff" stroke="#e0d5b8" strokeWidth="0.6" />
          <polygon points="150,12 164,12 157,22" fill="#ffffff" stroke="#e0d5b8" strokeWidth="0.6" />
          <polygon points="168,12 182,12 175,22" fill="#c8362f" />

          {/* Tali Rafia Penggantung */}
          <line
            x1="100"
            y1="12"
            x2="100"
            y2={showCharacter ? 76 : 75}
            stroke="#c8362f"
            strokeWidth="3.2"
            strokeDasharray="5 2"
          />

          {/* Simpul Ikatan Tali */}
          <ellipse cx="100" cy="74" rx="5.5" ry="3.5" fill="#9c221b" />
          <path d="M 96 73 Q 100 80, 104 73" fill="none" stroke="#9c221b" strokeWidth="2" />

          {/* Badan Kerupuk Virtual */}
          {renderKerupukBody()}

          {/* Karakter 2D Lomba Makan Kerupuk */}
          {renderKarakter2D()}

          {/* Efek Partikel Remahan Saat Menggigit */}
          {animasiChomp && clampedSisaPersen > 0 && mood !== 'zonk' && mood !== 'salah' && (
            <g opacity="0.85">
              <circle cx="128" cy="108" r="3" fill="#f7ecd5" />
              <circle cx="72" cy="116" r="2.8" fill="#dfcaa5" />
              <circle cx="136" cy="126" r="2.5" fill="#f7ecd5" />
              <circle cx="65" cy="132" r="2.2" fill="#e5c88a" />
            </g>
          )}
        </svg>

        {/* Floating Bubble Hasil Gigitan */}
        {tampilEfekGigit && terakhirGigitan && (
          <div
            className={`absolute top-8 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-black shadow-lg motion-reduce:animate-none animate-bounce pointer-events-none whitespace-nowrap z-20 flex items-center gap-1.5 ${
              terakhirGigitan.tipe === 'zonk'
                ? 'bg-red-600 text-white'
                : terakhirGigitan.tipe === 'besar'
                ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-300'
                : 'bg-emerald-600 text-white'
            }`}
          >
            <span>{terakhirGigitan.label}</span>
            <span className="font-mono">
              {typeof terakhirGigitan.penguranganEfektifPoin === 'number'
                ? `(-${terakhirGigitan.penguranganEfektifPoin} pt)`
                : `(-${terakhirGigitan.berkurangPersen}%)`}
            </span>
          </div>
        )}

        {/* Badge Status Pause di atas Arena */}
        {mood === 'paused' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-extrabold px-3 py-1 rounded-full shadow flex items-center gap-1.5 whitespace-nowrap">
            <Pause className="w-3.5 h-3.5" /> Dijeda
          </div>
        )}
      </div>

      {/* Indikator Status & Sisa Kerupuk */}
      <div className="mt-2 text-center w-full max-w-[260px]">
        {namaPemain && (
          <p className="font-bold text-xs text-[#1d3b2e] truncate mb-1">{namaPemain}</p>
        )}

        {/* Progress Bar Progres Memakan Kerupuk */}
        <div className="bg-[#e0d5b8] h-3 rounded-full overflow-hidden p-0.5 border border-[#d2c4a3]">
          <div
            className={`h-full rounded-full motion-reduce:transition-none transition-all duration-500 ${
              clampedSisaPersen === 0
                ? 'bg-emerald-500'
                : clampedSisaPersen <= 25
                ? 'bg-red-500'
                : clampedSisaPersen <= 50
                ? 'bg-amber-500'
                : 'bg-[#1d3b2e]'
            }`}
            style={{ width: `${progresPersen}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-xs font-bold mt-1.5 text-[#1d3b2e]">
          <span>
            {typeof sisaPoin === 'number' && typeof targetPoin === 'number'
              ? `Sisa: ${sisaPoin} / ${targetPoin} pt`
              : 'Kerupuk Tersisa'}
          </span>
          <span
            className={`font-mono ${
              clampedSisaPersen === 0
                ? 'text-emerald-700 font-black'
                : clampedSisaPersen <= 25
                ? 'text-red-600'
                : 'text-[#1d3b2e]'
            }`}
          >
            {clampedSisaPersen === 0 ? 'LUDES 100%!' : `Dimakan ${progresPersen}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
