import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import { extractApiErrorMessage } from '../../components';
import {
  AnalisisHeatmapData,
  BalapHeatmapMatrix,
} from '../../components/BalapKarungStadium';
import { TarikTambangStadium } from '../../components/TarikTambangStadium';
import { CheckCircle2, HelpCircle, Home, Loader2, RotateCcw, Trophy, XCircle } from 'lucide-react';

interface PemainStat {
  id?: string;
  nama: string;
  tim: 'merah' | 'putih';
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakTertinggi: number;
  rataRataWaktuJawabMs?: number;
}

interface RingkasanTim {
  id: 'merah' | 'putih';
  nama: string;
  warna: string;
  jumlahAnggota: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
}

interface HasilTarikLaporan {
  sessionId: string;
  playMode?: 'SOLO' | 'MULTIPLAYER';
  templateJudul: string;
  templateId: string;
  konfigurasi?: { namaTim1?: string; namaTim2?: string; batasMenang?: number };
  timMenang: 'merah' | 'putih' | 'seri';
  namaTim1?: string;
  namaTim2?: string;
  posisiAkhir: number;
  skorMerah: number;
  skorPutih: number;
  akurasiTim1Persen?: number;
  akurasiTim2Persen?: number;
  totalSoalDijawab?: number;
  ringkasanTim?: RingkasanTim[];
  laporanSiswa?: PemainStat[];
  pemain1Stat?: {
    nama: string;
    totalBenar: number;
    totalSalah: number;
    akurasiPersen: number;
    streakTertinggi: number;
  };
  pemain2Stat?: {
    nama: string;
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
  analisisHeatmap?: AnalisisHeatmapData;
}

export default function HasilSolo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [hasil, setHasil] = useState<HasilTarikLaporan | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [isMainLagiLoading, setIsMainLagiLoading] = useState(false);

  useEffect(() => {
    async function loadHasil() {
      try {
        const res = await apiRequest<{ hasil: HasilTarikLaporan }>(`/sesi/${id}/hasil`);
        setHasil(res.hasil);
      } catch (err: unknown) {
        setErrorPesan(extractApiErrorMessage(err, 'Gagal memuat hasil pertandingan.'));
      } finally {
        setLoading(false);
      }
    }
    void loadHasil();
  }, [id]);

  const handleMainLagi = async () => {
    if (!id) return;
    try {
      setIsMainLagiLoading(true);
      const res = await apiRequest<{ sessionId: string }>(`/sesi/${id}/main-lagi`, {
        method: 'POST',
        body: JSON.stringify({ autoStart: false }),
      });
      navigate(`/guru/sesi/${res.sessionId}`);
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal membuat sesi main lagi.'));
      setIsMainLagiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="tt-festival flex items-center justify-center min-h-screen p-6 text-center">
        <div className="tt-panel max-w-md w-full flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-[#e2312d]" />
          <h2 className="text-xl text-[#2b2a4a]">Menyusun Laporan Pertandingan...</h2>
        </div>
      </div>
    );
  }

