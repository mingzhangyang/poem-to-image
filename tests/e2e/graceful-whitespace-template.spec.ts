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
