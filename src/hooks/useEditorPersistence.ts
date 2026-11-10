import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DraftConflictError,
  checkpointEditorDraft,
  discardSavedNavigationDraft,
  noteNavigationDraftSaved,
  pinDraftAssetSnapshot,
  retainDraftForNavigation,
  saveEditorDraft,
  trackNavigationDraftFlush,
} from '../editorDraftStore';
import type { EditorDocument } from '../editorDocument';

const SAVE_DEBOUNCE_MS = 600;

interface UseEditorPersistenceParams {
  /** Same referentially stable document used by editor history and export. */
  document: EditorDocument;
  initialRevision: number;
  promoteInitial: boolean;
}

export type DraftSaveError = 'failure' | 'conflict';

/**
 * Serializes writes. A delayed earlier save can never overwrite a later edit,
 * and a second tab cannot silently overwrite a newer persisted revision.
 * IndexedDB is the source of truth; localStorage is only a legacy fallback.
 */
export function useEditorPersistence({
  document,
  initialRevision,
  promoteInitial,
}: UseEditorPersistenceParams) {
  const snapshotRef = useRef(document);
  snapshotRef.current = document;

  const [saveError, setSaveError] = useState<DraftSaveError | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const pendingRevisionRef = useRef(0);
  const completedRevisionRef = useRef(0);
  const diskRevisionRef = useRef(initialRevision);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastObservedRef = useRef(document);
  const needsPromotionRef = useRef(promoteInitial);
  const lifecycleEpochRef = useRef(0);
  const mountedRef = useRef(true);
  const detachedTicketRef = useRef<number | null>(null);

  const persistLatest = useCallback((): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;

    const work = async () => {
      while (completedRevisionRef.current < pendingRevisionRef.current) {
        const revision = pendingRevisionRef.current;
        try {
          const savedRevision = await saveEditorDraft(snapshotRef.current, diskRevisionRef.current);
          diskRevisionRef.current = savedRevision;
          completedRevisionRef.current = revision;
          const ticket = detachedTicketRef.current;
          if (ticket !== null) {
            noteNavigationDraftSaved(ticket, savedRevision, revision === pendingRevisionRef.current);
          }
          if (revision < pendingRevisionRef.current) {
            checkpointEditorDraft(snapshotRef.current, savedRevision);
          }
          if (mountedRef.current) {
            setSaveError(null);
            setHasUnsavedChanges(revision < pendingRevisionRef.current);
          }
        } catch (error) {
          if (mountedRef.current) {
            setSaveError(error instanceof DraftConflictError ? 'conflict' : 'failure');
            setHasUnsavedChanges(true);
          }
          return;
        }
      }
    };

    const running = work();
    inFlightRef.current = running.finally(() => { inFlightRef.current = null; });
    return inFlightRef.current;
  }, []);

  useEffect(() => {
    const epoch = ++lifecycleEpochRef.current;
    mountedRef.current = true;
    const persistWhenLeaving = (inAppNavigation = false) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (completedRevisionRef.current >= pendingRevisionRef.current) return;
      const current = snapshotRef.current;
      checkpointEditorDraft(current, diskRevisionRef.current);
      if (inAppNavigation) {
        // Unlike pagehide, a router unmount can finish while the tab stays
        // alive. A failed detached save must NOT discard this unsaved scene.
        const ticket = retainDraftForNavigation(current, diskRevisionRef.current);
        detachedTicketRef.current = ticket;
        const flush = persistLatest();
        trackNavigationDraftFlush(ticket, flush);
        void flush.then(() => {
          if (completedRevisionRef.current >= pendingRevisionRef.current) {
            discardSavedNavigationDraft(ticket);
          }
        }).catch(() => {
          // Retain the dirty scene and its images for the next editor mount.
        });
      } else {
        // pagehide/visibilitychange may be followed by a real page shutdown.
        // Pin binaries until this best-effort write has finished.
        const unpin = pinDraftAssetSnapshot(current);
        void persistLatest().then(unpin, unpin);
      }
    };
    const persistWhenHidden = () => {
      if (document.visibilityState === 'hidden') persistWhenLeaving();
    };
    const warnIfUnsaved = (event: BeforeUnloadEvent) => {
      if (completedRevisionRef.current >= pendingRevisionRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const onPageHide = () => persistWhenLeaving();
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', warnIfUnsaved);
    document.addEventListener('visibilitychange', persistWhenHidden);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', warnIfUnsaved);
      document.removeEventListener('visibilitychange', persistWhenHidden);
      // React 19 StrictMode replays setup/cleanup without unmounting the editor.
      // Defer flushing until we know this really was its last lifetime.
      queueMicrotask(() => {
        if (lifecycleEpochRef.current !== epoch) return;
        mountedRef.current = false;
        persistWhenLeaving(true);
        if (timerRef.current) clearTimeout(timerRef.current);
      });
    };
  }, [persistLatest]);

  useEffect(() => {
    const changed = lastObservedRef.current !== document;
    // StrictMode replay and a hydrated non-default scene are not user edits.
    // A legacy or emergency checkpoint is explicitly promoted to IndexedDB.
    if (!changed && !needsPromotionRef.current) return;
    lastObservedRef.current = document;
    needsPromotionRef.current = false;
    pendingRevisionRef.current += 1;
    setHasUnsavedChanges(true);
    // A previous failure remains visible until an actual successful commit.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void persistLatest(); }, SAVE_DEBOUNCE_MS);
    // Debounce is managed by the effect body and true-unmount cleanup, not
    // per-effect cleanup (which StrictMode runs immediately during replay).
  }, [document, persistLatest]);

  const retrySave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void persistLatest();
  }, [persistLatest]);

  return { saveError, hasUnsavedChanges, retrySave };
}
