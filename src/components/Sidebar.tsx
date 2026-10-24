import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Palette, Settings, Sparkles, Type, X } from 'lucide-react';
import type { SidebarProps, SocialPlatform } from '../types';
import { BackgroundPanel } from './sidebar/BackgroundPanel';
import { CanvasSizePanel } from './sidebar/CanvasSizePanel';
import { ContentPanel } from './sidebar/ContentPanel';
import { DecorationsPanel } from './sidebar/DecorationsPanel';
import { SettingsPanel } from './sidebar/SettingsPanel';
import { SidebarFooter } from './sidebar/SidebarFooter';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { TemplatesPanel } from './sidebar/TemplatesPanel';
import { TypographyPanel } from './sidebar/TypographyPanel';
import { useDialogA11y } from '../hooks/useDialogA11y';

type MobilePanel = 'templates' | 'content' | 'style' | 'export' | 'settings';

const MOBILE_PANEL_TITLE_KEYS = {
  templates: 'templates',
  content: 'content',
  style: 'stylePanelTitle',
  export: 'exportAndShare',
  settings: 'settings',
} as const;

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
  exportFormat,
  onExportFormatChange,
  exportScale,
  onExportScaleChange,
  onDownload,
  onShare,
  onCopy,
  onShareToSocial,
  isExporting,
  isSharing,
  canShare,
}: SidebarProps) {
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [socialFeedback, setSocialFeedback] = useState<'clipboard' | 'downloaded' | null>(null);
  const [activeSocialPlatform, setActiveSocialPlatform] = useState<SocialPlatform | null>(null);
  const isMobileControlsOpen = activeMobilePanel !== null;
  const mobileDialogRef = useRef<HTMLElement>(null);
  const closeMobilePanel = useCallback(() => setActiveMobilePanel(null), []);

  useDialogA11y({ isOpen: isMobileControlsOpen, dialogRef: mobileDialogRef, onClose: closeMobilePanel });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setActiveMobilePanel(null);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    if (mediaQuery.matches) setActiveMobilePanel(null);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const openMobilePanel = (panel: MobilePanel) => {
    if (panel === 'templates') {
      onExpandSection('templates');
    }
    if (panel === 'content') {
      onExpandSection('content');
    }
    if (panel === 'style') {
      onExpandSection('background');
    }
    setActiveMobilePanel(panel);
  };

  const handleShareToSocial = async (platform: SocialPlatform) => {
    if (isExporting || isSharing) {
      return;
    }

    setActiveSocialPlatform(platform);
    setSocialFeedback(null);
    const result = await onShareToSocial(platform);
    setActiveSocialPlatform(null);

    if (result !== 'cancelled') {
      setSocialFeedback(result);
      window.setTimeout(() => setSocialFeedback(null), 5000);
    }
  };

  const mobileButtonClassName = (panel: MobilePanel) => {
    const isActive = activeMobilePanel === panel;
    return `flex min-w-0 min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-xs font-medium transition-colors ${isActive ? 'bg-(--app-accent-700) text-white shadow-[0_10px_22px_var(--app-accent-shadow)]' : 'text-(--app-accent-800) hover:bg-[rgba(237,244,243,0.8)]'}`;
  };

  const sections = () => (
    <div className="app-sidebar-scrollbar p-4 sm:p-6 space-y-6 sm:space-y-8 flex-1 overflow-y-auto">
      <div>
        <ContentPanel
          t={t}
          expanded={expandedSections.content}
          onToggle={() => onToggleSection('content')}
          content={content}
        />
      </div>
      <div>
        <TemplatesPanel
          t={t}
          expanded={expandedSections.templates}
          onToggle={() => onToggleSection('templates')}
          templates={templates}
          currentBackgroundType={background.backgroundType}
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
        <div className="app-sidebar-scrollbar p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">
          <CanvasSizePanel
            t={t}
            expanded={expandedSections.canvasSize}
            onToggle={() => onToggleSection('canvasSize')}
            canvas={canvas}
          />
          <TemplatesPanel
            t={t}
            expanded={expandedSections.templates}
            onToggle={() => onToggleSection('templates')}
            templates={templates}
            currentBackgroundType={background.backgroundType}
          />
        </div>
      );
    }

    if (activeMobilePanel === 'content') {
      return (
        <div className="app-sidebar-scrollbar p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">
          <ContentPanel
            t={t}
            expanded={expandedSections.content}
            onToggle={() => onToggleSection('content')}
            content={content}
          />
          <TypographyPanel
            language={language}
            t={t}
            expanded={expandedSections.typography}
            onToggle={() => onToggleSection('typography')}
            typography={typography}
          />
        </div>
      );
    }

    if (activeMobilePanel === 'style') {
      return (
        <div className="app-sidebar-scrollbar p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">
          <BackgroundPanel
            t={t}
            expanded={expandedSections.background}
            onToggle={() => onToggleSection('background')}
            background={background}
            balance={billing.balance}
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
        <div className="app-sidebar-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <SidebarFooter
            t={t}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            exportFormat={exportFormat}
            onExportFormatChange={onExportFormatChange}
            exportScale={exportScale}
            onExportScaleChange={onExportScaleChange}
            onDownload={onDownload}
            onShare={onShare}
            onCopy={onCopy}
            isExporting={isExporting}
            isSharing={isSharing}
            canShare={canShare}
            title={t(canShare ? 'exportAndShare' : 'exportImage')}
            showSocialActions
            onShareToSocial={handleShareToSocial}
            activeSocialPlatform={activeSocialPlatform}
            socialFeedback={socialFeedback}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {/* Mobile settings shortcut */}
      <div className="lg:hidden fixed left-4 top-[calc(1rem+env(safe-area-inset-top))] z-20">
        <button
          type="button"
          onClick={() => setActiveMobilePanel('settings')}
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-[0_12px_30px_var(--app-accent-shadow)] backdrop-blur transition-colors ${
            activeMobilePanel === 'settings'
              ? 'border-(--app-accent-300) bg-(--app-accent-700) text-white'
              : 'border-white/75 bg-[rgba(255,253,249,0.86)] text-(--app-accent-700) hover:bg-(--app-accent-50)'
          }`}
          aria-label={t('settings')}
          aria-expanded={activeMobilePanel === 'settings'}
          aria-controls="mobile-controls-drawer"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none">
        <div className="pointer-events-auto mx-auto grid max-w-md grid-cols-4 items-stretch gap-2 rounded-[1.75rem] border border-white/70 bg-[rgba(255,253,249,0.92)] p-2 shadow-[0_18px_50px_var(--app-accent-shadow)] backdrop-blur">
          <button
            type="button"
            onClick={() => openMobilePanel('templates')}
            className={mobileButtonClassName('templates')}
            aria-expanded={activeMobilePanel === 'templates'}
            aria-controls="mobile-controls-drawer"
          >
            <Sparkles className={`h-4 w-4 ${activeMobilePanel === 'templates' ? 'text-white' : 'text-(--app-accent-600)'}`} />
            <span className="truncate">{t('templates')}</span>
          </button>
          <button
            type="button"
            onClick={() => openMobilePanel('content')}
            className={mobileButtonClassName('content')}
            aria-expanded={activeMobilePanel === 'content'}
            aria-controls="mobile-controls-drawer"
          >
            <Type className={`h-4 w-4 ${activeMobilePanel === 'content' ? 'text-white' : 'text-(--app-accent-600)'}`} />
            <span className="truncate">{t('content')}</span>
          </button>
          <button
            type="button"
            onClick={() => openMobilePanel('style')}
            className={mobileButtonClassName('style')}
            aria-expanded={activeMobilePanel === 'style'}
            aria-controls="mobile-controls-drawer"
          >
            <Palette className={`h-4 w-4 ${activeMobilePanel === 'style' ? 'text-white' : 'text-(--app-accent-600)'}`} />
            <span className="truncate">{t('stylePanelTitle')}</span>
          </button>
          <button
            type="button"
            onClick={() => openMobilePanel('export')}
            className={mobileButtonClassName('export')}
            aria-expanded={activeMobilePanel === 'export'}
            aria-controls="mobile-controls-drawer"
          >
            <Download className={`h-4 w-4 ${activeMobilePanel === 'export' ? 'text-white' : 'text-(--app-accent-700)'}`} />
            <span className="truncate">{t('quickExport')}</span>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileControlsOpen ? (
          <>
            <motion.button
              type="button"
              className="lg:hidden fixed inset-0 z-30 bg-[rgba(31,52,54,0.32)] backdrop-blur-[2px]"
              onClick={closeMobilePanel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-label={t('closeControls')}
            />

            <motion.aside
              ref={mobileDialogRef}
              id="mobile-controls-drawer"
              className="lg:hidden fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-hidden rounded-t-[2.5rem] bg-(--app-surface) shadow-[0_-12px_60px_rgba(0,0,0,0.15)] flex flex-col"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-controls-title"
              tabIndex={-1}
            >
              <div className="px-5 pt-2 pb-1 border-b border-[rgba(34,48,52,0.04)] sticky top-0 z-10 bg-(--app-surface)/80 backdrop-blur-md">
                <div className="mobile-drawer-handle" />
                <div className="flex items-center justify-between gap-4 mb-2">
                  <h3 id="mobile-controls-title" className="text-sm font-bold text-(--app-accent-900)">
                    {activeMobilePanel === 'export'
                      ? t(canShare ? 'exportAndShare' : 'exportImage')
                      : activeMobilePanel
                        ? t(MOBILE_PANEL_TITLE_KEYS[activeMobilePanel])
                        : t('controlsPanelTitle')}
                  </h3>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={closeMobilePanel}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(237,244,243,0.5)] text-(--app-accent-700) active:scale-90 transition-transform"
                      aria-label={t('closeControls')}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {activeMobilePanel === 'settings' ? <SidebarHeader t={t} isSheet balance={billing.balance} /> : null}
              {mobileSections()}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="app-sidebar-scrollbar hidden lg:flex lg:order-1 lg:w-[320px] xl:w-[360px] lg:border-r lg:border-white/40 lg:h-screen lg:overflow-y-auto shrink-0 bg-[rgba(255,250,242,0.55)] shadow-sm z-10 flex-col backdrop-blur-xl">
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
          </>
        )}
      </aside>
    </>
  );
}
