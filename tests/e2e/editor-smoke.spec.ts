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

test('clearing a title removes stale identification but body-only edits can rematch', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open Editor' }).click();

  const dialog = page.getByRole('dialog', { name: 'Poem Editor' });
  const title = dialog.getByPlaceholder('Title');
  const body = dialog.getByPlaceholder('Enter your poem here...');
  const recognized = dialog.getByText('Sonnet 18 · William Shakespeare');
  const sonnet = "Shall I compare thee to a summer's day?\nThou art more lovely and more temperate.";

  await title.fill('Draft title');
  await body.fill(sonnet);
  await expect(recognized).toBeVisible({ timeout: 15_000 });

  await title.fill('');
  await expect(recognized).toBeHidden();

  await body.fill('An unrelated temporary line');
  await body.fill(sonnet);
  await expect(recognized).toBeVisible({ timeout: 15_000 });
});

test('keeps Copy image reachable in the short mobile export drawer', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 480 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Export Image' });
  await expect(drawer).toBeVisible();

  const scrollArea = drawer.locator('.app-sidebar-scrollbar');
  await expect.poll(() => scrollArea.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  const copy = drawer.getByRole('button', { name: 'Copy image' });
  await copy.scrollIntoViewIfNeeded();
  await expect(copy).toBeInViewport();

  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await copy.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  await expect(page.getByRole('status').getByText('Clipboard unavailable; downloaded a PNG instead.')).toBeVisible();
});

test('downloads a named PNG for an untitled poem when clipboard is unavailable', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open Editor' }).click();
  const editor = page.getByRole('dialog', { name: 'Poem Editor' });
  await editor.getByPlaceholder('Title').fill('');
  await editor.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Export Image' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export Image' });
  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await dialog.getByRole('button', { name: 'Copy image' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^poem-image-\d{8}-\d{6}-\d{3}\.png$/);
  await expect(page.getByRole('status').getByText('Clipboard unavailable; downloaded a PNG instead.')).toBeVisible();
});


test('preserves a customized template font and solid background after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Templates/ }).click();
  await page.getByRole('button', { name: /^More \(/ }).click();
  const library = page.getByRole('dialog', { name: 'Built-in Templates' });
  await library.getByRole('button', { name: /Parchment Scroll/ }).click();

  const backgroundSection = page.getByRole('button', { name: /^Background/ });
  await expect(backgroundSection).toContainText('Templates');
  await expect(backgroundSection).not.toContainText('Upload Image');
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return state?.background?.backgroundImageSource;
  })).toBe('template');

  // Template image and its origin both survive a reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /^Background/ })).toContainText('Templates');

  await page.getByRole('button', { name: /^Background/ }).click();
  await page.getByRole('button', { name: 'Solid', exact: true }).click();
  await page.getByRole('button', { name: /^Typography/ }).click();
  const font = page.getByRole('combobox', { name: 'Font Family' });
  await font.selectOption('"Playfair Display", serif');

  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return [state?.background?.backgroundType, state?.typography?.fontFamily];
  })).toEqual(['solid', '"Playfair Display", serif']);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /^Background/ })).toContainText('Solid');
  await expect(page.getByRole('button', { name: /^Typography/ })).toContainText('Playfair Display');
  await page.getByRole('button', { name: /^Typography/ }).click();
  await expect(page.getByRole('combobox', { name: 'Font Family' })).toHaveValue('"Playfair Display", serif');
});

test('recognizes English poetry while the interface is Chinese', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    await context.addInitScript(() => {
      localStorage.setItem('poem-to-image.language', 'zh-CN');
      localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    });
    const page = await context.newPage();
    await page.route('**/api/billing/packages', route => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ packages: [] }),
    }));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '打开编辑器' }).click();
    const editor = page.getByRole('dialog', { name: '诗歌编辑器' });
    await editor.getByPlaceholder('在此输入您的诗词...').fill(
      "Shall I compare thee to a summer's day?\nThou art more lovely and more temperate.",
    );
    await expect(editor.getByText('Sonnet 18 · William Shakespeare')).toBeVisible({ timeout: 15_000 });
  } finally {
    await context.close();
  }
});

test('first-visit onboarding CTA opens the editor once in a clean browser context', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    await page.route('**/api/billing/packages', route => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ packages: [] }),
    }));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const welcome = page.getByRole('dialog', { name: 'Every word, exactly right.' });
    await expect(welcome).toBeVisible();
    await welcome.getByRole('button', { name: "Got it, let's start" }).click();
    await expect(page.getByRole('dialog', { name: 'Poem Editor' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('poem-to-image.onboarding-dismissed'))).toBe('true');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('dialog', { name: 'Every word, exactly right.' })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
