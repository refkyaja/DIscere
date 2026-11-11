import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { apiRequest } from '../../lib/api';
import { VisualisasiTali } from './VisualisasiTali';
import {
  Trophy,
  RotateCcw,
  Home,
  Check,
  X,
  Loader2,
  HelpCircle,
} from 'lucide-react';

interface LogItem {
  questionId: string;
  nomorSoal: number;
  teksSoal: string;
  tim: 'merah' | 'putih';
  jawabanDipilih: string;
  jawabanBenar: string;
  benar: boolean;
  posisiSetelah: number;
}

interface HasilData {
  sessionId: string;
  templateJudul: string;
  templateId: string;
  timMenang: 'merah' | 'putih' | 'seri';
  posisiAkhir: number;
  skorMerah: number;
  skorPutih: number;
  totalSoal: number;
  totalBenar: number;
  totalSalah: number;
  logJawaban?: LogItem[];
  questionStats?: Array<{
    nomorSoal: number;
    teksSoal: string;
    benar: boolean;
  }>;
}

export default function HasilSolo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [hasil, setHasil] = useState<HasilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [isMainLagiLoading, setIsMainLagiLoading] = useState(false);

  useEffect(() => {
    async function loadHasil() {
      try {
        const res = await apiRequest<{ hasil: HasilData }>(`/sesi/${id}/hasil`);
        setHasil(res.hasil);
      } catch (err: any) {
        setErrorPesan(err.pesan || 'Gagal memuat hasil permainan.');
      } finally {
        setLoading(false);
      }
    }
    loadHasil();
  }, [id]);

  const handleMainLagi = async () => {
    if (!id) return;
    try {
      setIsMainLagiLoading(true);
      const res = await apiRequest<{ sessionId: string }>(`/sesi/${id}/main-lagi`, {
        method: 'POST',
      });
      navigate(`/guru/sesi/${res.sessionId}`);
    } catch (err: any) {
      alert(err.pesan || 'Gagal membuat sesi main lagi.');
      setIsMainLagiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="portal-bg min-h-screen flex flex-col items-center justify-center text-[#f4ecd8]">
        <Loader2 className="w-10 h-10 animate-spin text-[#f2c230] mb-4" />
        <p className="portal-cv text-3xl text-[#f4ecd8]">Menghitung hasil pertandingan...</p>
      </div>
    );
  }

  if (errorPesan || !hasil) {
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

  const isMerahMenang = hasil.timMenang === 'merah';
  const isPutihMenang = hasil.timMenang === 'putih';
  const isSeri = hasil.timMenang === 'seri';

  return (
    <div className="portal-bg min-h-screen select-none flex flex-col justify-between">
      <div className="max-w-4xl mx-auto w-full py-10 px-4 sm:px-6 space-y-6">
        {/* Banner Pemenang */}
        <div
          className={`p-8 sm:p-12 rounded-[32px] text-center shadow-[0_8px_0_rgba(0,0,0,0.22)] border-2 border-[#e0d5b8] transition-all ${
            isMerahMenang
              ? 'bg-gradient-to-b from-[#c8362f] to-[#8f1e19] text-[#fbf6e9]'
              : isPutihMenang
              ? 'bg-gradient-to-b from-[#1f4a6b] to-[#122e44] text-[#fbf6e9]'
              : 'bg-gradient-to-b from-[#b87333] via-[#9c5b24] to-[#7a4218] text-[#fbf6e9]'
          }`}
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/15 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border-2 border-white/30 shadow-inner">
            <Trophy className="w-12 h-12 sm:w-14 sm:h-14 text-[#f2c230] drop-shadow-md" />
          </div>

          <div className="text-xs sm:text-sm font-extrabold uppercase tracking-widest opacity-90 mb-2 text-[#f4ecd8]">
            Hasil Akhir Pertandingan
          </div>

          <h1 className="portal-cv text-4xl sm:text-5xl md:text-6xl mb-3 tracking-tight text-[#fbf6e9]">
            {isMerahMenang && 'TIM MERAH MENANG! 🏆'}
            {isPutihMenang && 'TIM PUTIH MENANG! 🏆'}
            {isSeri && 'PERTANDINGAN SERI! 🤝'}
          </h1>

          <p className="text-base sm:text-lg font-medium max-w-xl mx-auto opacity-95 text-[#f4ecd8]">
            {isMerahMenang &&
              `Tim Merah berhasil menarik tali ke posisi ${hasil.posisiAkhir} dan memenangkan lomba!`}
            {isPutihMenang &&
              `Tim Putih berhasil menarik tali ke posisi +${hasil.posisiAkhir} dan memenangkan lomba!`}
            {isSeri &&
              'Kedua tim bertarung seimbang hingga tali bertahan tepat di titik netral (0)!'}
          </p>
        </div>

        {/* Visualisasi Posisi Akhir Tali */}
        <VisualisasiTali
          posisi={hasil.posisiAkhir}
          skorMerah={hasil.skorMerah}
          skorPutih={hasil.skorPutih}
          pemenang={hasil.timMenang}
          theme="chalk"
        />

        {/* Statistik Ringkasan */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="portal-card p-4 text-center border-2 border-[#e0d5b8] shadow-[0_4px_0_rgba(0,0,0,0.18)] rounded-2xl">
            <div className="text-xs font-bold text-[#6b7d6c] uppercase tracking-wider mb-1">Skor Tim Merah</div>
            <div className="text-3xl font-black text-[#c8362f]">
              {hasil.skorMerah}
            </div>
          </div>

          <div className="portal-card p-4 text-center border-2 border-[#e0d5b8] shadow-[0_4px_0_rgba(0,0,0,0.18)] rounded-2xl">
            <div className="text-xs font-bold text-[#6b7d6c] uppercase tracking-wider mb-1">Skor Tim Putih</div>
            <div className="text-3xl font-black text-[#1e40af]">
              {hasil.skorPutih}
            </div>
          </div>

          <div className="portal-card p-4 text-center border-2 border-[#e0d5b8] shadow-[0_4px_0_rgba(0,0,0,0.18)] rounded-2xl">
            <div className="text-xs font-bold text-[#6b7d6c] uppercase tracking-wider mb-1">Total Jawaban Benar</div>
            <div className="text-3xl font-black text-[#1b432a]">
              {hasil.totalBenar}
            </div>
          </div>

          <div className="portal-card p-4 text-center border-2 border-[#e0d5b8] shadow-[0_4px_0_rgba(0,0,0,0.18)] rounded-2xl">
            <div className="text-xs font-bold text-[#6b7d6c] uppercase tracking-wider mb-1">Total Jawaban Salah</div>
            <div className="text-3xl font-black text-[#c8362f]">
              {hasil.totalSalah}
            </div>
          </div>
        </div>

        {/* Detail Riwayat Pertanyaan yang Dimainkan */}
        {hasil.logJawaban && hasil.logJawaban.length > 0 && (
          <div className="portal-card p-6 border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)] rounded-3xl">
            <h3 className="portal-cv text-2xl text-[#1d3b2e] mb-4">Catatan Perjalanan Soal</h3>
            <div className="divide-y-2 divide-dashed divide-[#e0d5b8]">
              {hasil.logJawaban.map((log, idx) => (
                <div key={idx} className="py-3 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 text-white ${
                        log.tim === 'merah' ? 'bg-[#c8362f]' : 'bg-[#1f4a6b]'
                      }`}
                    >
                      {log.tim === 'merah' ? 'M' : 'P'}
                    </span>
                    <div>
                      <div className="font-bold text-base text-[#1d3b2e]">
                        #{log.nomorSoal}: {log.teksSoal}
                      </div>
                      <div className="text-xs text-[#6b7d6c] mt-0.5">
                        Dijawab Tim {log.tim === 'merah' ? 'Merah' : 'Putih'}:{' '}
                        <strong className="text-[#1d3b2e]">
                          Opsi {log.jawabanDipilih}
                        </strong>{' '}
                        (Kunci: {log.jawabanBenar})
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {log.benar ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-[#d8e3cf] text-[#1b432a]">
                        <Check className="w-3.5 h-3.5" /> Benar
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-[#f6d9d3] text-[#c8362f]">
                        <X className="w-3.5 h-3.5" /> Salah
                      </span>
                    )}
                    <span className="text-xs font-mono font-bold text-[#6b7d6c] w-12 text-right">
                      {log.posisiSetelah > 0 ? `+${log.posisiSetelah}` : log.posisiSetelah}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tombol Aksi: Main Lagi & Selesai */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 pb-8">
          <button
            type="button"
            onClick={handleMainLagi}
            disabled={isMainLagiLoading}
            className="portal-btn w-full sm:w-auto px-8 py-3.5 text-base flex items-center justify-center gap-2"
            style={{ background: '#f2c230', color: '#1d3b2e' }}
          >
            {isMainLagiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
            <span>Main Lagi (Template Sama)</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/guru')}
            className="portal-btn red w-full sm:w-auto px-8 py-3.5 text-base flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            <span>Selesai (Kembali ke Dashboard)</span>
          </button>
        </div>
      </div>

      {/* Dudukan papan tulis kayu di paling bawah */}
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
    </div>
  );
}
