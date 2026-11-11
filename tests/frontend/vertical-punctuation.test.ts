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
      actualBoundingBoxRight: size * Array.from(text).length * (/[，。、；：！？]/u.test(text) ? 0.2 : 0.8),
      actualBoundingBoxAscent: size * (/[，。、；：！？]/u.test(text) ? 0.15 : 0.8),
      actualBoundingBoxDescent: size * 0.1,
    }),
    supportsGlyph: () => glyphSupported,
  };
}

function paintedSectionCenter(section: ReturnType<typeof createStructuredPoemLayout>['sections'][number]) {
  const items = section.layout.items.filter(
    (item): item is VerticalTextLayoutItem => item.kind === 'vertical-segment' && Boolean(item.text.trim()),
  );
  assert.ok(items.length > 0);
  const top = Math.min(...items.map(item => item.y + item.inkTopY));
  const bottom = Math.max(...items.map(item => item.y + item.inkBottomY));
  return section.y + (top + bottom) / 2;
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

test('automatic columns never split six-dot Chinese ellipsis pairs', () => {
  for (const sample of ['甲……乙', '甲…………乙', '山川……草木']) {
    const characters = Array.from(sample);
    for (const columns of [2, 3, 4, 8]) {
      const parts = splitVerticalColumns(sample, columns);
      assert.equal(parts.join(''), sample);
      assert.ok(parts.length <= columns && parts.every(Boolean));
      let boundary = 0;
      for (const part of parts.slice(0, -1)) {
        boundary += Array.from(part).length;
        if (characters[boundary - 1] !== '…' || characters[boundary] !== '…') continue;
        let start = boundary - 1;
        while (start > 0 && characters[start - 1] === '…') start -= 1;
        assert.equal((boundary - start) % 2, 0, 'cut must fall between complete ellipsis pairs');
      }
    }
  }
  assert.deepEqual(splitVerticalColumns('甲……乙', 2), ['甲', '……乙']);
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

test('curly Chinese quotes use vertical corner glyphs and rotate source glyphs as fallback', () => {
  const forms: Array<[string, string]> = [
    ['“', '﹃'], ['”', '﹄'], ['‘', '﹁'], ['’', '﹂'],
  ];
  for (const [original, form] of forms) {
    assert.deepEqual(getVerticalGlyphPresentation(original), { renderText: form, rotation: 0 });
    assert.deepEqual(getVerticalGlyphPresentation(original, false), { renderText: original, rotation: 90 });
  }
  for (const source of ['“诗”', '‘诗’']) {
    const rendered = glyphs(source);
    assert.equal(rendered.map(item => item.text).join(''), source);
    assert.equal(rendered[0].rotation, 0);
    assert.equal(rendered[2].rotation, 0);

    const fallback = createTextLayout({
      text: source, writingMode: 'vertical-rl', fontSize: 32, lineHeight: 1.5, letterSpacing: 0,
    }, fakeMeasurer(32, false)).items as VerticalTextLayoutItem[];
    assert.equal(fallback[0].renderText, Array.from(source)[0]);
    assert.equal(fallback[0].rotation, 90);
    assert.equal(fallback[2].renderText, Array.from(source)[2]);
    assert.equal(fallback[2].rotation, 90);
  }
});

test('Latin, numeric runs, punctuation and spacing remain finite and in reading order', () => {
  const items = glyphs('春A12夏，秋2026。', 1, 32, 6, 1.8);
  assert.ok(items.some(item => item.sideways && item.rotation === 90));
  assert.equal(items.filter(item => item.text === '，').length, 1);
  assert.ok(items.every(item => Number.isFinite(item.x + item.y + item.startX + item.baselineY)));
  for (let i = 1; i < items.length; i += 1) assert.ok(items[i].y > items[i - 1].y);
});

test('body 70%, 100%, 160% preserve auto title-author ink centering across layout changes', () => {
  for (const bodyScale of [0.7, 1, 1.6]) {
    const layout = createStructuredPoemLayout({
      poem: {
        title: '静夜思。', author: '李白',
        body: '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
        sourceNote: '',
      },
      poemStyle: { ...DEFAULT_POEM_STYLE, bodyScale, bodyLetterSpacing: 5, bodyLineHeight: 2 },
      placeholder: '', writingMode: 'vertical-rl', fontFamily: 'serif',
      fontSize: 32, columns: 4, columnGap: 8,
      measurerFactory: (_, size) => fakeMeasurer(size),
    });
    assert.deepEqual(layout.sections.map(s => s.key), ['title', 'author', 'body']);
    const title = layout.sections.find(s => s.key === 'title')!;
    const body = layout.sections.find(s => s.key === 'body')!;
    const author = layout.sections.find(s => s.key === 'author')!;
    assert.ok(title.x > author.x && author.x > body.x);
    assert.ok(Math.abs(paintedSectionCenter(title) - paintedSectionCenter(author)) <= 1);
    assert.ok(layout.sections.every(s => s.x >= 0 && s.y >= 0
      && s.x + s.layout.width <= layout.width + 1
      && s.y + s.layout.height <= layout.height + 1));
  }
});

test('painted ink bounds include shifted punctuation and rotated sideways runs', () => {
  const stop = glyphs('山。', 1, 32).find(item => item.text === '。')!;
  assert.ok((stop.inkTopY + stop.inkBottomY) / 2 < -2,
    'full-stop ink sits above its logical cell center');
  assert.equal(stop.inkBottomY - stop.inkTopY, stop.height);

  const run = glyphs('山2026', 1, 32).find(item => item.text === '2026')!;
  assert.equal(run.rotation, 90);
  assert.ok(run.inkBottomY - run.inkTopY > run.height,
    'rotated number uses horizontal ink width for vertical bounds');
  assert.equal(run.inkTopY, run.startX, 'left ink edge rotates into the top edge');
});

test('automatic author aligns to painted title ink for punctuation and numeric runs', () => {
  for (const titleText of ['山。', '山2026']) {
    const layout = createStructuredPoemLayout({
      poem: { title: titleText, author: '唐李白', body: '山。\n月。', sourceNote: '' },
      poemStyle: DEFAULT_POEM_STYLE,
      placeholder: '', writingMode: 'vertical-rl', fontFamily: 'serif',
      fontSize: 36, columns: 2, columnGap: 12,
      measurerFactory: (_, size) => fakeMeasurer(size),
    });
    const title = layout.sections.find(s => s.key === 'title')!;
    const author = layout.sections.find(s => s.key === 'author')!;
    const titleInkCenter = paintedSectionCenter(title);
    assert.ok(Math.abs(titleInkCenter - paintedSectionCenter(author)) <= 1,
      `painted centers differ for ${titleText}`);
    const oldBoxTop = Math.min(...title.layout.items
      .filter(item => item.kind === 'vertical-segment')
      .map(item => item.y - item.height / 2));
    const oldBoxBottom = Math.max(...title.layout.items
      .filter(item => item.kind === 'vertical-segment')
      .map(item => item.y + item.height / 2));
    assert.ok(Math.abs(titleInkCenter - (title.y + (oldBoxTop + oldBoxBottom) / 2)) > 2,
      `old logical-box centering would miss the painted center of ${titleText}`);
  }
});

test('explicit and title-less author placements align last painted ink after punctuation or numbers', () => {
  for (const bodyText of ['山川云海明月照林间。', '山川云海明月照2026']) {
    for (const placement of ['before-body', 'after-body', 'auto'] as const) {
      const layout = createStructuredPoemLayout({
        poem: { title: placement === 'auto' ? '' : '山居', author: '李白', body: bodyText, sourceNote: '' },
        poemStyle: { ...DEFAULT_POEM_STYLE, authorPlacement: placement },
        placeholder: '', writingMode: 'vertical-rl', fontFamily: 'serif',
        fontSize: 36, columns: 1, columnGap: 12,
        measurerFactory: (_, size) => fakeMeasurer(size),
      });
      const body = layout.sections.find(s => s.key === 'body')!;
      const author = layout.sections.find(s => s.key === 'author')!;
      const lastInkCenter = (section: typeof author) => section.y + Math.max(
        ...section.layout.items
          .filter((item): item is VerticalTextLayoutItem => item.kind === 'vertical-segment' && Boolean(item.text.trim()))
          .map(item => item.y + (item.inkTopY + item.inkBottomY) / 2),
      );
      assert.ok(Math.abs(lastInkCenter(body) - lastInkCenter(author)) <= 1,
        `last painted glyph mismatch: ${placement}, ${bodyText}`);
    }
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


test('punctuation ink sits within the em square, independent of extra line leading', () => {
  const compact = glyphs('山，', 1, 32, 0, 1);
  const loose = glyphs('山，', 1, 32, 0, 2.8);
  assert.equal(compact[1].baselineY, loose[1].baselineY);
  assert.equal(compact[1].startX, loose[1].startX);
  assert.ok(loose[1].y > compact[1].y, 'line height affects logical advance only');
});


test('automatic columns never split a contiguous Latin or numeric sideways run', () => {
  const sentence = '春2026夏2027秋';
  const parts = splitVerticalColumns(sentence, 4);
  assert.equal(parts.join(''), sentence);
  assert.ok(parts.some(part => part.includes('2026')), '2026 stays one sideways run');
  assert.ok(parts.some(part => part.includes('2027')), '2027 stays one sideways run');
});
