<script>
  import Seo from '#lib/components/Seo.svelte';
  import CopyCommand from '#lib/components/CopyCommand.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { freeEntries, managedEntries, packOutput } from '#lib/catalog.js';
  import { href, INSTALL_CMD, TALK_URL, partnersUrl } from '#lib/site.js';

  let { data } = $props();
  const lang = $derived(data.lang);
  const t = $derived(data.t);
  const h = $derived(t.home);
  const L = (/** @type {{en:string, es:string}} */ o) => o[lang === 'es' ? 'es' : 'en'];
  const securityIcons = ['lock', 'folder', 'shield', 'phone'];
</script>

<Seo title={h.title} description={h.description} {lang} ogLocale={t.ogLocale} />

<section class="hero circuit-bg">
  <div class="container hero-inner">
    <div class="hero-copy">
      <h1>
        <span class="name">Free<span class="dash">-</span>ORCA</span>
        <span class="promise">{h.promise}</span>
      </h1>
      <p class="lead hero-lead">{h.lead}</p>

      <div class="install">
        <p class="label" id="install-label">{h.installLabel}</p>
        <CopyCommand cmd={INSTALL_CMD} strings={t.copy} size="lg" />
        <p class="install-note">{h.installNote} <a class="link" href={href(lang, '/install')}>{h.installMore}</a></p>
      </div>

      <div class="hero-actions">
        <a class="btn btn-ghost" href={TALK_URL}>
          {h.secondary}
          <span class="arrow"><Icon name="arrow" size={17} /></span>
        </a>
      </div>
    </div>
  </div>

  <div class="container">
    <figure class="shots">
      <div class="frames">
        <div class="browser">
          <div class="bar" aria-hidden="true">
            <span class="dots"><i></i><i></i><i></i></span>
            <span class="url"><Icon name="lock" size={12} /> 127.0.0.1:7171</span>
          </div>
          <img
            src="/shots/{lang}-desktop.webp"
            width="1440"
            height="900"
            alt={h.demoAltDesktop}
            fetchpriority="high"
          />
        </div>
        <div class="phone">
          <img src="/shots/{lang}-phone.webp" width="780" height="1300" alt={h.demoAltPhone} loading="lazy" />
        </div>
      </div>
      <figcaption>
        <h2 class="cap-title">{h.demoTitle}</h2>
        <p>{h.demoBody}</p>
        <p class="cap-try">{h.demoTry} <code>free-orca demo{lang === 'es' ? ' --lang es' : ''}</code></p>
      </figcaption>
    </figure>
  </div>
</section>

