import React from 'react';

export interface TopLeftBarProps {
  title: string;
  saveStatus: 'saved' | 'busy' | 'error';
  hanyaLihat?: boolean;
  isReconnecting?: boolean;
  onTitleChange?: (newTitle: string) => void;
  onOpenMenu?: (btnEl: HTMLElement) => void;
  onExportPng?: () => void;
}

export function TopLeftBar({
  title,
  saveStatus,
  hanyaLihat = false,
  isReconnecting = false,
  onTitleChange,
  onOpenMenu,
  onExportPng: _onExportPng,
}: TopLeftBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <header className="pn top-left-panel">
      {onOpenMenu && (
        <button
          id="mn"
          className="ib"
          title="Menu"
          aria-label="Menu"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu(e.currentTarget);
          }}
        >
          <svg viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <span className="logo">discere</span>

      <input
        className="board-title-input"
        value={title}
        maxLength={60}
        aria-label="Judul papan"
        readOnly={hanyaLihat || !onTitleChange}
        onChange={(e) => onTitleChange && onTitleChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Badge Mode Lihat jika peran Viewer */}
      {hanyaLihat && (
        <span className="viewer-badge" title="Mode Viewer: hanya melihat kanvas">
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor' }}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <b>Mode lihat</b>
        </span>
      )}

      {/* Badge Reconnecting saat koneksi socket terputus */}
      {isReconnecting ? (
        <span className="reconnect-badge">
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor' }}>
            <circle cx="12" cy="12" r="9" strokeDasharray="16" />
          </svg>
          <b>Menyambung ulang…</b>
        </span>
      ) : (
        !hanyaLihat && (
          <span className={`save-status-badge ${saveStatus === 'busy' ? 'busy' : saveStatus === 'error' ? 'error' : ''}`}>
            {saveStatus === 'busy' ? (
              <>
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeDasharray="16" />
                </svg>
                <b>Menyimpan…</b>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                <b>Gagal simpan</b>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <b>Saved</b>
              </>
            )}
          </span>
        )
      )}
    </header>
  );
}
