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
  POSISI_AWAL_TALI,
  BATAS_MIN_TALI,
  BATAS_MAX_TALI,
  konfigurasiTarikTambangSchema,
  bangunKonfigurasiTarikTambang,
  filterBankSoalSetara,
  perbaruiStreakIndividu,
  hitungBonusKekompakan,
  evaluasiTarikanSolo,
  evaluasiTarikanMulti,
  bangunAnalisisHeatmapTarik,
  cekKondisiSelesai,
  tentukanPemenang,
  tentukanHadiahPowerUp,
} from '../server/src/games/tarikTambang.js';
import { soloManager } from '../server/src/games/soloManager.js';
import { multiManager } from '../server/src/games/multiManager.js';

const MOCK_QUESTIONS_MIXED = [
  {
    id: 'tt-m1',
    urutan: 1,
    teks: 'Kemerdekaan RI diproklamasikan pada tanggal?',
    opsiA: '17 Agustus 1945',
    opsiB: '10 November 1945',
    opsiC: '20 Mei 1908',
    jawabanBenar: 'A',
    penjelasan: 'Proklamasi dibacakan 17 Agustus 1945.',
    kesulitan: 'sedang',
  },
  {
    id: 'tt-m2',
    urutan: 2,
    teks: 'Warna bendera negara Republik Indonesia adalah?',
    opsiA: 'Putih Biru',
    opsiB: 'Merah Putih',
    opsiC: 'Merah Kuning',
    jawabanBenar: 'B',
    penjelasan: 'Bendera Indonesia bernama Sang Saka Merah Putih.',
    kesulitan: 'sedang',
  },
  {
    id: 'tt-m3',
    urutan: 3,
    teks: 'Dasar negara Indonesia adalah?',
    opsiA: 'UUD 1945',
    opsiB: 'Bhinneka Tunggal Ika',
    opsiC: 'Pancasila',
    jawabanBenar: 'C',
    penjelasan: 'Pancasila merupakan dasar negara Indonesia.',
    kesulitan: 'sedang',
  },
  {
    id: 'tt-m4',
    urutan: 4,
    teks: 'Lagu kebangsaan Indonesia berjudul?',
    opsiA: 'Indonesia Raya',
    opsiB: 'Garuda Pancasila',
    opsiC: 'Hari Merdeka',
    jawabanBenar: 'A',
    penjelasan: 'Indonesia Raya diciptakan oleh W.R. Supratman.',
    kesulitan: 'sedang',
  },
  {
    id: 'tt-hard-1',
    urutan: 5,
    teks: 'Hanya ada 1 soal sulit — ditolak jika filter sulit saja',
    opsiA: 'Satu',
    opsiB: 'Dua',
    opsiC: 'Tiga',
    jawabanBenar: 'A',
    penjelasan: 'Uji filter kesulitan.',
    kesulitan: 'sulit',
  },
];

