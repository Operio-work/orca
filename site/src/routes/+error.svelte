<script>
  import { page } from '$app/state';
  import { t as tr } from '#lib/i18n.js';
  import { href } from '#lib/site.js';
  const lang = $derived(page.url.pathname.startsWith('/es') ? 'es' : 'en');
  const t = $derived(tr(lang));
</script>

<svelte:head><title>{page.status} · Free-ORCA</title></svelte:head>
<main class="container err">
  <p class="label">{page.status}</p>
  <h1>{t.notFound.title}</h1>
  <p class="muted">{t.notFound.body}</p>
  <p class="actions">
    <a class="btn btn-primary" href={href(lang, '/')}>Free-ORCA</a>
    <a class="btn btn-ghost" href={href(lang, '/catalog')}>{t.nav.catalog}</a>
  </p>
</main>

<style>
  .err { padding-top: 120px; padding-bottom: 120px; display: flex; flex-direction: column; gap: 16px; align-items: flex-start; }
  .actions { display: flex; gap: 12px; margin-top: 8px; }
</style>
