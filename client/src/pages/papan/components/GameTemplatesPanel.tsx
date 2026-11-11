import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { apiRequest } from '../../../lib/api';
import {
  GameTemplateItem,
  MOCK_TEMPLATES_SAYA,
  MOCK_TEMPLATES_PUSTAKA,
  USE_MOCK_TEMPLATE_FALLBACK,
} from '../mock-template';
import { ClassToolsView } from './ClassToolsView';

export interface GameTemplatesPanelProps {
  isOpen: boolean;
  boardId: string;
  initialCategory?: 'game' | 'alat';
  onClose: () => void;
  onBeforeStartGame: () => Promise<void>;
  onPasteLastGameResult?: () => void;
  onPasteToBoard?: (text: string) => void;
  getBoardPng?: () => string | null;
  onToast: (msg: string) => void;
  timerSeconds?: number;
  timerTotal?: number;
  isTimerRunning?: boolean;
  onStartTimer?: () => void;
  onPauseTimer?: () => void;
  onResetTimer?: () => void;
  onChangeTimerTotal?: (sec: number) => void;
}

// Ikon Game SVG murni (bukan emoji)
function GameIcon({ game }: { game: string }) {
  if (game === 'balap_karung') {
    return (
      <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: '#eab308' }}>
        <path d="M8 10h8l1 10H7l1-10Z" />
        <circle cx="12" cy="6" r="2.5" />
        <path d="M9 10c1-1.5 5-1.5 6 0" />
      </svg>
    );
  }
  if (game === 'panjat_pinang') {
    return (
      <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: '#10b981' }}>
        <path d="M12 21V3" />
        <path d="M12 3l6 3-6 3" />
        <circle cx="9" cy="14" r="2" />
        <path d="M7 19l5-3 5 3" />
      </svg>
    );
  }
  if (game === 'makan_kerupuk') {
    return (
      <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: '#f59e0b' }}>
        <circle cx="12" cy="12" r="8" strokeDasharray="4 2" />
        <path d="M12 4v-2M10 2h4" />
        <path d="M9 11c1-1 3-1 4 0M10 15c.5.5 1.5.5 2 0" />
      </svg>
    );
  }
  // Default: Tarik Tambang
  return (
    <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: '#ef4444' }}>
      <path d="M4 14l4-4 4 4 4-4 4 4" />
      <path d="M12 3v7" />
      <path d="M9 7l3 3 3-3" />
      <circle cx="6" cy="17" r="2" />
      <circle cx="18" cy="17" r="2" />
    </svg>
  );
}

