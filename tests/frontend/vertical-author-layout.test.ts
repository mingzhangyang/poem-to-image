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

function layoutFor(writingMode: WritingMode, overrides: Partial<PoemLayerStyle> = {}, body = poem.body) {
  return createStructuredPoemLayout({
    poem: { ...poem, body },
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

test('the automatic placement keeps horizontal reading order but moves vertical attribution left', () => {
  assert.equal(DEFAULT_POEM_STYLE.authorPlacement, 'auto');
  assert.equal(resolveAuthorPlacement('auto', 'horizontal-tb'), 'before-body');
  assert.equal(resolveAuthorPlacement('auto', 'vertical-rl'), 'after-body');
  const horizontal = layoutFor('horizontal-tb');
  assert.deepEqual(horizontal.sections.map(s => s.key), ['title', 'author', 'body', 'sourceNote']);
  assert.ok(section(horizontal, 'author').y < section(horizontal, 'body').y);
  const vertical = layoutFor('vertical-rl');
  assert.deepEqual(vertical.sections.map(s => s.key), ['title', 'body', 'author', 'sourceNote']);
  assert.ok(section(vertical, 'title').x > section(vertical, 'body').x);
  assert.ok(section(vertical, 'body').x > section(vertical, 'author').x);
});

test('vertical author lands at the lower body edge without clipping or changing other layers', () => {
  const vertical = layoutFor('vertical-rl');
  const body = section(vertical, 'body');
  const author = section(vertical, 'author');
  assert.ok(author.y > body.y, 'the attribution should not start alongside the first poem glyph');
  assert.ok(Math.abs(author.y + author.layout.height - (body.y + body.layout.height)) <= 1,
    'author signature should finish near the bottom of the main poem');
  for (const item of vertical.sections) {
    assert.ok(item.x >= 0);
    assert.ok(item.y >= 0);
    assert.ok(item.x + item.layout.width <= vertical.width + 1);
    assert.ok(item.y + item.layout.height <= vertical.height + 1);
  }
});

test('an explicit earlier column remains on the right; automatic/explicit later columns remain left', () => {
  const before = layoutFor('vertical-rl', { authorPlacement: 'before-body' });
  const after = layoutFor('vertical-rl', { authorPlacement: 'after-body' });
  assert.deepEqual(before.sections.map(s => s.key), ['title', 'author', 'body', 'sourceNote']);
  assert.ok(section(before, 'author').x > section(before, 'body').x);
  assert.ok(section(after, 'author').x < section(after, 'body').x);
  assert.ok(section(before, 'author').y > section(before, 'body').y,
    'legacy explicit before-body positioning still benefits from lower visual alignment');
  const defaultLayout = layoutFor('vertical-rl');
  assert.equal(section(after, 'author').x, section(defaultLayout, 'author').x);
});

test('short body and long author safely expand the vertical layout', () => {
  const vertical = layoutFor('vertical-rl', {}, '山',);
  const author = section(vertical, 'author');
  assert.ok(author.y >= 0);
  assert.ok(author.y + author.layout.height <= vertical.height + 1);
  const longAuthor = layoutFor('vertical-rl', {}, '山');
  assert.ok(longAuthor.width > 0 && longAuthor.height > 0);
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
