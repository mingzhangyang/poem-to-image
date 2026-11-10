import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ context }) => {
  await context.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await context.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
});

async function seedLegacyGuestTemplate(page: Page) {
  await page.addInitScript(() => {
    const legacy = {
      id: 'custom-legacy-sample',
      name: 'Legacy Guest Template',
      createdAt: 123,
      accentFrom: '#ffffff',
      accentTo: '#eeeeee',
      background: {
        backgroundType: 'solid', backgroundColor: '#ffffff',
        gradientColor1: '#ffffff', gradientColor2: '#eeeeee',
        gradientDirection: 'to right', bgBrightness: 100, bgBlur: 0,
      },
      typography: {
        fontFamily: 'serif', fontSize: 32, textColor: '#222222',
        textAlign: 'center', writingMode: 'horizontal-tb',
        padding: 50, lineHeight: 1.5, letterSpacing: 0,
        columns: 1, columnGap: 20,
        textShadowEnabled: false, textShadowColor: '#000000',
        textShadowBlur: 0, textShadowOffsetY: 0, textShadowOffsetX: 0,
      },
      decorations: {
        showBorder: false, borderStyle: 'solid', borderColor: '#222222', borderWidth: 1,
        showStamp: false, stamp: {
          text: '', style: 'square', positionX: 50, positionY: 80,
          size: 10, rotation: 0, opacity: 1, fontFamily: 'serif',
        },
        poemPosition: { positionX: 50, positionY: 50 },
        customTexts: [], logos: [], signatures: [],
      },
    };
    localStorage.setItem('poem-to-image.custom-templates', JSON.stringify([legacy]));
  });
}

test('an unscoped legacy template stays untouched until explicit guest import', async ({ page }) => {
  await seedLegacyGuestTemplate(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Templates/ }).click();
  await expect(page.getByText('Legacy Guest Template', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Older templates were stored without an account identity', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: /Review and import older templates into guest library/ }).click();
  await expect(page.getByText('Legacy Guest Template', { exact: true })).toBeVisible();
  const cache = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('poem-to-image.custom-templates.v2.guest') || '[]') as Array<{ id: string }>,
  );
  expect(cache.map((template) => template.id)).toEqual(['custom-legacy-sample']);
  expect(await page.evaluate(() => localStorage.getItem('poem-to-image.custom-templates'))).not.toBeNull();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Templates/ }).click();
  await expect(page.getByText('Legacy Guest Template', { exact: true })).toBeVisible();
});

test('a background selection made during slow upload transcoding stays selected', async ({ page }) => {
  test.setTimeout(45_000);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    const state = window as Window & { __backgroundTranscodeStarted?: boolean };
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      state.__backgroundTranscodeStarted = true;
      setTimeout(() => original.call(this, callback, type, quality), 900);
    };
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Background/ }).click();
  await page.getByRole('button', { name: 'Image', exact: true }).click();
  // Large *valid* SVG forces image processing without allocating a huge bitmap.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">'
    + '<rect width="64" height="64" fill="navy"/>'
    + ' '.repeat(1_600_000) + '</svg>';
  await page.getByLabel('Upload Image').setInputFiles({
    name: 'large.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg),
  });
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __backgroundTranscodeStarted?: boolean }).__backgroundTranscodeStarted === true,
  )).toBe(true);

  await page.getByRole('button', { name: 'Solid', exact: true }).click();
  await page.waitForTimeout(1_200);
  await expect(page.getByRole('button', { name: 'Solid', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('guest import protects an unsaved template after localStorage quota failure', async ({ page }) => {
  await seedLegacyGuestTemplate(page);
  await page.addInitScript(() => {
    const originalSet = Storage.prototype.setItem;
    const state = window as Window & { __failGuestCacheWrites?: boolean };
    state.__failGuestCacheWrites = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'poem-to-image.custom-templates.v2.guest' && state.__failGuestCacheWrites) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return originalSet.call(this, key, value);
    };
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Templates/ }).click();
  await page.getByRole('button', { name: 'Save as Template' }).click();
  await page.getByPlaceholder('Template name...').fill('Unsaved Guest Template');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByTestId('custom-template-card').getByText('Unsaved Guest Template', { exact: true })).toBeVisible();
  await expect(page.getByText('Legacy Guest Template', { exact: true })).toHaveCount(0);
  const importButton = page.getByRole('button', { name: /Review and import older templates into guest library/ });
  await expect(importButton).toBeDisabled();
  await expect(page.getByText('Save current guest edits with Retry sync', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('poem-to-image.custom-templates.v2.guest'))).toBeNull();

  await page.evaluate(() => {
    (window as Window & { __failGuestCacheWrites?: boolean }).__failGuestCacheWrites = false;
  });
  await page.getByRole('button', { name: 'Retry sync' }).click();
  await expect(importButton).toBeEnabled();
  await importButton.click();
  await expect(page.getByText('Legacy Guest Template', { exact: true })).toBeVisible();
  await expect(page.getByTestId('custom-template-card').getByText('Unsaved Guest Template', { exact: true })).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(
    localStorage.getItem('poem-to-image.custom-templates.v2.guest') || '[]',
  ) as Array<{ name: string }>);
  expect(saved.map((template) => template.name).sort()).toEqual([
    'Legacy Guest Template', 'Unsaved Guest Template',
  ]);
  expect(await page.evaluate(() => localStorage.getItem('poem-to-image.custom-templates'))).not.toBeNull();
});
