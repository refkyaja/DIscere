import assert from 'assert';
import http from 'http';
import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { prisma } from '../server/src/db.js';
import { authRouter } from '../server/src/routes/auth.js';
import { templateRouter } from '../server/src/routes/template.js';
import { sesiRouter } from '../server/src/routes/sesi.js';
import { errorHandler } from '../server/src/middleware/error.js';
import { SoalPanjat, RngRintangan } from '../server/src/games/panjatPinang.js';
import {
  panjatPinangSoloManager,
  RngBotPanjat,
} from '../server/src/games/panjatPinangSoloManager.js';

const SAMPLE_SOAL: SoalPanjat[] = [
  {
    id: 'ps-q1',
    urutan: 1,
    teks: 'Hasil dari 8 x 7 adalah?',
    opsiA: '54',
    opsiB: '56',
    opsiC: '58',
    opsiD: '64',
    jawabanBenar: 'B',
    penjelasan: '8 dikali 7 sama dengan 56.',
  },
  {
    id: 'ps-q2',
    urutan: 2,
    teks: 'Planet terdekat dengan Matahari adalah?',
    opsiA: 'Venus',
    opsiB: 'Bumi',
    opsiC: 'Merkurius',
    opsiD: 'Mars',
    jawabanBenar: 'C',
    penjelasan: 'Merkurius adalah planet pertama dari Matahari.',
  },
  {
    id: 'ps-q3',
    urutan: 3,
    teks: 'Proklamasi Kemerdekaan RI dibacakan pada tanggal?',
    opsiA: '17 Agustus 1945',
    opsiB: '18 Agustus 1945',
    opsiC: '10 November 1945',
    opsiD: '1 Juni 1945',
    jawabanBenar: 'A',
    penjelasan: '17 Agustus 1945.',
  },
];

const noObstacleRng: RngRintangan = {
  peluangPercent: () => 99,
  pilihIndex: () => 0,
};

