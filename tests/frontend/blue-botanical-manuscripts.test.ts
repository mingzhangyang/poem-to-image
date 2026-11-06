import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { editorTemplates, resolveTemplateForLanguage } from '../../src/templates';
import { LANGUAGES, loadTranslations } from '../../src/translations';

const designs = ['bluebird-manuscript', 'blue-meadow-manuscript', 'blue-butterfly-manuscript'] as const;

test('blue manuscript designs are localized, editable and survive template resolution', async () => {
  for (const id of designs) {
    assert.equal(editorTemplates.filter((template) => template.id === id).length, 1);
    for (const language of LANGUAGES) {
      const template = resolveTemplateForLanguage(id, language);
      assert.ok(template, `${id} / ${language}`);
      assert.equal(template.seriesKey, 'templateSeriesBlueManuscripts');
      assert.equal(template.background.backgroundImage, `/template-backgrounds/${id}.webp`);
      assert.equal(template.background.backgroundImageSource, 'template');
      assert.equal(template.background.backgroundSize, 'stretch');
      assert.equal(template.typography.writingMode, ['zh-CN', 'zh-TW', 'ja'].includes(language) ? 'vertical-rl' : 'horizontal-tb');
      assert.equal(template.poemStyle.bodyLetterSpacing, template.typography.letterSpacing);
      assert.equal(template.decorations.showBorder, false);
      assert.equal(template.decorations.showStamp, false);
      assert.ok(template.typography.fontFamily);
      const translations = await loadTranslations(language);
      assert.ok(translations[template.nameKey]);
      assert.ok(translations[template.descriptionKey]);
      assert.ok(translations[template.seriesKey]);
    }

    const template = resolveTemplateForLanguage(id, 'en')!;
    assert.notEqual(template.previewImage, template.background.backgroundImage);
    for (const asset of [template.background.backgroundImage, template.previewImage]) {
      assert.ok(asset);
      assert.ok(asset.endsWith('.webp'));
      assert.ok((await stat(path.join(process.cwd(), 'public', asset.slice(1)))).size > 0, asset);
    }
  }
});
