// Reads CHANGELOG.md (bundled at build time) for the list of versions and their dates.
import raw from '../../../CHANGELOG.md?raw';

/** @param {string} text  → [{ version, date }] newest first */
export function parseChangelog(text) {
  /** @type {{ version: string, date: string }[]} */
  const out = [];
  for (const m of text.matchAll(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})\s*$/gm)) out.push({ version: m[1], date: m[2] });
  return out;
}

export const VERSIONS = parseChangelog(raw);
export const LATEST = VERSIONS[0];

/** '2026-11-27' → 'Nov 27, 2026' / '27 nov 2026' @param {string} iso @param {string} lang */
export function formatDate(iso, lang) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}
