import { Link } from 'react-router';
import '../../styles/landing.css';

export default function Dokumentasi() {
  return (
    <div className="landing-page min-h-screen flex flex-col justify-between" style={{ background: 'linear-gradient(165deg, #204c38 0%, #163a2b 100%)', color: 'var(--chalk, #f4ecd8)' }}>
      {/* Topbar Navigasi Ringkas */}
      <header className="w-full border-b border-[#f4ecd8]/15 px-6 py-4 bg-[#163a2b]/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="logo flex items-center gap-2 text-2xl font-extrabold text-[#f4ecd8] hover:opacity-90 transition-opacity">
            <svg
              width="32"
              height="32"
              viewBox="0 0 48 48"
              fill="none"
              stroke="#f4ecd8"
              strokeWidth="3.2"
              strokeLinejoin="round"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M5 11c7-3 14-1 19 4v26c-5-5-12-7-19-4zM43 11c-7-3-14-1-19 4v26c5-5 12-7 19-4z" />
              <path d="M10 19h8M10 26h8M30 19h8M30 26h8" />
            </svg>
            <span>Discere</span>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#f4ecd8] border border-[#f4ecd8]/30 px-4 py-2 rounded-full hover:bg-[#f4ecd8]/10 transition-colors"
          >
            ← Kembali ke Beranda
          </Link>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16 flex items-center justify-center">
        <div className="w-full text-center space-y-6 bg-[#1f4a37]/85 border-2 border-dashed border-[#e0d5b8]/35 rounded-3xl p-8 md:p-14 shadow-2xl backdrop-blur-sm">
          {/* Badge Status */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#163a2b] border border-[#f2c230]/40 text-[#f2c230] text-xs font-bold tracking-wide uppercase">
            <span>Panduan &amp; Dokumentasi</span>
          </div>

          {/* Judul Halaman */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-[#f4ecd8] tracking-tight"
            style={{ fontFamily: "'Caveat Brush', 'Caveat', cursive" }}
          >
            Dokumentasi
          </h1>

          {/* Paragraf Placeholder */}
          <p className="text-base sm:text-lg text-[#cfd9c3] leading-relaxed max-w-xl mx-auto">
            Halaman ini sedang disusun. Panduan lengkap mengenai fitur papan tulis digital, game edukasi interaktif, dan integrasi AI akan segera tersedia di sini.
          </p>

          {/* Tombol Aksi */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#f08a24] hover:bg-[#d9771a] text-white font-bold text-sm transition-all shadow-md active:scale-95"
            >
              Kembali ke Beranda
            </Link>
            <a
              href="https://github.com/refkyaja/DIscere"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#163a2b] hover:bg-[#122e22] text-[#f4ecd8] border border-[#f4ecd8]/30 font-bold text-sm transition-all"
            >
              Lihat Repositori GitHub ↗
            </a>
          </div>
        </div>
      </main>

      {/* Footer Sederhana */}
      <footer className="w-full border-t border-[#f4ecd8]/15 py-6 px-6 text-center text-xs text-[#cfd9c3]/80">
        <p>© 2026 Discere. Belajar serius, bermain gembira.</p>
      </footer>
    </div>
  );
}

