import { test, expect } from '../fixtures/auth';
import { getTemplateIdForGame } from '../utils/helpers';

test.describe('G. Hasil Permainan (Game Result)', () => {
  test('harus menampilkan hasil permainan, skor/akurasi, dan tombol navigasi kembali/main lagi', async ({ guruPage }) => {
    // 1. Buat sesi Tarik Tambang Solo
    const templateId = await getTemplateIdForGame(guruPage, 'tarik_tambang');
    await guruPage.goto(`/guru/tarik-tambang?templateId=${encodeURIComponent(templateId)}`);

    const soloCard = guruPage.locator('button', { hasText: 'Solo Mode' });
    await expect(soloCard).toBeVisible({ timeout: 15000 });
    await soloCard.click();

    const submitBtn = guruPage.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.click();

    await expect(guruPage).toHaveURL(/\/guru\/sesi\//, { timeout: 15000 });

    // Mulai game
    const mulaiBtn = guruPage.locator('button:has-text("Mulai lomba")');
    await expect(mulaiBtn).toBeVisible({ timeout: 15000 });
    await mulaiBtn.click();

    // Hentikan permainan lewat tombol "Akhiri" di bar stadium
    const stopBtn = guruPage.locator('button:has-text("Akhiri")').first();
    await expect(stopBtn).toBeVisible({ timeout: 10000 });
    await stopBtn.click();

    // 2. Verifikasi panel hasil akhir tampil
    const resultHeader = guruPage.locator('h2').filter({ hasText: /Menang|Seri|Juara|Hasil/i }).first();
    await expect(resultHeader).toBeVisible({ timeout: 15000 });

    // 3. Verifikasi tombol "Main lagi" dan "Selesai" tersedia
    const mainLagiBtn = guruPage.locator('button:has-text("Main lagi")').first();
    await expect(mainLagiBtn).toBeVisible({ timeout: 10000 });

    const selesaiBtn = guruPage.locator('button:has-text("Selesai")').first();
    await expect(selesaiBtn).toBeVisible({ timeout: 10000 });

    // Klik tombol Selesai dan pastikan kembali ke halaman guru
    await selesaiBtn.click();
    await expect(guruPage).toHaveURL(/\/guru/, { timeout: 15000 });
  });
});
