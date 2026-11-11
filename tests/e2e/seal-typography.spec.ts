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

test('traditional seals use different ink-mass rules and render deterministically in real Canvas', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const coverage = await page.evaluate(async () => {
    const modulePath = '/src/export/stampDraw.ts';
    const { drawStampImpression } = await import(/* @vite-ignore */ modulePath);
    const makeImage = (mode: 'zhuwen' | 'baiwen', ratio: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 180 * ratio;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(ratio, ratio);
      ctx.translate(90, 90);
      drawStampImpression(ctx, {
        text: '山水', style: 'square', mode, colorScheme: mode === 'zhuwen' ? 'filled' : 'outline',
        inkColor: '#c82829', weathering: 0, size: 100, rotation: 0,
        opacity: 1, positionX: 50, positionY: 50, fontFamily: 'serif',
      }, { pixelScale: ratio });
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const result: Array<{ ratio: number; redPixels: number; whitePixels: number; stable: boolean }> = [];
    for (const ratio of [1, 2, 3]) {
      const vermilion = makeImage('zhuwen', ratio);
      const white = makeImage('baiwen', ratio);
      const repeat = makeImage('baiwen', ratio);
      const solidPixels = (data: Uint8ClampedArray) => {
        let count = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 160) count++;
        return count;
      };
      result.push({
        ratio, redPixels: solidPixels(vermilion), whitePixels: solidPixels(white),
        stable: white.every((value, index) => value === repeat[index]),
      });
    }
    return result;
  });
  expect(coverage).toHaveLength(3);
  for (const entry of coverage) {
    expect(entry.stable).toBe(true);
    expect(entry.redPixels).toBeGreaterThan(0);
    expect(entry.whitePixels).toBeGreaterThan(entry.redPixels);
  }
});

test('presets update selected seal modes and preserve text/position through undo, redo and reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'Desktop control flow; Canvas test also runs on mobile');
  await page.clock.install();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();
  const input = page.getByRole('textbox', { name: '印章文字' });
  await input.fill('山水天地');
  const mode = page.getByRole('combobox', { name: '印章模式' });
  await expect(mode).toHaveValue('modern');
  // Commit the prepared stamp as a distinct history entry before applying
  // the preset; otherwise Undo may coalesce it with the setup edits (800ms).
  await page.clock.runFor(850);

  await page.getByRole('button', { name: '传统朱文姓名印' }).click();
  await expect(mode).toHaveValue('zhuwen');
  await expect(page.getByRole('combobox', { name: '印章字体' })).toHaveValue(
    '"InkPoem Zhongshan Seal", "Noto Serif SC", serif',
  );
  await expect(input).toHaveValue('山水天地');
  await expect(page.getByRole('note')).toContainText('篆书字库覆盖有限');

  await page.getByRole('button', { name: '撤销' }).click();
  await expect(mode).toHaveValue('modern');
  await page.getByRole('button', { name: '重做' }).click();
  await expect(mode).toHaveValue('zhuwen');

  await expect.poll(async () => page.evaluate(() => {
    const json = localStorage.getItem('inkpoem.editor-state.v1');
    const scene = json ? JSON.parse(json) : null;
    return [scene?.decorations?.stamp?.mode, scene?.decorations?.stamp?.text];
  })).toEqual(['zhuwen', '山水天地']);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await expect(page.getByRole('combobox', { name: '印章模式' })).toHaveValue('zhuwen');
  await expect(page.getByRole('textbox', { name: '印章文字' })).toHaveValue('山水天地');
});

for (const edit of ['mode', 'font'] as const) {
  test(`built-in template keeps user-edited seal ${edit} across a language switch`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'chromium-mobile', 'Desktop settings flow');
    // Restore an actual built-in template: its localized decorations must not
    // replace an explicitly customized seal when the interface language changes.
    await page.addInitScript(() => {
      localStorage.setItem('poem-to-image.active-template', 'graceful-whitespace');
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^装饰与元素/ }).click();
    await expect(page.getByRole('checkbox', { name: '显示印章' })).toBeChecked();
    const mode = page.getByRole('combobox', { name: '印章模式' });
    const font = page.getByRole('combobox', { name: '印章字体' });
    if (edit === 'mode') {
      await mode.selectOption('baiwen');
    } else {
      await font.selectOption('"InkPoem Xiaozhuan", "Noto Serif SC", serif');
    }
    const expectedMode = await mode.inputValue();
    const expectedFont = await font.inputValue();
    await page.getByRole('button', { name: '设置' }).click();
    // English deliberately hides seals; switch to a supported CJK language.
    await page.getByRole('button', { name: '繁體中文', exact: true }).click();
    await page.getByRole('button', { name: '設定' }).click();
    await expect(page.getByRole('combobox', { name: '印章模式' })).toHaveValue(expectedMode);
    await expect(page.getByRole('combobox', { name: '印章字體' })).toHaveValue(expectedFont);
  });
}

test('glyph size and stroke sliders persist through editor reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'Desktop settings flow');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await page.getByRole('checkbox', { name: '显示印章' }).check();
  await expect(page.getByRole('textbox', { name: '印章文字' })).toHaveValue('印');
  const textSize = page.getByRole('slider', { name: '印文字号' });
  const stroke = page.getByRole('slider', { name: '印文笔画粗细' });
  await expect(textSize).toHaveValue('100');
  await expect(stroke).toHaveValue('2');
  await textSize.focus();
  await textSize.press('End');
  await stroke.focus();
  await stroke.press('End');
  await expect(textSize).toHaveValue('110');
  await expect(stroke).toHaveValue('4');
  await expect.poll(async () => page.evaluate(() => {
    const json = localStorage.getItem('inkpoem.editor-state.v1');
    const scene = json ? JSON.parse(json) : null;
    return [scene?.decorations?.stamp?.textScale, scene?.decorations?.stamp?.textStrokeWidthPct];
  })).toEqual([1.1, 4]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^装饰与元素/ }).click();
  await expect(page.getByRole('slider', { name: '印文字号' })).toHaveValue('110');
  await expect(page.getByRole('slider', { name: '印文笔画粗细' })).toHaveValue('4');
});
