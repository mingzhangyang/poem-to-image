import assert from 'node:assert/strict';
import test, { afterEach, before, after } from 'node:test';

// renderCanvasExport orchestrates the whole export: background -> border -> poem ->
// decorations, all onto a 2D canvas it creates itself. There is no jsdom/canvas here,
// so we install a recording 2D context that logs every draw op. The tests then assert
// structural invariants of that op stream (draw order, scale, balanced save/restore,
// feature gating) rather than pixels — robust to tweaks, but catches real regressions.

interface Op {
  op: string;
  args: unknown[];
}

class RecordingContext {
  trace: Op[] = [];
  font = '10px sans-serif';

  private record(op: string, ...args: unknown[]) {
    this.trace.push({ op, args });
  }

  // Transform / state
  save() { this.record('save'); }
  restore() { this.record('restore'); }
  scale(x: number, y: number) { this.record('scale', x, y); }
  translate(x: number, y: number) { this.record('translate', x, y); }
  rotate(a: number) { this.record('rotate', a); }
  transform(...m: number[]) { this.record('transform', ...m); }

  // Paths
  beginPath() { this.record('beginPath'); }
  closePath() { this.record('closePath'); }
  moveTo(x: number, y: number) { this.record('moveTo', x, y); }
  lineTo(x: number, y: number) { this.record('lineTo', x, y); }
  arc(...a: number[]) { this.record('arc', ...a); }
  roundRect(...a: unknown[]) { this.record('roundRect', ...a); }
  rect(...a: number[]) { this.record('rect', ...a); }
  clip() { this.record('clip'); }
  fill(..._a: unknown[]) { this.record('fill'); }
  stroke(..._a: unknown[]) { this.record('stroke'); }
  setLineDash(d: number[]) { this.record('setLineDash', d); }

  // Rects / text / images
  fillRect(...a: number[]) { this.record('fillRect', ...a); }
  strokeRect(...a: number[]) { this.record('strokeRect', ...a); }
  clearRect(...a: number[]) { this.record('clearRect', ...a); }
  fillText(text: string, x: number, y: number) { this.record('fillText', text, x, y); }
  drawImage(...a: unknown[]) { this.record('drawImage', ...a); }

  createPattern(image: unknown, repetition: string) {
    this.record('createPattern', repetition);
    return { image, repetition };
  }

  createLinearGradient(...a: number[]) {
    this.record('createLinearGradient', ...a);
    return { addColorStop: () => {} };
  }

  measureText(text: string) {
    const match = /(\d+(?:\.\d+)?)px/.exec(this.font);
    const size = match ? Number(match[1]) : 10;
    const width = size * 0.6 * Array.from(text || ' ').length;
    return {
      width,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: width,
      actualBoundingBoxAscent: size * 0.8,
      actualBoundingBoxDescent: size * 0.2,
    };
  }
}

const createdContexts: RecordingContext[] = [];
const requestedImages: string[] = [];

class FakeCanvas {
  width = 0;
  height = 0;
  getContext(type: string) {
    if (type !== '2d') return null;
    const ctx = new RecordingContext();
    createdContexts.push(ctx);
    return ctx;
  }
}

// loadImage() constructs `new Image()`, wires onload/onerror, then assigns src.
// This stub resolves the load on the next microtask with a square natural size.
class FakeImage {
  decoding = '';
  naturalWidth = 400;
  naturalHeight = 400;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(value: string) {
    requestedImages.push(value);
    queueMicrotask(() => this.onload?.());
  }
}

const originals: Record<string, unknown> = {};

before(() => {
  const g = globalThis as Record<string, unknown>;
  originals.document = g.document;
  originals.Path2D = g.Path2D;
  originals.Image = g.Image;
  g.document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') return new FakeCanvas();
      throw new Error(`unexpected createElement(${tag})`);
    },
    fonts: { ready: Promise.resolve() },
  };
  g.Path2D = class { constructor(public path?: string) {} };
  g.Image = FakeImage;
});

after(() => {
  const g = globalThis as Record<string, unknown>;
  g.document = originals.document;
  g.Path2D = originals.Path2D;
  g.Image = originals.Image;
});

afterEach(() => {
  createdContexts.length = 0;
  requestedImages.length = 0;
});

