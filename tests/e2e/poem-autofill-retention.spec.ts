import { expect, test } from '@playwright/test';

test('metadata-only autofill retains the match without changing the body', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Inline poem fields are desktop-only');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.language', 'zh-CN');
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.sidebar-group', 'content');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const fields = page.locator('[data-content-inline-fields]');
  const title = fields.getByRole('textbox', { name: '标题', exact: true });
  const author = fields.getByRole('textbox', { name: '作者', exact: true });
  const body = fields.getByRole('textbox', { name: '正文', exact: true });
  const source = fields.getByRole('textbox', { name: '出处 / 注释', exact: true });
  const apply = fields.getByRole('button', { name: '一键套用' });
  // Exact poem-library body, including line breaks and the absence of punctuation.
  const canonicalBody = '床前明月光\n疑是地上霜\n举头望明月\n低头思故乡';
  await title.fill('静夜思');
  await author.fill('');
  await source.fill('');
  await body.fill(canonicalBody);
  await expect(apply).toBeVisible();
  await apply.click();
  await expect(title).toHaveValue('静夜思');
  await expect(body).toHaveValue(canonicalBody);
  await expect(author).toHaveValue('李白');
  await expect(source).toHaveValue('唐');
  await expect(apply).toHaveCount(0);

  // No body or title-presence change means no new match request is made.
  await author.fill('');
  await expect(apply).toBeVisible();
  await apply.click();
  await expect(author).toHaveValue('李白');
  await expect(apply).toHaveCount(0);
  await source.fill('');
  await expect(apply).toBeVisible();
  await apply.click();
  await expect(source).toHaveValue('唐');
  await expect(body).toHaveValue(canonicalBody);
  await expect(apply).toHaveCount(0);

  // Explicit dismissal still suppresses the match on later metadata edits.
  await author.fill('');
  await expect(apply).toBeVisible();
  await fields.locator('button[aria-label]').click();
  await expect(apply).toHaveCount(0);
  await source.fill('');
  await expect(apply).toHaveCount(0);
});
