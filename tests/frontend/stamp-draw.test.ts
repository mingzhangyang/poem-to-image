import assert from 'node:assert/strict';
import test from 'node:test';
import { drawStamp, drawStampImpression } from '../../src/export/stampDraw';
import { STAMP_SHADOW_PADDING, getStampRasterMetrics, getStampTransform } from '../../src/stampRendering';
import { drawNaturalSealImpression } from '../../src/naturalSealDraw';
import { getNaturalSealTexturePlan } from '../../src/naturalSealTexture';
import { getTraditionalStampLayout } from '../../src/sealTypography';
import type { StampConfig } from '../../src/types';

interface RecordOp { method: string; args: unknown[] }

class RecordingContext {
  constructor(private readonly squareGlyphBounds = false) {}
  readonly ops: RecordOp[] = [];
  font = '';
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  textAlign = 'center';
  textBaseline = 'middle';
  globalAlpha = 1;
  shadowColor = '';
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  private composite = 'source-over';
  get globalCompositeOperation() { return this.composite; }
  set globalCompositeOperation(value: string) {
    this.composite = value;
    this.add('composite', value);
  }
  private add(method: string, ...args: unknown[]) { this.ops.push({ method, args }); }
  save() { this.add('save'); }
  restore() { this.add('restore'); }
  scale(x: number, y: number) { this.add('scale', x, y); }
  translate(x: number, y: number) { this.add('translate', x, y); }
  transform(...values: number[]) { this.add('transform', ...values); }
  beginPath() { this.add('beginPath'); }
  closePath() { this.add('closePath'); }
  arc(...values: number[]) {
    if (values[2] < 0) throw new RangeError('Canvas arc radius must be non-negative');
    this.add('arc', ...values);
  }
  roundRect(...values: unknown[]) { this.add('roundRect', ...values); }
  clip() { this.add('clip'); }
  fill() { this.add('fill'); }
  stroke() { this.add('stroke'); }
  rotate(a: number) { this.add('rotate', a); }
  quadraticCurveTo(...args: number[]) { this.add('quadraticCurveTo', ...args); }
  moveTo(x: number, y: number) { this.add('moveTo', x, y); }
  lineTo(x: number, y: number) { this.add('lineTo', x, y); }
  measureText(text: string) {
    const size = Number(/([\d.]+)px/.exec(this.font)?.[1] ?? 10);
    if (this.squareGlyphBounds) {
      return {
        width: size,
        actualBoundingBoxLeft: size / 2,
        actualBoundingBoxRight: size / 2,
        actualBoundingBoxAscent: size / 2,
        actualBoundingBoxDescent: size / 2,
      };
    }
    return {
      width: size * 0.8 * Array.from(text).length,
      actualBoundingBoxLeft: size * 0.1,
      actualBoundingBoxRight: size * 0.7,
      actualBoundingBoxAscent: size * 0.72,
      actualBoundingBoxDescent: size * 0.12,
    };
  }
  fillText(value: string, x: number, y: number) { this.add('fillText', value, x, y); }
  drawImage(image: unknown, ...values: number[]) { this.add('drawImage', image, ...values); }
}

interface FakeCanvas { width: number; height: number; context: RecordingContext }
const stamp: StampConfig = {
  text: '𠮷印',
  style: 'square',
  colorScheme: 'filled',
  inkColor: '#c82829',
  weathering: 8,
  positionX: 25,
  positionY: 75,
  size: 100,
  rotation: 15,
  opacity: 0.7,
  fontFamily: 'serif',
};

function withCanvas(run: (created: FakeCanvas[]) => void, squareGlyphBounds = false) {
  const g = globalThis as Record<string, unknown>;
  const previous = g.document;
  const created: FakeCanvas[] = [];
  g.document = {
    createElement: (tag: string) => {
      assert.equal(tag, 'canvas');
      const canvas: FakeCanvas = { width: 0, height: 0, context: new RecordingContext(squareGlyphBounds) };
      created.push(canvas);
      return { get width() { return canvas.width; }, set width(v: number) { canvas.width = v; },
        get height() { return canvas.height; }, set height(v: number) { canvas.height = v; },
        getContext: (name: string) => name === '2d' ? canvas.context : null };
    },
  };
  try { run(created); } finally { g.document = previous; }
}

