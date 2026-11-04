import assert from 'node:assert/strict';
import test from 'node:test';
import { editorTemplates } from '../../src/templates';

test('photo presets all have existing brightness adjustment and enabled text shadows', () => {
  const photos = editorTemplates.filter((template) => template.seriesKey === 'templateSeriesPhoto');
  assert.deepEqual(photos.map((template) => template.id), [
    'mountain-mist-photo', 'ocean-dawn-photo', 'city-night-photo', 'ink-pine-mist-photo',
  ]);
  for (const item of photos) {
    assert.equal(item.background.backgroundType, 'image');
    assert.ok(item.background.backgroundImage);
    assert.ok(item.background.bgBrightness < 100, item.id);
    assert.ok(item.typography.textShadowEnabled, item.id);
    assert.ok(item.typography.textShadowBlur >= 8, item.id);
  }
});