<section class="section" aria-labelledby="how">
  <div class="container">
    <div class="section-head"><h2 id="how">{h.howTitle}</h2></div>
    <ol class="how">
      {#each h.steps as step, i}
        <li>
          <span class="how-n" aria-hidden="true">{i + 1}</span>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </li>
      {/each}
    </ol>
  </div>
</section>

<section class="section" aria-labelledby="free">
  <div class="container">
    <div class="section-head">
      <h2 id="free">{h.freeTitle}</h2>
      <p>{h.freeBody}</p>
    </div>
    <ul class="free-list">
      {#each freeEntries as e}
        {@const out = packOutput(e.pack)}
        <li>
          <a href={href(lang, `/catalog/${e.id}`)}>
            <span class="fl-main">
              <span class="fl-name">{L(e.name)}</span>
              <span class="fl-problem">{L(e.problem)}</span>
            </span>
            <span class="fl-meta">
              <span class="fl-when">{L(e.trigger.summary)}</span>
              <span class="fl-out" data-out={out}>{h.freeOutput[out]}</span>
            </span>
            <span class="fl-arrow"><Icon name="arrow" size={18} /></span>
          </a>
        </li>
      {/each}
    </ul>
  </div>
</section>

<section class="section managed" aria-labelledby="managed">
  <div class="container">
    <div class="managed-grid">
      <div class="section-head">
        <h2 id="managed">{h.managedTitle}</h2>
        <p>{h.managedBody}</p>
        <a class="btn btn-ghost managed-all" href={href(lang, '/catalog')}>
          {h.managedAll} <span class="arrow"><Icon name="arrow" size={17} /></span>
        </a>
      </div>
      <ul class="pills">
        {#each managedEntries as e}
          <li><a href={href(lang, `/catalog/${e.id}`)}>{L(e.name)}</a></li>
        {/each}
      </ul>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="compare">
  <div class="container">
    <div class="section-head"><h2 id="compare">{h.compareTitle}</h2></div>
    <div class="compare-wrap">
      <table class="compare">
        <thead>
          <tr>
            <th scope="col" class="label">{h.compareHead.topic}</th>
            <th scope="col"><span class="tier tier-free">{h.compareHead.free}</span></th>
            <th scope="col"><span class="tier tier-managed">{h.compareHead.managed}</span></th>
          </tr>
        </thead>
        <tbody>
          {#each h.compareRows as [topic, free, managed]}
            <tr>
              <th scope="row">{topic}</th>
              <td data-label={t.tier.free}>{free}</td>
              <td data-label={t.tier.managed}>{managed}</td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <td></td>
            <td><a class="btn btn-primary" href={href(lang, '/install')}>{h.compareFreeCta}</a></td>
            <td><a class="btn btn-ghost" href={TALK_URL}>{t.footer.talk} <span class="arrow"><Icon name="arrow" size={17} /></span></a></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="security">
  <div class="container">
    <div class="section-head"><h2 id="security">{h.securityTitle}</h2></div>
    <ul class="security">
      {#each h.security as item, i}
        <li>
          <span class="sec-icon"><Icon name={securityIcons[i]} size={20} /></span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        </li>
      {/each}
    </ul>
    <p class="sec-more"><a class="link" href="{href(lang, '/install')}#phone">{h.securityMore}</a></p>
  </div>
</section>

<section class="partner" aria-labelledby="partner">
  <div class="container partner-inner">
    <div>
      <h2 id="partner">{h.partnerTitle}</h2>
      <p>{h.partnerBody}</p>
    </div>
    <a class="btn btn-ghost" href={partnersUrl(lang)}>{h.partnerCta} <span class="arrow"><Icon name="arrow" size={17} /></span></a>
  </div>
</section>

<section class="section" aria-labelledby="faq">
  <div class="container faq-grid">
    <div class="section-head"><h2 id="faq">{h.faqTitle}</h2></div>
    <div class="faq">
      {#each h.faq as item}
        <details>
          <summary>{item.q}<span class="chev"><Icon name="chevron" size={18} /></span></summary>
          <p>{item.a}</p>
        </details>
      {/each}
    </div>
  </div>
</section>

<section class="final circuit-bg" aria-labelledby="final">
  <div class="container final-inner">
    <h2 id="final">{h.finalTitle}</h2>
    <p class="lead">{h.finalBody}</p>
    <div class="final-cmd"><CopyCommand cmd={INSTALL_CMD} strings={t.copy} size="lg" /></div>
    <a class="btn btn-ghost" href={TALK_URL}>{h.secondary} <span class="arrow"><Icon name="arrow" size={17} /></span></a>
  </div>
</section>

<style>
  /* ── Hero ── */
  .hero { position: relative; padding: 72px 0 0; overflow: hidden; }
  .hero::after {
    /* fade the grid out toward the content below */
    content: ''; position: absolute; inset: auto 0 0 0; height: 40%;
    background: linear-gradient(to bottom, transparent, var(--color-bg));
    pointer-events: none;
  }
  .hero > .container { position: relative; z-index: 1; }
  .hero-copy { max-width: 46rem; }
  h1 { display: flex; flex-direction: column; gap: 18px; }
  .name {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: clamp(2.6rem, 7vw, 5rem);
    letter-spacing: -0.03em;
    line-height: 1;
  }
  .dash { color: var(--color-orange-ink); }
  .promise {
    font-size: clamp(1.5rem, 3vw, 2.25rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    max-width: 24ch;
  }
  .hero-lead { margin-top: 20px; }

  .install { margin-top: 36px; max-width: 40rem; }
  .install .label { margin-bottom: 10px; }
  .install-note { margin-top: 12px; font-size: 0.9rem; color: var(--text-secondary); }
  .install-note .link { margin-left: 6px; white-space: nowrap; }
  .hero-actions { margin-top: 24px; display: flex; gap: 12px; flex-wrap: wrap; }

  /* ── Demo shots: the one authored entrance on the site ── */
  .shots { margin: 64px 0 0; padding-bottom: 72px; }
  .frames { position: relative; padding-right: 13%; }
  .browser {
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    box-shadow: var(--shadow-shot);
    overflow: hidden;
  }
  .bar {
    display: flex; align-items: center; gap: 16px;
    height: 36px; padding: 0 14px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface-2);
  }
  .dots { display: flex; gap: 6px; }
  .dots i { width: 9px; height: 9px; border-radius: 50%; background: var(--color-border); }
  .url {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-secondary);
    padding: 3px 10px; border-radius: 999px; background: var(--color-surface); border: 1px solid var(--color-border);
  }
  .url :global(svg) { color: var(--color-green-ink); }
  .browser img { width: 100%; }
  /* The demo captures are light; take the glare off them on a dark page. */
  :global([data-theme='dark']) .browser img, :global([data-theme='dark']) .phone img { filter: brightness(0.93); }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .browser img, :global(:root:not([data-theme='light'])) .phone img { filter: brightness(0.93); }
  }

  .phone {
    position: absolute; right: 0; bottom: -40px;
    width: 23%;
    padding: 7px;
    border-radius: 30px;
    background: #0A0A0A;
    border: 1px solid #2A2A2A;
    box-shadow: var(--shadow-shot);
  }
  .phone img { border-radius: 23px; width: 100%; }

  @media (prefers-reduced-motion: no-preference) {
    .browser { animation: reveal 900ms var(--ease-out) 120ms both; }
    .phone { animation: rise 800ms var(--ease-out) 420ms both; }
  }
  @keyframes reveal {
    from { clip-path: inset(0 0 22% 0 round var(--radius-lg)); opacity: 0.2; transform: translateY(16px); }
    to { clip-path: inset(0 0 0 0 round var(--radius-lg)); opacity: 1; transform: none; }
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(28px) scale(0.97); filter: blur(4px); }
    to { opacity: 1; transform: none; filter: blur(0); }
  }

  figcaption {
    margin-top: 72px;
    display: grid; grid-template-columns: minmax(0, 18rem) minmax(0, 1fr); gap: 12px 48px;
    max-width: 58rem;
    color: var(--text-secondary);
  }
  .cap-title { font-size: var(--text-xl); color: var(--text-primary); grid-row: span 2; }
  .cap-try { font-size: 0.92rem; }

  /* ── How ── */
  .how { list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; position: relative; }
  .how::before {
    content: ''; position: absolute; top: 20px; left: 20px; right: 20px; height: 1px;
    background: linear-gradient(90deg, var(--color-orange) 0%, var(--color-border) 100%);
  }
  .how li { position: relative; }
  .how-n {
    display: grid; place-items: center;
    width: 40px; height: 40px; border-radius: 50%;
    font-family: var(--font-mono); font-weight: 700; font-size: 0.95rem;
    background: var(--color-bg); color: var(--color-orange-ink);
    border: 1px solid color-mix(in srgb, var(--color-orange) 55%, var(--color-border));
    margin-bottom: 22px;
    position: relative;
  }
  .how h3 { font-size: var(--text-xl); margin-bottom: 10px; }
  .how p { color: var(--text-secondary); max-width: 32ch; }

  /* ── Free routines ── */
  .free-list { list-style: none; border-top: 1px solid var(--color-border); }
  .free-list li { border-bottom: 1px solid var(--color-border); }
  .free-list a {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 17rem) 24px; gap: 32px; align-items: center;
    padding: 22px 12px; margin: 0 -12px;
    text-decoration: none; border-radius: var(--radius);
    transition: background-color var(--dur-fast) ease;
  }
  .fl-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .fl-name { font-weight: 650; font-size: 1.12rem; }
  .fl-problem { color: var(--text-secondary); font-size: 0.95rem; }
  .fl-meta { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .fl-when { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--text-secondary); }
  .fl-out {
    font-family: var(--font-mono); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--color-green-ink);
  }
  .fl-out[data-out='draft'] { color: var(--color-orange-ink); }
  .fl-arrow { color: var(--text-tertiary); transition: transform var(--dur) var(--ease-out), color var(--dur-fast) ease; }
  @media (hover: hover) and (pointer: fine) {
    .free-list a:hover { background: var(--color-surface); }
    .free-list a:hover .fl-arrow { transform: translateX(4px); color: var(--color-orange-ink); }
  }

  /* ── Managed strip ── */
  .managed { background: var(--color-surface); }
  .managed-grid { display: grid; grid-template-columns: minmax(0, 24rem) minmax(0, 1fr); gap: 56px; align-items: start; }
  .managed-grid .section-head { margin-bottom: 0; }
  .managed-all { margin-top: 28px; }
  .pills { list-style: none; display: flex; flex-wrap: wrap; gap: 10px; }
  .pills a {
    display: inline-flex; align-items: center; min-height: 40px;
    padding: 8px 16px; border-radius: 999px;
    border: 1px solid var(--color-border); background: var(--color-bg);
    font-size: 0.92rem; font-weight: 500; text-decoration: none;
    transition: border-color var(--dur-fast) ease, color var(--dur-fast) ease, background-color var(--dur-fast) ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .pills a:hover { border-color: var(--color-orange-dim); color: var(--color-orange-ink); background: var(--tint-orange); }
  }

  /* ── Compare ── */
  .compare-wrap { border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); overflow: hidden; }
  .compare { width: 100%; border-collapse: collapse; text-align: left; }
  .compare th, .compare td { padding: 18px 24px; vertical-align: top; }
  .compare thead th { border-bottom: 1px solid var(--color-border); padding-top: 18px; padding-bottom: 16px; vertical-align: middle; }
  .compare tbody tr + tr th, .compare tbody tr + tr td { border-top: 1px solid var(--color-border-dim); }
  .compare tbody th { font-weight: 600; width: 26%; }
  .compare td { color: var(--text-secondary); width: 37%; }
  .compare tbody td:last-child, .compare thead th:last-child { background: var(--tint-orange); }
  .compare tfoot td { border-top: 1px solid var(--color-border); padding-top: 20px; padding-bottom: 22px; }
  .compare tfoot td:last-child { background: var(--tint-orange); }

  /* ── Security ── */
  .security { list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 56px; }
  .security li { display: grid; grid-template-columns: 44px 1fr; gap: 16px; padding: 24px 0; border-top: 1px solid var(--color-border); }
  .sec-icon {
    display: grid; place-items: center; width: 44px; height: 44px; border-radius: var(--radius);
    background: var(--tint-orange); color: var(--color-orange-ink);
  }
  .security h3 { margin-bottom: 6px; }
  .security p { color: var(--text-secondary); max-width: 44ch; }
  .sec-more { margin-top: 24px; }

  /* ── Partner ── */
  .partner { border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); background: var(--color-surface); }
  .partner-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px 48px; padding-top: 40px; padding-bottom: 40px; flex-wrap: wrap; }
  .partner h2 { font-size: var(--text-xl); }
  .partner p { margin-top: 6px; color: var(--text-secondary); max-width: 52ch; }

  /* ── FAQ ── */
  .faq-grid { display: grid; grid-template-columns: minmax(0, 18rem) minmax(0, 1fr); gap: 48px; }
  .faq { border-top: 1px solid var(--color-border); }
  details { border-bottom: 1px solid var(--color-border); }
  summary {
    list-style: none; cursor: pointer;
    display: flex; justify-content: space-between; gap: 16px; align-items: center;
    padding: 20px 0; font-weight: 600; font-size: 1.05rem;
  }
  summary::-webkit-details-marker { display: none; }
  .chev { color: var(--text-tertiary); flex-shrink: 0; display: grid; transition: transform 0.25s var(--ease-out); }
  details[open] .chev { transform: rotate(180deg); color: var(--color-orange-ink); }
  details p { padding: 0 32px 22px 0; color: var(--text-secondary); max-width: 62ch; }
  summary:hover { color: var(--color-orange-ink); }

  /* ── Final ── */
  .final { border-top: 1px solid var(--color-border); padding: 96px 0; }
  .final-inner { display: flex; flex-direction: column; align-items: flex-start; gap: 20px; }
  .final-cmd { width: 100%; max-width: 40rem; margin-top: 8px; }

  @media (max-width: 900px) {
    .managed-grid, .faq-grid { grid-template-columns: 1fr; gap: 32px; }
    .faq-grid .section-head { margin-bottom: 0; }
    figcaption { grid-template-columns: 1fr; }
    .cap-title { grid-row: auto; }
  }
  @media (max-width: 768px) {
    .hero { padding-top: 40px; }
    .shots { margin-top: 48px; padding-bottom: 48px; }
    .frames { padding-right: 0; padding-bottom: 0; }
    .browser .bar { height: 28px; }
    .phone { width: 34%; right: -4px; bottom: -28px; border-radius: 20px; padding: 4px; }
    .phone img { border-radius: 16px; }
    figcaption { margin-top: 56px; }
    .how { grid-template-columns: 1fr; gap: 28px; }
    .how::before { top: 20px; bottom: 20px; left: 20px; right: auto; width: 1px; height: auto; background: linear-gradient(180deg, var(--color-orange), var(--color-border)); }
    .how li { display: grid; grid-template-columns: 40px 1fr; column-gap: 18px; }
    .how-n { grid-row: span 2; margin-bottom: 0; }
    .how h3 { font-size: var(--text-lg); margin: 8px 0 6px; }
    .free-list a { grid-template-columns: minmax(0, 1fr) 20px; gap: 12px 16px; padding: 18px 0; margin: 0; }
    .fl-meta { grid-row: 2; flex-direction: row; flex-wrap: wrap; gap: 6px 14px; align-items: baseline; }
    .fl-arrow { grid-row: 1 / span 2; grid-column: 2; align-self: center; }
    .security { grid-template-columns: 1fr; }
    .final { padding: 64px 0; }

    /* Compare table becomes stacked rows */
    .compare thead { display: none; }
    .compare, .compare tbody, .compare tr, .compare th, .compare td, .compare tfoot { display: block; width: auto; }
    .compare tbody tr { padding: 16px 16px 18px; }
    .compare tbody tr + tr { border-top: 1px solid var(--color-border); }
    .compare tbody th, .compare tbody td { padding: 0; border: 0 !important; background: none !important; }
    .compare tbody th { margin-bottom: 10px; width: auto; }
    .compare tbody td { width: auto; display: grid; grid-template-columns: 5.5rem 1fr; gap: 12px; padding: 4px 0; }
    .compare tbody td::before {
      content: attr(data-label);
      font-family: var(--font-mono); font-size: 0.66rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--text-tertiary); padding-top: 3px;
    }
    .compare tbody td:last-child::before { color: var(--color-orange-ink); }
    .compare tfoot tr { display: flex; flex-direction: column; gap: 10px; padding: 16px; border-top: 1px solid var(--color-border); }
    .compare tfoot td { padding: 0; border: 0; background: none !important; }
    .compare tfoot td:first-child { display: none; }
    .compare tfoot .btn { width: 100%; }
  }
</style>