function waitForEvent<T = any>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 8000
): Promise<T> {
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

function emitWithAck<T = any>(
  socket: ClientSocket,
  event: string,
  payload: any,
  timeoutMs = 8000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout ack: ${event}`)), timeoutMs);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(t);
      resolve(res);
    });
  });
}

function jalankanUnitTests() {
  console.log('\n▶ BAGIAN A: UNIT TEST CORE TARIK TAMBANG KONTINU (-100..+100), SOLO & MULTI');

  // 1. Konfigurasi & Filter Kesulitan Setara
  console.log('1. Menguji konfigurasi kontinu & filter bank soal...');
  const confDefault = bangunKonfigurasiTarikTambang({});
  assert.strictEqual(confDefault.kesulitan, 'semua');
  assert.strictEqual(confDefault.durasiLombaDetik, 180);
  assert.strictEqual(confDefault.waktuPerSoalDetik, 10);
  assert.strictEqual(confDefault.tarikBenarSolo, 10);
  assert.strictEqual(confDefault.mundurSalahSolo, 4);
  assert.strictEqual(confDefault.kekuatanTimMulti, 40);
  assert.strictEqual(confDefault.rasioTerpeleset, 0.4);
  assert.strictEqual(confDefault.batasMenang, 100);
  assert.strictEqual(confDefault.maxPeserta, 36);

  assert.strictEqual(konfigurasiTarikTambangSchema.parse({ batasMenang: 25 }).batasMenang, 25);
  assert.throws(() => konfigurasiTarikTambangSchema.parse({ batasMenang: 5 }));
  assert.throws(() => konfigurasiTarikTambangSchema.parse({ batasMenang: 250 }));
  assert.throws(() => konfigurasiTarikTambangSchema.parse({ durasiLombaDetik: 10 }));
  assert.throws(() => konfigurasiTarikTambangSchema.parse({ durasiRonde: 99 }));
  assert.throws(() => filterBankSoalSetara(MOCK_QUESTIONS_MIXED, 'sulit'));

  const poolSemua = filterBankSoalSetara(MOCK_QUESTIONS_MIXED, 'semua');
  assert.strictEqual(poolSemua.length, 5);
  const poolSedang = filterBankSoalSetara(MOCK_QUESTIONS_MIXED, 'sedang');
  assert.strictEqual(poolSedang.length, 4);
  console.log('   ✓ Konfigurasi HTML Festival & filter kesulitan (semua/sedang/sulit) tervalidasi.');

  // 2. Rumus Tarikan Solo (+10 / -4), Multi (40/sz, -0.4*k), Streak, & Heatmap
  console.log('2. Menguji rumus tarikan Solo, Multiplayer 40/sz(t), streak, & heatmap...');
  const soloMerahOk = evaluasiTarikanSolo({
    posisiLama: POSISI_AWAL_TALI,
    tim: 'merah',
    benar: true,
    config: confDefault,
  });
  assert.strictEqual(soloMerahOk.deltaTali, 10);
  assert.strictEqual(soloMerahOk.posisiBaru, 10);

  const soloMerahWrong = evaluasiTarikanSolo({
    posisiLama: 10,
    tim: 'merah',
    benar: false,
    config: confDefault,
  });
  assert.strictEqual(soloMerahWrong.deltaTali, -4);
  assert.strictEqual(soloMerahWrong.posisiBaru, 6);

  const soloPutihOk = evaluasiTarikanSolo({
    posisiLama: 6,
    tim: 'putih',
    benar: true,
    config: confDefault,
  });
  assert.strictEqual(soloPutihOk.deltaTali, -10);
  assert.strictEqual(soloPutihOk.posisiBaru, -4);

  // Multiplayer dengan 20 anggota per tim: k = 40 / 20 = 2.0, salah = -0.4 * 2.0 = -0.8
  const multiMerahOk20 = evaluasiTarikanMulti({
    posisiLama: 0,
    tim: 'merah',
    jumlahAnggotaTim: 20,
    benar: true,
    config: confDefault,
  });
  assert.strictEqual(multiMerahOk20.kekuatanSatuan, 2);
  assert.strictEqual(multiMerahOk20.deltaTali, 2);

  const multiBiruWrong20 = evaluasiTarikanMulti({
    posisiLama: 2,
    tim: 'putih',
    jumlahAnggotaTim: 20,
    benar: false,
    config: confDefault,
  });
  assert.strictEqual(multiBiruWrong20.deltaTali, 0.8);
  assert.strictEqual(multiBiruWrong20.posisiBaru, 2.8);

  assert.strictEqual(hitungBonusKekompakan(80, 100, true), 5);
  assert.strictEqual(hitungBonusKekompakan(100, 100, true), 10);

  let streakState = {
    streakSaatIni: 0,
    streakTertinggi: 0,
    milestone3SudahDapat: false,
    milestone5SudahDapat: false,
  };
  for (let i = 1; i <= 5; i++) {
    const res = perbaruiStreakIndividu({
      ...streakState,
      benar: true,
      bonusAktif: true,
    });
    streakState = {
      streakSaatIni: res.streakBaru,
      streakTertinggi: res.streakTertinggiBaru,
      milestone3SudahDapat: res.milestone3SudahDapat,
      milestone5SudahDapat: res.milestone5SudahDapat,
    };
    if (i === 3) assert.strictEqual(res.bonusDidapat, 5, 'Streak 3 harus memberi +5');
    else if (i === 5) assert.strictEqual(res.bonusDidapat, 10, 'Streak 5 harus memberi +10');
    else assert.strictEqual(res.bonusDidapat, 0);
  }
  const resReset = perbaruiStreakIndividu({
    ...streakState,
    benar: false,
    bonusAktif: true,
  });
  assert.strictEqual(resReset.streakBaru, 0);

  // Clamp [-batasMenang .. +batasMenang] & penentuan pemenang
  assert.strictEqual(cekKondisiSelesai(10, 25), false);
  assert.strictEqual(cekKondisiSelesai(25, 25), true);
  assert.strictEqual(tentukanPemenang(BATAS_MAX_TALI), 'merah');
  assert.strictEqual(tentukanPemenang(BATAS_MIN_TALI), 'putih');
  assert.strictEqual(tentukanPemenang(0), 'seri');

  assert.strictEqual(
    tentukanHadiahPowerUp({
      powerUpAktif: true,
      bankSaatIni: 'semangat_tim',
      streakBaru: 5,
      akurasiRondePersen: 100,
    }),
    'semangat_tim'
  );

  // Heatmap mencatat percobaan PERTAMA saja meski soal terulang & dijawab benar pada percobaan ke-2
  const hm = bangunAnalisisHeatmapTarik(
    poolSedang,
    [
      { id: 'merah', nama: 'Tim Merah', warna: '#e2312d' },
      { id: 'putih', nama: 'Tim Biru', warna: '#1d8fe0' },
    ],
    [
      {
        id: 'p-1',
        nama: 'Ani',
        tim: 'merah',
        riwayatJawaban: [
          {
            questionId: 'tt-m1',
            benar: false,
            timedOut: false,
            jawabanKey: 'B',
            jawabanTeks: '10 November 1945',
          },
          {
            questionId: 'tt-m1',
            benar: true,
            timedOut: false,
            jawabanKey: 'A',
            jawabanTeks: '17 Agustus 1945',
          },
        ],
      },
    ]
  );
  const cellQ1 = hm.teams[0].rows[0].cells.find((c) => c.questionId === 'tt-m1')!;
  assert.strictEqual(cellQ1.ok, false, 'Heatmap wajib mencatat hasil percobaan PERTAMA');
  assert.strictEqual(hm.teams[0].rows[0].benarPertamaCount, 0);
  console.log('   ✓ Rumus Solo/Multi, streak, non-stack power-up & Heatmap percobaan-pertama akurat.');

  // 3. Uji SoloManager Kontinu (Lokal + Bot AI + Pause/Resume + Ulang)
  console.log('3. Menguji mekanisme kontinu, Bot AI, jeda, dan ulang di soloManager...');
  const sid = 'unit-solo-tt-' + Date.now();
  const s = soloManager.inisialisasiSesi(
    sid,
    'host-u1',
    { id: 't-u1', judul: 'Uji Unit Solo' },
    poolSedang,
    {
      kesulitan: 'sedang',
      tipeLawanSolo: 'bot',
      kesulitanBot: 'sedang',
      durasiLombaDetik: 180,
      tarikBenarSolo: 10,
      mundurSalahSolo: 4,
      bonusAktif: false,
      powerUpAktif: false,
    }
  );
  assert.throws(() => soloManager.ubahStateSesi(sid, 'host-u1', 'PAUSED'));

  soloManager.mulaiSesi(sid, 'host-u1');
  const pres1Awal = s.pemain1.presentasiAktif!;
  const pres2Awal = s.pemain2.presentasiAktif!;
  assert.ok(pres1Awal && pres2Awal, 'Kedua kubu menerima soal acak saat mulai');

  // Pause menahan input & membekukan jam; Resume mengembalikan state PLAYING
  soloManager.ubahStateSesi(sid, 'host-u1', 'PAUSED');
  assert.strictEqual(s.state, 'PAUSED');
  assert.throws(() =>
    soloManager.prosesJawaban(sid, 'host-u1', {
      tim: 'merah',
      presentationId: pres1Awal.presentationId,
      choiceId: pres1Awal.correctChoiceId,
    })
  );
  soloManager.ubahStateSesi(sid, 'host-u1', 'PLAYING');

  // Jawab Merah benar -> langsung +10 & pemain1 langsung berganti ke soal berikutnya!
  const jR1 = soloManager.prosesJawaban(sid, 'host-u1', {
    tim: 'merah',
    presentationId: pres1Awal.presentationId,
    choiceId: pres1Awal.correctChoiceId,
  });
  assert.strictEqual(jR1.benar, true);
  assert.strictEqual(jR1.feedback.deltaTali, 10);
  assert.strictEqual(s.taliPosition, 10);
  assert.strictEqual(s.skorMerah, 1);
  assert.notStrictEqual(s.pemain1.presentasiAktif!.presentationId, pres1Awal.presentationId);

  // Bot langkah maju memproses pemain2
  const resBot = soloManager.jalankanLangkahBot(sid, 'host-u1');
  assert.strictEqual(resBot.executed, true);
  assert.strictEqual(resBot.feedback?.tim, 'putih');
  assert.notStrictEqual(s.pemain2.presentasiAktif!.presentationId, pres2Awal.presentationId);

  // Ulang mengembalikan skor & posisi ke 0 bersih
  soloManager.ulangPermainan(sid, 'host-u1', true);
  assert.strictEqual(s.state, 'PLAYING');
  assert.strictEqual(s.taliPosition, 0);
  assert.strictEqual(s.skorMerah, 0);
  assert.strictEqual(s.skorPutih, 0);

  // Akhiri manual idempoten
  const ended1 = soloManager.selesaikanSesi(sid, 'host-u1');
  const ended2 = soloManager.selesaikanSesi(sid, 'host-u1');
  assert.strictEqual(ended1.selesaiPada, ended2.selesaiPada);

  soloManager.hapusSesi(sid);
  console.log('   ✓ State kontinu, Bot AI, pause/resume, ulang, & selesaikanSesi tervalidasi.');
}

async function jalankanIntegrationTests() {
  console.log('\n▶ BAGIAN B: E2E INTEGRATION TEST (SOLO LOKAL/BOT + MULTIPLAYER 40 SISWA + HEATMAP)');

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
  const openSockets: ClientSocket[] = [];

  try {
    // 1. Login Guru & Buat Template Setara 6 Soal
    console.log('1. Login guru & membuat paket soal Tarik Tambang...');
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

    const bankQuestions = [
      ...MOCK_QUESTIONS_MIXED.filter((q) => q.kesulitan === 'sedang'),
      {
        urutan: 5,
        teks: 'Pahlawan proklamator bersama Soekarno adalah?',
        opsiA: 'Mohammad Hatta',
        opsiB: 'Ki Hajar Dewantara',
        opsiC: 'Diponegoro',
        jawabanBenar: 'A',
        penjelasan: 'Soekarno-Hatta adalah Dwi Tunggal Proklamator.',
        kesulitan: 'sedang',
      },
      {
        urutan: 6,
        teks: 'Sila ketiga Pancasila dilambangkan dengan?',
        opsiA: 'Kepala Banteng',
        opsiB: 'Pohon Beringin',
        opsiC: 'Padi dan Kapas',
        jawabanBenar: 'B',
        penjelasan: 'Persatuan Indonesia dilambangkan Pohon Beringin.',
        kesulitan: 'sedang',
      },
    ];

    const tmplRes = await fetch(`${baseUrl}/api/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        judul: `Uji Dual Mode Tarik Tambang ${Date.now()}`,
        game: 'tarik_tambang',
        mode: 'solo',
        questions: bankQuestions,
      }),
    });
    const tmplText = await tmplRes.text();
    assert.strictEqual(tmplRes.status, 201, `POST /api/template gagal: ${tmplRes.status} ${tmplText}`);
    const tmplJson: any = JSON.parse(tmplText);
    createdTemplateId = tmplJson.template.id;

    const kunciPerSoal = new Map<string, string>();
    for (const q of tmplJson.template.questions) {
      kunciPerSoal.set(
        q.id,
        q.jawabanBenar === 'A' ? q.opsiA : q.jawabanBenar === 'B' ? q.opsiB : q.opsiC
      );
    }

    // 2. Uji Solo Mode — Local 1 vs 1 Kontinu (autoStart: true, tanpa PIN/QR/lobi)
    console.log('2. Menguji E2E Solo Mode Lokal 1v1 Kontinu + Ulang + DB...');
    const soloCreate = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        templateId: createdTemplateId,
        game: 'tarik_tambang',
        playMode: 'SOLO',
        mode: 'solo',
        autoStart: true,
        tarikTambangConfig: {
          sumberSoal: 'bank_soal',
          kesulitan: 'sedang',
          tipeLawanSolo: 'lokal',
          durasiLombaDetik: 180,
          tarikBenarSolo: 10,
          mundurSalahSolo: 4,
          bonusAktif: false,
          powerUpAktif: false,
          namaTim1: 'Kiri Merah',
          namaTim2: 'Kanan Biru',
        },
      }),
    });
    assert.strictEqual(soloCreate.status, 201);
    const soloCreateJson: any = await soloCreate.json();
    const soloId: string = soloCreateJson.session.id;
    createdSessionIds.push(soloId);

    assert.strictEqual(soloCreateJson.session.playMode, 'SOLO');
    assert.strictEqual(soloCreateJson.session.state, 'PLAYING');
    assert.strictEqual(soloCreateJson.session.token, undefined, 'Solo tidak boleh memiliki PIN token');
    assert.strictEqual(soloCreateJson.session.qrDataUrl, undefined, 'Solo tidak boleh memiliki QR Code');
    assert.ok(soloCreateJson.session.pemain1?.soalAktif);
    assert.ok(soloCreateJson.session.pemain2?.soalAktif);
    assert.strictEqual(soloCreateJson.session.pemain1.soalAktif.correctChoiceId, undefined);

    // Isolasi: Socket tidak boleh mengakses sesi Solo!
    const spyHostSocket = ioClient(baseUrl, { transports: ['websocket'] });
    openSockets.push(spyHostSocket);
    await new Promise<void>((r) => spyHostSocket.on('connect', () => r()));
    const errSocketPromise = waitForEvent<{ pesan: string }>(spyHostSocket, 'sesi:error');
    spyHostSocket.emit('sesi:host_join', { sessionId: soloId });
    const errSocket = await errSocketPromise;
    assert.ok(errSocket.pesan.includes('Solo'));

    const spyStartAck = await emitWithAck<any>(spyHostSocket, 'sesi:mulai', { sessionId: soloId });
    assert.strictEqual(spyStartAck.success, false, 'Socket sesi:mulai harus ditolak untuk Solo');

    // Tim Merah menjawab benar -> langsung memajukan skor & tali +10
    const s1 = soloCreateJson.session.pemain1.soalAktif;
    const benarTeks1 = kunciPerSoal.get(s1.questionId)!;
    const choiceBenar1 = s1.pilihan.find((c: any) => c.teks === benarTeks1)!;

    const jawabSolo1Res = await fetch(`${baseUrl}/api/sesi/${soloId}/jawab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        tim: 'merah',
        presentationId: s1.presentationId,
        choiceId: choiceBenar1.choiceId,
      }),
    });
    assert.strictEqual(jawabSolo1Res.status, 200);
    const jSolo1: any = await jawabSolo1Res.json();
    assert.strictEqual(jSolo1.feedback.benar, true);
    assert.strictEqual(jSolo1.taliPosition, 10);
    assert.strictEqual(jSolo1.skorMerah, 1);

    // Tim Biru menjawab salah -> mundur 4 (+4 ke kiri/Merah) -> tali jadi 14
    const s2 = jSolo1.session.pemain2.soalAktif;
    const benarTeks2 = kunciPerSoal.get(s2.questionId)!;
    const choiceSalah2 = s2.pilihan.find((c: any) => c.teks !== benarTeks2)!;
    const jawabSolo2Res = await fetch(`${baseUrl}/api/sesi/${soloId}/jawab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        tim: 'putih',
        presentationId: s2.presentationId,
        choiceId: choiceSalah2.choiceId,
      }),
    });
    const jSolo2: any = await jawabSolo2Res.json();
    assert.strictEqual(jSolo2.feedback.benar, false);
    assert.strictEqual(jSolo2.taliPosition, 14);

    // Uji /ulang mengembalikan posisi tali ke 0
    const ulangRes = await fetch(`${baseUrl}/api/sesi/${soloId}/ulang`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({ autoStart: true }),
    });
    assert.strictEqual(ulangRes.status, 200);
    const ulangJson: any = await ulangRes.json();
    assert.strictEqual(ulangJson.session.taliPosition, 0);

    // Jawab 1x benar lalu akhiri manual & cek DB
    const sReset1 = ulangJson.session.pemain1.soalAktif;
    const cReset1 = sReset1.pilihan.find(
      (c: any) => c.teks === kunciPerSoal.get(sReset1.questionId)!
    )!;
    await fetch(`${baseUrl}/api/sesi/${soloId}/jawab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        tim: 'merah',
        presentationId: sReset1.presentationId,
        choiceId: cReset1.choiceId,
      }),
    });

    const akhiriSoloRes = await fetch(`${baseUrl}/api/sesi/${soloId}/selesai`, {
      method: 'POST',
      headers: { Cookie: guruCookie },
    });
    assert.strictEqual(akhiriSoloRes.status, 200);

    const hasilSoloRes = await fetch(`${baseUrl}/api/sesi/${soloId}/hasil`, {
      headers: { Cookie: guruCookie },
    });
    const hasilSoloJson: any = await hasilSoloRes.json();
    assert.strictEqual(hasilSoloJson.hasil.timMenang, 'merah');
    assert.strictEqual(hasilSoloJson.hasil.posisiAkhir, 10);

    const dbPlayersSolo = await prisma.sessionPlayer.findMany({ where: { sessionId: soloId } });
    assert.strictEqual(dbPlayersSolo.length, 2, '2 siswa lokal Solo wajib tersimpan ke DB');
    console.log('   ✓ Solo Mode Lokal Kontinu, /ulang, anti-bocor kunci & DB tervalidasi.');

    // 2b. Uji Solo Bot AI + Batasan Menang Kustom (batasMenang: 25)
    console.log('2b. Menguji Solo Bot AI (/bot-langkah) & batasMenang = 25...');
    const soloBatasCreate = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        templateId: createdTemplateId,
        game: 'tarik_tambang',
        playMode: 'SOLO',
        mode: 'solo',
        autoStart: true,
        tarikTambangConfig: {
          kesulitan: 'sedang',
          tipeLawanSolo: 'bot',
          kesulitanBot: 'mudah',
          tarikBenarSolo: 15,
          mundurSalahSolo: 4,
          bonusAktif: false,
          powerUpAktif: false,
          batasMenang: 25,
        },
      }),
    });
    assert.strictEqual(soloBatasCreate.status, 201);
    const soloBatasJson: any = await soloBatasCreate.json();
    const soloBatasId: string = soloBatasJson.session.id;
    createdSessionIds.push(soloBatasId);

    const botStepRes = await fetch(`${baseUrl}/api/sesi/${soloBatasId}/bot-langkah`, {
      method: 'POST',
      headers: { Cookie: guruCookie },
    });
    assert.strictEqual(botStepRes.status, 200);
    const botStepJson: any = await botStepRes.json();
    assert.strictEqual(botStepJson.feedback.tim, 'putih');

    // Jawab Merah benar berulang kali sampai melewati batasMenang = 25
    let latestState = botStepJson.session;
    let guard = 0;
    while (!latestState.isFinished && guard < 6) {
      guard++;
      const qM = latestState.pemain1.soalAktif;
      const cM = qM.pilihan.find((c: any) => c.teks === kunciPerSoal.get(qM.questionId)!)!;
      const r = await fetch(`${baseUrl}/api/sesi/${soloBatasId}/jawab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
        body: JSON.stringify({
          tim: 'merah',
          presentationId: qM.presentationId,
          choiceId: cM.choiceId,
        }),
      });
      const rj: any = await r.json();
      latestState = rj.session;
      if (rj.isFinished) break;
    }
    assert.strictEqual(latestState.isFinished, true);
    assert.strictEqual(latestState.state, 'FINISHED');
    assert.strictEqual(latestState.taliPosition, 25);
    assert.strictEqual(latestState.hasil.timMenang, 'merah');
    assert.strictEqual(latestState.hasil.alasanSelesai, 'garis_menang');
    console.log('   ✓ Solo Bot AI & batasMenang = 25 menuntaskan game otomatis.');

    // 3. Uji Multiplayer Mode dengan 40 Siswa Real + Acak/Pindah Tim + Dek Independen + Rumus 40/sz(t) + Heatmap
    console.log('3. Menguji Multiplayer Kontinu (40 siswa, acak/pindah tim, dek independen, rumus 40/sz, Heatmap)...');
    const multiCreateRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        templateId: createdTemplateId,
        game: 'tarik_tambang',
        playMode: 'MULTIPLAYER',
        mode: 'multi',
        tarikTambangConfig: {
          sumberSoal: 'bank_soal',
          kesulitan: 'sedang',
          durasiLombaDetik: 180,
          waktuPerSoalDetik: 10,
          kekuatanTimMulti: 40,
          rasioTerpeleset: 0.4,
          bonusAktif: false,
          powerUpAktif: false,
          namaTim1: 'Merah Hebat',
          namaTim2: 'Biru Hebat',
          maxPeserta: 50,
          batasMenang: 100,
        },
      }),
    });
    assert.strictEqual(multiCreateRes.status, 201);
    const multiCreateJson: any = await multiCreateRes.json();
    const multiId: string = multiCreateJson.session.id;
    const multiToken: string = multiCreateJson.session.token;
    createdSessionIds.push(multiId);
    assert.strictEqual(multiToken.length, 6);
    assert.ok(multiCreateJson.session.qrDataUrl.startsWith('data:image/png'));

    const hostSocket = ioClient(baseUrl, {
      transports: ['websocket'],
      extraHeaders: { cookie: guruCookie },
    });
    openSockets.push(hostSocket);
    await new Promise<void>((r) => hostSocket.on('connect', () => r()));
    hostSocket.emit('sesi:host_join', { sessionId: multiId });

    // Gabungkan 40 siswa serentak!
    const totalSiswaUji = 40;
    const siswaSockets: ClientSocket[] = [];
    const siswaData: Array<{
      id: string;
      secret: string;
      nama: string;
      tim: 'merah' | 'putih';
      socket: ClientSocket;
    }> = [];

    for (let i = 0; i < totalSiswaUji; i++) {
      const s = ioClient(baseUrl, { transports: ['websocket'] });
      siswaSockets.push(s);
      openSockets.push(s);
    }
    await Promise.all(
      siswaSockets.map((s) => new Promise<void>((r) => s.on('connect', () => r())))
    );

    const joinResults = await Promise.all(
      siswaSockets.map((s, idx) =>
        emitWithAck<any>(s, 'sesi:gabung', {
          token: multiToken,
          nama: `Siswa_${idx + 1}`,
        })
      )
    );
    for (let i = 0; i < totalSiswaUji; i++) {
      assert.strictEqual(joinResults[i].success, true);
      siswaData.push({
        id: joinResults[i].pesertaId,
        secret: joinResults[i].pesertaSecret,
        nama: `Siswa_${i + 1}`,
        tim: joinResults[i].tim,
        socket: siswaSockets[i],
      });
    }

    assert.strictEqual(siswaData.filter((s) => s.tim === 'merah').length, 20);
    assert.strictEqual(siswaData.filter((s) => s.tim === 'putih').length, 20);

    // Acak ulang & pindah tim di lobi
    const acakRes = await emitWithAck<any>(hostSocket, 'sesi:acak_tim', { sessionId: multiId });
    assert.strictEqual(acakRes.success, true);

    const targetMove = acakRes.daftarPeserta.find((p: any) => p.tim === 'merah')!;
    const pindahRes = await emitWithAck<any>(hostSocket, 'sesi:pindah_tim', {
      sessionId: multiId,
      pesertaId: targetMove.id,
      timTujuan: 'putih',
    });
    assert.strictEqual(pindahRes.success, true);
    assert.strictEqual(
      pindahRes.daftarPeserta.find((p: any) => p.id === targetMove.id)!.tim,
      'putih'
    );

    // Kembalikan 20 vs 20
    await emitWithAck<any>(hostSocket, 'sesi:pindah_tim', {
      sessionId: multiId,
      pesertaId: targetMove.id,
      timTujuan: 'merah',
    });

    const soalPromises = siswaData.map((s) => waitForEvent<any>(s.socket, 'soal:tampil'));
    const gameMulaiProm = waitForEvent<any>(hostSocket, 'game:mulai');
    const startMultiAck = await emitWithAck<any>(hostSocket, 'sesi:mulai', { sessionId: multiId });
    assert.strictEqual(startMultiAck.success, true);
    const [soalDiterima, gameMulaiEvt] = await Promise.all([
      Promise.all(soalPromises),
      gameMulaiProm,
    ]);
    assert.strictEqual(gameMulaiEvt.durasiLombaDetik, 180);
    assert.ok(gameMulaiEvt.matchEndsAt > Date.now());

    // Anti late-join & post-start pindah tim
    const lateSocket = ioClient(baseUrl, { transports: ['websocket'] });
    openSockets.push(lateSocket);
    await new Promise<void>((r) => lateSocket.on('connect', () => r()));
    const lateJoinAck = await emitWithAck<any>(lateSocket, 'sesi:gabung', {
      token: multiToken,
      nama: 'Siswa_Telat',
    });
    assert.strictEqual(lateJoinAck.success, false);

    const postStartMove = await emitWithAck<any>(hostSocket, 'sesi:pindah_tim', {
      sessionId: multiId,
      pesertaId: targetMove.id,
      timTujuan: 'putih',
    });
    assert.strictEqual(postStartMove.success, false);

    const sesiAktif = multiManager.dapatkanSesi(multiId)!;
    const merahIndices: number[] = [];
    const biruIndices: number[] = [];
    siswaData.forEach((sd, idx) => {
      sd.tim = sesiAktif.peserta.get(sd.id)!.tim!;
      if (sd.tim === 'merah') merahIndices.push(idx);
      else biruIndices.push(idx);
    });

    // Pastikan setiap siswa menerima presentationId unik tanpa kebocoran kunci
    const presSet = new Set(soalDiterima.map((q) => q.presentationId));
    assert.strictEqual(presSet.size, 40, 'Setiap siswa mendapat presentasi teracak unik');
    assert.strictEqual(soalDiterima[0].correctChoiceId, undefined);

    // Tolak jawaban memakai presentationId milik siswa lain
    const merahFirst = siswaData[merahIndices[0]];
    const soalBiruFirst = soalDiterima[biruIndices[0]];
    const crossAck = await emitWithAck<any>(merahFirst.socket, 'jawab:kirim', {
      sessionId: multiId,
      pesertaId: merahFirst.id,
      pesertaSecret: merahFirst.secret,
      presentationId: soalBiruFirst.presentationId,
      choiceId: soalBiruFirst.pilihan[0].choiceId,
    });
    assert.strictEqual(crossAck.success, false);

    // Semua 20 Merah jawab BENAR (+2.0 per siswa = +40.0), Semua 20 Biru jawab SALAH (-0.8 oleh Biru = +16.0 untuk Merah) -> Posisi akhir = 56!
    const nextSoalMerah0Prom = waitForEvent<any>(merahFirst.socket, 'soal:tampil');
    const jawabHasilPromises = siswaData.map((sd) => waitForEvent<any>(sd.socket, 'jawab:hasil'));

    await Promise.all(
      siswaData.map(async (sd, idx) => {
        const sObj = soalDiterima[idx];
        const benarTeks = kunciPerSoal.get(sObj.questionId)!;
        const isMerahTeam = sd.tim === 'merah';
        const picked = isMerahTeam
          ? sObj.pilihan.find((c: any) => c.teks === benarTeks)!
          : sObj.pilihan.find((c: any) => c.teks !== benarTeks)!;

        const ack = await emitWithAck<any>(sd.socket, 'jawab:kirim', {
          sessionId: multiId,
          pesertaId: sd.id,
          pesertaSecret: sd.secret,
          presentationId: sObj.presentationId,
          choiceId: picked.choiceId,
        });
        assert.strictEqual(ack.success, true);
      })
    );

    const jawabHasilList = await Promise.all(jawabHasilPromises);
    assert.strictEqual(jawabHasilList[merahIndices[0]].benar, true);
    assert.strictEqual(jawabHasilList[biruIndices[0]].benar, false);
    assert.ok(jawabHasilList[biruIndices[0]].slipQuote);

    // Soal berikutnya otomatis muncul (~900ms) untuk siswa yang sudah menjawab!
    const nextSoalMerah0 = await nextSoalMerah0Prom;
    assert.notStrictEqual(nextSoalMerah0.presentationId, soalDiterima[merahIndices[0]].presentationId);

    // Posisi tali kolektif: 20 * 2.0 + 20 * 0.8 = +56.0
    assert.strictEqual(sesiAktif.taliPosition, 56);
    assert.strictEqual(sesiAktif.skorMerah, 20);
    assert.strictEqual(sesiAktif.skorPutih, 0);

    // Uji Reconnect memulihkan tim & progress siswa
    const reconnecting = siswaData[merahIndices[1]];
    reconnecting.socket.disconnect();
    const freshSock = ioClient(baseUrl, { transports: ['websocket'] });
    openSockets.push(freshSock);
    await new Promise<void>((r) => freshSock.on('connect', () => r()));
    const reconnAck = await emitWithAck<any>(freshSock, 'sesi:gabung', {
      token: multiToken,
      nama: reconnecting.nama,
      pesertaId: reconnecting.id,
      pesertaSecret: reconnecting.secret,
    });
    assert.strictEqual(reconnAck.success, true);
    assert.strictEqual(reconnAck.isReconnect, true);
    assert.strictEqual(reconnAck.tim, 'merah');
    assert.strictEqual(reconnAck.pesertaStat.totalBenar, 1);

    // Akhiri sesi Multi manual -> cek analisisHeatmap & DB persistence
    const sesiSelesaiPromise = waitForEvent<any>(hostSocket, 'sesi:selesai', 25000);
    const akhiriMultiAck = await emitWithAck<any>(
      hostSocket,
      'sesi:akhiri_manual',
      { sessionId: multiId },
      25000
    );
    assert.strictEqual(akhiriMultiAck.success, true, akhiriMultiAck.pesan || 'akhiri_manual gagal');
    const selesaiMultiEvt = await sesiSelesaiPromise;
    assert.strictEqual(selesaiMultiEvt.hasil.timMenang, 'merah');
    assert.strictEqual(selesaiMultiEvt.hasil.laporanSiswa.length, 40);
    assert.ok(selesaiMultiEvt.hasil.analisisHeatmap?.questions.length >= 2);
    assert.strictEqual(selesaiMultiEvt.hasil.analisisHeatmap.teams.length, 2);

    const hasilMultiRest = await fetch(`${baseUrl}/api/sesi/${multiId}/hasil`, {
      headers: { Cookie: guruCookie },
    });
    const hasilMultiRestJson: any = await hasilMultiRest.json();
    assert.strictEqual(hasilMultiRestJson.hasil.akurasiTim1, 100);
    assert.strictEqual(hasilMultiRestJson.hasil.akurasiTim2, 0);
    assert.strictEqual(hasilMultiRestJson.hasil.laporanSiswa.length, 40);

    const dbPlayersMulti = await prisma.sessionPlayer.findMany({ where: { sessionId: multiId } });
    assert.strictEqual(dbPlayersMulti.length, 40, 'Semua 40 siswa wajib tersimpan di SessionPlayer');
    console.log('   ✓ 40 siswa Multiplayer, 40/sz(t), dek independen, Heatmap, reconnect & DB lulus!');

    // 4. Uji Multiplayer dengan batasMenang = 25 & kekuatanTimMulti = 40 -> 1 jawaban benar langsung selesai otomatis!
    console.log('4. Menguji Multiplayer batasan menang kustom (batasMenang = 25)...');
    const multiBatasRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        templateId: createdTemplateId,
        game: 'tarik_tambang',
        playMode: 'MULTIPLAYER',
        mode: 'multi',
        tarikTambangConfig: {
          kesulitan: 'sedang',
          kekuatanTimMulti: 40,
          bonusAktif: false,
          powerUpAktif: false,
          batasMenang: 25,
        },
      }),
    });
    assert.strictEqual(multiBatasRes.status, 201);
    const multiBatasJson: any = await multiBatasRes.json();
    const multiBatasId: string = multiBatasJson.session.id;
    const multiBatasToken: string = multiBatasJson.session.token;
    createdSessionIds.push(multiBatasId);

    const mHostSock = ioClient(baseUrl, {
      transports: ['websocket'],
      extraHeaders: { cookie: guruCookie },
    });
    const mP1Sock = ioClient(baseUrl, { transports: ['websocket'] });
    const mP2Sock = ioClient(baseUrl, { transports: ['websocket'] });
    openSockets.push(mHostSock, mP1Sock, mP2Sock);
    await Promise.all([
      new Promise<void>((r) => mHostSock.on('connect', () => r())),
      new Promise<void>((r) => mP1Sock.on('connect', () => r())),
      new Promise<void>((r) => mP2Sock.on('connect', () => r())),
    ]);
    mHostSock.emit('sesi:host_join', { sessionId: multiBatasId });

    const j1Ack = await emitWithAck<any>(mP1Sock, 'sesi:gabung', { token: multiBatasToken, nama: 'BatasA' });
    const j2Ack = await emitWithAck<any>(mP2Sock, 'sesi:gabung', { token: multiBatasToken, nama: 'BatasB' });

    const p1SoalProm = waitForEvent<any>(mP1Sock, 'soal:tampil');
    const p2SoalProm = waitForEvent<any>(mP2Sock, 'soal:tampil');
    const mSelesaiProm = waitForEvent<any>(mHostSock, 'sesi:selesai', 25000);
    await emitWithAck<any>(mHostSock, 'sesi:mulai', { sessionId: multiBatasId });
    const [mSoal1, mSoal2] = await Promise.all([p1SoalProm, p2SoalProm]);

    const mSesiLive = multiManager.dapatkanSesi(multiBatasId)!;
    const merahSocket = mSesiLive.peserta.get(j1Ack.pesertaId)!.tim === 'merah' ? mP1Sock : mP2Sock;
    const merahAck = merahSocket === mP1Sock ? j1Ack : j2Ack;
    const merahSoal = merahSocket === mP1Sock ? mSoal1 : mSoal2;
    const pickMerah = merahSoal.pilihan.find(
      (c: any) => c.teks === kunciPerSoal.get(merahSoal.questionId)!
    )!;

    await emitWithAck<any>(merahSocket, 'jawab:kirim', {
      sessionId: multiBatasId,
      pesertaId: merahAck.pesertaId,
      pesertaSecret: merahAck.pesertaSecret,
      presentationId: merahSoal.presentationId,
      choiceId: pickMerah.choiceId,
    });

    const mAutoSelesai = await mSelesaiProm;
    assert.strictEqual(mAutoSelesai.hasil.timMenang, 'merah');
    assert.strictEqual(mAutoSelesai.hasil.posisiAkhir, 25);
    assert.strictEqual(mAutoSelesai.hasil.alasanSelesai, 'garis_menang');
    console.log('   ✓ Multiplayer batasMenang = 25 langsung menuntaskan pertandingan otomatis!');
  } finally {
    for (const s of openSockets) {
      if (s.connected) s.disconnect();
    }
    for (const sid of createdSessionIds) {
      soloManager.hapusSesi(sid);
      multiManager.hapusSesi(sid);
      await prisma.session.delete({ where: { id: sid } }).catch(() => {});
    }
    if (createdTemplateId) {
      await prisma.template.delete({ where: { id: createdTemplateId } }).catch(() => {});
    }
    await new Promise<void>((resolve) => io.close(() => resolve()));
    server.close();
  }
}

async function main() {
  try {
    jalankanUnitTests();
    await jalankanIntegrationTests();
    console.log('\n=============================================================');
    console.log('🏆 SEMUA UJI TARIK TAMBANG KONTINU DUAL MODE LULUS 100%!');
    console.log('=============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ PENGUJIAN TARIK TAMBANG DUAL MODE GAGAL:', err);
    process.exit(1);
  }
}

main();
