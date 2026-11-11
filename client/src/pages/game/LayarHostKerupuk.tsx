import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components';
import KerupukVirtual, {
  HasilGachaGigitanProps,
  MoodKarakterKerupuk,
} from '../siswa/KerupukVirtual';
import LayarHostKerupukMulti, { SesiKerupukMultiClient } from './LayarHostKerupukMulti';
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
  CheckCircle2,
  XCircle,
  Loader2,
  HelpCircle,
  Target,
  Award,
  BarChart3,
  Clock,
} from 'lucide-react';

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

interface RiwayatGigitanItem {
  urutan: number;
  questionId: string;
  nomorSoal: number;
  benar: boolean;
  tipe: TipeGigitan | 'salah';
  label: string;
  penguranganPoin: number;
  poinPembelajaranDidapat: number;
  poinStreakDidapat: number;
  poinKeberuntunganDidapat: number;
  poinPenyelesaianDidapat: number;
  totalPoinDidapat: number;
  sisaKerupukSetelah: number;
  waktuJawabMs: number;
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
  terakhirGigitan: HasilGachaGigitanProps | null;
  riwayatGigitan: RiwayatGigitanItem[];
  statistikGigitan: Record<TipeGigitan, number>;
  soalSaatIni: SoalAktifSolo | null;
  isFinished: boolean;
  hasil: any | null;
}

interface FeedbackTerakhir {
  benar: boolean;
  jawabanBenarKode: string;
  jawabanBenarTeks: string;
  penjelasan: string | null;
  poinDidapat: number;
  poinDasar: number;
  bonusStreak: number;
  bonusPenyelesaian: number;
  gacha: HasilGachaGigitanProps | null;
}

const LABEL_KESULITAN: Record<string, string> = {
  mudah: 'Mudah (Ceria)',
  normal: 'Normal (Seimbang)',
  sulit: 'Sulit (Tantangan)',
  custom: 'Kustom',
};

