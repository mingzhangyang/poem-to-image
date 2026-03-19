import en from './i18n/locales/en';
import type { TranslationMessages } from './i18n/types';

export const LANGUAGES = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de'] as const;

export type Language = (typeof LANGUAGES)[number];
export type TranslationKey = keyof TranslationMessages;

export const fallbackTranslations: TranslationMessages = en;

const localeLoaders: Record<Language, () => Promise<{ default: TranslationMessages }>> = {
  en: async () => ({ default: en }),
  'zh-CN': () => import('./i18n/locales/zh-CN'),
  'zh-TW': () => import('./i18n/locales/zh-TW'),
  ja: () => import('./i18n/locales/ja'),
  ko: () => import('./i18n/locales/ko'),
  es: () => import('./i18n/locales/es'),
  fr: () => import('./i18n/locales/fr'),
  de: () => import('./i18n/locales/de'),
};

const localeCache = new Map<Language, TranslationMessages>([['en', en]]);

export function isValidLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

export async function loadTranslations(language: Language): Promise<TranslationMessages> {
  const cached = localeCache.get(language);

  if (cached) {
    return cached;
  }

  try {
    const mod = await localeLoaders[language]();
    localeCache.set(language, mod.default);
    return mod.default;
  } catch {
    return en;
  }
}
