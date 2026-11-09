import type {
  PoemContentData,
  PoemLayerStyle,
  TemplateBackgroundConfig,
  TemplateDecorationsConfig,
  TemplateTypographyConfig,
} from './types';

const DB_NAME = 'inkpoem-editor-drafts';
const DB_VERSION = 1;
const DOCUMENT_STORE = 'documents';
const ASSET_STORE = 'assets';
const DOCUMENT_KEY = 'current';
const ASSET_PREFIX = 'draft-asset:';
const LEGACY_KEY = 'inkpoem.editor-state.v1';
const LEGACY_LIMIT_BYTES = 3_000_000;
const EMERGENCY_KEY = 'inkpoem.editor-pending.v2';

/** The complete artwork, not a representation with image layers removed. */
export interface EditorDraftState {
  poem: PoemContentData;
  poemStyle: PoemLayerStyle;
  canvasWidth: number;
  canvasHeight: number;
  presetSize?: string;
  background: TemplateBackgroundConfig;
  typography: TemplateTypographyConfig;
  decorations: TemplateDecorationsConfig;
}

interface StoredDraft {
  version: 2;
  revision: number;
  scene: EditorDraftState;
}

interface Asset {
  key: string;
  blob: Blob;
}

export interface LoadedEditorDraft {
  state: EditorDraftState | null;
  revision: number;
  objectUrls: string[];
  recoveredPending: boolean;
}

export class DraftConflictError extends Error {
  constructor() {
    super('DRAFT_CONFLICT');
    this.name = 'DraftConflictError';
  }
}

// Generated object URLs are process-local; keep their asset IDs for subsequent
// saves without re-encoding or duplicating the already stored image.
const liveAssets = new Map<string, Asset>();

/** Retain the binary behind a new object URL even if navigation revokes it. */
export function registerDraftAssetObjectUrl(url: string, blob: Blob): void {
  if (url.startsWith('blob:')) liveAssets.set(url, { key: crypto.randomUUID(), blob });
}

function isDraftState(value: unknown): value is EditorDraftState {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<EditorDraftState>;
  return !!draft.poem && typeof draft.poem.title === 'string'
    && typeof draft.poem.author === 'string' && typeof draft.poem.body === 'string'
    && !!draft.poemStyle && typeof draft.poemStyle === 'object'
    && typeof draft.canvasWidth === 'number' && Number.isFinite(draft.canvasWidth)
    && typeof draft.canvasHeight === 'number' && Number.isFinite(draft.canvasHeight)
    && !!draft.background && typeof draft.background === 'object'
    && !!draft.typography && typeof draft.typography === 'object'
    && !!draft.decorations && Array.isArray(draft.decorations.logos)
    && Array.isArray(draft.decorations.customTexts)
    && (draft.decorations.signatures === undefined || Array.isArray(draft.decorations.signatures));
}

function isStoredDraft(value: unknown): value is StoredDraft {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<StoredDraft>;
  return record.version === 2 && typeof record.revision === 'number'
    && Number.isSafeInteger(record.revision) && record.revision >= 1
    && isDraftState(record.scene);
}

function legacyDraft(): EditorDraftState | null {
  const raw = window.localStorage.getItem(LEGACY_KEY);
  if (raw === null) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('LEGACY_DRAFT_INVALID');
  }
  if (!isDraftState(decoded)) throw new Error('LEGACY_DRAFT_INVALID');
  return {
    ...decoded,
    decorations: { ...decoded.decorations, signatures: decoded.decorations.signatures ?? [] },
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('DRAFT_STORAGE_UNAVAILABLE'));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DOCUMENT_STORE)) database.createObjectStore(DOCUMENT_STORE);
      if (!database.objectStoreNames.contains(ASSET_STORE)) database.createObjectStore(ASSET_STORE);
    };
    request.onerror = () => reject(request.error ?? new Error('DRAFT_OPEN_FAILED'));
    request.onblocked = () => reject(new Error('DRAFT_OPEN_BLOCKED'));
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

function resourceId(url: string | null | undefined): string | null {
  return url?.startsWith(ASSET_PREFIX) ? url.slice(ASSET_PREFIX.length) : null;
}

function referencedAssetIds(scene: EditorDraftState): Set<string> {
  const ids = new Set<string>();
  const urls = [
    scene.background.backgroundImage,
    ...scene.decorations.logos.map((logo) => logo.imageUrl),
  ];
  for (const url of urls) {
    const id = resourceId(url);
    if (id) ids.add(id);
  }
  return ids;
}

