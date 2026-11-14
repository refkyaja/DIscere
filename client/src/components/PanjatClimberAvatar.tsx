import './balapKarungFestival.css';

export interface ClimberLook {
  skin?: string;
  hair?: string;
  hs?: number; // 0..6
  tp?: 'none' | 'tee' | 'stripe' | 'jersey';
  tc?: string;
  sh?: string;
  bulk?: boolean;
  camo?: boolean;
  hj?: string;
}

export interface PanjatClimberAvatarProps {
  look?: ClimberLook;
  state?: 'idle' | 'cl' | 'mv' | 'sl' | 'win';
  width?: number | string;
  height?: number | string;
  className?: string;
}

/**
 * Karakter Pemanjat Pinang 2D persis sesuai referensi panjat-pinang-solo.html dan panjat-pinang-multiplayer.html.
 * Menampilkan figur atletis berikat kepala Merah-Putih dengan pose memanjat tiang (merangkul tiang,
 * bergerak naik, tergelincir, jatuh, atau bersorak di puncak).
 */
export function PanjatClimberAvatar({
  look = {},
  state = 'cl',
  width = 72,
  height = 110,
  className = '',
}: PanjatClimberAvatarProps) {
  const sk = look.skin || '#d9a066';
  const hr = look.hair || '#241a14';
  const hs = look.hs ?? 0;
  const tp = look.tp || 'none';
  const tc = tp === 'none' ? sk : look.tc || '#e2312d';
  const sh = look.sh || '#e2312d';
  const bulk = look.bulk ?? true;
  const k = '#2b2a4a';

  const TP = bulk
    ? 'M27 56Q50 44 73 56L65 100L35 100Z'
    : 'M33 54Q50 47 67 54L64 100L36 100Z';
  const AW = bulk ? 15 : 10;
  const LW = bulk ? 14 : 11;

  // Ikat kepala Merah Putih
  const band = (
    <>
      <path
        d="M34 26Q50 17 66 26L66 31Q50 22 34 31Z"
        fill="#fff"
        stroke={k}
        strokeWidth="1.8"
      />
      <path
        d="M34 26Q50 17 66 26L66 28.5Q50 20 34 28.5Z"
        fill="#e2312d"
      />
    </>
  );

  const frontHair = () => {
    switch (hs) {
      case 2:
        return (
          <>
            {[38, 45, 52, 59, 64].map((x, j) => (
              <circle
                key={j}
                cx={x}
                cy={[20, 13, 11, 13, 20][j]}
                r="6.5"
                fill={hr}
              />
            ))}
            {band}
          </>
        );
      case 3:
        return (
          <>
            <path
              d="M35 24L33 12L41 16L45 6L51 14L58 6L60 16L67 12L65 24Q50 16 35 24Z"
              fill={hr}
            />
            {band}
          </>
        );
      case 5:
        return (
          <>
            <path
              d="M35 25Q36 7 50 7Q64 7 65 25Z"
              fill="#e2312d"
              stroke={k}
              strokeWidth="1.8"
            />
            <path d="M58 22h16" stroke={k} strokeWidth="5" strokeLinecap="round" />
            <path d="M58 22h16" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
          </>
        );
      default:
        return (
          <>
            <path d="M35 24Q38 9 50 9Q62 9 65 24Q50 16 35 24Z" fill={hr} />
            {band}
          </>
        );
    }
  };

  const deco = () => {
    if (tp === 'none') {
      return (
        <path
          d={`M42 64Q50 70 58 64M50 73V90${
            bulk ? 'M37 62Q43 71 50 66Q57 71 63 62M43 80H57M44 88H56' : ''
          }`}
          stroke="rgba(0,0,0,.28)"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      );
    }
    if (tp === 'stripe') {
      return (
        <>
          <path d="M34.5 66H65.5M35.5 77H64.5" stroke="#fff" strokeWidth="4" opacity="0.92" />
        </>
      );
    }
    if (tp === 'jersey') {
      return (
        <path
          d="M50 62l3 6 6.5.8-4.8 4.5 1.3 6.4-6-3.3-6 3.3 1.3-6.4-4.8-4.5 6.5-.8z"
          fill="#fff"
          opacity="0.92"
        />
      );
    }
    return <path d="M44 52L50 61L56 52" fill="#fff" stroke={k} strokeWidth="1.4" />;
  };

  const sleeve = (x1: number, y1: number, x2: number, y2: number) => {
    if (tp === 'none') return null;
    return (
      <path
        d={`M${x1} ${y1}L${x2} ${y2}`}
        stroke={tc}
        strokeWidth="13"
        strokeLinecap="round"
      />
    );
  };

  return (
    <div
      className={`panjat-mb ${state} relative select-none inline-block ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      <svg
        className="panjat-pp w-full h-full overflow-visible"
        viewBox="0 0 100 160"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <ellipse cx="50" cy="157" rx="28" ry="4" fill="rgba(0,0,0,.25)" />

        {/* Kaki Kiri */}
        <g className="lL">
          <path
            d="M42 106L40 130L41 150"
            stroke={sk}
            strokeWidth={LW}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <ellipse cx="41" cy="153" rx="8.5" ry="4.2" fill={sk} />
          <ellipse cx="41" cy="155" rx="8.5" ry="3" fill="#6b4a2a" opacity="0.65" />
          <circle cx="40" cy="138" r="3.2" fill="#5a3a22" opacity="0.5" />
        </g>

        {/* Kaki Kanan */}
        <g className="lR">
          <path
            d="M58 106L60 130L59 150"
            stroke={sk}
            strokeWidth={LW}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <ellipse cx="59" cy="153" rx="8.5" ry="4.2" fill={sk} />
          <ellipse cx="59" cy="155" rx="8.5" ry="3" fill="#6b4a2a" opacity="0.65" />
          <circle cx="61" cy="132" r="3" fill="#5a3a22" opacity="0.45" />
        </g>

        {/* Badan / Otot Dada & Perut */}
        <path d={TP} fill={tc} stroke={k} strokeWidth="2.5" strokeLinejoin="round" />
        {deco()}

        {/* Celana Pendek */}
        <path
          d="M34 96L66 96L68 120L52 120L50 112L48 120L32 120Z"
          fill={sh}
          stroke={k}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Otot Bahu Deltoid Atletis */}
        {bulk && (
          <>
            <circle cx="30" cy="61" r="9" fill={sk} />
            <circle cx="70" cy="61" r="9" fill={sk} />
          </>
        )}

        {/* Lengan Kiri */}
        <g className="aL">
          <path
            d="M35 56L24 80L30 98"
            stroke={sk}
            strokeWidth={AW}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {sleeve(35, 56, 30, 67)}
          <circle cx="30" cy="100" r="5.5" fill={sk} />
        </g>

        {/* Lengan Kanan */}
        <g className="aR">
          <path
            d="M65 56L76 80L70 98"
            stroke={sk}
            strokeWidth={AW}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {sleeve(65, 56, 70, 67)}
          <circle cx="70" cy="100" r="5.5" fill={sk} />
        </g>

        {/* Kepala & Wajah */}
        <g className="hd">
          <circle cx="35" cy="31" r="4" fill={sk} />
          <circle cx="65" cy="31" r="4" fill={sk} />
          <circle cx="50" cy="30" r="15.5" fill={sk} stroke={k} strokeWidth="2.8" />
          {frontHair()}

          {/* Alis Mata */}
          <path
            d="M39.5 24.2Q43 22.3 47 23.8M60.5 24.2Q57 22.3 53 23.8"
            stroke={k}
            strokeWidth="1.9"
            fill="none"
            strokeLinecap="round"
          />

          {/* Mata Kartun Berbinar */}
          <ellipse cx="44" cy="30" rx="3.3" ry="3.9" fill="#fff" stroke={k} strokeWidth="1" />
          <circle cx="44.8" cy="30.4" r="2" fill={k} />
          <circle cx="45.5" cy="29.5" r="0.75" fill="#fff" />

          <ellipse cx="56" cy="30" rx="3.3" ry="3.9" fill="#fff" stroke={k} strokeWidth="1" />
          <circle cx="56.8" cy="30.4" r="2" fill={k} />
          <circle cx="57.5" cy="29.5" r="0.75" fill="#fff" />

          {/* Pipi Merona Merah */}
          <circle cx="39" cy="36" r="2.6" fill="#ff8a8a" opacity="0.5" />
          <circle cx="61" cy="36" r="2.6" fill="#ff8a8a" opacity="0.5" />

          {/* Mulut: Netral */}
          <path
            className="fm0"
            d="M44 37Q50 42 56 37"
            stroke={k}
            strokeWidth="2.3"
            fill="none"
            strokeLinecap="round"
          />

          {/* Mulut: Senyum Gigi (Saat Memanjat) */}
          <g className="fmS">
            <path
              d="M44 37Q50 35.2 56 37L55 41.5Q50 44.5 45 41.5Z"
              fill="#7a1f1f"
              stroke={k}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M45.8 37.4Q50 36.2 54.2 37.4L54 39.4H46Z" fill="#fff" />
          </g>

          {/* Mulut: Kaget Terbuka (Saat Terpeleset) */}
          <ellipse
            className="fmO"
            cx="50"
            cy="40"
            rx="4"
            ry="5"
            fill="#6b1d1d"
            stroke={k}
            strokeWidth="1.6"
          />

          {/* Mulut: Sorak Gembira (Saat Puncak/Menang) */}
          <path
            className="fmW"
            d="M43 36Q50 47 57 36Z"
            fill="#6b1d1d"
            stroke={k}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}
export default PanjatClimberAvatar;
