import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../../lib/socket';
import { bindStudentReconnect } from '../../lib/socketReconnect';
import { soundEffects, useGameSoundLifecycle } from '../../lib/soundEffects';
import TiangPinangVisual, { EfekAktifVisual } from './TiangPinangVisual';
import KarakterPanjatPinang from './KarakterPanjatPinang';
import '../../components/balapKarungFestival.css';
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
  onKeluar: (pesan?: string) => void;
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
  const { isMuted, toggleMute } = useGameSoundLifecycle(stage === 'PLAYING', sessionId);

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
      soundEffects.startGame('whistle');
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
      if (data.hasil?.dihentikanManual) {
        soundEffects.stopAll();
      } else {
        soundEffects.playNaturalVictory();
      }
      sessionStorage.removeItem('discere_multi_token');
      sessionStorage.removeItem('discere_multi_peserta_id');
      sessionStorage.removeItem('discere_multi_peserta_secret');
      sessionStorage.removeItem('discere_multi_nama');
    };

    const handleSesiError = (data: { pesan?: string }) => {
      if (data?.pesan) setSubmitError(data.pesan);
    };

    const unbindReconnect = bindStudentReconnect<{
      success?: boolean;
      status?: string;
      peserta?: PesertaPanjatData;
      leaderboard?: PesertaPanjatData[];
      soalAktif?: SoalPanjatData | null;
      hasil?: HasilAkhirPanjatData;
    }>(socket, {
      token,
      nama,
      pesertaId,
      pesertaSecret,
      onDisconnect: () => setIsDisconnected(true),
      onReconnectSuccess: (res) => {
        setIsDisconnected(false);
        if (!res?.success) return;
        if (res.peserta) setMyState(res.peserta);
        if (res.leaderboard) {
          setLeaderboard(res.leaderboard);
          setTotalPeserta(res.leaderboard.length);
        }
        if (res.status === 'jalan') {
          setStage('PLAYING');
          if (res.soalAktif) {
            setSoalAktif((prev) =>
              prev && prev.presentationId === res.soalAktif?.presentationId
                ? prev
                : res.soalAktif!
            );
          }
        } else if (res.status === 'selesai') {
          stopStopwatch();
          if (res.hasil) setHasilAkhir(res.hasil);
          setStage('SELESAI');
        }
      },
    });

    const handleDiKick = (data: { pesan?: string }) => {
      onKeluar(data?.pesan || 'Anda telah dikeluarkan dari lobi oleh guru.');
    };

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('game:mulai', handleGameMulai);
    socket.on('soal:tampil', handleSoalTampil);
    socket.on('panjat:update', handlePanjatUpdate);
    socket.on('jawab:hasil', handleJawabHasil);
    socket.on('pemain:selesai', handlePemainSelesai);
    socket.on('sesi:selesai', handleSesiSelesai);
    socket.on('sesi:error', handleSesiError);
    socket.on('sesi:dikick', handleDiKick);

    return () => {
      unbindReconnect();
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('soal:tampil', handleSoalTampil);
      socket.off('panjat:update', handlePanjatUpdate);
      socket.off('jawab:hasil', handleJawabHasil);
      socket.off('pemain:selesai', handlePemainSelesai);
      socket.off('sesi:selesai', handleSesiSelesai);
      socket.off('sesi:error', handleSesiError);
      socket.off('sesi:dikick', handleDiKick);
    };
  }, [token, nama, pesertaId, pesertaSecret, startStopwatch, stopStopwatch]);

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
      container: 'bg-[#e9f4ff] border-[#add6fa] text-[#2b2a4a]',
      bar: 'bg-[#1d8fe0]',
      label: 'Waktu Jawab',
      labelColor: 'text-[#1368ad]',
    },
    peringatan: {
      container: 'bg-[#fff3c4] border-[#ffb81c] text-[#4a3000]',
      bar: 'bg-[#e6a100]',
      label: 'Ayo Cepat!',
      labelColor: 'text-[#7a5200]',
    },
    kritis: {
      container: 'bg-[#fdecec] border-[#d63b3b] text-[#8a1f1f] motion-safe:animate-pulse',
      bar: 'bg-[#e2312d]',
      label: 'Segera Jawab!',
      labelColor: 'text-[#b81f1c]',
    },
    selesai: {
      container: 'bg-[#e9f9ef] border-[#9de0b6] text-[#136837]',
      bar: 'bg-[#1f9d55]',
      label: 'Selesai Menjawab',
      labelColor: 'text-[#1f9d55]',
    },
  } as const;

  const timerStyle = timerStyleMap[timerPhase];

  // =========================================================================
  // 1. TAHAP LOBI SISWA (TEMA FESTIVAL 17 AGUSTUS)
  // =========================================================================
  if (stage === 'LOBBY') {
    return (
      <div className="bk-festival p-3 sm:p-6 flex flex-col justify-between select-none">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-between gap-4 sm:gap-6">
          <header className="flex items-center justify-between gap-3 bg-[#fffdf6] border-2 border-[#f0dfb4] rounded-2xl p-3.5 sm:px-5 shadow-sm">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-[#e2312d] text-white text-[10px] font-black uppercase tracking-wider">
                  Panjat Pinang
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#fff3c4] border border-[#ffb81c] text-[#7a5200] text-[10px] font-mono font-black tracking-wider">
                  PIN {token}
                </span>
              </div>
              <h2 className="bk-h text-base sm:text-lg font-extrabold text-[#2b2a4a] truncate">
                {templateJudul}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onKeluar?.()}
                aria-label="Keluar dari sesi"
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#fde0e0] hover:bg-[#fccbcb] border border-[#f4b6b6] text-[#8a1f1f] transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>

          <main className="my-auto grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-center">
            <div className="md:col-span-5 bk-card !p-4 sm:!p-5 flex flex-col items-center">
              <TiangPinangVisual
                posisi={0}
                namaPemain={nama}
                showProgressFooter={false}
              />
            </div>

            <div className="md:col-span-7 bk-card !p-5 sm:!p-7 space-y-5">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#ffe9a8] border border-[#ffb81c] text-[#7a5200] text-xs font-extrabold rounded-full uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" /> Siap Memanjat!
                </span>
                <h1 className="bk-h text-2xl sm:text-3xl font-extrabold text-[#2b2a4a] break-words">
                  Halo, {nama}!
                </h1>
                <p className="text-sm text-[#6b6a85] font-semibold leading-relaxed">
                  Jawab pertanyaan dengan tepat dan cepat untuk memanjat tiang pinang hingga mencapai{' '}
                  <strong className="text-[#b81f1c]">Puncak 100%</strong>.
                </p>
              </div>

              {config && (
                <div className="grid grid-cols-2 gap-3 text-xs bg-[#fff3d6] p-4 rounded-2xl border-2 border-[#f0dfb4]">
                  <div>
                    <span className="text-[#6b6a85] font-bold block mb-0.5">Tingkat & Langkah</span>
                    <strong className="text-[#2b2a4a] uppercase">
                      {config.kesulitan || 'normal'} (+{config.naikBenar ?? 10}% / -{config.turunSalah ?? 5}%)
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#6b6a85] font-bold block mb-0.5">Fitur Aktif</span>
                    <strong className="text-[#1f9d55]">
                      {config.bonusStreakAktif ? 'Streak Aktif' : 'Tanpa Streak'}
                      {config.rintanganAktif ? ' • Rintangan' : ''}
                    </strong>
                  </div>
                </div>
              )}

              <div className="bg-[#fff3c4] border-2 border-[#ffb81c] rounded-2xl p-4 flex items-center gap-3">
                <span className="w-3 h-3 bg-[#e2312d] rounded-full motion-safe:animate-ping shrink-0" />
                <span className="text-xs sm:text-sm font-extrabold text-[#7a5200]">
                  Menunggu guru memulai perlombaan Panjat Pinang...
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-extrabold text-[#2b2a4a] bg-[#fff3d6] px-4 py-3 rounded-2xl border border-[#f0dfb4]">
                <span className="flex items-center gap-2 text-[#6b6a85]">
                  <Users className="w-4 h-4 text-[#1d8fe0]" />
                  Peserta siap di lobi
                </span>
                <span className="font-mono text-sm font-black text-[#2b2a4a]">
                  {totalPeserta} Siswa
                </span>
              </div>
            </div>
          </main>

          <footer className="text-center text-xs font-bold text-[#6b6a85] py-1">
            DISCERE • Lomba Panjat Pinang 17 Agustus
          </footer>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. TAHAP PERMAINAN BERJALAN (TEMA FESTIVAL 17 AGUSTUS)
  // =========================================================================
  if (stage === 'PLAYING') {
    // 2a. Pemain sudah mencapai puncak 100% (menunggu pemain lain)
    if (myState.status === 'selesai' || myState.posisi >= 100) {
      const totalJawab = myState.totalBenar + myState.totalSalah;
      const akurasi = totalJawab > 0 ? Math.round((myState.totalBenar / totalJawab) * 100) : 0;

      return (
        <div className="bk-festival p-3 sm:p-6 flex flex-col justify-between select-none">
          <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-between gap-4 sm:gap-6">
            <header className="flex items-center justify-between gap-3 bg-[#fffdf6] rounded-2xl p-4 border-2 border-[#ffb81c] shadow-sm">
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase text-[#b81f1c] block tracking-wider">
                  Panjat Pinang • Puncak Tercapai!
                </span>
                <h2 className="bk-h text-sm sm:text-base font-extrabold text-[#2b2a4a] truncate">
                  {templateJudul}
                </h2>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 bg-[#ffe9a8] border-2 border-[#ffb81c] text-[#7a5200] rounded-xl text-xs sm:text-sm font-black shrink-0">
                <Trophy className="w-4 h-4 text-[#e6a100]" />
                <span>Rank #{myRank || 1}</span>
              </div>
            </header>

            <main className="my-auto grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-5 bk-card !border-[3px] !border-[#ffb81c] !p-4 sm:!p-5 flex flex-col items-center">
                <TiangPinangVisual
                  posisi={100}
                  namaPemain={myState.nama}
                  status="selesai"
                  showProgressFooter={false}
                />
              </div>

              <div className="md:col-span-7 bk-card !border-[3px] !border-[#ffb81c] bg-gradient-to-b from-[#fffdf6] to-[#fff3d6] !p-5 sm:!p-7 space-y-5">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#136837] bg-[#e9f9ef] border border-[#9de0b6] px-3 py-1 rounded-full mb-2">
                    <Flag className="w-3.5 h-3.5" /> Lomba Selesai Untukmu
                  </span>
                  <h1 className="bk-h text-2xl sm:text-3xl font-extrabold text-[#2b2a4a]">
                    Puncak 100% Tercapai!
                  </h1>
                  <p className="text-sm text-[#6b6a85] font-semibold mt-1">
                    Hebat, <strong className="text-[#2b2a4a]">{myState.nama}</strong>! Kamu berhasil menaklukkan tiang pinang.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="bg-white p-3.5 rounded-2xl border-2 border-[#f0dfb4]">
                    <span className="text-[11px] uppercase font-extrabold text-[#6b6a85] block">
                      Jawaban Benar / Salah
                    </span>
                    <span className="text-base sm:text-lg font-black text-[#1f9d55] font-mono">
                      {myState.totalBenar}✓ / {myState.totalSalah}✗ ({akurasi}%)
                    </span>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border-2 border-[#f0dfb4]">
                    <span className="text-[11px] uppercase font-extrabold text-[#6b6a85] block">
                      Waktu Capai Puncak
                    </span>
                    <span className="text-base sm:text-lg font-black text-[#e6a100] font-mono">
                      {myState.waktuSelesaiMs
                        ? `${(myState.waktuSelesaiMs / 1000).toFixed(1)}s`
                        : '-'}
                    </span>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border-2 border-[#f0dfb4]">
                    <span className="text-[11px] uppercase font-extrabold text-[#6b6a85] block">
                      Streak Tertinggi
                    </span>
                    <span className="text-base sm:text-lg font-black text-[#e2312d] font-mono">
                      {myState.streakTertinggi}x berturut
                    </span>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border-2 border-[#f0dfb4]">
                    <span className="text-[11px] uppercase font-extrabold text-[#6b6a85] block">
                      Rata-rata Kecepatan
                    </span>
                    <span className="text-base sm:text-lg font-black text-[#1d8fe0] font-mono">
                      {myState.rataRataWaktuJawabMs
                        ? `${(myState.rataRataWaktuJawabMs / 1000).toFixed(1)}s`
                        : '-'}
                    </span>
                  </div>
                </div>

                <div className="bg-[#fff3c4] border-2 border-[#ffb81c] rounded-2xl p-3.5 flex items-center gap-3 text-xs sm:text-sm text-[#7a5200] font-extrabold">
                  <span className="w-2.5 h-2.5 bg-[#e2312d] rounded-full motion-safe:animate-ping shrink-0" />
                  <span>Menunggu teman lain selesai atau guru mengakhiri permainan...</span>
                </div>
              </div>
            </main>

            <footer className="text-center text-xs font-bold text-[#6b6a85] pb-1">
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
      <div className="bk-festival p-3 sm:p-5 lg:p-6 flex flex-col select-none overflow-x-hidden">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col gap-3 sm:gap-4">
          {/* 1. HEADER PERMAINAN & TIMER */}
          <header className="bg-[#fffdf6] border-2 border-[#f0dfb4] rounded-2xl sm:rounded-3xl p-3 sm:px-5 sm:py-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
            {/* Identitas Mode & Progress Soal */}
            <div className="min-w-0 flex-1 basis-[210px]">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-[#e2312d] text-white text-[10px] font-black uppercase tracking-wider">
                  Panjat Pinang • PIN {token}
                </span>
                {config?.kesulitan && (
                  <span className="px-2 py-0.5 rounded-full bg-[#fff3c4] border border-[#ffb81c] text-[#7a5200] text-[10px] font-extrabold uppercase">
                    {config.kesulitan}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-[#e9f4ff] border border-[#add6fa] text-[#1368ad] text-[10px] font-mono font-extrabold">
                  Soal #{soalAktif?.nomorSoal ?? Math.max(1, myState.jumlahJawab + 1)}
                  {soalAktif?.totalSoalTemplate ? `/${soalAktif.totalSoalTemplate}` : ''}
                </span>
              </div>
              <h1 className="bk-h text-sm sm:text-base font-extrabold text-[#2b2a4a] truncate">
                {templateJudul}
              </h1>
            </div>

            {/* Statistik Pemain: Rank, Benar/Salah, Streak */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#fff3d6] border border-[#f0dfb4] text-xs font-extrabold">
                <Trophy className="w-4 h-4 text-[#e6a100] shrink-0" />
                <span className="text-[#2b2a4a]">Rank #{myRank || 1}</span>
                <span className="text-[#6b6a85] text-[11px]">/ {totalPeserta}</span>
              </div>

              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#fff3d6] border border-[#f0dfb4] text-xs font-mono font-black">
                <span className="flex items-center gap-1 text-[#1f9d55]" title="Jawaban Benar">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {myState.totalBenar}
                </span>
                <span className="text-[#e6cfa0]">|</span>
                <span className="flex items-center gap-1 text-[#d63b3b]" title="Jawaban Salah">
                  <XCircle className="w-3.5 h-3.5" />
                  {myState.totalSalah}
                </span>
              </div>

              {myState.streakSaatIni > 0 ? (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#fff3c4] border border-[#ffb81c] text-[#7a5200] text-xs font-black">
                  <Flame className="w-3.5 h-3.5 fill-current text-[#e2312d]" />
                  <span>{myState.streakSaatIni} Streak</span>
                </div>
              ) : myState.poinBonus > 0 ? (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#fff3c4] border border-[#ffb81c] text-[#7a5200] text-xs font-mono font-black">
                  +{myState.poinBonus} pt
                </div>
              ) : null}
            </div>

            {/* Timer Menonjol + Mute */}
            <div className="flex items-center gap-2 ml-auto sm:ml-0">
              <div
                className={`min-w-[138px] sm:min-w-[156px] px-3 py-1.5 rounded-2xl border-2 transition-colors ${timerStyle.container}`}
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
                <div className="w-full h-1.5 bg-white/70 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full transition-all duration-150 ${timerStyle.bar}`}
                    style={{ width: `${Math.min(100, (detikElapsed / 30) * 100)}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Nyalakan suara efek' : 'Bisukan suara efek'}
                title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#fff3d6] hover:bg-[#fde9b8] border border-[#f0dfb4] text-[#2b2a4a] transition-colors cursor-pointer shrink-0"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-[#d63b3b]" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#1f9d55]" />
                )}
              </button>
            </div>
          </header>

          {/* Status Koneksi / Error Pengiriman */}
          {isDisconnected && (
            <div
              role="status"
              className="px-4 py-2.5 rounded-2xl bg-[#fff3c4] border-2 border-[#ffb81c] text-[#7a5200] text-xs font-extrabold flex items-center gap-2"
            >
              <WifiOff className="w-4 h-4 text-[#e2312d] shrink-0" />
              <span>Koneksi sedang terputus. Mencoba menyambung kembali otomatis...</span>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="px-4 py-2.5 rounded-2xl bg-[#fdecec] border-2 border-[#f4b6b6] text-[#8a1f1f] text-xs font-extrabold flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#d63b3b] shrink-0" />
                {submitError}
              </span>
              <button
                type="button"
                onClick={() => setSubmitError(null)}
                className="text-[#8a1f1f] hover:text-[#2b2a4a] underline text-[11px] shrink-0 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {/* AREA UTAMA: 2 Kolom Seimbang (Desktop & Tablet) / 1 Kolom Berurutan (Smartphone) */}
          <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-5 items-stretch">
            {/* KOLOM KIRI: Visual Tiang & Karakter (#2 Mobile) + Kartu Progress Pemain (#3 Mobile) */}
            <section className="md:col-span-5 flex flex-col gap-3 sm:gap-4">
              {/* 2. Visual Karakter & Tiang */}
              <div className="bk-card !p-3.5 sm:!p-4 lg:!p-5 flex-1 flex flex-col items-center justify-between gap-3">
                {/* Badge Efek Rintangan Aktif pada Tiang */}
                {(myState.efekAktif?.tiangLicin ||
                  myState.efekAktif?.perisaiKulitPisang ||
                  myState.efekAktif?.peganganKuat ||
                  soalAktif?.isBonusKulitPisang) && (
                  <div className="w-full flex flex-wrap items-center justify-center gap-1.5">
                    {myState.efekAktif?.tiangLicin && (
                      <span className="px-2.5 py-1 rounded-full bg-[#e9f4ff] border border-[#add6fa] text-[#1368ad] text-[11px] font-extrabold flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5" /> Tiang Licin Aktif
                      </span>
                    )}
                    {myState.efekAktif?.perisaiKulitPisang && (
                      <span className="px-2.5 py-1 rounded-full bg-[#e9f9ef] border border-[#9de0b6] text-[#136837] text-[11px] font-extrabold flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" /> Perisai Aktif (1x)
                      </span>
                    )}
                    {myState.efekAktif?.peganganKuat && (
                      <span className="px-2.5 py-1 rounded-full bg-[#fff3c4] border border-[#ffb81c] text-[#7a5200] text-[11px] font-extrabold flex items-center gap-1">
                        <HandMetal className="w-3.5 h-3.5" /> Pegangan Kuat Siap
                      </span>
                    )}
                    {soalAktif?.isBonusKulitPisang && (
                      <span className="px-2.5 py-1 rounded-full bg-[#ffb81c] text-[#4a3000] border border-[#c98a00] text-[11px] font-black flex items-center gap-1">
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

              {/* 3. Kartu Progress Pemain */}
              <div className="bk-card !p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6b6a85] block">
                      Pemain
                    </span>
                    <h2 className="bk-h text-base font-extrabold text-[#2b2a4a] truncate">
                      {myState.nama || nama}
                    </h2>
                  </div>

                  <div className="flex items-baseline gap-2 shrink-0">
                    {lastDelta !== null && lastDelta !== 0 && (
                      <span
                        className={`text-xs font-mono font-black px-2 py-0.5 rounded-full border ${
                          lastDelta > 0
                            ? 'bg-[#e9f9ef] text-[#1f9d55] border-[#9de0b6]'
                            : 'bg-[#fdecec] text-[#d63b3b] border-[#f4b6b6]'
                        }`}
                      >
                        {lastDelta > 0 ? `+${lastDelta}%` : `${lastDelta}%`}
                      </span>
                    )}
                    <span className="bk-h text-2xl font-extrabold text-[#1f9d55] tabular-nums">
                      {safePosisi}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar Smooth + Penanda Milestone */}
                <div className="relative w-full h-3.5 bg-[#fff3d6] rounded-full overflow-hidden border border-[#f0dfb4] p-0.5">
                  <div
                    style={{ width: `${safePosisi}%` }}
                    className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${
                      safePosisi >= 100
                        ? 'bg-gradient-to-r from-[#ffb81c] to-[#ffd23f]'
                        : 'bg-gradient-to-r from-[#e2312d] via-[#ffb81c] to-[#1f9d55]'
                    }`}
                  />
                  {[25, 50, 75].map((tick) => (
                    <span
                      key={tick}
                      style={{ left: `${tick}%` }}
                      className="absolute inset-y-0 w-px bg-[#2b2a4a]/20 pointer-events-none"
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] font-bold text-[#6b6a85]">
                  <span>Posisi Tiang</span>
                  <span className="text-[#2b2a4a] font-extrabold">
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
              <div className="bk-card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="bk-chip red !text-[11px]">
                    {soalAktif?.isBonusKulitPisang
                      ? 'Tantangan Bonus Perisai'
                      : `Pertanyaan #${soalAktif?.nomorSoal ?? 1}`}
                  </span>
                  {soalAktif?.totalSoalTemplate ? (
                    <span className="text-xs font-extrabold text-[#6b6a85]">
                      Bank Soal: {soalAktif.totalSoalTemplate} Soal
                    </span>
                  ) : null}
                </div>

                {soalAktif?.isBonusKulitPisang && (
                  <div className="p-2.5 rounded-xl bg-[#fff3c4] border-2 border-[#ffb81c] text-[#7a5200] text-xs font-extrabold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#e6a100] shrink-0" />
                    <span>Jawab benar untuk mendapatkan Perisai Anti-Turun!</span>
                  </div>
                )}

                {soalAktif ? (
                  <p className="bk-h text-lg sm:text-xl lg:text-[22px] font-extrabold text-[#2b2a4a] leading-snug break-words">
                    {soalAktif.teks}
                  </p>
                ) : (
                  <div className="py-6 flex items-center justify-center gap-2.5 text-[#6b6a85]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#e2312d]" />
                    <span className="text-sm font-extrabold">Menyiapkan pertanyaan berikutnya...</span>
                  </div>
                )}
              </div>

              {/* 5. Daftar Pilihan Jawaban (6 State Visual Jelas bertema Festival) */}
              <div className="grid grid-cols-1 gap-2.5 sm:gap-3" role="group" aria-label="Pilihan jawaban">
                {soalAktif?.pilihan.map((opsi) => {
                  const isDipilih = choiceDipilih === opsi.choiceId;
                  const isKunci = feedback?.kunciKey === opsi.key;
                  const isTampilkanHasil = Boolean(feedback?.tampil);

                  let cardCls = 'bk-opt w-full justify-between';
                  let keyCls = 'bk-opt-k';
                  let statusNode = (
                    <ChevronRight className="w-4 h-4 text-[#9e9cb3] group-hover:text-[#1d8fe0] transition-colors shrink-0" />
                  );

                  if (isTampilkanHasil) {
                    if (isKunci && feedback?.benar && isDipilih) {
                      cardCls = 'bk-opt ok w-full justify-between ring-2 ring-[#1f9d55]/35';
                      keyCls = 'bk-opt-k';
                      statusNode = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1f9d55] text-white text-[11px] font-extrabold shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">
                            {feedback.isBonusKulitPisang ? 'Perisai!' : 'Memanjat!'}
                          </span>
                        </span>
                      );
                    } else if (isKunci) {
                      cardCls = 'bk-opt ok w-full justify-between';
                      keyCls = 'bk-opt-k';
                      statusNode = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1f9d55]/15 text-[#136837] text-[11px] font-extrabold shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Jawaban Benar</span>
                        </span>
                      );
                    } else if (isDipilih && !feedback?.benar) {
                      cardCls = 'bk-opt no w-full justify-between ring-2 ring-[#d63b3b]/35';
                      keyCls = 'bk-opt-k';
                      statusNode = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#d63b3b] text-white text-[11px] font-extrabold shrink-0">
                          <XCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Kurang Tepat</span>
                        </span>
                      );
                    } else {
                      cardCls = 'bk-opt w-full justify-between opacity-55';
                      keyCls = 'bk-opt-k';
                      statusNode = <span className="sr-only">Nonaktif</span>;
                    }
                  } else if (isDipilih) {
                    cardCls =
                      'bk-opt w-full justify-between !border-[#ffb81c] !bg-[#fff8dc] ring-2 ring-[#ffb81c]/45';
                    keyCls = 'bk-opt-k !bg-[#ffb81c] !text-[#4a3000] !border-[#c98a00]';
                    statusNode = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ffe9a8] border border-[#ffb81c] text-[#7a5200] text-[11px] font-extrabold shrink-0">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Dipilih</span>
                      </span>
                    );
                  } else if (sudahKirim) {
                    cardCls = 'bk-opt w-full justify-between opacity-60';
                    keyCls = 'bk-opt-k';
                    statusNode = <span className="sr-only">Terkunci</span>;
                  }

                  return (
                    <button
                      key={opsi.choiceId}
                      type="button"
                      disabled={sudahKirim}
                      aria-pressed={isDipilih}
                      onClick={() => handlePilihJawaban(opsi)}
                      className={`group min-h-[54px] sm:min-h-[60px] ${cardCls}`}
                    >
                      <span className={keyCls}>{opsi.key}</span>
                      <span className="text-sm sm:text-base font-extrabold flex-1 min-w-0 leading-snug break-words text-left">
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
                  className={`p-4 rounded-[20px] text-xs sm:text-sm font-bold shadow-sm space-y-2.5 border-2 motion-safe:panjat-anim-feedback ${
                    feedback.benar
                      ? 'bg-[#e9f9ef] border-[#1f9d55] text-[#136837]'
                      : 'bg-[#fdecec] border-[#d63b3b] text-[#8a1f1f]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {feedback.benar ? (
                        <CheckCircle2 className="w-5 h-5 text-[#1f9d55] shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-[#d63b3b] shrink-0" />
                      )}
                      <div>
                        <div className="bk-h font-extrabold text-[#2b2a4a] text-sm sm:text-base">
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
                        <p className="text-[11px] font-bold text-[#6b6a85]">
                          Soal berikutnya segera dimulai otomatis, atau lanjut sekarang.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLanjutCepat}
                      className="bk-btn alt !py-2 !px-4 !text-xs shrink-0"
                    >
                      <span>Lanjut Soal</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Detail Bonus & Rintangan */}
                  <div className="flex flex-wrap gap-2">
                    {feedback.bonusStreakDidapat && feedback.bonusStreakDidapat > 0 ? (
                      <span className="px-2.5 py-1 rounded-full bg-[#fff3c4] border border-[#ffb81c] text-[#7a5200] text-[11px] font-extrabold flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 fill-current text-[#e2312d]" /> Bonus Streak (+
                        {feedback.bonusStreakDidapat}%)
                      </span>
                    ) : null}

                    {feedback.bonusPeganganKuatDidapat && feedback.bonusPeganganKuatDidapat > 0 ? (
                      <span className="px-2.5 py-1 rounded-full bg-[#fff3c4] border border-[#ffb81c] text-[#7a5200] text-[11px] font-extrabold flex items-center gap-1">
                        <HandMetal className="w-3.5 h-3.5" /> Pegangan Kuat (+
                        {feedback.bonusPeganganKuatDidapat}%)
                      </span>
                    ) : null}

                    {feedback.perisaiDigunakan && (
                      <span className="px-2.5 py-1 rounded-full bg-[#e9f9ef] border border-[#1f9d55] text-[#136837] text-[11px] font-extrabold flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" /> Perisai Menahan Tiang Licin!
                      </span>
                    )}

                    {feedback.penaltiTiangLicin && feedback.penaltiTiangLicin > 0 ? (
                      <span className="px-2.5 py-1 rounded-full bg-[#e9f4ff] border border-[#add6fa] text-[#1368ad] text-[11px] font-extrabold flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5" /> Terpeleset Tiang Licin (-
                        {feedback.penaltiTiangLicin}% tambahan)
                      </span>
                    ) : null}
                  </div>

                  {feedback.rintanganBaru && (
                    <div className="p-2.5 rounded-xl bg-[#fff3c4] border border-[#ffb81c] text-[#7a5200] flex items-start gap-2.5">
                      <Gift className="w-4 h-4 text-[#e6a100] shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <div className="font-extrabold text-[#4a3000]">
                          {feedback.rintanganBaru.judul}
                        </div>
                        <div className="text-[11px] text-[#7a5200] font-semibold">
                          {feedback.rintanganBaru.deskripsi}
                        </div>
                      </div>
                    </div>
                  )}

                  {feedback.penjelasan && (
                    <p className="text-xs text-[#2b2a4a] font-semibold pt-2 border-t border-black/10 leading-relaxed">
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
  // 3. TAHAP SELESAI & PODIUM JUARA (TEMA FESTIVAL 17 AGUSTUS)
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
    <div className="bk-festival p-3 sm:p-6 flex flex-col justify-between select-none">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-between gap-5">
        <div className="text-center pt-2 space-y-1.5">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-[#ffe9a8] border border-[#ffb81c] text-[#7a5200] text-xs font-extrabold rounded-full uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5" /> Panjat Pinang Selesai
          </span>
          <h1 className="bk-h text-3xl sm:text-4xl font-extrabold text-[#2b2a4a]">
            Podium Juara
          </h1>
          {myFinalIndex === 0 && (
            <p className="text-sm font-extrabold text-[#b81f1c]">
              Selamat! Kamu Berhasil Meraih Juara 1!
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center my-auto">
          {/* Podium 1, 2, 3 dengan Karakter 2D Juara */}
          <div className="md:col-span-6 bk-card !p-5 flex items-end justify-center gap-3">
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
                <span className="text-xs font-extrabold text-[#2b2a4a] truncate w-full">{juara2.nama}</span>
                <span className="text-[11px] font-mono font-bold text-[#6b6a85] mb-1">{juara2.posisi}%</span>
                <div className="w-full bg-[#8d9bb5] h-24 rounded-t-2xl flex flex-col items-center justify-center font-black text-white border-t-2 border-[#cbd5e1] shadow-sm">
                  <span className="bk-h text-xl leading-none">2</span>
                  <span className="text-[9px] font-extrabold uppercase mt-0.5">Perak</span>
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
                <span className="text-xs sm:text-sm font-black text-[#e2312d] truncate w-full">
                  {juara1.nama}
                </span>
                <span className="text-xs font-mono font-extrabold text-[#1f9d55] mb-1">
                  {juara1.posisi}%
                </span>
                <div className="w-full bg-[#ffb81c] h-32 rounded-t-2xl flex flex-col items-center justify-center font-black text-[#4a3000] border-t-2 border-[#fde047] shadow-md">
                  <span className="bk-h text-2xl leading-none">1</span>
                  <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">
                    Juara 1
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
                <span className="text-xs font-extrabold text-[#2b2a4a] truncate w-full">{juara3.nama}</span>
                <span className="text-[11px] font-mono font-bold text-[#6b6a85] mb-1">{juara3.posisi}%</span>
                <div className="w-full bg-[#c0814a] h-18 rounded-t-2xl flex flex-col items-center justify-center font-black text-white border-t-2 border-[#e9b778] shadow-sm">
                  <span className="bk-h text-xl leading-none">3</span>
                  <span className="text-[9px] font-extrabold uppercase mt-0.5">Perunggu</span>
                </div>
              </div>
            )}
          </div>

          {/* Rapor Pribadi */}
          <div className="md:col-span-6 bk-card !border-[3px] !border-[#ffb81c] bg-gradient-to-b from-[#fffdf6] to-[#fff3d6] !p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#f0dfb4]">
              <div>
                <span className="text-[11px] uppercase font-extrabold text-[#6b6a85]">Peringkat Akhir</span>
                <h3 className="bk-h text-lg sm:text-xl font-extrabold text-[#2b2a4a]">
                  {myFinalIndex >= 0 ? `#${myFinalIndex + 1}` : '-'} dari {finalLeaderboard.length} Siswa
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[11px] uppercase font-extrabold text-[#6b6a85]">Ketinggian Akhir</span>
                <div className="bk-h text-2xl font-extrabold text-[#1f9d55] font-mono">
                  {myFinalData.posisi}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="bg-white border-2 border-[#f0dfb4] p-3 rounded-2xl">
                <span className="text-[#6b6a85] text-[10px] uppercase font-extrabold block">
                  Akurasi Jawaban
                </span>
                <span className="font-extrabold text-[#1f9d55] font-mono">
                  {myFinalData.totalBenar}✓ / {myFinalData.totalSalah}✗ ({akurasiFinal}%)
                </span>
              </div>
              <div className="bg-white border-2 border-[#f0dfb4] p-3 rounded-2xl">
                <span className="text-[#6b6a85] text-[10px] uppercase font-extrabold block">
                  Streak Tertinggi
                </span>
                <span className="font-extrabold text-[#e2312d] font-mono">
                  {myFinalData.streakTertinggi}x berturut
                </span>
              </div>
              <div className="bg-white border-2 border-[#f0dfb4] p-3 rounded-2xl">
                <span className="text-[#6b6a85] text-[10px] uppercase font-extrabold block">
                  Rata-rata Kecepatan
                </span>
                <span className="font-extrabold text-[#1d8fe0] font-mono">
                  {myFinalData.rataRataWaktuJawabMs
                    ? `${(myFinalData.rataRataWaktuJawabMs / 1000).toFixed(1)}s`
                    : '-'}
                </span>
              </div>
              <div className="bg-white border-2 border-[#f0dfb4] p-3 rounded-2xl">
                <span className="text-[#6b6a85] text-[10px] uppercase font-extrabold block">
                  Waktu Puncak / Bonus
                </span>
                <span className="font-extrabold text-[#e6a100] font-mono">
                  {myFinalData.waktuSelesaiMs
                    ? `${(myFinalData.waktuSelesaiMs / 1000).toFixed(1)}s`
                    : `${myFinalData.poinBonus || 0} pt bonus`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onKeluar?.()}
              className="bk-btn w-full justify-center"
            >
              Selesai &amp; Keluar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
