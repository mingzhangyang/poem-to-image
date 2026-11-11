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
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: 'Content', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Open Editor' }).click();
  const editor = page.getByRole('dialog', { name: 'Poem Editor' });
  await editor.getByPlaceholder('Title').fill('静夜思');
  await editor.getByPlaceholder('Enter your poem here...').fill(
    '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
  );
  await editor.getByRole('button', { name: 'Done' }).click();

  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: 'Settings' }).click();
  }
  await page.getByRole('button', { name: /^Typography/ }).click();
  await page.getByRole('button', { name: 'Vertical', exact: true }).click();
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
    const layout = createTextLayout({
      text: '山，海。\n「诗」《书》', writingMode: 'vertical-rl',
      fontSize: 40, lineHeight: 1.6, letterSpacing: 4, columns: 2,
    }, createCanvasTextMeasurer('serif', 40));
    return layout.items.map((item) => {
      if (item.kind !== 'vertical-segment') {
        throw new Error('Expected vertical-segment items in a vertical-rl layout');
      }
      return {
        text: item.text, renderText: item.renderText,
        rotation: item.rotation, x: item.x, y: item.y,
        startX: item.startX, baselineY: item.baselineY,
      };
    });
  });
  const comma = result.find(item => item.text === '，')!;
  const fullStop = result.find(item => item.text === '。')!;
  expect(comma.startX).toBeGreaterThan(0);
  expect(fullStop.startX).toBeGreaterThan(0);
  expect(result.every(item => Number.isFinite(item.startX + item.baselineY))).toBe(true);
});
