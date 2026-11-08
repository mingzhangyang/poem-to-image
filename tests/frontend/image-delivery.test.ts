import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canShareImageFile, createImageFile, imageDeliveryFormat, isAppleMobileDevice,
} from '../../src/sharing/imageDelivery';

test('iOS / iPadOS detection is narrow and desktop Mac stays a desktop', () => {
  assert.equal(isAppleMobileDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', platform: 'iPhone', maxTouchPoints: 5 }), true);
  assert.equal(isAppleMobileDevice({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0)', platform: 'iPad', maxTouchPoints: 5 }), true);
  assert.equal(isAppleMobileDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(isAppleMobileDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 }), false);
  assert.equal(isAppleMobileDevice({ userAgent: 'Mozilla/5.0 (Android)', platform: 'Linux armv8l', maxTouchPoints: 5 }), false);
});

test('Photos prefers PNG instead of WebP, but file downloads keep their format', () => {
  assert.equal(imageDeliveryFormat('webp', 'photos'), 'png');
  assert.equal(imageDeliveryFormat('png', 'photos'), 'png');
  assert.equal(imageDeliveryFormat('jpg', 'photos'), 'jpg');
  assert.equal(imageDeliveryFormat('webp', 'share'), 'webp');
});

test('actual Blob MIME decides filename and File MIME (not the requested encoder)', () => {
  const png = createImageFile(new Blob(['a'], { type: 'image/png' }), 'My poem', new Date('2026-11-08T12:00:00Z'));
  assert.equal(png.type, 'image/png');
  assert.match(png.name, /\.png$/);
  const jpeg = createImageFile(new Blob(['b'], { type: 'image/jpeg' }), 'My poem', new Date('2026-11-08T12:00:00Z'));
  assert.equal(jpeg.type, 'image/jpeg');
  assert.match(jpeg.name, /\.jpg$/);
  assert.throws(() => createImageFile(new Blob(['c'], { type: 'application/octet-stream' }), 'My poem'));
});

test('file sharing needs canShare with the real file, not just a text or URL share API', () => {
  const file = new File(['a'], 'image.png', { type: 'image/png' });
  let received: ShareData | null = null;
  const share = async () => {};
  assert.equal(canShareImageFile(file, { share }), false);
  assert.equal(canShareImageFile(file, { share, canShare: () => false }), false);
  assert.equal(canShareImageFile(file, { share, canShare: (data) => {
    received = data;
    return true;
  } }), true);
  assert.deepEqual((received as ShareData | null)?.files?.[0], file);
  assert.equal(canShareImageFile(file, { share, canShare: () => { throw new Error('Denied'); } }), false);
});
