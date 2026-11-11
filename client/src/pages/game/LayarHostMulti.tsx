import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { bindHostReconnect } from '../../lib/socketReconnect';
import { VisualisasiTali } from './VisualisasiTali';
import KarakterTarikTambang, { EkspresiTarikTambang } from '../siswa/KarakterTarikTambang';
import { Modal } from '../../components';
import { soundEffects } from '../../lib/soundEffects';
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  Clock,
  Copy,
  Home,
  Loader2,
  Play,
  RotateCcw,
  ShieldAlert,
  Shuffle,
  StopCircle,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

interface PesertaItem {
  id: string;
  nama: string;
  tim: 'merah' | 'putih' | null;
  connected: boolean;
  totalBenar?: number;
  totalSalah?: number;
  jumlahJawab?: number;
  akurasiPersen?: number;
  streakSaatIni?: number;
  streakTertinggi?: number;
  totalBonusStreak?: number;
}

interface SoalTimHost {
  presentationId: string;
  id: string;
  questionId: string;
  nomorRonde: number;
  kesulitan: 'mudah' | 'sedang' | 'sulit';
  teks: string;
  pilihan: Array<{ choiceId: string; label: 'A' | 'B' | 'C' | 'D' | 'E'; teks: string }>;
  endsAt?: number;
  duration?: number;
}

interface HasilRondeMulti {
  nomorRonde: number;
  tim1Teks: string;
  tim2Teks: string;
  tim1Kunci: string;
  tim2Kunci: string;
  tim1Penjelasan: string | null;
  tim2Penjelasan: string | null;
  tim1BenarCount: number;
  tim1AnggotaCount: number;
  tim2BenarCount: number;
  tim2AnggotaCount: number;
  akurasiTim1: number;
  akurasiTim2: number;
  selisihKekuatan: number;
  bonusStreakTim1: number;
  bonusStreakTim2: number;
  bonusKekompakanTim1: number;
  bonusKekompakanTim2: number;
  powerUpTim1Dipakai: string | null;
  powerUpTim2Dipakai: string | null;
  bonusPowerUpNet: number;
  perubahanTali: number;
  posisiSesudah: number;
}

interface HasilAkhirMulti {
  sessionId: string;
  timMenang: 'merah' | 'putih' | 'seri';
  konfigurasi?: { namaTim1?: string; namaTim2?: string; batasMenang?: number };
  namaTim1?: string;
  namaTim2?: string;
  posisiAkhir: number;
  jumlahRonde?: number;
  skorMerah: number;
  skorPutih: number;
  akurasiTim1?: number;
  akurasiTim2?: number;
  akurasiTim1Persen?: number;
  akurasiTim2Persen?: number;
  totalBonusStreakTim1?: number;
  totalBonusStreakTim2?: number;
  totalBonusKekompakanTim1?: number;
  totalBonusKekompakanTim2?: number;
  penggunaanPowerUp?: {
    tim1: Array<{ ronde: number; tipe: string }>;
    tim2: Array<{ ronde: number; tipe: string }>;
  };
  penggunaanPowerUpTim1?: Array<{ ronde: number; tipe: string }>;
  penggunaanPowerUpTim2?: Array<{ ronde: number; tipe: string }>;
  durasiPermainanMs?: number;
  riwayatTali?: Array<{ ronde: number; posisi: number; perubahan: number }>;
  statistikPemain?: PesertaItem[];
}

interface ConfigTarikMulti {
  kesulitan: 'mudah' | 'sedang' | 'sulit';
  durasiRonde: 15 | 20 | 30;
  bonusAktif: boolean;
  powerUpAktif: boolean;
  namaTim1: string;
  namaTim2: string;
  maxPeserta: number;
  batasMenang?: number;
}

const DEFAULT_CONFIG: ConfigTarikMulti = {
  kesulitan: 'sedang',
  durasiRonde: 20,
  bonusAktif: true,
  powerUpAktif: true,
  namaTim1: 'Tim Merah',
  namaTim2: 'Tim Biru',
  maxPeserta: 60,
  batasMenang: 100,
};

function formatDurasi(ms?: number): string {
  if (!ms || ms <= 0) return '0d';
  const totalDetik = Math.round(ms / 1000);
  const menit = Math.floor(totalDetik / 60);
  const detik = totalDetik % 60;
  return menit > 0 ? `${menit}m ${detik}d` : `${detik}d`;
}

