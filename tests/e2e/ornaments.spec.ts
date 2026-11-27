import { readDraft } from './helpers/readDraft';
import sharp from 'sharp';
import { test, expect, type Page } from '@playwright/test';
import { isDesktopLayout, openPanel } from './helpers/sidebarNavigation';

/** Opens the ornament gallery inside the Decorations panel (a drawer on mobile). */
async function openOrnaments(page: Page, labels: { decorations: string; ornaments: string }) {
  await openPanel(page, labels.decorations);
  await page.getByRole('button', { name: new RegExp(`^${labels.ornaments}`) }).click();
  return !isDesktopLayout(page);
}

test('filters, places, restores and exports an ornament', async ({ page }) => {
  await page.route('**/api/billing/packages', route => route.fulfill({ json: { packages: [] } }));
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'showSaveFilePicker');
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
  const originals: string[] = [];
  page.on('request', request => {
    if (/\/ornaments\/[^/]+\.(png|webp)$/.test(request.url())) originals.push(request.url());
  });
  await page.goto('/');
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const isMobile = await openOrnaments(page, { decorations: 'Decor', ornaments: 'Ornaments' });
  await button('Autumn').click();
  await expect(button('Chrysanthemum')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Birds' })).toHaveCount(0);
  expect(originals).toEqual([]);
  await button('Chrysanthemum').click();
  await page.getByRole('slider', { name: 'Rotation', exact: true }).fill('15');
  await page.getByRole('slider', { name: 'Opacity', exact: true }).fill('0.72');
  await button('Move above text').click();
  await button('Bottom right').click();
  const images = page.locator('img[alt="Chrysanthemum"]');
  await expect(images).toHaveCount(1);
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    const layer = images.first().locator('..');
    await layer.hover();
    const grip = layer.getByRole('button', { name: 'Size' }).last();
    const initialWidth = await layer.evaluate(el => el.clientWidth);
    const box = (await grip.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 6, y + 6, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => layer.evaluate(el => el.clientWidth)).toBeGreaterThan(initialWidth);
    const center = (await layer.boundingBox())!;
    await page.mouse.move(center.x + center.width / 2, center.y + center.height / 2);
    await page.mouse.down();
    await page.mouse.move(center.x, center.y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await layer.boundingBox())!.x).toBeLessThan(center.x - 2);
    await button('Bottom right').click();
  }
  await button('Flip horizontally').click();
  await button('Duplicate').click();
  await button('Duplicate').click();
  const reminder = page.getByText('A little goes a long way. Let the poem lead.').filter({ visible: true });
  await expect(reminder).toBeVisible();
  await button('Duplicate').click();
  await button('Duplicate').click();
  await expect(page.getByText('Several ornaments may draw attention away from the poem.').filter({ visible: true })).toBeVisible();
  await button('Delete').click();
  await button('Delete').click();
  await button('Delete').click();
  await expect(reminder).toHaveCount(0);
  // The mobile controls drawer is modal; close it to reach the toolbar.
  if (isMobile) await page.keyboard.press('Escape');
  await button('Undo').click();
  await expect(images).toHaveCount(3);
  await button('Redo').click();
  await expect(images).toHaveCount(2);
  await page.reload();
  await expect(images).toHaveCount(2);
  await expect(images.first()).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await openPanel(page, 'Typography');
    await page.getByRole('combobox', { name: 'Font Family' }).selectOption('system-ui, sans-serif');
    const artwork = page.locator('[data-artwork-canvas]');
    const canvasBox = (await artwork.boundingBox())!;
    const flowerBox = (await images.first().boundingBox())!;
    const preview = await images.first().screenshot();
    await button('Export Image').click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('dialog').getByRole('button', {name: 'Save Image', exact: true}).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const exported = sharp((await download.path())!);
    const { width, height } = await exported.metadata();
    expect([width, height]).toEqual([2160, 2700]);
    const scale = width / canvasBox.width;
    const exportedRegion = exported.extract({
      left: Math.round((flowerBox.x - canvasBox.x) * scale),
      top: Math.round((flowerBox.y - canvasBox.y) * scale),
      width: Math.round(flowerBox.width * scale),
      height: Math.round(flowerBox.height * scale),
    });
    const samples = await Promise.all([sharp(preview), exportedRegion].map(image =>
      image.resize(32, 32).removeAlpha().raw().toBuffer()));
    const deviation = samples[0].reduce((sum, value, i) => sum + Math.abs(value - samples[1][i]), 0);
    expect(deviation / samples[0].length).toBeLessThan(5);

    await openPanel(page, 'Templates');
    await page.getByRole('button', { name: /^More \(/ }).click();
    await page.getByRole('dialog', { name: 'Built-in Templates' }).getByRole('button', { name: /Song Floral/ }).click();
    await expect(images).toHaveCount(2);
    await openPanel(page, 'Background');
    await button('Solid').click();
    await expect(images).toHaveCount(2);
    await button('Image').click();
    const paper = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#eee7d4' } }).png().toBuffer();
    await page.getByLabel('Upload Image').setInputFiles({
      name: 'paper.png', mimeType: 'image/png', buffer: paper,
    });
    const background = page.locator('[data-export-layer="background"]').first();
    await expect(background).toHaveCSS('background-image', /blob:/);
    await expect.poll(async () => (await readDraft(page))?.scene.background.backgroundImage).toMatch(/^draft-asset:/);
    await page.reload();
    await expect(background).toHaveCSS('background-image', /blob:/);
    await expect(images).toHaveCount(2);
  }
});

