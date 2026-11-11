import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router';
import { getSocket } from '../../lib/socket';
import { soundEffects } from '../../lib/soundEffects';
import MainKerupuk from './MainKerupuk';
import MainPanjatPinang from './MainPanjatPinang';
import MainBalapKarung from './MainBalapKarung';
import KarakterTarikTambang from './KarakterTarikTambang';
import {
  Users,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  LogOut,
  ShieldAlert,
  Loader2,
  ArrowLeft,
  Flame,
  Lock,
  Zap,
} from 'lucide-react';

interface SoalData {
  presentationId?: string;
  id: string;
  questionId?: string;
  nomorSoal: number;
  nomorRonde?: number;
  totalSoal: number;
  teks: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  pilihan?: Array<{ choiceId: string; label: 'A' | 'B' | 'C'; teks: string }>;
  endsAt?: number;
  duration?: number;
}

interface SelesaiResult {
  timMenang: 'merah' | 'putih' | 'seri';
  konfigurasi?: { namaTim1?: string; namaTim2?: string };
  namaTim1?: string;
  namaTim2?: string;
  posisiAkhir: number;
  skorMerah: number;
  skorPutih: number;
  akurasiTim1?: number;
  akurasiTim2?: number;
  akurasiTim1Persen?: number;
  akurasiTim2Persen?: number;
}

