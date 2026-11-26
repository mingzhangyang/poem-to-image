import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { openPanel } from './helpers/sidebarNavigation';


const postcardBackground = '/template-backgrounds/postcard-vintage-travel.svg';
const editedVerse = 'A blue tide meets the page\nAn ink boat follows home';

// Compare the downloaded PNG with the SVG itself, not just the file signature.
// The SVG is the only background layer; the exporter adds a 10% black wash.
async function inspectPostcardPixels(page: Page, png: Buffer) {
  return page.evaluate(async ({ pngBase64, svgUrl }) => {
    const load = async (src: string) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return image;
    };
    const exported = await load('data:image/png;base64,' + pngBase64);
    const svg = await load(svgUrl);
    // Normalize both images to the artwork's native 960x1200 dimensions.
    const width = 960;
    const height = 1200;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    ctx.drawImage(exported, 0, 0, width, height);
    const actual = ctx.getImageData(0, 0, width, height).data;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(svg, 0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, width, height);
    const backgroundOnly = ctx.getImageData(0, 0, width, height).data;

    const rgb = (pixels: Uint8ClampedArray, x: number, y: number) => {
      const offset = (y * width + x) * 4;
      return [pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!];
    };
    const difference = (left: number[], right: number[]) =>
      left.reduce((sum, channel, index) => sum + Math.abs(channel - right[index]!), 0);
    const paper = rgb(backgroundOnly, 320, 360);
    const stamp = rgb(backgroundOnly, 816, 216);
    const coastline = rgb(backgroundOnly, 480, 1092);

    // With no title, author, source, stamp or custom layers, any differences in
    // this quiet center must be the edited poem body drawn by the exporter.
    let verseInkSamples = 0;
    for (let y = 290; y < 850; y += 4) {
      for (let x = 200; x < 760; x += 4) {
        const delta = difference(rgb(actual, x, y), rgb(backgroundOnly, x, y));
        if (delta > 90) verseInkSamples += 1;
      }
    }

    return {
      pngSize: [exported.naturalWidth, exported.naturalHeight],
      stampContrast: difference(stamp, paper),
      coastlineContrast: difference(coastline, paper),
      stampError: difference(rgb(actual, 816, 216), stamp),
      coastlineError: difference(rgb(actual, 480, 1092), coastline),
      verseInkSamples,
    };
  }, { pngBase64: png.toString('base64'), svgUrl: postcardBackground });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });
});

test('postcard gallery artwork loads and the edited postcard survives reload and PNG export', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const isMobile = (page.viewportSize()?.width ?? 0) < 1024;
  await openPanel(page, 'Templates');
  await page.getByRole('button', { name: /^More \(/ }).click();
  const library = page.getByRole('dialog', { name: 'Built-in Templates' });

  for (const name of ['Vintage Travel Postcard', 'Poetry Postcard', 'Botanical Postcard']) {
    const card = library.getByRole('button', { name: new RegExp(name) });
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveCount(1);
    await expect.poll(() => card.locator('img').evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
    )).toBe(true);
  }

  await library.getByRole('button', { name: /Vintage Travel Postcard/ }).click();
  await expect(library).toBeHidden();
  const expected = '/template-backgrounds/postcard-vintage-travel.svg';
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return [draft?.background?.backgroundImage, draft?.background?.backgroundSize];
  })).toEqual([expected, 'stretch']);


  if (isMobile) {
    const drawer = page.getByRole('dialog', { name: 'Templates', exact: true });
    await drawer.getByRole('button', { name: 'Close controls', exact: true }).click();
    await expect(drawer).toBeHidden();
  }
  await openPanel(page, 'Content');
  await page.getByRole('button', { name: 'Open Editor' }).click();
  const editor = page.getByRole('dialog', { name: 'Poem Editor' });
  await editor.locator('#poem-editor-title-input').fill('');
  await editor.locator('#poem-editor-author-input').fill('');
  await editor.locator('#poem-editor-source-input').fill('');
  await editor.locator('#poem-editor-body-input').fill(editedVerse);
  await editor.getByRole('button', { name: 'Done' }).click();
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return [draft?.poem?.title, draft?.poem?.body, draft?.poem?.author, draft?.poem?.sourceNote];
  })).toEqual(['', editedVerse, '', '']);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-export-layer="background"]').first()).toHaveCSS('background-size', '100% 100%');
  await expect(page.getByLabel('Body')).toContainText('A blue tide meets the page');
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return draft?.poem?.body;
  })).toBe(editedVerse);

  await page.getByRole('button', { name: isMobile ? 'Export' : 'Export Image', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export Image' });
  const download = page.waitForEvent('download', { timeout: 30_000 });
  await dialog.getByRole('button', { name: 'Copy image' }).click();
  const data = await readFile(await (await download).path());
  expect(data.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(data.length).toBeGreaterThan(100_000);

  const proof = await inspectPostcardPixels(page, data);
  expect(proof.pngSize[0]).toBeGreaterThanOrEqual(960);
  expect(proof.pngSize[1]).toBeGreaterThanOrEqual(1200);
  // Confirm both landmarks are distinctive *and* match the exported artwork.
  expect(proof.stampContrast).toBeGreaterThan(60);
  expect(proof.coastlineContrast).toBeGreaterThan(60);
  expect(proof.stampError).toBeLessThan(25);
  expect(proof.coastlineError).toBeLessThan(25);
  // Detect missing poem text even when the downloaded PNG itself is valid.
  expect(proof.verseInkSamples).toBeGreaterThan(100);
});
