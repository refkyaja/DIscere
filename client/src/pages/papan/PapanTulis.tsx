import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import './papan.css';
import { apiRequest } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../lib/auth';
import { Board } from './engine/board';
import { BoardState, BoardView, TextEditorState, ToolType, PenStyle, UbahEventPayload, FormulaObj, Pt, CanvasObj } from './engine/types';
import { COL, LCOL } from './engine/color';
import { downloadPng, downloadPdf, downloadJson, toJson, potongArea, pngDataUrl } from './engine/export';
import {
  TopLeftBar,
  ToolRail,
  OptionsBar,
  TopRightBar,
  ZoomBar,
  Flyouts,
  ColorPicker,
  TextEditor,
  MenuPopup,
  Toast,
  ShareModal,
  PesertaItem,
  AiPopup,
  GameTemplatesPanel,
  computeLassoBounds,
  formatAiResponseForCanvas,
  PromptBar,
  ChatPanel,
  ContextMenu,
  FormulaDialog,
  PageBar,
} from './components';
import { wrap, LampiranObrolan } from './lib/obrol';
import { useObrol } from './lib/useObrol';
import { playTimerAlarm } from './lib/timerAudio';

const PALET_WARNA = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444'];
function getWarnaSocket(socketId: string) {
  let hash = 0;
  for (let i = 0; i < socketId.length; i++) hash = (hash << 5) - hash + socketId.charCodeAt(i);
  return PALET_WARNA[Math.abs(hash) % PALET_WARNA.length];
}

