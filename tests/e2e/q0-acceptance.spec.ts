import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// Q0 is a post-merge acceptance suite. Never call AI or paid checkout services.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    if (!window.localStorage.getItem('poem-to-image.language')) window.localStorage.setItem('poem-to-image.language', 'en');
  });
});

test('all nine export format and scale combinations produce correctly sized, uniquely named images', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Run the full export matrix once per CI run');
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Chromium exposes a native file picker; disable it for the download-path
  // matrix so the test checks the actual fallback file, not a headless picker.
  await page.addInitScript(() => {
    let current: object | null = window;
    while (current) {
      if (Object.prototype.hasOwnProperty.call(current, 'showSaveFilePicker')) {
        Reflect.deleteProperty(current, 'showSaveFilePicker');
      }
      current = Object.getPrototypeOf(current);
    }
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => 'showSaveFilePicker' in window)).toBe(false);

  await page.getByRole('button', { name: 'Open Editor' }).click();
  const editor = page.getByRole('dialog', { name: 'Poem Editor' });
  await editor.getByPlaceholder('Title').fill('Q0 Export Poem');
  await editor.getByPlaceholder('Enter your poem here...').fill('A quiet sky\nAbove a river');
  await editor.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: /^Canvas Size/ }).click();
  await page.getByRole('combobox', { name: 'Preset Sizes' }).selectOption('custom');
  await page.getByRole('spinbutton', { name: 'Width (px)' }).fill('160');
  await page.getByRole('spinbutton', { name: 'Height (px)' }).fill('200');
  await expect(page.getByRole('spinbutton', { name: 'Width (px)' })).toHaveValue('160');
  await expect(page.getByRole('spinbutton', { name: 'Height (px)' })).toHaveValue('200');

  const filenames = new Set<string>();
  for (const format of ['png', 'jpg', 'webp'] as const) {
    for (const scale of [1, 2, 3] as const) {
      await page.getByRole('button', { name: 'Export Image' }).click();
      const dialog = page.getByRole('dialog', { name: 'Export Image' });
      await dialog.getByLabel('Export Format').selectOption(format);
      await dialog.getByLabel('Export Quality').selectOption(String(scale));
      const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
      await dialog.getByRole('button', { name: 'Save Image' }).click();
      const download = await downloadPromise;
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/^Q0-Export-Poem-\d{8}-\d{6}-\d{3}\.(png|jpg|webp)$/);
      expect(filename.endsWith('.' + format)).toBe(true);
      expect(filenames.has(filename), 'Export filename must not repeat: ' + filename).toBe(false);
      filenames.add(filename);

      const data = await readFile(await download.path());
      expect(data.byteLength).toBeGreaterThan(100);
      if (format === 'png') {
        expect([...data.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      } else if (format === 'jpg') {
        expect([...data.subarray(0, 2)]).toEqual([255, 216]);
      } else {
        expect(data.toString('ascii', 0, 4)).toBe('RIFF');
        expect(data.toString('ascii', 8, 12)).toBe('WEBP');
      }
      const size = await page.evaluate(async ({ base64, format }) => {
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/' + format;
        const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }));
        const dimensions = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return dimensions;
      }, { base64: data.toString('base64'), format });
      expect(size, 'Unexpected dimensions for ' + format + ' at ' + scale + 'x').toEqual({
        width: 160 * scale,
        height: 200 * scale,
      });
    }
  }
  expect(filenames.size).toBe(9);
});

const localeMatrix = [
  { code: 'en', button: 'English', settings: 'Settings', language: 'Language', canvas: 'Canvas Size', quick: 'Quick platform presets', presets: 'Preset Sizes', print: 'Print' },
  { code: 'zh-CN', button: '简体中文', settings: '设置', language: '语言', canvas: '画布尺寸', quick: '常用平台尺寸', presets: '预设尺寸', print: '打印' },
  { code: 'zh-TW', button: '繁體中文', settings: '設定', language: '語言', canvas: '畫布尺寸', quick: '常用平台尺寸', presets: '預設尺寸', print: '列印' },
  { code: 'ja', button: '日本語', settings: '設定', language: '言語', canvas: 'キャンバスサイズ', quick: 'プラットフォーム別クイック設定', presets: 'プリセットサイズ', print: '印刷' },
  { code: 'ko', button: '한국어', settings: '설정', language: '언어', canvas: '캔버스 크기', quick: '플랫폼별 빠른 크기', presets: '사전 설정 크기', print: '인쇄' },
  { code: 'es', button: 'Español', settings: 'Ajustes', language: 'Idioma', canvas: 'Tamaño del lienzo', quick: 'Formatos rápidos por plataforma', presets: 'Tamaños predefinidos', print: 'Impresión' },
  { code: 'fr', button: 'Français', settings: 'Paramètres', language: 'Langue', canvas: 'Taille de la toile', quick: 'Formats rapides par plateforme', presets: 'Tailles prédéfinies', print: 'Impression' },
  { code: 'de', button: 'Deutsch', settings: 'Einstellungen', language: 'Sprache', canvas: 'Leinwandgröße', quick: 'Schnelle Plattformformate', presets: 'Voreingestellte Größen', print: 'Druck' },
] as const;

