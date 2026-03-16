import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Check, Download, Palette, Settings, Sparkles, Settings2, X } from 'lucide-react';
import type { SidebarProps } from '../types';
import { BackgroundPanel } from './sidebar/BackgroundPanel';
import { CanvasSizePanel } from './sidebar/CanvasSizePanel';
import { ContentPanel } from './sidebar/ContentPanel';
import { DecorationsPanel } from './sidebar/DecorationsPanel';
import { SettingsPanel } from './sidebar/SettingsPanel';
import { SidebarFooter } from './sidebar/SidebarFooter';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { TemplatesPanel } from './sidebar/TemplatesPanel';
import { TypographyPanel } from './sidebar/TypographyPanel';

type MobilePanel = 'templates' | 'content' | 'style' | 'export' | 'settings';

const ONBOARDING_DISMISSED_STORAGE_KEY = 'poem-to-image.onboarding-dismissed';

export function Sidebar({
  language,
  onLanguageChange,
  t,
  expandedSections,
  onToggleSection,
  onExpandSection,
  templates,
  canvas,
  content,
  background,
  typography,
  decorations,
  billing,
  canvasWidth,
  canvasHeight,
  exportScale,
  onExportScaleChange,
  onDownload,
  isExporting,
}: SidebarProps) {
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(false);
  const isMobileControlsOpen = activeMobilePanel !== null;
  const shouldShowOnboarding = !templates.activeTemplateId && !isOnboardingDismissed;

  const onboardingSteps = useMemo(
    () => [t('templates'), t('content'), t('exportImage')],
    [t],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setActiveMobilePanel(null);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    if (mediaQuery.matches) setActiveMobilePanel(null);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const storedDismissedState = window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY);
    setIsOnboardingDismissed(storedDismissedState === 'true');
  }, []);

  useEffect(() => {
    if (!templates.activeTemplateId) {
      return;
    }

    setIsOnboardingDismissed(true);
    window.localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, 'true');
  }, [templates.activeTemplateId]);

  useEffect(() => {
    if (!isMobileControlsOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveMobilePanel(null);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileControlsOpen]);

  const openMobilePanel = (panel: MobilePanel) => {
    if (panel === 'templates') onExpandSection('templates');
    if (panel === 'content') {
      onExpandSection('canvasSize');
      onExpandSection('content');
    }
    if (panel === 'style') {
      onExpandSection('background');
      onExpandSection('typography');
      onExpandSection('decorations');
    }
    setActiveMobilePanel(panel);
  };

  const mobileButtonClassName = (panel: MobilePanel) => {
    const isActive = activeMobilePanel === panel;
    return `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-medium transition-colors ${isActive ? 'bg-[var(--app-accent-700)] text-white shadow-[0_10px_22px_var(--app-accent-shadow)]' : 'text-[var(--app-accent-800)] hover:bg-[rgba(237,244,243,0.8)]'}`;
  };

  const dismissOnboarding = () => {
    setIsOnboardingDismissed(true);
    window.localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, 'true');
  };

  const onboardingCard = (compact = false) => (
    <div className={`overflow-hidden rounded-[1.75rem] border border-[var(--app-accent-200)] bg-[linear-gradient(145deg,rgba(237,244,243,0.96),rgba(255,250,242,0.98))] shadow-[0_24px_60px_var(--app-accent-shadow)] ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--app-accent-500)]">
            {t('appTitle')}
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {t('templatesHint')}
          </p>
        </div>
        <button
          type="button"
          onClick={dismissOnboarding}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/80 text-[var(--app-accent-600)] transition-colors hover:text-[var(--app-accent-900)]"
          aria-label={t('closeControls')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {onboardingSteps.map((step, index) => (
          <div key={step} className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-accent-500)]">{index + 1}</div>
            <div className="mt-1 flex items-center justify-between gap-2 text-sm font-medium text-gray-800">
              <span>{step}</span>
              <ArrowRight className="h-3.5 w-3.5 text-[var(--app-accent-500)]" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {templates.templates.slice(0, 3).map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => templates.onApplyTemplate(template.id)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--app-accent-200)] bg-white px-3 py-2 text-sm font-medium text-[var(--app-accent-700)] transition-colors hover:border-[var(--app-accent-300)] hover:bg-[var(--app-accent-50)]"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{t(template.nameKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const sections = () => (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 flex-1 overflow-y-auto">
      {shouldShowOnboarding ? onboardingCard() : null}
      <div>
        <TemplatesPanel
          t={t}
          expanded={expandedSections.templates}
          onToggle={() => onToggleSection('templates')}
          templates={templates}
        />
      </div>
      <div>
        <CanvasSizePanel
          t={t}
          expanded={expandedSections.canvasSize}
          onToggle={() => onToggleSection('canvasSize')}
          canvas={canvas}
        />
      </div>
      <div>
        <ContentPanel
          t={t}
          expanded={expandedSections.content}
          onToggle={() => onToggleSection('content')}
          content={content}
        />
      </div>
      <div>
        <BackgroundPanel
          t={t}
          expanded={expandedSections.background}
          onToggle={() => onToggleSection('background')}
          background={background}
          balance={billing.balance}
        />
      </div>
      <div>
        <TypographyPanel
          language={language}
          t={t}
          expanded={expandedSections.typography}
          onToggle={() => onToggleSection('typography')}
          typography={typography}
        />
      </div>
      <div>
        <DecorationsPanel
          t={t}
          expanded={expandedSections.decorations}
          onToggle={() => onToggleSection('decorations')}
          decorations={decorations}
        />
      </div>
    </div>
  );

  const mobileSections = () => {
    if (activeMobilePanel === 'settings') {
      return (
        <SettingsPanel
          t={t}
          language={language}
          onLanguageChange={onLanguageChange}
          billing={billing}
        />
      );
    }

    if (activeMobilePanel === 'templates') {
      return (
        <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">
          {shouldShowOnboarding ? onboardingCard(true) : null}
          <TemplatesPanel
            t={t}
            expanded={expandedSections.templates}
            onToggle={() => onToggleSection('templates')}
            templates={templates}
          />
        </div>
      );
    }

    if (activeMobilePanel === 'content') {
      return (
        <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">
          <CanvasSizePanel
            t={t}
            expanded={expandedSections.canvasSize}
            onToggle={() => onToggleSection('canvasSize')}
            canvas={canvas}
          />
          <ContentPanel
            t={t}
            expanded={expandedSections.content}
            onToggle={() => onToggleSection('content')}
            content={content}
          />
        </div>
      );
    }

    if (activeMobilePanel === 'style') {
      return (
        <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">
          <BackgroundPanel
            t={t}
            expanded={expandedSections.background}
            onToggle={() => onToggleSection('background')}
            background={background}
            balance={billing.balance}
          />
          <TypographyPanel
            language={language}
            t={t}
            expanded={expandedSections.typography}
            onToggle={() => onToggleSection('typography')}
            typography={typography}
          />
          <DecorationsPanel
            t={t}
            expanded={expandedSections.decorations}
            onToggle={() => onToggleSection('decorations')}
            decorations={decorations}
          />
        </div>
      );
    }

    if (activeMobilePanel === 'export') {
      return (
        <SidebarFooter
          t={t}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          exportScale={exportScale}
          onExportScaleChange={onExportScaleChange}
          onDownload={onDownload}
          isExporting={isExporting}
        />
      );
    }

    return null;
  };

  return (
    <>
      {/* Mobile bottom bar */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none">
        <div className="pointer-events-auto mx-auto flex max-w-md items-stretch gap-2 rounded-[1.75rem] border border-white/70 bg-[rgba(255,253,249,0.92)] p-2 shadow-[0_18px_50px_var(--app-accent-shadow)] backdrop-blur">
          <button
            type="button"
            onClick={() => openMobilePanel('templates')}
            className={mobileButtonClassName('templates')}
            aria-expanded={activeMobilePanel === 'templates'}
            aria-controls="mobile-controls-drawer"
          >
            <Sparkles className={`h-4 w-4 ${activeMobilePanel === 'templates' ? 'text-white' : 'text-[var(--app-accent-600)]'}`} />
            <span className="truncate">{t('templates')}</span>
          </button>
          <button
            type="button"
            onClick={() => openMobilePanel('content')}
            className={mobileButtonClassName('content')}
            aria-expanded={activeMobilePanel === 'content'}
            aria-controls="mobile-controls-drawer"
          >
            <Settings2 className={`h-4 w-4 ${activeMobilePanel === 'content' ? 'text-white' : 'text-[var(--app-accent-600)]'}`} />
            <span className="truncate">{t('content')}</span>
          </button>
          <button
            type="button"
            onClick={() => openMobilePanel('style')}
            className={mobileButtonClassName('style')}
            aria-expanded={activeMobilePanel === 'style'}
            aria-controls="mobile-controls-drawer"
          >
            <Palette className={`h-4 w-4 ${activeMobilePanel === 'style' ? 'text-white' : 'text-[var(--app-accent-600)]'}`} />
            <span className="truncate">{t('background')}</span>
          </button>
          <button
            type="button"
            onClick={() => openMobilePanel('export')}
            className={mobileButtonClassName('export')}
            aria-expanded={activeMobilePanel === 'export'}
            aria-controls="mobile-controls-drawer"
          >
            <Download className={`h-4 w-4 ${activeMobilePanel === 'export' ? 'text-white' : 'text-[var(--app-accent-700)]'}`} />
            <span className="truncate">{t('quickExport')}</span>
          </button>
          <button
            type="button"
            onClick={() => openMobilePanel('settings')}
            className={mobileButtonClassName('settings')}
            aria-expanded={activeMobilePanel === 'settings'}
            aria-controls="mobile-controls-drawer"
          >
            <Settings className={`h-4 w-4 ${activeMobilePanel === 'settings' ? 'text-white' : 'text-[var(--app-accent-600)]'}`} />
            <span className="truncate">{t('settings')}</span>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileControlsOpen ? (
          <>
            <motion.button
              type="button"
              className="md:hidden fixed inset-0 z-30 bg-[rgba(31,52,54,0.32)] backdrop-blur-[2px]"
              onClick={() => setActiveMobilePanel(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-label={t('closeControls')}
            />

            <motion.aside
              id="mobile-controls-drawer"
              className="md:hidden fixed inset-x-0 bottom-0 z-40 max-h-[82dvh] overflow-hidden rounded-t-4xl bg-[var(--app-surface)] shadow-2xl flex flex-col"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              role="dialog"
              aria-modal="true"
              aria-label={t('controlsPanelTitle')}
            >
              <div className="px-4 pt-3 pb-2 border-b border-[rgba(34,48,52,0.06)]">
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-200" />
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveMobilePanel(null)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(34,48,52,0.08)] text-[var(--app-accent-700)]"
                    aria-label={t('closeControls')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <SidebarHeader t={t} isSheet balance={billing.balance} />
              {mobileSections()}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:order-1 md:w-80 md:border-r md:border-[rgba(34,48,52,0.08)] md:h-screen md:overflow-y-auto shrink-0 bg-[rgba(255,253,249,0.86)] shadow-sm z-10 flex-col backdrop-blur">
        <SidebarHeader
          t={t}
          balance={billing.balance}
          isSettingsOpen={isSettingsOpen}
          onSettingsToggle={() => setIsSettingsOpen((prev) => !prev)}
        />
        {isSettingsOpen ? (
          <SettingsPanel
            t={t}
            language={language}
            onLanguageChange={onLanguageChange}
            billing={billing}
          />
        ) : (
          <>
            {sections()}
            <SidebarFooter
              t={t}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              exportScale={exportScale}
              onExportScaleChange={onExportScaleChange}
              onDownload={onDownload}
              isExporting={isExporting}
            />
          </>
        )}
      </aside>
    </>
  );
}
