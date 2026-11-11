import { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Trophy,
  Eye,
} from 'lucide-react';

interface RiwayatDetailModalProps {
  sessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface SoalStat {
  questionId: string;
  urutan: number;
  teks: string;
  opsiA: string;
  opsiB: string;
  opsiC?: string | null;
  opsiD?: string | null;
  opsiE?: string | null;
  jawabanBenar: string;
  penjelasan: string | null;
  jumlahBenar: number;
  jumlahSalah: number;
}

interface PanjatPemainLaporan {
  peringkat: number;
  id: string;
  nama: string;
  posisiAkhir: number;
  poinBonus: number;
  status: 'bermain' | 'selesai';
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakTertinggi: number;
  rataRataWaktuJawabMs: number;
  waktuSelesaiMs: number | null;
  riwayatRintangan: Array<{
    id: string;
    tipe: string;
    judul: string;
    deskripsi: string;
    efekNilai: number;
    satuan: string;
  }>;
}

interface LaporanPanjatDetail {
  konfigurasi?: {
    kesulitan: string;
    naikBenar: number;
    turunSalah: number;
    bonusStreakAktif: boolean;
    rintanganAktif: boolean;
  };
  totalPeserta: number;
  totalSelesai: number;
  totalJawabanBenar: number;
  totalJawabanSalah: number;
  dihentikanManual: boolean;
  laporanPemain: PanjatPemainLaporan[];
}

interface BalapPemainLaporan {
  peringkat: number;
  id: string;
  nama: string;
  jarakAkhir: number;
  targetJarak: number;
  keseimbanganAkhir: number;
  jumlahJatuh: number;
  status: 'bermain' | 'selesai';
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakTertinggi: number;
  totalBonusStreakKali: number;
  totalBonusStreakMeter: number;
  rataRataWaktuJawabMs: number;
  waktuSelesaiMs: number | null;
  riwayatRintangan: Array<{
    id: string;
    tipe: string;
    judul: string;
    deskripsi: string;
    efekNilai: number;
    satuan: string;
  }>;
}

interface LaporanBalapDetail {
  konfigurasi?: {
    targetJarak: number;
    kesulitan: string;
    lompatBenar: number;
    turunSalah: number;
    keseimbanganAktif: boolean;
    bonusStreakAktif: boolean;
    rintanganAktif: boolean;
  };
  totalPeserta: number;
  totalSelesai: number;
  totalJawabanBenar: number;
  totalJawabanSalah: number;
  totalJatuhKelas: number;
  dihentikanManual: boolean;
  laporanPemain: BalapPemainLaporan[];
}

interface LaporanKerupukSoloDetail {
  sessionId: string;
  templateJudul: string;
  statusAkhir: 'FINISHED' | 'STOPPED';
  dihentikanManual: boolean;
  konfigurasi?: {
    targetKerupuk: number;
    kesulitan: string;
    probabilitas: Record<string, number>;
  };
  targetKerupuk: number;
  sisaKerupuk: number;
  progresPersen: number;
  skorTotal: number;
  skorPembelajaran: number;
  skorDasarBenar: number;
  totalBonusStreak: number;
  bonusKeberuntungan: number;
  bonusPenyelesaian: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakTertinggi: number;
  rataRataWaktuJawabMs: number;
  statistikGigitan?: {
    besar: number;
    sedang: number;
    kecil: number;
    sangat_kecil: number;
    zonk: number;
  };
}

interface LaporanKerupukMultiDetail {
  sessionId: string;
  templateJudul: string;
  dihentikanManual: boolean;
  konfigurasi?: {
    targetKerupuk: number;
    kesulitan: string;
  };
  totalPeserta: number;
  totalKerupukHabis: number;
  totalJawabanBenar: number;
  totalJawabanSalah: number;
  leaderboard: Array<{
    peringkat?: number;
    id: string;
    nama: string;
    skorTotal: number;
    skorPembelajaran: number;
    bonusKeberuntungan: number;
    bonusPenyelesaian: number;
    sisaKerupuk: number;
    totalBenar: number;
    totalSalah: number;
    rataRataWaktuJawabMs: number;
  }>;
}

interface DetailData {
  sessionId: string;
  templateJudul: string;
  game?: string;
  mode: string;
  tanggal: string;
  timMenang: string;
  posisiAkhir: number;
  skorMerah: number;
  skorPutih: number;
  totalBenar: number;
  totalSalah: number;
  totalSoalDimainkan: number;
  laporanPanjatPinang?: LaporanPanjatDetail | null;
  laporanBalapKarung?: LaporanBalapDetail | null;
  laporanKerupukSolo?: LaporanKerupukSoloDetail | null;
  laporanKerupukMulti?: LaporanKerupukMultiDetail | null;
  statsPerSoal: SoalStat[];
  soalPalingSeringSalah: {
    questionId: string;
    urutan: number;
    teks: string;
    jumlahSalah: number;
    jumlahBenar: number;
    penjelasan: string | null;
  } | null;
}

function formatMsDetik(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return '-';
  if (ms < 1000) return `${ms} md`;
  const detik = ms / 1000;
  if (detik < 60) return `${detik.toFixed(1)} dtk`;
  const menit = Math.floor(detik / 60);
  return `${menit}m ${Math.round(detik % 60)}d`;
}

export function RiwayatDetailModal({
  sessionId,
  isOpen,
  onClose,
}: RiwayatDetailModalProps) {
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [selectedPemainId, setSelectedPemainId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !isOpen) {
      setDetail(null);
      setSelectedPemainId(null);
      return;
    }

    async function fetchDetail() {
      setLoading(true);
      setErrorPesan(null);
      try {
        const res = await apiRequest<{ detail: DetailData }>(
          `/sesi/riwayat/${sessionId}`
        );
        setDetail(res.detail);
      } catch (err: any) {
        setErrorPesan(err.pesan || 'Gagal memuat detail riwayat.');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [sessionId, isOpen]);

  // Posisi visual tali (-5 sampai +5) dipetakan ke persentase 10% - 90%
  const ropePos = detail ? Math.max(-5, Math.min(5, detail.posisiAkhir)) : 0;
  const ropeLeftPercent = 50 + ropePos * 8;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detail Analisis Pertandingan Sesi"
      maxWidth="lg"
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-[#6b7d6c]">
          <Loader2 className="w-8 h-8 animate-spin text-[#c8362f] mb-3" />
          <p className="portal-cv text-xl text-[#1d3b2e]">Menyiapkan rekapitulasi nilai...</p>
        </div>
      ) : errorPesan || !detail ? (
        <div className="py-6 text-center text-[#6b7d6c]">
          <p>{errorPesan || 'Data tidak tersedia.'}</p>
        </div>
      ) : (
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Header Ringkasan */}
          <div className="bg-[#f4ecd9] p-4 rounded-2xl border border-[#e0d5b8] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6b7d6c]">
                {detail.game === 'panjat_pinang'
                  ? 'Materi Kuis Panjat Pinang'
                  : detail.game === 'balap_karung'
                  ? 'Materi Kuis Balap Karung Challenge'
                  : detail.game === 'makan_kerupuk'
                  ? 'Materi Kuis Makan Kerupuk'
                  : 'Materi Kuis Tarik Tambang'}
              </span>
              <span className="portal-tag yellow font-bold">
                {detail.game === 'makan_kerupuk'
                  ? detail.mode === 'MULTI'
                    ? 'Mode Multiplayer (HP Siswa)'
                    : 'Mode Solo (Perangkat Guru)'
                  : detail.game === 'balap_karung'
                  ? detail.mode === 'MULTI'
                    ? 'Mode Multiplayer (HP Siswa)'
                    : 'Mode Solo (Duel 1 vs 1)'
                  : detail.game === 'panjat_pinang'
                  ? 'Individu Multiplayer'
                  : `Mode ${detail.mode === 'MULTI' || detail.mode === 'multi' ? 'Multiplayer' : 'Solo'}`}
              </span>
            </div>
            <h3 className="portal-cv text-2xl text-[#1d3b2e] leading-snug">
              {detail.templateJudul}
            </h3>
            <div className="text-xs text-[#6b7d6c]">
              Dimainkan pada:{' '}
              {new Date(detail.tanggal).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          {detail.game === 'makan_kerupuk' && detail.laporanKerupukMulti ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-[#1d3b2e] text-[#f4ecd8] rounded-xl">
                  <div className="text-xs font-bold opacity-80">Juara 1</div>
                  <div className="text-sm font-black mt-1 truncate">
                    {detail.laporanKerupukMulti.leaderboard[0]?.nama || detail.timMenang}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-xs font-bold text-emerald-700">Kerupuk Ludes</div>
                  <div className="portal-cv text-2xl text-emerald-800">
                    {detail.laporanKerupukMulti.totalKerupukHabis}/{detail.laporanKerupukMulti.totalPeserta}
                  </div>
                </div>
                <div className="p-3 bg-[#f4ecd9] border border-[#e0d5b8] rounded-xl">
                  <div className="text-xs font-bold text-[#6b7d6c]">Target Kerupuk</div>
                  <div className="portal-cv text-2xl text-[#1d3b2e]">
                    {detail.laporanKerupukMulti.konfigurasi?.targetKerupuk ?? 100} pt
                  </div>
                </div>
                <div className="p-3 bg-[#f4ecd9] border border-[#e0d5b8] rounded-xl">
                  <div className="text-xs font-bold text-[#6b7d6c]">Akurasi Kelas</div>
                  <div className="portal-cv text-2xl text-[#1d3b2e]">
                    {Math.round(
                      (detail.laporanKerupukMulti.totalJawabanBenar /
                        Math.max(
                          1,
                          detail.laporanKerupukMulti.totalJawabanBenar +
                            detail.laporanKerupukMulti.totalJawabanSalah
                        )) *
                        100
                    )}%
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#e0d5b8] rounded-2xl p-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase font-black text-[#6b7d6c] border-b border-[#e0d5b8]">
                    <tr>
                      <th className="py-1.5 px-2">Rank</th>
                      <th className="py-1.5 px-2">Siswa</th>
                      <th className="py-1.5 px-2">Total</th>
                      <th className="py-1.5 px-2">Pembelajaran</th>
                      <th className="py-1.5 px-2">Keberuntungan</th>
                      <th className="py-1.5 px-2">Ludes</th>
                      <th className="py-1.5 px-2">Sisa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e0d5b8]">
                    {detail.laporanKerupukMulti.leaderboard.map((p, idx) => (
                      <tr key={p.id}>
                        <td className="py-1.5 px-2 font-mono font-bold">#{idx + 1}</td>
                        <td className="py-1.5 px-2 font-bold">{p.nama}</td>
                        <td className="py-1.5 px-2 font-mono font-black text-[#c8362f]">
                          {p.skorTotal}
                        </td>
                        <td className="py-1.5 px-2 font-mono">{p.skorPembelajaran}</td>
                        <td className="py-1.5 px-2 font-mono">+{p.bonusKeberuntungan}</td>
                        <td className="py-1.5 px-2 font-mono">+{p.bonusPenyelesaian}</td>
                        <td className="py-1.5 px-2 font-mono">
                          {p.sisaKerupuk === 0 ? 'Habis' : `${p.sisaKerupuk} pt`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : detail.game === 'makan_kerupuk' && detail.laporanKerupukSolo ? (
            <div className="space-y-4">
              {/* Ringkasan Skor Mode Solo Makan Kerupuk */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-[#1d3b2e] text-[#f4ecd8] rounded-xl">
                  <div className="text-xs font-bold opacity-80">Skor Total</div>
                  <div className="portal-cv text-3xl">{detail.laporanKerupukSolo.skorTotal}</div>
                </div>
                <div className="p-3 bg-[#f4ecd9] border border-[#e0d5b8] rounded-xl">
                  <div className="text-xs font-bold text-[#6b7d6c]">Skor Pembelajaran</div>
                  <div className="portal-cv text-2xl text-[#1d3b2e]">
                    {detail.laporanKerupukSolo.skorPembelajaran}
                  </div>
                  <div className="text-[11px] text-[#6b7d6c]">
                    Benar {detail.laporanKerupukSolo.skorDasarBenar} + Streak{' '}
                    {detail.laporanKerupukSolo.totalBonusStreak}
                  </div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="text-xs font-bold text-amber-800">Keberuntungan Gigitan</div>
                  <div className="portal-cv text-2xl text-amber-800">
                    +{detail.laporanKerupukSolo.bonusKeberuntungan}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-xs font-bold text-emerald-700">Bonus Penyelesaian</div>
                  <div className="portal-cv text-2xl text-emerald-800">
                    +{detail.laporanKerupukSolo.bonusPenyelesaian}
                  </div>
                </div>
              </div>

              <div className="bg-[#fbf6e9] border border-[#e0d5b8] p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#1d3b2e]">
                <span>
                  Status Akhir:{' '}
                  <span className="uppercase">
                    {detail.laporanKerupukSolo.statusAkhir === 'FINISHED'
                      ? 'Selesai (Kerupuk Habis)'
                      : 'Dihentikan Guru'}
                  </span>
                </span>
                <span>
                  Target: {detail.laporanKerupukSolo.targetKerupuk} pt • Sisa:{' '}
                  {detail.laporanKerupukSolo.sisaKerupuk} pt (Progres{' '}
                  {detail.laporanKerupukSolo.progresPersen}%)
                </span>
                <span>
                  Akurasi: {detail.laporanKerupukSolo.akurasiPersen}% (Streak maks{' '}
                  {detail.laporanKerupukSolo.streakTertinggi}x)
                </span>
              </div>

              {detail.laporanKerupukSolo.statistikGigitan && (
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  {[
                    { label: 'Besar', val: detail.laporanKerupukSolo.statistikGigitan.besar },
                    { label: 'Sedang', val: detail.laporanKerupukSolo.statistikGigitan.sedang },
                    { label: 'Kecil', val: detail.laporanKerupukSolo.statistikGigitan.kecil },
                    { label: 'Mini', val: detail.laporanKerupukSolo.statistikGigitan.sangat_kecil },
                    { label: 'Zonk', val: detail.laporanKerupukSolo.statistikGigitan.zonk },
                  ].map((g) => (
                    <div
                      key={g.label}
                      className="p-2 bg-white border border-[#e0d5b8] rounded-xl font-bold"
                    >
                      <div className="text-[11px] text-[#6b7d6c]">{g.label}</div>
                      <div className="text-lg font-black text-[#1d3b2e]">{g.val}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : detail.game === 'balap_karung' && detail.laporanBalapKarung ? (
            <div className="space-y-4">
              {/* Ringkasan Lomba Balap Karung */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-[#f4ecd9] border border-[#e0d5b8] rounded-xl">
                  <div className="text-xs font-bold text-[#6b7d6c]">Juara 1</div>
                  <div className="text-sm font-black text-[#1d3b2e] mt-1 truncate">
                    {detail.laporanBalapKarung.laporanPemain[0]?.nama || detail.timMenang}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-xs font-bold text-emerald-700">Mencapai Finis</div>
                  <div className="portal-cv text-2xl text-emerald-800">
                    {detail.laporanBalapKarung.totalSelesai}/{detail.laporanBalapKarung.totalPeserta}
                  </div>
                </div>
                <div className="p-3 bg-[#f4ecd9] border border-[#e0d5b8] rounded-xl">
                  <div className="text-xs font-bold text-[#6b7d6c]">Akurasi Kelas</div>
                  <div className="portal-cv text-2xl text-[#1d3b2e]">
                    {Math.round(
                      (detail.laporanBalapKarung.totalJawabanBenar /
                        Math.max(
                          1,
                          detail.laporanBalapKarung.totalJawabanBenar +
                            detail.laporanBalapKarung.totalJawabanSalah
                        )) *
                        100
                    )}%
                  </div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="text-xs font-bold text-rose-700">Total Jatuh Kelas</div>
                  <div className="portal-cv text-2xl text-rose-800">
                    {detail.laporanBalapKarung.totalJatuhKelas}x
                  </div>
                </div>
              </div>

              {detail.laporanBalapKarung.konfigurasi && (
                <div className="p-3 rounded-xl bg-[#fbf6e9] border border-[#e0d5b8] text-xs text-[#1d3b2e] flex flex-wrap gap-3">
                  <span>
                    Target: <strong>{detail.laporanBalapKarung.konfigurasi.targetJarak}m</strong>
                  </span>
                  <span>
                    Kesulitan:{' '}
                    <strong className="uppercase">{detail.laporanBalapKarung.konfigurasi.kesulitan}</strong>
                  </span>
                  <span>
                    Benar: <strong>+{detail.laporanBalapKarung.konfigurasi.lompatBenar}m</strong>
                  </span>
                  <span>
                    Salah: <strong>-{detail.laporanBalapKarung.konfigurasi.turunSalah}m</strong>
                  </span>
                  <span>
                    Keseimbangan:{' '}
                    <strong>{detail.laporanBalapKarung.konfigurasi.keseimbanganAktif ? 'Aktif' : 'Nonaktif'}</strong>
                  </span>
                  <span>
                    Rintangan:{' '}
                    <strong>{detail.laporanBalapKarung.konfigurasi.rintanganAktif ? 'Aktif' : 'Nonaktif'}</strong>
                  </span>
                </div>
              )}

              {/* Tabel Semua Pelari Balap Karung */}
              <div className="border border-[#e0d5b8] rounded-2xl overflow-hidden bg-white">
                <div className="px-4 py-2.5 bg-[#f4ecd9] border-b border-[#e0d5b8] flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#8a6a00]" />
                  <span className="text-xs font-bold uppercase text-[#1d3b2e]">
                    Peringkat & Statistik Pelari ({detail.laporanBalapKarung.laporanPemain.length})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] text-[#1d3b2e]">
                    <thead className="bg-[#fbf6e9] border-b border-[#e0d5b8] uppercase font-bold">
                      <tr>
                        <th className="px-2.5 py-2">Rank</th>
                        <th className="px-2.5 py-2">Nama</th>
                        <th className="px-2.5 py-2 text-right">Jarak</th>
                        <th className="px-2.5 py-2 text-right">Seimbang</th>
                        <th className="px-2.5 py-2">Status</th>
                        <th className="px-2.5 py-2 text-center">B/S</th>
                        <th className="px-2.5 py-2 text-right">Jatuh</th>
                        <th className="px-2.5 py-2 text-right">Bonus</th>
                        <th className="px-2.5 py-2 text-right">Rata2</th>
                        <th className="px-2.5 py-2 text-right">Finis</th>
                        <th className="px-2.5 py-2 text-center">Rintangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e0d5b8]/60">
                      {detail.laporanBalapKarung.laporanPemain.map((pm) => {
                        const isExpanded = selectedPemainId === pm.id;
                        return (
                          <tr key={pm.id} className={isExpanded ? 'bg-[#fbf6e9]' : ''}>
                            <td className="px-2.5 py-2 font-black">#{pm.peringkat}</td>
                            <td className="px-2.5 py-2 font-bold">{pm.nama}</td>
                            <td className="px-2.5 py-2 text-right font-mono font-bold text-emerald-700">
                              {pm.jarakAkhir}/{pm.targetJarak}m
                            </td>
                            <td className="px-2.5 py-2 text-right font-mono">
                              {pm.keseimbanganAkhir}%
                            </td>
                            <td className="px-2.5 py-2">
                              {pm.status === 'selesai' ? 'Finis' : 'Belum'}
                            </td>
                            <td className="px-2.5 py-2 text-center font-mono">
                              {pm.totalBenar}/{pm.totalSalah}
                            </td>
                            <td className="px-2.5 py-2 text-right font-mono text-rose-700">
                              {pm.jumlahJatuh}x
                            </td>
                            <td className="px-2.5 py-2 text-right font-mono">
                              {pm.totalBonusStreakKali}x
                            </td>
                            <td className="px-2.5 py-2 text-right font-mono">
                              {formatMsDetik(pm.rataRataWaktuJawabMs)}
                            </td>
                            <td className="px-2.5 py-2 text-right font-mono">
                              {formatMsDetik(pm.waktuSelesaiMs)}
                            </td>
                            <td className="px-2.5 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedPemainId(isExpanded ? null : pm.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f4ecd9] hover:bg-[#e8dfc8] font-bold"
                                title="Lihat riwayat rintangan & jatuh"
                              >
                                <Eye className="w-3 h-3" /> {pm.riwayatRintangan?.length || 0}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedPemainId && (() => {
                const pmSelected = detail.laporanBalapKarung!.laporanPemain.find(
                  (x) => x.id === selectedPemainId
                );
                if (!pmSelected) return null;
                return (
                  <div className="p-3.5 rounded-2xl bg-[#f4ecd9] border border-[#e0d5b8] space-y-2 text-xs text-[#1d3b2e]">
                    <div className="flex items-center justify-between font-bold">
                      <span>Riwayat Rintangan & Jatuh: {pmSelected.nama}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedPemainId(null)}
                        className="underline text-[#c8362f]"
                      >
                        Tutup
                      </button>
                    </div>
                    {pmSelected.riwayatRintangan.length === 0 ? (
                      <p className="italic text-[#6b7d6c]">Tidak ada rintangan atau kejadian jatuh.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {pmSelected.riwayatRintangan.map((r) => (
                          <div
                            key={r.id}
                            className="p-2 rounded-lg bg-white border border-[#e0d5b8] flex items-center justify-between gap-2"
                          >
                            <div>
                              <strong>{r.judul}: </strong>
                              <span>{r.deskripsi}</span>
                            </div>
                            <span className="font-mono font-bold shrink-0">
                              {r.efekNilai !== 0 ? `${r.efekNilai > 0 ? '+' : ''}${r.efekNilai} ${r.satuan}` : r.satuan}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : detail.game === 'panjat_pinang' && detail.laporanPanjatPinang ? (
            <div className="space-y-4">
              {/* Ringkasan Lomba Panjat Pinang */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-[#f4ecd9] border border-[#e0d5b8] rounded-xl">
                  <div className="text-xs font-bold text-[#6b7d6c]">Juara 1</div>
                  <div className="text-sm font-black text-[#1d3b2e] mt-1 truncate">
                    {detail.laporanPanjatPinang.laporanPemain[0]?.nama || detail.timMenang}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-xs font-bold text-emerald-700">Mencapai Puncak</div>
                  <div className="portal-cv text-2xl text-emerald-800">
                    {detail.laporanPanjatPinang.totalSelesai}/{detail.laporanPanjatPinang.totalPeserta}
                  </div>
                </div>
                <div className="p-3 bg-[#f4ecd9] border border-[#e0d5b8] rounded-xl">
                  <div className="text-xs font-bold text-[#6b7d6c]">Akurasi Kelas</div>
                  <div className="portal-cv text-2xl text-[#1d3b2e]">
                    {Math.round(
                      (detail.laporanPanjatPinang.totalJawabanBenar /
                        Math.max(
                          1,
                          detail.laporanPanjatPinang.totalJawabanBenar +
                            detail.laporanPanjatPinang.totalJawabanSalah
                        )) *
                        100
                    )}%
                  </div>
                </div>
                <div className="p-3 bg-[#f4ecd9] border border-[#e0d5b8] rounded-xl">
                  <div className="text-xs font-bold text-[#6b7d6c]">Status Akhir</div>
                  <div className="text-xs font-bold text-[#1d3b2e] mt-1">
                    {detail.laporanPanjatPinang.dihentikanManual ? 'Dihentikan Guru' : 'Semua Puncak'}
                  </div>
                </div>
              </div>

              {detail.laporanPanjatPinang.konfigurasi && (
                <div className="p-3 rounded-xl bg-[#fbf6e9] border border-[#e0d5b8] text-xs text-[#1d3b2e] flex flex-wrap gap-3">
                  <span>
                    Kesulitan: <strong className="uppercase">{detail.laporanPanjatPinang.konfigurasi.kesulitan}</strong>
                  </span>
                  <span>
                    Naik Benar: <strong>+{detail.laporanPanjatPinang.konfigurasi.naikBenar}%</strong>
                  </span>
                  <span>
                    Turun Salah: <strong>-{detail.laporanPanjatPinang.konfigurasi.turunSalah}%</strong>
                  </span>
                  <span>
                    Streak Bonus: <strong>{detail.laporanPanjatPinang.konfigurasi.bonusStreakAktif ? 'Aktif' : 'Nonaktif'}</strong>
                  </span>
                  <span>
                    Rintangan: <strong>{detail.laporanPanjatPinang.konfigurasi.rintanganAktif ? 'Aktif' : 'Nonaktif'}</strong>
                  </span>
                </div>
              )}

              {/* Tabel Semua Pemain Panjat Pinang */}
              <div className="border border-[#e0d5b8] rounded-2xl overflow-hidden bg-white">
                <div className="px-4 py-2.5 bg-[#f4ecd9] border-b border-[#e0d5b8] flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#8a6a00]" />
                  <span className="text-xs font-bold uppercase text-[#1d3b2e]">
                    Peringkat & Statistik Pemain ({detail.laporanPanjatPinang.laporanPemain.length})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] text-[#1d3b2e]">
                    <thead className="bg-[#fbf6e9] border-b border-[#e0d5b8] uppercase font-bold">
                      <tr>
                        <th className="px-2.5 py-2">Rank</th>
                        <th className="px-2.5 py-2">Nama</th>
                        <th className="px-2.5 py-2 text-right">Posisi</th>
                        <th className="px-2.5 py-2 text-right">Poin</th>
                        <th className="px-2.5 py-2">Status</th>
                        <th className="px-2.5 py-2 text-center">B/S</th>
                        <th className="px-2.5 py-2 text-right">Akurasi</th>
                        <th className="px-2.5 py-2 text-right">Streak</th>
                        <th className="px-2.5 py-2 text-right">Rata2</th>
                        <th className="px-2.5 py-2 text-right">Selesai</th>
                        <th className="px-2.5 py-2 text-center">Rintangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e0d5b8]/60">
                      {detail.laporanPanjatPinang.laporanPemain.map((pm) => {
                        const isExpanded = selectedPemainId === pm.id;
                        return (
                          <tr key={pm.id} className={isExpanded ? 'bg-[#fbf6e9]' : ''}>
                            <td className="px-2.5 py-2 font-black">#{pm.peringkat}</td>
                            <td className="px-2.5 py-2 font-bold">{pm.nama}</td>
                            <td className="px-2.5 py-2 text-right font-mono font-bold text-emerald-700">
                              {pm.posisiAkhir}%
                            </td>
                            <td className="px-2.5 py-2 text-right font-mono">
                              {pm.poinBonus > 0 ? `+${pm.poinBonus}` : '-'}
                            </td>
                            <td className="px-2.5 py-2">
                              {pm.status === 'selesai' ? 'Selesai' : 'Belum'}
                            </td>
                            <td className="px-2.5 py-2 text-center font-mono">
                              {pm.totalBenar}/{pm.totalSalah}
                            </td>
                            <td className="px-2.5 py-2 text-right font-mono">{pm.akurasiPersen}%</td>
                            <td className="px-2.5 py-2 text-right font-mono">{pm.streakTertinggi}x</td>
                            <td className="px-2.5 py-2 text-right font-mono">
                              {formatMsDetik(pm.rataRataWaktuJawabMs)}
                            </td>
                            <td className="px-2.5 py-2 text-right font-mono">
                              {formatMsDetik(pm.waktuSelesaiMs)}
                            </td>
                            <td className="px-2.5 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedPemainId(isExpanded ? null : pm.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f4ecd9] hover:bg-[#e8dfc8] font-bold"
                                title="Lihat riwayat rintangan"
                              >
                                <Eye className="w-3 h-3" /> {pm.riwayatRintangan?.length || 0}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detail Riwayat Rintangan Pemain Terpilih */}
              {selectedPemainId && (() => {
                const pmSelected = detail.laporanPanjatPinang!.laporanPemain.find(
                  (x) => x.id === selectedPemainId
                );
                if (!pmSelected) return null;
                return (
                  <div className="p-3.5 rounded-2xl bg-[#f4ecd9] border border-[#e0d5b8] space-y-2 text-xs text-[#1d3b2e]">
                    <div className="flex items-center justify-between font-bold">
                      <span>Riwayat Rintangan: {pmSelected.nama}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedPemainId(null)}
                        className="underline text-[#c8362f]"
                      >
                        Tutup
                      </button>
                    </div>
                    {pmSelected.riwayatRintangan.length === 0 ? (
                      <p className="italic text-[#6b7d6c]">Tidak ada rintangan yang dialami.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {pmSelected.riwayatRintangan.map((r) => (
                          <div
                            key={r.id}
                            className="p-2 rounded-lg bg-white border border-[#e0d5b8] flex items-center justify-between gap-2"
                          >
                            <div>
                              <strong>{r.judul}: </strong>
                              <span>{r.deskripsi}</span>
                            </div>
                            <span className="font-mono font-bold shrink-0">
                              {r.efekNilai !== 0 ? `${r.efekNilai > 0 ? '+' : ''}${r.efekNilai} ${r.satuan}` : r.satuan}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <>
              {/* Indikator Visual Tali Tarik Tambang */}
              {detail.game !== 'makan_kerupuk' && (
                <div className="bg-[#fbf6e9] p-4 rounded-2xl border border-[#e0d5b8] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#1d3b2e]">
                    <span>Visualisasi Tali Pertandingan</span>
                    <span className="font-mono">
                      Posisi Akhir: {detail.posisiAkhir > 0 ? `+${detail.posisiAkhir}` : detail.posisiAkhir}
                    </span>
                  </div>
                  <div className="portal-rope">
                    <i style={{ left: `${ropeLeftPercent}%` }} />
                  </div>
                  <div className="portal-rl">
                    <span className="text-[#c8362f]">Tim Merah (Kiri)</span>
                    <span className="text-[#1d3b2e]">Tim Putih (Kanan)</span>
                  </div>
                </div>
              )}

              {/* Kartu Skor & Pemenang */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-[#f6d9d3] border border-[#d9544c]/30 rounded-xl">
                  <div className="text-xs font-bold text-[#c8362f]">
                    {detail.game === 'makan_kerupuk' ? 'Skor Tertinggi' : 'Skor Merah'}
                  </div>
                  <div className="portal-cv text-3xl text-[#c8362f]">
                    {detail.skorMerah}
                  </div>
                </div>

                <div className="p-3 bg-[#dbeafe] border border-blue-200 rounded-xl">
                  <div className="text-xs font-bold text-[#1e40af]">
                    {detail.game === 'makan_kerupuk' ? 'Total Benar' : 'Skor Putih'}
                  </div>
                  <div className="portal-cv text-3xl text-[#1e40af]">
                    {detail.game === 'makan_kerupuk' ? detail.totalBenar : detail.skorPutih}
                  </div>
                </div>

                <div className="p-3 bg-[#f4ecd9] border border-[#e0d5b8] rounded-xl">
                  <div className="text-xs font-bold text-[#6b7d6c]">Pemenang</div>
                  <div className="text-sm font-extrabold uppercase text-[#1d3b2e] mt-1">
                    {detail.game === 'makan_kerupuk'
                      ? detail.timMenang
                      : detail.timMenang === 'merah'
                      ? '🔴 Merah'
                      : detail.timMenang === 'putih'
                      ? '⚪ Putih'
                      : '🤝 Seri'}
                  </div>
                </div>

                <div className="p-3 bg-[#f4ecd9] border border-[#e0d5b8] rounded-xl">
                  <div className="text-xs font-bold text-[#6b7d6c]">Akurasi Soal</div>
                  <div className="portal-cv text-3xl text-[#1d3b2e]">
                    {Math.round(
                      (detail.totalBenar /
                        Math.max(1, detail.totalBenar + detail.totalSalah)) *
                        100
                    )}%
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Evaluasi Materi Guru: Soal Paling Sering Salah */}
          {detail.soalPalingSeringSalah && (
            <div className="p-4 rounded-2xl bg-[#f8e7b0] border-2 border-[#f2c230] text-[#1d3b2e]">
              <div className="flex items-center gap-2 font-bold mb-1 text-sm text-[#8a6a00]">
                <AlertTriangle className="w-4 h-4 text-[#8a6a00] shrink-0" />
                <span>Materi yang Perlu Evaluasi (Paling Banyak Dijawab Keliru)</span>
              </div>
              <p className="portal-cv text-xl text-[#1d3b2e] mt-2">
                Soal #{detail.soalPalingSeringSalah.urutan}:{' '}
                {detail.soalPalingSeringSalah.teks}
              </p>
              <div className="text-xs mt-2 flex gap-4 font-bold">
                <span className="text-[#c8362f]">
                  Dijawab Salah: {detail.soalPalingSeringSalah.jumlahSalah}x
                </span>
                <span className="text-[#1f4a37]">
                  Dijawab Benar: {detail.soalPalingSeringSalah.jumlahBenar}x
                </span>
              </div>
              {detail.soalPalingSeringSalah.penjelasan && (
                <p className="text-xs mt-2 italic text-[#6b7d6c]">
                  Penjelasan Kunci: {detail.soalPalingSeringSalah.penjelasan}
                </p>
              )}
            </div>
          )}

          {/* Rincian Jawaban Per Soal */}
          <div className="space-y-3">
            <h4 className="portal-cv text-xl text-[#1d3b2e]">Rincian Hasil Seluruh Soal:</h4>
            <div className="space-y-2">
              {detail.statsPerSoal.map((soal) => (
                <div
                  key={soal.questionId}
                  className="p-3.5 rounded-xl border border-[#e0d5b8] bg-[#fbf6e9] flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-[#1d3b2e]">
                      #{soal.urutan}: {soal.teks}
                    </div>
                    <div className="text-xs text-[#6b7d6c]">
                      Kunci Jawaban: <strong className="text-[#1d3b2e]">Opsi {soal.jawabanBenar}</strong>
                      {soal.penjelasan && ` • ${soal.penjelasan}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="portal-tag green">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {soal.jumlahBenar}
                    </span>
                    <span className="portal-tag red">
                      <XCircle className="w-3.5 h-3.5" /> {soal.jumlahSalah}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button type="button" className="portal-btn ghost sm" onClick={onClose}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
