import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { apiRequest } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { bindHostReconnect } from '../../lib/socketReconnect';
import { Modal, resolveGuruReturnUrl } from '../../components';
import { ModalKonfirmasiKeluar } from '../../components/ModalKonfirmasiKeluar';
import {
  KerupukStadium,
  KerupukLaneItem,
  KerupukActionPulse,
  KerupukHeatmapMatrix,
  AnalisisHeatmapKerupukData,
  ContestantCharSvg,
} from '../../components/KerupukStadium';
import '../../components/kerupukFestival.css';
import { soundEffects, useGameSoundLifecycle } from '../../lib/soundEffects';
import { HasilGachaGigitanProps } from '../siswa/KerupukVirtual';
import { Copy, Check, RotateCcw, Shuffle, X, Users, Trophy } from 'lucide-react';
import RuangTungguGuru from '../guru/RuangTungguGuru';

export interface PesertaMultiHost {
  peringkat?: number;
  id: string;
  nama: string;
  connected?: boolean;
  sisaKerupuk: number;
  targetKerupuk: number;
  sisaPersen: number;
  progresPersen: number;
  skorTotal: number;
  skorPembelajaran?: number;
  skorDasarBenar?: number;
  totalBonusStreak?: number;
  bonusKeberuntungan?: number;
  bonusPenyelesaian?: number;
  totalBenar?: number;
  totalSalah?: number;
  streakBenar: number;
  selesaiKerupuk?: boolean;
  terakhirGigitan?: HasilGachaGigitanProps | null;
  rataRataWaktuJawabMs?: number;
  jumlahJawab?: number;
}

export interface SesiKerupukMultiClient {
  sessionId: string;
  game: 'makan_kerupuk';
  mode: 'multi';
  playMode: 'MULTIPLAYER';
  token: string;
  qrDataUrl?: string;
  joinUrl?: string;
  templateId: string;
  templateJudul: string;
  status: 'lobi' | 'jalan' | 'selesai';
  totalSoalBank?: number;
  totalPeserta?: number;
  config: {
    targetKerupuk: number;
    kesulitan: string;
    maxPeserta: number;
    allowLateJoin: boolean;
    jumlahTim?: 3 | 4;
  };
  leaderboard?: PesertaMultiHost[];
  daftarPeserta?: PesertaMultiHost[];
  hasil?: any | null;
}

interface LayarHostKerupukMultiProps {
  initialSession: SesiKerupukMultiClient;
  returnUrl: string;
}

const TEAM_DEFS = [
  { id: 0, key: 'merah', name: 'Tim Merah', color: '#e2312d' },
  { id: 1, key: 'biru', name: 'Tim Biru', color: '#1d8fe0' },
  { id: 2, key: 'hijau', name: 'Tim Hijau', color: '#1f9d55' },
  { id: 3, key: 'kuning', name: 'Tim Kuning', color: '#f5a300' },
];

