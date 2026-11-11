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

// A URL remains usable while the active editor/undo history or an in-flight
// write owns it. Never revoke it merely because React replays an effect.
const liveAssets = new Map<string, Asset>();
const editorReferences = new Map<string, Set<string>>();
const saveReferences = new Map<string, number>();
// Uploads are staged synchronously before React can commit their new URL.
// The editor's history lease adopts them after commit; until then an unrelated
// save is never allowed to revoke their URL or discard their Blob.
const stagedAssets = new Set<string>();

/**
 * A same-tab SPA route change does not fire beforeunload. Keep the *entire*
 * dirty scene and its binary owners across route unmounts until a detached
 * save succeeds or a new editor has adopted the recovered scene.
 */
interface DetachedNavigationDraft {
  id: number;
  scene: EditorDraftState;
  baseRevision: number;
  release: () => void;
  flush: Promise<void> | null;
  offeredForAdoption: boolean;
}
let detachedNavigationDraft: DetachedNavigationDraft | null = null;
let nextDetachedNavigationId = 0;

function forgetDetachedNavigationDraft(id: number): void {
  if (detachedNavigationDraft?.id !== id) return;
  const old = detachedNavigationDraft;
  detachedNavigationDraft = null;
  old.release();
}

export function retainDraftForNavigation(scene: EditorDraftState, baseRevision: number): number {
  // Acquire the new binary lease *before* releasing an older one.
  const release = pinSaveAssets(scene);
  const previous = detachedNavigationDraft;
  const id = ++nextDetachedNavigationId;
  detachedNavigationDraft = {
    id, scene, baseRevision, release, flush: null, offeredForAdoption: false,
  };
  previous?.release();
  return id;
}

export function trackNavigationDraftFlush(id: number, flush: Promise<void>): void {
  if (detachedNavigationDraft?.id === id) detachedNavigationDraft.flush = flush;
}

export function noteNavigationDraftSaved(id: number, revision: number, fullySaved: boolean): void {
  if (detachedNavigationDraft?.id !== id) return;
  if (fullySaved) forgetDetachedNavigationDraft(id);
  else detachedNavigationDraft.baseRevision = revision;
}

export function discardSavedNavigationDraft(id: number): void {
  forgetDetachedNavigationDraft(id);
}

function sceneAssetUrls(scene: EditorDraftState): string[] {
  return [scene.background.backgroundImage, ...scene.decorations.logos.map((logo) => logo.imageUrl)]
    .filter((url): url is string => typeof url === 'string' && (url.startsWith('blob:') || url.startsWith('data:')));
}

function pruneUnusedAssets(): void {
  const retained = new Set(stagedAssets);
  for (const urls of editorReferences.values()) for (const url of urls) retained.add(url);
  for (const url of saveReferences.keys()) retained.add(url);
  for (const url of liveAssets.keys()) {
    if (retained.has(url)) continue;
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    liveAssets.delete(url);
  }
}

export function retainEditorDraftAssets(editorId: string, urls: Iterable<string>): void {
  const ownedUrls = new Set(urls);
  // Atomically transfer staging ownership to the committed editor/history.
  editorReferences.set(editorId, ownedUrls);
  for (const url of ownedUrls) stagedAssets.delete(url);
  // Only the just-mounted editor with *all* the recovered image references may
  // take over this lease; a previously mounted editor cannot clear it.
  const detached = detachedNavigationDraft;
  if (detached?.offeredForAdoption
    && sceneAssetUrls(detached.scene).every((url) => ownedUrls.has(url))) {
    forgetDetachedNavigationDraft(detached.id);
  }
  pruneUnusedAssets();
}

export function releaseEditorDraftAssets(editorId: string): void {
  editorReferences.delete(editorId);
  pruneUnusedAssets();
}

/** Register ownership *before* scheduling React state updates. */
export function registerDraftAssetObjectUrl(url: string, blob: Blob): void {
  if (!url.startsWith('blob:')) return;
  liveAssets.set(url, { key: crypto.randomUUID(), blob });
  stagedAssets.add(url);
}

/**
 * Discard an upload that never became the current editor scene. If the URL
 * was already adopted by history or pinned by a save, those owners keep it.
 */
export function discardDraftAssetRegistration(url: string): void {
  if (stagedAssets.delete(url)) pruneUnusedAssets();
}

