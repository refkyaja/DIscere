import { useId } from 'react';

export type EkspresiKarakterPanjat = 'netral' | 'bahagia' | 'sedih' | 'puncak';
export type PoseKarakterPanjat = 'panjat' | 'podium';

export interface KarakterPanjatPinangProps {
  nama?: string;
  ekspresi?: EkspresiKarakterPanjat;
  pose?: PoseKarakterPanjat;
  podiumRank?: 1 | 2 | 3;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  streak?: number;
  className?: string;
}

const PALET_KAUS = [
  { utama: '#D7262E', gelap: '#9F1820', aksen: '#F8FAFC' }, // Merah Putih Nusantara
  { utama: '#2563EB', gelap: '#1D4ED8', aksen: '#FEF08A' }, // Biru Samudra
  { utama: '#059669', gelap: '#047857', aksen: '#FEF3C7' }, // Hijau Zamrud
  { utama: '#EA580C', gelap: '#C2410C', aksen: '#FFFBEB' }, // Oranye Senja
  { utama: '#7C3AED', gelap: '#5B21B6', aksen: '#FDE68A' }, // Ungu Semangat
];

function pilihPaletDariNama(nama?: string, podiumRank?: 1 | 2 | 3) {
  if (podiumRank === 1) {
    return { utama: '#D7262E', gelap: '#9F1820', aksen: '#FDE047' };
  }
  if (!nama) return PALET_KAUS[0];
  let hash = 0;
  for (let i = 0; i < nama.length; i++) {
    hash = (hash * 31 + nama.charCodeAt(i)) >>> 0;
  }
  return PALET_KAUS[hash % PALET_KAUS.length];
}

const UKURAN_MAP: Record<NonNullable<KarakterPanjatPinangProps['size']>, number> = {
  xs: 42,
  sm: 54,
  md: 72,
  lg: 92,
  xl: 112,
          };

/**
 * Karakter 2D kartun anak lomba Panjat Pinang (17 Agustus).
 * Mendukung ekspresi dinamis (netral, bahagia saat benar, sedih saat salah, puncak)
 * serta aksesori podium: Mahkota Emas (Juara 1), Kalung Perak (Juara 2), Kalung Perunggu (Juara 3).
 */
