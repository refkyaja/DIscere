import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth';
import { apiRequest } from '../../lib/api';
import { Modal, PortalLedge } from '../../components';
import { ProfilView } from './ProfilView';
import { RiwayatDetailModal } from './RiwayatDetailModal';
import {
  LogOut,
  LayoutDashboard,
  BookOpen,
  History,
  PenTool,
  Plus,
  Play,
  Edit3,
  Copy,
  Trash2,
  Search,
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  ArrowRight,
  Trophy,
  User as UserIcon,
  Globe,
} from 'lucide-react';

function labelJenisGame(game?: string): string {
  if (game === 'makan_kerupuk') return 'Makan Kerupuk';
  if (game === 'panjat_pinang') return 'Panjat Pinang';
  if (game === 'balap_karung') return 'Balap Karung';
  return 'Tarik Tambang';
}

function labelTombolMulai(game?: string): string {
  if (game === 'makan_kerupuk') return 'Makan Kerupuk';
  if (game === 'panjat_pinang') return 'Panjat Pinang';
  if (game === 'balap_karung') return 'Balap Karung';
  return 'Tarik Tambang';
}

interface TemplateItem {
  id: string;
  judul: string;
  game: string;
  mode: string;
  resmi?: boolean;
  _count?: { questions: number };
  jumlahSoal?: number;
  updatedAt?: string;
}

interface SesiRiwayatItem {
  id: string;
  templateId: string;
  templateJudul: string;
  game: string;
  mode: string;
  tanggal: string;
  timMenang: string;
  posisiAkhir: number;
  skorMerah: number;
  skorPutih: number;
  totalSoal: number;
}

interface BoardItem {
  id: string;
  judul: string;
  createdAt: string;
  updatedAt: string;
  _count?: { shares: number };
}

