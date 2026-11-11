import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { Button, Card, Modal } from '../../components';
import { soundEffects } from '../../lib/soundEffects';
import LintasanBalapKarung, { EfekAktifBalapVisual } from '../siswa/LintasanBalapKarung';
import KarakterBalapKarung, { EkspresiBalapKarung } from '../siswa/KarakterBalapKarung';
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
  Zap,
  CloudRain,
  Scale,
  AlertTriangle,
  Clock,
  Eye,
  Volume2,
  VolumeX,
  Flag,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Sliders,
} from 'lucide-react';

interface KonfigurasiBalapHost {
  presetJarak: string;
  targetJarak: number;
  kesulitan: string;
  lompatBenar: number;
  turunSalah: number;
  keseimbanganAktif: boolean;
  keseimbanganBenar: number;
  keseimbanganSalah: number;
  bonusStreakAktif: boolean;
  bonusStreak3Jarak: number;
  bonusStreak5Jarak: number;
  penurunanJatuhJarak: number;
  pemulihanJatuhKeseimbangan: number;
  rintanganAktif: boolean;
  rintanganDipilih: string[];
  peluangRintanganPersen: number;
  maxPeserta: number;
  allowLateJoin: boolean;
}

interface LeaderboardItemBalapHost {
  peringkat: number;
  id: string;
  nama: string;
  connected?: boolean;
  jarak: number;
  targetJarak: number;
  keseimbangan: number;
  jumlahJatuh: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakSaatIni: number;
  streakTertinggi: number;
  totalBonusStreakKali?: number;
  totalBonusStreakMeter?: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs: number | null;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  efekAktif?: EfekAktifBalapVisual;
}

interface RiwayatRintanganBalapHost {
  id: string;
  tipe: string;
  judul: string;
  deskripsi: string;
  efekNilai: number;
  satuan: string;
  timestampMs: number;
}

interface LaporanPemainBalapHost {
  peringkat: number;
  id: string;
  nama: string;
  jarakAkhir: number;
  targetJarak: number;
  keseimbanganAkhir: number;
  jumlahJatuh: number;
  status: 'bermain' | 'selesai';
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakTertinggi: number;
  streakSaatIni: number;
  totalBonusStreakKali: number;
  totalBonusStreakMeter: number;
  rataRataWaktuJawabMs: number;
  waktuSelesaiMs: number | null;
  riwayatRintangan: RiwayatRintanganBalapHost[];
}

interface QuestionStatBalapHost {
  questionId: string;
  nomorSoal?: number;
  teksSoal?: string;
  teks?: string;
  jumlahBenar?: number;
  jumlahSalah?: number;
  totalBenar?: number;
  totalSalah?: number;
}

interface LaporanAkhirBalapHost {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  konfigurasi?: KonfigurasiBalapHost;
  totalPeserta: number;
  totalSelesai: number;
  totalSoalTemplate: number;
  totalJawabanBenar: number;
  totalJawabanSalah: number;
  totalJatuhKelas: number;
  dihentikanManual: boolean;
  leaderboard: LeaderboardItemBalapHost[];
  laporanPemain: LaporanPemainBalapHost[];
  podium?: {
    juara1?: LeaderboardItemBalapHost;
    juara2?: LeaderboardItemBalapHost;
    juara3?: LeaderboardItemBalapHost;
  };
  questionStats?: QuestionStatBalapHost[];
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
  kulit_pisang: 'Kulit Pisang',
  perisai: 'Perisai',
  lompatan_kuat: 'Lompatan Kuat',
  jalan_berlumpur: 'Jalan Berlumpur',
};

