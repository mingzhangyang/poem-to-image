import type { Page } from '@playwright/test';

/** The desktop layout (navigation rail) starts at Tailwind's `lg` breakpoint. */
export function isDesktopLayout(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1024;
}

/**
 * Opens a control panel (or Settings) by its navigation label: the desktop
 * rail tab, or on mobile the dock button or the item in the More menu. On
 * mobile the drawer must be closed, unless it already shows a docked panel.
 */
export async function openPanel(page: Page, label: string): Promise<void> {
  if (isDesktopLayout(page)) {
    await page.getByRole('tab', { name: label, exact: true }).click();
    return;
  }
  const dock = page.locator('#mobile-dock');
  const docked = dock.getByRole('button', { name: label, exact: true });
  // The editor mounts after the draft loads and shows English labels until a
  // locale has loaded, so give a docked label a moment to appear.
  await docked.waitFor({ timeout: 3_000 }).catch(() => {});
  if (await docked.count() > 0) {
    // Already open in the drawer: the dock button controls it.
    if (await docked.getAttribute('aria-expanded') !== 'true') await docked.click();
    return;
  }
  await dock.getByRole('button').last().click();
  await page.locator('#mobile-controls-drawer').getByRole('button', { name: label, exact: true }).click();
}

/** The summary line under a panel's heading. */
export function panelSummary(page: Page, title: string) {
  return page.getByRole('region', { name: title, exact: true }).locator('[data-section-summary]');
}
