import { test } from '@playwright/test';

test('screenshot all tabs', async ({ page }) => {
  await page.goto('https://jopaname.github.io/narozhnyy-soft/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#toolbar', { timeout: 15000 });
  await page.waitForTimeout(2000);

  const tabs = ['scheme', 'system', 'energy', 'finance', 'proposal'];
  for (const tab of tabs) {
    await page.locator(`[data-tab="${tab}"]`).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `test-results/tab-${tab}.png` });
  }
});
