import assert from 'node:assert/strict';
import test from 'node:test';
import { LANGUAGES } from '../../src/translations';
import {
  ALL_EDITOR_TEMPLATES,
  editorTemplates,
  getTemplateDefinition,
  resolveTemplateForLanguage,
} from '../../src/templates';

const HIDDEN_IDS = [
  'bamboo-scroll', 'colorblock-cyan-magenta', 'ink-pine-mist-photo',
  'parchment-scroll', 'japanese-magazine', 'cyberpunk',
  'mountain-mist-photo', 'ocean-dawn-photo', 'city-night-photo',
] as const;

test('gallery excludes retired presets without deleting their definitions', () => {
  const ids = editorTemplates.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, 'gallery IDs must remain unique');
  assert.equal(editorTemplates.length, ALL_EDITOR_TEMPLATES.length - HIDDEN_IDS.length);
  for (const id of HIDDEN_IDS) {
    assert.equal(ids.includes(id), false, id + ' is still in the featured gallery');
    assert.ok(getTemplateDefinition(id), id + ' must remain resolvable for existing drafts');
    for (const language of LANGUAGES) {
      assert.ok(resolveTemplateForLanguage(id, language), id + ' fails to restore in ' + language);
    }
  }
  assert.ok(ids.includes('illuminated-manuscript'));
  assert.ok(ids.includes('modern-minimal'));
  assert.ok(ids.includes('lone-fisherman'));
});

test('photo readability repair is retained while ink-pine stays out of the gallery', () => {
  const pine = getTemplateDefinition('ink-pine-mist-photo');
  assert.ok(pine);
  assert.equal(pine.background.backgroundType, 'image');
  assert.ok(pine.background.bgBrightness >= 85);
  assert.equal(pine.typography.textColor, '#283b35');
  assert.equal(pine.typography.textShadowEnabled, true);
  assert.equal(pine.typography.textShadowColor, '#f7f4e8');
  assert.ok(pine.typography.textShadowBlur > 0);
});

test('classic and magazine template ornamentation is intentionally simplified', () => {
  const wax = getTemplateDefinition('wax-sealed-letter');
  const manuscript = getTemplateDefinition('illuminated-manuscript');
  const magazine = getTemplateDefinition('japanese-magazine');
  assert.ok(wax && manuscript && magazine);
  assert.equal(wax.decorations.showBorder, false);
  assert.equal(wax.decorations.showStamp, false);
  assert.equal(manuscript.decorations.showBorder, false);
  assert.equal(manuscript.decorations.showStamp, false);
  assert.equal(magazine.decorations.showBorder, true);
  assert.equal(magazine.decorations.borderStyle, 'solid');
  assert.equal(magazine.decorations.borderWidth, 2);
});
