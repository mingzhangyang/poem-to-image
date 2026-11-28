import { expect, test, type Page, type Route } from '@playwright/test';

const fixture = '/tests/e2e/fixtures/publish-dialog.html';

async function changeAccount(page: Page, userId: string | null) {
  await page.evaluate((id) => window.dispatchEvent(new CustomEvent('test-auth-change', { detail: id })), userId);
}

async function openRecovery(page: Page) {
  await page.goto(fixture);
  const dialog = page.getByRole('dialog', { name: 'Publish this artwork' });
  await dialog.getByRole('combobox').selectOption('never');
  await dialog.getByRole('checkbox', { name: /Also submit to the public gallery/ }).check();
  await dialog.getByRole('button', { name: 'Publish artwork', exact: true }).click();
  const recovery = page.getByRole('dialog', { name: 'Published, but removal key was not saved' });
  await expect(recovery).toBeVisible();
  return recovery;
}

test('retrying local persistence completes the original account and gallery publication', async ({ page }) => {
  const calls: string[] = [];
  let shareId = '';
  await page.route('**/api/me/shares/claim', async (route) => {
    const request = route.request();
    expect(request.headers().authorization).toBe('Bearer account-a');
    const { shares } = request.postDataJSON();
    expect(shares).toHaveLength(1);
    shareId = shares[0].id;
    expect(shares[0].deleteToken).toMatch(/^[a-f0-9]{64}$/);
    calls.push('claim');
    await route.fulfill({ json: { claimed: [shareId], ownedElsewhere: [] } });
  });
  await page.route('**/api/me/shares/*/gallery', async (route) => {
    expect(route.request().method()).toBe('PUT');
    expect(new URL(route.request().url()).pathname).toBe('/api/me/shares/' + shareId + '/gallery');
    expect(route.request().headers().authorization).toBe('Bearer account-a');
    calls.push('gallery');
    await route.fulfill({ json: { status: 'pending', eligible: true } });
  });
  const recovery = await openRecovery(page);
  expect(calls).toEqual([]);
  await recovery.getByRole('button', { name: 'Retry saving this key' }).click();
  const done = page.getByRole('dialog', { name: 'Your artwork is published' });
  await expect(done.getByText('Saved to your account. You can manage it on any device.')).toBeVisible();
  await expect(done.getByText(/Submitted to the public gallery/)).toBeVisible();
  expect(calls).toEqual(['claim', 'gallery']);
});

test('recovery does not claim or submit to an account switched in after publication', async ({ page }) => {
  const calls: string[] = [];
  await page.route('**/api/me/shares**', async (route) => {
    calls.push(route.request().url());
    await route.fulfill({ status: 500, json: {} });
  });
  const recovery = await openRecovery(page);
  await changeAccount(page, 'account-b');
  await recovery.getByRole('button', { name: 'Retry saving this key' }).click();
  const done = page.getByRole('dialog', { name: 'Your artwork is published' });
  await expect(done.getByText(/could not be saved to your account/)).toBeVisible();
  await expect(done.getByText(/gallery submission failed/)).toBeVisible();
  expect(calls).toEqual([]);
});

test('local keys stay accessible on failed ownership lookup after account switch and sign-out', async ({ page }) => {
  let release!: () => void;
  const allowOwned = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/me/shares', (route) => route.fulfill({ json: { shares: [], nextCursor: null } }));
  await page.route('**/api/me/shares/owned', async (route) => {
    if (route.request().headers().authorization === 'Bearer account-a') {
      await allowOwned;
      await route.fulfill({ json: { owned: route.request().postDataJSON().ids } });
    } else {
      await route.fulfill({ status: 503, json: {} });
    }
  });
  await page.goto(fixture + '?library=1');
  const library = page.getByRole('dialog', { name: 'My shares' });
  const localArtwork = library.getByText('Local artwork', { exact: true });
  const revoke = library.getByRole('button', { name: 'Remove this share', exact: true });
  await expect(localArtwork).toBeVisible();
  release();
  await expect(localArtwork).toBeHidden();

  await changeAccount(page, 'account-b');
  await expect(library.getByText('Could not load the artworks in your account.')).toBeVisible();
  await expect(localArtwork).toBeVisible();
  await expect(revoke).toBeVisible();

  await changeAccount(page, 'account-a');
  await expect(localArtwork).toBeHidden();
  await changeAccount(page, null);
  await expect(library.getByRole('heading', { name: 'My artworks' })).toBeHidden();
  await expect(localArtwork).toBeVisible();
  await expect(revoke).toBeVisible();
});

