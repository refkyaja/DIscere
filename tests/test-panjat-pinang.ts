import assert from 'assert';
import http from 'http';
import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { prisma } from '../server/src/db.js';
import { authRouter } from '../server/src/routes/auth.js';
import { templateRouter } from '../server/src/routes/template.js';
import { sesiRouter } from '../server/src/routes/sesi.js';
import { guruRouter } from '../server/src/routes/guru.js';
import { errorHandler } from '../server/src/middleware/error.js';
import { setupMultiplayerSocket } from '../server/src/realtime/sesi.js';
import {
  PRESET_PANJAT_PINANG,
  bangunKonfigurasiPanjatPinang,
  buatPresentasiSoalPanjat,
  prosesJawabanPanjatPinang,
  urutkanLeaderboardPanjatPinang,
  PesertaPanjatState,
  SoalPanjat,
  RngRintangan,
} from '../server/src/games/panjatPinang.js';
import {
  panjatPinangManager,
  siapkanAntreanSoalPanjat,
} from '../server/src/games/panjatPinangManager.js';

function buatPesertaMock(override: Partial<PesertaPanjatState> = {}): PesertaPanjatState {
  return {
    id: override.id || crypto.randomUUID(),
    secretToken: crypto.randomUUID(),
    socketId: override.socketId || 'sock-1',
    nama: override.nama || 'Siswa Uji',
    connected: true,
    posisi: 0,
    poinBonus: 0,
    totalBenar: 0,
    totalSalah: 0,
    streakSaatIni: 0,
    streakTertinggi: 0,
    bonus3DalamStreak: false,
    bonus5DalamStreak: false,
    status: 'bermain',
    waktuSelesaiMs: null,
    selesaiPada: null,
    totalWaktuJawabMs: 0,
    jumlahJawab: 0,
    rataRataWaktuJawabMs: 0,
    efekAktif: {
      tiangLicin: false,
      perisaiKulitPisang: false,
      peganganKuat: false,
      menungguBonusKulitPisang: false,
      ...(override.efekAktif || {}),
    },
    riwayatPosisi: [],
    riwayatRintangan: [],
    riwayatJawaban: [],
    antreanSoal: [],
    presentasiAktif: null,
    nomorSoalPemain: 0,
    ...override,
  };
}

const SAMPLE_SOAL: SoalPanjat[] = [
  {
    id: 'q-1',
    urutan: 1,
    teks: 'Hasil dari 6 x 7 adalah?',
    opsiA: '40',
    opsiB: '42',
    opsiC: '48',
    jawabanBenar: 'B',
    penjelasan: '6 x 7 = 42',
  },
  {
    id: 'q-2',
    urutan: 2,
    teks: 'Ibu kota negara Indonesia adalah?',
    opsiA: 'Jakarta',
    opsiB: 'Bandung',
    opsiC: 'Surabaya',
    jawabanBenar: 'A',
    penjelasan: 'Jakarta',
  },
  {
    id: 'q-3',
    urutan: 3,
    teks: 'Proklamasi kemerdekaan RI terjadi pada tahun?',
    opsiA: '1942',
    opsiB: '1945',
    opsiC: '1950',
    jawabanBenar: 'B',
    penjelasan: '17 Agustus 1945',
  },
];

function buatRngPaksa(pemicu: boolean, pilihIdx: number = 0): RngRintangan {
  return {
    peluangPercent: () => (pemicu ? 0 : 99),
    pilihIndex: (maxExclusive: number) => Math.min(pilihIdx, Math.max(0, maxExclusive - 1)),
  };
}

