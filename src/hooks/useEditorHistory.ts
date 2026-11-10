import { useCallback, useEffect, useRef } from 'react';
import { useUndoHistory } from './useUndoHistory';
import { releaseEditorDraftAssets, retainEditorDraftAssets } from '../editorDraftStore';
import type { PaperId } from '../paperStyles';
import type {
  BackgroundImageSource,
  BackgroundType,
  BorderStyle,
  CustomText,
  LogoConfig,
  PoemContentData,
  PoemLayerStyle,
  PositionedElement,
  SignatureConfig,
  StampConfig,
  TemplateBackgroundConfig,
  TemplateDecorationsConfig,
  TemplateTypographyConfig,
  TextAlign,
  WritingMode,
} from '../types';

interface HistoryBackgroundSource {
  backgroundType: BackgroundType;
  paperId: PaperId;
  backgroundColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: string;
  backgroundImage: string | null;
  backgroundImageSource: BackgroundImageSource;
  backgroundSize?: 'cover' | 'contain' | 'stretch';
  backgroundPosition?: string;
  bgBrightness: number;
  bgBlur: number;
  applyBackgroundTemplate: (t: TemplateBackgroundConfig) => void;
}

interface HistoryTypographySource {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  textAlign: TextAlign;
  writingMode: WritingMode;
  padding: number;
  lineHeight: number;
  letterSpacing: number;
  columns: number;
  columnGap: number;
  textShadowEnabled: boolean;
  textShadowColor: string;
  textShadowBlur: number;
  textShadowOffsetY: number;
  textShadowOffsetX: number;
  applyTypographyTemplate: (t: TemplateTypographyConfig) => void;
}

interface HistoryDecorationsSource {
  showBorder: boolean;
  borderStyle: BorderStyle;
  borderColor: string;
  borderWidth: number;
  showStamp: boolean;
  stamp: StampConfig;
  poemPosition: PositionedElement;
  customTexts: CustomText[];
  logos: LogoConfig[];
  signatures: SignatureConfig[];
  applyDecorationsTemplate: (t: TemplateDecorationsConfig) => void;
}

interface EditorSnapshot {
  poem: PoemContentData;
  poemStyle: PoemLayerStyle;
  canvasWidth: number;
  canvasHeight: number;
  presetSize: string;
  background: TemplateBackgroundConfig;
  typography: TemplateTypographyConfig;
  decorations: TemplateDecorationsConfig;
}

interface UseEditorHistoryParams {
  /** Changing this value triggers a debounced snapshot. Pass `exportScene`. */
  exportScene: unknown;
  poem: PoemContentData;
  poemStyle: PoemLayerStyle;
  canvasWidth: number;
  canvasHeight: number;
  presetSize: string;
  background: HistoryBackgroundSource;
  typography: HistoryTypographySource;
  decorations: HistoryDecorationsSource;
  setPoem: (poem: PoemContentData) => void;
  setPoemStyle: (poemStyle: PoemLayerStyle) => void;
  setCanvasWidth: (w: number) => void;
  setCanvasHeight: (h: number) => void;
  setPresetSize: (id: string) => void;
}