async function runUnitTests() {
  console.log('1. Unit Tests: Panjat Pinang Solo Engine & Manager...');

  // 1a. Initialization READY vs autoStart, Bot vs Duel Lokal defaults
  const sBotId = `unit-bot-${crypto.randomUUID()}`;
  const sBot = panjatPinangSoloManager.inisialisasiSesi(
    sBotId,
    'host-unit',
    { id: 'tmpl-1', judul: 'Kuis Uji Bot' },
    SAMPLE_SOAL,
    { kesulitan: 'normal', waktuPerSoalDetik: 15, tipeLawanSolo: 'bot', rintanganAktif: true },
    false,
    1000
  );
  assert.strictEqual(sBot.state, 'READY');
  assert.strictEqual(sBot.isBotLawan, true);
  assert.strictEqual(sBot.pemain1.nama, 'Pemain 1');
  assert.strictEqual(sBot.pemain2.nama, 'Lawan Bot');
  assert.strictEqual(sBot.config.maxPeserta, 2);
  assert.strictEqual(sBot.config.allowLateJoin, false);
  assert.strictEqual(sBot.pemain1.presentasiAktif, null);

  // Manual start transitions READY -> PLAYING & prepares active questions
  panjatPinangSoloManager.mulaiSesi(sBotId, 'host-unit', 2000, {
    akurasiRoll: () => 0.1,
    delayRoll: () => 0.5,
    pilihanSalahIndex: () => 0,
  });
  assert.strictEqual(sBot.state, 'PLAYING');
  assert.ok(sBot.pemain1.presentasiAktif);
  assert.ok(sBot.pemain2.presentasiAktif);
  assert.ok(sBot.botNextActionAtMs && sBot.botNextActionAtMs > 2000);

  // Reject manual jawab for pemain2 in Bot mode
  assert.throws(() => {
    panjatPinangSoloManager.prosesJawaban(sBotId, 'host-unit', {
      slot: 'pemain2',
      presentationId: sBot.pemain2.presentasiAktif!.presentationId,
      choiceId: sBot.pemain2.presentasiAktif!.pilihan[0].choiceId,
    });
  }, /otomatis oleh sistem/);

  // Pemain 1 correct answer climbs +10%
  const q1P1 = sBot.pemain1.presentasiAktif!;
  const benarChoice = q1P1.pilihan.find((o) => o.key === q1P1.kunciKey)!;
  const r1 = panjatPinangSoloManager.prosesJawaban(sBotId, 'host-unit', {
    slot: 'pemain1',
    presentationId: q1P1.presentationId,
    choiceId: benarChoice.choiceId,
    nowMs: 3500,
    rngRintangan: noObstacleRng,
  });
  assert.strictEqual(r1.feedback.benar, true);
  assert.strictEqual(r1.feedback.posisiBaru, 10);
  assert.strictEqual(sBot.pemain1.posisi, 10);
  assert.ok(sBot.pemain1.presentasiAktif);
  assert.notStrictEqual(sBot.pemain1.presentasiAktif!.presentationId, q1P1.presentationId);

  // Reject duplicate submission on old presentationId
  assert.throws(() => {
    panjatPinangSoloManager.prosesJawaban(sBotId, 'host-unit', {
      slot: 'pemain1',
      presentationId: q1P1.presentationId,
      choiceId: benarChoice.choiceId,
    });
  }, /kedaluwarsa|sudah diproses|ganda/);

  // Timeout drops -5%
  const q2P1 = sBot.pemain1.presentasiAktif!;
  const rTimeout = panjatPinangSoloManager.prosesJawaban(sBotId, 'host-unit', {
    slot: 'pemain1',
    presentationId: q2P1.presentationId,
    timedOut: true,
    nowMs: 18500,
    rngRintangan: noObstacleRng,
  });
  assert.strictEqual(rTimeout.feedback.benar, false);
  assert.strictEqual(rTimeout.feedback.timedOut, true);
  assert.strictEqual(sBot.pemain1.posisi, 5);
  assert.strictEqual(sBot.pemain1.streakSaatIni, 0);

  // Pause & Resume shifts timestamps cleanly
  panjatPinangSoloManager.ubahStateSesi(sBotId, 'host-unit', 'pause', 20000);
  assert.strictEqual(sBot.state, 'PAUSED');
  assert.throws(() => {
    panjatPinangSoloManager.prosesJawaban(sBotId, 'host-unit', {
      slot: 'pemain1',
      presentationId: sBot.pemain1.presentasiAktif!.presentationId,
      timedOut: true,
    });
  }, /dijeda/);

  const beforePauseShown = sBot.pemain1.presentasiAktif!.ditampilkanPadaMs;
  panjatPinangSoloManager.ubahStateSesi(sBotId, 'host-unit', 'resume', 25000);
  assert.strictEqual(sBot.state, 'PLAYING');
  assert.strictEqual(sBot.totalPausedMs, 5000);
  assert.strictEqual(sBot.pemain1.presentasiAktif!.ditampilkanPadaMs, beforePauseShown + 5000);

  // Bot wait vs step execution
  const earlyBot = panjatPinangSoloManager.jalankanLangkahBot(sBotId, 'host-unit', {
    nowMs: 21000,
  });
  assert.strictEqual(earlyBot.acted, false);

  const dueNow = (sBot.botNextActionAtMs || 30000) + 10;
  const rngBotCorrect: RngBotPanjat = {
    akurasiRoll: () => 0.05,
    delayRoll: () => 0.2,
    pilihanSalahIndex: () => 0,
  };
  const stepBot = panjatPinangSoloManager.jalankanLangkahBot(sBotId, 'host-unit', {
    nowMs: dueNow,
    rngBot: rngBotCorrect,
    rngRintangan: noObstacleRng,
  });
  assert.strictEqual(stepBot.acted, true);
  assert.strictEqual(stepBot.feedback?.benar, true);
  assert.strictEqual(sBot.pemain2.posisi, 10);

  // Kulit Pisang obstacle + Bonus Shield Question in Solo Mode
  const rngKulitPisang: RngRintangan = {
    peluangPercent: () => 1,
    pilihIndex: (len) => {
      // rintanganDipilih default order: ['tiang_licin', 'kulit_pisang', 'pegangan_kuat', 'hadiah_kejutan']
      return len >= 2 ? 1 : 0;
    },
  };
  const qObsP1 = sBot.pemain1.presentasiAktif!;
  const qObsBenar = qObsP1.pilihan.find((o) => o.key === qObsP1.kunciKey)!;
  const rObs = panjatPinangSoloManager.prosesJawaban(sBotId, 'host-unit', {
    slot: 'pemain1',
    presentationId: qObsP1.presentationId,
    choiceId: qObsBenar.choiceId,
    nowMs: dueNow + 500,
    rngRintangan: rngKulitPisang,
  });
  assert.strictEqual(rObs.feedback.rintanganBaru?.tipe, 'kulit_pisang');
  assert.strictEqual(sBot.pemain1.presentasiAktif?.isBonusKulitPisang, true);

  // Answer bonus Kulit Pisang question correctly -> earns Perisai!
  const qBonus = sBot.pemain1.presentasiAktif!;
  const qBonusBenar = qBonus.pilihan.find((o) => o.key === qBonus.kunciKey)!;
  const rBonus = panjatPinangSoloManager.prosesJawaban(sBotId, 'host-unit', {
    slot: 'pemain1',
    presentationId: qBonus.presentationId,
    choiceId: qBonusBenar.choiceId,
    nowMs: dueNow + 1000,
    rngRintangan: noObstacleRng,
  });
  assert.strictEqual(rBonus.feedback.isBonusKulitPisang, true);
  assert.strictEqual(rBonus.feedback.perisaiDiperoleh, true);
  assert.strictEqual(sBot.pemain1.efekAktif.perisaiKulitPisang, true);

  // Hentikan manual & Seri check on tied STOP
  const sTieId = `unit-tie-${crypto.randomUUID()}`;
  panjatPinangSoloManager.inisialisasiSesi(
    sTieId,
    'host-unit',
    { id: 'tmpl-1', judul: 'Kuis Seri' },
    SAMPLE_SOAL,
    { tipeLawanSolo: 'lokal' },
    true,
    1000
  );
  const stoppedTie = panjatPinangSoloManager.hentikanPermainan(sTieId, 'host-unit', 5000);
  const clientTie = panjatPinangSoloManager.serialisasiUntukClient(stoppedTie);
  assert.strictEqual(clientTie.state, 'STOPPED');
  assert.strictEqual(clientTie.winnerSlot, 'SERI');
  assert.strictEqual(clientTie.hasil?.dihentikanManual, true);

  // Duel Lokal race to 100% finishes immediately on first player reaching 100%
  const sDuelId = `unit-duel-${crypto.randomUUID()}`;
  const sDuel = panjatPinangSoloManager.inisialisasiSesi(
    sDuelId,
    'host-unit',
    { id: 'tmpl-1', judul: 'Duel Cepat' },
    SAMPLE_SOAL,
    {
      kesulitan: 'custom',
      naikBenar: 50,
      turunSalah: 0,
      bonusStreakAktif: false,
      rintanganAktif: false,
      tipeLawanSolo: 'lokal',
      namaPemain1: 'Ani',
      namaPemain2: 'Budi',
    },
    true,
    1000
  );
  assert.strictEqual(sDuel.isBotLawan, false);
  assert.strictEqual(sDuel.pemain1.nama, 'Ani');
  assert.strictEqual(sDuel.pemain2.nama, 'Budi');

  for (let i = 0; i < 2; i++) {
    const pres = sDuel.pemain2.presentasiAktif!;
    const opt = pres.pilihan.find((o) => o.key === pres.kunciKey)!;
    panjatPinangSoloManager.prosesJawaban(sDuelId, 'host-unit', {
      slot: 'pemain2',
      presentationId: pres.presentationId,
      choiceId: opt.choiceId,
      nowMs: 2000 + i * 1000,
      rngRintangan: noObstacleRng,
    });
  }
  const duelClient = panjatPinangSoloManager.serialisasiUntukClient(sDuel);
  assert.strictEqual(duelClient.state, 'FINISHED');
  assert.strictEqual(duelClient.winnerSlot, 'pemain2');
  assert.strictEqual(duelClient.winnerNama, 'Budi');
  assert.strictEqual(duelClient.pemain2.posisi, 100);
  assert.strictEqual(duelClient.hasil?.totalSelesai, 1);

  panjatPinangSoloManager.hapusSesi(sBotId);
  panjatPinangSoloManager.hapusSesi(sTieId);
  panjatPinangSoloManager.hapusSesi(sDuelId);
  console.log('   OK Unit tests Panjat Pinang Solo lolos semua!');
}

