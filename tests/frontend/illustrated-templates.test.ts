import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { editorTemplates, resolveTemplateForLanguage } from '../../src/templates';
import { LANGUAGES } from '../../src/translations';

const ids = ['song-floral', 'blue-green-landscape', 'art-nouveau', 'midnight-star-chart', 'botanical-specimen', 'indigo-washi', 'lone-fisherman', 'milky-way', 'tower-reaching-stars', 'chrysanthemum-south-mountain', 'great-river-east', 'willow-breeze', 'grassland-breeze', 'pine-snow', 'sunset-afterglow', 'moonlit-landscape', 'daffodil-lake', 'autumn-forked-path', 'dover-beach', 'tudor-rose', 'feathered-hope', 'midnight-tyger', 'western-pass'] as const;

test('illustrated templates load local artwork with appropriate editable layouts in every language', async () => {
  for (const id of ids) {
    assert.equal(editorTemplates.filter((template) => template.id === id).length, 1);
    for (const language of LANGUAGES) {
      const template = resolveTemplateForLanguage(id, language);
      assert.ok(template, `${id} / ${language}`);
      assert.equal(template.background.backgroundType, 'image');
      assert.equal(template.background.backgroundSize, 'cover');
      assert.equal(template.decorations.showBorder, false);
      assert.equal(template.decorations.showStamp, false);
      assert.equal(template.typography.writingMode, ['zh-CN', 'zh-TW', 'ja'].includes(language) ? 'vertical-rl' : 'horizontal-tb');
      assert.ok(template.typography.fontFamily);
      assert.equal(template.poemStyle.bodyLetterSpacing, template.typography.letterSpacing);
    }
    const template = resolveTemplateForLanguage(id, 'en')!;
    for (const asset of [template.background.backgroundImage, template.previewImage]) {
      assert.ok(asset && asset.startsWith('/template-'));
      assert.ok((await stat(path.join(process.cwd(), 'public', asset.slice(1)))).size > 0, asset);
    }
  }
});

test('grassland keeps its horizon anchored and is listed with poetic landscapes', () => {
  const grassland = resolveTemplateForLanguage('grassland-breeze', 'zh-CN');
  assert.ok(grassland);
  assert.equal(grassland.seriesKey, 'templateSeriesPoeticScenes');
  assert.equal(grassland.background.backgroundPosition, 'center bottom');
  assert.equal(grassland.background.backgroundImage, '/template-backgrounds/grassland-breeze.webp');
});

test('snow, sunset, and moon keep their focal details when cropped', () => {
  for (const [id, position] of [['pine-snow', 'center top'], ['sunset-afterglow', 'center bottom'], ['moonlit-landscape', 'center top']] as const) {
    const template = resolveTemplateForLanguage(id, 'zh-CN');
    assert.ok(template);
    assert.equal(template.seriesKey, 'templateSeriesPoeticScenes');
    assert.equal(template.background.backgroundPosition, position);
  }
});

test('English poetry backgrounds form a collection with readable editable typography', () => {
  for (const id of ['daffodil-lake', 'autumn-forked-path', 'dover-beach', 'tudor-rose', 'feathered-hope', 'midnight-tyger'] as const) {
    const template = resolveTemplateForLanguage(id, 'en');
    assert.ok(template);
    assert.equal(template.seriesKey, 'templateSeriesEnglishPoetry');
    assert.equal(template.typography.writingMode, 'horizontal-tb');
    assert.equal(template.decorations.showStamp, false);
  }
  const tyger = resolveTemplateForLanguage('midnight-tyger', 'en');
  assert.ok(tyger);
  assert.equal(tyger.typography.textColor, '#f8ead1');
  assert.equal(tyger.background.backgroundPosition, 'center bottom');
});
