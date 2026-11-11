import React, { useEffect, useRef } from 'react';
import { PesanObrolan, LampiranObrolan, renderMarkdownSafe } from '../lib/obrol';

interface ChatPanelProps {
  isOpen: boolean;
  pesan: PesanObrolan[];
  lampiran: LampiranObrolan[];
  busy: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onCancelBusy: () => void;
  onRemoveAttachment: (id: string) => void;
  onAddToBoard: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  pesan,
  lampiran,
  busy,
  onClose,
  onNewChat,
  onCancelBusy,
  onRemoveAttachment,
  onAddToBoard,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll ke pesan terbaru
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pesan, busy, isOpen]);

  // Listener tombol Escape untuk menutup panel chat
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen && lampiran.length === 0) {
    return null;
  }

  return (
    <div id="cw" className="chat-wrapper" role="region" aria-label="Percakapan Asisten AI">
      {/* Panel Obrolan (#chat) */}
      {isOpen && (
        <div id="chat" className="chat-panel">
          {/* Header Chat */}
          <div className="ch chat-header">
            <span className="chat-header-title">
              <strong>Asisten AI</strong>
              <span className="ai-badge-header">Dibuat AI</span>
            </span>

            <div className="chat-header-actions">
              <button
                type="button"
                className="ib chat-action-btn"
                id="cc"
                title="Mulai obrolan baru (hapus riwayat)"
                aria-label="Obrolan baru"
                onClick={onNewChat}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className="ib chat-action-btn"
                id="cx"
                title="Sembunyikan panel obrolan (Esc)"
                aria-label="Sembunyikan obrolan"
                onClick={onClose}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
                  <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="chat-privacy-notice">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" />
              <line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" />
            </svg>
            <span>Privasi terjaga: Jangan kirim data pribadi siswa. Riwayat hanya hidup di memori browser.</span>
          </div>

          {/* Area Pesan (#cm) */}
          <div id="cm" className="chat-messages" role="log" aria-live="polite">
            {pesan.length === 0 && !busy && (
              <div className="chat-empty-state">
                <p>Belum ada pesan. Ketik pertanyaan di bar bawah atau lampirkan materi/papan saat ini.</p>
              </div>
            )}

            {pesan.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`m ${isUser ? 'u' : 'a'} ${msg.isError ? 'err' : ''}`}
                  tabIndex={0}
                >
                  <div className="message-content">
                    {isUser ? (
                      <div className="user-text">{msg.teks}</div>
                    ) : (
                      <div className="ai-text">{renderMarkdownSafe(msg.teks)}</div>
                    )}
                  </div>

                  {/* Informasi lampiran di pesan pengguna */}
                  {isUser && msg.fileNames && msg.fileNames.length > 0 && (
                    <small className="msg-attachment-info">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                      <span>{msg.fileNames.join(', ')}</span>
                    </small>
                  )}

                  {/* Tombol "＋ Tambah ke papan" pada pesan AI */}
                  {!isUser && !msg.isError && (
                    <button
                      type="button"
                      className="tl add-to-board-btn"
                      title="Tambahkan catatan ini ke tengah kanvas"
                      aria-label="Tambahkan balasan AI ke papan"
                      onClick={() => onAddToBoard(msg.teks)}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                      <span>Tambah ke papan</span>
                    </button>
                  )}
                </div>
              );
            })}

            {/* Bubble "Sedang berpikir…" saat AI sedang memproses */}
            {busy && (
              <div className="m a thinking-bubble" tabIndex={0} aria-live="assertive">
                <div className="thinking-content">
                  <div className="thinking-spinner" />
                  <span>Sedang berpikir…</span>
                  <button
                    type="button"
                    className="cancel-inline-btn"
                    onClick={onCancelBusy}
                    title="Batalkan permintaan"
                  >
                    Batalkan
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Area Lampiran Aktif Sebelum Dikirim (#att) */}
      {lampiran.length > 0 && (
        <div id="att" className="attachment-tray" role="region" aria-label="Daftar lampiran aktif">
          {lampiran.map((lamp) => (
            <div key={lamp.id} className="ac attachment-chip">
              {lamp.thumb ? (
                <img src={lamp.thumb} alt={lamp.nama} className="attachment-thumb" />
              ) : lamp.jenis === 'pdf' ? (
                <div className="attachment-icon pdf">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
              ) : (
                <div className="attachment-icon text">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="16" y2="6" strokeLinecap="round" />
                    <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
                    <line x1="8" y1="18" x2="12" y2="18" strokeLinecap="round" />
                  </svg>
                </div>
              )}

              <span className="attachment-name" title={lamp.nama}>
                {lamp.nama}
              </span>

              <button
                type="button"
                className="ib attachment-rm-btn"
                title={`Hapus lampiran ${lamp.nama}`}
                aria-label={`Hapus lampiran ${lamp.nama}`}
                onClick={() => onRemoveAttachment(lamp.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

