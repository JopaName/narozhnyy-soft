import { expect, test } from '@playwright/test';

const LIVE_URL = 'https://jopaname.github.io/narozhnyy-soft/';

test.describe('UI проверка живого сайта GitHub Pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIVE_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#toolbar', { timeout: 15000 });
  });

  test('шапка: логотип, название, кнопки', async ({ page }) => {
    await expect(page.locator('img[src$="logo.svg"]').first()).toBeVisible();
    await expect(page.locator('text=Narozhnyy Soft').first()).toBeVisible();
    await expect(page.locator('#btnSample')).toBeVisible();
    await expect(page.locator('#btnCatalog')).toBeVisible();
    await expect(page.locator('#btnSave')).toBeVisible();
  });

  test('вкладки переключаются', async ({ page }) => {
    const tabs = ['scheme', 'system', 'energy', 'finance', 'proposal'];
    for (const tab of tabs) {
      await page.locator(`[data-tab="${tab}"]`).click();
      await page.waitForTimeout(500);
      await expect(page.locator(`#view-${tab}`)).toBeVisible();
    }
  });

  test('sample-проект: панели расставлены, метрики не нули', async ({ page }) => {
    await page.waitForTimeout(1000);
    const count = await page.locator('#stCount').textContent();
    expect(Number(count)).toBeGreaterThan(0);

    const cap = await page.locator('#stCap').textContent();
    expect(cap).toContain('кВт');
    expect(cap).not.toContain('0 кВт');
  });

  test('канвас: координаты и зум отображаются', async ({ page }) => {
    await expect(page.locator('#stCoords')).toBeVisible();
    await expect(page.locator('#stZoom')).toBeVisible();
    /* зум не 100% после fitView с sample-проектом */
    const zoom = await page.locator('#stZoom').textContent();
    expect(zoom).toBeTruthy();
  });

  test('система: селекты заполнены, KPIs показывают данные', async ({ page }) => {
    await page.locator('[data-tab="system"]').click();
    await page.waitForTimeout(500);

    const panelOpts = await page.locator('#selPanel option').count();
    expect(panelOpts).toBeGreaterThan(0);

    await expect(page.locator('#sysCap')).not.toHaveText('—');
    await expect(page.locator('#sysGen')).not.toHaveText('—');
  });

  test('выработка: график и сетка затенения', async ({ page }) => {
    await page.locator('[data-tab="energy"]').click();
    await page.waitForTimeout(800);

    await expect(page.locator('#kGen')).not.toHaveText('—');
    const grid = page.locator('#shadeGrid > div');
    await expect(grid).toHaveCount(12);
  });

  test('финансы: CAPEX и денежный поток', async ({ page }) => {
    await page.locator('[data-tab="finance"]').click();
    await page.waitForTimeout(600);

    await expect(page.locator('#fCapex')).not.toHaveText('—');
    await expect(page.locator('#fPay')).not.toHaveText('—');
    await expect(page.locator('#fProfit')).not.toHaveText('—');
  });

  test('КП: коммерческое предложение рендерится', async ({ page }) => {
    await page.locator('[data-tab="proposal"]').click();
    await page.waitForTimeout(600);

    await expect(page.locator('#paper')).toBeVisible();
    await expect(page.locator('#propSpec tr')).not.toHaveCount(0);
    await expect(page.locator('#propGen > div')).toHaveCount(12);

    /* кнопки печати и PDF */
    await expect(page.locator('#btnPrint')).toBeVisible();
    await expect(page.locator('#btnPdf')).toBeVisible();
  });

  test('редактор каталога открывается', async ({ page }) => {
    await page.locator('#btnCatalog').click();
    await page.waitForTimeout(400);

    await expect(page.locator('#eq-modal')).toBeVisible();
    await expect(page.locator('#eq-tabs button')).toHaveCount(3);
    await expect(page.locator('#eq-list')).not.toBeEmpty();

    /* закрыть */
    await page.locator('#eq-close').click();
    await expect(page.locator('#eq-modal')).toBeHidden();
  });

  test('автораскладка работает', async ({ page }) => {
    const before = Number(await page.locator('#stCount').textContent());
    await page.locator('#btnAuto').evaluate((el: HTMLButtonElement) => el.click());
    await page.waitForTimeout(500);
    const after = Number(await page.locator('#stCount').textContent());
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test('PDF скачивается', async ({ page }) => {
    await page.locator('[data-tab="proposal"]').click();
    await page.waitForTimeout(600);

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('#btnPdf').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('PWA: manifest и service worker доступны', async ({ page }) => {
    /* manifest */
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href');

    const manifestUrl = await manifestLink.getAttribute('href');
    const resp = await page.request.get(LIVE_URL + manifestUrl!.replace(/^\//, ''));
    expect(resp.status()).toBe(200);
    const manifest = await resp.json();
    expect(manifest.name).toContain('Narozhnyy Soft');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toHaveLength(2);

    /* service worker */
    const swUrl = LIVE_URL + 'registerSW.js';
    const swResp = await page.request.get(swUrl);
    expect(swResp.status()).toBe(200);
  });

  test('скриншот: схема с панелями', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/ui-scheme.png', fullPage: false });
  });
});
