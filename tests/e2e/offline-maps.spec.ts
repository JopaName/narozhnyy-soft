import { expect, test } from '@playwright/test';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const TINY_REGIONS = {
  regions: [
    {
      id: 'test-region',
      name: 'Тестовый регион',
      bbox: [38.06, 44.55, 38.08, 44.57],
      minZoom: 12,
      maxZoom: 12,
      streetsFile: '',
    },
  ],
};

test.describe('Оффлайн-карты', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://server.arcgisonline.com/**', (route) => {
      route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX });
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 15000 });
    await page.locator('#esSample').click();
    await page.waitForTimeout(400);
  });

  test('режим карты открывается и закрывается Esc', async ({ page }) => {
    await page.locator('#inAddr').fill('');
    await page.locator('#btnMap').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('#btnMapUse')).toBeVisible();
    const tool = await page.locator('#stTool').textContent();
    expect(tool).toBe('Карта');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('#btnMapUse')).toBeHidden();
  });

  test('менеджер: список регионов, скачивание пакета с прогрессом', async ({ page }) => {
    /* подменяем список регионов на крошечный тестовый */
    await page.route('**/regions.json', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TINY_REGIONS) });
    });

    await page.locator('#btnMapManager').click();
    await page.waitForTimeout(600);
    await expect(page.locator('#map-modal')).toBeVisible();
    await expect(page.locator('#map-region-list')).toContainText('Тестовый регион');

    await page.locator('.mp-download').click();
    /* ждём завершения: статус «Скачано полностью» */
    await expect(page.locator('#map-region-list')).toContainText('Скачано полностью', { timeout: 20000 });
    await expect(page.locator('#map-region-list')).toContainText('Удалить');

    /* удаление */
    page.on('dialog', (d) => d.accept());
    await page.locator('.mp-delete').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('#map-region-list')).not.toContainText('Скачано полностью');
  });

  test('автоподсказка: оффлайн-улицы Геленджика', async ({ page }) => {
    await page.locator('#inAddr').fill('Десант');
    await page.waitForTimeout(1200);

    const items = page.locator('.addr-suggest-item');
    await expect(items.first()).toBeVisible();
    /* оффлайн-подсказки содержат название улицы */
    const text = await page.locator('#addrSuggest').textContent();
    expect(text).toContain('Геленджик');

    /* клик по подсказке открывает карту */
    await items.first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator('#btnMapUse')).toBeVisible();
  });
});
