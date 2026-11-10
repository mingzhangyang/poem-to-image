import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeUserCustomTemplate } from '../poemStyle';
import { createAsyncIntentGate } from '../asyncIntentGate';
import { templateReadReconciliationStatus } from '../templateReadReconciliation';
import {
  createTemplateScopeLifetime,
  enqueueTemplateMutation,
  isCurrentTemplateScopeLifetime,
  type TemplateScopeLifetime,
} from '../templateScopeLifetime';
import { getPaperStyle } from '../paperStyles';
import {
  canImportLegacyGuestTemplates,
  hasLegacyTemplateCache,
  isWritableTemplateScope,
  importLegacyGuestTemplates,
  readTemplateCache,
  resolveTemplateScope,
  writeTemplateCache,
  type TemplateScope,
} from '../customTemplateCache';
import {
  createCloudTemplate,
  deleteCloudTemplate,
  fetchCloudTemplates,
  renameCloudTemplate,
  type TemplateRequestOwner,
} from '../customTemplateApi';
import type {
  UserCustomTemplate,
  TemplateBackgroundConfig,
  TemplateTypographyConfig,
  TemplateDecorationsConfig,
  TemplateReconciliationStatus,
} from '../types';

type TemplateSyncError = 'load' | 'mutation' | 'storage' | null;

interface ScopeView {
  scope: TemplateScope | null;
  templates: UserCustomTemplate[];
  activeId: string | null;
  syncError: TemplateSyncError;
  isSyncing: boolean;
  reconciliationStatus: TemplateReconciliationStatus;
  cacheCorrupt: boolean;
  // True if the newest guest edits exist only in memory after a failed write.
  guestCacheDirty: boolean;
  hasLegacyCache: boolean;
}

function readScope(scope: TemplateScope | null): ScopeView {
  const empty: ScopeView = {
    scope, templates: [], activeId: null, syncError: null,
    isSyncing: false, reconciliationStatus: 'idle', cacheCorrupt: false, guestCacheDirty: false, hasLegacyCache: false,
  };
  if (!scope) return empty;
  try {
    const storage = window.localStorage;
    return {
      ...empty,
      templates: readTemplateCache(scope, storage),
      hasLegacyCache: scope === 'guest' && hasLegacyTemplateCache(storage),
    };
  } catch {
    return { ...empty, syncError: 'storage', cacheCorrupt: true };
  }
}

function deriveAccentColors(background: TemplateBackgroundConfig): { accentFrom: string; accentTo: string } {
  if (background.backgroundType === 'paper') {
    const base = getPaperStyle(background.paperId).base;
    return { accentFrom: base, accentTo: base };
  }
  if (background.backgroundType === 'gradient') {
    return { accentFrom: background.gradientColor1, accentTo: background.gradientColor2 };
  }
  return { accentFrom: background.backgroundColor, accentTo: background.backgroundColor };
}

interface UseCustomTemplatesParams {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  getToken: () => Promise<string | null>;
}

/**
 * Each account and the anonymous editor have separate caches. Remote fetches
 * are authoritative only if the same identity and mutation epoch still own
 * the response. Mutations to a given scope are serialized in call order.
 */
