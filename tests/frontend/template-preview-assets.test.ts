import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { ALL_EDITOR_TEMPLATES } from '../../src/templates/definitions';

const MAX_PREVIEW_BYTES = 100_000;
const MAX_TOTAL_PREVIEW_BYTES = 500_000;

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
