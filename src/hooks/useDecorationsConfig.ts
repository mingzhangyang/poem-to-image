import { useEffect, useRef, useState } from 'react';
import { DEFAULT_STAMP_FONT } from '../fontOptions';
import { getDefaultStampTextForLanguage } from '../stampDefaults';
import type { Language } from '../translations';
import type { BorderStyle, CustomText, LogoConfig, PositionedElement, StampConfig, TemplateDecorationsConfig, TranslateFn, WritingMode } from '../types';

interface UseDecorationsConfigParams {
  language: Language;
  t: TranslateFn;
  fontSize: number;
  textColor: string;
  writingMode: WritingMode;
  onCustomTextAdded?: () => void;
}

export function useDecorationsConfig({
  language,
  t,
  fontSize,
  textColor,
  writingMode,
  onCustomTextAdded,
}: UseDecorationsConfigParams) {
  const createDefaultPoemPosition = (): PositionedElement => ({
    positionX: 50,
    positionY: 50,
  });

  const createDefaultStamp = (): StampConfig => ({
    text: getDefaultStampTextForLanguage(language),
    style: 'square',
    colorScheme: 'filled',
    positionX: 80,
    positionY: 80,
    size: Math.round(fontSize * 2.5),
    rotation: -8,
    opacity: 0.82,
    fontFamily: DEFAULT_STAMP_FONT,
  });

  const [showBorder, setShowBorder] = useState(false);
  const [borderStyle, setBorderStyle] = useState<BorderStyle>('solid');
  const [borderColor, setBorderColor] = useState(textColor);
  const [borderWidth, setBorderWidth] = useState(4);
  const [showStamp, setShowStamp] = useState(false);
  const [stamp, setStamp] = useState<StampConfig>(() => createDefaultStamp());
  const [poemPosition, setPoemPosition] = useState<PositionedElement>(() => createDefaultPoemPosition());
  const [customTexts, setCustomTexts] = useState<CustomText[]>([]);
  const [logos, setLogos] = useState<LogoConfig[]>([]);
  const previousLanguageRef = useRef(language);

  useEffect(() => {
    const previousLanguage = previousLanguageRef.current;
    const previousDefaultText = getDefaultStampTextForLanguage(previousLanguage);
    const nextDefaultText = getDefaultStampTextForLanguage(language);

    setStamp((prev) => (prev.text === previousDefaultText ? { ...prev, text: nextDefaultText } : prev));
    previousLanguageRef.current = language;
  }, [language]);

  const addCustomText = () => {
    setCustomTexts((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text: t('defaultCustomText'),
        fontSize: fontSize * 0.8,
        color: textColor,
        writingMode,
        rotation: 0,
        positionX: 50,
        positionY: Math.min(82, 24 + prev.length * 12),
      },
    ]);

    onCustomTextAdded?.();
  };

  const updateCustomText = (id: string, updates: Partial<CustomText>) => {
    setCustomTexts((prev) => prev.map((customText) => (customText.id === id ? { ...customText, ...updates } : customText)));
  };

  const removeCustomText = (id: string) => {
    setCustomTexts((prev) => prev.filter((customText) => customText.id !== id));
  };

  const addLogo = (imageUrl: string) => {
    setLogos((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        imageUrl,
        positionX: 50,
        positionY: 50,
        size: 100,
        rotation: 0,
        opacity: 1,
      },
    ]);
  };

  const updateLogo = (id: string, updates: Partial<LogoConfig>) => {
    setLogos((prev) => prev.map((logo) => (logo.id === id ? { ...logo, ...updates } : logo)));
  };

  const removeLogo = (id: string) => {
    setLogos((prev) => prev.filter((logo) => logo.id !== id));
  };

  const updateStamp = (updates: Partial<StampConfig>) => {
    setStamp((prev) => ({ ...prev, ...updates }));
  };

  const updatePoemPosition = (updates: Partial<PositionedElement>) => {
    setPoemPosition((prev) => ({ ...prev, ...updates }));
  };

  const resetStampPosition = () => {
    setStamp((prev) => ({
      ...prev,
      positionX: 80,
      positionY: 80,
    }));
  };

  const applyDecorationsTemplate = (template: TemplateDecorationsConfig) => {
    setShowBorder(template.showBorder);
    setBorderStyle(template.borderStyle);
    setBorderColor(template.borderColor ?? textColor);
    setBorderWidth(template.borderWidth ?? 4);
    setShowStamp(template.showStamp);
    setStamp(template.stamp);
    setPoemPosition(template.poemPosition);
    setCustomTexts(template.customTexts);
    setLogos(template.logos || []);
  };

  return {
    showBorder,
    borderStyle,
    borderColor,
    borderWidth,
    showStamp,
    stamp,
    poemPosition,
    customTexts,
    logos,
    setShowBorder,
    setBorderStyle,
    setBorderColor,
    setBorderWidth,
    setShowStamp,
    setStamp: updateStamp,
    setPoemPosition: updatePoemPosition,
    resetStampPosition,
    addCustomText,
    updateCustomText,
    removeCustomText,
    addLogo,
    updateLogo,
    removeLogo,
    applyDecorationsTemplate,
  };
}