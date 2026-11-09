<script>
  // Static not-found page for nginx (error_page 404 /404.html). English and Spanish together,
  // since nginx can't tell which language the visitor came from.
  import Nav from '#lib/components/Nav.svelte';
  import Footer from '#lib/components/Footer.svelte';
  import { t } from '#lib/i18n.js';
  const en = t('en');
  const es = t('es');
</script>

<svelte:head>
  <title>404 · Free-ORCA</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<Nav lang="en" t={en} altHref="/es" />
<main id="main" class="container err">
  <p class="label">404</p>
  <h1>{en.notFound.title}</h1>
  <p class="muted">{en.notFound.body}</p>
  <p class="muted" lang="es-MX">{es.notFound.title}. {es.notFound.body}</p>
  <p class="actions">
    <a class="btn btn-primary" href="/">Free-ORCA</a>
    <a class="btn btn-ghost" href="/catalog">{en.nav.catalog}</a>
    <a class="btn btn-ghost" href="/es" lang="es-MX">Español</a>
  </p>
</main>
<Footer lang="en" t={en} />

<style>
  .err { padding-top: 96px; padding-bottom: 120px; display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
</style>
