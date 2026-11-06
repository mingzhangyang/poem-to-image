import { getTemplateFontForLanguage } from '../fontOptions';
import { normalizePoemLayerStyle } from '../poemStyle';
import type { Language } from '../translations';
import type { EditorTemplateDefinition, EditorTemplateId } from '../types';
import { ALL_EDITOR_TEMPLATES } from './definitions';
import { templateDecorationsOverrides } from './decorations-overrides';
import { templatePoemStyleOverrides } from './poem-style-overrides';
import { templateTypographyOverrides } from './typography-overrides';

export { ALL_EDITOR_TEMPLATES } from './definitions';

// Gallery entries only. Legacy templates remain in ALL_EDITOR_TEMPLATES so
// drafts and saved active-template markers can still be restored.
const CURATED_EDITOR_TEMPLATE_IDS: EditorTemplateId[] = [
  'bluebird-manuscript',
  'blue-meadow-manuscript',
  'blue-butterfly-manuscript',
  'song-floral',
  'blue-green-landscape',
  'art-nouveau',
  'midnight-star-chart',
  'botanical-specimen',
  'indigo-washi',
  'lone-fisherman',
  'milky-way',
  'tower-reaching-stars',
  'chrysanthemum-south-mountain',
  'great-river-east',
  'willow-breeze',
  'grassland-breeze',
  'pine-snow',
  'sunset-afterglow',
  'moonlit-landscape',
  'daffodil-lake',
  'autumn-forked-path',
  'dover-beach',
  'tudor-rose',
  'feathered-hope',
  'midnight-tyger',
  'gothic-rose-window',
  'greek-laurel',
  'old-library',
  'olive-branch',
  'lavender-sprigs',
  'ivy-vines',
  'oak-leaves',
  'scottish-moor',
  'coastal-lighthouse',
  'provence-fields',
  'new-england-autumn',
  'cross-at-dawn',
  'good-shepherd',
  'dove-and-olive',
  'bethlehem-star',
  'vine-and-branches',
  'resurrection-morning',
  'auspicious-clouds',
  'pastoral-homestead',
  'peach-blossom',
  'plum-blossom',
  'orchid-grace',
  'bamboo-brush',
  'chrysanthemum-brush',
  'western-pass',
  'graceful-whitespace',
  'wax-sealed-letter',
  'illuminated-manuscript',
  'modern-minimal',
];

export const editorTemplates: EditorTemplateDefinition[] = CURATED_EDITOR_TEMPLATE_IDS
  .map((id) => ALL_EDITOR_TEMPLATES.find((template) => template.id === id))
  .filter((template): template is EditorTemplateDefinition => template !== undefined);

export function getTemplateDefinition(templateId: EditorTemplateId) {
  return ALL_EDITOR_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

export function resolveTemplateForLanguage(templateId: EditorTemplateId, language: Language) {
  const template = getTemplateDefinition(templateId);

  if (!template) {
    return null;
  }

  const typographyOverride = templateTypographyOverrides[templateId]?.[language];
  const decorationsOverride = templateDecorationsOverrides[templateId]?.[language];
  const poemStyleOverride = templatePoemStyleOverrides[templateId]?.[language];

  return {
    ...template,
    typography: {
      ...template.typography,
      ...typographyOverride,
      fontFamily: getTemplateFontForLanguage(templateId, language),
    },
    // The SVG preview includes a Chinese vertical poem and red seal; Latin
    // variants need the live paper/text/signature preview instead.
    previewImage: templateId === 'graceful-whitespace' && ['en', 'es', 'fr', 'de'].includes(language)
      ? undefined
      : template.previewImage,
    decorations: {
      ...template.decorations,
      ...decorationsOverride,
      stamp: {
        ...template.decorations.stamp,
        ...decorationsOverride?.stamp,
      },
    },
    poemStyle: normalizePoemLayerStyle(poemStyleOverride),
  } satisfies EditorTemplateDefinition;
}
