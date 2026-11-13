import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../../lib/socket';
import { bindStudentReconnect } from '../../lib/socketReconnect';
import { soundEffects, useGameSoundLifecycle } from '../../lib/soundEffects';
import KerupukVirtual, {
  HasilGachaGigitanProps,
  MoodKarakterKerupuk,
} from './KerupukVirtual';
import {
  Users,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  LogOut,
  Flame,
  Crown,
  Medal,
  ArrowRight,
  Volume2,
  VolumeX,
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

  const [totalPeserta, setTotalPeserta] = useState<number>(initialLeaderboard.length || 1);
  const [leaderboard, setLeaderboard] = useState<PesertaKerupukMultiData[]>(initialLeaderboard);

  const [soalAktif, setSoalAktif] = useState<SoalKerupukMulti | null>(initialSoalAktif);
  const [dipilihChoiceId, setDipilihChoiceId] = useState<string | null>(null);
  const [sudahKirim, setSudahKirim] = useState(false);
  const [mood, setMood] = useState<MoodKarakterKerupuk>('playing');
  const [reactionNonce, setReactionNonce] = useState(0);

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

  const [detikElapsed, setDetikElapsed] = useState<number>(0);
  const stopwatchRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startStopwatch = useCallback(() => {
    if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    const start = Date.now();
    setDetikElapsed(0);
    stopwatchRef.current = setInterval(() => {
      setDetikElapsed(Math.round((Date.now() - start) / 100) / 10);
    }, 100);
  }, []);

  const stopStopwatch = useCallback(() => {
    if (stopwatchRef.current) {
      clearInterval(stopwatchRef.current);
      stopwatchRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleLobiUpdate = (data: {
      game?: string;
      totalPeserta: number;
      leaderboard?: PesertaKerupukMultiData[];
      daftarPeserta?: PesertaKerupukMultiData[];
    }) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      setTotalPeserta(data.totalPeserta);
      const list = data.leaderboard || data.daftarPeserta;
      if (list) setLeaderboard(list);
    };

    const handleGameMulai = (data: { game?: string }) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      setStage('PLAYING');
      setMood('playing');
      soundEffects.startGame('whistle');
    };

    const handleSoalTampil = (data: any) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      setStage('PLAYING');
      setSoalAktif({
        presentationId: data.presentationId,
        questionId: data.questionId,
        nomorSoal: data.nomorSoal,
        totalSoalBank: data.totalSoalBank,
        teks: data.teks,
        pilihan: data.pilihan || [],
      });
      setDipilihChoiceId(null);
      setSudahKirim(false);
      setFeedback(null);
      startStopwatch();
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
      stopStopwatch();

      if (res.benar) {
        if (res.gacha && res.gacha.tipe !== 'zonk') {
          setMood(res.gacha.tipe);
        } else {
          setMood('zonk');
        }
        soundEffects.playKerupukAction({
          benar: true,
          gachaTipe: res.gacha?.tipe ?? 'zonk',
          hasStreakBonus: (res.bonusStreak || 0) > 0,
        });
      } else {
        setMood('salah');
        soundEffects.playKerupukAction({ benar: false });
      }
      setReactionNonce((n) => n + 1);

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
      stopStopwatch();
      setMood('win');
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
      stopStopwatch();
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

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('game:mulai', handleGameMulai);
    socket.on('soal:tampil', handleSoalTampil);
    socket.on('kerupuk:update', handleKerupukUpdate);
    socket.on('jawab:hasil', handleJawabHasil);
    socket.on('pemain:selesai', handlePemainSelesai);
    socket.on('sesi:selesai', handleSesiSelesai);
    socket.on('sesi:dikick', handleDiKick);

    return () => {
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('soal:tampil', handleSoalTampil);
      socket.off('kerupuk:update', handleKerupukUpdate);
      socket.off('jawab:hasil', handleJawabHasil);
      socket.off('pemain:selesai', handlePemainSelesai);
      socket.off('sesi:selesai', handleSesiSelesai);
      socket.off('sesi:dikick', handleDiKick);
    };
  }, [pesertaId, startStopwatch, stopStopwatch]);

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
          setTotalPeserta(res.leaderboard.length);
        }
        if (res.status === 'jalan') {
          setStage('PLAYING');
          if (res.soalAktif) {
            setSoalAktif((prev) =>
              prev && prev.presentationId === res.soalAktif.presentationId ? prev : res.soalAktif
            );
          }
        } else if (res.status === 'selesai') {
          stopStopwatch();
          if (res.hasil) setHasilAkhir(res.hasil);
          setStage('SELESAI');
        }
      },
    });
  }, [token, nama, pesertaId, pesertaSecret, stopStopwatch]);

  const handlePilihJawaban = (pil: PilihanSoalKerupuk) => {
    if (sudahKirim || !soalAktif) return;
    setDipilihChoiceId(pil.choiceId);
    setSudahKirim(true);
    stopStopwatch();

    const socket = getSocket();
    socket.emit('jawab:kirim', {
      sessionId,
      pesertaId,
      pesertaSecret,
      presentationId: soalAktif.presentationId,
      questionId: soalAktif.questionId,
      choiceId: pil.choiceId,
      jawaban: pil.label,
    });
  };

  const handleLanjutSoalCepat = () => {
    const socket = getSocket();
    socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
  };

  const myRank = leaderboard.findIndex((p) => p.id === pesertaId) + 1;

  // 1. LOBI SISWA
  if (stage === 'LOBBY') {
    return (
      <div className="min-h-screen bg-[#f4ecd8] text-[#1d3b2e] p-4 flex flex-col justify-between max-w-md mx-auto w-full">
        <div className="flex items-center justify-between bg-[#fcf8ed] rounded-2xl p-4 shadow-xs border-2 border-[#e0d5b8]">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#c8362f] block">
              Makan Kerupuk • Multiplayer
            </span>
            <h2 className="text-sm font-black line-clamp-1">{templateJudul}</h2>
          </div>
          <button
            type="button"
            onClick={() => onKeluar?.()}
            className="p-2 text-[#6b7d6c] hover:text-[#c8362f] rounded-xl cursor-pointer"
            title="Keluar"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <div className="my-auto text-center space-y-5 w-full">
          <div className="bg-[#fcf8ed] p-6 rounded-3xl shadow-sm border-2 border-[#e0d5b8]">
            <KerupukVirtual
              size="md"
              showCharacter
              mood="ready"
              sisaKerupuk={myState.sisaPersen ?? 100}
              sisaPoin={myState.sisaKerupuk}
              targetPoin={myState.targetKerupuk}
            />
            <div className="mt-4 space-y-1">
              <span className="inline-block px-3 py-1 bg-[#f2c230] text-[#1d3b2e] text-xs font-black rounded-full uppercase">
                Siap Menggigit!
              </span>
              <h1 className="text-2xl font-black mt-1">{nama}</h1>
              <p className="text-xs text-[#6b7d6c]">
                Target kerupuk kamu: <strong>{myState.targetKerupuk} poin</strong>. Menunggu guru memulai lomba...
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#e0d5b8] rounded-2xl p-3 flex items-center justify-center gap-2 text-xs font-bold">
            <Users className="w-4 h-4 text-[#c8362f]" />
            <span>{totalPeserta} siswa bergabung di lobi</span>
          </div>
        </div>

        <div className="text-center text-xs font-bold text-[#6b7d6c] py-2">
          PIN Sesi: <span className="font-mono text-[#1d3b2e]">{token}</span>
        </div>
      </div>
    );
  }

  // 2. PLAYING
  if (stage === 'PLAYING') {
    if (myState.selesaiKerupuk || myState.sisaKerupuk === 0) {
      return (
        <div className="min-h-screen bg-[#1d3b2e] text-[#f4ecd8] flex flex-col justify-between p-4 max-w-md mx-auto w-full">
          <header className="flex items-center justify-between bg-white/10 rounded-2xl p-4 border border-white/15">
            <div>
              <span className="text-[10px] font-black uppercase text-[#f2c230] block">
                Makan Kerupuk Challenge
              </span>
              <h2 className="text-sm font-bold line-clamp-1">{templateJudul}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#f4ecd8] cursor-pointer"
                aria-label={isMuted ? 'Nyalakan suara' : 'Bisukan suara'}
                title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f2c230] text-[#1d3b2e] rounded-xl text-xs font-black">
                <Trophy className="w-4 h-4" /> Rank #{myRank || 1}
              </div>
            </div>
          </header>

          <div className="my-auto text-center space-y-4">
            <div className="bg-[#fcf8ed] text-[#1d3b2e] rounded-3xl p-6 shadow-xl border-2 border-[#f2c230] space-y-4">
              <KerupukVirtual
                size="md"
                showCharacter
                mood="win"
                sisaKerupuk={0}
                sisaPoin={0}
                targetPoin={myState.targetKerupuk}
              />
              <div>
                <h1 className="text-2xl font-black text-emerald-700">Kerupukmu Ludes 100%!</h1>
                <p className="text-xs text-[#6b7d6c] mt-1">
                  Bonus penyelesaian +100 pt sudah tercatat. Menunggu teman sekelas menyelesaikan kerupuk masing-masing...
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#f4ecd8] p-3 rounded-xl">
                  <span className="text-[#6b7d6c] block font-bold">Total Skor</span>
                  <span className="text-lg font-black font-mono">{myState.skorTotal} pt</span>
                </div>
                <div className="bg-[#f4ecd8] p-3 rounded-xl">
                  <span className="text-[#6b7d6c] block font-bold">Skor Pembelajaran</span>
                  <span className="text-lg font-black font-mono">
                    {myState.skorPembelajaran ?? 0} pt
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-white/70 font-semibold py-2">
            Menunggu host menampilkan podium juara akhir...
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#f4ecd8] text-[#1d3b2e] flex flex-col justify-between p-4 max-w-md mx-auto w-full select-none">
        {/* Top Info */}
        <div className="flex items-center justify-between bg-[#fcf8ed] rounded-2xl p-3 border-2 border-[#e0d5b8] shadow-xs">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-[#1d3b2e] text-[#f4ecd8] rounded-xl text-xs font-black font-mono">
              #{soalAktif?.nomorSoal || myState.jumlahJawab || 1}
            </span>
            <span className="text-xs font-bold text-[#6b7d6c] flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5" /> {detikElapsed.toFixed(1)}s
            </span>
          </div>

          <div className="flex items-center gap-2">
            {myState.streakBenar >= 2 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 border border-orange-300 rounded-full text-[11px] font-black">
                <Flame className="w-3 h-3 fill-current" /> x{myState.streakBenar}
              </span>
            )}
            <div className="text-right">
              <span className="text-[10px] font-bold text-[#6b7d6c] block">Skor / Rank</span>
              <span className="text-xs font-black font-mono">
                {myState.skorTotal} pt • #{myRank || '-'}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleMute}
              className="p-2 rounded-xl bg-[#f4ecd8] border border-[#e0d5b8] text-[#1d3b2e] cursor-pointer shrink-0"
              aria-label={isMuted ? 'Nyalakan suara' : 'Bisukan suara'}
              title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Center Kerupuk + Feedback */}
        <div className="my-auto flex flex-col items-center py-2">
          <KerupukVirtual
            size="md"
            showCharacter
            mood={mood}
            reactionNonce={reactionNonce}
            sisaKerupuk={myState.sisaPersen}
            sisaPoin={myState.sisaKerupuk}
            targetPoin={myState.targetKerupuk}
            terakhirGigitan={feedback?.gacha || myState.terakhirGigitan}
          />

          {feedback?.tampil && (
            <div
              className={`mt-2 px-4 py-2.5 rounded-2xl text-xs font-bold w-full text-center border-2 ${
                feedback.benar
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                {feedback.benar ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-black">Benar! (+{feedback.poinDidapat} pt)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="font-black">
                      Salah! Kunci: {feedback.jawabanBenar}. {feedback.jawabanBenarTeks || ''}
                    </span>
                  </>
                )}
              </div>
              {feedback.gacha && (
                <p className="text-[11px] font-extrabold text-amber-800 mt-0.5">
                  {feedback.gacha.label} (-{feedback.gacha.penguranganEfektifPoin ?? 0} pt kerupuk)
                </p>
              )}
              {(feedback.bonusStreak ?? 0) > 0 && (
                <p className="text-[10px] text-orange-700 font-black">
                  Bonus Streak 3! +{feedback.bonusStreak} pt
                </p>
              )}
              <button
                type="button"
                onClick={handleLanjutSoalCepat}
                className="mt-2 w-full py-1.5 rounded-xl bg-[#1d3b2e] text-white font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Lanjut Soal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Pertanyaan & Pilihan A/B/C berbasis choiceId */}
        <div className="space-y-2.5">
          <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-2xl p-4 text-center shadow-xs">
            <p className="text-sm sm:text-base font-black leading-snug">
              {soalAktif?.teks || 'Menyiapkan soal berikutnya...'}
            </p>
          </div>

          <div className="space-y-2">
            {(soalAktif?.pilihan || []).map((pil) => {
              const chosen = dipilihChoiceId === pil.choiceId;
              const isKunci = feedback?.jawabanBenar === pil.label;

              let cls = 'bg-white border-[#e0d5b8] text-[#1d3b2e] hover:border-[#c8362f]';
              if (feedback?.tampil) {
                if (isKunci) cls = 'bg-emerald-600 border-emerald-500 text-white';
                else if (chosen && !feedback.benar) cls = 'bg-red-600 border-red-500 text-white';
                else cls = 'bg-white/60 border-[#e0d5b8] text-[#6b7d6c] opacity-60';
              } else if (chosen) {
                cls = 'bg-[#1d3b2e] border-[#1d3b2e] text-white';
              }

              return (
                <button
                  key={pil.choiceId}
                  type="button"
                  disabled={sudahKirim || !soalAktif}
                  onClick={() => handlePilihJawaban(pil)}
                  className={`w-full p-3.5 rounded-2xl border-2 flex items-center gap-3 text-left transition-all ${cls} ${
                    sudahKirim ? 'cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  <span className="w-7 h-7 rounded-lg bg-[#f4ecd8] text-[#1d3b2e] font-black text-xs flex items-center justify-center shrink-0">
                    {pil.label}
                  </span>
                  <span className="text-xs sm:text-sm font-bold flex-1">{pil.teks}</span>
                </button>
              );
            })}
          </div>
        </div>
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
            <span className="text-[#6b7d6c] text-[10px] block font-bold">Sisa Kerupuk</span>
            <span className="font-black font-mono">
              {myFinal.sisaKerupuk === 0 ? '0 pt (Habis!)' : `${myFinal.sisaKerupuk} pt`}
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

