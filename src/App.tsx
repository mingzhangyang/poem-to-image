import { useEffect, useRef, useState } from 'react';
import { translations, Language, TranslationKey } from './translations';
import { CanvasPreview } from './components/CanvasPreview';
import { Sidebar } from './components/Sidebar';
import { useBackgroundConfig } from './hooks/useBackgroundConfig';
import { useCanvasScale } from './hooks/useCanvasScale';
import { useDecorationsConfig } from './hooks/useDecorationsConfig';
import { useEditorViewModels } from './hooks/useEditorViewModels';
import { useImageExporter } from './hooks/useImageExporter';
import { useTypographyConfig } from './hooks/useTypographyConfig';
import { editorTemplates, resolveTemplateForLanguage } from './templates';
import type { EditorTemplateId, ExpandedSections, ExportScale } from './types';

const ACTIVE_TEMPLATE_STORAGE_KEY = 'poem-to-image.active-template';

export default function App() {
  const [language, setLanguage] = useState<Language>('zh-CN');
  const t = (key: TranslationKey) => translations[language][key];

  const [text, setText] = useState('床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。');

  const [canvasWidth, setCanvasWidth] = useState(1080);
  const [canvasHeight, setCanvasHeight] = useState(1350);
  const [presetSize, setPresetSize] = useState('1080x1350');
  const [exportScale, setExportScale] = useState<ExportScale>(2);
  const [activeTemplateId, setActiveTemplateId] = useState<EditorTemplateId | null>(null);

  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    templates: false,
    canvasSize: true,
    content: true,
    background: true,
    typography: false,
    decorations: false
  });

  const handlePresetChange = (val: string) => {
    setPresetSize(val);
    if (val !== 'custom') {
      const [w, h] = val.split('x').map(Number);
      setCanvasWidth(w);
      setCanvasHeight(h);
    }
  };

  const toggleSection = (section: keyof ExpandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const expandSection = (section: keyof ExpandedSections) => {
    setExpandedSections((prev) => (prev[section] ? prev : { ...prev, [section]: true }));
  };

  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const background = useBackgroundConfig({
    text,
    canvasWidth,
    canvasHeight,
    t,
  });
  const typography = useTypographyConfig(language);
  const decorations = useDecorationsConfig({
    language,
    t,
    fontSize: typography.fontSize,
    textColor: typography.textColor,
    writingMode: typography.writingMode,
    onCustomTextAdded: () => setExpandedSections((prev) => ({ ...prev, decorations: true })),
  });

  const scale = useCanvasScale(containerRef, canvasWidth, canvasHeight);
  const handleDownload = useImageExporter(previewRef, canvasWidth, canvasHeight, exportScale);
  const previousLanguageRef = useRef(language);

  const matchesActiveTemplateTypography = (templateId: EditorTemplateId, templateLanguage: Language) => {
    const resolvedTemplate = resolveTemplateForLanguage(templateId, templateLanguage);

    if (!resolvedTemplate) {
      return false;
    }

    const { typography: templateTypography } = resolvedTemplate;

    return (
      typography.fontFamily === templateTypography.fontFamily &&
      typography.fontSize === templateTypography.fontSize &&
      typography.textColor === templateTypography.textColor &&
      typography.textAlign === templateTypography.textAlign &&
      typography.writingMode === templateTypography.writingMode &&
      typography.padding === templateTypography.padding &&
      typography.lineHeight === templateTypography.lineHeight &&
      typography.letterSpacing === templateTypography.letterSpacing &&
      typography.columns === templateTypography.columns &&
      typography.columnGap === templateTypography.columnGap &&
      typography.textShadowEnabled === templateTypography.textShadowEnabled &&
      typography.textShadowColor === templateTypography.textShadowColor &&
      typography.textShadowBlur === templateTypography.textShadowBlur &&
      typography.textShadowOffsetY === templateTypography.textShadowOffsetY &&
      typography.textShadowOffsetX === templateTypography.textShadowOffsetX
    );
  };

  const matchesActiveTemplateDecorations = (templateId: EditorTemplateId, templateLanguage: Language) => {
    const resolvedTemplate = resolveTemplateForLanguage(templateId, templateLanguage);

    if (!resolvedTemplate) {
      return false;
    }

    const { decorations: templateDecorations } = resolvedTemplate;

    return (
      decorations.showBorder === templateDecorations.showBorder &&
      decorations.borderStyle === templateDecorations.borderStyle &&
      decorations.showStamp === templateDecorations.showStamp &&
      decorations.stamp.text === templateDecorations.stamp.text &&
      decorations.stamp.style === templateDecorations.stamp.style &&
      decorations.stamp.positionX === templateDecorations.stamp.positionX &&
      decorations.stamp.positionY === templateDecorations.stamp.positionY &&
      decorations.stamp.size === templateDecorations.stamp.size &&
      decorations.stamp.rotation === templateDecorations.stamp.rotation &&
      decorations.stamp.opacity === templateDecorations.stamp.opacity &&
      decorations.customTexts.length === templateDecorations.customTexts.length
    );
  };

  const applyTemplateById = (templateId: EditorTemplateId, options?: { expandSections?: boolean }) => {
    const template = resolveTemplateForLanguage(templateId, language);

    if (!template) {
      return false;
    }

    background.applyBackgroundTemplate(template.background);
    typography.applyTypographyTemplate(template.typography);
    decorations.applyDecorationsTemplate(template.decorations);
    setActiveTemplateId(templateId);

    if (options?.expandSections ?? true) {
      setExpandedSections((prev) => ({
        ...prev,
        templates: true,
        background: true,
        typography: true,
        decorations: true,
      }));
    }

    return true;
  };

  const handleApplyTemplate = (templateId: EditorTemplateId) => {
    applyTemplateById(templateId);
  };

  useEffect(() => {
    const storedTemplateId = window.localStorage.getItem(ACTIVE_TEMPLATE_STORAGE_KEY) as EditorTemplateId | null;

    if (!storedTemplateId) {
      return;
    }

    const didApply = applyTemplateById(storedTemplateId, { expandSections: false });

    if (!didApply) {
      window.localStorage.removeItem(ACTIVE_TEMPLATE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!activeTemplateId) {
      window.localStorage.removeItem(ACTIVE_TEMPLATE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ACTIVE_TEMPLATE_STORAGE_KEY, activeTemplateId);
  }, [activeTemplateId]);

  useEffect(() => {
    const previousLanguage = previousLanguageRef.current;
    const shouldSyncTypography = activeTemplateId ? matchesActiveTemplateTypography(activeTemplateId, previousLanguage) : false;
    const shouldSyncDecorations = activeTemplateId ? matchesActiveTemplateDecorations(activeTemplateId, previousLanguage) : false;

    if (activeTemplateId && (shouldSyncTypography || shouldSyncDecorations)) {
      const resolvedTemplate = resolveTemplateForLanguage(activeTemplateId, language);

      if (resolvedTemplate) {
        if (shouldSyncTypography) {
          typography.applyTypographyTemplate(resolvedTemplate.typography);
        }

        if (shouldSyncDecorations) {
          decorations.applyDecorationsTemplate(resolvedTemplate.decorations);
        }
      }
    }

    previousLanguageRef.current = language;
  }, [
    activeTemplateId,
    language,
    typography.fontFamily,
    typography.fontSize,
    typography.textColor,
    typography.textAlign,
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
    decorations.showBorder,
    decorations.borderStyle,
    decorations.showStamp,
    decorations.stamp.text,
    decorations.stamp.style,
    decorations.stamp.positionX,
    decorations.stamp.positionY,
    decorations.stamp.size,
    decorations.stamp.rotation,
    decorations.stamp.opacity,
    decorations.customTexts.length,
  ]);

  const { sidebarProps, canvasPreviewProps } = useEditorViewModels({
    language,
    onLanguageChange: setLanguage,
    t,
    expandedSections,
    onToggleSection: toggleSection,
    onExpandSection: expandSection,
    templates: {
      templates: editorTemplates,
      activeTemplateId,
      onApplyTemplate: handleApplyTemplate,
    },
    canvas: {
      presetSize,
      canvasWidth,
      canvasHeight,
      onPresetChange: handlePresetChange,
      onCanvasWidthChange: setCanvasWidth,
      onCanvasHeightChange: setCanvasHeight,
    },
    content: {
      text,
      onTextChange: setText,
    },
    background: {
      backgroundType: background.backgroundType,
      backgroundColor: background.backgroundColor,
      gradientColor1: background.gradientColor1,
      gradientColor2: background.gradientColor2,
      gradientDirection: background.gradientDirection,
      backgroundImage: background.backgroundImage,
      bgBrightness: background.bgBrightness,
      bgBlur: background.bgBlur,
      aiPrompt: background.aiPrompt,
      aiError: background.aiError,
      isGeneratingAI: background.isGeneratingAI,
      fileInputRef: background.fileInputRef,
      onBackgroundTypeChange: background.setBackgroundType,
      onBackgroundColorChange: background.setBackgroundColor,
      onGradientColor1Change: background.setGradientColor1,
      onGradientColor2Change: background.setGradientColor2,
      onGradientDirectionChange: background.setGradientDirection,
      onImageUpload: background.onImageUpload,
      onAiPromptChange: background.setAiPrompt,
      onGenerateAiBackground: background.onGenerateAiBackground,
      onBgBrightnessChange: background.setBgBrightness,
      onBgBlurChange: background.setBgBlur,
    },
    typography,
    decorations: {
      showBorder: decorations.showBorder,
      borderStyle: decorations.borderStyle,
      showStamp: decorations.showStamp,
      stamp: decorations.stamp,
      customTexts: decorations.customTexts,
      onAddCustomText: decorations.addCustomText,
      onShowBorderChange: decorations.setShowBorder,
      onBorderStyleChange: decorations.setBorderStyle,
      onShowStampChange: decorations.setShowStamp,
      onStampChange: decorations.setStamp,
      onResetStampPosition: decorations.resetStampPosition,
      onCustomTextChange: decorations.updateCustomText,
      onCustomTextRemove: decorations.removeCustomText,
    },
    exportScale,
    onExportScaleChange: setExportScale,
    onDownload: handleDownload,
    containerRef,
    previewRef,
    text,
    backgroundType: background.backgroundType,
    backgroundStyle: background.backgroundStyle,
    bgBrightness: background.bgBrightness,
    bgBlur: background.bgBlur,
    showBorder: decorations.showBorder,
    borderStyle: decorations.borderStyle,
    showStamp: decorations.showStamp,
    stamp: decorations.stamp,
    onStampChange: decorations.setStamp,
    canvasWidth,
    canvasHeight,
    customTexts: decorations.customTexts,
    scale,
  });

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col md:flex-row font-sans text-gray-800">
      <Sidebar {...sidebarProps} />

      <CanvasPreview {...canvasPreviewProps} />
    </div>
  );
}

