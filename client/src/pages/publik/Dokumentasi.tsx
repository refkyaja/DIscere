import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';

interface SectionMeta {
  id: string;
  title: string;
}

const SECTIONS: SectionMeta[] = [
  { id: 'pengantar', title: 'Pengantar' },
  { id: 'memulai', title: 'Mulai cepat' },
  { id: 'dashboard', title: 'Dashboard guru' },
  { id: 'template', title: 'Membuat template dan soal' },
  { id: 'papan-tulis', title: 'Papan tulis digital' },
  { id: 'ai', title: 'Fitur AI' },
  { id: 'permainan', title: 'Bermain Tarik Tambang' },
  { id: 'kolaborasi', title: 'Kolaborasi papan' },
  { id: 'riwayat', title: 'Riwayat dan statistik' },
  { id: 'privasi', title: 'Privasi dan keamanan' },
  { id: 'tips', title: 'Tips untuk guru' },
  { id: 'faq', title: 'Pertanyaan umum' },
  { id: 'bantuan', title: 'Bantuan' },
];

export default function Dokumentasi() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('pengantar');
  const [searchQuery, setSearchQuery] = useState('');
  const [tocOpen, setTocOpen] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);

  const dashboardUrl = user?.role === 'admin' ? '/admin' : '/guru';

  // IntersectionObserver untuk melacak seksi yang sedang aktif
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 120;
      for (const section of SECTIONS) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const offset = 24;
      const elementPosition = el.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth',
      });
      window.history.pushState(null, '', `#${id}`);
      setActiveSection(id);
      setTocOpen(false);
    }
  };

  // Filter daftar isi berdasarkan pencarian
  const filteredSections = SECTIONS.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = s.title.toLowerCase().includes(q);
    const el = document.getElementById(s.id);
    const contentMatch = el ? el.textContent?.toLowerCase().includes(q) : false;
    return titleMatch || contentMatch;
  });

  return (
    <div className="discere-doc-page">
      <style>{`
        .discere-doc-page {
          --board: #1f4a37;
          --board-d: #163a2b;
          --cream: #f4ecd9;
          --card: #fbf6e9;
          --ink: #1d3b2e;
          --muted: #4d6457;
          --chalk: #f4ecd8;
          --yellow: #f2c230;
          --red: #c8362f;
          --line: rgba(31, 74, 55, 0.18);
          font-family: 'Nunito', system-ui, -apple-system, sans-serif;
          background: var(--cream);
          color: var(--ink);
          line-height: 1.65;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .discere-doc-page * {
          box-sizing: border-box;
        }

        .discere-doc-page a {
          color: inherit;
        }

        .discere-doc-page a:focus-visible,
        .discere-doc-page summary:focus-visible,
        .discere-doc-page input:focus-visible {
          outline: 3px solid var(--yellow);
          outline-offset: 3px;
        }

        .discere-doc-page .hand {
          font-family: 'Caveat', 'Comic Sans MS', cursive;
          font-weight: 700;
        }

        .discere-doc-page svg {
          display: block;
        }

        /* Header Papan Tulis */
        .discere-doc-page .top {
          position: relative;
          color: var(--chalk);
          padding-bottom: 90px;
          background:
            radial-gradient(ellipse at 25% 10%, rgba(255, 255, 255, 0.1), transparent 55%),
            repeating-linear-gradient(115deg, rgba(255, 255, 255, 0.03) 0 2px, transparent 2px 11px),
            linear-gradient(160deg, #2c5f47, var(--board) 55%, var(--board-d));
        }

        .discere-doc-page .wrap {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .discere-doc-page nav.bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 0;
        }

        .discere-doc-page .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          font-size: 22px;
          text-decoration: none;
          color: var(--chalk);
        }

        .discere-doc-page .nav-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          color: var(--chalk);
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.2s;
        }

        .discere-doc-page .nav-action-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        .discere-doc-page .hero {
          padding-top: 30px;
          max-width: 680px;
        }

        .discere-doc-page .hero h1 {
          font-size: clamp(40px, 6vw, 64px);
          line-height: 1.08;
          color: var(--chalk);
        }

        .discere-doc-page .hero h1 u {
          text-decoration: underline;
          text-decoration-color: var(--yellow);
          text-decoration-thickness: 4px;
          text-underline-offset: 8px;
          text-decoration-skip-ink: none;
        }

        .discere-doc-page .hero p {
          margin: 14px 0 22px;
          font-size: 17px;
          color: rgba(244, 236, 216, 0.9);
        }

        .discere-doc-page .wave {
          position: absolute;
          left: 0;
          bottom: -1px;
          width: 100%;
          height: 60px;
        }

        /* Tata Letak */
        .discere-doc-page .layout {
          display: grid;
          grid-template-columns: 240px minmax(0, 1fr);
          gap: 48px;
          max-width: 1100px;
          margin: 0 auto;
          padding: 10px 24px 60px;
          width: 100%;
          flex: 1;
        }

        .discere-doc-page .side {
          position: sticky;
          top: 16px;
          align-self: start;
          max-height: calc(100vh - 32px);
          overflow: auto;
          padding-top: 8px;
        }

        .discere-doc-page .side h2 {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          margin-bottom: 8px;
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
        }

        .discere-doc-page .side input[type=search] {
          width: 100%;
          margin-bottom: 12px;
          padding: 9px 12px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: #fff;
          font-family: 'Nunito', sans-serif;
          font-size: 14px;
          color: var(--ink);
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.04);
        }

        .discere-doc-page .side input[type=search]::placeholder {
          color: var(--muted);
        }

        .discere-doc-page .toc a {
          display: block;
          padding: 8px 14px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          font-size: 15px;
          color: var(--muted);
          border-left: 3px solid transparent;
          transition: all 0.15s;
        }

        .discere-doc-page .toc a:hover {
          background: rgba(31, 74, 55, 0.07);
          color: var(--ink);
        }

        .discere-doc-page .toc a.on {
          background: var(--card);
          color: var(--board);
          font-weight: 800;
          border-left-color: var(--red);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
        }

        .discere-doc-page .tocm {
          display: none;
          margin-bottom: 24px;
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 12px 16px;
        }

        .discere-doc-page .tocm summary {
          font-weight: 800;
          cursor: pointer;
          color: var(--board);
        }

        /* Konten Utama */
        .discere-doc-page main section {
          padding: 6px 0 34px;
          scroll-margin-top: 24px;
        }

        .discere-doc-page main h2 {
          font-size: 42px;
          line-height: 1.1;
          color: var(--board);
          margin: 28px 0 12px;
        }

        .discere-doc-page main h2 u {
          text-decoration: underline;
          text-decoration-color: var(--red);
          text-decoration-thickness: 3px;
          text-underline-offset: 8px;
          text-decoration-skip-ink: none;
        }

        .discere-doc-page main h3 {
          font-size: 19px;
          color: var(--board-d);
          margin: 22px 0 6px;
          font-weight: 700;
        }

        .discere-doc-page main p {
          margin: 0 0 12px;
          max-width: 68ch;
        }

        .discere-doc-page main ul.l {
          margin: 0 0 14px 22px;
          max-width: 66ch;
        }

        .discere-doc-page main ul.l li {
          margin-bottom: 6px;
        }

        .discere-doc-page code,
        .discere-doc-page kbd {
          font-family: ui-monospace, Menlo, Consolas, monospace;
          font-size: 0.9em;
          background: rgba(31, 74, 55, 0.09);
          padding: 1px 7px;
          border-radius: 7px;
        }

        .discere-doc-page .note,
        .discere-doc-page .tip {
          border-radius: 16px;
          padding: 14px 18px;
          margin: 16px 0;
          max-width: 68ch;
          border: 1px solid var(--line);
          border-left: 5px solid var(--yellow);
          background: var(--card);
        }

        .discere-doc-page .tip {
          border-left-color: var(--board);
        }

        .discere-doc-page .note b,
        .discere-doc-page .tip b {
          display: block;
          color: var(--board-d);
          margin-bottom: 2px;
        }

        .discere-doc-page .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin: 16px 0;
        }

        .discere-doc-page .grid.auto {
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        }

        .discere-doc-page .cd {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 22px 26px 20px 26px;
          padding: 18px;
          box-shadow: 0 4px 12px rgba(40, 50, 30, 0.09);
        }

        .discere-doc-page .cd svg {
          width: 44px;
          height: 44px;
          color: var(--board);
          margin-bottom: 6px;
        }

        .discere-doc-page .cd h3 {
          margin: 0 0 4px;
          font-size: 17px;
        }

        .discere-doc-page .cd p {
          font-size: 14px;
          color: var(--muted);
          margin: 0;
        }

        .discere-doc-page .n {
          display: inline-grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--board);
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          margin-right: 6px;
          vertical-align: 2px;
        }

        .discere-doc-page .game {
          border-radius: 20px;
          overflow: hidden;
          background: var(--card);
          border: 1px solid var(--line);
          box-shadow: 0 4px 12px rgba(40, 50, 30, 0.09);
          max-width: 520px;
        }

        .discere-doc-page .game .st {
          height: 74px;
          position: relative;
          background: linear-gradient(#bfe3ee 0 55%, #7cc06a 55%);
        }

        .discere-doc-page .game .st i {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: var(--red);
          color: #fff;
          font: 700 24px 'Caveat', cursive;
          padding: 0 16px;
          border-radius: 3px;
          font-style: normal;
          white-space: nowrap;
          box-shadow: 0 3px 0 rgba(0, 0, 0, 0.22);
        }

        .discere-doc-page .game div.b {
          padding: 14px 16px;
        }

        .discere-doc-page .game h3 {
          margin: 0 0 4px;
          font-size: 17px;
        }

        .discere-doc-page .game p {
          font-size: 14px;
          color: var(--muted);
          margin: 0 0 6px;
        }

        .discere-doc-page .game small {
          font-weight: 700;
          color: var(--board);
        }

        .discere-doc-page .tbl {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin: 14px 0;
          max-width: 68ch;
        }

        .discere-doc-page .tbl .tc {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 10px 14px;
        }

        .discere-doc-page .tbl .tc b {
          display: block;
          font-size: 14px;
          margin-bottom: 2px;
        }

        .discere-doc-page .tbl .tc span {
          font-size: 13px;
          color: var(--muted);
        }

        .discere-doc-page .badge {
          display: inline-block;
          font-size: 12px;
          font-weight: 800;
          color: #fff;
          background: var(--red);
          border-radius: 999px;
          padding: 2px 10px;
          margin-left: 6px;
          vertical-align: 1px;
        }

        .discere-doc-page details.q {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 0 18px;
          margin-bottom: 10px;
          max-width: 68ch;
        }

        .discere-doc-page details.q summary {
          cursor: pointer;
          font-weight: 800;
          padding: 14px 0;
          list-style: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .discere-doc-page details.q summary::-webkit-details-marker {
          display: none;
        }

        .discere-doc-page details.q summary::after {
          content: "+";
          color: var(--red);
          font-size: 22px;
          line-height: 1;
        }

        .discere-doc-page details.q[open] summary::after {
          content: "−";
        }

        .discere-doc-page details.q p {
          margin-bottom: 14px;
          font-size: 14.5px;
          color: var(--muted);
        }

        /* Footer */
        .discere-doc-page footer {
          background: var(--board);
          color: var(--chalk);
          text-align: center;
          padding: 26px 24px;
          font-size: 14px;
          margin-top: auto;
        }

        .discere-doc-page footer b {
          font-family: 'Caveat', cursive;
          font-size: 24px;
          display: block;
          margin-bottom: 4px;
        }

        .discere-doc-page footer .lk {
          display: inline-flex;
          gap: 18px;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 10px;
        }

        .discere-doc-page footer .lk a {
          text-decoration: underline;
          text-decoration-color: var(--yellow);
          color: var(--chalk);
        }

        @media(max-width: 899px) {
          .discere-doc-page .layout {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .discere-doc-page .side {
            display: none;
          }
          .discere-doc-page .tocm {
            display: block;
          }
        }

        @media(max-width: 560px) {
          .discere-doc-page .grid,
          .discere-doc-page .tbl {
            grid-template-columns: 1fr;
          }
          .discere-doc-page main h2 {
            font-size: 36px;
          }
        }
      `}</style>

      {/* SVG Symbols */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <symbol id="ib" viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
              <path d="M5 11c7-3 14-1 19 4v26c-5-5-12-7-19-4zM43 11c-7-3-14-1-19 4v26c5-5 12-7 19-4z" />
              <path d="M10 19h8M10 26h8M30 19h8M30 26h8" />
            </g>
          </symbol>
          <symbol id="it" viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
              <rect x="4" y="8" width="40" height="27" rx="3" />
              <path d="M19 15l12 6-12 6zM16 42h16M24 35v7" />
            </g>
          </symbol>
          <symbol id="ip" viewBox="0 0 48 48">
            <path
              fill="currentColor"
              d="M14 14h20c7 0 10 6 11 14 .6 5-2 8-6 6l-5-4H14l-5 4c-4 2-6.600-1-6-6 1-8 4-14 11-14z"
            />
            <g stroke="#fbf6e9" strokeWidth="3" strokeLinecap="round">
              <path d="M13 21v6M10 24h6" />
            </g>
            <circle cx="31" cy="22" r="2" fill="#fbf6e9" />
            <circle cx="36" cy="26" r="2" fill="#fbf6e9" />
          </symbol>
          <symbol id="ic" viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
              <path d="M13 6h22v12a11 11 0 0 1-22 0zM13 10H6c0 8 3 11 8 12M35 10h7c0 8-3 11-8 12M24 29v8M15 42h18M18 37h12" />
            </g>
          </symbol>
          <symbol id="ia" viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
              <path d="M24 4l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
              <path d="M38 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
            </g>
          </symbol>
        </defs>
      </svg>

      {/* Header Papan Tulis */}
      <header className="top">
        <div className="wrap">
          <nav className="bar" aria-label="Navigasi utama">
            <Link className="logo" to="/">
              <svg width="38" height="38" style={{ color: 'var(--chalk)' }}>
                <use href="#ib" />
              </svg>
              Discere
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Link to="/" className="nav-action-btn">
                ← Beranda
              </Link>
              {user ? (
                <Link to={dashboardUrl} className="nav-action-btn" style={{ background: 'var(--yellow)', color: 'var(--board-d)', borderColor: 'var(--yellow)' }}>
                  Dashboard
                </Link>
              ) : (
                <Link to="/masuk" className="nav-action-btn">
                  Masuk
                </Link>
              )}
            </div>
          </nav>
          <div className="hero">
            <h1 className="hand">
              Dokumentasi <u>Discere</u>
            </h1>
            <p>
              Panduan lengkap untuk guru: dari membuat akun, mengajar dengan papan tulis digital dan bantuan AI, sampai
              menjalankan lomba Tarik Tambang di kelas.
            </p>
          </div>
        </div>
        <svg className="wave" viewBox="0 0 1440 60" preserveAspectRatio="none" fill="#f4ecd9" aria-hidden="true">
          <path d="M0 60H1440V34C1300 8 1180 52 1040 34S780 6 600 32 340 54 200 30 50 10 0 34Z" />
        </svg>
      </header>

      {/* Tata Letak Konten & Navigasi */}
      <div className="layout">
        {/* Sidebar Navigasi Desktop */}
        <aside className="side" aria-label="Daftar isi">
          <h2>Daftar isi</h2>
          <input
            id="q"
            type="search"
            placeholder="Cari topik..."
            aria-label="Cari topik dokumentasi"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <nav className="toc">
            {filteredSections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={activeSection === s.id ? 'on' : ''}
                onClick={(e) => handleNavClick(e, s.id)}
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Konten Utama */}
        <div>
          {/* Menu Navigasi Mobile (Collapsible) */}
          <details className="tocm" open={tocOpen} onToggle={(e) => setTocOpen(e.currentTarget.open)}>
            <summary>Daftar isi: {SECTIONS.find((s) => s.id === activeSection)?.title || 'Pilih bagian'}</summary>
            <nav className="toc" style={{ marginTop: '10px' }}>
              {filteredSections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={activeSection === s.id ? 'on' : ''}
                  onClick={(e) => handleNavClick(e, s.id)}
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </details>

          <main ref={mainRef}>
            {/* 1. Pengantar */}
            <section id="pengantar" data-t="Pengantar">
              <h2 className="hand">
                Peng<u>antar</u>
              </h2>
              <p>
                Discere membantu guru menciptakan kelas yang interaktif lewat tiga hal:{' '}
                <b>papan tulis digital tak terbatas</b> untuk menjelaskan materi, <b>bantuan AI</b> untuk membuat soal
                dan menjawab pertanyaan langsung dari papan, dan <b>game Tarik Tambang</b> bertema 17 Agustusan untuk
                menguji pemahaman siswa secara seru.
              </p>
              <p>
                Dua mode permainan menjawab kendala alat yang berbeda-beda di tiap kelas: mode <b>Solo</b> cukup satu
                layar tanpa HP sama sekali, dan mode <b>Multiplayer</b> untuk kelas yang siswanya membawa HP
                masing-masing.
              </p>
            </section>

            {/* 2. Mulai Cepat */}
            <section id="memulai" data-t="Mulai cepat">
              <h2 className="hand">
                <u>Mulai cepat</u>
              </h2>
              <p>
                Discere dipakai lewat akun <b>guru</b>. Siswa tidak perlu mendaftar apa pun, mereka cukup bergabung
                memakai token saat guru memulai lomba.
              </p>
              <h3>
                <span className="n">1</span>Buat akun guru
              </h3>
              <p>
                Buka halaman <b>Daftar</b>, isi nama, email, kata sandi (minimal 8 karakter), dan nama sekolah, lalu
                tekan <code>Daftar</code>.
              </p>
              <h3>
                <span className="n">2</span>Buat template
              </h3>
              <p>
                Di Dashboard, tekan <code>Template Baru</code>. Isi judul materi, pilih mode (Solo atau Multiplayer), lalu
                isi soal secara manual atau lewat <b>Buat soal dengan AI</b>.
              </p>
              <h3>
                <span className="n">3</span>Mengajar di papan tulis
              </h3>
              <p>
                Tekan <code>Buka Papan Tulis</code> untuk menjelaskan materi. Saat siap menguji pemahaman siswa, buka
                sidebar <code>Template Game</code> di kanan papan dan pilih template yang sudah dibuat.
              </p>
              <h3>
                <span className="n">4</span>Jalankan lomba
              </h3>
              <p>
                Mode Solo langsung mulai di satu layar. Mode Multiplayer menampilkan token dan kode QR; siswa membuka
                halaman masuk siswa di HP, memasukkan token dan nama panggilan, lalu guru menekan <code>Mulai Lomba</code>.
              </p>
              <div className="tip">
                <b>Tips</b>Sudah punya akun? Tekan <code>Sudah punya akun? Masuk</code> di halaman yang sama untuk
                berpindah ke formulir masuk.
              </div>
            </section>

            {/* 3. Dashboard Guru */}
            <section id="dashboard" data-t="Dashboard guru">
              <h2 className="hand">
                Dashboard <u>guru</u>
              </h2>
              <p>Semua pekerjaan guru ada di satu tempat, terbagi jadi lima menu di sidebar kiri:</p>
              <div className="grid auto">
                <div className="cd">
                  <h3>Ringkasan</h3>
                  <p>
                    Jumlah template, sesi, dan papan yang pernah dibuat, tombol pintas untuk membuat template atau
                    membuka papan baru, serta info sesi terakhir.
                  </p>
                </div>
                <div className="cd">
                  <h3>Template</h3>
                  <p>
                    Semua template milik kamu sebagai kartu, dengan aksi Mulai, Ubah, Duplikat, dan Hapus. Ada tab
                    Pustaka Resmi berisi contoh dari admin yang bisa disalin.
                  </p>
                </div>
                <div className="cd">
                  <h3>Riwayat</h3>
                  <p>
                    Daftar sesi yang pernah dijalankan: tanggal, template, tim pemenang, dan skor akhir, lengkap dengan
                    soal yang paling sering dijawab salah.
                  </p>
                </div>
                <div className="cd">
                  <h3>Papan Tulis</h3>
                  <p>
                    Daftar papan yang pernah kamu simpan. Bisa dibuka kembali, diganti nama, atau dihapus kapan saja.
                  </p>
                </div>
                <div className="cd">
                  <h3>Pengaturan</h3>
                  <p>
                    Ubah profil dan nama sekolah, ganti kata sandi, pilih tema tampilan, atau hapus akun beserta semua
                    datanya.
                  </p>
                </div>
              </div>
            </section>

            {/* 4. Membuat Template dan Soal */}
            <section id="template" data-t="Membuat template dan soal">
              <h2 className="hand">
                Membuat <u>template dan soal</u>
              </h2>
              <p>
                Saat membuat atau mengubah template, tampilan berganti jadi layar penuh supaya kamu fokus menyusun soal
                tanpa gangguan menu lain.
              </p>
              <ul className="l">
                <li>
                  Isi <b>judul materi</b>, pilih <b>mode</b> (Solo atau Multiplayer), lalu susun daftar soalnya.
                </li>
                <li>
                  <b>Soal manual</b>: tulis sendiri pertanyaan, tiga pilihan jawaban, jawaban yang benar, dan penjelasan
                  singkat untuk jawaban yang salah.
                </li>
                <li>
                  <b>Buat soal dengan AI</b>: tempel materi pelajaran, pilih jumlah soal (5 sampai 15) dan tingkat kelas,
                  lalu AI menyusunkan draf soal lengkap beserta penjelasannya.
                </li>
                <li>
                  Template bisa <b>diduplikat</b> kalau kamu ingin membuat variasi dari materi yang sama untuk kelas lain.
                </li>
              </ul>
              <div className="note">
                <b>Catatan</b>Soal buatan AI selalu ditandai label <span className="badge">Dibuat AI</span> dan tetap bisa
                kamu ubah atau hapus. Tinjau dulu sebelum dipakai di kelas.
              </div>
            </section>

            {/* 5. Papan Tulis Digital */}
            <section id="papan-tulis" data-t="Papan tulis digital">
              <h2 className="hand">
                Papan tulis <u>digital</u>
              </h2>
              <p>
                Papan tulis Discere adalah kanvas tak terbatas: bisa digeser dan diperbesar sesuka hati, nyaman dipakai di
                laptop maupun layar sentuh.
              </p>
              <h3>Alat di sisi kiri</h3>
              <p>
                Tanya AI, Pilih, Tangan (geser papan), Laser, Pena (pulpen, spidol, pensil), Hapus, Bentuk, Teks, Tabel,
                Isi warna, Pipet warna, dan Upload gambar.
              </p>
              <h3>Yang bisa kamu lakukan</h3>
              <ul className="l">
                <li>
                  Menulis dan menggambar bebas, dengan penghapus pintar yang memotong coretan tepat di bagian yang
                  digariskan, bukan menghapus seluruh objek.
                </li>
                <li>Menyisipkan bentuk, teks, tabel, dan gambar (unggah, seret-lepas, atau tempel langsung).</li>
                <li>
                  Berpindah ke <b>mode presentasi</b> layar penuh saat mengajar di depan kelas.
                </li>
                <li>Papan tersimpan otomatis selama kamu mengajar, jadi tidak perlu disimpan manual.</li>
                <li>
                  Pintasan keyboard untuk tiap alat, misalnya <kbd>V</kbd> untuk Pilih dan <kbd>P</kbd> untuk Pena, serta{' '}
                  <kbd>Ctrl+Z</kbd>/<kbd>Ctrl+Y</kbd> untuk undo/redo.
                </li>
              </ul>
              <p>
                Di pojok kanan atas ada tombol Undo, Redo, Game (membuka sidebar Template Game), daftar peserta yang sedang
                membuka papan, mode Presentasi, dan tombol <b>Bagikan</b>.
              </p>
              <div className="tip">
                <b>Tips</b>Gunakan layar lebar atau proyektor agar tulisan terbaca dari barisan belakang kelas.
              </div>
            </section>

            {/* 6. Fitur AI */}
            <section id="ai" data-t="Fitur AI">
              <h2 className="hand">
                Fitur <u>AI</u>
              </h2>
              <p>
                Ada tiga cara memakai AI di Discere. Hasilnya selalu ditandai label{' '}
                <span className="badge">Dibuat AI</span> supaya jelas mana bagian yang buatan mesin.
              </p>
              <div className="grid auto">
                <div className="cd">
                  <h3>
                    <svg style={{ width: '34px', height: '34px', color: 'var(--board)', marginBottom: '6px' }}>
                      <use href="#ia" />
                    </svg>
                    Buat soal dari materi
                  </h3>
                  <p>
                    Tempel materi pelajaran saat membuat template, AI menyusunkan draf soal lengkap dengan penjelasan
                    jawaban salah.
                  </p>
                </div>
                <div className="cd">
                  <h3>
                    <svg style={{ width: '34px', height: '34px', color: 'var(--board)', marginBottom: '6px' }}>
                      <use href="#ia" />
                    </svg>
                    Tanya AI di papan
                  </h3>
                  <p>
                    Tekan tombol kuning Tanya AI, lingkari soal di papan, lalu jawaban, rumus, dan langkahnya muncul sebagai
                    kartu di sebelah soal.
                  </p>
                </div>
                <div className="cd">
                  <h3>
                    <svg style={{ width: '34px', height: '34px', color: 'var(--board)', marginBottom: '6px' }}>
                      <use href="#ia" />
                    </svg>
                    Obrolan AI
                  </h3>
                  <p>
                    Bar prompt di papan tulis untuk tanya jawab bebas, bisa menyertakan gambar, PDF, atau file teks
                    sebagai lampiran.
                  </p>
                </div>
              </div>
              <div className="note">
                <b>Catatan</b>Obrolan AI hanya tersimpan selama halaman terbuka dan hilang saat dimuat ulang. Setiap guru
                juga punya batas pemakaian AI per hari. Jangan masukkan data pribadi siswa ke materi yang dikirim ke AI.
              </div>
            </section>

            {/* 7. Bermain Tarik Tambang */}
            <section id="permainan" data-t="Bermain Tarik Tambang">
              <h2 className="hand">
                Bermain <u>Tarik Tambang</u>
              </h2>
              <p>
                Tarik Tambang adalah game utama Discere. Dua tim bertanding, <b>Merah</b> di kiri dan <b>Putih</b> di kanan.
                Setiap jawaban benar menarik tali satu langkah ke arah tim itu; tim yang lebih dulu menarik tali sampai
                ujung, menang.
              </p>
              <article className="game">
                <div className="st">
                  <i>Tarik Tambang</i>
                </div>
                <div className="b">
                  <h3>Dua tim, satu tali</h3>
                  <p>
                    Jawaban benar menarik tali ke arah tim yang menjawab. Soal habis sebelum tali sampai ujung? Tim yang
                    talinya lebih dekat, menang.
                  </p>
                  <small>Game bertema 17 Agustusan</small>
                </div>
              </article>
              <div className="tbl" style={{ marginTop: '18px' }}>
                <div className="tc">
                  <b>Mode Solo</b>
                  <span>
                    Satu layar, tanpa HP. Soal tampil besar dengan tiga pilihan, tim bergantian maju menyentuh jawaban.
                  </span>
                </div>
                <div className="tc">
                  <b>Mode Multiplayer</b>
                  <span>
                    Siswa memindai QR atau mengetik token di HP masing-masing, lalu dibagi dua tim secara acak dan seimbang.
                  </span>
                </div>
              </div>
              <p>
                Di mode Multiplayer, setiap soal punya waktu 15 detik. Posisi tali dan skor dihitung di server, jadi
                hasilnya sama persis di layar guru dan semua HP siswa.
              </p>
              <div className="note">
                <b>Catatan</b>Siswa tidak perlu membuat akun. Mereka cukup diingat lewat token dan nama panggilan selama
                sesi berlangsung, lalu datanya tidak disimpan setelahnya.
              </div>
            </section>

            {/* 8. Kolaborasi Papan */}
            <section id="kolaborasi" data-t="Kolaborasi papan">
              <h2 className="hand">
                Kolaborasi <u>papan</u>
              </h2>
              <p>
                Tekan tombol <b>Bagikan</b> di papan tulis untuk membuat tautan undangan dengan dua pilihan peran:
              </p>
              <ul className="l">
                <li>
                  <b>Viewer</b> — hanya bisa melihat dan menggeser pandangan papan.
                </li>
                <li>
                  <b>Editor</b> — bisa ikut menggambar dan menulis di papan yang sama.
                </li>
              </ul>
              <p>
                Siapa pun yang punya tautan itu bisa masuk tanpa akun, cukup mengisi nama panggilan. Peran bisa diganti
                atau tautannya dicabut kapan saja dari menu Bagikan yang sama.
              </p>
              <div className="tip">
                <b>Tips</b>Untuk membuka tautan dari perangkat lain, pastikan perangkat itu terhubung ke jaringan WiFi
                yang sama dengan laptop guru.
              </div>
            </section>

            {/* 9. Riwayat dan Statistik */}
            <section id="riwayat" data-t="Riwayat dan statistik">
              <h2 className="hand">
                Riwayat <u>dan statistik</u>
              </h2>
              <p>
                Setiap sesi yang selesai otomatis tercatat di menu Riwayat: tanggal, template yang dipakai, tim pemenang,
                dan skor akhir. Buka detail satu sesi untuk melihat <b>soal yang paling sering dijawab salah</b>, berguna
                untuk tahu bagian materi mana yang masih perlu dijelaskan ulang. Nama siswa tidak ikut dicatat di riwayat
                ini.
              </p>
            </section>

            {/* 10. Privasi dan Keamanan */}
            <section id="privasi" data-t="Privasi dan keamanan">
              <h2 className="hand">
                Privasi <u>dan keamanan</u>
              </h2>
              <ul className="l">
                <li>
                  Siswa tidak perlu mendaftar akun. Nama panggilan yang mereka isi hanya tersimpan selama sesi berlangsung,
                  lalu hilang.
                </li>
                <li>
                  Kata sandi guru disimpan dalam bentuk terenkripsi, tidak pernah ditampilkan ke siapa pun termasuk admin.
                </li>
                <li>
                  Admin platform tidak bisa membuka isi papan tulis, template dan soal privat, atau hasil sesi milik guru.
                  Admin hanya mengelola akun dan melihat angka statistik gabungan seluruh platform.
                </li>
                <li>
                  Jangan masukkan data pribadi siswa (nama lengkap, alamat, dan sejenisnya) ke materi yang dikirim ke fitur
                  AI.
                </li>
              </ul>
            </section>

            {/* 11. Tips untuk Guru */}
            <section id="tips" data-t="Tips untuk guru">
              <h2 className="hand">
                Tips untuk <u>guru</u>
              </h2>
              <ul className="l">
                <li>Jelaskan materi dulu di papan tulis, baru lanjut ke permainan Tarik Tambang.</li>
                <li>Bagi kelas menjadi tim kecil supaya semua siswa terlibat, terutama saat memakai mode Solo.</li>
                <li>
                  Pakai fitur Tanya AI saat ada pertanyaan dadakan dari siswa yang ingin langsung dijawab di papan.
                </li>
                <li>Tutup sesi dengan membuka Riwayat dan merangkum soal yang paling sering dijawab keliru.</li>
              </ul>
            </section>

            {/* 12. Pertanyaan Umum */}
            <section id="faq" data-t="Pertanyaan umum">
              <h2 className="hand">
                Pertanyaan <u>umum</u>
              </h2>
              <details className="q">
                <summary>Apakah siswa perlu mendaftar akun?</summary>
                <p>
                  Tidak. Siswa cukup memasukkan token sesi dan nama panggilan saat bergabung, tanpa perlu akun atau kata
                  sandi.
                </p>
              </details>
              <details className="q">
                <summary>Perangkat apa yang paling cocok?</summary>
                <p>
                  Laptop atau layar proyektor memberi pengalaman terbaik untuk papan tulis. Untuk mode Multiplayer, HP
                  siswa cukup dipakai untuk menjawab soal.
                </p>
              </details>
              <details className="q">
                <summary>Saya lupa kata sandi. Bagaimana?</summary>
                <p>
                  Tekan <code>Lupa kata sandi?</code> di halaman Masuk dan ikuti petunjuknya.
                </p>
              </details>
              <details className="q">
                <summary>Apakah ada game selain Tarik Tambang?</summary>
                <p>
                  Saat ini baru Tarik Tambang yang tersedia. Game bertema 17 Agustusan lainnya masih menjadi rencana
                  pengembangan selanjutnya.
                </p>
              </details>
              <details className="q">
                <summary>Bagaimana kalau koneksi internet di kelas terputus?</summary>
                <p>
                  Fitur AI butuh internet, tapi papan tulis dan game (terutama mode Solo) tetap bisa dipakai lewat jaringan
                  WiFi lokal tanpa internet.
                </p>
              </details>
              <p style={{ marginTop: '14px', fontSize: '14px', color: 'var(--muted)' }}>
                Pertanyaan seputar biaya dan kebijakan privasi dijawab lebih lengkap di bagian{' '}
                <Link to="/#faq" style={{ fontWeight: 700, color: 'var(--board)' }}>
                  Pertanyaan Sering Muncul
                </Link>{' '}
                pada halaman utama.
              </p>
            </section>

            {/* 13. Bantuan */}
            <section id="bantuan" data-t="Bantuan">
              <h2 className="hand">
                <u>Bantuan</u>
              </h2>
              <p>
                Masih ada kendala teknis? Laporkan lewat{' '}
                <a href="https://github.com/refkyaja/DIscere/issues" target="_blank" rel="noopener noreferrer">
                  <b>Laporkan masalah</b>
                </a>{' '}
                di GitHub, atau hubungi tim kami langsung lewat{' '}
                <a href="https://wa.me/6285885455853" target="_blank" rel="noopener noreferrer">
                  <b>WhatsApp</b>
                </a>
                .
              </p>
            </section>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer>
        <b>Discere</b>Mengajar lebih mudah, belajar lebih menyenangkan.
        <div className="lk">
          <a href="https://github.com/refkyaja/DIscere" target="_blank" rel="noopener noreferrer">
            Repositori GitHub
          </a>
          <a href="https://github.com/refkyaja/DIscere/issues" target="_blank" rel="noopener noreferrer">
            Laporkan masalah
          </a>
          <a href="https://wa.me/6285885455853" target="_blank" rel="noopener noreferrer">
            Kontak tim
          </a>
        </div>
      </footer>
    </div>
  );
}
