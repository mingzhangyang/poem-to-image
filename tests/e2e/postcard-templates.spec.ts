import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });
});

test('postcard gallery artwork loads and the edited postcard survives reload and PNG export', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const isMobile = (page.viewportSize()?.width ?? 0) < 1024;
  const templatesButton = page.getByRole('button', {
    name: isMobile ? 'Templates' : /^Templates/, exact: isMobile,
  });
  if (await templatesButton.getAttribute('aria-expanded') !== 'true') await templatesButton.click();
  await page.getByRole('button', { name: /^More \(/ }).click();
  const library = page.getByRole('dialog', { name: 'Built-in Templates' });

  for (const name of ['Vintage Travel Postcard', 'Poetry Postcard', 'Botanical Postcard']) {
    const card = library.getByRole('button', { name: new RegExp(name) });
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveCount(1);
    await expect.poll(() => card.locator('img').evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
    )).toBe(true);
  }

  await library.getByRole('button', { name: /Vintage Travel Postcard/ }).click();
  await expect(library).toBeHidden();
  const expected = '/template-backgrounds/postcard-vintage-travel.svg';
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return [draft?.background?.backgroundImage, draft?.background?.backgroundSize];
  })).toEqual([expected, 'stretch']);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-export-layer="background"]').first()).toHaveCSS('background-size', '100% 100%');
  await page.getByRole('button', { name: isMobile ? 'Export' : 'Export Image', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export Image' });
  const download = page.waitForEvent('download', { timeout: 30_000 });
  await dialog.getByRole('button', { name: 'Copy image' }).click();
  const data = await readFile(await (await download).path());
  expect(data.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(data.length).toBeGreaterThan(100_000);
});
