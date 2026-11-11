import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { apiRequest } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { Button, Card, Modal } from '../../components';
import { soundEffects } from '../../lib/soundEffects';
import TiangPinangVisual, { EfekAktifVisual } from '../siswa/TiangPinangVisual';
import KarakterPanjatPinang, { EkspresiKarakterPanjat } from '../siswa/KarakterPanjatPinang';
import {
  Trophy,
  Users,
  Play,
  StopCircle,
  Loader2,
  Copy,
  Check,
  Flame,
  Shield,
  HandMetal,
  Droplets,
  Clock,
  Eye,
  Volume2,
  VolumeX,
  Flag,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

interface KonfigurasiPanjatHost {
  kesulitan: 'mudah' | 'normal' | 'sulit' | 'custom';
  naikBenar: number;
  turunSalah: number;
  bonusStreakAktif: boolean;
  bonusStreak3: number;
  bonusStreak5: number;
  rintanganAktif: boolean;
  rintanganDipilih: string[];
  penurunanTiangLicin: number;
  bonusPeganganKuat: number;
  hadiahKejutanMode: 'posisi' | 'poin';
  hadiahKejutanNilai: number;
  peluangRintanganPersen: number;
  maxPeserta: number;
  allowLateJoin: boolean;
}

interface LeaderboardItemHost {
  peringkat: number;
  id: string;
  nama: string;
  connected?: boolean;
  posisi: number;
  poinBonus: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakSaatIni: number;
  streakTertinggi: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs: number | null;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  efekAktif?: EfekAktifVisual;
}

interface RiwayatRintanganHost {
  id: string;
  tipe: string;
  judul: string;
  deskripsi: string;
  efekNilai: number;
  satuan: string;
  timestampMs: number;
}

interface RiwayatPosisiHost {
  urutan: number;
  questionId: string;
  posisiSebelum: number;
  perubahan: number;
  posisiSesudah: number;
  alasan: string;
  timestampMs: number;
}

interface LaporanPemainHost {
  peringkat: number;
  id: string;
  nama: string;
  posisiAkhir: number;
  poinBonus: number;
  status: 'bermain' | 'selesai';
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakTertinggi: number;
  streakSaatIni: number;
  rataRataWaktuJawabMs: number;
  waktuSelesaiMs: number | null;
  riwayatRintangan: RiwayatRintanganHost[];
  riwayatPosisi: RiwayatPosisiHost[];
}

interface QuestionStatHost {
  questionId: string;
  teks: string;
  totalJawab: number;
  totalBenar: number;
  totalSalah: number;
  tingkatSalahPersen: number;
}

interface LaporanAkhirHost {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  konfigurasi?: KonfigurasiPanjatHost;
  totalPeserta: number;
  totalSelesai: number;
  totalSoalTemplate: number;
  totalJawabanBenar: number;
  totalJawabanSalah: number;
  dihentikanManual: boolean;
  leaderboard: LeaderboardItemHost[];
  laporanPemain: LaporanPemainHost[];
  podium?: {
    juara1?: LeaderboardItemHost;
    juara2?: LeaderboardItemHost;
    juara3?: LeaderboardItemHost;
  };
  questionStats?: QuestionStatHost[];
}

function formatDurasiDetik(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return '-';
  if (ms < 1000) return `${ms} md`;
  const detik = ms / 1000;
  if (detik < 60) return `${detik.toFixed(1)} dtk`;
  const menit = Math.floor(detik / 60);
  const sisa = Math.round(detik % 60);
  return `${menit}m ${sisa}d`;
}

const LABEL_RINTANGAN: Record<string, string> = {
  tiang_licin: 'Tiang Licin',
  kulit_pisang: 'Kulit Pisang',
  pegangan_kuat: 'Pegangan Kuat',
  hadiah_kejutan: 'Hadiah Kejutan',
};

export default function LayarHostPanjatPinang() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [templateJudul, setTemplateJudul] = useState('');
  const [token, setToken] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [status, setStatus] = useState<'lobi' | 'jalan' | 'selesai'>('lobi');
  const [totalSoal, setTotalSoal] = useState(0);
  const [config, setConfig] = useState<KonfigurasiPanjatHost | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardItemHost[]>([]);
  const [totalPeserta, setTotalPeserta] = useState(0);
  const [deltaMap, setDeltaMap] = useState<Record<string, number | null>>({});
  const [ekspresiMap, setEkspresiMap] = useState<Record<string, EkspresiKarakterPanjat>>({});
  const [tampilSemuaTiang, setTampilSemuaTiang] = useState(false);

  const [liveFeed, setLiveFeed] = useState<
    Array<{ id: string; teks: string; tipe: 'naik' | 'turun' | 'bonus' | 'puncak' | 'rintangan' }>
  >([]);

  const [hasilAkhir, setHasilAkhir] = useState<LaporanAkhirHost | null>(null);
  const [modalAkhiriOpen, setModalAkhiriOpen] = useState(false);
  const [detailPemain, setDetailPemain] = useState<LaporanPemainHost | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isMainLagi, setIsMainLagi] = useState(false);
  const [isMuted, setIsMuted] = useState(soundEffects.getMuted());
  const [copied, setCopied] = useState(false);

  const fetchSesi = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiRequest<{
        session: {
          templateJudul: string;
          token: string;
          qrDataUrl?: string;
          joinUrl?: string;
          status: 'lobi' | 'jalan' | 'selesai';
          totalSoal?: number;
          totalPeserta?: number;
          config?: KonfigurasiPanjatHost;
          leaderboard?: LeaderboardItemHost[];
          daftarPeserta?: LeaderboardItemHost[];
          hasil?: LaporanAkhirHost | null;
        };
      }>(`/sesi/${id}`);

      const s = res.session;
      setTemplateJudul(s.templateJudul);
      setToken(s.token);
      setQrDataUrl(s.qrDataUrl || '');
      setJoinUrl(s.joinUrl || '');
      setStatus(s.status);
      setTotalSoal(s.totalSoal ?? 0);
      if (s.config) setConfig(s.config);
      setTotalPeserta(s.totalPeserta ?? 0);
      setLeaderboard(s.leaderboard || s.daftarPeserta || []);

      if (s.status === 'selesai') {
        if (s.hasil) {
          setHasilAkhir(s.hasil);
        } else {
          const hasilRes = await apiRequest<{ hasil: LaporanAkhirHost }>(`/sesi/${id}/hasil`);
          setHasilAkhir(hasilRes.hasil);
        }
      }
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal memuat sesi Panjat Pinang.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSesi();
  }, [fetchSesi]);

  useEffect(() => {
    if (!id) return;
    const socket = getSocket();

    socket.emit('sesi:host_join', { sessionId: id });

    const handleLobiUpdate = (data: {
      game?: string;
      totalPeserta: number;
      leaderboard?: LeaderboardItemHost[];
      daftarPeserta?: LeaderboardItemHost[];
    }) => {
      if (data.game && data.game !== 'panjat_pinang') return;
      setTotalPeserta(data.totalPeserta);
      const list = data.leaderboard || data.daftarPeserta;
      if (list) setLeaderboard(list);
    };

    const handleGameMulai = (data: {
      game?: string;
      config?: KonfigurasiPanjatHost;
      leaderboard?: LeaderboardItemHost[];
    }) => {
      if (data.game && data.game !== 'panjat_pinang') return;
      setStatus('jalan');
      if (data.config) setConfig(data.config);
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      soundEffects.playWhistle();
    };

    const handlePanjatUpdate = (data: {
      leaderboard: LeaderboardItemHost[];
      totalPeserta: number;
      terakhirAksi?: {
        pesertaId: string;
        nama: string;
        benar: boolean;
        isBonusKulitPisang?: boolean;
        posisiSebelum: number;
        posisiBaru: number;
        perubahanPosisi: number;
        streakSaatIni: number;
        rintanganBaru?: { judul: string; tipe: string } | null;
        perisaiDigunakan?: boolean;
        perisaiDiperoleh?: boolean;
        selesaiBaru?: boolean;
      };
    }) => {
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      if (typeof data.totalPeserta === 'number') setTotalPeserta(data.totalPeserta);

      const aksi = data.terakhirAksi;
      if (aksi) {
        const ekspresiAksi: EkspresiKarakterPanjat = aksi.selesaiBaru
          ? 'puncak'
          : aksi.benar
          ? 'bahagia'
          : 'sedih';

        setDeltaMap((prev) => ({
          ...prev,
          [aksi.pesertaId]: aksi.perubahanPosisi,
        }));
        setEkspresiMap((prev) => ({
          ...prev,
          [aksi.pesertaId]: ekspresiAksi,
        }));

        setTimeout(() => {
          setDeltaMap((prev) => ({
            ...prev,
            [aksi.pesertaId]: null,
          }));
        }, 1400);

        if (!aksi.selesaiBaru) {
          setTimeout(() => {
            setEkspresiMap((prev) => ({
              ...prev,
              [aksi.pesertaId]: 'netral',
            }));
          }, 2200);
        }

        let teks = '';
        let tipe: 'naik' | 'turun' | 'bonus' | 'puncak' | 'rintangan' = aksi.benar ? 'naik' : 'turun';

        if (aksi.selesaiBaru) {
          teks = `${aksi.nama} mencapai PUNCAK 100%!`;
          tipe = 'puncak';
          soundEffects.playVictoryFanfare();
        } else if (aksi.rintanganBaru) {
          teks = `${aksi.nama} memicu rintangan ${aksi.rintanganBaru.judul}!`;
          tipe = 'rintangan';
        } else if (aksi.perisaiDiperoleh) {
          teks = `${aksi.nama} berhasil menjawab soal Kulit Pisang & dapat Perisai!`;
          tipe = 'bonus';
        } else if (aksi.perisaiDigunakan) {
          teks = `${aksi.nama} terlindungi oleh Perisai Anti-Turun!`;
          tipe = 'bonus';
        } else if (aksi.benar) {
          teks = `${aksi.nama} memanjat +${aksi.perubahanPosisi}% (posisi ${aksi.posisiBaru}%)${
            aksi.streakSaatIni >= 3 ? ` • Streak ${aksi.streakSaatIni}x` : ''
          }`;
          tipe = aksi.streakSaatIni >= 3 ? 'bonus' : 'naik';
        } else {
          teks = `${aksi.nama} tergelincir ${aksi.perubahanPosisi}% (posisi ${aksi.posisiBaru}%)`;
          tipe = 'turun';
        }

        setLiveFeed((prev) => [
          { id: `${Date.now()}-${Math.random()}`, teks, tipe },
          ...prev.slice(0, 5),
        ]);
      }
    };

    const handleSesiSelesai = async (data: { game?: string; hasil?: LaporanAkhirHost }) => {
      if (data.game && data.game !== 'panjat_pinang') return;
      setStatus('selesai');
      soundEffects.playVictoryFanfare();
      if (data.hasil) {
        setHasilAkhir(data.hasil);
      }
      // Ambil questionStats lengkap dari endpoint hasil bila tersedia
      try {
        const res = await apiRequest<{ hasil: LaporanAkhirHost }>(`/sesi/${id}/hasil`);
        if (res.hasil) setHasilAkhir(res.hasil);
      } catch {
        // fallback ke data socket jika REST gagal
      }
    };

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('game:mulai', handleGameMulai);
    socket.on('panjat:update', handlePanjatUpdate);
    socket.on('sesi:selesai', handleSesiSelesai);

    return () => {
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('panjat:update', handlePanjatUpdate);
      socket.off('sesi:selesai', handleSesiSelesai);
    };
  }, [id]);

  const handleMulai = () => {
    if (!id || totalPeserta === 0 || isStarting) return;
    setIsStarting(true);
    const socket = getSocket();
    socket.emit('sesi:mulai', { sessionId: id }, (res: { success?: boolean; pesan?: string }) => {
      setIsStarting(false);
      if (!res?.success) {
        alert(res?.pesan || 'Gagal memulai sesi Panjat Pinang.');
      }
    });
  };

  const handleAkhiriManual = () => {
    if (!id || isEnding) return;
    setIsEnding(true);
    const socket = getSocket();
    socket.emit('sesi:akhiri_manual', { sessionId: id }, (res: { success?: boolean; pesan?: string }) => {
      setIsEnding(false);
      setModalAkhiriOpen(false);
      if (!res?.success) {
        alert(res?.pesan || 'Gagal mengakhiri permainan.');
      }
    });
  };

  const handleMainLagi = async () => {
    if (!id || isMainLagi) return;
    setIsMainLagi(true);
    try {
      const res = await apiRequest<{ session: { id: string } }>(`/sesi/${id}/main-lagi`, {
        method: 'POST',
      });
      navigate(`/guru/sesi/${res.session.id}`);
    } catch (err: any) {
      alert(err.pesan || 'Gagal membuat sesi ulang.');
    } finally {
      setIsMainLagi(false);
    }
  };

  const handleCopyLink = () => {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSound = () => {
    const muted = soundEffects.toggleMute();
    setIsMuted(muted);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm font-bold text-slate-300">Menyiapkan Layar Panjat Pinang...</p>
      </div>
    );
  }

  if (errorPesan) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md p-6 bg-slate-800 border-slate-700 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Terjadi Kesalahan</h2>
          <p className="text-slate-400 text-sm mb-6">{errorPesan}</p>
          <Button variant="utama" onClick={() => navigate('/guru')} className="w-full">
            Kembali ke Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // FASE 1: LOBI PROYEKTOR
  // -------------------------------------------------------------------------
  if (status === 'lobi') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white flex flex-col justify-between p-6 sm:p-10 select-none">
        <header className="flex justify-between items-center bg-slate-800/80 backdrop-blur border border-slate-700/80 rounded-2xl p-4 sm:px-6 shadow-md">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400 block">
              Panjat Pinang • Mode Individu Multiplayer
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white">{templateJudul}</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleSound}
              className="p-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
              title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-red-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-emerald-400" />
              )}
            </button>
            <Button
              variant="hantu"
              onClick={() => navigate('/guru')}
              className="text-xs text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              Dashboard
            </Button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto py-6 items-start">
          {/* Kolom Kiri: QR, PIN & Ringkasan Aturan */}
          <div className="lg:col-span-5 flex flex-col items-center bg-slate-800/90 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Gabung dari HP Siswa
              </span>
              <p className="text-sm font-semibold text-emerald-300">
                Pindai kode QR atau masukkan PIN 6 digit
              </p>
            </div>

            {qrDataUrl && (
              <div className="bg-white p-3 rounded-2xl shadow-inner border-4 border-emerald-400">
                <img
                  src={qrDataUrl}
                  alt="QR Code Panjat Pinang"
                  className="w-44 h-44 sm:w-52 sm:h-52 object-contain"
                />
              </div>
            )}

            <div className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl p-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                KODE PIN GAME
              </span>
              <div className="text-4xl sm:text-5xl font-mono font-black tracking-[0.25em] text-amber-400">
                {token}
              </div>
            </div>

            {joinUrl && (
              <div className="w-full flex items-center justify-between gap-2 bg-slate-900/60 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300">
                <span className="truncate font-mono">{joinUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-300 transition-colors"
                  title="Salin tautan"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Ringkasan Aturan Sesi */}
            {config && (
              <div className="w-full text-left bg-slate-900/70 border border-slate-700/80 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-700 text-emerald-300 font-bold uppercase">
                    Mode: {config.kesulitan}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-900/50 text-emerald-200 font-bold">
                    Benar +{config.naikBenar}%
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 font-bold">
                    Salah -{config.turunSalah}%
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 font-bold">
                    Streak: {config.bonusStreakAktif ? `+${config.bonusStreak3}% / +${config.bonusStreak5}%` : 'Nonaktif'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">Rintangan: </span>
                  {config.rintanganAktif && config.rintanganDipilih.length > 0
                    ? config.rintanganDipilih.map((r) => LABEL_RINTANGAN[r] || r).join(', ')
                    : 'Nonaktif'}
                </div>
              </div>
            )}
          </div>

          {/* Kolom Kanan: Daftar Siswa di Lobi */}
          <div className="lg:col-span-7 flex flex-col bg-slate-800/80 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-xl min-h-[440px] justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">Pemain di Lobi</h2>
                    <p className="text-xs text-slate-400">
                      {totalSoal} soal acak berulang • Target puncak 100%
                    </p>
                  </div>
                </div>
                <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-2xl px-4 py-2 text-center">
                  <span className="text-2xl font-black text-emerald-300 font-mono">
                    {totalPeserta}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 ml-1">
                    / {config?.maxPeserta || 100} Siswa
                  </span>
                </div>
              </div>

              {leaderboard.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-600 mb-3" />
                  <p className="font-bold text-slate-300">Menunggu siswa bergabung...</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Siswa masuk dengan PIN atau QR lalu memanjat tiangnya masing-masing.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {leaderboard.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/80 rounded-xl p-2.5 shadow-sm"
                    >
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-sm text-white truncate">{p.nama}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-slate-700 mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-400 text-center sm:text-left">
                Tidak ada batas waktu global. Permainan berakhir saat semua pemain mencapai 100% atau guru menghentikan sesi.
              </p>
              <Button
                variant="utama"
                size="lg"
                onClick={handleMulai}
                disabled={totalPeserta === 0 || isStarting}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base shadow-lg shadow-emerald-900/40 shrink-0"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Memulai...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2 fill-current" /> Mulai Panjat Pinang
                  </>
                )}
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // FASE 3: PODIUM & LAPORAN AKHIR
  // -------------------------------------------------------------------------
  if (status === 'selesai') {
    const laporanPemain = hasilAkhir?.laporanPemain || [];
    const podium = hasilAkhir?.podium || {
      juara1: leaderboard[0],
      juara2: leaderboard[1],
      juara3: leaderboard[2],
    };
    const statsSoal = hasilAkhir?.questionStats || [];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950/60 to-slate-900 text-white p-6 sm:p-10">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Banner Juara */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-800/80 border border-emerald-500/40 rounded-3xl p-6 shadow-xl">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-black uppercase tracking-wider">
                <Trophy className="w-3.5 h-3.5" /> Lomba Panjat Pinang Selesai
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{templateJudul}</h1>
              <p className="text-xs sm:text-sm text-slate-300">
                {hasilAkhir?.dihentikanManual
                  ? 'Permainan dihentikan secara manual oleh guru.'
                  : 'Seluruh pemain berhasil mencapai puncak 100%!'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="hantu"
                onClick={handleMainLagi}
                disabled={isMainLagi}
                className="border border-emerald-500/50 bg-emerald-900/40 text-emerald-200 hover:bg-emerald-800/60"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isMainLagi ? 'animate-spin' : ''}`} />
                Main Lagi
              </Button>
              <Button
                variant="utama"
                onClick={() => navigate('/guru')}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Dashboard
              </Button>
            </div>
          </div>

          {/* Ringkasan Statistik */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-bold uppercase">Total Pemain</p>
              <p className="text-2xl font-black text-white mt-1">
                {hasilAkhir?.totalPeserta ?? leaderboard.length}
              </p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-bold uppercase">Mencapai Puncak 100%</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                {hasilAkhir?.totalSelesai ?? leaderboard.filter((p) => p.status === 'selesai').length}
              </p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-bold uppercase">Total Jawaban Benar</p>
              <p className="text-2xl font-black text-amber-400 mt-1">
                {hasilAkhir?.totalJawabanBenar ?? 0}
              </p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-bold uppercase">Total Jawaban Salah</p>
              <p className="text-2xl font-black text-rose-400 mt-1">
                {hasilAkhir?.totalJawabanSalah ?? 0}
              </p>
            </div>
          </div>

          {/* Top 3 Podium dengan Karakter 2D Juara */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Juara 2: Kalung Medali Perak */}
            {podium.juara2 && (
              <div className="order-2 md:order-1 bg-slate-800/90 border border-slate-500 rounded-3xl p-5 text-center shadow-lg flex flex-col items-center">
                <KarakterPanjatPinang
                  nama={podium.juara2.nama}
                  pose="podium"
                  ekspresi="bahagia"
                  podiumRank={2}
                  size="md"
                  className="mb-2"
                />
                <span className="inline-block px-3 py-1 rounded-full bg-slate-600/80 border border-slate-400/60 text-slate-100 text-xs font-black mb-2">
                  Juara 2 • Kalung Perak
                </span>
                <h3 className="text-xl font-black text-white truncate max-w-full">{podium.juara2.nama}</h3>
                <p className="text-2xl font-black text-emerald-300 mt-1">{podium.juara2.posisi}%</p>
                <p className="text-xs text-slate-400 mt-1">
                  Akurasi {podium.juara2.akurasiPersen}% • Rata-rata {formatDurasiDetik(podium.juara2.rataRataWaktuJawabMs)}
                </p>
              </div>
            )}

            {/* Juara 1: Mahkota Emas */}
            {podium.juara1 && (
              <div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/20 to-slate-800/95 border-2 border-amber-400 rounded-3xl p-6 text-center shadow-2xl flex flex-col items-center">
                <KarakterPanjatPinang
                  nama={podium.juara1.nama}
                  pose="podium"
                  ekspresi="bahagia"
                  podiumRank={1}
                  size="lg"
                  className="mb-2"
                />
                <span className="inline-block px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black mb-2">
                  Juara 1 • Mahkota Puncak Pinang
                </span>
                <h3 className="text-2xl font-black text-white truncate max-w-full">{podium.juara1.nama}</h3>
                <p className="text-3xl font-black text-amber-300 mt-1">{podium.juara1.posisi}%</p>
                <p className="text-xs text-slate-300 mt-1">
                  Benar {podium.juara1.totalBenar} • Akurasi {podium.juara1.akurasiPersen}% •{' '}
                  {podium.juara1.waktuSelesaiMs
                    ? `Selesai ${formatDurasiDetik(podium.juara1.waktuSelesaiMs)}`
                    : `Rata-rata ${formatDurasiDetik(podium.juara1.rataRataWaktuJawabMs)}`}
                </p>
              </div>
            )}

            {/* Juara 3: Kalung Medali Perunggu */}
            {podium.juara3 && (
              <div className="order-3 bg-slate-800/90 border border-amber-700/70 rounded-3xl p-5 text-center shadow-lg flex flex-col items-center">
                <KarakterPanjatPinang
                  nama={podium.juara3.nama}
                  pose="podium"
                  ekspresi="bahagia"
                  podiumRank={3}
                  size="md"
                  className="mb-2"
                />
                <span className="inline-block px-3 py-1 rounded-full bg-amber-900/60 border border-amber-600/60 text-amber-200 text-xs font-black mb-2">
                  Juara 3 • Kalung Perunggu
                </span>
                <h3 className="text-xl font-black text-white truncate max-w-full">{podium.juara3.nama}</h3>
                <p className="text-2xl font-black text-emerald-300 mt-1">{podium.juara3.posisi}%</p>
                <p className="text-xs text-slate-400 mt-1">
                  Akurasi {podium.juara3.akurasiPersen}% • Rata-rata {formatDurasiDetik(podium.juara3.rataRataWaktuJawabMs)}
                </p>
              </div>
            )}
          </div>

          {/* Tabel Laporan Lengkap Semua Pemain */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-black text-white">Laporan Detail Pemain</h2>
                <p className="text-xs text-slate-400">
                  Diurutkan berdasarkan status puncak, waktu selesai tercepat, posisi tertinggi, jumlah benar, dan kecepatan jawab.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 uppercase font-bold">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Nama Pemain</th>
                    <th className="px-4 py-3 text-right">Posisi</th>
                    <th className="px-4 py-3 text-right">Poin Bonus</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Benar / Salah</th>
                    <th className="px-4 py-3 text-right">Akurasi</th>
                    <th className="px-4 py-3 text-right">Streak Maks</th>
                    <th className="px-4 py-3 text-right">Rata Jawab</th>
                    <th className="px-4 py-3 text-right">Waktu Selesai</th>
                    <th className="px-4 py-3 text-center">Rintangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/70">
                  {laporanPemain.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 font-black text-amber-300">#{p.peringkat}</td>
                      <td className="px-4 py-3 font-bold text-white">{p.nama}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-emerald-300">
                        {p.posisiAkhir}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-300">
                        {p.poinBonus > 0 ? `+${p.poinBonus}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {p.status === 'selesai' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                            <CheckCircle2 className="w-3 h-3" /> Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-semibold">
                            Belum Selesai
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        <span className="text-emerald-400 font-bold">{p.totalBenar}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-rose-400 font-bold">{p.totalSalah}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-white">
                        {p.akurasiPersen}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-400 font-bold">
                        {p.streakTertinggi}x
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        {formatDurasiDetik(p.rataRataWaktuJawabMs)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-300">
                        {formatDurasiDetik(p.waktuSelesaiMs)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setDetailPemain(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{p.riwayatRintangan?.length || 0}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Statistik Soal (jika tersedia) */}
          {statsSoal.length > 0 && (
            <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-5 shadow-xl">
              <h3 className="text-base font-black text-white mb-3">Statistik Tingkat Kesulitan Soal</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {statsSoal.map((sq, idx) => (
                  <div
                    key={sq.questionId}
                    className="bg-slate-900/70 border border-slate-700/80 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        Soal #{idx + 1}
                      </span>
                      <p className="text-xs font-semibold text-white line-clamp-2">{sq.teks}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-black text-emerald-400 block">
                        {sq.totalBenar} Benar
                      </span>
                      <span className="text-[11px] font-mono text-rose-400">
                        {sq.totalSalah} Salah ({sq.tingkatSalahPersen}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Riwayat Rintangan & Pergerakan Pemain */}
        <Modal
          isOpen={Boolean(detailPemain)}
          onClose={() => setDetailPemain(null)}
          title={`Riwayat Permainan: ${detailPemain?.nama || ''}`}
          maxWidth="xl"
          variant="standard"
        >
          {detailPemain && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-slate-800">
              <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Posisi Akhir</span>
                  <span className="font-black text-emerald-700 text-base">{detailPemain.posisiAkhir}%</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Akurasi</span>
                  <span className="font-black text-slate-800 text-base">{detailPemain.akurasiPersen}%</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Streak Maks</span>
                  <span className="font-black text-amber-600 text-base">{detailPemain.streakTertinggi}x</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Riwayat Rintangan ({detailPemain.riwayatRintangan?.length || 0})
                </h4>
                {(!detailPemain.riwayatRintangan || detailPemain.riwayatRintangan.length === 0) ? (
                  <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-xl">
                    Pemain ini tidak mengalami rintangan selama permainan.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detailPemain.riwayatRintangan.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs flex items-start justify-between gap-2"
                      >
                        <div>
                          <p className="font-bold text-amber-900">{r.judul}</p>
                          <p className="text-amber-800 mt-0.5">{r.deskripsi}</p>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-white border border-amber-300 font-mono font-bold text-amber-900">
                          {r.efekNilai !== 0 ? `${r.efekNilai > 0 ? '+' : ''}${r.efekNilai} ${r.satuan}` : r.satuan}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // FASE 2: PERMAINAN BERLANGSUNG (TIANG PINANG MULTI-PEMAIN + LEADERBOARD)
  // -------------------------------------------------------------------------
  const totalSelesaiCount = leaderboard.filter((p) => p.status === 'selesai').length;
  const maxVisualTiang = tampilSemuaTiang ? leaderboard.length : Math.min(leaderboard.length, 12);
  const pesertaVisual = leaderboard.slice(0, maxVisualTiang);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-4 sm:p-6 flex flex-col gap-5 select-none">
      {/* Header Proyektor */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black uppercase tracking-wider">
              Live Race • PIN {token}
            </span>
            <span className="text-xs text-slate-400">
              {totalSelesaiCount} / {totalPeserta} Mencapai Puncak
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black text-white mt-0.5">{templateJudul}</h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleSound}
            className="p-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-red-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-emerald-400" />
            )}
          </button>
          <Button
            variant="utama"
            onClick={() => setModalAkhiriOpen(true)}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
          >
            <StopCircle className="w-4 h-4 mr-1.5" /> Akhiri Sesi
          </Button>
        </div>
      </header>

      {/* Live Feed Aktivitas */}
      {liveFeed.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {liveFeed.map((item) => {
            const warna =
              item.tipe === 'puncak'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : item.tipe === 'rintangan'
                ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                : item.tipe === 'bonus'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : item.tipe === 'turun'
                ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                : 'bg-slate-800 border-slate-600 text-slate-200';
            return (
              <div
                key={item.id}
                className={`shrink-0 px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${warna}`}
              >
                <span>{item.teks}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Area Utama: Kiri Visual Tiang Pinang, Kanan Leaderboard Real-time */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        {/* Visual Tiang Para Pemimpin */}
        <section className="lg:col-span-7 bg-slate-800/75 border border-slate-700 rounded-3xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-400" />
                Arena Tiang Pinang ({pesertaVisual.length} dari {leaderboard.length} Pemain)
              </h2>
              <p className="text-xs text-slate-400">
                Posisi tiang tersinkronisasi langsung dengan progres di server.
              </p>
            </div>
            {leaderboard.length > 12 && (
              <button
                type="button"
                onClick={() => setTampilSemuaTiang((v) => !v)}
                className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-slate-200 transition-colors"
              >
                {tampilSemuaTiang ? 'Tampilkan Top 12' : `Tampilkan Semua (${leaderboard.length})`}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[540px] overflow-y-auto pr-1">
            {pesertaVisual.map((p) => (
              <div
                key={p.id}
                className="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-2.5 flex flex-col items-center gap-1.5"
              >
                <div className="w-full flex items-center justify-between text-[11px] px-1">
                  <span className="font-black text-amber-400">#{p.peringkat}</span>
                  {p.status === 'selesai' ? (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                      PUNCAK
                    </span>
                  ) : (
                    <span className="font-mono font-bold text-slate-300">{p.posisi}%</span>
                  )}
                </div>
                <TiangPinangVisual
                  posisi={p.posisi}
                  namaPemain={p.nama}
                  efekAktif={p.efekAktif}
                  lastDelta={deltaMap[p.id]}
                  ekspresi={ekspresiMap[p.id]}
                  streak={p.streakSaatIni}
                  status={p.status}
                  compact
                />
              </div>
            ))}
          </div>
        </section>

        {/* Leaderboard Real-Time Lengkap */}
        <section className="lg:col-span-5 bg-slate-800/85 border border-slate-700 rounded-3xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Leaderboard Real-Time
            </h2>
            <span className="text-xs font-mono text-slate-400">{leaderboard.length} Pemain</span>
          </div>

          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {leaderboard.map((p) => (
              <div
                key={p.id}
                className={`p-3 rounded-2xl border transition-all ${
                  p.status === 'selesai'
                    ? 'bg-emerald-950/50 border-emerald-500/50'
                    : 'bg-slate-900/75 border-slate-700/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                        p.peringkat === 1
                          ? 'bg-amber-400 text-slate-950'
                          : p.peringkat === 2
                          ? 'bg-slate-300 text-slate-900'
                          : p.peringkat === 3
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {p.peringkat}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        p.connected === false ? 'bg-slate-500' : 'bg-emerald-400'
                      }`}
                      title={p.connected === false ? 'Terputus' : 'Terhubung'}
                    />
                    <span className="font-bold text-sm text-white truncate">{p.nama}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.efekAktif?.perisaiKulitPisang && (
                      <span title="Perisai Anti-Turun" className="text-sky-400">
                        <Shield className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {p.efekAktif?.peganganKuat && (
                      <span title="Pegangan Kuat" className="text-emerald-400">
                        <HandMetal className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {p.efekAktif?.tiangLicin && (
                      <span title="Tiang Licin" className="text-amber-400">
                        <Droplets className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {p.streakSaatIni >= 2 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black">
                        <Flame className="w-3 h-3" /> {p.streakSaatIni}
                      </span>
                    )}
                    <span className="font-mono font-black text-sm text-emerald-300">
                      {p.posisi}%
                    </span>
                  </div>
                </div>

                {/* Progress bar mini */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                  <div
                    className={`h-full transition-all duration-300 ${
                      p.status === 'selesai'
                        ? 'bg-amber-400'
                        : 'bg-gradient-to-r from-emerald-500 to-amber-400'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, p.posisi))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>
                    Benar {p.totalBenar} • Salah {p.totalSalah} • Akurasi {p.akurasiPersen}%
                  </span>
                  {p.status === 'selesai' && p.waktuSelesaiMs ? (
                    <span className="text-amber-300 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDurasiDetik(p.waktuSelesaiMs)}
                    </span>
                  ) : (
                    <span>{p.poinBonus > 0 ? `+${p.poinBonus} pt` : `${p.jumlahJawab} soal`}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Modal Konfirmasi Akhiri Sesi Manual */}
      <Modal
        isOpen={modalAkhiriOpen}
        onClose={() => setModalAkhiriOpen(false)}
        title="Akhiri Lomba Panjat Pinang?"
        maxWidth="md"
        variant="standard"
      >
        <div className="space-y-4 text-slate-700">
          <p className="text-sm leading-relaxed">
            Seluruh siswa akan langsung melihat hasil akhir dan peringkat saat ini. Sesi yang dihentikan manual tidak dapat dilanjutkan kembali.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="hantu" onClick={() => setModalAkhiriOpen(false)}>
              Lanjutkan Permainan
            </Button>
            <Button
              variant="utama"
              onClick={handleAkhiriManual}
              disabled={isEnding}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isEnding ? 'Mengakhiri...' : 'Ya, Akhiri Sekarang'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
