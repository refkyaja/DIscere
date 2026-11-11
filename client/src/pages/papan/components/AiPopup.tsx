import React, { useState, useEffect, useRef } from 'react';
import { Pt, Bounds, BoardView } from '../engine/types';

export interface AiPopupProps {
  isOpen: boolean;
  lasso: Pt[] | null;
  view: BoardView;
  loading: boolean;
  responseResult: {
    jawaban: string;
    rumus?: string;
    langkah: string;
  } | null;
  errorMessage: string | null;
  onAsk: (pertanyaan: string) => void;
  onClose: () => void;
}

export function computeLassoBounds(pts: Pt[]): Bounds {
  let minX = 1e9,
    minY = 1e9,
    maxX = -1e9,
    maxY = -1e9;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x: minX,
    y: minY,
    w: Math.max(10, maxX - minX),
    h: Math.max(10, maxY - minY),
  };
}

export function wrapText(text: string, maxLen = 38): string {
  const words = String(text ?? '')
    .replace(/\*\*|`/g, '')
    .split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxLen && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.join('\n');
}

export function formatAiResponseForCanvas(res: {
  jawaban: string;
  rumus?: string;
  langkah: string;
}): string {
  const parts: string[] = [];
  if (res.jawaban) {
    parts.push(`Jawaban:\n${wrapText(res.jawaban, 38)}`);
  }
  if (res.rumus && res.rumus !== '-' && res.rumus.trim()) {
    parts.push(`Rumus:\n${wrapText(res.rumus, 38)}`);
  }
  if (res.langkah && res.langkah !== '-' && res.langkah.trim()) {
    parts.push(`Langkah:\n${wrapText(res.langkah, 38)}`);
  }
  return parts.join('\n\n');
}

export function AiPopup({
  isOpen,
  lasso,
  view,
  loading,
  responseResult,
  errorMessage,
  onAsk,
  onClose,
}: AiPopupProps) {
  const [pertanyaan, setPertanyaan] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hitung posisi popup di dekat area lasso agar tidak keluar viewport
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initPosX: number; initPosY: number }>({
    startX: 0,
    startY: 0,
    initPosX: 0,
    initPosY: 0,
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Jangan drag jika yang diklik adalah tombol (misal tombol close)
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPosX: pos.x,
      initPosY: pos.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 700;

    const newX = Math.max(10, Math.min(dragStartRef.current.initPosX + dx, winW - 320));
    const newY = Math.max(10, Math.min(dragStartRef.current.initPosY + dy, winH - 120));
    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  useEffect(() => {
    if (!isOpen || !lasso || lasso.length < 8) return;

    setPertanyaan('');
    const b = computeLassoBounds(lasso);
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 700;
    const popupW = 420;
    const popupH = 280;

    let targetX = (b.x + b.w) * view.z + view.x + 16;
    if (targetX + popupW > winW - 16) {
      targetX = Math.max(16, b.x * view.z + view.x - popupW - 16);
    }

    let targetY = b.y * view.z + view.y;
    targetY = Math.max(90, Math.min(targetY, winH - popupH - 20));

    setPos({ x: targetX, y: targetY });

    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [isOpen, lasso, view]);

  if (!isOpen || !lasso) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    onAsk(pertanyaan.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      id="ai"
      ref={popupRef}
      className="ai-popup"
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Tanya AI Soal Ini"
    >
      {/* Header Popup (Bisa Ditarik / Draggable) */}
      <div
        className="ah"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
        title="Klik dan seret untuk memindahkan jendela"
      >
        <span className="at">
          Tanya AI Soal Ini
        </span>
        <span className="bd">Dibuat AI</span>
        <button
          className="ib"
          id="aix"
          aria-label="Tutup"
          onClick={onClose}
          style={{ width: 28, height: 28, fontSize: 16 }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <label className="al" htmlFor="aiq">
          Butuh apa? (Opsional)
        </label>
        <input
          id="aiq"
          ref={inputRef}
          value={pertanyaan}
          disabled={loading}
          maxLength={500}
          placeholder="Misal: Jelaskan rumus dan langkah..."
          onChange={(e) => setPertanyaan(e.target.value)}
        />

        {/* Status Loading */}
        {loading && (
          <div id="aia" className="ai-response-area" style={{ textAlign: 'center', padding: '16px 0' }}>
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>Sedang berpikir…</span>
          </div>
        )}

        {/* Pesan Error (Batas harian, kunci belum disetel, AI gagal) */}
        {!loading && errorMessage && (
          <div className="ai-error" role="alert">
            {errorMessage}
          </div>
        )}

        {/* Tampilan Hasil Jawaban di Popup */}
        {!loading && responseResult && (
          <div id="aia" className="ai-response-area">
            <b style={{ color: '#f59e0b', display: 'block', marginBottom: 4 }}>
              Jawaban:
            </b>
            <div style={{ marginBottom: 8 }}>{responseResult.jawaban}</div>

            {responseResult.rumus && responseResult.rumus !== '-' && (
              <>
                <b style={{ color: '#f59e0b', display: 'block', marginBottom: 4 }}>
                  Rumus:
                </b>
                <div style={{ marginBottom: 8 }}>{responseResult.rumus}</div>
              </>
            )}

            {responseResult.langkah && responseResult.langkah !== '-' && (
              <>
                <b style={{ color: '#f59e0b', display: 'block', marginBottom: 4 }}>
                  Langkah:
                </b>
                <div>{responseResult.langkah}</div>
              </>
            )}
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="ab">
          <button type="button" id="aic" className="ai-cancel-btn" onClick={onClose}>
            {responseResult ? 'Selesai' : 'Batal'}
          </button>
          {!responseResult && (
            <button
              type="submit"
              id="aig"
              className="ai-submit-btn"
              disabled={loading}
            >
              <span>{loading ? 'Memproses…' : 'Dapatkan Jawaban'}</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

