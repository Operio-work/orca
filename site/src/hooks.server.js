/** Set <html lang> per page: Spanish under /es, English everywhere else. */
export async function handle({ event, resolve }) {
  const p = event.url.pathname;
  const lang = p === '/es' || p.startsWith('/es/') ? 'es-MX' : 'en';
  return resolve(event, { transformPageChunk: ({ html }) => html.replace('%lang%', lang) });
}
