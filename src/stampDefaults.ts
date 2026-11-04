import type { Language } from './translations';
import type { EditorTemplateId } from './types';
import { isCjkLanguage } from './fontOptions';

const DEFAULT_STAMP_TEXTS: Record<Language, string> = {
  en: 'Mark',
  'zh-CN': '印记',
  'zh-TW': '印記',
  ja: '印',
  ko: '표식',
  es: 'Marca',
  fr: 'Marque',
  de: 'Zeichen',
};

export function getDefaultStampTextForLanguage(language: Language) {
  return DEFAULT_STAMP_TEXTS[language];
}
/**
 * Other templates retain the existing CJK-only stamp policy. Graceful
 * Whitespace provides an explicitly localized, short seal for every language.
 * App uses this single capability for preview, export and UI controls.
 */
export function isStampSupportedForEditor(language: Language, activeTemplateId: EditorTemplateId | null): boolean {
  return isCjkLanguage(language) || activeTemplateId === 'graceful-whitespace';
}
