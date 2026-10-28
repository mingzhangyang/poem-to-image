import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureFontReady } from '../../src/fontLoader';

test('Canvas export waits for selected text glyphs rather than just document.fonts.ready', async () => {
  const g = globalThis as Record<string, unknown>;
  const originalDocument = g.document;
  let releaseFontLoad = () => {};
  const loadGate = new Promise<void>((resolve) => { releaseFontLoad = resolve; });
  const requests: Array<{ face: string; text: string }> = [];
  g.document = {
    fonts: {
      ready: Promise.resolve(),
      load(face: string, text: string) {
        requests.push({ face, text });
        return loadGate.then(() => []);
      },
    },
  };

  try {
    let finished = false;
    const task = ensureFontReady('serif', '春风 山水').then(() => { finished = true; });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(finished, false, 'export must wait until font load resolves');
    assert.deepEqual(requests, [{ face: '20px "serif"', text: '春风 山水' }]);
    releaseFontLoad();
    await task;
    assert.equal(finished, true);
  } finally {
    if (originalDocument === undefined) delete g.document;
    else g.document = originalDocument;
  }
});
