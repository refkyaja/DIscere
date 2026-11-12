import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components';
import {
  BalapKarungStadium,
  BalapSackSvg,
  BalapLaneItem,
} from '../../components/BalapKarungStadium';
import { soundEffects } from '../../lib/soundEffects';
import {
  Play,
  RotateCcw,
  Trophy,
  Loader2,
  Bot,
  Swords,
  RefreshCw,
  CheckCircle2,
  Clock,
  Pause,
} from 'lucide-react';

type StateBalapSolo = 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED' | 'STOPPED';
type SlotPemain = 'pemain1' | 'pemain2';
type KesulitanBot = 'santai' | 'sedang' | 'cepat';

interface PilihanSoal {
  choiceId: string;
  key: 'A' | 'B' | 'C' | 'D' | 'E';
  teks: string;
}

interface SoalAktifSolo {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  totalSoalBank: number;
  teks: string;
  pilihan: PilihanSoal[];
  ditampilkanPadaMs?: number;
  waktuPerSoalDetik?: number;
}

interface PesertaBalapSolo {
  slot: SlotPemain;
  id: string;
  nama: string;
  isBot: boolean;
  jarak: number;
  targetJarak: number;
  keseimbangan: number;
  jumlahJatuh: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakSaatIni: number;
  streakTertinggi: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs: number | null;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  efekAktif?: {
    perisai: boolean;
    lompatanKuat: boolean;
    jalanBerlumpur: boolean;
  };
  soalAktif: SoalAktifSolo | null;
}

interface FeedbackAksi {
  slot: SlotPemain;
  nama: string;
  benar: boolean;
  timedOut?: boolean;
  stumbleQuote?: string | null;
  jawabanBenarKode: string;
  jawabanBenarTeks: string;
  penjelasan: string | null;
  jarakSebelum: number;
  jarakBaru: number;
  perubahanJarak: number;
  keseimbanganBaru: number;
  streakSaatIni: number;
  bonusStreakJarakDidapat?: number;
  bonusStreakKeseimbanganDidapat?: number;
  bonusLompatanKuatDidapat?: number;
  penaltiJalanBerlumpurDipakai?: number;
  terjatuh: boolean;
  penaltiJatuhJarak: number;
  perisaiDigunakan: boolean;
  rintanganBaru?: {
    id: string;
    tipe: string;
    judul: string;
    deskripsi: string;
    efekNilai: number;
    satuan: string;
  } | null;
  selesaiBaru: boolean;
}

interface SesiBalapSoloClient {
  sessionId: string;
  game: 'balap_karung';
  mode: 'solo';
  playMode: 'SOLO';
  templateId: string;
  templateJudul: string;
  state: StateBalapSolo;
  config: {
    presetJarak: string;
    targetJarak: number;
    waktuPerSoalDetik?: number;
    kesulitan: string;
    lompatBenar: number;
    turunSalah: number;
    keseimbanganAktif: boolean;
    bonusStreakAktif: boolean;
    rintanganAktif: boolean;
    tipeLawanSolo: 'bot' | 'lokal';
    kesulitanBot: KesulitanBot;
    namaPemain1: string;
    namaPemain2: string;
  };
  totalSoalBank: number;
  pemain1: PesertaBalapSolo;
  pemain2: PesertaBalapSolo;
  leaderboard: Array<PesertaBalapSolo & { peringkat: number }>;
  isFinished: boolean;
  hasil: {
    dihentikanManual?: boolean;
    totalJawabanBenar?: number;
    totalJawabanSalah?: number;
    questionStats?: Array<{
      questionId: string;
      nomorSoal?: number;
      teksSoal?: string;
      jumlahBenar?: number;
      jumlahSalah?: number;
    }>;
  } | null;
}

interface RevealState {
  soal: SoalAktifSolo;
  chosenChoiceId: string | null;
  feedback: FeedbackAksi;
}

const BOT_INTERVAL_MS: Record<KesulitanBot, number> = {
  santai: 4800,
  sedang: 4200,
  cepat: 3600,
};

const LABEL_STATE: Record<StateBalapSolo, { text: string; tone: 'idle' | 'live' | 'done' }> = {
  READY: { text: 'Siap dimulai', tone: 'idle' },
  PLAYING: { text: 'Berlangsung', tone: 'live' },
  PAUSED: { text: 'Dijeda', tone: 'idle' },
  FINISHED: { text: 'Selesai', tone: 'done' },
  STOPPED: { text: 'Selesai', tone: 'done' },
};

function formatDurasiDetik(ms?: number | null): string {
  if (!ms || ms <= 0) return '-';
  if (ms < 1000) return `${ms} md`;
  return `${(ms / 1000).toFixed(1)} dtk`;
}