const LABEL_STATE: Record<StateKerupuk, { teks: string; warna: string }> = {
  READY: { teks: 'SIAP DIMULAI', warna: 'bg-sky-100 text-sky-900 border-sky-300' },
  PLAYING: { teks: 'BERLANGSUNG', warna: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  PAUSED: { teks: 'DIJEDA', warna: 'bg-amber-100 text-amber-900 border-amber-300' },
  FINISHED: { teks: 'SELESAI — LUDES!', warna: 'bg-emerald-600 text-white border-emerald-700' },
  STOPPED: { teks: 'DIHENTIKAN GURU', warna: 'bg-slate-700 text-white border-slate-800' },
};

function formatDetik(ms: number): string {
  if (!ms || ms <= 0) return '-';
  if (ms < 1000) return `${ms} md`;
  return `${(ms / 1000).toFixed(1)} dtk`;
}

export default function LayarHostKerupuk() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('kembali') || '/guru';

  const [sesi, setSesi] = useState<SesiKerupukClient | null>(null);
  const [sesiMulti, setSesiMulti] = useState<SesiKerupukMultiClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [feedback, setFeedback] = useState<FeedbackTerakhir | null>(null);
  const [mood, setMood] = useState<MoodKarakterKerupuk>('ready');
  const [reactionNonce, setReactionNonce] = useState(0);

  const [modalHentikanOpen, setModalHentikanOpen] = useState(false);
  const [modalUlangOpen, setModalUlangOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(soundEffects.getMuted());

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
        if (s.state === 'FINISHED') setMood('win');
        else if (s.state === 'STOPPED') setMood('stopped');
        else if (s.state === 'PAUSED') setMood('paused');
        else if (s.state === 'PLAYING') setMood('playing');
        else setMood('ready');
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

  const handleMulai = useCallback(async () => {
    if (!id || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      const res = await apiRequest<{ session: SesiKerupukClient }>(`/sesi/${id}/mulai`, {
        method: 'POST',
      });
      soundEffects.playWhistle();
      setFeedback(null);
      setMood('playing');
      setSesi(res.session);
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal memulai permainan.');
    } finally {
      setIsActionLoading(false);
    }
  }, [id, isActionLoading]);

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
      setMood(targetState === 'PAUSED' ? 'paused' : 'playing');
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal mengubah status jeda permainan.');
    } finally {
      setIsActionLoading(false);
    }
  }, [id, sesi, isActionLoading]);

  const handleJawab = useCallback(
    async (choiceId: string) => {
      if (!id || !sesi || !sesi.soalSaatIni) return;
      if (sesi.state !== 'PLAYING') return;
      if (submittingRef.current) return;

      submittingRef.current = true;
      setIsSubmitting(true);
      setActionError(null);

      try {
        const res = await apiRequest<{
          benar: boolean;
          jawabanBenarKode: string;
          jawabanBenarTeks: string;
          penjelasan: string | null;
          poinDidapat: number;
          poinDasar: number;
          bonusStreak: number;
          bonusPenyelesaian: number;
          gacha: HasilGachaGigitanProps | null;
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

        setFeedback({
          benar: res.benar,
          jawabanBenarKode: res.jawabanBenarKode,
          jawabanBenarTeks: res.jawabanBenarTeks,
          penjelasan: res.penjelasan,
          poinDidapat: res.poinDidapat,
          poinDasar: res.poinDasar,
          bonusStreak: res.bonusStreak,
          bonusPenyelesaian: res.bonusPenyelesaian,
          gacha: res.gacha,
        });

        setSesi(res.session);
        setReactionNonce((n) => n + 1);

        if (res.isFinished) {
          setMood('win');
          soundEffects.playVictoryFanfare();
        } else if (res.benar && res.gacha) {
          setMood(res.gacha.tipe);
          if (res.gacha.tipe === 'zonk') {
            soundEffects.playZonk();
          } else {
            soundEffects.playCrunch();
            if (res.bonusStreak > 0) {
              setTimeout(() => soundEffects.playBoost(), 220);
            }
          }
        } else {
          setMood('salah');
          soundEffects.playIncorrect();
        }
      } catch (err: any) {
        setActionError(err.pesan || 'Gagal mengirim jawaban.');
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [id, sesi]
  );

  const handleKonfirmasiHentikan = async () => {
    if (!id || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      const res = await apiRequest<{ session: SesiKerupukClient }>(`/sesi/${id}/selesai`, {
        method: 'POST',
      });
      setModalHentikanOpen(false);
      setMood('stopped');
      setSesi(res.session);
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal menghentikan permainan.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleKonfirmasiUlang = async () => {
    if (!id || !sesi || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      setModalUlangOpen(false);

      if (sesi.state === 'FINISHED' || sesi.state === 'STOPPED') {
        const res = await apiRequest<{ sessionId: string }>(`/sesi/${id}/main-lagi`, {
          method: 'POST',
          body: JSON.stringify({ autoStart: true }),
        });
        setFeedback(null);
        setMood('playing');
        navigate(
          `/guru/sesi/${res.sessionId}${returnUrl !== '/guru' ? `?kembali=${encodeURIComponent(returnUrl)}` : ''}`,
          { replace: true }
        );
      } else {
        const res = await apiRequest<{ session: SesiKerupukClient }>(`/sesi/${id}/ulang`, {
          method: 'POST',
          body: JSON.stringify({ autoStart: true }),
        });
        setFeedback(null);
        setMood('playing');
        setSesi(res.session);
      }
    } catch (err: any) {
      setActionError(err.pesan || 'Gagal mengulang permainan.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Pintasan keyboard guru (1-5 atau A-E sesuai jumlah opsi aktif saat PLAYING, tidak aktif saat modal terbuka)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (modalHentikanOpen || modalUlangOpen || isActionLoading || isSubmitting) return;
      if (!sesi) return;

      if (sesi.state === 'PLAYING' && sesi.soalSaatIni) {
        const key = e.key.toUpperCase();
        const hurufKeys = ['A', 'B', 'C', 'D', 'E'];
        const angkaKeys = ['1', '2', '3', '4', '5'];
        let idx = hurufKeys.indexOf(key);
        if (idx < 0) idx = angkaKeys.indexOf(key);

        if (idx >= 0 && idx < sesi.soalSaatIni.pilihan.length && sesi.soalSaatIni.pilihan[idx]) {
          e.preventDefault();
          handleJawab(sesi.soalSaatIni.pilihan[idx].choiceId);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sesi, modalHentikanOpen, modalUlangOpen, isActionLoading, isSubmitting, handleJawab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4ecd8] flex flex-col items-center justify-center text-[#1d3b2e]">
        <Loader2 className="w-10 h-10 animate-spin text-[#c8362f] mb-3" />
        <p className="font-bold text-sm">Menyiapkan Arena Makan Kerupuk...</p>
      </div>
    );
  }

  if (sesiMulti) {
    return <LayarHostKerupukMulti initialSession={sesiMulti} returnUrl={returnUrl} />;
  }

  if (errorPesan || !sesi) {
    return (
      <div className="min-h-screen bg-[#f4ecd8] flex items-center justify-center p-6">
        <div className="bg-white border-2 border-[#e0d5b8] rounded-3xl p-8 max-w-md w-full text-center shadow-lg">
          <AlertErrorView
            pesan={errorPesan || 'Sesi tidak ditemukan.'}
            onKembali={() => navigate(returnUrl)}
          />
        </div>
      </div>
    );
  }

  const stateBadge = LABEL_STATE[sesi.state];
  const isPlayOrPause = sesi.state === 'PLAYING' || sesi.state === 'PAUSED';
  const isEnded = sesi.state === 'FINISHED' || sesi.state === 'STOPPED';
  const akurasi =
    sesi.totalBenar + sesi.totalSalah > 0
      ? Math.round((sesi.totalBenar / (sesi.totalBenar + sesi.totalSalah)) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#f4ecd8] text-[#1d3b2e] flex flex-col">
      {/* Header Proyektor Responsif */}
      <header className="bg-[#1d3b2e] text-[#f4ecd8] border-b-4 border-[#c8362f] px-4 sm:px-6 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(returnUrl)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#f4ecd8] transition-colors cursor-pointer shrink-0"
              title={returnUrl.includes('makan-kerupuk') ? 'Kembali ke Pemilihan Mode' : 'Kembali ke Dashboard'}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-widest bg-[#c8362f] text-white px-2.5 py-0.5 rounded-full">
                  Makan Kerupuk • Mode Solo
                </span>
                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${stateBadge.warna}`}>
                  {stateBadge.teks}
                </span>
              </div>
              <h1 className="font-black text-lg sm:text-xl truncate mt-0.5">
                {sesi.templateJudul}
              </h1>
            </div>
          </div>

          {/* Kontrol Bar Guru */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMuted(soundEffects.toggleMute())}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#f4ecd8] transition-colors cursor-pointer"
              title={isMuted ? 'Nyalakan Efek Suara' : 'Matikan Efek Suara'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {isPlayOrPause && (
              <>
                <button
                  type="button"
                  onClick={handleTogglePause}
                  disabled={isActionLoading}
                  className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer ${
                    sesi.state === 'PAUSED'
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-amber-400 hover:bg-amber-500 text-amber-950'
                  }`}
                >
                  {sesi.state === 'PAUSED' ? (
                    <>
                      <Play className="w-4 h-4 fill-current" /> Lanjutkan
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" /> Jeda
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setModalUlangOpen(true)}
                  disabled={isActionLoading}
                  className="px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm bg-white/15 hover:bg-white/25 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Mulai Ulang
                </button>

                <button
                  type="button"
                  onClick={() => setModalHentikanOpen(true)}
                  disabled={isActionLoading}
                  className="px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm bg-[#c8362f] hover:bg-[#b02d27] text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <StopCircle className="w-4 h-4" /> Hentikan
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Banner Error Aksi jika ada */}
      {actionError && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-3">
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

      {/* Konten Utama */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {/* ============================================================
            VIEW 1: READY (PRATINJAU ATURAN & TOMBOL MULAI)
            ============================================================ */}
        {sesi.state === 'READY' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-5 bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-6 flex flex-col items-center justify-center shadow-sm">
              <KerupukVirtual
                size="projector"
                showCharacter
                mood="ready"
                sisaKerupuk={100}
                sisaPoin={sesi.config.targetKerupuk}
                targetPoin={sesi.config.targetKerupuk}
                namaPemain="Peserta Lomba (Perangkat Guru)"
              />
            </div>

            <div className="lg:col-span-7 bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#c8362f] mb-1">
                  Siap Dimainkan di Proyektor Kelas
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#1d3b2e]">
                  {sesi.templateJudul}
                </h2>
                <p className="text-sm text-[#6b7d6c] mt-1">
                  Jawab pertanyaan dengan benar untuk mendapatkan gigitan acak hingga kerupuk{' '}
                  <strong className="text-[#1d3b2e]">{sesi.config.targetKerupuk} poin</strong> habis tak bersisa.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-[#e0d5b8] rounded-2xl p-3">
                  <div className="text-[11px] font-bold text-[#6b7d6c]">Target Kerupuk</div>
                  <div className="text-xl font-black text-[#c8362f] font-mono">
                    {sesi.config.targetKerupuk} pt
                  </div>
                </div>
                <div className="bg-white border border-[#e0d5b8] rounded-2xl p-3">
                  <div className="text-[11px] font-bold text-[#6b7d6c]">Tingkat Kesulitan</div>
                  <div className="text-sm font-black text-[#1d3b2e] mt-1">
                    {LABEL_KESULITAN[sesi.config.kesulitan] || sesi.config.kesulitan}
                  </div>
                </div>
                <div className="bg-white border border-[#e0d5b8] rounded-2xl p-3">
                  <div className="text-[11px] font-bold text-[#6b7d6c]">Bank Soal</div>
                  <div className="text-xl font-black text-[#1d3b2e] font-mono">
                    {sesi.totalSoalBank} soal
                  </div>
                </div>
                <div className="bg-white border border-[#e0d5b8] rounded-2xl p-3">
                  <div className="text-[11px] font-bold text-[#6b7d6c]">Bonus Ludes</div>
                  <div className="text-xl font-black text-emerald-700 font-mono">+100 pt</div>
                </div>
              </div>

              {/* Snapshot Probabilitas Gigitan */}
              <div className="bg-white border border-[#e0d5b8] rounded-2xl p-4 space-y-2">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#6b7d6c]">
                  Distribusi Peluang Gigitan Terkunci
                </div>
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  {[
                    { label: 'Besar', val: sesi.config.probabilitas.besar, cls: 'bg-amber-100 text-amber-900' },
                    { label: 'Sedang', val: sesi.config.probabilitas.sedang, cls: 'bg-emerald-100 text-emerald-900' },
                    { label: 'Kecil', val: sesi.config.probabilitas.kecil, cls: 'bg-sky-100 text-sky-900' },
                    { label: 'Mini', val: sesi.config.probabilitas.sangat_kecil, cls: 'bg-slate-100 text-slate-900' },
                    { label: 'Zonk', val: sesi.config.probabilitas.zonk, cls: 'bg-red-100 text-red-900' },
                  ].map((p) => (
                    <div key={p.label} className={`rounded-xl p-2 font-bold ${p.cls}`}>
                      <div>{p.label}</div>
                      <div className="font-mono text-sm font-black">{p.val}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/guru/makan-kerupuk?templateId=${encodeURIComponent(sesi.templateId)}`)
                    }
                    className="px-4 py-3 rounded-xl border border-[#e0d5b8] bg-white hover:bg-[#f7f2e4] text-sm font-bold cursor-pointer"
                  >
                    Kembali ke Pemilihan Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/guru')}
                    className="px-4 py-3 rounded-xl border border-[#e0d5b8] bg-[#fcf8ed] hover:bg-[#f7f2e4] text-sm font-bold cursor-pointer"
                  >
                    Dashboard
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleMulai}
                  disabled={isActionLoading}
                  className="px-8 py-3.5 rounded-2xl bg-[#c8362f] hover:bg-[#b02d27] text-white font-black text-base shadow-lg flex items-center gap-2.5 transition-all cursor-pointer disabled:opacity-60"
                >
                  <Play className="w-5 h-5 fill-current" />
                  {isActionLoading ? 'Memulai...' : 'Mulai Permainan Sekarang'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            VIEW 2: PLAYING & PAUSED (PANGGUNG PROYEKTOR GURU)
            ============================================================ */}
        {isPlayOrPause && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Kolom Kiri: Arena 2D Karakter + Kerupuk + Rincian Skor */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-5 flex flex-col items-center shadow-sm relative overflow-hidden">
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1d3b2e] bg-[#f4ecd8] px-3 py-1 rounded-full border border-[#e0d5b8]">
                    <Target className="w-3.5 h-3.5 text-[#c8362f]" />
                    Target: {sesi.targetKerupuk} pt
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1 rounded-full ${
                      sesi.streakBenar >= 3
                        ? 'bg-orange-500 text-white'
                        : sesi.streakBenar > 0
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-white text-[#6b7d6c] border border-[#e0d5b8]'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    Streak: {sesi.streakBenar}
                  </span>
                </div>

                <KerupukVirtual
                  size="projector"
                  showCharacter
                  mood={sesi.state === 'PAUSED' ? 'paused' : mood}
                  reactionNonce={reactionNonce}
                  sisaKerupuk={sesi.sisaPersen}
                  sisaPoin={sesi.sisaKerupuk}
                  targetPoin={sesi.targetKerupuk}
                  terakhirGigitan={sesi.terakhirGigitan}
                />
              </div>

              {/* Panel Rincian Skor Terpisah */}
              <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-[#6b7d6c]">
                    Rincian Skor
                  </span>
                  <span className="text-xs font-bold text-[#1d3b2e]">
                    Benar {sesi.totalBenar} • Salah {sesi.totalSalah}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-[#1d3b2e] text-[#f4ecd8] rounded-2xl p-3 col-span-2 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold opacity-80">SKOR TOTAL</div>
                      <div className="text-2xl font-black font-mono">{sesi.skorTotal}</div>
                    </div>
                    <Trophy className="w-7 h-7 text-amber-300" />
                  </div>

                  <div className="bg-white border border-[#e0d5b8] rounded-xl p-2.5">
                    <div className="text-[10px] font-bold text-[#6b7d6c]">Pembelajaran</div>
                    <div className="text-lg font-black font-mono text-[#1d3b2e]">
                      {sesi.skorPembelajaran}
                    </div>
                    <div className="text-[10px] text-[#6b7d6c]">
                      Benar {sesi.skorDasarBenar} + Streak {sesi.totalBonusStreak}
                    </div>
                  </div>

                  <div className="bg-white border border-[#e0d5b8] rounded-xl p-2.5">
                    <div className="text-[10px] font-bold text-[#6b7d6c]">Keberuntungan Gigitan</div>
                    <div className="text-lg font-black font-mono text-amber-700">
                      +{sesi.bonusKeberuntungan}
                    </div>
                    <div className="text-[10px] text-[#6b7d6c]">
                      Ludes Bonus: +{sesi.bonusPenyelesaian}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Kartu Soal & Pilihan + Feedback Terakhir + Riwayat Gigitan */}
            <div className="lg:col-span-7 space-y-4">
              {/* Banner Feedback Jawaban Terakhir */}
              {feedback && (
                <div
                  className={`rounded-2xl p-4 border-2 shadow-sm transition-all ${
                    feedback.benar
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-red-50 border-red-300 text-red-950'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-black text-sm">
                      {feedback.benar ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span>
                            Benar!{' '}
                            {feedback.gacha
                              ? `${feedback.gacha.label} (-${feedback.gacha.penguranganEfektifPoin ?? 0} pt kerupuk)`
                              : ''}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                          <span>
                            Kurang Tepat! Kunci: {feedback.jawabanBenarKode}.{' '}
                            {feedback.jawabanBenarTeks}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-white/80">
                      +{feedback.poinDidapat} pt
                    </span>
                  </div>
                  {(feedback.bonusStreak > 0 || feedback.penjelasan) && (
                    <div className="mt-1.5 text-xs space-y-1">
                      {feedback.bonusStreak > 0 && (
                        <div className="inline-flex items-center gap-1 font-extrabold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded mr-2">
                          <Flame className="w-3.5 h-3.5" /> Bonus Streak 3: +{feedback.bonusStreak} pt!
                        </div>
                      )}
                      {feedback.penjelasan && (
                        <p className="text-[#1d3b2e]/90">{feedback.penjelasan}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Area Pertanyaan */}
              <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
                {sesi.state === 'PAUSED' && (
                  <div className="absolute inset-0 z-20 bg-[#1d3b2e]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-[#f4ecd8]">
                    <Pause className="w-12 h-12 text-amber-400 mb-3" />
                    <h3 className="text-2xl font-black">Permainan Sedang Dijeda</h3>
                    <p className="text-sm opacity-85 mt-1 max-w-md">
                      Soal dan progres tetap aman tersimpan. Klik Lanjutkan untuk kembali menjawab soal.
                    </p>
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      disabled={isActionLoading}
                      className="mt-5 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm flex items-center gap-2 shadow-lg cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" /> Lanjutkan Permainan
                    </button>
                  </div>
                )}

                {sesi.soalSaatIni ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#1d3b2e] text-[#f4ecd8]">
                        <HelpCircle className="w-3.5 h-3.5" /> Soal #{sesi.soalSaatIni.nomorSoal}
                      </span>
                      <span className="text-xs font-bold text-[#6b7d6c]">
                        Pintasan keyboard:{' '}
                        {sesi.soalSaatIni.pilihan.map((p) => p.label).join(' / ')} atau{' '}
                        {sesi.soalSaatIni.pilihan.map((_, idx) => idx + 1).join(' / ')}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-[#1d3b2e] leading-snug">
                      {sesi.soalSaatIni.teks}
                    </h2>

                    <div className="space-y-3">
                      {sesi.soalSaatIni.pilihan.map((pil) => (
                        <button
                          key={pil.choiceId}
                          type="button"
                          disabled={sesi.state !== 'PLAYING' || isSubmitting}
                          onClick={() => handleJawab(pil.choiceId)}
                          className="w-full text-left p-4 sm:p-5 rounded-2xl bg-white border-2 border-[#e0d5b8] hover:border-[#c8362f] hover:bg-[#fff9f7] active:scale-[0.99] transition-all flex items-center gap-4 group disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                        >
                          <span className="w-10 h-10 rounded-xl bg-[#f4ecd8] group-hover:bg-[#c8362f] group-hover:text-white font-black text-base flex items-center justify-center shrink-0 transition-colors">
                            {pil.label}
                          </span>
                          <span className="text-base sm:text-lg font-bold text-[#1d3b2e] leading-snug">
                            {pil.teks}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-[#6b7d6c] text-sm font-bold">
                    Menyiapkan soal berikutnya...
                  </div>
                )}
              </div>

              {/* Log Ringkas Riwayat Gigitan Terbaru */}
              {sesi.riwayatGigitan.length > 0 && (
                <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-2xl p-4 shadow-xs">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#6b7d6c] mb-2">
                    Riwayat Gigitan Terbaru
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[...sesi.riwayatGigitan]
                      .slice(-6)
                      .reverse()
                      .map((item) => (
                        <span
                          key={item.urutan}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                            !item.benar
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : item.tipe === 'zonk'
                              ? 'bg-slate-100 border-slate-300 text-slate-700'
                              : item.tipe === 'besar'
                              ? 'bg-amber-100 border-amber-300 text-amber-900'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}
                        >
                          #{item.urutan} {item.label} (-{item.penguranganPoin}pt)
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================
            VIEW 3: FINISHED & STOPPED (LAPORAN HASIL AKHIR)
            ============================================================ */}
        {isEnded && (
          <div className="bg-[#fcf8ed] border-2 border-[#e0d5b8] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-4 flex flex-col items-center justify-center bg-white border border-[#e0d5b8] rounded-3xl p-4">
                <KerupukVirtual
                  size="lg"
                  showCharacter
                  mood={sesi.state === 'FINISHED' ? 'win' : 'stopped'}
                  sisaKerupuk={sesi.sisaPersen}
                  sisaPoin={sesi.sisaKerupuk}
                  targetPoin={sesi.targetKerupuk}
                />
              </div>

              <div className="lg:col-span-8 space-y-5">
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full mb-2 ${
                      sesi.state === 'FINISHED'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-white'
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    {sesi.state === 'FINISHED'
                      ? 'Selamat! Kerupuk Habis Sempurna!'
                      : 'Permainan Dihentikan Secara Manual'}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#1d3b2e]">
                    {sesi.templateJudul}
                  </h2>
                  <p className="text-sm text-[#6b7d6c] mt-1">
                    Target {sesi.targetKerupuk} poin • Progres akhir{' '}
                    <strong className="text-[#1d3b2e]">{sesi.progresPersen}%</strong> (sisa{' '}
                    {sesi.sisaKerupuk} pt)
                  </p>
                </div>

                {/* Kartu Skor Terpisah */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#1d3b2e] text-[#f4ecd8] rounded-2xl p-4">
                    <div className="text-[11px] font-bold opacity-80">SKOR TOTAL</div>
                    <div className="text-3xl font-black font-mono mt-0.5">{sesi.skorTotal}</div>
                  </div>
                  <div className="bg-white border border-[#e0d5b8] rounded-2xl p-4">
                    <div className="text-[11px] font-bold text-[#6b7d6c]">Skor Pembelajaran</div>
                    <div className="text-2xl font-black font-mono text-[#1d3b2e] mt-0.5">
                      {sesi.skorPembelajaran}
                    </div>
                    <div className="text-[11px] text-[#6b7d6c]">
                      Benar {sesi.skorDasarBenar} + Streak {sesi.totalBonusStreak}
                    </div>
                  </div>
                  <div className="bg-white border border-[#e0d5b8] rounded-2xl p-4">
                    <div className="text-[11px] font-bold text-[#6b7d6c]">Keberuntungan Gigitan</div>
                    <div className="text-2xl font-black font-mono text-amber-700 mt-0.5">
                      +{sesi.bonusKeberuntungan}
                    </div>
                  </div>
                  <div className="bg-white border border-[#e0d5b8] rounded-2xl p-4">
                    <div className="text-[11px] font-bold text-[#6b7d6c]">Bonus Penyelesaian</div>
                    <div className="text-2xl font-black font-mono text-emerald-700 mt-0.5">
                      +{sesi.bonusPenyelesaian}
                    </div>
                  </div>
                </div>

                {/* Statistik Tambahan & Distribusi Gigitan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white border border-[#e0d5b8] rounded-2xl p-4 space-y-2">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-[#6b7d6c] flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5" /> Performa Jawaban
                    </div>
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span>Benar / Salah</span>
                      <span className="font-mono">
                        {sesi.totalBenar} Benar • {sesi.totalSalah} Salah ({akurasi}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span>Streak Tertinggi</span>
                      <span className="font-mono text-orange-600">{sesi.streakTertinggi}x</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Rata-rata Jawab
                      </span>
                      <span className="font-mono">{formatDetik(sesi.rataRataWaktuJawabMs)}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#e0d5b8] rounded-2xl p-4 space-y-2">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-[#6b7d6c]">
                      Statistik Ukuran Gigitan
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                      {[
                        { label: 'Besar', val: sesi.statistikGigitan.besar },
                        { label: 'Sedang', val: sesi.statistikGigitan.sedang },
                        { label: 'Kecil', val: sesi.statistikGigitan.kecil },
                        { label: 'Mini', val: sesi.statistikGigitan.sangat_kecil },
                        { label: 'Zonk', val: sesi.statistikGigitan.zonk },
                      ].map((g) => (
                        <div key={g.label} className="bg-[#f4ecd8] rounded-xl p-2 font-bold">
                          <div className="text-[10px] text-[#6b7d6c]">{g.label}</div>
                          <div className="text-base font-black font-mono">{g.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Riwayat Gigitan Lengkap */}
            {sesi.riwayatGigitan.length > 0 && (
              <div className="bg-white border border-[#e0d5b8] rounded-2xl p-4 space-y-2">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#6b7d6c]">
                  Riwayat Langkah ({sesi.riwayatGigitan.length} Putaran)
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-[#f0e6cc] text-xs">
                  {sesi.riwayatGigitan.map((item) => (
                    <div
                      key={item.urutan}
                      className="py-2 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 font-bold">
                        <span className="font-mono text-[#6b7d6c]">#{item.urutan}</span>
                        <span
                          className={
                            item.benar ? 'text-emerald-700' : 'text-red-700'
                          }
                        >
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span>Kerupuk -{item.penguranganPoin} pt</span>
                        <span className="font-bold">+{item.totalPoinDidapat} skor</span>
                        <span className="text-[#6b7d6c]">Sisa: {item.sisaKerupukSetelah} pt</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tombol Aksi Akhir */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#e0d5b8]">
              <button
                type="button"
                onClick={() =>
                  navigate(`/guru/makan-kerupuk?templateId=${encodeURIComponent(sesi.templateId)}`)
                }
                className="px-4 py-2.5 rounded-xl border border-[#e0d5b8] bg-white hover:bg-[#f7f2e4] font-bold text-sm cursor-pointer"
              >
                Kembali ke Pemilihan Mode
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/guru')}
                  className="px-5 py-2.5 rounded-xl border border-[#e0d5b8] bg-white hover:bg-[#f7f2e4] font-bold text-sm cursor-pointer"
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setModalUlangOpen(true)}
                  disabled={isActionLoading}
                  className="px-6 py-2.5 rounded-xl bg-[#c8362f] hover:bg-[#b02d27] text-white font-black text-sm flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Main Ulang (Sesi Baru)
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Konfirmasi Hentikan Permainan */}
      <Modal
        isOpen={modalHentikanOpen}
        onClose={() => setModalHentikanOpen(false)}
        title="Konfirmasi Hentikan Permainan"
        maxWidth="sm"
      >
        <div className="space-y-4 text-[#1d3b2e]">
          <p className="text-sm leading-relaxed">
            Apakah Anda yakin ingin menghentikan permainan Makan Kerupuk sekarang? Progres skor saat
            ini akan disimpan, namun <strong>Bonus Penyelesaian (+100)</strong> tidak diberikan karena
            kerupuk belum habis.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
            <button
              type="button"
              onClick={() => setModalHentikanOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#e0d5b8] text-xs font-bold hover:bg-[#f7f2e4] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleKonfirmasiHentikan}
              disabled={isActionLoading}
              className="px-4 py-2 rounded-lg bg-[#c8362f] hover:bg-[#b02d27] text-white text-xs font-bold cursor-pointer"
            >
              Ya, Hentikan Permainan
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Mulai Ulang */}
      <Modal
        isOpen={modalUlangOpen}
        onClose={() => setModalUlangOpen(false)}
        title={isEnded ? 'Mulai Sesi Baru' : 'Konfirmasi Mulai Ulang'}
        maxWidth="sm"
      >
        <div className="space-y-4 text-[#1d3b2e]">
          <p className="text-sm leading-relaxed">
            {isEnded
              ? 'Buat sesi Mode Solo baru menggunakan template dan aturan kerupuk yang sama dengan skor kembali dari 0?'
              : 'Mengulang permainan akan mereset skor ke 0 dan mengembalikan ukuran kerupuk penuh ke kondisi awal. Lanjutkan?'}
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
            <button
              type="button"
              onClick={() => setModalUlangOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#e0d5b8] text-xs font-bold hover:bg-[#f7f2e4] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleKonfirmasiUlang}
              disabled={isActionLoading}
              className="px-4 py-2 rounded-lg bg-[#1d3b2e] hover:bg-[#254b3b] text-white text-xs font-bold cursor-pointer"
            >
              {isEnded ? 'Ya, Buat Sesi Baru' : 'Ya, Mulai Ulang'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AlertErrorView({ pesan, onKembali }: { pesan: string; onKembali: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-black text-[#c8362f]">Sesi Tidak Tersedia</h2>
      <p className="text-sm text-[#6b7d6c]">{pesan}</p>
      <button
        type="button"
        onClick={onKembali}
        className="w-full py-2.5 rounded-xl bg-[#1d3b2e] text-white font-bold text-sm cursor-pointer"
      >
        Kembali ke Dashboard
      </button>
    </div>
  );
}
