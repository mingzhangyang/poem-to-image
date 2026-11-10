import type { EditorDraftState } from './editorDraftStore';
import type { CanvasExportScene } from './export/renderCanvasExport';
import type {
  BackgroundType,
  PoemContentData,
  PoemLayerStyle,
  TemplateBackgroundConfig,
  TemplateDecorationsConfig,
  TemplateTypographyConfig,
} from './types';

/**
 * Canonical editable artwork snapshot. The canvas preset is editor metadata:
 * it is saved and undoable even though exporting uses only its dimensions.
 */
export type EditorDocument = Omit<EditorDraftState, 'presetSize'> & { presetSize: string };

export interface EditorDocumentSource {
  poem: PoemContentData;
  poemStyle: PoemLayerStyle;
  canvasWidth: number;
  canvasHeight: number;
  presetSize: string;
  background: Omit<TemplateBackgroundConfig, 'backgroundType'> & { backgroundType: BackgroundType };
  typography: TemplateTypographyConfig;
  decorations: TemplateDecorationsConfig;
}

/** One projection for autosave, history and template command inputs. */
export function createEditorDocument({
  poem,
  poemStyle,
  canvasWidth,
  canvasHeight,
  presetSize,
  background,
  typography,
  decorations,
}: EditorDocumentSource): EditorDocument {
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
}

/**
 * Export is a *projection* of the same document. UI-only export policies
 * (unsupported stamp, live 'ai' mode) never get written to the artwork.
 */
export function createEditorExportScene(
  document: EditorDocument,
  options: { stampSupported: boolean; backgroundType: BackgroundType },
): Omit<CanvasExportScene, 'exportScale'> {
  const { background, typography, decorations } = document;
  return {
    canvasWidth: document.canvasWidth,
    canvasHeight: document.canvasHeight,
    background: {
      backgroundType: options.backgroundType,
      paperId: background.paperId,
      backgroundColor: background.backgroundColor,
      gradientColor1: background.gradientColor1,
      gradientColor2: background.gradientColor2,
      gradientDirection: background.gradientDirection,
      backgroundImage: background.backgroundImage ?? null,
      backgroundSize: background.backgroundSize ?? 'cover',
      backgroundPosition: background.backgroundPosition,
      bgBrightness: background.bgBrightness,
      bgBlur: background.bgBlur,
    },
    typography: {
      poem: document.poem,
      poemStyle: document.poemStyle,
      ...typography,
      poemPosition: decorations.poemPosition,
    },
    decorations: {
      showBorder: decorations.showBorder,
      borderStyle: decorations.borderStyle,
      borderColor: decorations.borderColor ?? typography.textColor,
      borderWidth: decorations.borderWidth ?? 4,
      showStamp: decorations.showStamp && options.stampSupported,
      stamp: decorations.stamp,
      customTexts: decorations.customTexts,
      logos: decorations.logos,
      signatures: decorations.signatures ?? [],
    },
  };
}

/**
 * Saving a reusable template is a document projection, not a second
 * hand-built interpretation of the active hooks. Artwork-specific uploaded
 * backgrounds and logo images remain in the document, not in a cloud template.
 */
export function createReusableTemplateParts(document: EditorDocument): {
  background: TemplateBackgroundConfig;
  typography: TemplateTypographyConfig;
  decorations: TemplateDecorationsConfig;
  poemStyle: PoemLayerStyle;
} {
  const bg = document.background;
  return {
    background: {
      backgroundType: bg.backgroundType === 'image' ? 'solid' : bg.backgroundType,
      paperId: bg.paperId,
      backgroundColor: bg.backgroundColor,
      gradientColor1: bg.gradientColor1,
      gradientColor2: bg.gradientColor2,
      gradientDirection: bg.gradientDirection,
      backgroundImage: null,
      bgBrightness: bg.bgBrightness,
      bgBlur: bg.bgBlur,
    },
    typography: document.typography,
    decorations: {
      ...document.decorations,
      logos: [],
    },
    poemStyle: document.poemStyle,
  };
}

/** Collect references for the current scene and the retained history stack. */
export function getEditorDocumentAssetUrls(document: EditorDraftState): string[] {
  return [
    document.background.backgroundImage,
    ...document.decorations.logos.map((logo) => logo.imageUrl),
  ].filter((url): url is string => !!url && (url.startsWith('blob:') || url.startsWith('data:')));
}
