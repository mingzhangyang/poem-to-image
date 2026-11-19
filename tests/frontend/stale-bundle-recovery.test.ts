import assert from 'node:assert/strict';
import test from 'node:test';
import { RELOAD_COOLDOWN_MS, RELOAD_MARKER_KEY, shouldReloadForStaleBundle } from '../../src/staleBundleRecovery';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    values,
  };
}

test('a stale chunk reloads once and records when', () => {
  const storage = memoryStorage();
  assert.equal(shouldReloadForStaleBundle(storage, 1_000_000), true);
  assert.equal(storage.values.get(RELOAD_MARKER_KEY), '1000000');
});

test('a second failure within the cooldown does not reload again', () => {
  const storage = memoryStorage({ [RELOAD_MARKER_KEY]: '1000000' });
  assert.equal(shouldReloadForStaleBundle(storage, 1_000_000 + RELOAD_COOLDOWN_MS - 1), false);
  assert.equal(shouldReloadForStaleBundle(storage, 1_000_000 + RELOAD_COOLDOWN_MS), true);
});

test('without usable storage the page does not reload, so it cannot loop', () => {
  assert.equal(shouldReloadForStaleBundle(null, 1_000_000), false);
  const throwing = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  };
  assert.equal(shouldReloadForStaleBundle(throwing, 1_000_000), false);
});
