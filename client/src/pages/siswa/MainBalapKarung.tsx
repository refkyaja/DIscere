import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getSocket } from '../../lib/socket';
import { bindStudentReconnect, createAnswerWatchdogs } from '../../lib/socketReconnect';
import { QuestionTimerBar, computeInitialRemainingMs } from '../../components';
import { isStaleQuestionErrorMessage } from '../../lib/soloSessionSync';
import { soundEffects, useGameSoundLifecycle } from '../../lib/soundEffects';
import { BalapSackSvg } from '../../components/BalapKarungStadium';
import RuangTungguSiswa from './RuangTungguSiswa';
import { LogOut, Trophy, Volume2, VolumeX, Loader2, Pause } from 'lucide-react';

export type KodeTimBalapSiswa = 'merah' | 'biru' | 'hijau' | 'kuning';

export interface AnggotaTimSiswa {
  id: string;
  nama: string;
  connected?: boolean;
  totalBenar: number;
  totalSalah: number;
}

export interface RingkasanTimSiswa {
  id: KodeTimBalapSiswa;
  nama: string;
  warna: string;
  meter: number;
  targetJarak: number;
  persen: number;
  isWinner: boolean;
  selesaiPadaMs: number | null;
  anggota: AnggotaTimSiswa[];
}

export interface PilihanBalap {
  choiceId: string;
  key: 'A' | 'B' | 'C' | 'D' | 'E';
  teks: string;
}

export interface SoalBalapData {
  presentationId: string;
  questionId: string;
  nomorSoal: number;
  totalSoalTemplate: number;
  teks: string;
  pilihan: PilihanBalap[];
  ditampilkanPadaMs?: number;
  waktuPerSoalDetik?: number;
  berakhirPadaMs?: number;
  serverNowMs?: number;
  serverOffsetMs?: number;
}

export interface PesertaBalapData {
  id: string;
  nama: string;
  tim?: KodeTimBalapSiswa | null;
  jarak: number;
  targetJarak: number;
  keseimbangan: number;
  jumlahJatuh: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen?: number;
  streakSaatIni: number;
  streakTertinggi: number;
  status: 'bermain' | 'selesai';
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  efekAktif?: {
    perisai: boolean;
    lompatanKuat: boolean;
    jalanBerlumpur: boolean;
  };
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
    jumlahTim?: 3 | 4;
    waktuPerSoalDetik?: number;
    lompatBenar?: number;
    turunSalah?: number;
    keseimbanganAktif?: boolean;
    bonusStreakAktif?: boolean;
    rintanganAktif?: boolean;
  };
  initialStatus?: string;
  initialPesertaState?: PesertaBalapData;
  initialLeaderboard?: PesertaBalapData[];
  initialTeams?: RingkasanTimSiswa[];
  initialSoalAktif?: SoalBalapData | null;
  onKeluar: (pesan?: string) => void;
}

interface FeedbackSiswaState {
  benar: boolean;
  timedOut?: boolean;
  stumbleQuote?: string | null;
  stepTim?: number;
  kunciKey: string;
  bonusStreakJarakDidapat?: number;
  bonusLompatanKuatDidapat?: number;
  penaltiJalanBerlumpurDipakai?: number;
  terjatuh?: boolean;
  penaltiJatuhJarak?: number;
  perisaiDigunakan?: boolean;
  rintanganBaru?: { tipe: string; judul: string; deskripsi?: string } | null;
}

