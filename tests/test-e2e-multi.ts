import { io as ioClient } from 'socket.io-client';

const BASE_URL = 'http://localhost:3000';

async function runTest() {
  console.log('🚀 Memulai Pengujian E2E Multiplayer Discere...');

  // 1. Login Guru
  console.log('1. Login Guru...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/masuk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'guru@discere.local',
      kataSandi: 'GuruDiscere2026!',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login guru gagal: ${await loginRes.text()}`);
  }

  const cookieHeader = loginRes.headers.get('set-cookie');
  if (!cookieHeader) {
    throw new Error('Cookie autentikasi tidak ditemukan.');
  }

  const tokenCookie = cookieHeader.split(';')[0];
  console.log('✓ Login Guru berhasil.');

  // 2. Ambil Template
  console.log('2. Mengambil template materi...');
  const tmplRes = await fetch(`${BASE_URL}/api/template`, {
    headers: { Cookie: tokenCookie },
  });
  const tmplData = await tmplRes.json();
  const template = tmplData.templates[0];
  if (!template) {
    throw new Error('Tidak ada template materi ditemukan.');
  }
  console.log(`✓ Template ditemukan: "${template.judul}" (ID: ${template.id})`);

  // 3. Buat Sesi Multiplayer
  console.log('3. Membuat Sesi Multiplayer...');
  const sesiRes = await fetch(`${BASE_URL}/api/sesi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: tokenCookie,
    },
    body: JSON.stringify({
      templateId: template.id,
      mode: 'multi',
    }),
  });

  const sesiData = await sesiRes.json();
  if (!sesiRes.ok) {
    throw new Error(`Gagal membuat sesi multiplayer: ${JSON.stringify(sesiData)}`);
  }

  const sessionId = sesiData.session.id;
  const token = sesiData.session.token;
  console.log(`✓ Sesi Multiplayer dibuat. SessionId: ${sessionId}, Token PIN: ${token}`);
  if (!token || token.length !== 6) {
    throw new Error(`Token PIN tidak valid: ${token}`);
  }
  if (!sesiData.session.qrDataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('QR Data URL tidak valid.');
  }
  console.log('✓ QR Code terverifikasi.');

  // 4. Uji Endpoint Publik Verifikasi Token
  console.log('4. Menguji endpoint publik validasi token...');
  const tokenCheckRes = await fetch(`${BASE_URL}/api/sesi/token/${token}`);
  const tokenCheckData = await tokenCheckRes.json();
  if (!tokenCheckData.valid || tokenCheckData.sessionId !== sessionId) {
    throw new Error(`Validasi token gagal: ${JSON.stringify(tokenCheckData)}`);
  }
  console.log('✓ Endpoint publik validasi token berhasil diverifikasi.');

  // 5. Hubungkan Host dan 2 Siswa melalui Socket.IO
  console.log('5. Menghubungkan Host dan 2 Siswa ke Socket.IO...');
  const hostSocket = ioClient(BASE_URL, {
    transports: ['websocket'],
    extraHeaders: { cookie: tokenCookie },
  });
  const siswa1Socket = ioClient(BASE_URL, { transports: ['websocket'] });
  const siswa2Socket = ioClient(BASE_URL, { transports: ['websocket'] });

  await Promise.all([
    new Promise((resolve) => hostSocket.on('connect', resolve)),
    new Promise((resolve) => siswa1Socket.on('connect', resolve)),
    new Promise((resolve) => siswa2Socket.on('connect', resolve)),
  ]);
  console.log('✓ Semua socket berhasil terhubung ke server.');

  // Host Join
  hostSocket.emit('sesi:host_join', { sessionId });

  // Siswa 1 Gabung
  const s1JoinPromise = new Promise<any>((resolve) => {
    siswa1Socket.emit('sesi:gabung', { token, nama: 'Budi Santoso' }, resolve);
  });
  // Siswa 2 Gabung
  const s2JoinPromise = new Promise<any>((resolve) => {
    siswa2Socket.emit('sesi:gabung', { token, nama: 'Siti Rahma' }, resolve);
  });

  const [s1JoinRes, s2JoinRes] = await Promise.all([s1JoinPromise, s2JoinPromise]);
  if (!s1JoinRes.success || !s2JoinRes.success) {
    throw new Error(`Siswa gagal bergabung: ${JSON.stringify({ s1JoinRes, s2JoinRes })}`);
  }
  const peserta1Id = s1JoinRes.pesertaId;
  const peserta2Id = s2JoinRes.pesertaId;
  console.log(`✓ Siswa 1 (Budi) ID: ${peserta1Id} dan Siswa 2 (Siti) ID: ${peserta2Id} berhasil bergabung ke lobi.`);

  // 6. Guru Memulai Permainan
  console.log('6. Host memulai permainan (sesi:mulai)...');
  const teamsAssignedPromise = new Promise<any>((resolve) => {
    siswa1Socket.once('teams_assigned', resolve);
  });

  const soal1Promise = new Promise<any>((resolve) => {
    siswa1Socket.once('soal:tampil', resolve);
  });
  const soal2Promise = new Promise<any>((resolve) => {
    siswa2Socket.once('soal:tampil', resolve);
  });

  const startPromise = new Promise<any>((resolve) => {
    hostSocket.emit('sesi:mulai', { sessionId, hostId: 'current-host' }, resolve);
  });

  const [startRes, teamsData, soalData1, soalData2] = await Promise.all([
    startPromise,
    teamsAssignedPromise,
    soal1Promise,
    soal2Promise,
  ]);

  if (!startRes.success) {
    throw new Error(`Gagal memulai sesi: ${JSON.stringify(startRes)}`);
  }
  console.log('✓ Permainan dimulai.');

  // Verifikasi pembagian tim
  const p1 = teamsData.daftarPeserta.find((p: any) => p.id === peserta1Id);
  const p2 = teamsData.daftarPeserta.find((p: any) => p.id === peserta2Id);
  console.log(`✓ Tim Siswa 1: ${p1.tim}, Tim Siswa 2: ${p2.tim}`);
  if (p1.tim === p2.tim) {
    throw new Error('Pembagian tim tidak seimbang: kedua pemain mendapatkan tim yang sama!');
  }
  console.log('✓ Pembagian tim seimbang terverifikasi (Merah vs Putih).');
  const soalMerah = p1.tim === 'merah' ? soalData1 : soalData2;
  console.log(`✓ Soal Tim Merah tampil: "${soalMerah.teks}" (ID: ${soalMerah.questionId})`);

  // 7. Siswa Menjawab Soal
  console.log('7. Mengirimkan jawaban siswa...');
  const taliUpdatePromise = new Promise<any>((resolve) => {
    hostSocket.once('tali:update', resolve);
  });

  // Tentukan siapa di tim merah dan putih
  const merahSocket = p1.tim === 'merah' ? siswa1Socket : siswa2Socket;
  const merahPesertaId = p1.tim === 'merah' ? peserta1Id : peserta2Id;

  const jawabPromise = new Promise<any>((resolve) => {
    merahSocket.emit(
      'jawab:kirim',
      {
        sessionId,
        pesertaId: merahPesertaId,
        presentationId: soalMerah.presentationId,
        choiceId: soalMerah.pilihan?.[0]?.choiceId,
        questionId: soalMerah.questionId,
        jawaban: 'A',
      },
      resolve
    );
  });

  const [jawabRes, taliUpdate] = await Promise.all([jawabPromise, taliUpdatePromise]);
  if (!jawabRes.success || !jawabRes.terkunci) {
    throw new Error(`Jawaban tidak terkunci: ${JSON.stringify(jawabRes)}`);
  }
  if (jawabRes.benar !== undefined || jawabRes.jawabanBenar !== undefined) {
    throw new Error('Kunci jawaban bocor sebelum ronde selesai!');
  }
  console.log(`✓ Jawaban Tim Merah terkunci aman (tanpa bocor kunci sebelum ronde selesai).`);
  console.log(`✓ Posisi tali: ${taliUpdate.taliPosition}, progressTim1=${JSON.stringify(taliUpdate.progressTim1)}`);

  // 8. Guru Mengakhiri Permainan Secara Manual
  console.log('8. Host mengakhiri permainan secara manual...');
  const sesiSelesaiPromise = new Promise<any>((resolve) => {
    siswa1Socket.once('sesi:selesai', resolve);
  });

  const akhiriPromise = new Promise<any>((resolve) => {
    hostSocket.emit('sesi:akhiri_manual', { sessionId }, resolve);
  });

  const [akhiriRes, sesiSelesaiData] = await Promise.all([akhiriPromise, sesiSelesaiPromise]);
  if (!akhiriRes.success) {
    throw new Error(`Gagal mengakhiri permainan: ${JSON.stringify(akhiriRes)}`);
  }
  console.log(`✓ Permainan selesai. Pemenang: ${sesiSelesaiData.hasil.timMenang}, Posisi Akhir: ${sesiSelesaiData.hasil.posisiAkhir}`);

  // 9. Verifikasi Database via REST API
  console.log('9. Memeriksa hasil di database...');
  const hasilRes = await fetch(`${BASE_URL}/api/sesi/${sessionId}/hasil`, {
    headers: { Cookie: tokenCookie },
  });
  const hasilData = await hasilRes.json();
  if (!hasilRes.ok) {
    throw new Error(`Gagal mengambil hasil dari REST API: ${JSON.stringify(hasilData)}`);
  }
  console.log(`✓ REST API /api/sesi/:id/hasil terverifikasi: timMenang=${hasilData.hasil.timMenang}, totalSoal=${hasilData.hasil.totalSoal}`);

  // 10. Main Lagi Test
  console.log('10. Menguji fitur Main Lagi...');
  const mainLagiRes = await fetch(`${BASE_URL}/api/sesi/${sessionId}/main-lagi`, {
    method: 'POST',
    headers: { Cookie: tokenCookie },
  });
  const mainLagiData = await mainLagiRes.json();
  if (!mainLagiRes.ok || !mainLagiData.sessionId) {
    throw new Error(`Gagal membuat sesi main-lagi: ${JSON.stringify(mainLagiData)}`);
  }
  console.log(`✓ Sesi Main Lagi berhasil dibuat. New Session ID: ${mainLagiData.sessionId}, Token: ${mainLagiData.token}`);

  // Bersihkan koneksi socket
  hostSocket.disconnect();
  siswa1Socket.disconnect();
  siswa2Socket.disconnect();

  console.log('\n🎉 SEMUA 10/10 PENGUJIAN E2E MULTIPLAYER BERHASIL DENGAN SEMPURNA! 🎉');
}

runTest().catch((err) => {
  console.error('\n❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
