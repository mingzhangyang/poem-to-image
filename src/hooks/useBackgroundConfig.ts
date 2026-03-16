import { useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import type { AiProvider, BackgroundType, TemplateBackgroundConfig, TranslateFn } from '../types';
import { useAiBackground } from './useAiBackground';

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
  const [bgBrightness, setBgBrightness] = useState(100);
  const [bgBlur, setBgBlur] = useState(0);
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiError, setAiError] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onAiProviderChange = (value: AiProvider) => {
    setAiProvider(value);
    setAiError('');
  };

  const onImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setBackgroundImage(loadEvent.target?.result as string);
      setBackgroundType('image');
    };
    reader.readAsDataURL(file);
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
    setBackgroundImage,
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
    setBackgroundImage(null);
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
          backgroundSize: 'cover',
          backgroundPosition: 'center',
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