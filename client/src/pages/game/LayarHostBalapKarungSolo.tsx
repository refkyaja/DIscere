import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components';
import LintasanBalapKarung, { EfekAktifBalapVisual } from '../siswa/LintasanBalapKarung';
import KarakterBalapKarung, { EkspresiBalapKarung } from '../siswa/KarakterBalapKarung';
import { soundEffects } from '../../lib/soundEffects';
import {
  Play,
  Pause,
  StopCircle,
  RotateCcw,
  ArrowLeft,
  Volume2,
  VolumeX,
  Trophy,
  Flame,
  Scale,
  CheckCircle2,
  XCircle,
  Loader2,
  Bot,
  Swords,
  RefreshCw,
  Sliders,
  AlertTriangle,
  Shield,
  Zap,
  CloudRain,
  Flag,
} from 'lucide-react';

type StateBalapSolo = 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED' | 'STOPPED';
type SlotPemain = 'pemain1' | 'pemain2';

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
}

interface RiwayatRintanganItem {
  id: string;
  tipe: string;
  judul: string;
  deskripsi: string;
  efekNilai: number;
  satuan: string;
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
  totalBonusStreakKali: number;
  totalBonusStreakMeter: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs: number | null;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  efekAktif?: EfekAktifBalapVisual;
  riwayatRintangan: RiwayatRintanganItem[];
  soalAktif: SoalAktifSolo | null;
}

interface FeedbackAksi {
  slot: SlotPemain;
  nama: string;
  benar: boolean;
  jawabanBenarKode: string;
  jawabanBenarTeks: string;
  penjelasan: string | null;
  jarakSebelum: number;
  jarakBaru: number;
  perubahanJarak: number;
  keseimbanganBaru: number;
  streakSaatIni: number;
  terjatuh: boolean;
  penaltiJatuhJarak: number;
  perisaiDigunakan: boolean;
  rintanganBaru: RiwayatRintanganItem | null;
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
    kesulitan: string;
    lompatBenar: number;
    turunSalah: number;
    keseimbanganAktif: boolean;
    bonusStreakAktif: boolean;
    rintanganAktif: boolean;
    tipeLawanSolo: 'bot' | 'lokal';
    kesulitanBot: 'santai' | 'sedang' | 'cepat';
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
    totalJatuhKelas?: number;
    questionStats?: Array<{
      questionId: string;
      nomorSoal?: number;
      teksSoal?: string;
      jumlahBenar?: number;
      jumlahSalah?: number;
    }>;
  } | null;
}

