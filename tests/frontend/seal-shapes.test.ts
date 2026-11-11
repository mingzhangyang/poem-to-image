import assert from 'node:assert/strict';
import test from 'node:test';
import { getNaturalSealEdgePoint } from '../../src/naturalSealTexture';
import {
  getStampDimensions, getStampPreviewRasterDimensions,
  getStampRasterDimensions, getStampShapeRatio, getStampTextPlacements,
} from '../../src/stampRendering';
import { fitTraditionalStampGlyph, getTraditionalStampLayout } from '../../src/sealTypography';
import type { StampStyle } from '../../src/types';

test('new shapes use bounded short-to-long ratios without modifying old squares', () => {
  for (const style of ['square', 'round', 'brush'] as StampStyle[]) {
    assert.deepEqual(getStampDimensions({ size: 120, style, shapeRatio: 0.45 }),
      { width: 120, height: 120 });
  }
  assert.deepEqual(getStampDimensions({ size: 120, style: 'rect-vertical', shapeRatio: 0.6 }),
    { width: 72, height: 120 });
  assert.deepEqual(getStampDimensions({ size: 120, style: 'rect-horizontal', shapeRatio: 0.6 }),
    { width: 120, height: 72 });
  assert.deepEqual(getStampDimensions({ size: 120, style: 'oval', shapeRatio: 0.6 }),
    { width: 72, height: 120 });
  assert.equal(getStampShapeRatio({ shapeRatio: Number.NaN }), 0.68);
  assert.equal(getStampShapeRatio({ shapeRatio: 0 }), 0.45);
  assert.equal(getStampShapeRatio({ shapeRatio: 99 }), 0.9);
});

test('bitmap caps apply to both dimensions with shared preview/export scale', () => {
  const preview = getStampPreviewRasterDimensions(
    { style: 'rect-vertical', size: 100, shapeRatio: 0.6 }, 1, 3);
  assert.deepEqual(preview, { widthPixels: 396, heightPixels: 516, scale: 3 });
  const giant = getStampRasterDimensions(6000, 10000, 3);
  assert.equal(giant.heightPixels, 2048);
  assert.ok(giant.widthPixels <= 2048 && giant.widthPixels > 0);
  assert.equal(giant.scale, 2048 / 10000);
  const square = getStampRasterDimensions(100, 100, 2);
  assert.deepEqual(square, { widthPixels: 200, heightPixels: 200, scale: 2 });
});

test('1–8 glyphs fit elongated face slots with ordered reading and no overlapping cells', () => {
  for (const style of ['square', 'rect-vertical', 'rect-horizontal', 'oval'] as StampStyle[]) {
    for (let count = 1; count <= 8; count++) {
      const stamp = { style, size: 160, shapeRatio: 0.6, text: '春夏秋冬山水天地'.slice(0, count) };
      const { width, height } = getStampDimensions(stamp);
      const { slots } = getTraditionalStampLayout(stamp);
      assert.equal(slots.length, count, style + ':' + count);
      assert.deepEqual(slots.map((slot) => slot.character), Array.from(stamp.text));
      for (const slot of slots) {
        assert.ok(slot.width > 0 && slot.height > 0 && slot.fontSize > 0);
        assert.ok(Math.abs(slot.x) + slot.width / 2 <= width / 2, style + ':x');
        assert.ok(Math.abs(slot.y) + slot.height / 2 <= height / 2, style + ':y');
      }
      for (let left = 0; left < slots.length; left++) {
        for (let right = left + 1; right < slots.length; right++) {
          const a = slots[left], b = slots[right];
          const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 1e-8;
          const overlapY = Math.abs(a.y - b.y) < (a.height + b.height) / 2 - 1e-8;
          assert.ok(!(overlapX && overlapY), style + ': overlapping slots for ' + count);
        }
      }
    }
  }
  const tall = getTraditionalStampLayout({
    style: 'rect-vertical', size: 150, shapeRatio: 0.65, text: '书画之印',
  });
  assert.equal(new Set(tall.slots.map((slot) => slot.x)).size, 1);
  assert.ok(tall.slots.every((slot, i) => i === 0 || slot.y > tall.slots[i - 1].y));
  const wide = getTraditionalStampLayout({
    style: 'rect-horizontal', size: 150, shapeRatio: 0.65, text: '山水天地',
  });
  assert.ok(wide.slots.every((slot, i) => i === 0 || slot.x < wide.slots[i - 1].x));
});

test('outer glyph ink fits an elliptical clip without anisotropic distortion', () => {
  const clip = { x: 3, y: -15, radiusX: 45, radiusY: 70 };
  const bounds = {
    actualBoundingBoxLeft: 15, actualBoundingBoxRight: 15,
    actualBoundingBoxAscent: 20, actualBoundingBoxDescent: 20,
  };
  const fit = fitTraditionalStampGlyph({ width: 36, height: 48 }, bounds, clip, 1.1, 2);
  const x = Math.abs(clip.x) + (30 * fit.scale + 2) / 2;
  const y = Math.abs(clip.y) + (40 * fit.scale + 2) / 2;
  assert.ok(fit.scale > 0 && fit.scale <= 1.1);
  assert.ok((x / clip.radiusX) ** 2 + (y / clip.radiusY) ** 2 <= 1 + 1e-9);
});

test('natural edge samples track elongated outlines and never escape the face', () => {
  for (const style of ['rect-vertical', 'rect-horizontal', 'oval'] as StampStyle[]) {
    for (const fraction of [0, 0.02, 0.125, 0.249, 0.5, 0.75, 0.999]) {
      const [x, y] = getNaturalSealEdgePoint(style, fraction, 0.01, 0.6);
      assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, style + ':' + fraction);
      if (style === 'oval') {
        const { width, height } = getStampDimensions({ style, size: 1, shapeRatio: 0.6 });
        const r = Math.min(width, height) * 0.01;
        assert.ok(Math.abs((((x - 0.5) * width) / (width / 2 - r)) ** 2
          + (((y - 0.5) * height) / (height / 2 - r)) ** 2 - 1) < 1e-9);
      }
    }
  }
  // Existing 1–4 character modern placements remain stable.
  assert.deepEqual(getStampTextPlacements(100, 2), [
    { x: 25, y: 2 }, { x: -25, y: 2 },
  ]);
  assert.equal(getStampTextPlacements(100, 8).length, 8);
});