/** Hold the latest unsaved scene across unmount and any detached save chain. */
export function pinDraftAssetSnapshot(scene: EditorDraftState): () => void {
  return pinSaveAssets(scene);
}

function pinSaveAssets(scene: EditorDraftState): () => void {
  const urls = sceneAssetUrls(scene);
  for (const url of urls) saveReferences.set(url, (saveReferences.get(url) ?? 0) + 1);
  return () => {
    for (const url of urls) {
      const remaining = (saveReferences.get(url) ?? 1) - 1;
      if (remaining > 0) saveReferences.set(url, remaining);
      else saveReferences.delete(url);
    }
    pruneUnusedAssets();
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasFields(
  value: unknown,
  strings: readonly string[] = [],
  numbers: readonly string[] = [],
  booleans: readonly string[] = [],
): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return strings.every((key) => typeof value[key] === 'string')
    && numbers.every((key) => {
      const entry = value[key];
      return typeof entry === 'number' && Number.isFinite(entry);
    })
    && booleans.every((key) => typeof value[key] === 'boolean');
}

function optionalField(value: Record<string, unknown>, key: string, type: 'string' | 'number'): boolean {
  const entry = value[key];
  return entry === undefined || (type === 'string' ? typeof entry === 'string'
    : typeof entry === 'number' && Number.isFinite(entry));
}

function hasValidAssetReference(value: unknown): boolean {
  // draft-asset: with no ID cannot be resolved, so never mount it as an image.
  return typeof value !== 'string' || !value.startsWith(ASSET_PREFIX)
    || value.length > ASSET_PREFIX.length;
}

function isDraftState(value: unknown): value is EditorDraftState {
  if (!isRecord(value)) return false;
  const { poem, poemStyle, background, typography, decorations } = value;
  if (!hasFields(poem, ['title', 'author', 'body', 'sourceNote'])) return false;
  if (!hasFields(poemStyle,
    ['titleAlign', 'titlePlacement', 'bodyAlign', 'authorAlign', 'authorPlacement', 'sourceAlign', 'sourcePlacement'],
    ['titleScale', 'titleOpacity', 'titleLineHeight', 'titleLetterSpacing', 'titleBodyGap',
      'bodyLineHeight', 'bodyLetterSpacing', 'authorScale', 'authorOpacity', 'authorLineHeight',
      'authorLetterSpacing', 'authorBodyGap', 'sourceScale', 'sourceOpacity', 'sourceLineHeight',
      'sourceLetterSpacing', 'sourceGap'])) return false;
  if (!hasFields(value, [], ['canvasWidth', 'canvasHeight'])
    || !optionalField(value, 'presetSize', 'string')) return false;
  if (!hasFields(background,
    ['backgroundType', 'backgroundColor', 'gradientColor1', 'gradientColor2', 'gradientDirection'],
    ['bgBrightness', 'bgBlur'])
    || !optionalField(background, 'paperId', 'string')
    || !optionalField(background, 'backgroundPosition', 'string')
    || !optionalField(background, 'backgroundSize', 'string')
    || (background.backgroundImage !== undefined && background.backgroundImage !== null
      && typeof background.backgroundImage !== 'string')
    || !hasValidAssetReference(background.backgroundImage)
    || (background.backgroundImageSource !== undefined && background.backgroundImageSource !== null
      && typeof background.backgroundImageSource !== 'string')) return false;
  if (!hasFields(typography,
    ['fontFamily', 'textColor', 'textAlign', 'writingMode', 'textShadowColor'],
    ['fontSize', 'padding', 'lineHeight', 'letterSpacing', 'columns', 'columnGap',
      'textShadowBlur', 'textShadowOffsetY', 'textShadowOffsetX'],
    ['textShadowEnabled'])) return false;
  if (!hasFields(decorations, ['borderStyle'], [], ['showBorder', 'showStamp'])
    || !optionalField(decorations, 'borderColor', 'string')
    || !optionalField(decorations, 'borderWidth', 'number')
    || !hasFields(decorations.stamp, ['text', 'style', 'fontFamily'],
      ['positionX', 'positionY', 'size', 'rotation', 'opacity'])
    || !hasFields(decorations.poemPosition, [], ['positionX', 'positionY'])
    || !Array.isArray(decorations.customTexts)
    || !Array.isArray(decorations.logos)
    || (decorations.signatures !== undefined && !Array.isArray(decorations.signatures))) return false;
  const stamp = decorations.stamp;
  const position = decorations.poemPosition;
  if (!optionalField(stamp, 'colorScheme', 'string')
    || !optionalField(stamp, 'inkColor', 'string')
    || !optionalField(stamp, 'weathering', 'number')
    || !optionalField(stamp, 'textScale', 'number')
    || !optionalField(stamp, 'textStrokeWidthPct', 'number')
    || (stamp.textureStyle !== undefined && stamp.textureStyle !== 'classic' && stamp.textureStyle !== 'natural')
    || (stamp.textureSeed !== undefined && (typeof stamp.textureSeed !== 'number'
      || !Number.isInteger(stamp.textureSeed) || stamp.textureSeed < 0 || stamp.textureSeed > 0xffffffff))
    || !optionalField(position, 'exportLeft', 'number')
    || !optionalField(position, 'exportTop', 'number')
    || !optionalField(position, 'boxWidth', 'number')) return false;
  if (!decorations.customTexts.every((item: unknown) => hasFields(item, ['id', 'text', 'color', 'writingMode'],
    ['fontSize', 'rotation', 'positionX', 'positionY'])
    && ['zIndex', 'exportLeft', 'exportTop', 'boxWidth'].every((key) => optionalField(item, key, 'number')))) return false;
  if (!decorations.logos.every((item: unknown) => hasFields(item, ['id', 'imageUrl'],
    ['positionX', 'positionY', 'size', 'rotation', 'opacity'])
    && hasValidAssetReference(item.imageUrl)
    && ['zIndex', 'exportLeft', 'exportTop'].every((key) => optionalField(item, key, 'number')))) return false;
  return (decorations.signatures ?? []).every((item: unknown) => hasFields(item,
    ['id', 'text', 'font', 'color', 'flourish'],
    ['fontSize', 'slant', 'thickness', 'positionX', 'positionY', 'opacity', 'rotation'])
    && optionalField(item, 'zIndex', 'number'));
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
  // Let the previous route's detached write finish before selecting a source.
  // Failure retains the in-memory scene; success reloads its committed revision.
  const detached = detachedNavigationDraft;
  if (detached?.flush) await detached.flush.catch(() => undefined);
  const retained = detachedNavigationDraft;
  if (retained) {
    // A detached write may have failed because IndexedDB is unavailable.
    // Recover the in-memory scene BEFORE trying to read the same broken store.
    // Its saved base revision still enforces optimistic conflict detection
    // once writes become available again.
    retained.offeredForAdoption = true;
    return {
      state: retained.scene,
      revision: retained.baseRevision,
      objectUrls: [],
      recoveredPending: true,
    };
  }
  const { record, blobs } = await readStoredDraft();
  const pending = pendingEmergencyDraft(record?.revision ?? 0);
  if (!record) return {
    state: pending ?? legacyDraft(),
    revision: 0, objectUrls: [], recoveredPending: pending !== null,
  };
  // Metadata-only checkpoint recovery needs no hydrated binary URLs. Creating
  // them only to discard them leaves an unowned Blob cache behind.
  if (pending) return {
    state: pending,
    revision: record.revision,
    objectUrls: [],
    recoveredPending: true,
  };

  const urlById = new Map<string, string>();
  const objectUrls: string[] = [];
  try {
    for (const [id, blob] of blobs) {
      const url = URL.createObjectURL(blob);
      urlById.set(id, url);
      objectUrls.push(url);
      liveAssets.set(url, { key: id, blob });
      // Boot loading is asynchronous too; an older editor save can finish
      // before this newly created URL is adopted by React's editor history.
      stagedAssets.add(url);
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
  // Used for cancelled boot loads, before an editor can own these URLs.
  for (const url of urls) {
    stagedAssets.delete(url);
    URL.revokeObjectURL(url);
    liveAssets.delete(url);
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
  // Acquire binary ownership synchronously, before the first await. Unmounts
  // may release their history while this detached transaction is in progress.
  const unpin = pinSaveAssets(scene);
  try {
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
  } finally {
    unpin();
  }
}
