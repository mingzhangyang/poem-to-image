import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const designs = [
  ['Bluebird Manuscript', 'bluebird-manuscript'],
  ['Blue Meadow Manuscript', 'blue-meadow-manuscript'],
  ['Blue Butterfly Manuscript', 'blue-butterfly-manuscript'],
] as const;

async function openLibrary(page: Page) {
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;
  const button = page.getByRole('button', { name: mobile ? 'Templates' : /^Templates/, exact: mobile });
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
  await page.getByRole('button', { name: /^More \(/ }).click();
  return page.getByRole('dialog', { name: 'Built-in Templates' });
}

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

test('each blue manuscript can be applied and remains selected after reload', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  for (const [name, id] of designs) {
    const library = await openLibrary(page);
    const card = library.getByRole('button', { name: new RegExp(name) });
    await expect(card).toHaveCount(1);
    const image = card.locator('img');
    await card.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    await card.click();
    await expect(library).toBeHidden();
    await expect.poll(() => page.evaluate(() => {
      const draft = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
      return [draft?.background?.backgroundImage, draft?.background?.backgroundSize, draft?.typography?.textColor];
    })).toEqual([`/template-backgrounds/${id}.webp`, 'stretch', '#162d4c']);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const layer = page.locator('[data-export-layer="background"]').first();
    await expect(layer).toHaveCSS('background-size', '100% 100%');
    await expect(layer).toHaveCSS('background-image', new RegExp(`${id}\\.webp`));
  }
});

test('a blue manuscript exports as a PNG', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const library = await openLibrary(page);
  await library.getByRole('button', { name: /Bluebird Manuscript/ }).click();
  await expect(library).toBeHidden();
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;
  if (mobile) {
    const drawer = page.getByRole('dialog', { name: 'Templates', exact: true });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: 'Close controls', exact: true }).click();
    await expect(drawer).toBeHidden();
  }
  await page.getByRole('button', { name: mobile ? 'Export' : 'Export Image', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export Image' });
  const download = page.waitForEvent('download', { timeout: 30_000 });
  await dialog.getByRole('button', { name: 'Copy image' }).click();
  const file = await download;
  const data = await readFile(await file.path());
  expect(data.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(data.length).toBeGreaterThan(100_000);
});
