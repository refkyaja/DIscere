import { CanvasObj, LocalOp, UbahEventPayload } from './types';
import { move } from './geometry';

export function cloneObj<T extends CanvasObj>(o: T): T {
  const copy: any = { ...o };
  if ('_i' in copy) delete copy._i;
  if ('pts' in copy && Array.isArray(copy.pts)) {
    copy.pts = copy.pts.map((p: any) => ({ ...p }));
  }
  if ('cells' in copy && copy.cells) {
    copy.cells = { ...copy.cells };
  }
  return copy as T;
}

export function cloneSet(objsToClone: CanvasObj[], dx = 0, dy = 0): CanvasObj[] {
  const groupMap = new Map<string, string>();
  const idMap = new Map<string, string>();

  const cloned = objsToClone.map((o) => {
    const c = cloneObj(o);
    const oldId = c.id;
    c.id = crypto.randomUUID();
    idMap.set(oldId, c.id);

    if (c.g) {
      if (!groupMap.has(c.g)) {
        groupMap.set(c.g, 'g_' + crypto.randomUUID().slice(0, 8));
      }
      c.g = groupMap.get(c.g);
    }
    move(c, dx, dy);
    return c;
  });

  return cloned.filter((c) => {
    if (c.type !== 'conn') return true;
    if (idMap.has(c.a) && idMap.has(c.b)) {
      c.a = idMap.get(c.a)!;
      c.b = idMap.get(c.b)!;
      return true;
    }
    return false;
  });
}

export class HistoryManager {
  private undoStack: LocalOp[] = [];
  private redoStack: LocalOp[] = [];
  private maxEntries = 60;
  private onUbah?: (payload: UbahEventPayload) => void;
  private onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;

  constructor(
    onUbah?: (payload: UbahEventPayload) => void,
    onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void
  ) {
    this.onUbah = onUbah;
    this.onHistoryChange = onHistoryChange;
  }

  setOnUbah(callback: (payload: UbahEventPayload) => void): void {
    this.onUbah = callback;
  }

  setOnHistoryChange(callback: (canUndo: boolean, canRedo: boolean) => void): void {
    this.onHistoryChange = callback;
  }

  private notifyHistory(): void {
    if (this.onHistoryChange) {
      this.onHistoryChange(this.canUndo(), this.canRedo());
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyHistory();
  }

  commit(op: LocalOp, broadcast = true): void {
    const cleanOp: LocalOp = {
      tambah: op.tambah && op.tambah.length ? op.tambah.map(cloneObj) : undefined,
      hapus: op.hapus && op.hapus.length ? op.hapus.map(cloneObj) : undefined,
      ubah:
        op.ubah && op.ubah.length
          ? op.ubah.map((u) => ({
              sebelum: cloneObj(u.sebelum),
              sesudah: cloneObj(u.sesudah),
            }))
          : undefined,
      reorder: op.reorder ? { ...op.reorder } : undefined,
    };

    if (!cleanOp.tambah && !cleanOp.hapus && !cleanOp.ubah && !cleanOp.reorder) {
      return;
    }

    this.undoStack.push(cleanOp);
    if (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.notifyHistory();

    if (broadcast && this.onUbah) {
      this.onUbah({
        tambah: cleanOp.tambah,
        ubah: cleanOp.ubah?.map((u) => u.sesudah),
        hapus: cleanOp.hapus?.map((h) => h.id),
        reorder: cleanOp.reorder?.sesudah,
      });
    }
  }

  undo(currentObjs: CanvasObj[]): { newObjs: CanvasObj[]; reverted: boolean } {
    if (this.undoStack.length === 0) return { newObjs: currentObjs, reverted: false };
    const op = this.undoStack.pop()!;
    this.redoStack.push(op);
    this.notifyHistory();

    let objs = [...currentObjs];

    // Revert tambah: hapus objek yang ditambahkan
    if (op.tambah && op.tambah.length > 0) {
      const idsToRemove = new Set(op.tambah.map((o) => o.id));
      objs = objs.filter((o) => !idsToRemove.has(o.id));
    }

    // Revert hapus: masukkan kembali objek yang sempat terhapus
    if (op.hapus && op.hapus.length > 0) {
      for (const h of op.hapus) {
        objs.push(cloneObj(h));
      }
    }

    // Revert ubah: kembalikan ke state 'sebelum'
    if (op.ubah && op.ubah.length > 0) {
      const mapSebelum = new Map(op.ubah.map((u) => [u.sebelum.id, u.sebelum]));
      objs = objs.map((o) => {
        const prev = mapSebelum.get(o.id);
        return prev ? cloneObj(prev) : o;
      });
    }

    // Revert urutan (z-order)
    if (op.reorder) {
      const orderMap = new Map(op.reorder.sebelum.map((id, index) => [id, index]));
      objs.sort((a, b) => {
        const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
        const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
        return idxA - idxB;
      });
    }

    if (this.onUbah) {
      this.onUbah({
        tambah: op.hapus?.map(cloneObj),
        ubah: op.ubah?.map((u) => cloneObj(u.sebelum)),
        hapus: op.tambah?.map((t) => t.id),
        reorder: op.reorder?.sebelum,
      });
    }

    return { newObjs: objs, reverted: true };
  }

  redo(currentObjs: CanvasObj[]): { newObjs: CanvasObj[]; reapplied: boolean } {
    if (this.redoStack.length === 0) return { newObjs: currentObjs, reapplied: false };
    const op = this.redoStack.pop()!;
    this.undoStack.push(op);
    this.notifyHistory();

    let objs = [...currentObjs];

    // Re-apply tambah
    if (op.tambah && op.tambah.length > 0) {
      for (const t of op.tambah) {
        objs.push(cloneObj(t));
      }
    }

    // Re-apply hapus
    if (op.hapus && op.hapus.length > 0) {
      const idsToRemove = new Set(op.hapus.map((o) => o.id));
      objs = objs.filter((o) => !idsToRemove.has(o.id));
    }

    // Re-apply ubah
    if (op.ubah && op.ubah.length > 0) {
      const mapSesudah = new Map(op.ubah.map((u) => [u.sesudah.id, u.sesudah]));
      objs = objs.map((o) => {
        const next = mapSesudah.get(o.id);
        return next ? cloneObj(next) : o;
      });
    }

    // Re-apply urutan (z-order)
    if (op.reorder) {
      const orderMap = new Map(op.reorder.sesudah.map((id, index) => [id, index]));
      objs.sort((a, b) => {
        const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
        const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
        return idxA - idxB;
      });
    }

    if (this.onUbah) {
      this.onUbah({
        tambah: op.tambah?.map(cloneObj),
        ubah: op.ubah?.map((u) => cloneObj(u.sesudah)),
        hapus: op.hapus?.map((h) => h.id),
        reorder: op.reorder?.sesudah,
      });
    }

    return { newObjs: objs, reapplied: true };
  }
}

