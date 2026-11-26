import manifest from './manifest.json';
import type { TranslationKey } from '../translations';

export type OrnamentManifestItem = (typeof manifest)[number];

/**
 * Gallery mood filters, in display order, keyed by the manifest's mood value.
 * Every manifest mood must appear here. The "all" filter is not a mood.
 */
export const ORNAMENT_MOODS: Record<string, TranslationKey> = {
  清雅: 'ornamentMoodSerenity',
  春意: 'ornamentMoodSpring',
  秋意: 'ornamentMoodAutumn',
  隐逸: 'ornamentMoodRetreat',
  思乡: 'ornamentMoodHomesickness',
  喜庆: 'ornamentMoodCelebration',
  孤寂: 'ornamentMoodSolitude',
};

/** Gallery sections, in display order, keyed by the manifest's category value. Every manifest category must appear here. */
export const ORNAMENT_CATEGORIES: Record<string, TranslationKey> = {
  花木: 'ornamentCategoryBotanicals',
  山水: 'ornamentCategoryLandscapes',
  禽鸟: 'ornamentCategoryBirds',
  器物: 'ornamentCategoryObjects',
  景舍: 'ornamentCategoryDwellings',
  纹样: 'ornamentCategoryPatterns',
};

const byId = new Map<string, OrnamentManifestItem>(manifest.map(item => [item.id, item]));

/** The ornament's display name for the UI language, or its ID if it is not in the manifest. */
export function getOrnamentName(ornamentId: string, language: string): string {
  const item = byId.get(ornamentId);
  if (!item) return ornamentId;
  return language.startsWith('zh') ? item.name_zh : item.name_en;
}
