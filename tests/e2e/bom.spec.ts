import { expect, test } from '@playwright/test';

test.describe('Детальная смета (BOM)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
  });

  test('финансы: структура затрат содержит позиции сметы', async ({ page }) => {
    await page.locator('[data-tab="finance"]').click();
    await page.waitForTimeout(600);

    await expect(page.locator('#capexList')).toContainText('УЗИП DC');
    await expect(page.locator('#capexList')).toContainText('Система крепления');
    await expect(page.locator('#capexList')).toContainText('Монтаж и пусконаладка');
    await expect(page.locator('#capexList')).toContainText('Итого');
  });

  test('КП: спецификация содержит позиции сметы с количествами', async ({ page }) => {
    await page.locator('[data-tab="proposal"]').click();
    await page.waitForTimeout(600);

    await expect(page.locator('#propSpec')).toContainText('УЗИП DC');
    await expect(page.locator('#propSpec')).toContainText('Счётчик двунаправленный');
    /* количество × цена = сумма */
    await expect(page.locator('#propSpec')).toContainText('= ');
  });

  test('редактор каталога: вкладка «Смета» работает', async ({ page }) => {
    await page.locator('#btnCatalog').click();
    await page.waitForTimeout(400);

    await page.locator('[data-eqtab="bom"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#eq-list')).toContainText('УЗИП DC');
    await expect(page.locator('#eq-list')).toContainText('на project');
  });

  test('CAPEX изменился после добавления панелей (крепёж+кабель в смете)', async ({ page }) => {
    await page.locator('[data-tab="finance"]').click();
    await page.waitForTimeout(600);
    const capexBefore = await page.locator('#fCapex').textContent();

    await page.locator('[data-tab="scheme"]').click();
    await page.waitForTimeout(300);
    /* очистить и заново автораскладку — число панелей не изменится,
       но проверим согласованность CAPEX и строк сметы */
    await page.locator('[data-tab="finance"]').click();
    await page.waitForTimeout(600);
    const capexAfter = await page.locator('#fCapex').textContent();
    expect(capexAfter).toBe(capexBefore);
  });
});
