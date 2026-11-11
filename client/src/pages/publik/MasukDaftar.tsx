import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { z } from 'zod';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components';
import { ApiError } from '../../lib/api';

const masukFormSchema = z.object({
  email: z.string().email('Format email tidak valid.'),
  kataSandi: z.string().min(1, 'Kata sandi wajib diisi.'),
});

const daftarFormSchema = z.object({
  nama: z.string().min(2, 'Nama lengkap minimal 2 karakter.'),
  email: z.string().email('Format email tidak valid.'),
  kataSandi: z.string().min(8, 'Kata sandi minimal 8 karakter.'),
  sekolah: z.string().optional(),
});

// SVG Karakter Siswa Tarik Tambang (discere-masuk.html)
const SK = '#f0b98d';
const RD = '#d63a32';

const personSvg = (flip: boolean) => `
<g${flip ? ' transform="translate(200 0) scale(-1 1)"' : ''}>
  <ellipse cx="116" cy="251" rx="66" ry="7" fill="rgba(0,0,0,.28)"/>
  <g class="leg la" style="transform-origin:128px 158px">
    <path d="M128 158L168 238" stroke="${SK}" stroke-width="19" stroke-linecap="round"/>
    <path d="M156 241h24a6 6 0 0 1 0 11h-32z" fill="#fff" stroke="#c8362f" stroke-width="3"/>
  </g>
  <g class="leg lb" style="transform-origin:120px 158px">
    <path d="M120 158L96 198L90 238" fill="none" stroke="${SK}" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M76 241h22a6 6 0 0 1 0 11H70z" fill="#fff" stroke="#c8362f" stroke-width="3"/>
  </g>
  <path d="M100 146h52l6 32H98z" fill="#2b2f3a"/>
  <g transform="rotate(12 110 245)">
    <rect x="98" y="76" width="12" height="18" fill="${SK}"/>
    <path d="M96 100L70 108L46 118" fill="none" stroke="${SK}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="84" y="90" width="42" height="64" rx="14" fill="${RD}"/>
    <path d="M95 91q9 11 18 0" fill="#fff"/>
    <circle cx="96" cy="102" r="11" fill="${RD}"/>
    <circle cx="46" cy="118" r="8" fill="${SK}"/>
    <circle cx="55" cy="125" r="8" fill="${SK}"/>
    <circle cx="127" cy="66" r="5" fill="${SK}"/>
    <circle cx="104" cy="62" r="24" fill="${SK}"/>
    <path d="M79 60Q78 36 104 36Q130 36 129 60Q122 46 104 46Q86 46 79 60Z" fill="#20202a"/>
    {/* Ikat Kepala Bendera Merah Putih Indonesia */}
    <path d="M80 55Q104 45 128 55L128 58.5Q104 48.5 80 58.5Z" fill="${RD}"/>
    <path d="M80 58.5Q104 48.5 128 58.5L128 62Q104 52 80 62Z" fill="#fff"/>
    <circle cx="94" cy="68" r="2.6" fill="#222"/>
    <circle cx="112" cy="68" r="2.6" fill="#222"/>
    <path d="M89 61l10 3M118 61l-10 3" stroke="#222" stroke-width="2" stroke-linecap="round"/>
    <path d="M95 76Q103 86 112 76Z" fill="#7a2a24"/>
  </g>
</g>
`;

interface MasukDaftarProps {
  initialView?: 'log' | 'reg';
}