export function GameTemplatesPanel({
  isOpen,
  boardId,
  initialCategory = 'game',
  onClose,
  onBeforeStartGame,
  onPasteLastGameResult: _onPasteLastGameResult,
  onPasteToBoard,
  getBoardPng: _getBoardPng = () => null,
  onToast,
  timerSeconds = 300,
  timerTotal = 300,
  isTimerRunning = false,
  onStartTimer = () => {},
  onPauseTimer = () => {},
  onResetTimer = () => {},
  onChangeTimerTotal = () => {},
}: GameTemplatesPanelProps) {
  const navigate = useNavigate();
  const [category, setCategory] = useState<'game' | 'alat'>('game');
  const [activeTab, setActiveTab] = useState<'saya' | 'pustaka'>('saya');

  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory);
    }
  }, [isOpen, initialCategory]);
  const [searchQuery, setSearchQuery] = useState('');
  const [templatesSaya, setTemplatesSaya] = useState<GameTemplateItem[]>([]);
  const [templatesPustaka, setTemplatesPustaka] = useState<GameTemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  // Ambil daftar template dari server saat panel dibuka
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        // 1. Template Saya
        const resSaya = await apiRequest<{ templates: any[] }>('/template');
        if (mounted && resSaya && Array.isArray(resSaya.templates)) {
          setTemplatesSaya(
            resSaya.templates.map((t) => ({
              id: t.id,
              judul: t.judul,
              game: t.game || 'tarik_tambang',
              mode: t.mode === 'multi' ? 'multi' : 'solo',
              questionsCount: t._count?.questions ?? (t.questions?.length || 0),
            }))
          );
        }
      } catch {
        if (USE_MOCK_TEMPLATE_FALLBACK && mounted) {
          setTemplatesSaya(MOCK_TEMPLATES_SAYA);
        }
      }

      try {
        // 2. Pustaka Resmi Admin
        const resPustaka = await apiRequest<{ templates: any[] }>('/template/pustaka');
        if (mounted && resPustaka && Array.isArray(resPustaka.templates)) {
          setTemplatesPustaka(
            resPustaka.templates.map((t) => ({
              id: t.id,
              judul: t.judul,
              game: t.game || 'tarik_tambang',
              mode: t.mode === 'multi' ? 'multi' : 'solo',
              questionsCount: t._count?.questions ?? (t.questions?.length || 0),
            }))
          );
        }
      } catch {
        if (USE_MOCK_TEMPLATE_FALLBACK && mounted) {
          setTemplatesPustaka(MOCK_TEMPLATES_PUSTAKA);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchTemplates();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const activeList = activeTab === 'saya' ? templatesSaya : templatesPustaka;
  const filteredList = activeList.filter((item) =>
    item.judul.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handler Tombol Main: Simpan Papan -> Buka halaman pengaturan seragam (/guru/<game>)
  const handleStartGame = async (template: GameTemplateItem) => {
    if (startingId) return;
    setStartingId(template.id);
    onToast('Menyiapkan pengaturan permainan…');

    try {
      // 1. Flush simpan otomatis kanvas terlebih dahulu
      await onBeforeStartGame();

      // 2. Arahkan seluruh 4 game ke halaman pemilihan mode & konfigurasi seragam
      const gameSlugMap: Record<string, string> = {
        makan_kerupuk: '/guru/makan-kerupuk',
        balap_karung: '/guru/balap-karung',
        panjat_pinang: '/guru/panjat-pinang',
        tarik_tambang: '/guru/tarik-tambang',
      };
      const targetPath = gameSlugMap[template.game || 'tarik_tambang'];
      if (targetPath) {
        onClose();
        navigate(
          `${targetPath}?templateId=${encodeURIComponent(template.id)}&kembali=${encodeURIComponent(`/papan/${boardId}`)}`
        );
        return;
      }

      // Fallback bila tipe game kustom di masa depan
      const res = await apiRequest<{ session: { id: string } }>('/sesi', {
        method: 'POST',
        body: JSON.stringify({
          templateId: template.id,
          mode: template.mode,
          playMode: template.mode === 'multi' ? 'MULTIPLAYER' : 'SOLO',
          game: template.game,
        }),
      });

      const sessionId = res?.session?.id;
      if (sessionId) {
        onToast('Sesi game berhasil dimulai!');
        navigate(`/guru/sesi/${sessionId}?kembali=/papan/${boardId}`);
      } else {
        throw new Error('Sesi gagal dibuat.');
      }
    } catch (err: any) {
      // Jika mode mock atau offline dan API sesi 404, navigasikan dengan fallback ramah
      if (USE_MOCK_TEMPLATE_FALLBACK && (err.status === 404 || err.message?.includes('404'))) {
        const mockSesiId = 'sesi-demo-' + Date.now();
        onToast('(Mode Simulasi) Berpindah ke arena game…');
        navigate(`/guru/sesi/${mockSesiId}?kembali=/papan/${boardId}`);
      } else {
        onToast(`Gagal memulai sesi: ${err.message || 'Terjadi kesalahan'}`);
      }
    } finally {
      setStartingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <>
    <aside
      id="qz"
      className={`pn game-template-panel ${isOpen ? 'open' : ''}`}
      aria-label="Template Game Interaktif"
      role="complementary"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {/* Header Panel Terpadu: Switcher Game vs Alat Kelas */}
      <div className="qth" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--ln)' }}>
        <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.2)', padding: 3, borderRadius: 10 }}>
          <button
            type="button"
            onClick={() => setCategory('game')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: category === 'game' ? 'var(--pu)' : 'transparent',
              color: category === 'game' ? '#fff' : '#94a3b8',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="6" width="20" height="12" rx="4" />
              <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
            </svg>
            <span>Game & Kuis</span>
          </button>

          <button
            type="button"
            onClick={() => setCategory('alat')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: category === 'alat' ? 'var(--pu)' : 'transparent',
              color: category === 'alat' ? '#fff' : '#94a3b8',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2 2M5 3L2 6M22 6l-3-3M10 2h4" />
            </svg>
            <span>Alat Kelas</span>
          </button>
        </div>

        <button
          className="ib"
          id="qzx"
          aria-label="Tutup Panel (Esc)"
          title="Tutup Panel (Esc)"
          onClick={onClose}
          style={{ width: 30, height: 30 }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 15, height: 15 }}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {category === 'alat' ? (
        <ClassToolsView
          onPasteToBoard={onPasteToBoard || (() => {})}
          onToast={onToast}
          timerSeconds={timerSeconds}
          timerTotal={timerTotal}
          isTimerRunning={isTimerRunning}
          onStartTimer={onStartTimer}
          onPauseTimer={onPauseTimer}
          onResetTimer={onResetTimer}
          onChangeTimerTotal={onChangeTimerTotal}
        />
      ) : (
        <div
          id="qzb"
          className="game-template-list"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '10px 14px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Navigasi Tab Game */}
          <div className="game-tabs" role="tablist" aria-label="Kategori Template">
            <button
              role="tab"
              aria-selected={activeTab === 'saya'}
              className={`game-tab-btn ${activeTab === 'saya' ? 'active' : ''}`}
              onClick={() => setActiveTab('saya')}
            >
              <span>Template Saya</span>
              <span className="game-tab-badge">{templatesSaya.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'pustaka'}
              className={`game-tab-btn ${activeTab === 'pustaka' ? 'active' : ''}`}
              onClick={() => setActiveTab('pustaka')}
            >
              <span>Pustaka Resmi</span>
              <span className="game-tab-badge">{templatesPustaka.length}</span>
            </button>
          </div>

      {/* Input Pencarian */}
      <div className="game-search-box">
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'var(--mu)' }}>
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="search"
          placeholder="Cari materi atau kuis…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Cari template game"
        />
        {searchQuery && (
          <button
            type="button"
            className="ib"
            aria-label="Hapus pencarian"
            onClick={() => setSearchQuery('')}
            style={{ width: 20, height: 20 }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 12, height: 12 }}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Konten Daftar Kartu Template */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--mu)' }}>
            <span>Memuat template…</span>
          </div>
        )}

        {!loading && filteredList.length === 0 && (
          <div className="game-empty-state">
            <svg
              viewBox="0 0 24 24"
              style={{ width: 44, height: 44, stroke: 'var(--mu)', margin: '0 auto 12px' }}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 12h6M12 9v6" />
            </svg>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>
              {searchQuery ? 'Tidak ada template yang cocok.' : 'Belum ada template kuis.'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--mu)', marginBottom: 16 }}>
              {activeTab === 'saya'
                ? 'Buat template soal baru untuk dimainkan bersama siswa di kelas.'
                : 'Pustaka resmi akan segera diperbarui dengan template materi kurikulum.'}
            </p>
            {activeTab === 'saya' && (
              <a
                href="/guru/template/baru"
                className="game-create-btn"
                target="_blank"
                rel="noreferrer"
              >
                + Buat Template Baru
              </a>
            )}
          </div>
        )}

        {!loading &&
          filteredList.map((item) => (
            <div key={item.id} className="qc" role="article" aria-label={item.judul}>
              <i
                title={
                  item.game === 'makan_kerupuk'
                    ? 'Makan Kerupuk'
                    : item.game === 'panjat_pinang'
                    ? 'Panjat Pinang'
                    : item.game === 'balap_karung'
                    ? 'Balap Karung'
                    : 'Tarik Tambang'
                }
              >
                <GameIcon game={item.game} />
              </i>
              <div className="qc-info">
                <b title={item.judul} className="break-words [overflow-wrap:anywhere] [word-break:break-word]">{item.judul}</b>
                <small>
                  {item.questionsCount} soal ·{' '}
                  <span
                    style={{
                      textTransform: 'capitalize',
                      color:
                        item.game === 'makan_kerupuk' ||
                        item.game === 'balap_karung' ||
                        item.game === 'tarik_tambang'
                          ? '#f59e0b'
                          : '#60a5fa',
                    }}
                  >
                    {item.game === 'makan_kerupuk' ||
                    item.game === 'balap_karung' ||
                    item.game === 'tarik_tambang'
                      ? 'Multi / Solo'
                      : 'Multiplayer'}
                  </span>
                </small>
              </div>
              <button
                type="button"
                className="qc-play-btn"
                disabled={startingId === item.id}
                onClick={() => handleStartGame(item)}
                aria-label={`Mulai mainkan template ${item.judul}`}
              >
                {startingId === item.id ? 'Memuat…' : 'Main'}
              </button>
            </div>
          ))}
        </div>
      </div>
      )}
    </aside>
    </>
  );
}
