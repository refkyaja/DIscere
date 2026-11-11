import { CanvasObj, BoardDataFormat, BoardPage } from './types';
import { bounds } from './geometry';
import { drawObj } from './render';
import { cloneObj } from './history';

export function potongArea(
  objs: CanvasObj[],
  area: { x: number; y: number; w: number; h: number },
  padding = 24
): string {
  const m = padding;
  const k = Math.min(2, 1400 / Math.max(area.w, area.h, 1));
  const cn = document.createElement('canvas');
  cn.width = Math.max(1, (area.w + 2 * m) * k);
  cn.height = Math.max(1, (area.h + 2 * m) * k);
  const x = cn.getContext('2d');
  if (!x) return '';
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, cn.width, cn.height);
  x.scale(k, k);
  x.translate(m - area.x, m - area.y);
  for (const o of objs) {
    drawObj(x, o);
  }
  return cn.toDataURL('image/png');
}

export function pngDataUrl(objs: CanvasObj[]): string | null {
  if (objs.length === 0) return null;
  let a = 1e9,
    b = 1e9,
    c = -1e9,
    d = -1e9;
  for (const o of objs) {
    const r = bounds(o);
    a = Math.min(a, r.x);
    b = Math.min(b, r.y);
    c = Math.max(c, r.x + r.w);
    d = Math.max(d, r.y + r.h);
  }

  const m = 40;
  const k = 2;
  const cn = document.createElement('canvas');
  cn.width = Math.max(1, (c - a + m * 2) * k);
  cn.height = Math.max(1, (d - b + m * 2) * k);
  const x = cn.getContext('2d');
  if (!x) return null;
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, cn.width, cn.height);
  x.scale(k, k);
  x.translate(m - a, m - b);
  for (const o of objs) {
    drawObj(x, o);
  }
  return cn.toDataURL('image/png');
}

export function downloadPng(objs: CanvasObj[], title = 'papan'): boolean {
  const data = pngDataUrl(objs);
  if (!data) return false;
  const a = document.createElement('a');
  a.download = `${title || 'papan'}.png`;
  a.href = data;
  a.click();
  return true;
}

export function renderCanvasToJpeg(objs: CanvasObj[]): { buffer: Uint8Array; width: number; height: number } | null {
  if (objs.length === 0) return null;
  let a = 1e9,
    b = 1e9,
    c = -1e9,
    d = -1e9;
  for (const o of objs) {
    const r = bounds(o);
    a = Math.min(a, r.x);
    b = Math.min(b, r.y);
    c = Math.max(c, r.x + r.w);
    d = Math.max(d, r.y + r.h);
  }

  const m = 40;
  const k = 2;
  const cn = document.createElement('canvas');
  const w = Math.max(1, Math.round((c - a + m * 2) * k));
  const h = Math.max(1, Math.round((d - b + m * 2) * k));
  cn.width = w;
  cn.height = h;
  const x = cn.getContext('2d');
  if (!x) return null;
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, w, h);
  x.scale(k, k);
  x.translate(m - a, m - b);
  for (const o of objs) {
    drawObj(x, o);
  }

  const dataUrl = cn.toDataURL('image/jpeg', 0.92);
  const base64Data = dataUrl.split(',')[1];
  const binary = atob(base64Data);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }

  return { buffer, width: w, height: h };
}

