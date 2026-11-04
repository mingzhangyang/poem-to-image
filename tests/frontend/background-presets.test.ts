import assert from 'node:assert/strict';
import test from 'node:test';
import { GRADIENT_PRESETS, SOLID_COLOR_PRESET_GROUPS } from '../../src/backgroundPresets';
import en from '../../src/i18n/locales/en';
import zhCN from '../../src/i18n/locales/zh-CN';
import zhTW from '../../src/i18n/locales/zh-TW';
import ja from '../../src/i18n/locales/ja';
import ko from '../../src/i18n/locales/ko';
import es from '../../src/i18n/locales/es';
import fr from '../../src/i18n/locales/fr';
import de from '../../src/i18n/locales/de';

const HEX = /^#[0-9a-f]{6}$/i;
const DIRECTIONS = new Set(['to right', 'to bottom', 'to bottom right', 'to top right']);

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const c = parseInt(hex.slice(index, index + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return r! * 0.2126 + g! * 0.7152 + b! * 0.0722;
}

function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => p - q);
  return (y! + 0.05) / (x! + 0.05);
}

test('swatches have stable identifiers, readable names and valid unique colors', () => {
  assert.deepEqual(SOLID_COLOR_PRESET_GROUPS.map((group) => group.labelKey), ['bgPaletteMuted', 'bgPaletteChinese']);
  type Swatch = (typeof SOLID_COLOR_PRESET_GROUPS)[number]['colors'][number];
  const swatches: Swatch[] = [];
  for (const group of SOLID_COLOR_PRESET_GROUPS) {
    for (const swatch of group.colors) swatches.push(swatch);
  }
  assert.equal(swatches.length, 16);
  assert.equal(new Set(swatches.map((x) => x.id)).size, swatches.length);
  assert.equal(new Set(swatches.map((x) => x.hex)).size, swatches.length);
  for (const swatch of swatches) {
    assert.match(swatch.hex, HEX);
    assert.ok(swatch.labelKey);
    assert.ok(contrast('#1e293b', swatch.hex) >= 4.5, swatch.id);
  }
});

test('gradient presets use supported directions, light endpoints and distinct names', () => {
  assert.equal(GRADIENT_PRESETS.length, 6);
  assert.equal(new Set(GRADIENT_PRESETS.map((x) => x.id)).size, GRADIENT_PRESETS.length);
  for (const preset of GRADIENT_PRESETS) {
    assert.match(preset.from, HEX);
    assert.match(preset.to, HEX);
    assert.notEqual(preset.from, preset.to);
    assert.ok(DIRECTIONS.has(preset.direction));
    assert.ok(preset.labelKey);
    assert.ok(contrast('#1e293b', preset.from) >= 4.5, preset.id);
    assert.ok(contrast('#1e293b', preset.to) >= 4.5, preset.id);
  }
});

test('all color and gradient labels exist for all eight supported languages', () => {
  type PresetLabel =
    | (typeof SOLID_COLOR_PRESET_GROUPS)[number]['colors'][number]['labelKey']
    | (typeof GRADIENT_PRESETS)[number]['labelKey'];
  const labels: PresetLabel[] = [];
  for (const group of SOLID_COLOR_PRESET_GROUPS) {
    for (const color of group.colors) labels.push(color.labelKey);
  }
  for (const gradient of GRADIENT_PRESETS) labels.push(gradient.labelKey);
  assert.equal(new Set(labels).size, 22);
  for (const [language, locale] of Object.entries({ en, 'zh-CN': zhCN, 'zh-TW': zhTW, ja, ko, es, fr, de })) {
    for (const label of labels) {
      assert.ok(locale[label]?.trim(), language + ' missing ' + label);
    }
  }
});
