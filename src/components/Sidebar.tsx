import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Palette, Settings2, Sparkles, X } from 'lucide-react';
import type { SidebarProps } from '../types';
import { BackgroundPanel } from './sidebar/BackgroundPanel';
import { BillingPanel } from './sidebar/BillingPanel';
import { CanvasSizePanel } from './sidebar/CanvasSizePanel';
import { ContentPanel } from './sidebar/ContentPanel';
import { DecorationsPanel } from './sidebar/DecorationsPanel';
import { SidebarFooter } from './sidebar/SidebarFooter';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { TemplatesPanel } from './sidebar/TemplatesPanel';
import { TypographyPanel } from './sidebar/TypographyPanel';

type MobilePanel = 'templates' | 'content' | 'style' | 'export';

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
  exportScale,
  onExportScaleChange,
  onDownload,
}: SidebarProps) {
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel | null>(null);
  const isMobileControlsOpen = activeMobilePanel !== null;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setActiveMobilePanel(null);
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    if (mediaQuery.matches) {
      setActiveMobilePanel(null);
    }

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!isMobileControlsOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMobilePanel(null);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileControlsOpen]);

  const openMobilePanel = (panel: MobilePanel) => {
    if (panel === 'templates') {
      onExpandSection('templates');
    }

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

    return `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-medium transition-colors ${isActive ? 'bg-gray-950 text-white shadow-sm' : 'text-gray-700'}`;
  };

  const sections = () => (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 flex-1 overflow-y-auto">
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

      <div>
        <BillingPanel
          t={t}
          expanded={expandedSections.billing}
          onToggle={() => onToggleSection('billing')}
          billing={billing}
        />
      </div>
    </div>
  );

  const mobileSections = () => {
    if (activeMobilePanel === 'templates') {
      return (
        <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">
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
          <BillingPanel
            t={t}
            expanded={expandedSections.billing}
            onToggle={() => onToggleSection('billing')}
            billing={billing}
          />
        </div>
      );
    }

    if (activeMobilePanel === 'export') {
      return (
        <SidebarFooter
          t={t}
          exportScale={exportScale}
          onExportScaleChange={onExportScaleChange}
          onDownload={onDownload}
        />
      );
    }

    return null;
  };

  return (
    <>
      <div className="md:hidden fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none">
        <div className="pointer-events-auto mx-auto flex max-w-md items-stretch gap-2 rounded-[1.75rem] border border-white/70 bg-white/92 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur">
          <button
            type="button"
            onClick={() => openMobilePanel('templates')}
            className={mobileButtonClassName('templates')}
            aria-expanded={activeMobilePanel === 'templates'}
            aria-controls="mobile-controls-drawer"
          >
            <Sparkles className={`h-4 w-4 ${activeMobilePanel === 'templates' ? 'text-white' : 'text-indigo-600'}`} />
            <span className="truncate">{t('templates')}</span>
          </button>
          <button
            type="button"
            onClick={() => openMobilePanel('content')}
            className={mobileButtonClassName('content')}
            aria-expanded={activeMobilePanel === 'content'}
            aria-controls="mobile-controls-drawer"
          >
            <Settings2 className={`h-4 w-4 ${activeMobilePanel === 'content' ? 'text-white' : 'text-sky-700'}`} />
            <span className="truncate">{t('content')}</span>
          </button>
          <button
            type="button"
            onClick={() => openMobilePanel('style')}
            className={mobileButtonClassName('style')}
            aria-expanded={activeMobilePanel === 'style'}
            aria-controls="mobile-controls-drawer"
          >
            <Palette className={`h-4 w-4 ${activeMobilePanel === 'style' ? 'text-white' : 'text-amber-600'}`} />
            <span className="truncate">{t('background')}</span>
          </button>
          <button
            type="button"
            onClick={() => openMobilePanel('export')}
            className={mobileButtonClassName('export')}
            aria-expanded={activeMobilePanel === 'export'}
            aria-controls="mobile-controls-drawer"
          >
            <Download className={`h-4 w-4 ${activeMobilePanel === 'export' ? 'text-white' : 'text-gray-700'}`} />
            <span className="truncate">{t('quickExport')}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileControlsOpen ? (
          <>
            <motion.button
              type="button"
              className="md:hidden fixed inset-0 z-30 bg-gray-950/35 backdrop-blur-[2px]"
              onClick={() => setActiveMobilePanel(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-label={t('closeControls')}
            />

            <motion.aside
              id="mobile-controls-drawer"
              className="md:hidden fixed inset-x-0 bottom-0 z-40 max-h-[82dvh] overflow-hidden rounded-t-4xl bg-white shadow-2xl flex flex-col"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              role="dialog"
              aria-modal="true"
              aria-label={t('controlsPanelTitle')}
            >
              <div className="px-4 pt-3 pb-2 border-b border-gray-100">
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-200" />
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveMobilePanel(null)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600"
                    aria-label={t('closeControls')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <SidebarHeader language={language} onLanguageChange={onLanguageChange} t={t} isSheet balance={billing.balance} />
              {mobileSections()}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <aside className="hidden md:flex md:order-1 md:w-80 md:border-r md:border-gray-200 md:h-screen md:overflow-y-auto shrink-0 bg-white shadow-sm z-10 flex-col">
        <SidebarHeader language={language} onLanguageChange={onLanguageChange} t={t} balance={billing.balance} />
        {sections()}
        <SidebarFooter
          t={t}
          exportScale={exportScale}
          onExportScaleChange={onExportScaleChange}
          onDownload={onDownload}
        />
      </aside>
    </>
  );
}
