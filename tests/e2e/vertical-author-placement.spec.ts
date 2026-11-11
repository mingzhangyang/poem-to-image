import { expect, test } from '@playwright/test';

test('real-browser vertical author appears beside title and shares its visual center', async ({ page }) => {
  await page.route('**/api/billing/packages', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ packages: [] }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('poem-to-image.onboarding-dismissed', 'true');
    localStorage.setItem('poem-to-image.language', 'en');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await page.getByRole('button', { name: 'Open Editor' }).click();
    const authorPlacement = page.getByRole('dialog', { name: 'Poem Editor' })
      .getByRole('combobox', { name: 'Relative Position' }).nth(1);
    await expect(authorPlacement).toHaveValue('auto');
  }
  const result = await page.evaluate(async () => {
    const contentPath = '/src/poemContent.ts';
    const stylePath = '/src/poemStyle.ts';
    const { createStructuredPoemLayout } = await import(/* @vite-ignore */ contentPath) as typeof import('../../src/poemContent');
    const { DEFAULT_POEM_STYLE } = await import(/* @vite-ignore */ stylePath) as typeof import('../../src/poemStyle');
    const scene = createStructuredPoemLayout({
      poem: { title: '山居秋暝', author: '王维', body: '空山新雨后天气晚来秋\n明月松间照清泉石上流', sourceNote: '' },
      poemStyle: DEFAULT_POEM_STYLE,
      placeholder: '', writingMode: 'vertical-rl',
      fontFamily: 'serif', fontSize: 32, columns: 2, columnGap: 12, wrapWidth: 620,
    });
    const title = scene.sections.find((s) => s.key === 'title')!;
    const body = scene.sections.find((s) => s.key === 'body')!;
    const author = scene.sections.find((s) => s.key === 'author')!;
    const visualCenter = (section: typeof title) => {
      let top = Number.POSITIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;
      for (const item of section.layout.items) {
        if (item.kind !== 'vertical-segment' || !item.text.trim()) continue;
        top = Math.min(top, item.y - item.height / 2);
        bottom = Math.max(bottom, item.y + item.height / 2);
      }
      return section.y + (top + bottom) / 2;
    };
    return {
      order: scene.sections.map((s) => s.key),
      titleX: title.x, authorX: author.x, bodyX: body.x,
      titleAuthorGap: title.x - (author.x + author.layout.width),
      authorBodyGap: author.x - (body.x + body.layout.width),
      titleCenter: visualCenter(title), authorCenter: visualCenter(author),
    };
  });
  expect(result.order).toEqual(['title', 'author', 'body']);
  expect(result.titleX).toBeGreaterThan(result.authorX);
  expect(result.authorX).toBeGreaterThan(result.bodyX);
  expect(result.titleAuthorGap).toBeLessThan(result.authorBodyGap);
  expect(Math.abs(result.titleCenter - result.authorCenter)).toBeLessThanOrEqual(1);
});
