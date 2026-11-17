import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DEFAULT_STAMP_FONT, LEGACY_TEMPLATE_STAMP_FONT, getAllFontOptions, getDefaultFontForLanguage } from '../../src/fontOptions';
import {
  CNS_SEAL_FONT_STACK, CLERICAL_FONT_STACK, CHONGXI_SEAL_FONT_STACK, JINWEN_FONT_STACK,
  SEAL_FONT_STACK, getStampPresetUpdates, getTraditionalStampLayout, isSealScriptFont,
} from '../../src/sealTypography';
import { getSealStyleDesignUpdates } from '../../src/sealStyleCatalog';
import { ALL_EDITOR_TEMPLATES, resolveTemplateForLanguage } from '../../src/templates';
import { LANGUAGES } from '../../src/translations';
import { getVerifiedSealFont } from '../../src/sealFontSources';
import { inspectUnicodeCmap, missingVerifiedGlyphs } from '../../src/sealFontCoverage';
import { parseSealVariantTable, planSealVariantRows, replaceSealVariantAt } from '../../src/sealVariantChoices';

/** Tiny sfnt with a real format-12 cmap containing only 印 and 詩. */
function makeFormat12Font(): ArrayBuffer {
  const b = new ArrayBuffer(96);
  const v = new DataView(b);
  v.setUint16(4, 1); // one sfnt table record
  for (const [index, char] of [...'cmap'].entries()) v.setUint8(12 + index, char.charCodeAt(0));
  v.setUint32(20, 32); // cmap table starts at byte 32
  v.setUint32(24, 52); // cmap table total length (12 + 40)
  v.setUint16(34, 1); // one encoding record
  v.setUint16(36, 0); // platform Unicode
  v.setUint16(38, 4); // full repertoire
  v.setUint32(40, 12); // format 12 starts at byte 44
  v.setUint16(44, 12);
  v.setUint32(48, 40); // 16 + 2 groups * 12
  v.setUint32(56, 2);
  // Glyph 1: 印 U+5370
  v.setUint32(60, 0x5370);
  v.setUint32(64, 0x5370);
  v.setUint32(68, 1);
  // Glyph 2: 詩 U+8A69
  v.setUint32(72, 0x8A69);
  v.setUint32(76, 0x8A69);
  v.setUint32(80, 2);
  return b;
}

test('new historical faces are selectable throughout the card without changing poem defaults', () => {
  const fonts = getAllFontOptions().map(option => option.value);
  for (const face of [CNS_SEAL_FONT_STACK, CLERICAL_FONT_STACK, JINWEN_FONT_STACK, CHONGXI_SEAL_FONT_STACK]) {
    assert.ok(fonts.includes(face));
    assert.equal(isSealScriptFont(face), true);
    assert.ok(getVerifiedSealFont(face));
  }
  assert.equal(getVerifiedSealFont('InkPoem CNS Seal')?.value, CNS_SEAL_FONT_STACK);
  assert.equal(DEFAULT_STAMP_FONT, CNS_SEAL_FONT_STACK);
  assert.notEqual(getDefaultFontForLanguage('zh-CN'), CNS_SEAL_FONT_STACK);
  assert.notEqual(SEAL_FONT_STACK, CNS_SEAL_FONT_STACK);
});

test('new traditional stamps use CNS, old-variant font remains a selectable style', () => {
  for (const preset of ['vermillion-name', 'white-name', 'literati'] as const) {
    assert.equal(getStampPresetUpdates(preset).fontFamily, CNS_SEAL_FONT_STACK);
  }
  assert.notEqual(getStampPresetUpdates('modern-calligraphy').fontFamily, CNS_SEAL_FONT_STACK);
  for (const id of ['name-vermilion', 'name-white', 'studio', 'collector', 'blessing'] as const) {
    assert.equal(getSealStyleDesignUpdates(id).fontFamily, CNS_SEAL_FONT_STACK);
  }
});

test('compact new-face composition stays within the old renderer and does not alter old fonts', () => {
  const legacy = getTraditionalStampLayout({ size: 120, text: '詩情畫意', fontFamily: SEAL_FONT_STACK });
  const compact = getTraditionalStampLayout({ size: 120, text: '詩情畫意', fontFamily: CNS_SEAL_FONT_STACK });
  assert.equal(compact.slots.length, 4);
  assert.ok(compact.slots[0].width > legacy.slots[0].width);
  assert.ok(compact.slots[0].height > legacy.slots[0].height);
});

test('binary cmap detects missing simplified code points and keeps individual variant choices', () => {
  const cmap = inspectUnicodeCmap(makeFormat12Font());
  assert.equal(cmap.hasCodePoint('印'.codePointAt(0)!), true);
  assert.equal(cmap.hasCodePoint('詩'.codePointAt(0)!), true);
  assert.equal(cmap.hasCodePoint('诗'.codePointAt(0)!), false);
  assert.deepEqual(missingVerifiedGlyphs('印诗印', cmap), ['诗']);
  const choices = planSealVariantRows('诗诗', cmap, parseSealVariantTable('诗詩'));
  assert.deepEqual(choices.map(x => x.index), [0, 1]);
  assert.ok(choices.every(x => x.required && x.choices[0]?.character === '詩'));
  assert.equal(replaceSealVariantAt('诗诗', 1, '诗', '詩'), '诗詩');
  assert.equal(replaceSealVariantAt('诗诗', 1, '詩', '詩'), '诗诗'); // stale async update
  assert.throws(() => inspectUnicodeCmap(new ArrayBuffer(8)), /Invalid font length/);
});

test('existing built-in templates retain their original stamp face and mode in every language', () => {
  assert.equal(LEGACY_TEMPLATE_STAMP_FONT, '"Ma Shan Zheng", cursive');
  assert.notEqual(DEFAULT_STAMP_FONT, LEGACY_TEMPLATE_STAMP_FONT);
  for (const definition of ALL_EDITOR_TEMPLATES) {
    for (const language of LANGUAGES) {
      const localized = resolveTemplateForLanguage(definition.id, language);
      assert.ok(localized, `${definition.id} / ${language}`);
      assert.equal(localized.decorations.stamp.fontFamily, LEGACY_TEMPLATE_STAMP_FONT, `${definition.id} / ${language}`);
      assert.equal(localized.decorations.stamp.mode, definition.decorations.stamp.mode, `${definition.id} / ${language}`);
    }
  }
});

test('local dev does not download historical fonts while production builds still sync them', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    scripts: Record<string, string>;
  };
  assert.equal(pkg.scripts.predev, undefined);
  assert.equal(pkg.scripts.prebuild, 'node scripts/sync-inkpoem-seal-fonts.mjs');
  assert.equal(pkg.scripts['fonts:sync'], pkg.scripts.prebuild);
});
