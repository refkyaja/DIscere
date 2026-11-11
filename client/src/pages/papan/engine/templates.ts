import { CanvasObj, TextObj, ShapeObj } from './types';
import { bounds } from './geometry';

export type TemplateType = 'mind' | 'kanban' | 'swot' | 'alur';

function text(
  x: number,
  y: number,
  t: string,
  fs: number,
  col: string,
  fill: string | null = null,
  fw: number | string = 700
): TextObj {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    x,
    y,
    text: t,
    fs,
    fw,
    color: col,
    fill,
    size: 1,
  };
}

function shape(
  kind: string,
  x: number,
  y: number,
  w: number,
  h: number,
  col: string,
  fill: string | null = null,
  ss = 3
): ShapeObj {
  return {
    id: crypto.randomUUID(),
    type: 'shape',
    kind,
    x,
    y,
    w,
    h,
    color: col,
    size: ss,
    fill,
  };
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  col: string,
  kind = 'line',
  ss = 3
): ShapeObj {
  return {
    id: crypto.randomUUID(),
    type: 'shape',
    kind,
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    color: col,
    size: ss,
    fill: null,
  };
}

function centerText(t: TextObj, targetX: number, targetY: number): TextObj {
  const b = bounds(t);
  t.x = targetX - b.w / 2;
  t.y = targetY - b.h / 2;
  return t;
}

export function generateTemplate(type: TemplateType): CanvasObj[] {
  if (type === 'mind') {
    const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#06b6d4'];
    const linesArr: CanvasObj[] = [];
    const nodes: CanvasObj[] = [];

    const centerNode = centerText(
      text(0, 0, 'Topik Utama', 28, '#ffffff', '#9b17f5', 800),
      0,
      0
    );

    colors.forEach((c, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const x = Math.round(Math.cos(angle) * 320);
      const y = Math.round(Math.sin(angle) * 220);

      nodes.push(centerText(text(0, 0, `Cabang ${i + 1}`, 22, '#ffffff', c), x, y));
      linesArr.push(line(0, 0, x, y, c, 'line', 3));
    });

    return [...linesArr, centerNode, ...nodes];
  }

  if (type === 'kanban') {
    const list: CanvasObj[] = [];
    const columns: Array<[string, string]> = [
      ['Akan Dikerjakan', '#64748b'],
      ['Sedang Dikerjakan', '#f59e0b'],
      ['Selesai', '#22c55e'],
    ];

    columns.forEach(([colTitle, colColor], i) => {
      const x = i * 300;
      list.push(
        shape('round', x, 0, 270, 460, '#cbd5e1', '#f1f5f9', 2),
        centerText(text(0, 0, colTitle, 19, '#ffffff', colColor, 700), x + 135, 34)
      );
    });

    list.push(
      text(20, 85, 'Tugas Contoh 1:\nRiset materi pembelajaran', 16, '#111827', '#fde68a', 600),
      text(320, 85, 'Tugas Contoh 2:\nMembuat lembar kerja siswa', 16, '#111827', '#fde68a', 600)
    );

    return list;
  }

  if (type === 'swot') {
    const list: CanvasObj[] = [];
    const quadrants: Array<[string, string, number, number]> = [
      ['Kekuatan (Strengths)', '#bbf7d0', 0, 0],
      ['Kelemahan (Weaknesses)', '#fecaca', 1, 0],
      ['Peluang (Opportunities)', '#bfdbfe', 0, 1],
      ['Ancaman (Threats)', '#fde68a', 1, 1],
    ];

    quadrants.forEach(([title, fillBg, colIdx, rowIdx]) => {
      const x = colIdx * 320;
      const y = rowIdx * 250;
      list.push(
        shape('rect', x, y, 310, 240, '#475569', fillBg, 2),
        text(x + 18, y + 16, title, 20, '#111827', null, 800)
      );
    });

    return list;
  }

  if (type === 'alur') {
    const list: CanvasObj[] = [];
    const addNode = (
      kind: string,
      y: number,
      w: number,
      h: number,
      t: string,
      fillBg: string
    ) => {
      list.push(
        shape(kind, -w / 2, y - h / 2, w, h, '#334155', fillBg, 2.5),
        centerText(text(0, 0, t, 19, '#111827', null, 700), 0, y)
      );
    };

    addNode('ellipse', 0, 200, 64, 'Mulai', '#bbf7d0');
    addNode('rect', 125, 220, 70, 'Proses Aktivitas', '#bfdbfe');
    addNode('diamond', 265, 230, 110, 'Keputusan?', '#fde68a');
    addNode('ellipse', 415, 200, 64, 'Selesai', '#fecaca');

    const arrows: Array<[number, number]> = [
      [32, 90],
      [160, 210],
      [320, 383],
    ];
    arrows.forEach(([y1, y2]) => {
      list.push(line(0, y1, 0, y2, '#334155', 'arrow', 2.5));
    });

    return list;
  }

  return [];
}