function formatDetik(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function LayarHostKerupukMulti({
  initialSession,
  returnUrl,
}: LayarHostKerupukMultiProps) {
  const navigate = useNavigate();
  const effectiveReturnUrl = resolveGuruReturnUrl(returnUrl);
  const id = initialSession.sessionId;

  const [status, setStatus] = useState<'lobi' | 'jalan' | 'selesai'>(initialSession.status);
  const [leaderboard, setLeaderboard] = useState<PesertaMultiHost[]>(
    initialSession.leaderboard || initialSession.daftarPeserta || []
  );
  const [totalPeserta, setTotalPeserta] = useState<number>(initialSession.totalPeserta ?? 0);
  const [liveFeed, setLiveFeed] = useState<Array<{ id: string; teks: string; tipe: string }>>([]);
  const [hasilAkhir, setHasilAkhir] = useState<any>(initialSession.hasil || null);

  const [jumlahTim, setJumlahTim] = useState<3 | 4>(
    initialSession.config?.jumlahTim === 4 ? 4 : 3
  );
  const [isChangingTeamCount, setIsChangingTeamCount] = useState(false);

  // Waktu & aksi host
  const [timeRemaining, setTimeRemaining] = useState<number>(180); // 3 menit default
  const [actionPulse, setActionPulse] = useState<KerupukActionPulse | null>(null);
  const [crowdCheer, setCrowdCheer] = useState(false);

  const [modalAkhiriOpen, setModalAkhiriOpen] = useState(false);
  const [modalKeluarOpen, setModalKeluarOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isRematching, setIsRematching] = useState(false);
  const [copied, setCopied] = useState(false);

  const { isMuted, toggleMute } = useGameSoundLifecycle(status === 'jalan', id);
  const modeSelectUrl = `/guru/makan-kerupuk?templateId=${encodeURIComponent(
    initialSession.templateId
  )}&kembali=${encodeURIComponent('/guru?tab=template')}`;

  const timerRef = useRef<number | null>(null);

  // Bagikan siswa ke 3 atau 4 tim secara adil
  const numTeams = jumlahTim;
  const activeTeamDefs = useMemo(() => TEAM_DEFS.slice(0, numTeams), [numTeams]);

  // Kelompokkan siswa ke dalam tim
  const teamGroups = useMemo(() => {
    return activeTeamDefs.map((tDef, tIdx) => {
      const members = leaderboard.filter((_, pIdx) => pIdx % numTeams === tIdx);
      const totalBenar = members.reduce((s, m) => s + (m.totalBenar || 0), 0);
      const totalSalah = members.reduce((s, m) => s + (m.totalSalah || 0), 0);
      const avgEaten =
        members.length > 0
          ? members.reduce((s, m) => s + (m.progresPersen || 0), 0) / members.length
          : 0;
      const isLudes = avgEaten >= 100 || members.some((m) => m.selesaiKerupuk);

      return {
        ...tDef,
        members,
        count: members.length,
        totalBenar,
        totalSalah,
        eaten: Math.min(100, Math.round(avgEaten)),
        isLudes,
      };
    });
  }, [activeTeamDefs, leaderboard, numTeams]);

  // Socket listener real-time
  useEffect(() => {
    const socket = getSocket();
    const unbindHost = bindHostReconnect(socket, id);

    const handleLobiUpdate = (data: {
      game?: string;
      totalPeserta: number;
      leaderboard?: PesertaMultiHost[];
      daftarPeserta?: PesertaMultiHost[];
      config?: any;
    }) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      setTotalPeserta(data.totalPeserta);
      const list = data.leaderboard || data.daftarPeserta;
      if (list) setLeaderboard(list);
      if (data.config?.jumlahTim) {
        setJumlahTim(data.config.jumlahTim === 4 ? 4 : 3);
      }
    };

    const handleGameMulai = (data: { game?: string }) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      setIsStarting(true);
    };

    const handleKerupukUpdate = (data: {
      leaderboard: PesertaMultiHost[];
      answeredCount: number;
      terakhirJawab?: {
        nama: string;
        benar: boolean;
        gacha?: HasilGachaGigitanProps | null;
      };
    }) => {
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
        setTotalPeserta(data.leaderboard.length);
      }

      if (data.terakhirJawab) {
        const item = data.terakhirJawab;
        // Cari tim asal siswa yang baru saja menjawab
        const studentIdx = (data.leaderboard || leaderboard).findIndex((p) => p.nama === item.nama);
        const teamIdx = studentIdx >= 0 ? studentIdx % numTeams : 0;

        if (item.benar) {
          setActionPulse({
            id: Date.now(),
            laneIdx: teamIdx,
            type: 'bite',
            lucky: item.gacha?.tipe === 'besar',
            text: item.gacha?.label ? `${item.gacha.label}!` : 'Nyam!',
          });
          soundEffects.playCrunch();
          setCrowdCheer(true);
          setTimeout(() => setCrowdCheer(false), 1200);
        } else {
          setActionPulse({
            id: Date.now(),
            laneIdx: teamIdx,
            type: 'miss',
            text: 'Meleset!',
          });
          soundEffects.playZonk();
        }

        const teks = item.benar
          ? `${item.nama} (${activeTeamDefs[teamIdx]?.name || 'Tim'}) gigit kerupuk! ${
              item.gacha?.label ? `[${item.gacha.label}]` : ''
            }`
          : `${item.nama} (${activeTeamDefs[teamIdx]?.name || 'Tim'}) meleset tertiup angin`;

        setLiveFeed((prev) => [
          { id: `${Date.now()}_${Math.random()}`, teks, tipe: item.benar ? 'benar' : 'salah' },
          ...prev.slice(0, 5),
        ]);
      }
    };

    const handleSesiSelesai = (data: { game?: string; hasil: any }) => {
      if (data.game && data.game !== 'makan_kerupuk') return;
      setHasilAkhir(data.hasil);
      setStatus('selesai');
      if (data.hasil?.dihentikanManual) {
        soundEffects.stopAll();
      } else {
        soundEffects.playNaturalVictory();
        setCrowdCheer(true);
      }
    };

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('game:mulai', handleGameMulai);
    socket.on('kerupuk:update', handleKerupukUpdate);
    socket.on('sesi:selesai', handleSesiSelesai);

    return () => {
      unbindHost();
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('kerupuk:update', handleKerupukUpdate);
      socket.off('sesi:selesai', handleSesiSelesai);
    };
  }, [id, activeTeamDefs, leaderboard, numTeams]);

  // Timer countdown saat status 'jalan'
  useEffect(() => {
    if (status === 'jalan') {
      timerRef.current = window.setInterval(() => {
        setTimeRemaining((t) => {
          if (t <= 1) {
            handleKonfirmasiAkhiri();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const handleMulaiLomba = () => {
    if (totalPeserta === 0 || isStarting) return;
    setIsStarting(true);
    const socket = getSocket();
    socket.emit('sesi:mulai', { sessionId: id }, (res: any) => {
      if (!res?.success) {
        setIsStarting(false);
        alert(res?.pesan || 'Gagal memulai lomba Makan Kerupuk.');
      }
    });
  };

  const handleTransisiSelesai = () => {
    setStatus('jalan');
    soundEffects.startGame('whistle');
    setCrowdCheer(true);
    setTimeout(() => setCrowdCheer(false), 2000);
    setIsStarting(false);
  };

  const handleKonfirmasiAkhiri = () => {
    setIsEnding(true);
    const socket = getSocket();
    socket.emit('sesi:akhiri_manual', { sessionId: id }, (res: any) => {
      setIsEnding(false);
      setModalAkhiriOpen(false);
      if (res?.success) {
        setHasilAkhir(res.hasil);
        setStatus('selesai');
        soundEffects.stopAll();
      } else {
        alert(res?.pesan || 'Gagal mengakhiri sesi.');
      }
    });
  };

  const handleUbahJumlahTim = (nextJumlah: 3 | 4) => {
    if (!id || status !== 'lobi' || isChangingTeamCount) return;
    setIsChangingTeamCount(true);
    const socket = getSocket();
    socket.emit(
      'kerupuk:ubah_jumlah_tim',
      { sessionId: id, jumlahTim: nextJumlah },
      (res: {
        success?: boolean;
        pesan?: string;
        config?: any;
        leaderboard?: PesertaMultiHost[];
      }) => {
        setIsChangingTeamCount(false);
        if (res?.success) {
          setJumlahTim(nextJumlah);
          if (res.leaderboard) {
            setLeaderboard(res.leaderboard);
          }
        } else if (res?.pesan) {
          alert(res.pesan);
        }
      }
    );
  };

  const getGameConfigUrl = () => {
    // 1. Jika returnUrl sudah mengarah ke halaman pengaturan makan-kerupuk, gunakan itu
    if (returnUrl && returnUrl.startsWith('/guru/makan-kerupuk')) {
      return returnUrl;
    }
    // 2. Selalu arahkan balik ke pengaturan game Makan Kerupuk sesuai template kuis
    if (initialSession.templateId) {
      return `/guru/makan-kerupuk?templateId=${encodeURIComponent(
        initialSession.templateId
      )}&kembali=${encodeURIComponent('/guru?tab=template')}`;
    }
    return modeSelectUrl;
  };

  const handleKembaliClick = () => {
    if (status === 'jalan') {
      setModalKeluarOpen(true);
    } else {
      if (id) {
        getSocket().emit('sesi:batalkan', { sessionId: id, game: 'makan_kerupuk' });
      }
      navigate(getGameConfigUrl());
    }
  };

  const handleKonfirmasiKeluar = () => {
    setModalKeluarOpen(false);
    handleKonfirmasiAkhiri();
    navigate(getGameConfigUrl());
  };

  const handleAcakUrutan = () => {
    if (!id || totalPeserta === 0) return;
    const socket = getSocket();
    socket.emit(
      'sesi:acak_peserta',
      { sessionId: id },
      (res: { success?: boolean; pesan?: string }) => {
        if (res && !res.success) {
          alert(res.pesan || 'Gagal mengacak tim / urutan peserta.');
        }
      }
    );
  };

  const handleKickPeserta = (pesertaId: string) => {
    if (!id) return;
    if (!window.confirm('Keluarkan siswa ini dari lobi lomba?')) return;
    const socket = getSocket();
    socket.emit(
      'sesi:kick_peserta',
      { sessionId: id, pesertaId },
      (res: { success?: boolean; pesan?: string }) => {
        if (res && !res.success) {
          alert(res.pesan || 'Gagal mengeluarkan siswa.');
        }
      }
    );
  };

  const handleMainLagi = async () => {
    try {
      setIsRematching(true);
      soundEffects.stopAll();
      const res = await apiRequest<{ sessionId: string }>(`/sesi/${id}/main-lagi`, {
        method: 'POST',
      });
      const safeBack = getGameConfigUrl();
      navigate(`/guru/sesi/${res.sessionId}?kembali=${encodeURIComponent(safeBack)}`, {
        replace: true,
      });
      window.location.reload();
    } catch (err: any) {
      alert(err.pesan || 'Gagal membuat sesi baru.');
    } finally {
      setIsRematching(false);
    }
  };

  const handleSalinPin = () => {
    if (!initialSession.token) return;
    navigator.clipboard.writeText(initialSession.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Lintasan tim untuk KerupukStadium
  const lanes: KerupukLaneItem[] = teamGroups.map((tg) => ({
    id: tg.id,
    nama: tg.name,
    warna: tg.color,
    eatenFraction: tg.eaten / 100,
    subText: `${tg.eaten}% • ${tg.count} siswa`,
    isWinner: status === 'selesai' && tg.eaten >= 100,
  }));

  // Bangun Heatmap Data jika ada hasil akhir
  const heatmapData: AnalisisHeatmapKerupukData | null = useMemo(() => {
    if (!hasilAkhir) return null;

    // Jika server langsung memberikan format heatmap
    if (hasilAkhir.heatmap) {
      return hasilAkhir.heatmap;
    }

    // Jika server memberikan questions & daftarPesertaLog
    if (hasilAkhir.questions && Array.isArray(hasilAkhir.questions)) {
      const questionsInfo = hasilAkhir.questions.map((q: any, qIdx: number) => {
        let firstCorrectCount = 0;
        let firstSeenCount = 0;
        const pList = hasilAkhir.daftarPesertaLog || leaderboard;

        for (const p of pList) {
          const log = p.riwayatGigitan || [];
          const attempt = log.find((l: any) => l.questionId === q.id);
          if (attempt) {
            firstSeenCount += 1;
            if (attempt.benar) firstCorrectCount += 1;
          }
        }

        return {
          questionId: q.id,
          nomorSoal: q.urutan || qIdx + 1,
          teks: q.teks,
          opsiList: q.opsiList || q.pilihan || [],
          jawabanBenarKode: q.jawabanBenarKode || 'A',
          jawabanBenarTeks: q.jawabanBenarTeks || '',
          penjelasan: q.penjelasan || null,
          firstCorrectCount,
          firstSeenCount,
          persenBenar:
            firstSeenCount > 0 ? Math.round((firstCorrectCount / firstSeenCount) * 100) : null,
        };
      });

      const teamsData = activeTeamDefs.map((tDef, tIdx) => {
        const pList = (hasilAkhir.daftarPesertaLog || leaderboard).filter(
          (_: any, idx: number) => idx % numTeams === tIdx
        );

        return {
          timId: String(tDef.id),
          namaTim: tDef.name,
          warna: tDef.color,
          rows: pList.map((p: any) => {
            const log = p.riwayatGigitan || [];
            let benarPertamaCount = 0;
            let dilihatCount = 0;

            const cells = questionsInfo.map((q: any) => {
              const attempts = log.filter((l: any) => l.questionId === q.questionId);
              const first = attempts[0];
              if (!first) {
                return {
                  questionId: q.questionId,
                  ok: null,
                  jawabanKey: null,
                  jawabanTeks: null,
                  timedOut: false,
                  percobaanCount: 0,
                };
              }
              dilihatCount += 1;
              if (first.benar) benarPertamaCount += 1;
              return {
                questionId: q.questionId,
                ok: first.benar,
                jawabanKey: first.jawabanKey || (first.benar ? q.jawabanBenarKode : null),
                jawabanTeks: first.jawabanTeks || null,
                timedOut: Boolean(first.timedOut),
                percobaanCount: attempts.length,
              };
            });

            return {
              pesertaId: p.id,
              nama: p.nama,
              benarPertamaCount,
              dilihatCount,
              cells,
            };
          }),
        };
      });

      // Cari soal paling sulit
      let hardestId: string | null = null;
      let worstPct = 101;
      for (const qi of questionsInfo) {
        if (qi.persenBenar !== null && qi.persenBenar < worstPct) {
          worstPct = qi.persenBenar;
          hardestId = qi.questionId;
        }
      }

      return {
        questions: questionsInfo,
        teams: teamsData,
        hardestQuestionId: hardestId,
        defaultQuestionId: hardestId || questionsInfo[0]?.questionId || null,
      };
    }

    return null;
  }, [hasilAkhir, leaderboard, activeTeamDefs, numTeams]);

  // Urutkan tim untuk podium pemenang
  const rankedTeams = useMemo(() => {
    return [...teamGroups].sort((a, b) => {
      if (a.isLudes && !b.isLudes) return -1;
      if (!a.isLudes && b.isLudes) return 1;
      return b.eaten - a.eaten;
    });
  }, [teamGroups]);

  if (status === 'lobi') {
    return (
      <RuangTungguGuru
        sessionId={initialSession.sessionId}
        token={initialSession.token}
        qrDataUrl={initialSession.qrDataUrl}
        gameType="makan_kerupuk"
        gameTitle="Makan Kerupuk"
        templateJudul={initialSession.templateJudul}
        metaDetail={`Makan Kerupuk, ${numTeams} tim`}
        daftarPeserta={leaderboard.map((p) => ({ id: p.id, nama: p.nama }))}
        minPeserta={1}
        maxPeserta={initialSession.config?.maxPeserta || 40}
        isStarting={isStarting}
        onMulai={handleMulaiLomba}
        onTransisiSelesai={handleTransisiSelesai}
        onKembali={handleKembaliClick}
        config={initialSession.config}
        onKickPeserta={(pid) => {
          handleKickPeserta(pid);
        }}
      />
    );
  }

  return (
    <div className="kp-festival flex flex-col min-h-screen">
      {/* ====================================================================
          1. PANGGUNG UTAMA FESTIVAL 17 AGUSTUS (KERUPUK STADIUM)
          ==================================================================== */}
      <KerupukStadium
        title={initialSession.templateJudul}
        subtitle="MAKAN KERUPUK • MODE MULTIPLAYER"
        statusLabel={status === 'jalan' ? 'BERLANGSUNG' : 'SELESAI'}
        statusTone={status === 'jalan' ? 'live' : status === 'selesai' ? 'done' : 'idle'}
        timerText={status === 'jalan' ? formatDetik(timeRemaining) : '3:00'}
        lanes={lanes}
        actionPulse={actionPulse}
        crowdCheer={crowdCheer}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onBack={handleKembaliClick}
        backLabel="Kembali"
        onStop={status === 'jalan' ? () => setModalAkhiriOpen(true) : undefined}
        stopLabel="Akhiri"
      />

      {/* ====================================================================
          2. KONTEN GAMEPLAY (LOBI / BERLANGSUNG / SELESAI)
          ==================================================================== */}
      <main className="max-w-5xl w-full mx-auto px-4 py-6 space-y-6 flex-1">
        {/* FASE 1: LOBI GABUNG SISWA */}
        {false && (
          <div className="bg-[#fffaf0] border-2 border-[#e6d3ae] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Kolom Kiri: PIN & QR Code */}
              <div className="md:col-span-5 space-y-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-[#0f3d2e]">Siswa gabung lewat HP</h2>
                </div>
                <p className="text-xs text-[#6d7a6f] leading-relaxed">
                  Masukkan PIN atau pindai QR, lalu tulis nama. Siswa dibagi ke {numTeams} tim: satu
                  tim satu avatar dan satu kerupuk bersama.
                </p>

                <div className="space-y-3">
                  <div className="text-xs font-bold text-[#6d7a6f] uppercase tracking-wider">
                    KODE PIN SESI:
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                    {initialSession.token.split('').map((digit, i) => (
                      <span
                        key={i}
                        className="w-11 h-13 sm:w-12 sm:h-14 rounded-2xl bg-[#0f3d2e] text-[#fffaf0] font-black text-2xl sm:text-3xl font-mono flex items-center justify-center shadow-md"
                      >
                        {digit}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={handleSalinPin}
                      className="ml-2 p-2.5 rounded-xl border border-[#e6d3ae] bg-white hover:bg-[#f6ead4] text-[#0f3d2e] transition-colors cursor-pointer"
                      title="Salin PIN"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {initialSession.qrDataUrl && (
                  <div className="pt-2">
                    <img
                      src={initialSession.qrDataUrl}
                      alt="QR Code Lobi"
                      className="w-36 h-36 border-2 border-[#0f3d2e] rounded-2xl p-2 bg-white shadow-sm"
                    />
                  </div>
                )}
              </div>

              {/* Kolom Kanan: Tim & Siswa Bergabung */}
              <div className="md:col-span-7 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-extrabold text-[#0f3d2e] flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#1d8fe0]" />
                    <span>Daftar Tim ({totalPeserta} siswa)</span>
                  </h3>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-[#f6ead4] p-1 rounded-xl border border-[#e6d3ae]">
                      {([3, 4] as const).map((n) => {
                        const active = jumlahTim === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            disabled={isChangingTeamCount}
                            onClick={() => handleUbahJumlahTim(n)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                              active
                                ? 'bg-[#0f3d2e] text-[#fffaf0] shadow-xs'
                                : 'text-[#0f3d2e] hover:bg-white/60'
                            }`}
                          >
                            {n} Tim
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={handleAcakUrutan}
                      disabled={totalPeserta === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e6d3ae] bg-white hover:bg-[#f6ead4] text-xs font-extrabold text-[#0f3d2e] cursor-pointer disabled:opacity-50"
                    >
                      <Shuffle className="w-3.5 h-3.5" /> Acak Tim
                    </button>
                  </div>
                </div>

                {/* Kartu Pembagian Tim */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {teamGroups.map((tg) => (
                    <div
                      key={tg.id}
                      className="p-4 rounded-2xl border-2 bg-white space-y-2 shadow-xs"
                      style={{ borderColor: tg.color }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="px-3 py-0.5 rounded-full text-white font-extrabold text-xs"
                          style={{ background: tg.color }}
                        >
                          {tg.name}
                        </span>
                        <span className="text-xs font-bold text-[#6d7a6f]">
                          {tg.count} siswa
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 min-h-[36px]">
                        {tg.members.length > 0 ? (
                          tg.members.map((m) => (
                            <span
                              key={m.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#f6ead4] border border-[#e6d3ae] text-[#0f3d2e]"
                            >
                              <span>{m.nama}</span>
                              <button
                                type="button"
                                onClick={() => handleKickPeserta(m.id)}
                                className="text-red-600 hover:text-red-800 ml-0.5 cursor-pointer"
                                title="Keluarkan siswa"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs italic text-[#6d7a6f]">Menunggu siswa...</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleMulaiLomba}
                    disabled={totalPeserta === 0 || isStarting}
                    className="px-8 py-3.5 rounded-2xl bg-[#e2312d] hover:bg-[#b81f1c] text-white font-extrabold text-base shadow-[0_5px_0_#b81f1c] active:translate-y-1 active:shadow-[0_1px_0_#b81f1c] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isStarting ? 'Memulai...' : 'Mulai Lomba Sekarang'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FASE 2: PERMAINAN BERLANGSUNG */}
        {status === 'jalan' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Papan Peringkat Tim Real-time */}
            <div className="md:col-span-8 bg-[#fffaf0] border-2 border-[#e6d3ae] rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-extrabold text-[#0f3d2e] flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#ffb81c]" /> Papan Peringkat Tim
                </h3>
                <span className="text-xs font-bold text-[#6d7a6f]">
                  Target: <strong>Kerupuk Ludes (100 pt)</strong>
                </span>
              </div>

              <div className="space-y-3">
                {rankedTeams.map((tg, idx) => (
                  <div
                    key={tg.id}
                    className="p-4 rounded-2xl border-2 bg-white space-y-2 shadow-xs transition-all"
                    style={{ borderColor: tg.color }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-[#0f3d2e] text-white text-xs font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span
                          className="px-3 py-0.5 rounded-full text-white font-extrabold text-xs"
                          style={{ background: tg.color }}
                        >
                          {tg.name}
                        </span>
                        <span className="text-xs text-[#6d7a6f] hidden sm:inline">
                          ({tg.members.map((m) => m.nama).join(', ') || '–'})
                        </span>
                      </div>
                      <strong className="text-base font-extrabold font-mono text-[#0f3d2e]">
                        {tg.isLudes ? 'LUDES!' : `${tg.eaten} pt`}
                      </strong>
                    </div>

                    {/* Progress Bar Dimakan */}
                    <div className="w-full h-3 rounded-full bg-[#e6d3ae] overflow-hidden">
                      <div
                        className="h-full transition-all duration-600 rounded-full"
                        style={{
                          width: `${tg.eaten}%`,
                          background: tg.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Feed Jawaban Siswa */}
            <div className="md:col-span-4 bg-[#fffaf0] border-2 border-[#e6d3ae] rounded-3xl p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#6d7a6f]">
                Aktivitas Terakhir
              </h4>
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {liveFeed.length > 0 ? (
                  liveFeed.map((item) => (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border text-xs font-bold ${
                        item.tipe === 'benar'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-red-50 border-red-200 text-red-900'
                      }`}
                    >
                      {item.teks}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#6d7a6f] italic">Menunggu jawaban siswa...</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* FASE 3: SELESAI (PODIUM & HEATMAP MATRIX PER-SOAL) */}
        {status === 'selesai' && (
          <div className="space-y-8">
            {/* Header Pemenang */}
            <div className="bg-[#fffaf0] border-2 border-[#e6d3ae] rounded-3xl p-6 sm:p-8 text-center space-y-2 shadow-sm">
              <span className="inline-block px-3 py-1 rounded-full bg-[#ffe9a8] text-[#7a5200] text-xs font-extrabold uppercase">
                Hasil Lomba Makan Kerupuk
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f3d2e]">
                Pemenang: {rankedTeams[0]?.name || 'Tim Pemenang'}!
              </h2>
              <p className="text-sm text-[#6d7a6f]">
                {rankedTeams[0]?.isLudes
                  ? 'Pertama yang menghabiskan kerupuknya sampai ludes!'
                  : 'Kerupuk dimakan paling banyak saat waktu perlombaan habis.'}
              </p>
              <div className="flex justify-center gap-3 pt-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleMainLagi}
                  disabled={isRematching}
                  className="px-6 py-2.5 rounded-xl bg-[#1f9d55] text-white font-extrabold text-sm shadow-[0_4px_0_#14703c] cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 inline-block mr-1.5" />
                  {isRematching ? 'Menyiapkan...' : 'Main Lagi'}
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('lobi')}
                  className="px-6 py-2.5 rounded-xl bg-[#5b6b8c] text-white font-extrabold text-sm shadow-[0_4px_0_#3d4a66] cursor-pointer"
                >
                  Ubah Peserta / Ke Lobi
                </button>
                <button
                  type="button"
                  onClick={() => navigate(modeSelectUrl)}
                  className="px-6 py-2.5 rounded-xl border border-[#e6d3ae] bg-white hover:bg-[#f6ead4] text-[#0f3d2e] font-extrabold text-sm shadow-[0_4px_0_#e6d3ae] cursor-pointer"
                >
                  Pilih Mode Lain
                </button>
                <button
                  type="button"
                  onClick={() => navigate(effectiveReturnUrl)}
                  className="px-6 py-2.5 rounded-xl bg-[#ffb81c] text-[#4a3000] font-extrabold text-sm shadow-[0_4px_0_#c98a00] cursor-pointer"
                >
                  Dashboard Guru
                </button>
              </div>
            </div>

            {/* Kartu Podium 3D Juara 1, 2, 3 */}
            <div className="kp-cards">
              {rankedTeams.slice(0, 3).map((tg, idx) => {
                const isFirst = idx === 0;
                return (
                  <div key={tg.id} className={`kp-pd ${isFirst ? 'w' : ''}`}>
                    <div className={`kp-ch ${isFirst ? 'win' : ''}`} style={{ width: 90 }}>
                      <ContestantCharSvg shirtColor={tg.color} index={idx} />
                    </div>
                    <div className="mt-2">
                      <span className="kp-pl2">
                        {isFirst ? '★ Juara 1 • Pemenang' : `Juara ${idx + 1}`}
                      </span>
                    </div>
                    <h3>{tg.name}</h3>
                    <p className="text-xs text-[#6d7a6f] my-1">
                      {tg.members.map((m) => m.nama).join(', ') || '–'}
                    </p>
                    <div className="big font-mono">{tg.eaten} pt</div>
                    <div className="text-xs text-[#6d7a6f] pt-2 border-t border-[#e6d3ae]">
                      Benar {tg.totalBenar} • Salah {tg.totalSalah}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Question Heatmap Matrix Analisis Per-Soal */}
            {heatmapData && (
              <div className="bg-[#fffaf0] border-2 border-[#e6d3ae] rounded-3xl p-6 shadow-sm">
                <KerupukHeatmapMatrix heatmap={heatmapData} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Konfirmasi Akhiri Sesi */}
      <Modal
        isOpen={modalAkhiriOpen}
        onClose={() => setModalAkhiriOpen(false)}
        title="Akhiri Lomba Makan Kerupuk?"
        maxWidth="sm"
      >
        <div className="space-y-4 text-[#0f3d2e]">
          <p className="text-sm">
            Apakah Anda yakin ingin mengakhiri sesi Makan Kerupuk sekarang? Hasil perlombaan dan
            podium juara akan langsung dihitung.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#e6d3ae]">
            <button
              type="button"
              onClick={() => setModalAkhiriOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#e6d3ae] text-xs font-bold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleKonfirmasiAkhiri}
              disabled={isEnding}
              className="px-4 py-2 rounded-xl bg-[#e2312d] text-white text-xs font-bold cursor-pointer"
            >
              {isEnding ? 'Mengakhiri...' : 'Ya, Akhiri Lomba'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Keluar saat Permainan Sedang Berlangsung */}
      <ModalKonfirmasiKeluar
        isOpen={modalKeluarOpen}
        onClose={() => setModalKeluarOpen(false)}
        onKonfirmasiKeluar={handleKonfirmasiKeluar}
        judulGame="Makan Kerupuk Multiplayer"
      />
    </div>
  );
}
