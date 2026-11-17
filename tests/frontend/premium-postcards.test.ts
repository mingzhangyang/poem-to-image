import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { editorTemplates, resolveTemplateForLanguage } from '../../src/templates';
import { groupGalleryTemplates } from '../../src/templates/gallery';
import { getTemplatePreviewStyle } from '../../src/templates/preview-style';
import { LANGUAGES, loadTranslations } from '../../src/translations';

const ids = [
  'postcard-premium-europe',
  'postcard-premium-botanical',
  'postcard-premium-letter-collage',
  'postcard-premium-seaside',
] as const;

test('four premium postcards belong to their own localized gallery group', async () => {
  const group = groupGalleryTemplates(editorTemplates)
    .find(({ key }) => key === 'templateCategoryPremiumPostcards');
  assert.ok(group);
  assert.deepEqual(group.items.map(({ id }) => id), [...ids]);
  for (const language of LANGUAGES) {
    const copy = await loadTranslations(language);
    assert.ok(copy.templateCategoryPremiumPostcards);
    assert.ok(copy.templateSeriesPremiumPostcards);
    for (const id of ids) {
      const item = resolveTemplateForLanguage(id, language);
      assert.ok(item, id + ' / ' + language);
      assert.ok(copy[item.nameKey] && copy[item.descriptionKey]);
      assert.equal(item.seriesKey, 'templateSeriesPremiumPostcards');
      assert.equal(item.typography.writingMode,
        ['zh-CN', 'zh-TW', 'ja'].includes(language) ? 'vertical-rl' : 'horizontal-tb');
      assert.ok(item.typography.fontFamily);
      assert.equal(item.decorations.showStamp, false);
      assert.equal(item.decorations.showBorder, false);
      assert.deepEqual(item.decorations.customTexts, []);
      assert.equal(item.background.backgroundImageSource, 'template');
      assert.equal(item.background.backgroundSize, 'stretch');
      assert.equal(getTemplatePreviewStyle(item).backgroundSize, '100% 100%');
    }
  }
});

test('premium postcards have four distinct real WebP assets and hashed previews', async () => {
  const backgrounds = new Set<string>();
  for (const id of ids) {
    const template = resolveTemplateForLanguage(id, 'en');
    assert.ok(template);
    const bg = template.background.backgroundImage;
    const preview = template.previewImage;
    assert.equal(bg, '/template-backgrounds/' + id + '.webp');
    assert.match(preview!, /^\/template-previews\/postcard-premium-.+\.[a-f0-9]{8}\.webp$/);
    assert.notEqual(bg, preview);

    for (const [url, width, height, maxBytes] of [
      [bg!, 960, 1200, 300_000],
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
      const sha = createHash('sha1')
        .update('blob ' + String(bytes.length) + '\0')
        .update(bytes).digest('hex');
      if (url === bg) {
        assert.ok(!backgrounds.has(sha), 'duplicate premium artwork: ' + id);
        backgrounds.add(sha);
      } else {
        assert.ok(url.endsWith('.' + sha.slice(0, 8) + '.webp'));
      }
    }
  }
  assert.equal(backgrounds.size, ids.length);
});

test('the three SVG classics remain selectable with their original source paths', async () => {
  for (const id of ['postcard-vintage-travel', 'postcard-poetry-minimal', 'postcard-botanical'] as const) {
    const item = resolveTemplateForLanguage(id, 'en');
    assert.ok(item);
    assert.equal(item.background.backgroundImage, '/template-backgrounds/' + id + '.svg');
    assert.match(item.previewImage!, /\.svg$/);
    const svg = await readFile(
      path.join(process.cwd(), 'public', item.background.backgroundImage.slice(1)), 'utf8');
    assert.match(svg, /<svg[^>]*viewBox="0 0 960 1200"/);
  }
});
