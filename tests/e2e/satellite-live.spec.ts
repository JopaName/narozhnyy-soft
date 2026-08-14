import { expect, test } from '@playwright/test';

test('реальный спутник: Геленджик, ул. Десантная 44б', async ({ page }) => {
  test.skip(process.env.RUN_LIVE !== '1', 'тяжёлый live-тест: запускать с RUN_LIVE=1');
  await page.goto('http://localhost:5173');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5173');
  await page.waitForSelector('#toolbar', { timeout: 15000 });
    await page.locator('#esSample').click();
    await page.waitForTimeout(400);

  await page.locator('#inAddr').fill('Геленджик, ул Десантная 44б');
  await page.locator('#btnSat').click();

  /* ждём геокодинг + скачивание 16 тайлов + склейку */
  await page.waitForTimeout(15000);

  const info = await page.evaluate(() => {
    const st = (window as unknown as { __appState: { bg: { visible: boolean; calibS: number; addr: string; opacity: number } } }).__appState;
    const r = (window as unknown as { __R: { view: { s: number; ox: number; oy: number } } }).__R;
    return { bg: st.bg, view: r.view };
  });

  console.log('BG:', JSON.stringify(info.bg));
  console.log('VIEW:', JSON.stringify(info.view));

  expect(info.bg.visible).toBe(true);
  expect(info.bg.calibS).toBeGreaterThan(0);
  expect(info.bg.addr.toLowerCase()).toContain('геленджик');
  expect(info.view.s).toBeCloseTo(info.bg.calibS, 6);

  /* Реальная детекция краёв: ждём результат и логируем */
  await page.waitForTimeout(4000);
  const edges = await page.evaluate(() => {
    const get = (window as unknown as { __getTestEdges: () => { lines: unknown[]; corners: unknown[] } | null }).__getTestEdges;
    const e = get();
    return { lines: e?.lines.length ?? -1, corners: e?.corners.length ?? -1 };
  });
  console.log('EDGES DETECTED:', JSON.stringify(edges));
  await page.screenshot({ path: 'test-results/edges-live.png' });
  /* Детекция должна завершиться без краша; линий может быть любое число */
  expect(edges.lines).toBeGreaterThanOrEqual(0);
  expect(edges.corners).toBeGreaterThanOrEqual(0);

  /* скриншот для проверки, что снимок действительно спутниковый */
  await page.screenshot({ path: 'test-results/satellite-gelendzhik.png' });
});
