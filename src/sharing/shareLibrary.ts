import { SHARE_OWNER_KEY_PREFIX } from './copy';
import { PENDING_SHARE_KEY, pendingCredentials, PendingShareConflict, type PublishCredentials } from './publishProtocol';

/**
 * Local, browser-only registry of creator capabilities and share metadata.
 * Never include the private deleteToken in URLs, logs, or server responses.
 * It is stored in IndexedDB (not encrypted); users must back it up if they
 * need access across browsers or after clearing website data.
 */
export const SHARE_LIBRARY_DB = 'inkpoem-share-library';
export const SHARE_LIBRARY_STORE = 'shares';

export type LocalShareState = 'pending' | 'published' | 'unverified' | 'revoked';

export interface LocalShare {
  id: string;
  deleteToken: string;
  fingerprint: string | null;
  title: string;
  author: string;
  state: LocalShareState;
  createdAt: string;
  updatedAt: string;
}

const ID = /^[A-Za-z0-9_-]{12}$/;
const TOKEN = /^[a-f0-9]{64}$/;
const FINGERPRINT = /^[a-f0-9]{64}$/;

function storageError(): Error { return new Error('STORAGE_UNAVAILABLE'); }

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      if (typeof indexedDB === 'undefined') throw storageError();
      request = indexedDB.open(SHARE_LIBRARY_DB, 1);
    } catch {
      reject(storageError());
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SHARE_LIBRARY_STORE)) {
        db.createObjectStore(SHARE_LIBRARY_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(storageError());
    request.onblocked = () => reject(storageError());
  });
}

/** Complete only when the transaction commits; never trust request success. */
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, finish: (value: T) => void, fail: (error: Error) => void) => void,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try { tx = db.transaction(SHARE_LIBRARY_STORE, mode); }
    catch { db.close(); reject(storageError()); return; }
    let value: T;
    let failure: Error | null = null;
    const fail = (error: Error) => {
      failure = error;
      try { tx.abort(); } catch { /* Transaction might already be closed. */ }
    };
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onabort = () => { db.close(); reject(failure ?? storageError()); };
    tx.onerror = () => { /* The abort event returns a sanitized storage error. */ };
    try {
      operation(tx.objectStore(SHARE_LIBRARY_STORE), (result) => { value = result; }, fail);
    } catch { fail(storageError()); }
  });
}

function getAllShares(): Promise<LocalShare[]> {
  return transaction('readonly', (store, finish) => {
    const request = store.getAll();
    request.onsuccess = () => finish(request.result as LocalShare[]);
  });
}

/** Copies the existing localStorage capability into IndexedDB before removing
 * any old key. Old owner-only records have an unknown server status. */
async function migrateLegacy(): Promise<void> {
  const legacy = new Map<string, LocalShare>();
  const keys: Array<{ key: string; value: string }> = [];
  let storage: Storage;
  try { storage = window.localStorage; }
  catch { return; } // IndexedDB still works if the legacy API is disabled.
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(SHARE_OWNER_KEY_PREFIX)) continue;
      const id = key.slice(SHARE_OWNER_KEY_PREFIX.length);
      const token = storage.getItem(key);
      if (!ID.test(id) || !token || !TOKEN.test(token)) continue;
      const now = new Date().toISOString();
      legacy.set(id, {
        id, deleteToken: token, fingerprint: null, title: '', author: '',
        state: 'unverified', createdAt: now, updatedAt: now,
      });
      keys.push({ key, value: token });
    }
    const pending = pendingCredentials(storage);
    if (pending) {
      const now = new Date().toISOString();
      legacy.set(pending.id, {
        id: pending.id, deleteToken: pending.deleteToken,
        fingerprint: pending.fingerprint, title: '', author: '',
        state: 'pending', createdAt: now, updatedAt: now,
      });
      const raw = storage.getItem(PENDING_SHARE_KEY);
      if (raw) keys.push({ key: PENDING_SHARE_KEY, value: raw });
    }
  } catch { return; } // Leave existing keys untouched if inspection fails.
  if (!legacy.size) return;

  await transaction<void>('readwrite', (store, finish) => {
    const read = store.getAll();
    read.onsuccess = () => {
      const existing = new Map((read.result as LocalShare[]).map((item) => [item.id, item]));
      for (const candidate of legacy.values()) {
        const saved = existing.get(candidate.id);
        if (saved) {
          // A different capability is never overwritten by a legacy value.
          // Preserve the previous key until it can be resolved explicitly.
          if (saved.deleteToken !== candidate.deleteToken && saved.state !== 'revoked') {
            keys.splice(0); // Can't safely delete any legacy keys in this case.
          }
          continue;
        }
        store.add(candidate);
      }
      finish();
    };
  });

  // Best-effort legacy cleanup ONLY after the IDB transaction committed.
  // Do not clear data changed by another tab or restore a revoked share.
  for (const { key, value } of keys) {
    try { if (storage.getItem(key) === value) storage.removeItem(key); }
    catch { /* An IndexedDB copy now exists. */ }
  }
}

export async function listLocalShares(): Promise<LocalShare[]> {
  await migrateLegacy();
  const all = await getAllShares();
  return all.filter((item) => item.state !== 'revoked' && !!item.deleteToken)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function findLocalShare(id: string): Promise<LocalShare | null> {
  if (!ID.test(id)) return null;
  await migrateLegacy();
  return transaction('readonly', (store, finish) => {
    const read = store.get(id);
    read.onsuccess = () => finish((read.result as LocalShare | undefined) ?? null);
  });
}

function createId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}

function createToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The IndexedDB readwrite transaction serializes concurrent publish attempts
 * across tabs: a different pending artwork cannot overwrite a saved key.
 * No network upload is allowed until this transaction commits.
 */
