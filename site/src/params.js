import { defineParams } from '@sveltejs/kit/params';

/** `lang` is the only non-default locale; English lives at the root. */
export const params = defineParams({
  lang: (param) => (param === 'es' ? param : undefined)
});
