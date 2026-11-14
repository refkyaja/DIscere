import { test, expect } from '../fixtures/auth';
import { getTemplateIdForGame } from '../utils/helpers';

test.describe('F. Makan Kerupuk Gameplay', () => {
  test('harus dapat memulai game Makan Kerupuk Solo, menampilkan kerupuk, dan menjawab soal', async ({ guruPage }) => {
    const templateId = await getTemplateIdForGame(guruPage, 'makan_kerupuk');
    await guruPage.goto(`/guru/makan-kerupuk?templateId=${encodeURIComponent(templateId)}`);

    // Pastikan mode Solo dipilih secara eksplisit
    const soloCard = guruPage.locator('button', { hasText: 'Solo Mode' });
    await expect(soloCard).toBeVisible({ timeout: 15000 });
    await soloCard.click();

    const submitBtn = guruPage.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await expect(submitBtn).toHaveText(/Solo/i, { timeout: 10000 });
    await submitBtn.click();

    // Tiba di arena host Makan Kerupuk
    await expect(guruPage).toHaveURL(/\/guru\/sesi\//, { timeout: 15000 });

    // Mulai lomba
    const mulaiBtn = guruPage.locator('button:has-text("Mulai Lomba Sekarang")');
    await expect(mulaiBtn).toBeVisible({ timeout: 15000 });
    await mulaiBtn.click();

    // Verifikasi opsi jawaban kerupuk muncul (button.kp-op)
    const opsiBtn = guruPage.locator('button.kp-op').first();
    await expect(opsiBtn).toBeVisible({ timeout: 15000 });

    // Klik opsi jawaban
    await opsiBtn.click();

    // Verifikasi hasil respons / feedback jawaban
    await expect(guruPage.locator('button.kp-op.ok, button.kp-op.no, button.kp-op[class*="border"]').first()).toBeVisible({ timeout: 8000 });
  });
});