export function downloadPdf(
  source: CanvasObj[] | BoardPage[],
  title = 'papan'
): boolean {
  const pagesList: CanvasObj[][] = [];
  if (Array.isArray(source) && source.length > 0) {
    if ('objs' in source[0]) {
      for (const p of source as BoardPage[]) {
        if (p.objs && p.objs.length > 0) {
          pagesList.push(p.objs);
        }
      }
    } else {
      pagesList.push(source as CanvasObj[]);
    }
  }

  if (pagesList.length === 0) return false;

  const renderedPages: { buffer: Uint8Array; width: number; height: number }[] = [];
  for (const objs of pagesList) {
    const rendered = renderCanvasToJpeg(objs);
    if (rendered) {
      renderedPages.push(rendered);
    }
  }

  if (renderedPages.length === 0) return false;

  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  let cur = 0;

  function pushStr(s: string) {
    const b = enc.encode(s);
    parts.push(b);
    cur += b.length;
  }

  function pushBytes(b: Uint8Array) {
    parts.push(b);
    cur += b.length;
  }

  const offsets: number[] = [];
  pushStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const pageCount = renderedPages.length;
  offsets[1] = cur;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = cur;
  const kidsStr = Array.from({ length: pageCount }, (_, i) => `${3 + i * 3} 0 R`).join(' ');
  pushStr(`2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageCount} >>\nendobj\n`);

  for (let i = 0; i < pageCount; i++) {
    const p = renderedPages[i];
    const pageNum = 3 + i * 3;
    const imgNum = 4 + i * 3;
    const contentNum = 5 + i * 3;

    let pageW = 842;
    let pageH = (p.height / p.width) * pageW;
    if (pageH > 595) {
      pageH = 595;
      pageW = (p.width / p.height) * pageH;
    }

    const contentStr = `q\n${pageW.toFixed(2)} 0 0 ${pageH.toFixed(2)} 0 0 cm\n/Im${i} Do\nQ\n`;
    const contentBytes = enc.encode(contentStr);

    offsets[pageNum] = cur;
    pushStr(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(
        2
      )} ${pageH.toFixed(2)}] /Resources << /XObject << /Im${i} ${imgNum} 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`
    );

    offsets[imgNum] = cur;
    pushStr(
      `${imgNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.buffer.length} >>\nstream\n`
    );
    pushBytes(p.buffer);
    pushStr('\nendstream\nendobj\n');

    offsets[contentNum] = cur;
    pushStr(`${contentNum} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushStr('\nendstream\nendobj\n');
  }

  const totalObjs = 2 + pageCount * 3;
  const startxref = cur;
  let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjs; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  xref += `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  pushStr(xref);

  const totalLength = parts.reduce((acc, part) => acc + part.length, 0);
  const finalPdf = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of parts) {
    finalPdf.set(part, pos);
    pos += part.length;
  }

  const blob = new Blob([finalPdf as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `${title || 'papan'}.pdf`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export function toJson(
  data: CanvasObj[] | BoardDataFormat | { pages?: BoardPage[]; currentPageIndex?: number; objs?: CanvasObj[] },
  currentPageIndex = 0
): string {
  if (Array.isArray(data)) {
    const cleanObjs = data.map(cloneObj);
    const payload: BoardDataFormat = {
      versi: 1,
      objs: cleanObjs,
    };
    return JSON.stringify(payload);
  }

  if ('pages' in data && data.pages && Array.isArray(data.pages)) {
    const cleanPages = data.pages.map((p) => ({
      ...p,
      objs: p.objs.map(cloneObj),
      view: p.view ? { ...p.view } : undefined,
    }));

    const activeIndex = data.currentPageIndex ?? currentPageIndex;
    const currentObjs = cleanPages[activeIndex]?.objs || cleanPages[0]?.objs || [];

    const payload = {
      versi: 2,
      pages: cleanPages,
      currentPageIndex: activeIndex,
      objs: currentObjs,
    };
    return JSON.stringify(payload);
  }

  if ('objs' in data && data.objs && Array.isArray(data.objs)) {
    return JSON.stringify({
      versi: 1,
      objs: data.objs.map(cloneObj),
    });
  }

  return JSON.stringify({ versi: 1, objs: [] });
}

export function downloadJson(
  data: CanvasObj[] | BoardDataFormat | { pages?: BoardPage[]; currentPageIndex?: number; objs?: CanvasObj[] },
  title = 'papan'
): void {
  const jsonStr = toJson(data);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `${title || 'papan'}.json`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Batas keamanan: gambar yang diunggah diperkecil lewat canvas
 * (sisi terpanjang maksimal 1280 px, JPEG kualitas 0.8) sebelum disimpan sebagai dataURL.
 */
export async function resizeImageToDataUrl(file: File): Promise<{
  src: string;
  w: number;
  h: number;
}> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File bukan gambar'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memuat elemen gambar'));
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const maxSide = 1280;

        if (w > maxSide || h > maxSide) {
          if (w >= h) {
            h = Math.round((h * maxSide) / w);
            w = maxSide;
          } else {
            w = Math.round((w * maxSide) / h);
            h = maxSide;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context tidak tersedia'));
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve({ src: dataUrl, w, h });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

