import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getSocket } from '../../lib/socket';
import { bindStudentReconnect, createAnswerWatchdogs } from '../../lib/socketReconnect';
import { QuestionTimerBar, computeInitialRemainingMs } from '../../components';
import { isStaleQuestionErrorMessage } from '../../lib/soloSessionSync';
import { soundEffects, useGameSoundLifecycle } from '../../lib/soundEffects';
import type { EfekAktifVisual } from './TiangPinangVisual';
import KarakterPanjatPinang from './KarakterPanjatPinang';
import RuangTungguSiswa from './RuangTungguSiswa';
import '../../components/balapKarungFestival.css';
import {
  Trophy,
  Flame,
  Shield,
  Droplets,
  HandMetal,
  ArrowRight,
  AlertTriangle,
  WifiOff,
  Loader2,
  Volume2,
  VolumeX,
  Flag,
  Pause,
  LogOut,
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
  waktuPerSoalDetik?: number;
  berakhirPadaMs?: number;
  serverNowMs?: number;
  serverOffsetMs?: number;
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
  const stageRef = useRef(stage);
  stageRef.current = stage;

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

  const [feedback, setFeedback] = useState<FeedbackPanjatState | null>(null);
  const [hasilAkhir, setHasilAkhir] = useState<HasilAkhirPanjatData | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDisconnected, setIsDisconnected] = useState<boolean>(false);
  const { isMuted, toggleMute } = useGameSoundLifecycle(stage === 'PLAYING', sessionId);

  const timeoutSentRef = useRef<string | null>(null);
  const watchdogsRef = useRef(createAnswerWatchdogs());

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
      setSubmitError(null);
      if (data?.leaderboard) {
        setLeaderboard(data.leaderboard);
        const me = data.leaderboard.find((p) => p.id === pesertaId);
        if (me) setMyState(me);
      }
      soundEffects.startGame('whistle');
      if (stageRef.current !== 'LOBBY') {
        setStage('PLAYING');
      }
    };

    const handleSoalTampil = (data: SoalPanjatData & { game?: string }) => {
      if (data.game && data.game !== 'panjat_pinang') return;
      timeoutSentRef.current = null;
      watchdogsRef.current.clearAck();
      const serverOffsetMs = data.serverNowMs ? Date.now() - data.serverNowMs : 0;
      setSoalAktif({
        ...data,
        serverOffsetMs,
      });
      setChoiceDipilih(null);
      setSudahKirim(false);
      setFeedback(null);
      setLastDelta(null);
      setSubmitError(null);
      if (stageRef.current !== 'LOBBY') {
        setStage('PLAYING');
      }
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
      watchdogsRef.current.clearAck();
      setSubmitError(null);

      if (res.pesertaUpdated) {
        setMyState(res.pesertaUpdated);
      }
      setLastDelta(typeof res.perubahanPosisi === 'number' ? res.perubahanPosisi : 0);

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
      watchdogsRef.current.clearAck();
      soundEffects.playVictoryFanfare();
      if (data?.peserta) {
        setMyState(data.peserta);
      } else {
        setMyState((prev) => ({ ...prev, status: 'selesai', posisi: 100 }));
      }
    };

    const handleSesiSelesai = (data: { hasil: HasilAkhirPanjatData }) => {
      watchdogsRef.current.clearAck();
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
      isPaused?: boolean;
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
          if (res.isPaused) setIsPaused(true);
          if (res.soalAktif) {
            setSoalAktif((prev) =>
              prev && prev.presentationId === res.soalAktif?.presentationId
                ? prev
                : res.soalAktif!
            );
          }
        } else if (res.status === 'selesai') {
          watchdogsRef.current.clearAck();
          if (res.hasil) setHasilAkhir(res.hasil);
          setStage('SELESAI');
        }
      },
    });

    const handleDiKick = (data: { pesan?: string }) => {
      onKeluar(data?.pesan || 'Anda telah dikeluarkan dari lobi oleh guru.');
    };

    const handleGameJeda = (data: { game?: string }) => {
      if (data?.game && data.game !== 'panjat_pinang') return;
      setIsPaused(true);
    };

    const handleGameLanjut = (data: { game?: string; pauseDuration?: number }) => {
      if (data?.game && data.game !== 'panjat_pinang') return;
      setIsPaused(false);
    };

    const handleMainLagiSiswa = (data: { sessionId: string; token: string }) => {
      if (data?.token) {
        window.location.href = `/main?token=${encodeURIComponent(data.token)}&nama=${encodeURIComponent(nama)}`;
      }
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
    socket.on('game:jeda', handleGameJeda);
    socket.on('game:lanjut', handleGameLanjut);
    socket.on('sesi:main_lagi', handleMainLagiSiswa);

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
      socket.off('game:jeda', handleGameJeda);
      socket.off('game:lanjut', handleGameLanjut);
      socket.off('sesi:main_lagi', handleMainLagiSiswa);
    };
  }, [token, nama, pesertaId, pesertaSecret]);

  const soalDurasiSec = Math.max(5, soalAktif?.waktuPerSoalDetik || 15);
  const initialSoalRemainingMs = useMemo(
    () =>
      computeInitialRemainingMs(
        soalAktif?.berakhirPadaMs,
        soalDurasiSec,
        soalAktif?.serverOffsetMs || 0
      ),
    [soalAktif?.presentationId, soalAktif?.berakhirPadaMs, soalDurasiSec, soalAktif?.serverOffsetMs]
  );

  const handleTimeoutSoal = useCallback(() => {
    if (
      stage !== 'PLAYING' ||
      !soalAktif ||
      sudahKirim ||
      Boolean(feedback) ||
      myState.status === 'selesai' ||
      isPaused
    )
      return;
    if (timeoutSentRef.current === soalAktif.presentationId) return;
    timeoutSentRef.current = soalAktif.presentationId;
    setSudahKirim(true);

    const socket = getSocket();
    watchdogsRef.current.armAckTimeout(() => {
      setSudahKirim(false);
      setSubmitError('Waktu habis, mencoba menyinkronkan soal berikutnya...');
      if (socket.connected) {
        socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
      }
    });

    socket.emit(
      'jawab:kirim',
      {
        sessionId,
        pesertaId,
        pesertaSecret,
        presentationId: soalAktif.presentationId,
        questionId: soalAktif.questionId,
        timedOut: true,
      },
      (res: any) => {
        watchdogsRef.current.clearAck();
        if (!res?.success) {
          setSudahKirim(false);
          if (res?.pesan && isStaleQuestionErrorMessage(res.pesan)) {
            socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
          }
        }
      }
    );
  }, [stage, soalAktif, sudahKirim, feedback, myState.status, isPaused, sessionId, pesertaId, pesertaSecret]);

  const handlePilihJawaban = (opsi: PilihanPanjat) => {
    if (sudahKirim || Boolean(feedback) || !soalAktif || myState.status === 'selesai' || isPaused) return;

    setChoiceDipilih(opsi.choiceId);
    setSudahKirim(true);
    setSubmitError(null);

    const socket = getSocket();
    watchdogsRef.current.armAckTimeout(() => {
      setSudahKirim(false);
      setChoiceDipilih(null);
      setSubmitError('Koneksi terputus atau lambat. Silakan ketuk jawaban lagi.');
      if (socket.connected) {
        socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
      }
    });

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
        watchdogsRef.current.clearAck();
        if (!res?.success) {
          setSudahKirim(false);
          setChoiceDipilih(null);
          const pesan = res?.pesan || 'Jawaban belum dapat diproses. Silakan pilih kembali.';
          setSubmitError(pesan);
          if (isStaleQuestionErrorMessage(pesan)) {
            socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
          }
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

  const renderTopBar = () => (
    <header className="w-full max-w-md mx-auto flex items-center justify-between gap-2 bg-[#fffdf6] border-2 border-[#f0dfb4] rounded-2xl px-3.5 py-2.5 shadow-xs">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0 bg-[#e2312d]" />
          <span className="bk-h text-sm font-extrabold text-[#2b2a4a] truncate">
            {nama}
          </span>
          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full text-white bg-[#e2312d]">
            Rank #{myRank || 1}{totalPeserta > 1 ? ` / ${totalPeserta}` : ''}
          </span>
        </div>
        <p className="text-[11px] font-bold text-[#6b6a85] truncate mt-0.5">
          {templateJudul} • PIN {token}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {stage === 'PLAYING' && (
          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-xl bg-[#fff3d6] border border-[#f0dfb4] text-[#2b2a4a] cursor-pointer"
            aria-label={isMuted ? 'Nyalakan suara' : 'Bisukan suara'}
            title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-[#d63b3b]" /> : <Volume2 className="w-4 h-4 text-[#1f9d55]" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => onKeluar?.()}
          className="p-2 rounded-xl bg-[#fde0e0] border border-[#f4b6b6] text-[#8a1f1f] cursor-pointer"
          aria-label="Keluar sesi"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );

  // =========================================================================
  // 1. TAHAP LOBI SISWA (TEMA FESTIVAL 17 AGUSTUS)
  // =========================================================================
  if (stage === 'LOBBY') {
    return (
      <RuangTungguSiswa
        token={token}
        nama={nama}
        pesertaId={pesertaId}
        gameType="panjat_pinang"
        templateJudul={templateJudul}
        config={config}
        daftarPeserta={leaderboard.map((p) => ({ id: p.id, nama: p.nama }))}
        onKeluar={onKeluar}
        onMulaiPermainan={() => {
          try {
            getSocket().emit('siswa:siap_soal', { sessionId, pesertaId, token });
          } catch (err) {
            console.error('[siswa:siap_soal error]', err);
          }
          setStage('PLAYING');
        }}
      />
    );
  }

  // =========================================================================
  // 2. TAHAP PERMAINAN BERJALAN (TEMA FESTIVAL 17 AGUSTUS)
  // =========================================================================
  if (stage === 'PLAYING') {
    // 2a. Pemain sudah mencapai puncak 100% (menunggu pemain lain)
    if (myState.status === 'selesai' || safePosisi >= 100) {
      const totalJawab = myState.totalBenar + myState.totalSalah;
      const akurasi = totalJawab > 0 ? Math.round((myState.totalBenar / totalJawab) * 100) : 0;

      return (
        <div className="bk-festival p-3 sm:p-4 flex flex-col gap-3 select-none">
          {renderTopBar()}

          <main className="w-full max-w-md mx-auto flex-1 flex flex-col gap-3">
            <div className="bk-card !border-[3px] !border-[#ffb81c] bg-gradient-to-b from-[#fffdf6] to-[#fff3d6] !p-5 sm:!p-6 space-y-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#136837] bg-[#e9f9ef] border border-[#9de0b6] px-3 py-1 rounded-full mb-2">
                  <Flag className="w-3.5 h-3.5" /> Lomba Selesai Untukmu
                </span>
                <h1 className="bk-h text-2xl font-extrabold text-[#2b2a4a]">
                  Puncak 100% Tercapai!
                </h1>
                <p className="text-sm text-[#6b6a85] font-semibold mt-1">
                  Hebat, <strong className="text-[#2b2a4a]">{myState.nama}</strong>! Kamu berhasil menaklukkan tiang pinang.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-left">
                <div className="bg-white p-3 rounded-2xl border-2 border-[#f0dfb4]">
                  <span className="text-[10px] uppercase font-extrabold text-[#6b6a85] block">
                    Jawaban Benar / Salah
                  </span>
                  <span className="text-sm sm:text-base font-black text-[#1f9d55] font-mono">
                    {myState.totalBenar}✓ / {myState.totalSalah}✗ ({akurasi}%)
                  </span>
                </div>
                <div className="bg-white p-3 rounded-2xl border-2 border-[#f0dfb4]">
                  <span className="text-[10px] uppercase font-extrabold text-[#6b6a85] block">
                    Waktu Capai Puncak
                  </span>
                  <span className="text-sm sm:text-base font-black text-[#e6a100] font-mono">
                    {myState.waktuSelesaiMs
                      ? `${(myState.waktuSelesaiMs / 1000).toFixed(1)}s`
                      : '-'}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-2xl border-2 border-[#f0dfb4]">
                  <span className="text-[10px] uppercase font-extrabold text-[#6b6a85] block">
                    Streak Tertinggi
                  </span>
                  <span className="text-sm sm:text-base font-black text-[#e2312d] font-mono">
                    {myState.streakTertinggi}x berturut
                  </span>
                </div>
                <div className="bg-white p-3 rounded-2xl border-2 border-[#f0dfb4]">
                  <span className="text-[10px] uppercase font-extrabold text-[#6b6a85] block">
                    Rata-rata Kecepatan
                  </span>
                  <span className="text-sm sm:text-base font-black text-[#1d8fe0] font-mono">
                    {myState.rataRataWaktuJawabMs
                      ? `${(myState.rataRataWaktuJawabMs / 1000).toFixed(1)}s`
                      : '-'}
                  </span>
                </div>
              </div>

              <div className="bg-[#fff3c4] border-2 border-[#ffb81c] rounded-2xl p-3 flex items-center gap-2.5 text-xs text-[#7a5200] font-extrabold">
                <span className="w-2.5 h-2.5 bg-[#e2312d] rounded-full motion-safe:animate-ping shrink-0" />
                <span>Menunggu pemain lain selesai atau guru mengakhiri sesi...</span>
              </div>
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="bk-festival p-3 sm:p-4 flex flex-col gap-3 select-none">
        {renderTopBar()}

        <main className="w-full max-w-md mx-auto flex-1 flex flex-col gap-3">
          {/* Mini Ringkasan Progress Pemanjat */}
          {leaderboard.length > 0 && (
            <div className="bg-[#fffdf6] border-2 border-[#f0dfb4] rounded-2xl p-3 space-y-1.5">
              {leaderboard.slice(0, 5).map((p) => {
                const pct = Math.min(100, Math.max(0, Math.round(p.posisi)));
                const isMe = p.id === pesertaId;
                return (
                  <div key={p.id} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px] font-extrabold">
                      <span className="flex items-center gap-1.5 text-[#2b2a4a]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#e2312d]" />
                        {p.nama} {isMe ? '★' : ''}
                      </span>
                      <span className="text-[#2b2a4a]">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#fff3d6] overflow-hidden border border-[#f0dfb4]">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[#e2312d] to-[#1f9d55]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Kartu Soal Siswa */}
          <section className="bk-card flex-1 flex flex-col justify-between border-[3px] border-[#e2312d]">
            {soalAktif ? (
              <div>
                <QuestionTimerBar
                  presentationKey={soalAktif.presentationId}
                  durationSec={soalDurasiSec}
                  initialRemainingMs={initialSoalRemainingMs}
                  active={!isPaused && stage === 'PLAYING' && !sudahKirim && !feedback}
                  onTimeout={handleTimeoutSoal}
                  leftContent={
                    <>
                      {safePosisi >= 90 ? '⭐ SOAL PUNCAK' : `Soal #${soalAktif.nomorSoal}`}
                      {soalAktif.totalSoalTemplate ? ` / ${soalAktif.totalSoalTemplate}` : ''}
                    </>
                  }
                  rightSuffix={` • ${safePosisi}%`}
                />

                {isDisconnected && (
                  <div className="mb-3 bg-[#fff3c4] border border-[#ffb81c] text-[#7a5200] text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>Koneksi terputus. Mencoba menyambung kembali...</span>
                  </div>
                )}

                {submitError && (
                  <div className="mb-3 bg-[#fde0e0] border border-[#f4b6b6] text-[#991b1b] text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Badges Streak / Efek */}
                {(myState.streakSaatIni > 0 ||
                  myState.efekAktif?.tiangLicin ||
                  myState.efekAktif?.perisaiKulitPisang ||
                  myState.efekAktif?.peganganKuat ||
                  soalAktif?.isBonusKulitPisang) && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px] font-extrabold">
                    {myState.streakSaatIni > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 flex items-center gap-1">
                        <Flame className="w-3 h-3 fill-current text-orange-500" />
                        Streak: {myState.streakSaatIni}
                      </span>
                    )}
                    {myState.efekAktif?.perisaiKulitPisang && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1">
                        <Shield className="w-3 h-3 text-emerald-600" />
                        Perisai Aktif
                      </span>
                    )}
                    {myState.efekAktif?.peganganKuat && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-1">
                        <HandMetal className="w-3 h-3 text-amber-600" />
                        Pegangan Kuat Siap
                      </span>
                    )}
                    {myState.efekAktif?.tiangLicin && (
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-blue-600" />
                        Tiang Licin Aktif
                      </span>
                    )}
                    {soalAktif?.isBonusKulitPisang && (
                      <span className="px-2.5 py-0.5 rounded-full bg-yellow-50 border border-yellow-300 text-yellow-800 flex items-center gap-1">
                        <Shield className="w-3 h-3 text-yellow-600" />
                        Soal Bonus Perisai!
                      </span>
                    )}
                  </div>
                )}

                <h2 className="bk-h text-lg sm:text-xl font-extrabold text-[#2b2a4a] leading-snug mb-3">
                  {soalAktif.teks}
                </h2>

                <div className="space-y-2">
                  {soalAktif.pilihan.map((opt) => {
                    const isCorrectHighlight = feedback && opt.key === feedback.kunciKey;
                    const isWrongHighlight =
                      feedback && !feedback.benar && choiceDipilih === opt.choiceId;

                    return (
                      <button
                        key={opt.choiceId}
                        type="button"
                        disabled={sudahKirim || Boolean(feedback) || isPaused}
                        onClick={() => handlePilihJawaban(opt)}
                        className={`bk-opt w-full !p-3 ${
                          isCorrectHighlight ? 'ok' : isWrongHighlight ? 'no' : ''
                        }`}
                      >
                        <span className="bk-opt-k !w-7 !h-7 !text-xs">{opt.key}</span>
                        <span className="text-sm leading-snug text-left flex-1">{opt.teks}</span>
                      </button>
                    );
                  })}
                </div>

                <div
                  className={`min-h-[1.6em] mt-3 bk-h text-sm font-extrabold ${
                    feedback
                      ? feedback.benar
                        ? 'text-[#1f9d55]'
                        : 'text-[#d63b3b]'
                      : 'text-[#6b6a85]'
                  }`}
                  aria-live="polite"
                >
                  {feedback ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span>
                          {feedback.benar
                            ? `Benar! Naik +${feedback.perubahanPosisi ?? 0}% ke Tiang`
                            : `Kurang Tepat. Jawaban benar: ${feedback.kunciKey}`}
                          {lastDelta !== null && lastDelta !== 0 && (
                            <span className="text-xs font-mono font-bold ml-1.5">
                              {lastDelta > 0 ? `(+${lastDelta}%)` : `(${lastDelta}%)`}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={handleLanjutCepat}
                          className="bk-btn alt !py-1 !px-2.5 !text-xs ml-2 shrink-0 flex items-center gap-1"
                        >
                          <span>Lanjut</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {feedback.bonusStreakDidapat ? (
                        <div className="text-xs text-[#c2540a]">
                          Bonus Streak: +{feedback.bonusStreakDidapat}%!
                        </div>
                      ) : null}
                      {feedback.bonusPeganganKuatDidapat ? (
                        <div className="text-xs text-[#c2540a]">
                          Pegangan Kuat: +{feedback.bonusPeganganKuatDidapat}%!
                        </div>
                      ) : null}
                      {feedback.perisaiDigunakan ? (
                        <div className="text-xs text-[#136837]">
                          Perisai menahan dari licin!
                        </div>
                      ) : null}
                      {feedback.penaltiTiangLicin ? (
                        <div className="text-xs text-[#d63b3b]">
                          Terpeleset tiang licin (-{feedback.penaltiTiangLicin}%)
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 text-center text-xs font-bold text-[#6b6a85]">
                  Jawab sebelum waktu habis!
                </div>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-[#6b6a85]">
                <Loader2 className="w-6 h-6 animate-spin text-[#e2312d]" />
                <span className="text-sm font-extrabold">Menyiapkan soal berikutnya...</span>
              </div>
            )}
          </section>
        </main>

        {/* Overlay Jeda oleh Guru */}
        {isPaused && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
            <div className="bg-[#fffdf6] border-[3px] border-[#ffb81c] rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-[#fff3c4] border-2 border-[#ffb81c] flex items-center justify-center mx-auto text-[#d97706] shadow-inner">
                <Pause className="w-8 h-8 fill-current" />
              </div>
              <h2 className="bk-h text-xl font-extrabold text-[#2b2a4a]">
                Permainan Dijeda
              </h2>
              <p className="text-xs font-bold text-[#6b6a85] leading-relaxed">
                Guru sedang menjeda permainan untuk sementara waktu.
              </p>
            </div>
          </div>
        )}
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
                <span className="text-[11px] uppercase font-extrabold text-[#6b6a85] block">
                  Ketinggian Akhir
                </span>
                <div className="bk-h text-2xl font-extrabold text-[#1f9d55] font-mono leading-tight">
                  {myFinalData.posisi}%
                </div>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block mt-1 ${
                    myFinalData.posisi >= 100
                      ? 'bg-[#e9f9ef] text-[#136837] border border-[#9de0b6]'
                      : 'bg-[#fff0c9] text-[#7a5200] border border-[#f3d37a]'
                  }`}
                >
                  {myFinalData.posisi >= 100 ? '✓ Puncak Dikuasai' : 'Belum Mencapai Puncak'}
                </span>
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
