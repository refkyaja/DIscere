import { test, expect } from '@playwright/test';
import { loginAsGuru } from '../utils/helpers';

const VIEWPORTS = [
  { name: 'Desktop', width: 1280, height: 720 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 375, height: 667 },
];

test.describe('UI/UX Responsive & Viewport Compatibility', () => {
  for (const vp of VIEWPORTS) {
    test(`Homepage di ${vp.name} (${vp.width}x${vp.height}) harus tampil proporsional tanpa blank screen`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Verifikasi halaman render konten dan tidak blank
      await expect(page.locator('body')).not.toBeEmpty();
      await expect(page.locator('#beranda')).toBeVisible();

      // Cek tombol utama dapat diklik
      const ctaBtn = page.locator('a[href="/join"], a[href="/daftar"]').first();
      await expect(ctaBtn).toBeVisible();

      expect(pageErrors).toEqual([]);
    });

    test(`Halaman Join Siswa di ${vp.name} (${vp.width}x${vp.height}) harus responsif dan form dapat diakses`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/join');

      await expect(page.locator('body')).not.toBeEmpty();
      // Form input PIN atau nama harus tampil
      const inputEl = page.locator('input').first();
      await expect(inputEl).toBeVisible();
    });
  }

  test('Dashboard Guru pada Mobile Viewport (375x667) harus tetap dapat diakses', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAsGuru(page);

    await expect(page).toHaveURL(/\/guru/);
    await expect(page.locator('body')).not.toBeEmpty();

    // Verifikasi elemen dashboard muncul
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

