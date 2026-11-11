import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { apiRequest } from '../../lib/api';
import { VisualisasiTali } from './VisualisasiTali';
import KarakterTarikTambang, { EkspresiTarikTambang } from '../siswa/KarakterTarikTambang';
import { Modal } from '../../components';
import { soundEffects } from '../../lib/soundEffects';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  Lock,
  Pause,
  Play,
  StopCircle,
  Trophy,
  Volume2,
  VolumeX,
  XCircle,
  Zap,
} from 'lucide-react';

interface PilihanSoalClient {
  choiceId: string;
  label: 'A' | 'B' | 'C';
  teks: string;
}

interface SoalTimClient {
  presentationId: string;
  id: string;
  questionId: string;
  nomorRonde: number;
  kesulitan: 'mudah' | 'sedang' | 'sulit';
  teks: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  pilihan: PilihanSoalClient[];
  endsAt?: number;
  duration?: number;
}

interface StatistikSisiSolo {
  tim: 'merah' | 'putih';
  nama: string;
  totalBenar: number;
  totalSalah: number;
  jumlahJawab: number;
  akurasiPersen: number;
  streakSaatIni: number;
  streakTertinggi: number;
  totalBonusStreak: number;
  powerUpTersedia: string | null;
  powerUpAktifRondeBerikutnya: string | null;
  jumlahPowerUpDipakai: number;
}

interface HasilRondeSolo {
  nomorRonde: number;
  tim1Benar: boolean;
  tim2Benar: boolean;
  tim1JawabanKode: string | null;
  tim2JawabanKode: string | null;
  tim1Kunci: string;
  tim2Kunci: string;
  tim1Penjelasan: string | null;
  tim2Penjelasan: string | null;
  posisiSebelum: number;
  perubahanTali: number;
  posisiSesudah: number;
  selisihKekuatan: number;
  bonusStreakNet: number;
  bonusPowerUpNet: number;
  powerUpTim1Dipakai: string | null;
  powerUpTim2Dipakai: string | null;
}

interface SesiSoloDetail {
  sessionId: string;
  mode: 'solo' | 'multi';
  playMode?: 'SOLO' | 'MULTIPLAYER';
  templateId: string;
  templateJudul: string;
  state: 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED';
  config: {
    kesulitan: 'mudah' | 'sedang' | 'sulit';
    durasiRonde: 15 | 20 | 30;
    bonusAktif: boolean;
    powerUpAktif: boolean;
    namaTim1: string;
    namaTim2: string;
  };
  nomorRonde: number;
  taliPosition: number;
  skorMerah: number;
  skorPutih: number;
  tim1: StatistikSisiSolo;
  tim2: StatistikSisiSolo;
  rondeSaatIni: {
    nomorRonde: number;
    dimulaiPadaMs: number;
    berakhirPadaMs: number;
    sisaWaktuMsSaatJeda?: number;
    ditutup: boolean;
    tim1SudahJawab: boolean;
    tim2SudahJawab: boolean;
    powerUpTim1Dipakai: string | null;
    powerUpTim2Dipakai: string | null;
    soalTim1: SoalTimClient | null;
    soalTim2: SoalTimClient | null;
    hasilRonde: HasilRondeSolo | null;
  } | null;
  riwayatTali: Array<{ ronde: number; posisi: number; perubahan: number }>;
  isFinished: boolean;
}

const INFO_POWERUP: Record<string, { label: string; efek: string }> = {
  semangat_tim: { label: 'Semangat Tim', efek: '+5 Tarikan' },
  pertahanan_kuat: { label: 'Pertahanan Kuat', efek: '-5 Lawan' },
  tarikan_super: { label: 'Tarikan Super', efek: '+10 Tarikan' },
};

