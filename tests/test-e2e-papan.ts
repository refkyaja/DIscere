import { io as ioClient } from 'socket.io-client';

const BASE_URL = 'http://localhost:3000';

async function runTest() {
  console.log('🚀 Memulai Pengujian E2E Papan Tulis dan Kolaborasi Discere (Tahap 6)...');

  // 1. Login Guru
  console.log('1. Login Guru Demo...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/masuk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'guru@discere.local',
      kataSandi: 'GuruDiscere2026!',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login guru gagal: ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const ownerId = loginData.user.id;
  const cookie = loginRes.headers.get('set-cookie')!.split(';')[0];
  console.log(`✓ Login Guru berhasil (${loginData.user.nama}, ID: ${ownerId}).`);

  // 2. Buat Papan Tulis Baru
  console.log('2. Membuat Papan Tulis Baru (POST /api/papan)...');
  const buatRes = await fetch(`${BASE_URL}/api/papan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ judul: 'Papan Eksperimen Fisika Kelas 8' }),
  });
  const buatData = await buatRes.json();
  if (!buatRes.ok || !buatData.board?.id) {
    throw new Error(`Gagal membuat papan baru: ${JSON.stringify(buatData)}`);
  }
  const boardId = buatData.board.id;
  console.log(`✓ Papan dibuat: "${buatData.board.judul}" (ID: ${boardId})`);

  // 3. Ganti Judul Papan
  console.log('3. Mengubah Judul Papan (PATCH /api/papan/:id/judul)...');
  const gantiJudulRes = await fetch(`${BASE_URL}/api/papan/${boardId}/judul`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ judul: 'Papan Pembelajaran Fisika Terpadu' }),
  });
  const gantiJudulData = await gantiJudulRes.json();
  if (!gantiJudulRes.ok || gantiJudulData.board?.judul !== 'Papan Pembelajaran Fisika Terpadu') {
    throw new Error(`Gagal mengubah judul: ${JSON.stringify(gantiJudulData)}`);
  }
  console.log('✓ Judul papan berhasil diubah.');

  // 4. Autosave Kanvas Fabric.js
  console.log('4. Menguji Autosave Kanvas (PUT /api/papan/:id)...');
  const sampleCanvasJson = JSON.stringify({
    versi: 1,
    objs: [
      {
        id: 'obj-rect-1',
        t: 'rect',
        x: 100,
        y: 100,
        w: 150,
        h: 100,
        c: '#D7262E',
      },
      {
        id: 'obj-text-1',
        t: 'text',
        x: 300,
        y: 120,
        text: 'Gaya Gravitasi',
        fontSize: 28,
        c: '#1E2A5A',
      },
    ],
  });

  const autosaveRes = await fetch(`${BASE_URL}/api/papan/${boardId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ data: sampleCanvasJson }),
  });
  const autosaveData = await autosaveRes.json();
  if (!autosaveRes.ok) {
    throw new Error(`Gagal autosave: ${JSON.stringify(autosaveData)}`);
  }
  console.log('✓ Autosave berhasil disimpan ke database.');

  // 5. Verifikasi Pemulihan Data Kanvas
  console.log('5. Menguji Pemulihan Data Kanvas (GET /api/papan/:id)...');
  const detailRes = await fetch(`${BASE_URL}/api/papan/${boardId}`, {
    headers: { Cookie: cookie },
  });
  const detailData = await detailRes.json();
  if (!detailRes.ok || !detailData.board?.data.includes('Gaya Gravitasi')) {
    throw new Error(`Data papan tidak sesuai: ${JSON.stringify(detailData)}`);
  }
  console.log('✓ Data kanvas berhasil dipulihkan secara utuh.');

  // 6. Buat Tautan Berbagi (Viewer dan Editor)
  console.log('6. Membuat Tautan Berbagi (POST /api/papan/:id/bagikan)...');
  const shareViewerRes = await fetch(`${BASE_URL}/api/papan/${boardId}/bagikan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ peran: 'viewer' }),
  });
  const viewerData = await shareViewerRes.json();
  const viewerToken = viewerData.share.token;

  const shareEditorRes = await fetch(`${BASE_URL}/api/papan/${boardId}/bagikan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ peran: 'editor' }),
  });
  const editorData = await shareEditorRes.json();
  const editorToken = editorData.share.token;

  console.log(`✓ Tautan Viewer: /b/${viewerToken}`);
  console.log(`✓ Tautan Editor: /b/${editorToken}`);

  // 7. Uji Otorisasi: Viewer Ditolak Simpan Perubahan, Editor Diizinkan
  console.log('7. Menguji Pembatasan Otorisasi Viewer vs Editor...');
  const viewerEditRes = await fetch(`${BASE_URL}/api/papan/share/${viewerToken}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: sampleCanvasJson }),
  });
  if (viewerEditRes.status !== 403) {
    throw new Error(`Keamanan jebol: Viewer seharusnya ditolak (403), tapi mengembalikan ${viewerEditRes.status}`);
  }
  console.log('✓ Viewer berhasil ditolak oleh server saat mencoba menyimpan perubahan (403 Forbidden).');

  const editorEditRes = await fetch(`${BASE_URL}/api/papan/share/${editorToken}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: sampleCanvasJson }),
  });
  if (!editorEditRes.ok) {
    throw new Error(`Editor gagal menyimpan perubahan: ${await editorEditRes.text()}`);
  }
  console.log('✓ Editor berhasil menyimpan perubahan ke papan bersama (200 OK).');

  // 8. Uji Kolaborasi Real-Time Socket.IO (Owner, Editor, Viewer)
  console.log('8. Menguji Kolaborasi Real-Time Socket.IO...');
  const ownerSocket = ioClient(BASE_URL, { transports: ['websocket'] });
  const editorSocket = ioClient(BASE_URL, { transports: ['websocket'] });
  const viewerSocket = ioClient(BASE_URL, { transports: ['websocket'] });

  await Promise.all([
    new Promise((resolve) => ownerSocket.on('connect', resolve)),
    new Promise((resolve) => editorSocket.on('connect', resolve)),
    new Promise((resolve) => viewerSocket.on('connect', resolve)),
  ]);

  // Bergabung ke ruang papan
  const ownerJoinPromise = new Promise<any>((resolve) => {
    ownerSocket.emit('papan:gabung', { boardId, userId: ownerId, nama: 'Guru Pengajar' }, resolve);
  });
  const editorJoinPromise = new Promise<any>((resolve) => {
    editorSocket.emit('papan:gabung', { boardId, token: editorToken, nama: 'Budi (Editor)' }, resolve);
  });
  const viewerJoinPromise = new Promise<any>((resolve) => {
    viewerSocket.emit('papan:gabung', { boardId, token: viewerToken, nama: 'Siti (Viewer)' }, resolve);
  });

  const [ownerJoin, editorJoin, viewerJoin] = await Promise.all([
    ownerJoinPromise,
    editorJoinPromise,
    viewerJoinPromise,
  ]);

  if (!ownerJoin.success || (!ownerJoin.isOwner && ownerJoin.peran !== 'owner')) {
    throw new Error(`Owner join gagal: ${JSON.stringify(ownerJoin)}`);
  }
  if (!editorJoin.success || editorJoin.peran !== 'editor') {
    throw new Error(`Editor join gagal: ${JSON.stringify(editorJoin)}`);
  }
  if (!viewerJoin.success || viewerJoin.peran !== 'viewer') {
    throw new Error(`Viewer join gagal: ${JSON.stringify(viewerJoin)}`);
  }
  console.log('✓ Semua 3 kolaborator berhasil masuk dengan hak akses yang tepat.');

  // Editor Mengirim Perubahan -> Viewer Menerima
  console.log('9. Editor menyiarkan objek baru, memeriksa apakah Viewer menerima...');
  const viewerTerimaPromise = new Promise<any>((resolve) => {
    viewerSocket.once('papan:ubah', resolve);
  });

  editorSocket.emit('papan:ubah', {
    boardId,
    tambah: [{ id: 'obj-circ-1', type: 'shape', t: 'circle', x: 400, y: 200, w: 80, h: 80, c: '#10B981' }],
  });

  const updateDiterima = await viewerTerimaPromise;
  if (!updateDiterima || !updateDiterima.tambah || updateDiterima.tambah.length === 0) {
    throw new Error(`Viewer tidak menerima pembaruan real-time: ${JSON.stringify(updateDiterima)}`);
  }
  console.log('✓ Viewer berhasil menerima pembaruan objek secara real-time dari Editor.');

  // Keamanan Socket: Viewer mencoba mengirimkan perubahan -> Server menolak!
  console.log('10. Menguji penolakan server jika Viewer mencoba mengirim perubahan via socket...');
  const viewerKirimPromise = new Promise<any>((resolve) => {
    viewerSocket.emit(
      'papan:ubah',
      {
        boardId,
        tambah: [{ id: 'obj-rect-illegal', type: 'shape', t: 'rect', x: 10, y: 10, w: 50, h: 50 }],
      },
      resolve
    );
  });

  const viewerKirimRes = await viewerKirimPromise;
  if (viewerKirimRes.success !== false) {
    throw new Error(`Keamanan socket jebol: Viewer diizinkan mengirim perubahan: ${JSON.stringify(viewerKirimRes)}`);
  }
  console.log(`✓ Server berhasil menolak Viewer di socket: "${viewerKirimRes.pesan}"`);

  // Pencabutan Akses
  console.log('11. Menguji Pencabutan Akses oleh Pemilik Papan...');
  const aksesDicabutPromise = new Promise<any>((resolve) => {
    viewerSocket.once('papan:akses_dicabut', resolve);
  });

  ownerSocket.emit('papan:cabut_akses', { boardId, token: viewerToken });
  const aksesDicabutData = await aksesDicabutPromise;
  if (aksesDicabutData.token !== viewerToken) {
    throw new Error('Token pencabutan tidak cocok.');
  }
  console.log('✓ Sinyal pencabutan akses berhasil disiarkan ke Viewer.');

  // Bersihkan koneksi socket
  ownerSocket.disconnect();
  editorSocket.disconnect();
  viewerSocket.disconnect();

  // Hapus papan
  console.log('12. Membersihkan Papan Tulis Uji (DELETE /api/papan/:id)...');
  const hapusRes = await fetch(`${BASE_URL}/api/papan/${boardId}`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  if (!hapusRes.ok) {
    throw new Error('Gagal menghapus papan uji.');
  }
  console.log('✓ Papan uji berhasil dihapus.');

  console.log('\n🎉 SEMUA 12/12 PENGUJIAN E2E PAPAN TULIS & KOLABORASI BERHASIL DENGAN SEMPURNA! 🎉');
}

runTest().catch((err) => {
  console.error('\n❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
