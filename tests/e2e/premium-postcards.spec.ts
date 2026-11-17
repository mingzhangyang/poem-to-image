import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const cards = [
  ['European Travel Postcard', '/template-backgrounds/postcard-premium-europe.webp'],
  ['Botanical Watercolor Postcard', '/template-backgrounds/postcard-premium-botanical.webp'],
  ['Epistolary Collage Postcard', '/template-backgrounds/postcard-premium-letter-collage.webp'],
  ['Seaside Holiday Postcard', '/template-backgrounds/postcard-premium-seaside.webp'],
] as const;

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

test('premium gallery assets load, poem stays editable, selection restores and exports PNG', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;
  const templates = page.getByRole('button', {
    name: mobile ? 'Templates' : /^Templates/, exact: mobile,
  });
  if (await templates.getAttribute('aria-expanded') !== 'true') await templates.click();
  await page.getByRole('button', { name: /^More \(/ }).click();
  const gallery = page.getByRole('dialog', { name: 'Built-in Templates' });
  for (const [name] of cards) {
    const card = gallery.getByRole('button', { name: new RegExp(name) });
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveCount(1);
    await expect.poll(() => card.locator('img').evaluate(
      (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
    )).toBe(true);
  }

  await gallery.getByRole('button', { name: /European Travel Postcard/ }).click();
  await expect(gallery).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return [draft?.background?.backgroundImage, draft?.background?.backgroundSize];
  })).toEqual([cards[0][1], 'cover']);

  if (mobile) {
    const drawer = page.getByRole('dialog', { name: 'Templates', exact: true });
    await drawer.getByRole('button', { name: 'Close controls', exact: true }).click();
    await page.getByRole('button', { name: 'Content', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Open Editor' }).click();
  const editor = page.getByRole('dialog', { name: 'Poem Editor' });
  await editor.locator('#poem-editor-body-input').fill('A postcard sent across the sea');
  await editor.getByRole('button', { name: 'Done' }).click();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-export-layer="background"]').first())
    .toHaveCSS('background-size', 'cover');
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return [draft?.background?.backgroundImage, draft?.poem?.body];
  })).toEqual([cards[0][1], 'A postcard sent across the sea']);

  await page.getByRole('button', { name: mobile ? 'Export' : 'Export Image', exact: true }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export Image' });
  const download = page.waitForEvent('download', { timeout: 30_000 });
  await exportDialog.getByRole('button', { name: 'Copy image' }).click();
  const data = await readFile(await (await download).path());
  expect(data.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(data.length).toBeGreaterThan(100_000);
});
