import { expect, test, type Page } from '@playwright/test';

const shareId = 'ABCDEF123456';
const deletionToken = 'a'.repeat(64);
const root = 'http://127.0.0.1:3000';

async function savedShare(page: Page, id: string): Promise<{
  id: string; deleteToken: string; fingerprint: string | null; state: string; title: string;
} | null> {
  return page.evaluate(async (shareId) => new Promise<{
    id: string; deleteToken: string; fingerprint: string | null; state: string; title: string;
  } | null>((resolve, reject) => {
    const request = indexedDB.open('inkpoem-share-library', 1);
    request.onerror = () => reject(new Error('Share library failed to open'));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('shares', 'readonly');
      const get = tx.objectStore('shares').get(shareId);
      get.onsuccess = () => resolve(get.result ?? null);
      get.onerror = () => reject(new Error('Share record lookup failed'));
      tx.oncomplete = () => db.close();
    };
  }), id);
}


function multipartValue(payload: Buffer | null, field: string): string {
  const text = payload?.toString('latin1') ?? '';
  const pattern = new RegExp('name="' + field + '"\r\n\r\n([^\r\n]+)');
  const match = pattern.exec(text);
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

test('anonymous editor pre-saves ID and token before publishing on mobile and desktop', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  let requestWasReceived = false;
  let publishedId = '';
  let ownerToken = '';
  await page.route('**/api/shares', async (route) => {
    expect(route.request().method()).toBe('POST');
    const bytes = route.request().postDataBuffer();
    expect(bytes).toBeTruthy();
    expect(bytes!.includes(Buffer.from('name="artwork"'))).toBe(true);
    expect(bytes!.includes(Buffer.from('name="card"'))).toBe(true);
    expect(bytes!.includes(Buffer.from([255, 216, 255]))).toBe(true);
    publishedId = multipartValue(bytes, 'id');
    ownerToken = multipartValue(bytes, 'deleteToken');
    expect(publishedId).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(ownerToken).toMatch(/^[a-f0-9]{64}$/);
    requestWasReceived = true;
    await route.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ id: publishedId, url: 'http://127.0.0.1:8787/s/' + publishedId, deleteToken: ownerToken }),
    });
  });

  if (testInfo.project.name === 'chromium-desktop') {
    await page.setViewportSize({ width: 1440, height: 1000 });
  } else {
    await page.setViewportSize({ width: 412, height: 915 });
  }
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  if (testInfo.project.name === 'chromium-mobile') {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
  } else {
    await page.getByRole('button', { name: /Export Image/ }).click();
  }

  const exportDialog = page.getByRole('dialog', { name: /Export/ });
  await expect(exportDialog).toBeVisible();
  await exportDialog.getByRole('button', { name: 'Publish shareable link' }).click();
  await expect(exportDialog).toBeHidden();
  const dialog = page.getByRole('dialog', { name: 'Publish this artwork' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Publish artwork', exact: true }).click();
  const publishedDialog = page.getByRole('dialog', { name: 'Your artwork is published' });
  await expect(publishedDialog).toBeVisible({ timeout: 45_000 });
  expect(requestWasReceived).toBe(true);
  await expect(publishedDialog.getByRole('textbox', { name: 'Copy link' })).toHaveValue(root + '/s/' + publishedId);
  expect((await savedShare(page, publishedId))?.deleteToken).toBe(ownerToken);
  expect((await savedShare(page, publishedId))?.state).toBe('published');
});


test('export shows only the native system share action, not six platform shortcuts', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    (window as Window & { __nativeShareFiles?: string[] }).__nativeShareFiles = [];
    Object.defineProperty(navigator, 'canShare', {
      configurable: true, value: ({ files }: ShareData) => !!files?.length,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async ({ files }: ShareData) => {
        (window as Window & { __nativeShareFiles?: string[] }).__nativeShareFiles =
          (files ?? []).map((file) => file.name);
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export & Share' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export & Share' });
  await expect(dialog).toBeVisible();
  for (const name of ['WeChat', 'Weibo', 'Xiaohongshu', 'X', 'Instagram', 'Facebook']) {
    await expect(dialog.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  const share = dialog.getByRole('button', { name: 'Share Image' });
  await expect(share).toBeEnabled();
  await share.click();
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __nativeShareFiles?: string[] }).__nativeShareFiles?.length ?? 0,
  ), { timeout: 45_000 }).toBe(1);
  const filename = await page.evaluate(() =>
    (window as Window & { __nativeShareFiles?: string[] }).__nativeShareFiles?.[0] ?? '',
  );
  expect(filename).toMatch(/\.(png|jpg|webp)$/);
});

