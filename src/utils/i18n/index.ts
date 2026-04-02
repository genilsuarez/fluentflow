import type { Language } from '../../types';
import { en } from './en';
import { es } from './es';

const translations = { en, es } as const;

// Type-safe translation keys based on the JSON structure
type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

type TranslationKeys = NestedKeyOf<typeof translations.en>;

export const useTranslation = (language: Language) => {
  const t = (
    key: TranslationKeys | string,
    defaultValue?: string,
    interpolation?: Record<string, string | number>
  ): string => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      value = value?.[k];
    }

    let result: string;
    if (typeof value === 'string') {
      result = value;
    } else if (defaultValue) {
      result = defaultValue;
    } else {
      result = key;
    }

    if (interpolation && typeof result === 'string') {
      Object.entries(interpolation).forEach(([placeholder, replacement]) => {
        result = result.replace(new RegExp(`{{${placeholder}}}`, 'g'), String(replacement));
      });
    }

    return result;
  };

  const tn = (namespace: string, key: string, defaultValue?: string) => {
    return t(`${namespace}.${key}` as TranslationKeys, defaultValue);
  };

  const tc = (key: string, count: number, defaultValue?: string) => {
    const pluralKey = count === 1 ? key : `${key}_plural`;
    return t(pluralKey as TranslationKeys, defaultValue, { count });
  };

  return {
    t,
    tn,
    tc,
    language,
    exists: (key: string) => {
      const keys = key.split('.');
      let value: any = translations[language];
      for (const k of keys) {
        value = value?.[k];
      }
      return value !== undefined;
    },
  };
};
