import { expect, test, type Page } from '@playwright/test';

function multipartValue(payload: Buffer | null, field: string): string {
  const text = payload?.toString('latin1') ?? '';
  const match = new RegExp('name="' + field + '"\r\n\r\n([^\r\n]+)').exec(text);
  expect(match, 'Missing multipart field: ' + field).not.toBeNull();
  return match![1];
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '{"packages":[]}' });
  });
});

async function openPublishDialog(page: Page, isMobile: boolean) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  if (isMobile) await page.getByRole('button', { name: 'Export', exact: true }).click();
  else await page.getByRole('button', { name: /Export Image/ }).click();
  await page.getByRole('dialog', { name: /Export/ }).getByRole('button', { name: 'Publish shareable link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish this artwork' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('the gallery opt-in is only offered for permanent shares and is sent after publishing', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  let publishedId = '';
  let ownerToken = '';
  const galleryRequests: { method: string; token: string | null }[] = [];
  await page.route('**/api/shares', async (route) => {
    const bytes = route.request().postDataBuffer();
    publishedId = multipartValue(bytes, 'id');
    ownerToken = multipartValue(bytes, 'deleteToken');
    expect(multipartValue(bytes, 'expiry')).toBe('never');
    await route.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ id: publishedId, url: 'http://127.0.0.1:3000/s/' + publishedId, deleteToken: ownerToken }),
    });
  });
  await page.route('**/api/shares/*/gallery', async (route) => {
    galleryRequests.push({ method: route.request().method(), token: route.request().headers()['x-share-delete-token'] ?? null });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'pending', eligible: true }) });
  });

  const dialog = await openPublishDialog(page, testInfo.project.name === 'chromium-mobile');
  const optIn = dialog.getByRole('checkbox', { name: /Also submit to the public gallery/ });
  // The default one-month expiry cannot be listed.
  await expect(optIn).toBeDisabled();
  await expect(dialog.getByText('Only shares that never expire can be submitted to the gallery.')).toBeVisible();
  await dialog.getByRole('combobox').selectOption('never');
  await expect(optIn).toBeEnabled();
  await optIn.check();

  await dialog.getByRole('button', { name: 'Publish artwork', exact: true }).click();
  const published = page.getByRole('dialog', { name: 'Your artwork is published' });
  await expect(published).toBeVisible({ timeout: 45_000 });
  await expect(published.getByText(/Submitted to the public gallery/)).toBeVisible();
  expect(galleryRequests).toEqual([{ method: 'PUT', token: ownerToken }]);
  expect(page.url()).not.toContain(ownerToken);

  await published.getByRole('button', { name: 'My shares' }).click();
  const library = page.getByRole('dialog', { name: 'My shares' });
  await expect(library.getByText('Public gallery: In review')).toBeVisible();
  await library.getByRole('button', { name: 'Withdraw from gallery' }).click();
  await expect.poll(() => galleryRequests.map((request) => request.method)).toContain('DELETE');
});

test('the gallery page lists approved artworks and loads more', async ({ page }) => {
  const item = (id: string, title: string) => ({
    id, title, author: 'Poet', listedAt: '2026-11-27 10:00:00',
    url: '/s/' + id, imageUrl: '/s/' + id + '/image.png', cardUrl: '/s/' + id + '/card.jpg',
  });
  await page.route('**/s/*/card.jpg', (route) => route.fulfill({ status: 404 }));
  await page.route('**/api/gallery*', async (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    const body = cursor === 'next'
      ? { items: [item('CCCCCCCCCCCC', 'Third')], nextCursor: null }
      : { items: [item('AAAAAAAAAAAA', 'First'), item('BBBBBBBBBBBB', '')], nextCursor: 'next' };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/gallery');
  await expect(page.getByRole('heading', { name: 'Public gallery' })).toBeVisible();
  const links = page.locator('main ul a');
  await expect(links).toHaveCount(2);
  await expect(links.first()).toHaveAttribute('href', '/s/AAAAAAAAAAAA');
  await expect(links.nth(1)).toContainText('Untitled');
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(links).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Load more' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
