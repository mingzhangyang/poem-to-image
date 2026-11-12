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

test('style cards render genuine previews and offer functional category filters', async ({ page }, info) => {
  test.skip(info.project.name === 'chromium-mobile', 'Desktop control panel; shared renderer is covered below');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();
  const group = page.getByRole('group', { name: '中国印章样式库' });
  const filters = page.getByRole('group', { name: '筛选印章样式' });
  const canvases = group.locator('canvas');
  await expect(canvases).toHaveCount(10);
  await expect.poll(async () => canvases.evaluateAll((nodes) =>
    nodes.map((node) => {
      const canvas = node as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
      return false;
    }),
  )).toEqual(Array(10).fill(true));

  await filters.getByRole('button', { name: '图案类' }).click();
  await expect(group.locator('canvas')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '山水印', exact: true })).toBeVisible();
  await filters.getByRole('button', { name: '文字类' }).click();
  await expect(group.locator('canvas')).toHaveCount(8);
  await expect(page.getByRole('button', { name: '斋馆印', exact: true })).toBeVisible();
  await filters.getByRole('button', { name: '全部', exact: true }).click();
  await expect(group.locator('canvas')).toHaveCount(10);
});

test('style selection preserves user text, shape identity and placement until example explicitly requested', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'Desktop editing flow; Canvas core shared');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();
  const text = page.getByRole('textbox', { name: '印章文字' });
  await text.fill('澄怀观道');
  await page.getByRole('button', { name: '斋馆印', exact: true }).click();
  await expect(text).toHaveValue('澄怀观道');
  await expect(page.getByRole('combobox', { name: '印章样式' })).toHaveValue('rect-vertical');
  await expect(page.getByRole('slider', { name: '短边 / 长边比例' })).toHaveValue('58');
  // Choosing a style collapses the gallery, keeping core editing controls near the top.
  await page.getByRole('button', { name: /^中国印章样式库/ }).click();
  await expect(page.getByRole('button', { name: '斋馆印', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => {
    const s = localStorage.getItem('inkpoem.editor-state.v1');
    const stamp = s ? JSON.parse(s)?.decorations?.stamp : null;
    return [stamp?.text, stamp?.style, stamp?.shapeRatio, stamp?.motifId];
  })).toEqual(['澄怀观道', 'rect-vertical', 0.58, undefined]);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await expect(page.getByRole('textbox', { name: '印章文字' })).toHaveValue('澄怀观道');
  await expect(page.getByRole('button', { name: '斋馆印', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '使用示例印文', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '印章文字' })).toHaveValue('书画之印');
});

test('motif gallery and advanced settings retain existing keyboard and text controls', async ({ page }, info) => {
  test.skip(info.project.name === 'chromium-mobile', 'Desktop settings flow');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();
  await page.getByRole('textbox', { name: '印章文字' }).fill('李明之印');

  const advanced = page.getByRole('button', { name: '精细调整' });
  await expect(page.getByRole('combobox', { name: '印章字体' })).toBeVisible();
  await advanced.click();
  await expect(advanced).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('combobox', { name: '印章字体' })).toHaveCount(0);
  await expect(page.getByRole('slider', { name: '印章大小' })).toBeVisible();
  await expect(page.getByRole('slider', { name: '印章角度' })).toHaveCount(0);
  await advanced.click();
  await expect(page.getByRole('combobox', { name: '印章字体' })).toBeVisible();

  const filters = page.getByRole('group', { name: '筛选印章样式' });
  await filters.getByRole('button', { name: '图案类' }).click();
  await page.getByRole('button', { name: '山水印', exact: true }).click();
  await page.getByRole('button', { name: /^中国印章样式库/ }).click();
  await expect(page.getByRole('button', { name: '山水印', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: '印章文字' })).toHaveCount(0);
  await page.getByRole('button', { name: '梅花', exact: true }).click();
  await expect(page.getByRole('button', { name: '山水印', exact: true }))
    .toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '文字印', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '印章文字' })).toHaveValue('李明之印');
  await expect(page.getByRole('combobox', { name: '印章字体' })).toBeVisible();
});

