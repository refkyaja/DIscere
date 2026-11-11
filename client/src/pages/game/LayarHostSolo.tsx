import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { apiRequest } from '../../lib/api';
import { VisualisasiTali } from './VisualisasiTali';
import { Button, Modal } from '../../components';
import { soundEffects } from '../../lib/soundEffects';
import {
  Play,
  Pause,
  StopCircle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface SoalAktif {
  id: string;
  urutan: number;
  nomorSoal: number;
  teks: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
}

interface SesiDetail {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  state: 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED';
  currentQuestionIndex: number;
  totalSoal: number;
  currentTurn: 'merah' | 'putih';
  taliPosition: number;
  skorMerah: number;
  skorPutih: number;
  soalSaatIni: SoalAktif | null;
}

export default function LayarHostSolo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [sesi, setSesi] = useState<SesiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);

  // State interaksi jawaban
  const [jawabanDipilih, setJawabanDipilih] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    benar: boolean;
    jawabanBenar: string;
    penjelasan?: string | null;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State modal konfirmasi akhiri permainan
  const [modalAkhiriOpen, setModalAkhiriOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isMuted, setIsMuted] = useState(soundEffects.getMuted());

  // Ambil data sesi dari server
  const fetchSesi = useCallback(async () => {
    try {
      const res = await apiRequest<{ session: SesiDetail }>(`/sesi/${id}`);
      if (res.session.state === 'FINISHED') {
        navigate(`/guru/sesi/${id}/hasil`, { replace: true });
        return;
      }
      setSesi(res.session);
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal memuat sesi permainan.');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchSesi();
  }, [fetchSesi]);

  // Handler: Mulai Permainan
  const handleMulai = async () => {
    if (!id) return;
    try {
      setIsSubmitting(true);
      const res = await apiRequest<{ session: any }>(`/sesi/${id}/mulai`, {
        method: 'POST',
      });
      setSesi((prev) =>
        prev
          ? {
              ...prev,
              state: res.session.state,
              currentTurn: res.session.currentTurn,
              soalSaatIni: res.session.soalSaatIni,
            }
          : null
      );
      soundEffects.playWhistle();
    } catch (err: any) {
      alert(err.pesan || 'Gagal memulai permainan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Jeda / Lanjutkan
  const handleTogglePause = async () => {
    if (!id || !sesi) return;
    const targetState = sesi.state === 'PLAYING' ? 'PAUSED' : 'PLAYING';
    try {
      setIsSubmitting(true);
      await apiRequest(`/sesi/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({ state: targetState }),
      });
      setSesi((prev) => (prev ? { ...prev, state: targetState } : null));
    } catch (err: any) {
      alert(err.pesan || 'Gagal mengubah status permainan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Jawab Soal
  const handlePilihJawaban = async (opsi: 'A' | 'B' | 'C') => {
    if (isSubmitting || !sesi || !sesi.soalSaatIni || sesi.state !== 'PLAYING') {
      return;
    }

    setJawabanDipilih(opsi);
    setIsSubmitting(true);

    try {
      const res = await apiRequest<{
        benar: boolean;
        jawabanBenar: string;
        penjelasan: string | null;
        taliPosition: number;
        skorMerah: number;
        skorPutih: number;
        nextTurn: 'merah' | 'putih';
        nextQuestionIndex: number;
        isFinished: boolean;
        winner: 'merah' | 'putih' | 'seri' | null;
        soalBerikutnya: SoalAktif | null;
      }>(`/sesi/${id}/jawab`, {
        method: 'POST',
        body: JSON.stringify({
          questionId: sesi.soalSaatIni.id,
          tim: sesi.currentTurn,
          jawabanDipilih: opsi,
        }),
      });

      // Tampilkan feedback jawaban
      setFeedback({
        benar: res.benar,
        jawabanBenar: res.jawabanBenar,
        penjelasan: res.penjelasan,
      });

      if (res.benar) {
        soundEffects.playCorrect();
        soundEffects.playRopeTug();
      } else {
        soundEffects.playIncorrect();
      }

      // Perbarui posisi tali dan skor di layar
      setSesi((prev) =>
        prev
          ? {
              ...prev,
              taliPosition: res.taliPosition,
              skorMerah: res.skorMerah,
              skorPutih: res.skorPutih,
            }
          : null
      );

      // Jeda 1.8 detik untuk visualisasi sebelum berpindah giliran/selesai
      setTimeout(() => {
        if (res.isFinished) {
          soundEffects.playVictoryFanfare();
          navigate(`/guru/sesi/${id}/hasil`, { replace: true });
        } else {
          setSesi((prev) =>
            prev
              ? {
                  ...prev,
                  currentTurn: res.nextTurn,
                  currentQuestionIndex: res.nextQuestionIndex,
                  soalSaatIni: res.soalBerikutnya,
                }
              : null
          );
          setJawabanDipilih(null);
          setFeedback(null);
          setIsSubmitting(false);
        }
      }, 1800);
    } catch (err: any) {
      alert(err.pesan || 'Gagal memproses jawaban.');
      setJawabanDipilih(null);
      setFeedback(null);
      setIsSubmitting(false);
    }
  };

  // Handler: Akhiri Permainan
  const handleAkhiriPermainan = async () => {
    if (!id) return;
    try {
      setIsEnding(true);
      await apiRequest(`/sesi/${id}/selesai`, { method: 'POST' });
      navigate(`/guru/sesi/${id}/hasil`, { replace: true });
    } catch (err: any) {
      alert(err.pesan || 'Gagal mengakhiri permainan.');
      setIsEnding(false);
    }
  };

  if (loading) {
    return (
      <div className="portal-bg min-h-screen flex flex-col items-center justify-center text-[#f4ecd8]">
        <Loader2 className="w-10 h-10 animate-spin text-[#f2c230] mb-4" />
        <p className="portal-cv text-3xl">Memuat arena permainan solo...</p>
      </div>
    );
  }

  if (errorPesan || !sesi) {
    return (
      <div className="portal-bg min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="portal-card p-8 max-w-md w-full border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.2)] rounded-3xl">
          <HelpCircle className="w-12 h-12 text-[#c8362f] mx-auto mb-4" />
          <h2 className="portal-cv text-3xl text-[#1d3b2e] mb-2">Terjadi Kesalahan</h2>
          <p className="text-sm text-[#6b7d6c] mb-6">{errorPesan}</p>
          <button
            type="button"
            className="portal-btn red w-full"
            onClick={() => navigate('/guru')}
          >
            Kembali ke Dashboard Guru
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-bg min-h-screen flex flex-col justify-between select-none">
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 space-y-6">
        {/* Header Layar Proyektor */}
        <header className="flex flex-wrap items-center justify-between gap-4 portal-card p-4 sm:p-6 rounded-3xl border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)]">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase font-extrabold tracking-wider px-3 py-1 bg-[#f4ecd9] border border-[#e0d5b8] text-[#c8362f] rounded-full">
                Mode Solo • Tarik Tambang
              </span>
              <span className="text-xs font-semibold text-[#6b7d6c]">
                Layar Bersama Kelas
              </span>
            </div>
            <h1 className="portal-cv text-2xl sm:text-3xl font-extrabold text-[#1d3b2e]">
              {sesi.templateJudul}
            </h1>
          </div>

          {/* Status & Kontrol */}
          <div className="flex items-center gap-3">
            <div className="bg-[#f4ecd9] border border-[#e0d5b8] px-4 py-2 rounded-2xl text-center">
              <div className="text-xs text-[#6b7d6c] font-semibold">Nomor Soal</div>
              <div className="font-extrabold text-lg text-[#1d3b2e]">
                {sesi.soalSaatIni
                  ? `${sesi.soalSaatIni.nomorSoal} / ${sesi.totalSoal}`
                  : `0 / ${sesi.totalSoal}`}
              </div>
            </div>

            {sesi.state !== 'READY' && (
              <button
                type="button"
                onClick={handleTogglePause}
                className={`px-4 py-2.5 rounded-2xl font-bold text-sm inline-flex items-center gap-2 border-2 transition-all cursor-pointer ${
                  sesi.state === 'PLAYING'
                    ? 'bg-[#f4ecd9] border-[#e0d5b8] text-[#1d3b2e] hover:bg-[#e8dfc8]'
                    : 'bg-[#f2c230] border-[#b58e1c] text-[#1d3b2e] hover:bg-[#e0b020]'
                }`}
              >
                {sesi.state === 'PLAYING' ? (
                  <>
                    <Pause className="w-4 h-4 text-[#d97706]" />
                    <span>Jeda</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 text-[#1d3b2e]" />
                    <span>Lanjutkan</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setModalAkhiriOpen(true)}
              className="px-4 py-2.5 rounded-2xl font-bold text-sm inline-flex items-center gap-2 bg-[#c8362f] hover:bg-[#b52a23] text-white border-2 border-[#a3221c] shadow-sm transition-all cursor-pointer"
            >
              <StopCircle className="w-4 h-4 text-white" />
              <span>Akhiri</span>
            </button>

            {/* Tombol Efek Suara Web Audio */}
            <button
              onClick={() => setIsMuted(soundEffects.toggleMute())}
              className="p-2.5 rounded-2xl border-2 border-[#e0d5b8] bg-[#fbf6e9] text-[#1d3b2e] hover:bg-[#f4ecd9] shadow-sm transition-colors cursor-pointer"
              title={isMuted ? 'Nyalakan Efek Suara' : 'Bisukan Efek Suara'}
              aria-label={isMuted ? 'Nyalakan Efek Suara' : 'Bisukan Efek Suara'}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-[#c8362f]" />
              ) : (
                <Volume2 className="w-5 h-5 text-[#2e7d32]" />
              )}
            </button>
          </div>
        </header>

        {/* Visualisasi Tarik Tambang */}
        <VisualisasiTali
          posisi={sesi.taliPosition}
          skorMerah={sesi.skorMerah}
          skorPutih={sesi.skorPutih}
          timAktif={sesi.state === 'PLAYING' ? sesi.currentTurn : undefined}
          reaksiTim={
            feedback
              ? sesi.currentTurn === 'merah'
                ? {
                    merah: feedback.benar ? 'bahagia' : 'sedih',
                    putih: feedback.benar ? 'sedih' : 'semangat',
                  }
                : {
                    putih: feedback.benar ? 'bahagia' : 'sedih',
                    merah: feedback.benar ? 'sedih' : 'semangat',
                  }
              : undefined
          }
          theme="chalk"
        />

        {/* Status READY: Layar Persiapan Guru */}
        {sesi.state === 'READY' && (
          <div className="portal-card p-8 sm:p-12 text-center space-y-6 rounded-3xl border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)]">
            <div className="w-20 h-20 bg-[#fde8e7] border-2 border-[#e0d5b8] text-[#c8362f] rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <Play className="w-10 h-10 ml-1 fill-[#c8362f]" />
            </div>
            <div className="max-w-lg mx-auto space-y-2">
              <h2 className="portal-cv text-3xl sm:text-4xl text-[#1d3b2e]">
                Siap Memulai Lomba?
              </h2>
              <p className="text-[#1d3b2e] text-base leading-relaxed">
                Bagi siswa menjadi <strong>Tim Merah (kiri)</strong> dan{' '}
                <strong>Tim Putih (kanan)</strong>. Permainan akan dimulai dari giliran
                Tim Merah.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={handleMulai}
                disabled={isSubmitting}
                className="portal-btn red text-xl px-10 py-4 shadow-md inline-flex items-center gap-3 cursor-pointer"
              >
                <Play className="w-6 h-6 fill-white" />
                <span>Mulai Tarik Tambang Sekarang</span>
              </button>
            </div>
          </div>
        )}

        {/* Status PAUSED: Layar Dijeda */}
        {sesi.state === 'PAUSED' && (
          <div className="portal-card p-8 sm:p-10 text-center rounded-3xl border-2 border-[#e0d5b8] bg-[#fbf6e9] shadow-[0_6px_0_rgba(0,0,0,0.18)]">
            <div className="w-16 h-16 bg-[#fef3c7] border-2 border-[#f59e0b] text-[#b45309] rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Pause className="w-8 h-8 fill-current" />
            </div>
            <h2 className="portal-cv text-3xl text-[#1d3b2e] mb-2">
              Permainan Sedang Dijeda
            </h2>
            <p className="text-[#6b7d6c] mb-6 max-w-md mx-auto text-base">
              Penjelasan materi atau istirahat sejenak. Posisi tali dan giliran tetap aman.
            </p>
            <button
              type="button"
              onClick={handleTogglePause}
              className="portal-btn text-base px-8 py-3 cursor-pointer inline-flex items-center gap-2"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Lanjutkan Permainan</span>
            </button>
          </div>
        )}

        {/* Status PLAYING: Area Soal & Tombol Pilihan Jawaban */}
        {sesi.state === 'PLAYING' && sesi.soalSaatIni && (
          <div className="space-y-6">
            {/* Banner Indikator Giliran Tim */}
            <div
              className={`p-4 rounded-2xl flex items-center justify-between text-white font-bold transition-all shadow-md border-2 ${
                sesi.currentTurn === 'merah'
                  ? 'bg-[#c8362f] border-[#a3221c]'
                  : 'bg-[#1d3b2e] border-[#152b22]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full inline-block border-2 ${
                    sesi.currentTurn === 'merah'
                      ? 'bg-red-400 border-white'
                      : 'bg-white border-slate-300'
                  }`}
                />
                <span className="text-lg sm:text-xl tracking-wide">
                  GILIRAN: TIM {sesi.currentTurn.toUpperCase()}
                </span>
              </div>
              <span className="text-sm opacity-90 font-medium hidden sm:inline">
                Perwakilan tim silakan maju dan sentuh jawaban di bawah
              </span>
            </div>

            {/* Kotak Pertanyaan Utama */}
            <div className="portal-card p-6 sm:p-8 rounded-3xl border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)]">
              <div className="text-xs font-bold text-[#6b7d6c] mb-3 tracking-wider uppercase">
                Pertanyaan Soal #{sesi.soalSaatIni.nomorSoal}
              </div>
              <p className="portal-cv text-2xl sm:text-3xl md:text-4xl text-[#1d3b2e] leading-snug">
                {sesi.soalSaatIni.teks}
              </p>
            </div>

            {/* Feedback Jawaban */}
            {feedback && (
              <div
                className={`p-4 rounded-2xl flex items-start gap-4 border-2 animate-in fade-in-50 duration-300 ${
                  feedback.benar
                    ? 'bg-[#e8f5e9] border-[#2e7d32] text-[#1b5e20]'
                    : 'bg-[#fde8e7] border-[#c8362f] text-[#8e1d18]'
                }`}
              >
                {feedback.benar ? (
                  <CheckCircle2 className="w-8 h-8 text-[#2e7d32] shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-8 h-8 text-[#c8362f] shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-extrabold text-lg sm:text-xl">
                    {feedback.benar
                      ? 'JAWABAN BENAR! Tali ditarik 1 langkah!'
                      : 'JAWABAN SALAH! Tali tidak bergerak.'}
                  </h4>
                  {!feedback.benar && (
                    <p className="text-sm mt-1">
                      Kunci jawaban yang tepat adalah opsi{' '}
                      <strong>{feedback.jawabanBenar}</strong>.
                    </p>
                  )}
                  {feedback.penjelasan && (
                    <p className="text-xs opacity-90 mt-1 italic">
                      Penjelasan: {feedback.penjelasan}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 3 Tombol Pilihan Jawaban Besar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [
                  { key: 'A', teks: sesi.soalSaatIni.opsiA },
                  { key: 'B', teks: sesi.soalSaatIni.opsiB },
                  { key: 'C', teks: sesi.soalSaatIni.opsiC },
                ] as const
              ).map((opsi) => {
                const isSelected = jawabanDipilih === opsi.key;
                const isCorrect = feedback && feedback.jawabanBenar === opsi.key;
                const isWrongSelected = feedback && isSelected && !feedback.benar;

                let buttonStyles =
                  'bg-[#fbf6e9] border-2 border-[#e0d5b8] text-[#1d3b2e] hover:bg-[#f4ecd9] hover:border-[#1d3b2e] shadow-[0_5px_0_rgba(0,0,0,0.14)]';

                if (isCorrect) {
                  buttonStyles =
                    'bg-[#2e7d32] text-white border-2 border-[#1b5e20] shadow-[0_5px_0_rgba(0,0,0,0.2)] scale-102';
                } else if (isWrongSelected) {
                  buttonStyles =
                    'bg-[#c8362f] text-white border-2 border-[#a3221c] shadow-[0_5px_0_rgba(0,0,0,0.2)]';
                } else if (feedback && !isSelected) {
                  buttonStyles =
                    'bg-[#f0e7d0] border-2 border-[#d8cbb0] text-[#8c8270] opacity-50 shadow-none';
                }

                return (
                  <button
                    key={opsi.key}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handlePilihJawaban(opsi.key)}
                    className={`min-h-[90px] p-5 rounded-3xl text-left transition-all duration-200 flex items-start gap-4 cursor-pointer focus:outline-none focus:ring-4 focus:ring-[#f2c230] disabled:pointer-events-none ${buttonStyles}`}
                  >
                    <span
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-lg shrink-0 ${
                        isCorrect || isWrongSelected
                          ? 'bg-white/25 text-white'
                          : 'bg-[#e8dfc8] text-[#1d3b2e]'
                      }`}
                    >
                      {opsi.key}
                    </span>
                    <span
                      className={`font-bold text-lg sm:text-xl leading-snug self-center ${
                        isCorrect || isWrongSelected ? 'text-white' : 'text-[#1d3b2e]'
                      }`}
                    >
                      {opsi.teks}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dudukan Papan Tulis Kayu & Kapur Chalkboard */}
      <div className="portal-ledge" aria-hidden="true">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0 34C240 6 480 62 720 34S1200 6 1440 34V80H0z" fill="#a6783c" />
          <path d="M0 56C260 34 520 80 760 56S1220 36 1440 58V80H0z" fill="#8d6444" />
        </svg>
        <div className="portal-chalks">
          <i style={{ width: '84px', background: '#7a9c85' }} />
          <i style={{ width: '70px', background: '#f2c230' }} />
          <i style={{ width: '92px', background: '#f4ecd8' }} />
        </div>
      </div>

      {/* Modal Konfirmasi Akhiri Permainan */}
      <Modal
        isOpen={modalAkhiriOpen}
        onClose={() => setModalAkhiriOpen(false)}
        title="Akhiri Permainan Sekarang?"
      >
        <div className="space-y-4">
          <p className="text-[#1d3b2e] dark:!text-[#1d3b2e] text-base font-medium leading-relaxed">
            Apakah Anda yakin ingin mengakhiri sesi permainan ini sekarang? Pemenang
            akan ditentukan berdasarkan posisi tali saat ini dan hasilnya akan disimpan
            ke riwayat.
          </p>
          <div className="flex justify-end items-center gap-3 pt-4 border-t-2 border-dashed border-[#e0d5b8]">
            <button
              type="button"
              className="px-4 py-2 text-sm font-bold text-[#1d3b2e] dark:!text-[#1d3b2e] hover:bg-[#e8dfc8] rounded-xl transition-colors cursor-pointer"
              onClick={() => setModalAkhiriOpen(false)}
              disabled={isEnding}
            >
              Batal
            </button>
            <Button
              variant="utama"
              onClick={handleAkhiriPermainan}
              loading={isEnding}
              className="bg-[#c8362f] hover:bg-[#b52a23] text-white"
            >
              Ya, Akhiri Permainan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
