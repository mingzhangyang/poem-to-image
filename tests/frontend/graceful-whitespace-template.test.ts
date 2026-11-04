import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { getTemplateFontForLanguage } from '../../src/fontOptions';
import { paperPreviewStyle } from '../../src/paperStyles';
import { LANGUAGES } from '../../src/translations';
import { isStampSupportedForEditor } from '../../src/stampDefaults';
import { ALL_EDITOR_TEMPLATES, editorTemplates, getTemplateDefinition, resolveTemplateForLanguage } from '../../src/templates';
import { getTemplatePreviewStyle } from '../../src/templates/preview-style';

const ID = 'graceful-whitespace' as const;

test('graceful whitespace is a curated classical template with editable paper and no border', () => {
  const template = getTemplateDefinition(ID);
  assert.ok(template);
  assert.equal(template.seriesKey, 'templateSeriesClassic');
  assert.equal(editorTemplates.length, 13);
  assert.equal(ALL_EDITOR_TEMPLATES.filter((item) => item.id === ID).length, 1);
  assert.deepEqual(new Set(editorTemplates.map((item) => item.id)).size, editorTemplates.length);
  assert.equal(template.background.backgroundType, 'paper');
  assert.equal(template.background.paperId, 'ivory');
  assert.equal(template.usesBackgroundImage, undefined);
  assert.equal(template.background.backgroundImage, undefined);
  assert.deepEqual(getTemplatePreviewStyle(template), paperPreviewStyle('ivory'));
  assert.equal(template.decorations.showBorder, false);
  assert.equal(template.decorations.showStamp, true);
  assert.ok(template.decorations.stamp.size <= 60);
  assert.ok(template.decorations.stamp.opacity <= 0.65);
  assert.ok(template.decorations.poemPosition.positionX >= 60);
  assert.deepEqual(template.decorations.customTexts, []);
  assert.deepEqual(template.decorations.logos, []);
});

test('language-specific layout stays vertical for Chinese/Japanese and horizontal elsewhere', () => {
  for (const language of LANGUAGES) {
    const resolved = resolveTemplateForLanguage(ID, language);
    assert.ok(resolved, language);
    assert.equal(resolved.typography.fontFamily, getTemplateFontForLanguage(ID, language));
    assert.ok(resolved.typography.fontFamily.trim(), language);
    assert.equal(resolved.background.backgroundType, 'paper', language);
    assert.equal(resolved.decorations.showBorder, false, language);
    assert.equal(resolved.decorations.showStamp, true, language);
    assert.ok(resolved.decorations.stamp.size <= 60, language);
    assert.ok(resolved.poemStyle.titleScale > 1, language);
    const vertical = ['zh-CN', 'zh-TW', 'ja'].includes(language);
    assert.equal(resolved.typography.writingMode, vertical ? 'vertical-rl' : 'horizontal-tb', language);
    assert.equal(resolved.decorations.poemPosition.positionX, vertical ? 63 : 50, language);
  }
  assert.equal(resolveTemplateForLanguage(ID, 'zh-TW')?.decorations.stamp.text, '清韻');
  assert.equal(resolveTemplateForLanguage(ID, 'zh-CN')?.decorations.stamp.text, '清韵');
  assert.equal(resolveTemplateForLanguage(ID, 'en')?.decorations.stamp.text, 'Poem');
});

test('gallery preview is a tiny local vector with no remote resources or scripts', async () => {
  const template = getTemplateDefinition(ID);
  assert.ok(template);
  assert.equal(template.previewImage, '/template-previews/graceful-whitespace.svg');
  const filePath = path.join(process.cwd(), 'public', template.previewImage.slice(1));
  const file = await stat(filePath);
  assert.ok(file.size < 4096);
  const svg = await readFile(filePath, 'utf8');
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<\/svg>\s*$/);
  assert.doesNotMatch(svg, /<script|<image|<foreignObject|(?:xlink:)?href=/i);
});

test('localized seals are persisted with artwork, not a built-in template ID', () => {
  for (const language of LANGUAGES) {
    const template = resolveTemplateForLanguage(ID, language);
    assert.ok(template, language);
    assert.equal(template.decorations.stamp.allowNonCjk, true, language);
    assert.equal(isStampSupportedForEditor(language, template.decorations.stamp), true, language);

    // This is the same JSON round trip used by drafts and custom templates.
    const savedDecorations = JSON.parse(JSON.stringify(template.decorations)) as typeof template.decorations;
    assert.equal(isStampSupportedForEditor(language, savedDecorations.stamp), true, language);
  }

  for (const language of ['en', 'es', 'fr', 'de'] as const) {
    const other = resolveTemplateForLanguage('modern-minimal', language);
    assert.ok(other);
    assert.equal(isStampSupportedForEditor(language, other.decorations.stamp), false, language);
    assert.equal(isStampSupportedForEditor(language, {}), false, language);
  }
});

test('horizontal-language body spacing matches typography to prevent wrap differences', () => {
  for (const language of ['en', 'es', 'fr', 'de', 'ko'] as const) {
    const template = resolveTemplateForLanguage(ID, language);
    assert.ok(template);
    assert.equal(template.poemStyle.bodyLineHeight, template.typography.lineHeight, language);
    assert.equal(template.poemStyle.bodyLetterSpacing, template.typography.letterSpacing, language);
  }
});
