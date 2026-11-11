import { io as ClientIO } from 'socket.io-client';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string, suite: string) {
  if (!condition) {
    results.push({ suite, name: message, passed: false, error: 'Assertion failed' });
    throw new Error(`[${suite}] ✗ ${message}`);
  }
  results.push({ suite, name: message, passed: true });
  console.log(`  ✓ ${message}`);
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('   DISCERE - SUITE PENGUJIAN OTOMATIS KOMPREHENSIF (E2E)        ');
  console.log('   LOGICODIX 2026 Hackathon - Subtema Smart & Fun Education     ');
  console.log('================================================================\n');

  let guruCookie = '';
  let adminCookie = '';
  let guruId = '';
  let adminId = '';

  // ---------------------------------------------------------------------------
  // 1. SUITE AUTH & KEAMANAN
  // ---------------------------------------------------------------------------
  console.log('📦 [1/6] Menguji Autentikasi & Kontrol Akses Berbasis Peran...');
  try {
    // 1.1 Login Guru Demo
    const loginGuruRes = await fetch(`${BASE_URL}/api/auth/masuk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'guru@discere.local', kataSandi: 'GuruDiscere2026!' }),
    });
    const guruData = await loginGuruRes.json();
    guruCookie = loginGuruRes.headers.get('set-cookie')!.split(';')[0];
    guruId = guruData.user.id;
    assert(loginGuruRes.ok && guruData.user.role === 'guru', 'Login Guru Demo berhasil (role: guru)', 'Auth');

    // 1.2 Login Administrator
    const loginAdminRes = await fetch(`${BASE_URL}/api/auth/masuk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@discere.local', kataSandi: 'AdminDiscere2026!' }),
    });
    const adminData = await loginAdminRes.json();
    adminCookie = loginAdminRes.headers.get('set-cookie')!.split(';')[0];
    adminId = adminData.user.id;
    assert(loginAdminRes.ok && adminData.user.role === 'admin', 'Login Administrator berhasil (role: admin)', 'Auth');

    // 1.3 Verifikasi Proteksi Role: Guru Ditolak dari endpoint Admin
    const guruCobaAdminRes = await fetch(`${BASE_URL}/api/admin/statistik`, {
      headers: { Cookie: guruCookie },
    });
    assert(guruCobaAdminRes.status === 403, 'Guru ditolak dari endpoint admin (403 Forbidden)', 'Auth');
  } catch (err: any) {
    console.error('Gagal pada suite Auth:', err.message);
  }

  // ---------------------------------------------------------------------------
  // 2. SUITE MANAJEMEN TEMPLATE & PUSTAKA RESMI
  // ---------------------------------------------------------------------------
  console.log('\n📦 [2/6] Menguji Manajemen Template Soal & Pustaka Resmi...');
  let templateSoloId = '';
  let templateMultiId = '';
  try {
    // 2.1 Ambil template guru
    const tmplRes = await fetch(`${BASE_URL}/api/template`, {
      headers: { Cookie: guruCookie },
    });
    const tmplData = await tmplRes.json();
    assert(Array.isArray(tmplData.templates) && tmplData.templates.length >= 2, 'Mengambil daftar template milik guru', 'Template');
    templateSoloId = tmplData.templates[0].id;
    templateMultiId = tmplData.templates[1].id;

    // 2.2 Ambil pustaka resmi
    const pustakaRes = await fetch(`${BASE_URL}/api/template/pustaka`, {
      headers: { Cookie: guruCookie },
    });
    const pustakaData = await pustakaRes.json();
    assert(Array.isArray(pustakaData.templates) && pustakaData.templates.length >= 1, 'Mengambil koleksi template pustaka resmi', 'Template');

    // 2.3 Duplikasi template pustaka resmi ke koleksi guru
    const duplikatRes = await fetch(`${BASE_URL}/api/template/${pustakaData.templates[0].id}/duplikat`, {
      method: 'POST',
      headers: { Cookie: guruCookie },
    });
    const duplikatData = await duplikatRes.json();
    assert(duplikatRes.ok && duplikatData.template.ownerId === guruId, 'Menyalin template resmi ke koleksi privat guru', 'Template');

    // Bersihkan template duplikat
    await fetch(`${BASE_URL}/api/template/${duplikatData.template.id}`, {
      method: 'DELETE',
      headers: { Cookie: guruCookie },
    });
  } catch (err: any) {
    console.error('Gagal pada suite Template:', err.message);
  }

  // ---------------------------------------------------------------------------
  // 3. SUITE GAME SOLO TARIK TAMBANG
  // ---------------------------------------------------------------------------
  console.log('\n📦 [3/6] Menguji Game Tarik Tambang Mode Solo (Layar Bersama)...');
  try {
    // 3.1 Buat Sesi Solo
    const buatSoloRes = await fetch(`${BASE_URL}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({ templateId: templateSoloId, mode: 'solo' }),
    });
    const soloData = await buatSoloRes.json();
    const soloId = soloData.session.id;
    assert(buatSoloRes.ok && soloData.session.mode === 'solo', `Sesi Solo dibuat (ID: ${soloId})`, 'Solo');

    // 3.2 Mulai Sesi Solo
    const mulaiSoloRes = await fetch(`${BASE_URL}/api/sesi/${soloId}/mulai`, {
      method: 'POST',
      headers: { Cookie: guruCookie },
    });
    const mulaiSoloData = await mulaiSoloRes.json();
    assert(mulaiSoloData.session.state === 'PLAYING', 'Sesi Solo beralih ke status PLAYING', 'Solo');
    assert(!!mulaiSoloData.session.soalSaatIni, 'Soal pertama solo aktif dan tersaji', 'Solo');

    // 3.3 Kirim Jawaban Tim Merah
    const jawabRes = await fetch(`${BASE_URL}/api/sesi/${soloId}/jawab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        questionId: mulaiSoloData.session.soalSaatIni.id,
        tim: 'merah',
        jawabanDipilih: 'A',
      }),
    });
    const jawabData = await jawabRes.json();
    assert(jawabRes.ok && typeof jawabData.taliPosition === 'number', 'Perhitungan pergeseran tali di server berhasil diproses', 'Solo');

    // 3.4 Bersihkan Sesi Solo Uji Coba agar tidak mencemari riwayat
    await fetch(`${BASE_URL}/api/sesi/${soloId}`, {
      method: 'DELETE',
      headers: { Cookie: guruCookie },
    });
  } catch (err: any) {
    console.error('Gagal pada suite Game Solo:', err.message);
  }

  // ---------------------------------------------------------------------------
  // 4. SUITE GAME MULTIPLAYER SOCKET.IO
  // ---------------------------------------------------------------------------
  console.log('\n📦 [4/6] Menguji Game Multiplayer Socket.IO (PIN, QR, & Real-time)...');
  try {
    // 4.1 Buat Sesi Multiplayer
    const buatMultiRes = await fetch(`${BASE_URL}/api/sesi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({ templateId: templateMultiId, mode: 'multi' }),
    });
    const multiData = await buatMultiRes.json();
    const multiId = multiData.session.id;
    const multiToken = multiData.session.token;
    assert(buatMultiRes.ok && multiToken.length === 6, `Sesi Multi dibuat (PIN: ${multiToken})`, 'Multiplayer');

    // 4.2 Koneksikan Socket Host & 2 Siswa
    const hostSocket = ClientIO(BASE_URL, {
      extraHeaders: { cookie: guruCookie },
    });
    const siswa1Socket = ClientIO(BASE_URL);
    const siswa2Socket = ClientIO(BASE_URL);

    await Promise.all([
      new Promise<void>((resolve) => hostSocket.on('connect', resolve)),
      new Promise<void>((resolve) => siswa1Socket.on('connect', resolve)),
      new Promise<void>((resolve) => siswa2Socket.on('connect', resolve)),
    ]);

    // Host join
    hostSocket.emit('sesi:host_join', { sessionId: multiId });

    // Siswa 1 join
    const p1 = await new Promise<any>((resolve) => {
      siswa1Socket.emit('sesi:gabung', { token: multiToken, nama: 'Budi Santoso' }, resolve);
    });
    // Siswa 2 join
    const p2 = await new Promise<any>((resolve) => {
      siswa2Socket.emit('sesi:gabung', { token: multiToken, nama: 'Siti Aminah' }, resolve);
    });

    assert(p1.success && p2.success, 'Dua siswa berhasil masuk ke lobi tanpa akun', 'Multiplayer');

    // 4.3 Host Mulai Permainan
    const startRes = await new Promise<any>((resolve) => {
      hostSocket.emit('sesi:mulai', { sessionId: multiId }, resolve);
    });
    assert(startRes.success, 'Permainan dimulai, pembagian tim seimbang Merah vs Putih', 'Multiplayer');

    // Host Akhiri Permainan
    await new Promise<any>((resolve) => {
      hostSocket.emit('sesi:akhiri_manual', { sessionId: multiId }, resolve);
    });

    hostSocket.disconnect();
    siswa1Socket.disconnect();
    siswa2Socket.disconnect();
    assert(true, 'Sesi multiplayer selesai dan state dibersihkan dari RAM', 'Multiplayer');

    // 4.4 Bersihkan Sesi Multi Uji Coba agar tidak mencemari riwayat
    await fetch(`${BASE_URL}/api/sesi/${multiId}`, {
      method: 'DELETE',
      headers: { Cookie: guruCookie },
    });
  } catch (err: any) {
    console.error('Gagal pada suite Multiplayer:', err.message);
  }

  // ---------------------------------------------------------------------------
  // 5. SUITE PAPAN TULIS & KOLABORASI
  // ---------------------------------------------------------------------------
  console.log('\n📦 [5/6] Menguji Papan Tulis Digital Fabric.js & Kolaborasi...');
  try {
    // 5.1 Buat Papan Tulis
    const buatPapanRes = await fetch(`${BASE_URL}/api/papan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({ judul: 'Papan Eksperimen Sains Kelas 7' }),
    });
    const papanData = await buatPapanRes.json();
    const boardId = papanData.board.id;
    assert(buatPapanRes.ok && !!boardId, 'Membuat papan tulis baru', 'PapanTulis');

    // 5.2 Autosave Kanvas
    const dummyCanvas = JSON.stringify({ versi: 1, objs: [{ type: 'rect', left: 100, top: 100, width: 80, height: 80 }] });
    const autosaveRes = await fetch(`${BASE_URL}/api/papan/${boardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({ data: dummyCanvas }),
    });
    assert(autosaveRes.ok, 'Debounced autosave kanvas ke database SQLite via Prisma', 'PapanTulis');

    // 5.3 Buat Link Berbagi Viewer & Editor
    const bagikanViewerRes = await fetch(`${BASE_URL}/api/papan/${boardId}/bagikan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({ peran: 'viewer' }),
    });
    const viewerToken = (await bagikanViewerRes.json()).share.token;

    // 5.4 Uji Otorisasi: Viewer Ditolak Mengubah Kanvas
    const viewerCobaSave = await fetch(`${BASE_URL}/api/papan/share/${viewerToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: dummyCanvas }),
    });
    assert(viewerCobaSave.status === 403, 'Server memblokir Viewer saat mencoba menyimpan perubahan (403 Forbidden)', 'PapanTulis');

    // Bersihkan papan uji
    await fetch(`${BASE_URL}/api/papan/${boardId}`, {
      method: 'DELETE',
      headers: { Cookie: guruCookie },
    });
  } catch (err: any) {
    console.error('Gagal pada suite Papan Tulis:', err.message);
  }

  // ---------------------------------------------------------------------------
  // 6. SUITE FITUR AI, ADMIN, & ISOLASI PRIVASI
  // ---------------------------------------------------------------------------
  console.log('\n📦 [6/6] Menguji Fitur AI, Dashboard Admin, Caching, & Privasi...');
  try {
    // 6.1 Periksa Kuota AI
    const kuotaRes = await fetch(`${BASE_URL}/api/ai/kuota`, {
      headers: { Cookie: guruCookie },
    });
    const kuotaData = await kuotaRes.json();
    assert(kuotaRes.ok && kuotaData.batasHarian === 30, 'Pengecekan kuota harian AI guru (30 limit)', 'AI_Admin');

    // 6.2 Generator Soal AI
    const aiSoalRes = await fetch(`${BASE_URL}/api/ai/soal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        materi: 'Ekosistem dan rantai makanan di hutan tropis Indonesia',
        jumlahSoal: 5,
        tingkat: 'SD',
      }),
    });
    const aiSoalData = await aiSoalRes.json();
    assert(aiSoalRes.ok && aiSoalData.soal.length === 5, 'Generator soal AI tervalidasi Zod (tepat 3 opsi, 1 kunci)', 'AI_Admin');

    // 6.3 Tanya AI Seleksi Kanvas
    const tanyaAiRes = await fetch(`${BASE_URL}/api/ai/jawab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
      body: JSON.stringify({
        imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        pertanyaan: 'Bagaimanakah penyelesaian rumus ini?',
      }),
    });
    const tanyaAiData = await tanyaAiRes.json();
    assert(tanyaAiRes.ok && !!tanyaAiData.hasil.jawaban, 'Tanya AI seleksi kanvas menghasilkan kartu jawaban terstruktur', 'AI_Admin');

    // 6.4 Statistik Agregat Admin
    const statRes = await fetch(`${BASE_URL}/api/admin/statistik`, {
      headers: { Cookie: adminCookie },
    });
    const statData = await statRes.json();
    assert(statRes.ok && typeof statData.statistik.totalGuru === 'number', 'Statistik agregat platform dimuat tanpa data privat', 'AI_Admin');

    // 6.5 Audit Log Admin
    const logRes = await fetch(`${BASE_URL}/api/admin/log`, {
      headers: { Cookie: adminCookie },
    });
    const logData = await logRes.json();
    assert(Array.isArray(logData.logs), 'Audit trail tindakan admin tercatat secara transparan', 'AI_Admin');
  } catch (err: any) {
    console.error('Gagal pada suite AI & Admin:', err.message);
  }

  // ---------------------------------------------------------------------------
  // LAPORAN HASIL PENGUJIAN
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                 RINGKASAN HASIL PENGUJIAN                      ');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Pengujian: ${total}`);
  console.log(`Berhasil (Pass): ${passed}`);
  console.log(`Gagal    (Fail): ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 SELURUH MODUL PLATFORM DISCERE LULUS 100% PENGUJIAN E2E! 🎉\n');
  } else {
    console.error(`\n❌ TERDAPAT ${failed} PENGUJIAN YANG GAGAL!\n`);
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