test('text-only Web Share API never exposes an unusable native image-share button', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true, value: async () => undefined,
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true, value: undefined,
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export Image' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Share Image' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Copy Image' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Publish shareable link' })).toBeVisible();
});

test('My Shares persists a published link and its removal key after closing and refreshing', async ({ page }) => {
  test.setTimeout(90_000);
  let publishedId = '';
  let publishedToken = '';
  let deleted = false;
  await page.route('**/api/shares', async (route) => {
    publishedId = multipartValue(route.request().postDataBuffer(), 'id');
    publishedToken = multipartValue(route.request().postDataBuffer(), 'deleteToken');
    await route.fulfill({ status: 201, contentType: 'application/json',
      body: JSON.stringify({ id: publishedId, deleteToken: publishedToken, url: root + '/s/' + publishedId }) });
  });
  await page.route('**/api/shares/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      expect(route.request().headers()['x-share-delete-token']).toBe(publishedToken);
      deleted = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"revoked":true}' });
    } else {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"NOT_FOUND"}' });
    }
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  await page.getByRole('dialog', { name: 'Export Image' })
    .getByRole('button', { name: 'Publish shareable link' }).click();
  await page.getByRole('dialog', { name: 'Publish this artwork' })
    .getByRole('button', { name: 'Publish artwork', exact: true }).click();
  const success = page.getByRole('dialog', { name: 'Your artwork is published' });
  await expect(success).toBeVisible({ timeout: 40_000 });
  await success.getByRole('button', { name: 'Close' }).last().click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  await page.getByRole('dialog', { name: 'Export Image' })
    .getByRole('button', { name: 'My shares' }).click();
  const library = page.getByRole('dialog', { name: 'My shares' });
  await expect(library).toBeVisible();
  await expect(library.getByRole('link', { name: root + '/s/' + publishedId })).toBeVisible();
  await expect(library.getByText('Published', { exact: true })).toBeVisible();
  expect((await savedShare(page, publishedId))?.deleteToken).toBe(publishedToken);
  // Simulate an artwork removed elsewhere: a 404 must not leave stale
  // "Published" status or erase the only local revocation capability.
  await page.route('**/api/shares/*/verify', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"NOT_FOUND"}' });
  });
  await library.getByRole('button', { name: 'Check status' }).click();
  await expect(library.getByText('Unverified', { exact: true })).toBeVisible();
  await expect(library.getByRole('alert')).toContainText('Publication could not be confirmed');
  expect((await savedShare(page, publishedId))?.state).toBe('unverified');
  expect((await savedShare(page, publishedId))?.deleteToken).toBe(publishedToken);
  page.once('dialog', async (dialog) => { await dialog.accept(); });
  await library.getByRole('button', { name: 'Remove this share' }).click();
  await expect(library.getByText('No saved shares yet.')).toBeVisible();
  expect(deleted).toBe(true);
  const revokedRecord = await savedShare(page, publishedId);
  expect(revokedRecord?.state).toBe('revoked');
  expect(revokedRecord?.deleteToken).toBe('');
});

