import { expect, test } from '@playwright/test';

type Point = { text: string; x: number; y: number };

test('real-browser SVG preview and Canvas PNG export share punctuation positions', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/api/billing/packages', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ packages: [] }),
  }));
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });

    const original = CanvasRenderingContext2D.prototype.fillText;
    const recorded: Point[] = [];
    (window as typeof window & { __verticalPunctuationPaint?: Point[] }).__verticalPunctuationPaint = recorded;
    CanvasRenderingContext2D.prototype.fillText = function (
      text: string, x: number, y: number, maxWidth?: number,
    ) {
      if (['床', '前', '光', '，'].includes(text)) {
        const matrix = this.getTransform();
        const point = new DOMPoint(x, y).matrixTransform(matrix);
        recorded.push({ text, x: point.x, y: point.y });
      }
      return maxWidth === undefined
        ? original.call(this, text, x, y)
        : original.call(this, text, x, y, maxWidth);
    };
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open Editor' }).click();
  const editor = page.getByRole('dialog', { name: 'Poem Editor' });
  await editor.getByPlaceholder('Title').fill('静夜思');
  await editor.getByPlaceholder('Enter your poem here...').fill(
    '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
  );
  await editor.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /^Typography/ }).click();
  await page.getByRole('button', { name: 'Vertical', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);

  const preview: Point[] = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll<SVGTextElement>(
      'svg[data-vertical-text-layout="true"] text[data-original-char]',
    ));
    return elements.map(element => {
      const matrix = element.getScreenCTM();
      if (!matrix) throw new Error('SVG glyph has no screen transform');
      const x = Number(element.getAttribute('x'));
      const y = Number(element.getAttribute('y'));
      const point = new DOMPoint(x, y).matrixTransform(matrix);
      return { text: element.dataset.originalChar ?? '', x: point.x, y: point.y };
    });
  });
  for (const char of ['床', '前', '光', '，']) {
    expect(preview.some(point => point.text === char), 'missing preview ' + char).toBe(true);
  }
  await testInfo.attach('vertical-preview.png', {
    body: await page.screenshot(), contentType: 'image/png',
  });

  await page.getByRole('button', { name: 'Export Image' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export Image' });
  const downloadEvent = page.waitForEvent('download', { timeout: 45_000 });
  await dialog.getByRole('button', { name: 'Copy image' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const exportPath = await download.path();
  if (exportPath) await testInfo.attach('vertical-export.png', { path: exportPath, contentType: 'image/png' });

  const painted: Point[] = await page.evaluate(() => (
    (window as typeof window & { __verticalPunctuationPaint?: Point[] }).__verticalPunctuationPaint ?? []
  ));
  const find = (points: Point[], text: string) => {
    const hit = points.find(point => point.text === text);
    expect(hit, 'missing glyph ' + text).toBeDefined();
    return hit!;
  };
  const firstPreview = find(preview, '床');
  const nextPreview = find(preview, '前');
  const firstPainted = find(painted, '床');
  const nextPainted = find(painted, '前');
  const inkPreview = find(preview, '，');
  const inkPainted = find(painted, '，');
  const priorPreview = find(preview, '光');
  const priorPainted = find(painted, '光');

  // Different preview zoom and exportScale are allowed, but punctuation
  // displacement relative to its previous Han character must be proportional.
  const sourceAdvance = nextPainted.y - firstPainted.y;
  expect(sourceAdvance).toBeGreaterThan(0);
  const factor = (nextPreview.y - firstPreview.y) / sourceAdvance;
  expect(factor).toBeGreaterThan(0);
  expect(Math.abs(
    (inkPreview.x - priorPreview.x) - factor * (inkPainted.x - priorPainted.x),
  )).toBeLessThan(1);
  expect(Math.abs(
    (inkPreview.y - priorPreview.y) - factor * (inkPainted.y - priorPainted.y),
  )).toBeLessThan(1);
});