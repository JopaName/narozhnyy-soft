import { expect, test } from '@playwright/test';

test.describe('Мобильная вёрстка (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
  });

  test('канвас занимает почти весь экран, сайдбар скрыт', async ({ page }) => {
    const cvBox = await page.locator('#cv').boundingBox();
    expect(cvBox!.width).toBeGreaterThan(300);

    /* сайдбар уехал за экран */
    const asideBox = await page.locator('#view-scheme aside').boundingBox();
    expect(asideBox!.x).toBeGreaterThan(380);

    /* кнопка шторки видна */
    await expect(page.locator('#btnSidebar')).toBeVisible();
  });

  test('шторка открывается и закрывается', async ({ page }) => {
    await page.locator('#btnSidebar').click();
    await page.waitForTimeout(400);

    /* шторка на месте */
    const asideBox = await page.locator('#view-scheme aside').boundingBox();
    expect(asideBox!.x).toBeLessThan(100);
    await expect(page.locator('#sbBackdrop')).toBeVisible();

    /* контент сайдбара кликабелен: кнопка Автораскладка работает */
    await page.locator('#btnAuto').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#stCount')).not.toHaveText('0');

    /* закрытие по бэкдропу */
    await page.locator('#sbBackdrop').click({ position: { x: 10, y: 400 } });
    await page.waitForTimeout(400);
    const asideBox2 = await page.locator('#view-scheme aside').boundingBox();
    expect(asideBox2!.x).toBeGreaterThan(380);
  });

  test('вкладки — скроллящийся ряд в шапке', async ({ page }) => {
    const tabsBox = await page.locator('#tabs').boundingBox();
    expect(tabsBox!.width).toBeGreaterThan(300);

    /* вкладка КП доступна и переключается */
    await page.locator('[data-tab="proposal"]').click();
    await page.waitForTimeout(600);
    await expect(page.locator('#view-proposal')).toBeVisible();
  });

  test('тач-таргеты: тулбар ≥44px, поля ≥44px', async ({ page }) => {
    const toolBtn = await page.locator('#toolbar .toolbtn').first().boundingBox();
    expect(toolBtn!.height).toBeGreaterThanOrEqual(44);

    await page.locator('#btnSidebar').click();
    await page.waitForTimeout(400);
    const inp = await page.locator('#inProject').boundingBox();
    expect(inp!.height).toBeGreaterThanOrEqual(44);
  });

  test('КП открывается и рендерится на мобильном', async ({ page }) => {
    await page.locator('[data-tab="proposal"]').click();
    await page.waitForTimeout(800);
    await expect(page.locator('#paper')).toBeVisible();
    await expect(page.locator('#propSpec tr')).not.toHaveCount(0);
  });
});
