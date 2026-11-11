import React from 'react';
import { Flame, Flag, Users } from 'lucide-react';
import KarakterTarikTambang, { EkspresiTarikTambang } from '../siswa/KarakterTarikTambang';

interface VisualisasiTaliProps {
  posisi: number; // -batasMenang hingga +batasMenang (+ = Tim 1 Merah Kiri, - = Tim 2 Biru Kanan)
  batasMenang?: number;
  skorMerah?: number;
  skorPutih?: number;
  namaTim1?: string;
  namaTim2?: string;
  timAktif?: 'merah' | 'putih';
  ukuran?: 'normal' | 'besar';
  theme?: 'dark' | 'chalk';
  reaksiTim?: {
    merah?: EkspresiTarikTambang;
    putih?: EkspresiTarikTambang;
  };
  pemenang?: 'merah' | 'putih' | 'seri' | null;
  jumlahPemainMerah?: number;
  jumlahPemainPutih?: number;
  streakTim1?: number;
  streakTim2?: number;
  powerUpTim1Aktif?: string | null;
  powerUpTim2Aktif?: string | null;
}

const LABEL_POWERUP: Record<string, string> = {
  semangat_tim: 'Semangat +5',
  pertahanan_kuat: 'Tahan -5',
  tarikan_super: 'Super +10',
};

