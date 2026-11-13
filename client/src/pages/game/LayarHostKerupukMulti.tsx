import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { apiRequest } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { bindHostReconnect } from '../../lib/socketReconnect';
import { Modal } from '../../components';
import { ModalKonfirmasiKeluar } from '../../components/ModalKonfirmasiKeluar';
import { soundEffects, useGameSoundLifecycle } from '../../lib/soundEffects';
import { HasilGachaGigitanProps } from '../siswa/KerupukVirtual';
import {
  Trophy,
  Users,
  Play,
  StopCircle,
  Copy,
  Check,
  Flame,
  Volume2,
  VolumeX,
  Crown,
  Medal,
  RotateCcw,
  ArrowLeft,
  Target,
  Shuffle,
  X,
} from 'lucide-react';

export interface PesertaMultiHost {
  peringkat?: number;
  id: string;
  nama: string;
  connected?: boolean;
  sisaKerupuk: number;
  targetKerupuk: number;
  sisaPersen: number;
  progresPersen: number;
  skorTotal: number;
  skorPembelajaran?: number;
  skorDasarBenar?: number;
  totalBonusStreak?: number;
  bonusKeberuntungan?: number;
  bonusPenyelesaian?: number;
  totalBenar?: number;
  totalSalah?: number;
  streakBenar: number;
  selesaiKerupuk?: boolean;
  terakhirGigitan?: HasilGachaGigitanProps | null;
  rataRataWaktuJawabMs?: number;
  jumlahJawab?: number;
}

export interface SesiKerupukMultiClient {
  sessionId: string;
  game: 'makan_kerupuk';
  mode: 'multi';
  playMode: 'MULTIPLAYER';
  token: string;
  qrDataUrl?: string;
  joinUrl?: string;
  templateId: string;
  templateJudul: string;
  status: 'lobi' | 'jalan' | 'selesai';
  totalSoalBank?: number;
  totalPeserta?: number;
  config: {
    targetKerupuk: number;
    kesulitan: string;
    maxPeserta: number;
    allowLateJoin: boolean;
  };
  leaderboard?: PesertaMultiHost[];
  daftarPeserta?: PesertaMultiHost[];
  hasil?: any | null;
}

interface LayarHostKerupukMultiProps {
  initialSession: SesiKerupukMultiClient;
  returnUrl: string;
}

