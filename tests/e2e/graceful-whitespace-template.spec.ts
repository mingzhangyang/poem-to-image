import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    if (!localStorage.getItem('poem-to-image.language')) {
      localStorage.setItem('poem-to-image.language', 'en');
    }
  });
});

async function openTemplates(page: Page) {
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;
  await page.getByRole('button', { name: mobile ? 'Templates' : /^Templates/, exact: mobile }).click();
}

/** Assert card's seal/signature is entirely inside the reserved artwork, not under caption. */
async function expectPreviewDecorationAboveCaption(card: ReturnType<Page['getByRole']>, decoration: string) {
  const art = card.getByTestId('graceful-gallery-artwork');
  const caption = card.getByTestId('graceful-gallery-caption');
  const signOff = card.getByTestId(decoration);
  await expect(art).toBeVisible();
  await expect(caption).toBeVisible();
  await expect(signOff).toBeVisible();
  const [artRect, captionRect, decorationRect] = await Promise.all([
    art.boundingBox(),
    caption.boundingBox(),
    signOff.boundingBox(),
  ]);
  expect(artRect).not.toBeNull();
  expect(captionRect).not.toBeNull();
  expect(decorationRect).not.toBeNull();
  if (!artRect || !captionRect || !decorationRect) return;
  expect(artRect.height).toBeGreaterThan(100);
  expect(artRect.y + artRect.height).toBeLessThanOrEqual(captionRect.y + 1);
  expect(decorationRect.y).toBeGreaterThanOrEqual(artRect.y - 1);
  expect(decorationRect.y + decorationRect.height).toBeLessThanOrEqual(captionRect.y + 1);
}

async function applyGracefulWhitespace(page: Page) {
  await openTemplates(page);
  await page.getByRole('button', { name: /^More \(/ }).click();
  const library = page.getByRole('dialog', { name: 'Built-in Templates' });
  await expect(library).toBeVisible();
  const card = library.getByRole('button', { name: /Graceful Whitespace/ });
  await expect(card).toBeVisible();
  // Latin layouts use real paper, not a preview SVG with a Chinese seal.
  await expect(card.locator('img')).toHaveCount(0);
  await expect(card.getByTestId('template-preview-sample')).toBeVisible();
  await expect(card.getByTestId('template-preview-signature')).toContainText('the poet');
  await expectPreviewDecorationAboveCaption(card, 'template-preview-signature');
  await card.click();
  await expect(library).toBeHidden();
}

test('Latin Graceful Whitespace renders a handwritten signature but no seal, and survives reload', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await applyGracefulWhitespace(page);
  const signature = page.getByLabel('Signature element');
  await expect(page.getByLabel('Stamp element')).toHaveCount(0);
  await expect(signature).toBeVisible();
  await expect.poll(() => signature.locator('canvas').evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) return false;
    const pixels = element.getContext('2d')?.getImageData(0, 0, element.width, element.height).data;
    return pixels?.some((channel, index) => index % 4 === 3 && channel > 0) ?? false;
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return [
      saved?.background?.backgroundType,
      saved?.background?.paperId,
      saved?.decorations?.showStamp,
      saved?.decorations?.signatures?.[0]?.text,
      saved?.typography?.writingMode,
    ];
  })).toEqual(['paper', 'ivory', false, 'the poet', 'horizontal-tb']);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Signature element')).toBeVisible();
  await expect(page.getByLabel('Stamp element')).toHaveCount(0);
  await openTemplates(page);
  await page.getByRole('button', { name: /^More \(/ }).click();
  const restored = page.getByRole('dialog', { name: 'Built-in Templates' })
    .getByRole('button', { name: /Graceful Whitespace/ });
  await expect(restored).toHaveAttribute('aria-pressed', 'true');
});

test('a custom copy keeps its handwriting and drops it when another template is applied', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await applyGracefulWhitespace(page);
  const signature = page.getByLabel('Signature element');
  await expect(signature).toBeVisible();

  await page.getByRole('button', { name: 'Save as Template' }).click();
  await page.getByPlaceholder('Template name...').fill('Graceful Copy');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const copies = JSON.parse(localStorage.getItem('poem-to-image.custom-templates.v2.guest') || '[]');
    const saved = copies.find((copy: { name: string }) => copy.name === 'Graceful Copy');
    return [saved?.decorations?.showStamp, saved?.decorations?.signatures?.[0]?.text, saved?.decorations?.signatures?.[0]?.font];
  })).toEqual([false, 'the poet', 'Mr Dafoe']);
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem('poem-to-image.active-template'),
  )).toBe(null);
  await expect(signature).toBeVisible();

  await page.getByRole('button', { name: /^More \(/ }).click();
  await page.getByRole('dialog', { name: 'Built-in Templates' })
    .getByRole('button', { name: /Modern Minimal/ }).click();
  await expect(signature).toHaveCount(0);

  const savedName = page.getByText('Graceful Copy', { exact: true }).and(page.locator(':visible'));
  await savedName.locator('xpath=../..').getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(signature).toBeVisible();
  await expect(page.getByLabel('Stamp element')).toHaveCount(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(signature).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('inkpoem.editor-state.v1') || 'null');
    return [draft?.decorations?.showStamp, draft?.decorations?.signatures?.[0]?.text, draft?.decorations?.signatures?.[0]?.font];
  })).toEqual([false, 'the poet', 'Mr Dafoe']);
});

test('Chinese variant previews exactly one poem and keeps its seal, without Latin handwriting', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('poem-to-image.language', 'zh-CN'));
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /^模板主题/ }).click();
  await page.getByRole('button', { name: /^更多 \(/ }).click();
  const library = page.getByRole('dialog', { name: '系统模板' });
  const card = library.getByRole('button', { name: /婉约留白/ });
  await expect(card).toBeVisible();
  // The expanded card uses live paper/text; SVG already contains a poem.
  await expect(card.locator('img')).toHaveCount(0);
  await expect(card.getByTestId('template-preview-sample')).toBeVisible();
  await expect(card.getByTestId('template-preview-stamp')).toBeVisible();
  await expectPreviewDecorationAboveCaption(card, 'template-preview-stamp');
  await expect(card.getByTestId('template-preview-signature')).toHaveCount(0);

  await card.click();
  await expect(library).toBeHidden();
  await expect(page.getByLabel('印章元素')).toBeVisible();
  await expect(page.getByLabel('签名元素')).toHaveCount(0);
});
