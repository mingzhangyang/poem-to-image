import assert from 'node:assert/strict';
import { test } from 'node:test';
import manifest from '../../src/ornaments/manifest.json';
import { getOrnamentName, ORNAMENT_CATEGORIES, ORNAMENT_MOODS } from '../../src/ornaments/taxonomy';

test('every manifest category and mood has a gallery filter', () => {
  for (const item of manifest) {
    assert.ok(item.category in ORNAMENT_CATEGORIES, `${item.id}: category ${item.category} is missing from ORNAMENT_CATEGORIES`);
    for (const mood of item.moods) {
      assert.ok(mood in ORNAMENT_MOODS, `${item.id}: mood ${mood} is missing from ORNAMENT_MOODS`);
    }
  }
});

test('ornament names follow the UI language', () => {
  assert.equal(getOrnamentName('plum-branch', 'zh-CN'), '梅花枝');
  assert.equal(getOrnamentName('plum-branch', 'zh-TW'), '梅花枝');
  assert.equal(getOrnamentName('plum-branch', 'en'), 'Plum Branch');
  assert.equal(getOrnamentName('unknown-ornament', 'en'), 'unknown-ornament');
});
