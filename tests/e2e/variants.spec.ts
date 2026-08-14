import { expect, test, type Page } from '@playwright/test';

function dialogQueue(page: Page, responses: string[]): void {
  const queue = [...responses];
  page.on('dialog', (d) => {
    if (d.type() === 'confirm') d.accept();
    else d.accept(queue.length ? queue.shift()! : 'Вариант');
  });
}

test.describe('Варианты (сравнение систем)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
    await page.locator('#esSample').click();
    await page.waitForTimeout(400);
  });

  test('сохранение текущего как вариант + таблица сравнения', async ({ page }) => {
    dialogQueue(page, ['Вариант 8 кВт']);

    await page.locator('[data-tab="variants"]').click();
    await page.waitForTimeout(400);
    await page.locator('#btnVariantAdd').click();
    await page.waitForTimeout(600);

    await expect(page.locator('#variantList')).toContainText('Вариант 8 кВт');
    await expect(page.locator('#variantTable')).toContainText('Вариант 8 кВт');
  });

  test('переименование и удаление варианта', async ({ page }) => {
    dialogQueue(page, ['Вариант А', 'Вариант Б']);

    await page.locator('[data-tab="variants"]').click();
    await page.waitForTimeout(400);
    await page.locator('#btnVariantAdd').click();
    await page.waitForTimeout(600);
    await expect(page.locator('#variantList')).toContainText('Вариант А');

    await page.locator('.v-edit').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('#variantList')).toContainText('Вариант Б');

    await page.locator('.v-del').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('#variantList')).not.toContainText('Вариант Б');
  });

  test('дублирование варианта в новый проект', async ({ page }) => {
    dialogQueue(page, ['Вариант для копии']);

    await page.locator('[data-tab="variants"]').click();
    await page.waitForTimeout(400);
    await page.locator('#btnVariantAdd').click();
    await page.waitForTimeout(600);

    await page.locator('.v-dup').first().click();
    await page.waitForTimeout(700);

    const projName = await page.locator('#inProject').inputValue();
    expect(projName).toContain('из варианта');

    await page.locator('#btnProjects').click();
    await expect(page.locator('#pr-list')).toContainText('из варианта');
  });

  test('КП: блок сравнения вариантов появляется', async ({ page }) => {
    dialogQueue(page, ['Вариант X']);

    await page.locator('[data-tab="variants"]').click();
    await page.waitForTimeout(400);
    await page.locator('#btnVariantAdd').click();
    await page.waitForTimeout(600);

    await page.locator('[data-tab="proposal"]').click();
    await page.waitForTimeout(600);

    await expect(page.locator('#propVariants')).toBeVisible();
    await expect(page.locator('#propVariantsTbl')).toContainText('Вариант X');
  });
});
