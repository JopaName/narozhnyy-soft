import { expect, test } from '@playwright/test';

test.describe('Снап, выравнивание, линейка, параметры стрингов', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
    await page.locator('#esSample').click();
    await page.waitForTimeout(400);
  });

  test('снап: панель прилипает к краю соседней', async ({ page }) => {
    /* чистим и ставим две панели рядом */
    await page.evaluate(() => (document.getElementById('btnClearPanels') as HTMLElement).click());
    await page.waitForTimeout(300);

    await page.locator('[data-tool="row"]').click();
    const box = await page.locator('#cv').boundingBox();
    const cx = box!.x + box!.width * 0.4;
    const cy = box!.y + box!.height * 0.45;

    /* панель A */
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(300);
    /* панель B чуть правее с зазором */
    const view = await page.evaluate(() => {
      const r = (window as unknown as { __R: { view: { s: number } } }).__R;
      return r.view;
    });
    await page.mouse.click(cx + 2.3 * view!.s, cy);
    await page.waitForTimeout(300);

    const two = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { panels: { x: number; w: number; y: number }[] } }).__appState;
      return st.panels.map((p) => ({ x: p.x, w: p.w, y: p.y }));
    });
    expect(two).toHaveLength(2);
    const [a, b] = two!;

    /* тащим B (чуть внутри от левого края) к правому краю A */
    await page.locator('[data-tool="select"]').click();
    const grabX = cx + (b!.x + 0.05 - a!.x) * view!.s;
    await page.mouse.move(grabX, cy);
    await page.mouse.down();
    /* тянем так, чтобы левый край B оказался в 5px от правого края A */
    const targetX = cx + (a!.w - 0.05) * view!.s + 5;
    await page.mouse.move(targetX, cy, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const after = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { panels: { x: number; w: number }[] } }).__appState;
      return st.panels.map((p) => p.x);
    });
    /* B прилипла к правому краю A */
    expect(Math.abs(after![1] - (after![0] + a!.w))).toBeLessThan(0.06);
  });

  test('выравнивание: кнопка ⬅ выравнивает группу по левому краю', async ({ page }) => {
    /* выделяем несколько панелей рамкой */
    await page.locator('[data-tool="select"]').click();
    const box = await page.locator('#cv').boundingBox();
    await page.mouse.move(box!.x + 5, box!.y + 5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width - 5, box!.y + box!.height - 5, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const multiLen = await page.evaluate(() => {
      const r = (window as unknown as { __R: { multi: number[] } }).__R;
      return r.multi.length;
    });
    expect(multiLen).toBeGreaterThan(1);

    await expect(page.locator('#rotRow')).toBeVisible();
    await page.locator('#alLeft').click();
    await page.waitForTimeout(300);

    const xs = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { panels: { x: number }[] } }).__appState;
      const r = (window as unknown as { __R: { multi: number[] } }).__R;
      return r.multi.map((i) => st.panels[i].x);
    });
    expect(new Set(xs!.map((x) => Math.round(x * 10) / 10)).size).toBe(1);
  });

  test('линейка: два клика → расстояние', async ({ page }) => {
    await page.locator('[data-tool="ruler"]').click();
    const box = await page.locator('#cv').boundingBox();
    const p1x = box!.x + box!.width * 0.3;
    const p2x = box!.x + box!.width * 0.5;
    const y = box!.y + box!.height * 0.5;

    await page.mouse.click(p1x, y);
    await page.mouse.click(p2x, y);
    await page.waitForTimeout(300);

    await expect(page.locator('#toast')).toContainText('Расстояние');

    const ruler = await page.evaluate(() => {
      const r = (window as unknown as { __R: { ruler: { p1: { x: number; y: number } | null; p2: { x: number; y: number } | null } | null } }).__R;
      return r.ruler;
    });
    expect(ruler!.p1).not.toBeNull();
    expect(ruler!.p2).not.toBeNull();
  });

  test('параметры стрингов: вольты и амперы в Электрике и легенде', async ({ page }) => {
    await page.locator('[data-tab="system"]').click();
    await page.waitForTimeout(600);

    /* в Электрике: по-стринговые параметры */
    await expect(page.locator('#stringInfo')).toContainText('Vmp');
    await expect(page.locator('#stringInfo')).toContainText('А');

    /* легенда на канвасе при включённых стрингах */
    await page.locator('[data-tab="scheme"]').click();
    await page.waitForTimeout(300);
    await page.locator('#chkStrings').check();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/strings-legend.png' });
  });
});
