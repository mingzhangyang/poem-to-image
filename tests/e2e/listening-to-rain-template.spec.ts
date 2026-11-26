import { expect, test } from '@playwright/test';
import { openPanel } from './helpers/sidebarNavigation';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
});

test('Listening to Rain thumbnail loads and selection survives reload', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openPanel(page, 'Templates');
  await page.getByRole('button', { name: /^More \(/ }).click();
  const library = page.getByRole('dialog', { name: 'Built-in Templates' });
  const card = library.getByRole('button', { name: /Listening to Rain/ });
  await expect(card).toHaveCount(1);
  await card.scrollIntoViewIfNeeded();
  await expect.poll(() => card.locator('img').evaluate(
    (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
  )).toBe(true);
  await card.click();
  await expect(library).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return [draft?.background?.backgroundImage, draft?.background?.backgroundSize];
  })).toEqual(['/template-backgrounds/listening-to-rain.svg', 'stretch']);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-export-layer="background"]').first())
    .toHaveCSS('background-size', '100% 100%');
});
