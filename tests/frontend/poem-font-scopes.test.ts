import assert from 'node:assert/strict';
import test from 'node:test';
import { createStructuredPoemLayout } from '../../src/poemContent';
import { DEFAULT_POEM_STYLE, isSamePoemLayerStyle, normalizePoemLayerStyle } from '../../src/poemStyle';
import type { PoemLayerStyle, WritingMode } from '../../src/types';

const poem = { title: '春光', author: '诗人', body: '山川明月', sourceNote: '诗集' };

function calculateSizes(base: number, style: PoemLayerStyle, mode: WritingMode = 'horizontal-tb') {
  const layout = createStructuredPoemLayout({
    poem, poemStyle: style, placeholder: '', writingMode: mode,
    fontFamily: 'serif', fontSize: base, columns: 1, columnGap: 0, wrapWidth: 500,
    measurerFactory: (_, px) => ({
      measureText: (text: string) => ({
        width: Array.from(text).length * px * 0.6,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: px * 0.6,
        actualBoundingBoxAscent: px * 0.8,
        actualBoundingBoxDescent: px * 0.2,
      }),
    }),
  });
  assert.ok(Number.isFinite(layout.width) && layout.width > 0);
  assert.ok(Number.isFinite(layout.height) && layout.height > 0);
  assert.equal(layout.sections.length, 4);
  return Object.fromEntries(layout.sections.map(section => [section.key, section.fontSize]));
}

test('body scale at 100% preserves the previous base font size in both layouts', () => {
  for (const mode of ['horizontal-tb', 'vertical-rl'] as const) {
    const baseline = calculateSizes(32, DEFAULT_POEM_STYLE, mode);
    assert.equal(baseline.body, 32);
    const legacy = { ...DEFAULT_POEM_STYLE } as Partial<PoemLayerStyle>;
    delete legacy.bodyScale;
    assert.deepEqual(calculateSizes(32, legacy as PoemLayerStyle, mode), baseline);
    assert.equal(normalizePoemLayerStyle(legacy).bodyScale, 1);
    assert.equal(isSamePoemLayerStyle(legacy as PoemLayerStyle, DEFAULT_POEM_STYLE), true);
  }
});

test('relative body size affects only body; base font size affects every poem layer', () => {
  for (const mode of ['horizontal-tb', 'vertical-rl'] as const) {
    const original = calculateSizes(32, DEFAULT_POEM_STYLE, mode);
    const changedBody = calculateSizes(32, { ...DEFAULT_POEM_STYLE, bodyScale: 1.5 }, mode);
    assert.equal(changedBody.body, 48);
    for (const key of ['title', 'author', 'sourceNote'] as const) {
      assert.equal(changedBody[key], original[key], key + ' should stay fixed');
    }
    const largerBase = calculateSizes(48, DEFAULT_POEM_STYLE, mode);
    for (const key of ['title', 'body', 'author', 'sourceNote'] as const) {
      assert.ok(largerBase[key] > original[key], key + ' responds to base font');
    }
  }
});

test('body size persists in layer style projection and can be reset', () => {
  const updated = normalizePoemLayerStyle({ bodyScale: 0.7 });
  assert.equal(updated.bodyScale, 0.7);
  assert.equal(calculateSizes(32, updated).body, 22);
  assert.equal(normalizePoemLayerStyle().bodyScale, 1);
  assert.equal(normalizePoemLayerStyle({ bodyScale: Number.NaN }).bodyScale, 1);
  assert.equal(normalizePoemLayerStyle({ bodyScale: Number.POSITIVE_INFINITY }).bodyScale, 1);
  assert.equal(normalizePoemLayerStyle({ bodyScale: 20 }).bodyScale, 1.6);
  assert.equal(normalizePoemLayerStyle({ bodyScale: -20 }).bodyScale, 0.7);
  assert.equal(calculateSizes(32, { ...DEFAULT_POEM_STYLE, bodyScale: Number.NaN }).body, 32);
});