test('My Shares migrates existing legacy owner keys without publishing a second artwork', async ({ page }) => {
  const legacyId = 'LegacyShare1';
  const legacyToken = 'b'.repeat(64);
  await page.addInitScript(({ id, token }) => {
    localStorage.setItem('inkpoem.share.owner.' + id, token);
  }, { id: legacyId, token: legacyToken });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  await page.getByRole('dialog', { name: 'Export Image' })
    .getByRole('button', { name: 'My shares' }).click();
  const library = page.getByRole('dialog', { name: 'My shares' });
  await expect(library.getByRole('link', { name: root + '/s/' + legacyId })).toBeVisible();
  await expect(library.getByText('Unverified', { exact: true })).toBeVisible();
  await library.getByRole('button', { name: 'Publish a new artwork' }).click();
  await expect(page.getByRole('dialog', { name: 'Publish this artwork' })).toBeVisible();
  expect((await savedShare(page, legacyId))?.deleteToken).toBe(legacyToken);
  expect(await page.evaluate((id) => localStorage.getItem('inkpoem.share.owner.' + id), legacyId)).toBeNull();
});

test('a pending publication remains manageable after closing the recovery dialog', async ({ page }) => {
  test.setTimeout(90_000);
  let pendingId = '';
  await page.route('**/api/shares', async (route) => {
    pendingId = multipartValue(route.request().postDataBuffer(), 'id');
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"SHARE_SCHEMA_UNAVAILABLE"}' });
  });
  await page.route('**/api/shares/*/verify', async (route) => {
    await route.fulfill({ status: 202, contentType: 'application/json', body: '{"status":"pending"}' });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  await page.getByRole('dialog', { name: 'Export Image' })
    .getByRole('button', { name: 'Publish shareable link' }).click();
  await page.getByRole('dialog', { name: 'Publish this artwork' })
    .getByRole('button', { name: 'Publish artwork', exact: true }).click();
  const uncertain = page.getByRole('dialog', { name: 'Publication status uncertain' });
  await expect(uncertain).toBeVisible({ timeout: 40_000 });
  await uncertain.getByRole('button', { name: 'Close' }).last().click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  await page.getByRole('dialog', { name: 'Export Image' })
    .getByRole('button', { name: 'My shares' }).click();
  const library = page.getByRole('dialog', { name: 'My shares' });
  await expect(library.getByRole('link', { name: root + '/s/' + pendingId })).toBeVisible();
  await expect(library.getByText('Pending', { exact: true })).toBeVisible();
  expect((await savedShare(page, pendingId))?.state).toBe('pending');
});

test('never uploads when the browser cannot save its deletion capability', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get() { throw new DOMException('Storage denied', 'SecurityError'); },
    });
  });
  let publishRequests = 0;
  await page.route('**/api/shares', async (route) => {
    publishRequests++;
    await route.abort('failed');
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  await page.getByRole('dialog', { name: 'Export Image' })
    .getByRole('button', { name: 'Publish shareable link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish this artwork' });
  await dialog.getByRole('button', { name: 'Publish artwork', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Browser storage is unavailable', { timeout: 40_000 });
  expect(publishRequests).toBe(0);
});

test('a lost upload response can be confirmed read-only without a second upload', async ({ page }) => {
  test.setTimeout(90_000);
  let id = '';
  let uploads = 0;
  await page.route('**/api/shares', async (route) => {
    uploads++;
    id = multipartValue(route.request().postDataBuffer(), 'id');
    await route.abort('failed');
  });
  await page.route('**/api/shares/*/verify', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-share-delete-token']).toMatch(/^[a-f0-9]{64}$/);
    expect(route.request().headers()['x-share-fingerprint']).toMatch(/^[a-f0-9]{64}$/);
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        status: 'published',
        imageUrl: '/s/' + id + '/image.png',
        cardUrl: '/s/' + id + '/card.jpg',
      }),
    });
  });
  await page.route('**/s/*/*', async (route) => {
    expect(route.request().method()).toBe('HEAD');
    await route.fulfill({ status: 200, body: '' });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  await page.getByRole('dialog', { name: 'Export Image' })
    .getByRole('button', { name: 'Publish shareable link' }).click();
  await page.getByRole('dialog', { name: 'Publish this artwork' })
    .getByRole('button', { name: 'Publish artwork', exact: true }).click();

  const published = page.getByRole('dialog', { name: 'Your artwork is published' });
  await expect(published).toBeVisible({ timeout: 40_000 });
  expect(uploads).toBe(1);
  expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  expect((await savedShare(page, id))?.state).toBe('published');
});

