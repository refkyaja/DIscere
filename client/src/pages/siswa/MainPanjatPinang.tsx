import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../../lib/socket';
import { Button } from '../../components';
import { soundEffects } from '../../lib/soundEffects';
import TiangPinangVisual, { EfekAktifVisual } from './TiangPinangVisual';
import KarakterPanjatPinang from './KarakterPanjatPinang';
import {
  Users,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  LogOut,
  Flame,
  Shield,
  Droplets,
  HandMetal,
  Gift,
  ArrowRight,
  AlertTriangle,
  WifiOff,
  Loader2,
  Volume2,
  VolumeX,
  ChevronRight,
  Sparkles,
  Flag,
} from 'lucide-react';

interface PilihanPanjat {
  choiceId: string;
  key: 'A' | 'B' | 'C' | 'D' | 'E';
  teks: string;
}

interface SoalPanjatData {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  totalSoalTemplate: number;
  teks: string;
  pilihan: PilihanPanjat[];
  isBonusKulitPisang: boolean;
  ditampilkanPadaMs: number;
}

interface RintanganLogItem {
  id: string;
  tipe: string;
  judul: string;
  deskripsi: string;
  efekNilai: number;
  satuan: string;
  timestampMs: number;
}

interface PesertaPanjatData {
  id: string;
  nama: string;
  connected?: boolean;
  posisi: number;
  poinBonus: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen?: number;
  streakSaatIni: number;
  streakTertinggi: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs?: number | null;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  peringkat?: number;
  efekAktif: EfekAktifVisual;
  riwayatRintangan?: RintanganLogItem[];
}

interface HasilAkhirPanjatData {
  leaderboard?: PesertaPanjatData[];
  podium?: {
    juara1?: PesertaPanjatData;
    juara2?: PesertaPanjatData;
    juara3?: PesertaPanjatData;
  };
  dihentikanManual?: boolean;
}

interface FeedbackPanjatState {
  tampil: boolean;
  benar: boolean;
  kunciKey?: string;
  penjelasan?: string | null;
  isBonusKulitPisang?: boolean;
  perubahanPosisi?: number;
  bonusStreakDidapat?: number;
  bonusPeganganKuatDidapat?: number;
  penaltiTiangLicin?: number;
  perisaiDigunakan?: boolean;
  perisaiDiperoleh?: boolean;
  rintanganBaru?: RintanganLogItem | null;
}

interface MainPanjatPinangProps {
  token: string;
  nama: string;
  sessionId: string;
  pesertaId: string;
  pesertaSecret: string;
  templateJudul: string;
  config?: {
    kesulitan?: string;
    naikBenar?: number;
    turunSalah?: number;
    bonusStreakAktif?: boolean;
    rintanganAktif?: boolean;
  };
  initialStatus?: string;
  initialPesertaState?: PesertaPanjatData;
  initialLeaderboard?: PesertaPanjatData[];
  initialSoalAktif?: SoalPanjatData | null;
  onKeluar: () => void;
}