test('draws 1x, 2x and 3x seal bitmaps without changing dimensions on the destination', () => {
  for (const ratio of [1, 2, 3]) {
    withCanvas((created) => {
      const ctx = new RecordingContext();
      drawStampImpression(ctx as unknown as CanvasRenderingContext2D, stamp, { pixelScale: ratio });
      assert.equal(created.length, 2);
      assert.equal(created[0].width, stamp.size * ratio);
      assert.equal(created[0].height, stamp.size * ratio);
      assert.deepEqual(created[0].context.ops.find((op) => op.method === 'scale')?.args, [ratio, ratio]);
      assert.equal(created[1].width, (stamp.size + STAMP_SHADOW_PADDING * 2) * ratio);
      assert.equal(created[1].context.shadowBlur, 12 * ratio);
      assert.equal(created[1].context.shadowOffsetY, 5 * ratio);
      const image = ctx.ops.find((op) => op.method === 'drawImage');
      assert.deepEqual(image?.args.slice(1), [-86, -86, 172, 172]);
      assert.deepEqual(ctx.ops.find((op) => op.method === 'transform')?.args.slice(0, 4), Object.values(getStampTransform(stamp)));
      assert.equal(ctx.globalAlpha, 0.7);
      assert.equal(ctx.shadowBlur, 0);
    });
  }
});

test('outline/filled and square/round/brush share the same paths and carving rules', () => {
  for (const style of ['square', 'round', 'brush'] as const) {
    for (const colorScheme of ['outline', 'filled'] as const) {
      withCanvas((created) => {
        drawStampImpression(new RecordingContext() as unknown as CanvasRenderingContext2D,
          { ...stamp, style, colorScheme, weathering: 0 }, { pixelScale: 2 });
        const ops = created[0].context.ops;
        assert.ok(ops.some((op) => op.method === (style === 'round' ? 'arc' : 'roundRect')));
        assert.equal(ops.filter((op) => op.method === 'fillText').length, 2);
        assert.equal(ops.some((op) => op.method === 'composite' && op.args[0] === 'destination-out'), colorScheme === 'filled');
        assert.equal(ops.some((op) => op.method === 'stroke'), colorScheme === 'outline');
      });
    }
  }
});

test('tiny restored round outline stamps never draw negative-radius arcs', () => {
  for (const size of [0.5, 1, 2, 3]) {
    withCanvas((created) => {
      const tiny = { ...stamp, size, style: 'round' as const, colorScheme: 'outline' as const, weathering: 0 };
      assert.doesNotThrow(() => drawStampImpression(
        new RecordingContext() as unknown as CanvasRenderingContext2D,
        tiny, { pixelScale: 2 },
      ));
      const arcs = created[0].context.ops.filter((op) => op.method === 'arc');
      assert.ok(arcs.length >= 1);
      assert.equal(arcs[0].args[2], 0, 'inset arc radius must not be negative');
      assert.ok(arcs.every((op) => Number(op.args[2]) >= 0));
    });
  }
});

test('same seal has deterministic vector weathering at different backing scales', () => {
  const runs: RecordOp[][] = [];
  for (const ratio of [1, 3]) {
    withCanvas((created) => {
      drawStampImpression(new RecordingContext() as unknown as CanvasRenderingContext2D, stamp, { pixelScale: ratio });
      runs.push(created[0].context.ops.filter((op) => !['scale', 'translate'].includes(op.method)));
    });
  }
  assert.deepEqual(runs[0], runs[1]);
});

test('export uses the same impression with correct scene position, alpha and transform', () => {
  withCanvas((created) => {
    const ctx = new RecordingContext();
    drawStamp(ctx as unknown as CanvasRenderingContext2D,
      { exportScale: 3, decorations: { stamp } } as Parameters<typeof drawStamp>[1],
      { x: 20, y: 40, width: 400, height: 200 });
    assert.deepEqual(ctx.ops.find((op) => op.method === 'translate')?.args, [120, 190]);
    assert.equal(created[0].width, 300);
    assert.equal(created[1].width, 516);
    assert.equal(ctx.globalAlpha, stamp.opacity);
    assert.ok(ctx.ops.some((op) => op.method === 'transform'));
  });
});

