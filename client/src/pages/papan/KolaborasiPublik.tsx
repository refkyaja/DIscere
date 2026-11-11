import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import './papan.css';
import { getSocket } from '../../lib/socket';
import { Board } from './engine/board';
import {
  CanvasObj,
  BoardState,
  BoardView,
  TextEditorState,
  ToolType,
  PenStyle,
  UbahEventPayload,
} from './engine/types';
import { COL, LCOL } from './engine/color';
import { downloadPng } from './engine/export';
import {
  TopLeftBar,
  ToolRail,
  OptionsBar,
  TopRightBar,
  ZoomBar,
  Flyouts,
  ColorPicker,
  TextEditor,
  Toast,
  PesertaItem,
} from './components';

const PALET_WARNA = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444'];
function getWarnaSocket(socketId: string) {
  let hash = 0;
  for (let i = 0; i < socketId.length; i++) hash = (hash << 5) - hash + socketId.charCodeAt(i);
  return PALET_WARNA[Math.abs(hash) % PALET_WARNA.length];
}

export default function KolaborasiPublik() {
  const { token } = useParams<{ token: string }>();

  // State Verifikasi Tautan & Nama Pengguna
  const [verifying, setVerifying] = useState(true);
  const [invalidTokenMsg, setInvalidTokenMsg] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<{
    boardId: string;
    judul: string;
    pemilik: string;
    peran: 'editor' | 'viewer';
  } | null>(null);

  const [inputNama, setInputNama] = useState(() => {
    return sessionStorage.getItem('discere-kolab-nama') || '';
  });
  const [isJoined, setIsJoined] = useState(false);
  const [namaError, setNamaError] = useState<string | null>(null);

  // Status Kanvas & Socket
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<Board | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [peran, setPeran] = useState<'editor' | 'viewer'>('viewer');
  const [loadedObjs, setLoadedObjs] = useState<CanvasObj[] | null>(null);
  const [pesertaList, setPesertaList] = useState<PesertaItem[]>([]);
  const pesertaListRef = useRef<PesertaItem[]>([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [aksesDicabut, setAksesDicabut] = useState(false);

  // State UI Kanvas
  const [boardState, setBoardState] = useState<BoardState>({
    tool: 'hand',
    color: COL[0],
    size: 4,
    er: 14,
    style: 'pen',
    op: 1,
    ss: 3,
    tab: 'Dasar',
    shape: 'rect',
    fs: 24,
    tsz: 3,
    lc: LCOL[0],
    grid: true,
  });

  const [view, setView] = useState<BoardView>({ x: 0, y: 0, z: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Popups & Overlays
  const [activeFlyout, setActiveFlyout] = useState<ToolType | null>(null);
  const [flyoutAnchor, setFlyoutAnchor] = useState<DOMRect | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [colorPickerAnchor, setColorPickerAnchor] = useState<DOMRect | null>(null);
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fileImgRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2200);
  }, []);

  // 1. Verifikasi Validitas Token Berbagi
  useEffect(() => {
    if (!token) {
      setInvalidTokenMsg('Token tautan tidak ditemukan.');
      setVerifying(false);
      return;
    }

    let isMounted = true;
    fetch(`/api/papan/share/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.pesan || 'Tautan tidak valid atau telah dicabut.');
        }
        return data;
      })
      .then((data) => {
        if (!isMounted) return;
        setShareInfo({
          boardId: data.share.boardId,
          judul: data.share.judul,
          pemilik: data.share.pemilik,
          peran: data.share.peran,
        });
        setBoardId(data.share.boardId);
        setTitle(data.share.judul);
        setPeran(data.share.peran);

        // Jika peran viewer, default alat adalah hand
        if (data.share.peran === 'viewer') {
          setBoardState((prev) => ({ ...prev, tool: 'hand' }));
        } else {
          setBoardState((prev) => ({ ...prev, tool: 'pen' }));
        }

        // Jika sudah ada nama di sessionStorage, otomatis lanjut gabung
        const savedNama = sessionStorage.getItem('discere-kolab-nama');
        if (savedNama && savedNama.trim().length >= 2) {
          setIsJoined(true);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setInvalidTokenMsg(err.message || 'Tautan tidak ditemukan.');
      })
      .finally(() => {
        if (isMounted) setVerifying(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  // 2. Hubungkan ke Socket.IO setelah bergabung
  useEffect(() => {
    if (!isJoined || !token || !inputNama) return;

    const socket = getSocket();

    function gabung() {
      socket.emit(
        'papan:gabung',
        { token, nama: inputNama.trim() },
        (res: any) => {
          if (res?.success) {
            setIsReconnecting(false);
            if (res.boardId) setBoardId(res.boardId);
            if (res.judul) setTitle(res.judul);
            if (res.peran) setPeran(res.peran);
            if (res.data?.objs) {
              setLoadedObjs(res.data.objs);
              if (boardRef.current) {
                boardRef.current.replaceObjs(res.data.objs);
              }
            }
          } else {
            showToast(res?.pesan || 'Gagal bergabung ke sesi kolaborasi');
          }
        }
      );
    }

    pesertaListRef.current = pesertaList;

    gabung();

    const handleUbah = (ops: UbahEventPayload & { dariSocketId?: string }) => {
      const sId = ops.dariSocketId;
      if (sId) {
        boardRef.current?.clearRemoteLiveMoved(sId);
        boardRef.current?.clearRemoteLiveErase(sId);
        boardRef.current?.clearRemoteLiveStroke(sId);
      }
      boardRef.current?.terapkanOps(ops);
      if (boardRef.current) {
        setLoadedObjs([...boardRef.current.objs]);
      }

      // Tutup editor teks jika objek yang diedit dihapus oleh orang lain
      if (ops.hapus && ops.hapus.length > 0) {
        const setHapus = new Set(ops.hapus);
        setTextEditor((prev) => {
          if (prev?.obj && setHapus.has(prev.obj.id)) {
            return null;
          }
          return prev;
        });
      }

      // BAGIAN D: tempelkan nama di objek yang diubah/ditambah sampai aksi berikutnya
      if (sId && boardRef.current) {
        const targetId = (ops.tambah?.[0] || ops.ubah?.[0])?.id;
        if (targetId) {
          const targetObj = boardRef.current.objs.find((o) => o.id === targetId);
          if (targetObj) {
            const nama = pesertaListRef.current.find((p) => (p.socketId || p.id) === sId)?.nama || 'Peserta';
            const ox = 'x' in targetObj ? (targetObj as any).x : 0;
            const oy = 'y' in targetObj ? (targetObj as any).y : 0;
            boardRef.current.setCollaboratorBadge(sId, {
              id: sId,
              name: nama,
              x: ox,
              y: oy,
              color: getWarnaSocket(sId),
              label: nama,
            });
          }
        } else {
          boardRef.current.removeCollaboratorBadge(sId);
        }
      }
    };

    const handlePeserta = (list: PesertaItem[]) => {
      const oldList = pesertaListRef.current;
      setPesertaList(list);
      pesertaListRef.current = list;

      // Hapus badge kolaborator jika peserta keluar
      const currentIds = new Set(list.map((p) => p.socketId || p.id));
      for (const p of oldList) {
        const sId = p.socketId || p.id;
        if (!currentIds.has(sId)) {
          boardRef.current?.removeCollaboratorBadge(sId);
          boardRef.current?.clearRemoteLiveStroke(sId);
          boardRef.current?.clearRemoteLiveMoved(sId);
          boardRef.current?.clearRemoteLiveErase(sId);
        }
      }
    };

    const handleLiveCoret = (data: { socketId: string; stroke: CanvasObj }) => {
      if (data && data.socketId && data.stroke) {
        boardRef.current?.setRemoteLiveStroke(data.socketId, data.stroke);
        const nama = pesertaListRef.current.find((p) => (p.socketId || p.id) === data.socketId)?.nama || 'Peserta';
        const strokePts = data.stroke.type === 'stroke' ? (data.stroke as any).pts : null;
        if (strokePts && strokePts.length > 0) {
          const lastPt = strokePts[strokePts.length - 1];
          boardRef.current?.setCollaboratorBadge(data.socketId, {
            id: data.socketId,
            name: nama,
            x: lastPt.x,
            y: lastPt.y,
            color: getWarnaSocket(data.socketId),
            label: nama,
          });
        }
      }
    };

    const handleLiveCoretSelesai = (data: { socketId: string }) => {
      if (data && data.socketId) {
        boardRef.current?.clearRemoteLiveStroke(data.socketId);
        boardRef.current?.removeCollaboratorBadge(data.socketId);
      }
    };

    const handleLiveGeser = (data: { socketId: string; objs: CanvasObj[] }) => {
      if (data && data.socketId && data.objs) {
        boardRef.current?.setRemoteLiveMoved(data.socketId, data.objs);
        const nama = pesertaListRef.current.find((p) => (p.socketId || p.id) === data.socketId)?.nama || 'Peserta';
        if (data.objs.length > 0) {
          const first = data.objs[0];
          const bx = 'x' in first ? (first as any).x : 0;
          const by = 'y' in first ? (first as any).y : 0;
          boardRef.current?.setCollaboratorBadge(data.socketId, {
            id: data.socketId,
            name: nama,
            x: bx,
            y: by,
            color: getWarnaSocket(data.socketId),
            label: `${nama} (menggeser)`,
          });
        }
      }
    };

    const handleLiveGeserSelesai = (data: { socketId: string }) => {
      if (data && data.socketId) {
        boardRef.current?.clearRemoteLiveMoved(data.socketId);
        boardRef.current?.removeCollaboratorBadge(data.socketId);
      }
    };

    const handleLiveHapus = (data: { socketId: string; removedIds: string[]; addedObjs: CanvasObj[] }) => {
      if (data && data.socketId) {
        boardRef.current?.setRemoteLiveErase(data.socketId, {
          removedIds: data.removedIds || [],
          addedObjs: data.addedObjs || [],
        });
        const nama = pesertaListRef.current.find((p) => (p.socketId || p.id) === data.socketId)?.nama || 'Peserta';
        let pos = { x: 0, y: 0 };
        if (data.addedObjs && data.addedObjs.length > 0) {
          const first = data.addedObjs[0];
          pos = { x: (first as any).x || 0, y: (first as any).y || 0 };
        } else if (data.removedIds && data.removedIds.length > 0 && boardRef.current) {
          const rem = boardRef.current.objs.find((o) => o.id === data.removedIds[0]);
          if (rem) {
            pos = { x: (rem as any).x || 0, y: (rem as any).y || 0 };
          }
        }
        boardRef.current?.setCollaboratorBadge(data.socketId, {
          id: data.socketId,
          name: nama,
          x: pos.x,
          y: pos.y,
          color: getWarnaSocket(data.socketId),
          label: `${nama} (menghapus)`,
        });
      }
    };

    const handleLiveHapusSelesai = (data: { socketId: string }) => {
      if (data && data.socketId) {
        boardRef.current?.clearRemoteLiveErase(data.socketId);
        boardRef.current?.removeCollaboratorBadge(data.socketId);
      }
    };

    const handleAksesDicabut = (data: { token?: string }) => {
      if (data?.token === token) {
        setAksesDicabut(true);
        if (boardRef.current) {
          boardRef.current.hanyaLihat = true;
        }
      }
    };

    const handleDisconnect = () => {
      setIsReconnecting(true);
    };

    const handleConnect = () => {
      gabung();
    };

    socket.on('papan:ubah', handleUbah);
    socket.on('papan:peserta', handlePeserta);
    socket.on('papan:coret_live', handleLiveCoret);
    socket.on('papan:coret_selesai', handleLiveCoretSelesai);
    socket.on('papan:geser_live', handleLiveGeser);
    socket.on('papan:geser_selesai', handleLiveGeserSelesai);
    socket.on('papan:hapus_live', handleLiveHapus);
    socket.on('papan:hapus_selesai', handleLiveHapusSelesai);
    socket.on('papan:akses_dicabut', handleAksesDicabut);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('papan:ubah', handleUbah);
      socket.off('papan:peserta', handlePeserta);
      socket.off('papan:coret_live', handleLiveCoret);
      socket.off('papan:coret_selesai', handleLiveCoretSelesai);
      socket.off('papan:geser_live', handleLiveGeser);
      socket.off('papan:geser_selesai', handleLiveGeserSelesai);
      socket.off('papan:hapus_live', handleLiveHapus);
      socket.off('papan:hapus_selesai', handleLiveHapusSelesai);
      socket.off('papan:akses_dicabut', handleAksesDicabut);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
    };
  }, [isJoined, token, inputNama, showToast]);

  // 3. Inisialisasi engine Board pada Kanvas
  useEffect(() => {
    if (!isJoined || !canvasRef.current || !loadedObjs) return;

    if (boardRef.current) {
      boardRef.current.destroy();
    }

    const isHanyaLihat = peran === 'viewer' || aksesDicabut;

    const board = new Board(canvasRef.current, loadedObjs, {
      hanyaLihat: isHanyaLihat,
      onUbah: (payload: UbahEventPayload) => {
        // Jika viewer, tolak pengiriman perubahan
        if (peran === 'viewer' || aksesDicabut) return;

        const socket = getSocket();
        socket.emit('papan:ubah', {
          boardId,
          tambah: payload.tambah || [],
          ubah: payload.ubah || [],
          hapus: payload.hapus || [],
        });
      },
      onLiveCoret: (stroke) => {
        if (peran === 'viewer' || aksesDicabut) return;
        const socket = getSocket();
        socket.emit('papan:coret_live', { boardId, stroke });
      },
      onLiveCoretSelesai: () => {
        if (peran === 'viewer' || aksesDicabut) return;
        const socket = getSocket();
        socket.emit('papan:coret_selesai', { boardId });
      },
      onLiveGeser: (objs) => {
        if (peran === 'viewer' || aksesDicabut) return;
        const socket = getSocket();
        socket.emit('papan:geser_live', { boardId, objs });
      },
      onLiveGeserSelesai: () => {
        if (peran === 'viewer' || aksesDicabut) return;
        const socket = getSocket();
        socket.emit('papan:geser_selesai', { boardId });
      },
      onLiveHapus: (data) => {
        if (peran === 'viewer' || aksesDicabut) return;
        const socket = getSocket();
        socket.emit('papan:hapus_live', { boardId, removedIds: data.removedIds, addedObjs: data.addedObjs });
      },
      onLiveHapusSelesai: () => {
        if (peran === 'viewer' || aksesDicabut) return;
        const socket = getSocket();
        socket.emit('papan:hapus_selesai', { boardId });
      },
      onStateChange: (nextState) => {
        setBoardState({ ...nextState });
      },
      onSelectionChange: (_selIds, firstId) => {
        setSelectedId(firstId);
      },
      onViewChange: (nextView) => {
        setView({ ...nextView });
      },
      onHistoryChange: (nextUndo, nextRedo) => {
        setCanUndo(nextUndo);
        setCanRedo(nextRedo);
      },
      onOpenTextEditor: (edState) => {
        if (!isHanyaLihat) setTextEditor(edState);
      },
      onCloseTextEditor: () => {
        setTextEditor(null);
      },
      onToast: (m) => {
        showToast(m);
      },
    });

    boardRef.current = board;
    setBoardState({ ...board.state });
    setView({ ...board.view });
    setCanUndo(board.canUndo());
    setCanRedo(board.canRedo());

    return () => {
      if (boardRef.current) {
        boardRef.current.destroy();
        boardRef.current = null;
        setCanUndo(false);
        setCanRedo(false);
      }
    };
  }, [isJoined, loadedObjs, peran, aksesDicabut, boardId, showToast]);

  // Form Submit Masuk Nama
  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanNama = inputNama.trim();
    if (cleanNama.length < 2 || cleanNama.length > 20) {
      setNamaError('Nama panggilan harus terdiri dari 2 hingga 20 karakter.');
      return;
    }
    setNamaError(null);
    sessionStorage.setItem('discere-kolab-nama', cleanNama);
    setIsJoined(true);
  }

  // --- LAYAR VERIFIKASI & LOADING ---
  if (verifying) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-300 font-medium">Memeriksa tautan berbagi papan…</p>
      </div>
    );
  }

  // --- LAYAR TOKEN TIDAK VALID / DICABUT ---
  if (invalidTokenMsg || !shareInfo) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8 stroke-current fill-none stroke-2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Tautan Tidak Tersedia</h1>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            {invalidTokenMsg || 'Tautan berbagi tidak ditemukan atau akses telah dicabut oleh pemilik papan.'}
          </p>
          <Link
            to="/"
            className="inline-block px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-colors"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  // --- LAYAR FORM MASUKKAN NAMA (Sebelum Masuk Kanvas) ---
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-800 text-center">
          <div className="inline-block px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold uppercase tracking-wider mb-3">
            Papan Kolaborasi
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{shareInfo.judul}</h1>
          <p className="text-slate-400 text-xs mb-6">Dibuat oleh {shareInfo.pemilik}</p>

          <div
            className={`p-3.5 rounded-xl mb-6 text-xs text-left flex items-start gap-3 ${
              shareInfo.peran === 'editor'
                ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            }`}
          >
            <div className="mt-0.5 font-bold text-sm">
              {shareInfo.peran === 'editor' ? '✏️' : '👁️'}
            </div>
            <div>
              <b className="block text-white mb-0.5">
                Peran: {shareInfo.peran === 'editor' ? 'Editor (Dapat Menggambar)' : 'Viewer (Mode Lihat)'}
              </b>
              <span>
                {shareInfo.peran === 'editor'
                  ? 'Anda dapat mencoret, menambahkan bentuk, teks, dan tabel bersama-sama secara real-time.'
                  : 'Anda dapat melihat penjelasan dan pergerakan kanvas secara langsung (hanya lihat).'}
              </span>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nama Panggilan Anda
              </label>
              <input
                type="text"
                autoFocus
                value={inputNama}
                onChange={(e) => setInputNama(e.target.value)}
                placeholder="Contoh: Budi, Ani, Siswa 1"
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 text-sm"
              />
              {namaError && <p className="text-red-400 text-xs mt-1.5">{namaError}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-all shadow-lg shadow-purple-600/30 cursor-pointer"
            >
              Masuk ke Papan Tulis
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- LAYAR KANVAS KOLABORASI UTAMA ---
  const board = boardRef.current;
  const isHanyaLihat = peran === 'viewer' || aksesDicabut;

  return (
    <div className="papan" style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Kanvas 2D Engine */}
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* Notifikasi Akses Dicabut Modal */}
      {aksesDicabut && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: '#1e2230',
              padding: 28,
              borderRadius: 20,
              maxWidth: 400,
              textAlign: 'center',
              border: '1px solid #ef4444',
            }}
          >
            <h2 style={{ color: '#ef4444', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              Sesi Berbagi Telah Berakhir
            </h2>
            <p style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              Pemilik papan telah mencabut tautan kolaborasi ini. Anda tidak dapat lagi berinteraksi
              dengan papan ini.
            </p>
            <Link
              to="/"
              style={{
                display: 'inline-block',
                background: '#475569',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Keluar ke Beranda
            </Link>
          </div>
        </div>
      )}

      {/* Header Kiri: Nama & Badge Mode Lihat */}
      <TopLeftBar
        title={title}
        saveStatus="saved"
        hanyaLihat={isHanyaLihat}
        isReconnecting={isReconnecting}
        onExportPng={() => {
          if (board) {
            downloadPng(board.objs, title);
            showToast('PNG diunduh');
          }
        }}
      />

      {/* Sidebar Alat Kiri */}
      <ToolRail
        activeTool={boardState.tool}
        hanyaLihat={isHanyaLihat}
        disableAi={true}
        onSelectTool={(tool) => {
          if (board) board.setTool(tool);
          else setBoardState((prev) => ({ ...prev, tool }));
        }}
      />

      {/* Options Bar (Hanya jika bukan viewer atau saat laser aktif) */}
      <OptionsBar
        state={boardState}
        hasSelection={!!selectedId}
        hanyaLihat={isHanyaLihat}
        onUpdateState={(patch) => {
          if (board) board.updateState(patch);
          else setBoardState((prev) => ({ ...prev, ...patch }));
        }}
        onOpenColorPicker={(btnEl) => {
          setColorPickerAnchor(btnEl.getBoundingClientRect());
          setIsColorPickerOpen(true);
        }}
        onDuplicate={() => board?.duplicateSelected()}
        onDelete={() => board?.deleteSelected()}
      />

      {/* Header Kanan: Undo/Redo (Editor), Avatar Peserta, Presentasi */}
      <TopRightBar
        canUndo={!isHanyaLihat && canUndo}
        canRedo={!isHanyaLihat && canRedo}
        pesertaList={pesertaList}
        hanyaLihat={isHanyaLihat}
        onUndo={() => boardRef.current?.undo()}
        onRedo={() => boardRef.current?.redo()}
        onPresentation={() => boardRef.current?.setPresentation(true)}
      />

      {/* Zoom Bar */}
      <ZoomBar
        zoom={view.z}
        gridEnabled={boardState.grid}
        onZoomIn={() => board?.zoomIn()}
        onZoomOut={() => board?.zoomOut()}
        onResetZoom={() => board?.resetZoom()}
        onToggleGrid={() => board?.toggleGrid()}
        onCenterView={() => board?.centerView()}
      />

      {/* Flyout Subpanels */}
      {!isHanyaLihat && (
        <Flyouts
          activeFlyout={activeFlyout}
          anchorRect={flyoutAnchor}
          style={boardState.style}
          shape={boardState.shape}
          tab={boardState.tab}
          onSelectStyle={(newStyle: PenStyle) => {
            if (board) board.updateState({ style: newStyle });
            setActiveFlyout(null);
          }}
          onSelectShape={(newShape: string) => {
            if (board) {
              board.updateState({ shape: newShape });
              board.setTool('shape');
            }
            setActiveFlyout(null);
          }}
          onSelectTab={(newTab: string) => {
            if (board) board.updateState({ tab: newTab });
          }}
          onSelectText={(kind: 'box' | 'h' | 's' | 'b') => {
            board?.setTool('select');
            board?.addText(kind);
            setActiveFlyout(null);
          }}
          onSelectTable={(r: number, c: number) => {
            board?.setTool('select');
            board?.addTable(r, c);
            setActiveFlyout(null);
          }}
          onClose={() => {
            setActiveFlyout(null);
            setFlyoutAnchor(null);
          }}
        />
      )}

      {/* Color Picker HSV */}
      {!isHanyaLihat && (
        <ColorPicker
          isOpen={isColorPickerOpen}
          color={boardState.color}
          anchorRect={colorPickerAnchor}
          onSelectColor={(hex) => {
            if (board) board.updateState({ color: hex });
          }}
          onClose={() => setIsColorPickerOpen(false)}
          onToast={showToast}
        />
      )}

      {/* Text Editor Overlay */}
      <TextEditor
        editor={textEditor}
        view={view}
        onCommit={(ed, val) => board?.commitTextEdit(ed, val)}
        onCancel={() => setTextEditor(null)}
      />

      {/* Toast Alert */}
      <Toast message={toastMsg} />

      {/* Input File Tersembunyi untuk Gambar */}
      <input
        type="file"
        ref={fileImgRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && board) {
            board.addImageFile(f);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}