test('exports a Chinese autumn chrysanthemum card within 30 seconds', async ({ page, isMobile }) => {
  test.setTimeout(30_000);
  await page.route('**/api/billing/packages', route => route.fulfill({ json: { packages: [] } }));
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'showSaveFilePicker');
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'zh-CN');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const button = (name: string | RegExp) => page.getByRole('button', { name, exact: true });
  await openOrnaments(page, { decorations: '装饰', ornaments: '装饰图案' });
  await button('秋意').click();
  await button(/菊/).click();
  await button('右下').click();
  if (isMobile) await page.keyboard.press('Escape');
  await button(isMobile ? '导出' : '导出图片').click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: '保存图片' }).click();
  expect((await downloading).suggestedFilename()).toMatch(/\.png$/);
});

test('drags a banded ornament through the canvas padding until its visible ink touches the canvas edge', async ({ page }) => {
  await page.route('**/api/billing/packages', route => route.fulfill({ json: { packages: [] } }));
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
  await page.goto('/');
  const isMobile = await openOrnaments(page, { decorations: 'Decor', ornaments: 'Ornaments' });
  await page.getByRole('button', { name: 'Greek Key Border', exact: true }).click();
  if (isMobile) {
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-controls-drawer')).toBeHidden();
  }

  const image = page.locator('img[alt="Greek Key Border"]');
  const layer = image.locator('..');
  const imageBox = (await image.boundingBox())!;
  const layerBox = (await layer.boundingBox())!;
  // The box that is selected and dragged is the band, not the image's transparent square.
  expect(layerBox.height).toBeLessThan(imageBox.height * 0.25);

  // Canvas padding keeps text off the paper edge; ornaments may use it.
  const canvas = (await page.locator('[data-artwork-canvas]').boundingBox())!;
  const padding = await page.locator('[data-artwork-canvas]').evaluate(el => parseFloat(getComputedStyle(el).paddingTop));
  expect(padding).toBeGreaterThan(0);
  const dragTo = async (dx: number, dy: number) => {
    const box = (await layer.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 6 });
    await page.mouse.up();
    return (await layer.boundingBox())!;
  };
  const top = await dragTo(0, -canvas.height);
  expect(Math.abs(top.y - canvas.y)).toBeLessThan(2);
  const bottom = await dragTo(0, canvas.height * 2);
  expect(Math.abs(bottom.y + bottom.height - (canvas.y + canvas.height))).toBeLessThan(2);
  const left = await dragTo(-canvas.width, 0);
  expect(Math.abs(left.x - canvas.x)).toBeLessThan(2);

  // Corner placement also measures from the canvas edge, not the padding.
  if (isMobile) {
    await openPanel(page, 'Decor');
    const gallery = page.getByRole('button', { name: /^Ornaments/ });
    if (await gallery.getAttribute('aria-expanded') !== 'true') await gallery.click();
  }
  await page.getByRole('button', { name: 'Top left', exact: true }).click();
  if (isMobile) {
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-controls-drawer')).toBeHidden();
  }
  const corner = (await layer.boundingBox())!;
  expect(corner.x - canvas.x).toBeCloseTo(canvas.width * 0.03, 0);
  expect(corner.y - canvas.y).toBeCloseTo(canvas.height * 0.03, 0);
});
