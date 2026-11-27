import assert from 'node:assert/strict';
import { test } from 'node:test';
import manifest from '../../src/ornaments/manifest.json';
import { getOrnamentContentBox, getOrnamentContentExtents } from '../../src/ornaments/contentBox';
import { measureOrnamentContent } from '../../scripts/ornament-content-bounds.mjs';

test('every manifest content box matches the visible pixels of its image', async () => {
  for (const item of manifest) {
    assert.deepEqual(item.content, await measureOrnamentContent(item.file),
      `${item.id}: run \`node scripts/ornament-content-bounds.mjs\` after changing its image`);
  }
});

test('content boxes trim the transparent margin around banded ornaments', () => {
  const [, top, , bottom] = getOrnamentContentBox('greek-meander');
  assert.ok(bottom - top < 0.25, 'the meander band fills well under a quarter of its square');
});

test('flipping mirrors the content box and unknown ornaments use the whole box', () => {
  assert.deepEqual(getOrnamentContentBox('unknown-ornament'), [0, 0, 1, 1]);
  assert.deepEqual(getOrnamentContentBox(undefined, true), [0, 0, 1, 1]);
  const [left, top, right, bottom] = getOrnamentContentBox('crane');
  assert.deepEqual(getOrnamentContentBox('crane', true), [1 - right, top, 1 - left, bottom]);
});

test('content extents follow rotation about the image centre', () => {
  const box = [0.1, 0.4, 0.7, 0.6] as const;
  const close = (actual: Record<string, number>, expected: Record<string, number>) => {
    for (const key of Object.keys(expected)) assert.ok(Math.abs(actual[key] - expected[key]) < 1e-9, `${key}: ${actual[key]}`);
  };
  close(getOrnamentContentExtents(box, 100, 0), { left: 40, right: 20, top: 10, bottom: 10 });
  // A quarter turn clockwise (screen coordinates) sends the right edge down.
  close(getOrnamentContentExtents(box, 100, 90), { left: 10, right: 10, top: 40, bottom: 20 });
});
