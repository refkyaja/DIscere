import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../../lib/socket';
import { Button } from '../../components';
import { soundEffects } from '../../lib/soundEffects';
import TiangPinangVisual, { EfekAktifVisual } from './TiangPinangVisual';
import KarakterPanjatPinang from './KarakterPanjatPinang';
import {
  Users,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  LogOut,
  Flame,
  Shield,
  Droplets,
  HandMetal,
  Gift,
  ArrowRight,
} from 'lucide-react';

interface PilihanPanjat {
  choiceId: string;
  key: 'A' | 'B' | 'C' | 'D' | 'E';
  teks: string;
}

interface SoalPanjatData {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  totalSoalTemplate: number;
  teks: string;
  pilihan: PilihanPanjat[];
  isBonusKulitPisang: boolean;
  ditampilkanPadaMs: number;
}

interface RintanganLogItem {
  id: string;
  tipe: string;
  judul: string;
  deskripsi: string;
  efekNilai: number;
  satuan: string;
  timestampMs: number;
}

interface PesertaPanjatData {
  id: string;
  nama: string;
  connected?: boolean;
  posisi: number;
  poinBonus: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen?: number;
  streakSaatIni: number;
  streakTertinggi: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs?: number | null;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  peringkat?: number;
  efekAktif: EfekAktifVisual;
  riwayatRintangan?: RintanganLogItem[];
}

interface MainPanjatPinangProps {
  token: string;
  nama: string;
  sessionId: string;
  pesertaId: string;
  pesertaSecret: string;
  templateJudul: string;
  config?: {
    kesulitan?: string;
    naikBenar?: number;
    turunSalah?: number;
    bonusStreakAktif?: boolean;
    rintanganAktif?: boolean;
  };
  initialStatus?: string;
  initialPesertaState?: PesertaPanjatData;
  initialLeaderboard?: PesertaPanjatData[];
  initialSoalAktif?: SoalPanjatData | null;
  onKeluar: () => void;
}