export default function LayarHostBalapKarung() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('kembali') || '/guru';

  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [templateJudul, setTemplateJudul] = useState('');
  const [token, setToken] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [status, setStatus] = useState<'lobi' | 'jalan' | 'selesai'>('lobi');
  const [totalSoal, setTotalSoal] = useState(0);
  const [config, setConfig] = useState<KonfigurasiBalapHost | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardItemBalapHost[]>([]);
  const [totalPeserta, setTotalPeserta] = useState(0);
  const [deltaMap, setDeltaMap] = useState<Record<string, number | null>>({});
  const [ekspresiMap, setEkspresiMap] = useState<Record<string, EkspresiBalapKarung>>({});
  const [jatuhMap, setJatuhMap] = useState<Record<string, boolean>>({});
  const [tampilSemuaLintasan, setTampilSemuaLintasan] = useState(true);
  const timersRef = useRef<number[]>([]);

  const [liveFeed, setLiveFeed] = useState<
    Array<{ id: string; teks: string; tipe: 'naik' | 'turun' | 'bonus' | 'finis' | 'rintangan' | 'jatuh' }>
  >([]);

  const [hasilAkhir, setHasilAkhir] = useState<LaporanAkhirBalapHost | null>(null);
  const [modalAkhiriOpen, setModalAkhiriOpen] = useState(false);
  const [detailPemain, setDetailPemain] = useState<LaporanPemainBalapHost | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isMainLagi, setIsMainLagi] = useState(false);
  const [isMuted, setIsMuted] = useState(soundEffects.getMuted());
  const [copied, setCopied] = useState(false);

  const targetJarak = config?.targetJarak ?? leaderboard[0]?.targetJarak ?? 100;
  const keseimbanganAktif = config?.keseimbanganAktif !== false;

  const fetchSesi = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiRequest<{
        session: {
          templateId?: string;
          templateJudul: string;
          token: string;
          qrDataUrl?: string;
          joinUrl?: string;
          status: 'lobi' | 'jalan' | 'selesai';
          totalSoal?: number;
          totalPeserta?: number;
          config?: KonfigurasiBalapHost;
          leaderboard?: LeaderboardItemBalapHost[];
          daftarPeserta?: LeaderboardItemBalapHost[];
          hasil?: LaporanAkhirBalapHost | null;
        };
      }>(`/sesi/${id}`);

      const s = res.session;
      setTemplateId(s.templateId || '');
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
        }
        try {
          const hasilRes = await apiRequest<{ hasil: LaporanAkhirBalapHost }>(`/sesi/${id}/hasil`);
          if (hasilRes.hasil) setHasilAkhir(hasilRes.hasil);
        } catch {
          // gunakan hasil awal bila tersedia
        }
      }
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal memuat sesi Balap Karung Challenge.');
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

    const handleConnect = () => {
      socket.emit('sesi:host_join', { sessionId: id });
    };

    handleConnect();

    const handleLobiUpdate = (data: {
      game?: string;
      totalPeserta: number;
      leaderboard?: LeaderboardItemBalapHost[];
      daftarPeserta?: LeaderboardItemBalapHost[];
    }) => {
      if (data.game && data.game !== 'balap_karung') return;
      setTotalPeserta(data.totalPeserta);
      const list = data.leaderboard || data.daftarPeserta;
      if (list) setLeaderboard(list);
    };

    const handleGameMulai = (data: {
      game?: string;
      config?: KonfigurasiBalapHost;
      leaderboard?: LeaderboardItemBalapHost[];
    }) => {
      if (data.game && data.game !== 'balap_karung') return;
      setStatus('jalan');
      if (data.config) setConfig(data.config);
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      soundEffects.playWhistle();
    };

    const handleBalapUpdate = (data: {
      leaderboard: LeaderboardItemBalapHost[];
      totalPeserta: number;
      terakhirAksi?: {
        pesertaId: string;
        nama: string;
        benar: boolean;
        jarakSebelum: number;
        jarakBaru: number;
        perubahanJarak: number;
        keseimbanganBaru: number;
        streakSaatIni: number;
        terjatuh?: boolean;
        penaltiJatuhJarak?: number;
        perisaiDigunakan?: boolean;
        rintanganBaru?: { judul: string; tipe: string } | null;
        selesaiBaru?: boolean;
      };
    }) => {
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      if (typeof data.totalPeserta === 'number') setTotalPeserta(data.totalPeserta);

      const aksi = data.terakhirAksi;
      if (aksi) {
        const exp: EkspresiBalapKarung = aksi.selesaiBaru
          ? 'puncak'
          : aksi.terjatuh && !aksi.perisaiDigunakan
          ? 'terjatuh'
          : aksi.benar
          ? 'bahagia'
          : 'sedih';

        setDeltaMap((prev) => ({ ...prev, [aksi.pesertaId]: aksi.perubahanJarak }));
        setEkspresiMap((prev) => ({ ...prev, [aksi.pesertaId]: exp }));
        if (aksi.terjatuh && !aksi.perisaiDigunakan) {
          setJatuhMap((prev) => ({ ...prev, [aksi.pesertaId]: true }));
        }

        const resetTimer = window.setTimeout(() => {
          setDeltaMap((prev) => ({ ...prev, [aksi.pesertaId]: null }));
          setJatuhMap((prev) => ({ ...prev, [aksi.pesertaId]: false }));
        }, 1600);
        timersRef.current.push(resetTimer);

        if (!aksi.selesaiBaru) {
          const exprTimer = window.setTimeout(() => {
            setEkspresiMap((prev) => ({ ...prev, [aksi.pesertaId]: 'netral' }));
          }, 2200);
          timersRef.current.push(exprTimer);
        }

        let teks = '';
        let tipe: 'naik' | 'turun' | 'bonus' | 'finis' | 'rintangan' | 'jatuh' = aksi.benar
          ? 'naik'
          : 'turun';

        if (aksi.selesaiBaru) {
          teks = `${aksi.nama} melintasi GARIS FINIS ${aksi.jarakBaru}m!`;
          tipe = 'finis';
          soundEffects.playVictoryFanfare();
        } else if (aksi.terjatuh && aksi.perisaiDigunakan) {
          teks = `${aksi.nama} terselamatkan oleh Perisai Keseimbangan!`;
          tipe = 'bonus';
        } else if (aksi.terjatuh) {
          teks = `${aksi.nama} terjatuh (-${aksi.penaltiJatuhJarak ?? 5}m) karena keseimbangan habis!`;
          tipe = 'jatuh';
        } else if (aksi.rintanganBaru) {
          teks = `${aksi.nama} mendapat ${aksi.rintanganBaru.judul}!`;
          tipe = 'rintangan';
        } else if (aksi.benar) {
          teks = `${aksi.nama} melompat +${aksi.perubahanJarak}m (${aksi.jarakBaru}m)${
            aksi.streakSaatIni >= 3 ? ` • Streak ${aksi.streakSaatIni}x` : ''
          }`;
          tipe = aksi.streakSaatIni >= 3 ? 'bonus' : 'naik';
        } else {
          teks = `${aksi.nama} salah (${aksi.perubahanJarak}m • Keseimbangan ${aksi.keseimbanganBaru}%)`;
          tipe = 'turun';
        }

        setLiveFeed((prev) => [
          { id: `${Date.now()}-${Math.random()}`, teks, tipe },
          ...prev.slice(0, 5),
        ]);
      }
    };

    const handleSesiSelesai = async (data: { game?: string; hasil?: LaporanAkhirBalapHost }) => {
      if (data.game && data.game !== 'balap_karung') return;
      setStatus('selesai');
      soundEffects.playVictoryFanfare();
      if (data.hasil) setHasilAkhir(data.hasil);
      try {
        const res = await apiRequest<{ hasil: LaporanAkhirBalapHost }>(`/sesi/${id}/hasil`);
        if (res.hasil) setHasilAkhir(res.hasil);
      } catch {
        // fallback ke data socket
      }
    };

    socket.on('connect', handleConnect);
    socket.on('lobi:update', handleLobiUpdate);
    socket.on('game:mulai', handleGameMulai);
    socket.on('balap:update', handleBalapUpdate);
    socket.on('sesi:selesai', handleSesiSelesai);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('balap:update', handleBalapUpdate);
      socket.off('sesi:selesai', handleSesiSelesai);
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, [id]);

  const handleMulai = () => {
    if (!id || totalPeserta === 0 || isStarting) return;
    setIsStarting(true);
    const socket = getSocket();
    socket.emit('sesi:mulai', { sessionId: id }, (res: { success?: boolean; pesan?: string }) => {
      setIsStarting(false);
      if (!res?.success) {
        alert(res?.pesan || 'Gagal memulai sesi Balap Karung Challenge.');
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
      const res = await apiRequest<{ sessionId?: string; session?: { id: string } }>(
        `/sesi/${id}/main-lagi`,
        { method: 'POST' }
      );
      const nextId = res.session?.id || res.sessionId;
      if (nextId) navigate(`/guru/sesi/${nextId}?kembali=${encodeURIComponent(returnUrl)}`);
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
    setIsMuted(soundEffects.toggleMute());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-amber-400 mb-3" />
        <p className="text-sm font-bold text-slate-300">Menyiapkan Lintasan Balap Karung...</p>
      </div>
    );
  }

  if (errorPesan) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md p-6 bg-slate-800 border-slate-700 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Terjadi Kesalahan</h2>
          <p className="text-slate-400 text-sm mb-6">{errorPesan}</p>
          <Button variant="utama" onClick={() => navigate(returnUrl)} className="w-full">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950/70 to-amber-950/40 text-white flex flex-col justify-between p-6 sm:p-10 select-none">
        <header className="flex justify-between items-center bg-slate-800/80 backdrop-blur border border-slate-700/80 rounded-2xl p-4 sm:px-6 shadow-md">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-amber-400 block">
              Balap Karung Challenge • Mode Individu Multiplayer
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
              onClick={() => navigate(returnUrl)}
              className="text-xs text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              Dashboard
            </Button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto py-6 items-start">
          {/* Kiri: QR, PIN, Aturan Sesi */}
          <div className="lg:col-span-5 flex flex-col items-center bg-slate-800/90 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Gabung dari HP Siswa
              </span>
              <p className="text-sm font-semibold text-amber-300">
                Pindai QR atau masukkan PIN 6 digit
              </p>
            </div>

            {qrDataUrl && (
              <div className="bg-white p-3 rounded-2xl shadow-inner border-4 border-amber-400">
                <img
                  src={qrDataUrl}
                  alt="QR Code Balap Karung"
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

            {config && (
              <div className="w-full text-left bg-slate-900/70 border border-slate-700/80 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-amber-950/90 border border-amber-700 text-amber-300 font-bold">
                    Target: {config.targetJarak}m
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-700 text-emerald-300 font-bold uppercase">
                    {config.kesulitan}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-900/50 text-emerald-200 font-bold">
                    Benar +{config.lompatBenar}m
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 font-bold">
                    Salah -{config.turunSalah}m
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-sky-950/80 text-sky-300 font-bold">
                    Keseimbangan: {config.keseimbanganAktif ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">Rintangan ({config.peluangRintanganPersen}%): </span>
                  {config.rintanganAktif && config.rintanganDipilih.length > 0
                    ? config.rintanganDipilih.map((r) => LABEL_RINTANGAN[r] || r).join(', ')
                    : 'Nonaktif'}
                </div>
              </div>
            )}
          </div>

          {/* Kanan: Pelari di Ruang Tunggu */}
          <div className="lg:col-span-7 flex flex-col bg-slate-800/80 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-xl min-h-[440px] justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">Pelari di Ruang Tunggu</h2>
                    <p className="text-xs text-slate-400">
                      {totalSoal} soal acak berulang • Target finis {targetJarak} meter
                    </p>
                  </div>
                </div>
                <div className="bg-amber-500/20 border border-amber-500/50 rounded-2xl px-4 py-2 text-center">
                  <span className="text-2xl font-black text-amber-300 font-mono">
                    {totalPeserta}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 ml-1">
                    / {config?.maxPeserta || 100} Pelari
                  </span>
                </div>
              </div>

              {leaderboard.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-600 mb-3" />
                  <p className="font-bold text-slate-300">Menunggu siswa bergabung...</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Setiap siswa berlomba di lintasan masing-masing menjaga jarak dan keseimbangan.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {leaderboard.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/80 rounded-xl p-2.5 shadow-sm"
                    >
                      <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-black flex items-center justify-center shrink-0">
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
                Tanpa batas waktu keseluruhan. Permainan berakhir ketika semua pelari mencapai garis finis {targetJarak}m atau guru menghentikan sesi.
              </p>
              <Button
                variant="utama"
                size="lg"
                onClick={handleMulai}
                disabled={totalPeserta === 0 || isStarting}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#D7262E] hover:bg-[#b81e25] text-white font-black text-base shadow-lg shrink-0"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Memulai...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2 fill-current" /> Mulai Balap Karung
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-800/80 border border-amber-500/40 rounded-3xl p-6 shadow-xl">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-black uppercase tracking-wider">
                <Trophy className="w-3.5 h-3.5" /> Balap Karung Challenge Selesai
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{templateJudul}</h1>
              <p className="text-xs sm:text-sm text-slate-300">
                {hasilAkhir?.dihentikanManual
                  ? `Perlombaan dihentikan secara manual oleh guru (Target: ${targetJarak} meter).`
                  : `Seluruh pelari berhasil mencapai garis finis ${targetJarak} meter!`}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {templateId && (
                <Button
                  variant="hantu"
                  onClick={() =>
                    navigate(
                      `/guru/balap-karung?templateId=${templateId}&kembali=${encodeURIComponent(returnUrl)}`
                    )
                  }
                  className="border border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
                >
                  <Sliders className="w-4 h-4 mr-2" />
                  Ubah Pengaturan
                </Button>
              )}
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
                onClick={() => navigate(returnUrl)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Dashboard
              </Button>
            </div>
          </div>

          {/* Ringkasan Statistik */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-bold uppercase">Total Pelari</p>
              <p className="text-2xl font-black text-white mt-1">
                {hasilAkhir?.totalPeserta ?? leaderboard.length}
              </p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-bold uppercase">Mencapai Finis</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                {hasilAkhir?.totalSelesai ?? leaderboard.filter((p) => p.status === 'selesai').length}
              </p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-bold uppercase">Total Benar / Salah</p>
              <p className="text-2xl font-black text-amber-400 mt-1 font-mono">
                {hasilAkhir?.totalJawabanBenar ?? 0} / {hasilAkhir?.totalJawabanSalah ?? 0}
              </p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-bold uppercase">Total Kejadian Jatuh</p>
              <p className="text-2xl font-black text-rose-400 mt-1">
                {hasilAkhir?.totalJatuhKelas ?? 0}x
              </p>
            </div>
          </div>

          {/* Top 3 Podium dengan Karakter 2D */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {podium.juara2 && (
              <div className="order-2 md:order-1 bg-slate-800/90 border border-slate-500 rounded-3xl p-5 text-center shadow-lg flex flex-col items-center">
                <KarakterBalapKarung
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
                <p className="text-2xl font-black text-emerald-300 mt-1">
                  {podium.juara2.jarak} m
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Akurasi {podium.juara2.akurasiPersen}% • Jatuh {podium.juara2.jumlahJatuh}x
                </p>
              </div>
            )}

            {podium.juara1 && (
              <div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/20 to-slate-800/95 border-2 border-amber-400 rounded-3xl p-6 text-center shadow-2xl flex flex-col items-center">
                <KarakterBalapKarung
                  nama={podium.juara1.nama}
                  pose="podium"
                  ekspresi="bahagia"
                  podiumRank={1}
                  size="lg"
                  className="mb-2"
                />
                <span className="inline-block px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black mb-2">
                  Juara 1 • Mahkota Juara
                </span>
                <h3 className="text-2xl font-black text-white truncate max-w-full">{podium.juara1.nama}</h3>
                <p className="text-3xl font-black text-amber-300 mt-1">
                  {podium.juara1.jarak} m
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  Benar {podium.juara1.totalBenar} • Akurasi {podium.juara1.akurasiPersen}% •{' '}
                  {podium.juara1.waktuSelesaiMs
                    ? `Finis ${formatDurasiDetik(podium.juara1.waktuSelesaiMs)}`
                    : `Rata-rata ${formatDurasiDetik(podium.juara1.rataRataWaktuJawabMs)}`}
                </p>
              </div>
            )}

            {podium.juara3 && (
              <div className="order-3 bg-slate-800/90 border border-amber-700/70 rounded-3xl p-5 text-center shadow-lg flex flex-col items-center">
                <KarakterBalapKarung
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
                <p className="text-2xl font-black text-emerald-300 mt-1">
                  {podium.juara3.jarak} m
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Akurasi {podium.juara3.akurasiPersen}% • Jatuh {podium.juara3.jumlahJatuh}x
                </p>
              </div>
            )}
          </div>

          {/* Tabel Laporan Lengkap Semua Pemain */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-700">
              <h2 className="text-lg font-black text-white">Laporan Detail Pelari</h2>
              <p className="text-xs text-slate-400">
                Peringkat ditentukan berdasarkan status finis, waktu finis tercepat, jarak tempuh tertinggi, jumlah benar, dan rata-rata waktu respons.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 uppercase font-bold">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Nama Pelari</th>
                    <th className="px-4 py-3 text-right">Jarak Akhir</th>
                    <th className="px-4 py-3 text-right">Keseimbangan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Benar / Salah</th>
                    <th className="px-4 py-3 text-right">Jatuh</th>
                    <th className="px-4 py-3 text-right">Bonus Streak</th>
                    <th className="px-4 py-3 text-right">Rata Respons</th>
                    <th className="px-4 py-3 text-right">Waktu Finis</th>
                    <th className="px-4 py-3 text-center">Rintangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/70">
                  {laporanPemain.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 font-black text-amber-300">#{p.peringkat}</td>
                      <td className="px-4 py-3 font-bold text-white">{p.nama}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-emerald-300">
                        {p.jarakAkhir} / {p.targetJarak} m
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sky-300">
                        {p.keseimbanganAkhir}%
                      </td>
                      <td className="px-4 py-3">
                        {p.status === 'selesai' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                            <CheckCircle2 className="w-3 h-3" /> Finis
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-semibold">
                            Belum Finis
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        <span className="text-emerald-400 font-bold">{p.totalBenar}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-rose-400 font-bold">{p.totalSalah}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-rose-300 font-bold">
                        {p.jumlahJatuh}x
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-orange-300 font-bold">
                        {p.totalBonusStreakKali}x (+{p.totalBonusStreakMeter}m)
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

          {statsSoal.length > 0 && (
            <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-5 shadow-xl">
              <h3 className="text-base font-black text-white mb-3">Statistik Tingkat Kesulitan Soal</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {statsSoal.map((sq, idx) => {
                  const jBenar = sq.jumlahBenar ?? sq.totalBenar ?? 0;
                  const jSalah = sq.jumlahSalah ?? sq.totalSalah ?? 0;
                  const tot = jBenar + jSalah;
                  const salahPct = tot > 0 ? Math.round((jSalah / tot) * 100) : 0;
                  return (
                    <div
                      key={sq.questionId}
                      className="bg-slate-900/70 border border-slate-700/80 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          Soal #{sq.nomorSoal ?? idx + 1}
                        </span>
                        <p className="text-xs font-semibold text-white line-clamp-2">
                          {sq.teksSoal || sq.teks}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-black text-emerald-400 block">
                          {jBenar} Benar
                        </span>
                        <span className="text-[11px] font-mono text-rose-400">
                          {jSalah} Salah ({salahPct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <Modal
          isOpen={Boolean(detailPemain)}
          onClose={() => setDetailPemain(null)}
          title={`Riwayat Rintangan & Jatuh: ${detailPemain?.nama || ''}`}
          maxWidth="xl"
          variant="standard"
        >
          {detailPemain && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-slate-800">
              <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Jarak</span>
                  <span className="font-black text-emerald-700 text-base">
                    {detailPemain.jarakAkhir}m
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Keseimbangan</span>
                  <span className="font-black text-sky-700 text-base">
                    {detailPemain.keseimbanganAkhir}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Jatuh</span>
                  <span className="font-black text-rose-600 text-base">
                    {detailPemain.jumlahJatuh}x
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Streak Maks</span>
                  <span className="font-black text-amber-600 text-base">
                    {detailPemain.streakTertinggi}x
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Catatan Rintangan & Jatuh ({detailPemain.riwayatRintangan?.length || 0})
                </h4>
                {(!detailPemain.riwayatRintangan || detailPemain.riwayatRintangan.length === 0) ? (
                  <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-xl">
                    Tidak ada kejadian jatuh atau rintangan tercatat.
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
                          {r.efekNilai !== 0
                            ? `${r.efekNilai > 0 ? '+' : ''}${r.efekNilai} ${r.satuan}`
                            : r.satuan}
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
  // FASE 2: PERMAINAN BERLANGSUNG (ARENA LINTASAN + LEADERBOARD REALTIME)
  // -------------------------------------------------------------------------
  const totalSelesaiCount = leaderboard.filter((p) => p.status === 'selesai').length;
  const maxVisualLintasan = tampilSemuaLintasan
    ? leaderboard.length
    : Math.min(leaderboard.length, 10);
  const pesertaVisual = leaderboard.slice(0, maxVisualLintasan);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950/70 to-slate-900 text-white p-4 sm:p-6 flex flex-col gap-5 select-none">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black uppercase tracking-wider">
              Balap Karung Live • PIN {token} • Target {targetJarak}m
            </span>
            <span className="text-xs text-slate-400">
              {totalSelesaiCount} / {totalPeserta} Finis
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

      {liveFeed.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {liveFeed.map((item) => {
            const warna =
              item.tipe === 'finis'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : item.tipe === 'jatuh'
                ? 'bg-rose-600/25 border-rose-400 text-rose-200'
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        {/* Arena Lintasan Horizontal */}
        <section className="lg:col-span-7 bg-slate-800/75 border border-slate-700 rounded-3xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-400" />
                Arena Lintasan Balap Karung ({pesertaVisual.length} dari {leaderboard.length} Pelari)
              </h2>
              <p className="text-xs text-slate-400">
                Posisi lompatan, keseimbangan, dan kejadian jatuh tersinkronisasi dari server.
              </p>
            </div>
            {leaderboard.length > 10 && (
              <button
                type="button"
                onClick={() => setTampilSemuaLintasan((v) => !v)}
                className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-slate-200 transition-colors"
              >
                {tampilSemuaLintasan ? 'Tampilkan Top 10' : `Tampilkan Semua (${leaderboard.length})`}
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {pesertaVisual.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Menunggu pelari masuk ke lintasan...
              </div>
            ) : (
              pesertaVisual.map((p) => (
                <div
                  key={p.id}
                  className="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-3 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-amber-400 font-mono">#{p.peringkat}</span>
                      <span className="font-bold text-white">{p.nama}</span>
                      {p.jumlahJatuh > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                          {p.jumlahJatuh}x Jatuh
                        </span>
                      )}
                    </div>
                    {p.status === 'selesai' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                        FINIS {formatDurasiDetik(p.waktuSelesaiMs)}
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-slate-300">
                        {p.jarak}m / {targetJarak}m
                      </span>
                    )}
                  </div>
                  <LintasanBalapKarung
                    jarak={p.jarak}
                    targetJarak={p.targetJarak || targetJarak}
                    keseimbangan={p.keseimbangan}
                    keseimbanganAktif={keseimbanganAktif}
                    namaPemain={p.nama}
                    efekAktif={p.efekAktif}
                    lastDeltaJarak={deltaMap[p.id]}
                    ekspresi={ekspresiMap[p.id]}
                    terjatuh={Boolean(jatuhMap[p.id])}
                    streak={p.streakSaatIni}
                    status={p.status}
                    compact
                  />
                </div>
              ))
            )}
          </div>
        </section>

        {/* Leaderboard Real-Time */}
        <section className="lg:col-span-5 bg-slate-800/85 border border-slate-700 rounded-3xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Leaderboard Real-Time
            </h2>
            <span className="text-xs font-mono text-slate-400">{leaderboard.length} Pelari</span>
          </div>

          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
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
                    {p.efekAktif?.perisai && (
                      <span title="Perisai Aktif" className="text-sky-400">
                        <Shield className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {p.efekAktif?.lompatanKuat && (
                      <span title="Lompatan Kuat" className="text-amber-400">
                        <Zap className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {p.efekAktif?.jalanBerlumpur && (
                      <span title="Jalan Berlumpur" className="text-amber-600">
                        <CloudRain className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {p.streakSaatIni >= 2 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] font-black">
                        <Flame className="w-3 h-3" /> {p.streakSaatIni}
                      </span>
                    )}
                    <span className="font-mono font-black text-sm text-emerald-300">
                      {p.jarak}m
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-2">
                    <span>✓{p.totalBenar} / ✗{p.totalSalah}</span>
                    {keseimbanganAktif && (
                      <span className="text-sky-300 flex items-center gap-0.5">
                        <Scale className="w-3 h-3" /> {p.keseimbangan}%
                      </span>
                    )}
                    <span className="text-rose-300 flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3" /> {p.jumlahJatuh}x
                    </span>
                  </span>
                  {p.status === 'selesai' && p.waktuSelesaiMs ? (
                    <span className="text-amber-300 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDurasiDetik(p.waktuSelesaiMs)}
                    </span>
                  ) : (
                    <span>{p.jumlahJawab} soal</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Modal
        isOpen={modalAkhiriOpen}
        onClose={() => setModalAkhiriOpen(false)}
        title="Akhiri Balap Karung Challenge?"
        maxWidth="md"
        variant="standard"
      >
        <div className="space-y-4 text-slate-700">
          <p className="text-sm leading-relaxed">
            Seluruh siswa akan langsung melihat podium juara dan laporan hasil saat ini. Sesi yang dihentikan manual tidak dapat dilanjutkan kembali.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="hantu" onClick={() => setModalAkhiriOpen(false)}>
              Lanjutkan Perlombaan
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