function jalankanUnitTests() {
  console.log('=== BAGIAN A: UNIT TEST LOGIKA PANJAT PINANG ===\n');

  // 1. Preset kesulitan & Custom config
  console.log('1. Menguji preset Mudah, Normal, Sulit, dan Custom...');
  const cfgMudah = bangunKonfigurasiPanjatPinang({ kesulitan: 'mudah' });
  assert.strictEqual(cfgMudah.naikBenar, PRESET_PANJAT_PINANG.mudah.naikBenar);
  assert.strictEqual(cfgMudah.turunSalah, PRESET_PANJAT_PINANG.mudah.turunSalah);

  const cfgNormal = bangunKonfigurasiPanjatPinang({ kesulitan: 'normal' });
  assert.strictEqual(cfgNormal.naikBenar, 10);
  assert.strictEqual(cfgNormal.turunSalah, 5);

  const cfgSulit = bangunKonfigurasiPanjatPinang({ kesulitan: 'sulit' });
  assert.strictEqual(cfgSulit.naikBenar, 7);
  assert.strictEqual(cfgSulit.turunSalah, 10);

  const cfgCustom = bangunKonfigurasiPanjatPinang({
    kesulitan: 'custom',
    naikBenar: 25,
    turunSalah: 8,
    bonusStreakAktif: true,
    bonusStreak3: 7,
    bonusStreak5: 15,
    rintanganAktif: true,
    rintanganDipilih: ['tiang_licin', 'pegangan_kuat'],
    penurunanTiangLicin: 6,
    bonusPeganganKuat: 9,
  });
  assert.strictEqual(cfgCustom.naikBenar, 25);
  assert.strictEqual(cfgCustom.turunSalah, 8);
  assert.strictEqual(cfgCustom.bonusStreak3, 7);
  assert.strictEqual(cfgCustom.bonusStreak5, 15);
  assert.deepStrictEqual(cfgCustom.rintanganDipilih, ['tiang_licin', 'pegangan_kuat']);
  assert.ok(Object.isFrozen(cfgCustom), 'Konfigurasi snapshot harus immutable');
  console.log('   OK Preset & snapshot konfigurasi terverifikasi');

  // 2. Ketinggian min 0% dan max 100%
  console.log('2. Menguji batas bawah 0% dan batas atas 100%...');
  const noObstacleNormal = bangunKonfigurasiPanjatPinang({
    kesulitan: 'normal',
    bonusStreakAktif: false,
    rintanganAktif: false,
  });

  const pBawah = buatPesertaMock({ posisi: 2 });
  const presSalah1 = buatPresentasiSoalPanjat(SAMPLE_SOAL[0], 1, false, 1000);
  const resSalahBawah = prosesJawabanPanjatPinang({
    peserta: pBawah,
    presentasi: presSalah1,
    choiceId: `${SAMPLE_SOAL[0].id}::A`,
    config: noObstacleNormal,
    gameMulaiPadaMs: 0,
    nowMs: 2000,
  });
  assert.strictEqual(resSalahBawah.benar, false);
  assert.strictEqual(resSalahBawah.posisiBaru, 0, 'Posisi tidak boleh < 0%');

  const pAtas = buatPesertaMock({ posisi: 96 });
  const presBenarAtas = buatPresentasiSoalPanjat(SAMPLE_SOAL[0], 1, false, 1000);
  const resBenarAtas = prosesJawabanPanjatPinang({
    peserta: pAtas,
    presentasi: presBenarAtas,
    choiceId: `${SAMPLE_SOAL[0].id}::B`,
    config: noObstacleNormal,
    gameMulaiPadaMs: 0,
    nowMs: 3500,
  });
  assert.strictEqual(resBenarAtas.benar, true);
  assert.strictEqual(resBenarAtas.posisiBaru, 100, 'Posisi tidak boleh > 100%');
  assert.strictEqual(resBenarAtas.selesaiBaru, true);
  assert.strictEqual(resBenarAtas.pesertaUpdated.status, 'selesai');
  assert.strictEqual(resBenarAtas.pesertaUpdated.waktuSelesaiMs, 3500);
  console.log('   OK Clamping [0%, 100%] & selesai pada 100% akurat');

  // 3. Validasi choiceId bahkan bila opsi pada UI/presentasi diacak
  console.log('3. Menguji validasi choiceId stabil dan penolakan ID tidak valid...');
  const presAcak = buatPresentasiSoalPanjat(SAMPLE_SOAL[0], 1, false, 1000);
  // Acak urutan pilihan di array tanpa mengubah choiceId
  presAcak.pilihan = [presAcak.pilihan[2], presAcak.pilihan[0], presAcak.pilihan[1]];
  const pChoice = buatPesertaMock({ posisi: 0 });
  const resAcak = prosesJawabanPanjatPinang({
    peserta: pChoice,
    presentasi: presAcak,
    choiceId: `${SAMPLE_SOAL[0].id}::B`,
    config: noObstacleNormal,
    gameMulaiPadaMs: 0,
    nowMs: 2000,
  });
  assert.strictEqual(resAcak.benar, true, 'choiceId yang benar tetap harus dianggap benar meski posisi array diacak');
  assert.throws(
    () =>
      prosesJawabanPanjatPinang({
        peserta: resAcak.pesertaUpdated,
        presentasi: buatPresentasiSoalPanjat(SAMPLE_SOAL[1], 2, false, 2000),
        choiceId: 'fake-choice-id',
        config: noObstacleNormal,
        gameMulaiPadaMs: 0,
        nowMs: 3000,
      }),
    /tidak valid/i
  );
  console.log('   OK Validasi choiceId independen dari urutan array & menolak ID palsu');

  // 4. Bonus Streak (aktif & nonaktif, streak 3, streak 5, 1x per run, reset saat salah)
  console.log('4. Menguji logika Bonus Streak (3 & 5 benar, reset, nonaktif)...');
  const streakCfg = bangunKonfigurasiPanjatPinang({
    kesulitan: 'normal',
    bonusStreakAktif: true,
    rintanganAktif: false,
  });
  let pStreak = buatPesertaMock();
  const deltas: number[] = [];
  for (let i = 0; i < 6; i++) {
    const soal = SAMPLE_SOAL[i % SAMPLE_SOAL.length];
    const pres = buatPresentasiSoalPanjat(soal, i + 1, false, i * 1000);
    const keyBenar = soal.jawabanBenar as 'A' | 'B' | 'C' | 'D' | 'E';
    const r = prosesJawabanPanjatPinang({
      peserta: pStreak,
      presentasi: pres,
      choiceId: `${soal.id}::${keyBenar}`,
      config: streakCfg,
      gameMulaiPadaMs: 0,
      nowMs: i * 1000 + 500,
    });
    deltas.push(r.perubahanPosisi);
    pStreak = r.pesertaUpdated;
  }
  // Langkah 1: +10, 2: +10, 3: +15 (streak3), 4: +10, 5: +20 (streak5), 6: +10 => total 75
  assert.deepStrictEqual(deltas, [10, 10, 15, 10, 20, 10]);
  assert.strictEqual(pStreak.posisi, 75);
  assert.strictEqual(pStreak.streakSaatIni, 6);

  // Salah 1x mereset streak menjadi 0, kemudian 3 benar lagi dapat bonus streak 3 kembali!
  const presReset = buatPresentasiSoalPanjat(SAMPLE_SOAL[0], 7, false, 7000);
  const resReset = prosesJawabanPanjatPinang({
    peserta: pStreak,
    presentasi: presReset,
    choiceId: `${SAMPLE_SOAL[0].id}::A`, // salah
    config: streakCfg,
    gameMulaiPadaMs: 0,
    nowMs: 7500,
  });
  assert.strictEqual(resReset.pesertaUpdated.streakSaatIni, 0);
  assert.strictEqual(resReset.pesertaUpdated.streakTertinggi, 6);
  assert.strictEqual(resReset.posisiBaru, 70);

  pStreak = resReset.pesertaUpdated;
  for (let i = 0; i < 3; i++) {
    const soal = SAMPLE_SOAL[i];
    const pres = buatPresentasiSoalPanjat(soal, 8 + i, false, 8000 + i * 1000);
    const r = prosesJawabanPanjatPinang({
      peserta: pStreak,
      presentasi: pres,
      choiceId: `${soal.id}::${soal.jawabanBenar}`,
      config: streakCfg,
      gameMulaiPadaMs: 0,
      nowMs: 8500 + i * 1000,
    });
    pStreak = r.pesertaUpdated;
    if (i === 2) {
      assert.strictEqual(r.bonusStreakDidapat, 5, 'Bonus streak 3 harus bisa didapat lagi setelah reset');
    }
  }
  assert.strictEqual(pStreak.status, 'selesai');
  assert.strictEqual(pStreak.posisi, 100);

  // Saat bonusStreakAktif = false -> tidak pernah ada bonus streak
  let pNoStreak = buatPesertaMock();
  for (let i = 0; i < 5; i++) {
    const soal = SAMPLE_SOAL[i % SAMPLE_SOAL.length];
    const pres = buatPresentasiSoalPanjat(soal, i + 1, false, i * 1000);
    const r = prosesJawabanPanjatPinang({
      peserta: pNoStreak,
      presentasi: pres,
      choiceId: `${soal.id}::${soal.jawabanBenar}`,
      config: noObstacleNormal,
      gameMulaiPadaMs: 0,
      nowMs: i * 1000 + 500,
    });
    assert.strictEqual(r.bonusStreakDidapat, 0);
    pNoStreak = r.pesertaUpdated;
  }
  assert.strictEqual(pNoStreak.posisi, 50);
  console.log('   OK Streak 3, Streak 5, reset, re-earn, & toggle nonaktif lolos');

  // 5. Rintangan: Tiang Licin, Kulit Pisang (+ Perisai), Pegangan Kuat, Hadiah Kejutan (Posisi & Poin), & Nonaktif
  console.log('5. Menguji seluruh 4 jenis rintangan + toggle rintangan nonaktif...');
  // 5a. Saat rintanganAktif = false, RNG memaksa pun tidak muncul rintangan
  const presNoObs = buatPresentasiSoalPanjat(SAMPLE_SOAL[0], 1, false, 1000);
  const resNoObs = prosesJawabanPanjatPinang({
    peserta: buatPesertaMock({ posisi: 20 }),
    presentasi: presNoObs,
    choiceId: `${SAMPLE_SOAL[0].id}::B`,
    config: noObstacleNormal,
    gameMulaiPadaMs: 0,
    nowMs: 1500,
    rngRintangan: buatRngPaksa(true, 0),
  });
  assert.strictEqual(resNoObs.rintanganBaru, null);

  // 5b. Tiang Licin + Perisai Kulit Pisang (bonus question)
  const cfgObs = bangunKonfigurasiPanjatPinang({
    kesulitan: 'normal',
    bonusStreakAktif: false,
    rintanganAktif: true,
    rintanganDipilih: ['kulit_pisang'],
    penurunanTiangLicin: 5,
    peluangRintanganPersen: 50,
  });
  const resKulit = prosesJawabanPanjatPinang({
    peserta: buatPesertaMock({ posisi: 30 }),
    presentasi: buatPresentasiSoalPanjat(SAMPLE_SOAL[0], 1, false, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::B`, // benar -> posisi 40, memicu kulit pisang
    config: cfgObs,
    gameMulaiPadaMs: 0,
    nowMs: 1500,
    rngRintangan: buatRngPaksa(true, 0),
  });
  assert.strictEqual(resKulit.rintanganBaru?.tipe, 'kulit_pisang');
  assert.strictEqual(resKulit.pesertaUpdated.efekAktif.menungguBonusKulitPisang, true);

  // Jawab soal bonus Kulit Pisang dengan BENAR -> dapat perisai, posisi tetap 40
  const resBonusBenar = prosesJawabanPanjatPinang({
    peserta: resKulit.pesertaUpdated,
    presentasi: buatPresentasiSoalPanjat(SAMPLE_SOAL[1], 2, true, 2000),
    choiceId: `${SAMPLE_SOAL[1].id}::A`,
    config: cfgObs,
    gameMulaiPadaMs: 0,
    nowMs: 2600,
  });
  assert.strictEqual(resBonusBenar.isBonusKulitPisang, true);
  assert.strictEqual(resBonusBenar.perisaiDiperoleh, true);
  assert.strictEqual(resBonusBenar.posisiBaru, 40);
  assert.strictEqual(resBonusBenar.pesertaUpdated.efekAktif.perisaiKulitPisang, true);

  // Jika soal bonus dijawab SALAH -> tidak dapat perisai, posisi tidak turun
  const resBonusSalah = prosesJawabanPanjatPinang({
    peserta: resKulit.pesertaUpdated,
    presentasi: buatPresentasiSoalPanjat(SAMPLE_SOAL[1], 2, true, 2000),
    choiceId: `${SAMPLE_SOAL[1].id}::C`,
    config: cfgObs,
    gameMulaiPadaMs: 0,
    nowMs: 2600,
  });
  assert.strictEqual(resBonusSalah.perisaiDiperoleh, false);
  assert.strictEqual(resBonusSalah.posisiBaru, 40);
  assert.strictEqual(resBonusSalah.pesertaUpdated.efekAktif.perisaiKulitPisang, false);

  // Uji Perisai menahan penalti Tiang Licin saat jawaban salah
  const pDenganPerisai = {
    ...resBonusBenar.pesertaUpdated,
    efekAktif: { ...resBonusBenar.pesertaUpdated.efekAktif, tiangLicin: true },
  };
  const resTahanLicin = prosesJawabanPanjatPinang({
    peserta: pDenganPerisai,
    presentasi: buatPresentasiSoalPanjat(SAMPLE_SOAL[0], 3, false, 3000),
    choiceId: `${SAMPLE_SOAL[0].id}::C`, // salah (-5% saja, penalti -5% tiang licin diblok)
    config: noObstacleNormal,
    gameMulaiPadaMs: 0,
    nowMs: 3600,
  });
  assert.strictEqual(resTahanLicin.perisaiDigunakan, true);
  assert.strictEqual(resTahanLicin.penaltiTiangLicin, 0);
  assert.strictEqual(resTahanLicin.posisiBaru, 35);

  // Tanpa Perisai, Tiang Licin mengurangi tambahan 5%
  const pTanpaPerisai = buatPesertaMock({
    posisi: 40,
    efekAktif: { tiangLicin: true, perisaiKulitPisang: false, peganganKuat: false, menungguBonusKulitPisang: false },
  });
  const resKenaLicin = prosesJawabanPanjatPinang({
    peserta: pTanpaPerisai,
    presentasi: buatPresentasiSoalPanjat(SAMPLE_SOAL[0], 3, false, 3000),
    choiceId: `${SAMPLE_SOAL[0].id}::C`, // salah (-5% - 5% = -10%)
    config: noObstacleNormal,
    gameMulaiPadaMs: 0,
    nowMs: 3600,
  });
  assert.strictEqual(resKenaLicin.penaltiTiangLicin, 5);
  assert.strictEqual(resKenaLicin.posisiBaru, 30);

  // 5c. Pegangan Kuat (+bonusPeganganKuat pada jawaban benar berikutnya, 1x pakai)
  const pPegangan = buatPesertaMock({
    posisi: 20,
    efekAktif: { tiangLicin: false, perisaiKulitPisang: false, peganganKuat: true, menungguBonusKulitPisang: false },
  });
  const resPegangan = prosesJawabanPanjatPinang({
    peserta: pPegangan,
    presentasi: buatPresentasiSoalPanjat(SAMPLE_SOAL[0], 1, false, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::B`,
    config: noObstacleNormal,
    gameMulaiPadaMs: 0,
    nowMs: 1500,
  });
  assert.strictEqual(resPegangan.bonusPeganganKuatDidapat, 5);
  assert.strictEqual(resPegangan.posisiBaru, 35); // 20 + 10 + 5
  assert.strictEqual(resPegangan.pesertaUpdated.efekAktif.peganganKuat, false);

  // 5d. Hadiah Kejutan mode posisi & mode poin
  const cfgHadiahPosisi = bangunKonfigurasiPanjatPinang({
    kesulitan: 'normal',
    bonusStreakAktif: false,
    rintanganAktif: true,
    rintanganDipilih: ['hadiah_kejutan'],
    hadiahKejutanMode: 'posisi',
    hadiahKejutanNilai: 15,
  });
  const resHadiahPos = prosesJawabanPanjatPinang({
    peserta: buatPesertaMock({ posisi: 80 }),
    presentasi: buatPresentasiSoalPanjat(SAMPLE_SOAL[0], 1, false, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::B`, // 80 + 10 + 15 => terclamp 100% dan selesai
    config: cfgHadiahPosisi,
    gameMulaiPadaMs: 0,
    nowMs: 1800,
    rngRintangan: buatRngPaksa(true, 0),
  });
  assert.strictEqual(resHadiahPos.rintanganBaru?.tipe, 'hadiah_kejutan');
  assert.strictEqual(resHadiahPos.posisiBaru, 100);
  assert.strictEqual(resHadiahPos.selesaiBaru, true);

  const cfgHadiahPoin = bangunKonfigurasiPanjatPinang({
    kesulitan: 'normal',
    bonusStreakAktif: false,
    rintanganAktif: true,
    rintanganDipilih: ['hadiah_kejutan'],
    hadiahKejutanMode: 'poin',
    hadiahKejutanNilai: 50,
  });
  const resHadiahPoin = prosesJawabanPanjatPinang({
    peserta: buatPesertaMock({ posisi: 20 }),
    presentasi: buatPresentasiSoalPanjat(SAMPLE_SOAL[0], 1, false, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::B`,
    config: cfgHadiahPoin,
    gameMulaiPadaMs: 0,
    nowMs: 1800,
    rngRintangan: buatRngPaksa(true, 0),
  });
  assert.strictEqual(resHadiahPoin.posisiBaru, 30);
  assert.strictEqual(resHadiahPoin.pesertaUpdated.poinBonus, 50);
  console.log('   OK Semua 4 rintangan + Perisai + toggle nonaktif teruji');

  // 6. Pengacakan & Pengulangan Soal Tanpa Repeat Beruntun
  console.log('6. Menguji reshuffle antrean soal tanpa pengulangan berturut-turut...');
  let prevLastId: string | undefined;
  for (let round = 0; round < 30; round++) {
    const queue = siapkanAntreanSoalPanjat(SAMPLE_SOAL, prevLastId);
    assert.strictEqual(queue.length, SAMPLE_SOAL.length);
    if (prevLastId) {
      assert.notStrictEqual(queue[0], prevLastId, 'Soal pertama antrean baru tidak boleh mengulang soal terakhir sebelumnya');
    }
    prevLastId = queue[queue.length - 1];
  }
  console.log('   OK 30 siklus acak antrean bebas pengulangan berturut-turut');

  // 7. Pengurutan Leaderboard 5 Kriteria Resmi
  console.log('7. Menguji 5 kriteria pengurutan leaderboard...');
  const lb = urutkanLeaderboardPanjatPinang([
    buatPesertaMock({ id: 'u5', nama: 'Eka', status: 'bermain', posisi: 80, totalBenar: 8, jumlahJawab: 10, rataRataWaktuJawabMs: 2500 }),
    buatPesertaMock({ id: 'u4', nama: 'Dodi', status: 'bermain', posisi: 80, totalBenar: 8, jumlahJawab: 10, rataRataWaktuJawabMs: 1500 }),
    buatPesertaMock({ id: 'u3', nama: 'Cici', status: 'bermain', posisi: 80, totalBenar: 9, jumlahJawab: 10, rataRataWaktuJawabMs: 3000 }),
    buatPesertaMock({ id: 'u2', nama: 'Budi', status: 'selesai', posisi: 100, waktuSelesaiMs: 45000, totalBenar: 10, jumlahJawab: 10, rataRataWaktuJawabMs: 2000 }),
    buatPesertaMock({ id: 'u1', nama: 'Ani', status: 'selesai', posisi: 100, waktuSelesaiMs: 32000, totalBenar: 10, jumlahJawab: 12, rataRataWaktuJawabMs: 2600 }),
  ]);
  assert.deepStrictEqual(
    lb.map((x) => x.nama),
    ['Ani', 'Budi', 'Cici', 'Dodi', 'Eka'],
    'Urutan harus sesuai: Selesai(tercepat) -> Selesai(berikut) -> Posisi -> TotalBenar -> RataRataCepat'
  );
  console.log('   OK Pengurutan leaderboard 5 kriteria tepat 100%\n');
}

async function emitWithAck<T = any>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res: T) => resolve(res));
  });
}

