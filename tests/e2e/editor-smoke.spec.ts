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
  await expect(dialog.getByText('The filename includes the poem title and export time.')).toBeVisible();
  await expect(dialog.getByText('PNG · 2160 x 2700 px', { exact: true })).toBeVisible();
});
