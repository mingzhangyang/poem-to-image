import { useRef, type KeyboardEvent } from 'react';
import type { DesktopSidebarView, TranslateFn } from '../../types';
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
 * Vertical tab list on the left edge of the desktop sidebar. Panels sit at
 * the top and Settings at the bottom; focus follows the roving tab index and
 * arrow keys move and activate in one step.
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
        title={labelKey === titleKey ? undefined : t(titleKey)}
        onClick={() => onViewChange(view)}
        onKeyDown={(event) => handleKeyDown(event, view)}
        className={`${placement} flex w-full flex-col items-center justify-center gap-1 rounded-2xl px-0 py-2.5 text-[10px] font-medium leading-tight tracking-tight transition-colors ${
          selected
            ? 'bg-(--app-accent-700) text-white shadow-[0_10px_22px_var(--app-accent-shadow)]'
            : 'text-(--app-accent-800) hover:bg-[rgba(237,244,243,0.8)]'
        }`}
      >
        <span className="relative">
          <Icon aria-hidden="true" className={`h-[18px] w-[18px] ${selected ? 'text-white' : 'text-(--app-accent-600)'}`} />
          {badge > 0 ? (
            <span
              aria-hidden="true"
              className={`absolute -right-2.5 -top-2 min-w-4 rounded-full px-1 text-center text-[10px] font-semibold leading-4 ${
                selected ? 'bg-white text-(--app-accent-700)' : 'bg-(--app-accent-600) text-white'
              }`}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </span>
        <span id={getRailLabelId(view)} className="w-full break-words text-center">{t(labelKey)}</span>
      </button>
    );
  };

  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label={t('controlsNavigation')}
      className="flex h-full w-full flex-col gap-1.5 px-1 py-4"
    >
      {RAIL_GROUP_ITEMS.map((item) => renderItem(item))}
      {renderItem(RAIL_SETTINGS_ITEM, 'mt-auto')}
    </div>
  );
}
