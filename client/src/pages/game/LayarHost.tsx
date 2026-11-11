import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { apiRequest } from '../../lib/api';
import LayarHostSolo from './LayarHostSolo';
import LayarHostMulti from './LayarHostMulti';
import LayarHostKerupuk from './LayarHostKerupuk';
import LayarHostPanjatPinang from './LayarHostPanjatPinang';
import LayarHostBalapKarung from './LayarHostBalapKarung';
import { Loader2 } from 'lucide-react';
import { Card, Button } from '../../components';

export default function LayarHost() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'solo' | 'multi' | null>(null);
  const [game, setGame] = useState<'tarik_tambang' | 'makan_kerupuk' | 'panjat_pinang' | 'balap_karung'>('tarik_tambang');
  const [loading, setLoading] = useState(true);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);

  useEffect(() => {
    async function checkSessionMode() {
      if (!id) return;
      try {
        const res = await apiRequest<{
          session: {
            mode: 'solo' | 'multi';
            game?: 'tarik_tambang' | 'makan_kerupuk' | 'panjat_pinang' | 'balap_karung';
          };
        }>(`/sesi/${id}`);
        setMode(res.session.mode || 'solo');
        if (res.session.game === 'makan_kerupuk') {
          setGame('makan_kerupuk');
        } else if (res.session.game === 'panjat_pinang') {
          setGame('panjat_pinang');
        } else if (res.session.game === 'balap_karung') {
          setGame('balap_karung');
        }
      } catch (err: any) {
        setErrorPesan(err.pesan || 'Gagal memeriksa sesi permainan.');
      } finally {
        setLoading(false);
      }
    }
    checkSessionMode();
  }, [id]);

  if (loading) {
    return (
      <div className="portal-bg min-h-screen flex flex-col items-center justify-center text-[#f4ecd8]">
        <Loader2 className="w-10 h-10 animate-spin text-[#f2c230] mb-3" />
        <p className="portal-cv text-2xl">Memuat sesi permainan...</p>
      </div>
    );
  }

  if (errorPesan) {
    return (
      <div className="portal-bg min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-[#fbf6e9] border-2 border-[#e0d5b8] text-center rounded-3xl shadow-xl">
          <h2 className="portal-cv text-3xl text-[#1d3b2e] mb-2">Terjadi Kesalahan</h2>
          <p className="text-[#6b7d6c] text-sm mb-6">{errorPesan}</p>
          <Button variant="utama" onClick={() => navigate('/guru')} className="w-full">
            Kembali ke Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (game === 'makan_kerupuk') {
    return <LayarHostKerupuk />;
  }

  if (game === 'panjat_pinang') {
    return <LayarHostPanjatPinang />;
  }

  if (game === 'balap_karung') {
    return <LayarHostBalapKarung />;
  }

  if (mode === 'multi') {
    return <LayarHostMulti />;
  }

  return <LayarHostSolo />;
}
