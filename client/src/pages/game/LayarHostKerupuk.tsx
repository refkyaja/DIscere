import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import { Modal, resolveGuruReturnUrl } from '../../components';
import { ModalKonfirmasiKeluar } from '../../components/ModalKonfirmasiKeluar';
import {
  KerupukStadium,
  KerupukLaneItem,
  KerupukActionPulse,
} from '../../components/KerupukStadium';
import '../../components/kerupukFestival.css';
import LayarHostKerupukMulti, { SesiKerupukMultiClient } from './LayarHostKerupukMulti';
import { soundEffects, useGameSoundLifecycle } from '../../lib/soundEffects';

type StateKerupuk = 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED' | 'STOPPED';
type TipeGigitan = 'besar' | 'sedang' | 'kecil' | 'sangat_kecil' | 'zonk';

interface PilihanSoal {
  choiceId: string;
  label: 'A' | 'B' | 'C' | 'D' | 'E';
  teks: string;
}

interface SoalAktifSolo {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  totalSoalBank: number;
  teks: string;
  pilihan: PilihanSoal[];
}

interface SesiKerupukClient {
  sessionId: string;
  game: 'makan_kerupuk';
  mode: 'solo';
  templateId: string;
  templateJudul: string;
  state: StateKerupuk;
  config: {
    targetKerupuk: number;
    targetPreset: string;
    kesulitan: string;
    probabilitas: Record<TipeGigitan, number>;
  };
  totalSoalBank: number;
  sisaKerupuk: number;
  targetKerupuk: number;
  progresPersen: number;
  sisaPersen: number;
  skorTotal: number;
  skorPembelajaran: number;
  skorDasarBenar: number;
  totalBonusStreak: number;
  kaliBonusStreak: number;
  bonusKeberuntungan: number;
  bonusPenyelesaian: number;
  totalBenar: number;
  totalSalah: number;
  streakBenar: number;
  streakTertinggi: number;
  rataRataWaktuJawabMs: number;
  soalSaatIni: SoalAktifSolo | null;
  isFinished: boolean;
  hasil: any | null;
}

interface ContestantSoloState {
  eaten: number;
  c: number;
  w: number;
  streak: number;
  best: number;
  n: number;
}

const BOT_DIFFICULTIES = [
  { name: 'Mudah', acc: 0.55, lo: 6000, hi: 10000 },
  { name: 'Sedang', acc: 0.72, lo: 4500, hi: 8000 },
  { name: 'Sulit', acc: 0.88, lo: 3200, hi: 6000 },
];

