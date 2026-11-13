import { useState, useEffect } from 'react';

export interface RuangTungguGuruProps {
  sessionId: string;
  token: string;
  qrDataUrl?: string;
  gameType: 'tarik_tambang' | 'balap_karung' | 'makan_kerupuk' | 'panjat_pinang';
  gameTitle: string;
  templateJudul?: string;
  metaDetail?: string;
  daftarPeserta: Array<{ id: string; nama: string; tim?: string | null; connected?: boolean }>;
  minPeserta?: number;
  maxPeserta?: number;
  isStarting?: boolean;
  onMulai: () => void;
  onKembali?: () => void;
  onKickPeserta?: (pesertaId: string) => void;
  onIzinkanKembali?: (pesertaId: string) => void;
}

const AVATAR_BG = ['#7cc6a4', '#f2c230', '#e98a7a', '#8fb8e8', '#c4a2e0', '#9ad06a', '#f0a15a', '#6fc3c9'];
const AVATAR_SKIN = ['#f0b98d', '#e9b08a', '#f3c9a2'];
const AVATAR_HAIR = ['#2b2019', '#3b2a22', '#1c1c24', '#5a3a22'];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function AvatarSvg({ name, size = 44 }: { name: string; size?: number }) {
  const hash = hashString(name);
  const bg = AVATAR_BG[hash % AVATAR_BG.length];
  const sk = AVATAR_SKIN[(hash >> 2) % AVATAR_SKIN.length];
  const hr = AVATAR_HAIR[(hash >> 4) % AVATAR_HAIR.length];

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="w-full h-full rounded-full">
      <circle cx="20" cy="20" r="20" fill={bg} />
      <circle cx="20" cy="22" r="11" fill={sk} />
      <path d="M8.5 20Q9 8 20 8Q31 8 31.5 20Q27 14 20 15Q13 14 8.5 20Z" fill={hr} />
      <circle cx="16" cy="23" r="1.6" fill="#222" />
      <circle cx="24" cy="23" r="1.6" fill="#222" />
      <path d="M16.5 27.5Q20 30 23.5 27.5" stroke="#7a2a24" fill="none" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function RuangTungguGuru({
  token,
  qrDataUrl,
  gameTitle,
  metaDetail,
  daftarPeserta,
  minPeserta = 1,
  maxPeserta,
  isStarting = false,
  onMulai,
  onKembali,
  onKickPeserta,
  onIzinkanKembali,
}: RuangTungguGuruProps) {
  const [askingId, setAskingId] = useState<string | null>(null);
  const [kickedList, setKickedList] = useState<Array<{ id: string; nama: string }>>([]);
  const [locked, setLocked] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const [toastUndoAction, setToastUndoAction] = useState<(() => void) | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastText) return;
    const timer = setTimeout(() => {
      setToastText(null);
      setToastUndoAction(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toastText]);

  // Handle keyboard ESC to close zoom modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (text: string, undo?: () => void) => {
    setToastText(text);
    setToastUndoAction(undo ? () => undo : null);
  };

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      showToast(`Token PIN ${token} berhasil disalin!`);
    } catch {
      showToast(`Salin manual token: ${token}`);
    }
  };

  const handleKickConfirm = (id: string, nama: string) => {
    setAskingId(null);
    setKickedList((prev) => [...prev, { id, nama }]);
    onKickPeserta?.(id);
    showToast(`${nama} dikeluarkan.`, () => {
      setKickedList((prev) => prev.filter((k) => k.id !== id));
      onIzinkanKembali?.(id);
    });
  };

  const handleIzinkanKembali = (id: string, nama: string) => {
    setKickedList((prev) => prev.filter((k) => k.id !== id));
    onIzinkanKembali?.(id);
    showToast(`${nama} diizinkan kembali.`);
  };

  // Hitung jumlah bangku: setidaknya 8 bangku (2 baris x 4 kolom), atau kelipatan 4 berikutnya
  const totalDesksToDisplay = maxPeserta
    ? Math.min(maxPeserta, Math.max(8, Math.ceil((daftarPeserta.length + 2) / 4) * 4))
    : Math.max(8, Math.ceil((daftarPeserta.length + 2) / 4) * 4);
  const emptyDesksCount = Math.max(0, totalDesksToDisplay - daftarPeserta.length);

  // Status pill text
  let statusText = 'Menunggu siswa masuk…';
  if (daftarPeserta.length < minPeserta) {
    statusText = `Minimal ${minPeserta} siswa untuk memulai.`;
  } else if (locked) {
    statusText = 'Ruangan dikunci, tidak ada siswa baru.';
  } else if (isStarting) {
    statusText = 'Game dimulai! Membagi kelompok…';
  } else if (maxPeserta && daftarPeserta.length >= maxPeserta) {
    statusText = 'Ruangan penuh. Siap dimulai!';
  } else {
    statusText = `Menunggu siswa masuk… (${daftarPeserta.length} siswa siap)`;
  }

  const metaText = metaDetail || gameTitle;

  return (
    <div className="rt-guru fixed inset-0 w-full h-[100dvh] max-h-[100dvh] flex flex-col justify-between select-none text-[#f4ecd8] overflow-hidden">
      <style>{`
        .rt-guru {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100dvh;
          max-height: 100dvh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          --board: #1f4a37;
          --board-d: #163a2b;
          --card: #fbf6e9;
          --ink: #1d3b2e;
          --muted: #5a6f62;
          --chalk: #f4ecd8;
          --yellow: #f2c230;
          --red: #c8362f;
          font-family: 'Nunito', system-ui, sans-serif;
          background:
            radial-gradient(ellipse 40% 14% at 22% 30%, rgba(255,255,255,0.07), transparent),
            repeating-linear-gradient(115deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 11px),
            radial-gradient(ellipse at 30% 8%, rgba(255,255,255,0.11), transparent 55%),
            radial-gradient(ellipse at 85% 75%, rgba(0,0,0,0.22), transparent 60%),
            linear-gradient(160deg, #2c5f47, #1f4a37 55%, #163a2b);
          box-shadow: inset 0 0 150px rgba(0,0,0,0.35);
        }
        .rt-guru .hand {
          font-family: 'Caveat', 'Comic Sans MS', cursive;
          font-weight: 700;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(10, 32, 22, 0.25);
          border-radius: 999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(244, 236, 216, 0.4);
          border-radius: 999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(244, 236, 216, 0.65);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(244, 236, 216, 0.4) rgba(10, 32, 22, 0.25);
        }
        @keyframes flipSand {
          0%, 84% { transform: rotate(0); animation-timing-function: cubic-bezier(.6,0,.25,1); }
          96%, 100% { transform: rotate(180deg); }
        }
        @keyframes sandTop {
          0% { transform: translateY(0) scaleY(1); animation-timing-function: ease-in; }
          5% { transform: translateY(24px) scaleY(1); animation-timing-function: linear; }
          82%, 100% { transform: translateY(24px) scaleY(0); }
        }
        @keyframes sandBottom {
          0%, 5% { transform: scaleY(0); }
          82%, 100% { transform: scaleY(1); }
        }
        @keyframes sandStream {
          0%, 6% { opacity: 0; }
          8%, 80% { opacity: 1; }
          82%, 100% { opacity: 0; }
        }
        @keyframes pulseEmpty {
          from { opacity: 0.55; }
          to { opacity: 1; }
        }
        @keyframes popCard {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .anim-flip {
          transform-box: view-box;
          transform-origin: 60px 80px;
          animation: flipSand 9s linear infinite;
        }
        .anim-s1 {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          transform: translateY(24px);
          animation: sandTop 9s linear infinite;
        }
        .anim-s2 {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          transform: scaleY(0);
          animation: sandBottom 9s linear infinite;
        }
        .anim-stm {
          opacity: 0;
          animation: sandStream 9s linear infinite;
        }
        .sheet {
          position: relative;
          transform: rotate(-0.8deg);
          transform-origin: center center;
          padding: 14px 14px 10px;
          text-align: center;
          color: #163a2b;
          background: #fbf6e9;
          border: 3px solid #e8dfc8;
          border-radius: 12px 14px 12px 16px;
          box-shadow: 0 6px 0 rgba(0,0,0,0.22);
          flex-shrink: 0;
          margin: 10px 4px 6px 8px;
        }
        .sheet::before, .sheet::after {
          content: "";
          position: absolute;
          top: -9px;
          width: 58px;
          height: 18px;
          background: rgba(242, 194, 48, 0.85);
          box-shadow: 0 2px 0 rgba(0,0,0,0.15);
        }
        .sheet::before {
          left: 14px;
          transform: rotate(-4deg);
        }
        .sheet::after {
          right: 14px;
          transform: rotate(3deg);
        }
        .denah {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          padding: 12px 14px 12px;
          border: 3px dashed rgba(244, 236, 216, 0.4);
          border-radius: 24px;
          background: rgba(10, 32, 22, 0.28);
          overflow: hidden;
        }
        .desks-wrap {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 10px 14px 16px 12px;
        }
        .desks {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px 12px;
        }
        @media (max-width: 1200px) {
          .desks {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 800px) {
          .desks {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .dk {
          position: relative;
          min-height: 114px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 10px 8px 8px;
          color: #163a2b;
          background: #fbf6e9;
          border: 3px solid #e8dfc8;
          border-radius: 16px 16px 8px 8px;
          box-shadow: 0 6px 0 #b99672, 0 8px 0 rgba(0,0,0,0.22);
          animation: popCard 0.45s cubic-bezier(0.3, 1.6, 0.5, 1);
        }
        .dk.ph {
          background: transparent;
          border: 2px dashed rgba(244, 236, 216, 0.35);
          box-shadow: none;
          color: rgba(244, 236, 216, 0.6);
          font-weight: 700;
          font-size: 13px;
          animation: pulseEmpty 1.6s ease-in-out infinite alternate;
        }
        .kick {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid #fbf6e9;
          background: #c8362f;
          color: #fff;
          font-weight: 900;
          font-size: 14px;
          line-height: 1;
          display: grid;
          place-items: center;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.25);
          transition: transform 0.15s ease, background-color 0.15s ease;
          z-index: 20;
        }
        .kick:hover {
          transform: scale(1.15);
          background: #a6251f;
        }
        .dk.ask {
          background: #fff1ef;
          border-color: #c8362f;
          gap: 4px;
        }
        .floor {
          position: relative;
          z-index: 20;
          min-height: 64px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 8px 20px;
          background: linear-gradient(#b99672 0 5px, transparent 5px), repeating-linear-gradient(90deg, #8b6a4a 0 118px, #7a5b3e 118px 120px);
          border-top: 3px solid #6f5238;
          flex-shrink: 0;
        }
        .pill {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #163a2b;
          color: #f4ecd8;
          font-weight: 700;
          font-size: 15px;
          padding: 10px 24px 10px 16px;
          border-radius: 999px;
          box-shadow: 0 4px 0 rgba(0,0,0,0.3);
        }
        .spin {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(244, 236, 216, 0.3);
          border-top-color: #f2c230;
          border-radius: 50%;
          animation: spinRot 1s linear infinite;
        }
        @keyframes spinRot {
          to { transform: rotate(360deg); }
        }
        .lk {
          background: transparent;
          color: #f4ecd8;
          border: 2px dashed rgba(244, 236, 216, 0.75);
          border-radius: 999px;
          padding: 10px 20px;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .lk.on {
          background: rgba(242, 194, 48, 0.25);
          border: 2px solid #f2c230;
          color: #f2c230;
        }
        .start {
          background: #f2c230;
          color: #163a2b;
          border: 0;
          border-radius: 999px;
          padding: 12px 34px;
          font-weight: 800;
          font-size: 18px;
          cursor: pointer;
          box-shadow: 0 5px 0 #a37d0f;
          transition: transform 0.1s ease, box-shadow 0.1s ease;
        }
        .start:active:not(:disabled) {
          transform: translateY(3px);
          box-shadow: 0 2px 0 #a37d0f;
        }
        .start:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
      `}</style>

      {/* DEKORASI RUMUS & BINTANG KAPUR DI LATAR BELAKANG */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-25 z-0"
        viewBox="0 0 1000 560"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g fill="none" stroke="#f4ecd8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M70 170l5 11 12 2-9 8 3 12-11-6-11 6 3-12-9-8 12-2zM930 140l5 11 12 2-9 8 3 12-11-6-11 6 3-12-9-8 12-2zM140 330l4 8 9 2-7 6 2 9-8-4-8 4 2-9-7-6 9-2z" />
          <circle cx="880" cy="440" r="22" />
          <path d="M873 464h14M875 472h10M880 412v-10M858 420l-8-6M902 420l8-6" />
        </g>
        <text
          x="760"
          y="330"
          fontFamily="Caveat, cursive"
          fontSize="34"
          fill="#f4ecd8"
          transform="rotate(5 760 330)"
        >
          a² + b² = c²
        </text>
      </svg>

      {/* ============================================================ */}
      {/* 1. HEADER ATAS (LOGO, CHIP GURU, TOMBOL KELUAR)              */}
      {/* ============================================================ */}
      <header className="relative z-20 h-14 sm:h-16 shrink-0 flex items-center justify-between px-4 sm:px-8 bg-[#0a2016]/60 border-b-2 border-white/10 text-[#f4ecd8]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 font-black text-xl sm:text-2xl tracking-wide select-none">
          <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#f4ecd8]" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 11c7-3 14-1 19 4v26c-5-5-12-7-19-4zM43 11c-7-3-14-1-19 4v26c5-5 12-7 19-4z" />
            <path d="M10 19h8M10 26h8M30 19h8M30 26h8" />
          </svg>
          <span className="font-['Caveat',sans-serif] text-2xl sm:text-3xl font-bold">Discere</span>
        </div>

        {/* Chip Guru & Tombol Keluar */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#fbf6e9] border border-[#e8dfc8] rounded-full py-1 px-3 text-[#163a2b] font-extrabold text-xs sm:text-sm shadow-sm">
            <span className="relative w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden shrink-0">
              <AvatarSvg name="Guru" size={28} />
              <i className="absolute right-0 bottom-0 w-2 h-2 rounded-full bg-[#4cc36b] border border-[#fbf6e9]" />
            </span>
            <span>Guru</span>
          </div>

          {onKembali && (
            <button
              onClick={onKembali}
              type="button"
              className="flex items-center gap-1.5 bg-[#f4ecd8] hover:bg-[#fff9eb] active:scale-95 text-[#163a2b] font-extrabold text-xs py-1.5 px-3.5 rounded-full shadow-sm transition-all cursor-pointer"
              title="Kembali ke Dashboard / Pengaturan"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />
              </svg>
              <span>Keluar</span>
            </button>
          )}
        </div>
      </header>

      {/* RUMBAI BUNTING BENDERA 17 AGUSTUS DI BAWAH HEADER */}
      <div
        className="w-full h-5 sm:h-6 shrink-0 pointer-events-none relative z-10"
        style={{
          background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='50'%3E%3Cpath d='M0 6Q40 18 80 6' stroke='%236b4a2f' stroke-width='2' fill='none'/%3E%3Cpath d='M6 9l28 5-14 30z' fill='%23c8362f'/%3E%3Cpath d='M46 14l28-5-14 30z' fill='%23f6f1e6'/%3E%3C/svg%3E") repeat-x`,
          backgroundSize: '48px 30px',
        }}
        aria-hidden="true"
      />

      {/* ============================================================ */}
      {/* 2. KONTEN UTAMA: RUANG TUNGGU GURU (HALL & DENAH KELAS)       */}
      {/* ============================================================ */}
      <main className="relative z-10 flex-1 min-h-0 w-full max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex flex-col overflow-hidden">
        {/* HERO: JAM PASIR & JUDUL RUANG TUNGGU & COUNTER SISWA */}
        <div className="shrink-0 flex items-center gap-3 sm:gap-4 mb-2 sm:mb-3">
          {/* Jam Pasir Animasi */}
          <svg className="w-10 h-14 sm:w-12 sm:h-16 overflow-visible select-none shrink-0" viewBox="0 0 120 160" aria-hidden="true">
            <defs>
              <clipPath id="sandClipGuru">
                <path d="M26 18H94C94 48 66 62 64 80C66 98 94 112 94 142H26C26 112 54 98 56 80C54 62 26 48 26 18Z" />
              </clipPath>
            </defs>
            <g className="anim-flip">
              <path
                d="M26 18H94C94 48 66 62 64 80C66 98 94 112 94 142H26C26 112 54 98 56 80C54 62 26 48 26 18Z"
                fill="rgba(255,255,255,0.14)"
              />
              <g clipPath="url(#sandClipGuru)">
                <rect className="anim-stm" x="58.7" y="80" width="2.6" height="62" fill="#f2c230" />
                <rect className="anim-s1" x="20" y="18" width="80" height="38" fill="#f2c230" />
                <rect className="anim-s2" x="20" y="104" width="80" height="38" fill="#f2c230" />
              </g>
              <path
                d="M35 28Q37 44 47 55M85 132Q83 116 73 105"
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.45"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M26 18H94C94 48 66 62 64 80C66 98 94 112 94 142H26C26 112 54 98 56 80C54 62 26 48 26 18Z"
                fill="none"
                stroke="#f4ecd8"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              <rect x="14" y="6" width="92" height="13" rx="6" fill="#8b6a4a" stroke="#6f5238" strokeWidth="2" />
              <rect x="14" y="141" width="92" height="13" rx="6" fill="#8b6a4a" stroke="#6f5238" strokeWidth="2" />
            </g>
          </svg>

          {/* Teks Judul & Subtitle */}
          <div className="flex-1 min-w-0">
            <h1 className="hand text-2xl sm:text-4xl lg:text-5xl text-[#f4ecd8] drop-shadow-md leading-none">
              Ruang <span className="text-[#f2c230]">Tunggu</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#f4ecd8]/90 font-semibold mt-0.5 truncate">
              Siswa masuk lewat QR atau token PIN, lalu guru menekan Mulai.
            </p>
          </div>

          {/* Badge Lingkaran Jumlah Siswa */}
          <div
            className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-[#f4ecd8]/60 grid place-items-center text-center p-1"
            aria-live="polite"
          >
            <b className="hand text-xl sm:text-2xl font-bold leading-none text-[#f4ecd8]">
              {daftarPeserta.length}
              {maxPeserta ? `/${maxPeserta}` : ''}
            </b>
            <small className="text-[9px] sm:text-[10px] font-extrabold text-[#f4ecd8]/80 leading-none">
              siswa
            </small>
          </div>
        </div>

        {/* 2 KOLOM UTAMA: LEMBAR UNDANGAN DI KIRI (STATIS) & DENAH KELAS DI KANAN */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr] gap-3 sm:gap-5 items-stretch">
          {/* KOLOM KIRI: LEMBAR UNDANGAN (SHEET DENGAN SOLASI KUNING - STATIS) */}
          <section className="sheet shrink-0 flex flex-col justify-between self-start max-w-[270px] w-full mx-auto md:mx-0 select-none" aria-label="Undangan masuk">
            <small className="block font-extrabold text-[10px] sm:text-xs text-[#5a6f62] uppercase tracking-wider mb-0.5">
              Scan untuk masuk ruangan
            </small>

            {/* Kotak QR Code (Bisa diklik untuk zoom ke kelas) */}
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              className="block w-28 h-28 sm:w-32 sm:h-32 mx-auto my-1 p-1 bg-white border-2 sm:border-3 border-[#163a2b] rounded-2xl cursor-zoom-in shadow-md hover:scale-102 transition-transform shrink-0"
              title="Perbesar QR untuk proyektor kelas"
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Token ${token}`}
                  className="w-full h-full object-contain block"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-xs font-bold text-[#5a6f62]">
                  <span>Pindai QR</span>
                  <span className="font-mono text-xs mt-1">PIN {token}</span>
                </div>
              )}
            </button>

            {/* Garis putus-putus pembatas kupon */}
            <div className="border-t-2 border-dashed border-[#1f4a37]/30 my-0.5" />

            <small className="block font-extrabold text-[10px] sm:text-xs text-[#5a6f62]">atau ketik token</small>

            {/* Token PIN Besar Caveat */}
            <span className="hand block text-4xl sm:text-5xl font-bold tracking-widest text-[#163a2b] my-0.5 leading-none">
              {token}
            </span>

            {/* Tombol Salin Token & Tampilkan ke Kelas */}
            <div className="flex flex-wrap justify-center gap-1.5 my-1">
              <button
                type="button"
                onClick={handleCopyToken}
                className="bg-[#163a2b] hover:bg-[#1f4a37] text-[#f4ecd8] font-black text-xs py-1 px-3 rounded-full shadow-sm cursor-pointer active:scale-95 transition-all"
              >
                Salin token
              </button>
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                className="bg-transparent hover:bg-[#163a2b]/10 text-[#163a2b] border-2 border-[#163a2b] font-black text-xs py-0.5 px-2.5 rounded-full cursor-pointer active:scale-95 transition-all"
              >
                Tampilkan ke kelas
              </button>
            </div>

            {/* Meta Info Game */}
            <div className="flex items-center justify-center gap-1.5 font-extrabold text-xs text-[#163a2b] pt-1 border-t border-[#1f4a37]/15">
              <svg className="w-4 h-4 text-[#1f4a37]" viewBox="0 0 48 48">
                <path fill="currentColor" d="M14 14h20c7 0 10 6 11 14 .6 5-2 8-6 6l-5-4H14l-5 4c-4 2-6.6-1-6-6 1-8 4-14 11-14z" />
                <g stroke="#fbf6e9" strokeWidth="3" strokeLinecap="round">
                  <path d="M13 21v6M10 24h6" />
                </g>
                <circle cx="31" cy="22" r="2" fill="#fbf6e9" />
                <circle cx="36" cy="26" r="2" fill="#fbf6e9" />
              </svg>
              <span className="truncate max-w-[200px]">{metaText}</span>
            </div>
          </section>

          {/* KOLOM KANAN: DENAH KELAS & DAFTAR SISWA (HANYA BAGIAN INI YANG BISA DI-SCROLL) */}
          <section className="denah flex-1 min-h-0 flex flex-col overflow-hidden" aria-label="Denah kelas">
            <div className="shrink-0 flex items-baseline justify-between gap-2 mb-2 pb-1 border-b border-white/10">
              <h2 className="hand text-2xl sm:text-3xl text-[#f4ecd8] flex items-baseline gap-2">
                <span>Denah Kelas</span>
                <span className="font-['Nunito'] text-xs font-bold text-[#f4ecd8]/70">({daftarPeserta.length} siswa)</span>
              </h2>
              <small className="font-['Nunito'] text-xs font-bold text-[#f4ecd8]/75">
                Klik tanda × untuk mengeluarkan siswa
              </small>
            </div>

            {/* Grid Bangku Kelas (Dibungkus desks-wrap custom-scrollbar agar scroll mandiri) */}
            <div className="desks-wrap custom-scrollbar">
              <div className="desks">
                {daftarPeserta.map((p) => {
                  const isAsking = askingId === p.id;

                  if (isAsking) {
                    return (
                      <div key={p.id} className="dk ask">
                        <span className="relative w-9 h-9 rounded-full overflow-hidden shrink-0">
                          <AvatarSvg name={p.nama} size={36} />
                        </span>
                        <b className="text-xs truncate max-w-full">{p.nama}</b>
                        <span className="text-[11px] font-extrabold text-[#c8362f] text-center leading-tight">
                          Keluarkan dari ruangan?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleKickConfirm(p.id, p.nama)}
                          className="w-full bg-[#c8362f] hover:bg-[#a6251f] text-white font-extrabold text-xs py-1 px-2 rounded-full shadow-sm cursor-pointer"
                        >
                          Keluarkan
                        </button>
                        <button
                          type="button"
                          onClick={() => setAskingId(null)}
                          className="w-full bg-white hover:bg-gray-100 text-[#163a2b] border border-[#e8dfc8] font-extrabold text-[11px] py-0.5 px-2 rounded-full cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div key={p.id} className="dk">
                      <button
                        type="button"
                        onClick={() => setAskingId(p.id)}
                        className="kick"
                        aria-label={`Keluarkan ${p.nama}`}
                        title="Keluarkan"
                      >
                        ×
                      </button>
                      <span className="relative w-11 h-11 rounded-full overflow-hidden shrink-0">
                        <AvatarSvg name={p.nama} size={44} />
                        <i className="absolute right-0 bottom-0 w-2.5 h-2.5 rounded-full bg-[#4cc36b] border-2 border-[#fbf6e9]" />
                      </span>
                      <b className="text-xs sm:text-sm font-extrabold truncate max-w-[90%] text-center">
                        {p.nama}
                      </b>
                      {/* Catatan: Sesuai instruksi, label 'Masuk 13:32' ditiadakan */}
                    </div>
                  );
                })}

                {/* Bangku Kosong Placeholder */}
                {Array.from({ length: emptyDesksCount }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="dk ph">
                    <span>Bangku kosong</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bagian Siswa yang Dikeluarkan (Bisa Diizinkan Kembali) */}
            {kickedList.length > 0 && (
              <div className="shrink-0 mt-2 pt-2 border-t border-dashed border-[#f4ecd8]/30">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#f4ecd8]/80 mb-1">
                  Dikeluarkan ({kickedList.length})
                </h3>
                <ul className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto custom-scrollbar">
                  {kickedList.map((k) => (
                    <li
                      key={k.id}
                      className="flex items-center gap-1.5 bg-[#f4ecd8]/15 border border-[#f4ecd8]/25 rounded-full py-0.5 px-2 text-xs font-bold text-[#f4ecd8]"
                    >
                      <span className="w-4 h-4 rounded-full overflow-hidden shrink-0">
                        <AvatarSvg name={k.nama} size={16} />
                      </span>
                      <span className="truncate max-w-[100px]">{k.nama}</span>
                      <button
                        type="button"
                        onClick={() => handleIzinkanKembali(k.id, k.nama)}
                        className="text-[#f2c230] hover:underline font-black cursor-pointer text-[11px] ml-0.5"
                      >
                        Izinkan lagi
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ============================================================ */}
      {/* 3. LANTAI KAYU BAWAH (STATUS PILL, KUNCI RUANGAN, MULAI GAME)*/}
      {/* ============================================================ */}
      <footer className="floor">
        <div className="pill" role="status">
          <span className="spin shrink-0" />
          <span className="truncate">{statusText}</span>
        </div>

        <button
          type="button"
          onClick={() => setLocked(!locked)}
          className={`lk ${locked ? 'on' : ''}`}
          aria-pressed={locked}
        >
          {locked ? 'Buka kunci' : 'Kunci ruangan'}
        </button>

        <button
          type="button"
          disabled={daftarPeserta.length < minPeserta || isStarting}
          onClick={onMulai}
          className="start"
        >
          {isStarting ? 'Memulai Permainan…' : 'Mulai Game'}
        </button>
      </footer>

      {/* ============================================================ */}
      {/* 4. MODAL ZOOM QR & PIN BESAR (UNTUK PROYEKTOR KELAS)        */}
      {/* ============================================================ */}
      {zoomOpen && (
        <div
          role="dialog"
          aria-label="QR masuk ruangan"
          onClick={() => setZoomOpen(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-4 bg-[#0a2016]/95 text-[#f4ecd8] text-center cursor-zoom-out animate-[fadeIn_0.2s_ease-out]"
        >
          <div className="w-[min(72vmin,480px)] aspect-square p-4 bg-white rounded-3xl shadow-2xl flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Token ${token}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-xl font-bold text-[#163a2b]">Kode PIN: {token}</div>
            )}
          </div>
          <div className="hand text-6xl sm:text-8xl tracking-widest text-[#f2c230] leading-none">
            {token}
          </div>
          <small className="text-xs sm:text-sm font-semibold opacity-75">
            Ketuk di mana saja atau tekan Escape untuk menutup
          </small>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. TOAST NOTIFIKASI DI BAWAH                                */}
      {/* ============================================================ */}
      {toastText && (
        <div
          role="status"
          className="fixed left-1/2 bottom-24 -translate-x-1/2 z-50 flex items-center gap-3 py-2.5 px-4 bg-[#163a2b] text-[#f4ecd8] border border-white/20 rounded-2xl font-bold text-xs sm:text-sm shadow-xl max-w-[90%]"
        >
          <span>{toastText}</span>
          {toastUndoAction && (
            <button
              type="button"
              onClick={() => {
                toastUndoAction();
                setToastText(null);
                setToastUndoAction(null);
              }}
              className="text-[#f2c230] hover:underline font-black text-xs cursor-pointer ml-1"
            >
              Batalkan
            </button>
          )}
        </div>
      )}
    </div>
  );
}