// Imported after the DOM stubs are declared; the module itself is side-effect free,
// but keeping the import here documents the dependency on the stubbed globals at call time.
const { renderCanvasExport } = await import('../../src/export/renderCanvasExport');
const { DEFAULT_POEM_STYLE } = await import('../../src/poemStyle');
type Scene = Parameters<typeof renderCanvasExport>[0];

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    canvasWidth: 600,
    canvasHeight: 800,
    exportScale: 2,
    background: {
      backgroundType: 'solid',
      backgroundColor: '#ffffff',
      gradientColor1: '#000000',
      gradientColor2: '#ffffff',
      gradientDirection: 'to bottom',
      backgroundImage: null,
      backgroundSize: 'cover',
      bgBrightness: 100,
      bgBlur: 0,
    },
    typography: {
      poem: { title: '', author: '', body: 'GOLDEN', sourceNote: '' },
      // Zero letter-spacing keeps each line a single fillText call so we can match text.
      poemStyle: { ...DEFAULT_POEM_STYLE, bodyLetterSpacing: 0, titleLetterSpacing: 0, authorLetterSpacing: 0, sourceLetterSpacing: 0 },
      fontFamily: 'sans-serif',
      fontSize: 24,
      textColor: '#000000',
      textAlign: 'left',
      writingMode: 'horizontal-tb',
      padding: 40,
      lineHeight: 1.6,
      letterSpacing: 0,
      columns: 1,
      columnGap: 0,
      textShadowEnabled: false,
      textShadowColor: '#000000',
      textShadowBlur: 0,
      textShadowOffsetY: 0,
      textShadowOffsetX: 0,
      poemPosition: { positionX: 50, positionY: 50 },
    },
    decorations: {
      showBorder: false,
      borderStyle: 'solid',
      borderColor: '#000000',
      borderWidth: 4,
      showStamp: false,
      stamp: {} as never,
      customTexts: [],
      logos: [],
      signatures: [],
    },
    ...overrides,
  } as Scene;
}

function mainTrace(): Op[] {
  assert.ok(createdContexts.length > 0, 'expected the export to create a canvas context');
  return createdContexts[0].trace;
}

function fillTextString(trace: Op[]): string {
  return trace.filter((o) => o.op === 'fillText').map((o) => String(o.args[0])).join('');
}

function assertBalancedSaveRestore(trace: Op[]) {
  let depth = 0;
  for (const { op } of trace) {
    if (op === 'save') depth += 1;
    if (op === 'restore') {
      depth -= 1;
      assert.ok(depth >= 0, 'restore without matching save');
    }
  }
  assert.equal(depth, 0, 'every save must be matched by a restore');
}

test('applies the export scale exactly once', async () => {
  await renderCanvasExport(makeScene());
  const scales = mainTrace().filter((o) => o.op === 'scale');
  assert.equal(scales.length, 1);
  assert.deepEqual(scales[0].args, [2, 2]);
});

test('draws the background before any poem text', async () => {
  await renderCanvasExport(makeScene());
  const trace = mainTrace();
  const firstFillRect = trace.findIndex((o) => o.op === 'fillRect');
  const firstFillText = trace.findIndex((o) => o.op === 'fillText');
  assert.ok(firstFillRect >= 0, 'solid background should fillRect');
  assert.ok(firstFillText >= 0, 'poem should fillText');
  assert.ok(firstFillRect < firstFillText, 'background must be painted before text');
});

test('keeps save/restore balanced across the whole render', async () => {
  await renderCanvasExport(makeScene({
    decorations: {
      showBorder: true,
      borderStyle: 'solid',
      borderColor: '#000',
      borderWidth: 6,
      showStamp: false,
      stamp: {} as never,
      customTexts: [
        { id: 'ct1', text: 'AAA', fontSize: 18, color: '#000', writingMode: 'horizontal-tb', rotation: 0, positionX: 50, positionY: 50, zIndex: 0 } as never,
      ],
      logos: [],
      signatures: [],
    },
  }));
  assertBalancedSaveRestore(mainTrace());
});

test('renders the poem body text', async () => {
  await renderCanvasExport(makeScene());
  assert.ok(fillTextString(mainTrace()).includes('GOLDEN'));
});

test('skipPoem omits poem text', async () => {
  await renderCanvasExport(makeScene(), { skipPoem: true });
  assert.ok(!fillTextString(mainTrace()).includes('GOLDEN'));
});

test('border strokeRect appears only when showBorder is true', async () => {
  await renderCanvasExport(makeScene());
  assert.equal(mainTrace().some((o) => o.op === 'strokeRect'), false);

  createdContexts.length = 0;
  await renderCanvasExport(makeScene({
    decorations: {
      showBorder: true,
      borderStyle: 'solid',
      borderColor: '#000',
      borderWidth: 6,
      showStamp: false,
      stamp: {} as never,
      customTexts: [],
      logos: [],
      signatures: [],
    },
  }));
  assert.equal(mainTrace().some((o) => o.op === 'strokeRect'), true);
});