export default function MainSiswa() {
  const [searchParams] = useSearchParams();

  // Form states
  const [tokenInput, setTokenInput] = useState(searchParams.get('token') || '');
  const [namaInput, setNamaInput] = useState(searchParams.get('nama') || '');
  const [formError, setFormError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinStep, setJoinStep] = useState<'PIN' | 'NAMA'>(
    searchParams.get('token') && searchParams.get('token')!.trim().length === 6 ? 'NAMA' : 'PIN'
  );

  // Session states
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pesertaId, setPesertaId] = useState<string | null>(null);
  const [panjatSecret, setPanjatSecret] = useState<string>('');
  const [namaPeserta, setNamaPeserta] = useState<string>('');
  const [templateJudul, setTemplateJudul] = useState<string>('');
  const [tim, setTim] = useState<'merah' | 'putih' | null>(null);
  const [gameType, setGameType] = useState<'tarik_tambang' | 'makan_kerupuk' | 'panjat_pinang' | 'balap_karung'>('tarik_tambang');
  const [kerupukState, setKerupukState] = useState<any>(undefined);
  const [kerupukLeaderboard, setKerupukLeaderboard] = useState<any[]>([]);
  const [kerupukSoalAktif, setKerupukSoalAktif] = useState<any>(null);
  const [panjatConfig, setPanjatConfig] = useState<any>(undefined);
  const [panjatState, setPanjatState] = useState<any>(undefined);
  const [panjatLeaderboard, setPanjatLeaderboard] = useState<any[]>([]);
  const [panjatSoalAktif, setPanjatSoalAktif] = useState<any>(null);
  const [balapConfig, setBalapConfig] = useState<any>(undefined);
  const [balapState, setBalapState] = useState<any>(undefined);
  const [balapLeaderboard, setBalapLeaderboard] = useState<any[]>([]);
  const [balapSoalAktif, setBalapSoalAktif] = useState<any>(null);
  const [stage, setStage] = useState<'GABUNG' | 'LOBBY' | 'PLAYING' | 'SELESAI'>('GABUNG');

  // Lobby states
  const [totalPeserta, setTotalPeserta] = useState<number>(0);
  const [daftarPeserta, setDaftarPeserta] = useState<Array<{ id: string; nama: string; tim: 'merah' | 'putih' | null }>>([]);

  // In-Game states
  const [tarikConfig, setTarikConfig] = useState<{
    namaTim1: string;
    namaTim2: string;
    durasiRonde: number;
    bonusAktif: boolean;
    powerUpAktif: boolean;
  }>({
    namaTim1: 'Tim Merah',
    namaTim2: 'Tim Biru',
    durasiRonde: 20,
    bonusAktif: true,
    powerUpAktif: true,
  });
  const [powerUpTim, setPowerUpTim] = useState<{
    bank: string | null;
    aktifBerikutnya: string | null;
  }>({ bank: null, aktifBerikutnya: null });
  const [pesertaStat, setPesertaStat] = useState<{
    totalBenar: number;
    totalSalah: number;
    jumlahJawab: number;
    akurasiPersen: number;
    streakSaatIni: number;
    streakTertinggi: number;
  }>({
    totalBenar: 0,
    totalSalah: 0,
    jumlahJawab: 0,
    akurasiPersen: 0,
    streakSaatIni: 0,
    streakTertinggi: 0,
  });
  const [soalAktif, setSoalAktif] = useState<SoalData | null>(null);
  const [sisaDetik, setSisaDetik] = useState<number>(20);
  const [jawabanDipilih, setJawabanDipilih] = useState<'A' | 'B' | 'C' | null>(null);
  const [pickedChoiceId, setPickedChoiceId] = useState<string | null>(null);
  const [sudahKirim, setSudahKirim] = useState(false);
  const [feedback, setFeedback] = useState<{
    tampil: boolean;
    benar?: boolean;
    jawabanBenar?: string;
    penjelasan?: string | null;
    infoRonde?: string;
  } | null>(null);

  // Score & Rope states
  const [taliPosition, setTaliPosition] = useState<number>(0);
  const [skorMerah, setSkorMerah] = useState<number>(0);
  const [skorPutih, setSkorPutih] = useState<number>(0);

  // Final Result state
  const [hasilAkhir, setHasilAkhir] = useState<SelesaiResult | null>(null);

  // Timer reference
  const countdownIntervalRef = useRef<any>(null);

  // Sinkronisasi countdown timer lokal terhadap endsAt dari server
  const startCountdown = useCallback((endsAtTimestamp?: number) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (!endsAtTimestamp) {
      setSisaDetik(15);
      return;
    }

    const hitungSisa = () => {
      const now = Date.now();
      const diffMs = endsAtTimestamp - now;
      const detik = Math.max(0, Math.ceil(diffMs / 1000));
      setSisaDetik(detik);
      if (detik <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    };

    hitungSisa();
    countdownIntervalRef.current = setInterval(hitungSisa, 200);
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Otomatis Reconnect jika ada session tersimpan di sessionStorage
  useEffect(() => {
    const savedToken = sessionStorage.getItem('discere_multi_token');
    const savedPesertaId = sessionStorage.getItem('discere_multi_peserta_id');
    const savedNama = sessionStorage.getItem('discere_multi_nama');
    const savedSecret = sessionStorage.getItem('discere_multi_peserta_secret') || undefined;

    if (savedToken && savedPesertaId && savedNama) {
      const socket = getSocket();
      socket.emit(
        'sesi:gabung',
        { token: savedToken, nama: savedNama, pesertaId: savedPesertaId, pesertaSecret: savedSecret },
        (res: any) => {
          if (res?.success) {
            setSessionId(res.sessionId);
            setPesertaId(res.pesertaId);
            setNamaPeserta(savedNama);
            setTokenInput(savedToken);
            setTemplateJudul(res.templateJudul || '');
            if (res.pesertaSecret) {
              sessionStorage.setItem('discere_multi_peserta_secret', res.pesertaSecret);
              setPanjatSecret(res.pesertaSecret);
            } else if (savedSecret) {
              setPanjatSecret(savedSecret);
            }
            if (res.game === 'makan_kerupuk') {
              setGameType('makan_kerupuk');
              setKerupukState(res.peserta);
              setKerupukLeaderboard(res.leaderboard || []);
              setKerupukSoalAktif(res.soalAktif || null);
            } else if (res.game === 'panjat_pinang') {
              setGameType('panjat_pinang');
              setPanjatConfig(res.config);
              setPanjatState(res.peserta);
              setPanjatLeaderboard(res.leaderboard || []);
              setPanjatSoalAktif(res.soalAktif || null);
            } else if (res.game === 'balap_karung') {
              setGameType('balap_karung');
              setBalapConfig(res.config);
              setBalapState(res.peserta);
              setBalapLeaderboard(res.leaderboard || []);
              setBalapSoalAktif(res.soalAktif || null);
            } else {
              setGameType('tarik_tambang');
            }
            if (res.tim) setTim(res.tim);
            if (res.config) setTarikConfig((prev) => ({ ...prev, ...res.config }));
            if (res.powerUpTim) setPowerUpTim(res.powerUpTim);
            if (res.pesertaStat) setPesertaStat(res.pesertaStat);
            setTaliPosition(res.taliPosition ?? 0);
            setSkorMerah(res.skorMerah ?? 0);
            setSkorPutih(res.skorPutih ?? 0);

            if (res.status === 'jalan') {
              setStage('PLAYING');
              if (res.game !== 'panjat_pinang' && res.game !== 'balap_karung' && res.soalAktif) {
                const resolvedId = res.soalAktif.id || (res.soalAktif as any).questionId || '';
                setSoalAktif({
                  ...res.soalAktif,
                  id: resolvedId,
                  questionId: resolvedId,
                });
                startCountdown(res.soalAktif.endsAt);
                if (res.sudahJawabRondeAktif || res.sudahJawabSoalAktif) {
                  setSudahKirim(true);
                }
              }
            } else if (res.status === 'selesai') {
              if (res.hasil) setHasilAkhir(res.hasil);
              setStage('SELESAI');
            } else {
              setStage('LOBBY');
            }
          }
        }
      );
    }
  }, [startCountdown]);

  // Setup Socket listeners (khusus Tarik Tambang; game lain ditangani komponennya masing-masing)
  useEffect(() => {
    if (gameType !== 'tarik_tambang') return;
    const socket = getSocket();

    // 1. Pembaruan Peserta di Lobi
    const handleLobiUpdate = (data: {
      totalPeserta: number;
      daftarPeserta: any[];
      config?: any;
    }) => {
      setTotalPeserta(data.totalPeserta);
      setDaftarPeserta(data.daftarPeserta);
      if (data.config) setTarikConfig((prev) => ({ ...prev, ...data.config }));
      const me = data.daftarPeserta?.find((p) => p.id === pesertaId);
      if (me?.tim) setTim(me.tim);
    };

    // 2. Pembagian Tim dari Server
    const handleTeamsAssigned = (data: { daftarPeserta: any[] }) => {
      setDaftarPeserta(data.daftarPeserta);
      const current = data.daftarPeserta.find((p) => p.id === pesertaId);
      if (current?.tim) {
        setTim(current.tim);
      }
    };

    // 3. Soal Baru Ditampilkan (khusus tim sendiri)
    const handleSoalTampil = (data: any) => {
      setStage('PLAYING');
      const resolvedId = data.id || data.questionId || '';
      const resolvedQuestionId = data.questionId || data.id || '';
      setSoalAktif({
        ...data,
        id: resolvedId,
        questionId: resolvedQuestionId,
      });
      setJawabanDipilih(null);
      setPickedChoiceId(null);
      setSudahKirim(false);
      setFeedback(null);
      startCountdown(data.endsAt);
    };

    // 4. Update Progres & Tali Real-Time
    const handleTaliUpdate = (data: {
      taliPosition: number;
      skorMerah: number;
      skorPutih: number;
    }) => {
      setTaliPosition(data.taliPosition);
      setSkorMerah(data.skorMerah);
      setSkorPutih(data.skorPutih);
    };

    // 4b. Pembaruan Status Power-Up Tim
    const handlePowerUpUpdate = (data: any) => {
      if (tim === 'merah' && data.powerUpTim1) {
        setPowerUpTim(data.powerUpTim1);
      } else if (tim === 'putih' && data.powerUpTim2) {
        setPowerUpTim(data.powerUpTim2);
      }
    };

    // 5. Ronde Berakhir (ungkap kunci, evaluasi tim, power-up & statistik)
    const handleSoalSelesai = (data: any) => {
      setTaliPosition(data.taliPosition ?? 0);
      setSkorMerah(data.skorMerah ?? 0);
      setSkorPutih(data.skorPutih ?? 0);

      if (tim === 'merah' && data.powerUpTim1) setPowerUpTim(data.powerUpTim1);
      if (tim === 'putih' && data.powerUpTim2) setPowerUpTim(data.powerUpTim2);

      const me = data.daftarPeserta?.find((p: any) => p.id === pesertaId);
      if (me) {
        setPesertaStat({
          totalBenar: me.totalBenar ?? 0,
          totalSalah: me.totalSalah ?? 0,
          jumlahJawab: me.jumlahJawab ?? 0,
          akurasiPersen: me.akurasiPersen ?? 0,
          streakSaatIni: me.streakSaatIni ?? 0,
          streakTertinggi: me.streakTertinggi ?? 0,
        });
      }

      const hr = data.hasilRonde;
      const isTim1 = tim === 'merah';
      const kunciTim = hr ? (isTim1 ? hr.tim1Kunci : hr.tim2Kunci) : data.jawabanBenar;
      const penjelasanTim = hr
        ? isTim1
          ? hr.tim1Penjelasan
          : hr.tim2Penjelasan
        : data.penjelasan;
      const akurasiTimRonde = hr ? (isTim1 ? hr.akurasiTim1 : hr.akurasiTim2) : null;

      const siswaBenar =
        Boolean(sudahKirim && jawabanDipilih && kunciTim && jawabanDipilih === kunciTim);

      if (siswaBenar) soundEffects.playCorrect();
      else soundEffects.playIncorrect();

      setFeedback({
        tampil: true,
        benar: siswaBenar,
        jawabanBenar: kunciTim,
        penjelasan: penjelasanTim,
        infoRonde:
          hr && akurasiTimRonde !== null
            ? `Akurasi timmu ronde ini: ${akurasiTimRonde}% • Perubahan tali: ${
                hr.perubahanTali > 0 ? `+${hr.perubahanTali}` : hr.perubahanTali
              }`
            : undefined,
      });
    };

    // 5b. Konfirmasi Kunci Jawaban (TIDAK ada kunci sebelum ronde berakhir)
    const handleJawabHasil = (data: {
      success: boolean;
      terkunci?: boolean;
      benar?: boolean;
      jawabanBenar?: string;
      penjelasan?: string;
    }) => {
      if (data?.success && data.terkunci) {
        setSudahKirim(true);
      }
    };

    // 6. Seluruh Permainan Selesai
    const handleSesiSelesai = (data: { hasil: SelesaiResult }) => {
      setHasilAkhir(data.hasil);
      setStage('SELESAI');
      soundEffects.playVictoryFanfare();
      sessionStorage.removeItem('discere_multi_token');
      sessionStorage.removeItem('discere_multi_peserta_id');
      sessionStorage.removeItem('discere_multi_nama');
      sessionStorage.removeItem('discere_multi_peserta_secret');
    };

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('teams_assigned', handleTeamsAssigned);
    socket.on('soal:tampil', handleSoalTampil);
    socket.on('tali:update', handleTaliUpdate);
    socket.on('powerup:update', handlePowerUpUpdate);
    socket.on('soal:selesai', handleSoalSelesai);
    socket.on('jawab:hasil', handleJawabHasil);
    socket.on('sesi:selesai', handleSesiSelesai);

    return () => {
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('teams_assigned', handleTeamsAssigned);
      socket.off('soal:tampil', handleSoalTampil);
      socket.off('tali:update', handleTaliUpdate);
      socket.off('powerup:update', handlePowerUpUpdate);
      socket.off('soal:selesai', handleSoalSelesai);
      socket.off('jawab:hasil', handleJawabHasil);
      socket.off('sesi:selesai', handleSesiSelesai);
    };
  }, [pesertaId, startCountdown, gameType, tim, sudahKirim, jawabanDipilih]);

  // Handler: Siswa Submit PIN (Langkah 1)
  const handleNextToName = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const clean = tokenInput.trim().replace(/\D/g, '');
    if (!clean || clean.length !== 6) {
      setFormError('Kode PIN harus terdiri dari 6 angka.');
      return;
    }
    setTokenInput(clean);
    setJoinStep('NAMA');
  };

  // Handler: Siswa Submit Form Gabung (Langkah 2)
  const handleGabung = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanToken = tokenInput.trim().toUpperCase();
    const cleanNama = namaInput.trim();

    if (!cleanToken || cleanToken.length !== 6) {
      setJoinStep('PIN');
      setFormError('Kode PIN harus terdiri dari 6 angka.');
      return;
    }

    if (!cleanNama) {
      setFormError('Nama panggilan wajib diisi.');
      return;
    }

    setIsJoining(true);
    const socket = getSocket();

    socket.emit(
      'sesi:gabung',
      { token: cleanToken, nama: cleanNama },
      (res: {
        success: boolean;
        pesan?: string;
        pesertaId?: string;
        sessionId?: string;
        templateJudul?: string;
        status?: string;
        tim?: 'merah' | 'putih' | null;
        taliPosition?: number;
        skorMerah?: number;
        skorPutih?: number;
        soalAktif?: SoalData & { endsAt?: number };
      }) => {
        setIsJoining(false);
        if (!res?.success) {
          setFormError(res?.pesan || 'Gagal bergabung ke sesi.');
          return;
        }

        // Simpan sesi ke sessionStorage
        sessionStorage.setItem('discere_multi_token', cleanToken);
        sessionStorage.setItem('discere_multi_peserta_id', res.pesertaId!);
        sessionStorage.setItem('discere_multi_nama', cleanNama);
        if ((res as any).pesertaSecret) {
          sessionStorage.setItem('discere_multi_peserta_secret', (res as any).pesertaSecret);
          setPanjatSecret((res as any).pesertaSecret);
        }

        setSessionId(res.sessionId!);
        setPesertaId(res.pesertaId!);
        setNamaPeserta(cleanNama);
        setTemplateJudul(res.templateJudul || '');

        if ((res as any).game === 'makan_kerupuk') {
          setGameType('makan_kerupuk');
          setKerupukState((res as any).peserta);
          setKerupukLeaderboard((res as any).leaderboard || []);
          setKerupukSoalAktif((res as any).soalAktif || null);
        } else if ((res as any).game === 'panjat_pinang') {
          setGameType('panjat_pinang');
          setPanjatConfig((res as any).config);
          setPanjatState((res as any).peserta);
          setPanjatLeaderboard((res as any).leaderboard || []);
          setPanjatSoalAktif((res as any).soalAktif || null);
        } else if ((res as any).game === 'balap_karung') {
          setGameType('balap_karung');
          setBalapConfig((res as any).config);
          setBalapState((res as any).peserta);
          setBalapLeaderboard((res as any).leaderboard || []);
          setBalapSoalAktif((res as any).soalAktif || null);
        } else {
          setGameType('tarik_tambang');
        }

        if (res.tim) setTim(res.tim);
        if ((res as any).config) setTarikConfig((prev) => ({ ...prev, ...(res as any).config }));
        if ((res as any).powerUpTim) setPowerUpTim((res as any).powerUpTim);
        if ((res as any).pesertaStat) setPesertaStat((res as any).pesertaStat);
        setTaliPosition(res.taliPosition ?? 0);
        setSkorMerah(res.skorMerah ?? 0);
        setSkorPutih(res.skorPutih ?? 0);

        if (res.status === 'jalan') {
          setStage('PLAYING');
          if (
            (res as any).game !== 'makan_kerupuk' &&
            (res as any).game !== 'panjat_pinang' &&
            (res as any).game !== 'balap_karung' &&
            res.soalAktif
          ) {
            const resolvedId = res.soalAktif.id || (res.soalAktif as any).questionId || '';
            setSoalAktif({
              ...res.soalAktif,
              id: resolvedId,
              questionId: resolvedId,
            });
            startCountdown(res.soalAktif.endsAt);
            if ((res as any).sudahJawabRondeAktif || (res as any).sudahJawabSoalAktif) {
              setSudahKirim(true);
            }
          }
        } else if (res.status === 'selesai') {
          if ((res as any).hasil) setHasilAkhir((res as any).hasil);
          setStage('SELESAI');
        } else {
          setStage('LOBBY');
        }
      }
    );
  };

  // Handler: Siswa Mengirim Jawaban (choiceId / A / B / C)
  const handlePilihJawaban = (opsi: 'A' | 'B' | 'C', choiceId?: string) => {
    if (sudahKirim || !sessionId || !pesertaId || !soalAktif) return;

    setJawabanDipilih(opsi);
    if (choiceId) setPickedChoiceId(choiceId);
    setSudahKirim(true);

    const targetId = soalAktif.questionId || soalAktif.id || '';

    const socket = getSocket();
    socket.emit(
      'jawab:kirim',
      {
        sessionId,
        pesertaId,
        pesertaSecret: panjatSecret || undefined,
        presentationId: soalAktif.presentationId,
        choiceId,
        questionId: targetId,
        id: targetId,
        jawaban: opsi,
      },
      (res: { success: boolean; terkunci?: boolean; pesan?: string }) => {
        if (!res?.success) {
          setSudahKirim(false);
          setJawabanDipilih(null);
          setPickedChoiceId(null);
          setFormError(res?.pesan || 'Gagal mengirim jawaban.');
        } else {
          setFormError(null);
        }
      }
    );
  };

  const handleAktifkanPowerUp = () => {
    if (!sessionId || !pesertaId || !tim || !powerUpTim.bank) return;
    getSocket().emit(
      'powerup:aktifkan',
      {
        sessionId,
        tim,
        pesertaId,
        pesertaSecret: panjatSecret || undefined,
      },
      (res: any) => {
        if (res?.success) {
          soundEffects.playBoost();
        } else if (res?.pesan) {
          setFormError(res.pesan);
        }
      }
    );
  };

  // Handler: Siswa Keluar dari Sesi
  const handleKeluar = () => {
    sessionStorage.removeItem('discere_multi_token');
    sessionStorage.removeItem('discere_multi_peserta_id');
    sessionStorage.removeItem('discere_multi_nama');
    sessionStorage.removeItem('discere_multi_peserta_secret');
    setStage('GABUNG');
    setSessionId(null);
    setPesertaId(null);
    setPickedChoiceId(null);
    setJawabanDipilih(null);
    setSudahKirim(false);
    setFeedback(null);
    setHasilAkhir(null);
    setPowerUpTim({ bank: null, aktifBerikutnya: null });
    setPesertaStat({
      totalBenar: 0,
      totalSalah: 0,
      jumlahJawab: 0,
      akurasiPersen: 0,
      streakSaatIni: 0,
      streakTertinggi: 0,
    });
    setPanjatSecret('');
    setPanjatConfig(undefined);
    setPanjatState(undefined);
    setPanjatLeaderboard([]);
    setPanjatSoalAktif(null);
    setBalapConfig(undefined);
    setBalapState(undefined);
    setBalapLeaderboard([]);
    setBalapSoalAktif(null);
    setTim(null);
    setSoalAktif(null);
    setFeedback(null);
    setHasilAkhir(null);
  };

  // ==========================================
  // RENDER STAGE 1: FORM GABUNG (DESAIN PAPAN TULIS FULL LAYAR MURNI CSS/SVG)
  // ==========================================
  if (stage === 'GABUNG') {
    return (
      <div
        className="relative min-h-screen w-full flex flex-col justify-between items-center overflow-hidden select-none"
        style={{
          backgroundColor: '#163a2b',
          backgroundImage: `
            radial-gradient(ellipse at 15% 15%, rgba(255, 255, 255, 0.12) 0%, transparent 45%),
            radial-gradient(ellipse at 85% 25%, rgba(255, 255, 255, 0.09) 0%, transparent 42%),
            radial-gradient(ellipse at 30% 70%, rgba(255, 255, 255, 0.11) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(255, 255, 255, 0.10) 0%, transparent 46%),
            radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.05) 0%, transparent 60%),
            radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0, 0, 0, 0.45) 100%),
            linear-gradient(175deg, #2b5641 0%, #204634 50%, #173829 100%)
          `,
        }}
      >
        <style>{`
          @keyframes joinBackBtnIn {
            from {
              opacity: 0;
              transform: translateX(-24px) scale(0.9);
            }
            to {
              opacity: 1;
              transform: translateX(0) scale(1);
            }
          }

          @keyframes joinLogoDrop {
            from {
              opacity: 0;
              transform: translateY(-28px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes joinCardPop {
            from {
              opacity: 0;
              transform: translateY(34px) scale(0.94);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes joinDoodleIn {
            from {
              opacity: 0;
              transform: scale(0.85);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes joinPlaneFloat {
            0%, 100% {
              transform: translateY(0) rotate(0deg);
            }
            50% {
              transform: translateY(-8px) rotate(-3deg);
            }
          }

          @keyframes joinBulbGlow {
            0%, 100% {
              transform: translateY(0) scale(1);
              opacity: 0.9;
            }
            50% {
              transform: translateY(-4px) scale(1.03);
              opacity: 1;
            }
          }

          @keyframes joinBooksIn {
            from {
              opacity: 0;
              transform: translateY(40px) rotate(-4deg);
            }
            to {
              opacity: 1;
              transform: translateY(0) rotate(0deg);
            }
          }

          @keyframes joinLedgeIn {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes joinFadeUp {
            from {
              opacity: 0;
              transform: translateY(18px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .join-back-btn {
            animation: joinBackBtnIn 0.65s cubic-bezier(0.34, 1.4, 0.64, 1) both;
          }
          .join-doodle-plane {
            animation: joinDoodleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both,
                       joinPlaneFloat 4s ease-in-out 0.9s infinite;
          }
          .join-doodle-bulb {
            animation: joinDoodleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both,
                       joinBulbGlow 3.5s ease-in-out 0.95s infinite;
          }
          .join-doodle-stars {
            animation: joinDoodleIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both;
          }
          .join-logo {
            animation: joinLogoDrop 0.85s cubic-bezier(0.34, 1.25, 0.64, 1) 0.15s both;
          }
          .join-card {
            animation: joinCardPop 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both;
          }
          .join-motto {
            animation: joinFadeUp 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.45s both;
          }
          .join-books {
            animation: joinBooksIn 0.95s cubic-bezier(0.34, 1.25, 0.64, 1) 0.35s both;
          }
          .join-ledge {
            animation: joinLedgeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
          }

          @media (prefers-reduced-motion: reduce) {
            .join-back-btn,
            .join-doodle-plane,
            .join-doodle-bulb,
            .join-doodle-stars,
            .join-logo,
            .join-card,
            .join-motto,
            .join-books,
            .join-ledge {
              animation: none !important;
              transform: none !important;
              opacity: 1 !important;
            }
          }
        `}</style>

        {/* ============================================================ */}
        {/* TOMBOL KEMBALI KE HOME (KIRI ATAS)                           */}
        {/* ============================================================ */}
        <Link
          to="/"
          className="join-back-btn absolute top-5 left-5 sm:top-8 sm:left-8 z-40 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#f6efe2]/90 hover:bg-[#f6efe2] text-[#163a2b] shadow-[0_4px_12px_rgba(0,0,0,0.3)] border-2 border-[#e4d7c3] transition-all hover:scale-105 active:scale-95 cursor-pointer group"
          title="Kembali ke Beranda"
          aria-label="Kembali ke Beranda"
        >
          <ArrowLeft className="w-6 h-6 text-[#163a2b] transition-transform group-hover:-translate-x-0.5" />
        </Link>

        {/* ============================================================ */}
        {/* DOODLE 1: PESAWAT KERTAS KAPUR (Kiri Atas)                   */}
        {/* ============================================================ */}
        <div className="join-doodle-plane absolute top-20 left-4 sm:top-24 sm:left-10 w-24 h-24 sm:w-32 sm:h-32 pointer-events-none z-10 text-[#f4ecd8]/75">
          <svg viewBox="0 0 130 130" fill="none" className="w-full h-full" aria-hidden="true">
            {/* Lintasan melengkung putus-putus */}
            <path
              d="M10 110 C 20 70, 60 55, 45 28 C 30 12, 10 38, 38 60 C 65 75, 88 56, 105 38"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeDasharray="4 6"
              strokeLinecap="round"
            />
            {/* Badan pesawat kertas origami */}
            <path
              d="M105 38 L 126 18 L 84 48 L 94 62 L 105 38 Z"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinejoin="round"
              fill="rgba(244, 236, 216, 0.08)"
            />
            <path d="M126 18 L 91 55" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </div>

        {/* ============================================================ */}
        {/* DOODLE 2: BOHLAM IDE MENYALA (Kanan Atas)                    */}
        {/* ============================================================ */}
        <div className="join-doodle-bulb absolute top-6 right-8 sm:top-10 sm:right-20 w-28 h-28 sm:w-36 sm:h-36 pointer-events-none z-10 text-[#f4ecd8]/90">
          <svg viewBox="0 0 110 110" fill="none" className="w-full h-full" aria-hidden="true">
            {/* Kontur kaca bohlam */}
            <path
              d="M40 62 C 30 52, 28 40, 33 28 C 40 16, 70 16, 77 28 C 82 40, 80 52, 70 62 L 70 70 L 40 70 Z"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="rgba(244, 236, 216, 0.06)"
            />
            {/* Drat ulir bohlam */}
            <path d="M43 75 H 67 M46 80 H 64 M50 85 H 60" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            {/* Filamen di dalam bohlam */}
            <path
              d="M48 46 C 48 38, 62 38, 62 46 L 55 54 Z"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* 5 Pancaran sinar kapur */}
            <path d="M55 8 V 2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M28 17 L 21 10" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M82 17 L 89 10" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M14 38 L 6 38" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M96 38 L 104 38" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
          </svg>
        </div>

        {/* ============================================================ */}
        {/* DOODLE 3: BINTANG-BINTANG & CORETAK KAPUR SEKOLAH */}
        {/* ============================================================ */}
        <div className="join-doodle-stars pointer-events-none">
          {/* Bintang kiri atas */}
          <svg className="absolute top-[32%] left-10 sm:left-24 w-7 h-7 text-[#f4ecd8]/60 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 L 15 9 L 22 9 L 16.5 13.5 L 18.5 20.5 L 12 16 L 5.5 20.5 L 7.5 13.5 L 2 9 L 9 9 Z" />
          </svg>
          {/* Bintang kiri bawah */}
          <svg className="absolute bottom-40 left-14 sm:left-44 w-8 h-8 text-[#f4ecd8]/55 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 L 15 9 L 22 9 L 16.5 13.5 L 18.5 20.5 L 12 16 L 5.5 20.5 L 7.5 13.5 L 2 9 L 9 9 Z" />
          </svg>
          {/* Bintang kanan atas */}
          <svg className="absolute top-[28%] right-12 sm:right-32 w-6 h-6 text-[#f4ecd8]/60 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 L 15 9 L 22 9 L 16.5 13.5 L 18.5 20.5 L 12 16 L 5.5 20.5 L 7.5 13.5 L 2 9 L 9 9 Z" />
          </svg>
          {/* Coretan Rumus Kapur di Kanan (Dekorasi Papan Tulis) */}
          <div className="absolute top-[48%] right-10 sm:right-28 text-[#f4ecd8]/45 pointer-events-none select-none hidden sm:flex flex-col items-center">
            <span className="font-['Caveat',sans-serif] text-xl tracking-widest font-bold">a² + b² = c²</span>
            <svg className="w-16 h-2 text-[#f4ecd8]/30 mt-0.5" viewBox="0 0 70 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 5 Q 35 1 68 5" />
            </svg>
          </div>
          {/* Bintang kanan bawah */}
          <svg className="absolute bottom-44 right-16 sm:right-40 w-7 h-7 text-[#f4ecd8]/50 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 L 15 9 L 22 9 L 16.5 13.5 L 18.5 20.5 L 12 16 L 5.5 20.5 L 7.5 13.5 L 2 9 L 9 9 Z" />
          </svg>
        </div>

        {/* ============================================================ */}
        {/* KONTEN UTAMA: LOGO, KARTU FORM, & TEKS MOTTO                 */}
        {/* ============================================================ */}
        <div className="relative z-30 w-full max-w-[430px] px-4 flex flex-col items-center my-auto pt-6 pb-28">
          {/* LOGO DISCERE DENGAN PERCIKAN KAPUR KUNING */}
          <div className="join-logo relative flex items-center justify-center gap-2.5 mb-6 select-none">
            {/* Ikon Buku Terbuka */}
            <svg
              className="w-10 h-10 text-[#f4ecd8] drop-shadow-md"
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 38c6 0 12-3 18-3s12 3 18 3V8c-6 0-12-3-18-3S12 8 6 8v30zM24 5v30" />
            </svg>
            {/* Tulisan Discere */}
            <span
              className="text-4xl sm:text-5xl font-black text-[#f4ecd8] tracking-wide font-['Caveat',sans-serif]"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.45)' }}
            >
              Discere
            </span>
            {/* 3 Percikan Kapur Kuning di Atas-Kanan Teks */}
            <svg
              className="w-8 h-8 text-[#f2c230] -mt-5 -ml-1 pointer-events-none"
              viewBox="0 0 30 30"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 22 L 18 10 M14 26 L 24 18 M2 16 L 14 6" />
            </svg>
            {/* Coretan Lengkung Kuning di Bawah Logo */}
            <svg
              className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-44 h-3.5 text-[#f2c230] pointer-events-none"
              viewBox="0 0 120 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 8 Q 60 2 116 7" />
            </svg>
          </div>

          {/* KARTU FORMULIR KERTAS PARCHMENT (Paper Card) */}
          <div className="join-card relative w-full bg-[#f6efe2] rounded-[30px] p-6 sm:p-8 shadow-[0_12px_0_rgba(0,0,0,0.18),0_25px_50px_rgba(0,0,0,0.45)] border-2 border-[#e4d7c3] text-center">
            {/* Pesan Error */}
            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center justify-center gap-2 animate-bounce">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Pembatas Garis dengan Teks PIN / NICKNAME di Tengah */}
            <div className="flex items-center gap-3 mb-5 px-1 select-none">
              <div className="flex-1 h-[1.5px] bg-[#beb4a0]" />
              <span className="text-sm font-black uppercase tracking-widest text-[#2c3d31]">
                {joinStep === 'PIN' ? 'PIN' : 'NICKNAME'}
              </span>
              <div className="flex-1 h-[1.5px] bg-[#beb4a0]" />
            </div>

            {joinStep === 'PIN' ? (
              <form onSubmit={handleNextToName} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter PIN"
                  value={tokenInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setTokenInput(val);
                    if (formError) setFormError(null);
                  }}
                  autoFocus
                  className="w-full py-3.5 px-4 text-center text-2xl font-black tracking-widest text-[#163a2b] bg-[#ece4d5] border-2 border-[#243e2f] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#163a2b]/30 transition-all placeholder:text-[#9e9688] placeholder:font-bold placeholder:text-lg placeholder:tracking-normal"
                  required
                />
                <button
                  type="submit"
                  disabled={!tokenInput.trim() || tokenInput.trim().length !== 6}
                  className="w-full py-3.5 px-4 text-xl font-bold text-white bg-[#173b2b] hover:bg-[#102c20] active:scale-[0.99] rounded-2xl shadow-md transition-all cursor-pointer font-['Caveat',sans-serif] tracking-wider disabled:opacity-50"
                >
                  Join
                </button>
              </form>
            ) : (
              <form onSubmit={handleGabung} className="space-y-4">
                <input
                  type="text"
                  maxLength={20}
                  placeholder="Enter Name"
                  value={namaInput}
                  onChange={(e) => {
                    setNamaInput(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  autoFocus
                  className="w-full py-3.5 px-4 text-center text-xl font-bold text-[#163a2b] bg-[#ece4d5] border-2 border-[#243e2f] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#163a2b]/30 transition-all placeholder:text-[#9e9688] placeholder:font-bold"
                  required
                />
                <button
                  type="submit"
                  disabled={isJoining || !namaInput.trim()}
                  className="w-full py-3.5 px-4 text-xl font-bold text-white bg-[#173b2b] hover:bg-[#102c20] disabled:opacity-60 active:scale-[0.99] rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer font-['Caveat',sans-serif] tracking-wider"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Menghubungkan...
                    </>
                  ) : (
                    'Mulai!'
                  )}
                </button>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setJoinStep('PIN');
                      setFormError(null);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    ← Ganti PIN ({tokenInput || '......'})
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* TEKS MOTTO DI BAWAH KARTU DENGAN CORETAN KAPUR KUNING */}
          <div className="join-motto mt-6 flex flex-col items-center select-none text-center">
            <span
              className="text-lg sm:text-xl font-bold text-[#f4ecd9] tracking-wide font-['Caveat',sans-serif]"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
            >
              Discere • Belajar Lebih Menyenangkan
            </span>
            <svg
              className="w-48 h-3.5 text-[#f2c230] mt-1 pointer-events-none"
              viewBox="0 0 140 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 6 Q 35 1 70 6 T 136 5" />
            </svg>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TUMPUKAN 3 BUKU CAT AIR KLASIK (Kiri Bawah di Atas Meja Kayu) */}
        {/* ============================================================ */}
        <div className="join-books absolute bottom-12 sm:bottom-16 left-3 sm:left-12 w-32 sm:w-48 h-24 sm:h-36 pointer-events-none z-20">
          <svg viewBox="0 0 150 110" fill="none" className="w-full h-full drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)]" aria-hidden="true">
            {/* Bayangan di atas dudukan kayu */}
            <ellipse cx="75" cy="98" rx="65" ry="6" fill="rgba(0,0,0,0.4)" />

            {/* BUKU BAWAH (Kulit Cokelat Tua / Marun) */}
            <path d="M12 72 L 140 72 L 142 94 L 14 94 Z" fill="#4a2c16" />
            <path d="M24 76 L 138 76 L 138 90 L 24 90 Z" fill="#f4ecd8" />
            <path d="M10 70 C 8 70, 6 74, 6 83 C 6 92, 8 96, 10 96 L 24 96 L 24 70 Z" fill="#351d0d" />
            {/* Garis emas tulang buku bawah */}
            <line x1="12" y1="76" x2="22" y2="76" stroke="#c59a5f" strokeWidth="1.5" />
            <line x1="12" y1="90" x2="22" y2="90" stroke="#c59a5f" strokeWidth="1.5" />

            {/* BUKU TENGAH (Cover Hitam-Arang / Navy Gelap) */}
            <path d="M20 50 L 130 50 L 132 70 L 22 70 Z" fill="#24292e" />
            <path d="M30 54 L 128 54 L 128 66 L 30 66 Z" fill="#f4ecd8" />
            <path d="M18 48 C 16 48, 14 52, 14 60 C 14 68, 16 72, 18 72 L 30 72 L 30 48 Z" fill="#161a1e" />
            {/* Garis emas tulang buku tengah */}
            <line x1="18" y1="54" x2="28" y2="54" stroke="#d4af37" strokeWidth="1.5" />
            <line x1="18" y1="66" x2="28" y2="66" stroke="#d4af37" strokeWidth="1.5" />

            {/* BUKU ATAS (Hijau Hutan Antik) */}
            <path d="M12 28 L 118 28 L 120 48 L 14 48 Z" fill="#1b422e" />
            <path d="M22 32 L 116 32 L 116 44 L 22 44 Z" fill="#f4ecd8" />
            <path d="M10 26 C 8 26, 6 30, 6 38 C 6 46, 8 50, 10 50 L 22 50 L 22 26 Z" fill="#112d1f" />
            {/* Garis emas tulang buku atas */}
            <line x1="10" y1="32" x2="20" y2="32" stroke="#c59a5f" strokeWidth="1.5" />
            <line x1="10" y1="44" x2="20" y2="44" stroke="#c59a5f" strokeWidth="1.5" />

            {/* Pita Pembatas Buku Merah Menjuntai */}
            <path d="M85 45 C 90 55, 80 65, 88 78 C 92 84, 86 92, 90 98 L 94 94 L 97 99 C 94 92, 98 84, 94 78 C 86 65, 96 55, 90 45 Z" fill="#c82b24" opacity="0.9" />
          </svg>
        </div>

        {/* ============================================================ */}
        {/* AKSESORIS RAK KAYU: BATANG KAPUR & PENGHAPUS PAPAN TULIS     */}
        {/* ============================================================ */}
        <div className="join-ledge absolute bottom-16 sm:bottom-20 left-0 right-0 w-full pointer-events-none z-20 px-6 sm:px-16 flex justify-end items-end">
          <div className="hidden sm:flex items-end gap-3.5 mb-0.5 opacity-95 drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)]">
            {/* Batang Kapur Putih */}
            <div className="w-11 h-2.5 rounded-full bg-[#f8fafc] shadow-sm transform -rotate-3 border border-slate-300/40 relative">
              <div className="absolute -top-1 -right-2 w-4 h-3 bg-white/30 blur-sm rounded-full" />
            </div>
            {/* Batang Kapur Kuning */}
            <div className="w-9 h-2.5 rounded-full bg-[#f2c230] shadow-sm transform rotate-2 border border-amber-400/40" />
            {/* Penghapus Papan Tulis Kayu Klasik */}
            <div className="w-20 h-6 rounded-sm bg-gradient-to-b from-[#9e6936] to-[#71441c] border-t border-[#d8a368] shadow-md flex flex-col justify-end overflow-hidden ml-2.5">
              {/* Spon felt hitam penghapus */}
              <div className="w-full h-2.5 bg-[#252525] border-t border-black/40 flex items-center justify-center">
                <div className="w-full h-0.5 bg-white/20 blur-[0.5px]" />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* DUDUKAN MEJA & RAK PAPAN TULIS KAYU KLASIK (FULL LEBAR)      */}
        {/* ============================================================ */}
        <div className="join-ledge absolute bottom-0 left-0 right-0 w-full pointer-events-none z-10">
          {/* LIS ATAS RAK KAYU / BEVEL KILAU EMAS */}
          <div className="w-full h-1.5 bg-gradient-to-r from-[#b07f4a] via-[#e2b07a] to-[#b07f4a] shadow-sm" />

          {/* ALUR TEMPAT KAPUR (CHALK TRAY GROOVE) */}
          <div className="w-full h-3.5 bg-gradient-to-b from-[#2e1708] via-[#45230c] to-[#321808] relative overflow-hidden border-b border-[#241005]">
            {/* Debu kapur halus yang mengendap di alur */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* PAPAN MEJA KAYU JATI/MAHONI BERTEKSTUR */}
          <div
            className="w-full h-16 sm:h-20 relative overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #784821 0%, #633816 25%, #502b0f 60%, #3a1c07 100%)',
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.18), 0 -6px 16px rgba(0,0,0,0.5)',
            }}
          >
            {/* Serat kayu halus (Wood Grain Lines) */}
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.35) 3px, rgba(0,0,0,0.35) 5px), repeating-linear-gradient(90deg, transparent, transparent 110px, rgba(255,255,255,0.05) 110px, rgba(255,255,255,0.05) 113px)`,
              }}
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* PITA SATIN INDONESIA BERGELOMBANG (MERAH PUTIH MURNI SVG)    */}
        {/* ============================================================ */}
        <svg
          className="absolute bottom-0 left-0 w-full h-24 sm:h-32 pointer-events-none z-25 overflow-visible"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            {/* Gradien Pita Merah Satin Mengkilap */}
            <linearGradient id="redSatinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ab1b14" />
              <stop offset="25%" stopColor="#e32c24" />
              <stop offset="50%" stopColor="#ff5950" />
              <stop offset="75%" stopColor="#db261e" />
              <stop offset="100%" stopColor="#96130d" />
            </linearGradient>

            {/* Gradien Pita Putih Satin Mengkilap */}
            <linearGradient id="whiteSatinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e8decb" />
              <stop offset="25%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#fdfaf3" />
              <stop offset="75%" stopColor="#ded3be" />
              <stop offset="100%" stopColor="#c5b79e" />
            </linearGradient>

            {/* Filter Drop Shadow Alami untuk Pita */}
            <filter id="ribbonDropShadow" x="-5%" y="-10%" width="110%" height="150%">
              <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* GROUP PITA DENGAN BAYANGAN */}
          <g filter="url(#ribbonDropShadow)">
            {/* 1. JALUR PITA PUTIH (BAGIAN BAWAH PITA MERAH PUTIH) */}
            <path
              d="M -10 68 C 220 38, 460 102, 700 82 C 940 62, 1180 102, 1450 58 L 1450 78 C 1180 122, 940 82, 700 102 C 460 122, 220 58, -10 88 Z"
              fill="url(#whiteSatinGrad)"
            />

            {/* 2. JALUR PITA MERAH (BAGIAN ATAS PITA MERAH PUTIH) */}
            <path
              d="M -10 48 C 220 18, 460 82, 700 62 C 940 42, 1180 82, 1450 38 L 1450 58 C 1180 102, 940 62, 700 82 C 460 102, 220 38, -10 68 Z"
              fill="url(#redSatinGrad)"
            />

            {/* Kilap Pantulan Cahaya Atas Pita Merah */}
            <path
              d="M -10 48 C 220 18, 460 82, 700 62 C 940 42, 1180 82, 1450 38 L 1450 43 C 1180 87, 940 47, 700 67 C 460 87, 220 23, -10 53 Z"
              fill="#ffffff"
              opacity="0.35"
            />

            {/* Lipatan & Lekukan Pita Kanan (Ujung Berkibar) */}
            <path
              d="M 1340 50 C 1370 25, 1410 32, 1445 42 L 1450 68 C 1415 58, 1375 52, 1345 74 Z"
              fill="#85120d"
              opacity="0.5"
            />
            {/* Lipatan & Lekukan Pita Kiri (Di Bawah Buku) */}
            <path
              d="M -10 70 C 40 45, 110 50, 160 85 L 145 92 C 100 62, 35 56, -10 78 Z"
              fill="#85120d"
              opacity="0.4"
            />
          </g>
        </svg>
      </div>
    );
  }

  // ==========================================
  // RENDER MAKAN KERUPUK CHALLENGE (MULTIPLAYER HP SISWA)
  // ==========================================
  if (gameType === 'makan_kerupuk' && sessionId && pesertaId) {
    return (
      <MainKerupuk
        token={tokenInput}
        nama={namaPeserta}
        sessionId={sessionId}
        pesertaId={pesertaId}
        pesertaSecret={panjatSecret}
        templateJudul={templateJudul}
        initialStatus={stage === 'PLAYING' ? 'jalan' : stage === 'SELESAI' ? 'selesai' : 'lobi'}
        initialPesertaState={kerupukState}
        initialLeaderboard={kerupukLeaderboard}
        initialSoalAktif={kerupukSoalAktif}
        onKeluar={handleKeluar}
      />
    );
  }

  // ==========================================
  // RENDER PANJAT PINANG (JIKA SESI ADALAH PANJAT PINANG)
  // ==========================================
  if (gameType === 'panjat_pinang' && sessionId && pesertaId) {
    return (
      <MainPanjatPinang
        token={tokenInput}
        nama={namaPeserta}
        sessionId={sessionId}
        pesertaId={pesertaId}
        pesertaSecret={panjatSecret}
        templateJudul={templateJudul}
        config={panjatConfig}
        initialStatus={stage === 'PLAYING' ? 'jalan' : stage === 'SELESAI' ? 'selesai' : 'lobi'}
        initialPesertaState={panjatState}
        initialLeaderboard={panjatLeaderboard}
        initialSoalAktif={panjatSoalAktif}
        onKeluar={handleKeluar}
      />
    );
  }

  // ==========================================
  // RENDER BALAP KARUNG CHALLENGE (JIKA SESI ADALAH BALAP KARUNG)
  // ==========================================
  if (gameType === 'balap_karung' && sessionId && pesertaId) {
    return (
      <MainBalapKarung
        token={tokenInput}
        nama={namaPeserta}
        sessionId={sessionId}
        pesertaId={pesertaId}
        pesertaSecret={panjatSecret}
        templateJudul={templateJudul}
        config={balapConfig}
        initialStatus={stage === 'PLAYING' ? 'jalan' : stage === 'SELESAI' ? 'selesai' : 'lobi'}
        initialPesertaState={balapState}
        initialLeaderboard={balapLeaderboard}
        initialSoalAktif={balapSoalAktif}
        onKeluar={handleKeluar}
      />
    );
  }

  // ==========================================
  // RENDER STAGE 2: LOBI MENUNGGU GURU (TARIK TAMBANG)
  // ==========================================
  if (stage === 'LOBBY') {
    return (
      <div className="portal-bg min-h-screen flex flex-col justify-between select-none">
        <div className="max-w-lg mx-auto w-full p-4 sm:p-6 flex-1 flex flex-col justify-between">
          {/* Header */}
          <header className="portal-card flex justify-between items-center p-4 rounded-2xl border-2 border-[#e0d5b8] shadow-[0_4px_0_rgba(0,0,0,0.16)]">
            <div className="min-w-0">
              <span className="inline-block text-[11px] font-black text-[#f2c230] bg-[#1d3b2e] px-2.5 py-0.5 rounded-full tracking-wider uppercase mb-1">
                PIN SESI: {tokenInput}
              </span>
              <h2 className="text-base font-extrabold text-[#1d3b2e] truncate max-w-[220px] sm:max-w-sm">
                {templateJudul || 'Tarik Tambang Discere'}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleKeluar}
              className="p-2.5 rounded-xl bg-[#f4ecd9] border border-[#e0d5b8] text-[#1d3b2e] hover:bg-[#fde8e7] hover:text-[#c8362f] transition-colors cursor-pointer shrink-0"
              title="Keluar"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </header>

          {/* Content Lobi */}
          <main className="my-auto py-6 text-center w-full">
            <div className="portal-card p-6 sm:p-7 rounded-3xl border-2 border-[#e0d5b8] shadow-[0_8px_0_rgba(0,0,0,0.18)] space-y-5">
              {/* Karakter 2D Duel Merah vs Putih Siap Berlomba */}
              <div className="flex items-center justify-center gap-4 bg-gradient-to-r from-[#fbf0ee] via-[#fffdf6] to-[#edf4fb] border border-[#e0d5b8] rounded-2xl py-4 px-3">
                <KarakterTarikTambang tim="merah" pose="siap" ekspresi="semangat" size="md" />
                <span className="px-3 py-1 rounded-full bg-[#1d3b2e] text-[#f2c230] font-black text-xs shadow-xs">
                  VS
                </span>
                <KarakterTarikTambang tim="putih" pose="siap" ekspresi="semangat" size="md" />
              </div>

              <div>
                <h3 className="portal-cv text-3xl sm:text-4xl text-[#1d3b2e] mb-1">
                  Halo, {namaPeserta}! 👋
                </h3>
                <p className="text-[#6b7d6c] text-sm leading-relaxed">
                  Kamu sudah masuk ke ruang permainan. Tunggu Bapak/Ibu Guru memulai lomba di layar utama kelas.
                </p>
              </div>

              {/* Status Pemain Terhubung */}
              <div className="p-4 bg-[#f4ecd9] border border-[#e0d5b8] rounded-2xl space-y-3">
                <div className="flex items-center justify-center gap-2 text-[#1d3b2e] font-extrabold text-sm">
                  <Users className="w-4 h-4 text-[#c8362f]" />
                  <span>{totalPeserta} Siswa Bergabung</span>
                  {tim && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                        tim === 'merah'
                          ? 'bg-[#c8362f] text-white'
                          : 'bg-[#2563eb] text-white'
                      }`}
                    >
                      Kamu di {tim === 'merah' ? tarikConfig.namaTim1 : tarikConfig.namaTim2}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-2 max-h-36 overflow-y-auto p-1">
                  {daftarPeserta.map((p) => (
                    <span
                      key={p.id}
                      className={`text-xs px-3 py-1 rounded-full font-bold border ${
                        p.id === pesertaId
                          ? p.tim === 'merah'
                            ? 'bg-[#c8362f] border-[#961e19] text-white shadow-xs'
                            : 'bg-[#2563eb] border-[#1e3a8a] text-white shadow-xs'
                          : p.tim === 'merah'
                          ? 'bg-[#fde8e7] border-[#f5c2c0] text-[#961e19]'
                          : 'bg-[#eff6ff] border-[#bfdbfe] text-[#1e3a8a]'
                      }`}
                    >
                      {p.nama} {p.id === pesertaId && '(Kamu)'}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-xs font-semibold text-[#6b7d6c]">
                Pembagian tim dapat disesuaikan oleh Bapak/Ibu Guru di layar depan sebelum lomba
                dimulai.
              </div>
            </div>
          </main>

          <footer className="text-center text-xs font-bold text-[#f4ecd8]/75 py-1">
            Discere • Belajar Sambil Berlomba
          </footer>
        </div>

        <div className="portal-ledge" aria-hidden="true">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
            <path d="M0 34C240 6 480 62 720 34S1200 6 1440 34V80H0z" fill="#a6783c" />
            <path d="M0 56C260 34 520 80 760 56S1220 36 1440 58V80H0z" fill="#8d6444" />
          </svg>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER STAGE 3: IN-GAME (MENJAWAB SOAL)
  // ==========================================
  if (stage === 'PLAYING') {
    const isMerah = tim === 'merah';
    const namaTimSaya = isMerah ? tarikConfig.namaTim1 : tarikConfig.namaTim2;
    const selectedTeamColor = isMerah
      ? 'bg-[#c8362f] border-[#8f1e19]'
      : 'bg-[#2563eb] border-[#1e3a8a]';
    const clampPos = Math.max(-100, Math.min(100, taliPosition));
    const ropePersen = Math.max(0, Math.min(100, ((100 - clampPos) / 200) * 100));
    const durasiTotal = soalAktif?.duration || tarikConfig.durasiRonde || 20;

    return (
      <div className="portal-bg min-h-screen flex flex-col justify-between p-4 sm:p-6 select-none">
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col justify-between space-y-4">
          {/* Top Bar: Karakter & Tim Badge, Ronde, Timer */}
          <header className="portal-card rounded-2xl p-3.5 sm:p-4 border-2 border-[#e0d5b8] shadow-[0_4px_0_rgba(0,0,0,0.16)] space-y-2.5">
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border ${
                    isMerah
                      ? 'bg-[#fbf0ee] border-[#d9544c]/60'
                      : 'bg-[#eff6ff] border-[#3b82f6]/60'
                  }`}
                >
                  <KarakterTarikTambang
                    tim={isMerah ? 'merah' : 'putih'}
                    pose="siap"
                    ekspresi={
                      feedback?.tampil
                        ? feedback.benar
                          ? 'bahagia'
                          : 'sedih'
                        : 'semangat'
                    }
                    size="xs"
                  />
                </div>
                <div>
                  <span
                    className={`text-xs sm:text-sm font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-block ${
                      isMerah
                        ? 'bg-[#fde8e7] text-[#c8362f]'
                        : 'bg-[#dbeafe] text-[#2563eb]'
                    }`}
                  >
                    {namaTimSaya}
                  </span>
                  {pesertaStat.streakSaatIni > 0 && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-black text-[#b45309]">
                      <Flame className="w-3 h-3" /> {pesertaStat.streakSaatIni}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs font-extrabold text-[#1d3b2e] bg-[#f4ecd9] px-3 py-1.5 rounded-full border border-[#e0d5b8]">
                Ronde {soalAktif?.nomorRonde ?? soalAktif?.nomorSoal ?? '-'}
              </div>

              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-sm border-2 ${
                  sisaDetik <= 5
                    ? 'bg-[#fde8e7] text-[#c8362f] border-[#c8362f] animate-bounce'
                    : 'bg-[#f4ecd9] text-[#1d3b2e] border-[#e0d5b8]'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{sisaDetik}s</span>
              </div>
            </div>

            {/* Timer Progress Bar */}
            <div className="w-full bg-[#e0d5b8] h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ease-linear ${
                  sisaDetik <= 5 ? 'bg-[#c8362f]' : isMerah ? 'bg-[#c8362f]' : 'bg-[#2563eb]'
                }`}
                style={{ width: `${Math.min(100, (sisaDetik / durasiTotal) * 100)}%` }}
              />
            </div>

            {/* Banner Power-Up Tim */}
            {tarikConfig.powerUpAktif && (powerUpTim.bank || powerUpTim.aktifBerikutnya) && (
              <div className="pt-1 flex items-center justify-between gap-2 text-xs font-bold">
                {powerUpTim.aktifBerikutnya ? (
                  <span className="text-amber-700 inline-flex items-center gap-1">
                    Power-up {powerUpTim.aktifBerikutnya} aktif ronde berikutnya!
                  </span>
                ) : (
                  <>
                    <span className="text-[#1d3b2e] inline-flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-[#b45309]" />
                      Power-Up Tim: {powerUpTim.bank}
                    </span>
                    <button
                      type="button"
                      onClick={handleAktifkanPowerUp}
                      className="px-3 py-1 rounded-lg bg-[#b45309] text-white font-black text-xs shadow"
                    >
                      Aktifkan!
                    </button>
                  </>
                )}
              </div>
            )}
          </header>

          {/* Mini Bar Posisi Tali Live (-100 .. +100) */}
          <div className="portal-card rounded-2xl px-4 py-2.5 border-2 border-[#e0d5b8] shadow-xs">
            <div className="flex justify-between items-center text-xs font-extrabold mb-1">
              <span className="text-[#c8362f]">
                {tarikConfig.namaTim1}: {skorMerah}
              </span>
              <span className="text-[#6b7d6c]">
                {taliPosition > 0
                  ? `${tarikConfig.namaTim1} +${taliPosition}`
                  : taliPosition < 0
                  ? `${tarikConfig.namaTim2} ${taliPosition}`
                  : 'Seimbang (0)'}
              </span>
              <span className="text-[#2563eb]">
                {tarikConfig.namaTim2}: {skorPutih}
              </span>
            </div>
            <div className="portal-rope" style={{ margin: '6px 4px 2px' }}>
              <i style={{ left: `${ropePersen}%` }} />
            </div>
          </div>

          {/* Question Area */}
          <main className="my-auto space-y-4">
            <div className="portal-card p-5 sm:p-6 rounded-3xl border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)]">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#6b7d6c] mb-1.5">
                Pertanyaan Tim Kamu
              </div>
              <p className="portal-cv text-2xl sm:text-3xl text-[#1d3b2e] leading-snug">
                {soalAktif?.teks}
              </p>
            </div>

            {/* Opsi Jawaban */}
            <div className="space-y-3">
              {(soalAktif?.pilihan && soalAktif.pilihan.length > 0
                ? soalAktif.pilihan
                : (['A', 'B', 'C'] as const).map((k) => ({
                    choiceId: k,
                    label: k,
                    teks:
                      (k === 'A'
                        ? soalAktif?.opsiA
                        : k === 'B'
                        ? soalAktif?.opsiB
                        : soalAktif?.opsiC) || '',
                  }))
              ).map((opsiItem) => {
                const isSelected =
                  (pickedChoiceId && pickedChoiceId === opsiItem.choiceId) ||
                  jawabanDipilih === opsiItem.label;
                const isLocked = sudahKirim || Boolean(feedback?.tampil);

                return (
                  <button
                    key={opsiItem.choiceId}
                    disabled={isLocked}
                    onClick={() =>
                      handlePilihJawaban(
                        opsiItem.label,
                        soalAktif?.pilihan ? opsiItem.choiceId : undefined
                      )
                    }
                    className={`w-full text-left p-4 rounded-2xl border-2 font-bold transition-all duration-150 flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? `${selectedTeamColor} text-white shadow-[0_4px_0_rgba(0,0,0,0.2)] scale-[1.01]`
                        : isLocked
                        ? 'bg-[#f0e7d0] border-[#d8cbb0] text-[#8c8270] opacity-60 cursor-not-allowed'
                        : 'bg-[#fbf6e9] border-[#e0d5b8] text-[#1d3b2e] hover:bg-white hover:border-[#1d3b2e] shadow-[0_4px_0_rgba(0,0,0,0.14)] active:translate-y-0.5'
                    }`}
                  >
                    <div className="flex items-center gap-3 pr-2">
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                          isSelected
                            ? 'bg-white/25 text-white'
                            : 'bg-[#e8dfc8] text-[#1d3b2e]'
                        }`}
                      >
                        {opsiItem.label}
                      </span>
                      <span className="text-base sm:text-lg leading-snug">{opsiItem.teks}</span>
                    </div>
                    {isSelected && <Lock className="w-5 h-5 shrink-0 text-white" />}
                  </button>
                );
              })}
            </div>

            {/* Status Terkunci Menunggu Evaluasi Ronde */}
            {sudahKirim && !feedback?.tampil && (
              <div className="p-3.5 bg-[#fbf6e9] border-2 border-[#f2c230] rounded-2xl text-center text-[#1d3b2e] font-bold text-sm shadow-sm flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 text-[#b45309]" />
                <span>Jawaban terkunci! Menunggu tim lawan dan evaluasi ronde...</span>
              </div>
            )}

            {/* Feedback Setelah Ronde Ditutup */}
            {feedback?.tampil && (
              <div
                className={`p-4 rounded-2xl border-2 text-sm space-y-1.5 shadow-sm ${
                  feedback.benar
                    ? 'bg-[#e8f5e9] border-[#2e7d32] text-[#1b5e20]'
                    : 'bg-[#fde8e7] border-[#c8362f] text-[#8e1d18]'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-base">
                  {feedback.benar ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-[#2e7d32] shrink-0" />
                      <span>Tepat Sekali! Kontribusi Tim Meningkat</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-[#c8362f] shrink-0" />
                      <span>Jawaban Belum Tepat / Belum Menjawab</span>
                    </>
                  )}
                </div>

                {feedback.infoRonde && (
                  <div className="text-xs font-extrabold opacity-90">{feedback.infoRonde}</div>
                )}

                {feedback.jawabanBenar && (
                  <div className="text-xs font-semibold">
                    Kunci Jawaban:{' '}
                    <span className="font-extrabold uppercase">Opsi {feedback.jawabanBenar}</span>
                  </div>
                )}

                {feedback.penjelasan && (
                  <div className="text-xs opacity-90 pt-1.5 border-t border-black/10">
                    {feedback.penjelasan}
                  </div>
                )}
              </div>
            )}
          </main>

          <footer className="text-center text-xs font-bold text-[#f4ecd8]/75 py-1">
            Discere • Mode Tarik Tambang Siswa
          </footer>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER STAGE 4: PERMAINAN SELESAI
  // ==========================================
  if (stage === 'SELESAI') {
    const isMerah = tim === 'merah';
    const isMenang =
      (hasilAkhir?.timMenang === 'merah' && isMerah) ||
      (hasilAkhir?.timMenang === 'putih' && !isMerah);
    const isSeri = hasilAkhir?.timMenang === 'seri';

    return (
      <div className="portal-bg min-h-screen flex flex-col justify-between select-none">
        <div className="max-w-md mx-auto w-full p-4 sm:p-6 my-auto">
          <div className="portal-card p-6 sm:p-8 rounded-[30px] border-2 border-[#e0d5b8] shadow-[0_10px_0_rgba(0,0,0,0.22)] text-center space-y-5">
            {/* Karakter 2D Hasil Akhir (Mahkota Emas jika menang) */}
            <div className="flex flex-col items-center">
              <KarakterTarikTambang
                tim={isMerah ? 'merah' : 'putih'}
                pose="podium"
                ekspresi={isMenang ? 'menang' : isSeri ? 'bahagia' : 'kalah'}
                podiumRank={isMenang ? 1 : isSeri ? undefined : 2}
                size="lg"
              />
              <span
                className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase ${
                  isMenang
                    ? 'bg-[#f8e7b0] text-[#8a6a00]'
                    : isSeri
                    ? 'bg-[#d8e3cf] text-[#1b432a]'
                    : 'bg-[#f4ecd9] text-[#6b7d6c]'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                {isMenang ? 'Tim Pemenang' : isSeri ? 'Hasil Imbang' : 'Tetap Semangat'}
              </span>
            </div>

            <div>
              <h2 className="portal-cv text-3xl sm:text-4xl text-[#1d3b2e] mb-1">
                {isMenang
                  ? '🎉 TIM KAMU MENANG! 🎉'
                  : isSeri
                  ? '🤝 HASIL PERTANDINGAN SERI!'
                  : '💪 TETAP SEMANGAT!'}
              </h2>
              <p className="text-[#6b7d6c] text-sm">
                {isMenang
                  ? 'Luar biasa! Kerja sama dan kecepatan timmu berhasil menarik tali kemenangan!'
                  : isSeri
                  ? 'Kedua tim sama-sama kuat dan seimbang sampai akhir pertandingan!'
                  : 'Perjuangan yang hebat! Terus belajar dan raih kemenangan di lomba berikutnya!'}
              </p>
            </div>

            {/* Detail Hasil Skor */}
            <div className="p-4 bg-[#f4ecd9] border border-[#e0d5b8] rounded-2xl space-y-3">
              <div className="text-[11px] uppercase font-extrabold text-[#6b7d6c] tracking-wider">
                Hasil Akhir Lomba
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#fbf0ee] border border-[#d9544c]/60">
                  <div className="text-xs font-extrabold text-[#c8362f] uppercase">
                    {hasilAkhir?.konfigurasi?.namaTim1 || hasilAkhir?.namaTim1 || tarikConfig.namaTim1}
                  </div>
                  <div className="text-3xl font-black text-[#1d3b2e] mt-0.5">
                    {hasilAkhir?.skorMerah ?? skorMerah}
                  </div>
                  {(hasilAkhir?.akurasiTim1 ?? hasilAkhir?.akurasiTim1Persen) !== undefined && (
                    <div className="text-[11px] font-bold text-[#6b7d6c]">
                      Akurasi {hasilAkhir?.akurasiTim1 ?? hasilAkhir?.akurasiTim1Persen}%
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-[#eff6ff] border border-[#3b82f6]/60">
                  <div className="text-xs font-extrabold text-[#2563eb] uppercase">
                    {hasilAkhir?.konfigurasi?.namaTim2 || hasilAkhir?.namaTim2 || tarikConfig.namaTim2}
                  </div>
                  <div className="text-3xl font-black text-[#1d3b2e] mt-0.5">
                    {hasilAkhir?.skorPutih ?? skorPutih}
                  </div>
                  {(hasilAkhir?.akurasiTim2 ?? hasilAkhir?.akurasiTim2Persen) !== undefined && (
                    <div className="text-[11px] font-bold text-[#6b7d6c]">
                      Akurasi {hasilAkhir?.akurasiTim2 ?? hasilAkhir?.akurasiTim2Persen}%
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/80 border border-[#e0d5b8] text-xs font-bold text-[#1d3b2e] flex justify-around">
                <span>Benar: {pesertaStat.totalBenar}</span>
                <span>Salah: {pesertaStat.totalSalah}</span>
                <span>Akurasi: {pesertaStat.akurasiPersen}%</span>
                <span>Streak Max: {pesertaStat.streakTertinggi}</span>
              </div>

              <div className="text-xs text-[#6b7d6c] pt-2 border-t border-dashed border-[#e0d5b8]">
                Posisi Akhir Tali:{' '}
                <strong className="text-[#1d3b2e]">
                  {hasilAkhir?.posisiAkhir !== undefined
                    ? hasilAkhir.posisiAkhir > 0
                      ? `${hasilAkhir?.namaTim1 || tarikConfig.namaTim1} (+${hasilAkhir.posisiAkhir})`
                      : hasilAkhir.posisiAkhir < 0
                      ? `${hasilAkhir?.namaTim2 || tarikConfig.namaTim2} (${hasilAkhir.posisiAkhir})`
                      : 'Tepat di Tengah (0)'
                    : '-'}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleKeluar}
              className="portal-btn red w-full py-3.5 text-sm font-black cursor-pointer"
            >
              Kembali ke Halaman Awal
            </button>
          </div>
        </div>

        <div className="portal-ledge" aria-hidden="true">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
            <path d="M0 34C240 6 480 62 720 34S1200 6 1440 34V80H0z" fill="#a6783c" />
            <path d="M0 56C260 34 520 80 760 56S1220 36 1440 58V80H0z" fill="#8d6444" />
          </svg>
        </div>
      </div>
    );
  }

  return null;
}
