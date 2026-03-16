import { Loader2, Palette, Sparkles, Upload } from 'lucide-react';
import type { TranslationKey } from '../../translations';
import type { AiProvider, BackgroundType, BackgroundSectionProps, ExpandedSections, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';
import { MAX_AI_PROMPT_LENGTH } from '../../hooks/useAiBackground';

const backgroundTypeLabels: Record<BackgroundType, TranslationKey> = {
  solid: 'bgSolid',
  gradient: 'bgGradient',
  transparent: 'bgTransparent',
  image: 'bgImage',
  ai: 'bgAI',
};

const aiProviders: AiProvider[] = ['gemini', 'openai'];

interface BackgroundPanelProps {
  t: TranslateFn;
  expanded: ExpandedSections['background'];
  onToggle: () => void;
  background: BackgroundSectionProps;
}

export function BackgroundPanel({ t, expanded, onToggle, background }: BackgroundPanelProps) {
  return (
    <ControlSection
      title={t('background')}
      icon={<Palette className="w-4 h-4" />}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['solid', 'gradient', 'transparent', 'image', 'ai'] as BackgroundType[]).map((type) => (
            <button
              key={type}
              onClick={() => background.onBackgroundTypeChange(type)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                background.backgroundType === type
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(backgroundTypeLabels[type])}
            </button>
          ))}
        </div>

        {background.backgroundType === 'solid' ? (
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={background.backgroundColor}
              onChange={(event) => background.onBackgroundColorChange(event.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0 p-0"
            />
            <span className="text-sm text-gray-600 uppercase font-mono">{background.backgroundColor}</span>
          </div>
        ) : null}

        {background.backgroundType === 'gradient' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={background.gradientColor1}
                onChange={(event) => background.onGradientColor1Change(event.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
              />
              <input
                type="color"
                value={background.gradientColor2}
                onChange={(event) => background.onGradientColor2Change(event.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
              />
            </div>
            <select
              value={background.gradientDirection}
              onChange={(event) => background.onGradientDirectionChange(event.target.value)}
              className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="to right">{t('gradLTR')}</option>
              <option value="to bottom">{t('gradTTB')}</option>
              <option value="to bottom right">{t('gradTLBR')}</option>
              <option value="to top right">{t('gradBLTR')}</option>
            </select>
          </div>
        ) : null}

        {background.backgroundType === 'image' ? (
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={background.onImageUpload}
              ref={background.fileInputRef}
              className="hidden"
            />
            <button
              onClick={() => background.fileInputRef.current?.click()}
              className="w-full py-2 px-4 border border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" /> {t('uploadImage')}
            </button>
          </div>
        ) : null}

        {background.backgroundType === 'ai' ? (
          <div className="space-y-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-indigo-700">{t('aiProvider')}</div>
              <div className="grid grid-cols-2 gap-2">
                {aiProviders.map((provider) => (
                  <button
                    key={provider}
                    onClick={() => background.onAiProviderChange(provider)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                      background.aiProvider === provider
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                    }`}
                  >
                    {provider === 'gemini' ? 'Gemini' : 'OpenAI'}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="w-full h-20 p-2 text-sm border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
              value={background.aiPrompt}
              onChange={(event) => background.onAiPromptChange(event.target.value)}
              maxLength={MAX_AI_PROMPT_LENGTH}
              placeholder={t('aiPromptPlaceholder')}
            />
            <div className="text-right text-xs text-indigo-700/80">
              {background.aiPrompt.length}/{MAX_AI_PROMPT_LENGTH}
            </div>
            <button
              onClick={background.onGenerateAiBackground}
              disabled={background.isGeneratingAI}
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
            >
              {background.isGeneratingAI ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('generating')}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> {t('generateAIBg')}
                </>
              )}
            </button>
            {background.aiError ? <p className="text-xs text-red-500 mt-2">{background.aiError}</p> : null}
          </div>
        ) : null}

        {background.backgroundType === 'image' || background.backgroundType === 'ai' ? (
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{t('brightness')}</span>
                <span>{background.bgBrightness}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={background.bgBrightness}
                onChange={(event) => background.onBgBrightnessChange(Number(event.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{t('blur')}</span>
                <span>{background.bgBlur}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                value={background.bgBlur}
                onChange={(event) => background.onBgBlurChange(Number(event.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
        ) : null}
      </div>
    </ControlSection>
  );
}