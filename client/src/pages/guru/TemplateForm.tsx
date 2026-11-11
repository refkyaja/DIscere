import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { apiRequest } from '../../lib/api';
import {
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
          game === 'panjat_pinang' || game === 'balap_karung'
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
                  opsiC: q.opsiC || '',
                  jawabanBenar: q.jawabanBenar || 'A',
                  penjelasan: q.penjelasan || '',
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
      <div className="portal-bg min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#f2c230] mb-3" />
        <p className="portal-cv text-2xl text-[#f4ecd8]">Memuat formulir template...</p>
      </div>
    );
  }

  return (
    <div className="portal-bg">
      <div className="max-w-4xl mx-auto w-full p-6 md:p-10 space-y-6">
        {/* Header Bar */}
        <div className="portal-head">
          <div>
            <h1>{isEdit ? 'Ubah Template Kuis' : 'Buat Template Kuis Baru'}</h1>
            <p>Susun materi soal untuk dimainkan dalam mini-game edukasi interaktif DISCERE.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/guru?tab=template')}
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
      <div className="portal-ledge" aria-hidden="true">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0 34C240 6 480 62 720 34S1200 6 1440 34V80H0z" fill="#a6783c" />
          <path d="M0 56C260 34 520 80 760 56S1220 36 1440 58V80H0z" fill="#8d6444" />
        </svg>
        <div className="portal-chalks">
          <i style={{ width: '84px', background: '#7a9c85' }} />
          <i style={{ width: '70px', background: '#7a9c85' }} />
          <i style={{ width: '92px', background: '#7a9c85' }} />
        </div>
      </div>
    </div>
  );
}
