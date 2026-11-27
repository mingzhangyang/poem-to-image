import { useRef, type KeyboardEvent } from 'react';
import { Images } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DesktopSidebarView, TranslateFn } from '../../types';
import { Logo } from '../logo';
import { PANEL_GROUP_ORDER, PANEL_GROUPS, SETTINGS_ITEM, type NavigationItem } from './panelGroups';

interface RailItem extends NavigationItem {
  view: DesktopSidebarView;
}

const RAIL_GROUP_ITEMS: readonly RailItem[] = PANEL_GROUP_ORDER.map((view) => ({ view, ...PANEL_GROUPS[view] }));
const RAIL_SETTINGS_ITEM: RailItem = { view: 'settings', ...SETTINGS_ITEM };
const RAIL_VIEWS: readonly DesktopSidebarView[] = [...RAIL_GROUP_ITEMS.map((item) => item.view), 'settings'];

export const getRailTabId = (view: DesktopSidebarView) => `sidebar-rail-tab-${view}`;
/** Id of a tab's visible label, which names the tab panel without the badge. */
export const getRailLabelId = (view: DesktopSidebarView) => `sidebar-rail-label-${view}`;

interface SidebarRailProps {
  t: TranslateFn;
  activeView: DesktopSidebarView;
  onViewChange: (view: DesktopSidebarView) => void;
  /** Id of the tab panel the rail controls. */
  panelId: string;
  /** Optional counts shown as a small badge on a rail item. */
  badges?: Partial<Record<DesktopSidebarView, number>>;
}

/**
 * Vertical tab list on the left edge of the desktop sidebar. Tabs show only
 * an icon, with the label as screen-reader text and a tooltip on hover or
 * keyboard focus. Panels sit at the top and Settings at the bottom; focus
 * follows the roving tab index and arrow keys move and activate in one step.
 */
export function SidebarRail({ t, activeView, onViewChange, panelId, badges }: SidebarRailProps) {
  const tabRefs = useRef(new Map<DesktopSidebarView, HTMLButtonElement>());

  const activate = (view: DesktopSidebarView) => {
    onViewChange(view);
    tabRefs.current.get(view)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, view: DesktopSidebarView) => {
    const index = RAIL_VIEWS.indexOf(view);
    const last = RAIL_VIEWS.length - 1;
    const target = {
      ArrowDown: index === last ? 0 : index + 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    activate(RAIL_VIEWS[target]!);
  };

  const renderItem = ({ view, icon: Icon, labelKey, titleKey }: RailItem, placement = '') => {
    const selected = activeView === view;
    const badge = badges?.[view] ?? 0;
    return (
      <button
        key={view}
        ref={(node) => {
          if (node) tabRefs.current.set(view, node);
          else tabRefs.current.delete(view);
        }}
        type="button"
        role="tab"
        id={getRailTabId(view)}
        aria-selected={selected}
        aria-controls={panelId}
        tabIndex={selected ? 0 : -1}
        onClick={() => onViewChange(view)}
        onKeyDown={(event) => handleKeyDown(event, view)}
        className={`${placement} group relative mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors ${
          selected
            ? 'bg-(--app-accent-700) text-white shadow-[0_10px_22px_var(--app-accent-shadow)]'
            : 'text-(--app-accent-600) hover:bg-[rgba(237,244,243,0.8)]'
        }`}
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
        {badge > 0 ? (
          <span
            aria-hidden="true"
            className={`absolute right-0.5 top-0.5 min-w-4 rounded-full px-1 text-center text-[10px] font-semibold leading-4 ${
              selected ? 'bg-white text-(--app-accent-700)' : 'bg-(--app-accent-600) text-white'
            }`}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
        {/* The short label names the tab and the tab panel; the tooltip shows the full title. */}
        <span id={getRailLabelId(view)} className="sr-only">{t(labelKey)}</span>
        <RailTooltip>{t(titleKey)}</RailTooltip>
      </button>
    );
  };

  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label={t('controlsNavigation')}
      className="flex min-h-0 w-full flex-1 flex-col gap-1.5 px-1 pt-2 pb-2"
    >
      {RAIL_GROUP_ITEMS.map((item) => renderItem(item))}
      {renderItem(RAIL_SETTINGS_ITEM, 'mt-auto')}
    </div>
  );
}

/**
 * Hover and keyboard-focus label for an icon-only rail item. It repeats the
 * item's accessible name, so it is hidden from assistive technology.
 */
function RailTooltip({ children }: { children: string }) {
  return (
    <span
      aria-hidden="true"
      data-rail-tooltip=""
      className="pointer-events-none invisible absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[rgba(24,36,40,0.92)] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-hover:delay-200 group-focus-visible:visible group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}

/**
 * Link to the public gallery at the foot of the desktop rail. It leaves the
 * editor, so it is a link outside the tab list rather than a tab.
 */
export function RailGalleryLink({ t }: { t: TranslateFn }) {
  return (
    <div className="flex shrink-0 justify-center border-t border-[rgba(34,48,52,0.06)] px-1 pt-2 pb-4">
      <Link
        to="/gallery"
        className="group relative flex h-11 w-11 items-center justify-center rounded-2xl text-(--app-accent-600) transition-colors hover:bg-[rgba(237,244,243,0.8)]"
      >
        <Images aria-hidden="true" className="h-5 w-5" />
        <span className="sr-only">{t('publicGallery')}</span>
        <RailTooltip>{t('publicGallery')}</RailTooltip>
      </Link>
    </div>
  );
}

/**
 * App mark at the top of the desktop rail. It sits outside the tab list so
 * arrow-key navigation skips it, and it carries the page's heading: the
 * wordmark is screen-reader text because the rail is too narrow to show it.
 */
export function RailBrand({ t }: { t: TranslateFn }) {
  return (
    <h1 className="flex shrink-0 justify-center pt-4 pb-2" title={t('appTitle')}>
      <span aria-hidden="true">
        <Logo className="h-9 w-9" />
      </span>
      <span className="sr-only">{t('appTitle')}</span>
    </h1>
  );
}
