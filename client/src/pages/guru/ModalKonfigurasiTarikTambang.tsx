import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components';
import {
  AlertTriangle,
  Clock,
  Flag,
  Flame,
  Loader2,
  Monitor,
  Play,
  Sliders,
  Users,
  Zap,
} from 'lucide-react';

export type KesulitanTarik = 'mudah' | 'sedang' | 'sulit';

export interface KonfigurasiTarikTambangPayload {
  sumberSoal: 'bank_soal';
  kesulitan: KesulitanTarik;
  durasiRonde: 15 | 20 | 30;
  bonusAktif: boolean;
  powerUpAktif: boolean;
  namaTim1: string;
  namaTim2: string;
  maxPeserta: number;
  batasMenang: number;
}

interface ModalKonfigurasiTarikTambangProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  templateJudul: string;
  templateMode: 'solo' | 'multi';
  totalSoal: number;
  onMulai: (config: KonfigurasiTarikTambangPayload) => void;
  loading?: boolean;
}

const LABEL_KESULITAN: Record<KesulitanTarik, string> = {
  mudah: 'Mudah',
  sedang: 'Sedang',
  sulit: 'Sulit',
};

export default function ModalKonfigurasiTarikTambang({
  isOpen,
  onClose,
  templateId,
  templateJudul,
  templateMode,
  totalSoal,
  onMulai,
  loading = false,
}: ModalKonfigurasiTarikTambangProps) {
  const [kesulitan, setKesulitan] = useState<KesulitanTarik>('sedang');
  const [durasiRonde, setDurasiRonde] = useState<15 | 20 | 30>(20);
  const [bonusAktif, setBonusAktif] = useState<boolean>(true);
  const [powerUpAktif, setPowerUpAktif] = useState<boolean>(true);
  const [namaTim1, setNamaTim1] = useState<string>('Tim Merah');
  const [namaTim2, setNamaTim2] = useState<string>('Tim Biru');
  const [maxPeserta, setMaxPeserta] = useState<number>(60);
  const [batasMenang, setBatasMenang] = useState<number>(100);
  const [batasInput, setBatasInput] = useState<string>('100');

  const [questions, setQuestions] = useState<Array<{ kesulitan?: string | null }>>([]);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !templateId) return;
    let active = true;
    setLoadingDetail(true);
    apiRequest<{ template: { questions: Array<{ kesulitan?: string | null }> } }>(
      `/template/${templateId}`
    )
      .then((res) => {
        if (!active) return;
        const qs = res.template?.questions || [];
        setQuestions(qs);

        const counts: Record<KesulitanTarik, number> = { mudah: 0, sedang: 0, sulit: 0 };
        for (const q of qs) {
          const lvl = ((q.kesulitan || 'sedang').toLowerCase() as KesulitanTarik);
          if (lvl in counts) counts[lvl] += 1;
        }
        const preferred = (['sedang', 'mudah', 'sulit'] as KesulitanTarik[]).find(
          (k) => counts[k] >= 2
        );
        if (preferred) setKesulitan(preferred);
      })
      .catch(() => {
        if (active) setQuestions([]);
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, templateId]);

  const countsPerKesulitan = useMemo(() => {
    const counts: Record<KesulitanTarik, number> = { mudah: 0, sedang: 0, sulit: 0 };
    for (const q of questions) {
      const lvl = ((q.kesulitan || 'sedang').toLowerCase() as KesulitanTarik);
      if (lvl in counts) counts[lvl] += 1;
    }
    return counts;
  }, [questions]);

  const soalSetaraTerpilih = countsPerKesulitan[kesulitan];
  const cukupSoal = questions.length === 0 ? totalSoal >= 2 : soalSetaraTerpilih >= 2;
  const timValid = namaTim1.trim().length >= 2 && namaTim2.trim().length >= 2;
  const parsedBatas = Number(batasInput);
  const batasValid =
    Number.isInteger(parsedBatas) && parsedBatas >= 10 && parsedBatas <= 100;

  const pilihPresetBatas = (nilai: number) => {
    setBatasMenang(nilai);
    setBatasInput(String(nilai));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cukupSoal || !timValid || !batasValid || loading) return;
    onMulai({
      sumberSoal: 'bank_soal',
      kesulitan,
      durasiRonde,
      bonusAktif,
      powerUpAktif,
      namaTim1: namaTim1.trim() || 'Tim Merah',
      namaTim2: namaTim2.trim() || 'Tim Biru',
      maxPeserta: templateMode === 'multi' ? maxPeserta : 2,
      batasMenang: parsedBatas,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pengaturan Tarik Tambang" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Ringkasan Template & Mode Terkunci dari Template */}
        <div
          className={`p-3.5 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-2 ${
            templateMode === 'solo'
              ? 'bg-[#fde8e7]/70 border-[#d9544c] text-[#961e19]'
              : 'bg-[#eff6ff] border-[#3b82f6] text-[#1e3a8a]'
          }`}
        >
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider opacity-80">
              Paket Soal: {templateJudul} ({totalSoal} soal)
            </div>
            <div className="font-black text-sm flex items-center gap-1.5 mt-0.5">
              {templateMode === 'solo' ? (
                <>
                  <Monitor className="w-4 h-4" />
                  <span>Mode Template: Solo (Duel 1 vs 1 di Perangkat Guru)</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  <span>Mode Template: Multiplayer (Team Multiplayer via PIN &amp; QR)</span>
                </>
              )}
            </div>
          </div>
          <Sliders className="w-5 h-5 opacity-75" />
        </div>

        {/* Tingkat Kesulitan Soal Setara */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#1d3b2e] mb-1.5">
            Tingkat Kesulitan Soal Setara
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['mudah', 'sedang', 'sulit'] as KesulitanTarik[]).map((lvl) => {
              const active = kesulitan === lvl;
              const cnt = countsPerKesulitan[lvl];
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setKesulitan(lvl)}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-black transition-all ${
                    active
                      ? 'bg-[#b45309] text-white border-[#92400e]'
                      : 'bg-white text-[#1d3b2e] border-[#d6c8a4] hover:bg-[#f4ecd9]'
                  }`}
                >
                  <span>{LABEL_KESULITAN[lvl]}</span>
                  {!loadingDetail && questions.length > 0 && (
                    <span className="block text-[10px] font-bold opacity-85">({cnt} soal)</span>
                  )}
                </button>
              );
            })}
          </div>
          {!loadingDetail && !cukupSoal && (
            <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Minimal dibutuhkan 2 soal tingkat {LABEL_KESULITAN[kesulitan]} agar Tim 1 dan Tim 2
                mendapat soal berbeda.
              </span>
            </div>
          )}
        </div>

        {/* Durasi Timer per Ronde */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#1d3b2e] mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#2563eb]" />
            <span>Durasi Timer per Ronde</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([15, 20, 30] as const).map((detik) => (
              <button
                key={detik}
                type="button"
                onClick={() => setDurasiRonde(detik)}
                className={`py-2 rounded-xl border-2 text-xs font-black ${
                  durasiRonde === detik
                    ? 'bg-[#1d3b2e] text-white border-[#1d3b2e]'
                    : 'bg-white text-[#1d3b2e] border-[#d6c8a4] hover:bg-[#f4ecd9]'
                }`}
              >
                {detik} Detik
              </button>
            ))}
          </div>
        </div>

        {/* Nama Tim 1 vs Tim 2 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-extrabold text-[#c8362f] mb-1">
              Nama Tim 1 (Kiri)
            </label>
            <input
              type="text"
              maxLength={32}
              value={namaTim1}
              onChange={(e) => setNamaTim1(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white border-2 border-[#d9544c] text-xs font-bold text-[#1d3b2e]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-[#2563eb] mb-1">
              Nama Tim 2 (Kanan)
            </label>
            <input
              type="text"
              maxLength={32}
              value={namaTim2}
              onChange={(e) => setNamaTim2(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white border-2 border-[#3b82f6] text-xs font-bold text-[#1d3b2e]"
              required
            />
          </div>
        </div>

        {/* Batasan Poin Kemenangan */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#1d3b2e] mb-1.5 flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5 text-[#c8362f]" />
            <span>Batasan Menang (Target Posisi Tali)</span>
          </label>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {([
              { val: 25, ket: 'Kilat' },
              { val: 50, ket: 'Cepat' },
              { val: 75, ket: 'Sedang' },
              { val: 100, ket: 'Klasik' },
            ] as const).map((opsi) => {
              const active = batasMenang === opsi.val && parsedBatas === opsi.val;
              return (
                <button
                  key={opsi.val}
                  type="button"
                  onClick={() => pilihPresetBatas(opsi.val)}
                  className={`py-2 px-2 rounded-xl border-2 text-xs font-black transition-all ${
                    active
                      ? 'bg-[#c8362f] text-white border-[#961e19]'
                      : 'bg-white text-[#1d3b2e] border-[#d6c8a4] hover:bg-[#f4ecd9]'
                  }`}
                >
                  <span>±{opsi.val}</span>
                  <span className="block text-[10px] font-bold opacity-85">{opsi.ket}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#f4ecd9] border border-[#d6c8a4]">
            <span className="text-xs font-bold text-[#1d3b2e]">
              Atur sendiri (10–100 poin):
            </span>
            <input
              type="number"
              min={10}
              max={100}
              step={1}
              value={batasInput}
              onChange={(e) => {
                const val = e.target.value;
                setBatasInput(val);
                const num = Number(val);
                if (Number.isInteger(num) && num >= 10 && num <= 100) {
                  setBatasMenang(num);
                }
              }}
              aria-label="Batasan menang kustom"
              className="w-24 px-2.5 py-1 rounded-lg bg-white border-2 border-[#b45309] text-xs font-black text-center text-[#1d3b2e]"
            />
          </div>
          <p className="mt-1 text-[11px] font-semibold text-[#6b7d6c]">
            {batasValid
              ? `Game langsung berakhir menang jika ${namaTim1.trim() || 'Tim 1'} mencapai +${parsedBatas} atau ${namaTim2.trim() || 'Tim 2'} mencapai -${parsedBatas}.`
              : 'Masukkan bilangan bulat antara 10 sampai 100 poin.'}
          </p>
        </div>

        {/* Toggle Bonus & Power-Up */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#f4ecd9] border border-[#d6c8a4] cursor-pointer">
            <input
              type="checkbox"
              checked={bonusAktif}
              onChange={(e) => setBonusAktif(e.target.checked)}
              className="mt-0.5 accent-[#c8362f]"
            />
            <div className="text-xs">
              <div className="font-black text-[#1d3b2e] flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-[#b45309]" />
                <span>Bonus Streak{templateMode === 'multi' ? ' & Kekompakan' : ''}</span>
              </div>
              <div className="text-[11px] text-[#6b7d6c] font-semibold">
                Streak 3 (+5) / 5 (+10)
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#f4ecd9] border border-[#d6c8a4] cursor-pointer">
            <input
              type="checkbox"
              checked={powerUpAktif}
              onChange={(e) => setPowerUpAktif(e.target.checked)}
              className="mt-0.5 accent-[#2563eb]"
            />
            <div className="text-xs">
              <div className="font-black text-[#1d3b2e] flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>Sistem Power-Up</span>
              </div>
              <div className="text-[11px] text-[#6b7d6c] font-semibold">
                Semangat (+5), Tahan (-5), Super (+10)
              </div>
            </div>
          </label>
        </div>

        {/* Khusus Multiplayer: Batas Peserta */}
        {templateMode === 'multi' && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#eff6ff] border border-[#bfdbfe]">
            <div className="text-xs font-bold text-[#1e3a8a]">
              Kapasitas Maksimal Siswa di Lobi
            </div>
            <input
              type="number"
              min={2}
              max={200}
              value={maxPeserta}
              onChange={(e) =>
                setMaxPeserta(Math.max(2, Math.min(200, Number(e.target.value) || 60)))
              }
              className="w-20 px-2.5 py-1.5 rounded-lg bg-white border-2 border-[#3b82f6] text-xs font-black text-center text-[#1e3a8a]"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-[#e0d5b8]">
          <button type="button" onClick={onClose} className="portal-btn ghost sm">
            Batal
          </button>
          <button
            type="submit"
            disabled={!cukupSoal || !timValid || !batasValid || loading || loadingDetail}
            className="portal-btn red sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>
              {templateMode === 'solo' ? 'Mulai Duel 1 vs 1' : 'Buka Lobi Multiplayer'}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

