import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { bindHostReconnect } from '../../lib/socketReconnect';
import { soundEffects, useGameSoundLifecycle } from '../../lib/soundEffects';
import { extractApiErrorMessage, resolveGuruReturnUrl } from '../../components';
import {
  AnalisisHeatmapData,
  BalapHeatmapMatrix,
} from '../../components/BalapKarungStadium';
import {
  TarikActionPulse,
  TarikTambangStadium,
} from '../../components/TarikTambangStadium';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Loader2,
  Play,
  RotateCcw,
  Settings2,
  Shuffle,
  StopCircle,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import ModalKonfirmasiKeluar from '../../components/ModalKonfirmasiKeluar';

interface PesertaTarikMulti {
  id: string;
  nama: string;
  tim: 'merah' | 'putih' | null;
  connected: boolean;
  totalBenar?: number;
  totalSalah?: number;
  jumlahJawab?: number;
  akurasiPersen?: number;
  streakSaatIni?: number;
  streakTertinggi?: number;
}

interface FeedAksiItem {
  id: string;
  text: string;
  ok: boolean;
  tim: 'merah' | 'putih';
}

interface RingkasanTimMulti {
  id: 'merah' | 'putih';
  nama: string;
  warna: string;
  jumlahAnggota: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
}

interface LaporanMultiClient {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  alasanSelesai?: 'garis_menang' | 'waktu_habis' | 'manual';
  timMenang: 'merah' | 'putih' | 'seri';
  namaTim1: string;
  namaTim2: string;
  posisiAkhir: number;
  skorMerah: number;
  skorPutih: number;
  totalPeserta: number;
  ringkasanTim?: RingkasanTimMulti[];
  laporanSiswa?: Array<{
    id: string;
    nama: string;
    tim: 'merah' | 'putih';
    totalBenar: number;
    totalSalah: number;
    akurasiPersen: number;
    streakTertinggi: number;
    rataRataWaktuJawabMs: number;
  }>;
  analisisHeatmap?: AnalisisHeatmapData;
}

interface SesiMultiInfo {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  token: string;
  qrDataUrl?: string;
  joinUrl?: string;
  status: 'lobi' | 'jalan' | 'selesai';
  taliPosition: number;
  skorMerah: number;
  skorPutih: number;
  durasiLombaDetik: number;
  matchEndsAt: number | null;
  daftarPeserta: PesertaTarikMulti[];
  config: {
    durasiLombaDetik: number;
    waktuPerSoalDetik: number;
    kekuatanTimMulti: number;
    namaTim1: string;
    namaTim2: string;
    maxPeserta: number;
    batasMenang: number;
  };
  hasil?: LaporanMultiClient | null;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export default function LayarHostMulti() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = resolveGuruReturnUrl(searchParams.get('kembali'));

  const [sesi, setSesi] = useState<SesiMultiInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const [sisaDetik, setSisaDetik] = useState<number>(180);
  const [copiedPin, setCopiedPin] = useState(false);
  const [modalKeluarOpen, setModalKeluarOpen] = useState(false);
  const { isMuted: muted, toggleMute } = useGameSoundLifecycle(
    Boolean(sesi && sesi.status === 'jalan'),
    id
  );
  const [actionPulse, setActionPulse] = useState<TarikActionPulse | null>(null);
  const [feed, setFeed] = useState<FeedAksiItem[]>([]);

  const fanfarePlayedRef = useRef(false);

