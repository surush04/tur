import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dictionaries, en, formatTjs, type Lang } from './strings';
import { readStore, writeStore } from './store';

const regions: Record<Lang, Record<string, string>> = {
  en: { SUGHD: 'Sughd', DUSHANBE: 'Dushanbe', DRS: 'Districts under republican subordination', KHATLON: 'Khatlon', GBAO: 'GBAO' },
  ru: { SUGHD: 'Согд', DUSHANBE: 'Душанбе', DRS: 'РРП', KHATLON: 'Хатлон', GBAO: 'ГБАО' },
  tg: { SUGHD: 'Суғд', DUSHANBE: 'Душанбе', DRS: 'НТҶ', KHATLON: 'Хатлон', GBAO: 'ВМКБ' },
};

const categories: Record<Lang, Record<string, string>> = {
  en: { LAKES: 'Lakes', MOUNTAINS: 'Mountains', CITIES: 'Cities', CULTURE: 'Culture', ROAD: 'Road', NATURE: 'Nature' },
  ru: { LAKES: 'Озёра', MOUNTAINS: 'Горы', CITIES: 'Города', CULTURE: 'Культура', ROAD: 'Дорога', NATURE: 'Природа' },
  tg: { LAKES: 'Кӯлҳо', MOUNTAINS: 'Кӯҳҳо', CITIES: 'Шаҳрҳо', CULTURE: 'Фарҳанг', ROAD: 'Роҳ', NATURE: 'Табиат' },
};

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  region: (code: string) => string;
  category: (code: string) => string;
  money: (value: string | number | null | undefined) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('tg');

  useEffect(() => {
    void readStore('rohi_lang').then((saved) => {
      if (saved === 'en' || saved === 'ru' || saved === 'tg') setLangState(saved);
    });
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = (key: string, params?: Record<string, string | number>) => {
      let text = dictionaries[lang][key] ?? en[key] ?? key;
      if (params) {
        for (const [name, param] of Object.entries(params)) text = text.replace(`{{${name}}}`, String(param));
      }
      return text;
    };
    return {
      lang,
      setLang: (next) => {
        setLangState(next);
        void writeStore('rohi_lang', next);
      },
      t,
      region: (code) => regions[lang][code] ?? code,
      category: (code) => categories[lang][code] ?? code,
      money: formatTjs,
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('i18n');
  return value;
}
