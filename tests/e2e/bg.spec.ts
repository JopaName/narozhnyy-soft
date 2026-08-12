import { expect, test } from '@playwright/test';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('Фон крыши (фото)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
  });

  test('загрузка фото включает фон', async ({ page }) => {
    await page.locator('#fileBg').setInputFiles({
      name: 'roof.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    });
    await page.waitForTimeout(1200);

    const s = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { bg: { visible: boolean; opacity: number } } }).__appState;
      return { visible: st.bg.visible, opacity: st.bg.opacity };
    });
    expect(s.visible).toBe(true);
    expect(s.opacity).toBeCloseTo(0.5, 1);

    /* чекбокс синхронизирован */
    await expect(page.locator('#chkBg')).toBeChecked();
  });

  test('прозрачность меняется слайдером', async ({ page }) => {
    await page.locator('#fileBg').setInputFiles({ name: 'r.png', mimeType: 'image/png', buffer: PNG_1PX });
    await page.waitForTimeout(600);

    await page.locator('#rngBgOpacity').fill('80');
    await page.waitForTimeout(300);

    const opacity = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { bg: { opacity: number } } }).__appState;
      return st.bg.opacity;
    });
    expect(opacity).toBeCloseTo(0.8, 1);
  });

  test('калибровка по двум точкам', async ({ page }) => {
    await page.locator('#fileBg').setInputFiles({ name: 'r.png', mimeType: 'image/png', buffer: PNG_1PX });
    await page.waitForTimeout(600);

    page.on('dialog', (d) => d.accept('6'));
    await page.locator('#btnBgCal').click();

    const box = await page.locator('#cv').boundingBox();
    const x1 = box!.x + box!.width * 0.4;
    const x2 = box!.x + box!.width * 0.6;
    const y = box!.y + box!.height * 0.5;

    await page.mouse.click(x1, y);
    await page.mouse.click(x2, y);
    await page.waitForTimeout(600);

    const calibS = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { bg: { calibS: number } } }).__appState;
      return st.bg.calibS;
    });
    expect(calibS).toBeGreaterThan(0);
  });

  test('скрытие чекбоксом и удаление фона', async ({ page }) => {
    await page.locator('#fileBg').setInputFiles({ name: 'r.png', mimeType: 'image/png', buffer: PNG_1PX });
    await page.waitForTimeout(1200);
    await expect(page.locator('#chkBg')).toBeChecked();

    /* скрыть */
    await page.locator('#chkBg').uncheck();
    const hidden = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { bg: { visible: boolean } } }).__appState;
      return st.bg.visible;
    });
    expect(hidden).toBe(false);

    /* удалить */
    await page.locator('#btnBgRemove').click();
    const calibS = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { bg: { calibS: number } } }).__appState;
      return st.bg.calibS;
    });
    expect(calibS).toBe(0);
  });
});