export default function LayarHostMulti() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('kembali') || '/guru';

  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [templateJudul, setTemplateJudul] = useState('');
  const [token, setToken] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'lobi' | 'jalan' | 'selesai'>('lobi');
  const [config, setConfig] = useState<ConfigTarikMulti>(DEFAULT_CONFIG);

  const [daftarPeserta, setDaftarPeserta] = useState<PesertaItem[]>([]);
  const [totalPeserta, setTotalPeserta] = useState(0);
  const [nomorRonde, setNomorRonde] = useState(0);
  const [soalTim1, setSoalTim1] = useState<SoalTimHost | null>(null);
  const [soalTim2, setSoalTim2] = useState<SoalTimHost | null>(null);
  const [sisaDetik, setSisaDetik] = useState(20);
  const [taliPosition, setTaliPosition] = useState(0);
  const [skorMerah, setSkorMerah] = useState(0);
  const [skorPutih, setSkorPutih] = useState(0);
  const [progressTim1, setProgressTim1] = useState({ dijawab: 0, total: 0 });
  const [progressTim2, setProgressTim2] = useState({ dijawab: 0, total: 0 });
  const [powerUpTim1, setPowerUpTim1] = useState<{
    bank: string | null;
    aktifBerikutnya: string | null;
  }>({ bank: null, aktifBerikutnya: null });
  const [powerUpTim2, setPowerUpTim2] = useState<{
    bank: string | null;
    aktifBerikutnya: string | null;
  }>({ bank: null, aktifBerikutnya: null });

  const [reaksiTarik, setReaksiTarik] = useState<{
    merah?: EkspresiTarikTambang;
    putih?: EkspresiTarikTambang;
  } | null>(null);
  const [rekapRonde, setRekapRonde] = useState<HasilRondeMulti | null>(null);
  const [hasilAkhir, setHasilAkhir] = useState<HasilAkhirMulti | null>(null);

  const [modalAkhiriOpen, setModalAkhiriOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isMuted, setIsMuted] = useState(soundEffects.getMuted());
  const [isMainLagiLoading, setIsMainLagiLoading] = useState(false);

  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startCountdown = useCallback((endsAtTimestamp?: number, fallbackSec = 20) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (!endsAtTimestamp) {
      setSisaDetik(fallbackSec);
      return;
    }
    const tick = () => {
      const diffMs = endsAtTimestamp - Date.now();
      const detik = Math.max(0, Math.ceil(diffMs / 1000));
      setSisaDetik(detik);
      if (detik <= 0 && countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
    tick();
    countdownIntervalRef.current = setInterval(tick, 200);
  }, []);

  const fetchInitialSession = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiRequest<{ session: any }>(`/sesi/${id}`);
      const s = res.session;
      setTemplateJudul(s.templateJudul || 'Tarik Tambang Challenge');
      setToken(s.token || '');
      setQrDataUrl(s.qrDataUrl || '');
      setJoinUrl(s.joinUrl || '');
      if (s.config) setConfig({ ...DEFAULT_CONFIG, ...s.config });
      setStatus(s.status || 'lobi');
      setTaliPosition(s.taliPosition ?? 0);
      setSkorMerah(s.skorMerah ?? 0);
      setSkorPutih(s.skorPutih ?? 0);
      setDaftarPeserta(s.daftarPeserta || []);
      setTotalPeserta(s.totalPeserta ?? (s.daftarPeserta?.length || 0));
      setNomorRonde(s.nomorRonde ?? 0);
      if (s.powerUpTim1) setPowerUpTim1(s.powerUpTim1);
      if (s.powerUpTim2) setPowerUpTim2(s.powerUpTim2);

      if (s.rondeSaatIni) {
        setSoalTim1(s.rondeSaatIni.soalTim1 || null);
        setSoalTim2(s.rondeSaatIni.soalTim2 || null);
        if (s.rondeSaatIni.progressTim1) setProgressTim1(s.rondeSaatIni.progressTim1);
        if (s.rondeSaatIni.progressTim2) setProgressTim2(s.rondeSaatIni.progressTim2);
        startCountdown(s.rondeSaatIni.berakhirPadaMs, s.config?.durasiRonde ?? 20);
      }
      if (s.status === 'selesai') {
        if (s.hasil) {
          setHasilAkhir(s.hasil);
        } else {
          const hasilRes = await apiRequest<{ hasil: HasilAkhirMulti }>(`/sesi/${id}/hasil`).catch(
            () => null
          );
          if (hasilRes?.hasil) setHasilAkhir(hasilRes.hasil);
        }
      }
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal memuat sesi Multiplayer.');
    } finally {
      setLoading(false);
    }
  }, [id, startCountdown]);

  useEffect(() => {
    fetchInitialSession();
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
    };
  }, [fetchInitialSession]);

  useEffect(() => {
    if (!id || loading) return;
    const socket = getSocket();
    const unbindHost = bindHostReconnect(socket, id);

    const onLobiUpdate = (data: any) => {
      if (data.daftarPeserta) setDaftarPeserta(data.daftarPeserta);
      if (data.totalPeserta !== undefined) setTotalPeserta(data.totalPeserta);
      if (data.config) setConfig((prev) => ({ ...prev, ...data.config }));
      if (data.status) setStatus(data.status);
      if (data.taliPosition !== undefined) setTaliPosition(data.taliPosition);
      if (data.powerUpTim1) setPowerUpTim1(data.powerUpTim1);
      if (data.powerUpTim2) setPowerUpTim2(data.powerUpTim2);
    };

    const onTeamsAssigned = (data: { daftarPeserta: PesertaItem[] }) => {
      if (data.daftarPeserta) {
        setDaftarPeserta(data.daftarPeserta);
        setTotalPeserta(data.daftarPeserta.length);
      }
    };

    const onRondeHostUpdate = (data: any) => {
      setStatus('jalan');
      setRekapRonde(null);
      setReaksiTarik(null);
      setNomorRonde(data.nomorRonde ?? 1);
      setSoalTim1(data.soalTim1 || null);
      setSoalTim2(data.soalTim2 || null);
      if (data.progressTim1) setProgressTim1(data.progressTim1);
      if (data.progressTim2) setProgressTim2(data.progressTim2);
      startCountdown(data.endsAt, data.duration || config.durasiRonde);
    };

    const onTaliUpdate = (data: any) => {
      if (data.taliPosition !== undefined) setTaliPosition(data.taliPosition);
      if (data.skorMerah !== undefined) setSkorMerah(data.skorMerah);
      if (data.skorPutih !== undefined) setSkorPutih(data.skorPutih);
      if (data.progressTim1) setProgressTim1(data.progressTim1);
      if (data.progressTim2) setProgressTim2(data.progressTim2);
    };

    const onPowerUpUpdate = (data: any) => {
      if (data.powerUpTim1) setPowerUpTim1(data.powerUpTim1);
      if (data.powerUpTim2) setPowerUpTim2(data.powerUpTim2);
    };

    const onSoalSelesai = (data: any) => {
      soundEffects.playRopeTug();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setSisaDetik(0);
      if (data.taliPosition !== undefined) setTaliPosition(data.taliPosition);
      if (data.skorMerah !== undefined) setSkorMerah(data.skorMerah);
      if (data.skorPutih !== undefined) setSkorPutih(data.skorPutih);
      if (data.powerUpTim1) setPowerUpTim1(data.powerUpTim1);
      if (data.powerUpTim2) setPowerUpTim2(data.powerUpTim2);
      if (data.daftarPeserta) setDaftarPeserta(data.daftarPeserta);
      if (data.hasilRonde) {
        setRekapRonde(data.hasilRonde);
        const delta = data.hasilRonde.perubahanTali;
        if (delta > 0) setReaksiTarik({ merah: 'bahagia', putih: 'sedih' });
        else if (delta < 0) setReaksiTarik({ merah: 'sedih', putih: 'bahagia' });
      }
    };

    const onSesiSelesai = (data: { hasil: HasilAkhirMulti }) => {
      soundEffects.playVictoryFanfare();
      setStatus('selesai');
      setHasilAkhir(data.hasil);
      if (data.hasil?.statistikPemain) {
        setDaftarPeserta(data.hasil.statistikPemain);
      }
    };

    const onSesiError = (data: { pesan?: string }) => {
      if (data?.pesan) setErrorPesan(data.pesan);
    };

    socket.on('lobi:update', onLobiUpdate);
    socket.on('teams_assigned', onTeamsAssigned);
    socket.on('ronde:host_update', onRondeHostUpdate);
    socket.on('tali:update', onTaliUpdate);
    socket.on('powerup:update', onPowerUpUpdate);
    socket.on('soal:selesai', onSoalSelesai);
    socket.on('sesi:selesai', onSesiSelesai);
    socket.on('sesi:error', onSesiError);

    return () => {
      unbindHost();
      socket.off('lobi:update', onLobiUpdate);
      socket.off('teams_assigned', onTeamsAssigned);
      socket.off('ronde:host_update', onRondeHostUpdate);
      socket.off('tali:update', onTaliUpdate);
      socket.off('powerup:update', onPowerUpUpdate);
      socket.off('soal:selesai', onSoalSelesai);
      socket.off('sesi:selesai', onSesiSelesai);
      socket.off('sesi:error', onSesiError);
    };
  }, [id, loading, startCountdown, config.durasiRonde]);

  const handleCopyLink = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Abaikan jika browser memblokir clipboard
    }
  };

  const handleAcakUlangTim = () => {
    if (!id || status !== 'lobi') return;
    setIsShuffling(true);
    setErrorPesan(null);
    getSocket().emit('sesi:acak_tim', { sessionId: id }, (res: any) => {
      setIsShuffling(false);
      if (!res?.success) {
        setErrorPesan(res?.pesan || 'Gagal mengacak ulang tim.');
      }
    });
  };

  const handlePindahTim = (pesertaId: string, timTujuan: 'merah' | 'putih') => {
    if (!id || status !== 'lobi') return;
    setErrorPesan(null);
    getSocket().emit(
      'sesi:pindah_tim',
      { sessionId: id, pesertaId, timTujuan },
      (res: any) => {
        if (!res?.success) {
          setErrorPesan(res?.pesan || 'Gagal memindahkan siswa.');
        }
      }
    );
  };

  const handleMulaiPermainan = () => {
    if (!id || isStarting) return;
    setIsStarting(true);
    setErrorPesan(null);
    getSocket().emit('sesi:mulai', { sessionId: id }, (res: any) => {
      setIsStarting(false);
      if (!res?.success) {
        setErrorPesan(res?.pesan || 'Gagal memulai pertandingan.');
      } else {
        soundEffects.playWhistle();
      }
    });
  };

  const handleAkhiriManual = () => {
    if (!id || isEnding) return;
    setIsEnding(true);
    getSocket().emit('sesi:akhiri_manual', { sessionId: id }, (res: any) => {
      setIsEnding(false);
      setModalAkhiriOpen(false);
      if (!res?.success) {
        setErrorPesan(res?.pesan || 'Gagal mengakhiri permainan.');
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
      navigate(`/guru/sesi/${res.sessionId}?kembali=${encodeURIComponent(returnUrl)}`);
    } catch (err: any) {
      alert(err.pesan || 'Gagal membuat sesi main lagi.');
      setIsMainLagiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="portal-bg relative">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#f4ecd8]">
          <Loader2 className="w-10 h-10 animate-spin text-[#f2c230] mb-3" />
          <p className="portal-cv text-3xl">Membuka Ruang Lobi Multiplayer...</p>
        </div>
      </div>
    );
  }

  const anggotaTim1 = daftarPeserta.filter((p) => p.tim === 'merah');
  const anggotaTim2 = daftarPeserta.filter((p) => p.tim === 'putih');

  // =========================================================================
  // STAGE 3: HASIL AKHIR LOMBA MULTIPLAYER
  // =========================================================================
  if (status === 'selesai' && hasilAkhir) {
    const namaTim1 = hasilAkhir.konfigurasi?.namaTim1 || hasilAkhir.namaTim1 || config.namaTim1;
    const namaTim2 = hasilAkhir.konfigurasi?.namaTim2 || hasilAkhir.namaTim2 || config.namaTim2;
    const akurasi1 = hasilAkhir.akurasiTim1 ?? hasilAkhir.akurasiTim1Persen ?? 0;
    const akurasi2 = hasilAkhir.akurasiTim2 ?? hasilAkhir.akurasiTim2Persen ?? 0;
    const pu1Count =
      hasilAkhir.penggunaanPowerUp?.tim1?.length ??
      hasilAkhir.penggunaanPowerUpTim1?.length ??
      0;
    const pu2Count =
      hasilAkhir.penggunaanPowerUp?.tim2?.length ??
      hasilAkhir.penggunaanPowerUpTim2?.length ??
      0;
    const labelMenang =
      hasilAkhir.timMenang === 'merah'
        ? `${namaTim1} Menang!`
        : hasilAkhir.timMenang === 'putih'
        ? `${namaTim2} Menang!`
        : 'Pertandingan Seri!';

    const pemainLaporan = hasilAkhir.statistikPemain || daftarPeserta;

    return (
      <div className="portal-bg min-h-screen px-4 py-6 sm:px-8 sm:py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div
            className={`rounded-3xl p-6 sm:p-8 text-white shadow-[0_8px_0_rgba(0,0,0,0.25)] flex flex-col md:flex-row items-center justify-between gap-6 ${
              hasilAkhir.timMenang === 'merah'
                ? 'bg-gradient-to-br from-[#c8362f] to-[#961e19]'
                : hasilAkhir.timMenang === 'putih'
                ? 'bg-gradient-to-br from-[#2563eb] to-[#1e3a8a]'
                : 'bg-gradient-to-br from-[#b45309] to-[#78350f]'
            }`}
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-black uppercase mb-2">
                <Trophy className="w-4 h-4 text-[#f2c230]" />
                <span>Hasil Akhir Team Multiplayer</span>
              </div>
              <h1 className="portal-cv text-4xl sm:text-5xl">{labelMenang}</h1>
              <p className="text-sm font-bold opacity-90 mt-1">
                {templateJudul} • Posisi Akhir Tali:{' '}
                {hasilAkhir.posisiAkhir > 0 ? `+${hasilAkhir.posisiAkhir}` : hasilAkhir.posisiAkhir}
              </p>
            </div>

            <div className="flex items-end gap-3 bg-white/15 px-5 py-3 rounded-2xl">
              <KarakterTarikTambang
                tim="merah"
                pose="podium"
                ekspresi={hasilAkhir.timMenang === 'merah' ? 'menang' : 'kalah'}
                podiumRank={hasilAkhir.timMenang === 'merah' ? 1 : 2}
                size="md"
              />
              <KarakterTarikTambang
                tim="putih"
                pose="podium"
                ekspresi={hasilAkhir.timMenang === 'putih' ? 'menang' : 'kalah'}
                podiumRank={hasilAkhir.timMenang === 'putih' ? 1 : 2}
                size="md"
              />
            </div>
          </div>

          <VisualisasiTali
            posisi={hasilAkhir.posisiAkhir}
            batasMenang={hasilAkhir.konfigurasi?.batasMenang ?? config.batasMenang ?? 100}
            skorMerah={hasilAkhir.skorMerah}
            skorPutih={hasilAkhir.skorPutih}
            namaTim1={namaTim1}
            namaTim2={namaTim2}
            jumlahPemainMerah={anggotaTim1.length}
            jumlahPemainPutih={anggotaTim2.length}
            pemenang={hasilAkhir.timMenang}
            theme="chalk"
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#fbf6e9] rounded-2xl p-4 border-2 border-[#e0d5b8]">
              <div className="text-xs font-bold text-[#6b7d6c]">Jumlah Ronde</div>
              <div className="text-2xl font-black text-[#1d3b2e] mt-1">
                {hasilAkhir.jumlahRonde ?? nomorRonde}
              </div>
            </div>
            <div className="bg-[#fbf6e9] rounded-2xl p-4 border-2 border-[#e0d5b8]">
              <div className="text-xs font-bold text-[#6b7d6c]">Durasi Permainan</div>
              <div className="text-2xl font-black text-[#1d3b2e] mt-1">
                {formatDurasi(hasilAkhir.durasiPermainanMs)}
              </div>
            </div>
            <div className="bg-[#fbf6e9] rounded-2xl p-4 border-2 border-[#d9544c]/60">
              <div className="text-xs font-bold text-[#c8362f]">{namaTim1}</div>
              <div className="text-2xl font-black text-[#c8362f] mt-1">{akurasi1}%</div>
              <div className="text-[11px] font-bold text-[#6b7d6c]">
                Streak +{hasilAkhir.totalBonusStreakTim1 ?? 0} • Kompak +
                {hasilAkhir.totalBonusKekompakanTim1 ?? 0} • PU {pu1Count}x
              </div>
            </div>
            <div className="bg-[#fbf6e9] rounded-2xl p-4 border-2 border-[#3b82f6]/60">
              <div className="text-xs font-bold text-[#2563eb]">{namaTim2}</div>
              <div className="text-2xl font-black text-[#2563eb] mt-1">{akurasi2}%</div>
              <div className="text-[11px] font-bold text-[#6b7d6c]">
                Streak +{hasilAkhir.totalBonusStreakTim2 ?? 0} • Kompak +
                {hasilAkhir.totalBonusKekompakanTim2 ?? 0} • PU {pu2Count}x
              </div>
            </div>
          </div>

          {hasilAkhir.riwayatTali && hasilAkhir.riwayatTali.length > 0 && (
            <div className="bg-[#fbf6e9] rounded-3xl p-5 border-2 border-[#e0d5b8] space-y-2">
              <div className="text-sm font-black text-[#1d3b2e]">Riwayat Pergerakan Tali</div>
              <div className="flex flex-wrap gap-2">
                {hasilAkhir.riwayatTali.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-xl bg-[#f4ecd9] border border-[#d6c8a4] text-xs font-extrabold text-[#1d3b2e]"
                  >
                    R{item.ronde}: {item.posisi > 0 ? `+${item.posisi}` : item.posisi}
                  </span>
                ))}
              </div>
            </div>
          )}

          {pemainLaporan.length > 0 && (
            <div className="bg-[#fbf6e9] rounded-3xl p-6 border-2 border-[#e0d5b8] overflow-x-auto">
              <h2 className="text-lg font-black text-[#1d3b2e] mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#2563eb]" />
                <span>Statistik Individu Siswa ({pemainLaporan.length} Peserta)</span>
              </h2>
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b-2 border-[#e0d5b8] text-xs font-extrabold uppercase text-[#6b7d6c]">
                    <th className="py-2 pr-3">Nama Siswa</th>
                    <th className="py-2 pr-3">Tim</th>
                    <th className="py-2 pr-3">Benar / Salah</th>
                    <th className="py-2 pr-3">Akurasi</th>
                    <th className="py-2 pr-3">Streak Tertinggi</th>
                    <th className="py-2">Bonus Streak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0d5b8] font-bold text-[#1d3b2e]">
                  {pemainLaporan.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 pr-3">{p.nama}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-black ${
                            p.tim === 'merah'
                              ? 'bg-[#fde8e7] text-[#c8362f]'
                              : 'bg-[#dbeafe] text-[#2563eb]'
                          }`}
                        >
                          {p.tim === 'merah' ? namaTim1 : namaTim2}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className="text-emerald-700">{p.totalBenar ?? 0}</span> /{' '}
                        <span className="text-red-600">{p.totalSalah ?? 0}</span>
                      </td>
                      <td className="py-2 pr-3">{p.akurasiPersen ?? 0}%</td>
                      <td className="py-2 pr-3">{p.streakTertinggi ?? 0}</td>
                      <td className="py-2">+{p.totalBonusStreak ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              disabled={isMainLagiLoading}
              onClick={handleMainLagi}
              className="px-6 py-3.5 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-black inline-flex items-center gap-2 shadow-[0_4px_0_#1e3a8a]"
            >
              {isMainLagiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              <span>Main Lagi (Aturan Sama)</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/guru')}
              className="px-6 py-3.5 rounded-2xl bg-[#fbf6e9] hover:bg-white text-[#1d3b2e] font-black border-2 border-[#d6c8a4] inline-flex items-center gap-2 shadow"
            >
              <Home className="w-4 h-4" />
              <span>Kembali ke Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-bg min-h-screen px-4 py-5 sm:px-6 sm:py-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header Atas */}
        <header className="bg-[#fbf6e9] rounded-2xl px-4 py-3 border-2 border-[#e0d5b8] shadow-[0_4px_0_rgba(0,0,0,0.2)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(returnUrl)}
              className="p-2 rounded-xl bg-[#f1e7ce] hover:bg-[#e5d8b8] text-[#1d3b2e] border border-[#d6c8a4]"
              title={returnUrl.includes('tarik-tambang') ? 'Kembali ke Pengaturan' : 'Kembali ke Dashboard'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-[#2563eb]">
                Mode Multiplayer • {templateJudul}
              </div>
              <h1 className="font-black text-base sm:text-lg text-[#1d3b2e]">
                {status === 'lobi'
                  ? `Lobi Pembagian Tim (${totalPeserta}/${config.maxPeserta} Siswa)`
                  : `Ronde #${nomorRonde} • Kesulitan ${config.kesulitan}`}
              </h1>
            </div>
          </div>

          {status === 'jalan' && (
            <div
              className={`px-4 py-2 rounded-2xl font-black text-lg flex items-center gap-2 border-2 ${
                sisaDetik <= 5
                  ? 'bg-[#fde8e7] text-[#c8362f] border-[#c8362f] animate-pulse'
                  : 'bg-[#244a39] text-[#f2c230] border-[#1d3b2e]'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>{sisaDetik > 0 ? `${sisaDetik}d` : 'Evaluasi'}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMuted(soundEffects.toggleMute())}
              className="p-2.5 rounded-xl bg-[#f1e7ce] text-[#1d3b2e] border border-[#d6c8a4]"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {status === 'lobi' ? (
              <button
                type="button"
                disabled={isStarting || totalPeserta < 2}
                onClick={handleMulaiPermainan}
                className="px-5 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-black text-sm inline-flex items-center gap-2 shadow disabled:opacity-50"
              >
                {isStarting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>Mulai Pertandingan</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setModalAkhiriOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#c8362f] hover:bg-[#a8241e] text-white font-black text-sm inline-flex items-center gap-1.5 shadow"
              >
                <StopCircle className="w-4 h-4" />
                <span>Akhiri</span>
              </button>
            )}
          </div>
        </header>

        {errorPesan && (
          <div className="p-3.5 rounded-2xl bg-[#fde8e7] border-2 border-[#c8362f] text-[#961e19] font-bold text-sm flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{errorPesan}</span>
          </div>
        )}

        {/* STAGE 1: LOBI + QR CODE + ACAK/PINDAH TIM */}
        {status === 'lobi' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Kartu PIN & QR */}
            <div className="bg-[#fbf6e9] rounded-3xl p-6 border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)] text-center space-y-4">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#6b7d6c]">
                  PIN Bergabung Siswa
                </div>
                <div className="text-5xl font-black tracking-[0.18em] text-[#1d3b2e] my-1">
                  {token}
                </div>
              </div>

              {qrDataUrl && (
                <div className="bg-white p-3 rounded-2xl border-2 border-[#d6c8a4] inline-block shadow-sm">
                  <img src={qrDataUrl} alt="QR Join Tarik Tambang" className="w-44 h-44" />
                </div>
              )}

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full py-2.5 px-4 rounded-xl bg-[#f1e7ce] hover:bg-[#e5d8b8] text-[#1d3b2e] font-bold text-xs inline-flex items-center justify-center gap-2 border border-[#d6c8a4]"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Tautan Disalin!' : 'Salin Tautan Siswa'}</span>
              </button>

              <div className="p-3 rounded-xl bg-[#f4ecd9] text-[11px] font-bold text-[#4a6252] text-left space-y-1">
                <div>• Kesulitan: {config.kesulitan.toUpperCase()}</div>
                <div>• Timer Ronde: {config.durasiRonde} detik</div>
                <div>• Batasan Menang: ±{config.batasMenang ?? 100} poin</div>
                <div>• Bonus Streak &amp; Kekompakan: {config.bonusAktif ? 'Aktif' : 'Nonaktif'}</div>
                <div>• Power-Up Tim: {config.powerUpAktif ? 'Aktif' : 'Nonaktif'}</div>
              </div>
            </div>

            {/* Panel Pembagian Tim (Acak & Pindah sebelum start) */}
            <div className="lg:col-span-2 bg-[#fbf6e9] rounded-3xl p-6 border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-[#1d3b2e]">
                    Daftar Peserta &amp; Pengaturan Tim
                  </h2>
                  <p className="text-xs font-semibold text-[#6b7d6c]">
                    Siswa dibagi seimbang otomatis saat masuk. Guru dapat mengacak atau memindahkan
                    anggota sebelum permainan dimulai.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isShuffling || totalPeserta < 2}
                  onClick={handleAcakUlangTim}
                  className="px-4 py-2 rounded-xl bg-[#244a39] hover:bg-[#1d3b2e] text-[#f2c230] font-black text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>Acak Ulang Tim</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Kolom Tim 1 Merah */}
                <div className="rounded-2xl bg-[#fbf0ee] border-2 border-[#d9544c] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-[#c8362f]">{config.namaTim1}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#c8362f] text-white text-xs font-black">
                      {anggotaTim1.length} Siswa
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {anggotaTim1.length === 0 ? (
                      <div className="text-xs text-[#6b7d6c] py-6 text-center font-semibold">
                        Menunggu siswa bergabung...
                      </div>
                    ) : (
                      anggotaTim1.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-[#f5c2c0] text-xs font-bold"
                        >
                          <span className="truncate text-[#1d3b2e]">{p.nama}</span>
                          <button
                            type="button"
                            onClick={() => handlePindahTim(p.id, 'putih')}
                            className="shrink-0 px-2 py-1 rounded-lg bg-[#eff6ff] hover:bg-[#dbeafe] text-[#2563eb] font-extrabold inline-flex items-center gap-1"
                            title={`Pindahkan ke ${config.namaTim2}`}
                          >
                            <ArrowLeftRight className="w-3 h-3" />
                            <span>Pindah</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Kolom Tim 2 Biru */}
                <div className="rounded-2xl bg-[#eff6ff] border-2 border-[#3b82f6] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-[#2563eb]">{config.namaTim2}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#2563eb] text-white text-xs font-black">
                      {anggotaTim2.length} Siswa
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {anggotaTim2.length === 0 ? (
                      <div className="text-xs text-[#6b7d6c] py-6 text-center font-semibold">
                        Menunggu siswa bergabung...
                      </div>
                    ) : (
                      anggotaTim2.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-[#bfdbfe] text-xs font-bold"
                        >
                          <span className="truncate text-[#1d3b2e]">{p.nama}</span>
                          <button
                            type="button"
                            onClick={() => handlePindahTim(p.id, 'merah')}
                            className="shrink-0 px-2 py-1 rounded-lg bg-[#fde8e7] hover:bg-[#fbd5d5] text-[#c8362f] font-extrabold inline-flex items-center gap-1"
                            title={`Pindahkan ke ${config.namaTim1}`}
                          >
                            <ArrowLeftRight className="w-3 h-3" />
                            <span>Pindah</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 2: PERTANDINGAN SEDANG BERJALAN */}
        {status === 'jalan' && (
          <div className="space-y-5">
            <VisualisasiTali
              posisi={taliPosition}
              batasMenang={config.batasMenang ?? 100}
              skorMerah={skorMerah}
              skorPutih={skorPutih}
              namaTim1={config.namaTim1}
              namaTim2={config.namaTim2}
              jumlahPemainMerah={anggotaTim1.length}
              jumlahPemainPutih={anggotaTim2.length}
              powerUpTim1Aktif={powerUpTim1.aktifBerikutnya}
              powerUpTim2Aktif={powerUpTim2.aktifBerikutnya}
              reaksiTim={reaksiTarik || undefined}
              theme="chalk"
            />

            {/* Progres Jawaban & Power-Up Kedua Tim */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kartu Tim 1 */}
              <div className="bg-[#fbf6e9] rounded-3xl p-5 border-2 border-[#c8362f] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-[#c8362f]">{config.namaTim1}</span>
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-[#fde8e7] text-[#c8362f]">
                    Menjawab: {progressTim1.dijawab} / {progressTim1.total}
                  </span>
                </div>
                {soalTim1 && (
                  <div className="p-4 rounded-2xl bg-white border border-[#f5c2c0]">
                    <div className="text-[11px] font-bold uppercase text-[#6b7d6c] mb-1">
                      Soal Khusus {config.namaTim1}
                    </div>
                    <div className="font-extrabold text-[#1d3b2e]">{soalTim1.teks}</div>
                  </div>
                )}
                {powerUpTim1.bank && (
                  <div className="text-xs font-bold text-[#b45309] flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    <span>Power-up siap di perangkat tim: {powerUpTim1.bank}</span>
                  </div>
                )}
              </div>

              {/* Kartu Tim 2 */}
              <div className="bg-[#fbf6e9] rounded-3xl p-5 border-2 border-[#2563eb] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-[#2563eb]">{config.namaTim2}</span>
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-[#dbeafe] text-[#2563eb]">
                    Menjawab: {progressTim2.dijawab} / {progressTim2.total}
                  </span>
                </div>
                {soalTim2 && (
                  <div className="p-4 rounded-2xl bg-white border border-[#bfdbfe]">
                    <div className="text-[11px] font-bold uppercase text-[#6b7d6c] mb-1">
                      Soal Khusus {config.namaTim2}
                    </div>
                    <div className="font-extrabold text-[#1d3b2e]">{soalTim2.teks}</div>
                  </div>
                )}
                {powerUpTim2.bank && (
                  <div className="text-xs font-bold text-[#b45309] flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    <span>Power-up siap di perangkat tim: {powerUpTim2.bank}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Banner Rekap Evaluasi Ronde Setelah Timer Selesai */}
            {rekapRonde && (
              <div className="bg-[#244a39] text-[#fbf6e9] rounded-3xl p-5 border-2 border-[#f2c230] shadow-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black text-base flex items-center gap-2">
                    <span>Rekap Ronde #{rekapRonde.nomorRonde}</span>
                  </div>
                  <div className="text-sm font-black text-[#f2c230]">
                    Perubahan Tali:{' '}
                    {rekapRonde.perubahanTali > 0
                      ? `+${rekapRonde.perubahanTali}`
                      : rekapRonde.perubahanTali}{' '}
                    → Posisi{' '}
                    {rekapRonde.posisiSesudah > 0
                      ? `+${rekapRonde.posisiSesudah}`
                      : rekapRonde.posisiSesudah}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-white/10 space-y-1">
                    <div className="font-black text-[#fca5a5]">
                      {config.namaTim1}: {rekapRonde.akurasiTim1}% ({rekapRonde.tim1BenarCount}/
                      {rekapRonde.tim1AnggotaCount} benar)
                    </div>
                    <div>
                      Kunci: <strong>{rekapRonde.tim1Kunci}</strong> • Bonus Kekompakan: +
                      {rekapRonde.bonusKekompakanTim1} • Bonus Streak: +{rekapRonde.bonusStreakTim1}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/10 space-y-1">
                    <div className="font-black text-[#93c5fd]">
                      {config.namaTim2}: {rekapRonde.akurasiTim2}% ({rekapRonde.tim2BenarCount}/
                      {rekapRonde.tim2AnggotaCount} benar)
                    </div>
                    <div>
                      Kunci: <strong>{rekapRonde.tim2Kunci}</strong> • Bonus Kekompakan: +
                      {rekapRonde.bonusKekompakanTim2} • Bonus Streak: +{rekapRonde.bonusStreakTim2}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Akhiri Manual */}
      <Modal
        isOpen={modalAkhiriOpen}
        onClose={() => setModalAkhiriOpen(false)}
        title="Akhiri Pertandingan Multiplayer?"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#4a6252] font-medium">
            Pertandingan akan dihentikan sekarang, pemenang ditentukan berdasarkan posisi tali saat
            ini ({taliPosition > 0 ? `+${taliPosition}` : taliPosition}), dan seluruh hasil siswa
            akan disimpan.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalAkhiriOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-sm text-slate-700"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isEnding}
              onClick={handleAkhiriManual}
              className="px-5 py-2 rounded-xl bg-[#c8362f] text-white font-black text-sm inline-flex items-center gap-1.5"
            >
              {isEnding && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Akhiri &amp; Simpan Hasil</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
