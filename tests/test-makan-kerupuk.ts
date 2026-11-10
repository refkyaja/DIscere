import assert from 'assert';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { prisma } from '../server/src/db.js';
import { authRouter } from '../server/src/routes/auth.js';
import { templateRouter } from '../server/src/routes/template.js';
import { sesiRouter } from '../server/src/routes/sesi.js';
import { errorHandler } from '../server/src/middleware/error.js';
import { setupMultiplayerSocket } from '../server/src/realtime/sesi.js';
import {
  PRESET_PROBABILITAS,
  validasiProbabilitas,
  bangunKonfigurasiKerupukSolo,
  bangunKonfigurasiKerupukMulti,
  konfigurasiKerupukSoloSchema,
  hitungPenguranganGigitan,
  drawGachaGigitan,
  buatStateKerupukAwal,
  hitungHasilJawabanKerupukSolo,
  urutkanLeaderboardKerupuk,
} from '../server/src/games/makanKerupuk.js';
import {
  kerupukManager,
  SoalKerupuk,
  siapkanAntreanSoal,
} from '../server/src/games/kerupukManager.js';
import { kerupukMultiManager } from '../server/src/games/kerupukMultiManager.js';

const MOCK_QUESTIONS: SoalKerupuk[] = [
  {
    id: 'mk-q-1',
    urutan: 1,
    teks: 'Kemerdekaan Indonesia diproklamasikan pada tahun?',
    opsiA: '1945',
    opsiB: '1948',
    opsiC: '1950',
    jawabanBenar: 'A',
    penjelasan: 'Proklamasi dibacakan pada 17 Agustus 1945.',
  },
  {
    id: 'mk-q-2',
    urutan: 2,
    teks: 'Warna bendera negara Indonesia adalah?',
    opsiA: 'Biru Putih',
    opsiB: 'Merah Putih',
    opsiC: 'Merah Biru',
    jawabanBenar: 'B',
    penjelasan: 'Sang Saka Merah Putih.',
  },
  {
    id: 'mk-q-3',
    urutan: 3,
    teks: 'Ibukota Provinsi Jawa Barat adalah?',
    opsiA: 'Semarang',
    opsiB: 'Surabaya',
    opsiC: 'Bandung',
    jawabanBenar: 'C',
    penjelasan: 'Bandung adalah ibu kota Jawa Barat.',
  },
];

function waitForEvent<T = any>(socket: ClientSocket, event: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, onData);
      reject(new Error(`Timeout menunggu event Socket.IO: ${event}`));
    }, timeoutMs);
    const onData = (data: T) => {
      clearTimeout(t);
      resolve(data);
    };
    socket.once(event, onData);
  });
}

