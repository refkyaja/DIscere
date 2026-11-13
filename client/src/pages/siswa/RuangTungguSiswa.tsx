import { useState, useEffect, useMemo, useRef } from 'react';
import { getSocket } from '../../lib/socket';

interface PesertaItem {
  id: string;
  nama: string;
  tim?: string | null;
}

interface TeamItem {
  id: string;
  nama: string;
  warna?: string;
  anggota: Array<{ id: string; nama: string }>;
}

export interface RuangTungguSiswaProps {
  token: string;
  nama: string;
  pesertaId: string;
  gameType: 'tarik_tambang' | 'balap_karung' | 'makan_kerupuk' | 'panjat_pinang';
  templateJudul?: string;
  config?: any;
  daftarPeserta?: PesertaItem[];
  teams?: TeamItem[];
  myTeamId?: string | null;
  onKeluar: () => void;
  onMulaiPermainan: () => void;
}

// Skema warna avatar deterministik berdasarkan nama
const AV_BG = ['#7cc6a4', '#f2c230', '#e98a7a', '#8fb8e8', '#c4a2e0', '#9ad06a', '#f0a15a', '#6fc3c9'];
const AV_SKIN = ['#f0b98d', '#e9b08a', '#f3c9a2'];
const AV_HAIR = ['#2b2019', '#3b2a22', '#1c1c24', '#5a3a22'];

