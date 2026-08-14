import { expect, test } from '@playwright/test';

test.describe('Навигация по схеме и карте', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
  });

  test('инструмент «Панорама» двигает вид драгом', async ({ page }) => {
    await page.locator('[data-tool="hand"]').click();
    const before = await page.evaluate(() => {
      const r = (window as unknown as { __R: { view: { ox: number; oy: number } } }).__R;
      return { ox: r.view.ox, oy: r.view.oy };
    });

    const box = await page.locator('#cv').boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 150, box!.y + box!.height / 2 + 100, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const after = await page.evaluate(() => {
      const r = (window as unknown as { __R: { view: { ox: number; oy: number } } }).__R;
      return { ox: r.view.ox, oy: r.view.oy };
    });
    expect(after.ox).toBeCloseTo(before!.ox + 150, 0);
    expect(after.oy).toBeCloseTo(before!.oy + 100, 0);
  });

  test('кнопки зума меняют масштаб', async ({ page }) => {
    const s0 = await page.evaluate(() => {
      const r = (window as unknown as { __R: { view: { s: number } } }).__R;
      return r.view.s;
    });

    await page.locator('#btnZoomIn').click();
    await page.waitForTimeout(200);
    const sIn = await page.evaluate(() => {
      const r = (window as unknown as { __R: { view: { s: number } } }).__R;
      return r.view.s;
    });
    expect(sIn).toBeCloseTo(s0! * 1.25, 3);

    await page.locator('#btnZoomOut').click();
    await page.waitForTimeout(200);
    const sOut = await page.evaluate(() => {
      const r = (window as unknown as { __R: { view: { s: number } } }).__R;
      return r.view.s;
    });
    expect(sOut).toBeCloseTo(s0!, 3);
  });

  test('режим карты: драг перемещает карту', async ({ page }) => {
    await page.locator('#inAddr').fill('');
    await page.locator('#btnMap').click();
    await page.waitForTimeout(1200);
    await expect(page.locator('#btnMapUse')).toBeVisible();

    const before = await page.evaluate(() => {
      const r = (window as unknown as { __R: { view: { ox: number; oy: number } } }).__R;
      return { ox: r.view.ox, oy: r.view.oy };
    });

    const box = await page.locator('#cv').boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 - 120, box!.y + box!.height / 2 - 80, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const after = await page.evaluate(() => {
      const r = (window as unknown as { __R: { view: { ox: number; oy: number } } }).__R;
      return { ox: r.view.ox, oy: r.view.oy };
    });
    expect(Math.abs(after!.ox - (before!.ox - 120))).toBeLessThan(1);
    expect(Math.abs(after!.oy - (before!.oy - 80))).toBeLessThan(1);

    /* long-press в режиме карты не открывает меню */
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await expect(page.locator('#ctxMenu')).toBeHidden();
    await page.mouse.up();

    await page.keyboard.press('Escape');
  });
});
