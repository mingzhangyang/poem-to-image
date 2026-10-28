import { useCallback, useEffect, useRef } from 'react';
import type {
  BackgroundSectionProps,
  PoemContentData,
  PoemLayerStyle,
  TemplateBackgroundConfig,
  TemplateDecorationsConfig,
  TemplateTypographyConfig,
} from '../types';

const STORAGE_KEY = 'inkpoem.editor-state.v1';
const SAVE_DEBOUNCE_MS = 600;
const MAX_STORAGE_BYTES = 3_000_000; // 3 MB guard — logos are data URLs and can be large

interface PersistedState {
  poem: PoemContentData;
  poemStyle: PoemLayerStyle;
  canvasWidth: number;
  canvasHeight: number;
  presetSize?: string; // older saved drafts did not include a preset identity
  background: TemplateBackgroundConfig;
  typography: TemplateTypographyConfig;
  decorations: TemplateDecorationsConfig;
}

function stripBlobUrls(state: PersistedState): PersistedState {
  const backgroundImage =
    state.background.backgroundImage?.startsWith('blob:') ? null : state.background.backgroundImage;

  const logos = state.decorations.logos.filter((logo) => !logo.imageUrl.startsWith('blob:'));

  return {
    ...state,
    background: { ...state.background, backgroundImage, backgroundImageSource: backgroundImage ? state.background.backgroundImageSource : null },
    decorations: { ...state.decorations, logos },
  };
}

export function loadPersistedState(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

interface UseEditorPersistenceParams {
  exportScene: unknown;
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
  >;
  typography: TemplateTypographyConfig;
  decorations: TemplateDecorationsConfig;
}

export function useEditorPersistence({
  exportScene,
  poem,
  poemStyle,
  canvasWidth,
  canvasHeight,
  presetSize,
  background,
  typography,
  decorations,
}: UseEditorPersistenceParams) {
  const snapshotRef = useRef({ poem, poemStyle, canvasWidth, canvasHeight, presetSize, background, typography, decorations });
  snapshotRef.current = { poem, poemStyle, canvasWidth, canvasHeight, presetSize, background, typography, decorations };

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRef = useRef(true);

  const persistSnapshot = useCallback(() => {
    try {
      const { poem, poemStyle, canvasWidth, canvasHeight, presetSize, background, typography, decorations } =
        snapshotRef.current;

      const state: PersistedState = stripBlobUrls({
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
          bgBrightness: background.bgBrightness,
          bgBlur: background.bgBlur,
        },
        typography,
        decorations,
      });

      const serialized = JSON.stringify(state);
      if (new TextEncoder().encode(serialized).byteLength <= MAX_STORAGE_BYTES) {
        window.localStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch {
      // Ignore — storage quota exceeded or serialization error
    }
  }, []);

  useEffect(() => {
    const persistBeforeLeaving = () => persistSnapshot();
    const persistWhenHidden = () => {
      if (document.visibilityState === 'hidden') persistSnapshot();
    };

    window.addEventListener('pagehide', persistBeforeLeaving);
    document.addEventListener('visibilitychange', persistWhenHidden);

    return () => {
      window.removeEventListener('pagehide', persistBeforeLeaving);
      document.removeEventListener('visibilitychange', persistWhenHidden);
    };
  }, [persistSnapshot]);

  useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(persistSnapshot, SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [exportScene, presetSize, persistSnapshot]);
}
