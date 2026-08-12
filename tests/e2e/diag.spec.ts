import { test } from '@playwright/test';

test('diagnostic', async ({ page }) => {
  await page.goto('https://jopaname.github.io/narozhnyy-soft/');
  await page.waitForSelector('body', { timeout: 10000 });
  await page.waitForTimeout(2000);

  const diag = await page.evaluate(() => {
    const body = document.body;
    const cs = getComputedStyle(body);
    const b = body.getBoundingClientRect();

    /* Проверяем, какие стили реально применились */
    const testEl = document.createElement('div');
    testEl.className = 'bg-slate-950';
    testEl.style.position = 'fixed';
    testEl.style.width = '100px';
    testEl.style.height = '100px';
    testEl.style.top = '50px';
    testEl.style.left = '50px';
    testEl.style.zIndex = '99999';
    document.body.appendChild(testEl);
    const testBg = getComputedStyle(testEl).backgroundColor;

    /* Проверяем поддержку oklch */
    const supportsOklch = CSS.supports('color', 'oklch(0.5 0.1 200)');

    /* проверяем поддержку @layer */
    const supportsLayer = CSS.supports('@layer test { }');

    return {
      bodyBg: cs.backgroundColor,
      bodyDisplay: cs.display,
      bodyHeight: cs.height,
      bodyWidth: cs.width,
      bodyClass: body.className,
      testDivBg: testBg,
      supportsOklch,
      supportsLayer,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      bodyRect: { w: b.width, h: b.height },
    };
  });

  console.log(JSON.stringify(diag, null, 2));
  await page.screenshot({ path: 'test-results/diag.png' });
});