test('HTTP publish and revoke failures keep the private key and show the actual status', async ({ page }) => {
  test.setTimeout(90_000);
  let id = '';
  await page.route('**/api/shares', async (route) => {
    id = multipartValue(route.request().postDataBuffer(), 'id');
    await route.fulfill({
      status: 503, contentType: 'application/json',
      body: '{"code":"SHARE_SCHEMA_UNAVAILABLE"}',
    });
  });
  await page.route('**/api/shares/*/verify', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ status: 503, contentType: 'application/json',
      body: '{"code":"SHARE_SCHEMA_UNAVAILABLE"}' });
  });
  await page.route('**/api/shares/*', async (route) => {
    const isDelete = route.request().method() === 'DELETE';
    await route.fulfill({
      status: isDelete ? 503 : 404, contentType: 'application/json',
      body: isDelete ? '{"code":"SHARE_SCHEMA_UNAVAILABLE"}' : '{"code":"NOT_FOUND"}',
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  await page.getByRole('dialog', { name: 'Export Image' })
    .getByRole('button', { name: 'Publish shareable link' }).click();
  await page.getByRole('dialog', { name: 'Publish this artwork' })
    .getByRole('button', { name: 'Publish artwork', exact: true }).click();

  const pending = page.getByRole('dialog', { name: 'Publication status uncertain' });
  await expect(pending).toBeVisible({ timeout: 40_000 });
  await expect(pending.getByRole('status')).toContainText('HTTP 503 · SHARE_SCHEMA_UNAVAILABLE');
  expect((await savedShare(page, id))?.state).toBe('pending');
  await pending.getByRole('button', { name: 'Remove public share now' }).click();
  await expect(pending.getByRole('alert').last()).toContainText('HTTP 503');
  expect((await savedShare(page, id))?.state).toBe('pending');
});

test('recovers a dropped response by retrying the same publication credentials', async ({ page }) => {
  test.setTimeout(90_000);
  const attempts: Array<{ id: string; token: string }> = [];
  await page.route('**/api/shares', async (route) => {
    const bytes = route.request().postDataBuffer();
    const id = multipartValue(bytes, 'id');
    const token = multipartValue(bytes, 'deleteToken');
    attempts.push({ id, token });
    if (attempts.length === 1) {
      // Simulate an already committed upload whose response was lost.
      await route.abort('failed');
    } else {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id, url: root + '/s/' + id, deleteToken: token }),
      });
    }
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  await page.getByRole('dialog', { name: 'Export Image' })
    .getByRole('button', { name: 'Publish shareable link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish this artwork' });
  await dialog.getByRole('button', { name: 'Publish artwork', exact: true }).click();
  const uncertain = page.getByRole('dialog', { name: 'Publication status uncertain' });
  await expect(uncertain).toBeVisible({ timeout: 40_000 });
  expect(attempts).toHaveLength(1);
  const first = attempts[0];
  expect((await savedShare(page, first.id))?.deleteToken).toBe(first.token);
  expect((await savedShare(page, first.id))?.state).toBe('pending');
  await expect(uncertain.getByRole('button', { name: 'Close' }).last()).toBeEnabled();
  await uncertain.getByRole('button', { name: 'Retry the same publication' }).click();
  const published = page.getByRole('dialog', { name: 'Your artwork is published' });
  await expect(published).toBeVisible({ timeout: 40_000 });
  expect(attempts).toEqual([first, first]);
  expect((await savedShare(page, first.id))?.state).toBe('published');
  expect((await savedShare(page, first.id))?.deleteToken).toBe(first.token);
});

