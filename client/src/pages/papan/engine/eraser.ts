import { Pt, StrokeObj, CanvasObj } from './types';
import { bounds, dseg, ew, hit } from './geometry';
import { shapeStrokes } from './shapes';

/**
 * Menyederhanakan deretan titik dengan membuang titik yang terlalu berdekatan (< 2px),
 * mencegah pembengkakan memori dan lag pada WebSocket saat stroke dipotong berkali-kali.
 */
function simplifyPts(pts: Pt[]): Pt[] {
  if (pts.length <= 2) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1];
    const curr = pts[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= 2 || i === pts.length - 1) {
      out.push(curr);
    }
  }
  return out;
}

export function cutStroke(
  s: StrokeObj,
  a: Pt,
  b: Pt,
  r: number
): StrokeObj | StrokeObj[] {
  const P = s.pts;
  if (!P || P.length < 2) return s;

  const D: Pt[] = [];

  for (let i = 0; i < P.length; i++) {
    D.push(P[i]);
    const n = P[i + 1];
    if (n) {
      const dist = Math.hypot(n.x - P[i].x, n.y - P[i].y);
      // Hanya interpolasi jika dua titik berjarak cukup jauh (> 8px)
      if (dist > 8) {
        const k = Math.min(Math.floor(dist / 8), 6);
        for (let j = 1; j <= k; j++) {
          D.push({
            x: P[i].x + ((n.x - P[i].x) * j) / (k + 1),
            y: P[i].y + ((n.y - P[i].y) * j) / (k + 1),
          });
        }
      }
    }
  }

  const bad = D.map((p) => dseg(p, a, b) <= r + ew(s) / 2);
  if (!bad.some(Boolean)) return s;

  const res: StrokeObj[] = [];
  let run: Pt[] = [];
  const mk = (pts: Pt[]): StrokeObj => ({
    ...s,
    id: crypto.randomUUID(),
    pts: simplifyPts(pts),
  });

  D.forEach((p, i) => {
    if (bad[i]) {
      if (run.length > 1) res.push(mk(run));
      run = [];
    } else {
      run.push(p);
    }
  });

  if (run.length > 1) res.push(mk(run));
  return res;
}

export interface EraseResult {
  newObjs: CanvasObj[];
  changed: boolean;
  added: CanvasObj[];
  removed: CanvasObj[];
}

export function eraseSeg(
  currentObjs: CanvasObj[],
  a: Pt,
  b: Pt,
  eraserRadius: number
): EraseResult {
  const r = eraserRadius;
  const out: CanvasObj[] = [];
  let ch = false;
  const added: CanvasObj[] = [];
  const removed: CanvasObj[] = [];

  const nb = (o: CanvasObj): boolean => {
    const q = bounds(o);
    return (
      Math.max(a.x, b.x) >= q.x - r &&
      Math.min(a.x, b.x) <= q.x + q.w + r &&
      Math.max(a.y, b.y) >= q.y - r &&
      Math.min(a.y, b.y) <= q.y + q.h + r
    );
  };

  for (const o of currentObjs) {
    if (!nb(o)) {
      out.push(o);
      continue;
    }

    const ps: StrokeObj[] | null =
      o.type === 'stroke'
        ? [o]
        : o.type === 'shape' && !o.fill
        ? shapeStrokes(o)
        : null;

    if (!ps) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if ([a, b, mid].some((p) => hit(o, p, r * 0.5))) {
        ch = true;
        removed.push(o);
      } else {
        out.push(o);
      }
      continue;
    }

    const res = ps.map((x) => cutStroke(x, a, b, r));
    const anyCut = res.some((x) => Array.isArray(x));

    if (!anyCut) {
      out.push(o);
      continue;
    }

    ch = true;
    removed.push(o);

    res.forEach((x) => {
      if (Array.isArray(x)) {
        for (const stroke of x) {
          out.push(stroke);
          added.push(stroke);
        }
      } else {
        out.push(x);
        added.push(x);
      }
    });
  }

  return {
    newObjs: out,
    changed: ch,
    added,
    removed,
  };
}

