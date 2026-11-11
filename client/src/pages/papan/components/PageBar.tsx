import React, { useState } from 'react';

export interface PageBarProps {
  pageIndex: number;
  totalPages: number;
  isPresentation?: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  onDeletePage: () => void;
  onDuplicatePage?: () => void;
  onSelectPage?: (index: number) => void;
  onExitPresentation?: () => void;
}

export const PageBar: React.FC<PageBarProps> = ({
  pageIndex,
  totalPages,
  isPresentation = false,
  onPrevPage,
  onNextPage,
  onAddPage,
  onDeletePage,
  onDuplicatePage,
  onSelectPage,
  onExitPresentation,
}) => {
  const [showDrawer, setShowDrawer] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Jika sedang mode presentasi layar penuh, tampilkan kontrol presenter melayang di bawah
  if (isPresentation) {
    return (
      <div
        className="presentation-control-bar"
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(15, 20, 32, 0.92)',
          backdropFilter: 'blur(12px)',
          padding: '8px 16px',
          borderRadius: 20,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
          color: '#eef1fa',
        }}
      >
        <button
          onClick={onPrevPage}
          disabled={pageIndex === 0}
          title="Halaman Sebelumnya (← / PageUp)"
          style={{
            background: pageIndex === 0 ? 'transparent' : 'rgba(255,255,255,0.1)',
            border: 'none',
            color: pageIndex === 0 ? 'rgba(255,255,255,0.25)' : '#fff',
            borderRadius: 12,
            padding: '8px 14px',
            fontSize: 14,
            fontWeight: 700,
            cursor: pageIndex === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>Sebelumnya</span>
        </button>

        <span
          style={{
            fontWeight: 800,
            fontSize: 15,
            padding: '0 8px',
            letterSpacing: 0.5,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Slide {pageIndex + 1} / {totalPages}
        </span>

        <button
          onClick={onNextPage}
          disabled={pageIndex === totalPages - 1}
          title="Halaman Berikutnya (→ / PageDown / Spasi)"
          style={{
            background: pageIndex === totalPages - 1 ? 'transparent' : 'rgba(255,255,255,0.1)',
            border: 'none',
            color: pageIndex === totalPages - 1 ? 'rgba(255,255,255,0.25)' : '#fff',
            borderRadius: 12,
            padding: '8px 14px',
            fontSize: 14,
            fontWeight: 700,
            cursor: pageIndex === totalPages - 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>Berikutnya</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

        {onExitPresentation && (
          <button
            onClick={onExitPresentation}
            title="Keluar dari mode presentasi (Esc)"
            style={{
              background: '#ef4444',
              border: 'none',
              color: '#fff',
              borderRadius: 12,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Keluar (Esc)
          </button>
        )}
      </div>
    );
  }

  // Tampilan Standar di Kiri Bawah (Mirip #pgs)
  return (
    <>
      <div className="pn page-bar" id="pgs">
        {/* Tombol Halaman Sebelumnya */}
        <button
          className="ib"
          onClick={onPrevPage}
          disabled={pageIndex === 0}
          title="Halaman sebelumnya"
          aria-label="Halaman sebelumnya"
          style={{
            opacity: pageIndex === 0 ? 0.35 : 1,
            cursor: pageIndex === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Indikator Halaman (Bisa diklik untuk buka baki slide) */}
        <button
          onClick={() => setShowDrawer((prev) => !prev)}
          title="Klik untuk melihat semua halaman / slide"
          style={{
            background: showDrawer ? 'rgba(155, 23, 245, 0.25)' : 'transparent',
            border: 'none',
            color: '#eef1fa',
            fontWeight: 800,
            fontSize: 12,
            padding: '3px 8px',
            borderRadius: 8,
            cursor: 'pointer',
            fontVariantNumeric: 'tabular-nums',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <span>
            {pageIndex + 1} / {totalPages}
          </span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d={showDrawer ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </button>

        {/* Tombol Halaman Berikutnya */}
        <button
          className="ib"
          onClick={onNextPage}
          disabled={pageIndex === totalPages - 1}
          title="Halaman berikutnya"
          aria-label="Halaman berikutnya"
          style={{
            opacity: pageIndex === totalPages - 1 ? 0.35 : 1,
            cursor: pageIndex === totalPages - 1 ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)', margin: '0 1px' }} />

        {/* Tombol Tambah Halaman */}
        <button
          className="ib"
          onClick={onAddPage}
          title="Tambah halaman baru"
          aria-label="Tambah halaman"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        {/* Tombol Duplikat Halaman */}
        {onDuplicatePage && (
          <button
            className="ib"
            onClick={onDuplicatePage}
            title="Duplikat halaman ini"
            aria-label="Duplikat halaman"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        )}

        {/* Tombol Hapus Halaman */}
        <button
          className="ib"
          onClick={() => {
            if (totalPages <= 1) return;
            setShowConfirmDelete(true);
          }}
          disabled={totalPages <= 1}
          title={totalPages <= 1 ? 'Minimal harus ada 1 halaman' : 'Hapus halaman ini'}
          aria-label="Hapus halaman"
          style={{
            opacity: totalPages <= 1 ? 0.3 : 1,
            cursor: totalPages <= 1 ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      {/* Popover Baki Daftar Halaman / Slide */}
      {showDrawer && onSelectPage && (
        <div
          className="page-drawer"
          style={{
            position: 'fixed',
            bottom: 'var(--page-drawer-bottom, 84px)',
            left: 20,
            zIndex: 9,
            background: '#181e33',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 18,
            padding: 12,
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
            width: 240,
            maxHeight: 320,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
              padding: '0 4px',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: '#eef1fa' }}>Daftar Slide Papan</span>
            <button
              onClick={onAddPage}
              style={{
                background: '#9b17f5',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Slide Baru
            </button>
          </div>

          {Array.from({ length: totalPages }).map((_, i) => (
            <div
              key={i}
              onClick={() => {
                onSelectPage(i);
                setShowDrawer(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 10,
                background: i === pageIndex ? 'rgba(155, 23, 245, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                border: i === pageIndex ? '1px solid #9b17f5' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: i === pageIndex ? 800 : 600,
                  color: i === pageIndex ? '#c084fc' : '#eef1fa',
                }}
              >
                Halaman {i + 1}
              </span>
              {i === pageIndex && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: '#9b17f5',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: 6,
                  }}
                >
                  Aktif
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Konfirmasi Hapus Halaman */}
      {showConfirmDelete && (
        <div className="modal-backdrop" style={{ zIndex: 110 }}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <h3 className="modal-title">Hapus Halaman {pageIndex + 1}?</h3>
            <p className="modal-desc">
              Halaman {pageIndex + 1} beserta semua coretan dan objek di dalamnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setShowConfirmDelete(false)}>
                Batal
              </button>
              <button
                className="modal-btn-danger"
                onClick={() => {
                  setShowConfirmDelete(false);
                  onDeletePage();
                }}
              >
                Ya, Hapus Halaman
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default PageBar;

