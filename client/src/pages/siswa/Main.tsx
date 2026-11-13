import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams, Link } from 'react-router';
import { getSocket } from '../../lib/socket';
import MainKerupuk from './MainKerupuk';
import MainPanjatPinang from './MainPanjatPinang';
import MainBalapKarung from './MainBalapKarung';
import MainTarikTambang from './MainTarikTambang';
import {
  ShieldAlert,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

export default function MainSiswa() {
  const { kode } = useParams<{ kode?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const tokenAwal = (kode || searchParams.get('token') || '').trim();

  // Form states
  const [tokenInput, setTokenInput] = useState(tokenAwal);
  const [namaInput, setNamaInput] = useState(searchParams.get('nama') || '');
  const [formError, setFormError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinStep, setJoinStep] = useState<'PIN' | 'NAMA'>(
    tokenAwal.length === 6 ? 'NAMA' : 'PIN'
  );

  // Session states
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pesertaId, setPesertaId] = useState<string | null>(null);
  const [panjatSecret, setPanjatSecret] = useState<string>('');
  const [namaPeserta, setNamaPeserta] = useState<string>('');
  const [templateJudul, setTemplateJudul] = useState<string>('');
  const [gameType, setGameType] = useState<'tarik_tambang' | 'makan_kerupuk' | 'panjat_pinang' | 'balap_karung'>('tarik_tambang');
  const [kerupukState, setKerupukState] = useState<any>(undefined);
  const [kerupukLeaderboard, setKerupukLeaderboard] = useState<any[]>([]);
  const [kerupukSoalAktif, setKerupukSoalAktif] = useState<any>(null);
  const [panjatConfig, setPanjatConfig] = useState<any>(undefined);
  const [panjatState, setPanjatState] = useState<any>(undefined);
  const [panjatLeaderboard, setPanjatLeaderboard] = useState<any[]>([]);
  const [panjatSoalAktif, setPanjatSoalAktif] = useState<any>(null);
  const [balapConfig, setBalapConfig] = useState<any>(undefined);
  const [balapState, setBalapState] = useState<any>(undefined);
  const [balapLeaderboard, setBalapLeaderboard] = useState<any[]>([]);
  const [balapTeams, setBalapTeams] = useState<any[]>([]);
  const [balapSoalAktif, setBalapSoalAktif] = useState<any>(null);
  const [tarikJoinData, setTarikJoinData] = useState<{
    config?: any;
    tim?: 'merah' | 'putih' | null;
    taliPosition?: number;
    skorMerah?: number;
    skorPutih?: number;
    matchEndsAt?: number | null;
    daftarPeserta?: any[];
    soalAktif?: any;
    powerUpTim?: any;
    pesertaStat?: any;
    hasil?: any;
  } | undefined>(undefined);
  const [stage, setStage] = useState<'GABUNG' | 'LOBBY' | 'PLAYING' | 'SELESAI'>('GABUNG');

  const terapkanHasilGabung = useCallback(
    (res: any, namaDipakai: string, tokenDipakai: string, fallbackSecret?: string) => {
      if (!res?.success) return;

      sessionStorage.setItem('discere_multi_token', tokenDipakai);
      sessionStorage.setItem('discere_multi_peserta_id', res.pesertaId!);
      sessionStorage.setItem('discere_multi_nama', namaDipakai);
      if (res.pesertaSecret) {
        sessionStorage.setItem('discere_multi_peserta_secret', res.pesertaSecret);
        setPanjatSecret(res.pesertaSecret);
      } else if (fallbackSecret) {
        setPanjatSecret(fallbackSecret);
      }

      setSessionId(res.sessionId!);
      setPesertaId(res.pesertaId!);
      setNamaPeserta(namaDipakai);
      setTokenInput(tokenDipakai);
      setTemplateJudul(res.templateJudul || '');

      // Perbarui URL browser ke /join/:token agar user melihat PIN di address bar tanpa unmount
      if (tokenDipakai && typeof window !== 'undefined' && window.location.pathname !== `/join/${tokenDipakai}`) {
        window.history.replaceState(null, '', `/join/${tokenDipakai}`);
      }

      if (res.game === 'makan_kerupuk') {
        setGameType('makan_kerupuk');
        setKerupukState(res.peserta);
        setKerupukLeaderboard(res.leaderboard || []);
        setKerupukSoalAktif(res.soalAktif || null);
      } else if (res.game === 'panjat_pinang') {
        setGameType('panjat_pinang');
        setPanjatConfig(res.config);
        setPanjatState(res.peserta);
        setPanjatLeaderboard(res.leaderboard || []);
        setPanjatSoalAktif(res.soalAktif || null);
      } else if (res.game === 'balap_karung') {
        setGameType('balap_karung');
        setBalapConfig(res.config);
        setBalapState(res.peserta);
        setBalapLeaderboard(res.leaderboard || []);
        setBalapTeams(res.teams || []);
        setBalapSoalAktif(res.soalAktif || null);
      } else {
        setGameType('tarik_tambang');
        setTarikJoinData({
          config: res.config,
          tim: res.tim ?? null,
          taliPosition: res.taliPosition ?? 0,
          skorMerah: res.skorMerah ?? 0,
          skorPutih: res.skorPutih ?? 0,
          matchEndsAt: res.matchEndsAt ?? null,
          daftarPeserta: res.daftarPeserta || [],
          soalAktif: res.soalAktif || null,
          powerUpTim: res.powerUpTim || { bank: null, aktifBerikutnya: null },
          pesertaStat: res.pesertaStat || {
            totalBenar: 0,
            totalSalah: 0,
            jumlahJawab: 0,
            akurasiPersen: 0,
            streakSaatIni: 0,
            streakTertinggi: 0,
          },
          hasil: res.hasil || null,
        });
      }

      if (res.status === 'jalan') {
        setStage('PLAYING');
      } else if (res.status === 'selesai') {
        setStage('SELESAI');
      } else {
        setStage('LOBBY');
      }
    },
    []
  );

  // Otomatis Reconnect jika ada session tersimpan di sessionStorage
  useEffect(() => {
    const savedToken = sessionStorage.getItem('discere_multi_token');
    const savedPesertaId = sessionStorage.getItem('discere_multi_peserta_id');
    const savedNama = sessionStorage.getItem('discere_multi_nama');
    const savedSecret = sessionStorage.getItem('discere_multi_peserta_secret') || undefined;

    if (savedToken && savedPesertaId && savedNama) {
      const socket = getSocket();
      socket.emit(
        'sesi:gabung',
        { token: savedToken, nama: savedNama, pesertaId: savedPesertaId, pesertaSecret: savedSecret },
        (res: any) => {
          terapkanHasilGabung(res, savedNama, savedToken, savedSecret);
        }
      );
    }
  }, [terapkanHasilGabung]);

  // Handler: Siswa Submit PIN (Langkah 1)
  const handleNextToName = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const clean = tokenInput.trim().replace(/\D/g, '');
    if (!clean || clean.length !== 6) {
      setFormError('Kode PIN harus terdiri dari 6 angka.');
      return;
    }
    setTokenInput(clean);
    setJoinStep('NAMA');
  };

  // Handler: Siswa Submit Form Gabung (Langkah 2)
  const handleGabung = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanToken = tokenInput.trim().toUpperCase();
    const cleanNama = namaInput.trim();

    if (!cleanToken || cleanToken.length !== 6) {
      setJoinStep('PIN');
      setFormError('Kode PIN harus terdiri dari 6 angka.');
      return;
    }

    if (!cleanNama) {
      setFormError('Nama panggilan wajib diisi.');
      return;
    }

    setIsJoining(true);
    const socket = getSocket();

    socket.emit(
      'sesi:gabung',
      { token: cleanToken, nama: cleanNama },
      (res: {
        success: boolean;
        pesan?: string;
        pesertaId?: string;
        sessionId?: string;
        templateJudul?: string;
        status?: string;
        tim?: 'merah' | 'putih' | null;
        taliPosition?: number;
        skorMerah?: number;
        skorPutih?: number;
        soalAktif?: any;
      }) => {
        setIsJoining(false);
        if (!res?.success) {
          setFormError(res?.pesan || 'Gagal bergabung ke sesi.');
          return;
        }

        terapkanHasilGabung(res, cleanNama, cleanToken);
      }
    );
  };

  // Handler: Siswa Keluar dari Sesi
  const handleKeluar = (pesanError?: string) => {
    // Beritahu server bahwa siswa keluar sukarela agar host dan lobi langsung mengupdate daftar
    if (sessionId && pesertaId) {
      try {
        const socket = getSocket();
        socket.emit('sesi:peserta_keluar', { sessionId, pesertaId, pesertaSecret: panjatSecret });
      } catch {
        // abaikan error socket disconnect
      }
    }

    sessionStorage.removeItem('discere_multi_token');
    sessionStorage.removeItem('discere_multi_peserta_id');
    sessionStorage.removeItem('discere_multi_nama');
    sessionStorage.removeItem('discere_multi_peserta_secret');
    if (typeof window !== 'undefined' && window.location.pathname !== '/join') {
      window.history.replaceState(null, '', '/join');
    }
    setStage('GABUNG');
    setJoinStep('PIN');
    setTokenInput('');
    setNamaPeserta('');
    setFormError(pesanError || null);
    setSearchParams({});
    setSessionId(null);
    setPesertaId(null);
    setPanjatSecret('');
    setPanjatConfig(undefined);
    setPanjatState(undefined);
    setPanjatLeaderboard([]);
    setPanjatSoalAktif(null);
    setBalapConfig(undefined);
    setBalapState(undefined);
    setBalapLeaderboard([]);
    setBalapTeams([]);
    setBalapSoalAktif(null);
    setTarikJoinData(undefined);
  };

  // ==========================================
  // RENDER STAGE 1: FORM GABUNG (DESAIN PAPAN TULIS FULL LAYAR MURNI CSS/SVG)
  // ==========================================
  if (stage === 'GABUNG') {
    return (
      <div
        className="relative h-screen h-dvh max-h-screen w-full flex flex-col justify-between items-center overflow-hidden select-none"
        style={{
          backgroundColor: '#163a2b',
          backgroundImage: `
            radial-gradient(ellipse at 15% 15%, rgba(255, 255, 255, 0.12) 0%, transparent 45%),
            radial-gradient(ellipse at 85% 25%, rgba(255, 255, 255, 0.09) 0%, transparent 42%),
            radial-gradient(ellipse at 30% 70%, rgba(255, 255, 255, 0.11) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(255, 255, 255, 0.10) 0%, transparent 46%),
            radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.05) 0%, transparent 60%),
            radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0, 0, 0, 0.45) 100%),
            linear-gradient(175deg, #2b5641 0%, #204634 50%, #173829 100%)
          `,
        }}
      >
        <style>{`
          @keyframes joinBackBtnIn {
            from {
              opacity: 0;
              transform: translateX(-24px) scale(0.9);
            }
            to {
              opacity: 1;
              transform: translateX(0) scale(1);
            }
          }

          @keyframes joinLogoDrop {
            from {
              opacity: 0;
              transform: translateY(-28px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes joinCardPop {
            from {
              opacity: 0;
              transform: translateY(34px) scale(0.94);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes joinDoodleIn {
            from {
              opacity: 0;
              transform: scale(0.85);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes joinPlaneFloat {
            0%, 100% {
              transform: translateY(0) rotate(0deg);
            }
            50% {
              transform: translateY(-8px) rotate(-3deg);
            }
          }

          @keyframes joinBulbGlow {
            0%, 100% {
              transform: translateY(0) scale(1);
              opacity: 0.9;
            }
            50% {
              transform: translateY(-4px) scale(1.03);
              opacity: 1;
            }
          }

          @keyframes joinBooksIn {
            from {
              opacity: 0;
              transform: translateY(40px) rotate(-4deg);
            }
            to {
              opacity: 1;
              transform: translateY(0) rotate(0deg);
            }
          }

          @keyframes joinLedgeIn {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes joinFadeUp {
            from {
              opacity: 0;
              transform: translateY(18px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .join-back-btn {
            animation: joinBackBtnIn 0.65s cubic-bezier(0.34, 1.4, 0.64, 1) both;
          }
          .join-doodle-plane {
            animation: joinDoodleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both,
                       joinPlaneFloat 4s ease-in-out 0.9s infinite;
          }
          .join-doodle-bulb {
            animation: joinDoodleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both,
                       joinBulbGlow 3.5s ease-in-out 0.95s infinite;
          }
          .join-doodle-stars {
            animation: joinDoodleIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both;
          }
          .join-logo {
            animation: joinLogoDrop 0.85s cubic-bezier(0.34, 1.25, 0.64, 1) 0.15s both;
          }
          .join-card {
            animation: joinCardPop 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both;
          }
          .join-motto {
            animation: joinFadeUp 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.45s both;
          }
          .join-books {
            animation: joinBooksIn 0.95s cubic-bezier(0.34, 1.25, 0.64, 1) 0.35s both;
          }
          .join-ledge {
            animation: joinLedgeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
          }

          @media (prefers-reduced-motion: reduce) {
            .join-back-btn,
            .join-doodle-plane,
            .join-doodle-bulb,
            .join-doodle-stars,
            .join-logo,
            .join-card,
            .join-motto,
            .join-books,
            .join-ledge {
              animation: none !important;
              transform: none !important;
              opacity: 1 !important;
            }
          }
        `}</style>

        {/* ============================================================ */}
        {/* TOMBOL KEMBALI (KIRI ATAS)                                   */}
        {/* ============================================================ */}
        {joinStep === 'NAMA' ? (
          <button
            type="button"
            onClick={() => {
              setJoinStep('PIN');
              setFormError(null);
              setSearchParams({});
            }}
            className="join-back-btn absolute top-3 left-3 sm:top-5 sm:left-6 z-40 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#f6efe2]/90 hover:bg-[#f6efe2] text-[#163a2b] shadow-[0_4px_12px_rgba(0,0,0,0.3)] border-2 border-[#e4d7c3] transition-all hover:scale-105 active:scale-95 cursor-pointer group"
            title="Kembali ke Masukkan PIN"
            aria-label="Kembali ke Masukkan PIN"
          >
            <ArrowLeft className="w-5 h-5 text-[#163a2b] transition-transform group-hover:-translate-x-0.5" />
          </button>
        ) : (
          <Link
            to="/"
            className="join-back-btn absolute top-3 left-3 sm:top-5 sm:left-6 z-40 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#f6efe2]/90 hover:bg-[#f6efe2] text-[#163a2b] shadow-[0_4px_12px_rgba(0,0,0,0.3)] border-2 border-[#e4d7c3] transition-all hover:scale-105 active:scale-95 cursor-pointer group"
            title="Kembali ke Beranda"
            aria-label="Kembali ke Beranda"
          >
            <ArrowLeft className="w-5 h-5 text-[#163a2b] transition-transform group-hover:-translate-x-0.5" />
          </Link>
        )}

        {/* ============================================================ */}
        {/* DOODLE 1: PESAWAT KERTAS KAPUR (Kiri Atas)                   */}
        {/* ============================================================ */}
        <div className="join-doodle-plane absolute top-20 left-4 sm:top-24 sm:left-10 w-24 h-24 sm:w-32 sm:h-32 pointer-events-none z-10 text-[#f4ecd8]/75">
          <svg viewBox="0 0 130 130" fill="none" className="w-full h-full" aria-hidden="true">
            {/* Lintasan melengkung putus-putus */}
            <path
              d="M10 110 C 20 70, 60 55, 45 28 C 30 12, 10 38, 38 60 C 65 75, 88 56, 105 38"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeDasharray="4 6"
              strokeLinecap="round"
            />
            {/* Badan pesawat kertas origami */}
            <path
              d="M105 38 L 126 18 L 84 48 L 94 62 L 105 38 Z"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinejoin="round"
              fill="rgba(244, 236, 216, 0.08)"
            />
            <path d="M126 18 L 91 55" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </div>

        {/* ============================================================ */}
        {/* DOODLE 2: BOHLAM IDE MENYALA (Kanan Atas)                    */}
        {/* ============================================================ */}
        <div className="join-doodle-bulb absolute top-6 right-8 sm:top-10 sm:right-20 w-28 h-28 sm:w-36 sm:h-36 pointer-events-none z-10 text-[#f4ecd8]/90">
          <svg viewBox="0 0 110 110" fill="none" className="w-full h-full" aria-hidden="true">
            {/* Kontur kaca bohlam */}
            <path
              d="M40 62 C 30 52, 28 40, 33 28 C 40 16, 70 16, 77 28 C 82 40, 80 52, 70 62 L 70 70 L 40 70 Z"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="rgba(244, 236, 216, 0.06)"
            />
            {/* Drat ulir bohlam */}
            <path d="M43 75 H 67 M46 80 H 64 M50 85 H 60" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            {/* Filamen di dalam bohlam */}
            <path
              d="M48 46 C 48 38, 62 38, 62 46 L 55 54 Z"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* 5 Pancaran sinar kapur */}
            <path d="M55 8 V 2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M28 17 L 21 10" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M82 17 L 89 10" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M14 38 L 6 38" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M96 38 L 104 38" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
          </svg>
        </div>

        {/* ============================================================ */}
        {/* DOODLE 3: BINTANG-BINTANG & CORETAK KAPUR SEKOLAH */}
        {/* ============================================================ */}
        <div className="join-doodle-stars pointer-events-none">
          {/* Bintang kiri atas */}
          <svg className="absolute top-[32%] left-10 sm:left-24 w-7 h-7 text-[#f4ecd8]/60 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 L 15 9 L 22 9 L 16.5 13.5 L 18.5 20.5 L 12 16 L 5.5 20.5 L 7.5 13.5 L 2 9 L 9 9 Z" />
          </svg>
          {/* Bintang kiri bawah */}
          <svg className="absolute bottom-40 left-14 sm:left-44 w-8 h-8 text-[#f4ecd8]/55 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 L 15 9 L 22 9 L 16.5 13.5 L 18.5 20.5 L 12 16 L 5.5 20.5 L 7.5 13.5 L 2 9 L 9 9 Z" />
          </svg>
          {/* Bintang kanan atas */}
          <svg className="absolute top-[28%] right-12 sm:right-32 w-6 h-6 text-[#f4ecd8]/60 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 L 15 9 L 22 9 L 16.5 13.5 L 18.5 20.5 L 12 16 L 5.5 20.5 L 7.5 13.5 L 2 9 L 9 9 Z" />
          </svg>
          {/* Coretan Rumus Kapur di Kanan (Dekorasi Papan Tulis) */}
          <div className="absolute top-[48%] right-10 sm:right-28 text-[#f4ecd8]/45 pointer-events-none select-none hidden sm:flex flex-col items-center">
            <span className="font-['Caveat',sans-serif] text-xl tracking-widest font-bold">a² + b² = c²</span>
            <svg className="w-16 h-2 text-[#f4ecd8]/30 mt-0.5" viewBox="0 0 70 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 5 Q 35 1 68 5" />
            </svg>
          </div>
          {/* Bintang kanan bawah */}
          <svg className="absolute bottom-44 right-16 sm:right-40 w-7 h-7 text-[#f4ecd8]/50 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 L 15 9 L 22 9 L 16.5 13.5 L 18.5 20.5 L 12 16 L 5.5 20.5 L 7.5 13.5 L 2 9 L 9 9 Z" />
          </svg>
        </div>

        {/* ============================================================ */}
        {/* KONTEN UTAMA: LOGO, KARTU FORM, & TEKS MOTTO                 */}
        {/* ============================================================ */}
        <div className="relative z-30 w-full max-w-[390px] px-4 flex flex-col items-center my-auto py-2">
          {/* LOGO DISCERE DENGAN PERCIKAN KAPUR KUNING */}
          <div className="join-logo relative flex items-center justify-center gap-2 mb-2 sm:mb-3 select-none">
            {/* Ikon Buku Terbuka */}
            <svg
              className="w-8 h-8 sm:w-9 sm:h-9 text-[#f4ecd8] drop-shadow-md"
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 38c6 0 12-3 18-3s12 3 18 3V8c-6 0-12-3-18-3S12 8 6 8v30zM24 5v30" />
            </svg>
            {/* Tulisan Discere */}
            <span
              className="text-3xl sm:text-4xl font-black text-[#f4ecd8] tracking-wide font-['Caveat',sans-serif]"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.45)' }}
            >
              Discere
            </span>
            {/* 3 Percikan Kapur Kuning di Atas-Kanan Teks */}
            <svg
              className="w-6 h-6 sm:w-7 sm:h-7 text-[#f2c230] -mt-4 -ml-1 pointer-events-none"
              viewBox="0 0 30 30"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 22 L 18 10 M14 26 L 24 18 M2 16 L 14 6" />
            </svg>
            {/* Coretan Lengkung Kuning di Bawah Logo */}
            <svg
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-36 sm:w-40 h-2.5 sm:h-3 text-[#f2c230] pointer-events-none"
              viewBox="0 0 120 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 8 Q 60 2 116 7" />
            </svg>
          </div>

          {/* KARTU FORMULIR KERTAS PARCHMENT (Paper Card) */}
          <div className="join-card relative w-full bg-[#f6efe2] rounded-2xl sm:rounded-[26px] p-4 sm:p-6 shadow-[0_8px_0_rgba(0,0,0,0.18),0_18px_40px_rgba(0,0,0,0.4)] border-2 border-[#e4d7c3] text-center">
            {/* Pesan Error */}
            {formError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center justify-center gap-2 animate-bounce">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Pembatas Garis dengan Teks PIN / NICKNAME di Tengah */}
            <div className="flex items-center gap-3 mb-3.5 px-1 select-none">
              <div className="flex-1 h-[1.5px] bg-[#beb4a0]" />
              <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-[#2c3d31]">
                {joinStep === 'PIN' ? 'PIN' : 'NICKNAME'}
              </span>
              <div className="flex-1 h-[1.5px] bg-[#beb4a0]" />
            </div>

            {joinStep === 'PIN' ? (
              <form onSubmit={handleNextToName} className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter PIN"
                  value={tokenInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setTokenInput(val);
                    if (formError) setFormError(null);
                  }}
                  autoFocus
                  className="w-full py-2.5 sm:py-3 px-4 text-center text-xl sm:text-2xl font-black tracking-widest text-[#163a2b] bg-[#ece4d5] border-2 border-[#243e2f] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#163a2b]/30 transition-all placeholder:text-[#9e9688] placeholder:font-bold placeholder:text-base placeholder:tracking-normal"
                  required
                />
                <button
                  type="submit"
                  disabled={!tokenInput.trim() || tokenInput.trim().length !== 6}
                  className="w-full py-2.5 sm:py-3 px-4 text-lg sm:text-xl font-bold text-white bg-[#173b2b] hover:bg-[#102c20] active:scale-[0.99] rounded-2xl shadow-md transition-all cursor-pointer font-['Caveat',sans-serif] tracking-wider disabled:opacity-50"
                >
                  Join
                </button>
              </form>
            ) : (
              <form onSubmit={handleGabung} className="space-y-3">
                <input
                  type="text"
                  maxLength={20}
                  placeholder="Enter Name"
                  value={namaInput}
                  onChange={(e) => {
                    setNamaInput(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  autoFocus
                  className="w-full py-2.5 sm:py-3 px-4 text-center text-lg sm:text-xl font-bold text-[#163a2b] bg-[#ece4d5] border-2 border-[#243e2f] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#163a2b]/30 transition-all placeholder:text-[#9e9688] placeholder:font-bold"
                  required
                />
                <button
                  type="submit"
                  disabled={isJoining || !namaInput.trim()}
                  className="w-full py-2.5 sm:py-3 px-4 text-lg sm:text-xl font-bold text-white bg-[#173b2b] hover:bg-[#102c20] disabled:opacity-60 active:scale-[0.99] rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer font-['Caveat',sans-serif] tracking-wider"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Menghubungkan...
                    </>
                  ) : (
                    'Mulai!'
                  )}
                </button>
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setJoinStep('PIN');
                      setFormError(null);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    ← Ganti PIN ({tokenInput || '......'})
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* TEKS MOTTO DI BAWAH KARTU DENGAN CORETAN KAPUR KUNING */}
          <div className="join-motto mt-2.5 sm:mt-3 flex flex-col items-center select-none text-center">
            <span
              className="text-base sm:text-lg font-bold text-[#f4ecd9] tracking-wide font-['Caveat',sans-serif]"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
            >
              Discere • Belajar Lebih Menyenangkan
            </span>
            <svg
              className="w-40 sm:w-44 h-2.5 sm:h-3 text-[#f2c230] mt-0.5 pointer-events-none"
              viewBox="0 0 140 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 6 Q 35 1 70 6 T 136 5" />
            </svg>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TUMPUKAN 3 BUKU CAT AIR KLASIK (Kiri Bawah di Atas Meja Kayu) */}
        {/* ============================================================ */}
        <div className="join-books absolute bottom-8 sm:bottom-12 left-2 sm:left-8 w-24 sm:w-36 h-20 sm:h-28 pointer-events-none z-20 hidden md:block">
          <svg viewBox="0 0 150 110" fill="none" className="w-full h-full drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)]" aria-hidden="true">
            {/* Bayangan di atas dudukan kayu */}
            <ellipse cx="75" cy="98" rx="65" ry="6" fill="rgba(0,0,0,0.4)" />

            {/* BUKU BAWAH (Kulit Cokelat Tua / Marun) */}
            <path d="M12 72 L 140 72 L 142 94 L 14 94 Z" fill="#4a2c16" />
            <path d="M24 76 L 138 76 L 138 90 L 24 90 Z" fill="#f4ecd8" />
            <path d="M10 70 C 8 70, 6 74, 6 83 C 6 92, 8 96, 10 96 L 24 96 L 24 70 Z" fill="#351d0d" />
            {/* Garis emas tulang buku bawah */}
            <line x1="12" y1="76" x2="22" y2="76" stroke="#c59a5f" strokeWidth="1.5" />
            <line x1="12" y1="90" x2="22" y2="90" stroke="#c59a5f" strokeWidth="1.5" />

            {/* BUKU TENGAH (Cover Hitam-Arang / Navy Gelap) */}
            <path d="M20 50 L 130 50 L 132 70 L 22 70 Z" fill="#24292e" />
            <path d="M30 54 L 128 54 L 128 66 L 30 66 Z" fill="#f4ecd8" />
            <path d="M18 48 C 16 48, 14 52, 14 60 C 14 68, 16 72, 18 72 L 30 72 L 30 48 Z" fill="#161a1e" />
            {/* Garis emas tulang buku tengah */}
            <line x1="18" y1="54" x2="28" y2="54" stroke="#d4af37" strokeWidth="1.5" />
            <line x1="18" y1="66" x2="28" y2="66" stroke="#d4af37" strokeWidth="1.5" />

            {/* BUKU ATAS (Hijau Hutan Antik) */}
            <path d="M12 28 L 118 28 L 120 48 L 14 48 Z" fill="#1b422e" />
            <path d="M22 32 L 116 32 L 116 44 L 22 44 Z" fill="#f4ecd8" />
            <path d="M10 26 C 8 26, 6 30, 6 38 C 6 46, 8 50, 10 50 L 22 50 L 22 26 Z" fill="#112d1f" />
            {/* Garis emas tulang buku atas */}
            <line x1="10" y1="32" x2="20" y2="32" stroke="#c59a5f" strokeWidth="1.5" />
            <line x1="10" y1="44" x2="20" y2="44" stroke="#c59a5f" strokeWidth="1.5" />

            {/* Pita Pembatas Buku Merah Menjuntai */}
            <path d="M85 45 C 90 55, 80 65, 88 78 C 92 84, 86 92, 90 98 L 94 94 L 97 99 C 94 92, 98 84, 94 78 C 86 65, 96 55, 90 45 Z" fill="#c82b24" opacity="0.9" />
          </svg>
        </div>

        {/* ============================================================ */}
        {/* AKSESORIS RAK KAYU: BATANG KAPUR & PENGHAPUS PAPAN TULIS     */}
        {/* ============================================================ */}
        <div className="join-ledge absolute bottom-10 sm:bottom-14 left-0 right-0 w-full pointer-events-none z-20 px-4 sm:px-12 flex justify-end items-end">
          <div className="hidden sm:flex items-end gap-3.5 mb-0.5 opacity-95 drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)]">
            {/* Batang Kapur Putih */}
            <div className="w-11 h-2.5 rounded-full bg-[#f8fafc] shadow-sm transform -rotate-3 border border-slate-300/40 relative">
              <div className="absolute -top-1 -right-2 w-4 h-3 bg-white/30 blur-sm rounded-full" />
            </div>
            {/* Batang Kapur Kuning */}
            <div className="w-9 h-2.5 rounded-full bg-[#f2c230] shadow-sm transform rotate-2 border border-amber-400/40" />
            {/* Penghapus Papan Tulis Kayu Klasik */}
            <div className="w-20 h-6 rounded-sm bg-gradient-to-b from-[#9e6936] to-[#71441c] border-t border-[#d8a368] shadow-md flex flex-col justify-end overflow-hidden ml-2.5">
              {/* Spon felt hitam penghapus */}
              <div className="w-full h-2.5 bg-[#252525] border-t border-black/40 flex items-center justify-center">
                <div className="w-full h-0.5 bg-white/20 blur-[0.5px]" />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* DUDUKAN MEJA & RAK PAPAN TULIS KAYU KLASIK (FULL LEBAR)      */}
        {/* ============================================================ */}
        <div className="join-ledge absolute bottom-0 left-0 right-0 w-full pointer-events-none z-10">
          {/* LIS ATAS RAK KAYU / BEVEL KILAU EMAS */}
          <div className="w-full h-1 bg-gradient-to-r from-[#b07f4a] via-[#e2b07a] to-[#b07f4a] shadow-sm" />

          {/* ALUR TEMPAT KAPUR (CHALK TRAY GROOVE) */}
          <div className="w-full h-2.5 sm:h-3 bg-gradient-to-b from-[#2e1708] via-[#45230c] to-[#321808] relative overflow-hidden border-b border-[#241005]">
            {/* Debu kapur halus yang mengendap di alur */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* PAPAN MEJA KAYU JATI/MAHONI BERTEKSTUR */}
          <div
            className="w-full h-8 sm:h-12 relative overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #784821 0%, #633816 25%, #502b0f 60%, #3a1c07 100%)',
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.18), 0 -6px 16px rgba(0,0,0,0.5)',
            }}
          >
            {/* Serat kayu halus (Wood Grain Lines) */}
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.35) 3px, rgba(0,0,0,0.35) 5px), repeating-linear-gradient(90deg, transparent, transparent 110px, rgba(255,255,255,0.05) 110px, rgba(255,255,255,0.05) 113px)`,
              }}
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* PITA SATIN INDONESIA BERGELOMBANG (MERAH PUTIH MURNI SVG)    */}
        {/* ============================================================ */}
        <svg
          className="absolute bottom-0 left-0 w-full h-14 sm:h-20 pointer-events-none z-25 overflow-visible"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            {/* Gradien Pita Merah Satin Mengkilap */}
            <linearGradient id="redSatinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ab1b14" />
              <stop offset="25%" stopColor="#e32c24" />
              <stop offset="50%" stopColor="#ff5950" />
              <stop offset="75%" stopColor="#db261e" />
              <stop offset="100%" stopColor="#96130d" />
            </linearGradient>

            {/* Gradien Pita Putih Satin Mengkilap */}
            <linearGradient id="whiteSatinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e8decb" />
              <stop offset="25%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#fdfaf3" />
              <stop offset="75%" stopColor="#ded3be" />
              <stop offset="100%" stopColor="#c5b79e" />
            </linearGradient>

            {/* Filter Drop Shadow Alami untuk Pita */}
            <filter id="ribbonDropShadow" x="-5%" y="-10%" width="110%" height="150%">
              <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* GROUP PITA DENGAN BAYANGAN */}
          <g filter="url(#ribbonDropShadow)">
            {/* 1. JALUR PITA PUTIH (BAGIAN BAWAH PITA MERAH PUTIH) */}
            <path
              d="M -10 68 C 220 38, 460 102, 700 82 C 940 62, 1180 102, 1450 58 L 1450 78 C 1180 122, 940 82, 700 102 C 460 122, 220 58, -10 88 Z"
              fill="url(#whiteSatinGrad)"
            />

            {/* 2. JALUR PITA MERAH (BAGIAN ATAS PITA MERAH PUTIH) */}
            <path
              d="M -10 48 C 220 18, 460 82, 700 62 C 940 42, 1180 82, 1450 38 L 1450 58 C 1180 102, 940 62, 700 82 C 460 102, 220 38, -10 68 Z"
              fill="url(#redSatinGrad)"
            />

            {/* Kilap Pantulan Cahaya Atas Pita Merah */}
            <path
              d="M -10 48 C 220 18, 460 82, 700 62 C 940 42, 1180 82, 1450 38 L 1450 43 C 1180 87, 940 47, 700 67 C 460 87, 220 23, -10 53 Z"
              fill="#ffffff"
              opacity="0.35"
            />

            {/* Lipatan & Lekukan Pita Kanan (Ujung Berkibar) */}
            <path
              d="M 1340 50 C 1370 25, 1410 32, 1445 42 L 1450 68 C 1415 58, 1375 52, 1345 74 Z"
              fill="#85120d"
              opacity="0.5"
            />
            {/* Lipatan & Lekukan Pita Kiri (Di Bawah Buku) */}
            <path
              d="M -10 70 C 40 45, 110 50, 160 85 L 145 92 C 100 62, 35 56, -10 78 Z"
              fill="#85120d"
              opacity="0.4"
            />
          </g>
        </svg>
      </div>
    );
  }

  // ==========================================
  // RENDER MAKAN KERUPUK CHALLENGE (MULTIPLAYER HP SISWA)
  // ==========================================
  if (gameType === 'makan_kerupuk' && sessionId && pesertaId) {
    return (
      <MainKerupuk
        token={tokenInput}
        nama={namaPeserta}
        sessionId={sessionId}
        pesertaId={pesertaId}
        pesertaSecret={panjatSecret}
        templateJudul={templateJudul}
        initialStatus={stage === 'PLAYING' ? 'jalan' : stage === 'SELESAI' ? 'selesai' : 'lobi'}
        initialPesertaState={kerupukState}
        initialLeaderboard={kerupukLeaderboard}
        initialSoalAktif={kerupukSoalAktif}
        onKeluar={handleKeluar}
      />
    );
  }

  // ==========================================
  // RENDER PANJAT PINANG (JIKA SESI ADALAH PANJAT PINANG)
  // ==========================================
  if (gameType === 'panjat_pinang' && sessionId && pesertaId) {
    return (
      <MainPanjatPinang
        token={tokenInput}
        nama={namaPeserta}
        sessionId={sessionId}
        pesertaId={pesertaId}
        pesertaSecret={panjatSecret}
        templateJudul={templateJudul}
        config={panjatConfig}
        initialStatus={stage === 'PLAYING' ? 'jalan' : stage === 'SELESAI' ? 'selesai' : 'lobi'}
        initialPesertaState={panjatState}
        initialLeaderboard={panjatLeaderboard}
        initialSoalAktif={panjatSoalAktif}
        onKeluar={handleKeluar}
      />
    );
  }

  // ==========================================
  // RENDER BALAP KARUNG CHALLENGE (JIKA SESI ADALAH BALAP KARUNG)
  // ==========================================
  if (gameType === 'balap_karung' && sessionId && pesertaId) {
    return (
      <MainBalapKarung
        token={tokenInput}
        nama={namaPeserta}
        sessionId={sessionId}
        pesertaId={pesertaId}
        pesertaSecret={panjatSecret}
        templateJudul={templateJudul}
        config={balapConfig}
        initialStatus={stage === 'PLAYING' ? 'jalan' : stage === 'SELESAI' ? 'selesai' : 'lobi'}
        initialPesertaState={balapState}
        initialLeaderboard={balapLeaderboard}
        initialTeams={balapTeams}
        initialSoalAktif={balapSoalAktif}
        onKeluar={handleKeluar}
      />
    );
  }

  // ==========================================
  // RENDER TARIK TAMBANG FESTIVAL (JIKA SESI ADALAH TARIK TAMBANG)
  // ==========================================
  if (gameType === 'tarik_tambang' && sessionId && pesertaId) {
    return (
      <MainTarikTambang
        token={tokenInput}
        nama={namaPeserta}
        sessionId={sessionId}
        pesertaId={pesertaId}
        pesertaSecret={panjatSecret}
        templateJudul={templateJudul}
        config={tarikJoinData?.config}
        initialStatus={stage === 'PLAYING' ? 'jalan' : stage === 'SELESAI' ? 'selesai' : 'lobi'}
        initialTim={tarikJoinData?.tim}
        initialTaliPosition={tarikJoinData?.taliPosition}
        initialSkorMerah={tarikJoinData?.skorMerah}
        initialSkorPutih={tarikJoinData?.skorPutih}
        initialMatchEndsAt={tarikJoinData?.matchEndsAt}
        initialDaftarPeserta={tarikJoinData?.daftarPeserta}
        initialSoalAktif={tarikJoinData?.soalAktif}
        initialPowerUpTim={tarikJoinData?.powerUpTim}
        initialPesertaStat={tarikJoinData?.pesertaStat}
        initialHasil={tarikJoinData?.hasil}
        onKeluar={handleKeluar}
      />
    );
  }

  return null;
}
