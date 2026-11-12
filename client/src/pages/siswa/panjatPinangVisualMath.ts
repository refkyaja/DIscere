export interface GeometriTiangPanjatInput {
  posisi: number;
  status?: 'bermain' | 'selesai';
  compact?: boolean;
}

export interface GeometriTiangPanjat {
  safePosisi: number;
  isPuncak: boolean;
  worldHeightPct: number;
  cameraProgress: number;
  cameraTranslateYPct: number;
  revealFromBottomPct: number;
  topClipPct: number;
  charHeightPx: number;
  bottomCalc: string;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Menghitung parameter geometri Progressive Pole Reveal, posisi karakter, dan kamera viewport.
 * Nilai posisi backend dijaga apa adanya (read-only) untuk visualisasi.
 */
export function hitungGeometriTiangPanjat({
  posisi,
  status = 'bermain',
  compact = false,
}: GeometriTiangPanjatInput): GeometriTiangPanjat {
  const safePosisi = clamp(Math.round(posisi), 0, 100);
  const isPuncak = safePosisi >= 100 || status === 'selesai';

  // Rasio tinggi dunia terhadap viewport (saat puncak, kamera menarik mundur ke 100% agar seluruh tiang tampil)
  const climbingWorldHeightPct = compact ? 190 : 230;
  const worldHeightPct = isPuncak ? 100 : climbingWorldHeightPct;

  const u = safePosisi / 100;

  // Kamera mulai menggeser ke atas setelah melewati 10% agar alas rumput 0% tetap kokoh di awal,
  // lalu mencapai bagian puncak sekitar ~88% progres.
  const cameraProgress = isPuncak ? 0 : clamp((u - 0.1) / 0.78, 0, 1);

  // Pergeseran vertikal ke bawah (+) pada kontainer dunia berjangkar bottom: 0
  // agar bagian atas tiang masuk ke dalam viewport kamera secara bertahap.
  const maxTranslatePct = (1 - 100 / climbingWorldHeightPct) * 100;
  const cameraTranslateYPct = isPuncak
    ? 0
    : Number((cameraProgress * maxTranslatePct).toFixed(3));

  // Persentase tinggi dunia (dari bawah ke atas) yang dibuka oleh clip-path.
  // 0..75%: tiang tumbuh bertahap di langit terbuka agar ilusi memanjang terasa jelas tanpa menyentuh puncak;
  // 75..90%: membuka mulus hingga 100% sehingga roda hadiah, bendera & Target 100% tampil saat mendekati atas.
  const baseReveal = compact ? 28 : 26;
  const midTargetAt75 = compact ? 82 : 80;
  let revealFromBottomPct: number;
  if (isPuncak) {
    revealFromBottomPct = 100;
  } else if (safePosisi <= 75) {
    revealFromBottomPct = baseReveal + (safePosisi / 75) * (midTargetAt75 - baseReveal);
  } else {
    revealFromBottomPct = midTargetAt75 + ((safePosisi - 75) / 15) * (100 - midTargetAt75);
  }
  revealFromBottomPct = Number(clamp(revealFromBottomPct, baseReveal, 100).toFixed(2));
  const topClipPct = Number((100 - revealFromBottomPct).toFixed(2));

  // Kalibrasi tinggi karakter dalam piksel (compact 'xs' = 46px, full 'lg' = 108px)
  const charHeightPx = compact ? 46 : 108;
  const bottomCalc = `calc(${safePosisi}% - ${((safePosisi / 100) * charHeightPx).toFixed(2)}px)`;

  return {
    safePosisi,
    isPuncak,
    worldHeightPct,
    cameraProgress,
    cameraTranslateYPct,
    revealFromBottomPct,
    topClipPct,
    charHeightPx,
    bottomCalc,
  };
}

