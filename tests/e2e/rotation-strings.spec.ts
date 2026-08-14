import { expect, test } from '@playwright/test';

test.describe('Поворот массива и стринги', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
    await page.locator('#esSample').click();
    await page.waitForTimeout(400);
  });

  test('поворот массива пересчитывает раскладку', async ({ page }) => {
    const before = Number(await page.locator('#stCount').textContent());
    expect(before).toBeGreaterThan(0);

    /* ставим угол 25° и отпускаем (change) */
    await page.locator('#inAngle').fill('25');
    await page.locator('#inAngle').blur();
    await page.waitForTimeout(800);

    await expect(page.locator('#valAngle')).toHaveText('25°');
    const after = Number(await page.locator('#stCount').textContent());
    expect(after).toBeGreaterThan(0);

    /* панели повёрнуты: мировая позиция угла ≠ локальная */
    const rotated = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { panels: { x: number; y: number }[]; arrayAngle: number } }).__appState;
      if (!st.panels.length) return false;
      const p = st.panels[0];
      const rad = (st.arrayAngle * Math.PI) / 180;
      const wx = p.x * Math.cos(rad) - p.y * Math.sin(rad);
      const wy = p.x * Math.sin(rad) + p.y * Math.cos(rad);
      return Math.abs(wx - p.x) > 0.01 || Math.abs(wy - p.y) > 0.01;
    });
    expect(rotated).toBe(true);

    /* все панели валидны (внутри крыши по мировым углам) — проверим, что раскладка не пустая и не сломала счётчик */
    const info = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { panels: { x: number; y: number; w: number; h: number }[]; arrayAngle: number; roof: { x: number; y: number }[] } }).__appState;
      /* простейшая проверка: каждая панель в пределах bbox крыши + запас */
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      st.roof.forEach((p) => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      });
      const rad = (st.arrayAngle * Math.PI) / 180;
      return st.panels.every((p) => {
        const corners = [
          [p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h],
        ].map(([lx, ly]) => ({
          x: lx * Math.cos(rad) - ly * Math.sin(rad),
          y: lx * Math.sin(rad) + ly * Math.cos(rad),
        }));
        return corners.every((c) => c.x >= minX - 0.5 && c.x <= maxX + 0.5 && c.y >= minY - 0.5 && c.y <= maxY + 0.5);
      });
    });
    expect(info).toBe(true);

    /* сброс на 0 */
    await page.locator('#inAngle').fill('0');
    await page.locator('#inAngle').blur();
    await page.waitForTimeout(800);
    await expect(page.locator('#valAngle')).toHaveText('0°');
  });

  test('стринги цветом: чекбокс и инфо при выборе панели', async ({ page }) => {
    await page.locator('#chkStrings').check();
    await page.waitForTimeout(300);

    const showStrings = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { showStrings: boolean } }).__appState;
      return st.showStrings;
    });
    expect(showStrings).toBe(true);

    /* выбираем панель кликом по центру первой панели */
    const first = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { panels: { x: number; y: number; w: number; h: number }[]; arrayAngle: number } }).__appState;
      const r = (window as unknown as { __R: { view: { s: number; ox: number; oy: number } } }).__R;
      const p = st.panels[0];
      const rad = (st.arrayAngle * Math.PI) / 180;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const wx = cx * Math.cos(rad) - cy * Math.sin(rad);
      const wy = cx * Math.sin(rad) + cy * Math.cos(rad);
      return { wx, wy, s: r.view.s, ox: r.view.ox, oy: r.view.oy };
    });
    const cvBox = await page.locator('#cv').boundingBox();
    const px = cvBox!.x + first!.wx * first!.s + first!.ox;
    const py = cvBox!.y + first!.wy * first!.s + first!.oy;

    await page.locator('[data-tool="select"]').click();
    await page.mouse.click(px, py);
    await page.waitForTimeout(300);

    const stTool = await page.locator('#stTool').textContent();
    expect(stTool).toContain('Стринг');

    /* выключение */
    await page.locator('#chkStrings').uncheck();
    const off = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { showStrings: boolean } }).__appState;
      return st.showStrings;
    });
    expect(off).toBe(false);
  });
});