export const VisualisasiTali: React.FC<VisualisasiTaliProps> = ({
  posisi,
  batasMenang = 100,
  skorMerah = 0,
  skorPutih = 0,
  namaTim1 = 'Tim Merah',
  namaTim2 = 'Tim Biru',
  timAktif,
  theme = 'chalk',
  reaksiTim,
  pemenang = null,
  jumlahPemainMerah,
  jumlahPemainPutih,
  streakTim1,
  streakTim2,
  powerUpTim1Aktif,
  powerUpTim2Aktif,
}) => {
  const isChalk = theme === 'chalk';
  const batas = Math.max(10, Math.min(100, Math.round(batasMenang || 100)));
  // Batasi posisi dalam rentang [-batas, +batas]
  const clampedPosisi = Math.max(-batas, Math.min(batas, Math.round(posisi)));

  // Kiri (+batas Tim 1 Merah) -> 0%, Tengah (0) -> 50%, Kanan (-batas Tim 2 Biru) -> 100%
  const persentase = ((batas - clampedPosisi) / (batas * 2)) * 100;
  // Pergeseran fisik karakter seirama dengan tarikan: + geser kiri, - geser kanan
  const shiftPx = Math.round((-clampedPosisi / batas) * 28);

  let skala: number[];
  if (batas === 100) {
    skala = [100, 75, 50, 25, 0, -25, -50, -75, -100];
  } else if (batas === 75) {
    skala = [75, 50, 25, 0, -25, -50, -75];
  } else if (batas === 50) {
    skala = [50, 25, 0, -25, -50];
  } else if (batas % 4 === 0) {
    const q1 = batas / 4;
    skala = [batas, batas - q1, q1 * 2, q1, 0, -q1, -(q1 * 2), -(batas - q1), -batas];
  } else {
    const half = Math.round(batas / 2);
    skala = [batas, half, 0, -half, -batas];
  }

  const stepSkala = skala.length >= 2 ? Math.abs(skala[0] - skala[1]) : batas;
  const isCurrentTolerance = Math.max(2, Math.ceil(stepSkala * 0.5));
  const thresholdBahagia = Math.max(5, Math.round(batas * 0.2));
  const thresholdSedih = Math.max(5, Math.round(batas * 0.25));

  const ekspresiMerah: EkspresiTarikTambang = pemenang
    ? pemenang === 'merah'
      ? 'menang'
      : pemenang === 'seri'
      ? 'bahagia'
      : 'kalah'
    : reaksiTim?.merah
    ? reaksiTim.merah
    : timAktif === 'merah'
    ? 'semangat'
    : clampedPosisi >= thresholdBahagia
    ? 'bahagia'
    : clampedPosisi <= -thresholdSedih
    ? 'sedih'
    : 'netral';

  const ekspresiPutih: EkspresiTarikTambang = pemenang
    ? pemenang === 'putih'
      ? 'menang'
      : pemenang === 'seri'
      ? 'bahagia'
      : 'kalah'
    : reaksiTim?.putih
    ? reaksiTim.putih
    : timAktif === 'putih'
    ? 'semangat'
    : clampedPosisi <= -thresholdBahagia
    ? 'bahagia'
    : clampedPosisi >= thresholdSedih
    ? 'sedih'
    : 'netral';

  const poseArena = pemenang ? 'podium' : 'tarik';

  return (
    <div
      className={`w-full rounded-3xl p-4 sm:p-6 transition-all ${
        isChalk
          ? 'bg-[#fbf6e9] text-[#1d3b2e] border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)]'
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm'
      }`}
    >
      {/* Header Tim 1 Merah (Kiri) vs Tengah vs Tim 2 Biru (Kanan) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 mb-4">
        {/* Tim 1 (Merah - Kiri) */}
        <div
          className={`order-1 flex-1 sm:flex-initial min-w-0 flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3.5 rounded-2xl transition-all duration-300 ${
            isChalk
              ? timAktif === 'merah'
                ? 'bg-[#fde8e7] border-2 border-[#c8362f] shadow-md scale-[1.02]'
                : 'bg-[#fbf0ee] border-2 border-[#d9544c]/70'
              : timAktif === 'merah'
              ? 'bg-red-50 dark:bg-red-950/40 border-2 border-[#D7262E] shadow-md scale-105'
              : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-[#f4ecd9] border border-[#d9544c]/50 flex items-center justify-center shrink-0 overflow-hidden">
            <KarakterTarikTambang
              tim="merah"
              pose="siap"
              ekspresi={ekspresiMerah}
              podiumRank={pemenang === 'merah' ? 1 : undefined}
              size="xs"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-black text-base sm:text-lg text-[#c8362f]">{namaTim1}</span>
              {streakTim1 !== undefined && streakTim1 > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                  <Flame className="w-3 h-3" /> {streakTim1}
                </span>
              )}
              {powerUpTim1Aktif && (
                <span className="inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full bg-[#c8362f] text-white font-bold">
                  {LABEL_POWERUP[powerUpTim1Aktif] || powerUpTim1Aktif}
                </span>
              )}
            </div>
            <div className={`text-xs flex items-center gap-2 ${isChalk ? 'text-[#6b7d6c]' : 'text-slate-500 dark:text-slate-400'}`}>
              <span>
                Benar:{' '}
                <span className={`font-extrabold ${isChalk ? 'text-[#1d3b2e]' : 'text-slate-800 dark:text-slate-100'}`}>
                  {skorMerah}
                </span>
              </span>
              {jumlahPemainMerah !== undefined && (
                <span className="inline-flex items-center gap-1 font-semibold">
                  • <Users className="w-3 h-3" /> {jumlahPemainMerah}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Indikator Posisi Tengah [-batas .. +batas] */}
        <div className="order-3 w-full sm:w-auto sm:order-2 text-center mx-auto sm:mx-0">
          <div className={`text-[11px] font-bold uppercase tracking-wider mb-0.5 ${isChalk ? 'text-[#6b7d6c]' : 'text-slate-400'}`}>
            Posisi Tali (Skala -{batas}..+{batas})
          </div>
          <div className={`text-xl sm:text-3xl font-black ${isChalk ? 'text-[#1d3b2e]' : 'text-slate-800 dark:text-slate-100'}`}>
            {clampedPosisi === 0 ? (
              <span className={isChalk ? 'text-[#b45309]' : 'text-amber-500'}>Seimbang (0)</span>
            ) : clampedPosisi > 0 ? (
              <span className="text-[#c8362f]">
                {namaTim1} +{clampedPosisi}
              </span>
            ) : (
              <span className="text-[#2563eb]">
                {namaTim2} {clampedPosisi}
              </span>
            )}
          </div>
        </div>

        {/* Tim 2 (Biru - Kanan) */}
        <div
          className={`order-2 sm:order-3 flex-1 sm:flex-initial min-w-0 justify-end flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3.5 rounded-2xl transition-all duration-300 ${
            isChalk
              ? timAktif === 'putih'
                ? 'bg-[#dbeafe] border-2 border-[#2563eb] shadow-md scale-[1.02]'
                : 'bg-[#eff6ff] border-2 border-[#3b82f6]/70'
              : timAktif === 'putih'
              ? 'bg-blue-50 dark:bg-blue-950/40 border-2 border-[#2563eb] shadow-md scale-105'
              : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <div className="text-right">
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {powerUpTim2Aktif && (
                <span className="inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full bg-[#2563eb] text-white font-bold">
                  {LABEL_POWERUP[powerUpTim2Aktif] || powerUpTim2Aktif}
                </span>
              )}
              {streakTim2 !== undefined && streakTim2 > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                  <Flame className="w-3 h-3" /> {streakTim2}
                </span>
              )}
              <span className="font-black text-base sm:text-lg text-[#2563eb]">{namaTim2}</span>
            </div>
            <div className={`text-xs flex items-center justify-end gap-2 ${isChalk ? 'text-[#6b7d6c]' : 'text-slate-500 dark:text-slate-400'}`}>
              {jumlahPemainPutih !== undefined && (
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Users className="w-3 h-3" /> {jumlahPemainPutih} •
                </span>
              )}
              <span>
                Benar:{' '}
                <span className={`font-extrabold ${isChalk ? 'text-[#1d3b2e]' : 'text-slate-800 dark:text-slate-100'}`}>
                  {skorPutih}
                </span>
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white border border-[#3b82f6]/50 flex items-center justify-center shrink-0 overflow-hidden">
            <KarakterTarikTambang
              tim="putih"
              pose="siap"
              ekspresi={ekspresiPutih}
              podiumRank={pemenang === 'putih' ? 1 : undefined}
              size="xs"
            />
          </div>
        </div>
      </div>

      {/* Panggung Lapangan Lomba Tarik Tambang 2D */}
      <div
        className={`relative rounded-2xl border-2 overflow-hidden pt-3 pb-2 px-3 sm:px-5 ${
          isChalk
            ? 'bg-gradient-to-b from-[#edf6e2] via-[#f7f5e8] to-[#dfe9cd] border-[#d3c7a7]'
            : 'bg-gradient-to-b from-slate-800 via-slate-900 to-emerald-950/60 border-slate-700'
        }`}
      >
        {/* Label Batas Wilayah Kemenangan */}
        <div className={`flex justify-between text-[11px] sm:text-xs font-extrabold mb-1 ${isChalk ? 'text-[#6b7d6c]' : 'text-slate-400'}`}>
          <span className="text-[#c8362f]">Menang {namaTim1} (+{batas})</span>
          <span className={isChalk ? 'text-[#1d3b2e]' : 'text-slate-300'}>Tengah (0)</span>
          <span className="text-[#2563eb]">Menang {namaTim2} (-{batas})</span>
        </div>

        {/* Visualisasi Karakter Tim 1 Merah (Kiri) & Tim 2 Biru (Kanan) */}
        <div className="relative h-28 sm:h-32 w-full flex items-end justify-between">
          {/* Garis Tengah Lapangan */}
          <div className="absolute left-1/2 top-2 bottom-3 w-0.5 border-l-2 border-dashed border-[#b45309]/50 -translate-x-1/2 pointer-events-none z-0" />

          {/* Zona Tanah Rumput Bawah */}
          <div
            className={`absolute left-0 right-0 bottom-0 h-5 rounded-b-xl pointer-events-none ${
              isChalk ? 'bg-[#6d9a4a]/25 border-t border-[#6d9a4a]/30' : 'bg-emerald-900/40'
            }`}
          />

          {/* Track Tambang Panjang */}
          {!pemenang && (
            <div className="absolute left-4 right-4 bottom-[34px] sm:bottom-[40px] h-3 flex items-center pointer-events-none z-10">
              <div className="w-full h-3 rounded-full border border-[#78350f]/60 overflow-hidden shadow-sm bg-[#b45309]">
                <div className="w-full h-full opacity-85 bg-[repeating-linear-gradient(55deg,#d97706,#d97706_8px,#92400e_8px,#92400e_16px)]" />
              </div>
            </div>
          )}

          {/* Bendera Penanda Posisi Tali [-100 .. +100] */}
          <div
            className="absolute bottom-[18px] sm:bottom-[24px] z-30 transition-all duration-700 ease-out flex flex-col items-center pointer-events-none -translate-x-1/2"
            style={{ left: `${persentase}%` }}
          >
            <div className="w-8 h-8 rounded-full bg-white border-2 border-[#c8362f] shadow-md flex items-center justify-center">
              <Flag className="w-4 h-4 text-[#c8362f] fill-[#c8362f]" />
            </div>
            <div className="w-1 h-4 bg-[#c8362f] -mt-0.5 rounded-b" />
          </div>

          {/* Pasukan Karakter 2D bergerak bersama tambang */}
          <div
            className="relative z-20 w-full flex items-end justify-between px-1 sm:px-4 pb-1 transition-transform duration-700 ease-out"
            style={{ transform: `translateX(${shiftPx}px)` }}
          >
            {/* Kelompok Tim 1 Merah (Kiri) */}
            <div className="flex items-end -space-x-4 sm:-space-x-3">
              <div className="hidden md:block">
                <KarakterTarikTambang
                  tim="merah"
                  pose={poseArena}
                  ekspresi={ekspresiMerah}
                  varian={2}
                  podiumRank={pemenang === 'merah' ? 1 : pemenang === 'putih' ? 2 : undefined}
                  size="sm"
                />
              </div>
              <KarakterTarikTambang
                tim="merah"
                pose={poseArena}
                ekspresi={ekspresiMerah}
                varian={1}
                podiumRank={pemenang === 'merah' ? 1 : pemenang === 'putih' ? 2 : undefined}
                size="sm"
              />
              <KarakterTarikTambang
                tim="merah"
                pose={poseArena}
                ekspresi={ekspresiMerah}
                varian={0}
                podiumRank={pemenang === 'merah' ? 1 : pemenang === 'putih' ? 2 : undefined}
                size="sm"
              />
            </div>

            {/* Kelompok Tim 2 Biru (Kanan) */}
            <div className="flex items-end -space-x-4 sm:-space-x-3">
              <KarakterTarikTambang
                tim="putih"
                pose={poseArena}
                ekspresi={ekspresiPutih}
                varian={0}
                podiumRank={pemenang === 'putih' ? 1 : pemenang === 'merah' ? 2 : undefined}
                size="sm"
              />
              <KarakterTarikTambang
                tim="putih"
                pose={poseArena}
                ekspresi={ekspresiPutih}
                varian={1}
                podiumRank={pemenang === 'putih' ? 1 : pemenang === 'merah' ? 2 : undefined}
                size="sm"
              />
              <div className="hidden md:block">
                <KarakterTarikTambang
                  tim="putih"
                  pose={poseArena}
                  ekspresi={ekspresiPutih}
                  varian={2}
                  podiumRank={pemenang === 'putih' ? 1 : pemenang === 'merah' ? 2 : undefined}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Skala Angka +100 (Kiri / Merah) sampai -100 (Kanan / Biru) */}
      <div className="relative pt-3 px-1">
        <div className="relative h-2.5 rounded-full bg-[#e0d5b8]/70 overflow-visible mb-2">
          <div className="absolute left-1/2 -top-1 bottom-[-4px] w-0.5 bg-[#d97706] -translate-x-1/2" />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#c8362f] border-2 border-white shadow transition-all duration-700 ease-out"
            style={{ left: `${persentase}%` }}
          />
        </div>

        <div className={`relative w-full flex justify-between text-xs font-semibold ${isChalk ? 'text-[#6b7d6c]' : 'text-slate-400'}`}>
          {skala.map((val) => {
            const isZero = val === 0;
            const isMerah = val > 0;
            const isCurrent =
              val === clampedPosisi ||
              (val !== 0 &&
                Math.abs(val - clampedPosisi) < isCurrentTolerance &&
                Math.sign(val) === Math.sign(clampedPosisi));
            return (
              <div key={val} className="flex flex-col items-center">
                <div
                  className={`w-0.5 h-2 mb-1 ${
                    isZero
                      ? 'bg-[#d97706] h-3 w-1'
                      : isCurrent
                      ? 'bg-[#c8362f] h-3 w-1'
                      : isChalk
                      ? 'bg-[#d5c8a8]'
                      : 'bg-slate-600'
                  }`}
                />
                <span
                  className={`${
                    isCurrent
                      ? 'font-extrabold text-sm ' +
                        (isMerah ? 'text-[#c8362f]' : isZero ? 'text-[#b45309]' : 'text-[#2563eb]')
                      : isZero
                      ? isChalk
                        ? 'text-[#1d3b2e] font-bold'
                        : 'text-slate-200 font-bold'
                      : isChalk
                      ? 'text-[#6b7d6c]'
                      : 'text-slate-400'
                  }`}
                >
                  {val > 0 ? `+${val}` : val}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
