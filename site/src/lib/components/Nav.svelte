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
    here.startsWith('/catalog') ? 'catalog' : here === '/install' ? 'install' : here === '/compare' ? 'compare' : here === '/managed' ? 'managed' : here === '/whats-new' ? 'whats-new' : ''
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

  /** Phone menu (the links row does not fit beside the tools below 720px). */
  let menuOpen = $state(false);
  // Close it when the page changes (client-side navigation keeps this component alive).
  $effect(() => { void here; menuOpen = false; });
  /** @param {KeyboardEvent} e */
  function onKey(e) { if (e.key === 'Escape' && menuOpen) { menuOpen = false; menuBtn?.focus(); } }
  /** @type {HTMLButtonElement | undefined} */
  let menuBtn = $state();
</script>

<svelte:window onkeydown={onKey} />

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
      <li><a href={href(lang, '/whats-new')} aria-current={section === 'whats-new' ? 'page' : undefined}>{t.nav.whatsNew}</a></li>
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
      <button
        type="button"
        class="icon-btn menu-btn"
        bind:this={menuBtn}
        aria-expanded={menuOpen}
        aria-controls="phone-menu"
        aria-label={menuOpen ? t.nav.closeMenu : t.nav.menu}
        onclick={() => (menuOpen = !menuOpen)}
      >
        <Icon name={menuOpen ? 'x' : 'menu'} size={18} />
      </button>
    </div>
  </nav>
  <!-- Phone menu: every page link plus GitHub, under the bar. Hidden until the button opens it. -->
  <div id="phone-menu" class="menu" hidden={!menuOpen}>
    <ul>
      <li><a href={href(lang, '/catalog')} aria-current={section === 'catalog' ? 'page' : undefined}>{t.nav.catalog}</a></li>
      <li><a href={href(lang, '/install')} aria-current={section === 'install' ? 'page' : undefined}>{t.nav.install}</a></li>
      <li><a href={href(lang, '/compare')} aria-current={section === 'compare' ? 'page' : undefined}>{t.nav.compare}</a></li>
      <li><a href={href(lang, '/whats-new')} aria-current={section === 'whats-new' ? 'page' : undefined}>{t.nav.whatsNew}</a></li>
      <li><a href={href(lang, '/managed')} aria-current={section === 'managed' ? 'page' : undefined}>{t.nav.managed}</a></li>
      <li><a class="menu-gh" href={GITHUB_URL}><Icon name="github" size={17} /><span>{t.nav.github}</span></a></li>
    </ul>
  </div>
</header>
{#if menuOpen}
  <!-- Tapping outside the menu closes it; the X button and Escape are the accessible paths. -->
  <div class="scrim" onclick={() => (menuOpen = false)} aria-hidden="true"></div>
{/if}

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

  /* Phone menu: off on desktop, and off without JS (the links row stays then). */
  .menu-btn, .menu, .scrim { display: none; }
  :global(html:not(.js)) .menu-btn { display: none !important; }

  @media (max-width: 720px) {
    .inner { gap: 4px; }
    .by { display: none; }
    .gh { display: none; }
    .tools { gap: 4px; margin-left: auto; }
    .links { display: none; }
    .menu-btn { display: inline-grid; }
    .menu[hidden] { display: none; }
    .menu {
      display: block;
      position: absolute; left: 0; right: 0; top: var(--nav-h);
      padding: 8px 16px 14px;
      background: var(--color-bg);
      border-bottom: 1px solid var(--color-border);
      box-shadow: 0 16px 32px -16px rgba(0, 0, 0, 0.5);
    }
    .menu ul { list-style: none; display: grid; }
    .menu a {
      display: flex; align-items: center; gap: 10px;
      min-height: 48px; padding: 0 12px; border-radius: var(--radius);
      color: var(--text-secondary); text-decoration: none; font-size: 1rem; font-weight: 500;
    }
    .menu a:active { background: var(--nav-hover-bg); }
    .menu a[aria-current='page'] { color: var(--text-primary); font-weight: 600; box-shadow: inset 3px 0 0 var(--color-orange); }
    .menu-gh { border-top: 1px solid var(--color-border); margin-top: 6px; padding-top: 6px; border-radius: 0; }
    .scrim { display: block; position: fixed; inset: var(--nav-h) 0 0 0; z-index: 99; background: rgba(0, 0, 0, 0.35); }
    /* Without JS the row of links comes back, wrapping under the brand. */
    :global(html:not(.js)) .links { display: flex; flex-wrap: wrap; gap: 0; }
    :global(html:not(.js)) .links a { padding: 0 6px; font-size: 0.86rem; }
  }
</style>