export default function MainPanjatPinang({
  token,
  nama,
  sessionId,
  pesertaId,
  pesertaSecret,
  templateJudul,
  config,
  initialStatus = 'lobi',
  initialPesertaState,
  initialLeaderboard = [],
  initialSoalAktif = null,
  onKeluar,
}: MainPanjatPinangProps) {
  const [stage, setStage] = useState<'LOBBY' | 'PLAYING' | 'SELESAI'>(
    initialStatus === 'jalan' ? 'PLAYING' : initialStatus === 'selesai' ? 'SELESAI' : 'LOBBY'
  );

  const [myState, setMyState] = useState<PesertaPanjatData>(
    initialPesertaState || {
      id: pesertaId,
      nama,
      posisi: 0,
      poinBonus: 0,
      totalBenar: 0,
      totalSalah: 0,
      streakSaatIni: 0,
      streakTertinggi: 0,
      status: 'bermain',
      rataRataWaktuJawabMs: 0,
      jumlahJawab: 0,
      efekAktif: {},
      riwayatRintangan: [],
    }
  );

  const [leaderboard, setLeaderboard] = useState<PesertaPanjatData[]>(initialLeaderboard);
  const [totalPeserta, setTotalPeserta] = useState<number>(initialLeaderboard.length || 1);

  const [soalAktif, setSoalAktif] = useState<SoalPanjatData | null>(initialSoalAktif);
  const [choiceDipilih, setChoiceDipilih] = useState<string | null>(null);
  const [sudahKirim, setSudahKirim] = useState(false);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [reactionNonce, setReactionNonce] = useState<number>(0);

  const [feedback, setFeedback] = useState<FeedbackPanjatState | null>(null);
  const [hasilAkhir, setHasilAkhir] = useState<HasilAkhirPanjatData | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDisconnected, setIsDisconnected] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(soundEffects.getMuted());

  // Stopwatch waktu jawab per soal (tampilan kecepatan respon tanpa memblokir tombol)
  const [detikElapsed, setDetikElapsed] = useState<number>(0);
  const stopwatchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartMsRef = useRef<number>(Date.now());

  const startStopwatch = useCallback((resetValue = true) => {
    if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    if (resetValue) {
      questionStartMsRef.current = Date.now();
      setDetikElapsed(0);
    }
    stopwatchRef.current = setInterval(() => {
      setDetikElapsed(Math.round((Date.now() - questionStartMsRef.current) / 100) / 10);
    }, 100);
  }, []);

  const stopStopwatch = useCallback(() => {
    if (stopwatchRef.current) {
      clearInterval(stopwatchRef.current);
      stopwatchRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (initialStatus === 'jalan' && initialSoalAktif) {
      startStopwatch(true);
    }
    return () => {
      stopStopwatch();
    };
  }, [initialStatus, initialSoalAktif, startStopwatch, stopStopwatch]);

  useEffect(() => {
    const socket = getSocket();

    const handleLobiUpdate = (data: {
      game?: string;
      totalPeserta: number;
      leaderboard?: PesertaPanjatData[];
      daftarPeserta?: PesertaPanjatData[];
    }) => {
      setTotalPeserta(data.totalPeserta);
      const list = data.leaderboard || data.daftarPeserta;
      if (list) setLeaderboard(list);
    };

    const handleGameMulai = (data: { leaderboard?: PesertaPanjatData[] }) => {
      setStage('PLAYING');
      setSubmitError(null);
      if (data?.leaderboard) {
        setLeaderboard(data.leaderboard);
        const me = data.leaderboard.find((p) => p.id === pesertaId);
        if (me) setMyState(me);
      }
      soundEffects.playWhistle();
    };

    const handleSoalTampil = (data: SoalPanjatData & { game?: string }) => {
      if (data.game && data.game !== 'panjat_pinang') return;
      setStage('PLAYING');
      setSoalAktif(data);
      setChoiceDipilih(null);
      setSudahKirim(false);
      setFeedback(null);
      setLastDelta(null);
      setSubmitError(null);
      startStopwatch(true);
    };

    const handlePanjatUpdate = (data: {
      leaderboard: PesertaPanjatData[];
      totalPeserta?: number;
    }) => {
      if (data?.leaderboard) {
        setLeaderboard(data.leaderboard);
        if (data.totalPeserta) setTotalPeserta(data.totalPeserta);
        const me = data.leaderboard.find((p) => p.id === pesertaId);
        if (me) setMyState((prev) => ({ ...prev, ...me }));
      }
    };

    const handleJawabHasil = (
      res: FeedbackPanjatState & {
        success?: boolean;
        game?: string;
        pesertaUpdated?: PesertaPanjatData;
      }
    ) => {
      if (!res?.success || res.game !== 'panjat_pinang') return;
      stopStopwatch();
      setSubmitError(null);

      if (res.pesertaUpdated) {
        setMyState(res.pesertaUpdated);
      }
      setLastDelta(typeof res.perubahanPosisi === 'number' ? res.perubahanPosisi : 0);
      setReactionNonce((n) => n + 1);

      if (res.rintanganBaru || res.perisaiDiperoleh || res.perisaiDigunakan) {
        soundEffects.playBoost();
      } else if (res.benar) {
        soundEffects.playClimb();
      } else {
        soundEffects.playSlip();
      }

      setFeedback({
        tampil: true,
        benar: Boolean(res.benar),
        kunciKey: res.kunciKey,
        penjelasan: res.penjelasan,
        isBonusKulitPisang: res.isBonusKulitPisang,
        perubahanPosisi: res.perubahanPosisi,
        bonusStreakDidapat: res.bonusStreakDidapat,
        bonusPeganganKuatDidapat: res.bonusPeganganKuatDidapat,
        penaltiTiangLicin: res.penaltiTiangLicin,
        perisaiDigunakan: res.perisaiDigunakan,
        perisaiDiperoleh: res.perisaiDiperoleh,
        rintanganBaru: res.rintanganBaru,
      });
    };

    const handlePemainSelesai = (data: { peserta?: PesertaPanjatData }) => {
      stopStopwatch();
      soundEffects.playVictoryFanfare();
      if (data?.peserta) {
        setMyState(data.peserta);
      } else {
        setMyState((prev) => ({ ...prev, status: 'selesai', posisi: 100 }));
      }
    };

    const handleSesiSelesai = (data: { hasil: HasilAkhirPanjatData }) => {
      stopStopwatch();
      setHasilAkhir(data.hasil);
      setStage('SELESAI');
      soundEffects.playVictoryFanfare();
      sessionStorage.removeItem('discere_multi_token');
      sessionStorage.removeItem('discere_multi_peserta_id');
      sessionStorage.removeItem('discere_multi_peserta_secret');
      sessionStorage.removeItem('discere_multi_nama');
    };

    const handleSesiError = (data: { pesan?: string }) => {
      if (data?.pesan) setSubmitError(data.pesan);
    };

    const handleDisconnect = () => setIsDisconnected(true);
    const handleConnect = () => setIsDisconnected(false);

    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleConnect);
    socket.on('lobi:update', handleLobiUpdate);
    socket.on('game:mulai', handleGameMulai);
    socket.on('soal:tampil', handleSoalTampil);
    socket.on('panjat:update', handlePanjatUpdate);
    socket.on('jawab:hasil', handleJawabHasil);
    socket.on('pemain:selesai', handlePemainSelesai);
    socket.on('sesi:selesai', handleSesiSelesai);
    socket.on('sesi:error', handleSesiError);

    return () => {
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('soal:tampil', handleSoalTampil);
      socket.off('panjat:update', handlePanjatUpdate);
      socket.off('jawab:hasil', handleJawabHasil);
      socket.off('pemain:selesai', handlePemainSelesai);
      socket.off('sesi:selesai', handleSesiSelesai);
      socket.off('sesi:error', handleSesiError);
    };
  }, [pesertaId, startStopwatch, stopStopwatch]);

  const handlePilihJawaban = (opsi: PilihanPanjat) => {
    if (sudahKirim || !soalAktif || myState.status === 'selesai') return;

    setChoiceDipilih(opsi.choiceId);
    setSudahKirim(true);
    setSubmitError(null);
    stopStopwatch();

    const socket = getSocket();
    socket.emit(
      'jawab:kirim',
      {
        sessionId,
        pesertaId,
        pesertaSecret,
        presentationId: soalAktif.presentationId,
        questionId: soalAktif.questionId,
        choiceId: opsi.choiceId,
        jawaban: opsi.key,
      },
      (res: { success?: boolean; pesan?: string }) => {
        if (!res?.success) {
          setSudahKirim(false);
          setChoiceDipilih(null);
          startStopwatch(false);
          setSubmitError(res?.pesan || 'Jawaban belum dapat diproses. Silakan pilih kembali.');
        }
      }
    );
  };

  const handleLanjutCepat = () => {
    const socket = getSocket();
    socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
  };

  const handleToggleSound = () => {
    const nextMuted = soundEffects.toggleMute();
    setIsMuted(nextMuted);
  };

  const myRank = leaderboard.findIndex((p) => p.id === pesertaId) + 1;
  const safePosisi = Math.max(0, Math.min(100, Math.round(myState.posisi)));

  // Status timer respon jujur terhadap state permainan (Normal / Peringatan / Kritis / Selesai)
  const timerPhase: 'selesai' | 'normal' | 'peringatan' | 'kritis' = sudahKirim
    ? 'selesai'
    : detikElapsed >= 25
    ? 'kritis'
    : detikElapsed >= 15
    ? 'peringatan'
    : 'normal';

  const timerStyleMap = {
    normal: {
      container: 'bg-slate-800/95 border-sky-500/45 text-sky-100',
      bar: 'bg-sky-400',
      label: 'Waktu Jawab',
      labelColor: 'text-sky-300',
    },
    peringatan: {
      container: 'bg-amber-500/15 border-amber-400/75 text-amber-100',
      bar: 'bg-amber-400',
      label: 'Ayo Cepat!',
      labelColor: 'text-amber-300',
    },
    kritis: {
      container: 'bg-rose-500/20 border-rose-400 text-rose-100 motion-safe:animate-pulse',
      bar: 'bg-rose-400',
      label: 'Segera Jawab!',
      labelColor: 'text-rose-300',
    },
    selesai: {
      container: 'bg-emerald-500/15 border-emerald-400/60 text-emerald-100',
      bar: 'bg-emerald-400',
      label: 'Selesai Menjawab',
      labelColor: 'text-emerald-300',
    },
  } as const;

  const timerStyle = timerStyleMap[timerPhase];

  // =========================================================================
  // 1. TAHAP LOBI SISWA (Konsisten Dark Navy + Aksen Karnaval DISCERE)
  // =========================================================================
  if (stage === 'LOBBY') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#070d1d] via-[#0c1836] to-[#0b1f33] text-white p-3 sm:p-6 flex flex-col justify-between select-none">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-between gap-4 sm:gap-6">
          <header className="flex items-center justify-between gap-3 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-2xl p-3.5 sm:px-5 shadow-lg">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-[#D7262E] text-white text-[10px] font-black uppercase tracking-wider">
                  Panjat Pinang
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 text-[10px] font-mono font-black tracking-wider">
                  PIN {token}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                {templateJudul}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleToggleSound}
                aria-label={isMuted ? 'Nyalakan suara' : 'Bisukan suara'}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors cursor-pointer"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
              </button>
              <button
                type="button"
                onClick={onKeluar}
                aria-label="Keluar dari sesi"
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-400/60 text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>

          <main className="my-auto grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-center">
            <div className="md:col-span-5 bg-slate-900/90 border border-slate-700/80 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col items-center">
              <TiangPinangVisual
                posisi={0}
                namaPemain={nama}
                showProgressFooter={false}
              />
            </div>

            <div className="md:col-span-7 bg-slate-900/90 border border-slate-700/80 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs font-black rounded-full uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" /> Siap Memanjat!
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-white break-words">
                  Halo, {nama}!
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Jawab pertanyaan dengan tepat dan cepat untuk memanjat tiang pinang hingga mencapai{' '}
                  <strong className="text-amber-300">Puncak 100%</strong>.
                </p>
              </div>

              {config && (
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Tingkat & Langkah</span>
                    <strong className="text-amber-300 uppercase">
                      {config.kesulitan || 'normal'} (+{config.naikBenar ?? 10}% / -{config.turunSalah ?? 5}%)
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Fitur Aktif</span>
                    <strong className="text-emerald-300">
                      {config.bonusStreakAktif ? 'Streak Aktif' : 'Tanpa Streak'}
                      {config.rintanganAktif ? ' • Rintangan' : ''}
                    </strong>
                  </div>
                </div>
              )}

              <div className="bg-amber-400/10 border border-amber-400/40 rounded-2xl p-4 flex items-center gap-3">
                <span className="w-3 h-3 bg-amber-400 rounded-full motion-safe:animate-ping shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-amber-200">
                  Menunggu guru memulai perlombaan Panjat Pinang...
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-300 bg-slate-800/60 px-4 py-3 rounded-2xl border border-slate-700/70">
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  Peserta siap di lobi
                </span>
                <span className="font-mono text-sm font-black text-white">
                  {totalPeserta} Siswa
                </span>
              </div>
            </div>
          </main>

          <footer className="text-center text-xs font-semibold text-slate-500 py-1">
            DISCERE • Lomba Panjat Pinang Edukatif
          </footer>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. TAHAP PERMAINAN BERJALAN
  // =========================================================================
  if (stage === 'PLAYING') {
    // 2a. Pemain sudah mencapai puncak 100% (menunggu pemain lain)
    if (myState.status === 'selesai' || myState.posisi >= 100) {
      const totalJawab = myState.totalBenar + myState.totalSalah;
      const akurasi = totalJawab > 0 ? Math.round((myState.totalBenar / totalJawab) * 100) : 0;

      return (
        <div className="min-h-screen bg-gradient-to-br from-[#070d1d] via-[#0c1836] to-[#0b1f33] text-white flex flex-col justify-between p-3 sm:p-6 select-none">
          <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-between gap-4 sm:gap-6">
            <header className="flex items-center justify-between gap-3 bg-slate-900/90 rounded-2xl p-4 border border-amber-400/40 shadow-lg">
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase text-amber-400 block tracking-wider">
                  Panjat Pinang • Puncak Tercapai!
                </span>
                <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                  {templateJudul}
                </h2>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 bg-amber-400/20 border border-amber-400/50 text-amber-300 rounded-xl text-xs sm:text-sm font-black shrink-0">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Rank #{myRank || 1}</span>
              </div>
            </header>

            <main className="my-auto grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-5 bg-slate-900/90 border-2 border-amber-400/50 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col items-center">
                <TiangPinangVisual
                  posisi={100}
                  namaPemain={myState.nama}
                  status="selesai"
                  showProgressFooter={false}
                />
              </div>

              <div className="md:col-span-7 bg-slate-900/95 border-2 border-amber-400/60 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/15 border border-emerald-400/40 px-3 py-1 rounded-full mb-2">
                    <Flag className="w-3.5 h-3.5" /> Lomba Selesai Untukmu
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black text-white">
                    Puncak 100% Tercapai!
                  </h1>
                  <p className="text-sm text-slate-300 mt-1">
                    Hebat, {myState.nama}! Kamu berhasil menaklukkan tiang pinang.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="bg-slate-800/85 p-3.5 rounded-2xl border border-slate-700">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">
                      Jawaban Benar / Salah
                    </span>
                    <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                      {myState.totalBenar}✓ / {myState.totalSalah}✗ ({akurasi}%)
                    </span>
                  </div>
                  <div className="bg-slate-800/85 p-3.5 rounded-2xl border border-slate-700">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">
                      Waktu Capai Puncak
                    </span>
                    <span className="text-base sm:text-lg font-black text-amber-400 font-mono">
                      {myState.waktuSelesaiMs
                        ? `${(myState.waktuSelesaiMs / 1000).toFixed(1)}s`
                        : '-'}
                    </span>
                  </div>
                  <div className="bg-slate-800/85 p-3.5 rounded-2xl border border-slate-700">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">
                      Streak Tertinggi
                    </span>
                    <span className="text-base sm:text-lg font-black text-orange-400 font-mono">
                      {myState.streakTertinggi}x berturut
                    </span>
                  </div>
                  <div className="bg-slate-800/85 p-3.5 rounded-2xl border border-slate-700">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">
                      Rata-rata Kecepatan
                    </span>
                    <span className="text-base sm:text-lg font-black text-sky-400 font-mono">
                      {myState.rataRataWaktuJawabMs
                        ? `${(myState.rataRataWaktuJawabMs / 1000).toFixed(1)}s`
                        : '-'}
                    </span>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/35 rounded-2xl p-3.5 flex items-center gap-3 text-xs sm:text-sm text-amber-200 font-semibold">
                  <span className="w-2.5 h-2.5 bg-amber-400 rounded-full motion-safe:animate-ping shrink-0" />
                  <span>Menunggu teman lain selesai atau guru mengakhiri permainan...</span>
                </div>
              </div>
            </main>

            <footer className="text-center text-xs text-slate-500 pb-1">
              Laporan akhir & podium akan tampil otomatis saat sesi ditutup.
            </footer>
          </div>
        </div>
      );
    }

    // 2b. Pemain sedang memanjat
    const ekspresiKarakter = feedback?.tampil
      ? feedback.benar
        ? 'bahagia'
        : 'sedih'
      : 'netral';

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#070d1d] via-[#0c1836] to-[#0a1529] text-white flex flex-col p-3 sm:p-5 lg:p-6 select-none overflow-x-hidden">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col gap-3 sm:gap-4">
          {/* 1. HEADER PERMAINAN & TIMER */}
          <header className="bg-slate-900/90 backdrop-blur border border-slate-700/85 rounded-2xl sm:rounded-3xl p-3 sm:px-5 sm:py-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
            {/* Identitas Mode & Progress Soal */}
            <div className="min-w-0 flex-1 basis-[210px]">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-[#D7262E] text-white text-[10px] font-black uppercase tracking-wider">
                  Panjat Pinang • PIN {token}
                </span>
                {config?.kesulitan && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-600/80 text-amber-300 text-[10px] font-extrabold uppercase">
                    {config.kesulitan}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/35 text-sky-300 text-[10px] font-mono font-bold">
                  Soal #{soalAktif?.nomorSoal ?? Math.max(1, myState.jumlahJawab + 1)}
                  {soalAktif?.totalSoalTemplate ? `/${soalAktif.totalSoalTemplate}` : ''}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-white truncate">
                {templateJudul}
              </h1>
            </div>

            {/* Statistik Pemain: Rank, Benar/Salah, Streak */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-extrabold">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-amber-300">Rank #{myRank || 1}</span>
                <span className="text-slate-500 text-[11px]">/ {totalPeserta}</span>
              </div>

              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono font-black">
                <span className="flex items-center gap-1 text-emerald-400" title="Jawaban Benar">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {myState.totalBenar}
                </span>
                <span className="text-slate-600">|</span>
                <span className="flex items-center gap-1 text-rose-400" title="Jawaban Salah">
                  <XCircle className="w-3.5 h-3.5" />
                  {myState.totalSalah}
                </span>
              </div>

              {myState.streakSaatIni > 0 ? (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-orange-500/15 border border-orange-400/45 text-orange-300 text-xs font-black">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>{myState.streakSaatIni} Streak</span>
                </div>
              ) : myState.poinBonus > 0 ? (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-mono font-black">
                  +{myState.poinBonus} pt
                </div>
              ) : null}
            </div>

            {/* Timer Menonjol + Mute */}
            <div className="flex items-center gap-2 ml-auto sm:ml-0">
              <div
                className={`min-w-[138px] sm:min-w-[156px] px-3 py-1.5 rounded-2xl border-2 shadow-inner transition-colors ${timerStyle.container}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${timerStyle.labelColor}`}>
                    {timerStyle.label}
                  </span>
                  <div className="flex items-center gap-1 font-mono text-sm sm:text-base font-black tabular-nums">
                    {timerPhase === 'peringatan' || timerPhase === 'kritis' ? (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    ) : timerPhase === 'selesai' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{detikElapsed.toFixed(1)}s</span>
                  </div>
                </div>
                <div className="w-full h-1 bg-slate-950/50 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full transition-all duration-150 ${timerStyle.bar}`}
                    style={{ width: `${Math.min(100, (detikElapsed / 30) * 100)}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleSound}
                aria-label={isMuted ? 'Nyalakan suara efek' : 'Bisukan suara efek'}
                title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors cursor-pointer shrink-0"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
              </button>
            </div>
          </header>

          {/* Status Koneksi / Error Pengiriman */}
          {isDisconnected && (
            <div
              role="status"
              className="px-4 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-400/60 text-amber-200 text-xs font-bold flex items-center gap-2"
            >
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Koneksi sedang terputus. Mencoba menyambung kembali otomatis...</span>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="px-4 py-2.5 rounded-2xl bg-rose-500/20 border border-rose-400 text-rose-100 text-xs font-bold flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
                {submitError}
              </span>
              <button
                type="button"
                onClick={() => setSubmitError(null)}
                className="text-rose-200 hover:text-white underline text-[11px] shrink-0 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {/* AREA UTAMA: 2 Kolom Seimbang (Desktop & Tablet) / 1 Kolom Berurutan (Smartphone) */}
          <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 items-stretch">
            {/* KOLOM KIRI: Visual Tiang & Karakter (#2 Mobile) + Kartu Progress Pemain (#3 Mobile) */}
            <section className="md:col-span-5 flex flex-col gap-3 sm:gap-4">
              {/* 2. Visual Karakter & Tiang */}
              <div className="bg-slate-900/90 border border-slate-700/85 rounded-3xl p-3.5 sm:p-4 lg:p-5 shadow-xl flex-1 flex flex-col items-center justify-between gap-3">
                {/* Badge Efek Rintangan Aktif pada Tiang */}
                {(myState.efekAktif?.tiangLicin ||
                  myState.efekAktif?.perisaiKulitPisang ||
                  myState.efekAktif?.peganganKuat ||
                  soalAktif?.isBonusKulitPisang) && (
                  <div className="w-full flex flex-wrap items-center justify-center gap-1.5">
                    {myState.efekAktif?.tiangLicin && (
                      <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-[11px] font-bold flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5" /> Tiang Licin Aktif
                      </span>
                    )}
                    {myState.efekAktif?.perisaiKulitPisang && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-[11px] font-bold flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" /> Perisai Aktif (1x)
                      </span>
                    )}
                    {myState.efekAktif?.peganganKuat && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[11px] font-bold flex items-center gap-1">
                        <HandMetal className="w-3.5 h-3.5" /> Pegangan Kuat Siap
                      </span>
                    )}
                    {soalAktif?.isBonusKulitPisang && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" /> Soal Bonus Perisai!
                      </span>
                    )}
                  </div>
                )}

                <TiangPinangVisual
                  posisi={myState.posisi}
                  namaPemain={nama}
                  efekAktif={myState.efekAktif}
                  lastDelta={lastDelta}
                  ekspresi={ekspresiKarakter}
                  streak={myState.streakSaatIni}
                  status={myState.status}
                  showProgressFooter={false}
                  reactionNonce={reactionNonce}
                />
              </div>

              {/* 3. Kartu Progress Pemain (Tunggal — tanpa duplikasi di Header atau Tiang) */}
              <div className="bg-slate-900/90 border border-slate-700/85 rounded-2xl sm:rounded-3xl p-4 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Pemain
                    </span>
                    <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                      {myState.nama || nama}
                    </h2>
                  </div>

                  <div className="flex items-baseline gap-2 shrink-0">
                    {lastDelta !== null && lastDelta !== 0 && (
                      <span
                        className={`text-xs font-mono font-black px-2 py-0.5 rounded-full ${
                          lastDelta > 0
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                        }`}
                      >
                        {lastDelta > 0 ? `+${lastDelta}%` : `${lastDelta}%`}
                      </span>
                    )}
                    <span className="text-xl sm:text-2xl font-black font-mono text-amber-300 tabular-nums">
                      {safePosisi}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar Smooth + Penanda Milestone */}
                <div className="relative w-full h-3.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-0.5">
                  <div
                    style={{ width: `${safePosisi}%` }}
                    className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${
                      safePosisi >= 100
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                        : 'bg-gradient-to-r from-[#D7262E] via-amber-400 to-emerald-400'
                    }`}
                  />
                  {[25, 50, 75].map((tick) => (
                    <span
                      key={tick}
                      style={{ left: `${tick}%` }}
                      className="absolute inset-y-0 w-px bg-slate-950/50 pointer-events-none"
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-400">
                  <span>Posisi Tiang</span>
                  <span className="text-slate-200">
                    {safePosisi >= 100
                      ? 'Puncak 100% tercapai!'
                      : `Butuh ${100 - safePosisi}% lagi`}
                  </span>
                </div>
              </div>
            </section>

            {/* KOLOM KANAN: Pertanyaan (#4 Mobile), Pilihan Jawaban (#5 Mobile) & Feedback */}
            <section className="md:col-span-7 flex flex-col justify-start gap-4">
              {/* 4. Area Pertanyaan */}
              <div className="bg-slate-900/95 border-2 border-slate-700/90 rounded-3xl p-5 sm:p-6 shadow-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                    {soalAktif?.isBonusKulitPisang
                      ? 'Tantangan Bonus Perisai'
                      : `Pertanyaan #${soalAktif?.nomorSoal ?? 1}`}
                  </span>
                  {soalAktif?.totalSoalTemplate ? (
                    <span className="text-[11px] font-bold text-slate-400">
                      Bank Soal: {soalAktif.totalSoalTemplate} Soal
                    </span>
                  ) : null}
                </div>

                {soalAktif?.isBonusKulitPisang && (
                  <div className="p-2.5 rounded-xl bg-amber-400/15 border border-amber-400/45 text-amber-200 text-xs font-bold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>Jawab benar untuk mendapatkan Perisai Anti-Turun!</span>
                  </div>
                )}

                {soalAktif ? (
                  <p className="text-base sm:text-xl lg:text-[22px] font-bold text-white leading-relaxed break-words">
                    {soalAktif.teks}
                  </p>
                ) : (
                  <div className="py-6 flex items-center justify-center gap-2.5 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                    <span className="text-sm font-semibold">Menyiapkan pertanyaan berikutnya...</span>
                  </div>
                )}
              </div>

              {/* 5. Daftar Pilihan Jawaban (6 State Visual Jelas) */}
              <div className="grid grid-cols-1 gap-2.5 sm:gap-3" role="group" aria-label="Pilihan jawaban">
                {soalAktif?.pilihan.map((opsi) => {
                  const isDipilih = choiceDipilih === opsi.choiceId;
                  const isKunci = feedback?.kunciKey === opsi.key;
                  const isTampilkanHasil = Boolean(feedback?.tampil);

                  let cardCls =
                    'bg-slate-800/95 border-slate-600/80 text-slate-100 hover:bg-slate-800 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-950/40';
                  let keyCls = 'bg-slate-700 text-amber-300 border border-slate-600';
                  let statusNode = (
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-300 transition-colors shrink-0" />
                  );

                  if (isTampilkanHasil) {
                    if (isKunci && feedback?.benar && isDipilih) {
                      // State: Benar & Dipilih
                      cardCls =
                        'bg-emerald-500/20 border-emerald-400 text-white ring-2 ring-emerald-400/45 shadow-lg shadow-emerald-950/40';
                      keyCls = 'bg-emerald-400 text-slate-950 border border-emerald-200';
                      statusNode = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 text-[11px] font-black shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                          <span className="hidden sm:inline">
                            {feedback.isBonusKulitPisang ? 'Perisai!' : 'Memanjat!'}
                          </span>
                        </span>
                      );
                    } else if (isKunci) {
                      // State: Kunci Benar (saat user memilih opsi lain)
                      cardCls =
                        'bg-emerald-500/15 border-emerald-400/85 text-emerald-50 ring-1 ring-emerald-400/40';
                      keyCls = 'bg-emerald-500 text-slate-950 border border-emerald-300';
                      statusNode = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/45 text-emerald-200 text-[11px] font-black shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                          <span className="hidden sm:inline">Jawaban Benar</span>
                        </span>
                      );
                    } else if (isDipilih && !feedback?.benar) {
                      // State: Salah & Dipilih
                      cardCls =
                        'bg-rose-500/20 border-rose-400 text-rose-50 ring-2 ring-rose-400/40';
                      keyCls = 'bg-rose-500 text-white border border-rose-300';
                      statusNode = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/25 border border-rose-400/50 text-rose-200 text-[11px] font-black shrink-0">
                          <XCircle className="w-3.5 h-3.5 text-rose-300" />
                          <span className="hidden sm:inline">Kurang Tepat</span>
                        </span>
                      );
                    } else {
                      // State: Disabled / Nonaktif setelah dijawab
                      cardCls = 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-55';
                      keyCls = 'bg-slate-800 text-slate-500 border border-slate-700';
                      statusNode = <span className="sr-only">Nonaktif</span>;
                    }
                  } else if (isDipilih) {
                    // State: Selected (menunggu konfirmasi backend)
                    cardCls =
                      'bg-amber-500/20 border-amber-400 text-white ring-2 ring-amber-400/50 shadow-lg shadow-amber-950/30';
                    keyCls = 'bg-amber-400 text-slate-950 border border-amber-200';
                    statusNode = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-200 text-[11px] font-black shrink-0">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Dipilih</span>
                      </span>
                    );
                  } else if (sudahKirim) {
                    // State: Disabled sementara
                    cardCls = 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-60';
                    keyCls = 'bg-slate-800 text-slate-500 border border-slate-700';
                    statusNode = <span className="sr-only">Terkunci</span>;
                  }

                  return (
                    <button
                      key={opsi.choiceId}
                      type="button"
                      disabled={sudahKirim}
                      aria-pressed={isDipilih}
                      onClick={() => handlePilihJawaban(opsi)}
                      className={`group w-full p-3.5 sm:p-4 rounded-2xl border-2 flex items-center gap-3 sm:gap-3.5 transition-all duration-150 active:scale-[0.99] motion-reduce:transform-none text-left min-h-[54px] sm:min-h-[60px] ${cardCls} ${
                        sudahKirim ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-xs sm:text-sm font-black shrink-0 transition-colors ${keyCls}`}
                      >
                        {opsi.key}
                      </span>
                      <span className="text-sm sm:text-base font-bold flex-1 min-w-0 leading-snug break-words">
                        {opsi.teks}
                      </span>
                      {statusNode}
                    </button>
                  );
                })}
              </div>

              {/* Banner Feedback & Tombol Lanjut */}
              {feedback?.tampil && (
                <div
                  role="status"
                  className={`p-4 rounded-2xl sm:rounded-3xl text-xs sm:text-sm font-bold shadow-xl space-y-2.5 border-2 motion-safe:panjat-anim-feedback ${
                    feedback.benar
                      ? 'bg-emerald-950/90 border-emerald-400/75 text-emerald-100'
                      : 'bg-rose-950/90 border-rose-400/75 text-rose-100'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {feedback.benar ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <div className="font-black text-white text-sm sm:text-base">
                          {feedback.isBonusKulitPisang
                            ? feedback.benar
                              ? 'Perisai Kulit Pisang Diperoleh!'
                              : 'Soal Bonus Perisai Terlewat'
                            : feedback.benar
                            ? `Benar! Naik +${feedback.perubahanPosisi ?? 0}% ke Tiang`
                            : `Kurang Tepat (Kunci: ${feedback.kunciKey}) ${
                                feedback.perubahanPosisi ? `(${feedback.perubahanPosisi}%)` : ''
                              }`}
                        </div>
                        <p className="text-[11px] font-medium text-slate-300">
                          Soal berikutnya segera dimulai otomatis, atau lanjut sekarang.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLanjutCepat}
                      className="px-4 py-2.5 min-h-[44px] bg-white hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-colors cursor-pointer shrink-0"
                    >
                      <span>Lanjut Soal</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Detail Bonus & Rintangan */}
                  <div className="flex flex-wrap gap-2">
                    {feedback.bonusStreakDidapat && feedback.bonusStreakDidapat > 0 ? (
                      <span className="px-2.5 py-1 rounded-lg bg-orange-500/20 border border-orange-400/40 text-orange-200 text-[11px] flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 fill-current" /> Bonus Streak (+
                        {feedback.bonusStreakDidapat}%)
                      </span>
                    ) : null}

                    {feedback.bonusPeganganKuatDidapat && feedback.bonusPeganganKuatDidapat > 0 ? (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[11px] flex items-center gap-1">
                        <HandMetal className="w-3.5 h-3.5" /> Pegangan Kuat (+
                        {feedback.bonusPeganganKuatDidapat}%)
                      </span>
                    ) : null}

                    {feedback.perisaiDigunakan && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[11px] flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" /> Perisai Menahan Tiang Licin!
                      </span>
                    )}

                    {feedback.penaltiTiangLicin && feedback.penaltiTiangLicin > 0 ? (
                      <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-[11px] flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5" /> Terpeleset Tiang Licin (-
                        {feedback.penaltiTiangLicin}% tambahan)
                      </span>
                    ) : null}
                  </div>

                  {feedback.rintanganBaru && (
                    <div className="p-2.5 rounded-xl bg-amber-400/15 border border-amber-400/45 text-amber-100 flex items-start gap-2.5">
                      <Gift className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <div className="font-black text-amber-300">
                          {feedback.rintanganBaru.judul}
                        </div>
                        <div className="text-[11px] text-slate-200 font-medium">
                          {feedback.rintanganBaru.deskripsi}
                        </div>
                      </div>
                    </div>
                  )}

                  {feedback.penjelasan && (
                    <p className="text-xs text-slate-200 font-medium pt-1 border-t border-white/10 leading-relaxed">
                      {feedback.penjelasan}
                    </p>
                  )}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. TAHAP SELESAI & PODIUM JUARA
  // =========================================================================
  const finalLeaderboard: PesertaPanjatData[] = hasilAkhir?.leaderboard || leaderboard;
  const juara1 = hasilAkhir?.podium?.juara1 || finalLeaderboard[0];
  const juara2 = hasilAkhir?.podium?.juara2 || finalLeaderboard[1];
  const juara3 = hasilAkhir?.podium?.juara3 || finalLeaderboard[2];

  const myFinalIndex = finalLeaderboard.findIndex((p) => p.id === pesertaId);
  const myFinalData = finalLeaderboard[myFinalIndex] || myState;
  const totalJawabFinal = myFinalData.totalBenar + myFinalData.totalSalah;
  const akurasiFinal =
    myFinalData.akurasiPersen ??
    (totalJawabFinal > 0 ? Math.round((myFinalData.totalBenar / totalJawabFinal) * 100) : 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070d1d] via-[#0c1836] to-[#0b1f33] text-white p-3 sm:p-6 flex flex-col justify-between select-none">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-between gap-5">
        <div className="text-center pt-2 space-y-1.5">
          <span className="inline-block px-3 py-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black rounded-full uppercase tracking-wider">
            Panjat Pinang Selesai
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-white">Podium Juara 🏆</h1>
          {myFinalIndex === 0 && (
            <p className="text-sm font-black text-amber-400">
              Selamat! Kamu Berhasil Meraih Juara 1! 🥇
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center my-auto">
          {/* Podium 1, 2, 3 dengan Karakter 2D Juara */}
          <div className="md:col-span-6 bg-slate-900/90 border border-slate-700/80 rounded-3xl p-5 shadow-2xl flex items-end justify-center gap-3">
            {juara2 && (
              <div className="flex flex-col items-center w-24 sm:w-28 text-center">
                <KarakterPanjatPinang
                  nama={juara2.nama}
                  pose="podium"
                  ekspresi="bahagia"
                  podiumRank={2}
                  size="sm"
                  className="mb-1"
                />
                <span className="text-xs font-bold text-slate-200 truncate w-full">{juara2.nama}</span>
                <span className="text-[11px] font-mono text-slate-400 mb-1">{juara2.posisi}%</span>
                <div className="w-full bg-slate-700 h-24 rounded-t-2xl flex flex-col items-center justify-center font-black text-slate-200 border-t-2 border-slate-400">
                  <span className="text-xl leading-none">2</span>
                  <span className="text-[9px] font-bold uppercase text-sky-300 mt-0.5">Perak</span>
                </div>
              </div>
            )}

            {juara1 && (
              <div className="flex flex-col items-center w-28 sm:w-32 text-center">
                <KarakterPanjatPinang
                  nama={juara1.nama}
                  pose="podium"
                  ekspresi="bahagia"
                  podiumRank={1}
                  size="md"
                  className="mb-1"
                />
                <span className="text-xs sm:text-sm font-black text-amber-300 truncate w-full">
                  {juara1.nama}
                </span>
                <span className="text-xs font-mono font-bold text-amber-400 mb-1">
                  {juara1.posisi}%
                </span>
                <div className="w-full bg-amber-500 h-32 rounded-t-2xl flex flex-col items-center justify-center font-black text-slate-950 border-t-2 border-amber-300 shadow-lg">
                  <span className="text-2xl leading-none">1</span>
                  <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">
                    Mahkota Juara
                  </span>
                </div>
              </div>
            )}

            {juara3 && (
              <div className="flex flex-col items-center w-24 sm:w-28 text-center">
                <KarakterPanjatPinang
                  nama={juara3.nama}
                  pose="podium"
                  ekspresi="bahagia"
                  podiumRank={3}
                  size="sm"
                  className="mb-1"
                />
                <span className="text-xs font-bold text-slate-200 truncate w-full">{juara3.nama}</span>
                <span className="text-[11px] font-mono text-slate-400 mb-1">{juara3.posisi}%</span>
                <div className="w-full bg-amber-800/85 h-18 rounded-t-2xl flex flex-col items-center justify-center font-black text-amber-200 border-t-2 border-amber-600">
                  <span className="text-xl leading-none">3</span>
                  <span className="text-[9px] font-bold uppercase text-amber-200 mt-0.5">Perunggu</span>
                </div>
              </div>
            )}
          </div>

          {/* Rapor Pribadi */}
          <div className="md:col-span-6 bg-slate-900/90 border border-slate-700/80 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div>
                <span className="text-[11px] uppercase font-bold text-slate-400">Peringkat Akhir</span>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  {myFinalIndex >= 0 ? `#${myFinalIndex + 1}` : '-'} dari {finalLeaderboard.length} Siswa
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[11px] uppercase font-bold text-slate-400">Ketinggian Akhir</span>
                <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                  {myFinalData.posisi}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-2xl">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">
                  Akurasi Jawaban
                </span>
                <span className="font-bold text-emerald-400 font-mono">
                  {myFinalData.totalBenar}✓ / {myFinalData.totalSalah}✗ ({akurasiFinal}%)
                </span>
              </div>
              <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-2xl">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">
                  Streak Tertinggi
                </span>
                <span className="font-bold text-orange-400 font-mono">
                  {myFinalData.streakTertinggi}x berturut
                </span>
              </div>
              <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-2xl">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">
                  Rata-rata Kecepatan
                </span>
                <span className="font-bold text-sky-400 font-mono">
                  {myFinalData.rataRataWaktuJawabMs
                    ? `${(myFinalData.rataRataWaktuJawabMs / 1000).toFixed(1)}s`
                    : '-'}
                </span>
              </div>
              <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-2xl">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">
                  Waktu Puncak / Bonus
                </span>
                <span className="font-bold text-amber-300 font-mono">
                  {myFinalData.waktuSelesaiMs
                    ? `${(myFinalData.waktuSelesaiMs / 1000).toFixed(1)}s`
                    : `${myFinalData.poinBonus || 0} pt bonus`}
                </span>
              </div>
            </div>

            <Button
              variant="utama"
              onClick={onKeluar}
              className="w-full py-3.5 min-h-[48px] text-sm font-black bg-[#D7262E] hover:bg-[#b81e25] text-white rounded-2xl"
            >
              Selesai & Keluar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
