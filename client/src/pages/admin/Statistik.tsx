import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../lib/auth';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components';
import { ProfilAdminView } from './ProfilAdminView';
import {
  LogOut,
  BarChart3,
  Users,
  BookOpen,
  Cpu,
  History,
  Search,
  CheckCircle2,
  XCircle,
  KeyRound,
  Trash2,
  Plus,
  Edit2,
  AlertTriangle,
  Loader2,
  Gamepad2,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  User as UserIcon,
  Globe,
  Copy,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import {
  parseAiQuizText,
  PROMPT_TEMPLATE,
  type QuestionItem as AdminQuestionItem,
} from '../../lib/quizParser';

type AdminTab = 'statistik' | 'guru' | 'pustaka' | 'ai' | 'log' | 'profil';

export default function DashboardAdmin() {
  const { user, keluar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const tabFromUrl = queryParams.get('tab') as AdminTab;
  const validTabs: AdminTab[] = ['statistik', 'guru', 'pustaka', 'ai', 'log', 'profil'];
  const activeTab: AdminTab = validTabs.includes(tabFromUrl) ? tabFromUrl : 'statistik';

  const handlePindahTab = (tab: AdminTab) => {
    setSuksesPesan(null);
    setErrorPesan(null);
    navigate(`/admin?tab=${tab}`);
  };

  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [suksesPesan, setSuksesPesan] = useState<string | null>(null);

  // Auto-dismiss pesan sukses dalam 4 detik
  useEffect(() => {
    if (suksesPesan) {
      const timer = setTimeout(() => {
        setSuksesPesan(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [suksesPesan]);

  // 1. Data Statistik
  const [statistik, setStatistik] = useState<any>(null);

  // Range filter untuk grafik Sesi Game Selesai: Bulanan / Mingguan / Harian
  const [rangeMode, setRangeMode] = useState<'Bulanan' | 'Mingguan' | 'Harian'>('Bulanan');
  const [rangeDropdownOpen, setRangeDropdownOpen] = useState(false);
  const rangeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rangeDropdownRef.current && !rangeDropdownRef.current.contains(event.target as Node)) {
        setRangeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 2. Data Guru
  const [daftarGuru, setDaftarGuru] = useState<any[]>([]);
  const [searchGuru, setSearchGuru] = useState('');
  const [selectedGuru, setSelectedGuru] = useState<any>(null);
  const [modalResetPassOpen, setModalResetPassOpen] = useState(false);
  const [resetPassResult, setResetPassResult] = useState<string | null>(null);
  const [modalHapusGuruOpen, setModalHapusGuruOpen] = useState(false);
  const [submittingGuru, setSubmittingGuru] = useState(false);

  // 3. Data Pustaka Template Resmi
  const [daftarPustaka, setDaftarPustaka] = useState<any[]>([]);
  const [modalTemplateOpen, setModalTemplateOpen] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [templateJudul, setTemplateJudul] = useState('');
  const [templateGame, setTemplateGame] = useState('tarik_tambang');
  const [templateMode, setTemplateMode] = useState<'solo' | 'multi'>('solo');
  const [templateSoal, setTemplateSoal] = useState<AdminQuestionItem[]>([
    {
      urutan: 1,
      teks: '',
      opsiA: '',
      opsiB: '',
      opsiC: '',
      jawabanBenar: 'A',
      penjelasan: '',
      dibuatAi: false,
    },
  ]);
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [modalHapusTemplateOpen, setModalHapusTemplateOpen] = useState(false);
  const [targetHapusTemplate, setTargetHapusTemplate] = useState<any>(null);

  // Mode Input Template (Manual vs Tempel Teks AI)
  const [templateInputMode, setTemplateInputMode] = useState<'manual' | 'tempel_ai'>('manual');
  const [templateTeksAi, setTemplateTeksAi] = useState('');
  const [templateErrorTempel, setTemplateErrorTempel] = useState<string | null>(null);
  const [templateSuksesTempel, setTemplateSuksesTempel] = useState<string | null>(null);

  useEffect(() => {
    if (!templateSuksesTempel) return;
    const timer = setTimeout(() => {
      setTemplateSuksesTempel(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [templateSuksesTempel]);
  const [templatePromptCopied, setTemplatePromptCopied] = useState(false);

  // Generator AI Otomatis (Admin)
  const [modalAiAdminOpen, setModalAiAdminOpen] = useState(false);
  const [aiMateri, setAiMateri] = useState('');
  const [aiJumlah, setAiJumlah] = useState<number>(5);
  const aiTingkat = 'SD';
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuksesPesan, setAiSuksesPesan] = useState<string | null>(null);

  // 4. Data Monitoring AI
  const [aiData, setAiData] = useState<any>(null);

  // 5. Data Audit Log Admin
  const [adminLogs, setAdminLogs] = useState<any[]>([]);

  // Konfirmasi Keluar Modal
  const [modalKeluarOpen, setModalKeluarOpen] = useState(false);

  const handleKeluar = async () => {
    await keluar();
    navigate('/masuk');
  };

  // Muat data sesuai tab aktif
  useEffect(() => {
    async function loadTabData() {
      setLoading(true);
      setErrorPesan(null);
      try {
        if (activeTab === 'statistik') {
          const res = await apiRequest<{ statistik: any }>('/admin/statistik');
          setStatistik(res.statistik);
        } else if (activeTab === 'guru') {
          const res = await apiRequest<{ guru: any[] }>(`/admin/guru?q=${encodeURIComponent(searchGuru)}`);
          setDaftarGuru(res.guru);
        } else if (activeTab === 'pustaka') {
          const res = await apiRequest<{ templates: any[] }>('/admin/pustaka');
          setDaftarPustaka(res.templates);
        } else if (activeTab === 'ai') {
          const res = await apiRequest<{ aiMonitoring: any }>('/admin/ai');
          setAiData(res.aiMonitoring);
        } else if (activeTab === 'log') {
          const res = await apiRequest<{ logs: any[] }>('/admin/log');
          setAdminLogs(res.logs);
        } else if (activeTab === 'profil') {
          if (!statistik) {
            const res = await apiRequest<{ statistik: any }>('/admin/statistik');
            setStatistik(res.statistik);
          }
        }
      } catch (err: any) {
        setErrorPesan(err.pesan || 'Gagal memuat data administrator.');
      } finally {
        setLoading(false);
      }
    }

    loadTabData();
  }, [activeTab]);

  // Pencarian guru saat user menekan enter atau submit
  const handleCariGuru = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiRequest<{ guru: any[] }>(`/admin/guru?q=${encodeURIComponent(searchGuru)}`);
      setDaftarGuru(res.guru);
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal mencari guru.');
    } finally {
      setLoading(false);
    }
  };

  // Aksi Ubah Status Guru (Aktif / Nonaktif)
  const handleToggleStatusGuru = async (guru: any) => {
    const statusBaru = guru.status === 'aktif' ? 'nonaktif' : 'aktif';
    try {
      setSubmittingGuru(true);
      await apiRequest(`/admin/guru/${guru.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: statusBaru }),
      });
      setDaftarGuru((prev) =>
        prev.map((g) => (g.id === guru.id ? { ...g, status: statusBaru } : g))
      );
      setSuksesPesan(`Status akun ${guru.nama} berhasil diubah menjadi ${statusBaru}.`);
      setTimeout(() => setSuksesPesan(null), 3000);
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal mengubah status akun guru.');
    } finally {
      setSubmittingGuru(false);
    }
  };

  // Aksi Reset Password Guru
  const handleResetPasswordGuru = async () => {
    if (!selectedGuru) return;
    try {
      setSubmittingGuru(true);
      const res = await apiRequest<{ passwordBaru: string }>(`/admin/guru/${selectedGuru.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ resetPassword: true }),
      });
      setResetPassResult(res.passwordBaru);
      setSuksesPesan(`Kata sandi akun ${selectedGuru.nama} berhasil direset.`);
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal mereset kata sandi.');
    } finally {
      setSubmittingGuru(false);
    }
  };

  // Aksi Hapus Guru
  const handleHapusGuru = async () => {
    if (!selectedGuru) return;
    try {
      setSubmittingGuru(true);
      await apiRequest(`/admin/guru/${selectedGuru.id}`, {
        method: 'DELETE',
      });
      setDaftarGuru((prev) => prev.filter((g) => g.id !== selectedGuru.id));
      setModalHapusGuruOpen(false);
      setSelectedGuru(null);
      setSuksesPesan(`Akun guru beserta seluruh datanya berhasil dihapus permanen.`);
      setTimeout(() => setSuksesPesan(null), 3000);
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal menghapus akun guru.');
    } finally {
      setSubmittingGuru(false);
    }
  };

  // Buka Modal Buat Template Resmi
  const handleBukaModalTemplateBaru = () => {
    setEditTemplateId(null);
    setTemplateJudul('');
    setTemplateGame('tarik_tambang');
    setTemplateMode('solo');
    setTemplateInputMode('manual');
    setTemplateTeksAi('');
    setTemplateErrorTempel(null);
    setTemplateSuksesTempel(null);
    setTemplateSoal([
      {
        urutan: 1,
        teks: '',
        opsiA: '',
        opsiB: '',
        opsiC: '',
        jawabanBenar: 'A',
        penjelasan: '',
        dibuatAi: false,
      },
    ]);
    setModalTemplateOpen(true);
  };

  // Buka Modal Edit Template Resmi
  const handleBukaModalEditTemplate = (tmpl: any) => {
    setEditTemplateId(tmpl.id);
    setTemplateJudul(tmpl.judul);
    setTemplateGame(tmpl.game || 'tarik_tambang');
    setTemplateMode(tmpl.mode || 'solo');
    setTemplateInputMode('manual');
    setTemplateTeksAi('');
    setTemplateErrorTempel(null);
    setTemplateSuksesTempel(null);
    if (tmpl.questions && tmpl.questions.length > 0) {
      setTemplateSoal(
        tmpl.questions.map((q: any, idx: number) => ({
          urutan: q.urutan || idx + 1,
          teks: q.teks,
          opsiA: q.opsiA,
          opsiB: q.opsiB,
          opsiC: q.opsiC,
          jawabanBenar: q.jawabanBenar,
          penjelasan: q.penjelasan || '',
          dibuatAi: Boolean(q.dibuatAi),
        }))
      );
    } else {
      setTemplateSoal([
        {
          urutan: 1,
          teks: '',
          opsiA: '',
          opsiB: '',
          opsiC: '',
          jawabanBenar: 'A',
          penjelasan: '',
          dibuatAi: false,
        },
      ]);
    }
    setModalTemplateOpen(true);
  };

  const handleTambahSoalAdmin = () => {
    setTemplateSoal((prev) => [
      ...prev,
      {
        urutan: prev.length + 1,
        teks: '',
        opsiA: '',
        opsiB: '',
        opsiC: '',
        jawabanBenar: 'A',
        penjelasan: '',
        dibuatAi: false,
      },
    ]);
  };

  const handleHapusSoalAdmin = (index: number) => {
    if (templateSoal.length <= 1) return;
    setTemplateSoal((prev) =>
      prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, urutan: i + 1 }))
    );
  };

  const handleUpdateSoalAdmin = (index: number, field: string, val: any) => {
    setTemplateSoal((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSalinPromptAdmin = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT_TEMPLATE);
      setTemplatePromptCopied(true);
      setTimeout(() => setTemplatePromptCopied(false), 2000);
    } catch {
      alert('Gagal menyalin otomatis. Silakan salin teks di dalam kotak secara manual.');
    }
  };

  const handleKonversiTeksAiAdmin = () => {
    setTemplateErrorTempel(null);
    setTemplateSuksesTempel(null);

    if (!templateTeksAi.trim()) {
      setTemplateErrorTempel('Silakan tempelkan teks hasil generate dari ChatGPT / Claude terlebih dahulu.');
      return;
    }

    const hasilParse = parseAiQuizText(templateTeksAi);
    if (hasilParse.length === 0) {
      setTemplateErrorTempel(
        'Format teks belum terbaca dengan tepat. Pastikan terdapat nomor soal, opsi A, B, C, serta baris "Jawaban: X" sesuai format.'
      );
      return;
    }

    setTemplateSoal(hasilParse);
    setTemplateSuksesTempel(`Berhasil mengimpor ${hasilParse.length} butir soal dari AI! Anda dapat meninjau dan mengeditnya di tab Input Manual.`);
    setTemplateInputMode('manual');
  };

  const handleGenerateAiAdmin = async () => {
    if (!aiMateri.trim() || aiMateri.trim().length < 20) {
      setAiError('Teks materi minimal 20 karakter agar AI dapat menyusun soal yang mendidik.');
      return;
    }

    try {
      setAiLoading(true);
      setAiError(null);
      const res = await apiRequest<{
        sukses?: boolean;
        soal?: Array<{
          urutan?: number;
          teks: string;
          opsiA: string;
          opsiB: string;
          opsiC: string;
          jawabanBenar: 'A' | 'B' | 'C';
          penjelasan?: string;
        }>;
        questions?: Array<{
          urutan?: number;
          teks: string;
          opsiA: string;
          opsiB: string;
          opsiC: string;
          jawabanBenar: 'A' | 'B' | 'C';
          penjelasan?: string;
        }>;
      }>('/ai/soal', {
        method: 'POST',
        body: JSON.stringify({
          materi: aiMateri.trim(),
          jumlah: aiJumlah,
          tingkat: aiTingkat,
          jumlahSoal: aiJumlah,
          jenjang: aiTingkat,
        }),
      });

      const daftarSoal = res.soal || res.questions || [];

      if (daftarSoal.length > 0) {
        const formatted: AdminQuestionItem[] = daftarSoal.map((q, idx) => ({
          urutan: idx + 1,
          teks: q.teks,
          opsiA: q.opsiA,
          opsiB: q.opsiB,
          opsiC: q.opsiC,
          jawabanBenar: q.jawabanBenar,
          penjelasan: q.penjelasan || '',
          dibuatAi: true,
        }));

        setTemplateSoal(formatted);
        setTemplateInputMode('manual');
        setAiSuksesPesan(`Berhasil menghasilkan ${formatted.length} butir soal kuis!`);

        setTimeout(() => {
          setModalAiAdminOpen(false);
          setAiSuksesPesan(null);
          setAiMateri('');
        }, 1200);
      } else {
        setAiError('Tidak ada soal yang berhasil dihasilkan. Silakan coba lagi.');
      }
    } catch (err: any) {
      setAiError(err.pesan || 'Gagal menghasilkan soal dengan AI.');
    } finally {
      setAiLoading(false);
    }
  };

  // Simpan Template Resmi
  const handleSimpanTemplateResmi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateJudul.trim()) {
      alert('Judul template resmi wajib diisi.');
      return;
    }

    try {
      setSubmittingTemplate(true);
      const payload = {
        judul: templateJudul.trim(),
        game: templateGame,
        mode: templateMode,
        questions: templateSoal.map((q, idx) => ({
          urutan: idx + 1,
          teks: q.teks.trim(),
          opsiA: q.opsiA.trim(),
          opsiB: q.opsiB.trim(),
          opsiC: q.opsiC.trim(),
          jawabanBenar: q.jawabanBenar,
          penjelasan: q.penjelasan ? q.penjelasan.trim() : null,
          dibuatAi: Boolean(q.dibuatAi),
        })),
      };

      if (editTemplateId) {
        await apiRequest(`/admin/pustaka/${editTemplateId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSuksesPesan('Template resmi berhasil diperbarui.');
      } else {
        await apiRequest('/admin/pustaka', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuksesPesan('Template resmi baru berhasil dibuat.');
      }

      setModalTemplateOpen(false);
      const res = await apiRequest<{ templates: any[] }>('/admin/pustaka');
      setDaftarPustaka(res.templates);
      setTimeout(() => setSuksesPesan(null), 3000);
    } catch (err: any) {
      alert(err.pesan || 'Gagal menyimpan template resmi.');
    } finally {
      setSubmittingTemplate(false);
    }
  };

  // Hapus Template Resmi
  const handleHapusTemplateResmi = async () => {
    if (!targetHapusTemplate) return;
    try {
      setSubmittingTemplate(true);
      await apiRequest(`/admin/pustaka/${targetHapusTemplate.id}`, {
        method: 'DELETE',
      });
      setDaftarPustaka((prev) => prev.filter((t) => t.id !== targetHapusTemplate.id));
      setModalHapusTemplateOpen(false);
      setTargetHapusTemplate(null);
      setSuksesPesan('Template resmi berhasil dihapus.');
      setTimeout(() => setSuksesPesan(null), 3000);
    } catch (err: any) {
      alert(err.pesan || 'Gagal menghapus template resmi.');
    } finally {
      setSubmittingTemplate(false);
    }
  };

  // Kalkulasi data grafik sesuai filter range
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const DAYS_OF_WEEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentDayOfWeekIdx = (now.getDay() + 6) % 7;

  let chartLabels = MONTHS;
  let chartValues: number[] = Array(12).fill(0);
  let chartCurrentIdx = currentMonthIdx;

  if (rangeMode === 'Bulanan') {
    chartLabels = MONTHS;
    chartValues = statistik?.grafikBulanan || Array(12).fill(0);
    chartCurrentIdx = currentMonthIdx;
  } else if (rangeMode === 'Mingguan') {
    chartLabels = DAYS_OF_WEEK;
    chartValues = statistik?.grafikMingguan || Array(7).fill(0);
    chartCurrentIdx = currentDayOfWeekIdx;
  } else {
    chartLabels = statistik?.grafikHarianLabels || ['H-6', 'H-5', 'H-4', 'H-3', 'H-2', 'H-1', 'Hari ini'];
    chartValues = statistik?.grafikHarian || Array(7).fill(0);
    chartCurrentIdx = 6;
  }

  // Generate SVG smooth path
  const W = 400;
  const mx = Math.max(4, ...chartValues);
  const n = chartValues.length;
  const pts = chartValues.map((v, i) => [
    Math.round((i * W) / Math.max(1, n - 1)),
    Math.round(108 - (v / mx) * 80),
  ]);

  let curvePath = `M ${pts[0]?.[0] ?? 0} ${pts[0]?.[1] ?? 108}`;
  for (let i = 1; i < n; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mxMid = (x0 + x1) / 2;
    curvePath += ` C ${mxMid} ${y0}, ${mxMid} ${y1}, ${x1} ${y1}`;
  }
  const lastX = pts[n - 1]?.[0] ?? W;
  const areaPath = `${curvePath} L ${lastX} 130 L 0 130 Z`;
  const [curX, curY] = pts[chartCurrentIdx] || [360, 28];

  return (
    <div className="portal-bg">
      <div className={`portal-shell ${sidebarMinimized ? 'minimized' : ''}`}>
        {/* Sidebar Papan Tulis (Sticky Mengikuti Scroll & Minimizable) */}
        <aside className="portal-side">
          <div className="portal-side-header">
            <div className="portal-brand flex-1 min-w-0 pr-1">
              <svg
                className="w-7 h-7 shrink-0 text-[#f4ecd8]"
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
              <span className="!text-[17px] tracking-tight">Discere Admin</span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarMinimized((prev) => !prev)}
              className="portal-side-toggle shrink-0"
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

          <nav className="portal-nav" aria-label="Menu navigasi admin">
            <button
              type="button"
              aria-current={activeTab === 'statistik' ? 'page' : undefined}
              onClick={() => handlePindahTab('statistik')}
              title="Statistik Platform"
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Statistik Platform</span>
            </button>

            <button
              type="button"
              aria-current={activeTab === 'guru' ? 'page' : undefined}
              onClick={() => handlePindahTab('guru')}
              title="Kelola Akun Guru"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Kelola Akun Guru</span>
            </button>

            <button
              type="button"
              aria-current={activeTab === 'pustaka' ? 'page' : undefined}
              onClick={() => handlePindahTab('pustaka')}
              title="Pustaka Resmi"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Pustaka Resmi</span>
            </button>

            <button
              type="button"
              aria-current={activeTab === 'ai' ? 'page' : undefined}
              onClick={() => handlePindahTab('ai')}
              title="Monitoring AI"
            >
              <Cpu className="w-4 h-4 shrink-0" />
              <span>Monitoring AI</span>
            </button>

            <button
              type="button"
              aria-current={activeTab === 'log' ? 'page' : undefined}
              onClick={() => handlePindahTab('log')}
              title="Log Audit"
            >
              <History className="w-4 h-4 shrink-0" />
              <span>Log Audit</span>
            </button>

            <button
              type="button"
              aria-current={activeTab === 'profil' ? 'page' : undefined}
              onClick={() => handlePindahTab('profil')}
              title="Profil Admin"
            >
              <UserIcon className="w-4 h-4 shrink-0" />
              <span>Profil Admin</span>
            </button>
          </nav>

          <div className="portal-who">
            <span className="portal-who-label">Masuk sebagai:</span>
            <b>{user?.nama || 'Administrator'}</b>
            <span>{user?.email}</span>
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
                {activeTab === 'statistik' && 'Statistik Pembelajaran'}
                {activeTab === 'guru' && 'Daftar & Status Guru'}
                {activeTab === 'pustaka' && 'Pustaka Template Resmi'}
                {activeTab === 'ai' && 'Monitoring Pemakaian AI'}
                {activeTab === 'log' && 'Log Audit Administrator'}
                {activeTab === 'profil' && 'Profil Administrator'}
              </h1>
              <p>
                Platform Pembelajaran Cerdas & Menyenangkan • Akses Terisolasi Administrator
              </p>
            </div>

            {activeTab === 'pustaka' && (
              <button
                type="button"
                onClick={handleBukaModalTemplateBaru}
                className="portal-btn red"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Template Resmi</span>
              </button>
            )}
          </header>

          {/* Notifikasi Error */}
          {errorPesan && (
            <div className="portal-banner error mb-5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-[#c8362f]" />
              <span className="font-bold text-[#c8362f]">{errorPesan}</span>
            </div>
          )}

          {/* Indikator Memuat Data */}
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center text-[#cfd9c3]">
              <Loader2 className="w-10 h-10 animate-spin text-[#f2c230] mb-3" />
              <p className="portal-cv text-2xl text-[#f4ecd8]">Menyiapkan papan administrasi...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* ========================================================= */}
              {/* 1. TAB STATISTIK PLATFORM */}
              {/* ========================================================= */}
              {activeTab === 'statistik' && statistik && (
                <div className="space-y-6">
                  {/* 4 Kartu Ringkasan Metrik (Ala Papan Tulis Kapur) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="portal-over flex flex-col justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#cfd9c3]">
                        Total Akun Guru
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="portal-cv text-4xl text-[#f4ecd8]">{statistik.totalGuru}</span>
                        <span className="portal-tag green">{statistik.guruAktif} Aktif</span>
                      </div>
                      <span className="text-xs text-[#cfd9c3] mt-2">Pendidik terdaftar</span>
                    </div>

                    <div className="portal-over flex flex-col justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#cfd9c3]">
                        Sesi Game Berjalan
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="portal-cv text-4xl text-[#f2c230]">{statistik.totalSesi}</span>
                        <span className="portal-tag yellow">{statistik.sesiSelesai} Tuntas</span>
                      </div>
                      <span className="text-xs text-[#cfd9c3] mt-2">Kuis interaktif kelas</span>
                    </div>

                    <div className="portal-over flex flex-col justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#cfd9c3]">
                        Template Materi
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="portal-cv text-4xl text-[#f4ecd8]">{statistik.totalTemplate}</span>
                        <span className="portal-tag blue">{statistik.totalTemplateResmi} Resmi</span>
                      </div>
                      <span className="text-xs text-[#cfd9c3] mt-2">Bank soal siap main</span>
                    </div>

                    <div className="portal-over flex flex-col justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#cfd9c3]">
                        Papan Tulis Digital
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="portal-cv text-4xl text-[#ffdcd9]">{statistik.totalPapan}</span>
                        <span className="portal-tag red">Cloud Canvas</span>
                      </div>
                      <span className="text-xs text-[#cfd9c3] mt-2">Coretan kanvas tersimpan</span>
                    </div>
                  </div>

                  {/* Grafik Sesi Game Selesai (.over) dengan Filter Rentang Waktu Seperti Guru */}
                  <article className="portal-over">
                    <div className="hd flex items-center justify-between pb-2">
                      <div>
                        <h2 className="portal-cv text-2xl text-[#f4ecd8]">Sesi Game Selesai</h2>
                        <p className="text-xs text-[#cfd9c3]">
                          {rangeMode === 'Bulanan'
                            ? 'Agregat sesi game per bulan di tahun berjalan'
                            : rangeMode === 'Mingguan'
                            ? 'Agregat sesi game per hari di minggu berjalan'
                            : 'Agregat sesi game 7 hari terakhir'}
                        </p>
                      </div>

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
                          {chartValues[chartCurrentIdx] || 0} Sesi
                        </b>
                        {rangeMode === 'Bulanan'
                          ? 'Bulan Ini'
                          : rangeMode === 'Mingguan'
                          ? 'Hari Ini'
                          : 'Hari Terakhir'}
                      </div>

                      <svg viewBox="0 0 400 130" preserveAspectRatio="none" role="img" aria-label="Grafik sesi game selesai">
                        <defs>
                          <linearGradient id="portal-admin-g" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#f4ecd8" stopOpacity=".3" />
                            <stop offset="1" stopColor="#f4ecd8" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {/* Area fill */}
                        <path d={areaPath} fill="url(#portal-admin-g)" />
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
                          key={`${label}-${idx}`}
                          className={idx === chartCurrentIdx ? 'cur' : undefined}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </article>
                </div>
              )}

              {/* ========================================================= */}
              {/* 2. TAB KELOLA AKUN GURU */}
              {/* ========================================================= */}
              {activeTab === 'guru' && (
                <div className="space-y-5">
                  {suksesPesan && (
                    <div className="portal-banner success">
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-[#245039]" />
                      <span className="font-bold text-[#1d3b2e]">{suksesPesan}</span>
                    </div>
                  )}

                  {/* Form Pencarian Bergaya Kapur */}
                  <form onSubmit={handleCariGuru} className="flex items-center gap-3">
                    <div className="portal-srch flex-1">
                      <Search className="w-4 h-4 text-[#6b7d6c]" />
                      <input
                        type="search"
                        value={searchGuru}
                        onChange={(e) => setSearchGuru(e.target.value)}
                        placeholder="Cari guru berdasarkan nama, email, atau asal sekolah..."
                        aria-label="Cari guru"
                      />
                    </div>
                    <button type="submit" className="portal-btn sm">
                      Cari Guru
                    </button>
                  </form>

                  {/* Tabel Guru (Ala Kertas Lembar Nilai) */}
                  <div className="portal-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="portal-table">
                        <thead>
                          <tr>
                            <th>Guru & Sekolah</th>
                            <th>Email</th>
                            <th>Status Akun</th>
                            <th>Konten Dibuat</th>
                            <th style={{ textAlign: 'right' }}>Tindakan Administrator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {daftarGuru.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-[#6b7d6c]">
                                Tidak ada data guru yang ditemukan.
                              </td>
                            </tr>
                          ) : (
                            daftarGuru.map((g) => (
                              <tr key={g.id}>
                                <td>
                                  <div className="font-bold text-[#1d3b2e] text-sm">{g.nama}</div>
                                  <div className="text-xs text-[#6b7d6c]">
                                    {g.sekolah || 'Sekolah belum diisi'}
                                  </div>
                                </td>
                                <td className="font-mono text-xs text-[#1d3b2e]">{g.email}</td>
                                <td>
                                  {g.status === 'aktif' ? (
                                    <span className="portal-tag green">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
                                    </span>
                                  ) : (
                                    <span className="portal-tag red">
                                      <XCircle className="w-3.5 h-3.5" /> Nonaktif
                                    </span>
                                  )}
                                </td>
                                <td className="text-xs text-[#1d3b2e]">
                                  <div className="font-semibold">{g._count?.templates || 0} template materi</div>
                                  <div className="text-[11px] text-[#6b7d6c]">
                                    {g._count?.sessions || 0} sesi kuis • {g._count?.boards || 0} papan
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStatusGuru(g)}
                                      disabled={submittingGuru}
                                      className={`portal-btn sm ${
                                        g.status === 'aktif' ? 'ghost-red' : 'ghost'
                                      }`}
                                    >
                                      {g.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedGuru(g);
                                        setResetPassResult(null);
                                        setModalResetPassOpen(true);
                                      }}
                                      className="portal-btn ghost sm"
                                      title="Reset Kata Sandi"
                                    >
                                      <KeyRound className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedGuru(g);
                                        setModalHapusGuruOpen(true);
                                      }}
                                      className="portal-btn ghost-red sm"
                                      title="Hapus Akun Guru"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* 3. TAB PUSTAKA TEMPLATE RESMI */}
              {/* ========================================================= */}
              {activeTab === 'pustaka' && (
                <div className="space-y-5">
                  {suksesPesan && (
                    <div className="portal-banner success">
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-[#245039]" />
                      <span className="font-bold text-[#1d3b2e]">{suksesPesan}</span>
                    </div>
                  )}

                  {daftarPustaka.length === 0 ? (
                    <div className="portal-over text-center py-12 px-4 space-y-3">
                      <h2 className="portal-cv text-2xl text-[#f4ecd8]">Belum Ada Template Resmi Tersimpan</h2>
                      <p className="text-xs text-[#cfd9c3]">
                        Susun template materi terverifikasi yang langsung dapat disalin dan dimainkan oleh seluruh guru.
                      </p>
                      <button
                        type="button"
                        onClick={handleBukaModalTemplateBaru}
                        className="portal-btn red sm inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Buat Template Pertama</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {daftarPustaka.map((tmpl) => (
                        <div
                          key={tmpl.id}
                          className="portal-card p-5 flex flex-col justify-between gap-4"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="portal-tag blue">Resmi Platform</span>
                              <span className="text-xs font-bold text-[#6b7d6c] uppercase">
                                Mode {tmpl.mode}
                              </span>
                            </div>
                            <h3 className="portal-cv text-2xl text-[#1d3b2e] leading-snug">
                              {tmpl.judul}
                            </h3>
                            <div className="text-xs text-[#6b7d6c] flex items-center gap-1.5 pt-1">
                              <Gamepad2 className="w-4 h-4 text-[#c8362f]" />
                              <span className="font-bold">
                                Tarik Tambang • {tmpl.questions?.length || 0} Soal
                              </span>
                            </div>
                          </div>

                          <div className="pt-3 border-t-2 border-dashed border-[#e0d5b8] flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleBukaModalEditTemplate(tmpl)}
                              className="portal-btn ghost sm"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Ubah
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetHapusTemplate(tmpl);
                                setModalHapusTemplateOpen(true);
                              }}
                              className="portal-btn ghost-red sm"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* 4. TAB MONITORING AI */}
              {/* ========================================================= */}
              {activeTab === 'ai' && aiData && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="portal-over">
                      <span className="text-xs font-bold uppercase text-[#cfd9c3]">
                        Total Panggilan AI
                      </span>
                      <div className="portal-cv text-4xl text-[#f2c230] mt-1">
                        {aiData.totalPanggilanSeluruhnya}
                      </div>
                      <span className="text-xs text-[#cfd9c3] mt-1 block">Akumulasi seluruh request</span>
                    </div>

                    <div className="portal-over">
                      <span className="text-xs font-bold uppercase text-[#cfd9c3]">
                        Cache Jawaban Tersimpan
                      </span>
                      <div className="portal-cv text-4xl text-[#f4ecd8] mt-1">
                        {aiData.totalCacheTersimpan}
                      </div>
                      <span className="text-xs text-[#cfd9c3] mt-1 block">Optimalisasi kuota & response</span>
                    </div>

                    <div className="portal-over">
                      <span className="text-xs font-bold uppercase text-[#cfd9c3]">
                        Batas Harian Guru
                      </span>
                      <div className="portal-cv text-4xl text-[#f2c230] mt-1">30</div>
                      <span className="text-xs text-[#cfd9c3] mt-1 block">Panggilan per guru per hari</span>
                    </div>
                  </div>

                  <div className="portal-card overflow-hidden p-6 space-y-4">
                    <h3 className="portal-cv text-2xl text-[#1d3b2e]">
                      Riwayat Penggunaan AI Harian (Agregat)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="portal-table">
                        <thead>
                          <tr>
                            <th>Tanggal</th>
                            <th>Total Panggilan AI</th>
                            <th>Guru Aktif Menggunakan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiData.rekapHarian?.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="py-8 text-center text-[#6b7d6c]">
                                Belum ada catatan aktivitas penggunaan AI.
                              </td>
                            </tr>
                          ) : (
                            aiData.rekapHarian?.map((r: any) => (
                              <tr key={r.tanggal}>
                                <td className="font-bold text-[#1d3b2e]">{r.tanggal}</td>
                                <td className="font-bold text-[#c8362f]">{r.totalPanggilan} panggilan</td>
                                <td className="text-[#1d3b2e]">{r.jumlahGuru} guru</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* 5. TAB LOG AKTIVITAS ADMIN */}
              {/* ========================================================= */}
              {activeTab === 'log' && (
                <div className="space-y-5">
                  <div className="portal-banner info">
                    <Info className="w-5 h-5 text-[#f2c230] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#cfd9c3] leading-relaxed">
                      <strong className="text-[#f4ecd8]">Audit Akuntabilitas:</strong> Seluruh tindakan administratif (aktivasi, penonaktifan, reset sandi, maupun penghapusan akun) dicatat secara permanen di sini untuk menjaga transparansi platform.
                    </p>
                  </div>

                  <div className="portal-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="portal-table">
                        <thead>
                          <tr>
                            <th>Waktu Eksekusi</th>
                            <th>Admin Pelaksana</th>
                            <th>Aksi / Tindakan</th>
                            <th>Target / Subjek</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminLogs.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-10 text-center text-[#6b7d6c]">
                                Belum ada catatan log tindakan administrator.
                              </td>
                            </tr>
                          ) : (
                            adminLogs.map((log) => (
                              <tr key={log.id}>
                                <td className="text-xs text-[#6b7d6c] whitespace-nowrap">
                                  {new Date(log.createdAt).toLocaleString('id-ID')}
                                </td>
                                <td>
                                  <div className="font-bold text-[#1d3b2e] text-xs">
                                    {log.admin?.nama}
                                  </div>
                                  <div className="text-[11px] text-[#6b7d6c] font-mono">
                                    {log.admin?.email}
                                  </div>
                                </td>
                                <td className="font-bold text-[#1d3b2e] text-xs">{log.aksi}</td>
                                <td className="font-mono text-xs text-[#6b7d6c]">{log.target}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {/* ========================================================= */}
              {/* 6. TAB PROFIL ADMINISTRATOR                               */}
              {/* ========================================================= */}
              {activeTab === 'profil' && (
                <ProfilAdminView
                  stats={{
                    totalGuru: statistik?.totalGuru,
                    totalTemplateResmi: statistik?.totalTemplateResmi ?? daftarPustaka.length,
                    totalSesi: statistik?.totalSesi,
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Dudukan Kapur Kayu (Chalk Ledge) Full Width Ujung Kiri-Kanan */}
      <div className="portal-ledge" aria-hidden="true">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0 34C240 6 480 62 720 34S1200 6 1440 34V80H0z" fill="#a6783c" />
          <path d="M0 56C260 34 520 80 760 56S1220 36 1440 58V80H0z" fill="#8d6444" />
        </svg>
        <div className="portal-chalks">
          <i style={{ width: '84px', background: '#7a9c85' }} />
          <i style={{ width: '70px', background: '#7a9c85' }} />
          <i style={{ width: '92px', background: '#7a9c85' }} />
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL RESET KATA SANDI GURU */}
      {/* ========================================================= */}
      <Modal
        isOpen={modalResetPassOpen}
        onClose={() => setModalResetPassOpen(false)}
        title="Reset Kata Sandi Akun Guru"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#1d3b2e]">
            Apakah Anda yakin ingin mereset kata sandi akun guru{' '}
            <strong>{selectedGuru?.nama}</strong> ({selectedGuru?.email})?
          </p>

          {resetPassResult && (
            <div className="portal-banner success">
              <div>
                <span className="font-bold text-xs text-[#1d3b2e] block">
                  Kata Sandi Baru Sementara:
                </span>
                <div className="font-mono text-base font-extrabold text-[#c8362f] select-all my-1">
                  {resetPassResult}
                </div>
                <span className="text-[11px] text-[#6b7d6c] block">
                  Berikan kata sandi ini kepada guru untuk masuk kembali.
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
            <button
              type="button"
              className="portal-btn ghost sm"
              onClick={() => setModalResetPassOpen(false)}
            >
              Tutup
            </button>
            {!resetPassResult && (
              <button
                type="button"
                className="portal-btn red sm"
                onClick={handleResetPasswordGuru}
                disabled={submittingGuru}
              >
                Reset Sekarang
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL HAPUS GURU */}
      {/* ========================================================= */}
      <Modal
        isOpen={modalHapusGuruOpen}
        onClose={() => setModalHapusGuruOpen(false)}
        title="Hapus Akun Guru Permanen"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="portal-banner error">
            <AlertTriangle className="w-5 h-5 text-[#c8362f] shrink-0 mt-0.5" />
            <p className="text-xs text-[#c8362f]">
              <strong>Tindakan Permanen:</strong> Menghapus akun guru{' '}
              <strong>{selectedGuru?.nama}</strong> akan menghapus seluruh data template kuis, riwayat sesi, dan papan tulis miliknya.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
            <button
              type="button"
              className="portal-btn ghost sm"
              onClick={() => setModalHapusGuruOpen(false)}
              disabled={submittingGuru}
            >
              Batal
            </button>
            <button
              type="button"
              className="portal-btn red sm"
              onClick={handleHapusGuru}
              disabled={submittingGuru}
            >
              Ya, Hapus Permanen
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL BUAT / EDIT TEMPLATE RESMI */}
      {/* ========================================================= */}
      <Modal
        isOpen={modalTemplateOpen}
        onClose={() => !submittingTemplate && setModalTemplateOpen(false)}
        title={editTemplateId ? 'Ubah Template Resmi' : 'Buat Template Resmi Baru'}
        maxWidth="3xl"
      >
        <form onSubmit={handleSimpanTemplateResmi} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1">
              Judul Template Materi
            </label>
            <input
              type="text"
              required
              value={templateJudul}
              onChange={(e) => setTemplateJudul(e.target.value)}
              placeholder="Contoh: Tata Surya dan Planet Kelas 6 SD"
              className="portal-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1">
                Jenis Lomba / Mini-Game
              </label>
              <select
                value={templateGame}
                onChange={(e) => setTemplateGame(e.target.value)}
                className="portal-select"
              >
                <option value="tarik_tambang">Tarik Tambang (Layar Bersama & Multiplayer)</option>
                <option value="balap_karung">Balap Karung (Lomba Cepat & Multiplayer)</option>
                <option value="panjat_pinang">Panjat Pinang (Tantangan Strategis)</option>
                <option value="makan_kerupuk">Makan Kerupuk Challenge (Dual Mode: Multi / Solo)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1">
                Mode Permainan
              </label>
              <select
                value={templateMode}
                onChange={(e) => setTemplateMode(e.target.value as any)}
                className="portal-select"
              >
                <option value="solo">Mode Solo (Layar Bersama / 1 Layar)</option>
                <option value="multi">Mode Multiplayer (Siswa Join via HP / PIN)</option>
              </select>
            </div>
          </div>

          {/* Action Header & Segmented Switcher Mode Input */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t-2 border-dashed border-[#e0d5b8]">
            <div className="inline-flex p-1 bg-[#ecdcb9] rounded-2xl border border-[#d8c29d] gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => setTemplateInputMode('manual')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  templateInputMode === 'manual'
                    ? 'bg-[#1f4a37] text-[#f4ecd8] shadow-md'
                    : 'text-[#1d3b2e] hover:bg-[#e4d3ad]'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Input Manual ({templateSoal.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setTemplateInputMode('tempel_ai')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  templateInputMode === 'tempel_ai'
                    ? 'bg-[#1f4a37] text-[#f4ecd8] shadow-md'
                    : 'text-[#1d3b2e] hover:bg-[#e4d3ad]'
                }`}
              >
                <span>Tempel Teks (AI)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAiError(null);
                  setAiSuksesPesan(null);
                  setModalAiAdminOpen(true);
                }}
                className="portal-btn yellow sm"
              >
                <span>AI Otomatis</span>
              </button>
              {templateInputMode === 'manual' && (
                <button
                  type="button"
                  onClick={handleTambahSoalAdmin}
                  className="portal-btn sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Soal</span>
                </button>
              )}
            </div>
          </div>

          {/* Notifikasi Impor Sukses / Gagal */}
          {templateSuksesTempel && (
            <div className="portal-banner success">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1f4a37]" />
              <span className="text-xs font-bold text-[#1d3b2e]">{templateSuksesTempel}</span>
              <button
                type="button"
                onClick={() => setTemplateSuksesTempel(null)}
                className="ml-auto text-xs underline text-[#1f4a37] cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {templateErrorTempel && (
            <div className="portal-banner error">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#c8362f]" />
              <span className="text-xs font-bold text-[#c8362f]">{templateErrorTempel}</span>
            </div>
          )}

          {/* TAB 1: TEMPEL TEKS DARI AI */}
          {templateInputMode === 'tempel_ai' && (
            <div className="space-y-4 pt-1">
              {/* Kotak Prompt Siap Salin */}
              <div className="p-4 rounded-2xl bg-[#efe4ce] border border-[#d8c5a0] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1d3b2e] uppercase tracking-wider">
                    Belum punya soal? Salin prompt ini untuk AI
                  </span>
                  <button
                    type="button"
                    onClick={handleSalinPromptAdmin}
                    className="portal-btn sm"
                  >
                    {templatePromptCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Prompt</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-[11px] leading-relaxed font-mono bg-[#fdfbf7] p-3 rounded-xl border border-[#e2d5bc] text-[#334155] whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {PROMPT_TEMPLATE}
                </pre>
                <p className="text-[11px] text-[#6b7d6c] italic">
                  Tips: Ganti <strong>[jumlah]</strong> dan <strong>[topik]</strong> sebelum dikirimkan ke ChatGPT / Claude / DeepSeek.
                </p>
              </div>

              {/* Area Paste */}
              <div>
                <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1.5">
                  Tempelkan Teks Hasil Generate AI (ChatGPT / Claude)
                </label>
                <textarea
                  rows={8}
                  className="portal-input font-mono text-xs leading-relaxed"
                  placeholder="Tempelkan hasil generate kuis di sini... Contoh:&#10;1. Apa ibu kota Indonesia?&#10;A. Bandung&#10;B. Jakarta&#10;C. Surabaya&#10;Jawaban: B&#10;Pembahasan: Jakarta adalah ibu kota Indonesia."
                  value={templateTeksAi}
                  onChange={(e) => setTemplateTeksAi(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end pt-1">
                <button
                  type="button"
                  onClick={handleKonversiTeksAiAdmin}
                  className="portal-btn red sm"
                  disabled={!templateTeksAi.trim()}
                >
                  <span>Konversi & Masukkan ke Soal</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: INPUT MANUAL (KARTU SOAL LENGKAP) */}
          {templateInputMode === 'manual' && (
            <div className="space-y-4 pt-1">
              {templateSoal.map((soal, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-[#fffdf6] border-2 border-[#e0d5b8] space-y-3.5 relative shadow-sm"
                >
                  <div className="flex items-center justify-between border-b-2 border-dashed border-[#e0d5b8] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="portal-cv text-xl text-[#c8362f]">Soal #{idx + 1}</span>
                      {soal.dibuatAi && (
                        <span className="portal-tag yellow">
                          Dibuat AI
                        </span>
                      )}
                    </div>
                    {templateSoal.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleHapusSoalAdmin(idx)}
                        className="portal-btn ghost-red sm"
                        title="Hapus Soal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#6b7d6c] uppercase tracking-wider mb-1">
                      Teks Pertanyaan Kuis
                    </label>
                    <textarea
                      rows={2}
                      required
                      placeholder={`Tuliskan pertanyaan soal nomor ${idx + 1}...`}
                      value={soal.teks}
                      onChange={(e) => handleUpdateSoalAdmin(idx, 'teks', e.target.value)}
                      className="portal-input font-medium"
                    />
                  </div>

                  {/* 3 Opsi Jawaban */}
                  <div className="space-y-2.5 pt-1">
                    <label className="block text-xs font-bold text-[#6b7d6c] uppercase tracking-wider">
                      Pilihan Jawaban & Kunci Benar (Klik Huruf untuk Menjadikan Kunci)
                    </label>

                    {(['A', 'B', 'C'] as const).map((opsiKey) => {
                      const fieldKey = `opsi${opsiKey}` as keyof AdminQuestionItem;
                      const isSelected = soal.jawabanBenar === opsiKey;

                      return (
                        <div key={opsiKey} className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleUpdateSoalAdmin(idx, 'jawabanBenar', opsiKey)}
                            className={`w-9 h-9 rounded-xl font-extrabold flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#1f4a37] text-[#f4ecd8] shadow-md ring-2 ring-[#f2c230]'
                                : 'bg-[#f4ecd9] text-[#1d3b2e] hover:bg-[#e0d5b8]'
                            }`}
                            title={`Jadikan Opsi ${opsiKey} sebagai Kunci Jawaban`}
                          >
                            {opsiKey}
                          </button>
                          <input
                            type="text"
                            required
                            placeholder={`Jawaban untuk Pilihan ${opsiKey}...`}
                            value={(soal[fieldKey] as string) || ''}
                            onChange={(e) => handleUpdateSoalAdmin(idx, fieldKey, e.target.value)}
                            className="portal-input flex-1"
                          />
                          {isSelected && (
                            <span className="portal-tag green shrink-0">
                              ✓ Kunci Benar
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#6b7d6c] uppercase tracking-wider mb-1">
                      Penjelasan Pembahasan (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Pembahasan singkat mengapa jawaban ini benar..."
                      value={soal.penjelasan || ''}
                      onChange={(e) => handleUpdateSoalAdmin(idx, 'penjelasan', e.target.value)}
                      className="portal-input"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
            <button
              type="button"
              className="portal-btn ghost sm"
              onClick={() => setModalTemplateOpen(false)}
              disabled={submittingTemplate}
            >
              Batal
            </button>
            <button
              type="submit"
              className="portal-btn red sm"
              disabled={submittingTemplate}
            >
              {submittingTemplate ? 'Menyimpan...' : 'Simpan Template Resmi'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* SUBMODAL BUAT SOAL OTOMATIS DENGAN AI (ADMIN) */}
      {/* ========================================================= */}
      <Modal
        isOpen={modalAiAdminOpen}
        onClose={() => !aiLoading && setModalAiAdminOpen(false)}
        title="Buat Soal Otomatis dengan AI"
        maxWidth="lg"
      >
        <div className="space-y-4">
          {aiError && (
            <div className="portal-banner error">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#c8362f]" />
              <span className="text-xs font-bold text-[#c8362f]">{aiError}</span>
            </div>
          )}

          {aiSuksesPesan && (
            <div className="portal-banner success">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1f4a37]" />
              <span className="text-xs font-bold text-[#1d3b2e]">{aiSuksesPesan}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1.5">
              Teks Rangkuman Materi Pembelajaran
            </label>
            <textarea
              rows={5}
              disabled={aiLoading}
              className="portal-input text-xs leading-relaxed"
              placeholder="Tempelkan ringkasan materi pembelajaran atau bab konsep di sini (minimal 20 karakter)..."
              value={aiMateri}
              onChange={(e) => setAiMateri(e.target.value)}
            />
            <span className="text-[11px] text-[#6b7d6c] mt-1 block">
              {aiMateri.length} karakter (minimal 20 karakter)
            </span>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-bold text-[#1d3b2e] uppercase tracking-wider mb-1">
              Jumlah Soal
            </label>
            <select
              disabled={aiLoading}
              value={aiJumlah}
              onChange={(e) => setAiJumlah(parseInt(e.target.value, 10))}
              className="portal-select"
            >
              <option value={5}>5 Soal (Rekomendasi Cepat)</option>
              <option value={8}>8 Soal</option>
              <option value={10}>10 Soal (Lomba Standar)</option>
              <option value={15}>15 Soal (Maksimal)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
            <button
              type="button"
              className="portal-btn ghost sm"
              onClick={() => setModalAiAdminOpen(false)}
              disabled={aiLoading}
            >
              Batal
            </button>
            <button
              type="button"
              className="portal-btn red sm"
              onClick={handleGenerateAiAdmin}
              disabled={aiLoading || aiMateri.trim().length < 20}
            >
              <span>{aiLoading ? 'Menyusun Soal...' : 'Buat Soal Sekarang'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL HAPUS TEMPLATE RESMI */}
      {/* ========================================================= */}
      <Modal
        isOpen={modalHapusTemplateOpen}
        onClose={() => setModalHapusTemplateOpen(false)}
        title="Hapus Template Resmi"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#1d3b2e]">
            Apakah Anda yakin ingin menghapus template resmi{' '}
            <strong>"{targetHapusTemplate?.judul}"</strong> dari pustaka platform?
          </p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
            <button
              type="button"
              className="portal-btn ghost sm"
              onClick={() => setModalHapusTemplateOpen(false)}
              disabled={submittingTemplate}
            >
              Batal
            </button>
            <button
              type="button"
              className="portal-btn red sm"
              onClick={handleHapusTemplateResmi}
              disabled={submittingTemplate}
            >
              Ya, Hapus
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Keluar Akun Admin */}
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
