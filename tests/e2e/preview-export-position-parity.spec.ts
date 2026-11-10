import { expect, test, type Page } from '@playwright/test';

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

interface SavedPosition {
  positionX: number;
  positionY: number;
  exportLeft?: number;
  exportTop?: number;
  boxWidth?: number;
}

async function readSavedPoemPosition(page: Page): Promise<SavedPosition | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('inkpoem.editor-state.v1');
    return raw ? (JSON.parse(raw) as { decorations?: { poemPosition?: SavedPosition } })
      .decorations?.poemPosition ?? null : null;
  });
}

async function setShortPoem(page: Page) {
  await page.getByRole('button', { name: 'Open Editor' }).click();
  const dialog = page.getByRole('dialog', { name: 'Poem Editor' });
  await dialog.getByPlaceholder('Title').fill('Short title');
  await dialog.getByPlaceholder('Enter your poem here...').fill('One short line.');
  await dialog.getByRole('button', { name: 'Done' }).click();
}

test('zoomed preview drag uses the same percentage center saved for Canvas export', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await setShortPoem(page);
  const poemBody = page.locator('[aria-label="Body"][tabindex="0"]');
  await expect(poemBody).toBeVisible();

  // Ensure the pointer is measured in CSS pixels after the preview is scaled.
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const frame = await poemBody.locator('xpath=../..').boundingBox();
  const body = await poemBody.boundingBox();
  expect(frame).not.toBeNull();
  expect(body).not.toBeNull();

  const initial = await poemBody.evaluate((element) => {
    const positioned = element.parentElement;
    if (!positioned) throw new Error('Poem container missing');
    return {
      x: Number.parseFloat(positioned.style.left),
      y: Number.parseFloat(positioned.style.top),
    };
  });
  const start = { x: body!.x + body!.width / 2, y: body!.y + body!.height / 2 };
  const delta = { x: 36, y: 24 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 8 });
  await page.mouse.up();
  const targetX = initial.x + (delta.x / frame!.width) * 100;
  const targetY = initial.y + (delta.y / frame!.height) * 100;

  await expect.poll(async () => (await readSavedPoemPosition(page))?.positionX)
    .toBeGreaterThan(initial.x);
  const saved = await readSavedPoemPosition(page);
  expect(saved).not.toBeNull();
  expect(Math.abs(saved!.positionX - targetX)).toBeLessThan(2);
  expect(Math.abs(saved!.positionY - targetY)).toBeLessThan(2);

  // DOM measurement stores an accurate left/top for export after pointer drag.
  expect(saved!.exportLeft).toBeDefined();
  expect(saved!.exportTop).toBeDefined();

  // Arrow movement supersedes old readback coordinates. Canvas must use the
  // newly selected center, not the old measured box's stale exportLeft/Top.
  await poemBody.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await readSavedPoemPosition(page))?.positionX)
    .toBeGreaterThan(saved!.positionX);
  const after = await readSavedPoemPosition(page);
  expect(after?.exportLeft).toBeUndefined();
  expect(after?.exportTop).toBeUndefined();
});

test('narrow viewport keyboard positioning keeps the restored document in sync', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await setShortPoem(page);
  const body = page.locator('[aria-label="Body"][tabindex="0"]');
  await expect(body).toBeVisible();
  await body.focus();
  await page.keyboard.press('Shift+ArrowDown');
  await expect.poll(async () => (await readSavedPoemPosition(page))?.positionY)
    .toBeGreaterThan(50);
  const beforeReload = await readSavedPoemPosition(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(async () => (await readSavedPoemPosition(page))?.positionY)
    .toBe(beforeReload!.positionY);
});
