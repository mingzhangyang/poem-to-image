import type { Language } from './translations';
import type { StampConfig } from './types';
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
 * CJK seals are always supported. Other languages require an explicit opt-in
 * stored on the stamp itself, rather than an ephemeral built-in template ID:
 * custom-template saves, drafts and undo/redo already retain StampConfig.
 */
export function isStampSupportedForEditor(
  language: Language,
  stamp: Pick<StampConfig, 'allowNonCjk'>,
): boolean {
  return isCjkLanguage(language) || stamp.allowNonCjk === true;
}