export function useEditorHistory({
  exportScene,
  poem,
  poemStyle,
  canvasWidth,
  canvasHeight,
  presetSize,
  background,
  typography,
  decorations,
  setPoem,
  setPoemStyle,
  setCanvasWidth,
  setCanvasHeight,
  setPresetSize,
}: UseEditorHistoryParams) {
  const { push: pushSnapshot, undo: undoHistory, redo: redoHistory, canUndo, canRedo, getSnapshots } = useUndoHistory<EditorSnapshot>();
  const assetOwnerRef = useRef(crypto.randomUUID());
  const assetLeaseRef = useRef(0);

  // Always-current snapshot data — closures in timers read from here to avoid stale values.
  const snapshotDataRef = useRef({ poem, poemStyle, canvasWidth, canvasHeight, presetSize, background, typography, decorations });
  snapshotDataRef.current = { poem, poemStyle, canvasWidth, canvasHeight, presetSize, background, typography, decorations };

  // Stable refs for apply functions whose identities change every render.
  const applyBackgroundRef = useRef(background.applyBackgroundTemplate);
  const applyTypographyRef = useRef(typography.applyTypographyTemplate);
  const applyDecorationsRef = useRef(decorations.applyDecorationsTemplate);
  applyBackgroundRef.current = background.applyBackgroundTemplate;
  applyTypographyRef.current = typography.applyTypographyTemplate;
  applyDecorationsRef.current = decorations.applyDecorationsTemplate;

  useEffect(() => {
    const lease = ++assetLeaseRef.current;
    return () => {
      // A timer runs after StrictMode's immediate effect replay, and after the
      // persistence hook has had a chance to pin its detached final save.
      setTimeout(() => {
        if (assetLeaseRef.current === lease) releaseEditorDraftAssets(assetOwnerRef.current);
      }, 0);
    };
  }, []);

  const isRestoringRef = useRef(false);
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildSnapshot = useCallback((): EditorSnapshot => {
    const { poem, poemStyle, canvasWidth, canvasHeight, presetSize, background, typography, decorations } = snapshotDataRef.current;
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
        backgroundImage: background.backgroundImage,
        backgroundImageSource: background.backgroundImageSource,
        backgroundSize: background.backgroundSize,
        backgroundPosition: background.backgroundPosition,
        bgBrightness: background.bgBrightness,
        bgBlur: background.bgBlur,
      },
      typography: {
        fontFamily: typography.fontFamily,
        fontSize: typography.fontSize,
        textColor: typography.textColor,
        textAlign: typography.textAlign,
        writingMode: typography.writingMode,
        padding: typography.padding,
        lineHeight: typography.lineHeight,
        letterSpacing: typography.letterSpacing,
        columns: typography.columns,
        columnGap: typography.columnGap,
        textShadowEnabled: typography.textShadowEnabled,
        textShadowColor: typography.textShadowColor,
        textShadowBlur: typography.textShadowBlur,
        textShadowOffsetY: typography.textShadowOffsetY,
        textShadowOffsetX: typography.textShadowOffsetX,
      },
      decorations: {
        showBorder: decorations.showBorder,
        borderStyle: decorations.borderStyle,
        borderColor: decorations.borderColor,
        borderWidth: decorations.borderWidth,
        showStamp: decorations.showStamp,
        stamp: decorations.stamp,
        poemPosition: decorations.poemPosition,
        customTexts: decorations.customTexts,
        logos: decorations.logos,
        signatures: decorations.signatures,
      },
    };
  }, []); // stable — reads from refs

  // Keep binaries for the current scene AND every retained undo/redo state.
  // Removed images are evicted once they leave history and no save pins them.
  const refreshAssetReferences = useCallback(() => {
    const urls = new Set<string>();
    for (const scene of [...getSnapshots(), buildSnapshot()]) {
      for (const url of [scene.background.backgroundImage, ...scene.decorations.logos.map((logo) => logo.imageUrl)]) {
        if (url?.startsWith('blob:') || url?.startsWith('data:')) urls.add(url);
      }
    }
    retainEditorDraftAssets(assetOwnerRef.current, urls);
  }, [buildSnapshot, getSnapshots]);

  const restoreSnapshot = useCallback(
    (snapshot: EditorSnapshot) => {
      isRestoringRef.current = true;
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
      setPoem(snapshot.poem);
      setPoemStyle(snapshot.poemStyle);
      setCanvasWidth(snapshot.canvasWidth);
      setCanvasHeight(snapshot.canvasHeight);
      setPresetSize(snapshot.presetSize);
      applyBackgroundRef.current(snapshot.background);
      applyTypographyRef.current(snapshot.typography);
      applyDecorationsRef.current(snapshot.decorations);
    },
    [setPoem, setPoemStyle, setCanvasWidth, setCanvasHeight, setPresetSize],
  );

  const isFirstSnapshotRef = useRef(true);
  const observedSceneRef = useRef({ exportScene, presetSize });
  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      observedSceneRef.current = { exportScene, presetSize };
      refreshAssetReferences();
      return;
    }
    if (isFirstSnapshotRef.current) {
      isFirstSnapshotRef.current = false;
      pushSnapshot(buildSnapshot());
      refreshAssetReferences();
      return;
    }
    if (observedSceneRef.current.exportScene === exportScene
      && observedSceneRef.current.presetSize === presetSize) return;
    observedSceneRef.current = { exportScene, presetSize };
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      if (!isRestoringRef.current) {
        pushSnapshot(buildSnapshot());
        refreshAssetReferences();
      }
    }, 800);
    refreshAssetReferences();
    return () => {
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    };
  }, [exportScene, presetSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUndo = useCallback(() => {
    const snapshot = undoHistory();
    if (snapshot) restoreSnapshot(snapshot);
  }, [undoHistory, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    const snapshot = redoHistory();
    if (snapshot) restoreSnapshot(snapshot);
  }, [redoHistory, restoreSnapshot]);

  // Stable refs for the keyboard handler so the listener is only added once.
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

  return { canUndo, canRedo, handleUndo, handleRedo };
}
