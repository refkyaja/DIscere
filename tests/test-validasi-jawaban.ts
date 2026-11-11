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
  // UJI 1 & 2: Jawaban Benar & Salah dengan Isolasi Soal Individu Kontinu (Tarik Tambang)
  // -------------------------------------------------------------------------
  console.log('1. Menguji pengenalan jawaban benar, salah, & isolasi soal antar siswa (Tarik Tambang)...');
  const sessionMultiId = 'test-multi-validasi-' + Date.now();
  const tokenMulti = '991122';

  const soalKesulitanSama = mockQuestions.map((q) => ({ ...q, kesulitan: 'sedang' }));

  const sesiMulti = multiManager.inisialisasiSesi(
    sessionMultiId,
    tokenMulti,
    'host-guru-1',
    { id: 'tmpl-1', judul: 'Kuis Kemerdekaan' },
    soalKesulitanSama,
    { kesulitan: 'sedang', kekuatanTimMulti: 40, batasMenang: 200 }
  );

  // Daftarkan 2 siswa (Device A -> merah, Device B -> putih)
  const siswaA = multiManager.gabungPeserta(tokenMulti, 'Budi Siswa A', 'socket-a');
  const siswaB = multiManager.gabungPeserta(tokenMulti, 'Siti Siswa B', 'socket-b');

  multiManager.mulaiPermainan(sessionMultiId, 'host-guru-1');

  const pA = sesiMulti.peserta.get(siswaA.peserta.id)!;
  const pB = sesiMulti.peserta.get(siswaB.peserta.id)!;
  assert.ok(pA.tim, 'Siswa A harus memiliki tim');
  assert.ok(pB.tim, 'Siswa B harus memiliki tim');
  assert.notStrictEqual(pA.tim, pB.tim, 'Dua siswa pertama harus berada di tim berlawanan');

  const clientSoalA = multiManager.dapatkanSoalAktifPeserta(sessionMultiId, pA.id)!;
  const clientSoalB = multiManager.dapatkanSoalAktifPeserta(sessionMultiId, pB.id)!;
  assert.ok(clientSoalA && clientSoalB, 'Setiap siswa langsung memiliki soal aktif independen saat mulai');
  assert.strictEqual((clientSoalA as any).correctChoiceId, undefined, 'Payload siswa tidak boleh membocorkan kunci');

  const presA = pA.presentasiAktif!;
  const presB = pB.presentasiAktif!;
  assert.notStrictEqual(
    presA.presentationId,
    presB.presentationId,
    'PresentationId setiap siswa wajib unik'
  );

  // Tolak jika Siswa A mencoba mengirim presentationId milik Siswa B
  assert.throws(
    () => {
      multiManager.prosesJawabanSiswa(sessionMultiId, pA.id, {
        presentationId: presB.presentationId,
        choiceId: presB.correctChoiceId,
      });
    },
    /kedaluwarsa|salah|tidak cocok/i,
    'Tidak boleh menjawab memakai presentationId milik siswa lain'
  );

  // Siswa A menjawab BENAR memakai choiceId miliknya
  const hasilA = multiManager.prosesJawabanSiswa(sessionMultiId, pA.id, {
    presentationId: presA.presentationId,
    choiceId: presA.correctChoiceId,
  });
  assert.strictEqual(hasilA.benar, true, 'Pilihan correctChoiceId Siswa A harus dikenali sebagai benar');
  assert.strictEqual(hasilA.deltaTali, pA.tim === 'merah' ? 40 : -40, 'Tarikan benar 40/1 = 40');
  console.log('   ✓ Jawaban benar siswa A diakui benar & lintas-presentationId ditolak');

  // Siswa B menjawab SALAH memakai pilihan selain correctChoiceId
  const wrongChoiceB = presB.pilihanList.find((c) => c.choiceId !== presB.correctChoiceId)!;
  const hasilB = multiManager.prosesJawabanSiswa(sessionMultiId, pB.id, {
    presentationId: presB.presentationId,
    choiceId: wrongChoiceB.choiceId,
  });
  assert.strictEqual(hasilB.benar, false, 'Pilihan salah Siswa B harus diakui salah');
  assert.ok(hasilB.slipQuote && hasilB.slipQuote.length > 0, 'Terpeleset menyertakan kutipan slipQuote');
  console.log('   ✓ Jawaban salah siswa B diakui salah (benar: false) dengan penalti terpeleset');

  // -------------------------------------------------------------------------
  // UJI 3: Normalisasi Input (huruf kecil & spasi tambahan) pada Soal Berikutnya
  // -------------------------------------------------------------------------
  console.log('2. Menguji normalisasi input (huruf kecil & spasi tambahan)...');
  multiManager.siapkanSoalBerikutnyaPeserta(sessionMultiId, pA.id);
  multiManager.siapkanSoalBerikutnyaPeserta(sessionMultiId, pB.id);
  const presA2 = pA.presentasiAktif!;
  const presB2 = pB.presentasiAktif!;

  // Siswa A menjawab dengan huruf kecil + spasi label yang tepat (misal '  a  ')
  const hasilASoal2 = multiManager.prosesJawabanSiswa(sessionMultiId, pA.id, {
    presentationId: presA2.presentationId,
    jawabanDipilih: `  ${presA2.jawabanBenarKode.toLowerCase()}  `,
  });
  assert.strictEqual(hasilASoal2.benar, true, 'Input huruf kecil + spasi harus dinormalisasi benar');

  // Siswa B menjawab dengan teks persis opsi benar
  const hasilBSoal2 = multiManager.prosesJawabanSiswa(sessionMultiId, pB.id, {
    presentationId: presB2.presentationId,
    jawabanDipilih: presB2.jawabanBenarTeks,
  });
  assert.strictEqual(hasilBSoal2.benar, true, 'Input teks opsi benar harus diakui benar');
  console.log('   ✓ Huruf kecil, spasi tambahan, dan teks opsi berhasil dinormalisasi sebagai benar');

  // -------------------------------------------------------------------------
  // UJI 4: Toleransi Fallback questionId undefined/missing saat memakai jawaban/choiceId
  // -------------------------------------------------------------------------
  console.log('3. Menguji toleransi fallback jawabanDipilih tanpa presentationId...');
  multiManager.siapkanSoalBerikutnyaPeserta(sessionMultiId, pA.id);
  multiManager.siapkanSoalBerikutnyaPeserta(sessionMultiId, pB.id);
  const presA3 = pA.presentasiAktif!;
  const presB3 = pB.presentasiAktif!;

  const hasilASoal3 = multiManager.prosesJawabanSiswa(sessionMultiId, pA.id, {
    jawabanDipilih: presA3.jawabanBenarKode,
  });
  assert.strictEqual(hasilASoal3.benar, true, 'Fallback tanpa presentationId harus berhasil');

  const hasilBSoal3 = multiManager.prosesJawabanSiswa(sessionMultiId, pB.id, {
    jawabanDipilih: presB3.jawabanBenarKode.toLowerCase(),
  });
  assert.strictEqual(hasilBSoal3.benar, true, 'Fallback huruf kecil harus berhasil');
  console.log('   ✓ Normalisasi jawabanDipilih bekerja mulus');

  // -------------------------------------------------------------------------
  // UJI 5: Backend Menolak Jawaban Ganda Sebelum Soal Berikutnya Disiapkan
  // -------------------------------------------------------------------------
  console.log('4. Menguji penolakan jawaban ganda pada presentasi soal yang sama...');
  assert.throws(
    () => {
      multiManager.prosesJawabanSiswa(sessionMultiId, pA.id, {
        presentationId: presA3.presentationId,
        choiceId: presA3.correctChoiceId,
      });
    },
    /sudah|kedaluwarsa|berikutnya|tersedia/i,
    'Siswa tidak boleh mengirim jawaban dua kali sebelum soal berikutnya disiapkan'
  );
  console.log('   ✓ Percobaan jawaban kedua ditolak dengan aman');

  // -------------------------------------------------------------------------
  // UJI 6 & 7: Integritas Skor & Posisi Tali [-batas..+batas]
  // -------------------------------------------------------------------------
  console.log('5. Menguji integritas posisi tali dan skor tim...');
  const totalSkor = sesiMulti.skorMerah + sesiMulti.skorPutih;
  assert.ok(totalSkor > 0, 'Skor tim harus bertambah setelah jawaban benar');
  assert.ok(
    sesiMulti.taliPosition >= -200 && sesiMulti.taliPosition <= 200,
    'Posisi tali wajib berada di rentang [-batasMenang..+batasMenang]'
  );
  console.log(`   ✓ Posisi tali: ${sesiMulti.taliPosition}, Skor Merah: ${sesiMulti.skorMerah}, Skor Putih: ${sesiMulti.skorPutih}`);

  // -------------------------------------------------------------------------
  // UJI 8: Isolasi Multi-Device (Device A tidak menginterferensi Device B)
  // -------------------------------------------------------------------------
  console.log('6. Menguji isolasi multi-device (Device A vs Device B)...');
  assert.strictEqual(pA.riwayatJawaban.length, 3, 'Riwayat jawaban Device A tercatat mandiri (3)');
  assert.strictEqual(pB.riwayatJawaban.length, 3, 'Riwayat jawaban Device B tercatat mandiri (3)');
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
  // UJI 10: Validasi Jawaban Game Solo 1 vs 1 Kontinu (Dek Independen)
  // -------------------------------------------------------------------------
  console.log('8. Menguji validasi jawaban pada Game Solo 1 vs 1 Kontinu...');
  const sessionSoloId = 'test-solo-validasi-' + Date.now();
  const hostSoloId = 'guru-solo-1';

  const sesiSolo = soloManager.inisialisasiSesi(
    sessionSoloId,
    hostSoloId,
    { id: 'tmpl-s', judul: 'Kuis Solo' },
    soalKesulitanSama,
    { kesulitan: 'sedang', tarikBenarSolo: 10, mundurSalahSolo: 4, batasMenang: 100 }
  );

  soloManager.mulaiSesi(sessionSoloId, hostSoloId);
  const presSoloMerah = sesiSolo.pemain1.presentasiAktif!;
  const presSoloPutih = sesiSolo.pemain2.presentasiAktif!;
  const wrongSoloPutih = presSoloPutih.pilihanList.find(
    (c) => c.choiceId !== presSoloPutih.correctChoiceId
  )!;

  // Tim Merah menjawab benar -> langsung memajukan skor & tali (+10) dan mengacak soal berikutnya
  const hasilSoloMerah = soloManager.prosesJawaban(sessionSoloId, hostSoloId, {
    presentationId: presSoloMerah.presentationId,
    tim: 'merah',
    jawabanDipilih: ` ${presSoloMerah.jawabanBenarKode.toLowerCase()} `,
  });
  assert.strictEqual(hasilSoloMerah.benar, true, 'Solo tim merah menjawab benar');
  assert.strictEqual(hasilSoloMerah.sesi.skorMerah, 1, 'Skor merah langsung bertambah +1');
  assert.strictEqual(hasilSoloMerah.sesi.taliPosition, 10, 'Tim Merah langsung menarik +10');
  assert.notStrictEqual(
    sesiSolo.pemain1.presentasiAktif!.presentationId,
    presSoloMerah.presentationId,
    'Pemain 1 langsung mendapat soal berikutnya tanpa menunggu lawan'
  );

  // Tim Putih menjawab salah -> terpeleset mundur (-1 * -4 = +4 menguntungkan Merah)
  const hasilSoloPutih = soloManager.prosesJawaban(sessionSoloId, hostSoloId, {
    presentationId: presSoloPutih.presentationId,
    tim: 'putih',
    choiceId: wrongSoloPutih.choiceId,
  });
  assert.strictEqual(hasilSoloPutih.benar, false, 'Solo tim putih menjawab salah');
  assert.strictEqual(hasilSoloPutih.sesi.skorMerah, 1);
  assert.strictEqual(hasilSoloPutih.sesi.skorPutih, 0, 'Skor putih tidak bertambah');
  assert.strictEqual(sesiSolo.taliPosition, 14, 'Tim Putih terpeleset -4 ke kanan (+4 mengarah ke kiri/Merah)');

  // Percobaan replay presentationId lama ditolak
  assert.throws(
    () => {
      soloManager.prosesJawaban(sessionSoloId, hostSoloId, {
        presentationId: presSoloMerah.presentationId,
        tim: 'merah',
        choiceId: presSoloMerah.correctChoiceId,
      });
    },
    /kedaluwarsa|sudah dijawab/i
  );

  soloManager.hapusSesi(sessionSoloId);
  console.log('   ✓ Validasi Solo 1 vs 1 Kontinu konsisten dan akurat');

  console.log('\n=============================================================');
  console.log('🎉 SEMUA 10 UJI VALIDASI JAWABAN SISWA LULUS 100% TANPA REGRESI!');
  console.log('=============================================================\n');
}

runValidasiJawabanTests().catch((err) => {
  console.error('❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
