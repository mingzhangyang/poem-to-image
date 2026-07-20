import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, LogIn, Palette, Sparkles, Upload } from 'lucide-react';
import type { TranslationKey } from '../../translations';
import { CREDIT_COST } from '../../types';
import type { AiProvider, BackgroundType, BackgroundSectionProps, ExpandedSections, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';
import { MAX_AI_PROMPT_LENGTH } from '../../hooks/useAiBackground';
import { useAppAuth } from '../../context/auth';
import { AuthSignInButton } from '../auth/ClerkUi';

const CLERK_CONFIGURED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const backgroundTypeLabels: Record<BackgroundType, TranslationKey> = {
  solid: 'bgSolid',
  gradient: 'bgGradient',
  transparent: 'bgTransparent',
  image: 'bgImage',
  ai: 'bgAI',
};

const aiProviders: AiProvider[] = ['gemini', 'openai'];

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
  balance: number | null;
}

export function BackgroundPanel({ t, expanded, onToggle, background, balance }: BackgroundPanelProps) {
  const { isSignedIn } = useAppAuth();
  const [isPromptHelpOpen, setIsPromptHelpOpen] = useState(false);
  const hasImageAdjustments = background.bgBrightness !== 100 || background.bgBlur !== 0;
  const [isImageAdjustmentsOpen, setIsImageAdjustmentsOpen] = useState(hasImageAdjustments);
  const requiredCredits = CREDIT_COST[background.aiProvider];
  const hasPromptSource = background.aiPrompt.trim().length > 0 || background.hasPoemText;
  const isBalanceLoading = isSignedIn && balance === null;
  const hasEnoughCredits = balance !== null && balance >= requiredCredits;
  const canGenerate = isSignedIn && hasPromptSource && hasEnoughCredits && !background.isGeneratingAI;
  const generationHint = !isSignedIn
    ? t('errSignInRequired')
    : !hasPromptSource
      ? t('errNoPrompt')
      : isBalanceLoading
        ? t('loadingBalance')
        : !hasEnoughCredits
          ? t('errInsufficientCredits')
          : null;
  const summary = (() => {
    if (background.backgroundType === 'ai') {
      return `AI · ${background.aiProvider === 'gemini' ? 'Gemini' : 'OpenAI'}`;
    }

    if (background.backgroundType === 'image') {
      return t('uploadImage');
    }

    return t(backgroundTypeLabels[background.backgroundType]);
  })();

  useEffect(() => {
    if (hasImageAdjustments) {
      setIsImageAdjustmentsOpen(true);
    }
  }, [hasImageAdjustments]);

  return (
    <ControlSection
      title={t('background')}
      icon={<Palette className="w-4 h-4" />}
      tint="var(--app-cat-background)"
      expanded={expanded}
      onToggle={onToggle}
      summary={summary}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['solid', 'gradient', 'transparent', 'image', 'ai'] as BackgroundType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => background.onBackgroundTypeChange(type)}
              aria-pressed={background.backgroundType === type}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                background.backgroundType === type
                  ? 'bg-(--app-accent-50) border-(--app-accent-200) text-(--app-accent-700)'
                  : 'bg-[rgba(255,253,249,0.92)] border-[rgba(34,48,52,0.08)] text-(--app-accent-700) hover:bg-(--app-accent-50)'
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
              aria-label={t('bgSolid')}
              value={background.backgroundColor}
              onChange={(event) => background.onBackgroundColorChange(event.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0 p-0"
            />
            <span className="text-sm text-(--app-accent-700) uppercase font-mono">{background.backgroundColor}</span>
          </div>
        ) : null}

        {background.backgroundType === 'gradient' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label={`${t('bgGradient')} 1`}
                value={background.gradientColor1}
                onChange={(event) => background.onGradientColor1Change(event.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
              />
              <input
                type="color"
                aria-label={`${t('bgGradient')} 2`}
                value={background.gradientColor2}
                onChange={(event) => background.onGradientColor2Change(event.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
              />
            </div>
            <select
              aria-label={t('bgGradient')}
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
              aria-label={t('uploadImage')}
              accept="image/*"
              onChange={background.onImageUpload}
              ref={background.fileInputRef}
              className="hidden"
            />
            <button
              onClick={() => background.fileInputRef.current?.click()}
              className="w-full py-2 px-4 border border-dashed border-[rgba(34,48,52,0.14)] rounded-xl text-sm text-(--app-accent-700) hover:bg-(--app-accent-50) hover:border-(--app-accent-300) transition-all flex items-center justify-center gap-2"
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

              <div className="grid grid-rows-2 gap-2">
                {aiProviders.map((provider) => {
                  const meta = PROVIDER_META[provider];
                  const isActive = background.aiProvider === provider;
                  return (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => background.onAiProviderChange(provider)}
                      aria-pressed={isActive}
                      className={`rounded-2xl border p-3 text-left transition-all ${
                        isActive
                          ? 'border-(--app-accent-500) bg-(--app-accent-700) text-white shadow-[0_14px_30px_var(--app-accent-shadow)]'
                          : 'border-(--app-accent-200) bg-white text-(--app-accent-900) hover:border-(--app-accent-300) hover:bg-(--app-accent-50)'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{meta.title}</div>
                          <div className={`mt-1 text-xs font-medium ${isActive ? 'text-[rgba(237,244,243,0.92)]' : 'text-(--app-accent-600)'}`}>
                            {t(meta.tradeoffKey)}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${isActive ? 'bg-white/15 text-white' : 'bg-(--app-accent-100) text-(--app-accent-700)'}`}>
                          {CREDIT_COST[provider]} {CREDIT_COST[provider] === 1 ? t('creditsPerGen') : t('creditsPerGenMultiple')}
                        </span>
                      </div>
                      <p className={`mt-2 text-xs leading-5 ${isActive ? 'text-[rgba(255,250,242,0.92)]' : 'text-(--app-accent-700)'}`}>
                        {t(meta.detailKey)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <textarea
              aria-label={t('aiPromptPlaceholder')}
              className="app-textarea h-20 text-sm resize-none"
              value={background.aiPrompt}
              onChange={(event) => background.onAiPromptChange(event.target.value)}
              maxLength={MAX_AI_PROMPT_LENGTH}
              placeholder={t('aiPromptPlaceholder')}
            />
            <div className="text-right text-xs text-[rgba(51,88,87,0.82)]">
              {background.aiPrompt.length}/{MAX_AI_PROMPT_LENGTH}
            </div>
            <div className="rounded-2xl border border-[rgba(34,48,52,0.08)] bg-white/80">
              <button
                type="button"
                onClick={() => setIsPromptHelpOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-(--app-accent-50)"
                aria-expanded={isPromptHelpOpen}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-(--app-accent-500)">{t('promptSuggestions')}</span>
                  <span className="mt-1 block text-xs text-(--app-accent-500)">
                    {t(background.aiProvider === 'gemini' ? 'geminiTip' : 'openaiTip')}
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-[rgba(34,48,52,0.08)] bg-white p-1 text-(--app-accent-600)">
                  {isPromptHelpOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
              </button>

              {isPromptHelpOpen ? (
                <div className="space-y-3 border-t border-[rgba(34,48,52,0.06)] px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    {PROMPT_SUGGESTIONS.map((suggestion) => {
                      const isSelected = background.aiPrompt.trim() === suggestion;

                      return (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => background.onAiPromptChange(suggestion)}
                          aria-pressed={isSelected}
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
                  <div className="rounded-xl border border-(--app-accent-200) bg-white/85 px-3 py-2 text-xs text-[rgba(51,88,87,0.82)]">
                    {t(background.aiProvider === 'gemini' ? 'geminiTip' : 'openaiTip')}
                  </div>
                </div>
              ) : null}
            </div>
            <button
              onClick={background.onGenerateAiBackground}
              disabled={!canGenerate}
              className="app-button-primary w-full py-2 px-4 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {background.isGeneratingAI ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('generating')}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> {t('generateAIBg')} · {requiredCredits} {t('credits')}
                </>
              )}
            </button>
            {balance !== null && hasEnoughCredits ? (
              <p className="text-xs text-(--app-accent-600)">
                {t('creditBalance')}: {balance} → {balance - requiredCredits}
              </p>
            ) : null}
            {generationHint ? (
              <div className="space-y-2" role="status" aria-live="polite">
                <p className="text-xs leading-5 text-(--app-accent-700)">{generationHint}</p>
                {!isSignedIn && CLERK_CONFIGURED ? (
                  <AuthSignInButton mode="modal">
                    <button type="button" className="app-button-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
                      <LogIn className="h-4 w-4" /> {t('signIn')}
                    </button>
                  </AuthSignInButton>
                ) : null}
              </div>
            ) : null}
            {background.aiError ? <p className="mt-2 text-xs text-red-600" role="alert">{background.aiError}</p> : null}
          </div>
        ) : null}

        {background.backgroundType === 'image' || background.backgroundType === 'ai' ? (
          <div className="pt-3 border-t border-[rgba(34,48,52,0.06)] space-y-3">
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-(--app-accent-500)">{t('bgFillMode')}</div>
              <div className="flex gap-1.5">
                {(['cover', 'contain', 'stretch'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => background.onBackgroundSizeChange(mode)}
                    aria-pressed={background.backgroundSize === mode}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                      background.backgroundSize === mode
                        ? 'border-(--app-accent-400) bg-(--app-accent-50) text-(--app-accent-700)'
                        : 'border-[rgba(34,48,52,0.08)] bg-white text-(--app-accent-700) hover:border-(--app-accent-200) hover:bg-(--app-accent-50)'
                    }`}
                  >
                    {t(mode === 'cover' ? 'bgFillCover' : mode === 'contain' ? 'bgFillContain' : 'bgFillStretch')}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsImageAdjustmentsOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[rgba(34,48,52,0.08)] bg-[rgba(255,253,249,0.94)] px-3 py-2.5 text-left transition-colors hover:border-(--app-accent-200) hover:bg-(--app-accent-50)"
              aria-expanded={isImageAdjustmentsOpen}
            >
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-(--app-accent-500)">{t('brightness')} / {t('blur')}</span>
                <span className="mt-1 block text-xs text-(--app-accent-500)">
                  {background.bgBrightness}% · {background.bgBlur}px
                </span>
              </span>
              <span className="shrink-0 rounded-full border border-[rgba(34,48,52,0.08)] bg-white p-1 text-(--app-accent-600)">
                {isImageAdjustmentsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
            </button>

            {isImageAdjustmentsOpen ? (
              <div className="mt-3 space-y-3 rounded-2xl border border-[rgba(34,48,52,0.06)] bg-[rgba(255,250,242,0.6)] p-3">
                <div>
                  <div className="flex justify-between text-xs text-(--app-accent-500) mb-1">
                    <span>{t('brightness')}</span>
                    <span>{background.bgBrightness}%</span>
                  </div>
                  <input
                    type="range"
                    aria-label={t('brightness')}
                    aria-valuetext={`${background.bgBrightness}%`}
                    min="0"
                    max="200"
                    value={background.bgBrightness}
                    onChange={(event) => background.onBgBrightnessChange(Number(event.target.value))}
                    className="app-range"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-(--app-accent-500) mb-1">
                    <span>{t('blur')}</span>
                    <span>{background.bgBlur}px</span>
                  </div>
                  <input
                    type="range"
                    aria-label={t('blur')}
                    aria-valuetext={`${background.bgBlur}px`}
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
        ) : null}
      </div>
    </ControlSection>
  );
}
