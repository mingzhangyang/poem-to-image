import type { Language } from '../translations';
import type {
  BackgroundSectionProps,
  BillingSectionProps,
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
  billing: BillingSectionProps;
  exportScale: SidebarProps['exportScale'];
  onExportScaleChange: SidebarProps['onExportScaleChange'];
  onDownload: () => void;
  isExporting: boolean;
  containerRef: CanvasPreviewProps['containerRef'];
  previewRef: CanvasPreviewProps['previewRef'];
  poemFrameRef: CanvasPreviewProps['poemFrameRef'];
  poemTextRef: CanvasPreviewProps['poemTextRef'];
  text: string;
  backgroundType: CanvasPreviewProps['backgroundType'];
  backgroundStyle: CanvasPreviewProps['backgroundStyle'];
  bgBrightness: number;
  bgBlur: number;
  showBorder: boolean;
  borderStyle: CanvasPreviewProps['borderStyle'];
  showStamp: boolean;
  stamp: CanvasPreviewProps['stamp'];
  poemPosition: CanvasPreviewProps['poemPosition'];
  onPoemPositionChange: CanvasPreviewProps['onPoemPositionChange'];
  onStampChange: CanvasPreviewProps['onStampChange'];
  canvasWidth: number;
  canvasHeight: number;
  customTexts: CustomText[];
  onCustomTextChange: CanvasPreviewProps['onCustomTextChange'];
  onInteractionStart: CanvasPreviewProps['onInteractionStart'];
  onInteractionEnd: CanvasPreviewProps['onInteractionEnd'];
  previewZoom: number;
  onPreviewZoomChange: CanvasPreviewProps['onPreviewZoomChange'];
  onPreviewZoomReset: CanvasPreviewProps['onPreviewZoomReset'];
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
  billing,
  exportScale,
  onExportScaleChange,
  onDownload,
  isExporting,
  containerRef,
  previewRef,
  poemFrameRef,
  poemTextRef,
  text,
  backgroundType,
  backgroundStyle,
  bgBrightness,
  bgBlur,
  showBorder,
  borderStyle,
  showStamp,
  stamp,
  poemPosition,
  onPoemPositionChange,
  onStampChange,
  canvasWidth,
  canvasHeight,
  customTexts,
  onCustomTextChange,
  onInteractionStart,
  onInteractionEnd,
  previewZoom,
  onPreviewZoomChange,
  onPreviewZoomReset,
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
    billing,
    canvasWidth,
    canvasHeight,
    exportScale,
    onExportScaleChange,
    onDownload,
    isExporting,
  };

  const canvasPreviewProps: CanvasPreviewProps = {
    containerRef,
    previewRef,
    poemFrameRef,
    poemTextRef,
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
    poemPosition,
    onPoemPositionChange,
    onStampChange,
    canvasWidth,
    canvasHeight,
    customTexts,
    onCustomTextChange,
    onInteractionStart,
    onInteractionEnd,
    previewZoom,
    onPreviewZoomChange,
    onPreviewZoomReset,
    scale,
  };

  return { sidebarProps, canvasPreviewProps };
}