async function readStoredDraft(): Promise<{ record: StoredDraft | null; blobs: Map<string, Blob> }> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const blobs = new Map<string, Blob>();
    let record: StoredDraft | null = null;
    let failure: Error | null = null;
    const tx = db.transaction([DOCUMENT_STORE, ASSET_STORE], 'readonly');
    const request = tx.objectStore(DOCUMENT_STORE).get(DOCUMENT_KEY);
    request.onsuccess = () => {
      if (request.result === undefined) return;
      if (!isStoredDraft(request.result)) {
        failure = new Error('DRAFT_INVALID');
        tx.abort();
        return;
      }
      const stored = request.result as StoredDraft;
      record = stored;
      for (const id of referencedAssetIds(stored.scene)) {
        const assetRequest = tx.objectStore(ASSET_STORE).get(id);
        assetRequest.onsuccess = () => {
          if (!(assetRequest.result instanceof Blob)) {
            failure = new Error('DRAFT_ASSET_MISSING');
            tx.abort();
          } else {
            blobs.set(id, assetRequest.result);
          }
        };
      }
    };
    tx.oncomplete = () => { db.close(); resolve({ record, blobs }); };
    tx.onerror = () => { failure ??= tx.error ?? new Error('DRAFT_READ_FAILED'); };
    tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error('DRAFT_READ_FAILED')); };
  });
}

/**
 * Boot must finish before mounting the editor, otherwise its first auto-save
 * could replace a newer IndexedDB scene with the default editor scene.
 * On corruption/unavailable storage, reject: callers must not auto-save a
 * partial fallback over the existing document.
 */
interface EmergencyDraft {
  version: 1;
  baseRevision: number;
  scene: EditorDraftState;
}

/** Synchronous, small metadata-only checkpoint for navigation during debounce. */
export function checkpointEditorDraft(scene: EditorDraftState, baseRevision: number): void {
  const urls = [scene.background.backgroundImage, ...scene.decorations.logos.map((item) => item.imageUrl)];
  if (urls.some((url) => url?.startsWith('blob:') || url?.startsWith('data:'))) return;
  try {
    const serialized = JSON.stringify({ version: 1, baseRevision, scene } satisfies EmergencyDraft);
    if (new TextEncoder().encode(serialized).byteLength <= LEGACY_LIMIT_BYTES) {
      window.localStorage.setItem(EMERGENCY_KEY, serialized);
    }
  } catch {
    // The persistent save will surface its own failure; this is a best effort
    // checkpoint for small metadata-only changes in browsers exiting early.
  }
}

function pendingEmergencyDraft(revision: number): EditorDraftState | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(EMERGENCY_KEY);
  } catch {
    // A valid IndexedDB document must remain readable when localStorage is
    // disabled by browser policy. The emergency mirror is optional.
    return null;
  }
  if (!raw) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('DRAFT_RECOVERY_INVALID');
  }
  if (!decoded || typeof decoded !== 'object') throw new Error('DRAFT_RECOVERY_INVALID');
  const entry = decoded as Partial<EmergencyDraft>;
  if (entry.version !== 1 || !Number.isSafeInteger(entry.baseRevision)
    || !isDraftState(entry.scene)) throw new Error('DRAFT_RECOVERY_INVALID');
  // A newer committed document wins over an old tab's crash checkpoint.
  if (entry.baseRevision !== revision) return null;
  return {
    ...entry.scene,
    decorations: { ...entry.scene.decorations, signatures: entry.scene.decorations.signatures ?? [] },
  };
}

export async function loadEditorDraft(): Promise<LoadedEditorDraft> {
  const { record, blobs } = await readStoredDraft();
  const pending = pendingEmergencyDraft(record?.revision ?? 0);
  if (!record) return {
    state: pending ?? legacyDraft(),
    revision: 0, objectUrls: [], recoveredPending: pending !== null,
  };

  const urlById = new Map<string, string>();
  const objectUrls: string[] = [];
  try {
    for (const [id, blob] of blobs) {
      const url = URL.createObjectURL(blob);
      urlById.set(id, url);
      objectUrls.push(url);
      liveAssets.set(url, { key: id, blob });
    }
    const hydrateUrl = (url: string | null | undefined): string | null => {
      const id = resourceId(url);
      if (!id) return url ?? null;
      const hydrated = urlById.get(id);
      if (!hydrated) throw new Error('DRAFT_ASSET_MISSING');
      return hydrated;
    };
    return {
      state: pending ?? {
        ...record.scene,
        background: {
          ...record.scene.background,
          backgroundImage: hydrateUrl(record.scene.background.backgroundImage),
        },
        decorations: {
          ...record.scene.decorations,
          logos: record.scene.decorations.logos.map((logo) => ({
            ...logo, imageUrl: hydrateUrl(logo.imageUrl) ?? '',
          })),
        },
      },
      revision: record.revision,
      objectUrls,
      recoveredPending: pending !== null,
    };
  } catch (error) {
    releaseDraftObjectUrls(objectUrls);
    throw error;
  }
}