test('a rate-limited replay preserves the first upload removal key', async ({ page }) => {
  test.setTimeout(90_000);
  let count = 0;
  let firstId = '';
  let firstToken = '';
  await page.route('**/api/shares', async (route) => {
    count++;
    const body = route.request().postDataBuffer();
    const id = multipartValue(body, 'id');
    const token = multipartValue(body, 'deleteToken');
    if (count === 1) {
      firstId = id; firstToken = token;
      await route.abort('failed');
    } else {
      expect(id).toBe(firstId);
      expect(token).toBe(firstToken);
      await route.fulfill({ status: 429, contentType: 'application/json',
        body: '{"code":"RATE_LIMITED"}' });
    }
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  await page.getByRole('dialog', { name: 'Export Image' })
    .getByRole('button', { name: 'Publish shareable link' }).click();
  await page.getByRole('dialog', { name: 'Publish this artwork' })
    .getByRole('button', { name: 'Publish artwork', exact: true }).click();
  const uncertain = page.getByRole('dialog', { name: 'Publication status uncertain' });
  await expect(uncertain).toBeVisible({ timeout: 45_000 });
  await uncertain.getByRole('button', { name: 'Retry the same publication' }).click();
  await expect.poll(() => count).toBe(2);
  await expect(uncertain).toBeVisible();
  expect((await savedShare(page, firstId))?.deleteToken).toBe(firstToken);
  expect((await savedShare(page, firstId))?.state).toBe('pending');
});

test('an unrelated interrupted publication never blocks a new share', async ({ page }) => {
  test.setTimeout(90_000);
  const oldId = 'StaleShare01';
  const oldKey = 'b'.repeat(64);
  await page.addInitScript(({ id, token }) => {
    localStorage.setItem('inkpoem.share.owner.' + id, token);
    localStorage.setItem('inkpoem.share.pending.v1', JSON.stringify({
      id, deleteToken: token, fingerprint: 'f'.repeat(64),
    }));
  }, { id: oldId, token: oldKey });
  let freshId = '';
  await page.route('**/api/shares', async (route) => {
    freshId = multipartValue(route.request().postDataBuffer(), 'id');
    expect(freshId).not.toBe(oldId);
    const token = multipartValue(route.request().postDataBuffer(), 'deleteToken');
    await route.fulfill({ status: 201, contentType: 'application/json',
      body: JSON.stringify({ id: freshId, deleteToken: token, url: root + '/s/' + freshId }) });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  await page.getByRole('dialog', { name: 'Export Image' })
    .getByRole('button', { name: 'Publish shareable link' }).click();
  await page.getByRole('dialog', { name: 'Publish this artwork' })
    .getByRole('button', { name: 'Publish artwork', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Your artwork is published' })).toBeVisible({ timeout: 40_000 });
  expect(freshId).toMatch(/^[A-Za-z0-9_-]{12}$/);
  expect((await savedShare(page, oldId))?.state).toBe('pending');
});


test('uses a securely retained removal key to revoke a share from another browser', async ({ page }) => {
  await page.route('**/api/shares/' + shareId, async (route) => {
    if (route.request().method() === 'DELETE') {
      expect(route.request().headers()['x-share-delete-token']).toBe(deletionToken);
      await route.fulfill({ contentType: 'application/json', body: '{"revoked":true}' });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: shareId, title: 'Recovery test', author: 'Poet',
        createdAt: '2026-10-28T18:00:00Z',
        url: root + '/s/' + shareId, imageUrl: '/preview.png', cardUrl: '/preview.png',
      }),
    });
  });
  await page.goto('/s/' + shareId, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Recovery test' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove this share' })).toHaveCount(0);
  await page.getByText('Have a private removal key?').click();
  await page.getByPlaceholder('Paste the 64-character private removal key').fill(deletionToken);
  await expect(page.getByRole('button', { name: 'Remove this share' })).toBeVisible();
  page.once('dialog', async (dialog) => { await dialog.accept(); });
  await page.getByRole('button', { name: 'Remove this share' }).click();
  await expect(page.getByRole('heading', { name: 'Artwork unavailable' })).toBeVisible();
});

test('revocation succeeds even if browser policy blocks localStorage access', async ({ page }) => {
  await page.route('**/api/shares/' + shareId, async (route) => {
    if (route.request().method() === 'DELETE') {
      expect(route.request().headers()['x-share-delete-token']).toBe(deletionToken);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"revoked":true}' });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: shareId, title: 'Storage restricted artwork', author: 'Poet',
        createdAt: '2026-10-28T18:00:00Z',
        url: root + '/s/' + shareId, imageUrl: '/preview.png', cardUrl: '/preview.png',
      }),
    });
  });
  await page.goto('/s/' + shareId, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Storage restricted artwork' })).toBeVisible();
  await page.getByText('Have a private removal key?').click();
  await page.getByPlaceholder('Paste the 64-character private removal key').fill(deletionToken);

  // Some browsers throw SecurityError when the property getter is accessed,
  // even though the server may accept the authenticated DELETE successfully.
  await page.evaluate(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Storage denied', 'SecurityError'); },
    });
  });
  page.once('dialog', async (dialog) => { await dialog.accept(); });
  await page.getByRole('button', { name: 'Remove this share' }).click();
  await expect(page.getByRole('heading', { name: 'Artwork unavailable' })).toBeVisible();
  await expect(page.getByText('Could not remove this share. Try again.')).toHaveCount(0);
});

