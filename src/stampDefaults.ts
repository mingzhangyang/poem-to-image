import type { Language } from './translations';
import { isCjkLanguage } from './fontOptions';

// A Chinese seal uses Han characters, not a translated label.
const DEFAULT_STAMP_TEXTS: Record<Language, string> = {
  en: '印',
  'zh-CN': '印',
  'zh-TW': '印',
  ja: '印',
  ko: '印',
  es: '印',
  fr: '印',
  de: '印',
};

export function getDefaultStampTextForLanguage(language: Language) {
  return DEFAULT_STAMP_TEXTS[language];
}
/** Seals are intentionally reserved for CJK scripts; Latin layouts use signatures. */
export function isStampSupportedForEditor(language: Language): boolean {
  return isCjkLanguage(language);
}
