import { entries } from '#lib/catalog.js';
import { SITE, href } from '#lib/site.js';

export const prerender = true;

const PAGES = ['/', '/catalog', '/install', '/compare', '/managed', '/buddy', ...entries.map((e) => `/catalog/${e.id}`)];

/** @param {string} lang @param {string} p */
const abs = (lang, p) => SITE + href(lang, p);

export function GET() {
  const urls = PAGES.flatMap((p) =>
    ['en', 'es'].map(
      (lang) => `  <url>
    <loc>${abs(lang, p)}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${abs('en', p)}"/>
    <xhtml:link rel="alternate" hreflang="es-MX" href="${abs('es', p)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${abs('en', p)}"/>
  </url>`
    )
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
