import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
});

async function openBackground(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: 'Style', exact: true }).click();
  } else {
    await page.getByRole('button', { name: /^Background/ }).click();
  }
}

test('solid preset remains editable and persists through reload', async ({ page }) => {
  await openBackground(page);
  await page.getByRole('button', { name: 'Solid', exact: true }).click();
  const selected = page.getByRole('group', { name: 'Muted tones' }).getByRole('button', { name: 'Mist teal (#DCE7E5)' });
  await selected.click();
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  const picker = page.locator('input[type="color"][aria-label="Solid"]');
  await expect(picker).toHaveValue('#dce7e5');
  await picker.fill('#f1e7e2');
  await expect(selected).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null')?.background?.backgroundColor?.toLowerCase(),
  )).toBe('#f1e7e2');
  await page.reload({ waitUntil: 'domcontentloaded' });
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: 'Style', exact: true }).click();
  } else {
    await page.getByRole('button', { name: /^Background/ }).click();
  }
  await expect(page.locator('input[type="color"][aria-label="Solid"]')).toHaveValue('#f1e7e2');
});

test('gradient preset updates both colors and direction; user edits remain possible', async ({ page }) => {
  await openBackground(page);
  await page.getByRole('button', { name: 'Gradient', exact: true }).click();
  const selected = page.getByRole('group', { name: 'Curated gradients' }).getByRole('button', { name: 'Misty hills' });
  await selected.click();
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  const first = page.locator('input[type="color"][aria-label="Gradient 1"]');
  const second = page.locator('input[type="color"][aria-label="Gradient 2"]');
  await expect(first).toHaveValue('#f6f4ee');
  await expect(second).toHaveValue('#c5d8d2');
  await expect(page.getByRole('combobox', { name: 'Gradient' })).toHaveValue('to bottom right');
  await first.fill('#112233');
  await expect(selected).toHaveAttribute('aria-pressed', 'false');
  await selected.click();
  await expect(first).toHaveValue('#f6f4ee');
  await expect.poll(() => page.evaluate(() => {
    const bg = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null')?.background;
    return [bg?.gradientColor1, bg?.gradientColor2, bg?.gradientDirection];
  })).toEqual(['#F6F4EE', '#C5D8D2', 'to bottom right']);
});
