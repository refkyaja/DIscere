import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import {
  Modal,
  extractApiErrorMessage,
  resolveGuruReturnUrl,
} from '../../components';
import { ModalKonfirmasiKeluar } from '../../components/ModalKonfirmasiKeluar';
import { PanjatPinangStage, TiangStageItem } from '../../components/PanjatPinangStage';
import { PanjatClimberAvatar } from '../../components/PanjatClimberAvatar';
import { soundEffects, useGameSoundLifecycle } from '../../lib/soundEffects';
import { EfekAktifVisual } from '../siswa/TiangPinangVisual';
import { EkspresiKarakterPanjat } from '../siswa/KarakterPanjatPinang';
import {
  Bot,
  CheckCircle2,
  Clock,
  Droplets,
  Eye,
  Flag,
  Flame,
  HandMetal,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Shield,
  StopCircle,
  Swords,
  Trophy,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';

type StatePanjatSolo = 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED' | 'STOPPED';
type SlotPemain = 'pemain1' | 'pemain2';

interface OpsiSoalSolo {
  choiceId: string;
  key: 'A' | 'B' | 'C' | 'D' | 'E';
  teks: string;
}

interface SoalAktifPanjatSolo {
  presentationId: string;
  questionId: string;
  urutanSoal: number;
  totalSoal: number;
  teks: string;
  opsi: OpsiSoalSolo[];
  ditampilkanPadaMs: number;
  isBonusKulitPisang: boolean;
}

interface RiwayatRintanganItem {
  id: string;
  tipe: string;
  judul: string;
  deskripsi: string;
  efekNilai: number;
  satuan: string;
  timestampMs: number;
}

interface PesertaPanjatSoloClient {
  id: string;
  slot: SlotPemain;
  nama: string;
  isBot: boolean;
  posisi: number;
  poinBonus: number;
  totalBenar: number;
  totalSalah: number;
  streakSaatIni: number;
  streakTertinggi: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs: number | null;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  streakSalahBerturut?: number;
  jatuhKeDasar?: number;
  efekAktif: EfekAktifVisual;
  riwayatRintangan: RiwayatRintanganItem[];
  soalAktif: SoalAktifPanjatSolo | null;
}

interface FeedbackAksiPanjatSolo {
  slot: SlotPemain;
  nama: string;
  benar: boolean;
  timedOut: boolean;
  isBonusKulitPisang: boolean;
  jawabanDipilihKey: string | null;
  kunciKey: string;
  penjelasan: string | null;
  posisiSebelum: number;
  posisiBaru: number;
  perubahanPosisi: number;
  bonusStreakDidapat: number;
  bonusPeganganKuatDidapat: number;
  bonusCepatDidapat?: number;
  penaltiTiangLicin: number;
  perisaiDigunakan: boolean;
  perisaiDiperoleh: boolean;
  peganganKuatDiperoleh?: boolean;
  peganganKuatDigunakan?: boolean;
  streakSalahBerturut?: number;
  jatuhBebas?: boolean;
  awasJatuh?: boolean;
  tertahanTali?: boolean;
  taliTerkait?: number;
  isSoalPuncak?: boolean;
  soalPuncakBerhasil?: boolean;
  jatuhKeDasar?: number;
  rintanganBaru: RiwayatRintanganItem | null;
  selesaiBaru: boolean;
  waktuJawabMs: number;
  timestampMs: number;
}

interface KonfigurasiPanjatSolo {
  kesulitan: 'mudah' | 'normal' | 'sulit' | 'custom';
  naikBenar: number;
  turunSalah: number;
  bonusStreakAktif: boolean;
  bonusStreak3: number;
  bonusStreak5: number;
  rintanganAktif: boolean;
  rintanganDipilih: string[];
  penurunanTiangLicin: number;
  bonusPeganganKuat: number;
  hadiahKejutanMode: 'posisi' | 'poin';
  hadiahKejutanNilai: number;
  peluangRintanganPersen: number;
  waktuPerSoalDetik: number;
  tipeLawanSolo: 'bot' | 'lokal';
  kesulitanBot: 'santai' | 'sedang' | 'cepat';
  namaPemain1: string;
  namaPemain2: string;
}

interface QuestionStatItem {
  questionId: string;
  nomorSoal: number;
  teksSoal: string;
  jumlahBenar: number;
  jumlahSalah: number;
}

interface LeaderboardItemSolo {
  peringkat: number;
  id: string;
  nama: string;
  posisi: number;
  poinBonus: number;
  totalBenar: number;
  totalSalah: number;
  streakSaatIni: number;
  streakTertinggi: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs: number | null;
  rataRataWaktuJawabMs: number;
  efekAktif?: EfekAktifVisual;
  jatuhKeDasar?: number;
}

interface SesiPanjatSoloClient {
  sessionId: string;
  game: 'panjat_pinang';
  mode: 'solo';
  playMode: 'SOLO';
  state: StatePanjatSolo;
  status: 'lobi' | 'jalan' | 'selesai';
  templateId: string;
  templateJudul: string;
  totalSoal: number;
  config: KonfigurasiPanjatSolo;
  isBotLawan: boolean;
  pemain1: PesertaPanjatSoloClient;
  pemain2: PesertaPanjatSoloClient;
  mulaiPadaMs: number | null;
  pausedPadaMs: number | null;
  totalPausedMs: number;
  selesaiPadaMs: number | null;
  botNextActionAtMs: number | null;
  terakhirFeedback: FeedbackAksiPanjatSolo | null;
  leaderboard: LeaderboardItemSolo[];
  isFinished: boolean;
  winnerSlot: SlotPemain | 'SERI' | null;
  winnerNama: string | null;
  questionStats: QuestionStatItem[];
}

interface RevealState {
  soal: SoalAktifPanjatSolo;
  choiceIdDipilih: string | null;
  feedback: FeedbackAksiPanjatSolo;
}

const LABEL_STATE: Record<
  StatePanjatSolo,
  { text: string; tone: 'idle' | 'live' | 'done' }
> = {
  READY: { text: 'Siap Duel 1 vs 1', tone: 'idle' },
  PLAYING: { text: 'Berlangsung', tone: 'live' },
  PAUSED: { text: 'Dijeda', tone: 'idle' },
  FINISHED: { text: 'Puncak Tercapai', tone: 'done' },
  STOPPED: { text: 'Dihentikan Guru', tone: 'done' },
};

const LABEL_BOT_KESULITAN: Record<'santai' | 'sedang' | 'cepat', string> = {
  santai: 'Bot Santai',
  sedang: 'Bot Sedang',
  cepat: 'Bot Cepat',
};

function formatDurasiDetik(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '-';
  return `${(ms / 1000).toFixed(1)} dtk`;
}

function buildFeedbackSummary(fb: FeedbackAksiPanjatSolo): string {
  const extras: string[] = [];
  if (fb.bonusCepatDidapat && fb.bonusCepatDidapat > 0) extras.push(`Cepat (<5s) +${fb.bonusCepatDidapat}%`);
  if (fb.bonusStreakDidapat > 0) extras.push(`Streak +${fb.bonusStreakDidapat}%`);
  if (fb.bonusPeganganKuatDidapat > 0) extras.push(`Pegangan Kuat +${fb.bonusPeganganKuatDidapat}%`);
  if (fb.peganganKuatDiperoleh) extras.push('Pegangan Kuat siap!');
  if (fb.peganganKuatDigunakan) extras.push('Pegangan Kuat menahanmu!');
  if (fb.tertahanTali) extras.push(`Tertahan tali ${fb.taliTerkait}%!`);
  if (fb.awasJatuh) extras.push('⚠ Satu salah lagi = jatuh ke dasar!');
  if (fb.penaltiTiangLicin > 0) extras.push(`Tiang Licin -${fb.penaltiTiangLicin}%`);
  if (fb.perisaiDigunakan) extras.push('Perisai menahan licin!');
  if (fb.perisaiDiperoleh) extras.push('Peroleh Perisai Pisang!');
  if (fb.rintanganBaru?.judul) extras.push(fb.rintanganBaru.judul);
  const suffix = extras.length > 0 ? ` (${extras.join(' · ')})` : '';

  if (fb.jatuhBebas) {
    return `3× salah beruntun! Jatuh bebas ke dasar tiang (0%)!`;
  }

  if (fb.isBonusKulitPisang) {
    if (fb.benar) return `Berhasil jawab soal bonus Kulit Pisang! Perisai aktif${suffix}.`;
    return fb.timedOut
      ? `Waktu soal bonus habis. Posisi aman, tanpa perisai.`
      : `Soal bonus belum tepat. Jawaban: ${fb.kunciKey}. Posisi aman.`;
  }

  if (fb.isSoalPuncak) {
    if (fb.benar) return `⭐ Soal Puncak Terjawab Benar! Meraih Hadiah Puncak (100%)!`;
    return `Gagal di Soal Puncak! Melorot ke Tali 75%${suffix}. Kunci: ${fb.kunciKey}.`;
  }

  if (fb.benar) {
    const sign = fb.perubahanPosisi >= 0 ? `+${fb.perubahanPosisi}%` : `${fb.perubahanPosisi}%`;
    return `Benar! Naik ${sign}${suffix}.`;
  }
  if (fb.peganganKuatDigunakan) {
    return `Belum tepat, tapi Pegangan Kuat menahanmu! Kunci: ${fb.kunciKey}.`;
  }
  if (fb.timedOut) {
    return `Waktu habis (${fb.perubahanPosisi}%)${suffix}. Kunci: ${fb.kunciKey}.`;
  }
  return `Belum tepat (${fb.perubahanPosisi}%)${suffix}. Kunci: ${fb.kunciKey}.`;
}

export default function LayarHostPanjatPinangSolo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = resolveGuruReturnUrl(searchParams.get('kembali'));

  const [sesi, setSesi] = useState<SesiPanjatSoloClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isMainLagi, setIsMainLagi] = useState(false);
  const [updatingBot, setUpdatingBot] = useState(false);
  const [crowdCheer, setCrowdCheer] = useState(false);
  const [jatuhBebasMap, setJatuhBebasMap] = useState<Record<SlotPemain, boolean>>({
    pemain1: false,
    pemain2: false,
  });
  const [bubbleMap, setBubbleMap] = useState<Record<SlotPemain, string | undefined>>({
    pemain1: undefined,
    pemain2: undefined,
  });

  const [revealMap, setRevealMap] = useState<Record<SlotPemain, RevealState | null>>({
    pemain1: null,
    pemain2: null,
  });
  const [, setDeltaMap] = useState<Record<SlotPemain, number | undefined>>({
    pemain1: undefined,
    pemain2: undefined,
  });
  const [ekspresiMap, setEkspresiMap] = useState<Record<SlotPemain, EkspresiKarakterPanjat>>({
    pemain1: 'netral',
    pemain2: 'netral',
  });
  const [botFeedback, setBotFeedback] = useState<FeedbackAksiPanjatSolo | null>(null);

  const [remainingMsMap, setRemainingMsMap] = useState<{ pemain1: number; pemain2: number }>({
    pemain1: 15000,
    pemain2: 15000,
  });

  const [modalUlangOpen, setModalUlangOpen] = useState(false);
  const [modalHentikanOpen, setModalHentikanOpen] = useState(false);
  const [modalKeluarOpen, setModalKeluarOpen] = useState(false);
  const [detailPemain, setDetailPemain] = useState<PesertaPanjatSoloClient | null>(null);
  const [showEndCard, setShowEndCard] = useState(false);

  const submittingRef = useRef<{ pemain1: boolean; pemain2: boolean }>({
    pemain1: false,
    pemain2: false,
  });
  const botPollingLockRef = useRef(false);
  const lastPresIdRef = useRef<{ pemain1: string | null; pemain2: string | null }>({
    pemain1: null,
    pemain2: null,
  });
  const revealTimersRef = useRef<Record<SlotPemain, number | null>>({
    pemain1: null,
    pemain2: null,
  });
  const animTimersRef = useRef<Record<SlotPemain, number | null>>({
    pemain1: null,
    pemain2: null,
  });
  const cheerTimerRef = useRef<number | null>(null);
  const victorySoundPlayedRef = useRef(false);
  const prevStateRef = useRef<StatePanjatSolo | null>(null);

  const clearSlotTimers = useCallback((slot?: SlotPemain) => {
    const slots: SlotPemain[] = slot ? [slot] : ['pemain1', 'pemain2'];
    for (const s of slots) {
      if (revealTimersRef.current[s]) {
        window.clearTimeout(revealTimersRef.current[s]!);
        revealTimersRef.current[s] = null;
      }
      if (animTimersRef.current[s]) {
        window.clearTimeout(animTimersRef.current[s]!);
        animTimersRef.current[s] = null;
      }
    }
    if (!slot && cheerTimerRef.current) {
      window.clearTimeout(cheerTimerRef.current);
      cheerTimerRef.current = null;
    }
  }, []);

  const pulseCheer = useCallback(() => {
    setCrowdCheer(true);
    if (cheerTimerRef.current) window.clearTimeout(cheerTimerRef.current);
    cheerTimerRef.current = window.setTimeout(() => setCrowdCheer(false), 1800);
  }, []);

  const triggerFeedbackVisuals = useCallback(
    (fb: FeedbackAksiPanjatSolo, currentStreak: number) => {
      const slot = fb.slot;
      if (fb.selesaiBaru) {
        soundEffects.playVictoryFanfare();
        pulseCheer();
      } else if (fb.perisaiDiperoleh || fb.perisaiDigunakan) {
        soundEffects.playShield();
        pulseCheer();
      } else if (fb.benar) {
        if (fb.bonusStreakDidapat > 0 || fb.bonusPeganganKuatDidapat > 0 || (fb.bonusCepatDidapat && fb.bonusCepatDidapat > 0)) {
          soundEffects.playBoost();
        } else {
          soundEffects.playClimb();
        }
        pulseCheer();
      } else {
        if (fb.jatuhBebas) {
          soundEffects.playIncorrect();
        } else if (fb.penaltiTiangLicin > 0) {
          soundEffects.playSlip();
        } else {
          soundEffects.playIncorrect();
        }
      }

      // Reaksi visual khusus untuk Jatuh Bebas, Awas Jatuh, dan Pegangan Kuat
      if (fb.jatuhBebas) {
        setJatuhBebasMap((prev) => ({ ...prev, [slot]: true }));
        setBubbleMap((prev) => ({ ...prev, [slot]: 'Aaaah!!' }));
        setTimeout(() => {
          setJatuhBebasMap((prev) => ({ ...prev, [slot]: false }));
          setBubbleMap((prev) => ({ ...prev, [slot]: undefined }));
        }, 1800);
      } else if (fb.awasJatuh) {
        setBubbleMap((prev) => ({ ...prev, [slot]: 'Awas jatuh!' }));
        setTimeout(() => setBubbleMap((prev) => ({ ...prev, [slot]: undefined })), 1800);
      } else if (fb.peganganKuatDigunakan) {
        setBubbleMap((prev) => ({ ...prev, [slot]: 'Pegangan Kuat!' }));
        setTimeout(() => setBubbleMap((prev) => ({ ...prev, [slot]: undefined })), 1500);
      } else if (fb.benar) {
        const bubbleTxt = fb.bonusCepatDidapat ? `+${fb.perubahanPosisi}% (Cepat!)` : `+${fb.perubahanPosisi}%`;
        setBubbleMap((prev) => ({ ...prev, [slot]: bubbleTxt }));
        setTimeout(() => setBubbleMap((prev) => ({ ...prev, [slot]: undefined })), 1200);
      }

      setDeltaMap((prev) => ({
        ...prev,
        [slot]: fb.perubahanPosisi,
      }));
      setEkspresiMap((prev) => ({
        ...prev,
        [slot]: fb.selesaiBaru ? 'puncak' : fb.benar ? 'bahagia' : 'sedih',
      }));

      if (animTimersRef.current[slot]) {
        window.clearTimeout(animTimersRef.current[slot]!);
      }
      animTimersRef.current[slot] = window.setTimeout(() => {
        setDeltaMap((prev) => ({ ...prev, [slot]: undefined }));
        setEkspresiMap((prev) => ({
          ...prev,
          [slot]: fb.selesaiBaru ? 'puncak' : currentStreak >= 3 ? 'bahagia' : 'netral',
        }));
      }, 1500);
    },
    [pulseCheer]
  );

  // Memuat detail sesi pertama kali / saat navigasi Main Lagi
  useEffect(() => {
    let active = true;
    async function loadSession() {
      if (!id) return;
      try {
        clearSlotTimers();
        submittingRef.current = { pemain1: false, pemain2: false };
        botPollingLockRef.current = false;
        lastPresIdRef.current = { pemain1: null, pemain2: null };
        victorySoundPlayedRef.current = false;
        setRevealMap({ pemain1: null, pemain2: null });
        setDeltaMap({ pemain1: undefined, pemain2: undefined });
        setEkspresiMap({ pemain1: 'netral', pemain2: 'netral' });
        setBotFeedback(null);
        setShowEndCard(false);
        setLoading(true);
        setErrorPesan(null);
        const res = await apiRequest<{ session: SesiPanjatSoloClient }>(`/sesi/${id}`);
        if (!active) return;
        setSesi(res.session);
        const tMs = (res.session.config?.waktuPerSoalDetik || 15) * 1000;
        setRemainingMsMap({ pemain1: tMs, pemain2: tMs });
        if (res.session.isFinished) {
          victorySoundPlayedRef.current = true;
          setShowEndCard(true);
        }
      } catch (err: unknown) {
        if (active) {
          setErrorPesan(extractApiErrorMessage(err, 'Gagal memuat sesi Panjat Pinang Solo.'));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadSession();
    return () => {
      active = false;
      clearSlotTimers();
    };
  }, [id, clearSlotTimers]);

  // Reset countdown untuk setiap slot bila presentationId baru muncul (dan belum sedang reveal)
  useEffect(() => {
    if (!sesi) return;
    const timerMs = (sesi.config?.waktuPerSoalDetik || 15) * 1000;
    const slots: SlotPemain[] = ['pemain1', 'pemain2'];
    for (const slot of slots) {
      const p = sesi[slot];
      const presId = p.soalAktif?.presentationId || null;
      if (presId && presId !== lastPresIdRef.current[slot] && !revealMap[slot]) {
        lastPresIdRef.current[slot] = presId;
        setRemainingMsMap((prev) => ({ ...prev, [slot]: timerMs }));
      }
    }
  }, [sesi, revealMap]);

  // Suara kemenangan otomatis saat status menjadi selesai (sebelum useGameSoundLifecycle menonaktifkan gerbang audio)
  useEffect(() => {
    const prevState = prevStateRef.current;
    prevStateRef.current = sesi?.state ?? null;

    if (sesi?.isFinished) {
      setShowEndCard(true);
      if (sesi.state === 'STOPPED') {
        victorySoundPlayedRef.current = true;
        soundEffects.stopAll();
      } else if (
        !victorySoundPlayedRef.current &&
        (prevState === 'PLAYING' || prevState === 'PAUSED')
      ) {
        victorySoundPlayedRef.current = true;
        soundEffects.playNaturalVictory();
      } else {
        victorySoundPlayedRef.current = true;
      }
    } else if (sesi) {
      victorySoundPlayedRef.current = false;
    }
  }, [sesi]);

  const isSoundActive = Boolean(
    sesi && !sesi.isFinished && (sesi.state === 'PLAYING' || sesi.state === 'PAUSED')
  );
  useGameSoundLifecycle(isSoundActive, id);

  const handleMulai = async () => {
    if (!id || !sesi || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      const res = await apiRequest<{ session: SesiPanjatSoloClient }>(`/sesi/${id}/mulai`, {
        method: 'POST',
        body: JSON.stringify({ kesulitanBot: sesi.config.kesulitanBot }),
      });
      soundEffects.startGame('whistle');
      pulseCheer();
      const tMs = (res.session.config?.waktuPerSoalDetik || 15) * 1000;
      lastPresIdRef.current = {
        pemain1: res.session.pemain1.soalAktif?.presentationId || null,
        pemain2: res.session.pemain2.soalAktif?.presentationId || null,
      };
      setRemainingMsMap({ pemain1: tMs, pemain2: tMs });
      setBotFeedback(null);
      setSesi(res.session);
    } catch (err: unknown) {
      setActionError(extractApiErrorMessage(err, 'Gagal memulai duel Panjat Pinang 1 vs 1.'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUbahKesulitanBot = async (nextLevel: 'santai' | 'sedang' | 'cepat') => {
    if (!id || !sesi || updatingBot || sesi.config.kesulitanBot === nextLevel) return;
    try {
      setUpdatingBot(true);
      setActionError(null);
      const res = await apiRequest<{ session: SesiPanjatSoloClient }>(`/sesi/${id}/pengaturan`, {
        method: 'PATCH',
        body: JSON.stringify({ kesulitanBot: nextLevel }),
      });
      setSesi(res.session);
    } catch (err: unknown) {
      setActionError(extractApiErrorMessage(err, 'Gagal mengubah tingkat kesulitan Bot.'));
    } finally {
      setUpdatingBot(false);
    }
  };

  const handleTogglePause = async () => {
    if (!id || !sesi || isActionLoading) return;
    if (sesi.state !== 'PLAYING' && sesi.state !== 'PAUSED') return;
    const nextState = sesi.state === 'PLAYING' ? 'PAUSED' : 'PLAYING';
    try {
      setIsActionLoading(true);
      setActionError(null);
      const res = await apiRequest<{ session: SesiPanjatSoloClient }>(`/sesi/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({ state: nextState }),
      });
      setSesi(res.session);
    } catch (err: unknown) {
      setActionError(extractApiErrorMessage(err, 'Gagal mengubah status jeda lomba.'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUlang = async () => {
    if (!id || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      clearSlotTimers();
      soundEffects.stopAll();
      victorySoundPlayedRef.current = false;
      const res = await apiRequest<{ session: SesiPanjatSoloClient }>(`/sesi/${id}/ulang`, {
        method: 'POST',
      });
      setModalUlangOpen(false);
      setShowEndCard(false);
      setRevealMap({ pemain1: null, pemain2: null });
      setDeltaMap({ pemain1: undefined, pemain2: undefined });
      setEkspresiMap({ pemain1: 'netral', pemain2: 'netral' });
      setBotFeedback(null);
      lastPresIdRef.current = { pemain1: null, pemain2: null };
      const tMs = (res.session.config?.waktuPerSoalDetik || 15) * 1000;
      setRemainingMsMap({ pemain1: tMs, pemain2: tMs });
      setSesi(res.session);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setActionError(extractApiErrorMessage(err, 'Gagal mengulang permainan.'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleHentikan = async () => {
    if (!id || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      clearSlotTimers();
      victorySoundPlayedRef.current = true;
      soundEffects.stopAll();
      const res = await apiRequest<{ session: SesiPanjatSoloClient }>(`/sesi/${id}/selesai`, {
        method: 'POST',
      });
      setModalHentikanOpen(false);
      setSesi(res.session);
      setShowEndCard(true);
    } catch (err: unknown) {
      setActionError(extractApiErrorMessage(err, 'Gagal menghentikan permainan.'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleKembaliClick = () => {
    if (sesi && !sesi.isFinished && (sesi.state === 'PLAYING' || sesi.state === 'PAUSED')) {
      setModalKeluarOpen(true);
    } else {
      navigate(returnUrl);
    }
  };

  const handleKonfirmasiKeluar = () => {
    setModalKeluarOpen(false);
    handleHentikan();
    navigate(returnUrl);
  };

  const handleMainLagi = async () => {
    if (!id || isMainLagi) return;
    try {
      setIsMainLagi(true);
      const res = await apiRequest<{ sessionId?: string; session?: { id: string } }>(
        `/sesi/${id}/main-lagi`,
        {
          method: 'POST',
          body: JSON.stringify({ autoStart: false }),
        }
      );
      const nextId = res.session?.id || res.sessionId;
      if (nextId) {
        navigate(`/guru/sesi/${nextId}?kembali=${encodeURIComponent(returnUrl)}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: unknown) {
      setActionError(extractApiErrorMessage(err, 'Gagal membuat sesi baru.'));
    } finally {
      setIsMainLagi(false);
    }
  };

  const handleJawabSlot = useCallback(
    async (
      slot: SlotPemain,
      soal: SoalAktifPanjatSolo,
      choiceId: string | null,
      timedOut: boolean = false
    ) => {
      if (!id || !sesi || sesi.state !== 'PLAYING') return;
      if (submittingRef.current[slot] || revealMap[slot]) return;

      submittingRef.current[slot] = true;
      try {
        setActionError(null);
        const res = await apiRequest<{
          feedback: FeedbackAksiPanjatSolo;
          isFinished: boolean;
          session: SesiPanjatSoloClient;
        }>(`/sesi/${id}/jawab`, {
          method: 'POST',
          body: JSON.stringify({
            slot,
            presentationId: soal.presentationId,
            questionId: soal.questionId,
            ...(timedOut ? { timedOut: true } : { choiceId }),
          }),
        });

        triggerFeedbackVisuals(res.feedback, res.session[slot].streakSaatIni);

        setRevealMap((prev) => ({
          ...prev,
          [slot]: {
            soal,
            choiceIdDipilih: choiceId,
            feedback: res.feedback,
          },
        }));

        const holdMs = res.isFinished ? 750 : 1050;
        if (revealTimersRef.current[slot]) {
          window.clearTimeout(revealTimersRef.current[slot]!);
        }

        const nextSession = res.session;
        revealTimersRef.current[slot] = window.setTimeout(() => {
          setRevealMap((prev) => ({ ...prev, [slot]: null }));
          setSesi(nextSession);
          const nextPres = nextSession[slot].soalAktif?.presentationId || null;
          lastPresIdRef.current[slot] = nextPres;
          const tMs = (nextSession.config?.waktuPerSoalDetik || 15) * 1000;
          setRemainingMsMap((prev) => ({ ...prev, [slot]: tMs }));
          if (res.isFinished) {
            setShowEndCard(true);
          }
        }, holdMs);

        // Perbarui posisi tiang dan skor segera sambil tetap mempertahankan reveal visual
        setSesi(nextSession);
      } catch (err: unknown) {
        setActionError(extractApiErrorMessage(err, 'Gagal memproses jawaban.'));
      } finally {
        submittingRef.current[slot] = false;
      }
    },
    [id, sesi, revealMap, triggerFeedbackVisuals]
  );

  // Tick timer mundur per soal secara independen untuk pemain aktif
  useEffect(() => {
    if (!sesi || sesi.state !== 'PLAYING') return;
    const isDuelLokal = sesi.config.tipeLawanSolo === 'lokal';

    const intervalId = window.setInterval(() => {
      setRemainingMsMap((prev) => {
        let changed = false;
        const next = { ...prev };

        const tickSlot = (slot: SlotPemain) => {
          const p = sesi[slot];
          const soal = p.soalAktif;
          if (!soal || revealMap[slot] || submittingRef.current[slot]) return;
          if (prev[slot] <= 0) return;
          const updated = Math.max(0, prev[slot] - 100);
          next[slot] = updated;
          changed = true;
          if (updated === 0) {
            void handleJawabSlot(slot, soal, null, true);
          }
        };

        tickSlot('pemain1');
        if (isDuelLokal) {
          tickSlot('pemain2');
        }

        return changed ? next : prev;
      });
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [sesi, revealMap, handleJawabSlot]);

  // Polling aksi Bot AI saat bermain melawan Bot
  useEffect(() => {
    if (!id || !sesi || sesi.state !== 'PLAYING' || !sesi.isBotLawan) return;

    const intervalId = window.setInterval(async () => {
      if (botPollingLockRef.current) return;
      botPollingLockRef.current = true;
      try {
        const res = await apiRequest<{
          executed: boolean;
          feedback: FeedbackAksiPanjatSolo | null;
          isFinished: boolean;
          session: SesiPanjatSoloClient;
        }>(`/sesi/${id}/bot-langkah`, {
          method: 'POST',
        });

        if (res.executed && res.feedback) {
          setBotFeedback(res.feedback);
          triggerFeedbackVisuals(res.feedback, res.session.pemain2.streakSaatIni);
          setSesi(res.session);
          if (res.isFinished) {
            setShowEndCard(true);
          }
        }
      } catch {
        // Abaikan error polling sementara agar tidak mengganggu gameplay pemain
      } finally {
        botPollingLockRef.current = false;
      }
    }, 550);

    return () => window.clearInterval(intervalId);
  }, [id, sesi?.state, sesi?.isBotLawan, triggerFeedbackVisuals]);

  const tiangStageSolo: TiangStageItem[] = useMemo(() => {
    if (!sesi) return [];
    return [
      {
        id: 'pemain1',
        label: sesi.pemain1.nama || 'Pemain 1',
        warna: '#e2312d',
        posisiPersen: sesi.pemain1.posisi,
        jatuhBebas: Boolean(jatuhBebasMap.pemain1),
        bubbleText: bubbleMap.pemain1,
        isPuncak: sesi.pemain1.posisi >= 100,
        ekspresi: ekspresiMap.pemain1,
        xPct: 30,
      },
      {
        id: 'pemain2',
        label: sesi.isBotLawan ? 'Lawan Bot' : sesi.pemain2.nama || 'Pemain 2',
        warna: '#1d8fe0',
        posisiPersen: sesi.pemain2.posisi,
        jatuhBebas: Boolean(jatuhBebasMap.pemain2),
        bubbleText: bubbleMap.pemain2,
        isPuncak: sesi.pemain2.posisi >= 100,
        ekspresi: ekspresiMap.pemain2,
        xPct: 70,
      },
    ];
  }, [sesi, jatuhBebasMap, bubbleMap, ekspresiMap]);

  if (loading) {
    return (
      <div className="bk-festival flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-[#e2312d] mb-3" />
        <p className="font-extrabold text-[#2b2a4a]">Menyiapkan Arena Panjat Pinang 1 vs 1...</p>
      </div>
    );
  }

  if (errorPesan || !sesi) {
    return (
      <div className="bk-festival flex items-center justify-center p-4">
        <div className="bk-card max-w-md w-full text-center space-y-4">
          <h2 className="bk-h text-2xl font-extrabold text-[#2b2a4a]">Sesi Tidak Tersedia</h2>
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

  const isDuelLokal = sesi.config.tipeLawanSolo === 'lokal';
  const badge = LABEL_STATE[sesi.state];
  const timerSec = sesi.config.waktuPerSoalDetik || 15;
  const leaderboard = sesi.leaderboard || [];
  const juara1 = leaderboard[0];
  const juara2 = leaderboard[1];

  const renderPlayerCardEffects = (p: PesertaPanjatSoloClient) => (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
      {p.streakSaatIni >= 2 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700">
          <Flame className="w-3 h-3" /> Streak {p.streakSaatIni}x
        </span>
      )}
      {p.efekAktif.perisaiKulitPisang && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800">
          <Shield className="w-3 h-3" /> Perisai Pisang
        </span>
      )}
      {p.efekAktif.peganganKuat && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800">
          <HandMetal className="w-3 h-3" /> Pegangan Kuat (+{sesi.config.bonusPeganganKuat}%)
        </span>
      )}
      {p.efekAktif.tiangLicin && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-300 text-sky-800">
          <Droplets className="w-3 h-3" /> Tiang Licin!
        </span>
      )}
    </div>
  );

  const renderBotPanel = () => {
    const p = sesi.pemain2;
    return (
      <div className="bk-card border-[3px] border-[#1d8fe0] !p-0 overflow-hidden flex flex-col justify-between">
        <div>
          <div className="bg-[#1d8fe0] text-white px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase opacity-85 block">
                {p.posisi >= 90 ? '⭐ SOAL PUNCAK • ' : ''}Lawan Bot AI (Kanan)
              </span>
              <h3 className="bk-h text-lg font-extrabold truncate">{p.nama}</h3>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-white/20 text-xs font-mono font-extrabold">
              {p.posisi}%
            </span>
          </div>

          {/* Progress Bar Bot */}
          <div className="h-2 w-full bg-[#f3ead5]">
            <div
              className="h-full bg-[#1d8fe0] transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, p.posisi))}%` }}
            />
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between text-xs font-extrabold text-[#6b6a85]">
              <span>Tingkat: {LABEL_BOT_KESULITAN[sesi.config.kesulitanBot]}</span>
              <span className="font-mono text-[#2b2a4a]">
                Benar: {p.totalBenar} • Salah: {p.totalSalah}
              </span>
            </div>

            {renderPlayerCardEffects(p)}

            {/* Kotak Status Pemikiran Bot */}
            <div className="p-4 rounded-2xl bg-[#f0f9ff] border-2 border-[#bae6fd] text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm font-extrabold text-[#0369a1]">
                <Bot className="w-5 h-5 animate-bounce" />
                <span>
                  {p.status === 'selesai' ? 'Bot telah mencapai puncak!' : 'Bot sedang berpikir & memanjat…'}
                </span>
              </div>
              {botFeedback && (
                <p className={`text-xs font-bold ${botFeedback.benar ? 'text-[#15803d]' : 'text-[#b91c1c]'}`}>
                  Langkah terakhir: {buildFeedbackSummary(botFeedback)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuestionPanel = (slot: SlotPemain) => {
    const p = sesi[slot];
    const reveal = revealMap[slot];
    const soal = reveal ? reveal.soal : p.soalAktif;
    const remMs = remainingMsMap[slot];
    const ratio = Math.max(0, Math.min(1, remMs / (timerSec * 1000)));
    const secDisp = Math.max(0, Math.ceil(remMs / 1000));
    const isP1 = slot === 'pemain1';
    const accentHeader = isP1
      ? 'bg-[#e2312d] text-white'
      : 'bg-[#1d8fe0] text-white';
    const accentBorder = isP1 ? 'border-[#e2312d]' : 'border-[#1d8fe0]';

    if (!soal) {
      return (
        <div className="bk-card text-center py-8 space-y-2">
          <p className="font-extrabold text-[#2b2a4a]">{p.nama}</p>
          <p className="text-xs font-bold text-[#6b6a85]">Menyiapkan pertanyaan berikutnya...</p>
        </div>
      );
    }

    return (
      <div className={`bk-card !p-0 overflow-hidden border-[3px] ${accentBorder}`}>
        {/* Header Pemain + Countdown */}
        <div className={`${accentHeader} px-4 py-2.5 flex items-center justify-between gap-2`}>
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase opacity-85 block">
              {p.posisi >= 90 ? '⭐ SOAL PUNCAK • ' : ''}
              {isP1 ? 'Pemanjat 1 (Kiri)' : 'Pemanjat 2 (Kanan)'} • Soal #{soal.urutanSoal}
            </span>
            <h3 className="bk-h text-lg font-extrabold truncate">{p.nama}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-full bg-white/20 text-xs font-mono font-extrabold">
              {p.posisi}%
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-extrabold ${
                secDisp <= 4 ? 'bg-[#ffe9a8] text-[#8a1f1f] animate-pulse' : 'bg-white text-[#2b2a4a]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> {secDisp}s
            </span>
          </div>
        </div>

        {/* Bar Waktu */}
        <div className="h-2 w-full bg-[#f3ead5]">
          <div
            className={`h-full transition-all duration-100 ${
              ratio <= 0.25 ? 'bg-[#e2312d]' : isP1 ? 'bg-[#ff7a59]' : 'bg-[#1d8fe0]'
            }`}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>

        <div className="p-4 sm:p-5 space-y-3.5">
          <div className="space-y-3">
            {soal.isBonusKulitPisang && (
              <div className="p-2.5 rounded-xl bg-amber-50 border-2 border-amber-300 text-xs font-extrabold text-amber-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  SOAL BONUS KULIT PISANG! Jawab benar untuk mendapat Perisai Pelindung (posisi tidak turun jika salah).
                </span>
              </div>
            )}

            {renderPlayerCardEffects(p)}

            <p className="text-base sm:text-lg font-extrabold text-[#2b2a4a] leading-snug">
              {soal.teks}
            </p>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2">
              {soal.opsi.map((o) => {
                const isRevealed = Boolean(reveal);
                const isDipilih = reveal?.choiceIdDipilih === o.choiceId;
                const isKunci = reveal?.feedback.kunciKey === o.key;

                let btnClass =
                  'bg-[#fffdf6] border-[#e0d5b8] text-[#2b2a4a] hover:border-[#2b2a4a] hover:bg-[#fff6dc]';
                if (isRevealed) {
                  if (isKunci) {
                    btnClass = 'bg-[#e9f9ef] border-[#1f9d55] text-[#136837]';
                  } else if (isDipilih) {
                    btnClass = 'bg-[#fdecec] border-[#e2312d] text-[#8a1f1f]';
                  } else {
                    btnClass = 'bg-[#f8f5ec] border-[#e8dfc8] text-[#8c8b9e] opacity-75';
                  }
                }

                return (
                  <button
                    key={o.choiceId}
                    type="button"
                    disabled={sesi.state !== 'PLAYING' || isRevealed}
                    onClick={() => handleJawabSlot(slot, soal, o.choiceId, false)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border-2 font-bold text-sm transition-all flex items-center gap-3 cursor-pointer disabled:cursor-default ${btnClass}`}
                  >
                    <span className="w-7 h-7 rounded-lg bg-[#f4ecd8] border border-[#d7caa7] flex items-center justify-center text-xs font-extrabold text-[#2b2a4a] shrink-0">
                      {o.key}
                    </span>
                    <span className="flex-1 break-words">{o.teks}</span>
                    {isRevealed && isKunci && (
                      <CheckCircle2 className="w-4 h-4 text-[#1f9d55] shrink-0" />
                    )}
                    {isRevealed && isDipilih && !isKunci && (
                      <XCircle className="w-4 h-4 text-[#e2312d] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {reveal && (
              <div
                className={`p-3 rounded-xl border-2 text-xs font-bold ${
                  reveal.feedback.benar
                    ? 'bg-[#e9f9ef] border-[#9de0b6] text-[#136837]'
                    : 'bg-[#fdecec] border-[#f4b6b6] text-[#8a1f1f]'
                }`}
              >
                <p>{buildFeedbackSummary(reveal.feedback)}</p>
                {reveal.feedback.penjelasan && (
                  <p className="mt-1 font-medium opacity-90">{reveal.feedback.penjelasan}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bk-festival">
      {/* PANGGUNG FESTIVAL BERSAMA TUNGGAL (PERSIS DESAIN panjat-pinang-solo.html) */}
      <PanjatPinangStage
        tiangList={tiangStageSolo}
        crowdCheer={crowdCheer || sesi.isFinished}
        title="Panjat Pinang Solo 1 vs 1"
        subtitle={`${sesi.templateJudul} • ${isDuelLokal ? 'Duel Lokal (2 Orang)' : 'Lawan Bot AI'}`}
        statusLabel={badge.text}
        targetLabel="Target Puncak 100%"
        ruleSummary={`Benar +${sesi.config.naikBenar}% • Salah -${sesi.config.turunSalah}% • ${timerSec} dtk/soal`}
        onBack={handleKembaliClick}
        backLabel={returnUrl.includes('panjat-pinang') ? 'Pengaturan' : 'Dashboard'}
        onUlang={sesi.state !== 'READY' ? () => setModalUlangOpen(true) : undefined}
        onTogglePause={
          sesi.state === 'PLAYING' || sesi.state === 'PAUSED' ? handleTogglePause : undefined
        }
        isPaused={sesi.state === 'PAUSED'}
        onStop={!sesi.isFinished && sesi.state !== 'READY' ? () => setModalHentikanOpen(true) : undefined}
        stopLabel="Akhiri"
      />

      <main className="bk-wrap space-y-5">
        {actionError && (
          <div className="p-3 rounded-2xl bg-[#fdecec] border-2 border-[#f4b6b6] text-[#8a1f1f] text-xs font-extrabold flex items-center justify-between gap-2">
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

        {/* FASE 1: LAYAR PERSIAPAN DUEL 1 VS 1 (READY) */}
        {sesi.state === 'READY' && (
          <section className="bk-card space-y-6 mt-2">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b-2 border-dashed border-[#f0dfb4] pb-5">
              <div>
                <span className="inline-flex items-center gap-1.5 bk-chip blue">
                  {isDuelLokal ? (
                    <>
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span>Duel Lokal • 2 Peserta di 1 Layar</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-3.5 h-3.5 shrink-0" />
                      <span>Solo vs Bot AI • Tanpa HP Siswa</span>
                    </>
                  )}
                </span>
                <h2 className="bk-h text-2xl sm:text-3xl font-extrabold text-[#2b2a4a] mt-2">
                  Siap Memanjat Tiang Pinang?
                </h2>
                <p className="text-sm text-[#6b6a85] mt-1">
                  Pemanjat pertama yang mencapai puncak <strong className="text-[#2b2a4a]">100%</strong>{' '}
                  menjadi Juara 1!
                </p>
              </div>

              <button
                type="button"
                disabled={isActionLoading}
                onClick={handleMulai}
                className="bk-btn text-base px-6 py-3 shrink-0"
              >
                {isActionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                Mulai Lomba 1 vs 1!
              </button>
            </div>

            {/* Kartu VS Dua Karakter 2D (Sesuai Desain panjat-pinang-solo.html BUFF) */}
            <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
              <div className="md:col-span-5 bg-[#fdecec]/60 border-2 border-[#f4b6b6] rounded-2xl p-5 flex items-center gap-4">
                <PanjatClimberAvatar
                  look={{ skin: '#d9a066', hair: '#241a14', hs: 0, tp: 'none', sh: '#e2312d', bulk: true }}
                  state="idle"
                  width={68}
                  height={108}
                />
                <div className="min-w-0">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#e2312d]">
                    Pemanjat 1 (Kiri)
                  </span>
                  <h3 className="bk-h text-2xl font-extrabold text-[#2b2a4a] truncate">
                    {sesi.pemain1.nama}
                  </h3>
                  <p className="text-xs font-bold text-[#6b6a85]">Posisi Awal: 0%</p>
                </div>
              </div>

              <div className="md:col-span-1 flex justify-center">
                <div className="w-12 h-12 rounded-full bg-[#ffb81c] border-[3px] border-[#2b2a4a] flex items-center justify-center font-black text-[#2b2a4a] shadow-sm">
                  <Swords className="w-5 h-5" />
                </div>
              </div>

              <div className="md:col-span-5 bg-[#e6f3fd] border-2 border-[#93c5fd] rounded-2xl p-5 flex items-center gap-4">
                <PanjatClimberAvatar
                  look={{ skin: '#8d5a3b', hair: '#111', hs: 1, tp: 'none', sh: '#1d8fe0', bulk: true }}
                  state="idle"
                  width={68}
                  height={108}
                />
                <div className="min-w-0">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#1d8fe0]">
                    {sesi.isBotLawan ? 'Lawan Bot AI (Kanan)' : 'Pemanjat 2 (Kanan)'}
                  </span>
                  <h3 className="bk-h text-2xl font-extrabold text-[#2b2a4a] truncate">
                    {sesi.pemain2.nama}
                  </h3>
                  <p className="text-xs font-bold text-[#6b6a85]">
                    {sesi.isBotLawan ? LABEL_BOT_KESULITAN[sesi.config.kesulitanBot] : 'Posisi Awal: 0%'}
                  </p>
                </div>
              </div>
            </div>

            {/* Pengaturan Tingkat Kesulitan Bot Live (Saat Solo vs Bot) */}
            {sesi.isBotLawan && (
              <div className="bg-[#fff3d6] border-2 border-[#f0dfb4] rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#2b2a4a] flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-[#e2312d]" /> Kecepatan &amp; Akurasi Lawan Bot
                  </span>
                  {updatingBot && (
                    <span className="text-[11px] font-bold text-[#6b6a85] flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Menyimpan...
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'santai', label: 'Bot Santai', desc: '62% akurat' },
                      { key: 'sedang', label: 'Bot Sedang', desc: '78% akurat' },
                      { key: 'cepat', label: 'Bot Cepat', desc: '90% akurat' },
                    ] as const
                  ).map((item) => {
                    const active = sesi.config.kesulitanBot === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        disabled={updatingBot}
                        onClick={() => handleUbahKesulitanBot(item.key)}
                        className={`py-2 px-3 rounded-xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                          active
                            ? 'bg-[#2b2a4a] text-[#fff3d6] border-[#2b2a4a]'
                            : 'bg-white text-[#2b2a4a] border-[#e0d5b8] hover:border-[#2b2a4a]/50'
                        }`}
                      >
                        <div>{item.label}</div>
                        <div className="text-[10px] font-normal opacity-80">{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ringkasan Aturan Sesi */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bk-chip">
                <Flag className="w-3.5 h-3.5" /> {sesi.totalSoal} Soal Bank
              </span>
              <span className="bk-chip live">Benar +{sesi.config.naikBenar}%</span>
              <span className="bk-chip red">Salah / Habis Waktu -{sesi.config.turunSalah}%</span>
              <span className="bk-chip blue">Timer {timerSec} dtk / soal</span>
              {sesi.config.bonusStreakAktif && (
                <span className="bk-chip">
                  Streak 3 (+{sesi.config.bonusStreak3}%) &amp; 5 (+{sesi.config.bonusStreak5}%)
                </span>
              )}
              {sesi.config.rintanganAktif && (
                <span className="bk-chip">
                  <Zap className="w-3.5 h-3.5" /> Rintangan Aktif ({sesi.config.peluangRintanganPersen}%)
                </span>
              )}
            </div>
          </section>
        )}

        {/* FASE 2 & 3: ARENA DUAL TIANG PINANG + SOAL ATAU PODIUM AKHIR */}
        {sesi.state !== 'READY' && (
          <>
            {/* Header Baris Status Duel 1 vs 1 */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="bk-h text-xl font-extrabold text-[#2b2a4a] flex items-center gap-2">
                  <Flag className="w-4 h-4 text-[#e2312d]" />
                  Arena Panjat Pinang 1 vs 1
                </h2>
                <p className="text-xs font-bold text-[#6b6a85]">
                  {sesi.pemain1.nama} ({sesi.pemain1.posisi}%) vs {sesi.isBotLawan ? 'Lawan Bot' : sesi.pemain2.nama} ({sesi.pemain2.posisi}%)
                </p>
              </div>

              {sesi.isBotLawan && sesi.state === 'PLAYING' && (
                <div className="flex items-center gap-1.5">
                  {(['santai', 'sedang', 'cepat'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      disabled={updatingBot}
                      onClick={() => handleUbahKesulitanBot(lvl)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold cursor-pointer transition-all ${
                        sesi.config.kesulitanBot === lvl
                          ? 'bg-[#2b2a4a] text-[#fff3d6] border-[#2b2a4a]'
                          : 'bg-[#fffdf6] text-[#2b2a4a] border-[#e0d5b8] hover:border-[#2b2a4a]'
                      }`}
                    >
                      {lvl === 'santai' ? 'Santai' : lvl === 'sedang' ? 'Sedang' : 'Cepat'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pita Status Pause */}
            {sesi.state === 'PAUSED' && (
              <div className="p-3.5 rounded-2xl bg-[#fff3c4] border-2 border-[#ffb81c] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-extrabold text-[#7a5200]">
                  <Pause className="w-4 h-4" />
                  Permainan sedang dijeda. Waktu soal dan aksi Bot ditahan.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    disabled={isActionLoading}
                    className="bk-btn !py-1.5 !px-3.5 !text-xs"
                  >
                    <Play className="w-3.5 h-3.5" /> Lanjutkan
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalUlangOpen(true)}
                    className="bk-btn alt !py-1.5 !px-3.5 !text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Ulang
                  </button>
                </div>
              </div>
            )}

            {/* Panel Soal Duo Saat Bermain / Jeda (Sesuai Desain panjat-pinang-solo.html) */}
            {(sesi.state === 'PLAYING' || sesi.state === 'PAUSED') && !showEndCard && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {renderQuestionPanel('pemain1')}
                {isDuelLokal ? renderQuestionPanel('pemain2') : renderBotPanel()}
              </div>
            )}

            {/* FASE 3: PODIUM & LAPORAN AKHIR */}
            {sesi.isFinished && showEndCard && (
              <div className="space-y-5">
                <section className="bk-card space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-dashed border-[#f0dfb4] pb-4">
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold mb-1.5 ${
                          sesi.state === 'STOPPED'
                            ? 'bg-[#fff3c4] text-[#7a5200]'
                            : 'bg-[#e9f9ef] text-[#1f9d55]'
                        }`}
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        {sesi.state === 'STOPPED'
                          ? 'Lomba Dihentikan Manual'
                          : sesi.winnerSlot === 'SERI'
                          ? 'Hasil Seri Imbang!'
                          : `${sesi.winnerNama} Mencapai Puncak!`}
                      </span>
                      <h2 className="bk-h text-2xl sm:text-3xl font-extrabold text-[#2b2a4a]">
                        Hasil Duel Panjat Pinang 1 vs 1
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isMainLagi}
                        onClick={handleMainLagi}
                        className="bk-btn"
                      >
                        {isMainLagi ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Main Lagi
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(returnUrl)}
                        className="bk-btn alt"
                      >
                        Selesai
                      </button>
                    </div>
                  </div>

                  {/* Podium Juara 1 & 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {juara1 && (
                      <div className="bg-gradient-to-b from-[#fff3c4] to-[#fff3d6] border-[3px] border-[#ffb81c] rounded-2xl p-5 text-center flex flex-col items-center">
                        <PanjatClimberAvatar
                          look={
                            juara1.id === 'pemain1'
                              ? { skin: '#d9a066', hair: '#241a14', hs: 0, tp: 'none', sh: '#e2312d', bulk: true }
                              : { skin: '#8d5a3b', hair: '#111', hs: 1, tp: 'none', sh: '#1d8fe0', bulk: true }
                          }
                          state="win"
                          width={82}
                          height={124}
                          className="mb-2"
                        />
                        <span className="px-3 py-0.5 rounded-full bg-[#ffb81c] text-[#4a3000] text-xs font-extrabold mb-1">
                          {sesi.winnerSlot === 'SERI' ? 'Peringkat Seri' : 'Juara 1 • Pemenang'}
                        </span>
                        <h3 className="bk-h text-2xl font-extrabold text-[#e2312d] truncate max-w-full">
                          {juara1.nama}
                        </h3>
                        <p className="bk-h text-3xl font-extrabold text-[#2b2a4a]">
                          {juara1.posisi}%
                        </p>
                        <p className="text-xs font-bold text-[#6b6a85] mt-1">
                          Benar {juara1.totalBenar} • Salah {juara1.totalSalah} • Jatuh ke dasar {juara1.jatuhKeDasar ?? 0}x • Streak Maks{' '}
                          {juara1.streakTertinggi}x •{' '}
                          {juara1.waktuSelesaiMs
                            ? `Selesai ${formatDurasiDetik(juara1.waktuSelesaiMs)}`
                            : `Rata-rata ${formatDurasiDetik(juara1.rataRataWaktuJawabMs)}`}
                        </p>
                      </div>
                    )}

                    {juara2 && (
                      <div className="bg-[#fffaf0] border-2 border-[#cbd5e1] rounded-2xl p-5 text-center flex flex-col items-center">
                        <PanjatClimberAvatar
                          look={
                            juara2.id === 'pemain1'
                              ? { skin: '#d9a066', hair: '#241a14', hs: 0, tp: 'none', sh: '#e2312d', bulk: true }
                              : { skin: '#8d5a3b', hair: '#111', hs: 1, tp: 'none', sh: '#1d8fe0', bulk: true }
                          }
                          state="idle"
                          width={72}
                          height={110}
                          className="mb-2"
                        />
                        <span className="px-3 py-0.5 rounded-full bg-[#dfe3ee] text-[#394060] text-xs font-extrabold mb-1">
                          {sesi.winnerSlot === 'SERI' ? 'Peringkat Seri' : 'Juara 2 • Runner-up'}
                        </span>
                        <h3 className="bk-h text-xl font-extrabold text-[#2b2a4a] truncate max-w-full">
                          {juara2.nama}
                        </h3>
                        <p className="bk-h text-2xl font-extrabold text-[#1d8fe0]">
                          {juara2.posisi}%
                        </p>
                        <p className="text-xs font-bold text-[#6b6a85] mt-1">
                          Benar {juara2.totalBenar} • Salah {juara2.totalSalah} • Jatuh ke dasar {juara2.jatuhKeDasar ?? 0}x • Streak Maks{' '}
                          {juara2.streakTertinggi}x • Rata-rata{' '}
                          {formatDurasiDetik(juara2.rataRataWaktuJawabMs)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Ringkasan Tabel Kedua Pemain + Rintangan */}
                  <div className="bk-hm-wrap">
                    <table className="bk-hm text-left">
                      <thead>
                        <tr>
                          <th className="nm px-3 py-2.5">Pemanjat</th>
                          <th className="px-3 py-2.5 text-right">Posisi</th>
                          <th className="px-3 py-2.5 text-right">Bonus</th>
                          <th className="px-3 py-2.5 text-center">Benar / Salah</th>
                          <th className="px-3 py-2.5 text-right">Akurasi</th>
                          <th className="px-3 py-2.5 text-right">Streak Maks</th>
                          <th className="px-3 py-2.5 text-right">Rata Jawab</th>
                          <th className="px-3 py-2.5 text-center">Rintangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[sesi.pemain1, sesi.pemain2].map((pm) => {
                          const totalJawab = pm.totalBenar + pm.totalSalah;
                          const akurasi =
                            totalJawab > 0 ? Math.round((pm.totalBenar / totalJawab) * 100) : 0;
                          return (
                            <tr key={pm.id}>
                              <td className="nm px-3 py-2.5 font-extrabold text-[#2b2a4a]">
                                {pm.nama}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[#1f9d55]">
                                {pm.posisi}%
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-[#c48300]">
                                {pm.poinBonus > 0 ? `+${pm.poinBonus}` : '-'}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono">
                                <span className="text-[#1f9d55] font-extrabold">
                                  {pm.totalBenar}
                                </span>
                                <span className="text-[#9e9cb3] mx-1">/</span>
                                <span className="text-[#d63b3b] font-extrabold">
                                  {pm.totalSalah}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-extrabold">
                                {akurasi}%
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[#e6a100]">
                                {pm.streakTertinggi}x
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[#6b6a85]">
                                {formatDurasiDetik(pm.rataRataWaktuJawabMs)}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => setDetailPemain(pm)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#fff3d6] hover:bg-[#ffe9a8] border border-[#f0dfb4] text-[#2b2a4a] font-extrabold cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{pm.riwayatRintangan?.length || 0}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Statistik Per Soal */}
                {sesi.questionStats && sesi.questionStats.length > 0 && (
                  <section className="bk-card space-y-3">
                    <h3 className="bk-h text-lg font-extrabold text-[#2b2a4a]">
                      Statistik Tingkat Kesulitan Soal
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sesi.questionStats.map((sq) => {
                        const total = sq.jumlahBenar + sq.jumlahSalah;
                        const salahPct =
                          total > 0 ? Math.round((sq.jumlahSalah / total) * 100) : 0;
                        return (
                          <div
                            key={sq.questionId}
                            className="bg-[#fffaf0] border-2 border-[#f0dfb4] rounded-2xl p-3.5 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <span className="text-[10px] font-extrabold uppercase text-[#6b6a85]">
                                Soal #{sq.nomorSoal}
                              </span>
                              <p className="text-xs font-bold text-[#2b2a4a] line-clamp-2">
                                {sq.teksSoal}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-mono font-extrabold text-[#1f9d55] block">
                                {sq.jumlahBenar} Benar
                              </span>
                              <span className="text-[11px] font-mono font-bold text-[#d63b3b]">
                                {sq.jumlahSalah} Salah ({salahPct}%)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal Ulang Permainan */}
      <Modal
        isOpen={modalUlangOpen}
        onClose={() => setModalUlangOpen(false)}
        title="Ulang Lomba dari Posisi Awal?"
        maxWidth="md"
        variant="standard"
      >
        <div className="space-y-4 text-sm text-[#2b2a4a]">
          <p className="text-[#6b6a85] leading-relaxed">
            Kedua pemanjat akan dikembalikan ke posisi <strong className="font-mono text-[#2b2a4a]">0%</strong> dan
            seluruh skor sementara pada sesi ini akan direset ke status Siap.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalUlangOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#e0d5b8] bg-[#fffdf6] hover:bg-[#f4ecd8] text-xs font-extrabold text-[#2b2a4a] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isActionLoading}
              onClick={handleUlang}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#e2312d] hover:bg-[#c82723] text-white text-xs font-extrabold shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Ya, Ulang Lomba
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Hentikan Permainan */}
      <Modal
        isOpen={modalHentikanOpen}
        onClose={() => setModalHentikanOpen(false)}
        title="Akhiri Lomba Panjat Pinang?"
        maxWidth="md"
        variant="standard"
      >
        <div className="space-y-4 text-sm text-[#2b2a4a]">
          <p className="text-[#6b6a85] leading-relaxed">
            Permainan akan dihentikan sekarang, peringkat saat ini akan disimpan ke Riwayat, dan
            podium hasil akhir langsung ditampilkan.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalHentikanOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#e0d5b8] bg-[#fffdf6] hover:bg-[#f4ecd8] text-xs font-extrabold text-[#2b2a4a] cursor-pointer"
            >
              Lanjutkan Lomba
            </button>
            <button
              type="button"
              disabled={isActionLoading}
              onClick={handleHentikan}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#e2312d] hover:bg-[#c82723] text-white text-xs font-extrabold shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
              Ya, Akhiri Sekarang
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Riwayat Rintangan Pemain */}
      <Modal
        isOpen={Boolean(detailPemain)}
        onClose={() => setDetailPemain(null)}
        title={detailPemain ? `Riwayat Rintangan: ${detailPemain.nama}` : 'Riwayat Rintangan'}
        maxWidth="md"
        variant="standard"
      >
        {detailPemain && (
          <div className="space-y-3 text-xs text-[#2b2a4a]">
            {detailPemain.riwayatRintangan.length === 0 ? (
              <p className="text-[#6b6a85] italic bg-[#fffaf0] border border-[#f0dfb4] p-3 rounded-xl">
                Pemain ini tidak mengalami rintangan selama duel.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {detailPemain.riwayatRintangan.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-[#fff3c4] border border-[#ffb81c] flex items-start justify-between gap-2"
                  >
                    <div>
                      <p className="font-extrabold text-[#7a5200]">{r.judul}</p>
                      <p className="text-[#6b4423] mt-0.5">{r.deskripsi}</p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-white border border-[#f0dfb4] font-mono font-bold text-[#7a5200]">
                      {r.efekNilai !== 0
                        ? `${r.efekNilai > 0 ? '+' : ''}${r.efekNilai} ${r.satuan}`
                        : r.satuan}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Konfirmasi Keluar Game Sedang Berjalan */}
      <ModalKonfirmasiKeluar
        isOpen={modalKeluarOpen}
        onClose={() => setModalKeluarOpen(false)}
        onKonfirmasiKeluar={handleKonfirmasiKeluar}
        judulGame="Panjat Pinang"
      />
    </div>
  );
}
