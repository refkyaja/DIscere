import { test, expect } from '../fixtures/auth';
import { getTemplateIdForGame } from '../utils/helpers';

test.describe('E. Panjat Pinang Gameplay', () => {
  test('harus dapat memulai Panjat Pinang Solo, menampilkan tiang pinang, dan merespons pilihan jawaban', async ({ guruPage }) => {
    const templateId = await getTemplateIdForGame(guruPage, 'panjat_pinang');
    await guruPage.goto(`/guru/panjat-pinang?templateId=${encodeURIComponent(templateId)}`);

    // Pastikan mode Solo dipilih secara eksplisit
    const soloCard = guruPage.locator('button', { hasText: 'Solo Mode' });
    await expect(soloCard).toBeVisible({ timeout: 15000 });
    await soloCard.click();

    const submitBtn = guruPage.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await expect(submitBtn).toHaveText(/Solo/i, { timeout: 10000 });
    await submitBtn.click();

    // Tiba di arena host Panjat Pinang
    await expect(guruPage).toHaveURL(/\/guru\/sesi\//, { timeout: 15000 });

    // Mulai perlombaan 1 vs 1
    const mulaiBtn = guruPage.locator('button:has-text("Mulai Lomba 1 vs 1!")');
    await expect(mulaiBtn).toBeVisible({ timeout: 15000 });
    await mulaiBtn.click();

    // Verifikasi arena pertandingan & tiang pinang siap
    await expect(guruPage.locator('.bk-wrap, .bk-stadium, [data-panjat-pole-rod="true"]').first()).toBeVisible({ timeout: 10000 });

    // Verifikasi opsi jawaban muncul pada kartu soal
    const opsiBtn = guruPage.locator('button').filter({ has: guruPage.locator('span', { hasText: /^[A-E]$/ }) }).first();
    await expect(opsiBtn).toBeVisible({ timeout: 15000 });
    await opsiBtn.click();

    // Verifikasi ada feedback jawaban (kelas bg hijau atau merah atau disabled)
    await expect(guruPage.locator('[class*="bg-[#e9f9ef]"], [class*="bg-[#fdecec]"], [class*="border-[#1f9d55]"]').first()).toBeVisible({ timeout: 8000 });
  });
});
