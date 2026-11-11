import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { apiRequest } from '../../lib/api';
import {
  PortalLedge,
  TemplateEditor,
  type TemplateEditorInitialData,
  type TemplateEditorPayload,
} from '../../components';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';

export default function TemplateForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [initialData, setInitialData] = useState<TemplateEditorInitialData | undefined>(undefined);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setInitialData(undefined);
      setLoading(false);
      setLoadError(null);
      return;
    }

    async function loadTemplate() {
      try {
        setLoading(true);
        setLoadError(null);
        const res = await apiRequest<{ template: any }>(`/template/${id}`);
        const t = res.template;
        const game = t.game || 'tarik_tambang';
        const mode: 'solo' | 'multi' =
          game === 'panjat_pinang'
            ? 'multi'
            : t.mode === 'solo'
            ? 'solo'
            : 'multi';

        setInitialData({
          judul: t.judul || '',
          game,
          mode,
          questions:
            t.questions && t.questions.length > 0
              ? t.questions.map((q: any, idx: number) => ({
                  urutan: q.urutan || idx + 1,
                  teks: q.teks || '',
                  opsiA: q.opsiA || '',
                  opsiB: q.opsiB || '',
                  opsiC: q.opsiC ?? null,
                  opsiD: q.opsiD ?? null,
                  opsiE: q.opsiE ?? null,
                  jawabanBenar: q.jawabanBenar || 'A',
                  penjelasan: q.penjelasan || '',
                  kesulitan: q.kesulitan || 'sedang',
                  dibuatAi: Boolean(q.dibuatAi),
                }))
              : [],
        });
      } catch (err: any) {
        setLoadError(err.pesan || 'Gagal memuat template.');
      } finally {
        setLoading(false);
      }
    }

    loadTemplate();
  }, [id]);

  const handleSimpan = async (payload: TemplateEditorPayload) => {
    if (isEdit) {
      await apiRequest(`/template/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiRequest('/template', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    navigate('/guru?tab=template');
  };

  if (loading) {
    return (
      <div className="portal-bg relative">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#f2c230] mb-3" />
          <p className="portal-cv text-2xl text-[#f4ecd8]">Memuat formulir template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-bg">
      <div className="max-w-5xl mx-auto w-full p-6 md:p-10 space-y-6">
        {/* Header Bar */}
        <div className="portal-head flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 pr-2">
            <h1>{isEdit ? 'Ubah Template Kuis' : 'Buat Template Kuis Baru'}</h1>
            <p>Susun materi soal untuk dimainkan dalam mini-game edukasi interaktif DISCERE.</p>
          </div>

          <div className="shrink-0 self-start pt-1">
            <button
              type="button"
              onClick={() => {
                if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate('/guru?tab=template');
                }
              }}
              className="portal-btn ghost sm"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Template
            </button>
          </div>
        </div>

        {loadError ? (
          <div className="portal-banner error">
            <AlertTriangle className="w-5 h-5 shrink-0 text-[#c8362f]" />
            <span className="font-bold text-[#c8362f]">{loadError}</span>
          </div>
        ) : (
          <TemplateEditor
            key={id || 'baru'}
            initialData={initialData}
            onSubmit={handleSimpan}
            onCancel={() => navigate('/guru?tab=template')}
            submitLabel="Simpan Template"
          />
        )}
      </div>

      {/* DUDUKAN PAPAN TULIS COKLAT DI PALING BAWAH (MEMANJANG FULL DARI UJUNG KANAN KE KIRI) */}
      <PortalLedge />
    </div>
  );
}
