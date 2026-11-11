import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { apiRequest } from '../../lib/api';
import { VisualisasiTali } from './VisualisasiTali';
import KarakterTarikTambang from '../siswa/KarakterTarikTambang';
import {
  Clock,
  Flame,
  HelpCircle,
  Home,
  Loader2,
  RotateCcw,
  Trophy,
  Zap,
} from 'lucide-react';

interface PemainStat {
  id?: string;
  nama: string;
  tim: 'merah' | 'putih';
  totalBenar: number;
  totalSalah: number;
  jumlahJawab: number;
  akurasiPersen: number;
  streakTertinggi: number;
  totalBonusStreak: number;
  rataRataWaktuJawabMs: number;
  jumlahPowerUpDipakai?: number;
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
  jumlahRonde?: number;
  skorMerah: number;
  skorPutih: number;
  akurasiTim1?: number;
  akurasiTim2?: number;
  akurasiTim1Persen?: number;
  akurasiTim2Persen?: number;
  totalBenar: number;
  totalSalah: number;
  bonusStreakTim1?: number;
  bonusStreakTim2?: number;
  totalBonusStreakTim1?: number;
  totalBonusStreakTim2?: number;
  totalBonusKekompakanTim1?: number;
  totalBonusKekompakanTim2?: number;
  penggunaanPowerUp?: {
    tim1: Array<{ ronde: number; tipe: string; nama?: string }>;
    tim2: Array<{ ronde: number; tipe: string; nama?: string }>;
  };
  penggunaanPowerUpTim1?: Array<{ ronde: number; tipe: string }>;
  penggunaanPowerUpTim2?: Array<{ ronde: number; tipe: string }>;
  durasiPermainanMs?: number;
  riwayatTali?: Array<{ ronde: number; posisi: number; perubahan: number }>;
  statistikPemain?: PemainStat[];
}

