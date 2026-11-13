import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '../../lib/socket';
import { bindStudentReconnect, createAnswerWatchdogs } from '../../lib/socketReconnect';
import { QuestionTimerBar, computeInitialRemainingMs } from '../../components';
import { isStaleQuestionErrorMessage } from '../../lib/soloSessionSync';
import { soundEffects, useGameSoundLifecycle } from '../../lib/soundEffects';
import { TarikAvatarSvg } from '../../components/TarikTambangStadium';
import RuangTungguSiswa from './RuangTungguSiswa';
import '../../components/tarikTambangFestival.css';
import {
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  LogOut,
  Trophy,
  Volume2,
  VolumeX,
  XCircle,
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
  const { isMuted, toggleMute } = useGameSoundLifecycle(stage === 'PLAYING', sessionId);

  const defaultQuestionSec = Math.max(5, Number(activeConfig.waktuPerSoalDetik) || 10);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const timeoutSentRef = useRef<string | null>(null);
  const watchdogsRef = useRef(createAnswerWatchdogs());

  const namaTim1 = activeConfig.namaTim1 || 'Tim Merah';
  const namaTim2 = activeConfig.namaTim2 || 'Tim Biru';
  const batasMenang = Math.max(10, Number(activeConfig.batasMenang) || 50);

  const isMerah = myTim === 'merah';
  const myTeamName = isMerah ? namaTim1 : namaTim2;
  const myTeamColor = isMerah ? '#e2312d' : '#1d8fe0';

  // Sync match countdown clock smoothly (updates state only when integer second changes)
  useEffect(() => {
    if (stage !== 'PLAYING' || !matchEndsAt) return;
    const updateClock = () => {
      const remSec = Math.max(0, Math.ceil((matchEndsAt - Date.now()) / 1000));
      setMatchRemainingSec((prev) => (prev === remSec ? prev : remSec));
    };
    updateClock();
    const id = window.setInterval(updateClock, 250);
    return () => window.clearInterval(id);
  }, [stage, matchEndsAt]);

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
      if (data.hasil?.dihentikanManual || data.hasil?.alasanSelesai === 'manual') {
        soundEffects.stopAll();
      } else {
        soundEffects.playNaturalVictory();
      }
      sessionStorage.removeItem('discere_multi_token');
      sessionStorage.removeItem('discere_multi_peserta_id');
      sessionStorage.removeItem('discere_multi_nama');
      sessionStorage.removeItem('discere_multi_peserta_secret');
    };

    const handleDiKick = (data: { pesan?: string }) => {
      onKeluar(data?.pesan || 'Anda telah dikeluarkan dari lobi oleh guru.');
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
    if (sudahKirim || Boolean(feedback) || !soalAktif) return;

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
          <span className="tt-disp text-sm font-extrabold text-[#2b2a4a] truncate">{nama}</span>
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
            className="tt-ib"
            aria-label={isMuted ? 'Nyalakan suara' : 'Bisukan suara'}
            title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => onKeluar?.()}
          className="tt-ib danger"
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
        myTeamId={myTim}
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
  const ratio = Math.max(-1, Math.min(1, taliPosition / batasMenang));
  const dotLeftPct = Number((50 - ratio * 44).toFixed(2));
  const isTimeWarning = matchRemainingSec > 0 && matchRemainingSec <= 15;

  return (
    <div className="tt-festival min-h-screen p-3 sm:p-4 flex flex-col justify-between gap-3 select-none">
      {renderTopBar()}

      <main className="w-full max-w-md mx-auto my-auto">
        <div className="tt-phone">
          <div className="tt-scr space-y-3">
            {/* Baris Info Tim + Timer Lomba */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b-2 border-[#f0dfb4]">
              <div className="flex items-center gap-2 min-w-0">
                <TarikAvatarSvg
                  color={myTeamColor}
                  side={isMerah ? 'l' : 'r'}
                  size={34}
                />
                <div className="min-w-0">
                  <div className="tt-disp text-sm font-extrabold text-[#2b2a4a] truncate">
                    {myTeamName}
                  </div>
                  <div className="text-[11px] font-bold text-[#6b6a85] flex items-center gap-2">
                    <span>Benar: {pesertaStat.totalBenar}</span>
                    {pesertaStat.streakSaatIni >= 2 && (
                      <span className="inline-flex items-center gap-0.5 text-[#c2540a]">
                        <Flame className="w-3 h-3" /> {pesertaStat.streakSaatIni}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <span className={`tt-chip flex items-center gap-1 ${isTimeWarning ? 'red' : 'gold'}`}>
                <Clock className="w-3.5 h-3.5" />
                {formatClock(matchRemainingSec)}
              </span>
            </div>

            {/* Indikator Tali Mini */}
            <div className="bg-[#fff3d6] border border-[#f0dfb4] rounded-2xl px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-extrabold">
                <span className="text-[#e2312d]">
                  {namaTim1}: {skorMerah}
                </span>
                <span className="text-[#6b6a85]">
                  Posisi: {taliPosition > 0 ? `+${Math.round(taliPosition)}` : Math.round(taliPosition)}
                </span>
                <span className="text-[#1d8fe0]">
                  {skorPutih} :{namaTim2}
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-[#e9dcc0] border border-white">
                <span
                  className="absolute top-1/2 -translate-y-1/2 -ml-2 w-4 h-4 rounded-full border-2 border-white shadow-xs transition-[left] duration-500"
                  style={{ left: `${dotLeftPct}%`, background: '#e2312d' }}
                />
              </div>
              {lastAksiToast && (
                <div
                  className={`text-[11px] font-bold text-center truncate ${
                    lastAksiToast.ok ? 'text-[#166534]' : 'text-[#991b1b]'
                  }`}
                >
                  {lastAksiToast.text}
                </div>
              )}
            </div>

            {/* Power-Up Tim Opsional (Jika Diaktifkan Guru) */}
            {activeConfig.powerUpAktif && (powerUpTim.bank || powerUpTim.aktifBerikutnya) && (
              <div className="flex items-center justify-between gap-2 bg-[#fef3c7] border border-[#fcd34d] rounded-xl px-3 py-1.5">
                <span className="text-xs font-extrabold text-[#92400e] flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  {powerUpTim.aktifBerikutnya
                    ? `Aktif: ${POWER_UP_LABELS[powerUpTim.aktifBerikutnya] || powerUpTim.aktifBerikutnya}`
                    : `Power-Up Siap: ${POWER_UP_LABELS[powerUpTim.bank || ''] || powerUpTim.bank}`}
                </span>
                {powerUpTim.bank && !powerUpTim.aktifBerikutnya && (
                  <button
                    type="button"
                    onClick={handleAktifkanPowerUp}
                    className="tt-btn y sm"
                  >
                    Aktifkan
                  </button>
                )}
              </div>
            )}

            {errorBanner && (
              <div className="bg-[#fde0e0] border border-[#f4b6b6] text-[#991b1b] text-xs font-bold rounded-xl px-3 py-2">
                {errorBanner}
              </div>
            )}

            {/* Soal & Countdown 10 Detik */}
            {soalAktif ? (
              <div className="space-y-2.5">
                <QuestionTimerBar
                  variant="tt"
                  presentationKey={soalAktif.presentationId}
                  durationSec={Math.max(5, Number(soalAktif.duration || defaultQuestionSec))}
                  initialRemainingMs={initialSoalRemainingMs}
                  active={stage === 'PLAYING' && !sudahKirim && !feedback}
                  onTimeout={handleTimeoutSoal}
                  questionLabel={`Soal #${soalAktif.nomorSoal}`}
                />

                <div className="tt-q" style={{ minHeight: '2.2em', marginBottom: '10px' }}>
                  {soalAktif.teks}
                </div>

                <div>
                  {soalAktif.pilihan.map((opt) => {
                    const isPicked = pickedChoiceId === opt.choiceId;
                    const isCorrectOption =
                      Boolean(feedback) &&
                      (feedback?.correctChoiceId === opt.choiceId ||
                        feedback?.jawabanBenarKode === opt.label);

                    let cls = 'tt-op';
                    if (feedback) {
                      if (isCorrectOption) cls += ' ok';
                      else if (isPicked && !feedback.benar) cls += ' no';
                    }

                    return (
                      <button
                        key={opt.choiceId}
                        type="button"
                        disabled={sudahKirim || Boolean(feedback)}
                        onClick={() => handlePilihJawaban(opt)}
                        className={cls}
                        style={{ '--c': myTeamColor } as React.CSSProperties}
                      >
                        <b>{opt.label}</b>
                        <span className="flex-1 text-sm font-extrabold leading-snug">
                          {opt.teks}
                        </span>
                        {feedback && isCorrectOption && (
                          <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
                        )}
                        {feedback && isPicked && !feedback.benar && (
                          <XCircle className="w-4 h-4 text-[#dc2626] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {feedback ? (
                  <div
                    className={`tt-fb rounded-xl px-3 py-2 text-xs ${
                      feedback.benar
                        ? 'bg-[#dcfce7] text-[#166534]'
                        : 'bg-[#fee2e2] text-[#991b1b]'
                    }`}
                  >
                    <div>
                      {feedback.benar
                        ? `Tarikan mantap untuk ${myTeamName}!`
                        : feedback.timedOut
                        ? `Waktu soal habis! Kunci jawaban: ${feedback.jawabanBenarKode || '-'}`
                        : `${feedback.slipQuote || 'Terpeleset!'} Kunci: ${
                            feedback.jawabanBenarKode || '-'
                          }`}
                    </div>
                    {feedback.penjelasan && (
                      <div className="text-[11px] font-bold opacity-90 mt-1">
                        {feedback.penjelasan}
                      </div>
                    )}
                  </div>
                ) : sudahKirim ? (
                  <div className="tt-fb text-[#6b6a85] text-xs flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Mengirim jawaban...
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center justify-center gap-2 text-xs font-extrabold text-[#6b6a85]">
                <Loader2 className="w-6 h-6 animate-spin text-[#e2312d]" />
                Menyiapkan soal pertama...
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="text-center text-[11px] font-bold text-[#6b6a85]">
        Tarik menuju Zona {myTeamName} • Target ±{batasMenang}
      </footer>
    </div>
  );
}