test('public read-only viewer needs no account and creator can revoke from the original browser', async ({ page }) => {
  await page.addInitScript(({ id, token }) => {
    localStorage.setItem('inkpoem.share.owner.' + id, token);
    localStorage.setItem('inkpoem.share.pending.v1', JSON.stringify({
      id, deleteToken: token, fingerprint: 'c'.repeat(64),
    }));
  }, { id: shareId, token: deletionToken });

  await page.route('**/api/shares/' + shareId, async (route) => {
    if (route.request().method() === 'DELETE') {
      expect(route.request().headers()['x-share-delete-token']).toBe(deletionToken);
      await route.fulfill({ contentType: 'application/json', body: '{"revoked":true}' });
    } else {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: shareId, title: 'Shared poetry artwork', author: 'Test poet',
          createdAt: '2026-10-28T18:00:00Z',
          url: root + '/s/' + shareId, imageUrl: '/preview.png', cardUrl: '/preview.png',
        }),
      });
    }
  });

  await page.goto('/s/' + shareId, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Shared poetry artwork' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Shared poetry artwork' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Make your own with InkPoem/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Editor' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove this share' })).toBeVisible();
  page.once('dialog', async (dialog) => { await dialog.accept(); });
  await page.getByRole('button', { name: 'Remove this share' }).click();
  await expect(page.getByRole('heading', { name: 'Artwork unavailable' })).toBeVisible();
  expect(await page.evaluate((id) => localStorage.getItem('inkpoem.share.owner.' + id), shareId)).toBeNull();
  expect((await savedShare(page, shareId))?.state).toBe('revoked');
});


test('transient metadata errors show a retry action rather than a false 404', async ({ page }) => {
  let attempts = 0;
  let serviceUnavailable = true;
  await page.route('**/api/shares/' + shareId, async (route) => {
    attempts++;
    // React StrictMode may start and abort the first request in development.
    // Keep all initial requests unavailable until the user explicitly retries.
    if (serviceUnavailable) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Unavailable"}' });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: shareId, title: 'Recovered view', author: 'Poet',
        createdAt: '2026-10-28T18:00:00Z',
        url: 'http://127.0.0.1:8787/s/' + shareId,
        imageUrl: '/preview.png', cardUrl: '/preview.png',
      }),
    });
  });
  await page.goto('/s/' + shareId, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Could not load the artwork' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Artwork unavailable' })).toHaveCount(0);
  serviceUnavailable = false;
  await page.getByRole('button', { name: 'Try loading again' }).click();
  await expect(page.getByRole('heading', { name: 'Recovered view' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Copy link' }))
    .toHaveValue(root + '/s/' + shareId);
  expect(attempts).toBeGreaterThanOrEqual(2);
});

test('an actual missing share still renders the unavailable state', async ({ page }) => {
  await page.route('**/api/shares/' + shareId, async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"NOT_FOUND"}' });
  });
  await page.goto('/s/' + shareId, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Artwork unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try loading again' })).toHaveCount(0);
});
