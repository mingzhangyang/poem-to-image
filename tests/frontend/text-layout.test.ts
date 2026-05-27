import assert from 'node:assert/strict';
import test from 'node:test';
import { createTextLayout, type TextLayoutMeasurer } from '../../src/textLayout';
import type { HorizontalTextLayoutItem, VerticalTextLayoutItem } from '../../src/textLayout';

// A deterministic, font-free measurer: every glyph is `charWidth` wide. This keeps
// the layout math reproducible across machines (no real font metrics involved), so
// these act as golden tests for the wrapping / column / alignment / vertical logic.
function fakeMeasurer(charWidth = 10, ascent = 8, descent = 2): TextLayoutMeasurer {
  return {
    measureText: (text: string) => {
      const width = charWidth * Array.from(text || ' ').length;
      return {
        width,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: width,
        actualBoundingBoxAscent: ascent,
        actualBoundingBoxDescent: descent,
      };
    },
  };
}

function horizontalItems(items: ReturnType<typeof createTextLayout>['items']): HorizontalTextLayoutItem[] {
  return items.filter((item): item is HorizontalTextLayoutItem => item.kind === 'horizontal-line');
}

function verticalItems(items: ReturnType<typeof createTextLayout>['items']): VerticalTextLayoutItem[] {
  return items.filter((item): item is VerticalTextLayoutItem => item.kind === 'vertical-segment');
}

// --- Horizontal layout ---

test('horizontal: single line produces one item at y=0 with measured width', () => {
  const layout = createTextLayout(
    { text: 'abc', writingMode: 'horizontal-tb', fontSize: 20, lineHeight: 1.5, letterSpacing: 0 },
    fakeMeasurer(10),
  );
  assert.equal(layout.writingMode, 'horizontal-tb');
  const items = horizontalItems(layout.items);
  assert.equal(items.length, 1);
  assert.equal(items[0].text, 'abc');
  assert.equal(items[0].y, 0);
  assert.equal(items[0].width, 30);
  assert.equal(layout.height, 30); // lineAdvance = fontSize * lineHeight = 20 * 1.5
  assert.equal(layout.width, 30);
});

test('horizontal: explicit newlines advance y by fontSize * lineHeight', () => {
  const layout = createTextLayout(
    { text: 'ab\ncde', writingMode: 'horizontal-tb', fontSize: 20, lineHeight: 1.5, letterSpacing: 0 },
    fakeMeasurer(10),
  );
  const items = horizontalItems(layout.items);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((i) => i.text), ['ab', 'cde']);
  assert.equal(items[0].y, 0);
  assert.equal(items[1].y, 30);
  assert.equal(layout.height, 60);
  assert.equal(layout.width, 30); // widest line: 'cde' = 30
});

test('horizontal: wrapping breaks a long line at wrapWidth', () => {
  const layout = createTextLayout(
    { text: 'abcdef', writingMode: 'horizontal-tb', fontSize: 20, lineHeight: 1.5, letterSpacing: 0, wrapWidth: 35 },
    fakeMeasurer(10),
  );
  const items = horizontalItems(layout.items);
  // 35px / 10px-per-char => 3 chars per line.
  assert.deepEqual(items.map((i) => i.text), ['abc', 'def']);
  assert.equal(items[1].y, 30);
});

test('horizontal: columns distribute lines and offset x by column width + gap', () => {
  const layout = createTextLayout(
    { text: 'a\nb\nc\nd', writingMode: 'horizontal-tb', fontSize: 20, lineHeight: 1.5, letterSpacing: 0, columns: 2, columnGap: 5 },
    fakeMeasurer(10),
  );
  const items = horizontalItems(layout.items);
  assert.equal(items.length, 4);
  const c = items.find((i) => i.text === 'c');
  const a = items.find((i) => i.text === 'a');
  assert.ok(a && c);
  // First column starts at x=0; second column at columnWidth(10) + gap(5) = 15.
  assert.equal(a!.x, 0);
  assert.equal(c!.x, 15);
  assert.equal(layout.width, 25); // 10 + 10 + 5 gap
});

test('horizontal: center and right alignment shift x within the wrap width', () => {
  const base = { text: 'ab', writingMode: 'horizontal-tb' as const, fontSize: 20, lineHeight: 1.5, letterSpacing: 0, wrapWidth: 100 };
  const left = horizontalItems(createTextLayout({ ...base, textAlign: 'left' }, fakeMeasurer(10)).items)[0];
  const center = horizontalItems(createTextLayout({ ...base, textAlign: 'center' }, fakeMeasurer(10)).items)[0];
  const right = horizontalItems(createTextLayout({ ...base, textAlign: 'right' }, fakeMeasurer(10)).items)[0];
  // 'ab' visual width = 20 within a 100-wide column.
  assert.equal(left.x, 0);
  assert.equal(center.x, 40); // (100 - 20) / 2
  assert.equal(right.x, 80); // 100 - 20
});

test('horizontal: letterSpacing widens the measured line width', () => {
  const noSpacing = createTextLayout(
    { text: 'abc', writingMode: 'horizontal-tb', fontSize: 20, lineHeight: 1.5, letterSpacing: 0 },
    fakeMeasurer(10),
  );
  const spaced = createTextLayout(
    { text: 'abc', writingMode: 'horizontal-tb', fontSize: 20, lineHeight: 1.5, letterSpacing: 5 },
    fakeMeasurer(10),
  );
  assert.equal(horizontalItems(noSpacing.items)[0].width, 30);
  // 3 glyphs (30) + 2 inter-glyph gaps (10) = 40.
  assert.equal(horizontalItems(spaced.items)[0].width, 40);
});

// --- Vertical layout ---

test('vertical-rl: latin runs become sideways segments, CJK glyphs stay upright', () => {
  const layout = createTextLayout(
    { text: '春A夏', writingMode: 'vertical-rl', fontSize: 20, lineHeight: 1.5, letterSpacing: 0 },
    fakeMeasurer(10),
  );
  assert.equal(layout.writingMode, 'vertical-rl');
  const items = verticalItems(layout.items);
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((i) => i.text), ['春', 'A', '夏']);
  assert.equal(items[0].sideways, false);
  assert.equal(items[1].sideways, true); // Latin 'A' is rotated into a horizontal run.
  assert.equal(items[2].sideways, false);
});

test('vertical-rl: a single line splits across columns when columns > 1', () => {
  const layout = createTextLayout(
    { text: '一二三四', writingMode: 'vertical-rl', fontSize: 20, lineHeight: 1.5, letterSpacing: 0, columns: 2 },
    fakeMeasurer(10),
  );
  const items = verticalItems(layout.items);
  assert.equal(items.length, 4);
  // Right-to-left: the first column sits at a larger x than the second.
  const xs = items.map((i) => i.x);
  assert.ok(Math.max(...xs) > Math.min(...xs), 'columns should occupy distinct x positions');
});
