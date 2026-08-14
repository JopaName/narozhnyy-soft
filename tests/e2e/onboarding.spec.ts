import { expect, test } from '@playwright/test';

test.describe('Онбординг: без тестового объекта', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
  });

  test('при первом запуске — приветствие, НЕ пример', async ({ page }) => {
    /* панелей нет — образец не загружен */
    await expect(page.locator('#stCount')).toHaveText('0');
    /* экран приветствия виден */
    await expect(page.locator('#emptyState')).toBeVisible();
    await expect(page.locator('#emptyState')).toContainText('Создайте новый проект');
    await expect(page.locator('#esCreate')).toBeVisible();
  });

  test('«Создать свою схему» — пустой проект и инструмент «Крыша»', async ({ page }) => {
    await page.locator('#esCreate').click();
    await expect(page.locator('#start-modal')).toBeVisible();

    await page.locator('#startScheme').click();
    await page.waitForTimeout(400);

    /* приветствие скрыто, активен инструмент крыши */
    await expect(page.locator('#emptyState')).toBeHidden();
    await expect(page.locator('#stTool')).toHaveText('Крыша');
    /* проект создан */
    await page.locator('#btnProjects').click();
    await expect(page.locator('#pr-list')).toContainText('Новый проект');
  });

  test('«Найти крышу на карте» — режим карты с поиском', async ({ page }) => {
    await page.locator('#esCreate').click();
    await page.locator('#startMap').click();
    await page.waitForTimeout(1200);

    await expect(page.locator('#btnMapUse')).toBeVisible();
    await expect(page.locator('#mapSearchWrap')).toBeVisible();

    /* поиск в карте открывает подсказки */
    await page.locator('#mapSearch').fill('Геленджик');
    await page.waitForTimeout(1200);
    await expect(page.locator('#mapSuggest')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('#mapSearchWrap')).toBeHidden();
  });

  test('«Открыть пример» работает по кнопке', async ({ page }) => {
    await page.locator('#esSample').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#stCount')).not.toHaveText('0');
  });

  test('сохранённый проект восстанавливается, а не пример', async ({ page }) => {
    /* создаём свой проект и рисуем крышу */
    await page.locator('#esCreate').click();
    await page.locator('#startScheme').click();
    await page.waitForTimeout(300);

    const box = await page.locator('#cv').boundingBox();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const pts = [
      [cx - 120, cy - 80],
      [cx + 120, cy - 80],
      [cx + 120, cy + 80],
      [cx - 120, cy + 80],
    ];
    for (const [x, y] of pts) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(120);
    }
    /* двойной клик — замкнуть крышу */
    await page.mouse.dblclick(cx - 120, cy - 80);
    await page.waitForTimeout(500);

    const roofLen = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { roof: unknown[] } }).__appState;
      return st.roof.length;
    });
    expect(roofLen).toBeGreaterThanOrEqual(3);

    /* перезагрузка — проект восстановлен, образец не подменяет */
    await page.reload();
    await page.waitForSelector('#toolbar', { timeout: 15000 });
    await page.waitForTimeout(500);

    const restored = await page.evaluate(() => {
      const st = (window as unknown as { __appState: { roof: unknown[]; panels: unknown[] } }).__appState;
      return { roof: st.roof.length, panels: st.panels.length };
    });
    expect(restored.roof).toBeGreaterThanOrEqual(3);
    /* панелей нет — это наш проект, а не пример */
    expect(restored.panels).toBe(0);
  });
});
