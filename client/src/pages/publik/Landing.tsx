import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import '../../styles/landing.css';

export default function Landing() {
  const { user } = useAuth();

  // Navigation & Scroll state
  const [isStuck, setIsStuck] = useState(false);
  const [activeSection, setActiveSection] = useState('beranda');

  // Interactive Demo Blackboard state
  const [demoRevealed, setDemoRevealed] = useState(false);
  const [demoHint, setDemoHint] = useState('Lingkari soalnya dengan mouse atau jari.');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const questionRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<Array<[number, number]>>([]);

  const dashboardUrl = user?.role === 'admin' ? '/admin' : '/guru';

  // Scroll spy & sticky topbar
  useEffect(() => {
    const sectionIds = ['beranda', 'tentang', 'fitur', 'template', 'cara-kerja', 'demo'];

    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsStuck(scrollY > 20);

      let currentId = 'beranda';
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 140) {
            currentId = id;
          }
        }
      }
      setActiveSection(currentId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll handler untuk navigasi anchor menu
  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const el = document.getElementById(targetId);
    if (el) {
      const topbarHeight = 72;
      const elementPosition = el.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - topbarHeight;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth',
      });
      window.history.pushState(null, '', `#${targetId}`);
      setActiveSection(targetId);
    }
  };

  // Animasi Scroll Reveal (IntersectionObserver)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -12% 0px',
      }
    );

    const elements = document.querySelectorAll('.landing-page .reveal');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Blackboard Canvas auto-fit & resize
  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (canvas && board) {
      canvas.width = board.clientWidth;
      canvas.height = board.clientHeight;
    }
  }, []);

  useEffect(() => {
    fitCanvas();
    const board = boardRef.current;
    if (!board) return;
    const observer = new ResizeObserver(() => fitCanvas());
    observer.observe(board);
    return () => observer.disconnect();
  }, [fitCanvas]);

  // Blackboard Canvas Drawing & Collision Detection
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (demoRevealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    isDrawingRef.current = true;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const p: [number, number] = [e.clientX - rect.left, e.clientY - rect.top];
    pointsRef.current = [p];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const p: [number, number] = [e.clientX - rect.left, e.clientY - rect.top];
    const prev = pointsRef.current[pointsRef.current.length - 1];
    pointsRef.current.push(p);

    ctx.strokeStyle = '#f2c230';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(prev[0], prev[1]);
    ctx.lineTo(p[0], p[1]);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    checkCircleMatch();
  };

  const checkCircleMatch = () => {
    const canvas = canvasRef.current;
    const q = questionRef.current;
    if (!canvas || !q) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pts = pointsRef.current;
    if (pts.length < 8) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const qRect = q.getBoundingClientRect();
    const cRect = canvas.getBoundingClientRect();

    const ql = qRect.left - cRect.left;
    const qr = qRect.right - cRect.left;
    const qt = qRect.top - cRect.top;
    const qb = qRect.bottom - cRect.top;

    const intersectX = Math.max(0, Math.min(maxX, qr) - Math.max(minX, ql));
    const intersectY = Math.max(0, Math.min(maxY, qb) - Math.max(minY, qt));

    if (intersectX * intersectY >= 0.7 * (qr - ql) * (qb - qt)) {
      revealDemoAnswer();
    } else {
      setDemoHint('Belum pas. Lingkari soalnya, ya.');
      setTimeout(() => {
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }, 500);
    }
  };

  const revealDemoAnswer = () => {
    setDemoRevealed(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const resetDemo = () => {
    setDemoRevealed(false);
    setDemoHint('Lingkari soalnya dengan mouse atau jari.');
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    fitCanvas();
  };

  const ctaUrl = user ? dashboardUrl : '/daftar';

  return (
    <div className="landing-page">
      {/* SVG SYMBOLS DEFINITION */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <symbol id="kid" viewBox="0 0 40 72">
            <rect x="11" y="52" width="8" height="19" rx="3" fill="var(--pants,#3b4a8a)" />
            <rect x="21" y="52" width="8" height="19" rx="3" fill="var(--pants,#3b4a8a)" />
            <rect x="8" y="26" width="24" height="30" rx="8" fill="var(--shirt,#fff)" />
            <circle cx="20" cy="15" r="11" fill="#f0c49b" />
            <path d="M8.500 15a11.500 11.500 0 0 1 23 0c-5-6-18-6-23 0z" fill="var(--hair,#2b2b2b)" />
            <circle cx="16" cy="17" r="1.300" fill="#222" />
            <circle cx="24" cy="17" r="1.300" fill="#222" />
            <path d="M16 21q4 3 8 0" stroke="#7a3b2e" fill="none" strokeWidth="1.200" />
          </symbol>
          <symbol id="sk" viewBox="0 0 40 72">
            <path d="M6 42Q20 37 34 42L32 70H8z" fill="#d6b384" stroke="#a88455" strokeWidth="1.500" />
          </symbol>
          <symbol id="back" viewBox="0 0 100 100">
            <path d="M4 100Q4 62 50 62Q96 62 96 100z" />
            <circle cx="50" cy="38" r="30" />
            <path d="M22 32Q50 -4 78 32" fill="none" />
          </symbol>
          <symbol id="bg" viewBox="0 0 200 200">
            <rect width="200" height="200" fill="#bfe3ee" />
            <circle cx="25" cy="88" r="46" fill="#3f8f3f" />
            <circle cx="178" cy="82" r="50" fill="#357f3a" />
            <circle cx="100" cy="72" r="38" fill="#52a34e" />
            <rect y="118" width="200" height="82" fill="#7cc06a" />
            <path d="M0 120Q100 106 200 120v8H0z" fill="#6bb15a" />
            <path d="M0 8Q100 34 200 8" stroke="#6b4a2f" fill="none" strokeWidth="1.500" />
            <g fill="#d33">
              <path d="M12 11l9 3-5 12z" />
              <path d="M72 22l9 1-3 13z" />
              <path d="M122 22l9-1 0 13z" />
              <path d="M178 11l-9 3 5 12z" />
            </g>
            <g fill="#fff">
              <path d="M42 18l9 3-5 12z" />
              <path d="M98 25l9 0-4 13z" />
              <path d="M150 17l9-2 0 13z" />
            </g>
          </symbol>
          <symbol id="ic-book" viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
              <path d="M5 11c7-3 14-1 19 4v26c-5-5-12-7-19-4zM43 11c-7-3-14-1-19 4v26c5-5 12-7 19-4z" />
              <path d="M10 19h8M10 26h8M30 19h8M30 26h8" />
            </g>
          </symbol>
          <symbol id="ic-tv" viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
              <rect x="4" y="8" width="40" height="27" rx="3" />
              <path d="M19 15l12 6-12 6zM16 42h16M24 35v7" />
            </g>
          </symbol>
          <symbol id="ic-pad" viewBox="0 0 48 48">
            <g fill="currentColor">
              <path d="M14 14h20c7 0 10 6 11 14 .6 5-2 8-6 6l-5-4H14l-5 4c-4 2-6.600-1-6-6 1-8 4-14 11-14z" />
            </g>
            <g stroke="#fbf6e9" strokeWidth="3" strokeLinecap="round">
              <path d="M13 21v6M10 24h6" />
            </g>
            <circle cx="31" cy="22" r="2" fill="#fbf6e9" />
            <circle cx="36" cy="26" r="2" fill="#fbf6e9" />
          </symbol>
          <symbol id="ic-cup" viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
              <path d="M13 6h22v12a11 11 0 0 1-22 0zM13 10H6c0 8 3 11 8 12M35 10h7c0 8-3 11-8 12M24 29v8M15 42h18M18 37h12" />
            </g>
          </symbol>
          <symbol id="wv" viewBox="0 0 1440 44" preserveAspectRatio="none">
            <path d="M0 22C120 2 240 42 360 22S600 2 720 22 960 42 1080 22 1320 2 1440 22V44H0z" />
          </symbol>
          <symbol id="ic-chart" viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 42h36M12 42V26M22 42V14M32 42V22M42 42V8" />
            </g>
          </symbol>
          <symbol id="ic-lock" viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="21" width="30" height="21" rx="4" />
              <path d="M15 21v-6a9 9 0 0 1 18 0v6M24 30v5" />
            </g>
          </symbol>
          <symbol id="ic-spark" viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
              <path d="M22 5l4 13 13 4-13 4-4 13-4-13-13-4 13-4zM39 31l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
            </g>
          </symbol>
          <symbol id="ic-phone" viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <rect x="13" y="4" width="22" height="40" rx="5" />
              <path d="M21 38h6" />
            </g>
          </symbol>
          <symbol id="ic-key" viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="15" cy="24" r="9" />
              <path d="M24 24h20M37 24v7M31 24v5" />
            </g>
          </symbol>
        </defs>
      </svg>

      {/* TOPBAR NAVIGATION */}
      <div className={`topbar ${isStuck ? 'stuck' : ''}`} id="topbar">
        <div className="wrap">
          <nav>
            <a className="logo" href="#beranda" onClick={(e) => handleScrollTo(e, 'beranda')}>
              <svg width="40" height="40" style={{ color: 'var(--chalk)' }}>
                <use href="#ic-book" />
              </svg>
              Discere
            </a>
            <ul>
              <li className={activeSection === 'beranda' ? 'on' : ''}>
                <a href="#beranda" onClick={(e) => handleScrollTo(e, 'beranda')}>Beranda</a>
              </li>
              <li className={activeSection === 'tentang' ? 'on' : ''}>
                <a href="#tentang" onClick={(e) => handleScrollTo(e, 'tentang')}>Tentang</a>
              </li>
              <li className={activeSection === 'fitur' ? 'on' : ''}>
                <a href="#fitur" onClick={(e) => handleScrollTo(e, 'fitur')}>Fitur</a>
              </li>
              <li className={activeSection === 'template' ? 'on' : ''}>
                <a href="#template" onClick={(e) => handleScrollTo(e, 'template')}>Template</a>
              </li>
              <li className={activeSection === 'cara-kerja' ? 'on' : ''}>
                <a href="#cara-kerja" onClick={(e) => handleScrollTo(e, 'cara-kerja')}>Cara Kerja</a>
              </li>
              <li className={activeSection === 'demo' ? 'on' : ''}>
                <a href="#demo" onClick={(e) => handleScrollTo(e, 'demo')}>Demo</a>
              </li>
            </ul>
            <div className="acts">
              <Link className="btn sm ghost" to="/join">
                <svg viewBox="0 0 48 48" aria-hidden="true">
                  <use href="#ic-key" />
                </svg>
                Join
              </Link>
              <Link className="btn sm" to={ctaUrl}>
                <span>
                  {user ? 'Dashboard' : 'Mulai'}
                  <span className="xs">
                    {' '}
                    {user ? (user.role === 'admin' ? 'Admin' : 'Guru') : 'Sekarang'}
                  </span>
                </span>{' '}
                →
              </Link>
            </div>
          </nav>
        </div>
      </div>

      {/* HERO SECTION */}
      <header className="hero" id="beranda">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <h1 className="hand">
                Mengajar Lebih Mudah,
                <br />
                Belajar Lebih <u>Menyenangkan.</u>
              </h1>
              <p>
                Discere membantu guru menciptakan pengalaman belajar yang interaktif melalui papan
                tulis digital dan permainan edukatif.
              </p>
              <Link className="btn" to={ctaUrl}>
                Mulai Sekarang →
              </Link>
            </div>
          </div>
        </div>
        <svg className="ledge" viewBox="0 0 1440 150" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 60C140 40 300 80 460 62S780 40 960 66 1280 80 1440 54V150H0z"
            fill="#8b6a4a"
          />
          <path
            d="M0 60C140 40 300 80 460 62S780 40 960 66 1280 80 1440 54V70C1280 96 1120 82 960 80S640 60 460 78 140 56 0 76z"
            fill="#a98764"
          />
          <path
            d="M0 100C160 78 320 124 520 100S860 78 1020 104 1320 120 1440 96V150H0z"
            fill="#f4ecd9"
          />
        </svg>
        <svg
          className="hero-books"
          viewBox="0 0 90 60"
          aria-hidden="true"
        >
          <rect x="2" y="38" width="82" height="14" rx="2" fill="#6d5a45" />
          <rect x="8" y="24" width="72" height="13" rx="2" fill="#8a7a64" />
          <rect x="2" y="10" width="76" height="13" rx="2" fill="#5a6f5f" />
          <path d="M8 17h60M8 31h56M8 45h70" stroke="#e9dfc7" strokeWidth="1.500" />
        </svg>
      </header>

      <main>
        {/* TENTANG DISCERE */}
        <section className="wrap" id="tentang">
          <h2 className="sec hand reveal">
            Apa Itu <u>Discere?</u>
          </h2>
          <div className="what">
            <div className="dict reveal slide-left">
              <small>kata kerja, bahasa Latin</small>
              <div className="hand w">Discere</div>
              <div className="pr">/dis·ke·re/</div>
              <div className="hand df">belajar.</div>
            </div>
            <div>
              <p className="reveal">
                Discere adalah platform kelas interaktif untuk guru. Jelaskan materi di papan tulis
                digital, lalu uji pemahaman siswa lewat game lomba 17 Agustusan yang soalnya berasal
                dari materi itu sendiri.
              </p>
              <ul className="pil">
                <li className="reveal stagger-1">
                  <svg className="ico" viewBox="0 0 48 48">
                    <use href="#ic-tv" />
                  </svg>
                  <div>
                    <b>Papan tulis digital</b>
                    <span>Tak terbatas, bisa ditulis, digambar, dan dibagikan lewat tautan.</span>
                  </div>
                </li>
                <li className="reveal stagger-2">
                  <svg className="ico" viewBox="0 0 48 48">
                    <use href="#ic-pad" />
                  </svg>
                  <div>
                    <b>Game lomba 17-an</b>
                    <span>Tarik tambang, balap karung, dan lainnya, dengan soal dari materimu.</span>
                  </div>
                </li>
                <li className="reveal stagger-3">
                  <svg className="ico" viewBox="0 0 48 48">
                    <use href="#ic-book" />
                  </svg>
                  <div>
                    <b>AI pembantu guru</b>
                    <span>Membuat soal dari materi dan menjawab soal yang kamu lingkari di papan.</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* FITUR UTAMA */}
        <section className="wrap" id="fitur">
          <h2 className="sec hand reveal">
            Fitur <u>Utama Discere</u>
          </h2>
          <div className="feat">
            <article className="card reveal scale-up stagger-1">
              <div>
                <svg className="ico" viewBox="0 0 48 48">
                  <use href="#ic-tv" />
                </svg>
                <h3>Papan Tulis Digital</h3>
                <p>Media interaktif untuk membantu guru menjelaskan materi dengan lebih kreatif.</p>
                <Link className="btn sm dark" to={ctaUrl}>
                  Coba Sekarang →
                </Link>
              </div>
              <div className="shot" role="img" aria-label="Papan tulis digital: Sistem Tata Surya">
                <svg viewBox="0 0 320 240">
                  <rect width="320" height="240" fill="#26292a" />
                  <rect x="8" y="8" width="304" height="212" rx="4" fill="#1f4a37" />
                  <rect x="8" y="222" width="304" height="12" fill="#333" />
                  <circle cx="60" cy="130" r="22" fill="#f6c640" />
                  <g fill="none" stroke="#f4ecd8" strokeWidth="1.500">
                    <ellipse
                      cx="60"
                      cy="130"
                      rx="60"
                      ry="30"
                      transform="rotate(-14 60 130)"
                      opacity=".5"
                    />
                    <ellipse
                      cx="190"
                      cy="140"
                      rx="90"
                      ry="40"
                      transform="rotate(-14 190 140)"
                    />
                  </g>
                  <circle cx="240" cy="108" r="16" fill="#e9c58b" />
                  <ellipse
                    cx="240"
                    cy="108"
                    rx="26"
                    ry="6"
                    fill="none"
                    stroke="#f4ecd8"
                    strokeWidth="2"
                    transform="rotate(-18 240 108)"
                  />
                  <text
                    x="40"
                    y="52"
                    fontFamily="Caveat,cursive"
                    fontSize="28"
                    fill="#f4ecd8"
                    transform="rotate(-5 40 52)"
                  >
                    Sistem
                  </text>
                  <text
                    x="60"
                    y="82"
                    fontFamily="Caveat,cursive"
                    fontSize="28"
                    fill="#f4ecd8"
                    transform="rotate(-5 60 82)"
                  >
                    Tata Surya
                  </text>
                  <g fill="#bbb">
                    <circle cx="40" cy="228" r="2.500" />
                    <circle cx="60" cy="228" r="2.500" />
                    <circle cx="80" cy="228" r="2.500" />
                    <circle cx="100" cy="228" r="2.500" />
                  </g>
                  <rect x="268" y="224" width="36" height="7" rx="3" fill="#f08a24" />
                </svg>
              </div>
            </article>

            <article className="card reveal scale-up stagger-2">
              <div>
                <svg className="ico" viewBox="0 0 48 48">
                  <use href="#ic-pad" />
                </svg>
                <h3>Template Permainan</h3>
                <p>Berbagai permainan edukatif untuk membuat kelas lebih hidup dan aktif.</p>
                <a className="btn sm dark" href="#template" onClick={(e) => handleScrollTo(e, 'template')}>
                  Lihat Template →
                </a>
              </div>
              <div
                className="gm"
                style={{
                  aspectRatio: '4/3',
                  border: '4px solid #fff',
                  boxShadow: '0 8px 16px rgba(0,0,0,.3)',
                }}
                role="img"
                aria-label="Pratinjau Balap Karung"
              >
                <svg viewBox="0 20 200 150" preserveAspectRatio="xMidYMid slice">
                  <use href="#bg" width="200" height="200" />
                  <use
                    href="#kid"
                    x="22"
                    y="82"
                    width="42"
                    height="76"
                    style={{ ['--shirt' as any]: '#f4f4ee' }}
                  />
                  <use href="#sk" x="22" y="82" width="42" height="76" />
                  <use
                    href="#kid"
                    x="78"
                    y="82"
                    width="42"
                    height="76"
                    style={{ ['--shirt' as any]: '#bfe3d4', ['--hair' as any]: '#6a3b1f' }}
                  />
                  <use href="#sk" x="78" y="82" width="42" height="76" />
                  <use
                    href="#kid"
                    x="136"
                    y="82"
                    width="42"
                    height="76"
                    style={{ ['--shirt' as any]: '#fff', ['--hair' as any]: '#222' }}
                  />
                  <use href="#sk" x="136" y="82" width="42" height="76" />
                </svg>
                <span className="tag">Balap Karung</span>
                <span className="lbl">Mulai</span>
              </div>
            </article>
          </div>
        </section>

        {/* TEMPLATE SECTION */}
        <section className="band" id="template">
          <svg
            className="wave top"
            viewBox="0 0 1440 60"
            preserveAspectRatio="none"
            fill="#f4ecd9"
            aria-hidden="true"
          >
            <path d="M0 0H1440V26C1320 54 1200 6 1060 24S800 56 640 28 380 4 240 28 60 50 0 22Z" />
          </svg>
          <svg className="flag" viewBox="0 0 120 90" aria-hidden="true">
            <path d="M14 6v82" stroke="#e9e2cf" strokeWidth="4" strokeLinecap="round" />
            <circle cx="14" cy="5" r="4" fill="#e9e2cf" />
            <path
              d="M16 9.0 L19 9.4 L22 9.9 L25 10.4 L28 10.9 L31 11.3 L34 11.7 L37 11.9 L40 12.0 L43 11.9 L46 11.6 L49 11.1 L52 10.4 L55 9.6 L58 8.6 L61 7.5 L64 6.5 L67 5.5 L70 4.6 L73 3.9 L76 3.4 L79 3.2 L82 3.4 L85 3.9 L88 4.7 L91 5.8 L94 7.1 L97 8.7 L100 10.3 L103 12.0 L106 13.6 L109 15.1 L112 16.2 L115 17.1 L118 17.5 L118 71.5 L115 71.1 L112 70.2 L109 69.1 L106 67.6 L103 66.0 L100 64.3 L97 62.7 L94 61.1 L91 59.8 L88 58.7 L85 57.9 L82 57.4 L79 57.2 L76 57.4 L73 57.9 L70 58.6 L67 59.5 L64 60.5 L61 61.5 L58 62.6 L55 63.6 L52 64.4 L49 65.1 L46 65.6 L43 65.9 L40 66.0 L37 65.9 L34 65.7 L31 65.3 L28 64.9 L25 64.4 L22 63.9 L19 63.4 L16 63.0Z"
              fill="#f6f1e6"
            />
            <path
              d="M16 9.0 L19 9.4 L22 9.9 L25 10.4 L28 10.9 L31 11.3 L34 11.7 L37 11.9 L40 12.0 L43 11.9 L46 11.6 L49 11.1 L52 10.4 L55 9.6 L58 8.6 L61 7.5 L64 6.5 L67 5.5 L70 4.6 L73 3.9 L76 3.4 L79 3.2 L82 3.4 L85 3.9 L88 4.7 L91 5.8 L94 7.1 L97 8.7 L100 10.3 L103 12.0 L106 13.6 L109 15.1 L112 16.2 L115 17.1 L118 17.5 L118 44.5 L115 44.1 L112 43.2 L109 42.1 L106 40.6 L103 39.0 L100 37.3 L97 35.7 L94 34.1 L91 32.8 L88 31.7 L85 30.9 L82 30.4 L79 30.2 L76 30.4 L73 30.9 L70 31.6 L67 32.5 L64 33.5 L61 34.5 L58 35.6 L55 36.6 L52 37.4 L49 38.1 L46 38.6 L43 38.9 L40 39.0 L37 38.9 L34 38.7 L31 38.3 L28 37.9 L25 37.4 L22 36.9 L19 36.4 L16 36.0Z"
              fill="#c8362f"
            />
          </svg>
          <svg
            className="tugu"
            viewBox="0 0 60 130"
            fill="none"
            stroke="#f4ecd8"
            strokeWidth="2.500"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M30 4v14M26 18h8l-1 30H27zM22 48h16M20 52h20l-4 8H24zM27 60l-3 50M33 60l3 50M14 110h32M8 118h44M4 126h52" />
          </svg>
          <div className="wrap">
            <h2 className="hand reveal">
              Belajar Serius, <span>Bermain Gembira!</span>
            </h2>
            <p className="sub reveal">
              Coba berbagai template permainan bertema 17 Agustus yang seru dan edukatif!
            </p>
            <div className="games">
              <div className="gm reveal scale-up stagger-1">
                <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
                  <use href="#bg" width="200" height="200" />
                  <use
                    href="#kid"
                    x="12"
                    y="82"
                    width="52"
                    height="94"
                    style={{ ['--shirt' as any]: '#fff', ['--hair' as any]: '#222' }}
                  />
                  <use href="#sk" x="12" y="82" width="52" height="94" />
                  <use
                    href="#kid"
                    x="74"
                    y="82"
                    width="52"
                    height="94"
                    style={{ ['--shirt' as any]: '#bfe3d4', ['--hair' as any]: '#6a3b1f' }}
                  />
                  <use href="#sk" x="74" y="82" width="52" height="94" />
                  <use
                    href="#kid"
                    x="136"
                    y="82"
                    width="52"
                    height="94"
                    style={{ ['--shirt' as any]: '#fff', ['--hair' as any]: '#222' }}
                  />
                  <use href="#sk" x="136" y="82" width="52" height="94" />
                </svg>
                <span className="tag">Balap Karung</span>
                <span className="lbl">Balap Karung</span>
              </div>
              <div className="gm reveal scale-up stagger-2">
                <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
                  <use href="#bg" width="200" height="200" />
                  <path d="M8 116H192" stroke="#8a5a2b" strokeWidth="5" />
                  <rect x="96" y="108" width="8" height="16" fill="#d33" />
                  <use
                    href="#kid"
                    x="6"
                    y="76"
                    width="44"
                    height="80"
                    style={{ ['--shirt' as any]: '#f3d24a' }}
                  />
                  <use
                    href="#kid"
                    x="42"
                    y="76"
                    width="44"
                    height="80"
                    style={{ ['--shirt' as any]: '#e7efe9', ['--hair' as any]: '#6a3b1f' }}
                  />
                  <use
                    href="#kid"
                    x="114"
                    y="76"
                    width="44"
                    height="80"
                    style={{ ['--shirt' as any]: '#d9504a', ['--hair' as any]: '#222' }}
                  />
                  <use
                    href="#kid"
                    x="150"
                    y="76"
                    width="44"
                    height="80"
                    style={{ ['--shirt' as any]: '#fff', ['--hair' as any]: '#b5702e' }}
                  />
                </svg>
                <span className="tag">Tarik Tambang</span>
                <span className="lbl">Tarik Tambang</span>
              </div>
              <div className="gm reveal scale-up stagger-3">
                <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
                  <use href="#bg" width="200" height="200" />
                  <path d="M100 24V84" stroke="#444" strokeWidth="2" />
                  <circle cx="100" cy="98" r="16" fill="#f7f2e4" stroke="#d8cfb6" strokeWidth="2" />
                  <use
                    href="#kid"
                    x="24"
                    y="88"
                    width="56"
                    height="102"
                    style={{ ['--shirt' as any]: '#cfe8d9', ['--hair' as any]: '#222' }}
                  />
                  <use
                    href="#kid"
                    x="120"
                    y="88"
                    width="56"
                    height="102"
                    style={{ ['--shirt' as any]: '#f0a24a', ['--hair' as any]: '#222' }}
                  />
                </svg>
                <span className="tag">Makan Kerupuk</span>
                <span className="lbl">Makan Kerupuk</span>
              </div>
              <div className="gm reveal scale-up stagger-4">
                <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
                  <use href="#bg" width="200" height="200" />
                  <rect x="95" y="40" width="10" height="140" fill="#8a5a2b" />
                  <path
                    d="M95 40h10M95 60h10M95 80h10M95 100h10"
                    stroke="#5a3a1b"
                    strokeWidth="2"
                  />
                  <use
                    href="#kid"
                    x="34"
                    y="86"
                    width="50"
                    height="90"
                    style={{ ['--shirt' as any]: '#fff', ['--hair' as any]: '#222' }}
                  />
                  <use
                    href="#kid"
                    x="116"
                    y="86"
                    width="50"
                    height="90"
                    style={{ ['--shirt' as any]: '#9bd0b3', ['--hair' as any]: '#6a3b1f' }}
                  />
                </svg>
                <span className="tag">Panjat Pinang</span>
                <span className="lbl">Panjat Pinang</span>
              </div>
            </div>
          </div>
          <svg
            className="wave bot"
            viewBox="0 0 1440 60"
            preserveAspectRatio="none"
            fill="#f4ecd9"
            aria-hidden="true"
          >
            <path d="M0 60H1440V34C1300 8 1180 52 1040 34S780 6 600 32 340 54 200 30 50 10 0 34Z" />
          </svg>
        </section>

        {/* CARA KERJA */}
        <section className="wrap" id="cara-kerja">
          <h2 className="sec hand reveal" style={{ fontSize: '34px' }}>
            Cara Menggunakan <u>Discere</u>
          </h2>
          <ol className="steps">
            <li className="reveal stagger-1">
              <span className="n">1</span>
              <svg viewBox="0 0 48 48">
                <use href="#ic-book" />
              </svg>
              <h4>Pilih Materi Pembelajaran</h4>
              <p>Guru menyiapkan materi yang akan diajarkan.</p>
            </li>
            <li className="reveal stagger-2">
              <span className="n">2</span>
              <svg viewBox="0 0 48 48">
                <use href="#ic-tv" />
              </svg>
              <h4>Mulai Mengajar</h4>
              <p>Gunakan papan tulis digital untuk menjelaskan materi.</p>
            </li>
            <li className="reveal stagger-3">
              <span className="n">3</span>
              <svg viewBox="0 0 48 48">
                <use href="#ic-pad" />
              </svg>
              <h4>Pilih Permainan</h4>
              <p>Gunakan template permainan untuk menguji pemahaman siswa.</p>
            </li>
            <li className="reveal stagger-4">
              <span className="n">4</span>
              <svg viewBox="0 0 48 48">
                <use href="#ic-cup" />
              </svg>
              <h4>Belajar Jadi Menyenangkan</h4>
              <p>Siswa belajar sambil berpartisipasi dalam aktivitas kelas.</p>
            </li>
          </ol>
        </section>

        {/* KENAPA HARUS DISCERE */}
        <section className="band" id="kenapa">
          <svg
            className="wave top"
            viewBox="0 0 1440 60"
            preserveAspectRatio="none"
            fill="#f4ecd9"
            aria-hidden="true"
          >
            <path d="M0 0H1440V30C1300 54 1180 10 1040 28S760 56 600 30 340 6 200 30 50 52 0 26Z" />
          </svg>
          <svg className="bunt" viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 10Q720 56 1440 10" stroke="#8b6a4a" strokeWidth="3" fill="none" />
            <path d="M59 15L93 15L76 51Z" fill="#c8362f" />
            <path d="M135 19L169 19L152 55Z" fill="#f6f1e6" />
            <path d="M210 22L244 22L227 58Z" fill="#c8362f" />
            <path d="M286 25L320 25L303 61Z" fill="#f6f1e6" />
            <path d="M362 28L396 28L379 64Z" fill="#c8362f" />
            <path d="M438 30L472 30L455 66Z" fill="#f6f1e6" />
            <path d="M514 31L548 31L531 67Z" fill="#c8362f" />
            <path d="M589 32L623 32L606 68Z" fill="#f6f1e6" />
            <path d="M665 33L699 33L682 69Z" fill="#c8362f" />
            <path d="M741 33L775 33L758 69Z" fill="#f6f1e6" />
            <path d="M817 32L851 32L834 68Z" fill="#c8362f" />
            <path d="M892 31L926 31L909 67Z" fill="#f6f1e6" />
            <path d="M968 30L1002 30L985 66Z" fill="#c8362f" />
            <path d="M1044 28L1078 28L1061 64Z" fill="#f6f1e6" />
            <path d="M1120 25L1154 25L1137 61Z" fill="#c8362f" />
            <path d="M1196 22L1230 22L1213 58Z" fill="#f6f1e6" />
            <path d="M1271 19L1305 19L1288 55Z" fill="#c8362f" />
            <path d="M1347 15L1381 15L1364 51Z" fill="#f6f1e6" />
          </svg>
          <div className="wrap">
            <h2 className="hand reveal">
              Kenapa Harus <span>Discere?</span>
            </h2>
            <p className="sub reveal">Enam alasan Discere cocok untuk kelasmu.</p>
            <div className="cmp">
              <div className="bad reveal slide-left">
                <h3 className="hand">Kelas biasa</h3>
                <ul>
                  <li>Slide di satu aplikasi, kuis di aplikasi lain</li>
                  <li>Siswa duduk dan mendengarkan</li>
                  <li>Kuis hanya jalan kalau semua siswa punya HP</li>
                  <li>Soal ditulis satu per satu</li>
                  <li>Sulit tahu siapa yang belum paham</li>
                </ul>
              </div>
              <div className="good reveal slide-right">
                <h3 className="hand">Kelas dengan Discere</h3>
                <ul>
                  <li>Menjelaskan dan menguji di satu layar</li>
                  <li>Siswa berlomba sebagai tim</li>
                  <li>Bisa dengan HP atau satu layar bersama</li>
                  <li>AI membantu menyusun soal, guru yang meninjau</li>
                  <li>Riwayat menunjukkan materi yang perlu diulang</li>
                </ul>
              </div>
            </div>
            <div className="perks">
              <div className="perk reveal stagger-1">
                <svg className="ico" viewBox="0 0 48 48">
                  <use href="#ic-tv" />
                </svg>
                <h4>Satu layar untuk mengajar dan menguji</h4>
                <p>
                  Jelaskan materi di papan tulis digital, lalu buka game dari panel di sisi layar.
                  Tidak perlu berpindah aplikasi.
                </p>
              </div>
              <div className="perk reveal stagger-2">
                <svg className="ico" viewBox="0 0 48 48">
                  <use href="#ic-spark" />
                </svg>
                <h4>Soal tersusun dari materimu</h4>
                <p>
                  Tempel materi, AI menyusun soal pilihan ganda lengkap dengan penjelasan. Soal
                  berlabel “Dibuat AI” dan kamu yang meninjau sebelum dipakai.
                </p>
              </div>
              <div className="perk reveal stagger-3">
                <svg className="ico" viewBox="0 0 48 48">
                  <use href="#ic-pad" />
                </svg>
                <h4>Seluruh kelas ikut berlomba</h4>
                <p>
                  Siswa dibagi menjadi dua tim. Setiap jawaban benar menarik tali, jadi siswa yang
                  pendiam pun ikut berkontribusi.
                </p>
              </div>
              <div className="perk reveal stagger-1">
                <svg className="ico" viewBox="0 0 48 48">
                  <use href="#ic-phone" />
                </svg>
                <h4>Dengan HP maupun tanpa HP</h4>
                <p>
                  Mode Multiplayer memakai HP siswa lewat token. Mode Solo cukup satu layar bersama,
                  cocok untuk kelas yang tidak boleh membawa HP.
                </p>
              </div>
              <div className="perk reveal stagger-2">
                <svg className="ico" viewBox="0 0 48 48">
                  <use href="#ic-chart" />
                </svg>
                <h4>Tahu materi yang belum dipahami</h4>
                <p>
                  Setelah sesi, riwayat menunjukkan soal yang paling sering salah, jadi kamu tahu
                  bagian mana yang perlu diulang.
                </p>
              </div>
              <div className="perk reveal stagger-3">
                <svg className="ico" viewBox="0 0 48 48">
                  <use href="#ic-lock" />
                </svg>
                <h4>Data kelas tetap milikmu</h4>
                <p>
                  Siswa masuk tanpa akun dan nama panggilan mereka tidak disimpan. Papan, soal, dan
                  hasil kelas hanya bisa kamu buka.
                </p>
              </div>
            </div>
          </div>
          <svg
            className="wave bot"
            viewBox="0 0 1440 60"
            preserveAspectRatio="none"
            fill="#f4ecd9"
            aria-hidden="true"
          >
            <path d="M0 60H1440V30C1320 6 1200 50 1060 32S790 4 620 30 360 56 220 32 60 8 0 34Z" />
          </svg>
        </section>

        {/* DEMO INTERAKTIF */}
        <section className="wrap" id="demo">
          <h2 className="sec hand reveal">
            Lihat <u>Discere</u> Bekerja
          </h2>
          <div className="dm">
            <div>
              <div className="bd reveal slide-left" id="bd" ref={boardRef}>
                <div className="hand nt">Papan tulis kelas 5</div>
                <div className="hand q" id="q" ref={questionRef}>
                  12 × 15 = ?
                </div>
                <div className="hand nt">Besok ulangan bab 3, ya!</div>
                <div className={`ans ${demoRevealed ? 'on' : ''}`} id="ans" aria-live="polite">
                  <div>
                    <b>Jawaban</b> 180
                  </div>
                  <div>
                    <b>Rumus</b> a × b = hasil
                  </div>
                  <div>
                    <b>Langkah</b> 12 × 10 = 120, 12 × 5 = 60, lalu 120 + 60 = 180
                  </div>
                  <small>
                    Contoh simulasi. Di Discere, jawabannya dibuat AI dan guru yang meninjau.
                  </small>
                  <button id="rs" type="button" onClick={resetDemo}>
                    Coba lagi
                  </button>
                </div>
                <canvas
                  id="dc"
                  ref={canvasRef}
                  aria-label="Papan untuk melingkari soal"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  style={{ pointerEvents: demoRevealed ? 'none' : 'auto' }}
                />
              </div>
              <p className="hint" id="hint" style={{ display: demoRevealed ? 'none' : 'block' }}>
                <span>{demoHint}</span>
                <button id="sk" type="button" onClick={revealDemoAnswer}>
                  Tampilkan tanpa melingkari
                </button>
              </p>
            </div>
            <div className="reveal slide-right">
              <p>
                Di Discere, guru cukup <b>melingkari soal</b> di papan tulis. Jawaban, rumus, dan
                langkahnya langsung muncul di samping soal.
              </p>
              <p>
                Guru juga bisa mengetik kebutuhannya, misalnya “jelaskan dengan cara lain”.
              </p>
              <div className="vid">Video demo aplikasi menyusul di sini.</div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="wrap" id="faq">
          <h2 className="sec hand reveal">
            Pertanyaan <u>yang Sering Muncul</u>
          </h2>
          <div className="faq">
            <details className="reveal stagger-1">
              <summary>Apakah Discere gratis?</summary>
              <p>Versi ini gratis dipakai guru.</p>
            </details>
            <details className="reveal stagger-2">
              <summary>Apakah perlu internet?</summary>
              <p>
                Kelas dan game berjalan di jaringan lokal. Hanya fitur AI yang butuh internet.
              </p>
            </details>
            <details className="reveal stagger-3">
              <summary>Apakah siswa harus punya akun?</summary>
              <p>Tidak. Siswa masuk dengan token dari guru dan nama panggilan.</p>
            </details>
            <details className="reveal stagger-4">
              <summary>Apakah data kami aman?</summary>
              <p>
                Admin hanya melihat angka total. Papan, soal, dan hasil sesi hanya bisa dibuka guru
                pemiliknya.
              </p>
            </details>
            <details className="reveal stagger-5">
              <summary>Bagaimana kalau siswa tidak punya HP?</summary>
              <p>
                Pakai Mode Solo. Perwakilan tim maju dan menyentuh jawaban di layar guru.
              </p>
            </details>
          </div>
        </section>

        {/* CTA FOOT */}
        <section className="foot">
          <svg className="rib l" viewBox="0 0 230 140" aria-hidden="true">
            <path
              d="M0 24C50 30 95 80 145 140C95 100 45 65 0 70Z"
              fill="#f6f1e6"
            />
            <path
              d="M0 70C35 78 65 105 100 140C65 125 30 115 0 106Z"
              fill="#c8362f"
            />
          </svg>
          <svg className="rib r" viewBox="0 0 380 160" aria-hidden="true">
            <path
              d="M380 0C345 50 265 40 200 85S75 145 20 160C80 150 210 140 380 80Z"
              fill="#c8362f"
            />
            <path
              d="M380 80C280 110 200 145 110 160C170 150 270 135 380 122Z"
              fill="#f6f1e6"
            />
          </svg>
          <div className="wrap">
            <div className="cta reveal scale-up" id="mulai">
              <svg
                className="plane"
                viewBox="0 0 110 50"
                fill="none"
                stroke="#f4ecd8"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path
                  d="M4 40c12 4 22-12 12-14s-8 16 20 4 20-12 28-14"
                  strokeDasharray="1 5"
                />
                <path d="M104 6L64 24l16 6zM104 6L80 30l4 14 8-10z" />
              </svg>
              <p className="hand">
                Siap membuat kelas lebih hidup bersama <span>Discere?</span>
              </p>
              <Link className="btn" to={ctaUrl}>
                Mulai Sekarang →
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="ft">
        <svg
          className="wave top"
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          fill="#f4ecd9"
          aria-hidden="true"
        >
          <path d="M0 0H1440V26C1320 54 1200 6 1060 24S800 56 640 28 380 4 240 28 60 50 0 22Z" />
        </svg>
        <div className="wrap">
          <div className="ftg">
            <div>
              <a className="logo" href="#beranda" onClick={(e) => handleScrollTo(e, 'beranda')}>
                <svg width="36" height="36" style={{ color: 'var(--chalk)' }}>
                  <use href="#ic-book" />
                </svg>
                Discere
              </a>
              <p>
                Platform kelas interaktif: papan tulis digital, game lomba 17-an, dan AI pembantu
                untuk guru.
              </p>
            </div>
            <div>
              <h5>Jelajahi</h5>
              <ul>
                <li>
                  <a href="#beranda" onClick={(e) => handleScrollTo(e, 'beranda')}>Beranda</a>
                </li>
                <li>
                  <a href="#tentang" onClick={(e) => handleScrollTo(e, 'tentang')}>Tentang</a>
                </li>
                <li>
                  <a href="#fitur" onClick={(e) => handleScrollTo(e, 'fitur')}>Fitur</a>
                </li>
                <li>
                  <a href="#template" onClick={(e) => handleScrollTo(e, 'template')}>Template</a>
                </li>
                <li>
                  <a href="#cara-kerja" onClick={(e) => handleScrollTo(e, 'cara-kerja')}>Cara Kerja</a>
                </li>
                <li>
                  <a href="#demo" onClick={(e) => handleScrollTo(e, 'demo')}>Demo</a>
                </li>
              </ul>
            </div>
            <div>
              <h5>Untuk guru</h5>
              <ul>
                <li>
                  <Link to="/daftar">Daftar gratis</Link>
                </li>
                <li>
                  <Link to="/masuk">Masuk</Link>
                </li>
                <li>
                  <a href="#faq" onClick={(e) => handleScrollTo(e, 'faq')}>Pertanyaan umum</a>
                </li>
              </ul>
            </div>
            <div>
              <h5>Tentang kami</h5>
              <ul>
                <li>Dibuat untuk LOGICODIX 2026</li>
                <li>Subtema: Smart &amp; Fun Education</li>
                <li>Discere (bahasa Latin): belajar</li>
              </ul>
            </div>
          </div>
          <div className="fb">
            <span>© 2026 Discere. Belajar serius, bermain gembira.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
