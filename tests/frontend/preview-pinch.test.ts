import test from 'node:test';
import assert from 'node:assert/strict';
import { previewPinchZoom, previewPointerDistance } from '../../src/components/preview/previewPinch';
import { createPreviewInteractionRegistry } from '../../src/components/preview/previewInteraction';

test('pinch zoom clamps valid movement and rejects invalid baselines', () => {
  assert.equal(previewPointerDistance({ x: 5, y: 9 }, { x: 5, y: 9 }), null);
  assert.equal(previewPointerDistance({ x: NaN, y: 9 }, { x: 5, y: 9 }), null);
  assert.equal(previewPointerDistance({ x: 0, y: 0 }, { x: 30, y: 40 }), 50);
  assert.equal(previewPinchZoom({ distance: 50, zoom: 1 }, 75, 0.7, 2), 1.5);
  assert.equal(previewPinchZoom({ distance: 50, zoom: 1 }, 500, 0.7, 2), 2);
  assert.equal(previewPinchZoom({ distance: 50, zoom: 1 }, 1, 0.7, 2), 0.7);
  assert.equal(previewPinchZoom({ distance: 0, zoom: 1 }, 0, 0.7, 2), null);
  assert.equal(previewPinchZoom({ distance: 50, zoom: NaN }, 50, 0.7, 2), null);
  assert.equal(previewPinchZoom({ distance: 50, zoom: 1 }, Infinity, 0.7, 2), null);
});

test('pinch cancellation ends each registered overlay interaction exactly once', () => {
  const registry = createPreviewInteractionRegistry();
  const calls: string[] = [];
  let removeFirst = () => {};
  removeFirst = registry.register(() => { calls.push('first'); removeFirst(); });
  const removeSecond = registry.register(() => { calls.push('second'); removeSecond(); });
  const removeFinished = registry.register(() => calls.push('finished'));
  removeFinished();
  registry.cancelAll();
  registry.cancelAll();
  assert.deepEqual(calls, ['first', 'second']);
});
