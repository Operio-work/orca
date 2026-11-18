// The routine catalog. catalog/catalog.json in the ORCA repo is the single source:
// every name, problem, outcome and step on the site is read from it at build time.
import catalog from '../../../catalog/catalog.json';

// The free packs' own routine.json files, only to show which desk folder each one reads.
const packs = import.meta.glob('../../../routines/*/routine.json', { eager: true, import: 'default' });

/** @typedef {{ en: string, es: string }} L10n */
/**
 * @typedef {object} Entry
 * @property {string} id
 * @property {'free'|'managed'} tier
 * @property {string[]} verticals
 * @property {L10n} name
 * @property {L10n} problem
 * @property {L10n} outcome
 * @property {{ en: string[], es: string[] }} how
 * @property {{ kind: string, summary: L10n }} trigger
 * @property {L10n} approval
 * @property {string[]} tools
 * @property {L10n} [upgrade]
 * @property {string} [pack]
 */

/** @type {Entry[]} */
export const entries = catalog.entries;
export const cta = catalog.cta;
export const freeEntries = entries.filter((e) => e.tier === 'free');
export const managedEntries = entries.filter((e) => e.tier === 'managed');

/** Verticals in display order; 'any' first. */
export const VERTICALS = ['any', 'restaurant', 'clinic', 'real-estate', 'tourism', 'retail', 'services'];

/** @param {string} id */
export const getEntry = (id) => entries.find((e) => e.id === id);

/**
 * Folders under ~/orca-desk/ that a free pack reads, taken from its routine.json prompt.
 * @param {string | undefined} pack
 * @returns {string[]}
 */
export function deskFolders(pack) {
  if (!pack) return [];
  const key = Object.keys(packs).find((k) => k.endsWith(`/routines/${pack}/routine.json`));
  if (!key) return [];
  const prompt = String(/** @type {any} */ (packs[key]).prompt || '');
  // A name followed by "." is a file (business.txt), not a folder.
  const found = [...prompt.matchAll(/~\/orca-desk\/[a-z0-9-]+(?![a-z0-9-]|\.[a-z])/g)].map((m) => m[0] + '/');
  // Keep top-level inputs only (skip "…/replied", "…/thanked" archives).
  return [...new Set(found)].filter((f) => f.split('/').length === 4);
}

/**
 * Files directly under ~/orca-desk/ that a free pack reads (e.g. ~/orca-desk/business.txt).
 * @param {string | undefined} pack
 * @returns {string[]}
 */
export function deskFiles(pack) {
  const r = packRoutine(pack);
  if (!r) return [];
  const prompt = String(r.prompt || '');
  return [...new Set([...prompt.matchAll(/~\/orca-desk\/[a-z0-9-]+\.[a-z]+/g)].map((m) => m[0]))];
}

/**
 * True when a free pack asks for the agents' web browser (routine.json "tools").
 * @param {string | undefined} pack
 */
export function usesBrowser(pack) {
  const r = packRoutine(pack);
  return Array.isArray(r?.tools) && r.tools.includes('web-browser');
}

/** @param {string | undefined} pack */
function packRoutine(pack) {
  if (!pack) return null;
  const key = Object.keys(packs).find((k) => k.endsWith(`/routines/${pack}/routine.json`));
  return key ? /** @type {any} */ (packs[key]) : null;
}

/**
 * Up to `n` other routines that share a vertical, free ones first for a free page.
 * @param {Entry} entry
 * @param {number} n
 */
export function related(entry, n = 3) {
  const specific = entry.verticals.filter((v) => v !== 'any');
  const score = (/** @type {Entry} */ e) =>
    (e.tier === entry.tier ? 2 : 0) + e.verticals.filter((v) => specific.includes(v)).length * 3 +
    (e.verticals.includes('any') ? 1 : 0);
  return entries
    .filter((e) => e.id !== entry.id)
    .map((e, i) => ({ e, s: score(e), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, n)
    .map((x) => x.e);
}

/**
 * 'draft' when a free pack's result waits for approval, 'report' otherwise (from routine.json).
 * @param {string | undefined} pack
 */
export function packOutput(pack) {
  const key = Object.keys(packs).find((k) => k.endsWith(`/routines/${pack}/routine.json`));
  return key && /** @type {any} */ (packs[key]).approval === 'draft' ? 'draft' : 'report';
}
