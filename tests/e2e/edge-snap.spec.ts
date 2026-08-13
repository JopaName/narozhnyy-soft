import { expect, test } from '@playwright/test';

test.describe('Привязка к краям крыши', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
  });

  async function injectEdges(page: import('@playwright/test').Page): Promise<void> {
    /* две линии: y=6 (горизонталь) и x=9 (вертикаль), угол в (9,6) */
    await page.evaluate(() => {
      const set = (window as unknown as { __setTestEdges: (e: unknown) => void }).__setTestEdges;
      set({
        lines: [
          { a: 0, b: 1, c: -6 },
          { a: 1, b: 0, c: -9 },
        ],
        corners: [{ x: 9, y: 6 }],
      });
    });
  }

  test('клик крыши примагничивается к линии', async ({ page }) => {
    await injectEdges(page);
    await page.locator('[data-tool="roof"]').click();

    const view = await page.evaluate(() => {
      const r = (window as unknown as { __R: { view: { s: number; ox: number; oy: number } } }).__R;
      return r.view;
    });
    const cvBox = await page.locator('#cv').boundingBox();
    /* кликаем рядом с линией y=6 (мировая точка x=12, y=6.3) */
    const wx = 12;
    const wy = 6.3;
    const px = cvBox!.x + wx * view!.s + view!.ox;
    const py = cvBox!.y + wy * view!.s + view!.oy;
    await page.mouse.click(px, py);
    await page.waitForTimeout(300);

    const first = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { tempRoof: { x: number; y: number }[] } }).__appState;
      return st.tempRoof[0];
    });
    expect(first).toBeDefined();
    expect(first!.y).toBeCloseTo(6, 1);
    expect(first!.x).toBeCloseTo(12, 1);
  });

  test('клик рядом с углом примагничивается к углу', async ({ page }) => {
    await injectEdges(page);
    await page.locator('[data-tool="roof"]').click();

    const view = await page.evaluate(() => {
      const r = (window as unknown as { __R: { view: { s: number; ox: number; oy: number } } }).__R;
      return r.view;
    });
    const cvBox = await page.locator('#cv').boundingBox();
    const wx = 9.1;
    const wy = 6.15;
    await page.mouse.click(cvBox!.x + wx * view!.s + view!.ox, cvBox!.y + wy * view!.s + view!.oy);
    await page.waitForTimeout(300);

    const first = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { tempRoof: { x: number; y: number }[] } }).__appState;
      return st.tempRoof[0];
    });
    expect(first!.x).toBeCloseTo(9, 1);
    expect(first!.y).toBeCloseTo(6, 1);
  });

  test('выключение привязки — точка без снапа', async ({ page }) => {
    await injectEdges(page);
    await page.locator('#chkEdges').uncheck();
    await page.locator('[data-tool="roof"]').click();

    const view = await page.evaluate(() => {
      const r = (window as unknown as { __R: { view: { s: number; ox: number; oy: number } } }).__R;
      return r.view;
    });
    const cvBox = await page.locator('#cv').boundingBox();
    const wx = 12;
    const wy = 6.3;
    await page.mouse.click(cvBox!.x + wx * view!.s + view!.ox, cvBox!.y + wy * view!.s + view!.oy);
    await page.waitForTimeout(300);

    const first = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { tempRoof: { x: number; y: number }[] } }).__appState;
      return st.tempRoof[0];
    });
    /* без снапа: y остаётся ~6.25 (привязка к сетке 0.25), не 6.0 */
    expect(Math.abs(first!.y - 6.3)).toBeLessThan(0.06);
  });
});
