import { test } from '@playwright/test';

test('readme screenshots', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#toolbar', { timeout: 15000 });
  await page.waitForTimeout(2000);

  /* Схема с панелями */
  await page.screenshot({ path: 'docs/screenshots/1-scheme.png' });

  /* Система */
  await page.locator('[data-tab="system"]').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/2-system.png' });

  /* Выработка */
  await page.locator('[data-tab="energy"]').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/3-energy.png' });

  /* Финансы */
  await page.locator('[data-tab="finance"]').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/4-finance.png' });

  /* КП */
  await page.locator('[data-tab="proposal"]').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/5-proposal.png' });

  /* Проекты (модалка) */
  await page.locator('[data-tab="scheme"]').click();
  await page.waitForTimeout(400);
  await page.locator('#btnProjects').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/6-projects.png' });

  /* Варианты (сравнение) */
  await page.locator('#pr-close').click();
  await page.locator('[data-tab="variants"]').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/7-variants.png' });
});
