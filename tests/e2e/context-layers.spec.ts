import { expect, test } from '@playwright/test';

test.describe('Контекстное меню, блокировка, слои, тепловая карта', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
  });

  async function firstPanelCenter(page: import('@playwright/test').Page): Promise<{ x: number; y: number }> {
    const pos = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { panels: { x: number; y: number; w: number; h: number }[] } }).__appState;
      const r = (window as unknown as { __R: { view: { s: number; ox: number; oy: number } } }).__R;
      const p = st.panels[0];
      const wx = p.x + p.w / 2;
      const wy = p.y + p.h / 2;
      return { sx: wx * r.view.s + r.view.ox, sy: wy * r.view.s + r.view.oy };
    });
    const box = await page.locator('#cv').boundingBox();
    return { x: box!.x + pos!.sx, y: box!.y + pos!.sy };
  }

  test('ПКМ: меню панели, дублирование', async ({ page }) => {
    /* очищаем и ставим одну панель, чтобы для копии было место */
    await page.evaluate(() => (document.getElementById('btnClearPanels') as HTMLElement).click());
    await page.waitForTimeout(300);
    await page.locator('[data-tool="row"]').click();
    const box = await page.locator('#cv').boundingBox();
    await page.mouse.click(box!.x + box!.width * 0.5, box!.y + box!.height * 0.45);
    await page.waitForTimeout(400);
    const before = Number(await page.locator('#stCount').textContent());
    expect(before).toBe(1);

    const c = await firstPanelCenter(page);
    await page.locator('[data-tool="select"]').click();
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await expect(page.locator('#ctxMenu')).toBeVisible();
    await expect(page.locator('#ctxMenu')).toContainText('Дублировать');
    await expect(page.locator('#ctxMenu')).toContainText('Заблокировать');

    await page.locator('.ctx-item', { hasText: 'Дублировать' }).click();
    await page.waitForTimeout(400);
    const after = Number(await page.locator('#stCount').textContent());
    expect(after).toBe(before + 1);
  });

  test('блокировка: Delete не удаляет заблокированную панель', async ({ page }) => {
    const before = Number(await page.locator('#stCount').textContent());
    const c = await firstPanelCenter(page);

    await page.locator('[data-tool="select"]').click();
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await page.locator('.ctx-item', { hasText: 'Заблокировать' }).click();
    await page.waitForTimeout(300);

    /* панель выбрана — Delete должен быть заблокирован */
    await page.keyboard.press('Delete');
    await page.waitForTimeout(400);
    const after = Number(await page.locator('#stCount').textContent());
    expect(after).toBe(before);
    await expect(page.locator('#toast')).toContainText('заблокирована');
  });

  test('long-press открывает меню', async ({ page }) => {
    const c = await firstPanelCenter(page);
    await page.locator('[data-tool="select"]').click();

    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await expect(page.locator('#ctxMenu')).toBeVisible();
    await page.mouse.up();
    /* закрыть кликом в стороне (после окна подавления long-press) */
    await page.waitForTimeout(500);
    await page.mouse.click(c.x + 200, c.y + 200);
    await expect(page.locator('#ctxMenu')).toBeHidden();
  });

  test('слои: сетка/размеры/препятствия переключаются', async ({ page }) => {
    await page.locator('#chkGrid').uncheck();
    const grid = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { showGrid: boolean } }).__appState;
      return st.showGrid;
    });
    expect(grid).toBe(false);

    await page.locator('#chkDims').uncheck();
    await page.locator('#chkObstacles').uncheck();
    const flags = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { showDims: boolean; showObstacles: boolean } }).__appState;
      return { dims: st.showDims, obs: st.showObstacles };
    });
    expect(flags.dims).toBe(false);
    expect(flags.obs).toBe(false);

    /* вернуть обратно */
    await page.locator('#chkGrid').check();
    await page.locator('#chkDims').check();
    await page.locator('#chkObstacles').check();
  });

  test('тепловая карта включается и рисует легенду', async ({ page }) => {
    await page.locator('#chkShadeMap').check();
    await page.waitForTimeout(400);

    const on = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { showShadeMap: boolean } }).__appState;
      return st.showShadeMap;
    });
    expect(on).toBe(true);

    /* скриншот для визуальной проверки легенды */
    await page.screenshot({ path: 'test-results/heatmap.png' });
  });
});
