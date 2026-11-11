import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import {
  Rocket,
  LayoutDashboard,
  FileText,
  Presentation,
  Bot,
  Trophy,
  Users,
  History,
  ShieldCheck,
  HelpCircle,
  Menu,
  X,
  ChevronRight,
  ArrowLeft,
  ArrowUp,
  ExternalLink,
} from 'lucide-react';
import '../../styles/landing.css';

interface NavItem {
  id: string;
  nomor: string;
  judul: string;
  ikon: React.ReactNode;
}

const DAFTAR_SEKSI: NavItem[] = [
  { id: 'mulai-cepat', nomor: '01', judul: 'Mulai Cepat', ikon: <Rocket className="w-4 h-4" /> },
  { id: 'dashboard-guru', nomor: '02', judul: 'Dashboard Guru', ikon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'membuat-template-dan-soal', nomor: '03', judul: 'Membuat Template dan Soal', ikon: <FileText className="w-4 h-4" /> },
  { id: 'papan-tulis', nomor: '04', judul: 'Papan Tulis', ikon: <Presentation className="w-4 h-4" /> },
  { id: 'fitur-ai', nomor: '05', judul: 'Fitur AI', ikon: <Bot className="w-4 h-4" /> },
  { id: 'bermain-game-tarik-tambang', nomor: '06', judul: 'Bermain Game: Tarik Tambang', ikon: <Trophy className="w-4 h-4" /> },
  { id: 'kolaborasi-papan-tulis', nomor: '07', judul: 'Kolaborasi Papan Tulis', ikon: <Users className="w-4 h-4" /> },
  { id: 'riwayat-dan-statistik', nomor: '08', judul: 'Riwayat dan Statistik', ikon: <History className="w-4 h-4" /> },
  { id: 'privasi-dan-keamanan', nomor: '09', judul: 'Privasi dan Keamanan', ikon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'masih-ada-pertanyaan', nomor: '10', judul: 'Masih Ada Pertanyaan?', ikon: <HelpCircle className="w-4 h-4" /> },
];

