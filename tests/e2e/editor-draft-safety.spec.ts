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
  const logo = page.getByRole('img', { name: 'Logo' });
  await expect(logo).toHaveAttribute('src', /^blob:/);
  await expect.poll(async () => (await readDraft(page))?.scene.decorations.logos.length).toBe(1);
});

test('failed IndexedDB reads show recovery controls instead of overwriting stored work', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
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
  await page.evaluate(() => {
    Object.defineProperty(indexedDB, 'open', {
      configurable: true, value: () => { throw new Error('Storage blocked'); },
    });
  });
  await page.getByRole('button', { name: 'Open Editor' }).click();
  await page.getByPlaceholder('Title').fill('Saved after retry');
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByRole('alert')).toContainText('latest changes have not been saved');
  await page.evaluate(() => { Reflect.deleteProperty(indexedDB, 'open'); });
  await page.getByRole('button', { name: 'Retry saving' }).click();
  await expect.poll(async () => (await readDraft(page))?.scene.poem.title).toBe('Saved after retry');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a metadata checkpoint recovers an edit made immediately before navigation', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open Editor' }).click();
  await page.getByPlaceholder('Title').fill('Immediate navigation');
  await page.getByRole('button', { name: 'Done' }).click();
  // The synchronous pagehide checkpoint is valid even before 600ms debounce.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('inkpoem.editor-pending.v2')))
    .not.toBeNull();
  page.on('dialog', (dialog) => { void dialog.accept(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Body').getByText('Immediate navigation')).toBeVisible();
});
