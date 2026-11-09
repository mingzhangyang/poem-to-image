import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGP0XhDPAANMDEgANwcAQWQBUlRTZ6oAAAAASUVORK5CYII=',
  'base64',
);

async function readDraft(page: Page) {
  return page.evaluate(async () => new Promise<{
    revision: number;
    scene: { poem: { title: string }; background: { backgroundImage: string | null }; decorations: { logos: Array<{ imageUrl: string }> } };
  } | null>((resolve, reject) => {
    const open = indexedDB.open('inkpoem-editor-drafts', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('documents', 'readonly');
      const request = tx.objectStore('documents').get('current');
      request.onsuccess = () => resolve(request.result ?? null);
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => db.close();
    };
  }));
}

test.beforeEach(async ({ context }) => {
  await context.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await context.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
});

test('restores uploaded background blobs and logo images without stripping layers', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /^Background/ }).click();
  await page.getByRole('button', { name: 'Image', exact: true }).click();
  await page.getByLabel('Upload Image').setInputFiles({
    name: 'background.png', mimeType: 'image/png', buffer: image,
  });
  await expect.poll(async () => (await readDraft(page))?.scene.background.backgroundImage)
    .toMatch(/^draft-asset:/);

  await page.getByRole('button', { name: /^Decorations & Elements/ }).click();
  await page.getByLabel('Upload Logo').setInputFiles({
    name: 'logo.png', mimeType: 'image/png', buffer: image,
  });
  await expect.poll(async () => (await readDraft(page))?.scene.decorations.logos[0]?.imageUrl)
    .toMatch(/^draft-asset:/);

  await page.reload({ waitUntil: 'domcontentloaded' });
  const background = page.locator('[data-export-layer="background"]').first();
  await expect.poll(async () => (await background.getAttribute('style')) ?? '')
    .toContain('blob:');
  // A blob: URL in CSS is not enough; StrictMode can revoke it before paint.
  await expect.poll(() => background.evaluate(async (element) => {
    const css = getComputedStyle(element).backgroundImage;
    const url = css.match(/url\(["']?(blob:[^"')]+)["']?\)/)?.[1];
    if (!url) return false;
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      return image.naturalWidth > 0;
    } catch {
      return false;
    }
  })).toBe(true);
  const logo = page.getByRole('img', { name: 'Logo' });
  await expect(logo).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => logo.evaluate(async (element) => {
    const image = element as HTMLImageElement;
    try {
      await image.decode();
      return image.naturalWidth > 0;
    } catch {
      return false;
    }
  })).toBe(true);
  await expect.poll(async () => (await readDraft(page))?.scene.decorations.logos.length).toBe(1);
});

test('failed IndexedDB reads show recovery controls instead of overwriting stored work', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Open Editor' })).toBeVisible();
  await page.evaluate(async () => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('inkpoem-editor-drafts', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('documents', 'readwrite');
      tx.objectStore('documents').put({ version: 2, revision: 42, scene: { corrupted: true } }, 'current');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('alert')).toContainText('could not be opened safely');
  await expect(page.getByRole('button', { name: 'Open Editor' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry loading' })).toBeVisible();
  await expect.poll(async () => (await readDraft(page))?.revision).toBe(42);
});

test('blocked IndexedDB does not permit an unsafe empty editor', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('alert')).toContainText('could not be opened safely');
  await expect(page.getByRole('button', { name: 'Open Editor' })).toHaveCount(0);
});

test('a stale tab cannot overwrite the more recently saved editor revision', async ({ page }) => {
  const staleTab = await page.context().newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await staleTab.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: 'Open Editor' }).click();
  await page.getByPlaceholder('Title').fill('Saved by first tab');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(async () => (await readDraft(page))?.scene.poem.title).toBe('Saved by first tab');

  await staleTab.getByRole('button', { name: 'Open Editor' }).click();
  await staleTab.getByPlaceholder('Title').fill('Different changes from second tab');
  await staleTab.getByRole('button', { name: 'Done' }).click();
  await expect(staleTab.getByRole('alert')).toContainText('Another tab saved a newer artwork');
  await expect.poll(async () => (await readDraft(staleTab))?.scene.poem.title).toBe('Saved by first tab');
  await staleTab.close();
});

