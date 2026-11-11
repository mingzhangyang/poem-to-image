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
import { getStampCanvasRadii } from '../../src/stampRendering';

const stamp: StampConfig = {
  text: '山水天地', style: 'brush', mode: 'zhuwen',
  colorScheme: 'outline', inkColor: '#c82829', weathering: 35,
  size: 100, rotation: -10, opacity: 0.85,
  positionX: 75, positionY: 80, fontFamily: 'serif',
  textureStyle: 'natural', textureSeed: 0x12abd3e,
};

function makeStampVariant(changes: Partial<StampConfig>): StampConfig {
  return { ...stamp, ...changes };
}

test('texture identity is independent of ink color, size, font, position and opacity', () => {
  const original = getNaturalSealSeed(stamp);
  assert.equal(original, 0x12abd3e);
  assert.equal(getNaturalSealSeed(makeStampVariant({
    text: '𠮷𠮷', size: 300, weathering: 100,
    fontFamily: 'sans-serif', inkColor: '#abcdef',
    positionX: 5, opacity: 0.2, rotation: 33,
  })), original);
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

test('edge samples match the Canvas rounded contour, including all four brush corner radii', () => {
  const tolerance = 1e-9;
  for (const style of ['round', 'square', 'brush'] as StampStyle[]) {
    const canvasRadii = getStampCanvasRadii(style, 1);
    const [tl, tr, br, bl] = Array.isArray(canvasRadii)
      ? canvasRadii : [canvasRadii, canvasRadii, canvasRadii, canvasRadii];
    for (const inset of [0.004, 0.01, 0.018]) {
      const [tlInset, trInset, brInset, blInset] =
        [tl, tr, br, bl].map((radius) => Math.max(0, radius - inset));
      const cornerHits = [0, 0, 0, 0];
      for (let index = 0; index <= 400; index++) {
        const [x, y] = getNaturalSealEdgePoint(style, index / 400, inset);
        assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1);
        if (style === 'round') {
          assert.ok(Math.abs(Math.hypot(x - 0.5, y - 0.5) - (0.5 - inset)) < tolerance);
          continue;
        }
        // Test against the actual painted radii; do not repeat the sampler's
        // old uniform 0.20 brush assumption in the expected geometry.
        const onStraight =
          (Math.abs(y - inset) < tolerance && x >= tl - tolerance && x <= 1 - tr + tolerance)
          || (Math.abs(x - (1 - inset)) < tolerance
            && y >= tr - tolerance && y <= 1 - br + tolerance)
          || (Math.abs(y - (1 - inset)) < tolerance
            && x >= bl - tolerance && x <= 1 - br + tolerance)
          || (Math.abs(x - inset) < tolerance
            && y >= tl - tolerance && y <= 1 - bl + tolerance);
        const arcs = [
          { cx: tl, cy: tl, radius: tlInset, quadrant: x <= tl && y <= tl },
          { cx: 1 - tr, cy: tr, radius: trInset, quadrant: x >= 1 - tr && y <= tr },
          { cx: 1 - br, cy: 1 - br, radius: brInset, quadrant: x >= 1 - br && y >= 1 - br },
          { cx: bl, cy: 1 - bl, radius: blInset, quadrant: x <= bl && y >= 1 - bl },
        ];
        const onArcs = arcs.map((arc) =>
          arc.quadrant && Math.abs(Math.hypot(x - arc.cx, y - arc.cy) - arc.radius) < tolerance);
        onArcs.forEach((hit, corner) => { if (hit) cornerHits[corner]++; });
        assert.ok(onStraight || onArcs.some(Boolean),
          style + ' contour mismatch at perimeter=' + index / 400 + ', inset=' + inset);
      }
      if (style !== 'round') {
        assert.ok(cornerHits.every((hits) => hits > 0),
          style + ' each painted corner must be covered by regression samples');
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
  assert.deepEqual(plan, createNaturalSealTexturePlan(getNaturalSealSeed(makeStampVariant({ size: 10000 }))));
});
