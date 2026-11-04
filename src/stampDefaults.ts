import type { Language } from './translations';
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
/** Seals are intentionally reserved for CJK scripts; Latin layouts use signatures. */
export function isStampSupportedForEditor(language: Language): boolean {
  return isCjkLanguage(language);
}