export default function MainPanjatPinang({
  token,
  nama,
  sessionId,
  pesertaId,
  pesertaSecret,
  templateJudul,
  config,
  initialStatus = 'lobi',
  initialPesertaState,
  initialLeaderboard = [],
  initialSoalAktif = null,
  onKeluar,
}: MainPanjatPinangProps) {
  const [stage, setStage] = useState<'LOBBY' | 'PLAYING' | 'SELESAI'>(
    initialStatus === 'jalan' ? 'PLAYING' : initialStatus === 'selesai' ? 'SELESAI' : 'LOBBY'
  );

  const [myState, setMyState] = useState<PesertaPanjatData>(
    initialPesertaState || {
      id: pesertaId,
      nama,
      posisi: 0,
      poinBonus: 0,
      totalBenar: 0,
      totalSalah: 0,
      streakSaatIni: 0,
      streakTertinggi: 0,
      status: 'bermain',
      rataRataWaktuJawabMs: 0,
      jumlahJawab: 0,
      efekAktif: {},
      riwayatRintangan: [],
    }
  );

  const [leaderboard, setLeaderboard] = useState<PesertaPanjatData[]>(initialLeaderboard);
  const [totalPeserta, setTotalPeserta] = useState<number>(initialLeaderboard.length || 1);

  const [soalAktif, setSoalAktif] = useState<SoalPanjatData | null>(initialSoalAktif);
  const [choiceDipilih, setChoiceDipilih] = useState<string | null>(null);
  const [sudahKirim, setSudahKirim] = useState(false);
  const [lastDelta, setLastDelta] = useState<number | null>(null);

  const [feedback, setFeedback] = useState<{
    tampil: boolean;
    benar: boolean;
    kunciKey?: string;
    penjelasan?: string | null;
    isBonusKulitPisang?: boolean;
    perubahanPosisi?: number;
    bonusStreakDidapat?: number;
    bonusPeganganKuatDidapat?: number;
    penaltiTiangLicin?: number;
    perisaiDigunakan?: boolean;
    perisaiDiperoleh?: boolean;
    rintanganBaru?: RintanganLogItem | null;
  } | null>(null);

  const [hasilAkhir, setHasilAkhir] = useState<any>(null);

  // Stopwatch waktu jawab per soal (sekadar tampilan waktu respon, tidak memblokir tombol)
  const [detikElapsed, setDetikElapsed] = useState<number>(0);
  const stopwatchRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startStopwatch = useCallback(() => {
    if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    const start = Date.now();
    setDetikElapsed(0);
    stopwatchRef.current = setInterval(() => {
      setDetikElapsed(Math.round((Date.now() - start) / 100) / 10);
    }, 100);
  }, []);

  const stopStopwatch = useCallback(() => {
    if (stopwatchRef.current) {
      clearInterval(stopwatchRef.current);
      stopwatchRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (initialStatus === 'jalan' && initialSoalAktif) {
      startStopwatch();
    }
    return () => {
      stopStopwatch();
    };
  }, [initialStatus, initialSoalAktif, startStopwatch, stopStopwatch]);

  useEffect(() => {
    const socket = getSocket();

    const handleLobiUpdate = (data: {
      game?: string;
      totalPeserta: number;
      leaderboard?: PesertaPanjatData[];
      daftarPeserta?: PesertaPanjatData[];
    }) => {
      setTotalPeserta(data.totalPeserta);
      const list = data.leaderboard || data.daftarPeserta;
      if (list) setLeaderboard(list);
    };

    const handleGameMulai = (data: { leaderboard?: PesertaPanjatData[] }) => {
      setStage('PLAYING');
      if (data?.leaderboard) {
        setLeaderboard(data.leaderboard);
        const me = data.leaderboard.find((p) => p.id === pesertaId);
        if (me) setMyState(me);
      }
      soundEffects.playWhistle();
    };

    const handleSoalTampil = (data: SoalPanjatData & { game?: string }) => {
      if (data.game && data.game !== 'panjat_pinang') return;
      setStage('PLAYING');
      setSoalAktif(data);
      setChoiceDipilih(null);
      setSudahKirim(false);
      setFeedback(null);
      setLastDelta(null);
      startStopwatch();
    };

    const handlePanjatUpdate = (data: {
      leaderboard: PesertaPanjatData[];
      totalPeserta?: number;
    }) => {
      if (data?.leaderboard) {
        setLeaderboard(data.leaderboard);
        if (data.totalPeserta) setTotalPeserta(data.totalPeserta);
        const me = data.leaderboard.find((p) => p.id === pesertaId);
        if (me) setMyState((prev) => ({ ...prev, ...me }));
      }
    };

    const handleJawabHasil = (res: any) => {
      if (!res?.success || res.game !== 'panjat_pinang') return;
      stopStopwatch();

      if (res.pesertaUpdated) {
        setMyState(res.pesertaUpdated);
      }
      setLastDelta(typeof res.perubahanPosisi === 'number' ? res.perubahanPosisi : 0);

      if (res.rintanganBaru || res.perisaiDiperoleh || res.perisaiDigunakan) {
        soundEffects.playBoost();
      } else if (res.benar) {
        soundEffects.playClimb();
      } else {
        soundEffects.playSlip();
      }

      setFeedback({
        tampil: true,
        benar: Boolean(res.benar),
        kunciKey: res.kunciKey,
        penjelasan: res.penjelasan,
        isBonusKulitPisang: res.isBonusKulitPisang,
        perubahanPosisi: res.perubahanPosisi,
        bonusStreakDidapat: res.bonusStreakDidapat,
        bonusPeganganKuatDidapat: res.bonusPeganganKuatDidapat,
        penaltiTiangLicin: res.penaltiTiangLicin,
        perisaiDigunakan: res.perisaiDigunakan,
        perisaiDiperoleh: res.perisaiDiperoleh,
        rintanganBaru: res.rintanganBaru,
      });
    };

    const handlePemainSelesai = (data: { peserta?: PesertaPanjatData }) => {
      stopStopwatch();
      soundEffects.playVictoryFanfare();
      if (data?.peserta) {
        setMyState(data.peserta);
      } else {
        setMyState((prev) => ({ ...prev, status: 'selesai', posisi: 100 }));
      }
    };

    const handleSesiSelesai = (data: { hasil: any }) => {
      stopStopwatch();
      setHasilAkhir(data.hasil);
      setStage('SELESAI');
      soundEffects.playVictoryFanfare();
      sessionStorage.removeItem('discere_multi_token');
      sessionStorage.removeItem('discere_multi_peserta_id');
      sessionStorage.removeItem('discere_multi_peserta_secret');
      sessionStorage.removeItem('discere_multi_nama');
    };

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('game:mulai', handleGameMulai);
    socket.on('soal:tampil', handleSoalTampil);
    socket.on('panjat:update', handlePanjatUpdate);
    socket.on('jawab:hasil', handleJawabHasil);
    socket.on('pemain:selesai', handlePemainSelesai);
    socket.on('sesi:selesai', handleSesiSelesai);

    return () => {
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('soal:tampil', handleSoalTampil);
      socket.off('panjat:update', handlePanjatUpdate);
      socket.off('jawab:hasil', handleJawabHasil);
      socket.off('pemain:selesai', handlePemainSelesai);
      socket.off('sesi:selesai', handleSesiSelesai);
    };
  }, [pesertaId, startStopwatch, stopStopwatch]);

  const handlePilihJawaban = (opsi: PilihanPanjat) => {
    if (sudahKirim || !soalAktif || myState.status === 'selesai') return;

    setChoiceDipilih(opsi.choiceId);
    setSudahKirim(true);
    stopStopwatch();

    const socket = getSocket();
    socket.emit(
      'jawab:kirim',
      {
        sessionId,
        pesertaId,
        pesertaSecret,
        presentationId: soalAktif.presentationId,
        questionId: soalAktif.questionId,
        choiceId: opsi.choiceId,
        jawaban: opsi.key,
      },
      (res: any) => {
        if (!res?.success && res?.pesan) {
          console.error('Jawaban ditolak:', res.pesan);
        }
      }
    );
  };

  const handleLanjutCepat = () => {
    const socket = getSocket();
    socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
  };

  const myRank = leaderboard.findIndex((p) => p.id === pesertaId) + 1;

  // =========================================================================
  // 1. TAHAP LOBI SISWA
  // =========================================================================
  if (stage === 'LOBBY') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 p-4 flex flex-col justify-between select-none">
        <header className="flex items-center justify-between bg-white/90 backdrop-blur rounded-2xl p-4 shadow-sm border border-amber-200 max-w-md mx-auto w-full">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#D7262E] block">
              Panjat Pinang • PIN {token}
            </span>
            <h2 className="text-sm font-bold text-slate-800 line-clamp-1">{templateJudul}</h2>
          </div>
          <button
            type="button"
            onClick={onKeluar}
            aria-label="Keluar dari sesi"
            className="p-2 text-slate-400 hover:text-red-500 rounded-xl cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <main className="my-auto text-center space-y-5 max-w-md mx-auto w-full py-4">
          <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl border-2 border-amber-400/40 flex flex-col items-center gap-3">
            <TiangPinangVisual posisi={0} namaPemain={nama} compact />
            <div>
              <span className="inline-block px-3 py-1 bg-amber-400/20 text-amber-300 text-xs font-black rounded-full uppercase tracking-wider mb-1">
                Siap Memanjat!
              </span>
              <h1 className="text-2xl font-black text-white">{nama}</h1>
              <p className="text-xs text-slate-300 mt-1">
                Jawab soal dengan tepat untuk memanjat tiang pinang hingga puncak 100%.
              </p>
            </div>

            {config && (
              <div className="w-full grid grid-cols-2 gap-2 text-[11px] bg-slate-800/80 p-3 rounded-2xl border border-slate-700 text-left">
                <div>
                  <span className="text-slate-400 block">Kesulitan</span>
                  <strong className="text-amber-300 uppercase">
                    {config.kesulitan || 'normal'} (+{config.naikBenar ?? 10}% / -{config.turunSalah ?? 5}%)
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Fitur Aktif</span>
                  <strong className="text-emerald-300">
                    {config.bonusStreakAktif ? 'Streak ' : ''}
                    {config.rintanganAktif ? '• Rintangan' : '• Tanpa Rintangan'}
                  </strong>
                </div>
              </div>
            )}
          </div>

          <div className="bg-amber-500/15 border border-amber-300 rounded-2xl p-4 flex items-center justify-center gap-3">
            <div className="w-3 h-3 bg-[#D7262E] rounded-full animate-ping motion-reduce:animate-none" />
            <span className="text-xs font-bold text-slate-800">
              Menunggu guru memulai lomba Panjat Pinang...
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700">
            <Users className="w-4 h-4 text-[#D7262E]" />
            <span>{totalPeserta} siswa siap di lobi</span>
          </div>
        </main>

        <footer className="text-center text-xs font-semibold text-slate-500 py-1">
          DISCERE • Lomba Panjat Pinang Edukatif
        </footer>
      </div>
    );
  }

  // =========================================================================
  // 2. TAHAP PERMAINAN BERJALAN
  // =========================================================================
  if (stage === 'PLAYING') {
    // 2a. Pemain sudah mencapai puncak 100%
    if (myState.status === 'selesai' || myState.posisi >= 100) {
      const totalJawab = myState.totalBenar + myState.totalSalah;
      const akurasi = totalJawab > 0 ? Math.round((myState.totalBenar / totalJawab) * 100) : 0;

      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-4 max-w-md mx-auto w-full select-none">
          <header className="flex items-center justify-between bg-slate-800/90 rounded-2xl p-4 border border-slate-700">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 block tracking-wider">
                Panjat Pinang • Puncak Tercapai
              </span>
              <h2 className="text-sm font-bold text-slate-100 line-clamp-1">{templateJudul}</h2>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/20 text-amber-300 rounded-xl text-xs font-black">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Rank #{myRank || 1}</span>
            </div>
          </header>

          <main className="my-auto text-center space-y-4 py-4">
            <div className="bg-slate-800/95 border-2 border-amber-400/60 rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex justify-center">
                <TiangPinangVisual
                  posisi={100}
                  namaPemain={myState.nama}
                  status="selesai"
                  compact
                />
              </div>

              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 block mb-1">
                  Lomba Selesai Untukmu
                </span>
                <h1 className="text-2xl font-black text-white">Puncak 100% Tercapai! 🏆</h1>
                <p className="text-xs text-slate-300 mt-1">
                  Hebat! Kamu berhasil menaklukkan tiang pinang.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-left">
                <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Jawaban Benar / Salah
                  </span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    {myState.totalBenar}✓ / {myState.totalSalah}✗ ({akurasi}%)
                  </span>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Waktu Capai Puncak
                  </span>
                  <span className="text-base font-black text-amber-400 font-mono">
                    {myState.waktuSelesaiMs ? `${(myState.waktuSelesaiMs / 1000).toFixed(1)}s` : '-'}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Streak Tertinggi
                  </span>
                  <span className="text-base font-black text-orange-400 font-mono">
                    {myState.streakTertinggi}x berturut
                  </span>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Rata-rata Kecepatan
                  </span>
                  <span className="text-base font-black text-sky-400 font-mono">
                    {myState.rataRataWaktuJawabMs
                      ? `${(myState.rataRataWaktuJawabMs / 1000).toFixed(1)}s`
                      : '-'}
                  </span>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-center gap-2.5 text-xs text-amber-300 font-semibold">
                <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping motion-reduce:animate-none shrink-0" />
                <span>Menunggu teman lain selesai atau guru mengakhiri permainan...</span>
              </div>
            </div>
          </main>

          <footer className="text-center text-xs text-slate-500 pb-2">
            Laporan akhir & podium akan tampil otomatis saat sesi ditutup.
          </footer>
        </div>
      );
    }

    // 2b. Pemain sedang memanjat
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-3 sm:p-5 select-none max-w-2xl mx-auto w-full">
        {/* Top Bar Status */}
        <header className="flex items-center justify-between gap-2 bg-slate-800/90 rounded-2xl p-3 border border-slate-700 shadow-sm">
          <div>
            <span className="text-[10px] font-black uppercase text-amber-400 block tracking-wider">
              {soalAktif?.isBonusKulitPisang
                ? 'Soal Bonus Kulit Pisang!'
                : `Soal #${soalAktif?.nomorSoal || 1}`}
            </span>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Rank #{myRank || 1}</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-400">{myState.totalBenar}✓</span>
              <span className="text-rose-400">{myState.totalSalah}✗</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-700 text-amber-300 font-mono text-xs sm:text-sm font-black border border-slate-600">
            <Clock className="w-3.5 h-3.5" />
            <span>{detikElapsed.toFixed(1)}s</span>
          </div>

          <div className="text-right">
            <div className="text-sm font-black text-white font-mono">{myState.posisi}%</div>
            {myState.streakSaatIni > 0 ? (
              <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-orange-400">
                <Flame className="w-3 h-3 fill-current" />
                <span>{myState.streakSaatIni} Streak</span>
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 font-semibold">
                {myState.poinBonus > 0 ? `+${myState.poinBonus} pt` : 'Semangat!'}
              </span>
            )}
          </div>
        </header>

        {/* Banner Efek / Rintangan Aktif */}
        {(myState.efekAktif?.tiangLicin ||
          myState.efekAktif?.perisaiKulitPisang ||
          myState.efekAktif?.peganganKuat ||
          soalAktif?.isBonusKulitPisang) && (
          <div className="flex flex-wrap items-center justify-center gap-2 py-2">
            {myState.efekAktif?.tiangLicin && (
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 text-[11px] font-bold flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5" /> Tiang Licin Aktif
              </span>
            )}
            {myState.efekAktif?.perisaiKulitPisang && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> Perisai Aktif (1x)
              </span>
            )}
            {myState.efekAktif?.peganganKuat && (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[11px] font-bold flex items-center gap-1">
                <HandMetal className="w-3.5 h-3.5" /> Pegangan Kuat Siap
              </span>
            )}
            {soalAktif?.isBonusKulitPisang && (
              <span className="px-2.5 py-1 rounded-full bg-yellow-400 text-slate-950 text-[11px] font-black flex items-center gap-1">
                Soal Bonus Perisai!
              </span>
            )}
          </div>
        )}

        {/* Stage Tengah: Visual Tiang Pinang + Feedback */}
        <div className="my-auto grid grid-cols-1 sm:grid-cols-12 gap-4 items-center py-2">
          <div className="sm:col-span-5 flex flex-col items-center">
            <TiangPinangVisual
              posisi={myState.posisi}
              namaPemain={nama}
              efekAktif={myState.efekAktif}
              lastDelta={lastDelta}
              ekspresi={feedback?.tampil ? (feedback.benar ? 'bahagia' : 'sedih') : 'netral'}
              streak={myState.streakSaatIni}
              status={myState.status}
            />
          </div>

          <div className="sm:col-span-7 space-y-3">
            {/* Banner Feedback Hasil Jawaban */}
            {feedback?.tampil && (
              <div
                className={`p-3 rounded-2xl text-xs font-bold shadow-lg space-y-1.5 border ${
                  feedback.benar
                    ? 'bg-emerald-950/90 border-emerald-500 text-emerald-100'
                    : 'bg-rose-950/90 border-rose-500 text-rose-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {feedback.benar ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-black text-white">
                      {feedback.isBonusKulitPisang
                        ? feedback.benar
                          ? 'Perisai Diperoleh!'
                          : 'Soal Bonus Terlewat'
                        : feedback.benar
                        ? `Naik +${feedback.perubahanPosisi ?? 0}%!`
                        : `Salah (Kunci: ${feedback.kunciKey}) ${
                            feedback.perubahanPosisi ? `${feedback.perubahanPosisi}%` : ''
                          }`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLanjutCepat}
                    className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-[11px] font-black text-white flex items-center gap-1 cursor-pointer"
                  >
                    <span>Lanjut</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {feedback.bonusStreakDidapat && feedback.bonusStreakDidapat > 0 ? (
                  <p className="text-[11px] text-orange-300 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 fill-current" /> Bonus Streak (+
                    {feedback.bonusStreakDidapat}%)!
                  </p>
                ) : null}

                {feedback.bonusPeganganKuatDidapat && feedback.bonusPeganganKuatDidapat > 0 ? (
                  <p className="text-[11px] text-amber-300 flex items-center gap-1">
                    <HandMetal className="w-3.5 h-3.5" /> Pegangan Kuat terpakai (+
                    {feedback.bonusPeganganKuatDidapat}%)!
                  </p>
                ) : null}

                {feedback.perisaiDigunakan && (
                  <p className="text-[11px] text-emerald-300 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> Perisai Kulit Pisang menahan penurunan Tiang Licin!
                  </p>
                )}

                {feedback.penaltiTiangLicin && feedback.penaltiTiangLicin > 0 ? (
                  <p className="text-[11px] text-cyan-300 flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5" /> Terpeleset Tiang Licin (-
                    {feedback.penaltiTiangLicin}% tambahan)!
                  </p>
                ) : null}

                {feedback.rintanganBaru && (
                  <div className="mt-1 p-2 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-200 flex items-start gap-2">
                    <Gift className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-black text-amber-300">{feedback.rintanganBaru.judul}</div>
                      <div className="text-[10px] text-slate-200">
                        {feedback.rintanganBaru.deskripsi}
                      </div>
                    </div>
                  </div>
                )}

                {feedback.penjelasan && (
                  <p className="text-[11px] text-slate-300 font-medium pt-0.5">
                    {feedback.penjelasan}
                  </p>
                )}
              </div>
            )}

            {/* Kotak Soal & Pilihan Jawaban */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-sm">
              {soalAktif?.isBonusKulitPisang && (
                <span className="inline-block mb-2 px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-300 text-[10px] font-black uppercase">
                  Pertanyaan Bonus Kulit Pisang — Jawab Benar Untuk Perisai!
                </span>
              )}
              <p className="text-sm sm:text-base font-bold text-white leading-relaxed">
                {soalAktif?.teks || 'Menyiapkan soal...'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {soalAktif?.pilihan.map((opsi) => {
                const isDipilih = choiceDipilih === opsi.choiceId;
                const isKunci = feedback?.kunciKey === opsi.key;

                let btnClass = 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white';
                if (feedback?.tampil) {
                  if (isKunci) {
                    btnClass = 'bg-emerald-600 border-emerald-400 text-white ring-2 ring-emerald-300';
                  } else if (isDipilih && !feedback.benar) {
                    btnClass = 'bg-rose-600 border-rose-400 text-white opacity-80';
                  } else {
                    btnClass = 'bg-slate-800/50 border-slate-700/50 text-slate-400 opacity-50';
                  }
                } else if (isDipilih) {
                  btnClass = 'bg-amber-500 border-amber-300 text-slate-950 font-black';
                }

                return (
                  <button
                    key={opsi.choiceId}
                    type="button"
                    disabled={sudahKirim}
                    onClick={() => handlePilihJawaban(opsi)}
                    className={`p-3.5 rounded-2xl border-2 flex items-center gap-3 transition-all active:scale-[0.98] motion-reduce:transform-none text-left min-h-[48px] ${btnClass} ${
                      sudahKirim ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                        isDipilih
                          ? 'bg-slate-900 text-amber-400'
                          : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {opsi.key}
                    </span>
                    <span className="text-xs sm:text-sm font-bold flex-1 leading-snug">
                      {opsi.teks}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. TAHAP SELESAI & PODIUM JUARA
  // =========================================================================
  const finalLeaderboard: PesertaPanjatData[] = hasilAkhir?.leaderboard || leaderboard;
  const juara1 = hasilAkhir?.podium?.juara1 || finalLeaderboard[0];
  const juara2 = hasilAkhir?.podium?.juara2 || finalLeaderboard[1];
  const juara3 = hasilAkhir?.podium?.juara3 || finalLeaderboard[2];

  const myFinalIndex = finalLeaderboard.findIndex((p) => p.id === pesertaId);
  const myFinalData = finalLeaderboard[myFinalIndex] || myState;
  const totalJawabFinal = myFinalData.totalBenar + myFinalData.totalSalah;
  const akurasiFinal =
    myFinalData.akurasiPersen ??
    (totalJawabFinal > 0 ? Math.round((myFinalData.totalBenar / totalJawabFinal) * 100) : 0);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col justify-between max-w-md mx-auto w-full select-none">
      <div className="text-center pt-2 space-y-1">
        <span className="px-3 py-1 bg-amber-400/20 text-amber-300 text-[10px] font-black rounded-full uppercase tracking-wider">
          Panjat Pinang Selesai
        </span>
        <h1 className="text-2xl font-black text-white">Podium Juara 🏆</h1>
        {myFinalIndex === 0 && (
          <p className="text-xs font-black text-amber-400">
            Selamat! Kamu Berhasil Meraih Juara 1! 🥇
          </p>
        )}
      </div>

      {/* Podium 1, 2, 3 dengan Karakter 2D Juara */}
      <div className="flex items-end justify-center gap-2 pt-4 pb-4">
        {juara2 && (
          <div className="flex flex-col items-center w-24 text-center">
            <KarakterPanjatPinang
              nama={juara2.nama}
              pose="podium"
              ekspresi="bahagia"
              podiumRank={2}
              size="sm"
              className="mb-1"
            />
            <span className="text-xs font-bold text-slate-200 truncate w-full">{juara2.nama}</span>
            <span className="text-[10px] font-mono text-slate-400 mb-1">{juara2.posisi}%</span>
            <div className="w-full bg-slate-700 h-20 rounded-t-xl flex flex-col items-center justify-center font-black text-slate-300 border-t-2 border-slate-400">
              <span className="text-lg leading-none">2</span>
              <span className="text-[9px] font-bold uppercase text-sky-300">Perak</span>
            </div>
          </div>
        )}

        {juara1 && (
          <div className="flex flex-col items-center w-28 text-center -mt-4">
            <KarakterPanjatPinang
              nama={juara1.nama}
              pose="podium"
              ekspresi="bahagia"
              podiumRank={1}
              size="md"
              className="mb-1"
            />
            <span className="text-xs font-black text-amber-300 truncate w-full">{juara1.nama}</span>
            <span className="text-[11px] font-mono font-bold text-amber-400 mb-1">
              {juara1.posisi}%
            </span>
            <div className="w-full bg-amber-500 h-28 rounded-t-xl flex flex-col items-center justify-center font-black text-slate-950 text-2xl border-t-2 border-amber-300">
              <span>1</span>
              <span className="text-[9px] font-bold uppercase tracking-wider">Mahkota Juara</span>
            </div>
          </div>
        )}

        {juara3 && (
          <div className="flex flex-col items-center w-24 text-center">
            <KarakterPanjatPinang
              nama={juara3.nama}
              pose="podium"
              ekspresi="bahagia"
              podiumRank={3}
              size="sm"
              className="mb-1"
            />
            <span className="text-xs font-bold text-slate-200 truncate w-full">{juara3.nama}</span>
            <span className="text-[10px] font-mono text-slate-400 mb-1">{juara3.posisi}%</span>
            <div className="w-full bg-amber-800/80 h-14 rounded-t-xl flex flex-col items-center justify-center font-black text-amber-300 border-t-2 border-amber-600">
              <span className="text-lg leading-none">3</span>
              <span className="text-[9px] font-bold uppercase text-amber-200">Perunggu</span>
            </div>
          </div>
        )}
      </div>

      {/* Rapor Pribadi */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-700">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Peringkat Akhir</span>
            <h3 className="text-base font-black text-white">
              {myFinalIndex >= 0 ? `#${myFinalIndex + 1}` : '-'} dari {finalLeaderboard.length} Siswa
            </h3>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400">Ketinggian Akhir</span>
            <div className="text-lg font-black text-amber-400 font-mono">{myFinalData.posisi}%</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-700/50 p-2.5 rounded-xl">
            <span className="text-slate-400 text-[10px] block">Akurasi Jawaban</span>
            <span className="font-bold text-emerald-400">
              {myFinalData.totalBenar}✓ / {myFinalData.totalSalah}✗ ({akurasiFinal}%)
            </span>
          </div>
          <div className="bg-slate-700/50 p-2.5 rounded-xl">
            <span className="text-slate-400 text-[10px] block">Streak Tertinggi</span>
            <span className="font-bold text-orange-400">
              {myFinalData.streakTertinggi}x berturut
            </span>
          </div>
          <div className="bg-slate-700/50 p-2.5 rounded-xl">
            <span className="text-slate-400 text-[10px] block">Rata-rata Kecepatan</span>
            <span className="font-bold text-sky-400">
              {myFinalData.rataRataWaktuJawabMs
                ? `${(myFinalData.rataRataWaktuJawabMs / 1000).toFixed(1)}s`
                : '-'}
            </span>
          </div>
          <div className="bg-slate-700/50 p-2.5 rounded-xl">
            <span className="text-slate-400 text-[10px] block">Waktu Puncak / Bonus</span>
            <span className="font-bold text-amber-300">
              {myFinalData.waktuSelesaiMs
                ? `${(myFinalData.waktuSelesaiMs / 1000).toFixed(1)}s`
                : `${myFinalData.poinBonus || 0} pt bonus`}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-3">
        <Button
          variant="utama"
          onClick={onKeluar}
          className="w-full py-3 text-sm font-bold bg-[#D7262E] hover:bg-[#b81e25] text-white"
        >
          Selesai & Keluar
        </Button>
      </div>
    </div>
  );
}
