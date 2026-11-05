import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { ALL_EDITOR_TEMPLATES } from '../../src/templates/definitions';

const MAX_PREVIEW_BYTES = 100_000;
const MAX_TOTAL_PREVIEW_BYTES = 1_000_000;

test('image-backed templates use bounded preview-specific assets', async () => {
  const imageTemplates = ALL_EDITOR_TEMPLATES.filter((template) => template.usesBackgroundImage);
  let totalBytes = 0;

  for (const template of imageTemplates) {
    assert.ok(template.previewImage, `${template.id} is missing previewImage`);
    assert.notEqual(template.previewImage, template.background.backgroundImage);
    assert.match(template.previewImage, /^\/template-previews\/.+\.[a-f0-9]{8}\.webp$/);

    const filePath = path.join(process.cwd(), 'public', template.previewImage.slice(1));
    const file = await stat(filePath);
    assert.ok(file.size <= MAX_PREVIEW_BYTES, `${template.id} preview is ${file.size} bytes`);
    totalBytes += file.size;
  }

  assert.ok(totalBytes <= MAX_TOTAL_PREVIEW_BYTES, `template previews total ${totalBytes} bytes`);
});

test('built-in image backgrounds use WebP while old draft URLs remain available', async () => {
  const legacyNames = [
    'mountain-waterfall-generated', 'sunrise-sea', 'neon-city', 'ink-pine-mist-generated',
    'parchment-scroll-generated', 'wax-sealed-letter-generated',
    'illuminated-manuscript-generated', 'bamboo-scroll-generated',
  ];

  for (const template of ALL_EDITOR_TEMPLATES.filter((item) => item.usesBackgroundImage)) {
    const image = template.background.backgroundImage;
    assert.ok(image, `${template.id} is missing a background`);
    assert.match(image, /^\/template-backgrounds\/.+\.webp$/);
    assert.ok((await stat(path.join(process.cwd(), 'public', image.slice(1)))).size > 0);
  }

  for (const name of legacyNames) {
    const original = path.join(process.cwd(), 'public', 'template-backgrounds', `${name}.png`);
    const optimized = path.join(process.cwd(), 'public', 'template-backgrounds', `${name}.webp`);
    assert.ok((await stat(optimized)).size < (await stat(original)).size, name);
  }
});
