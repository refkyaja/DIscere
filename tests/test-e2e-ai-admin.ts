import { io as ioClient } from 'socket.io-client';

const BASE_URL = 'http://localhost:3000';

async function runTest() {
  console.log('🚀 Memulai Pengujian E2E Modul AI & Dashboard Admin (Tahap 7)...\n');

  // ==========================================================================
  // BAGIAN 1: PENGUJIAN FITUR AI (GURU)
  // ==========================================================================

  // 1. Login Guru Demo
  console.log('1. Melakukan Login Akun Guru...');
  const loginGuruRes = await fetch(`${BASE_URL}/api/auth/masuk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'guru@discere.local',
      kataSandi: 'GuruDiscere2026!',
    }),
  });

  if (!loginGuruRes.ok) {
    throw new Error(`Login Guru gagal: ${await loginGuruRes.text()}`);
  }
  const loginGuruData = await loginGuruRes.json();
  const guruCookie = loginGuruRes.headers.get('set-cookie')!.split(';')[0];
  console.log(`✓ Login Guru berhasil (${loginGuruData.user.nama}, Role: ${loginGuruData.user.role}).`);

  // 2. Cek Kuota Harian AI
  console.log('2. Memeriksa Kuota Harian AI Guru (GET /api/ai/kuota)...');
  const kuotaRes = await fetch(`${BASE_URL}/api/ai/kuota`, {
    headers: { Cookie: guruCookie },
  });
  if (!kuotaRes.ok) {
    throw new Error(`Gagal memeriksa kuota AI: ${await kuotaRes.text()}`);
  }
  const kuotaData = await kuotaRes.json();
  console.log(`✓ Kuota AI Guru: Sisa ${kuotaData.sisaKuota} / ${kuotaData.batasHarian} request hari ini.`);

  // 3. Buat Soal dari Materi dengan AI (POST /api/ai/soal)
  console.log('3. Menguji Pembuatan Soal dari Teks Materi dengan AI (POST /api/ai/soal)...');
  const sampleMateri = `
    Fotosintesis adalah proses biokimia yang dilakukan oleh tumbuhan berklorofil untuk memproduksi energi berupa glukosa.
    Proses ini membutuhkan tiga komponen utama: air yang diserap akar dari tanah, karbon dioksida yang diambil daun dari udara,
    serta energi foton dari cahaya matahari. Dari reaksi fotosintesis ini, tumbuhan menghasilkan glukosa sebagai sumber nutrisi
    dan melepaskan gas oksigen ke udara yang sangat penting bagi pernapasan makhluk hidup di bumi.
  `;

  const aiSoalRes = await fetch(`${BASE_URL}/api/ai/soal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
    body: JSON.stringify({
      materi: sampleMateri,
      jumlah: 5,
      tingkat: 'SD',
    }),
  });

  if (!aiSoalRes.ok) {
    throw new Error(`Pembuatan soal AI gagal: ${await aiSoalRes.text()}`);
  }
  const aiSoalData = await aiSoalRes.json();
  if (!aiSoalData.soal || aiSoalData.soal.length !== 5) {
    throw new Error(`Jumlah soal tidak sesuai: ${JSON.stringify(aiSoalData)}`);
  }

  // Verifikasi struktur Zod setiap soal
  for (let i = 0; i < aiSoalData.soal.length; i++) {
    const s = aiSoalData.soal[i];
    if (!s.teks || !s.opsiA || !s.opsiB || !s.opsiC || !['A', 'B', 'C', 'D', 'E'].includes(s.jawabanBenar) || !s.penjelasan || !s.dibuatAi) {
      throw new Error(`Struktur soal #${i + 1} tidak valid: ${JSON.stringify(s)}`);
    }
  }
  console.log(`✓ Berhasil membuat ${aiSoalData.soal.length} soal terstruktur dengan AI (dibuatAi=true).`);
  console.log(`  Contoh Soal 1: "${aiSoalData.soal[0].teks}" [Kunci: ${aiSoalData.soal[0].jawabanBenar}]`);

  // 4. Uji Caching SHA-256 AI
  console.log('4. Menguji Caching Cerdas AI (Input identik harus dilayani dari cache)...');
  const aiCacheRes = await fetch(`${BASE_URL}/api/ai/soal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
    body: JSON.stringify({
      materi: sampleMateri,
      jumlah: 5,
      tingkat: 'SD',
    }),
  });
  const aiCacheData = await aiCacheRes.json();
  if (!aiCacheData.dariCache) {
    throw new Error('Hasil seharusnya dilayani dari cache database!');
  }
  console.log('✓ Cache AI terverifikasi: Hasil identik dilayani instan dari tabel ai_cache.');

  // 5. Uji Tanya AI Kanvas Papan Tulis (POST /api/ai/jawab)
  console.log('5. Menguji Fitur Tanya AI dari Potongan Kanvas Papan Tulis (POST /api/ai/jawab)...');
  // Dummy 1x1 transparent PNG base64
  const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const tanyaAiRes = await fetch(`${BASE_URL}/api/ai/jawab`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: guruCookie },
    body: JSON.stringify({
      imageBase64: dummyBase64,
      pertanyaan: 'Berapakah kecepatan rata-rata benda yang menempuh jarak 100 meter dalam waktu 5 detik?',
    }),
  });

  if (!tanyaAiRes.ok) {
    throw new Error(`Tanya AI gagal: ${await tanyaAiRes.text()}`);
  }
  const tanyaAiData = await tanyaAiRes.json();
  if (!tanyaAiData.hasil?.jawaban || !tanyaAiData.hasil?.langkah || !tanyaAiData.hasil?.dibuatAi) {
    throw new Error(`Format Tanya AI tidak sesuai: ${JSON.stringify(tanyaAiData)}`);
  }
  console.log(`✓ Tanya AI Kanvas berhasil: "${tanyaAiData.hasil.jawaban.slice(0, 50)}..."`);

  // ==========================================================================
  // BAGIAN 2: PENGUJIAN DASHBOARD ADMIN
  // ==========================================================================

  // 6. Login Admin
  console.log('\n6. Melakukan Login Akun Administrator...');
  const loginAdminRes = await fetch(`${BASE_URL}/api/auth/masuk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@discere.local',
      kataSandi: 'AdminDiscere2026!',
    }),
  });

  if (!loginAdminRes.ok) {
    throw new Error(`Login Admin gagal: ${await loginAdminRes.text()}`);
  }
  const loginAdminData = await loginAdminRes.json();
  const adminCookie = loginAdminRes.headers.get('set-cookie')!.split(';')[0];
  console.log(`✓ Login Administrator berhasil (${loginAdminData.user.nama}, Role: ${loginAdminData.user.role}).`);

  // 7. Ambil Statistik Platform Agregat (GET /api/admin/statistik)
  console.log('7. Mengambil Statistik Agregat Platform (GET /api/admin/statistik)...');
  const statRes = await fetch(`${BASE_URL}/api/admin/statistik`, {
    headers: { Cookie: adminCookie },
  });
  if (!statRes.ok) {
    throw new Error(`Gagal mengambil statistik: ${await statRes.text()}`);
  }
  const statData = await statRes.json();
  const s = statData.statistik;
  if (typeof s.totalGuru !== 'number' || typeof s.totalTemplate !== 'number' || !Array.isArray(s.grafikAktivitas)) {
    throw new Error(`Struktur statistik tidak valid: ${JSON.stringify(s)}`);
  }
  console.log(`✓ Statistik Platform: ${s.totalGuru} Guru, ${s.totalTemplate} Template, ${s.totalSesi} Sesi, ${s.totalPapan} Papan.`);

  // 8. Kelola Guru (GET /api/admin/guru)
  console.log('8. Mengambil Daftar Akun Guru (GET /api/admin/guru)...');
  const guruListRes = await fetch(`${BASE_URL}/api/admin/guru`, {
    headers: { Cookie: adminCookie },
  });
  const guruListData = await guruListRes.json();
  if (!Array.isArray(guruListData.guru) || guruListData.guru.length === 0) {
    throw new Error('Daftar guru kosong atau tidak valid.');
  }
  const targetGuru = guruListData.guru.find((g: any) => g.email === 'guru@discere.local');
  if (!targetGuru) {
    throw new Error('Akun guru demo tidak ditemukan dalam daftar admin.');
  }
  console.log(`✓ Daftar ${guruListData.guru.length} akun guru berhasil dimuat.`);

  // 9. Ubah Status Guru dan Reset Kata Sandi (PATCH /api/admin/guru/:id)
  console.log('9. Menguji Pengubahan Status & Reset Kata Sandi Guru (PATCH /api/admin/guru/:id)...');
  const ubahStatusRes = await fetch(`${BASE_URL}/api/admin/guru/${targetGuru.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ status: 'nonaktif' }),
  });
  if (!ubahStatusRes.ok) {
    throw new Error(`Gagal mengubah status: ${await ubahStatusRes.text()}`);
  }
  console.log('✓ Status akun guru berhasil diubah menjadi "nonaktif".');

  // Kembalikan ke aktif dan reset password
  const aktifkanDanResetRes = await fetch(`${BASE_URL}/api/admin/guru/${targetGuru.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ status: 'aktif', resetPassword: true }),
  });
  const aktifkanData = await aktifkanDanResetRes.json();
  if (aktifkanData.guru.status !== 'aktif' || !aktifkanData.passwordBaru) {
    throw new Error(`Gagal mengaktifkan kembali dan reset: ${JSON.stringify(aktifkanData)}`);
  }
  console.log(`✓ Akun guru diaktifkan kembali dan kata sandi direset: "${aktifkanData.passwordBaru}"`);

  // Kembalikan kata sandi guru demo ke semula
  const bcrypt = await import('bcryptjs');
  const { prisma } = await import('../server/src/db.js');
  const salt = await bcrypt.genSalt(10);
  await prisma.user.update({
    where: { id: targetGuru.id },
    data: { passwordHash: await bcrypt.hash('GuruDiscere2026!', salt) },
  });

  // 10. CRUD Pustaka Template Resmi Admin (POST / PUT / DELETE /api/admin/pustaka)
  console.log('10. Menguji Manajemen Pustaka Template Resmi (POST/PUT/DELETE /api/admin/pustaka)...');
  const buatPustakaRes = await fetch(`${BASE_URL}/api/admin/pustaka`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      judul: 'Tata Surya dan Planet Kelas 6 SD (Resmi)',
      game: 'tarik_tambang',
      mode: 'solo',
      questions: [
        {
          urutan: 1,
          teks: 'Planet terdekat dengan matahari adalah...',
          opsiA: 'Merkurius',
          opsiB: 'Venus',
          opsiC: 'Bumi',
          jawabanBenar: 'A',
          penjelasan: 'Merkurius merupakan planet dengan jarak terdekat dari matahari.',
        },
      ],
    }),
  });

  if (!buatPustakaRes.ok) {
    throw new Error(`Gagal membuat template resmi: ${await buatPustakaRes.text()}`);
  }
  const pustakaBaru = (await buatPustakaRes.json()).template;
  console.log(`✓ Template resmi dibuat: "${pustakaBaru.judul}" (ID: ${pustakaBaru.id})`);

  // Hapus template resmi uji
  const hapusPustakaRes = await fetch(`${BASE_URL}/api/admin/pustaka/${pustakaBaru.id}`, {
    method: 'DELETE',
    headers: { Cookie: adminCookie },
  });
  if (!hapusPustakaRes.ok) {
    throw new Error('Gagal menghapus template resmi.');
  }
  console.log('✓ Template resmi uji berhasil dibersihkan.');

  // 11. Monitoring AI Admin (GET /api/admin/ai)
  console.log('11. Menguji Monitoring Pemakaian AI Platform (GET /api/admin/ai)...');
  const aiMonRes = await fetch(`${BASE_URL}/api/admin/ai`, {
    headers: { Cookie: adminCookie },
  });
  const aiMonData = await aiMonRes.json();
  if (typeof aiMonData.aiMonitoring.totalPanggilanSeluruhnya !== 'number') {
    throw new Error('Data monitoring AI tidak valid.');
  }
  console.log(`✓ Monitoring AI Platform: Total ${aiMonData.aiMonitoring.totalPanggilanSeluruhnya} panggilan tercatat.`);

  // 12. Audit Log Tindakan Admin (GET /api/admin/log)
  console.log('12. Memeriksa Audit Trail Log Tindakan Admin (GET /api/admin/log)...');
  const logRes = await fetch(`${BASE_URL}/api/admin/log`, {
    headers: { Cookie: adminCookie },
  });
  const logData = await logRes.json();
  if (!Array.isArray(logData.logs) || logData.logs.length === 0) {
    throw new Error('Log audit admin kosong!');
  }
  console.log(`✓ Audit Log Admin: ${logData.logs.length} tindakan tercatat secara transparan.`);
  console.log(`  Log Terakhir: "${logData.logs[0].aksi}" oleh ${logData.logs[0].admin?.email}`);

  // 13. Verifikasi Isolasi Privasi: Admin DITOLAK mengakses data privat guru
  console.log('13. Menguji Isolasi Privasi (Admin Ditolak membuka rute privat papan guru)...');
  // Ambil salah satu papan milik guru
  const papanGuru = await prisma.board.findFirst({
    where: { ownerId: targetGuru.id },
  });

  if (papanGuru) {
    const adminAksesPapanRes = await fetch(`${BASE_URL}/api/papan/${papanGuru.id}`, {
      headers: { Cookie: adminCookie },
    });
    if (adminAksesPapanRes.status !== 403) {
      throw new Error(`Privasi bocor: Admin seharusnya ditolak (403), tetapi menghasilkan ${adminAksesPapanRes.status}`);
    }
    console.log('✓ Isolasi Privasi Terverifikasi: Admin berhasil ditolak (403 Forbidden) saat mencoba membuka papan tulis privat guru.');
  }

  console.log('\n🎉 SEMUA 13/13 PENGUJIAN E2E MODUL AI & DASHBOARD ADMIN BERHASIL DENGAN SEMPURNA! 🎉');
}

runTest().catch((err) => {
  console.error('\n❌ PENGUJIAN TAHAP 7 GAGAL:', err);
  process.exit(1);
});
