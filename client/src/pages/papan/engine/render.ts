import { CanvasObj, BoardView, BoardState, Pt, Bounds, LaserPoint } from './types';
import { bounds, ew, lines, intersects, wb, hsFor, ubox, connEnds } from './geometry';
import { up } from './shapes';
import { fmLay } from './formula';

let fontLoaded = false;
export async function ensureFontLoaded(onReady?: () => void): Promise<void> {
  if (fontLoaded) return;
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.load('600 24px "Plus Jakarta Sans"');
      fontLoaded = true;
      if (onReady) onReady();
    } catch {
      // Font fallback browser tetap jalan
    }
  }
}

export function drawObj(
  c: CanvasRenderingContext2D,
  o: CanvasObj,
  onImageLoad?: () => void,
  allObjs?: CanvasObj[]
): void {
  c.save();
  c.globalAlpha = (o.op ?? 1) * (o.type === 'stroke' && o.st === 'marker' ? 0.75 : 1);
  if (o.rot) {
    const b = bounds(o, allObjs);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    c.translate(cx, cy);
    c.rotate(o.rot);
    c.translate(-cx, -cy);
  }
  drawObj0(c, o, onImageLoad, allObjs);
  c.restore();
}

export function drawObj0(
  c: CanvasRenderingContext2D,
  o: CanvasObj,
  onImageLoad?: () => void,
  allObjs?: CanvasObj[]
): void {
  c.lineCap = c.lineJoin = 'round';
  c.strokeStyle = o.color;
  c.fillStyle = o.color;
  c.lineWidth = ew(o);
  if (o.type === 'stroke' && o.st === 'marker') {
    c.lineCap = 'square';
  }

  if (o.type === 'stroke') {
    if (o.pts.length === 0) return;

    if (o.pts.length > 1 && o.pts[0].pr !== undefined) {
      const w0 = ew(o);
      for (let i = 1; i < o.pts.length; i++) {
        const a = o.pts[i - 1];
        const b = o.pts[i];
        const pr = ((a.pr ?? 0.5) + (b.pr ?? 0.5)) / 2;
        c.lineWidth = w0 * (0.35 + 1.3 * pr);
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }
      return;
    }

    if (o.pts.length === 1) {
      const pr = o.pts[0].pr !== undefined ? o.pts[0].pr : 0.5;
      const radius = o.pts[0].pr !== undefined ? (ew(o) * (0.35 + 1.3 * pr)) / 2 : ew(o) / 2;
      c.beginPath();
      c.arc(o.pts[0].x, o.pts[0].y, radius, 0, Math.PI * 2);
      c.fill();
      return;
    }
    c.beginPath();
    c.moveTo(o.pts[0].x, o.pts[0].y);
    for (let i = 1; i < o.pts.length - 1; i++) {
      const m = {
        x: (o.pts[i].x + o.pts[i + 1].x) / 2,
        y: (o.pts[i].y + o.pts[i + 1].y) / 2,
      };
      c.quadraticCurveTo(o.pts[i].x, o.pts[i].y, m.x, m.y);
    }
    const l = o.pts[o.pts.length - 1];
    c.lineTo(l.x, l.y);
    c.stroke();

    if (o.st === 'pencil') {
      c.globalAlpha *= 0.5;
      c.lineWidth = ew(o) * 0.45;
      c.setLineDash([1, 2.5]);
      c.stroke();
      c.setLineDash([]);
    }
  } else if (o.type === 'shape') {
    const { x, y, w, h } = o;
    const k = o.kind;
    const bx = Math.min(x, x + w);
    const by = Math.min(y, y + h);
    const bw = Math.abs(w);
    const bh = Math.abs(h);
    c.beginPath();

    if (k === 'line' || k === 'arrow') {
      c.moveTo(x, y);
      c.lineTo(x + w, y + h);
    } else if (k === 'rect') {
      c.rect(bx, by, bw, bh);
    } else if (k === 'round') {
      if (typeof c.roundRect === 'function') {
        c.roundRect(bx, by, bw, bh, Math.min(bw, bh) * 0.22);
      } else {
        c.rect(bx, by, bw, bh);
      }
    } else if (k === 'ellipse') {
      c.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
    } else {
      const points = up(k);
      points.forEach((q, i) => c[i ? 'lineTo' : 'moveTo'](bx + q[0] * bw, by + q[1] * bh));
      c.closePath();
    }

    if (o.fill && k !== 'line' && k !== 'arrow') {
      c.fillStyle = o.fill;
      c.fill();
    }
    c.stroke();

    if (k === 'arrow') {
      const a = Math.atan2(h, w);
      const s = 12 + o.size * 1.5;
      c.beginPath();
      c.moveTo(x + w, y + h);
      c.lineTo(x + w - s * Math.cos(a - 0.45), y + h - s * Math.sin(a - 0.45));
      c.moveTo(x + w, y + h);
      c.lineTo(x + w - s * Math.cos(a + 0.45), y + h - s * Math.sin(a + 0.45));
      c.stroke();
    }
  } else if (o.type === 'text') {
    const b = bounds(o);
    if (o.fill || o.ai) {
      c.fillStyle = o.fill || (o.ai ? '#fef3c7' : '#ffffff');
      c.beginPath();
      if (typeof c.roundRect === 'function') {
        c.roundRect(b.x, b.y, b.w, b.h, o.ai ? 14 : 10);
      } else {
        c.rect(b.x, b.y, b.w, b.h);
      }
      c.fill();

      // Border halus untuk kartu AI
      if (o.ai) {
        c.strokeStyle = '#f59e0b';
        c.lineWidth = 1.5;
        c.stroke();
      }
    }

    // Label "Dibuat AI" di pojok kartu
    if (o.ai) {
      c.save();
      const badgeText = 'Dibuat AI';
      c.font = '700 11px "Plus Jakarta Sans", sans-serif';
      const tw = c.measureText(badgeText).width;
      const bx = b.x + b.w - tw - 18;
      const by = b.y + 8;
      c.fillStyle = '#f59e0b';
      if (typeof c.roundRect === 'function') {
        c.beginPath();
        c.roundRect(bx, by, tw + 10, 18, 5);
        c.fill();
      } else {
        c.fillRect(bx, by, tw + 10, 18);
      }
      c.fillStyle = '#ffffff';
      c.textBaseline = 'middle';
      c.fillText(badgeText, bx + 5, by + 9);
      c.restore();
    }

    c.fillStyle = o.color;
    c.font = `${o.fw || 600} ${o.fs}px "Plus Jakarta Sans", sans-serif`;
    c.textBaseline = 'top';
    const L = lines(o);
    const topOffset = o.ai ? 32 : 8;
    L.forEach((line, i) => c.fillText(line, o.x + 12, o.y + topOffset + i * o.fs * 1.3));
  } else if (o.type === 'table') {
    const b = bounds(o);
    if (o.fill) {
      c.fillStyle = o.fill;
      c.fillRect(b.x, b.y, b.w, b.h);
    }
    c.lineWidth = 2;
    c.strokeStyle = o.color;
    c.beginPath();
    for (let r = 0; r <= o.rows; r++) {
      c.moveTo(o.x, o.y + r * o.ch);
      c.lineTo(o.x + b.w, o.y + r * o.ch);
    }
    for (let col = 0; col <= o.cols; col++) {
      c.moveTo(o.x + col * o.cw, o.y);
      c.lineTo(o.x + col * o.cw, o.y + b.h);
    }
    c.stroke();
    c.fillStyle = o.color;
    c.font = '500 16px "Plus Jakarta Sans", sans-serif';
    c.textBaseline = 'middle';
    for (const key in o.cells) {
      const [r, col] = key.split(',').map(Number);
      c.fillText(o.cells[key], o.x + col * o.cw + 10, o.y + r * o.ch + o.ch / 2, o.cw - 20);
    }
  } else if (o.type === 'image') {
    if (!o._i) {
      o._i = new Image();
      if (onImageLoad) {
        o._i.onload = onImageLoad;
      }
      o._i.src = o.src;
    }
    if (o._i.complete && o._i.naturalWidth > 0) {
      c.drawImage(o._i, o.x, o.y, o.w, o.h);
    }
  } else if (o.type === 'conn') {
    const e = connEnds(allObjs || [], o);
    if (e.bad) return;
    c.beginPath();
    c.moveTo(e.a.x, e.a.y);
    c.lineTo(e.b.x, e.b.y);
    c.stroke();
    if (o.ar !== false) {
      const a = Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x);
      const q = 12 + o.size * 1.5;
      c.beginPath();
      c.moveTo(e.b.x, e.b.y);
      c.lineTo(e.b.x - q * Math.cos(a - 0.45), e.b.y - q * Math.sin(a - 0.45));
      c.moveTo(e.b.x, e.b.y);
      c.lineTo(e.b.x - q * Math.cos(a + 0.45), e.b.y - q * Math.sin(a + 0.45));
      c.stroke();
    }
  } else if (o.type === 'formula') {
    const L = fmLay(o);
    c.fillStyle = o.color;
    L.dr(c, o.x + 6, o.y + 6 + L.u);
  }
}

