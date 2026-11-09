import { error } from '@sveltejs/kit';
import { entries as catalogEntries, getEntry } from '#lib/catalog.js';

/** Prerender every routine in both languages (the catalog pages link them too). */
export function entries() {
  return catalogEntries.flatMap(({ id }) => [{ id }, { lang: 'es', id }]);
}

export function load({ params }) {
  const entry = getEntry(params.id);
  if (!entry) error(404, 'Not found');
  return { entry };
}