const DEFAULT_TEAM_META: Record<KodeTimBalapSiswa, { nama: string; warna: string }> = {
  merah: { nama: 'Tim Merah', warna: '#e2312d' },
  biru: { nama: 'Tim Biru', warna: '#1d8fe0' },
  hijau: { nama: 'Tim Hijau', warna: '#1f9d55' },
  kuning: { nama: 'Tim Kuning', warna: '#e6a100' },
};

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
  initialTeams = [],
  initialSoalAktif = null,
  onKeluar,
}: MainBalapKarungProps) {
  const [activeConfig, setActiveConfig] = useState(config || {});
  const targetJarak = activeConfig?.targetJarak ?? initialPesertaState?.targetJarak ?? 100;
  const defaultTimerDetik = Math.max(5, activeConfig?.waktuPerSoalDetik ?? 15);

  const [stage, setStage] = useState<'LOBBY' | 'PLAYING' | 'SELESAI'>(
    initialStatus === 'jalan' ? 'PLAYING' : initialStatus === 'selesai' ? 'SELESAI' : 'LOBBY'
  );
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const [teams, setTeams] = useState<RingkasanTimSiswa[]>(initialTeams);
  const [leaderboard, setLeaderboard] = useState<PesertaBalapData[]>(initialLeaderboard);
  const [myState, setMyState] = useState<PesertaBalapData>(
    initialPesertaState || {
      id: pesertaId,
      nama,
      tim: null,
      jarak: 0,
      targetJarak,
      keseimbangan: 100,
      jumlahJatuh: 0,
      totalBenar: 0,
      totalSalah: 0,
      streakSaatIni: 0,
      streakTertinggi: 0,
      status: 'bermain',
      rataRataWaktuJawabMs: 0,
      jumlahJawab: 0,
    }
  );
  const [soalAktif, setSoalAktif] = useState<SoalBalapData | null>(initialSoalAktif);
  const [choiceDipilih, setChoiceDipilih] = useState<string | null>(null);
  const [sudahKirim, setSudahKirim] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackSiswaState | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [hasilAkhir, setHasilAkhir] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const { isMuted, toggleMute } = useGameSoundLifecycle(stage === 'PLAYING', sessionId);

  const timeoutSentRef = useRef<string | null>(null);
  const watchdogsRef = useRef(createAnswerWatchdogs());

  // Cari tim milik siswa saat ini (prioritaskan dari daftar teams agar ikut update jika jumlah tim diubah di lobi)
  const myTeam: RingkasanTimSiswa = useMemo(() => {
    const foundByMember = teams.find((t) => t.anggota.some((a) => a.id === pesertaId));
    if (foundByMember) return foundByMember;

    const kode = myState.tim || 'merah';
    const foundById = teams.find((t) => t.id === kode);
    if (foundById) return foundById;

    const meta = DEFAULT_TEAM_META[kode] || DEFAULT_TEAM_META.merah;
    return {
      id: kode,
      nama: meta.nama,
      warna: meta.warna,
      meter: 0,
      targetJarak,
      persen: 0,
      isWinner: false,
      selesaiPadaMs: null,
      anggota: [{ id: pesertaId, nama, connected: true, totalBenar: myState.totalBenar, totalSalah: myState.totalSalah }],
    };
  }, [teams, pesertaId, myState.tim, myState.totalBenar, myState.totalSalah, targetJarak, nama]);

  const rankedTeams: RingkasanTimSiswa[] = useMemo(() => {
    if (teams.length === 0) return [myTeam];
    return [...teams].sort((a, b) => {
      if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
      if (Math.abs(b.meter - a.meter) > 0.001) return b.meter - a.meter;
      if (a.selesaiPadaMs !== null && b.selesaiPadaMs !== null) {
        return a.selesaiPadaMs - b.selesaiPadaMs;
      }
      return 0;
    });
  }, [teams, myTeam]);

  // Listen socket events
  useEffect(() => {
    const socket = getSocket();

    const handleLobiUpdate = (data: {
      game?: string;
      config?: any;
      teams?: RingkasanTimSiswa[];
      leaderboard?: PesertaBalapData[];
    }) => {
      if (data.game && data.game !== 'balap_karung') return;
      if (data.config) setActiveConfig((prev: any) => ({ ...prev, ...data.config }));
      if (data.teams) {
        setTeams(data.teams);
        const teamFound = data.teams.find((t) => t.anggota.some((a) => a.id === pesertaId));
        if (teamFound) {
          setMyState((prev) => ({ ...prev, tim: teamFound.id }));
        }
      }
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
        const self = data.leaderboard.find((p) => p.id === pesertaId);
        if (self) setMyState((prev) => ({ ...prev, ...self }));
      }
    };

    const handleGameMulai = (data: {
      game?: string;
      config?: any;
      teams?: RingkasanTimSiswa[];
      leaderboard?: PesertaBalapData[];
    }) => {
      if (data.game && data.game !== 'balap_karung') return;
      if (data.config) setActiveConfig((prev: any) => ({ ...prev, ...data.config }));
      if (data.teams) setTeams(data.teams);
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
        const self = data.leaderboard.find((p) => p.id === pesertaId);
        if (self) setMyState((prev) => ({ ...prev, ...self }));
      }
      watchdogsRef.current.clearAll();
      setFeedback(null);
      setChoiceDipilih(null);
      setSudahKirim(false);
      setErrorBanner(null);
      timeoutSentRef.current = null;
      soundEffects.startGame('race');
      if (stageRef.current !== 'LOBBY') {
        setStage('PLAYING');
      }
    };

    const handleSoalTampil = (data: SoalBalapData) => {
      watchdogsRef.current.clearAll();
      const serverOffsetMs = typeof data.serverNowMs === 'number' ? data.serverNowMs - Date.now() : 0;
      setSoalAktif({
        ...data,
        serverOffsetMs,
      });
      setChoiceDipilih(null);
      setSudahKirim(false);
      setFeedback(null);
      setErrorBanner(null);
      timeoutSentRef.current = null;
      if (stageRef.current !== 'LOBBY') {
        setStage('PLAYING');
      }
    };

    const handleBalapUpdate = (data: {
      teams?: RingkasanTimSiswa[];
      leaderboard?: PesertaBalapData[];
    }) => {
      if (data.teams) setTeams(data.teams);
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
        const self = data.leaderboard.find((p) => p.id === pesertaId);
        if (self) setMyState((prev) => ({ ...prev, ...self }));
      }
    };

    const handleJawabHasil = (data: any) => {
      if (data.game && data.game !== 'balap_karung') return;
      watchdogsRef.current.clearAck();
      if (data.pesertaUpdated) {
        setMyState((prev) => ({ ...prev, ...data.pesertaUpdated }));
      }
      if (data.teams) setTeams(data.teams);

      const benar = Boolean(data.benar);
      setSudahKirim(true);
      setErrorBanner(null);
      setFeedback({
        benar,
        timedOut: Boolean(data.timedOut),
        stumbleQuote: data.stumbleQuote || null,
        stepTim: typeof data.stepTim === 'number' ? data.stepTim : undefined,
        kunciKey: String(data.kunciKey || data.jawabanBenar || ''),
        bonusStreakJarakDidapat: data.bonusStreakJarakDidapat || 0,
        bonusLompatanKuatDidapat: data.bonusLompatanKuatDidapat || 0,
        penaltiJalanBerlumpurDipakai: data.penaltiJalanBerlumpurDipakai || 0,
        terjatuh: Boolean(data.terjatuh),
        penaltiJatuhJarak: data.penaltiJatuhJarak || 0,
        perisaiDigunakan: Boolean(data.perisaiDigunakan),
        rintanganBaru: data.rintanganBaru || null,
      });

      soundEffects.playBalapKarungAction({
        benar,
        isBoosted: Boolean(data.bonusLompatanKuatDidapat || data.bonusStreakJarakDidapat),
        terjatuh: Boolean(data.terjatuh),
        perisaiDigunakan: Boolean(data.perisaiDigunakan),
        isMud:
          (data.penaltiJalanBerlumpurDipakai || 0) > 0 ||
          data.rintanganBaru?.tipe === 'jalan_berlumpur',
        playAnswerChime: true,
        playStumbleOnWrong: true,
      });

      watchdogsRef.current.armNextSoalFallback(socket, {
        sessionId,
        pesertaId,
        pesertaSecret,
      });
    };

    const handleSesiSelesai = (data: { game?: string; hasil?: any }) => {
      if (data.game && data.game !== 'balap_karung') return;
      watchdogsRef.current.clearAll();
      if (data.hasil) {
        setHasilAkhir(data.hasil);
        if (data.hasil.teams) setTeams(data.hasil.teams);
      }
      setStage('SELESAI');
      if (data.hasil?.dihentikanManual) {
        soundEffects.stopAll();
      } else {
        soundEffects.playNaturalVictory();
      }
    };

    const handleDiKick = (data: { pesan?: string }) => {
      onKeluar(data?.pesan || 'Anda telah dikeluarkan dari lobi oleh guru.');
    };

    const handleGameJeda = (data: { game?: string }) => {
      if (data?.game && data.game !== 'balap_karung') return;
      setIsPaused(true);
    };

    const handleGameLanjut = (data: { game?: string; pauseDuration?: number }) => {
      if (data?.game && data.game !== 'balap_karung') return;
      setIsPaused(false);
      if (data?.pauseDuration && soalAktif?.berakhirPadaMs) {
        setSoalAktif((prev) =>
          prev && prev.berakhirPadaMs
            ? { ...prev, berakhirPadaMs: prev.berakhirPadaMs + data.pauseDuration! }
            : prev
        );
      }
    };

    const handleMainLagiSiswa = (data: { sessionId: string; token: string }) => {
      if (data?.token) {
        window.location.href = `/main?token=${encodeURIComponent(data.token)}&nama=${encodeURIComponent(nama)}`;
      }
    };

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('game:mulai', handleGameMulai);
    socket.on('soal:tampil', handleSoalTampil);
    socket.on('balap:update', handleBalapUpdate);
    socket.on('jawab:hasil', handleJawabHasil);
    socket.on('sesi:selesai', handleSesiSelesai);
    socket.on('sesi:dikick', handleDiKick);
    socket.on('game:jeda', handleGameJeda);
    socket.on('game:lanjut', handleGameLanjut);
    socket.on('sesi:main_lagi', handleMainLagiSiswa);

    return () => {
      watchdogsRef.current.clearAll();
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('soal:tampil', handleSoalTampil);
      socket.off('balap:update', handleBalapUpdate);
      socket.off('jawab:hasil', handleJawabHasil);
      socket.off('sesi:selesai', handleSesiSelesai);
      socket.off('sesi:dikick', handleDiKick);
      socket.off('game:jeda', handleGameJeda);
      socket.off('game:lanjut', handleGameLanjut);
      socket.off('sesi:main_lagi', handleMainLagiSiswa);
    };
  }, [pesertaId, defaultTimerDetik]);

  // Sinkronkan juga fallback initialLeaderboard bila initialTeams belum ada
  useEffect(() => {
    if (initialLeaderboard.length > 0 && myState.tim === undefined) {
      const self = initialLeaderboard.find((p) => p.id === pesertaId);
      if (self) setMyState((prev) => ({ ...prev, ...self }));
    }
  }, [initialLeaderboard, pesertaId, myState.tim]);

  // Bersihkan timer watchdog setiap kali berpindah soal atau unmount
  useEffect(() => {
    return () => watchdogsRef.current.clearAll();
  }, [soalAktif?.presentationId]);

  useEffect(() => {
    const socket = getSocket();
    return bindStudentReconnect(socket, {
      token,
      nama,
      pesertaId,
      pesertaSecret,
      onReconnectSuccess: (res: any) => {
        if (!res?.success) return;
        if (res.config) setActiveConfig((prev: any) => ({ ...prev, ...res.config }));
        if (res.teams) setTeams(res.teams);
        if (res.peserta) setMyState(res.peserta);
        if (res.status === 'jalan') {
          setStage('PLAYING');
          if (res.soalAktif) {
            setSoalAktif((prev) =>
              prev && prev.presentationId === res.soalAktif.presentationId ? prev : res.soalAktif
            );
          }
        } else if (res.status === 'selesai') {
          if (res.hasil) setHasilAkhir(res.hasil);
          setStage('SELESAI');
        }
      },
    });
  }, [token, nama, pesertaId, pesertaSecret]);

  const handleTimeoutSoal = useCallback(() => {
    if (stage !== 'PLAYING' || !soalAktif || sudahKirim || Boolean(feedback)) return;
    if (timeoutSentRef.current === soalAktif.presentationId) return;
    timeoutSentRef.current = soalAktif.presentationId;
    setSudahKirim(true);

    const socket = getSocket();
    watchdogsRef.current.armAckTimeout(() => {
      setSudahKirim(false);
      setErrorBanner('Waktu habis, mencoba menyinkronkan soal berikutnya...');
      if (socket.connected) {
        socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
      }
    });

    socket.emit(
      'jawab:kirim',
      {
        sessionId,
        pesertaId,
        pesertaSecret,
        presentationId: soalAktif.presentationId,
        questionId: soalAktif.questionId,
        timedOut: true,
      },
      (res: any) => {
        watchdogsRef.current.clearAck();
        if (!res?.success) {
          setSudahKirim(false);
          if (res?.pesan && isStaleQuestionErrorMessage(res.pesan)) {
            socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
          }
        }
      }
    );
  }, [stage, soalAktif, sudahKirim, feedback, sessionId, pesertaId, pesertaSecret]);

  const handlePilihJawaban = (opsi: PilihanBalap) => {
    if (sudahKirim || Boolean(feedback) || !soalAktif || isPaused) return;

    setChoiceDipilih(opsi.choiceId);
    setSudahKirim(true);
    setErrorBanner(null);

    const socket = getSocket();
    watchdogsRef.current.armAckTimeout(() => {
      setSudahKirim(false);
      setChoiceDipilih(null);
      setErrorBanner('Koneksi terputus atau lambat. Silakan ketuk jawaban lagi.');
      if (socket.connected) {
        socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
      }
    });

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
        watchdogsRef.current.clearAck();
        if (!res?.success) {
          setSudahKirim(false);
          setChoiceDipilih(null);
          const pesan = res?.pesan || 'Gagal mengirim jawaban. Silakan pilih kembali.';
          setErrorBanner(pesan);
          if (isStaleQuestionErrorMessage(pesan)) {
            socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
          }
        }
      }
    );
  };

  const renderTopBar = () => (
    <header className="w-full max-w-md mx-auto flex items-center justify-between gap-2 bg-[#fffdf6] border-2 border-[#f0dfb4] rounded-2xl px-3.5 py-2.5 shadow-xs">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: myTeam.warna }}
          />
          <span className="bk-h text-sm font-extrabold text-[#2b2a4a] truncate">
            {nama}
          </span>
          <span
            className="text-[11px] font-extrabold px-2 py-0.5 rounded-full text-white"
            style={{ background: myTeam.warna }}
          >
            {myTeam.nama}
          </span>
        </div>
        <p className="text-[11px] font-bold text-[#6b6a85] truncate mt-0.5">
          {templateJudul} • PIN {token}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {stage === 'PLAYING' && (
          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-xl bg-[#fff3d6] border border-[#f0dfb4] text-[#2b2a4a] cursor-pointer"
            aria-label={isMuted ? 'Nyalakan suara' : 'Bisukan suara'}
            title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => onKeluar?.()}
          className="p-2 rounded-xl bg-[#fde0e0] border border-[#f4b6b6] text-[#8a1f1f] cursor-pointer"
          aria-label="Keluar sesi"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );

  const soalDurasiSec = Math.max(5, soalAktif?.waktuPerSoalDetik || defaultTimerDetik);
  const initialSoalRemainingMs = useMemo(
    () =>
      computeInitialRemainingMs(
        soalAktif?.berakhirPadaMs,
        soalDurasiSec,
        soalAktif?.serverOffsetMs || 0
      ),
    [soalAktif?.presentationId, soalAktif?.berakhirPadaMs, soalDurasiSec, soalAktif?.serverOffsetMs]
  );

  // =========================================================================
  // 1. TAHAP LOBI SISWA
  // =========================================================================
  if (stage === 'LOBBY') {
    return (
      <RuangTungguSiswa
        token={token}
        nama={nama}
        pesertaId={pesertaId}
        gameType="balap_karung"
        templateJudul={templateJudul}
        config={activeConfig}
        daftarPeserta={leaderboard.map((p) => ({ id: p.id, nama: p.nama, tim: p.tim }))}
        teams={teams.map((t) => ({
          id: t.id,
          nama: t.nama,
          warna: t.warna,
          anggota: t.anggota.map((a) => ({ id: a.id, nama: a.nama })),
        }))}
        myTeamId={myTeam?.id}
        onKeluar={onKeluar}
        onMulaiPermainan={() => {
          try {
            getSocket().emit('siswa:siap_soal', { sessionId, pesertaId, token });
          } catch (err) {
            console.error('[siswa:siap_soal error]', err);
          }
          setStage('PLAYING');
        }}
      />
    );
  }

  // =========================================================================
  // 2. TAHAP SELESAI (PODIUM TIM)
  // =========================================================================
  if (stage === 'SELESAI') {
    const winningTeam =
      rankedTeams.find((t) => t.isWinner) ||
      (hasilAkhir?.timPemenang
        ? rankedTeams.find((t) => t.id === hasilAkhir.timPemenang)
        : undefined) ||
      rankedTeams[0];
    const isMyTeamWinner = winningTeam?.id === myTeam.id;
    const totalJawab = myState.totalBenar + myState.totalSalah;
    const akurasi = totalJawab > 0 ? Math.round((myState.totalBenar / totalJawab) * 100) : 0;

    return (
      <div className="bk-festival p-4 flex flex-col gap-4 select-none">
        {renderTopBar()}

        <main className="w-full max-w-md mx-auto my-auto space-y-4">
          <div className="bk-card text-center space-y-3 border-[3px] border-[#ffb81c] bg-gradient-to-b from-[#fffdf6] to-[#fff3d6]">
            <div className="flex justify-center">
              <BalapSackSvg
                shirtColor={isMyTeamWinner ? myTeam.warna : winningTeam?.warna || myTeam.warna}
                up={isMyTeamWinner}
                crown={isMyTeamWinner}
                className="w-24 h-auto"
              />
            </div>

            <span className="inline-block px-3.5 py-1 rounded-full bg-[#ffe9a8] text-[#7a5200] text-xs font-extrabold">
              <Trophy className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              {isMyTeamWinner ? 'Selamat! Timmu Juara 1!' : 'Lomba Selesai'}
            </span>

            <h1 className="bk-h text-2xl font-extrabold text-[#2b2a4a]">
              Pemenang: {hasilAkhir?.namaTimPemenang || winningTeam?.nama || 'Tim Juara'}!
            </h1>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t-2 border-[#f0dfb4] text-xs">
              <div className="bg-white border border-[#f0dfb4] rounded-xl p-2">
                <div className="text-[#6b6a85] font-bold">Benar</div>
                <div className="bk-h text-lg font-extrabold text-[#1f9d55]">
                  {myState.totalBenar}
                </div>
              </div>
              <div className="bg-white border border-[#f0dfb4] rounded-xl p-2">
                <div className="text-[#6b6a85] font-bold">Salah</div>
                <div className="bk-h text-lg font-extrabold text-[#d63b3b]">
                  {myState.totalSalah}
                </div>
              </div>
              <div className="bg-white border border-[#f0dfb4] rounded-xl p-2">
                <div className="text-[#6b6a85] font-bold">Akurasi</div>
                <div className="bk-h text-lg font-extrabold text-[#2b2a4a]">{akurasi}%</div>
              </div>
            </div>

            {rankedTeams.length > 0 && (
              <div className="space-y-1.5 text-left pt-1">
                {rankedTeams.map((t, idx) => (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border-2 text-xs font-extrabold ${
                      t.id === myTeam.id
                        ? 'bg-[#fff3c4] border-[#ffb81c]'
                        : 'bg-white border-[#f0dfb4]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-4">#{idx + 1}</span>
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ background: t.warna }}
                      />
                      <span>
                        {t.nama} {t.id === myTeam.id ? '(Timmu)' : ''}
                      </span>
                    </span>
                    <span className="text-[#1f9d55]">{Math.round(t.meter)} m</span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => onKeluar?.()}
              className="bk-btn w-full justify-center mt-2"
            >
              Keluar dari Permainan
            </button>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // 3. TAHAP BERMAIN DI HP SISWA
  // =========================================================================
  return (
    <div className="bk-festival p-3 sm:p-4 flex flex-col gap-3 select-none">
      {renderTopBar()}

      <main className="w-full max-w-md mx-auto flex-1 flex flex-col gap-3">
        {/* Ringkasan Posisi Tim Mini */}
        {rankedTeams.length > 0 && (
          <div className="bg-[#fffdf6] border-2 border-[#f0dfb4] rounded-2xl p-3 space-y-1.5">
            {rankedTeams.map((t) => {
              const pct = Math.min(100, Math.max(0, (t.meter / targetJarak) * 100));
              const isMe = t.id === myTeam.id;
              return (
                <div key={t.id} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] font-extrabold">
                    <span className="flex items-center gap-1.5 text-[#2b2a4a]">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: t.warna }}
                      />
                      {t.nama} {isMe ? '★' : ''}
                    </span>
                    <span className="text-[#2b2a4a]">{Math.round(t.meter)} m</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#fff3d6] overflow-hidden border border-[#f0dfb4]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: t.warna }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Kartu Kuis HP (.scr) */}
        <section
          className="bk-card flex-1 flex flex-col justify-between border-[3px]"
          style={{ borderColor: myTeam.warna }}
        >
          {soalAktif ? (
            <div>
              <QuestionTimerBar
                presentationKey={soalAktif.presentationId}
                durationSec={soalDurasiSec}
                initialRemainingMs={initialSoalRemainingMs}
                active={!isPaused && stage === 'PLAYING' && !sudahKirim && !feedback}
                onTimeout={handleTimeoutSoal}
                leftContent={
                  <>
                    Soal #{soalAktif.nomorSoal}
                    {soalAktif.totalSoalTemplate ? ` / ${soalAktif.totalSoalTemplate}` : ''}
                  </>
                }
                rightSuffix={` • ${Math.round(myTeam.meter)} m`}
              />

              {errorBanner && (
                <div className="mb-3 bg-[#fde0e0] border border-[#f4b6b6] text-[#991b1b] text-xs font-bold rounded-xl px-3 py-2">
                  {errorBanner}
                </div>
              )}

              {(activeConfig.keseimbanganAktif ||
                activeConfig.bonusStreakAktif ||
                activeConfig.rintanganAktif) && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px] font-extrabold">
                  {activeConfig.keseimbanganAktif && (
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800">
                      Keseimbangan: {myState.keseimbangan}%
                    </span>
                  )}
                  {activeConfig.bonusStreakAktif && (
                    <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800">
                      Streak: {myState.streakSaatIni}
                    </span>
                  )}
                  {activeConfig.rintanganAktif && myState.efekAktif?.perisai && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
                      Perisai Aktif
                    </span>
                  )}
                  {activeConfig.rintanganAktif && myState.efekAktif?.lompatanKuat && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                      Lompatan Kuat Siap
                    </span>
                  )}
                  {activeConfig.rintanganAktif && myState.efekAktif?.jalanBerlumpur && (
                    <span className="px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
                      Jalan Berlumpur
                    </span>
                  )}
                </div>
              )}

              <h2 className="bk-h text-lg sm:text-xl font-extrabold text-[#2b2a4a] leading-snug mb-3">
                {soalAktif.teks}
              </h2>

              <div className="space-y-2">
                {soalAktif.pilihan.map((opt) => {
                  const isCorrectHighlight = feedback && opt.key === feedback.kunciKey;
                  const isWrongHighlight =
                    feedback && !feedback.benar && choiceDipilih === opt.choiceId;

                  return (
                    <button
                      key={opt.choiceId}
                      type="button"
                      disabled={sudahKirim || Boolean(feedback) || isPaused}
                      onClick={() => handlePilihJawaban(opt)}
                      className={`bk-opt w-full !p-3 ${
                        isCorrectHighlight ? 'ok' : isWrongHighlight ? 'no' : ''
                      }`}
                    >
                      <span className="bk-opt-k !w-7 !h-7 !text-xs">{opt.key}</span>
                      <span className="text-sm leading-snug">{opt.teks}</span>
                    </button>
                  );
                })}
              </div>

              <div
                className={`min-h-[1.6em] mt-3 bk-h text-sm font-extrabold ${
                  feedback
                    ? feedback.benar
                      ? 'text-[#1f9d55]'
                      : 'text-[#d63b3b]'
                    : 'text-[#6b6a85]'
                }`}
                aria-live="polite"
              >
                {feedback
                  ? (() => {
                      const extras: string[] = [];
                      if (feedback.bonusStreakJarakDidapat) {
                        extras.push(`Streak +${feedback.bonusStreakJarakDidapat}m`);
                      }
                      if (feedback.bonusLompatanKuatDidapat) {
                        extras.push(`Lompat Kuat +${feedback.bonusLompatanKuatDidapat}m`);
                      }
                      if (feedback.penaltiJalanBerlumpurDipakai) {
                        extras.push(`Lumpur -${feedback.penaltiJalanBerlumpurDipakai}m`);
                      }
                      if (feedback.terjatuh) {
                        extras.push(
                          feedback.perisaiDigunakan
                            ? 'Perisai menahan jatuh!'
                            : 'Terjatuh (keseimbangan 0%)'
                        );
                      }
                      if (feedback.rintanganBaru?.judul) {
                        extras.push(feedback.rintanganBaru.judul);
                      }
                      const suffix = extras.length > 0 ? ` (${extras.join(' · ')})` : '';
                      const stepStr =
                        typeof feedback.stepTim === 'number' && feedback.stepTim !== 0
                          ? ` (${feedback.stepTim > 0 ? '+' : ''}${feedback.stepTim.toFixed(1)} m)`
                          : '';
                      if (feedback.benar) {
                        return `Benar! ${myTeam.nama} maju${stepStr}${suffix}.`;
                      }
                      if (feedback.timedOut) {
                        return `Waktu habis! ${myTeam.nama} tersandung${stepStr}${suffix}.`;
                      }
                      return `Salah! ${myTeam.nama} tersandung (${feedback.stumbleQuote || 'Aduh!'})${stepStr}${suffix}.`;
                    })()
                  : sudahKirim
                  ? 'Memeriksa jawaban...'
                  : `Jawab sebelum waktu habis!`}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-[#e2312d] mx-auto" />
              <p className="text-sm font-extrabold text-[#2b2a4a]">
                Menunggu soal pertama dari guru...
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Overlay Jeda oleh Guru */}
      {isPaused && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
          <div className="bg-[#fffdf6] border-[3px] border-[#ffb81c] rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-[#fff3c4] border-2 border-[#ffb81c] flex items-center justify-center mx-auto text-[#d97706] shadow-inner">
              <Pause className="w-8 h-8 fill-current" />
            </div>
            <h2 className="bk-h text-xl font-extrabold text-[#2b2a4a]">
              Permainan Dijeda
            </h2>
            <p className="text-xs font-bold text-[#6b6a85] leading-relaxed">
              Guru sedang menjeda permainan untuk sementara waktu. Waktu kuis dan langkah perlombaan dihentikan sejenak.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f4ebd0] text-[#7a5200] text-[11px] font-extrabold">
              <span className="w-2 h-2 rounded-full bg-[#d97706] animate-pulse" />
              Menunggu guru melanjutkan...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
