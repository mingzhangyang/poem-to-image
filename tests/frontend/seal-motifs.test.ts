import assert from 'node:assert/strict';
import test from 'node:test';
import { drawSealMotif, getSealMotifPaths, isSealMotifId, SEAL_MOTIF_IDS } from '../../src/sealMotifs';
import type { SealMotifId } from '../../src/sealMotifs';

interface RecordedOp { method: string; args: number[] }
class MotifRecordingContext {
  readonly ops: RecordedOp[] = [];
  strokeStyle = '';
  fillStyle = '';
  lineWidth = 1;
  lineCap = '';
  lineJoin = '';
  globalCompositeOperation = 'source-over';
  beginPath() { this.ops.push({ method: 'beginPath', args: [] }); }
  moveTo(...args: number[]) { this.ops.push({ method: 'moveTo', args }); }
  lineTo(...args: number[]) { this.ops.push({ method: 'lineTo', args }); }
  quadraticCurveTo(...args: number[]) { this.ops.push({ method: 'quadraticCurveTo', args }); }
  bezierCurveTo(...args: number[]) { this.ops.push({ method: 'bezierCurveTo', args }); }
  closePath() { this.ops.push({ method: 'closePath', args: [] }); }
  fill() { this.ops.push({ method: 'fill', args: [] }); }
  stroke() { this.ops.push({ method: 'stroke', args: [this.lineWidth] }); }
  /** Each mark's compositing as it is painted, for the carve contract. */
  readonly modes: string[] = [];
  readonly inks: string[] = [];
  private markStroke = this.stroke;
  constructor() {
    this.stroke = () => {
      this.modes.push(this.globalCompositeOperation);
      this.inks.push(this.strokeStyle);
      this.markStroke();
    };
  }
}

test('eight distinct, strictly validated hand-drawn vector motifs', () => {
  assert.equal(SEAL_MOTIF_IDS.length, 8);
  assert.equal(new Set(SEAL_MOTIF_IDS).size, 8);
  assert.deepEqual(SEAL_MOTIF_IDS, [
    'dragon', 'phoenix', 'plum', 'bamboo', 'pine', 'landscape', 'lotus', 'clouds',
  ]);
  for (const id of SEAL_MOTIF_IDS) assert.equal(isSealMotifId(id), true);
  for (const invalid of ['', 'text', 'mountain', 'Dragon', null, 0, [], {}])
    assert.equal(isSealMotifId(invalid), false);
});

test('motif paths are finite, bounded and reusable at every export resolution', () => {
  const snapshots: string[] = [];
  for (const motif of SEAL_MOTIF_IDS) {
    const paths = getSealMotifPaths(motif);
    assert.ok(paths.length >= 5, motif + ' should be a composed engraving');
    assert.equal(paths, getSealMotifPaths(motif), 'no procedural redraw per frame');
    for (const mark of paths) {
      assert.ok(mark.weight > 0 && mark.weight < 10);
      assert.equal(mark.commands[0][0], 'M');
      assert.ok(mark.commands.length >= 2);
      for (const command of mark.commands) {
        if (command[0] === 'Z') continue;
        for (const coordinate of command.slice(1)) {
          assert.equal(Number.isFinite(coordinate), true, motif + ' has invalid coordinate');
          assert.ok(Math.abs(coordinate as number) <= 50, motif + ' exceeds the normalized face');
        }
      }
    }
    snapshots.push(JSON.stringify(paths));
  }
  assert.equal(new Set(snapshots).size, SEAL_MOTIF_IDS.length, 'all motifs have unique paths');
});

test('every motif produces stable Canvas commands and requires no text or image drawing', () => {
  for (const motif of SEAL_MOTIF_IDS) {
    const render = (id: SealMotifId) => {
      const ctx = new MotifRecordingContext();
      drawSealMotif(ctx as unknown as CanvasRenderingContext2D, id);
      return ctx.ops;
    };
    const a = render(motif);
    const b = render(motif);
    assert.deepEqual(a, b, motif + ' draws deterministically');
    assert.equal(a.filter((op) => op.method === 'stroke').length, getSealMotifPaths(motif).length);
    assert.ok(a.every((op) => op.args.every(Number.isFinite)));
    assert.ok(a.some((op) => op.method === 'quadraticCurveTo'
      || op.method === 'bezierCurveTo'), 'curves, not placeholder squares');
  }
});

test('pictorial seals are solid carvings: masses, bold strokes and carved detail', () => {
  for (const motif of SEAL_MOTIF_IDS) {
    const paths = getSealMotifPaths(motif);
    const solid = paths.filter((mark) => mark.filled && !mark.carve).length;
    const carved = paths.filter((mark) => mark.carve).length;
    assert.ok(solid + paths.filter((mark) => !mark.carve && mark.weight >= 4).length >= 3,
      motif + ' needs solid masses or bold strokes, not hairlines');
    assert.ok(carved >= 1 || motif === 'clouds', motif + ' carves its details back out');
    // Hairlines vanish at seal size: every stroke stays legible.
    for (const mark of paths) if (!mark.filled) assert.ok(mark.weight >= 1.4, motif);
  }
});

test('carved marks invert between Zhu Wen deposit and Bai Wen carving', () => {
  for (const motif of SEAL_MOTIF_IDS) {
    const paths = getSealMotifPaths(motif);
    const zhu = new MotifRecordingContext();
    drawSealMotif(zhu as unknown as CanvasRenderingContext2D, motif, { inkColor: '#b33227' });
    const bai = new MotifRecordingContext();
    drawSealMotif(bai as unknown as CanvasRenderingContext2D, motif,
      { carved: true, inkColor: '#b33227' });
    paths.forEach((mark, index) => {
      const zhuMode = mark.carve ? 'destination-out' : 'source-over';
      assert.equal(zhu.modes[index], zhuMode, motif + ' Zhu mark ' + index);
      assert.equal(bai.modes[index], mark.carve ? 'source-over' : 'destination-out',
        motif + ' Bai mark ' + index);
      assert.equal(zhu.inks[index], zhuMode === 'source-over' ? '#b33227' : '#000');
    });
    assert.equal(zhu.globalCompositeOperation, 'source-over', 'compositing is restored');
    assert.equal(bai.globalCompositeOperation, 'source-over');
  }
});
