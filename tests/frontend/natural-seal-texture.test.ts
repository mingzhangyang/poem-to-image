import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNaturalSealTexturePlan,
  getNaturalSealEdgePoint,
  getNaturalSealFeatureCounts,
  getNaturalSealSeed,
  getNaturalSealTexturePlan,
  NATURAL_SEAL_PLAN_LIMITS,
  nextNaturalSealSeed,
} from '../../src/naturalSealTexture';
import type { StampConfig, StampStyle } from '../../src/types';

const stamp: StampConfig = {
  text: '山水天地', style: 'brush', mode: 'zhuwen',
  colorScheme: 'outline', inkColor: '#c82829', weathering: 35,
  size: 100, rotation: -10, opacity: 0.85,
  positionX: 75, positionY: 80, fontFamily: 'serif',
  textureStyle: 'natural', textureSeed: 0x12abd3e,
};

test('texture identity is independent of ink color, size, font, position and opacity', () => {
  const original = getNaturalSealSeed(stamp);
  assert.equal(original, 0x12abd3e);
  assert.equal(getNaturalSealSeed({
    ...stamp, text: '𠮷𠮷', size: 300, weathering: 100,
    fontFamily: 'sans-serif', inkColor: '#abcdef',
    positionX: 5, opacity: 0.2, rotation: 33,
  }), original);
  assert.equal(getNaturalSealSeed({ text: '印記' }), getNaturalSealSeed({ text: '印記', textureSeed: undefined }));
  assert.notEqual(getNaturalSealSeed({ text: '印記' }), getNaturalSealSeed({ text: '山水' }));
  assert.equal(nextNaturalSealSeed(original), nextNaturalSealSeed(original));
  assert.notEqual(nextNaturalSealSeed(original), original);
  assert.equal(getNaturalSealSeed({ text: '', textureSeed: 0 }), 0);
});

test('pure normalized feature plan is reproducible and reusable across intensities and resolutions', () => {
  const seed = getNaturalSealSeed(stamp);
  const a = createNaturalSealTexturePlan(seed);
  const b = createNaturalSealTexturePlan(seed);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, createNaturalSealTexturePlan(nextNaturalSealSeed(seed)));
  assert.strictEqual(getNaturalSealTexturePlan(seed), getNaturalSealTexturePlan(seed), 'identical seed is cached');
  assert.deepEqual(Object.keys(NATURAL_SEAL_PLAN_LIMITS), ['mottle', 'edgeWear', 'cracks', 'fibers']);
  for (const key of Object.keys(NATURAL_SEAL_PLAN_LIMITS) as Array<keyof typeof NATURAL_SEAL_PLAN_LIMITS>) {
    assert.equal(a[key].length, NATURAL_SEAL_PLAN_LIMITS[key]);
  }
  assert.ok(a.mottle.every((p) => p.x >= 0.08 && p.x <= 0.92 && p.y >= 0.08 && p.y <= 0.92));
  assert.ok(a.edgeWear.every((p) => p.perimeter >= 0 && p.perimeter < 1 && p.depth >= 0));
  assert.ok(a.cracks.every((f) => Number.isFinite(f.dx) && Number.isFinite(f.dy)));
  assert.ok(a.fibers.every((f) => f.width > 0 && f.opacity > 0 && f.opacity < 1));
});

test('strength only reveals more of the same stable marks; zero strength is pristine', () => {
  const previous = getNaturalSealFeatureCounts(0);
  assert.deepEqual(previous, { mottle: 0, edgeWear: 0, cracks: 0, fibers: 0 });
  for (let weathering = 1; weathering <= 100; weathering += 1) {
    const now = getNaturalSealFeatureCounts(weathering);
    const before = getNaturalSealFeatureCounts(weathering - 1);
    for (const key of Object.keys(now) as Array<keyof typeof now>) {
      assert.ok(now[key] >= before[key], weathering + ':' + key);
      assert.ok(now[key] <= NATURAL_SEAL_PLAN_LIMITS[key]);
    }
  }
  assert.deepEqual(getNaturalSealFeatureCounts(100), NATURAL_SEAL_PLAN_LIMITS);
  assert.deepEqual(getNaturalSealFeatureCounts(-1), getNaturalSealFeatureCounts(0));
  assert.deepEqual(getNaturalSealFeatureCounts(10000), getNaturalSealFeatureCounts(100));
  assert.deepEqual(getNaturalSealFeatureCounts(Number.NaN), getNaturalSealFeatureCounts(0));
});

test('normalized edge samples stay on the intended style-aware perimeter', () => {
  for (const style of ['round', 'square', 'brush'] as StampStyle[]) {
    for (let index = 0; index <= 80; index++) {
      const [x, y] = getNaturalSealEdgePoint(style, index / 80, 0.01);
      assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1);
      if (style === 'round') {
        assert.ok(Math.abs(Math.hypot(x - 0.5, y - 0.5) - 0.49) < 1e-9);
      } else {
        assert.ok(
          Math.abs(x - 0.01) < 1e-9 || Math.abs(x - 0.99) < 1e-9
          || Math.abs(y - 0.01) < 1e-9 || Math.abs(y - 0.99) < 1e-9,
        );
      }
    }
  }
});

test('bounded plan count keeps generation predictable for giant saved stamps', () => {
  const plan = createNaturalSealTexturePlan(getNaturalSealSeed(stamp));
  assert.equal(
    plan.mottle.length + plan.edgeWear.length + plan.cracks.length + plan.fibers.length,
    112,
  );
  // No scale or pixel ratio is passed to the generator, and changing size
  // only changes how the same unit texture is painted.
  assert.deepEqual(plan, createNaturalSealTexturePlan(getNaturalSealSeed({ ...stamp, size: 10000 })));
});
