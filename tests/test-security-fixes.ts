import assert from 'assert';
import http from 'http';
import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { prisma } from '../server/src/db.js';
import { config } from '../server/src/config.js';
import { authRouter } from '../server/src/routes/auth.js';
import { templateRouter } from '../server/src/routes/template.js';
import { sesiRouter } from '../server/src/routes/sesi.js';
import { papanRouter } from '../server/src/routes/papan.js';
import { errorHandler } from '../server/src/middleware/error.js';
import { setupMultiplayerSocket } from '../server/src/realtime/sesi.js';
import { setupBoardSocket } from '../server/src/realtime/papan.js';

function waitForEvent<T = any>(socket: ClientSocket, event: string, timeoutMs = 6000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout menunggu event '${event}' (${timeoutMs}ms)`));
    }, timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function emitWithAck<T = any>(socket: ClientSocket, event: string, payload: any, timeoutMs = 6000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout ack untuk event '${event}' (${timeoutMs}ms)`));
    }, timeoutMs);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

async function main() {
  console.log('\n=============================================================');
  console.log('🔐 PENGUJIAN REGRESI KEAMANAN & DATA MULTI-HALAMAN DISCERE');
  console.log('=============================================================\n');

  const app = express();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true },
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/template', templateRouter);
  app.use('/api/sesi', sesiRouter);
  app.use('/api/papan', papanRouter);
  app.use(errorHandler);

  setupMultiplayerSocket(io);
  setupBoardSocket(io);

  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const addr = httpServer.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const createdUserIds: string[] = [];
  const createdTemplateIds: string[] = [];
  const createdSessionIds: string[] = [];
  const createdBoardIds: string[] = [];
  const openSockets: ClientSocket[] = [];
  const originalIsProduction = config.isProduction;

  const connectClient = async (cookie?: string): Promise<ClientSocket> => {
    const sock = ioClient(baseUrl, {
      transports: ['websocket'],
      ...(cookie ? { extraHeaders: { cookie } } : {}),
    });
    openSockets.push(sock);
    await waitForEvent(sock, 'connect');
    return sock;
  };

  try {
    const suffix = crypto.randomBytes(4).toString('hex');
    const emailA = `guru_a_${suffix}@discere.local`;
    const emailB = `guru_b_${suffix}@discere.local`;
    const password = 'PasswordUji2026!';

    // Daftar Guru A & Guru B
    const regARes = await fetch(`${baseUrl}/api/auth/daftar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: 'Guru A', email: emailA, kataSandi: password }),
    });
    assert.strictEqual(regARes.status, 201);
    const regAData: any = await regARes.json();
    const userAId: string = regAData.user.id;
    const cookieA = regARes.headers.get('set-cookie')!.split(';')[0];
    createdUserIds.push(userAId);

    const regBRes = await fetch(`${baseUrl}/api/auth/daftar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: 'Guru B', email: emailB, kataSandi: password }),
    });
    assert.strictEqual(regBRes.status, 201);
    const regBData: any = await regBRes.json();
    const userBId: string = regBData.user.id;
    const cookieB = regBRes.headers.get('set-cookie')!.split(';')[0];
    createdUserIds.push(userBId);

    // -----------------------------------------------------------------------
    // 1. Cookie HTTP LAN vs HTTPS di NODE_ENV=production
    // -----------------------------------------------------------------------
    console.log('1. Menguji atribut Secure cookie di NODE_ENV=production (HTTP vs HTTPS proxy)...');
    config.isProduction = true;

    const httpLoginRes = await fetch(`${baseUrl}/api/auth/masuk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, kataSandi: password }),
    });
    assert.strictEqual(httpLoginRes.status, 200);
    const httpSetCookie = httpLoginRes.headers.get('set-cookie') || '';
    assert.ok(httpSetCookie.includes('discere_token='), 'Cookie discere_token harus dikirim');
    assert.ok(httpSetCookie.includes('HttpOnly'), 'Cookie harus HttpOnly');
    assert.strictEqual(
      /\bSecure\b/i.test(httpSetCookie),
      false,
      `Permintaan HTTP LAN tidak boleh menandai cookie Secure (${httpSetCookie})`
    );

    const httpsProxyLoginRes = await fetch(`${baseUrl}/api/auth/masuk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-Proto': 'https',
      },
      body: JSON.stringify({ email: emailA, kataSandi: password }),
    });
    assert.strictEqual(httpsProxyLoginRes.status, 200);
    const httpsSetCookie = httpsProxyLoginRes.headers.get('set-cookie') || '';
    assert.strictEqual(
      /\bSecure\b/i.test(httpsSetCookie),
      true,
      `Permintaan HTTPS proxy harus menandai cookie Secure (${httpsSetCookie})`
    );

    const httpLogoutRes = await fetch(`${baseUrl}/api/auth/keluar`, { method: 'POST' });
    const httpClearCookie = httpLogoutRes.headers.get('set-cookie') || '';
    assert.strictEqual(/\bSecure\b/i.test(httpClearCookie), false);

    config.isProduction = originalIsProduction;
    console.log('✓ Cookie auth aman untuk HTTP LAN maupun HTTPS reverse proxy.');

    // -----------------------------------------------------------------------
    // 2. IDOR Template Privat pada POST /api/sesi
    // -----------------------------------------------------------------------
    console.log('2. Menguji proteksi IDOR template privat pada POST /api/sesi...');
    const tplRes = await fetch(`${baseUrl}/api/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        judul: `Template Privat ${suffix}`,
        game: 'tarik_tambang',
        mode: 'multi',
        questions: [
          {
            teks: '2 + 2 = ?',
            opsiA: '3',
            opsiB: '4',
            opsiC: '5',
            opsiD: '6',
            jawabanBenar: 'B',
            kesulitan: 'mudah',
          },
          {
            teks: '3 + 3 = ?',
            opsiA: '6',
            opsiB: '7',
            opsiC: '8',
            opsiD: '9',
            jawabanBenar: 'A',
            kesulitan: 'mudah',
          },
        ],
      }),
    });
    assert.strictEqual(tplRes.status, 201);
    const tplData: any = await tplRes.json();
    const privateTplId: string = tplData.template.id;
    createdTemplateIds.push(privateTplId);

    // Guru B mencoba membuat sesi memakai template privat Guru A -> harus 403!
    const idorRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieB },
      body: JSON.stringify({ templateId: privateTplId, mode: 'multi' }),
    });
    assert.strictEqual(idorRes.status, 403, 'Guru lain tidak boleh memakai template privat via POST /api/sesi');

    // Guru A memakai templatenya sendiri -> 201!
    const ownSesiRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ templateId: privateTplId, mode: 'multi' }),
    });
    assert.strictEqual(ownSesiRes.status, 201);
    const ownSesiData: any = await ownSesiRes.json();
    const tarikSessionId: string = ownSesiData.session.id;
    createdSessionIds.push(tarikSessionId);
    console.log('✓ IDOR template privat pada POST /api/sesi ditolak (403).');

    // -----------------------------------------------------------------------
    // 3. Kontrol Host Socket.IO Game (sesi:host_join, acak_tim, pindah_tim, mulai, akhiri_manual)
    // -----------------------------------------------------------------------
    console.log('3. Menguji otorisasi JWT & kepemilikan host pada Socket.IO game...');
    const anonSock = await connectClient();
    const guruBSock = await connectClient(cookieB);
    const guruASock = await connectClient(cookieA);

    // Spoof host_join oleh anon & Guru B harus ditolak
    const anonJoinRes = await emitWithAck(anonSock, 'sesi:host_join', { sessionId: tarikSessionId });
    assert.strictEqual(anonJoinRes.success, false, 'Socket anonim tidak boleh host_join');
    const guruBJoinRes = await emitWithAck(guruBSock, 'sesi:host_join', { sessionId: tarikSessionId });
    assert.strictEqual(guruBJoinRes.success, false, 'Guru lain tidak boleh host_join');

    // Spoof kontrol admin sesi meskipun mengirim hostId milik Guru A atau 'current-host'
    for (const sock of [anonSock, guruBSock]) {
      const acakSpy = await emitWithAck(sock, 'sesi:acak_tim', { sessionId: tarikSessionId, hostId: userAId });
      assert.strictEqual(acakSpy.success, false, 'sesi:acak_tim tanpa JWT pemilik harus ditolak');

      const startSpy = await emitWithAck(sock, 'sesi:mulai', { sessionId: tarikSessionId, hostId: userAId });
      assert.strictEqual(startSpy.success, false, 'sesi:mulai tanpa JWT pemilik harus ditolak');

      const stopSpy = await emitWithAck(sock, 'sesi:akhiri_manual', { sessionId: tarikSessionId, hostId: userAId });
      assert.strictEqual(stopSpy.success, false, 'sesi:akhiri_manual tanpa JWT pemilik harus ditolak');
    }

    // Host asli (Guru A) bisa join & mengendalikan sesi
    const guruAJoinRes = await emitWithAck(guruASock, 'sesi:host_join', { sessionId: tarikSessionId });
    assert.strictEqual(guruAJoinRes.success, true, 'Pemilik sesi sah harus berhasil host_join');

    // Buat sesi Panjat Pinang untuk menguji otorisasi host di mode selain Tarik Tambang
    const tplPanjatRes = await fetch(`${baseUrl}/api/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        judul: `Panjat ${suffix}`,
        game: 'panjat_pinang',
        mode: 'multi',
        questions: [
          { teks: 'Q1', opsiA: 'A', opsiB: 'B', opsiC: 'C', opsiD: 'D', jawabanBenar: 'A', kesulitan: 'mudah' },
        ],
      }),
    });
    const tplPanjat: any = await tplPanjatRes.json();
    createdTemplateIds.push(tplPanjat.template.id);

    const panjatSesiRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ templateId: tplPanjat.template.id, mode: 'multi' }),
    });
    const panjatSesi: any = await panjatSesiRes.json();
    const panjatId: string = panjatSesi.session.id;
    createdSessionIds.push(panjatId);

    assert.strictEqual((await emitWithAck(anonSock, 'sesi:mulai', { sessionId: panjatId })).success, false);
    assert.strictEqual((await emitWithAck(guruBSock, 'sesi:akhiri_manual', { sessionId: panjatId })).success, false);
    assert.strictEqual((await emitWithAck(guruASock, 'sesi:host_join', { sessionId: panjatId })).success, true);

    // Uji Balap Karung & Makan Kerupuk Multiplayer host auth
    for (const gameKind of ['balap_karung', 'makan_kerupuk'] as const) {
      const tRes = await fetch(`${baseUrl}/api/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({
          judul: `${gameKind} ${suffix}`,
          game: gameKind,
          mode: 'multi',
          questions: [
            { teks: 'Q1', opsiA: 'A', opsiB: 'B', opsiC: 'C', opsiD: 'D', jawabanBenar: 'A', kesulitan: 'mudah' },
          ],
        }),
      });
      assert.strictEqual(tRes.status, 201);
      const tJson: any = await tRes.json();
      createdTemplateIds.push(tJson.template.id);

      const sRes = await fetch(`${baseUrl}/api/sesi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({ templateId: tJson.template.id, mode: 'multi' }),
      });
      assert.strictEqual(sRes.status, 201);
      const sJson: any = await sRes.json();
      const sId: string = sJson.session.id;
      createdSessionIds.push(sId);

      assert.strictEqual((await emitWithAck(anonSock, 'sesi:host_join', { sessionId: sId })).success, false);
      assert.strictEqual((await emitWithAck(guruBSock, 'sesi:mulai', { sessionId: sId })).success, false);
      assert.strictEqual((await emitWithAck(guruBSock, 'sesi:akhiri_manual', { sessionId: sId })).success, false);
      assert.strictEqual((await emitWithAck(guruASock, 'sesi:host_join', { sessionId: sId })).success, true);
      assert.strictEqual((await emitWithAck(guruASock, 'sesi:akhiri_manual', { sessionId: sId })).success, true);
    }

    // Tutup sesi secara sah via Guru A
    assert.strictEqual((await emitWithAck(guruASock, 'sesi:akhiri_manual', { sessionId: tarikSessionId })).success, true);
    assert.strictEqual((await emitWithAck(guruASock, 'sesi:akhiri_manual', { sessionId: panjatId })).success, true);
    console.log('✓ Seluruh event kontrol host Socket.IO terlindungi oleh JWT + pemilik sesi.');

    // -----------------------------------------------------------------------
    // 4. Auth Papan Tulis Socket.IO (papan:gabung & papan:cabut_akses)
    // -----------------------------------------------------------------------
    console.log('4. Menguji otorisasi papan:gabung & papan:cabut_akses...');
    const boardRes = await fetch(`${baseUrl}/api/papan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ judul: `Papan Aman ${suffix}` }),
    });
    assert.strictEqual(boardRes.status, 201);
    const boardJson: any = await boardRes.json();
    const boardId: string = boardJson.board.id;
    createdBoardIds.push(boardId);

    const shareRes = await fetch(`${baseUrl}/api/papan/${boardId}/bagikan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ peran: 'viewer' }),
    });
    assert.strictEqual(shareRes.status, 201);
    const shareJson: any = await shareRes.json();
    const shareToken: string = shareJson.token;

    // Anon spoof userId -> wajib ditolak!
    const spoofBoardJoin = await emitWithAck(anonSock, 'papan:gabung', {
      boardId,
      userId: userAId,
      nama: 'Spoofer',
    });
    assert.strictEqual(spoofBoardJoin.success, false, 'papan:gabung tidak boleh mempercayai payload userId');

    // Guru B spoof userId -> wajib ditolak!
    const otherGuruJoin = await emitWithAck(guruBSock, 'papan:gabung', {
      boardId,
      userId: userAId,
      nama: 'Guru B Spoof',
    });
    assert.strictEqual(otherGuruJoin.success, false, 'Guru lain tidak boleh mengakses papan tanpa token berbagi');

    // Anon & Guru B mencoba papan:cabut_akses -> wajib ditolak, share tetap aktif!
    const anonRevoke = await emitWithAck(anonSock, 'papan:cabut_akses', { boardId, token: shareToken });
    assert.strictEqual(anonRevoke.success, false);
    const guruBRevoke = await emitWithAck(guruBSock, 'papan:cabut_akses', { boardId, token: shareToken });
    assert.strictEqual(guruBRevoke.success, false);

    const shareStillActive = await prisma.boardShare.findUnique({ where: { token: shareToken } });
    assert.strictEqual(shareStillActive?.aktif, true, 'Share link tidak boleh dicabut pihak tidak berwenang');

    // Pemilik sah Guru A gabung & cabut akses -> berhasil
    const ownerJoin = await emitWithAck(guruASock, 'papan:gabung', { boardId, nama: 'Guru A' });
    assert.strictEqual(ownerJoin.success, true);
    assert.strictEqual(ownerJoin.isOwner, true);

    const ownerRevoke = await emitWithAck(guruASock, 'papan:cabut_akses', { boardId, token: shareToken });
    assert.strictEqual(ownerRevoke.success, true);
    const shareAfterRevoke = await prisma.boardShare.findUnique({ where: { token: shareToken } });
    assert.strictEqual(shareAfterRevoke?.aktif, false);
    console.log('✓ papan:gabung & papan:cabut_akses aman dari spoofing & pencabutan anonim.');

    // -----------------------------------------------------------------------
    // 5. Pelestarian Multi-Halaman (versi: 2) + Objek 'formula' & 'conn'
    // -----------------------------------------------------------------------
    console.log('5. Menguji pelestarian slide versi: 2 + objek formula/conn melalui PUT & Socket.IO...');
    const v2Payload = {
      versi: 2,
      currentPageIndex: 0,
      pages: [
        { id: 'page-1', name: 'Slide 1', objs: [{ id: 's1-rect', type: 'shape', x: 10, y: 10 }] },
        { id: 'page-2', name: 'Slide 2', objs: [{ id: 's2-text', type: 'text', text: 'Slide 2 Rahasia' }] },
      ],
      objs: [{ id: 's1-rect', type: 'shape', x: 10, y: 10 }],
    };

    const putV2Res = await fetch(`${baseUrl}/api/papan/${boardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ data: v2Payload }),
    });
    assert.strictEqual(putV2Res.status, 200);

    // Pastikan memori socket langsung tersinkronisasi setelah PUT!
    const rejoinRes = await emitWithAck(guruASock, 'papan:gabung', { boardId, nama: 'Guru A' });
    assert.strictEqual(rejoinRes.success, true);
    assert.strictEqual(rejoinRes.data?.versi, 2, 'Snapshot socket harus mempertahankan versi: 2');
    assert.strictEqual(rejoinRes.data?.pages?.length, 2, 'Semua slide harus terbawa di snapshot');

    // Tambahkan objek 'formula' & 'conn' melalui papan:ubah
    const ubahFormulaRes = await emitWithAck(guruASock, 'papan:ubah', {
      boardId,
      tambah: [
        { id: 'formula-1', type: 'formula', x: 100, y: 100, latex: 'a^2 + b^2 = c^2' },
        { id: 'conn-1', type: 'conn', x1: 10, y1: 10, x2: 100, y2: 100, srcId: 's1-rect', dstId: 'formula-1' },
      ],
    });
    assert.strictEqual(ubahFormulaRes.success, true, 'Objek formula & conn wajib diterima oleh papan:ubah');

    // Putuskan seluruh peserta agar saveBoardToDatabase() berjalan saat disconnect terakhir
    guruASock.disconnect();
    await new Promise((r) => setTimeout(r, 250));

    const savedBoardRes = await fetch(`${baseUrl}/api/papan/${boardId}`, {
      headers: { Cookie: cookieA },
    });
    assert.strictEqual(savedBoardRes.status, 200);
    const savedBoardJson: any = await savedBoardRes.json();
    const savedParsed = JSON.parse(savedBoardJson.board.data);

    assert.strictEqual(savedParsed.versi, 2, 'Autosave/disconnect socket tidak boleh menurunkan versi: 2 menjadi 1');
    assert.strictEqual(savedParsed.pages?.length, 2, 'Slide ke-2 tidak boleh hilang setelah socket menyimpan');
    assert.strictEqual(
      savedParsed.pages[1]?.objs?.[0]?.id,
      's2-text',
      'Konten Slide ke-2 wajib tetap utuh'
    );
    const page1Ids = (savedParsed.pages[0]?.objs || []).map((o: any) => o.id);
    assert.ok(page1Ids.includes('formula-1'), 'Objek formula wajib tersimpan ke DB');
    assert.ok(page1Ids.includes('conn-1'), 'Objek conn wajib tersimpan ke DB');
    console.log('✓ Multi-halaman versi: 2 & objek formula/conn tersimpan utuh tanpa kehilangan data.');

    console.log('\n🎉 SELURUH 5/5 PENGUJIAN REGRESI KEAMANAN & DATA BERHASIL LULUS!');
  } finally {
    config.isProduction = originalIsProduction;
    for (const s of openSockets) {
      if (s.connected) s.disconnect();
    }
    for (const boardId of createdBoardIds) {
      await prisma.boardShare.deleteMany({ where: { boardId } }).catch(() => {});
      await prisma.board.deleteMany({ where: { id: boardId } }).catch(() => {});
    }
    for (const sessionId of createdSessionIds) {
      await prisma.sessionPlayer.deleteMany({ where: { sessionId } }).catch(() => {});
      await prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => {});
    }
    for (const templateId of createdTemplateIds) {
      await prisma.question.deleteMany({ where: { templateId } }).catch(() => {});
      await prisma.template.deleteMany({ where: { id: templateId } }).catch(() => {});
    }
    for (const id of createdUserIds) {
      await prisma.user.deleteMany({ where: { id } }).catch(() => {});
    }
    io.close();
    httpServer.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\n❌ PENGUJIAN KEAMANAN GAGAL:', err);
  process.exit(1);
});