export default function LayarHostKerupukMulti({
  initialSession,
  returnUrl,
}: LayarHostKerupukMultiProps) {
  const navigate = useNavigate();
  const id = initialSession.sessionId;

  const [status, setStatus] = useState<'lobi' | 'jalan' | 'selesai'>(initialSession.status);
  const [leaderboard, setLeaderboard] = useState<PesertaMultiHost[]>(
    initialSession.leaderboard || initialSession.daftarPeserta || []
  );
  const [totalPeserta, setTotalPeserta] = useState<number>(initialSession.totalPeserta ?? 0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [liveFeed, setLiveFeed] = useState<Array<{ id: string; teks: string; tipe: string }>>([]);
  const [hasilAkhir, setHasilAkhir] = useState<any>(initialSession.hasil || null);

  const [modalAkhiriOpen, setModalAkhiriOpen] = useState(false);
  const [modalKeluarOpen, setModalKeluarOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isRematching, setIsRematching] = useState(false);
  const { isMuted, toggleMute } = useGameSoundLifecycle(status === 'jalan', id);
  const [copied, setCopied] = useState(false);

  const modeSelectUrl = `/guru/makan-kerupuk?templateId=${encodeURIComponent(initialSession.templateId)}&kembali=${encodeURIComponent('/guru?tab=template')}`;

  useEffect(() => {
    const socket = getSocket();
    const unbindHost = bindHostReconnect(socket, id);

    const handleLobiUpdate = (data: {
      game?: string;
      totalPeserta: number;
      leaderboard?: PesertaMultiHost[];
      daftarPeserta?: PesertaMultiHost[];
    }) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      setTotalPeserta(data.totalPeserta);
      const list = data.leaderboard || data.daftarPeserta;
      if (list) setLeaderboard(list);
    };

    const handleGameMulai = (data: { game?: string }) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      setStatus('jalan');
      soundEffects.startGame('whistle');
    };

    const handleKerupukUpdate = (data: {
      leaderboard: PesertaMultiHost[];
      answeredCount: number;
      terakhirJawab?: {
        nama: string;
        benar: boolean;
        gacha?: HasilGachaGigitanProps | null;
      };
    }) => {
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
        setTotalPeserta(data.leaderboard.length);
      }
      if (typeof data.answeredCount === 'number') setAnsweredCount(data.answeredCount);

      if (data.terakhirJawab) {
        const item = data.terakhirJawab;
        let teks = '';
        if (item.benar && item.gacha) {
          teks = `${item.nama} dapat ${item.gacha.label} (-${item.gacha.penguranganEfektifPoin ?? 0} pt)!`;
        } else if (item.benar) {
          teks = `${item.nama} menjawab benar (+100 pt)`;
        } else {
          teks = `${item.nama} belum tepat`;
        }
        setLiveFeed((prev) => [
          { id: `${Date.now()}_${Math.random()}`, teks, tipe: item.gacha?.tipe || 'salah' },
          ...prev.slice(0, 5),
        ]);
      }
    };

    const handleSesiSelesai = (data: { game?: string; hasil: any }) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      setHasilAkhir(data.hasil);
      setStatus('selesai');
      if (data.hasil?.dihentikanManual) {
        soundEffects.stopAll();
      } else {
        soundEffects.playNaturalVictory();
      }
    };

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('game:mulai', handleGameMulai);
    socket.on('kerupuk:update', handleKerupukUpdate);
    socket.on('sesi:selesai', handleSesiSelesai);

    return () => {
      unbindHost();
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('kerupuk:update', handleKerupukUpdate);
      socket.off('sesi:selesai', handleSesiSelesai);
    };
  }, [id]);

  const handleMulaiLomba = () => {
    if (totalPeserta === 0 || isStarting) return;
    setIsStarting(true);
    const socket = getSocket();
    socket.emit('sesi:mulai', { sessionId: id }, (res: any) => {
      setIsStarting(false);
      if (!res?.success) {
        alert(res?.pesan || 'Gagal memulai lomba Makan Kerupuk.');
      }
    });
  };

  const handleKonfirmasiAkhiri = () => {
    setIsEnding(true);
    const socket = getSocket();
    socket.emit('sesi:akhiri_manual', { sessionId: id }, (res: any) => {
      setIsEnding(false);
      setModalAkhiriOpen(false);
      if (res?.success) {
        setHasilAkhir(res.hasil);
        setStatus('selesai');
        soundEffects.stopAll();
      } else {
        alert(res?.pesan || 'Gagal mengakhiri sesi.');
      }
    });
  };

  const handleKembaliClick = () => {
    if (status === 'jalan') {
      setModalKeluarOpen(true);
    } else {
      navigate(returnUrl);
    }
  };

  const handleKonfirmasiKeluar = () => {
    setModalKeluarOpen(false);
    handleKonfirmasiAkhiri();
    navigate(returnUrl);
  };

  const handleAcakUrutan = () => {
    if (!id || totalPeserta === 0) return;
    const socket = getSocket();
    socket.emit('sesi:acak_peserta', { sessionId: id }, (res: { success?: boolean; pesan?: string }) => {
      if (res && !res.success) {
        alert(res.pesan || 'Gagal mengacak urutan peserta.');
      }
    });
  };

  const handleKickPeserta = (pesertaId: string) => {
    if (!id) return;
    if (!window.confirm('Keluarkan siswa ini dari lobi lomba?')) return;
    const socket = getSocket();
    socket.emit('sesi:kick_peserta', { sessionId: id, pesertaId }, (res: { success?: boolean; pesan?: string }) => {
      if (res && !res.success) {
        alert(res.pesan || 'Gagal mengeluarkan siswa.');
      }
    });
  };

  const handleMainLagi = async () => {
    try {
      setIsRematching(true);
      soundEffects.stopAll();
      const res = await apiRequest<{ sessionId: string }>(`/sesi/${id}/main-lagi`, {
        method: 'POST',
      });
      navigate(`/guru/sesi/${res.sessionId}`, { replace: true });
      window.location.reload();
    } catch (err: any) {
      alert(err.pesan || 'Gagal membuat sesi baru.');
    } finally {
      setIsRematching(false);
    }
  };

  const handleCopyLink = () => {
    if (!initialSession.joinUrl) return;
    navigator.clipboard.writeText(initialSession.joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // FASE 1: LOBI MULTIPLAYER (PIN & QR CODE)
  if (status === 'lobi') {
    return (
      <div className="min-h-screen bg-[#f4ecd8] text-[#1d3b2e] flex flex-col">
        <header className="bg-[#1d3b2e] text-[#f4ecd8] border-b-4 border-[#f2c230] px-4 sm:px-6 py-3 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(modeSelectUrl)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                title="Kembali ke Pemilihan Mode"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-widest bg-[#f2c230] text-[#1d3b2e] px-2.5 py-0.5 rounded-full">
                    Makan Kerupuk • Multiplayer
                  </span>
                  <span className="text-[11px] font-bold bg-white/15 px-2.5 py-0.5 rounded-full">
                    Target {initialSession.config.targetKerupuk} pt
                  </span>
                </div>
                <h1 className="font-black text-lg sm:text-xl mt-0.5">
                  {initialSession.templateJudul}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(modeSelectUrl)}
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
              >
                Pilih Mode
              </button>
              <button
                type="button"
                onClick={() => navigate(returnUrl)}
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
              >
                Dashboard
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Kiri: PIN & QR Code */}
          <div className="lg:col-span-5 bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center space-y-5 shadow-sm">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#c8362f]">
                Bergabung dari HP Siswa
              </span>
              <p className="text-xs text-[#6b7d6c] mt-0.5">
                Pindai QR Code atau masukkan kode PIN 6 angka pada halaman siswa
              </p>
            </div>

            {initialSession.qrDataUrl && (
              <div className="bg-white p-3 rounded-2xl border-2 border-[#1d3b2e] shadow-xs">
                <img
                  src={initialSession.qrDataUrl}
                  alt="QR Code Sesi"
                  className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                />
              </div>
            )}

            <div className="w-full bg-[#1d3b2e] text-[#f4ecd8] rounded-2xl p-4">
              <span className="text-[11px] uppercase tracking-widest opacity-80 font-bold block">
                Kode PIN Sesi
              </span>
              <div className="text-4xl sm:text-5xl font-mono font-black tracking-[0.25em] text-[#f2c230] mt-1">
                {initialSession.token}
              </div>
            </div>

            {initialSession.joinUrl && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border border-[#e0d5b8] bg-white hover:bg-[#f7f2e4] cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Tautan Disalin!' : 'Salin Tautan Gabung'}
              </button>
            )}
          </div>

          {/* Kanan: Daftar Peserta & Tombol Mulai */}
          <div className="lg:col-span-7 bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-6 sm:p-8 flex flex-col justify-between min-h-[430px] shadow-sm space-y-5">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#e0d5b8]">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#c8362f]" />
                  <h2 className="text-lg font-black">Peserta di Lobi ({totalPeserta})</h2>
                </div>
                <span className="text-xs font-bold text-[#6b7d6c]">
                  Maks {initialSession.config.maxPeserta} siswa •{' '}
                  {initialSession.config.allowLateJoin ? 'Bisa susulan' : 'Terkunci setelah mulai'}
                </span>
              </div>

              {leaderboard.length === 0 ? (
                <div className="py-16 text-center text-[#6b7d6c] space-y-2">
                  <Users className="w-10 h-10 mx-auto opacity-40" />
                  <p className="font-bold text-sm">Belum ada siswa yang masuk...</p>
                  <p className="text-xs">Siswa dapat bergabung menggunakan PIN di sebelah kiri.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {leaderboard.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white border border-[#e0d5b8] rounded-xl p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            p.connected === false ? 'bg-slate-400' : 'bg-emerald-500'
                          }`}
                        />
                        <span className="text-xs font-bold truncate">{p.nama}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleKickPeserta(p.id)}
                        title="Keluarkan dari lobi"
                        className="text-[#c8362f] hover:opacity-75 cursor-pointer p-0.5 rounded hover:bg-rose-50 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#e0d5b8] flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={totalPeserta === 0}
                onClick={handleAcakUrutan}
                className="py-4 px-5 rounded-2xl bg-white border-2 border-[#e0d5b8] hover:bg-[#f4ecd8] text-[#1d3b2e] font-black text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Acak urutan giliran / meja peserta"
              >
                <Shuffle className="w-4 h-4 text-[#c8362f]" />
                Acak Urutan
              </button>
              <button
                type="button"
                disabled={totalPeserta === 0 || isStarting}
                onClick={handleMulaiLomba}
                className="flex-1 py-4 rounded-2xl bg-[#c8362f] hover:bg-[#b02d27] disabled:bg-slate-400 text-white font-black text-base flex items-center justify-center gap-2.5 shadow-md cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <Play className="w-5 h-5 fill-current" />
                {isStarting
                  ? 'Memulai Permainan...'
                  : totalPeserta === 0
                  ? 'Menunggu Minimal 1 Siswa...'
                  : `Mulai Lomba Makan Kerupuk (${totalPeserta} Siswa)`}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // FASE 2: LOMBA BERJALAN (ARENA SISWA + LEADERBOARD REAL-TIME)
  if (status === 'jalan') {
    const totalLudes = leaderboard.filter((p) => p.selesaiKerupuk || p.sisaKerupuk === 0).length;

    return (
      <div className="min-h-screen bg-[#f4ecd8] text-[#1d3b2e] flex flex-col">
        <header className="bg-[#1d3b2e] text-[#f4ecd8] border-b-4 border-[#c8362f] px-4 sm:px-6 py-3 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleKembaliClick}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title="Kembali"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Kembali</span>
              </button>
              <span className="px-3 py-1 rounded-full bg-[#f2c230] text-[#1d3b2e] text-xs font-black uppercase">
                Lomba Berlangsung
              </span>
              <div>
                <h1 className="font-black text-base sm:text-lg">{initialSession.templateJudul}</h1>
                <span className="text-[11px] opacity-80">
                  PIN: <strong className="font-mono text-[#f2c230]">{initialSession.token}</strong> •
                  Target {initialSession.config.targetKerupuk} pt
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold">
                Ludes:{' '}
                <span className="font-mono text-[#f2c230] font-black">
                  {totalLudes}/{totalPeserta}
                </span>
              </div>
              <div className="hidden sm:block px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold">
                Gigitan Kelas: <span className="font-mono font-black">{answeredCount}</span>
              </div>
              <button
                type="button"
                onClick={toggleMute}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer"
                title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setModalAkhiriOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[#c8362f] hover:bg-[#b02d27] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <StopCircle className="w-4 h-4" /> Akhiri Sesi
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Kiri: Grid Progres Kerupuk Setiap Siswa */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#e0d5b8]">
                <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-[#c8362f]" /> Progres Kerupuk Siswa Real-Time
                </h2>
                <span className="text-xs font-bold text-[#6b7d6c]">
                  {totalPeserta} Peserta Aktif
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {leaderboard.map((p) => {
                  const ludes = p.selesaiKerupuk || p.sisaKerupuk === 0;
                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-2xl border-2 transition-all ${
                        ludes
                          ? 'bg-emerald-50 border-emerald-400'
                          : 'bg-white border-[#e0d5b8]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-xs font-black truncate">{p.nama}</span>
                        {p.streakBenar > 1 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-orange-600">
                            <Flame className="w-3 h-3 fill-current" /> {p.streakBenar}
                          </span>
                        )}
                      </div>

                      <div className="text-center py-1">
                        <div
                          className={`text-xl font-black font-mono ${
                            ludes ? 'text-emerald-700' : 'text-[#1d3b2e]'
                          }`}
                        >
                          {ludes ? 'LUDES!' : `${p.sisaKerupuk} pt`}
                        </div>
                        <div className="text-[10px] font-bold text-[#6b7d6c]">
                          {ludes ? '100% Habis (+100)' : `Sisa ${p.sisaPersen}%`}
                        </div>
                      </div>

                      <div className="bg-[#e0d5b8] h-2 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            ludes ? 'bg-emerald-500' : 'bg-[#c8362f]'
                          }`}
                          style={{ width: `${p.progresPersen}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {liveFeed.length > 0 && (
              <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-2xl p-4 space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-[#6b7d6c]">
                  Aktivitas Terbaru
                </div>
                <div className="flex flex-wrap gap-2">
                  {liveFeed.map((f) => (
                    <span
                      key={f.id}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                        f.tipe === 'salah'
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : f.tipe === 'besar'
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-white border-[#e0d5b8] text-[#1d3b2e]'
                      }`}
                    >
                      {f.teks}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Kanan: Leaderboard Peringkat Kelas */}
          <div className="lg:col-span-5 bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#e0d5b8]">
              <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-[#f2c230]" /> Peringkat Kelas
              </h2>
              <span className="text-[11px] font-bold text-[#6b7d6c]">
                Skor • Benar • Sisa • Kecepatan
              </span>
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {leaderboard.map((p, idx) => (
                <div
                  key={p.id}
                  className={`p-3 rounded-2xl border-2 ${
                    idx === 0
                      ? 'bg-[#1d3b2e] text-[#f4ecd8] border-[#f2c230]'
                      : 'bg-white border-[#e0d5b8] text-[#1d3b2e]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-[#f2c230] text-[#1d3b2e]'
                            : 'bg-[#f4ecd8] text-[#1d3b2e]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="font-bold text-xs truncate">{p.nama}</span>
                    </div>
                    <div className="font-mono text-xs font-black shrink-0">
                      {p.skorTotal} pt
                    </div>
                  </div>
                  <div
                    className={`flex justify-between text-[10px] mt-1 font-semibold ${
                      idx === 0 ? 'text-white/80' : 'text-[#6b7d6c]'
                    }`}
                  >
                    <span>
                      Benar {p.totalBenar ?? 0} • Sisa {p.sisaKerupuk} pt
                    </span>
                    <span className="font-mono">
                      {p.rataRataWaktuJawabMs
                        ? `${(p.rataRataWaktuJawabMs / 1000).toFixed(1)}s`
                        : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        <Modal
          isOpen={modalAkhiriOpen}
          onClose={() => setModalAkhiriOpen(false)}
          title="Konfirmasi Akhiri Sesi Multiplayer"
          maxWidth="sm"
        >
          <div className="space-y-4 text-[#1d3b2e]">
            <p className="text-sm">
              Akhiri sesi Makan Kerupuk sekarang dan hitung podium pemenang akhir?
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
              <button
                type="button"
                onClick={() => setModalAkhiriOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#e0d5b8] text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleKonfirmasiAkhiri}
                disabled={isEnding}
                className="px-4 py-2 rounded-lg bg-[#c8362f] text-white text-xs font-bold cursor-pointer"
              >
                {isEnding ? 'Mengakhiri...' : 'Ya, Akhiri Sesi'}
              </button>
            </div>
          </div>
        </Modal>

        <ModalKonfirmasiKeluar
          isOpen={modalKeluarOpen}
          onClose={() => setModalKeluarOpen(false)}
          onKonfirmasiKeluar={handleKonfirmasiKeluar}
          judulGame="Makan Kerupuk"
        />
      </div>
    );
  }

  // FASE 3: PODIUM & TABEL RAPOR LENGKAP MULTIPLAYER
  const finalLeaderboard: PesertaMultiHost[] = hasilAkhir?.leaderboard || leaderboard;
  const juara1 = hasilAkhir?.podium?.juara1 || finalLeaderboard[0];
  const juara2 = hasilAkhir?.podium?.juara2 || finalLeaderboard[1];
  const juara3 = hasilAkhir?.podium?.juara3 || finalLeaderboard[2];

  return (
    <div className="min-h-screen bg-[#1d3b2e] text-[#f4ecd8] p-4 sm:p-8 flex flex-col">
      <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col justify-between space-y-6">
        <header className="text-center space-y-1">
          <span className="inline-block px-3 py-1 rounded-full bg-[#f2c230] text-[#1d3b2e] text-xs font-black uppercase tracking-wider">
            Podium Makan Kerupuk • Multiplayer
          </span>
          <h1 className="text-2xl sm:text-3xl font-black">{initialSession.templateJudul}</h1>
        </header>

        {/* Podium 1, 2, 3 */}
        <div className="flex items-end justify-center gap-4 sm:gap-6 pt-6 pb-2">
          {juara2 && (
            <div className="flex flex-col items-center w-36 sm:w-44 text-center">
              <Medal className="w-8 h-8 text-slate-300 mb-1" />
              <span className="text-sm font-black truncate w-full">{juara2.nama}</span>
              <span className="text-xs font-mono text-white/80 mb-2">{juara2.skorTotal} pt</span>
              <div className="w-full bg-slate-600 h-28 rounded-t-2xl flex flex-col items-center justify-center font-black text-2xl border-t-4 border-slate-400">
                <span>2</span>
                <span className="text-[10px] uppercase">Perak</span>
              </div>
            </div>
          )}

          {juara1 && (
            <div className="flex flex-col items-center w-44 sm:w-56 text-center -mt-4">
              <Crown className="w-10 h-10 text-[#f2c230] mb-1" />
              <span className="text-base sm:text-lg font-black text-[#f2c230] truncate w-full">
                {juara1.nama}
              </span>
              <span className="text-sm font-mono font-bold mb-2">{juara1.skorTotal} pt</span>
              <div className="w-full bg-[#f2c230] text-[#1d3b2e] h-40 rounded-t-2xl flex flex-col items-center justify-center font-black text-4xl border-t-4 border-white shadow-xl">
                <span>1</span>
                <span className="text-xs uppercase font-black">Juara 1</span>
              </div>
            </div>
          )}

          {juara3 && (
            <div className="flex flex-col items-center w-36 sm:w-44 text-center">
              <Medal className="w-8 h-8 text-amber-500 mb-1" />
              <span className="text-sm font-black truncate w-full">{juara3.nama}</span>
              <span className="text-xs font-mono text-white/80 mb-2">{juara3.skorTotal} pt</span>
              <div className="w-full bg-amber-800 h-20 rounded-t-2xl flex flex-col items-center justify-center font-black text-2xl border-t-4 border-amber-600">
                <span>3</span>
                <span className="text-[10px] uppercase">Perunggu</span>
              </div>
            </div>
          )}
        </div>

        {/* Tabel Rekap Rinci */}
        <div className="bg-[#fcf8ed] text-[#1d3b2e] rounded-3xl p-5 border-2 border-[#e0d5b8] space-y-3">
          <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#c8362f]" /> Rekapitulasi Peringkat &amp; Rincian Skor Siswa
          </h3>
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase font-black text-[#6b7d6c] border-b border-[#e0d5b8]">
                <tr>
                  <th className="py-2 px-2">Rank</th>
                  <th className="py-2 px-2">Nama Siswa</th>
                  <th className="py-2 px-2">Total</th>
                  <th className="py-2 px-2">Pembelajaran</th>
                  <th className="py-2 px-2">Keberuntungan</th>
                  <th className="py-2 px-2">Bonus Ludes</th>
                  <th className="py-2 px-2">Sisa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0d5b8]">
                {finalLeaderboard.map((p, i) => (
                  <tr key={p.id}>
                    <td className="py-2 px-2 font-mono font-bold">#{i + 1}</td>
                    <td className="py-2 px-2 font-bold">{p.nama}</td>
                    <td className="py-2 px-2 font-mono font-black text-[#c8362f]">{p.skorTotal}</td>
                    <td className="py-2 px-2 font-mono">{p.skorPembelajaran ?? 0}</td>
                    <td className="py-2 px-2 font-mono">+{p.bonusKeberuntungan ?? 0}</td>
                    <td className="py-2 px-2 font-mono">+{p.bonusPenyelesaian ?? 0}</td>
                    <td className="py-2 px-2 font-mono">
                      {p.sisaKerupuk === 0 ? 'Ludes!' : `${p.sisaKerupuk} pt`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="flex flex-wrap justify-between items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(modeSelectUrl)}
            className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
          >
            Kembali ke Pemilihan Mode
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(returnUrl)}
              className="px-4 py-2.5 rounded-xl border border-white/25 hover:bg-white/10 text-xs font-bold cursor-pointer"
            >
              Dashboard Guru
            </button>
            <button
              type="button"
              disabled={isRematching}
              onClick={handleMainLagi}
              className="px-5 py-2.5 rounded-xl bg-[#f2c230] text-[#1d3b2e] font-black text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              {isRematching ? 'Menyiapkan...' : 'Main Lagi (Buat PIN Baru)'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

