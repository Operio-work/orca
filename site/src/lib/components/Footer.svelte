<script>
  import { href, GITHUB_URL, HERDR_URL, TALK_URL, partnersUrl } from '#lib/site.js';

  /** @type {{ lang: string, t: any }} */
  let { lang, t } = $props();
</script>

<footer class="footer">
  <div class="container upper">
    <div class="brand">
      <a class="mark" href={href(lang, '/')}>
        <img src="/favicon.svg" alt="" width="36" height="36" />
        <span class="wordmark">Free-ORCA</span>
      </a>
      <p class="tagline">{t.footer.tagline}</p>
    </div>
    <div class="cols">
      <div class="col">
        <h2 class="label">{t.footer.product}</h2>
        <a href={href(lang, '/catalog')}>{t.nav.catalog}</a>
        <a href={href(lang, '/install')}>{t.nav.install}</a>
        <a href={GITHUB_URL}>{t.footer.github}</a>
      </div>
      <div class="col">
        <h2 class="label">{t.footer.operio}</h2>
        <a href={TALK_URL}>{t.footer.talk}</a>
        <a href={partnersUrl(lang)}>{t.footer.partners}</a>
        <a href={lang === 'es' ? 'https://operio.work/es' : 'https://operio.work'}>{t.footer.website}</a>
      </div>
    </div>
  </div>
  <div class="container"><div class="lower">
    <p>© 2026 Operio · <a href={GITHUB_URL + '/blob/main/LICENSE'}>{t.footer.license}</a></p>
    <p>{t.footer.runsOn} <a href={HERDR_URL}>herdr</a> {t.footer.runsOnLicense}</p>
  </div></div>
</footer>

<style>
  .footer { border-top: 1px solid var(--color-border); background: var(--color-surface); }
  .upper { display: flex; justify-content: space-between; gap: 48px; padding-top: 56px; padding-bottom: 40px; flex-wrap: wrap; }
  .brand { max-width: 22rem; }
  .mark { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; }
  .mark img { border-radius: 8px; }
  .wordmark { font-family: var(--font-mono); font-weight: 700; font-size: 1.1rem; }
  .tagline { margin-top: 14px; color: var(--text-secondary); font-size: 0.92rem; }
  .cols { display: flex; gap: 64px; flex-wrap: wrap; }
  .col { display: flex; flex-direction: column; gap: 4px; min-width: 9rem; }
  .col h2 { margin-bottom: 8px; }
  .col a {
    color: var(--text-secondary); text-decoration: none; font-size: 0.92rem;
    padding: 4px 0; transition: color var(--dur-fast) ease;
  }
  .col a:hover { color: var(--color-orange-ink); }
  .lower {
    display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    padding: 20px 0 28px;
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-tertiary);
  }
  .lower a { color: var(--text-secondary); text-underline-offset: 3px; }
  .lower a:hover { color: var(--color-orange-ink); }
  @media (max-width: 600px) {
    .upper { gap: 32px; padding-top: 40px; }
    .cols { gap: 40px; }
  }
</style>
