import { useEffect, useRef, useState } from 'react';
import { DEFAULT_STAMP_FONT } from '../fontOptions';
import { getDefaultStampTextForLanguage } from '../stampDefaults';
import type { Language } from '../translations';
import type { BorderStyle, CustomText, PositionedElement, StampConfig, TemplateDecorationsConfig, TranslateFn, WritingMode } from '../types';

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
  const [showStamp, setShowStamp] = useState(false);
  const [stamp, setStamp] = useState<StampConfig>(() => createDefaultStamp());
  const [poemPosition, setPoemPosition] = useState<PositionedElement>(() => createDefaultPoemPosition());
  const [customTexts, setCustomTexts] = useState<CustomText[]>([]);
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
    setShowStamp(template.showStamp);
    setStamp(template.stamp);
    setPoemPosition(template.poemPosition);
    setCustomTexts(template.customTexts);
  };

  return {
    showBorder,
    borderStyle,
    showStamp,
    stamp,
    poemPosition,
    customTexts,
    setShowBorder,
    setBorderStyle,
    setShowStamp,
    setStamp: updateStamp,
    setPoemPosition: updatePoemPosition,
    resetStampPosition,
    addCustomText,
    updateCustomText,
    removeCustomText,
    applyDecorationsTemplate,
  };
}