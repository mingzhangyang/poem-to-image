import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Ellipsis, X } from 'lucide-react';
import type { SidebarPanel, SidebarProps } from '../types';
import { BackgroundPanel } from './sidebar/BackgroundPanel';
import { CanvasSizePanel } from './sidebar/CanvasSizePanel';
import { ContentPanel } from './sidebar/ContentPanel';
import { DecorationsPanel } from './sidebar/DecorationsPanel';
import { EXPORT_ITEM, PANEL_GROUP_ORDER, PANEL_GROUPS, SETTINGS_ITEM, isPanelGroup, type NavigationItem } from './sidebar/panelGroups';
import { SettingsPanel } from './sidebar/SettingsPanel';
import { SidebarFooter } from './sidebar/SidebarFooter';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { RailBrand, SidebarRail, getRailLabelId } from './sidebar/SidebarRail';
import { TemplatesPanel } from './sidebar/TemplatesPanel';
import { TypographyPanel } from './sidebar/TypographyPanel';
import { useDialogA11y } from '../hooks/useDialogA11y';

type MobileDestination = SidebarPanel | 'export' | 'settings';
type MobilePanel = MobileDestination | 'more';

/** Destinations pinned to the mobile dock, in order. The rest are under More. */
const MOBILE_DOCK: readonly MobileDestination[] = ['templates', 'content', 'decorations', 'export'];

const MOBILE_DESTINATIONS: readonly MobileDestination[] = [...PANEL_GROUP_ORDER, 'export', 'settings'];
const MOBILE_MORE: readonly MobileDestination[] = MOBILE_DESTINATIONS.filter((destination) => !MOBILE_DOCK.includes(destination));

const getMobileItem = (destination: MobileDestination): NavigationItem => {
  if (destination === 'export') return EXPORT_ITEM;
  if (destination === 'settings') return SETTINGS_ITEM;
  return PANEL_GROUPS[destination];
};

const DESKTOP_PANEL_ID = 'desktop-controls-panel';