test('all eight languages localize canvas controls and survive reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Run the eight-language walkthrough once');
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();

  for (const locale of localeMatrix) {
    await page.getByRole('button', { name: locale.button, exact: true }).click();
    await expect(page.getByText(locale.language, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: locale.settings, exact: true }).click();

    const quickLabel = page.getByText(locale.quick, { exact: true });
    if (!(await quickLabel.isVisible())) {
      await page.getByRole('button', { name: new RegExp('^' + locale.canvas) }).click();
    }
    await expect(quickLabel).toBeVisible();
    const select = page.getByRole('combobox', { name: locale.presets, exact: true });
    await expect(select).toBeVisible();
    await expect(select.locator('optgroup').nth(3)).toHaveAttribute('label', locale.print);
    await page.getByRole('button', { name: locale.settings, exact: true }).click();
  }

  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('poem-to-image.language'))).toBe('de');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Einstellungen', exact: true })).toBeVisible();
});

test('canvas preset identity restores through undo, redo and reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Run history acceptance once');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Canvas Size/ }).click();
  const presets = page.getByRole('combobox', { name: 'Preset Sizes' });
  await presets.selectOption('wechat-moments-long');
  await page.waitForTimeout(950);
  await presets.selectOption('print-card');
  await page.waitForTimeout(950);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(presets).toHaveValue('wechat-moments-long');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(presets).toHaveValue('print-card');
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Canvas Size/ }).click();
  await expect(page.getByRole('combobox', { name: 'Preset Sizes' })).toHaveValue('print-card');
});

test('guest AI generation remains gated without invoking a paid endpoint', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Run auth boundary acceptance once');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const attempts: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/ai-background') attempts.push(request.url());
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Background/ }).click();
  await page.getByRole('button', { name: 'AI', exact: true }).click();
  await expect(page.getByRole('button', { name: /Generate AI Background/ })).toBeDisabled();
  await expect(page.getByText('Please sign in to use AI generation.')).toBeVisible();
  expect(attempts).toEqual([]);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 1440, height: 900 }]) {
  test('first-visit onboarding CTA opens the editor at ' + viewport.width + 'px', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'One explicit new context per viewport');
    const context = await browser.newContext({ viewport });
    try {
      const page = await context.newPage();
      await page.route('**/api/billing/packages', async (route) => {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
      });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const onboarding = page.locator('[role="dialog"][aria-labelledby="onboarding-modal-title"]');
      await expect(onboarding).toBeVisible();
      if (viewport.width < 1024) {
        await onboarding.getByRole('button', { name: 'Next' }).click();
      }
      await onboarding.getByRole('button', { name: "Got it, let's start" }).click();
      await expect(onboarding).toBeHidden();
      await expect(page.getByRole('dialog', { name: 'Poem Editor' })).toBeVisible();
    } finally {
      await context.close();
    }
  });
}

test('applied template appearance and poem content survive reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Run built-in template persistence once');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Templates/ }).click();
  const template = page.getByRole('button', { name: /Parchment Scroll/ }).first();
  await template.click();
  await expect(template).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('poem-to-image.active-template')))
    .toBe('parchment-scroll');

  await page.getByRole('button', { name: 'Open Editor' }).click();
  const editor = page.getByRole('dialog', { name: 'Poem Editor' });
  await editor.getByPlaceholder('Title').fill('Q0 Persisted Poem');
  await editor.getByPlaceholder('Enter your poem here...').fill('A paper sky\nA careful line');
  await editor.getByRole('button', { name: 'Done' }).click();

  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem('inkpoem.editor-state.v1');
    const state = raw ? JSON.parse(raw) : null;
    return {
      title: state?.poem?.title,
      body: state?.poem?.body,
      backgroundImage: state?.background?.backgroundImage,
    };
  })).toEqual({
    title: 'Q0 Persisted Poem',
    body: 'A paper sky\nA careful line',
    backgroundImage: '/template-backgrounds/parchment-scroll-generated.png',
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Body').getByText('Q0 Persisted Poem')).toBeVisible();
  await page.getByRole('button', { name: /^Templates/ }).click();
  await expect(page.getByRole('button', { name: /Parchment Scroll/ }).first()).toHaveAttribute('aria-pressed', 'true');
});
