import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
});

test('poem arrow-key positioning is zoom-independent and restores across reload', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const poemHandle = page.locator('[aria-label="Body"][tabindex="0"]');
  await expect(poemHandle).toBeVisible();

  const getPercentPosition = () => poemHandle.evaluate((element) => ({
    x: Number.parseFloat((element.parentElement as HTMLElement).style.left),
    y: Number.parseFloat((element.parentElement as HTMLElement).style.top),
  }));
  const original = await getPercentPosition();
  await poemHandle.focus();
  await poemHandle.press('ArrowRight');
  await poemHandle.press('Shift+ArrowDown');
  const moved = await getPercentPosition();
  expect(moved.x - original.x).toBeCloseTo(1, 5);
  expect(moved.y - original.y).toBeCloseTo(3, 5);

  await page.getByRole('button', { name: /Zoom in/i }).click();
  await poemHandle.focus();
  await poemHandle.press('ArrowLeft');
  const zoomed = await getPercentPosition();
  expect(zoomed.x).toBeCloseTo(original.x, 5);
  expect(zoomed.y).toBeCloseTo(moved.y, 5);

  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('inkpoem.editor-state.v1');
    if (!raw) return null;
    const position = JSON.parse(raw).decorations?.poemPosition;
    return position ? [position.positionX, position.positionY] : null;
  })).toEqual([zoomed.x, zoomed.y]);

  await page.reload({ waitUntil: 'domcontentloaded' });
  const reloaded = page.locator('[aria-label="Body"][tabindex="0"]');
  await expect(reloaded).toBeVisible();
  const restored = await reloaded.evaluate((element) => ({
    x: Number.parseFloat((element.parentElement as HTMLElement).style.left),
    y: Number.parseFloat((element.parentElement as HTMLElement).style.top),
  }));
  expect(restored.x).toBeCloseTo(zoomed.x, 5);
  expect(restored.y).toBeCloseTo(zoomed.y, 5);
});

test('dragging poem position at enlarged zoom preserves normalized coordinates', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Zoom in/i }).click();
  const poem = page.locator('[aria-label="Body"][tabindex="0"]');
  const holder = poem.locator('..');
  await expect(poem).toBeVisible();

  const before = await holder.evaluate((el) => ({
    x: Number.parseFloat((el as HTMLElement).style.left),
    y: Number.parseFloat((el as HTMLElement).style.top),
  }));
  const inner = await poem.boundingBox();
  const frame = await page.locator('div[aria-label="Body"]').evaluate((el) => {
    const parent = el.closest('.absolute.z-10.pointer-events-none')?.parentElement as HTMLElement | null;
    const rect = parent?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  });
  expect(inner).not.toBeNull();
  expect(frame).not.toBeNull();
  const startX = inner!.x + inner!.width / 2;
  const startY = inner!.y + inner!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 20, startY + 10, { steps: 4 });
  await page.mouse.up();

  const after = await holder.evaluate((el) => ({
    x: Number.parseFloat((el as HTMLElement).style.left),
    y: Number.parseFloat((el as HTMLElement).style.top),
  }));
  expect(after.x).toBeGreaterThan(before.x);
  expect(after.y).toBeGreaterThan(before.y);
  expect(after.x - before.x).toBeCloseTo(20 / frame!.width * 100, 0);
  expect(after.y - before.y).toBeCloseTo(10 / frame!.height * 100, 0);

  // Dragging records an explicit preview top-left for Canvas export. A later
  // keyboard move must clear this old anchor or export ignores the new center.
  await poem.focus();
  await poem.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('inkpoem.editor-state.v1');
    if (!raw) return false;
    const position = JSON.parse(raw).decorations?.poemPosition;
    return position && position.exportLeft === undefined && position.exportTop === undefined;
  })).toBe(true);
  const movedX = await page.evaluate(() => {
    const raw = localStorage.getItem('inkpoem.editor-state.v1');
    return JSON.parse(raw || 'null')?.decorations?.poemPosition?.positionX as number;
  });
  expect(movedX).toBeCloseTo(after.x + 1, 3);
});