export default function KarakterPanjatPinang({
  nama,
  ekspresi = 'netral',
  pose = 'panjat',
  podiumRank,
  size = 'sm',
  streak = 0,
  className = '',
}: KarakterPanjatPinangProps) {
  const uid = useId().replace(/:/g, '');
  const px = UKURAN_MAP[size];
  const palet = pilihPaletDariNama(nama, podiumRank);
  const isBahagia = ekspresi === 'bahagia' || ekspresi === 'puncak';
  const isSedih = ekspresi === 'sedih';

  const gradKulitId = `skin-${uid}`;
  const gradEmasId = `gold-${uid}`;
  const gradPerakId = `silver-${uid}`;
  const gradPerungguId = `bronze-${uid}`;

  const labelAkses = [
    nama ? `Karakter ${nama}` : 'Karakter Panjat Pinang',
    podiumRank === 1
      ? 'Juara 1 bermahkota'
      : podiumRank === 2
      ? 'Juara 2 berkalung medali perak'
      : podiumRank === 3
      ? 'Juara 3 berkalung medali perunggu'
      : null,
    isBahagia ? 'ekspresi bahagia' : isSedih ? 'ekspresi sedih' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <svg
      width={px}
      height={Math.round(px * 1.08)}
      viewBox="0 0 120 130"
      role="img"
      aria-label={labelAkses}
      className={`overflow-visible select-none drop-shadow-[0_4px_4px_rgba(43,42,74,0.22)] ${
        isBahagia
          ? 'motion-safe:animate-bounce'
          : isSedih
          ? 'rotate-[-5deg] transition-transform duration-300'
          : 'transition-transform duration-300'
      } ${className}`}
      style={isBahagia ? { animationDuration: '1.1s', animationIterationCount: 2 } : undefined}
    >
      <defs>
        <linearGradient id={gradKulitId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FCD9B6" />
          <stop offset="100%" stopColor="#F1B789" />
        </linearGradient>
        <linearGradient id={gradEmasId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
        <linearGradient id={gradPerakId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>
        <linearGradient id={gradPerungguId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDBA74" />
          <stop offset="55%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#7C2D12" />
        </linearGradient>
      </defs>

      {/* Aura Streak / Kebahagiaan */}
      {(isBahagia || streak >= 3 || podiumRank === 1) && (
        <g opacity="0.95">
          <path
            d="M 18 32 L 20 26 L 22 32 L 28 34 L 22 36 L 20 42 L 18 36 L 12 34 Z"
            fill="#FFB81C"
            stroke="#B45309"
            strokeWidth="0.9"
          />
          <path
            d="M 101 26 L 103 21 L 105 26 L 110 28 L 105 30 L 103 35 L 101 30 L 96 28 Z"
            fill="#FFD23F"
            stroke="#B45309"
            strokeWidth="0.9"
          />
          <circle cx="96" cy="48" r="2.3" fill="#FFB81C" stroke="#B45309" strokeWidth="0.8" />
        </g>
      )}

      {/* Kaki & Celana */}
      {pose === 'podium' ? (
        <g>
          {/* Kaki kiri & kanan berdiri di podium */}
          <rect x="44" y="102" width="12" height="16" rx="5" fill="#1E293B" stroke="#0F172A" strokeWidth="2" />
          <rect x="64" y="102" width="12" height="16" rx="5" fill="#1E293B" stroke="#0F172A" strokeWidth="2" />
          {/* Sepatu olahraga */}
          <rect x="41" y="114" width="16" height="8" rx="4" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.8" />
          <rect x="63" y="114" width="16" height="8" rx="4" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.8" />
          <path d="M 43 119 H 55 M 65 119 H 77" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          {/* Kaki tertekuk memeluk batang tiang pinang */}
          <path
            d="M 46 102 C 38 106, 36 114, 46 118 L 54 116"
            fill="none"
            stroke="#1E293B"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 74 102 C 82 106, 84 114, 74 118 L 66 116"
            fill="none"
            stroke="#1E293B"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <ellipse cx="52" cy="117" rx="6.5" ry="4.5" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.5" />
          <ellipse cx="68" cy="117" rx="6.5" ry="4.5" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.5" />
        </g>
      )}

      {/* Lengan */}
      {pose === 'podium' ? (
        podiumRank === 1 ? (
          <g>
            {/* Juara 1: kedua tangan terangkat gembira merayakan kemenangan */}
            <path
              d="M 42 86 C 30 78, 22 66, 26 52"
              fill="none"
              stroke={palet.utama}
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 78 86 C 90 78, 98 66, 94 52"
              fill="none"
              stroke={palet.utama}
              strokeWidth="10"
              strokeLinecap="round"
            />
            <circle cx="26" cy="50" r="6" fill={`url(#${gradKulitId})`} stroke="#7C2D12" strokeWidth="1.5" />
            <circle cx="94" cy="50" r="6" fill={`url(#${gradKulitId})`} stroke="#7C2D12" strokeWidth="1.5" />
          </g>
        ) : (
          <g>
            {/* Juara 2 & 3: satu tangan melambai gembira, satu di samping bangga */}
            <path
              d="M 42 86 C 34 92, 34 101, 41 103"
              fill="none"
              stroke={palet.utama}
              strokeWidth="10"
              strokeLinecap="round"
            />
            <circle cx="42" cy="103" r="5.5" fill={`url(#${gradKulitId})`} stroke="#7C2D12" strokeWidth="1.5" />
            <path
              d="M 78 86 C 90 79, 97 68, 95 56"
              fill="none"
              stroke={palet.utama}
              strokeWidth="10"
              strokeLinecap="round"
            />
            <circle cx="95" cy="54" r="5.8" fill={`url(#${gradKulitId})`} stroke="#7C2D12" strokeWidth="1.5" />
          </g>
        )
      ) : (
        <g>
          {/* Pose panjat: kedua lengan melingkar erat menggapai batang pinang di belakang/depan */}
          <path
            d="M 42 86 C 28 84, 24 72, 34 65"
            fill="none"
            stroke={palet.utama}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 78 86 C 92 84, 96 72, 86 65"
            fill="none"
            stroke={palet.utama}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <circle cx="35" cy="64" r="6" fill={`url(#${gradKulitId})`} stroke="#7C2D12" strokeWidth="1.6" />
          <circle cx="85" cy="64" r="6" fill={`url(#${gradKulitId})`} stroke="#7C2D12" strokeWidth="1.6" />
        </g>
      )}

      {/* Tubuh / Kaus Olahraga 17-an */}
      <rect
        x="40"
        y="78"
        width="40"
        height="29"
        rx="13"
        fill={palet.utama}
        stroke={palet.gelap}
        strokeWidth="2.2"
      />
      {/* Garis putih vertikal / kerah sporty */}
      <path d="M 52 79 Q 60 85 68 79" fill="none" stroke={palet.aksen} strokeWidth="3" strokeLinecap="round" />
      <rect x="46" y="96" width="28" height="4" rx="2" fill={palet.aksen} opacity="0.9" />

      {/* Aksesori Podium: Kalung Perak (Juara 2) atau Kalung Perunggu (Juara 3) */}
      {podiumRank === 2 && (
        <g>
          {/* Pita kalung biru elegan */}
          <path d="M 49 79 L 60 99 L 71 79" fill="none" stroke="#38BDF8" strokeWidth="3.8" strokeLinejoin="round" />
          <path d="M 51 79 L 60 96 L 69 79" fill="none" stroke="#F8FAFC" strokeWidth="1.2" strokeLinejoin="round" />
          {/* Medali Perak */}
          <circle cx="60" cy="102" r="9.5" fill={`url(#${gradPerakId})`} stroke="#475569" strokeWidth="1.8" />
          <circle cx="60" cy="102" r="6.8" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.8" />
          <text
            x="60"
            y="105.5"
            textAnchor="middle"
            fontSize="10"
            fontWeight="900"
            fill="#1E293B"
            fontFamily="sans-serif"
          >
            2
          </text>
        </g>
      )}

      {podiumRank === 3 && (
        <g>
          {/* Pita kalung merah-putih */}
          <path d="M 49 79 L 60 99 L 71 79" fill="none" stroke="#F87171" strokeWidth="3.8" strokeLinejoin="round" />
          <path d="M 51 79 L 60 96 L 69 79" fill="none" stroke="#FEF3C7" strokeWidth="1.2" strokeLinejoin="round" />
          {/* Medali Perunggu */}
          <circle cx="60" cy="102" r="9.5" fill={`url(#${gradPerungguId})`} stroke="#78350F" strokeWidth="1.8" />
          <circle cx="60" cy="102" r="6.8" fill="none" stroke="#FED7AA" strokeWidth="1" opacity="0.7" />
          <text
            x="60"
            y="105.5"
            textAnchor="middle"
            fontSize="10"
            fontWeight="900"
            fill="#FFFBEB"
            fontFamily="sans-serif"
          >
            3
          </text>
        </g>
      )}

      {/* Leher */}
      <rect x="54" y="73" width="12" height="8" rx="3" fill={`url(#${gradKulitId})`} />

      {/* Pita Ujung Ikat Kepala (berkibar di kiri) */}
      <path d="M 35 42 L 22 47 L 26 52 L 36 46 Z" fill="#EF4444" stroke="#991B1B" strokeWidth="1.3" />
      <path d="M 35 46 L 23 55 L 28 58 L 37 49 Z" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.2" />

      {/* Telinga */}
      <circle cx="35.5" cy="56" r="5" fill={`url(#${gradKulitId})`} stroke="#9A3412" strokeWidth="1.5" />
      <circle cx="84.5" cy="56" r="5" fill={`url(#${gradKulitId})`} stroke="#9A3412" strokeWidth="1.5" />

      {/* Kepala */}
      <circle
        cx="60"
        cy="54"
        r="24.5"
        fill={`url(#${gradKulitId})`}
        stroke="#9A3412"
        strokeWidth="2"
      />

      {/* Rambut Anak Indonesia */}
      <path
        d="M 35.5 49 C 35 30, 50 24, 60 25 C 74 24, 85 31, 84.5 49 C 78 40, 72 37, 62 39 C 54 35, 42 40, 35.5 49 Z"
        fill="#1E1B18"
      />

      {/* Ikat Kepala Merah Putih Khas 17 Agustus */}
      <path
        d="M 36.5 42 Q 60 36 83.5 42 L 84 46.5 Q 60 40.5 36 46.5 Z"
        fill="#D7262E"
        stroke="#991B1B"
        strokeWidth="1"
      />
      <path
        d="M 36 46.5 Q 60 40.5 84 46.5 L 83.8 49.8 Q 60 44 36.2 49.8 Z"
        fill="#FFFFFF"
        stroke="#CBD5E1"
        strokeWidth="0.9"
      />

      {/* Mahkota Emas khusus Juara 1 di Podium */}
      {podiumRank === 1 && (
        <g transform="translate(0, -1)">
          <path
            d="M 38 30 L 42 12 L 52 21 L 60 6 L 68 21 L 78 12 L 82 30 Z"
            fill={`url(#${gradEmasId})`}
            stroke="#92400E"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Permata di setiap puncak & tengah mahkota */}
          <circle cx="42" cy="11" r="2.6" fill="#FACC15" stroke="#92400E" strokeWidth="1.2" />
          <circle cx="60" cy="6" r="3.2" fill="#FEF08A" stroke="#92400E" strokeWidth="1.3" />
          <circle cx="78" cy="11" r="2.6" fill="#FACC15" stroke="#92400E" strokeWidth="1.2" />
          <circle cx="60" cy="22" r="3" fill="#EF4444" stroke="#FFFFFF" strokeWidth="0.9" />
          <circle cx="48" cy="23" r="2" fill="#38BDF8" />
          <circle cx="72" cy="23" r="2" fill="#38BDF8" />
        </g>
      )}

      {/* EKPRESI WAJAH */}
      {isBahagia ? (
        <g>
          {/* Mata bahagia melengkung ke atas (^ ^) */}
          <path
            d="M 44.5 57 Q 50.5 49 56.5 57"
            fill="none"
            stroke="#1E293B"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M 63.5 57 Q 69.5 49 75.5 57"
            fill="none"
            stroke="#1E293B"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Pipi merona bahagia */}
          <ellipse cx="44" cy="63" rx="4.5" ry="2.6" fill="#FB7185" opacity="0.6" />
          <ellipse cx="76" cy="63" rx="4.5" ry="2.6" fill="#FB7185" opacity="0.6" />
          {/* Senyum lebar ceria */}
          <path
            d="M 50 63 Q 60 65.5 70 63 Q 70 74.5 60 74.5 Q 50 74.5 50 63 Z"
            fill="#991B1B"
            stroke="#7F1D1D"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M 54 71 Q 60 67.5 66 71 Q 60 74.5 54 71 Z" fill="#FDA4AF" />
        </g>
      ) : isSedih ? (
        <g>
          {/* Alis sedih miring */}
          <path d="M 43 51 L 55 47.5" fill="none" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M 65 47.5 L 77 51" fill="none" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />
          {/* Mata berkaca sedih */}
          <ellipse cx="50.5" cy="56" rx="4.2" ry="4.5" fill="#1E293B" />
          <ellipse cx="69.5" cy="56" rx="4.2" ry="4.5" fill="#1E293B" />
          <circle cx="49" cy="54.2" r="1.5" fill="#FFFFFF" />
          <circle cx="68" cy="54.2" r="1.5" fill="#FFFFFF" />
          {/* Tetesan air mata */}
          <path
            d="M 45.5 58.5 C 43.5 62, 43.5 65.5, 45.8 66 C 48 65.5, 47.5 62, 45.5 58.5 Z"
            fill="#38BDF8"
            stroke="#0284C7"
            strokeWidth="0.8"
          />
          <path
            d="M 74.5 58.5 C 76.5 62, 76.5 65.5, 74.2 66 C 72 65.5, 72.5 62, 74.5 58.5 Z"
            fill="#38BDF8"
            stroke="#0284C7"
            strokeWidth="0.8"
          />
          {/* Keringat gugup di pelipis */}
          <path
            d="M 79 44 C 82 47, 82 50, 79.5 50.5 C 77.2 50, 77.5 47, 79 44 Z"
            fill="#7DD3FC"
          />
          {/* Mulut melengkung ke bawah sedih */}
          <path
            d="M 51.5 72 Q 60 64.5 68.5 72"
            fill="none"
            stroke="#1E293B"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>
      ) : (
        <g>
          {/* Mata bersemangat (netral) */}
          <circle cx="50.5" cy="55.5" r="4" fill="#1E293B" />
          <circle cx="69.5" cy="55.5" r="4" fill="#1E293B" />
          <circle cx="49" cy="53.8" r="1.4" fill="#FFFFFF" />
          <circle cx="68" cy="53.8" r="1.4" fill="#FFFFFF" />
          <path d="M 45 48.5 Q 50.5 46 55.5 48.5" fill="none" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M 64.5 48.5 Q 69.5 46 75 48.5" fill="none" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
          {/* Pipi tipis */}
          <ellipse cx="44.5" cy="62" rx="3.8" ry="2" fill="#FB7185" opacity="0.35" />
          <ellipse cx="75.5" cy="62" rx="3.8" ry="2" fill="#FB7185" opacity="0.35" />
          {/* Senyum penuh semangat */}
          <path
            d="M 52.5 65 Q 60 71 67.5 65"
            fill="none"
            stroke="#1E293B"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}

