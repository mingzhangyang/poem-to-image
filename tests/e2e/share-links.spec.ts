import { expect, test } from '@playwright/test';

const shareId = 'ABCDEF123456';
const deletionToken = 'a'.repeat(64);
const root = 'http://127.0.0.1:3000';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '{"packages":[]}' });
  });
});

test('anonymous editor can publish a snapshot using desktop or mobile export UI', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  let requestWasReceived = false;
  await page.route('**/api/shares', async (route) => {
    expect(route.request().method()).toBe('POST');
    const bytes = route.request().postDataBuffer();
    expect(bytes).toBeTruthy();
    expect(bytes!.includes(Buffer.from('name="artwork"'))).toBe(true);
    expect(bytes!.includes(Buffer.from('name="card"'))).toBe(true);
    expect(bytes!.includes(Buffer.from([255, 216, 255]))).toBe(true);
    requestWasReceived = true;
    await route.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ id: shareId, url: root + '/s/' + shareId, deleteToken: deletionToken }),
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
  await expect(dialog.getByText('Anyone with the link can view, download or reshare it.', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Publish artwork', exact: true }).click();
  const publishedDialog = page.getByRole('dialog', { name: 'Your artwork is published' });
  await expect(publishedDialog).toBeVisible({ timeout: 45_000 });
  expect(requestWasReceived).toBe(true);
  await expect(publishedDialog.getByRole('textbox', { name: 'Copy link' })).toHaveValue(root + '/s/' + shareId);
  const persistedToken = await page.evaluate((id) => localStorage.getItem('inkpoem.share.owner.' + id), shareId);
  expect(persistedToken).toBe(deletionToken);
});

test('rolls back a published share if saving its removal token fails', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('inkpoem.share.owner.')) throw new DOMException('Storage quota reached', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  let deleted = false;
  await page.route('**/api/shares', async (route) => {
    await route.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ id: shareId, url: root + '/s/' + shareId, deleteToken: deletionToken }),
    });
  });
  await page.route('**/api/shares/' + shareId, async (route) => {
    expect(route.request().method()).toBe('DELETE');
    expect(route.request().headers()['x-share-delete-token']).toBe(deletionToken);
    deleted = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"revoked":true}' });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  await page.getByRole('dialog', { name: 'Export Image' }).getByRole('button', { name: 'Publish shareable link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish this artwork' });
  await dialog.getByRole('button', { name: 'Publish artwork', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('newly published artwork was automatically removed', { timeout: 40_000 });
  expect(deleted).toBe(true);
  await expect(page.getByRole('dialog', { name: 'Published, but removal key was not saved' })).toHaveCount(0);
});

test('retains private recovery key if both local storage and automatic rollback fail', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('inkpoem.share.owner.')) throw new DOMException('Storage quota reached', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  await page.route('**/api/shares', async (route) => {
    await route.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ id: shareId, url: root + '/s/' + shareId, deleteToken: deletionToken }),
    });
  });
  let deleteAttempts = 0;
  await page.route('**/api/shares/' + shareId, async (route) => {
    deleteAttempts++;
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Unavailable"}' });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Export Image' }).click();
  await page.getByRole('dialog', { name: 'Export Image' }).getByRole('button', { name: 'Publish shareable link' }).click();
  await page.getByRole('dialog', { name: 'Publish this artwork' })
    .getByRole('button', { name: 'Publish artwork', exact: true }).click();
  const recovery = page.getByRole('dialog', { name: 'Published, but removal key was not saved' });
  await expect(recovery).toBeVisible({ timeout: 40_000 });
  await expect(recovery.getByRole('alert')).toContainText('automatic removal failed');
  await expect(recovery.getByRole('textbox', { name: 'Private removal key (never include in a shared URL)' })).toHaveValue(deletionToken);
  await expect(recovery.getByRole('button', { name: 'Close' }).last()).toBeDisabled();

  await recovery.getByRole('button', { name: 'Retry saving this key' }).click();
  await expect(recovery.getByText('This browser still cannot save the removal key.')).toBeVisible();
  await recovery.getByRole('button', { name: 'Remove public share now' }).click();
  await expect(recovery.getByText('Could not remove the public artwork. Keep the private key and try again.')).toBeVisible();
  expect(deleteAttempts).toBe(2);

  await recovery.getByRole('checkbox', { name: 'I have securely saved the private removal key' }).check();
  await expect(recovery.getByRole('button', { name: 'Close' }).last()).toBeEnabled();
  await recovery.getByRole('button', { name: 'Close' }).last().click();
  await expect(recovery).toBeHidden();
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

test('public read-only viewer needs no account and creator can revoke from the original browser', async ({ page }) => {
  await page.addInitScript(({ id, token }) => {
    localStorage.setItem('inkpoem.share.owner.' + id, token);
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
});
