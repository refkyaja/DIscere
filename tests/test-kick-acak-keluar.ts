import assert from 'node:assert';
import { multiManager } from '../server/src/games/multiManager';
import { balapKarungManager } from '../server/src/games/balapKarungManager';
import { panjatPinangManager } from '../server/src/games/panjatPinangManager';
import { kerupukMultiManager } from '../server/src/games/kerupukMultiManager';

async function runTests() {
  console.log('Testing Kick & Acak features across all multiplayer game managers...');

  const qList = [
    { id: 'q1', pertanyaan: '1+1?', pilihan: [{ id: 'a', teks: '2' }, { id: 'b', teks: '3' }], kunci: 'a' },
    { id: 'q2', pertanyaan: '2+2?', pilihan: [{ id: 'a', teks: '4' }, { id: 'b', teks: '5' }], kunci: 'a' },
  ];

  // 1. Tarik Tambang
  console.log('1. Testing Tarik Tambang (multiManager)...');
  const ttSesi = multiManager.inisialisasiSesi(
    'sesi-tt-1',
    '123456',
    'guru-1',
    { id: 'tmpl-1', judul: 'Kuis Tarik Tambang' },
    qList
  );
  assert(ttSesi, 'Sesi Tarik Tambang harus berhasil dibuat');
  const { peserta: p1 } = multiManager.gabungPeserta('123456', 'Siswa 1', 'sock-1');
  const { peserta: p2 } = multiManager.gabungPeserta('123456', 'Siswa 2', 'sock-2');
  assert.strictEqual(multiManager.dapatkanSesi('sesi-tt-1')?.peserta.size, 2);

  // Test kick
  const kickedTT = multiManager.keluarkanPeserta('sesi-tt-1', 'guru-1', p1.id);
  assert(kickedTT && kickedTT.id === p1.id, 'Kick di Tarik Tambang harus berhasil');
  assert.strictEqual(multiManager.dapatkanSesi('sesi-tt-1')?.peserta.size, 1);
  assert.strictEqual(multiManager.dapatkanSesi('sesi-tt-1')?.peserta.has(p2.id), true);

  // 2. Balap Karung
  console.log('2. Testing Balap Karung (balapKarungManager)...');
  const bkSesi = balapKarungManager.inisialisasiSesi(
    'sesi-bk-1',
    '234567',
    'guru-1',
    { id: 'tmpl-1', judul: 'Kuis Balap Karung' },
    qList
  );
  assert(bkSesi, 'Sesi Balap Karung harus berhasil dibuat');
  const { peserta: bkP1 } = balapKarungManager.gabungPeserta('234567', 'Budi', 'sock-bk-1');
  const { peserta: bkP2 } = balapKarungManager.gabungPeserta('234567', 'Ani', 'sock-bk-2');
  const { peserta: bkP3 } = balapKarungManager.gabungPeserta('234567', 'Cici', 'sock-bk-3');
  assert.strictEqual(balapKarungManager.dapatkanSesi('sesi-bk-1')?.peserta.size, 3);

  // Test acak tim
  const acakBK = await balapKarungManager.acakUlangTim('sesi-bk-1', 'guru-1');
  assert(acakBK && Array.isArray(acakBK.teams), 'Acak Tim di Balap Karung harus berhasil');

  // Test kick
  const kickedBK = await balapKarungManager.keluarkanPeserta('sesi-bk-1', 'guru-1', bkP2.id);
  assert(kickedBK && kickedBK.id === bkP2.id, 'Kick di Balap Karung harus berhasil');
  assert.strictEqual(balapKarungManager.dapatkanSesi('sesi-bk-1')?.peserta.size, 2);
  assert(!balapKarungManager.dapatkanSesi('sesi-bk-1')?.peserta.has(bkP2.id));

  // 3. Panjat Pinang
  console.log('3. Testing Panjat Pinang (panjatPinangManager)...');
  const ppSesi = panjatPinangManager.inisialisasiSesi(
    'sesi-pp-1',
    '345678',
    'guru-1',
    { id: 'tmpl-1', judul: 'Kuis Panjat Pinang' },
    qList
  );
  assert(ppSesi, 'Sesi Panjat Pinang harus berhasil dibuat');
  const { peserta: ppP1 } = panjatPinangManager.gabungPeserta('345678', 'Doni', 'sock-pp-1');
  const { peserta: ppP2 } = panjatPinangManager.gabungPeserta('345678', 'Eka', 'sock-pp-2');
  assert.strictEqual(panjatPinangManager.dapatkanSesi('sesi-pp-1')?.peserta.size, 2);

  // Test acak urutan
  const acakPP = panjatPinangManager.acakUrutanPeserta('sesi-pp-1', 'guru-1');
  assert(Array.isArray(acakPP), 'Acak Urutan di Panjat Pinang harus berhasil');

  // Test kick
  const kickedPP = await panjatPinangManager.keluarkanPeserta('sesi-pp-1', 'guru-1', ppP1.id);
  assert(kickedPP && kickedPP.id === ppP1.id, 'Kick di Panjat Pinang harus berhasil');
  assert.strictEqual(panjatPinangManager.dapatkanSesi('sesi-pp-1')?.peserta.size, 1);
  assert.strictEqual(panjatPinangManager.dapatkanSesi('sesi-pp-1')?.peserta.has(ppP2.id), true);

  // 4. Makan Kerupuk
  console.log('4. Testing Makan Kerupuk (kerupukMultiManager)...');
  const kmSesi = kerupukMultiManager.inisialisasiSesi(
    'sesi-km-1',
    '456789',
    'guru-1',
    { id: 'tmpl-1', judul: 'Kuis Makan Kerupuk' },
    qList
  );
  assert(kmSesi, 'Sesi Makan Kerupuk harus berhasil dibuat');
  const { peserta: kmP1 } = kerupukMultiManager.gabungPeserta('456789', 'Fani', 'sock-km-1');
  const { peserta: kmP2 } = kerupukMultiManager.gabungPeserta('456789', 'Gita', 'sock-km-2');
  assert.strictEqual(kerupukMultiManager.dapatkanSesi('sesi-km-1')?.peserta.size, 2);

  // Test acak urutan
  const acakKM = kerupukMultiManager.acakUrutanPeserta('sesi-km-1', 'guru-1');
  assert(Array.isArray(acakKM), 'Acak Urutan di Makan Kerupuk harus berhasil');

  // Test kick
  const kickedKM = await kerupukMultiManager.keluarkanPeserta('sesi-km-1', 'guru-1', kmP1.id);
  assert(kickedKM && kickedKM.id === kmP1.id, 'Kick di Makan Kerupuk harus berhasil');
  assert.strictEqual(kerupukMultiManager.dapatkanSesi('sesi-km-1')?.peserta.size, 1);
  assert.strictEqual(kerupukMultiManager.dapatkanSesi('sesi-km-1')?.peserta.has(kmP2.id), true);

  console.log('✅ SEMUA PENGUJIAN BACKEND KICK & ACAK MULTIPLAYER LULUS 100%!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
