import { expect, test } from '@playwright/test';

test('реальное скачивание пакета Геленджик + оффлайн-просмотр', async ({ page }) => {
  test.setTimeout(900000);
  test.skip(process.env.RUN_LIVE !== '1', 'тяжёлый live-тест: запускать с RUN_LIVE=1');
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('#toolbar', { timeout: 15000 });

  await page.locator('#btnMapManager').click();
  await page.waitForTimeout(600);
  await expect(page.locator('#map-region-list')).toContainText('Геленджик (демо-пакет)');

  const t0 = Date.now();
  await page.locator('.mp-download').first().click();

  /* ждём статус «Скачано полностью» (по таймеру renderList каждые 800мс) */
  await page.waitForFunction(() => {
    const el = document.getElementById('map-region-list');
    return el && el.textContent!.includes('Скачано полностью');
  }, null, { timeout: 600000 });

  const secs = Math.round((Date.now() - t0) / 1000);
  console.log('DOWNLOAD DONE in ' + secs + 's');

  /* закрываем менеджер, открываем оффлайн-карту */
  await page.locator('#map-close').click();
  await page.locator('#inAddr').fill('');
  await page.locator('#btnMap').click();
  await page.waitForTimeout(4000);

  /* в центре канваса должны быть реальные тайлы (не серый placeholder) */
  await page.screenshot({ path: 'test-results/offline-map.png' });
  const px = await page.evaluate(() => {
    const cv = document.getElementById('cv') as HTMLCanvasElement;
    const ctx = cv.getContext('2d')!;
    const d = ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data;
    return [d[0], d[1], d[2]];
  });
  console.log('CENTER PIXEL:', JSON.stringify(px));
  /* серые placeholder-цвета: #1a1d23 (26,29,35) и #262a31 (38,42,49) */
  const isPlaceholder =
    (px[0] >= 24 && px[0] <= 40 && px[1] >= 27 && px[1] <= 44 && px[2] >= 33 && px[2] <= 51);
  expect(isPlaceholder).toBe(false);
});