async function publishConfirmed(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Publish this artwork' });
  await dialog.getByRole('combobox').selectOption('never');
  await dialog.getByRole('checkbox', { name: /Also submit to the public gallery/ }).check();
  await dialog.getByRole('button', { name: 'Publish artwork', exact: true }).click();
  return page.getByRole('dialog', { name: 'Your artwork is published' });
}

test('a stalled account claim neither hides the published link nor blocks closing', async ({ page }) => {
  const stalled: Route[] = [];
  let galleryCalls = 0;
  await page.route('**/api/me/shares/claim', (route) => { stalled.push(route); });
  await page.route('**/api/me/shares/*/gallery', async (route) => {
    galleryCalls += 1;
    await route.fulfill({ json: { status: 'pending', eligible: true } });
  });
  await page.goto(fixture + '?mode=ok');
  const done = await publishConfirmed(page);
  await expect(done.getByRole('textbox', { name: 'Copy link' })).toHaveValue(/\/s\/[A-Za-z0-9_-]{12}$/);
  await expect(done.getByText('Saving to your account…')).toBeVisible();
  await expect.poll(() => stalled.length).toBe(1);

  const closeButtons = done.getByRole('button', { name: 'Close' });
  await expect(closeButtons.first()).toBeEnabled();
  await closeButtons.last().click();
  await expect(done).toBeHidden();

  // Publish again while the first claim is still outstanding, then let the
  // first one succeed late: its notice belongs to the closed dialog.
  await page.evaluate(() => window.dispatchEvent(new Event('test-open')));
  const again = await publishConfirmed(page);
  await expect(again.getByText('Saving to your account…')).toBeVisible();
  await expect.poll(() => stalled.length).toBe(2);
  const [first, second] = stalled;
  const { shares } = first.request().postDataJSON();
  await first.fulfill({ json: { claimed: [shares[0].id], ownedElsewhere: [] } });
  // The first publication finishes in the background (claim, then gallery).
  await expect.poll(() => galleryCalls).toBe(1);
  await page.waitForTimeout(200);
  await expect(again.getByText('Saving to your account…')).toBeVisible();
  await expect(again.getByText('Saved to your account. You can manage it on any device.')).toBeHidden();

  await second.fulfill({ status: 503, json: {} });
  await expect(again.getByText(/could not be saved to your account/)).toBeVisible();
  await expect(again.getByText(/gallery submission failed/)).toBeVisible();
  await expect(again.getByText('Saved to your account. You can manage it on any device.')).toBeHidden();
});

test('recovery shows the result at once and reports a claim that fails after stalling', async ({ page }) => {
  let releaseClaim!: () => void;
  const claimReleased = new Promise<void>((resolve) => { releaseClaim = resolve; });
  let claimSeen = false;
  await page.route('**/api/me/shares/claim', async (route) => {
    claimSeen = true;
    await claimReleased;
    await route.fulfill({ status: 503, json: {} });
  });
  await page.route('**/api/me/shares/*/gallery', (route) => route.fulfill({ json: { status: 'pending', eligible: true } }));
  const recovery = await openRecovery(page);
  await recovery.getByRole('button', { name: 'Retry saving this key' }).click();
  const done = page.getByRole('dialog', { name: 'Your artwork is published' });
  await expect(done.getByText('Saving to your account…')).toBeVisible();
  await expect.poll(() => claimSeen).toBe(true);
  const closeButtons = done.getByRole('button', { name: 'Close' });
  await expect(closeButtons.first()).toBeEnabled();
  await expect(closeButtons.last()).toBeEnabled();

  releaseClaim();
  await expect(done.getByText(/could not be saved to your account/)).toBeVisible();
  await expect(done.getByText(/gallery submission failed/)).toBeVisible();
  await expect(done.getByText('Saving to your account…')).toBeHidden();
  await closeButtons.last().click();
  await expect(done).toBeHidden();
});
