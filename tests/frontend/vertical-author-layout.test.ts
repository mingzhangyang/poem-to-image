import assert from 'node:assert/strict';
import test from 'node:test';
import { createStructuredPoemLayout } from '../../src/poemContent';
import { DEFAULT_POEM_STYLE, resolveAuthorPlacement } from '../../src/poemStyle';
import type { PoemLayerStyle, WritingMode } from '../../src/types';

const poem = {
  title: '山居秋暝',
  body: '空山新雨后天气晚来秋\n明月松间照清泉石上流',
  author: '王维',
  sourceNote: '唐诗',
};

function layoutFor(
  writingMode: WritingMode,
  overrides: Partial<PoemLayerStyle> = {},
  body = poem.body,
  poemOverrides: Partial<typeof poem> = {},
) {
  return createStructuredPoemLayout({
    poem: { ...poem, body, ...poemOverrides },
    poemStyle: { ...DEFAULT_POEM_STYLE, ...overrides },
    placeholder: '', writingMode, fontFamily: 'serif', fontSize: 32,
    columns: writingMode === 'vertical-rl' ? 2 : 1,
    columnGap: 12, wrapWidth: 620,
    measurerFactory: (_, size) => ({
      measureText: (value) => ({
        width: size * 0.8 * Array.from(value).length,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: size * 0.8,
        actualBoundingBoxAscent: size * 0.8,
        actualBoundingBoxDescent: size * 0.2,
      }),
    }),
  });
}

function section(layout: ReturnType<typeof layoutFor>, key: 'title' | 'body' | 'author' | 'sourceNote') {
  const match = layout.sections.find(item => item.key === key);
  assert.ok(match, key + ' should be present');
  return match;
}

test('auto vertical groups title and author before body while horizontal order stays unchanged', () => {
  assert.equal(DEFAULT_POEM_STYLE.authorPlacement, 'auto');
  assert.equal(resolveAuthorPlacement('auto', 'horizontal-tb'), 'before-body');
  assert.equal(resolveAuthorPlacement('auto', 'vertical-rl'), 'after-body');
  const horizontal = layoutFor('horizontal-tb');
  assert.deepEqual(horizontal.sections.map(s => s.key), ['title', 'author', 'body', 'sourceNote']);
  assert.ok(section(horizontal, 'author').y < section(horizontal, 'body').y);

  const vertical = layoutFor('vertical-rl');
  assert.deepEqual(vertical.sections.map(s => s.key), ['title', 'author', 'body', 'sourceNote']);
  const title = section(vertical, 'title');
  const author = section(vertical, 'author');
  const body = section(vertical, 'body');
  assert.ok(title.x > author.x && author.x > body.x);
  const titleAuthorGap = title.x - (author.x + author.layout.width);
  const authorBodyGap = author.x - (body.x + body.layout.width);
  assert.ok(titleAuthorGap >= 0 && titleAuthorGap < authorBodyGap,
    'the attribution should sit closer to the title than to the poem body');
});
function visibleGlyphCenter(section: ReturnType<typeof layoutFor>['sections'][number]) {
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const item of section.layout.items) {
    if (item.kind !== 'vertical-segment' || !item.text.trim()) continue;
    top = Math.min(top, item.y + item.inkTopY);
    bottom = Math.max(bottom, item.y + item.inkBottomY);
  }
  return section.y + (Number.isFinite(top) ? (top + bottom) / 2 : section.layout.height / 2);
}

