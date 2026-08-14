import { expect, test } from '@playwright/test';

test.describe('Проверка обновлений', () => {
  test('баннер появляется при наличии новой версии', async ({ page }) => {
    /* Мокаем GitHub API — отдаём новую версию */
    await page.route('https://api.github.com/repos/JopaName/narozhnyy-soft/releases/latest', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tag_name: 'v9.9.9',
          html_url: 'https://github.com/JopaName/narozhnyy-soft/releases/tag/v9.9.9',
          body: 'Тестовое обновление',
          assets: [
            {
              name: 'SolarStudio.apk',
              browser_download_url: 'https://example.com/SolarStudio.apk',
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 10000 });
    await page.locator('#esSample').click();
    await page.waitForTimeout(400);
    await page.waitForSelector('#update-banner', { timeout: 10000 });

    await expect(page.locator('#update-banner')).toBeVisible();
    await expect(page.locator('#update-banner')).toContainText('9.9.9');
    await expect(page.locator('#update-btn')).toBeVisible();
  });

  test('баннер не появляется, если версия актуальна', async ({ page }) => {
    await page.route('https://api.github.com/repos/JopaName/narozhnyy-soft/releases/latest', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tag_name: 'v1.0.0',
          html_url: 'https://github.com/JopaName/narozhnyy-soft/releases/tag/v1.0.0',
          body: '',
          assets: [],
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 10000 });
    await page.locator('#esSample').click();
    await page.waitForTimeout(400);
    await page.waitForTimeout(4500);

    const banner = page.locator('#update-banner');
    expect(await banner.count()).toBe(0);
  });

  test('кнопка закрытия скрывает баннер', async ({ page }) => {
    await page.route('https://api.github.com/repos/JopaName/narozhnyy-soft/releases/latest', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tag_name: 'v9.9.9',
          html_url: 'https://github.com/JopaName/narozhnyy-soft/releases/tag/v9.9.9',
          body: '',
          assets: [],
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('#update-banner', { timeout: 10000 });
    await page.locator('#update-close').click();
    await expect(page.locator('#update-banner')).toBeHidden();
  });
});