test('paper texture uses the preview tile and repeats it behind the poem', async () => {
  const { paperTextureUrl } = await import('../../src/paperStyles');
  const base = makeScene();
  await renderCanvasExport(makeScene({
    background: { ...base.background, backgroundType: 'paper', paperId: 'rice' },
  }));
  assert.ok(requestedImages.includes(paperTextureUrl('rice')), 'export must load the preview tile');
  const trace = mainTrace();
  const pattern = trace.findIndex((item) => item.op === 'createPattern');
  const poem = trace.findIndex((item) => item.op === 'fillText');
  assert.ok(pattern >= 0, 'export must paint a repeating texture');
  assert.ok(pattern < poem, 'paper must render behind text');
  assert.deepEqual(trace[pattern].args, ['repeat']);
  assert.equal(trace.filter((item) => item.op === 'fillRect').length, 2, 'paper and tile cover the canvas');
});

test('transparent background clears instead of filling', async () => {
  await renderCanvasExport(makeScene({
    background: {
      backgroundType: 'transparent',
      backgroundColor: '#ffffff',
      gradientColor1: '#000',
      gradientColor2: '#fff',
      gradientDirection: 'to bottom',
      backgroundImage: null,
      backgroundSize: 'cover',
      bgBrightness: 100,
      bgBlur: 0,
    },
  }), { skipPoem: true });
  const trace = mainTrace();
  assert.equal(trace.some((o) => o.op === 'clearRect'), true);
  assert.equal(trace.some((o) => o.op === 'fillRect'), false);
});

test('gradient background builds a linear gradient', async () => {
  await renderCanvasExport(makeScene({
    background: {
      backgroundType: 'gradient',
      backgroundColor: '#ffffff',
      gradientColor1: '#000',
      gradientColor2: '#fff',
      gradientDirection: 'to bottom',
      backgroundImage: null,
      backgroundSize: 'cover',
      bgBrightness: 100,
      bgBlur: 0,
    },
  }), { skipPoem: true });
  assert.equal(mainTrace().some((o) => o.op === 'createLinearGradient'), true);
});

test('decoration layers render in zIndex order', async () => {
  await renderCanvasExport(makeScene({
    typography: { ...makeScene().typography, poem: { title: '', author: '', body: '', sourceNote: '' } },
    decorations: {
      showBorder: false,
      borderStyle: 'solid',
      borderColor: '#000',
      borderWidth: 4,
      showStamp: false,
      stamp: {} as never,
      customTexts: [
        { id: 'front', text: 'FRONT', fontSize: 18, color: '#000', writingMode: 'horizontal-tb', rotation: 0, positionX: 50, positionY: 50, zIndex: 10 } as never,
        { id: 'back', text: 'BACK', fontSize: 18, color: '#000', writingMode: 'horizontal-tb', rotation: 0, positionX: 50, positionY: 50, zIndex: 1 } as never,
      ],
      logos: [],
      signatures: [],
    },
  }), { skipPoem: true });
  const trace = mainTrace();
  const backIndex = trace.findIndex((o) => o.op === 'fillText' && o.args[0] === 'BACK');
  const frontIndex = trace.findIndex((o) => o.op === 'fillText' && o.args[0] === 'FRONT');
  assert.ok(backIndex >= 0 && frontIndex >= 0);
  assert.ok(backIndex < frontIndex, 'lower zIndex must be drawn first');
});

test('image background honors backgroundSize in the export', async () => {
  const imageScene = (size: 'cover' | 'contain' | 'stretch') =>
    makeScene({
      background: {
        backgroundType: 'image',
        backgroundColor: '#ffffff',
        gradientColor1: '#000',
        gradientColor2: '#fff',
        gradientDirection: 'to bottom',
        backgroundImage: `data:image/png;base64,${size}`,
        backgroundSize: size,
        bgBrightness: 100,
        bgBlur: 0,
      },
    });

  // 'stretch' fills the full 600x800 canvas (drawX/drawY = 0).
  await renderCanvasExport(imageScene('stretch'), { skipPoem: true });
  const stretched = mainTrace().find((o) => o.op === 'drawImage');
  assert.ok(stretched, 'image background should drawImage');
  assert.deepEqual(stretched!.args.slice(1), [0, 0, 600, 800]);

  // 'cover' scales a square (400x400) image by the canvas height -> 800x800, i.e. NOT a
  // full-bleed stretch. This is the assertion that fails if the export silently falls
  // back to the default size by dropping backgroundSize from the scene.
  createdContexts.length = 0;
  await renderCanvasExport(imageScene('cover'), { skipPoem: true });
  const covered = mainTrace().find((o) => o.op === 'drawImage');
  assert.ok(covered);
  const [, , , coverWidth, coverHeight] = covered!.args as number[];
  assert.deepEqual([coverWidth, coverHeight], [800, 800]);
});
