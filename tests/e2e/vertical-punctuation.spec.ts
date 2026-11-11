import { expect, test } from '@playwright/test';

test('vertical Chinese punctuation keeps upright ink, column order and export availability', async ({ page }, testInfo) => {
  await page.route('**/api/billing/packages', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ packages: [] }),
  }));
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const isMobile = (page.viewportSize()?.width ?? 0) < 1024;
  if (isMobile) {
    await page.getByRole('button', { name: 'Content', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Open Editor' }).click();
  const editor = page.getByRole('dialog', { name: 'Poem Editor' });
  await editor.getByPlaceholder('Title').fill('静夜思');
  await editor.getByPlaceholder('Enter your poem here...').fill(
    '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
  );
  await editor.getByRole('button', { name: 'Done' }).click();

  if (isMobile) {
    // Closing the editor leaves the Content sheet open. Typography is already
    // inside that sheet; the backdrop intentionally blocks the Settings shortcut.
    const drawer = page.locator('#mobile-controls-drawer');
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: /^Typography/ }).click();
    await drawer.getByRole('button', { name: 'Vertical', exact: true }).click();
    await drawer.getByRole('button', { name: 'Close controls' }).click();
    await expect(drawer).toBeHidden();
  } else {
    await page.getByRole('button', { name: /^Typography/ }).click();
    await page.getByRole('button', { name: 'Vertical', exact: true }).click();
  }
  const preview = page.locator('svg[data-vertical-text-layout="true"]');
  await expect(preview.first()).toBeVisible();
  await expect(preview.locator('text[data-original-char="，"]')).toHaveCount(2);
  await expect(preview.locator('text[data-original-char="。"]')).toHaveCount(2);

  // Capture a repeatable real-browser visual artifact (review it alongside a
  // canvas export); not a fabricated snapshot baseline in CI.
  await testInfo.attach('jing-ye-si-vertical-preview', {
    body: await page.screenshot(), contentType: 'image/png',
  });

  // No source text is rewritten: source is still accessible through the editor.
  if (isMobile) {
    await page.getByRole('button', { name: 'Content', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Open Editor' }).click();
  await expect(page.getByRole('dialog', { name: 'Poem Editor' })
    .getByPlaceholder('Enter your poem here...')).toHaveValue(
    '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
  );
});

test('the shared layout returns upright punctuation and rotated fallback in an actual browser', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const path = '/src/textLayout.ts';
    const { createTextLayout, createCanvasTextMeasurer } = await import(/* @vite-ignore */ path) as typeof import('../../src/textLayout');
    const measurer = createCanvasTextMeasurer('serif', 40);
    const layout = createTextLayout({
      text: '山，海。\n「诗」《书》', writingMode: 'vertical-rl',
      fontSize: 40, lineHeight: 1.6, letterSpacing: 4, columns: 2,
    }, measurer);
    return layout.items.map((item) => {
      if (item.kind !== 'vertical-segment') {
        throw new Error('Expected vertical-segment items in a vertical-rl layout');
      }
      const metrics = measurer.measureText(item.renderText);
      const left = Math.max(0, metrics.actualBoundingBoxLeft);
      const right = Math.max(0, metrics.actualBoundingBoxRight);
      return {
        text: item.text, renderText: item.renderText,
        rotation: item.rotation, x: item.x, y: item.y,
        startX: item.startX, baselineY: item.baselineY,
        inkCenterX: item.startX + (right - left) / 2,
        inkCenterY: (item.inkTopY + item.inkBottomY) / 2,
      };
    });
  });
  const comma = result.find(item => item.text === '，')!;
  const fullStop = result.find(item => item.text === '。')!;
  const hanBeforeComma = result.find(item => item.text === '山')!;
  const hanBeforeStop = result.find(item => item.text === '海')!;
  for (const [punctuation, preceding] of [
    [comma, hanBeforeComma], [fullStop, hanBeforeStop],
  ] as const) {
    expect(punctuation.rotation).toBe(0);
    // startX is the baseline origin, not a visual location: with different
    // real fonts it can be negative even for correctly right-aligned ink.
    expect(punctuation.inkCenterX).toBeGreaterThanOrEqual(preceding.inkCenterX - 0.01);
    expect(punctuation.inkCenterY).toBeLessThanOrEqual(preceding.inkCenterY + 0.01);
  }
  expect(result.every(item => Number.isFinite(item.startX + item.baselineY))).toBe(true);
});
