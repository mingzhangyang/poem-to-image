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

async function mockPublish(page: Page) {
  const published = { id: '', token: '' };
  await page.route('**/api/shares', async (route) => {
    const bytes = route.request().postDataBuffer();
    published.id = multipartValue(bytes, 'id');
    published.token = multipartValue(bytes, 'deleteToken');
    await route.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ id: published.id, url: 'http://127.0.0.1:3000/s/' + published.id, deleteToken: published.token }),
    });
  });
  return published;
}

test('anonymous creators publish without an account and are not offered the gallery', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const published = await mockPublish(page);
  const accountCalls: string[] = [];
  await page.route('**/api/me/**', async (route) => {
    accountCalls.push(route.request().url());
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  });

  const dialog = await openPublishDialog(page, testInfo.project.name === 'chromium-mobile');
  await dialog.getByRole('combobox').selectOption('never');
  await expect(dialog.getByRole('checkbox', { name: /Also submit to the public gallery/ })).toBeDisabled();
  await expect(dialog.getByText('Sign in to submit artworks to the public gallery.')).toBeVisible();

  await dialog.getByRole('button', { name: 'Publish artwork', exact: true }).click();
  const done = page.getByRole('dialog', { name: 'Your artwork is published' });
  await expect(done).toBeVisible({ timeout: 45_000 });
  await expect(done.getByText('You can remove this share at any time from My shares in this browser.')).toBeVisible();

  await done.getByRole('button', { name: 'My shares' }).click();
  const library = page.getByRole('dialog', { name: 'My shares' });
  await expect(library.getByText(/Sign in before publishing to keep artworks in your account/)).toBeVisible();
  // The removal key stays available, but out of the way.
  const copyKey = library.getByRole('button', { name: 'Copy private removal key' });
  await expect(copyKey).toBeHidden();
  await library.getByText('Back up removal key (for another device)').click();
  await expect(copyKey).toBeVisible();
  expect(published.id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  expect(accountCalls).toEqual([]);
});

test('signed-in creators save shares to their account and can submit them to the gallery', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    (window as Window & { __INKPOEM_DEV_TEST_ACCOUNT?: unknown }).__INKPOEM_DEV_TEST_ACCOUNT = {
      userId: 'user_e2e_gallery', token: 'e2e-token',
    };
  });
  await page.route('**/api/me', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ userId: 'user_e2e_gallery', email: null, balance: 0 }),
  }));
  await page.route('**/api/templates', (route) => route.fulfill({ contentType: 'application/json', body: '{"templates":[]}' }));
  await page.route('**/api/billing/**', (route) => route.fulfill({ contentType: 'application/json', body: '{"packages":[],"balance":0,"items":[]}' }));
  const published = await mockPublish(page);
  const calls: { method: string; path: string; auth: string | undefined; body: string | null }[] = [];
  let galleryStatus = 'none';
  await page.route('**/api/me/shares**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push({ method: request.method(), path, auth: request.headers().authorization, body: request.postData() });
    if (path === '/api/me/shares/claim') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ claimed: [published.id] }) });
    } else if (path.endsWith('/gallery')) {
      galleryStatus = request.method() === 'PUT' ? 'pending' : 'none';
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: galleryStatus, eligible: true }) });
    } else {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ shares: [{
          id: published.id, title: 'Sonnet 18', author: 'William Shakespeare',
          publishedAt: '2026-11-27 10:00:00', expiresAt: null, permanent: true, galleryStatus,
          url: '/s/' + published.id, imageUrl: '/s/' + published.id + '/image.png', cardUrl: '/s/' + published.id + '/card.jpg',
        }] }),
      });
    }
  });
  await page.route('**/s/*/card.jpg', (route) => route.fulfill({ status: 404 }));

  const dialog = await openPublishDialog(page, testInfo.project.name === 'chromium-mobile');
  const optIn = dialog.getByRole('checkbox', { name: /Also submit to the public gallery/ });
  // The default one-month expiry cannot be listed.
  await expect(optIn).toBeDisabled();
  await expect(dialog.getByText('Only shares that never expire can be submitted to the gallery.')).toBeVisible();
  await dialog.getByRole('combobox').selectOption('never');
  await optIn.check();

  await dialog.getByRole('button', { name: 'Publish artwork', exact: true }).click();
  const done = page.getByRole('dialog', { name: 'Your artwork is published' });
  await expect(done).toBeVisible({ timeout: 45_000 });
  await expect(done.getByText('Saved to your account. You can manage it on any device.')).toBeVisible();
  await expect(done.getByText(/Submitted to the public gallery/)).toBeVisible();

  const claim = calls.find((call) => call.path === '/api/me/shares/claim');
  expect(claim?.auth).toBe('Bearer e2e-token');
  expect(JSON.parse(claim!.body!)).toEqual({ shares: [{ id: published.id, deleteToken: published.token }] });
  expect(calls.some((call) => call.method === 'PUT' && call.path === '/api/me/shares/' + published.id + '/gallery')).toBe(true);
  expect(calls.every((call) => !call.path.includes(published.token))).toBe(true);

  await done.getByRole('button', { name: 'My shares' }).click();
  const library = page.getByRole('dialog', { name: 'My shares' });
  await expect(library.getByRole('heading', { name: 'My artworks' })).toBeVisible();
  await expect(library.getByText('Public gallery: In review')).toBeVisible();
  // The account share is not listed again as a browser-only share.
  await expect(library.getByText('Shares saved only in this browser')).toBeHidden();
  await library.getByRole('button', { name: 'Withdraw from gallery' }).click();
  await expect(library.getByText('Public gallery: Not submitted')).toBeVisible();
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