export async function prepareLocalShare(
  fingerprint: string, title: string, author: string,
): Promise<PublishCredentials> {
  if (!FINGERPRINT.test(fingerprint)) throw storageError();
  await migrateLegacy();
  return transaction<PublishCredentials>('readwrite', (store, finish, fail) => {
    const read = store.getAll();
    read.onsuccess = () => {
      const records = read.result as LocalShare[];
      const pending = records.find((entry) => entry.state === 'pending');
      if (pending && pending.fingerprint !== fingerprint) {
        fail(new PendingShareConflict({
          id: pending.id, deleteToken: pending.deleteToken,
          fingerprint: pending.fingerprint ?? '',
        }));
        return;
      }
      // Preserve immutable publication identity when publishing the same
      // snapshot again, instead of creating a new link after closing a dialog.
      const existing = pending ?? records.find((entry) =>
        entry.state === 'published' && entry.fingerprint === fingerprint);
      const id = existing?.id ?? createId();
      if (records.some((entry) => entry.id === id && entry !== existing)) {
        fail(storageError());
        return;
      }
      const credentials: PublishCredentials = {
        id,
        deleteToken: existing?.deleteToken ?? createToken(),
        fingerprint,
      };
      if (!TOKEN.test(credentials.deleteToken)) { fail(storageError()); return; }
      const now = new Date().toISOString();
      store.put({
        id, deleteToken: credentials.deleteToken, fingerprint,
        title, author,
        state: existing?.state === 'published' ? 'published' : 'pending',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      } satisfies LocalShare);
      finish(credentials);
    };
  });
}

async function changeLocalShare(
  id: string, token: string,
  change: (previous: LocalShare) => LocalShare,
): Promise<void> {
  await migrateLegacy();
  await transaction<void>('readwrite', (store, finish) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const previous = request.result as LocalShare | undefined;
      if (!previous || previous.state === 'revoked' || previous.deleteToken !== token) {
        store.transaction.abort();
        return;
      }
      store.put(change(previous));
      finish();
    };
  });
}

export async function markLocalSharePublished(
  id: string, token: string, title?: string, author?: string,
): Promise<void> {
  await changeLocalShare(id, token, (previous) => ({
    ...previous, title: title ?? previous.title, author: author ?? previous.author,
    state: 'published', updatedAt: new Date().toISOString(),
  }));
}

/** Call only after a server-confirmed DELETE. A tombstone prevents leftover
 * legacy keys from recreating a revoked record and erases its private key. */
export async function markLocalShareRevoked(id: string, token: string): Promise<void> {
  await migrateLegacy();
  await transaction<void>('readwrite', (store, finish) => {
    const read = store.get(id);
    read.onsuccess = () => {
      const previous = read.result as LocalShare | undefined;
      if (previous && previous.deleteToken !== token) {
        store.transaction.abort();
        return;
      }
      if (previous) store.put({
        ...previous, deleteToken: '', fingerprint: null,
        state: 'revoked', updatedAt: new Date().toISOString(),
      } satisfies LocalShare);
      finish();
    };
  });
}

/** May be called even when IDB is blocked after a confirmed server revoke.
 * Never turn an acknowledged DELETE into an apparent remote failure. */
export async function markLocalShareRevokedSafely(id: string, token: string): Promise<void> {
  try { await markLocalShareRevoked(id, token); }
  catch { /* The remote share is already revoked. */ }
}

/** A saved pending fingerprint authorizes status recovery, not arbitrary
 * republication of different artwork. Never send the private key in a URL. */
export async function checkLocalShareStatus(share: LocalShare): Promise<'published' | 'pending'> {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 8000);
  try {
    const base = '/s/' + share.id + '/';
    let title: string | undefined;
    let author: string | undefined;
    // A public share alone is not proof that a saved legacy key belongs to it.
    // For both new and old records, require the private capability to match.
    const response = await fetch('/api/shares/' + share.id + '/verify', {
      method: 'POST', cache: 'no-store', signal: controller.signal,
      headers: {
        'X-Share-Delete-Token': share.deleteToken,
        ...(share.fingerprint && FINGERPRINT.test(share.fingerprint)
          ? { 'X-Share-Fingerprint': share.fingerprint } : {}),
      },
    });
    if (response.status === 202 || response.status === 404) return 'pending';
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const body = await response.json() as { status?: string; imageUrl?: string; cardUrl?: string };
    if (body.status !== 'published') return 'pending';
    const imageUrl = body.imageUrl ?? '';
    const cardUrl = body.cardUrl ?? '';
    if (!share.title) {
      const metadata = await fetch('/api/shares/' + share.id, {
        cache: 'no-store', signal: controller.signal,
      });
      if (metadata.ok) {
        const details = await metadata.json() as { id?: string; title?: string; author?: string };
        if (details.id === share.id) {
          title = typeof details.title === 'string' ? details.title : undefined;
          author = typeof details.author === 'string' ? details.author : undefined;
        }
      }
    }
    if (!['image.png', 'image.jpg'].some((file) => imageUrl === base + file)
      || cardUrl !== base + 'card.jpg') return 'pending';
    const [image, card] = await Promise.all([
      fetch(imageUrl, { method: 'HEAD', cache: 'no-store', signal: controller.signal }),
      fetch(cardUrl, { method: 'HEAD', cache: 'no-store', signal: controller.signal }),
    ]);
    if (!image.ok || !card.ok) return 'pending';
    await markLocalSharePublished(share.id, share.deleteToken, title, author);
    return 'published';
  } finally {
    clearTimeout(deadline);
  }
}
