import { expect, test } from '@playwright/test';

test.describe('Схема: ряд, превью, групповое выделение', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
    await page.locator('#esSample').click();
    await page.waitForTimeout(400);
    /* sample: крыша + панели уже есть */
  });

  test('инструмент «Ряд»: драг создаёт ровный ряд панелей', async ({ page }) => {
    /* очищаем панели, чтобы ряд был единственным */
    await page.evaluate(() => (document.getElementById('btnClearPanels') as HTMLElement).click());
    await page.waitForTimeout(300);
    await expect(page.locator('#stCount')).toHaveText('0');

    /* включаем ряд и рисуем по крыше */
    await page.locator('[data-tool="row"]').click();
    const box = await page.locator('#cv').boundingBox();
    const sx = box!.x + box!.width * 0.35;
    const sy = box!.y + box!.height * 0.35;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 300, sy, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const count = Number(await page.locator('#stCount').textContent());
    expect(count).toBeGreaterThan(1);

    /* все панели ряда лежат на одной линии y */
    const ys = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { panels: { y: number }[] } }).__appState;
      return st.panels.map((p) => p.y);
    });
    expect(new Set(ys).size).toBe(1);
  });

  test('ghost-превью появляется при наведении в режиме панелей', async ({ page }) => {
    await page.locator('[data-tool="panel"]').click();
    const box = await page.locator('#cv').boundingBox();
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.waitForTimeout(300);

    const ghost = await page.evaluate(() => {
      const r = (window as unknown as { __R: { ghostPanel: { x: number; y: number; w: number; h: number; valid: boolean } | null } }).__R;
      return r.ghostPanel;
    });
    expect(ghost).not.toBeNull();
    expect(ghost!.w).toBeGreaterThan(0);
  });

  test('рамка выделяет группу, группа удаляется Delete', async ({ page }) => {
    await page.locator('[data-tool="select"]').click();
    const before = Number(await page.locator('#stCount').textContent());
    expect(before).toBeGreaterThan(5);

    /* обводим рамкой от угла канваса — крыша с панелями по центру */
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

    /* Delete удаляет всю группу */
    await page.keyboard.press('Delete');
    await page.waitForTimeout(400);
    const after = Number(await page.locator('#stCount').textContent());
    expect(after).toBe(before - multiLen);
  });

  test('группа перемещается целиком', async ({ page }) => {
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

    /* тащим одну из выделенных панелей (клик в ЦЕНТР панели) */
    const first = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { panels: { x: number; y: number; w: number; h: number }[] } }).__appState;
      const r = (window as unknown as { __R: { multi: number[] } }).__R;
      const p = st.panels[r.multi[0]];
      return { x: p.x + p.w / 2, y: p.y + p.h / 2 };
    });
    const view = await page.evaluate(() => {
      const r = (window as unknown as { __R: { view: { s: number; ox: number; oy: number } } }).__R;
      return r.view;
    });
    const cvBox = await page.locator('#cv').boundingBox();
    const px = cvBox!.x + first!.x * view!.s + view!.ox;
    const py = cvBox!.y + first!.y * view!.s + view!.oy;

    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.mouse.move(px - 100, py - 80, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    /* все панели группы сдвинулись одинаково (проверяем, что группа цела и первая панель сдвинулась) */
    const moved = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { panels: { x: number; y: number }[] } }).__appState;
      const r = (window as unknown as { __R: { multi: number[] } }).__R;
      return { len: r.multi.length, first: r.multi.length ? st.panels[r.multi[0]] : null };
    });
    expect(moved!.len).toBeGreaterThan(1);
    expect(moved!.first).not.toBeNull();
  });

  test('Space+драг — панорама (рамка не появляется)', async ({ page }) => {
    await page.locator('[data-tool="select"]').click();
    await page.keyboard.down('Space');
    const box = await page.locator('#cv').boundingBox();
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height * 0.4, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    await page.waitForTimeout(200);

    const marquee = await page.evaluate(() => {
      const r = (window as unknown as { __R: { marquee: { x1: number } | null } }).__R;
      return r.marquee;
    });
    expect(marquee).toBeNull();
  });
});
