import assert from 'node:assert/strict';
import test from 'node:test';
import { inferBackgroundImageSource } from '../../src/backgroundImageSource';

test('legacy built-in template image is not classified as an upload', () => {
  assert.equal(inferBackgroundImageSource('/template-backgrounds/parchment-scroll-generated.png'), 'template');
});

test('legacy uploaded image and missing image have truthful sources', () => {
  assert.equal(inferBackgroundImageSource('blob:https://inkpoem.com/123'), 'upload');
  assert.equal(inferBackgroundImageSource(null), null);
});