export function Sidebar({
  language,
  onLanguageChange,
  t,
  desktopView,
  onDesktopViewChange,
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
  onPublishLink,
  publishLinkLabel,
  onManageShares,
  manageSharesLabel,
  isExporting,
  isSharing,
  canShare,
}: SidebarProps) {
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel | null>(null);
  const isMobileControlsOpen = activeMobilePanel !== null;
  const mobileDialogRef = useRef<HTMLElement>(null);
  const closeMobilePanel = useCallback(() => setActiveMobilePanel(null), []);
  const handlePublishFromMobile = () => {
    closeMobilePanel();
    onPublishLink();
  };
  const handleManageSharesFromMobile = () => {
    closeMobilePanel();
    onManageShares();
  };

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

  const chooseFromMore = (destination: MobileDestination) => {
    setActiveMobilePanel(destination);
    // The chosen menu item unmounts; keep focus inside the open drawer.
    window.requestAnimationFrame(() => mobileDialogRef.current?.focus());
  };

  const isDockButtonActive = (panel: MobilePanel) => (
    panel === 'more'
      ? activeMobilePanel === 'more' || (activeMobilePanel !== null && MOBILE_MORE.includes(activeMobilePanel))
      : activeMobilePanel === panel
  );

  const mobileButtonClassName = (isActive: boolean) => (
    `flex min-w-0 min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-2 text-[11px] font-medium leading-tight transition-colors ${isActive ? 'bg-(--app-accent-700) text-white shadow-[0_10px_22px_var(--app-accent-shadow)]' : 'text-(--app-accent-800) hover:bg-[rgba(237,244,243,0.8)]'}`
  );

  // Each control panel is defined once here; the desktop rail and the mobile
  // drawer both show one panel at a time, picked from PANEL_GROUPS.
  const renderPanel = (panel: SidebarPanel) => {
    switch (panel) {
      case 'content':
        return <ContentPanel t={t} content={content} />;
      case 'templates':
        return (
          <TemplatesPanel
            t={t}
            language={language}
            templates={templates}
            currentBackgroundType={background.backgroundType}
          />
        );
      case 'canvasSize':
        return <CanvasSizePanel t={t} canvas={canvas} />;
      case 'background':
        return (
          <BackgroundPanel
            t={t}
            language={language}
            background={background}
            balance={billing.balance}
          />
        );
      case 'typography':
        return <TypographyPanel language={language} t={t} typography={typography} />;
      case 'decorations':
        return <DecorationsPanel t={t} decorations={decorations} />;
    }
  };

  const renderGroup = (panel: SidebarPanel) => (
    <div className="app-sidebar-scrollbar p-4 sm:p-6 lg:p-0 flex-1 overflow-y-auto">
      {renderPanel(panel)}
    </div>
  );

  const moreMenu = () => (
    <ul className="app-sidebar-scrollbar flex-1 overflow-y-auto p-4 space-y-1.5">
      {MOBILE_MORE.map((destination) => {
        const { icon: Icon, labelKey } = getMobileItem(destination);
        return (
          <li key={destination}>
            <button
              type="button"
              onClick={() => chooseFromMore(destination)}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-(--app-accent-800) transition-colors hover:bg-[rgba(237,244,243,0.8)] active:bg-[rgba(237,244,243,0.8)]"
            >
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-(--app-accent-600)" />
              <span>{t(labelKey)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const settingsPanel = () => (
    <SettingsPanel
      t={t}
      language={language}
      onLanguageChange={onLanguageChange}
      billing={billing}
    />
  );

  const mobileSections = () => {
    if (activeMobilePanel === 'more') return moreMenu();
    if (activeMobilePanel === 'settings') return settingsPanel();
    if (isPanelGroup(activeMobilePanel)) return renderGroup(activeMobilePanel);

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
            onPublishLink={handlePublishFromMobile}
            publishLinkLabel={publishLinkLabel}
            onManageShares={handleManageSharesFromMobile}
            manageSharesLabel={manageSharesLabel}
            isExporting={isExporting}
            isSharing={isSharing}
            canShare={canShare}
            actionMode={canShare ? 'both' : 'save'}
            title={t(canShare ? 'exportAndShare' : 'exportImage')}
          />
        </div>
      );
    }

    return null;
  };

  const mobileDrawerTitle = () => {
    if (activeMobilePanel === 'export') return t(canShare ? 'exportAndShare' : 'exportImage');
    if (activeMobilePanel === 'more') return t('quickMore');
    if (activeMobilePanel) return t(getMobileItem(activeMobilePanel).titleKey);
    return t('controlsPanelTitle');
  };

  // Layers placed on the artwork, counted on the Decorations rail tab.
  const placedDecorationCount = decorations.customTexts.length + decorations.logos.length + decorations.signatures.length;

  return (
    <>
      {/* Mobile dock */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none">
        <div id="mobile-dock" className="pointer-events-auto mx-auto grid max-w-md grid-cols-5 items-stretch gap-1 rounded-[1.75rem] border border-white/70 bg-[rgba(255,253,249,0.92)] p-2 shadow-[0_18px_50px_var(--app-accent-shadow)] backdrop-blur">
          {MOBILE_DOCK.map((destination) => {
            const { icon: Icon, labelKey } = getMobileItem(destination);
            const isActive = isDockButtonActive(destination);
            return (
              <button
                key={destination}
                type="button"
                onClick={() => setActiveMobilePanel(destination)}
                className={mobileButtonClassName(isActive)}
                aria-expanded={isActive}
                aria-controls="mobile-controls-drawer"
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-(--app-accent-600)'}`} />
                <span className="max-w-full break-words text-center">{t(labelKey)}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setActiveMobilePanel('more')}
            className={mobileButtonClassName(isDockButtonActive('more'))}
            aria-haspopup="dialog"
            aria-expanded={isDockButtonActive('more')}
            aria-controls="mobile-controls-drawer"
          >
            <Ellipsis className={`h-4 w-4 ${isDockButtonActive('more') ? 'text-white' : 'text-(--app-accent-600)'}`} />
            <span className="max-w-full break-words text-center">{t('quickMore')}</span>
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
                    {mobileDrawerTitle()}
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

              {activeMobilePanel === 'settings' ? <SidebarHeader t={t} balance={billing.balance} /> : null}
              {mobileSections()}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* Desktop sidebar: an opaque column holding the navigation rail and the active panel, flat against the page */}
      <aside className="hidden lg:flex lg:order-1 lg:h-screen shrink-0 bg-(--app-surface-strong) border-r border-[rgba(34,48,52,0.08)] z-10 flex-row">
        <div className="flex w-[72px] shrink-0 flex-col border-r border-[rgba(34,48,52,0.06)] bg-(--app-surface)">
          <RailBrand t={t} />
          <SidebarRail
            t={t}
            activeView={desktopView}
            onViewChange={onDesktopViewChange}
            panelId={DESKTOP_PANEL_ID}
            badges={{ decorations: placedDecorationCount }}
          />
        </div>
        <div className="flex min-w-0 flex-col lg:w-[320px] xl:w-[360px]">
          <div
            id={DESKTOP_PANEL_ID}
            role="tabpanel"
            aria-labelledby={getRailLabelId(desktopView)}
            className="flex min-h-0 flex-1 flex-col"
          >
            {desktopView === 'settings' ? settingsPanel() : renderGroup(desktopView)}
          </div>
        </div>
      </aside>
    </>
  );
}
