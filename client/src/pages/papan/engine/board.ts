import {
  CanvasObj,
  BoardView,
  BoardState,
  Pt,
  Bounds,
  LaserPoint,
  TextEditorState,
  ToolType,
  UbahEventPayload,
  TextObj,
  TableObj,
  FormulaObj,
  ConnObj,
  HandleKey,
  BoardPage,
  BoardDataFormat,
} from './types';
import { generateTemplate, TemplateType } from './templates';
import { COL, LCOL } from './color';
import {
  move,
  topAt,
  bounds,
  wb,
  hitSelectionHandle,
  rsz,
  getHandleCursor,
  ubox,
  inUnion,
  intersects,
} from './geometry';
import { eraseSeg } from './eraser';
import { HistoryManager, cloneObj, cloneSet } from './history';
import { drawScene, ensureFontLoaded } from './render';
import { resizeImageToDataUrl } from './export';

export interface BoardOptions {
  hanyaLihat?: boolean;
  onUbah?: (payload: UbahEventPayload) => void;
  onStateChange?: (state: BoardState) => void;
  onSelectionChange?: (selIds: string[], firstId: string | null) => void;
  onViewChange?: (view: BoardView) => void;
  onOpenTextEditor?: (editor: TextEditorState) => void;
  onCloseTextEditor?: () => void;
  onContextMenu?: (pos: { x: number; y: number } | null) => void;
  onOpenFormulaDialog?: (obj: FormulaObj | null, pos: Pt) => void;
  onToast?: (msg: string) => void;
  onLassoChange?: (lasso: Pt[] | null) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onPageChange?: (activePageIndex: number, totalPages: number, pages: BoardPage[]) => void;
}

export class Board {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public objs: CanvasObj[] = [];
  public view: BoardView = { x: 0, y: 0, z: 1 };
  public state: BoardState = {
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
  };

  public sel: string[] = [];
  public marq: Bounds | null = null;
  public lasso: Pt[] | null = null;
  public laser: LaserPoint[] = [];
  public cur: CanvasObj | null = null;
  public cfrom: string | null = null;
  public hov: string | null = null;
  public hanyaLihat = false;
  public pages: BoardPage[] = [];
  public activePageIndex = 0;

  private clip: CanvasObj[] = [];
  private pasteCount = 0;
  private mouse: Pt | null = null;
  private activePointers: Map<number, Pt> = new Map();
  private drag: {
    k: 'pan' | 'er' | 'ai' | 'mv' | 'ls' | 'resize' | 'rot' | 'pinch' | 'mq' | 'conn';
    id?: string;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    p?: Pt;
    p0?: Pt;
    last?: Pt;
    ch?: boolean;
    initialObjsBeforeMove?: CanvasObj[];
    erasedRemoved?: CanvasObj[];
    erasedAdded?: CanvasObj[];
    handleKey?: HandleKey;
    b0?: Bounds;
    r0?: number;
    ids?: string[];
    os?: CanvasObj[];
    pinchDist?: number;
    pinchCenter?: Pt;
  } | null = null;

  private spacePressed = false;
  private prevTool: ToolType | null = null;
  private lastPenTime = 0;
  private noDraw = false;
  private rafId = 0;
  private history: HistoryManager;
  private options: BoardOptions;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    initialData: CanvasObj[] | BoardPage[] | BoardDataFormat = [],
    options: BoardOptions = {}
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context tidak didukung');
    this.ctx = ctx;
    this.options = options;
    this.hanyaLihat = !!options.hanyaLihat;

    // Normalisasi struktur data halaman
    if (Array.isArray(initialData)) {
      if (initialData.length > 0 && 'objs' in initialData[0] && Array.isArray((initialData[0] as any).objs)) {
        this.pages = (initialData as BoardPage[]).map((p) => ({
          id: p.id || crypto.randomUUID(),
          objs: (p.objs || []).map(cloneObj),
          view: p.view ? { ...p.view } : { x: 0, y: 0, z: 1 },
          judul: p.judul,
        }));
      } else {
        this.pages = [
          {
            id: crypto.randomUUID(),
            objs: (initialData as CanvasObj[]).map(cloneObj),
            view: { x: 0, y: 0, z: 1 },
          },
        ];
      }
    } else if (initialData && typeof initialData === 'object') {
      if (Array.isArray(initialData.pages) && initialData.pages.length > 0) {
        this.pages = initialData.pages.map((p) => ({
          id: p.id || crypto.randomUUID(),
          objs: (p.objs || []).map(cloneObj),
          view: p.view ? { ...p.view } : { x: 0, y: 0, z: 1 },
          judul: p.judul,
        }));
        if (
          typeof initialData.currentPageIndex === 'number' &&
          initialData.currentPageIndex >= 0 &&
          initialData.currentPageIndex < this.pages.length
        ) {
          this.activePageIndex = initialData.currentPageIndex;
        }
      } else if (Array.isArray(initialData.objs)) {
        this.pages = [
          {
            id: crypto.randomUUID(),
            objs: initialData.objs.map(cloneObj),
            view: { x: 0, y: 0, z: 1 },
          },
        ];
      }
    }

    if (this.pages.length === 0) {
      this.pages = [{ id: crypto.randomUUID(), objs: [], view: { x: 0, y: 0, z: 1 } }];
    }

    const curPage = this.pages[this.activePageIndex] || this.pages[0];
    this.objs = curPage.objs;
    if (curPage.view) {
      this.view = { ...curPage.view };
    }

    this.history = new HistoryManager(
      (payload) => {
        if (this.options.onUbah) {
          this.options.onUbah(payload);
        }
      },
      (canUndo, canRedo) => {
        if (this.options.onHistoryChange) {
          this.options.onHistoryChange(canUndo, canRedo);
        }
      }
    );

