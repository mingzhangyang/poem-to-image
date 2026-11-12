import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SEAL_STYLE_DESIGN_IDS, SEAL_STYLE_DESIGN_INFO,
  getActiveSealStyleDesign, getSealMotifPreview,
  getSealStyleDesignPreview, getSealStyleDesignUpdates,
} from '../../src/sealStyleCatalog';
import { getStampDimensions } from '../../src/stampRendering';
import type { StampConfig } from '../../src/types';

const existing: StampConfig = {
  text: '澄怀观道', style: 'square', mode: 'modern',
  colorScheme: 'filled', inkColor: '#356d6c',
  fontFamily: 'serif', weathering: 37, textureStyle: 'natural',
  textureSeed: 10003, size: 124, positionX: 37, positionY: 72,
  rotation: -11, opacity: 0.63, textScale: 1.05,
  textStrokeWidthPct: 1.5,
};

test('catalog covers eight traditional usage classes with distinctive available variants', () => {
  assert.equal(SEAL_STYLE_DESIGN_IDS.length, 10);
  assert.equal(new Set(SEAL_STYLE_DESIGN_IDS).size, 10);
  assert.deepEqual(SEAL_STYLE_DESIGN_IDS, [
    'name-vermilion', 'name-white', 'literati', 'studio', 'auspicious',
    'collector', 'graphic', 'landscape', 'blessing', 'modern',
  ]);
  assert.deepEqual(SEAL_STYLE_DESIGN_IDS.filter((id) =>
    SEAL_STYLE_DESIGN_INFO[id].group === 'graphic'), ['graphic', 'landscape']);
  assert.equal(SEAL_STYLE_DESIGN_IDS.filter((id) =>
    SEAL_STYLE_DESIGN_INFO[id].group === 'text').length, 8);
});

test('choosing any design only updates artistic fields, preserving saved identity and canvas placement', () => {
  for (const id of SEAL_STYLE_DESIGN_IDS) {
    const updates = getSealStyleDesignUpdates(id);
    assert.equal(Object.prototype.hasOwnProperty.call(updates, 'text'), false, id + ' cannot replace input text');
    for (const key of ['size', 'positionX', 'positionY', 'opacity', 'textureSeed'] as const) {
      assert.equal(Object.prototype.hasOwnProperty.call(updates, key), false, id + ' cannot alter ' + key);
    }
    const selected: StampConfig = { ...existing, ...updates };
    assert.equal(selected.text, existing.text, id);
    assert.equal(selected.size, existing.size, id);
    assert.equal(selected.positionX, existing.positionX, id);
    assert.equal(selected.positionY, existing.positionY, id);
    assert.equal(selected.opacity, existing.opacity, id);
    assert.equal(selected.textureSeed, existing.textureSeed, id);
    assert.equal(getActiveSealStyleDesign(selected), id,
      id + ' should be highlighted if its visual preset is fully applied');
  }
});

test('customized artistic settings remove misleading selected card feedback', () => {
  const selected: StampConfig = { ...existing, ...getSealStyleDesignUpdates('studio') };
  assert.equal(getActiveSealStyleDesign(selected), 'studio');
  assert.equal(getActiveSealStyleDesign({ ...selected, inkColor: '#098765' }), null);
  assert.equal(getActiveSealStyleDesign({ ...selected, shapeRatio: 0.82 }), null);
  assert.equal(getActiveSealStyleDesign({ ...selected, motifId: 'plum' }), null);
  assert.equal(getActiveSealStyleDesign({ ...selected, fontFamily: 'serif' }), null);
  assert.equal(getActiveSealStyleDesign({ ...existing, mode: undefined }), null);
});

test('glyph slider customization clears exact text style, while legacy defaults stay compatible', () => {
  for (const id of SEAL_STYLE_DESIGN_IDS) {
    const updates = getSealStyleDesignUpdates(id);
    const chosen: StampConfig = { ...existing, ...updates };
    if (SEAL_STYLE_DESIGN_INFO[id].group === 'graphic') {
      assert.equal('textScale' in updates, false, id);
      assert.equal('textStrokeWidthPct' in updates, false, id);
      assert.equal(chosen.textScale, existing.textScale, 'motifs must retain hidden text tuning');
      assert.equal(chosen.textStrokeWidthPct, existing.textStrokeWidthPct);
      assert.equal(getActiveSealStyleDesign(chosen), id);
      continue;
    }
    assert.equal(chosen.textScale, 1, id);
    assert.equal(chosen.textStrokeWidthPct, 0, id);
    assert.equal(getActiveSealStyleDesign(chosen), id);
    assert.equal(getActiveSealStyleDesign({ ...chosen, textScale: 1.05 }), null,
      id + ': text size slider must clear the exact selection');
    assert.equal(getActiveSealStyleDesign({ ...chosen, textStrokeWidthPct: 0.5 }), null,
      id + ': stroke width slider must clear the exact selection');
    assert.equal(getActiveSealStyleDesign({
      ...chosen, textScale: undefined, textStrokeWidthPct: undefined,
    }), id, 'legacy missing glyph settings are visually the same as defaults');
  }
});

test('name and modern gallery examples use the requested neutral seal text', () => {
  assert.equal(SEAL_STYLE_DESIGN_INFO['name-vermilion'].sampleText, '诗情画意');
  assert.equal(SEAL_STYLE_DESIGN_INFO['name-white'].sampleText, '诗情画意');
  assert.equal(SEAL_STYLE_DESIGN_INFO.modern.sampleText, '亦');
  assert.equal(getSealStyleDesignPreview('name-vermilion').text, '诗情画意');
  assert.equal(getSealStyleDesignPreview('name-white').text, '诗情画意');
  assert.equal(getSealStyleDesignPreview('modern').text, '亦');
});

test('gallery sample text appears only in previews and opt-in examples, never style updates', () => {
  for (const id of SEAL_STYLE_DESIGN_IDS) {
    const info = SEAL_STYLE_DESIGN_INFO[id];
    const preview = getSealStyleDesignPreview(id);
    assert.equal(preview.text, info.sampleText ?? '');
    assert.equal(preview.size, 70);
    assert.equal(preview.rotation, 0);
    assert.equal(preview.opacity, 1);
    assert.equal(preview.textureStyle, 'natural');
    assert.equal(preview.weathering, 16);
    assert.equal(preview.inkColor, '#b33227');
    assert.equal(preview.positionX, 50);
    assert.equal(preview.positionY, 50);
    assert.equal(preview.textureSeed, 0x4c3b2a10);
    assert.ok(getStampDimensions(preview).width > 0);
    assert.ok(getStampDimensions(preview).height > 0);
    if (info.group === 'graphic') {
      assert.ok(preview.motifId === 'dragon' || preview.motifId === 'landscape');
    } else {
      assert.equal(preview.motifId, undefined);
      assert.ok(preview.text.length > 0);
    }
  }
  assert.equal(getSealMotifPreview('plum').motifId, 'plum');
  assert.equal(getSealMotifPreview('bamboo').size, 70);
});

test('selection does not store a separate style identifier or change default artist data', () => {
  const prior = JSON.stringify(existing);
  void getSealStyleDesignPreview('name-vermilion');
  void getSealStyleDesignUpdates('landscape');
  assert.equal(JSON.stringify(existing), prior);
  assert.equal('designId' in existing, false);
});