export interface DrawSceneParams {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  view: BoardView;
  state: BoardState;
  objs: CanvasObj[];
  cur: CanvasObj | null;
  lasso: Pt[] | null;
  sel: string[] | string | null;
  marq?: Bounds | null;
  laser: LaserPoint[];
  mouse: Pt | null;
  cfrom?: string | null;
  hov?: string | null;
  onImageLoad?: () => void;
}

export function drawScene({
  ctx,
  canvas,
  view,
  state,
  objs,
  cur,
  lasso,
  sel,
  marq,
  laser,
  mouse,
  cfrom,
  hov,
  onImageLoad,
}: DrawSceneParams): void {
  const d = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800);
  const height = canvas.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 600);

  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(d * view.z, 0, 0, d * view.z, d * view.x, d * view.y);

  // Titik grid
  if (state.grid && view.z > 0.35) {
    const g = 24;
    const x0 = Math.floor(-view.x / view.z / g) * g;
    const y0 = Math.floor(-view.y / view.z / g) * g;
    const x1 = (width - view.x) / view.z;
    const y1 = (height - view.y) / view.z;
    ctx.fillStyle = '#c9cee0';
    for (let x = x0; x < x1; x += g) {
      for (let y = y0; y < y1; y += g) {
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  }

  // Viewport culling bounds (ruang dunia)
  const vx0 = -view.x / view.z;
  const vy0 = -view.y / view.z;
  const vw = width / view.z;
  const vh = height / view.z;
  const viewportBounds = { x: vx0, y: vy0, w: vw, h: vh };

  // Objek kanvas (dengan Viewport Culling agar kanvas besar 500+ objek tetap sangat cepat)
  for (const o of objs) {
    const b = wb(o);
    if (!intersects(b, viewportBounds)) {
      continue;
    }
    drawObj(ctx, o, onImageLoad, objs);

    if (o.lock) {
      drawLockIcon(ctx, b.x + b.w, b.y, view.z);
    }
  }

  // Objek yang sedang digambar (preview)
  if (cur) {
    drawObj(ctx, cur, onImageLoad, objs);
  }

  // Lasso Tanya AI
  if (lasso && lasso.length > 1) {
    ctx.save();
    ctx.beginPath();
    lasso.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q.x, q.y));
    ctx.closePath();
    ctx.fillStyle = 'rgba(251, 191, 36, 0.13)';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3 / view.z;
    ctx.setLineDash([10 / view.z, 7 / view.z]);
    ctx.stroke();
    ctx.restore();
  }

  // Visualisasi mode konektor: sorot objek hover & garis ke kursor
  if (state.tool === 'conn') {
    const hl = (id: string, col: string) => {
      const o = objs.find((x) => x.id === id);
      if (!o) return;
      const b = bounds(o, objs);
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 3 / view.z;
      ctx.strokeRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10);
      ctx.fillStyle = col;
      [
        [b.x + b.w / 2, b.y - 5],
        [b.x + b.w + 5, b.y + b.h / 2],
        [b.x + b.w / 2, b.y + b.h + 5],
        [b.x - 5, b.y + b.h / 2],
      ].forEach((q) => {
        ctx.beginPath();
        ctx.arc(q[0], q[1], 4.5 / view.z, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    };

    if (hov) hl(hov, '#22c55e');
    if (cfrom) {
      hl(cfrom, '#9b17f5');
      const A = objs.find((x) => x.id === cfrom);
      if (A && mouse) {
        const b = bounds(A, objs);
        const q = { x: (mouse.x - view.x) / view.z, y: (mouse.y - view.y) / view.z };
        ctx.save();
        ctx.strokeStyle = '#9b17f5';
        ctx.lineWidth = 2 / view.z;
        ctx.setLineDash([6 / view.z, 5 / view.z]);
        ctx.beginPath();
        ctx.moveTo(b.x + b.w / 2, b.y + b.h / 2);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Kotak seleksi objek aktif & Pegangan Resize + Rotasi (Tunggal & Multi-Select)
  const selIds = Array.isArray(sel) ? sel : sel ? [sel] : [];
  const selectedObjs = objs.filter((o) => selIds.includes(o.id));

  if (selectedObjs.length > 0) {
    const z = view.z;
    ctx.save();
    ctx.lineWidth = 1.5 / z;
    ctx.strokeStyle = '#9b17f5';
    ctx.setLineDash([6 / z, 4 / z]);

    // Gambar outline dashed per objek
    for (const s of selectedObjs) {
      const b = bounds(s);
      const r = s.rot || 0;
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
      ctx.rotate(r);
      ctx.strokeRect(-b.w / 2 - 6, -b.h / 2 - 6, b.w + 12, b.h + 12);
      ctx.restore();
    }
    ctx.setLineDash([]);

    // Kotak transform (objek tunggal atau union multi-objek)
    const xformBox =
      selectedObjs.length === 1
        ? { b: bounds(selectedObjs[0]), r: selectedObjs[0].rot || 0 }
        : { b: ubox(selectedObjs), r: 0 };

    if (selectedObjs.length > 1) {
      ctx.lineWidth = 1.5 / z;
      ctx.strokeStyle = '#9b17f5';
      ctx.strokeRect(xformBox.b.x - 6, xformBox.b.y - 6, xformBox.b.w + 12, xformBox.b.h + 12);
    }

    // Handles untuk kotak aktif
    const hs = hsFor(xformBox.b, xformBox.r, z);
    const rotHandle = hs.find((h) => h.k === 'rot');
    const topHandle = hs.find((h) => h.k === 'n');

    // Garis penghubung ke pegangan rotasi
    if (rotHandle && topHandle) {
      ctx.beginPath();
      ctx.moveTo(topHandle.x, topHandle.y);
      ctx.lineTo(rotHandle.x, rotHandle.y);
      ctx.stroke();
    }

    // Gambar handle resize (persegi untuk sudut, lingkaran untuk tepi tengah)
    for (const h of hs) {
      if (h.k === 'rot') continue;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#9b17f5';
      ctx.lineWidth = 2 / z;
      const sz = (h.k.length === 2 ? 6.5 : 5) / z;
      ctx.beginPath();
      if (h.k.length === 2) {
        ctx.rect(h.x - sz, h.y - sz, sz * 2, sz * 2);
      } else {
        ctx.arc(h.x, h.y, sz, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
    }

    // Gambar pegangan rotasi
    if (rotHandle) {
      ctx.fillStyle = '#9b17f5';
      ctx.beginPath();
      ctx.arc(rotHandle.x, rotHandle.y, 11 / z, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / z;
      ctx.beginPath();
      ctx.arc(rotHandle.x, rotHandle.y, 5.5 / z, -0.6, 4.4);
      ctx.stroke();

      const ex = rotHandle.x + (5.5 / z) * Math.cos(4.4);
      const ey = rotHandle.y + (5.5 / z) * Math.sin(4.4);
      ctx.beginPath();
      ctx.moveTo(ex - 3 / z, ey - 3 / z);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex + 3 / z, ey - 3 / z);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Marquee seleksi seret kotak (area ungu transparan)
  if (marq && marq.w > 0 && marq.h > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(155, 23, 245, 0.08)';
    ctx.strokeStyle = '#9b17f5';
    ctx.lineWidth = 1.5 / view.z;
    ctx.setLineDash([6 / view.z, 4 / view.z]);
    ctx.fillRect(marq.x, marq.y, marq.w, marq.h);
    ctx.strokeRect(marq.x, marq.y, marq.w, marq.h);
    ctx.restore();
  }

  // Jejak Laser pointer (memudar 900 ms)
  const now = performance.now();
  ctx.lineCap = 'round';
  for (let i = 1; i < laser.length; i++) {
    const a = laser[i - 1];
    const b = laser[i];
    const k = 1 - (now - b.t) / 900;
    if (k > 0) {
      ctx.strokeStyle = state.lc;
      ctx.globalAlpha = Math.max(0, k);
      ctx.lineWidth = (6 * k + 2) / view.z;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  if (laser.length > 0) {
    const l = laser[laser.length - 1];
    ctx.globalAlpha = 1;
    ctx.fillStyle = state.lc;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 6 / view.z, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  // Kursor penghapus
  if (state.tool === 'eraser' && mouse) {
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, (state.er * view.z) / 2 + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawLockIcon(ctx: CanvasRenderingContext2D, x: number, y: number, z: number): void {
  ctx.save();
  ctx.translate(x, y);
  const s = 11 / z;
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#111827';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 1.6 / z;

  const bw = 7 / z;
  const bh = 5.5 / z;
  ctx.fillRect(-bw / 2, -1 / z, bw, bh);

  ctx.beginPath();
  ctx.arc(0, -1 / z, 2.5 / z, Math.PI, 0, false);
  ctx.stroke();

  ctx.restore();
}

