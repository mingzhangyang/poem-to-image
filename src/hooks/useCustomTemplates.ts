import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeUserCustomTemplate } from '../poemStyle';
import { getPaperStyle } from '../paperStyles';
import {
  hasLegacyTemplateCache,
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
} from '../types';

type TemplateSyncError = 'load' | 'mutation' | 'storage' | null;

interface ScopeView {
  scope: TemplateScope | null;
  templates: UserCustomTemplate[];
  activeId: string | null;
  syncError: TemplateSyncError;
  isSyncing: boolean;
  cacheCorrupt: boolean;
  hasLegacyCache: boolean;
}

function readScope(scope: TemplateScope | null): ScopeView {
  const empty: ScopeView = {
    scope, templates: [], activeId: null, syncError: null,
    isSyncing: false, cacheCorrupt: false, hasLegacyCache: false,
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
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const [view, setView] = useState<ScopeView>(() => readScope(scope));
  const viewRef = useRef(view);
  const [refreshId, setRefreshId] = useState(0);
  const fetchEpochRef = useRef(0);
  const mutationEpochRef = useRef(0);
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
          next = { ...next, cacheCorrupt: false };
        } catch {
          // Keep the updated list in memory; make loss of warm-cache durability
          // visible rather than pretending the local save succeeded.
          next = { ...next, syncError: 'storage' };
        }
      }
    }
    viewRef.current = next;
    setView(next);
  }, []);

  // Clear state before any new identity's cloud request is allowed to resolve.
  useEffect(() => {
    fetchEpochRef.current += 1;
    mutationEpochRef.current += 1;
    for (const controller of pendingRequestsRef.current) controller.abort();
    pendingRequestsRef.current.clear();
    // Old account mutations must not hold up new account operations.
    mutationQueueRef.current = Promise.resolve();
    const next = readScope(scope);
    viewRef.current = next;
    setView(next);
    return () => {
      for (const controller of pendingRequestsRef.current) controller.abort();
      pendingRequestsRef.current.clear();
      fetchEpochRef.current += 1;
    };
  }, [scope]);

  // An explicit retry is also a new read epoch. A failed GET retains cached
  // templates; only a well-formed 2xx response can replace them.
  useEffect(() => {
    if (!scope || scope === 'guest') return;
    const controller = new AbortController();
    pendingRequestsRef.current.add(controller);
    const readEpoch = ++fetchEpochRef.current;
    const mutationEpoch = mutationEpochRef.current;
    const current = () => scopeRef.current === scope && !controller.signal.aborted;

    update(scope, (old) => ({ ...old, isSyncing: true }));
    const owner: TemplateRequestOwner = { getToken: () => tokenRef.current(), signal: controller.signal, isCurrent: current };
    void fetchCloudTemplates(owner).then((templates) => {
      if (!current() || readEpoch !== fetchEpochRef.current || mutationEpoch !== mutationEpochRef.current) return;
      update(scope, (old) => ({
        ...old, templates, isSyncing: false, syncError: old.syncError === 'mutation' ? 'mutation' : null, cacheCorrupt: false,
        activeId: old.activeId && templates.some((template) => template.id === old.activeId) ? old.activeId : null,
      }), true);
    }).catch(() => {
      if (!current() || readEpoch !== fetchEpochRef.current || mutationEpoch !== mutationEpochRef.current) return;
      update(scope, (old) => ({
        ...old, isSyncing: false, syncError: old.syncError === 'mutation' ? 'mutation' : old.cacheCorrupt ? 'storage' : 'load',
      }));
    }).finally(() => { pendingRequestsRef.current.delete(controller); });

    return () => {
      controller.abort();
      pendingRequestsRef.current.delete(controller);
    };
  }, [scope, refreshId, update]);

  const startMutation = useCallback((ownerScope: TemplateScope) => {
    mutationEpochRef.current += 1;
    // Discard a GET snapshot that started before the first mutation.
    fetchEpochRef.current += 1;
    update(ownerScope, (old) => ({ ...old, isSyncing: false }));
  }, [update]);

  const ownerFor = useCallback((ownerScope: TemplateScope): {
    controller: AbortController;
    owner: TemplateRequestOwner;
  } => {
    const controller = new AbortController();
    pendingRequestsRef.current.add(controller);
    const isCurrent = () => scopeRef.current === ownerScope && !controller.signal.aborted;
    return {
      controller,
      owner: { signal: controller.signal, isCurrent, getToken: () => tokenRef.current() },
    };
  }, []);

  const enqueue = <T,>(operation: () => Promise<T>): Promise<T> => {
    const task = mutationQueueRef.current.then(operation, operation);
    mutationQueueRef.current = task.then(() => undefined, () => undefined);
    return task;
  };

  const setMutationError = useCallback((ownerScope: TemplateScope) => {
    update(ownerScope, (old) => ({ ...old, isSyncing: false, syncError: 'mutation' }));
  }, [update]);

  const saveCustomTemplate = useCallback(async (
    name: string,
    background: TemplateBackgroundConfig,
    typography: TemplateTypographyConfig,
    decorations: TemplateDecorationsConfig,
    poemStyle: UserCustomTemplate['poemStyle'],
  ): Promise<UserCustomTemplate | null> => {
    const ownerScope = scopeRef.current;
    if (!ownerScope) return null;
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
        ...old, templates: [created, ...old.templates], activeId: created.id, syncError: null,
      }), true);
      return created;
    }
    return enqueue(async () => {
      if (scopeRef.current !== ownerScope) return null;
      const { owner, controller } = ownerFor(ownerScope);
      try {
        const saved = await createCloudTemplate(payload, owner);
        if (!owner.isCurrent()) return null;
        update(ownerScope, (old) => ({
          ...old,
          templates: [saved, ...old.templates.filter((item) => item.id !== saved.id)],
          activeId: saved.id,
          syncError: null,
          isSyncing: false,
        }), true);
        return saved;
      } catch {
        if (owner.isCurrent()) setMutationError(ownerScope);
        return null;
      } finally {
        pendingRequestsRef.current.delete(controller);
        if (scopeRef.current === ownerScope) {
          setRefreshId((current) => current + 1);
        }
      }
    });
  }, [ownerFor, setMutationError, startMutation, update]);

  const applyCustomTemplate = useCallback((id: string) => {
    const ownerScope = scopeRef.current;
    if (!ownerScope) return;
    update(ownerScope, (old) => old.templates.some((item) => item.id === id)
      ? { ...old, activeId: id } : old);
  }, [update]);

  const renameCustomTemplate = useCallback(async (id: string, name: string): Promise<void> => {
    const ownerScope = scopeRef.current;
    const trimmedName = name.trim();
    if (!ownerScope || !trimmedName) return;
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
    await enqueue(async () => {
      if (scopeRef.current !== ownerScope) return;
      const { owner, controller } = ownerFor(ownerScope);
      try {
        await renameCloudTemplate(id, trimmedName, owner);
        if (!owner.isCurrent()) return;
        update(ownerScope, (old) => ({
          ...old, templates: old.templates.map((item) => item.id === id ? { ...item, name: trimmedName } : item),
          syncError: null, isSyncing: false,
        }), true);
      } catch {
        if (owner.isCurrent()) setMutationError(ownerScope);
      } finally {
        pendingRequestsRef.current.delete(controller);
        if (scopeRef.current === ownerScope) {
          setRefreshId((current) => current + 1);
        }
      }
    });
  }, [ownerFor, setMutationError, startMutation, update]);

  const deleteCustomTemplate = useCallback(async (id: string): Promise<void> => {
    const ownerScope = scopeRef.current;
    if (!ownerScope || !viewRef.current.templates.some((item) => item.id === id)) return;
    startMutation(ownerScope);
    if (ownerScope === 'guest') {
      if (viewRef.current.cacheCorrupt) { setMutationError(ownerScope); return; }
      update(ownerScope, (old) => ({
        ...old, templates: old.templates.filter((item) => item.id !== id),
        activeId: old.activeId === id ? null : old.activeId, syncError: null,
      }), true);
      return;
    }
    await enqueue(async () => {
      if (scopeRef.current !== ownerScope) return;
      const { owner, controller } = ownerFor(ownerScope);
      try {
        await deleteCloudTemplate(id, owner);
        if (!owner.isCurrent()) return;
        update(ownerScope, (old) => ({
          ...old, templates: old.templates.filter((item) => item.id !== id),
          activeId: old.activeId === id ? null : old.activeId,
          syncError: null, isSyncing: false,
        }), true);
      } catch {
        if (owner.isCurrent()) setMutationError(ownerScope);
      } finally {
        pendingRequestsRef.current.delete(controller);
        if (scopeRef.current === ownerScope) {
          setRefreshId((current) => current + 1);
        }
      }
    });
  }, [ownerFor, setMutationError, startMutation, update]);

  const clearActiveCustomTemplate = useCallback(() => {
    const ownerScope = scopeRef.current;
    update(ownerScope, (old) => ({ ...old, activeId: null }));
  }, [update]);

  const importLegacyTemplates = useCallback(() => {
    if (scopeRef.current !== 'guest') return;
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
  const visible = view.scope === scope ? view : {
    ...view, scope, templates: [], activeId: null,
    isSyncing: true, syncError: null, hasLegacyCache: false,
  };
  return {
    customTemplates: visible.templates,
    activeCustomTemplateId: visible.activeId,
    syncError: visible.syncError,
    isSyncing: visible.isSyncing,
    hasLegacyCache: visible.hasLegacyCache,
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