export default function LayarHostBalapKarungSolo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('kembali') || '/guru';

  const [sesi, setSesi] = useState<SesiBalapSoloClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(soundEffects.getMuted());
  const [isMainLagi, setIsMainLagi] = useState(false);

  const [modalHentikanOpen, setModalHentikanOpen] = useState(false);
  const [modalUlangOpen, setModalUlangOpen] = useState(false);
  const [showEndCard, setShowEndCard] = useState(false);

  // Visual animasi lintasan per slot (strictly 1 vs 1)
  const [deltaMap, setDeltaMap] = useState<Record<SlotPemain, number | null>>({
    pemain1: null,
    pemain2: null,
  });
  const [jumpMap, setJumpMap] = useState<Record<SlotPemain, boolean>>({
    pemain1: false,
    pemain2: false,
  });
  const [hurtMap, setHurtMap] = useState<Record<SlotPemain, boolean>>({
    pemain1: false,
    pemain2: false,
  });
  const [sayMap, setSayMap] = useState<Record<SlotPemain, string | null>>({
    pemain1: null,
    pemain2: null,
  });
  const [crowdCheer, setCrowdCheer] = useState(false);

  // Hold soal & highlight benar/salah sesaat sebelum berganti soal berikutnya
  const [revealMap, setRevealMap] = useState<Record<SlotPemain, RevealState | null>>({
    pemain1: null,
    pemain2: null,
  });

  // Countdown timer soal untuk Pemain 1 (mode vs Bot)
  const [remainingMs, setRemainingMs] = useState<number>(15000);
  const timerRemainingRef = useRef<number>(15000);
  const timerLastPresentationRef = useRef<string | null>(null);

  const submitLockRef = useRef<Record<SlotPemain, boolean>>({
    pemain1: false,
    pemain2: false,
  });
  const botTickLockRef = useRef(false);
  const endRef = useRef<HTMLElement | null>(null);

  const timersRef = useRef<{
    pemain1: ReturnType<typeof setTimeout> | null;
    pemain2: ReturnType<typeof setTimeout> | null;
    reveal1: ReturnType<typeof setTimeout> | null;
    reveal2: ReturnType<typeof setTimeout> | null;
    cheer: ReturnType<typeof setTimeout> | null;
    endDelay: ReturnType<typeof setTimeout> | null;
  }>({
    pemain1: null,
    pemain2: null,
    reveal1: null,
    reveal2: null,
    cheer: null,
    endDelay: null,
  });

  const clearAllTimers = useCallback(() => {
    Object.keys(timersRef.current).forEach((k) => {
      const key = k as keyof typeof timersRef.current;
      const t = timersRef.current[key];
      if (t) {
        clearTimeout(t);
        timersRef.current[key] = null;
      }
    });
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const pulseCheer = useCallback(() => {
    setCrowdCheer(true);
    if (timersRef.current.cheer) clearTimeout(timersRef.current.cheer);
    timersRef.current.cheer = setTimeout(() => {
      setCrowdCheer(false);
    }, 1300);
  }, []);

  const triggerSlotVisual = useCallback(
    (fb: FeedbackAksi, playAudio: boolean) => {
      const slot = fb.slot;
      setDeltaMap((prev) => ({ ...prev, [slot]: fb.perubahanJarak }));

      if (fb.benar) {
        setJumpMap((prev) => ({ ...prev, [slot]: true }));
        setHurtMap((prev) => ({ ...prev, [slot]: false }));
        setSayMap((prev) => ({ ...prev, [slot]: null }));
      } else {
        setJumpMap((prev) => ({ ...prev, [slot]: false }));
        setHurtMap((prev) => ({ ...prev, [slot]: true }));
        setSayMap((prev) => ({
          ...prev,
          [slot]: fb.stumbleQuote || (fb.timedOut ? 'Waktu habis!' : 'Aduh!'),
        }));
      }

      pulseCheer();

      if (fb.selesaiBaru) {
        soundEffects.playVictoryFanfare();
      } else {
        soundEffects.playBalapKarungAction({
          benar: fb.benar,
          streakSaatIni: fb.streakSaatIni,
          isBoosted: Boolean(fb.bonusLompatanKuatDidapat || fb.bonusStreakJarakDidapat),
          terjatuh: fb.terjatuh,
          perisaiDigunakan: fb.perisaiDigunakan,
          isMud:
            (fb.penaltiJalanBerlumpurDipakai ?? 0) > 0 ||
            fb.rintanganBaru?.tipe === 'jalan_berlumpur',
          playAnswerChime: playAudio,
          playStumbleOnWrong: playAudio,
        });
      }

      if (timersRef.current[slot]) {
        clearTimeout(timersRef.current[slot]!);
      }
      if (!fb.selesaiBaru) {
        timersRef.current[slot] = setTimeout(() => {
          setDeltaMap((prev) => ({ ...prev, [slot]: null }));
          setJumpMap((prev) => ({ ...prev, [slot]: false }));
          setHurtMap((prev) => ({ ...prev, [slot]: false }));
          setSayMap((prev) => ({ ...prev, [slot]: null }));
        }, 1250);
      }

      if (fb.selesaiBaru) {
        if (timersRef.current.endDelay) clearTimeout(timersRef.current.endDelay);
        timersRef.current.endDelay = setTimeout(() => {
          setShowEndCard(true);
          endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 950);
      }
    },
    [pulseCheer]
  );

  const fetchSesi = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await apiRequest<{ session: SesiBalapSoloClient }>(`/sesi/${id}`);
      setSesi(res.session);
      if (res.session.state === 'FINISHED' || res.session.state === 'STOPPED') {
        setShowEndCard(true);
      }
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal memuat sesi Balap Karung Solo.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSesi();
  }, [fetchSesi]);

  // Penggerak otomatis Bot AI ketika mode Lawan Bot aktif & game berlangsung
  useEffect(() => {
    if (!id || !sesi) return;
    if (sesi.state !== 'PLAYING' || sesi.config.tipeLawanSolo !== 'bot' || sesi.isFinished) {
      return;
    }

    const intervalMs = BOT_INTERVAL_MS[sesi.config.kesulitanBot] || 4200;
    const timer = setInterval(async () => {
      if (botTickLockRef.current) return;
      botTickLockRef.current = true;
      try {
        const res = await apiRequest<{
          executed: boolean;
          feedback: FeedbackAksi | null;
          isFinished: boolean;
          session: SesiBalapSoloClient;
        }>(`/sesi/${id}/bot-langkah`, { method: 'POST' });

        if (res.session) {
          setSesi(res.session);
        }
        if (res.executed && res.feedback) {
          triggerSlotVisual(res.feedback, false);
        }
      } catch {
        // Abaikan tick gagal sementara
      } finally {
        botTickLockRef.current = false;
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    id,
    sesi?.state,
    sesi?.config?.tipeLawanSolo,
    sesi?.config?.kesulitanBot,
    sesi?.isFinished,
    triggerSlotVisual,
  ]);

  const submitJawabanSlot = useCallback(
    async (
      slot: SlotPemain,
      soal: SoalAktifSolo,
      payload: { choiceId: string } | { timedOut: true }
    ) => {
      if (!id || !sesi || sesi.state !== 'PLAYING') return;
      if (submitLockRef.current[slot]) return;

      submitLockRef.current[slot] = true;
      setActionError(null);

      try {
        const res = await apiRequest<{
          feedback: FeedbackAksi;
          isFinished: boolean;
          session: SesiBalapSoloClient;
        }>(`/sesi/${id}/jawab`, {
          method: 'POST',
          body: JSON.stringify({
            slot,
            presentationId: soal.presentationId,
            questionId: soal.questionId,
            ...payload,
          }),
        });

        setSesi(res.session);

        if (res.feedback) {
          const chosenChoiceId = 'choiceId' in payload ? payload.choiceId : null;
          setRevealMap((prev) => ({
            ...prev,
            [slot]: {
              soal,
              chosenChoiceId,
              feedback: res.feedback,
            },
          }));
          triggerSlotVisual(res.feedback, true);

          const revealKey = slot === 'pemain1' ? 'reveal1' : 'reveal2';
          if (timersRef.current[revealKey]) {
            clearTimeout(timersRef.current[revealKey]!);
          }
          timersRef.current[revealKey] = setTimeout(() => {
            setRevealMap((prev) => ({ ...prev, [slot]: null }));
          }, res.feedback.selesaiBaru ? 950 : 1200);
        }
      } catch (err: any) {
        setActionError(err.pesan || 'Gagal mengirim jawaban.');
      } finally {
        submitLockRef.current[slot] = false;
      }
    },
    [id, sesi, triggerSlotVisual]
  );

  // Sync & jalankan timer hitung mundur per soal untuk mode Solo vs Bot
  const timerSec = Math.max(5, sesi?.config?.waktuPerSoalDetik || 15);
  const p1PresentationId = sesi?.pemain1?.soalAktif?.presentationId || null;
  const isRevealingP1 = Boolean(revealMap.pemain1);
  const isPlaying = sesi?.state === 'PLAYING' && !sesi?.isFinished;
  const isVsBot = sesi?.config?.tipeLawanSolo === 'bot';

  useEffect(() => {
    if (!p1PresentationId) return;
    if (timerLastPresentationRef.current !== p1PresentationId) {
      timerLastPresentationRef.current = p1PresentationId;
      const fullMs = timerSec * 1000;
      timerRemainingRef.current = fullMs;
      setRemainingMs(fullMs);
    }
  }, [p1PresentationId, timerSec]);

  useEffect(() => {
    if (!isPlaying || !isVsBot || isRevealingP1 || !sesi?.pemain1?.soalAktif) {
      return;
    }

    const activeSoal = sesi.pemain1.soalAktif;
    let lastTick = performance.now();

    const interval = setInterval(() => {
      const now = performance.now();
      const delta = now - lastTick;
      lastTick = now;

      const nextMs = Math.max(0, timerRemainingRef.current - delta);
      timerRemainingRef.current = nextMs;
      setRemainingMs(nextMs);

      if (nextMs <= 0 && !submitLockRef.current.pemain1) {
        clearInterval(interval);
        submitJawabanSlot('pemain1', activeSoal, { timedOut: true });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, isVsBot, isRevealingP1, sesi?.pemain1?.soalAktif, submitJawabanSlot]);

  // Shortcut keyboard 1-5 atau A-E pada mode vs Bot
  useEffect(() => {
    if (!isPlaying || !isVsBot || isRevealingP1 || !sesi?.pemain1?.soalAktif) return;
    const soal = sesi.pemain1.soalAktif;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const upper = e.key.toUpperCase();
      let idx = -1;
      if (upper >= '1' && upper <= '5') idx = Number(upper) - 1;
      else if (upper >= 'A' && upper <= 'E') idx = upper.charCodeAt(0) - 65;
      if (idx >= 0 && idx < soal.pilihan.length) {
        e.preventDefault();
        submitJawabanSlot('pemain1', soal, { choiceId: soal.pilihan[idx].choiceId });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying, isVsBot, isRevealingP1, sesi?.pemain1?.soalAktif, submitJawabanSlot]);

  const handleMulai = async () => {
    if (!id || !sesi || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      setShowEndCard(false);
      setRevealMap({ pemain1: null, pemain2: null });
      setJumpMap({ pemain1: false, pemain2: false });
      setHurtMap({ pemain1: false, pemain2: false });
      setSayMap({ pemain1: null, pemain2: null });
      setDeltaMap({ pemain1: null, pemain2: null });
      timerLastPresentationRef.current = null;

      const res = await apiRequest<{ session: SesiBalapSoloClient }>(`/sesi/${id}/mulai`, {
        method: 'POST',
        body: JSON.stringify({ kesulitanBot: sesi.config.kesulitanBot }),
      });
      soundEffects.playRaceStart();
      pulseCheer();
      setSesi(res.session);
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal memulai lomba 1 vs 1.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleTogglePause = async () => {
    if (!id || !sesi || isActionLoading) return;
    if (sesi.state !== 'PLAYING' && sesi.state !== 'PAUSED') return;
    const targetState = sesi.state === 'PLAYING' ? 'PAUSED' : 'PLAYING';
    try {
      setIsActionLoading(true);
      setActionError(null);
      const res = await apiRequest<{ session: SesiBalapSoloClient }>(`/sesi/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({ state: targetState }),
      });
      setSesi(res.session);
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal mengubah jeda lomba.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUlang = async () => {
    if (!id || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      clearAllTimers();
      const res = await apiRequest<{ session: SesiBalapSoloClient }>(`/sesi/${id}/ulang`, {
        method: 'POST',
      });
      setModalUlangOpen(false);
      setShowEndCard(false);
      setRevealMap({ pemain1: null, pemain2: null });
      setDeltaMap({ pemain1: null, pemain2: null });
      setJumpMap({ pemain1: false, pemain2: false });
      setHurtMap({ pemain1: false, pemain2: false });
      setSayMap({ pemain1: null, pemain2: null });
      timerLastPresentationRef.current = null;
      setSesi(res.session);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal mengulang permainan.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleHentikan = async () => {
    if (!id || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      const res = await apiRequest<{ session: SesiBalapSoloClient }>(`/sesi/${id}/selesai`, {
        method: 'POST',
      });
      setModalHentikanOpen(false);
      soundEffects.playVictoryFanfare();
      setSesi(res.session);
      setShowEndCard(true);
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal menghentikan permainan.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMainLagi = async (autoStart = true) => {
    if (!id || isMainLagi) return;
    try {
      setIsMainLagi(true);
      const res = await apiRequest<{ sessionId?: string; session?: { id: string } }>(
        `/sesi/${id}/main-lagi`,
        {
          method: 'POST',
          body: JSON.stringify({ autoStart }),
        }
      );
      const nextId = res.session?.id || res.sessionId;
      if (nextId) {
        navigate(`/guru/sesi/${nextId}?kembali=${encodeURIComponent(returnUrl)}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal membuat sesi baru.');
    } finally {
      setIsMainLagi(false);
    }
  };

  const targetJarak = sesi?.config?.targetJarak || 100;
  const isFinished = sesi ? sesi.state === 'FINISHED' || sesi.state === 'STOPPED' : false;
  const juara1 = sesi?.leaderboard?.[0];
  const juara2 = sesi?.leaderboard?.[1];

  const lanes: BalapLaneItem[] = useMemo(() => {
    if (!sesi) return [];
    const buildLane = (p: PesertaBalapSolo, slot: SlotPemain, warna: string, shirt: string): BalapLaneItem => ({
      id: p.id,
      nama: p.nama,
      warna,
      shirtColor: shirt,
      meter: p.jarak,
      targetJarak,
      isWinner: isFinished && juara1?.id === p.id,
      isRunnerUp: isFinished && juara2?.id === p.id,
      isRunning: sesi.state === 'PLAYING' && !hurtMap[slot],
      isJumping: jumpMap[slot],
      isHurt: hurtMap[slot],
      sayBubble: sayMap[slot],
      deltaBadge: deltaMap[slot],
    });

    return [
      buildLane(sesi.pemain1, 'pemain1', '#e2312d', '#7a3fd0'),
      buildLane(sesi.pemain2, 'pemain2', '#1d8fe0', '#1d8fe0'),
    ];
  }, [sesi, targetJarak, isFinished, juara1?.id, juara2?.id, hurtMap, jumpMap, sayMap, deltaMap]);

  if (loading) {
    return (
      <div className="bk-festival flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-[#e2312d] mb-3" />
        <p className="font-extrabold text-[#2b2a4a]">Menyiapkan Lintasan 1 vs 1 Balap Karung...</p>
      </div>
    );
  }

  if (errorPesan || !sesi) {
    return (
      <div className="bk-festival flex items-center justify-center p-4">
        <div className="bk-card max-w-md w-full text-center space-y-4">
          <h2 className="bk-h text-2xl font-extrabold">Sesi Tidak Tersedia</h2>
          <p className="text-sm text-[#6b6a85]">{errorPesan || 'Sesi tidak ditemukan.'}</p>
          <button
            type="button"
            onClick={() => navigate(returnUrl)}
            className="bk-btn w-full justify-center"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const badge = LABEL_STATE[sesi.state];
  const isDuelLokal = sesi.config.tipeLawanSolo === 'lokal';
  const p1Reveal = revealMap.pemain1;
  const p2Reveal = revealMap.pemain2;
  const p1Soal = p1Reveal ? p1Reveal.soal : sesi.pemain1.soalAktif;
  const p2Soal = p2Reveal ? p2Reveal.soal : sesi.pemain2.soalAktif;
  const timerRatio = Math.max(0, Math.min(1, remainingMs / (timerSec * 1000)));
  const remainingSecDisplay = Math.max(0, Math.ceil(remainingMs / 1000));

  const renderFeedbackText = (fb: FeedbackAksi) => {
    const extras: string[] = [];
    if (fb.bonusStreakJarakDidapat) extras.push(`Streak +${fb.bonusStreakJarakDidapat} m`);
    if (fb.bonusLompatanKuatDidapat) extras.push(`Lompatan Kuat +${fb.bonusLompatanKuatDidapat} m`);
    if (fb.penaltiJalanBerlumpurDipakai) extras.push(`Lumpur −${fb.penaltiJalanBerlumpurDipakai} m`);
    if (fb.terjatuh) {
      extras.push(
        fb.perisaiDigunakan
          ? 'Perisai menahan jatuh!'
          : `Terjatuh −${fb.penaltiJatuhJarak} m`
      );
    }
    if (fb.rintanganBaru?.judul) extras.push(fb.rintanganBaru.judul);
    const suffix = extras.length > 0 ? ` (${extras.join(' · ')})` : '';

    if (fb.benar) {
      return `Benar! Karung melompat ${fb.perubahanJarak >= 0 ? '+' : '−'}${Math.abs(fb.perubahanJarak)} m${suffix}.`;
    }
    if (fb.timedOut) {
      return `Waktu habis, mundur ${Math.abs(fb.perubahanJarak)} m${suffix}. Jawaban: ${fb.jawabanBenarTeks}`;
    }
    return `Belum tepat, mundur ${Math.abs(fb.perubahanJarak)} m${suffix}. Jawaban: ${fb.jawabanBenarTeks}`;
  };

  const renderStatusBadges = (p: PesertaBalapSolo) => {
    if (
      !sesi.config.keseimbanganAktif &&
      !sesi.config.bonusStreakAktif &&
      !sesi.config.rintanganAktif
    ) {
      return null;
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold mb-2">
        {sesi.config.keseimbanganAktif && (
          <span className="px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800">
            Keseimbangan: {p.keseimbangan}%
          </span>
        )}
        {sesi.config.bonusStreakAktif && (
          <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800">
            Streak: {p.streakSaatIni}
          </span>
        )}
        {sesi.config.rintanganAktif && p.efekAktif?.perisai && (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
            Perisai Aktif
          </span>
        )}
        {sesi.config.rintanganAktif && p.efekAktif?.lompatanKuat && (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
            Lompatan Kuat Siap
          </span>
        )}
        {sesi.config.rintanganAktif && p.efekAktif?.jalanBerlumpur && (
          <span className="px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
            Jalan Berlumpur
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bk-festival">
      <BalapKarungStadium
        title="Balap Karung Kuis"
        subtitle={sesi.templateJudul}
        statusLabel={badge.text}
        statusTone={badge.tone}
        targetJarak={targetJarak}
        ruleSummary={`Benar +${sesi.config.lompatBenar} m • Salah −${sesi.config.turunSalah} m`}
        lanes={lanes}
        crowdCheer={crowdCheer || isFinished}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(soundEffects.toggleMute())}
        onBack={() => navigate(returnUrl)}
        isPaused={sesi.state === 'PAUSED'}
        onTogglePause={
          sesi.state === 'PLAYING' || sesi.state === 'PAUSED' ? handleTogglePause : undefined
        }
        onStop={
          sesi.state === 'PLAYING' || sesi.state === 'PAUSED'
            ? () => setModalHentikanOpen(true)
            : undefined
        }
      />

      <main className="bk-wrap">
        {actionError && (
          <div className="mt-4 p-3 rounded-2xl bg-[#fde0e0] border-2 border-[#f4b6b6] text-xs font-extrabold text-[#8a1f1f] flex items-center justify-between gap-2">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="underline cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* 1. PRE-START PANEL (READY) */}
        {sesi.state === 'READY' && (
          <section className="bk-card mt-4 text-center">
            <div className="flex items-center justify-center gap-6 mb-2">
              <div className="flex flex-col items-center">
                <BalapSackSvg shirtColor="#7a3fd0" className="w-[74px] h-auto" />
                <span className="bk-h font-extrabold text-sm text-[#e2312d] mt-1">
                  {sesi.pemain1.nama}
                </span>
              </div>
              <span className="bk-h text-3xl font-extrabold text-[#e2312d]">VS</span>
              <div className="flex flex-col items-center">
                <BalapSackSvg shirtColor="#1d8fe0" className="w-[74px] h-auto" />
                <span className="bk-h font-extrabold text-sm text-[#1d8fe0] mt-1">
                  {sesi.pemain2.nama}
                </span>
              </div>
            </div>

            <h2 className="bk-h text-2xl sm:text-3xl font-extrabold text-[#2b2a4a] mt-1">
              {isDuelLokal ? 'Siap duel lokal 1 vs 1?' : 'Siap duel 1 vs 1?'}
            </h2>
            <p className="text-sm text-[#6b6a85] max-w-[48ch] mx-auto mt-1 mb-5">
              Jawab kuis secepat dan setepat mungkin ({timerSec} detik per soal). Setiap jawaban
              benar melompatkan karung +{sesi.config.lompatBenar} m, salah −
              {sesi.config.turunSalah} m.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleMulai}
                disabled={isActionLoading}
                className="bk-btn"
              >
                <Play className="w-4 h-4 fill-current" />
                {isActionLoading ? 'Memulai...' : 'Mulai lomba'}
              </button>
            </div>
          </section>
        )}

        {/* 2A. PLAYING / PAUSED — MODE VS BOT (Layout bersih sesuai prototipe Solo) */}
        {(sesi.state === 'PLAYING' || sesi.state === 'PAUSED' || (isFinished && !showEndCard)) &&
          !isDuelLokal && (
            <section className="bk-card mt-4">
              {sesi.state === 'PAUSED' && (
                <div className="mb-3 px-4 py-2.5 rounded-2xl bg-[#fff3c4] border-2 border-[#f2c230] text-xs font-extrabold text-[#7a5200] flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5">
                    <Pause className="w-4 h-4" /> Perlombaan sedang dijeda sementara.
                  </span>
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="underline cursor-pointer"
                  >
                    Lanjutkan
                  </button>
                </div>
              )}

              {p1Soal ? (
                <>
                  <div className="flex items-center justify-between text-sm font-extrabold text-[#6b6a85] mb-2">
                    <span className="inline-flex items-center gap-2">
                      <span>Soal {p1Soal.nomorSoal}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#fff3d6] border border-[#f0dfb4] text-[#2b2a4a]">
                        Bank: {p1Soal.totalSoalBank} soal
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[#2b2a4a]">
                      <Clock className="w-4 h-4 text-[#ffb81c]" />
                      {remainingSecDisplay} detik
                    </span>
                  </div>

                  {renderStatusBadges(sesi.pemain1)}

                  <div className="bk-tbar">
                    <div
                      className="bk-tbar-fill"
                      style={{
                        transform: `scaleX(${timerRatio})`,
                        transition: 'none',
                      }}
                    />
                  </div>

                  <div className="bk-h text-xl sm:text-2xl font-extrabold text-[#2b2a4a] leading-snug max-w-[42ch] mb-4">
                    {p1Soal.teks}
                  </div>

                  <div className="bk-opts">
                    {p1Soal.pilihan.map((opt) => {
                      const locked = Boolean(p1Reveal) || sesi.state !== 'PLAYING';
                      const isCorrect =
                        p1Reveal && opt.key === p1Reveal.feedback.jawabanBenarKode;
                      const isWrongChosen =
                        p1Reveal &&
                        !p1Reveal.feedback.benar &&
                        p1Reveal.chosenChoiceId === opt.choiceId;

                      return (
                        <button
                          key={opt.choiceId}
                          type="button"
                          disabled={locked}
                          onClick={() =>
                            submitJawabanSlot('pemain1', p1Soal, { choiceId: opt.choiceId })
                          }
                          className={`bk-opt ${isCorrect ? 'ok' : isWrongChosen ? 'no' : ''}`}
                        >
                          <span className="bk-opt-k">{opt.key}</span>
                          <span className="leading-snug">{opt.teks}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div
                    className={`min-h-[1.7em] mt-3 bk-h text-base font-extrabold ${
                      p1Reveal
                        ? p1Reveal.feedback.benar
                          ? 'text-[#1f9d55]'
                          : 'text-[#d63b3b]'
                        : 'text-[#6b6a85]'
                    }`}
                    aria-live="polite"
                  >
                    {p1Reveal ? (
                      renderFeedbackText(p1Reveal.feedback)
                    ) : (
                      <span className="text-xs font-bold text-[#6b6a85]">
                        Tips: Tekan tombol opsi atau tombol keyboard A–{String.fromCharCode(64 + p1Soal.pilihan.length)}.
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-sm font-bold text-[#6b6a85]">
                  Menyiapkan pertanyaan berikutnya...
                </div>
              )}
            </section>
          )}

        {/* 2B. PLAYING / PAUSED — MODE DUEL LOKAL 2 PEMAIN (KIRI VS KANAN) */}
        {(sesi.state === 'PLAYING' || sesi.state === 'PAUSED' || (isFinished && !showEndCard)) &&
          isDuelLokal && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {(
                [
                  {
                    slot: 'pemain1' as const,
                    peserta: sesi.pemain1,
                    soal: p1Soal,
                    reveal: p1Reveal,
                    accentColor: '#e2312d',
                  },
                  {
                    slot: 'pemain2' as const,
                    peserta: sesi.pemain2,
                    soal: p2Soal,
                    reveal: p2Reveal,
                    accentColor: '#1d8fe0',
                  },
                ] as const
              ).map(({ slot, peserta, soal, reveal, accentColor }) => (
                <div key={slot} className="bk-card">
                  <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b-2 border-[#f0dfb4]">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ background: accentColor }}
                      />
                      <span className="bk-h text-lg font-extrabold text-[#2b2a4a]">
                        {peserta.nama}
                      </span>
                    </div>
                    <span className="bk-chip">
                      {Math.round(peserta.jarak)} / {targetJarak} m
                    </span>
                  </div>

                  {renderStatusBadges(peserta)}

                  {soal ? (
                    <>
                      <div className="text-xs font-extrabold text-[#6b6a85] mb-1.5">
                        Soal #{soal.nomorSoal}
                      </div>
                      <div className="bk-h text-lg font-extrabold text-[#2b2a4a] mb-3 leading-snug">
                        {soal.teks}
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {soal.pilihan.map((opt) => {
                          const locked = Boolean(reveal) || sesi.state !== 'PLAYING';
                          const isCorrect =
                            reveal && opt.key === reveal.feedback.jawabanBenarKode;
                          const isWrongChosen =
                            reveal &&
                            !reveal.feedback.benar &&
                            reveal.chosenChoiceId === opt.choiceId;
                          return (
                            <button
                              key={opt.choiceId}
                              type="button"
                              disabled={locked}
                              onClick={() =>
                                submitJawabanSlot(slot, soal, { choiceId: opt.choiceId })
                              }
                              className={`bk-opt !p-3 ${
                                isCorrect ? 'ok' : isWrongChosen ? 'no' : ''
                              }`}
                            >
                              <span className="bk-opt-k">{opt.key}</span>
                              <span className="text-sm leading-snug">{opt.teks}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div
                        className={`min-h-[1.5em] mt-2.5 text-xs font-extrabold ${
                          reveal?.feedback.benar ? 'text-[#1f9d55]' : 'text-[#d63b3b]'
                        }`}
                      >
                        {reveal ? renderFeedbackText(reveal.feedback) : ''}
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center text-xs text-[#6b6a85] font-bold">
                      Selesai / Menunggu pemain lain...
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

        {/* 3. END PODIUM & STATISTIK SOAL */}
        {isFinished && showEndCard && (
          <section ref={endRef} className="bk-card mt-4 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-[#ffe9a8] text-[#7a5200] text-xs font-extrabold mb-1.5">
                  <Trophy className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  Hasil duel 1 vs 1 balap karung
                </span>
                <h2 className="bk-h text-2xl sm:text-3xl font-extrabold text-[#2b2a4a]">
                  Pemenang: {juara1?.nama || sesi.pemain1.nama}!
                </h2>
                <p className="text-sm text-[#6b6a85] mt-0.5">
                  {sesi.hasil?.dihentikanManual
                    ? 'Perlombaan dihentikan oleh guru.'
                    : `Menyentuh garis finis ${targetJarak} m paling cepat!`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleMainLagi(true)}
                  disabled={isMainLagi}
                  className="bk-btn alt"
                >
                  <RefreshCw className={`w-4 h-4 ${isMainLagi ? 'animate-spin' : ''}`} />
                  {isMainLagi ? 'Menyiapkan...' : 'Main lagi'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalUlangOpen(true)}
                  className="bk-btn slate"
                >
                  <RotateCcw className="w-4 h-4" /> Ulang dari awal
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/guru/balap-karung?templateId=${encodeURIComponent(
                        sesi.templateId
                      )}&kembali=${encodeURIComponent(returnUrl)}`
                    )
                  }
                  className="bk-btn gold"
                >
                  Selesai
                </button>
              </div>
            </div>

            {/* Podium 2 Kartu */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[juara1, juara2].filter(Boolean).map((p, idx) => {
                if (!p) return null;
                const isWinnerCard = idx === 0;
                const isP1 = p.id === sesi.pemain1.id;
                const shirt = isP1 ? '#7a3fd0' : '#1d8fe0';
                return (
                  <div
                    key={p.id}
                    className={`rounded-[22px] p-5 text-center border-2 ${
                      isWinnerCard
                        ? 'border-[#ffb81c] border-[3px] bg-gradient-to-b from-[#fff3c4] to-[#fff3d6]'
                        : 'border-[#f0dfb4] bg-[#fff3d6]'
                    }`}
                  >
                    <div className="flex justify-center mb-1">
                      <BalapSackSvg
                        shirtColor={shirt}
                        up={isWinnerCard}
                        crown={isWinnerCard}
                        medal={!isWinnerCard}
                        className="w-24 h-auto"
                      />
                    </div>
                    <span
                      className={`inline-block px-3.5 py-0.5 rounded-full text-xs font-extrabold ${
                        isWinnerCard
                          ? 'bg-[#ffb81c] text-[#4a3000]'
                          : 'bg-[#dfe3ee] text-[#394060]'
                      }`}
                    >
                      {isWinnerCard ? 'Juara 1 • Pemenang' : 'Juara 2 • Runner-Up'}
                    </span>
                    <h3 className="bk-h text-2xl font-extrabold text-[#2b2a4a] mt-2 flex items-center justify-center gap-1.5">
                      {p.isBot && <Bot className="w-5 h-5 text-[#1d8fe0]" />}
                      {!p.isBot && idx === 0 && <Swords className="w-5 h-5 text-[#e2312d]" />}
                      {p.nama}
                    </h3>
                    <div
                      className={`bk-h text-4xl font-extrabold my-1 ${
                        isWinnerCard ? 'text-[#d98a00]' : 'text-[#1f9d55]'
                      }`}
                    >
                      {Math.round(p.jarak)} m
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t-2 border-[#f0dfb4] pt-3 mt-3 text-xs text-[#6b6a85]">
                      <div>
                        Akurasi
                        <strong className="block bk-h text-sm text-[#2b2a4a]">
                          {p.akurasiPersen}%
                        </strong>
                      </div>
                      <div>
                        Benar/Salah
                        <strong className="block bk-h text-sm text-[#2b2a4a]">
                          {p.totalBenar}/{p.totalSalah}
                        </strong>
                      </div>
                      <div>
                        {p.waktuSelesaiMs ? 'Waktu Finis' : 'Rata-rata Jawab'}
                        <strong className="block bk-h text-sm text-[#2b2a4a]">
                          {p.waktuSelesaiMs
                            ? formatDurasiDetik(p.waktuSelesaiMs)
                            : formatDurasiDetik(p.rataRataWaktuJawabMs)}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Statistik Per Soal */}
            {sesi.hasil?.questionStats && sesi.hasil.questionStats.length > 0 && (
              <div className="pt-2">
                <h3 className="bk-h text-lg font-extrabold text-[#2b2a4a] mb-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#1f9d55]" />
                  Statistik soal yang dijawab
                </h3>
                <div className="bk-hm-wrap">
                  <table className="bk-hm">
                    <thead>
                      <tr>
                        <th className="w-16">No</th>
                        <th className="!text-left pl-3">Pertanyaan</th>
                        <th className="w-24">Benar</th>
                        <th className="w-24">Salah</th>
                        <th className="w-24">Akurasi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sesi.hasil.questionStats.map((qs, idx) => {
                        const benar = qs.jumlahBenar ?? 0;
                        const salah = qs.jumlahSalah ?? 0;
                        const total = benar + salah;
                        const akurasi = total > 0 ? `${Math.round((benar / total) * 100)}%` : '—';
                        return (
                          <tr key={qs.questionId || idx}>
                            <td className="font-mono font-extrabold text-[#6b6a85]">
                              #{qs.nomorSoal ?? idx + 1}
                            </td>
                            <td className="!text-left pl-3 font-bold text-[#2b2a4a] leading-snug">
                              {qs.teksSoal || `Pertanyaan ${idx + 1}`}
                            </td>
                            <td>
                              <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#e6f8ed] text-[#1f9d55] font-extrabold text-xs">
                                {benar}
                              </span>
                            </td>
                            <td>
                              <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#fdecec] text-[#d63b3b] font-extrabold text-xs">
                                {salah}
                              </span>
                            </td>
                            <td className="font-mono font-extrabold text-[#2b2a4a]">{akurasi}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Modal Konfirmasi Ulang */}
      <Modal
        isOpen={modalUlangOpen}
        onClose={() => setModalUlangOpen(false)}
        title="Ulangi Duel dari Awal?"
        variant="standard"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Jarak kedua peserta akan direset ke 0 m sehingga kedua peserta kembali ke garis awal
            untuk memulai duel baru pada sesi ini.
          </p>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setModalUlangOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleUlang}
              disabled={isActionLoading}
              className="bk-btn"
            >
              {isActionLoading ? 'Mereset...' : 'Ya, Reset ke Siap Mulai'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Akhiri Manual */}
      <Modal
        isOpen={modalHentikanOpen}
        onClose={() => setModalHentikanOpen(false)}
        title="Akhiri Perlombaan Sekarang?"
        variant="standard"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Perlombaan akan dihentikan sekarang dan peserta dengan jarak terjauh dinyatakan
            sebagai pemenang.
          </p>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setModalHentikanOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Lanjutkan Lomba
            </button>
            <button
              type="button"
              onClick={handleHentikan}
              disabled={isActionLoading}
              className="bk-btn"
            >
              {isActionLoading ? 'Mengakhiri...' : 'Ya, Akhiri Lomba'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
