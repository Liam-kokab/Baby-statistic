import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import translations from './translations.json';

export type TLanguage = 'en' | 'nb';

const STORAGE_KEY = 'language';
const DEFAULT_LANGUAGE: TLanguage = 'en';

type TTranslations = Record<string, Record<TLanguage, string>>;
const dictionary = translations as TTranslations;

export const getSavedLanguage = (): TLanguage | null => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'nb') return v;
    return null;
  } catch (_e) {
    return null;
  }
};

export const saveLanguage = (language: TLanguage): void => {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch (_e) {
    // ignore
  }
};

const interpolate = (template: string, vars?: Record<string, string | number>): string =>
  vars
    ? Object.entries(vars).reduce((acc, [key, value]) => acc.split(`{${key}}`).join(String(value)), template)
    : template;

const translate = (language: TLanguage, key: string, vars?: Record<string, string | number>): string => {
  const entry = dictionary[key];
  if (!entry) return key;
  const template = entry[language] ?? entry[DEFAULT_LANGUAGE] ?? key;
  return interpolate(template, vars);
};

type TLanguageContextValue = {
  language: TLanguage;
  setLanguage: (language: TLanguage) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<TLanguageContextValue | null>(null);

type TProps = {
  children: ReactNode;
};

export const LanguageProvider = ({ children }: TProps) => {
  const [language, setLanguageState] = useState<TLanguage>(() => getSavedLanguage() ?? DEFAULT_LANGUAGE);

  const setLanguage = useCallback((next: TLanguage): void => {
    saveLanguage(next);
    setLanguageState(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(language, key, vars),
    [language],
  );

  const value = useMemo<TLanguageContextValue>(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useTranslation = (): TLanguageContextValue => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useTranslation must be used within a LanguageProvider');
  return ctx;
};

export const languageToIndex = (l: TLanguage): number => (l === 'en' ? 0 : 1);

export const indexToLanguage = (i: number): TLanguage => (i === 1 ? 'nb' : 'en');

