import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) }),
  );
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'zh-CN');
  });
});

test('natural Zhu/Bai Wen impressions remain deterministic at 1x, 2x and 3x in desktop/mobile Canvas', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const modulePath = '/src/export/stampDraw.ts';
    const { drawStampImpression } = await import(/* @vite-ignore */ modulePath);
    const getImage = (
      style: 'square' | 'round' | 'brush',
      mode: 'zhuwen' | 'baiwen',
      ratio: number,
      textureStyle: 'classic' | 'natural',
      seed: number,
      wear = 65,
    ) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = ratio * 180;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(ratio, ratio);
      ctx.translate(90, 90);
      drawStampImpression(ctx, {
        text: '山水', style, mode,
        colorScheme: mode === 'zhuwen' ? 'outline' : 'filled',
        inkColor: '#c82829', weathering: wear, textureStyle,
        textureSeed: seed, positionX: 50, positionY: 50,
        fontFamily: 'serif', size: 100, rotation: 0, opacity: 1,
      }, { pixelScale: ratio });
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const records: Array<{ ratio: number; style: string; mode: string; stable: boolean; changed: number; seedChanged: number }> = [];
    const begin = performance.now();
    for (const style of ['square', 'round', 'brush'] as const) {
      for (const mode of ['zhuwen', 'baiwen'] as const) {
        for (const ratio of [1, 2, 3]) {
          const a = getImage(style, mode, ratio, 'natural', 0x49abc);
          const b = getImage(style, mode, ratio, 'natural', 0x49abc);
          const classic = getImage(style, mode, ratio, 'classic', 0x49abc);
          const anotherSeed = getImage(style, mode, ratio, 'natural', 0x49abd);
          let changed = 0;
          let seedChanged = 0;
          for (let index = 3; index < a.length; index += 4) {
            if (Math.abs(a[index] - classic[index]) > 3) changed++;
            if (Math.abs(a[index] - anotherSeed[index]) > 3) seedChanged++;
          }
          records.push({
            ratio, style, mode,
            stable: a.every((value, index) => value === b[index]),
            changed, seedChanged,
          });
        }
      }
    }
    return { records, elapsed: performance.now() - begin };
  });
  expect(result.records).toHaveLength(18);
  for (const entry of result.records) {
    expect(entry.stable, entry.style + ' ' + entry.mode + ' ' + entry.ratio + 'x must repeat').toBe(true);
    expect(entry.changed, 'natural must differ from classic wear').toBeGreaterThan(5);
    expect(entry.seedChanged, 'a new impression must have a new texture').toBeGreaterThan(5);
  }
  // Broad browser performance guard, not a target FPS measurement. Detailed
  // real-device cost must still be profiled on iPhone Safari.
  expect(result.elapsed).toBeLessThan(20_000);
});

test('natural texture identity survives color and opacity changes, undo, redo and draft reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'Desktop UI regression; Canvas raster regression covers mobile');
  await page.clock.install();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();

  const impression = page.getByRole('combobox', { name: '印蜕质感' });
  await impression.selectOption('natural');
  // IndexedDB is the authoritative editor document; the localStorage
  // compatibility mirror can be stale after an asynchronous save.
  const readStamp = () => page.evaluate(() =>
    new Promise<{ textureStyle?: string; textureSeed?: number } | null>((resolve, reject) => {
      const open = indexedDB.open('inkpoem-editor-drafts', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const transaction = db.transaction('documents', 'readonly');
        const request = transaction.objectStore('documents').get('current');
        request.onsuccess = () => resolve(request.result?.scene?.decorations?.stamp ?? null);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      };
    }),
  );
  await expect.poll(async () => (await readStamp())?.textureStyle).toBe('natural');
  const originalSeed = (await readStamp())?.textureSeed as number;
  expect(Number.isFinite(originalSeed)).toBe(true);

  const ink = page.getByRole('button', { name: 'Bright Red', exact: true });
  await ink.click();
  const opacity = page.getByRole('slider', { name: '印章透明度' });
  await opacity.focus();
  await opacity.press('Home');
  const size = page.getByRole('slider', { name: '印章大小' });
  await size.focus();
  await size.press('ArrowRight');
  await expect.poll(async () => (await readStamp())?.textureSeed).toBe(originalSeed);
  // Commit the setup edits into history, so Undo reverses only the explicit
  // "new impression" action rather than coalescing all edits in 800ms.
  await page.clock.runFor(900);

  await page.getByRole('button', { name: '换一张印蜕' }).click();
  await expect.poll(async () => (await readStamp())?.textureSeed).not.toBe(originalSeed);
  const updatedSeed = (await readStamp())?.textureSeed as number;
  await page.getByRole('button', { name: '撤销' }).click();
  await expect.poll(async () => (await readStamp())?.textureSeed).toBe(originalSeed);
  await page.getByRole('button', { name: '重做' }).click();
  await expect.poll(async () => (await readStamp())?.textureSeed).toBe(updatedSeed);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await expect(page.getByRole('combobox', { name: '印蜕质感' })).toHaveValue('natural');
  await expect.poll(async () => (await readStamp())?.textureSeed).toBe(updatedSeed);
});

test('natural zero-wear is visually identical to classic pristine seal', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const same = await page.evaluate(async () => {
    const modulePath = '/src/export/stampDraw.ts';
    const { drawStampImpression } = await import(/* @vite-ignore */ modulePath);
    const draw = (textureStyle: 'classic' | 'natural') => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 300;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(150, 150);
      drawStampImpression(ctx, {
        text: '印記', mode: 'baiwen', style: 'round', colorScheme: 'filled',
        inkColor: '#bc2925', weathering: 0, textureStyle, textureSeed: 123,
        size: 120, positionX: 50, positionY: 50,
        rotation: 12, opacity: 0.82, fontFamily: 'serif',
      }, { pixelScale: 2 });
      return ctx.getImageData(0, 0, 300, 300).data;
    };
    const classic = draw('classic');
    const natural = draw('natural');
    return classic.every((value, index) => value === natural[index]);
  });
  expect(same).toBe(true);
});
