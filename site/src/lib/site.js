// Site-wide constants and helpers shared by every page.
export const SITE = 'https://make.operio.work';
export const INSTALL_CMD = 'curl -fsSL https://make.operio.work/install.sh | bash';
export const TALK_URL = 'https://talk.operio.work';
export const GITHUB_URL = 'https://github.com/operio-work/free-orca';
export const HERDR_URL = 'https://github.com/herdrdev/herdr';
export const LANGS = /** @type {const} */ (['en', 'es']);

/** @param {string} lang */
export const partnersUrl = (lang) =>
  lang === 'es' ? 'https://operio.work/es/partners' : 'https://operio.work/partners';

/**
 * Path for a page in a language. English has no prefix, Spanish lives under /es.
 * Paths never end in a slash (trailingSlash 'never', files are <path>.html).
 * @param {string} lang
 * @param {string} path  '/' or '/catalog' etc.
 */
export function href(lang, path = '/') {
  const p = path === '/' ? '' : path;
  if (lang === 'es') return '/es' + p;
  return p || '/';
}

/**
 * Strip the language prefix from a pathname: '/es/catalog' → '/catalog'.
 * @param {string} pathname
 */
export function basePath(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/es') return '/';
  if (p.startsWith('/es/')) return p.slice(3);
  return p;
}
