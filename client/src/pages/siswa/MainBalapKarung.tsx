import { useState, useEffect, useRef, useMemo } from 'react';
import { getSocket } from '../../lib/socket';
import { bindStudentReconnect } from '../../lib/socketReconnect';
import { soundEffects } from '../../lib/soundEffects';
import { BalapSackSvg } from '../../components/BalapKarungStadium';
import { LogOut, Trophy, Clock, Users, Volume2, VolumeX, Loader2 } from 'lucide-react';

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
  };
  initialStatus?: string;
  initialPesertaState?: PesertaBalapData;
  initialLeaderboard?: PesertaBalapData[];
  initialTeams?: RingkasanTimSiswa[];
  initialSoalAktif?: SoalBalapData | null;
  onKeluar: () => void;
}

interface FeedbackSiswaState {
  benar: boolean;
  timedOut?: boolean;
  stumbleQuote?: string | null;
  stepTim?: number;
  kunciKey: string;
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
  const defaultTimerDetik = Math.max(5, activeConfig?.waktuPerSoalDetik ?? 10);

  const [stage, setStage] = useState<'LOBBY' | 'PLAYING' | 'SELESAI'>(
    initialStatus === 'jalan' ? 'PLAYING' : initialStatus === 'selesai' ? 'SELESAI' : 'LOBBY'
  );
  const [teams, setTeams] = useState<RingkasanTimSiswa[]>(initialTeams);
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
  const [hasilAkhir, setHasilAkhir] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(soundEffects.getMuted());

