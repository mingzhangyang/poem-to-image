import { useCallback, useEffect, useRef, useState } from 'react';
import { fallbackTranslations, loadTranslations, type Language, type TranslationKey } from '../translations';
import { LANGUAGE_STORAGE_KEY, readPreferredLanguage } from './useLang';

export function useAppLanguage() {
  const initialLanguageRef = useRef<Language>(readPreferredLanguage());
  const [language, setLanguage] = useState<Language>(initialLanguageRef.current);
  const [messages, setMessages] = useState(fallbackTranslations);

  const t = useCallback(
    (key: TranslationKey): string => messages[key] ?? fallbackTranslations[key],
    [messages],
  );

  useEffect(() => {
    let ignore = false;
    void loadTranslations(language).then((nextMessages) => {
      if (!ignore) setMessages(nextMessages);
    });
    return () => {
      ignore = true;
    };
  }, [language]);

  const changeLanguage = useCallback((newLang: Language) => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    } catch {
      /* ignore */
    }
    setLanguage(newLang);
  }, []);

  return { language, initialLanguageRef, t, changeLanguage };
}
