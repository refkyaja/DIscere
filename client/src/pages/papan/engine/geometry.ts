import {
  Pt,
  Bounds,
  CanvasObj,
  TextObj,
  ConnObj,
  ResizeCorner,
  HandleKey,
  SelectionHandle,
} from './types';
import { fmLay } from './formula';

const mc = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;

const textBoundsCache = new WeakMap<TextObj, { text: string; fs: number; fw: any; w: number; h: number }>();
const strokeBoundsCache = new WeakMap<CanvasObj, Bounds>();

export function clearBoundsCache(o: CanvasObj): void {
  strokeBoundsCache.delete(o);
}

export function intersects(b1: Bounds, b2: Bounds): boolean {
  return (
    b1.x <= b2.x + b2.w &&
    b1.x + b1.w >= b2.x &&
    b1.y <= b2.y + b2.h &&
    b1.y + b1.h >= b2.y
  );
}

export function lines(o: TextObj): string[] {
  return String(o.text ?? '').split('\n');
}

export function ew(o: CanvasObj): number {
  if (o.type === 'stroke') {
    return o.size * (o.st === 'marker' ? 2.6 : o.st === 'pencil' ? 0.85 : 1);
  }
  return o.size;
}

export function edge(b: Bounds, t: Pt): Pt {
  const x = b.x + b.w / 2;
  const y = b.y + b.h / 2;
  const dx = t.x - x;
  const dy = t.y - y;
  if (!dx && !dy) return { x, y };
  const k = Math.min((b.w / 2 + 4) / (Math.abs(dx) || 1e-9), (b.h / 2 + 4) / (Math.abs(dy) || 1e-9));
  return { x: x + dx * k, y: y + dy * k };
}

export function connEnds(
  objs: CanvasObj[],
  o: ConnObj
): { a: Pt; b: Pt; bad?: boolean } {
  const A = objs.find((x) => x.id === o.a);
  const B = objs.find((x) => x.id === o.b);
  if (!A || !B || A.type === 'conn' || B.type === 'conn') {
    return { a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, bad: true };
  }
  const ba = bounds(A, objs);
  const bb = bounds(B, objs);
  const ca = { x: ba.x + ba.w / 2, y: ba.y + ba.h / 2 };
  const cb = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
  return { a: edge(ba, cb), b: edge(bb, ca) };
}

export function bounds(o: CanvasObj, allObjs?: CanvasObj[]): Bounds {
  if (o.type === 'formula') {
    const L = fmLay(o);
    return { x: o.x, y: o.y, w: L.w + 12, h: L.u + L.d + 12 };
  }

  if (o.type === 'conn') {
    const e = connEnds(allObjs || [], o);
    return {
      x: Math.min(e.a.x, e.b.x),
      y: Math.min(e.a.y, e.b.y),
      w: Math.abs(e.a.x - e.b.x),
      h: Math.abs(e.a.y - e.b.y),
    };
  }

  if (o.type === 'stroke') {
    const cached = strokeBoundsCache.get(o);
    if (cached) return cached;
    if (o.pts.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
    let a = 1e9,
      b = 1e9,
      c = -1e9,
      d = -1e9;
    for (const p of o.pts) {
      if (p.x < a) a = p.x;
      if (p.y < b) b = p.y;
      if (p.x > c) c = p.x;
      if (p.y > d) d = p.y;
    }
    const r = ew(o) / 2;
    const res = {
      x: a - r,
      y: b - r,
      w: c - a + 2 * r,
      h: d - b + 2 * r,
    };
    strokeBoundsCache.set(o, res);
    return res;
  }

  if (o.type === 'text') {
    const cached = textBoundsCache.get(o);
    if (cached && cached.text === o.text && cached.fs === o.fs && cached.fw === o.fw) {
      return { x: o.x, y: o.y, w: cached.w, h: cached.h };
    }

    const minW = o.ai ? 240 : 40;
    const badgeH = o.ai ? 28 : 0;
    let maxW = minW;
    const L = lines(o);
    if (mc) {
      mc.font = `${o.fw || 600} ${o.fs}px "Plus Jakarta Sans", sans-serif`;
      for (const line of L) {
        const measured = mc.measureText(line).width;
        if (measured > maxW) maxW = measured;
      }
    }
    const w = maxW + 24;
    const h = L.length * o.fs * 1.3 + 16 + badgeH;
    textBoundsCache.set(o, { text: o.text, fs: o.fs, fw: o.fw, w, h });
    return { x: o.x, y: o.y, w, h };
  }

  if (o.type === 'table') {
    return {
      x: o.x,
      y: o.y,
      w: o.cols * o.cw,
      h: o.rows * o.ch,
    };
  }

  return {
    x: Math.min(o.x, o.x + o.w),
    y: Math.min(o.y, o.y + o.h),
    w: Math.abs(o.w),
    h: Math.abs(o.h),
  };
}

export function dseg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = dx * dx + dy * dy;
  let u = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0;
  u = Math.max(0, Math.min(1, u));
  return Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy);
}

export function wb(o: CanvasObj): Bounds {
  const b = bounds(o);
  if (!o.rot) return b;
  const x = b.x + b.w / 2;
  const y = b.y + b.h / 2;
  const c = Math.cos(o.rot);
  const s = Math.sin(o.rot);
  const X: number[] = [];
  const Y: number[] = [];
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const [i, j] of corners) {
    const dx = (i * b.w) / 2;
    const dy = (j * b.h) / 2;
    X.push(x + dx * c - dy * s);
    Y.push(y + dx * s + dy * c);
  }
  const minX = Math.min(...X);
  const minY = Math.min(...Y);
  return {
    x: minX,
    y: minY,
    w: Math.max(...X) - minX,
    h: Math.max(...Y) - minY,
  };
}

