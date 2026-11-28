import { Download, LayoutTemplate, Maximize, Palette, Settings, Sparkles, Stamp, Type, type LucideIcon } from 'lucide-react';
import type { TranslationKey } from '../../translations';
import type { SidebarPanel } from '../../types';

export interface NavigationItem {
  icon: LucideIcon;
  /** Short label: the mobile dock and More menu show it; on the icon-only desktop rail it is the tab's accessible name. */
  labelKey: TranslationKey;
  /** Full title: the panel heading, the mobile drawer title and the desktop rail tooltip. */
  titleKey: TranslationKey;
}

/**
 * Control panels, one per desktop rail tab and mobile destination. The
 * desktop rail and the mobile dock and More menu are all built from this
 * definition; Sidebar.tsx maps each id to its panel component.
 */
export const PANEL_GROUPS: Record<SidebarPanel, NavigationItem> = {
  templates: { icon: Sparkles, labelKey: 'templatesShort', titleKey: 'templates' },
  canvasSize: { icon: Maximize, labelKey: 'canvasSizeShort', titleKey: 'canvasSize' },
  content: { icon: Type, labelKey: 'content', titleKey: 'content' },
  typography: { icon: LayoutTemplate, labelKey: 'typography', titleKey: 'typography' },
  background: { icon: Palette, labelKey: 'background', titleKey: 'background' },
  decorations: { icon: Stamp, labelKey: 'decorationsShort', titleKey: 'decorations' },
};

/** Panel order on the desktop rail and in the mobile destination list. */
export const PANEL_GROUP_ORDER: readonly SidebarPanel[] = [
  'templates', 'canvasSize', 'content', 'typography', 'background', 'decorations',
];

/** Panel shown on a first visit. */
export const DEFAULT_PANEL_GROUP: SidebarPanel = 'content';

export const SETTINGS_ITEM: NavigationItem = { icon: Settings, labelKey: 'settings', titleKey: 'settings' };
export const EXPORT_ITEM: NavigationItem = { icon: Download, labelKey: 'quickExport', titleKey: 'exportAndShare' };

export function isPanelGroup(value: unknown): value is SidebarPanel {
  return typeof value === 'string' && Object.hasOwn(PANEL_GROUPS, value);
}
