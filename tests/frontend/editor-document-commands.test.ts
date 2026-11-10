import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_POEM_STYLE } from '../../src/poemStyle';
import {
  createEditorDocument,
  createEditorExportScene,
  createReusableTemplateParts,
  getEditorDocumentAssetUrls,
  type EditorDocumentSource,
} from '../../src/editorDocument';
import {
  executeEditorCommand,
  type EditorCommandTargets,
} from '../../src/editorCommands';

function source(): EditorDocumentSource {
  return {
    poem: { title: 'One', author: 'Author', body: 'A line', sourceNote: 'Source' },
    poemStyle: { ...DEFAULT_POEM_STYLE },
    canvasWidth: 1080,
    canvasHeight: 1350,
    presetSize: '1080x1350',
    background: {
      backgroundType: 'ai',
      paperId: undefined,
      backgroundColor: '#ffffff',
      gradientColor1: '#eeeeee',
      gradientColor2: '#dddddd',
      gradientDirection: 'to right',
      backgroundImage: 'blob:https://inkpoem.test/image',
      backgroundImageSource: 'ai',
      backgroundSize: 'contain',
      backgroundPosition: 'top left',
      bgBrightness: 90,
      bgBlur: 2,
    },
    typography: {
      fontFamily: 'serif',
      fontSize: 42,
      textColor: '#123456',
      textAlign: 'left',
      writingMode: 'horizontal-tb',
      padding: 48,
      lineHeight: 1.5,
      letterSpacing: 1,
      columns: 1,
      columnGap: 12,
      textShadowEnabled: true,
      textShadowColor: '#ffffff',
      textShadowBlur: 2,
      textShadowOffsetY: 1,
      textShadowOffsetX: 0,
    },
    decorations: {
      showBorder: true,
      borderStyle: 'solid',
      borderColor: '#432100',
      borderWidth: 7,
      showStamp: true,
      stamp: {
        text: 'Seal', style: 'square', positionX: 80,
        positionY: 80, size: 64, rotation: 0, opacity: 1,
        fontFamily: 'serif',
      },
      poemPosition: { positionX: 45, positionY: 55 },
      customTexts: [{
        id: 'custom', text: 'Note', fontSize: 25, color: '#123',
        writingMode: 'horizontal-tb', rotation: 0,
        positionX: 10, positionY: 20,
      }],
      logos: [{
        id: 'logo', imageUrl: 'data:image/png;base64,AA==',
        positionX: 15, positionY: 20,
        size: 30, rotation: 0, opacity: 1,
      }],
      signatures: [{
        id: 'sig', text: 'Signed', font: 'serif', color: '#123',
        fontSize: 30, slant: 0, thickness: 2, flourish: 'none',
        positionX: 80, positionY: 90, opacity: 1, rotation: 0,
      }],
    },
  };
}

test('canonical document captures saved fields once and normalizes transient AI mode', () => {
  const raw = source();
  const document = createEditorDocument(raw);
  assert.equal(document.background.backgroundType, 'image');
  assert.equal(document.background.backgroundImageSource, 'ai');
  assert.equal(document.presetSize, raw.presetSize);
  assert.deepEqual(document.poem, raw.poem);
  assert.deepEqual(document.poemStyle, raw.poemStyle);
  assert.deepEqual(document.decorations.signatures, raw.decorations.signatures);
  assert.equal(document.decorations.borderColor, '#432100');
  assert.equal(document.typography.textShadowEnabled, true);
  assert.equal(Object.hasOwn(document.typography, 'poemPosition'), false);
  assert.equal(JSON.parse(JSON.stringify(document)).presetSize, raw.presetSize);
});