  // Timer hitung mundur soal di HP siswa
  const [remainingMs, setRemainingMs] = useState<number>(defaultTimerDetik * 1000);
  const totalQuestionMsRef = useRef<number>(defaultTimerDetik * 1000);
  const timeoutSentRef = useRef<string | null>(null);

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
        const self = data.leaderboard.find((p) => p.id === pesertaId);
        if (self) setMyState((prev) => ({ ...prev, ...self }));
      }
      setFeedback(null);
      setChoiceDipilih(null);
      setSudahKirim(false);
      timeoutSentRef.current = null;
      setStage('PLAYING');
      soundEffects.playWhistle();
    };

    const handleSoalTampil = (data: SoalBalapData) => {
      setSoalAktif(data);
      setChoiceDipilih(null);
      setSudahKirim(false);
      setFeedback(null);
      timeoutSentRef.current = null;

      const durasiSec = Math.max(5, data.waktuPerSoalDetik || defaultTimerDetik);
      const totalMs = durasiSec * 1000;
      totalQuestionMsRef.current = totalMs;

      if (data.berakhirPadaMs && data.berakhirPadaMs > Date.now()) {
        setRemainingMs(Math.min(totalMs, Math.max(0, data.berakhirPadaMs - Date.now())));
      } else {
        setRemainingMs(totalMs);
      }
    };

    const handleBalapUpdate = (data: {
      teams?: RingkasanTimSiswa[];
      leaderboard?: PesertaBalapData[];
    }) => {
      if (data.teams) setTeams(data.teams);
      if (data.leaderboard) {
        const self = data.leaderboard.find((p) => p.id === pesertaId);
        if (self) setMyState((prev) => ({ ...prev, ...self }));
      }
    };

    const handleJawabHasil = (data: any) => {
      if (data.game && data.game !== 'balap_karung') return;
      if (data.pesertaUpdated) {
        setMyState((prev) => ({ ...prev, ...data.pesertaUpdated }));
      }
      if (data.teams) setTeams(data.teams);

      const benar = Boolean(data.benar);
      setFeedback({
        benar,
        timedOut: Boolean(data.timedOut),
        stumbleQuote: data.stumbleQuote || null,
        stepTim: typeof data.stepTim === 'number' ? data.stepTim : undefined,
        kunciKey: String(data.kunciKey || data.jawabanBenar || ''),
      });

      if (benar) soundEffects.playCorrect();
      else soundEffects.playIncorrect();
    };

    const handleSesiSelesai = (data: { game?: string; hasil?: any }) => {
      if (data.game && data.game !== 'balap_karung') return;
      if (data.hasil) {
        setHasilAkhir(data.hasil);
        if (data.hasil.teams) setTeams(data.hasil.teams);
      }
      setStage('SELESAI');
      soundEffects.playVictoryFanfare();
    };

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('game:mulai', handleGameMulai);
    socket.on('soal:tampil', handleSoalTampil);
    socket.on('balap:update', handleBalapUpdate);
    socket.on('jawab:hasil', handleJawabHasil);
    socket.on('sesi:selesai', handleSesiSelesai);

    return () => {
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('soal:tampil', handleSoalTampil);
      socket.off('balap:update', handleBalapUpdate);
      socket.off('jawab:hasil', handleJawabHasil);
      socket.off('sesi:selesai', handleSesiSelesai);
    };
  }, [pesertaId, defaultTimerDetik]);

  // Sinkronkan juga fallback initialLeaderboard bila initialTeams belum ada
  useEffect(() => {
    if (initialLeaderboard.length > 0 && myState.tim === undefined) {
      const self = initialLeaderboard.find((p) => p.id === pesertaId);
      if (self) setMyState((prev) => ({ ...prev, ...self }));
    }
  }, [initialLeaderboard, pesertaId, myState.tim]);

  // Jalankan timer hitung mundur saat bermain & soal aktif belum dijawab
  useEffect(() => {
    if (stage !== 'PLAYING' || !soalAktif || sudahKirim) return;

    const presId = soalAktif.presentationId;
    const durasiSec = Math.max(5, soalAktif.waktuPerSoalDetik || defaultTimerDetik);
    const fullMs = durasiSec * 1000;
    totalQuestionMsRef.current = fullMs;

    const deadlineMs =
      soalAktif.berakhirPadaMs && soalAktif.berakhirPadaMs > Date.now()
        ? soalAktif.berakhirPadaMs
        : Date.now() + fullMs;

    const tick = () => {
      const left = Math.max(0, deadlineMs - Date.now());
      setRemainingMs(left);

      if (left <= 0 && timeoutSentRef.current !== presId) {
        timeoutSentRef.current = presId;
        setSudahKirim(true);
        const socket = getSocket();
        socket.emit('jawab:kirim', {
          sessionId,
          pesertaId,
          pesertaSecret,
          presentationId: soalAktif.presentationId,
          questionId: soalAktif.questionId,
          timedOut: true,
        });
      }
    };

    tick();
    const interval = window.setInterval(tick, 50);
    return () => window.clearInterval(interval);
  }, [stage, soalAktif, sudahKirim, defaultTimerDetik, sessionId, pesertaId, pesertaSecret]);

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

  const handlePilihJawaban = (opsi: PilihanBalap) => {
    if (sudahKirim || !soalAktif) return;

    setChoiceDipilih(opsi.choiceId);
    setSudahKirim(true);

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
        <button
          type="button"
          onClick={() => setIsMuted(soundEffects.toggleMute())}
          className="p-2 rounded-xl bg-[#fff3d6] border border-[#f0dfb4] text-[#2b2a4a] cursor-pointer"
          aria-label={isMuted ? 'Nyalakan suara' : 'Bisukan suara'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={onKeluar}
          className="p-2 rounded-xl bg-[#fde0e0] border border-[#f4b6b6] text-[#8a1f1f] cursor-pointer"
          aria-label="Keluar sesi"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );

  // =========================================================================
  // 1. TAHAP LOBI SISWA
  // =========================================================================
  if (stage === 'LOBBY') {
    return (
      <div className="bk-festival p-4 flex flex-col justify-between gap-4 select-none">
        {renderTopBar()}

        <main className="w-full max-w-md mx-auto my-auto space-y-4">
          <div
            className="bk-card text-center space-y-3 border-[3px]"
            style={{ borderColor: myTeam.warna }}
          >
            <div className="flex justify-center">
              <BalapSackSvg shirtColor={myTeam.warna} up className="w-24 h-auto" />
            </div>
            <span
              className="inline-block px-3.5 py-1 rounded-full text-xs font-extrabold text-white"
              style={{ background: myTeam.warna }}
            >
              Kamu anggota {myTeam.nama}
            </span>
            <h1 className="bk-h text-2xl font-extrabold text-[#2b2a4a]">
              Halo, {nama}!
            </h1>
            <p className="text-xs font-bold text-[#6b6a85]">
              Jawab secepat dan setepat mungkin saat lomba dimulai agar {myTeam.nama} mencapai garis finis {targetJarak} m pertama kali.
            </p>

            {myTeam.anggota.length > 0 && (
              <div className="bg-[#fff3d6] border-2 border-[#f0dfb4] rounded-2xl p-3 text-left space-y-1.5">
                <div className="text-[11px] font-extrabold text-[#6b6a85] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Rekan Satu Tim ({myTeam.anggota.length}):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {myTeam.anggota.map((m) => (
                    <span
                      key={m.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${
                        m.id === pesertaId
                          ? 'bg-[#2b2a4a] text-[#fff3d6] border-[#2b2a4a]'
                          : 'bg-white text-[#2b2a4a] border-[#f0dfb4]'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: myTeam.warna }}
                      />
                      {m.nama}
                      {m.id === pesertaId ? ' (Kamu)' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1 flex items-center justify-center gap-2 text-xs font-extrabold text-[#7a5200]">
              <Loader2 className="w-4 h-4 animate-spin text-[#e2312d]" />
              Menunggu guru menekan tombol Mulai lomba...
            </div>
          </div>
        </main>

        <footer className="text-center text-[11px] font-bold text-[#6b6a85]">
          Target Garis Finis: {targetJarak} m • Batas Waktu: {defaultTimerDetik} detik / soal
        </footer>
      </div>
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
              onClick={onKeluar}
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
  const timerRatio = Math.max(
    0,
    Math.min(1, totalQuestionMsRef.current > 0 ? remainingMs / totalQuestionMsRef.current : 0)
  );
  const sisaDetik = Math.max(0, Math.ceil(remainingMs / 1000));

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
              <div className="flex items-center justify-between text-xs font-extrabold text-[#6b6a85] mb-2">
                <span>
                  Soal #{soalAktif.nomorSoal}
                  {soalAktif.totalSoalTemplate ? ` / ${soalAktif.totalSoalTemplate}` : ''}
                </span>
                <span className="inline-flex items-center gap-1 text-[#2b2a4a] font-mono">
                  <Clock className="w-3.5 h-3.5 text-[#ffb81c]" />
                  {sisaDetik} dtk • {Math.round(myTeam.meter)} m
                </span>
              </div>

              <div className="bk-tbar !h-2.5 !mb-3">
                <div
                  className="bk-tbar-fill"
                  style={{ transform: `scaleX(${timerRatio})`, transition: 'none' }}
                />
              </div>

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
                      disabled={sudahKirim}
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
                  ? feedback.benar
                    ? `Benar! ${myTeam.nama} maju${
                        typeof feedback.stepTim === 'number'
                          ? ` (+${feedback.stepTim.toFixed(1)} m)`
                          : ''
                      }.`
                    : feedback.timedOut
                    ? `Waktu habis! ${myTeam.nama} tersandung.`
                    : `Salah! ${myTeam.nama} tersandung (${feedback.stumbleQuote || 'Aduh!'}).`
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
    </div>
  );
}
