export const locales = ['ja', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ja';

export const isLocale = (value: string | undefined): value is Locale =>
  locales.includes(value as Locale);

export const getLocale = (value: string | undefined): Locale =>
  isLocale(value) ? value : defaultLocale;

export const stripLocalePrefix = (pathname: string) => {
  const stripped = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  return stripped.length > 1 ? stripped.replace(/\/+$/, '') : stripped;
};

export const getLocalizedPath = (pathname: string, locale: Locale) => {
  const basePath = stripLocalePrefix(pathname);

  if (locale === 'en') return basePath === '/' ? '/en/' : `/en${basePath}`;
  return basePath;
};

export const getLocaleUrl = (
  pathname: string,
  locale: Locale,
  origin = 'https://ayana-works.com',
) => new URL(getLocalizedPath(pathname, locale), origin);
