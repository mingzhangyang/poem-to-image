import assert from 'node:assert/strict';
import test from 'node:test';
import { drawStamp, drawStampImpression } from '../../src/export/stampDraw';
import { STAMP_SHADOW_PADDING, getStampRasterMetrics, getStampTransform } from '../../src/stampRendering';
import type { StampConfig } from '../../src/types';

interface RecordOp { method: string; args: unknown[] }

class RecordingContext {
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
  moveTo(x: number, y: number) { this.add('moveTo', x, y); }
  lineTo(x: number, y: number) { this.add('lineTo', x, y); }
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

function withCanvas(run: (created: FakeCanvas[]) => void) {
  const g = globalThis as Record<string, unknown>;
  const previous = g.document;
  const created: FakeCanvas[] = [];
  g.document = {
    createElement: (tag: string) => {
      assert.equal(tag, 'canvas');
      const canvas: FakeCanvas = { width: 0, height: 0, context: new RecordingContext() };
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