test('font registration after gallery mount repaints all existing thumbnails', async ({ page }, info) => {
  test.skip(info.project.name === 'chromium-mobile', 'Desktop gallery; the compositor is shared');
  // The loader's deferred FontFace registration is independently exercised in Node.
  // This probes the mounted Canvas subscriber without depending on a remote CDN.
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.clearRect;
    const win = window as Window & { __sealThumbnailPaints?: number };
    win.__sealThumbnailPaints = 0;
    CanvasRenderingContext2D.prototype.clearRect = function (
      this: CanvasRenderingContext2D, ...args: [number, number, number, number]
    ) {
      if (this.canvas.width === 192 && this.canvas.height === 192) {
        win.__sealThumbnailPaints = (win.__sealThumbnailPaints ?? 0) + 1;
      }
      return original.apply(this, args);
    };
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();
  await expect(page.getByRole('group', { name: '中国印章样式库' }).locator('canvas')).toHaveCount(10);
  const countPaints = () => page.evaluate(() =>
    (window as Window & { __sealThumbnailPaints?: number }).__sealThumbnailPaints ?? 0);
  await expect.poll(countPaints).toBeGreaterThanOrEqual(10);
  const before = await countPaints();
  await page.evaluate(async () => {
    // Simulate a delayed seal font registration notification from fontLoader.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const fontModuleUrl = '/src/fontLoader.ts';
    const { SEAL_FONT_REGISTERED_EVENT } =
      await import(/* @vite-ignore */ fontModuleUrl) as typeof import('../../src/fontLoader');
    document.dispatchEvent(new Event(SEAL_FONT_REGISTERED_EVENT));
  });
  await expect.poll(countPaints).toBeGreaterThanOrEqual(before + 10);
});

test('glyph sliders clear the precise style selection after application', async ({ page }, info) => {
  test.skip(info.project.name === 'chromium-mobile', 'Desktop editing flow');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();
  const card = page.getByRole('button', { name: '斋馆印', exact: true });
  const header = page.getByRole('button', { name: /^中国印章样式库/ });
  await card.click();
  await header.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  const glyphSize = page.getByRole('slider', { name: '印文字号' });
  await glyphSize.focus();
  await page.keyboard.press('ArrowRight');
  await expect(glyphSize).toHaveValue('105');
  await expect(card).toHaveAttribute('aria-pressed', 'false');
  await card.click();
  await header.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  const stroke = page.getByRole('slider', { name: '印文笔画粗细' });
  await stroke.focus();
  await page.keyboard.press('ArrowRight');
  await expect(stroke).toHaveValue('0.5');
  await expect(card).toHaveAttribute('aria-pressed', 'false');
});

test('keyboard card selection returns focus to a stable header and supports next Tab', async ({ page }, info) => {
  test.skip(info.project.name === 'chromium-mobile', 'Desktop gallery keyboard controls');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();
  const header = page.getByRole('button', { name: /^中国印章样式库/ });
  await page.getByRole('button', { name: '斋馆印', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await expect(header).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '使用示例印文', exact: true })).toBeFocused();

  await header.click();
  await page.getByRole('button', { name: '山水印', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await expect(header).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: '印章模式' })).toBeFocused();
});

// Pixel-level smoke test for every gallery style; runs in all browser projects
// even if mobile app navigation differs from desktop settings.
test('all catalog designs render through the shared impression core', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const counts = await page.evaluate(async () => {
    const catalogModuleUrl = '/src/sealStyleCatalog.ts';
    const stampDrawModuleUrl = '/src/export/stampDraw.ts';
    const { SEAL_STYLE_DESIGN_IDS, getSealStyleDesignPreview } =
      await import(/* @vite-ignore */ catalogModuleUrl) as typeof import('../../src/sealStyleCatalog');
    const { drawStampImpression } =
      await import(/* @vite-ignore */ stampDrawModuleUrl) as typeof import('../../src/export/stampDraw');
    return SEAL_STYLE_DESIGN_IDS.map((id) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 144;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(72, 72);
      drawStampImpression(ctx, getSealStyleDesignPreview(id), {
        pixelScale: 1, applyTransform: false, applyOpacity: false,
      });
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let opaquePixels = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 12) opaquePixels++;
      }
      return { id, opaquePixels };
    });
  });
  expect(counts).toHaveLength(10);
  for (const item of counts) expect(item.opaquePixels, item.id).toBeGreaterThan(0);
});
