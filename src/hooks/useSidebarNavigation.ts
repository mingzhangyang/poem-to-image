import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PANEL_GROUP, isPanelGroup } from '../components/sidebar/panelGroups';
import type { DesktopSidebarView, SidebarPanel } from '../types';

export const SIDEBAR_GROUP_STORAGE_KEY = 'poem-to-image.sidebar-group';

function readStoredPanel(): SidebarPanel {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_GROUP_STORAGE_KEY);
    return isPanelGroup(stored) ? stored : DEFAULT_PANEL_GROUP;
  } catch {
    return DEFAULT_PANEL_GROUP;
  }
}

/**
 * The panel shown next to the desktop navigation rail, remembered across
 * visits. `showPanel` is for code that reveals a panel on the user's behalf
 * (after applying a template, adding a layer, selecting an ornament on the
 * canvas); it also leaves Settings. The mobile dock keeps its own state and
 * never opens a drawer on its own.
 */
export function useSidebarNavigation() {
  const [desktopView, setDesktopView] = useState<DesktopSidebarView>(readStoredPanel);

  useEffect(() => {
    // Settings is a transient view; reloads return to the last panel.
    if (!isPanelGroup(desktopView)) return;
    try {
      window.localStorage.setItem(SIDEBAR_GROUP_STORAGE_KEY, desktopView);
    } catch {
      // Storage may be unavailable (private mode, blocked site data).
    }
  }, [desktopView]);

  const showPanel = useCallback((panel: SidebarPanel) => setDesktopView(panel), []);

  return { desktopView, setDesktopView, showPanel };
}

export type ShowPanel = ReturnType<typeof useSidebarNavigation>['showPanel'];
