import { useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import type { BackgroundType, TranslateFn } from '../types';
import { useAiBackground } from './useAiBackground';

interface UseBackgroundConfigParams {
  text: string;
  canvasWidth: number;
  canvasHeight: number;
  t: TranslateFn;
}

export function useBackgroundConfig({ text, canvasWidth, canvasHeight, t }: UseBackgroundConfigParams) {
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('solid');
  const [backgroundColor, setBackgroundColor] = useState('#f8fafc');
  const [gradientColor1, setGradientColor1] = useState('#e0e7ff');
  const [gradientColor2, setGradientColor2] = useState('#ede9fe');
  const [gradientDirection, setGradientDirection] = useState('to bottom right');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [bgBrightness, setBgBrightness] = useState(100);
  const [bgBlur, setBgBlur] = useState(0);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiError, setAiError] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    aiPrompt,
    canvasWidth,
    canvasHeight,
    t,
    setAiError,
    setIsGeneratingAI,
    setBackgroundImage,
    setBackgroundType,
  });

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
    setAiPrompt,
    onImageUpload,
    onGenerateAiBackground,
  };
}