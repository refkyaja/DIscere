import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getSocket } from '../../lib/socket';

interface PesertaItem {
  id: string;
  nama: string;
  tim?: string | null;
}

interface TeamItem {
  id: string;
  nama: string;
  warna?: string;
  anggota: Array<{ id: string; nama: string }>;
}

export interface RuangTungguSiswaProps {
  token: string;
  nama: string;
  pesertaId: string;
  gameType: 'tarik_tambang' | 'balap_karung' | 'makan_kerupuk' | 'panjat_pinang';
  templateJudul?: string;
  config?: any;
  daftarPeserta?: PesertaItem[];
  teams?: TeamItem[];
  myTeamId?: string | null;
  onKeluar: (pesan?: string) => void;
  onMulaiPermainan: () => void;
}

// Skema warna avatar deterministik berdasarkan ID/nama peserta
const AV_BG = ['#7cc6a4', '#f2c230', '#e98a7a', '#8fb8e8', '#c4a2e0', '#9ad06a', '#f0a15a', '#6fc3c9'];
const AV_SKIN = ['#f0b98d', '#e9b08a', '#f3c9a2'];
const AV_HAIR = ['#2b2019', '#3b2a22', '#1c1c24', '#5a3a22'];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getAvatarSvgString(id?: string, name?: string, size = 40): string {
  const seed = id || name || 'peserta';
  const h = hashString(seed);
  const bg = AV_BG[h % AV_BG.length];
  const sk = AV_SKIN[(h >> 2) % AV_SKIN.length];
  const hr = AV_HAIR[(h >> 4) % AV_HAIR.length];
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" style="border-radius:50%;display:block;flex-shrink:0;"><circle cx="20" cy="20" r="20" fill="${bg}" /><circle cx="20" cy="22" r="11" fill="${sk}" /><path d="M8.5 20Q9 8 20 8Q31 8 31.5 20Q27 14 20 15Q13 14 8.5 20Z" fill="${hr}" /><circle cx="16" cy="23" r="1.6" fill="#222" /><circle cx="24" cy="23" r="1.6" fill="#222" /><path d="M16.5 27.5Q20 30 23.5 27.5" stroke="#7a2a24" fill="none" stroke-width="1.4" stroke-linecap="round" /></svg>`;
}

