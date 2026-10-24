import { useCallback, useEffect, useRef } from 'react';
import { useUndoHistory } from './useUndoHistory';
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
  backgroundColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: string;
  backgroundImage: string | null;
  backgroundImageSource: BackgroundImageSource;
  backgroundSize?: 'cover' | 'contain' | 'stretch';
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
  const { push: pushSnapshot, undo: undoHistory, redo: redoHistory, canUndo, canRedo } = useUndoHistory<EditorSnapshot>();

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
        backgroundColor: background.backgroundColor,
        gradientColor1: background.gradientColor1,
        gradientColor2: background.gradientColor2,
        gradientDirection: background.gradientDirection,
        backgroundImage: background.backgroundImage,
        backgroundImageSource: background.backgroundImageSource,
        backgroundSize: background.backgroundSize,
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
  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }
    if (isFirstSnapshotRef.current) {
      isFirstSnapshotRef.current = false;
      pushSnapshot(buildSnapshot());
      return;
    }
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      if (!isRestoringRef.current) pushSnapshot(buildSnapshot());
    }, 800);
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