test('preview DPR uses the same logical seal body but reserves room for shadow', () => {
  const logical = stamp.size + STAMP_SHADOW_PADDING * 2;
  const metric = getStampRasterMetrics(logical, 3);
  assert.equal(metric.pixels, 516);
  withCanvas((created) => {
    drawStampImpression(new RecordingContext() as unknown as CanvasRenderingContext2D, stamp, {
      pixelScale: metric.scale, applyTransform: false, applyOpacity: false,
    });
    assert.equal(created[0].width, 300);
    assert.equal(created[1].width, 516);
    assert.equal(created[0].context.ops.filter((op) => op.method === 'fillText').length, 2);
  });
});


test('traditional Zhu Wen draws red characters and outline, but no legacy grid', () => {
  withCanvas((created) => {
    drawStampImpression(new RecordingContext() as unknown as CanvasRenderingContext2D, {
      ...stamp, mode: 'zhuwen', text: '山水天地', colorScheme: 'filled',
      weathering: 0,
    });
    const ops = created[0].context.ops;
    assert.equal(ops.filter((op) => op.method === 'fillText').length, 4);
    assert.ok(ops.some((op) => op.method === 'stroke'));
    assert.equal(ops.some((op) => op.method === 'composite' && op.args[0] === 'destination-out'), false);
    assert.equal(ops.filter((op) => op.method === 'lineTo').length, 0);
    assert.equal(ops.filter((op) => op.method === 'scale').length, 5);
  });
});

test('round Zhu/Bai Wen four-character seals keep square-bounded ink inside the clip', () => {
  for (const mode of ['zhuwen', 'baiwen'] as const) {
    withCanvas((created) => {
      const roundStamp = { ...stamp, mode, style: 'round' as const,
        text: '山水天地', size: 100, weathering: 0 };
      drawStampImpression(new RecordingContext() as unknown as CanvasRenderingContext2D, roundStamp);
      const operations = created[0].context.ops;
      const roundPaths = operations.filter((op) => op.method === 'arc');
      assert.equal(roundPaths.length, 2, 'the second arc is the glyph clipping circle');
      const clipRadius = Number(roundPaths[1].args[2]);
      const glyphScales = operations.filter((op) => op.method === 'scale').slice(1);
      assert.equal(glyphScales.length, 4);
      const layout = getTraditionalStampLayout(roundStamp);
      layout.slots.forEach((slot, index) => {
        const scale = Number(glyphScales[index].args[0]);
        const farthestInkCorner = Math.hypot(
          Math.abs(slot.x) + slot.fontSize * scale / 2,
          Math.abs(slot.y) + slot.fontSize * scale / 2,
        );
        assert.ok(farthestInkCorner < clipRadius,
          `${mode} ink corner ${farthestInkCorner} must fit inside circle ${clipRadius}`);
      });
    }, true);
  }
});

test('traditional Bai Wen carves glyphs from a filled face even with legacy outline setting', () => {
  for (const style of ['square', 'round', 'brush'] as const) {
    withCanvas((created) => {
      drawStampImpression(new RecordingContext() as unknown as CanvasRenderingContext2D, {
        ...stamp, mode: 'baiwen', style, text: '山水', colorScheme: 'outline', weathering: 0,
      }, { pixelScale: 3 });
      const ink = created[0].context;
      assert.ok(ink.ops.some((op) => op.method === 'fill'));
      assert.equal(ink.ops.filter((op) => op.method === 'fillText').length, 2);
      assert.ok(ink.ops.some((op) => op.method === 'composite' && op.args[0] === 'destination-out'));
      assert.equal(ink.ops.filter((op) => op.method === 'lineTo').length, 0);
      assert.equal(created[1].context.shadowColor, '#c8282938');
    });
  }
});

