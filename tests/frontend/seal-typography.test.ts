import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fitTraditionalStampGlyph,
  getStampPresetUpdates,
  getStampVisualMode,
  getTraditionalStampLayout,
  isSealScriptFont,
  isTraditionalStamp,
  SEAL_FONT_FAMILY,
  SEAL_FONT_STACK,
  SEAL_PRESET_IDS,
  SMALL_SEAL_FONT_STACK,
} from '../../src/sealTypography';
import { getStampShadow } from '../../src/stampRendering';
import { getLXGWUnlistedCharacters, LXGW_DOCUMENTED_CODEPOINTS } from '../../src/lxgwSealCoverage';
import type { StampConfig } from '../../src/types';

const legacy: StampConfig = {
  text: '山水', style: 'square', colorScheme: 'filled', inkColor: '#c82829',
  weathering: 50, positionX: 73, positionY: 81, size: 120,
  rotation: -8, opacity: .83, fontFamily: '"Ma Shan Zheng", cursive',
};

test('old seals remain legacy with every existing parameter unchanged', () => {
  assert.equal(getStampVisualMode(legacy), 'legacy');
  assert.equal(isTraditionalStamp(legacy), false);
  assert.equal(isTraditionalStamp({ ...legacy, mode: 'modern' }), false);
  assert.equal(getStampShadow(legacy).color, getStampShadow({ ...legacy, mode: 'modern' }).color);
});

test('four curated presets preserve text, position, size, alpha and other state', () => {
  assert.equal(SEAL_PRESET_IDS.length, 4);
  for (const id of SEAL_PRESET_IDS) {
    const original = structuredClone(legacy);
    const updates = getStampPresetUpdates(id);
    const result = { ...legacy, ...updates };
    assert.equal(result.text, '山水');
    assert.equal(result.size, 120);
    assert.equal(result.positionX, 73);
    assert.equal(result.positionY, 81);
    assert.equal(result.opacity, .83);
    assert.deepEqual(legacy, original);
    assert.ok(result.mode);
  }
  assert.equal(getStampPresetUpdates('vermillion-name').mode, 'zhuwen');
  assert.equal(getStampPresetUpdates('white-name').mode, 'baiwen');
  assert.equal(getStampPresetUpdates('modern-calligraphy').mode, 'modern');
  assert.equal(getStampPresetUpdates('literati').style, 'brush');
});

test('traditional layouts use right-to-left columns with top-to-bottom glyph order', () => {
  for (const count of [1, 2, 3, 4]) {
    const chars = '山水天地'.slice(0, count);
    const layout = getTraditionalStampLayout({ text: chars, size: 120 });
    assert.equal(layout.slots.length, count);
    assert.deepEqual(layout.slots.map((slot) => slot.character), Array.from(chars));
    for (const slot of layout.slots) {
      assert.ok(slot.fontSize > 0 && slot.width > 0 && slot.height > 0);
      assert.ok(Math.abs(slot.x) + slot.width / 2 < 120 / 2);
      assert.ok(Math.abs(slot.y) + slot.height / 2 < 120 / 2);
    }
    if (count === 1) {
      assert.equal(layout.slots[0].x, 0);
    } else if (count === 2) {
      assert.ok(layout.slots[0].x > layout.slots[1].x);
      assert.equal(layout.slots[0].y, 0);
      assert.equal(layout.slots[1].y, 0);
    } else if (count === 3) {
      assert.ok(layout.slots[0].x > layout.slots[2].x);
      assert.ok(layout.slots[0].y < layout.slots[1].y);
      assert.equal(layout.slots[2].y, 0);
    } else {
      assert.ok(layout.slots[0].x > layout.slots[2].x);
      assert.ok(layout.slots[0].y < layout.slots[1].y);
      assert.ok(layout.slots[2].y < layout.slots[3].y);
    }
  }
});

test('traditional layout respects complete Unicode grapheme glyphs and size scaling', () => {
  const initial = getTraditionalStampLayout({ text: '𠮷\u0301印記詩畫', size: 100 });
  assert.deepEqual(initial.slots.map((slot) => slot.character), ['𠮷\u0301', '印', '記', '詩', '畫']);
  const double = getTraditionalStampLayout({ text: '𠮷\u0301印記詩畫', size: 200 });
  for (let index = 0; index < 5; index++) {
    const a = initial.slots[index];
    const b = double.slots[index];
    assert.equal(b.x, a.x * 2);
    assert.equal(b.y, a.y * 2);
    assert.equal(b.fontSize, a.fontSize * 2);
  }
  assert.equal(getTraditionalStampLayout({ text: '', size: 100 }).slots[0].character, '印');
});

test('optical glyph fit preserves aspect ratio and corrects asymmetric bearings', () => {
  const correction = fitTraditionalStampGlyph(
    { width: 40, height: 50 },
    { actualBoundingBoxLeft: 5, actualBoundingBoxRight: 35, actualBoundingBoxAscent: 40, actualBoundingBoxDescent: 10 },
  );
  assert.ok(correction.scale > 0 && correction.scale <= 1);
  assert.equal(correction.offsetX, -15);
  assert.equal(correction.offsetY, 15);
  assert.ok(correction.scale * 40 <= 40 * .88);
  assert.ok(correction.scale * 50 <= 50 * .88);
});