  const loadSesi = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setErrorPesan(null);
      const res = await apiRequest<{ session: SesiMultiInfo }>(`/sesi/${id}`);
      const s = res.session;
      if (s.status === 'selesai') {
        fanfarePlayedRef.current = true;
      }
      setSesi(s);
      if (s.matchEndsAt && s.status === 'jalan') {
        setSisaDetik(Math.max(0, Math.ceil((s.matchEndsAt - Date.now()) / 1000)));
      } else {
        setSisaDetik(s.durasiLombaDetik || s.config?.durasiLombaDetik || 180);
      }
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal memuat sesi Multiplayer Tarik Tambang.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadSesi();
  }, [loadSesi]);

  // Socket.IO Real-time Subscription
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();

    const cleanupReconnect = bindHostReconnect(socket, id);
    socket.emit('sesi:host_join', { sessionId: id });

    const onLobbyUpdate = (payload: any) => {
      if (payload?.game && payload.game !== 'tarik_tambang') return;
      setSesi((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: payload.status || prev.status,
          daftarPeserta: Array.isArray(payload.daftarPeserta)
            ? payload.daftarPeserta
            : prev.daftarPeserta,
          taliPosition: payload.taliPosition ?? prev.taliPosition,
          skorMerah: payload.skorMerah ?? prev.skorMerah,
          skorPutih: payload.skorPutih ?? prev.skorPutih,
          matchEndsAt: payload.matchEndsAt ?? prev.matchEndsAt,
          durasiLombaDetik: payload.durasiLombaDetik ?? prev.durasiLombaDetik,
          config: payload.config || prev.config,
          hasil: payload.hasil || prev.hasil,
        };
      });
    };

    const onGameMulai = (payload: any) => {
      if (payload?.game && payload.game !== 'tarik_tambang') return;
      soundEffects.startGame('race');
      setFeed([]);
      setSesi((prev) =>
        prev
          ? {
              ...prev,
              status: 'jalan',
              taliPosition: payload.taliPosition ?? 0,
              skorMerah: payload.skorMerah ?? 0,
              skorPutih: payload.skorPutih ?? 0,
              matchEndsAt: payload.matchEndsAt ?? prev.matchEndsAt,
              durasiLombaDetik: payload.durasiLombaDetik ?? prev.durasiLombaDetik,
              daftarPeserta: payload.daftarPeserta || prev.daftarPeserta,
            }
          : prev
      );
    };

    const onTaliUpdate = (payload: any) => {
      if (payload?.game && payload.game !== 'tarik_tambang') return;
      setSesi((prev) =>
        prev
          ? {
              ...prev,
              taliPosition: payload.taliPosition ?? prev.taliPosition,
              skorMerah: payload.skorMerah ?? prev.skorMerah,
              skorPutih: payload.skorPutih ?? prev.skorPutih,
              daftarPeserta: payload.daftarPeserta || prev.daftarPeserta,
            }
          : prev
      );

      if (payload?.aksi) {
        const ax = payload.aksi;
        const ok = ax.action === 'pull';
        soundEffects.playTarikTambangAction({
          benar: ok,
          isStrong: Math.abs(Number(ax.deltaTali || 0)) >= 8,
          playAnswerChime: false,
        });
        setActionPulse({
          id: `${Date.now()}-${Math.random()}`,
          side: ax.side === 'r' ? 'r' : 'l',
          kind: ok ? 'heave' : 'slip',
          pullerIdx: typeof ax.pullerIdx === 'number' ? ax.pullerIdx : 0,
          bubble: ok ? 'TARIK!' : ax.quote || 'TERPELESET!',
        });
        setFeed((prev) =>
          [
            {
              id: `${Date.now()}-${Math.random()}`,
              tim: (ax.side === 'r' ? 'putih' : 'merah') as 'merah' | 'putih',
              ok,
              text: ok
                ? `${ax.playerName} menjawab benar (+${Math.round(Math.abs(ax.deltaTali || 0))})`
                : `${ax.playerName} ${ax.timedOut ? 'kehabisan waktu' : 'terpeleset'}!`,
            },
            ...prev,
          ].slice(0, 12)
        );
      }
    };

    const onSesiSelesai = (payload: any) => {
      if (payload?.game && payload.game !== 'tarik_tambang') return;
      const isManualStop = Boolean(
        payload?.hasil?.dihentikanManual || payload?.hasil?.alasanSelesai === 'manual'
      );
      if (isManualStop) {
        fanfarePlayedRef.current = true;
        soundEffects.stopAll();
      } else if (!fanfarePlayedRef.current) {
        fanfarePlayedRef.current = true;
        soundEffects.playNaturalVictory();
      }
      setSesi((prev) =>
        prev
          ? {
              ...prev,
              status: 'selesai',
              taliPosition: payload.hasil?.posisiAkhir ?? prev.taliPosition,
              skorMerah: payload.hasil?.skorMerah ?? prev.skorMerah,
              skorPutih: payload.hasil?.skorPutih ?? prev.skorPutih,
              hasil: payload.hasil || prev.hasil,
            }
          : prev
      );
    };

    socket.on('lobi:update', onLobbyUpdate);
    socket.on('game:mulai', onGameMulai);
    socket.on('tali:update', onTaliUpdate);
    socket.on('sesi:selesai', onSesiSelesai);

    return () => {
      cleanupReconnect();
      socket.off('lobi:update', onLobbyUpdate);
      socket.off('game:mulai', onGameMulai);
      socket.off('tali:update', onTaliUpdate);
      socket.off('sesi:selesai', onSesiSelesai);
    };
  }, [id]);

  // Countdown Jam Lomba (3:00 -> 0:00)
  useEffect(() => {
    if (!sesi) return;
    if (sesi.status !== 'jalan' || !sesi.matchEndsAt) {
      setSisaDetik(sesi.status === 'selesai' ? 0 : sesi.durasiLombaDetik || 180);
      return;
    }

    const endMs = sesi.matchEndsAt;
    const iv = window.setInterval(() => {
      setSisaDetik(Math.max(0, Math.ceil((endMs - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(iv);
  }, [sesi?.status, sesi?.matchEndsAt, sesi?.durasiLombaDetik]);

  const anggotaMerah = useMemo(
    () => (sesi?.daftarPeserta || []).filter((p) => p.tim === 'merah'),
    [sesi?.daftarPeserta]
  );
  const anggotaBiru = useMemo(
    () => (sesi?.daftarPeserta || []).filter((p) => p.tim === 'putih'),
    [sesi?.daftarPeserta]
  );

  const ringkasanTim = useMemo<RingkasanTimMulti[]>(() => {
    const t1Name = sesi?.config?.namaTim1 || 'Tim Merah';
    const t2Name = sesi?.config?.namaTim2 || 'Tim Biru';
    if (sesi?.hasil?.ringkasanTim && sesi.hasil.ringkasanTim.length === 2) {
      return sesi.hasil.ringkasanTim;
    }
    const merahB = anggotaMerah.reduce((a, p) => a + (p.totalBenar || 0), 0);
    const merahS = anggotaMerah.reduce((a, p) => a + (p.totalSalah || 0), 0);
    const biruB = anggotaBiru.reduce((a, p) => a + (p.totalBenar || 0), 0);
    const biruS = anggotaBiru.reduce((a, p) => a + (p.totalSalah || 0), 0);
    return [
      {
        id: 'merah',
        nama: t1Name,
        warna: '#e2312d',
        jumlahAnggota: anggotaMerah.length,
        totalBenar: merahB,
        totalSalah: merahS,
        akurasiPersen: merahB + merahS > 0 ? Math.round((merahB / (merahB + merahS)) * 100) : 0,
      },
      {
        id: 'putih',
        nama: t2Name,
        warna: '#1d8fe0',
        jumlahAnggota: anggotaBiru.length,
        totalBenar: biruB,
        totalSalah: biruS,
        akurasiPersen: biruB + biruS > 0 ? Math.round((biruB / (biruB + biruS)) * 100) : 0,
      },
    ];
  }, [sesi?.hasil?.ringkasanTim, sesi?.config?.namaTim1, sesi?.config?.namaTim2, anggotaMerah, anggotaBiru]);

  const canStart = anggotaMerah.length >= 1 && anggotaBiru.length >= 1;

  const handleCopyJoin = async () => {
    if (!sesi) return;
    const target = sesi.joinUrl || `${window.location.origin}/main?token=${sesi.token}`;
    try {
      await navigator.clipboard.writeText(target);
      setCopiedPin(true);
      window.setTimeout(() => setCopiedPin(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleAcakTim = () => {
    if (!id || busyAction) return;
    setBusyAction(true);
    getSocket().emit('sesi:acak_tim', { sessionId: id }, () => {
      setBusyAction(false);
    });
  };

  const handlePindahTim = (pesertaId: string, timTujuan: 'merah' | 'putih') => {
    if (!id || busyAction) return;
    getSocket().emit('sesi:pindah_tim', { sessionId: id, pesertaId, timTujuan });
  };

  const handleKickPeserta = (pesertaId: string) => {
    if (!id || busyAction) return;
    if (!window.confirm('Keluarkan siswa ini dari lobi lomba?')) return;
    getSocket().emit('sesi:kick_peserta', { sessionId: id, pesertaId }, (res: any) => {
      if (res && !res.success) {
        setErrorPesan(res.pesan || 'Gagal mengeluarkan siswa.');
      }
    });
  };

  const handleKembaliClick = () => {
    if (sesi?.status === 'jalan') {
      setModalKeluarOpen(true);
    } else {
      navigate(returnUrl);
    }
  };

  const handleKonfirmasiKeluar = () => {
    setModalKeluarOpen(false);
    handleAkhiriManual();
    navigate(returnUrl);
  };

  const handleMulaiLomba = () => {
    if (!id || !canStart || busyAction) return;
    setBusyAction(true);
    getSocket().emit('sesi:mulai', { sessionId: id }, (res: any) => {
      setBusyAction(false);
      if (res && !res.success) {
        setErrorPesan(res.pesan || 'Gagal memulai lomba.');
      }
    });
  };

  const handleAkhiriManual = () => {
    if (!id || busyAction) return;
    setBusyAction(true);
    getSocket().emit('sesi:akhiri_manual', { sessionId: id }, (res: any) => {
      setBusyAction(false);
      if (res && !res.success) {
        setErrorPesan(res.pesan || 'Gagal mengakhiri lomba.');
      } else {
        fanfarePlayedRef.current = true;
        soundEffects.stopAll();
      }
    });
  };

  const handleMainLagi = async () => {
    if (!id || busyAction) return;
    try {
      setBusyAction(true);
      fanfarePlayedRef.current = false;
      soundEffects.stopAll();
      const res = await apiRequest<{ sessionId: string }>(`/sesi/${id}/main-lagi`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      navigate(`/guru/sesi/${res.sessionId}?kembali=${encodeURIComponent(returnUrl)}`);
    } catch (err: unknown) {
      setErrorPesan(extractApiErrorMessage(err, 'Gagal membuka ruang main lagi.'));
      setBusyAction(false);
    }
  };

  if (loading) {
    return (
      <div className="tt-festival flex items-center justify-center min-h-screen p-6 text-center">
        <div className="tt-panel max-w-md w-full flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-[#e2312d]" />
          <h2 className="text-xl text-[#2b2a4a]">Membuka Lobi Multiplayer...</h2>
        </div>
      </div>
    );
  }

  if (!sesi) {
    return (
      <div className="tt-festival flex items-center justify-center min-h-screen p-6 text-center">
        <div className="tt-panel max-w-md w-full space-y-4">
          <h2 className="text-xl text-[#e2312d]">Sesi Tidak Ditemukan</h2>
          <p className="text-sm text-[#6b6a85]">{errorPesan}</p>
          <button type="button" onClick={() => navigate(returnUrl)} className="tt-btn">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const namaTim1 = sesi.config?.namaTim1 || 'Tim Merah';
  const namaTim2 = sesi.config?.namaTim2 || 'Tim Biru';
  const isPlaying = sesi.status === 'jalan';
  const isFinished = sesi.status === 'selesai';
  const winnerSide = isFinished ? sesi.hasil?.timMenang || 'seri' : null;
  const pinDigits = (sesi.token || '').split('');

  return (
    <div className="tt-festival">
      <TarikTambangStadium
        title={sesi.templateJudul || 'Tarik Tambang Kuis'}
        subtitle="MULTIPLAYER TIM • LIVE"
        modeChip={`${sesi.daftarPeserta.length}/${sesi.config?.maxPeserta || 40} Siswa`}
        statusLabel={
          sesi.status === 'lobi'
            ? 'LOBI PIN'
            : sesi.status === 'jalan'
              ? 'BERLANGSUNG'
              : 'SELESAI'
        }
        timeText={formatClock(sisaDetik)}
        timeWarning={isPlaying && sisaDetik <= 15}
        taliPosition={sesi.taliPosition}
        batasMenang={sesi.config?.batasMenang || 100}
        namaTim1={namaTim1}
        namaTim2={namaTim2}
        skorMerah={sesi.skorMerah}
        skorPutih={sesi.skorPutih}
        tim1Meta={`${anggotaMerah.length} siswa`}
        tim2Meta={`${anggotaBiru.length} siswa`}
        leftPullerCount={Math.max(1, anggotaMerah.length)}
        rightPullerCount={Math.max(1, anggotaBiru.length)}
        variant="multi"
        isPlaying={isPlaying}
        winnerSide={winnerSide}
        actionPulse={actionPulse}
        isMuted={muted}
        onToggleMute={isPlaying ? toggleMute : undefined}
        onStop={isPlaying ? handleAkhiriManual : undefined}
        onBack={handleKembaliClick}
      />

      <main className="tt-wrap">
        {errorPesan && (
          <div className="tt-panel border-[#d63b3b] text-sm font-bold text-[#b81f1c] flex items-center justify-between gap-2">
            <span>{errorPesan}</span>
            <button type="button" onClick={() => setErrorPesan(null)} className="underline">
              Tutup
            </button>
          </div>
        )}

        {/* LOBI PIN & QR + PEMBAGIAN TIM */}
        {sesi.status === 'lobi' && (
          <div className="tt-panel space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <span className="tt-chip inline-flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5" /> Buka /main di HP Siswa &amp; Masukkan PIN
                </span>
                <div className="tt-pin" aria-label={`PIN ${sesi.token}`}>
                  {pinDigits.map((d, idx) => (
                    <b key={idx}>{d}</b>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button type="button" onClick={handleCopyJoin} className="tt-btn y sm">
                    {copiedPin ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedPin ? 'Link Tersalin' : 'Salin Link Gabung'}
                  </button>
                  <button
                    type="button"
                    disabled={sesi.daftarPeserta.length < 2 || busyAction}
                    onClick={handleAcakTim}
                    className="tt-btn b sm"
                  >
                    <Shuffle className="w-4 h-4" /> Acak Tim
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 justify-start md:justify-end">
                {sesi.qrDataUrl && (
                  <img
                    src={sesi.qrDataUrl}
                    alt={`QR Gabung ${sesi.token}`}
                    className="w-28 h-28 bg-white border-4 border-[#2b2a4a] rounded-2xl p-1"
                  />
                )}
                <div className="space-y-2">
                  <div className="text-xs font-extrabold text-[#6b6a85]">
                    {sesi.daftarPeserta.length} siswa bergabung •{' '}
                    {canStart ? 'Siap dimulai!' : 'Butuh min. 1 siswa per tim'}
                  </div>
                  <button
                    type="button"
                    disabled={!canStart || busyAction}
                    onClick={handleMulaiLomba}
                    className="tt-btn text-base px-6 py-3"
                  >
                    <Play className="w-4 h-4" />
                    Mulai lomba
                  </button>
                </div>
              </div>
            </div>

            {/* Daftar Anggota 2 Tim + Pindah Tim */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-dashed border-[#f0dfb4]">
              <div className="border-2 border-[#e2312d] bg-[#fff3d6]/60 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between font-extrabold text-[#e2312d]">
                  <span>{namaTim1}</span>
                  <span>{anggotaMerah.length} siswa</span>
                </div>
                {anggotaMerah.length === 0 ? (
                  <p className="text-xs text-[#6b6a85]">Menunggu siswa bergabung...</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {anggotaMerah.map((p) => (
                      <div
                        key={p.id}
                        className="inline-flex items-center gap-2 bg-white border border-[#f0dfb4] rounded-full px-3 py-1 text-xs font-extrabold"
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            p.connected ? 'bg-[#1f9d55]' : 'bg-gray-300'
                          }`}
                        />
                        <span>{p.nama}</span>
                        <button
                          type="button"
                          onClick={() => handlePindahTim(p.id, 'putih')}
                          title={`Pindahkan ke ${namaTim2}`}
                          className="text-[#1d8fe0] hover:opacity-75 cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleKickPeserta(p.id)}
                          title="Keluarkan dari lobi"
                          className="text-[#d63b3b] hover:opacity-75 cursor-pointer p-0.5 rounded hover:bg-rose-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-2 border-[#1d8fe0] bg-[#fff3d6]/60 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between font-extrabold text-[#1d8fe0]">
                  <span>{namaTim2}</span>
                  <span>{anggotaBiru.length} siswa</span>
                </div>
                {anggotaBiru.length === 0 ? (
                  <p className="text-xs text-[#6b6a85]">Menunggu siswa bergabung...</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {anggotaBiru.map((p) => (
                      <div
                        key={p.id}
                        className="inline-flex items-center gap-2 bg-white border border-[#f0dfb4] rounded-full px-3 py-1 text-xs font-extrabold"
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            p.connected ? 'bg-[#1f9d55]' : 'bg-gray-300'
                          }`}
                        />
                        <span>{p.nama}</span>
                        <button
                          type="button"
                          onClick={() => handlePindahTim(p.id, 'merah')}
                          title={`Pindahkan ke ${namaTim1}`}
                          className="text-[#e2312d] hover:opacity-75 cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleKickPeserta(p.id)}
                          title="Keluarkan dari lobi"
                          className="text-[#d63b3b] hover:opacity-75 cursor-pointer p-0.5 rounded hover:bg-rose-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PERTANDINGAN BERLANGSUNG */}
        {isPlaying && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="tt-panel lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg text-[#2b2a4a]">Kontribusi Siswa Real-Time</h2>
                <button
                  type="button"
                  onClick={handleAkhiriManual}
                  className="tt-btn s sm"
                >
                  <StopCircle className="w-3.5 h-3.5" /> Akhiri Lomba
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { nama: namaTim1, warna: '#e2312d', list: anggotaMerah },
                  { nama: namaTim2, warna: '#1d8fe0', list: anggotaBiru },
                ].map((team) => (
                  <div
                    key={team.nama}
                    className="rounded-2xl border-2 p-3 space-y-1.5 bg-[#fff3d6]/40"
                    style={{ borderColor: team.warna }}
                  >
                    <div className="text-xs font-extrabold" style={{ color: team.warna }}>
                      {team.nama} ({team.list.length})
                    </div>
                    {team.list.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs bg-white rounded-xl px-2.5 py-1.5 border border-[#f0dfb4]"
                      >
                        <span className="font-bold truncate">{p.nama}</span>
                        <span className="font-extrabold shrink-0">
                          <span className="text-[#1f9d55]">{p.totalBenar ?? 0}B</span>
                          {' • '}
                          <span className="text-[#d63b3b]">{p.totalSalah ?? 0}S</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="tt-panel space-y-2.5">
              <h2 className="text-lg text-[#2b2a4a]">Aktivitas Tarikan Terbaru</h2>
              {feed.length === 0 ? (
                <p className="text-xs text-[#6b6a85]">
                  Setiap jawaban siswa dari HP akan tampil langsung di sini...
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {feed.map((f) => (
                    <li
                      key={f.id}
                      className={`text-xs font-bold px-3 py-2 rounded-xl border ${
                        f.ok
                          ? 'bg-[#d9f5e3] border-[#1f9d55]/40 text-[#0f5b32]'
                          : 'bg-[#fde0e0] border-[#d63b3b]/40 text-[#991b1b]'
                      }`}
                    >
                      {f.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* SELESAI: PODIUM TIM + HEATMAP ANALISIS SOAL */}
        {isFinished && (
          <div className="tt-panel space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="tt-chip gold inline-flex items-center gap-1.5 mb-2">
                  <Trophy className="w-3.5 h-3.5" />
                  {sesi.hasil?.alasanSelesai === 'garis_menang'
                    ? 'Menang Garis Batas'
                    : sesi.hasil?.alasanSelesai === 'waktu_habis'
                      ? 'Waktu Lomba Habis'
                      : 'Dihentikan Guru'}
                </span>
                <h2 className="text-2xl sm:text-3xl text-[#2b2a4a]">
                  {winnerSide === 'merah'
                    ? `${namaTim1} Memenangkan Lomba!`
                    : winnerSide === 'putih'
                      ? `${namaTim2} Memenangkan Lomba!`
                      : 'Pertandingan Berakhir Seri!'}
                </h2>
                <p className="text-sm text-[#6b6a85] mt-1">
                  Posisi akhir tali:{' '}
                  <strong>
                    {sesi.taliPosition > 0 ? `+${sesi.taliPosition}` : sesi.taliPosition}
                  </strong>{' '}
                  • {sesi.daftarPeserta.length} peserta
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={handleMainLagi}
                  className="tt-btn sm"
                >
                  <RotateCcw className="w-4 h-4" /> Main lagi
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/guru/tarik-tambang?templateId=${encodeURIComponent(
                        sesi.templateId
                      )}&mode=multi&kembali=${encodeURIComponent(returnUrl)}`
                    )
                  }
                  className="tt-btn y sm"
                >
                  <Settings2 className="w-4 h-4" /> Ubah pengaturan
                </button>
                <button type="button" onClick={() => navigate(returnUrl)} className="tt-btn s sm">
                  Selesai
                </button>
              </div>
            </div>

            {/* Podium 2 Tim + Detail Kontribusi Siswa */}
            <div className="tt-cards">
              {ringkasanTim.map((tim) => {
                const isWinner = winnerSide === tim.id;
                const members = (sesi.hasil?.laporanSiswa || sesi.daftarPeserta)
                  .filter((p) => p.tim === tim.id)
                  .slice()
                  .sort((a, b) => (b.totalBenar ?? 0) - (a.totalBenar ?? 0));
                return (
                  <div key={tim.id} className={`tt-rc ${isWinner ? 'w' : ''}`}>
                    <span className="tt-pl2">{isWinner ? 'JUARA 1' : 'POSISI 2'}</span>
                    <h3 className="text-lg mt-1.5" style={{ color: tim.warna }}>
                      {tim.nama}
                    </h3>
                    <div className="tt-big text-[#2b2a4a]">{tim.akurasiPersen}%</div>
                    <small className="text-xs font-bold text-[#6b6a85]">
                      {tim.totalBenar} Benar • {tim.totalSalah} Salah • {tim.jumlahAnggota} Siswa
                    </small>
                    {members.length > 0 && (
                      <ul className="tt-mt">
                        {members.map((m) => (
                          <li key={m.id}>
                            <span className="truncate font-bold">{m.nama}</span>
                            <span className="shrink-0 font-extrabold">
                              <span className="text-[#1f9d55]">{m.totalBenar ?? 0}B</span>
                              {' / '}
                              <span className="text-[#d63b3b]">{m.totalSalah ?? 0}S</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Matriks Heatmap Analisis Soal */}
            {sesi.hasil?.analisisHeatmap && (
              <div className="pt-2 border-t border-dashed border-[#f0dfb4]">
                <BalapHeatmapMatrix heatmap={sesi.hasil.analisisHeatmap} />
              </div>
            )}
          </div>
        )}
      </main>

      <ModalKonfirmasiKeluar
        isOpen={modalKeluarOpen}
        onClose={() => setModalKeluarOpen(false)}
        onKonfirmasiKeluar={handleKonfirmasiKeluar}
        judulGame="Tarik Tambang"
      />
    </div>
  );
}
