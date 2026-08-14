import { expect, test } from '@playwright/test';

test.describe('Индивидуальный поворот панелей', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
    await page.locator('#esSample').click();
    await page.waitForTimeout(400);
  });

  async function firstPanelCenter(page: import('@playwright/test').Page): Promise<{ x: number; y: number }> {
    const pos = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { panels: { x: number; y: number; w: number; h: number }[]; arrayAngle: number } }).__appState;
      const r = (window as unknown as { __R: { view: { s: number; ox: number; oy: number } } }).__R;
      const p = st.panels[0];
      const rad = (st.arrayAngle * Math.PI) / 180;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const wx = cx * Math.cos(rad) - cy * Math.sin(rad);
      const wy = cx * Math.sin(rad) + cy * Math.cos(rad);
      return { sx: wx * r.view.s + r.view.ox, sy: wy * r.view.s + r.view.oy };
    });
    const box = await page.locator('#cv').boundingBox();
    return { x: box!.x + pos!.sx, y: box!.y + pos!.sy };
  }

  test('слайдер поворачивает выбранную панель', async ({ page }) => {
    await page.locator('[data-tool="select"]').click();
    const c = await firstPanelCenter(page);
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(300);

    /* слайдер виден */
    await expect(page.locator('#rotRow')).toBeVisible();

    await page.locator('#inRot').fill('90');
    await page.waitForTimeout(300);

    const a = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { panels: { a?: number }[] } }).__appState;
      const r = (window as unknown as { __R: { sel: { type: string; i: number } | null } }).__R;
      return st.panels[r.sel!.i].a;
    });
    expect(a).toBe(90);
    await expect(page.locator('#valRot')).toHaveText('90°');
  });

  test('повёрнутая панель кликабельна (хит по своему углу)', async ({ page }) => {
    await page.locator('[data-tool="select"]').click();
    const c = await firstPanelCenter(page);
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(300);

    /* поворачиваем на 90° через контекстное меню (swap) */
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await page.locator('.ctx-item', { hasText: 'Повернуть' }).click();
    await page.waitForTimeout(300);

    /* после поворота w/h поменялись — кликаем по центру и проверяем выбор */
    const center = await firstPanelCenter(page);
    await page.mouse.click(center.x, center.y);
    await page.waitForTimeout(300);
    const stTool = await page.locator('#stTool').textContent();
    expect(stTool).toContain('Панель');
  });

  test('поворот сохраняется в проекте после перезагрузки', async ({ page }) => {
    await page.locator('[data-tool="select"]').click();
    const c = await firstPanelCenter(page);
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(300);

    await page.locator('#inRot').fill('30');
    await page.locator('#inRot').blur();
    await page.waitForTimeout(600);

    await page.reload();
    await page.waitForSelector('#toolbar', { timeout: 15000 });
    await page.waitForTimeout(500);

    const restored = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { panels: { a?: number }[] } }).__appState;
      return st.panels.map((p) => p.a || 0);
    });
    /* первая панель (индекс мог сместиться — но хоть одна с углом 30) */
    expect(restored.some((a) => a === 30)).toBe(true);
  });
});
