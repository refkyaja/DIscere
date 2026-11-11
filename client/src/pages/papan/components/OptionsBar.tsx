import { BoardState, PenStyle } from '../engine/types';
import { COL, LCOL } from '../engine/color';
import { STY } from '../engine/shapes';

export interface OptionsBarProps {
  state: BoardState;
  hasSelection: boolean;
  selectedCount?: number;
  isGrouped?: boolean;
  isLocked?: boolean;
  hanyaLihat?: boolean;
  onUpdateState: (patch: Partial<BoardState>) => void;
  onOpenColorPicker: (btnEl: HTMLElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onZOrder?: (action: 'front' | 'back' | 'fwd' | 'bwd') => void;
  onToggleLock?: () => void;
  onOpenFormula?: () => void;
}

export function OptionsBar({
  state,
  hasSelection,
  selectedCount = 0,
  isGrouped = false,
  isLocked = false,
  hanyaLihat = false,
  onUpdateState,
  onOpenColorPicker,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onCopy,
  onCut,
  onPaste,
  onZOrder,
  onToggleLock,
  onOpenFormula,
}: OptionsBarProps) {
  const t = state.tool;

  if (hanyaLihat && t !== 'laser') {
    return null;
  }

  const toolLabels: Record<string, string> = {
    select: 'PILIH',
    hand: 'TANGAN',
    laser: 'LASER',
    pen: 'PENA',
    eraser: 'HAPUS',
    shape: 'BENTUK',
    text: 'TEKS',
    table: 'TABEL',
    fill: 'ISI',
    pick: 'PIPET',
    ai: 'TANYA AI',
    upload: 'UPLOAD',
    conn: 'KONEKTOR',
    formula: 'RUMUS',
  };

  const label = toolLabels[t] || t.toUpperCase();

  const colorButton = (
    <>
      <span className="bl">Warna</span>
      <button
        className="cs"
        style={{ background: state.color }}
        aria-label="Pilih warna"
        onClick={(e) => onOpenColorPicker(e.currentTarget)}
      />
    </>
  );

  return (
    <div className="pn options-bar">
      <span className="lb">{label}</span>

      {/* PEN OPTIONS */}
      {t === 'pen' && (
        <>
          {colorButton}

          <span className="bl">
            Ukuran Kuas: <b>{state.size}px</b>
          </span>
          <input
            type="range"
            className="rg"
            min={1}
            max={60}
            value={state.size}
            aria-label="Ukuran Kuas"
            onChange={(e) => onUpdateState({ size: +e.target.value })}
          />

          <span className="bl">
            Opasitas: <b>{Math.round(state.op * 100)}%</b>
          </span>
          <input
            type="range"
            className="rg"
            min={10}
            max={100}
            value={Math.round(state.op * 100)}
            aria-label="Opasitas"
            onChange={(e) => onUpdateState({ op: +e.target.value / 100 })}
          />

          <span className="bl">Gaya</span>
          <select
            className="sel"
            value={state.style}
            aria-label="Gaya Kuas"
            onChange={(e) => onUpdateState({ style: e.target.value as PenStyle })}
          >
            {(Object.entries(STY) as [PenStyle, [string, string]][]).map(([k, [n]]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
        </>
      )}

      {/* ERASER OPTIONS */}
      {t === 'eraser' && (
        <>
          <span className="bl">
            Ukuran Penghapus: <b>{state.er}px</b>
          </span>
          <input
            type="range"
            className="rg"
            min={4}
            max={100}
            value={state.er}
            aria-label="Ukuran Penghapus"
            onChange={(e) => onUpdateState({ er: +e.target.value })}
          />
        </>
      )}

      {/* SHAPE OPTIONS */}
      {t === 'shape' && (
        <>
          {colorButton}

          <span className="bl">
            Tebal Garis: <b>{state.ss}px</b>
          </span>
          <input
            type="range"
            className="rg"
            min={1}
            max={20}
            value={state.ss}
            aria-label="Tebal Garis"
            onChange={(e) => onUpdateState({ ss: +e.target.value })}
          />

          <span className="bl">
            Opasitas: <b>{Math.round(state.op * 100)}%</b>
          </span>
          <input
            type="range"
            className="rg"
            min={10}
            max={100}
            value={Math.round(state.op * 100)}
            aria-label="Opasitas Bentuk"
            onChange={(e) => onUpdateState({ op: +e.target.value / 100 })}
          />
        </>
      )}

      {/* TEXT OPTIONS */}
      {t === 'text' && (
        <>
          {colorButton}

          <span className="bl">
            Ukuran Font: <b>{state.fs}px</b>
          </span>
          <input
            type="range"
            className="rg"
            min={12}
            max={96}
            value={state.fs}
            aria-label="Ukuran Font"
            onChange={(e) => onUpdateState({ fs: +e.target.value })}
          />
        </>
      )}

      {/* TABLE OPTIONS */}
      {t === 'table' && <>{colorButton}</>}

      {/* FILL OPTIONS */}
      {t === 'fill' && (
        <>
          {[...COL, '#fde68a', '#bfdbfe'].map((c) => (
            <button
              key={c}
              className={`sw ${state.fill === c ? 'on' : ''}`}
              style={{ background: c }}
              aria-label={c}
              onClick={() => onUpdateState({ fill: c })}
            />
          ))}
          <button
            className={`chip ${!state.fill ? 'on' : ''}`}
            onClick={() => onUpdateState({ fill: null })}
          >
            Tanpa isi
          </button>
        </>
      )}

      {/* LASER OPTIONS */}
      {t === 'laser' && (
        <>
          {LCOL.map((c) => (
            <button
              key={c}
              className={`sw ${state.lc === c ? 'on' : ''}`}
              style={{ background: c }}
              aria-label={`Laser ${c}`}
              onClick={() => onUpdateState({ lc: c })}
            />
          ))}
        </>
      )}

      {/* SELECT OPTIONS */}
      {t === 'select' && (
        <>
          <span className="hint">
            {selectedCount > 1
              ? `Terpilih: ${selectedCount} objek`
              : hasSelection
              ? '1 objek terpilih'
              : 'Klik objek atau seret kotak seleksi (Shift+klik multi-select)'}
          </span>

          {hasSelection && onCopy && (
            <button className="chip" onClick={onCopy} title="Salin objek (Ctrl+C)">
              Salin
            </button>
          )}

          {hasSelection && onCut && (
            <button className="chip" onClick={onCut} title="Potong objek (Ctrl+X)">
              Potong
            </button>
          )}

          {onPaste && (
            <button className="chip" onClick={onPaste} title="Tempel objek (Ctrl+V)">
              Tempel
            </button>
          )}

          {selectedCount >= 2 && onGroup && !isGrouped && (
            <button className="chip" onClick={onGroup} title="Kelompokkan (Ctrl+G)">
              Grup
            </button>
          )}

          {isGrouped && onUngroup && (
            <button className="chip" onClick={onUngroup} title="Lepas grup (Ctrl+Shift+G)">
              Lepas Grup
            </button>
          )}

          {hasSelection && onToggleLock && (
            <button
              className="chip"
              onClick={onToggleLock}
              title={isLocked ? 'Buka Kunci Objek' : 'Kunci Objek'}
            >
              {isLocked ? '🔓 Buka Kunci' : '🔒 Kunci'}
            </button>
          )}

          {hasSelection && onZOrder && (
            <>
              <button
                className="chip"
                onClick={() => onZOrder('front')}
                title="Bawa ke Paling Depan (Ctrl+Shift+])"
              >
                Ke Depan
              </button>
              <button
                className="chip"
                onClick={() => onZOrder('back')}
                title="Kirim ke Paling Belakang (Ctrl+Shift+[)"
              >
                Ke Belakang
              </button>
            </>
          )}

          <button
            className="chip"
            disabled={!hasSelection}
            style={!hasSelection ? { opacity: 0.4, cursor: 'default' } : undefined}
            onClick={onDuplicate}
            title="Duplikat (Ctrl+D)"
          >
            Duplikat
          </button>
          <button
            className="chip"
            disabled={!hasSelection}
            style={!hasSelection ? { opacity: 0.4, cursor: 'default' } : undefined}
            onClick={onDelete}
            title="Hapus (Delete / Backspace)"
          >
            Hapus
          </button>
        </>
      )}

      {/* CONNECTOR OPTIONS */}
      {t === 'conn' && (
        <>
          {colorButton}
          <span className="bl">
            Tebal: <b>{state.ss}px</b>
          </span>
          <input
            type="range"
            className="rg"
            min={1}
            max={20}
            value={state.ss}
            aria-label="Tebal Konektor"
            onChange={(e) => onUpdateState({ ss: +e.target.value })}
          />
          <button
            className={`chip ${state.cs !== 'line' ? 'on' : ''}`}
            onClick={() => onUpdateState({ cs: 'arrow' })}
          >
            Panah
          </button>
          <button
            className={`chip ${state.cs === 'line' ? 'on' : ''}`}
            onClick={() => onUpdateState({ cs: 'line' })}
          >
            Garis Lurus
          </button>
          <span className="hint">
            Klik/seret dari objek pertama ke objek kedua untuk menghubungkan
          </span>
        </>
      )}

      {/* FORMULA OPTIONS */}
      {t === 'formula' && (
        <>
          <span className="hint">
            Klik pada kanvas atau tekan tombol di sebelah kanan untuk menyisipkan rumus
          </span>
          {onOpenFormula && (
            <button className="chip on" onClick={onOpenFormula}>
              ∑ Buka Editor Rumus
            </button>
          )}
        </>
      )}

      {/* OTHER HINTS */}
      {t === 'hand' && <span className="hint">Seret kanvas untuk menggeser</span>}
      {t === 'pick' && <span className="hint">Klik objek untuk mengambil warna</span>}
      {t === 'ai' && <span className="hint">Gambar bebas melingkari soal, lalu tanya AI</span>}
      {t === 'upload' && <span className="hint">Unggah gambar atau seret file ke kanvas</span>}
    </div>
  );
}

