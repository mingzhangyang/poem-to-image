import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useAppAuth } from './context/auth';
import { useToast } from './components/ToastProvider';
import { getPlainPoemText, isSamePoemContent } from './poemContent';
import { DEFAULT_POEM_STYLE, isSamePoemLayerStyle } from './poemStyle';
import { translations, Language, TranslationKey } from './translations';
import { LANGUAGE_STORAGE_KEY, readPreferredLanguage } from './hooks/useLang';
import { CanvasPreview } from './components/CanvasPreview';
import { Sidebar } from './components/Sidebar';
import { OnboardingModal } from './components/OnboardingModal';
import { useBackgroundConfig } from './hooks/useBackgroundConfig';
import { useBalance } from './hooks/useBalance';
import { useBillingHistory } from './hooks/useBillingHistory';
import { useBillingPackages } from './hooks/useBillingPackages';
import { DEFAULT_CANVAS_PRESET_ID, getCanvasSizePresetById } from './canvasPresets';
import { useCanvasScale } from './hooks/useCanvasScale';
import { useCheckoutReturn } from './hooks/useCheckoutReturn';
import { useDecorationsConfig } from './hooks/useDecorationsConfig';
import { useEditorViewModels } from './hooks/useEditorViewModels';
import { useImageExporter } from './hooks/useImageExporter';
import { useTypographyConfig } from './hooks/useTypographyConfig';
import { useCustomTemplates } from './hooks/useCustomTemplates';
import { editorTemplates, resolveTemplateForLanguage } from './templates';
import type { EditorTemplateId, ExpandedSections, ExportFormat, ExportScale, PoemContentData } from './types';

const ACTIVE_TEMPLATE_STORAGE_KEY = 'poem-to-image.active-template';
const ONBOARDING_DISMISSED_STORAGE_KEY = 'poem-to-image.onboarding-dismissed';
const DEFAULT_POEMS: Record<Language, PoemContentData> = {
  'zh-CN': {
    title: '静夜思',
    author: '唐·李白',
    body: '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
    sourceNote: '',
  },
  'zh-TW': {
    title: '靜夜思',
    author: '唐·李白',
    body: '床前明月光，\n疑是地上霜。\n舉頭望明月，\n低頭思故鄉。',
    sourceNote: '',
  },
  en: {
    title: 'Sonnet 18',
    author: 'William Shakespeare',
    body: 'Shall I compare thee to a summer\'s day?\nThou art more lovely and more temperate.\nRough winds do shake the darling buds of May,\nAnd summer\'s lease hath all too short a date.',
    sourceNote: '',
  },
  ja: {
    title: '春はあけぼの',
    author: '清少納言',
    body: '春はあけぼの。\nやうやう白くなりゆく山ぎは、\n少し明かりて、\n紫だちたる雲の細くたなびきたる。',
    sourceNote: '『枕草子』',
  },
  ko: {
    title: '청산리 벽계수야',
    author: '황진이',
    body: '청산리 벽계수야\n수이 감을 자랑 마라\n일도 창해하면\n다시 오기 어려워라',
    sourceNote: '',
  },
  es: {
    title: 'Cultivo una rosa blanca',
    author: 'José Martí',
    body: 'Cultivo una rosa blanca\nen julio como en enero\npara el amigo sincero\nque me da su mano franca.',
    sourceNote: '',
  },
  fr: {
    title: 'Demain, dès l\'aube',
    author: 'Victor Hugo',
    body: 'Demain, dès l\'aube, à l\'heure où blanchit la campagne,\nJe partirai. Vois-tu, je sais que tu m\'attends.\nJ\'irai par la forêt, j\'irai par la montagne.\nJe ne puis demeurer loin de toi plus longtemps.',
    sourceNote: '',
  },
  de: {
    title: 'Wandrers Nachtlied',
    author: 'Johann Wolfgang von Goethe',
    body: 'Über allen Gipfeln\nIst Ruh,\nIn allen Wipfeln\nSpürest du\nKaum einen Hauch.',
    sourceNote: '',
  },
};