  if (errorPesan || !hasil) {
    return (
      <div className="tt-festival flex items-center justify-center min-h-screen p-6 text-center">
        <div className="tt-panel max-w-md w-full space-y-4">
          <HelpCircle className="w-12 h-12 text-[#e2312d] mx-auto" />
          <h2 className="text-xl text-[#2b2a4a]">Laporan Tidak Tersedia</h2>
          <p className="text-sm text-[#6b6a85]">{errorPesan}</p>
          <button type="button" className="tt-btn" onClick={() => navigate('/guru')}>
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  const namaTim1 = hasil.konfigurasi?.namaTim1 || hasil.namaTim1 || 'Tim Merah';
  const namaTim2 = hasil.konfigurasi?.namaTim2 || hasil.namaTim2 || 'Tim Biru';
  const batasMenang = hasil.konfigurasi?.batasMenang ?? 100;
  const labelPemenang =
    hasil.timMenang === 'merah'
      ? `${namaTim1} Memenangkan Lomba!`
      : hasil.timMenang === 'putih'
        ? `${namaTim2} Memenangkan Lomba!`
        : 'Pertandingan Berakhir Seri!';

  return (
    <div className="tt-festival">
      <TarikTambangStadium
        title={hasil.templateJudul || 'Tarik Tambang Kuis'}
        subtitle={hasil.playMode === 'MULTIPLAYER' ? 'LAPORAN MULTIPLAYER' : 'LAPORAN SOLO 1 VS 1'}
        statusLabel="SELESAI"
        timeText="0:00"
        taliPosition={hasil.posisiAkhir}
        batasMenang={batasMenang}
        namaTim1={namaTim1}
        namaTim2={namaTim2}
        skorMerah={hasil.skorMerah}
        skorPutih={hasil.skorPutih}
        leftPullerCount={
          hasil.playMode === 'MULTIPLAYER'
            ? Math.max(1, hasil.ringkasanTim?.find((t) => t.id === 'merah')?.jumlahAnggota || 1)
            : 1
        }
        rightPullerCount={
          hasil.playMode === 'MULTIPLAYER'
            ? Math.max(1, hasil.ringkasanTim?.find((t) => t.id === 'putih')?.jumlahAnggota || 1)
            : 1
        }
        variant={hasil.playMode === 'MULTIPLAYER' ? 'multi' : 'solo'}
        winnerSide={hasil.timMenang}
        onBack={() => navigate('/guru')}
      />

      <main className="tt-wrap">
        <div className="tt-panel space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="tt-chip gold inline-flex items-center gap-1.5 mb-2">
                <Trophy className="w-3.5 h-3.5" /> Hasil Pertandingan
              </span>
              <h2 className="text-2xl sm:text-3xl text-[#2b2a4a]">{labelPemenang}</h2>
              <p className="text-sm text-[#6b6a85] mt-1">
                Posisi Akhir Tali:{' '}
                <strong>{hasil.posisiAkhir > 0 ? `+${hasil.posisiAkhir}` : hasil.posisiAkhir}</strong>{' '}
                • Target ±{batasMenang}
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={isMainLagiLoading}
                onClick={handleMainLagi}
                className="tt-btn sm"
              >
                <RotateCcw className="w-4 h-4" /> Main lagi
              </button>
              <button type="button" onClick={() => navigate('/guru')} className="tt-btn s sm">
                <Home className="w-4 h-4" /> Dashboard
              </button>
            </div>
          </div>

          <div className="tt-cards">
            <div className={`tt-rc ${hasil.timMenang === 'merah' ? 'w' : ''}`}>
              <span className="tt-pl2">{hasil.timMenang === 'merah' ? 'JUARA 1' : 'POSISI 2'}</span>
              <h3 className="text-lg text-[#e2312d] mt-1.5">{namaTim1}</h3>
              <div className="tt-big text-[#2b2a4a]">
                {hasil.pemain1Stat?.akurasiPersen ??
                  hasil.ringkasanTim?.find((t) => t.id === 'merah')?.akurasiPersen ??
                  hasil.akurasiTim1Persen ??
                  0}
                %
              </div>
              <small className="text-xs font-bold text-[#6b6a85]">Akurasi Tim</small>
            </div>

            <div className={`tt-rc ${hasil.timMenang === 'putih' ? 'w' : ''}`}>
              <span className="tt-pl2">{hasil.timMenang === 'putih' ? 'JUARA 1' : 'POSISI 2'}</span>
              <h3 className="text-lg text-[#1d8fe0] mt-1.5">{namaTim2}</h3>
              <div className="tt-big text-[#2b2a4a]">
                {hasil.pemain2Stat?.akurasiPersen ??
                  hasil.ringkasanTim?.find((t) => t.id === 'putih')?.akurasiPersen ??
                  hasil.akurasiTim2Persen ??
                  0}
                %
              </div>
              <small className="text-xs font-bold text-[#6b6a85]">Akurasi Tim</small>
            </div>
          </div>

          {hasil.analisisHeatmap && (
            <div className="pt-2 border-t border-dashed border-[#f0dfb4]">
              <BalapHeatmapMatrix heatmap={hasil.analisisHeatmap} />
            </div>
          )}

          {hasil.questionStats && hasil.questionStats.length > 0 && (
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
                  {hasil.questionStats.map((q) => (
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
          )}
        </div>
      </main>
    </div>
  );
}
