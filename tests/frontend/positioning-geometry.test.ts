import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampToDragBounds,
  didFontReadyChangeTextBox,
  getCanvasPositioningRect,
  getCanvasTextOrigin,
  getKeyboardDragBounds,
  getPreviewDragBounds,
  getPreviewPositioningRect,
  isArrowDirection,
  measurePreviewElement,
  mergePositionUpdate,
  movePreviewPosition,
  nudgePreviewPosition,
  positionToCanvasPoint,
  resizePreviewTextBox,
  resizePreviewTextBoxByKeyboard,
} from '../../src/positioningRect';

test('preview content rectangle scales CSS border widths with the visual transform', () => {
  const g = globalThis as Record<string, unknown>;
  const previousWindow = g.window;
  g.window = {
    getComputedStyle: () => ({
      borderLeftWidth: '4px', borderRightWidth: '6px',
      borderTopWidth: '2px', borderBottomWidth: '8px',
    }),
  };
  try {
    const fakeElement = {
      offsetWidth: 400,
      offsetHeight: 300,
      getBoundingClientRect: () => ({
        left: 100, top: 80, width: 200, height: 150,
      }),
    } as unknown as HTMLElement;
    assert.deepEqual(getPreviewPositioningRect(fakeElement), {
      left: 102,
      top: 81,
      width: 195,
      height: 145,
    });
  } finally {
    if (previousWindow === undefined) delete g.window;
    else g.window = previousWindow;
  }
});

test('drag bounds match measured preview element and cannot exceed canvas extent', () => {
  const frame = { left: 100, top: 60, width: 400, height: 200 };
  const bounds = getPreviewDragBounds(frame, { width: 80, height: 100 });
  assert.deepEqual(bounds, {
    minPositionX: 10, maxPositionX: 90,
    minPositionY: 25, maxPositionY: 75,
  });
  assert.deepEqual(movePreviewPosition({ positionX: 50, positionY: 50 }, { x: 100, y: -200 }, frame, bounds), {
    positionX: 75, positionY: 25,
  });
  assert.deepEqual(clampToDragBounds({ positionX: 999, positionY: -5 }, bounds), {
    positionX: 90, positionY: 25,
  });
  const huge = getPreviewDragBounds(frame, { width: 900, height: 400 });
  assert.equal(huge.minPositionX, 50);
  assert.equal(huge.maxPositionX, 50);
  assert.equal(huge.minPositionY, 50);
  assert.equal(huge.maxPositionY, 50);
});

test('arrow keys and modifier steps have identical bounds for poem and decorations', () => {
  const bounds = getKeyboardDragBounds(null, null);
  assert.deepEqual(bounds, {
    minPositionX: 0, maxPositionX: 100, minPositionY: 0, maxPositionY: 100,
  });
  assert.equal(isArrowDirection('ArrowLeft'), true);
  assert.equal(isArrowDirection('ArrowEnter'), false);
  const start = { positionX: 50, positionY: 50 };
  assert.deepEqual(nudgePreviewPosition(start, 'ArrowLeft', false, bounds), {
    positionX: 49, positionY: 50,
  });
  assert.deepEqual(nudgePreviewPosition(start, 'ArrowUp', true, bounds), {
    positionX: 50, positionY: 47,
  });
  assert.deepEqual(nudgePreviewPosition({ positionX: 99, positionY: 1 }, 'ArrowRight', true, bounds), {
    positionX: 100, positionY: 1,
  });
});

test('preview measured origin maps to exactly the same Canvas pixel origin', () => {
  const previewFrame = { left: 100, top: 80, width: 500, height: 250 };
  const box = { left: 250, right: 350, top: 130, bottom: 180 };
  const pos = measurePreviewElement(previewFrame, box);
  assert.deepEqual(pos, {
    positionX: 40, positionY: 30, exportLeft: 30, exportTop: 20,
  });
  const canvasFrame = { x: 50, y: 25, width: 1000, height: 500 };
  const origin = getCanvasTextOrigin(canvasFrame, pos, { width: 200, height: 100 });
  assert.deepEqual(origin, { x: 350, y: 125 });
  const center = positionToCanvasPoint(canvasFrame, pos);
  assert.deepEqual(center, { x: 450, y: 175 });
  const restoredCenter = getCanvasTextOrigin(
    canvasFrame, { positionX: 40, positionY: 30 }, { width: 200, height: 100 },
  );
  assert.deepEqual(restoredCenter, { x: 350, y: 125 });
});

