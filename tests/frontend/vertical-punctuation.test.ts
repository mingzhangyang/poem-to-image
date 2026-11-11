import assert from 'node:assert/strict';
import test from 'node:test';
import { createTextLayout, type TextLayoutMeasurer, type VerticalTextLayoutItem } from '../../src/textLayout';
import { createStructuredPoemLayout } from '../../src/poemContent';
import { DEFAULT_POEM_STYLE } from '../../src/poemStyle';
import {
  classifyVerticalPunctuation, getVerticalGlyphPresentation, splitVerticalColumns,
} from '../../src/verticalPunctuation';

function fakeMeasurer(size = 30, glyphSupported = true): TextLayoutMeasurer {
  return {
    measureText: (text) => ({
      width: size * Array.from(text).length,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: size * (/[，。、；：！？]/u.test(text) ? 0.2 : 0.8),
      actualBoundingBoxAscent: size * (/[，。、；：！？]/u.test(text) ? 0.15 : 0.8),
      actualBoundingBoxDescent: size * 0.1,
    }),
    supportsGlyph: () => glyphSupported,
  };
}

function glyphs(text: string, columns = 1, fontSize = 30, letterSpacing = 0, lineHeight = 1.5) {
  return createTextLayout({
    text, writingMode: 'vertical-rl', fontSize, lineHeight, letterSpacing,
    columns, columnGap: 12,
  }, fakeMeasurer(fontSize)).items as VerticalTextLayoutItem[];
}

test('Chinese punctuation classes and Unicode vertical bracket forms are explicit', () => {
  for (const char of Array.from('，。、；：！？')) assert.equal(classifyVerticalPunctuation(char), 'pause');
  for (const char of Array.from('「『（〔【《〈')) assert.equal(classifyVerticalPunctuation(char), 'opening');
  for (const char of Array.from('」』）〕】》〉')) assert.equal(classifyVerticalPunctuation(char), 'closing');
  assert.equal(classifyVerticalPunctuation('夜'), 'other');
  assert.deepEqual(getVerticalGlyphPresentation('《'), { renderText: '︽', rotation: 0 });
  assert.deepEqual(getVerticalGlyphPresentation('《', false), { renderText: '《', rotation: 90 });
});

test('Jing Ye Si: four manual vertical columns, punctuation occupies its own square', () => {
  const lines = ['床前明月光，', '疑是地上霜。', '举头望明月，', '低头思故乡。'];
  const items = glyphs(lines.join('\n'), 4);
  assert.equal(items.map(item => item.text).join(''), lines.join(''));
  const commas = items.filter(item => item.text === '，');
  const periods = items.filter(item => item.text === '。');
  assert.equal(commas.length, 2);
  assert.equal(periods.length, 2);
  assert.ok(commas[0].x > commas[1].x, 'manual columns read right to left');
  const preceding = items[items.indexOf(commas[0]) - 1];
  assert.equal(commas[0].x, preceding.x, 'a comma retains the same column');
  assert.ok(commas[0].y > preceding.y, 'a comma retains a logical advance');
  assert.ok(commas[0].startX > preceding.startX, 'ink moves toward the right edge');
  assert.ok(commas[0].baselineY < preceding.baselineY, 'ink moves toward upper cell edge');
});

test('automatic columns forbid closing punctuation at starts and opening punctuation at ends', () => {
  const samples = [
    '床前明月光，疑是地上霜。举头望明月，低头思故乡。',
    '春风《诗经》；秋月「落花」！',
    '甲……乙，。丙？！丁',
    '『你好』【书】（甲）〔乙〕〈丙〉',
  ];
  for (const sample of samples) {
    for (const columns of [2, 3, 4, 8]) {
      const parts = splitVerticalColumns(sample, columns);
      assert.equal(parts.join(''), sample);
      assert.ok(parts.every(Boolean));
      assert.ok(parts.length <= columns);
      for (const part of parts.slice(1)) {
        assert.notEqual(classifyVerticalPunctuation(Array.from(part)[0]), 'pause');
        assert.notEqual(classifyVerticalPunctuation(Array.from(part)[0]), 'closing');
      }
      for (const part of parts.slice(0, -1)) {
        assert.notEqual(classifyVerticalPunctuation(Array.from(part).at(-1)!), 'opening');
      }
    }
  }
});

