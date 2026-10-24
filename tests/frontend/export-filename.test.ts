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

test('batch filenames reserve preset ID and dimensions even with long titles', () => {
  for (const title of ['A'.repeat(100), '夜'.repeat(100), '𠀀'.repeat(100)]) {
    for (const format of ['png', 'jpg', 'webp'] as const) {
      const filename = createExportFilename(title, format, fixed, 'print-card-1240x1754');
      assert.ok(new TextEncoder().encode(filename).byteLength <= 255, filename);
      assert.ok(filename.startsWith(title[0] === 'A' ? 'A' : title[0] === '夜' ? '夜' : '𠀀'), filename);
      assert.ok(filename.endsWith(`-print-card-1240x1754-20261024-143022-083.${format}`), filename);
    }
  }
});

test('unusually long batch suffixes still honor the filesystem filename limit', () => {
  const filename = createExportFilename('夜雨', 'webp', fixed, 'a'.repeat(400));
  assert.ok(new TextEncoder().encode(filename).byteLength <= 255);
  assert.ok(filename.startsWith('夜雨-'));
});