test('four square-bounded glyphs fit the actual circular seal clip at all sizes', () => {
  for (const size of [0.5, 1, 2, 10, 100, 300]) {
    const layout = getTraditionalStampLayout({ text: '山水天地', size });
    const clipRadius = size / 2 - layout.borderWidth * 0.75;
    const safeRadius = clipRadius - size * 0.015;
    for (const slot of layout.slots) {
      const bounds = {
        actualBoundingBoxLeft: slot.fontSize / 2,
        actualBoundingBoxRight: slot.fontSize / 2,
        actualBoundingBoxAscent: slot.fontSize / 2,
        actualBoundingBoxDescent: slot.fontSize / 2,
      };
      const fit = fitTraditionalStampGlyph(slot, bounds, {
        x: slot.x, y: slot.y, radius: safeRadius,
      });
      const measuredSide = Math.max(1, slot.fontSize);
      const farthestCorner = Math.hypot(
        Math.abs(slot.x) + measuredSide * fit.scale / 2,
        Math.abs(slot.y) + measuredSide * fit.scale / 2,
      );
      assert.ok(fit.scale > 0, `round seal ${size}px must still render ink`);
      assert.ok(farthestCorner <= safeRadius + 1e-9,
        `round seal ${size}px: ink corner ${farthestCorner} exceeds radius ${safeRadius}`);
      // Fitting the same square glyph into a square seal must remain unchanged.
      const squareFit = fitTraditionalStampGlyph(slot, bounds);
      assert.ok(fit.scale <= squareFit.scale);
    }
  }
});

test('explicit modes control shadow ink mass independently of old colorScheme field', () => {
  const red = getStampShadow({ ...legacy, mode: 'zhuwen', colorScheme: 'filled' });
  const white = getStampShadow({ ...legacy, mode: 'baiwen', colorScheme: 'outline' });
  assert.equal(red.color, '#c828291f');
  assert.equal(white.color, '#c8282938');
});

test('real seal fonts have distinct, pinned, documented family stacks', () => {
  assert.ok(SEAL_FONT_STACK.includes(SEAL_FONT_FAMILY));
  assert.ok(isSealScriptFont(SEAL_FONT_STACK));
  assert.ok(isSealScriptFont(SMALL_SEAL_FONT_STACK));
  assert.equal(isSealScriptFont(legacy.fontFamily), false);
});


test('tiny restored traditional seals keep safe inset borders', () => {
  for (const size of [0.5, 1, 2, 3, 180]) {
    const layout = getTraditionalStampLayout({ size, text: '印' });
    assert.ok(layout.borderWidth > 0);
    assert.ok(layout.borderWidth * .75 < size / 2);
  }
});

test('published LXGW seal coverage helps flag unlisted characters without blocking drafts', () => {
  // Deterministically regenerated from the 165-row pinned upstream table.
  assert.equal(LXGW_DOCUMENTED_CODEPOINTS.size, 377);
  assert.deepEqual(getLXGWUnlistedCharacters('春水'), []);
  // Each alias is checked separately: the stamp model displays at most 8 glyphs.
  for (const character of Array.from('萅秊咊䢉夓㞢䔢花秌淸䨮㢴戼')) {
    assert.deepEqual(getLXGWUnlistedCharacters(character), [], character);
  }
  // 谷 is explicitly struck out, and 王 is parenthesized as a reference.
  assert.deepEqual(getLXGWUnlistedCharacters('谷王'), ['谷', '王']);
  assert.deepEqual(getLXGWUnlistedCharacters('𠮷春'), ['𠮷']);
  assert.deepEqual(getLXGWUnlistedCharacters(''), []);
});

test('larger and bolder glyphs fit square and round seals safely', () => {
  const slot = { width: 50, height: 50 };
  const bounds = {
    actualBoundingBoxLeft: 25, actualBoundingBoxRight: 25,
    actualBoundingBoxAscent: 25, actualBoundingBoxDescent: 25,
  };
  const original = fitTraditionalStampGlyph(slot, bounds);
  const enlarged = fitTraditionalStampGlyph(slot, bounds, undefined, 1.1);
  const thicker = fitTraditionalStampGlyph(slot, bounds, undefined, 1.1, 3);
  assert.ok(enlarged.scale > original.scale);
  assert.ok(thicker.scale < enlarged.scale);
  const round = fitTraditionalStampGlyph(slot, bounds, { x: 6, y: 0, radius: 42 }, 1.1, 3);
  const outer = (50 * round.scale + 3) / 2;
  assert.ok(Math.hypot(6 + outer, outer) <= 42 + 1e-9);
  assert.equal(fitTraditionalStampGlyph(slot, bounds).scale, original.scale);
});

test('fixed logical stroke thickness fits outer ink in square and round seals at every glyph size', () => {
  const slot = { width: 50, height: 50 };
  const bounds = {
    actualBoundingBoxLeft: 25, actualBoundingBoxRight: 25,
    actualBoundingBoxAscent: 25, actualBoundingBoxDescent: 25,
  };
  for (const textScale of [0.7, 1, 1.1]) {
    for (const strokeWidth of [0, 2, 4]) {
      const square = fitTraditionalStampGlyph(slot, bounds, undefined, textScale, strokeWidth);
      const outerSide = 50 * square.scale + strokeWidth;
      assert.ok(square.scale > 0);
      assert.ok(outerSide <= 50 * 0.88 * textScale + 1e-9,
        'square glyph including unscaled stroke must fit the requested area');

      const round = fitTraditionalStampGlyph(slot, bounds,
        { x: 6, y: 0, radius: 42 }, textScale, strokeWidth);
      const halfOuter = (50 * round.scale + strokeWidth) / 2;
      assert.ok(Math.hypot(6 + halfOuter, halfOuter) <= 42 + 1e-9,
        'circular clip must contain the post-transform stroke at every text size');
    }
  }
  assert.equal(fitTraditionalStampGlyph({ width: 4, height: 4 }, bounds, undefined, 1, 10).scale, 0,
    'a stroke thicker than the cell must never produce a negative glyph scale');
});
