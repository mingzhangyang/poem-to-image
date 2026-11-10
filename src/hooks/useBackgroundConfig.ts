import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import { logError } from '../logger';
import { discardDraftAssetRegistration, registerDraftAssetObjectUrl } from '../editorDraftStore';
import type { AiProvider, BackgroundImageSource, BackgroundType, TemplateBackgroundConfig, TranslateFn } from '../types';
import { inferBackgroundImageSource } from '../backgroundImageSource';
import { getPaperStyle, paperPreviewStyle, type PaperId } from '../paperStyles';
import { useAiBackground } from './useAiBackground';

const MAX_EXPORT_SCALE = 3;
const MAX_BACKGROUND_EDGE = 4096;
const LARGE_BACKGROUND_BLOB_BYTES = 1_500_000;

function revokeObjectUrl(url: string | null) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image'));
    image.src = src;
  });
}

interface UseBackgroundConfigParams {
  text: string;
  canvasWidth: number;
  canvasHeight: number;
  t: TranslateFn;
  getToken?: () => Promise<string | null>;
  onBalanceChange?: (newBalance: number) => void;
  initialDraft?: TemplateBackgroundConfig;
}

export function useBackgroundConfig({ text, canvasWidth, canvasHeight, t, getToken, onBalanceChange, initialDraft }: UseBackgroundConfigParams) {
  const [backgroundType, setBackgroundType] = useState<BackgroundType>(initialDraft?.backgroundType ?? 'solid');
  const [paperId, setPaperId] = useState<PaperId>(() => getPaperStyle(initialDraft?.paperId).id);
  const [backgroundColor, setBackgroundColor] = useState(initialDraft?.backgroundColor ?? '#f8fafc');
  const [gradientColor1, setGradientColor1] = useState(initialDraft?.gradientColor1 ?? '#e0e7ff');
  const [gradientColor2, setGradientColor2] = useState(initialDraft?.gradientColor2 ?? '#ede9fe');
  const [gradientDirection, setGradientDirection] = useState(initialDraft?.gradientDirection ?? 'to bottom right');
  // An image remains part of the editable draft when Solid/Paper is selected.
  // Keep its hydrated URL (and provenance) so undo, switching back to Image,
  // and asset-lease adoption work even while the image is not displayed.
  const [backgroundImage, setBackgroundImage] = useState<string | null>(() => initialDraft?.backgroundImage ?? null);
  const [backgroundImageSource, setBackgroundImageSource] = useState<BackgroundImageSource>(() => {
    const url = initialDraft?.backgroundImage;
    return url ? (initialDraft?.backgroundImageSource ?? inferBackgroundImageSource(url)) : null;
  });
  const [backgroundSize, setBackgroundSize] = useState<'cover' | 'contain' | 'stretch'>(initialDraft?.backgroundSize ?? 'cover');
  const [backgroundPosition, setBackgroundPosition] = useState<string>(initialDraft?.backgroundPosition ?? 'center');
  const [bgBrightness, setBgBrightness] = useState(initialDraft?.bgBrightness ?? 100);
  const [bgBlur, setBgBlur] = useState(initialDraft?.bgBlur ?? 0);
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiError, setAiError] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRequestIdRef = useRef(0);
  const stagedUploadUrlsRef = useRef<Set<string>>(new Set());
  const mountEpochRef = useRef(0);

  useEffect(() => {
    const epoch = ++mountEpochRef.current;
    return () => {
      // Reject the results of uploads that finish after unmount.
      imageRequestIdRef.current += 1;
      // StrictMode replays effects without actually disposing the editor.
      queueMicrotask(() => {
        if (mountEpochRef.current !== epoch) return;
        for (const url of stagedUploadUrlsRef.current) discardDraftAssetRegistration(url);
        stagedUploadUrlsRef.current.clear();
      });
    };
  }, []);

  useEffect(() => {
    // An upload may be superseded before React commits its URL (for example,
    // two rapid image selections). Drop its staging lease after the new scene
    // commits; any history or in-flight save still owns the old URL.
    for (const url of stagedUploadUrlsRef.current) {
      if (url === backgroundImage) continue;
      discardDraftAssetRegistration(url);
      stagedUploadUrlsRef.current.delete(url);
    }
  }, [backgroundImage]);

  const maxImageWidth = Math.min(Math.round(canvasWidth * MAX_EXPORT_SCALE * 1.1), MAX_BACKGROUND_EDGE);
  const maxImageHeight = Math.min(Math.round(canvasHeight * MAX_EXPORT_SCALE * 1.1), MAX_BACKGROUND_EDGE);

  // Editor history and detached saves own object URLs; hook cleanups must not
  // revoke them during React StrictMode effect replay.
  const updateBackgroundImage = useCallback((nextUrl: string | null) => {
    setBackgroundImage(nextUrl);
  }, []);

  const applyBackgroundImage = useCallback(async (source: Blob | string, origin: 'upload' | 'ai' = 'upload') => {
    const requestId = ++imageRequestIdRef.current;
    const sourceBlob = source instanceof Blob ? source : await fetch(source).then((response) => response.blob());
    const sourceUrl = URL.createObjectURL(sourceBlob);

    try {
      const image = await loadImageElement(sourceUrl);
      const widthScale = maxImageWidth / image.naturalWidth;
      const heightScale = maxImageHeight / image.naturalHeight;
      const scale = Math.min(1, widthScale, heightScale);
      const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
      const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));
      const needsResize = targetWidth !== image.naturalWidth || targetHeight !== image.naturalHeight;
      const shouldTranscode = needsResize || sourceBlob.size > LARGE_BACKGROUND_BLOB_BYTES || typeof source === 'string';

      let nextUrl = sourceUrl;
      let nextBlob: Blob = sourceBlob;

      if (shouldTranscode) {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Failed to prepare image canvas');
        }

        context.drawImage(image, 0, 0, targetWidth, targetHeight);

        const optimizedBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/webp', 0.9);
        });

        if (optimizedBlob) {
          nextUrl = URL.createObjectURL(optimizedBlob);
          nextBlob = optimizedBlob;
        }
      }

      if (imageRequestIdRef.current === requestId) {
        registerDraftAssetObjectUrl(nextUrl, nextBlob);
        stagedUploadUrlsRef.current.add(nextUrl);
        updateBackgroundImage(nextUrl);
        setBackgroundImageSource(origin);
        setBackgroundPosition('center');

        if (nextUrl !== sourceUrl) {
          revokeObjectUrl(sourceUrl);
        }

        return;
      }

      if (nextUrl !== sourceUrl) {
        revokeObjectUrl(nextUrl);
      }

      revokeObjectUrl(sourceUrl);
    } catch (error) {
      revokeObjectUrl(sourceUrl);
      throw error;
    }
  }, [maxImageHeight, maxImageWidth, updateBackgroundImage]);

  const onAiProviderChange = (value: AiProvider) => {
    setAiProvider(value);
    setAiError('');
  };

  const onImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      await applyBackgroundImage(file);
      setBackgroundType('image');
      setBackgroundSize('cover');
      setBackgroundPosition('center');
      setAiError('');
    } catch (error) {
      logError('Failed to process background image', error);
      setAiError(t('errGenFailed'));
    } finally {
      event.target.value = '';
    }
  };

  const onGenerateAiBackground = useAiBackground({
    text,
    aiProvider,
    aiPrompt,
    canvasWidth,
    canvasHeight,
    t,
    getToken,
    setAiError,
    setIsGeneratingAI,
    applyBackgroundImage,
    setBackgroundType,
    onBalanceChange,
  });

  const applyBackgroundTemplate = (template: TemplateBackgroundConfig) => {
    setBackgroundType(template.backgroundType);
    setPaperId(getPaperStyle(template.paperId).id);
    setBackgroundColor(template.backgroundColor);
    setGradientColor1(template.gradientColor1);
    setGradientColor2(template.gradientColor2);
    setGradientDirection(template.gradientDirection);
    setBgBrightness(template.bgBrightness);
    setBgBlur(template.bgBlur);
    const imageUrl = template.backgroundType === 'image' ? (template.backgroundImage ?? null) : null;
    updateBackgroundImage(imageUrl);
    setBackgroundImageSource(imageUrl ? (template.backgroundImageSource ?? inferBackgroundImageSource(imageUrl)) : null);
    setBackgroundSize(template.backgroundSize ?? 'cover');
    setBackgroundPosition(template.backgroundPosition ?? 'center');
    setAiPrompt('');
    setAiError('');
    setIsGeneratingAI(false);
  };

  const backgroundStyle: CSSProperties = (() => {
    switch (backgroundType) {
      case 'solid':
        return { backgroundColor };
      case 'paper':
        return paperPreviewStyle(paperId);
      case 'gradient':
        return {
          backgroundImage: `linear-gradient(${gradientDirection}, ${gradientColor1}, ${gradientColor2})`,
        };
      case 'transparent':
        return { backgroundColor: 'transparent' };
      case 'image':
      case 'ai':
        return {
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
          backgroundSize: backgroundSize === 'stretch' ? '100% 100%' : backgroundSize,
          backgroundPosition,
        };
      default:
        return { backgroundColor };
    }
  })();

  return {
    backgroundType,
    paperId,
    backgroundColor,
    gradientColor1,
    gradientColor2,
    gradientDirection,
    backgroundImage,
    backgroundImageSource,
    backgroundSize,
    backgroundPosition,
    bgBrightness,
    bgBlur,
    aiProvider,
    aiPrompt,
    aiError,
    isGeneratingAI,
    fileInputRef,
    backgroundStyle,
    setBackgroundType,
    setPaperId: (id: PaperId) => {
      setPaperId(getPaperStyle(id).id);
      setBackgroundType('paper');
    },
    setBackgroundColor,
    setGradientColor1,
    setGradientColor2,
    setGradientDirection,
    setBackgroundSize,
    setBgBrightness,
    setBgBlur,
    onAiProviderChange,
    setAiPrompt,
    applyBackgroundTemplate,
    onImageUpload,
    onGenerateAiBackground,
  };
}
