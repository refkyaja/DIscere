import { Pt, ShapeObj, StrokeObj, ToolType, PenStyle } from './types';
import { bounds } from './geometry';

export const poly = (n: number, r0 = -Math.PI / 2): [number, number][] =>
  Array.from({ length: n }, (_, i) => {
    const a = r0 + (i * 2 * Math.PI) / n;
    return [0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)];
  });

export const star = (n: number, r: number): [number, number][] =>
  Array.from({ length: 2 * n }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const q = i % 2 ? r : 1;
    return [0.5 + 0.5 * q * Math.cos(a), 0.5 + 0.5 * q * Math.sin(a)];
  });

export const AR: [number, number][] = [
  [0, 0.3],
  [0.6, 0.3],
  [0.6, 0.05],
  [1, 0.5],
  [0.6, 0.95],
  [0.6, 0.7],
  [0, 0.7],
];

export const UP: Record<string, [number, number][]> = {
  tri: [
    [0.5, 0],
    [1, 1],
    [0, 1],
  ],
  triD: [
    [0, 0],
    [1, 0],
    [0.5, 1],
  ],
  triR: [
    [0, 0],
    [1, 0.5],
    [0, 1],
  ],
  triL: [
    [1, 0],
    [0, 0.5],
    [1, 1],
  ],
  diamond: [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ],
  para: [
    [0.25, 0],
    [1, 0],
    [0.75, 1],
    [0, 1],
  ],
  pent: poly(5),
  hex: poly(6, 0),
  hept: poly(7),
  oct: poly(8, Math.PI / 8),
  dec: poly(10),
  star4: star(4, 0.4),
  star5: star(5, 0.42),
  star6: star(6, 0.55),
  star8: star(8, 0.6),
  burst: star(12, 0.78),
  arrR: AR,
  arrL: AR.map((q) => [1 - q[0], q[1]]),
  arrU: AR.map((q) => [q[1], 1 - q[0]]),
  arrD: AR.map((q) => [q[1], q[0]]),
};

export const up = (k: string): [number, number][] => UP[k] || UP.tri;

export const SHP: Record<string, string[]> = {
  Dasar: ['rect', 'round', 'ellipse', 'tri', 'triD', 'triR', 'triL', 'diamond', 'para', 'line'],
  Poligon: ['pent', 'hex', 'hept', 'oct', 'dec'],
  Bintang: ['star4', 'star5', 'star6', 'star8', 'burst'],
  Panah: ['arrR', 'arrL', 'arrU', 'arrD', 'arrow'],
};

export function shIcon(k: string): string {
  if (k === 'rect') return '<rect x="4" y="4" width="16" height="16" rx="2" />';
  if (k === 'round') return '<rect x="4" y="4" width="16" height="16" rx="5" />';
  if (k === 'ellipse') return '<circle cx="12" cy="12" r="8.5" />';
  if (k === 'line') return '<path d="M5 19L19 5" style="stroke:currentColor;stroke-width:2" />';
  if (k === 'arrow')
    return '<path d="M5 19L19 5M10 5h9v9" style="stroke:currentColor;stroke-width:2;fill:none" />';
  return `<polygon points="${up(k)
    .map((q) => q.map((v) => (3 + v * 18).toFixed(1)).join(','))
    .join(' ')}" />`;
}

export const STY: Record<PenStyle, [string, string]> = {
  pen: ['Pulpen', '<path d="M12 3l5 6-4 12-4-12z"/><circle cx="12" cy="11" r="1.2"/>'],
  marker: [
    'Spidol',
    '<path d="M4 17l8-8 4 4-6 6H5z"/><path d="M14 7l2-2a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-2 2"/>',
  ],
  pencil: ['Pensil', '<path d="M16.5 3.5l4 4L8 20l-5 1 1-5z"/>'],
};

