import { t } from '#lib/i18n.js';

export function load({ params }) {
  const lang = params.lang === 'es' ? 'es' : 'en';
  return { lang, t: t(lang) };
}
