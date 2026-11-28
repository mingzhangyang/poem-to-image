import assert from 'node:assert/strict';
import test from 'node:test';
import { clean, parseArgs, parseWranglerJson } from '../../scripts/gallery-review.mjs';
import { sql } from '../../scripts/gallery-review-sql.mjs';

test('gallery review defaults to interactive review of the production database', () => {
  assert.deepEqual(parseArgs([]), {
    command: 'review', ids: [], local: false, origin: 'https://inkpoem.com', limit: 50, yes: false,
  });
  assert.deepEqual(
    parseArgs(['approve', 'AAAAAAAAAAAA', 'BBBB_BBBB-BB', '--local', '--origin', 'http://localhost:8787/x']),
    { command: 'approve', ids: ['AAAAAAAAAAAA', 'BBBB_BBBB-BB'], local: true, origin: 'http://localhost:8787', limit: 50, yes: false },
  );
});

test('gallery review rejects anything that is not a share ID before it reaches SQL', () => {
  assert.throws(() => parseArgs(['approve']), /至少一个/);
  assert.throws(() => parseArgs(['approve', "x' OR 1=1 --"]), /不是有效的分享 ID/);
  assert.throws(() => parseArgs(['pending', 'AAAAAAAAAAAA']), /不接受/);
  assert.throws(() => parseArgs(['show', 'AAAAAAAAAAAA', 'BBBBBBBBBBBB']), /只接受一个/);
  assert.throws(() => parseArgs(['drop']), /未知命令/);
  assert.throws(() => parseArgs(['--limit', '0']), /--limit/);
  assert.throws(() => parseArgs(['--origin', 'javascript:alert(1)']), /--origin/);
  assert.throws(() => sql.approve(["AAAAAAAAAAA'"]), /Not a share ID/);
  assert.throws(() => sql.remove([]), /No share ID/);
  assert.throws(() => sql.pending(0), /Limit/);
});

test('every review write reports changed rows through RETURNING', () => {
  // Local wrangler omits meta.changes, so the script counts returned rows.
  for (const statements of [
    sql.approve(['AAAAAAAAAAAA']), sql.reject(['AAAAAAAAAAAA']),
    sql.remove(['AAAAAAAAAAAA']), sql.dismissReports(['AAAAAAAAAAAA']),
  ]) {
    assert.match(statements[0]!, /RETURNING/);
  }
});

test('visitor-supplied titles cannot send terminal control sequences', () => {
  assert.equal(clean('静夜思\u001b[31m‮\u0007'), '静夜思 [31m  ');
  assert.equal(clean(null), '');
});

test('wrangler JSON output is parsed after any preamble and failures are surfaced', () => {
  const rows = parseWranglerJson('Proxy warning\n[{"results":[{"id":"AAAAAAAAAAAA"}],"success":true,"meta":{}}]');
  assert.deepEqual(rows[0].results, [{ id: 'AAAAAAAAAAAA' }]);
  assert.throws(() => parseWranglerJson('[{"results":[],"success":false}]'), /D1 执行失败/);
  assert.throws(() => parseWranglerJson('no json'), /没有返回 JSON/);
});
