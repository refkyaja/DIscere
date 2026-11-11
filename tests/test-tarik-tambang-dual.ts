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
  MAKS_GERAK_PER_RONDE,
  konfigurasiTarikTambangSchema,
  bangunKonfigurasiTarikTambang,
  filterBankSoalSetara,
  ambilPasanganSoalSetara,
  perbaruiStreakIndividu,
  hitungBonusKekompakan,
  evaluasiRondeTarikTambang,
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
    teks: 'Hanya ada 1 soal sulit — seharusnya ditolak untuk kesulitan sulit',
    opsiA: 'Satu',
    opsiB: 'Dua',
    opsiC: 'Tiga',
    jawabanBenar: 'A',
    penjelasan: 'Uji filter kesulitan.',
    kesulitan: 'sulit',
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
  console.log('\n▶ BAGIAN A: UNIT TEST CORE TARIK TAMBANG (-100..+100), SOLO & MULTI');

  // 1. Konfigurasi & Filter Kesulitan Setara
  console.log('1. Menguji konfigurasi & filter bank soal kesulitan setara...');
  const conf = bangunKonfigurasiTarikTambang({
    kesulitan: 'sedang',
    durasiRonde: 20,
    bonusAktif: true,
    powerUpAktif: true,
    namaTim1: 'Merah Juara',
    namaTim2: 'Biru Tangguh',
    maxPeserta: 50,
  });
  assert.strictEqual(conf.durasiRonde, 20);
  assert.throws(() => konfigurasiTarikTambangSchema.parse({ durasiRonde: 99 }));
  assert.throws(() => filterBankSoalSetara(MOCK_QUESTIONS_MIXED, 'sulit'));
  const poolSedang = filterBankSoalSetara(MOCK_QUESTIONS_MIXED, 'sedang');
  assert.strictEqual(poolSedang.length, 4);

  // Pasangan soal setara harus berbeda dan berkesulitan sama
  const pair1 = ambilPasanganSoalSetara(poolSedang, [], undefined, undefined, false);
  assert.notStrictEqual(pair1.soalTim1.id, pair1.soalTim2.id);
  assert.strictEqual(pair1.soalTim1.kesulitan, 'sedang');
  assert.strictEqual(pair1.soalTim2.kesulitan, 'sedang');
  console.log('   ✓ Konfigurasi, validasi durasi, & pairing soal setara berbeda tervalidasi.');

  // 2. Rumus Kekuatan, Streak, Kekompakan, Power-Up & Clamp [-25..+25] / [-100..+100]
  console.log('2. Menguji formula pergerakan tali, streak (3=+5, 5=+10), kekompakan (80=+5, 100=+10), power-up, & batas...');
  assert.strictEqual(hitungBonusKekompakan(79, 100, true), 0);
  assert.strictEqual(hitungBonusKekompakan(80, 100, true), 5);
  assert.strictEqual(hitungBonusKekompakan(99, 100, true), 5);
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
  assert.strictEqual(resReset.streakBaru, 0, 'Jawaban salah wajib mereset streak ke 0');

  // Solo evaluasi + powerup tarikan_super (+10) -> 15 + 10 + 10 = 35 -> dibatasi cap 25
  const evalMaxCap = evaluasiRondeTarikTambang({
    mode: 'SOLO',
    posisiLama: POSISI_AWAL_TALI,
    tim1Benar: 1,
    tim1TotalAnggota: 1,
    tim2Benar: 0,
    tim2TotalAnggota: 1,
    bonusStreakTim1: 10,
    bonusStreakTim2: 0,
    bonusAktif: true,
    powerUpTim1Aktif: 'tarikan_super',
    powerUpTim2Aktif: null,
  });
  assert.strictEqual(evalMaxCap.perubahanTali, MAKS_GERAK_PER_RONDE, 'Delta harus dibatasi maksimal +25');
  assert.strictEqual(evalMaxCap.posisiBaru, 25);

  // Power-Up Pertahanan Kuat mengurangi tarikan lawan sebesar 5 poin
  const evalPertahanan = evaluasiRondeTarikTambang({
    mode: 'SOLO',
    posisiLama: 0,
    tim1Benar: 1,
    tim1TotalAnggota: 1,
    tim2Benar: 0,
    tim2TotalAnggota: 1,
    bonusStreakTim1: 0,
    bonusStreakTim2: 0,
    bonusAktif: true,
    powerUpTim1Aktif: null,
    powerUpTim2Aktif: 'pertahanan_kuat',
  });
  assert.strictEqual(evalPertahanan.perubahanTali, 10, 'Pertahanan kuat Tim 2 harus mengurangi tarikan +15 menjadi +10');

  // Clamp akhir [-100 .. +100] & penentuan pemenang
  const evalWinMerah = evaluasiRondeTarikTambang({
    mode: 'SOLO',
    posisiLama: 90,
    tim1Benar: 1,
    tim1TotalAnggota: 1,
    tim2Benar: 0,
    tim2TotalAnggota: 1,
    bonusStreakTim1: 0,
    bonusStreakTim2: 0,
    bonusAktif: false,
    powerUpTim1Aktif: null,
    powerUpTim2Aktif: null,
  });
  assert.strictEqual(evalWinMerah.posisiBaru, BATAS_MAX_TALI);
  assert.strictEqual(tentukanPemenang(BATAS_MAX_TALI), 'merah');
  assert.strictEqual(tentukanPemenang(BATAS_MIN_TALI), 'putih');
  assert.strictEqual(tentukanPemenang(0), 'seri');

  // Non-stacking Power-Up bank
  assert.strictEqual(
    tentukanHadiahPowerUp({
      powerUpAktif: true,
      bankSaatIni: 'semangat_tim',
      streakBaru: 5,
      akurasiRondePersen: 100,
    }),
    'semangat_tim',
    'Power-up bank tidak boleh menumpuk saat sudah ada 1'
  );
  console.log('   ✓ Seluruh rumus penarikan tali, bonus, power-up, & batas [-100..+100] akurat.');

  // 3. Uji Timer-out & Jeda di SoloManager
  console.log('3. Menguji mekanisme kunci sisi, jeda, dan tutup ronde di soloManager...');
  const sid = 'unit-solo-tt-' + Date.now();
  const s = soloManager.inisialisasiSesi(
    sid,
    'host-u1',
    { id: 't-u1', judul: 'Uji Unit Solo' },
    poolSedang,
    { kesulitan: 'sedang', durasiRonde: 15, bonusAktif: true, powerUpAktif: true }
  );
  // READY -> PAUSED wajib ditolak
  assert.throws(() => soloManager.ubahStateSesi(sid, 'host-u1', 'PAUSED'));

  soloManager.mulaiSesi(sid, 'host-u1');
  const ronde1 = s.rondeAktif!;
  assert.notStrictEqual(ronde1.soalTim1.questionId, ronde1.soalTim2.questionId);

  // Jeda & lanjut tidak menghilangkan ronde serta mempertahankan batas waktu wajar
  soloManager.ubahStateSesi(sid, 'host-u1', 'PAUSED');
  assert.strictEqual(s.state, 'PAUSED');
  assert.throws(() => soloManager.tutupRonde(sid, 'host-u1'));
  assert.throws(() =>
    soloManager.prosesJawaban(sid, 'host-u1', {
      tim: 'merah',
      presentationId: ronde1.soalTim1.presentationId,
      choiceId: ronde1.soalTim1.correctChoiceId,
    })
  );
  soloManager.ubahStateSesi(sid, 'host-u1', 'PLAYING');

  // Tim 1 menjawab benar; skorMerah tidak boleh bocor sebelum ronde ditutup!
  const jR1 = soloManager.prosesJawaban(sid, 'host-u1', {
    tim: 'merah',
    presentationId: ronde1.soalTim1.presentationId,
    choiceId: ronde1.soalTim1.correctChoiceId,
  });
  assert.strictEqual(jR1.rondeSelesai, false);
  assert.strictEqual(jR1.sesi.skorMerah, 0, 'Skor merah tidak boleh bocor sebelum ronde selesai');
  assert.throws(() =>
    soloManager.prosesJawaban(sid, 'host-u1', {
      tim: 'merah',
      presentationId: ronde1.soalTim1.presentationId,
      choiceId: ronde1.soalTim1.correctChoiceId,
    })
  );
  assert.throws(() =>
    soloManager.prosesJawaban(sid, 'host-u1', {
      tim: 'putih',
      presentationId: ronde1.soalTim1.presentationId,
      choiceId: ronde1.soalTim1.correctChoiceId,
    })
  );

  const closed = soloManager.tutupRonde(sid, 'host-u1');
  assert.strictEqual(closed.hasilRonde.perubahanTali, 15);
  assert.strictEqual(closed.sesi.taliPosition, 15);
  assert.strictEqual(closed.sesi.skorMerah, 1);
  assert.strictEqual(closed.sesi.tim2.streakSaatIni, 0);

  // Power-Up aktivasi diaktifkan untuk ronde berikutnya & tidak boleh bertumpuk
  closed.sesi.tim1.powerUpTersedia = 'tarikan_super';
  soloManager.aktifkanPowerUp(sid, 'host-u1', 'merah');
  assert.strictEqual(closed.sesi.tim1.powerUpAktifRondeBerikutnya, 'tarikan_super');
  closed.sesi.tim1.powerUpTersedia = 'semangat_tim';
  assert.throws(() => soloManager.aktifkanPowerUp(sid, 'host-u1', 'merah'));
  soloManager.lanjutRondeBerikutnya(sid, 'host-u1');
  assert.strictEqual(s.rondeAktif?.powerUpTim1Dipakai, 'tarikan_super');

  // Akhiri manual saat ronde 2 berjalan -> hasil konsisten & idempoten
  soloManager.prosesJawaban(sid, 'host-u1', {
    tim: 'merah',
    presentationId: s.rondeAktif!.soalTim1.presentationId,
    choiceId: s.rondeAktif!.soalTim1.correctChoiceId,
  });
  const ended1 = soloManager.selesaikanSesi(sid, 'host-u1');
  const waktuSelesaiPertama = ended1.waktuSelesaiMs;
  const ended2 = soloManager.selesaikanSesi(sid, 'host-u1');
  assert.strictEqual(ended1.skorMerah, ended1.tim1.totalBenar);
  assert.strictEqual(ended2.waktuSelesaiMs, waktuSelesaiPertama);

  soloManager.hapusSesi(sid);
  console.log('   ✓ State lock, pause/resume, anti-bocor skor, power-up, & konsistensi selesaikanSesi tervalidasi.');
}

