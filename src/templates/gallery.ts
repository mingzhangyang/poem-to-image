import type { EditorTemplateDefinition, EditorTemplateId } from '../types';
import type { TranslationKey } from '../translations';

export interface TemplateGalleryCategory {
  key: TranslationKey;
  ids: readonly EditorTemplateId[];
}

// These are navigation categories, separate from a template's original series.
// Keep every featured template in exactly one category; its id and series stay
// unchanged so existing drafts and the more specific series badges still work.
export const TEMPLATE_GALLERY_CATEGORIES: readonly TemplateGalleryCategory[] = [
  { key: 'templateCategoryChineseScenes', ids: [
    'blue-green-landscape', 'lone-fisherman', 'tower-reaching-stars', 'chrysanthemum-south-mountain',
    'great-river-east', 'willow-breeze', 'grassland-breeze', 'pine-snow', 'sunset-afterglow',
    'moonlit-landscape', 'pastoral-homestead', 'western-pass',
  ] },
  { key: 'templateCategoryBotanical', ids: [
    'song-floral', 'botanical-specimen', 'peach-blossom', 'plum-blossom', 'orchid-grace',
    'bamboo-brush', 'chrysanthemum-brush', 'olive-branch', 'lavender-sprigs', 'ivy-vines',
    'oak-leaves', 'feathered-hope',
  ] },
  { key: 'templateCategoryManuscripts', ids: [
    'bluebird-manuscript', 'blue-meadow-manuscript', 'blue-butterfly-manuscript', 'art-nouveau',
    'indigo-washi', 'auspicious-clouds', 'tudor-rose', 'illuminated-manuscript',
    'wax-sealed-letter', 'gothic-rose-window', 'greek-laurel', 'old-library',
  ] },
  { key: 'templateCategoryWorldLandscapes', ids: [
    'daffodil-lake', 'autumn-forked-path', 'dover-beach', 'scottish-moor',
    'coastal-lighthouse', 'provence-fields', 'new-england-autumn',
  ] },
  { key: 'templateCategoryFaith', ids: [
    'cross-at-dawn', 'good-shepherd', 'dove-and-olive', 'bethlehem-star',
    'vine-and-branches', 'resurrection-morning',
  ] },
  { key: 'templateCategoryNight', ids: ['midnight-star-chart', 'milky-way', 'midnight-tyger'] },
  { key: 'templateCategoryMinimal', ids: ['graceful-whitespace', 'modern-minimal'] },
];

export interface TemplateGalleryGroup {
  key: TranslationKey;
  items: EditorTemplateDefinition[];
}

export function groupGalleryTemplates(templates: readonly EditorTemplateDefinition[]): TemplateGalleryGroup[] {
  const byId = new Map(templates.map((template) => [template.id, template]));
  const assigned = new Set<EditorTemplateId>();
  const groups = TEMPLATE_GALLERY_CATEGORIES.map(({ key, ids }) => {
    const items = ids.flatMap((id) => {
      const template = byId.get(id);
      if (!template || assigned.has(id)) return [];
      assigned.add(id);
      return [template];
    });
    return { key, items };
  }).filter((group) => group.items.length > 0);

  // An unclassified future template remains discoverable until it is curated.
  const remaining = templates.filter(({ id }) => !assigned.has(id));
  if (remaining.length) groups.push({ key: 'templateCategoryOther', items: remaining });
  return groups;
}

export function matchesGallerySearch(query: string, fields: readonly string[]): boolean {
  const terms = query.normalize('NFKC').toLowerCase().trim().split(/\s+/u).filter(Boolean);
  const haystack = fields.join(' ').normalize('NFKC').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