export const TOOLS: [ToolType, string, string, string][] = [
  ['select', 'Pilih', 'V', '<path d="M4 4l7 17 2.5-7.5L21 11z"/>'],
  [
    'hand',
    'Tangan',
    'H',
    '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7M17 9a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.5-2.7L4 14.5a1.5 1.5 0 0 1 2.4-1.8L8 14"/>',
  ],
  [
    'laser',
    'Laser',
    'L',
    '<circle cx="12" cy="12" r="2.4" style="stroke:#f87171"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M5.6 5.6l2.4 2.4M16 16l2.4 2.4M18.4 5.6L16 8M8 16l-2.4 2.4" style="stroke:#f87171"/>',
  ],
  ['pen', 'Pena', 'P', '<path d="M16.5 3.5l4 4L8 20l-5 1 1-5z"/>'],
  [
    'eraser',
    'Hapus',
    'E',
    '<path d="M20 20H8l-4.3-4.3a1.5 1.5 0 0 1 0-2.1L13.6 3.7a1.5 1.5 0 0 1 2.1 0l4.6 4.6a1.5 1.5 0 0 1 0 2.1L12 19"/><path d="M7 11l6 6"/>',
  ],
  [
    'shape',
    'Bentuk',
    'S',
    '<path d="M12 3l3.5 6h-7z"/><rect x="3.5" y="14" width="6" height="6" rx="1"/><circle cx="17" cy="17" r="3.2"/>',
  ],
  ['text', 'Teks', 'T', '<path d="M5 5V4h14v1M12 4v16M9 20h6"/>'],
  ['table', 'Tabel', 'B', '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9h17M10 9v11.5"/>'],
  [
    'fill',
    'Isi',
    'F',
    '<path d="M5 11l7-7 7 7-7 7z"/><path d="M19 15c1 1.5 1.5 2.5 1.5 3.2a1.5 1.5 0 0 1-3 0c0-.7.5-1.7 1.5-3.2z"/>',
  ],
  ['pick', 'Pipet', 'I', '<path d="M15 4l5 5-3 1-7 7-4 1 1-4 7-7zM4 20l3-3"/>'],
  [
    'conn',
    'Konektor',
    'C',
    '<circle cx="5" cy="12" r="2"/><path d="M7 12h10M14 8l4 4-4 4"/>',
  ],
  [
    'formula',
    'Rumus',
    'M',
    '<path d="M4 4h16l-7 8 7 8H4v-3l8-5-8-5z"/>',
  ],
  [
    'ai',
    'Tanya AI',
    'A',
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" style="stroke:#fbbf24"/>',
  ],
  [
    'upload',
    'Upload',
    'U',
    '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  ],
];

export function shapeStrokes(o: ShapeObj): StrokeObj[] {
  const b = bounds(o);
  const k = o.kind;
  const P = (a: Pt[]): StrokeObj => ({
    id: crypto.randomUUID(),
    type: 'stroke',
    pts: a,
    color: o.color,
    size: o.size,
    st: 'pen',
    op: o.op ?? 1,
  });

  if (k === 'line') {
    return [P([{ x: o.x, y: o.y }, { x: o.x + o.w, y: o.y + o.h }])];
  }

  if (k === 'arrow') {
    const a = Math.atan2(o.h, o.w);
    const s = 12 + o.size * 1.5;
    const t = { x: o.x + o.w, y: o.y + o.h };
    const e = (d: number): Pt => ({
      x: t.x - s * Math.cos(a + d),
      y: t.y - s * Math.sin(a + d),
    });
    return [
      P([{ x: o.x, y: o.y }, t]),
      P([e(-0.45), t, e(0.45)]),
    ];
  }

  const U =
    k === 'rect' || k === 'round'
      ? [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ]
      : k === 'ellipse'
      ? Array.from({ length: 72 }, (_, i) => [
          0.5 + 0.5 * Math.cos((i * Math.PI) / 36),
          0.5 + 0.5 * Math.sin((i * Math.PI) / 36),
        ])
      : up(k);

  return [
    P(
      U.concat([U[0]]).map((u) => ({
        x: b.x + u[0] * b.w,
        y: b.y + u[1] * b.h,
      }))
    ),
  ];
}

