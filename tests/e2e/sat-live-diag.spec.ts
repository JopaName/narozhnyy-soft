import { test } from '@playwright/test';

test('diag live satellite', async ({ page }) => {
  const reqs: string[] = [];
  const fails: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('nominatim') || r.url().includes('arcgisonline')) reqs.push(r.url().slice(0, 110));
  });
  page.on('requestfailed', (r) => fails.push(r.url().slice(0, 110) + ' :: ' + (r.failure()?.errorText || '?')));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE ERR:', m.text().slice(0, 200));
  });

  await page.goto('http://localhost:5173');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5173');
  await page.waitForSelector('#toolbar', { timeout: 15000 });

  await page.locator('#inAddr').fill('Геленджик, ул Десантная 44б');
  await page.locator('#btnSat').click();

  /* следим за тостами */
  await page.waitForTimeout(15000);

  console.log('REQUESTS:', reqs.length);
  reqs.slice(0, 5).forEach((r) => console.log('  REQ:', r));
  console.log('FAILED:', fails.length);
  fails.forEach((f) => console.log('  FAIL:', f));
  const toastText = await page.locator('#toast').textContent();
  console.log('TOAST:', toastText);
});
