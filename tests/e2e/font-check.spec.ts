import { test } from '@playwright/test';

test('font loading check', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('woff') || req.url().includes('.woff2')) fontRequests.push(req.url());
  });
  const failed: string[] = [];
  page.on('requestfailed', (req) => failed.push(req.url()));

  await page.goto('https://jopaname.github.io/narozhnyy-soft/');
  await page.waitForSelector('#toolbar', { timeout: 15000 });
  await page.waitForTimeout(3000);

  const fontStatus = await page.evaluate(async () => {
    await document.fonts.ready;
    const check = (s: string) => document.fonts.check(s);
    return {
      manrope400: check('12px Manrope'),
      manrope700: check('700 12px Manrope'),
      manrope800: check('800 12px Manrope'),
      loadedFonts: Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => f.family),
      totalFonts: document.fonts.size,
      bodyFont: getComputedStyle(document.body).fontFamily,
      headerFont: getComputedStyle(document.querySelector('header div.font-extrabold')!).fontFamily,
      headerFontSize: getComputedStyle(document.querySelector('header div.font-extrabold')!).fontSize,
      headerFontWeight: getComputedStyle(document.querySelector('header div.font-extrabold')!).fontWeight,
    };
  });

  console.log('FONT REQUESTS:', JSON.stringify(fontRequests));
  console.log('FAILED REQUESTS:', JSON.stringify(failed));
  console.log('FONT STATUS:', JSON.stringify(fontStatus, null, 2));
});
