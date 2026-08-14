import { expect, test } from '@playwright/test';

test.describe('Проекты (multi-project)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
    await page.locator('#esSample').click();
    await page.waitForTimeout(400);
  });

  test('модалка открывается, есть проекты', async ({ page }) => {
    await page.locator('#btnProjects').click();
    await expect(page.locator('#pr-modal')).toBeVisible();
    /* sample создаёт минимум один проект */
    await expect(page.locator('#pr-list .card')).not.toHaveCount(0);
    await page.locator('#pr-close').click();
    await expect(page.locator('#pr-modal')).toBeHidden();
  });

  test('создание нового пустого проекта', async ({ page }) => {
    page.on('dialog', (d) => d.accept('Мой тестовый проект'));
    await page.locator('#btnProjects').click();
    await page.locator('#pr-new').click();
    await page.waitForTimeout(600);

    /* пустой проект: 0 панелей, имя в сайдбаре */
    await expect(page.locator('#stCount')).toHaveText('0');
    await expect(page.locator('#inProject')).toHaveValue('Мой тестовый проект');

    /* проект появился в списке */
    await page.locator('#btnProjects').click();
    await expect(page.locator('#pr-list')).toContainText('Мой тестовый проект');
  });

  test('дублирование проекта', async ({ page }) => {
    await page.locator('#btnProjects').click();
    const before = await page.locator('#pr-list .card').count();
    await page.locator('.pr-dup').first().click();
    await page.waitForTimeout(400);
    const after = await page.locator('#pr-list .card').count();
    expect(after).toBe(before + 1);
    await expect(page.locator('#pr-list')).toContainText('копия');
  });

  test('переключение между проектами меняет панели', async ({ page }) => {
    /* создаём пустой проект, затем открываем sample-проект */
    page.on('dialog', (d) => d.accept('Пустой'));
    await page.locator('#btnProjects').click();
    await page.locator('#pr-new').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#stCount')).toHaveText('0');

    await page.locator('#btnProjects').click();
    /* в списке есть sample-проект с панелями и пустой «Пустой»; открываем НЕ текущий */
    const sampleRow = page.locator('#pr-list .card', { hasText: 'Пример' }).first();
    await sampleRow.click();
    await page.waitForTimeout(500);
    await expect(page.locator('#stCount')).not.toHaveText('0');
  });

  test('удаление проекта', async ({ page }) => {
    page.on('dialog', (d) => {
      if (d.type() === 'confirm') d.accept();
      else d.accept('Удаляемый');
    });
    await page.locator('#btnProjects').click();
    await page.locator('#pr-new').click();
    await page.waitForTimeout(500);

    await page.locator('#btnProjects').click();
    const before = await page.locator('#pr-list .card').count();
    await page.locator('.pr-del').first().click();
    await page.waitForTimeout(500);
    const after = await page.locator('#pr-list .card').count();
    expect(after).toBe(before - 1);
  });
});
