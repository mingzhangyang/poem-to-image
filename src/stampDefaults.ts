import type { Language } from './translations';

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