export function ubox(objs: CanvasObj[]): Bounds {
  if (objs.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = 1e9,
    minY = 1e9,
    maxX = -1e9,
    maxY = -1e9;
  for (const o of objs) {
    const r = wb(o);
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY),
  };
}

export function inUnion(objs: CanvasObj[], p: Pt): boolean {
  if (objs.length < 2) return false;
  const b = ubox(objs);
  return p.x >= b.x - 8 && p.x <= b.x + b.w + 8 && p.y >= b.y - 8 && p.y <= b.y + b.h + 8;
}

export function hit(o: CanvasObj, p: Pt, t = 6, allObjs?: CanvasObj[]): boolean {
  if (o.type === 'conn') {
    const e = connEnds(allObjs || [], o);
    return !e.bad && dseg(p, e.a, e.b) <= (o.size || 3) / 2 + t + 2;
  }

  let pt = p;
  if (o.rot) {
    const b = bounds(o, allObjs);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const c = Math.cos(-o.rot);
    const s = Math.sin(-o.rot);
    const dx = p.x - cx;
    const dy = p.y - cy;
    pt = { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
  }

  if (o.type === 'stroke') {
    const r = ew(o) / 2 + t;
    for (let i = 0; i < o.pts.length; i++) {
      const a = o.pts[i];
      const b = o.pts[i + 1] || a;
      if (dseg(pt, a, b) <= r) return true;
    }
    return false;
  }
  const b = bounds(o, allObjs);
  return pt.x >= b.x - t && pt.x <= b.x + b.w + t && pt.y >= b.y - t && pt.y <= b.y + b.h + t;
}

export function topAt(
  objs: CanvasObj[],
  p: Pt,
  t = 6,
  includeLocked = false
): CanvasObj | undefined {
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i];
    if (!includeLocked && o.lock) continue;
    if (hit(o, p, t, objs)) return o;
  }
  return undefined;
}

export function move(o: CanvasObj, dx: number, dy: number): void {
  if (o.type === 'conn') return;
  if (o.type === 'stroke') {
    for (const p of o.pts) {
      p.x += dx;
      p.y += dy;
    }
    const cached = strokeBoundsCache.get(o);
    if (cached) {
      cached.x += dx;
      cached.y += dy;
    }
  } else {
    o.x += dx;
    o.y += dy;
  }
}

export function hsFor(b: Bounds, r = 0, z = 1): SelectionHandle[] {
  const x = b.x + b.w / 2;
  const y = b.y + b.h / 2;
  const hw = b.w / 2 + 6;
  const hh = b.h / 2 + 6;
  const co = Math.cos(r);
  const si = Math.sin(r);
  const P = (dx: number, dy: number) => ({
    x: x + dx * co - dy * si,
    y: y + dx * si + dy * co,
  });

  return [
    { k: 'nw', ...P(-hw, -hh) },
    { k: 'n', ...P(0, -hh) },
    { k: 'ne', ...P(hw, -hh) },
    { k: 'e', ...P(hw, 0) },
    { k: 'se', ...P(hw, hh) },
    { k: 's', ...P(0, hh) },
    { k: 'sw', ...P(-hw, hh) },
    { k: 'w', ...P(-hw, 0) },
    { k: 'rot', ...P(0, -hh - 32 / z) },
  ];
}

export function hitSelectionHandle(b: Bounds, r: number, p: Pt, z = 1): SelectionHandle | null {
  const handles = hsFor(b, r, z);
  return handles.find((h) => Math.hypot(h.x - p.x, h.y - p.y) <= (h.k === 'rot' ? 20 : 16) / z) || null;
}

export function getHandleCursor(handleKey: HandleKey, r = 0): string {
  if (handleKey === 'rot') return 'grab';
  const angleMap: Record<ResizeCorner, number> = {
    e: 0,
    se: 45,
    s: 90,
    sw: 135,
    w: 180,
    nw: 225,
    n: 270,
    ne: 315,
  };
  const deg = (((angleMap[handleKey] + (r * 180) / Math.PI) % 360) + 360) % 360;
  const cursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
  return cursors[Math.round(deg / 45) % 4];
}

export function rsz(o: CanvasObj, b0: Bounds, nb: Bounds): void {
  const sx = nb.w / (b0.w || 1);
  const sy = nb.h / (b0.h || 1);
  const X = (x: number) => nb.x + (x - b0.x) * sx;
  const Y = (y: number) => nb.y + (y - b0.y) * sy;

  if (o.type === 'stroke') {
    o.pts.forEach((q) => {
      q.x = X(q.x);
      q.y = Y(q.y);
    });
    strokeBoundsCache.delete(o);
  } else if (o.type === 'shape' || o.type === 'image') {
    const x2 = X(o.x + o.w);
    const y2 = Y(o.y + o.h);
    o.x = X(o.x);
    o.y = Y(o.y);
    o.w = x2 - o.x;
    o.h = y2 - o.y;
  } else if (o.type === 'table') {
    o.cw *= sx;
    o.ch *= sy;
    o.x = X(o.x);
    o.y = Y(o.y);
  } else if (o.type === 'text') {
    o.fs = Math.max(8, Math.round(o.fs * Math.max(0.3, (sx + sy) / 2)));
    o.x = X(o.x);
    o.y = Y(o.y);
  }
}



