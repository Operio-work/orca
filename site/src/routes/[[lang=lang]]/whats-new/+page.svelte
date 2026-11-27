<script>
  // What's new: every release from src/lib/releases.js (EN/ES text, light-theme pictures), dated from
  // CHANGELOG.md. A sticky list of versions follows the scroll; a picture opens full size.
  import Seo from '#lib/components/Seo.svelte';
  import CopyCommand from '#lib/components/CopyCommand.svelte';
  import HeroVideo from '#lib/components/HeroVideo.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { RELEASES, anchorOf } from '#lib/releases.js';
  import { VERSIONS, formatDate } from '#lib/changelog.js';
  import { href, GITHUB_URL } from '#lib/site.js';

  let { data } = $props();
  const lang = $derived(data.lang);
  const t = $derived(data.t);
  const w = $derived(t.whatsNewPage);
  const L = (/** @type {{en:string, es:string}} */ o) => o[lang === 'es' ? 'es' : 'en'];

  const list = RELEASES.map((r) => ({ ...r, date: VERSIONS.find((v) => v.version === r.version)?.date ?? '' }));
  const latest = list[0];
  const hero = latest.shots?.[0];

  let active = $state(list[0].version);
  /** @type {HTMLElement | undefined} */
  let listEl = $state();
  /** @type {HTMLDialogElement | undefined} */
  let box = $state();
  /** @type {{ src: string, alt: string, caption: string } | null} */
  let big = $state(null);

  $effect(() => {
    if (!listEl || typeof IntersectionObserver === 'undefined') return;
    const items = [...listEl.querySelectorAll('.rel')];
    const spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) active = /** @type {HTMLElement} */ (e.target).dataset.v ?? active;
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    const rise = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); rise.unobserve(e.target); }
      },
      { threshold: 0.08 }
    );
    items.forEach((el) => { spy.observe(el); rise.observe(el); });
    return () => { spy.disconnect(); rise.disconnect(); };
  });

  /** @param {string} id @param {any} s */
  function open(id, s) {
    big = { src: `/shots/${id}-${lang}.webp`, alt: L(s.alt), caption: L(s.caption) };
    box?.showModal();
  }
</script>

<Seo title={w.title} description={w.description} {lang} ogLocale={t.ogLocale} />

