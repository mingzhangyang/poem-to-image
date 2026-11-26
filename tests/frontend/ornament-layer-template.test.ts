import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moveLayer, normalizeDecorationLayers } from '../../src/decorationLayers';
import { parseCloudTemplateList, parseTemplateList, readTemplateCache, writeTemplateCache } from '../../src/customTemplateCache';
import type { CustomText, LogoConfig } from '../../src/types';

function logo(id: string, zIndex: number, extra: Partial<LogoConfig> = {}): LogoConfig {
  return { id, zIndex, imageUrl: '/ornaments/chrysanthemum.webp', positionX: 50, positionY: 50, size: 100, rotation: 0, opacity: 1, ...extra };
}

function order(logos: LogoConfig[]) {
  return [...logos].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map(item => item.id);
}

const ornament = { ornamentId: 'chrysanthemum' };

test('one-step legacy logo reorder crosses hidden ornaments in either band', () => {
  const logos = [logo('A', 0), logo('O1', 1, ornament), logo('O2', 2, { ...ornament, aboveText: true }), logo('B', 3)];
  const up = moveLayer([], logos, 'logo', 'A', 'up');
  assert.deepEqual(order(up.logos), ['B', 'O1', 'O2', 'A']);
  const normalized = normalizeDecorationLayers(up.customTexts, up.logos);
  assert.deepEqual(order(normalized.logos), ['B', 'O1', 'O2', 'A']);
  assert.deepEqual(order(moveLayer([], up.logos, 'logo', 'A', 'down').logos), ['A', 'O1', 'O2', 'B']);
  assert.deepEqual(order(moveLayer([], logos, 'logo', 'B', 'up').logos), order(logos));
  assert.deepEqual(order(moveLayer([], logos, 'logo', 'A', 'down').logos), order(logos));
});

test('legacy text and logos reorder together without disturbing either ornament band', () => {
  const text: CustomText = { id: 'T', text: 'poem', color: '#000', fontSize: 20, writingMode: 'horizontal-tb', rotation: 0, positionX: 50, positionY: 50, zIndex: 2 };
  const logos = [logo('A', 0), logo('O1', 1, ornament), logo('O2', 3, ornament), logo('O3', 4, { ...ornament, aboveText: true }), logo('B', 5)];
  const top = moveLayer([text], logos, 'customText', 'T', 'top');
  assert.equal(top.customTexts[0].zIndex, 5);
  assert.equal(top.logos.find(item => item.id === 'B')?.zIndex, 2);
  const bottom = moveLayer(top.customTexts, top.logos, 'customText', 'T', 'bottom');
  assert.equal(bottom.customTexts[0].zIndex, 0);
  assert.equal(bottom.logos.find(item => item.id === 'A')?.zIndex, 2);
  const oneStep = moveLayer([text], logos, 'customText', 'T', 'up');
  assert.equal(oneStep.customTexts[0].zIndex, 5);
  assert.equal(oneStep.logos.find(item => item.id === 'B')?.zIndex, 2);
  for (const id of ['O1', 'O2', 'O3']) {
    assert.equal(bottom.logos.find(item => item.id === id)?.zIndex, logos.find(item => item.id === id)?.zIndex);
  }
  const movedOrnament = moveLayer([text], logos, 'logo', 'O1', 'up');
  assert.deepEqual(order(movedOrnament.logos), ['A', 'O2', 'O1', 'O3', 'B']);
  assert.equal(movedOrnament.customTexts[0].zIndex, 2);
});

function template(logos: unknown[]) {
  return {
    id: 'template', name: 'ornament template', createdAt: 1, accentFrom: '#000', accentTo: '#fff',
    background: { backgroundType: 'solid', backgroundColor: '#fff', gradientColor1: '#fff', gradientColor2: '#000', gradientDirection: 'to bottom', bgBrightness: 100, bgBlur: 0 },
    typography: { fontFamily: 'serif', textColor: '#000', textShadowColor: '#000', textAlign: 'center', writingMode: 'horizontal-tb', textShadowEnabled: false, fontSize: 20, padding: 20, lineHeight: 1.5, letterSpacing: 0, columns: 1, columnGap: 0, textShadowBlur: 0, textShadowOffsetY: 0, textShadowOffsetX: 0 },
    decorations: { showBorder: false, showStamp: false, borderStyle: 'solid', stamp: { text: 'seal', fontFamily: 'serif', style: 'square', positionX: 80, positionY: 80, size: 50, rotation: 0, opacity: 1 }, poemPosition: { positionX: 50, positionY: 50 }, customTexts: [], logos },
  };
}

test('reject malformed ornament fields in both cloud payloads and scoped cache', () => {
  for (const invalid of [{ ornamentId: {} }, { ornamentId: null }, { ornamentId: 123 }, { aboveText: 'false' }, { aboveText: null }, { flipped: 1 }, { flipped: null }]) {
    const templates = [template([logo('legacy', 0), { ...logo('ornament', 1, ornament), ...invalid }])];
    assert.throws(() => parseCloudTemplateList({ templates }), /INVALID_TEMPLATE_LIST/);
    assert.throws(() => readTemplateCache('guest', { getItem: () => JSON.stringify(templates) }), /INVALID_SCOPED_TEMPLATE_CACHE/);
  }
});

test('valid ornament metadata survives cloud parsing and cache round-trip alongside legacy logos', () => {
  const logos = [logo('legacy', 0), logo('ornament', 1, { ...ornament, aboveText: false, flipped: true }), logo('above', 2, { ornamentId: 'future-asset', aboveText: true, flipped: false })];
  const templates = parseCloudTemplateList({ templates: [template(logos)] });
  assert.deepEqual(templates[0].decorations.logos, logos);
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  writeTemplateCache('guest', templates, storage);
  const restored = readTemplateCache('guest', storage);
  assert.deepEqual(restored[0].decorations.logos, logos);
  assert.deepEqual(parseTemplateList(JSON.parse(JSON.stringify(restored)))[0].decorations.logos, logos);
});
