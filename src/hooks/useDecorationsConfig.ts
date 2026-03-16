import { useState } from 'react';
import type { BorderStyle, CustomText, TemplateDecorationsConfig, TranslateFn, WritingMode } from '../types';

interface UseDecorationsConfigParams {
  t: TranslateFn;
  fontSize: number;
  textColor: string;
  writingMode: WritingMode;
  onCustomTextAdded?: () => void;
}

export function useDecorationsConfig({
  t,
  fontSize,
  textColor,
  writingMode,
  onCustomTextAdded,
}: UseDecorationsConfigParams) {
  const [showBorder, setShowBorder] = useState(false);
  const [borderStyle, setBorderStyle] = useState<BorderStyle>('solid');
  const [showStamp, setShowStamp] = useState(false);
  const [stampText, setStampText] = useState('印');
  const [customTexts, setCustomTexts] = useState<CustomText[]>([]);

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

  const applyDecorationsTemplate = (template: TemplateDecorationsConfig) => {
    setShowBorder(template.showBorder);
    setBorderStyle(template.borderStyle);
    setShowStamp(template.showStamp);
    setStampText(template.stampText);
    setCustomTexts(template.customTexts);
  };

  return {
    showBorder,
    borderStyle,
    showStamp,
    stampText,
    customTexts,
    setShowBorder,
    setBorderStyle,
    setShowStamp,
    setStampText,
    addCustomText,
    updateCustomText,
    removeCustomText,
    applyDecorationsTemplate,
  };
}