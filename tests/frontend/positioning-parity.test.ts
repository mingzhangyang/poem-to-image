import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCanvasPositioningRect,
  getCanvasTextOrigin,
  getKeyboardDragBounds,
  getPreviewDragBounds,
  getPreviewPositioningRect,
  isArrowDirection,
  measurePreviewElement,
  movePreviewPosition,
  nudgePreviewPosition,
  positionToCanvasPoint,
  resizePreviewTextBox,
  resizePreviewTextBoxByKeyboard,
} from '../../src/positioningRect';

test('drag limits account for the measured overlay box on both axes', () => {
  const frame = { left: 0, top: 0, width: 1000, height: 500 };
  const bounds = getPreviewDragBounds(frame, { width: 200, height: 100 });
  assert.deepEqual(bounds, {
    minPositionX: 10, maxPositionX: 90,
    minPositionY: 10, maxPositionY: 90,
  });
  assert.deepEqual(movePreviewPosition({ positionX: 50, positionY: 50 },
    { x: 100, y: 50 }, frame, bounds), { positionX: 60, positionY: 60 });
  assert.deepEqual(movePreviewPosition({ positionX: 89, positionY: 11 },
    { x: 9999, y: -9999 }, frame, bounds), { positionX: 90, positionY: 10 });
});

test('drag math is stable across browser zoom and preview scale', () => {
  const original = { left: 40, top: 70, width: 1000, height: 600 };
  const scaled = { left: 40, top: 70, width: 250, height: 150 };
  const a = movePreviewPosition({ positionX: 50, positionY: 40 }, { x: 150, y: -60 },
    original, getPreviewDragBounds(original, { width: 100, height: 60 }));
  const b = movePreviewPosition({ positionX: 50, positionY: 40 }, { x: 37.5, y: -15 },
    scaled, getPreviewDragBounds(scaled, { width: 25, height: 15 }));
  assert.deepEqual(a, b);
});

test('keyboard movement and clamping use the same bounds as dragging', () => {
  const frame = { left: 0, top: 0, width: 100, height: 200 };
  const bounds = getKeyboardDragBounds(frame, { width: 40, height: 40 });
  assert.deepEqual(nudgePreviewPosition({ positionX: 79, positionY: 90 }, 'ArrowRight', true, bounds),
    { positionX: 80, positionY: 90 });
  assert.deepEqual(nudgePreviewPosition({ positionX: 50, positionY: 50 }, 'ArrowLeft', false, bounds),
    { positionX: 49, positionY: 50 });
  assert.deepEqual(nudgePreviewPosition({ positionX: 50, positionY: 50 }, 'ArrowDown', true, bounds),
    { positionX: 50, positionY: 53 });
  assert.deepEqual(getKeyboardDragBounds(null, null), {
    minPositionX: 0, maxPositionX: 100,
    minPositionY: 0, maxPositionY: 100,
  });
  assert.equal(isArrowDirection('ArrowLeft'), true);
  assert.equal(isArrowDirection('Enter'), false);
});

test('resize math shares the same center/width rule for poem and custom text', () => {
  const frame = { left: 10, top: 20, width: 600, height: 900 };
  const box = { left: 210, right: 410 };
  assert.deepEqual(resizePreviewTextBox('left', frame, box, 50), {
    positionX: (325 / 600) * 100,
    boxWidth: 25,
  });
  assert.deepEqual(resizePreviewTextBox('right', frame, box, -50), {
    positionX: (275 / 600) * 100,
    boxWidth: 25,
  });
  assert.equal(resizePreviewTextBoxByKeyboard(50, 240, 600, 'ArrowRight'), 52);
  assert.equal(resizePreviewTextBoxByKeyboard(undefined, 240, 600, 'ArrowLeft'), 38);
  assert.equal(resizePreviewTextBoxByKeyboard(100, 240, 600, 'ArrowRight'), 100);
});

test('preview box readback maps to Canvas top-left without accumulating drift', () => {
  const frame = { left: 100, top: 50, width: 800, height: 1000 };
  const box = { left: 360, right: 520, top: 380, bottom: 520 };
  const position = measurePreviewElement(frame, box);
  assert.deepEqual(position, {
    positionX: 42.5,
    positionY: 40,
    exportLeft: 32.5,
    exportTop: 33,
  });
  const canvas = { x: 64, y: 80, width: 1600, height: 2000 };
  const actual = getCanvasTextOrigin(canvas, position, { width: 320, height: 280 });
  assert.deepEqual(actual, { x: 584, y: 740 });
  // Clearing obsolete left/top overrides after arrow-key movement returns
  // Canvas positioning to the canonical percentage center.
  const moved = { ...position, positionX: position.positionX + 1,
    exportLeft: undefined, exportTop: undefined };
  assert.deepEqual(getCanvasTextOrigin(canvas, moved, { width: 320, height: 280 }),
    { x: 64 + 1600 * 0.435 - 160, y: 80 + 2000 * 0.4 - 140 });
});

test('all Canvas overlay centers share one positioning transform', () => {
  const padded = { x: 64, y: 80, width: 600, height: 800 };
  const inset = getCanvasPositioningRect(padded, true, 'solid', 8);
  assert.deepEqual(inset, { x: 72, y: 88, width: 584, height: 784 });
  assert.deepEqual(positionToCanvasPoint(inset, { positionX: 25, positionY: 75 }), {
    x: 218,
    y: 676,
  });
  assert.deepEqual(getCanvasPositioningRect(padded, false, 'solid', 8), padded);
  assert.deepEqual(getCanvasPositioningRect(padded, true, 'shadow', 8), padded);
});

test('browser preview rect subtracts scale-adjusted borders, not unscaled CSS pixels', () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { getComputedStyle: () => ({
      borderLeftWidth: '4px', borderRightWidth: '4px',
      borderTopWidth: '5px', borderBottomWidth: '5px',
    }) },
  });
  try {
    const element = {
      offsetWidth: 200, offsetHeight: 300,
      getBoundingClientRect: () => ({
        left: 100, top: 90, width: 100, height: 150,
      }),
    } as unknown as HTMLElement;
    assert.deepEqual(getPreviewPositioningRect(element), {
      left: 102, top: 92.5,
      width: 96, height: 145,
    });
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
