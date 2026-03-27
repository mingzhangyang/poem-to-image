import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useAppAuth } from './context/auth';
import { useToast } from './components/ToastProvider';
import { getPlainPoemText, isSamePoemContent } from './poemContent';
import { DEFAULT_POEM_STYLE } from './poemStyle';
import { fallbackTranslations, loadTranslations, type Language, type TranslationKey } from './translations';
import { LANGUAGE_STORAGE_KEY, readPreferredLanguage } from './hooks/useLang';
import { CanvasPreview } from './components/CanvasPreview';
import { Sidebar } from './components/Sidebar';
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
import { useTemplateManager } from './hooks/useTemplateManager';
import { DEFAULT_POEMS } from './defaultPoems';
import { editorTemplates } from './templates';
import { isCjkLanguage } from './fontOptions';
import { usePageMetadata } from './hooks/usePageMetadata';
import type { ExpandedSections, ExportFormat, ExportScale } from './types';

const ONBOARDING_DISMISSED_STORAGE_KEY = 'poem-to-image.onboarding-dismissed';
const OnboardingModal = lazy(async () => ({ default: (await import('./components/OnboardingModal')).OnboardingModal }));

export default function App() {
  const { showToast } = useToast();
  const { getToken, isSignedIn } = useAppAuth();
  const [previewZoom, setPreviewZoom] = useState(1);
  const initialLanguageRef = useRef<Language>(readPreferredLanguage());
  const [language, setLanguage] = useState<Language>(initialLanguageRef.current);
  const [messages, setMessages] = useState(fallbackTranslations);
  const t = (key: TranslationKey) => messages[key] ?? fallbackTranslations[key];
  usePageMetadata({
    title: 'InkPoem – Turn Poems into Beautiful Art with AI',
    description: 'Turn your poems into stunning visual art with AI. Customize typography, backgrounds, and styles. Export in high resolution. Free to start.',
    canonical: 'https://inkpoem.com/',
    ogTitle: 'InkPoem – Turn Poems into Beautiful Art with AI',
    ogDescription: 'Turn your poems into stunning visual art with AI. Customize typography, backgrounds, and styles. Export in high resolution.',
    ogUrl: 'https://inkpoem.com/',
    robots: 'index, follow',
  });

  const handleLanguageChange = useCallback((newLang: Language) => {
    setPoem((prev) => {
      const isDefault = Object.values(DEFAULT_POEMS).some((poem) => isSamePoemContent(poem, prev));
      return isDefault ? DEFAULT_POEMS[newLang] : prev;
    });
    try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang); } catch { /* ignore */ }
    setLanguage(newLang);
  }, []);

  useEffect(() => {
    let ignore = false;

    void loadTranslations(language).then((nextMessages) => {
      if (!ignore) {
        setMessages(nextMessages);
      }
    });

    return () => {
      ignore = true;
    };
  }, [language]);

  const [poem, setPoem] = useState(DEFAULT_POEMS[initialLanguageRef.current]);
  const [poemStyle, setPoemStyle] = useState({ ...DEFAULT_POEM_STYLE });

  const [canvasWidth, setCanvasWidth] = useState(1080);
  const [canvasHeight, setCanvasHeight] = useState(1350);
  const [presetSize, setPresetSize] = useState(DEFAULT_CANVAS_PRESET_ID);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportScale, setExportScale] = useState<ExportScale>(2);
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
        if (response.ok && data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }

        showToast(data.error ?? t('checkoutFailed'), 'error');
      } catch {
        showToast(t('networkError'), 'error');
      } finally {
        setIsPurchasing(false);
      }
    },
    [getToken, showToast, t],
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

  const { activeTemplateId, handleApplyTemplate, handleApplyCustomTemplate, handleSaveCustomTemplate } =
    useTemplateManager({
      language,
      background,
      typography,
      decorations,
      poemStyle,
      setPoemStyle,
      setExpandedSections,
      customTemplates,
    });

  useEffect(() => {
    const isDismissed = window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY) === 'true';
    if (!isDismissed && !activeTemplateId) {
      setIsOnboardingOpen(true);
    }
  }, [activeTemplateId]);

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

  const stampSupported = isCjkLanguage(language);

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
        showStamp: decorations.showStamp && stampSupported,
        stamp: decorations.stamp,
        customTexts: decorations.customTexts,
        logos: decorations.logos,
        signatures: decorations.signatures,
      },
    },
    waitForSceneSettled,
  );
  // Wrap export action with toast feedback.
  const handleDownload = async () => {
    try {
      const success = await exportImage();
      if (success) {
        showToast(t('exportSuccess') || 'Image exported successfully.', 'success');
      }
    } catch (e) {
      showToast(t('exportFailed') || 'Image export failed.', 'error');
    }
  };

  const handlePreviewZoomReset = () => setPreviewZoom(1);

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
      onRenameCustomTemplate: customTemplates.renameCustomTemplate,
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
      stampSupported,
      stamp: decorations.stamp,
      poemPosition: decorations.poemPosition,
      customTexts: decorations.customTexts,
      logos: decorations.logos,
      signatures: decorations.signatures,
      onAddCustomText: decorations.addCustomText,
      onAddSignature: decorations.addSignature,
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
      onSignatureChange: decorations.updateSignature,
      onSignatureRemove: decorations.removeSignature,
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
    showStamp: decorations.showStamp && stampSupported,
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
    signatures: decorations.signatures,
    onSignatureChange: decorations.updateSignature,
    onInteractionStart,
    onInteractionEnd,
    previewZoom,
    onPreviewZoomChange: setPreviewZoom,
    onPreviewZoomReset: handlePreviewZoomReset,
    scale,
  });

  return (
    <div className="min-h-dvh bg-transparent flex flex-col md:flex-row font-sans text-(--app-ink)">
      <Sidebar {...sidebarProps} />

      <CanvasPreview {...canvasPreviewProps} />

      <Suspense fallback={null}>
        <OnboardingModal
          isOpen={isOnboardingOpen}
          onClose={handleCloseOnboarding}
          t={t}
          language={language}
          templates={sidebarProps.templates}
        />
      </Suspense>
    </div>
  );
}
