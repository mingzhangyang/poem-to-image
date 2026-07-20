import { useEffect, useRef } from 'react';
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
    background: { ...state.background, backgroundImage },
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
  background: Pick<
    BackgroundSectionProps,
    | 'backgroundType'
    | 'backgroundColor'
    | 'gradientColor1'
    | 'gradientColor2'
    | 'gradientDirection'
    | 'backgroundImage'
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
  background,
  typography,
  decorations,
}: UseEditorPersistenceParams) {
  const snapshotRef = useRef({ poem, poemStyle, canvasWidth, canvasHeight, background, typography, decorations });
  snapshotRef.current = { poem, poemStyle, canvasWidth, canvasHeight, background, typography, decorations };

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRef = useRef(true);

  useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const { poem, poemStyle, canvasWidth, canvasHeight, background, typography, decorations } =
          snapshotRef.current;

        const state: PersistedState = stripBlobUrls({
          poem,
          poemStyle,
          canvasWidth,
          canvasHeight,
          background: {
            backgroundType: background.backgroundType === 'ai' ? 'image' : background.backgroundType,
            backgroundColor: background.backgroundColor,
            gradientColor1: background.gradientColor1,
            gradientColor2: background.gradientColor2,
            gradientDirection: background.gradientDirection,
            backgroundImage: background.backgroundImage ?? null,
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
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [exportScene]);
}
