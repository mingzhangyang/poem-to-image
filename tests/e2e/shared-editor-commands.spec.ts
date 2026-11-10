import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
});

test('editor lifecycle registers visibilitychange on the browser document', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /^Background/ })).toBeVisible();

  // Regression for a scene snapshot named "document" shadowing the DOM global.
  // This must not throw during mount or when the visibility event fires.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(errors).toEqual([]);
});

test('a multi-layer template command undoes and redoes before the history debounce', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Templates/ }).click();
  await page.getByRole('button', { name: /^More \(/ }).click();
  const library = page.getByRole('dialog', { name: 'Built-in Templates' });
  await library.getByRole('button', { name: /Song Floral/ }).click();
  const summary = page.getByRole('button', { name: /^Background/ });
  await expect(summary).toContainText('Templates');

  // The pending scene is undoable immediately, even before the 800ms timer
  // would normally enable the button. One action restores all template fields.
  const undo = page.getByRole('button', { name: 'Undo' });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(summary).toContainText('Solid');

  const redo = page.getByRole('button', { name: 'Redo' });
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(summary).toContainText('Templates');
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('inkpoem.editor-state.v1');
    return raw ? JSON.parse(raw).background.backgroundType : null;
  })).toBe('image');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /^Background/ })).toContainText('Templates');
});

test('rapid undo of a preset restores its identity and dimensions in saved document', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Canvas Size/ }).click();
  const selector = page.getByRole('combobox', { name: 'Preset Sizes' });
  const originalPreset = await selector.inputValue();
  const nextPreset = originalPreset === 'print-card' ? 'wechat-moments-long' : 'print-card';

  await selector.selectOption(nextPreset);
  await expect(selector).toHaveValue(nextPreset);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(selector).toHaveValue(originalPreset);

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(selector).toHaveValue(nextPreset);
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('inkpoem.editor-state.v1');
    return raw ? JSON.parse(raw).presetSize : null;
  })).toBe(nextPreset);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Canvas Size/ }).click();
  await expect(page.getByRole('combobox', { name: 'Preset Sizes' })).toHaveValue(nextPreset);
});