export function releaseDraftObjectUrls(urls: string[]): void {
  for (const url of urls) {
    // A detached editor may still have a background save in flight. Keep the
    // binary cached for that save; the page lifetime bounds this cache.
    URL.revokeObjectURL(url);
  }
}

async function persistUrl(url: string | null | undefined, assets: Map<string, Blob>): Promise<string | null> {
  if (!url || (!url.startsWith('blob:') && !url.startsWith('data:'))) return url ?? null;
  let asset = liveAssets.get(url);
  if (!asset) {
    // Blob and data URLs are only valid in their creating browser session.
    // Resolve all of them before opening the short-lived IndexedDB transaction.
    const response = await fetch(url);
    if (!response.ok) throw new Error('DRAFT_ASSET_UNREADABLE');
    const blob = await response.blob();
    if (!blob.size) throw new Error('DRAFT_ASSET_UNREADABLE');
    asset = { key: crypto.randomUUID(), blob };
    liveAssets.set(url, asset);
  }
  assets.set(asset.key, asset.blob);
  return ASSET_PREFIX + asset.key;
}

async function prepareStoredScene(scene: EditorDraftState): Promise<{ scene: EditorDraftState; assets: Map<string, Blob> }> {
  const assets = new Map<string, Blob>();
  const [backgroundImage, logos] = await Promise.all([
    persistUrl(scene.background.backgroundImage, assets),
    Promise.all(scene.decorations.logos.map(async (logo) => ({
      ...logo,
      imageUrl: (await persistUrl(logo.imageUrl, assets)) ?? '',
    }))),
  ]);
  return {
    scene: {
      ...scene,
      background: { ...scene.background, backgroundImage },
      decorations: { ...scene.decorations, logos },
    },
    assets,
  };
}

function mirrorLegacyWithoutAssets(scene: EditorDraftState): void {
  // Preserve old versions' fast metadata recovery without writing broken blob
  // URLs or exceeding localStorage limits. IndexedDB is the authoritative copy.
  const urls = [scene.background.backgroundImage, ...scene.decorations.logos.map((logo) => logo.imageUrl)];
  if (urls.some((url) => url?.startsWith('blob:') || url?.startsWith('data:'))) return;
  try {
    const serialized = JSON.stringify(scene);
    if (new TextEncoder().encode(serialized).byteLength <= LEGACY_LIMIT_BYTES) {
      window.localStorage.setItem(LEGACY_KEY, serialized);
    }
  } catch {
    // The IndexedDB transaction already committed. LocalStorage is optional.
  }
}

/** Atomic document + asset replacement, with an optimistic tab-safe revision. */
export async function saveEditorDraft(scene: EditorDraftState, expectedRevision: number): Promise<number> {
  const prepared = await prepareStoredScene(scene);
  const db = await openDatabase();
  const nextRevision = expectedRevision + 1;
  await new Promise<void>((resolve, reject) => {
    let failure: Error | null = null;
    const tx = db.transaction([DOCUMENT_STORE, ASSET_STORE], 'readwrite');
    const docs = tx.objectStore(DOCUMENT_STORE);
    const assets = tx.objectStore(ASSET_STORE);
    const read = docs.get(DOCUMENT_KEY);
    read.onsuccess = () => {
      const existing: unknown = read.result;
      if (existing !== undefined && !isStoredDraft(existing)) {
        failure = new Error('DRAFT_INVALID');
        tx.abort();
        return;
      }
      const previous = existing as StoredDraft | undefined;
      if ((previous?.revision ?? 0) !== expectedRevision) {
        failure = new DraftConflictError();
        tx.abort();
        return;
      }
      const newIds = referencedAssetIds(prepared.scene);
      for (const [id, blob] of prepared.assets) assets.put(blob, id);
      if (previous) {
        for (const oldId of referencedAssetIds(previous.scene)) {
          if (!newIds.has(oldId)) assets.delete(oldId);
        }
      }
      docs.put({ version: 2, revision: nextRevision, scene: prepared.scene } satisfies StoredDraft, DOCUMENT_KEY);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { failure ??= tx.error ?? new Error('DRAFT_WRITE_FAILED'); };
    tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error('DRAFT_WRITE_FAILED')); };
  });
  mirrorLegacyWithoutAssets(scene);
  return nextRevision;
}
