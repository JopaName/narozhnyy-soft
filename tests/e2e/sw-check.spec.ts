import { test } from '@playwright/test';

test('service worker cache behavior', async ({ page }) => {
  /* Первый визит — SW устанавливается */
  await page.goto('https://jopaname.github.io/narozhnyy-soft/');
  await page.waitForSelector('#toolbar', { timeout: 15000 });
  await page.waitForTimeout(3000);

  const afterFirstLoad = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return {
      bg: cs.backgroundColor,
      display: cs.display,
      swControlled: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
      html: document.documentElement.outerHTML.slice(0, 1000),
    };
  });

  /* Второй визит — SW активен, обслуживает из кеша */
  await page.reload();
  await page.waitForSelector('#toolbar', { timeout: 15000 });
  await page.waitForTimeout(2000);

  const afterReload = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return {
      bg: cs.backgroundColor,
      display: cs.display,
      swControlled: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
      cssLinks: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => (l as HTMLLinkElement).href),
    };
  });

  console.log('AFTER FIRST LOAD:', JSON.stringify(afterFirstLoad, null, 2));
  console.log('AFTER RELOAD:', JSON.stringify(afterReload, null, 2));
});
