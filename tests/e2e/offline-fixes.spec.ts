import { expect, test } from '@playwright/test';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const TINY_REGIONS = {
  regions: [
    {
      id: 'test-region',
      name: 'Тестовый регион',
      bbox: [38.05, 44.54, 38.13, 44.62],
      minZoom: 12,
      maxZoom: 12,
      streetsFile: '',
    },
  ],
};

async function downloadTinyPack(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('#btnMapManager').click();
  await page.waitForTimeout(500);
  await page.locator('.mp-download').click();
  await expect(page.locator('#map-region-list')).toContainText('Скачано полностью', { timeout: 30000 });
  await page.locator('#map-close').click();
}

test.describe('Фиксы оффлайн-карт', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/regions.json', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TINY_REGIONS) });
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

  test('докачка: пропуск уже скачанных тайлов', async ({ page }) => {
    await downloadTinyPack(page);

    /* удаляем один тайл из IndexedDB — имитация недокачанного пакета */
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const req = indexedDB.open('solarstudio-tiles', 1);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('tiles', 'readwrite');
            const cursorReq = tx.objectStore('tiles').openCursor();
            cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (cursor) {
                cursor.delete();
                tx.oncomplete = () => resolve();
              } else resolve();
            };
          };
        }),
    );

    /* докачиваем: 1 тайл скачается заново, остальные пропустятся */
    await page.locator('#btnMapManager').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#map-region-list')).toContainText('Докачать');
    await page.locator('.mp-download').click();
    await expect(page.locator('#map-region-list')).toContainText('Скачано полностью', { timeout: 30000 });
    await expect(page.locator('#toast')).toContainText('докачано', { timeout: 5000 });
  });

  test('оффлайн-фолбэк: «Использовать место» без сети', async ({ page }) => {
    await downloadTinyPack(page);

    /* блокируем сеть для высокого зума */
    await page.route('https://server.arcgisonline.com/**', (route) => route.abort());

    /* открываем карту в точке региона и используем место */
    await page.locator('#inAddr').fill('');
    await page.locator('#btnMap').click();
    await page.waitForTimeout(1500);

    const mapMode = await page.evaluate(() => {
      const r = (window as unknown as { __R: { mapMode: { lat: number; lng: number } | null } }).__R;
      return r.mapMode;
    });
    expect(mapMode).not.toBeNull();

    /* карта по умолчанию открывается на Геленджике — двигаемся в тестовый регион нельзя,
       поэтому проверяем фолбэк на точке тестового региона через прямой вызов */
    const result = await page.evaluate(async () => {
      /* переключаемся на центр тестового региона программно */
      const st = (window as unknown as { __R: { mapMode: { lat: number; lng: number } } }).__R;
      st.mapMode.lat = 44.56;
      st.mapMode.lng = 38.07;
      const btn = document.getElementById('btnMapUse') as HTMLElement;
      btn.click();
      await new Promise((r) => setTimeout(r, 3000));
      const appState = (window as unknown as { __appState: { bg: { visible: boolean; calibS: number } } }).__appState;
      return { visible: appState.bg.visible, calibS: appState.bg.calibS };
    });

    expect(result.visible).toBe(true);
    expect(result.calibS).toBeGreaterThan(0);
  });
});
