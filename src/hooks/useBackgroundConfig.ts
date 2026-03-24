import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import type { AiProvider, BackgroundType, TemplateBackgroundConfig, TranslateFn } from '../types';
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
}

export function useBackgroundConfig({ text, canvasWidth, canvasHeight, t, getToken, onBalanceChange }: UseBackgroundConfigParams) {
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('solid');
  const [backgroundColor, setBackgroundColor] = useState('#f8fafc');
  const [gradientColor1, setGradientColor1] = useState('#e0e7ff');
  const [gradientColor2, setGradientColor2] = useState('#ede9fe');
  const [gradientDirection, setGradientDirection] = useState('to bottom right');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundSize, setBackgroundSize] = useState<'cover' | 'contain' | 'stretch'>('cover');
  const [backgroundPosition, setBackgroundPosition] = useState<string>('center');
  const [bgBrightness, setBgBrightness] = useState(100);
  const [bgBlur, setBgBlur] = useState(0);
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiError, setAiError] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundUrlRef = useRef<string | null>(null);
  const imageRequestIdRef = useRef(0);

  const maxImageWidth = Math.min(Math.round(canvasWidth * MAX_EXPORT_SCALE * 1.1), MAX_BACKGROUND_EDGE);
  const maxImageHeight = Math.min(Math.round(canvasHeight * MAX_EXPORT_SCALE * 1.1), MAX_BACKGROUND_EDGE);

  const updateBackgroundImage = useCallback((nextUrl: string | null) => {
    const previousUrl = backgroundUrlRef.current;
    backgroundUrlRef.current = nextUrl;
    setBackgroundImage(nextUrl);

    if (previousUrl && previousUrl !== nextUrl) {
      revokeObjectUrl(previousUrl);
    }
  }, []);

  const applyBackgroundImage = useCallback(async (source: Blob | string) => {
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
        }
      }

      if (imageRequestIdRef.current === requestId) {
        updateBackgroundImage(nextUrl);

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

  useEffect(() => () => revokeObjectUrl(backgroundUrlRef.current), []);

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
      console.error('Failed to process background image', error);
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
    setBackgroundColor(template.backgroundColor);
    setGradientColor1(template.gradientColor1);
    setGradientColor2(template.gradientColor2);
    setGradientDirection(template.gradientDirection);
    setBgBrightness(template.bgBrightness);
    setBgBlur(template.bgBlur);
    updateBackgroundImage(template.backgroundType === 'image' ? (template.backgroundImage ?? null) : null);
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
    backgroundColor,
    gradientColor1,
    gradientColor2,
    gradientDirection,
    backgroundImage,
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
    setBackgroundColor,
    setGradientColor1,
    setGradientColor2,
    setGradientDirection,
    setBgBrightness,
    setBgBlur,
    onAiProviderChange,
    setAiPrompt,
    applyBackgroundTemplate,
    onImageUpload,
    onGenerateAiBackground,
  };
}
