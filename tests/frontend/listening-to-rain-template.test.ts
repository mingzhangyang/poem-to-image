import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { editorTemplates, resolveTemplateForLanguage } from '../../src/templates';
import { groupGalleryTemplates } from '../../src/templates/gallery';
import { getTemplatePreviewStyle } from '../../src/templates/preview-style';
import { LANGUAGES, loadTranslations } from '../../src/translations';

test('Listening to Rain is localized, editable and discoverable in Chinese scenes', async () => {
  assert.equal(editorTemplates.filter(({ id }) => id === 'listening-to-rain').length, 1);
  const scenes = groupGalleryTemplates(editorTemplates).find(({ key }) => key === 'templateCategoryChineseScenes');
  assert.ok(scenes?.items.some(({ id }) => id === 'listening-to-rain'));
  for (const lang of LANGUAGES) {
    const template = resolveTemplateForLanguage('listening-to-rain', lang);
    assert.ok(template);
    const messages = await loadTranslations(lang);
    assert.ok(messages[template.nameKey] && messages[template.descriptionKey]);
    assert.equal(template.background.backgroundType, 'image');
    assert.equal(template.background.backgroundImageSource, 'template');
    assert.equal(template.background.backgroundSize, 'stretch');
    assert.equal(getTemplatePreviewStyle(template).backgroundSize, '100% 100%');
    assert.equal(template.decorations.showStamp, false);
    assert.equal(template.decorations.showBorder, false);
    assert.deepEqual(template.decorations.customTexts, []);
    assert.equal(template.typography.writingMode,
      ['zh-CN', 'zh-TW', 'ja'].includes(lang) ? 'vertical-rl' : 'horizontal-tb');
    assert.ok(template.typography.fontFamily);
    assert.ok(template.poemStyle.bodyLineHeight >= 1.7);
  }
});

test('artwork is a local, image-generated, text-free raster wrapped in self-contained SVG', async () => {
  const template = resolveTemplateForLanguage('listening-to-rain', 'zh-CN');
  assert.ok(template?.usesBackgroundImage);
  assert.equal(template.background.backgroundImage, '/template-backgrounds/listening-to-rain.svg');
  assert.equal(template.previewImage, '/template-previews/listening-to-rain.765c5f60.svg');
  for (const src of [template.background.backgroundImage, template.previewImage]) {
    const filePath = path.join(process.cwd(), 'public', src!.slice(1));
    const info = await stat(filePath);
    assert.ok(info.size > 0 && info.size < (src?.includes('template-previews') ? 100_000 : 300_000), src);
    const content = await readFile(filePath, 'utf8');
    assert.match(content, /<svg[^>]+viewBox="0 0 960 1200"/);
    assert.match(content, /<image[^>]+data:image\/webp;base64,/);
    assert.doesNotMatch(content, /<(?:script|foreignObject|text)\b/i);
    assert.doesNotMatch(content, /(?:href|src)\s*=\s*['\"]https?:\/\//i);
  }
});
