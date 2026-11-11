import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { Modal } from '../../components';
import { soundEffects } from '../../lib/soundEffects';
import {
  BalapKarungStadium,
  BalapSackSvg,
  BalapHeatmapMatrix,
  BalapLaneItem,
  AnalisisHeatmapData,
} from '../../components/BalapKarungStadium';
import {
  Trophy,
  Play,
  StopCircle,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Users,
  Sliders,
} from 'lucide-react';

type KodeTim = 'merah' | 'biru' | 'hijau' | 'kuning';

interface AnggotaTimRingkas {
  id: string;
  nama: string;
  connected?: boolean;
  totalBenar: number;
  totalSalah: number;
}

interface RingkasanTimClient {
  id: KodeTim;
  nama: string;
  warna: string;
  meter: number;
  meterRaw?: number;
  targetJarak: number;
  persen: number;
  isWinner: boolean;
  selesaiPadaMs: number | null;
  anggota: AnggotaTimRingkas[];
}

interface KonfigurasiBalapHost {
  presetJarak: string;
  targetJarak: number;
  jumlahTim?: 3 | 4;
  waktuPerSoalDetik?: number;
  lompatBenar?: number;
  turunSalah?: number;
  maxPeserta?: number;
  allowLateJoin?: boolean;
}

interface LaporanTimItem {
  peringkat: number;
  id: KodeTim;
  nama: string;
  warna: string;
  meter: number;
  isWinner: boolean;
  totalBenar: number;
  totalSalah: number;
  anggota: AnggotaTimRingkas[];
}

interface LaporanAkhirBalapHost {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  konfigurasi?: KonfigurasiBalapHost;
  timPemenang?: KodeTim | null;
  namaTimPemenang?: string | null;
  totalPeserta: number;
  totalSoalTemplate: number;
  totalJawabanBenar: number;
  totalJawabanSalah: number;
  dihentikanManual?: boolean;
  laporanTim?: LaporanTimItem[];
  analisisHeatmap?: AnalisisHeatmapData;
}

const DEFAULT_TEAMS: Array<{ id: KodeTim; nama: string; warna: string }> = [
  { id: 'merah', nama: 'Tim Merah', warna: '#e2312d' },
  { id: 'biru', nama: 'Tim Biru', warna: '#1d8fe0' },
  { id: 'hijau', nama: 'Tim Hijau', warna: '#1f9d55' },
  { id: 'kuning', nama: 'Tim Kuning', warna: '#e6a100' },
];

