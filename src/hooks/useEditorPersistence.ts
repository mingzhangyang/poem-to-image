import { useCallback, useEffect, useRef, useState } from 'react';
import { DraftConflictError, checkpointEditorDraft, pinDraftAssetSnapshot, saveEditorDraft, type EditorDraftState } from '../editorDraftStore';
import type {
  BackgroundSectionProps,
  PoemContentData,
  PoemLayerStyle,
  TemplateDecorationsConfig,
  TemplateTypographyConfig,
} from '../types';

const SAVE_DEBOUNCE_MS = 600;

interface UseEditorPersistenceParams {
  /** Reference-stable scene identity; drives draft writes after editor changes. */
  exportScene: unknown;
  initialRevision: number;
  promoteInitial: boolean;
  poem: PoemContentData;
  poemStyle: PoemLayerStyle;
  canvasWidth: number;
  canvasHeight: number;
  presetSize: string;
  background: Pick<
    BackgroundSectionProps,
    | 'backgroundType'
    | 'paperId'
    | 'backgroundColor'
    | 'gradientColor1'
    | 'gradientColor2'
    | 'gradientDirection'
    | 'backgroundImage'
    | 'backgroundImageSource'
    | 'backgroundSize'
    | 'bgBrightness'
    | 'bgBlur'
  > & { backgroundPosition?: string };
  typography: TemplateTypographyConfig;
  decorations: TemplateDecorationsConfig;
}

type SnapshotSource = Omit<UseEditorPersistenceParams, 'exportScene' | 'initialRevision' | 'promoteInitial'>;
export type DraftSaveError = 'failure' | 'conflict';

function buildDraft(source: SnapshotSource): EditorDraftState {
  const { poem, poemStyle, canvasWidth, canvasHeight, presetSize, background, typography, decorations } = source;
  return {
    poem,
    poemStyle,
    canvasWidth,
    canvasHeight,
    presetSize,
    background: {
      backgroundType: background.backgroundType === 'ai' ? 'image' : background.backgroundType,
      paperId: background.paperId,
      backgroundColor: background.backgroundColor,
      gradientColor1: background.gradientColor1,
      gradientColor2: background.gradientColor2,
      gradientDirection: background.gradientDirection,
      backgroundImage: background.backgroundImage ?? null,
      backgroundImageSource: background.backgroundImageSource,
      backgroundSize: background.backgroundSize,
      backgroundPosition: background.backgroundPosition,
      bgBrightness: background.bgBrightness,
      bgBlur: background.bgBlur,
    },
    typography,
    decorations,
  };
}

/**
 * Serializes writes. A delayed earlier save can never overwrite a later edit,
 * and a second tab cannot silently overwrite a newer persisted revision.
 * IndexedDB is the source of truth; localStorage is only a legacy fallback.
 */
export function useEditorPersistence({
  exportScene,
  initialRevision,
  promoteInitial,
  ...source
}: UseEditorPersistenceParams) {
  const snapshotRef = useRef(source);
  snapshotRef.current = source;

  const [saveError, setSaveError] = useState<DraftSaveError | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const pendingRevisionRef = useRef(0);
  const completedRevisionRef = useRef(0);
  const diskRevisionRef = useRef(initialRevision);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastObservedRef = useRef({ exportScene, presetSize: source.presetSize });
  const needsPromotionRef = useRef(promoteInitial);
  const lifecycleEpochRef = useRef(0);
  const mountedRef = useRef(true);

  const persistLatest = useCallback((): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;

    const work = async () => {
      while (completedRevisionRef.current < pendingRevisionRef.current) {
        const revision = pendingRevisionRef.current;
        try {
          const savedRevision = await saveEditorDraft(buildDraft(snapshotRef.current), diskRevisionRef.current);
          diskRevisionRef.current = savedRevision;
          completedRevisionRef.current = revision;
          if (revision < pendingRevisionRef.current) {
            checkpointEditorDraft(buildDraft(snapshotRef.current), savedRevision);
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
    const persistWhenLeaving = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (completedRevisionRef.current >= pendingRevisionRef.current) return;
      const current = buildDraft(snapshotRef.current);
      checkpointEditorDraft(current, diskRevisionRef.current);
      // A previous write may be in flight, holding older binary resources.
      // Pin the latest dirty scene until the entire serialized chain settles.
      const unpin = pinDraftAssetSnapshot(current);
      void persistLatest().finally(unpin);
    };
    const persistWhenHidden = () => {
      if (document.visibilityState === 'hidden') persistWhenLeaving();
    };
    const warnIfUnsaved = (event: BeforeUnloadEvent) => {
      if (completedRevisionRef.current >= pendingRevisionRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('pagehide', persistWhenLeaving);
    window.addEventListener('beforeunload', warnIfUnsaved);
    document.addEventListener('visibilitychange', persistWhenHidden);
    return () => {
      window.removeEventListener('pagehide', persistWhenLeaving);
      window.removeEventListener('beforeunload', warnIfUnsaved);
      document.removeEventListener('visibilitychange', persistWhenHidden);
      // React 19 StrictMode replays setup/cleanup without unmounting the editor.
      // Defer flushing until we know this really was its last lifetime.
      queueMicrotask(() => {
        if (lifecycleEpochRef.current !== epoch) return;
        persistWhenLeaving();
        mountedRef.current = false;
        if (timerRef.current) clearTimeout(timerRef.current);
      });
    };
  }, [persistLatest]);

  useEffect(() => {
    const last = lastObservedRef.current;
    const changed = last.exportScene !== exportScene || last.presetSize !== source.presetSize;
    // StrictMode replay and a hydrated non-default scene are not user edits.
    // A legacy or emergency checkpoint is explicitly promoted to IndexedDB.
    if (!changed && !needsPromotionRef.current) return;
    lastObservedRef.current = { exportScene, presetSize: source.presetSize };
    needsPromotionRef.current = false;
    pendingRevisionRef.current += 1;
    setHasUnsavedChanges(true);
    // A previous failure remains visible until an actual successful commit.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void persistLatest(); }, SAVE_DEBOUNCE_MS);
    // Debounce is managed by the effect body and true-unmount cleanup, not
    // per-effect cleanup (which StrictMode runs immediately during replay).
  }, [exportScene, source.presetSize, persistLatest]);

  const retrySave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void persistLatest();
  }, [persistLatest]);

  return { saveError, hasUnsavedChanges, retrySave };
}
