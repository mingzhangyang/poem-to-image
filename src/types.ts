import type { CSSProperties, ChangeEvent, ReactNode, RefObject } from 'react';
import type { Language, TranslationKey } from './translations';

export type BackgroundType = 'solid' | 'gradient' | 'transparent' | 'image' | 'ai';
export type WritingMode = 'horizontal-tb' | 'vertical-rl';
export type TextAlign = 'left' | 'center' | 'right';
export type BorderStyle = 'solid' | 'dashed' | 'double';
export type EditorTemplateId = 'ink-wash' | 'modern-minimal' | 'cyberpunk' | 'japanese-magazine';
export type ExportScale = 1 | 2 | 3;

export interface CustomText {
  id: string;
  text: string;
  fontSize: number;
  color: string;
  writingMode: WritingMode;
  rotation: number;
}

export interface ExpandedSections {
  canvasSize: boolean;
  templates: boolean;
  content: boolean;
  background: boolean;
  typography: boolean;
  decorations: boolean;
}

export interface TemplateBackgroundConfig {
  backgroundType: Exclude<BackgroundType, 'image' | 'ai'>;
  backgroundColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: string;
  bgBrightness: number;
  bgBlur: number;
}

export interface TemplateTypographyConfig {
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
}

export interface TemplateDecorationsConfig {
  showBorder: boolean;
  borderStyle: BorderStyle;
  showStamp: boolean;
  stampText: string;
  customTexts: CustomText[];
}

export interface EditorTemplateDefinition {
  id: EditorTemplateId;
  nameKey: TranslationKey;
  descriptionKey: TranslationKey;
  accentFrom: string;
  accentTo: string;
  background: TemplateBackgroundConfig;
  typography: TemplateTypographyConfig;
  decorations: TemplateDecorationsConfig;
}

export interface TemplateSectionProps {
  templates: EditorTemplateDefinition[];
  activeTemplateId: EditorTemplateId | null;
  onApplyTemplate: (id: EditorTemplateId) => void;
}

export interface CanvasSizeSectionProps {
  presetSize: string;
  canvasWidth: number;
  canvasHeight: number;
  onPresetChange: (value: string) => void;
  onCanvasWidthChange: (value: number) => void;
  onCanvasHeightChange: (value: number) => void;
}

export interface ContentSectionProps {
  text: string;
  onTextChange: (value: string) => void;
}

export interface BackgroundSectionProps {
  backgroundType: BackgroundType;
  backgroundColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: string;
  backgroundImage: string | null;
  bgBrightness: number;
  bgBlur: number;
  aiPrompt: string;
  aiError: string;
  isGeneratingAI: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onBackgroundTypeChange: (value: BackgroundType) => void;
  onBackgroundColorChange: (value: string) => void;
  onGradientColor1Change: (value: string) => void;
  onGradientColor2Change: (value: string) => void;
  onGradientDirectionChange: (value: string) => void;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onAiPromptChange: (value: string) => void;
  onGenerateAiBackground: () => void;
  onBgBrightnessChange: (value: number) => void;
  onBgBlurChange: (value: number) => void;
}

export interface TypographySectionProps {
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
  onFontFamilyChange: (value: string) => void;
  onFontSizeChange: (value: number) => void;
  onTextColorChange: (value: string) => void;
  onTextAlignChange: (value: TextAlign) => void;
  onWritingModeChange: (value: WritingMode) => void;
  onPaddingChange: (value: number) => void;
  onLineHeightChange: (value: number) => void;
  onLetterSpacingChange: (value: number) => void;
  onColumnsChange: (value: number) => void;
  onColumnGapChange: (value: number) => void;
  onTextShadowEnabledChange: (value: boolean) => void;
  onTextShadowColorChange: (value: string) => void;
  onTextShadowBlurChange: (value: number) => void;
  onTextShadowOffsetYChange: (value: number) => void;
  onTextShadowOffsetXChange: (value: number) => void;
}

export interface DecorationsSectionProps {
  showBorder: boolean;
  borderStyle: BorderStyle;
  showStamp: boolean;
  stampText: string;
  customTexts: CustomText[];
  onAddCustomText: () => void;
  onShowBorderChange: (value: boolean) => void;
  onBorderStyleChange: (value: BorderStyle) => void;
  onShowStampChange: (value: boolean) => void;
  onStampTextChange: (value: string) => void;
  onCustomTextChange: (id: string, updates: Partial<CustomText>) => void;
  onCustomTextRemove: (id: string) => void;
}

export type TranslateFn = (key: TranslationKey) => string;

export interface SidebarProps {
  language: Language;
  onLanguageChange: (value: Language) => void;
  t: TranslateFn;
  expandedSections: ExpandedSections;
  onToggleSection: (section: keyof ExpandedSections) => void;
  templates: TemplateSectionProps;
  canvas: CanvasSizeSectionProps;
  content: ContentSectionProps;
  background: BackgroundSectionProps;
  typography: TypographySectionProps;
  decorations: DecorationsSectionProps;
  exportScale: ExportScale;
  onExportScaleChange: (value: ExportScale) => void;
  onDownload: () => void;
}

export interface CanvasPreviewProps {
  containerRef: RefObject<HTMLDivElement | null>;
  previewRef: RefObject<HTMLDivElement | null>;
  t: TranslateFn;
  text: string;
  backgroundType: BackgroundType;
  backgroundStyle: CSSProperties;
  bgBrightness: number;
  bgBlur: number;
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
  showBorder: boolean;
  borderStyle: BorderStyle;
  showStamp: boolean;
  stampText: string;
  canvasWidth: number;
  canvasHeight: number;
  customTexts: CustomText[];
  scale: number;
}

export interface ControlSectionProps {
  title: string;
  icon: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  action?: ReactNode;
  children: ReactNode;
}