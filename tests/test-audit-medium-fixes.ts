import assert from 'assert';
import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { prisma } from '../server/src/db.js';
import { config } from '../server/src/config.js';
import { containsInsensitive } from '../server/src/utils/prismaFilters.js';
import { authRouter } from '../server/src/routes/auth.js';
import { templateRouter } from '../server/src/routes/template.js';
import { sesiRouter } from '../server/src/routes/sesi.js';
import { adminRouter } from '../server/src/routes/admin.js';
import { aiRouter } from '../server/src/routes/ai.js';
import { errorHandler } from '../server/src/middleware/error.js';
import { setupMultiplayerSocket } from '../server/src/realtime/sesi.js';
import { soloManager } from '../server/src/games/soloManager.js';
import { multiManager } from '../server/src/games/multiManager.js';
import { balapKarungSoloManager } from '../server/src/games/balapKarungSoloManager.js';
import { obrolDenganAI, generateKuisPapan } from '../server/src/ai/ai.js';

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
  console.log('\n=================================================================');
  console.log('🧪 PENGUJIAN REGRESI PRIORITAS SEDANG (DB, SESI, PENCARIAN, AI)');
  console.log('=================================================================\n');

  // 1. Verifikasi supabase_schema.sql memiliki ALTER TABLE untuk opsi C/D/E
  console.log('1. Memeriksa ALTER TABLE opsiC, opsiD, opsiE pada supabase_schema.sql...');
  const sqlContent = fs.readFileSync(path.resolve(process.cwd(), 'supabase_schema.sql'), 'utf-8');
  assert.ok(
    /ALTER\s+TABLE\s+public\.questions\s+ALTER\s+COLUMN\s+"opsiC"\s+DROP\s+NOT\s+NULL/i.test(sqlContent),
    'supabase_schema.sql wajib menurunkan constraint NOT NULL pada opsiC secara idempoten'
  );
  assert.ok(
    /ALTER\s+TABLE\s+public\.questions\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+"opsiD"\s+TEXT/i.test(sqlContent),
    'supabase_schema.sql wajib menambahkan kolom opsiD secara idempoten'
  );
  assert.ok(
    /ALTER\s+TABLE\s+public\.questions\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+"opsiE"\s+TEXT/i.test(sqlContent),
    'supabase_schema.sql wajib menambahkan kolom opsiE secara idempoten'
  );
  console.log('✓ supabase_schema.sql memuat migrasi idempoten opsiC/opsiD/opsiE.');

  // 2. Verifikasi helper containsInsensitive untuk SQLite vs PostgreSQL
  console.log('2. Menguji helper containsInsensitive untuk SQLite vs PostgreSQL...');
  const origDbUrl = config.databaseUrl;
  try {
    config.databaseUrl = 'file:./dev.db';
    const sqliteFilter: any = containsInsensitive('Aljabar');
    assert.strictEqual(sqliteFilter.contains, 'Aljabar');
    assert.strictEqual('mode' in sqliteFilter, false, 'Filter SQLite tidak boleh mengandung mode');

    config.databaseUrl = 'postgresql://user:pass@localhost:5432/postgres';
    const pgFilter: any = containsInsensitive('Aljabar');
    assert.strictEqual(pgFilter.contains, 'Aljabar');
    assert.strictEqual(pgFilter.mode, 'insensitive', 'Filter PostgreSQL wajib memakai mode: insensitive');
  } finally {
    config.databaseUrl = origDbUrl;
  }
  console.log('✓ containsInsensitive menyesuaikan mode sesuai driver DB.');

  const app = express();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true },
  });

  app.use(express.json({ limit: '12mb' }));
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/template', templateRouter);
  app.use('/api/sesi', sesiRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/ai', aiRouter);
  app.use(errorHandler);

  setupMultiplayerSocket(io);

  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const addr = httpServer.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const createdUserIds: string[] = [];
  const createdTemplateIds: string[] = [];
  const createdSessionIds: string[] = [];
  const openSockets: ClientSocket[] = [];

  try {
    const suffix = crypto.randomBytes(4).toString('hex');

    // Login Admin seed
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/masuk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: config.seedAdminEmail, kataSandi: config.seedAdminPassword }),
    });
    assert.strictEqual(adminLoginRes.status, 200, 'Login admin seed harus berhasil');
    const adminCookie = adminLoginRes.headers.get('set-cookie')!.split(';')[0];

    // Daftar Guru uji
    const guruRes = await fetch(`${baseUrl}/api/auth/daftar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: `GuruAudit ${suffix}`,
        email: `guru_audit_${suffix}@discere.local`,
        kataSandi: 'PasswordUji2026!',
        sekolah: `SDN Audit ${suffix}`,
      }),
    });
    assert.strictEqual(guruRes.status, 201);
    const guruJson: any = await guruRes.json();
    const guruId: string = guruJson.user.id;
    const guruCookie = guruRes.headers.get('set-cookie')!.split(';')[0];
    createdUserIds.push(guruId);

    // 3. Uji pencarian q pada GET /api/template, /api/template/pustaka, GET /api/admin/guru
    console.log('3. Menguji pencarian q pada template, pustaka, dan admin/guru...');
    const tplRes = await fetch(`${baseUrl}/api/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        judul: `Aljabar Linear ${suffix}`,
        game: 'tarik_tambang',
        mode: 'solo',
        questions: [
          { teks: '1 + 1 = ?', opsiA: '1', opsiB: '2', opsiC: '3', jawabanBenar: 'B', kesulitan: 'sedang' },
          { teks: '2 + 2 = ?', opsiA: '4', opsiB: '5', opsiC: '6', jawabanBenar: 'A', kesulitan: 'sedang' },
          { teks: '3 + 3 = ?', opsiA: '5', opsiB: '6', opsiC: '7', jawabanBenar: 'B', kesulitan: 'sedang' },
        ],
      }),
    });
    assert.strictEqual(tplRes.status, 201);
    const tplId: string = ((await tplRes.json()) as any).template.id;
    createdTemplateIds.push(tplId);

    const searchTpl = await fetch(`${baseUrl}/api/template?q=${encodeURIComponent(`aljabar linear ${suffix}`)}`, {
      headers: { Cookie: guruCookie },
    });
    assert.strictEqual(searchTpl.status, 200);
    const searchTplJson: any = await searchTpl.json();
    assert.ok(searchTplJson.templates.some((t: any) => t.id === tplId), 'GET /api/template?q harus menemukan template');

    const searchPustaka = await fetch(`${baseUrl}/api/template/pustaka?q=a`, {
      headers: { Cookie: guruCookie },
    });
    assert.strictEqual(searchPustaka.status, 200);

    const searchGuru = await fetch(`${baseUrl}/api/admin/guru?q=${encodeURIComponent(`guruaudit ${suffix}`)}`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(searchGuru.status, 200);
    const searchGuruJson: any = await searchGuru.json();
    assert.ok(searchGuruJson.guru.some((g: any) => g.id === guruId), 'GET /api/admin/guru?q harus menemukan guru');
    console.log('✓ Pencarian template, pustaka, dan admin guru berjalan mulus.');

    // 4. Uji Balap Karung Solo DB Report (GET /hasil dan GET /riwayat/:id setelah hapusSesi)
    console.log('4. Menguji muatLaporanDariDatabase Balap Karung Solo...');
    const tplBalapRes = await fetch(`${baseUrl}/api/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        judul: `Balap Solo ${suffix}`,
        game: 'balap_karung',
        mode: 'solo',
        questions: [
          { teks: 'Ibu kota RI?', opsiA: 'Jakarta', opsiB: 'Medan', jawabanBenar: 'A', kesulitan: 'mudah' },
          { teks: '5 x 5 = ?', opsiA: '20', opsiB: '25', jawabanBenar: 'B', kesulitan: 'mudah' },
        ],
      }),
    });
    const tplBalapId: string = ((await tplBalapRes.json()) as any).template.id;
    createdTemplateIds.push(tplBalapId);

    const sesiBalapRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        templateId: tplBalapId,
        mode: 'solo',
        balapKarungConfig: { presetJarak: 'pendek', tipeLawanSolo: 'lokal' },
        autoStart: true,
      }),
    });
    assert.strictEqual(sesiBalapRes.status, 201);
    const sesiBalapJson: any = await sesiBalapRes.json();
    const balapSoloId: string = sesiBalapJson.session.id;
    createdSessionIds.push(balapSoloId);

    const endBalapRes = await fetch(`${baseUrl}/api/sesi/${balapSoloId}/selesai`, {
      method: 'POST',
      headers: { Cookie: guruCookie },
    });
    assert.strictEqual(endBalapRes.status, 200);

    // Kosongkan memori agar memaksa fallback database
    balapKarungSoloManager.hapusSesi(balapSoloId);

    const hasilBalapRes = await fetch(`${baseUrl}/api/sesi/${balapSoloId}/hasil`, {
      headers: { Cookie: guruCookie },
    });
    assert.strictEqual(hasilBalapRes.status, 200, 'GET /:id/hasil Balap Karung Solo dari DB harus berhasil');
    const hasilBalapJson: any = await hasilBalapRes.json();
    assert.strictEqual(hasilBalapJson.hasil?.game, 'balap_karung');
    assert.strictEqual(hasilBalapJson.hasil?.totalPeserta, 2);
    assert.strictEqual(hasilBalapJson.hasil?.laporanPemain?.length, 2);

    const riwayatBalapRes = await fetch(`${baseUrl}/api/sesi/riwayat/${balapSoloId}`, {
      headers: { Cookie: guruCookie },
    });
    assert.strictEqual(riwayatBalapRes.status, 200);
    const riwayatBalapJson: any = await riwayatBalapRes.json();
    assert.strictEqual(riwayatBalapJson.detail?.laporanBalapKarung?.totalPeserta, 2);
    console.log('✓ Balap Karung Solo fallback DB pada /hasil & /riwayat/:id akurat.');

    // 5. Uji pemulihan DB Tarik Tambang Solo & Multi + Pembersihan memori + Admin DELETE /:id
    console.log('5. Menguji pulihkanSesiDariDb Tarik Tambang Solo & Multi serta DELETE /:id oleh Admin...');
    const tarikSoloRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({ templateId: tplId, mode: 'solo' }),
    });
    assert.strictEqual(tarikSoloRes.status, 201);
    const tarikSoloId: string = ((await tarikSoloRes.json()) as any).session.id;
    createdSessionIds.push(tarikSoloId);

    const mulaiSoloRes = await fetch(`${baseUrl}/api/sesi/${tarikSoloId}/mulai`, {
      method: 'POST',
      headers: { Cookie: guruCookie },
    });
    assert.strictEqual(mulaiSoloRes.status, 200);

    // Hapus dari RAM untuk simulasi restart server
    soloManager.hapusSesi(tarikSoloId);
    assert.strictEqual(soloManager.dapatkanSesi(tarikSoloId), undefined);

    // Pause / Resume / Tutup ronde harus otomatis memulihkan sesi dari DB!
    const pauseRes = await fetch(`${baseUrl}/api/sesi/${tarikSoloId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({ state: 'PAUSED' }),
    });
    assert.strictEqual(pauseRes.status, 200, 'POST /:id/state setelah RAM kosong wajib memulihkan sesi Solo dari DB');

    soloManager.hapusSesi(tarikSoloId);
    const closeRoundRes = await fetch(`${baseUrl}/api/sesi/${tarikSoloId}/tutup-ronde`, {
      method: 'POST',
      headers: { Cookie: guruCookie },
    });
    assert.strictEqual(closeRoundRes.status, 200, 'POST /:id/tutup-ronde wajib memulihkan sesi Solo dari DB');

    // Buat Tarik Tambang Multi -> mulai -> hapus RAM -> cek GET /:id tetap berstatus 'jalan'!
    const tarikMultiRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({ templateId: tplId, mode: 'multi' }),
    });
    assert.strictEqual(tarikMultiRes.status, 201);
    const tarikMultiData: any = await tarikMultiRes.json();
    const tarikMultiId: string = tarikMultiData.session.id;
    createdSessionIds.push(tarikMultiId);

    const hostSock = ioClient(baseUrl, {
      transports: ['websocket'],
      extraHeaders: { cookie: guruCookie },
    });
    openSockets.push(hostSock);
    await waitForEvent(hostSock, 'connect');
    const hj = await emitWithAck(hostSock, 'sesi:host_join', { sessionId: tarikMultiId });
    assert.strictEqual(hj.success, true);

    const studentSock1 = ioClient(baseUrl, { transports: ['websocket'] });
    const studentSock2 = ioClient(baseUrl, { transports: ['websocket'] });
    openSockets.push(studentSock1, studentSock2);
    await Promise.all([waitForEvent(studentSock1, 'connect'), waitForEvent(studentSock2, 'connect')]);
    const sj1 = await emitWithAck(studentSock1, 'sesi:gabung', { token: tarikMultiData.session.token, nama: 'SiswaRecover1' });
    const sj2 = await emitWithAck(studentSock2, 'sesi:gabung', { token: tarikMultiData.session.token, nama: 'SiswaRecover2' });
    assert.strictEqual(sj1.success, true);
    assert.strictEqual(sj2.success, true);

    const startMultiAck = await emitWithAck(hostSock, 'sesi:mulai', { sessionId: tarikMultiId });
    assert.strictEqual(startMultiAck.success, true, `sesi:mulai gagal: ${startMultiAck.pesan}`);

    // Hapus paksa dari RAM (juga menstop timer lama agar tidak bocor, lalu pulihkan dari DB)
    multiManager.hapusSesi(tarikMultiId);
    assert.strictEqual(multiManager.dapatkanSesi(tarikMultiId), undefined);

    const recoveredMultiRes = await fetch(`${baseUrl}/api/sesi/${tarikMultiId}`, {
      headers: { Cookie: guruCookie },
    });
    assert.strictEqual(recoveredMultiRes.status, 200);
    const recoveredMultiJson: any = await recoveredMultiRes.json();
    assert.strictEqual(
      recoveredMultiJson.session?.status,
      'jalan',
      'GET /api/sesi/:id Tarik Tambang Multi yang hilang dari RAM saat berjalan wajib dipulihkan sebagai jalan, bukan lobi baru!'
    );

    // Admin DELETE /api/sesi/:id milik guru -> tidak boleh terblokir roleMiddleware('guru') & wajib hapus RAM!
    const adminDeleteRes = await fetch(`${baseUrl}/api/sesi/${tarikMultiId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(adminDeleteRes.status, 200, 'Admin wajib diizinkan menghapus sesi via DELETE /api/sesi/:id');
    assert.strictEqual(multiManager.dapatkanSesi(tarikMultiId), undefined, 'Memori sesi harus dibersihkan setelah DELETE /:id');
    console.log('✓ Pemulihan DB Tarik Tambang Solo/Multi & DELETE /:id Admin + cleanup memori lolos.');

    // 6. Uji Kuota AI (tidak terpotong saat cache hit), schema kuis-papan 'makan_kerupuk', model Claude & pesan 429
    console.log('6. Menguji kuota AI cache-aware, game makan_kerupuk, & cabang Anthropic Claude...');
    const origAiKey = process.env.AI_API_KEY;
    const origAiModel = process.env.AI_MODEL;
    const origFetch = globalThis.fetch;

    try {
      // Simulasi offline fallback agar tidak memanggil API eksternal saat uji cache & kuota
      process.env.AI_API_KEY = '';

      const uniqueMateri = `Materi unik pengujian cache AI Discere tahun 2026 kode ${suffix} tentang energi kinetik dan potensial.`;
      const soalCall1 = await fetch(`${baseUrl}/api/ai/soal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
        body: JSON.stringify({ materi: uniqueMateri, jumlah: 2, tingkat: 'SD' }),
      });
      assert.strictEqual(soalCall1.status, 200);
      const soalJson1: any = await soalCall1.json();
      assert.strictEqual(soalJson1.dariCache, false);
      assert.strictEqual(soalJson1.kuota.totalTerpakai, 1, 'Pemanggilan non-cache pertama mencatat kuota 1');

      const soalCall2 = await fetch(`${baseUrl}/api/ai/soal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
        body: JSON.stringify({ materi: uniqueMateri, jumlah: 2, tingkat: 'SD' }),
      });
      assert.strictEqual(soalCall2.status, 200);
      const soalJson2: any = await soalCall2.json();
      assert.strictEqual(soalJson2.dariCache, true);
      assert.strictEqual(soalJson2.kuota.totalTerpakai, 1, 'Cache hit tidak boleh memotong kuota lagi');

      // Uji POST /api/ai/jawab tidak memotong kuota ganda saat cache hit
      const dummyImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const jawab1 = await fetch(`${baseUrl}/api/ai/jawab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
        body: JSON.stringify({ imageBase64: dummyImg, pertanyaan: `Uji cache ${suffix}` }),
      });
      assert.strictEqual(jawab1.status, 200);
      const jawabJson1: any = await jawab1.json();
      assert.strictEqual(jawabJson1.dariCache, false);
      assert.strictEqual(jawabJson1.kuota.totalTerpakai, 2);

      const jawab2 = await fetch(`${baseUrl}/api/ai/jawab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
        body: JSON.stringify({ imageBase64: dummyImg, pertanyaan: `Uji cache ${suffix}` }),
      });
      assert.strictEqual(jawab2.status, 200);
      const jawabJson2: any = await jawab2.json();
      assert.strictEqual(jawabJson2.dariCache, true);
      assert.strictEqual(jawabJson2.kuota.totalTerpakai, 2, 'Cache hit /api/ai/jawab tidak boleh memotong kuota lagi');

      // Uji POST /api/ai/kuis-papan menerima game: 'makan_kerupuk'
      const kuisKerupukRes = await fetch(`${baseUrl}/api/ai/kuis-papan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
        body: JSON.stringify({
          topik: `Kerupuk Fisika ${suffix}`,
          jumlah: 2,
          tingkat: 'SMP',
          game: 'makan_kerupuk',
          simpanTemplate: true,
        }),
      });
      assert.strictEqual(kuisKerupukRes.status, 200, 'kuis-papan wajib mendukung game makan_kerupuk');
      const kuisKerupukJson: any = await kuisKerupukRes.json();
      assert.strictEqual(kuisKerupukJson.kuota.totalTerpakai, 3);
      assert.strictEqual(kuisKerupukJson.template?.game, 'makan_kerupuk');
      if (kuisKerupukJson.template?.id) {
        createdTemplateIds.push(kuisKerupukJson.template.id);
      }

      // Mock fetch untuk memverifikasi cabang Anthropic di generateKuisPapan & obrolDenganAI
      process.env.AI_API_KEY = 'dummy-anthropic-key';
      process.env.AI_MODEL = 'claude-3-7-sonnet-latest';
      let capturedAnthropicBody: any = null;

      globalThis.fetch = (async (_url: any, init: any) => {
        capturedAnthropicBody = JSON.parse(init?.body || '{}');
        return new Response(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify({
                  soal: [
                    {
                      teks: 'Berapa 2 kali 3?',
                      opsiA: '5',
                      opsiB: '6',
                      opsiC: '7',
                      jawabanBenar: 'B',
                      penjelasan: '2 x 3 = 6.',
                      dibuatAi: true,
                    },
                  ],
                }),
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as typeof fetch;

      await generateKuisPapan({
        userId: guruId,
        topik: 'Perkalian',
        jumlah: 1,
        tingkat: 'SD',
        game: 'makan_kerupuk',
        simpanTemplate: false,
      });
      assert.strictEqual(
        capturedAnthropicBody?.model,
        'claude-3-7-sonnet-latest',
        'generateKuisPapan cabang Anthropic wajib memakai config.aiModel, bukan hardcode'
      );

      // Simulasi HTTP 429 pada cabang Anthropic di obrolDenganAI
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ error: { message: 'rate limit' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        })) as typeof fetch;

      let claude429Msg = '';
      try {
        await obrolDenganAI({ pesan: [{ role: 'user', teks: 'Halo Claude' }] });
      } catch (err: any) {
        claude429Msg = err?.message || '';
      }
      assert.ok(claude429Msg.includes('Anthropic Claude'), `Pesan 429 Claude wajib menyebut Anthropic Claude (aktual: ${claude429Msg})`);
      assert.strictEqual(claude429Msg.includes('Google Gemini'), false, 'Pesan 429 Claude tidak boleh menyebut Google Gemini');
    } finally {
      globalThis.fetch = origFetch;
      if (origAiKey === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = origAiKey;
      if (origAiModel === undefined) delete process.env.AI_MODEL;
      else process.env.AI_MODEL = origAiModel;
    }

    console.log('✓ Logika kuota AI, schema makan_kerupuk, model Claude dinamis, & pesan 429 akurat.');

    // 7. Uji Validasi Admin Pustaka Template & Opsi AI A-E
    console.log('7. Menguji validasi Admin Pustaka (enum game & paksa multi pada panjat_pinang) serta opsi 2-5...');
    const badGamePustaka = await fetch(`${baseUrl}/api/admin/pustaka`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        judul: `Pustaka Ilegal ${suffix}`,
        game: 'game_fiktif',
        mode: 'solo',
        questions: [
          { teks: '1+1?', opsiA: '2', opsiB: '3', jawabanBenar: 'A' },
        ],
      }),
    });
    assert.strictEqual(badGamePustaka.status, 400, 'Admin pustaka wajib menolak game di luar enum');

    const panjatPustakaRes = await fetch(`${baseUrl}/api/admin/pustaka`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        judul: `Pustaka Panjat ${suffix}`,
        game: 'panjat_pinang',
        mode: 'solo',
        questions: [
          {
            teks: 'Berapa 5 + 5?',
            opsiA: '8',
            opsiB: '9',
            opsiC: '10',
            opsiD: '11',
            opsiE: '12',
            jawabanBenar: 'C',
          },
        ],
      }),
    });
    assert.strictEqual(panjatPustakaRes.status, 201);
    const panjatPustakaJson: any = await panjatPustakaRes.json();
    const pustakaId: string = panjatPustakaJson.template.id;
    createdTemplateIds.push(pustakaId);
    assert.strictEqual(
      panjatPustakaJson.template?.mode,
      'multi',
      'POST /api/admin/pustaka untuk panjat_pinang wajib memaksa mode multi'
    );

    const panjatUpdRes = await fetch(`${baseUrl}/api/admin/pustaka/${pustakaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        judul: `Pustaka Panjat Ubah ${suffix}`,
        game: 'panjat_pinang',
        mode: 'solo',
        questions: [
          {
            teks: 'Benar atau Salah: Bumi bulat?',
            opsiA: 'Benar',
            opsiB: 'Salah',
            jawabanBenar: 'A',
          },
        ],
      }),
    });
    assert.strictEqual(panjatUpdRes.status, 200);
    const panjatUpdJson: any = await panjatUpdRes.json();
    assert.strictEqual(
      panjatUpdJson.template?.mode,
      'multi',
      'PUT /api/admin/pustaka/:id untuk panjat_pinang wajib memaksa mode multi'
    );
    assert.strictEqual(panjatUpdJson.template?.questions?.[0]?.opsiC, null);
    console.log('✓ Validasi admin pustaka & penyimpanan soal 2-5 opsi terverifikasi.');

    console.log('\n🎉 SELURUH 7/7 PENGUJIAN REGRESI PRIORITAS SEDANG & RENDAH LULUS!');
  } finally {
    for (const s of openSockets) {
      if (s.connected) s.disconnect();
    }
    for (const sessionId of createdSessionIds) {
      soloManager.hapusSesi(sessionId);
      multiManager.hapusSesi(sessionId);
      balapKarungSoloManager.hapusSesi(sessionId);
      await prisma.sessionPlayer.deleteMany({ where: { sessionId } }).catch(() => {});
      await prisma.questionStat.deleteMany({ where: { sessionId } }).catch(() => {});
      await prisma.sessionResult.deleteMany({ where: { sessionId } }).catch(() => {});
      await prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => {});
    }
    for (const templateId of createdTemplateIds) {
      await prisma.question.deleteMany({ where: { templateId } }).catch(() => {});
      await prisma.template.deleteMany({ where: { id: templateId } }).catch(() => {});
    }
    for (const id of createdUserIds) {
      await prisma.aiUsage.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id } }).catch(() => {});
    }
    io.close();
    httpServer.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\n❌ PENGUJIAN REGRESI PRIORITAS SEDANG GAGAL:', err);
  process.exit(1);
});