test('a save failure remains visible and can be retried without dropping edits', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Open Editor' })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(indexedDB, 'open', {
      configurable: true, value: () => { throw new Error('Storage blocked'); },
    });
  });
  await page.getByRole('button', { name: 'Open Editor' }).click();
  await page.getByPlaceholder('Title').fill('Saved after retry');
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByRole('alert')).toContainText('latest changes have not been saved');
  await page.getByRole('button', { name: 'Open Editor' }).click();
  await page.getByPlaceholder('Title').fill('Latest edit while storage is blocked');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('alert')).toContainText('latest changes have not been saved');
  await page.evaluate(() => { Reflect.deleteProperty(indexedDB, 'open'); });
  await page.getByRole('button', { name: 'Retry saving' }).click();
  await expect.poll(async () => (await readDraft(page))?.scene.poem.title).toBe('Latest edit while storage is blocked');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a metadata checkpoint recovers an edit even when the pagehide save is blocked', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open Editor' }).click();
  await page.getByPlaceholder('Title').fill('Committed baseline');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(async () => (await readDraft(page))?.scene.poem.title).toBe('Committed baseline');
  const baselineRevision = (await readDraft(page))!.revision;

  await page.evaluate(() => {
    Object.defineProperty(indexedDB, 'open', {
      configurable: true, value: () => { throw new Error('Writes blocked until reload'); },
    });
  });
  await page.getByRole('button', { name: 'Open Editor' }).click();
  await page.getByPlaceholder('Title').fill('Recovered from checkpoint');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('inkpoem.editor-pending.v2');
    if (!raw) return null;
    const checkpoint = JSON.parse(raw) as { baseRevision: number; scene: { poem: { title: string } } };
    return { baseRevision: checkpoint.baseRevision, title: checkpoint.scene.poem.title };
  })).toEqual({ baseRevision: baselineRevision, title: 'Recovered from checkpoint' });

  page.on('dialog', (dialog) => { void dialog.accept(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Body').getByText('Recovered from checkpoint')).toBeVisible();
});

test('opening an unchanged persisted scene in another tab never advances its revision', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open Editor' }).click();
  await page.getByPlaceholder('Title').fill('Existing draft must remain unchanged');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(async () => (await readDraft(page))?.scene.poem.title).toBe('Existing draft must remain unchanged');
  const revision = (await readDraft(page))!.revision;

  const secondTab = await page.context().newPage();
  await secondTab.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(secondTab.getByRole('button', { name: 'Open Editor' })).toBeVisible();
  await secondTab.waitForTimeout(1500);
  expect((await readDraft(page))?.revision).toBe(revision);
  await secondTab.close();
});

for (const corruptField of ['stamp', 'logo'] as const) {
  test(`invalid nested ${corruptField} blocks draft hydration safely`, async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Open Editor' }).click();
    await page.getByPlaceholder('Title').fill('Preserve existing draft');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect.poll(async () => (await readDraft(page))?.scene.poem.title).toBe('Preserve existing draft');
    const originalRevision = (await readDraft(page))!.revision;

    await page.evaluate(async (field) => new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('inkpoem-editor-drafts', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('documents', 'readwrite');
        const store = tx.objectStore('documents');
        const request = store.get('current');
        request.onsuccess = () => {
          const record = request.result as {
            scene: { decorations: { stamp?: unknown; logos: unknown[] } };
          };
          if (field === 'stamp') delete record.scene.decorations.stamp;
          else record.scene.decorations.logos.push({ imageUrl: 'missing required logo fields' });
          store.put(record, 'current');
        };
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    }), corruptField);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('alert')).toContainText('could not be opened safely');
    await expect(page.getByRole('button', { name: 'Retry loading' })).toBeVisible();
    await expect.poll(async () => (await readDraft(page))?.revision).toBe(originalRevision);
  });
}

test('restored signatures request their font stylesheet and paint a preview without an edit', async ({ page }) => {
  // Keep this test independent from third-party Google Fonts availability.
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({
    status: 200, contentType: 'text/css', body: '',
  }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Open Editor' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Editor' }).click();
  await page.getByPlaceholder('Title').fill('Signature font restoration');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(async () => (await readDraft(page))?.scene.poem.title).toBe('Signature font restoration');
  const revision = (await readDraft(page))!.revision;

  // Seed an otherwise valid saved document with a signature, bypassing the
  // add-signature action that formerly performed font initialization.
  await page.evaluate(async () => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('inkpoem-editor-drafts', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('documents', 'readwrite');
      const store = tx.objectStore('documents');
      const read = store.get('current');
      read.onsuccess = () => {
        const record = read.result as {
          scene: { decorations: { signatures: unknown[] } };
        };
        record.scene.decorations.signatures = [{
          id: 'restored-signature', text: 'InkPoem', font: 'Great Vibes',
          color: '#101010', fontSize: 38, slant: -8, thickness: 0,
          flourish: 'swoosh', positionX: 50, positionY: 80, opacity: 1,
          rotation: 0,
        }];
        store.put(record, 'current');
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));

  await page.reload({ waitUntil: 'domcontentloaded' });
  const canvas = page.locator('[aria-label*="signature" i] canvas').first();
  await expect(canvas).toBeVisible();
  await expect(page.locator('link[data-signature-fonts="true"]')).toHaveCount(1);
  await expect.poll(async () => canvas.evaluate((element) => {
    const surface = element as HTMLCanvasElement;
    const context = surface.getContext('2d');
    if (!context) return false;
    const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) return true;
    }
    return false;
  })).toBe(true);
  await page.waitForTimeout(1000);
  expect((await readDraft(page))?.revision).toBe(revision);
});
