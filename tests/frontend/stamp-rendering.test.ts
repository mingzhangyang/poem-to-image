import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStampWeatheringRand,
  getStampCharacters,
  getStampRasterMetrics,
  getStampShadow,
  getStampTransform,
  limitStampText,
  STAMP_MAX_CHARACTERS,
} from '../../src/stampRendering';
import type { StampConfig } from '../../src/types';

const stamp: StampConfig = {
  text: '印記',
  style: 'brush',
  colorScheme: 'filled',
  inkColor: '#c82829',
  weathering: 50,
  positionX: 80,
  positionY: 75,
  size: 120,
  rotation: -8,
  opacity: 0.82,
  fontFamily: 'serif',
};

test('seal input counts graphemes instead of UTF-16 code units', () => {
  assert.equal(STAMP_MAX_CHARACTERS, 4);
  assert.deepEqual(getStampCharacters('𠮷印記詩畫'), ['𠮷', '印', '記', '詩']);
  assert.equal(limitStampText('𠮷印記詩畫'), '𠮷印記詩');
  assert.equal(limitStampText('繁體書畫印'), '繁體書畫');
  assert.equal(limitStampText('𠮷\u0301印記詩畫'), '𠮷\u0301印記詩');
  assert.deepEqual(getStampCharacters(''), ['印']);
  assert.equal(limitStampText(''), '');
  assert.equal(limitStampText('𠮷𠮷𠮷𠮷𠮷'), '𠮷𠮷𠮷𠮷');
});

test('backing resolution follows 1x, 2x and 3x while the logical size stays unchanged', () => {
  assert.deepEqual([1, 2, 3].map((scale) => getStampRasterMetrics(120, scale).pixels), [120, 240, 360]);
  assert.deepEqual([1, 2, 3].map((scale) => getStampRasterMetrics(120, scale).scale), [1, 2, 3]);
  assert.deepEqual(getStampRasterMetrics(120, 10), { pixels: 360, scale: 3 });
  assert.deepEqual(getStampRasterMetrics(4000, 3), { pixels: 2048, scale: 2048 / 4000 });
  assert.deepEqual(getStampRasterMetrics(0, Number.NaN), { pixels: 1, scale: 1 });
});

test('brush matrix is a single shared rotate-then-skew transform', () => {
  const angle = -8 * Math.PI / 180;
  const { a, b, c, d } = getStampTransform(stamp);
  assert.ok(Math.abs(a - (Math.cos(angle) - Math.sin(angle) * Math.tan(Math.PI / 180))) < 1e-10);
  assert.ok(Math.abs(b - (Math.sin(angle) + Math.cos(angle) * Math.tan(Math.PI / 180))) < 1e-10);
  assert.ok(Math.abs(c - (Math.cos(angle) * Math.tan(-2 * Math.PI / 180) - Math.sin(angle))) < 1e-10);
  assert.ok(Math.abs(d - (Math.sin(angle) * Math.tan(-2 * Math.PI / 180) + Math.cos(angle))) < 1e-10);
  const square = getStampTransform({ ...stamp, style: 'square', rotation: 0 });
  assert.deepEqual(square, { a: 1, b: 0, c: 0, d: 1 });
});

test('same seal parameters give repeatable weathering, independent of rotation and opacity', () => {
  const a = createStampWeatheringRand(stamp);
  const b = createStampWeatheringRand({ ...stamp });
  assert.deepEqual(Array.from({ length: 15 }, () => a()), Array.from({ length: 15 }, () => b()));
  const c = createStampWeatheringRand({ ...stamp, rotation: 18, opacity: 0.2, positionX: 15 });
  const d = createStampWeatheringRand(stamp);
  assert.deepEqual(Array.from({ length: 15 }, () => c()), Array.from({ length: 15 }, () => d()));
});

test('shadow reflects seal color and historical outline/filled modes', () => {
  assert.equal(getStampShadow(stamp).color, '#c8282938');
  assert.equal(getStampShadow({ ...stamp, colorScheme: 'outline' }).color, '#c828291f');
  assert.equal(getStampShadow({ ...stamp, inkColor: 'invalid' }).color, '#c8282938');
});
