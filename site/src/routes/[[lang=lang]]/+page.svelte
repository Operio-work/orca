<script>
  import Seo from '#lib/components/Seo.svelte';
  import CopyCommand from '#lib/components/CopyCommand.svelte';
  import HeroVideo from '#lib/components/HeroVideo.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { freeEntries, packOutput } from '#lib/catalog.js';
  import { href, INSTALL_CMD, TALK_URL, partnersUrl } from '#lib/site.js';

  let { data } = $props();
  const lang = $derived(data.lang);
  const t = $derived(data.t);
  const h = $derived(t.home);
  const L = (/** @type {{en:string, es:string}} */ o) => o[lang === 'es' ? 'es' : 'en'];
  const securityIcons = ['lock', 'folder', 'shield', 'phone'];

  // Pixel sizes of the demo crops in static/pains (phone crops are 2x captures).
  /** @type {Record<string, [number, number]>} */
  const SHOT = { 'needs-you': [780, 1050], board: [910, 340], phone: [780, 1050], approve: [780, 1050] };
</script>

<Seo title={h.title} description={h.description} {lang} ogLocale={t.ogLocale} />

<section class="hero circuit-bg">
  <div class="container hero-grid">
    <div class="hero-copy">
      <h1>{h.headline}</h1>
      <p class="lead hero-lead">{h.lead}</p>

      <div class="install">
        <p class="label">{h.installLabel}</p>
        <CopyCommand cmd={INSTALL_CMD} strings={t.copy} size="lg" />
        <p class="install-note">{h.installNote} <a class="link" href={href(lang, '/install')}>{h.installMore}</a></p>
      </div>

      <a class="btn btn-ghost hero-secondary" href={TALK_URL}>
        {h.secondary}
        <span class="arrow"><Icon name="arrow" size={17} /></span>
      </a>
    </div>

    <div class="hero-media">
      <HeroVideo {lang} s={h.video} />
    </div>
  </div>
</section>

