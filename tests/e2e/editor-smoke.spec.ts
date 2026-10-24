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

test('copies a rendered PNG to the clipboard for anonymous users', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: async (items: ClipboardItem[]) => {
          const blob = await items[0]!.getType('image/png');
          const bytes = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
          if (bytes.join(',') !== '137,80,78,71,13,10,26,10') {
            throw new Error('Clipboard payload is not an actual PNG');
          }
          (window as typeof window & { __copiedPngSize?: number }).__copiedPngSize = blob.size;
        },
      },
    });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export Image' });
  await dialog.getByRole('button', { name: 'Copy image' }).click();
  await expect(page.getByRole('status').getByText('Image copied to clipboard — paste it when posting.')).toBeVisible();
  await expect.poll(
    () => page.evaluate(() => (window as typeof window & { __copiedPngSize?: number }).__copiedPngSize ?? 0),
    { timeout: 20_000 },
  ).toBeGreaterThan(0);
});

for (const mode of ['missing', 'rejected'] as const) {
  test(`downloads a PNG when clipboard write is ${mode}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript((variant: 'missing' | 'rejected') => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: variant === 'missing' ? undefined : {
          write: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); },
        },
      });
    }, mode);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Export Image' }).click();
    const dialog = page.getByRole('dialog', { name: 'Export Image' });
    await expect(dialog.getByRole('button', { name: 'Copy image' })).toBeEnabled();

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Copy image' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    await expect(page.getByRole('status').getByText('Clipboard unavailable; downloaded a PNG instead.')).toBeVisible();
  });
}
