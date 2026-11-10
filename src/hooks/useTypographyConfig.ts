import { useEffect, useRef, useState } from 'react';
import { getDefaultFontForLanguage } from '../fontOptions';
import type { Language } from '../translations';
import type { TemplateTypographyConfig, TypographySectionProps } from '../types';

type TypographyConfigResult = TypographySectionProps & {
  applyTypographyTemplate: (template: TemplateTypographyConfig) => void;
};

export function useTypographyConfig(language: Language, initialDraft?: TemplateTypographyConfig): TypographyConfigResult {
  const [fontFamily, setFontFamily] = useState(() => initialDraft?.fontFamily ?? getDefaultFontForLanguage(language));
  const [fontSize, setFontSize] = useState(() => initialDraft?.fontSize ?? 32);
  const [textColor, setTextColor] = useState(() => initialDraft?.textColor ?? '#1e293b');
  const [textAlign, setTextAlign] = useState(() => initialDraft?.textAlign ?? 'center');
  const [writingMode, setWritingMode] = useState(() => initialDraft?.writingMode ?? 'horizontal-tb');
  const [padding, setPadding] = useState(() => initialDraft?.padding ?? 64);
  const [lineHeight, setLineHeight] = useState(() => initialDraft?.lineHeight ?? 1.8);
  const [letterSpacing, setLetterSpacing] = useState(() => initialDraft?.letterSpacing ?? 4);
  const [columns, setColumns] = useState(() => initialDraft?.columns ?? 1);
  const [columnGap, setColumnGap] = useState(() => initialDraft?.columnGap ?? 32);
  const [textShadowEnabled, setTextShadowEnabled] = useState(() => initialDraft?.textShadowEnabled ?? false);
  const [textShadowColor, setTextShadowColor] = useState(() => initialDraft?.textShadowColor ?? '#000000');
  const [textShadowBlur, setTextShadowBlur] = useState(() => initialDraft?.textShadowBlur ?? 10);
  const [textShadowOffsetY, setTextShadowOffsetY] = useState(() => initialDraft?.textShadowOffsetY ?? 2);
  const [textShadowOffsetX, setTextShadowOffsetX] = useState(() => initialDraft?.textShadowOffsetX ?? 0);
  const previousLanguageRef = useRef(language);

  useEffect(() => {
    const previousLanguage = previousLanguageRef.current;
    const previousDefaultFont = getDefaultFontForLanguage(previousLanguage);
    const nextDefaultFont = getDefaultFontForLanguage(language);

    setFontFamily((currentFontFamily) => (currentFontFamily === previousDefaultFont ? nextDefaultFont : currentFontFamily));
    previousLanguageRef.current = language;
  }, [language]);

  const applyTypographyTemplate = (template: TemplateTypographyConfig) => {
    setFontFamily(template.fontFamily);
    setFontSize(template.fontSize);
    setTextColor(template.textColor);
    setTextAlign(template.textAlign);
    setWritingMode(template.writingMode);
    setPadding(template.padding);
    setLineHeight(template.lineHeight);
    setLetterSpacing(template.letterSpacing);
    setColumns(template.columns);
    setColumnGap(template.columnGap);
    setTextShadowEnabled(template.textShadowEnabled);
    setTextShadowColor(template.textShadowColor);
    setTextShadowBlur(template.textShadowBlur);
    setTextShadowOffsetY(template.textShadowOffsetY);
    setTextShadowOffsetX(template.textShadowOffsetX);
  };

  return {
    fontFamily,
    fontSize,
    textColor,
    textAlign,
    writingMode,
    padding,
    lineHeight,
    letterSpacing,
    columns,
    columnGap,
    textShadowEnabled,
    textShadowColor,
    textShadowBlur,
    textShadowOffsetY,
    textShadowOffsetX,
    onFontFamilyChange: setFontFamily,
    onFontSizeChange: setFontSize,
    onTextColorChange: setTextColor,
    onTextAlignChange: setTextAlign,
    onWritingModeChange: setWritingMode,
    onPaddingChange: setPadding,
    onLineHeightChange: setLineHeight,
    onLetterSpacingChange: setLetterSpacing,
    onColumnsChange: setColumns,
    onColumnGapChange: setColumnGap,
    onTextShadowEnabledChange: setTextShadowEnabled,
    onTextShadowColorChange: setTextShadowColor,
    onTextShadowBlurChange: setTextShadowBlur,
    onTextShadowOffsetYChange: setTextShadowOffsetY,
    onTextShadowOffsetXChange: setTextShadowOffsetX,
    applyTypographyTemplate,
  };
}