async function jalankanIntegrationTests() {
  console.log('\n▶ BAGIAN B: E2E INTEGRATION TEST (SOLO 1v1 + MULTIPLAYER 40 SISWA + ISOLASI)');

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
    console.log('1. Login guru & membuat paket soal setara untuk Tarik Tambang...');
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

    // Peta kunci dari DB berdasarkan questionId + teks opsi benar
    const kunciPerSoal = new Map<string, string>();
    for (const q of tmplJson.template.questions) {
      kunciPerSoal.set(
        q.id,
        q.jawabanBenar === 'A' ? q.opsiA : q.jawabanBenar === 'B' ? q.opsiB : q.opsiC
      );
    }

    // 2. Uji Solo Mode — Local 1 vs 1 (autoStart: true, tanpa PIN/QR/lobi)
    console.log('2. Menguji E2E Solo Mode (Local 1 vs 1) tanpa PIN/QR/lobi...');
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
          durasiRonde: 20,
          bonusAktif: true,
          powerUpAktif: true,
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
    assert.ok(soloCreateJson.session.rondeSaatIni?.soalTim1);
    assert.ok(soloCreateJson.session.rondeSaatIni?.soalTim2);
    assert.notStrictEqual(
      soloCreateJson.session.rondeSaatIni.soalTim1.questionId,
      soloCreateJson.session.rondeSaatIni.soalTim2.questionId
    );
    // Pastikan kunci jawaban tidak dikirim dalam payload soal client
    assert.strictEqual(soloCreateJson.session.rondeSaatIni.soalTim1.correctChoiceId, undefined);
    assert.strictEqual(soloCreateJson.session.rondeSaatIni.hasilRonde, null);

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

    // Tim 1 menjawab benar, pastikan belum mengungkap hasilRonde sebelum Tim 2 menjawab
    const r1 = soloCreateJson.session.rondeSaatIni;
    const benarTeks1 = kunciPerSoal.get(r1.soalTim1.questionId)!;
    const choiceBenar1 = r1.soalTim1.pilihan.find((c: any) => c.teks === benarTeks1)!;

    const jawabSolo1Res = await fetch(`${baseUrl}/api/sesi/${soloId}/jawab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        tim: 'merah',
        presentationId: r1.soalTim1.presentationId,
        choiceId: choiceBenar1.choiceId,
      }),
    });
    assert.strictEqual(jawabSolo1Res.status, 200);
    const jSolo1: any = await jawabSolo1Res.json();
    assert.strictEqual(jSolo1.rondeSelesai, false);
    assert.strictEqual(jSolo1.hasilRonde, null, 'Kunci tidak boleh bocor saat baru 1 sisi menjawab');

    // Tim 2 menjawab salah -> ronde otomatis tertutup dan tali bergeser +15
    const benarTeks2 = kunciPerSoal.get(r1.soalTim2.questionId)!;
    const choiceSalah2 = r1.soalTim2.pilihan.find((c: any) => c.teks !== benarTeks2)!;
    const jawabSolo2Res = await fetch(`${baseUrl}/api/sesi/${soloId}/jawab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        tim: 'putih',
        presentationId: r1.soalTim2.presentationId,
        choiceId: choiceSalah2.choiceId,
      }),
    });
    const jSolo2: any = await jawabSolo2Res.json();
    assert.strictEqual(jSolo2.rondeSelesai, true);
    assert.strictEqual(jSolo2.taliPosition, 15);
    assert.ok(jSolo2.hasilRonde?.tim1Kunci);

    // Lanjut ke ronde 2 & selesaikan manual untuk uji laporan + DB persistence
    const lanjutRes = await fetch(`${baseUrl}/api/sesi/${soloId}/lanjut-ronde`, {
      method: 'POST',
      headers: { Cookie: guruCookie },
    });
    assert.strictEqual(lanjutRes.status, 200);
    const lanjutJson: any = await lanjutRes.json();
    assert.strictEqual(lanjutJson.session.nomorRonde, 2);

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
    assert.strictEqual(hasilSoloJson.hasil.posisiAkhir, 15);
    assert.strictEqual(hasilSoloJson.hasil.statistikPemain.length, 2);

    const dbPlayersSolo = await prisma.sessionPlayer.findMany({ where: { sessionId: soloId } });
    assert.strictEqual(dbPlayersSolo.length, 2, '2 siswa lokal Solo wajib tersimpan ke DB');
    console.log('   ✓ Solo Mode 1v1, penguncian sisi, anti-bocor kunci, lanjut ronde & DB tervalidasi.');

    // 3. Uji Multiplayer Mode dengan 40 Siswa Real + Acak/Pindah Tim + Anti Late Join + Rumus Kolektif
    console.log('3. Menguji Multiplayer Mode (40 siswa real, acak/pindah tim lobi, lock post-start, isolasi soal)...');
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
          durasiRonde: 15,
          bonusAktif: true,
          powerUpAktif: true,
          namaTim1: 'Merah Hebat',
          namaTim2: 'Biru Hebat',
          maxPeserta: 50,
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

    // Tolak endpoint Solo REST untuk sesi Multiplayer
    const badSoloCall = await fetch(`${baseUrl}/api/sesi/${multiId}/mulai`, {
      method: 'POST',
      headers: { Cookie: guruCookie },
    });
    assert.strictEqual(badSoloCall.status, 400);

    // Hubungkan Host
    const hostSocket = ioClient(baseUrl, { transports: ['websocket'] });
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

    const merahCountLobi = siswaData.filter((s) => s.tim === 'merah').length;
    const biruCountLobi = siswaData.filter((s) => s.tim === 'putih').length;
    assert.strictEqual(merahCountLobi, 20);
    assert.strictEqual(biruCountLobi, 20);

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
    const afterMove = pindahRes.daftarPeserta.find((p: any) => p.id === targetMove.id)!;
    assert.strictEqual(afterMove.tim, 'putih');

    // Kembalikan agar 20 vs 20 seimbang lagi
    await emitWithAck<any>(hostSocket, 'sesi:pindah_tim', {
      sessionId: multiId,
      pesertaId: targetMove.id,
      timTujuan: 'merah',
    });

    // Pasang listener soal:tampil pada tiap siswa sebelum mulai
    const soalPromises = siswaData.map((s) => waitForEvent<any>(s.socket, 'soal:tampil'));
    const startMultiAck = await emitWithAck<any>(hostSocket, 'sesi:mulai', { sessionId: multiId });
    assert.strictEqual(startMultiAck.success, true);
    const soalDiterima = await Promise.all(soalPromises);

    // Verifikasi: Tidak bisa pindah tim, acak tim, atau gabung terlambat setelah game dimulai!
    const lateSocket = ioClient(baseUrl, { transports: ['websocket'] });
    openSockets.push(lateSocket);
    await new Promise<void>((r) => lateSocket.on('connect', () => r()));
    const lateJoinAck = await emitWithAck<any>(lateSocket, 'sesi:gabung', {
      token: multiToken,
      nama: 'Siswa_Telat',
    });
    assert.strictEqual(lateJoinAck.success, false, 'Siswa terlambat wajib ditolak setelah start');

    const postStartMove = await emitWithAck<any>(hostSocket, 'sesi:pindah_tim', {
      sessionId: multiId,
      pesertaId: targetMove.id,
      timTujuan: 'putih',
    });
    assert.strictEqual(postStartMove.success, false, 'Pindah tim wajib ditolak setelah start');

    // Ambil daftar anggota final sesudah mulai
    const sesiAktif = multiManager.dapatkanSesi(multiId)!;
    const merahIndices: number[] = [];
    const biruIndices: number[] = [];
    siswaData.forEach((sd, idx) => {
      const pLive = sesiAktif.peserta.get(sd.id)!;
      sd.tim = pLive.tim!;
      if (sd.tim === 'merah') merahIndices.push(idx);
      else biruIndices.push(idx);
    });

    const qIdMerah = soalDiterima[merahIndices[0]].questionId;
    const qIdBiru = soalDiterima[biruIndices[0]].questionId;
    assert.notStrictEqual(qIdMerah, qIdBiru, 'Soal Tim Merah dan Tim Biru wajib berbeda!');
    for (const i of merahIndices) {
      assert.strictEqual(soalDiterima[i].questionId, qIdMerah, 'Semua anggota Tim Merah harus mendapat soal timnya');
      assert.strictEqual(soalDiterima[i].correctChoiceId, undefined, 'Kunci tidak boleh ada di event soal:tampil');
    }
    for (const i of biruIndices) {
      assert.strictEqual(soalDiterima[i].questionId, qIdBiru, 'Semua anggota Tim Biru harus mendapat soal timnya');
    }

    // Tolak jawaban lintas tim
    const merahFirst = siswaData[merahIndices[0]];
    const soalMilikBiru = soalDiterima[biruIndices[0]];
    const crossTeamAck = await emitWithAck<any>(merahFirst.socket, 'jawab:kirim', {
      sessionId: multiId,
      pesertaId: merahFirst.id,
      pesertaSecret: merahFirst.secret,
      presentationId: soalMilikBiru.presentationId,
      choiceId: soalMilikBiru.pilihan[0].choiceId,
    });
    assert.strictEqual(crossTeamAck.success, false, 'Wajib menolak jawaban soal milik tim lawan');

    // Semua 20 anggota Tim Merah menjawab BENAR (100% -> akurasi 100%, kekompakan +10!),
    // Semua 20 anggota Tim Biru menjawab SALAH (0%!) -> Net +25 (cap)!
    const selesaiRondePromise = waitForEvent<any>(hostSocket, 'soal:selesai');
    const benarTeksMerah = kunciPerSoal.get(qIdMerah)!;
    const benarTeksBiru = kunciPerSoal.get(qIdBiru)!;

    await Promise.all(
      siswaData.map(async (sd, idx) => {
        const sObj = soalDiterima[idx];
        const isMerahTeam = sd.tim === 'merah';
        const benarTeks = isMerahTeam ? benarTeksMerah : benarTeksBiru;
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
        assert.strictEqual(ack.terkunci, true);
        assert.strictEqual(ack.benar, undefined, 'Tidak boleh membocorkan benar/salah sebelum ronde selesai!');
        assert.strictEqual(ack.jawabanBenar, undefined);
      })
    );

    // Duplikasi jawaban harus ditolak
    const dupAck = await emitWithAck<any>(merahFirst.socket, 'jawab:kirim', {
      sessionId: multiId,
      pesertaId: merahFirst.id,
      pesertaSecret: merahFirst.secret,
      presentationId: soalDiterima[merahIndices[0]].presentationId,
      choiceId: soalDiterima[merahIndices[0]].pilihan[0].choiceId,
    });
    assert.strictEqual(dupAck.success, false, 'Duplikasi jawaban dalam 1 ronde wajib ditolak');

    const hasilRonde1 = await selesaiRondePromise;
    assert.strictEqual(hasilRonde1.hasilRonde.akurasiTim1, 100);
    assert.strictEqual(hasilRonde1.hasilRonde.akurasiTim2, 0);
    assert.strictEqual(hasilRonde1.hasilRonde.bonusKekompakanTim1, 10);
    assert.strictEqual(hasilRonde1.hasilRonde.perubahanTali, 25);
    assert.strictEqual(hasilRonde1.taliPosition, 25);
    // Power-up bank dihadiahkan ke Tim Merah karena akurasi 100%
    assert.ok(hasilRonde1.powerUpTim1.bank, 'Tim Merah berhak mendapat Power-Up saat akurasi >=80%');

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

    // Akhiri sesi Multi manual -> simpan ke DB & cek laporan lengkap
    const sesiSelesaiPromise = waitForEvent<any>(hostSocket, 'sesi:selesai');
    const akhiriMultiAck = await emitWithAck<any>(hostSocket, 'sesi:akhiri_manual', {
      sessionId: multiId,
    });
    assert.strictEqual(akhiriMultiAck.success, true);
    const selesaiMultiEvt = await sesiSelesaiPromise;
    assert.strictEqual(selesaiMultiEvt.hasil.timMenang, 'merah');
    assert.strictEqual(selesaiMultiEvt.hasil.statistikPemain.length, 40);

    const hasilMultiRest = await fetch(`${baseUrl}/api/sesi/${multiId}/hasil`, {
      headers: { Cookie: guruCookie },
    });
    const hasilMultiRestJson: any = await hasilMultiRest.json();
    assert.strictEqual(hasilMultiRestJson.hasil.akurasiTim1, 100);
    assert.strictEqual(hasilMultiRestJson.hasil.akurasiTim2, 0);
    assert.strictEqual(hasilMultiRestJson.hasil.statistikPemain.length, 40);

    const dbPlayersMulti = await prisma.sessionPlayer.findMany({ where: { sessionId: multiId } });
    assert.strictEqual(dbPlayersMulti.length, 40, 'Semua 40 siswa wajib tersimpan di SessionPlayer');
    console.log('   ✓ 40 siswa Multiplayer, acak/pindah tim, isolasi soal, rumus akurasi+kekompakan, reconnect & DB lulus 100%!');
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
    console.log('🏆 SEMUA UJI TARIK TAMBANG DUAL MODE LULUS 100% TANPA ERROR!');
    console.log('=============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ PENGUJIAN TARIK TAMBANG DUAL MODE GAGAL:', err);
    process.exit(1);
  }
}

main();

