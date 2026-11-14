import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getSocket } from '../../lib/socket';
import { bindStudentReconnect, createAnswerWatchdogs } from '../../lib/socketReconnect';
import { QuestionTimerBar, computeInitialRemainingMs } from '../../components';
import { isStaleQuestionErrorMessage } from '../../lib/soloSessionSync';
import { soundEffects, useGameSoundLifecycle } from '../../lib/soundEffects';
import RuangTungguSiswa from './RuangTungguSiswa';
import type { HasilGachaGigitanProps } from './KerupukVirtual';
import '../../components/balapKarungFestival.css';
import {
  Flame,
  Crown,
  Medal,
  ArrowRight,
  Volume2,
  VolumeX,
  Pause,
  AlertTriangle,
  Loader2,
  LogOut,
} from 'lucide-react';

interface PilihanSoalKerupuk {
  choiceId: string;
  label: 'A' | 'B' | 'C' | 'D' | 'E';
  teks: string;
}

interface SoalKerupukMulti {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  totalSoalBank: number;
  teks: string;
  pilihan: PilihanSoalKerupuk[];
  waktuPerSoalDetik?: number;
  berakhirPadaMs?: number;
  serverNowMs?: number;
  serverOffsetMs?: number;
}

export interface PesertaKerupukMultiData {
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

interface MainKerupukProps {
  token: string;
  nama: string;
  sessionId: string;
  pesertaId: string;
  pesertaSecret?: string;
  templateJudul: string;
  initialStatus?: string;
  initialPesertaState?: PesertaKerupukMultiData;
  initialLeaderboard?: PesertaKerupukMultiData[];
  initialSoalAktif?: SoalKerupukMulti | null;
  onKeluar: (pesan?: string) => void;
}

export default function MainKerupuk({
  token,
  nama,
  sessionId,
  pesertaId,
  pesertaSecret,
  templateJudul,
  initialStatus = 'lobi',
  initialPesertaState,
  initialLeaderboard = [],
  initialSoalAktif = null,
  onKeluar,
}: MainKerupukProps) {
  const [stage, setStage] = useState<'LOBBY' | 'PLAYING' | 'SELESAI'>(
    initialStatus === 'jalan' ? 'PLAYING' : initialStatus === 'selesai' ? 'SELESAI' : 'LOBBY'
  );
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const { isMuted, toggleMute } = useGameSoundLifecycle(stage === 'PLAYING', sessionId);

  const [myState, setMyState] = useState<PesertaKerupukMultiData>(
    initialPesertaState || {
      id: pesertaId,
      nama,
      sisaKerupuk: 100,
      targetKerupuk: 100,
      sisaPersen: 100,
      progresPersen: 0,
      skorTotal: 0,
      skorPembelajaran: 0,
      bonusKeberuntungan: 0,
      bonusPenyelesaian: 0,
      streakBenar: 0,
      selesaiKerupuk: false,
    }
  );

  const [leaderboard, setLeaderboard] = useState<PesertaKerupukMultiData[]>(initialLeaderboard);

  const [soalAktif, setSoalAktif] = useState<SoalKerupukMulti | null>(initialSoalAktif);
  const [dipilihChoiceId, setDipilihChoiceId] = useState<string | null>(null);
  const [sudahKirim, setSudahKirim] = useState(false);

  const [feedback, setFeedback] = useState<{
    tampil: boolean;
    benar?: boolean;
    jawabanBenar?: string;
    jawabanBenarTeks?: string;
    penjelasan?: string | null;
    gacha?: HasilGachaGigitanProps | null;
    poinDidapat?: number;
    bonusStreak?: number;
    bonusPenyelesaian?: number;
  } | null>(null);

  const [hasilAkhir, setHasilAkhir] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const timeoutSentRef = useRef<string | null>(null);
  const watchdogsRef = useRef(createAnswerWatchdogs());

  useEffect(() => {
    const socket = getSocket();

    const handleLobiUpdate = (data: {
      game?: string;
      totalPeserta: number;
      leaderboard?: PesertaKerupukMultiData[];
      daftarPeserta?: PesertaKerupukMultiData[];
    }) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      const list = data.leaderboard || data.daftarPeserta;
      if (list) setLeaderboard(list);
    };

    const handleGameMulai = (data: { game?: string }) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      soundEffects.startGame('whistle');
      if (stageRef.current !== 'LOBBY') {
        setStage('PLAYING');
      }
    };

    const handleSoalTampil = (data: any) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      timeoutSentRef.current = null;
      watchdogsRef.current.clearAck();
      const serverOffsetMs = data.serverNowMs ? Date.now() - data.serverNowMs : 0;
      setSoalAktif({
        presentationId: data.presentationId,
        questionId: data.questionId,
        nomorSoal: data.nomorSoal,
        totalSoalBank: data.totalSoalBank,
        teks: data.teks,
        pilihan: data.pilihan || [],
        waktuPerSoalDetik: data.waktuPerSoalDetik,
        berakhirPadaMs: data.berakhirPadaMs,
        serverNowMs: data.serverNowMs,
        serverOffsetMs,
      });
      setDipilihChoiceId(null);
      setSudahKirim(false);
      setFeedback(null);
      setErrorBanner(null);
      if (stageRef.current !== 'LOBBY') {
        setStage('PLAYING');
      }
    };

