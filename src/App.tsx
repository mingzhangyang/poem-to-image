import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
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
import { useEditorPersistence, loadPersistedState } from './hooks/useEditorPersistence';
import { DEFAULT_POEMS } from './defaultPoems';
import { editorTemplates } from './templates';
import { isCjkLanguage } from './fontOptions';
import { ensureFontLoaded } from './fontLoader';
import { usePageMetadata } from './hooks/usePageMetadata';
import { useStructuralMemo } from './hooks/useStructuralMemo';
import type { ExpandedSections, ExportFormat, ExportScale } from './types';
import { PublishDialog, type PublishedShare } from './sharing/PublishDialog';
import { shareCopy } from './sharing/copy';
import {
  PendingShareConflict, completePublishCredentials, fingerprintArtwork,
  preparePublishCredentials, removePublishCredentials,
} from './sharing/publishProtocol';

const ONBOARDING_DISMISSED_STORAGE_KEY = 'poem-to-image.onboarding-dismissed';
const OnboardingModal = lazy(async () => ({ default: (await import('./components/OnboardingModal')).OnboardingModal }));
const MIN_CANVAS_SIZE = 100;
const MAX_CANVAS_SIZE = 4000;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeCanvasSize(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.round(clampNumber(value, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE));
}

export default function App() {
  const { showToast } = useToast();
  const { getToken, isSignedIn } = useAppAuth();

  const { language, initialLanguageRef, t, changeLanguage } = useAppLanguage();

  // Load once on first render; drives initial state for poem/canvas and a one-time layout effect for hooks.
  const [initialState] = useState(() => loadPersistedState());

  usePageMetadata({
    title: 'InkPoem – Turn Poems into Beautiful Art with AI',
    description: 'Turn your poems into stunning visual art with AI. Customize typography, backgrounds, and styles. Export in high resolution. Free to start.',
    canonical: 'https://inkpoem.com/',
    ogTitle: 'InkPoem – Turn Poems into Beautiful Art with AI',
    ogDescription: 'Turn your poems into stunning visual art with AI. Customize typography, backgrounds, and styles. Export in high resolution.',
    ogUrl: 'https://inkpoem.com/',
    robots: 'index, follow',
  });

  const [poem, setPoem] = useState(() => initialState?.poem ?? DEFAULT_POEMS[initialLanguageRef.current]);
  const [poemStyle, setPoemStyle] = useState(() => initialState?.poemStyle ?? { ...DEFAULT_POEM_STYLE });
  const poemAutofill = usePoemAutofill({ poem, language });

  const [canvasWidth, setCanvasWidthState] = useState(() => normalizeCanvasSize(initialState?.canvasWidth, 1080));
  const [canvasHeight, setCanvasHeightState] = useState(() => normalizeCanvasSize(initialState?.canvasHeight, 1350));
  const [presetSize, setPresetSize] = useState(() => {
    const savedPresetId = initialState?.presetSize ?? DEFAULT_CANVAS_PRESET_ID;
    const savedPreset = getCanvasSizePresetById(savedPresetId);
    // Legacy selectors persist their dimensions as a ratio ID (e.g. 1080x1350).
    // Accept those IDs only when their recorded dimensions still match.
    const legacySize = /^(\d+)x(\d+)$/.exec(savedPresetId);
    const savedWidth = savedPreset?.width ?? (legacySize ? Number(legacySize[1]) : null);
    const savedHeight = savedPreset?.height ?? (legacySize ? Number(legacySize[2]) : null);
    return savedWidth === canvasWidth && savedHeight === canvasHeight ? savedPresetId : 'custom';
  });
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportScale, setExportScale] = useState<ExportScale>(2);
  const activeInteractionCountRef = useRef(0);
  const pendingSceneSettleResolversRef = useRef<Array<() => void>>([]);

  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    templates: false,
    canvasSize: false,
    content: true,
    background: false,
    typography: false,
    decorations: false,
    billing: false,
  });

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [editorOpenRequestId, setEditorOpenRequestId] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  const handleCloseOnboarding = () => {
    setIsOnboardingOpen(false);
    window.localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, 'true');
  };

  const handleStartFromOnboarding = () => {
    handleCloseOnboarding();
    setExpandedSections((current) => ({ ...current, content: true, templates: false }));
    setEditorOpenRequestId((current) => current + 1);
  };

  const billing = useBillingState({ getToken, t });

  const setCanvasWidth = useCallback((value: number) => {
    setCanvasWidthState((current) => normalizeCanvasSize(value, current));
  }, []);

  const setCanvasHeight = useCallback((value: number) => {
    setCanvasHeightState((current) => normalizeCanvasSize(value, current));
  }, []);

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
        setCanvasWidthState(normalizeCanvasSize(preset.width, 1080));
        setCanvasHeightState(normalizeCanvasSize(preset.height, 1350));
        return;
      }
      // Backward compatibility for legacy ratio-based preset ids like "1080x1350".
      const [w, h] = val.split('x').map(Number);
      if (Number.isFinite(w) && Number.isFinite(h)) {
        setCanvasWidthState(normalizeCanvasSize(w, 1080));
        setCanvasHeightState(normalizeCanvasSize(h, 1350));
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
      hasPersistedEditorState: initialState !== null,
      background,
      typography,
      decorations,
      poemStyle,
      setPoemStyle,
      setExpandedSections,
      customTemplates,
    });

  const stampSupported = isCjkLanguage(language);

  // Load Google Fonts on demand: the currently selected poem font, and the stamp
  // font when a stamp is shown. Other families are never fetched.
  useEffect(() => {
    ensureFontLoaded(typography.fontFamily);
  }, [typography.fontFamily]);

  useEffect(() => {
    if (decorations.showStamp && stampSupported) {
      ensureFontLoaded(decorations.stamp.fontFamily);
    }
  }, [decorations.showStamp, stampSupported, decorations.stamp.fontFamily]);

  // Restore persisted background/typography/decorations once after hooks initialize.
  // Refs ensure we always call the latest version of each apply function.
  const applyBgRef = useRef(background.applyBackgroundTemplate);
  applyBgRef.current = background.applyBackgroundTemplate;
  const applyTypoRef = useRef(typography.applyTypographyTemplate);
  applyTypoRef.current = typography.applyTypographyTemplate;
  const applyDecoRef = useRef(decorations.applyDecorationsTemplate);
  applyDecoRef.current = decorations.applyDecorationsTemplate;

  useLayoutEffect(() => {
    if (!initialState) return;
    applyBgRef.current(initialState.background);
    applyTypoRef.current(initialState.typography);
    applyDecoRef.current(initialState.decorations);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuilt every render from its source fields and stabilized by deep equality.
  // No dependency array to keep in sync, so a new field can't silently go stale.
  const exportScene = useStructuralMemo({
    canvasWidth,
    canvasHeight,
    background: {
      backgroundType: background.backgroundType,
      paperId: background.paperId,
      backgroundColor: background.backgroundColor,
      gradientColor1: background.gradientColor1,
      gradientColor2: background.gradientColor2,
      gradientDirection: background.gradientDirection,
      backgroundImage: background.backgroundImage,
      backgroundImageSource: background.backgroundImageSource,
      backgroundSize: background.backgroundSize,
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
  });

  const { canUndo, canRedo, handleUndo, handleRedo } = useEditorHistory({
    exportScene,
    poem,
    poemStyle,
    canvasWidth,
    canvasHeight,
    presetSize,
    background,
    typography,
    decorations,
    setPoem,
    setPoemStyle,
    setCanvasWidth,
    setCanvasHeight,
    setPresetSize,
  });

  useEditorPersistence({
    exportScene,
    poem,
    poemStyle,
    canvasWidth,
    canvasHeight,
    presetSize,
    background,
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
    copyImage,
    createShareAssets,
    shareToSocialPlatform: handleShareToSocial,
    isExporting,
    isSharing,
    canShare,
  } = useImageExporter(exportFormat, exportScale, exportScene, waitForSceneSettled);

  const publishArtwork = async (): Promise<PublishedShare> => {
    const { artwork, card } = await createShareAssets();
    const title = poem.title.trim().slice(0, 120);
    const author = poem.author.trim().slice(0, 100);
    const fingerprint = await fingerprintArtwork(artwork, card, title, author);
    const link = (id: string) => new URL('/s/' + id, window.location.origin).toString();

    let credentials;
    try {
      credentials = preparePublishCredentials(localStorage, fingerprint);
    } catch (error) {
      if (error instanceof PendingShareConflict) {
        // Never silently replace credentials for a possibly public prior
        // upload. Surface the old ID/key so the creator can resolve it first.
        const pending = error.pending;
        return {
          id: pending.id, url: link(pending.id),
          deleteToken: pending.deleteToken, statusUnknown: true, pendingChanged: true,
        };
      }
      throw error;
    }

    const unknown = (): PublishedShare => ({
      id: credentials.id, url: link(credentials.id),
      deleteToken: credentials.deleteToken, statusUnknown: true,
    });
    const form = new FormData();
    form.append('id', credentials.id);
    form.append('deleteToken', credentials.deleteToken);
    form.append('artwork', artwork, artwork.type === 'image/png' ? 'artwork.png' : 'artwork.jpg');
    form.append('card', card, 'card.jpg');
    form.append('title', title);
    form.append('author', author);

    let response: Response;
    try {
      response = await fetch('/api/shares', { method: 'POST', body: form });
    } catch {
      // The Worker may already have committed. Keep the pre-stored ID and
      // deletion token and do NOT create another share on retry.
      return unknown();
    }

    let body: Partial<PublishedShare> & { code?: string };
    try {
      body = await response.json() as Partial<PublishedShare> & { code?: string };
    } catch {
      return unknown();
    }
    if (!response.ok) {
      // A previous request with these credentials may still be committing to
      // D1/R2. A 429, 400 or 409 for a later retry is NOT proof that the
      // earlier attempt failed. Keep the owner key and pending reservation.
      // The creator may safely retry or explicitly cancel the identifier.
      if (body.code === 'SHARE_CANCELLED') {
        removePublishCredentials(localStorage, credentials.id, credentials.deleteToken);
        throw new Error('SHARE_CANCELLED');
      }
      return unknown();
    }
    if (body.id !== credentials.id || body.deleteToken !== credentials.deleteToken) return unknown();
    completePublishCredentials(localStorage, credentials);
    return { id: credentials.id, url: link(credentials.id), deleteToken: credentials.deleteToken };
  };

  const handleDownload = async () => {
    try {
      const success = await exportImage();
      if (success) showToast(t('exportSuccess') || 'Image exported successfully.', 'success');
    } catch {
      showToast(t('exportFailed') || 'Image export failed.', 'error');
    }
  };

  const handleCopy = async () => {
    const result = await copyImage();
    if (result === 'clipboard') {
      showToast(t('shareImageCopiedHint'), 'success');
    } else if (result === 'downloaded') {
      showToast(t('copyImageFallback'), 'success');
    } else {
      showToast(t('exportFailed'), 'error');
    }
  };

  useEffect(() => {
    if (initialState) return; // Returning user — skip onboarding.
    const isDismissed = window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY) === 'true';
    if (!isDismissed && !activeTemplateId) setIsOnboardingOpen(true);
  }, [activeTemplateId, initialState]);

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
      editorOpenRequestId,
      onEditorOpenRequestHandled: () => setEditorOpenRequestId(0),
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
      hasPoemText: getPlainPoemText(poem).trim().length > 0,
      backgroundType: background.backgroundType,
      paperId: background.paperId,
      backgroundColor: background.backgroundColor,
      gradientColor1: background.gradientColor1,
      gradientColor2: background.gradientColor2,
      gradientDirection: background.gradientDirection,
      backgroundImage: background.backgroundImage,
      backgroundImageSource: background.backgroundImageSource,
      bgBrightness: background.bgBrightness,
      bgBlur: background.bgBlur,
      aiProvider: background.aiProvider,
      aiPrompt: background.aiPrompt,
      aiError: background.aiError,
      isGeneratingAI: background.isGeneratingAI,
      fileInputRef: background.fileInputRef,
      onBackgroundTypeChange: background.setBackgroundType,
      onPaperIdChange: background.setPaperId,
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
    onCopy: handleCopy,
    onPublishLink: () => setPublishDialogOpen(true),
    publishLinkLabel: shareCopy[language].publishLink,
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
    <div className="min-h-dvh bg-transparent flex flex-col lg:flex-row font-sans text-(--app-ink)">
      <Sidebar {...sidebarProps} />

      <CanvasPreview {...canvasPreviewProps} canUndo={canUndo} canRedo={canRedo} onUndo={handleUndo} onRedo={handleRedo} />

      <PublishDialog
        language={language}
        isOpen={publishDialogOpen}
        onClose={() => setPublishDialogOpen(false)}
        publish={publishArtwork}
      />

      <Suspense fallback={null}>
        <OnboardingModal
          isOpen={isOnboardingOpen}
          onClose={handleCloseOnboarding}
          onStartEditing={handleStartFromOnboarding}
          t={t}
          templates={sidebarProps.templates}
        />
      </Suspense>
    </div>
  );
}
