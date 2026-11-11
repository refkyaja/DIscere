import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../../lib/socket';
import { bindStudentReconnect } from '../../lib/socketReconnect';
import { Button } from '../../components';
import { soundEffects } from '../../lib/soundEffects';
import LintasanBalapKarung, { EfekAktifBalapVisual } from './LintasanBalapKarung';
import KarakterBalapKarung, { EkspresiBalapKarung } from './KarakterBalapKarung';
import {
  Users,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  LogOut,
  Flame,
  Shield,
  Zap,
  CloudRain,
  Scale,
  AlertTriangle,
  ArrowRight,
  Flag,
} from 'lucide-react';

interface PilihanBalap {
  choiceId: string;
  key: 'A' | 'B' | 'C' | 'D' | 'E';
  teks: string;
}

interface SoalBalapData {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  totalSoalTemplate: number;
  teks: string;
  pilihan: PilihanBalap[];
  ditampilkanPadaMs: number;
}

interface RintanganLogBalap {
  id: string;
  tipe: string;
  judul: string;
  deskripsi: string;
  efekNilai: number;
  satuan: string;
}

export interface PesertaBalapData {
  id: string;
  nama: string;
  connected?: boolean;
  jarak: number;
  targetJarak: number;
  keseimbangan: number;
  jumlahJatuh: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen?: number;
  streakSaatIni: number;
  streakTertinggi: number;
  totalBonusStreakKali?: number;
  totalBonusStreakMeter?: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs?: number | null;
  rataRataWaktuJawabMs?: number;
  jumlahJawab?: number;
  efekAktif?: EfekAktifBalapVisual;
  riwayatRintangan?: RintanganLogBalap[];
}

interface FeedbackBalap {
  tampil: boolean;
  benar: boolean;
  kunciKey?: string;
  penjelasan?: string | null;
  perubahanJarak?: number;
  perubahanKeseimbangan?: number;
  bonusStreakJarakDidapat?: number;
  bonusStreakKeseimbanganDidapat?: number;
  bonusLompatanKuatDidapat?: number;
  penaltiJalanBerlumpurDipakai?: number;
  terjatuh?: boolean;
  penaltiJatuhJarak?: number;
  perisaiDigunakan?: boolean;
  rintanganBaru?: RintanganLogBalap | null;
}

interface MainBalapKarungProps {
  token: string;
  nama: string;
  sessionId: string;
  pesertaId: string;
  pesertaSecret: string;
  templateJudul: string;
  config?: {
    targetJarak?: number;
    kesulitan?: string;
    lompatBenar?: number;
    turunSalah?: number;
    keseimbanganAktif?: boolean;
    bonusStreakAktif?: boolean;
    rintanganAktif?: boolean;
  };
  initialStatus?: string;
  initialPesertaState?: PesertaBalapData;
  initialLeaderboard?: PesertaBalapData[];
  initialSoalAktif?: SoalBalapData | null;
  onKeluar: () => void;
}

