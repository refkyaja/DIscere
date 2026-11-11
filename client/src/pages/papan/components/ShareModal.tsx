import { useState, useEffect } from 'react';

export interface PesertaItem {
  id: string;
  nama: string;
  peran: 'editor' | 'viewer';
}

export interface ShareModalProps {
  isOpen: boolean;
  boardId: string;
  pesertaList: PesertaItem[];
  onClose: () => void;
  onToast: (msg: string) => void;
  onDownloadPng?: () => void;
  onDownloadPdf?: () => void;
}

const AVATAR_COLORS = [
  '#e11d48',
  '#2563eb',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#059669',
  '#db2777',
  '#4f46e5',
];

export function getAvatarColor(idOrName: string): string {
  let hash = 0;
  for (let i = 0; i < idOrName.length; i++) {
    hash = (hash << 5) - hash + idOrName.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export function ShareModal({
  isOpen,
  boardId,
  pesertaList,
  onClose,
  onToast,
  onDownloadPng,
  onDownloadPdf,
}: ShareModalProps) {
  const [peran, setPeran] = useState<'editor' | 'viewer'>('editor');
  const [joinUrl, setJoinUrl] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);
  const [isAktif, setIsAktif] = useState(false);
  const [loading, setLoading] = useState(false);

  // Ambil status tautan aktif saat modal dibuka
  useEffect(() => {
    if (!isOpen || !boardId) return;

    let isMounted = true;
    setLoading(true);

    fetch(`/api/papan/${boardId}/bagikan`, {
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.aktif && data.token) {
          setIsAktif(true);
          setToken(data.token);
          setPeran(data.peran || 'editor');
          setJoinUrl(data.joinUrl || `${window.location.origin}/b/${data.token}`);
        } else {
          setIsAktif(false);
          setToken(null);
          setJoinUrl('');
        }
      })
      .catch((err) => {
        console.error('Gagal mengambil status tautan:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, boardId]);

  if (!isOpen) return null;

  // Buat atau perbarui tautan berbagi
  async function handleCreateOrUpdateShare(newPeran?: 'editor' | 'viewer') {
    const targetPeran = newPeran || peran;
    setLoading(true);
    try {
      const res = await fetch(`/api/papan/${boardId}/bagikan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peran: targetPeran }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.pesan || 'Gagal membuat tautan');

      setIsAktif(true);
      setToken(data.share.token);
      setPeran(data.share.peran);
      setJoinUrl(data.share.joinUrl || `${window.location.origin}/b/${data.share.token}`);

      if (!newPeran) {
        // Jika dipanggil dari tombol Salin Tautan
        await navigator.clipboard.writeText(data.share.joinUrl);
        onToast('Tautan disalin ke papan klip!');
      } else {
        onToast(`Peran tautan diubah menjadi ${targetPeran === 'editor' ? 'Editor' : 'Viewer'}`);
      }
    } catch (err: any) {
      onToast(err.message || 'Gagal memproses tautan berbagi');
    } finally {
      setLoading(false);
    }
  }

  // Cabut tautan berbagi
  async function handleRevoke() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/papan/bagi/${token}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.pesan || 'Gagal mencabut tautan');

      setIsAktif(false);
      setToken(null);
      setJoinUrl('');
      onToast('Tautan berbagi berhasil dicabut.');
    } catch (err: any) {
      onToast(err.message || 'Gagal mencabut tautan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      id="shr"
      className="share-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Bagikan papan"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b>Bagikan papan</b>
        <button
          className="ib"
          onClick={onClose}
          aria-label="Tutup"
          style={{ width: 28, height: 28, fontSize: 16 }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="sl">Level akses</div>
      <div className="sr">
        <span className="gi">
          <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
          </svg>
        </span>
        <div className="sx">
          <span style={{ fontWeight: 600, fontSize: 14 }}>Yang punya tautan</span>
          <small>Wajib diakses melalui tautan</small>
        </div>
        <select
          className="shs"
          id="srl"
          value={peran}
          disabled={loading}
          onChange={(e) => {
            const nextPeran = e.target.value as 'editor' | 'viewer';
            setPeran(nextPeran);
            if (isAktif) {
              handleCreateOrUpdateShare(nextPeran);
            }
          }}
        >
          <option value="editor">Edit</option>
          <option value="viewer">Lihat</option>
        </select>
      </div>

      {/* Input Tautan */}
      {isAktif && joinUrl && (
        <div className="si">
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <input
            readOnly
            value={joinUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
        </div>
      )}

      {/* Tombol Salin Tautan */}
      <button
        className="shb"
        disabled={loading}
        onClick={() => handleCreateOrUpdateShare()}
      >
        <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
        <span>{isAktif ? 'Salin tautan' : 'Buat dan salin tautan'}</span>
      </button>

      {/* Tombol Unduh Foto & PDF */}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="shb-export"
          onClick={() => {
            if (onDownloadPng) {
              onDownloadPng();
            }
          }}
          title="Unduh papan tulis sebagai gambar PNG"
        >
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span>Unduh Foto</span>
        </button>

        <button
          type="button"
          className="shb-export"
          onClick={() => {
            if (onDownloadPdf) {
              onDownloadPdf();
            }
          }}
          title="Unduh papan tulis sebagai dokumen PDF"
        >
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <span>Unduh PDF</span>
        </button>
      </div>

      {/* Tombol Cabut Tautan */}
      {isAktif && (
        <button
          className="shb-cabut"
          disabled={loading}
          onClick={handleRevoke}
        >
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
          <span>Cabut tautan</span>
        </button>
      )}

      {/* Daftar Peserta Aktif */}
      <div className="sl" style={{ marginTop: 18 }}>
        Orang yang sedang membuka ({pesertaList.length})
      </div>
      <div className="av2">
        {pesertaList.length === 0 ? (
          <span style={{ fontSize: 12, color: '#94a3b8', width: 'auto', borderRadius: 0, border: 0 }}>
            Belum ada kolaborator lain
          </span>
        ) : (
          pesertaList.map((p) => {
            const initial = (p.nama || '?').charAt(0).toUpperCase();
            const bg = getAvatarColor(p.id || p.nama);
            return (
              <span
                key={p.id}
                title={`${p.nama} (${p.peran === 'editor' ? 'Editor' : 'Viewer'})`}
                style={{ background: bg }}
              >
                {initial}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
