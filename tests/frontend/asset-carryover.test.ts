import assert from 'node:assert/strict';
import test from 'node:test';
import { isCarryoverPath, parseManifest, planCarryover, RETENTION_DAYS } from '../../scripts/asset-carryover.mjs';

test('the first deploy with carry-over lists the build as current and carries nothing', () => {
  const plan = planCarryover({
    currentPaths: ['/assets/App-new.js', '/template-previews/milky-way.f32d69d7.webp'],
    previous: undefined,
    today: '2026-11-20',
  });
  assert.deepEqual(plan.manifest, {
    version: 1,
    current: ['/assets/App-new.js', '/template-previews/milky-way.f32d69d7.webp'],
    retired: {},
  });
  assert.deepEqual(plan.download, []);
});

test('files dropped by this build retire today, however old the previous deploy is', () => {
  const plan = planCarryover({
    currentPaths: ['/assets/App-new.js'],
    previous: { version: 1, current: ['/assets/App-old.js', '/assets/App-new.js'], retired: {} },
    today: '2026-11-20',
  });
  assert.deepEqual(plan.manifest.current, ['/assets/App-new.js']);
  assert.deepEqual(plan.manifest.retired, { '/assets/App-old.js': '2026-11-20' });
  assert.deepEqual(plan.download, ['/assets/App-old.js']);
});

test('retired files keep their date and expire after the retention window', () => {
  const plan = planCarryover({
    currentPaths: ['/assets/App-c.js'],
    previous: {
      version: 1,
      current: ['/assets/App-c.js'],
      retired: {
        '/assets/App-b.js': '2026-10-21',
        '/assets/App-a.js': '2026-10-20',
      },
    },
    today: '2026-11-20',
    retentionDays: RETENTION_DAYS,
  });
  assert.deepEqual(plan.manifest.retired, { '/assets/App-b.js': '2026-10-21' });
  assert.deepEqual(plan.download, ['/assets/App-b.js']);
  assert.deepEqual(plan.expired, ['/assets/App-a.js']);
});

test('a retired file that returns to the build becomes current again', () => {
  const plan = planCarryover({
    currentPaths: ['/template-previews/song-floral.887beb39.webp'],
    previous: { version: 1, current: [], retired: { '/template-previews/song-floral.887beb39.webp': '2026-11-19' } },
    today: '2026-11-20',
  });
  assert.deepEqual(plan.manifest.current, ['/template-previews/song-floral.887beb39.webp']);
  assert.deepEqual(plan.manifest.retired, {});
  assert.deepEqual(plan.download, []);
});

test('manifests from the network may only name flat files in hashed directories', () => {
  assert.equal(isCarryoverPath('/assets/App-CHhseqsV.js'), true);
  assert.equal(isCarryoverPath('/template-previews/art-nouveau.6f15fabf.webp'), true);
  for (const unsafe of ['/assets/../wrangler.jsonc', '/assets/sub/x.js', '/index.html', 'assets/x.js', '/assets/.hidden']) {
    assert.equal(isCarryoverPath(unsafe), false, unsafe);
  }
  assert.throws(() => parseManifest({ version: 1, current: ['/assets/../../etc/passwd'], retired: {} }), /invalid path/);
  assert.throws(() => parseManifest({ version: 1, current: [], retired: { '/assets/x.js': 'yesterday' } }), /retirement date/);
  assert.throws(() => parseManifest({ version: 2, current: [], retired: {} }), /version 1/);
  assert.deepEqual(
    parseManifest({ version: 1, current: ['/assets/x.js'], retired: { '/assets/y.js': '2026-11-01' } }),
    { version: 1, current: ['/assets/x.js'], retired: { '/assets/y.js': '2026-11-01' } },
  );
});
