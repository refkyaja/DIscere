import { PesertaItem, getAvatarColor } from './ShareModal';

export interface TopRightBarProps {
  canUndo: boolean;
  canRedo: boolean;
  pesertaList?: PesertaItem[];
  hanyaLihat?: boolean;
  isGameOpen?: boolean;
  isToolsOpen?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPresentation: () => void;
  onOpenShare?: () => void;
  onOpenGame?: () => void;
  onOpenTools?: () => void;
}

export function TopRightBar({
  canUndo,
  canRedo,
  pesertaList = [],
  hanyaLihat = false,
  isGameOpen = false,
  isToolsOpen = false,
  onUndo,
  onRedo,
  onPresentation,
  onOpenShare,
  onOpenGame,
  onOpenTools,
}: TopRightBarProps) {
  const totalPeserta = Math.max(1, pesertaList.length);

  return (
    <div className="pn top-right-bar">
      {!hanyaLihat && (
        <>
          <button
            className="ib"
            type="button"
            title="Urungkan (Ctrl+Z)"
            aria-label="Urungkan"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <svg viewBox="0 0 24 24">
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
            </svg>
          </button>

          <button
            className="ib"
            type="button"
            title="Ulangi (Ctrl+Y)"
            aria-label="Ulangi"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <svg viewBox="0 0 24 24">
              <path d="M15 14l5-5-5-5" />
              <path d="M20 9H10a6 6 0 0 0 0 12h3" />
            </svg>
          </button>
        </>
      )}

      {/* Tombol Template Game */}
      {!hanyaLihat && (
        <button
          className={`ib ${isGameOpen ? 'active' : ''}`}
          id="gm"
          title="Template Game (Kuis Kelas)"
          aria-label="Buka Template Game"
          aria-expanded={isGameOpen}
          onClick={onOpenGame}
        >
          <svg viewBox="0 0 24 24">
            <rect x="2" y="6" width="20" height="12" rx="4" />
            <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
          </svg>
        </button>
      )}

      {/* Tombol Alat Kelas (Timer, Acak Nama, Poling, Skor) */}
      {!hanyaLihat && onOpenTools && (
        <button
          className={`ib ${isToolsOpen ? 'active' : ''}`}
          id="kl"
          title="Alat Kelas (Timer, Acak Nama, Poling, Skor)"
          aria-label="Buka Alat Kelas"
          onClick={onOpenTools}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2 2M5 3L2 6M22 6l-3-3M10 2h4" />
          </svg>
        </button>
      )}

      {/* Kolaborator / Akun */}
      <div
        id="av"
        title="Kolaborator yang sedang membuka"
        onClick={onOpenShare}
        style={{ cursor: onOpenShare ? 'pointer' : 'default' }}
      >
        <span id="avs" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {pesertaList.length > 0 ? (
            pesertaList.slice(0, 3).map((p) => {
              const bg = getAvatarColor(p.id || p.nama);
              const init = (p.nama || '?').charAt(0).toUpperCase();
              return (
                <span
                  key={p.id}
                  style={{
                    display: 'inline-grid',
                    placeItems: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: bg,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    marginLeft: -4,
                  }}
                  title={`${p.nama} (${p.peran === 'editor' ? 'Editor' : 'Viewer'})`}
                >
                  {init}
                </span>
              );
            })
          ) : (
            <span className="me">G</span>
          )}
        </span>
        <b id="cn" style={{ fontSize: 13, marginLeft: 4 }}>
          {totalPeserta}
        </b>
      </div>

      {/* Mode Presentasi */}
      <button
        className="ib"
        title="Mode presentasi"
        aria-label="Mode presentasi"
        onClick={onPresentation}
      >
        <svg viewBox="0 0 24 24" style={{ fill: 'currentColor' }}>
          <path d="M7 5l12 7-12 7z" />
        </svg>
      </button>

      {/* Tombol Share */}
      {onOpenShare && (
        <button
          id="share"
          className="share-btn"
          title="Bagikan papan"
          aria-label="Bagikan papan"
          onClick={onOpenShare}
        >
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
          </svg>
          <span>Share</span>
        </button>
      )}
    </div>
  );
}
