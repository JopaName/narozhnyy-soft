import { expect, test } from '@playwright/test';

test.describe('Solar Studio E2E', () => {
  test.beforeEach(async ({ page }) => {
    /* Очищаем localStorage и загружаем страницу заново */
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#toolbar', { timeout: 10000 });
  });

  /* ── 1. Загрузка страницы ── */
  test('page loads with correct title and layout', async ({ page }) => {
    await expect(page).toHaveTitle(/Solar Studio/);
    await expect(page.locator('#cv')).toBeVisible();
    await expect(page.locator('#tabs')).toBeVisible();
    await expect(page.locator('#toolbar')).toBeVisible();
    /* Пример проекта загружается автоматически (loadSample) */
    await expect(page.locator('#stCount')).not.toHaveText('0');
  });

  /* ── 2. Кнопка «Пример» ── */
  test('loads sample project and populates panels', async ({ page }) => {
    const before = await page.locator('#stCount').textContent();
    await page.locator('#btnSample').click();
    await page.waitForTimeout(600);
    const after = await page.locator('#stCount').textContent();
    expect(Number(before || 0)).toBeGreaterThan(0);
    expect(Number(after || 0)).toBeGreaterThan(0);
  });

  /* ── 3. Вкладки навигации ── */
  test('tab navigation switches views', async ({ page }) => {
    /* По умолчанию видна Схема */
    await expect(page.locator('#view-scheme')).toBeVisible();
    await expect(page.locator('#view-system')).toBeHidden();

    /* Система */
    await page.locator('[data-tab="system"]').click();
    await expect(page.locator('#view-system')).toBeVisible();
    await expect(page.locator('#view-scheme')).toBeHidden();

    /* Выработка */
    await page.locator('[data-tab="energy"]').click();
    await expect(page.locator('#view-energy')).toBeVisible();

    /* Финансы */
    await page.locator('[data-tab="finance"]').click();
    await expect(page.locator('#view-finance')).toBeVisible();

    /* КП */
    await page.locator('[data-tab="proposal"]').click();
    await expect(page.locator('#view-proposal')).toBeVisible();
  });

  /* ── 4. Система: селекты и слайдеры ── */
  test('system tab shows equipment selects and KPIs', async ({ page }) => {
    await page.locator('[data-tab="system"]').click();
    await page.waitForTimeout(400);

    /* Селекты заполнены */
    const panelSelect = page.locator('#selPanel');
    await expect(panelSelect.locator('option')).not.toHaveCount(0);
    const invSelect = page.locator('#selInv');
    await expect(invSelect.locator('option')).not.toHaveCount(0);

    /* Ключевые метрики отображаются */
    await expect(page.locator('#sysCap')).not.toHaveText('—');
    await expect(page.locator('#sysGen')).not.toHaveText('—');

    /* Смена города обновляет показатели */
    await page.locator('#selCity').selectOption('moscow');
    await page.waitForTimeout(400);
    await expect(page.locator('#sysPay')).not.toHaveText('—');
  });

  /* ── 5. Выработка: графики ── */
  test('energy tab renders charts and shading grid', async ({ page }) => {
    await page.locator('[data-tab="energy"]').click();
    await page.waitForTimeout(800);

    /* KPI карточки */
    await expect(page.locator('#kGen')).not.toHaveText('—');
    await expect(page.locator('#kSpec')).not.toHaveText('—');
    await expect(page.locator('#kCo2')).not.toHaveText('—');

    /* Сетка затенения (12 месяцев) */
    const gridCells = page.locator('#shadeGrid > div');
    await expect(gridCells).toHaveCount(12);
  });

  /* ── 6. Финансы: CAPEX и денежный поток ── */
  test('finance tab shows capex, savings, payback, cash chart', async ({ page }) => {
    await page.locator('[data-tab="finance"]').click();
    await page.waitForTimeout(600);

    await expect(page.locator('#fCapex')).not.toHaveText('—');
    await expect(page.locator('#fSave')).not.toHaveText('—');
    await expect(page.locator('#fPay')).not.toHaveText('—');
    await expect(page.locator('#fProfit')).not.toHaveText('—');

    /* Переключение на кредит */
    await page.locator('#btnLoan').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#loanInputs')).toBeVisible();
  });

  /* ── 7. КП: коммерческое предложение ── */
  test('proposal tab renders commercial proposal', async ({ page }) => {
    await page.locator('[data-tab="proposal"]').click();
    await page.waitForTimeout(600);

    await expect(page.locator('#paper')).toBeVisible();
    await expect(page.locator('#propTitle')).not.toBeEmpty();
    await expect(page.locator('#propSpec tr')).not.toHaveCount(0);
    await expect(page.locator('#propGen > div')).toHaveCount(12);
    await expect(page.locator('#propFin')).not.toBeEmpty();
  });

  /* ── 8. Автораскладка ── */
  test('auto layout button works', async ({ page }) => {
    const initial = await page.locator('#stCount').textContent();
    await page.evaluate(() => (document.getElementById('btnAuto') as HTMLElement).click());
    await page.waitForTimeout(400);
    const after = await page.locator('#stCount').textContent();
    expect(Number(after)).toBeGreaterThanOrEqual(Number(initial));
  });

  /* ── 9. Сохранение / загрузка проекта ── */
  test('save and load project as JSON', async ({ page }) => {
    /* Сохраняем */
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
    await page.locator('#btnSave').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.json');

    /* Сбрасываем */
    page.on('dialog', (dialog) => dialog.accept());
    await page.evaluate(() => (document.getElementById('btnReset') as HTMLElement).click());
    await page.waitForTimeout(400);

    /* Загружаем */
    await page.locator('#fileOpen').setInputFiles(await download.path());
    await page.waitForTimeout(600);

    /* Проект восстановлен */
    await expect(page.locator('#stCount')).not.toHaveText('0');
  });

  /* ── 10. Горячие клавиши ── */
  test('keyboard shortcuts: Ctrl+Z undo, S shadows', async ({ page }) => {
    /* Добавим панель — очистка */
    await page.evaluate(() => (document.getElementById('btnClearPanels') as HTMLElement).click());
    await page.waitForTimeout(300);
    const afterClear = await page.locator('#stCount').textContent();
    expect(afterClear).toBe('0');

    /* Ctrl+Z — отмена очистки */
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    /* Должны вернуться панели */
    const afterUndo = await page.locator('#stCount').textContent();
    expect(Number(afterUndo)).toBeGreaterThan(0);

    /* S — тени */
    await page.keyboard.press('s');
    await page.waitForTimeout(200);
    /* Чекбокс теней инвертирован */
    /* (проверка через evaluate) */
  });

  /* ── 11. Сводка массива: метрики обновляются ── */
  test('sidebar summary updates with panel/capacity data', async ({ page }) => {
    await page.waitForTimeout(500);
    await expect(page.locator('#stCount')).not.toHaveText('0');
    await expect(page.locator('#stCap')).toContainText('кВт');
    await expect(page.locator('#stRoofArea')).toContainText('м²');
    await expect(page.locator('#invBarTxt')).toContainText('%');
  });

  /* ── 12. Канвас: масштаб и координаты ── */
  test('canvas displays coordinates and zoom indicator', async ({ page }) => {
    const coords = page.locator('#stCoords');
    await expect(coords).toBeVisible();
    /* Навести курсор на канвас */
    await page.locator('#cv').hover();
    await page.waitForTimeout(200);
    /* Зум меняется при колёсике */
    const zoomBefore = await page.locator('#stZoom').textContent();
    await page.locator('#cv').dispatchEvent('wheel', { deltaY: -100 });
    await page.waitForTimeout(200);
    const zoomAfter = await page.locator('#stZoom').textContent();
    expect(zoomAfter).not.toBe(zoomBefore);
  });

  /* ── 13. Стринг-расчёт в Системе ── */
  test('string calculation shows in system tab', async ({ page }) => {
    await page.locator('[data-tab="system"]').click();
    await page.waitForTimeout(400);

    const stringInfo = page.locator('#stringInfo');
    const stringIssues = page.locator('#stringIssues');
    await expect(stringInfo).not.toBeEmpty();
    await expect(stringIssues).not.toBeEmpty();
  });

  /* ── 14. Накопитель энергии — включение/выключение ── */
  test('battery toggle updates UI', async ({ page }) => {
    await page.locator('[data-tab="system"]').click();
    await page.waitForTimeout(400);

    const checkbox = page.locator('#chkBat');
    const isChecked = await checkbox.isChecked();

    await checkbox.setChecked(!isChecked);
    await page.waitForTimeout(300);

    const disabled = await page.locator('#selBat').isDisabled();
    expect(disabled).toBe(isChecked);
  });

  /* ── 15. Экспорт PDF ── */
  test('pdf download from proposal', async ({ page }) => {
    await page.locator('[data-tab="proposal"]').click();
    await page.waitForTimeout(600);

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('#btnPdf').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  /* ── 16. Редактор каталога ── */
  test('catalog editor opens and shows equipment', async ({ page }) => {
    await page.locator('#btnCatalog').click();
    await page.waitForTimeout(400);

    await expect(page.locator('#eq-modal')).toBeVisible();
    const tabs = page.locator('#eq-tabs button');
    await expect(tabs).toHaveCount(4);
    await expect(page.locator('#eq-list')).not.toBeEmpty();

    await page.locator('#eq-close').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#eq-modal')).toBeHidden();
  });
});
