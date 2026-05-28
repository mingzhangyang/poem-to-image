import { getTemplateFontForLanguage } from '../fontOptions';
import { normalizePoemLayerStyle } from '../poemStyle';
import type { Language } from '../translations';
import type { EditorTemplateDefinition, EditorTemplateId } from '../types';
import { ALL_EDITOR_TEMPLATES } from './definitions';
import { templateDecorationsOverrides } from './decorations-overrides';
import { templatePoemStyleOverrides } from './poem-style-overrides';
import { templateTypographyOverrides } from './typography-overrides';

export { ALL_EDITOR_TEMPLATES } from './definitions';

const CURATED_EDITOR_TEMPLATE_IDS: EditorTemplateId[] = [
  'parchment-scroll',
  'wax-sealed-letter',
  'illuminated-manuscript',
  'bamboo-scroll',
  'modern-minimal',
  'japanese-magazine',
  'colorblock-cyan-magenta',
  'cyberpunk',
  'mountain-mist-photo',
  'ocean-dawn-photo',
  'city-night-photo',
  'ink-pine-mist-photo',
];

export const editorTemplates: EditorTemplateDefinition[] = CURATED_EDITOR_TEMPLATE_IDS
  .map((id) => ALL_EDITOR_TEMPLATES.find((template) => template.id === id))
  .filter((template): template is EditorTemplateDefinition => template !== undefined);

export function getTemplateDefinition(templateId: EditorTemplateId) {
  return editorTemplates.find((template) => template.id === templateId) ?? null;
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
