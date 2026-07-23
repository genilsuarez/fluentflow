import aboutContent from '../../public/lp-about-content.json';

export type AboutLang = 'es' | 'en';

export type AboutContent = typeof aboutContent;

export function aboutText(
  value: string | Record<AboutLang, string> | undefined,
  lang: AboutLang
): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.es || value.en || '';
}

export function getAboutContent(): AboutContent {
  return aboutContent;
}
