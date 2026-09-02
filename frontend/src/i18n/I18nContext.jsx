import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import en from './locales/en';
import hi from './locales/hi';
import mr from './locales/mr';
import gu from './locales/gu';
import ta from './locales/ta';
import te from './locales/te';
import bn from './locales/bn';
import kn from './locales/kn';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
];

const TRANSLATIONS = {
  en,
  hi,
  mr,
  gu,
  ta,
  te,
  bn,
  kn,
};

const STORAGE_KEY = 'gc_language';

const I18nContext = createContext({
  language: 'en',
  changeLanguage: () => {},
  t: (key) => key,
  supportedLanguages: SUPPORTED_LANGUAGES,
  currentLanguageInfo: SUPPORTED_LANGUAGES[0],
});

/**
 * Safely lookup nested property key in object (e.g. 'nav.tabRoutes')
 */
function getNestedValue(obj, keyPath) {
  if (!obj || typeof obj !== 'object') return undefined;
  const keys = keyPath.split('.');
  let current = obj;
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return undefined;
    }
  }
  return current;
}

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && TRANSLATIONS[saved]) {
        return saved;
      }
    } catch (e) {
      console.warn('Unable to read language preference from localStorage:', e);
    }
    return 'en';
  });

  const changeLanguage = useCallback((newLang) => {
    if (TRANSLATIONS[newLang]) {
      setLanguage(newLang);
      try {
        localStorage.setItem(STORAGE_KEY, newLang);
      } catch (e) {
        console.warn('Unable to save language preference to localStorage:', e);
      }
      // Set document language attribute for accessibility
      document.documentElement.lang = newLang;
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  /**
   * Translation function with fallback to English and variable interpolation
   */
  const t = useCallback((key, params) => {
    if (!key) return '';

    // 1. Try active language
    let text = getNestedValue(TRANSLATIONS[language], key);

    // 2. Fallback to English if not found
    if (text === undefined || text === null) {
      text = getNestedValue(TRANSLATIONS.en, key);
    }

    // 3. If still not found, return key
    if (text === undefined || text === null) {
      return key;
    }

    if (typeof text !== 'string') {
      return text;
    }

    // 4. Interpolate variables e.g. {count}, {name}
    if (params && typeof params === 'object') {
      Object.keys(params).forEach((paramKey) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), params[paramKey]);
      });
    }

    return text;
  }, [language]);

  const currentLanguageInfo = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const contextValue = {
    language,
    changeLanguage,
    t,
    supportedLanguages: SUPPORTED_LANGUAGES,
    currentLanguageInfo,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}

export default I18nContext;
