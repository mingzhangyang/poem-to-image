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

const CREDIT_COST: Record<'gemini' | 'openai', number> = { gemini: 2, openai: 1 };

const PROVIDER_META: Record<AiProvider, { title: string; tradeoffKey: TranslationKey; detailKey: TranslationKey }> = {
  gemini: {
    title: 'Gemini',
    tradeoffKey: 'geminiTradeoff',
    detailKey: 'geminiDetail',
  },
  openai: {
    title: 'OpenAI',
    tradeoffKey: 'openaiTradeoff',
    detailKey: 'openaiDetail',
  },
};

const PROMPT_SUGGESTIONS = [
  'misty ink wash',
  'aged rice paper',
  'moonlit bamboo shadows',
  'quiet temple courtyard at dawn',
  'soft editorial paper texture',
  'gold-flecked calligraphy backdrop',
];

interface BackgroundPanelProps {
  t: TranslateFn;
  expanded: ExpandedSections['background'];
  onToggle: () => void;
  background: BackgroundSectionProps;
  balance?: number | null;
}

export function BackgroundPanel({ t, expanded, onToggle, background, balance }: BackgroundPanelProps) {
  const summary = (() => {
    if (background.backgroundType === 'ai') {
      return `AI · ${background.aiProvider === 'gemini' ? 'Gemini' : 'OpenAI'}`;
    }

    if (background.backgroundType === 'image') {
      return t('uploadImage');
    }

    return t(backgroundTypeLabels[background.backgroundType]);
  })();
  const selectedProviderMeta = PROVIDER_META[background.aiProvider];

  return (
    <ControlSection
      title={t('background')}
      icon={<Palette className="w-4 h-4" />}
      expanded={expanded}
      onToggle={onToggle}
      summary={summary}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['solid', 'gradient', 'transparent', 'image', 'ai'] as BackgroundType[]).map((type) => (
            <button
              key={type}
              onClick={() => background.onBackgroundTypeChange(type)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                background.backgroundType === type
                  ? 'bg-(--app-accent-50) border-(--app-accent-200) text-(--app-accent-700)'
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
              className="app-select text-sm"
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
              className="w-full py-2 px-4 border border-dashed border-[rgba(34,48,52,0.14)] rounded-xl text-sm text-gray-600 hover:bg-(--app-accent-50) hover:border-(--app-accent-300) transition-all flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" /> {t('uploadImage')}
            </button>
          </div>
        ) : null}

        {background.backgroundType === 'ai' ? (
          <div className="space-y-4 rounded-2xl border border-(--app-accent-200) bg-[linear-gradient(180deg,rgba(237,244,243,0.92),rgba(255,253,249,1))] p-4 shadow-[0_16px_40px_var(--app-accent-shadow)]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-(--app-accent-700)">{t('aiProvider')}</div>
                  <p className="mt-1 text-xs leading-5 text-[rgba(51,88,87,0.82)]">
                    {t('aiModelHint')}
                  </p>
                </div>
                {balance !== null && balance !== undefined ? (
                  <div className="rounded-full border border-(--app-accent-200) bg-white px-3 py-1 text-xs font-medium text-(--app-accent-700)">
                    {t('creditBalance')}: {balance}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {aiProviders.map((provider) => (
                  (() => {
                    const meta = PROVIDER_META[provider];
                    const isActive = background.aiProvider === provider;

                    return (
                  <button
                    key={provider}
                    onClick={() => background.onAiProviderChange(provider)}
                    className={`rounded-2xl border p-3 text-left transition-all ${
                      isActive
                        ? 'border-(--app-accent-500) bg-(--app-accent-700) text-white shadow-[0_14px_30px_var(--app-accent-shadow)]'
                        : 'border-(--app-accent-200) bg-white text-(--app-accent-900) hover:border-(--app-accent-300) hover:bg-(--app-accent-50)'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{meta.title}</div>
                        <div className={`mt-1 text-[11px] font-medium ${isActive ? 'text-[rgba(237,244,243,0.92)]' : 'text-(--app-accent-600)'}`}>
                          {t(meta.tradeoffKey)}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${isActive ? 'bg-white/15 text-white' : 'bg-(--app-accent-100) text-(--app-accent-700)'}`}>
                        {CREDIT_COST[provider]} {CREDIT_COST[provider] === 1 ? t('creditsPerGen') : t('creditsPerGenMultiple')}
                      </span>
                    </div>
                    <p className={`mt-2 text-[11px] leading-5 ${isActive ? 'text-[rgba(255,250,242,0.92)]' : 'text-gray-600'}`}>
                      {t(meta.detailKey)}
                    </p>
                  </button>
                    );
                  })()
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-(--app-accent-200) bg-white/85 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{selectedProviderMeta.title}</div>
                  <p className="mt-1 text-xs leading-5 text-gray-600">{t(selectedProviderMeta.tradeoffKey)}. {t(selectedProviderMeta.detailKey)}</p>
                </div>
                <div className="rounded-full bg-(--app-accent-50) px-2.5 py-1 text-[11px] font-semibold text-(--app-accent-700)">
                  {CREDIT_COST[background.aiProvider]} {CREDIT_COST[background.aiProvider] === 1 ? t('creditsPerGen') : t('creditsPerGenMultiple')}
                </div>
              </div>
            </div>

            <textarea
              className="app-textarea h-20 text-sm resize-none"
              value={background.aiPrompt}
              onChange={(event) => background.onAiPromptChange(event.target.value)}
              maxLength={MAX_AI_PROMPT_LENGTH}
              placeholder={t('aiPromptPlaceholder')}
            />
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-[rgba(51,88,87,0.82)]">{t('promptSuggestions')}</div>
              <div className="flex flex-wrap gap-2">
                {PROMPT_SUGGESTIONS.map((suggestion) => {
                  const isSelected = background.aiPrompt.trim() === suggestion;

                  return (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => background.onAiPromptChange(suggestion)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-(--app-accent-500) bg-(--app-accent-700) text-white'
                          : 'border-(--app-accent-200) bg-white text-(--app-accent-700) hover:border-(--app-accent-300) hover:bg-(--app-accent-50)'
                      }`}
                    >
                      {suggestion}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="text-right text-xs text-[rgba(51,88,87,0.82)]">
              {background.aiPrompt.length}/{MAX_AI_PROMPT_LENGTH}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-(--app-accent-200) bg-white/85 px-3 py-2 text-xs text-[rgba(51,88,87,0.82)]">
              <span>
                {t(background.aiProvider === 'gemini' ? 'geminiTip' : 'openaiTip')}
              </span>
            </div>
            <button
              onClick={background.onGenerateAiBackground}
              disabled={background.isGeneratingAI}
              className="app-button-primary w-full py-2 px-4 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
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
                className="app-range"
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
                className="app-range"
              />
            </div>
          </div>
        ) : null}
      </div>
    </ControlSection>
  );
}