function formatWaktu(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function LayarHostKerupuk() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = resolveGuruReturnUrl(searchParams.get('kembali'));

  const [sesi, setSesi] = useState<SesiKerupukClient | null>(null);
  const [sesiMulti, setSesiMulti] = useState<SesiKerupukMultiClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Konfigurasi Mode Solo 1 vs 1: Lawan Bot vs Lawan Teman (PvP)
  const [modeTanding, setModeTanding] = useState<'bot' | 'pvp'>('bot');
  const [botLevel, setBotLevel] = useState<number>(1); // 0=Mudah, 1=Sedang, 2=Sulit

  // State Peserta 1 & Peserta 2 / Bot
  const [p1, setP1] = useState<ContestantSoloState>({
    eaten: 0,
    c: 0,
    w: 0,
    streak: 0,
    best: 0,
    n: 0,
  });
  const [p2, setP2] = useState<ContestantSoloState>({
    eaten: 0,
    c: 0,
    w: 0,
    streak: 0,
    best: 0,
    n: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [actionPulse, setActionPulse] = useState<KerupukActionPulse | null>(null);
  const [crowdCheer, setCrowdCheer] = useState(false);
  const [selectedChoiceP1, setSelectedChoiceP1] = useState<string | null>(null);
  const [choiceResultP1, setChoiceResultP1] = useState<{ choiceId: string; ok: boolean } | null>(
    null
  );

  // Waktu pertandingan
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const timerRef = useRef<number | null>(null);
  const botTimerRef = useRef<number | null>(null);

  // Modal dialog
  const [modalHentikanOpen, setModalHentikanOpen] = useState(false);
  const [modalKeluarOpen, setModalKeluarOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Sound lifecycle: aktif hanya saat game benar-benar PLAYING
  const isSoundActive = Boolean(sesi && sesi.state === 'PLAYING');
  const { isMuted, toggleMute } = useGameSoundLifecycle(isSoundActive, id);

  const isPlayOrPause = Boolean(sesi && (sesi.state === 'PLAYING' || sesi.state === 'PAUSED'));
  const targetKerupuk = sesi?.targetKerupuk || sesi?.config?.targetKerupuk || 100;

  // Nama peserta
  const p1Name = modeTanding === 'bot' ? 'Kamu' : 'Pemain 1';
  const p2Name =
    modeTanding === 'bot' ? `Bot AI (${BOT_DIFFICULTIES[botLevel].name})` : 'Pemain 2';

  // 1. Muat data sesi dari server
  const fetchSesi = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await apiRequest<{ session: any }>(`/sesi/${id}`);
      const s = res.session;
      if (s.playMode === 'MULTIPLAYER' || s.mode === 'multi') {
        setSesiMulti(s as SesiKerupukMultiClient);
        setSesi(null);
      } else {
        setSesiMulti(null);
        setSesi(s as SesiKerupukClient);
        setP1((prev) => ({
          ...prev,
          eaten: s.progresPersen ? (s.progresPersen / 100) * (s.targetKerupuk || 100) : 0,
          c: s.totalBenar || 0,
          w: s.totalSalah || 0,
          streak: s.streakBenar || 0,
          best: s.streakTertinggi || 0,
        }));
      }
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal memuat sesi Makan Kerupuk.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSesi();
  }, [fetchSesi]);

  // Stopwatch pertandingan
  useEffect(() => {
    if (sesi?.state === 'PLAYING') {
      timerRef.current = window.setInterval(() => {
        setElapsedSec((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sesi?.state]);

  // Bot Autonomous Step Scheduler (saat mode Lawan Bot & PLAYING)
  useEffect(() => {
    if (!sesi || sesi.state !== 'PLAYING' || modeTanding !== 'bot') {
      if (botTimerRef.current) window.clearTimeout(botTimerRef.current);
      return;
    }

    const curDiff = BOT_DIFFICULTIES[botLevel];
    const scheduleNextBotStep = () => {
      const delay = curDiff.lo + Math.random() * (curDiff.hi - curDiff.lo);
      botTimerRef.current = window.setTimeout(() => {
        if (!sesi || sesi.state !== 'PLAYING') return;

        const isCorrect = Math.random() < curDiff.acc;
        if (isCorrect) {
          setP2((prev) => {
            const nextStreak = prev.streak + 1;
            const streakBonus = Math.min(nextStreak - 1, 5) * 2;
            const lucky = Math.random() < 0.2;
            const biteAmount = 10 + streakBonus + (lucky ? 5 : 0);
            const nextEaten = Math.min(targetKerupuk, prev.eaten + biteAmount);

            setActionPulse({
              id: Date.now(),
              laneIdx: 1,
              type: 'bite',
              lucky,
              text: lucky ? 'Gigitan jumbo!' : undefined,
            });
            soundEffects.playCrunch();

            if (nextEaten >= targetKerupuk) {
              handleFinishGame(1);
            }

            return {
              ...prev,
              eaten: nextEaten,
              c: prev.c + 1,
              streak: nextStreak,
              best: Math.max(prev.best, nextStreak),
            };
          });
        } else {
          setP2((prev) => {
            setActionPulse({
              id: Date.now(),
              laneIdx: 1,
              type: 'miss',
              text: 'Meleset!',
            });
            soundEffects.playZonk();
            return {
              ...prev,
              w: prev.w + 1,
              streak: 0,
            };
          });
        }

        scheduleNextBotStep();
      }, delay);
    };

    scheduleNextBotStep();

    return () => {
      if (botTimerRef.current) window.clearTimeout(botTimerRef.current);
    };
  }, [sesi?.state, modeTanding, botLevel, targetKerupuk]);

  // Mulai Permainan
  const handleMulai = useCallback(async () => {
    if (!id || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      const res = await apiRequest<{ session: SesiKerupukClient }>(`/sesi/${id}/mulai`, {
        method: 'POST',
      });
      soundEffects.startGame('whistle');
      setSesi(res.session);
      setP1({ eaten: 0, c: 0, w: 0, streak: 0, best: 0, n: 1 });
      setP2({ eaten: 0, c: 0, w: 0, streak: 0, best: 0, n: 1 });
      setElapsedSec(0);
      setSelectedChoiceP1(null);
      setChoiceResultP1(null);
      setActionPulse(null);
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal memulai permainan.');
    } finally {
      setIsActionLoading(false);
    }
  }, [id, isActionLoading]);

  // Jeda / Lanjut
  const handleTogglePause = useCallback(async () => {
    if (!id || !sesi || isActionLoading) return;
    if (sesi.state !== 'PLAYING' && sesi.state !== 'PAUSED') return;

    const targetState = sesi.state === 'PLAYING' ? 'PAUSED' : 'PLAYING';
    try {
      setIsActionLoading(true);
      setActionError(null);
      const res = await apiRequest<{ session: SesiKerupukClient }>(`/sesi/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({ state: targetState }),
      });
      setSesi(res.session);
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal mengubah status jeda permainan.');
    } finally {
      setIsActionLoading(false);
    }
  }, [id, sesi, isActionLoading]);

  // Akhiri / Selesaikan Game
  const handleFinishGame = useCallback(
    async (winnerLane?: number) => {
      if (botTimerRef.current) window.clearTimeout(botTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);

      if (winnerLane !== undefined) {
        setActionPulse({
          id: Date.now(),
          laneIdx: winnerLane,
          type: 'win',
          text: 'LUDES!',
        });
        setCrowdCheer(true);
        soundEffects.playNaturalVictory();
      }

      try {
        if (id) {
          await apiRequest(`/sesi/${id}/selesai`, { method: 'POST' });
        }
      } catch {
        // Biarkan selesai di tampilan lokal
      }

      setSesi((prev) => (prev ? { ...prev, state: 'FINISHED', isFinished: true } : null));
    },
    [id]
  );

  // Menjawab Pertanyaan Pemain 1
  const handleJawabP1 = useCallback(
    async (choiceId: string) => {
      if (!id || !sesi || !sesi.soalSaatIni) return;
      if (sesi.state !== 'PLAYING') return;
      if (submittingRef.current) return;

      submittingRef.current = true;
      setIsSubmitting(true);
      setSelectedChoiceP1(choiceId);
      setActionError(null);

      try {
        const res = await apiRequest<{
          benar: boolean;
          jawabanBenarKode: string;
          jawabanBenarTeks: string;
          penjelasan: string | null;
          poinDidapat: number;
          gacha: any | null;
          isFinished: boolean;
          session: SesiKerupukClient;
        }>(`/sesi/${id}/jawab`, {
          method: 'POST',
          body: JSON.stringify({
            presentationId: sesi.soalSaatIni.presentationId,
            questionId: sesi.soalSaatIni.questionId,
            choiceId,
          }),
        });

        setChoiceResultP1({ choiceId, ok: res.benar });

        if (res.benar) {
          const bitePoin = res.gacha?.penguranganEfektifPoin || 10;
          const nextEaten = Math.min(targetKerupuk, p1.eaten + bitePoin);
          const nextStreak = p1.streak + 1;

          setP1((prev) => ({
            ...prev,
            eaten: nextEaten,
            c: prev.c + 1,
            streak: nextStreak,
            best: Math.max(prev.best, nextStreak),
          }));

          setActionPulse({
            id: Date.now(),
            laneIdx: 0,
            type: 'bite',
            lucky: res.gacha?.tipe === 'besar',
            text: res.gacha?.label ? `${res.gacha.label}!` : undefined,
          });
          soundEffects.playCrunch();
          setCrowdCheer(true);

          if (nextEaten >= targetKerupuk || res.isFinished) {
            handleFinishGame(0);
            return;
          }
        } else {
          setP1((prev) => ({
            ...prev,
            w: prev.w + 1,
            streak: 0,
          }));

          setActionPulse({
            id: Date.now(),
            laneIdx: 0,
            type: 'miss',
            text: 'Meleset!',
          });
          soundEffects.playZonk();
        }

        // Tunggu sejenak agar efek animasi terlihat sebelum soal berganti
        setTimeout(() => {
          setSesi(res.session);
          setSelectedChoiceP1(null);
          setChoiceResultP1(null);
          setP1((prev) => ({ ...prev, n: prev.n + 1 }));
          setCrowdCheer(false);
        }, 1100);
      } catch (err: any) {
        setActionError(err.pesan || 'Gagal mengirim jawaban.');
        setSelectedChoiceP1(null);
        setChoiceResultP1(null);
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [id, sesi, p1.eaten, p1.streak, targetKerupuk, handleFinishGame]
  );

  // Menjawab untuk Pemain 2 (dalam Mode PvP Lokal 1 Layar)
  const handleJawabP2 = useCallback(
    (_choiceId: string, isCorrect: boolean) => {
      if (sesi?.state !== 'PLAYING' || modeTanding !== 'pvp') return;

      if (isCorrect) {
        const nextEaten = Math.min(targetKerupuk, p2.eaten + 10);
        const nextStreak = p2.streak + 1;
        setP2((prev) => ({
          ...prev,
          eaten: nextEaten,
          c: prev.c + 1,
          streak: nextStreak,
          best: Math.max(prev.best, nextStreak),
          n: prev.n + 1,
        }));

        setActionPulse({
          id: Date.now(),
          laneIdx: 1,
          type: 'bite',
          text: 'Nyam!',
        });
        soundEffects.playCrunch();

        if (nextEaten >= targetKerupuk) {
          handleFinishGame(1);
        }
      } else {
        setP2((prev) => ({
          ...prev,
          w: prev.w + 1,
          streak: 0,
          n: prev.n + 1,
        }));

        setActionPulse({
          id: Date.now(),
          laneIdx: 1,
          type: 'miss',
          text: 'Meleset!',
        });
        soundEffects.playZonk();
      }
    },
    [sesi?.state, modeTanding, p2.eaten, p2.streak, targetKerupuk, handleFinishGame]
  );

  // Keyboard shortcut listener:
  // Pemain 1: Tombol A/B/C/D atau 1/2/3/4
  // Pemain 2: Tombol J/K/L/M atau 7/8/9/0
  useEffect(() => {
    if (sesi?.state !== 'PLAYING') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitting) return;
      const k = e.key.toLowerCase();

      // Kontrol Pemain 1
      const p1Map: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, '1': 0, '2': 1, '3': 2, '4': 3 };
      if (p1Map[k] !== undefined && sesi.soalSaatIni) {
        const idx = p1Map[k];
        const choice = sesi.soalSaatIni.pilihan[idx];
        if (choice) {
          handleJawabP1(choice.choiceId);
        }
      }

      // Kontrol Pemain 2 (hanya di PvP)
      if (modeTanding === 'pvp' && sesi.soalSaatIni) {
        const p2Map: Record<string, number> = { j: 0, k: 1, l: 2, m: 3, '7': 0, '8': 1, '9': 2, '0': 3 };
        if (p2Map[k] !== undefined) {
          const idx = p2Map[k];
          const choice = sesi.soalSaatIni.pilihan[idx];
          if (choice) {
            handleJawabP2(choice.choiceId, idx === 0);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sesi?.state, sesi?.soalSaatIni, isSubmitting, modeTanding, handleJawabP1, handleJawabP2]);

  // Handler Navigasi & Konfirmasi Keluar
  const handleKembaliClick = () => {
    if (isPlayOrPause) {
      setModalKeluarOpen(true);
    } else {
      navigate(returnUrl);
    }
  };

  const handleKonfirmasiKeluar = async () => {
    setModalKeluarOpen(false);
    if (botTimerRef.current) window.clearTimeout(botTimerRef.current);
    if (id) {
      try {
        await apiRequest(`/sesi/${id}/selesai`, { method: 'POST' });
      } catch {}
    }
    soundEffects.stopAll();
    navigate(returnUrl);
  };

  const handleKonfirmasiHentikan = async () => {
    if (!id || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      const res = await apiRequest<{ session: SesiKerupukClient }>(`/sesi/${id}/selesai`, {
        method: 'POST',
      });
      setModalHentikanOpen(false);
      soundEffects.stopAll();
      setSesi(res.session);
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal menghentikan permainan.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMainLagi = async () => {
    if (!id || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      soundEffects.stopAll();

      const res = await apiRequest<{ session?: SesiKerupukClient; sessionId?: string }>(
        `/sesi/${id}/ulang`,
        {
          method: 'POST',
          body: JSON.stringify({ autoStart: true }),
        }
      );

      setP1({ eaten: 0, c: 0, w: 0, streak: 0, best: 0, n: 1 });
      setP2({ eaten: 0, c: 0, w: 0, streak: 0, best: 0, n: 1 });
      setElapsedSec(0);
      setSelectedChoiceP1(null);
      setChoiceResultP1(null);
      setActionPulse(null);

      if (res.session) {
        setSesi(res.session);
        soundEffects.startGame('whistle');
      } else {
        await fetchSesi();
      }
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal mengulang permainan.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Jika sesi ternyata sesi Multiplayer, alihkan ke LayarHostKerupukMulti
  if (sesiMulti) {
    return <LayarHostKerupukMulti initialSession={sesiMulti} returnUrl={returnUrl} />;
  }

  if (loading && !sesi) {
    return (
      <div className="kp-festival flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="w-12 h-12 border-4 border-[#e2312d] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-extrabold text-[#0f3d2e]">Memuat Arena Makan Kerupuk...</h2>
      </div>
    );
  }

  if (errorPesan || !sesi) {
    return (
      <div className="kp-festival flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="max-w-md bg-white border-2 border-red-300 rounded-3xl p-6 shadow-md">
          <h2 className="text-xl font-extrabold text-red-600 mb-2">Terjadi Kendala</h2>
          <p className="text-sm text-[#6d7a6f] mb-4">{errorPesan || 'Sesi tidak ditemukan.'}</p>
          <button
            type="button"
            onClick={() => navigate(returnUrl)}
            className="px-5 py-2.5 rounded-xl bg-[#0f3d2e] text-white font-extrabold text-sm"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  // Tentukan Pemenang saat FINISHED
  const isFinished = sesi.state === 'FINISHED';
  const winnerIdx =
    p1.eaten >= targetKerupuk
      ? 0
      : p2.eaten >= targetKerupuk
      ? 1
      : p1.eaten > p2.eaten
      ? 0
      : p2.eaten > p1.eaten
      ? 1
      : -1;

  // Siapkan data lintasan peserta untuk KerupukStadium
  const lanes: KerupukLaneItem[] = [
    {
      id: 'p1',
      nama: p1Name,
      warna: '#e2312d',
      eatenFraction: Math.max(0, Math.min(1, p1.eaten / targetKerupuk)),
      subText: `${Math.round(Math.min(100, (p1.eaten / targetKerupuk) * 100))}%`,
      isWinner: isFinished && winnerIdx === 0,
    },
    {
      id: 'p2',
      nama: p2Name,
      warna: '#1d8fe0',
      eatenFraction: Math.max(0, Math.min(1, p2.eaten / targetKerupuk)),
      subText: `${Math.round(Math.min(100, (p2.eaten / targetKerupuk) * 100))}%`,
      isWinner: isFinished && winnerIdx === 1,
    },
  ];

  return (
    <div className="kp-festival flex flex-col min-h-screen">
      {/* ====================================================================
          1. PANGGUNG UTAMA FESTIVAL 17 AGUSTUS (KERUPUK STADIUM)
          ==================================================================== */}
      <KerupukStadium
        title={sesi.templateJudul}
        subtitle="MAKAN KERUPUK • MODE SOLO • 1 VS 1"
        statusLabel={
          sesi.state === 'READY'
            ? 'SIAP DIMULAI'
            : sesi.state === 'PLAYING'
            ? 'BERLANGSUNG'
            : sesi.state === 'PAUSED'
            ? 'DIJEDA'
            : 'SELESAI'
        }
        statusTone={
          sesi.state === 'PLAYING' ? 'live' : sesi.state === 'FINISHED' ? 'done' : 'idle'
        }
        timerText={formatWaktu(elapsedSec)}
        targetText={`Target ${targetKerupuk} pt`}
        lanes={lanes}
        actionPulse={actionPulse}
        crowdCheer={crowdCheer}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onBack={handleKembaliClick}
        backLabel="Kembali"
        isPaused={sesi.state === 'PAUSED'}
        onTogglePause={
          sesi.state === 'PLAYING' || sesi.state === 'PAUSED' ? handleTogglePause : undefined
        }
        onStop={
          sesi.state === 'PLAYING' || sesi.state === 'PAUSED'
            ? () => setModalHentikanOpen(true)
            : undefined
        }
        stopLabel="Akhiri"
      />

      {/* Banner Error Aksi jika ada */}
      {actionError && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-3">
          <div className="bg-red-100 border border-red-300 text-red-900 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="underline cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          2. KONTEN GAMEPLAY (KARTU KUIS & PAPAN SKOR)
          ==================================================================== */}
      <main className="max-w-4xl w-full mx-auto px-4 py-6 space-y-6 flex-1">
        {/* VIEW 1: READY / ATUR LAWAN (BOT VS PVP) */}
        {sesi.state === 'READY' && (
          <div className="bg-[#fffaf0] border-2 border-[#e6d3ae] rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-sm">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0f3d2e]">
              Siap adu cepat 1 lawan 1?
            </h2>
            <p className="text-sm text-[#6d7a6f] max-w-xl mx-auto leading-relaxed">
              Jawab kuis dengan benar untuk menggigit kerupukmu. Jawaban beruntun menambah gigitan,
              jawaban salah membuat kerupuk tertiup angin. Siapa yang lebih dulu menghabiskan{' '}
              <strong className="text-[#0f3d2e]">{targetKerupuk} pt</strong> kerupuk sampai ludes,
              dialah pemenangnya!
            </p>

            {/* Pemilihan Mode: Lawan Bot vs Lawan Teman (PvP) */}
            <div className="flex justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setModeTanding('bot')}
                className={`px-5 py-2 rounded-full font-extrabold text-sm border-2 transition-all cursor-pointer ${
                  modeTanding === 'bot'
                    ? 'bg-[#0f3d2e] text-white border-[#0f3d2e]'
                    : 'bg-white text-[#0f3d2e] border-[#e6d3ae] hover:bg-[#f6ead4]'
                }`}
              >
                Lawan Bot
              </button>
              <button
                type="button"
                onClick={() => setModeTanding('pvp')}
                className={`px-5 py-2 rounded-full font-extrabold text-sm border-2 transition-all cursor-pointer ${
                  modeTanding === 'pvp'
                    ? 'bg-[#0f3d2e] text-white border-[#0f3d2e]'
                    : 'bg-white text-[#0f3d2e] border-[#e6d3ae] hover:bg-[#f6ead4]'
                }`}
              >
                Lawan Teman (1 Layar)
              </button>
            </div>

            {/* Tingkat Kesulitan Bot */}
            {modeTanding === 'bot' && (
              <div className="flex justify-center gap-2 flex-wrap pt-1">
                {BOT_DIFFICULTIES.map((d, idx) => (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => setBotLevel(idx)}
                    className={`px-4 py-1.5 rounded-full font-extrabold text-xs border-2 transition-all cursor-pointer ${
                      botLevel === idx
                        ? 'bg-[#0f3d2e] text-white border-[#0f3d2e]'
                        : 'bg-white text-[#0f3d2e] border-[#e6d3ae] hover:bg-[#f6ead4]'
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}

            {/* Hint Teks Kontrol */}
            <p className="text-xs text-[#6d7a6f] max-w-lg mx-auto">
              {modeTanding === 'bot' ? (
                <>
                  Jawab pertanyaan dengan cepat dan kumpulkan streak! Bot akan menjawab secara mandiri
                  sesuai tingkat kesulitan yang dipilih.
                </>
              ) : (
                <>
                  Satu layar berdua, soal tiap pemain berbeda dan acak.{' '}
                  <strong>Pemain 1:</strong> tombol A / B / C / D atau 1 / 2 / 3 / 4.{' '}
                  <strong>Pemain 2:</strong> tombol J / K / L / M atau 7 / 8 / 9 / 0 (atau ketuk
                  pilihan).
                </>
              )}
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleMulai}
                disabled={isActionLoading}
                className="px-10 py-3.5 rounded-2xl bg-[#e2312d] hover:bg-[#b81f1c] text-white font-extrabold text-base shadow-[0_5px_0_#b81f1c] active:translate-y-1 active:shadow-[0_1px_0_#b81f1c] transition-all cursor-pointer"
              >
                Mulai Lomba Sekarang
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: PLAYING & PAUSED (KARTU KUIS AKTIF) */}
        {isPlayOrPause && (
          <div className="space-y-6">
            {/* Kartu Soal Kuis */}
            <div className="bg-[#fffaf0] border-2 border-[#e6d3ae] rounded-3xl p-6 sm:p-8 shadow-sm">
              {sesi.soalSaatIni ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full bg-[#e2312d] text-white">
                      {modeTanding === 'bot' ? '' : `${p1Name} • `}SOAL #{p1.n || 1}
                    </span>
                    <span className="text-xs font-bold text-[#6d7a6f]">
                      Pintasan Keyboard: <strong>A, B, C, D</strong>
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-extrabold text-[#0f3d2e] my-4 leading-snug">
                    {sesi.soalSaatIni.teks}
                  </h3>

                  <div className="space-y-2.5 mt-4">
                    {sesi.soalSaatIni.pilihan.map((p, idx) => {
                      const isSelected = selectedChoiceP1 === p.choiceId;
                      const isResultMatch = choiceResultP1?.choiceId === p.choiceId;
                      const optClass = isResultMatch
                        ? choiceResultP1?.ok
                          ? 'ok'
                          : 'no'
                        : isSelected
                        ? 'border-[#e2312d] bg-[#fdf5f5]'
                        : '';

                      return (
                        <button
                          key={p.choiceId}
                          type="button"
                          disabled={isSubmitting || sesi.state === 'PAUSED'}
                          onClick={() => handleJawabP1(p.choiceId)}
                          className={`kp-op ${optClass}`}
                        >
                          <b>{['A', 'B', 'C', 'D', 'E'][idx]}</b>
                          <span className="text-sm sm:text-base font-extrabold text-left flex-1">
                            {p.teks}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm font-bold text-[#6d7a6f]">Menyiapkan pertanyaan berikutnya...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: FINISHED / END CARD (HASIL LOMBA) */}
        {isFinished && (
          <div className="bg-[#fffaf0] border-2 border-[#e6d3ae] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="text-center space-y-1">
              <span className="inline-block px-3 py-1 rounded-full bg-[#ffe9a8] text-[#7a5200] text-xs font-extrabold uppercase">
                {winnerIdx < 0 ? 'Hasil Imbang' : 'Kerupuk Ludes!'}
              </span>
              <h2 className="text-3xl font-extrabold text-[#0f3d2e]">
                {winnerIdx < 0
                  ? 'Pertandingan Seri!'
                  : winnerIdx === 0
                  ? `${p1Name} Menang!`
                  : `${p2Name} Menang!`}
              </h2>
              <p className="text-sm text-[#6d7a6f]">
                {winnerIdx >= 0
                  ? `${winnerIdx === 0 ? p1Name : p2Name} berhasil menghabiskan seluruh kerupuk ${targetKerupuk} pt terlebih dahulu!`
                  : 'Kedua pemain selesai dengan perolehan kerupuk seimbang.'}
              </p>
            </div>

            {/* Kolom Perbandingan Skor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Kolom Pemain 1 */}
              <div
                className={`p-5 rounded-2xl border-3 ${
                  winnerIdx === 0
                    ? 'border-[#e2312d] bg-red-50/60 shadow-md'
                    : 'border-[#e6d3ae] bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="px-3 py-1 rounded-full bg-[#e2312d] text-white font-extrabold text-xs">
                    {p1Name}
                  </span>
                  {winnerIdx === 0 && (
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      ★ Juara 1
                    </span>
                  )}
                </div>
                <div className="text-3xl font-extrabold text-[#0f3d2e] my-1 font-mono">
                  {p1.eaten} pt
                </div>
                <ul className="text-xs text-[#6d7a6f] space-y-2 mt-3 pt-3 border-t border-[#e6d3ae]">
                  <li className="flex justify-between">
                    <span>Benar / Salah:</span>
                    <strong className="text-[#0f3d2e]">
                      {p1.c} / {p1.w}
                    </strong>
                  </li>
                  <li className="flex justify-between">
                    <span>Akurasi:</span>
                    <strong className="text-[#0f3d2e]">
                      {p1.c + p1.w > 0 ? Math.round((p1.c / (p1.c + p1.w)) * 100) : 0}%
                    </strong>
                  </li>
                  <li className="flex justify-between">
                    <span>Streak Terbaik:</span>
                    <strong className="text-[#0f3d2e]">{p1.best}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span>Kerupuk Dimakan:</span>
                    <strong className="text-[#e2312d]">
                      {Math.min(100, Math.round((p1.eaten / targetKerupuk) * 100))}%
                    </strong>
                  </li>
                </ul>
              </div>

              {/* Kolom Pemain 2 / Bot AI */}
              <div
                className={`p-5 rounded-2xl border-3 ${
                  winnerIdx === 1
                    ? 'border-[#1d8fe0] bg-sky-50/60 shadow-md'
                    : 'border-[#e6d3ae] bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="px-3 py-1 rounded-full bg-[#1d8fe0] text-white font-extrabold text-xs">
                    {p2Name}
                  </span>
                  {winnerIdx === 1 && (
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      ★ Juara 1
                    </span>
                  )}
                </div>
                <div className="text-3xl font-extrabold text-[#0f3d2e] my-1 font-mono">
                  {p2.eaten} pt
                </div>
                <ul className="text-xs text-[#6d7a6f] space-y-2 mt-3 pt-3 border-t border-[#e6d3ae]">
                  <li className="flex justify-between">
                    <span>Benar / Salah:</span>
                    <strong className="text-[#0f3d2e]">
                      {p2.c} / {p2.w}
                    </strong>
                  </li>
                  <li className="flex justify-between">
                    <span>Akurasi:</span>
                    <strong className="text-[#0f3d2e]">
                      {p2.c + p2.w > 0 ? Math.round((p2.c / (p2.c + p2.w)) * 100) : 0}%
                    </strong>
                  </li>
                  <li className="flex justify-between">
                    <span>Streak Terbaik:</span>
                    <strong className="text-[#0f3d2e]">{p2.best}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span>Kerupuk Dimakan:</span>
                    <strong className="text-[#1d8fe0]">
                      {Math.min(100, Math.round((p2.eaten / targetKerupuk) * 100))}%
                    </strong>
                  </li>
                </ul>
              </div>
            </div>

            <div className="text-center text-xs font-bold text-[#6d7a6f]">
              Waktu Pertandingan: <strong>{formatWaktu(elapsedSec)}</strong>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleMainLagi}
                disabled={isActionLoading}
                className="px-6 py-2.5 rounded-xl bg-[#1f9d55] text-white font-extrabold text-sm shadow-[0_4px_0_#14703c] cursor-pointer"
              >
                Main Lagi
              </button>
              <button
                type="button"
                onClick={() => navigate(returnUrl)}
                className="px-6 py-2.5 rounded-xl bg-[#ffb81c] text-[#4a3000] font-extrabold text-sm shadow-[0_4px_0_#c98a00] cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        )}

        {/* PAPAN SKOR REAL-TIME (Tampil di semua fase) */}
        <div className="bg-[#fffaf0] border-2 border-[#e6d3ae] rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between text-xs font-extrabold text-[#6d7a6f]">
            <span>PAPAN SKOR</span>
            <strong className="text-[#0f3d2e]">Target {targetKerupuk} pt</strong>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Box Skor Pemain 1 */}
            <div className="p-4 rounded-2xl border-2 border-[#e2312d] bg-red-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-3 py-0.5 rounded-full bg-[#e2312d] text-white font-extrabold text-xs">
                  {p1Name}
                </span>
                <strong className="font-mono text-xl font-extrabold text-[#0f3d2e]">
                  {p1.eaten} pt
                </strong>
              </div>
              <div className="text-xs text-[#6d7a6f]">
                Benar {p1.c} • Salah {p1.w} • Streak {p1.streak}
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#e6d3ae] overflow-hidden">
                <div
                  className="h-full bg-[#e2312d] transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((p1.eaten / targetKerupuk) * 100))}%`,
                  }}
                />
              </div>
              <div className="text-[11px] font-bold text-[#6d7a6f]">
                Dimakan {Math.min(100, Math.round((p1.eaten / targetKerupuk) * 100))}%
              </div>
            </div>

            {/* Box Skor Pemain 2 / Bot AI */}
            <div className="p-4 rounded-2xl border-2 border-[#1d8fe0] bg-sky-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-3 py-0.5 rounded-full bg-[#1d8fe0] text-white font-extrabold text-xs">
                  {p2Name}
                </span>
                <strong className="font-mono text-xl font-extrabold text-[#0f3d2e]">
                  {p2.eaten} pt
                </strong>
              </div>
              <div className="text-xs text-[#6d7a6f]">
                Benar {p2.c} • Salah {p2.w} • Streak {p2.streak}
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#e6d3ae] overflow-hidden">
                <div
                  className="h-full bg-[#1d8fe0] transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((p2.eaten / targetKerupuk) * 100))}%`,
                  }}
                />
              </div>
              <div className="text-[11px] font-bold text-[#6d7a6f]">
                Dimakan {Math.min(100, Math.round((p2.eaten / targetKerupuk) * 100))}%
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Hentikan Permainan */}
      <Modal
        isOpen={modalHentikanOpen}
        onClose={() => setModalHentikanOpen(false)}
        title="Hentikan Permainan?"
        maxWidth="sm"
      >
        <div className="space-y-4 text-[#0f3d2e]">
          <p className="text-sm">
            Apakah Anda yakin ingin menghentikan sesi Makan Kerupuk sekarang? Sesi akan ditutup dan
            skor saat ini disimpan.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#e6d3ae]">
            <button
              type="button"
              onClick={() => setModalHentikanOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#e6d3ae] text-xs font-bold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleKonfirmasiHentikan}
              disabled={isActionLoading}
              className="px-4 py-2 rounded-xl bg-[#e2312d] text-white text-xs font-bold cursor-pointer"
            >
              {isActionLoading ? 'Menghentikan...' : 'Ya, Hentikan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Keluar saat Permainan Sedang Berlangsung */}
      <ModalKonfirmasiKeluar
        isOpen={modalKeluarOpen}
        onClose={() => setModalKeluarOpen(false)}
        onKonfirmasiKeluar={handleKonfirmasiKeluar}
        judulGame="Makan Kerupuk Solo"
      />
    </div>
  );
}
