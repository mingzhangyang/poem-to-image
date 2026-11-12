import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureFontReady, SEAL_FONT_REGISTERED_EVENT } from '../../src/fontLoader';
import {
  SEAL_FONT_FAMILY, SEAL_FONT_STACK, SEAL_FONT_URL,
  SMALL_SEAL_FONT_FAMILY, SMALL_SEAL_FONT_STACK, SMALL_SEAL_FONT_URL,
} from '../../src/sealTypography';

test('authentic seal scripts load their pinned fonts only on demand, once per family', async () => {
  const globals = globalThis as Record<string, unknown>;
  const oldDocument = globals.document;
  const oldFontFace = globals.FontFace;
  const created: Array<{ family: string; source: string }> = [];
  const added: unknown[] = [];
  const requested: Array<{ face: string; text: string }> = [];
  const registered: number[] = [];
  const sealStarted = { notify: () => {} };
  const sealLoadStarted = new Promise<void>((resolve) => { sealStarted.notify = resolve; });
  const sealGate = { release: () => {} };
  const sealLoadGate = new Promise<void>((resolve) => { sealGate.release = resolve; });
  globals.FontFace = class {
    family: string;
    source: string;
    constructor(family: string, source: string) {
      this.family = family;
      this.source = source;
      created.push({ family, source });
    }
    load() {
      if (this.family === SEAL_FONT_FAMILY) {
        sealStarted.notify();
        return sealLoadGate.then(() => this);
      }
      return Promise.resolve(this);
    }
  };
  const fakeDocument = Object.assign(new EventTarget(), {
    fonts: {
      add(face: unknown) { added.push(face); },
      load(face: string, text: string) {
        requested.push({ face, text });
        return Promise.resolve([]);
      },
      ready: Promise.resolve(),
    },
  });
  fakeDocument.addEventListener(SEAL_FONT_REGISTERED_EVENT, () => {
    registered.push(added.length);
  });
  globals.document = fakeDocument;
  try {
    await ensureFontReady('serif', '山');
    assert.equal(created.length, 0, 'legacy fonts must not trigger seal-script downloads');
    const pendingSeal = ensureFontReady(SEAL_FONT_STACK, '山水');
    await sealLoadStarted;
    assert.equal(added.length, 0, 'loaded faces are registered only after the load resolves');
    assert.deepEqual(registered, [], 'no early repaint event before registration');
    sealGate.release();
    await pendingSeal;
    assert.deepEqual(registered, [1], 'late registration signals mounted galleries');
    await ensureFontReady(SEAL_FONT_STACK, '人');
    assert.deepEqual(registered, [1], 'reusing a font must not dispatch a duplicate signal');
    await ensureFontReady(SMALL_SEAL_FONT_STACK, '春');
    assert.deepEqual(created, [
      { family: SEAL_FONT_FAMILY, source: 'url("' + SEAL_FONT_URL + '")' },
      { family: SMALL_SEAL_FONT_FAMILY, source: 'url("' + SMALL_SEAL_FONT_URL + '")' },
    ]);
    assert.equal(added.length, 2);
    assert.deepEqual(registered, [1, 2], 'both on-demand faces signal exactly once');
    assert.ok(requested.some((req) => req.face.includes(SEAL_FONT_FAMILY) && req.text === '山水'));
    assert.ok(requested.some((req) => req.face.includes(SMALL_SEAL_FONT_FAMILY) && req.text === '春'));
    assert.match(SEAL_FONT_URL, /@[0-9a-f]{40}\//);
    assert.match(SMALL_SEAL_FONT_URL, /@[0-9a-f]{40}\//);
  } finally {
    if (oldDocument === undefined) delete globals.document;
    else globals.document = oldDocument;
    if (oldFontFace === undefined) delete globals.FontFace;
    else globals.FontFace = oldFontFace;
  }
});