function hashName(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function AvatarSvg({ name, size = 40 }: { name: string; size?: number }) {
  const h = hashName(name || 'peserta');
  const bg = AV_BG[h % AV_BG.length];
  const sk = AV_SKIN[(h >> 2) % AV_SKIN.length];
  const hr = AV_HAIR[(h >> 4) % AV_HAIR.length];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="shrink-0 rounded-full"
    >
      <circle cx="20" cy="20" r="20" fill={bg} />
      <circle cx="20" cy="22" r="11" fill={sk} />
      <path d="M8.5 20Q9 8 20 8Q31 8 31.5 20Q27 14 20 15Q13 14 8.5 20Z" fill={hr} />
      <circle cx="16" cy="23" r="1.6" fill="#222" />
      <circle cx="24" cy="23" r="1.6" fill="#222" />
      <path d="M16.5 27.5Q20 30 23.5 27.5" stroke="#7a2a24" fill="none" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function RuangTungguSiswa({
  token,
  nama,
  pesertaId,
  gameType,
  templateJudul,
  config,
  daftarPeserta = [],
  teams = [],
  myTeamId,
  onKeluar,
  onMulaiPermainan,
}: RuangTungguSiswaProps) {
  const [livePeserta, setLivePeserta] = useState<PesertaItem[]>(daftarPeserta);
  const [liveTeams, setLiveTeams] = useState<TeamItem[]>(teams);
  const [detectedMyTeam, setDetectedMyTeam] = useState<string | null>(myTeamId || null);
  const [isStarting, setIsStarting] = useState(false);
  const [statusText, setStatusText] = useState('Game akan dimulai segera…');
  const startTimerRef = useRef<any[]>([]);

  // Sinkronkan daftar peserta & tim jika props berubah
  useEffect(() => {
    if (daftarPeserta && daftarPeserta.length > 0) {
      setLivePeserta(daftarPeserta);
    }
  }, [daftarPeserta]);

  useEffect(() => {
    if (teams && teams.length > 0) {
      setLiveTeams(teams);
    }
  }, [teams]);

  useEffect(() => {
    if (myTeamId) {
      setDetectedMyTeam(myTeamId);
    }
  }, [myTeamId]);

  // Dengarkan event socket saat di ruang tunggu
  useEffect(() => {
    const socket = getSocket();

    const handleLobiUpdate = (data: any) => {
      if (Array.isArray(data.daftarPeserta)) {
        setLivePeserta(data.daftarPeserta);
      }
      if (Array.isArray(data.teams)) {
        setLiveTeams(data.teams);
      }
      if (Array.isArray(data.leaderboard)) {
        setLivePeserta((prev) => {
          const list = data.leaderboard.map((p: any) => ({
            id: p.id,
            nama: p.nama,
            tim: p.tim || null,
          }));
          return list.length > 0 ? list : prev;
        });
      }
    };

    const handleTeamsAssigned = (data: any) => {
      if (Array.isArray(data.daftarPeserta)) {
        setLivePeserta(data.daftarPeserta);
        const me = data.daftarPeserta.find((p: any) => p.id === pesertaId);
        if (me?.tim) {
          setDetectedMyTeam(me.tim);
        }
      }
    };

    const handleGameMulai = (data: any) => {
      if (data.game && data.game !== gameType) return;

      if (Array.isArray(data.daftarPeserta)) {
        setLivePeserta(data.daftarPeserta);
        const me = data.daftarPeserta.find((p: any) => p.id === pesertaId);
        if (me?.tim) setDetectedMyTeam(me.tim);
      }
      if (Array.isArray(data.teams)) {
        setLiveTeams(data.teams);
      }

      // Mulai alur pembagian tim & countdown
      jalankanTransisiMulai();
    };

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('teams_assigned', handleTeamsAssigned);
    socket.on('game:mulai', handleGameMulai);

    return () => {
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('teams_assigned', handleTeamsAssigned);
      socket.off('game:mulai', handleGameMulai);
      startTimerRef.current.forEach(clearTimeout);
    };
  }, [gameType, pesertaId]);

  // Fungsi countdown saat guru klik mulai
  const jalankanTransisiMulai = () => {
    if (isStarting) return;
    setIsStarting(true);
    setStatusText('Guru menekan Mulai! Membagi kelompok…');

    const t1 = setTimeout(() => {
      setStatusText('Game dimulai dalam 3…');
    }, 1200);

    const t2 = setTimeout(() => {
      setStatusText('Game dimulai dalam 2…');
    }, 2100);

    const t3 = setTimeout(() => {
      setStatusText('Game dimulai dalam 1…');
    }, 3000);

    const t4 = setTimeout(() => {
      setStatusText('Mulai! Bersiaplah…');
      setTimeout(() => {
        onMulaiPermainan();
      }, 500);
    }, 3800);

    startTimerRef.current = [t1, t2, t3, t4];
  };

  // Nama label mode game
  const labelModeGame = useMemo(() => {
    switch (gameType) {
      case 'tarik_tambang':
        return 'Tarik Tambang';
      case 'balap_karung':
        return 'Balap Karung';
      case 'makan_kerupuk':
        return 'Makan Kerupuk';
      case 'panjat_pinang':
        return 'Panjat Pinang';
      default:
        return 'Game Edukasi';
    }
  }, [gameType]);

  // Pengelompokan Tim
  const teamGroups = useMemo(() => {
    // 1. Jika game Tarik Tambang: selalu 2 kelompok
    if (gameType === 'tarik_tambang') {
      const namaT1 = config?.namaTim1 || 'Tim Merah';
      const namaT2 = config?.namaTim2 || 'Tim Putih';
      const anggotaMerah: PesertaItem[] = [];
      const anggotaPutih: PesertaItem[] = [];

      livePeserta.forEach((p, idx) => {
        if (p.tim === 'merah') anggotaMerah.push(p);
        else if (p.tim === 'putih') anggotaPutih.push(p);
        else {
          // Fallback round-robin jika belum di-assign
          if (idx % 2 === 0) anggotaMerah.push(p);
          else anggotaPutih.push(p);
        }
      });

      return [
        {
          id: 'merah',
          nama: namaT1,
          c: '#c8362f',
          t: '#ffffff',
          anggota: anggotaMerah,
        },
        {
          id: 'putih',
          nama: namaT2,
          c: '#1d8fe0',
          t: '#ffffff',
          anggota: anggotaPutih,
        },
      ];
    }

    // 2. Jika Balap Karung: bisa 2, 3, atau 4 kelompok sesuai config.jumlahTim
    if (gameType === 'balap_karung') {
      const jumlahKelompok: number = Number(config?.jumlahTim) || (liveTeams.length > 0 ? liveTeams.length : 3);
      const warnaTim = [
        { id: 'merah', nama: 'Tim Merah', c: '#c8362f', t: '#ffffff' },
        { id: 'kuning', nama: 'Tim Kuning', c: '#f2c230', t: '#1d3b2e' },
        { id: 'hijau', nama: 'Tim Hijau', c: '#3f9e62', t: '#ffffff' },
        { id: 'biru', nama: 'Tim Biru', c: '#1d8fe0', t: '#ffffff' },
      ];

      const defs = warnaTim.slice(0, Math.min(4, Math.max(2, jumlahKelompok)));

      return defs.map((d, k) => {
        // Ambil anggota dari liveTeams jika ada
        const foundLiveTeam = liveTeams.find((lt) => lt.id === d.id);
        let anggota = foundLiveTeam ? foundLiveTeam.anggota : [];

        // Fallback jika liveTeams belum sinkron
        if (anggota.length === 0) {
          anggota = livePeserta.filter((p, idx) => {
            if (p.tim) return p.tim === d.id;
            return idx % defs.length === k;
          });
        }

        return {
          id: d.id,
          nama: foundLiveTeam?.nama || d.nama,
          c: d.c,
          t: d.t,
          anggota,
        };
      });
    }

    // 3. Game Individu (Makan Kerupuk / Panjat Pinang)
    return [];
  }, [gameType, config, livePeserta, liveTeams]);

  // Cek tim milik user
  const timUserAktif = useMemo(() => {
    if (teamGroups.length === 0) return null;
    if (detectedMyTeam) {
      const found = teamGroups.find((tg) => tg.id === detectedMyTeam);
      if (found) return found;
    }
    // Cari dari anggota tim
    return teamGroups.find((tg) => tg.anggota.some((a) => a.id === pesertaId || a.nama === nama)) || teamGroups[0];
  }, [teamGroups, detectedMyTeam, pesertaId, nama]);

  // Pastikan user ada di list peserta tampilan
  const listPesertaTampil = useMemo(() => {
    const list = [...livePeserta];
    const exists = list.some((p) => p.id === pesertaId || p.nama === nama);
    if (!exists) {
      list.unshift({ id: pesertaId, nama, tim: detectedMyTeam });
    }
    return list;
  }, [livePeserta, pesertaId, nama, detectedMyTeam]);

  const jumlahPeserta = listPesertaTampil.length;

  return (
    <div
      className="page fixed inset-0 w-full h-full flex flex-col justify-between overflow-hidden select-none text-[#f4ecd8]"
      style={{
        background: `
          radial-gradient(ellipse 40% 14% at 22% 30%, rgba(255,255,255,0.07), transparent),
          repeating-linear-gradient(115deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 11px),
          radial-gradient(ellipse at 30% 8%, rgba(255,255,255,0.11), transparent 55%),
          radial-gradient(ellipse at 85% 75%, rgba(0,0,0,0.22), transparent 60%),
          linear-gradient(160deg, #2c5f47, #1f4a37 55%, #163a2b)
        `,
        boxShadow: 'inset 0 0 150px rgba(0,0,0,0.35)',
        fontFamily: "'Nunito', system-ui, sans-serif",
      }}
    >
      <style>{`
        html, body {
          overflow: hidden !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
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
        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }
        @keyframes popIn {
          from { transform: scale(0.85); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes ringPulse {
          from { opacity: 0.95; transform: scale(1); }
          to { opacity: 0; transform: scale(1.25); }
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
      `}</style>

      {/* DEKORASI RUMUS & BINTANG KAPUR DI LATAR BELAKANG */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-30 z-0"
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
      {/* 1. HEADER ATAS (LOGO, CHIP PENGGUNA, TOMBOL KELUAR)          */}
      {/* ============================================================ */}
      <header className="relative z-20 h-12 sm:h-14 shrink-0 flex items-center justify-between px-3.5 sm:px-6 bg-[#0a2016]/55 border-b border-white/10 text-[#f4ecd8]">
        {/* Logo */}
        <div className="flex items-center gap-2 font-black text-xl sm:text-2xl tracking-wide select-none">
          <svg className="w-6 h-6 sm:w-7 sm:h-7 text-[#f4ecd8]" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 11c7-3 14-1 19 4v26c-5-5-12-7-19-4zM43 11c-7-3-14-1-19 4v26c5-5 12-7 19-4z" />
            <path d="M10 19h8M10 26h8M30 19h8M30 26h8" />
          </svg>
          <span className="font-['Caveat',sans-serif] text-2xl sm:text-3xl font-bold">Discere</span>
          {token && (
            <span className="bg-[#f2c230] text-[#163a2b] font-mono font-black text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full shadow-sm ml-1">
              PIN {token}
            </span>
          )}
        </div>

        {/* Info Siswa & Tombol Keluar */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Chip Nama Siswa */}
          <div className="flex items-center gap-2 bg-[#fbf6e9] border border-[#e8dfc8] rounded-full py-0.5 sm:py-1 px-2.5 sm:px-3 text-[#163a2b] font-extrabold text-xs sm:text-sm shadow-sm">
            <span className="relative w-6 h-6 sm:w-7 sm:h-7 flex-none rounded-full overflow-hidden">
              <AvatarSvg name={nama} size={28} />
              <i className="absolute right-0 bottom-0 w-2 h-2 rounded-full bg-[#4cc36b] border border-[#fbf6e9]" />
            </span>
            <span className="max-w-[100px] sm:max-w-[150px] truncate">{nama}</span>
          </div>

          {/* Tombol Keluar */}
          <button
            onClick={onKeluar}
            type="button"
            className="flex items-center gap-1.5 bg-[#f4ecd8] hover:bg-[#fff9eb] active:scale-95 text-[#163a2b] font-extrabold text-xs py-1.5 px-3 sm:px-3.5 rounded-full shadow-sm transition-all cursor-pointer"
            title="Keluar dari sesi"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />
            </svg>
            <span className="hidden sm:inline">Keluar</span>
          </button>
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
      {/* 2. KONTEN UTAMA: 2 LOGIKA (MENUNGGU GURU vs MEMBAGI TIM)     */}
      {/* ============================================================ */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col lg:flex-row items-center justify-center gap-3 lg:gap-8 px-3 sm:px-6 py-1 max-w-6xl w-full mx-auto overflow-hidden">
        {/* BAGIAN KIRI / TENGAH: RUANG TUNGGU / PEMBAGIAN KELOMPOK */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center text-center my-auto">
          {!isStarting ? (
            /* ---------------------------------------------------- */
            /* LOGIKA 1: SAAT DI RUANG TUNGGU (MENUNGGU GURU KLIK)  */
            /* ---------------------------------------------------- */
            <div className="flex flex-col items-center w-full max-w-md animate-[popIn_0.4s_ease-out]">
              {/* ANIMASI JAM PASIR KAPUR BERPUTAR */}
              <svg className="w-12 sm:w-16 h-16 sm:h-20 mb-0.5 sm:mb-1 overflow-visible select-none shrink-0" viewBox="0 0 120 160" aria-hidden="true">
                <defs>
                  <clipPath id="sandClip">
                    <path d="M26 18H94C94 48 66 62 64 80C66 98 94 112 94 142H26C26 112 54 98 56 80C54 62 26 48 26 18Z" />
                  </clipPath>
                </defs>
                <g className="anim-flip">
                  {/* Kaca Jam Pasir Transparan */}
                  <path
                    d="M26 18H94C94 48 66 62 64 80C66 98 94 112 94 142H26C26 112 54 98 56 80C54 62 26 48 26 18Z"
                    fill="rgba(255,255,255,0.14)"
                  />
                  {/* Butiran Pasir Kuning Beranimasi */}
                  <g clipPath="url(#sandClip)">
                    <rect className="anim-stm" x="58.7" y="80" width="2.6" height="62" fill="#f2c230" />
                    <rect className="anim-s1" x="20" y="18" width="80" height="38" fill="#f2c230" />
                    <rect className="anim-s2" x="20" y="104" width="80" height="38" fill="#f2c230" />
                  </g>
                  {/* Kilau Kaca */}
                  <path
                    d="M35 28Q37 44 47 55M85 132Q83 116 73 105"
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity="0.45"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {/* Garis Tepi Kaca */}
                  <path
                    d="M26 18H94C94 48 66 62 64 80C66 98 94 112 94 142H26C26 112 54 98 56 80C54 62 26 48 26 18Z"
                    fill="none"
                    stroke="#f4ecd8"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  {/* Bingkai Kayu Atas & Bawah Jam Pasir */}
                  <rect x="14" y="6" width="92" height="13" rx="6" fill="#8b6a4a" stroke="#6f5238" strokeWidth="2" />
                  <rect x="14" y="141" width="92" height="13" rx="6" fill="#8b6a4a" stroke="#6f5238" strokeWidth="2" />
                </g>
              </svg>

              {/* Judul Font Tangan */}
              <h1 className="font-['Caveat',sans-serif] text-2xl sm:text-4xl lg:text-5xl font-bold text-[#f4ecd8] drop-shadow-md leading-tight">
                Menunggu <span className="text-[#f2c230]">Guru…</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#f4ecd8]/90 font-semibold mt-0.5 mb-2 sm:mb-2.5 max-w-md">
                Game akan dimulai setelah guru menekan tombol mulai.
              </p>

              {/* Kotak Info: Peserta & Mode Game */}
              <div className="w-full max-w-xs sm:max-w-sm grid grid-cols-2 bg-[#fbf6e9] border-2 sm:border-[3px] border-[#e8dfc8] rounded-2xl p-2 sm:p-2.5 text-[#163a2b] shadow-[0_4px_0_rgba(0,0,0,0.2)]">
                {/* Kolom Peserta */}
                <div className="flex flex-col items-center gap-0.5 border-r-2 border-[#1f4a37]/20 pr-1.5">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#1f4a37]" viewBox="0 0 48 48" fill="currentColor">
                    <circle cx="24" cy="15" r="7" />
                    <path d="M11 40q0-13 13-13t13 13z" />
                    <g opacity="0.65">
                      <circle cx="9" cy="19" r="5" />
                      <circle cx="39" cy="19" r="5" />
                      <path d="M0 38q0-10 8-10l3 12zM48 38q0-10-8-10l-3 12z" />
                    </g>
                  </svg>
                  <small className="font-bold text-[10px] sm:text-xs text-[#5a6f62]">Peserta</small>
                  <b className="text-sm sm:text-lg font-black">{jumlahPeserta} siswa</b>
                </div>

                {/* Kolom Mode Game */}
                <div className="flex flex-col items-center gap-0.5 pl-1.5">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#1f4a37]" viewBox="0 0 48 48">
                    <path fill="currentColor" d="M14 14h20c7 0 10 6 11 14 .6 5-2 8-6 6l-5-4H14l-5 4c-4 2-6.6-1-6-6 1-8 4-14 11-14z" />
                    <g stroke="#fbf6e9" strokeWidth="3" strokeLinecap="round">
                      <path d="M13 21v6M10 24h6" />
                    </g>
                    <circle cx="31" cy="22" r="2" fill="#fbf6e9" />
                    <circle cx="36" cy="26" r="2" fill="#fbf6e9" />
                  </svg>
                  <small className="font-bold text-[10px] sm:text-xs text-[#5a6f62]">Mode Game</small>
                  <b className="text-xs sm:text-sm font-black truncate max-w-[120px]" title={templateJudul || labelModeGame}>
                    {labelModeGame}
                  </b>
                </div>
              </div>
            </div>
          ) : (
            /* ---------------------------------------------------- */
            /* LOGIKA 2: KETIKA GURU KLIK MULAI (MEMBAGI KELOMPOK)  */
            /* ---------------------------------------------------- */
            <div className="w-full flex flex-col items-center animate-[popIn_0.35s_ease-out]">
              {teamGroups.length > 0 ? (
                <>
                  <h2 className="font-['Caveat',sans-serif] text-3xl sm:text-5xl font-bold text-[#f4ecd8] drop-shadow-md leading-tight">
                    {timUserAktif ? (
                      <>
                        Kamu di <span className="text-[#f2c230]">{timUserAktif.nama}!</span>
                      </>
                    ) : (
                      <>
                        Membagi <span className="text-[#f2c230]">kelompok…</span>
                      </>
                    )}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#f4ecd8]/90 font-semibold mt-0.5 mb-2 max-w-lg">
                    {timUserAktif
                      ? `Namamu sudah masuk ke ${timUserAktif.nama}. Siap-siap, game segera dimulai!`
                      : `Nama peserta sedang dibagi rata ke ${teamGroups.length} kelompok.`}
                  </p>

                  {/* GRID KARTU KELOMPOK (SESUAI JUMLAH KELOMPOK: 2, 3, ATAU 4 TIM) */}
                  <div
                    className={`grid gap-2.5 sm:gap-3 w-full text-left ${
                      teamGroups.length === 2
                        ? 'grid-cols-1 md:grid-cols-2 max-w-xl'
                        : teamGroups.length === 3
                          ? 'grid-cols-1 md:grid-cols-3 max-w-3xl'
                          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl'
                    }`}
                  >
                    {teamGroups.map((team) => {
                      const isMyTeam = timUserAktif?.id === team.id;

                      return (
                        <article
                          key={team.id}
                          className={`relative bg-[#fbf6e9] border-2 sm:border-[3px] border-[#e8dfc8] rounded-2xl overflow-hidden text-[#163a2b] shadow-sm transition-all ${
                            isMyTeam
                              ? 'ring-3 ring-[#f2c230] shadow-[0_0_20px_rgba(242,194,48,0.5)] -translate-y-0.5'
                              : 'opacity-85'
                          }`}
                        >
                          {/* Header Kartu Tim */}
                          <div
                            className="flex items-center justify-between gap-1.5 px-3 py-1.5 font-black text-xs"
                            style={{ backgroundColor: team.c, color: team.t }}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M5 3v18M5 4h13l-3 4 3 4H5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              </svg>
                              <h3 className="font-['Caveat',sans-serif] text-xl font-bold truncate leading-none">
                                {team.nama}
                              </h3>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[11px] bg-black/20 px-1.5 py-0.2 rounded-full font-extrabold">
                                {team.anggota.length}
                              </span>
                              {isMyTeam && (
                                <span className="bg-[#f2c230] text-[#163a2b] text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-sm">
                                  Timmu
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Daftar Anggota di Kelompok Ini */}
                          <div className="p-2 flex flex-wrap gap-1.5 min-h-[50px] max-h-[110px] sm:max-h-[150px] overflow-y-auto content-start">
                            {team.anggota.length > 0 ? (
                              team.anggota.map((member, mIdx) => {
                                const isSelf = member.id === pesertaId || member.nama === nama;
                                return (
                                  <span
                                    key={member.id || mIdx}
                                    className={`relative inline-flex items-center gap-1 bg-[#fffdf6] border rounded-full py-0.5 px-2 text-[11px] font-black text-[#163a2b] shadow-xs ${
                                      isSelf
                                        ? 'bg-gradient-to-r from-[#ffe88a] to-[#f2c230] border-[#c79a14] ring-1 ring-[#f2c230]'
                                        : 'border-[#e8dfc8]'
                                    }`}
                                  >
                                    <AvatarSvg name={member.nama} size={20} />
                                    <span className="truncate max-w-[80px]">{member.nama}</span>
                                    {isSelf && (
                                      <b className="bg-[#c8362f] text-white text-[8px] px-1 py-0.2 rounded-full font-black">
                                        Kamu
                                      </b>
                                    )}
                                  </span>
                                );
                              })
                            ) : (
                              <p className="text-[11px] text-[#5a6f62] italic m-auto">Menunggu anggota…</p>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Jika game individu (Makan Kerupuk / Panjat Pinang) */
                <div className="flex flex-col items-center">
                  <h2 className="font-['Caveat',sans-serif] text-4xl sm:text-5xl font-bold text-[#f4ecd8] drop-shadow-md leading-tight">
                    Bersiap! <span className="text-[#f2c230]">Game Dimulai…</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-[#f4ecd8]/90 font-semibold mt-1 mb-3">
                    Semua peserta sudah siap di arena {labelModeGame}!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* PANEL SAMPING: DAFTAR PESERTA YANG SUDAH BERGABUNG           */}
        {/* ============================================================ */}
        {!isStarting && (
          <aside className="w-full lg:w-64 xl:w-72 bg-[#fbf6e9] border-2 sm:border-[3px] border-[#e8dfc8] rounded-2xl p-2.5 sm:p-3 text-[#163a2b] shadow-[0_4px_0_rgba(0,0,0,0.2)] max-h-[140px] sm:max-h-[180px] lg:max-h-[260px] xl:max-h-[300px] flex flex-col shrink-0 animate-[popIn_0.4s_ease-out]">
            {/* Header Panel */}
            <div className="flex items-center gap-1.5 border-b border-[#1f4a37]/15 pb-1.5 px-1 mb-1.5 shrink-0">
              <svg className="w-4 h-4 text-[#1f4a37]" viewBox="0 0 48 48" fill="currentColor">
                <circle cx="24" cy="15" r="7" />
                <path d="M11 40q0-13 13-13t13 13z" />
              </svg>
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide">Daftar Peserta ({jumlahPeserta})</h2>
            </div>

            {/* List Peserta */}
            <ul className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
              {listPesertaTampil.map((p, idx) => {
                const isMe = p.id === pesertaId || p.nama === nama;
                return (
                  <li
                    key={p.id || idx}
                    className={`flex items-center gap-2 p-1 rounded-lg font-bold text-xs transition-all ${
                      isMe ? 'bg-[#1f4a37]/15 font-black text-[#163a2b]' : 'hover:bg-[#1f4a37]/5'
                    }`}
                  >
                    <div className="relative w-6 h-6 shrink-0 rounded-full overflow-hidden">
                      <AvatarSvg name={p.nama} size={24} />
                      <i className="absolute right-0 bottom-0 w-1.5 h-1.5 rounded-full bg-[#4cc36b] border border-[#fbf6e9]" />
                    </div>
                    <span className="truncate flex-1">{p.nama}</span>
                    {isMe && (
                      <span className="text-[9px] font-black bg-[#1f4a37] text-[#f4ecd8] px-1.5 py-0.2 rounded-full">
                        Kamu
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </main>

      {/* ============================================================ */}
      {/* 3. LANTAI KAYU BAWAH (FLOOR) & STATUS PILL BERPUTAR          */}
      {/* ============================================================ */}
      <footer className="relative z-20 h-11 sm:h-13 shrink-0 grid place-items-center bg-[linear-gradient(#b99672_0_5px,transparent_5px),repeating-linear-gradient(90deg,#8b6a4a_0_118px,#7a5b3e_118px_120px)] border-t-2 sm:border-t-[3px] border-[#6f5238]">
        <div
          role="status"
          className="flex items-center gap-2.5 bg-[#163a2b] text-[#f4ecd8] font-bold text-xs sm:text-sm py-1.5 px-4 sm:px-6 rounded-full shadow-[0_3px_0_rgba(0,0,0,0.3)] max-w-[90%]"
        >
          <span className="w-4 h-4 border-2 border-[#f4ecd8]/30 border-t-[#f2c230] rounded-full animate-spin shrink-0" />
          <span className="truncate">{statusText}</span>
        </div>
      </footer>
    </div>
  );
}

