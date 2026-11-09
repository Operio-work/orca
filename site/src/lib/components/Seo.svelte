<script>
  import { page } from '$app/state';
  import { SITE, href, basePath } from '#lib/site.js';

  /** @type {{ title: string, description: string, lang: string, ogLocale: string, type?: string }} */
  let { title, description, lang, ogLocale, type = 'website' } = $props();

  const base = $derived(basePath(page.url.pathname));
  const enUrl = $derived(SITE + (href('en', base) === '/' ? '/' : href('en', base)));
  const esUrl = $derived(SITE + href('es', base));
  const canonical = $derived(lang === 'es' ? esUrl : enUrl);
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  <link rel="alternate" hreflang="en" href={enUrl} />
  <link rel="alternate" hreflang="es-MX" href={esUrl} />
  <link rel="alternate" hreflang="x-default" href={enUrl} />
  <meta property="og:type" content={type} />
  <meta property="og:site_name" content="Free-ORCA by Operio" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:locale" content={ogLocale} />
  <meta property="og:image" content="{SITE}/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Free-ORCA by Operio" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content="{SITE}/og.png" />
</svelte:head>
