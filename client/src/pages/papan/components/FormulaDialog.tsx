import React, { useState, useEffect, useRef } from 'react';
import { FormulaObj, Pt } from '../engine/types';
import { fmLay } from '../engine/formula';

export interface FormulaDialogProps {
  isOpen: boolean;
  obj: FormulaObj | null;
  pos: Pt | null;
  onClose: () => void;
  onSave: (tex: string, fs: number, existing?: FormulaObj) => void;
}

const FORMULA_SHORTCUTS: Array<[string, string]> = [
  ['a/b', '\\frac{a}{b}'],
  ['√x', '\\sqrt{x}'],
  ['x²', '^{2}'],
  ['xₙ', '_{n}'],
  ['π', '\\pi'],
  ['∑', '\\sum'],
  ['∫', '\\int'],
  ['×', '\\times'],
  ['÷', '\\div'],
  ['≤', '\\le'],
  ['≥', '\\ge'],
  ['≠', '\\ne'],
  ['≈', '\\approx'],
  ['∞', '\\infty'],
  ['α', '\\alpha'],
  ['β', '\\beta'],
  ['θ', '\\theta'],
  ['→', '\\to'],
];

export const FormulaDialog: React.FC<FormulaDialogProps> = ({
  isOpen,
  obj,
  onClose,
  onSave,
}) => {
  const [tex, setTex] = useState('');
  const [fontSize, setFontSize] = useState(32);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (obj) {
        setTex(obj.tex);
        setFontSize(obj.fs || 32);
      } else {
        setTex('\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
        setFontSize(32);
      }
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, obj]);

  // Live preview render
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!tex.trim()) return;

    try {
      const L = fmLay({ tex: tex.trim(), fs: Math.round(fontSize * 0.8) });
      ctx.fillStyle = '#111827';
      const drawX = Math.max(12, (canvas.width - L.w) / 2);
      const drawY = (canvas.height + L.u - L.d) / 2;
      L.dr(ctx, drawX, drawY);
    } catch {
      ctx.fillStyle = '#ef4444';
      ctx.font = '13px sans-serif';
      ctx.fillText('Format rumus belum lengkap...', 16, canvas.height / 2);
    }
  }, [isOpen, tex, fontSize]);

  if (!isOpen) return null;

  const handleInsertSnippet = (snippet: string) => {
    const el = inputRef.current;
    if (!el) {
      setTex((prev) => prev + snippet);
      return;
    }
    const start = el.selectionStart ?? tex.length;
    const end = el.selectionEnd ?? start;
    const nextVal = tex.slice(0, start) + snippet + tex.slice(end);
    setTex(nextVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 10);
  };

  const handleConfirm = () => {
    const trimmed = tex.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    onSave(trimmed, fontSize, obj || undefined);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(480px, calc(100% - 28px))',
          background: '#1b2238',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: 20,
          padding: 24,
          boxShadow: '0 24px 50px rgba(0, 0, 0, 0.5)',
          color: '#eef1fa',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleConfirm();
          if (e.key === 'Escape') onClose();
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>∑</span>
            <span>{obj ? 'Ubah Rumus Matematika' : 'Sisipkan Rumus Matematika'}</span>
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 0,
              color: '#8e98b4',
              fontSize: 20,
              cursor: 'pointer',
              padding: '2px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Live Preview Canvas */}
        <div style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          <canvas
            ref={canvasRef}
            width={430}
            height={90}
            style={{ display: 'block', width: '100%', height: 90, background: '#ffffff' }}
          />
        </div>

        {/* TeX Input */}
        <input
          ref={inputRef}
          type="text"
          value={tex}
          onChange={(e) => setTex(e.target.value)}
          placeholder="LaTeX, misal: \frac{a}{b} atau \sqrt{x^2 + y^2}"
          style={{
            width: '100%',
            padding: '12px 14px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: 12,
            color: '#ffffff',
            fontSize: 15,
            outline: 'none',
            fontFamily: 'monospace',
            marginBottom: 12,
          }}
        />

        {/* Shortcut Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {FORMULA_SHORTCUTS.map(([label, snip]) => (
            <button
              key={label}
              type="button"
              className="chip"
              onClick={() => handleInsertSnippet(snip)}
              style={{
                padding: '4px 10px',
                fontSize: 13,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 8,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Font size control */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: '#8e98b4' }}>Ukuran Rumus: <b>{fontSize}px</b></span>
          <input
            type="range"
            min={16}
            max={72}
            value={fontSize}
            onChange={(e) => setFontSize(+e.target.value)}
            style={{ width: 160, accentColor: '#9b17f5' }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.08)',
              color: '#c5cce0',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              padding: '10px 22px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #9b17f5, #7c3aed)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 14,
              boxShadow: '0 4px 14px rgba(155, 23, 245, 0.4)',
            }}
          >
            {obj ? 'Simpan' : 'Sisipkan'}
          </button>
        </div>
      </div>
    </div>
  );
};

