import type { CSSProperties, ChangeEvent, ReactNode, RefObject } from 'react';
import type { Language, TranslationKey } from './translations';

export type AiProvider = 'gemini' | 'openai';
export type BackgroundType = 'solid' | 'gradient' | 'transparent' | 'image' | 'ai';
export type WritingMode = 'horizontal-tb' | 'vertical-rl';
export type TextAlign = 'left' | 'center' | 'right';
export type BorderStyle =
  | 'solid'
  | 'dashed'
  | 'double'
  | 'shadow'
  | 'gradient'
  | 'broken'
  | 'overflow'
  | 'brush'
  | 'ink'
  | 'cloud'
  | 'wave'
  | 'fractal'
  | 'meander'
  | 'leiwen'
  | 'ornamental'
  | 'envelope';
export type StampStyle = 'square' | 'round' | 'brush';
export type SignatureFlourish = 'none' | 'swoosh' | 'double' | 'loop' | 'strike' | 'wave' | 'underline';
export type EditorTemplateId =
  | 'ink-wash'
  | 'modern-minimal'
  | 'cyberpunk'
  | 'japanese-magazine'
  | 'mountain-mist-photo'
  | 'ocean-dawn-photo'
  | 'city-night-photo'
  | 'ink-pine-mist-photo'
  | 'colorblock-cyan-magenta'
  | 'parchment-scroll'
  | 'wax-sealed-letter'
  | 'illuminated-manuscript'
  | 'bamboo-scroll'
;
export type ExportScale = 1 | 2 | 3;
export type ExportFormat = 'png' | 'jpg' | 'webp';
export type SocialPlatform = 'wechat' | 'weibo' | 'xiaohongshu' | 'twitter' | 'instagram' | 'facebook';

export interface CustomText {
  id: string;
  text: string;
  fontSize: number;
  color: string;
  writingMode: WritingMode;
  rotation: number;
  positionX: number;
  positionY: number;
  zIndex?: number;
  exportLeft?: number;
  exportTop?: number;
  /** Text box width as a percentage of the container width. undefined = max-content (auto). */
  boxWidth?: number;
}

export interface LogoConfig {
  id: string;
  imageUrl: string;
  positionX: number;
  positionY: number;
  size: number;
  rotation: number;
  opacity: number;
  zIndex?: number;
  exportLeft?: number;
  exportTop?: number;
}

export interface PositionedElement {
  positionX: number;
  positionY: number;
  exportLeft?: number;
  exportTop?: number;
  /** Text box width as a percentage of the container width. undefined = max-content (auto). */
  boxWidth?: number;
}

export interface ExpandedSections {
  canvasSize: boolean;
  templates: boolean;
  content: boolean;
  background: boolean;
  typography: boolean;
  decorations: boolean;
  billing: boolean;
}

export interface SignatureConfig {
  id: string;
  text: string;
  font: string;
  color: string;
  fontSize: number;
  slant: number;
  thickness: number;
  flourish: SignatureFlourish;
  positionX: number;
  positionY: number;
  opacity: number;
  rotation: number;
  zIndex?: number;
}

export interface StampConfig {
  text: string;
  style: StampStyle;
  colorScheme?: 'outline' | 'filled';
  inkColor?: string;
  weathering?: number;
  positionX: number;
  positionY: number;
  size: number;
  rotation: number;
  opacity: number;
  fontFamily: string;
}

export interface TemplateBackgroundConfig {
  backgroundType: Exclude<BackgroundType, 'ai'>;
  backgroundColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: string;
  backgroundImage?: string | null;
  backgroundSize?: 'cover' | 'contain' | 'stretch';
  backgroundPosition?: string;
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
  borderColor?: string;
  borderWidth?: number;
  showStamp: boolean;
  stamp: StampConfig;
  poemPosition: PositionedElement;
  customTexts: CustomText[];
  logos: LogoConfig[];
  signatures?: SignatureConfig[];
}

export interface EditorTemplateDefinition {
  id: EditorTemplateId;
  nameKey: TranslationKey;
  descriptionKey: TranslationKey;
  seriesKey: TranslationKey;
  usesBackgroundImage?: boolean;
  accentFrom: string;
  accentTo: string;
  background: TemplateBackgroundConfig;
  typography: TemplateTypographyConfig;
  decorations: TemplateDecorationsConfig;
  poemStyle?: PoemLayerStyle;
}

export interface UserCustomTemplate {
  id: string;
  name: string;
  createdAt: number;
  accentFrom: string;
  accentTo: string;
  background: TemplateBackgroundConfig;
  typography: TemplateTypographyConfig;
  decorations: TemplateDecorationsConfig;
  poemStyle: PoemLayerStyle;
}

export interface TemplateSectionProps {
  templates: EditorTemplateDefinition[];
  activeTemplateId: EditorTemplateId | null;
  onApplyTemplate: (id: EditorTemplateId) => void;
  customTemplates: UserCustomTemplate[];
  activeCustomTemplateId: string | null;
  onApplyCustomTemplate: (id: string) => void;
  onSaveCustomTemplate: (name: string) => void;
  onDeleteCustomTemplate: (id: string) => Promise<void>;
  onRenameCustomTemplate: (id: string, name: string) => Promise<void>;
}

export interface CanvasSizeSectionProps {
  presetSize: string;
  canvasWidth: number;
  canvasHeight: number;
  onPresetChange: (value: string) => void;
  onCanvasWidthChange: (value: number) => void;
  onCanvasHeightChange: (value: number) => void;
}

export interface PoemContentData {
  title: string;
  author: string;
  body: string;
  sourceNote: string;
}

