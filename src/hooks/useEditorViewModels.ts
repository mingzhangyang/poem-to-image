import type { Language } from '../translations';
import type {
  BackgroundSectionProps,
  CanvasPreviewProps,
  CanvasSizeSectionProps,
  ContentSectionProps,
  CustomText,
  DecorationsSectionProps,
  TemplateSectionProps,
  ExpandedSections,
  SidebarProps,
  TranslateFn,
  TypographySectionProps,
} from '../types';

interface UseEditorViewModelsParams {
  language: Language;
  onLanguageChange: (value: Language) => void;
  t: TranslateFn;
  expandedSections: ExpandedSections;
  onToggleSection: (section: keyof ExpandedSections) => void;
  onExpandSection: (section: keyof ExpandedSections) => void;
  templates: TemplateSectionProps;
  canvas: CanvasSizeSectionProps;
  content: ContentSectionProps;
  background: BackgroundSectionProps;
  typography: TypographySectionProps;
  decorations: DecorationsSectionProps;
  exportScale: SidebarProps['exportScale'];
  onExportScaleChange: SidebarProps['onExportScaleChange'];
  onDownload: () => void;
  containerRef: CanvasPreviewProps['containerRef'];
  previewRef: CanvasPreviewProps['previewRef'];
  text: string;
  backgroundType: CanvasPreviewProps['backgroundType'];
  backgroundStyle: CanvasPreviewProps['backgroundStyle'];
  bgBrightness: number;
  bgBlur: number;
  showBorder: boolean;
  borderStyle: CanvasPreviewProps['borderStyle'];
  showStamp: boolean;
  stamp: CanvasPreviewProps['stamp'];
  onStampChange: CanvasPreviewProps['onStampChange'];
  canvasWidth: number;
  canvasHeight: number;
  customTexts: CustomText[];
  scale: number;
}

export function useEditorViewModels({
  language,
  onLanguageChange,
  t,
  expandedSections,
  onToggleSection,
  onExpandSection,
  templates,
  canvas,
  content,
  background,
  typography,
  decorations,
  exportScale,
  onExportScaleChange,
  onDownload,
  containerRef,
  previewRef,
  text,
  backgroundType,
  backgroundStyle,
  bgBrightness,
  bgBlur,
  showBorder,
  borderStyle,
  showStamp,
  stamp,
  onStampChange,
  canvasWidth,
  canvasHeight,
  customTexts,
  scale,
}: UseEditorViewModelsParams) {
  const sidebarProps: SidebarProps = {
    language,
    onLanguageChange,
    t,
    expandedSections,
    onToggleSection,
    onExpandSection,
    templates,
    canvas,
    content,
    background,
    typography,
    decorations,
    exportScale,
    onExportScaleChange,
    onDownload,
  };

  const canvasPreviewProps: CanvasPreviewProps = {
    containerRef,
    previewRef,
    t,
    text,
    backgroundType,
    backgroundStyle,
    bgBrightness,
    bgBlur,
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
    showBorder,
    borderStyle,
    showStamp,
    stamp,
    onStampChange,
    canvasWidth,
    canvasHeight,
    customTexts,
    scale,
  };

  return { sidebarProps, canvasPreviewProps };
}