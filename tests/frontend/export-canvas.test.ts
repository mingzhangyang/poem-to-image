import assert from 'node:assert/strict';
import test from 'node:test';
import { getCanvasContentRect, getOrderedDecorationLayers } from '../../src/export/renderCanvasExport';
import type { CanvasExportScene } from '../../src/export/renderCanvasExport';

function makeMinimalScene(overrides: Partial<CanvasExportScene> = {}): CanvasExportScene {
  return {
    canvasWidth: 1080,
    canvasHeight: 1350,
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
      poem: { title: '', author: '', body: '', sourceNote: '' },
      poemStyle: {} as any,
      fontFamily: 'sans-serif',
      fontSize: 24,
      textColor: '#000000',
      textAlign: 'left',
      writingMode: 'horizontal-tb',
      padding: 60,
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
      stamp: {} as any,
      customTexts: [],
      logos: [],
      signatures: [],
    },
    ...overrides,
  };
}

// --- getCanvasContentRect ---

test('getCanvasContentRect: insets by padding on all sides', () => {
  const scene = makeMinimalScene();
  const rect = getCanvasContentRect(scene);
  assert.equal(rect.x, 60);
  assert.equal(rect.y, 60);
  assert.equal(rect.width, 1080 - 120);
  assert.equal(rect.height, 1350 - 120);
});

test('getCanvasContentRect: zero padding returns full canvas', () => {
  const scene = makeMinimalScene();
  scene.typography.padding = 0;
  const rect = getCanvasContentRect(scene);
  assert.equal(rect.x, 0);
  assert.equal(rect.y, 0);
  assert.equal(rect.width, 1080);
  assert.equal(rect.height, 1350);
});

test('getCanvasContentRect: large padding clamps to a positive content area', () => {
  const scene = makeMinimalScene();
  scene.typography.padding = 600;
  const rect = getCanvasContentRect(scene);
  assert.equal(rect.width, 2);
  assert.equal(rect.height, 272);
});

test('getCanvasContentRect: invalid canvas dimensions fall back to a drawable area', () => {
  const scene = makeMinimalScene({ canvasWidth: 0, canvasHeight: Number.NaN });
  scene.typography.padding = 60;
  const rect = getCanvasContentRect(scene);
  assert.equal(rect.x, 0);
  assert.equal(rect.y, 0);
  assert.equal(rect.width, 1);
  assert.equal(rect.height, 1);
});

// --- getOrderedDecorationLayers ---

test('getOrderedDecorationLayers: returns empty array when no decorations', () => {
  const scene = makeMinimalScene();
  const layers = getOrderedDecorationLayers(scene);
  assert.equal(layers.length, 0);
});

test('getOrderedDecorationLayers: customTexts appear before logos at same zIndex by insertion order', () => {
  const scene = makeMinimalScene();
  scene.decorations.customTexts = [
    { id: 'ct1', text: 'hello', fontSize: 16, color: '#000', writingMode: 'horizontal-tb', rotation: 0, positionX: 50, positionY: 50, zIndex: 0 },
  ];
  scene.decorations.logos = [
    { id: 'lg1', imageUrl: 'data:image/png;base64,a', positionX: 50, positionY: 50, size: 64, rotation: 0, opacity: 1, zIndex: 0 },
  ];
  const layers = getOrderedDecorationLayers(scene);
  assert.equal(layers.length, 2);
  assert.equal(layers[0].kind, 'customText');
  assert.equal(layers[1].kind, 'logo');
});

test('getOrderedDecorationLayers: explicit zIndex overrides insertion order', () => {
  const scene = makeMinimalScene();
  scene.decorations.customTexts = [
    { id: 'ct1', text: 'behind', fontSize: 16, color: '#000', writingMode: 'horizontal-tb', rotation: 0, positionX: 50, positionY: 50, zIndex: 10 },
  ];
  scene.decorations.logos = [
    { id: 'lg1', imageUrl: 'data:image/png;base64,a', positionX: 50, positionY: 50, size: 64, rotation: 0, opacity: 1, zIndex: 5 },
  ];
  const layers = getOrderedDecorationLayers(scene);
  assert.equal(layers[0].kind, 'logo');
  assert.equal(layers[1].kind, 'customText');
});

test('getOrderedDecorationLayers: uses index as implicit zIndex when zIndex is undefined', () => {
  const scene = makeMinimalScene();
  scene.decorations.customTexts = [
    { id: 'ct1', text: 'a', fontSize: 16, color: '#000', writingMode: 'horizontal-tb', rotation: 0, positionX: 50, positionY: 50 },
    { id: 'ct2', text: 'b', fontSize: 16, color: '#000', writingMode: 'horizontal-tb', rotation: 0, positionX: 60, positionY: 60 },
  ];
  const layers = getOrderedDecorationLayers(scene);
  assert.equal(layers[0].item.id, 'ct1');
  assert.equal(layers[1].item.id, 'ct2');
});

test('getOrderedDecorationLayers: multiple items sort stably by order when zIndex ties', () => {
  const scene = makeMinimalScene();
  scene.decorations.logos = [
    { id: 'lg1', imageUrl: 'a', positionX: 0, positionY: 0, size: 32, rotation: 0, opacity: 1, zIndex: 3 },
    { id: 'lg2', imageUrl: 'b', positionX: 0, positionY: 0, size: 32, rotation: 0, opacity: 1, zIndex: 3 },
  ];
  const layers = getOrderedDecorationLayers(scene);
  assert.equal(layers[0].item.id, 'lg1');
  assert.equal(layers[1].item.id, 'lg2');
});
