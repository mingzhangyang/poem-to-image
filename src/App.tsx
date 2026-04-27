import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useAppAuth } from './context/auth';
import { useToast } from './components/ToastProvider';
import { getPlainPoemText, isSamePoemContent } from './poemContent';
import { DEFAULT_POEM_STYLE } from './poemStyle';
import { type Language } from './translations';
import { CanvasPreview } from './components/CanvasPreview';
import { Sidebar } from './components/Sidebar';
import { useBackgroundConfig } from './hooks/useBackgroundConfig';
import { DEFAULT_CANVAS_PRESET_ID, getCanvasSizePresetById } from './canvasPresets';
import { useCanvasScale } from './hooks/useCanvasScale';
import { useDecorationsConfig } from './hooks/useDecorationsConfig';
import { useEditorViewModels } from './hooks/useEditorViewModels';
import { useImageExporter } from './hooks/useImageExporter';
import { useTypographyConfig } from './hooks/useTypographyConfig';
import { useCustomTemplates } from './hooks/useCustomTemplates';
import { useTemplateManager } from './hooks/useTemplateManager';
import { usePoemAutofill } from './hooks/usePoemAutofill';
import { useAppLanguage } from './hooks/useAppLanguage';
import { useBillingState } from './hooks/useBillingState';
import { useEditorHistory } from './hooks/useEditorHistory';
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

  const { language, initialLanguageRef, t, changeLanguage } = useAppLanguage();

  usePageMetadata({
    title: 'InkPoem – Turn Poems into Beautiful Art with AI',
    description: 'Turn your poems into stunning visual art with AI. Customize typography, backgrounds, and styles. Export in high resolution. Free to start.',
    canonical: 'https://inkpoem.com/',
    ogTitle: 'InkPoem – Turn Poems into Beautiful Art with AI',
    ogDescription: 'Turn your poems into stunning visual art with AI. Customize typography, backgrounds, and styles. Export in high resolution.',
    ogUrl: 'https://inkpoem.com/',
    robots: 'index, follow',
  });

  const [poem, setPoem] = useState(DEFAULT_POEMS[initialLanguageRef.current]);
  const [poemStyle, setPoemStyle] = useState({ ...DEFAULT_POEM_STYLE });
  const poemAutofill = usePoemAutofill({ poem, language });

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
  const [previewZoom, setPreviewZoom] = useState(1);

  const handleCloseOnboarding = () => {
    setIsOnboardingOpen(false);
    window.localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, 'true');
  };

  const billing = useBillingState({ getToken, t });

  const handleLanguageChange = useCallback(
    (newLang: Language) => {
      setPoem((prev) => {
        const isDefault = Object.values(DEFAULT_POEMS).some((poem) => isSamePoemContent(poem, prev));
        return isDefault ? DEFAULT_POEMS[newLang] : prev;
      });
      changeLanguage(newLang);
    },
    [changeLanguage],
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
    onBalanceChange: billing.refetchBalance,
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

  const stampSupported = isCjkLanguage(language);

  const exportScene = useMemo(
    () => ({
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
    }),
    [
      canvasWidth,
      canvasHeight,
      background.backgroundType,
      background.backgroundColor,
      background.gradientColor1,
      background.gradientColor2,
      background.gradientDirection,
      background.backgroundImage,
      background.bgBrightness,
      background.bgBlur,
      poem,
      poemStyle,
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
      decorations.poemPosition,
      decorations.showBorder,
      decorations.borderStyle,
      decorations.borderColor,
      decorations.borderWidth,
      decorations.showStamp,
      stampSupported,
      decorations.stamp,
      decorations.customTexts,
      decorations.logos,
      decorations.signatures,
    ],
  );

  const { canUndo, canRedo, handleUndo, handleRedo } = useEditorHistory({
    exportScene,
    poem,
    poemStyle,
    canvasWidth,
    canvasHeight,
    background,
    typography,
    decorations,
    setPoem,
    setPoemStyle,
    setCanvasWidth,
    setCanvasHeight,
    setPresetSize,
  });

  const onInteractionStart = useCallback(() => {
    activeInteractionCountRef.current += 1;
  }, []);

  const onInteractionEnd = useCallback(() => {
    activeInteractionCountRef.current = Math.max(0, activeInteractionCountRef.current - 1);
    if (activeInteractionCountRef.current !== 0) return;
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

  const handleLogoUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        decorations.addLogo(imageUrl);
        setExpandedSections((prev) => ({ ...prev, decorations: true }));
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    },
    [decorations],
  );

  const scale = useCanvasScale(containerRef, canvasWidth, canvasHeight);

  const {
    exportImage,
    shareImage: handleShare,
    shareToSocialPlatform: handleShareToSocial,
    isExporting,
    isSharing,
    canShare,
  } = useImageExporter(exportFormat, exportScale, exportScene, waitForSceneSettled);

  const handleDownload = async () => {
    try {
      const success = await exportImage();
      if (success) showToast(t('exportSuccess') || 'Image exported successfully.', 'success');
    } catch {
      showToast(t('exportFailed') || 'Image export failed.', 'error');
    }
  };

  useEffect(() => {
    const isDismissed = window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY) === 'true';
    if (!isDismissed && !activeTemplateId) setIsOnboardingOpen(true);
  }, [activeTemplateId]);

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
      poemAutofillSuggestion: poemAutofill.suggestion,
      isPoemAutofillMatching: poemAutofill.isMatching,
      onTitleChange: (value) => setPoem((prev) => ({ ...prev, title: value })),
      onAuthorChange: (value) => setPoem((prev) => ({ ...prev, author: value })),
      onBodyChange: (value) => setPoem((prev) => ({ ...prev, body: value })),
      onSourceNoteChange: (value) => setPoem((prev) => ({ ...prev, sourceNote: value })),
      onApplyPoemAutofill: () => {
        const suggestion = poemAutofill.applySuggestionToPoem();
        if (!suggestion) return;
        setPoem({
          title: suggestion.title,
          author: suggestion.author,
          body: suggestion.body,
          sourceNote: suggestion.sourceNote,
        });
      },
      onDismissPoemAutofill: poemAutofill.dismissSuggestion,
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
      backgroundSize: background.backgroundSize,
      onBackgroundSizeChange: background.setBackgroundSize,
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
      balance: billing.balance,
      isLoadingBalance: billing.isLoadingBalance,
      packages: billing.packages,
      isLoadingPackages: billing.isLoadingPackages,
      history: billing.history,
      isLoadingHistory: billing.isLoadingHistory,
      isPurchasing: billing.isPurchasing,
      onPurchase: billing.handlePurchase,
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
    onPreviewZoomReset: () => setPreviewZoom(1),
    scale,
  });

  return (
    <div className="min-h-dvh bg-transparent flex flex-col md:flex-row font-sans text-(--app-ink)">
      <Sidebar {...sidebarProps} />

      <CanvasPreview {...canvasPreviewProps} canUndo={canUndo} canRedo={canRedo} onUndo={handleUndo} onRedo={handleRedo} />

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
