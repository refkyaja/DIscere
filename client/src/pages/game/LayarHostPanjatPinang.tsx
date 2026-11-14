import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { apiRequest } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { bindHostReconnect } from '../../lib/socketReconnect';
import { Modal } from '../../components';
import { ModalKonfirmasiKeluar } from '../../components/ModalKonfirmasiKeluar';
import { FestivalStadiumShell } from '../../components/FestivalStadiumShell';
import { soundEffects, useGameSoundLifecycle } from '../../lib/soundEffects';
import TiangPinangVisual, { EfekAktifVisual } from '../siswa/TiangPinangVisual';
import KarakterPanjatPinang, { EkspresiKarakterPanjat } from '../siswa/KarakterPanjatPinang';
import {
  Trophy,
  StopCircle,
  Loader2,
  Flame,
  Shield,
  HandMetal,
  Droplets,
  Clock,
  Eye,
  Flag,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import RuangTungguGuru from '../guru/RuangTungguGuru';

interface KonfigurasiPanjatHost {
  kesulitan: 'mudah' | 'normal' | 'sulit' | 'custom';
  naikBenar: number;
  turunSalah: number;
  bonusStreakAktif: boolean;
  bonusStreak3: number;
  bonusStreak5: number;
  rintanganAktif: boolean;
  rintanganDipilih: string[];
  penurunanTiangLicin: number;
  bonusPeganganKuat: number;
  hadiahKejutanMode: 'posisi' | 'poin';
  hadiahKejutanNilai: number;
  peluangRintanganPersen: number;
  maxPeserta: number;
  allowLateJoin: boolean;
}

interface LeaderboardItemHost {
  peringkat: number;
  id: string;
  nama: string;
  tim?: string;
  connected?: boolean;
  posisi: number;
  poinBonus: number;
  totalBenar: number;
  totalSalah: number;
  akurasiPersen: number;
  streakSaatIni: number;
  streakTertinggi: number;
  streakSalahBerturut?: number;
  jatuhKeDasar?: number;
  status: 'bermain' | 'selesai';
  waktuSelesaiMs: number | null;
  rataRataWaktuJawabMs: number;
  jumlahJawab: number;
  efekAktif?: EfekAktifVisual;
}

interface RiwayatRintanganHost {
  id: string;
  tipe: string;
  judul: string;
  deskripsi: string;
  efekNilai: number;
  satuan: string;
  timestampMs: number;
}

interface RiwayatPosisiHost {
  urutan: number;
  questionId: string;
  posisiSebelum: number;
  perubahan: number;
  posisiSesudah: number;
  alasan: string;
  timestampMs: number;
}

interface LaporanPemainHost {
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
  streakSaatIni: number;
  streakSalahBerturut?: number;
  jatuhKeDasar?: number;
  rataRataWaktuJawabMs: number;
  waktuSelesaiMs: number | null;
  riwayatRintangan: RiwayatRintanganHost[];
  riwayatPosisi: RiwayatPosisiHost[];
}

interface QuestionStatHost {
  questionId: string;
  teks: string;
  totalJawab: number;
  totalBenar: number;
  totalSalah: number;
  tingkatSalahPersen: number;
}

interface LaporanAkhirHost {
  sessionId: string;
  templateId: string;
  templateJudul: string;
  konfigurasi?: KonfigurasiPanjatHost;
  totalPeserta: number;
  totalSelesai: number;
  totalSoalTemplate: number;
  totalJawabanBenar: number;
  totalJawabanSalah: number;
  dihentikanManual: boolean;
  leaderboard: LeaderboardItemHost[];
  laporanPemain: LaporanPemainHost[];
  podium?: {
    juara1?: LeaderboardItemHost;
    juara2?: LeaderboardItemHost;
    juara3?: LeaderboardItemHost;
  };
  questionStats?: QuestionStatHost[];
}

function formatDurasiDetik(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return '-';
  if (ms < 1000) return `${ms} md`;
  const detik = ms / 1000;
  if (detik < 60) return `${detik.toFixed(1)} dtk`;
  const menit = Math.floor(detik / 60);
  const sisa = Math.round(detik % 60);
  return `${menit}m ${sisa}d`;
}

export default function LayarHostPanjatPinang() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('kembali') || '/guru';

  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [templateJudul, setTemplateJudul] = useState('');
  const [token, setToken] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [, setJoinUrl] = useState('');
  const [status, setStatus] = useState<'lobi' | 'jalan' | 'selesai'>('lobi');
  const [, setTotalSoal] = useState(0);
  const [config, setConfig] = useState<KonfigurasiPanjatHost | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardItemHost[]>([]);
  const [totalPeserta, setTotalPeserta] = useState(0);
  const [deltaMap, setDeltaMap] = useState<Record<string, number | null>>({});
  const [ekspresiMap, setEkspresiMap] = useState<Record<string, EkspresiKarakterPanjat>>({});
  const [jatuhBebasMap, setJatuhBebasMap] = useState<Record<string, boolean>>({});
  const [bubbleMap, setBubbleMap] = useState<Record<string, string | undefined>>({});
  const [tampilSemuaTiang, setTampilSemuaTiang] = useState(false);

  const [liveFeed, setLiveFeed] = useState<
    Array<{ id: string; teks: string; tipe: 'naik' | 'turun' | 'bonus' | 'puncak' | 'rintangan' }>
  >([]);

  const [hasilAkhir, setHasilAkhir] = useState<LaporanAkhirHost | null>(null);
  const [modalAkhiriOpen, setModalAkhiriOpen] = useState(false);
  const [modalKeluarOpen, setModalKeluarOpen] = useState(false);
  const [detailPemain, setDetailPemain] = useState<LaporanPemainHost | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isMainLagi, setIsMainLagi] = useState(false);
  const { isMuted, toggleMute } = useGameSoundLifecycle(status === 'jalan', id);
  const [crowdCheer, setCrowdCheer] = useState(false);

  const fetchSesi = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiRequest<{
        session: {
          templateJudul: string;
          token: string;
          qrDataUrl?: string;
          joinUrl?: string;
          status: 'lobi' | 'jalan' | 'selesai';
          totalSoal?: number;
          totalPeserta?: number;
          config?: KonfigurasiPanjatHost;
          leaderboard?: LeaderboardItemHost[];
          daftarPeserta?: LeaderboardItemHost[];
          hasil?: LaporanAkhirHost | null;
        };
      }>(`/sesi/${id}`);

      const s = res.session;
      setTemplateJudul(s.templateJudul);
      setToken(s.token);
      setQrDataUrl(s.qrDataUrl || '');
      setJoinUrl(s.joinUrl || '');
      setStatus(s.status);
      setTotalSoal(s.totalSoal ?? 0);
      if (s.config) setConfig(s.config);
      setTotalPeserta(s.totalPeserta ?? 0);
      setLeaderboard(s.leaderboard || s.daftarPeserta || []);

      if (s.status === 'selesai') {
        if (s.hasil) {
          setHasilAkhir(s.hasil);
        } else {
          const hasilRes = await apiRequest<{ hasil: LaporanAkhirHost }>(`/sesi/${id}/hasil`);
          setHasilAkhir(hasilRes.hasil);
        }
      }
    } catch (err: any) {
      setErrorPesan(err.pesan || 'Gagal memuat sesi Panjat Pinang.');
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
    const unbindHost = bindHostReconnect(socket, id);

    const handleLobiUpdate = (data: {
      game?: string;
      totalPeserta: number;
      leaderboard?: LeaderboardItemHost[];
      daftarPeserta?: LeaderboardItemHost[];
    }) => {
      if (data.game && data.game !== 'panjat_pinang') return;
      setTotalPeserta(data.totalPeserta);
      const list = data.leaderboard || data.daftarPeserta;
      if (list) setLeaderboard(list);
    };

    const handleGameMulai = (data: {
      game?: string;
      config?: KonfigurasiPanjatHost;
      leaderboard?: LeaderboardItemHost[];
    }) => {
      if (data.game && data.game !== 'panjat_pinang') return;
      if (data.config) setConfig(data.config);
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      setIsStarting(true);
    };

    const handlePanjatUpdate = (data: {
      leaderboard: LeaderboardItemHost[];
      totalPeserta: number;
      terakhirAksi?: {
        pesertaId: string;
        nama: string;
        benar: boolean;
        isBonusKulitPisang?: boolean;
        posisiSebelum: number;
        posisiBaru: number;
        perubahanPosisi: number;
        streakSaatIni: number;
        streakSalahBerturut?: number;
        jatuhBebas?: boolean;
        awasJatuh?: boolean;
        tertahanTali?: boolean;
        taliTerkait?: number;
        isSoalPuncak?: boolean;
        soalPuncakBerhasil?: boolean;
        peganganKuatDiperoleh?: boolean;
        peganganKuatDigunakan?: boolean;
        bonusCepatDidapat?: number;
        jatuhKeDasar?: number;
        rintanganBaru?: { judul: string; tipe: string } | null;
        perisaiDigunakan?: boolean;
        perisaiDiperoleh?: boolean;
        selesaiBaru?: boolean;
      };
    }) => {
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      if (typeof data.totalPeserta === 'number') setTotalPeserta(data.totalPeserta);

      const aksi = data.terakhirAksi;
      if (aksi) {
        const ekspresiAksi: EkspresiKarakterPanjat = aksi.selesaiBaru
          ? 'puncak'
          : aksi.benar
          ? 'bahagia'
          : 'sedih';

        setDeltaMap((prev) => ({
          ...prev,
          [aksi.pesertaId]: aksi.perubahanPosisi,
        }));
        setEkspresiMap((prev) => ({
          ...prev,
          [aksi.pesertaId]: ekspresiAksi,
        }));

        if (aksi.jatuhBebas) {
          setJatuhBebasMap((prev) => ({ ...prev, [aksi.pesertaId]: true }));
          setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: 'Aaaah!! 😱' }));
          soundEffects.playWhistle();
          setTimeout(() => {
            setJatuhBebasMap((prev) => ({ ...prev, [aksi.pesertaId]: false }));
          }, 1800);
          setTimeout(() => {
            setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: undefined }));
          }, 2400);
        } else if (aksi.awasJatuh) {
          setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: 'Awas jatuh! ⚠️' }));
          setTimeout(() => {
            setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: undefined }));
          }, 2000);
        } else if (aksi.peganganKuatDiperoleh) {
          setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: 'Pegangan Kuat! ✊' }));
          setTimeout(() => {
            setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: undefined }));
          }, 2000);
        } else if (aksi.peganganKuatDigunakan) {
          setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: 'Tertahan! 🛡️' }));
          setTimeout(() => {
            setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: undefined }));
          }, 2000);
        } else if (aksi.tertahanTali) {
          setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: `Tertahan Tali ${aksi.taliTerkait}% 🪢` }));
          setTimeout(() => {
            setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: undefined }));
          }, 2000);
        } else if (aksi.bonusCepatDidapat) {
          setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: `+${aksi.perubahanPosisi}% (Cepat!) ⚡` }));
          setTimeout(() => {
            setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: undefined }));
          }, 1800);
        } else if (aksi.isSoalPuncak && aksi.soalPuncakBerhasil) {
          setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: 'PUNCAK! 🏆' }));
          setTimeout(() => {
            setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: undefined }));
          }, 2500);
        } else if (aksi.benar) {
          setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: `+${aksi.perubahanPosisi}% 🧗` }));
          setTimeout(() => {
            setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: undefined }));
          }, 1600);
        } else {
          setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: `${aksi.perubahanPosisi}% 💦` }));
          setTimeout(() => {
            setBubbleMap((prev) => ({ ...prev, [aksi.pesertaId]: undefined }));
          }, 1600);
        }

        setTimeout(() => {
          setDeltaMap((prev) => ({
            ...prev,
            [aksi.pesertaId]: null,
          }));
        }, 1400);

        if (!aksi.selesaiBaru) {
          setTimeout(() => {
            setEkspresiMap((prev) => ({
              ...prev,
              [aksi.pesertaId]: 'netral',
            }));
          }, 2200);
        }

        let teks = '';
        let tipe: 'naik' | 'turun' | 'bonus' | 'puncak' | 'rintangan' = aksi.benar ? 'naik' : 'turun';

        if (aksi.selesaiBaru) {
          teks = `${aksi.nama} mencapai PUNCAK 100%!`;
          tipe = 'puncak';
          soundEffects.playVictoryFanfare();
          setCrowdCheer(true);
          setTimeout(() => setCrowdCheer(false), 2000);
        } else if (aksi.jatuhBebas) {
          teks = `${aksi.nama} 3× salah beruntun & jatuh bebas ke dasar tiang!`;
          tipe = 'turun';
        } else if (aksi.awasJatuh) {
          teks = `${aksi.nama} 2× salah beruntun! Awas jatuh ke dasar!`;
          tipe = 'turun';
        } else if (aksi.tertahanTali) {
          teks = `${aksi.nama} tertahan di tali pengikat ${aksi.taliTerkait}%!`;
          tipe = 'turun';
        } else if (aksi.rintanganBaru) {
          teks = `${aksi.nama} memicu rintangan ${aksi.rintanganBaru.judul}!`;
          tipe = 'rintangan';
        } else if (aksi.perisaiDiperoleh) {
          teks = `${aksi.nama} berhasil menjawab soal Kulit Pisang & dapat Perisai!`;
          tipe = 'bonus';
        } else if (aksi.perisaiDigunakan) {
          teks = `${aksi.nama} terlindungi oleh Perisai Anti-Turun!`;
          tipe = 'bonus';
        } else if (aksi.benar) {
          teks = `${aksi.nama} memanjat +${aksi.perubahanPosisi}% (posisi ${aksi.posisiBaru}%)${
            aksi.streakSaatIni >= 3 ? ` • Streak ${aksi.streakSaatIni}x` : ''
          }`;
          tipe = aksi.streakSaatIni >= 3 ? 'bonus' : 'naik';
        } else {
          teks = `${aksi.nama} tergelincir ${aksi.perubahanPosisi}% (posisi ${aksi.posisiBaru}%)`;
          tipe = 'turun';
        }

        setLiveFeed((prev) => [
          { id: `${Date.now()}-${Math.random()}`, teks, tipe },
          ...prev.slice(0, 5),
        ]);
      }
    };

    const handleSesiSelesai = async (data: { game?: string; hasil?: LaporanAkhirHost }) => {
      if (data.game && data.game !== 'panjat_pinang') return;
      setStatus('selesai');
      if (data.hasil?.dihentikanManual) {
        soundEffects.stopAll();
      } else {
        soundEffects.playNaturalVictory();
      }
      if (data.hasil) {
        setHasilAkhir(data.hasil);
      }
      // Ambil questionStats lengkap dari endpoint hasil bila tersedia
      try {
        const res = await apiRequest<{ hasil: LaporanAkhirHost }>(`/sesi/${id}/hasil`);
        if (res.hasil) setHasilAkhir(res.hasil);
      } catch {
        // fallback ke data socket jika REST gagal
      }
    };

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('game:mulai', handleGameMulai);
    socket.on('panjat:update', handlePanjatUpdate);
    socket.on('sesi:selesai', handleSesiSelesai);

    return () => {
      unbindHost();
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('game:mulai', handleGameMulai);
      socket.off('panjat:update', handlePanjatUpdate);
      socket.off('sesi:selesai', handleSesiSelesai);
    };
  }, [id]);

  const handleMulai = () => {
    if (!id || totalPeserta === 0 || isStarting) return;
    setIsStarting(true);
    const socket = getSocket();
    socket.emit('sesi:mulai', { sessionId: id }, (res: { success?: boolean; pesan?: string }) => {
      if (!res?.success) {
        setIsStarting(false);
        alert(res?.pesan || 'Gagal memulai sesi Panjat Pinang.');
      }
    });
  };

  const handleTransisiSelesai = () => {
    setStatus('jalan');
    soundEffects.startGame('whistle');
    setIsStarting(false);
  };

  const handleAkhiriManual = () => {
    if (!id || isEnding) return;
    setIsEnding(true);
    const socket = getSocket();
    socket.emit('sesi:akhiri_manual', { sessionId: id }, (res: { success?: boolean; pesan?: string }) => {
      setIsEnding(false);
      setModalAkhiriOpen(false);
      if (!res?.success) {
        alert(res?.pesan || 'Gagal mengakhiri permainan.');
      } else {
        soundEffects.stopAll();
      }
    });
  };

  const handleKembaliClick = () => {
    if (status === 'jalan') {
      setModalKeluarOpen(true);
    } else {
      if (id) {
        getSocket().emit('sesi:batalkan', { sessionId: id, game: 'panjat_pinang' });
      }
      navigate(returnUrl);
    }
  };

  const handleKonfirmasiKeluar = () => {
    setModalKeluarOpen(false);
    handleAkhiriManual();
    navigate(returnUrl);
  };

  const handleMainLagi = async () => {
    if (!id || isMainLagi) return;
    setIsMainLagi(true);
    try {
      const res = await apiRequest<{ session: { id: string } }>(`/sesi/${id}/main-lagi`, {
        method: 'POST',
      });
      navigate(`/guru/sesi/${res.session.id}?kembali=${encodeURIComponent(returnUrl)}`);
    } catch (err: any) {
      alert(err.pesan || 'Gagal membuat sesi ulang.');
    } finally {
      setIsMainLagi(false);
    }
  };

  if (loading) {
    return (
      <div className="bk-festival flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-[#e2312d] mb-3" />
        <p className="font-extrabold text-[#2b2a4a]">Menyiapkan Arena Panjat Pinang...</p>
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
            {returnUrl.includes('panjat-pinang') ? 'Kembali ke Pengaturan' : 'Kembali ke Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  const ruleSummaryText = config
    ? `Benar +${config.naikBenar}% • Salah -${config.turunSalah}%`
    : 'Benar = memanjat • Salah = meluncur';

  const stadiumHeader = (
    <FestivalStadiumShell
      title="Panjat Pinang Kuis"
      subtitle={`Multiplayer Individu (${templateJudul})`}
      statusLabel={
        status === 'lobi'
          ? 'Menunggu siswa'
          : status === 'jalan'
          ? 'Berlangsung'
          : 'Selesai'
      }
      statusTone={status === 'jalan' ? 'live' : status === 'selesai' ? 'done' : 'idle'}
      targetLabel="Target Puncak 100%"
      ruleSummary={ruleSummaryText}
      crowdCheer={crowdCheer || status === 'selesai'}
      isMuted={isMuted}
      onToggleMute={status === 'jalan' ? toggleMute : undefined}
      onBack={handleKembaliClick}
      backLabel={returnUrl.includes('panjat-pinang') ? 'Pengaturan' : 'Dashboard'}
      onStop={status === 'jalan' ? () => setModalAkhiriOpen(true) : undefined}
    />
  );

  const teamsData = useMemo(() => {
    const defWarna = [
      { id: 'merah', nama: 'Tim Merah', warna: '#e2312d' },
      { id: 'biru', nama: 'Tim Biru', warna: '#1d8fe0' },
      { id: 'hijau', nama: 'Tim Hijau', warna: '#1f9d55' },
      { id: 'kuning', nama: 'Tim Kuning', warna: '#f2c230' },
    ];
    const numTeams = Math.min(defWarna.length, Math.max(2, leaderboard.length >= 6 ? 3 : 2));
    const activeTeams = defWarna.slice(0, numTeams);

    return activeTeams.map((t, tIdx) => {
      const rawMembers = leaderboard.filter((p, idx) => {
        if (p.tim) return p.tim === t.id;
        return idx % activeTeams.length === tIdx;
      });

      const n = rawMembers.length;
      const anggota = rawMembers.map((m, k) => {
        let role: 'pemanjat' | 'penopang' | 'penopang bawah' = 'pemanjat';
        if (n > 1) {
          if (k === 0) role = 'penopang bawah';
          else if (k === n - 1) role = 'pemanjat';
          else role = 'penopang';
        }
        return { item: m, role };
      });

      const posisiMax = n > 0 ? Math.max(...rawMembers.map((m) => m.posisi)) : 0;
      const salahBeruntunTotal = rawMembers.reduce((sum, m) => sum + (m.streakSalahBerturut || 0), 0);
      const limit = n > 3 ? 4 : 3;
      const salahBeruntun = Math.min(limit, salahBeruntunTotal);
      const penopangBenar = rawMembers
        .filter((_, k) => k < n - 1)
        .reduce((sum, m) => sum + m.totalBenar, 0);
      const sisaPasir = Math.min(3, penopangBenar);

      return {
        id: t.id,
        nama: t.nama,
        warna: t.warna,
        posisi: posisiMax,
        salahBeruntun,
        sisaPasir,
        limitSalah: limit,
        anggota,
      };
    });
  }, [leaderboard]);

  // -------------------------------------------------------------------------
  // FASE 1: LOBI PROYEKTOR (TEMA FESTIVAL 17 AGUSTUS)
  // -------------------------------------------------------------------------
  if (status === 'lobi') {
    return (
      <RuangTungguGuru
        sessionId={id || ''}
        token={token || ''}
        qrDataUrl={qrDataUrl}
        gameType="panjat_pinang"
        gameTitle="Panjat Pinang"
        templateJudul={templateJudul}
        metaDetail="Panjat Pinang, Lomba"
        daftarPeserta={leaderboard.map((p) => ({ id: p.id, nama: p.nama }))}
        minPeserta={1}
        maxPeserta={config?.maxPeserta || 100}
        isStarting={isStarting}
        onMulai={handleMulai}
        onTransisiSelesai={handleTransisiSelesai}
        onKembali={handleKembaliClick}
        config={config}
        onKickPeserta={(pid) => {
          getSocket().emit('sesi:kick_peserta', { sessionId: id, pesertaId: pid });
        }}
      />
    );
  }

  // -------------------------------------------------------------------------
  // FASE 3: PODIUM & LAPORAN AKHIR (TEMA FESTIVAL 17 AGUSTUS)
  // -------------------------------------------------------------------------
  if (status === 'selesai') {
    const laporanPemain = hasilAkhir?.laporanPemain || [];
    const podium = hasilAkhir?.podium || {
      juara1: leaderboard[0],
      juara2: leaderboard[1],
      juara3: leaderboard[2],
    };
    const statsSoal = hasilAkhir?.questionStats || [];

    return (
      <div className="bk-festival">
        {stadiumHeader}

        <main className="bk-wrap space-y-5">
          {/* Banner Juara */}
          <section className="bk-card mt-2 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-[#ffe9a8] text-[#7a5200] text-xs font-extrabold mb-1.5">
                  <Trophy className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  Hasil Lomba Panjat Pinang
                </span>
                <h1 className="bk-h text-2xl sm:text-3xl font-extrabold text-[#2b2a4a]">
                  {podium.juara1 ? `Pemenang: ${podium.juara1.nama}!` : templateJudul}
                </h1>
                <p className="text-sm text-[#6b6a85] mt-0.5">
                  {hasilAkhir?.dihentikanManual
                    ? 'Perlombaan dihentikan manual oleh guru.'
                    : 'Seluruh pemanjat telah menyelesaikan lomba puncak 100%!'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleMainLagi}
                  disabled={isMainLagi}
                  className="bk-btn alt"
                >
                  <RefreshCw className={`w-4 h-4 ${isMainLagi ? 'animate-spin' : ''}`} />
                  {isMainLagi ? 'Menyiapkan...' : 'Main lagi'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/guru')}
                  className="bk-btn gold"
                >
                  Selesai
                </button>
              </div>
            </div>

            {/* Ringkasan Statistik */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#fff3d6] border-2 border-[#f0dfb4] rounded-2xl p-3.5">
                <p className="text-[11px] text-[#6b6a85] font-extrabold uppercase">Total Pemain</p>
                <p className="bk-h text-2xl font-extrabold text-[#2b2a4a] mt-0.5">
                  {hasilAkhir?.totalPeserta ?? leaderboard.length}
                </p>
              </div>
              <div className="bg-[#fff3d6] border-2 border-[#f0dfb4] rounded-2xl p-3.5">
                <p className="text-[11px] text-[#6b6a85] font-extrabold uppercase">Capai Puncak 100%</p>
                <p className="bk-h text-2xl font-extrabold text-[#1f9d55] mt-0.5">
                  {hasilAkhir?.totalSelesai ?? leaderboard.filter((p) => p.status === 'selesai').length}
                </p>
              </div>
              <div className="bg-[#fff3d6] border-2 border-[#f0dfb4] rounded-2xl p-3.5">
                <p className="text-[11px] text-[#6b6a85] font-extrabold uppercase">Jawaban Benar</p>
                <p className="bk-h text-2xl font-extrabold text-[#e6a100] mt-0.5">
                  {hasilAkhir?.totalJawabanBenar ?? 0}
                </p>
              </div>
              <div className="bg-[#fff3d6] border-2 border-[#f0dfb4] rounded-2xl p-3.5">
                <p className="text-[11px] text-[#6b6a85] font-extrabold uppercase">Jawaban Salah</p>
                <p className="bk-h text-2xl font-extrabold text-[#d63b3b] mt-0.5">
                  {hasilAkhir?.totalJawabanSalah ?? 0}
                </p>
              </div>
            </div>

            {/* Top 3 Podium dengan Karakter 2D Juara */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-1">
              {/* Juara 2: Kalung Medali Perak */}
              {podium.juara2 && (
                <div className="order-2 md:order-1 bg-[#fff3d6] border-2 border-[#cbd5e1] rounded-[20px] p-5 text-center flex flex-col items-center">
                  <KarakterPanjatPinang
                    nama={podium.juara2.nama}
                    pose="podium"
                    ekspresi="bahagia"
                    podiumRank={2}
                    size="md"
                    className="mb-2"
                  />
                  <span className="inline-block px-3 py-0.5 rounded-full bg-[#dfe3ee] text-[#394060] text-xs font-extrabold mb-1.5">
                    Juara 2 • Medali Perak
                  </span>
                  <h3 className="bk-h text-xl font-extrabold text-[#2b2a4a] truncate max-w-full">
                    {podium.juara2.nama}
                  </h3>
                  <p className="bk-h text-2xl font-extrabold text-[#1f9d55] mt-0.5">
                    {podium.juara2.posisi}%
                  </p>
                  <p className="text-xs font-bold text-[#6b6a85] mt-1">
                    Akurasi {podium.juara2.akurasiPersen}% • Jatuh ke dasar {podium.juara2.jatuhKeDasar ?? 0}x • Rata-rata {formatDurasiDetik(podium.juara2.rataRataWaktuJawabMs)}
                  </p>
                </div>
              )}

              {/* Juara 1: Mahkota Emas */}
              {podium.juara1 && (
                <div className="order-1 md:order-2 bg-gradient-to-b from-[#fff3c4] to-[#fff3d6] border-[3px] border-[#ffb81c] rounded-[20px] p-6 text-center shadow-md flex flex-col items-center">
                  <KarakterPanjatPinang
                    nama={podium.juara1.nama}
                    pose="podium"
                    ekspresi="bahagia"
                    podiumRank={1}
                    size="lg"
                    className="mb-2"
                  />
                  <span className="inline-block px-3 py-0.5 rounded-full bg-[#ffb81c] text-[#4a3000] text-xs font-extrabold mb-1.5">
                    Juara 1 • Pemenang Puncak
                  </span>
                  <h3 className="bk-h text-2xl font-extrabold text-[#e2312d] truncate max-w-full">
                    {podium.juara1.nama}
                  </h3>
                  <p className="bk-h text-3xl font-extrabold text-[#2b2a4a] mt-0.5">
                    {podium.juara1.posisi}%
                  </p>
                  <p className="text-xs font-bold text-[#6b6a85] mt-1">
                    Benar {podium.juara1.totalBenar} • Akurasi {podium.juara1.akurasiPersen}% • Jatuh ke dasar {podium.juara1.jatuhKeDasar ?? 0}x •{' '}
                    {podium.juara1.waktuSelesaiMs
                      ? `Selesai ${formatDurasiDetik(podium.juara1.waktuSelesaiMs)}`
                      : `Rata-rata ${formatDurasiDetik(podium.juara1.rataRataWaktuJawabMs)}`}
                  </p>
                </div>
              )}

              {/* Juara 3: Kalung Medali Perunggu */}
              {podium.juara3 && (
                <div className="order-3 bg-[#fff3d6] border-2 border-[#d99b52] rounded-[20px] p-5 text-center flex flex-col items-center">
                  <KarakterPanjatPinang
                    nama={podium.juara3.nama}
                    pose="podium"
                    ekspresi="bahagia"
                    podiumRank={3}
                    size="md"
                    className="mb-2"
                  />
                  <span className="inline-block px-3 py-0.5 rounded-full bg-[#f4dec0] text-[#7c2d12] text-xs font-extrabold mb-1.5">
                    Juara 3 • Medali Perunggu
                  </span>
                  <h3 className="bk-h text-xl font-extrabold text-[#2b2a4a] truncate max-w-full">
                    {podium.juara3.nama}
                  </h3>
                  <p className="bk-h text-2xl font-extrabold text-[#1f9d55] mt-0.5">
                    {podium.juara3.posisi}%
                  </p>
                  <p className="text-xs font-bold text-[#6b6a85] mt-1">
                    Akurasi {podium.juara3.akurasiPersen}% • Jatuh ke dasar {podium.juara3.jatuhKeDasar ?? 0}x • Rata-rata {formatDurasiDetik(podium.juara3.rataRataWaktuJawabMs)}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Tabel Laporan Lengkap Semua Pemain */}
          <section className="bk-card space-y-4">
            <div>
              <h2 className="bk-h text-xl font-extrabold text-[#2b2a4a]">Laporan Detail Pemain</h2>
              <p className="text-xs font-bold text-[#6b6a85]">
                Diurutkan berdasarkan status puncak, waktu selesai tercepat, posisi tertinggi, jumlah benar, dan kecepatan jawab.
              </p>
            </div>

            <div className="bk-hm-wrap">
              <table className="bk-hm text-left">
                <thead>
                  <tr>
                    <th className="px-3 py-2.5">Rank</th>
                    <th className="nm px-3 py-2.5">Nama Pemain</th>
                    <th className="px-3 py-2.5 text-right">Posisi</th>
                    <th className="px-3 py-2.5 text-right">Bonus</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-center">Benar / Salah</th>
                    <th className="px-3 py-2.5 text-right">Akurasi</th>
                    <th className="px-3 py-2.5 text-right">Streak Maks</th>
                    <th className="px-3 py-2.5 text-center">Jatuh</th>
                    <th className="px-3 py-2.5 text-right">Rata Jawab</th>
                    <th className="px-3 py-2.5 text-right">Waktu Selesai</th>
                    <th className="px-3 py-2.5 text-center">Rintangan</th>
                  </tr>
                </thead>
                <tbody>
                  {laporanPemain.map((p) => (
                    <tr key={p.id} className="hover:bg-[#fff8e7]/70 transition-colors">
                      <td className="px-3 py-2.5 font-extrabold text-[#e2312d]">#{p.peringkat}</td>
                      <td className="nm px-3 py-2.5 font-extrabold text-[#2b2a4a]">{p.nama}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[#1f9d55]">
                        {p.posisiAkhir}%
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-[#c48300]">
                        {p.poinBonus > 0 ? `+${p.poinBonus}` : '-'}
                      </td>
                      <td className="px-3 py-2.5">
                        {p.status === 'selesai' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e9f9ef] text-[#1f9d55] text-[11px] font-extrabold">
                            <CheckCircle2 className="w-3 h-3" /> Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#f4f3f8] text-[#6b6a85] text-[11px] font-bold">
                            Belum Selesai
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono">
                        <span className="text-[#1f9d55] font-extrabold">{p.totalBenar}</span>
                        <span className="text-[#9e9cb3] mx-1">/</span>
                        <span className="text-[#d63b3b] font-extrabold">{p.totalSalah}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[#2b2a4a]">
                        {p.akurasiPersen}%
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[#e6a100]">
                        {p.streakTertinggi}x
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-extrabold text-[#d63b3b]">
                        {p.jatuhKeDasar ? `${p.jatuhKeDasar}x` : '0x'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#6b6a85]">
                        {formatDurasiDetik(p.rataRataWaktuJawabMs)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-[#1f9d55]">
                        {formatDurasiDetik(p.waktuSelesaiMs)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setDetailPemain(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#fff3d6] hover:bg-[#ffe9a8] border border-[#f0dfb4] text-[#2b2a4a] font-extrabold transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{p.riwayatRintangan?.length || 0}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Statistik Soal (jika tersedia) */}
          {statsSoal.length > 0 && (
            <section className="bk-card space-y-3">
              <h3 className="bk-h text-lg font-extrabold text-[#2b2a4a]">
                Statistik Tingkat Kesulitan Soal
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {statsSoal.map((sq, idx) => (
                  <div
                    key={sq.questionId}
                    className="bg-[#fffaf0] border-2 border-[#f0dfb4] rounded-2xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-extrabold uppercase text-[#6b6a85]">
                        Soal #{idx + 1}
                      </span>
                      <p className="text-xs font-bold text-[#2b2a4a] line-clamp-2">{sq.teks}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-extrabold text-[#1f9d55] block">
                        {sq.totalBenar} Benar
                      </span>
                      <span className="text-[11px] font-mono font-bold text-[#d63b3b]">
                        {sq.totalSalah} Salah ({sq.tingkatSalahPersen}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        {/* Modal Riwayat Rintangan & Pergerakan Pemain */}
        <Modal
          isOpen={Boolean(detailPemain)}
          onClose={() => setDetailPemain(null)}
          title={`Riwayat Permainan: ${detailPemain?.nama || ''}`}
          maxWidth="xl"
          variant="standard"
        >
          {detailPemain && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-[#2b2a4a]">
              <div className="grid grid-cols-3 gap-2 text-center bg-[#fff3d6] border border-[#f0dfb4] rounded-xl p-3 text-xs">
                <div>
                  <span className="text-[#6b6a85] font-bold block">Posisi Akhir</span>
                  <span className="font-extrabold text-[#1f9d55] text-base">{detailPemain.posisiAkhir}%</span>
                </div>
                <div>
                  <span className="text-[#6b6a85] font-bold block">Akurasi</span>
                  <span className="font-extrabold text-[#2b2a4a] text-base">{detailPemain.akurasiPersen}%</span>
                </div>
                <div>
                  <span className="text-[#6b6a85] font-bold block">Streak Maks</span>
                  <span className="font-extrabold text-[#e6a100] text-base">{detailPemain.streakTertinggi}x</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#6b6a85] mb-2">
                  Riwayat Rintangan ({detailPemain.riwayatRintangan?.length || 0})
                </h4>
                {!detailPemain.riwayatRintangan || detailPemain.riwayatRintangan.length === 0 ? (
                  <p className="text-xs text-[#6b6a85] italic bg-[#fffaf0] border border-[#f0dfb4] p-3 rounded-xl">
                    Pemain ini tidak mengalami rintangan selama permainan.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detailPemain.riwayatRintangan.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-xl bg-[#fff3c4] border border-[#ffb81c] text-xs flex items-start justify-between gap-2"
                      >
                        <div>
                          <p className="font-extrabold text-[#7a5200]">{r.judul}</p>
                          <p className="text-[#6b4423] mt-0.5">{r.deskripsi}</p>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-white border border-[#f0dfb4] font-mono font-bold text-[#7a5200]">
                          {r.efekNilai !== 0 ? `${r.efekNilai > 0 ? '+' : ''}${r.efekNilai} ${r.satuan}` : r.satuan}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // FASE 2: PERMAINAN BERLANGSUNG (TIANG PINANG MULTI-PEMAIN + LEADERBOARD)
  // -------------------------------------------------------------------------
  const totalSelesaiCount = leaderboard.filter((p) => p.status === 'selesai').length;
  const maxVisualTiang = tampilSemuaTiang ? leaderboard.length : Math.min(leaderboard.length, 12);
  const pesertaVisual = leaderboard.slice(0, maxVisualTiang);

  return (
    <div className="bk-festival">
      {stadiumHeader}

      <main className="bk-wrap space-y-4">
        {/* Live Feed Aktivitas */}
        {liveFeed.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-1">
            {liveFeed.map((item) => {
              const warna =
                item.tipe === 'puncak'
                  ? 'bg-[#fff3c4] border-[#ffb81c] text-[#7a5200]'
                  : item.tipe === 'rintangan'
                  ? 'bg-[#f3e8ff] border-[#c084fc] text-[#581c87]'
                  : item.tipe === 'bonus'
                  ? 'bg-[#e9f9ef] border-[#9de0b6] text-[#136837]'
                  : item.tipe === 'turun'
                  ? 'bg-[#fdecec] border-[#f4b6b6] text-[#8a1f1f]'
                  : 'bg-[#fffdf6] border-[#f0dfb4] text-[#2b2a4a]';
              return (
                <div
                  key={item.id}
                  className={`shrink-0 px-3 py-1.5 rounded-xl border-2 text-xs font-extrabold flex items-center gap-1.5 shadow-xs ${warna}`}
                >
                  <span>{item.teks}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Area Utama: Kiri Visual Tiang Pinang, Kanan Leaderboard Real-time */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Visual Tiang Para Pemimpin */}
          <section className="lg:col-span-7 bk-card flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="bk-h text-xl font-extrabold text-[#2b2a4a] flex items-center gap-2">
                  <Flag className="w-4 h-4 text-[#e2312d]" />
                  Arena Tiang Pinang ({pesertaVisual.length} dari {leaderboard.length} Pemain)
                </h2>
                <p className="text-xs font-bold text-[#6b6a85]">
                  {totalSelesaiCount} / {totalPeserta} mencapai puncak 100% • Tersinkronisasi langsung
                </p>
              </div>
              {leaderboard.length > 12 && (
                <button
                  type="button"
                  onClick={() => setTampilSemuaTiang((v) => !v)}
                  className="bk-btn alt !py-1.5 !px-3 !text-xs"
                >
                  {tampilSemuaTiang ? 'Tampilkan Top 12' : `Tampilkan Semua (${leaderboard.length})`}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[540px] overflow-y-auto pr-1">
              {pesertaVisual.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-2xl p-2.5 flex flex-col items-center gap-1.5 border-2 ${
                    p.status === 'selesai'
                      ? 'bg-[#fff8dc] border-[#ffb81c]'
                      : 'bg-[#fff3d6] border-[#f0dfb4]'
                  }`}
                >
                  <div className="w-full flex items-center justify-between text-[11px] px-1">
                    <span className="font-extrabold text-[#e2312d]">#{p.peringkat}</span>
                    {p.status === 'selesai' ? (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#e9f9ef] text-[#1f9d55] font-extrabold text-[10px]">
                        PUNCAK
                      </span>
                    ) : (
                      <span className="font-mono font-extrabold text-[#2b2a4a]">{p.posisi}%</span>
                    )}
                  </div>
                  <TiangPinangVisual
                    posisi={p.posisi}
                    namaPemain={p.nama}
                    efekAktif={p.efekAktif}
                    lastDelta={deltaMap[p.id]}
                    ekspresi={ekspresiMap[p.id]}
                    streak={p.streakSaatIni}
                    status={p.status}
                    jatuhBebas={Boolean(jatuhBebasMap[p.id])}
                    bubbleText={bubbleMap[p.id]}
                    compact
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Leaderboard Real-Time Lengkap */}
          <section className="lg:col-span-5 bk-card flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="bk-h text-xl font-extrabold text-[#2b2a4a] flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#ffb81c]" />
                  Leaderboard Real-Time
                </h2>
                {config?.allowLateJoin !== false && token ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#2b2a4a] text-[#fff3d6] text-xs font-extrabold font-mono">
                    PIN: {token}
                  </span>
                ) : (
                  <span className="bk-chip">{leaderboard.length} Pemain</span>
                )}
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {leaderboard.map((p) => (
                  <div
                    key={p.id}
                    className={`p-3 rounded-2xl border-2 transition-all ${
                      p.status === 'selesai'
                        ? 'bg-[#e9f9ef] border-[#1f9d55]'
                        : 'bg-[#fff3d6] border-[#f0dfb4]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                            p.peringkat === 1
                              ? 'bg-[#ffb81c] text-[#4a3000]'
                              : p.peringkat === 2
                              ? 'bg-[#dfe3ee] text-[#2b2a4a]'
                              : p.peringkat === 3
                              ? 'bg-[#c0814a] text-white'
                              : 'bg-white border border-[#f0dfb4] text-[#6b6a85]'
                          }`}
                        >
                          {p.peringkat}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            p.connected === false ? 'bg-[#9e9cb3]' : 'bg-[#1f9d55]'
                          }`}
                          title={p.connected === false ? 'Terputus' : 'Terhubung'}
                        />
                        <span className="font-extrabold text-sm text-[#2b2a4a] truncate">
                          {p.nama}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.efekAktif?.perisaiKulitPisang && (
                          <span title="Perisai Anti-Turun" className="text-[#1f9d55]">
                            <Shield className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {p.efekAktif?.peganganKuat && (
                          <span title="Pegangan Kuat" className="text-[#e6a100]">
                            <HandMetal className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {p.efekAktif?.tiangLicin && (
                          <span title="Tiang Licin" className="text-[#1d8fe0]">
                            <Droplets className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {p.streakSaatIni >= 2 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#fff3c4] border border-[#ffb81c] text-[#7a5200] text-[10px] font-black">
                            <Flame className="w-3 h-3" /> {p.streakSaatIni}
                          </span>
                        )}
                        <span className="font-mono font-black text-sm text-[#1f9d55]">
                          {p.posisi}%
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2.5 bg-[#e6cfa0]/50 rounded-full overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          p.status === 'selesai'
                            ? 'bg-[#1f9d55]'
                            : 'bg-gradient-to-r from-[#e2312d] via-[#ffb81c] to-[#1f9d55]'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, p.posisi))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#6b6a85] font-mono font-bold">
                      <span>
                        Benar {p.totalBenar} • Salah {p.totalSalah} • Akurasi {p.akurasiPersen}%
                      </span>
                      {p.status === 'selesai' && p.waktuSelesaiMs ? (
                        <span className="text-[#1f9d55] font-extrabold flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDurasiDetik(p.waktuSelesaiMs)}
                        </span>
                      ) : (
                        <span>{p.poinBonus > 0 ? `+${p.poinBonus} pt` : `${p.jumlahJawab} soal`}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalAkhiriOpen(true)}
              className="bk-btn w-full justify-center"
            >
              <StopCircle className="w-4 h-4" /> Akhiri Lomba
            </button>
          </section>
        </div>

        {/* Panel Kekompakan Tim (Sesuai Desain Multiplayer) */}
        {teamsData.length > 0 && (
          <section className="bk-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="bk-h text-xl font-extrabold text-[#2b2a4a] flex items-center gap-2">
                  <Flag className="w-4 h-4 text-[#e2312d]" />
                  Kekompakan Tim ({teamsData.length} Tim)
                </h2>
                <p className="text-xs font-bold text-[#6b6a85]">
                  Penopang isi Pasir • 3× Salah Beruntun = Runtuh ke Dasar • 90% = ⭐ Soal Puncak
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {teamsData.map((t) => {
                const isPuncak = t.posisi >= 90;
                const awasRuntuh = t.salahBeruntun === t.limitSalah - 1;
                return (
                  <div
                    key={t.id}
                    style={{ borderColor: t.warna }}
                    className="rounded-2xl p-4 border-[2.5px] bg-[#fffdf6] shadow-xs flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="bk-h text-lg font-black" style={{ color: t.warna }}>
                          {t.nama}
                        </h3>
                        <span className="tabular-nums font-black text-[#2b2a4a] text-lg">
                          {Math.round(t.posisi)}%
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold mb-2 text-[#6b6a85]">
                        {isPuncak && (
                          <span className="px-2 py-0.5 rounded-full bg-[#fff0c9] text-[#b87700] border border-[#f3d37a] text-[11px] font-black animate-pulse">
                            ⭐ Soal Puncak
                          </span>
                        )}
                        <span className="bg-[#fff3d6] px-2 py-0.5 rounded-lg border border-[#f0dfb4] text-[#7a5200] font-mono">
                          Pasir {'●'.repeat(t.sisaPasir)}{'○'.repeat(3 - t.sisaPasir)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg font-mono ${
                            awasRuntuh
                              ? 'bg-[#fdecec] text-[#d63b3b] border border-[#f4b6b6] font-black animate-bounce'
                              : 'bg-[#f4f3f8] text-[#6b6a85]'
                          }`}
                        >
                          Salah {t.salahBeruntun}/{t.limitSalah} {awasRuntuh ? '⚠️ Awas runtuh!' : ''}
                        </span>
                      </div>

                      {/* Progress Bar Tim */}
                      <div className="w-full h-3 bg-[#e6cfa0]/40 rounded-full overflow-hidden p-0.5 border border-[#f0dfb4] mb-3">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${Math.max(0, Math.min(100, t.posisi))}%`,
                            background: isPuncak
                              ? 'linear-gradient(90deg, #ffb81c, #ffd23f)'
                              : `linear-gradient(90deg, #ffb81c, ${t.warna})`,
                          }}
                        />
                      </div>

                      {/* Daftar Anggota Tim */}
                      <ul className="space-y-1.5 text-xs">
                        {t.anggota.map(({ item: m, role }) => (
                          <li
                            key={m.id}
                            className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-[#fffaf0] border border-[#f0dfb4]/60"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-extrabold text-[#2b2a4a] truncate max-w-[120px]">
                                {m.nama}
                              </span>
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white border border-[#f0dfb4] text-[#6b6a85]">
                                {role}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
                              <span className="text-[#1f9d55] font-black">{m.totalBenar}</span>
                              <span className="text-[#9e9cb3]">/</span>
                              <span className="text-[#d63b3b] font-black">{m.totalSalah}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Modal Konfirmasi Akhiri Sesi Manual */}
      <Modal
        isOpen={modalAkhiriOpen}
        onClose={() => setModalAkhiriOpen(false)}
        title="Akhiri Lomba Panjat Pinang?"
        maxWidth="md"
        variant="standard"
      >
        <div className="space-y-4 text-[#2b2a4a]">
          <p className="text-sm leading-relaxed text-[#6b6a85]">
            Seluruh siswa akan langsung melihat hasil akhir dan peringkat saat ini. Sesi yang dihentikan manual tidak dapat dilanjutkan kembali.
          </p>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setModalAkhiriOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#f0dfb4] bg-[#fffdf6] text-xs font-extrabold text-[#2b2a4a] cursor-pointer"
            >
              Lanjutkan Lomba
            </button>
            <button
              type="button"
              onClick={handleAkhiriManual}
              disabled={isEnding}
              className="bk-btn"
            >
              {isEnding ? 'Mengakhiri...' : 'Ya, Akhiri Sekarang'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Keluar Game Sedang Berjalan */}
      <ModalKonfirmasiKeluar
        isOpen={modalKeluarOpen}
        onClose={() => setModalKeluarOpen(false)}
        onKonfirmasiKeluar={handleKonfirmasiKeluar}
        judulGame="Panjat Pinang"
      />
    </div>
  );
}
