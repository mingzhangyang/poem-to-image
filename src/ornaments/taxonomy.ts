import manifest from './manifest.json';

export type OrnamentManifestItem = (typeof manifest)[number];

/** Gallery filters, in display order. Every manifest mood must appear here. */
export const ORNAMENT_MOODS: Record<string, string> = { 全部: 'All', 清雅: 'Serenity', 春意: 'Spring', 秋意: 'Autumn', 隐逸: 'Retreat', 思乡: 'Homesickness', 喜庆: 'Celebration', 孤寂: 'Solitude' };

/** Gallery sections, in display order. Every manifest category must appear here. */
export const ORNAMENT_CATEGORIES: Record<string, string> = { 花木: 'Botanicals', 山水: 'Landscapes', 禽鸟: 'Birds', 器物: 'Objects', 景舍: 'Dwellings', 纹样: 'Patterns' };

const byId = new Map<string, OrnamentManifestItem>(manifest.map(item => [item.id, item]));

/** The ornament's display name for the UI language, or its ID if it is not in the manifest. */
export function getOrnamentName(ornamentId: string, language: string): string {
  const item = byId.get(ornamentId);
  if (!item) return ornamentId;
  return language.startsWith('zh') ? item.name_zh : item.name_en;
}
