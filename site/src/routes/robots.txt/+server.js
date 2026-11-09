import { SITE } from '#lib/site.js';

export const prerender = true;

export function GET() {
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  });
}
