import { Page, expect } from '@playwright/test';

export const GURU_CREDENTIALS = {
  email: 'guru@discere.local',
  password: 'GuruDiscere2026!',
};

/**
 * Helper untuk login sebagai Guru demo di Discere
 */
export async function loginAsGuru(page: Page) {
  // Pastikan backend API sudah online dan merespons
  for (let i = 0; i < 15; i++) {
    try {
      const res = await page.request.get('/api/health');
      if (res.ok()) break;
    } catch {
      // Backend masih warm-up
    }
    await page.waitForTimeout(500);
  }

  await page.goto('/masuk');
  // Jika sesi cookie sudah ada dan auto-redirect ke dashboard guru
  if (page.url().includes('/guru')) {
    return;
  }

  await expect(page.locator('#le')).toBeVisible({ timeout: 15000 });
  await page.fill('#le', GURU_CREDENTIALS.email);
  await page.fill('#lp', GURU_CREDENTIALS.password);
  await page.click('button.b1[type="submit"]');

  // Bila terjadi delay koneksi pertama kali dan muncul alert error, coba klik lagi
  try {
    await expect(page).toHaveURL(/\/guru/, { timeout: 8000 });
  } catch {
    const submitBtn = page.locator('button.b1[type="submit"]');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    }
    await expect(page).toHaveURL(/\/guru/, { timeout: 15000 });
  }
}

/**
 * Helper untuk mendapatkan ID template kuis berdasarkan jenis game
 * Mengutamakan template yang memiliki minimal 2 soal agar tombol mulai permainan aktif
 */
export async function getTemplateIdForGame(
  page: Page,
  game: 'tarik_tambang' | 'balap_karung' | 'panjat_pinang' | 'makan_kerupuk'
): Promise<string> {
  // 1. Coba ambil dari pustaka resmi (template bawaan/seeder yang lengkap)
  try {
    const resPustaka = await page.request.get('/api/template/pustaka');
    if (resPustaka.ok()) {
      const dataPustaka = await resPustaka.json();
      const foundPustaka = dataPustaka.templates?.find(
        (t: any) => t.game === game && (t._count?.questions ?? 0) >= 2
      );
      if (foundPustaka) return foundPustaka.id;
    }
  } catch {
    // Ignore and fallback
  }

  // 2. Fallback ke daftar template milik guru yang memiliki >= 2 soal
  try {
    const res = await page.request.get('/api/template');
    if (res.ok()) {
      const data = await res.json();
      const found = data.templates?.find(
        (t: any) => t.game === game && (t._count?.questions ?? 0) >= 2
      );
      if (found) return found.id;

      // Jika tidak ada yang >= 2, ambil sembarang yang cocok
      const anyFound = data.templates?.find((t: any) => t.game === game);
      if (anyFound) return anyFound.id;
    }
  } catch {
    // Ignore and throw
  }

  throw new Error(`Tidak ditemukan template untuk game: ${game}`);
}
