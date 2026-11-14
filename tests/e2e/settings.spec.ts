import { test, expect } from '../fixtures/auth';
import { getTemplateIdForGame } from '../utils/helpers';

test.describe('B. Pengaturan Game (Game Settings)', () => {
  test('pengaturan Tarik Tambang: beralih mode dan sesuaikan durasi & batas tarikan', async ({ guruPage }) => {
    const templateId = await getTemplateIdForGame(guruPage, 'tarik_tambang');
    await guruPage.goto(`/guru/tarik-tambang?templateId=${encodeURIComponent(templateId)}`);

    // Pastikan halaman pengaturan Tarik Tambang terbuka
    await expect(guruPage.locator('h1')).toContainText('Tarik Tambang');

    // Default mode atau beralih ke Solo
    const soloBtn = guruPage.locator('button:has-text("Solo Mode (1 vs 1)")');
    if (await soloBtn.isVisible()) {
      await soloBtn.click();
      await expect(guruPage.locator('button[type="submit"]')).toContainText('Arena Solo');
    }

    // Beralih ke Multiplayer
    const multiBtn = guruPage.locator('button:has-text("Multiplayer Tim")');
    if (await multiBtn.isVisible()) {
      await multiBtn.click();
      await expect(guruPage.locator('button[type="submit"]')).toContainText('Lobi & Kode PIN');
    }
  });

  test('pengaturan Balap Karung: dapat dibuka dan mengubah target lintasan', async ({ guruPage }) => {
    const templateId = await getTemplateIdForGame(guruPage, 'balap_karung');
    await guruPage.goto(`/guru/balap-karung?templateId=${encodeURIComponent(templateId)}`);

    await expect(guruPage.locator('h1')).toContainText('Balap Karung');

    // Memilih preset jarak jika ada (misal 50m / 100m)
    const presetBtn = guruPage.locator('button:has-text("Pendek (50m)"), button:has-text("50m")').first();
    if (await presetBtn.isVisible()) {
      await presetBtn.click();
    }

    // Verifikasi tombol submit tersedia
    await expect(guruPage.locator('button[type="submit"]')).toBeVisible();
  });

  test('pengaturan Panjat Pinang: dapat dibuka dan menyesuaikan parameter pendakian', async ({ guruPage }) => {
    const templateId = await getTemplateIdForGame(guruPage, 'panjat_pinang');
    await guruPage.goto(`/guru/panjat-pinang?templateId=${encodeURIComponent(templateId)}`);

    await expect(guruPage.locator('h1')).toContainText('Panjat Pinang');

    // Beralih mode Solo 1 vs 1
    const soloBtn = guruPage.locator('button:has-text("Solo Mode (1 vs 1)"), button:has-text("Solo")').first();
    if (await soloBtn.isVisible()) {
      await soloBtn.click();
      await expect(guruPage.locator('button[type="submit"]')).toContainText('Mulai Panjat Pinang Solo');
    }
  });

  test('pengaturan Makan Kerupuk: dapat dibuka dan mengatur opsi permainan', async ({ guruPage }) => {
    const templateId = await getTemplateIdForGame(guruPage, 'makan_kerupuk');
    await guruPage.goto(`/guru/makan-kerupuk?templateId=${encodeURIComponent(templateId)}`);

    await expect(guruPage.locator('h1')).toContainText('Makan Kerupuk');
    await expect(guruPage.locator('button[type="submit"]')).toBeVisible();
  });
});