export default function Dokumentasi() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<string>('mulai-cepat');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const dashboardUrl = user?.role === 'admin' ? '/admin' : '/guru';

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setShowScrollTop(scrollY > 400);

      const headerOffset = 140;
      let current = DAFTAR_SEKSI[0].id;

      for (const item of DAFTAR_SEKSI) {
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= headerOffset) {
            current = item.id;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const offset = 90;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth',
      });
      window.history.pushState(null, '', `#${id}`);
      setActiveSection(id);
      setMobileMenuOpen(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className="landing-page min-h-screen flex flex-col selection:bg-[#f2c230] selection:text-[#163a2b]"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #1e4d38 0%, #163a2b 45%, #0f281e 100%)',
        color: 'var(--chalk, #f4ecd8)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Topbar Navigasi */}
      <header className="w-full border-b border-[#f4ecd8]/15 px-4 sm:px-8 py-3.5 bg-[#163a2b]/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-2xl font-extrabold text-[#f4ecd8] hover:opacity-95 transition-opacity group"
          >
            <div className="w-9 h-9 rounded-2xl bg-[#f2c230] text-[#163a2b] flex items-center justify-center font-black text-xl shadow-md group-hover:scale-105 transition-transform">
              D
            </div>
            <div className="flex flex-col">
              <span
                className="font-black text-2xl tracking-tight leading-none text-[#f4ecd8]"
                style={{ fontFamily: "'Caveat Brush', 'Caveat', cursive" }}
              >
                Discere
              </span>
              <span className="text-[10px] tracking-wider uppercase text-[#f2c230] font-bold">
                Dokumentasi
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#f4ecd8]/90 hover:text-[#f4ecd8] border border-[#f4ecd8]/25 hover:border-[#f4ecd8]/50 px-3.5 py-1.5 rounded-full hover:bg-[#f4ecd8]/10 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Beranda</span>
            </Link>

            {user ? (
              <Link
                to={dashboardUrl}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#163a2b] bg-[#f2c230] hover:bg-[#deb029] px-4 py-1.5 rounded-full shadow-md transition-all active:scale-95"
              >
                <span>Dashboard</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/masuk"
                  className="hidden sm:inline-flex text-xs sm:text-sm font-semibold text-[#f4ecd8] hover:text-[#f2c230] px-3 py-1.5 transition-colors"
                >
                  Masuk
                </Link>
                <Link
                  to="/daftar"
                  className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-white bg-[#f08a24] hover:bg-[#d9771a] px-3.5 py-1.5 rounded-full shadow transition-all active:scale-95"
                >
                  Daftar
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Header Banner */}
      <section className="relative px-4 sm:px-6 pt-12 pb-10 sm:pt-16 sm:pb-14 border-b border-[#f4ecd8]/10 overflow-hidden">
        {/* Dekorasi garis kapur halus */}
        <div
          className="absolute inset-0 pointer-events-none opacity-5"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #f4ecd8 0, #f4ecd8 1px, transparent 0, transparent 40px)',
          }}
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#122e22]/80 border border-[#f2c230]/40 text-[#f2c230] text-xs font-bold tracking-wider uppercase mb-4 shadow-sm">
            <Rocket className="w-3.5 h-3.5" />
            <span>Panduan Lengkap Pengguna</span>
          </div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-[#f4ecd8] tracking-tight leading-tight mb-4"
            style={{ fontFamily: "'Caveat Brush', 'Caveat', cursive" }}
          >
            Dokumentasi Discere
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base md:text-lg text-[#cfd9c3] leading-relaxed">
            Panduan menyeluruh langkah demi langkah untuk memaksimalkan penggunaan platform kelas interaktif Discere:
            mulai dari menyusun template soal, mengajar di papan tulis kanvas tak terbatas, integrasi AI, hingga
            memulai kuis bertema lomba 17-an.
          </p>
        </div>
      </section>

      {/* Bar Navigasi Mobile (Collapsible) */}
      <div className="lg:hidden sticky top-[61px] z-30 bg-[#163a2b]/95 backdrop-blur-md border-b border-[#f4ecd8]/15 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-full flex items-center justify-between text-left px-4 py-2 rounded-xl bg-[#1f4a37] border border-[#f4ecd8]/20 text-[#f4ecd8] text-xs sm:text-sm font-semibold transition-all active:scale-[0.99]"
          aria-expanded={mobileMenuOpen}
        >
          <div className="flex items-center gap-2 truncate">
            <span className="text-[#f2c230] font-bold">Daftar Isi:</span>
            <span className="truncate text-[#cfd9c3]">
              {DAFTAR_SEKSI.find((s) => s.id === activeSection)?.judul || 'Pilih Bagian'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[#f2c230]">
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </div>
        </button>

        {mobileMenuOpen && (
          <nav
            aria-label="Daftar Isi Dokumentasi Ponsel"
            className="mt-2 p-2 bg-[#1b4332] border border-[#f4ecd8]/20 rounded-2xl shadow-2xl max-h-[65vh] overflow-y-auto space-y-1 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {DAFTAR_SEKSI.map((item) => {
              const isCurrent = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => scrollToSection(e, item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm transition-all ${
                    isCurrent
                      ? 'bg-[#f2c230] text-[#163a2b] font-bold shadow-sm'
                      : 'text-[#f4ecd8]/85 hover:bg-[#163a2b] hover:text-[#f4ecd8]'
                  }`}
                >
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isCurrent ? 'bg-[#163a2b]/20 text-[#163a2b]' : 'bg-[#163a2b] text-[#f2c230]'}`}>
                    {item.nomor}
                  </span>
                  <span className="truncate">{item.judul}</span>
                </a>
              );
            })}
          </nav>
        )}
      </div>

      {/* Konten Utama & Sidebar Navigasi Desktop */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
          {/* Sidebar Navigasi Desktop (Sticky) */}
          <aside className="hidden lg:block w-72 flex-none sticky top-24 z-20">
            <div className="bg-[#1f4a37]/85 border border-[#e0d5b8]/20 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
              <div className="flex items-center gap-2 px-3 pb-3 mb-2 border-b border-[#f4ecd8]/15">
                <Rocket className="w-4 h-4 text-[#f2c230]" />
                <span className="text-xs font-bold tracking-wider uppercase text-[#f4ecd8]">
                  Daftar Isi Panduan
                </span>
              </div>

              <nav className="space-y-1" aria-label="Navigasi Dokumentasi">
                {DAFTAR_SEKSI.map((item) => {
                  const isCurrent = activeSection === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={(e) => scrollToSection(e, item.id)}
                      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isCurrent
                          ? 'bg-[#f2c230] text-[#163a2b] font-bold shadow-md translate-x-1'
                          : 'text-[#f4ecd8]/80 hover:text-[#f4ecd8] hover:bg-[#163a2b]/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            isCurrent
                              ? 'bg-[#163a2b]/20 text-[#163a2b]'
                              : 'bg-[#163a2b] text-[#f2c230] group-hover:bg-[#122e22]'
                          }`}
                        >
                          {item.nomor}
                        </span>
                        <span className="truncate">{item.judul}</span>
                      </div>
                      <ChevronRight
                        className={`w-3.5 h-3.5 flex-none transition-transform ${
                          isCurrent ? 'translate-x-0.5 text-[#163a2b]' : 'opacity-0 group-hover:opacity-100 text-[#f2c230]'
                        }`}
                      />
                    </a>
                  );
                })}
              </nav>

              <div className="mt-5 pt-4 border-t border-[#f4ecd8]/15 px-2">
                <div className="p-3 rounded-xl bg-[#163a2b]/80 border border-[#f4ecd8]/10 text-xs text-[#cfd9c3] space-y-2">
                  <div className="font-bold text-[#f2c230] flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Perlu Bantuan?</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Ajukan pertanyaan atau laporkan kendala melalui tim pengembang Discere.
                  </p>
                  <a
                    href="https://wa.me/6285885455853"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#f4ecd8] hover:text-[#f2c230] transition-colors"
                  >
                    <span>Hubungi via WhatsApp</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </aside>

          {/* Kolom Isi Konten Dokumentasi (10 Bagian) */}
          <div className="flex-1 min-w-0 space-y-8 sm:space-y-10">
            {/* 1. Mulai Cepat */}
            <article
              id="mulai-cepat"
              className="scroll-mt-28 bg-[#1f4a37]/85 border border-[#e0d5b8]/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl backdrop-blur-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-xl bg-[#163a2b] border border-[#f2c230]/40 text-[#f2c230] font-black text-sm flex items-center justify-center font-mono">
                  01
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#f2c230]">
                  Langkah Awal
                </span>
              </div>

              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#f4ecd8] tracking-tight mb-6"
                style={{ fontFamily: "'Caveat Brush', 'Caveat', cursive" }}
              >
                1. Mulai Cepat
              </h2>

              <ol className="space-y-4 text-sm sm:text-base text-[#f4ecd8]/90 leading-relaxed list-decimal list-inside">
                <li className="pl-2">
                  Daftar akun di halaman Daftar (nama, email, kata sandi minimal 8 karakter, nama sekolah), lalu masuk.
                </li>
                <li className="pl-2">
                  Di Dashboard Guru, tekan Template Baru, isi judul materi, pilih game dan mode, lalu isi soal (manual atau lewat AI).
                </li>
                <li className="pl-2">
                  Tekan Buka Papan Tulis untuk menjelaskan materi ke siswa.
                </li>
                <li className="pl-2">
                  Di dalam papan tulis, buka sidebar Template Game di kanan, pilih template yang sudah dibuat.
                </li>
                <li className="pl-2">
                  Mode Solo: lomba langsung mulai, tidak perlu HP. Mode Multiplayer: tunjukkan token dan QR di layar, siswa bergabung lewat HP, lalu tekan Mulai Lomba.
                </li>
                <li className="pl-2">
                  Setelah selesai, hasilnya otomatis tersimpan di Riwayat.
                </li>
              </ol>
            </article>

            {/* 2. Dashboard Guru */}
            <article
              id="dashboard-guru"
              className="scroll-mt-28 bg-[#1f4a37]/85 border border-[#e0d5b8]/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl backdrop-blur-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-xl bg-[#163a2b] border border-[#f2c230]/40 text-[#f2c230] font-black text-sm flex items-center justify-center font-mono">
                  02
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#f2c230]">
                  Pusat Kendali
                </span>
              </div>

              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#f4ecd8] tracking-tight mb-4"
                style={{ fontFamily: "'Caveat Brush', 'Caveat', cursive" }}
              >
                2. Dashboard Guru
              </h2>

              <p className="text-sm sm:text-base text-[#cfd9c3] mb-5 leading-relaxed">
                Dashboard punya lima menu di sidebar kiri:
              </p>

              <ul className="space-y-3.5 text-sm sm:text-base text-[#f4ecd8]/90 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    <strong className="text-[#f4ecd8] font-bold">Ringkasan</strong> — jumlah template, sesi, dan papan yang pernah dibuat, tombol pintas Template Baru dan Buka Papan Tulis, daftar template terbaru, dan info sesi terakhir.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    <strong className="text-[#f4ecd8] font-bold">Template</strong> — semua template milik kamu dalam bentuk kartu, dengan aksi Mulai, Ubah, Duplikat, dan Hapus. Ada tab Pustaka Resmi berisi contoh template dari admin yang bisa kamu salin lalu sesuaikan sendiri.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    <strong className="text-[#f4ecd8] font-bold">Riwayat</strong> — daftar sesi yang pernah dijalankan: tanggal, template, tim pemenang, skor akhir. Buka detail satu sesi untuk melihat soal yang paling sering dijawab salah.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    <strong className="text-[#f4ecd8] font-bold">Papan Tulis</strong> — daftar papan yang pernah kamu simpan, bisa dibuka, diganti nama, atau dihapus.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    <strong className="text-[#f4ecd8] font-bold">Pengaturan</strong> — ubah profil, ganti kata sandi, pilih tema tampilan, atau hapus akun.
                  </span>
                </li>
              </ul>
            </article>

            {/* 3. Membuat Template dan Soal */}
            <article
              id="membuat-template-dan-soal"
              className="scroll-mt-28 bg-[#1f4a37]/85 border border-[#e0d5b8]/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl backdrop-blur-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-xl bg-[#163a2b] border border-[#f2c230]/40 text-[#f2c230] font-black text-sm flex items-center justify-center font-mono">
                  03
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#f2c230]">
                  Materi &amp; Kuis
                </span>
              </div>

              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#f4ecd8] tracking-tight mb-4"
                style={{ fontFamily: "'Caveat Brush', 'Caveat', cursive" }}
              >
                3. Membuat Template dan Soal
              </h2>

              <p className="text-sm sm:text-base text-[#cfd9c3] mb-5 leading-relaxed">
                Saat membuat atau mengubah template, tampilan berubah jadi layar penuh supaya kamu fokus menyusun soal.
              </p>

              <ul className="space-y-3.5 text-sm sm:text-base text-[#f4ecd8]/90 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    Isi judul materi, pilih game (saat ini: Tarik Tambang), dan mode (Solo atau Multiplayer).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    Tambah soal manual (tulis sendiri pertanyaan, pilihan jawaban, dan jawaban benar), atau tekan Buat soal dengan AI: tempel materinya, pilih jumlah soal (5 sampai 15) dan tingkat kelas, lalu AI membuatkan draf soal lengkap dengan penjelasan jawaban salah.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    Soal buatan AI ditandai label "Dibuat AI" dan tetap bisa kamu ubah atau hapus sebelum dipakai. Tinjau dulu sebelum dipakai di kelas.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    Template bisa diduplikat kalau kamu ingin membuat variasi dari materi yang sama.
                  </span>
                </li>
              </ul>
            </article>

            {/* 4. Papan Tulis */}
            <article
              id="papan-tulis"
              className="scroll-mt-28 bg-[#1f4a37]/85 border border-[#e0d5b8]/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl backdrop-blur-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-xl bg-[#163a2b] border border-[#f2c230]/40 text-[#f2c230] font-black text-sm flex items-center justify-center font-mono">
                  04
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#f2c230]">
                  Kanvas Interaktif
                </span>
              </div>

              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#f4ecd8] tracking-tight mb-4"
                style={{ fontFamily: "'Caveat Brush', 'Caveat', cursive" }}
              >
                4. Papan Tulis
              </h2>

              <p className="text-sm sm:text-base text-[#cfd9c3] mb-4 leading-relaxed">
                Papan tulis adalah kanvas tak terbatas: bisa digeser dan diperbesar sesuka hati, cocok dipakai di laptop maupun layar sentuh.
              </p>

              <div className="p-4 rounded-xl bg-[#163a2b]/70 border border-[#f4ecd8]/15 mb-5 text-sm text-[#f4ecd8]/95 leading-relaxed">
                <strong className="text-[#f2c230]">Alat di sisi kiri:</strong> Tanya AI, Pilih, Tangan (geser papan), Laser, Pena (pulpen, spidol, pensil), Hapus, Bentuk, Teks, Tabel, Isi warna, Pipet warna, Upload gambar.
              </div>

              <p className="text-sm sm:text-base font-bold text-[#f4ecd8] mb-3">
                Fitur yang bisa kamu pakai:
              </p>

              <ul className="space-y-3 text-sm sm:text-base text-[#f4ecd8]/90 leading-relaxed mb-6">
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    Menulis dan menggambar bebas, dengan penghapus pintar yang memotong coretan persis di bagian yang digariskan, bukan menghapus semuanya.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    Menyisipkan bentuk, teks, tabel, dan gambar (unggah, seret-lepas, atau tempel langsung).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    Mode presentasi layar penuh.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    Papan tersimpan otomatis selama kamu mengajar, jadi tidak perlu disimpan manual.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    Pintasan keyboard untuk tiap alat (tekan tombol alatnya di keyboard, misalnya V untuk Pilih, P untuk Pena), Ctrl+Z/Ctrl+Y untuk undo/redo.
                  </span>
                </li>
              </ul>

              <div className="pt-4 border-t border-[#f4ecd8]/15 text-sm sm:text-base text-[#cfd9c3] leading-relaxed">
                <strong className="text-[#f4ecd8]">Pojok kanan atas:</strong> Undo, Redo, Game (membuka sidebar Template Game), daftar peserta yang sedang membuka papan, mode Presentasi, dan tombol Bagikan.
              </div>
            </article>

            {/* 5. Fitur AI */}
            <article
              id="fitur-ai"
              className="scroll-mt-28 bg-[#1f4a37]/85 border border-[#e0d5b8]/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl backdrop-blur-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-xl bg-[#163a2b] border border-[#f2c230]/40 text-[#f2c230] font-black text-sm flex items-center justify-center font-mono">
                  05
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#f2c230]">
                  Kecerdasan Buatan
                </span>
              </div>

              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#f4ecd8] tracking-tight mb-4"
                style={{ fontFamily: "'Caveat Brush', 'Caveat', cursive" }}
              >
                5. Fitur AI
              </h2>

              <p className="text-sm sm:text-base text-[#cfd9c3] mb-5 leading-relaxed">
                Discere punya tiga cara memakai AI, semuanya ditandai label "Dibuat AI" supaya jelas mana yang buatan mesin:
              </p>

              <ol className="space-y-4 text-sm sm:text-base text-[#f4ecd8]/90 leading-relaxed mb-6">
                <li className="flex items-start gap-3">
                  <span className="flex-none w-6 h-6 rounded-full bg-[#163a2b] border border-[#f2c230]/50 text-[#f2c230] text-xs font-bold flex items-center justify-center mt-0.5">
                    1
                  </span>
                  <div>
                    <strong className="text-[#f4ecd8]">Buat soal dari materi</strong> — dijelaskan di bagian 3.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-none w-6 h-6 rounded-full bg-[#163a2b] border border-[#f2c230]/50 text-[#f2c230] text-xs font-bold flex items-center justify-center mt-0.5">
                    2
                  </span>
                  <div>
                    <strong className="text-[#f4ecd8]">Tanya AI di papan tulis</strong> — tekan tombol kuning Tanya AI, lalu lingkari soal atau tulisan di papan. Boleh ketik pertanyaan tambahan, atau langsung kosongkan. Jawaban, rumus, dan langkah penyelesaian akan muncul sebagai kartu di samping soal, bisa dipindah atau dihapus seperti objek lain.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-none w-6 h-6 rounded-full bg-[#163a2b] border border-[#f2c230]/50 text-[#f2c230] text-xs font-bold flex items-center justify-center mt-0.5">
                    3
                  </span>
                  <div>
                    <strong className="text-[#f4ecd8]">Obrolan AI</strong> — bar prompt di papan tulis untuk tanya jawab bebas dengan asisten AI, bisa menyertakan gambar, PDF, atau file teks sebagai lampiran. Riwayat obrolan ini hanya ada selama halaman terbuka, hilang kalau di-refresh, dan tidak disimpan ke database.
                  </div>
                </li>
              </ol>

              <div className="p-4 sm:p-5 rounded-2xl bg-[#163a2b]/85 border border-[#f2c230]/30 text-xs sm:text-sm text-[#cfd9c3] leading-relaxed">
                Setiap guru punya batas pemakaian AI per hari. Kalau sedang tidak ada koneksi internet atau AI tidak tersedia, bagian lain Discere (soal manual, game, papan tulis) tetap bisa dipakai seperti biasa. Jangan masukkan data pribadi siswa ke dalam materi yang dikirim ke AI.
              </div>
            </article>

            {/* 6. Bermain Game: Tarik Tambang */}
            <article
              id="bermain-game-tarik-tambang"
              className="scroll-mt-28 bg-[#1f4a37]/85 border border-[#e0d5b8]/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl backdrop-blur-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-xl bg-[#163a2b] border border-[#f2c230]/40 text-[#f2c230] font-black text-sm flex items-center justify-center font-mono">
                  06
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#f2c230]">
                  Lomba 17 Agustusan
                </span>
              </div>

              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#f4ecd8] tracking-tight mb-4"
                style={{ fontFamily: "'Caveat Brush', 'Caveat', cursive" }}
              >
                6. Bermain Game: Tarik Tambang
              </h2>

              <p className="text-sm sm:text-base text-[#f4ecd8] mb-5 leading-relaxed font-medium">
                Dua tim bertanding, Merah di kiri dan Putih di kanan. Setiap jawaban benar menarik tali satu langkah ke arah tim itu; tim yang berhasil menarik tali sampai ujung lebih dulu menang.
              </p>

              {/* Mode Solo */}
              <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-[#163a2b]/70 border border-[#f4ecd8]/15 space-y-2">
                <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#f2c230]">
                  <span>Mode Solo (satu layar, tanpa HP):</span>
                </div>
                <p className="text-xs sm:text-sm text-[#cfd9c3] leading-relaxed">
                  Soal tampil besar di layar dengan tiga pilihan jawaban. Tim bergantian maju, satu perwakilan menyentuh layar untuk menjawab, lalu giliran berpindah ke tim lain.
                </p>
              </div>

              {/* Mode Multiplayer */}
              <div className="space-y-3 mb-6">
                <h3 className="text-sm sm:text-base font-bold text-[#f4ecd8]">
                  Mode Multiplayer (HP masing-masing):
                </h3>
                <ol className="space-y-3 text-xs sm:text-sm text-[#f4ecd8]/90 leading-relaxed list-decimal list-inside pl-1">
                  <li className="pl-1">
                    Layar guru menampilkan token 6 angka dan kode QR.
                  </li>
                  <li className="pl-1">
                    Siswa membuka halaman masuk siswa di HP, memindai QR atau mengetik token, lalu mengisi nama panggilan.
                  </li>
                  <li className="pl-1">
                    Siswa otomatis dibagi ke dua tim secara acak dan seimbang begitu guru menekan Mulai Lomba.
                  </li>
                  <li className="pl-1">
                    Setiap soal punya waktu 15 detik. Setelah menjawab, HP siswa langsung menunjukkan benar atau salah beserta penjelasannya.
                  </li>
                  <li className="pl-1">
                    Posisi tali dan skor dihitung di server, jadi hasilnya sama persis di layar guru dan semua HP siswa.
                  </li>
                </ol>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-[#122e22]/90 border border-[#f4ecd8]/15 text-xs sm:text-sm text-[#cfd9c3] italic">
                Catatan: siswa tidak perlu membuat akun. Mereka cukup diingat lewat token dan nama panggilan selama sesi berlangsung.
              </div>
            </article>

            {/* 7. Kolaborasi Papan Tulis */}
            <article
              id="kolaborasi-papan-tulis"
              className="scroll-mt-28 bg-[#1f4a37]/85 border border-[#e0d5b8]/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl backdrop-blur-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-xl bg-[#163a2b] border border-[#f2c230]/40 text-[#f2c230] font-black text-sm flex items-center justify-center font-mono">
                  07
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#f2c230]">
                  Kerja Sama Kelas
                </span>
              </div>

              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#f4ecd8] tracking-tight mb-4"
                style={{ fontFamily: "'Caveat Brush', 'Caveat', cursive" }}
              >
                7. Kolaborasi Papan Tulis
              </h2>

              <p className="text-sm sm:text-base text-[#cfd9c3] mb-4 leading-relaxed">
                Tekan tombol Bagikan di papan tulis untuk membuat tautan undangan. Ada dua peran:
              </p>

              <ul className="space-y-3 text-sm sm:text-base text-[#f4ecd8]/90 leading-relaxed mb-5">
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    <strong className="text-[#f4ecd8] font-bold">Viewer</strong> — hanya bisa melihat dan menggeser pandangan papan.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    <strong className="text-[#f4ecd8] font-bold">Editor</strong> — bisa ikut menggambar dan menulis di papan yang sama.
                  </span>
                </li>
              </ul>

              <p className="text-sm sm:text-base text-[#cfd9c3] leading-relaxed">
                Siapa pun yang punya tautan itu bisa masuk tanpa akun, cukup mengisi nama panggilan. Kamu bisa mengganti peran atau mencabut tautan kapan saja dari menu Bagikan yang sama. Untuk membukanya dari perangkat lain, pastikan perangkat itu terhubung ke jaringan WiFi yang sama dengan laptop kamu.
              </p>
            </article>

            {/* 8. Riwayat dan Statistik */}
            <article
              id="riwayat-dan-statistik"
              className="scroll-mt-28 bg-[#1f4a37]/85 border border-[#e0d5b8]/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl backdrop-blur-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-xl bg-[#163a2b] border border-[#f2c230]/40 text-[#f2c230] font-black text-sm flex items-center justify-center font-mono">
                  08
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#f2c230]">
                  Evaluasi Pembelajaran
                </span>
              </div>

              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#f4ecd8] tracking-tight mb-4"
                style={{ fontFamily: "'Caveat Brush', 'Caveat', cursive" }}
              >
                8. Riwayat dan Statistik
              </h2>

              <p className="text-sm sm:text-base text-[#f4ecd8]/90 leading-relaxed">
                Setiap sesi yang selesai otomatis tercatat di menu Riwayat: tanggal, template yang dipakai, tim pemenang, dan skor akhir. Buka detail sesi untuk melihat soal yang paling sering dijawab salah, berguna untuk tahu bagian materi mana yang masih perlu dijelaskan ulang. Nama siswa tidak ikut dicatat di riwayat ini.
              </p>
            </article>

            {/* 9. Privasi dan Keamanan */}
            <article
              id="privasi-dan-keamanan"
              className="scroll-mt-28 bg-[#1f4a37]/85 border border-[#e0d5b8]/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl backdrop-blur-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-xl bg-[#163a2b] border border-[#f2c230]/40 text-[#f2c230] font-black text-sm flex items-center justify-center font-mono">
                  09
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#f2c230]">
                  Perlindungan Data
                </span>
              </div>

              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#f4ecd8] tracking-tight mb-5"
                style={{ fontFamily: "'Caveat Brush', 'Caveat', cursive" }}
              >
                9. Privasi dan Keamanan
              </h2>

              <ul className="space-y-3.5 text-sm sm:text-base text-[#f4ecd8]/90 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    Siswa tidak perlu mendaftar akun. Nama panggilan yang mereka isi hanya tersimpan selama sesi berlangsung, lalu hilang, dan tidak disimpan ke database.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    Kata sandi guru disimpan dalam bentuk terenkripsi, tidak pernah ditampilkan ke siapa pun termasuk admin.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    Admin platform tidak bisa membuka isi papan tulis, template dan soal privat, atau hasil sesi milik guru. Admin hanya mengelola akun dan melihat angka statistik gabungan seluruh platform.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#f2c230] font-bold text-lg leading-none mt-1">•</span>
                  <span>
                    Jangan masukkan data pribadi siswa (nama lengkap, alamat, dll.) ke materi yang dikirim ke fitur AI.
                  </span>
                </li>
              </ul>
            </article>

            {/* 10. Masih Ada Pertanyaan? */}
            <article
              id="masih-ada-pertanyaan"
              className="scroll-mt-28 bg-[#1f4a37]/85 border border-[#e0d5b8]/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl backdrop-blur-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-xl bg-[#163a2b] border border-[#f2c230]/40 text-[#f2c230] font-black text-sm flex items-center justify-center font-mono">
                  10
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#f2c230]">
                  Bantuan &amp; FAQ
                </span>
              </div>

              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#f4ecd8] tracking-tight mb-4"
                style={{ fontFamily: "'Caveat Brush', 'Caveat', cursive" }}
              >
                10. Masih Ada Pertanyaan?
              </h2>

              <p className="text-sm sm:text-base text-[#f4ecd8]/90 leading-relaxed mb-6">
                Kunjungi bagian Pertanyaan yang Sering Muncul di halaman utama untuk jawaban singkat seputar biaya, kebutuhan internet, dan keamanan data. Kendala teknis bisa dilaporkan lewat tautan Laporkan masalah di footer.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/#faq"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#f08a24] hover:bg-[#d9771a] text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
                >
                  <span>Buka Tanya Jawab (FAQ)</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <a
                  href="https://github.com/refkyaja/DIscere/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#163a2b] hover:bg-[#122e22] text-[#f4ecd8] border border-[#f4ecd8]/25 font-bold text-xs sm:text-sm transition-all"
                >
                  <span>Laporkan Masalah di GitHub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://wa.me/6285885455853"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#163a2b] hover:bg-[#122e22] text-[#f4ecd8] border border-[#f4ecd8]/25 font-bold text-xs sm:text-sm transition-all"
                >
                  <span>WhatsApp Kontak Tim</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </article>
          </div>
        </div>
      </main>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Kembali ke atas"
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-[#f2c230] text-[#163a2b] shadow-2xl hover:bg-[#deb029] active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#f2c230]"
        >
          <ArrowUp className="w-5 h-5 font-bold" />
        </button>
      )}

      {/* Footer Komprehensif */}
      <footer className="w-full border-t border-[#f4ecd8]/15 mt-16 py-10 px-4 sm:px-8 bg-[#122e22]/90">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#cfd9c3]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#f4ecd8]">Discere</span>
            <span>—</span>
            <span>Belajar serius, bermain gembira.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[#f4ecd8]/80">
            <Link to="/" className="hover:text-[#f2c230] transition-colors">
              Beranda
            </Link>
            <Link to="/#faq" className="hover:text-[#f2c230] transition-colors">
              FAQ
            </Link>
            <a
              href="https://github.com/refkyaja/DIscere"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#f2c230] transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://wa.me/6285885455853"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#f2c230] transition-colors"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
