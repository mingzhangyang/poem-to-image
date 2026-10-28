import { SHARE_OWNER_KEY_PREFIX } from './copy';

export const PENDING_SHARE_KEY = 'inkpoem.share.pending.v1';

export interface PublishCredentials {
  id: string;
  deleteToken: string;
  fingerprint: string;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

function isCredentials(value: unknown): value is PublishCredentials {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PublishCredentials>;
  return typeof candidate.id === 'string' && ID_PATTERN.test(candidate.id)
    && typeof candidate.deleteToken === 'string' && TOKEN_PATTERN.test(candidate.deleteToken)
    && typeof candidate.fingerprint === 'string' && FINGERPRINT_PATTERN.test(candidate.fingerprint);
}

export class PendingShareConflict extends Error {
  constructor(public readonly pending: PublishCredentials) {
    super('PENDING_SHARE_UNRESOLVED');
  }
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (item) => item.toString(16).padStart(2, '0')).join('');
}

async function shaHex(data: ArrayBuffer | string): Promise<string> {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, '0')).join('');
}

/** Bind the pending publication to its exact images and visible metadata. */
export async function fingerprintArtwork(
  artwork: Blob, card: Blob, title: string, author: string,
): Promise<string> {
  const [imageHash, cardHash] = await Promise.all([
    artwork.arrayBuffer().then(shaHex),
    card.arrayBuffer().then(shaHex),
  ]);
  return shaHex(JSON.stringify([title.trim() || 'Untitled poem', author.trim(), artwork.type, imageHash, cardHash]));
}

export function pendingCredentials(storage: Pick<Storage, 'getItem'>): PublishCredentials | null {
  try {
    const raw = storage.getItem(PENDING_SHARE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCredentials(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Creates a 72-bit ID and 256-bit revocation capability and persists BOTH
 * before a single network byte is uploaded. A lost POST response can always
 * be retried using the same credentials. Refuse to silently replace a pending
 * request for different artwork.
 */
export function preparePublishCredentials(storage: Storage, fingerprint: string): PublishCredentials {
  if (!FINGERPRINT_PATTERN.test(fingerprint)) throw new Error('INVALID_FINGERPRINT');
  const previous = pendingCredentials(storage);
  if (previous && previous.fingerprint !== fingerprint) {
    throw new PendingShareConflict(previous);
  }
  const created = !previous;
  const credentials = previous ?? { id: randomId(), deleteToken: randomToken(), fingerprint };
  const ownerKey = SHARE_OWNER_KEY_PREFIX + credentials.id;
  const existingOwner = storage.getItem(ownerKey);
  if (existingOwner && existingOwner !== credentials.deleteToken) {
    throw new Error('STORAGE_OWNER_CONFLICT');
  }
  try {
    storage.setItem(ownerKey, credentials.deleteToken);
    if (storage.getItem(ownerKey) !== credentials.deleteToken) throw new Error('OWNER_TOKEN_UNSAVED');
    storage.setItem(PENDING_SHARE_KEY, JSON.stringify(credentials));
    if (storage.getItem(PENDING_SHARE_KEY) !== JSON.stringify(credentials)) {
      throw new Error('PENDING_ID_UNSAVED');
    }
    return credentials;
  } catch {
    // A failed reservation has not called the server. Only remove data that
    // this attempt created, never an older pending publication.
    if (created) {
      try { storage.removeItem(ownerKey); } catch { /* private storage denied */ }
    }
    throw new Error('STORAGE_UNAVAILABLE');
  }
}

export function completePublishCredentials(storage: Storage, credentials: PublishCredentials): void {
  const pending = pendingCredentials(storage);
  if (pending?.id === credentials.id && pending.deleteToken === credentials.deleteToken) {
    try { storage.removeItem(PENDING_SHARE_KEY); } catch { /* retry remains idempotent */ }
  }
}

/** Only clear the creator capability when the server confirms revocation. */
export function removePublishCredentials(storage: Storage, id: string, deleteToken: string): void {
  try {
    if (storage.getItem(SHARE_OWNER_KEY_PREFIX + id) === deleteToken) {
      storage.removeItem(SHARE_OWNER_KEY_PREFIX + id);
    }
  } catch { /* storage access denied */ }
  // A failed owner-key removal must not also keep an obsolete pending record.
  try {
    const pending = pendingCredentials(storage);
    if (pending?.id === id && pending.deleteToken === deleteToken) {
      storage.removeItem(PENDING_SHARE_KEY);
    }
  } catch { /* storage access denied */ }
}

/**
 * Revocation has already succeeded on the server. Browser policy may deny
 * even reading the localStorage property; that must never undo the successful
 * UI transition or cause a spurious "revoke failed" message.
 */
export function removePublishCredentialsSafely(
  id: string, deleteToken: string,
  getStorage: () => Storage = () => window.localStorage,
): void {
  try {
    removePublishCredentials(getStorage(), id, deleteToken);
  } catch { /* storage denied: the server remains the source of truth */ }
}
