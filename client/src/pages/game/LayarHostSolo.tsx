import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import { soundEffects } from '../../lib/soundEffects';
import { extractApiErrorMessage, resolveGuruReturnUrl } from '../../components';
import {
  TarikActionPulse,
  TarikTambangStadium,
} from '../../components/TarikTambangStadium';
import { Bot, CheckCircle2, Flame, Loader2, Play, RotateCcw, Settings2, Sparkles, Trophy, Users, XCircle } from 'lucide-react';

interface PilihanSoalClient {
  choiceId: string;
  label: 'A' | 'B' | 'C' | 'D' | 'E';
  teks: string;
}

interface SoalTarikClient {
  presentationId: string;
  id: string;
  questionId: string;
  nomorSoal?: number;
  kesulitan: 'mudah' | 'sedang' | 'sulit';
  teks: string;
  pilihan: PilihanSoalClient[];
}

interface PemainSoloClient {
  tim: 'merah' | 'putih';
  nama: string;
  isBot: boolean;
  totalBenar: number;
  totalSalah: number;
  totalDijawab: number;
  akurasiPersen: number;
  streakSaatIni: number;
  streakTertinggi: number;
  soalAktif: SoalTarikClient | null;
}

interface FeedbackSolo {
  tim: 'merah' | 'putih';
  nama: string;
  benar: boolean;
  timedOut: boolean;
  slipQuote: string | null;
  jawabanBenarKode: string;
  jawabanBenarTeks: string;
  penjelasan: string | null;
  posisiSebelum: number;
  posisiBaru: number;
  deltaTali: number;
  streakSaatIni: number;
  bonusStreakDidapat: number;
  selesaiBaru: boolean;
}

interface LaporanSoloClient {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  alasanSelesai?: 'garis_menang' | 'waktu_habis' | 'manual';
  timMenang: 'merah' | 'putih' | 'seri';
  namaTim1: string;
  namaTim2: string;
  posisiAkhir: number;
  skorMerah: number;
  skorPutih: number;
  totalSoalDijawab: number;
  akurasiTim1Persen: number;
  akurasiTim2Persen: number;
  pemain1Stat?: {
    nama: string;
    isBot: boolean;
    totalBenar: number;
    totalSalah: number;
    akurasiPersen: number;
    streakTertinggi: number;
  };
  pemain2Stat?: {
    nama: string;
    isBot: boolean;
    totalBenar: number;
    totalSalah: number;
    akurasiPersen: number;
    streakTertinggi: number;
  };
  questionStats?: Array<{
    questionId: string;
    nomorSoal: number;
    teksSoal: string;
    jumlahBenar: number;
    jumlahSalah: number;
  }>;
}

interface SesiSoloPayload {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  state: 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED';
  config: {
    durasiLombaDetik: number;
    tarikBenarSolo: number;
    mundurSalahSolo: number;
    tipeLawanSolo: 'lokal' | 'bot';
    kesulitanBot: 'mudah' | 'sedang' | 'sulit';
    namaTim1: string;
    namaTim2: string;
    batasMenang: number;
    bonusAktif: boolean;
    powerUpAktif: boolean;
  };
  taliPosition: number;
  skorMerah: number;
  skorPutih: number;
  durasiLombaDetik: number;
  sisaWaktuDetik: number;
  matchEndsAt: number | null;
  pemain1: PemainSoloClient;
  pemain2: PemainSoloClient;
  powerUpTim1?: { bank: string | null; aktifBerikutnya: string | null };
  powerUpTim2?: { bank: string | null; aktifBerikutnya: string | null };
  isFinished: boolean;
  hasil: LaporanSoloClient | null;
}

interface SideRevealState {
  presentationId: string;
  chosenChoiceId: string | null;
  benar: boolean;
  message: string;
}

