import type { APIRoute } from 'astro';
import { getCaseStudies } from '../data/site';
import { getLocaleUrl, type Locale } from '../i18n/locale';

export const prerender = true;

const locales = ['ja', 'en'] satisfies Locale[];
const paths = [
  '/',
  ...getCaseStudies('ja').map((caseStudy) => caseStudy.href),
];

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const alternateLinks = (pathname: string) => {
  const japaneseUrl = escapeXml(getLocaleUrl(pathname, 'ja').toString());
  const englishUrl = escapeXml(getLocaleUrl(pathname, 'en').toString());

  return [
    `<xhtml:link rel="alternate" hreflang="ja" href="${japaneseUrl}" />`,
    `<xhtml:link rel="alternate" hreflang="en" href="${englishUrl}" />`,
    `<xhtml:link rel="alternate" hreflang="x-default" href="${japaneseUrl}" />`,
  ].join('');
};

const urls = paths.flatMap((pathname) =>
  locales.map((locale) => {
    const url = escapeXml(getLocaleUrl(pathname, locale).toString());
    return `<url><loc>${url}</loc>${alternateLinks(pathname)}</url>`;
  }),
);

export const GET: APIRoute = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
    },
  );
