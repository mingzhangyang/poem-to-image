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

test('featured template gallery shows sample poetry and excludes legacy entries', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // The editor defaults to Playfair Display: only opening the expanded gallery
  // should request Cormorant Garamond used by the parchment sample.
  const sampleFontStylesheet = page.locator('link[data-editor-font="Cormorant Garamond"]');
  await expect(sampleFontStylesheet).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
  } else {
    await page.getByRole('button', { name: /^Templates/ }).click();
  }
  await page.getByRole('button', { name: /^More \(/ }).click();
  const library = page.getByRole('dialog', { name: 'Built-in Templates' });
  await expect(sampleFontStylesheet).toHaveCount(1);
  await expect(library).toBeVisible();
  await expect(library.getByRole('button', { name: /Bamboo Scroll/ })).toHaveCount(0);
  await expect(library.getByRole('button', { name: /Cyan Magenta Blocks/ })).toHaveCount(0);
  await expect(library.getByRole('button', { name: /Ink Pine Mist/ })).toHaveCount(0);
  const parchment = library.getByRole('button', { name: /Parchment Scroll/ });
  await expect(parchment).toBeVisible();
  const sample = parchment.getByTestId('template-preview-sample');
  await expect(sample).toBeVisible();
  await expect(sample).toContainText('Soft light');
});

test('an existing legacy template can still be recovered and shown as selected', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.active-template', 'bamboo-scroll');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
  } else {
    await page.getByRole('button', { name: /^Templates/ }).click();
  }
  const legacy = page.getByRole('button', { name: /^Bamboo Scroll/ });
  await expect(legacy).toBeVisible();
  await expect(legacy).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: /^More \(/ }).click();
  const library = page.getByRole('dialog', { name: 'Built-in Templates' });
  await expect(library.getByRole('button', { name: /Bamboo Scroll/ })).toHaveCount(0);
});
