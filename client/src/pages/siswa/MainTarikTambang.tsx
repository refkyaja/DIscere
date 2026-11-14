import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '../../lib/socket';
import { bindStudentReconnect, createAnswerWatchdogs } from '../../lib/socketReconnect';
import { QuestionTimerBar, computeInitialRemainingMs } from '../../components';
import { isStaleQuestionErrorMessage } from '../../lib/soloSessionSync';
import { soundEffects, useGameSoundLifecycle } from '../../lib/soundEffects';
import RuangTungguSiswa from './RuangTungguSiswa';
import '../../components/tarikTambangFestival.css';
import '../../components/balapKarungFestival.css';
import {
  Clock,
  Flame,
  Loader2,
  LogOut,
  Pause,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

export interface PesertaTarikSiswa {
  id: string;
  nama: string;
  tim: 'merah' | 'putih' | null;
  connected?: boolean;
  totalBenar?: number;
  totalSalah?: number;
  jumlahJawab?: number;
  akurasiPersen?: number;
  streakSaatIni?: number;
  streakTertinggi?: number;
}

export interface PilihanTarikSiswa {
  choiceId: string;
  label: 'A' | 'B' | 'C' | 'D' | 'E';
  teks: string;
}

export interface SoalTarikData {
  presentationId: string;
  id?: string;
  questionId: string;
  nomorSoal: number;
  kesulitan?: 'mudah' | 'sedang' | 'sulit';
  teks: string;
  pilihan: PilihanTarikSiswa[];
  endsAt?: number;
  duration?: number;
  matchEndsAt?: number | null;
  serverNowMs?: number;
  serverOffsetMs?: number;
}

export interface PesertaStatTarik {
  totalBenar: number;
  totalSalah: number;
  jumlahJawab: number;
  akurasiPersen: number;
  streakSaatIni: number;
  streakTertinggi: number;
}

export interface PowerUpTimState {
  bank: string | null;
  aktifBerikutnya: string | null;
}

export interface TarikConfigSiswa {
  namaTim1?: string;
  namaTim2?: string;
  batasMenang?: number;
  waktuPerSoalDetik?: number;
  durasiLombaDetik?: number;
  powerUpAktif?: boolean;
  bonusAktif?: boolean;
}

interface FeedbackTarikState {
  benar: boolean;
  timedOut?: boolean;
  slipQuote?: string | null;
  deltaTali: number;
  jawabanBenarKode?: string;
  jawabanBenarTeks?: string;
  correctChoiceId?: string;
  penjelasan?: string | null;
}

interface MainTarikTambangProps {
  token: string;
  nama: string;
  sessionId: string;
  pesertaId: string;
  pesertaSecret: string;
  templateJudul: string;
  config?: TarikConfigSiswa;
  initialStatus?: string;
  initialTim?: 'merah' | 'putih' | null;
  initialTaliPosition?: number;
  initialSkorMerah?: number;
  initialSkorPutih?: number;
  initialMatchEndsAt?: number | null;
  initialDaftarPeserta?: PesertaTarikSiswa[];
  initialSoalAktif?: SoalTarikData | null;
  initialPowerUpTim?: PowerUpTimState;
  initialPesertaStat?: PesertaStatTarik;
  initialHasil?: any;
  onKeluar: (pesan?: string) => void;
}

const POWER_UP_LABELS: Record<string, string> = {
  double_pull: 'Tarikan 2x',
  shield: 'Tameng Tim',
};

function formatClock(secTotal: number): string {
  const sec = Math.max(0, Math.floor(secTotal));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MainTarikTambang({
  token,
  nama,
  sessionId,
  pesertaId,
  pesertaSecret,
  templateJudul,
  config,
  initialStatus = 'lobi',
  initialTim = 'merah',
  initialTaliPosition = 0,
  initialSkorMerah = 0,
  initialSkorPutih = 0,
  initialMatchEndsAt = null,
  initialDaftarPeserta = [],
  initialSoalAktif = null,
  initialPowerUpTim = { bank: null, aktifBerikutnya: null },
  initialPesertaStat = {
    totalBenar: 0,
    totalSalah: 0,
    jumlahJawab: 0,
    akurasiPersen: 0,
    streakSaatIni: 0,
    streakTertinggi: 0,
  },
  initialHasil = null,
  onKeluar,
}: MainTarikTambangProps) {
  const [activeConfig, setActiveConfig] = useState<TarikConfigSiswa>({
    namaTim1: 'Tim Merah',
    namaTim2: 'Tim Biru',
    batasMenang: 50,
    waktuPerSoalDetik: 10,
    durasiLombaDetik: 180,
    powerUpAktif: false,
    bonusAktif: false,
    ...config,
  });

  const [stage, setStage] = useState<'LOBBY' | 'PLAYING' | 'SELESAI'>(() => {
    if (initialStatus === 'jalan') return 'PLAYING';
    if (initialStatus === 'selesai') return 'SELESAI';
    return 'LOBBY';
  });

  const [myTim, setMyTim] = useState<'merah' | 'putih'>(
    initialTim === 'putih' ? 'putih' : 'merah'
  );
  const [daftarPeserta, setDaftarPeserta] = useState<PesertaTarikSiswa[]>(initialDaftarPeserta);
  const [taliPosition, setTaliPosition] = useState<number>(initialTaliPosition);
  const [skorMerah, setSkorMerah] = useState<number>(initialSkorMerah);
  const [skorPutih, setSkorPutih] = useState<number>(initialSkorPutih);
  const [matchEndsAt, setMatchEndsAt] = useState<number | null>(initialMatchEndsAt);
  const [matchRemainingSec, setMatchRemainingSec] = useState<number>(() => {
    if (initialMatchEndsAt && initialMatchEndsAt > Date.now()) {
      return Math.max(0, Math.ceil((initialMatchEndsAt - Date.now()) / 1000));
    }
    return config?.durasiLombaDetik || 180;
  });

  const [soalAktif, setSoalAktif] = useState<SoalTarikData | null>(initialSoalAktif);
  const [pickedChoiceId, setPickedChoiceId] = useState<string | null>(null);
  const [sudahKirim, setSudahKirim] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackTarikState | null>(null);
  const [pesertaStat, setPesertaStat] = useState<PesertaStatTarik>(initialPesertaStat);
  const [powerUpTim, setPowerUpTim] = useState<PowerUpTimState>(initialPowerUpTim);
  const [lastAksiToast, setLastAksiToast] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [hasilAkhir, setHasilAkhir] = useState<any>(initialHasil);
  const [isPaused, setIsPaused] = useState(false);
  const { isMuted, toggleMute } = useGameSoundLifecycle(stage === 'PLAYING', sessionId);

  const defaultQuestionSec = Math.max(5, Number(activeConfig.waktuPerSoalDetik) || 10);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const timeoutSentRef = useRef<string | null>(null);
  const watchdogsRef = useRef(createAnswerWatchdogs());
  const myTimRef = useRef(myTim);
  myTimRef.current = myTim;

  const namaTim1 = activeConfig.namaTim1 || 'Tim Merah';
  const namaTim2 = activeConfig.namaTim2 || 'Tim Biru';
  const batasMenang = Math.max(10, Number(activeConfig.batasMenang) || 50);

  const isMerah = myTim === 'merah';
  const myTeamName = isMerah ? namaTim1 : namaTim2;
  const myTeamColor = isMerah ? '#e2312d' : '#1d8fe0';

  // Sync match countdown clock smoothly (updates state only when integer second changes)
  useEffect(() => {
    if (stage !== 'PLAYING' || !matchEndsAt || isPaused) return;
    const updateClock = () => {
      const remSec = Math.max(0, Math.ceil((matchEndsAt - Date.now()) / 1000));
      setMatchRemainingSec((prev) => (prev === remSec ? prev : remSec));
    };
    updateClock();
    const id = window.setInterval(updateClock, 250);
    return () => window.clearInterval(id);
  }, [stage, matchEndsAt, isPaused]);

  // Jaminan anti-stuck: ketika siswa masuk tahap PLAYING tetapi soalAktif belum tiba
  useEffect(() => {
    if (stage !== 'PLAYING' || soalAktif) return;
    const mintaSoal = () => {
      try {
        getSocket().emit('siswa:siap_soal', { sessionId, pesertaId, token });
      } catch (err) {
        console.error('[mintaSoal error]', err);
      }
    };
    mintaSoal();
    const interval = window.setInterval(mintaSoal, 2000);
    return () => window.clearInterval(interval);
  }, [stage, soalAktif, sessionId, pesertaId, token]);

  // Listen real-time Socket.IO events for Tarik Tambang
  useEffect(() => {
    const socket = getSocket();

    const syncMyTeamFromList = (list?: PesertaTarikSiswa[]) => {
      if (!list) return;
      setDaftarPeserta(list);
      const me = list.find((p) => p.id === pesertaId);
      if (me?.tim === 'merah' || me?.tim === 'putih') {
        setMyTim(me.tim);
      }
      if (me && me.totalBenar !== undefined) {
        setPesertaStat({
          totalBenar: me.totalBenar ?? 0,
          totalSalah: me.totalSalah ?? 0,
          jumlahJawab: me.jumlahJawab ?? (me.totalBenar ?? 0) + (me.totalSalah ?? 0),
          akurasiPersen: me.akurasiPersen ?? 0,
          streakSaatIni: me.streakSaatIni ?? 0,
          streakTertinggi: me.streakTertinggi ?? 0,
        });
      }
    };

    const handleLobiUpdate = (data: {
      game?: string;
      daftarPeserta?: PesertaTarikSiswa[];
      config?: TarikConfigSiswa;
      powerUpTim1?: PowerUpTimState;
      powerUpTim2?: PowerUpTimState;
    }) => {
      if (data.game && data.game !== 'tarik_tambang') return;
      if (data.config) setActiveConfig((prev) => ({ ...prev, ...data.config }));
      syncMyTeamFromList(data.daftarPeserta);
      if (isMerah && data.powerUpTim1) setPowerUpTim(data.powerUpTim1);
      if (!isMerah && data.powerUpTim2) setPowerUpTim(data.powerUpTim2);
    };

    const handleTeamsAssigned = (data: { daftarPeserta?: PesertaTarikSiswa[] }) => {
      syncMyTeamFromList(data.daftarPeserta);
    };

    const handleGameMulai = (data: {
      game?: string;
      taliPosition?: number;
      skorMerah?: number;
      skorPutih?: number;
      matchEndsAt?: number | null;
      durasiLombaDetik?: number;
      daftarPeserta?: PesertaTarikSiswa[];
      config?: TarikConfigSiswa;
    }) => {
      if (data.game && data.game !== 'tarik_tambang') return;
      if (data.config) setActiveConfig((prev) => ({ ...prev, ...data.config }));
      if (typeof data.taliPosition === 'number') setTaliPosition(data.taliPosition);
      if (typeof data.skorMerah === 'number') setSkorMerah(data.skorMerah);
      if (typeof data.skorPutih === 'number') setSkorPutih(data.skorPutih);
      if (data.matchEndsAt) setMatchEndsAt(data.matchEndsAt);
      else if (data.durasiLombaDetik) {
        setMatchEndsAt(Date.now() + data.durasiLombaDetik * 1000);
      }
      syncMyTeamFromList(data.daftarPeserta);
      watchdogsRef.current.clearAll();
      setFeedback(null);
      setPickedChoiceId(null);
      setSudahKirim(false);
      setErrorBanner(null);
      timeoutSentRef.current = null;
      soundEffects.startGame('race');
      if (stageRef.current !== 'LOBBY') {
        setStage('PLAYING');
      }
    };

    const handleSoalTampil = (data: SoalTarikData & { game?: string }) => {
      if (data.game && data.game !== 'tarik_tambang') return;
      watchdogsRef.current.clearAll();
      const serverOffsetMs = typeof data.serverNowMs === 'number' ? data.serverNowMs - Date.now() : 0;
      setSoalAktif({
        ...data,
        id: data.id || data.questionId,
        questionId: data.questionId || data.id || '',
        serverOffsetMs,
      });
      if (data.matchEndsAt) setMatchEndsAt(data.matchEndsAt);
      setPickedChoiceId(null);
      setSudahKirim(false);
      setFeedback(null);
      setErrorBanner(null);
      timeoutSentRef.current = null;
      if (stageRef.current !== 'LOBBY') {
        setStage('PLAYING');
      }
    };

    const handleTaliUpdate = (data: {
      game?: string;
      taliPosition?: number;
      skorMerah?: number;
      skorPutih?: number;
      batasMenang?: number;
      daftarPeserta?: PesertaTarikSiswa[];
      aksi?: {
        side?: 'l' | 'r';
        action?: 'heave' | 'jerk' | 'slip';
        playerName?: string;
        timedOut?: boolean;
        deltaTali?: number;
      };
      powerUpTim1?: PowerUpTimState;
      powerUpTim2?: PowerUpTimState;
    }) => {
      if (data.game && data.game !== 'tarik_tambang') return;
      if (typeof data.taliPosition === 'number') setTaliPosition(data.taliPosition);
      if (typeof data.skorMerah === 'number') setSkorMerah(data.skorMerah);
      if (typeof data.skorPutih === 'number') setSkorPutih(data.skorPutih);
      if (typeof data.batasMenang === 'number') {
        setActiveConfig((prev) => ({ ...prev, batasMenang: data.batasMenang }));
      }
      syncMyTeamFromList(data.daftarPeserta);
      if (isMerah && data.powerUpTim1) setPowerUpTim(data.powerUpTim1);
      if (!isMerah && data.powerUpTim2) setPowerUpTim(data.powerUpTim2);

      if (data.aksi?.playerName) {
        const isCorrectPull = data.aksi.action !== 'slip';
        const teamLabel = data.aksi.side === 'l' ? namaTim1 : namaTim2;
        setLastAksiToast({
          text: isCorrectPull
            ? `${data.aksi.playerName} menarik kuat untuk ${teamLabel}!`
            : data.aksi.timedOut
            ? `${data.aksi.playerName} (${teamLabel}) kehabisan waktu!`
            : `${data.aksi.playerName} (${teamLabel}) terpeleset!`,
          ok: isCorrectPull,
        });
      }
    };

    const handlePowerUpUpdate = (data: {
      powerUpTim1?: PowerUpTimState;
      powerUpTim2?: PowerUpTimState;
    }) => {
      if (isMerah && data.powerUpTim1) setPowerUpTim(data.powerUpTim1);
      if (!isMerah && data.powerUpTim2) setPowerUpTim(data.powerUpTim2);
    };

    const handleJawabHasil = (data: {
      success?: boolean;
      game?: string;
      benar?: boolean;
      timedOut?: boolean;
      slipQuote?: string | null;
      deltaTali?: number;
      taliPosition?: number;
      skorMerah?: number;
      skorPutih?: number;
      jawabanBenarKode?: string;
      jawabanBenarTeks?: string;
      correctChoiceId?: string;
      penjelasan?: string | null;
      pesertaUpdated?: Partial<PesertaStatTarik>;
    }) => {
      if (data.game && data.game !== 'tarik_tambang') return;
      watchdogsRef.current.clearAck();
      if (typeof data.taliPosition === 'number') setTaliPosition(data.taliPosition);
      if (typeof data.skorMerah === 'number') setSkorMerah(data.skorMerah);
      if (typeof data.skorPutih === 'number') setSkorPutih(data.skorPutih);
      if (data.pesertaUpdated) {
        setPesertaStat((prev) => ({ ...prev, ...data.pesertaUpdated }));
      }

      const benar = Boolean(data.benar);
      setSudahKirim(true);
      setErrorBanner(null);
      setFeedback({
        benar,
        timedOut: Boolean(data.timedOut),
        slipQuote: data.slipQuote || null,
        deltaTali: Number(data.deltaTali || 0),
        jawabanBenarKode: data.jawabanBenarKode,
        jawabanBenarTeks: data.jawabanBenarTeks,
        correctChoiceId: data.correctChoiceId,
        penjelasan: data.penjelasan || null,
      });

      soundEffects.playTarikTambangAction({
        benar,
        isStrong: Math.abs(Number(data.deltaTali || 0)) >= 8,
        playAnswerChime: true,
      });

      watchdogsRef.current.armNextSoalFallback(socket, {
        sessionId,
        pesertaId,
        pesertaSecret,
      });
    };

    const handleSesiSelesai = (data: { game?: string; hasil?: any }) => {
      if (data.game && data.game !== 'tarik_tambang') return;
      watchdogsRef.current.clearAll();
      if (data.hasil) setHasilAkhir(data.hasil);
      setStage('SELESAI');
      const winSide = data.hasil?.timMenang || 'seri';
      const curTim = myTimRef.current;
      const isWinner = winSide !== 'seri' && winSide === curTim;
      if (data.hasil?.dihentikanManual || data.hasil?.alasanSelesai === 'manual') {
        soundEffects.stopAll();
      } else if (isWinner) {
        soundEffects.playNaturalVictory();
      } else if (winSide === 'seri') {
        soundEffects.playNaturalVictory();
      } else {
        soundEffects.playSlip();
      }
      sessionStorage.removeItem('discere_multi_token');
      sessionStorage.removeItem('discere_multi_peserta_id');
      sessionStorage.removeItem('discere_multi_nama');
      sessionStorage.removeItem('discere_multi_peserta_secret');
    };

    const handleDiKick = (data: { pesan?: string }) => {
      onKeluar(data?.pesan || 'Anda telah dikeluarkan dari lobi oleh guru.');
    };

    const handleGameJeda = (data: { game?: string }) => {
      if (data?.game && data.game !== 'tarik_tambang') return;
      setIsPaused(true);
    };

    const handleGameLanjut = (data: { game?: string; matchEndsAt?: number; pauseDuration?: number }) => {
      if (data?.game && data.game !== 'tarik_tambang') return;
      setIsPaused(false);
      if (data?.matchEndsAt) {
        setMatchEndsAt(data.matchEndsAt);
      } else if (data?.pauseDuration && matchEndsAt) {
        setMatchEndsAt((prev) => (prev ? prev + data.pauseDuration! : prev));
      }
      if (data?.pauseDuration && soalAktif?.endsAt) {
        setSoalAktif((prev) => (prev && prev.endsAt ? { ...prev, endsAt: prev.endsAt + data.pauseDuration! } : prev));
      }
    };

    const handleMainLagiSiswa = (data: { sessionId: string; token: string }) => {
      if (data?.token) {
        window.location.href = `/main?token=${encodeURIComponent(data.token)}&nama=${encodeURIComponent(nama)}`;
      }
    };

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('teams_assigned', handleTeamsAssigned);
    socket.on('game:mulai', handleGameMulai);
    socket.on('soal:tampil', handleSoalTampil);
    socket.on('tali:update', handleTaliUpdate);
    socket.on('powerup:update', handlePowerUpUpdate);
    socket.on('jawab:hasil', handleJawabHasil);
    socket.on('sesi:selesai', handleSesiSelesai);
    socket.on('sesi:dikick', handleDiKick);
    socket.on('game:jeda', handleGameJeda);
    socket.on('game:lanjut', handleGameLanjut);
    socket.on('sesi:main_lagi', handleMainLagiSiswa);

    return () => {
      watchdogsRef.current.clearAll();
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('teams_assigned', handleTeamsAssigned);
      socket.off('game:mulai', handleGameMulai);
      socket.off('soal:tampil', handleSoalTampil);
      socket.off('tali:update', handleTaliUpdate);
      socket.off('powerup:update', handlePowerUpUpdate);
      socket.off('jawab:hasil', handleJawabHasil);
      socket.off('sesi:selesai', handleSesiSelesai);
      socket.off('sesi:dikick', handleDiKick);
      socket.off('game:jeda', handleGameJeda);
      socket.off('game:lanjut', handleGameLanjut);
      socket.off('sesi:main_lagi', handleMainLagiSiswa);
    };
  }, [pesertaId, isMerah, defaultQuestionSec, namaTim1, namaTim2]);

  // Bersihkan timer watchdog setiap kali berpindah soal atau unmount
  useEffect(() => {
    return () => watchdogsRef.current.clearAll();
  }, [soalAktif?.presentationId]);

  // Reconnect guard
  useEffect(() => {
    const socket = getSocket();
    return bindStudentReconnect(socket, {
      token,
      nama,
      pesertaId,
      pesertaSecret,
      onReconnectSuccess: (res: any) => {
        if (!res?.success) return;
        if (res.config) setActiveConfig((prev) => ({ ...prev, ...res.config }));
        if (res.tim === 'merah' || res.tim === 'putih') setMyTim(res.tim);
        if (typeof res.taliPosition === 'number') setTaliPosition(res.taliPosition);
        if (typeof res.skorMerah === 'number') setSkorMerah(res.skorMerah);
        if (typeof res.skorPutih === 'number') setSkorPutih(res.skorPutih);
        if (res.matchEndsAt) setMatchEndsAt(res.matchEndsAt);
        if (res.daftarPeserta) setDaftarPeserta(res.daftarPeserta);
        if (res.powerUpTim) setPowerUpTim(res.powerUpTim);
        if (res.pesertaStat) setPesertaStat(res.pesertaStat);

        if (res.status === 'jalan') {
          setStage('PLAYING');
          if (res.soalAktif) {
            setSoalAktif((prev) =>
              prev && prev.presentationId === res.soalAktif.presentationId
                ? prev
                : {
                    ...res.soalAktif,
                    id: res.soalAktif.id || res.soalAktif.questionId,
                    questionId: res.soalAktif.questionId || res.soalAktif.id || '',
                  }
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
    const presId = soalAktif.presentationId;
    if (timeoutSentRef.current === presId) return;
    timeoutSentRef.current = presId;
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
        presentationId: presId,
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

  const handlePilihJawaban = (opsi: PilihanTarikSiswa) => {
    if (sudahKirim || Boolean(feedback) || !soalAktif || isPaused) return;

    setPickedChoiceId(opsi.choiceId);
    setSudahKirim(true);
    setErrorBanner(null);

    const socket = getSocket();
    watchdogsRef.current.armAckTimeout(() => {
      setSudahKirim(false);
      setPickedChoiceId(null);
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
        jawaban: opsi.label,
      },
      (res: any) => {
        watchdogsRef.current.clearAck();
        if (!res?.success) {
          setSudahKirim(false);
          setPickedChoiceId(null);
          const pesan = res?.pesan || 'Gagal mengirim jawaban.';
          setErrorBanner(pesan);
          if (isStaleQuestionErrorMessage(pesan)) {
            socket.emit('soal:lanjut', { sessionId, pesertaId, pesertaSecret });
          }
        }
      }
    );
  };

  const handleAktifkanPowerUp = () => {
    if (!powerUpTim.bank) return;
    getSocket().emit(
      'powerup:aktifkan',
      {
        sessionId,
        tim: myTim,
        pesertaId,
        pesertaSecret,
      },
      (res: any) => {
        if (res?.success) {
          soundEffects.playBoost();
        } else if (res?.pesan) {
          setErrorBanner(res.pesan);
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
            style={{ background: myTeamColor }}
          />
          <span className="bk-h text-sm font-extrabold text-[#2b2a4a] truncate">{nama}</span>
          <span
            className="text-[11px] font-extrabold px-2 py-0.5 rounded-full text-white"
            style={{ background: myTeamColor }}
          >
            {myTeamName}
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
            {isMuted ? <VolumeX className="w-4 h-4 text-[#d63b3b]" /> : <Volume2 className="w-4 h-4 text-[#1f9d55]" />}
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

  const initialSoalRemainingMs = useMemo(
    () =>
      computeInitialRemainingMs(
        soalAktif?.endsAt,
        Number(soalAktif?.duration || defaultQuestionSec),
        soalAktif?.serverOffsetMs || 0
      ),
    [soalAktif?.presentationId, soalAktif?.endsAt, soalAktif?.duration, soalAktif?.serverOffsetMs, defaultQuestionSec]
  );

  // =========================================================================
  // 1. TAHAP LOBI SISWA (FESTIVAL 17 AGUSTUS)
  // =========================================================================
  if (stage === 'LOBBY') {
    return (
      <RuangTungguSiswa
        token={token}
        nama={nama}
        pesertaId={pesertaId}
        gameType="tarik_tambang"
        templateJudul={templateJudul}
        config={activeConfig}
        daftarPeserta={daftarPeserta.map((p) => ({ id: p.id, nama: p.nama, tim: p.tim }))}
        teams={[
          {
            id: 'merah',
            nama: activeConfig?.namaTim1 || 'Tim Merah',
            warna: '#e2312d',
            anggota: daftarPeserta.filter((p) => p.tim === 'merah').map((p) => ({ id: p.id, nama: p.nama })),
          },
          {
            id: 'putih',
            nama: activeConfig?.namaTim2 || 'Tim Biru',
            warna: '#1d8fe0',
            anggota: daftarPeserta.filter((p) => p.tim === 'putih').map((p) => ({ id: p.id, nama: p.nama })),
          },
        ]}
        myTeamId={myTim}
        onKeluar={onKeluar}
        onMulaiPermainan={() => {
          try {
            getSocket().emit('siswa:siap_soal', { sessionId, pesertaId, token });
          } catch (err) {
            console.error('[RuangTungguSiswa onMulaiPermainan error]', err);
          }
          stageRef.current = 'PLAYING';
          setStage('PLAYING');
        }}
      />
    );
  }

  // =========================================================================
  // 2. TAHAP SELESAI (PODIUM TARIK TAMBANG)
  // =========================================================================
  if (stage === 'SELESAI') {
    const winSide: 'merah' | 'putih' | 'seri' = hasilAkhir?.timMenang || 'seri';
    const isMyTeamWinner = winSide !== 'seri' && winSide === myTim;
    const winnerName = winSide === 'merah' ? namaTim1 : winSide === 'putih' ? namaTim2 : 'Seri';
    const finalSkorMerah = hasilAkhir?.skorMerah ?? skorMerah;
    const finalSkorPutih = hasilAkhir?.skorPutih ?? skorPutih;

    const myTotalJawab = pesertaStat.totalBenar + pesertaStat.totalSalah;
    const myAkurasi =
      myTotalJawab > 0
        ? Math.round((pesertaStat.totalBenar / myTotalJawab) * 100)
        : pesertaStat.akurasiPersen;

    const alasanLabel =
      hasilAkhir?.alasanSelesai === 'waktu_habis'
        ? 'Waktu pertandingan berakhir'
        : hasilAkhir?.alasanSelesai === 'manual'
        ? 'Sesi diakhiri oleh guru'
        : 'Bendera tali melewati garis kemenangan!';

    return (
      <div className="tt-festival min-h-screen p-4 flex flex-col justify-between gap-4 select-none">
        {renderTopBar()}

        <main className="w-full max-w-md mx-auto my-auto">
          <div className="tt-panel text-center space-y-4">
            <div className="flex justify-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm"
                style={{
                  background: isMyTeamWinner ? '#fff3c4' : '#f1f5f9',
                  border: `3px solid ${isMyTeamWinner ? '#ffb81c' : '#cbd5e1'}`,
                }}
              >
                <Trophy
                  className="w-9 h-9"
                  style={{ color: isMyTeamWinner ? '#b45309' : '#64748b' }}
                />
              </div>
            </div>

            <div>
              <span className="tt-pl2">
                {winSide === 'seri'
                  ? 'Pertandingan Imbang'
                  : isMyTeamWinner
                  ? 'Tim Kamu Menang!'
                  : `${winnerName} Menang`}
              </span>
              <h2 className="tt-disp text-2xl font-extrabold text-[#2b2a4a] mt-1.5">
                {winSide === 'seri'
                  ? 'Hasil Seri!'
                  : isMyTeamWinner
                  ? `Hore, ${myTeamName} Juara!`
                  : `${winnerName} Unggul!`}
              </h2>
              <p className="text-xs font-bold text-[#6b6a85] mt-0.5">{alasanLabel}</p>
            </div>

            {/* Statistik Pribadi */}
            <div className="grid grid-cols-3 gap-2 bg-[#fff3d6] border-2 border-[#f0dfb4] rounded-2xl p-3">
              <div>
                <div className="tt-disp text-xl font-extrabold text-[#16a34a]">
                  {pesertaStat.totalBenar}
                </div>
                <div className="text-[11px] font-extrabold text-[#6b6a85]">Benar</div>
              </div>
              <div>
                <div className="tt-disp text-xl font-extrabold text-[#dc2626]">
                  {pesertaStat.totalSalah}
                </div>
                <div className="text-[11px] font-extrabold text-[#6b6a85]">Salah</div>
              </div>
              <div>
                <div className="tt-disp text-xl font-extrabold text-[#2b2a4a]">
                  {myAkurasi}%
                </div>
                <div className="text-[11px] font-extrabold text-[#6b6a85]">Akurasi</div>
              </div>
            </div>

            {/* Podium Kedua Tim */}
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className={`tt-rc ${winSide === 'merah' ? 'w' : ''}`}>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-extrabold text-[#e2312d]">{namaTim1}</span>
                  {winSide === 'merah' && <span className="tt-pl2">Juara</span>}
                </div>
                <div className="tt-big text-[#2b2a4a]">{finalSkorMerah}</div>
                <div className="text-[11px] font-bold text-[#6b6a85]">Jawaban Benar</div>
              </div>

              <div className={`tt-rc ${winSide === 'putih' ? 'w' : ''}`}>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-extrabold text-[#1d8fe0]">{namaTim2}</span>
                  {winSide === 'putih' && <span className="tt-pl2">Juara</span>}
                </div>
                <div className="tt-big text-[#2b2a4a]">{finalSkorPutih}</div>
                <div className="text-[11px] font-bold text-[#6b6a85]">Jawaban Benar</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onKeluar?.()}
              className="tt-btn w-full"
            >
              Kembali ke Halaman Awal
            </button>
          </div>
        </main>

        <div />
      </div>
    );
  }

  // =========================================================================
  // 3. TAHAP BERMAIN (.tt-phone KONTINU REAL-TIME)
  // =========================================================================
  return (
    <div className="bk-festival p-3 sm:p-4 flex flex-col gap-3 select-none">
      {renderTopBar()}

      <main className="w-full max-w-md mx-auto flex-1 flex flex-col gap-3">
        {/* Ringkasan Posisi Tim Mini (Gaya Balap Karung) */}
        <div className="bg-[#fffdf6] border-2 border-[#f0dfb4] rounded-2xl p-3 space-y-1.5">
          {/* Tim Merah */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[11px] font-extrabold">
              <span className="flex items-center gap-1.5 text-[#2b2a4a]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e2312d]" />
                {namaTim1} {isMerah ? '★' : ''}
              </span>
              <span className="text-[#2b2a4a]">{skorMerah} m</span>
            </div>
            <div className="h-2 rounded-full bg-[#fff3d6] overflow-hidden border border-[#f0dfb4]">
              <div
                className="h-full rounded-full transition-all duration-300 bg-[#e2312d]"
                style={{
                  width: `${Math.max(0, Math.min(100, (taliPosition / batasMenang) * 100))}%`,
                }}
              />
            </div>
          </div>

          {/* Tim Putih/Biru */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[11px] font-extrabold">
              <span className="flex items-center gap-1.5 text-[#2b2a4a]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1d8fe0]" />
                {namaTim2} {!isMerah ? '★' : ''}
              </span>
              <span className="text-[#2b2a4a]">{skorPutih} m</span>
            </div>
            <div className="h-2 rounded-full bg-[#fff3d6] overflow-hidden border border-[#f0dfb4]">
              <div
                className="h-full rounded-full transition-all duration-300 bg-[#1d8fe0]"
                style={{
                  width: `${Math.max(0, Math.min(100, (-taliPosition / batasMenang) * 100))}%`,
                }}
              />
            </div>
          </div>

          {matchEndsAt && matchRemainingSec > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-[#f0dfb4]/60 text-[10px] font-extrabold text-[#6b6a85]">
              <span>Sisa Waktu Lomba:</span>
              <span className="font-mono text-[#2b2a4a] flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#e2312d]" />
                {formatClock(matchRemainingSec)}
              </span>
            </div>
          )}

          {lastAksiToast && (
            <div
              className={`text-[11px] font-bold text-center truncate pt-1 border-t border-[#f0dfb4]/60 ${
                lastAksiToast.ok ? 'text-[#166534]' : 'text-[#991b1b]'
              }`}
            >
              {lastAksiToast.text}
            </div>
          )}
        </div>

        {/* Kartu Soal Kuis */}
        <section
          className="bk-card flex-1 flex flex-col justify-between border-[3px]"
          style={{ borderColor: myTeamColor }}
        >
          {soalAktif ? (
            <div>
              <QuestionTimerBar
                presentationKey={soalAktif.presentationId}
                durationSec={Math.max(5, Number(soalAktif.duration || defaultQuestionSec))}
                initialRemainingMs={initialSoalRemainingMs}
                active={!isPaused && stage === 'PLAYING' && !sudahKirim && !feedback}
                onTimeout={handleTimeoutSoal}
                leftContent={<>Soal #{soalAktif.nomorSoal}</>}
                rightSuffix={` • ${isMerah ? skorMerah : skorPutih} m`}
              />

              {errorBanner && (
                <div className="mb-3 bg-[#fde0e0] border border-[#f4b6b6] text-[#991b1b] text-xs font-bold rounded-xl px-3 py-2">
                  {errorBanner}
                </div>
              )}

              {(pesertaStat.streakSaatIni >= 2 ||
                (activeConfig.powerUpAktif && (powerUpTim.bank || powerUpTim.aktifBerikutnya))) && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px] font-extrabold">
                  {pesertaStat.streakSaatIni >= 2 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 flex items-center gap-1">
                      <Flame className="w-3 h-3 fill-current text-orange-500" />
                      Streak: {pesertaStat.streakSaatIni}
                    </span>
                  )}
                  {activeConfig.powerUpAktif &&
                    (powerUpTim.bank || powerUpTim.aktifBerikutnya) && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                        <Zap className="w-3 h-3 text-amber-600" />
                        <span>
                          {powerUpTim.aktifBerikutnya
                            ? `Aktif: ${POWER_UP_LABELS[powerUpTim.aktifBerikutnya] || powerUpTim.aktifBerikutnya}`
                            : `Siap: ${POWER_UP_LABELS[powerUpTim.bank || ''] || powerUpTim.bank}`}
                        </span>
                        {powerUpTim.bank && !powerUpTim.aktifBerikutnya && (
                          <button
                            type="button"
                            onClick={handleAktifkanPowerUp}
                            className="ml-1 text-[10px] underline font-black text-amber-900 cursor-pointer"
                          >
                            Gunakan
                          </button>
                        )}
                      </div>
                    )}
                </div>
              )}

              <h2 className="bk-h text-lg sm:text-xl font-extrabold text-[#2b2a4a] leading-snug mb-3">
                {soalAktif.teks}
              </h2>

              <div className="space-y-2">
                {soalAktif.pilihan.map((opt) => {
                  const isCorrectOption =
                    Boolean(feedback) &&
                    (feedback?.correctChoiceId === opt.choiceId ||
                      feedback?.jawabanBenarKode === opt.label);
                  const isWrongHighlight =
                    Boolean(feedback) && !feedback?.benar && pickedChoiceId === opt.choiceId;

                  return (
                    <button
                      key={opt.choiceId}
                      type="button"
                      disabled={sudahKirim || Boolean(feedback) || isPaused}
                      onClick={() => handlePilihJawaban(opt)}
                      className={`bk-opt w-full !p-3 ${
                        isCorrectOption ? 'ok' : isWrongHighlight ? 'no' : ''
                      }`}
                    >
                      <span className="bk-opt-k !w-7 !h-7 !text-xs">{opt.label}</span>
                      <span className="text-sm leading-snug text-left flex-1">{opt.teks}</span>
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
                {feedback ? (
                  <div>
                    {feedback.benar
                      ? `Tarikan mantap untuk ${myTeamName}! (+${feedback.deltaTali || 1} m)`
                      : feedback.timedOut
                      ? `Waktu habis! Jawaban benar: ${feedback.jawabanBenarKode || '-'}`
                      : `${feedback.slipQuote || 'Terpeleset!'} Kunci: ${
                          feedback.jawabanBenarKode || '-'
                        }`}
                    {feedback.penjelasan && (
                      <div className="text-xs text-[#2b2a4a] font-normal mt-1 opacity-90">
                        {feedback.penjelasan}
                      </div>
                    )}
                  </div>
                ) : sudahKirim ? (
                  <div className="text-[#6b6a85] text-xs flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengirim jawaban...</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 text-center text-xs font-bold text-[#6b6a85]">
                Jawab sebelum waktu habis!
              </div>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-[#6b6a85]">
              <Loader2 className="w-6 h-6 animate-spin text-[#e2312d]" />
              <span className="text-sm font-extrabold">Menyiapkan soal berikutnya...</span>
            </div>
          )}
        </section>
      </main>

      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-[#fffdf6] border-4 border-[#2b2a4a] rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#fff0c9] border-2 border-[#f3d37a] flex items-center justify-center text-[#7a5200]">
              <Pause className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-extrabold text-[#2b2a4a]">Permainan Dijeda Guru</h3>
            <p className="text-xs font-bold text-[#6b6a85] leading-relaxed">
              Guru sedang menjeda permainan untuk sementara waktu. Harap tunggu hingga guru melanjutkan lomba.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
