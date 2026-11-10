import { useCallback, useEffect, useRef, useState } from 'react';
import { useUndoHistory } from './useUndoHistory';
import { releaseEditorDraftAssets, retainEditorDraftAssets } from '../editorDraftStore';
import { getEditorDocumentAssetUrls, type EditorDocument } from '../editorDocument';

interface UseEditorHistoryParams {
  /** The exact same canonical scene supplied to persistence and export. */
  document: EditorDocument;
  restoreDocument: (snapshot: EditorDocument) => void;
}

export function useEditorHistory({ document, restoreDocument }: UseEditorHistoryParams) {
  const { push: pushSnapshot, undo: undoHistory, redo: redoHistory, canUndo, canRedo, getSnapshots } =
    useUndoHistory<EditorDocument>();
  const assetOwnerRef = useRef(crypto.randomUUID());
  const assetLeaseRef = useRef(0);

  // Always use the committed document instead of rebuilding a second snapshot
  // from multiple independently changing hook values.
  const documentRef = useRef(document);
  documentRef.current = document;
  const restoreRef = useRef(restoreDocument);
  restoreRef.current = restoreDocument;

  useEffect(() => {
    const lease = ++assetLeaseRef.current;
    return () => {
      // History must outlive detached saves; defer asset release past
      // StrictMode's synchronous effect cleanup/replay.
      setTimeout(() => {
        if (assetLeaseRef.current === lease) releaseEditorDraftAssets(assetOwnerRef.current);
      }, 0);
    };
  }, []);

  const restoringRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<EditorDocument | null>(null);
  const [hasPendingEdit, setHasPendingEdit] = useState(false);
  const observedRef = useRef(document);
  const firstRef = useRef(true);

  const refreshAssetReferences = useCallback(() => {
    const urls = new Set<string>();
    for (const scene of [...getSnapshots(), documentRef.current]) {
      for (const url of getEditorDocumentAssetUrls(scene)) urls.add(url);
    }
    retainEditorDraftAssets(assetOwnerRef.current, urls);
  }, [getSnapshots]);

  const flushPending = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    setHasPendingEdit(false);
    pushSnapshot(pending);
    refreshAssetReferences();
  }, [pushSnapshot, refreshAssetReferences]);

  useEffect(() => {
    if (restoringRef.current) {
      restoringRef.current = false;
      observedRef.current = document;
      pendingRef.current = null;
      setHasPendingEdit(false);
      refreshAssetReferences();
      return;
    }
    if (firstRef.current) {
      firstRef.current = false;
      pushSnapshot(document);
      refreshAssetReferences();
      return;
    }
    if (observedRef.current === document) return;
    observedRef.current = document;
    pendingRef.current = document;
    setHasPendingEdit(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushPending, 800);
    refreshAssetReferences();
  }, [document, flushPending, pushSnapshot, refreshAssetReferences]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const restore = useCallback((snapshot: EditorDocument) => {
    restoringRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = null;
    setHasPendingEdit(false);
    restoreRef.current(snapshot);
  }, []);

  const handleUndo = useCallback(() => {
    // A user may press Undo before the 800ms coalescing timer fires.
    // Commit the current edit first, then undo it as a single step.
    flushPending();
    const snapshot = undoHistory();
    if (snapshot) restore(snapshot);
  }, [flushPending, undoHistory, restore]);

  const handleRedo = useCallback(() => {
    flushPending();
    const snapshot = redoHistory();
    if (snapshot) restore(snapshot);
  }, [flushPending, redoHistory, restore]);

  const handleUndoRef = useRef(handleUndo);
  const handleRedoRef = useRef(handleRedo);
  handleUndoRef.current = handleUndo;
  handleRedoRef.current = handleRedo;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndoRef.current();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedoRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Until the debounce elapses the live edit is still undoable. Conversely,
  // a new pending edit invalidates the old redo branch immediately.
  return { canUndo: canUndo || hasPendingEdit, canRedo: canRedo && !hasPendingEdit, handleUndo, handleRedo };
}
