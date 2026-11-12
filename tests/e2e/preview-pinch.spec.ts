import { expect, test, type Locator } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 1600 } });

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ packages: [] }),
  }));
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'zh-CN');
  });
});

async function pointer(target: Locator, type: string, pointerId: number, x: number, y: number) {
  await target.dispatchEvent(type, {
    pointerId, pointerType: 'touch', isPrimary: pointerId === 1,
    clientX: x, clientY: y, bubbles: true, cancelable: true,
  });
}

test('pinching over an overlay cancels its drag and defers seal rasterization', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();
  const poem = page.locator('[aria-label="正文"][tabindex="0"]');
  const stamp = page.locator('[aria-label="印章元素"]');
  const canvas = stamp.locator('canvas');
  const viewport = page.locator('[style*="touch-action: none"]').first();
  const slider = page.getByRole('slider', { name: '预览缩放' });
  await expect(poem).toBeVisible();
  await expect(canvas).toHaveCount(1);
  await expect(slider).toHaveValue('100');
  const originalPosition = await poem.evaluate((node) => ({
    left: (node.parentElement as HTMLElement).style.left,
    top: (node.parentElement as HTMLElement).style.top,
  }));
  const originalPixels = await canvas.evaluate((node) => (node as HTMLCanvasElement).width);

  await pointer(poem, 'pointerdown', 1, 100, 100);
  await pointer(poem, 'pointermove', 1, 100, 120);
  await pointer(poem, 'pointerdown', 2, 200, 100);
  await expect.poll(() => poem.evaluate((node) => ({
    left: (node.parentElement as HTMLElement).style.left,
    top: (node.parentElement as HTMLElement).style.top,
  }))).toEqual(originalPosition);
  await pointer(viewport, 'pointermove', 2, 260, 100);
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(140);
  expect(await canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBe(originalPixels);
  await pointer(viewport, 'pointermove', 2, 300, 100);
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(180);
  expect(await canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBe(originalPixels);
  await pointer(viewport, 'pointerup', 2, 300, 100);
  await pointer(viewport, 'pointerup', 1, 100, 120);
  await expect.poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBeGreaterThan(originalPixels);
  await expect.poll(() => poem.evaluate((node) => ({
    left: (node.parentElement as HTMLElement).style.left,
    top: (node.parentElement as HTMLElement).style.top,
  }))).toEqual(originalPosition);

  // Single-finger overlay drag still commits after a pinch.
  const stampStart = await stamp.evaluate((node) => (node.parentElement as HTMLElement).style.top);
  await pointer(stamp, 'pointerdown', 3, 100, 100);
  await pointer(stamp, 'pointermove', 3, 100, 120);
  await pointer(stamp, 'pointerup', 3, 100, 120);
  await expect.poll(() => stamp.evaluate((node) => (node.parentElement as HTMLElement).style.top))
    .not.toBe(stampStart);
});

test('coincident contacts and pointer cancellation leave zoom and later drags usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const poem = page.locator('[aria-label="正文"][tabindex="0"]');
  const viewport = page.locator('[style*="touch-action: none"]').first();
  const slider = page.locator('input[aria-label="预览缩放"]');
  await pointer(poem, 'pointerdown', 1, 100, 100);
  await pointer(poem, 'pointerdown', 2, 100, 100);
  await pointer(viewport, 'pointermove', 2, 100, 100);
  await expect(slider).toHaveValue('100');
  await pointer(viewport, 'pointermove', 2, 120, 100); // establishes a usable baseline
  await pointer(viewport, 'pointermove', 2, 130, 100);
  // Cancellation must flush the latest queued frame instead of losing the final zoom.
  await pointer(viewport, 'pointercancel', 2, 130, 100);
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(100);
  await pointer(viewport, 'pointerup', 1, 100, 100);
  const zoom = Number(await slider.inputValue());
  expect(Number.isFinite(zoom)).toBe(true);
  expect(zoom).toBeGreaterThanOrEqual(70);
  expect(zoom).toBeLessThanOrEqual(200);
});

test('two browser touch contacts can pinch over the poem on a phone viewport', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const poem = page.locator('[aria-label="正文"][tabindex="0"]');
  await expect(poem).toBeVisible();
  const rect = await poem.boundingBox();
  expect(rect).not.toBeNull();
  const x = rect!.x + rect!.width / 2;
  const y = rect!.y + rect!.height / 2;
  const first = { x: x - 10, y, id: 1 };
  const second = { x: x + 10, y, id: 2 };
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [first, { ...second, x: x + 30 }],
    });
    await expect.poll(async () => Number(await page.locator('input[aria-label="预览缩放"]').inputValue()))
      .toBeGreaterThan(100);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [first] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
});
