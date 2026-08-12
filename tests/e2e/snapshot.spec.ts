import { test } from '@playwright/test';

test('snapshot', async ({ page }) => {
  await page.goto('https://jopaname.github.io/narozhnyy-soft/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#toolbar', { timeout: 15000 });
  await page.waitForTimeout(2000);

  /* Скриншот */
  await page.screenshot({ path: 'test-results/live-screenshot.png', fullPage: false });

  /* Дамп ключевых элементов */
  const info = await page.evaluate(() => ({
    stCount: document.getElementById('stCount')?.textContent,
    stCap: document.getElementById('stCap')?.textContent,
    emptyState: document.getElementById('emptyState')?.style.display,
    canvasW: (document.getElementById('cv') as HTMLCanvasElement)?.width,
    canvasH: (document.getElementById('cv') as HTMLCanvasElement)?.height,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    headerText: document.querySelector('header .font-extrabold')?.textContent,
    fontLoaded: (document as any).fonts?.check?.('12px Manrope'),
    roofPts: document.querySelectorAll('#cv + div')?.length,
  }));
  console.log('=== PAGE INFO ===');
  console.log(JSON.stringify(info, null, 2));

  /* Сколько панелей видно */
  const panels = await page.locator('#stCount').textContent();
  console.log('Panels visible:', panels);

  /* CSS-классы body */
  const bodyClass = await page.locator('body').getAttribute('class');
  console.log('Body classes:', bodyClass);
});
