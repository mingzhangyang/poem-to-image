import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { migrateLegacyTemplateBackground } from '../../src/backgroundImageSource';
import { ALL_EDITOR_TEMPLATES } from '../../src/templates/definitions';

const MAX_PREVIEW_BYTES = 100_000;
// Four high-detail premium thumbnails add ~56 KB to the SVG gallery.
const MAX_TOTAL_PREVIEW_BYTES = 1_100_000;
const SVG_BACKGROUNDS = new Set(['postcard-vintage-travel', 'postcard-poetry-minimal', 'postcard-botanical', 'listening-to-rain']);

test('image-backed templates use bounded preview-specific assets', async () => {
  const imageTemplates = ALL_EDITOR_TEMPLATES.filter((template) => template.usesBackgroundImage);
  let totalBytes = 0;

  for (const template of imageTemplates) {
    assert.ok(template.previewImage, `${template.id} is missing previewImage`);
    assert.notEqual(template.previewImage, template.background.backgroundImage);
    assert.match(
      template.previewImage,
      SVG_BACKGROUNDS.has(template.id)
        ? /^\/template-previews\/[a-z0-9-]+\.[a-f0-9]{8}\.svg$/
        : /^\/template-previews\/.+\.[a-f0-9]{8}\.webp$/,
    );

    const filePath = path.join(process.cwd(), 'public', template.previewImage.slice(1));
    const file = await stat(filePath);
    assert.ok(file.size <= MAX_PREVIEW_BYTES, `${template.id} preview is ${file.size} bytes`);
    totalBytes += file.size;
  }

  assert.ok(totalBytes <= MAX_TOTAL_PREVIEW_BYTES, `template previews total ${totalBytes} bytes`);
});

test('built-in image backgrounds use WebP or self-contained postcard SVGs while old draft URLs migrate to WebP', async () => {
  const legacyNames = [
    'mountain-waterfall-generated', 'sunrise-sea', 'neon-city', 'ink-pine-mist-generated',
    'parchment-scroll-generated', 'wax-sealed-letter-generated',
    'illuminated-manuscript-generated', 'bamboo-scroll-generated',
  ];

  for (const template of ALL_EDITOR_TEMPLATES.filter((item) => item.usesBackgroundImage)) {
    const image = template.background.backgroundImage;
    assert.ok(image, `${template.id} is missing a background`);
    assert.match(
      image,
      SVG_BACKGROUNDS.has(template.id)
        ? /^\/template-backgrounds\/[a-z0-9-]+\.svg$/
        : /^\/template-backgrounds\/.+\.webp$/,
    );
    assert.ok((await stat(path.join(process.cwd(), 'public', image.slice(1)))).size > 0);
  }

  for (const name of legacyNames) {
    const migrated = migrateLegacyTemplateBackground(`/template-backgrounds/${name}.png`);
    assert.equal(migrated, `/template-backgrounds/${name}.webp`, name);
    assert.ok((await stat(path.join(process.cwd(), 'public', migrated.slice(1)))).size > 0, name);
  }
});