function formatDurasi(ms?: number): string {
  if (!ms || ms <= 0) return '0d';
  const totalDetik = Math.round(ms / 1000);
  const menit = Math.floor(totalDetik / 60);
  const detik = totalDetik % 60;
  return menit > 0 ? `${menit}m ${detik}d` : `${detik}d`;
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
      } catch (err: any) {
        setErrorPesan(err.pesan || 'Gagal memuat hasil pertandingan.');
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
        body: JSON.stringify({ autoStart: hasil?.playMode === 'SOLO' }),
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
        <p className="portal-cv text-3xl text-[#f4ecd8]">Menyusun Laporan Pertandingan...</p>
      </div>
    );
  }

  if (errorPesan || !hasil) {
    return (
      <div className="portal-bg min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="portal-card p-8 max-w-md w-full border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.2)] rounded-3xl">
          <HelpCircle className="w-12 h-12 text-[#c8362f] mx-auto mb-4" />
          <h2 className="portal-cv text-3xl text-[#1d3b2e] mb-2">Laporan Tidak Tersedia</h2>
          <p className="text-sm text-[#6b7d6c] mb-6">{errorPesan}</p>
          <button
            type="button"
            className="portal-btn red w-full"
            onClick={() => navigate('/guru')}
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  const namaTim1 = hasil.konfigurasi?.namaTim1 || hasil.namaTim1 || 'Tim Merah';
  const namaTim2 = hasil.konfigurasi?.namaTim2 || hasil.namaTim2 || 'Tim Biru';
  const batasMenang = hasil.konfigurasi?.batasMenang ?? 100;
  const akurasi1 = hasil.akurasiTim1 ?? hasil.akurasiTim1Persen ?? 0;
  const akurasi2 = hasil.akurasiTim2 ?? hasil.akurasiTim2Persen ?? 0;
  const streak1 = hasil.totalBonusStreakTim1 ?? hasil.bonusStreakTim1 ?? 0;
  const streak2 = hasil.totalBonusStreakTim2 ?? hasil.bonusStreakTim2 ?? 0;
  const powerUp1Count =
    hasil.penggunaanPowerUp?.tim1?.length ?? hasil.penggunaanPowerUpTim1?.length ?? 0;
  const powerUp2Count =
    hasil.penggunaanPowerUp?.tim2?.length ?? hasil.penggunaanPowerUpTim2?.length ?? 0;
  const labelPemenang =
    hasil.timMenang === 'merah'
      ? `${namaTim1} Menang!`
      : hasil.timMenang === 'putih'
      ? `${namaTim2} Menang!`
      : 'Pertandingan Seri!';

  const bannerBg =
    hasil.timMenang === 'merah'
      ? 'bg-gradient-to-br from-[#c8362f] to-[#961e19] text-white'
      : hasil.timMenang === 'putih'
      ? 'bg-gradient-to-br from-[#2563eb] to-[#1e3a8a] text-white'
      : 'bg-gradient-to-br from-[#b45309] to-[#78350f] text-white';

  return (
    <div className="portal-bg min-h-screen px-4 py-6 sm:px-8 sm:py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Banner Pemenang */}
        <div className={`rounded-3xl p-6 sm:p-8 shadow-[0_8px_0_rgba(0,0,0,0.22)] ${bannerBg}`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-extrabold uppercase tracking-wider mb-2">
                <Trophy className="w-4 h-4 text-[#f2c230]" />
                <span>
                  Hasil Akhir {hasil.playMode === 'MULTIPLAYER' ? 'Team Multiplayer' : 'Solo 1 vs 1'}
                </span>
              </div>
              <h1 className="portal-cv text-4xl sm:text-5xl text-white">{labelPemenang}</h1>
              <p className="text-sm sm:text-base font-bold opacity-90 mt-1">
                {hasil.templateJudul} • Posisi Akhir Tali:{' '}
                {hasil.posisiAkhir > 0 ? `+${hasil.posisiAkhir}` : hasil.posisiAkhir} (Skala -
                {batasMenang}..+{batasMenang})
              </p>
            </div>

            <div className="flex items-end gap-3 bg-white/15 px-5 py-3 rounded-2xl">
              <KarakterTarikTambang
                tim="merah"
                pose="podium"
                ekspresi={
                  hasil.timMenang === 'merah'
                    ? 'menang'
                    : hasil.timMenang === 'seri'
                    ? 'bahagia'
                    : 'kalah'
                }
                podiumRank={hasil.timMenang === 'merah' ? 1 : 2}
                size="md"
              />
              <KarakterTarikTambang
                tim="putih"
                pose="podium"
                ekspresi={
                  hasil.timMenang === 'putih'
                    ? 'menang'
                    : hasil.timMenang === 'seri'
                    ? 'bahagia'
                    : 'kalah'
                }
                podiumRank={hasil.timMenang === 'putih' ? 1 : 2}
                size="md"
              />
            </div>
          </div>
        </div>

        {/* Arena Posisi Tali Akhir */}
        <VisualisasiTali
          posisi={hasil.posisiAkhir}
          batasMenang={batasMenang}
          skorMerah={hasil.skorMerah}
          skorPutih={hasil.skorPutih}
          namaTim1={namaTim1}
          namaTim2={namaTim2}
          pemenang={hasil.timMenang}
          theme="chalk"
        />

        {/* Ringkasan Statistik Pertandingan */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#fbf6e9] rounded-2xl p-4 border-2 border-[#e0d5b8]">
            <div className="text-xs font-bold text-[#6b7d6c]">Jumlah Ronde</div>
            <div className="text-2xl font-black text-[#1d3b2e] mt-1">
              {hasil.jumlahRonde ?? Math.max(1, (hasil.riwayatTali?.length || 1) - 1)}
            </div>
          </div>

          <div className="bg-[#fbf6e9] rounded-2xl p-4 border-2 border-[#e0d5b8]">
            <div className="text-xs font-bold text-[#6b7d6c] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Durasi
            </div>
            <div className="text-2xl font-black text-[#1d3b2e] mt-1">
              {formatDurasi(hasil.durasiPermainanMs)}
            </div>
          </div>

          <div className="bg-[#fbf6e9] rounded-2xl p-4 border-2 border-[#d9544c]/60">
            <div className="text-xs font-bold text-[#c8362f]">Akurasi {namaTim1}</div>
            <div className="text-2xl font-black text-[#c8362f] mt-1">{akurasi1}%</div>
            <div className="text-[11px] font-bold text-[#6b7d6c]">
              Bonus Streak: +{streak1}
              {hasil.playMode === 'MULTIPLAYER'
                ? ` • Kompak: +${hasil.totalBonusKekompakanTim1 ?? 0}`
                : ''}
            </div>
          </div>

          <div className="bg-[#fbf6e9] rounded-2xl p-4 border-2 border-[#3b82f6]/60">
            <div className="text-xs font-bold text-[#2563eb]">Akurasi {namaTim2}</div>
            <div className="text-2xl font-black text-[#2563eb] mt-1">{akurasi2}%</div>
            <div className="text-[11px] font-bold text-[#6b7d6c]">
              Bonus Streak: +{streak2}
              {hasil.playMode === 'MULTIPLAYER'
                ? ` • Kompak: +${hasil.totalBonusKekompakanTim2 ?? 0}`
                : ''}
            </div>
          </div>
        </div>

        {/* Power-Up & Riwayat Pergerakan Tali */}
        <div className="bg-[#fbf6e9] rounded-3xl p-6 border-2 border-[#e0d5b8] space-y-4">
          <h2 className="text-lg font-black text-[#1d3b2e] flex items-center gap-2">
            <span>Riwayat Pergerakan Tali &amp; Power-Up</span>
          </h2>

          <div className="flex flex-wrap gap-2">
            {(hasil.riwayatTali || []).map((item, idx) => (
              <div
                key={idx}
                className="px-3 py-1.5 rounded-xl bg-[#f4ecd9] border border-[#d6c8a4] text-xs font-extrabold text-[#1d3b2e]"
              >
                R{item.ronde}:{' '}
                <span
                  className={
                    item.posisi > 0
                      ? 'text-[#c8362f]'
                      : item.posisi < 0
                      ? 'text-[#2563eb]'
                      : 'text-[#b45309]'
                  }
                >
                  {item.posisi > 0 ? `+${item.posisi}` : item.posisi}
                </span>
                {item.perubahan !== 0 && (
                  <span className="ml-1 text-[10px] opacity-75">
                    ({item.perubahan > 0 ? `+${item.perubahan}` : item.perubahan})
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
            <div className="p-3 rounded-xl bg-[#fde8e7] text-[#961e19] flex items-center gap-2">
              <Zap className="w-4 h-4 shrink-0" />
              <span>
                Power-Up {namaTim1}: {powerUp1Count}x digunakan
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#dbeafe] text-[#1e3a8a] flex items-center gap-2">
              <Zap className="w-4 h-4 shrink-0" />
              <span>
                Power-Up {namaTim2}: {powerUp2Count}x digunakan
              </span>
            </div>
          </div>
        </div>

        {/* Tabel Statistik Pemain */}
        {hasil.statistikPemain && hasil.statistikPemain.length > 0 && (
          <div className="bg-[#fbf6e9] rounded-3xl p-6 border-2 border-[#e0d5b8] overflow-x-auto">
            <h2 className="text-lg font-black text-[#1d3b2e] mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-[#c8362f]" />
              <span>Statistik Siswa</span>
            </h2>
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b-2 border-[#e0d5b8] text-xs font-extrabold uppercase text-[#6b7d6c]">
                  <th className="py-2 pr-3">Nama</th>
                  <th className="py-2 pr-3">Tim</th>
                  <th className="py-2 pr-3">Benar / Salah</th>
                  <th className="py-2 pr-3">Akurasi</th>
                  <th className="py-2 pr-3">Streak Tertinggi</th>
                  <th className="py-2">Bonus Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0d5b8] font-bold text-[#1d3b2e]">
                {hasil.statistikPemain.map((p, idx) => (
                  <tr key={p.id || idx}>
                    <td className="py-2.5 pr-3">{p.nama}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-black ${
                          p.tim === 'merah'
                            ? 'bg-[#fde8e7] text-[#c8362f]'
                            : 'bg-[#dbeafe] text-[#2563eb]'
                        }`}
                      >
                        {p.tim === 'merah' ? namaTim1 : namaTim2}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="text-emerald-700">{p.totalBenar}</span> /{' '}
                      <span className="text-red-600">{p.totalSalah}</span>
                    </td>
                    <td className="py-2.5 pr-3">{p.akurasiPersen}%</td>
                    <td className="py-2.5 pr-3">{p.streakTertinggi}</td>
                    <td className="py-2.5">+{p.totalBonusStreak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tombol Navigasi Bawah */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            type="button"
            disabled={isMainLagiLoading}
            onClick={handleMainLagi}
            className="px-6 py-3.5 rounded-2xl bg-[#c8362f] hover:bg-[#b02b24] text-white font-black inline-flex items-center gap-2 shadow-[0_4px_0_#7f1d1d]"
          >
            {isMainLagiLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            <span>Main Lagi (Aturan Sama)</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/guru')}
            className="px-6 py-3.5 rounded-2xl bg-[#fbf6e9] hover:bg-white text-[#1d3b2e] font-black border-2 border-[#d6c8a4] inline-flex items-center gap-2 shadow"
          >
            <Home className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