test('export uses that same document without persisting stamp policy or AI presentation mode', () => {
  const document = createEditorDocument(source());
  const hidden = createEditorExportScene(document, { stampSupported: false, backgroundType: 'ai' });
  assert.equal(hidden.decorations.showStamp, false);
  assert.equal(hidden.background.backgroundType, 'ai');
  assert.equal(hidden.background.backgroundSize, 'contain');
  assert.equal(hidden.typography.poemPosition.positionX, 45);
  assert.deepEqual(hidden.typography.poem, document.poem);
  assert.equal(hidden.decorations.logos[0].imageUrl, document.decorations.logos[0].imageUrl);
  const visible = createEditorExportScene(document, { stampSupported: true, backgroundType: 'image' });
  assert.equal(visible.decorations.showStamp, true);
  assert.equal(document.decorations.showStamp, true, 'export presentation must not mutate persisted artwork');
  assert.equal(document.background.backgroundType, 'image');
});

test('reusable template preserves typography, signature and poem style but not uploaded artwork assets', () => {
  const document = createEditorDocument(source());
  const template = createReusableTemplateParts(document);
  assert.equal(template.background.backgroundType, 'solid');
  assert.equal(template.background.backgroundImage, null);
  assert.deepEqual(template.decorations.logos, []);
  assert.deepEqual(template.decorations.signatures, document.decorations.signatures);
  assert.deepEqual(template.poemStyle, document.poemStyle);
  assert.deepEqual(template.typography, document.typography);
  assert.ok(document.background.backgroundImage, 'template projection leaves the artwork unchanged');
  assert.equal(document.decorations.logos.length, 1);
});

test('asset ownership uses the same image URLs for history and draft documents', () => {
  const document = createEditorDocument(source());
  assert.deepEqual(getEditorDocumentAssetUrls(document), [
    'blob:https://inkpoem.test/image',
    'data:image/png;base64,AA==',
  ]);
  document.background.backgroundImage = '/template.webp';
  assert.deepEqual(getEditorDocumentAssetUrls(document), ['data:image/png;base64,AA==']);
});

function mockTargets(log: string[]): EditorCommandTargets {
  return {
    setPoem: (value) => log.push('poem:' + value.title),
    setPoemStyle: () => log.push('poemStyle'),
    setCanvasWidth: (value) => log.push('width:' + value),
    setCanvasHeight: (value) => log.push('height:' + value),
    setPresetSize: (value) => log.push('preset:' + value),
    applyBackground: () => log.push('background'),
    applyTypography: () => log.push('typography'),
    applyDecorations: () => log.push('decorations'),
  };
}

test('restore is a single ordered multi-field command including preset identity', () => {
  const log: string[] = [];
  const document = createEditorDocument(source());
  executeEditorCommand({ type: 'restore', document }, mockTargets(log));
  assert.deepEqual(log, [
    'poem:One', 'poemStyle', 'width:1080', 'height:1350',
    'preset:1080x1350', 'background', 'typography', 'decorations',
  ]);
});

test('template application updates all fields, but language-only updates respect user overrides', () => {
  const document = createEditorDocument(source());
  const template = {
    background: document.background,
    typography: document.typography,
    decorations: document.decorations,
    poemStyle: document.poemStyle,
  };
  const full: string[] = [];
  executeEditorCommand({ type: 'template', template }, mockTargets(full));
  assert.deepEqual(full, ['background', 'typography', 'decorations', 'poemStyle']);

  const partial: string[] = [];
  executeEditorCommand({
    type: 'template', template,
    sections: { background: false, typography: true, decorations: false, poemStyle: true },
  }, mockTargets(partial));
  assert.deepEqual(partial, ['typography', 'poemStyle']);
});

test('preset command keeps built-in sizes and existing legacy ratio behavior', () => {
  const log: string[] = [];
  executeEditorCommand({ type: 'canvas-preset', presetId: 'print-card' }, mockTargets(log));
  assert.deepEqual(log, ['preset:print-card', 'width:1240', 'height:1754']);
  log.length = 0;
  executeEditorCommand({ type: 'canvas-preset', presetId: '1080x1350' }, mockTargets(log));
  assert.deepEqual(log, ['preset:1080x1350', 'width:1080', 'height:1350']);
  log.length = 0;
  executeEditorCommand({ type: 'canvas-preset', presetId: 'custom' }, mockTargets(log));
  assert.deepEqual(log, ['preset:custom']);
});