test('explicit modern mode preserves the exact legacy ink command trace', () => {
  const traces: RecordOp[][] = [];
  for (const mode of [undefined, 'modern'] as const) {
    withCanvas((created) => {
      drawStampImpression(new RecordingContext() as unknown as CanvasRenderingContext2D,
        { ...stamp, mode, weathering: 8, colorScheme: 'outline' });
      traces.push(created[0].context.ops);
    });
  }
  assert.deepEqual(traces[0], traces[1]);
});


test('natural ink uses translucent organic blotches and fiber curves, not the old random circles', () => {
  for (const style of ['square', 'round', 'brush'] as const) {
    for (const mode of ['zhuwen', 'baiwen'] as const) {
      withCanvas((created) => {
        drawStampImpression(new RecordingContext() as unknown as CanvasRenderingContext2D,
          { ...stamp, style, mode, textureStyle: 'natural', textureSeed: 4153,
            text: '山水天地', weathering: 70 }, { pixelScale: 3 });
        const ops = created[0].context.ops;
        assert.ok(ops.some((op) => op.method === 'quadraticCurveTo'), style + ' ' + mode + ' organic curves');
        assert.equal(ops.filter((op) => op.method === 'fillText').length, 4);
        assert.equal(ops.filter((op) => op.method === 'lineTo').length, 0, 'no legacy divider grid');
        assert.equal(ops.filter((op) => op.method === 'arc').length,
          style === 'round' ? 2 : 0, 'no random-dot arcs in the natural renderer');
        assert.ok(ops.length < 2000, 'work per stamp must be bounded even at 3x');
      });
    }
  }
});

test('natural pattern remains identical across changes to color, size and opacity', () => {
  const baseline = { ...stamp, textureStyle: 'natural' as const,
    textureSeed: 52, weathering: 80 };
  const traces: RecordOp[][] = [];
  for (const variant of [
    baseline,
    { ...baseline, size: 200, inkColor: '#551111', opacity: 0.2, rotation: -30 },
  ]) {
    const ctx = new RecordingContext();
    drawNaturalSealImpression(ctx as unknown as CanvasRenderingContext2D, variant);
    traces.push(ctx.ops.filter((op) =>
      // Initial unit-square normalization changes with size; mark placements do not.
      !(op.method === 'translate' && Number(op.args[0]) < 0)
      && !(op.method === 'scale' && op.args[0] === variant.size),
    ));
  }
  assert.deepEqual(traces[0], traces[1]);
  assert.strictEqual(getNaturalSealTexturePlan(52), getNaturalSealTexturePlan(52));
});

test('zero wear and classic old drafts retain the same drawing path', () => {
  const traces: RecordOp[][] = [];
  for (const textureStyle of [undefined, 'classic'] as const) {
    withCanvas((created) => {
      drawStampImpression(new RecordingContext() as unknown as CanvasRenderingContext2D,
        { ...stamp, textureStyle, weathering: 50, mode: undefined });
      traces.push(created[0].context.ops);
    });
  }
  assert.deepEqual(traces[0], traces[1], 'missing mode/style must be visually unchanged');
  const pristine: RecordOp[][] = [];
  for (const textureStyle of ['classic', 'natural'] as const) {
    withCanvas((created) => {
      drawStampImpression(new RecordingContext() as unknown as CanvasRenderingContext2D,
        { ...stamp, textureStyle, weathering: 0, mode: 'zhuwen' });
      pristine.push(created[0].context.ops);
    });
  }
  assert.deepEqual(pristine[0], pristine[1], 'at zero aging there are no impression defects');
});

test('maximum wear has a fixed command budget independent of stamp size or export DPR', () => {
  for (const size of [64, 180, 4000]) {
    const ctx = new RecordingContext();
    drawNaturalSealImpression(ctx as unknown as CanvasRenderingContext2D,
      { ...stamp, size, textureStyle: 'natural', textureSeed: 73, weathering: 100 });
    assert.ok(ctx.ops.length < 2500, 'no loops over pixels or stamp dimensions');
  }
});