function emitWithAck<T = any>(socket: ClientSocket, event: string, payload: any, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout ack: ${event}`)), timeoutMs);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(t);
      resolve(res);
    });
  });
}

function jalankanUnitTests() {
  console.log('▶ BAGIAN A: UNIT TEST SHARED CORE, SOLO ENGINE & MULTIPLAYER ENGINE');

  // 1. Preset probabilitas & penolakan config invalid
  console.log('1. Menguji preset kesulitan, validasi 100%, & penolakan config invalid...');
  assert.strictEqual(validasiProbabilitas(PRESET_PROBABILITAS.mudah).valid, true);
  assert.strictEqual(validasiProbabilitas(PRESET_PROBABILITAS.normal).valid, true);
  assert.strictEqual(validasiProbabilitas(PRESET_PROBABILITAS.sulit).valid, true);
  assert.strictEqual(
    validasiProbabilitas({ besar: 20, sedang: 20, kecil: 20, sangat_kecil: 20, zonk: 10 }).valid,
    false
  );
  assert.throws(() => konfigurasiKerupukSoloSchema.parse({ targetKerupuk: 5, kesulitan: 'normal' }));

  const multiConf = bangunKonfigurasiKerupukMulti({
    targetKerupuk: 150,
    kesulitan: 'mudah',
    maxPeserta: 50,
    allowLateJoin: true,
  });
  assert.strictEqual(Object.isFrozen(multiConf), true);
  assert.strictEqual(multiConf.targetKerupuk, 150);
  assert.strictEqual(multiConf.maxPeserta, 50);

  // 2. Proporsional bite & RNG backend
  console.log('2. Menguji pengurangan proporsional & RNG backend...');
  assert.strictEqual(hitungPenguranganGigitan('besar', 100), 40);
  assert.strictEqual(hitungPenguranganGigitan('sedang', 200), 50);
  assert.strictEqual(hitungPenguranganGigitan('kecil', 150), 15);
  assert.strictEqual(hitungPenguranganGigitan('sangat_kecil', 200), 10);
  assert.strictEqual(hitungPenguranganGigitan('zonk', 200), 0);

  assert.strictEqual(drawGachaGigitan(PRESET_PROBABILITAS.normal, 100, 0.05).tipe, 'besar');
  assert.strictEqual(drawGachaGigitan(PRESET_PROBABILITAS.normal, 100, 0.2).tipe, 'sedang');
  assert.strictEqual(drawGachaGigitan(PRESET_PROBABILITAS.normal, 100, 0.5).tipe, 'kecil');
  assert.strictEqual(drawGachaGigitan(PRESET_PROBABILITAS.normal, 100, 0.85).tipe, 'sangat_kecil');
  assert.strictEqual(drawGachaGigitan(PRESET_PROBABILITAS.normal, 100, 0.98).tipe, 'zonk');

  // 3. Kalkulasi skor terpisah, streak 3 sekali per rangkaian, clamp >= 0, & bonus penyelesaian
  console.log('3. Menguji kalkulasi skor terpisah, streak 3, clamp kerupuk, & bonus penyelesaian...');
  const conf100 = bangunKonfigurasiKerupukSolo({ targetKerupuk: 100, kesulitan: 'normal' });
  let st = buatStateKerupukAwal(100);
  st = hitungHasilJawabanKerupukSolo(st, conf100, { questionId: 'q1', nomorSoal: 1 }, true, 1200, 1000, 0.99).stateUpdated; // zonk
  st = hitungHasilJawabanKerupukSolo(st, conf100, { questionId: 'q2', nomorSoal: 2 }, true, 1000, 2000, 0.80).stateUpdated; // -5
  const h3 = hitungHasilJawabanKerupukSolo(st, conf100, { questionId: 'q3', nomorSoal: 3 }, true, 1100, 3000, 0.50); // -10, streak 3!
  st = h3.stateUpdated;
  assert.strictEqual(h3.bonusStreak, 50);
  assert.strictEqual(st.skorPembelajaran, 350);
  const h4 = hitungHasilJawabanKerupukSolo(st, conf100, { questionId: 'q1', nomorSoal: 4 }, true, 900, 4000, 0.20); // -25, streak 4 -> 0
  st = h4.stateUpdated;
  assert.strictEqual(h4.bonusStreak, 0);
  st = hitungHasilJawabanKerupukSolo(st, conf100, { questionId: 'q2', nomorSoal: 5 }, false, 1500, 5000).stateUpdated; // salah reset
  assert.strictEqual(st.streakBenar, 0);

  // Habiskan sisa 60 lewat besar (-40 -> 20, lalu -40 clamp ke 0)
  st = hitungHasilJawabanKerupukSolo(st, conf100, { questionId: 'q1', nomorSoal: 6 }, true, 900, 6000, 0.01).stateUpdated;
  const hFin = hitungHasilJawabanKerupukSolo(st, conf100, { questionId: 'q2', nomorSoal: 7 }, true, 900, 7000, 0.01);
  st = hFin.stateUpdated;
  assert.strictEqual(st.sisaKerupuk, 0);
  assert.strictEqual(hFin.bonusPenyelesaian, 100);
  assert.strictEqual(st.skorTotal, st.skorPembelajaran + st.bonusKeberuntungan + st.bonusPenyelesaian);

  // 4. Unit test State Machine Solo
  console.log('4. Menguji State Machine Solo (READY/PLAYING/PAUSED/FINISHED/STOPPED) & anti-repeat...');
  const sid = 'unit-solo-' + Date.now();
  const s = kerupukManager.inisialisasiSesi(sid, 'guru-1', { id: 't', judul: 'Uji Solo' }, MOCK_QUESTIONS, { targetKerupuk: 50 });
  assert.strictEqual(s.state, 'READY');
  kerupukManager.mulaiPermainan(sid, 'guru-1');
  const p1 = s.activePresentation!;
  kerupukManager.jedaPermainan(sid, 'guru-1');
  assert.throws(() => kerupukManager.prosesJawaban(sid, 'guru-1', { presentationId: p1.presentationId, choiceId: p1.correctChoiceId }));
  kerupukManager.lanjutPermainan(sid, 'guru-1');
  assert.strictEqual(s.activePresentation!.presentationId, p1.presentationId);
  kerupukManager.hentikanPermainan(sid, 'guru-1');
  assert.strictEqual(s.state, 'STOPPED');
  assert.strictEqual(s.pemainState.bonusPenyelesaian, 0);
  kerupukManager.ulangPermainan(sid, 'guru-1');
  assert.strictEqual(s.state, 'READY');
  assert.strictEqual(s.pemainState.skorTotal, 0);
  assert.strictEqual(s.pemainState.sisaKerupuk, 50);
  kerupukManager.ulangPermainan(sid, 'guru-1', true);
  assert.strictEqual(s.state, 'PLAYING');
  const serializedAuto = kerupukManager.serialisasiSesiUntukClient(s);
  assert.ok(serializedAuto.soalSaatIni && serializedAuto.soalSaatIni.pilihan.length === 3);
  kerupukManager.hapusSesi(sid);

  for (let i = 0; i < 20; i++) {
    const ant = siapkanAntreanSoal(MOCK_QUESTIONS, MOCK_QUESTIONS[0].id);
    assert.notStrictEqual(ant[0], MOCK_QUESTIONS[0].id);
  }

  // 5. Unit test Leaderboard Sorting 5 Kriteria
  console.log('5. Menguji pengurutan leaderboard Multiplayer 5 kriteria...');
  const lb = urutkanLeaderboardKerupuk([
    { id: '1', nama: 'Budi', skorTotal: 300, totalBenar: 2, sisaKerupuk: 20, sisaPersen: 20, rataRataWaktuJawabMs: 2500, jumlahJawab: 2 },
    { id: '2', nama: 'Ani', skorTotal: 450, totalBenar: 3, sisaKerupuk: 0, sisaPersen: 0, rataRataWaktuJawabMs: 1800, jumlahJawab: 3 },
    { id: '3', nama: 'Cici', skorTotal: 300, totalBenar: 2, sisaKerupuk: 20, sisaPersen: 20, rataRataWaktuJawabMs: 1400, jumlahJawab: 2 },
  ]);
  assert.strictEqual(lb[0].nama, 'Ani');
  assert.strictEqual(lb[1].nama, 'Cici');
  assert.strictEqual(lb[2].nama, 'Budi');
  console.log('   ✓ Unit test Dual-Mode Shared Core, Solo, dan Multiplayer lulus 100%!\n');
}

async function jalankanIntegrationDualModeDan40Siswa() {
  console.log('▶ BAGIAN B: INTEGRASI HTTP, SOCKET.IO MULTIPLAYER (40 SISWA), SOLO & ISOLASI MODE');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/template', templateRouter);
  app.use('/api/sesi', sesiRouter);
  app.use(errorHandler);

  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: '*' } });
  setupMultiplayerSocket(io);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  let createdTemplateId: string | null = null;
  const createdSessionIds: string[] = [];
  const sockets: ClientSocket[] = [];

  try {
    // 1. Login Guru & buat template Makan Kerupuk (dipakai bersama oleh Solo & Multiplayer!)
    console.log('1. Login guru & membuat template Makan Kerupuk bersama...');
    const loginRes = await fetch(`${baseUrl}/api/auth/masuk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'guru@discere.local',
        kataSandi: 'GuruDiscere2026!',
      }),
    });
    assert.strictEqual(loginRes.ok, true);
    const cookieHeader = loginRes.headers.get('set-cookie');
    assert.ok(cookieHeader);
    const guruCookie = cookieHeader.split(';')[0];

    const tmplRes = await fetch(`${baseUrl}/api/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        judul: `Uji Dual Mode Kerupuk ${Date.now()}`,
        game: 'makan_kerupuk',
        mode: 'multi',
        questions: MOCK_QUESTIONS.map((q) => ({
          urutan: q.urutan,
          teks: q.teks,
          opsiA: q.opsiA,
          opsiB: q.opsiB,
          opsiC: q.opsiC,
          jawabanBenar: q.jawabanBenar,
          penjelasan: q.penjelasan,
        })),
      }),
    });
    assert.strictEqual(tmplRes.status, 201);
    const tmplData: any = await tmplRes.json();
    createdTemplateId = tmplData.template.id;
    const kunciTeksMap = new Map<string, string>();
    for (const q of tmplData.template.questions) {
      kunciTeksMap.set(q.id, q.jawabanBenar === 'A' ? q.opsiA : q.jawabanBenar === 'B' ? q.opsiB : q.opsiC);
    }

    // 2. Buat Sesi SOLO & Sesi MULTIPLAYER secara bersamaan dari template yang SAMA!
    console.log('2. Membuat Sesi SOLO (tanpa PIN) & Sesi MULTIPLAYER (PIN/QR, 40+ siswa) secara bersamaan...');
    const soloCreateRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        templateId: createdTemplateId,
        game: 'makan_kerupuk',
        mode: 'solo',
        playMode: 'SOLO',
        kerupukConfig: {
          targetKerupuk: 50,
          targetPreset: '50',
          kesulitan: 'custom',
          probabilitas: { besar: 100, sedang: 0, kecil: 0, sangat_kecil: 0, zonk: 0 },
        },
      }),
    });
    assert.strictEqual(soloCreateRes.status, 201);
    const soloJson: any = await soloCreateRes.json();
    const soloId: string = soloJson.session.id;
    createdSessionIds.push(soloId);
    assert.strictEqual(soloJson.session.playMode, 'SOLO');
    assert.strictEqual(soloJson.session.token, undefined);

    const multiCreateRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        templateId: createdTemplateId,
        game: 'makan_kerupuk',
        mode: 'multi',
        playMode: 'MULTIPLAYER',
        kerupukMultiConfig: {
          targetKerupuk: 50,
          targetPreset: '50',
          kesulitan: 'custom',
          probabilitas: { besar: 100, sedang: 0, kecil: 0, sangat_kecil: 0, zonk: 0 },
          maxPeserta: 50,
          allowLateJoin: true,
        },
      }),
    });
    assert.strictEqual(multiCreateRes.status, 201);
    const multiJson: any = await multiCreateRes.json();
    const multiId: string = multiJson.session.id;
    const multiToken: string = multiJson.session.token;
    createdSessionIds.push(multiId);
    assert.strictEqual(multiJson.session.playMode, 'MULTIPLAYER');
    assert.strictEqual(multiToken.length, 6);
    assert.ok(multiJson.session.qrDataUrl?.startsWith('data:image/png'));

    // Cek publik token endpoint
    const tokCekRes = await fetch(`${baseUrl}/api/sesi/token/${multiToken}`);
    const tokCek: any = await tokCekRes.json();
    assert.strictEqual(tokCek.valid, true);
    assert.strictEqual(tokCek.game, 'makan_kerupuk');
    assert.strictEqual(tokCek.playMode, 'MULTIPLAYER');

    // 3. Uji SOLO sambil MULTIPLAYER sedang aktif di lobi (memastikan nol pencampuran!)
    console.log('3. Memulai & memverifikasi SOLO (Pause/Resume/Jawab/Selesai) terisolasi dari MULTIPLAYER...');
    const sMulai = await fetch(`${baseUrl}/api/sesi/${soloId}/mulai`, {
      method: 'POST',
      headers: { Cookie: guruCookie },
    });
    assert.strictEqual(sMulai.ok, true);
    let soloSoal = ((await sMulai.json()) as any).session.soalSaatIni;

    const sPause = await fetch(`${baseUrl}/api/sesi/${soloId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({ state: 'PAUSED' }),
    });
    assert.strictEqual(sPause.ok, true);

    const sJawabPaused = await fetch(`${baseUrl}/api/sesi/${soloId}/jawab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        presentationId: soloSoal.presentationId,
        choiceId: soloSoal.pilihan[0].choiceId,
      }),
    });
    assert.strictEqual(sJawabPaused.status, 400);

    await fetch(`${baseUrl}/api/sesi/${soloId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({ state: 'PLAYING' }),
    });

    // Jawab 3x benar hingga kerupuk 50 -> 30 -> 10 -> 0 (FINISHED)
    let soloLast: any = null;
    for (let k = 0; k < 3; k++) {
      const benarChoice = soloSoal.pilihan.find((p: any) => p.teks === kunciTeksMap.get(soloSoal.questionId))!;
      const r = await fetch(`${baseUrl}/api/sesi/${soloId}/jawab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
        body: JSON.stringify({
          presentationId: soloSoal.presentationId,
          choiceId: benarChoice.choiceId,
        }),
      });
      assert.strictEqual(r.ok, true);
      soloLast = await r.json();
      soloSoal = soloLast.soalBerikutnya;
    }
    assert.strictEqual(soloLast.isFinished, true);
    assert.strictEqual(soloLast.skorTotal, 570);
    assert.strictEqual(await prisma.sessionPlayer.count({ where: { sessionId: soloId } }), 0, 'Solo tidak menyimpan SessionPlayer');

    // 3b. Uji Alur Langsung SOLO Mode (autoStart: true) + Tolak Join Siswa/Socket.IO
    console.log('3b. Menguji Solo Mode langsung PLAYING (autoStart), tolak PIN/QR/Socket.IO, & main lagi...');
    const soloDirectRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        templateId: createdTemplateId,
        game: 'makan_kerupuk',
        mode: 'solo',
        playMode: 'SOLO',
        autoStart: true,
        kerupukConfig: {
          targetKerupuk: 50,
          targetPreset: '50',
          kesulitan: 'custom',
          probabilitas: { besar: 100, sedang: 0, kecil: 0, sangat_kecil: 0, zonk: 0 },
        },
      }),
    });
    assert.strictEqual(soloDirectRes.status, 201);
    const soloDirectJson: any = await soloDirectRes.json();
    const soloDirectId: string = soloDirectJson.session.id;
    createdSessionIds.push(soloDirectId);

    assert.strictEqual(soloDirectJson.session.playMode, 'SOLO');
    assert.strictEqual(soloDirectJson.session.state, 'PLAYING');
    assert.strictEqual(soloDirectJson.session.token, undefined);
    assert.strictEqual(soloDirectJson.session.qrDataUrl, undefined);
    assert.ok(soloDirectJson.session.soalSaatIni?.presentationId, 'Soal #1 harus langsung tersedia saat Mulai Permainan');
    assert.strictEqual(soloDirectJson.session.soalSaatIni.pilihan?.length, 3);

    const soloDirectDb = await prisma.session.findUnique({ where: { id: soloDirectId } });
    assert.strictEqual(soloDirectDb?.mode, 'solo');
    assert.strictEqual(soloDirectDb?.token, null);
    assert.strictEqual(soloDirectDb?.status, 'jalan');

    // Verifikasi GET /api/sesi/token/:soloDirectId ditolak
    const cekSoloTokRes = await fetch(`${baseUrl}/api/sesi/token/${soloDirectId}`);
    assert.strictEqual(cekSoloTokRes.status, 400);
    const cekSoloTokJson: any = await cekSoloTokRes.json();
    assert.strictEqual(cekSoloTokJson.valid, false);

    // Verifikasi Socket.IO menolak seluruh event Multiplayer terhadap sesi Solo
    const guardSock = ioClient(baseUrl, { transports: ['websocket'] });
    sockets.push(guardSock);
    await waitForEvent(guardSock, 'connect');

    const soloGabungAck = await emitWithAck(guardSock, 'sesi:gabung', { token: soloDirectId, nama: 'Penyusup' });
    assert.strictEqual(soloGabungAck.success, false);

    const hostErrP = waitForEvent(guardSock, 'sesi:error');
    guardSock.emit('sesi:host_join', { sessionId: soloDirectId });
    const hostErrEvt = await hostErrP;
    assert.ok(hostErrEvt?.pesan);

    const soloMulaiSockAck = await emitWithAck(guardSock, 'sesi:mulai', { sessionId: soloDirectId });
    assert.strictEqual(soloMulaiSockAck.success, false);

    const soloJawabSockAck = await emitWithAck(guardSock, 'jawab:kirim', {
      sessionId: soloDirectId,
      pesertaId: 'p1',
      jawaban: 'A',
    });
    assert.strictEqual(soloJawabSockAck.success, false);

    const soloStopSockAck = await emitWithAck(guardSock, 'sesi:akhiri_manual', { sessionId: soloDirectId });
    assert.strictEqual(soloStopSockAck.success, false);
    guardSock.disconnect();

    // Ulang langsung ke PLAYING tanpa layar READY perantara
    const ulangDirectRes = await fetch(`${baseUrl}/api/sesi/${soloDirectId}/ulang`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({ autoStart: true }),
    });
    assert.strictEqual(ulangDirectRes.status, 200);
    const ulangDirectJson: any = await ulangDirectRes.json();
    assert.strictEqual(ulangDirectJson.session.state, 'PLAYING');
    let soalDirect = ulangDirectJson.session.soalSaatIni;
    assert.ok(soalDirect?.presentationId);

    for (let k = 0; k < 3; k++) {
      const benarC = soalDirect.pilihan.find((p: any) => p.teks === kunciTeksMap.get(soalDirect.questionId))!;
      const rDirect = await fetch(`${baseUrl}/api/sesi/${soloDirectId}/jawab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
        body: JSON.stringify({
          presentationId: soalDirect.presentationId,
          choiceId: benarC.choiceId,
        }),
      });
      assert.strictEqual(rDirect.ok, true);
      const dRes: any = await rDirect.json();
      soalDirect = dRes.soalBerikutnya;
    }

    const mainLagiRes = await fetch(`${baseUrl}/api/sesi/${soloDirectId}/main-lagi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({ autoStart: true }),
    });
    assert.strictEqual(mainLagiRes.status, 201);
    const mainLagiJson: any = await mainLagiRes.json();
    createdSessionIds.push(mainLagiJson.sessionId);
    assert.strictEqual(mainLagiJson.session.state, 'PLAYING');
    assert.ok(mainLagiJson.session.soalSaatIni?.presentationId);
    assert.strictEqual(await prisma.sessionPlayer.count({ where: { sessionId: soloDirectId } }), 0);

    // 4. Hubungkan Host + 40 SISWA bersamaan via Socket.IO ke Sesi Multiplayer!
    console.log('4. Menghubungkan Host + 40 siswa bersamaan ke Socket.IO Multiplayer...');
    const hostSock = ioClient(baseUrl, { transports: ['websocket'] });
    sockets.push(hostSock);
    await waitForEvent(hostSock, 'connect');
    hostSock.emit('sesi:host_join', { sessionId: multiId });

    interface SiswaClient {
      idx: number;
      nama: string;
      socket: ClientSocket;
      pesertaId: string;
      pesertaSecret: string;
      soalAktif: any;
    }
    const siswaList: SiswaClient[] = [];

    const joinResults = await Promise.all(
      Array.from({ length: 40 }, async (_, idx) => {
        const sc = ioClient(baseUrl, { transports: ['websocket'] });
        sockets.push(sc);
        await waitForEvent(sc, 'connect');
        const nama = `Siswa-${String(idx + 1).padStart(2, '0')}`;
        const j = await emitWithAck(sc, 'sesi:gabung', { token: multiToken, nama });
        assert.strictEqual(j.success, true, `${nama} gagal gabung: ${j.pesan}`);
        assert.strictEqual(j.game, 'makan_kerupuk');
        assert.strictEqual(j.playMode, 'MULTIPLAYER');
        return {
          idx,
          nama,
          socket: sc,
          pesertaId: j.pesertaId,
          pesertaSecret: j.pesertaSecret,
          soalAktif: null,
        } as SiswaClient;
      })
    );
    siswaList.push(...joinResults);
    assert.strictEqual(siswaList.length, 40);

    // 5. Guru memulai lomba Multiplayer -> seluruh 40 siswa menerima soal awal independen!
    console.log('5. Guru memulai lomba -> seluruh 40 siswa menerima soal independen masing-masing...');
    const soalListeners = siswaList.map((sw) =>
      waitForEvent(sw.socket, 'soal:tampil').then((s) => {
        sw.soalAktif = s;
      })
    );
    const startAck = await emitWithAck(hostSock, 'sesi:mulai', { sessionId: multiId });
    assert.strictEqual(startAck.success, true);
    await Promise.all(soalListeners);
    assert.ok(siswaList.every((sw) => sw.soalAktif?.presentationId && sw.soalAktif.pilihan?.length === 3));

    // 6. Uji Reconnect untuk Siswa-01 (putus socket -> gabung ulang memulihkan ID, soal aktif, & skor)
    console.log('6. Menguji Reconnect Siswa-01 & penyelesaian penuh Siswa-02...');
    const sw0 = siswaList[0];
    const sw0PrevPres = sw0.soalAktif.presentationId;
    sw0.socket.disconnect();
    await new Promise((r) => setTimeout(r, 80));

    const sw0ReconnSock = ioClient(baseUrl, { transports: ['websocket'] });
    sockets.push(sw0ReconnSock);
    await waitForEvent(sw0ReconnSock, 'connect');
    const reconnRes = await emitWithAck(sw0ReconnSock, 'sesi:gabung', {
      token: multiToken,
      nama: sw0.nama,
      pesertaId: sw0.pesertaId,
      pesertaSecret: sw0.pesertaSecret,
    });
    assert.strictEqual(reconnRes.success, true);
    assert.strictEqual(reconnRes.isReconnect, true);
    assert.strictEqual(reconnRes.pesertaId, sw0.pesertaId);
    assert.strictEqual(reconnRes.soalAktif?.presentationId, sw0PrevPres, 'Soal aktif harus pulih persis saat reconnect');
    sw0.socket = sw0ReconnSock;

    // 7. Siswa-02 menjawab 3x benar sampai kerupuknya ludes 0 -> tidak lagi dapat soal & ditolak bila jawab lagi!
    const sw1 = siswaList[1];
    let soalS1 = sw1.soalAktif;
    for (let step = 1; step <= 3; step++) {
      const benarChoice = soalS1.pilihan.find((p: any) => p.teks === kunciTeksMap.get(soalS1.questionId))!;
      const finishP = step === 3 ? waitForEvent(sw1.socket, 'pemain:selesai') : null;
      const nextP = step < 3 ? waitForEvent(sw1.socket, 'soal:tampil') : null;

      const ack = await emitWithAck(sw1.socket, 'jawab:kirim', {
        sessionId: multiId,
        pesertaId: sw1.pesertaId,
        pesertaSecret: sw1.pesertaSecret,
        presentationId: soalS1.presentationId,
        questionId: soalS1.questionId,
        choiceId: benarChoice.choiceId,
      });
      assert.strictEqual(ack.success, true);
      assert.strictEqual(ack.benar, true);

      if (step < 3 && nextP) {
        soalS1 = await nextP;
      }
      if (finishP) {
        const finEvt = await finishP;
        assert.strictEqual(finEvt.peserta.sisaKerupuk, 0);
        assert.strictEqual(finEvt.peserta.selesaiKerupuk, true);
        assert.strictEqual(finEvt.peserta.skorTotal, 570);
      }
    }

    // Siswa yang sudah selesai ditolak bila mencoba jawab lagi
    const extraReject = await emitWithAck(sw1.socket, 'jawab:kirim', {
      sessionId: multiId,
      pesertaId: sw1.pesertaId,
      pesertaSecret: sw1.pesertaSecret,
      presentationId: soalS1.presentationId,
      questionId: soalS1.questionId,
      choiceId: soalS1.pilihan[0].choiceId,
    });
    assert.strictEqual(extraReject.success, false, 'Pemain selesai wajib ditolak saat jawab lagi');

    // 8. 39 siswa lain tetap dapat menjawab paralel secara independen!
    console.log('7. Menguji 39 siswa tersisa menjawab paralel & leaderboard real-time...');
    await Promise.all(
      siswaList.filter((s) => s.idx !== 1).map(async (sw) => {
        const benarChoice = sw.soalAktif.pilihan.find(
          (p: any) => p.teks === kunciTeksMap.get(sw.soalAktif.questionId)
        )!;
        const r = await emitWithAck(sw.socket, 'jawab:kirim', {
          sessionId: multiId,
          pesertaId: sw.pesertaId,
          pesertaSecret: sw.pesertaSecret,
          presentationId: sw.soalAktif.presentationId,
          questionId: sw.soalAktif.questionId,
          choiceId: benarChoice.choiceId,
        });
        assert.strictEqual(r.success, true);
        assert.strictEqual(r.sisaKerupukBaru, 30);
      })
    );

    // 9. Guru akhiri sesi Multiplayer -> tersimpan lengkap di DB (40 SessionPlayer rows + Riwayat Detail berbeda dengan Solo)
    console.log('8. Mengakhiri sesi Multiplayer & memverifikasi persistensi database Dual Mode...');
    const selesaiEvtP = waitForEvent(hostSock, 'sesi:selesai');
    const stopMultiAck = await emitWithAck(hostSock, 'sesi:akhiri_manual', { sessionId: multiId });
    assert.strictEqual(stopMultiAck.success, true);
    const selesaiEvt = await selesaiEvtP;
    assert.strictEqual(selesaiEvt.hasil.totalPeserta, 40);
    assert.strictEqual(selesaiEvt.hasil.leaderboard[0].nama, 'Siswa-02');
    assert.strictEqual(selesaiEvt.hasil.leaderboard[0].skorTotal, 570);

    const dbPlayersCount = await prisma.sessionPlayer.count({ where: { sessionId: multiId } });
    assert.strictEqual(dbPlayersCount, 40, 'Multiplayer wajib menyimpan 40 SessionPlayer ke DB');

    // Verifikasi riwayat detail SOLO vs MULTIPLAYER terpisah rapi
    const soloRiwayat = await (
      await fetch(`${baseUrl}/api/sesi/riwayat/${soloId}`, { headers: { Cookie: guruCookie } })
    ).json();
    const multiRiwayat = await (
      await fetch(`${baseUrl}/api/sesi/riwayat/${multiId}`, { headers: { Cookie: guruCookie } })
    ).json();

    assert.strictEqual(soloRiwayat.detail.mode, 'SOLO');
    assert.ok(soloRiwayat.detail.laporanKerupukSolo);
    assert.strictEqual(soloRiwayat.detail.laporanKerupukMulti, null);

    assert.strictEqual(multiRiwayat.detail.mode, 'MULTI');
    assert.ok(multiRiwayat.detail.laporanKerupukMulti);
    assert.strictEqual(multiRiwayat.detail.laporanKerupukMulti.leaderboard.length, 40);
    assert.strictEqual(multiRiwayat.detail.laporanKerupukSolo, null);

    console.log('   ✓ Integrasi Dual Mode (Solo + 40-Siswa Multiplayer + Reconnect + DB) lulus 100%!\n');
  } finally {
    sockets.forEach((s) => s.disconnect());
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const sid of createdSessionIds) {
      kerupukManager.hapusSesi(sid);
      kerupukMultiManager.hapusSesi(sid);
      await prisma.session.deleteMany({ where: { id: sid } });
    }
    if (createdTemplateId) {
      await prisma.template.deleteMany({ where: { id: createdTemplateId } });
    }
    await prisma.$disconnect();
  }
}

async function main() {
  console.log('\n================================================================');
  console.log('PENGUJIAN DUAL MODE MAKAN KERUPUK CHALLENGE (SOLO + 40 MULTI)');
  console.log('================================================================\n');
  jalankanUnitTests();
  await jalankanIntegrationDualModeDan40Siswa();
  console.log('================================================================');
  console.log('SELURUH UJI DUAL MODE MAKAN KERUPUK CHALLENGE LULUS 100%!');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('❌ PENGUJIAN DUAL MODE GAGAL:', err);
  process.exit(1);
});