    const handleKerupukUpdate = (data: { leaderboard: PesertaKerupukMultiData[] }) => {
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
        const me = data.leaderboard.find((p) => p.id === pesertaId);
        if (me) setMyState(me);
      }
    };

    const handleJawabHasil = (res: any) => {
      if (!res?.success || (res.game && res.game !== 'makan_kerupuk')) return;
      watchdogsRef.current.clearAck();
      setErrorBanner(null);

      if (res.benar) {
        soundEffects.playKerupukAction({
          benar: true,
          gachaTipe: res.gacha?.tipe ?? 'zonk',
          hasStreakBonus: (res.bonusStreak || 0) > 0,
        });
      } else {
        soundEffects.playKerupukAction({ benar: false });
      }

      if (res.pesertaUpdated) setMyState(res.pesertaUpdated);

      setFeedback({
        tampil: true,
        benar: Boolean(res.benar),
        jawabanBenar: res.jawabanBenar,
        jawabanBenarTeks: res.jawabanBenarTeks,
        penjelasan: res.penjelasan,
        gacha: res.gacha,
        poinDidapat: res.poinDidapat,
        bonusStreak: res.bonusStreak,
        bonusPenyelesaian: res.bonusPenyelesaian,
      });
    };

    const handlePemainSelesai = (data: { game?: string; peserta?: PesertaKerupukMultiData }) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      watchdogsRef.current.clearAck();
      setSoalAktif(null);
      if (data?.peserta) {
        setMyState(data.peserta);
      } else {
        setMyState((prev) => ({
          ...prev,
          selesaiKerupuk: true,
          sisaKerupuk: 0,
          sisaPersen: 0,
          progresPersen: 100,
        }));
      }
    };

    const handleSesiSelesai = (data: { game?: string; hasil: any }) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      watchdogsRef.current.clearAck();
      setHasilAkhir(data.hasil);
      setStage('SELESAI');
      if (data.hasil?.dihentikanManual) {
        soundEffects.stopAll();
      } else {
        soundEffects.playNaturalVictory();
      }
    };

    const handleDiKick = (data: { pesan?: string }) => {
      onKeluar(data?.pesan || 'Anda telah dikeluarkan dari lobi oleh guru.');
    };

    const handleGameJeda = (data: { game?: string }) => {
      if (data?.game && data.game !== 'makan_kerupuk') return;
      setIsPaused(true);
    };

    const handleGameLanjut = (data: { game?: string; pauseDuration?: number }) => {
      if (data?.game && data.game !== 'makan_kerupuk') return;
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
    socket.on('kerupuk:update', handleKerupukUpdate);
    socket.on('jawab:hasil', handleJawabHasil);
    socket.on('pemain:selesai', handlePemainSelesai);
    socket.on('sesi:selesai', handleSesiSelesai);
    socket.on('sesi:dikick', handleDiKick);
    socket.on('game:jeda', handleGameJeda);
    socket.on('game:lanjut', handleGameLanjut);
    socket.on('sesi:main_lagi', handleMainLagiSiswa);

    return () => {
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('soal:tampil', handleSoalTampil);
      socket.off('kerupuk:update', handleKerupukUpdate);
      socket.off('jawab:hasil', handleJawabHasil);
      socket.off('pemain:selesai', handlePemainSelesai);
      socket.off('sesi:selesai', handleSesiSelesai);
      socket.off('sesi:dikick', handleDiKick);
      socket.off('game:jeda', handleGameJeda);
      socket.off('game:lanjut', handleGameLanjut);
      socket.off('sesi:main_lagi', handleMainLagiSiswa);
    };
  }, [pesertaId]);

  useEffect(() => {
    const socket = getSocket();
    return bindStudentReconnect(socket, {
      token,
      nama,
      pesertaId,
      pesertaSecret,
      onReconnectSuccess: (res: any) => {
        if (!res?.success) return;
        if (res.peserta) setMyState(res.peserta);
        if (res.leaderboard) {
          setLeaderboard(res.leaderboard);
        }
        if (res.status === 'jalan') {
          setStage('PLAYING');
          if (res.isPaused) setIsPaused(true);
          if (res.soalAktif) {
            setSoalAktif((prev) =>
              prev && prev.presentationId === res.soalAktif.presentationId ? prev : res.soalAktif
            );
          }
        } else if (res.status === 'selesai') {
          watchdogsRef.current.clearAck();
          if (res.hasil) setHasilAkhir(res.hasil);
          setStage('SELESAI');
        }
      },
    });
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
      myState.selesaiKerupuk ||
      isPaused
    )
      return;
    if (timeoutSentRef.current === soalAktif.presentationId) return;
    timeoutSentRef.current = soalAktif.presentationId;
    setSudahKirim(true);

    const socket = getSocket();
    watchdogsRef.current.armAckTimeout(() => {
      setSudahKirim(false);
      setErrorBanner('Waktu habis, mencoba menyinkronkan soal berikutnya...');
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
  }, [
    stage,
    soalAktif,
    sudahKirim,
    feedback,
    myState.selesaiKerupuk,
    isPaused,
    sessionId,
    pesertaId,
    pesertaSecret,
  ]);

  const handlePilihJawaban = (pil: PilihanSoalKerupuk) => {
    if (sudahKirim || Boolean(feedback) || !soalAktif || myState.selesaiKerupuk || isPaused) return;
    setDipilihChoiceId(pil.choiceId);
    setSudahKirim(true);
    setErrorBanner(null);

    const socket = getSocket();
    watchdogsRef.current.armAckTimeout(() => {
      setSudahKirim(false);
      setDipilihChoiceId(null);
      setErrorBanner('Koneksi lambat. Silakan pilih kembali.');
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
        choiceId: pil.choiceId,
        jawaban: pil.label,
      },
      (res: any) => {
        watchdogsRef.current.clearAck();
        if (!res?.success) {
          setSudahKirim(false);
          setDipilihChoiceId(null);
          const pesan = res?.pesan || 'Jawaban belum dapat diproses.';
          setErrorBanner(pesan);
          if (isStaleQuestionErrorMessage(pesan)) {
            socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
          }
        }
      }
    );
  };

  const handleLanjutSoalCepat = () => {
    const socket = getSocket();
    socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
  };

  const myRank = leaderboard.findIndex((p) => p.id === pesertaId) + 1;

  // 1. LOBI SISWA
  if (stage === 'LOBBY') {
    return (
      <RuangTungguSiswa
        token={token}
        nama={nama}
        pesertaId={pesertaId}
        gameType="makan_kerupuk"
        templateJudul={templateJudul}
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

  const renderTopBar = () => (
    <header className="w-full max-w-md mx-auto flex items-center justify-between gap-2 bg-[#fffdf6] border-2 border-[#f0dfb4] rounded-2xl px-3.5 py-2.5 shadow-xs">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0 bg-[#1f9d55]" />
          <span className="bk-h text-sm font-extrabold text-[#2b2a4a] truncate">
            {nama}
          </span>
          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full text-white bg-[#1f9d55]">
            Rank #{myRank || 1}
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

  // 2. PLAYING
  if (stage === 'PLAYING') {
    if (myState.selesaiKerupuk || myState.sisaKerupuk === 0) {
      return (
        <div className="bk-festival p-3 sm:p-4 flex flex-col gap-3 select-none">
          {renderTopBar()}

          <main className="w-full max-w-md mx-auto flex-1 flex flex-col gap-3">
            <div className="bk-card !border-[3px] !border-[#ffb81c] bg-gradient-to-b from-[#fffdf6] to-[#fff3d6] !p-5 sm:!p-6 space-y-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#136837] bg-[#e9f9ef] border border-[#9de0b6] px-3 py-1 rounded-full mb-2">
                  Lomba Selesai Untukmu
                </span>
                <h1 className="bk-h text-2xl font-extrabold text-[#2b2a4a]">
                  Kerupukmu Ludes 100%!
                </h1>
                <p className="text-sm text-[#6b6a85] font-semibold mt-1">
                  Hebat, <strong className="text-[#2b2a4a]">{myState.nama}</strong>! Bonus penyelesaian +100 pt sudah tercatat.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-left">
                <div className="bg-white p-3 rounded-2xl border-2 border-[#f0dfb4]">
                  <span className="text-[10px] uppercase font-extrabold text-[#6b6a85] block">
                    Total Skor
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#1f9d55] font-mono">
                    {myState.skorTotal} pt
                  </span>
                </div>
                <div className="bg-white p-3 rounded-2xl border-2 border-[#f0dfb4]">
                  <span className="text-[10px] uppercase font-extrabold text-[#6b6a85] block">
                    Skor Pembelajaran
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#e6a100] font-mono">
                    {myState.skorPembelajaran ?? 0} pt
                  </span>
                </div>
              </div>

              <div className="bg-[#fff3c4] border-2 border-[#ffb81c] rounded-2xl p-3 flex items-center gap-2.5 text-xs text-[#7a5200] font-extrabold">
                <span className="w-2.5 h-2.5 bg-[#e2312d] rounded-full motion-safe:animate-ping shrink-0" />
                <span>Menunggu teman sekelas selesai atau guru mengakhiri sesi...</span>
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
          {/* Mini Ringkasan Progress Makan Kerupuk */}
          {leaderboard.length > 0 && (
            <div className="bg-[#fffdf6] border-2 border-[#f0dfb4] rounded-2xl p-3 space-y-1.5">
              {leaderboard.slice(0, 5).map((p) => {
                const pct = Math.min(100, Math.max(0, p.progresPersen ?? (100 - p.sisaPersen)));
                const isMe = p.id === pesertaId;
                return (
                  <div key={p.id} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px] font-extrabold">
                      <span className="flex items-center gap-1.5 text-[#2b2a4a]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1f9d55]" />
                        {p.nama} {isMe ? '★' : ''}
                      </span>
                      <span className="text-[#2b2a4a]">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#fff3d6] overflow-hidden border border-[#f0dfb4]">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-500 to-[#1f9d55]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Kartu Soal Siswa */}
          <section className="bk-card flex-1 flex flex-col justify-between border-[3px] border-[#1f9d55]">
            {soalAktif ? (
              <div>
                <QuestionTimerBar
                  presentationKey={soalAktif.presentationId}
                  durationSec={soalDurasiSec}
                  initialRemainingMs={initialSoalRemainingMs}
                  active={
                    !isPaused &&
                    stage === 'PLAYING' &&
                    !sudahKirim &&
                    !feedback &&
                    !myState.selesaiKerupuk
                  }
                  onTimeout={handleTimeoutSoal}
                  leftContent={
                    <>
                      Soal #{soalAktif.nomorSoal}
                      {soalAktif.totalSoalBank ? ` / ${soalAktif.totalSoalBank}` : ''}
                    </>
                  }
                  rightSuffix={` • ${myState.progresPersen}%`}
                />

                {errorBanner && (
                  <div className="mb-3 bg-[#fde0e0] border border-[#f4b6b6] text-[#991b1b] text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorBanner}</span>
                  </div>
                )}

                {myState.streakBenar >= 2 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px] font-extrabold">
                    <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 flex items-center gap-1">
                      <Flame className="w-3 h-3 fill-current text-orange-500" />
                      Streak: {myState.streakBenar}
                    </span>
                  </div>
                )}

                <h2 className="bk-h text-lg sm:text-xl font-extrabold text-[#2b2a4a] leading-snug mb-3">
                  {soalAktif.teks}
                </h2>

                <div className="space-y-2">
                  {(soalAktif.pilihan || []).map((pil) => {
                    const isPicked = dipilihChoiceId === pil.choiceId;
                    const isCorrect = feedback && feedback.jawabanBenar === pil.label;
                    const isWrongHighlight =
                      feedback && !feedback.benar && isPicked;

                    return (
                      <button
                        key={pil.choiceId}
                        type="button"
                        disabled={sudahKirim || Boolean(feedback) || isPaused}
                        onClick={() => handlePilihJawaban(pil)}
                        className={`bk-opt w-full !p-3 ${
                          isCorrect ? 'ok' : isWrongHighlight ? 'no' : ''
                        }`}
                      >
                        <span className="bk-opt-k !w-7 !h-7 !text-xs">{pil.label}</span>
                        <span className="text-sm leading-snug text-left flex-1">{pil.teks}</span>
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
                            ? `Benar! (+${feedback.poinDidapat} pt)`
                            : `Salah! Kunci: ${feedback.jawabanBenar}. ${feedback.jawabanBenarTeks || ''}`}
                        </span>
                        <button
                          type="button"
                          onClick={handleLanjutSoalCepat}
                          className="bk-btn alt !py-1 !px-2.5 !text-xs ml-2 shrink-0 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Lanjut</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {feedback.gacha && (
                        <div className="text-xs text-[#b45309] font-bold">
                          {feedback.gacha.label} (-{feedback.gacha.penguranganEfektifPoin ?? 0} pt kerupuk)
                        </div>
                      )}

                      {(feedback.bonusStreak ?? 0) > 0 && (
                        <div className="text-xs text-[#c2540a] font-bold">
                          Bonus Streak 3! +{feedback.bonusStreak} pt
                        </div>
                      )}

                      {feedback.penjelasan && (
                        <div className="text-xs text-[#2b2a4a] font-normal opacity-90 mt-1">
                          {feedback.penjelasan}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 text-center text-xs font-bold text-[#6b6a85]">
                  Jawab sebelum waktu habis!
                </div>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-[#6b6a85]">
                <Loader2 className="w-6 h-6 animate-spin text-[#1f9d55]" />
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
              <h2 className="bk-h text-xl font-extrabold text-[#2b2a4a]">Permainan Dijeda</h2>
              <p className="text-xs font-bold text-[#6b6a85] leading-relaxed">
                Guru sedang menjeda permainan untuk sementara waktu. Waktu kuis dan gigitan kerupuk dihentikan sejenak.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. SELESAI (PODIUM + RAPOR PERSONAL)
  const finalLeaderboard: PesertaKerupukMultiData[] = hasilAkhir?.leaderboard || leaderboard;
  const juara1 = hasilAkhir?.podium?.juara1 || finalLeaderboard[0];
  const juara2 = hasilAkhir?.podium?.juara2 || finalLeaderboard[1];
  const juara3 = hasilAkhir?.podium?.juara3 || finalLeaderboard[2];

  const myIndex = finalLeaderboard.findIndex((p) => p.id === pesertaId);
  const myFinal = finalLeaderboard[myIndex] || myState;

  return (
    <div className="min-h-screen bg-[#1d3b2e] text-[#f4ecd8] p-4 flex flex-col justify-between max-w-md mx-auto w-full">
      <div className="text-center pt-2 space-y-1">
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#f2c230] text-[#1d3b2e] text-[10px] font-black rounded-full uppercase">
          Lomba Selesai
        </span>
        <h1 className="text-2xl font-black">Podium Pemenang</h1>
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-2 pt-6 pb-4">
        {juara2 && (
          <div className="flex flex-col items-center w-24 text-center">
            <Medal className="w-6 h-6 text-slate-300 mb-1" />
            <span className="text-xs font-bold truncate w-full">{juara2.nama}</span>
            <span className="text-[10px] font-mono text-white/70 mb-1">{juara2.skorTotal} pt</span>
            <div className="w-full bg-slate-600 h-20 rounded-t-xl flex items-center justify-center font-black text-lg">
              2
            </div>
          </div>
        )}
        {juara1 && (
          <div className="flex flex-col items-center w-28 text-center -mt-4">
            <Crown className="w-8 h-8 text-[#f2c230] mb-1" />
            <span className="text-xs font-black text-[#f2c230] truncate w-full">{juara1.nama}</span>
            <span className="text-[11px] font-mono font-bold mb-1">{juara1.skorTotal} pt</span>
            <div className="w-full bg-[#f2c230] text-[#1d3b2e] h-28 rounded-t-xl flex flex-col items-center justify-center font-black text-2xl">
              <span>1</span>
              <span className="text-[9px] uppercase">Juara</span>
            </div>
          </div>
        )}
        {juara3 && (
          <div className="flex flex-col items-center w-24 text-center">
            <Medal className="w-6 h-6 text-amber-500 mb-1" />
            <span className="text-xs font-bold truncate w-full">{juara3.nama}</span>
            <span className="text-[10px] font-mono text-white/70 mb-1">{juara3.skorTotal} pt</span>
            <div className="w-full bg-amber-800 h-14 rounded-t-xl flex items-center justify-center font-black text-lg">
              3
            </div>
          </div>
        )}
      </div>

      {/* Rapor Pribadi */}
      <div className="bg-[#fcf8ed] text-[#1d3b2e] rounded-2xl p-4 space-y-3 border-2 border-[#e0d5b8]">
        <div className="flex items-center justify-between pb-2 border-b border-[#e0d5b8]">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#6b7d6c]">Peringkat Kamu</span>
            <h3 className="text-base font-black">
              #{myIndex >= 0 ? myIndex + 1 : 1} dari {finalLeaderboard.length} Peserta
            </h3>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-[#6b7d6c]">Total Skor</span>
            <div className="text-xl font-black text-[#c8362f] font-mono">{myFinal.skorTotal} pt</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-[#e0d5b8]">
            <span className="text-[#6b7d6c] text-[10px] block font-bold">Pembelajaran</span>
            <span className="font-black text-[#1d3b2e] font-mono">
              +{myFinal.skorPembelajaran ?? 0} pt
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-[#e0d5b8]">
            <span className="text-[#6b7d6c] text-[10px] block font-bold">Keberuntungan</span>
            <span className="font-black text-amber-700 font-mono">
              +{myFinal.bonusKeberuntungan ?? 0} pt
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-[#e0d5b8]">
            <span className="text-[#6b7d6c] text-[10px] block font-bold">Bonus Ludes</span>
            <span className="font-black text-emerald-700 font-mono">
              +{myFinal.bonusPenyelesaian ?? 0} pt
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-[#e0d5b8]">
            <span className="text-[#6b7d6c] text-[10px] block font-bold">Status Kerupuk</span>
            <span
              className={`font-black font-mono inline-block px-2 py-0.5 rounded text-[11px] mt-0.5 ${
                myFinal.selesaiKerupuk || myFinal.sisaKerupuk === 0
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {myFinal.selesaiKerupuk || myFinal.sisaKerupuk === 0
                ? '✓ Ludes 100%'
                : `Sisa ${myFinal.sisaKerupuk} pt`}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-3">
        <button
          type="button"
          onClick={() => onKeluar?.()}
          className="w-full py-3 rounded-xl bg-[#c8362f] hover:bg-[#b02d27] text-white font-black text-sm cursor-pointer"
        >
          Selesai &amp; Keluar
        </button>
      </div>
    </div>
  );
}

