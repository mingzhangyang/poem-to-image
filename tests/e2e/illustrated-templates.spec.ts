import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const names = [
  'Song Floral', 'Blue-Green Mountains', 'Art Nouveau Irises', 'Midnight Star Chart',
  'Botanical Specimen', 'Indigo Washi', 'Lone Fisherman', 'Milky Way',
  'Tower Among the Stars', 'Chrysanthemums and Mountains', 'The Great River',
  'Willow Breeze', 'Grassland Breeze', 'Pine in Snow', 'Sunset Afterglow', 'Moonlit Mountains',
  'Golden Daffodils', 'The Forking Path', 'Dover Beach', 'Tudor Rose Manuscript',
  'A Feather of Hope', 'The Tyger at Night', 'Beyond the Western Pass',
];

async function openLibrary(page: Page) {
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;
  const button = page.getByRole('button', { name: mobile ? 'Templates' : /^Templates/ });
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

test('the gallery shows every new artwork without covering it with its caption', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const library = await openLibrary(page);
  for (const name of names) {
    const card = library.getByRole('button', { name: new RegExp(name) });
    await expect(card).toHaveCount(1);
    await card.scrollIntoViewIfNeeded();
    const art = await card.getByTestId('template-gallery-artwork').boundingBox();
    const caption = await card.getByTestId('template-gallery-caption').boundingBox();
    expect(art && caption).toBeTruthy();
    expect(art!.height).toBeGreaterThan(200);
    expect(art!.y + art!.height).toBeLessThanOrEqual(caption!.y + 1);
  }
});

test('the grassland background survives reload and exports as a PNG', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const library = await openLibrary(page);
  await library.getByRole('button', { name: /Grassland Breeze/ }).click();
  await expect(library).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return [draft?.background?.backgroundImage, draft?.background?.backgroundPosition];
  })).toEqual(['/template-backgrounds/grassland-breeze.webp', 'center bottom']);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const layer = page.locator('[data-export-layer="background"]').first();
  await expect(layer).toHaveCSS('background-position', '50% 100%');
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;
  await page.getByRole('button', { name: mobile ? 'Export' : 'Export Image', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export Image' });
  const download = page.waitForEvent('download', { timeout: 30_000 });
  await dialog.getByRole('button', { name: 'Copy image' }).click();
  const file = await download;
  const data = await readFile(await file.path());
  expect(data.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(data.length).toBeGreaterThan(100_000);
});

test('the dark English poetry background keeps its light horizontal text on reload', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const library = await openLibrary(page);
  await library.getByRole('button', { name: /The Tyger at Night/ }).click();
  await expect(library).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return [draft?.background?.backgroundImage, draft?.typography?.textColor, draft?.typography?.writingMode];
  })).toEqual(['/template-backgrounds/midnight-tyger.webp', '#f8ead1', 'horizontal-tb']);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-export-layer="background"]').first()).toHaveCSS('background-position', '50% 100%');
});
