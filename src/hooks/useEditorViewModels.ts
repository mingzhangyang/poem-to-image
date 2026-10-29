import { useMemo } from 'react';
import type { Language } from '../translations';
import type {
  BackgroundSectionProps,
  BillingSectionProps,
  CanvasPreviewProps,
  CanvasSizeSectionProps,
  ContentSectionProps,
  PoemContentData,
  PoemLayerStyle,
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
  exportFormat: SidebarProps['exportFormat'];
  onExportFormatChange: SidebarProps['onExportFormatChange'];
  exportScale: SidebarProps['exportScale'];
  onExportScaleChange: SidebarProps['onExportScaleChange'];
  onDownload: () => void;
  onShare: () => void;
  onCopy: () => void;
  onPublishLink: () => void;
  publishLinkLabel: string;
  onManageShares: () => void;
  manageSharesLabel: string;
  onShareToSocial: CanvasPreviewProps['onShareToSocial'];
  isExporting: boolean;
  isSharing: boolean;
  canShare: boolean;
  containerRef: CanvasPreviewProps['containerRef'];
  previewRef: CanvasPreviewProps['previewRef'];
  poemFrameRef: CanvasPreviewProps['poemFrameRef'];
  poemTextRef: CanvasPreviewProps['poemTextRef'];
  poem: PoemContentData;
  poemStyle: PoemLayerStyle;
  backgroundType: CanvasPreviewProps['backgroundType'];
  backgroundStyle: CanvasPreviewProps['backgroundStyle'];
  bgBrightness: number;
  bgBlur: number;
  showBorder: boolean;
  borderStyle: CanvasPreviewProps['borderStyle'];
  borderColor: CanvasPreviewProps['borderColor'];
  borderWidth: CanvasPreviewProps['borderWidth'];
  showStamp: boolean;
  stamp: CanvasPreviewProps['stamp'];
  poemPosition: CanvasPreviewProps['poemPosition'];
  onPoemPositionChange: CanvasPreviewProps['onPoemPositionChange'];
  onStampChange: CanvasPreviewProps['onStampChange'];
  canvasWidth: number;
  canvasHeight: number;
  customTexts: CustomText[];
  onCustomTextChange: CanvasPreviewProps['onCustomTextChange'];
  logos: CanvasPreviewProps['logos'];
  onLogoChange: CanvasPreviewProps['onLogoChange'];
  signatures: CanvasPreviewProps['signatures'];
  onSignatureChange: CanvasPreviewProps['onSignatureChange'];
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
  exportFormat,
  onExportFormatChange,
  exportScale,
  onExportScaleChange,
  onDownload,
  onShare,
  onCopy,
  onPublishLink,
  publishLinkLabel,
  onManageShares,
  manageSharesLabel,
  onShareToSocial,
  isExporting,
  isSharing,
  canShare,
  containerRef,
  previewRef,
  poemFrameRef,
  poemTextRef,
  poem,
  poemStyle,
  backgroundType,
  backgroundStyle,
  bgBrightness,
  bgBlur,
  showBorder,
  borderStyle,
  borderColor,
  borderWidth,
  showStamp,
  stamp,
  poemPosition,
  onPoemPositionChange,
  onStampChange,
  canvasWidth,
  canvasHeight,
  customTexts,
  onCustomTextChange,
  logos,
  onLogoChange,
  signatures,
  onSignatureChange,
  onInteractionStart,
  onInteractionEnd,
  previewZoom,
  onPreviewZoomChange,
  onPreviewZoomReset,
  scale,
}: UseEditorViewModelsParams) {
  const sidebarProps = useMemo<SidebarProps>(() => ({
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
    exportFormat,
    onExportFormatChange,
    exportScale,
    onExportScaleChange,
    onDownload,
    onShare,
    onCopy,
    onPublishLink,
    publishLinkLabel,
    onManageShares,
    manageSharesLabel,
    onShareToSocial,
    isExporting,
    isSharing,
    canShare,
  }), [
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
    exportFormat,
    onExportFormatChange,
    exportScale,
    onExportScaleChange,
    onDownload,
    onShare,
    onCopy,
    onPublishLink,
    publishLinkLabel,
    onManageShares,
    manageSharesLabel,
    onShareToSocial,
    isExporting,
    isSharing,
    canShare,
  ]);

  const canvasPreviewProps = useMemo<Omit<CanvasPreviewProps, 'canUndo' | 'canRedo' | 'onUndo' | 'onRedo'>>(() => ({
    containerRef,
    previewRef,
    poemFrameRef,
    poemTextRef,
    t,
    poem,
    poemStyle,
    backgroundType,
    backgroundImage: background.backgroundImage,
    backgroundStyle,
    bgBrightness,
    bgBlur,
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    textColor: typography.textColor,
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
    borderColor,
    borderWidth,
    showStamp,
    stamp,
    poemPosition,
    onPoemPositionChange,
    onStampChange,
    canvasWidth,
    canvasHeight,
    customTexts,
    onCustomTextChange,
    logos,
    onLogoChange,
    signatures,
    onSignatureChange,
    exportFormat,
    onExportFormatChange,
    exportScale,
    onExportScaleChange,
    onDownload,
    onShare,
    onCopy,
    onPublishLink,
    publishLinkLabel,
    onManageShares,
    manageSharesLabel,
    onShareToSocial,
    isExporting,
    isSharing,
    canShare,
    onInteractionStart,
    onInteractionEnd,
    previewZoom,
    onPreviewZoomChange,
    onPreviewZoomReset,
    scale,
  }), [
    containerRef,
    previewRef,
    poemFrameRef,
    poemTextRef,
    t,
    poem,
    poemStyle,
    backgroundType,
    background.backgroundImage,
    backgroundStyle,
    bgBrightness,
    bgBlur,
    typography.fontFamily,
    typography.fontSize,
    typography.textColor,
    typography.writingMode,
    typography.padding,
    typography.lineHeight,
    typography.letterSpacing,
    typography.columns,
    typography.columnGap,
    typography.textShadowEnabled,
    typography.textShadowColor,
    typography.textShadowBlur,
    typography.textShadowOffsetY,
    typography.textShadowOffsetX,
    showBorder,
    borderStyle,
    borderColor,
    borderWidth,
    showStamp,
    stamp,
    poemPosition,
    onPoemPositionChange,
    onStampChange,
    canvasWidth,
    canvasHeight,
    customTexts,
    onCustomTextChange,
    logos,
    onLogoChange,
    signatures,
    onSignatureChange,
    exportFormat,
    onExportFormatChange,
    exportScale,
    onExportScaleChange,
    onDownload,
    onShare,
    onCopy,
    onPublishLink,
    publishLinkLabel,
    onManageShares,
    manageSharesLabel,
    onShareToSocial,
    isExporting,
    isSharing,
    canShare,
    onInteractionStart,
    onInteractionEnd,
    previewZoom,
    onPreviewZoomChange,
    onPreviewZoomReset,
    scale,
  ]);

  return { sidebarProps, canvasPreviewProps };
}
