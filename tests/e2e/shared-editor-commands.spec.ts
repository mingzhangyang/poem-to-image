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

test('reverted border edits do not create duplicate history or suppress the next real edit', async ({ page }) => {
  await page.clock.install();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Decorations/ }).click();

  const border = page.getByRole('checkbox', { name: /Border/i });
  const undo = page.getByRole('button', { name: 'Undo' });
  const redo = page.getByRole('button', { name: 'Redo' });
  await expect(border).not.toBeChecked();
  await expect(undo).toBeDisabled();

  await page.clock.pauseAt(Date.now() + 5_000);
  await border.evaluate((element) => (element as HTMLInputElement).click());
  await expect(border).toBeChecked();
  await border.evaluate((element) => (element as HTMLInputElement).click());
  await expect(border).not.toBeChecked();
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  // Even after the original 800ms deadline, A -> B -> A is not a history step.
  await page.clock.runFor(900);
  await expect(undo).toBeDisabled();

  // A genuine edit must remain undoable, and branching must invalidate Redo.
  await border.evaluate((element) => (element as HTMLInputElement).click());
  await expect(undo).toBeEnabled();
  await undo.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(border).not.toBeChecked();
  await expect(redo).toBeEnabled();

  // A temporary divergence that returns to the active history snapshot must
  // preserve the redo branch; only a committed new edit should invalidate it.
  await border.evaluate((element) => (element as HTMLInputElement).click());
  await expect(redo).toBeDisabled();
  await border.evaluate((element) => (element as HTMLInputElement).click());
  await expect(redo).toBeEnabled();
  await redo.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(border).toBeChecked();
  await undo.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(border).not.toBeChecked();

  // A new branch must hide the now-obsolete redo and remain undoable.
  await border.evaluate((element) => (element as HTMLInputElement).click());
  await expect(redo).toBeDisabled();
  await undo.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(border).not.toBeChecked();
  await page.clock.resume();
});

test('a multi-layer template command undoes and redoes before the history debounce', async ({ page }) => {
  await page.clock.install();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Templates/ }).click();
  await page.getByRole('button', { name: /^More \(/ }).click();
  const library = page.getByRole('dialog', { name: 'Built-in Templates' });
  // Freeze the 800ms debounce; polling cannot mask missing immediate-Undo support.
  // Native DOM click avoids Playwright actionability's animation-frame wait while paused.
  await page.clock.pauseAt(Date.now() + 5_000);
  await library.getByRole('button', { name: /Song Floral/ }).evaluate((element) => (element as HTMLButtonElement).click());
  const summary = page.getByRole('button', { name: /^Background/ });
  await expect(summary).toContainText('Templates');

  // The pending scene is undoable immediately, even before the 800ms timer
  // would normally enable the button. One action restores all template fields.
  const undo = page.getByRole('button', { name: 'Undo' });
  await expect(undo).toBeEnabled();
  await undo.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(summary).toContainText('Solid');

  const redo = page.getByRole('button', { name: 'Redo' });
  await expect(redo).toBeEnabled();
  await redo.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(summary).toContainText('Templates');
  await page.clock.resume();
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('inkpoem.editor-state.v1');
    return raw ? JSON.parse(raw).background.backgroundType : null;
  })).toBe('image');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /^Background/ })).toContainText('Templates');
});

test('rapid undo of a preset restores its identity and dimensions in saved document', async ({ page }) => {
  await page.clock.install();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Canvas Size/ }).click();
  const selector = page.getByRole('combobox', { name: 'Preset Sizes' });
  const originalPreset = await selector.inputValue();
  const nextPreset = originalPreset === 'print-card' ? 'wechat-moments-long' : 'print-card';

  await page.clock.pauseAt(Date.now() + 5_000);
  await selector.selectOption(nextPreset);
  await expect(selector).toHaveValue(nextPreset);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo' }).evaluate((element) => (element as HTMLButtonElement).click());
  await expect(selector).toHaveValue(originalPreset);

  await page.getByRole('button', { name: 'Redo' }).evaluate((element) => (element as HTMLButtonElement).click());
  await expect(selector).toHaveValue(nextPreset);
  await page.clock.resume();
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('inkpoem.editor-state.v1');
    return raw ? JSON.parse(raw).presetSize : null;
  })).toBe(nextPreset);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Canvas Size/ }).click();
  await expect(page.getByRole('combobox', { name: 'Preset Sizes' })).toHaveValue(nextPreset);
});