test('vertical auto author is visually centered on the title and remains inside layout', () => {
  const vertical = layoutFor('vertical-rl', {}, '床前明月光\n疑是地上霜\n举头望明月\n低头思故乡', {
    title: '静夜思', author: '唐·李白', sourceNote: '',
  });
  const title = section(vertical, 'title');
  const author = section(vertical, 'author');
  const body = section(vertical, 'body');
  const columns = new Map<number, string>();
  for (const item of body.layout.items) {
    if (item.kind !== 'vertical-segment') continue;
    columns.set(item.x, (columns.get(item.x) ?? '') + item.text);
  }
  assert.deepEqual([...columns.entries()].sort(([left], [right]) => right - left).map(([, text]) => text),
    ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
    'newlines must yield four separate right-to-left columns');
  assert.ok(Math.abs(visibleGlyphCenter(title) - visibleGlyphCenter(author)) <= 1,
    'title and author should share the same painted-glyph center');
  for (const item of vertical.sections) {
    assert.ok(item.x >= 0);
    assert.ok(item.y >= 0);
    assert.ok(item.x + item.layout.width <= vertical.width + 1);
    assert.ok(item.y + item.layout.height <= vertical.height + 1);
  }
});
test('manual before/after placements preserve reading order and lower-body alignment', () => {
  const before = layoutFor('vertical-rl', { authorPlacement: 'before-body' });
  const after = layoutFor('vertical-rl', { authorPlacement: 'after-body' });
  const automatic = layoutFor('vertical-rl');
  assert.deepEqual(before.sections.map(s => s.key), ['title', 'author', 'body', 'sourceNote']);
  assert.deepEqual(after.sections.map(s => s.key), ['title', 'body', 'author', 'sourceNote']);
  assert.ok(section(before, 'author').x > section(before, 'body').x);
  assert.ok(section(after, 'author').x < section(after, 'body').x);
  assert.ok(section(automatic, 'author').x > section(automatic, 'body').x);
  assert.ok(section(before, 'author').y > section(before, 'body').y,
    'explicit before-body still aligns lower against the poem body');
  assert.ok(section(after, 'author').y > section(after, 'body').y,
    'explicit after-body still aligns lower against the poem body');
});
test('short body and long attribution keep title centering without clipping', () => {
  const baseline = layoutFor('vertical-rl', {}, '山', {
    title: '秋', author: '唐代诗人李太白', sourceNote: '',
  });
  const author = section(baseline, 'author');
  const title = section(baseline, 'title');
  const body = section(baseline, 'body');
  assert.ok(author.layout.height > title.layout.height);
  assert.ok(author.layout.height > body.layout.height);
  assert.ok(Math.abs(visibleGlyphCenter(title) - visibleGlyphCenter(author)) <= 1,
    'long signatures must not lose visual centering after shifting the scene');
  for (const item of baseline.sections) {
    assert.ok(item.y >= 0 && item.y + item.layout.height <= baseline.height + 1);
  }
  const moreText = layoutFor('vertical-rl', {}, '山川明月松间照', {
    title: '秋', author: '唐代诗人李太白', sourceNote: '',
  });
  assert.ok(Math.abs(visibleGlyphCenter(section(moreText, 'title')) - visibleGlyphCenter(section(moreText, 'author'))) <= 1);
});
test('title-less auto attribution retains its left-side body alignment', () => {
  const vertical = layoutFor('vertical-rl', {}, poem.body, { title: '', sourceNote: '' });
  assert.deepEqual(vertical.sections.map(s => s.key), ['body', 'author']);
  assert.ok(section(vertical, 'author').x < section(vertical, 'body').x);
});

test('source set after author follows the author even when auto groups it beside title', () => {
  const vertical = layoutFor('vertical-rl', { sourcePlacement: 'after-author' });
  assert.deepEqual(vertical.sections.map(s => s.key), ['title', 'author', 'sourceNote', 'body']);
  assert.ok(section(vertical, 'author').x > section(vertical, 'sourceNote').x);
});

test('auto attribution follows title moved after body while manual title placement stays intact', () => {
  const vertical = layoutFor('vertical-rl', { titlePlacement: 'after-body' });
  assert.deepEqual(vertical.sections.map(s => s.key), ['body', 'title', 'author', 'sourceNote']);
  assert.ok(section(vertical, 'title').x > section(vertical, 'author').x);
  assert.ok(Math.abs(visibleGlyphCenter(section(vertical, 'title')) - visibleGlyphCenter(section(vertical, 'author'))) <= 1);
});

test('no author omits the attribution without changing poem body placement', () => {
  const noAuthor = createStructuredPoemLayout({
    poem: { ...poem, author: '' },
    poemStyle: DEFAULT_POEM_STYLE,
    placeholder: '', writingMode: 'vertical-rl',
    fontFamily: 'serif', fontSize: 32, columns: 2, columnGap: 12,
    wrapWidth: 620,
    measurerFactory: (_, size) => ({
      measureText: (s) => ({
        width: s.length * size, actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: size, actualBoundingBoxAscent: size,
        actualBoundingBoxDescent: 0,
      }),
    }),
  });
  assert.deepEqual(noAuthor.sections.map(s => s.key), ['title', 'body', 'sourceNote']);
  assert.ok(noAuthor.width > 0 && noAuthor.height > 0);
});
