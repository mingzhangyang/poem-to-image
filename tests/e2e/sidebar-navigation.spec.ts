import { expect, test, type Page } from '@playwright/test';
import { openPanel, panelSummary } from './helpers/sidebarNavigation';

const SIDEBAR_GROUP_KEY = 'poem-to-image.sidebar-group';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.language', 'en');
  });
});

async function dismissOnboarding(page: Page) {
  await page.addInitScript(() => localStorage.setItem('poem-to-image.onboarding-dismissed', 'true'));
}

const rail = (page: Page) => page.getByRole('tablist', { name: 'Control panels' });
const tab = (page: Page, name: string) => rail(page).getByRole('tab', { name, exact: true });
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

test.describe('desktop navigation rail', () => {
  test.skip(({ isMobile }) => isMobile, 'The rail is the desktop layout');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('rail tabs show one panel at a time and label the tab panel', async ({ page }) => {
    await dismissOnboarding(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(rail(page)).toHaveAttribute('aria-orientation', 'vertical');
    await expect(rail(page).getByRole('tab')).toHaveText(
      ['Templates', 'Size', 'Content', 'Typography', 'Background', 'Decor', 'Settings'],
    );
    // Content is the first-visit default.
    await expect(tab(page, 'Content')).toHaveAttribute('aria-selected', 'true');
    await expect(region(page, 'Content')).toBeVisible();

    const panels = [
      ['Templates', 'Templates'],
      ['Size', 'Canvas Size'],
      ['Typography', 'Typography'],
      ['Background', 'Background'],
      ['Decor', 'Decorations & Elements'],
    ] as const;
    for (const [label, title] of panels) {
      await tab(page, label).click();
      await expect(tab(page, label)).toHaveAttribute('aria-selected', 'true');
      await expect(tab(page, label)).toHaveAttribute('aria-controls', 'desktop-controls-panel');
      await expect(page.getByRole('tabpanel', { name: label, exact: true })).toBeVisible();
      await expect(region(page, title)).toBeVisible();
      await expect(page.locator('#desktop-controls-panel > div > section')).toHaveCount(1);
    }

    await tab(page, 'Settings').click();
    await expect(page.getByRole('tabpanel').getByText('Language', { exact: true })).toBeVisible();
    await expect(region(page, 'Decorations & Elements')).toHaveCount(0);
  });

  test('the app mark heads the rail, outside the tab list, and the panel column has no brand header', async ({ page }) => {
    await dismissOnboarding(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const brand = page.getByRole('heading', { level: 1, name: 'InkPoem' });
    await expect(brand).toBeVisible();
    await expect(rail(page).getByRole('heading')).toHaveCount(0);
    const brandBox = await brand.boundingBox();
    const firstTabBox = await tab(page, 'Templates').boundingBox();
    expect(brandBox!.x + brandBox!.width).toBeLessThanOrEqual(72);
    expect(brandBox!.y + brandBox!.height).toBeLessThanOrEqual(firstTabBox!.y);
    // The subtitle and wordmark header no longer sit above the active panel.
    await expect(page.getByText('Poetic moods', { exact: false })).toBeHidden();
  });

  test('the desktop panel fills an opaque column flat and pins its heading while scrolling', async ({ page }) => {
    await dismissOnboarding(page);
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await tab(page, 'Typography').click();

    const section = page.locator('#desktop-controls-panel > div > section');
    const look = await section.evaluate((node) => {
      const style = getComputedStyle(node);
      const aside = node.closest('aside')!;
      return { radius: style.borderTopLeftRadius, shadow: style.boxShadow, asideBg: getComputedStyle(aside).backgroundColor };
    });
    expect(look.radius).toBe('0px');
    // Tailwind composes shadow-none from transparent layers, so check that none is visible.
    const visibleShadows = look.shadow.split(/,(?![^(]*\))/).filter((layer) => layer.trim() !== 'none' && !layer.includes('rgba(0, 0, 0, 0)'));
    expect(visibleShadows).toEqual([]);
    expect(look.asideBg).toBe('rgb(255, 253, 248)');

    const heading = region(page, 'Typography').getByRole('heading', { level: 2 });
    const before = (await heading.boundingBox())!.y;
    await page.locator('#desktop-controls-panel > div').evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await expect.poll(async () => (await heading.boundingBox())!.y).toBeCloseTo(before, 0);
  });

  test('arrow keys, Home and End move focus and select tabs with a roving tab index', async ({ page }) => {
    await dismissOnboarding(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const content = tab(page, 'Content');
    await expect(content).toHaveAttribute('tabindex', '0');
    await expect(tab(page, 'Templates')).toHaveAttribute('tabindex', '-1');
    await content.focus();

    await page.keyboard.press('ArrowDown');
    await expect(tab(page, 'Typography')).toBeFocused();
    await expect(tab(page, 'Typography')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Typography')).toHaveAttribute('tabindex', '0');
    await expect(content).toHaveAttribute('tabindex', '-1');
    await expect(region(page, 'Typography')).toBeVisible();

    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(tab(page, 'Size')).toBeFocused();
    await expect(region(page, 'Canvas Size')).toBeVisible();

    await page.keyboard.press('End');
    await expect(tab(page, 'Settings')).toBeFocused();
    await expect(tab(page, 'Settings')).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowDown');
    await expect(tab(page, 'Templates')).toBeFocused();
    await expect(region(page, 'Templates')).toBeVisible();

    await page.keyboard.press('ArrowUp');
    await expect(tab(page, 'Settings')).toBeFocused();

    await page.keyboard.press('Home');
    await expect(tab(page, 'Templates')).toBeFocused();
    await expect(tab(page, 'Templates')).toHaveAttribute('aria-selected', 'true');
  });

  test('the last panel survives a reload; Settings does not', async ({ page }) => {
    await dismissOnboarding(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openPanel(page, 'Background');
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), SIDEBAR_GROUP_KEY)).toBe('background');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(tab(page, 'Background')).toHaveAttribute('aria-selected', 'true');
    await expect(region(page, 'Background')).toBeVisible();

    await openPanel(page, 'Settings');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(tab(page, 'Background')).toHaveAttribute('aria-selected', 'true');
  });

  test('an unreadable stored panel falls back to Content', async ({ page }) => {
    await dismissOnboarding(page);
    await page.addInitScript((key) => localStorage.setItem(key, 'style'), SIDEBAR_GROUP_KEY);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(tab(page, 'Content')).toHaveAttribute('aria-selected', 'true');
  });

  test('starting from onboarding shows Content even when another panel was remembered', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'background'), SIDEBAR_GROUP_KEY);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const welcome = page.getByRole('dialog', { name: 'Every word, exactly right.' });
    await welcome.getByRole('button', { name: "Got it, let's start" }).click();
    const editor = page.getByRole('dialog', { name: 'Poem Editor' });
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: 'Done' }).click();
    await expect(tab(page, 'Content')).toHaveAttribute('aria-selected', 'true');
  });

  test('applying a template, adding a text box and selecting an ornament switch panels', async ({ page }) => {
    await dismissOnboarding(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // A template applied from the gallery keeps the gallery in view.
    await openPanel(page, 'Templates');
    await page.getByRole('button', { name: /^More \(/ }).click();
    await page.getByRole('dialog', { name: 'Built-in Templates' }).getByRole('button', { name: /Song Floral/ }).click();
    await expect(tab(page, 'Templates')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('button[aria-pressed]').filter({ hasText: 'Song Floral' }).first()).toHaveAttribute('aria-pressed', 'true');

    // A new text box reveals Decorations, where it is edited.
    await openPanel(page, 'Decor');
    const summary = panelSummary(page, 'Decorations & Elements');
    const before = Number((await summary.textContent())?.match(/(\d+) Custom Texts/)?.[1]);
    await page.getByRole('button', { name: 'Add Text Box' }).click();
    await expect(tab(page, 'Decor')).toHaveAttribute('aria-selected', 'true');
    await expect(summary).toContainText(`${before + 1} Custom Texts`);

    // Selecting an ornament on the canvas brings its controls back.
    await page.getByRole('button', { name: /^Ornaments/ }).click();
    await page.getByRole('button', { name: 'Autumn', exact: true }).click();
    await page.getByRole('button', { name: 'Chrysanthemum', exact: true }).click();
    const ornament = page.locator('img[alt="Chrysanthemum"]').first();
    await expect(ornament).toBeVisible();
    await openPanel(page, 'Content');
    await expect(page.getByRole('slider', { name: 'Rotation', exact: true })).toHaveCount(0);
    await ornament.click();
    await expect(tab(page, 'Decor')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('slider', { name: 'Rotation', exact: true })).toBeVisible();
  });
});