export default function MainBalapKarung({
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
}: MainBalapKarungProps) {
  const targetJarak = config?.targetJarak ?? initialPesertaState?.targetJarak ?? 100;
  const keseimbanganAktif = config?.keseimbanganAktif !== false;

  const [stage, setStage] = useState<'LOBBY' | 'PLAYING' | 'SELESAI'>(
    initialStatus === 'jalan' ? 'PLAYING' : initialStatus === 'selesai' ? 'SELESAI' : 'LOBBY'
  );

  const [myState, setMyState] = useState<PesertaBalapData>(
    initialPesertaState || {
      id: pesertaId,
      nama,
      jarak: 0,
      targetJarak,
      keseimbangan: 100,
      jumlahJatuh: 0,
      totalBenar: 0,
      totalSalah: 0,
      streakSaatIni: 0,
      streakTertinggi: 0,
      totalBonusStreakKali: 0,
      totalBonusStreakMeter: 0,
      status: 'bermain',
      rataRataWaktuJawabMs: 0,
      jumlahJawab: 0,
      efekAktif: {
        perisai: false,
        lompatanKuat: false,
        jalanBerlumpur: false,
      },
    }
  );

  const [leaderboard, setLeaderboard] = useState<PesertaBalapData[]>(initialLeaderboard);
  const [totalPeserta, setTotalPeserta] = useState<number>(initialLeaderboard.length || 1);

  const [soalAktif, setSoalAktif] = useState<SoalBalapData | null>(initialSoalAktif);
  const [choiceDipilih, setChoiceDipilih] = useState<string | null>(null);
  const [sudahKirim, setSudahKirim] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackBalap | null>(null);
  const [lastDeltaJarak, setLastDeltaJarak] = useState<number | null>(null);
  const [justFell, setJustFell] = useState(false);
  const [fallNotice, setFallNotice] = useState<string | null>(null);
  const [hasilAkhir, setHasilAkhir] = useState<any>(null);

  const [detikElapsed, setDetikElapsed] = useState<number>(0);
  const stopwatchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopStopwatch = useCallback(() => {
    if (stopwatchRef.current) {
      clearInterval(stopwatchRef.current);
      stopwatchRef.current = null;
    }
  }, []);

  const startStopwatch = useCallback(() => {
    stopStopwatch();
    const startMs = Date.now();
    setDetikElapsed(0);
    stopwatchRef.current = setInterval(() => {
      setDetikElapsed(Number(((Date.now() - startMs) / 1000).toFixed(1)));
    }, 100);
  }, [stopStopwatch]);

  useEffect(() => {
    if (initialStatus === 'jalan' && initialSoalAktif) {
      startStopwatch();
    }
    return () => {
      stopStopwatch();
      if (fallTimerRef.current) clearTimeout(fallTimerRef.current);
    };
  }, [initialStatus, initialSoalAktif, startStopwatch, stopStopwatch]);

  useEffect(() => {
    const socket = getSocket();

    const handleLobiUpdate = (data: {
      totalPeserta: number;
      leaderboard?: PesertaBalapData[];
      daftarPeserta?: PesertaBalapData[];
    }) => {
      setTotalPeserta(data.totalPeserta);
      const list = data.leaderboard || data.daftarPeserta;
      if (list) setLeaderboard(list);
    };

    const handleGameMulai = (data: { leaderboard?: PesertaBalapData[] }) => {
      setStage('PLAYING');
      if (data?.leaderboard) {
        setLeaderboard(data.leaderboard);
        const me = data.leaderboard.find((p) => p.id === pesertaId);
        if (me) setMyState(me);
      }
      soundEffects.playWhistle();
    };

    const handleSoalTampil = (data: SoalBalapData & { game?: string }) => {
      if (data.game && data.game !== 'balap_karung') return;
      setStage('PLAYING');
      setSoalAktif(data);
      setChoiceDipilih(null);
      setSudahKirim(false);
      setFeedback(null);
      setLastDeltaJarak(null);
      setJustFell(false);
      setFallNotice(null);
      startStopwatch();
    };

    const handleBalapUpdate = (data: {
      leaderboard: PesertaBalapData[];
      totalPeserta?: number;
    }) => {
      if (data?.leaderboard) {
        setLeaderboard(data.leaderboard);
        if (data.totalPeserta) setTotalPeserta(data.totalPeserta);
        const me = data.leaderboard.find((p) => p.id === pesertaId);
        if (me) setMyState((prev) => ({ ...prev, ...me }));
      }
    };

    const handlePemainJatuh = (data: {
      game?: string;
      pesan?: string;
      perisaiDigunakan?: boolean;
    }) => {
      if (data?.game && data.game !== 'balap_karung') return;
      if (!data.perisaiDigunakan) {
        setJustFell(true);
        if (fallTimerRef.current) clearTimeout(fallTimerRef.current);
        fallTimerRef.current = setTimeout(() => setJustFell(false), 1800);
      }
      if (data.pesan) {
        setFallNotice(data.pesan);
      }
    };

    const handleJawabHasil = (res: any) => {
      if (!res?.success || res.game !== 'balap_karung') return;
      stopStopwatch();

      if (res.pesertaUpdated) {
        setMyState(res.pesertaUpdated);
      }
      setLastDeltaJarak(typeof res.perubahanJarak === 'number' ? res.perubahanJarak : 0);

      if (res.terjatuh) {
        if (res.perisaiDigunakan) {
          soundEffects.playShield();
        } else {
          soundEffects.playFall();
          setJustFell(true);
          if (fallTimerRef.current) clearTimeout(fallTimerRef.current);
          fallTimerRef.current = setTimeout(() => setJustFell(false), 1800);
        }
      } else if (res.rintanganBaru?.tipe === 'perisai' || res.rintanganBaru?.tipe === 'lompatan_kuat') {
        soundEffects.playShield();
      } else if (res.rintanganBaru?.tipe === 'jalan_berlumpur' || res.rintanganBaru?.tipe === 'kulit_pisang') {
        soundEffects.playMud();
      } else if (res.benar) {
        soundEffects.playJump();
      } else {
        soundEffects.playIncorrect();
      }

      setFeedback({
        tampil: true,
        benar: Boolean(res.benar),
        kunciKey: res.kunciKey,
        penjelasan: res.penjelasan,
        perubahanJarak: res.perubahanJarak,
        perubahanKeseimbangan: res.perubahanKeseimbangan,
        bonusStreakJarakDidapat: res.bonusStreakJarakDidapat,
        bonusStreakKeseimbanganDidapat: res.bonusStreakKeseimbanganDidapat,
        bonusLompatanKuatDidapat: res.bonusLompatanKuatDidapat,
        penaltiJalanBerlumpurDipakai: res.penaltiJalanBerlumpurDipakai,
        terjatuh: res.terjatuh,
        penaltiJatuhJarak: res.penaltiJatuhJarak,
        perisaiDigunakan: res.perisaiDigunakan,
        rintanganBaru: res.rintanganBaru,
      });
    };

    const handlePemainSelesai = (data: { peserta?: PesertaBalapData }) => {
      stopStopwatch();
      soundEffects.playVictoryFanfare();
      if (data?.peserta) {
        setMyState(data.peserta);
      } else {
        setMyState((prev) => ({ ...prev, status: 'selesai', jarak: targetJarak }));
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
    socket.on('balap:update', handleBalapUpdate);
    socket.on('pemain:jatuh', handlePemainJatuh);
    socket.on('jawab:hasil', handleJawabHasil);
    socket.on('pemain:selesai', handlePemainSelesai);
    socket.on('sesi:selesai', handleSesiSelesai);

    return () => {
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('soal:tampil', handleSoalTampil);
      socket.off('balap:update', handleBalapUpdate);
      socket.off('pemain:jatuh', handlePemainJatuh);
      socket.off('jawab:hasil', handleJawabHasil);
      socket.off('pemain:selesai', handlePemainSelesai);
      socket.off('sesi:selesai', handleSesiSelesai);
    };
  }, [pesertaId, targetJarak, startStopwatch, stopStopwatch]);

  useEffect(() => {
    const socket = getSocket();
    return bindStudentReconnect(socket, {
      token,
      nama,
      pesertaId,
      pesertaSecret,
      onReconnectSuccess: (res: any) => {
        if (!res?.success) return;
        if (res.peserta) setMyState(res.peserta);
        if (res.leaderboard) {
          setLeaderboard(res.leaderboard);
          setTotalPeserta(res.leaderboard.length);
        }
        if (res.status === 'jalan') {
          setStage('PLAYING');
          if (res.soalAktif) {
            setSoalAktif((prev) =>
              prev && prev.presentationId === res.soalAktif.presentationId ? prev : res.soalAktif
            );
          }
        } else if (res.status === 'selesai') {
          stopStopwatch();
          if (res.hasil) setHasilAkhir(res.hasil);
          setStage('SELESAI');
        }
      },
    });
  }, [token, nama, pesertaId, pesertaSecret, stopStopwatch]);

  const handlePilihJawaban = (opsi: PilihanBalap) => {
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
          console.error('Jawaban Balap Karung ditolak:', res.pesan);
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
              Balap Karung Challenge • PIN {token}
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

        <main className="my-auto text-center space-y-4 max-w-md mx-auto w-full py-4">
          <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl border-2 border-amber-400/40 space-y-4">
            <LintasanBalapKarung
              jarak={0}
              targetJarak={targetJarak}
              keseimbangan={100}
              keseimbanganAktif={keseimbanganAktif}
              namaPemain={nama}
              compact
            />

            <div>
              <span className="inline-block px-3 py-1 bg-amber-400 text-slate-950 font-black text-xs rounded-full uppercase tracking-wider mb-1">
                Siap di Garis Start
              </span>
              <h1 className="text-xl font-black text-white">Halo, {nama}!</h1>
              <p className="text-xs text-slate-300 mt-1">
                Jawab cepat dan akurat untuk melompat ke garis finis{' '}
                <strong className="text-amber-300">{targetJarak} meter</strong>!
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-1.5 text-[11px]">
              <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-bold">
                Target {targetJarak}m
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-950/90 border border-emerald-700 text-emerald-300 font-bold">
                Benar +{config?.lompatBenar ?? 10}m
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-rose-950/90 border border-rose-700 text-rose-300 font-bold">
                Salah -{config?.turunSalah ?? 3}m
              </span>
              {keseimbanganAktif && (
                <span className="px-2 py-0.5 rounded-lg bg-sky-950/90 border border-sky-700 text-sky-300 font-bold">
                  Keseimbangan Aktif
                </span>
              )}
              {config?.rintanganAktif && (
                <span className="px-2 py-0.5 rounded-lg bg-amber-950/90 border border-amber-700 text-amber-300 font-bold">
                  Rintangan Aktif
                </span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200 flex items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold text-slate-800 block">
                {totalPeserta} Pelari Siap di Lintasan
              </span>
              <span className="text-[11px] text-slate-500">
                Menunggu guru memulai perlombaan...
              </span>
            </div>
          </div>
        </main>

        <footer className="text-center text-xs font-semibold text-slate-500 py-1">
          DISCERE • Lomba Balap Karung Edukatif
        </footer>
      </div>
    );
  }

  // =========================================================================
  // 2. TAHAP PERMAINAN BERJALAN
  // =========================================================================
  if (stage === 'PLAYING') {
    // 2a. Pemain sudah mencapai garis finis
    if (myState.status === 'selesai' || myState.jarak >= targetJarak) {
      const totalJawab = myState.totalBenar + myState.totalSalah;
      const akurasi = totalJawab > 0 ? Math.round((myState.totalBenar / totalJawab) * 100) : 0;

      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-4 max-w-md mx-auto w-full select-none">
          <header className="flex items-center justify-between bg-slate-800/90 rounded-2xl p-4 border border-slate-700">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 block tracking-wider">
                Balap Karung • Finis Tercapai
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
                <KarakterBalapKarung
                  nama={myState.nama}
                  pose="podium"
                  ekspresi="bahagia"
                  size="md"
                  streak={myState.streakTertinggi}
                />
              </div>

              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 block mb-1">
                  Garis Finis Dilewati!
                </span>
                <h1 className="text-2xl font-black text-white">Finis {targetJarak} Meter!</h1>
                <p className="text-xs text-slate-300 mt-1">
                  Luar biasa! Kamu berhasil menyelesaikan lintasan Balap Karung.
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
                    Waktu Capai Finis
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
                    Kejadian Jatuh
                  </span>
                  <span className="text-base font-black text-rose-300 font-mono">
                    {myState.jumlahJatuh}x
                  </span>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-center gap-2.5 text-xs text-amber-300 font-semibold">
                <div className="w-2.5 h-2.5 bg-amber-400 rounded-full motion-safe:animate-ping shrink-0" />
                <span>Menunggu peserta lain finis atau guru mengakhiri lomba...</span>
              </div>
            </div>
          </main>

          <footer className="text-center text-xs text-slate-500 pb-2">
            Podium & laporan akhir akan muncul otomatis saat perlombaan selesai.
          </footer>
        </div>
      );
    }

    // 2b. Pemain sedang berlomba
    const ekspresiKarakter: EkspresiBalapKarung = justFell
      ? 'terjatuh'
      : feedback?.tampil
      ? feedback.benar
        ? 'bahagia'
        : 'sedih'
      : 'netral';

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-3 sm:p-5 select-none max-w-2xl mx-auto w-full gap-3">
        {/* Top Bar Status */}
        <header className="flex items-center justify-between gap-2 bg-slate-800/90 rounded-2xl p-3 border border-slate-700 shadow-sm">
          <div>
            <span className="text-[10px] font-black uppercase text-amber-400 block tracking-wider">
              Soal #{soalAktif?.nomorSoal || 1}
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
            <div className="text-sm font-black text-emerald-300 font-mono">
              {myState.jarak}m / {targetJarak}m
            </div>
            {myState.streakSaatIni > 0 ? (
              <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-orange-400">
                <Flame className="w-3 h-3 fill-current" />
                <span>{myState.streakSaatIni} Streak</span>
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 font-semibold flex items-center justify-end gap-1">
                <Scale className="w-3 h-3 text-sky-400" />
                {keseimbanganAktif ? `${myState.keseimbangan}%` : 'Stabil'}
              </span>
            )}
          </div>
        </header>

        {/* Banner Efek / Rintangan Aktif */}
        {(myState.efekAktif?.perisai ||
          myState.efekAktif?.lompatanKuat ||
          myState.efekAktif?.jalanBerlumpur) && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {myState.efekAktif?.perisai && (
              <span className="px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-400/50 text-sky-300 text-[11px] font-bold flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> Perisai Siap (1x Jatuh)
              </span>
            )}
            {myState.efekAktif?.lompatanKuat && (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[11px] font-bold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Lompatan Kuat Siap
              </span>
            )}
            {myState.efekAktif?.jalanBerlumpur && (
              <span className="px-2.5 py-1 rounded-full bg-amber-900/50 border border-amber-600/60 text-amber-200 text-[11px] font-bold flex items-center gap-1">
                <CloudRain className="w-3.5 h-3.5" /> Awas Jalan Berlumpur
              </span>
            )}
          </div>
        )}

        {/* Lintasan Balap Karung Visual */}
        <LintasanBalapKarung
          jarak={myState.jarak}
          targetJarak={targetJarak}
          keseimbangan={myState.keseimbangan}
          keseimbanganAktif={keseimbanganAktif}
          namaPemain={nama}
          efekAktif={myState.efekAktif}
          lastDeltaJarak={lastDeltaJarak}
          ekspresi={ekspresiKarakter}
          terjatuh={justFell}
          streak={myState.streakSaatIni}
          status={myState.status}
        />

        {/* Banner Notifikasi Jatuh */}
        {(fallNotice || feedback?.terjatuh) && (
          <div
            className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 shadow ${
              feedback?.perisaiDigunakan
                ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                : 'bg-rose-950/90 border-rose-500 text-rose-100'
            }`}
          >
            {feedback?.perisaiDigunakan ? (
              <Shield className="w-4 h-4 text-sky-300 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>
              {fallNotice ||
                (feedback?.perisaiDigunakan
                  ? 'Perisai Keseimbangan menahan jatuh! Jarak tetap aman, keseimbangan pulih ke 50%.'
                  : `Keseimbangan habis! Kamu terjatuh (-${feedback?.penaltiJatuhJarak ?? 5}m) & keseimbangan pulih.`)}
            </span>
          </div>
        )}

        {/* Feedback Hasil Jawaban */}
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
                  {feedback.benar
                    ? `Melompat +${feedback.perubahanJarak ?? 0} m!`
                    : `Kurang Tepat (Kunci: ${feedback.kunciKey}) ${
                        feedback.perubahanJarak ? `${feedback.perubahanJarak} m` : ''
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

            {feedback.bonusStreakJarakDidapat && feedback.bonusStreakJarakDidapat > 0 ? (
              <p className="text-[11px] text-orange-300 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-current" /> Bonus Streak (+
                {feedback.bonusStreakJarakDidapat}m
                {feedback.bonusStreakKeseimbanganDidapat
                  ? `, +${feedback.bonusStreakKeseimbanganDidapat}% Keseimbangan`
                  : ''}
                )!
              </p>
            ) : null}

            {feedback.bonusLompatanKuatDidapat && feedback.bonusLompatanKuatDidapat > 0 ? (
              <p className="text-[11px] text-amber-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Lompatan Kuat (+{feedback.bonusLompatanKuatDidapat}m)!
              </p>
            ) : null}

            {feedback.penaltiJalanBerlumpurDipakai && feedback.penaltiJalanBerlumpurDipakai > 0 ? (
              <p className="text-[11px] text-amber-200 flex items-center gap-1">
                <CloudRain className="w-3.5 h-3.5" /> Terhambat Jalan Berlumpur (-
                {feedback.penaltiJalanBerlumpurDipakai}m).
              </p>
            ) : null}

            {feedback.rintanganBaru && (
              <div className="mt-1 p-2 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-200 flex items-start gap-2">
                <Flag className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
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

        {/* Kotak Soal & Pilihan Jawaban (Touch-friendly smartphone) */}
        <div className="space-y-3 my-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-sm">
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
                  className={`p-3.5 rounded-2xl border-2 flex items-center gap-3 transition-all active:scale-[0.98] motion-reduce:transform-none text-left min-h-[52px] ${btnClass} ${
                    sudahKirim ? 'cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      isDipilih ? 'bg-slate-900 text-amber-400' : 'bg-slate-700 text-slate-200'
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
    );
  }

  // =========================================================================
  // 3. TAHAP SELESAI & PODIUM JUARA
  // =========================================================================
  const finalLeaderboard: PesertaBalapData[] = hasilAkhir?.leaderboard || leaderboard;
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
          Balap Karung Selesai
        </span>
        <h1 className="text-2xl font-black text-white">Podium Juara</h1>
        {myFinalIndex === 0 && (
          <p className="text-xs font-black text-amber-400">
            Selamat! Kamu Berhasil Meraih Juara 1 Balap Karung!
          </p>
        )}
      </div>

      {/* Podium 1, 2, 3 dengan Karakter 2D Juara */}
      <div className="flex items-end justify-center gap-2 pt-4 pb-4">
        {juara2 && (
          <div className="flex flex-col items-center w-24 text-center">
            <KarakterBalapKarung
              nama={juara2.nama}
              pose="podium"
              ekspresi="bahagia"
              podiumRank={2}
              size="sm"
              className="mb-1"
            />
            <span className="text-xs font-bold text-slate-200 truncate w-full">{juara2.nama}</span>
            <span className="text-[10px] font-mono text-slate-400 mb-1">
              {juara2.jarak}m / {juara2.targetJarak || targetJarak}m
            </span>
            <div className="w-full bg-slate-700 h-20 rounded-t-xl flex flex-col items-center justify-center font-black text-slate-300 border-t-2 border-slate-400">
              <span className="text-lg leading-none">2</span>
              <span className="text-[9px] font-bold uppercase text-sky-300">Perak</span>
            </div>
          </div>
        )}

        {juara1 && (
          <div className="flex flex-col items-center w-28 text-center -mt-4">
            <KarakterBalapKarung
              nama={juara1.nama}
              pose="podium"
              ekspresi="bahagia"
              podiumRank={1}
              size="md"
              className="mb-1"
            />
            <span className="text-xs font-black text-amber-300 truncate w-full">{juara1.nama}</span>
            <span className="text-[11px] font-mono font-bold text-amber-400 mb-1">
              {juara1.jarak}m / {juara1.targetJarak || targetJarak}m
            </span>
            <div className="w-full bg-amber-500 h-28 rounded-t-xl flex flex-col items-center justify-center font-black text-slate-950 text-2xl border-t-2 border-amber-300">
              <span>1</span>
              <span className="text-[9px] font-bold uppercase tracking-wider">Mahkota Juara</span>
            </div>
          </div>
        )}

        {juara3 && (
          <div className="flex flex-col items-center w-24 text-center">
            <KarakterBalapKarung
              nama={juara3.nama}
              pose="podium"
              ekspresi="bahagia"
              podiumRank={3}
              size="sm"
              className="mb-1"
            />
            <span className="text-xs font-bold text-slate-200 truncate w-full">{juara3.nama}</span>
            <span className="text-[10px] font-mono text-slate-400 mb-1">
              {juara3.jarak}m / {juara3.targetJarak || targetJarak}m
            </span>
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
              {myFinalIndex >= 0 ? `#${myFinalIndex + 1}` : '-'} dari {finalLeaderboard.length} Pelari
            </h3>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400">Jarak Akhir</span>
            <div className="text-lg font-black text-amber-400 font-mono">
              {myFinalData.jarak} m / {targetJarak} m
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-700/50 p-2.5 rounded-xl">
            <span className="text-slate-400 text-[10px] block">Akurasi & Benar/Salah</span>
            <span className="font-bold text-emerald-400">
              {myFinalData.totalBenar}✓ / {myFinalData.totalSalah}✗ ({akurasiFinal}%)
            </span>
          </div>
          <div className="bg-slate-700/50 p-2.5 rounded-xl">
            <span className="text-slate-400 text-[10px] block">Keseimbangan & Jatuh</span>
            <span className="font-bold text-sky-300">
              {myFinalData.keseimbangan}% • {myFinalData.jumlahJatuh}x Jatuh
            </span>
          </div>
          <div className="bg-slate-700/50 p-2.5 rounded-xl">
            <span className="text-slate-400 text-[10px] block">Streak & Bonus</span>
            <span className="font-bold text-orange-400">
              Maks {myFinalData.streakTertinggi}x ({myFinalData.totalBonusStreakKali || 0}x bonus)
            </span>
          </div>
          <div className="bg-slate-700/50 p-2.5 rounded-xl">
            <span className="text-slate-400 text-[10px] block">Waktu Finis / Rata2</span>
            <span className="font-bold text-amber-300">
              {myFinalData.waktuSelesaiMs
                ? `${(myFinalData.waktuSelesaiMs / 1000).toFixed(1)}s`
                : myFinalData.rataRataWaktuJawabMs
                ? `${(myFinalData.rataRataWaktuJawabMs / 1000).toFixed(1)}s/soal`
                : '-'}
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

