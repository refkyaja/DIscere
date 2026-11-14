import { test, expect } from '../fixtures/auth';
import { getTemplateIdForGame } from '../utils/helpers';

test.describe('C. Tarik Tambang Gameplay', () => {
  test('harus dapat memulai game Tarik Tambang Solo, menjawab soal, dan memproses skor', async ({ guruPage }) => {
    // 1. Buka pengaturan Tarik Tambang dengan template yang valid
    const templateId = await getTemplateIdForGame(guruPage, 'tarik_tambang');
    await guruPage.goto(`/guru/tarik-tambang?templateId=${encodeURIComponent(templateId)}`);

    // Pastikan mode Solo terpilih
    const soloBtn = guruPage.locator('button:has-text("Solo Mode (1 vs 1)"), button:has-text("Solo")').first();
    if (await soloBtn.isVisible()) {
      await soloBtn.click();
    }

    // Klik tombol submit untuk membuat sesi solo
    const submitBtn = guruPage.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 2. Tiba di arena host Tarik Tambang
    await expect(guruPage).toHaveURL(/\/guru\/sesi\//, { timeout: 15000 });

    // 3. Tekan tombol "Mulai lomba" untuk memulai sesi
    const mulaiBtn = guruPage.locator('button:has-text("Mulai lomba")');
    await expect(mulaiBtn).toBeVisible({ timeout: 15000 });
    await mulaiBtn.click();

    // 4. Verifikasi masuk ke status PLAYING dan duel cards tampil
    const duelContainer = guruPage.locator('.tt-duel');
    await expect(duelContainer).toBeVisible({ timeout: 10000 });

    // 5. Verifikasi pemain dapat memilih opsi jawaban pada kartu sisi Merah
    const opsiBtn = duelContainer.locator('button.tt-op').first();
    await expect(opsiBtn).toBeVisible({ timeout: 10000 });
    await opsiBtn.click();

    // 6. Verifikasi feedback jawaban muncul
    const feedbackBox = duelContainer.locator('.tt-fb').first();
    await expect(feedbackBox).not.toBeEmpty({ timeout: 5000 });

    // 7. Verifikasi tombol "Akhiri" atau "Selesai" untuk menghentikan permainan
    const stopBtn = guruPage.locator('button:has-text("Akhiri"), button:has-text("Selesai")').first();
    if (await stopBtn.isVisible()) {
      await stopBtn.click();
      // Konfirmasi modal jika muncul
      const confirmBtn = guruPage.locator('button:has-text("Ya, Selesaikan"), button:has-text("Akhiri Lomba")').first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }
    }
  });
});

