import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getOrnamentContentBox } from '../../src/ornaments/contentBox';
import { getDuplicatePosition, getOrnamentAnchorPosition, getOrnamentPositionBounds } from '../../src/ornaments/placement';
import type { PlacementArea } from '../../src/types';

// A 1080 × 1350 canvas with 64 px padding and no border.
const area: PlacementArea = { left: 64, top: 64, width: 952, height: 1222, canvasWidth: 1080, canvasHeight: 1350 };
const moon = { ornamentId: 'full-moon', size: 100, rotation: 0 };
const [moonLeft, moonTop, moonRight, moonBottom] = getOrnamentContentBox('full-moon');
const toCanvasX = (positionX: number) => area.left + area.width * positionX / 100;
const toCanvasY = (positionY: number) => area.top + area.height * positionY / 100;
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≉ ${expected}`);

test('position bounds let the visible ink reach every canvas edge through the padding', () => {
  const bounds = getOrnamentPositionBounds(area, moon);
  near(toCanvasX(bounds.minPositionX) + (moonLeft - 0.5) * 100, 0);
  near(toCanvasX(bounds.maxPositionX) + (moonRight - 0.5) * 100, 1080);
  near(toCanvasY(bounds.minPositionY) + (moonTop - 0.5) * 100, 0);
  near(toCanvasY(bounds.maxPositionY) + (moonBottom - 0.5) * 100, 1350);
  assert.ok(bounds.minPositionX < 0 && bounds.maxPositionX > 100);
});

test('anchors place the visible ink 3% inside the canvas edge', () => {
  const topLeft = getOrnamentAnchorPosition(area, 'tl', moon);
  near(toCanvasX(topLeft.positionX) + (moonLeft - 0.5) * 100, 1080 * 0.03);
  near(toCanvasY(topLeft.positionY) + (moonTop - 0.5) * 100, 1350 * 0.03);
  const bottomRight = getOrnamentAnchorPosition(area, 'br', moon);
  near(toCanvasX(bottomRight.positionX) + (moonRight - 0.5) * 100, 1080 * 0.97);
  near(toCanvasY(bottomRight.positionY) + (moonBottom - 0.5) * 100, 1350 * 0.97);
});

test('a duplicate is offset to the right while there is room', () => {
  const copy = getDuplicatePosition(area, { ...moon, positionX: 50, positionY: 40 });
  assert.deepEqual(copy, { positionX: 52, positionY: 40 });
});

test('a duplicate of an ornament at the right canvas edge is offset inward, not pulled into the text frame', () => {
  const { maxPositionX } = getOrnamentPositionBounds(area, moon);
  assert.ok(maxPositionX > 100, 'the ornament sits in the right padding');
  const copy = getDuplicatePosition(area, { ...moon, positionX: maxPositionX, positionY: 40 });
  near(copy.positionX, maxPositionX - 2);
  assert.equal(copy.positionY, 40);
});
