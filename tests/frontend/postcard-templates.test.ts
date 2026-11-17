import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { editorTemplates, resolveTemplateForLanguage } from '../../src/templates';
import { groupGalleryTemplates } from '../../src/templates/gallery';
import { getTemplatePreviewStyle } from '../../src/templates/preview-style';
import { LANGUAGES, loadTranslations } from '../../src/translations';

const ids = [
  'postcard-vintage-travel',
  'postcard-poetry-minimal',
  'postcard-botanical',
] as const;

test('all three postcards are featured exactly once in their own category', async () => {
  const group = groupGalleryTemplates(editorTemplates)
    .find(({ key }) => key === 'templateCategoryPostcards');
  assert.ok(group);
  assert.deepEqual(group.items.map(({ id }) => id), [...ids]);

  for (const language of LANGUAGES) {
    const copy = await loadTranslations(language);
    assert.ok(copy.templateCategoryPostcards);
    assert.ok(copy.templateSeriesPostcards);
    for (const id of ids) {
      const item = resolveTemplateForLanguage(id, language);
      assert.ok(item, `${id} / ${language}`);
      assert.equal(item.seriesKey, 'templateSeriesPostcards');
      assert.ok(copy[item.nameKey]);
      assert.ok(copy[item.descriptionKey]);
      assert.equal(item.typography.writingMode,
        ['zh-CN', 'zh-TW', 'ja'].includes(language) ? 'vertical-rl' : 'horizontal-tb');
      assert.ok(item.typography.fontFamily, 'missing localized font');
      assert.equal(item.decorations.showStamp, false);
      assert.equal(item.decorations.showBorder, false);
      assert.deepEqual(item.decorations.customTexts, []);
      assert.equal(item.background.backgroundImageSource, 'template');
      assert.equal(item.background.backgroundSize, 'stretch');
      assert.ok(item.previewImage?.startsWith('/template-previews/'));
      assert.equal(getTemplatePreviewStyle(item).backgroundSize, '100% 100%');
    }
  }
});

test('WebP backgrounds and previews retain dimensions and SVG originals', async () => {
  for (const id of ids) {
    const template = resolveTemplateForLanguage(id, 'en');
    assert.ok(template);
    assert.equal(template.usesBackgroundImage, true);
    const bg = template.background.backgroundImage;
    const preview = template.previewImage;
    assert.equal(bg, '/template-backgrounds/' + id + '.webp');
    assert.match(preview!, new RegExp('^/template-previews/' + id + '\\.[0-9a-f]{8}\\.webp$'));
    assert.notEqual(preview, bg);

    // Check real lossy WebP content and native dimensions; an SVG file merely
    // renamed to .webp would not pass these header/dimension checks.
    for (const [url, width, height, maxBytes] of [
      [bg!, 960, 1200, 100_000],
      [preview!, 360, 450, 30_000],
    ] as const) {
      const file = path.join(process.cwd(), 'public', url.slice(1));
      const details = await stat(file);
      assert.ok(details.size > 0 && details.size < maxBytes, file);
      const bytes = await readFile(file);
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.equal(bytes.toString('ascii', 12, 16), 'VP8 ');
      assert.equal(bytes.readUInt16LE(26) & 0x3fff, width);
      assert.equal(bytes.readUInt16LE(28) & 0x3fff, height);
    }

    // Previous drafts using the original SVG URL remain loadable.
    const svgFile = path.join(process.cwd(), 'public', 'template-backgrounds', id + '.svg');
    const svg = await readFile(svgFile, 'utf8');
    assert.match(svg, /<svg[^>]+viewBox="0 0 960 1200"/);
    assert.doesNotMatch(svg, /<(?:script|foreignObject|image|text)\b/i);
    assert.doesNotMatch(svg, /(?:href|url)\s*=\s*["']https?:/i);
  }
});