test('after signing in, shares published anonymously in this browser can be added to the account', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'Account page flow is the same on mobile');
  test.setTimeout(90_000);
  const published = await mockPublish(page);
  const dialog = await openPublishDialog(page, false);
  await dialog.getByRole('button', { name: 'Publish artwork', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Your artwork is published' })).toBeVisible({ timeout: 45_000 });

  // Sign in (the dev-only test account is read when the app loads).
  await page.addInitScript(() => {
    (window as Window & { __INKPOEM_DEV_TEST_ACCOUNT?: unknown }).__INKPOEM_DEV_TEST_ACCOUNT = {
      userId: 'user_e2e_claim', token: 'e2e-token',
    };
  });
  await page.route('**/api/me', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ userId: 'user_e2e_claim', email: null, balance: 0 }),
  }));
  await page.route('**/api/billing/**', (route) => route.fulfill({ contentType: 'application/json', body: '{"packages":[],"balance":0,"items":[]}' }));
  let claimed = false;
  let claimBody: unknown = null;
  await page.route('**/api/me/shares**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me/shares/claim') {
      claimBody = JSON.parse(route.request().postData() ?? 'null');
      claimed = true;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ claimed: [published.id] }) });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ shares: claimed ? [{
        id: published.id, title: 'Sonnet 18', author: '', publishedAt: '2026-11-27 10:00:00', expiresAt: '2026-12-27 10:00:00',
        permanent: false, galleryStatus: 'none',
        url: '/s/' + published.id, imageUrl: '/s/' + published.id + '/image.png', cardUrl: '/s/' + published.id + '/card.jpg',
      }] : [] }),
    });
  });
  await page.route('**/s/*/card.jpg', (route) => route.fulfill({ status: 404 }));

  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'My artworks' })).toBeVisible();
  await expect(page.getByText(/Artworks this browser published without an account: 1\./)).toBeVisible();
  await page.getByRole('button', { name: 'Add to my account' }).click();
  await expect(page.getByText('Sonnet 18')).toBeVisible();
  await expect(page.getByText(/Artworks this browser published without an account/)).toBeHidden();
  // A one-month share stays manageable but cannot go to the gallery.
  await expect(page.getByText('Public gallery: Permanent shares only')).toBeVisible();
  expect(claimBody).toEqual({ shares: [{ id: published.id, deleteToken: published.token }] });
});
