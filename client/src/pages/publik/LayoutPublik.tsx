import React, { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { Button } from '../../components';
import { Menu, X, ArrowRight, Shield, Heart } from 'lucide-react';

export function LayoutPublik({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [menuTerbuka, setMenuTerbuka] = useState(false);

  const navigasi = [
    { nama: 'Beranda', path: '/#beranda' },
    { nama: 'Fitur', path: '/#fitur' },
    { nama: 'Template', path: '/#template' },
    { nama: 'Cara Kerja', path: '/#cara' },
  ];

  const dashboardUrl = user?.role === 'admin' ? '/admin' : '/guru';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-[#1f4a37] text-[#f4ecd8] flex items-center justify-center font-bold text-xl shadow-sm group-hover:scale-105 transition-transform">
              D
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-2xl tracking-tight text-[#163a2b] dark:text-white font-['Caveat',cursive] leading-none">
                Discere
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wider uppercase">
                Kelas Interaktif
              </span>
            </div>
          </Link>

          {/* Navigasi Desktop */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Navigasi Utama">
            {navigasi.map((item) => (
              <a
                key={item.path}
                href={item.path}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {item.nama}
              </a>
            ))}
          </nav>

          {/* Tombol Aksi Desktop */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link to={dashboardUrl}>
                <Button variant="utama" size="md" icon={<ArrowRight className="w-4 h-4" />}>
                  Ke Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/masuk">
                  <Button variant="hantu" size="md">
                    Masuk
                  </Button>
                </Link>
                <Link to="/daftar">
                  <Button variant="utama" size="md">
                    Daftar Gratis
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Tombol Hamburger Mobile */}
          <div className="flex md:hidden items-center">
            <button
              type="button"
              onClick={() => setMenuTerbuka(!menuTerbuka)}
              aria-label={menuTerbuka ? 'Tutup navigasi menu' : 'Buka navigasi menu'}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4a37]"
            >
              {menuTerbuka ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Menu Mobile */}
        {menuTerbuka && (
          <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-6 space-y-3 animate-in slide-in-from-top duration-200">
            <nav className="flex flex-col gap-1">
              {navigasi.map((item) => (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={() => setMenuTerbuka(false)}
                  className="px-3 py-2.5 rounded-xl text-base font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {item.nama}
                </a>
              ))}
            </nav>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
              {user ? (
                <Link to={dashboardUrl} onClick={() => setMenuTerbuka(false)}>
                  <Button variant="utama" size="md" className="w-full">
                    Ke Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/masuk" onClick={() => setMenuTerbuka(false)}>
                    <Button variant="sekunder" size="md" className="w-full">
                      Masuk
                    </Button>
                  </Link>
                  <Link to="/daftar" onClick={() => setMenuTerbuka(false)}>
                    <Button variant="utama" size="md" className="w-full">
                      Daftar Gratis
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Konten Halaman */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 pt-14 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-slate-100 dark:border-slate-800">
            {/* Kolom 1: Profil Brand */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1f4a37] text-[#f4ecd8] flex items-center justify-center font-bold text-lg shadow-sm">
                  D
                </div>
                <span className="font-bold text-2xl tracking-tight text-[#163a2b] dark:text-white font-['Caveat',cursive]">
                  Discere
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm max-w-sm leading-relaxed">
                Platform kelas interaktif untuk guru: papan tulis digital tak terbatas untuk materi pelajaran dan lomba 17 Agustusan yang seru. Belajar serius, bermain gembira!
              </p>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl">
                LOGICODIX 2026 Hackathon — Smart & Fun Education
              </div>
            </div>

            {/* Kolom 2: Navigasi */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold tracking-wider uppercase text-slate-900 dark:text-slate-200">
                Eksplorasi
              </h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <a href="/#tentang" className="hover:text-[#1f4a37] dark:hover:text-[#f2c230] transition-colors">
                    Tentang Discere
                  </a>
                </li>
                <li>
                  <a href="/#fitur" className="hover:text-[#1f4a37] dark:hover:text-[#f2c230] transition-colors">
                    Fitur Utama
                  </a>
                </li>
                <li>
                  <a href="/#template" className="hover:text-[#1f4a37] dark:hover:text-[#f2c230] transition-colors">
                    Template Permainan
                  </a>
                </li>
                <li>
                  <a href="/#cara-kerja" className="hover:text-[#1f4a37] dark:hover:text-[#f2c230] transition-colors">
                    Cara Penggunaan
                  </a>
                </li>
                <li>
                  <a href="/#faq" className="hover:text-[#1f4a37] dark:hover:text-[#f2c230] transition-colors">
                    Pertanyaan Umum
                  </a>
                </li>
              </ul>
            </div>

            {/* Kolom 3: Akses Cepat */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold tracking-wider uppercase text-slate-900 dark:text-slate-200">
                Mulai Mengajar
              </h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <Link to="/daftar" className="hover:text-[#1f4a37] dark:hover:text-[#f2c230] transition-colors">
                    Daftar Akun Guru
                  </Link>
                </li>
                <li>
                  <Link to="/masuk" className="hover:text-[#1f4a37] dark:hover:text-[#f2c230] transition-colors">
                    Masuk ke Kelas
                  </Link>
                </li>
                <li className="pt-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    Siswa bergabung tanpa perlu akun
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <p>© 2026 Discere Platform. Seluruh hak cipta dilindungi.</p>
            <p className="flex items-center gap-1">
              Dibuat dengan <Heart className="w-3.5 h-3.5 text-[#c8362f] fill-current" /> untuk pendidikan Indonesia.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
