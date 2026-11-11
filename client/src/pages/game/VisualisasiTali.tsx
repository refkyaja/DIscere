import React from 'react';
import { Flag, Users } from 'lucide-react';
import KarakterTarikTambang, { EkspresiTarikTambang } from '../siswa/KarakterTarikTambang';

interface VisualisasiTaliProps {
  posisi: number; // -8 hingga +8
  skorMerah?: number;
  skorPutih?: number;
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
}

export const VisualisasiTali: React.FC<VisualisasiTaliProps> = ({
  posisi,
  skorMerah = 0,
  skorPutih = 0,
  timAktif,
  theme = 'chalk',
  reaksiTim,
  pemenang = null,
  jumlahPemainMerah,
  jumlahPemainPutih,
}) => {
  const isChalk = theme === 'chalk';
  // Batasi posisi dalam rentang [-8, 8]
  const clampedPosisi = Math.max(-8, Math.min(8, posisi));

  // Hitung persentase posisi pita penanda (0% = -8, 50% = 0, 100% = +8)
  const persentase = ((clampedPosisi + 8) / 16) * 100;
  // Pergeseran fisik tim kiri-kanan seirama dengan tarikan tali
  const shiftPx = Math.round((clampedPosisi / 8) * 26);

  const skala = [-8, -6, -4, -2, 0, 2, 4, 6, 8];

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
    : clampedPosisi <= -3
    ? 'bahagia'
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
    : clampedPosisi >= 3
    ? 'bahagia'
    : 'netral';

  const poseArena = pemenang ? 'podium' : 'tarik';

  return (
    <div
      className={`w-full rounded-3xl p-5 sm:p-7 transition-all ${
        isChalk
          ? 'bg-[#fbf6e9] text-[#1d3b2e] border-2 border-[#e0d5b8] shadow-[0_6px_0_rgba(0,0,0,0.18)]'
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm'
      }`}
    >
      {/* Header Tim Merah vs Tengah vs Tim Putih */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        {/* Tim Merah */}
        <div
          className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl transition-all duration-300 ${
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
              <span className="font-black text-base sm:text-lg text-[#c8362f]">Tim Merah</span>
              {timAktif === 'merah' && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#c8362f] text-white font-bold animate-pulse">
                  Giliran
                </span>
              )}
            </div>
            <div className={`text-xs flex items-center gap-2 ${isChalk ? 'text-[#6b7d6c]' : 'text-slate-500 dark:text-slate-400'}`}>
              <span>
                Skor:{' '}
                <span className={`font-extrabold ${isChalk ? 'text-[#1d3b2e]' : 'text-slate-800 dark:text-slate-100'}`}>
                  {skorMerah} Benar
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

        {/* Indikator Posisi Tengah */}
        <div className="text-center mx-auto sm:mx-0">
          <div className={`text-[11px] font-bold uppercase tracking-wider mb-0.5 ${isChalk ? 'text-[#6b7d6c]' : 'text-slate-400'}`}>
            Posisi Tali
          </div>
          <div className={`text-xl sm:text-3xl font-black ${isChalk ? 'text-[#1d3b2e]' : 'text-slate-800 dark:text-slate-100'}`}>
            {clampedPosisi === 0 ? (
              <span className={isChalk ? 'text-[#b45309]' : 'text-amber-500'}>Netral (0)</span>
            ) : clampedPosisi < 0 ? (
              <span className="text-[#c8362f]">
                Merah {Math.abs(clampedPosisi)} langkah
              </span>
            ) : (
              <span className={isChalk ? 'text-[#1f4a6b]' : 'text-[#1E2A5A] dark:text-blue-300'}>
                Putih +{clampedPosisi} langkah
              </span>
            )}
          </div>
        </div>

        {/* Tim Putih */}
        <div
          className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl transition-all duration-300 ${
            isChalk
              ? timAktif === 'putih'
                ? 'bg-[#e3eef9] border-2 border-[#1f4a6b] shadow-md scale-[1.02]'
                : 'bg-[#edf4fb] border-2 border-[#2b6cb0]/70'
              : timAktif === 'putih'
              ? 'bg-blue-50 dark:bg-blue-950/40 border-2 border-[#1E2A5A] shadow-md scale-105'
              : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <div className="text-right">
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {timAktif === 'putih' && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#1f4a6b] text-white font-bold animate-pulse">
                  Giliran
                </span>
              )}
              <span className={`font-black text-base sm:text-lg ${isChalk ? 'text-[#1f4a6b]' : 'text-[#1E2A5A] dark:text-blue-300'}`}>
                Tim Putih
              </span>
            </div>
            <div className={`text-xs flex items-center justify-end gap-2 ${isChalk ? 'text-[#6b7d6c]' : 'text-slate-500 dark:text-slate-400'}`}>
              {jumlahPemainPutih !== undefined && (
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Users className="w-3 h-3" /> {jumlahPemainPutih} •
                </span>
              )}
              <span>
                Skor:{' '}
                <span className={`font-extrabold ${isChalk ? 'text-[#1d3b2e]' : 'text-slate-800 dark:text-slate-100'}`}>
                  {skorPutih} Benar
                </span>
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white border border-[#2b6cb0]/50 flex items-center justify-center shrink-0 overflow-hidden">
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
          <span className="text-[#c8362f]">🏁 Wilayah Merah (-8)</span>
          <span className={isChalk ? 'text-[#1d3b2e]' : 'text-slate-300'}>Garis Netral (0)</span>
          <span className={isChalk ? 'text-[#1f4a6b]' : 'text-blue-400'}>Wilayah Putih (+8) 🏁</span>
        </div>

        {/* Visualisasi Karakter Tim Merah & Tim Putih Memegang Tambang */}
        <div className="relative h-28 sm:h-32 w-full flex items-end justify-between">
          {/* Garis Tengah Lapangan */}
          <div className="absolute left-1/2 top-2 bottom-3 w-0.5 border-l-2 border-dashed border-[#b45309]/50 -translate-x-1/2 pointer-events-none z-0" />

          {/* Zona Tanah Rumput Bawah */}
          <div
            className={`absolute left-0 right-0 bottom-0 h-5 rounded-b-xl pointer-events-none ${
              isChalk ? 'bg-[#6d9a4a]/25 border-t border-[#6d9a4a]/30' : 'bg-emerald-900/40'
            }`}
          />

          {/* Track Tambang Panjang (membentang di ketinggian genggaman tangan karakter) */}
          {!pemenang && (
            <div className="absolute left-4 right-4 bottom-[34px] sm:bottom-[40px] h-3 flex items-center pointer-events-none z-10">
              <div className="w-full h-3 rounded-full border border-[#78350f]/60 overflow-hidden shadow-sm bg-[#b45309]">
                <div className="w-full h-full opacity-85 bg-[repeating-linear-gradient(55deg,#d97706,#d97706_8px,#92400e_8px,#92400e_16px)]" />
              </div>
            </div>
          )}

          {/* Bendera / Pita Merah-Putih Penanda Posisi Tali (-8 .. +8) */}
          <div
            className="absolute bottom-[18px] sm:bottom-[24px] z-30 transition-all duration-700 ease-out flex flex-col items-center pointer-events-none -translate-x-1/2"
            style={{ left: `${persentase}%` }}
          >
            <div className="w-8 h-8 rounded-full bg-white border-2 border-[#c8362f] shadow-md flex items-center justify-center">
              <Flag className="w-4 h-4 text-[#c8362f] fill-[#c8362f]" />
            </div>
            <div className="w-1 h-4 bg-[#c8362f] -mt-0.5 rounded-b" />
          </div>

          {/* Pasukan Karakter 2D (Tim Merah kiri vs Tim Putih kanan) bergerak bersama tambang */}
          <div
            className="relative z-20 w-full flex items-end justify-between px-1 sm:px-4 pb-1 transition-transform duration-700 ease-out"
            style={{ transform: `translateX(${shiftPx}px)` }}
          >
            {/* Kelompok Tim Merah (Kiri) */}
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

            {/* Kelompok Tim Putih (Kanan) */}
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

      {/* Skala Angka -8 sampai +8 (sejajar 1:1 dengan posisi Flag pita) */}
      <div className="relative pt-3 px-1">
        <div className="relative h-2 rounded-full bg-[#e0d5b8]/70 overflow-visible mb-2">
          <div className="absolute left-1/2 -top-1 bottom-[-4px] w-0.5 bg-[#d97706] -translate-x-1/2" />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#c8362f] border-2 border-white shadow transition-all duration-700 ease-out"
            style={{ left: `${persentase}%` }}
          />
        </div>

        <div className={`relative w-full flex justify-between text-xs font-semibold ${isChalk ? 'text-[#6b7d6c]' : 'text-slate-400'}`}>
          {skala.map((val) => {
            const isZero = val === 0;
            const isMerah = val < 0;
            const isCurrent = val === clampedPosisi;
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
                        (isMerah ? 'text-[#c8362f]' : isZero ? 'text-[#b45309]' : isChalk ? 'text-[#1f4a6b]' : 'text-blue-300')
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