export default function App() {
  const { showToast } = useToast();
  const { getToken, isSignedIn } = useAppAuth();
  const [previewZoom, setPreviewZoom] = useState(1);
  const initialLanguageRef = useRef<Language>(readPreferredLanguage());
  const [language, setLanguage] = useState<Language>(initialLanguageRef.current);
  const t = (key: TranslationKey) => translations[language][key] ?? translations.en[key];

  const handleLanguageChange = useCallback((newLang: Language) => {
    setPoem((prev) => {
      const isDefault = Object.values(DEFAULT_POEMS).some((poem) => isSamePoemContent(poem, prev));
      return isDefault ? DEFAULT_POEMS[newLang] : prev;
    });
    try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang); } catch { /* ignore */ }
    setLanguage(newLang);
  }, []);

  const [poem, setPoem] = useState(DEFAULT_POEMS[initialLanguageRef.current]);
  const [poemStyle, setPoemStyle] = useState({ ...DEFAULT_POEM_STYLE });

  const [canvasWidth, setCanvasWidth] = useState(1080);
  const [canvasHeight, setCanvasHeight] = useState(1350);
  const [presetSize, setPresetSize] = useState(DEFAULT_CANVAS_PRESET_ID);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportScale, setExportScale] = useState<ExportScale>(2);
  const [activeTemplateId, setActiveTemplateId] = useState<EditorTemplateId | null>(null);
  const activeInteractionCountRef = useRef(0);
  const pendingSceneSettleResolversRef = useRef<Array<() => void>>([]);

  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    templates: true,
    canvasSize: false,
    content: true,
    background: false,
    typography: false,
    decorations: false,
    billing: false,
  });

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  useEffect(() => {
    const isDismissed = window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY) === 'true';
    if (!isDismissed && !activeTemplateId) {
      setIsOnboardingOpen(true);
    }
  }, [activeTemplateId]);

  const handleCloseOnboarding = () => {
    setIsOnboardingOpen(false);
    window.localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, 'true');
  };

  // Billing state
  const { balance, isLoading: isLoadingBalance, refetch: refetchBalance } = useBalance();
  const { packages, isLoading: isLoadingPackages } = useBillingPackages();
  const { items: history, isLoading: isLoadingHistory, refetch: refetchHistory } = useBillingHistory();
  const [isPurchasing, setIsPurchasing] = useState(false);

  useCheckoutReturn({ getToken, refetchBalance, refetchHistory });

  const handlePurchase = useCallback(
    async (packageId: string) => {
      setIsPurchasing(true);
      try {
        const token = await getToken();
        const response = await fetch('/api/billing/checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ packageId, returnPath: window.location.pathname }),
        });

        const data = (await response.json()) as { checkoutUrl?: string; error?: string };
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        }
      } catch {
        // Purchase failed silently
      } finally {
        setIsPurchasing(false);
      }
    },
    [getToken],
  );

  const handlePresetChange = (val: string) => {
    setPresetSize(val);
    if (val !== 'custom') {
      const preset = getCanvasSizePresetById(val);

      if (preset) {
        setCanvasWidth(preset.width);
        setCanvasHeight(preset.height);
        return;
      }

      // Backward compatibility for legacy ratio-based preset ids like "1080x1350".
      const [w, h] = val.split('x').map(Number);
      if (Number.isFinite(w) && Number.isFinite(h)) {
        setCanvasWidth(w);
        setCanvasHeight(h);
      }
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
  const poemFrameRef = useRef<HTMLDivElement>(null);
  const poemTextRef = useRef<HTMLDivElement>(null);

  const background = useBackgroundConfig({
    text: getPlainPoemText(poem),
    canvasWidth,
    canvasHeight,
    t,
    getToken,
    onBalanceChange: refetchBalance,
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
  const customTemplates = useCustomTemplates({ isSignedIn, getToken });

  const onInteractionStart = useCallback(() => {
    activeInteractionCountRef.current += 1;
  }, []);

  const onInteractionEnd = useCallback(() => {
    activeInteractionCountRef.current = Math.max(0, activeInteractionCountRef.current - 1);

    if (activeInteractionCountRef.current !== 0) {
      return;
    }

    const resolvers = pendingSceneSettleResolversRef.current.splice(0);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolvers.forEach((resolve) => resolve());
      });
    });
  }, []);

  const waitForSceneSettled = useCallback(async () => {
    if (activeInteractionCountRef.current > 0) {
      await new Promise<void>((resolve) => {
        pendingSceneSettleResolversRef.current.push(resolve);
      });
      return;
    }

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  }, []);

  const handleLogoUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      decorations.addLogo(imageUrl);
      setExpandedSections((prev) => ({ ...prev, decorations: true }));
    };
    reader.readAsDataURL(file);

    // Reset the input
    event.target.value = '';
  }, [decorations]);

  const scale = useCanvasScale(containerRef, canvasWidth, canvasHeight);
  const { exportImage, shareImage: handleShare, shareToSocialPlatform: handleShareToSocial, isExporting, isSharing, canShare } = useImageExporter(
    exportFormat,
    exportScale,
    {
      canvasWidth,
      canvasHeight,
      background: {
        backgroundType: background.backgroundType,
        backgroundColor: background.backgroundColor,
        gradientColor1: background.gradientColor1,
        gradientColor2: background.gradientColor2,
        gradientDirection: background.gradientDirection,
        backgroundImage: background.backgroundImage,
        bgBrightness: background.bgBrightness,
        bgBlur: background.bgBlur,
      },
      typography: {
        poem,
        poemStyle,
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
        poemPosition: decorations.poemPosition,
      },
      decorations: {
        showBorder: decorations.showBorder,
        borderStyle: decorations.borderStyle,
        borderColor: decorations.borderColor,
        borderWidth: decorations.borderWidth,
        showStamp: decorations.showStamp,
        stamp: decorations.stamp,
        customTexts: decorations.customTexts,
        logos: decorations.logos,
      },
    },
    waitForSceneSettled,
  );
  // 包装导出图片，添加toast提示
  const handleDownload = async () => {
    try {
      const success = await exportImage();
      if (success) {
        showToast(t('exportSuccess') || '图片导出成功', 'success');
      }
    } catch (e) {
      showToast(t('exportFailed') || '图片导出失败', 'error');
    }
  };

  const handlePreviewZoomReset = () => setPreviewZoom(1);
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
      decorations.borderColor === (templateDecorations.borderColor ?? resolvedTemplate.typography.textColor) &&
      decorations.borderWidth === (templateDecorations.borderWidth ?? 4) &&
      decorations.showStamp === templateDecorations.showStamp &&
      decorations.poemPosition.positionX === templateDecorations.poemPosition.positionX &&
      decorations.poemPosition.positionY === templateDecorations.poemPosition.positionY &&
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

  const matchesActiveTemplatePoemStyle = (templateId: EditorTemplateId, templateLanguage: Language) => {
    const resolvedTemplate = resolveTemplateForLanguage(templateId, templateLanguage);

    if (!resolvedTemplate?.poemStyle) {
      return false;
    }

    return isSamePoemLayerStyle(poemStyle, resolvedTemplate.poemStyle);
  };

  const applyTemplateById = (templateId: EditorTemplateId, options?: { expandSections?: boolean }) => {
    const template = resolveTemplateForLanguage(templateId, language);

    if (!template) {
      return false;
    }

    background.applyBackgroundTemplate(template.background);
    typography.applyTypographyTemplate(template.typography);
    decorations.applyDecorationsTemplate(template.decorations);
    setPoemStyle(template.poemStyle ?? { ...DEFAULT_POEM_STYLE });
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
    customTemplates.clearActiveCustomTemplate();
  };

  const handleApplyCustomTemplate = (id: string) => {
    const template = customTemplates.customTemplates.find((t) => t.id === id);
    if (!template) return;
    background.applyBackgroundTemplate(template.background);
    typography.applyTypographyTemplate(template.typography);
    decorations.applyDecorationsTemplate(template.decorations);
    setPoemStyle(template.poemStyle);
    customTemplates.applyCustomTemplate(id);
    setActiveTemplateId(null);
    setExpandedSections((prev) => ({
      ...prev,
      templates: true,
      background: true,
      typography: true,
      decorations: true,
    }));
  };

  const handleSaveCustomTemplate = (name: string) => {
    const bgConfig = {
      backgroundType: (background.backgroundType === 'image' || background.backgroundType === 'ai')
        ? 'solid' as const
        : background.backgroundType,
      backgroundColor: background.backgroundColor,
      gradientColor1: background.gradientColor1,
      gradientColor2: background.gradientColor2,
      gradientDirection: background.gradientDirection,
      bgBrightness: background.bgBrightness,
      bgBlur: background.bgBlur,
    };
    const decConfig = {
      showBorder: decorations.showBorder,
      borderStyle: decorations.borderStyle,
      borderColor: decorations.borderColor,
      borderWidth: decorations.borderWidth,
      showStamp: decorations.showStamp,
      stamp: decorations.stamp,
      poemPosition: decorations.poemPosition,
      customTexts: decorations.customTexts,
    };
    const typConfig = {
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
    };
    void customTemplates.saveCustomTemplate(name, bgConfig, typConfig, decConfig, poemStyle);
    setActiveTemplateId(null);
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
    const shouldSyncPoemStyle = activeTemplateId ? matchesActiveTemplatePoemStyle(activeTemplateId, previousLanguage) : false;

    if (activeTemplateId && (shouldSyncTypography || shouldSyncDecorations || shouldSyncPoemStyle)) {
      const resolvedTemplate = resolveTemplateForLanguage(activeTemplateId, language);

      if (resolvedTemplate) {
        if (shouldSyncTypography) {
          typography.applyTypographyTemplate(resolvedTemplate.typography);
        }

        if (shouldSyncDecorations) {
          decorations.applyDecorationsTemplate(resolvedTemplate.decorations);
        }

        if (shouldSyncPoemStyle) {
          setPoemStyle(resolvedTemplate.poemStyle ?? { ...DEFAULT_POEM_STYLE });
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
    decorations.poemPosition.positionX,
    decorations.poemPosition.positionY,
    decorations.stamp.text,
    decorations.stamp.style,
    decorations.stamp.positionX,
    decorations.stamp.positionY,
    decorations.stamp.size,
    decorations.stamp.rotation,
    decorations.stamp.opacity,
    decorations.customTexts.length,
    poemStyle,
  ]);

  const { sidebarProps, canvasPreviewProps } = useEditorViewModels({
    language,
    onLanguageChange: handleLanguageChange,
    t,
    expandedSections,
    onToggleSection: toggleSection,
    onExpandSection: expandSection,
    templates: {
      templates: editorTemplates,
      activeTemplateId,
      onApplyTemplate: handleApplyTemplate,
      customTemplates: customTemplates.customTemplates,
      activeCustomTemplateId: customTemplates.activeCustomTemplateId,
      onApplyCustomTemplate: handleApplyCustomTemplate,
      onSaveCustomTemplate: handleSaveCustomTemplate,
      onDeleteCustomTemplate: customTemplates.deleteCustomTemplate,
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
      poem,
      poemStyle,
      onTitleChange: (value) => setPoem((prev) => ({ ...prev, title: value })),
      onAuthorChange: (value) => setPoem((prev) => ({ ...prev, author: value })),
      onBodyChange: (value) => setPoem((prev) => ({ ...prev, body: value })),
      onSourceNoteChange: (value) => setPoem((prev) => ({ ...prev, sourceNote: value })),
      onPoemStyleChange: (updates) => setPoemStyle((prev) => ({ ...prev, ...updates })),
      onResetPoemStyle: () => setPoemStyle({ ...DEFAULT_POEM_STYLE }),
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
      aiProvider: background.aiProvider,
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
      onAiProviderChange: background.onAiProviderChange,
      onAiPromptChange: background.setAiPrompt,
      onGenerateAiBackground: background.onGenerateAiBackground,
      onBgBrightnessChange: background.setBgBrightness,
      onBgBlurChange: background.setBgBlur,
    },
    typography,
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
      onAddCustomText: decorations.addCustomText,
      onShowBorderChange: decorations.setShowBorder,
      onBorderStyleChange: decorations.setBorderStyle,
      onBorderColorChange: decorations.setBorderColor,
      onBorderWidthChange: decorations.setBorderWidth,
      onShowStampChange: decorations.setShowStamp,
      onStampChange: decorations.setStamp,
      onPoemPositionChange: decorations.setPoemPosition,
      onResetStampPosition: decorations.resetStampPosition,
      onCustomTextChange: decorations.updateCustomText,
      onCustomTextRemove: decorations.removeCustomText,
      onCustomTextReorder: decorations.onCustomTextReorder,
      onLogoUpload: handleLogoUpload,
      onLogoChange: decorations.updateLogo,
      onLogoRemove: decorations.removeLogo,
      onLogoReorder: decorations.onLogoReorder,
    },
    billing: {
      balance,
      isLoadingBalance,
      packages,
      isLoadingPackages,
      history,
      isLoadingHistory,
      isPurchasing,
      onPurchase: handlePurchase,
    },
    exportFormat,
    onExportFormatChange: setExportFormat,
    exportScale,
    onExportScaleChange: setExportScale,
    onDownload: handleDownload,
    onShare: handleShare,
    onShareToSocial: handleShareToSocial,
    isExporting,
    isSharing,
    canShare,
    containerRef,
    previewRef,
    poemFrameRef,
    poemTextRef,
    poem,
    poemStyle,
    backgroundType: background.backgroundType,
    backgroundStyle: background.backgroundStyle,
    bgBrightness: background.bgBrightness,
    bgBlur: background.bgBlur,
    showBorder: decorations.showBorder,
    borderStyle: decorations.borderStyle,
    borderColor: decorations.borderColor,
    borderWidth: decorations.borderWidth,
    showStamp: decorations.showStamp,
    stamp: decorations.stamp,
    poemPosition: decorations.poemPosition,
    onPoemPositionChange: decorations.setPoemPosition,
    onStampChange: decorations.setStamp,
    canvasWidth,
    canvasHeight,
    customTexts: decorations.customTexts,
    onCustomTextChange: decorations.updateCustomText,
    logos: decorations.logos,
    onLogoChange: decorations.updateLogo,
    onInteractionStart,
    onInteractionEnd,
    previewZoom,
    onPreviewZoomChange: setPreviewZoom,
    onPreviewZoomReset: handlePreviewZoomReset,
    scale,
  });

  return (
    <div className="min-h-dvh bg-transparent flex flex-col md:flex-row font-sans text-(--app-ink)">
      <title>InkPoem – Turn Poems into Beautiful Art with AI</title>
      <meta name="description" content="Turn your poems into stunning visual art with AI. Customize typography, backgrounds, and styles. Export in high resolution. Free to start." />
      <link rel="canonical" href="https://inkpoem.com/" />
      <Sidebar {...sidebarProps} />

      <CanvasPreview {...canvasPreviewProps} />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={handleCloseOnboarding}
        t={t}
        language={language}
        templates={sidebarProps.templates}
      />
    </div>
  );
}