export default function LayarHostBalapKarung() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('kembali') || '/guru';

  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [templateJudul, setTemplateJudul] = useState('Balap Karung Tim');
  const [token, setToken] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [status, setStatus] = useState<'lobi' | 'jalan' | 'selesai'>('lobi');
  const [totalPeserta, setTotalPeserta] = useState(0);
  const [config, setConfig] = useState<KonfigurasiBalapHost>({
    presetJarak: 'normal',
    targetJarak: 100,
    jumlahTim: 3,
    waktuPerSoalDetik: 10,
  });
  const [teams, setTeams] = useState<RingkasanTimClient[]>([]);
  const [timPemenang, setTimPemenang] = useState<KodeTim | null>(null);
  const [hasilAkhir, setHasilAkhir] = useState<LaporanAkhirBalapHost | null>(null);
  const [showEndSection, setShowEndSection] = useState(false);

  // Animasi & status lintasan real-time per tim & per anggota
  const [memberPulseMap, setMemberPulseMap] = useState<Record<string, 'ok' | 'no'>>({});
  const [teamHurtMap, setTeamHurtMap] = useState<Record<string, boolean>>({});
  const [teamJumpMap, setTeamJumpMap] = useState<Record<string, boolean>>({});
  const [teamSayMap, setTeamSayMap] = useState<Record<string, string | null>>({});
  const [teamDeltaMap, setTeamDeltaMap] = useState<Record<string, number | null>>({});
  const [crowdCheer, setCrowdCheer] = useState(false);
  const [liveFeed, setLiveFeed] = useState<Array<{ id: string; teks: string; ok: boolean }>>([]);

  // Aksi UI
  const [modalAkhiriOpen, setModalAkhiriOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isMainLagi, setIsMainLagi] = useState(false);
  const [isChangingTeamCount, setIsChangingTeamCount] = useState(false);
  const [isMuted, setIsMuted] = useState(soundEffects.getMuted());
  const [copied, setCopied] = useState(false);

  const timersRef = useRef<number[]>([]);
  const endRef = useRef<HTMLElement | null>(null);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const fetchSesi = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiRequest<{
        session: {
          templateId?: string;
          templateJudul: string;
          token: string;
          qrDataUrl?: string;
          joinUrl?: string;
          status: 'lobi' | 'jalan' | 'selesai';
          totalPeserta?: number;
          config?: KonfigurasiBalapHost;
          teams?: RingkasanTimClient[];
          timPemenang?: KodeTim | null;
          hasil?: LaporanAkhirBalapHost | null;
        };
      }>(`/sesi/${id}`);

      const s = res.session;
      setTemplateId(s.templateId || '');
      setTemplateJudul(s.templateJudul);
      setToken(s.token || '');
      setQrDataUrl(s.qrDataUrl || '');
      setJoinUrl(s.joinUrl || '');
      setStatus(s.status);
      setTotalPeserta(s.totalPeserta ?? 0);
      if (s.config) setConfig(s.config);
      if (s.teams) setTeams(s.teams);
      if (s.timPemenang !== undefined) setTimPemenang(s.timPemenang);

      if (s.status === 'selesai') {
        setShowEndSection(true);
        if (s.hasil) setHasilAkhir(s.hasil);
        try {
          const hasilRes = await apiRequest<{ hasil: LaporanAkhirBalapHost }>(`/sesi/${id}/hasil`);
          if (hasilRes.hasil) setHasilAkhir(hasilRes.hasil);
        } catch {
          // Gunakan hasil awal dari GET /sesi bila sudah ada
        }
      }
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal memuat sesi Balap Karung Challenge.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSesi();
  }, [fetchSesi]);

  useEffect(() => {
    if (!id) return;
    const socket = getSocket();

    const handleConnect = () => {
      socket.emit('sesi:host_join', { sessionId: id });
    };
    handleConnect();

    const handleLobiUpdate = (data: {
      game?: string;
      totalPeserta: number;
      config?: KonfigurasiBalapHost;
      teams?: RingkasanTimClient[];
    }) => {
      if (data.game && data.game !== 'balap_karung') return;
      if (typeof data.totalPeserta === 'number') setTotalPeserta(data.totalPeserta);
      if (data.config) setConfig(data.config);
      if (data.teams) setTeams(data.teams);
    };

    const handleGameMulai = (data: {
      game?: string;
      config?: KonfigurasiBalapHost;
      teams?: RingkasanTimClient[];
    }) => {
      if (data.game && data.game !== 'balap_karung') return;
      setStatus('jalan');
      setShowEndSection(false);
      setLiveFeed([]);
      if (data.config) setConfig(data.config);
      if (data.teams) setTeams(data.teams);
      soundEffects.playWhistle();
      setCrowdCheer(true);
      scheduleTimer(() => setCrowdCheer(false), 1300);
    };

    const handleBalapUpdate = (data: {
      teams?: RingkasanTimClient[];
      totalPeserta?: number;
      terakhirAksi?: {
        pesertaId: string;
        nama: string;
        tim?: KodeTim;
        benar: boolean;
        timedOut?: boolean;
        terpeleset?: boolean;
        stumbleQuote?: string | null;
        stepTim?: number;
        timMenangId?: KodeTim | null;
        timMenangNama?: string | null;
      };
    }) => {
      if (data.teams) setTeams(data.teams);
      if (typeof data.totalPeserta === 'number') setTotalPeserta(data.totalPeserta);

      const aksi = data.terakhirAksi;
      if (aksi) {
        setMemberPulseMap((prev) => ({
          ...prev,
          [aksi.pesertaId]: aksi.benar ? 'ok' : 'no',
        }));
        scheduleTimer(() => {
          setMemberPulseMap((prev) => {
            const copy = { ...prev };
            delete copy[aksi.pesertaId];
            return copy;
          });
        }, 700);

        const timKey = aksi.tim || 'merah';
        if (aksi.benar) {
          setCrowdCheer(true);
          scheduleTimer(() => setCrowdCheer(false), 1200);
          setTeamJumpMap((prev) => ({ ...prev, [timKey]: true }));
          if (typeof aksi.stepTim === 'number' && aksi.stepTim > 0) {
            setTeamDeltaMap((prev) => ({ ...prev, [timKey]: Number(aksi.stepTim!.toFixed(1)) }));
          }
          scheduleTimer(() => {
            setTeamJumpMap((prev) => ({ ...prev, [timKey]: false }));
            setTeamDeltaMap((prev) => ({ ...prev, [timKey]: null }));
          }, 1100);
        } else {
          setTeamHurtMap((prev) => ({ ...prev, [timKey]: true }));
          setTeamSayMap((prev) => ({
            ...prev,
            [timKey]: aksi.stumbleQuote || (aksi.timedOut ? 'Waktu habis!' : 'Aduh!'),
          }));
          scheduleTimer(() => {
            setTeamHurtMap((prev) => ({ ...prev, [timKey]: false }));
            setTeamSayMap((prev) => ({ ...prev, [timKey]: null }));
          }, 1050);
        }

        if (aksi.timMenangId) {
          setTimPemenang(aksi.timMenangId);
        }

        const labelTim =
          DEFAULT_TEAMS.find((t) => t.id === timKey)?.nama || 'Tim';
        const feedText = aksi.timMenangNama
          ? `${aksi.nama} membawa ${aksi.timMenangNama} melintasi GARIS FINIS!`
          : aksi.benar
          ? `${aksi.nama} (${labelTim}) menjawab benar (+${(aksi.stepTim || 0).toFixed(1)} m)`
          : `${aksi.nama} (${labelTim}) ${
              aksi.timedOut ? 'kehabisan waktu' : 'tersandung'
            } — "${aksi.stumbleQuote || 'Aduh!'}"`;

        setLiveFeed((prev) => [
          { id: `${Date.now()}-${Math.random()}`, teks: feedText, ok: aksi.benar },
          ...prev.slice(0, 5),
        ]);
      }
    };

    const handleSesiSelesai = async (data: {
      game?: string;
      hasil?: LaporanAkhirBalapHost;
    }) => {
      if (data.game && data.game !== 'balap_karung') return;
      setStatus('selesai');
      soundEffects.playVictoryFanfare();
      setCrowdCheer(true);

      if (data.hasil) {
        setHasilAkhir(data.hasil);
        if (data.hasil.timPemenang) setTimPemenang(data.hasil.timPemenang);
      }

      try {
        const res = await apiRequest<{ hasil: LaporanAkhirBalapHost }>(`/sesi/${id}/hasil`);
        if (res.hasil) {
          setHasilAkhir(res.hasil);
          if (res.hasil.timPemenang) setTimPemenang(res.hasil.timPemenang);
        }
      } catch {
        // Fallback ke payload socket
      }

      scheduleTimer(() => {
        setShowEndSection(true);
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 1200);
    };

    socket.on('connect', handleConnect);
    socket.on('lobi:update', handleLobiUpdate);
    socket.on('game:mulai', handleGameMulai);
    socket.on('balap:update', handleBalapUpdate);
    socket.on('sesi:selesai', handleSesiSelesai);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('balap:update', handleBalapUpdate);
      socket.off('sesi:selesai', handleSesiSelesai);
    };
  }, [id, scheduleTimer]);

  const handleUbahJumlahTim = (nextJumlah: 3 | 4) => {
    if (!id || status !== 'lobi' || isChangingTeamCount) return;
    setIsChangingTeamCount(true);
    const socket = getSocket();
    socket.emit(
      'balap:ubah_jumlah_tim',
      { sessionId: id, jumlahTim: nextJumlah },
      (res: {
        success?: boolean;
        pesan?: string;
        config?: KonfigurasiBalapHost;
        teams?: RingkasanTimClient[];
      }) => {
        setIsChangingTeamCount(false);
        if (res?.success) {
          if (res.config) setConfig(res.config);
          if (res.teams) setTeams(res.teams);
        } else if (res?.pesan) {
          alert(res.pesan);
        }
      }
    );
  };

  const handleMulai = () => {
    if (!id || totalPeserta === 0 || isStarting) return;
    setIsStarting(true);
    const socket = getSocket();
    socket.emit('sesi:mulai', { sessionId: id }, (res: { success?: boolean; pesan?: string }) => {
      setIsStarting(false);
      if (!res?.success) {
        alert(res?.pesan || 'Gagal memulai lomba Balap Karung Tim.');
      }
    });
  };

  const handleAkhiriManual = () => {
    if (!id || isEnding) return;
    setIsEnding(true);
    const socket = getSocket();
    socket.emit(
      'sesi:akhiri_manual',
      { sessionId: id },
      (res: { success?: boolean; pesan?: string }) => {
        setIsEnding(false);
        setModalAkhiriOpen(false);
        if (!res?.success) {
          alert(res?.pesan || 'Gagal mengakhiri perlombaan.');
        }
      }
    );
  };

  const handleMainLagi = async (nextJumlahTim?: 3 | 4) => {
    if (!id || isMainLagi) return;
    setIsMainLagi(true);
    try {
      const res = await apiRequest<{ sessionId?: string; session?: { id: string } }>(
        `/sesi/${id}/main-lagi`,
        {
          method: 'POST',
          body: JSON.stringify({
            autoStart: false,
            ...(nextJumlahTim ? { jumlahTim: nextJumlahTim } : {}),
          }),
        }
      );
      const nextId = res.session?.id || res.sessionId;
      if (nextId) {
        navigate(`/guru/sesi/${nextId}?kembali=${encodeURIComponent(returnUrl)}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      alert(err.pesan || 'Gagal membuat sesi baru.');
    } finally {
      setIsMainLagi(false);
    }
  };

  const handleCopyLink = () => {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const targetJarak = config.targetJarak || 100;
  const jumlahTim = config.jumlahTim === 4 ? 4 : 3;

  // Pastikan lintasan selalu berurutan (Merah, Biru, Hijau, [Kuning])
  const activeTeams: RingkasanTimClient[] = useMemo(() => {
    if (teams.length > 0) {
      const order: KodeTim[] = ['merah', 'biru', 'hijau', 'kuning'];
      return [...teams].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
    return DEFAULT_TEAMS.slice(0, jumlahTim).map((t) => ({
      id: t.id,
      nama: t.nama,
      warna: t.warna,
      meter: 0,
      targetJarak,
      persen: 0,
      isWinner: false,
      selesaiPadaMs: null,
      anggota: [],
    }));
  }, [teams, jumlahTim, targetJarak]);

  // Papan peringkat tim terurut
  const rankedTeams: RingkasanTimClient[] = useMemo(() => {
    return [...activeTeams].sort((a, b) => {
      if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
      if (Math.abs(b.meter - a.meter) > 0.001) return b.meter - a.meter;
      if (a.selesaiPadaMs !== null && b.selesaiPadaMs !== null) {
        return a.selesaiPadaMs - b.selesaiPadaMs;
      }
      return 0;
    });
  }, [activeTeams]);

  const stadiumLanes: BalapLaneItem[] = useMemo(() => {
    return activeTeams.map((t) => ({
      id: t.id,
      nama: t.nama,
      warna: t.warna,
      shirtColor: t.warna,
      meter: t.meter,
      targetJarak,
      isWinner: status === 'selesai' && (t.isWinner || timPemenang === t.id),
      isRunning: status === 'jalan' && !teamHurtMap[t.id],
      isJumping: Boolean(teamJumpMap[t.id]),
      isHurt: Boolean(teamHurtMap[t.id]),
      sayBubble: teamSayMap[t.id] || null,
      deltaBadge: teamDeltaMap[t.id] ?? null,
      members: t.anggota.map((a) => ({
        id: a.id,
        nama: a.nama,
        pulse: memberPulseMap[a.id] || null,
      })),
    }));
  }, [
    activeTeams,
    targetJarak,
    status,
    timPemenang,
    teamHurtMap,
    teamJumpMap,
    teamSayMap,
    teamDeltaMap,
    memberPulseMap,
  ]);

  if (loading) {
    return (
      <div className="bk-festival flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-[#e2312d] mb-3" />
        <p className="font-extrabold text-[#2b2a4a]">Menyiapkan Lintasan Balap Karung Tim...</p>
      </div>
    );
  }

  if (errorPesan) {
    return (
      <div className="bk-festival flex items-center justify-center p-4">
        <div className="bk-card max-w-md w-full text-center space-y-4">
          <h2 className="bk-h text-2xl font-extrabold">Sesi Tidak Tersedia</h2>
          <p className="text-sm text-[#6b6a85]">{errorPesan}</p>
          <button
            type="button"
            onClick={() => navigate(returnUrl)}
            className="bk-btn w-full justify-center"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  const finalLaporanTim: LaporanTimItem[] =
    hasilAkhir?.laporanTim && hasilAkhir.laporanTim.length > 0
      ? hasilAkhir.laporanTim
      : rankedTeams.map((t, i) => ({
          peringkat: i + 1,
          id: t.id,
          nama: t.nama,
          warna: t.warna,
          meter: t.meter,
          isWinner: i === 0 || t.isWinner || timPemenang === t.id,
          totalBenar: t.anggota.reduce((acc, a) => acc + (a.totalBenar || 0), 0),
          totalSalah: t.anggota.reduce((acc, a) => acc + (a.totalSalah || 0), 0),
          anggota: t.anggota,
        }));

  const winnerTeamName =
    hasilAkhir?.namaTimPemenang || finalLaporanTim[0]?.nama || 'Tim Juara';

  return (
    <div className="bk-festival">
      <BalapKarungStadium
        title="Balap Karung Kuis"
        subtitle={`Multiplayer Tim (${templateJudul})`}
        statusLabel={
          status === 'lobi'
            ? 'Menunggu siswa'
            : status === 'jalan'
            ? 'Berlangsung'
            : 'Selesai'
        }
        statusTone={status === 'jalan' ? 'live' : status === 'selesai' ? 'done' : 'idle'}
        targetJarak={targetJarak}
        ruleSummary="Benar = tim maju • Salah = tersandung"
        lanes={stadiumLanes}
        crowdCheer={crowdCheer || status === 'selesai'}
        compactLanes={activeTeams.length >= 4}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(soundEffects.toggleMute())}
        onBack={() => navigate(returnUrl)}
        onStop={status === 'jalan' ? () => setModalAkhiriOpen(true) : undefined}
      />

      <main className="bk-wrap">
        {/* 1. LOBI PESERTA & PEMBAGIAN TIM */}
        {status === 'lobi' && (
          <section className="bk-card mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Kiri: PIN, QR & Pemilih Jumlah Tim */}
              <div>
                <h2 className="bk-h text-2xl font-extrabold text-[#2b2a4a]">
                  Siswa gabung lewat HP
                </h2>
                <p className="text-sm text-[#6b6a85] mt-1 mb-3">
                  Masukkan PIN atau pindai QR, lalu tulis nama. Siswa otomatis dibagi merata ke
                  setiap tim.
                </p>

                <div className="flex flex-wrap items-center gap-4 mb-3">
                  <div className="bk-pin-row">
                    {(token || '------').split('').map((digit, idx) => (
                      <div key={idx} className="bk-pin-tile">
                        {digit}
                      </div>
                    ))}
                  </div>

                  {qrDataUrl && (
                    <div className="p-1.5 bg-white border-[3px] border-[#2b2a4a] rounded-xl shrink-0">
                      <img
                        src={qrDataUrl}
                        alt="QR Code Gabung Lomba"
                        className="w-[104px] h-[104px] block"
                      />
                    </div>
                  )}
                </div>

                {joinUrl && (
                  <div className="flex items-center gap-2 bg-[#fff3d6] border-2 border-[#f0dfb4] rounded-xl px-3 py-2 mb-4">
                    <span className="text-xs font-bold text-[#6b6a85] truncate flex-1 font-mono">
                      {joinUrl}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-lg bg-white border border-[#f0dfb4] text-[#2b2a4a] hover:bg-[#ffe9a8] cursor-pointer shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#1f9d55]" /> Disalin
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Salin
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold text-[#2b2a4a] mr-1">
                    Jumlah tim:
                  </span>
                  {([3, 4] as const).map((n) => {
                    const active = jumlahTim === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={isChangingTeamCount}
                        onClick={() => handleUbahJumlahTim(n)}
                        className={`px-4 py-1.5 rounded-full border-2 text-sm font-extrabold transition-all cursor-pointer ${
                          active
                            ? 'bg-[#1d8fe0] border-[#1d8fe0] text-white'
                            : 'bg-[#fff3d6] border-[#f0dfb4] text-[#2b2a4a] hover:border-[#1d8fe0]'
                        }`}
                      >
                        {n} tim
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Kanan: Daftar Anggota Per Tim + Tombol Mulai */}
              <div className="flex flex-col justify-between gap-4">
                <div>
                  <h2 className="bk-h text-2xl font-extrabold text-[#2b2a4a] mb-2 flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#1d8fe0]" />
                    Tim ({totalPeserta} siswa)
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeTeams.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-2xl p-3 border-[3px]"
                        style={{ borderColor: t.warna, backgroundColor: `${t.warna}14` }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span
                            className="bk-h text-xs font-extrabold text-white px-2.5 py-0.5 rounded-full"
                            style={{ background: t.warna }}
                          >
                            {t.nama}
                          </span>
                          <span className="text-[11px] font-extrabold text-[#6b6a85]">
                            {t.anggota.length} orang
                          </span>
                        </div>

                        {t.anggota.length === 0 ? (
                          <div className="text-[11px] italic text-[#6b6a85]">
                            Menunggu peserta...
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {t.anggota.map((m) => (
                              <span
                                key={m.id}
                                className="inline-flex items-center gap-1.5 bg-white border border-[#f0dfb4] rounded-full py-0.5 pl-1 pr-2.5 text-xs font-extrabold text-[#2b2a4a]"
                              >
                                <span
                                  className="w-3.5 h-3.5 rounded-full shrink-0"
                                  style={{ background: t.warna }}
                                />
                                {m.nama}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t-2 border-dashed border-[#f0dfb4]">
                  {totalPeserta > 0 && totalPeserta < activeTeams.length && (
                    <div className="px-3 py-2 rounded-xl bg-[#fff3c4] border border-[#f2c230] text-[11px] font-bold text-[#7a5200]">
                      Jumlah peserta ({totalPeserta}) lebih sedikit dari {activeTeams.length}{' '}
                      tim. Guru tetap bisa memulai lomba sekarang atau menunggu siswa lain.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/guru/balap-karung?templateId=${encodeURIComponent(
                            templateId
                          )}&kembali=${encodeURIComponent(returnUrl)}`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border-2 border-[#f0dfb4] bg-[#fff3d6] text-xs font-extrabold text-[#2b2a4a] hover:bg-[#fde9b8] cursor-pointer"
                    >
                      <Sliders className="w-4 h-4" /> Pengaturan
                    </button>

                    <button
                      type="button"
                      disabled={totalPeserta === 0 || isStarting}
                      onClick={handleMulai}
                      className="bk-btn"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {isStarting ? 'Memulai...' : 'Mulai lomba'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 2. LOMBA BERLANGSUNG (LEADERBOARD TIM + FEED REAL-TIME) */}
        {(status === 'jalan' || (status === 'selesai' && !showEndSection)) && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            {/* Posisi Tim Live */}
            <div className="lg:col-span-2 bk-card">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="bk-h text-2xl font-extrabold text-[#2b2a4a]">Posisi tim</h2>
                <span className="bk-chip">
                  {config.waktuPerSoalDetik || 10} detik / soal
                </span>
              </div>

              <ol className="space-y-2.5">
                {rankedTeams.map((t, idx) => {
                  const pct = Math.min(100, Math.max(0, (t.meter / targetJarak) * 100));
                  return (
                    <li
                      key={t.id}
                      className="bg-[#fff3d6] border-2 border-[#f0dfb4] rounded-2xl px-4 py-2.5 space-y-1.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <strong className="bk-h text-lg font-extrabold text-[#2b2a4a] w-5">
                          {idx + 1}
                        </strong>
                        <span
                          className="bk-h text-xs font-extrabold text-white px-2.5 py-0.5 rounded-full shrink-0"
                          style={{ background: t.warna }}
                        >
                          {t.nama}
                        </span>
                        <span className="font-extrabold text-[#6b6a85] text-xs flex-1">
                          {t.anggota.length} orang
                        </span>
                        <span className="bk-h font-extrabold text-[#1f9d55] text-base">
                          {t.isWinner || t.meter >= targetJarak
                            ? 'Finis!'
                            : `${Math.round(t.meter)} m`}
                        </span>
                      </div>

                      <div className="h-2.5 rounded-full bg-[#f0dfb4] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: t.warna }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Panel Samping: PIN Susulan & Aktivitas */}
            <div className="bk-card flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="bk-h text-lg font-extrabold text-[#2b2a4a]">
                    Aktivitas Lomba
                  </h3>
                  {config.allowLateJoin !== false && token && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#2b2a4a] text-[#fff3d6] text-xs font-extrabold font-mono">
                      PIN: {token}
                    </span>
                  )}
                </div>

                {liveFeed.length === 0 ? (
                  <p className="text-xs font-bold text-[#6b6a85]">
                    Menunggu jawaban siswa dari HP masing-masing...
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {liveFeed.map((item) => (
                      <li
                        key={item.id}
                        className={`text-xs font-bold px-3 py-2 rounded-xl border ${
                          item.ok
                            ? 'bg-[#d9f5e3] border-[#a7e6be] text-[#0f5b32]'
                            : 'bg-[#fde0e0] border-[#f4b6b6] text-[#8a1f1f]'
                        }`}
                      >
                        {item.teks}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="button"
                onClick={() => setModalAkhiriOpen(true)}
                className="bk-btn w-full justify-center"
              >
                <StopCircle className="w-4 h-4" /> Akhiri Lomba
              </button>
            </div>
          </section>
        )}

        {/* 3. HASIL AKHIR PODIUM TIM & HEATMAP ANALISIS PER SOAL */}
        {status === 'selesai' && showEndSection && (
          <section ref={endRef} className="bk-card mt-4 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-[#ffe9a8] text-[#7a5200] text-xs font-extrabold mb-1.5">
                  <Trophy className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  Hasil lomba tim
                </span>
                <h2 className="bk-h text-2xl sm:text-3xl font-extrabold text-[#2b2a4a]">
                  Pemenang: {winnerTeamName}!
                </h2>
                <p className="text-sm text-[#6b6a85] mt-0.5">
                  {hasilAkhir?.dihentikanManual
                    ? 'Perlombaan dihentikan manual oleh guru.'
                    : `Tim pertama yang menyentuh garis finis ${targetJarak} m.`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={isMainLagi}
                  onClick={() => handleMainLagi(jumlahTim)}
                  className="bk-btn alt"
                >
                  <RefreshCw className={`w-4 h-4 ${isMainLagi ? 'animate-spin' : ''}`} />
                  {isMainLagi ? 'Menyiapkan...' : 'Main lagi'}
                </button>
                <button
                  type="button"
                  disabled={isMainLagi}
                  onClick={() => handleMainLagi(jumlahTim)}
                  className="bk-btn slate"
                >
                  Ubah tim di Lobi
                </button>
                <button
                  type="button"
                  onClick={() => navigate(returnUrl)}
                  className="bk-btn gold"
                >
                  Selesai
                </button>
              </div>
            </div>

            {/* Kartu Podium Setiap Tim */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {finalLaporanTim.map((tim, idx) => {
                const isWinner = idx === 0 || tim.isWinner;
                return (
                  <div
                    key={tim.id}
                    className={`rounded-[20px] p-4 text-center border-2 ${
                      isWinner
                        ? 'border-[#ffb81c] border-[3px] bg-gradient-to-b from-[#fff3c4] to-[#fff3d6]'
                        : 'border-[#f0dfb4] bg-[#fff3d6]'
                    }`}
                  >
                    <div className="flex justify-center mb-1">
                      <BalapSackSvg
                        shirtColor={tim.warna}
                        up={isWinner}
                        crown={isWinner}
                        medal={idx === 1}
                        className="w-20 h-auto"
                      />
                    </div>
                    <span
                      className={`inline-block px-3 py-0.5 rounded-full text-xs font-extrabold ${
                        isWinner
                          ? 'bg-[#ffb81c] text-[#4a3000]'
                          : 'bg-[#dfe3ee] text-[#394060]'
                      }`}
                    >
                      {isWinner ? 'Juara 1 • Pemenang' : `Juara ${tim.peringkat || idx + 1}`}
                    </span>
                    <h3 className="mt-1.5">
                      <span
                        className="inline-block bk-h text-base font-extrabold text-white px-3 py-0.5 rounded-full"
                        style={{ background: tim.warna }}
                      >
                        {tim.nama}
                      </span>
                    </h3>
                    <div className="bk-h text-3xl font-extrabold text-[#2b2a4a] mb-2">
                      {Math.round(tim.meter)} m
                    </div>

                    <ul className="text-left text-xs border-t border-[#f0dfb4] pt-2 space-y-1">
                      {tim.anggota.length === 0 ? (
                        <li className="text-[#6b6a85] italic text-center">Tanpa anggota</li>
                      ) : (
                        tim.anggota.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center justify-between gap-2 py-0.5"
                          >
                            <span className="font-extrabold text-[#2b2a4a] truncate">
                              {m.nama}
                            </span>
                            <span className="font-bold whitespace-nowrap shrink-0">
                              <strong className="text-[#1f9d55]">{m.totalBenar}</strong> benar /{' '}
                              <strong className="text-[#d63b3b]">{m.totalSalah}</strong> salah
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Heatmap Matriks & Drilldown Soal */}
            {hasilAkhir?.analisisHeatmap && (
              <div className="pt-2 border-t-2 border-dashed border-[#f0dfb4]">
                <BalapHeatmapMatrix heatmap={hasilAkhir.analisisHeatmap} />
              </div>
            )}
          </section>
        )}
      </main>

      {/* Modal Konfirmasi Akhiri Lomba */}
      <Modal
        isOpen={modalAkhiriOpen}
        onClose={() => setModalAkhiriOpen(false)}
        title="Akhiri Perlombaan Sekarang?"
        variant="standard"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Perlombaan akan dihentikan dan tim dengan jarak terjauh dinyatakan sebagai pemenang.
          </p>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setModalAkhiriOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Lanjutkan Lomba
            </button>
            <button
              type="button"
              disabled={isEnding}
              onClick={handleAkhiriManual}
              className="bk-btn"
            >
              {isEnding ? 'Mengakhiri...' : 'Ya, Akhiri Lomba'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
