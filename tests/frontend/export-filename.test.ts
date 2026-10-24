import assert from 'node:assert/strict';
import test from 'node:test';
import { createExportFilename } from '../../src/export/exportFilename';

const fixed = new Date(2026, 9, 24, 14, 30, 22, 83);

test('export filenames carry title and timestamp for all formats', () => {
  assert.equal(createExportFilename('Midnight Rain', 'png', fixed), 'Midnight-Rain-20261024-143022-083.png');
  assert.equal(createExportFilename('夜雨', 'jpg', fixed), '夜雨-20261024-143022-083.jpg');
  assert.equal(createExportFilename('  ', 'webp', fixed), 'poem-image-20261024-143022-083.webp');
});

test('export filenames remove dangerous path characters without losing CJK', () => {
  assert.equal(createExportFilename('a/b\\c:*?"<>| 夜雨', 'png', fixed), 'a-b-c-夜雨-20261024-143022-083.png');
  assert.equal(createExportFilename('Untitled', 'png', fixed, 'print-card-1240x1754'), 'Untitled-print-card-1240x1754-20261024-143022-083.png');
});

test('long CJK titles stay within the filesystem UTF-8 filename limit', () => {
  const title = '夜'.repeat(300);
  for (const format of ['png', 'jpg', 'webp'] as const) {
    const filename = createExportFilename(title, format, fixed);
    assert.ok(new TextEncoder().encode(filename).byteLength <= 255, filename);
    assert.match(filename, new RegExp(`^夜+-20261024-143022-083\\.${format}$`));
  }
});

test('supplementary Han code points are never truncated halfway', () => {
  const filename = createExportFilename('𠀀'.repeat(200), 'webp', fixed);
  assert.ok(new TextEncoder().encode(filename).byteLength <= 255);
  assert.match(filename, /^𠀀+-20261024-143022-083\.webp$/u);
});
