import { AlignCenter, AlignLeft, AlignRight, LayoutTemplate } from 'lucide-react';
import { getOtherFontOptions, getRecommendedFontOptions } from '../../fontOptions';
import type { Language } from '../../translations';
import type { ExpandedSections, TextAlign, TranslateFn, TypographySectionProps, WritingMode } from '../../types';
import { ControlSection } from '../ControlSection';

interface TypographyPanelProps {
  language: Language;
  t: TranslateFn;
  expanded: ExpandedSections['typography'];
  onToggle: () => void;
  typography: TypographySectionProps;
}

export function TypographyPanel({ language, t, expanded, onToggle, typography }: TypographyPanelProps) {
  const recommendedFonts = getRecommendedFontOptions(language);
  const otherFonts = getOtherFontOptions(language);

  return (
    <ControlSection
      title={t('typography')}
      icon={<LayoutTemplate className="w-4 h-4" />}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('fontFamily')}</label>
          <select
            value={typography.fontFamily}
            onChange={(event) => typography.onFontFamilyChange(event.target.value)}
            className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <optgroup label={t('fontGroupRecommended')}>
              {recommendedFonts.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('fontGroupAll')}>
              {otherFonts.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('fontSize')} ({typography.fontSize}px)</label>
            <input
              type="range"
              min="12"
              max="120"
              value={typography.fontSize}
              onChange={(event) => typography.onFontSizeChange(Number(event.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('padding')} ({typography.padding}px)</label>
            <input
              type="range"
              min="0"
              max="200"
              value={typography.padding}
              onChange={(event) => typography.onPaddingChange(Number(event.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('lineHeight')} ({typography.lineHeight})</label>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={typography.lineHeight}
              onChange={(event) => typography.onLineHeightChange(Number(event.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('letterSpacing')} ({typography.letterSpacing}px)</label>
            <input
              type="range"
              min="0"
              max="20"
              value={typography.letterSpacing}
              onChange={(event) => typography.onLetterSpacingChange(Number(event.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('columns')} ({typography.columns})</label>
            <input
              type="range"
              min="1"
              max="4"
              value={typography.columns}
              onChange={(event) => typography.onColumnsChange(Number(event.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('columnGap')} ({typography.columnGap}px)</label>
            <input
              type="range"
              min="0"
              max="100"
              value={typography.columnGap}
              onChange={(event) => typography.onColumnGapChange(Number(event.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('textColor')}</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={typography.textColor}
              onChange={(event) => typography.onTextColorChange(event.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0"
            />
            <span className="text-sm text-gray-600 uppercase font-mono">{typography.textColor}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-600 flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={typography.textShadowEnabled}
                onChange={(event) => typography.onTextShadowEnabledChange(event.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              {t('textShadow')}
            </label>
          </div>

          {typography.textShadowEnabled ? (
            <div className="space-y-3 pl-6">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={typography.textShadowColor}
                  onChange={(event) => typography.onTextShadowColorChange(event.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                />
                <span className="text-xs text-gray-500 uppercase font-mono">{typography.textShadowColor}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('blur')} ({typography.textShadowBlur}px)</label>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={typography.textShadowBlur}
                    onChange={(event) => typography.onTextShadowBlurChange(Number(event.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('offsetX')} ({typography.textShadowOffsetX}px)</label>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    value={typography.textShadowOffsetX}
                    onChange={(event) => typography.onTextShadowOffsetXChange(Number(event.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('offsetY')} ({typography.textShadowOffsetY}px)</label>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    value={typography.textShadowOffsetY}
                    onChange={(event) => typography.onTextShadowOffsetYChange(Number(event.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <div className="flex-1 bg-gray-100 p-1 rounded-lg flex">
            {(['left', 'center', 'right'] as TextAlign[]).map((align) => (
              <button
                key={align}
                onClick={() => typography.onTextAlignChange(align)}
                className={`flex-1 py-1.5 flex justify-center items-center rounded-md transition-all ${
                  typography.textAlign === align ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {align === 'left' ? <AlignLeft className="w-4 h-4" /> : null}
                {align === 'center' ? <AlignCenter className="w-4 h-4" /> : null}
                {align === 'right' ? <AlignRight className="w-4 h-4" /> : null}
              </button>
            ))}
          </div>
          <div className="flex-1 bg-gray-100 p-1 rounded-lg flex">
            {(['horizontal-tb', 'vertical-rl'] as WritingMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => typography.onWritingModeChange(mode)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  typography.writingMode === mode ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {mode === 'horizontal-tb' ? t('horizontal') : t('vertical')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ControlSection>
  );
}