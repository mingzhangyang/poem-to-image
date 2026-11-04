import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
});

test('graceful whitespace is selectable, uses ivory paper, and survives reload', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;
  await page.getByRole('button', { name: mobile ? 'Templates' : /^Templates/ }).click();
  await page.getByRole('button', { name: /^More \(/ }).click();

  const library = page.getByRole('dialog', { name: 'Built-in Templates' });
  await expect(library).toBeVisible();
  const card = library.getByRole('button', { name: /Graceful Whitespace/ });
  await expect(card).toBeVisible();
  await expect(card.locator('img')).toHaveAttribute('src', '/template-previews/graceful-whitespace.svg');
  await card.click();
  await expect(library).toBeHidden();

  // Check actual canvas rendering rather than only the saved showStamp flag.
  const seal = page.getByLabel('Stamp element');
  await expect(seal).toBeVisible();
  const sealCanvas = seal.locator('canvas');
  await expect.poll(async () => sealCanvas.evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) return false;
    const ctx = element.getContext('2d');
    if (!ctx) return false;
    const pixels = ctx.getImageData(0, 0, element.width, element.height).data;
    return pixels.some((channel, index) => index % 4 === 3 && channel > 0);
  })).toBe(true);

  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return [
      state?.background?.backgroundType,
      state?.background?.paperId,
      state?.decorations?.showBorder,
      state?.decorations?.showStamp,
      state?.typography?.writingMode,
    ];
  })).toEqual(['paper', 'ivory', false, true, 'horizontal-tb']);

  await page.reload({ waitUntil: 'domcontentloaded' });
  if (mobile) {
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
  } else {
    await page.getByRole('button', { name: /^Templates/ }).click();
  }
  await page.getByRole('button', { name: /^More \(/ }).click();
  const restored = page.getByRole('dialog', { name: 'Built-in Templates' })
    .getByRole('button', { name: /Graceful Whitespace/ });
  await expect(restored).toHaveAttribute('aria-pressed', 'true');
});

test('saving as a custom template preserves the non-CJK seal in preview and after reload', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;

  await page.getByRole('button', { name: mobile ? 'Templates' : /^Templates/ }).click();
  await page.getByRole('button', { name: /^More \(/ }).click();
  const library = page.getByRole('dialog', { name: 'Built-in Templates' });
  await library.getByRole('button', { name: /Graceful Whitespace/ }).click();
  await expect(library).toBeHidden();

  const seal = page.getByLabel('Stamp element');
  await expect(seal).toBeVisible();

  await page.getByRole('button', { name: 'Save as Template' }).click();
  await page.getByPlaceholder('Template name...').fill('Graceful Copy');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // Guest templates live in localStorage; the flag must be part of the
  // serializable stamp, not just the now-cleared built-in template selection.
  await expect.poll(() => page.evaluate(() => {
    const copies = JSON.parse(localStorage.getItem('poem-to-image.custom-templates') || '[]');
    return copies.find((copy: { name: string }) => copy.name === 'Graceful Copy')?.decorations?.stamp?.allowNonCjk;
  })).toBe(true);
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem('poem-to-image.active-template'),
  )).toBe(null);
  await expect(seal).toBeVisible();

  // Switching to another preset must not leak the non-CJK permission.
  await page.getByRole('button', { name: /^More \(/ }).click();
  await page.getByRole('dialog', { name: 'Built-in Templates' })
    .getByRole('button', { name: /Modern Minimal/ }).click();
  await expect(seal).toHaveCount(0);

  // Reapply the saved copy: it should render its seal even with no built-in ID.
  const savedName = page.getByText('Graceful Copy', { exact: true }).and(page.locator(':visible'));
  await savedName.locator('xpath=../..').getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(seal).toBeVisible();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(seal).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return [draft?.decorations?.showStamp, draft?.decorations?.stamp?.allowNonCjk];
  })).toEqual([true, true]);
});