test('no eligible boundary gracefully shrinks the number of columns', () => {
  assert.deepEqual(splitVerticalColumns('字，', 3), ['字，']);
  assert.deepEqual(splitVerticalColumns('《字》', 3), ['《字》']);
  assert.deepEqual(splitVerticalColumns('山', 12), ['山']);
  assert.deepEqual(splitVerticalColumns('山川', 12), ['山', '川']);
});

test('brackets, quotes, book-title marks and unsupported-font rotation', () => {
  const characters = '「书」『诗』（甲）〔乙〕【丙】《丁》〈戊〉';
  const items = glyphs(characters);
  assert.equal(items.map(item => item.text).join(''), characters);
  for (const item of items.filter(i => i.renderText !== i.text)) {
    assert.equal(item.rotation, 0, 'vertical form already has the correct orientation');
  }
  const unsupported = createTextLayout({
    text: '《书》', writingMode: 'vertical-rl', fontSize: 32, lineHeight: 1.5, letterSpacing: 0,
  }, fakeMeasurer(32, false)).items as VerticalTextLayoutItem[];
  assert.equal(unsupported[0].renderText, '《');
  assert.equal(unsupported[0].rotation, 90);
  assert.equal(unsupported[2].rotation, 90);
  assert.ok(unsupported.every(i => Number.isFinite(i.startX) && Number.isFinite(i.baselineY)));
});

test('Latin, numeric runs, punctuation and spacing remain finite and in reading order', () => {
  const items = glyphs('春A12夏，秋2026。', 1, 32, 6, 1.8);
  assert.ok(items.some(item => item.sideways && item.rotation === 90));
  assert.equal(items.filter(item => item.text === '，').length, 1);
  assert.ok(items.every(item => Number.isFinite(item.x + item.y + item.startX + item.baselineY)));
  for (let i = 1; i < items.length; i += 1) assert.ok(items[i].y > items[i - 1].y);
});

test('body 70%, 100%, 160% preserve author-left and bottom-alignment across layout changes', () => {
  for (const bodyScale of [0.7, 1, 1.6]) {
    const layout = createStructuredPoemLayout({
      poem: {
        title: '静夜思', author: '李白',
        body: '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
        sourceNote: '',
      },
      poemStyle: { ...DEFAULT_POEM_STYLE, bodyScale, bodyLetterSpacing: 5, bodyLineHeight: 2 },
      placeholder: '', writingMode: 'vertical-rl', fontFamily: 'serif',
      fontSize: 32, columns: 4, columnGap: 8,
      measurerFactory: (_, size) => fakeMeasurer(size),
    });
    const body = layout.sections.find(s => s.key === 'body')!;
    const author = layout.sections.find(s => s.key === 'author')!;
    assert.ok(author.x < body.x);
    assert.ok(Math.abs(author.y + author.layout.height - body.y - body.layout.height) <= 1);
    assert.ok(layout.sections.every(s => s.x >= 0 && s.y >= 0
      && s.x + s.layout.width <= layout.width + 1
      && s.y + s.layout.height <= layout.height + 1));
  }
});

test('horizontal lines and source data are untouched by vertical-only presentation', () => {
  const poem = '一，二。\n《三》！';
  const layout = createTextLayout({
    text: poem, writingMode: 'horizontal-tb', fontSize: 30, lineHeight: 1.5,
    letterSpacing: 2, columns: 1,
  }, fakeMeasurer());
  assert.deepEqual(layout.items.map(item => item.text), poem.split('\n'));
  assert.equal(layout.items[0].kind, 'horizontal-line');
});
