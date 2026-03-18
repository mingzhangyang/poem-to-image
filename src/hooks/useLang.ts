import { useState, useEffect } from 'react';
import { translations, Language, TranslationKey } from '../translations';

export const LANGUAGE_STORAGE_KEY = 'poem-to-image.language';
export const DEFAULT_LANGUAGE: Language = 'en';

const VALID_LANGUAGES = new Set(Object.keys(translations) as Language[]);

function resolveLocaleToLanguage(locale: string): Language | null {
  const normalized = locale.toLowerCase();

  if (normalized.startsWith('zh')) {
    if (
      normalized.includes('hant') ||
      normalized.includes('-tw') ||
      normalized.includes('-hk') ||
      normalized.includes('-mo')
    ) {
      return 'zh-TW';
    }

    return 'zh-CN';
  }

  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('fr')) return 'fr';
  if (normalized.startsWith('de')) return 'de';
  if (normalized.startsWith('en')) return 'en';

  return null;
}

export function readPreferredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && VALID_LANGUAGES.has(stored as Language)) {
      return stored as Language;
    }
  } catch {
    // ignore
  }

  if (typeof navigator !== 'undefined') {
    const browserLocales = Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];

    for (const locale of browserLocales) {
      const resolved = resolveLocaleToLanguage(locale);
      if (resolved) {
        return resolved;
      }
    }
  }

  return DEFAULT_LANGUAGE;
}

export function useLang() {
  const [language, setLanguage] = useState<Language>(readPreferredLanguage);
  const t = (key: TranslationKey) => translations[language][key];

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY && e.newValue && VALID_LANGUAGES.has(e.newValue as Language)) {
        setLanguage(e.newValue as Language);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { language, t };
}
