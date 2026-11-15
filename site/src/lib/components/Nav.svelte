<script>
  import { page } from '$app/state';
  import Icon from './Icon.svelte';
  import OperioLogo from './OperioLogo.svelte';
  import { href, basePath, GITHUB_URL } from '#lib/site.js';

  /** @type {{ lang: string, t: any, altHref?: string }} */
  let { lang, t, altHref } = $props();

  const other = $derived(lang === 'es' ? 'en' : 'es');
  const here = $derived(basePath(page.url.pathname));
  const section = $derived(
    here.startsWith('/catalog') ? 'catalog' : here === '/install' ? 'install' : here === '/compare' ? 'compare' : here === '/managed' ? 'managed' : ''
  );

  let scrolled = $state(false);
  /** Current effective theme, known only after mount. */
  let dark = $state(false);

  $effect(() => {
    const onScroll = () => (scrolled = window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const set = document.documentElement.dataset.theme;
    dark = set ? set === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    return () => window.removeEventListener('scroll', onScroll);
  });

  function toggleTheme() {
    dark = !dark;
    const next = dark ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('operio-orca-theme', next); } catch { /* private mode */ }
  }
</script>

<a class="skip" href="#main">{t.skip}</a>
<header class="nav" class:scrolled>
  <nav class="container inner" aria-label="Main">
    <div class="brand-row">
      <a class="brand" href={href(lang, '/')} aria-label={t.nav.home}>
        <img src="/favicon.svg" alt="" width="30" height="30" />
        <span class="wordmark">ORCA</span>
      </a>
      <span class="by"><span class="by-word">{t.by}</span><OperioLogo height={20} /></span>
    </div>
    <ul class="links">
      <li><a href={href(lang, '/catalog')} aria-current={section === 'catalog' ? 'page' : undefined}>{t.nav.catalog}</a></li>
      <li><a href={href(lang, '/install')} aria-current={section === 'install' ? 'page' : undefined}>{t.nav.install}</a></li>
      <li><a href={href(lang, '/compare')} aria-current={section === 'compare' ? 'page' : undefined}>{t.nav.compare}</a></li>
      <li class="nav-managed"><a href={href(lang, '/managed')} aria-current={section === 'managed' ? 'page' : undefined}>{t.nav.managed}</a></li>
    </ul>
    <div class="tools">
      <a class="lang" href={altHref ?? href(other, here)} hreflang={other === 'es' ? 'es-MX' : 'en'} lang={other === 'es' ? 'es-MX' : 'en'} aria-label={t.langSwitch.aria}>
        {t.langSwitch.short}
      </a>
      <button type="button" class="icon-btn theme" onclick={toggleTheme} aria-label={dark ? t.theme.toLight : t.theme.toDark}>
        <span class="sun"><Icon name="sun" size={17} /></span>
        <span class="moon"><Icon name="moon" size={17} /></span>
      </button>
      <a class="icon-btn gh" href={GITHUB_URL} aria-label={t.nav.github}><Icon name="github" size={17} /></a>
    </div>
  </nav>
</header>

<style>
  .skip {
    position: fixed; top: 0; left: 0; z-index: 200;
    transform: translateY(-120%);
    padding: 12px 20px; border-radius: 0 0 8px 0;
    background: var(--color-orange); color: var(--on-orange);
    font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700;
    text-decoration: none;
    transition: transform 0.15s var(--ease-out);
  }
  .skip:focus { transform: translateY(0); outline: 2px solid var(--text-primary); outline-offset: 2px; }

  .nav {
    position: sticky; top: 0; z-index: 100;
    height: var(--nav-h);
    border-bottom: 1px solid transparent;
    transition: background-color 0.25s ease, border-color 0.25s ease;
  }
  .nav.scrolled {
    background: var(--nav-scrolled-bg);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border-color: var(--color-border);
  }
  .inner { display: flex; align-items: center; height: var(--nav-h); gap: 24px; }

  .brand-row { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
  .brand img { border-radius: 7px; }
  .wordmark { font-family: var(--font-mono); font-weight: 700; font-size: 1.05rem; letter-spacing: 0.01em; }
  /* "by" + the Operio logo: a quiet signature next to the product name, not a second brand. */
  .by { display: inline-flex; align-items: center; gap: 6px; }
  .by-word { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-tertiary); }

  .links { display: flex; list-style: none; gap: 4px; flex: 1; }
  .links a {
    display: inline-flex; align-items: center; min-height: 40px;
    padding: 0 12px; border-radius: var(--radius);
    color: var(--text-secondary); text-decoration: none; font-size: 0.9rem; font-weight: 500;
    transition: color var(--dur-fast) ease, background-color var(--dur-fast) ease;
  }
  .links a:hover { color: var(--text-primary); background: var(--nav-hover-bg); }
  .links a[aria-current='page'] { color: var(--text-primary); font-weight: 600; box-shadow: inset 0 -2px 0 var(--color-orange); border-radius: var(--radius) var(--radius) 0 0; }

  .tools { display: flex; align-items: center; gap: 6px; }
  .lang, .icon-btn {
    display: inline-grid; place-items: center;
    min-width: 40px; height: 40px; padding: 0 10px;
    border-radius: var(--radius);
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--text-secondary);
    text-decoration: none; cursor: pointer;
    transition: color var(--dur-fast) ease, border-color var(--dur-fast) ease, background-color var(--dur-fast) ease, transform 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  .icon-btn { padding: 0; width: 40px; }
  .lang { font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.08em; }
  .lang:active, .icon-btn:active { transform: scale(0.95); }
  @media (hover: hover) and (pointer: fine) {
    .lang:hover, .icon-btn:hover { color: var(--color-orange-ink); border-color: var(--color-orange-dim); background: var(--tint-orange); }
  }

  /* Show the icon for the theme you would switch to. Works before hydration via CSS. */
  .theme { position: relative; }
  .theme span { grid-area: 1 / 1; display: grid; transition: opacity 0.2s ease, transform 0.3s var(--ease-out); }
  .sun { opacity: 0; transform: rotate(-45deg) scale(0.7); }
  :global([data-theme='dark']) .sun { opacity: 1; transform: none; }
  :global([data-theme='dark']) .moon { opacity: 0; transform: rotate(45deg) scale(0.7); }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .sun { opacity: 1; transform: none; }
    :global(:root:not([data-theme='light'])) .moon { opacity: 0; transform: rotate(45deg) scale(0.7); }
  }
  :global(html:not(.js)) .theme { display: none; }

  @media (max-width: 720px) {
    .inner { gap: 4px; }
    .by { display: none; }
    .gh { display: none; }
    .tools { gap: 4px; }
    .links { gap: 0; justify-content: flex-end; }
    /* "Catálogo / Instalar / Comparar" plus two 40px tools must fit 390px with the 16px gutters. */
    .links a { padding: 0 6px; font-size: 0.86rem; }
  }
  @media (max-width: 520px) {
    /* "Gestionado" does not fit beside the other three on a phone; the home page (twice) and the
       footer still link to /managed there. */
    .nav-managed { display: none; }
  }
  @media (max-width: 440px) {
    /* Three links need the room: the logo alone carries the brand on phones. */
    .wordmark { display: none; }
    .links a { padding: 0 5px; font-size: 0.84rem; }
  }
</style>
