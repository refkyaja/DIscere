import { test, expect } from '../fixtures/auth';
import { getTemplateIdForGame } from '../utils/helpers';

test.describe('D. Balap Karung Gameplay', () => {
  test('harus dapat memulai game Balap Karung Solo, menjawab soal, dan menggerakkan karakter', async ({ guruPage }) => {
    const templateId = await getTemplateIdForGame(guruPage, 'balap_karung');
    await guruPage.goto(`/guru/balap-karung?templateId=${encodeURIComponent(templateId)}`);

    // Pastikan mode Solo dipilih secara eksplisit
    const soloCard = guruPage.locator('button', { hasText: 'Solo Mode' });
    await expect(soloCard).toBeVisible({ timeout: 15000 });
    await soloCard.click();

    // Verifikasi tombol submit beralih ke Solo dan submit
    const submitBtn = guruPage.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await expect(submitBtn).toHaveText(/Solo/i, { timeout: 10000 });
    await submitBtn.click();

    // Tiba di layar host arena Balap Karung Solo
    await expect(guruPage).toHaveURL(/\/guru\/sesi\//, { timeout: 15000 });

    // Mulai perlombaan
    const mulaiBtn = guruPage.locator('button:has-text("Mulai lomba")');
    await expect(mulaiBtn).toBeVisible({ timeout: 15000 });
    await mulaiBtn.click();

    // Verifikasi opsi jawaban muncul pada kartu peserta
    const opsiBtn = guruPage.locator('button.bk-opt').first();
    await expect(opsiBtn).toBeVisible({ timeout: 15000 });

    // Klik jawaban
    await opsiBtn.click();

    // Verifikasi ada indikator feedback jawaban atau progres lompatan
    await expect(
      guruPage.locator('.bk-opt.ok, .bk-opt.no, .bk-card [class*="text-[#1f9d55]"], .bk-card [class*="text-[#d63b3b]"], .bk-opt:disabled').first()
    ).toBeVisible({ timeout: 8000 });
  });
});
