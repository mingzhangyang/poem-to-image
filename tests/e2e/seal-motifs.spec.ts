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
  const textFont = page.getByRole('combobox', { name: '印章字体' });
  await textFont.selectOption('"Ma Shan Zheng", cursive');
  const originalFont = await textFont.inputValue();
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
    return [stamp?.motifId, stamp?.text, stamp?.mode, stamp?.fontFamily];
  })).toEqual(['landscape', '李明之印', 'baiwen', originalFont]);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await expect(page.getByRole('button', { name: '山水', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '文字印', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '印章文字' })).toHaveValue('李明之印');
  await expect(page.getByRole('combobox', { name: '印章字体' })).toHaveValue(originalFont);
});

test('switching zh-CN to zh-TW does not replace a template stamp with a chosen motif', async ({ page }, info) => {
  test.skip(info.project.name === 'chromium-mobile', 'Desktop settings flow');
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.active-template', 'graceful-whitespace');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await expect(page.getByRole('checkbox', { name: '显示印章' })).toBeChecked();
  await page.getByRole('button', { name: '山水', exact: true }).click();
  await expect(page.getByRole('button', { name: '山水', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '设置' }).click();
  await page.getByRole('button', { name: '繁體中文', exact: true }).click();
  await page.getByRole('button', { name: '設定' }).click();
  await expect(page.getByRole('button', { name: '山水', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('inkpoem.editor-state.v1');
    return raw ? JSON.parse(raw)?.decorations?.stamp?.motifId : null;
  })).toBe('landscape');
});

test('cold-restored motif does not fetch the hidden seal-script font', async ({ page, browser }, info) => {
  test.skip(info.project.name === 'chromium-mobile', 'Desktop controls; network checked with isolated cache');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();
  await page.getByRole('button', { name: '传统朱文姓名印' }).click();
  const originalFont = '"InkPoem Zhongshan Seal", "Noto Serif SC", serif';
  await expect(page.getByRole('combobox', { name: '印章字体' })).toHaveValue(originalFont);
  await page.getByRole('button', { name: '山水', exact: true }).click();
  // The Modern transition must not overwrite the text font while it is hidden.
  await page.getByRole('combobox', { name: '印章模式' }).selectOption('modern');
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('inkpoem.editor-state.v1');
    const stamp = raw ? JSON.parse(raw)?.decorations?.stamp : null;
    return [stamp?.motifId, stamp?.fontFamily, stamp?.mode];
  })).toEqual(['landscape', originalFont, 'modern']);

  // The authoritative draft is in IndexedDB, not the localStorage mirror.
  await expect.poll(() => page.evaluate(async () => new Promise<string | null>((resolve, reject) => {
    const open = indexedDB.open('inkpoem-editor-drafts', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('documents', 'readonly');
      const read = tx.objectStore('documents').get('current');
      read.onsuccess = () => resolve(read.result?.scene?.decorations?.stamp?.motifId ?? null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error);
    };
  }))).toBe('landscape');

  const savedState = await page.context().storageState({ indexedDB: true });
  const freshContext = await browser.newContext({ storageState: savedState, serviceWorkers: 'block' });
  const requests: string[] = [];
  await freshContext.route('**/JFZSKSealScript_V2.0.woff2', async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  await freshContext.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  try {
    const freshPage = await freshContext.newPage();
    await freshPage.goto(new URL('/', page.url()).toString(), { waitUntil: 'domcontentloaded' });
    await freshPage.getByRole('button', { name: /^装饰与元素/ }).click();
    await expect(freshPage.getByRole('button', { name: '山水', exact: true }))
      .toHaveAttribute('aria-pressed', 'true');
    // The isolated context has an empty font cache, so attempted fetches hit the route.
    await freshPage.waitForTimeout(350);
    expect(requests).toEqual([]);
  } finally {
    await freshContext.close();
  }
});

test('original vector motif stamps render stable Zhu/Bai images at 1x/2x/3x', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const comparisons = await page.evaluate(async () => {
    const stampDrawModuleUrl = '/src/export/stampDraw.ts';
    const { drawStampImpression } =
      await import(/* @vite-ignore */ stampDrawModuleUrl) as typeof import('../../src/export/stampDraw');
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
