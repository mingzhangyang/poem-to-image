import { useState, useEffect } from 'react';
import { translations, Language, TranslationKey } from '../translations';

export const LANGUAGE_STORAGE_KEY = 'poem-to-image.language';

const VALID_LANGUAGES = new Set(Object.keys(translations) as Language[]);

function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && VALID_LANGUAGES.has(stored as Language)) {
      return stored as Language;
    }
  } catch {
    // ignore
  }
  return 'zh-CN';
}

export function useLang() {
  const [language, setLanguage] = useState<Language>(readStoredLanguage);
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
