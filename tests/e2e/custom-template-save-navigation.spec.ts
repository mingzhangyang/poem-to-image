import { expect, test, type Page, type Route } from '@playwright/test';
import { isDesktopLayout, openPanel } from './helpers/sidebarNavigation';

// A signed-in save keeps running while the Templates panel is unmounted (the
// desktop rail or the mobile drawer shows another panel, or the drawer
// closes). Coming back must show that save as pending, never offer a second
// create for it, and a failed save must keep its typed name.

interface CloudTemplates {
  saved: Array<Record<string, unknown>>;
  posts: number;
  /** Resolves the oldest held POST with the given status. */
  release: (status?: number) => Promise<void>;
}

async function signInWithCloudTemplates(page: Page): Promise<CloudTemplates> {
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
    // Development-server test account (see src/main.tsx).
    (window as Window & { __INKPOEM_DEV_TEST_ACCOUNT?: unknown }).__INKPOEM_DEV_TEST_ACCOUNT = {
      userId: 'user_e2e_templates',
      token: 'e2e-token',
    };
  });

  const state: CloudTemplates = { saved: [], posts: 0, release: async () => {} };
  const held: Array<{ route: Route; body: Record<string, unknown> }> = [];
  state.release = async (status = 201) => {
    const next = held.shift();
    if (!next) throw new Error('no held POST');
    if (status >= 400) {
      await next.route.fulfill({ status, contentType: 'application/json', body: '{"error":"failed"}' });
      return;
    }
    const template = { ...next.body, id: `custom-cloud-${state.saved.length + 1}`, createdAt: Date.now() };
    state.saved.unshift(template);
    await next.route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(template) });
  };

  // Balance, billing history and the rest of the API are not under test.
  await page.route('**/api/**', (route) => route.fulfill({
    status: 404, contentType: 'application/json', body: '{"error":"not found"}',
  }));
  await page.route('**/api/billing/packages', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ packages: [] }),
  }));
  await page.route('**/api/templates', async (route) => {
    const request = route.request();
    expect(request.headers().authorization).toBe('Bearer e2e-token');
    if (request.method() === 'POST') {
      state.posts += 1;
      held.push({ route, body: request.postDataJSON() as Record<string, unknown> });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ templates: state.saved }) });
  });
  return state;
}

/** The container the active panel renders into on this layout. */
function panelRoot(page: Page) {
  return page.locator(isDesktopLayout(page) ? '#desktop-controls-panel' : '#mobile-controls-drawer');
}

/** Unmounts the Templates panel and shows it again. */
async function leaveAndReturnToTemplates(page: Page) {
  if (isDesktopLayout(page)) {
    await openPanel(page, 'Content');
    await expect(page.getByPlaceholder('Template name...')).toHaveCount(0);
  } else {
    await page.locator('#mobile-controls-drawer').getByRole('button', { name: 'Close controls' }).first().click();
    await expect(page.locator('#mobile-controls-drawer')).toHaveCount(0);
  }
  await openPanel(page, 'Templates');
}

async function startSave(page: Page, name: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openPanel(page, 'Templates');
  const root = panelRoot(page);
  await root.getByRole('button', { name: 'Save as Template' }).click();
  await root.getByPlaceholder('Template name...').fill(name);
  await root.getByRole('button', { name: 'Save', exact: true }).click();
}

test('a pending cloud save stays guarded after leaving and returning to Templates', async ({ page }) => {
  const cloud = await signInWithCloudTemplates(page);
  await startSave(page, 'Pending Cloud Template');
  await expect.poll(() => cloud.posts).toBe(1);

  await leaveAndReturnToTemplates(page);
  const root = panelRoot(page);
  const nameInput = root.getByPlaceholder('Template name...');
  const saveButton = root.getByRole('button', { name: 'Save', exact: true });
  await expect(nameInput).toHaveValue('Pending Cloud Template');
  await expect(nameInput).toBeDisabled();
  await expect(saveButton).toBeDisabled();

  // Navigating once more must not start a second creation either.
  await leaveAndReturnToTemplates(page);
  await expect(panelRoot(page).getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.waitForTimeout(300);
  expect(cloud.posts).toBe(1);

  await cloud.release();
  const cards = panelRoot(page).getByTestId('custom-template-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.getByText('Pending Cloud Template', { exact: true })).toBeVisible();
  await expect(panelRoot(page).getByPlaceholder('Template name...')).toHaveCount(0);
  await expect(panelRoot(page).getByRole('button', { name: 'Save as Template' })).toBeVisible();
  expect(cloud.posts).toBe(1);
});

test('a failed cloud save keeps its typed name across navigation for a deliberate retry', async ({ page }) => {
  const cloud = await signInWithCloudTemplates(page);
  await startSave(page, 'Retry Me');
  await expect.poll(() => cloud.posts).toBe(1);

  await leaveAndReturnToTemplates(page);
  await cloud.release(500);
  const root = panelRoot(page);
  await expect(root.getByText('The server may already have saved the change', { exact: false })).toBeVisible();
  const nameInput = root.getByPlaceholder('Template name...');
  await expect(nameInput).toHaveValue('Retry Me');
  await expect(nameInput).toBeEnabled();

  await leaveAndReturnToTemplates(page);
  await expect(panelRoot(page).getByPlaceholder('Template name...')).toHaveValue('Retry Me');
  await expect(panelRoot(page).getByTestId('custom-template-card')).toHaveCount(0);
  expect(cloud.posts).toBe(1);

  await panelRoot(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => cloud.posts).toBe(2);
  await cloud.release();
  const cards = panelRoot(page).getByTestId('custom-template-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.getByText('Retry Me', { exact: true })).toBeVisible();
});