test('poem and custom text resize use identical pointer and keyboard math', () => {
  const frame = { left: 100, top: 60, width: 600, height: 400 };
  const box = { left: 200, right: 400 };
  assert.deepEqual(resizePreviewTextBox('left', frame, box, 50), {
    positionX: 37.5, boxWidth: 25,
  });
  assert.deepEqual(resizePreviewTextBox('right', frame, box, -500), {
    positionX: (130 / 600) * 100, boxWidth: 10,
  });
  assert.equal(resizePreviewTextBoxByKeyboard(20, 100, 600, 'ArrowRight'), 22);
  assert.equal(resizePreviewTextBoxByKeyboard(undefined, 120, 600, 'ArrowLeft'), 18);
  assert.equal(resizePreviewTextBoxByKeyboard(100, 100, 600, 'ArrowRight'), 100);
});

test('first keyboard resize is independent of preview zoom when boxWidth is unset', () => {
  for (const zoom of [0.7, 1, 2]) {
    // Simulate the values returned by getBoundingClientRect at each zoom.
    const boxWidth = 100 * zoom;
    const frameWidth = 500 * zoom;
    assert.equal(resizePreviewTextBoxByKeyboard(undefined, boxWidth, frameWidth, 'ArrowLeft'), 18);
    assert.equal(resizePreviewTextBoxByKeyboard(undefined, boxWidth, frameWidth, 'ArrowRight'), 22);
    assert.equal(resizePreviewTextBoxByKeyboard(30, boxWidth, frameWidth, 'ArrowLeft'), 28);
    // A full-width poem starts at 100%, independently of magnification.
    assert.equal(resizePreviewTextBoxByKeyboard(undefined, frameWidth, frameWidth, 'ArrowLeft'), 98);
  }
});

test('position and width edits invalidate stale measured export anchors', () => {
  const original = {
    positionX: 42, positionY: 66, boxWidth: 40,
    exportLeft: 20, exportTop: 30,
  };
  assert.deepEqual(mergePositionUpdate(original, { positionX: 43 }), {
    ...original, positionX: 43, exportLeft: undefined, exportTop: undefined,
  });
  assert.deepEqual(mergePositionUpdate(original, { boxWidth: 45 }), {
    ...original, boxWidth: 45, exportLeft: undefined, exportTop: undefined,
  });
  assert.deepEqual(mergePositionUpdate(original, { positionX: 55, exportLeft: 44, exportTop: 33 }), {
    ...original, positionX: 55, exportLeft: 44, exportTop: 33,
  });
  assert.deepEqual(mergePositionUpdate(original, {}), original);
});

test('font-ready reflow clears measured origins only when text dimensions change', () => {
  const before = { revision: 0, width: 240, height: 120 };
  assert.equal(didFontReadyChangeTextBox(before, { revision: 1, width: 240, height: 120 }), false);
  assert.equal(didFontReadyChangeTextBox(before, { revision: 0, width: 250, height: 120 }), false);
  assert.equal(didFontReadyChangeTextBox(before, { revision: 1, width: 250, height: 120 }), true);
  assert.equal(didFontReadyChangeTextBox(before, { revision: 1, width: 240, height: 130 }), true);

  const anchored = { positionX: 44, positionY: 56, exportLeft: 22, exportTop: 18 };
  assert.deepEqual(
    mergePositionUpdate(anchored, { exportLeft: undefined, exportTop: undefined }),
    { ...anchored, exportLeft: undefined, exportTop: undefined },
  );
});

test('inset border positioning uses the same content extent for Canvas export', () => {
  const rect = { x: 64, y: 64, width: 472, height: 672 };
  const inset = getCanvasPositioningRect(rect, true, 'solid', 6);
  assert.deepEqual(inset, { x: 70, y: 70, width: 460, height: 660 });
  const hidden = getCanvasPositioningRect(rect, false, 'solid', 6);
  assert.deepEqual(hidden, rect);
});