const LABEL_STATE: Record<StateBalapSolo, { teks: string; warna: string }> = {
  READY: { teks: 'SIAP DIMULAI', warna: 'bg-sky-500/20 text-sky-200 border-sky-400/50' },
  PLAYING: { teks: 'LOMBA BERLANGSUNG', warna: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50' },
  PAUSED: { teks: 'DIJEDA', warna: 'bg-amber-500/20 text-amber-200 border-amber-400/50' },
  FINISHED: { teks: 'SELESAI — JUARA TERPILIH', warna: 'bg-amber-400 text-slate-950 border-amber-300' },
  STOPPED: { teks: 'DIHENTIKAN GURU', warna: 'bg-slate-600 text-white border-slate-500' },
};

const BOT_INTERVAL_MS: Record<'santai' | 'sedang' | 'cepat', number> = {
  santai: 5200,
  sedang: 3600,
  cepat: 2300,
};

function formatDetik(ms?: number | null): string {
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

  // State animasi lintasan masing-masing pemain (strictly 1 vs 1)
  const [deltaMap, setDeltaMap] = useState<Record<SlotPemain, number | null>>({
    pemain1: null,
    pemain2: null,
  });
  const [ekspresiMap, setEkspresiMap] = useState<Record<SlotPemain, EkspresiBalapKarung>>({
    pemain1: 'netral',
    pemain2: 'netral',
  });
  const [jatuhMap, setJatuhMap] = useState<Record<SlotPemain, boolean>>({
    pemain1: false,
    pemain2: false,
  });
  const [feedbackMap, setFeedbackMap] = useState<Record<SlotPemain, FeedbackAksi | null>>({
    pemain1: null,
    pemain2: null,
  });
  const [submittingMap, setSubmittingMap] = useState<Record<SlotPemain, boolean>>({
    pemain1: false,
    pemain2: false,
  });

  const submitLockRef = useRef<Record<SlotPemain, boolean>>({
    pemain1: false,
    pemain2: false,
  });
  const botTickLockRef = useRef(false);
  const timersRef = useRef<Record<SlotPemain, ReturnType<typeof setTimeout> | null>>({
    pemain1: null,
    pemain2: null,
  });

  const clearSlotTimer = (slot: SlotPemain) => {
    const existing = timersRef.current[slot];
    if (existing) {
      clearTimeout(existing);
      timersRef.current[slot] = null;
    }
  };

  useEffect(() => {
    return () => {
      clearSlotTimer('pemain1');
      clearSlotTimer('pemain2');
    };
  }, []);

  const triggerSlotVisual = useCallback((fb: FeedbackAksi, playAudio: boolean) => {
    const slot = fb.slot;
    setFeedbackMap((prev) => ({ ...prev, [slot]: fb }));
    setDeltaMap((prev) => ({ ...prev, [slot]: fb.perubahanJarak }));
    const exp: EkspresiBalapKarung = fb.selesaiBaru
      ? 'puncak'
      : fb.terjatuh && !fb.perisaiDigunakan
      ? 'terjatuh'
      : fb.benar
      ? 'bahagia'
      : 'sedih';
    setEkspresiMap((prev) => ({ ...prev, [slot]: exp }));
    if (fb.terjatuh && !fb.perisaiDigunakan) {
      setJatuhMap((prev) => ({ ...prev, [slot]: true }));
    }

    if (playAudio) {
      if (fb.selesaiBaru) {
        soundEffects.playVictoryFanfare();
      } else if (fb.terjatuh && !fb.perisaiDigunakan) {
        soundEffects.playZonk();
      } else if (fb.benar) {
        soundEffects.playCorrect();
        if (fb.streakSaatIni >= 3) {
          setTimeout(() => soundEffects.playBoost(), 180);
        }
      } else {
        soundEffects.playIncorrect();
      }
    } else if (fb.selesaiBaru) {
      soundEffects.playVictoryFanfare();
    }

    clearSlotTimer(slot);
    if (!fb.selesaiBaru) {
      timersRef.current[slot] = setTimeout(() => {
        setDeltaMap((prev) => ({ ...prev, [slot]: null }));
        setJatuhMap((prev) => ({ ...prev, [slot]: false }));
        setEkspresiMap((prev) => ({ ...prev, [slot]: 'netral' }));
      }, 1700);
    }
  }, []);

  const fetchSesi = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await apiRequest<{ session: SesiBalapSoloClient }>(`/sesi/${id}`);
      setSesi(res.session);
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

    const intervalMs = BOT_INTERVAL_MS[sesi.config.kesulitanBot] || 3600;
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
  }, [id, sesi?.state, sesi?.config?.tipeLawanSolo, sesi?.config?.kesulitanBot, sesi?.isFinished, triggerSlotVisual]);

  const handleMulai = async () => {
    if (!id || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      const res = await apiRequest<{ session: SesiBalapSoloClient }>(`/sesi/${id}/mulai`, {
        method: 'POST',
      });
      soundEffects.playWhistle();
      setFeedbackMap({ pemain1: null, pemain2: null });
      setEkspresiMap({ pemain1: 'netral', pemain2: 'netral' });
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

  const handleJawab = async (slot: SlotPemain, soal: SoalAktifSolo, choiceId: string) => {
    if (!id || !sesi || sesi.state !== 'PLAYING') return;
    if (submitLockRef.current[slot]) return;

    submitLockRef.current[slot] = true;
    setSubmittingMap((prev) => ({ ...prev, [slot]: true }));
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
          choiceId,
        }),
      });

      setSesi(res.session);
      if (res.feedback) {
        triggerSlotVisual(res.feedback, true);
      }
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal mengirim jawaban.');
    } finally {
      submitLockRef.current[slot] = false;
      setSubmittingMap((prev) => ({ ...prev, [slot]: false }));
    }
  };

  const handleUlang = async () => {
    if (!id || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      const res = await apiRequest<{ session: SesiBalapSoloClient }>(`/sesi/${id}/ulang`, {
        method: 'POST',
      });
      setModalUlangOpen(false);
      setFeedbackMap({ pemain1: null, pemain2: null });
      setDeltaMap({ pemain1: null, pemain2: null });
      setJatuhMap({ pemain1: false, pemain2: false });
      setEkspresiMap({ pemain1: 'netral', pemain2: 'netral' });
      setSesi(res.session);
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
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal menghentikan permainan.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMainLagi = async () => {
    if (!id || isMainLagi) return;
    try {
      setIsMainLagi(true);
      const res = await apiRequest<{ sessionId?: string; session?: { id: string } }>(
        `/sesi/${id}/main-lagi`,
        { method: 'POST' }
      );
      const nextId = res.session?.id || res.sessionId;
      if (nextId) {
        navigate(`/guru/sesi/${nextId}?kembali=${encodeURIComponent(returnUrl)}`);
      }
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal membuat sesi baru.');
    } finally {
      setIsMainLagi(false);
    }
  };

  const handleToggleSound = () => {
    setIsMuted(soundEffects.toggleMute());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-amber-400 mb-3" />
        <p className="text-sm font-bold text-slate-300">Menyiapkan Lintasan 1 vs 1 Balap Karung...</p>
      </div>
    );
  }

  if (errorPesan || !sesi) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-6 text-center space-y-4">
          <h2 className="text-xl font-black">Sesi Tidak Tersedia</h2>
          <p className="text-sm text-slate-400">{errorPesan || 'Sesi tidak ditemukan.'}</p>
          <button
            type="button"
            onClick={() => navigate(returnUrl)}
            className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-sm cursor-pointer"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const stateBadge = LABEL_STATE[sesi.state];
  const isFinished = sesi.state === 'FINISHED' || sesi.state === 'STOPPED';
  const targetJarak = sesi.config.targetJarak || 100;
  const keseimbanganAktif = sesi.config.keseimbanganAktif !== false;
  const isDuelLokal = sesi.config.tipeLawanSolo === 'lokal';

  const juara1 = sesi.leaderboard[0];
  const juara2 = sesi.leaderboard[1];

  const renderPanelSoalPemain = (
    peserta: PesertaBalapSolo,
    slot: SlotPemain,
    accent: 'red' | 'blue'
  ) => {
    const soal = peserta.soalAktif;
    const fb = feedbackMap[slot];
    const isSubmitting = submittingMap[slot];
    const headerBorder =
      accent === 'red' ? 'border-rose-500/40 bg-rose-950/30' : 'border-sky-500/40 bg-sky-950/30';
    const tagBg =
      accent === 'red' ? 'bg-rose-500 text-white' : 'bg-sky-500 text-slate-950';

    return (
      <div
        className={`bg-slate-800/90 border-2 rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-xl ${
          accent === 'red' ? 'border-rose-500/40' : 'border-sky-500/40'
        }`}
      >
        <div className="space-y-3">
          <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-2xl border ${headerBorder}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black uppercase ${tagBg}`}>
                {slot === 'pemain1' ? 'Avatar 1' : 'Avatar 2'}
              </span>
              <span className="font-black text-sm text-white truncate">{peserta.nama}</span>
            </div>
            {soal && (
              <span className="text-xs font-mono font-bold text-slate-300 shrink-0">
                Soal #{soal.nomorSoal}
              </span>
            )}
          </div>

          {fb && (
            <div
              className={`px-3 py-2 rounded-xl border text-xs font-bold flex flex-wrap items-center justify-between gap-2 ${
                fb.benar
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {fb.benar ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                {fb.benar
                  ? `Benar! ${fb.perubahanJarak >= 0 ? `+${fb.perubahanJarak}` : fb.perubahanJarak}m`
                  : `Salah (Kunci: ${fb.jawabanBenarKode})`}
              </span>
              {fb.rintanganBaru && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-200">
                  {fb.rintanganBaru.judul}
                </span>
              )}
              {fb.terjatuh && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-rose-500/30 text-rose-100">
                  {fb.perisaiDigunakan ? 'Perisai Menahan Jatuh!' : `Terjatuh -${fb.penaltiJatuhJarak}m`}
                </span>
              )}
            </div>
          )}

          {soal ? (
            <div className="space-y-3">
              <div className="bg-slate-900/70 border border-slate-700/80 rounded-2xl p-4">
                <p className="text-sm sm:text-base font-bold text-white leading-relaxed">
                  {soal.teks}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {soal.pilihan.map((opt) => (
                  <button
                    key={opt.choiceId}
                    type="button"
                    disabled={isSubmitting || sesi.state !== 'PLAYING'}
                    onClick={() => handleJawab(slot, soal, opt.choiceId)}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-700/80 border border-slate-700 hover:border-amber-400/70 transition-all flex items-center gap-3 cursor-pointer disabled:opacity-50"
                  >
                    <span className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                      {opt.key}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-100 leading-snug">
                      {opt.teks}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-slate-400">
              Menunggu soal disiapkan...
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950/75 to-slate-900 text-white p-4 sm:p-6 flex flex-col gap-5 select-none">
      {/* Header Kontrol Guru */}
      <header className="max-w-7xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 bg-slate-800/85 border border-slate-700 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(returnUrl)}
            className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer"
            title="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase ${stateBadge.warna}`}>
                {stateBadge.teks}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-200 text-[10px] font-black uppercase inline-flex items-center gap-1">
                {isDuelLokal ? <Swords className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                Solo 1 vs 1 • {isDuelLokal ? 'Duel Lokal' : `Lawan Bot (${sesi.config.kesulitanBot})`}
              </span>
              <span className="text-xs text-amber-300 font-mono font-bold">
                Target {targetJarak}m
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white mt-0.5">{sesi.templateJudul}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSound}
            className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer"
            title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>

          {sesi.state === 'READY' && (
            <button
              type="button"
              onClick={handleMulai}
              disabled={isActionLoading}
              className="px-4 py-2 rounded-xl bg-[#D7262E] hover:bg-[#b81e25] text-white font-black text-xs inline-flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-60"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Mulai Lomba 1 vs 1
            </button>
          )}

          {(sesi.state === 'PLAYING' || sesi.state === 'PAUSED') && (
            <>
              <button
                type="button"
                onClick={handleTogglePause}
                disabled={isActionLoading}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                {sesi.state === 'PLAYING' ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Jeda
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Lanjutkan
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setModalUlangOpen(true)}
                className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Ulang
              </button>
              <button
                type="button"
                onClick={() => setModalHentikanOpen(true)}
                className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <StopCircle className="w-3.5 h-3.5" /> Akhiri
              </button>
            </>
          )}
        </div>
      </header>

      {actionError && (
        <div className="max-w-7xl w-full mx-auto bg-rose-950/70 border border-rose-500/60 text-rose-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Panggung 1 vs 1 (Selalu tepat 2 Avatar di Lintasan!) */}
      {!isFinished && (
        <main className="max-w-7xl w-full mx-auto space-y-5 flex-1 flex flex-col">
          <section className="bg-slate-800/80 border border-slate-700 rounded-3xl p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-400" />
                Arena Lintasan 1 vs 1 • {sesi.pemain1.nama} vs {sesi.pemain2.nama}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span>Benar +{sesi.config.lompatBenar}m</span>
                <span>•</span>
                <span>Salah -{sesi.config.turunSalah}m</span>
                {keseimbanganAktif && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-sky-300">
                      <Scale className="w-3.5 h-3.5" /> Keseimbangan Aktif
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {[
                { data: sesi.pemain1, slot: 'pemain1' as SlotPemain, badgeCls: 'bg-rose-500 text-white' },
                { data: sesi.pemain2, slot: 'pemain2' as SlotPemain, badgeCls: 'bg-sky-500 text-slate-950' },
              ].map(({ data, slot, badgeCls }) => (
                <div
                  key={data.id}
                  className="bg-slate-900/65 border border-slate-700/80 rounded-2xl p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${badgeCls}`}>
                        {slot === 'pemain1' ? 'P1' : data.isBot ? 'BOT' : 'P2'}
                      </span>
                      <span className="font-black text-white">{data.nama}</span>
                      {data.streakSaatIni >= 2 && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] font-black">
                          <Flame className="w-3 h-3" /> {data.streakSaatIni}
                        </span>
                      )}
                      {data.efekAktif?.perisai && (
                        <span className="text-sky-400" title="Perisai Aktif">
                          <Shield className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {data.efekAktif?.lompatanKuat && (
                        <span className="text-amber-400" title="Lompatan Kuat">
                          <Zap className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {data.efekAktif?.jalanBerlumpur && (
                        <span className="text-amber-600" title="Jalan Berlumpur">
                          <CloudRain className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-slate-400">
                        ✓{data.totalBenar} / ✗{data.totalSalah}
                      </span>
                      {data.jumlahJatuh > 0 && (
                        <span className="text-rose-300 font-bold">{data.jumlahJatuh}x Jatuh</span>
                      )}
                      <span className="font-black text-emerald-300">
                        {data.jarak}m / {targetJarak}m
                      </span>
                    </div>
                  </div>

                  <LintasanBalapKarung
                    jarak={data.jarak}
                    targetJarak={targetJarak}
                    keseimbangan={data.keseimbangan}
                    keseimbanganAktif={keseimbanganAktif}
                    namaPemain={data.nama}
                    efekAktif={data.efekAktif}
                    lastDeltaJarak={deltaMap[slot]}
                    ekspresi={ekspresiMap[slot]}
                    terjatuh={jatuhMap[slot]}
                    streak={data.streakSaatIni}
                    status={data.status}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Zona Kuis Interaktif */}
          {sesi.state === 'READY' && (
            <section className="bg-slate-800/80 border-2 border-dashed border-amber-400/50 rounded-3xl p-8 text-center space-y-4">
              <div className="flex items-center justify-center gap-8">
                <div className="flex flex-col items-center">
                  <KarakterBalapKarung nama={sesi.pemain1.nama} size="md" ekspresi="bahagia" />
                  <span className="text-xs font-black text-rose-300 mt-1">{sesi.pemain1.nama}</span>
                </div>
                <span className="text-2xl font-black text-amber-400">VS</span>
                <div className="flex flex-col items-center">
                  <KarakterBalapKarung nama={sesi.pemain2.nama} size="md" ekspresi="bahagia" />
                  <span className="text-xs font-black text-sky-300 mt-1">{sesi.pemain2.nama}</span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">Siap Memulai Duel 1 vs 1?</h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
                  {isDuelLokal
                    ? `Kedua pemain akan menjawab soal bergiliran/bebas secara paralel di layar. Pemain pertama yang menempuh ${targetJarak} meter menang!`
                    : `Jawab kuis secepat dan seakurat mungkin untuk mengalahkan ${sesi.pemain2.nama} mencapai garis finis ${targetJarak} meter!`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleMulai}
                disabled={isActionLoading}
                className="px-8 py-3.5 rounded-2xl bg-[#D7262E] hover:bg-[#b81e25] text-white font-black text-sm inline-flex items-center gap-2 shadow-xl cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> Mulai Lomba Sekarang
              </button>
            </section>
          )}

          {sesi.state === 'PAUSED' && (
            <section className="bg-amber-500/15 border-2 border-amber-400/60 rounded-3xl p-8 text-center space-y-3">
              <h3 className="text-xl font-black text-amber-300">Perlombaan Dijeda</h3>
              <p className="text-xs sm:text-sm text-slate-200">
                Posisi lintasan dan keseimbangan tersimpan aman. Klik Lanjutkan untuk meneruskan duel.
              </p>
              <button
                type="button"
                onClick={handleTogglePause}
                disabled={isActionLoading}
                className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Lanjutkan Lomba
              </button>
            </section>
          )}

          {sesi.state === 'PLAYING' && (
            <section
              className={`grid gap-5 ${
                isDuelLokal ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-3xl w-full mx-auto'
              }`}
            >
              {renderPanelSoalPemain(sesi.pemain1, 'pemain1', 'red')}
              {isDuelLokal && renderPanelSoalPemain(sesi.pemain2, 'pemain2', 'blue')}
              {!isDuelLokal && feedbackMap.pemain2 && (
                <div className="bg-slate-800/80 border border-sky-500/40 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-sky-200 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-sky-400" />
                    Aksi Terakhir {sesi.pemain2.nama}:
                  </span>
                  <span className="font-semibold text-slate-200">
                    {feedbackMap.pemain2.benar
                      ? `Menjawab benar (${feedbackMap.pemain2.perubahanJarak >= 0 ? `+${feedbackMap.pemain2.perubahanJarak}` : feedbackMap.pemain2.perubahanJarak}m)`
                      : `Menjawab salah (${feedbackMap.pemain2.perubahanJarak}m)`}
                    {feedbackMap.pemain2.rintanganBaru
                      ? ` • ${feedbackMap.pemain2.rintanganBaru.judul}`
                      : ''}
                    {feedbackMap.pemain2.terjatuh ? ' • Terjatuh!' : ''}
                  </span>
                </div>
              )}
            </section>
          )}
        </main>
      )}

      {/* Podium & Laporan Akhir 1 vs 1 */}
      {isFinished && (
        <main className="max-w-5xl w-full mx-auto space-y-6 py-4">
          <div className="bg-slate-800/85 border border-amber-500/40 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-black uppercase">
                <Trophy className="w-3.5 h-3.5" /> Hasil Duel 1 vs 1 Balap Karung
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {juara1 ? `Pemenang: ${juara1.nama}!` : 'Perlombaan Selesai'}
              </h2>
              <p className="text-xs text-slate-300">
                {sesi.state === 'STOPPED' || sesi.hasil?.dihentikanManual
                  ? `Permainan dihentikan guru pada target ${targetJarak}m.`
                  : `Menyentuh garis finis ${targetJarak}m paling cepat!`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleMainLagi}
                disabled={isMainLagi}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isMainLagi ? 'animate-spin' : ''}`} /> Main Lagi
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
                className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" /> Ubah Pengaturan
              </button>
              <button
                type="button"
                onClick={() => navigate(returnUrl)}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Selesai
              </button>
            </div>
          </div>

          {/* 2 Kartu Podium 1 vs 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {juara1 && (
              <div className="bg-gradient-to-b from-amber-500/20 to-slate-800/95 border-2 border-amber-400 rounded-3xl p-6 text-center flex flex-col items-center shadow-2xl">
                <KarakterBalapKarung
                  nama={juara1.nama}
                  pose="podium"
                  ekspresi="bahagia"
                  podiumRank={1}
                  size="lg"
                  className="mb-2"
                />
                <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black mb-2">
                  Juara 1 • Pemenang
                </span>
                <h3 className="text-2xl font-black text-white">{juara1.nama}</h3>
                <p className="text-3xl font-black text-amber-300 mt-1">{juara1.jarak} m</p>
                <div className="grid grid-cols-3 gap-3 w-full mt-4 pt-3 border-t border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-400 block">Akurasi</span>
                    <span className="font-black text-emerald-300">{juara1.akurasiPersen}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Benar/Salah</span>
                    <span className="font-mono font-bold">
                      {juara1.totalBenar}/{juara1.totalSalah}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Waktu</span>
                    <span className="font-mono font-bold">
                      {formatDetik(juara1.waktuSelesaiMs || juara1.rataRataWaktuJawabMs)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {juara2 && (
              <div className="bg-slate-800/90 border border-slate-500 rounded-3xl p-6 text-center flex flex-col items-center shadow-lg">
                <KarakterBalapKarung
                  nama={juara2.nama}
                  pose="podium"
                  ekspresi="bahagia"
                  podiumRank={2}
                  size="lg"
                  className="mb-2"
                />
                <span className="px-3 py-1 rounded-full bg-slate-600 text-slate-100 text-xs font-black mb-2">
                  Juara 2 • Runner-Up
                </span>
                <h3 className="text-2xl font-black text-white">{juara2.nama}</h3>
                <p className="text-3xl font-black text-emerald-300 mt-1">{juara2.jarak} m</p>
                <div className="grid grid-cols-3 gap-3 w-full mt-4 pt-3 border-t border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-400 block">Akurasi</span>
                    <span className="font-black text-emerald-300">{juara2.akurasiPersen}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Benar/Salah</span>
                    <span className="font-mono font-bold">
                      {juara2.totalBenar}/{juara2.totalSalah}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Jatuh</span>
                    <span className="font-mono font-bold text-rose-300">{juara2.jumlahJatuh}x</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {sesi.hasil?.questionStats && sesi.hasil.questionStats.length > 0 && (
            <div className="bg-slate-800/85 border border-slate-700 rounded-3xl p-5 shadow-xl">
              <h3 className="text-base font-black text-white mb-3">
                Statistik Soal yang Dijawab
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sesi.hasil.questionStats.map((sq, idx) => {
                  const b = sq.jumlahBenar ?? 0;
                  const s = sq.jumlahSalah ?? 0;
                  return (
                    <div
                      key={sq.questionId}
                      className="bg-slate-900/70 border border-slate-700 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          Soal #{sq.nomorSoal ?? idx + 1}
                        </span>
                        <p className="font-semibold text-white line-clamp-2">{sq.teksSoal}</p>
                      </div>
                      <div className="text-right font-mono shrink-0">
                        <span className="text-emerald-400 font-black block">{b} Benar</span>
                        <span className="text-rose-400">{s} Salah</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      )}

      {/* Modal Konfirmasi Ulang */}
      <Modal
        isOpen={modalUlangOpen}
        onClose={() => setModalUlangOpen(false)}
        title="Ulangi Duel 1 vs 1 dari Awal?"
        maxWidth="md"
        variant="standard"
      >
        <div className="space-y-4 text-slate-700">
          <p className="text-sm">
            Jarak kedua pemain kembali ke 0 meter dan keseimbangan dipulihkan ke 100%.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalUlangOpen(false)}
              className="portal-btn ghost sm"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleUlang}
              disabled={isActionLoading}
              className="portal-btn red sm"
            >
              Ya, Ulangi Sekarang
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Hentikan */}
      <Modal
        isOpen={modalHentikanOpen}
        onClose={() => setModalHentikanOpen(false)}
        title="Akhiri Balap Karung Solo Sekarang?"
        maxWidth="md"
        variant="standard"
      >
        <div className="space-y-4 text-slate-700">
          <p className="text-sm">
            Pemenang akan langsung ditentukan berdasarkan jarak terjauh saat ini dan sesi disimpan ke riwayat.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalHentikanOpen(false)}
              className="portal-btn ghost sm"
            >
              Lanjutkan Lomba
            </button>
            <button
              type="button"
              onClick={handleHentikan}
              disabled={isActionLoading}
              className="portal-btn red sm"
            >
              Ya, Akhiri Sesi
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
