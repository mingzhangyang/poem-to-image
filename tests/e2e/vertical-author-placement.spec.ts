import { expect, test } from '@playwright/test';

test('real-browser vertical author follows body and aligns near its lower edge', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const contentPath = '/src/poemContent.ts';
    const stylePath = '/src/poemStyle.ts';
    const { createStructuredPoemLayout } = await import(/* @vite-ignore */ contentPath);
    const { DEFAULT_POEM_STYLE } = await import(/* @vite-ignore */ stylePath);
    const scene = createStructuredPoemLayout({
      poem: { title: '山居秋暝', author: '王维', body: '空山新雨后天气晚来秋\n明月松间照清泉石上流', sourceNote: '' },
      poemStyle: DEFAULT_POEM_STYLE,
      placeholder: '', writingMode: 'vertical-rl',
      fontFamily: 'serif', fontSize: 32, columns: 2, columnGap: 12, wrapWidth: 620,
    });
    const body = scene.sections.find((s) => s.key === 'body')!;
    const author = scene.sections.find((s) => s.key === 'author')!;
    return {
      order: scene.sections.map((s) => s.key),
      bodyX: body.x, authorX: author.x,
      bodyY: body.y, authorY: author.y,
      bodyEnd: body.y + body.layout.height, authorEnd: author.y + author.layout.height,
    };
  });
  expect(result.order).toEqual(['title', 'body', 'author']);
  expect(result.authorX).toBeLessThan(result.bodyX);
  expect(result.authorY).toBeGreaterThan(result.bodyY);
  expect(Math.abs(result.bodyEnd - result.authorEnd)).toBeLessThanOrEqual(1);
});
