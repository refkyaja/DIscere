import assert from 'assert';
import { multiManager } from '../server/src/games/multiManager.js';
import { kerupukManager } from '../server/src/games/kerupukManager.js';
import { kerupukMultiManager } from '../server/src/games/kerupukMultiManager.js';
import { soloManager } from '../server/src/games/soloManager.js';

async function runValidasiJawabanTests() {
  console.log('\n=============================================================');
  console.log('🧪 PENGUJIAN KOMPREHENSIF VALIDASI JAWABAN SISWA DISCERE');
  console.log('=============================================================\n');

  // Sample data pertanyaan untuk pengujian
  const mockQuestions = [
    {
      id: 'soal-1-merah',
      urutan: 1,
      teks: 'Ibukota negara Indonesia saat ini adalah?',
      opsiA: 'Jakarta',
      opsiB: 'Bandung',
      opsiC: 'Surabaya',
      jawabanBenar: 'A',
      penjelasan: 'Jakarta adalah ibukota negara Indonesia.',
    },
    {
      id: 'soal-2-putih',
      urutan: 2,
      teks: 'Lambang sila pertama Pancasila adalah?',
      opsiA: 'Rantai',
      opsiB: 'Bintang',
      opsiC: 'Pohon Beringin',
      jawabanBenar: 'B',
      penjelasan: 'Bintang emas adalah lambang sila pertama Pancasila.',
    },
    {
      id: 'soal-3-kerupuk',
      urutan: 3,
      teks: 'Warna bendera nasional Indonesia adalah?',
      opsiA: 'Merah Putih Biru',
      opsiB: 'Putih Merah',
      opsiC: 'Merah Putih',
      jawabanBenar: 'C',
      penjelasan: 'Bendera negara Indonesia adalah Sang Saka Merah Putih.',
    },
  ];

  // -------------------------------------------------------------------------
  // UJI 1 & 2: Jawaban Benar & Salah dengan Isolasi Soal Tim (Tarik Tambang)
  // -------------------------------------------------------------------------
  console.log('1. Menguji pengenalan jawaban benar, salah, & isolasi soal antar tim (Tarik Tambang)...');
  const sessionMultiId = 'test-multi-validasi-' + Date.now();
  const tokenMulti = '991122';

  const soalKesulitanSama = mockQuestions.map((q) => ({ ...q, kesulitan: 'sedang' }));

  const sesiMulti = multiManager.inisialisasiSesi(
    sessionMultiId,
    tokenMulti,
    'host-guru-1',
    { id: 'tmpl-1', judul: 'Kuis Kemerdekaan' },
    soalKesulitanSama,
    { kesulitan: 'sedang', durasiRonde: 20 }
  );

  // Daftarkan 2 siswa (Device A -> merah, Device B -> putih)
  const siswaA = multiManager.gabungPeserta(tokenMulti, 'Budi Siswa A', 'socket-a');
  const siswaB = multiManager.gabungPeserta(tokenMulti, 'Siti Siswa B', 'socket-b');

  multiManager.mulaiPermainan(sessionMultiId, 'host-guru-1');
  multiManager.mulaiTimerSoal(sessionMultiId, 20);

  const pA = sesiMulti.peserta.get(siswaA.peserta.id)!;
  const pB = sesiMulti.peserta.get(siswaB.peserta.id)!;
  assert.ok(pA.tim, 'Siswa A harus memiliki tim');
  assert.ok(pB.tim, 'Siswa B harus memiliki tim');
  assert.notStrictEqual(pA.tim, pB.tim, 'Dua siswa pertama harus berada di tim berlawanan');

  const presA = pA.tim === 'merah' ? sesiMulti.rondeAktif!.soalTim1 : sesiMulti.rondeAktif!.soalTim2;
  const presB = pB.tim === 'merah' ? sesiMulti.rondeAktif!.soalTim1 : sesiMulti.rondeAktif!.soalTim2;
  assert.notStrictEqual(
    presA.questionId,
    presB.questionId,
    'Tim 1 dan Tim 2 harus menerima pertanyaan yang berbeda pada ronde yang sama'
  );

  // Tolak jika Siswa A mencoba mengirim presentationId milik tim lawan
  assert.throws(
    () => {
      multiManager.prosesJawabanSiswa(sessionMultiId, pA.id, {
        presentationId: presB.presentationId,
        choiceId: presB.correctChoiceId,
      });
    },
    /tim lawan/i,
    'Tidak boleh menjawab soal milik tim lawan'
  );

  // Siswa A menjawab BENAR memakai choiceId miliknya
  const hasilA = multiManager.prosesJawabanSiswa(sessionMultiId, pA.id, {
    presentationId: presA.presentationId,
    choiceId: presA.correctChoiceId,
  });
  assert.strictEqual(hasilA.benar, true, 'Pilihan correctChoiceId Tim A harus dikenali sebagai benar');
  console.log('   ✓ Jawaban benar tim A diakui benar & lintas tim ditolak');

  // Siswa B menjawab SALAH memakai pilihan selain correctChoiceId
  const wrongChoiceB = presB.pilihanList.find((c) => c.choiceId !== presB.correctChoiceId)!;
  const hasilB = multiManager.prosesJawabanSiswa(sessionMultiId, pB.id, {
    presentationId: presB.presentationId,
    choiceId: wrongChoiceB.choiceId,
  });
  assert.strictEqual(hasilB.benar, false, 'Pilihan salah Tim B harus diakui salah');
  console.log('   ✓ Jawaban salah tim B diakui salah (benar: false)');

  // -------------------------------------------------------------------------
  // UJI 3: Normalisasi Input (huruf kecil & spasi tambahan) pada Ronde Baru
  // -------------------------------------------------------------------------
  console.log('2. Menguji normalisasi input (huruf kecil & spasi tambahan)...');
  multiManager.selesaikanSoalAktif(sessionMultiId);
  multiManager.mulaiRondeBaru(sessionMultiId);

  const presA2 = pA.tim === 'merah' ? sesiMulti.rondeAktif!.soalTim1 : sesiMulti.rondeAktif!.soalTim2;
  const presB2 = pB.tim === 'merah' ? sesiMulti.rondeAktif!.soalTim1 : sesiMulti.rondeAktif!.soalTim2;

  // Siswa A menjawab dengan huruf kecil + spasi label yang tepat (misal '  a  ')
  const hasilASoal2 = multiManager.prosesJawabanSiswa(sessionMultiId, pA.id, {
    presentationId: presA2.presentationId,
    jawaban: `  ${presA2.jawabanBenarKode.toLowerCase()}  `,
  });
  assert.strictEqual(hasilASoal2.benar, true, 'Input huruf kecil + spasi harus dinormalisasi benar');

  // Siswa B menjawab dengan teks persis opsi benar
  const hasilBSoal2 = multiManager.prosesJawabanSiswa(sessionMultiId, pB.id, {
    presentationId: presB2.presentationId,
    jawaban: presB2.jawabanBenarTeks,
  });
  assert.strictEqual(hasilBSoal2.benar, true, 'Input teks opsi benar harus diakui benar');
  console.log('   ✓ Huruf kecil, spasi tambahan, dan teks opsi berhasil dinormalisasi sebagai benar');

  // -------------------------------------------------------------------------
  // UJI 4: Toleransi Fallback questionId undefined/missing saat memakai presentationId/jawaban
  // -------------------------------------------------------------------------
  console.log('3. Menguji toleransi fallback questionId undefined/missing...');
  multiManager.selesaikanSoalAktif(sessionMultiId);
  multiManager.mulaiRondeBaru(sessionMultiId);

  const presA3 = pA.tim === 'merah' ? sesiMulti.rondeAktif!.soalTim1 : sesiMulti.rondeAktif!.soalTim2;
  const presB3 = pB.tim === 'merah' ? sesiMulti.rondeAktif!.soalTim1 : sesiMulti.rondeAktif!.soalTim2;

  const hasilASoal3 = multiManager.prosesJawabanSiswa(sessionMultiId, pA.id, {
    questionId: undefined,
    jawaban: presA3.jawabanBenarKode,
  });
  assert.strictEqual(hasilASoal3.benar, true, 'Fallback questionId undefined harus berhasil');

  const hasilBSoal3 = multiManager.prosesJawabanSiswa(sessionMultiId, pB.id, {
    questionId: 'undefined',
    jawaban: presB3.jawabanBenarKode.toLowerCase(),
  });
  assert.strictEqual(hasilBSoal3.benar, true, 'Fallback string "undefined" harus berhasil');
  console.log('   ✓ Fallback backend bekerja mulus ketika frontend mengirim questionId undefined');

  // -------------------------------------------------------------------------
  // UJI 5: Backend Menolak Jawaban Ganda dari Siswa yang Sama
  // -------------------------------------------------------------------------
  console.log('4. Menguji penolakan jawaban ganda (single submission enforcement)...');
  assert.throws(
    () => {
      multiManager.prosesJawabanSiswa(sessionMultiId, pA.id, {
        choiceId: presA3.correctChoiceId,
      });
    },
    /sudah mengirim jawaban/i,
    'Siswa tidak boleh mengirim jawaban dua kali pada ronde yang sama'
  );
  console.log('   ✓ Percobaan jawaban kedua ditolak dengan aman');

  // -------------------------------------------------------------------------
  // UJI 6 & 7: Integritas Skor & Posisi Tali [-100..+100] Setelah Ronde Evaluasi
  // -------------------------------------------------------------------------
  console.log('5. Menguji integritas posisi tali dan skor tim...');
  multiManager.selesaikanSoalAktif(sessionMultiId);
  const totalSkor = sesiMulti.skorMerah + sesiMulti.skorPutih;
  assert.ok(totalSkor > 0, 'Skor tim harus bertambah setelah jawaban benar');
  assert.ok(
    sesiMulti.taliPosition >= -100 && sesiMulti.taliPosition <= 100,
    'Posisi tali wajib berada di rentang [-100..+100]'
  );
  console.log(`   ✓ Posisi tali: ${sesiMulti.taliPosition}, Skor Merah: ${sesiMulti.skorMerah}, Skor Putih: ${sesiMulti.skorPutih}`);

  // -------------------------------------------------------------------------
  // UJI 8: Isolasi Multi-Device (Device A tidak menginterferensi Device B)
  // -------------------------------------------------------------------------
  console.log('6. Menguji isolasi multi-device (Device A vs Device B)...');
  assert.strictEqual(sesiMulti.rondeAktif!.jawabanMap.has(pA.id), true, 'Jawaban Device A tercatat mandiri');
  assert.strictEqual(sesiMulti.rondeAktif!.jawabanMap.has(pB.id), true, 'Jawaban Device B tercatat mandiri');
  assert.strictEqual(sesiMulti.rondeAktif!.jawabanMap.size, 2, 'Tepat 2 entri jawaban tercatat');
  multiManager.hapusSesi(sessionMultiId);
  console.log('   ✓ Data dan state setiap perangkat terisolasi sempurna');

  // -------------------------------------------------------------------------
  // UJI 9: Validasi Jawaban Game Makan Kerupuk Challenge (Mode Solo)
  // -------------------------------------------------------------------------
  console.log('7. Menguji validasi jawaban berbasis choiceId & gacha pada Makan Kerupuk Mode Solo...');
  const sessionKerupukId = 'test-kerupuk-validasi-' + Date.now();

  const sesiKerupuk = kerupukManager.inisialisasiSesi(
    sessionKerupukId,
    'host-guru-kerupuk',
    { id: 'tmpl-k', judul: 'Kuis Kerupuk' },
    mockQuestions
  );

  kerupukManager.mulaiPermainan(sessionKerupukId, 'host-guru-kerupuk');
  const presK1 = sesiKerupuk.activePresentation!;
  const pilBenarK1 = presK1.pilihanList.find((p) => p.choiceId === presK1.correctChoiceId)!;

  const hasilBenarK = kerupukManager.prosesJawaban(sessionKerupukId, 'host-guru-kerupuk', {
    presentationId: presK1.presentationId,
    choiceId: pilBenarK1.choiceId,
  });
  assert.strictEqual(hasilBenarK.benar, true, 'Pilihan benar harus diakui benar');
  assert.ok(hasilBenarK.poinDidapat >= 100, 'Jawaban benar harus mendapat minimal 100 poin');
  assert.ok(hasilBenarK.gacha !== null, 'Jawaban benar harus mendapatkan random draw gacha gigitan');

  const presK2 = sesiKerupuk.activePresentation!;
  const pilSalahK2 = presK2.pilihanList.find((p) => p.choiceId !== presK2.correctChoiceId)!;

  const hasilSalahK = kerupukManager.prosesJawaban(sessionKerupukId, 'host-guru-kerupuk', {
    presentationId: presK2.presentationId,
    choiceId: pilSalahK2.choiceId,
  });
  assert.strictEqual(hasilSalahK.benar, false, 'Pilihan salah harus diakui salah');
  assert.strictEqual(hasilSalahK.poinDidapat, 0, 'Jawaban salah tidak mendapat poin');
  assert.strictEqual(hasilSalahK.gacha, null, 'Jawaban salah tidak mendapat gacha gigitan');
  kerupukManager.hapusSesi(sessionKerupukId);
  console.log('   ✓ Makan Kerupuk Mode Solo memvalidasi choiceId benar (+gacha) dan salah (poin 0, no gacha) secara presisi');

  // Uji tambahan: Makan Kerupuk Mode Multiplayer
  const sessionKerupukMultiId = 'test-kerupuk-multi-validasi-' + Date.now();
  const tokKM = '445566';
  kerupukMultiManager.inisialisasiSesi(
    sessionKerupukMultiId,
    tokKM,
    'host-guru-kmulti',
    { id: 'tmpl-km', judul: 'Kuis Kerupuk Multi' },
    mockQuestions
  );
  const kM1 = kerupukMultiManager.gabungPeserta(tokKM, 'Eko Multi', 'sock-km1');
  kerupukMultiManager.mulaiPermainan(sessionKerupukMultiId, 'host-guru-kmulti');
  kerupukMultiManager.ambilSoalBerikutnyaUntukPeserta(sessionKerupukMultiId, kM1.peserta.id);
  const presKM = kM1.peserta.activePresentation!;
  const resKM = kerupukMultiManager.prosesJawabanSiswa(sessionKerupukMultiId, kM1.peserta.id, {
    presentationId: presKM.presentationId,
    choiceId: presKM.correctChoiceId,
  });
  assert.strictEqual(resKM.benar, true);
  assert.ok(resKM.poinDidapat >= 100);
  kerupukMultiManager.hapusSesi(sessionKerupukMultiId);
  console.log('   ✓ Makan Kerupuk Mode Multiplayer memvalidasi choiceId benar secara presisi');

  // -------------------------------------------------------------------------
  // UJI 10: Validasi Jawaban Game Solo 1 vs 1 Simultan
  // -------------------------------------------------------------------------
  console.log('8. Menguji validasi jawaban pada Game Solo 1 vs 1...');
  const sessionSoloId = 'test-solo-validasi-' + Date.now();
  const hostSoloId = 'guru-solo-1';

  const sesiSolo = soloManager.inisialisasiSesi(
    sessionSoloId,
    hostSoloId,
    { id: 'tmpl-s', judul: 'Kuis Solo' },
    soalKesulitanSama,
    { kesulitan: 'sedang', durasiRonde: 20 }
  );

  soloManager.mulaiSesi(sessionSoloId, hostSoloId);
  const presSoloMerah = sesiSolo.rondeAktif!.soalTim1;
  const presSoloPutih = sesiSolo.rondeAktif!.soalTim2;
  const wrongSoloPutih = presSoloPutih.pilihanList.find(
    (c) => c.choiceId !== presSoloPutih.correctChoiceId
  )!;

  // Tim Merah menjawab benar dengan choiceId atau label huruf kecil berspasi
  const hasilSoloMerah = soloManager.prosesJawaban(sessionSoloId, hostSoloId, {
    presentationId: presSoloMerah.presentationId,
    tim: 'merah',
    jawabanDipilih: ` ${presSoloMerah.jawabanBenarKode.toLowerCase()} `,
  });
  assert.strictEqual(hasilSoloMerah.benar, true, 'Solo tim merah menjawab benar');
  assert.strictEqual(hasilSoloMerah.sesi.skorMerah, 1, 'Skor merah bertambah');

  // Tim Putih menjawab salah
  const hasilSoloPutih = soloManager.prosesJawaban(sessionSoloId, hostSoloId, {
    presentationId: presSoloPutih.presentationId,
    tim: 'putih',
    choiceId: wrongSoloPutih.choiceId,
  });
  assert.strictEqual(hasilSoloPutih.benar, false, 'Solo tim putih menjawab salah');
  assert.strictEqual(hasilSoloPutih.sesi.skorPutih, 0, 'Skor putih tidak bertambah');
  assert.strictEqual(hasilSoloPutih.rondeSelesai, true, 'Ronde selesai setelah kedua tim menjawab');
  assert.strictEqual(sesiSolo.taliPosition, 15, 'Tim Merah menarik +15 poin pada ronde pertama');
  soloManager.hapusSesi(sessionSoloId);
  console.log('   ✓ Validasi Solo 1 vs 1 konsisten dan akurat');

  console.log('\n=============================================================');
  console.log('🎉 SEMUA 10 UJI VALIDASI JAWABAN SISWA LULUS 100% TANPA REGRESI!');
  console.log('=============================================================\n');
}

runValidasiJawabanTests().catch((err) => {
  console.error('❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