interface RingkasanData {
  totalTemplate: number;
  totalSesi: number;
  totalPapan: number;
  templateTerbaru: Array<{
    id: string;
    judul: string;
    game: string;
    mode: string;
    jumlahSoal: number;
    updatedAt: string;
  }>;
  sesiTerakhir: {
    id: string;
    templateJudul: string;
    tanggal: string;
    timMenang: 'merah' | 'putih' | 'seri';
    posisiAkhir: number;
    skorMerah: number;
    skorPutih: number;
  } | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS_OF_WEEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function DashboardGuru() {
  const { user, keluar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Tab aktif
  const queryParams = new URLSearchParams(location.search);
  const tabFromUrl = queryParams.get('tab') || 'ringkasan';
  const [tabAktif, setTabAktif] = useState<string>(tabFromUrl);

  // Sync tab state dengan url
  useEffect(() => {
    const tab = queryParams.get('tab') || 'ringkasan';
    setTabAktif(tab);
  }, [location.search]);

  // Sidebar minimize state
  const [sidebarMinimized, setSidebarMinimized] = useState(false);

  // Range filter untuk grafik Sesi Game Selesai: Bulanan / Mingguan / Harian
  const [rangeMode, setRangeMode] = useState<'Bulanan' | 'Mingguan' | 'Harian'>('Bulanan');
  const [rangeDropdownOpen, setRangeDropdownOpen] = useState(false);
  const rangeDropdownRef = useRef<HTMLDivElement>(null);

  // Dropdown filter riwayat
  const [filterModeDropdownOpen, setFilterModeDropdownOpen] = useState(false);
  const filterModeRef = useRef<HTMLDivElement>(null);

  const [filterMenangDropdownOpen, setFilterMenangDropdownOpen] = useState(false);
  const filterMenangRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rangeDropdownRef.current && !rangeDropdownRef.current.contains(event.target as Node)) {
        setRangeDropdownOpen(false);
      }
      if (filterModeRef.current && !filterModeRef.current.contains(event.target as Node)) {
        setFilterModeDropdownOpen(false);
      }
      if (filterMenangRef.current && !filterMenangRef.current.contains(event.target as Node)) {
        setFilterMenangDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Data states
  const [ringkasan, setRingkasan] = useState<RingkasanData | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [pustakaResmi, setPustakaResmi] = useState<TemplateItem[]>([]);
  const [riwayatList, setRiwayatList] = useState<SesiRiwayatItem[]>([]);
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [subTabTemplate, setSubTabTemplate] = useState<'saya' | 'pustaka'>('saya');
  const [subTabAside, setSubTabAside] = useState<'hist' | 'tpl'>('hist');
  const [pencarian, setPencarian] = useState('');
  const [searchPapan, setSearchPapan] = useState('');

  // Riwayat filter & pagination states (muat 5 sesi per tabel/kotak)
  const [riwayatHalaman, setRiwayatHalaman] = useState(1);
  const [riwayatCari, setRiwayatCari] = useState('');
  const [riwayatFilterMode, setRiwayatFilterMode] = useState<'semua' | 'multi' | 'solo'>('semua');
  const [riwayatFilterMenang, setRiwayatFilterMenang] = useState<'semua' | 'merah' | 'putih' | 'seri'>('semua');
  const RIWAYAT_PER_HALAMAN = 5;

  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modal State
  const [modalHapusId, setModalHapusId] = useState<string | null>(null);
  const [modalDetailSessionId, setModalDetailSessionId] = useState<string | null>(null);
  const [modalHapusPapanId, setModalHapusPapanId] = useState<string | null>(null);
  const [modalGantiNamaPapan, setModalGantiNamaPapan] = useState<{ id: string; judul: string } | null>(null);
  const [inputGantiNama, setInputGantiNama] = useState('');
  const [modalKeluarOpen, setModalKeluarOpen] = useState(false);
  const [sisaAi, setSisaAi] = useState<number>(30);

  // Muat data kuota AI saat tab profil dibuka
  useEffect(() => {
    if (tabAktif === 'profil') {
      apiRequest<{ batasHarian: number; totalTerpakai?: number; sisaKuota?: number; terpakai?: number; sisa?: number }>('/ai/kuota')
        .then((res) => {
          const sisa = typeof res.sisaKuota === 'number'
            ? res.sisaKuota
            : typeof res.sisa === 'number'
            ? res.sisa
            : Math.max(0, 30 - (res.totalTerpakai ?? res.terpakai ?? 0));
          setSisaAi(sisa);
        })
        .catch(() => {});
    }
  }, [tabAktif]);

  const fetchRingkasan = useCallback(async () => {
    try {
      const res = await apiRequest<{ ringkasan: RingkasanData }>('/guru/ringkasan');
      setRingkasan(res.ringkasan);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const q = encodeURIComponent(pencarian);
      const [resSaya, resPustaka] = await Promise.all([
        apiRequest<{ templates: TemplateItem[] }>(`/template?q=${q}`),
        apiRequest<{ templates: TemplateItem[] }>(`/template/pustaka?q=${q}`),
      ]);
      setTemplates(resSaya.templates);
      setPustakaResmi(resPustaka.templates);
    } catch (err) {
      console.error(err);
    }
  }, [pencarian]);

  const fetchRiwayat = useCallback(async () => {
    try {
      const res = await apiRequest<{ riwayat: SesiRiwayatItem[] }>('/sesi/riwayat');
      setRiwayatList(res.riwayat);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchBoards = useCallback(async () => {
    try {
      const res = await apiRequest<{ boards: BoardItem[] }>('/papan');
      setBoards(res.boards);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Inisialisasi data
  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      await Promise.all([fetchRingkasan(), fetchTemplates(), fetchRiwayat(), fetchBoards()]);
      setLoading(false);
    }
    loadInitial();
  }, [fetchRingkasan, fetchTemplates, fetchRiwayat, fetchBoards]);

  // Handler: Buat Papan Tulis Baru
  const handleBuatPapanBaru = async () => {
    try {
      setActionLoadingId('buat_papan');
      const res = await apiRequest<{ board: { id: string } }>('/papan', {
        method: 'POST',
        body: JSON.stringify({ judul: 'Papan Pembelajaran Baru' }),
      });
      navigate(`/papan/${res.board.id}`);
    } catch (err: any) {
      alert(err.pesan || 'Gagal membuat papan baru.');
      setActionLoadingId(null);
    }
  };

  // Handler: Ganti Nama Papan
  const handleKonfirmasiGantiNamaPapan = async () => {
    if (!modalGantiNamaPapan || !inputGantiNama.trim()) return;
    try {
      setActionLoadingId(modalGantiNamaPapan.id);
      await apiRequest(`/papan/${modalGantiNamaPapan.id}/judul`, {
        method: 'PATCH',
        body: JSON.stringify({ judul: inputGantiNama.trim() }),
      });
      setModalGantiNamaPapan(null);
      await fetchBoards();
    } catch (err: any) {
      alert(err.pesan || 'Gagal mengubah judul papan.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handler: Hapus Papan
  const handleKonfirmasiHapusPapan = async () => {
    if (!modalHapusPapanId) return;
    try {
      setActionLoadingId(modalHapusPapanId);
      await apiRequest(`/papan/${modalHapusPapanId}`, { method: 'DELETE' });
      setModalHapusPapanId(null);
      await fetchBoards();
    } catch (err: any) {
      alert(err.pesan || 'Gagal menghapus papan.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handler: Mulai Game dari Template (semua 4 game diarahkan ke halaman pengaturan seragam)
  const handleMulaiGame = async (templateId: string, mode?: string, gameType?: string) => {
    const currentPath = `${location.pathname}${location.search}`;
    const kembaliParam = encodeURIComponent(currentPath || '/guru?tab=template');

    if (gameType === 'makan_kerupuk') {
      navigate(`/guru/makan-kerupuk?templateId=${encodeURIComponent(templateId)}&kembali=${kembaliParam}`);
      return;
    }

    if (gameType === 'panjat_pinang') {
      navigate(`/guru/panjat-pinang?templateId=${encodeURIComponent(templateId)}&kembali=${kembaliParam}`);
      return;
    }

    if (gameType === 'balap_karung') {
      navigate(`/guru/balap-karung?templateId=${encodeURIComponent(templateId)}&kembali=${kembaliParam}`);
      return;
    }

    if (!gameType || gameType === 'tarik_tambang') {
      navigate(`/guru/tarik-tambang?templateId=${encodeURIComponent(templateId)}&kembali=${kembaliParam}`);
      return;
    }

    try {
      setActionLoadingId(templateId);
      const res = await apiRequest<{ session: { id: string } }>('/sesi', {
        method: 'POST',
        body: JSON.stringify({ templateId, mode }),
      });
      navigate(`/guru/sesi/${res.session.id}`);
    } catch (err: any) {
      alert(err.pesan || 'Gagal memulai sesi game.');
      setActionLoadingId(null);
    }
  };

  // Handler: Duplikat Template
  const handleDuplikat = async (templateId: string) => {
    try {
      setActionLoadingId(templateId);
      await apiRequest(`/template/${templateId}/duplikat`, { method: 'POST' });
      await Promise.all([fetchTemplates(), fetchRingkasan()]);
      if (subTabTemplate === 'pustaka') {
        setSubTabTemplate('saya');
      }
    } catch (err: any) {
      alert(err.pesan || 'Gagal menyalin template.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handler: Hapus Template
  const handleKonfirmasiHapus = async () => {
    if (!modalHapusId) return;
    try {
      setActionLoadingId(modalHapusId);
      await apiRequest(`/template/${modalHapusId}`, { method: 'DELETE' });
      setModalHapusId(null);
      await Promise.all([fetchTemplates(), fetchRingkasan()]);
    } catch (err: any) {
      alert(err.pesan || 'Gagal menghapus template.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleKeluar = async () => {
    await keluar();
    navigate('/masuk');
  };

  // Kalkulasi data grafik sesuai filter range
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentDayOfWeekIdx = (now.getDay() + 6) % 7; // 0=Senin, 6=Minggu

  // Dapatkan label & nilai grafik
  let chartLabels: string[] = [];
  let chartCurrentIdx = 0;
  let chartValues: number[] = [];

  const totalSesi = ringkasan?.totalSesi || 0;

  if (rangeMode === 'Bulanan') {
    chartLabels = MONTHS;
    chartCurrentIdx = currentMonthIdx;
    chartValues = Array(12).fill(0);
    // Hitung sesi nyata dari riwayatList per bulan di tahun berjalan
    riwayatList.forEach((r) => {
      const d = new Date(r.tanggal);
      if (d.getFullYear() === now.getFullYear()) {
        const m = d.getMonth();
        if (m >= 0 && m < 12) {
          chartValues[m]++;
        }
      }
    });
  } else if (rangeMode === 'Mingguan') {
    chartLabels = DAYS_OF_WEEK;
    chartCurrentIdx = currentDayOfWeekIdx;
    chartValues = Array(7).fill(0);
    // Hitung sesi nyata untuk minggu berjalan (Senin s/d Minggu)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDayOfWeekIdx);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    riwayatList.forEach((r) => {
      const d = new Date(r.tanggal);
      if (d >= startOfWeek && d < endOfWeek) {
        const dayIdx = (d.getDay() + 6) % 7;
        chartValues[dayIdx]++;
      }
    });
  } else {
    // Harian (7 hari terakhir dari hari ini)
    chartLabels = [];
    chartValues = Array(7).fill(0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const slotIdx = 6 - i;
      chartLabels.push(`${d.getDate()} ${MONTHS[d.getMonth()]}`);

      const count = riwayatList.filter((r) => {
        const rd = new Date(r.tanggal);
        return (
          rd.getDate() === d.getDate() &&
          rd.getMonth() === d.getMonth() &&
          rd.getFullYear() === d.getFullYear()
        );
      }).length;
      chartValues[slotIdx] = count;
    }
    chartCurrentIdx = 6;
  }

  // Generate SVG smooth path
  const W = 400;
  const mx = Math.max(4, ...chartValues);
  const n = chartValues.length;
  const pts = chartValues.map((v, i) => [
    Math.round((i * W) / (n - 1)),
    Math.round(108 - (v / mx) * 80),
  ]);

  let curvePath = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < n; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mxMid = (x0 + x1) / 2;
    curvePath += ` C ${mxMid} ${y0}, ${mxMid} ${y1}, ${x1} ${y1}`;
  }
  const areaPath = `${curvePath} L ${pts[n - 1][0]} 130 L 0 130 Z`;
  const [curX, curY] = pts[chartCurrentIdx] || [360, 28];

  // Template filtering calculations (live client-side + server-synced)
  const qClean = pencarian.toLowerCase().trim();
  const templatesTersaring = templates.filter(
    (t) => !qClean || t.judul.toLowerCase().includes(qClean)
  );
  const pustakaTersaring = pustakaResmi.filter(
    (t) => !qClean || t.judul.toLowerCase().includes(qClean)
  );

  // Riwayat filtering & pagination calculations
  const riwayatTersaring = riwayatList.filter((r) => {
    const cocokJudul = r.templateJudul.toLowerCase().includes(riwayatCari.toLowerCase().trim());
    const cocokMode = riwayatFilterMode === 'semua' || r.mode?.toLowerCase() === riwayatFilterMode;
    const cocokMenang = riwayatFilterMenang === 'semua' || r.timMenang === riwayatFilterMenang;
    return cocokJudul && cocokMode && cocokMenang;
  });
  const totalHalamanRiwayat = Math.max(1, Math.ceil(riwayatTersaring.length / RIWAYAT_PER_HALAMAN));
  const indeksAwal = (riwayatHalaman - 1) * RIWAYAT_PER_HALAMAN;
  const riwayatDitampilkan = riwayatTersaring.slice(indeksAwal, indeksAwal + RIWAYAT_PER_HALAMAN);

  return (
    <div className="portal-bg">
      <div className={`portal-shell ${sidebarMinimized ? 'minimized' : ''}`}>
        {/* Sidebar Papan Tulis (Sticky Mengikuti Scroll & Minimizable) */}
        <aside className="portal-side">
          <div className="portal-side-header">
            <div className="portal-brand">
              <svg
                className="w-8 h-8 mx-auto shrink-0 text-[#f4ecd8]"
                viewBox="0 0 48 48"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinejoin="round"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M5 11c7-3 14-1 19 4v26c-5-5-12-7-19-4zM43 11c-7-3-14-1-19 4v26c5-5 12-7 19-4z" />
                <path d="M10 19h8M10 26h8M30 19h8M30 26h8" />
              </svg>
              {!sidebarMinimized && <span>Discere</span>}
            </div>
            <button
              type="button"
              onClick={() => setSidebarMinimized((prev) => !prev)}
              className="portal-side-toggle"
              title={sidebarMinimized ? 'Perluas Sidebar' : 'Kecilkan Sidebar'}
              aria-label={sidebarMinimized ? 'Perluas Sidebar' : 'Kecilkan Sidebar'}
            >
              {sidebarMinimized ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          <nav className="portal-nav" aria-label="Menu utama">
            <button
              type="button"
              aria-current={tabAktif === 'ringkasan' ? 'page' : undefined}
              onClick={() => navigate('/guru')}
              title="Ringkasan"
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Ringkasan</span>
            </button>

            <button
              type="button"
              aria-current={tabAktif === 'template' ? 'page' : undefined}
              onClick={() => navigate('/guru?tab=template')}
              title="Template Game"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Template Game</span>
            </button>

            <button
              type="button"
              aria-current={tabAktif === 'riwayat' ? 'page' : undefined}
              onClick={() => navigate('/guru?tab=riwayat')}
              title="Riwayat Sesi"
            >
              <History className="w-4 h-4 shrink-0" />
              <span>Riwayat Sesi</span>
            </button>

            <button
              type="button"
              aria-current={tabAktif === 'papan' ? 'page' : undefined}
              onClick={() => navigate('/guru?tab=papan')}
              title="Papan Tulis"
            >
              <PenTool className="w-4 h-4 shrink-0" />
              <span>Papan Tulis</span>
            </button>

            <button
              type="button"
              aria-current={tabAktif === 'profil' ? 'page' : undefined}
              onClick={() => navigate('/guru?tab=profil')}
              title="Profil Saya"
            >
              <UserIcon className="w-4 h-4 shrink-0" />
              <span>Profil Saya</span>
            </button>
          </nav>

          <div className="portal-who">
            <span className="portal-who-label">Masuk sebagai:</span>
            <b>{user?.nama || 'Guru Demo'}</b>
            <span>{user?.sekolah || 'SD Negeri Merdeka 01'}</span>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="portal-site"
              title="Buka Website Discere"
            >
              <Globe className="w-4 h-4 shrink-0 text-[#f2c230]" />
              <span>Lihat Website</span>
            </a>
            <button
              type="button"
              onClick={() => setModalKeluarOpen(true)}
              className="portal-out"
              title="Keluar"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Keluar</span>
            </button>
          </div>
        </aside>

        {/* Area Utama Konten */}
        <main className="portal-main">
          {/* Header Papan Tulis */}
          <header className="portal-head">
            <div>
              <h1>
                {tabAktif === 'ringkasan' && 'Ringkasan'}
                {tabAktif === 'template' && 'Template Game'}
                {tabAktif === 'riwayat' && 'Riwayat Sesi'}
                {tabAktif === 'papan' && 'Papan Tulis'}
                {tabAktif === 'profil' && 'Profil Pengajar'}
              </h1>
              <p>Selamat mengajar, Bapak/Ibu {user?.nama || 'Guru Demo'}.</p>
            </div>

            {tabAktif === 'template' && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/guru/template/baru')}
                  className="portal-btn red"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Template Baru</span>
                </button>
              </div>
            )}

            {tabAktif === 'papan' && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="portal-srch" style={{ minWidth: '220px', height: '38px' }}>
                  <Search className="w-4 h-4 text-[#6b7d6c]" />
                  <input
                    type="search"
                    placeholder="Cari judul papan..."
                    value={searchPapan}
                    onChange={(e) => setSearchPapan(e.target.value)}
                  />
                  {searchPapan && (
                    <button
                      type="button"
                      onClick={() => setSearchPapan('')}
                      className="text-[#6b7d6c] hover:text-[#1d3b2e]"
                      aria-label="Hapus pencarian"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleBuatPapanBaru}
                  disabled={actionLoadingId === 'buat_papan'}
                  className="portal-btn red"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Papan Baru</span>
                </button>
              </div>
            )}
          </header>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-[#cfd9c3]">
              <Loader2 className="w-10 h-10 animate-spin text-[#f2c230] mb-3" />
              <p className="portal-cv text-2xl text-[#f4ecd8]">Membuka papan kelas...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: RINGKASAN (100% PERSIS SEPERTI REFERENSI HTML & GAMBAR 1) */}
              {tabAktif === 'ringkasan' && ringkasan && (
                <div className="portal-rg-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: '22px' }}>
                  {/* Kolom Kiri: Chart, Big Card, & 3 Template Cards */}
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '22px' }}>
                    {/* Top Grid: Over Chart + Big Action Buttons */}
                    <div className="portal-top-grid">
                      {/* Kartu Grafik Sesi Game Selesai (.over) */}
                      <article className="portal-over">
                        <div className="hd">
                          <h2>Sesi Game Selesai</h2>
                          {/* Custom Dropdown Filter Interaktif: Bulanan / Mingguan / Harian */}
                          <div className="relative" ref={rangeDropdownRef}>
                            <button
                              type="button"
                              className="portal-sel"
                              onClick={() => setRangeDropdownOpen((prev) => !prev)}
                              aria-haspopup="listbox"
                              aria-expanded={rangeDropdownOpen}
                              title="Pilih filter rentang waktu grafik"
                            >
                              <span>{rangeMode}</span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  rangeDropdownOpen ? 'rotate-180' : ''
                                }`}
                              />
                            </button>

                            {rangeDropdownOpen && (
                              <div className="portal-dropdown-menu">
                                {(['Bulanan', 'Mingguan', 'Harian'] as const).map((mode) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() => {
                                      setRangeMode(mode);
                                      setRangeDropdownOpen(false);
                                    }}
                                    className={`portal-dropdown-item ${rangeMode === mode ? 'active' : ''}`}
                                  >
                                    <span>{mode}</span>
                                    {rangeMode === mode && <Check className="w-3.5 h-3.5 text-[#f2c230]" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="portal-chart-box">
                          {/* Tooltip Angka Sesi Dinamis */}
                          <div
                            style={{
                              position: 'absolute',
                              top: '2px',
                              left: `${Math.min(Math.max((curX / W) * 100, 8), 92)}%`,
                              transform: 'translateX(-50%)',
                              background: '#f4ecd8',
                              color: '#1d3b2e',
                              borderRadius: '9px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                              transition: 'left 0.3s ease',
                            }}
                          >
                            <b style={{ display: 'block', fontSize: '15px' }}>
                              {chartValues[chartCurrentIdx] || totalSesi} Sesi
                            </b>
                            {rangeMode === 'Bulanan'
                              ? 'Bulan Ini'
                              : rangeMode === 'Mingguan'
                              ? 'Hari Ini'
                              : 'Hari Terakhir'}
                          </div>

                          <svg viewBox="0 0 400 130" preserveAspectRatio="none" role="img" aria-label="Grafik sesi game selesai">
                            <defs>
                              <linearGradient id="portal-g" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0" stopColor="#f4ecd8" stopOpacity=".3" />
                                <stop offset="1" stopColor="#f4ecd8" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            {/* Area fill */}
                            <path d={areaPath} fill="url(#portal-g)" />
                            {/* Band vertical marker */}
                            <line
                              x1={curX}
                              x2={curX}
                              y1="0"
                              y2="130"
                              stroke="#f4ecd8"
                              strokeOpacity=".25"
                              strokeWidth="14"
                            />
                            {/* Yellow chalk curve */}
                            <path
                              d={curvePath}
                              fill="none"
                              stroke="#f2c230"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                            {/* Yellow dot with white stroke */}
                            <circle cx={curX} cy={curY} r="6" fill="#f2c230" stroke="#f4ecd8" strokeWidth="2" />
                          </svg>
                        </div>

                        {/* Barisan Bulan / Hari */}
                        <div className="portal-months">
                          {chartLabels.map((label, idx) => (
                            <span
                              key={label}
                              className={idx === chartCurrentIdx ? 'cur' : undefined}
                            >
                              {label}
                            </span>
                          ))}
                        </div>

                        {/* Barisan 3 Angka Statistik */}
                        <div className="portal-stats-row">
                          <div className="portal-stat-box">
                            <small>Template tersedia</small>
                            <b>{ringkasan.totalTemplate}</b>
                            <small>Template</small>
                          </div>
                          <div className="portal-stat-box highlight">
                            <small>Sesi game selesai</small>
                            <b>{ringkasan.totalSesi}</b>
                            <small>Total sesi</small>
                          </div>
                          <div className="portal-stat-box">
                            <small>Papan tersimpan</small>
                            <b>{ringkasan.totalPapan}</b>
                            <small>Papan</small>
                          </div>
                        </div>
                      </article>

                      {/* Right Action Buttons */}
                      <div className="portal-actions-col">
                        {/* Tombol Merah: Buat Template Kuis Baru */}
                        <button
                          type="button"
                          onClick={() => navigate('/guru/template/baru')}
                          className="portal-big k"
                        >
                          <div className="portal-big-header">
                            <div className="portal-ico">
                              <Plus className="w-6 h-6 text-[#f4ecd8]" />
                            </div>
                            <span className="portal-go">
                              <ArrowRight className="w-4 h-4 text-[#f4ecd8]" />
                            </span>
                          </div>
                          <div>
                            <h3>Buat Template Kuis Baru</h3>
                            <p>Susun soal materi untuk dimainkan bersama kelas.</p>
                          </div>
                        </button>

                        {/* Tombol Papan Tulis Digital */}
                        <button
                          type="button"
                          onClick={handleBuatPapanBaru}
                          disabled={actionLoadingId === 'buat_papan'}
                          className="portal-big p"
                        >
                          <div className="portal-big-header">
                            <div className="portal-ico">
                              <PenTool className="w-6 h-6 text-[#f4ecd8]" />
                            </div>
                            <span className="portal-go">
                              <ArrowRight className="w-4 h-4 text-[#f4ecd8]" />
                            </span>
                          </div>
                          <div>
                            <h3>Buka Papan Tulis Digital</h3>
                            <p>Kanvas tak terbatas untuk menjelaskan materi.</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Section: Template Game Terbaru & Quick Search */}
                    <div className="portal-sec flex flex-wrap items-center justify-between gap-3" style={{ margin: '4px 0 -6px' }}>
                      <div className="flex items-center gap-2">
                        <span>Template Game Terbaru</span>
                        {pustakaResmi.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSubTabTemplate('pustaka');
                              navigate('/guru?tab=template');
                            }}
                            className="portal-tag yellow font-bold cursor-pointer hover:opacity-90 transition-opacity"
                            title="Klik untuk membuka pustaka resmi admin"
                          >
                            Resmi Admin ({pustakaResmi.length})
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="portal-srch" style={{ minWidth: '200px', height: '34px' }}>
                          <Search className="w-3.5 h-3.5 text-[#6b7d6c]" />
                          <input
                            type="search"
                            placeholder="Cari materi kuis..."
                            value={pencarian}
                            onChange={(e) => setPencarian(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                navigate('/guru?tab=template');
                              }
                            }}
                            aria-label="Cari template materi"
                            style={{ fontSize: '12px' }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/guru?tab=template')}
                          style={{ color: '#f2c230' }}
                        >
                          Lihat Semua
                        </button>
                      </div>
                    </div>

                    {/* 3 Template Cards Sesuai Gambar 1 (.pc .card) */}
                    <div className="portal-cards-grid">
                      {ringkasan.templateTerbaru.slice(0, 3).map((tmpl) => {
                        const playedCount = riwayatList.filter((r) => r.templateId === tmpl.id).length;
                        const totalSesiInt = ringkasan.totalSesi;
                        const percentage = totalSesiInt > 0 ? Math.round((playedCount / totalSesiInt) * 100) : 0;

                        return (
                          <div key={tmpl.id} className="portal-card portal-pc">
                            {/* Floating Badge di atas kartu */}
                            <div className="badge">
                              <BookOpen className="w-6 h-6" />
                            </div>

                            <div className="flex-1 flex flex-col justify-between my-2">
                              <div>
                                <h4 className="break-words break-all [overflow-wrap:anywhere]">{tmpl.judul}</h4>
                                <div className="break-words [overflow-wrap:anywhere]" style={{ fontSize: '12px', color: '#6b7d6c', marginTop: '4px' }}>
                                  {tmpl.jumlahSoal} Soal Tersedia • {labelJenisGame(tmpl.game)}
                                </div>
                              </div>

                              {/* Progress bar porsi sesi */}
                              <div className="mt-3">
                                <div className="portal-prow">
                                  <span>Porsi sesi</span>
                                  <b>{percentage}%</b>
                                </div>
                                <div className="portal-bar">
                                  <i style={{ width: `${percentage}%` }} />
                                </div>
                              </div>
                            </div>

                            {/* Footer: X dari Y sesi & tombol Mulai */}
                            <div className="portal-foot">
                              <span className="whitespace-nowrap shrink-0">{playedCount} dari {totalSesiInt} sesi</span>
                              <button
                                type="button"
                                onClick={() => handleMulaiGame(tmpl.id, tmpl.mode, tmpl.game)}
                                className="portal-chip whitespace-nowrap shrink-0"
                              >
                                {labelTombolMulai(tmpl.game)}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Aside Panel Kanan (.card .panel) Sesuai Gambar 1 */}
                  <aside className="portal-card portal-panel">
                    <div className="portal-sec">
                      <span>Riwayat Sesi</span>
                      <button
                        type="button"
                        onClick={() => navigate('/guru?tab=riwayat')}
                      >
                        Lihat semua
                      </button>
                    </div>

                    {/* Tab Riwayat vs Template */}
                    <div className="portal-tabs">
                      <button
                        type="button"
                        className={subTabAside === 'hist' ? 'on' : ''}
                        onClick={() => setSubTabAside('hist')}
                      >
                        Riwayat
                      </button>
                      <button
                        type="button"
                        className={subTabAside === 'tpl' ? 'on' : ''}
                        onClick={() => setSubTabAside('tpl')}
                      >
                        Template
                      </button>
                    </div>

                    {/* Daftar Riwayat Sesi */}
                    <div className="portal-fl">
                      {subTabAside === 'hist' ? (
                        riwayatList.slice(0, 4).map((r) => {
                          const dateObj = new Date(r.tanggal);
                          const dateStr = `${dateObj.getDate()} ${MONTHS[dateObj.getMonth()]} ${dateObj.getFullYear()}, ${String(dateObj.getHours()).padStart(2, '0')}.${String(dateObj.getMinutes()).padStart(2, '0')}`;
                          const isIndividu =
                            r.game === 'panjat_pinang' ||
                            r.game === 'makan_kerupuk' ||
                            r.game === 'balap_karung';
                          const isRedWin = !isIndividu && r.timMenang === 'merah';
                          const isWhiteWin = !isIndividu && r.timMenang === 'putih';

                          return (
                            <div key={r.id} className="portal-fr">
                              <div className={`portal-av ${isIndividu ? 'b' : isRedWin ? 'r' : isWhiteWin ? 'b' : ''}`}>
                                {isIndividu ? (
                                  <Trophy className="w-4 h-4 text-[#f4ecd8]" />
                                ) : isRedWin ? (
                                  '🔴'
                                ) : isWhiteWin ? (
                                  '⚪'
                                ) : (
                                  '🤝'
                                )}
                              </div>
                              <div className="t">
                                <b>{r.templateJudul}</b>
                                <small>
                                  {r.game === 'panjat_pinang'
                                    ? `Juara: ${r.timMenang} (${r.posisiAkhir}%)`
                                    : r.game === 'balap_karung'
                                    ? `Juara: ${r.timMenang} (${r.posisiAkhir}m)`
                                    : r.game === 'makan_kerupuk'
                                    ? r.mode?.toLowerCase() === 'multi'
                                      ? `Multi • Juara: ${r.timMenang} (${r.skorMerah} pt)`
                                      : `Solo • Skor ${r.skorMerah} (${r.posisiAkhir}%)`
                                    : `Pemenang: ${isRedWin ? 'TIM MERAH' : isWhiteWin ? 'TIM PUTIH' : 'SERI'}`}
                                  <br />
                                  {dateStr}
                                </small>
                              </div>
                              <button
                                type="button"
                                onClick={() => setModalDetailSessionId(r.id)}
                                className="portal-msg"
                                title="Lihat detail sesi"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        (templates.length > 0 ? templates : pustakaResmi).slice(0, 4).map((t) => (
                          <div key={t.id} className="portal-fr">
                            <div className="portal-av b">
                              <BookOpen className="w-4 h-4 text-[#f4ecd8]" />
                            </div>
                            <div className="t">
                              <b>{t.judul}</b>
                              <small>
                                {t.jumlahSoal || t._count?.questions || 0} Soal • {t.mode}
                                {t.resmi ? ' • Resmi Admin' : ''}
                              </small>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleMulaiGame(t.id, t.mode, t.game)}
                              className="portal-msg"
                              title="Mainkan template"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Section: Papan Tulis Preview */}
                    <div className="portal-sec" style={{ marginTop: '4px' }}>
                      <span>Papan Tulis</span>
                      <button
                        type="button"
                        onClick={() => navigate('/guru?tab=papan')}
                      >
                        Lihat
                      </button>
                    </div>

                    {/* Mini Board Preview */}
                    <div className="portal-board-prev">
                      <svg viewBox="0 0 250 112" preserveAspectRatio="none" aria-hidden="true">
                        <path
                          d="M20 70 Q 70 30, 130 65 T 230 45"
                          stroke="#f4ecd8"
                          strokeWidth="2.5"
                          fill="none"
                          opacity=".8"
                        />
                        <circle cx="210" cy="35" r="14" stroke="#f2c230" strokeWidth="2.5" fill="none" opacity=".85" />
                      </svg>
                      <span>{boards[0]?.judul || 'Papan tanpa judul 1'}</span>
                    </div>

                    {/* Tombol Buat Papan Baru */}
                    <button
                      type="button"
                      onClick={handleBuatPapanBaru}
                      className="portal-btn red sm"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Buat Papan Baru</span>
                    </button>
                  </aside>
                </div>
              )}

              {/* TAB 2: TEMPLATE GAME */}
              {tabAktif === 'template' && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="portal-seg">
                      <button
                        type="button"
                        className={subTabTemplate === 'saya' ? 'on' : ''}
                        onClick={() => setSubTabTemplate('saya')}
                      >
                        Template Saya ({templatesTersaring.length})
                      </button>
                      <button
                        type="button"
                        className={subTabTemplate === 'pustaka' ? 'on' : ''}
                        onClick={() => setSubTabTemplate('pustaka')}
                      >
                        Pustaka Resmi Admin ({pustakaTersaring.length})
                      </button>
                    </div>

                    <div className="portal-srch">
                      <Search className="w-4 h-4 text-[#6b7d6c]" />
                      <input
                        type="search"
                        placeholder={
                          subTabTemplate === 'saya'
                            ? 'Cari di template saya...'
                            : 'Cari di pustaka resmi admin...'
                        }
                        value={pencarian}
                        onChange={(e) => setPencarian(e.target.value)}
                        aria-label="Cari materi"
                      />
                      {pencarian && (
                        <button
                          type="button"
                          onClick={() => setPencarian('')}
                          className="text-sm font-bold text-[#6b7d6c] hover:text-[#1d3b2e]"
                          title="Hapus pencarian"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {(subTabTemplate === 'saya' ? templatesTersaring : pustakaTersaring).map((tmpl) => {
                      const jumlahSoal = tmpl._count?.questions ?? tmpl.jumlahSoal ?? 0;
                      const isAdminOfficial = tmpl.resmi || subTabTemplate === 'pustaka';
                      return (
                        <div
                          key={tmpl.id}
                          className="portal-card p-4 sm:p-5 flex flex-col justify-between gap-4 overflow-hidden min-w-0"
                        >
                          <div className="space-y-2 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`portal-tag xs whitespace-nowrap shrink-0 ${
                                  tmpl.game === 'panjat_pinang'
                                    ? 'green font-bold'
                                    : tmpl.game === 'balap_karung'
                                    ? 'yellow font-bold'
                                    : tmpl.game === 'makan_kerupuk'
                                    ? 'blue font-bold'
                                    : 'red'
                                }`}
                              >
                                {labelJenisGame(tmpl.game)}
                              </span>
                              <span className="portal-tag xs yellow whitespace-nowrap shrink-0">
                                {tmpl.game === 'makan_kerupuk' ||
                                tmpl.game === 'balap_karung' ||
                                tmpl.game === 'tarik_tambang' ||
                                tmpl.game === 'panjat_pinang' ||
                                !tmpl.game
                                  ? 'Dual Mode'
                                  : 'Individu'}
                              </span>
                              {isAdminOfficial && (
                                <span className="portal-tag xs blue font-bold whitespace-nowrap shrink-0">
                                  Resmi
                                </span>
                              )}
                            </div>
                            <h3 className="portal-cv text-2xl text-[#1d3b2e] leading-snug break-words break-all [overflow-wrap:anywhere]">
                              {tmpl.judul}
                            </h3>
                            <p className="text-xs text-[#6b7d6c] font-bold break-words [overflow-wrap:anywhere]">
                              {jumlahSoal} Soal Tersedia
                              {isAdminOfficial && ' • Dibuat oleh Admin Kurikulum'}
                            </p>
                          </div>

                          <div className="pt-3 border-t-2 border-dashed border-[#e0d5b8] flex items-center justify-between gap-2 flex-nowrap">
                            {subTabTemplate === 'saya' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleMulaiGame(tmpl.id, tmpl.mode, tmpl.game)}
                                  className="portal-btn red xs whitespace-nowrap shrink-0"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>{labelTombolMulai(tmpl.game)}</span>
                                </button>

                                <div className="inline-flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/guru/template/${tmpl.id}/ubah`)}
                                    className="portal-btn ghost xs !p-1.5"
                                    title="Ubah Template"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDuplikat(tmpl.id)}
                                    className="portal-btn ghost xs !p-1.5"
                                    title="Duplikat Template"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setModalHapusId(tmpl.id)}
                                    className="portal-btn ghost-red xs !p-1.5"
                                    title="Hapus Template"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="w-full flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleMulaiGame(tmpl.id, tmpl.mode, tmpl.game)}
                                  className="portal-btn red xs flex-1 min-w-0 justify-center"
                                  title="Gunakan langsung template buatan admin ini"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                                  <span className="truncate">{labelTombolMulai(tmpl.game)}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplikat(tmpl.id)}
                                  className="portal-btn ghost xs flex-1 min-w-0 justify-center"
                                  title="Salin ke Template Saya untuk dimodifikasi"
                                >
                                  <Copy className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">Salin ke Koleksi</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {(subTabTemplate === 'saya' ? templatesTersaring : pustakaTersaring).length === 0 && (
                    <div className="portal-over text-center py-12 px-4 space-y-3">
                      {subTabTemplate === 'saya' && pustakaTersaring.length > 0 && qClean ? (
                        <>
                          <p className="portal-cv text-2xl text-[#f4ecd8]">
                            Tidak ditemukan di Template Saya
                          </p>
                          <p className="text-sm text-[#cfd9c3]">
                            Ditemukan <b>{pustakaTersaring.length} template serupa</b> yang dibuat oleh Admin!
                          </p>
                          <button
                            type="button"
                            onClick={() => setSubTabTemplate('pustaka')}
                            className="portal-btn red sm inline-flex items-center gap-2"
                          >
                            <BookOpen className="w-4 h-4" />
                            <span>Gunakan Template Buatan Admin ({pustakaTersaring.length})</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="portal-cv text-2xl text-[#f4ecd8]">
                            {qClean
                              ? `Materi "${pencarian}" tidak ditemukan.`
                              : subTabTemplate === 'saya'
                              ? 'Belum ada template. Buat yang pertama atau gunakan template resmi admin!'
                              : 'Belum ada template resmi di pustaka admin.'}
                          </p>
                          {qClean && (
                            <button
                              type="button"
                              onClick={() => setPencarian('')}
                              className="portal-btn ghost sm"
                            >
                              Bersihkan Pencarian
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: RIWAYAT SESI (SESUAI GAMBAR 3 & DESAIN ASLI) */}
              {tabAktif === 'riwayat' && (
                <div className="space-y-4">
                  {riwayatList.length === 0 ? (
                    <div className="portal-over text-center py-14 space-y-3">
                      <History className="w-10 h-10 mx-auto text-[#f2c230]" />
                      <h3 className="portal-cv text-2xl text-[#f4ecd8]">
                        Belum Ada Riwayat Permainan
                      </h3>
                      <p className="text-xs text-[#cfd9c3] max-w-sm mx-auto">
                        Sesi kuis game yang selesai dimainkan akan otomatis tercatat di sini.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/guru?tab=template')}
                        className="portal-btn sm"
                      >
                        Buka Template Game
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Bar Pencarian & Filter Riwayat */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="portal-srch" style={{ minWidth: '260px', flex: '1 1 260px' }}>
                          <Search className="w-4 h-4 text-[#6b7d6c]" />
                          <input
                            type="search"
                            placeholder="Cari materi sesi kuis..."
                            value={riwayatCari}
                            onChange={(e) => {
                              setRiwayatCari(e.target.value);
                              setRiwayatHalaman(1);
                            }}
                            aria-label="Cari riwayat materi"
                          />
                        </div>

                        {/* Custom Dropdown: Filter Mode & Hasil Pertandingan */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Dropdown Filter Mode */}
                          <div className="relative" ref={filterModeRef}>
                            <button
                              type="button"
                              className="portal-sel"
                              onClick={() => {
                                setFilterModeDropdownOpen((p) => !p);
                                setFilterMenangDropdownOpen(false);
                              }}
                              aria-haspopup="listbox"
                              aria-expanded={filterModeDropdownOpen}
                              title="Filter mode game"
                            >
                              <span>
                                {riwayatFilterMode === 'semua'
                                  ? 'Semua Mode'
                                  : riwayatFilterMode === 'multi'
                                  ? 'Multiplayer'
                                  : 'Solo'}
                              </span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  filterModeDropdownOpen ? 'rotate-180' : ''
                                }`}
                              />
                            </button>

                            {filterModeDropdownOpen && (
                              <div className="portal-dropdown-menu">
                                {[
                                  { val: 'semua', label: 'Semua Mode' },
                                  { val: 'multi', label: 'Mode Multiplayer' },
                                  { val: 'solo', label: 'Mode Solo' },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    type="button"
                                    onClick={() => {
                                      setRiwayatFilterMode(item.val as any);
                                      setRiwayatHalaman(1);
                                      setFilterModeDropdownOpen(false);
                                    }}
                                    className={`portal-dropdown-item ${
                                      riwayatFilterMode === item.val ? 'active' : ''
                                    }`}
                                  >
                                    <span>{item.label}</span>
                                    {riwayatFilterMode === item.val && (
                                      <Check className="w-3.5 h-3.5 text-[#f2c230]" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Dropdown Filter Hasil Pertandingan */}
                          <div className="relative" ref={filterMenangRef}>
                            <button
                              type="button"
                              className="portal-sel"
                              onClick={() => {
                                setFilterMenangDropdownOpen((p) => !p);
                                setFilterModeDropdownOpen(false);
                              }}
                              aria-haspopup="listbox"
                              aria-expanded={filterMenangDropdownOpen}
                              title="Filter hasil pertandingan"
                            >
                              <span>
                                {riwayatFilterMenang === 'semua'
                                  ? 'Semua Hasil'
                                  : riwayatFilterMenang === 'merah'
                                  ? 'Tim Merah'
                                  : riwayatFilterMenang === 'putih'
                                  ? 'Tim Putih'
                                  : 'Seri'}
                              </span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  filterMenangDropdownOpen ? 'rotate-180' : ''
                                }`}
                              />
                            </button>

                            {filterMenangDropdownOpen && (
                              <div className="portal-dropdown-menu">
                                {[
                                  { val: 'semua', label: 'Semua Hasil' },
                                  { val: 'merah', label: 'Tim Merah Menang' },
                                  { val: 'putih', label: 'Tim Putih Menang' },
                                  { val: 'seri', label: 'Seri' },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    type="button"
                                    onClick={() => {
                                      setRiwayatFilterMenang(item.val as any);
                                      setRiwayatHalaman(1);
                                      setFilterMenangDropdownOpen(false);
                                    }}
                                    className={`portal-dropdown-item ${
                                      riwayatFilterMenang === item.val ? 'active' : ''
                                    }`}
                                  >
                                    <span>{item.label}</span>
                                    {riwayatFilterMenang === item.val && (
                                      <Check className="w-3.5 h-3.5 text-[#f2c230]" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tabel Kartu Riwayat */}
                      <div className="portal-card overflow-hidden">
                        {riwayatTersaring.length === 0 ? (
                          <div className="py-12 text-center text-[#6b7d6c] space-y-2">
                            <p className="font-bold">Tidak ada riwayat yang sesuai dengan filter.</p>
                            <button
                              type="button"
                              onClick={() => {
                                setRiwayatCari('');
                                setRiwayatFilterMode('semua');
                                setRiwayatFilterMenang('semua');
                                setRiwayatHalaman(1);
                              }}
                              className="text-xs text-[#c8362f] underline font-bold"
                            >
                              Reset Filter
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="divide-y-2 divide-dashed divide-[#e0d5b8]">
                              {riwayatDitampilkan.map((r) => {
                                const isRed = r.timMenang === 'merah';
                                const isWhite = r.timMenang === 'putih';

                                return (
                                  <div
                                    key={r.id}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: '16px',
                                      padding: '18px 24px',
                                    }}
                                  >
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={`portal-tag font-bold ${
                                            r.game === 'panjat_pinang'
                                              ? 'green'
                                              : r.game === 'balap_karung'
                                              ? 'red'
                                              : r.game === 'makan_kerupuk'
                                              ? 'blue'
                                              : 'yellow'
                                          }`}
                                        >
                                          {labelJenisGame(r.game)} • {r.mode?.toLowerCase() === 'multi' ? 'MULTI' : 'SOLO'}
                                        </span>
                                        <span className="text-xs text-[#6b7d6c]">
                                          {new Date(r.tanggal).toLocaleDateString('id-ID', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </span>
                                      </div>
                                      <h3 className="portal-cv text-2xl text-[#1d3b2e] break-words break-all [overflow-wrap:anywhere]">
                                        {r.templateJudul}
                                      </h3>
                                      <div className="text-xs font-semibold text-[#1d3b2e]">
                                        {r.game === 'panjat_pinang' ? (
                                          <>
                                            Juara 1: <span className="font-bold">{r.timMenang}</span> ({r.posisiAkhir}%) • Mencapai Puncak:{' '}
                                            <span className="font-mono font-bold">
                                              {r.skorMerah}/{r.skorPutih} pemain
                                            </span>
                                          </>
                                        ) : r.game === 'balap_karung' ? (
                                          <>
                                            Juara 1: <span className="font-bold">{r.timMenang}</span> ({r.posisiAkhir}m) • Mencapai Finis:{' '}
                                            <span className="font-mono font-bold">
                                              {r.skorMerah}/{r.skorPutih} pelari
                                            </span>
                                          </>
                                        ) : r.game === 'makan_kerupuk' ? (
                                          r.mode?.toLowerCase() === 'multi' ? (
                                            <>
                                              Juara 1: <span className="font-bold">{r.timMenang}</span> • Skor Tertinggi:{' '}
                                              <span className="font-mono font-bold">{r.skorMerah}</span> • Ludes:{' '}
                                              <span className="font-mono font-bold">{r.skorPutih} siswa</span>
                                            </>
                                          ) : (
                                            <>
                                              Status: <span className="font-bold">{r.timMenang}</span> • Skor Total:{' '}
                                              <span className="font-mono font-bold">{r.skorMerah}</span> • Progres:{' '}
                                              <span className="font-mono font-bold">{r.posisiAkhir}%</span>
                                            </>
                                          )
                                        ) : (
                                          <>
                                            Pemenang:{' '}
                                            <span className="font-bold">
                                              {isRed
                                                ? 'Tim Merah'
                                                : isWhite
                                                ? 'Tim Putih'
                                                : 'Seri'}
                                            </span>{' '}
                                            (Skor: {r.skorMerah} vs {r.skorPutih}) • Posisi Tali:{' '}
                                            <span className="font-mono font-bold">
                                              {r.posisiAkhir > 0 ? `+${r.posisiAkhir}` : r.posisiAkhir}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => setModalDetailSessionId(r.id)}
                                      className="portal-btn ghost-red sm"
                                      style={{ flexShrink: 0 }}
                                    >
                                      Lihat Detail
                                    </button>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Paginasi Riwayat */}
                            <div className="portal-pagination">
                              <span className="portal-pagination-info">
                                Menampilkan {indeksAwal + 1}–{Math.min(indeksAwal + RIWAYAT_PER_HALAMAN, riwayatTersaring.length)} dari {riwayatTersaring.length} sesi
                              </span>

                              <div className="portal-pagination-btns">
                                <button
                                  type="button"
                                  onClick={() => setRiwayatHalaman((p) => Math.max(1, p - 1))}
                                  disabled={riwayatHalaman === 1}
                                  className="portal-page-btn"
                                  title="Halaman Sebelumnya"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>

                                {Array.from({ length: totalHalamanRiwayat }, (_, idx) => idx + 1).map((hal) => {
                                  if (
                                    hal === 1 ||
                                    hal === totalHalamanRiwayat ||
                                    Math.abs(hal - riwayatHalaman) <= 1
                                  ) {
                                    return (
                                      <button
                                        key={hal}
                                        type="button"
                                        onClick={() => setRiwayatHalaman(hal)}
                                        className={`portal-page-btn ${riwayatHalaman === hal ? 'active' : ''}`}
                                      >
                                        {hal}
                                      </button>
                                    );
                                  } else if (
                                    (hal === 2 && riwayatHalaman > 3) ||
                                    (hal === totalHalamanRiwayat - 1 && riwayatHalaman < totalHalamanRiwayat - 2)
                                  ) {
                                    return (
                                      <span key={hal} className="px-1 text-[#6b7d6c] font-bold">
                                        ...
                                      </span>
                                    );
                                  }
                                  return null;
                                })}

                                <button
                                  type="button"
                                  onClick={() => setRiwayatHalaman((p) => Math.min(totalHalamanRiwayat, p + 1))}
                                  disabled={riwayatHalaman === totalHalamanRiwayat}
                                  className="portal-page-btn"
                                  title="Halaman Selanjutnya"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 4: PAPAN TULIS */}
              {tabAktif === 'papan' && (
                <div className="space-y-5">
                  {boards.length === 0 ? (
                    /* 1 Informasi tunggal saat belum ada papan tersimpan */
                    <div className="portal-over text-center py-16 space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-[#163a2b] border-2 border-dashed border-[#e0d5b8]/40 flex items-center justify-center">
                        <PenTool className="w-8 h-8 text-[#f2c230]" />
                      </div>
                      <div>
                        <h3 className="portal-cv text-3xl text-[#f4ecd8]">
                          Belum Ada Papan Tulis Tersimpan
                        </h3>
                        <p className="text-sm text-[#cfd9c3] max-w-md mx-auto mt-1">
                          Mulai jelaskan materi pelajaran dengan kanvas interaktif tak terbatas. Coret rumus, gambar ilustrasi, atau gunakan AI.
                        </p>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={handleBuatPapanBaru}
                          disabled={actionLoadingId === 'buat_papan'}
                          className="portal-btn red"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Buka Papan Pertama Anda</span>
                        </button>
                      </div>
                    </div>
                  ) : boards.filter((b) => b.judul.toLowerCase().includes(searchPapan.toLowerCase().trim())).length === 0 ? (
                    <div className="portal-over text-center py-16 space-y-3">
                      <Search className="w-10 h-10 text-[#6b7d6c] mx-auto mb-2" />
                      <h3 className="portal-cv text-2xl text-[#f4ecd8]">
                        Papan Tulis Tidak Ditemukan
                      </h3>
                      <p className="text-sm text-[#cfd9c3]">
                        Tidak ada papan dengan kata kunci "{searchPapan}".
                      </p>
                      <button
                        type="button"
                        onClick={() => setSearchPapan('')}
                        className="portal-btn ghost sm mt-2"
                      >
                        Reset Pencarian
                      </button>
                    </div>
                  ) : (
                    /* Saat sudah ada papan, informasi empty hilang dan langsung tampil grid kartu papan */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {boards
                        .filter((b) => b.judul.toLowerCase().includes(searchPapan.toLowerCase().trim()))
                        .map((b) => (
                        <div
                          key={b.id}
                          className="portal-card overflow-hidden flex flex-col justify-between"
                        >
                          {/* Mini Board Header Frame */}
                          <div className="h-28 bg-[#1f4a37] border-b-4 border-[#a6783c] flex items-center justify-center p-3 text-center">
                            <span className="portal-cv text-xl text-[#f4ecd8] line-clamp-2">
                              {b.judul}
                            </span>
                          </div>

                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between text-[11px] text-[#6b7d6c]">
                              <span>
                                Diubah:{' '}
                                {new Date(b.updatedAt).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {Boolean(b._count?.shares) && (
                                <span className="portal-tag blue">
                                  {b._count?.shares} Berbagi
                                </span>
                              )}
                            </div>

                            <div className="pt-2 border-t-2 border-dashed border-[#e0d5b8] flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => navigate(`/papan/${b.id}`)}
                                className="portal-btn red sm"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Buka Papan</span>
                              </button>

                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModalGantiNamaPapan({ id: b.id, judul: b.judul });
                                    setInputGantiNama(b.judul);
                                  }}
                                  className="portal-btn ghost sm"
                                  title="Ganti Judul Papan"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setModalHapusPapanId(b.id)}
                                  className="portal-btn ghost-red sm"
                                  title="Hapus Papan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: PROFIL PENGAJAR */}
              {tabAktif === 'profil' && (
                <ProfilView
                  stats={{
                    totalTemplate: ringkasan?.totalTemplate ?? templates.length,
                    totalSesi: ringkasan?.totalSesi ?? riwayatList.length,
                    totalPapan: boards.length,
                    kuotaAiSisa: sisaAi,
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* DUDUKAN PAPAN TULIS COKLAT DI PALING BAWAH (MEMANJANG FULL DARI UJUNG KANAN KE KIRI) */}
      <PortalLedge />

      {/* Modal Konfirmasi Hapus Template */}
      <Modal
        isOpen={Boolean(modalHapusId)}
        onClose={() => setModalHapusId(null)}
        title="Hapus Template Materi?"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#1d3b2e]">
            Apakah Anda yakin ingin menghapus template ini? Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
            <button
              type="button"
              className="portal-btn ghost sm"
              onClick={() => setModalHapusId(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="portal-btn red sm"
              onClick={handleKonfirmasiHapus}
              disabled={Boolean(actionLoadingId)}
            >
              Ya, Hapus
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Detail Riwayat */}
      <RiwayatDetailModal
        sessionId={modalDetailSessionId}
        isOpen={Boolean(modalDetailSessionId)}
        onClose={() => setModalDetailSessionId(null)}
      />

      {/* Modal Ganti Nama Papan */}
      <Modal
        isOpen={Boolean(modalGantiNamaPapan)}
        onClose={() => setModalGantiNamaPapan(null)}
        title="Ganti Judul Papan Tulis"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleKonfirmasiGantiNamaPapan();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-2">
              Judul Papan Tulis
            </label>
            <input
              type="text"
              value={inputGantiNama}
              onChange={(e) => setInputGantiNama(e.target.value)}
              placeholder="Contoh: Matematika Pecahan Kelas 5"
              className="portal-input"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
            <button
              type="button"
              className="portal-btn ghost sm"
              onClick={() => setModalGantiNamaPapan(null)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="portal-btn red sm"
              disabled={actionLoadingId === modalGantiNamaPapan?.id}
            >
              Simpan Perubahan
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Hapus Papan */}
      <Modal
        isOpen={Boolean(modalHapusPapanId)}
        onClose={() => setModalHapusPapanId(null)}
        title="Hapus Papan Tulis?"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#1d3b2e]">
            Apakah Anda yakin ingin menghapus papan tulis ini? Seluruh catatan materi dan tautan berbagi akan terhapus permanen.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
            <button
              type="button"
              className="portal-btn ghost sm"
              onClick={() => setModalHapusPapanId(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="portal-btn red sm"
              onClick={handleKonfirmasiHapusPapan}
              disabled={actionLoadingId === modalHapusPapanId}
            >
              Ya, Hapus Papan
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Keluar Akun Guru */}
      <Modal
        isOpen={modalKeluarOpen}
        onClose={() => setModalKeluarOpen(false)}
        title="Konfirmasi Keluar"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#1d3b2e] leading-relaxed">
            Apakah Anda yakin ingin keluar dari akun?
          </p>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
            <button
              type="button"
              onClick={() => setModalKeluarOpen(false)}
              className="portal-btn ghost sm"
            >
              Tidak
            </button>
            <button
              type="button"
              onClick={handleKeluar}
              className="portal-btn red sm"
            >
              Ya, Keluar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