const BOT_DELAY_RANGE: Record<'mudah' | 'sedang' | 'sulit', [number, number]> = {
  mudah: [3500, 6500],
  sedang: [2800, 5200],
  sulit: [2200, 4200],
};

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export default function LayarHostSolo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = resolveGuruReturnUrl(searchParams.get('kembali'));

  const [sesi, setSesi] = useState<SesiSoloPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const [sisaDetik, setSisaDetik] = useState<number>(180);
  const [muted, setMuted] = useState<boolean>(() => soundEffects.getMuted());
  const [actionPulse, setActionPulse] = useState<TarikActionPulse | null>(null);

  const [revealLeft, setRevealLeft] = useState<SideRevealState | null>(null);
  const [revealRight, setRevealRight] = useState<SideRevealState | null>(null);
  const [frozenLeftQuestion, setFrozenLeftQuestion] = useState<SoalTarikClient | null>(null);
  const [frozenRightQuestion, setFrozenRightQuestion] = useState<SoalTarikClient | null>(null);

  const leftTimerRef = useRef<number | null>(null);
  const rightTimerRef = useRef<number | null>(null);
  const botTimerRef = useRef<number | null>(null);
  const expiryCalledRef = useRef<boolean>(false);
  const fanfarePlayedRef = useRef<boolean>(false);

  const triggerSideReveal = useCallback(
    (
      side: 'merah' | 'putih',
      prevQuestion: SoalTarikClient | null,
      chosenChoiceId: string | null,
      fb: FeedbackSolo
    ) => {
      const msg = fb.benar
        ? `Benar! ${fb.tim === 'merah' ? `+${Math.abs(fb.deltaTali)}` : `+${Math.abs(fb.deltaTali)}`}${
            fb.bonusStreakDidapat > 0 ? ` (+${fb.bonusStreakDidapat} streak)` : ''
          }`
        : `Salah! ${fb.slipQuote || 'Terpeleset!'} • Kunci: ${fb.jawabanBenarKode}`;

      if (side === 'merah') {
        if (leftTimerRef.current) window.clearTimeout(leftTimerRef.current);
        setFrozenLeftQuestion(prevQuestion);
        setRevealLeft({
          presentationId: prevQuestion?.presentationId || '',
          chosenChoiceId,
          benar: fb.benar,
          message: msg,
        });
        leftTimerRef.current = window.setTimeout(() => {
          setFrozenLeftQuestion(null);
          setRevealLeft(null);
        }, 850);
      } else {
        if (rightTimerRef.current) window.clearTimeout(rightTimerRef.current);
        setFrozenRightQuestion(prevQuestion);
        setRevealRight({
          presentationId: prevQuestion?.presentationId || '',
          chosenChoiceId,
          benar: fb.benar,
          message: msg,
        });
        rightTimerRef.current = window.setTimeout(() => {
          setFrozenRightQuestion(null);
          setRevealRight(null);
        }, 850);
      }

      const oppositeSide = side === 'merah' ? 'r' : 'l';
      setActionPulse({
        id: `${Date.now()}-${Math.random()}`,
        side: side === 'merah' ? 'l' : 'r',
        kind: fb.benar ? 'heave' : 'slip',
        pullerIdx: 0,
        bubble: fb.benar ? 'TARIK!' : fb.slipQuote || 'ADUH!',
      });
      if (fb.benar) {
        window.setTimeout(() => {
          setActionPulse((prev) =>
            prev?.side === oppositeSide
              ? prev
              : {
                  id: `${Date.now()}-jerk`,
                  side: oppositeSide,
                  kind: 'jerk',
                  pullerIdx: 0,
                  bubble: null,
                }
          );
        }, 90);
      }
    },
    []
  );

  const loadSesi = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setErrorPesan(null);
      const res = await apiRequest<{ session: SesiSoloPayload }>(`/sesi/${id}`);
      setSesi(res.session);
      setSisaDetik(res.session.sisaWaktuDetik ?? res.session.durasiLombaDetik ?? 180);
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal memuat arena Solo Tarik Tambang.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadSesi();
    return () => {
      if (leftTimerRef.current) window.clearTimeout(leftTimerRef.current);
      if (rightTimerRef.current) window.clearTimeout(rightTimerRef.current);
      if (botTimerRef.current) window.clearTimeout(botTimerRef.current);
    };
  }, [loadSesi]);

  // Victory sound trigger
  useEffect(() => {
    if (sesi?.state === 'FINISHED' && !fanfarePlayedRef.current) {
      fanfarePlayedRef.current = true;
      soundEffects.playVictoryFanfare();
    } else if (sesi?.state !== 'FINISHED') {
      fanfarePlayedRef.current = false;
    }
  }, [sesi?.state]);

  // Countdown Jam Lomba (3:00 -> 0:00)
  useEffect(() => {
    if (!sesi) return;
    setSisaDetik(sesi.sisaWaktuDetik);
    if (sesi.state !== 'PLAYING' || !sesi.matchEndsAt) {
      return;
    }

    expiryCalledRef.current = false;
    const endAt = sesi.matchEndsAt;
    const iv = window.setInterval(() => {
      const rem = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setSisaDetik(rem);
      if (rem <= 0 && !expiryCalledRef.current && id) {
        expiryCalledRef.current = true;
        apiRequest<{ session: SesiSoloPayload }>(`/sesi/${id}/tutup-ronde`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
          .then((res) => {
            if (res.session) setSesi(res.session);
          })
          .catch(() => {});
      }
    }, 250);

    return () => window.clearInterval(iv);
  }, [sesi?.state, sesi?.matchEndsAt, id]);

  // Bot AI Autonomous Step Scheduler
  useEffect(() => {
    if (!id || !sesi) return;
    if (
      sesi.state !== 'PLAYING' ||
      sesi.config.tipeLawanSolo !== 'bot' ||
      !sesi.pemain2.soalAktif ||
      Boolean(revealRight)
    ) {
      return;
    }

    const [minMs, maxMs] =
      BOT_DELAY_RANGE[sesi.config.kesulitanBot] || BOT_DELAY_RANGE.sedang;
    const delayMs = minMs + Math.floor(Math.random() * (maxMs - minMs));
    const currentRightQ = sesi.pemain2.soalAktif;

    botTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await apiRequest<{
          executed: boolean;
          chosenChoiceId: string | null;
          feedback: FeedbackSolo | null;
          session: SesiSoloPayload;
        }>(`/sesi/${id}/bot-langkah`, {
          method: 'POST',
          body: JSON.stringify({}),
        });

        if (res.executed && res.feedback) {
          if (res.feedback.benar) {
            soundEffects.playRopeTug();
          } else {
            soundEffects.playIncorrect();
          }
          triggerSideReveal('putih', currentRightQ, res.chosenChoiceId, res.feedback);
        }
        if (res.session) {
          setSesi(res.session);
        }
      } catch {
        // Ignore transient poll error if session ended concurrently
      }
    }, delayMs);

    return () => {
      if (botTimerRef.current) window.clearTimeout(botTimerRef.current);
    };
  }, [
    id,
    sesi?.state,
    sesi?.config.tipeLawanSolo,
    sesi?.config.kesulitanBot,
    sesi?.pemain2.soalAktif?.presentationId,
    Boolean(revealRight),
    triggerSideReveal,
  ]);

  const handleMulaiLomba = async () => {
    if (!id || busyAction) return;
    try {
      setBusyAction(true);
      soundEffects.playWhistle();
      const res = await apiRequest<{ session: SesiSoloPayload }>(`/sesi/${id}/mulai`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSesi(res.session);
      setSisaDetik(res.session.sisaWaktuDetik);
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal memulai pertandingan Solo.'));
    } finally {
      setBusyAction(false);
    }
  };

  const handleTogglePause = async () => {
    if (!id || !sesi || busyAction) return;
    const targetState = sesi.state === 'PAUSED' ? 'PLAYING' : 'PAUSED';
    try {
      setBusyAction(true);
      const res = await apiRequest<{ session: SesiSoloPayload }>(`/sesi/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({ state: targetState }),
      });
      setSesi(res.session);
      setSisaDetik(res.session.sisaWaktuDetik);
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal mengubah status jeda.'));
    } finally {
      setBusyAction(false);
    }
  };

  const handleAkhiriManual = async () => {
    if (!id || !sesi || busyAction) return;
    try {
      setBusyAction(true);
      const res = await apiRequest<{ session: SesiSoloPayload }>(`/sesi/${id}/selesai`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSesi(res.session);
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal mengakhiri pertandingan.'));
    } finally {
      setBusyAction(false);
    }
  };

  const handleUlang = async () => {
    if (!id || busyAction) return;
    try {
      setBusyAction(true);
      setRevealLeft(null);
      setRevealRight(null);
      setFrozenLeftQuestion(null);
      setFrozenRightQuestion(null);
      if (sesi?.state === 'FINISHED') {
        fanfarePlayedRef.current = false;
        const res = await apiRequest<{ sessionId: string }>(`/sesi/${id}/main-lagi`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        navigate(`/guru/sesi/${res.sessionId}?kembali=${encodeURIComponent(returnUrl)}`);
        return;
      }
      const res = await apiRequest<{ session: SesiSoloPayload }>(`/sesi/${id}/ulang`, {
        method: 'POST',
        body: JSON.stringify({ autoStart: false }),
      });
      setSesi(res.session);
      setSisaDetik(res.session.sisaWaktuDetik);
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal mereset arena permainan.'));
    } finally {
      setBusyAction(false);
    }
  };

  const handleJawab = async (tim: 'merah' | 'putih', choice: PilihanSoalClient) => {
    if (!id || !sesi || sesi.state !== 'PLAYING') return;
    if (tim === 'merah' && revealLeft) return;
    if (tim === 'putih' && (revealRight || sesi.pemain2.isBot)) return;

    const currentQ = tim === 'merah' ? sesi.pemain1.soalAktif : sesi.pemain2.soalAktif;
    if (!currentQ) return;

    try {
      const res = await apiRequest<{
        feedback: FeedbackSolo;
        session: SesiSoloPayload;
      }>(`/sesi/${id}/jawab`, {
        method: 'POST',
        body: JSON.stringify({
          tim,
          presentationId: currentQ.presentationId,
          choiceId: choice.choiceId,
        }),
      });

      if (res.feedback) {
        if (res.feedback.benar) {
          soundEffects.playCorrect();
          soundEffects.playRopeTug();
        } else {
          soundEffects.playIncorrect();
        }
        triggerSideReveal(tim, currentQ, choice.choiceId, res.feedback);
      }
      if (res.session) {
        setSesi(res.session);
      }
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal mengirim jawaban.'));
    }
  };

  const handlePakaiPowerUp = async (tim: 'merah' | 'putih') => {
    if (!id || !sesi || sesi.state !== 'PLAYING') return;
    try {
      const res = await apiRequest<{ session: SesiSoloPayload }>(`/sesi/${id}/powerup`, {
        method: 'POST',
        body: JSON.stringify({ tim }),
      });
      setSesi(res.session);
    } catch {
      // ignore if empty
    }
  };

  const handleToggleMute = () => {
    const nextMuted = soundEffects.toggleMute();
    setMuted(nextMuted);
  };

  if (loading) {
    return (
      <div className="tt-festival flex items-center justify-center min-h-screen p-6 text-center">
        <div className="tt-panel max-w-md w-full flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-[#e2312d]" />
          <h2 className="text-xl text-[#2b2a4a]">Menyiapkan Arena Tarik Tambang...</h2>
        </div>
      </div>
    );
  }

  if (!sesi) {
    return (
      <div className="tt-festival flex items-center justify-center min-h-screen p-6 text-center">
        <div className="tt-panel max-w-md w-full space-y-4">
          <h2 className="text-xl text-[#e2312d]">Sesi Tidak Tersedia</h2>
          <p className="text-sm text-[#6b6a85]">{errorPesan || 'Sesi tidak ditemukan.'}</p>
          <button type="button" onClick={() => navigate(returnUrl)} className="tt-btn">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const isPlaying = sesi.state === 'PLAYING';
  const isPaused = sesi.state === 'PAUSED';
  const isFinished = sesi.state === 'FINISHED';
  const winnerSide = isFinished ? sesi.hasil?.timMenang || 'seri' : null;
  const namaTim1 = sesi.config.namaTim1 || sesi.pemain1.nama;
  const namaTim2 = sesi.config.namaTim2 || sesi.pemain2.nama;

  const renderDuelCard = (
    side: 'merah' | 'putih',
    pemain: PemainSoloClient,
    frozenQ: SoalTarikClient | null,
    reveal: SideRevealState | null,
    powerUp?: { bank: string | null; aktifBerikutnya: string | null }
  ) => {
    const activeQ = frozenQ || pemain.soalAktif;
    const accent = side === 'merah' ? '#e2312d' : '#1d8fe0';
    const isBotCard = side === 'putih' && pemain.isBot;
    const cardDisabled =
      !isPlaying || Boolean(reveal) || !activeQ;

    return (
      <div
        className={`tt-tp ${cardDisabled && !isBotCard ? 'dis' : ''} ${
          isBotCard ? 'nop' : ''
        }`}
        style={{ ['--c' as any]: accent }}
      >
        <div className="tt-th">
          <span className="flex items-center gap-1.5">
            {isBotCard ? <Bot className="w-4 h-4" /> : <Users className="w-4 h-4" />}
            {pemain.nama}
          </span>
          <div className="flex items-center gap-1.5">
            {pemain.streakSaatIni >= 2 && (
              <span className="tt-chip gold flex items-center gap-1 text-xs">
                <Flame className="w-3 h-3" /> {pemain.streakSaatIni}x
              </span>
            )}
            {sesi.config.powerUpAktif && !isBotCard && powerUp?.bank && (
              <button
                type="button"
                onClick={() => handlePakaiPowerUp(side)}
                className="tt-btn y sm"
              >
                <Sparkles className="w-3.5 h-3.5" /> Pakai Power-Up
              </button>
            )}
            <span className="text-xs font-extrabold text-[#6b6a85]">
              {pemain.totalBenar} Benar
            </span>
          </div>
        </div>

        {activeQ ? (
          <>
            <div className="tt-q">{activeQ.teks}</div>
            <div>
              {activeQ.pilihan.map((opt) => {
                let stateClass = '';
                if (reveal && reveal.chosenChoiceId === opt.choiceId) {
                  stateClass = reveal.benar ? 'ok' : 'no';
                }
                return (
                  <button
                    key={opt.choiceId}
                    type="button"
                    disabled={cardDisabled || isBotCard}
                    onClick={() => handleJawab(side, opt)}
                    className={`tt-op ${stateClass}`}
                    style={{ ['--c' as any]: accent }}
                  >
                    <b>{opt.label}</b>
                    <span>{opt.teks}</span>
                  </button>
                );
              })}
            </div>
            <div
              className="tt-fb"
              style={{
                color: reveal ? (reveal.benar ? '#1f9d55' : '#d63b3b') : '#6b6a85',
              }}
            >
              {reveal
                ? reveal.message
                : isBotCard && isPlaying
                  ? 'Bot sedang berpikir menghitung jawaban...'
                  : ''}
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-sm text-[#6b6a85]">
            Menyiapkan soal berikutnya...
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tt-festival">
      <TarikTambangStadium
        title={sesi.templateJudul || 'Tarik Tambang Kuis'}
        subtitle="SOLO MODE • 1 VS 1"
        modeChip={
          sesi.config.tipeLawanSolo === 'bot'
            ? 'Solo vs Bot AI'
            : 'Duel 2 Pemain Lokal'
        }
        statusLabel={
          sesi.state === 'READY'
            ? 'SIAP'
            : sesi.state === 'PLAYING'
              ? 'BERLANGSUNG'
              : sesi.state === 'PAUSED'
                ? 'DIJEDA'
                : 'SELESAI'
        }
        timeText={formatClock(sisaDetik)}
        timeWarning={isPlaying && sisaDetik <= 15}
        taliPosition={sesi.taliPosition}
        batasMenang={sesi.config.batasMenang}
        namaTim1={namaTim1}
        namaTim2={namaTim2}
        skorMerah={sesi.skorMerah}
        skorPutih={sesi.skorPutih}
        leftPullerCount={1}
        rightPullerCount={1}
        variant="solo"
        isPlaying={isPlaying}
        isPaused={isPaused}
        winnerSide={winnerSide}
        actionPulse={actionPulse}
        isMuted={muted}
        onToggleMute={handleToggleMute}
        onTogglePause={isPlaying || isPaused ? handleTogglePause : undefined}
        onStop={isPlaying || isPaused ? handleAkhiriManual : undefined}
        onBack={() => navigate(returnUrl)}
      />

      <main className="tt-wrap">
        {errorPesan && (
          <div className="tt-panel border-[#d63b3b] text-sm font-bold text-[#b81f1c] flex items-center justify-between gap-2">
            <span>{errorPesan}</span>
            <button type="button" onClick={() => setErrorPesan(null)} className="underline">
              Tutup
            </button>
          </div>
        )}

        {/* READY Screen */}
        {sesi.state === 'READY' && (
          <div className="tt-panel text-center space-y-4">
            <span className="tt-chip inline-block">
              Target ±{sesi.config.batasMenang} • Benar +{sesi.config.tarikBenarSolo} • Salah −
              {sesi.config.mundurSalahSolo}
            </span>
            <h2 className="text-2xl text-[#2b2a4a]">
              {namaTim1} vs {namaTim2}
            </h2>
            <p className="text-sm text-[#6b6a85] max-w-xl mx-auto">
              {sesi.config.tipeLawanSolo === 'bot'
                ? `Jawab soal secepat mungkin di sisi kiri untuk menarik tali melewati zona menang sebelum waktu ${formatClock(sesi.durasiLombaDetik)} habis!`
                : `Dua pemain langsung beradu cepat kiri vs kanan pada satu layar hingga garis kemenangan tercapai atau waktu ${formatClock(sesi.durasiLombaDetik)} habis!`}
            </p>
            <div>
              <button
                type="button"
                disabled={busyAction}
                onClick={handleMulaiLomba}
                className="tt-btn text-lg px-8 py-3"
              >
                <Play className="w-5 h-5" />
                Mulai lomba
              </button>
            </div>
          </div>
        )}

        {/* PLAYING / PAUSED Duel Cards */}
        {(isPlaying || isPaused) && (
          <>
            {isPaused && (
              <div className="tt-panel text-center space-y-2 border-[#ffb81c] bg-[#fff8dc]">
                <h2 className="text-xl text-[#7a5200]">Permainan Dijeda</h2>
                <p className="text-xs text-[#6b6a85]">
                  Jam lomba berhenti sementara. Tekan Lanjut untuk meneruskan tarik tambang.
                </p>
                <button type="button" onClick={handleTogglePause} className="tt-btn g sm">
                  <Play className="w-4 h-4" /> Lanjut Lomba
                </button>
              </div>
            )}

            <div className="tt-duel">
              {renderDuelCard('merah', sesi.pemain1, frozenLeftQuestion, revealLeft, sesi.powerUpTim1)}
              {renderDuelCard('putih', sesi.pemain2, frozenRightQuestion, revealRight, sesi.powerUpTim2)}
            </div>
          </>
        )}

        {/* FINISHED Result Panel */}
        {isFinished && (
          <div className="tt-panel space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="tt-chip gold inline-flex items-center gap-1.5 mb-2">
                  <Trophy className="w-3.5 h-3.5" />
                  {sesi.hasil?.alasanSelesai === 'garis_menang'
                    ? 'Menang Garis Batas'
                    : sesi.hasil?.alasanSelesai === 'waktu_habis'
                      ? 'Waktu Lomba Habis'
                      : 'Dihentikan Guru'}
                </span>
                <h2 className="text-2xl sm:text-3xl text-[#2b2a4a]">
                  {winnerSide === 'merah'
                    ? `${namaTim1} Memenangkan Lomba!`
                    : winnerSide === 'putih'
                      ? `${namaTim2} Memenangkan Lomba!`
                      : 'Pertandingan Berakhir Seri!'}
                </h2>
                <p className="text-sm text-[#6b6a85] mt-1">
                  Posisi akhir tali:{' '}
                  <strong>
                    {sesi.taliPosition > 0 ? `+${sesi.taliPosition}` : sesi.taliPosition}
                  </strong>{' '}
                  • Total {sesi.hasil?.totalSoalDijawab ?? 0} soal terjawab
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={handleUlang}
                  className="tt-btn sm"
                >
                  <RotateCcw className="w-4 h-4" /> Main lagi
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/guru/tarik-tambang?templateId=${encodeURIComponent(
                        sesi.templateId
                      )}&mode=solo&kembali=${encodeURIComponent(returnUrl)}`
                    )
                  }
                  className="tt-btn y sm"
                >
                  <Settings2 className="w-4 h-4" /> Ubah pengaturan
                </button>
                <button type="button" onClick={() => navigate(returnUrl)} className="tt-btn s sm">
                  Selesai
                </button>
              </div>
            </div>

            {/* Podium Perbandingan 2 Pemain */}
            <div className="tt-cards">
              <div className={`tt-rc ${winnerSide === 'merah' ? 'w' : ''}`}>
                <span className="tt-pl2">{winnerSide === 'merah' ? 'JUARA 1' : 'POSISI 2'}</span>
                <h3 className="text-lg text-[#e2312d] mt-1.5">{namaTim1}</h3>
                <div className="tt-big text-[#2b2a4a]">{sesi.pemain1.akurasiPersen}%</div>
                <small className="text-xs font-bold text-[#6b6a85]">Akurasi Jawaban</small>
                <ul className="tt-mt">
                  <li>
                    <span>Benar</span>
                    <strong className="text-[#1f9d55]">{sesi.pemain1.totalBenar}</strong>
                  </li>
                  <li>
                    <span>Salah</span>
                    <strong className="text-[#d63b3b]">{sesi.pemain1.totalSalah}</strong>
                  </li>
                  <li>
                    <span>Streak Tertinggi</span>
                    <strong>{sesi.pemain1.streakTertinggi}x</strong>
                  </li>
                </ul>
              </div>

              <div className={`tt-rc ${winnerSide === 'putih' ? 'w' : ''}`}>
                <span className="tt-pl2">{winnerSide === 'putih' ? 'JUARA 1' : 'POSISI 2'}</span>
                <h3 className="text-lg text-[#1d8fe0] mt-1.5">{namaTim2}</h3>
                <div className="tt-big text-[#2b2a4a]">{sesi.pemain2.akurasiPersen}%</div>
                <small className="text-xs font-bold text-[#6b6a85]">Akurasi Jawaban</small>
                <ul className="tt-mt">
                  <li>
                    <span>Benar</span>
                    <strong className="text-[#1f9d55]">{sesi.pemain2.totalBenar}</strong>
                  </li>
                  <li>
                    <span>Salah</span>
                    <strong className="text-[#d63b3b]">{sesi.pemain2.totalSalah}</strong>
                  </li>
                  <li>
                    <span>Streak Tertinggi</span>
                    <strong>{sesi.pemain2.streakTertinggi}x</strong>
                  </li>
                </ul>
              </div>
            </div>

            {/* Tabel Evaluasi Soal */}
            {sesi.hasil?.questionStats && sesi.hasil.questionStats.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-base text-[#2b2a4a]">Ringkasan Performa Soal</h3>
                <div className="overflow-x-auto border-2 border-[#f0dfb4] rounded-2xl bg-[#fffdf6]">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[#fff3d6] text-[#2b2a4a] font-extrabold">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Pertanyaan</th>
                        <th className="p-3 text-center">Benar</th>
                        <th className="p-3 text-center">Salah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sesi.hasil.questionStats.map((q) => (
                        <tr key={q.questionId} className="border-t border-[#f0dfb4]">
                          <td className="p-3 font-extrabold">{q.nomorSoal}</td>
                          <td className="p-3 font-semibold">{q.teksSoal}</td>
                          <td className="p-3 text-center font-extrabold text-[#1f9d55]">
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {q.jumlahBenar}
                            </span>
                          </td>
                          <td className="p-3 text-center font-extrabold text-[#d63b3b]">
                            <span className="inline-flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> {q.jumlahSalah}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