export type PoemSectionPlacement = 'before-body' | 'after-body' | 'after-author';

export interface PoemLayerStyle {
  titleScale: number;
  titleOpacity: number;
  titleLineHeight: number;
  titleLetterSpacing: number;
  titleBodyGap: number;
  titleAlign: TextAlign;
  titlePlacement: Exclude<PoemSectionPlacement, 'after-author'>;
  bodyLineHeight: number;
  bodyLetterSpacing: number;
  bodyAlign: TextAlign;
  authorScale: number;
  authorOpacity: number;
  authorLineHeight: number;
  authorLetterSpacing: number;
  authorBodyGap: number;
  authorAlign: TextAlign;
  authorPlacement: Exclude<PoemSectionPlacement, 'after-author'>;
  sourceScale: number;
  sourceOpacity: number;
  sourceLineHeight: number;
  sourceLetterSpacing: number;
  sourceGap: number;
  sourceAlign: TextAlign;
  sourcePlacement: PoemSectionPlacement;
}

export interface ContentSectionProps {
  poem: PoemContentData;
  poemStyle: PoemLayerStyle;
  onTitleChange: (value: string) => void;
  onAuthorChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSourceNoteChange: (value: string) => void;
  onPoemStyleChange: (updates: Partial<PoemLayerStyle>) => void;
  onResetPoemStyle: () => void;
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
  aiProvider: AiProvider;
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
  onAiProviderChange: (value: AiProvider) => void;
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
  borderColor: string;
  borderWidth: number;
  showStamp: boolean;
  stampSupported: boolean;
  stamp: StampConfig;
  poemPosition: PositionedElement;
  customTexts: CustomText[];
  logos: LogoConfig[];
  signatures: SignatureConfig[];
  onAddCustomText: () => void;
  onAddSignature: () => void;
  onShowBorderChange: (value: boolean) => void;
  onBorderStyleChange: (value: BorderStyle) => void;
  onBorderColorChange: (value: string) => void;
  onBorderWidthChange: (value: number) => void;
  onShowStampChange: (value: boolean) => void;
  onStampChange: (updates: Partial<StampConfig>) => void;
  onPoemPositionChange: (updates: Partial<PositionedElement>) => void;
  onResetStampPosition: () => void;
  onCustomTextChange: (id: string, updates: Partial<CustomText>) => void;
  onCustomTextRemove: (id: string) => void;
  onCustomTextReorder: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  onLogoUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onLogoChange: (id: string, updates: Partial<LogoConfig>) => void;
  onLogoRemove: (id: string) => void;
  onLogoReorder: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  onSignatureChange: (id: string, updates: Partial<SignatureConfig>) => void;
  onSignatureRemove: (id: string) => void;
}

export type TranslateFn = (key: TranslationKey) => string;

export interface SidebarProps {
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
  canvasWidth: number;
  canvasHeight: number;
  exportFormat: ExportFormat;
  onExportFormatChange: (value: ExportFormat) => void;
  exportScale: ExportScale;
  onExportScaleChange: (value: ExportScale) => void;
  onDownload: () => void;
  onShare: () => void;
  onShareToSocial: (platform: SocialPlatform) => Promise<'clipboard' | 'downloaded' | 'cancelled'>;
  isExporting: boolean;
  isSharing: boolean;
  canShare: boolean;
}

export interface CanvasPreviewProps {
  containerRef: RefObject<HTMLDivElement | null>;
  previewRef: RefObject<HTMLDivElement | null>;
  poemFrameRef: RefObject<HTMLDivElement | null>;
  poemTextRef: RefObject<HTMLDivElement | null>;
  t: TranslateFn;
  poem: PoemContentData;
  poemStyle: PoemLayerStyle;
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
  borderColor: string;
  borderWidth: number;
  showStamp: boolean;
  stamp: StampConfig;
  poemPosition: PositionedElement;
  onPoemPositionChange: (updates: Partial<PositionedElement>) => void;
  onStampChange: (updates: Partial<StampConfig>) => void;
  canvasWidth: number;
  canvasHeight: number;
  customTexts: CustomText[];
  onCustomTextChange: (id: string, updates: Partial<CustomText>) => void;
  logos: LogoConfig[];
  onLogoChange: (id: string, updates: Partial<LogoConfig>) => void;
  signatures: SignatureConfig[];
  onSignatureChange: (id: string, updates: Partial<SignatureConfig>) => void;
  exportFormat: ExportFormat;
  onExportFormatChange: (value: ExportFormat) => void;
  exportScale: ExportScale;
  onExportScaleChange: (value: ExportScale) => void;
  onDownload: () => void;
  onShare: () => void;
  onShareToSocial: (platform: SocialPlatform) => Promise<'clipboard' | 'downloaded' | 'cancelled'>;
  isExporting: boolean;
  isSharing: boolean;
  canShare: boolean;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  previewZoom: number;
  onPreviewZoomChange: (value: number) => void;
  onPreviewZoomReset: () => void;
  scale: number;
}

export interface BillingPackage {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
}

export interface BillingTransactionItem {
  id: string;
  type: string;
  amount: number;
  status: string;
  provider: string | null;
  created_at: string;
}

export interface BillingSectionProps {
  balance: number | null;
  isLoadingBalance: boolean;
  packages: BillingPackage[];
  isLoadingPackages: boolean;
  history: BillingTransactionItem[];
  isLoadingHistory: boolean;
  isPurchasing: boolean;
  onPurchase: (packageId: string) => Promise<void>;
}

export interface ControlSectionProps {
  title: string;
  icon: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  summary?: string;
  highlighted?: boolean;
  action?: ReactNode;
  children: ReactNode;
}
