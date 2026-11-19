import assert from 'node:assert/strict';
import test from 'node:test';
import { inferBackgroundImageSource, migrateLegacyTemplateBackground } from '../../src/backgroundImageSource';

test('legacy built-in template image is not classified as an upload', () => {
  assert.equal(inferBackgroundImageSource('/template-backgrounds/parchment-scroll-generated.png'), 'template');
  assert.equal(inferBackgroundImageSource('/template-backgrounds/parchment-scroll-generated.webp'), 'template');
});

test('legacy uploaded image and missing image have truthful sources', () => {
  assert.equal(inferBackgroundImageSource('blob:https://inkpoem.com/123'), 'upload');
  assert.equal(inferBackgroundImageSource(null), null);
});

test('legacy PNG template backgrounds resolve to their WebP replacements', () => {
  assert.equal(
    migrateLegacyTemplateBackground('/template-backgrounds/ink-pine-mist-generated.png'),
    '/template-backgrounds/ink-pine-mist-generated.webp',
  );
  assert.equal(
    migrateLegacyTemplateBackground('/template-backgrounds/bamboo-scroll-generated.png'),
    '/template-backgrounds/bamboo-scroll-generated.webp',
  );
  assert.equal(migrateLegacyTemplateBackground('/template-backgrounds/peach-blossom.webp'), '/template-backgrounds/peach-blossom.webp');
  assert.equal(migrateLegacyTemplateBackground('/template-backgrounds/unknown.png'), '/template-backgrounds/unknown.png');
  assert.equal(migrateLegacyTemplateBackground('blob:https://inkpoem.com/123'), 'blob:https://inkpoem.com/123');
  assert.equal(migrateLegacyTemplateBackground(null), null);
});