export default function MasukDaftar({ initialView = 'log' }: MasukDaftarProps) {
  const { masuk, daftar, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { tampilToast } = useToast();

  // State Animasi Terpadu (Sinkron 100% dengan CSS discere-masuk.html)
  const [isReg, setIsReg] = useState(initialView === 'reg');
  const [isWalking, setIsWalking] = useState(false);
  const [cardSr, setCardSr] = useState(initialView === 'reg');
  const [cardTilt, setCardTilt] = useState<'tr' | 'tl' | ''>('');
  const [strainPerson, setStrainPerson] = useState<'pL' | 'pR' | ''>('');

  // Form State: Masuk
  const [loginEmail, setLoginEmail] = useState('');
  const [loginKataSandi, setLoginKataSandi] = useState('');
  const [lihatLoginKataSandi, setLihatLoginKataSandi] = useState(false);
  const [ingatSaya, setIngatSaya] = useState(true);
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});
  const [loginServerError, setLoginServerError] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Form State: Daftar
  const [daftarNama, setDaftarNama] = useState('');
  const [daftarEmail, setDaftarEmail] = useState('');
  const [daftarKataSandi, setDaftarKataSandi] = useState('');
  const [daftarSekolah, setDaftarSekolah] = useState('');
  const [lihatDaftarKataSandi, setLihatDaftarKataSandi] = useState(false);
  const [daftarErrors, setDaftarErrors] = useState<Record<string, string>>({});
  const [daftarServerError, setDaftarServerError] = useState('');
  const [isSubmittingDaftar, setIsSubmittingDaftar] = useState(false);

  // DOM Refs
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rLRef = useRef<SVGSVGElement>(null);
  const rRRef = useRef<SVGSVGElement>(null);
  const pLRef = useRef<SVGSVGElement>(null);
  const pRRef = useRef<SVGSVGElement>(null);
  const busyRef = useRef(false);

  // Redirect jika sudah login
  useEffect(() => {
    if (user) {
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      const target = from || (user.role === 'admin' ? '/admin' : '/guru');
      navigate(target, { replace: true });
    }
  }, [user, navigate, location]);

  // Manipulasi Kelengkungan Tali (Sagging)
  const setSag = (svgEl: SVGSVGElement | null, v: number) => {
    if (!svgEl) return;
    svgEl.querySelectorAll('path').forEach((p) => {
      p.setAttribute('d', `M0 30Q248 ${30 + v} 497 30`);
    });
  };

  const tweenRope = (svgEl: SVGSVGElement | null, a: number, b: number, ms: number) => {
    if (!svgEl) return;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setSag(svgEl, a + (b - a) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // Inisialisasi Karakter & Tali SVG serta Kunci Overflow (Tanpa Scroll)
  useEffect(() => {
    // Kunci overflow body & html agar tidak ada scrollbar sama sekali di browser
    const origHtmlOverflow = document.documentElement.style.overflow;
    const origBodyOverflow = document.body.style.overflow;
    const origHtmlHeight = document.documentElement.style.height;
    const origBodyHeight = document.body.style.height;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';

    if (pLRef.current) pLRef.current.innerHTML = personSvg(true);
    if (pRRef.current) pRRef.current.innerHTML = personSvg(false);

    setSag(rLRef.current, 12);
    setSag(rRRef.current, 12);

    const fitScale = () => {
      // Skala dihitung agar seluruh stage 680px + lantai kayu jalanan (.floor) & (.under) muat 100% di dalam layar
      const s = Math.max(0.65, Math.min(window.innerWidth / 1200, window.innerHeight / 720, 1.25));
      document.documentElement.style.setProperty('--s', s.toString());
      if (wrapperRef.current) {
        wrapperRef.current.style.setProperty('--s', s.toString());
      }
    };

    fitScale();
    window.addEventListener('resize', fitScale);

    // Jika mulai langsung dari halaman daftar, hilangkan transisi geser awal
    if (initialView === 'reg' && trackRef.current) {
      trackRef.current.style.transition = 'none';
      void trackRef.current.offsetWidth;
      trackRef.current.style.transition = '';
    }

    // Tangani navigasi back/forward browser
    const handlePopState = () => {
      const isPathDaftar = window.location.pathname.includes('/daftar');
      switchView(isPathDaftar ? 'reg' : 'log');
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.documentElement.style.overflow = origHtmlOverflow;
      document.body.style.overflow = origBodyOverflow;
      document.documentElement.style.height = origHtmlHeight;
      document.body.style.height = origBodyHeight;

      window.removeEventListener('resize', fitScale);
      window.removeEventListener('popstate', handlePopState);
      document.documentElement.style.removeProperty('--s');
    };
  }, [initialView]);

  // Koreografi Lengkap Transisi Tarik Tambang
  const switchView = (targetView: 'log' | 'reg') => {
    if (busyRef.current) return;
    const targetIsReg = targetView === 'reg';
    if (targetIsReg === isReg) return;
    busyRef.current = true;

    const rL = rLRef.current;
    const rR = rRRef.current;

    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReducedMotion) {
      setIsReg(targetIsReg);
      setCardSr(targetIsReg);
      window.history.replaceState(null, '', targetIsReg ? '/daftar' : '/masuk');
      busyRef.current = false;
      return;
    }

    const isMobile = window.matchMedia('(max-width: 819px)').matches;
    if (isMobile) {
      const cardEl = cardRef.current;
      const d = targetIsReg ? 1 : -1;
      cardEl?.animate(
        [
          { transform: 'none', opacity: 1 },
          { transform: `translateX(${d * 60}px) rotate(${d * 4}deg)`, opacity: 0, offset: 0.45 },
          { transform: `translateX(${-d * 60}px) rotate(${-d * 4}deg)`, opacity: 0, offset: 0.46 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 650, easing: 'ease-in-out' }
      );
      setTimeout(() => {
        setCardSr(targetIsReg);
        setIsReg(targetIsReg);
      }, 300);
      setTimeout(() => {
        window.history.replaceState(null, '', targetIsReg ? '/daftar' : '/masuk');
        busyRef.current = false;
      }, 650);
      return;
    }

    // KOREOGRAFI DESKTOP: TARIK TAMBANG DENGAN ANIMASI TEKS & KARTU TEPAT WAKTU
    const pullingRope = targetIsReg ? rR : rL;
    const otherRope = targetIsReg ? rL : rR;

    // 1. Orang penarik tegang (strain), kartu miring (tr / tl), tali menegang (tween)
    setStrainPerson(targetIsReg ? 'pR' : 'pL');
    setCardTilt(targetIsReg ? 'tr' : 'tl');
    tweenRope(pullingRope, 12, 0, 380);

    // 2. Di detik 460ms: berhenti tegang, mulai jalan kaki (walk), dan ubah status stage (.reg)
    //    -> Menggerakkan track sejauh 720px (durasi 1.25s)
    //    -> Mengubah teks kapur di tengah (opacity .4s) dengan mulus!
    setTimeout(() => {
      setStrainPerson('');
      setIsWalking(true);
      setIsReg(targetIsReg);

      // 3. Di detik 460 + 520 = 980ms: kartu berganti isi (swap card pane via .sr)
      //    -> Form lama fade-out (0.25s), form baru fade-in (0.3s) di tengah perjalanan
      setTimeout(() => {
        setCardSr(targetIsReg);
      }, 520);

      // 4. Di detik 460 + 1300 = 1760ms: perjalanan track selesai, kartu mendarat tegak
      setTimeout(() => {
        setIsWalking(false);
        setCardTilt('');
        setSag(pullingRope, 12);

        // Orang di sisi lain menahan rem sebentar (strain)
        setStrainPerson(targetIsReg ? 'pL' : 'pR');
        tweenRope(otherRope, 14, 0, 300);

        // 5. Di detik 1760 + 480 = 2240ms: semua selesai & stabil
        setTimeout(() => {
          setStrainPerson('');
          window.history.replaceState(null, '', targetIsReg ? '/daftar' : '/masuk');
          busyRef.current = false;
        }, 480);
      }, 1300);
    }, 460);
  };

  // Submit Handler: Masuk
  const handleSubmitMasuk = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginServerError('');
    setLoginErrors({});

    const validasi = masukFormSchema.safeParse({
      email: loginEmail,
      kataSandi: loginKataSandi,
    });

    if (!validasi.success) {
      const fieldErrors: Record<string, string> = {};
      validasi.error.issues.forEach((err) => {
        const path = err.path[0] as string;
        if (!fieldErrors[path]) {
          fieldErrors[path] = err.message;
        }
      });
      setLoginErrors(fieldErrors);
      return;
    }

    setIsSubmittingLogin(true);
    try {
      const loggedUser = await masuk({
        email: loginEmail,
        kataSandi: loginKataSandi,
      });
      tampilToast(`Selamat datang kembali, ${loggedUser.nama}!`, 'sukses');
      const target = loggedUser.role === 'admin' ? '/admin' : '/guru';
      navigate(target, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setLoginServerError(err.pesan);
      } else {
        setLoginServerError('Gagal masuk. Silakan periksa koneksi Anda dan coba lagi.');
      }
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  // Submit Handler: Daftar
  const handleSubmitDaftar = async (e: React.FormEvent) => {
    e.preventDefault();
    setDaftarServerError('');
    setDaftarErrors({});

    const validasi = daftarFormSchema.safeParse({
      nama: daftarNama,
      email: daftarEmail,
      kataSandi: daftarKataSandi,
      sekolah: daftarSekolah,
    });

    if (!validasi.success) {
      const fieldErrors: Record<string, string> = {};
      validasi.error.issues.forEach((err) => {
        const path = err.path[0] as string;
        if (!fieldErrors[path]) {
          fieldErrors[path] = err.message;
        }
      });
      setDaftarErrors(fieldErrors);
      return;
    }

    setIsSubmittingDaftar(true);
    try {
      await daftar({
        nama: daftarNama,
        email: daftarEmail,
        kataSandi: daftarKataSandi,
        sekolah: daftarSekolah.trim() || undefined,
      });
      tampilToast('Pendaftaran berhasil! Selamat datang di Discere.', 'sukses');
      navigate('/guru', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setDaftarServerError(err.pesan);
      } else {
        setDaftarServerError('Gagal mendaftar. Silakan periksa koneksi Anda dan coba lagi.');
      }
    } finally {
      setIsSubmittingDaftar(false);
    }
  };

  const isiAkunDemo = (peran: 'guru' | 'admin') => {
    if (peran === 'guru') {
      setLoginEmail('guru@discere.local');
      setLoginKataSandi('GuruDiscere2026!');
    } else {
      setLoginEmail('admin@discere.local');
      setLoginKataSandi('AdminDiscere2026!');
    }
    setLoginErrors({});
    setLoginServerError('');
  };

  return (
    <div className="discere-masuk-wrapper" ref={wrapperRef}>
      {/* CSS PERSIS SESUAI REFERENSI DESAIN DISCERE-MASUK.HTML (DENGAN KUNCI NO-SCROLL) */}
      <style>{`
        html, body {
          overflow: hidden !important;
          height: 100% !important;
          max-height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        :root {
          --s: 1;
        }

        .discere-masuk-wrapper {
          color-scheme: light;
          --board: #1f4a37;
          --board-d: #163a2b;
          --card: #fbf6e9;
          --ink: #1d3b2e;
          --muted: #58705f;
          --chalk: #f4ecd8;
          --yellow: #f2c230;
          --red: #c8362f;
          --line: rgba(31,74,55,.22);
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          max-height: 100vh;
          overflow: hidden !important;
          display: flex;
          flex-direction: column;
          font-family: 'Nunito', system-ui, sans-serif;
          color: var(--ink);
          background: var(--board-d);
          touch-action: none;
        }

        .discere-masuk-wrapper .hand {
          font-family: 'Caveat', 'Comic Sans MS', cursive;
          font-weight: 700;
        }

        .discere-masuk-wrapper .page {
          width: 100%;
          height: 100%;
          max-height: 100vh;
          max-height: 100dvh;
          overflow: hidden !important;
          display: flex;
          flex-direction: column;
          background: radial-gradient(ellipse at 30% 8%, rgba(255,255,255,.11), transparent 55%),
                      radial-gradient(ellipse at 85% 75%, rgba(0,0,0,.22), transparent 60%),
                      linear-gradient(160deg, #2c5f47, var(--board) 55%, var(--board-d));
        }

        .discere-masuk-wrapper .stage {
          position: relative;
          flex: none;
          height: calc(680px * var(--s));
          overflow: hidden;
        }

        .discere-masuk-wrapper .under {
          flex: 1;
          background: #8b6a4a;
        }

        .discere-masuk-wrapper .floor {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: calc(80px * var(--s));
          background: linear-gradient(#b99672 0 8px, #8b6a4a 8px);
          border-top: 3px solid #6f5238;
        }

        .discere-masuk-wrapper .brand {
          position: absolute;
          left: 24px;
          top: 16px;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--chalk);
          font-weight: 800;
          font-size: 22px;
          text-decoration: none;
        }
        .discere-masuk-wrapper .brand:hover {
          opacity: 0.9;
        }

        .discere-masuk-wrapper .flagr {
          position: absolute;
          right: -16px;
          top: 14px;
          width: 140px;
          opacity: .95;
          pointer-events: none;
        }

        .discere-masuk-wrapper .scaler {
          position: absolute;
          left: 50%;
          top: 0;
          width: 1200px;
          height: 680px;
          transform: translateX(-50%) scale(var(--s));
          transform-origin: 50% 0;
        }

        .discere-masuk-wrapper .track {
          position: absolute;
          inset: 0;
          transition: transform 1.25s cubic-bezier(.55, 0, .25, 1.08);
        }

        .discere-masuk-wrapper .stage.reg .track {
          transform: translateX(720px);
        }

        /* Tali & Orang */
        .discere-masuk-wrapper .rope {
          position: absolute;
          top: 433px;
          width: 497px;
          height: 60px;
          overflow: visible;
          pointer-events: none;
        }
        .discere-masuk-wrapper .rope path {
          fill: none;
        }
        .discere-masuk-wrapper .rope path:first-child {
          stroke: #6f4521;
          stroke-width: 10;
        }
        .discere-masuk-wrapper .rope path:last-child {
          stroke: #c59a5f;
          stroke-width: 10;
          stroke-dasharray: 3 7;
        }

        .discere-masuk-wrapper .ring {
          position: absolute;
          top: 454px;
          width: 18px;
          height: 18px;
          border: 4px solid #d4d7db;
          border-radius: 50%;
          background: #7b8088;
          z-index: 3;
          pointer-events: none;
        }

        .discere-masuk-wrapper .ppl {
          position: absolute;
          top: 352px;
          width: 200px;
          height: 260px;
          overflow: visible;
          pointer-events: none;
        }
        .discere-masuk-wrapper .leg {
          transform-origin: center;
        }
        .discere-masuk-wrapper .walk .ppl {
          animation: bob .3s ease-in-out infinite alternate;
        }
        .discere-masuk-wrapper .walk .la {
          animation: st .5s ease-in-out infinite;
        }
        .discere-masuk-wrapper .walk .lb {
          animation: st .5s ease-in-out infinite reverse;
        }
        .discere-masuk-wrapper .strain {
          animation: sh .09s linear 5;
        }

        @keyframes st {
          0%, 100% { transform: rotate(-13deg); }
          50% { transform: rotate(13deg); }
        }
        @keyframes bob {
          to { transform: translateY(-5px); }
        }
        @keyframes sh {
          50% { transform: translateX(3px); }
        }

        /* ANIMASI TEKS KAPUR DI TENGAH PAPAN TULIS */
        .discere-masuk-wrapper .chalk {
          position: absolute;
          left: 470px;
          top: 150px;
          width: 270px;
          text-align: center;
          color: var(--chalk);
          pointer-events: none;
          user-select: none;
        }
        .discere-masuk-wrapper .chalk .t {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          transition: opacity .4s ease-in-out;
        }
        .discere-masuk-wrapper .chalk .b {
          opacity: 0;
        }
        .discere-masuk-wrapper .stage.reg .chalk .a {
          opacity: 0;
        }
        .discere-masuk-wrapper .stage.reg .chalk .b {
          opacity: 1;
        }
        .discere-masuk-wrapper .chalk h2 {
          font-size: 42px;
          line-height: 1.05;
        }
        .discere-masuk-wrapper .chalk p {
          font-size: 15px;
          margin-top: 8px;
          opacity: .9;
        }

        /* KARTU FORMULIR KERTAS PERKAMEN */
        .discere-masuk-wrapper .card {
          position: absolute;
          left: 40px;
          bottom: 80px;
          width: 400px;
          background: var(--card);
          border: 3px solid #e8dfc8;
          border-radius: 28px 32px 26px 30px;
          padding: 24px 26px;
          box-shadow: 0 10px 0 rgba(0,0,0,.2), 0 20px 30px rgba(0,0,0,.3);
          transform-origin: 50% 100%;
          transition: transform .45s cubic-bezier(.3, 1.5, .5, 1);
          z-index: 2;
        }
        .discere-masuk-wrapper .card.tr {
          transform: rotate(3.5deg);
        }
        .discere-masuk-wrapper .card.tl {
          transform: rotate(-3.5deg);
        }

        .discere-masuk-wrapper .panes {
          display: grid;
        }
        .discere-masuk-wrapper .pane {
          grid-area: 1/1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          opacity: 0;
          visibility: hidden;
          transition: opacity .25s, visibility 0s .25s;
        }
        .discere-masuk-wrapper .card:not(.sr) .log,
        .discere-masuk-wrapper .card.sr .reg {
          opacity: 1;
          visibility: visible;
          transition: opacity .3s .1s, visibility 0s;
        }

        .discere-masuk-wrapper .pane h1 {
          font-size: 38px;
          line-height: 1;
          color: var(--board);
          margin-bottom: 2px;
        }
        .discere-masuk-wrapper .sub {
          font-size: 13px;
          color: var(--muted);
          margin-top: -4px;
        }

        .discere-masuk-wrapper label {
          display: block;
          font-weight: 700;
          font-size: 13px;
          margin-bottom: 4px;
          color: var(--ink);
        }

        .discere-masuk-wrapper input[type=text],
        .discere-masuk-wrapper input[type=email],
        .discere-masuk-wrapper input[type=password] {
          width: 100%;
          padding: 11px 14px;
          border-radius: 14px;
          border: 2px solid var(--line);
          background: #fffdf6;
          font-family: inherit;
          font-size: 14px;
          color: var(--ink);
          box-sizing: border-box;
          outline: none;
        }
        .discere-masuk-wrapper input:focus-visible,
        .discere-masuk-wrapper button:focus-visible {
          outline: 3px solid rgba(242,194,48,.8);
          outline-offset: 2px;
          border-color: var(--board);
        }
        .discere-masuk-wrapper .input-error {
          border-color: var(--red) !important;
          background-color: #fff9f9 !important;
        }

        .discere-masuk-wrapper .pw {
          position: relative;
        }
        .discere-masuk-wrapper .pw input {
          padding-right: 44px;
        }
        .discere-masuk-wrapper .pw button {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: 0;
          color: var(--board);
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s ease;
        }
        .discere-masuk-wrapper .pw button:hover {
          opacity: 0.75;
        }

        .discere-masuk-wrapper .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }
        .discere-masuk-wrapper .row a {
          color: var(--board);
          font-weight: 700;
          text-decoration: none;
        }
        .discere-masuk-wrapper .row a:hover {
          text-decoration: underline;
        }

        .discere-masuk-wrapper .b1,
        .discere-masuk-wrapper .b2 {
          width: 100%;
          border-radius: 999px;
          padding: 12px;
          font-family: 'Nunito', sans-serif;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          transition: transform .15s;
        }
        .discere-masuk-wrapper .b1 {
          background: var(--board);
          color: var(--chalk);
          border: 0;
          box-shadow: 0 3px 0 rgba(0,0,0,.28);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .discere-masuk-wrapper .b2 {
          background: transparent;
          color: var(--board);
          border: 2px solid var(--board);
        }
        .discere-masuk-wrapper .b1:hover,
        .discere-masuk-wrapper .b2:hover {
          transform: translateY(-1px);
        }
        .discere-masuk-wrapper .b1:active,
        .discere-masuk-wrapper .b2:active {
          transform: translateY(1px);
        }
        .discere-masuk-wrapper .b1:disabled,
        .discere-masuk-wrapper .b2:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .discere-masuk-wrapper .or {
          text-align: center;
          font-size: 12px;
          color: var(--muted);
          margin: 2px 0;
        }
        .discere-masuk-wrapper .msg {
          font-size: 12px;
          color: var(--red);
          min-height: 16px;
          font-weight: 600;
          text-align: center;
        }
        .discere-masuk-wrapper .field-err {
          font-size: 11px;
          color: var(--red);
          font-weight: 600;
          margin-top: 2px;
        }

        .discere-masuk-wrapper .demo-chips {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding-top: 6px;
          border-top: 1px dashed rgba(31,74,55,.2);
          margin-top: 2px;
        }
        .discere-masuk-wrapper .demo-btn {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #fffdf6;
          color: var(--board);
          cursor: pointer;
          transition: all 0.15s;
        }
        .discere-masuk-wrapper .demo-btn:hover {
          background: var(--board);
          color: var(--chalk);
        }

        @media(prefers-reduced-motion: reduce) {
          .discere-masuk-wrapper .track,
          .discere-masuk-wrapper .card {
            transition: none !important;
          }
          .discere-masuk-wrapper .chalk .t {
            transition: none !important;
          }
        }

        .discere-masuk-wrapper .mobile-doodles {
          display: none;
        }

        @media(max-width: 819px) {
          .discere-masuk-wrapper {
            overflow: hidden !important;
          }
          .discere-masuk-wrapper .page {
            height: 100vh;
            height: 100dvh;
            max-height: 100vh;
            overflow: hidden !important;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: env(safe-area-inset-top, 8px) 16px env(safe-area-inset-bottom, 8px);
            background: radial-gradient(ellipse at 15% 12%, rgba(255, 255, 255, 0.14) 0%, transparent 45%),
                        radial-gradient(ellipse at 85% 20%, rgba(255, 255, 255, 0.10) 0%, transparent 42%),
                        radial-gradient(ellipse at 50% 85%, rgba(255, 255, 255, 0.08) 0%, transparent 50%),
                        radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.38) 100%),
                        linear-gradient(165deg, #244e39 0%, #1a3d2c 50%, #122c20 100%) !important;
          }
          .discere-masuk-wrapper .stage {
            height: 100%;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 0;
            overflow: hidden;
            position: relative;
          }
          .discere-masuk-wrapper .brand {
            left: 16px;
            top: max(12px, env(safe-area-inset-top, 12px));
            font-size: 26px;
            gap: 8px;
            z-index: 15;
          }
          .discere-masuk-wrapper .brand svg {
            width: 28px;
            height: 28px;
          }
          .discere-masuk-wrapper .flagr {
            display: block !important;
            right: 0;
            top: max(8px, env(safe-area-inset-top, 8px));
            width: 85px;
            z-index: 15;
          }
          .discere-masuk-wrapper .floor,
          .discere-masuk-wrapper .ppl,
          .discere-masuk-wrapper .rope,
          .discere-masuk-wrapper .ring,
          .discere-masuk-wrapper .chalk,
          .discere-masuk-wrapper .under {
            display: none !important;
          }
          .discere-masuk-wrapper .scaler {
            position: static;
            width: auto;
            height: auto;
            transform: none;
          }
          .discere-masuk-wrapper .track {
            position: static;
            transform: none !important;
            transition: none;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
          }
          .discere-masuk-wrapper .card {
            position: relative;
            left: auto;
            bottom: auto;
            width: min(380px, calc(100vw - 32px));
            max-height: calc(100dvh - 120px);
            padding: 18px 20px;
            overflow-y: auto;
            scrollbar-width: none;
            margin: auto 0;
            z-index: 20;
            box-shadow: 0 12px 36px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2);
            border: 2px solid rgba(228, 215, 195, 0.7);
            border-radius: 28px;
          }
          .discere-masuk-wrapper .card::-webkit-scrollbar {
            display: none;
          }
          .discere-masuk-wrapper .pane {
            gap: 8px;
          }
          .discere-masuk-wrapper .pane h1 {
            font-size: 28px;
            line-height: 1.1;
            margin-bottom: 0;
          }
          .discere-masuk-wrapper .sub {
            font-size: 13px;
            margin-bottom: 2px;
          }
          .discere-masuk-wrapper label {
            font-size: 12.5px;
            margin-top: 1px;
            font-weight: 700;
          }
          .discere-masuk-wrapper input[type=text],
          .discere-masuk-wrapper input[type=email],
          .discere-masuk-wrapper input[type=password] {
            padding: 9px 12px;
            font-size: 14px;
            border-radius: 12px;
            border-width: 1.5px;
          }
          .discere-masuk-wrapper .pw button {
            font-size: 12px;
            padding: 4px 8px;
          }
          .discere-masuk-wrapper .row {
            font-size: 12px;
            margin: 2px 0;
          }
          .discere-masuk-wrapper .b1 {
            padding: 11px;
            font-size: 15px;
            border-radius: 14px;
            margin-top: 4px;
          }
          .discere-masuk-wrapper .or {
            font-size: 12px;
            margin: 3px 0 1px;
          }
          .discere-masuk-wrapper .b2 {
            padding: 10px;
            font-size: 14px;
            border-radius: 14px;
          }
          .discere-masuk-wrapper .demo-chips {
            gap: 6px;
            padding-top: 6px;
            margin-top: 4px;
          }
          .discere-masuk-wrapper .demo-btn {
            padding: 3px 10px;
            font-size: 11.5px;
            min-height: 26px;
          }

          /* Detail Hiasan & Doodle Mobile */
          .discere-masuk-wrapper .mobile-doodles {
            display: block;
            pointer-events: none;
          }
          .discere-masuk-wrapper .doodle-bulb {
            position: absolute;
            right: 14px;
            top: max(56px, calc(env(safe-area-inset-top, 12px) + 44px));
            width: 58px;
            height: 58px;
            opacity: 0.85;
            z-index: 2;
          }
          .discere-masuk-wrapper .doodle-plane {
            position: absolute;
            left: 12px;
            top: max(58px, calc(env(safe-area-inset-top, 12px) + 46px));
            width: 62px;
            height: 62px;
            opacity: 0.8;
            z-index: 2;
          }
          .discere-masuk-wrapper .doodle-star {
            position: absolute;
            z-index: 2;
          }
          .discere-masuk-wrapper .doodle-star.star-1 {
            left: 18px;
            top: 42%;
            width: 16px;
            height: 16px;
            opacity: 0.45;
          }
          .discere-masuk-wrapper .doodle-star.star-2 {
            right: 16px;
            top: 38%;
            width: 18px;
            height: 18px;
            opacity: 0.65;
          }
          .discere-masuk-wrapper .doodle-star.star-3 {
            right: 22px;
            bottom: 60px;
            width: 15px;
            height: 15px;
            opacity: 0.45;
          }
          .discere-masuk-wrapper .doodle-formula {
            position: absolute;
            font-family: 'Caveat', cursive;
            font-size: 15px;
            font-weight: 700;
            color: rgba(244, 236, 216, 0.35);
            z-index: 2;
            display: none;
          }
          @media(min-width: 440px) {
            .discere-masuk-wrapper .doodle-formula {
              display: block;
            }
          }
          .discere-masuk-wrapper .formula-left {
            left: 14px;
            bottom: 84px;
            transform: rotate(-6deg);
          }
          .discere-masuk-wrapper .formula-right {
            right: 16px;
            bottom: 92px;
            transform: rotate(5deg);
          }
          .discere-masuk-wrapper .mobile-motto {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            bottom: max(22px, calc(env(safe-area-inset-bottom, 8px) + 16px));
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 10;
            white-space: nowrap;
          }
          .discere-masuk-wrapper .motto-text {
            font-family: 'Caveat', cursive;
            font-size: 15px;
            font-weight: 700;
            color: rgba(244, 236, 216, 0.88);
            text-shadow: 0 1px 4px rgba(0,0,0,0.5);
          }
          .discere-masuk-wrapper .motto-curve {
            width: 125px;
            height: 8px;
            margin-top: 1px;
          }
          .discere-masuk-wrapper .mobile-floor-bar {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 14px;
            background: linear-gradient(#b99672 0 3px, #8b6a4a 3px);
            z-index: 10;
            display: flex;
            align-items: flex-end;
            justify-content: flex-end;
            padding-right: 20px;
            gap: 6px;
          }
          .discere-masuk-wrapper .chalk-stick {
            width: 16px;
            height: 6px;
            border-radius: 2px 2px 0 0;
            box-shadow: 0 1px 2px rgba(0,0,0,0.35);
          }
          .discere-masuk-wrapper .chalk-white {
            background: #f4ecd8;
          }
          .discere-masuk-wrapper .chalk-red {
            background: #c8362f;
          }
          .discere-masuk-wrapper .chalk-yellow {
            background: #f2c230;
          }
          .discere-masuk-wrapper .chalk-eraser {
            width: 28px;
            height: 9px;
            background: #5a422d;
            border-radius: 2px 2px 0 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.45);
          }
        }
      `}</style>

      <div className="page">
        {/* ELEMEN STAGE UTAMA */}
        <main
          className={`stage ${isReg ? 'reg' : ''} ${isWalking ? 'walk' : ''}`}
          id="stage"
        >
          {/* LOGO DISCERE */}
          <Link to="/" className="brand" title="Kembali ke Beranda">
            <svg
              width="34"
              height="34"
              viewBox="0 0 48 48"
              fill="none"
              stroke="#f4ecd8"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M5 11c7-3 14-1 19 4v26c-5-5-12-7-19-4zM43 11c-7-3-14-1-19 4v26c5-5 12-7 19-4z" />
              <path d="M10 19h8M10 26h8M30 19h8M30 26h8" />
            </svg>
            <span>Discere</span>
          </Link>

          {/* BENDERA MERAH PUTIH BERKIBAR (KANAN ATAS) */}
          <svg className="flagr" viewBox="0 0 230 120" aria-hidden="true">
            <path d="M0 6C50 -6 90 30 140 20S200 10 230 30L230 62C200 42 160 56 130 62S50 40 0 54z" fill="#c8362f" />
            <path d="M0 54C50 40 90 62 130 62S200 42 230 62L230 92C200 74 160 86 130 92S50 70 0 86z" fill="#f6f1e6" />
          </svg>

          {/* HIASAN & DOODLE PAPAN TULIS KHUSUS MODE MOBILE */}
          <div className="mobile-doodles" aria-hidden="true">
            {/* Bohlam Ide Menyala (Kanan Atas) */}
            <svg className="doodle-bulb" viewBox="0 0 100 100" fill="none" stroke="#f4ecd8">
              <path
                d="M38 58 C 30 50, 28 38, 33 26 C 39 15, 61 15, 67 26 C 72 38, 70 50, 62 58 L 62 65 L 38 65 Z"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="rgba(244, 236, 216, 0.05)"
              />
              <path d="M41 70 H 59 M43 74 H 57 M46 78 H 54" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M45 44 C 45 37, 55 37, 55 44 L 50 51 Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M50 8 V 3" strokeWidth="2.5" strokeLinecap="round" stroke="#f2c230" />
              <path d="M26 17 L 20 11" strokeWidth="2.5" strokeLinecap="round" stroke="#f2c230" />
              <path d="M74 17 L 80 11" strokeWidth="2.5" strokeLinecap="round" stroke="#f2c230" />
              <path d="M14 36 L 7 36" strokeWidth="2.5" strokeLinecap="round" stroke="#f2c230" />
              <path d="M86 36 L 93 36" strokeWidth="2.5" strokeLinecap="round" stroke="#f2c230" />
            </svg>

            {/* Pesawat Kertas Origami (Kiri Atas) */}
            <svg className="doodle-plane" viewBox="0 0 120 120" fill="none" stroke="#f4ecd8">
              <path
                d="M10 100 C 18 65, 52 50, 40 25 C 28 10, 10 32, 34 52 C 58 66, 78 50, 95 34"
                strokeWidth="2"
                strokeDasharray="4 5"
                strokeLinecap="round"
              />
              <path
                d="M95 34 L 115 16 L 78 42 L 86 54 L 95 34 Z"
                strokeWidth="2"
                strokeLinejoin="round"
                fill="rgba(244, 236, 216, 0.07)"
              />
              <path d="M115 16 L 84 48" strokeWidth="1.6" />
            </svg>

            {/* Bintang-Bintang Kapur */}
            <svg className="doodle-star star-1" viewBox="0 0 24 24" fill="none" stroke="#f4ecd8" strokeWidth="2">
              <path d="M12 2 L 15 9 L 22 9 L 16.5 13.5 L 18.5 20.5 L 12 16 L 5.5 20.5 L 7.5 13.5 L 2 9 L 9 9 Z" />
            </svg>
            <svg className="doodle-star star-2" viewBox="0 0 24 24" fill="none" stroke="#f2c230" strokeWidth="2">
              <path d="M12 2 L 15 9 L 22 9 L 16.5 13.5 L 18.5 20.5 L 12 16 L 5.5 20.5 L 7.5 13.5 L 2 9 L 9 9 Z" />
            </svg>
            <svg className="doodle-star star-3" viewBox="0 0 24 24" fill="none" stroke="#f4ecd8" strokeWidth="2">
              <path d="M12 2 L 15 9 L 22 9 L 16.5 13.5 L 18.5 20.5 L 12 16 L 5.5 20.5 L 7.5 13.5 L 2 9 L 9 9 Z" />
            </svg>

            {/* Coretan Rumus Matematika di Kiri & Kanan */}
            <div className="doodle-formula formula-left">
              <span>a² + b² = c²</span>
            </div>
            <div className="doodle-formula formula-right">
              <span>E = mc²</span>
            </div>

            {/* Motto di Bawah Kartu */}
            <div className="mobile-motto">
              <span className="motto-text">Discere • Belajar Lebih Menyenangkan</span>
              <svg className="motto-curve" viewBox="0 0 120 10" fill="none" stroke="#f2c230" strokeWidth="2.6" strokeLinecap="round">
                <path d="M4 7 Q 60 2 116 6" />
              </svg>
            </div>

            {/* Rak Kayu Bawah dengan Batang Kapur & Penghapus */}
            <div className="mobile-floor-bar">
              <div className="chalk-stick chalk-white" />
              <div className="chalk-stick chalk-red" />
              <div className="chalk-stick chalk-yellow" />
              <div className="chalk-eraser" />
            </div>
          </div>

          {/* LANTAI KAYU MEJA */}
          <div className="floor" />

          {/* SCALER KANVAS 1200px */}
          <div className="scaler">
            {/* ANIMASI TEKS KAPUR DI TENGAH PAPAN TULIS */}
            <div className="chalk" aria-hidden="true">
              <div className="t a">
                <h2 className="hand">Selamat datang kembali!</h2>
                <p>Masuk dan lanjutkan belajar yang menyenangkan.</p>
              </div>
              <div className="t b">
                <h2 className="hand">Yuk, gabung bareng Discere!</h2>
                <p>Buat akun untuk mulai mengajar lebih mudah.</p>
              </div>
            </div>

            {/* TRACK DENGAN TALI, KARAKTER & KARTU */}
            <div className="track" id="track" ref={trackRef}>
              <svg className="rope" id="rL" ref={rLRef} style={{ left: '-457px' }} aria-hidden="true">
                <path />
                <path />
              </svg>
              <svg className="rope" id="rR" ref={rRRef} style={{ left: '440px' }} aria-hidden="true">
                <path />
                <path />
              </svg>

              <svg
                className={`ppl ${strainPerson === 'pL' ? 'strain' : ''}`}
                id="pL"
                ref={pLRef}
                viewBox="0 0 200 260"
                style={{ left: '-580px' }}
                aria-hidden="true"
              />
              <svg
                className={`ppl ${strainPerson === 'pR' ? 'strain' : ''}`}
                id="pR"
                ref={pRRef}
                viewBox="0 0 200 260"
                style={{ left: '860px' }}
                aria-hidden="true"
              />

              {/* KARTU FORMULIR DENGAN EFEK MIRING & DUA PANE */}
              <section
                className={`card ${cardSr ? 'sr' : ''} ${cardTilt}`}
                id="card"
                ref={cardRef}
                aria-label="Formulir masuk dan daftar"
              >
                <div className="panes">
                  {/* ======================================================== */}
                  {/* PANE 1: FORM MASUK (LOGIN)                               */}
                  {/* ======================================================== */}
                  <form className="pane log" id="fLog" onSubmit={handleSubmitMasuk} noValidate>
                    <h1 className="hand">Masuk</h1>
                    <p className="sub">Senang melihatmu lagi. Silakan masuk ke akunmu.</p>

                    {loginServerError && (
                      <div className="msg" role="alert">
                        {loginServerError}
                      </div>
                    )}

                    {/* Email */}
                    <div>
                      <label htmlFor="le">Email</label>
                      <input
                        id="le"
                        type="email"
                        placeholder="guru@sekolah.id"
                        autoComplete="email"
                        value={loginEmail}
                        onChange={(e) => {
                          setLoginEmail(e.target.value);
                          if (loginErrors.email) setLoginErrors((prev) => ({ ...prev, email: '' }));
                          if (loginServerError) setLoginServerError('');
                        }}
                        className={loginErrors.email ? 'input-error' : ''}
                        required
                      />
                      {loginErrors.email && <p className="field-err">{loginErrors.email}</p>}
                    </div>

                    {/* Kata Sandi */}
                    <div>
                      <label htmlFor="lp">Kata sandi</label>
                      <div className="pw">
                        <input
                          id="lp"
                          type={lihatLoginKataSandi ? 'text' : 'password'}
                          placeholder="Kata sandi"
                          autoComplete="current-password"
                          value={loginKataSandi}
                          onChange={(e) => {
                            setLoginKataSandi(e.target.value);
                            if (loginErrors.kataSandi) setLoginErrors((prev) => ({ ...prev, kataSandi: '' }));
                            if (loginServerError) setLoginServerError('');
                          }}
                          className={loginErrors.kataSandi ? 'input-error' : ''}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setLihatLoginKataSandi((prev) => !prev)}
                          tabIndex={-1}
                          aria-label={lihatLoginKataSandi ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                          title={lihatLoginKataSandi ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                        >
                          {lihatLoginKataSandi ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {loginErrors.kataSandi && <p className="field-err">{loginErrors.kataSandi}</p>}
                    </div>

                    {/* Ingat Saya & Lupa Sandi */}
                    <div className="row">
                      <label style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={ingatSaya}
                          onChange={(e) => setIngatSaya(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>Ingat saya</span>
                      </label>
                      <span className="text-xs text-slate-500 font-medium">Lupa sandi? Hubungi admin</span>
                    </div>

                    {/* Tombol Masuk */}
                    <button className="b1" type="submit" disabled={isSubmittingLogin}>
                      {isSubmittingLogin ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Memproses...</span>
                        </>
                      ) : (
                        'Masuk'
                      )}
                    </button>

                    {/* Tombol Beralih ke Daftar */}
                    <p className="or">Belum punya akun?</p>
                    <button
                      className="b2"
                      type="button"
                      onClick={() => switchView('reg')}
                    >
                      Daftar
                    </button>

                    {/* Akun Demo Cepat */}
                    <div className="demo-chips">
                      <span className="text-[11px] text-[#58705f] font-semibold">Demo:</span>
                      <button
                        type="button"
                        className="demo-btn"
                        onClick={() => isiAkunDemo('guru')}
                        title="Isi otomatis akun Guru demo"
                      >
                        Guru
                      </button>
                      <button
                        type="button"
                        className="demo-btn"
                        onClick={() => isiAkunDemo('admin')}
                        title="Isi otomatis akun Admin demo"
                      >
                        Admin
                      </button>
                    </div>
                  </form>

                  {/* ======================================================== */}
                  {/* PANE 2: FORM DAFTAR (REGISTER)                           */}
                  {/* ======================================================== */}
                  <form className="pane reg" id="fReg" onSubmit={handleSubmitDaftar} noValidate>
                    <h1 className="hand">Daftar</h1>
                    <p className="sub">Buat akun baru guru dalam hitungan detik.</p>

                    {daftarServerError && (
                      <div className="msg" role="alert">
                        {daftarServerError}
                      </div>
                    )}

                    {/* Nama Lengkap */}
                    <div>
                      <label htmlFor="rn">Nama lengkap</label>
                      <input
                        id="rn"
                        type="text"
                        placeholder="Nama kamu"
                        autoComplete="name"
                        value={daftarNama}
                        onChange={(e) => {
                          setDaftarNama(e.target.value);
                          if (daftarErrors.nama) setDaftarErrors((prev) => ({ ...prev, nama: '' }));
                          if (daftarServerError) setDaftarServerError('');
                        }}
                        className={daftarErrors.nama ? 'input-error' : ''}
                        required
                      />
                      {daftarErrors.nama && <p className="field-err">{daftarErrors.nama}</p>}
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="re">Email</label>
                      <input
                        id="re"
                        type="email"
                        placeholder="guru@sekolah.id"
                        autoComplete="email"
                        value={daftarEmail}
                        onChange={(e) => {
                          setDaftarEmail(e.target.value);
                          if (daftarErrors.email) setDaftarErrors((prev) => ({ ...prev, email: '' }));
                          if (daftarServerError) setDaftarServerError('');
                        }}
                        className={daftarErrors.email ? 'input-error' : ''}
                        required
                      />
                      {daftarErrors.email && <p className="field-err">{daftarErrors.email}</p>}
                    </div>

                    {/* Kata Sandi */}
                    <div>
                      <label htmlFor="rp">Kata sandi</label>
                      <div className="pw">
                        <input
                          id="rp"
                          type={lihatDaftarKataSandi ? 'text' : 'password'}
                          placeholder="Minimal 8 karakter"
                          autoComplete="new-password"
                          value={daftarKataSandi}
                          onChange={(e) => {
                            setDaftarKataSandi(e.target.value);
                            if (daftarErrors.kataSandi) setDaftarErrors((prev) => ({ ...prev, kataSandi: '' }));
                            if (daftarServerError) setDaftarServerError('');
                          }}
                          className={daftarErrors.kataSandi ? 'input-error' : ''}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setLihatDaftarKataSandi((prev) => !prev)}
                          tabIndex={-1}
                          aria-label={lihatDaftarKataSandi ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                          title={lihatDaftarKataSandi ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                        >
                          {lihatDaftarKataSandi ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {daftarErrors.kataSandi && <p className="field-err">{daftarErrors.kataSandi}</p>}
                    </div>

                    {/* Nama Sekolah (Opsional) */}
                    <div>
                      <label htmlFor="rs">Nama sekolah (opsional)</label>
                      <input
                        id="rs"
                        type="text"
                        placeholder="Contoh: SDN 1 Merdeka"
                        autoComplete="organization"
                        value={daftarSekolah}
                        onChange={(e) => setDaftarSekolah(e.target.value)}
                      />
                    </div>

                    {/* Tombol Daftar */}
                    <button className="b1" type="submit" disabled={isSubmittingDaftar} style={{ marginTop: '4px' }}>
                      {isSubmittingDaftar ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Mendaftarkan...</span>
                        </>
                      ) : (
                        'Daftar'
                      )}
                    </button>

                    {/* Tombol Beralih ke Masuk */}
                    <button
                      className="b2"
                      type="button"
                      onClick={() => switchView('log')}
                    >
                      Sudah punya akun? Masuk
                    </button>
                  </form>
                </div>
              </section>

              {/* Cincin Pengait Tali */}
              <div className="ring" style={{ left: '431px' }} />
              <div className="ring" style={{ left: '31px' }} />
            </div>
          </div>
        </main>

        {/* LANTAI KAYU BAWAH */}
        <div className="under" />
      </div>
    </div>
  );
}