export default function PapanTulis() {
  const { id: boardId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<Board | null>(null);
  const pesertaListRef = useRef<PesertaItem[]>([]);

  // Status & Metadata Papan
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('Papan Pembelajaran Baru');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'busy' | 'error'>('saved');
  const [loadedObjs, setLoadedObjs] = useState<any>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Kolaborasi Real-time & Share Modal
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [pesertaList, setPesertaList] = useState<PesertaItem[]>([]);

  // Tanya AI State
  const [activeLasso, setActiveLasso] = useState<any[] | null>(null);
  const [isAiPopupOpen, setIsAiPopupOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    jawaban: string;
    rumus?: string;
    langkah: string;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // State UI Kanvas
  const [boardState, setBoardState] = useState<BoardState>({
    tool: 'pen',
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isPresentation, setIsPresentation] = useState(false);

  const isGrouped = useMemo(() => {
    if (!boardRef.current || selectedIds.length === 0) return false;
    const objs = boardRef.current.objs.filter((o) => selectedIds.includes(o.id));
    return objs.some((o) => !!o.g);
  }, [selectedIds, boardState]);

  const isLocked = useMemo(() => {
    if (!boardRef.current || selectedIds.length === 0) return false;
    const objs = boardRef.current.objs.filter((o) => selectedIds.includes(o.id));
    return objs.some((o) => !!o.lock);
  }, [selectedIds, boardState]);

  // Popups & Overlays
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeFlyout, setActiveFlyout] = useState<ToolType | null>(null);
  const [flyoutAnchor, setFlyoutAnchor] = useState<DOMRect | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [colorPickerAnchor, setColorPickerAnchor] = useState<DOMRect | null>(null);
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isGamePanelOpen, setIsGamePanelOpen] = useState(false);
  const [panelCategory, setPanelCategory] = useState<'game' | 'alat'>('game');
  const [timerSeconds, setTimerSeconds] = useState(300);
  const [timerTotal, setTimerTotal] = useState(300);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isFormulaOpen, setIsFormulaOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<FormulaObj | null>(null);
  const [formulaPos, setFormulaPos] = useState<Pt | null>(null);

  // File Inputs Ref
  const fileImgRef = useRef<HTMLInputElement>(null);
  const fileJsonRef = useRef<HTMLInputElement>(null);

  // Autosave Timer Ref
  const saveTimeoutRef = useRef<any>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2200);
  }, []);

  // Interval Countdown Timer Kelas
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          playTimerAlarm();
          showToast('Waktu timer habis!');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, showToast]);

  // Simpan Otomatis ke Server dengan Debounce 2 detik
  const triggerAutosave = useCallback(
    (customTitle?: string) => {
      if (!boardId) return;
      setSaveStatus('busy');

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        const board = boardRef.current;
        if (!board) return;

        const currentTitle = customTitle !== undefined ? customTitle : title;
        const jsonString = toJson(board.getFullData());

        try {
          await apiRequest(`/papan/${boardId}`, {
            method: 'PUT',
            body: JSON.stringify({
              judul: currentTitle,
              data: jsonString,
            }),
          });
          setSaveStatus('saved');
          try {
            localStorage.removeItem(`discere-draft-${boardId}`);
          } catch {
            // Abaikan error localStorage
          }
        } catch (err) {
          console.error('Gagal menyimpan papan ke server:', err);
          setSaveStatus('error');
          try {
            localStorage.setItem(
              `discere-draft-${boardId}`,
              JSON.stringify({ judul: currentTitle, data: jsonString, savedAt: Date.now() })
            );
            showToast('Koneksi terganggu. Draf tersimpan di penyimpanan browser.');
          } catch {
            showToast('Gagal menyimpan papan!');
          }
        }
      }, 2000);
    },
    [boardId, title, showToast]
  );

  // 1. Muat data papan dari server
  useEffect(() => {
    if (!boardId) {
      setLoadError('ID papan tidak valid.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadBoardData() {
      try {
        setLoading(true);
        setLoadError(null);
        const res = await apiRequest<{
          board: {
            id: string;
            judul: string;
            data: string;
            ownerId: string;
            updatedAt: string;
          };
        }>(`/papan/${boardId}`);

        if (!isMounted) return;

        const remoteTitle = res.board?.judul || 'Papan Pembelajaran Baru';
        setTitle(remoteTitle);

        let initialData: any = [];
        try {
          const parsed = JSON.parse(res.board?.data || '{}');
          if (parsed && Array.isArray(parsed.pages)) {
            initialData = parsed;
          } else if (parsed && parsed.versi === 1 && Array.isArray(parsed.objs)) {
            initialData = parsed.objs;
          }
        } catch {
          try {
            const draft = localStorage.getItem(`discere-draft-${boardId}`);
            if (draft) {
              const parsedDraft = JSON.parse(draft);
              const dataObj = JSON.parse(parsedDraft.data || '{}');
              if (dataObj && Array.isArray(dataObj.pages)) {
                initialData = dataObj;
                showToast('Memulihkan draf lokal yang tersimpan');
              } else if (dataObj && Array.isArray(dataObj.objs)) {
                initialData = dataObj.objs;
                showToast('Memulihkan draf lokal yang tersimpan');
              }
            }
          } catch {
            initialData = [];
          }
        }

        setLoadedObjs(initialData);
      } catch (err: any) {
        if (!isMounted) return;
        setLoadError(
          err.message || 'Papan tulis tidak ditemukan atau Anda tidak memiliki hak akses.'
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadBoardData();

    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [boardId, showToast]);

  // 2. Hubungkan Socket.IO untuk kolaborasi real-time
  useEffect(() => {
    if (!boardId) return;

    const socket = getSocket();

    pesertaListRef.current = pesertaList;

    function gabungPapan() {
      socket.emit(
        'papan:gabung',
        { boardId, nama: user?.nama || 'Guru', userId: user?.id },
        (res: any) => {
          if (res?.success) {
            setIsReconnecting(false);
            if (res.data?.objs) {
              setLoadedObjs(res.data.objs);
              if (boardRef.current) {
                boardRef.current.replaceObjs(res.data.objs);
              }
            }
            if (res.judul) {
              setTitle(res.judul);
            }
          } else {
            console.warn('[PapanTulis] Gagal bergabung ke sesi realtime:', res?.pesan);
          }
        }
      );
    }

    gabungPapan();

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

      // Tutup editor teks inline jika objek yang sedang diedit dihapus oleh orang lain
      if (ops.hapus && ops.hapus.length > 0) {
        const setHapus = new Set(ops.hapus);
        setTextEditor((prev) => {
          if (prev?.obj && setHapus.has(prev.obj.id)) {
            return null;
          }
          return prev;
        });
      }

      // BAGIAN D: pasang nama kolaborator menempel pada objek yang baru diubah/ditambah
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

      // Hapus badge jika peserta keluar
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

    const handleDisconnect = () => {
      setIsReconnecting(true);
    };

    const handleConnect = () => {
      gabungPapan();
    };

    socket.on('papan:ubah', handleUbah);
    socket.on('papan:peserta', handlePeserta);
    socket.on('papan:coret_live', handleLiveCoret);
    socket.on('papan:coret_selesai', handleLiveCoretSelesai);
    socket.on('papan:geser_live', handleLiveGeser);
    socket.on('papan:geser_selesai', handleLiveGeserSelesai);
    socket.on('papan:hapus_live', handleLiveHapus);
    socket.on('papan:hapus_selesai', handleLiveHapusSelesai);
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
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
    };
  }, [boardId, user]);

  // 3. Inisialisasi engine Board ketika canvas siap dan data terambil
  useEffect(() => {
    if (!loadedObjs || !canvasRef.current) return;

    if (boardRef.current) {
      boardRef.current.destroy();
    }

    const board = new Board(canvasRef.current, loadedObjs, {
      onUbah: (payload: UbahEventPayload) => {
        // Kirim perubahan objek kanvas ke server lewat Socket.IO
        const socket = getSocket();
        socket.emit('papan:ubah', {
          boardId,
          tambah: payload.tambah || [],
          ubah: payload.ubah || [],
          hapus: payload.hapus || [],
        });
        triggerAutosave();
      },
      onLiveCoret: (stroke) => {
        const socket = getSocket();
        socket.emit('papan:coret_live', { boardId, stroke });
      },
      onLiveCoretSelesai: () => {
        const socket = getSocket();
        socket.emit('papan:coret_selesai', { boardId });
      },
      onLiveGeser: (objs) => {
        const socket = getSocket();
        socket.emit('papan:geser_live', { boardId, objs });
      },
      onLiveGeserSelesai: () => {
        const socket = getSocket();
        socket.emit('papan:geser_selesai', { boardId });
      },
      onLiveHapus: (data) => {
        const socket = getSocket();
        socket.emit('papan:hapus_live', { boardId, removedIds: data.removedIds, addedObjs: data.addedObjs });
      },
      onLiveHapusSelesai: () => {
        const socket = getSocket();
        socket.emit('papan:hapus_selesai', { boardId });
      },
      onStateChange: (nextState) => {
        setBoardState({ ...nextState });
      },
      onSelectionChange: (selIds) => {
        setSelectedIds(selIds);
      },
      onViewChange: (nextView) => {
        setView({ ...nextView });
      },
      onHistoryChange: (nextUndo, nextRedo) => {
        setCanUndo(nextUndo);
        setCanRedo(nextRedo);
      },
      onOpenTextEditor: (edState) => {
        setTextEditor(edState);
      },
      onCloseTextEditor: () => {
        setTextEditor(null);
      },
      onContextMenu: (pos) => {
        setContextMenuPos(pos);
      },
      onOpenFormulaDialog: (formulaObj, pos) => {
        setEditingFormula(formulaObj);
        setFormulaPos(pos);
        setIsFormulaOpen(true);
      },
      onLassoChange: (pts) => {
        if (pts && pts.length >= 8) {
          setActiveLasso(pts);
          setIsAiPopupOpen(true);
          setAiResult(null);
          setAiError(null);
        } else {
          setActiveLasso(null);
          setIsAiPopupOpen(false);
        }
      },
      onToast: (m) => {
        showToast(m);
      },
      onPageChange: (activeIdx, total) => {
        setPageIndex(activeIdx);
        setTotalPages(total);
        setIsPresentation(document.body.classList.contains('pres'));
        triggerAutosave();
      },
    });

    boardRef.current = board;
    setBoardState({ ...board.state });
    setView({ ...board.view });
    setCanUndo(board.canUndo());
    setCanRedo(board.canRedo());
    setPageIndex(board.getActivePageIndex());
    setTotalPages(board.pages.length);

    return () => {
      if (boardRef.current) {
        boardRef.current.destroy();
        boardRef.current = null;
        setCanUndo(false);
        setCanRedo(false);
      }
    };
  }, [loadedObjs, boardId, showToast]);

  // Handler Tanya AI: Potong Area -> Kirim ke /api/ai/jawab -> Tempel Kartu di Kanvas
  const handleAskAi = async (pertanyaan: string) => {
    const board = boardRef.current;
    if (!board || !activeLasso || activeLasso.length < 8) return;

    const b = computeLassoBounds(activeLasso);
    const dataUrl = potongArea(board.objs, b, 24);
    if (!dataUrl) {
      setAiError('Gagal memotong area kanvas.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    try {
      const res = await apiRequest<{
        jawaban: string;
        rumus?: string;
        langkah: string;
        dariCache?: boolean;
      }>('/ai/jawab', {
        method: 'POST',
        body: JSON.stringify({
          gambar: dataUrl,
          pertanyaan: pertanyaan.trim() || undefined,
        }),
      });

      setAiResult(res);

      // Otomatis tempel kartu jawaban di kanvas di sebelah kanan area (atau kiri jika tidak muat)
      const formattedText = formatAiResponseForCanvas(res);
      const cardWidth = 340;
      let targetX = b.x + b.w + 24;
      // Jika di kanan terlalu jauh, taruh di kiri area
      if (targetX + cardWidth > 6000) {
        targetX = Math.max(-5000, b.x - cardWidth - 24);
      }
      const targetY = b.y;

      const aiCard = board.addAiCard(formattedText, { x: targetX, y: targetY });
      if (aiCard) {
        showToast(res.dariCache ? 'Kartu jawaban AI dimuat dari cache!' : 'Kartu jawaban AI ditambahkan ke kanvas!');
      }
    } catch (err: any) {
      setAiError(err.message || 'Gagal menghubungi asisten AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCloseAiPopup = () => {
    setIsAiPopupOpen(false);
    setActiveLasso(null);
    setAiResult(null);
    setAiError(null);
    if (boardRef.current) {
      boardRef.current.closeLasso();
      boardRef.current.setTool('select');
    }
  };

  // Hook Obrolan Asisten AI di Papan Tulis
  const {
    pesan: obrolPesan,
    lampiran: obrolLampiran,
    inputTeks: obrolInputTeks,
    setInputTeks: setObrolInputTeks,
    busy: obrolBusy,
    isChatOpen,
    setIsChatOpen,
    tambahLampiran,
    hapusLampiran,
    kirimPesan: kirimObrolan,
    batalkan: batalkanObrolan,
    obrolanBaru,
  } = useObrol(showToast);

  // Handler "Papan saat ini" -> tangkap kanvas dan lampirkan ke obrolan
  const handleSnapCurrentBoard = () => {
    const board = boardRef.current;
    if (!board || board.objs.length === 0) {
      showToast('Papan masih kosong');
      return;
    }
    const dataUrl = pngDataUrl(board.objs);
    if (!dataUrl) {
      showToast('Papan masih kosong');
      return;
    }
    const base64Clean = dataUrl.split(',')[1] || '';
    const lamp: LampiranObrolan = {
      id: crypto.randomUUID(),
      jenis: 'gambar',
      nama: 'Papan saat ini.png',
      mt: 'image/png',
      data: base64Clean,
      thumb: dataUrl,
    };
    tambahLampiran(lamp);
    showToast('Papan saat ini berhasil dilampirkan!');
  };

  // Handler "＋ Tambah ke papan" -> tambahkan kartu catatan dari balasan AI
  const handleAddToBoard = (teks: string) => {
    const board = boardRef.current;
    if (!board) return;
    const cleanSlice = teks.slice(0, 700);
    const wrappedText = wrap(cleanSlice, 38);
    board.addNote(wrappedText, { ai: true, fill: '#fde68a', fs: 22 });
    showToast('Ditambahkan ke papan');
  };

  // Flush Simpan Otomatis Kanvas (Dipanggil sebelum beralih ke game)
  const handleFlushSave = async () => {
    const board = boardRef.current;
    if (!board || !boardId) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    const jsonString = toJson(board.getFullData());
    try {
      await apiRequest(`/papan/${boardId}`, {
        method: 'PUT',
        body: JSON.stringify({ judul: title, data: jsonString }),
      });
      setSaveStatus('saved');
    } catch {
      // Cadangkan ke localStorage jika offline
      try {
        localStorage.setItem(
          `discere-draft-${boardId}`,
          JSON.stringify({ judul: title, data: jsonString, savedAt: Date.now() })
        );
      } catch {}
    }
  };

  // Handler Opsional: Tempel Hasil Game Sesi Terakhir ke Papan
  const handlePasteLastGameResult = async () => {
    const board = boardRef.current;
    if (!board) return;
    try {
      showToast('Mengambil ringkasan hasil game…');
      const res = await apiRequest<{ riwayat: any[] }>('/sesi/riwayat');
      if (res && res.riwayat && res.riwayat.length > 0) {
        const last = res.riwayat[0];
        const pemenang =
          last.timMenang === 'merah'
            ? 'Tim Merah 🔴'
            : last.timMenang === 'putih'
            ? 'Tim Putih ⚪'
            : 'Seri (Sama Kuat)';

        const cardText =
          `🏆 HASIL LOMBA TARIK TAMBANG\n\n` +
          `Materi: ${last.templateJudul}\n` +
          `Mode: ${last.mode}\n` +
          `Pemenang: ${pemenang}\n` +
          `Skor Akhir: Merah ${last.skorMerah} - ${last.skorPutih} Putih\n` +
          `Total Soal: ${last.totalSoal} soal`;

        board.addNote(cardText);
        showToast('Kartu hasil lomba berhasil ditempel ke papan!');
        setIsGamePanelOpen(false);
      } else {
        showToast('Belum ada riwayat sesi game yang selesai.');
      }
    } catch {
      const demoText =
        `🏆 HASIL LOMBA TARIK TAMBANG\n\n` +
        `Materi: Kuis Materi Pembelajaran\n` +
        `Pemenang: Tim Merah 🔴\n` +
        `Skor Akhir: Merah 5 - 3 Putih\n` +
        `Semangat Belajar Bersama!`;
      board.addNote(demoText);
      showToast('Kartu hasil lomba simulasi ditempel ke papan!');
      setIsGamePanelOpen(false);
    }
  };

  // Handler Perubahan Judul (Disimpan via PUT ke server)
  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle);
    if (!boardId) return;
    setSaveStatus('busy');
    try {
      await apiRequest(`/papan/${boardId}`, {
        method: 'PUT',
        body: JSON.stringify({ judul: newTitle }),
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  };

  const handleToolSelect = (tool: ToolType, buttonEl: HTMLElement) => {
    if (tool === 'upload') {
      if (fileImgRef.current) {
        fileImgRef.current.click();
      }
      return;
    }

    if (tool === 'formula') {
      setEditingFormula(null);
      setFormulaPos(null);
      setIsFormulaOpen(true);
      return;
    }

    const wasFlyout = activeFlyout === tool;
    if (boardRef.current) {
      boardRef.current.setTool(tool);
    } else {
      setBoardState((prev) => ({ ...prev, tool }));
    }

    if (['pen', 'shape', 'text', 'table'].includes(tool)) {
      if (wasFlyout) {
        setActiveFlyout(null);
        setFlyoutAnchor(null);
      } else {
        setActiveFlyout(tool);
        setFlyoutAnchor(buttonEl.getBoundingClientRect());
      }
    } else {
      setActiveFlyout(null);
      setFlyoutAnchor(null);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && boardRef.current) {
      for (let i = 0; i < files.length; i++) {
        boardRef.current.addImageFile(files[i]);
      }
    }
    e.target.value = '';
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !boardRef.current) return;

    file.text().then((text) => {
      try {
        const j = JSON.parse(text);
        if (j && Array.isArray(j.pages)) {
          boardRef.current!.pages = j.pages;
          boardRef.current!.goPage(j.currentPageIndex || 0);
          if (j.judul) {
            setTitle(j.judul);
          }
          setPageIndex(boardRef.current!.getActivePageIndex());
          setTotalPages(boardRef.current!.pages.length);
          triggerAutosave(j.judul);
          showToast('Papan slide multi-halaman berhasil dimuat');
        } else if (j && j.versi === 1 && Array.isArray(j.objs)) {
          boardRef.current!.pages = [{ id: crypto.randomUUID(), objs: j.objs, view: { x: 0, y: 0, z: 1 } }];
          boardRef.current!.goPage(0);
          if (j.judul) {
            setTitle(j.judul);
          }
          setPageIndex(0);
          setTotalPages(1);
          triggerAutosave(j.judul);
          showToast('Papan berhasil dimuat dari JSON');
        } else if (j && Array.isArray(j.o)) {
          // Kompatibilitas dengan file json referensi
          boardRef.current!.pages = [{ id: crypto.randomUUID(), objs: j.o, view: { x: 0, y: 0, z: 1 } }];
          boardRef.current!.goPage(0);
          if (j.t) setTitle(j.t);
          setPageIndex(0);
          setTotalPages(1);
          triggerAutosave(j.t);
          showToast('Papan berhasil dimuat dari JSON referensi');
        } else {
          showToast('Format berkas JSON tidak sesuai');
        }
      } catch {
        showToast('Gagal membaca berkas JSON');
      }
    });
    e.target.value = '';
  };

  const board = boardRef.current;

  return (
    <div className="papan">
      {/* Kanvas 2D tak terbatas (selalu dirender di DOM agar canvasRef siap) */}
      <canvas id="cv" ref={canvasRef} className="board-canvas" />

      {/* Overlay status memuat data awal */}
      {loading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div style={{ textAlign: 'center', color: '#eef1fa' }}>
            <div
              style={{
                width: 38,
                height: 38,
                border: '3px solid rgba(255,255,255,0.2)',
                borderTopColor: '#9b17f5',
                borderRadius: '50%',
                margin: '0 auto 14px',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Memuat papan tulis…</h2>
          </div>
        </div>
      )}

      {/* Overlay error memuat */}
      {loadError && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            background: '#0b0f19',
          }}
        >
          <div
            style={{
              maxWidth: 420,
              background: '#1b2238',
              padding: 32,
              borderRadius: 20,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f87171', marginBottom: 8 }}>
              Gagal Membuka Papan
            </h2>
            <p style={{ color: '#8e98b4', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              {loadError}
            </p>
            <button
              onClick={() => navigate('/papan')}
              style={{
                background: '#9b17f5',
                color: '#fff',
                fontWeight: 700,
                padding: '10px 20px',
                borderRadius: 12,
                fontSize: 14,
              }}
            >
              Kembali ke Daftar Papan
            </button>
          </div>
        </div>
      )}

      {/* Top Left Panel: Menu, Logo, Judul, Ekspor PNG, Status Simpan */}
      <TopLeftBar
        title={title}
        saveStatus={saveStatus}
        isReconnecting={isReconnecting}
        onTitleChange={handleTitleChange}
        onOpenMenu={() => setIsMenuOpen(true)}
        onExportPng={() => {
          if (board) {
            downloadPng(board.objs, title);
            showToast('PNG diunduh');
          }
        }}
      />

      {/* Left Vertical Tool Rail */}
      <ToolRail
        activeTool={boardState.tool}
        onSelectTool={handleToolSelect}
      />

      {/* Contextual Options Bar */}
      <OptionsBar
        state={boardState}
        hasSelection={selectedIds.length > 0}
        selectedCount={selectedIds.length}
        isGrouped={isGrouped}
        isLocked={isLocked}
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
        onGroup={() => board?.group()}
        onUngroup={() => board?.ungroup()}
        onCopy={() => board?.copy()}
        onCut={() => board?.cut()}
        onPaste={() => board?.paste()}
        onZOrder={(act) => board?.zOrder(act)}
        onToggleLock={() => board?.toggleLockSelected()}
        onOpenFormula={() => {
          setEditingFormula(null);
          setFormulaPos(null);
          setIsFormulaOpen(true);
        }}
      />

      {/* Top Right Panel: Undo, Redo, Game, Alat Kelas, Avatar, Presentasi, Share */}
      <TopRightBar
        canUndo={canUndo}
        canRedo={canRedo}
        pesertaList={pesertaList}
        isGameOpen={isGamePanelOpen && panelCategory === 'game'}
        isToolsOpen={isGamePanelOpen && panelCategory === 'alat'}
        onUndo={() => boardRef.current?.undo()}
        onRedo={() => boardRef.current?.redo()}
        onPresentation={() => {
          boardRef.current?.setPresentation(true);
          setIsPresentation(true);
        }}
        onOpenShare={() => setIsShareOpen(true)}
        onOpenGame={() => {
          if (isGamePanelOpen && panelCategory === 'game') {
            setIsGamePanelOpen(false);
          } else {
            setPanelCategory('game');
            setIsGamePanelOpen(true);
          }
        }}
        onOpenTools={() => {
          if (isGamePanelOpen && panelCategory === 'alat') {
            setIsGamePanelOpen(false);
          } else {
            setPanelCategory('alat');
            setIsGamePanelOpen(true);
          }
        }}
      />

      {/* Floating Timer Badge saat Panel Tertutup */}
      {(isTimerRunning || (timerSeconds < timerTotal && timerSeconds > 0)) && !isGamePanelOpen && (
        <button
          id="tp"
          type="button"
          className={`floating-timer-badge ${timerSeconds <= 10 && timerSeconds > 0 ? 'red' : ''}`}
          onClick={() => {
            setPanelCategory('alat');
            setIsGamePanelOpen(true);
          }}
          title="Klik untuk membuka alat kelas"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2 2M5 3L2 6M22 6l-3-3M10 2h4" />
          </svg>
          <span>
            {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
            {String(timerSeconds % 60).padStart(2, '0')}
          </span>
        </button>
      )}

      {/* Panel Template Game & Alat Kelas */}
      <GameTemplatesPanel
        isOpen={isGamePanelOpen}
        boardId={boardId || ''}
        initialCategory={panelCategory}
        onClose={() => setIsGamePanelOpen(false)}
        onBeforeStartGame={handleFlushSave}
        onPasteLastGameResult={handlePasteLastGameResult}
        onPasteToBoard={(text) => {
          boardRef.current?.addNote(text);
          showToast('Ditempel ke papan');
        }}
        getBoardPng={() => (boardRef.current ? pngDataUrl(boardRef.current.objs) : null)}
        onToast={showToast}
        timerSeconds={timerSeconds}
        timerTotal={timerTotal}
        isTimerRunning={isTimerRunning}
        onStartTimer={() => {
          if (timerSeconds <= 0) {
            setTimerSeconds(timerTotal);
          }
          setIsTimerRunning(true);
        }}
        onPauseTimer={() => setIsTimerRunning(false)}
        onResetTimer={() => {
          setIsTimerRunning(false);
          setTimerSeconds(timerTotal);
        }}
        onChangeTimerTotal={(sec) => {
          setIsTimerRunning(false);
          setTimerTotal(sec);
          setTimerSeconds(sec);
        }}
      />

      {/* Share Modal Dialog */}
      <ShareModal
        isOpen={isShareOpen}
        boardId={boardId || ''}
        pesertaList={pesertaList}
        onClose={() => setIsShareOpen(false)}
        onToast={showToast}
        onDownloadPng={() => {
          if (board) {
            const ok = downloadPng(board.objs, title);
            if (!ok) showToast('Kanvas masih kosong.');
            else showToast('Foto PNG berhasil diunduh!');
          }
        }}
        onDownloadPdf={() => {
          if (board) {
            const allPages = board.getPages();
            const ok = downloadPdf(allPages && allPages.length > 1 ? allPages : board.objs, title);
            if (!ok) showToast('Kanvas masih kosong.');
            else showToast('Dokumen PDF berhasil diunduh!');
          }
        }}
      />

      {/* Zoom Bar: Zoom in/out, 100%, Grid, Center */}
      <ZoomBar
        zoom={view.z}
        gridEnabled={boardState.grid}
        onZoomIn={() => board?.zoomIn()}
        onZoomOut={() => board?.zoomOut()}
        onResetZoom={() => board?.resetZoom()}
        onToggleGrid={() => board?.toggleGrid()}
        onCenterView={() => board?.centerView()}
      />

      {/* Obrolan Asisten AI & Bar Prompt Bawah (#cw, #chat, #pr) */}
      <ChatPanel
        isOpen={isChatOpen}
        pesan={obrolPesan}
        lampiran={obrolLampiran}
        busy={obrolBusy}
        onClose={() => setIsChatOpen(false)}
        onNewChat={obrolanBaru}
        onCancelBusy={batalkanObrolan}
        onRemoveAttachment={hapusLampiran}
        onAddToBoard={handleAddToBoard}
      />

      <PromptBar
        inputTeks={obrolInputTeks}
        onChangeInput={setObrolInputTeks}
        onSend={() => kirimObrolan()}
        onCancel={batalkanObrolan}
        busy={obrolBusy}
        onAddAttachment={tambahLampiran}
        onSnapCanvas={handleSnapCurrentBoard}
        onToast={showToast}
      />

      {/* Flyout Subpanels (Pena, Bentuk, Teks, Tabel) */}
      <Flyouts
        activeFlyout={activeFlyout}
        anchorRect={flyoutAnchor}
        style={boardState.style}
        shape={boardState.shape}
        tab={boardState.tab}
        onSelectStyle={(newStyle: PenStyle) => {
          if (board) board.updateState({ style: newStyle });
          else setBoardState((prev) => ({ ...prev, style: newStyle }));
          setActiveFlyout(null);
        }}
        onSelectShape={(newShape: string) => {
          if (board) {
            board.updateState({ shape: newShape });
            board.setTool('shape');
          } else {
            setBoardState((prev) => ({ ...prev, shape: newShape, tool: 'shape' }));
          }
          setActiveFlyout(null);
        }}
        onSelectTab={(newTab: string) => {
          if (board) board.updateState({ tab: newTab });
          else setBoardState((prev) => ({ ...prev, tab: newTab }));
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

      {/* Color Picker HSV */}
      <ColorPicker
        isOpen={isColorPickerOpen}
        color={boardState.color}
        anchorRect={colorPickerAnchor}
        onSelectColor={(hex) => {
          if (board) board.updateState({ color: hex });
          else setBoardState((prev) => ({ ...prev, color: hex }));
        }}
        onClose={() => setIsColorPickerOpen(false)}
        onToast={showToast}
      />

      {/* Text Editor Overlay */}
      <TextEditor
        editor={textEditor}
        view={view}
        onCommit={(ed, val) => {
          board?.commitTextEdit(ed, val);
          setTextEditor(null);
        }}
        onCancel={() => setTextEditor(null)}
      />

      {/* Menu Hamburger Popup */}
      <MenuPopup
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onDashboard={() => navigate('/guru')}
        onNewBoard={async () => {
          try {
            const res = await apiRequest<{ board: { id: string } }>('/papan', {
              method: 'POST',
              body: JSON.stringify({ judul: 'Papan Pembelajaran Baru' }),
            });
            if (res.board?.id) {
              navigate(`/papan/${res.board.id}`);
            }
          } catch {
            showToast('Gagal membuat papan baru');
          }
        }}
        onSaveJson={() => {
          if (board) {
            downloadJson(board.getFullData(), title);
            showToast('JSON multi-halaman diunduh');
          }
        }}
        onOpenJson={() => {
          if (fileJsonRef.current) {
            fileJsonRef.current.click();
          }
        }}
        onExportPng={() => {
          if (board) {
            downloadPng(board.objs, title);
            showToast('PNG diunduh');
          }
        }}
        onInsertTemplate={(tpl) => {
          board?.insertTemplate(tpl);
          showToast(`Template ${tpl.toUpperCase()} berhasil disisipkan`);
        }}
        onOpenFormula={() => {
          setEditingFormula(null);
          setFormulaPos(null);
          setIsFormulaOpen(true);
        }}
        onClearAll={() => setShowClearModal(true)}
      />

      {/* Modal Konfirmasi Hapus Semua Isi Papan */}
      {showClearModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3 className="modal-title">Hapus Semua Isi Papan?</h3>
            <p className="modal-desc">
              Semua coretan, gambar, bentuk, dan tabel yang ada di papan saat ini akan dihapus. Anda dapat menggunakan tombol Undo (Ctrl+Z) jika tidak sengaja.
            </p>
            <div className="modal-actions">
              <button
                className="modal-btn-cancel"
                onClick={() => setShowClearModal(false)}
              >
                Batal
              </button>
              <button
                className="modal-btn-danger"
                onClick={() => {
                  board?.clearAll();
                  setShowClearModal(false);
                  showToast('Semua isi papan telah dibersihkan');
                }}
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Tanya AI */}
      <AiPopup
        isOpen={isAiPopupOpen}
        lasso={activeLasso}
        view={view}
        loading={aiLoading}
        responseResult={aiResult}
        errorMessage={aiError}
        onAsk={handleAskAi}
        onClose={handleCloseAiPopup}
      />

      {/* Context Menu (Klik Kanan) */}
      <ContextMenu
        pos={contextMenuPos}
        onClose={() => setContextMenuPos(null)}
        hasSelection={selectedIds.length > 0}
        selectedCount={selectedIds.length}
        isLocked={isLocked}
        isGrouped={isGrouped}
        canPaste={board?.canPaste ?? false}
        onCopy={() => board?.copy()}
        onCut={() => board?.cut()}
        onPaste={() => board?.paste()}
        onDuplicate={() => board?.duplicateSelected()}
        onDelete={() => board?.deleteSelected()}
        onZOrder={(act) => board?.zOrder(act)}
        onToggleLock={() => board?.toggleLockSelected()}
        onGroup={() => board?.group()}
        onUngroup={() => board?.ungroup()}
      />

      {/* Dialog Pembuat & Pengubah Rumus Matematika (LaTeX Ringan) */}
      <FormulaDialog
        isOpen={isFormulaOpen}
        obj={editingFormula}
        pos={formulaPos}
        onClose={() => {
          setIsFormulaOpen(false);
          setEditingFormula(null);
          setFormulaPos(null);
        }}
        onSave={(tex, fs, existing) => {
          board?.addFormula(tex, fs, existing);
          showToast(existing ? 'Rumus matematika diperbarui' : 'Rumus matematika disisipkan');
        }}
      />

      {/* Bilah Manajemen Halaman / Slide & Kontrol Presentasi */}
      <PageBar
        pageIndex={pageIndex}
        totalPages={totalPages}
        isPresentation={isPresentation}
        onPrevPage={() => board?.goPage(pageIndex - 1)}
        onNextPage={() => board?.goPage(pageIndex + 1)}
        onAddPage={() => board?.addPage()}
        onDeletePage={() => board?.deletePage()}
        onDuplicatePage={() => board?.duplicatePage()}
        onSelectPage={(idx) => board?.goPage(idx)}
        onExitPresentation={() => {
          board?.setPresentation(false);
          setIsPresentation(false);
        }}
      />

      {/* Tombol Keluar Mode Presentasi */}
      <button
        id="ex"
        className="btn-exit-pres"
        onClick={() => {
          board?.setPresentation(false);
          setIsPresentation(false);
        }}
      >
        Keluar presentasi (Esc) · Halaman {pageIndex + 1}/{totalPages} · ← →
      </button>

      {/* Toast Notifikasi */}
      <Toast message={toastMsg} />

      {/* Hidden File Inputs */}
      <input
        ref={fileImgRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleImageFileChange}
      />
      <input
        ref={fileJsonRef}
        type="file"
        accept=".json"
        hidden
        onChange={handleJsonFileChange}
      />
    </div>
  );
}
