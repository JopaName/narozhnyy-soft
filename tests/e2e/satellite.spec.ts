import { expect, test } from '@playwright/test';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('Спутниковый фон (уровень 1)', () => {
  test.beforeEach(async ({ page }) => {
    /* Мокаем геокодер и тайлы Esri */
    await page.route('https://nominatim.openstreetmap.org/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ lat: '45.04', lon: '38.98', display_name: 'Краснодар, ул. Тестовая 1' }]),
      });
    });
    await page.route('https://server.arcgisonline.com/**', (route) => {
      route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX });
    });

    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
    await page.locator('#esSample').click();
    await page.waitForTimeout(400);
  });

  test('загрузка спутника по адресу с автокалибровкой', async ({ page }) => {
    await page.locator('#inAddr').fill('Краснодар, ул. Тестовая 1');
    await page.locator('#btnSat').click();
    await page.waitForTimeout(2500);

    const bg = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { bg: { visible: boolean; calibS: number; addr: string } } }).__appState;
      const r = (window as unknown as { __R: { view: { s: number } } }).__R;
      return { bg: st.bg, viewS: r.view.s };
    });

    /* фон включён, масштаб задан автоматически */
    expect(bg.bg.visible).toBe(true);
    expect(bg.bg.calibS).toBeGreaterThan(0);
    /* view.s выставлен равным автокалибровке */
    expect(bg.viewS).toBeCloseTo(bg.bg.calibS, 6);
    /* адрес сохранён */
    expect(bg.bg.addr).toContain('Краснодар');

    /* чекбокс синхронизирован */
    await expect(page.locator('#chkBg')).toBeChecked();
  });

  test('пустой адрес — тост без запросов', async ({ page }) => {
    let geocodeCalled = false;
    await page.route('https://nominatim.openstreetmap.org/**', (route) => {
      geocodeCalled = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.locator('#btnSat').click();
    await page.waitForTimeout(800);

    expect(geocodeCalled).toBe(false);
    const bg = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { bg: { visible: boolean } } }).__appState;
      return st.bg.visible;
    });
    expect(bg).toBe(false);
  });

  test('адрес не найден — тост, фон не меняется', async ({ page }) => {
    await page.route('https://nominatim.openstreetmap.org/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.locator('#inAddr').fill('Несуществующее место 12345');
    await page.locator('#btnSat').click();
    await page.waitForTimeout(1500);

    const visible = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { bg: { visible: boolean } } }).__appState;
      return st.bg.visible;
    });
    expect(visible).toBe(false);
    await expect(page.locator('#toast')).toContainText('не найден');
  });
});