    ensureFontLoaded(() => this.rd());
    this.initCanvasSize();
    this.bindEvents();
    this.rd();
  }

  // --- Utility & Render loop ---
  public rd(): void {
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = 0;
        this.draw();
      });
    }
  }

  private draw(): void {
    drawScene({
      ctx: this.ctx,
      canvas: this.canvas,
      view: this.view,
      state: this.state,
      objs: this.objs,
      cur: this.cur,
      lasso: this.lasso,
      sel: this.sel,
      marq: this.marq,
      laser: this.laser,
      mouse: this.mouse,
      cfrom: this.cfrom,
      hov: this.hov,
      onImageLoad: () => this.rd(),
    });

    // Jika jejak laser masih ada, jadwalkan render frame berikutnya
    if (this.laser.length > 0) {
      const now = performance.now();
      this.laser = this.laser.filter((p) => now - p.t < 900);
      if (this.laser.length > 0) {
        this.rd();
      }
    }
  }

  public toWorld(clientX: number, clientY: number): Pt {
    const r = this.canvas.getBoundingClientRect();
    const cx = clientX - r.left;
    const cy = clientY - r.top;
    return {
      x: (cx - this.view.x) / this.view.z,
      y: (cy - this.view.y) / this.view.z,
    };
  }

  public getCenter(): Pt {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    return {
      x: (w / 2 - this.view.x) / this.view.z,
      y: (h / 2 - this.view.y) / this.view.z,
    };
  }

  public toast(msg: string): void {
    if (this.options.onToast) {
      this.options.onToast(msg);
    }
  }

  // --- Setting State & Tool ---
  public setTool(tool: ToolType): void {
    if (this.hanyaLihat && tool !== 'hand' && tool !== 'laser') {
      this.toast('Mode Viewer: Hanya melihat kanvas');
      return;
    }
    this.closeLasso();
    if (tool !== 'conn') {
      this.cfrom = null;
      this.hov = null;
    }
    this.state.tool = tool;
    if (tool !== 'select') {
      this.setSelection(null);
    }

    const cursorMap: Record<string, string> = {
      hand: 'grab',
      eraser: 'none',
      select: 'default',
      text: 'text',
      pick: 'copy',
      laser: 'crosshair',
    };
    this.canvas.style.cursor = cursorMap[tool] || 'crosshair';

    this.notifyState();
    this.rd();
  }

  public updateState(patch: Partial<BoardState>): void {
    Object.assign(this.state, patch);
    this.notifyState();
    this.rd();
  }

  private notifyState(): void {
    if (this.options.onStateChange) {
      this.options.onStateChange({ ...this.state });
    }
  }

  public get selId(): string | null {
    return this.sel[0] || null;
  }

  public selObjs(): CanvasObj[] {
    return this.objs.filter((o) => this.sel.includes(o.id));
  }

  public xform(): { b: Bounds; r: number; A: CanvasObj[] } | null {
    const A = this.selObjs().filter((o) => !o.lock);
    if (A.length === 0) return null;
    if (A.length === 1) {
      return { b: bounds(A[0]), r: A[0].rot || 0, A };
    }
    return { b: ubox(A), r: 0, A };
  }

  public setSelection(idOrIds: string[] | string | null): void {
    const nextSel = Array.isArray(idOrIds)
      ? idOrIds
      : idOrIds
      ? [idOrIds]
      : [];
    const same =
      this.sel.length === nextSel.length &&
      this.sel.every((id, idx) => id === nextSel[idx]);
    if (!same) {
      this.sel = nextSel;
      if (this.options.onSelectionChange) {
        this.options.onSelectionChange(this.sel, this.selId);
      }
      this.rd();
    }
  }

  // --- Zoom & View ---
  public zoomAt(sx: number, sy: number, f: number): void {
    const z = Math.max(0.1, Math.min(4, this.view.z * f));
    const k = z / this.view.z;
    this.view.x = sx - (sx - this.view.x) * k;
    this.view.y = sy - (sy - this.view.y) * k;
    this.view.z = z;
    if (this.options.onViewChange) {
      this.options.onViewChange({ ...this.view });
    }
    this.rd();
  }

  public zoomIn(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.zoomAt(w / 2, h / 2, 1.25);
  }

  public zoomOut(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.zoomAt(w / 2, h / 2, 0.8);
  }

  public resetZoom(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.zoomAt(w / 2, h / 2, 1 / this.view.z);
  }

  public centerView(): void {
    this.view = { x: 0, y: 0, z: 1 };
    if (this.options.onViewChange) {
      this.options.onViewChange({ ...this.view });
    }
    this.rd();
  }

  public toggleGrid(): void {
    this.state.grid = !this.state.grid;
    this.notifyState();
    this.rd();
  }

  // --- Undo, Redo, Commit, Terapan Ops Luar ---
  public canUndo(): boolean {
    return this.history.canUndo();
  }

  public canRedo(): boolean {
    return this.history.canRedo();
  }

  public undo(): void {
    if (this.hanyaLihat) return;
    const res = this.history.undo(this.objs);
    if (res.reverted) {
      this.objs = res.newObjs;
      this.setSelection(null);
      this.rd();
    }
  }

  public redo(): void {
    if (this.hanyaLihat) return;
    const res = this.history.redo(this.objs);
    if (res.reapplied) {
      this.objs = res.newObjs;
      if (this.sel.length > 0) {
        this.setSelection(this.sel.filter((id) => this.objs.some((o) => o.id === id)));
      }
      this.rd();
    }
  }

  public terapkanOps(ops: UbahEventPayload): void {
    let changed = false;
    let list = [...this.objs];

    if (ops.hapus && ops.hapus.length > 0) {
      const setHapus = new Set(ops.hapus);
      list = list.filter((o) => !setHapus.has(o.id));
      changed = true;
    }

    if (ops.ubah && ops.ubah.length > 0) {
      const mapUbah = new Map(ops.ubah.map((u) => [u.id, u]));
      list = list.map((o) => {
        const pengganti = mapUbah.get(o.id);
        return pengganti ? cloneObj(pengganti) : o;
      });
      changed = true;
    }

    if (ops.tambah && ops.tambah.length > 0) {
      const existingIds = new Set(list.map((o) => o.id));
      for (const t of ops.tambah) {
        if (!existingIds.has(t.id)) {
          list.push(cloneObj(t));
          existingIds.add(t.id);
        }
      }
      changed = true;
    }

    if (changed) {
      if (ops.reorder && ops.reorder.length > 0) {
        const orderMap = new Map(ops.reorder.map((id, index) => [id, index]));
        list.sort((a, b) => {
          const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
          const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
          return idxA - idxB;
        });
        changed = true;
      }

      this.objs = list;
      this.rd();
    }
  }

  // --- Manipulasi Objek (Duplikat, Hapus, Copy, Cut, Paste, Group, Ungroup) ---
  public deleteSelected(): void {
    if (this.hanyaLihat || this.sel.length === 0) return;
    const targets = this.selObjs();
    if (targets.length === 0) return;
    const targetIds = new Set(targets.map((o) => o.id));
    this.objs = this.objs.filter((o) => !targetIds.has(o.id));
    this.history.commit({ hapus: targets });
    this.setSelection([]);
    this.rd();
  }

  public duplicateSelected(): void {
    if (this.hanyaLihat || this.sel.length === 0) return;
    const targets = this.selObjs();
    if (targets.length === 0) return;
    const cloned = cloneSet(targets, 24, 24);
    this.objs.push(...cloned);
    this.setSelection(cloned.map((o) => o.id));
    this.history.commit({ tambah: cloned });
    this.rd();
  }

  public copy(): void {
    const targets = this.selObjs();
    if (targets.length === 0) return;
    this.clip = targets.map(cloneObj);
    this.pasteCount = 0;
    this.toast(`${targets.length} objek disalin`);
  }

  public cut(): void {
    if (this.hanyaLihat || this.sel.length === 0) return;
    this.copy();
    this.deleteSelected();
  }

  public paste(): void {
    if (this.hanyaLihat || this.clip.length === 0) return;
    this.pasteCount++;
    const cloned = cloneSet(this.clip, 24 * this.pasteCount, 24 * this.pasteCount);
    this.objs.push(...cloned);
    this.setSelection(cloned.map((o) => o.id));
    this.history.commit({ tambah: cloned });
    this.toast(`${cloned.length} objek ditempel`);
    this.rd();
  }

  public group(): void {
    if (this.hanyaLihat) return;
    const targets = this.selObjs();
    if (targets.length < 2) {
      this.toast('Pilih minimal 2 objek untuk dikelompokkan');
      return;
    }
    const groupId = 'g_' + crypto.randomUUID().slice(0, 8);
    const sebelum = targets.map(cloneObj);
    targets.forEach((o) => {
      o.g = groupId;
    });
    this.history.commit({
      ubah: sebelum.map((s, idx) => ({ sebelum: s, sesudah: cloneObj(targets[idx]) })),
    });
    this.toast(`${targets.length} objek dikelompokkan`);
    this.rd();
  }

  public ungroup(): void {
    if (this.hanyaLihat) return;
    const targets = this.selObjs().filter((o) => o.g);
    if (targets.length === 0) {
      this.toast('Objek yang dipilih tidak dalam grup');
      return;
    }
    const sebelum = targets.map(cloneObj);
    targets.forEach((o) => {
      delete o.g;
    });
    this.history.commit({
      ubah: sebelum.map((s, idx) => ({ sebelum: s, sesudah: cloneObj(targets[idx]) })),
    });
    this.toast('Grup dilepas');
    this.rd();
  }

  public zOrder(action: 'front' | 'back' | 'fwd' | 'bwd'): void {
    if (this.hanyaLihat || this.sel.length === 0) return;
    const I = new Set(this.sel);
    const s = this.objs.filter((o) => I.has(o.id));
    if (s.length === 0) return;

    const prevOrder = this.objs.map((o) => o.id);

    if (action === 'front') {
      this.objs = this.objs.filter((o) => !I.has(o.id)).concat(s);
    } else if (action === 'back') {
      this.objs = s.concat(this.objs.filter((o) => !I.has(o.id)));
    } else if (action === 'fwd') {
      for (let i = this.objs.length - 2; i >= 0; i--) {
        if (I.has(this.objs[i].id) && !I.has(this.objs[i + 1].id)) {
          const temp = this.objs[i];
          this.objs[i] = this.objs[i + 1];
          this.objs[i + 1] = temp;
        }
      }
    } else if (action === 'bwd') {
      for (let i = 1; i < this.objs.length; i++) {
        if (I.has(this.objs[i].id) && !I.has(this.objs[i - 1].id)) {
          const temp = this.objs[i];
          this.objs[i] = this.objs[i - 1];
          this.objs[i - 1] = temp;
        }
      }
    }

    const nextOrder = this.objs.map((o) => o.id);
    const changed = prevOrder.some((id, idx) => id !== nextOrder[idx]);
    if (changed) {
      this.history.commit({
        reorder: {
          sebelum: prevOrder,
          sesudah: nextOrder,
        },
      });
      this.rd();
    }
  }

  public toggleLockSelected(): void {
    if (this.hanyaLihat || this.sel.length === 0) return;
    const targets = this.selObjs();
    if (targets.length === 0) return;

    const targetLock = !targets.some((o) => o.lock);
    const sebelum = targets.map(cloneObj);
    targets.forEach((o) => {
      o.lock = targetLock;
    });

    if (targetLock) {
      this.setSelection([]);
    }

    this.history.commit({
      ubah: sebelum.map((s, idx) => ({ sebelum: s, sesudah: cloneObj(targets[idx]) })),
    });
    this.toast(targetLock ? `${targets.length} objek dikunci` : 'Objek dibuka kuncinya');
    this.rd();
  }

  public get canPaste(): boolean {
    return this.clip.length > 0;
  }

  public get hasLockedSelected(): boolean {
    return this.selObjs().some((o) => !!o.lock);
  }

  public clearAll(): void {
    if (this.hanyaLihat || this.objs.length === 0) return;
    const hapusSemua = [...this.objs];
    this.objs = [];
    this.setSelection(null);
    this.history.commit({ hapus: hapusSemua });
    this.rd();
  }

  public addNote(
    text: string,
    options?: { ai?: boolean; fill?: string; fs?: number }
  ): TextObj | null {
    if (this.hanyaLihat) return null;
    const c = this.getCenter();
    const cleanText = text.slice(0, 5000);
    const isAi = options?.ai ?? false;
    const o: TextObj = {
      id: crypto.randomUUID(),
      type: 'text',
      x: c.x - 80 + Math.random() * 40,
      y: c.y - 60 + Math.random() * 40,
      text: cleanText,
      fs: options?.fs ?? 22,
      color: '#111827',
      fill: options?.fill ?? (isAi ? '#fde68a' : '#fde68a'),
      size: 1,
      ai: isAi,
    };
    this.objs.push(o);
    this.setSelection(o.id);
    this.history.commit({ tambah: [o] });
    this.rd();
    return o;
  }

  public addAiCard(text: string, pos: Pt): TextObj | null {
    if (this.hanyaLihat) return null;
    const cleanText = text.slice(0, 5000);
    const o: TextObj = {
      id: crypto.randomUUID(),
      type: 'text',
      x: pos.x,
      y: pos.y,
      text: cleanText,
      fs: 17,
      fw: 600,
      color: '#78350f',
      fill: '#fef3c7',
      size: 1,
      ai: true,
    };
    this.objs.push(o);
    this.setSelection(o.id);
    this.history.commit({ tambah: [o] });
    this.rd();
    return o;
  }

  public addText(kind: 'box' | 'h' | 's' | 'b'): void {
    if (this.hanyaLihat) return;
    const defs: Record<string, [string, number, number]> = {
      box: ['Teks baru', 24, 600],
      h: ['Judul', 48, 800],
      s: ['Subjudul', 32, 700],
      b: ['Teks isi', 20, 500],
    };
    const [t, fs, fw] = defs[kind] || defs.box;
    const c = this.getCenter();
    const o: TextObj = {
      id: crypto.randomUUID(),
      type: 'text',
      x: c.x - 80,
      y: c.y - 30,
      text: t,
      fs,
      fw,
      color: this.state.color,
      fill: null,
      size: 1,
    };
    this.objs.push(o);
    this.setSelection(o.id);
    this.history.commit({ tambah: [o] });
    this.rd();

    if (this.options.onOpenTextEditor) {
      this.options.onOpenTextEditor({
        obj: o,
        x: o.x,
        y: o.y,
        text: o.text,
      });
    }
  }

  public addTable(rows: number, cols: number): void {
    if (this.hanyaLihat) return;
    const c = this.getCenter();
    const o: TableObj = {
      id: crypto.randomUUID(),
      type: 'table',
      x: c.x - cols * 60,
      y: c.y - rows * 22,
      rows,
      cols,
      cw: 120,
      ch: 44,
      cells: {},
      color: this.state.color,
      size: 2,
      fill: null,
    };
    this.objs.push(o);
    this.setSelection(o.id);
    this.history.commit({ tambah: [o] });
    this.rd();
  }

  public async addImageFile(file: File, atWorldPos?: Pt): Promise<void> {
    if (this.hanyaLihat) return;
    try {
      const resized = await resizeImageToDataUrl(file);
      const c = atWorldPos || this.getCenter();
      const k = Math.min(1, 360 / resized.w);
      const o: CanvasObj = {
        id: crypto.randomUUID(),
        type: 'image',
        src: resized.src,
        x: c.x - (resized.w * k) / 2,
        y: c.y - (resized.h * k) / 2,
        w: resized.w * k,
        h: resized.h * k,
        color: '#000000',
        size: 1,
      };
      this.objs.push(o);
      this.setSelection(o.id);
      this.history.commit({ tambah: [o] });
      this.rd();
    } catch (err: any) {
      this.toast(err.message || 'Gagal menambahkan gambar');
    }
  }

  public makeConnection(sourceId: string, targetId: string): void {
    if (this.hanyaLihat) return;
    if (sourceId === targetId) return;

    const exists = this.objs.some(
      (o) =>
        o.type === 'conn' &&
        ((o.a === sourceId && o.b === targetId) || (o.a === targetId && o.b === sourceId))
    );
    if (exists) {
      this.toast('Kedua objek sudah terhubung');
      return;
    }

    const o: ConnObj = {
      id: crypto.randomUUID(),
      type: 'conn',
      a: sourceId,
      b: targetId,
      color: this.state.color,
      size: this.state.ss || 3,
      op: this.state.op ?? 1,
      ar: this.state.cs !== 'line',
    };
    this.objs.push(o);
    this.history.commit({ tambah: [o] });
    this.toast('Terhubung ✓');
    this.rd();
  }

  public insertTemplate(kind: TemplateType): void {
    if (this.hanyaLihat) return;
    const items = generateTemplate(kind);
    if (items.length === 0) return;

    const c = this.getCenter();
    let minX = 1e9,
      minY = 1e9,
      maxX = -1e9,
      maxY = -1e9;
    items.forEach((o) => {
      const r = bounds(o, items);
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    });

    const dx = c.x - (minX + maxX) / 2;
    const dy = c.y - (minY + maxY) / 2;
    items.forEach((o) => move(o, dx, dy));

    this.objs.push(...items);
    this.setTool('select');
    this.setSelection(items.map((o) => o.id));

    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const targetW = Math.max(100, maxX - minX);
    const targetH = Math.max(100, maxY - minY);
    const z = Math.min(1, Math.max(0.4, Math.min((w - 240) / targetW, (h - 200) / targetH)));

    this.view.z = z;
    this.view.x = w / 2 - c.x * z;
    this.view.y = h / 2 - c.y * z;
    if (this.options.onViewChange) {
      this.options.onViewChange({ ...this.view });
    }

    this.history.commit({ tambah: items });
    this.toast(`Template ${kind.toUpperCase()} berhasil dimuat`);
    this.rd();
  }

  public addFormula(tex: string, fs = 32, existingObj?: FormulaObj): FormulaObj | null {
    if (this.hanyaLihat) return null;
    const cleanTex = tex.trim();
    if (!cleanTex) return null;

    if (existingObj) {
      const sebelum = cloneObj(existingObj);
      existingObj.tex = cleanTex;
      existingObj.fs = fs;
      this.history.commit({ ubah: [{ sebelum, sesudah: cloneObj(existingObj) }] });
      this.rd();
      return existingObj;
    }

    const c = this.getCenter();
    const o: FormulaObj = {
      id: crypto.randomUUID(),
      type: 'formula',
      x: c.x - 60,
      y: c.y - 20,
      tex: cleanTex,
      fs,
      color: this.state.color === '#ffffff' ? '#111827' : this.state.color,
      size: 1,
    };
    this.objs.push(o);
    this.setSelection(o.id);
    this.history.commit({ tambah: [o] });
    this.toast('Rumus matematika ditambahkan');
    this.rd();
    return o;
  }

  public commitTextEdit(editor: TextEditorState, value: string): void {
    if (this.hanyaLihat) return;
    const trimmed = value.slice(0, 5000);

    if (editor.obj && editor.r !== undefined && editor.c !== undefined) {
      const tbl = editor.obj as TableObj;
      const key = `${editor.r},${editor.c}`;
      const sebelum = cloneObj(tbl);
      if (trimmed.trim()) {
        tbl.cells[key] = trimmed;
      } else {
        delete tbl.cells[key];
      }
      this.history.commit({ ubah: [{ sebelum, sesudah: cloneObj(tbl) }] });
    } else if (editor.obj) {
      const txtObj = editor.obj as TextObj;
      if (trimmed.trim()) {
        const sebelum = cloneObj(txtObj);
        txtObj.text = trimmed;
        this.history.commit({ ubah: [{ sebelum, sesudah: cloneObj(txtObj) }] });
      } else {
        this.objs = this.objs.filter((x) => x !== txtObj);
        this.history.commit({ hapus: [txtObj] });
        if (this.sel.includes(txtObj.id)) {
          this.setSelection(this.sel.filter((id) => id !== txtObj.id));
        }
      }
    } else if (trimmed.trim()) {
      const o: TextObj = {
        id: crypto.randomUUID(),
        type: 'text',
        x: editor.x,
        y: editor.y,
        text: trimmed,
        fs: this.state.fs,
        color: this.state.color,
        fill: null,
        size: 1,
      };
      this.objs.push(o);
      this.setSelection(o.id);
      this.history.commit({ tambah: [o] });
    }

    this.rd();
  }

  // --- Tanya AI Lasso ---
  public closeLasso(): void {
    this.lasso = null;
    if (this.options.onLassoChange) {
      this.options.onLassoChange(null);
    }
    this.rd();
  }

  // --- Mode Presentasi & Halaman ---
  public setPresentation(on: boolean): void {
    document.body.classList.toggle('pres', on);
    if (on) {
      this.prevTool = this.state.tool;
      this.setTool('laser');
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      if (this.prevTool) {
        this.setTool(this.prevTool);
        this.prevTool = null;
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
    if (this.options.onPageChange) {
      this.options.onPageChange(this.activePageIndex, this.pages.length, this.pages);
    }
  }

  // --- Manajemen Halaman / Slide ---
  public getPages(): BoardPage[] {
    this.saveCurrentPageSnapshot();
    return this.pages;
  }

  public getActivePageIndex(): number {
    return this.activePageIndex;
  }

  public saveCurrentPageSnapshot(): void {
    if (this.pages[this.activePageIndex]) {
      this.pages[this.activePageIndex].objs = this.objs;
      this.pages[this.activePageIndex].view = { ...this.view };
    }
  }

  public goPage(index: number): boolean {
    if (index < 0 || index >= this.pages.length || index === this.activePageIndex) {
      return false;
    }
    this.saveCurrentPageSnapshot();
    this.activePageIndex = index;
    const targetPage = this.pages[index];
    this.objs = targetPage.objs;
    if (targetPage.view) {
      this.view = { ...targetPage.view };
    }
    this.setSelection(null);
    this.closeLasso();
    this.history.clear();
    this.rd();
    if (this.options.onPageChange) {
      this.options.onPageChange(this.activePageIndex, this.pages.length, this.pages);
    }
    if (this.options.onViewChange) {
      this.options.onViewChange(this.view);
    }
    if (this.options.onHistoryChange) {
      this.options.onHistoryChange(this.canUndo(), this.canRedo());
    }
    return true;
  }

  public addPage(): void {
    this.saveCurrentPageSnapshot();
    const newPage: BoardPage = {
      id: crypto.randomUUID(),
      objs: [],
      view: { x: 0, y: 0, z: 1 },
    };
    const nextIdx = this.activePageIndex + 1;
    this.pages.splice(nextIdx, 0, newPage);
    this.goPage(nextIdx);
    this.toast(`Halaman ${this.activePageIndex + 1} ditambahkan`);
  }

  public deletePage(index?: number): boolean {
    if (this.pages.length <= 1) {
      this.toast('Minimal harus ada satu halaman');
      return false;
    }
    const idx = index !== undefined ? index : this.activePageIndex;
    this.saveCurrentPageSnapshot();
    this.pages.splice(idx, 1);
    const nextIdx = Math.min(idx, this.pages.length - 1);
    this.activePageIndex = nextIdx;
    const targetPage = this.pages[nextIdx];
    this.objs = targetPage.objs;
    if (targetPage.view) {
      this.view = { ...targetPage.view };
    }
    this.setSelection(null);
    this.closeLasso();
    this.history.clear();
    this.rd();
    if (this.options.onPageChange) {
      this.options.onPageChange(this.activePageIndex, this.pages.length, this.pages);
    }
    if (this.options.onViewChange) {
      this.options.onViewChange(this.view);
    }
    if (this.options.onHistoryChange) {
      this.options.onHistoryChange(this.canUndo(), this.canRedo());
    }
    this.toast('Halaman dihapus');
    return true;
  }

  public duplicatePage(index?: number): void {
    const idx = index !== undefined ? index : this.activePageIndex;
    this.saveCurrentPageSnapshot();
    const sourcePage = this.pages[idx];
    const dupPage: BoardPage = {
      id: crypto.randomUUID(),
      objs: sourcePage.objs.map(cloneObj),
      view: sourcePage.view ? { ...sourcePage.view } : { x: 0, y: 0, z: 1 },
      judul: sourcePage.judul ? `${sourcePage.judul} (Salinan)` : undefined,
    };
    this.pages.splice(idx + 1, 0, dupPage);
    this.goPage(idx + 1);
    this.toast(`Halaman digandakan`);
  }

  public getFullData(): BoardDataFormat {
    this.saveCurrentPageSnapshot();
    return {
      versi: 2,
      pages: this.pages.map((p) => ({
        ...p,
        objs: p.objs.map(cloneObj),
        view: p.view ? { ...p.view } : undefined,
      })),
      currentPageIndex: this.activePageIndex,
    };
  }

  // --- Event Handlers Pointer & Window ---
  private initCanvasSize(): void {
    const d = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = w * d;
    this.canvas.height = h * d;
  }

  private handleResize = (): void => {
    this.initCanvasSize();
    this.rd();
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (e.button === 2) return; // Right click

    if (e.pointerType === 'pen') {
      this.lastPenTime = performance.now();
    }

    if (e.pointerType === 'touch') {
      // Palm rejection: tolak sentuhan telapak tangan jika pena baru saja menyentuh layar (< 1.2 detik)
      if (performance.now() - this.lastPenTime < 1200) {
        return;
      }

      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Deteksi gestur dua jari layar sentuh: Pan & Pinch Zoom
      if (this.activePointers.size >= 2) {
        this.cur = null;
        this.drag = null;
        if (this.lasso) this.closeLasso();
        this.marq = null;
        this.noDraw = true;

        const pts = Array.from(this.activePointers.values());
        const p1 = pts[0];
        const p2 = pts[1];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        this.drag = {
          k: 'pinch',
          pinchDist: Math.max(1, dist),
          pinchCenter: center,
        };
        this.canvas.style.cursor = 'grab';
        this.rd();
        return;
      }
    } else {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (this.noDraw) return;
    if (this.activePointers.size > 2) return;

    if (this.options.onContextMenu) {
      this.options.onContextMenu(null);
    }
    if (this.options.onCloseTextEditor) {
      this.options.onCloseTextEditor();
    }
    if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      (document.activeElement as HTMLElement).blur();
    }
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Abaikan jika pointer capture gagal
    }

    const p = this.toWorld(e.clientX, e.clientY);
    const t = this.state.tool;

    // Pan dengan tombol tengah, tool Tangan, atau Spasi ditahan
    if (e.button === 1 || t === 'hand' || this.spacePressed) {
      this.drag = {
        k: 'pan',
        x: e.clientX,
        y: e.clientY,
        vx: this.view.x,
        vy: this.view.y,
      };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (t === 'laser') {
      this.drag = { k: 'ls' };
      this.laser.push({ ...p, t: performance.now() });
      this.rd();
      return;
    }

    if (t === 'zoom') {
      const r = this.canvas.getBoundingClientRect();
      this.zoomAt(e.clientX - r.left, e.clientY - r.top, e.shiftKey ? 1 / 1.4 : 1.4);
      return;
    }

    // Jika mode hanya lihat, tolak semua aksi pengubahan di bawah ini
    if (this.hanyaLihat) {
      this.toast('Mode Viewer: Anda tidak memiliki izin mengedit papan ini');
      return;
    }

    if (t === 'pen') {
      const pt: Pt = e.pointerType === 'pen' ? { ...p, pr: e.pressure } : p;
      this.cur = {
        id: crypto.randomUUID(),
        type: 'stroke',
        pts: [pt],
        color: this.state.color,
        size: this.state.size,
        st: this.state.style,
        op: this.state.op,
      };
    } else if (t === 'eraser') {
      this.drag = {
        k: 'er',
        ch: false,
        last: p,
        erasedAdded: [],
        erasedRemoved: [],
      };
      const res = eraseSeg(this.objs, p, p, this.state.er / 2);
      if (res.changed) {
        this.objs = res.newObjs;
        this.drag.ch = true;
        this.drag.erasedAdded!.push(...res.added);
        this.drag.erasedRemoved!.push(...res.removed);
      }
    } else if (t === 'select') {
      const X = this.xform();
      if (X) {
        const handle = hitSelectionHandle(X.b, X.r, p, this.view.z);
        if (handle) {
          if (handle.k === 'rot') {
            this.drag = {
              k: 'rot',
              b0: X.b,
              r0: X.r,
              ids: X.A.map((o) => o.id),
              os: X.A.map(cloneObj),
              ch: false,
            };
            this.canvas.style.cursor = 'grabbing';
          } else {
            this.drag = {
              k: 'resize',
              handleKey: handle.k,
              b0: X.b,
              r0: X.r,
              ids: X.A.map((o) => o.id),
              os: X.A.map(cloneObj),
              ch: false,
            };
            this.canvas.style.cursor = getHandleCursor(handle.k, X.r);
          }
          this.rd();
          return;
        }
      }

      const o = topAt(this.objs, p, 6 / this.view.z);
      if (o) {
        const groupIds = o.g ? this.objs.filter((x) => x.g === o.g).map((x) => x.id) : [o.id];
        if (e.shiftKey) {
          const hasAll = groupIds.every((i) => this.sel.includes(i));
          const nextSel = hasAll
            ? this.sel.filter((i) => !groupIds.includes(i))
            : [...new Set(this.sel.concat(groupIds))];
          this.setSelection(nextSel);
        } else if (!this.sel.includes(o.id)) {
          this.setSelection(groupIds);
        }

        const activeSelected = this.selObjs();
        if (activeSelected.length > 0) {
          this.drag = {
            k: 'mv',
            p,
            ch: false,
            initialObjsBeforeMove: activeSelected.map(cloneObj),
          };
        }
      } else if (inUnion(this.selObjs(), p)) {
        this.drag = {
          k: 'mv',
          p,
          ch: false,
          initialObjsBeforeMove: this.selObjs().map(cloneObj),
        };
      } else {
        if (!e.shiftKey) {
          this.setSelection([]);
        }
        this.drag = {
          k: 'mq',
          p0: p,
        };
        this.marq = { x: p.x, y: p.y, w: 0, h: 0 };
      }
    } else if (t === 'shape') {
      this.cur = {
        id: crypto.randomUUID(),
        type: 'shape',
        kind: this.state.shape,
        x: p.x,
        y: p.y,
        w: 0,
        h: 0,
        color: this.state.color,
        size: this.state.ss,
        op: this.state.op,
        fill: null,
      };
    } else if (t === 'text') {
      if (this.options.onOpenTextEditor) {
        this.options.onOpenTextEditor({
          obj: null,
          x: p.x,
          y: p.y,
          text: '',
        });
      }
    } else if (t === 'table') {
      const n = this.state.tsz;
      const o: TableObj = {
        id: crypto.randomUUID(),
        type: 'table',
        x: p.x - 60,
        y: p.y - 22,
        rows: n,
        cols: n,
        cw: 120,
        ch: 44,
        cells: {},
        color: this.state.color,
        size: 2,
        fill: null,
      };
      this.objs.push(o);
      this.setSelection(o.id);
      this.history.commit({ tambah: [o] });
    } else if (t === 'fill') {
      const o = topAt(this.objs, p, 2 / this.view.z);
      if (o && (o.type === 'shape' || o.type === 'text' || o.type === 'table')) {
        const sebelum = cloneObj(o);
        o.fill = this.state.fill || null;
        this.history.commit({ ubah: [{ sebelum, sesudah: cloneObj(o) }] });
      } else if (o) {
        this.toast('Isi warna hanya untuk bentuk, teks, dan tabel');
      }
    } else if (t === 'pick') {
      const o = topAt(this.objs, p, 4 / this.view.z);
      if (o) {
        const c =
          o.type === 'stroke' || (o.type === 'text' && !o.fill)
            ? o.color
            : 'fill' in o && o.fill
            ? o.fill
            : o.color;
        this.state.color = c;
        this.setTool('pen');
        this.toast(`Warna diambil: ${c}`);
      }
    } else if (t === 'ai') {
      this.lasso = [p];
      this.drag = { k: 'ai' };
    } else if (t === 'conn') {
      const o = topAt(this.objs, p, 12 / this.view.z);
      if (o && o.type !== 'conn') {
        if (this.cfrom && this.cfrom !== o.id) {
          this.makeConnection(this.cfrom, o.id);
          this.cfrom = null;
          this.hov = null;
        } else if (this.cfrom === o.id) {
          this.cfrom = null;
        } else {
          this.cfrom = o.id;
          this.drag = { k: 'conn', id: o.id, p };
        }
      } else {
        this.cfrom = null;
      }
    } else if (t === 'formula') {
      if (this.options.onOpenFormulaDialog) {
        this.options.onOpenFormulaDialog(null, p);
      }
    }

    this.rd();
  };

  private handlePointerMove = (e: PointerEvent): void => {
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Gestur 2 Jari Layar Sentuh: Pan & Pinch Zoom
    if (this.drag && this.drag.k === 'pinch' && this.activePointers.size >= 2) {
      const pts = Array.from(this.activePointers.values());
      const p1 = pts[0];
      const p2 = pts[1];
      const curDist = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const curCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      const prevDist = this.drag.pinchDist || curDist;
      const prevCenter = this.drag.pinchCenter || curCenter;

      // Geser (Pan)
      const dx = curCenter.x - prevCenter.x;
      const dy = curCenter.y - prevCenter.y;
      this.view.x += dx;
      this.view.y += dy;

      // Pinch Zoom
      const scaleFactor = curDist / prevDist;
      const r = this.canvas.getBoundingClientRect();
      const cx = curCenter.x - r.left;
      const cy = curCenter.y - r.top;

      const newZ = Math.max(0.1, Math.min(4, this.view.z * scaleFactor));
      if (newZ !== this.view.z) {
        this.view.x = cx - (cx - this.view.x) * (newZ / this.view.z);
        this.view.y = cy - (cy - this.view.y) * (newZ / this.view.z);
        this.view.z = newZ;
      }

      this.drag.pinchDist = curDist;
      this.drag.pinchCenter = curCenter;

      if (this.options.onViewChange) {
        this.options.onViewChange({ ...this.view });
      }
      this.rd();
      return;
    }

    const r = this.canvas.getBoundingClientRect();
    this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    const p = this.toWorld(e.clientX, e.clientY);

    if (this.drag) {
      if (this.drag.k === 'pan') {
        this.view.x = (this.drag.vx || 0) + e.clientX - (this.drag.x || 0);
        this.view.y = (this.drag.vy || 0) + e.clientY - (this.drag.y || 0);
        if (this.options.onViewChange) {
          this.options.onViewChange({ ...this.view });
        }
      } else if (this.drag.k === 'er') {
        const res = eraseSeg(this.objs, this.drag.last || p, p, this.state.er / 2);
        if (res.changed) {
          this.objs = res.newObjs;
          this.drag.ch = true;
          this.drag.erasedAdded?.push(...res.added);
          this.drag.erasedRemoved?.push(...res.removed);
        }
        this.drag.last = p;
      } else if (this.drag.k === 'ai') {
        if (!this.lasso) this.lasso = [];
        this.lasso.push(p);
      } else if (this.drag.k === 'mq' && this.drag.p0) {
        const x = Math.min(this.drag.p0.x, p.x);
        const y = Math.min(this.drag.p0.y, p.y);
        const w = Math.abs(p.x - this.drag.p0.x);
        const h = Math.abs(p.y - this.drag.p0.y);
        this.marq = { x, y, w, h };
        const ids = new Set(
          this.objs
            .filter((o) => !o.lock && intersects(wb(o), this.marq!))
            .map((o) => o.id)
        );
        this.objs.forEach((o) => {
          if (o.g && this.objs.some((q) => ids.has(q.id) && q.g === o.g)) {
            ids.add(o.id);
          }
        });
        this.setSelection([...ids]);
      } else if (this.drag.k === 'mv' && this.drag.p) {
        const dx = p.x - this.drag.p.x;
        const dy = p.y - this.drag.p.y;
        this.selObjs()
          .filter((o) => !o.lock)
          .forEach((o) => move(o, dx, dy));
        this.drag.p = p;
        this.drag.ch = true;
      } else if (this.drag.k === 'rot' && this.drag.b0 && this.drag.ids && this.drag.os) {
        const b = this.drag.b0;
        const x0 = b.x + b.w / 2;
        const y0 = b.y + b.h / 2;
        let a = Math.atan2(p.y - y0, p.x - x0) + Math.PI / 2;
        if (e.shiftKey) {
          a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
        }
        const T = this.drag.ids
          .map((id) => this.objs.find((x) => x.id === id))
          .filter(Boolean) as CanvasObj[];
        const single = T.length === 1;
        const os = this.drag.os;
        if (!os) return;
        T.forEach((o, i) => {
          Object.assign(o, cloneObj(os[i]));
          if (single) {
            o.rot = a;
          } else {
            const q = bounds(o);
            const c0 = q.x + q.w / 2;
            const d0 = q.y + q.h / 2;
            const cosA = Math.cos(a);
            const sinA = Math.sin(a);
            const dx = c0 - x0;
            const dy = d0 - y0;
            move(o, x0 + dx * cosA - dy * sinA - c0, y0 + dx * sinA + dy * cosA - d0);
            o.rot = (o.rot || 0) + a;
          }
        });
        this.drag.ch = true;
      } else if (
        this.drag.k === 'resize' &&
        this.drag.b0 &&
        this.drag.handleKey &&
        this.drag.ids &&
        this.drag.os
      ) {
        const b = this.drag.b0;
        const x0 = b.x + b.w / 2;
        const y0 = b.y + b.h / 2;
        const r = this.drag.r0 || 0;
        const co = Math.cos(r);
        const si = Math.sin(r);
        const hw = b.w / 2 + 6;
        const hh = b.h / 2 + 6;
        const dx = p.x - x0;
        const dy = p.y - y0;
        const lp = { x: dx * co + dy * si, y: -dx * si + dy * co };
        const sgMap: Record<string, [number, number]> = {
          nw: [1, 1],
          ne: [-1, 1],
          se: [-1, -1],
          sw: [1, -1],
          n: [0, 1],
          s: [0, -1],
          e: [-1, 0],
          w: [1, 0],
        };
        const sg = sgMap[this.drag.handleKey] || [1, 1];
        const op = { x: sg[0] * hw, y: sg[1] * hh };
        let w = b.w;
        let h = b.h;
        let mx = 0;
        let my = 0;

        if (sg[0] !== 0) {
          w = Math.max(8, Math.abs(lp.x - op.x) - 12);
          mx = (op.x + lp.x) / 2;
        }
        if (sg[1] !== 0) {
          h = Math.max(8, Math.abs(lp.y - op.y) - 12);
          my = (op.y + lp.y) / 2;
        }

        if (e.shiftKey && sg[0] !== 0 && sg[1] !== 0) {
          const side = Math.max(w, h);
          w = side;
          h = side;
        }

        const nc = { x: x0 + mx * co - my * si, y: y0 + mx * si + my * co };
        const nb = { x: nc.x - w / 2, y: nc.y - h / 2, w, h };
        const T = this.drag.ids
          .map((id) => this.objs.find((x) => x.id === id))
          .filter(Boolean) as CanvasObj[];
        const os = this.drag.os;
        if (!os) return;
        T.forEach((o, i) => {
          Object.assign(o, cloneObj(os[i]));
          rsz(o, b, nb);
        });
        this.drag.ch = true;
      } else if (this.drag.k === 'ls') {
        this.laser.push({ ...p, t: performance.now() });
      }
    } else if (this.cur) {
      if (this.cur.type === 'stroke') {
        const lastPt = this.cur.pts[this.cur.pts.length - 1];
        if (Math.hypot(p.x - lastPt.x, p.y - lastPt.y) > 1 / this.view.z) {
          if (this.cur.pts.length < 5000) {
            const pt: Pt = e.pointerType === 'pen' ? { ...p, pr: e.pressure } : p;
            this.cur.pts.push(pt);
          }
        }
      } else if (this.cur.type === 'shape') {
        this.cur.w = p.x - this.cur.x;
        this.cur.h = p.y - this.cur.y;
        if (e.shiftKey && this.cur.kind !== 'line' && this.cur.kind !== 'arrow') {
          const m = Math.max(Math.abs(this.cur.w), Math.abs(this.cur.h));
          this.cur.w = Math.sign(this.cur.w || 1) * m;
          this.cur.h = Math.sign(this.cur.h || 1) * m;
        }
      }
    } else if (this.state.tool === 'conn') {
      const o = topAt(this.objs, p, 12 / this.view.z);
      const id = o && o.type !== 'conn' && o.id !== this.cfrom ? o.id : null;
      if (id !== this.hov) {
        this.hov = id;
        this.canvas.style.cursor = id ? 'pointer' : 'crosshair';
      }
    } else if (this.state.tool === 'select') {
      const X = this.xform();
      let hovered = false;
      if (X) {
        const h = hitSelectionHandle(X.b, X.r, p, this.view.z);
        if (h) {
          this.canvas.style.cursor = getHandleCursor(h.k, X.r);
          hovered = true;
        }
      }
      if (!hovered) {
        const o = topAt(this.objs, p, 6 / this.view.z);
        if ((o && this.sel.includes(o.id)) || inUnion(this.selObjs(), p)) {
          this.canvas.style.cursor = 'move';
        } else if (o) {
          this.canvas.style.cursor = 'pointer';
        } else {
          this.canvas.style.cursor = 'default';
        }
      }
    }

    this.rd();
  };

  private handlePointerUp = (e?: PointerEvent): void => {
    if (e) {
      this.activePointers.delete(e.pointerId);
    }
    if (this.drag && this.drag.k === 'pinch') {
      if (this.activePointers.size < 2) {
        this.drag = null;
        this.canvas.style.cursor = 'default';
        this.rd();
      }
    }

    if (this.noDraw) {
      if (this.activePointers.size === 0) {
        this.noDraw = false;
      }
      this.rd();
      return;
    }

    if (this.cur) {
      if (
        this.cur.type === 'stroke' ||
        (this.cur.type === 'shape' && Math.abs(this.cur.w) + Math.abs(this.cur.h) > 6)
      ) {
        this.objs.push(this.cur);
        this.history.commit({ tambah: [this.cur] });
      }
      this.cur = null;
    }

    if (this.drag) {
      if (this.drag.k === 'ai') {
        if (this.lasso && this.lasso.length >= 8) {
          if (this.options.onLassoChange) {
            this.options.onLassoChange([...this.lasso]);
          }
        } else {
          this.closeLasso();
        }
      }

      if (this.drag.k === 'mq') {
        this.marq = null;
      }

      if (this.drag.k === 'mv' && this.drag.ch && this.drag.initialObjsBeforeMove) {
        const ubahList: Array<{ sebelum: CanvasObj; sesudah: CanvasObj }> = [];
        for (const initObj of this.drag.initialObjsBeforeMove) {
          const curObj = this.objs.find((o) => o.id === initObj.id);
          if (curObj) {
            ubahList.push({ sebelum: initObj, sesudah: cloneObj(curObj) });
          }
        }
        if (ubahList.length > 0) {
          this.history.commit({ ubah: ubahList });
        }
      }

      if (
        (this.drag.k === 'resize' || this.drag.k === 'rot') &&
        this.drag.ch &&
        this.drag.ids &&
        this.drag.os
      ) {
        const ubahList: Array<{ sebelum: CanvasObj; sesudah: CanvasObj }> = [];
        for (let i = 0; i < this.drag.ids.length; i++) {
          const id = this.drag.ids[i];
          const initObj = this.drag.os[i];
          const curObj = this.objs.find((o) => o.id === id);
          if (curObj && initObj) {
            ubahList.push({ sebelum: initObj, sesudah: cloneObj(curObj) });
          }
        }
        if (ubahList.length > 0) {
          this.history.commit({ ubah: ubahList });
        }
      }

      if (this.drag.k === 'er' && this.drag.ch) {
        const removed = this.drag.erasedRemoved || [];
        const added = this.drag.erasedAdded || [];
        this.history.commit({ hapus: removed, tambah: added });
      }

      if (this.drag.k === 'pan') {
        this.canvas.style.cursor = this.state.tool === 'hand' ? 'grab' : 'crosshair';
      } else if (this.drag.k === 'rot' || this.drag.k === 'resize') {
        this.canvas.style.cursor = 'default';
      } else if (this.drag.k === 'conn' && this.drag.id && e) {
        const p = this.toWorld(e.clientX, e.clientY);
        const o2 = topAt(this.objs, p, 12 / this.view.z);
        if (o2 && o2.id !== this.drag.id && o2.type !== 'conn') {
          this.makeConnection(this.drag.id, o2.id);
        }
        this.cfrom = null;
        this.hov = null;
      }

      this.drag = null;
    }

    if (e && this.canvas.hasPointerCapture(e.pointerId)) {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Abaikan jika pointer sudah tidak tertangkap
      }
    }

    this.rd();
  };

  private handlePointerCancel = (e: PointerEvent): void => {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size === 0) {
      this.noDraw = false;
    }
    this.handlePointerUp(e);
  };

  private handlePointerLeave = (): void => {
    this.mouse = null;
    this.rd();
  };

  private handleDblClick = (e: MouseEvent): void => {
    if (this.hanyaLihat) return;
    const p = this.toWorld(e.clientX, e.clientY);
    const o = topAt(this.objs, p, 4 / this.view.z);
    if (!o) return;

    if (o.type === 'text') {
      if (this.options.onOpenTextEditor) {
        this.options.onOpenTextEditor({
          obj: o,
          x: o.x,
          y: o.y,
          text: o.text,
        });
      }
    } else if (o.type === 'table') {
      const c = Math.floor((p.x - o.x) / o.cw);
      const r = Math.floor((p.y - o.y) / o.ch);
      if (c >= 0 && r >= 0 && c < o.cols && r < o.rows) {
        if (this.options.onOpenTextEditor) {
          this.options.onOpenTextEditor({
            obj: o,
            r,
            c,
            x: o.x + c * o.cw,
            y: o.y + r * o.ch,
            text: o.cells[`${r},${c}`] || '',
          });
        }
      }
    } else if (o.type === 'formula') {
      if (this.options.onOpenFormulaDialog) {
        this.options.onOpenFormulaDialog(o, { x: o.x, y: o.y });
      }
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;

    if (e.ctrlKey || e.metaKey) {
      this.zoomAt(sx, sy, Math.exp(-e.deltaY * 0.01));
    } else {
      this.view.x -= e.deltaX;
      this.view.y -= e.deltaY;
      if (this.options.onViewChange) {
        this.options.onViewChange({ ...this.view });
      }
    }
    this.rd();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName)) return;
    const k = e.key.toLowerCase();
    const m = e.ctrlKey || e.metaKey;

    if (m && (k === 'z' || e.code === 'KeyZ')) {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (m && (k === 'y' || e.code === 'KeyY')) {
      e.preventDefault();
      this.redo();
      return;
    }
    if (m && (k === 'a' || e.code === 'KeyA')) {
      e.preventDefault();
      this.setSelection(this.objs.filter((o) => !o.lock).map((o) => o.id));
      return;
    }
    if (m && (k === 'c' || e.code === 'KeyC')) {
      e.preventDefault();
      this.copy();
      return;
    }
    if (m && (k === 'x' || e.code === 'KeyX')) {
      e.preventDefault();
      this.cut();
      return;
    }
    if (m && (k === 'v' || e.code === 'KeyV')) {
      e.preventDefault();
      this.paste();
      return;
    }
    if (m && (k === 'g' || e.code === 'KeyG')) {
      e.preventDefault();
      if (e.shiftKey) this.ungroup();
      else this.group();
      return;
    }
    if (m && (k === 'l' || e.code === 'KeyL')) {
      e.preventDefault();
      this.toggleLockSelected();
      return;
    }
    if (m && (k === ']' || e.code === 'BracketRight')) {
      e.preventDefault();
      if (e.shiftKey) this.zOrder('front');
      else this.zOrder('fwd');
      return;
    }
    if (m && (k === '[' || e.code === 'BracketLeft')) {
      e.preventDefault();
      if (e.shiftKey) this.zOrder('back');
      else this.zOrder('bwd');
      return;
    }
    if (m && k === 'd') {
      e.preventDefault();
      this.duplicateSelected();
      return;
    }
    if (m && (k === '=' || k === '+')) {
      e.preventDefault();
      this.zoomIn();
      return;
    }
    if (m && k === '-') {
      e.preventDefault();
      this.zoomOut();
      return;
    }
    if (document.body.classList.contains('pres')) {
      if (k === 'arrowright' || k === 'pagedown' || k === ' ') {
        e.preventDefault();
        this.goPage(this.activePageIndex + 1);
        return;
      }
      if (k === 'arrowleft' || k === 'pageup') {
        e.preventDefault();
        this.goPage(this.activePageIndex - 1);
        return;
      }
    }

    if (k === 'escape') {
      if (this.options.onContextMenu) {
        this.options.onContextMenu(null);
      }
      if (document.body.classList.contains('pres')) {
        this.setPresentation(false);
      } else {
        this.setSelection(null);
        this.closeLasso();
      }
      return;
    }
    if (k === 'delete' || k === 'backspace') {
      this.deleteSelected();
      return;
    }
    if (k === ' ') {
      this.spacePressed = true;
      e.preventDefault();
      return;
    }

    // Alat pintasan huruf tunggal
    const keyMap: Record<string, ToolType> = {
      v: 'select',
      h: 'hand',
      l: 'laser',
      p: 'pen',
      e: 'eraser',
      s: 'shape',
      t: 'text',
      b: 'table',
      f: 'fill',
      i: 'pick',
      a: 'ai',
      u: 'upload',
    };
    if (keyMap[k] && !m) {
      this.setTool(keyMap[k]);
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (e.key === ' ') {
      this.spacePressed = false;
    }
  };

  private handleFullscreenChange = (): void => {
    if (!document.fullscreenElement && document.body.classList.contains('pres')) {
      this.setPresentation(false);
    }
  };

  private handleDragOver = (e: DragEvent): void => {
    e.preventDefault();
  };

  private handleDrop = (e: DragEvent): void => {
    e.preventDefault();
    if (this.hanyaLihat) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const pos = this.toWorld(e.clientX, e.clientY);
      for (let i = 0; i < files.length; i++) {
        this.addImageFile(files[i], pos);
      }
    }
  };

  private handlePaste = (e: ClipboardEvent): void => {
    if (this.hanyaLihat) return;
    if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName)) return;
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            this.addImageFile(file);
          }
        }
      }
    }
  };

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    if (this.hanyaLihat) return;

    const p = this.toWorld(e.clientX, e.clientY);
    const o = topAt(this.objs, p, 6 / this.view.z, true);
    if (o && !this.sel.includes(o.id)) {
      const groupIds = o.g ? this.objs.filter((x) => x.g === o.g).map((x) => x.id) : [o.id];
      this.setSelection(groupIds);
    }

    if (this.options.onContextMenu) {
      this.options.onContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('dblclick', this.handleDblClick);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);

    window.addEventListener('dragover', this.handleDragOver);
    window.addEventListener('drop', this.handleDrop);
    window.addEventListener('paste', this.handlePaste);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.canvas);
    }
  }

  public destroy(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('dblclick', this.handleDblClick);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);

    window.removeEventListener('dragover', this.handleDragOver);
    window.removeEventListener('drop', this.handleDrop);
    window.removeEventListener('paste', this.handlePaste);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}

