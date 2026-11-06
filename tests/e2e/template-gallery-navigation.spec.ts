import { expect, test, type Page } from '@playwright/test';
import { editorTemplates } from '../../src/templates';
import { groupGalleryTemplates } from '../../src/templates/gallery';

const allCount = editorTemplates.length;
const categoryCounts = new Map(groupGalleryTemplates(editorTemplates).map((group) => [group.key, group.items.length]));

async function openLibrary(page: Page) {
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;
  const panel = page.getByRole('button', { name: mobile ? 'Templates' : /^Templates/, exact: mobile });
  if (await panel.getAttribute('aria-expanded') !== 'true') await panel.click();
  await page.getByRole('button', { name: /^More \(/ }).click();
  return page.getByRole('dialog', { name: 'Built-in Templates' });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
});

test('categories and search narrow the gallery and selecting a template still applies it', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  let library = await openLibrary(page);
  const filters = library.getByRole('group', { name: 'Template categories' });
  await expect(filters.getByRole('button', { name: `All ${allCount}` })).toHaveAttribute('aria-pressed', 'true');
  await filters.getByRole('button', { name: `Chinese Landscapes ${categoryCounts.get('templateCategoryChineseScenes')}` }).click();
  await expect(library.getByRole('status')).toHaveText(`Results: ${categoryCounts.get('templateCategoryChineseScenes')}`);
  await expect(library.getByRole('button', { name: /Lone Fisherman/ })).toHaveCount(1);
  await expect(library.getByRole('button', { name: /Bluebird Manuscript/ })).toHaveCount(0);

  await filters.getByRole('button', { name: `Manuscripts & Art ${categoryCounts.get('templateCategoryManuscripts')}` }).click();
  const search = library.getByRole('searchbox', { name: 'Search templates' });
  await search.fill('blue butterfly');
  await expect(library.getByRole('status')).toContainText('Results:');
  await expect(library.getByRole('button', { name: /Blue Butterfly Manuscript/ })).toHaveCount(1);
  await expect(library.getByRole('button', { name: /Bluebird Manuscript/ })).toHaveCount(0);
  await search.fill('not-a-real-template');
  await expect(library.getByText('No templates found. Try another category or search.')).toBeVisible();
  await search.fill('bluebird');
  await library.getByRole('button', { name: /Bluebird Manuscript/ }).click();
  await expect(library).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('poem-to-image.active-template'))).toBe('bluebird-manuscript');

  library = await openLibrary(page);
  await expect(library.getByRole('searchbox', { name: 'Search templates' })).toHaveValue('');
  await expect(library.getByRole('group', { name: 'Template categories' }).getByRole('button', { name: `All ${allCount}` })).toHaveAttribute('aria-pressed', 'true');
  await expect(library.getByRole('button', { name: /Bluebird Manuscript/ })).toHaveAttribute('aria-pressed', 'true');
});

test('template cards use multiple columns at mobile and desktop widths', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const library = await openLibrary(page);
  const first = library.getByRole('button', { name: /Blue-Green Mountains/ });
  const second = library.getByRole('button', { name: /Lone Fisherman/ });
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  // The library animates into place; retry until both cards have settled in a row.
  await expect.poll(async () => {
    const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()]);
    return !!firstBox && !!secondBox
      && Math.abs(firstBox.y - secondBox.y) < 2
      && secondBox.x > firstBox.x + firstBox.width - 2;
  }).toBe(true);
});
