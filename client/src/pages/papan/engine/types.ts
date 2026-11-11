export interface Pt {
  x: number;
  y: number;
  pr?: number; // Pen pressure 0..1 (stylus / pena digital)
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PenStyle = 'pen' | 'marker' | 'pencil';

export interface BaseObj {
  id: string; // UUID v4
  color: string;
  size: number;
  op?: number; // Opasitas 0..1
  rot?: number; // Sudut rotasi dalam radian (0 = tegak)
  g?: string; // ID grup objek (untuk group / ungroup)
  lock?: boolean; // Status kunci objek (tidak bisa diubah jika true)
}

export interface StrokeObj extends BaseObj {
  type: 'stroke';
  pts: Pt[];
  st: PenStyle;
}

export interface ShapeObj extends BaseObj {
  type: 'shape';
  kind: string; // 'rect' | 'round' | 'ellipse' | 'tri' | 'line' | 'arrow' | 'diamond' | 'para' | dst.
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string | null;
}

export interface TextObj extends BaseObj {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fs: number; // Font size (px)
  fw?: number | string; // Font weight, default 600
  fill: string | null;
  ai?: boolean;
}

export interface TableObj extends BaseObj {
  type: 'table';
  x: number;
  y: number;
  rows: number;
  cols: number;
  cw: number;
  ch: number;
  cells: Record<string, string>; // "row,col": text
  fill: string | null;
}

export interface ImageObj extends BaseObj {
  type: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  src: string; // dataURL JPEG/PNG
  _i?: HTMLImageElement; // cache internal HTMLImageElement, jangan disimpan ke JSON
}

export type ResizeCorner = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type HandleKey = ResizeCorner | 'rot';

export interface SelectionHandle extends Pt {
  k: HandleKey;
}

export interface FormulaObj extends BaseObj {
  type: 'formula';
  x: number;
  y: number;
  tex: string;
  fs: number;
}

export interface ConnObj extends BaseObj {
  type: 'conn';
  a: string; // ID objek asal
  b: string; // ID objek tujuan
  ar?: boolean; // Panah (true/undefined) atau garis lurus (false)
}

export type CanvasObj =
  | StrokeObj
  | ShapeObj
  | TextObj
  | TableObj
  | ImageObj
  | FormulaObj
  | ConnObj;

export interface BoardPage {
  id: string;
  objs: CanvasObj[];
  view?: BoardView;
  judul?: string;
}

export interface BoardDataFormat {
  versi: 1 | 2;
  objs?: CanvasObj[];
  pages?: BoardPage[];
  currentPageIndex?: number;
}

export type ToolType =
  | 'select'
  | 'hand'
  | 'laser'
  | 'pen'
  | 'eraser'
  | 'shape'
  | 'text'
  | 'table'
  | 'fill'
  | 'pick'
  | 'ai'
  | 'upload'
  | 'zoom'
  | 'conn'
  | 'formula';

export interface BoardView {
  x: number;
  y: number;
  z: number;
}

export interface BoardState {
  tool: ToolType;
  color: string;
  size: number;
  er: number;
  style: PenStyle;
  op: number;
  ss: number;
  tab: string; // 'Dasar' | 'Poligon' | 'Bintang' | 'Panah'
  shape: string;
  fs: number;
  tsz: number;
  lc: string;
  grid: boolean;
  fill?: string | null;
  cs?: 'arrow' | 'line';
}

export interface LocalOp {
  tambah?: CanvasObj[];
  hapus?: CanvasObj[];
  ubah?: { sebelum: CanvasObj; sesudah: CanvasObj }[];
  reorder?: { sebelum: string[]; sesudah: string[] };
}

export interface UbahEventPayload {
  tambah?: CanvasObj[];
  ubah?: CanvasObj[];
  hapus?: string[];
  reorder?: string[];
}

export interface LaserPoint extends Pt {
  t: number;
}

export interface TextEditorState {
  obj: TextObj | TableObj | null;
  r?: number;
  c?: number;
  x: number;
  y: number;
  text: string;
}

export interface CollaboratorBadge {
  id: string;
  name: string;
  x: number;
  y: number;
  color?: string;
  label?: string;
}