export default function LayarHostSolo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [sesi, setSesi] = useState<SesiSoloDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [sisaDetik, setSisaDetik] = useState<number>(20);

  // Pilihan tombol yang baru diklik per sisi pada ronde berjalan
  const [pickedChoiceTim1, setPickedChoiceTim1] = useState<string | null>(null);
  const [pickedChoiceTim2, setPickedChoiceTim2] = useState<string | null>(null);
  const [submittingTim, setSubmittingTim] = useState<'merah' | 'putih' | 'action' | null>(null);
  const [reaksiTim, setReaksiTim] = useState<{
    merah?: EkspresiTarikTambang;
    putih?: EkspresiTarikTambang;
  } | null>(null);

  const [modalAkhiriOpen, setModalAkhiriOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isMuted, setIsMuted] = useState(soundEffects.getMuted());

  const closingRoundRef = useRef<number | null>(null);
  const nextRoundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRoundNumberRef = useRef<number>(0);

  const clearNextTimeout = () => {
    if (nextRoundTimeoutRef.current) {
      clearTimeout(nextRoundTimeoutRef.current);
      nextRoundTimeoutRef.current = null;
    }
  };

  const applySesiUpdate = useCallback(
    (nextSesi: SesiSoloDetail) => {
      if (nextSesi.state === 'FINISHED' || nextSesi.isFinished) {
        clearNextTimeout();
        soundEffects.playVictoryFanfare();
        navigate(`/guru/sesi/${id}/hasil`, { replace: true });
        return;
      }

      const rNum = nextSesi.rondeSaatIni?.nomorRonde ?? nextSesi.nomorRonde;
      if (rNum !== lastRoundNumberRef.current) {
        lastRoundNumberRef.current = rNum;
        setPickedChoiceTim1(null);
        setPickedChoiceTim2(null);
        setReaksiTim(null);
        closingRoundRef.current = null;
      }

      setSesi(nextSesi);
    },
    [id, navigate]
  );

  const fetchSesi = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiRequest<{ session: SesiSoloDetail }>(`/sesi/${id}`);
      if (res.session.mode === 'multi') {
        navigate(`/guru/sesi/${id}`, { replace: true });
        return;
      }
      applySesiUpdate(res.session);
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal memuat sesi Solo.');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, applySesiUpdate]);

  useEffect(() => {
    fetchSesi();
    return () => {
      clearNextTimeout();
    };
  }, [fetchSesi]);

  // Tutup ronde otomatis saat timer habis & jadwalkan ronde berikutnya setelah evaluasi singkat
  const triggerTutupRonde = useCallback(async () => {
    if (!id || !sesi?.rondeSaatIni) return;
    const rondeNum = sesi.rondeSaatIni.nomorRonde;
    if (sesi.rondeSaatIni.ditutup || closingRoundRef.current === rondeNum) return;

    closingRoundRef.current = rondeNum;
    try {
      const res = await apiRequest<{
        hasilRonde: HasilRondeSolo;
        isFinished: boolean;
        session: SesiSoloDetail;
      }>(`/sesi/${id}/tutup-ronde`, { method: 'POST' });

      soundEffects.playRopeTug();
      setReaksiTim({
        merah: res.hasilRonde.tim1Benar ? 'bahagia' : 'sedih',
        putih: res.hasilRonde.tim2Benar ? 'bahagia' : 'sedih',
      });
      applySesiUpdate(res.session);
    } catch {
      closingRoundRef.current = null;
    }
  }, [id, sesi, applySesiUpdate]);

  // Sinkronisasi hitung mundur timer per 200ms
  useEffect(() => {
    if (!sesi || !sesi.rondeSaatIni) return;
    const ronde = sesi.rondeSaatIni;

    if (sesi.state === 'PAUSED') {
      const sisaPaused = Math.ceil((ronde.sisaWaktuMsSaatJeda ?? 0) / 1000);
      setSisaDetik(Math.max(0, sisaPaused));
      return;
    }

    if (ronde.ditutup || sesi.state !== 'PLAYING') {
      return;
    }

    const updateTick = () => {
      const sisa = Math.max(0, Math.ceil((ronde.berakhirPadaMs - Date.now()) / 1000));
      setSisaDetik(sisa);
      if (Date.now() >= ronde.berakhirPadaMs + 150) {
        triggerTutupRonde();
      }
    };

    updateTick();
    const timer = setInterval(updateTick, 200);
    return () => clearInterval(timer);
  }, [sesi, triggerTutupRonde]);

  const handleLanjutRonde = useCallback(async () => {
    if (!id) return;
    clearNextTimeout();
    try {
      setSubmittingTim('action');
      const res = await apiRequest<{ session: SesiSoloDetail }>(`/sesi/${id}/lanjut-ronde`, {
        method: 'POST',
      });
      soundEffects.playWhistle();
      applySesiUpdate(res.session);
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal melanjutkan ke ronde berikutnya.');
    } finally {
      setSubmittingTim(null);
    }
  }, [id, applySesiUpdate]);

  // Auto-lanjut ke ronde berikutnya 2.8 detik setelah ronde selesai & dievaluasi
  useEffect(() => {
    if (
      sesi?.state === 'PLAYING' &&
      sesi.rondeSaatIni?.ditutup &&
      !sesi.isFinished
    ) {
      clearNextTimeout();
      nextRoundTimeoutRef.current = setTimeout(() => {
        handleLanjutRonde();
      }, 2800);
    }
    return () => clearNextTimeout();
  }, [sesi?.state, sesi?.rondeSaatIni?.ditutup, sesi?.rondeSaatIni?.nomorRonde, sesi?.isFinished, handleLanjutRonde]);

  const handleMulai = async () => {
    if (!id) return;
    try {
      setSubmittingTim('action');
      const res = await apiRequest<{ session: SesiSoloDetail }>(`/sesi/${id}/mulai`, {
        method: 'POST',
      });
      soundEffects.playWhistle();
      applySesiUpdate(res.session);
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal memulai pertandingan Solo.');
    } finally {
      setSubmittingTim(null);
    }
  };

  const handleTogglePause = async () => {
    if (!id || !sesi) return;
    const nextState = sesi.state === 'PAUSED' ? 'PLAYING' : 'PAUSED';
    try {
      setSubmittingTim('action');
      const res = await apiRequest<{ session: SesiSoloDetail }>(`/sesi/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({ state: nextState }),
      });
      applySesiUpdate(res.session);
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal mengubah jeda permainan.');
    } finally {
      setSubmittingTim(null);
    }
  };

  const handleJawabSisi = async (
    tim: 'merah' | 'putih',
    soal: SoalTimClient,
    choice: PilihanSoalClient
  ) => {
    if (!id || !sesi || sesi.state !== 'PLAYING' || !sesi.rondeSaatIni || sesi.rondeSaatIni.ditutup) {
      return;
    }
    if (tim === 'merah' && sesi.rondeSaatIni.tim1SudahJawab) return;
    if (tim === 'putih' && sesi.rondeSaatIni.tim2SudahJawab) return;

    try {
      if (tim === 'merah') setPickedChoiceTim1(choice.choiceId);
      else setPickedChoiceTim2(choice.choiceId);

      setSubmittingTim(tim);
      const res = await apiRequest<{
        rondeSelesai: boolean;
        hasilRonde: HasilRondeSolo | null;
        session: SesiSoloDetail;
      }>(`/sesi/${id}/jawab`, {
        method: 'POST',
        body: JSON.stringify({
          tim,
          presentationId: soal.presentationId,
          choiceId: choice.choiceId,
          questionId: soal.questionId,
        }),
      });

      if (res.rondeSelesai && res.hasilRonde) {
        soundEffects.playRopeTug();
        setReaksiTim({
          merah: res.hasilRonde.tim1Benar ? 'bahagia' : 'sedih',
          putih: res.hasilRonde.tim2Benar ? 'bahagia' : 'sedih',
        });
      }
      applySesiUpdate(res.session);
    } catch (err: any) {
      if (tim === 'merah') setPickedChoiceTim1(null);
      else setPickedChoiceTim2(null);
      setErrorPesan(err.pesan || 'Gagal mengirim jawaban.');
    } finally {
      setSubmittingTim(null);
    }
  };

  const handleAktifkanPowerUp = async (tim: 'merah' | 'putih') => {
    if (!id || !sesi) return;
    try {
      setSubmittingTim('action');
      const res = await apiRequest<{ session: SesiSoloDetail }>(`/sesi/${id}/powerup`, {
        method: 'POST',
        body: JSON.stringify({ tim }),
      });
      soundEffects.playBoost();
      applySesiUpdate(res.session);
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal mengaktifkan power-up.');
    } finally {
      setSubmittingTim(null);
    }
  };

  const handleAkhiriManual = async () => {
    if (!id) return;
    try {
      setIsEnding(true);
      await apiRequest(`/sesi/${id}/selesai`, { method: 'POST' });
      soundEffects.playVictoryFanfare();
      navigate(`/guru/sesi/${id}/hasil`, { replace: true });
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal mengakhiri permainan.');
      setIsEnding(false);
    }
  };

  if (loading) {
    return (
      <div className="portal-bg min-h-screen flex flex-col items-center justify-center text-[#f4ecd8]">
        <Loader2 className="w-10 h-10 animate-spin text-[#f2c230] mb-3" />
        <p className="portal-cv text-3xl">Menyiapkan Arena Duel 1 vs 1...</p>
      </div>
    );
  }

  if (!sesi) {
    return (
      <div className="portal-bg min-h-screen flex items-center justify-center p-6">
        <div className="bg-[#fbf6e9] rounded-3xl p-8 border-2 border-[#e0d5b8] max-w-md w-full text-center">
          <h2 className="portal-cv text-3xl text-[#1d3b2e] mb-2">Sesi Tidak Ditemukan</h2>
          <p className="text-sm text-[#6b7d6c] mb-6">{errorPesan}</p>
          <button
            type="button"
            onClick={() => navigate('/guru')}
            className="portal-btn red w-full justify-center"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  const r = sesi.rondeSaatIni;
  const hasilRonde = r?.hasilRonde || null;

  const renderPanelTim = (side: 'merah' | 'putih') => {
    const isTim1 = side === 'merah';
    const stats = isTim1 ? sesi.tim1 : sesi.tim2;
    const soal = isTim1 ? r?.soalTim1 : r?.soalTim2;
    const sudahJawab = isTim1 ? r?.tim1SudahJawab : r?.tim2SudahJawab;
    const pickedChoiceId = isTim1 ? pickedChoiceTim1 : pickedChoiceTim2;
    const isBenarRonde = hasilRonde ? (isTim1 ? hasilRonde.tim1Benar : hasilRonde.tim2Benar) : null;
    const kunciRonde = hasilRonde ? (isTim1 ? hasilRonde.tim1Kunci : hasilRonde.tim2Kunci) : null;
    const penjelasanRonde = hasilRonde
      ? isTim1
        ? hasilRonde.tim1Penjelasan
        : hasilRonde.tim2Penjelasan
      : null;

    const accentBorder = isTim1 ? 'border-[#c8362f]' : 'border-[#2563eb]';
    const accentHeaderBg = isTim1
      ? 'bg-gradient-to-r from-[#c8362f] to-[#a8241e] text-white'
      : 'bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white';
    const activeBtnBg = isTim1
      ? 'hover:border-[#c8362f] hover:bg-[#fde8e7]'
      : 'hover:border-[#2563eb] hover:bg-[#dbeafe]';

    return (
      <section
        className={`bg-[#fbf6e9] rounded-3xl border-4 ${accentBorder} shadow-[0_8px_0_rgba(0,0,0,0.22)] overflow-hidden flex flex-col`}
      >
        {/* Header Sisi Tim */}
        <div className={`px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 ${accentHeaderBg}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/95 flex items-center justify-center overflow-hidden">
              <KarakterTarikTambang
                tim={side}
                pose="siap"
                ekspresi={
                  hasilRonde
                    ? isBenarRonde
                      ? 'bahagia'
                      : 'sedih'
                    : sudahJawab
                    ? 'semangat'
                    : 'netral'
                }
                size="xs"
              />
            </div>
            <div>
              <h2 className="font-black text-lg leading-tight">{stats.nama}</h2>
              <div className="text-xs font-bold opacity-90 flex items-center gap-2">
                <span>
                  Benar {stats.totalBenar} / Salah {stats.totalSalah}
                </span>
                <span>• Akurasi {stats.akurasiPersen}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sesi.config.bonusAktif && stats.streakSaatIni > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f2c230] text-[#1d3b2e] text-xs font-black">
                <Flame className="w-3.5 h-3.5" /> Streak {stats.streakSaatIni}
              </span>
            )}
            {sudahJawab && !r?.ditutup && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/25 text-white text-xs font-extrabold">
                <Lock className="w-3.5 h-3.5" /> Terkunci
              </span>
            )}
          </div>
        </div>

        {/* Bar Power-Up Sisi */}
        {sesi.config.powerUpAktif && (stats.powerUpTersedia || stats.powerUpAktifRondeBerikutnya) && (
          <div className="px-5 py-2.5 bg-[#f4ecd9] border-b border-[#e0d5b8] flex items-center justify-between gap-2">
            {stats.powerUpAktifRondeBerikutnya ? (
              <div className="text-xs font-black text-[#b45309] flex items-center gap-1.5">
                <span>
                  Aktif Ronde Depan:{' '}
                  {INFO_POWERUP[stats.powerUpAktifRondeBerikutnya]?.label ||
                    stats.powerUpAktifRondeBerikutnya}
                </span>
              </div>
            ) : (
              <>
                <div className="text-xs font-extrabold text-[#1d3b2e] flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-[#b45309]" />
                  <span>
                    Power-Up Tersedia: {INFO_POWERUP[stats.powerUpTersedia!]?.label} (
                    {INFO_POWERUP[stats.powerUpTersedia!]?.efek})
                  </span>
                </div>
                <button
                  type="button"
                  disabled={submittingTim !== null}
                  onClick={() => handleAktifkanPowerUp(side)}
                  className="px-3 py-1 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-black shadow"
                >
                  Aktifkan
                </button>
              </>
            )}
          </div>
        )}

        {/* Area Soal & Pilihan Jawaban */}
        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
          {soal ? (
            <>
              <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-[#e0d5b8] shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-[#6b7d6c] mb-1.5">
                  <span>
                    Soal {isTim1 ? 'Kiri' : 'Kanan'} — Ronde #{r?.nomorRonde}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#f4ecd9] text-[#1d3b2e]">
                    {soal.kesulitan}
                  </span>
                </div>
                <p className="text-base sm:text-xl font-black text-[#1d3b2e] leading-snug">
                  {soal.teks}
                </p>
              </div>

              {/* Pilihan Jawaban */}
              <div className="space-y-2.5">
                {soal.pilihan.map((opt) => {
                  const isPicked = pickedChoiceId === opt.choiceId;
                  const isCorrectOption = r?.ditutup && kunciRonde === opt.label;
                  let btnStyle = `bg-white border-2 border-[#d6c8a4] text-[#1d3b2e] ${activeBtnBg}`;

                  if (r?.ditutup) {
                    if (isCorrectOption) {
                      btnStyle = 'bg-emerald-100 border-2 border-emerald-600 text-emerald-950';
                    } else if (isPicked && !isBenarRonde) {
                      btnStyle = 'bg-red-100 border-2 border-red-600 text-red-950';
                    } else {
                      btnStyle = 'bg-white/60 border border-[#e0d5b8] text-[#6b7d6c] opacity-75';
                    }
                  } else if (isPicked || (sudahJawab && isPicked)) {
                    btnStyle = isTim1
                      ? 'bg-[#c8362f] border-2 border-[#7f1d1d] text-white shadow-md'
                      : 'bg-[#2563eb] border-2 border-[#1e3a8a] text-white shadow-md';
                  } else if (sudahJawab) {
                    btnStyle = 'bg-slate-100 border border-slate-200 text-slate-400 opacity-70';
                  }

                  return (
                    <button
                      key={opt.choiceId}
                      type="button"
                      disabled={
                        sesi.state !== 'PLAYING' ||
                        Boolean(sudahJawab) ||
                        Boolean(r?.ditutup) ||
                        submittingTim !== null
                      }
                      onClick={() => handleJawabSisi(side, soal, opt)}
                      className={`w-full text-left p-3.5 sm:p-4 rounded-2xl transition-all flex items-center gap-3 font-bold active:scale-[0.99] disabled:cursor-not-allowed ${btnStyle}`}
                    >
                      <span
                        className={`w-9 h-9 rounded-xl font-black text-base flex items-center justify-center shrink-0 ${
                          isPicked && !r?.ditutup
                            ? 'bg-white/25 text-white'
                            : isTim1
                            ? 'bg-[#fde8e7] text-[#c8362f]'
                            : 'bg-[#dbeafe] text-[#2563eb]'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-sm sm:text-base leading-snug flex-1">{opt.teks}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-sm font-bold text-[#6b7d6c]">
              Menunggu soal ronde...
            </div>
          )}

          {/* Status Sisi Saat Terkunci atau Setelah Ronde Ditutup */}
          {sudahJawab && !r?.ditutup && (
            <div className="p-3 rounded-xl bg-[#f1e7ce] border border-[#d6c8a4] text-center text-xs font-extrabold text-[#1d3b2e]">
              Jawaban {stats.nama} terkunci! Menunggu sisi lawan atau timer selesai...
            </div>
          )}

          {r?.ditutup && hasilRonde && (
            <div
              className={`p-3.5 rounded-2xl border-2 text-xs sm:text-sm space-y-1 ${
                isBenarRonde
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                  : 'bg-red-50 border-red-400 text-red-950'
              }`}
            >
              <div className="font-black flex items-center gap-1.5">
                {isBenarRonde ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Benar! (+15 kekuatan tarik)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Belum Tepat — Kunci Jawaban: {kunciRonde}</span>
                  </>
                )}
              </div>
              {penjelasanRonde && <p className="font-medium opacity-90">{penjelasanRonde}</p>}
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="portal-bg min-h-screen px-3 py-4 sm:px-6 sm:py-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Top Bar Kontrol Guru */}
        <header className="bg-[#fbf6e9] rounded-2xl px-4 py-3 border-2 border-[#e0d5b8] shadow-[0_4px_0_rgba(0,0,0,0.2)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/guru')}
              className="p-2 rounded-xl bg-[#f1e7ce] hover:bg-[#e5d8b8] text-[#1d3b2e] border border-[#d6c8a4]"
              title="Kembali ke Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-[#c8362f]">
                Mode Solo • Local 1 vs 1
              </div>
              <h1 className="font-black text-base sm:text-lg text-[#1d3b2e] leading-tight">
                {sesi.templateJudul} — Ronde #{r?.nomorRonde ?? sesi.nomorRonde}
              </h1>
            </div>
          </div>

          {/* Timer Sinkron Tengah */}
          {sesi.state !== 'READY' && (
            <div
              className={`px-4 py-2 rounded-2xl font-black text-lg sm:text-xl flex items-center gap-2 border-2 ${
                sisaDetik <= 5 && !r?.ditutup
                  ? 'bg-[#fde8e7] text-[#c8362f] border-[#c8362f] animate-pulse'
                  : 'bg-[#244a39] text-[#f2c230] border-[#1d3b2e]'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>{r?.ditutup ? 'Evaluasi' : `${sisaDetik}d`}</span>
            </div>
          )}

          {/* Tombol Kontrol Aksi */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMuted(soundEffects.toggleMute())}
              className="p-2.5 rounded-xl bg-[#f1e7ce] text-[#1d3b2e] border border-[#d6c8a4]"
              title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {(sesi.state === 'PLAYING' || sesi.state === 'PAUSED') && (
              <button
                type="button"
                disabled={submittingTim !== null}
                onClick={handleTogglePause}
                className="px-3.5 py-2 rounded-xl bg-[#f2c230] hover:bg-[#e0b222] text-[#1d3b2e] font-black text-xs sm:text-sm inline-flex items-center gap-1.5 shadow"
              >
                {sesi.state === 'PAUSED' ? (
                  <>
                    <Play className="w-4 h-4 fill-current" /> <span>Lanjut</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4" /> <span>Jeda</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setModalAkhiriOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#c8362f] hover:bg-[#a8241e] text-white font-black text-xs sm:text-sm inline-flex items-center gap-1.5 shadow"
            >
              <StopCircle className="w-4 h-4" />
              <span>Akhiri</span>
            </button>
          </div>
        </header>

        {errorPesan && (
          <div className="p-3 rounded-xl bg-[#fde8e7] border border-[#c8362f] text-[#961e19] font-bold text-sm">
            {errorPesan}
          </div>
        )}

        {/* Arena Visualisasi Tali (-100 .. +100) */}
        <VisualisasiTali
          posisi={sesi.taliPosition}
          skorMerah={sesi.skorMerah}
          skorPutih={sesi.skorPutih}
          namaTim1={sesi.config.namaTim1}
          namaTim2={sesi.config.namaTim2}
          streakTim1={sesi.tim1.streakSaatIni}
          streakTim2={sesi.tim2.streakSaatIni}
          powerUpTim1Aktif={
            r?.powerUpTim1Dipakai || sesi.tim1.powerUpAktifRondeBerikutnya || undefined
          }
          powerUpTim2Aktif={
            r?.powerUpTim2Dipakai || sesi.tim2.powerUpAktifRondeBerikutnya || undefined
          }
          reaksiTim={reaksiTim || undefined}
          theme="chalk"
        />

        {/* Bila sesi READY (belum dimulai) */}
        {sesi.state === 'READY' ? (
          <div className="bg-[#fbf6e9] rounded-3xl p-8 border-2 border-[#e0d5b8] text-center space-y-4">
            <Trophy className="w-12 h-12 text-[#f2c230] mx-auto" />
            <h2 className="portal-cv text-3xl text-[#1d3b2e]">
              Arena Duel 1 vs 1 Siap Dimulai!
            </h2>
            <p className="text-sm font-semibold text-[#4a6252] max-w-lg mx-auto">
              Siswa {sesi.config.namaTim1} di sisi kiri dan {sesi.config.namaTim2} di sisi kanan
              menjawab soal berbeda secara bersamaan pada perangkat ini.
            </p>
            <button
              type="button"
              disabled={submittingTim !== null}
              onClick={handleMulai}
              className="px-8 py-4 rounded-2xl bg-[#c8362f] hover:bg-[#b02b24] text-white font-black text-lg shadow-[0_5px_0_#7f1d1d] inline-flex items-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Mulai Ronde Pertama</span>
            </button>
          </div>
        ) : (
          <>
            {/* Banner Rekap Evaluasi Ronde */}
            {r?.ditutup && hasilRonde && (
              <div className="bg-[#244a39] text-[#fbf6e9] rounded-2xl px-5 py-3.5 border-2 border-[#f2c230] flex flex-wrap items-center justify-between gap-3 shadow-lg">
                <div className="text-sm sm:text-base font-extrabold">
                  <span>Hasil Ronde #{hasilRonde.nomorRonde}: </span>
                  <span className="text-[#f2c230]">
                    {hasilRonde.perubahanTali > 0
                      ? `Tali tertarik ke ${sesi.config.namaTim1} (+${hasilRonde.perubahanTali})`
                      : hasilRonde.perubahanTali < 0
                      ? `Tali tertarik ke ${sesi.config.namaTim2} (${hasilRonde.perubahanTali})`
                      : 'Tarik-menarik seimbang (0 perubahan)'}
                  </span>
                  <span className="text-xs ml-2 opacity-80">
                    (Posisi: {hasilRonde.posisiSesudah > 0 ? `+${hasilRonde.posisiSesudah}` : hasilRonde.posisiSesudah})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLanjutRonde}
                  className="px-4 py-2 rounded-xl bg-[#f2c230] hover:bg-[#e0b222] text-[#1d3b2e] font-black text-xs sm:text-sm inline-flex items-center gap-1.5"
                >
                  <span>Ronde Berikutnya</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Split Screen 2 Siswa: Tim 1 Merah (Kiri) vs Tim 2 Biru (Kanan) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 relative">
              {sesi.state === 'PAUSED' && (
                <div className="absolute inset-0 z-30 rounded-3xl bg-[#1d3b2e]/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-6">
                  <Pause className="w-12 h-12 text-[#f2c230] mb-2" />
                  <h3 className="portal-cv text-3xl">Permainan Dijeda</h3>
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="mt-4 px-6 py-3 rounded-2xl bg-[#f2c230] text-[#1d3b2e] font-black"
                  >
                    Lanjutkan Pertandingan
                  </button>
                </div>
              )}

              {renderPanelTim('merah')}
              {renderPanelTim('putih')}
            </div>
          </>
        )}
      </div>

      {/* Modal Konfirmasi Akhiri Permainan Manual */}
      <Modal
        isOpen={modalAkhiriOpen}
        onClose={() => setModalAkhiriOpen(false)}
        title="Akhiri Pertandingan Solo?"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#4a6252] font-medium">
            Pertandingan akan dihentikan sekarang, pemenang ditentukan dari posisi tali terakhir (
            {sesi.taliPosition > 0 ? `+${sesi.taliPosition}` : sesi.taliPosition}), dan laporan
            lengkap akan disimpan.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalAkhiriOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-sm text-slate-700"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isEnding}
              onClick={handleAkhiriManual}
              className="px-5 py-2 rounded-xl bg-[#c8362f] text-white font-black text-sm inline-flex items-center gap-1.5"
            >
              {isEnding && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Ya, Akhiri Sekarang</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
