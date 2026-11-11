import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { apiRequest } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { VisualisasiTali } from './VisualisasiTali';
import KarakterTarikTambang, { EkspresiTarikTambang } from '../siswa/KarakterTarikTambang';
import { Button, Modal } from '../../components';
import { soundEffects } from '../../lib/soundEffects';
import {
  Trophy,
  Users,
  Play,
  StopCircle,
  Clock,
  RotateCcw,
  Loader2,
  ShieldAlert,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Home,
} from 'lucide-react';

interface PesertaItem {
  id: string;
  nama: string;
  tim: 'merah' | 'putih' | null;
  connected: boolean;
}

interface SoalItem {
  id: string;
  nomorSoal: number;
  totalSoal: number;
  teks: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  endsAt?: number;
}

interface HasilPermainan {
  timMenang: 'merah' | 'putih' | 'seri';
  posisiAkhir: number;
  skorMerah: number;
  skorPutih: number;
}

export default function LayarHostMulti() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Status dasar sesi
  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [templateJudul, setTemplateJudul] = useState('');
  const [token, setToken] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'lobi' | 'jalan' | 'selesai'>('lobi');

  // Peserta
  const [daftarPeserta, setDaftarPeserta] = useState<PesertaItem[]>([]);
  const [totalPeserta, setTotalPeserta] = useState(0);

  // In-Game
  const [soalAktif, setSoalAktif] = useState<SoalItem | null>(null);
  const [sisaDetik, setSisaDetik] = useState(15);
  const [taliPosition, setTaliPosition] = useState(0);
  const [skorMerah, setSkorMerah] = useState(0);
  const [skorPutih, setSkorPutih] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [reaksiTarik, setReaksiTarik] = useState<{
    merah?: EkspresiTarikTambang;
    putih?: EkspresiTarikTambang;
  } | null>(null);

  // Intermission (Penjelasan & Jawaban Benar per Soal)
  const [rekapSoal, setRekapSoal] = useState<{
    tampil: boolean;
    jawabanBenar?: string;
    penjelasan?: string | null;
    benarCount?: number;
    salahCount?: number;
  } | null>(null);

  // Hasil Akhir
  const [hasilAkhir, setHasilAkhir] = useState<HasilPermainan | null>(null);

  // Modal Akhiri
  const [modalAkhiriOpen, setModalAkhiriOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isMuted, setIsMuted] = useState(soundEffects.getMuted());
  const [isMainLagiLoading, setIsMainLagiLoading] = useState(false);

  // Refs timer & posisi tali sebelumnya untuk memicu ekspresi karakter saat tali ditarik
  const countdownIntervalRef = useRef<any>(null);
  const reactionTimeoutRef = useRef<any>(null);
  const prevTaliPosRef = useRef(0);

  // Fungsi sinkronisasi timer lokal dengan endsAt dari server
  const startCountdown = useCallback((endsAtTimestamp?: number) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (!endsAtTimestamp) {
      setSisaDetik(15);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diffMs = endsAtTimestamp - now;
      const detik = Math.max(0, Math.ceil(diffMs / 1000));
      setSisaDetik(detik);
      if (detik <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    };

    updateTimer();
    countdownIntervalRef.current = setInterval(updateTimer, 200);
  }, []);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
    };
  }, []);

  // 1. Fetch data awal sesi dari REST API
  const fetchSesi = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiRequest<{ session: any }>(`/sesi/${id}`);
      const s = res.session;

      setTemplateJudul(s.templateJudul);
      setToken(s.token);
      setQrDataUrl(s.qrDataUrl || '');
      setJoinUrl(s.joinUrl || '');
      setStatus(s.status);
      const initPos = s.taliPosition ?? 0;
      prevTaliPosRef.current = initPos;
      setTaliPosition(initPos);
      setSkorMerah(s.skorMerah ?? 0);
      setSkorPutih(s.skorPutih ?? 0);
      setTotalPeserta(s.totalPeserta ?? 0);
      setDaftarPeserta(s.daftarPeserta || []);

      if (s.status === 'jalan' && s.soalSaatIni) {
        setSoalAktif(s.soalSaatIni);
        startCountdown(s.soalSaatIni.endsAt);
      } else if (s.status === 'selesai') {
        setStatus('selesai');
      }
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal memuat sesi permainan.');
    } finally {
      setLoading(false);
    }
  }, [id, startCountdown]);

  useEffect(() => {
    fetchSesi();
  }, [fetchSesi]);

  // 2. Setup Socket.IO Event Listener untuk Host
  useEffect(() => {
    if (!id) return;

    const socket = getSocket();

    socket.emit('sesi:host_join', { sessionId: id });

    const handleLobiUpdate = (data: { totalPeserta: number; daftarPeserta: PesertaItem[] }) => {
      setTotalPeserta(data.totalPeserta);
      setDaftarPeserta(data.daftarPeserta);
    };

    const handleTeamsAssigned = (data: { daftarPeserta: PesertaItem[] }) => {
      setDaftarPeserta(data.daftarPeserta);
    };

    const handleSoalTampil = (data: any) => {
      setStatus('jalan');
      setSoalAktif({
        id: data.questionId,
        nomorSoal: data.nomorSoal,
        totalSoal: data.totalSoal,
        teks: data.teks,
        opsiA: data.opsiA,
        opsiB: data.opsiB,
        opsiC: data.opsiC,
        endsAt: data.endsAt,
      });
      setAnsweredCount(0);
      setRekapSoal(null);
      setReaksiTarik(null);
      startCountdown(data.endsAt);
      soundEffects.playWhistle();
    };

    const handleTaliUpdate = (data: {
      taliPosition: number;
      skorMerah: number;
      skorPutih: number;
      answeredCount?: number;
    }) => {
      const prevPos = prevTaliPosRef.current;
      prevTaliPosRef.current = data.taliPosition;

      setTaliPosition(data.taliPosition);
      setSkorMerah(data.skorMerah);
      setSkorPutih(data.skorPutih);
      if (data.answeredCount !== undefined) {
        setAnsweredCount(data.answeredCount);
      }

      if (data.taliPosition < prevPos) {
        setReaksiTarik({ merah: 'bahagia', putih: 'sedih' });
      } else if (data.taliPosition > prevPos) {
        setReaksiTarik({ putih: 'bahagia', merah: 'sedih' });
      } else {
        setReaksiTarik({ merah: 'semangat', putih: 'semangat' });
      }

      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
      reactionTimeoutRef.current = setTimeout(() => setReaksiTarik(null), 1500);

      soundEffects.playRopeTug();
    };

    const handleSoalSelesai = (data: {
      questionIndex: number;
      jawabanBenar: string;
      penjelasan?: string | null;
      taliPosition: number;
      skorMerah: number;
      skorPutih: number;
      isGameFinished: boolean;
      stats?: { benar: number; salah: number; tidakJawab: number };
    }) => {
      prevTaliPosRef.current = data.taliPosition;
      setTaliPosition(data.taliPosition);
      setSkorMerah(data.skorMerah);
      setSkorPutih(data.skorPutih);

      setRekapSoal({
        tampil: true,
        jawabanBenar: data.jawabanBenar,
        penjelasan: data.penjelasan,
        benarCount: data.stats?.benar,
        salahCount: data.stats?.salah,
      });

      if (data.stats && data.stats.benar > 0) {
        soundEffects.playCorrect();
      }
    };

    const handleSesiSelesai = (data: { hasil: HasilPermainan }) => {
      setHasilAkhir(data.hasil);
      setStatus('selesai');
      soundEffects.playVictoryFanfare();
    };

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('teams_assigned', handleTeamsAssigned);
    socket.on('soal:tampil', handleSoalTampil);
    socket.on('tali:update', handleTaliUpdate);
    socket.on('soal:selesai', handleSoalSelesai);
    socket.on('sesi:selesai', handleSesiSelesai);

    return () => {
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('teams_assigned', handleTeamsAssigned);
      socket.off('soal:tampil', handleSoalTampil);
      socket.off('tali:update', handleTaliUpdate);
      socket.off('soal:selesai', handleSoalSelesai);
      socket.off('sesi:selesai', handleSesiSelesai);
    };
  }, [id, startCountdown]);

  const handleMulaiLomba = () => {
    if (!id) return;
    const socket = getSocket();
    socket.emit('sesi:mulai', { sessionId: id, hostId: 'current-host' }, (res: any) => {
      if (!res?.success) {
        alert(res?.pesan || 'Gagal memulai permainan.');
      }
    });
  };

  const handleAkhiriPermainan = () => {
    if (!id) return;
    setIsEnding(true);
    const socket = getSocket();
    socket.emit('sesi:akhiri_manual', { sessionId: id }, (res: any) => {
      setIsEnding(false);
      setModalAkhiriOpen(false);
      if (res?.success && res.hasil) {
        setHasilAkhir(res.hasil);
        setStatus('selesai');
      } else {
        alert(res?.pesan || 'Gagal mengakhiri permainan.');
      }
    });
  };

  const handleMainLagi = async () => {
    if (!id) return;
    try {
      setIsMainLagiLoading(true);
      const res = await apiRequest<{ sessionId: string }>(`/sesi/${id}/main-lagi`, {
        method: 'POST',
      });
      navigate(`/guru/sesi/${res.sessionId}`);
      window.location.reload();
    } catch (err: any) {
      alert(err.pesan || 'Gagal membuat sesi baru.');
      setIsMainLagiLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderChalkLedge = () => (
    <div className="portal-ledge" aria-hidden="true">
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
        <path d="M0 34C240 6 480 62 720 34S1200 6 1440 34V80H0z" fill="#a6783c" />
        <path d="M0 56C260 34 520 80 760 56S1220 36 1440 58V80H0z" fill="#8d6444" />
      </svg>
      <div className="portal-chalks">
        <i style={{ width: '84px', background: '#7a9c85' }} />
        <i style={{ width: '70px', background: '#f2c230' }} />
        <i style={{ width: '92px', background: '#f4ecd8' }} />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="portal-bg min-h-screen flex flex-col items-center justify-center text-[#f4ecd8]">
        <Loader2 className="w-10 h-10 animate-spin text-[#f2c230] mb-4" />
        <p className="portal-cv text-3xl">Menyiapkan arena tarik tambang...</p>
      </div>
    );
  }

  if (errorPesan) {
    return (
      <div className="portal-bg min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="portal-card p-8 max-w-md w-full border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.2)] rounded-3xl">
          <ShieldAlert className="w-12 h-12 text-[#c8362f] mx-auto mb-4" />
          <h2 className="portal-cv text-3xl text-[#1d3b2e] mb-2">Terjadi Kesalahan</h2>
          <p className="text-sm text-[#6b7d6c] mb-6">{errorPesan}</p>
          <button
            type="button"
            className="portal-btn red w-full"
            onClick={() => navigate('/guru')}
          >
            Kembali ke Dashboard Guru
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: LOBI MULTIPLAYER (Sebelum Mulai Lomba)
  // =========================================================================
  if (status === 'lobi') {
    const formattedToken = token.split('').join(' ');

    return (
      <div className="portal-bg min-h-screen flex flex-col justify-between select-none">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 space-y-6 flex-1 flex flex-col justify-between">
          {/* Header Layar Proyektor */}
          <header className="portal-card flex flex-wrap justify-between items-center gap-4 p-4 sm:p-6 rounded-3xl border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)]">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs uppercase font-extrabold tracking-wider px-3 py-1 bg-[#f8e7b0] border border-[#e0d5b8] text-[#8a6a00] rounded-full">
                  Mode Multiplayer • Tarik Tambang
                </span>
                <span className="text-xs font-semibold text-[#6b7d6c]">
                  Pembagian Tim Otomatis &amp; Seimbang
                </span>
              </div>
              <h1 className="portal-cv text-2xl sm:text-3xl font-extrabold text-[#1d3b2e]">
                {templateJudul}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMuted(soundEffects.toggleMute())}
                className="p-2.5 rounded-2xl border-2 border-[#e0d5b8] bg-[#fbf6e9] text-[#1d3b2e] hover:bg-[#f4ecd9] shadow-sm transition-colors cursor-pointer"
                title={isMuted ? 'Nyalakan Efek Suara' : 'Bisukan Efek Suara'}
                aria-label={isMuted ? 'Nyalakan Efek Suara' : 'Bisukan Efek Suara'}
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-[#c8362f]" />
                ) : (
                  <Volume2 className="w-5 h-5 text-[#2e7d32]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/guru')}
                className="px-4 py-2.5 rounded-2xl font-bold text-sm bg-[#f4ecd9] hover:bg-[#e8dfc8] text-[#1d3b2e] border-2 border-[#e0d5b8] transition-colors cursor-pointer"
              >
                Kembali ke Dashboard
              </button>
            </div>
          </header>

          {/* Konten Lobi: Kode PIN, QR Code & Daftar Peserta */}
          <main className="my-auto py-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Kolom Kiri: PIN & QR Code */}
            <div className="lg:col-span-5 portal-card flex flex-col items-center justify-center text-center p-6 sm:p-8 rounded-3xl border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)] space-y-5">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-widest text-[#c8362f] mb-1">
                  Bergabung dari HP Siswa
                </div>
                <p className="text-xs text-[#6b7d6c]">
                  Pindai QR Code atau masukkan kode PIN 6 angka pada layar siswa
                </p>
              </div>

              {/* Display PIN Raksasa untuk Proyektor */}
              <div className="w-full py-4 px-5 bg-[#1d3b2e] border-2 border-[#152b22] rounded-2xl shadow-inner">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#f4ecd8]/80 block mb-1">
                  Kode PIN Sesi
                </span>
                <span className="text-4xl sm:text-5xl font-black tracking-widest text-[#f2c230] font-mono select-all">
                  {formattedToken}
                </span>
              </div>

              {/* QR Code */}
              {qrDataUrl && (
                <div className="p-3 bg-white rounded-2xl border-2 border-[#1d3b2e] shadow-sm">
                  <img
                    src={qrDataUrl}
                    alt="QR Code Gabung"
                    className="w-44 h-44 sm:w-52 sm:h-52 rounded-lg"
                  />
                </div>
              )}

              {joinUrl && (
                <div className="w-full space-y-2">
                  <p className="text-xs text-[#1f4a6b] font-mono break-all bg-[#fffdf6] border border-[#e0d5b8] px-3 py-2 rounded-xl">
                    {joinUrl}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border border-[#e0d5b8] bg-white hover:bg-[#f4ecd9] text-[#1d3b2e] cursor-pointer transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#2e7d32]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Tautan Disalin!' : 'Salin Tautan Gabung'}
                  </button>
                </div>
              )}
            </div>

            {/* Kolom Kanan: Pratinjau Karakter 2D Tim, Daftar Siswa & Tombol Mulai */}
            <div className="lg:col-span-7 portal-card flex flex-col justify-between p-6 sm:p-8 rounded-3xl border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)] space-y-5">
              <div className="space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b-2 border-dashed border-[#e0d5b8]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#f4ecd9] border border-[#e0d5b8] flex items-center justify-center text-[#c8362f]">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="portal-cv text-2xl font-extrabold text-[#1d3b2e]">
                        Siswa Bergabung ({totalPeserta})
                      </h2>
                      <p className="text-xs text-[#6b7d6c]">
                        Tim Merah vs Tim Putih akan dibagi adil secara otomatis
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                      totalPeserta >= 2
                        ? 'bg-[#d8e3cf] text-[#1b432a]'
                        : 'bg-[#f8e7b0] text-[#8a6a00]'
                    }`}
                  >
                    {totalPeserta >= 2 ? 'Siap Dimulai' : 'Menunggu Minimal 2 Siswa'}
                  </span>
                </div>

                {/* Banner Duel Tim Merah vs Tim Putih Berkarakter 2D */}
                <div className="bg-gradient-to-r from-[#fbf0ee] via-[#fffdf6] to-[#edf4fb] border border-[#e0d5b8] rounded-2xl px-4 py-3 flex items-center justify-around gap-3">
                  <div className="flex items-center gap-2">
                    <KarakterTarikTambang tim="merah" pose="siap" ekspresi="semangat" size="xs" />
                    <span className="font-black text-sm text-[#c8362f]">Tim Merah</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#1d3b2e] text-[#f2c230] font-black text-xs">
                    VS
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-[#1f4a6b]">Tim Putih</span>
                    <KarakterTarikTambang tim="putih" pose="siap" ekspresi="semangat" size="xs" />
                  </div>
                </div>

                {/* Grid Nama Siswa */}
                {daftarPeserta.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-[#e0d5b8] rounded-2xl bg-[#fffdf6]/70">
                    <Users className="w-10 h-10 text-[#6b7d6c]/50 mx-auto mb-2 animate-pulse" />
                    <p className="text-[#1d3b2e] font-bold text-sm">Belum ada siswa yang bergabung</p>
                    <p className="text-[#6b7d6c] text-xs mt-1">
                      Minta siswa mengetik PIN atau memindai QR code di samping
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-3 bg-[#fffdf6] rounded-2xl border border-[#e0d5b8]">
                    {daftarPeserta.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4ecd9] border border-[#e0d5b8] text-[#1d3b2e] font-bold text-sm shadow-xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#2e7d32] animate-pulse" />
                        <span>{p.nama}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tombol Mulai Lomba */}
              <div className="pt-4 border-t-2 border-dashed border-[#e0d5b8]">
                <button
                  type="button"
                  onClick={handleMulaiLomba}
                  disabled={totalPeserta < 2}
                  className={`w-full py-4 rounded-2xl text-lg font-black flex items-center justify-center gap-3 transition-all ${
                    totalPeserta < 2
                      ? 'bg-[#d8cbb0] text-[#8c8270] cursor-not-allowed'
                      : 'portal-btn red shadow-md cursor-pointer'
                  }`}
                >
                  <Play className="w-6 h-6 fill-current" />
                  <span>Mulai Lomba Sekarang</span>
                </button>
                {totalPeserta < 2 && (
                  <p className="text-center text-xs text-[#6b7d6c] font-semibold mt-2">
                    Minimal dibutuhkan 2 siswa untuk memulai permainan tarik tambang.
                  </p>
                )}
              </div>
            </div>
          </main>
        </div>

        {renderChalkLedge()}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ARENA PERTANDINGAN (Status 'jalan')
  // =========================================================================
  if (status === 'jalan') {
    const timMerahPeserta = daftarPeserta.filter((p) => p.tim === 'merah');
    const timPutihPeserta = daftarPeserta.filter((p) => p.tim === 'putih');

    return (
      <div className="portal-bg min-h-screen flex flex-col justify-between select-none">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 space-y-5">
          {/* Header Proyektor */}
          <header className="portal-card flex flex-wrap justify-between items-center gap-4 p-4 sm:p-5 rounded-3xl border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)]">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2.5">
                <span className="text-xs uppercase font-extrabold tracking-wider px-3 py-1 bg-[#f8e7b0] border border-[#e0d5b8] text-[#8a6a00] rounded-full">
                  Mode Multiplayer • Tarik Tambang
                </span>
                {soalAktif && (
                  <span className="text-xs font-bold text-[#6b7d6c]">
                    Soal {soalAktif.nomorSoal} dari {soalAktif.totalSoal}
                  </span>
                )}
              </div>
              <h1 className="portal-cv text-2xl sm:text-3xl font-extrabold text-[#1d3b2e]">
                {templateJudul}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMuted(soundEffects.toggleMute())}
                className="p-2.5 rounded-2xl border-2 border-[#e0d5b8] bg-[#fbf6e9] text-[#1d3b2e] hover:bg-[#f4ecd9] shadow-sm transition-colors cursor-pointer"
                title={isMuted ? 'Nyalakan Efek Suara' : 'Bisukan Efek Suara'}
                aria-label={isMuted ? 'Nyalakan Efek Suara' : 'Bisukan Efek Suara'}
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-[#c8362f]" />
                ) : (
                  <Volume2 className="w-5 h-5 text-[#2e7d32]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setModalAkhiriOpen(true)}
                className="px-4 py-2.5 rounded-2xl font-bold text-sm inline-flex items-center gap-2 bg-[#c8362f] hover:bg-[#b52a23] text-white border-2 border-[#a3221c] shadow-sm transition-all cursor-pointer"
              >
                <StopCircle className="w-4 h-4 text-white" />
                <span>Akhiri Permainan</span>
              </button>
            </div>
          </header>

          {/* 1. Panggung Visualisasi Tarik Tambang 2D */}
          <VisualisasiTali
            posisi={taliPosition}
            skorMerah={skorMerah}
            skorPutih={skorPutih}
            jumlahPemainMerah={timMerahPeserta.length}
            jumlahPemainPutih={timPutihPeserta.length}
            reaksiTim={reaksiTarik || undefined}
            theme="chalk"
          />

          {/* 2. Soal & Indikator Waktu */}
          <div className="portal-card rounded-3xl p-6 sm:p-7 border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)]">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-[#1d3b2e] text-[#f4ecd8]">
                  Soal {soalAktif?.nomorSoal ?? '-'} dari {soalAktif?.totalSoal ?? '-'}
                </span>
                <span className="text-xs font-bold text-[#6b7d6c]">
                  {answeredCount} dari {totalPeserta} siswa telah menjawab
                </span>
              </div>

              <div
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-black text-sm border-2 ${
                  sisaDetik <= 5
                    ? 'bg-[#fde8e7] text-[#c8362f] border-[#c8362f] animate-pulse'
                    : 'bg-[#f4ecd9] text-[#1d3b2e] border-[#e0d5b8]'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{sisaDetik} Detik</span>
              </div>
            </div>

            {/* Bar Timer */}
            <div className="w-full bg-[#e0d5b8] h-2.5 rounded-full overflow-hidden mb-5">
              <div
                className={`h-full transition-all duration-300 ease-linear ${
                  sisaDetik <= 5 ? 'bg-[#c8362f]' : 'bg-[#1d3b2e]'
                }`}
                style={{ width: `${Math.min(100, (sisaDetik / 15) * 100)}%` }}
              />
            </div>

            {/* Teks Pertanyaan Besar Proyektor */}
            <h2 className="portal-cv text-2xl sm:text-3xl md:text-4xl text-[#1d3b2e] text-center leading-snug mb-6 px-2">
              {soalAktif?.teks}
            </h2>

            {/* 3 Opsi Jawaban (A, B, C) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['A', 'B', 'C'] as const).map((opsiKey) => {
                const teksOpsi =
                  opsiKey === 'A'
                    ? soalAktif?.opsiA
                    : opsiKey === 'B'
                    ? soalAktif?.opsiB
                    : soalAktif?.opsiC;

                const isBenar = rekapSoal?.tampil && rekapSoal.jawabanBenar === opsiKey;

                return (
                  <div
                    key={opsiKey}
                    className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start gap-3.5 ${
                      isBenar
                        ? 'bg-[#2e7d32] border-[#1b5e20] text-white shadow-md scale-[1.02]'
                        : 'bg-[#fffdf6] border-[#e0d5b8] text-[#1d3b2e]'
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        isBenar
                          ? 'bg-white/25 text-white'
                          : 'bg-[#e8dfc8] text-[#1d3b2e]'
                      }`}
                    >
                      {opsiKey}
                    </span>
                    <span className="text-base sm:text-lg font-bold leading-snug self-center">
                      {teksOpsi}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Rekap Intermission Pembahasan Soal */}
            {rekapSoal?.tampil && (
              <div className="mt-5 p-4 rounded-2xl bg-[#e8f5e9] border-2 border-[#2e7d32] text-[#1b5e20] text-sm space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-base">
                    Pembahasan Soal • Kunci Jawaban: Opsi {rekapSoal.jawabanBenar}
                  </span>
                  <div className="flex items-center gap-3 text-xs font-extrabold">
                    <span className="text-[#1b5e20]">✓ {rekapSoal.benarCount ?? 0} Benar</span>
                    <span className="text-[#c8362f]">✗ {rekapSoal.salahCount ?? 0} Salah</span>
                  </div>
                </div>
                {rekapSoal.penjelasan && (
                  <p className="text-xs text-[#1d3b2e]/90">💡 {rekapSoal.penjelasan}</p>
                )}
                <div className="text-xs font-bold text-[#6b7d6c]">
                  Soal berikutnya akan segera dimulai...
                </div>
              </div>
            )}
          </div>

          {/* 3. Daftar Anggota Tim Merah vs Tim Putih */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#fbf0ee] border-2 border-[#d9544c]/70 shadow-xs">
              <div className="flex justify-between items-center mb-2.5">
                <span className="font-black text-xs text-[#c8362f] uppercase tracking-wider">
                  Tim Merah ({timMerahPeserta.length} Siswa)
                </span>
                <span className="text-xs font-black text-white bg-[#c8362f] px-2.5 py-0.5 rounded-full">
                  {skorMerah} Poin
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {timMerahPeserta.map((p) => (
                  <span
                    key={p.id}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-[#d9544c]/40 text-[#c8362f]"
                  >
                    {p.nama}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#edf4fb] border-2 border-[#2b6cb0]/70 shadow-xs">
              <div className="flex justify-between items-center mb-2.5">
                <span className="font-black text-xs text-[#1f4a6b] uppercase tracking-wider">
                  Tim Putih ({timPutihPeserta.length} Siswa)
                </span>
                <span className="text-xs font-black text-white bg-[#1f4a6b] px-2.5 py-0.5 rounded-full">
                  {skorPutih} Poin
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {timPutihPeserta.map((p) => (
                  <span
                    key={p.id}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-[#2b6cb0]/40 text-[#1f4a6b]"
                  >
                    {p.nama}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Konfirmasi Akhiri Permainan */}
        <Modal
          isOpen={modalAkhiriOpen}
          onClose={() => setModalAkhiriOpen(false)}
          title="Akhiri Permainan?"
        >
          <div className="space-y-4">
            <p className="text-[#1d3b2e] dark:!text-[#1d3b2e] text-base font-medium leading-relaxed">
              Apakah Anda yakin ingin mengakhiri sesi permainan ini sekarang? Skor dan posisi tali saat ini akan disimpan sebagai hasil akhir.
            </p>
            <div className="flex justify-end items-center gap-3 pt-4 border-t-2 border-dashed border-[#e0d5b8]">
              <button
                type="button"
                className="px-4 py-2 text-sm font-bold text-[#1d3b2e] dark:!text-[#1d3b2e] hover:bg-[#e8dfc8] rounded-xl transition-colors cursor-pointer"
                onClick={() => setModalAkhiriOpen(false)}
                disabled={isEnding}
              >
                Batal
              </button>
              <Button
                variant="utama"
                onClick={handleAkhiriPermainan}
                disabled={isEnding}
                className="bg-[#c8362f] hover:bg-[#b52a23] text-white"
              >
                {isEnding ? 'Mengakhiri...' : 'Ya, Akhiri Sekarang'}
              </Button>
            </div>
          </div>
        </Modal>

        {renderChalkLedge()}
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: HASIL AKHIR PERMAINAN (Status 'selesai')
  // =========================================================================
  if (status === 'selesai') {
    const pemenang = hasilAkhir?.timMenang || 'seri';
    const isMerah = pemenang === 'merah';
    const isPutih = pemenang === 'putih';
    const finalSkorMerah = hasilAkhir?.skorMerah ?? skorMerah;
    const finalSkorPutih = hasilAkhir?.skorPutih ?? skorPutih;
    const finalPos = hasilAkhir?.posisiAkhir ?? taliPosition;
    const timMerahCount = daftarPeserta.filter((p) => p.tim === 'merah').length;
    const timPutihCount = daftarPeserta.filter((p) => p.tim === 'putih').length;

    return (
      <div className="portal-bg min-h-screen flex flex-col justify-between select-none">
        <div className="max-w-4xl mx-auto w-full py-8 px-4 sm:px-6 space-y-6">
          {/* Banner Pemenang */}
          <div
            className={`p-8 sm:p-10 rounded-[32px] text-center shadow-[0_8px_0_rgba(0,0,0,0.22)] border-2 border-[#e0d5b8] ${
              isMerah
                ? 'bg-gradient-to-b from-[#c8362f] to-[#8f1e19] text-[#fbf6e9]'
                : isPutih
                ? 'bg-gradient-to-b from-[#1f4a6b] to-[#122e44] text-[#fbf6e9]'
                : 'bg-gradient-to-b from-[#b87333] via-[#9c5b24] to-[#7a4218] text-[#fbf6e9]'
            }`}
          >
            <div className="w-20 h-20 bg-white/15 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/30 shadow-inner">
              <Trophy className="w-11 h-11 text-[#f2c230]" />
            </div>

            <div className="text-xs font-extrabold uppercase tracking-widest text-[#f4ecd8] mb-1">
              Hasil Akhir Lomba Tarik Tambang • {templateJudul}
            </div>

            <h1 className="portal-cv text-4xl sm:text-5xl text-[#fbf6e9] mb-2">
              {isMerah
                ? 'TIM MERAH MENANG! 🏆'
                : isPutih
                ? 'TIM PUTIH MENANG! 🏆'
                : 'PERTANDINGAN SERI! 🤝'}
            </h1>

            <p className="text-sm sm:text-base text-[#f4ecd8]/90 max-w-lg mx-auto">
              {isMerah
                ? 'Selamat untuk Tim Merah! Kekompakan dan kecepatan menjawab membuahkan kemenangan!'
                : isPutih
                ? 'Selamat untuk Tim Putih! Kekompakan dan ketepatan menjawab berhasil merebut kemenangan!'
                : 'Kedua tim tampil sangat tangguh dengan kekuatan seimbang hingga akhir!'}
            </p>
          </div>

          {/* Visualisasi Tali Hasil Akhir dengan Karakter Podium */}
          <VisualisasiTali
            posisi={finalPos}
            skorMerah={finalSkorMerah}
            skorPutih={finalSkorPutih}
            jumlahPemainMerah={timMerahCount || undefined}
            jumlahPemainPutih={timPutihCount || undefined}
            pemenang={pemenang}
            theme="chalk"
          />

          {/* Card Statistik Skor Akhir */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="portal-card p-6 rounded-3xl border-2 border-[#e0d5b8] shadow-[0_4px_0_rgba(0,0,0,0.18)]">
              <div className="text-xs font-extrabold text-[#c8362f] uppercase tracking-wider mb-1">
                Kinerja Tim Merah
              </div>
              <div className="text-3xl font-black text-[#1d3b2e]">
                {finalSkorMerah} Jawaban Benar
              </div>
              <p className="text-xs text-[#6b7d6c] mt-1 font-semibold">
                {timMerahCount} Siswa bertanding di Tim Merah
              </p>
            </div>

            <div className="portal-card p-6 rounded-3xl border-2 border-[#e0d5b8] shadow-[0_4px_0_rgba(0,0,0,0.18)]">
              <div className="text-xs font-extrabold text-[#1f4a6b] uppercase tracking-wider mb-1">
                Kinerja Tim Putih
              </div>
              <div className="text-3xl font-black text-[#1d3b2e]">
                {finalSkorPutih} Jawaban Benar
              </div>
              <p className="text-xs text-[#6b7d6c] mt-1 font-semibold">
                {timPutihCount} Siswa bertanding di Tim Putih
              </p>
            </div>
          </div>

          {/* Tombol Aksi Akhir */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 pb-4">
            <button
              type="button"
              onClick={handleMainLagi}
              disabled={isMainLagiLoading}
              className="portal-btn w-full sm:w-auto px-8 py-3.5 text-base flex items-center justify-center gap-2 cursor-pointer"
              style={{ background: '#f2c230', color: '#1d3b2e' }}
            >
              {isMainLagiLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RotateCcw className="w-5 h-5" />
              )}
              <span>Main Lagi dengan Template Ini</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/guru')}
              className="portal-btn red w-full sm:w-auto px-8 py-3.5 text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-5 h-5" />
              <span>Kembali ke Dashboard Guru</span>
            </button>
          </div>
        </div>

        {renderChalkLedge()}
      </div>
    );
  }

  return null;
}