function AvatarSvg({ id, name, size = 40 }: { id?: string; name: string; size?: number }) {
  const seed = id || name || 'peserta';
  const h = hashString(seed);
  const bg = AV_BG[h % AV_BG.length];
  const sk = AV_SKIN[(h >> 2) % AV_SKIN.length];
  const hr = AV_HAIR[(h >> 4) % AV_HAIR.length];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="shrink-0 rounded-full"
    >
      <circle cx="20" cy="20" r="20" fill={bg} />
      <circle cx="20" cy="22" r="11" fill={sk} />
      <path d="M8.5 20Q9 8 20 8Q31 8 31.5 20Q27 14 20 15Q13 14 8.5 20Z" fill={hr} />
      <circle cx="16" cy="23" r="1.6" fill="#222" />
      <circle cx="24" cy="23" r="1.6" fill="#222" />
      <path d="M16.5 27.5Q20 30 23.5 27.5" stroke="#7a2a24" fill="none" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function RuangTungguSiswa({
  token,
  nama,
  pesertaId,
  gameType,
  templateJudul,
  config,
  daftarPeserta = [],
  teams = [],
  myTeamId,
  onKeluar,
  onMulaiPermainan,
}: RuangTungguSiswaProps) {
  const [livePeserta, setLivePeserta] = useState<PesertaItem[]>(daftarPeserta);
  const [liveTeams, setLiveTeams] = useState<TeamItem[]>(teams);
  const [detectedMyTeam, setDetectedMyTeam] = useState<string | null>(myTeamId || null);
  const [isStarting, setIsStarting] = useState(false);
  const [statusText, setStatusText] = useState('Game akan dimulai segera…');
  const startTimerRef = useRef<any[]>([]);
  const jalankanTransisiMulaiRef = useRef<() => void>(() => {});

  // Sinkronkan daftar peserta & tim jika props berubah
  useEffect(() => {
    if (daftarPeserta && daftarPeserta.length > 0) {
      setLivePeserta(daftarPeserta);
    }
  }, [daftarPeserta]);

  useEffect(() => {
    if (teams && teams.length > 0) {
      setLiveTeams(teams);
    }
  }, [teams]);

  useEffect(() => {
    if (myTeamId) {
      setDetectedMyTeam(myTeamId);
    }
  }, [myTeamId]);

  // Dengarkan event socket saat di ruang tunggu
  useEffect(() => {
    const socket = getSocket();

    const handleLobiUpdate = (data: any) => {
      if (Array.isArray(data.daftarPeserta)) {
        setLivePeserta(data.daftarPeserta);
        // Cek jika murid telah dikeluarkan oleh guru dari lobi
        const stillIn = data.daftarPeserta.some((p: any) => p.id === pesertaId || p.nama === nama);
        if (!stillIn && data.daftarPeserta.length > 0) {
          onKeluar();
          return;
        }
      }
      if (Array.isArray(data.teams)) {
        setLiveTeams(data.teams);
      }
      if (Array.isArray(data.leaderboard)) {
        setLivePeserta((prev) => {
          const list = data.leaderboard.map((p: any) => ({
            id: p.id,
            nama: p.nama,
            tim: p.tim || null,
          }));
          return list.length > 0 ? list : prev;
        });
      }
    };

    const handleTeamsAssigned = (data: any) => {
      if (Array.isArray(data.daftarPeserta)) {
        setLivePeserta(data.daftarPeserta);
        const me = data.daftarPeserta.find((p: any) => p.id === pesertaId);
        if (me?.tim) {
          setDetectedMyTeam(me.tim);
        }
      }
    };

    const handleGameMulai = (data: any) => {
      if (data.game && data.game !== gameType) return;

      if (Array.isArray(data.daftarPeserta)) {
        setLivePeserta(data.daftarPeserta);
        const me = data.daftarPeserta.find((p: any) => p.id === pesertaId);
        if (me?.tim) setDetectedMyTeam(me.tim);
      }
      if (Array.isArray(data.teams)) {
        setLiveTeams(data.teams);
      }

      // Mulai alur pembagian tim & countdown
      jalankanTransisiMulaiRef.current();
    };

    const handleDikick = () => {
      onKeluar();
    };

    const handleSesiDibatalkan = (data?: { pesan?: string; alasan?: string }) => {
      onKeluar(data?.pesan || 'Sesi telah diakhiri oleh guru.');
    };

    const handleSesiSelesai = (data?: { pesan?: string }) => {
      onKeluar(data?.pesan || 'Sesi telah diakhiri oleh guru.');
    };

    socket.on('lobi:update', handleLobiUpdate);
    socket.on('teams_assigned', handleTeamsAssigned);
    socket.on('game:mulai', handleGameMulai);
    socket.on('sesi:dikick', handleDikick);
    socket.on('sesi:dibatalkan', handleSesiDibatalkan);
    socket.on('sesi:selesai', handleSesiSelesai);

    return () => {
      socket.off('lobi:update', handleLobiUpdate);
      socket.off('teams_assigned', handleTeamsAssigned);
      socket.off('game:mulai', handleGameMulai);
      socket.off('sesi:dikick', handleDikick);
      socket.off('sesi:dibatalkan', handleSesiDibatalkan);
      socket.off('sesi:selesai', handleSesiSelesai);
      startTimerRef.current.forEach(clearTimeout);
    };
  }, [gameType, pesertaId, nama, onKeluar]);

  // Nama label mode game
  const labelModeGame = useMemo(() => {
    switch (gameType) {
      case 'tarik_tambang':
        return 'Tarik Tambang';
      case 'balap_karung':
        return 'Balap Karung';
      case 'makan_kerupuk':
        return 'Makan Kerupuk';
      case 'panjat_pinang':
        return 'Panjat Pinang';
      default:
        return 'Game Edukasi';
    }
  }, [gameType]);

  // Pastikan user ada di list peserta tampilan
  const listPesertaTampil = useMemo(() => {
    const list = [...livePeserta];
    const exists = list.some((p) => p.id === pesertaId || p.nama === nama);
    if (!exists) {
      list.unshift({ id: pesertaId, nama, tim: detectedMyTeam });
    }
    return list;
  }, [livePeserta, pesertaId, nama, detectedMyTeam]);

  const jumlahPeserta = listPesertaTampil.length;

  // Pengelompokan Tim
  const teamGroups = useMemo(() => {
    // 1. Jika game Tarik Tambang: selalu 2 kelompok
    if (gameType === 'tarik_tambang') {
      const namaT1 = config?.namaTim1 || 'Tim Merah';
      const namaT2 = config?.namaTim2 || 'Tim Biru';
      const anggotaMerah: PesertaItem[] = [];
      const anggotaPutih: PesertaItem[] = [];

      listPesertaTampil.forEach((p, idx) => {
        if (p.tim === 'merah') anggotaMerah.push(p);
        else if (p.tim === 'putih') anggotaPutih.push(p);
        else {
          // Fallback round-robin jika belum di-assign
          if (idx % 2 === 0) anggotaMerah.push(p);
          else anggotaPutih.push(p);
        }
      });

      return [
        {
          id: 'merah',
          nama: namaT1,
          c: '#e2312d',
          t: '#ffffff',
          anggota: anggotaMerah,
        },
        {
          id: 'putih',
          nama: namaT2,
          c: '#1d8fe0',
          t: '#ffffff',
          anggota: anggotaPutih,
        },
      ];
    }

    // 2. Jika Balap Karung: bisa 3 atau 4 kelompok sesuai config.jumlahTim
    if (gameType === 'balap_karung') {
      const jumlahKelompok: number = Number(config?.jumlahTim) || (liveTeams.length > 0 ? liveTeams.length : 3);
      const warnaTim = [
        { id: 'merah', nama: 'Tim Merah', c: '#e2312d', t: '#ffffff' },
        { id: 'biru', nama: 'Tim Biru', c: '#1d8fe0', t: '#ffffff' },
        { id: 'hijau', nama: 'Tim Hijau', c: '#1f9d55', t: '#ffffff' },
        { id: 'kuning', nama: 'Tim Kuning', c: '#e6a100', t: '#ffffff' },
      ];

      const defs = warnaTim.slice(0, Math.min(4, Math.max(2, jumlahKelompok)));

      return defs.map((d, k) => {
        // Ambil anggota dari liveTeams jika ada
        const foundLiveTeam = liveTeams.find((lt) => lt.id === d.id);
        let anggota = foundLiveTeam ? foundLiveTeam.anggota : [];

        // Fallback jika liveTeams belum sinkron
        if (anggota.length === 0) {
          anggota = listPesertaTampil.filter((p, idx) => {
            if (p.tim) return p.tim === d.id;
            return idx % defs.length === k;
          });
        }

        return {
          id: d.id,
          nama: foundLiveTeam?.nama || d.nama,
          c: foundLiveTeam?.warna || d.c,
          t: d.t,
          anggota,
        };
      });
    }

    // 3. Game Individu (Makan Kerupuk / Panjat Pinang)
    return [];
  }, [gameType, config, listPesertaTampil, liveTeams]);

  // Cek tim milik user
  const timUserAktif = useMemo(() => {
    if (teamGroups.length === 0) return null;
    if (detectedMyTeam) {
      const found = teamGroups.find((tg) => tg.id === detectedMyTeam);
      if (found) return found;
    }
    // Cari dari anggota tim
    return teamGroups.find((tg) => tg.anggota.some((a) => a.id === pesertaId || a.nama === nama)) || teamGroups[0];
  }, [teamGroups, detectedMyTeam, pesertaId, nama]);

  // --- STATE ANIMASI PEMBAGIAN TIM & SHUFFLE POOL ---
  const [countdownVal, setCountdownVal] = useState<number | null>(null);
  const [animStage, setAnimStage] = useState<'IDLE' | 'SHUFFLING' | 'FLYING' | 'DONE'>('IDLE');
  const [headingText, setHeadingText] = useState('Mengacak nama…');
  const [subText, setSubText] = useState('Nama peserta dikocok, lalu dibagi ke kelompok.');
  const [landedIds, setLandedIds] = useState<string[]>([]);
  const [bumpingTeamId, setBumpingTeamId] = useState<string | null>(null);

  const poolRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<{ [pid: string]: HTMLElement | null }>({});
  const isAnimatingRef = useRef(false);

  // Fungsi countdown & animasi saat guru klik mulai
  const jalankanTransisiMulai = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const waitMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const rm = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    (async () => {
      // 1. HITUNG MUNDUR 3 - 1 (Dengan latar solid bersih tanpa transparansi)
      setStatusText('Guru menekan Mulai! Bersiaplah…');
      setCountdownVal(3);
      await waitMs(900);
      setCountdownVal(2);
      await waitMs(900);
      setCountdownVal(1);
      await waitMs(900);
      setCountdownVal(null);

      // Jika game individu tanpa tim
      if (teamGroups.length === 0) {
        setStatusText('Mulai! Bersiaplah…');
        await waitMs(400);
        onMulaiPermainan();
        return;
      }

      // 2. TAMPILKAN PAPAN ACAK NAMA (Pool nama-nama peserta dikocok sebelum dibagi ke kelompok)
      setIsStarting(true);
      setAnimStage('SHUFFLING');
      setHeadingText('Mengacak nama…');
      setSubText(
        teamGroups.length > 1
          ? `Nama peserta dikocok, lalu dibagi ke ${teamGroups.length} kelompok.`
          : 'Nama peserta dikocok, bersiaplah!'
      );
      setStatusText('Guru menekan Mulai! Mengacak nama…');
      setLandedIds([]);

      // Tunggu mounting DOM papan dan pool
      await waitMs(400);

      // Kocok pool secara nyata (Animasi Shuffle)
      if (!rm && poolRef.current) {
        const pool = poolRef.current;
        const children = Array.from(pool.children) as HTMLElement[];

        if (children.length > 1) {
          // Jika ada lebih dari 1 peserta: acak posisi DOM dan jalankan FLIP animation
          for (let round = 0; round < 4; round++) {
            const oldRects = new Map(children.map((c) => [c, c.getBoundingClientRect()]));
            children.sort(() => Math.random() - 0.5).forEach((c) => pool.appendChild(c));

            await Promise.all(
              children.map((c) => {
                const oldR = oldRects.get(c)!;
                const newR = c.getBoundingClientRect();
                const dx = oldR.left - newR.left;
                const dy = oldR.top - newR.top;
                const rot = (Math.random() - 0.5) * 16;
                return c.animate(
                  [
                    { transform: `translate(${dx}px, ${dy}px)` },
                    {
                      transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 18}px) rotate(${rot}deg) scale(1.12)`,
                      offset: 0.5,
                    },
                    { transform: 'none' },
                  ],
                  { duration: 420, easing: 'ease-in-out' }
                ).finished;
              })
            );
            await waitMs(120);
          }
        } else if (children.length === 1) {
          // Jika hanya 1 peserta (misal saat tes solo): kocok dengan gerakan lompat & goyang
          for (let round = 0; round < 3; round++) {
            const rot = (round % 2 === 0 ? 1 : -1) * 12;
            await children[0].animate(
              [
                { transform: 'none' },
                { transform: `translateY(-20px) rotate(${rot}deg) scale(1.15)`, offset: 0.5 },
                { transform: 'none' },
              ],
              { duration: 400, easing: 'ease-in-out' }
            ).finished;
            await waitMs(100);
          }
        }
      }

      await waitMs(500);

      // 3. MASUK KE TAHAP MEMBAGI KELOMPOK (Flying Token)
      setAnimStage('FLYING');
      setHeadingText('Membagi kelompok…');
      setSubText('Nama peserta sedang dibagi ke kelompok.');
      setStatusText('Membagi kelompok…');

      // Tentukan urutan terbang: nama user (isSelf) TERAKHIR!
      const allParticipants = [...listPesertaTampil];
      const sequence = allParticipants.sort((a, b) => {
        const aIsSelf = a.id === pesertaId || a.nama === nama;
        const bIsSelf = b.id === pesertaId || b.nama === nama;
        return (aIsSelf ? 1 : 0) - (bIsSelf ? 1 : 0);
      });

      // Terbang satu per satu
      for (let i = 0; i < sequence.length; i++) {
        const p = sequence[i];
        const isSelf = p.id === pesertaId || p.nama === nama;
        const targetTeam = teamGroups.find((tg) => tg.anggota.some((a) => a.id === p.id || a.nama === p.nama)) || teamGroups[i % teamGroups.length];
        const pTeam = targetTeam?.id;

        const sourceEl = poolRef.current?.querySelector(`[data-pid="${p.id}"]`) as HTMLElement | null;
        const destEl = slotRefs.current[p.id];

        if (!rm && sourceEl && destEl) {
          const s = sourceEl.getBoundingClientRect();
          const d = destEl.getBoundingClientRect();

          const tok = document.createElement('div');
          tok.className = 'tok';
          tok.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            z-index: 9999;
            pointer-events: none;
            will-change: transform;
            filter: drop-shadow(0 6px 12px rgba(0,0,0,0.45));
          `;

          const chipEl = document.createElement('span');
          chipEl.className = `pc ${isSelf ? 'me' : ''}`;
          chipEl.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 12px 3px 4px;
            border-radius: 999px;
            background: ${isSelf ? 'linear-gradient(135deg, #ffe88a, #f2c230)' : '#fffdf6'};
            border: 2px solid ${isSelf ? '#c79a14' : '#e8dfc8'};
            font-weight: 800;
            font-size: 13px;
            color: #163a2b;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          `;
          chipEl.innerHTML = `
            <span style="width:24px;height:24px;border-radius:50%;overflow:hidden;flex-shrink:0;display:inline-block;">
              ${getAvatarSvgString(p.id, p.nama, 24)}
            </span>
            <span style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.nama}</span>
            ${isSelf ? '<b style="background:#c8362f;color:#fff;font-size:9px;padding:1px 6px;border-radius:999px;font-weight:900;">Kamu</b>' : ''}
          `;
          tok.appendChild(chipEl);
          document.body.appendChild(tok);

          sourceEl.style.visibility = 'hidden';

          const up = Math.min(s.top, d.top) - (isSelf ? 85 : 45);
          const sx = d.left > s.left ? 1 : -1;

          await tok.animate(
            [
              { transform: `translate(${s.left}px, ${s.top}px)` },
              {
                transform: `translate(${(s.left + d.left) / 2}px, ${up}px) scale(${
                  isSelf ? 1.4 : 1.15
                }) rotate(${sx * 6}deg)`,
                offset: 0.5,
              },
              { transform: `translate(${d.left}px, ${d.top}px)` },
            ],
            {
              duration: isSelf ? 850 : 520,
              easing: 'cubic-bezier(.4,0,.2,1)',
              fill: 'both',
            }
          ).finished;

          tok.remove();
        } else if (sourceEl) {
          sourceEl.style.visibility = 'hidden';
        }

        // Tandai sudah mendarat di kartu tim
        setLandedIds((prev) => [...prev, p.id]);
        if (pTeam) {
          setBumpingTeamId(pTeam);
          setTimeout(() => setBumpingTeamId(null), 240);
        }

        await waitMs(rm ? 0 : 250);
      }

      // Semua mendarat!
      setAnimStage('DONE');
      const myTeam = teamGroups.find((tg) => tg.id === detectedMyTeam) ||
                     teamGroups.find((tg) => tg.anggota.some((a) => a.id === pesertaId || a.nama === nama)) ||
                     teamGroups[0];

      if (myTeam) {
        setHeadingText(`Kamu di ${myTeam.nama}!`);
        setSubText(`Namamu sudah masuk ke ${myTeam.nama}. Siap-siap, game segera dimulai!`);
      }

      await waitMs(1200);

      // 4. BARU MASUK KE SOALNYA: Beri tahu server bahwa animasi selesai dan siswa siap menerima soal pertama
      try {
        const socket = getSocket();
        socket.emit('siswa:siap_soal', {
          token,
          pesertaId,
        });
      } catch (err) {
        console.error('[siswa:siap_soal error]', err);
      }
      onMulaiPermainan();
    })();
  }, [teamGroups, listPesertaTampil, detectedMyTeam, pesertaId, nama, token, onMulaiPermainan]);

  jalankanTransisiMulaiRef.current = jalankanTransisiMulai;

  return (
    <div
      className="page fixed inset-0 w-full h-[100dvh] max-h-[100dvh] flex flex-col justify-between overflow-hidden select-none text-[#f4ecd8]"
      style={{
        background: `
          radial-gradient(ellipse 40% 14% at 22% 30%, rgba(255,255,255,0.07), transparent),
          repeating-linear-gradient(115deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 11px),
          radial-gradient(ellipse at 30% 8%, rgba(255,255,255,0.11), transparent 55%),
          radial-gradient(ellipse at 85% 75%, rgba(0,0,0,0.22), transparent 60%),
          linear-gradient(160deg, #2c5f47, #1f4a37 55%, #163a2b)
        `,
        boxShadow: 'inset 0 0 150px rgba(0,0,0,0.35)',
        fontFamily: "'Nunito', system-ui, sans-serif",
      }}
    >
      <style>{`
        html, body {
          overflow: hidden !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 74, 55, 0.08);
          border-radius: 999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1f4a37;
          border-radius: 999px;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #1f4a37 rgba(31, 74, 55, 0.08);
          -webkit-overflow-scrolling: touch;
        }
        @keyframes flipSand {
          0%, 84% { transform: rotate(0); animation-timing-function: cubic-bezier(.6,0,.25,1); }
          96%, 100% { transform: rotate(180deg); }
        }
        @keyframes sandTop {
          0% { transform: translateY(0) scaleY(1); animation-timing-function: ease-in; }
          5% { transform: translateY(24px) scaleY(1); animation-timing-function: linear; }
          82%, 100% { transform: translateY(24px) scaleY(0); }
        }
        @keyframes sandBottom {
          0%, 5% { transform: scaleY(0); }
          82%, 100% { transform: scaleY(1); }
        }
        @keyframes sandStream {
          0%, 6% { opacity: 0; }
          8%, 80% { opacity: 1; }
          82%, 100% { opacity: 0; }
        }
        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }
        @keyframes popIn {
          from { transform: scale(0.85); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes ringPulse {
          from { opacity: 0.95; transform: scale(1); }
          to { opacity: 0; transform: scale(1.25); }
        }
        .anim-flip {
          transform-box: view-box;
          transform-origin: 60px 80px;
          animation: flipSand 9s linear infinite;
        }
        .anim-s1 {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          transform: translateY(24px);
          animation: sandTop 9s linear infinite;
        }
        .anim-s2 {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          transform: scaleY(0);
          animation: sandBottom 9s linear infinite;
        }
        .anim-stm {
          opacity: 0;
          animation: sandStream 9s linear infinite;
        }
        /* REDESAIN ANIMASI PENGACAKAN & PEMBAGIAN TIM */
        .pool {
          width: 100%;
          max-width: 680px;
          margin: 6px auto 12px;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border: 2px dashed rgba(244, 236, 216, 0.4);
          border-radius: 26px;
          background: rgba(10, 32, 22, 0.45);
          box-shadow: inset 0 4px 18px rgba(0, 0, 0, 0.35);
          min-height: 56px;
          max-height: min(240px, 35vh);
          overflow-y: auto;
          transition: max-height 0.5s ease, opacity 0.4s ease, margin 0.5s ease, padding 0.5s ease;
        }
        .pool.done {
          max-height: 0;
          opacity: 0;
          margin: 0;
          padding: 0;
          border-width: 0;
          overflow: hidden;
        }
        .pl {
          display: inline-flex;
          max-width: 100%;
          border-radius: 999px;
          border: 2px dashed transparent;
          will-change: transform;
        }
        .pl.gone {
          border-color: rgba(244, 236, 216, 0.28);
        }
        .pl.gone .pc {
          visibility: hidden;
        }
        .tok {
          position: fixed;
          left: 0;
          top: 0;
          z-index: 9999;
          pointer-events: none;
          will-change: transform;
          filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.45));
        }
        .tok .pc.me {
          transform: none;
        }
        .pc {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 2px 10px 2px 3px;
          border-radius: 999px;
          background: #fffdf6;
          border: 2px solid #e8dfc8;
          font-weight: 800;
          font-size: 12px;
          color: #163a2b;
        }
        .pc.me {
          background: linear-gradient(135deg, #ffe88a, #f2c230);
          border-color: #c79a14;
          box-shadow: 0 0 0 2px rgba(242, 194, 48, 0.4), 0 0 16px rgba(242, 194, 48, 0.75);
        }
        .pc.me::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 999px;
          border: 2px solid #f2c230;
          animation: ringPulse 1.5s ease-out infinite;
          pointer-events: none;
        }
        @keyframes popLand {
          from { transform: scale(0.65); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .land {
          animation: popLand 0.45s cubic-bezier(0.3, 1.6, 0.5, 1);
        }
        .tm-bump {
          transform: scale(1.04) !important;
          transition: transform 0.2s ease;
        }
        .tm-mine {
          box-shadow: 0 0 0 4px #f2c230, 0 0 25px rgba(242, 194, 48, 0.55), 0 6px 0 rgba(0, 0, 0, 0.22) !important;
          transform: translateY(-2px) !important;
          opacity: 1 !important;
        }
        .tm-dim {
          opacity: 0.65 !important;
          filter: saturate(0.7) !important;
        }
      `}</style>

      {/* DEKORASI RUMUS & BINTANG KAPUR DI LATAR BELAKANG */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-30 z-0"
        viewBox="0 0 1000 560"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g fill="none" stroke="#f4ecd8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M70 170l5 11 12 2-9 8 3 12-11-6-11 6 3-12-9-8 12-2zM930 140l5 11 12 2-9 8 3 12-11-6-11 6 3-12-9-8 12-2zM140 330l4 8 9 2-7 6 2 9-8-4-8 4 2-9-7-6 9-2z" />
          <circle cx="880" cy="440" r="22" />
          <path d="M873 464h14M875 472h10M880 412v-10M858 420l-8-6M902 420l8-6" />
        </g>
        <text
          x="760"
          y="330"
          fontFamily="Caveat, cursive"
          fontSize="34"
          fill="#f4ecd8"
          transform="rotate(5 760 330)"
        >
          a² + b² = c²
        </text>
      </svg>

      {/* ============================================================ */}
      {/* 1. HEADER ATAS (LOGO, CHIP PENGGUNA, TOMBOL KELUAR)          */}
      {/* ============================================================ */}
      <header className="relative z-20 h-12 sm:h-14 shrink-0 flex items-center justify-between px-3.5 sm:px-6 bg-[#0a2016]/55 border-b border-white/10 text-[#f4ecd8]">
        {/* Logo */}
        <div className="flex items-center gap-2 font-black text-xl sm:text-2xl tracking-wide select-none">
          <svg className="w-6 h-6 sm:w-7 sm:h-7 text-[#f4ecd8]" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 11c7-3 14-1 19 4v26c-5-5-12-7-19-4zM43 11c-7-3-14-1-19 4v26c5-5 12-7 19-4z" />
            <path d="M10 19h8M10 26h8M30 19h8M30 26h8" />
          </svg>
          <span className="font-['Caveat',sans-serif] text-2xl sm:text-3xl font-bold">Discere</span>
          {token && (
            <span className="bg-[#f2c230] text-[#163a2b] font-mono font-black text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full shadow-sm ml-1">
              PIN {token}
            </span>
          )}
        </div>

        {/* Info Siswa & Tombol Keluar */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Chip Nama Siswa */}
          <div className="flex items-center gap-2 bg-[#fbf6e9] border border-[#e8dfc8] rounded-full py-0.5 sm:py-1 px-2.5 sm:px-3 text-[#163a2b] font-extrabold text-xs sm:text-sm shadow-sm">
            <span className="relative w-6 h-6 sm:w-7 sm:h-7 flex-none inline-block">
              <AvatarSvg id={pesertaId} name={nama} size={28} />
              <i className="absolute right-0 bottom-0 w-2 h-2 rounded-full bg-[#4cc36b] border border-[#fbf6e9]" />
            </span>
            <span className="max-w-[100px] sm:max-w-[150px] truncate">{nama}</span>
          </div>

          {/* Tombol Keluar */}
          <button
            onClick={() => onKeluar()}
            type="button"
            className="flex items-center gap-1.5 bg-[#f4ecd8] hover:bg-[#fff9eb] active:scale-95 text-[#163a2b] font-extrabold text-xs py-1.5 px-3 sm:px-3.5 rounded-full shadow-sm transition-all cursor-pointer"
            title="Keluar dari sesi"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />
            </svg>
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* RUMBAI BUNTING BENDERA 17 AGUSTUS DI BAWAH HEADER */}
      <div
        className="w-full h-5 sm:h-6 shrink-0 pointer-events-none relative z-10"
        style={{
          background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='50'%3E%3Cpath d='M0 6Q40 18 80 6' stroke='%236b4a2f' stroke-width='2' fill='none'/%3E%3Cpath d='M6 9l28 5-14 30z' fill='%23c8362f'/%3E%3Cpath d='M46 14l28-5-14 30z' fill='%23f6f1e6'/%3E%3C/svg%3E") repeat-x`,
          backgroundSize: '48px 30px',
        }}
        aria-hidden="true"
      />

      {/* ============================================================ */}
      {/* 2. KONTEN UTAMA: 2 LOGIKA (MENUNGGU GURU vs MEMBAGI TIM)     */}
      {/* ============================================================ */}
      <main
        className={`relative z-10 flex-1 min-h-0 flex flex-col justify-center items-center overflow-hidden transition-[padding] duration-500 ${
          !isStarting
            ? 'px-4 py-2 lg:pr-[330px] lg:pl-10'
            : 'px-4 py-2'
        }`}
      >
        {/* BAGIAN TENGAH: RUANG TUNGGU / PEMBAGIAN KELOMPOK */}
        <div className="w-full max-w-2xl flex flex-col items-center text-center my-auto">
          {!isStarting ? (
            /* ---------------------------------------------------- */
            /* LOGIKA 1: SAAT DI RUANG TUNGGU (MENUNGGU GURU KLIK)  */
            /* ---------------------------------------------------- */
            <div className="flex flex-col items-center w-full max-w-md animate-[popIn_0.4s_ease-out]">
              {/* ANIMASI JAM PASIR KAPUR BERPUTAR */}
              <svg
                className="w-11 sm:w-14 lg:w-16 h-14 sm:h-18 lg:h-20 mb-0.5 sm:mb-1 overflow-visible select-none shrink-0"
                viewBox="0 0 120 160"
                aria-hidden="true"
              >
                <defs>
                  <clipPath id="sandClip">
                    <path d="M26 18H94C94 48 66 62 64 80C66 98 94 112 94 142H26C26 112 54 98 56 80C54 62 26 48 26 18Z" />
                  </clipPath>
                </defs>
                <g className="anim-flip">
                  {/* Kaca Jam Pasir Transparan */}
                  <path
                    d="M26 18H94C94 48 66 62 64 80C66 98 94 112 94 142H26C26 112 54 98 56 80C54 62 26 48 26 18Z"
                    fill="rgba(255,255,255,0.14)"
                  />
                  {/* Butiran Pasir Kuning Beranimasi */}
                  <g clipPath="url(#sandClip)">
                    <rect className="anim-stm" x="58.7" y="80" width="2.6" height="62" fill="#f2c230" />
                    <rect className="anim-s1" x="20" y="18" width="80" height="38" fill="#f2c230" />
                    <rect className="anim-s2" x="20" y="104" width="80" height="38" fill="#f2c230" />
                  </g>
                  {/* Kilau Kaca */}
                  <path
                    d="M35 28Q37 44 47 55M85 132Q83 116 73 105"
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity="0.45"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {/* Garis Tepi Kaca */}
                  <path
                    d="M26 18H94C94 48 66 62 64 80C66 98 94 112 94 142H26C26 112 54 98 56 80C54 62 26 48 26 18Z"
                    fill="none"
                    stroke="#f4ecd8"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  {/* Bingkai Kayu Atas & Bawah Jam Pasir */}
                  <rect x="14" y="6" width="92" height="13" rx="6" fill="#8b6a4a" stroke="#6f5238" strokeWidth="2" />
                  <rect x="14" y="141" width="92" height="13" rx="6" fill="#8b6a4a" stroke="#6f5238" strokeWidth="2" />
                </g>
              </svg>

              {/* Judul Font Tangan */}
              <h1 className="font-['Caveat',sans-serif] text-3xl sm:text-4xl lg:text-5xl font-bold text-[#f4ecd8] drop-shadow-md leading-tight">
                Menunggu <span className="text-[#f2c230]">Guru…</span>
              </h1>
              <p className="text-[11px] sm:text-xs lg:text-sm text-[#f4ecd8]/90 font-semibold mt-0.5 mb-1.5 sm:mb-2 max-w-md">
                Game akan dimulai setelah guru menekan tombol mulai.
              </p>

              {/* Kotak Info: Peserta & Mode Game */}
              <div className="w-full max-w-[280px] sm:max-w-xs lg:max-w-sm grid grid-cols-2 bg-[#fbf6e9] border-2 sm:border-[3px] border-[#e8dfc8] rounded-xl sm:rounded-2xl p-1.5 sm:p-2 text-[#163a2b] shadow-[0_4px_0_rgba(0,0,0,0.2)]">
                {/* Kolom Peserta */}
                <div className="flex flex-col items-center gap-0.5 border-r-2 border-[#1f4a37]/20 pr-1.5">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#1f4a37]" viewBox="0 0 48 48" fill="currentColor">
                    <circle cx="24" cy="15" r="7" />
                    <path d="M11 40q0-13 13-13t13 13z" />
                    <g opacity="0.65">
                      <circle cx="9" cy="19" r="5" />
                      <circle cx="39" cy="19" r="5" />
                      <path d="M0 38q0-10 8-10l3 12zM48 38q0-10-8-10l-3 12z" />
                    </g>
                  </svg>
                  <small className="font-bold text-[9px] sm:text-[11px] text-[#5a6f62]">Peserta</small>
                  <b className="text-xs sm:text-base font-black">
                    {jumlahPeserta} / {config?.maxPeserta || 40}
                  </b>
                </div>

                {/* Kolom Mode Game */}
                <div className="flex flex-col items-center gap-0.5 pl-1.5">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#1f4a37]" viewBox="0 0 48 48">
                    <path fill="currentColor" d="M14 14h20c7 0 10 6 11 14 .6 5-2 8-6 6l-5-4H14l-5 4c-4 2-6.6-1-6-6 1-8 4-14 11-14z" />
                    <g stroke="#fbf6e9" strokeWidth="3" strokeLinecap="round">
                      <path d="M13 21v6M10 24h6" />
                    </g>
                    <circle cx="31" cy="22" r="2" fill="#fbf6e9" />
                    <circle cx="36" cy="26" r="2" fill="#fbf6e9" />
                  </svg>
                  <small className="font-bold text-[9px] sm:text-[11px] text-[#5a6f62]">Mode Game</small>
                  <b className="text-xs sm:text-sm font-black truncate max-w-[120px]" title={templateJudul || labelModeGame}>
                    {labelModeGame}
                  </b>
                </div>
              </div>

              {/* Panel Peserta Khusus Mobile (diletakkan langsung di bawah kotak info) */}
              <div className="w-full max-w-[320px] sm:max-w-sm lg:hidden mt-2 bg-[#fbf6e9] border-2 border-[#e8dfc8] rounded-xl p-1.5 sm:p-2 text-[#163a2b] shadow-sm flex flex-col h-auto shrink-0">
                <div className="flex items-center justify-between border-b border-[#1f4a37]/15 pb-1 px-1 mb-1 shrink-0">
                  <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-[#1f4a37]" viewBox="0 0 48 48" fill="currentColor">
                      <circle cx="24" cy="15" r="7" />
                      <path d="M11 40q0-13 13-13t13 13z" />
                    </svg>
                    <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-wide">
                      Daftar Peserta ({jumlahPeserta})
                    </h2>
                  </div>
                  {jumlahPeserta > 4 && (
                    <span className="text-[9px] font-bold text-[#5a6f62]">Scroll</span>
                  )}
                </div>

                <ul className="grid grid-cols-2 gap-1.5 max-h-[110px] sm:max-h-[140px] overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
                  {listPesertaTampil.map((p, idx) => {
                    const isMe = p.id === pesertaId || p.nama === nama;
                    return (
                      <li
                        key={p.id || idx}
                        className={`flex items-center gap-1.5 p-1 px-1.5 rounded-lg text-[10px] sm:text-[11px] border ${
                          isMe
                            ? 'bg-[#1f4a37]/15 font-black text-[#163a2b] border-[#1f4a37]/35 shadow-xs'
                            : 'bg-[#fffdf6] border-[#e8dfc8] font-bold text-[#163a2b]'
                        }`}
                      >
                        <span className="relative w-4 h-4 sm:w-5 sm:h-5 shrink-0 inline-block">
                          <AvatarSvg id={p.id} name={p.nama} size={20} />
                          <i className="absolute right-0 bottom-0 w-1.5 h-1.5 rounded-full bg-[#4cc36b] border border-[#fbf6e9]" />
                        </span>
                        <span className="truncate flex-1 font-extrabold">{p.nama}</span>
                        {isMe && (
                          <span className="text-[7px] font-black bg-[#1f4a37] text-[#f4ecd8] px-1 py-0.2 rounded-full shrink-0">
                            Kamu
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : (
            /* ---------------------------------------------------- */
            /* LOGIKA 2: KETIKA GURU KLIK MULAI (MEMBAGI KELOMPOK)  */
            /* ---------------------------------------------------- */
            <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center animate-[popIn_0.35s_ease-out]">
              {teamGroups.length > 0 ? (
                <>
                  <h2 className="font-['Caveat',sans-serif] text-2xl sm:text-3xl lg:text-4xl font-bold text-[#f4ecd8] drop-shadow-md leading-tight shrink-0">
                    {headingText.includes('Kamu di') ? (
                      <>
                        Kamu di <span className="text-[#f2c230]">{headingText.replace('Kamu di ', '')}</span>
                      </>
                    ) : headingText.includes('Mengacak') ? (
                      <>
                        Mengacak <span className="text-[#f2c230]">nama…</span>
                      </>
                    ) : (
                      <>
                        Membagi <span className="text-[#f2c230]">kelompok…</span>
                      </>
                    )}
                  </h2>
                  <p className="text-[11px] sm:text-xs lg:text-sm text-[#f4ecd8]/90 font-semibold mt-0.5 mb-1 max-w-lg shrink-0">
                    {subText}
                  </p>

                  {/* POOL PESERTA SEMENTARA (UNTUK ANIMASI KOCOK & TERBANG) */}
                  <div
                    ref={poolRef}
                    className={`pool ${animStage === 'DONE' ? 'done' : ''}`}
                    aria-hidden={animStage === 'DONE'}
                  >
                    {listPesertaTampil.map((p) => {
                      const isSelf = p.id === pesertaId || p.nama === nama;
                      return (
                        <span
                          key={p.id}
                          data-pid={p.id}
                          className={`pl ${landedIds.includes(p.id) ? 'gone' : ''}`}
                        >
                          <span className={`pc ${isSelf ? 'me' : ''}`}>
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden shrink-0 inline-block">
                              <AvatarSvg id={p.id} name={p.nama} size={24} />
                            </span>
                            <span className="max-w-[85px] sm:max-w-[110px] truncate text-xs sm:text-[13px]">{p.nama}</span>
                            {isSelf && (
                              <b className="bg-[#c8362f] text-white text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-full font-black">
                                Kamu
                              </b>
                            )}
                          </span>
                        </span>
                      );
                    })}
                  </div>

                  {/* GRID KARTU KELOMPOK (SESUAI JUMLAH KELOMPOK: 2, 3, ATAU 4 TIM) */}
                  <div className="w-full flex-1 min-h-0 max-h-[50vh] sm:max-h-[56vh] overflow-y-auto custom-scrollbar p-1">
                    <div
                      className={`grid gap-2 sm:gap-3 w-full text-left mx-auto ${
                        teamGroups.length === 2
                          ? 'grid-cols-2 max-w-lg'
                          : teamGroups.length === 3
                            ? 'grid-cols-1 sm:grid-cols-3 max-w-2xl'
                            : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 max-w-3xl'
                      }`}
                    >
                      {teamGroups.map((team) => {
                        const isMyTeam = animStage === 'DONE' && timUserAktif?.id === team.id;
                        const isDimmed = animStage === 'DONE' && !isMyTeam;
                        const isBumping = bumpingTeamId === team.id;
                        const landedInTeam = team.anggota.filter((m) =>
                          animStage === 'DONE' ? true : landedIds.includes(m.id)
                        );

                        return (
                          <article
                            key={team.id}
                            className={`relative bg-[#fbf6e9] border-2 sm:border-[3px] border-[#e8dfc8] rounded-xl sm:rounded-2xl overflow-hidden text-[#163a2b] shadow-sm transition-all duration-300 flex flex-col ${
                              isBumping ? 'tm-bump' : ''
                            } ${
                              isMyTeam
                                ? 'tm-mine'
                                : isDimmed
                                  ? 'tm-dim'
                                  : 'opacity-90'
                            }`}
                          >
                            {/* Header Kartu Tim */}
                            <div
                              className="flex items-center justify-between gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 font-black text-xs shrink-0"
                              style={{ backgroundColor: team.c, color: team.t }}
                            >
                              <div className="flex items-center gap-1 truncate">
                                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M5 3v18M5 4h13l-3 4 3 4H5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                                </svg>
                                <h3 className="font-['Caveat',sans-serif] text-sm sm:text-lg font-bold truncate leading-none">
                                  {team.nama}
                                </h3>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[9px] sm:text-[10px] bg-black/20 px-1.5 py-0.2 rounded-full font-extrabold">
                                  {animStage === 'DONE'
                                    ? `${team.anggota.length}/${team.anggota.length}`
                                    : `${landedInTeam.length}/${team.anggota.length}`}
                                </span>
                                {isMyTeam && (
                                  <span className="bg-[#f2c230] text-[#163a2b] text-[8px] sm:text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-sm">
                                    Timmu
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Daftar Anggota di Kelompok Ini */}
                            <div className="p-1 sm:p-1.5 flex flex-wrap gap-1 min-h-[36px] max-h-[85px] sm:max-h-[120px] overflow-y-auto overscroll-contain content-start custom-scrollbar">
                              {team.anggota.length > 0 ? (
                                team.anggota.map((member, mIdx) => {
                                  const isSelf = member.id === pesertaId || member.nama === nama;
                                  const hasLanded = animStage === 'DONE' || landedIds.includes(member.id);

                                  return (
                                    <span
                                      key={member.id || mIdx}
                                      ref={(el) => {
                                        if (el) slotRefs.current[member.id] = el;
                                      }}
                                      className={`inline-flex rounded-full transition-all ${
                                        hasLanded ? '' : 'border border-dashed border-[#1f4a37]/30'
                                      }`}
                                    >
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-full py-0.5 px-1.5 text-[9px] sm:text-[10px] font-black text-[#163a2b] shadow-xs transition-opacity ${
                                          hasLanded
                                            ? animStage === 'FLYING'
                                              ? 'land opacity-100'
                                              : 'opacity-100'
                                            : 'invisible opacity-0'
                                        } ${
                                          isSelf
                                            ? 'bg-gradient-to-r from-[#ffe88a] to-[#f2c230] border border-[#c79a14] ring-1 ring-[#f2c230]'
                                            : 'bg-[#fffdf6] border border-[#e8dfc8]'
                                        }`}
                                      >
                                        <AvatarSvg id={member.id} name={member.nama} size={15} />
                                        <span className="truncate max-w-[60px] sm:max-w-[75px]">{member.nama}</span>
                                        {isSelf && (
                                          <b className="bg-[#c8362f] text-white text-[7px] px-1 py-0.2 rounded-full font-black">
                                            Kamu
                                          </b>
                                        )}
                                      </span>
                                    </span>
                                  );
                                })
                              ) : (
                                <p className="text-[10px] text-[#5a6f62] italic m-auto">Menunggu anggota…</p>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                /* Jika game individu (Makan Kerupuk / Panjat Pinang) */
                <div className="flex flex-col items-center">
                  <h2 className="font-['Caveat',sans-serif] text-2xl sm:text-4xl font-bold text-[#f4ecd8] drop-shadow-md leading-tight">
                    Bersiap! <span className="text-[#f2c230]">Game Dimulai…</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-[#f4ecd8]/90 font-semibold mt-1 mb-2">
                    Semua peserta sudah siap di arena {labelModeGame}!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* PANEL SAMPING: DAFTAR PESERTA KHUSUS DESKTOP                 */}
        {/* ============================================================ */}
        {!isStarting && (
          <aside className="hidden lg:flex absolute right-6 xl:right-10 top-1/2 -translate-y-1/2 w-64 xl:w-72 bg-[#fbf6e9] border-[3px] border-[#e8dfc8] rounded-2xl p-3 text-[#163a2b] shadow-[0_5px_0_rgba(0,0,0,0.25)] flex-col h-auto max-h-[min(480px,65vh)] shrink-0 animate-[popIn_0.4s_ease-out] z-20">
            {/* Header Panel */}
            <div className="flex items-center justify-between border-b border-[#1f4a37]/15 pb-1.5 px-1 mb-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-[#1f4a37]" viewBox="0 0 48 48" fill="currentColor">
                  <circle cx="24" cy="15" r="7" />
                  <path d="M11 40q0-13 13-13t13 13z" />
                </svg>
                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide">
                  Daftar Peserta ({jumlahPeserta})
                </h2>
              </div>
              {jumlahPeserta > 6 && (
                <span className="text-[10px] font-bold text-[#5a6f62]">Scroll</span>
              )}
            </div>

            {/* List Peserta 1 Kolom di Desktop */}
            <ul className="flex flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1 custom-scrollbar max-h-[360px]">
              {listPesertaTampil.map((p, idx) => {
                const isMe = p.id === pesertaId || p.nama === nama;
                return (
                  <li
                    key={p.id || idx}
                    className={`flex items-center gap-2 p-1.5 rounded-xl text-xs transition-all border ${
                      isMe
                        ? 'bg-[#1f4a37]/15 font-black text-[#163a2b] border-[#1f4a37]/30'
                        : 'bg-[#fffdf6] border-[#e8dfc8] font-bold text-[#163a2b]'
                    }`}
                  >
                    <span className="relative w-6 h-6 shrink-0 inline-block">
                      <AvatarSvg id={p.id} name={p.nama} size={24} />
                      <i className="absolute right-0 bottom-0 w-1.5 h-1.5 rounded-full bg-[#4cc36b] border border-[#fbf6e9]" />
                    </span>
                    <span className="truncate flex-1 text-xs">{p.nama}</span>
                    {isMe && (
                      <span className="text-[9px] font-black bg-[#1f4a37] text-[#f4ecd8] px-1.5 py-0.2 rounded-full shrink-0">
                        Kamu
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </main>

      {/* ============================================================ */}
      {/* 3. LANTAI KAYU BAWAH (FLOOR) & STATUS PILL BERPUTAR          */}
      {/* ============================================================ */}
      <footer className="relative z-20 min-h-[46px] sm:min-h-[52px] shrink-0 grid place-items-center bg-[linear-gradient(#b99672_0_5px,transparent_5px),repeating-linear-gradient(90deg,#8b6a4a_0_118px,#7a5b3e_118px_120px)] border-t-2 sm:border-t-[3px] border-[#6f5238] pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
        <div
          role="status"
          className="flex items-center gap-2.5 bg-[#163a2b] text-[#f4ecd8] font-bold text-xs sm:text-sm py-1.5 px-4 sm:px-6 rounded-full shadow-[0_3px_0_rgba(0,0,0,0.3)] max-w-[90%]"
        >
          <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-[#f4ecd8]/30 border-t-[#f2c230] rounded-full animate-spin shrink-0" />
          <span className="truncate">{statusText}</span>
        </div>
      </footer>

      {/* ============================================================ */}
      {/* OVERLAY HITUNG MUNDUR 3 - 1 SAAT GURU KLIK MULAI            */}
      {/* ============================================================ */}
      {countdownVal !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#163a2b] text-[#f4ecd8] animate-[fadeIn_0.15s_ease-out] select-none">
          {/* Latar belakang papan tulis Discere solid */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#f4ecd8_1px,transparent_1px)] [background-size:24px_24px]" />

          <div className="relative z-10 flex flex-col items-center gap-3 px-8 py-7 rounded-3xl bg-[#1f4a37] border-3 sm:border-4 border-[#e8dfc8]/30 shadow-[0_16px_48px_rgba(0,0,0,0.55)] max-w-sm sm:max-w-md w-[88%] text-center">
            <span className="font-black text-xs sm:text-sm uppercase tracking-widest text-[#f2c230] drop-shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f2c230] animate-ping" />
              Game Dimulai Dalam
            </span>
            <div
              key={countdownVal}
              className="font-['Caveat',sans-serif] text-8xl sm:text-9xl font-black text-[#f2c230] animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)] drop-shadow-[0_6px_24px_rgba(242,194,48,0.75)] leading-none my-1"
            >
              {countdownVal}
            </div>
            <p className="text-xs sm:text-sm font-bold text-[#f4ecd8]/90 max-w-xs mx-auto">
              Bersiaplah! Nama peserta akan segera diacak...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

