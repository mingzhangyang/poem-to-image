import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { fetchPinnedFontBytes } from './fetch-font.mjs';

const file = 'Chongxi-Seal.otf';
const official = 'https://example.test/original.zip';
const seal = `https://seal.orangely.xyz/fonts/${file}`;
const inkpoem = `https://inkpoem.com/fonts/${file}`;
const pinned = Buffer.from('original font fixture');
const digest = createHash('sha256').update(pinned).digest('hex');
const verify = bytes => {
  if (bytes.length !== pinned.length || createHash('sha256').update(bytes).digest('hex') !== digest) {
    throw new Error('integrity mismatch');
  }
};
function run(download, decode) {
  return fetchPinnedFontBytes({ name: 'Chongxi Seal', file, url: official, verify, download, decode });
}

test('verified primary mirror does not contact the official host or decode raw fonts as ZIP', async () => {
  const seen = [];
  const result = await run(async url => { seen.push(url); return pinned; }, () => assert.fail('mirror is not ZIP'));
  assert.deepEqual(result, pinned);
  assert.deepEqual(seen, [seal]);
});

test('401 from the primary mirror falls back to the previous deployment', async () => {
  const seen = [];
  const result = await run(async url => {
    seen.push(url);
    if (url === seal) throw new Error('HTTP 401');
    return pinned;
  });
  assert.deepEqual(result, pinned);
  assert.deepEqual(seen, [seal, inkpoem]);
});

test('HTTP 200 with HTML or wrong font falls back to the official ZIP and verifies extracted bytes', async () => {
  const seen = [];
  const zip = Buffer.from('ZIP fixture');
  const result = await run(async url => {
    seen.push(url);
    if (url === seal) return Buffer.from('<html>SPA</html>');
    if (url === inkpoem) return Buffer.alloc(pinned.length, 65);
    return zip;
  }, raw => { assert.deepEqual(raw, zip); return pinned; });
  assert.deepEqual(result, pinned);
  assert.deepEqual(seen, [seal, inkpoem, official]);
});

test('all sources invalid fails closed and reports every source, including upstream 401', async () => {
  await assert.rejects(run(async url => {
    if (url === official) throw new Error('HTTP 401');
    return Buffer.from('incorrect');
  }), error => {
    assert.match(error.message, /no verified font source succeeded/);
    assert.ok(error.message.includes(`${seal}: integrity mismatch`));
    assert.ok(error.message.includes(`${inkpoem}: integrity mismatch`));
    assert.ok(error.message.includes(`${official}: HTTP 401`));
    return true;
  });
});

test('a corrupt official decoded font also fails closed', async () => {
  await assert.rejects(run(async () => Buffer.from('invalid'), () => Buffer.from('wrong bytes')), /integrity mismatch/);
});
