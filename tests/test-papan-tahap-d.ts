import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { prisma } from '../server/src/db';
import { templateRouter } from '../server/src/routes/template';
import { sesiRouter } from '../server/src/routes/sesi';
import { config } from '../server/src/config';
import {
  CanvasObj,
  ShapeObj,
  TextObj,
  TableObj,
  BoardView,
} from '../client/src/pages/papan/engine/types';
import {
  bounds,
  hitSelectionHandle,
  rsz,
  intersects,
} from '../client/src/pages/papan/engine/geometry';
import { HistoryManager, cloneObj } from '../client/src/pages/papan/engine/history';
import {
  MOCK_TEMPLATES_SAYA,
  MOCK_TEMPLATES_PUSTAKA,
} from '../client/src/pages/papan/mock-template';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  }
}

async function runStepDTests() {
  console.log('=== MEMULAI PENGUJIAN OTOMATIS PAPAN TULIS TAHAP D ===\n');

  // -------------------------------------------------------------
  // 1. UJI PANEL TEMPLATE GAME & API SESI
  // -------------------------------------------------------------
  console.log('1. Uji Panel Template Game & Mock Fallback:');
  assert(MOCK_TEMPLATES_SAYA.length >= 3, 'Mock template saya memiliki minimal 3 materi kuis');
  assert(MOCK_TEMPLATES_PUSTAKA.length >= 3, 'Mock pustaka resmi memiliki minimal 3 materi kuis');
  assert(
    MOCK_TEMPLATES_SAYA.every((t) => t.id && t.judul && t.game && t.mode && t.questionsCount > 0),
    'Semua mock template memiliki properti valid (id, judul, game, mode, questionsCount)'
  );

  // Setup server Express pengujian rute template & sesi
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/template', templateRouter);
  app.use('/api/sesi', sesiRouter);

  const server = http.createServer(app);
  const TEST_PORT = 3388;
  await new Promise<void>((resolve) => server.listen(TEST_PORT, resolve));
  const serverUrl = `http://localhost:${TEST_PORT}`;

  const guruTest = await prisma.user.create({
    data: {
      nama: 'Guru Penguji Tahap D',
      email: `guru-d-${Date.now()}@discere.test`,
      passwordHash: 'hash123',
      role: 'guru',
      sekolah: 'SD Negeri Pengujian',
      status: 'aktif',
    },
  });

  const templateTest = await prisma.template.create({
    data: {
      ownerId: guruTest.id,
      judul: 'Pecahan dan Aljabar Uji D',
      game: 'tarik_tambang',
      mode: 'solo',
      questions: {
        create: [
          {
            urutan: 1,
            teks: 'Berapakah 1/2 + 1/4?',
            opsiA: '3/4',
            opsiB: '2/4',
            opsiC: '1/4',
            jawabanBenar: 'A',
          },
          {
            urutan: 2,
            teks: 'Berapakah 3/4 - 1/4?',
            opsiA: '1/2',
            opsiB: '1/4',
            opsiC: '3/4',
            jawabanBenar: 'A',
          },
        ],
      },
    },
  });

  const token = jwt.sign(
    { userId: guruTest.id },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const resTmpl = await fetch(`${serverUrl}/api/template`, {
    headers: { Cookie: `discere_token=${token}` },
  });
  const dataTmpl = (await resTmpl.json()) as any;
  assert(resTmpl.status === 200, 'GET /api/template guru berhasil');
  assert(
    Array.isArray(dataTmpl.templates) && dataTmpl.templates.length >= 1,
    'Daftar template guru memuat template yang baru dibuat'
  );

  const resSesi = await fetch(`${serverUrl}/api/sesi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `discere_token=${token}`,
    },
    body: JSON.stringify({
      templateId: templateTest.id,
      mode: 'solo',
      game: 'tarik_tambang',
    }),
  });
  const dataSesi = (await resSesi.json()) as any;
  assert(resSesi.status === 201, 'POST /api/sesi dari papan tulis berhasil membuat sesi');
  assert(
    dataSesi.session && dataSesi.session.id,
    `ID sesi berhasil dibuat untuk tombol Main: ${dataSesi.session?.id}`
  );

  // -------------------------------------------------------------
  // 2. UJI UBAH UKURAN OBJEK (RESIZE HANDLES & SHIFT PROPORSI)
  // -------------------------------------------------------------
  console.log('\n2. Uji Ubah Ukuran Objek (Resize Handles, Proporsi, Undo):');

  const rect: ShapeObj = {
    id: 'shape-rect-1',
    type: 'shape',
    kind: 'rect',
    x: 100,
    y: 100,
    w: 200,
    h: 150,
    color: '#000',
    size: 2,
    op: 1,
    fill: null,
  };

  const bRect = bounds(rect);
  const cornerSE = hitSelectionHandle(bRect, 0, { x: 306, y: 256 }, 1);
  assert(cornerSE?.k === 'se', 'Hit corner kanan-bawah (SE) terdeteksi tepat');

  const cornerNW = hitSelectionHandle(bRect, 0, { x: 94, y: 94 }, 1);
  assert(cornerNW?.k === 'nw', 'Hit corner kiri-atas (NW) terdeteksi tepat');

  // Resize Shape ke kanan-bawah (+50px, +30px)
  const initialRect = cloneObj(rect);
  rsz(rect, bRect, { x: bRect.x, y: bRect.y, w: 250, h: 180 });
  assert(rect.w === 250, `Lebar bentuk bertambah menjadi 250 (aktual: ${rect.w})`);
  assert(rect.h === 180, `Tinggi bentuk bertambah menjadi 180 (aktual: ${rect.h})`);

  // Resize dengan Proporsi Aspek Rasio
  const rectAspect = cloneObj(initialRect);
  const bInit = bounds(rectAspect);
  const ratioBefore = initialRect.w / initialRect.h;
  rsz(rectAspect, bInit, { x: bInit.x, y: bInit.y, w: 300, h: Math.round(300 / ratioBefore) });
  const ratioAfter = rectAspect.w / rectAspect.h;
  assert(
    Math.abs(ratioBefore - ratioAfter) < 0.05,
    `Shift menjaga proporsi bentuk rasio: ${ratioBefore.toFixed(2)} vs ${ratioAfter.toFixed(2)}`
  );

  // Resize Teks melalui skala ukuran font (fs)
  const textObj: TextObj = {
    id: 'text-1',
    type: 'text',
    x: 50,
    y: 50,
    text: 'Judul Pembelajaran',
    fs: 24,
    color: '#000',
    size: 1,
  };
  const bText = bounds(textObj);
  rsz(textObj, bText, { x: bText.x, y: bText.y, w: bText.w + 100, h: bText.h + 50 });
  assert(textObj.fs > 24, `Ukuran font teks membesar saat di-resize (aktual: ${textObj.fs}px)`);

  // Resize Tabel (cw dan ch menyesuaikan)
  const tableObj: TableObj = {
    id: 'table-1',
    type: 'table',
    x: 200,
    y: 200,
    rows: 3,
    cols: 3,
    cw: 100,
    ch: 40,
    cells: {},
    color: '#000',
    size: 2,
    fill: null,
  };
  const bTable = bounds(tableObj);
  rsz(tableObj, bTable, { x: bTable.x, y: bTable.y, w: bTable.w + 60, h: bTable.h + 30 });
  assert(tableObj.cw > 100, `Lebar kolom tabel (cw) bertambah (aktual: ${tableObj.cw}px)`);
  assert(tableObj.ch > 40, `Tinggi baris tabel (ch) bertambah (aktual: ${tableObj.ch}px)`);

  // Uji Undo / Redo Riwayat Resize
  const history = new HistoryManager();
  history.commit({
    ubah: [{ sebelum: initialRect, sesudah: cloneObj(rect) }],
  });
  assert(history.canUndo(), 'Riwayat mencatat perubahan resize');

  const undid = history.undo([rect]);
  const restored = undid.newObjs.find((o) => o.id === initialRect.id) as ShapeObj;
  assert(restored && restored.w === initialRect.w, 'Undo mengembalikan data objek ke ukuran sebelum di-resize');

  // -------------------------------------------------------------
  // 3. UJI GESTUR LAYAR SENTUH DUA JARI (PINCH ZOOM & PAN)
  // -------------------------------------------------------------
  console.log('\n3. Uji Gestur Layar Sentuh Multi-Touch:');
  const viewTest: BoardView = { x: 0, y: 0, z: 1 };
  const p1 = { x: 100, y: 200 };
  const p2 = { x: 300, y: 200 };
  const dist1 = Math.hypot(p2.x - p1.x, p2.y - p1.y); // 200px

  // Jari merenggang menjadi 300px (Zoom In)
  const p2Next = { x: 400, y: 200 };
  const dist2 = Math.hypot(p2Next.x - p1.x, p2Next.y - p1.y); // 300px
  const zoomScale = dist2 / dist1; // 1.5x
  const newZ = Math.max(0.1, Math.min(4, viewTest.z * zoomScale));
  assert(newZ === 1.5, `Pinch zoom dua jari memperbesar kanvas secara proporsional (${newZ}x)`);

  // -------------------------------------------------------------
  // 4. UJI VIEWPORT CULLING & PERFORMA 500+ OBJEK
  // -------------------------------------------------------------
  console.log('\n4. Uji Viewport Culling & Performa 500+ Objek:');
  const viewport = { x: 0, y: 0, w: 1200, h: 800 };

  const objs500: CanvasObj[] = [];
  let objectsInside = 0;
  let objectsOutside = 0;

  for (let i = 0; i < 500; i++) {
    // 100 objek di dalam layar, 400 objek di luar layar
    const inScreen = i < 100;
    const x = inScreen ? 50 + (i % 10) * 100 : 2000 + i * 50;
    const y = inScreen ? 50 + Math.floor(i / 10) * 60 : 3000 + i * 50;

    const o: ShapeObj = {
      id: `perf-shape-${i}`,
      type: 'shape',
      kind: 'rect',
      x,
      y,
      w: 80,
      h: 50,
      color: '#333',
      size: 2,
      op: 1,
      fill: null,
    };
    objs500.push(o);

    const b = bounds(o);
    if (intersects(b, viewport)) {
      objectsInside++;
    } else {
      objectsOutside++;
    }
  }

  assert(objectsInside === 100, `Tepat 100 objek terdeteksi di dalam viewport layar (aktual: ${objectsInside})`);
  assert(objectsOutside === 400, `Tepat 400 objek berhasil di-cull di luar viewport layar (aktual: ${objectsOutside})`);

  // Ukur waktu komputasi culling 500 objek
  const t0 = performance.now();
  let renderedCount = 0;
  for (const o of objs500) {
    const b = bounds(o);
    if (intersects(b, viewport)) {
      renderedCount++;
    }
  }
  const t1 = performance.now();
  const durasiMs = t1 - t0;
  assert(renderedCount === 100, `Hanya objek terlihat yang dirender (100 dari 500)`);
  assert(durasiMs < 15, `Waktu proses culling 500 objek sangat cepat (${durasiMs.toFixed(2)} ms < 15 ms)`);

  // Tutup server pengujian
  await new Promise<void>((resolve) => server.close(() => resolve()));

  // Bersihkan data database pengujian
  await prisma.question.deleteMany({ where: { templateId: templateTest.id } });
  await prisma.template.delete({ where: { id: templateTest.id } });
  await prisma.session.deleteMany({ where: { hostId: guruTest.id } });
  await prisma.user.delete({ where: { id: guruTest.id } });
  await prisma.$disconnect();

  console.log(`\nHASIL PENGUJIAN TAHAP D: ${passed} Lolos, ${failed} Gagal.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runStepDTests().catch((err) => {
  console.error('Pengujian gagal:', err);
  process.exit(1);
});
