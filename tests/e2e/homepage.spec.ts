import { test, expect } from '@playwright/test';

test.describe('A. Homepage Discere', () => {
  test('harus dapat membuka homepage tanpa error JavaScript kritis', async ({ page }) => {
    const errorLogs: string[] = [];
    page.on('pageerror', (err) => {
      errorLogs.push(err.message);
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/Discere/i);

    // Memastikan elemen utama tampil
    await expect(page.locator('nav .logo')).toContainText('Discere');
    await expect(page.locator('#beranda h1')).toBeVisible();
    await expect(page.locator('#tentang')).toBeVisible();
    await expect(page.locator('#fitur')).toBeVisible();
    await expect(page.locator('#template')).toBeVisible();

    // Memastikan tidak ada error JavaScript kritis saat load
    expect(errorLogs).toEqual([]);
  });

  test('harus memuat tombol navigasi dan mengarah ke halaman yang benar', async ({ page }) => {
    await page.goto('/');

    // 1. Tombol Join -> mengarah ke /join
    const joinBtn = page.locator('nav a[href="/join"]');
    await expect(joinBtn).toBeVisible();
    await joinBtn.click();
    await expect(page).toHaveURL(/\/join/);

    // Kembali ke beranda
    await page.goto('/');

    // 2. Tombol Mulai Sekarang -> mengarah ke /daftar
    const mulaiBtn = page.locator('nav .acts a[href="/daftar"]');
    await expect(mulaiBtn).toBeVisible();
    await mulaiBtn.click();
    await expect(page).toHaveURL(/\/daftar/);

    // Kembali ke beranda
    await page.goto('/');

    // 3. Link Dokumentasi di footer -> mengarah ke /dokumentasi
    const docLink = page.locator('footer a[href="/dokumentasi"]');
    await expect(docLink).toBeVisible();
    await docLink.click();
    await expect(page).toHaveURL(/\/dokumentasi/);
  });
});