test.describe('mobile dock and More menu', () => {
  test.skip(({ isMobile }) => !isMobile, 'The dock is the mobile layout');

  test('More lists the panels that are not pinned and opens each one', async ({ page }) => {
    await dismissOnboarding(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const dock = page.locator('#mobile-dock');
    await expect(dock.getByRole('button')).toHaveText(['Templates', 'Content', 'Decor', 'Export', 'More']);
    // Settings moved from a floating shortcut into More.
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0);

    const more = dock.getByRole('button', { name: 'More', exact: true });
    const drawer = page.locator('#mobile-controls-drawer');
    const destinations = [
      ['Size', 'Canvas Size', page.getByRole('combobox', { name: 'Preset Sizes' })],
      ['Typography', 'Typography', page.getByRole('combobox', { name: 'Font Family' })],
      ['Background', 'Background', page.getByRole('button', { name: 'Solid', exact: true })],
      ['Settings', 'Settings', page.getByRole('button', { name: 'English', exact: true })],
    ] as const;

    await more.click();
    const menu = page.getByRole('dialog', { name: 'More', exact: true });
    await expect(menu).toBeVisible();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('listitem')).toHaveText(destinations.map(([label]) => label));
    await menu.getByRole('button', { name: 'Close controls' }).click();
    await expect(drawer).toBeHidden();

    for (const [label, title, control] of destinations) {
      await more.click();
      await page.getByRole('dialog', { name: 'More', exact: true }).getByRole('button', { name: label, exact: true }).click();
      const panel = page.getByRole('dialog', { name: title, exact: true });
      await expect(panel).toBeVisible();
      await expect(panel).toBeFocused();
      await expect(control).toBeVisible();
      // A destination from More keeps More highlighted.
      await expect(more).toHaveAttribute('aria-expanded', 'true');
      await expect(more).toHaveClass(/bg-\(--app-accent-700\)/);
      await panel.getByRole('button', { name: 'Close controls' }).click();
      await expect(drawer).toBeHidden();
    }

    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await dock.getByRole('button', { name: 'Decor', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Decorations & Elements', exact: true })).toBeVisible();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(more).not.toHaveClass(/bg-\(--app-accent-700\)/);
  });

  test('selecting an ornament on the canvas does not open a drawer', async ({ page }) => {
    await dismissOnboarding(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openPanel(page, 'Decor');
    await page.getByRole('button', { name: /^Ornaments/ }).click();
    await page.getByRole('button', { name: 'Autumn', exact: true }).click();
    await page.getByRole('button', { name: 'Chrysanthemum', exact: true }).click();
    const drawer = page.locator('#mobile-controls-drawer');
    await drawer.getByRole('button', { name: 'Close controls' }).click();
    await expect(drawer).toBeHidden();
    await page.locator('img[alt="Chrysanthemum"]').first().click();
    await expect(drawer).toBeHidden();
  });
});
