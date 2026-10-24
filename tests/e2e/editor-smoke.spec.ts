import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ packages: [] }),
    });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    window.localStorage.setItem('poem-to-image.language', 'en');
  });
});

test('edits a poem and preserves it across a reload', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: 'Content', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Open Editor' }).click();

  await page.getByPlaceholder('Title').fill('Release Test Poem');
  await page.getByPlaceholder('Enter your poem here...').fill('A quiet build\nCrosses the final gate');
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByLabel('Body').getByText('Release Test Poem')).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Body').getByText('Release Test Poem')).toBeVisible();
});

test('serves deep-linked product routes', async ({ page }) => {
  await page.goto('/about', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'InkPoem' })).toBeVisible();

  await page.goto('/privacy', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();

  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
});

test('uses thumbnails until an image template is applied', async ({ page }) => {
  const originalRequests: string[] = [];
  const previewRequests: string[] = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/template-backgrounds/')) {
      originalRequests.push(url.pathname);
    }
    if (url.pathname.startsWith('/template-previews/')) {
      previewRequests.push(url.pathname);
    }
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
  } else {
    await page.getByRole('button', { name: /^Templates/ }).click();
  }

  await page.getByRole('button', { name: /^More \(/ }).click();
  const library = page.getByRole('dialog', { name: 'Built-in Templates' });
  await expect(library).toBeVisible();
  await expect.poll(() => previewRequests.length).toBeGreaterThan(0);
  expect(originalRequests).toEqual([]);

  const fullBackgroundRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname === '/template-backgrounds/parchment-scroll-generated.png',
  );
  await library.getByRole('button', { name: /Parchment Scroll/ }).click();
  await fullBackgroundRequest;

  expect(originalRequests).toEqual(['/template-backgrounds/parchment-scroll-generated.png']);
});

test('keeps drawer controls and a readable canvas at the tablet breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('aside').last()).toBeHidden();

  const scaleLabel = page.getByText(/^\d+%$/).first();
  await expect(scaleLabel).toBeVisible();
  const scale = Number.parseInt((await scaleLabel.textContent()) ?? '0', 10);
  expect(scale).toBeGreaterThanOrEqual(50);
});

test('separates poem fields and layer styles into mobile editor tabs', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'Open Editor' }).click();

  const textTab = page.getByRole('tab', { name: 'Poem Text' });
  const stylesTab = page.getByRole('tab', { name: 'Layer Styles' });
  await expect(textTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Poem Text' })).toBeVisible();

  await stylesTab.click();
  await expect(stylesTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Layer Styles' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'Poem Text' })).toBeHidden();
});

test('uses truthful export copy and exposes export dialog semantics', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();

  const dialog = page.getByRole('dialog', { name: 'Export Image' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('poem-image.png')).toBeVisible();
  await expect(dialog.getByText('PNG · 2160 x 2700 px', { exact: true })).toBeVisible();
});

test('keeps the poem editor focused and open while typing rapidly', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: 'Content', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Open Editor' }).click();

  const dialog = page.getByRole('dialog', { name: 'Poem Editor' });
  const title = dialog.getByPlaceholder('Title');
  const rapidText = 'Midnight Rain under City Lights and a Thousand Quiet Stars';
  await title.fill('');
  await title.pressSequentially(rapidText, { delay: 0 });
  await expect(title).toHaveValue(rapidText);
  await expect(title).toBeFocused();
  await expect(dialog).toBeVisible();

  // Insert multi-byte text through the keyboard path, not only React's fill helper.
  await title.fill('');
  await page.keyboard.insertText('夜雨落在旧街巷，灯光映照着安静的诗行');
  await expect(title).toHaveValue('夜雨落在旧街巷，灯光映照着安静的诗行');
  await expect(dialog).toBeVisible();
});

test('uses the slider value as the preview zoom readout', async ({ page }) => {
  // The zoom slider is intentionally a desktop-only control.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const slider = page.getByRole('slider', { name: 'Preview Zoom' });
  await expect(slider).toHaveValue('100');
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await slider.focus();
  await slider.press('End');
  await expect(slider).toHaveValue('200');
  await expect(page.getByText('200%', { exact: true })).toBeVisible();
});

test('undo and reload preserve the canvas preset identity', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Canvas Size/ }).click();
  const presets = page.getByRole('combobox', { name: 'Preset Sizes' });
  await presets.selectOption('wechat-moments-long');
  await page.waitForTimeout(950);
  await presets.selectOption('print-card');
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(presets).toHaveValue('wechat-moments-long');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Canvas Size/ }).click();
  await expect(page.getByRole('combobox', { name: 'Preset Sizes' })).toHaveValue('wechat-moments-long');
});

test('restores a legacy ratio preset identity after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Canvas Size/ }).click();
  const presets = page.getByRole('combobox', { name: 'Preset Sizes' });
  await presets.selectOption('1080x1350');
  await expect(presets).toHaveValue('1080x1350');
  await page.waitForTimeout(950);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Canvas Size/ }).click();
  await expect(page.getByRole('combobox', { name: 'Preset Sizes' })).toHaveValue('1080x1350');
});
