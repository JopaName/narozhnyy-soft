import { test } from '@playwright/test';

test('layout analysis', async ({ page }) => {
  await page.goto('https://jopaname.github.io/narozhnyy-soft/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#toolbar', { timeout: 15000 });
  await page.waitForTimeout(2000);

  const metrics = await page.evaluate(() => {
    const rect = (id: string) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const cs = (id: string, prop: string) => {
      const el = document.getElementById(id);
      return el ? getComputedStyle(el).getPropertyValue(prop) : 'MISSING';
    };
    const qrect = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      bodyScrollW: document.body.scrollWidth,
      bodyClientW: document.body.clientWidth,
      docScrollW: document.documentElement.scrollWidth,
      hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      header: qrect('header'),
      main: qrect('main'),
      toolbar: rect('toolbar'),
      canvasWrap: rect('canvasWrap'),
      cv: rect('cv'),
      sidebar: qrect('aside'),
      statusBar: qrect('#canvasWrap > div.absolute.bottom-0'),
      tabs: rect('tabs'),
      emptyState: rect('emptyState'),
      bodyDisplay: getComputedStyle(document.body).display,
      mainDisplay: qrect('main') ? getComputedStyle(document.querySelector('main')!).display : '?',
      mainFlexDir: getComputedStyle(document.querySelector('main')!).flexDirection,
      schemeDisplay: getComputedStyle(document.getElementById('view-scheme')!).display,
      schemeFlexDir: getComputedStyle(document.getElementById('view-scheme')!).flexDirection,
      sidebarW: getComputedStyle(document.querySelector('aside')!).width,
      toolbarW: getComputedStyle(document.getElementById('toolbar')!).width,
      headerH: getComputedStyle(document.querySelector('header')!).height,
      statusBarH: (() => {
        const el = document.querySelector('#canvasWrap > div.absolute.bottom-0');
        return el ? getComputedStyle(el).height : '?';
      })(),
      fontSizeBody: getComputedStyle(document.body).fontSize,
      fontFamily: getComputedStyle(document.body).fontFamily,
      bgBody: getComputedStyle(document.body).backgroundColor,
      /* Canvas content — sample pixels */
      canvasPixels: (() => {
        const cv = document.getElementById('cv') as HTMLCanvasElement;
        if (!cv) return null;
        const ctx = cv.getContext('2d');
        const w = cv.width, h = cv.height;
        const points = [
          [w / 2, h / 2],
          [w / 4, h / 4],
          [3 * w / 4, 3 * h / 4],
        ];
        return points.map(([x, y]) => {
          const d = ctx!.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
          return [d[0], d[1], d[2]];
        });
      })(),
    };
  });

  console.log(JSON.stringify(metrics, null, 2));
  await page.screenshot({ path: 'test-results/layout-analysis.png', fullPage: false });
});
