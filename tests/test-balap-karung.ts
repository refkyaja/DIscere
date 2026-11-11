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
  PRESET_KESULITAN_BALAP_KARUNG,
  TARGET_JARAK_PRESET,
  konfigurasiBalapKarungSchema,
  bangunKonfigurasiBalapKarung,
  buatPresentasiSoalBalap,
  prosesJawabanBalapKarung,
  urutkanLeaderboardBalapKarung,
  PesertaBalapKarungState,
  SoalBalapKarung,
  RngBalapKarung,
} from '../server/src/games/balapKarung.js';
import {
  balapKarungManager,
  siapkanAntreanSoalBalap,
} from '../server/src/games/balapKarungManager.js';

function buatPesertaMock(override: Partial<PesertaBalapKarungState> = {}): PesertaBalapKarungState {
  return {
    id: override.id || crypto.randomUUID(),
    secretToken: crypto.randomUUID(),
    socketId: override.socketId || 'sock-1',
    nama: override.nama || 'Pelari Uji',
    connected: true,
    jarak: 0,
    keseimbangan: 100,
    jumlahJatuh: 0,
    totalBenar: 0,
    totalSalah: 0,
    streakSaatIni: 0,
    streakTertinggi: 0,
    bonus3DalamStreak: false,
    bonus5DalamStreak: false,
    totalBonusStreakKali: 0,
    totalBonusStreakMeter: 0,
    status: 'bermain',
    waktuSelesaiMs: null,
    selesaiPada: null,
    totalWaktuJawabMs: 0,
    jumlahJawab: 0,
    rataRataWaktuJawabMs: 0,
    efekAktif: {
      perisai: false,
      lompatanKuat: false,
      jalanBerlumpur: false,
      ...(override.efekAktif || {}),
    },
    riwayatJarak: [],
    riwayatRintangan: [],
    riwayatJawaban: [],
    antreanSoal: [],
    presentasiAktif: null,
    nomorSoalPemain: 0,
    ...override,
  };
}

const SAMPLE_SOAL: SoalBalapKarung[] = [
  {
    id: 'bk-q-1',
    urutan: 1,
    teks: 'Hasil dari 15 + 25 adalah?',
    opsiA: '35',
    opsiB: '40',
    opsiC: '45',
    jawabanBenar: 'B',
    penjelasan: '15 + 25 = 40',
  },
  {
    id: 'bk-q-2',
    urutan: 2,
    teks: 'Lambang sila ke-1 Pancasila adalah?',
    opsiA: 'Bintang',
    opsiB: 'Rantai',
    opsiC: 'Padi dan Kapas',
    jawabanBenar: 'A',
    penjelasan: 'Bintang melambangkan Ketuhanan Yang Maha Esa.',
  },
  {
    id: 'bk-q-3',
    urutan: 3,
    teks: 'Kemerdekaan RI diproklamasikan tanggal?',
    opsiA: '10 November',
    opsiB: '28 Oktober',
    opsiC: '17 Agustus',
    jawabanBenar: 'C',
    penjelasan: '17 Agustus 1945.',
  },
];

function buatRngPaksa(pemicu: boolean): RngBalapKarung {
  return {
    peluangPercent: () => (pemicu ? 0 : 99),
    rollWeight: () => 0,
  };
}