<section class="wn-hero circuit-bg">
  <div class="container hero-grid">
    <div>
      <p class="eyebrow">{w.eyebrow}</p>
      <h1>{w.h1}</h1>
      <p class="lead">{w.lead}</p>
      <a class="latest" href="#{anchorOf(latest.version)}">
        <span class="chip">{w.latest} · {latest.version}</span>
        <span>{L(latest.title)}</span>
        <time datetime={latest.date}>{formatDate(latest.date, lang)}</time>
      </a>
      <div class="update">
        <p class="label">{w.updateLabel}</p>
        <CopyCommand cmd="operio-orca update" strings={t.copy} />
        <a class="link" href={href(lang, '/install')}>{w.install}</a>
      </div>
    </div>
    {#if hero}
      <button class="hero-shot" type="button" onclick={() => open(hero.id, hero)} aria-label={L(hero.caption)}>
        <img src="/shots/{hero.id}-{lang}.webp" width="910" height="560" alt={L(hero.alt)} fetchpriority="high" />
      </button>
    {/if}
  </div>
</section>

<div class="container wn-grid">
  <nav class="wn-nav" aria-label={w.versions}>
    <p class="label">{w.versions}</p>
    <ol>
      {#each list as r}
        <li>
          <a href="#{anchorOf(r.version)}" class:on={active === r.version} aria-current={active === r.version ? 'location' : undefined}>
            <span class="v">{r.version}</span><span class="d">{formatDate(r.date, lang)}</span>
          </a>
        </li>
      {/each}
    </ol>
  </nav>

  <ol class="wn-list" bind:this={listEl}>
    {#each list as r, i}
      <li class="rel" id={anchorOf(r.version)} data-v={r.version}>
        <span class="dot" class:first={i === 0} aria-hidden="true"></span>
        <div class="rel-head">
          <span class="chip">{r.version}</span>
          {#if i === 0}<span class="new-tag">{w.latest}</span>{/if}
          <time datetime={r.date}>{formatDate(r.date, lang)}</time>
        </div>
        <h2>{L(r.title)}</h2>

        {#if r.video}
          <div class="rel-video"><HeroVideo {lang} s={t.home.whatsNew.video} name={r.video} lazy /></div>
        {/if}

        {#if r.shots?.length}
          <div class="rel-shots" class:one={r.shots.length === 1}>
            {#each r.shots as s}
              <figure>
                <button type="button" onclick={() => open(s.id, s)} aria-label={L(s.caption)}>
                  <img src="/shots/{s.id}-{lang}.webp" width="910" height="560" alt={L(s.alt)} loading="lazy" decoding="async" />
                </button>
                <figcaption>{L(s.caption)}</figcaption>
              </figure>
            {/each}
          </div>
        {/if}

        <ul class="rel-items">
          {#each r.items as it}
            <li>
              <span class="mark" aria-hidden="true"><Icon name="check" size={14} /></span>
              <div><h3>{L(it.title)}</h3><p>{L(it.body)}</p></div>
            </li>
          {/each}
        </ul>
        {#if r.also}<p class="also"><b>{w.also}:</b> {L(r.also)}</p>{/if}
      </li>
    {/each}
  </ol>
</div>

<section class="wn-end">
  <div class="container">
    <p>{w.older} <a class="link" href="{GITHUB_URL}/blob/main/CHANGELOG.md">{w.changelog}</a></p>
  </div>
</section>

<dialog class="lightbox" bind:this={box} onclick={(e) => { if (e.target === box) box?.close(); }} onclose={() => (big = null)}>
  {#if big}
    <figure>
      <img src={big.src} alt={big.alt} width="1820" height="1120" />
      <figcaption>{big.caption}</figcaption>
    </figure>
    <button class="close" type="button" onclick={() => box?.close()} aria-label={t.home.whatsNew.video.close}>×</button>
  {/if}
</dialog>

<style>
  /* ── Hero ── */
  .wn-hero { padding: 64px 0 80px; border-bottom: 1px solid var(--color-border); }
  .hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 56px; align-items: center; }
  .eyebrow { font-family: var(--font-mono); font-size: 0.75rem; line-height: 1rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-orange-ink); }
  h1 { margin-top: 12px; font-size: clamp(2.25rem, 5vw, 3.75rem); line-height: 1; letter-spacing: -0.03em; text-wrap: balance; }
  .lead { margin-top: 16px; max-width: 36rem; font-size: 1.125rem; line-height: 1.75rem; color: var(--text-secondary); text-wrap: pretty; }
  .latest {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 32px; padding: 12px 16px;
    border-radius: var(--radius-lg); border: 1px solid var(--color-border); background: var(--color-surface);
    color: var(--text-primary); text-decoration: none; font-weight: 600;
    transition: border-color 300ms var(--ease-out), transform 300ms var(--ease-out);
  }
  .latest:hover { border-color: var(--color-orange); transform: translateY(-2px); }
  .latest time { margin-left: auto; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-tertiary); font-weight: 500; }
  .chip { display: inline-block; padding: 2px 10px; border-radius: 9999px; background: var(--color-orange); color: var(--on-orange, #111); font-family: var(--font-mono); font-size: 0.75rem; line-height: 1.25rem; font-weight: 700; }
  .update { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-top: 24px; }
  .update .label { flex-basis: 100%; font-family: var(--font-mono); font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-tertiary); }
  .hero-shot, .rel-shots button {
    display: block; width: 100%; padding: 0; border: 0; background: none; cursor: zoom-in; border-radius: var(--radius-lg);
  }
  .hero-shot img, .rel-shots img {
    display: block; width: 100%; height: auto; border-radius: var(--radius-lg);
    border: 1px solid var(--color-border); background: #fff; box-shadow: var(--shadow-card);
    transition: transform 500ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 300ms var(--ease-out);
  }
  .hero-shot img { box-shadow: var(--shadow-lg); }
  @media (hover: hover) and (pointer: fine) {
    .hero-shot:hover img, .rel-shots button:hover img { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
  }
  .hero-shot:focus-visible, .rel-shots button:focus-visible { outline: 2px solid var(--color-orange); outline-offset: 4px; }

  /* ── Versions list + releases ── */
  .wn-grid { display: grid; grid-template-columns: 12rem minmax(0, 1fr); gap: 56px; padding-top: 64px; padding-bottom: 32px; }
  .wn-nav { position: sticky; top: calc(var(--nav-h, 64px) + 24px); align-self: start; }
  .label { font-family: var(--font-mono); font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-tertiary); }
  .wn-nav ol { list-style: none; margin-top: 12px; display: grid; gap: 2px; }
  .wn-nav a {
    display: flex; justify-content: space-between; gap: 8px; padding: 8px 12px; border-radius: var(--radius-sm);
    color: var(--text-secondary); text-decoration: none; font-size: 0.875rem;
    transition: background-color 300ms var(--ease-out), color 300ms var(--ease-out);
  }
  .wn-nav a:hover { background: var(--color-surface); color: var(--text-primary); }
  .wn-nav a.on { background: var(--tint-orange); color: var(--color-orange-ink); }
  .wn-nav .v { font-family: var(--font-mono); font-weight: 700; }
  .wn-nav .d { font-size: 0.75rem; color: var(--text-tertiary); }

  .wn-list { list-style: none; position: relative; }
  .wn-list::before { content: ''; position: absolute; left: 7px; top: 12px; bottom: 0; width: 1px; background: var(--color-border); }
  .rel {
    position: relative; padding: 0 0 72px 48px; scroll-margin-top: calc(var(--nav-h, 64px) + 24px);
    opacity: 0; transform: translateY(32px);
    transition: opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .rel:global(.in) { opacity: 1; transform: none; }
  .dot { position: absolute; left: 0; top: 6px; width: 15px; height: 15px; border-radius: 9999px; background: var(--color-bg); border: 2px solid var(--color-border); }
  .dot.first { border-color: var(--color-orange); background: var(--color-orange); box-shadow: 0 0 0 6px var(--tint-orange); }
  .rel-head { display: flex; align-items: center; gap: 12px; }
  .rel-head time { font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-tertiary); }
  .new-tag { font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-orange-ink); }
  .rel h2 { margin-top: 12px; font-size: 1.875rem; line-height: 2.25rem; letter-spacing: -0.02em; text-wrap: balance; }
  .rel-video { margin-top: 24px; max-width: 860px; }
  .rel-shots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-top: 24px; }
  .rel-shots.one { grid-template-columns: minmax(0, 1fr); max-width: 720px; }
  .rel-shots figcaption { margin-top: 10px; font-family: var(--font-mono); font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-tertiary); }
  .rel-items { list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 48px; margin-top: 24px; border-top: 1px solid var(--color-border); }
  .rel-items li { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 12px; padding: 16px 0; border-bottom: 1px solid var(--color-border); }
  .mark { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--tint-orange); color: var(--color-orange-ink); transform: translateY(2px); }
  .rel-items h3 { font-size: 1.05rem; font-weight: 650; }
  .rel-items p { margin-top: 4px; font-size: 0.95rem; color: var(--text-secondary); text-wrap: pretty; }
  .also { margin-top: 16px; max-width: 60ch; font-size: 0.95rem; color: var(--text-secondary); }
  .also b { color: var(--text-primary); }

  .wn-end { padding: 0 0 96px; }
  .wn-end p { color: var(--text-secondary); }

  /* ── Full-size picture ── */
  .lightbox { max-width: min(1200px, 94vw); width: 100%; padding: 0; border: 0; border-radius: var(--radius-xl); background: var(--color-bg); box-shadow: var(--shadow-lg); }
  .lightbox::backdrop { background: rgba(10, 10, 10, 0.6); backdrop-filter: blur(6px); }
  .lightbox[open] { animation: pop 400ms cubic-bezier(0.22, 1, 0.36, 1); }
  @keyframes pop { from { opacity: 0; transform: scale(0.96); } }
  .lightbox figure { padding: 16px; }
  .lightbox img { display: block; width: 100%; height: auto; border-radius: var(--radius-lg); border: 1px solid var(--color-border); }
  .lightbox figcaption { margin-top: 12px; font-size: 0.95rem; color: var(--text-secondary); }
  .close { position: absolute; top: 24px; right: 24px; width: 40px; height: 40px; border-radius: 9999px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--text-primary); font-size: 1.5rem; line-height: 1; cursor: pointer; }
  .close:focus-visible { outline: 2px solid var(--color-orange); outline-offset: 2px; }

  @media (max-width: 1023px) {
    .hero-grid { grid-template-columns: 1fr; gap: 40px; }
    .wn-grid { grid-template-columns: minmax(0, 1fr); gap: 24px; padding-top: 40px; }
    .wn-nav { min-width: 0; }
    .wn-nav { position: static; }
    .wn-nav ol { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
    .wn-nav a { flex-direction: column; gap: 0; border: 1px solid var(--color-border); white-space: nowrap; }
  }
  @media (max-width: 768px) {
    .wn-hero { padding: 32px 0 48px; }
    .rel { padding: 0 0 56px 32px; }
    .rel h2 { font-size: 1.5rem; line-height: 2rem; }
    .rel-shots, .rel-items { grid-template-columns: 1fr; gap: 16px; }
    .rel-items { gap: 0; }
    .latest time { margin-left: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .rel { transform: none; transition: opacity 300ms var(--ease-out); }
    .lightbox[open] { animation: none; }
  }
</style>
