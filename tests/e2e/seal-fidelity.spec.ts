import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'zh-CN');
  });
});

test('seal rasterization remains deterministic across pixel ratios and shape modes in a real browser', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    // Vite's dev server serves the exact application module, not an E2E copy.
    const path = '/src/export/stampDraw.ts';
    const { drawStampImpression } = await import(/* @vite-ignore */ path);
    const hashes: string[] = [];
    let transparentCarvedPixels = 0;
    for (const style of ['square', 'round', 'brush'] as const) {
      for (const colorScheme of ['outline', 'filled'] as const) {
        for (const scale of [1, 2, 3]) {
          const stamp = {
            text: '𠮷印', style, colorScheme, size: 100, inkColor: '#c82829',
            fontFamily: 'serif', weathering: 24, rotation: 17,
            opacity: 0.8, positionX: 50, positionY: 50,
          };
          const render = () => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 180 * scale;
            const ctx = canvas.getContext('2d')!;
            ctx.scale(scale, scale);
            ctx.translate(90, 90);
            drawStampImpression(ctx, stamp, { pixelScale: scale });
            return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          };
          const first = render();
          const second = render();
          if (first.some((value, index) => value !== second[index])) {
            return { deterministic: false, hashes, transparentCarvedPixels };
          }
          // Sample the central quadrant so a misplaced/cropped canvas cannot pass.
          const nonTransparent = first.filter((_value, index) => index % 4 === 3 && first[index] > 0).length;
          hashes.push(style + '-' + colorScheme + '-' + scale + ':' + nonTransparent);
          if (colorScheme === 'filled') {
            transparentCarvedPixels += first.filter((_value, index) => index % 4 === 3 && first[index] === 0).length;
          }
        }
      }
    }
    return { deterministic: true, hashes, transparentCarvedPixels };
  });
  expect(result.deterministic).toBe(true);
  expect(result.hashes).toHaveLength(18);
  expect(result.hashes.every((entry) => Number(entry.split(':')[1]) > 0)).toBe(true);
  expect(result.transparentCarvedPixels).toBeGreaterThan(0);
});

test('Unicode stamp input survives editing and draft restore', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'Desktop UI flow; mobile raster tests run separately');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();
  const input = page.getByRole('textbox', { name: '印章文字' });
  await input.fill('𠮷\u0301印記詩畫');
  await expect(input).toHaveValue('𠮷\u0301印記詩');
  const previewCanvas = page.locator('[aria-label="印章元素"] canvas');
  await expect(previewCanvas).toHaveCount(1);
  const metrics = await previewCanvas.evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    return { pixels: canvas.width, cssSize: parseFloat(canvas.style.width) };
  });
  expect(metrics.pixels).toBeGreaterThanOrEqual(metrics.cssSize);
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return state?.decorations?.stamp?.text ?? null;
  })).toBe('𠮷\u0301印記詩');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await expect(page.getByRole('textbox', { name: '印章文字' })).toHaveValue('𠮷\u0301印記詩');
});


test('preview zoom updates seal backing pixels without exceeding the cap', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'Desktop preview zoom control');
  await page.setViewportSize({ width: 1920, height: 1600 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();

  const canvas = page.locator('[aria-label="印章元素"] canvas');
  const slider = page.locator('input[type="range"][min="70"][max="200"]');
  await expect(canvas).toHaveCount(1);
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveValue('70');
  const lowPixels = await canvas.evaluate((element) => (element as HTMLCanvasElement).width);
  await slider.press('End');
  await expect(slider).toHaveValue('200');
  await expect.poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).width))
    .toBeGreaterThan(lowPixels);
  const { width, height } = await canvas.evaluate((element) => {
    const stampCanvas = element as HTMLCanvasElement;
    return { width: stampCanvas.width, height: stampCanvas.height };
  });
  expect(width).toBeLessThanOrEqual(2048);
  expect(height).toBe(width);
});
