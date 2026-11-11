import { useId } from 'react';

export type EkspresiTarikTambang =
  | 'netral'
  | 'semangat'
  | 'bahagia'
  | 'sedih'
  | 'menang'
  | 'kalah';

export type PoseTarikTambang = 'siap' | 'tarik' | 'podium';

export interface KarakterTarikTambangProps {
  tim: 'merah' | 'putih';
  ekspresi?: EkspresiTarikTambang;
  pose?: PoseTarikTambang;
  /** Arah menghadap: default Tim Merah menghadap ke kanan (pusat), Tim Putih menghadap ke kiri (pusat) */
  hadap?: 'kanan' | 'kiri';
  /** Variasi rambut & warna kulit agar anggota tim tampak beragam (0, 1, atau 2) */
  varian?: 0 | 1 | 2;
  podiumRank?: 1 | 2;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const UKURAN_MAP: Record<NonNullable<KarakterTarikTambangProps['size']>, number> = {
  xs: 44,
  sm: 60,
  md: 80,
  lg: 108,
};

const PALET_KULIT: Array<{ terang: string; gelap: string }> = [
  { terang: '#FCD9B6', gelap: '#F0B687' },
  { terang: '#F4C69D', gelap: '#E2A472' },
  { terang: '#E8B48A', gelap: '#CE9263' },
];

/**
 * Karakter 2D kartun siswa lomba Tarik Tambang 17 Agustus (Tim Merah vs Tim Putih).
 * Mendukung pose siap, menarik tali (miring bertumpu), dan podium juara bermahkota/bermedali,
 * serta ekspresi dinamis saat benar/menarik (bahagia), salah/tertarik (sedih), dan kemenangan.
 */
export default function KarakterTarikTambang({
  tim,
  ekspresi = 'netral',
  pose = 'tarik',
  hadap,
  varian = 0,
  podiumRank,
  size = 'sm',
  className = '',
}: KarakterTarikTambangProps) {
  const uid = useId().replace(/:/g, '');
  const px = UKURAN_MAP[size];

  const arahHadap = hadap ?? (tim === 'merah' ? 'kanan' : 'kiri');
  const flipHorizontal = pose === 'tarik' && arahHadap === 'kiri';

  const kulit = PALET_KULIT[varian % PALET_KULIT.length];
  const isMerah = tim === 'merah';

  const kaus = isMerah
    ? { utama: '#c8362f', gelap: '#961e19', kerah: '#fbf6e9', celana: '#1d3b2e', pita: '#c8362f' }
    : { utama: '#ffffff', gelap: '#cbd5e1', kerah: '#1f4a6b', celana: '#1f4a6b', pita: '#1f4a6b' };

  const isBahagia = ekspresi === 'bahagia' || ekspresi === 'menang';
  const isSedih = ekspresi === 'sedih' || ekspresi === 'kalah';
  const isSemangat = ekspresi === 'semangat';

  const gradKulitId = `tt-skin-${uid}`;
  const gradEmasId = `tt-gold-${uid}`;
  const gradPerakId = `tt-silver-${uid}`;

  const labelAkses = [
    `Karakter Tim ${isMerah ? 'Merah' : 'Putih'}`,
    podiumRank === 1 ? 'Pemenang bermahkota emas' : podiumRank === 2 ? 'Runner-up bermedali perak' : null,
    isBahagia ? 'bersorak bahagia' : isSedih ? 'ekspresi tegang atau sedih' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <svg
      width={px}
      height={Math.round(px * 1.05)}
      viewBox="0 0 130 136"
      role="img"
      aria-label={labelAkses}
      className={`overflow-visible select-none drop-shadow-[0_3px_4px_rgba(0,0,0,0.28)] ${
        isBahagia
          ? 'motion-safe:animate-bounce'
          : isSedih && pose !== 'tarik'
          ? 'rotate-[-4deg] transition-transform duration-300'
          : 'transition-transform duration-300'
      } ${className}`}
      style={isBahagia ? { animationDuration: '0.95s', animationIterationCount: 2 } : undefined}
    >
      <defs>
        <linearGradient id={gradKulitId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={kulit.terang} />
          <stop offset="100%" stopColor={kulit.gelap} />
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
      </defs>

      {/* Bintang semarak saat menang atau bersorak bahagia */}
      {(isBahagia || podiumRank === 1) && (
        <g opacity="0.95">
          <path d="M 16 28 L 18 22 L 20 28 L 26 30 L 20 32 L 18 38 L 16 32 L 10 30 Z" fill="#f2c230" />
          <path d="M 110 24 L 112 19 L 114 24 L 119 26 L 114 28 L 112 33 L 110 28 L 105 26 Z" fill="#FDE047" />
        </g>
      )}

      {/* ============================================================
          POSE 1: MENARIK TALI (Sisi Kiri menghadap kanan / di-mirror kanan)
          ============================================================ */}
      {pose === 'tarik' && (
        <g transform={flipHorizontal ? 'translate(130, 0) scale(-1, 1)' : undefined}>
          {/* Bayangan tanah */}
          <ellipse cx="62" cy="126" rx="34" ry="6" fill="#1d3b2e" opacity="0.22" />

          {/* Kaki Belakang (bertumpu kuat di belakang kiri) */}
          <path
            d="M 50 96 L 34 118"
            stroke={kaus.celana}
            strokeWidth="12"
            strokeLinecap="round"
          />
          <ellipse cx="30" cy="121" rx="9" ry="5.5" fill={isMerah ? '#c8362f' : '#1f4a6b'} stroke="#1d3b2e" strokeWidth="1.8" />
          <path d="M 24 123 H 36" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />

          {/* Kaki Depan (menahan pijakan ke arah depan kanan) */}
          <path
            d="M 65 96 L 86 116"
            stroke={kaus.celana}
            strokeWidth="12"
            strokeLinecap="round"
          />
          <ellipse cx="90" cy="119" rx="9.5" ry="5.5" fill={isMerah ? '#c8362f' : '#1f4a6b'} stroke="#1d3b2e" strokeWidth="1.8" />
          <path d="M 84 121 H 96" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />

          {/* Lengan Belakang ikut menggenggam tali */}
          <path
            d="M 52 76 Q 76 86 98 85"
            fill="none"
            stroke={`url(#${gradKulitId})`}
            strokeWidth="9"
            strokeLinecap="round"
          />

          {/* Tubuh condong ke belakang (tarikan penuh tenaga) */}
          <g transform="rotate(-14 58 82)">
            <rect
              x="40"
              y="62"
              width="36"
              height="38"
              rx="12"
              fill={kaus.utama}
              stroke={kaus.gelap}
              strokeWidth="2.4"
            />
            {/* Kerah & Garis Jersey */}
            <path d="M 50 63 Q 58 69 66 63" fill="none" stroke={kaus.kerah} strokeWidth="3.2" strokeLinecap="round" />
            <rect x="44" y="88" width="28" height="4.5" rx="2" fill={kaus.kerah} opacity="0.9" />

            {/* Celana */}
            <rect
              x="42"
              y="91"
              width="32"
              height="14"
              rx="5"
              fill={kaus.celana}
              stroke="#0f172a"
              strokeWidth="1.8"
            />

            {/* Leher */}
            <rect x="52" y="54" width="12" height="9" rx="3" fill={`url(#${gradKulitId})`} />

            {/* Pita Ujung Ikat Kepala berkibar ke belakang */}
            <path d="M 32 32 L 15 36 L 20 42 L 33 36 Z" fill={kaus.pita} stroke="#1d3b2e" strokeWidth="1.2" />
            <path d="M 32 37 L 17 46 L 23 49 L 35 40 Z" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.1" />

            {/* Kepala */}
            <circle cx="58" cy="36" r="23.5" fill={`url(#${gradKulitId})`} stroke="#9A3412" strokeWidth="2" />
            <circle cx="34.5" cy="38" r="4.5" fill={`url(#${gradKulitId})`} stroke="#9A3412" strokeWidth="1.5" />

            {/* Rambut Anak Indonesia (3 varian gaya rambut) */}
            {varian === 1 ? (
              <>
                <circle cx="33" cy="24" r="7" fill="#1E1B18" />
                <path
                  d="M 34.5 31 C 34 14, 52 8, 63 10 C 76 11, 82 21, 81.5 31 C 74 22, 66 20, 56 22 C 48 19, 39 23, 34.5 31 Z"
                  fill="#1E1B18"
                />
              </>
            ) : varian === 2 ? (
              <path
                d="M 34.5 32 C 34 15, 48 7, 57 12 C 63 6, 73 10, 74 16 C 81 18, 82 26, 81 33 C 73 24, 65 23, 56 24 C 46 21, 40 25, 34.5 32 Z"
                fill="#1E1B18"
              />
            ) : (
              <path
                d="M 34.5 31 C 35 14, 49 9, 59 10 C 72 9, 82 17, 81.5 32 C 74 23, 66 21, 57 22 C 49 18, 39 23, 34.5 31 Z"
                fill="#1E1B18"
              />
            )}

            {/* Ikat Kepala 17 Agustus */}
            <path d="M 35 26 Q 58 21 81 26 L 81.5 30 Q 58 25 34.5 30 Z" fill={kaus.pita} stroke="#1d3b2e" strokeWidth="1" />
            <path d="M 34.5 30 Q 58 25 81.5 30 L 81.2 33.2 Q 58 28.4 34.8 33.2 Z" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.9" />

            {/* Ekspresi Wajah Menarik Tali (menghadap sedikit ke arah kanan tengah) */}
            {isBahagia ? (
              <g>
                <path d="M 50 38 Q 55 32 60 38" fill="none" stroke="#1E293B" strokeWidth="2.8" strokeLinecap="round" />
                <path d="M 65 38 Q 70 32 75 38" fill="none" stroke="#1E293B" strokeWidth="2.8" strokeLinecap="round" />
                <ellipse cx="48" cy="44" rx="4" ry="2.2" fill="#FB7185" opacity="0.6" />
                <ellipse cx="75" cy="44" rx="3.8" ry="2.2" fill="#FB7185" opacity="0.6" />
                <path d="M 54 45 Q 62 47 71 45 Q 70 54 62 54 Q 54 54 54 45 Z" fill="#991B1B" stroke="#7F1D1D" strokeWidth="1.2" />
              </g>
            ) : isSedih ? (
              <g>
                <path d="M 48 34 L 58 31" fill="none" stroke="#1E293B" strokeWidth="2.3" strokeLinecap="round" />
                <path d="M 66 31 L 76 34" fill="none" stroke="#1E293B" strokeWidth="2.3" strokeLinecap="round" />
                <circle cx="54" cy="39" r="3.6" fill="#1E293B" />
                <circle cx="70" cy="39" r="3.6" fill="#1E293B" />
                <circle cx="53" cy="37.8" r="1.2" fill="#ffffff" />
                <circle cx="69" cy="37.8" r="1.2" fill="#ffffff" />
                {/* Tetes keringat tegang */}
                <path d="M 42 33 C 39 36, 39.5 39, 41.8 39.5 C 44 39, 43.5 36, 42 33 Z" fill="#38BDF8" />
                {/* Mulut gigit gigi / tegang ke bawah */}
                <path d="M 54 50 Q 62 44.5 70 50" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            ) : (
              <g>
                {/* Alis fokus penuh tenaga */}
                <path d="M 48 31 L 58 34" fill="none" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />
                <path d="M 66 34 L 76 31" fill="none" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="54" cy="39" r="3.5" fill="#1E293B" />
                <circle cx="70" cy="39" r="3.5" fill="#1E293B" />
                <circle cx="53" cy="37.8" r="1.2" fill="#ffffff" />
                <circle cx="69" cy="37.8" r="1.2" fill="#ffffff" />
                <ellipse cx="48" cy="44" rx="3.5" ry="2" fill="#FB7185" opacity="0.4" />
                {isSemangat ? (
                  <path d="M 54 46 H 70 Q 70 52 62 52 Q 54 52 54 46 Z" fill="#ffffff" stroke="#1E293B" strokeWidth="1.6" />
                ) : (
                  <path d="M 55 46 Q 62 51 69 46" fill="none" stroke="#1E293B" strokeWidth="2.3" strokeLinecap="round" />
                )}
              </g>
            )}
          </g>

          {/* Lengan Depan menggenggam erat ke tali di posisi y=86 */}
          <path
            d="M 58 76 Q 78 90 105 86"
            fill="none"
            stroke={`url(#${gradKulitId})`}
            strokeWidth="9.5"
            strokeLinecap="round"
          />
          {/* Tangan kanan & kiri mengepal memegang tali */}
          <circle cx="96" cy="85" r="6" fill={`url(#${gradKulitId})`} stroke="#9A3412" strokeWidth="1.6" />
          <circle cx="107" cy="86" r="6.2" fill={`url(#${gradKulitId})`} stroke="#9A3412" strokeWidth="1.6" />
        </g>
      )}

      {/* ============================================================
          POSE 2 & 3: SIAP (LOBI) & PODIUM PERAYAAN (HASIL AKHIR)
          ============================================================ */}
      {pose !== 'tarik' && (
        <g>
          {/* Bayangan tanah */}
          <ellipse cx="65" cy="126" rx="28" ry="5.5" fill="#1d3b2e" opacity="0.2" />

          {/* Kaki & Sepatu */}
          <rect x="49" y="99" width="12" height="19" rx="5" fill={kaus.celana} stroke="#0f172a" strokeWidth="1.8" />
          <rect x="69" y="99" width="12" height="19" rx="5" fill={kaus.celana} stroke="#0f172a" strokeWidth="1.8" />
          <rect x="45" y="114" width="17" height="8.5" rx="4" fill={isMerah ? '#c8362f' : '#1f4a6b'} stroke="#0f172a" strokeWidth="1.6" />
          <rect x="68" y="114" width="17" height="8.5" rx="4" fill={isMerah ? '#c8362f' : '#1f4a6b'} stroke="#0f172a" strokeWidth="1.6" />

          {/* Lengan (Sorak atas saat menang / podiumRank 1, melambai ramah atau turun saat kalah) */}
          {pose === 'podium' && (podiumRank === 1 || isBahagia) ? (
            <g>
              <path d="M 45 79 Q 30 66 28 50" fill="none" stroke={`url(#${gradKulitId})`} strokeWidth="9.5" strokeLinecap="round" />
              <path d="M 85 79 Q 100 66 102 50" fill="none" stroke={`url(#${gradKulitId})`} strokeWidth="9.5" strokeLinecap="round" />
              <circle cx="28" cy="48" r="6" fill={`url(#${gradKulitId})`} stroke="#9A3412" strokeWidth="1.5" />
              <circle cx="102" cy="48" r="6" fill={`url(#${gradKulitId})`} stroke="#9A3412" strokeWidth="1.5" />
            </g>
          ) : (
            <g>
              <path d="M 45 80 Q 34 90 40 100" fill="none" stroke={`url(#${gradKulitId})`} strokeWidth="9.5" strokeLinecap="round" />
              <path d="M 85 80 Q 98 69 98 56" fill="none" stroke={`url(#${gradKulitId})`} strokeWidth="9.5" strokeLinecap="round" />
              <circle cx="40" cy="101" r="5.5" fill={`url(#${gradKulitId})`} stroke="#9A3412" strokeWidth="1.5" />
              <circle cx="98" cy="54" r="5.8" fill={`url(#${gradKulitId})`} stroke="#9A3412" strokeWidth="1.5" />
            </g>
          )}

          {/* Badan / Kaus Tim */}
          <rect
            x="44"
            y="72"
            width="42"
            height="32"
            rx="13"
            fill={kaus.utama}
            stroke={kaus.gelap}
            strokeWidth="2.4"
          />
          <path d="M 55 73 Q 65 80 75 73" fill="none" stroke={kaus.kerah} strokeWidth="3.2" strokeLinecap="round" />
          <rect x="49" y="92" width="32" height="4.5" rx="2" fill={kaus.kerah} opacity="0.9" />

          {/* Medali Perak untuk Runner-up di Podium */}
          {pose === 'podium' && podiumRank === 2 && (
            <g>
              <path d="M 53 74 L 65 94 L 77 74" fill="none" stroke="#38BDF8" strokeWidth="3.8" strokeLinejoin="round" />
              <circle cx="65" cy="98" r="9.5" fill={`url(#${gradPerakId})`} stroke="#475569" strokeWidth="1.8" />
              <circle cx="65" cy="98" r="6.8" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.85" />
              <text x="65" y="101.5" textAnchor="middle" fontSize="10" fontWeight="900" fill="#1E293B" fontFamily="sans-serif">
                2
              </text>
            </g>
          )}

          {/* Leher */}
          <rect x="59" y="65" width="12" height="8" rx="3" fill={`url(#${gradKulitId})`} />

          {/* Pita Ikat Kepala */}
          <path d="M 40 37 L 27 42 L 31 47 L 41 41 Z" fill={kaus.pita} stroke="#1d3b2e" strokeWidth="1.2" />
          <path d="M 40 41 L 28 50 L 33 53 L 42 44 Z" fill="#FFFFFF" stroke="#94a3b8" strokeWidth="1.1" />

          {/* Telinga & Kepala */}
          <circle cx="40.5" cy="51" r="5" fill={`url(#${gradKulitId})`} stroke="#9A3412" strokeWidth="1.5" />
          <circle cx="89.5" cy="51" r="5" fill={`url(#${gradKulitId})`} stroke="#9A3412" strokeWidth="1.5" />
          <circle cx="65" cy="49" r="24.5" fill={`url(#${gradKulitId})`} stroke="#9A3412" strokeWidth="2" />

          {/* Rambut */}
          <path
            d="M 40.5 44 C 40 25, 55 19, 65 20 C 79 19, 90 26, 89.5 44 C 83 35, 77 32, 67 34 C 59 30, 47 35, 40.5 44 Z"
            fill="#1E1B18"
          />

          {/* Ikat Kepala */}
          <path d="M 41.5 37 Q 65 31 88.5 37 L 89 41.5 Q 65 35.5 41 41.5 Z" fill={kaus.pita} stroke="#1d3b2e" strokeWidth="1" />
          <path d="M 41 41.5 Q 65 35.5 89 41.5 L 88.8 44.8 Q 65 39 41.2 44.8 Z" fill="#FFFFFF" stroke="#94a3b8" strokeWidth="0.9" />

          {/* Mahkota Emas untuk Tim Pemenang */}
          {(podiumRank === 1 || ekspresi === 'menang') && (
            <g transform="translate(5, -5)">
              <path
                d="M 38 30 L 42 12 L 52 21 L 60 6 L 68 21 L 78 12 L 82 30 Z"
                fill={`url(#${gradEmasId})`}
                stroke="#92400E"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="60" cy="6" r="3" fill="#FEF08A" stroke="#92400E" strokeWidth="1.2" />
              <circle cx="60" cy="22" r="2.8" fill="#EF4444" stroke="#FFFFFF" strokeWidth="0.9" />
            </g>
          )}

          {/* Ekspresi Wajah */}
          {isBahagia ? (
            <g>
              <path d="M 49.5 52 Q 55.5 44 61.5 52" fill="none" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
              <path d="M 68.5 52 Q 74.5 44 80.5 52" fill="none" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
              <ellipse cx="49" cy="58" rx="4.5" ry="2.6" fill="#FB7185" opacity="0.6" />
              <ellipse cx="81" cy="58" rx="4.5" ry="2.6" fill="#FB7185" opacity="0.6" />
              <path d="M 55 58 Q 65 60.5 75 58 Q 75 69.5 65 69.5 Q 55 69.5 55 58 Z" fill="#991B1B" stroke="#7F1D1D" strokeWidth="1.4" />
              <path d="M 59 66 Q 65 62.5 71 66 Q 65 69.5 59 66 Z" fill="#FDA4AF" />
            </g>
          ) : isSedih ? (
            <g>
              <path d="M 48 46 L 60 42.5" fill="none" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M 70 42.5 L 82 46" fill="none" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />
              <ellipse cx="55.5" cy="51" rx="4" ry="4.4" fill="#1E293B" />
              <ellipse cx="74.5" cy="51" rx="4" ry="4.4" fill="#1E293B" />
              <circle cx="54" cy="49.2" r="1.4" fill="#FFFFFF" />
              <circle cx="73" cy="49.2" r="1.4" fill="#FFFFFF" />
              <path d="M 84 39 C 87 42, 87 45, 84.5 45.5 C 82.2 45, 82.5 42, 84 39 Z" fill="#7DD3FC" />
              <path d="M 56.5 67 Q 65 59.5 73.5 67" fill="none" stroke="#1E293B" strokeWidth="2.6" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              <circle cx="55.5" cy="50.5" r="3.9" fill="#1E293B" />
              <circle cx="74.5" cy="50.5" r="3.9" fill="#1E293B" />
              <circle cx="54" cy="48.8" r="1.3" fill="#FFFFFF" />
              <circle cx="73" cy="48.8" r="1.3" fill="#FFFFFF" />
              <path d="M 50 43.5 Q 55.5 41 60.5 43.5" fill="none" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M 69.5 43.5 Q 74.5 41 80 43.5" fill="none" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
              <ellipse cx="49.5" cy="57" rx="3.8" ry="2" fill="#FB7185" opacity="0.35" />
              <ellipse cx="80.5" cy="57" rx="3.8" ry="2" fill="#FB7185" opacity="0.35" />
              <path d="M 57.5 60 Q 65 66 72.5 60" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}

