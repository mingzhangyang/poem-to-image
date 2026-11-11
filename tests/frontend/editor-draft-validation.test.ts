import assert from 'node:assert/strict';
import test from 'node:test';
import { loadEditorDraft, type EditorDraftState } from '../../src/editorDraftStore';
import { DEFAULT_POEM_STYLE } from '../../src/poemStyle';

function validScene(): EditorDraftState {
  return {
    poem: { title: '', author: '', body: 'Ink', sourceNote: '' },
    poemStyle: { ...DEFAULT_POEM_STYLE },
    canvasWidth: 1080,
    canvasHeight: 1350,
    background: {
      backgroundType: 'solid', backgroundColor: '#fff',
      gradientColor1: '#fff', gradientColor2: '#eee', gradientDirection: 'to bottom',
      bgBrightness: 100, bgBlur: 0,
    },
    typography: {
      fontFamily: 'serif', fontSize: 42, textColor: '#000', textAlign: 'center',
      writingMode: 'horizontal-tb', padding: 40, lineHeight: 1.5,
      letterSpacing: 0, columns: 1, columnGap: 0,
      textShadowEnabled: false, textShadowColor: '#000',
      textShadowBlur: 0, textShadowOffsetX: 0, textShadowOffsetY: 0,
    },
    decorations: {
      showBorder: false, borderStyle: 'solid', showStamp: true,
      stamp: {
        text: '印', style: 'brush', fontFamily: 'serif',
        positionX: 80, positionY: 80, size: 120, rotation: 0, opacity: 1,
      },
      poemPosition: { positionX: 50, positionY: 50 },
      customTexts: [], logos: [], signatures: [],
    },
  };
}

/** Minimal transaction mock: execute the production IndexedDB reader and validator. */
async function loadStoredRecord(record: unknown) {
  const oldIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const db = {
    close() {},
    transaction() {
      let aborted = false;
      const tx = {
        oncomplete: null as (() => void) | null,
        onabort: null as (() => void) | null,
        abort() {
          aborted = true;
          queueMicrotask(() => tx.onabort?.());
        },
        objectStore(name: string) {
          assert.equal(name, 'documents', 'no asset lookup for metadata-only scene');
          return {
            get(key: string) {
              assert.equal(key, 'current');
              const request = { result: record, onsuccess: null as (() => void) | null };
              queueMicrotask(() => {
                request.onsuccess?.();
                if (!aborted) queueMicrotask(() => tx.oncomplete?.());
              });
              return request;
            },
          };
        },
      };
      return tx;
    },
  };
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: {
      open(name: string, version: number) {
        assert.equal(name, 'inkpoem-editor-drafts');
        assert.equal(version, 1);
        const request = { result: db, onsuccess: null as (() => void) | null };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: () => null } },
  });
  try {
    return await loadEditorDraft();
  } finally {
    if (oldIndexedDB) Object.defineProperty(globalThis, 'indexedDB', oldIndexedDB);
    else Reflect.deleteProperty(globalThis, 'indexedDB');
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

test('draft hydration retains legacy texture compatibility and rejects corrupt present fields', async () => {
  const cases: Array<{ name: string; fields: Record<string, unknown>; valid: boolean }> = [
    { name: 'legacy fields absent', fields: {}, valid: true },
    { name: 'classic with no seed', fields: { textureStyle: 'classic' }, valid: true },
    { name: 'elongated shape', fields: { style: 'rect-vertical', shapeRatio: 0.65 }, valid: true },
    { name: 'elliptical shape', fields: { style: 'oval', shapeRatio: 0.9 }, valid: true },
    { name: 'nonfinite shape ratio', fields: { style: 'oval', shapeRatio: Infinity }, valid: false },
    { name: 'non-numeric shape ratio', fields: { style: 'oval', shapeRatio: '0.65' }, valid: false },
    { name: 'natural seed zero', fields: { textureStyle: 'natural', textureSeed: 0 }, valid: true },
    { name: 'maximum uint32 seed', fields: { textureStyle: 'natural', textureSeed: 0xffffffff }, valid: true },
    { name: 'invalid style', fields: { textureStyle: 'bogus' }, valid: false },
    { name: 'null style', fields: { textureStyle: null }, valid: false },
    { name: 'numeric style', fields: { textureStyle: 1 }, valid: false },
    { name: 'negative seed', fields: { textureSeed: -1 }, valid: false },
    { name: 'fractional seed', fields: { textureSeed: 1.5 }, valid: false },
    { name: 'overflow seed', fields: { textureSeed: 0x100000000 }, valid: false },
    { name: 'string seed', fields: { textureSeed: '42' }, valid: false },
    { name: 'null seed', fields: { textureSeed: null }, valid: false },
    { name: 'NaN seed', fields: { textureSeed: Number.NaN }, valid: false },
    { name: 'infinite seed', fields: { textureSeed: Infinity }, valid: false },
  ];
  for (const { name, fields, valid } of cases) {
    const scene = validScene();
    Object.assign(scene.decorations.stamp, fields);
    const record = { version: 2, revision: 7, scene };
    if (valid) {
      const loaded = await loadStoredRecord(record);
      assert.equal(loaded.revision, 7, name);
      assert.deepEqual(loaded.state?.decorations.stamp, scene.decorations.stamp, name);
      assert.equal(loaded.recoveredPending, false, name);
    } else {
      await assert.rejects(loadStoredRecord(record), /DRAFT_INVALID/, name);
    }
  }
});


test('old poem styles without bodyScale still load; malformed present values are rejected', async () => {
  const cases: Array<{ name: string; scale?: unknown; valid: boolean }> = [
    { name: 'legacy missing', valid: true },
    { name: 'new default', scale: 1, valid: true },
    { name: 'body enlarged', scale: 1.5, valid: true },
    { name: 'body reduced', scale: 0.7, valid: true },
    { name: 'null', scale: null, valid: false },
    { name: 'text', scale: '1.5', valid: false },
    { name: 'NaN', scale: Number.NaN, valid: false },
    { name: 'Infinity', scale: Infinity, valid: false },
  ];
  for (const { name, scale, valid } of cases) {
    const scene = validScene();
    if (scale === undefined) {
      delete (scene.poemStyle as Partial<typeof scene.poemStyle>).bodyScale;
    } else {
      (scene.poemStyle as unknown as Record<string, unknown>).bodyScale = scale;
    }
    const record = { version: 2, revision: 11, scene };
    if (valid) {
      const loaded = await loadStoredRecord(record);
      assert.equal(loaded.revision, 11, name);
      assert.deepEqual(loaded.state?.poemStyle, scene.poemStyle, name);
    } else {
      await assert.rejects(loadStoredRecord(record), /DRAFT_INVALID/, name);
    }
  }
});