function jalankanUnitTests() {
  console.log('=== BAGIAN A: UNIT TEST 1–27 LOGIKA BALAP KARUNG CHALLENGE ===\n');

  // Config & Validasi Zod (target jarak, kesulitan, custom, probabilitas rintangan)
  console.log('1. Menguji preset jarak, tingkat kesulitan, custom, dan penolakan Zod tidak valid...');
  assert.strictEqual(TARGET_JARAK_PRESET.pendek, 50);
  assert.strictEqual(TARGET_JARAK_PRESET.normal, 100);
  assert.strictEqual(TARGET_JARAK_PRESET.panjang, 150);

  const cfgPendek = bangunKonfigurasiBalapKarung({ presetJarak: 'pendek', kesulitan: 'mudah' });
  assert.strictEqual(cfgPendek.targetJarak, 50);
  assert.strictEqual(cfgPendek.lompatBenar, PRESET_KESULITAN_BALAP_KARUNG.mudah.lompatBenar);
  assert.strictEqual(cfgPendek.keseimbanganSalah, 10);

  const cfgPanjang = bangunKonfigurasiBalapKarung({ presetJarak: 'panjang', kesulitan: 'sulit' });
  assert.strictEqual(cfgPanjang.targetJarak, 150);
  assert.strictEqual(cfgPanjang.lompatBenar, 7);
  assert.strictEqual(cfgPanjang.turunSalah, 5);
  assert.strictEqual(cfgPanjang.keseimbanganSalah, 25);

  const cfgCustom = bangunKonfigurasiBalapKarung({
    presetJarak: 'custom',
    targetJarak: 80,
    kesulitan: 'custom',
    lompatBenar: 12,
    turunSalah: 4,
    keseimbanganBenar: 8,
    keseimbanganSalah: 30,
    bonusStreak3Jarak: 6,
    bonusStreak5Jarak: 12,
    penurunanJatuhJarak: 6,
    pemulihanJatuhKeseimbangan: 60,
  });
  assert.strictEqual(cfgCustom.targetJarak, 80);
  assert.strictEqual(cfgCustom.lompatBenar, 12);
  assert.strictEqual(cfgCustom.penurunanJatuhJarak, 6);
  assert.ok(Object.isFrozen(cfgCustom), 'Snapshot konfigurasi harus immutable');

  const customWeightValid = konfigurasiBalapKarungSchema.safeParse({
    rintanganAktif: true,
    probabilitasRintangan: { kulit_pisang: 50, perisai: 10, lompatan_kuat: 10, jalan_berlumpur: 10 }, // bobot > 0 tetap valid (dinormalisasi otomatis)
  });
  assert.strictEqual(
    customWeightValid.success,
    true,
    'Bobot rintangan kustom bernilai positif (> 0) harus diterima tanpa wajib berjumlah 100'
  );

  const zeroWeightInvalid = konfigurasiBalapKarungSchema.safeParse({
    rintanganAktif: true,
    probabilitasRintangan: { kulit_pisang: 0, perisai: 0, lompatan_kuat: 0, jalan_berlumpur: 0 },
  });
  assert.strictEqual(
    zeroWeightInvalid.success,
    false,
    'Total bobot rintangan terpilih <= 0 harus ditolak ketika rintangan aktif'
  );
  console.log('   OK Preset jarak, kesulitan, custom snapshot immutable, dan Zod validation lolos');

  // Test 1 & 2 & 8: Jawaban benar (+jarak, +keseimbangan <=100%) & salah (-jarak, -keseimbangan)
  console.log('2. Menguji jawaban benar, jawaban salah, dan batas keseimbangan max 100%...');
  const cfgNormalBersih = bangunKonfigurasiBalapKarung({
    presetJarak: 'normal',
    kesulitan: 'normal',
    bonusStreakAktif: true,
    rintanganAktif: false,
  });

  // 1) Benar pada keseimbangan 98% -> pulih max 100% (tidak > 100%)
  const resBenarMaxBal = prosesJawabanBalapKarung({
    peserta: buatPesertaMock({ jarak: 10, keseimbangan: 98 }),
    presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[0], 1, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::B`,
    config: cfgNormalBersih,
    gameMulaiPadaMs: 0,
    nowMs: 2000,
  });
  assert.strictEqual(resBenarMaxBal.benar, true);
  assert.strictEqual(resBenarMaxBal.jarakBaru, 20);
  assert.strictEqual(resBenarMaxBal.keseimbanganBaru, 100, 'Keseimbangan tidak boleh > 100%');

  // 2) Salah -> jarak -3m, keseimbangan -20%
  const resSalah = prosesJawabanBalapKarung({
    peserta: buatPesertaMock({ jarak: 20, keseimbangan: 80 }),
    presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[0], 2, 2000),
    choiceId: `${SAMPLE_SOAL[0].id}::A`,
    config: cfgNormalBersih,
    gameMulaiPadaMs: 0,
    nowMs: 3000,
  });
  assert.strictEqual(resSalah.benar, false);
  assert.strictEqual(resSalah.jarakBaru, 17);
  assert.strictEqual(resSalah.keseimbanganBaru, 60);
  console.log('   OK Benar, salah, dan batas maksimal keseimbangan 100% akurat');

  // Test 3, 4, 5: Bonus Streak 3 (+5m, +10% bal), Streak 5 (+10m), tidak dobel, reset saat salah
  console.log('3. Menguji bonus streak 3, bonus streak 5, 1x milestone, & reset setelah salah...');
  let pSt = buatPesertaMock({ jarak: 0, keseimbangan: 50 });
  const jarakSteps: number[] = [];
  const balBonusSteps: number[] = [];
  for (let i = 0; i < 6; i++) {
    const s = SAMPLE_SOAL[i % SAMPLE_SOAL.length];
    const pres = buatPresentasiSoalBalap(s, i + 1, i * 1000);
    const res = prosesJawabanBalapKarung({
      peserta: pSt,
      presentasi: pres,
      choiceId: `${s.id}::${s.jawabanBenar}`,
      config: cfgNormalBersih,
      gameMulaiPadaMs: 0,
      nowMs: i * 1000 + 400,
    });
    jarakSteps.push(res.perubahanJarak);
    balBonusSteps.push(res.bonusStreakKeseimbanganDidapat);
    pSt = res.pesertaUpdated;
  }
  // Langkah: 1:+10, 2:+10, 3:+15 (streak3), 4:+10, 5:+20 (streak5), 6:+10
  assert.deepStrictEqual(jarakSteps, [10, 10, 15, 10, 20, 10]);
  assert.deepStrictEqual(balBonusSteps, [0, 0, 10, 0, 0, 0]);
  assert.strictEqual(pSt.totalBonusStreakKali, 2);
  assert.strictEqual(pSt.totalBonusStreakMeter, 15);
  assert.strictEqual(pSt.streakSaatIni, 6);

  // Salah 1x -> streak kembali 0, lalu bisa dapat bonus streak 3 lagi!
  const resReset = prosesJawabanBalapKarung({
    peserta: pSt,
    presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[0], 7, 7000),
    choiceId: `${SAMPLE_SOAL[0].id}::A`,
    config: cfgNormalBersih,
    gameMulaiPadaMs: 0,
    nowMs: 7500,
  });
  assert.strictEqual(resReset.pesertaUpdated.streakSaatIni, 0);
  pSt = resReset.pesertaUpdated;

  for (let i = 0; i < 3; i++) {
    const s = SAMPLE_SOAL[i];
    const res = prosesJawabanBalapKarung({
      peserta: pSt,
      presentasi: buatPresentasiSoalBalap(s, 8 + i, 8000 + i * 1000),
      choiceId: `${s.id}::${s.jawabanBenar}`,
      config: cfgNormalBersih,
      gameMulaiPadaMs: 0,
      nowMs: 8500 + i * 1000,
    });
    pSt = res.pesertaUpdated;
    if (i === 2) {
      assert.strictEqual(res.bonusStreakJarakDidapat, 5, 'Streak baru setelah salah harus dapat bonus streak lagi');
    }
  }
  console.log('   OK Streak 3, Streak 5, reset saat salah, & tidak mengulang milestone beruntun lolos');

  // Test 6, 7, 18, 19: Batas jarak min 0m, max targetJarak, finis & tolak jawaban setelah finis
  console.log('4. Menguji batas jarak [0m, target], status finis, dan penolakan setelah finis...');
  const resMin0 = prosesJawabanBalapKarung({
    peserta: buatPesertaMock({ jarak: 1, keseimbangan: 80 }),
    presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[0], 1, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::A`,
    config: cfgNormalBersih,
    gameMulaiPadaMs: 0,
    nowMs: 1500,
  });
  assert.strictEqual(resMin0.jarakBaru, 0, 'Jarak tidak boleh kurang dari 0 meter');

  const resFinis = prosesJawabanBalapKarung({
    peserta: buatPesertaMock({ jarak: 96, keseimbangan: 80 }),
    presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[0], 1, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::B`,
    config: cfgNormalBersih,
    gameMulaiPadaMs: 0,
    nowMs: 2800,
  });
  assert.strictEqual(resFinis.jarakBaru, 106, '96m + 10m = 106m (melewati garis target 100m apa adanya)');
  assert.strictEqual(resFinis.perubahanJarak, 10, 'Perubahan jarak tetap penuh +10m walau melewati target');
  assert.strictEqual(resFinis.selesaiBaru, true);
  assert.strictEqual(resFinis.pesertaUpdated.status, 'selesai');
  assert.strictEqual(resFinis.pesertaUpdated.waktuSelesaiMs, 2800);

  assert.throws(
    () =>
      prosesJawabanBalapKarung({
        peserta: resFinis.pesertaUpdated,
        presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[1], 2, 3000),
        choiceId: `${SAMPLE_SOAL[1].id}::A`,
        config: cfgNormalBersih,
        gameMulaiPadaMs: 0,
        nowMs: 3500,
      }),
    /garis finis/i
  );
  console.log('   OK Batas min 0m, lolos overshoot melewati target, & penolakan setelah finis akurat');

  // Test 9, 10, 11, 12, 13: Keseimbangan min 0%, jatuh (jarak -5m, pulih 50%, contoh 35m/15%->30m/50%), Perisai menahan jatuh!
  console.log('5. Menguji mekanisme jatuh keseimbangan 0%, pemulihan 50%, & perlindungan Perisai...');
  // Contoh dari spesifikasi: 35m & 15% (misal custom turunSalah=0 agar tepat menguji penalti jatuh -5m => 30m!)
  const cfgJatuhExact = bangunKonfigurasiBalapKarung({
    presetJarak: 'normal',
    kesulitan: 'custom',
    lompatBenar: 10,
    turunSalah: 0,
    keseimbanganBenar: 5,
    keseimbanganSalah: 20,
    penurunanJatuhJarak: 5,
    pemulihanJatuhKeseimbangan: 50,
    rintanganAktif: false,
  });
  const resJatuh = prosesJawabanBalapKarung({
    peserta: buatPesertaMock({ jarak: 35, keseimbangan: 15 }),
    presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[0], 1, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::A`, // salah
    config: cfgJatuhExact,
    gameMulaiPadaMs: 0,
    nowMs: 1800,
  });
  assert.strictEqual(resJatuh.terjatuh, true);
  assert.strictEqual(resJatuh.jarakBaru, 30, '35m dikurangi 5m akibat jatuh harus menjadi 30m');
  assert.strictEqual(resJatuh.keseimbanganBaru, 50, 'Keseimbangan harus pulih ke 50% setelah jatuh');
  assert.strictEqual(resJatuh.pesertaUpdated.jumlahJatuh, 1);

  // Jatuh di jarak < 5m (misal 2m) tidak boleh minus
  const resJatuhDekatNol = prosesJawabanBalapKarung({
    peserta: buatPesertaMock({ jarak: 2, keseimbangan: 10 }),
    presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[0], 1, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::A`,
    config: cfgNormalBersih,
    gameMulaiPadaMs: 0,
    nowMs: 1800,
  });
  assert.strictEqual(resJatuhDekatNol.terjatuh, true);
  assert.strictEqual(resJatuhDekatNol.jarakBaru, 0);
  assert.strictEqual(resJatuhDekatNol.keseimbanganBaru, 50);

  // Perisai aktif melindungi 1x kejadian jatuh (jarak tidak dikurangi akibat jatuh, keseimbangan pulih 50%, perisai terpakai habis)
  const resPerisaiTahan = prosesJawabanBalapKarung({
    peserta: buatPesertaMock({
      jarak: 40,
      keseimbangan: 15,
      efekAktif: { perisai: true, lompatanKuat: false, jalanBerlumpur: false },
    }),
    presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[0], 1, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::A`,
    config: cfgJatuhExact,
    gameMulaiPadaMs: 0,
    nowMs: 1800,
  });
  assert.strictEqual(resPerisaiTahan.terjatuh, true);
  assert.strictEqual(resPerisaiTahan.perisaiDigunakan, true);
  assert.strictEqual(resPerisaiTahan.penaltiJatuhJarak, 0);
  assert.strictEqual(resPerisaiTahan.jarakBaru, 40, 'Perisai harus melindungi jarak agar tidak berkurang akibat jatuh');
  assert.strictEqual(resPerisaiTahan.keseimbanganBaru, 50);
  assert.strictEqual(resPerisaiTahan.pesertaUpdated.efekAktif.perisai, false, 'Perisai hanya dapat digunakan 1 kali');
  console.log('   OK Jatuh, pengurangan jarak, batas >= 0m, pemulihan 50%, & Perisai lolos');

  // Test 14, 15, 16, 17: Semua 4 rintangan & toggle rintangan nonaktif
  console.log('6. Menguji 4 rintangan (Kulit Pisang, Perisai, Lompatan Kuat, Jalan Berlumpur) & toggle off...');
  // 17) Rintangan nonaktif meski RNG dipaksa trigger
  const resNoRintangan = prosesJawabanBalapKarung({
    peserta: buatPesertaMock({ jarak: 20, keseimbangan: 80 }),
    presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[0], 1, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::B`,
    config: cfgNormalBersih,
    gameMulaiPadaMs: 0,
    nowMs: 1500,
    rngRintangan: buatRngPaksa(true),
  });
  assert.strictEqual(resNoRintangan.rintanganBaru, null);

  // 14) Kulit Pisang mengurangi keseimbangan 15% & bila mencapai 0% memicu jatuh sekali!
  const cfgPisang = bangunKonfigurasiBalapKarung({
    rintanganAktif: true,
    rintanganDipilih: ['kulit_pisang'],
    probabilitasRintangan: { kulit_pisang: 100, perisai: 0, lompatan_kuat: 0, jalan_berlumpur: 0 },
  });
  const resPisang = prosesJawabanBalapKarung({
    peserta: buatPesertaMock({ jarak: 20, keseimbangan: 80 }),
    presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[0], 1, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::B`, // +5% -> 85%, lalu kulit pisang -15% -> 70%
    config: cfgPisang,
    gameMulaiPadaMs: 0,
    nowMs: 1500,
    rngRintangan: buatRngPaksa(true),
  });
  assert.strictEqual(resPisang.rintanganBaru?.tipe, 'kulit_pisang');
  assert.strictEqual(resPisang.keseimbanganBaru, 70);

  // Kulit Pisang menyentuh 0% -> jatuh sekali + pulih 50% (tidak negatif!)
  const resPisangJatuh = prosesJawabanBalapKarung({
    peserta: buatPesertaMock({ jarak: 30, keseimbangan: 10 }),
    presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[0], 1, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::B`, // jarak 40m, keseimbangan +5% = 15%, lalu -15% = 0% => jatuh -5m -> 35m & pulih 50%
    config: cfgPisang,
    gameMulaiPadaMs: 0,
    nowMs: 1500,
    rngRintangan: buatRngPaksa(true),
  });
  assert.strictEqual(resPisangJatuh.terjatuh, true);
  assert.strictEqual(resPisangJatuh.jarakBaru, 35);
  assert.strictEqual(resPisangJatuh.keseimbanganBaru, 50);

  // 15) Lompatan Kuat +5m pada lompatan benar berikutnya lalu terhapus
  const resLompatKuat = prosesJawabanBalapKarung({
    peserta: buatPesertaMock({
      jarak: 20,
      efekAktif: { perisai: false, lompatanKuat: true, jalanBerlumpur: false },
    }),
    presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[0], 1, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::B`, // +10m + 5m = 35m
    config: cfgNormalBersih,
    gameMulaiPadaMs: 0,
    nowMs: 1500,
  });
  assert.strictEqual(resLompatKuat.bonusLompatanKuatDidapat, 5);
  assert.strictEqual(resLompatKuat.jarakBaru, 35);
  assert.strictEqual(resLompatKuat.pesertaUpdated.efekAktif.lompatanKuat, false);

  // 16) Jalan Berlumpur mengurangi -5m pada lompatan benar berikutnya, lalu terhapus, & clamp >= 0m
  const resLumpur = prosesJawabanBalapKarung({
    peserta: buatPesertaMock({
      jarak: 20,
      efekAktif: { perisai: false, lompatanKuat: false, jalanBerlumpur: true },
    }),
    presentasi: buatPresentasiSoalBalap(SAMPLE_SOAL[0], 1, 1000),
    choiceId: `${SAMPLE_SOAL[0].id}::B`, // +10m - 5m = +5m => 25m
    config: cfgNormalBersih,
    gameMulaiPadaMs: 0,
    nowMs: 1500,
  });
  assert.strictEqual(resLumpur.penaltiJalanBerlumpurDipakai, 5);
  assert.strictEqual(resLumpur.jarakBaru, 25);
  assert.strictEqual(resLumpur.pesertaUpdated.efekAktif.jalanBerlumpur, false);
  console.log('   OK Semua 4 rintangan, clamping non-negatif, & toggle off terverifikasi');

  // Test 20 & 21: Pertanyaan diacak, diulang tanpa repeat beruntun, dan validasi choiceId meski urutan diacak
  console.log('7. Menguji reshuffle antrean soal, anti-repeat beruntun, & validasi choiceId acak...');
  let lastQId: string | undefined;
  for (let i = 0; i < 50; i++) {
    const q = siapkanAntreanSoalBalap(SAMPLE_SOAL, lastQId);
    assert.strictEqual(q.length, SAMPLE_SOAL.length);
    if (lastQId) {
      assert.notStrictEqual(q[0], lastQId, 'Soal awal siklus baru tidak boleh sama berturut-turut dengan soal terakhir');
    }
    lastQId = q[q.length - 1];
  }
  const presShuffle = buatPresentasiSoalBalap(SAMPLE_SOAL[0], 1, 1000);
  presShuffle.pilihan = [presShuffle.pilihan[2], presShuffle.pilihan[0], presShuffle.pilihan[1]];
  const resShuffle = prosesJawabanBalapKarung({
    peserta: buatPesertaMock({ jarak: 0 }),
    presentasi: presShuffle,
    choiceId: `${SAMPLE_SOAL[0].id}::B`,
    config: cfgNormalBersih,
    gameMulaiPadaMs: 0,
    nowMs: 1500,
  });
  assert.strictEqual(resShuffle.benar, true);
  console.log('   OK 50 siklus reshuffle bebas repeat & validasi choiceId konsisten');

  // Test 27: Leaderboard 5 kriteria
  console.log('8. Menguji urutan leaderboard 5 kriteria Balap Karung...');
  const lb = urutkanLeaderboardBalapKarung(
    [
      buatPesertaMock({ id: '5', nama: 'Eko', status: 'bermain', jarak: 60, totalBenar: 6, jumlahJawab: 8, rataRataWaktuJawabMs: 2500 }),
      buatPesertaMock({ id: '4', nama: 'Dina', status: 'bermain', jarak: 60, totalBenar: 6, jumlahJawab: 8, rataRataWaktuJawabMs: 1400 }),
      buatPesertaMock({ id: '3', nama: 'Citra', status: 'bermain', jarak: 60, totalBenar: 7, jumlahJawab: 8, rataRataWaktuJawabMs: 3200 }),
      buatPesertaMock({ id: '2', nama: 'Budi', status: 'selesai', jarak: 100, waktuSelesaiMs: 42000, totalBenar: 10, jumlahJawab: 11, rataRataWaktuJawabMs: 1800 }),
      buatPesertaMock({ id: '1', nama: 'Ani', status: 'selesai', jarak: 100, waktuSelesaiMs: 30000, totalBenar: 10, jumlahJawab: 12, rataRataWaktuJawabMs: 2400 }),
    ],
    100
  );
  assert.deepStrictEqual(lb.map((p) => p.nama), ['Ani', 'Budi', 'Citra', 'Dina', 'Eko']);
  console.log('   OK Peringkat 5 kriteria akurat\n');
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
  console.log('=== BAGIAN B: INTEGRASI REALTIME, ISOLASI, JATUH, & SIMULASI 40 PELARI ===\n');

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

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  let createdTemplateId: string | null = null;
  const createdSessionIds: string[] = [];
  const sockets: ClientSocket[] = [];

  try {
    // 1. Login guru & buat template Balap Karung
    console.log('1. Login guru & membuat template Balap Karung uji...');
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
    const tokenCookie = cookieHeader.split(';')[0];

    const tmplRes = await fetch(`${baseUrl}/api/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({
        judul: `Uji Balap Karung 40 Pelari ${Date.now()}`,
        game: 'balap_karung',
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
    assert.strictEqual(tmplRes.status, 201);
    createdTemplateId = tmplData.template.id;
    const soalKunciMap = new Map<string, string>();
    for (const q of tmplData.template.questions) {
      soalKunciMap.set(q.id, q.jawabanBenar);
    }

    // 2. Buat Sesi 1 (40 pemain, target 100m, keseimbanganSalah 50% agar mudah uji event jatuh real-time!)
    console.log('2. Guru membuat Sesi 1 (40 pelari, target 100m) dan Sesi 2 (uji isolasi)...');
    const s1Res = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({
        templateId: createdTemplateId,
        game: 'balap_karung',
        mode: 'multi',
        balapKarungConfig: {
          presetJarak: 'custom',
          targetJarak: 100,
          kesulitan: 'custom',
          lompatBenar: 25,
          turunSalah: 3,
          keseimbanganBenar: 5,
          keseimbanganSalah: 50,
          bonusStreak3Jarak: 10,
          bonusStreak5Jarak: 15,
          bonusStreak3Keseimbangan: 10,
          penurunanJatuhJarak: 5,
          pemulihanJatuhKeseimbangan: 50,
          rintanganAktif: false,
          maxPeserta: 50,
        },
      }),
    });
    const s1Data: any = await s1Res.json();
    assert.strictEqual(s1Res.status, 201);
    const s1Id: string = s1Data.session.id;
    const s1Token: string = s1Data.session.token;
    createdSessionIds.push(s1Id);

    // Buat Sesi 2 terpisah untuk uji Test #24 (event sesi lain tidak memengaruhi pemain)
    const s2Res = await fetch(`${baseUrl}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie },
      body: JSON.stringify({
        templateId: createdTemplateId,
        game: 'balap_karung',
        mode: 'multi',
        balapKarungConfig: {
          presetJarak: 'pendek',
          kesulitan: 'custom',
          lompatBenar: 25,
          turunSalah: 0,
          keseimbanganAktif: true,
          rintanganAktif: false,
          maxPeserta: 10,
        },
      }),
    });
    const s2Data: any = await s2Res.json();
    assert.strictEqual(s2Res.status, 201);
    const s2Id: string = s2Data.session.id;
    const s2Token: string = s2Data.session.token;
    createdSessionIds.push(s2Id);

    // Verifikasi token check publik
    const tokRes = await fetch(`${baseUrl}/api/sesi/token/${s1Token}`);
    const tokJson: any = await tokRes.json();
    assert.strictEqual(tokJson.valid, true);
    assert.strictEqual(tokJson.game, 'balap_karung');

    // 3. Hubungkan Host & 40 pelari ke Sesi 1
    console.log('3. Menghubungkan Host & 40 pelari bersamaan ke Socket.IO...');
    const host1 = ioClient(baseUrl, {
      transports: ['websocket'],
      extraHeaders: { cookie: tokenCookie },
    });
    sockets.push(host1);
    await waitForEvent(host1, 'connect');
    host1.emit('sesi:host_join', { sessionId: s1Id });

    interface PelariClient {
      idx: number;
      nama: string;
      socket: ClientSocket;
      pesertaId: string;
      pesertaSecret: string;
      soalAktif: any;
    }

    const pelariList: PelariClient[] = [];
    await Promise.all(
      Array.from({ length: 40 }, async (_, idx) => {
        const sc = ioClient(baseUrl, { transports: ['websocket'] });
        sockets.push(sc);
        await waitForEvent(sc, 'connect');
        const nama = `Pelari-${String(idx + 1).padStart(2, '0')}`;
        const jRes = await emitWithAck(sc, 'sesi:gabung', { token: s1Token, nama });
        assert.strictEqual(jRes.success, true, `${nama} gagal gabung: ${jRes.pesan}`);
        assert.strictEqual(jRes.game, 'balap_karung');
        pelariList.push({
          idx,
          nama,
          socket: sc,
          pesertaId: jRes.pesertaId,
          pesertaSecret: jRes.pesertaSecret,
          soalAktif: null,
        });
      })
    );
    pelariList.sort((a, b) => a.idx - b.idx);
    assert.strictEqual(pelariList.length, 40);

    // 4. Mulai Sesi 1
    console.log('4. Guru memulai Sesi 1 -> 40 pelari menerima soal pertama...');
    const firstSoalP = pelariList.map((p) => waitForEvent(p.socket, 'soal:tampil'));
    const startAck = await emitWithAck(host1, 'sesi:mulai', { sessionId: s1Id });
    assert.strictEqual(startAck.success, true);
    const firstSoals = await Promise.all(firstSoalP);
    firstSoals.forEach((s, idx) => {
      assert.strictEqual(s.game, 'balap_karung');
      pelariList[idx].soalAktif = s;
    });

    // 5. Test #22 & #23 & #24: Reconnect tanpa kehilangan progres, anti-duplikat, & isolasi sesi lain
    console.log('5. Menguji reconnect recovery, penolakan duplikat, & isolasi antar sesi...');
    const p0 = pelariList[0];
    const k0 = soalKunciMap.get(p0.soalAktif.questionId) || 'A';

    // Kirim ganda paralel untuk presentationId yang sama -> hanya 1 boleh sukses!
    const [dup1, dup2] = await Promise.all([
      emitWithAck(p0.socket, 'jawab:kirim', {
        sessionId: s1Id,
        pesertaId: p0.pesertaId,
        pesertaSecret: p0.pesertaSecret,
        presentationId: p0.soalAktif.presentationId,
        questionId: p0.soalAktif.questionId,
        choiceId: `${p0.soalAktif.questionId}::${k0}`,
        jawaban: k0,
      }),
      emitWithAck(p0.socket, 'jawab:kirim', {
        sessionId: s1Id,
        pesertaId: p0.pesertaId,
        pesertaSecret: p0.pesertaSecret,
        presentationId: p0.soalAktif.presentationId,
        questionId: p0.soalAktif.questionId,
        choiceId: `${p0.soalAktif.questionId}::${k0}`,
        jawaban: k0,
      }),
    ]);
    assert.strictEqual(Number(dup1.success) + Number(dup2.success), 1, 'Jawaban ganda wajib ditolak');
    const resP0 = dup1.success ? dup1 : dup2;
    assert.strictEqual(resP0.jarakBaru, 25);

    // Reconnect p0 -> jarak 25m harus bertahan!
    p0.socket.disconnect();
    const recSocket = ioClient(baseUrl, { transports: ['websocket'] });
    sockets.push(recSocket);
    await waitForEvent(recSocket, 'connect');
    const recAck = await emitWithAck(recSocket, 'sesi:gabung', {
      token: s1Token,
      nama: p0.nama,
      pesertaId: p0.pesertaId,
      pesertaSecret: p0.pesertaSecret,
    });
    assert.strictEqual(recAck.success, true);
    assert.strictEqual(recAck.isReconnect, true);
    assert.strictEqual(recAck.peserta.jarak, 25, 'Progres jarak harus utuh setelah reconnect');
    p0.socket = recSocket;
    p0.soalAktif = recAck.soalAktif;

    // Cross-session isolation (#24): Pelari dari Sesi 2 mencoba kirim ke Sesi 1 / Sesi 1 ke Sesi 2 -> wajib ditolak!
    const crossSock = ioClient(baseUrl, { transports: ['websocket'] });
    sockets.push(crossSock);
    await waitForEvent(crossSock, 'connect');
    const s2Join = await emitWithAck(crossSock, 'sesi:gabung', { token: s2Token, nama: 'TamuSesi2' });
    const crossAttempt = await emitWithAck(crossSock, 'jawab:kirim', {
      sessionId: s1Id,
      pesertaId: s2Join.pesertaId,
      pesertaSecret: s2Join.pesertaSecret,
      presentationId: p0.soalAktif.presentationId,
      questionId: p0.soalAktif.questionId,
      choiceId: `${p0.soalAktif.questionId}::A`,
      jawaban: 'A',
    });
    assert.strictEqual(crossAttempt.success, false, 'Event dari sesi lain tidak boleh memengaruhi sesi aktif');

    // 6. Test mekanisme jatuh via real Socket.IO (`pemain:jatuh`) pada Pelari-02 (index 1)
    console.log('6. Menguji kejadian jatuh real-time & event socket pemain:jatuh...');
    const p1 = pelariList[1];
    // Pertama: jawab benar (+25m) lalu salah 2x (-50% x2 = 0%) => harus memicu event 'pemain:jatuh' dan kurangi -5m + pulih 50%!
    const k1 = soalKunciMap.get(p1.soalAktif.questionId) || 'A';
    await emitWithAck(p1.socket, 'jawab:kirim', {
      sessionId: s1Id,
      pesertaId: p1.pesertaId,
      pesertaSecret: p1.pesertaSecret,
      presentationId: p1.soalAktif.presentationId,
      questionId: p1.soalAktif.questionId,
      choiceId: `${p1.soalAktif.questionId}::${k1}`,
      jawaban: k1,
    }); // jarak 25m, keseimbangan 100%

    for (let w = 0; w < 2; w++) {
      const nextP = waitForEvent(p1.socket, 'soal:tampil');
      p1.socket.emit('soal:lanjut', { sessionId: s1Id, pesertaId: p1.pesertaId, pesertaSecret: p1.pesertaSecret });
      const sWrong = await nextP;
      const rightKey = soalKunciMap.get(sWrong.questionId) || 'A';
      const wrongKey = rightKey === 'A' ? 'B' : 'A';
      const jatuhP = w === 1 ? waitForEvent(p1.socket, 'pemain:jatuh') : null;
      const ansW = await emitWithAck(p1.socket, 'jawab:kirim', {
        sessionId: s1Id,
        pesertaId: p1.pesertaId,
        pesertaSecret: p1.pesertaSecret,
        presentationId: sWrong.presentationId,
        questionId: sWrong.questionId,
        choiceId: `${sWrong.questionId}::${wrongKey}`,
        jawaban: wrongKey,
      });
      if (w === 1 && jatuhP) {
        const jatuhEvt = await jatuhP;
        assert.strictEqual(ansW.terjatuh, true);
        assert.strictEqual(jatuhEvt.keseimbanganBaru, 50, 'Keseimbangan harus pulih 50% pada event jatuh');
        assert.strictEqual(jatuhEvt.jarakBaru, 14, '25m - 3m - 3m - 5m (jatuh) = 14m');
      }
    }

    // 7. Test p0 mencapai finis 100m & menolak pertanyaan baru (#18, #19) sementara 38 pelari lain menjawab paralel!
    console.log('7. Pelari-01 mencapai finis 100m sementara 38 pelari lain berlomba paralel...');
    for (let step = 0; step < 3; step++) {
      // p0 baru punya 1 soal benar (25m). 3 benar lagi (+25, +25+10, +25) mencapai 100m!
      const sNext = step === 0 ? p0.soalAktif : await (async () => {
        const pr = waitForEvent(p0.socket, 'soal:tampil');
        p0.socket.emit('soal:lanjut', { sessionId: s1Id, pesertaId: p0.pesertaId, pesertaSecret: p0.pesertaSecret });
        return pr;
      })();
      const k = soalKunciMap.get(sNext.questionId) || 'A';
      const finP = step === 2 ? waitForEvent(p0.socket, 'pemain:selesai') : null;
      const ack = await emitWithAck(p0.socket, 'jawab:kirim', {
        sessionId: s1Id,
        pesertaId: p0.pesertaId,
        pesertaSecret: p0.pesertaSecret,
        presentationId: sNext.presentationId,
        questionId: sNext.questionId,
        choiceId: `${sNext.questionId}::${k}`,
        jawaban: k,
      });
      assert.strictEqual(ack.success, true);
      if (finP) {
        const fEvt = await finP;
        assert.strictEqual(fEvt.peserta.jarak, 100);
        assert.strictEqual(fEvt.peserta.status, 'selesai');
      }
    }
    const postFinReject = await emitWithAck(p0.socket, 'jawab:kirim', {
      sessionId: s1Id,
      pesertaId: p0.pesertaId,
      pesertaSecret: p0.pesertaSecret,
      presentationId: p0.soalAktif.presentationId,
      questionId: p0.soalAktif.questionId,
      choiceId: `${p0.soalAktif.questionId}::A`,
      jawaban: 'A',
    });
    assert.strictEqual(postFinReject.success, false, 'Pemain yang finis wajib ditolak saat mengirim jawaban lagi');

    // Gelombang paralel 38 pelari tersisa (indeks 2..39)
    await Promise.all(
      pelariList.slice(2).map(async (pl) => {
        const k = soalKunciMap.get(pl.soalAktif.questionId) || 'A';
        const r = await emitWithAck(pl.socket, 'jawab:kirim', {
          sessionId: s1Id,
          pesertaId: pl.pesertaId,
          pesertaSecret: pl.pesertaSecret,
          presentationId: pl.soalAktif.presentationId,
          questionId: pl.soalAktif.questionId,
          choiceId: `${pl.soalAktif.questionId}::${k}`,
          jawaban: k,
        });
        assert.strictEqual(r.success, true);
      })
    );

    // 8. Guru menghentikan Sesi 1 secara manual (#25) -> cek DB persistence (/hasil & /riwayat/:id)
    console.log('8. Guru mengakhiri Sesi 1 manual -> cek penolakan jawaban terlambat & laporan DB...');
    const hostEndP = waitForEvent(host1, 'sesi:selesai');
    const stopAck = await emitWithAck(host1, 'sesi:akhiri_manual', { sessionId: s1Id });
    assert.strictEqual(stopAck.success, true);
    const endData = await hostEndP;
    assert.strictEqual(endData.hasil.totalPeserta, 40);
    assert.strictEqual(endData.hasil.leaderboard[0].nama, 'Pelari-01');
    assert.strictEqual(endData.hasil.dihentikanManual, true);

    const lateAns = await emitWithAck(pelariList[15].socket, 'jawab:kirim', {
      sessionId: s1Id,
      pesertaId: pelariList[15].pesertaId,
      pesertaSecret: pelariList[15].pesertaSecret,
      presentationId: pelariList[15].soalAktif.presentationId,
      questionId: pelariList[15].soalAktif.questionId,
      choiceId: `${pelariList[15].soalAktif.questionId}::A`,
      jawaban: 'A',
    });
    assert.strictEqual(lateAns.success, false, 'Jawaban setelah sesi berakhir wajib ditolak');

    const hasilApiRes = await fetch(`${baseUrl}/api/sesi/${s1Id}/hasil`, {
      headers: { Cookie: tokenCookie },
    });
    assert.strictEqual(hasilApiRes.ok, true);
    const hasilApi: any = await hasilApiRes.json();
    assert.strictEqual(hasilApi.hasil.totalPeserta, 40);
    assert.strictEqual(hasilApi.hasil.laporanPemain[1].jumlahJatuh >= 0, true);

    const riwayatApiRes = await fetch(`${baseUrl}/api/sesi/riwayat/${s1Id}`, {
      headers: { Cookie: tokenCookie },
    });
    assert.strictEqual(riwayatApiRes.ok, true);
    const riwayatApi: any = await riwayatApiRes.json();
    assert.strictEqual(riwayatApi.detail.game, 'balap_karung');
    assert.strictEqual(riwayatApi.detail.laporanBalapKarung.totalPeserta, 40);

    // 9. Sesi 2: Semua pelari finis -> Sesi otomatis berakhir (#26)
    console.log('9. Menguji Sesi 2 berakhir otomatis ketika semua pelari mencapai garis finis 50m...');
    const host2 = ioClient(baseUrl, {
      transports: ['websocket'],
      extraHeaders: { cookie: tokenCookie },
    });
    const pS2 = ioClient(baseUrl, { transports: ['websocket'] });
    sockets.push(host2, pS2);
    await Promise.all([waitForEvent(host2, 'connect'), waitForEvent(pS2, 'connect')]);
    host2.emit('sesi:host_join', { sessionId: s2Id });

    const joinB = await emitWithAck(pS2, 'sesi:gabung', { token: s2Token, nama: 'PelariCepat2' });
    // crossSock sudah gabung sebagai 'TamuSesi2' di awal
    const qAP = waitForEvent(crossSock, 'soal:tampil');
    const qBP = waitForEvent(pS2, 'soal:tampil');
    await emitWithAck(host2, 'sesi:mulai', { sessionId: s2Id });
    const [qA1, qB1] = await Promise.all([qAP, qBP]);

    // Soal ke-1 (+25m)
    await Promise.all([
      emitWithAck(crossSock, 'jawab:kirim', {
        sessionId: s2Id,
        pesertaId: s2Join.pesertaId,
        pesertaSecret: s2Join.pesertaSecret,
        presentationId: qA1.presentationId,
        questionId: qA1.questionId,
        choiceId: `${qA1.questionId}::${soalKunciMap.get(qA1.questionId)}`,
        jawaban: soalKunciMap.get(qA1.questionId),
      }),
      emitWithAck(pS2, 'jawab:kirim', {
        sessionId: s2Id,
        pesertaId: joinB.pesertaId,
        pesertaSecret: joinB.pesertaSecret,
        presentationId: qB1.presentationId,
        questionId: qB1.questionId,
        choiceId: `${qB1.questionId}::${soalKunciMap.get(qB1.questionId)}`,
        jawaban: soalKunciMap.get(qB1.questionId),
      }),
    ]);

    // Soal ke-2 (+25m -> tepat 50m finis semua -> auto end!)
    const qA2P = waitForEvent(crossSock, 'soal:tampil');
    const qB2P = waitForEvent(pS2, 'soal:tampil');
    crossSock.emit('soal:lanjut', { sessionId: s2Id, pesertaId: s2Join.pesertaId, pesertaSecret: s2Join.pesertaSecret });
    pS2.emit('soal:lanjut', { sessionId: s2Id, pesertaId: joinB.pesertaId, pesertaSecret: joinB.pesertaSecret });
    const [qA2, qB2] = await Promise.all([qA2P, qB2P]);

    const autoEndP = waitForEvent(host2, 'sesi:selesai');
    await emitWithAck(crossSock, 'jawab:kirim', {
      sessionId: s2Id,
      pesertaId: s2Join.pesertaId,
      pesertaSecret: s2Join.pesertaSecret,
      presentationId: qA2.presentationId,
      questionId: qA2.questionId,
      choiceId: `${qA2.questionId}::${soalKunciMap.get(qA2.questionId)}`,
      jawaban: soalKunciMap.get(qA2.questionId),
    });
    await emitWithAck(pS2, 'jawab:kirim', {
      sessionId: s2Id,
      pesertaId: joinB.pesertaId,
      pesertaSecret: joinB.pesertaSecret,
      presentationId: qB2.presentationId,
      questionId: qB2.questionId,
      choiceId: `${qB2.questionId}::${soalKunciMap.get(qB2.questionId)}`,
      jawaban: soalKunciMap.get(qB2.questionId),
    });

    const autoEnd = await autoEndP;
    assert.strictEqual(autoEnd.hasil.dihentikanManual, false);
    assert.strictEqual(autoEnd.hasil.totalSelesai, 2);
    console.log('   OK Auto-end saat semua pelari finis 50m berhasil diverifikasi!\n');
  } finally {
    sockets.forEach((s) => s.disconnect());
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));

    for (const sid of createdSessionIds) {
      await balapKarungManager.simpanHasilAkhirKeDatabase(sid).catch(() => {});
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
  console.log('PENGUJIAN LENGKAP BALAP KARUNG CHALLENGE (UNIT + 40 PELARI)');
  console.log('==============================================================\n');
  jalankanUnitTests();
  await jalankanIntegrationDanSimulasi40Pemain();
  console.log('==============================================================');
  console.log('SELURUH 28 SKENARIO PENGUJIAN BALAP KARUNG CHALLENGE LOLOS!');
  console.log('==============================================================\n');
}

main().catch((err) => {
  console.error('\nPENGUJIAN BALAP KARUNG GAGAL:', err);
  process.exit(1);
});

