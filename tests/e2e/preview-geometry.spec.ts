import { expect, test, type Locator, type Page } from '@playwright/test';

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

interface SavedPoemPosition {
  positionX: number;
  positionY: number;
  boxWidth?: number;
  exportLeft?: number;
  exportTop?: number;
}

// IndexedDB is the authoritative Phase 3 document store. The legacy
// localStorage mirror is best-effort and can lag behind the committed scene.
async function readSavedPoemPosition(page: Page): Promise<SavedPoemPosition | null> {
  return page.evaluate(() => new Promise<SavedPoemPosition | null>((resolve, reject) => {
    const open = indexedDB.open('inkpoem-editor-drafts', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction('documents', 'readonly');
      const read = transaction.objectStore('documents').get('current');
      read.onsuccess = () => resolve(read.result?.scene?.decorations?.poemPosition ?? null);
      read.onerror = () => reject(read.error);
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => db.close();
    };
  }));
}

// A default horizontal poem occupies the full frame and is correctly clamped
// at x=50. Narrow it using the real keyboard resize path before movement tests.
async function narrowPoemBox(page: Page, handle: Locator): Promise<void> {
  await handle.focus();
  for (let index = 0; index < 12; index += 1) {
    await handle.press('Alt+ArrowLeft');
  }
  await expect.poll(async () => (await readSavedPoemPosition(page))?.boxWidth ?? 100).toBeLessThan(80);
}

test('poem arrow-key positioning is zoom-independent and restores across reload', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const poemHandle = page.locator('[aria-label="Body"][tabindex="0"]');
  await expect(poemHandle).toBeVisible();
  await narrowPoemBox(page, poemHandle);

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

  await expect.poll(async () => {
    const position = await readSavedPoemPosition(page);
    return position ? [position.positionX, position.positionY] : null;
  }).toEqual([zoomed.x, zoomed.y]);

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
  const poem = page.locator('[aria-label="Body"][tabindex="0"]');
  await expect(poem).toBeVisible();
  await narrowPoemBox(page, poem);
  await page.getByRole('button', { name: /Zoom in/i }).click();
  const holder = poem.locator('..');

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

  await expect.poll(async () => {
    const position = await readSavedPoemPosition(page);
    return position !== null && position.exportLeft !== undefined && position.exportTop !== undefined;
  }).toBe(true);

  // Dragging records an explicit preview top-left for Canvas export. A later
  // keyboard move must clear this old anchor or export ignores the new center.
  await poem.focus();
  await poem.press('ArrowRight');
  await expect.poll(async () => {
    const position = await readSavedPoemPosition(page);
    return position !== null && position.exportLeft === undefined && position.exportTop === undefined;
  }).toBe(true);
  const movedX = (await readSavedPoemPosition(page))?.positionX;
  expect(movedX).toBeDefined();
  expect(movedX!).toBeCloseTo(after.x + 1, 3);
});
