import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PENDING_SHARE_KEY,
  PendingShareConflict,
  completePublishCredentials,
  fingerprintArtwork,
  pendingCredentials,
  preparePublishCredentials,
  removePublishCredentials,
  removePublishCredentialsSafely,
} from '../../src/sharing/publishProtocol';
import { SHARE_OWNER_KEY_PREFIX } from '../../src/sharing/copy';

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();
  rejectKey: string | null = null;
  get length() { return this.items.size; }
  clear() { this.items.clear(); }
  key(index: number) { return [...this.items.keys()][index] ?? null; }
  getItem(key: string) { return this.items.get(key) ?? null; }
  removeItem(key: string) { this.items.delete(key); }
  setItem(key: string, value: string) {
    if (this.rejectKey && key.startsWith(this.rejectKey)) throw new Error('QuotaExceededError');
    this.items.set(key, String(value));
  }
}

test('client creates and persists the complete deletion capability before upload', async () => {
  const storage = new MemoryStorage();
  const fingerprint = await fingerprintArtwork(
    new Blob(['artwork'], { type: 'image/png' }),
    new Blob(['card'], { type: 'image/jpeg' }), 'A poem', 'Poet',
  );
  const reserved = preparePublishCredentials(storage, fingerprint);
  assert.match(reserved.id, /^[A-Za-z0-9_-]{12}$/);
  assert.match(reserved.deleteToken, /^[a-f0-9]{64}$/);
  assert.equal(storage.getItem(SHARE_OWNER_KEY_PREFIX + reserved.id), reserved.deleteToken);
  assert.deepEqual(pendingCredentials(storage), reserved);

  // Simulated lost POST response: no callback or completion happened.
  const retry = preparePublishCredentials(storage, fingerprint);
  assert.deepEqual(retry, reserved, 'the retry must not generate another share identifier');
  completePublishCredentials(storage, retry);
  assert.equal(storage.getItem(PENDING_SHARE_KEY), null);
  assert.equal(storage.getItem(SHARE_OWNER_KEY_PREFIX + reserved.id), reserved.deleteToken);
});

test('failed local capability persistence prevents any publication', async () => {
  const storage = new MemoryStorage();
  storage.rejectKey = SHARE_OWNER_KEY_PREFIX;
  const fingerprint = 'a'.repeat(64);
  assert.throws(() => preparePublishCredentials(storage, fingerprint), /STORAGE_UNAVAILABLE/);
  assert.equal(storage.getItem(PENDING_SHARE_KEY), null);
  assert.equal(storage.length, 0);
});

test('failed pending reservation does not lose the old pending capability', async () => {
  const storage = new MemoryStorage();
  const fp = 'b'.repeat(64);
  const reserved = preparePublishCredentials(storage, fp);
  storage.rejectKey = PENDING_SHARE_KEY;
  assert.throws(() => preparePublishCredentials(storage, fp), /STORAGE_UNAVAILABLE/);
  assert.equal(storage.getItem(SHARE_OWNER_KEY_PREFIX + reserved.id), reserved.deleteToken);
  assert.deepEqual(pendingCredentials(storage), reserved);
});

test('pending publication cannot be silently replaced by different artwork', () => {
  const storage = new MemoryStorage();
  const previous = preparePublishCredentials(storage, 'c'.repeat(64));
  assert.throws(() => preparePublishCredentials(storage, 'd'.repeat(64)), (error: unknown) => {
    assert.ok(error instanceof PendingShareConflict);
    assert.deepEqual(error.pending, previous);
    return true;
  });
  assert.deepEqual(pendingCredentials(storage), previous);
});

test('only explicit successful revocation removes the owner key and pending identifier', () => {
  const storage = new MemoryStorage();
  const record = preparePublishCredentials(storage, 'e'.repeat(64));
  removePublishCredentials(storage, record.id, 'f'.repeat(64));
  assert.deepEqual(pendingCredentials(storage), record);
  removePublishCredentials(storage, record.id, record.deleteToken);
  assert.equal(storage.getItem(SHARE_OWNER_KEY_PREFIX + record.id), null);
  assert.equal(pendingCredentials(storage), null);
});

test('the same images and metadata have a stable fingerprint', async () => {
  const a = new Blob(['bytes'], { type: 'image/png' });
  const card = new Blob(['card'], { type: 'image/jpeg' });
  const first = await fingerprintArtwork(a, card, ' Sample ', ' Poet ');
  const second = await fingerprintArtwork(a, card, 'Sample', 'Poet');
  const changed = await fingerprintArtwork(new Blob(['changed'], { type: 'image/png' }), card, 'Sample', 'Poet');
  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test('storage property access denial never changes a confirmed revocation outcome', () => {
  const storage = new MemoryStorage();
  const share = preparePublishCredentials(storage, 'a'.repeat(64));
  assert.doesNotThrow(() => removePublishCredentialsSafely(share.id, share.deleteToken, () => {
    throw new DOMException('Blocked by browser policy', 'SecurityError');
  }));
  // The same helper still removes both credentials whenever storage works.
  removePublishCredentialsSafely(share.id, share.deleteToken, () => storage);
  assert.equal(storage.getItem(SHARE_OWNER_KEY_PREFIX + share.id), null);
  assert.equal(storage.getItem(PENDING_SHARE_KEY), null);
});