<section class="section pains-section" aria-labelledby="pains">
  <div class="container">
    <div class="section-head">
      <h2 id="pains">{h.painsTitle}</h2>
      <p>{h.painsLead}</p>
    </div>
    <ol class="pains">
      {#each h.pains as p}
        <li class="pain">
          <div class="pain-copy">
            <h3><span class="visually-hidden">{h.painLabel}: </span>{p.pain}</h3>
            <p class="pain-body">{p.painBody}</p>
            <div class="fix">
              <span class="fix-mark" aria-hidden="true"><Icon name="check" size={16} /></span>
              <div>
                <p class="fix-title"><span class="visually-hidden">{h.fixLabel}: </span>{p.fix}</p>
                <p class="fix-body">{p.fixBody}</p>
              </div>
            </div>
          </div>
          <div class="stage" data-shot={p.id}>
            <img
              src="/pains/{p.id}-{lang}.webp"
              width={SHOT[p.id][0]}
              height={SHOT[p.id][1]}
              alt={p.alt}
              loading="lazy"
              decoding="async"
            />
          </div>
        </li>
      {/each}
    </ol>
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

<section class="section biz" aria-labelledby="biz">
  <div class="container">
    <div class="biz-grid">
      <div class="section-head">
        <h2 id="biz">{h.bizTitle}</h2>
        <p>{h.bizBody}</p>
      </div>
      <div>
        <h3 class="free-title" id="free">{h.freeTitle}</h3>
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
    </div>

    <div class="managed">
      <div class="managed-head">
        <h3 id="managed">{h.managedTitle}</h3>
        <p>{h.managedBody} <a class="link" href={href(lang, '/catalog')}>{h.managedAll}</a></p>
      </div>
      <div class="compare-wrap">
        <table class="compare">
          <caption class="visually-hidden">{h.compareTitle}</caption>
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
              <td><a class="btn btn-ghost" href={href(lang, '/install')}>{h.compareFreeCta}</a></td>
              <td><a class="btn btn-primary" href={TALK_URL}>{h.secondary} <span class="arrow"><Icon name="arrow" size={17} /></span></a></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="partner">{h.partnerBody} <a class="link" href={partnersUrl(lang)}>{h.partnerCta}</a></p>
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
  /* ── Hero: the pain-aware promise on the left, the demo video on the right ── */
  .hero { position: relative; padding: 64px 0 64px; overflow: hidden; }
  .hero::after {
    content: ''; position: absolute; inset: auto 0 0 0; height: 40%;
    background: linear-gradient(to bottom, transparent, var(--color-bg));
    pointer-events: none;
  }
  .hero > .container { position: relative; z-index: 1; }
  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 48px;
    align-items: center;
  }
  h1 {
    font-size: clamp(2.1rem, 3.4vw, 2.9rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1.08;
  }
  .hero-lead { margin-top: 20px; }
  .install { margin-top: 32px; }
  .install .label { margin-bottom: 10px; }
  .install-note { margin-top: 12px; font-size: 0.9rem; color: var(--text-secondary); }
  .install-note .link { margin-left: 6px; white-space: nowrap; }
  .hero-secondary { margin-top: 24px; }

  /* The one authored entrance: the video frame unclips upward as the page settles. */
  @media (prefers-reduced-motion: no-preference) {
    .hero-media { animation: reveal 900ms var(--ease-out) 120ms both; }
  }
  @keyframes reveal {
    from { clip-path: inset(0 0 18% 0 round var(--radius-lg)); opacity: 0.2; transform: translateY(16px); }
    to { clip-path: inset(0 0 0 0 round var(--radius-lg)); opacity: 1; transform: none; }
  }

  /* ── Pain → fix ── */
  .pains { list-style: none; border-top: 1px solid var(--color-border); }
  .pain {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 30rem);
    gap: 32px 64px;
    align-items: center;
    padding: 40px 0;
    border-bottom: 1px solid var(--color-border);
  }
  .pain h3 { font-size: var(--text-xl); font-weight: 700; max-width: 24ch; }
  .pain-body { margin-top: 10px; color: var(--text-secondary); max-width: 48ch; }
  .fix {
    margin-top: 24px; padding-top: 20px;
    border-top: 1px dashed var(--color-border);
    display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 14px;
    max-width: 52ch;
  }
  .fix-mark {
    display: grid; place-items: center;
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--tint-orange); color: var(--color-orange-ink);
    border: 1px solid color-mix(in srgb, var(--color-orange) 45%, var(--color-border));
  }
  .fix-title { font-weight: 700; font-size: var(--text-lg); line-height: 1.3; color: var(--color-orange-ink); }
  .fix-body { margin-top: 6px; color: var(--text-secondary); }

  /* Stage: a framed slice of the real panel. Phone crops rise from the bottom edge (or hang
     from the top when the crop is the bottom of the screen); the wide board bleeds right. */
  .stage {
    position: relative;
    height: 320px;
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-border);
    background-color: var(--color-surface);
    background-image:
      linear-gradient(var(--circuit-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--circuit-line) 1px, transparent 1px);
    background-size: 24px 24px;
    overflow: hidden;
  }
  .stage img {
    position: absolute;
    left: 50%;
    width: 240px;
    transform: translateX(-50%);
    border: 6px solid #0A0A0A;
    background: #F4F4F5;
    box-shadow: var(--shadow-shot);
  }
  .stage:not([data-shot='needs-you']):not([data-shot='board']) img {
    top: 32px; border-bottom: 0; border-radius: 28px 28px 0 0;
  }
  .stage[data-shot='needs-you'] img {
    bottom: 32px; border-top: 0; border-radius: 0 0 28px 28px;
  }
  .stage[data-shot='board'] img {
    left: 28px; top: 50%;
    width: 600px;
    transform: translateY(-50%);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 140px), transparent calc(100% - 20px));
    mask-image: linear-gradient(90deg, #000 calc(100% - 140px), transparent calc(100% - 20px));
  }
  /* The captures are light; take the glare off them on a dark page. */
  :global([data-theme='dark']) .stage img { filter: brightness(0.93); }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .stage img { filter: brightness(0.93); }
  }

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

  /* ── Run a business? ── */
  .biz { background: var(--color-surface); }
  .biz-grid { display: grid; grid-template-columns: minmax(0, 22rem) minmax(0, 1fr); gap: 56px; align-items: start; }
  .biz-grid .section-head { margin-bottom: 0; }
  .free-title {
    font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 600;
    letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--text-tertiary);
    margin-bottom: 12px;
  }
  .free-list { list-style: none; border-top: 1px solid var(--color-border); }
  .free-list li { border-bottom: 1px solid var(--color-border); }
  .free-list a {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 15rem) 24px; gap: 28px; align-items: center;
    padding: 18px 12px; margin: 0 -12px;
    text-decoration: none; border-radius: var(--radius);
    transition: background-color var(--dur-fast) ease;
  }
  .fl-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .fl-name { font-weight: 650; font-size: 1.05rem; }
  .fl-problem { color: var(--text-secondary); font-size: 0.92rem; }
  .fl-meta { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .fl-when { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--text-secondary); }
  .fl-out {
    font-family: var(--font-mono); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--color-green-ink);
  }
  .fl-out[data-out='draft'] { color: var(--color-orange-ink); }
  .fl-arrow { color: var(--text-tertiary); transition: transform var(--dur) var(--ease-out), color var(--dur-fast) ease; }
  @media (hover: hover) and (pointer: fine) {
    .free-list a:hover { background: var(--color-surface-2); }
    .free-list a:hover .fl-arrow { transform: translateX(4px); color: var(--color-orange-ink); }
  }

  .managed { margin-top: 64px; }
  .managed-head { max-width: 46rem; margin-bottom: 24px; }
  .managed h3 { font-size: var(--text-xl); }
  .managed-head p { margin-top: 8px; color: var(--text-secondary); }
  .managed-head .link { white-space: nowrap; }
  .partner { margin-top: 16px; font-size: 0.92rem; color: var(--text-secondary); }
  .partner .link { margin-left: 4px; white-space: nowrap; }

  /* ── Compare (inside the business section) ── */
  .compare-wrap { border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg); overflow: hidden; }
  .compare { width: 100%; border-collapse: collapse; text-align: left; }
  .compare th, .compare td { padding: 16px 24px; vertical-align: top; }
  .compare thead th { border-bottom: 1px solid var(--color-border); padding-top: 16px; padding-bottom: 14px; vertical-align: middle; }
  .compare tbody tr + tr th, .compare tbody tr + tr td { border-top: 1px solid var(--color-border); }
  .compare tbody th { font-weight: 600; width: 26%; }
  .compare td { color: var(--text-secondary); width: 37%; }
  .compare tbody td:last-child, .compare thead th:last-child { background: var(--tint-orange); }
  .compare tfoot td { border-top: 1px solid var(--color-border); padding-top: 18px; padding-bottom: 20px; }
  .compare tfoot td:last-child { background: var(--tint-orange); }
  .compare tfoot .btn { white-space: nowrap; }

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
  @media (hover: hover) and (pointer: fine) {
    summary:hover { color: var(--color-orange-ink); }
  }

  /* ── Final ── */
  .final { border-top: 1px solid var(--color-border); padding: 96px 0; }
  .final-inner { display: flex; flex-direction: column; align-items: flex-start; gap: 20px; }
  .final-cmd { width: 100%; max-width: 40rem; margin-top: 8px; }

  @media (max-width: 1023px) {
    .hero-grid { grid-template-columns: 1fr; gap: 48px; }
    .hero-copy { max-width: 42rem; }
  }
  @media (max-width: 900px) {
    .pain { grid-template-columns: 1fr; gap: 24px; padding: 32px 0; }
    .biz-grid, .faq-grid { grid-template-columns: 1fr; gap: 32px; }
    .faq-grid .section-head { margin-bottom: 0; }
  }
  @media (max-width: 768px) {
    .hero { padding: 32px 0 48px; }
    h1 { font-size: clamp(2rem, 8.6vw, 2.6rem); }
    .install { margin-top: 28px; }
    .stage { height: 248px; }
    .stage img { width: 184px; border-width: 5px; }
    .stage:not([data-shot='needs-you']):not([data-shot='board']) img { top: 24px; border-radius: 22px 22px 0 0; }
    .stage[data-shot='needs-you'] img { bottom: 24px; border-radius: 0 0 22px 22px; }
    .stage[data-shot='board'] img { left: 16px; width: 480px; border-width: 1px; }
    .how { grid-template-columns: 1fr; gap: 28px; }
    .how::before { top: 20px; bottom: 20px; left: 20px; right: auto; width: 1px; height: auto; background: linear-gradient(180deg, var(--color-orange), var(--color-border)); }
    .how li { display: grid; grid-template-columns: 40px 1fr; column-gap: 18px; }
    .how-n { grid-row: span 2; margin-bottom: 0; }
    .how h3 { font-size: var(--text-lg); margin: 8px 0 6px; }
    .free-list a { grid-template-columns: minmax(0, 1fr) 20px; gap: 12px 16px; padding: 18px 0; margin: 0; }
    .fl-meta { grid-row: 2; flex-direction: row; flex-wrap: wrap; gap: 6px 14px; align-items: baseline; }
    .fl-arrow { grid-row: 1 / span 2; grid-column: 2; align-self: center; }
    .managed { margin-top: 48px; }
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
