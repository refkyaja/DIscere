export interface FormulaLayout {
  w: number;
  u: number; // Jarak dari baseline ke atas (ascent)
  d: number; // Jarak dari baseline ke bawah (descent)
  dr: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
}

export interface FormulaObjDef {
  tex: string;
  fs: number;
}

const SYM: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  phi: 'φ',
  omega: 'ω',
  Delta: 'Δ',
  Sigma: 'Σ',
  Omega: 'Ω',
  times: '×',
  div: '÷',
  pm: '±',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  approx: '≈',
  infty: '∞',
  sum: '∑',
  int: '∫',
  cdot: '·',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  degree: '°',
  partial: '∂',
  angle: '∠',
  perp: '⊥',
  therefore: '∴',
};

// Canvas offscreen pengukuran teks
let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCtx) {
    measureCanvas = document.createElement('canvas');
    measureCtx = measureCanvas.getContext('2d');
  }
  return measureCtx!;
}

interface AtomNode {
  t: 'c' | 'g' | 'f' | 'r';
  s?: string;
  u?: boolean;
  a?: AtomNode[];
  n?: AtomNode[];
  d?: AtomNode[];
  sup?: AtomNode[];
  sub?: AtomNode[];
}

function fmParse(s: string): AtomNode[] {
  let i = 0;

  const seq = (end: string): AtomNode[] => {
    const o: AtomNode[] = [];
    while (i < s.length && s[i] !== end) {
      const a = atom();
      if (a) o.push(a);
    }
    if (end) i++;
    return o;
  };

  const arg = (): AtomNode[] => {
    while (s[i] === ' ') i++;
    if (s[i] === '{') {
      i++;
      return seq('}');
    }
    const a = atom();
    return a ? [a] : [];
  };

  function atom(): AtomNode | null {
    const c = s[i++];
    let n: AtomNode;
    if (c === ' ' || c === '}' || c === undefined) return null;

    if (c === '{') {
      n = { t: 'g', a: seq('}') };
    } else if (c === '\\') {
      const m = /^[a-zA-Z]+/.exec(s.slice(i));
      if (!m) {
        n = { t: 'c', s: s[i++] || '' };
      } else {
        i += m[0].length;
        const k = m[0];
        if (k === 'frac') {
          n = { t: 'f', n: arg(), d: arg() };
        } else if (k === 'sqrt') {
          n = { t: 'r', a: arg() };
        } else {
          n = { t: 'c', s: SYM[k] || k, u: !SYM[k] };
        }
      }
    } else {
      n = { t: 'c', s: c };
    }

    for (;;) {
      while (s[i] === ' ') i++;
      if (s[i] === '^') {
        i++;
        n.sup = arg();
      } else if (s[i] === '_') {
        i++;
        n.sub = arg();
      } else {
        break;
      }
    }
    return n;
  }

  return seq('');
}

function lay(a: AtomNode[], fs: number): FormulaLayout {
  let w = 0;
  let u = fs * 0.7;
  let d = fs * 0.2;
  const P: Array<[number, FormulaLayout]> = [];

  for (const n of a) {
    const b = box(n, fs);
    P.push([w, b]);
    w += b.w;
    u = Math.max(u, b.u);
    d = Math.max(d, b.d);
  }

  return {
    w,
    u,
    d,
    dr(ctx, x, y) {
      P.forEach(([dx, b]) => b.dr(ctx, x + dx, y));
    },
  };
}

function box(n: AtomNode, fs: number): FormulaLayout {
  let b: FormulaLayout;
  const mc = getMeasureContext();

  if (n.t === 'c') {
    const char = n.s || '';
    const isSingleLetter = !n.u && /^[a-zA-Z]$/.test(char);
    mc.font = (isSingleLetter ? 'italic ' : '') + `${fs}px "Times New Roman",serif`;
    const f = mc.font;
    const sp = /[=+\-×÷±≤≥≠≈<>→]/.test(char) ? fs * 0.28 : 0;
    const w = mc.measureText(char).width + sp * 2;
    b = {
      w,
      u: fs * 0.72,
      d: fs * 0.22,
      dr(ctx, x, y) {
        ctx.font = f;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(char, x + sp, y);
      },
    };
  } else if (n.t === 'g') {
    b = lay(n.a || [], fs);
  } else if (n.t === 'f') {
    const N = lay(n.n || [], fs * 0.8);
    const D = lay(n.d || [], fs * 0.8);
    const w = Math.max(N.w, D.w) + fs * 0.3;
    const ax = fs * 0.3;
    const g = fs * 0.12;
    b = {
      w,
      u: ax + g + N.d + N.u,
      d: Math.max(0, D.u + D.d + g - ax),
      dr(ctx, x, y) {
        N.dr(ctx, x + (w - N.w) / 2, y - ax - g - N.d);
        D.dr(ctx, x + (w - D.w) / 2, y - ax + g + D.u);
        ctx.fillRect(x + fs * 0.05, y - ax - fs * 0.03, w - fs * 0.1, Math.max(1, fs * 0.06));
      },
    };
  } else {
    // Akar kuadrat \sqrt
    const A = lay(n.a || [], fs);
    const w = A.w + fs * 0.75;
    const u = A.u + fs * 0.3;
    b = {
      w,
      u,
      d: A.d,
      dr(ctx, x, y) {
        A.dr(ctx, x + fs * 0.6, y);
        ctx.save();
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = Math.max(1, fs * 0.06);
        ctx.beginPath();
        ctx.moveTo(x + fs * 0.05, y - fs * 0.3);
        ctx.lineTo(x + fs * 0.22, y + A.d);
        ctx.lineTo(x + fs * 0.42, y - u + fs * 0.1);
        ctx.lineTo(x + w, y - u + fs * 0.1);
        ctx.stroke();
        ctx.restore();
      },
    };
  }

  if (n.sup || n.sub) {
    const S1 = n.sup && lay(n.sup, fs * 0.65);
    const S2 = n.sub && lay(n.sub, fs * 0.65);
    const B0 = b;
    const ws = Math.max(S1 ? S1.w : 0, S2 ? S2.w : 0);
    b = {
      w: B0.w + ws,
      u: Math.max(B0.u, S1 ? fs * 0.45 + S1.u : 0),
      d: Math.max(B0.d, S2 ? fs * 0.25 + S2.d : 0),
      dr(ctx, x, y) {
        B0.dr(ctx, x, y);
        if (S1) S1.dr(ctx, x + B0.w, y - fs * 0.45);
        if (S2) S2.dr(ctx, x + B0.w, y + fs * 0.25);
      },
    };
  }

  return b;
}

const FC: Record<string, FormulaLayout> = {};

export function fmLay(o: FormulaObjDef): FormulaLayout {
  const k = `${o.tex}|${o.fs}`;
  if (FC[k]) return FC[k];

  let L: FormulaLayout;
  try {
    L = lay(fmParse(o.tex), o.fs);
  } catch {
    L = lay([{ t: 'c', s: String(o.tex), u: true }], o.fs);
  }

  if (Object.keys(FC).length > 200) {
    for (const key in FC) delete FC[key];
  }
  FC[k] = L;
  return L;
}

