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

test('motif mode preserves underlying text across selection, reload and returning to text', async ({ page }, info) => {
  test.skip(info.project.name === 'chromium-mobile', 'Desktop settings flow; drawing tests also run on mobile');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();
  const sealText = page.getByRole('textbox', { name: '印章文字' });
  await sealText.fill('李明之印');
  const motif = page.getByRole('button', { name: '山水', exact: true });
  await motif.click();
  await expect(motif).toHaveAttribute('aria-pressed', 'true');
  await expect(sealText).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '印章模式' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '印章样式' })).toBeVisible();
  await page.getByRole('combobox', { name: '印章模式' }).selectOption('baiwen');

  await expect.poll(async () => page.evaluate(() => {
    const stored = localStorage.getItem('inkpoem.editor-state.v1');
    const stamp = stored ? JSON.parse(stored)?.decorations?.stamp : null;
    return [stamp?.motifId, stamp?.text, stamp?.mode];
  })).toEqual(['landscape', '李明之印', 'baiwen']);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await expect(page.getByRole('button', { name: '山水', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '文字印', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '印章文字' })).toHaveValue('李明之印');
});

test('original vector motif stamps render stable Zhu/Bai images at 1x/2x/3x', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const comparisons = await page.evaluate(async () => {
    const { drawStampImpression } = await import(/* @vite-ignore */ '/src/export/stampDraw.ts');
    const render = (mode: 'zhuwen' | 'baiwen', ratio: number) => {
      const c = document.createElement('canvas');
      c.width = 190 * ratio;
      c.height = 190 * ratio;
      const ctx = c.getContext('2d')!;
      ctx.scale(ratio, ratio);
      ctx.translate(95, 95);
      drawStampImpression(ctx, {
        text: '不会显示', motifId: 'landscape', style: 'square', mode,
        colorScheme: mode === 'baiwen' ? 'filled' : 'outline',
        inkColor: '#c82829', weathering: 35, textureStyle: 'natural',
        textureSeed: 45352, positionX: 50, positionY: 50,
        size: 120, rotation: 0, opacity: 1, fontFamily: 'invalid-font',
      }, { pixelScale: ratio });
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let solid = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] >= 160) solid++;
      return { url: c.toDataURL(), solid };
    };
    return [1, 2, 3].map((ratio) => {
      const a = render('zhuwen', ratio);
      const b = render('baiwen', ratio);
      const repeat = render('zhuwen', ratio);
      return { ratio, zhuwen: a.solid, baiwen: b.solid, stable: a.url === repeat.url };
    });
  });
  for (const { ratio, zhuwen, baiwen, stable } of comparisons) {
    expect(stable, 'motif image should be deterministic at ' + ratio + 'x').toBe(true);
    expect(zhuwen).toBeGreaterThan(0);
    expect(baiwen).toBeGreaterThan(zhuwen);
  }
});