export function useCustomTemplates({ isLoaded, isSignedIn, userId, getToken }: UseCustomTemplatesParams) {
  const scope = resolveTemplateScope(isLoaded, isSignedIn, userId);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const scopeLifetimeRef = useRef(createTemplateScopeLifetime(scope));
  // Invalidate synchronously: an old A task cannot revive after A -> B -> A.
  if (scopeLifetimeRef.current.scope !== scope) {
    scopeLifetimeRef.current.active = false;
    scopeLifetimeRef.current = createTemplateScopeLifetime(scope);
  }
  const isLifetimeCurrent = useCallback((owner: TemplateScopeLifetime) =>
    isCurrentTemplateScopeLifetime(scopeLifetimeRef.current, owner)
    && scopeRef.current === owner.scope, []);
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const [view, setView] = useState<ScopeView>(() => readScope(scope));
  const viewRef = useRef(view);
  const [refreshId, setRefreshId] = useState(0);
  const readGateRef = useRef(createAsyncIntentGate());
  const pendingRequestsRef = useRef<Set<AbortController>>(new Set());
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const update = useCallback((
    ownerScope: TemplateScope | null,
    transform: (old: ScopeView) => ScopeView,
    persist = false,
  ) => {
    if (scopeRef.current !== ownerScope) return;
    const previous = viewRef.current.scope === ownerScope ? viewRef.current : readScope(ownerScope);
    let next = transform(previous);
    if (persist && ownerScope) {
      // A corrupt local cache is never silently replaced by guest edits. Cloud
      // success may safely replace a corrupt account cache, since it is the
      // authoritative snapshot from that same authenticated account.
      if (previous.cacheCorrupt && ownerScope === 'guest') {
        next = { ...previous, syncError: 'storage' };
      } else {
        try {
          writeTemplateCache(ownerScope, next.templates, window.localStorage);
          next = { ...next, cacheCorrupt: false, guestCacheDirty: false };
        } catch {
          // Keep the updated list in memory. A legacy import cannot read from
          // older disk state until these in-memory edits have been saved.
          next = { ...next, syncError: 'storage', guestCacheDirty: ownerScope === 'guest' };
        }
      }
    }
    viewRef.current = next;
    setView(next);
  }, []);

  // Clear state before any new identity's cloud request is allowed to resolve.
  useEffect(() => {
    // Rotate even on StrictMode effect replay, not just on changed scope.
    scopeLifetimeRef.current.active = false;
    const lifetime = createTemplateScopeLifetime(scope);
    scopeLifetimeRef.current = lifetime;
    readGateRef.current.invalidate();
    for (const controller of pendingRequestsRef.current) controller.abort();
    pendingRequestsRef.current.clear();
    // Old account mutations must not hold up new account operations.
    mutationQueueRef.current = Promise.resolve();
    const next = readScope(scope);
    viewRef.current = next;
    setView(next);
    return () => {
      lifetime.active = false;
      for (const controller of pendingRequestsRef.current) controller.abort();
      pendingRequestsRef.current.clear();
      readGateRef.current.invalidate();
    };
  }, [scope]);

  // An explicit retry is also a new read epoch. A failed GET retains cached
  // templates; only a well-formed 2xx response can replace them.
  useEffect(() => {
    if (!scope || scope === 'guest') return;
    const lifetime = scopeLifetimeRef.current;
    // Writes own reconciliation until the entire queue settles.
    if (!isLifetimeCurrent(lifetime) || lifetime.pendingMutations > 0) return;
    const controller = new AbortController();
    pendingRequestsRef.current.add(controller);
    const readEpoch = readGateRef.current.begin();
    const current = () => isLifetimeCurrent(lifetime) && !controller.signal.aborted
      && lifetime.pendingMutations === 0 && readGateRef.current.isCurrent(readEpoch);

    update(scope, (old) => ({
      ...old, isSyncing: true,
      reconciliationStatus: templateReadReconciliationStatus(old.syncError === 'mutation', 'checking'),
    }));
    const owner: TemplateRequestOwner = { getToken: () => tokenRef.current(), signal: controller.signal, isCurrent: current };
    void fetchCloudTemplates(owner).then((templates) => {
      if (!current()) return;
      update(scope, (old) => ({
        ...old, templates, isSyncing: false, syncError: old.syncError === 'mutation' ? 'mutation' : null, cacheCorrupt: false,
        reconciliationStatus: templateReadReconciliationStatus(old.syncError === 'mutation', 'refreshed'),
        activeId: old.activeId && templates.some((template) => template.id === old.activeId) ? old.activeId : null,
      }), true);
    }).catch(() => {
      if (!current()) return;
      update(scope, (old) => ({
        ...old, isSyncing: false, syncError: old.syncError === 'mutation' ? 'mutation' : old.cacheCorrupt ? 'storage' : 'load',
        reconciliationStatus: templateReadReconciliationStatus(old.syncError === 'mutation', 'failed'),
      }));
    }).finally(() => { pendingRequestsRef.current.delete(controller); });

    return () => {
      controller.abort();
      pendingRequestsRef.current.delete(controller);
    };
  }, [scope, refreshId, update, isLifetimeCurrent]);

  const startMutation = useCallback((ownerScope: TemplateScope) => {
    // A queued write invalidates all older GETs immediately.
    readGateRef.current.invalidate();
    update(ownerScope, (old) => ({ ...old, isSyncing: false,
      reconciliationStatus: old.syncError === 'mutation' ? 'pending' : 'idle',
    }));
  }, [update]);

  const ownerFor = useCallback((lifetime: TemplateScopeLifetime): {
    controller: AbortController;
    owner: TemplateRequestOwner;
  } => {
    const controller = new AbortController();
    pendingRequestsRef.current.add(controller);
    const isCurrent = () => isLifetimeCurrent(lifetime) && !controller.signal.aborted;
    return {
      controller,
      owner: { signal: controller.signal, isCurrent, getToken: () => tokenRef.current() },
    };
  }, [isLifetimeCurrent]);

  const confirmMutation = useCallback((lifetime: TemplateScopeLifetime) => {
    if (!isLifetimeCurrent(lifetime)) return false;
    // Invalidate a GET that may have begun after an earlier queued write.
    readGateRef.current.invalidate();
    return true;
  }, [isLifetimeCurrent]);

  const enqueue = useCallback(<T,>(
    lifetime: TemplateScopeLifetime, operation: () => Promise<T>, staleResult: T,
  ): Promise<T> => enqueueTemplateMutation(
    mutationQueueRef, lifetime, () => isLifetimeCurrent(lifetime),
    operation, staleResult, () => setRefreshId((current) => current + 1),
  ), [isLifetimeCurrent]);

  const setMutationError = useCallback((ownerScope: TemplateScope) => {
    update(ownerScope, (old) => ownerScope === 'guest'
      ? { ...old, isSyncing: false, syncError: 'storage', reconciliationStatus: 'idle' }
      : { ...old, isSyncing: false, syncError: 'mutation', reconciliationStatus: 'pending' });
  }, [update]);

  const saveCustomTemplate = useCallback(async (
    name: string,
    background: TemplateBackgroundConfig,
    typography: TemplateTypographyConfig,
    decorations: TemplateDecorationsConfig,
    poemStyle: UserCustomTemplate['poemStyle'],
    // The manager owns selection intent. Saving must never reactivate a stale
    // snapshot after the user has selected something else in the meantime.
    shouldActivate: () => boolean,
  ): Promise<UserCustomTemplate | null> => {
    const ownerScope = scopeRef.current;
    const lifetime = scopeLifetimeRef.current;
    if (!ownerScope || !isLifetimeCurrent(lifetime)
      || !isWritableTemplateScope(ownerScope, viewRef.current.scope, viewRef.current.cacheCorrupt)) return null;
    const { accentFrom, accentTo } = deriveAccentColors(background);
    const payload = {
      name: name.trim() || 'Custom Template',
      accentFrom, accentTo, background, typography, decorations, poemStyle,
    };
    startMutation(ownerScope);
    if (ownerScope === 'guest') {
      if (viewRef.current.cacheCorrupt) { setMutationError(ownerScope); return null; }
      const created = normalizeUserCustomTemplate({
        ...payload,
        id: `custom-${crypto.randomUUID()}`,
        createdAt: Date.now(),
      });
      update(ownerScope, (old) => ({
        ...old, templates: [created, ...old.templates],
        activeId: shouldActivate() ? created.id : old.activeId, syncError: null,
      }), true);
      return created;
    }
    return enqueue(lifetime, async () => {
      const { owner, controller } = ownerFor(lifetime);
      try {
        const saved = await createCloudTemplate(payload, owner);
        if (!owner.isCurrent() || !confirmMutation(lifetime)) return null;
        update(ownerScope, (old) => ({
          ...old,
          templates: [saved, ...old.templates.filter((item) => item.id !== saved.id)],
          activeId: shouldActivate() ? saved.id : old.activeId,
          syncError: null,
          isSyncing: false,
          reconciliationStatus: 'idle',
        }), true);
        return saved;
      } catch {
        if (owner.isCurrent()) setMutationError(ownerScope);
        return null;
      } finally {
        pendingRequestsRef.current.delete(controller);
      }
    }, null);
  }, [confirmMutation, enqueue, isLifetimeCurrent, ownerFor, setMutationError, startMutation, update]);

  const applyCustomTemplate = useCallback((id: string) => {
    const ownerScope = scopeRef.current;
    if (!ownerScope) return;
    update(ownerScope, (old) => old.templates.some((item) => item.id === id)
      ? { ...old, activeId: id } : old);
  }, [update]);

  const renameCustomTemplate = useCallback(async (id: string, name: string): Promise<void> => {
    const ownerScope = scopeRef.current;
    const lifetime = scopeLifetimeRef.current;
    const trimmedName = name.trim();
    if (!ownerScope || !isLifetimeCurrent(lifetime) || !trimmedName) return;
    if (!viewRef.current.templates.some((item) => item.id === id)) return;
    startMutation(ownerScope);
    if (ownerScope === 'guest') {
      if (viewRef.current.cacheCorrupt) { setMutationError(ownerScope); return; }
      update(ownerScope, (old) => ({
        ...old, templates: old.templates.map((item) => item.id === id ? { ...item, name: trimmedName } : item),
        syncError: null,
      }), true);
      return;
    }
    await enqueue(lifetime, async () => {
      const { owner, controller } = ownerFor(lifetime);
      try {
        await renameCloudTemplate(id, trimmedName, owner);
        if (!owner.isCurrent() || !confirmMutation(lifetime)) return;
        update(ownerScope, (old) => ({
          ...old, templates: old.templates.map((item) => item.id === id ? { ...item, name: trimmedName } : item),
          syncError: null, isSyncing: false, reconciliationStatus: 'idle',
        }), true);
      } catch {
        if (owner.isCurrent()) setMutationError(ownerScope);
      } finally {
        pendingRequestsRef.current.delete(controller);
      }
    }, undefined);
  }, [confirmMutation, enqueue, isLifetimeCurrent, ownerFor, setMutationError, startMutation, update]);

  const deleteCustomTemplate = useCallback(async (id: string): Promise<void> => {
    const ownerScope = scopeRef.current;
    const lifetime = scopeLifetimeRef.current;
    if (!ownerScope || !isLifetimeCurrent(lifetime)
      || !viewRef.current.templates.some((item) => item.id === id)) return;
    startMutation(ownerScope);
    if (ownerScope === 'guest') {
      if (viewRef.current.cacheCorrupt) { setMutationError(ownerScope); return; }
      update(ownerScope, (old) => ({
        ...old, templates: old.templates.filter((item) => item.id !== id),
        activeId: old.activeId === id ? null : old.activeId, syncError: null,
      }), true);
      return;
    }
    await enqueue(lifetime, async () => {
      const { owner, controller } = ownerFor(lifetime);
      try {
        await deleteCloudTemplate(id, owner);
        if (!owner.isCurrent() || !confirmMutation(lifetime)) return;
        update(ownerScope, (old) => ({
          ...old, templates: old.templates.filter((item) => item.id !== id),
          activeId: old.activeId === id ? null : old.activeId,
          syncError: null, isSyncing: false, reconciliationStatus: 'idle',
        }), true);
      } catch {
        if (owner.isCurrent()) setMutationError(ownerScope);
      } finally {
        pendingRequestsRef.current.delete(controller);
      }
    }, undefined);
  }, [confirmMutation, enqueue, isLifetimeCurrent, ownerFor, setMutationError, startMutation, update]);

  const clearActiveCustomTemplate = useCallback(() => {
    const ownerScope = scopeRef.current;
    update(ownerScope, (old) => ({ ...old, activeId: null }));
  }, [update]);

  const importLegacyTemplates = useCallback(() => {
    if (scopeRef.current !== 'guest') return;
    // A previous quota/write failure can leave newer creates, renames or
    // deletes only in memory. Importing from disk would silently discard them.
    // The Retry sync action persists the current in-memory view first.
    if (!canImportLegacyGuestTemplates(viewRef.current)) {
      update('guest', (old) => ({ ...old, syncError: 'storage' }));
      return;
    }
    try {
      const templates = importLegacyGuestTemplates(window.localStorage);
      update('guest', (old) => ({
        ...old, templates, hasLegacyCache: false, syncError: null,
      }));
    } catch {
      update('guest', (old) => ({ ...old, syncError: 'storage' }));
    }
  }, [update]);

  const retryTemplateSync = useCallback(() => {
    const ownerScope = scopeRef.current;
    if (!ownerScope) return;
    if (ownerScope === 'guest') {
      if (viewRef.current.cacheCorrupt) {
        // Re-read only; never overwrite the invalid local record.
        const next = readScope(ownerScope);
        viewRef.current = next;
        setView(next);
        return;
      }
      update(ownerScope, (old) => ({ ...old, syncError: null }), true);
      return;
    }
    setRefreshId((current) => current + 1);
  }, [update]);

  // Never expose a previous identity's template list during Clerk account
  // transitions or auth-loading, even for one React render.
  // Explicit view type avoids string widening of reconciliationStatus when
  // auth is changing and the redacted view replaces the old account view.
  const visible: ScopeView = view.scope === scope ? view : {
    ...view, scope, templates: [], activeId: null,
    isSyncing: true, syncError: null, reconciliationStatus: 'idle', hasLegacyCache: false,
  };
  return {
    customTemplates: visible.templates,
    activeCustomTemplateId: visible.activeId,
    syncError: visible.syncError,
    isSyncing: visible.isSyncing,
    reconciliationStatus: visible.reconciliationStatus,
    // Compute readiness from the actual committed view, not the redacted
    // placeholder used during identity transitions.
    canSaveCustomTemplate: isWritableTemplateScope(scope, view.scope, view.cacheCorrupt),
    hasLegacyCache: visible.hasLegacyCache,
    canImportLegacyCustomTemplates: canImportLegacyGuestTemplates(visible),
    isGuest: scope === 'guest',
    retryTemplateSync,
    importLegacyTemplates,
    saveCustomTemplate,
    applyCustomTemplate,
    renameCustomTemplate,
    deleteCustomTemplate,
    clearActiveCustomTemplate,
  };
}