function waitForEvent<T = any>(socket: ClientSocket, event: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout menunggu event '${event}' (${timeoutMs}ms)`));
    }, timeoutMs);
    const handler = (data: T) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    };
    socket.on(event, handler);
  });
}

async function jalankanIntegrationDanSimulasi40Pemain() {
  console.log('=== BAGIAN B: TEST INTEGRASI REALTIME & SIMULASI 40 PEMAIN ===\n');

  // Siapkan Express + HTTP + Socket.IO server pada port ephemeral
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/template', templateRouter);
  app.use('/api/sesi', sesiRouter);
  app.use('/api/guru', guruRouter);
  app.use(errorHandler);

  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: '*' } });
  setupMultiplayerSocket(io);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  let createdTemplateId: string | null = null;
  const createdSessionIds: string[] = [];
  const sockets: ClientSocket[] = [];

  try {
    // 1. Login guru demo
    console.log('1. Login guru & membuat template uji Panjat Pinang...');
    const loginRes = await fetch(`${baseUrl}/api/auth/masuk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'guru@discere.local',
        kataSandi: 'GuruDiscere2026!',
      }),
    });
    assert.strictEqual(loginRes.ok, true, 'Login guru demo harus berhasil');
    const cookieHeader = loginRes.headers.get('set-cookie');
    assert.ok(cookieHeader, 'Cookie autentikasi harus tersedia');
    const tokenCookie = cookieHeader.split(';')[0];

    const tmplRes = await fetch(`${baseUrl}/api/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({
        judul: `Uji Panjat Pinang 40 Pemain ${Date.now()}`,
        game: 'panjat_pinang',
        mode: 'multi',
        questions: SAMPLE_SOAL.map((q) => ({
          urutan: q.urutan,
          teks: q.teks,
          opsiA: q.opsiA,
          opsiB: q.opsiB,
          opsiC: q.opsiC,
          jawabanBenar: q.jawabanBenar,
          penjelasan: q.penjelasan || undefined,
        })),
      }),
    });
    const tmplData: any = await tmplRes.json();
    assert.strictEqual(tmplRes.ok, true, `Pembuatan template uji gagal: ${JSON.stringify(tmplData)}`);
    createdTemplateId = tmplData.template.id;
    const soalKunciMap = new Map<string, string>();
    for (const q of tmplData.template.questions) {
      soalKunciMap.set(q.id, q.jawabanBenar);
    }

    // 2. Guru membuat sesi 40 pemain (Custom +25%/-5%, rintangan off agar alur naik terukur)
    console.log('2. Guru membuat sesi Panjat Pinang untuk 40 pemain...');
    const sesiRes = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({
        templateId: createdTemplateId,
        game: 'panjat_pinang',
        mode: 'multi',
        panjatPinangConfig: {
          kesulitan: 'custom',
          naikBenar: 25,
          turunSalah: 5,
          bonusStreakAktif: true,
          bonusStreak3: 10,
          bonusStreak5: 15,
          rintanganAktif: false,
          maxPeserta: 50,
          allowLateJoin: true,
        },
      }),
    });
    const sesiData: any = await sesiRes.json();
    assert.strictEqual(sesiRes.status, 201, `Gagal buat sesi: ${JSON.stringify(sesiData)}`);
    const sessionId: string = sesiData.session.id;
    const pinToken: string = sesiData.session.token;
    createdSessionIds.push(sessionId);

    // Verifikasi endpoint token publik
    const checkTokRes = await fetch(`${baseUrl}/api/sesi/token/${pinToken}`);
    const checkTok: any = await checkTokRes.json();
    assert.strictEqual(checkTok.valid, true);
    assert.strictEqual(checkTok.game, 'panjat_pinang');

    // 3. Hubungkan Host & 40 Siswa via Socket.IO
    console.log('3. Menghubungkan Host dan 40 siswa secara bersamaan...');
    const hostSocket = ioClient(baseUrl, { transports: ['websocket'] });
    sockets.push(hostSocket);
    await waitForEvent(hostSocket, 'connect');
    hostSocket.emit('sesi:host_join', { sessionId });

    interface ClientPemain {
      idx: number;
      nama: string;
      socket: ClientSocket;
      pesertaId: string;
      pesertaSecret: string;
      soalAktif: any;
      posisi: number;
      status: string;
    }

    const clients: ClientPemain[] = [];
    await Promise.all(
      Array.from({ length: 40 }, async (_, idx) => {
        const sc = ioClient(baseUrl, { transports: ['websocket'] });
        sockets.push(sc);
        await waitForEvent(sc, 'connect');
        const nama = `Siswa-${String(idx + 1).padStart(2, '0')}`;
        const joinRes = await emitWithAck(sc, 'sesi:gabung', { token: pinToken, nama });
        assert.strictEqual(joinRes.success, true, `${nama} gagal gabung: ${joinRes.pesan}`);
        assert.strictEqual(joinRes.game, 'panjat_pinang');
        assert.ok(joinRes.pesertaSecret, 'Server wajib mengirim pesertaSecret');
        clients.push({
          idx,
          nama,
          socket: sc,
          pesertaId: joinRes.pesertaId,
          pesertaSecret: joinRes.pesertaSecret,
          soalAktif: null,
          posisi: 0,
          status: 'bermain',
        });
      })
    );
    clients.sort((a, b) => a.idx - b.idx);
    assert.strictEqual(clients.length, 40);

    // Pastikan siswa tidak bisa memanggil sesi:mulai
    const studentStartAttempt = await emitWithAck(clients[0].socket, 'sesi:mulai', { sessionId });
    assert.strictEqual(studentStartAttempt.success, false, 'Siswa tidak boleh bisa memulai permainan');

    // 4. Guru memulai permainan & 40 siswa menerima soal awal
    console.log('4. Guru memulai sesi -> memverifikasi 40 siswa menerima soal awal...');
    const firstSoalPromises = clients.map((c) => waitForEvent(c.socket, 'soal:tampil'));
    const startAck = await emitWithAck(hostSocket, 'sesi:mulai', { sessionId });
    assert.strictEqual(startAck.success, true);

    const initialSoals = await Promise.all(firstSoalPromises);
    initialSoals.forEach((s, i) => {
      assert.strictEqual(s.game, 'panjat_pinang');
      assert.ok(s.presentationId, 'Setiap soal harus memiliki presentationId');
      assert.strictEqual(s.pilihan.length, 3);
      clients[i].soalAktif = s;
    });

    // 5. Uji Anti-Cheat (spoofing & duplicate submit) dan Reconnect Recovery
    console.log('5. Menguji anti-spoofing, anti-duplikat, & reconnect recovery...');
    const pTarget = clients[0];
    const spoofAttempt = await emitWithAck(clients[1].socket, 'jawab:kirim', {
      sessionId,
      pesertaId: pTarget.pesertaId,
      pesertaSecret: 'secret-palsu',
      presentationId: pTarget.soalAktif.presentationId,
      questionId: pTarget.soalAktif.questionId,
      choiceId: pTarget.soalAktif.pilihan[0].choiceId,
      jawaban: 'A',
    });
    assert.strictEqual(spoofAttempt.success, false, 'Spoofing identitas pemain lain wajib ditolak');

    // Simulasi putus koneksi & reconnect pada Siswa-01
    pTarget.socket.disconnect();
    const reconnectedSocket = ioClient(baseUrl, { transports: ['websocket'] });
    sockets.push(reconnectedSocket);
    await waitForEvent(reconnectedSocket, 'connect');
    const rejoinRes = await emitWithAck(reconnectedSocket, 'sesi:gabung', {
      token: pinToken,
      nama: pTarget.nama,
      pesertaId: pTarget.pesertaId,
      pesertaSecret: pTarget.pesertaSecret,
    });
    assert.strictEqual(rejoinRes.success, true);
    assert.strictEqual(rejoinRes.isReconnect, true);
    assert.strictEqual(rejoinRes.soalAktif.presentationId, pTarget.soalAktif.presentationId);
    pTarget.socket = reconnectedSocket;

    // Kirim ganda bersamaan pada 1 presentationId (hanya 1 yang boleh berhasil!)
    const kunciC0 = soalKunciMap.get(pTarget.soalAktif.questionId) || 'A';
    const [dup1, dup2] = await Promise.all([
      emitWithAck(pTarget.socket, 'jawab:kirim', {
        sessionId,
        pesertaId: pTarget.pesertaId,
        pesertaSecret: pTarget.pesertaSecret,
        presentationId: pTarget.soalAktif.presentationId,
        questionId: pTarget.soalAktif.questionId,
        choiceId: `${pTarget.soalAktif.questionId}::${kunciC0}`,
        jawaban: kunciC0,
      }),
      emitWithAck(pTarget.socket, 'jawab:kirim', {
        sessionId,
        pesertaId: pTarget.pesertaId,
        pesertaSecret: pTarget.pesertaSecret,
        presentationId: pTarget.soalAktif.presentationId,
        questionId: pTarget.soalAktif.questionId,
        choiceId: `${pTarget.soalAktif.questionId}::${kunciC0}`,
        jawaban: kunciC0,
      }),
    ]);
    assert.strictEqual(Number(dup1.success) + Number(dup2.success), 1, 'Tepat hanya 1 kiriman ganda yang boleh diproses');
    const okDup = dup1.success ? dup1 : dup2;
    assert.strictEqual(okDup.posisiBaru, 25);
    pTarget.posisi = okDup.posisiBaru;

    // 6. Simulasi Siswa-01 mencapai 100% terlebih dahulu sementara 39 siswa lain lanjut bermain
    console.log('6. Menguji 1 pemain mencapai puncak 100% dan permainan tetap berjalan bagi 39 siswa lain...');
    // Masih butuh 3 kali benar (+25%, +25%, +25%+10% -> >=100%)
    for (let step = 0; step < 3; step++) {
      const nextP = waitForEvent(pTarget.socket, 'soal:tampil');
      pTarget.socket.emit('soal:lanjut', {
        sessionId,
        pesertaId: pTarget.pesertaId,
        pesertaSecret: pTarget.pesertaSecret,
      });
      const soalStep = await nextP;
      const key = soalKunciMap.get(soalStep.questionId) || 'A';
      const selesaiPromise = step === 2 ? waitForEvent(pTarget.socket, 'pemain:selesai') : null;
      const ans = await emitWithAck(pTarget.socket, 'jawab:kirim', {
        sessionId,
        pesertaId: pTarget.pesertaId,
        pesertaSecret: pTarget.pesertaSecret,
        presentationId: soalStep.presentationId,
        questionId: soalStep.questionId,
        choiceId: `${soalStep.questionId}::${key}`,
        jawaban: key,
      });
      assert.strictEqual(ans.success, true);
      pTarget.posisi = ans.posisiBaru;
      if (selesaiPromise) {
        const selesaiEvent = await selesaiPromise;
        assert.strictEqual(selesaiEvent.peserta.posisi, 100);
        pTarget.status = 'selesai';
      }
    }
    assert.strictEqual(pTarget.posisi, 100);
    assert.strictEqual(pTarget.status, 'selesai');

    // Siswa yang sudah selesai wajib ditolak bila mencoba kirim jawaban lagi
    const afterFinishAttempt = await emitWithAck(pTarget.socket, 'jawab:kirim', {
      sessionId,
      pesertaId: pTarget.pesertaId,
      pesertaSecret: pTarget.pesertaSecret,
      presentationId: pTarget.soalAktif.presentationId,
      questionId: pTarget.soalAktif.questionId,
      choiceId: `${pTarget.soalAktif.questionId}::A`,
      jawaban: 'A',
    });
    assert.strictEqual(afterFinishAttempt.success, false, 'Pemain selesai 100% tidak boleh menjawab lagi');

    // 7. 39 Pemain sisanya menjawab bersamaan dalam gelombang paralel (uji SQLite write queue & concurrency)
    console.log('7. Menjalankan gelombang jawaban paralel dari 39 siswa tersisa (2 gelombang = 78 jawaban konkuren)...');
    for (let wave = 0; wave < 2; wave++) {
      if (wave === 1) {
        await Promise.all(
          clients.slice(1).map(async (c) => {
            const np = waitForEvent(c.socket, 'soal:tampil');
            c.socket.emit('soal:lanjut', {
              sessionId,
              pesertaId: c.pesertaId,
              pesertaSecret: c.pesertaSecret,
            });
            c.soalAktif = await np;
          })
        );
      }

      const waveResults = await Promise.all(
        clients.slice(1).map(async (c) => {
          const kBenar = soalKunciMap.get(c.soalAktif.questionId) || 'A';
          const jawabBenar = wave === 0 ? c.idx % 2 === 1 : true; // separuh benar, separuh salah di gelombang 1
          const pilihanKey = jawabBenar ? kBenar : kBenar === 'A' ? 'B' : 'A';
          const ack = await emitWithAck(c.socket, 'jawab:kirim', {
            sessionId,
            pesertaId: c.pesertaId,
            pesertaSecret: c.pesertaSecret,
            presentationId: c.soalAktif.presentationId,
            questionId: c.soalAktif.questionId,
            choiceId: `${c.soalAktif.questionId}::${pilihanKey}`,
            jawaban: pilihanKey,
          });
          c.posisi = ack.posisiBaru;
          return ack;
        })
      );
      waveResults.forEach((wr, idx) => {
        assert.strictEqual(wr.success, true, `Jawaban paralel pemain #${idx + 2} gelombang ${wave + 1} harus sukses`);
      });
    }

    // 8. Guru mengakhiri sesi manual -> uji penolakan jawaban terlambat & konsistensi laporan DB
    console.log('8. Guru mengakhiri sesi manual -> verifikasi laporan DB & penolakan jawaban setelah selesai...');
    const sesiSelesaiHostP = waitForEvent(hostSocket, 'sesi:selesai');
    const stopAck = await emitWithAck(hostSocket, 'sesi:akhiri_manual', { sessionId });
    assert.strictEqual(stopAck.success, true);
    const selesaiBroadcast = await sesiSelesaiHostP;
    assert.strictEqual(selesaiBroadcast.hasil.totalPeserta, 40);
    assert.strictEqual(selesaiBroadcast.hasil.leaderboard[0].nama, 'Siswa-01');
    assert.strictEqual(selesaiBroadcast.hasil.leaderboard[0].posisi, 100);
    assert.strictEqual(selesaiBroadcast.hasil.dihentikanManual, true);

    // Kirim jawaban setelah sesi dihentikan manual harus ditolak
    const lateSubmit = await emitWithAck(clients[10].socket, 'jawab:kirim', {
      sessionId,
      pesertaId: clients[10].pesertaId,
      pesertaSecret: clients[10].pesertaSecret,
      presentationId: clients[10].soalAktif.presentationId,
      questionId: clients[10].soalAktif.questionId,
      choiceId: `${clients[10].soalAktif.questionId}::A`,
      jawaban: 'A',
    });
    assert.strictEqual(lateSubmit.success, false, 'Jawaban setelah sesi selesai wajib ditolak');

    // Verifikasi laporan persisten dari REST API (/hasil dan /riwayat/:id)
    const hasilApiRes = await fetch(`${baseUrl}/api/sesi/${sessionId}/hasil`, {
      headers: { Cookie: tokenCookie },
    });
    assert.strictEqual(hasilApiRes.ok, true);
    const hasilApi: any = await hasilApiRes.json();
    assert.strictEqual(hasilApi.hasil.totalPeserta, 40);
    assert.strictEqual(hasilApi.hasil.leaderboard[0].id, clients[0].pesertaId);

    const riwayatDetailRes = await fetch(`${baseUrl}/api/sesi/riwayat/${sessionId}`, {
      headers: { Cookie: tokenCookie },
    });
    assert.strictEqual(riwayatDetailRes.ok, true);
    const riwayatDetail: any = await riwayatDetailRes.json();
    assert.strictEqual(riwayatDetail.detail.game, 'panjat_pinang');
    assert.strictEqual(riwayatDetail.detail.laporanPanjatPinang.totalPeserta, 40);
    assert.strictEqual(riwayatDetail.detail.laporanPanjatPinang.laporanPemain[0].posisiAkhir, 100);

    // 9. Sesi ke-2: Skenario semua pemain mencapai puncak 100% -> otomatis berakhir
    console.log('9. Menguji skenario semua pemain mencapai 100% memicu selesai otomatis...');
    const sesi2Res = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({
        templateId: createdTemplateId,
        game: 'panjat_pinang',
        mode: 'multi',
        panjatPinangConfig: {
          kesulitan: 'custom',
          naikBenar: 50,
          turunSalah: 0,
          bonusStreakAktif: false,
          rintanganAktif: false,
          maxPeserta: 10,
        },
      }),
    });
    const sesi2Data: any = await sesi2Res.json();
    assert.strictEqual(sesi2Res.status, 201);
    const s2Id: string = sesi2Data.session.id;
    const s2Token: string = sesi2Data.session.token;
    createdSessionIds.push(s2Id);

    const host2 = ioClient(baseUrl, { transports: ['websocket'] });
    sockets.push(host2);
    await waitForEvent(host2, 'connect');
    host2.emit('sesi:host_join', { sessionId: s2Id });

    const s2Players = await Promise.all(
      ['Rani', 'Dito'].map(async (nama) => {
        const sc = ioClient(baseUrl, { transports: ['websocket'] });
        sockets.push(sc);
        await waitForEvent(sc, 'connect');
        const joinRes = await emitWithAck(sc, 'sesi:gabung', { token: s2Token, nama });
        return { nama, sc, id: joinRes.pesertaId, secret: joinRes.pesertaSecret };
      })
    );

    const p0Soal1P = waitForEvent(s2Players[0].sc, 'soal:tampil');
    const p1Soal1P = waitForEvent(s2Players[1].sc, 'soal:tampil');
    await emitWithAck(host2, 'sesi:mulai', { sessionId: s2Id });
    const [s0q1, s1q1] = await Promise.all([p0Soal1P, p1Soal1P]);

    // Soal ke-1 (+50%)
    await Promise.all([
      emitWithAck(s2Players[0].sc, 'jawab:kirim', {
        sessionId: s2Id,
        pesertaId: s2Players[0].id,
        pesertaSecret: s2Players[0].secret,
        presentationId: s0q1.presentationId,
        questionId: s0q1.questionId,
        choiceId: `${s0q1.questionId}::${soalKunciMap.get(s0q1.questionId)}`,
        jawaban: soalKunciMap.get(s0q1.questionId),
      }),
      emitWithAck(s2Players[1].sc, 'jawab:kirim', {
        sessionId: s2Id,
        pesertaId: s2Players[1].id,
        pesertaSecret: s2Players[1].secret,
        presentationId: s1q1.presentationId,
        questionId: s1q1.questionId,
        choiceId: `${s1q1.questionId}::${soalKunciMap.get(s1q1.questionId)}`,
        jawaban: soalKunciMap.get(s1q1.questionId),
      }),
    ]);

    // Minta soal ke-2 (+50% -> 100%)
    const p0Soal2P = waitForEvent(s2Players[0].sc, 'soal:tampil');
    const p1Soal2P = waitForEvent(s2Players[1].sc, 'soal:tampil');
    s2Players[0].sc.emit('soal:lanjut', { sessionId: s2Id, pesertaId: s2Players[0].id, pesertaSecret: s2Players[0].secret });
    s2Players[1].sc.emit('soal:lanjut', { sessionId: s2Id, pesertaId: s2Players[1].id, pesertaSecret: s2Players[1].secret });
    const [s0q2, s1q2] = await Promise.all([p0Soal2P, p1Soal2P]);

    const autoEndPromise = waitForEvent(host2, 'sesi:selesai');
    await emitWithAck(s2Players[0].sc, 'jawab:kirim', {
      sessionId: s2Id,
      pesertaId: s2Players[0].id,
      pesertaSecret: s2Players[0].secret,
      presentationId: s0q2.presentationId,
      questionId: s0q2.questionId,
      choiceId: `${s0q2.questionId}::${soalKunciMap.get(s0q2.questionId)}`,
      jawaban: soalKunciMap.get(s0q2.questionId),
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    await emitWithAck(s2Players[1].sc, 'jawab:kirim', {
      sessionId: s2Id,
      pesertaId: s2Players[1].id,
      pesertaSecret: s2Players[1].secret,
      presentationId: s1q2.presentationId,
      questionId: s1q2.questionId,
      choiceId: `${s1q2.questionId}::${soalKunciMap.get(s1q2.questionId)}`,
      jawaban: soalKunciMap.get(s1q2.questionId),
    });

    const autoEndData = await autoEndPromise;
    assert.strictEqual(autoEndData.hasil.dihentikanManual, false);
    assert.strictEqual(autoEndData.hasil.totalSelesai, 2);
    assert.strictEqual(autoEndData.hasil.leaderboard[0].nama, 'Rani');
    console.log('   OK Auto-end saat semua pemain mencapai 100% berhasil diverifikasi!\n');
  } finally {
    sockets.forEach((s) => s.disconnect());
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    // Tunggu antrean penulisan DB selesai lalu bersihkan data uji
    for (const sid of createdSessionIds) {
      await panjatPinangManager.simpanHasilAkhirKeDatabase(sid).catch(() => {});
      await prisma.session.deleteMany({ where: { id: sid } });
    }
    if (createdTemplateId) {
      await prisma.template.deleteMany({ where: { id: createdTemplateId } });
    }
    await prisma.$disconnect();
  }
}

async function main() {
  console.log('\n==============================================================');
  console.log('PENGUJIAN LENGKAP GAME PANJAT PINANG DISCERE');
  console.log('==============================================================\n');
  jalankanUnitTests();
  await jalankanIntegrationDanSimulasi40Pemain();
  console.log('==============================================================');
  console.log('SELURUH UNIT TEST, INTEGRASI REALTIME & SIMULASI 40 PEMAIN LOLOS!');
  console.log('==============================================================\n');
}

main().catch((err) => {
  console.error('\nPENGUJIAN PANJAT PINANG GAGAL:', err);
  process.exit(1);
});
