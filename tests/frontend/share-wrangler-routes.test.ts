import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const path of ['wrangler.jsonc', 'wrangler.staging.example.jsonc']) {
  test(`${path}: share routes are handled by Worker before SPA fallback`, () => {
    const config = JSON.parse(readFileSync(path, 'utf8')) as {
      assets?: {
        not_found_handling?: string;
        run_worker_first?: string[] | boolean;
      };
    };
    assert.equal(config.assets?.not_found_handling, 'single-page-application');
    assert.ok(Array.isArray(config.assets?.run_worker_first), 'Expected explicit Worker-first route patterns');
    assert.ok(config.assets.run_worker_first.includes('/s/*'), 'Share pages and images must bypass SPA fallback');
  });
}