async function runHttpIntegrationTests() {
  console.log('2. HTTP Integration Tests: Panjat Pinang Solo E2E + DB Recovery...');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/template', templateRouter);
  app.use('/api/sesi', sesiRouter);
  app.use(errorHandler);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const createdSessionIds: string[] = [];
  let createdTemplateId: string | null = null;
  let createdUserId: string | null = null;

  try {
    const email = `guru-panjat-solo-${Date.now()}@test.local`;
    const regRes = await fetch(`${baseUrl}/api/auth/daftar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: 'Guru Uji Panjat Solo',
        email,
        kataSandi: 'PasswordUji123!',
      }),
    });
    const regData: any = await regRes.json();
    assert.strictEqual(regRes.status, 201, `Register gagal: ${JSON.stringify(regData)}`);
    createdUserId = regData.user.id;
    const setCookie = regRes.headers.get('set-cookie') || '';
    const tokenCookie = setCookie.split(';')[0];

    // 2a. Create Panjat Pinang template with mode: 'solo' and verify it is NOT overridden to 'multi'
    const tmplRes = await fetch(`${baseUrl}/api/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({
        judul: 'Kuis Panjat Pinang Solo E2E',
        game: 'panjat_pinang',
        mode: 'solo',
        questions: SAMPLE_SOAL.map((q) => ({
          teks: q.teks,
          opsiA: q.opsiA,
          opsiB: q.opsiB,
          opsiC: q.opsiC,
          opsiD: q.opsiD,
          jawabanBenar: q.jawabanBenar,
          penjelasan: q.penjelasan,
        })),
      }),
    });
    const tmplData: any = await tmplRes.json();
    assert.strictEqual(tmplRes.status, 201);
    assert.strictEqual(tmplData.template.game, 'panjat_pinang');
    assert.strictEqual(tmplData.template.mode, 'solo');
    createdTemplateId = tmplData.template.id;
    const dbQuestions: Array<{ id: string; urutan: number }> = tmplData.template.questions;
    const qOrderKunci = new Map<string, string>();
    dbQuestions.forEach((dq, idx) => {
      qOrderKunci.set(dq.id, SAMPLE_SOAL[idx].jawabanBenar);
    });

    // 2b. Create Solo vs Bot session
    const sBotCreateRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({
        templateId: createdTemplateId,
        game: 'panjat_pinang',
        mode: 'solo',
        playMode: 'SOLO',
        panjatPinangConfig: {
          kesulitan: 'custom',
          naikBenar: 50,
          turunSalah: 10,
          bonusStreakAktif: false,
          rintanganAktif: false,
          waktuPerSoalDetik: 15,
          tipeLawanSolo: 'bot',
          kesulitanBot: 'sedang',
          namaPemain1: 'Adi',
          namaPemain2: 'RoboPanjat',
        },
      }),
    });
    const sBotCreateData: any = await sBotCreateRes.json();
    assert.strictEqual(sBotCreateRes.status, 201);
    const sBotHttpId: string = sBotCreateData.session.id;
    createdSessionIds.push(sBotHttpId);
    assert.strictEqual(sBotCreateData.session.state, 'READY');
    assert.strictEqual(sBotCreateData.session.pemain1.nama, 'Adi');
    assert.strictEqual(sBotCreateData.session.pemain2.nama, 'RoboPanjat');

    // Verify token endpoint rejects solo ID cleanly
    const tokRes = await fetch(`${baseUrl}/api/sesi/token/${sBotHttpId}`);
    assert.strictEqual(tokRes.status, 400);

    // Update Bot difficulty & start
    const patchRes = await fetch(`${baseUrl}/api/sesi/${sBotHttpId}/pengaturan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({ kesulitanBot: 'cepat' }),
    });
    const patchData: any = await patchRes.json();
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchData.session.config.kesulitanBot, 'cepat');

    const mulaiRes = await fetch(`${baseUrl}/api/sesi/${sBotHttpId}/mulai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({}),
    });
    const mulaiData: any = await mulaiRes.json();
    assert.strictEqual(mulaiRes.status, 200);
    assert.strictEqual(mulaiData.session.state, 'PLAYING');

    // Submit P1 timedOut (-10% clamped 0), then Pause/Resume, then Ulang
    const p1Pres = mulaiData.session.pemain1.soalAktif;
    const toRes = await fetch(`${baseUrl}/api/sesi/${sBotHttpId}/jawab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({
        slot: 'pemain1',
        presentationId: p1Pres.presentationId,
        questionId: p1Pres.questionId,
        timedOut: true,
      }),
    });
    const toData: any = await toRes.json();
    assert.strictEqual(toRes.status, 200);
    assert.strictEqual(toData.feedback.timedOut, true);

    const pauseRes = await fetch(`${baseUrl}/api/sesi/${sBotHttpId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({ state: 'PAUSED' }),
    });
    assert.strictEqual(pauseRes.status, 200);
    const resumeRes = await fetch(`${baseUrl}/api/sesi/${sBotHttpId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({ state: 'PLAYING' }),
    });
    assert.strictEqual(resumeRes.status, 200);

    // Restart to READY cleanly
    const ulangRes = await fetch(`${baseUrl}/api/sesi/${sBotHttpId}/ulang`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
    });
    const ulangData: any = await ulangRes.json();
    assert.strictEqual(ulangRes.status, 200);
    assert.strictEqual(ulangData.session.state, 'READY');
    assert.strictEqual(ulangData.session.pemain1.posisi, 0);

    // Play P1 to 100% (2 correct answers at +50%)
    const start2Res = await fetch(`${baseUrl}/api/sesi/${sBotHttpId}/mulai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({}),
    });
    let currentSession: any = ((await start2Res.json()) as any).session;

    // Also poll bot-langkah (should not act immediately, returns 200)
    const botPollRes = await fetch(`${baseUrl}/api/sesi/${sBotHttpId}/bot-langkah`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
    });
    assert.strictEqual(botPollRes.status, 200);

    for (let step = 0; step < 2; step++) {
      const sAktif = currentSession.pemain1.soalAktif;
      const kBenar = qOrderKunci.get(sAktif.questionId)!;
      const opt = sAktif.opsi.find((o: any) => o.key === kBenar)!;
      const ansRes = await fetch(`${baseUrl}/api/sesi/${sBotHttpId}/jawab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
        body: JSON.stringify({
          slot: 'pemain1',
          presentationId: sAktif.presentationId,
          questionId: sAktif.questionId,
          choiceId: opt.choiceId,
        }),
      });
      const ansData: any = await ansRes.json();
      assert.strictEqual(ansRes.status, 200);
      currentSession = ansData.session;
    }

    assert.strictEqual(currentSession.state, 'FINISHED');
    assert.strictEqual(currentSession.winnerSlot, 'pemain1');
    assert.strictEqual(currentSession.winnerNama, 'Adi');

    // Reject ulang after FINISHED
    const ulangFinRes = await fetch(`${baseUrl}/api/sesi/${sBotHttpId}/ulang`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
    });
    assert.strictEqual(ulangFinRes.status, 400);

    // Drop in-memory state to verify DB recovery across GET /:id, GET /:id/hasil, GET /riwayat/:id
    panjatPinangSoloManager.hapusSesi(sBotHttpId);

    const getRecoveredRes = await fetch(`${baseUrl}/api/sesi/${sBotHttpId}`, {
      headers: { Cookie: tokenCookie },
    });
    const getRecoveredData: any = await getRecoveredRes.json();
    assert.strictEqual(getRecoveredRes.status, 200);
    assert.strictEqual(getRecoveredData.session.state, 'FINISHED');
    assert.strictEqual(getRecoveredData.session.pemain1.nama, 'Adi');
    assert.strictEqual(getRecoveredData.session.pemain1.posisi, 100);

    panjatPinangSoloManager.hapusSesi(sBotHttpId);
    const riwayatRes = await fetch(`${baseUrl}/api/sesi/riwayat/${sBotHttpId}`, {
      headers: { Cookie: tokenCookie },
    });
    const riwayatData: any = await riwayatRes.json();
    assert.strictEqual(riwayatRes.status, 200);
    assert.strictEqual(riwayatData.detail.game, 'panjat_pinang');
    assert.ok(riwayatData.detail.laporanPanjatPinang);
    assert.strictEqual(riwayatData.detail.laporanPanjatPinang.laporanPemain[0].nama, 'Adi');

    const hasilRes = await fetch(`${baseUrl}/api/sesi/${sBotHttpId}/hasil`, {
      headers: { Cookie: tokenCookie },
    });
    const hasilData: any = await hasilRes.json();
    assert.strictEqual(hasilRes.status, 200);
    assert.strictEqual(hasilData.hasil.game, 'panjat_pinang');

    // Main Lagi creates a fresh Solo Panjat Pinang session
    const mainLagiRes = await fetch(`${baseUrl}/api/sesi/${sBotHttpId}/main-lagi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
    });
    const mainLagiData: any = await mainLagiRes.json();
    assert.strictEqual(mainLagiRes.status, 201);
    assert.strictEqual(mainLagiData.game, 'panjat_pinang');
    assert.strictEqual(mainLagiData.mode, 'solo');
    createdSessionIds.push(mainLagiData.sessionId);

    // 2c. Duel Lokal HTTP + Manual Stop
    const duelCreateRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({
        templateId: createdTemplateId,
        game: 'panjat_pinang',
        mode: 'solo',
        playMode: 'SOLO',
        autoStart: true,
        panjatPinangConfig: {
          kesulitan: 'normal',
          tipeLawanSolo: 'lokal',
          rintanganAktif: false,
          namaPemain1: 'Dina',
          namaPemain2: 'Eko',
        },
      }),
    });
    const duelCreateData: any = await duelCreateRes.json();
    assert.strictEqual(duelCreateRes.status, 201);
    const sDuelHttpId: string = duelCreateData.session.id;
    createdSessionIds.push(sDuelHttpId);
    assert.strictEqual(duelCreateData.session.state, 'PLAYING');
    assert.strictEqual(duelCreateData.session.isBotLawan, false);

    const p2Soal = duelCreateData.session.pemain2.soalAktif;
    const p2Key = qOrderKunci.get(p2Soal.questionId)!;
    const p2Opt = p2Soal.opsi.find((o: any) => o.key === p2Key)!;
    const p2AnsRes = await fetch(`${baseUrl}/api/sesi/${sDuelHttpId}/jawab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({
        slot: 'pemain2',
        presentationId: p2Soal.presentationId,
        questionId: p2Soal.questionId,
        choiceId: p2Opt.choiceId,
      }),
    });
    const p2AnsData: any = await p2AnsRes.json();
    assert.strictEqual(p2AnsRes.status, 200);
    assert.strictEqual(p2AnsData.feedback.slot, 'pemain2');
    assert.strictEqual(p2AnsData.session.pemain2.posisi, 10);

    const stopRes = await fetch(`${baseUrl}/api/sesi/${sDuelHttpId}/selesai`, {
      method: 'POST',
      headers: { Cookie: tokenCookie },
    });
    const stopData: any = await stopRes.json();
    assert.strictEqual(stopRes.status, 200);
    assert.strictEqual(stopData.session.state, 'STOPPED');
    assert.strictEqual(stopData.session.winnerSlot, 'pemain2');
    assert.strictEqual(stopData.session.winnerNama, 'Eko');
    assert.strictEqual(stopData.hasil.dihentikanManual, true);

    console.log('   OK HTTP Integration & DB recovery Panjat Pinang Solo lolos semua!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const sid of createdSessionIds) {
      panjatPinangSoloManager.hapusSesi(sid);
      await prisma.session.deleteMany({ where: { id: sid } });
    }
    if (createdTemplateId) {
      await prisma.template.deleteMany({ where: { id: createdTemplateId } });
    }
    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
  }
}

async function main() {
  try {
    await runUnitTests();
    await runHttpIntegrationTests();
    console.log('\nSEMUA PENGUJIAN PANJAT PINANG SOLO BERHASIL.');
    process.exit(0);
  } catch (err) {
    console.error('\nPENGUJIAN PANJAT PINANG SOLO GAGAL:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
