import { useState } from 'react';
import type { TemplateTypographyConfig, TypographySectionProps } from '../types';

type TypographyConfigResult = TypographySectionProps & {
  applyTypographyTemplate: (template: TemplateTypographyConfig) => void;
};

export function useTypographyConfig(): TypographyConfigResult {
  const [fontFamily, setFontFamily] = useState('"Noto Serif SC", serif');
  const [fontSize, setFontSize] = useState(32);
  const [textColor, setTextColor] = useState('#1e293b');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [writingMode, setWritingMode] = useState<'horizontal-tb' | 'vertical-rl'>('horizontal-tb');
  const [padding, setPadding] = useState(64);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [letterSpacing, setLetterSpacing] = useState(4);
  const [columns, setColumns] = useState(1);
  const [columnGap, setColumnGap] = useState(32);
  const [textShadowEnabled, setTextShadowEnabled] = useState(false);
  const [textShadowColor, setTextShadowColor] = useState('#000000');
  const [textShadowBlur, setTextShadowBlur] = useState(10);
  const [textShadowOffsetY, setTextShadowOffsetY] = useState(2);
  const [textShadowOffsetX, setTextShadowOffsetX] = useState(0);

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