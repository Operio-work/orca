<script>
  import Seo from '#lib/components/Seo.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { href, TALK_URL } from '#lib/site.js';

  let { data } = $props();
  const lang = $derived(data.lang);
  const t = $derived(data.t);
  const b = $derived(t.buddyPage);

  // One icon per trust point, in copy order.
  const trustIcons = ['check', 'alert', 'lock', 'clock'];
</script>

<Seo title={b.metaTitle} description={b.description} {lang} ogLocale={t.ogLocale} />

<section class="head circuit-bg">
  <div class="container head-inner">
    <span class="tier tier-managed">{b.badge}</span>
    <p class="name">ORCA Buddy</p>
    <h1>{b.title}</h1>
    <p class="lead">{b.lead}</p>
    <div class="ctas">
      <a class="btn btn-primary" href={TALK_URL}>{b.cta} <span class="arrow"><Icon name="arrow" size={17} /></span></a>
      <a class="btn btn-ghost" href={href(lang, '/managed')}>{b.ctaSecondary}</a>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="errands">
  <div class="container">
    <div class="section-head"><h2 id="errands">{b.errandsTitle}</h2></div>
    <ul class="plus">
      {#each b.errands as item}
        <li>
          <span class="mark" aria-hidden="true"><Icon name="check" size={16} /></span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        </li>
      {/each}
    </ul>
  </div>
</section>

<section class="section" aria-labelledby="how">
  <div class="container">
    <div class="section-head"><h2 id="how">{b.howTitle}</h2></div>
    <ol class="how">
      {#each b.how as step, i}
        <li>
          <span class="how-n" aria-hidden="true">{i + 1}</span>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </li>
      {/each}
    </ol>
  </div>
</section>

<section class="section" aria-labelledby="trust">
  <div class="container">
    <div class="section-head"><h2 id="trust">{b.trustTitle}</h2></div>
    <ul class="trust">
      {#each b.trust as item, i}
        <li>
          <span class="ticon" aria-hidden="true"><Icon name={trustIcons[i]} size={18} /></span>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </li>
      {/each}
    </ul>
  </div>
</section>

<section class="section" aria-labelledby="orca">
  <div class="container pair">
    <div class="card">
      <h2 id="orca">{b.orcaTitle}</h2>
      <p>{b.orcaBody}</p>
    </div>
    <div class="card card-beta">
      <h2>{b.betaTitle}</h2>
      <p>{b.betaLead}</p>
      <ul class="points">
        {#each b.beta as line}
          <li><span class="mark mark-sm" aria-hidden="true"><Icon name="check" size={14} /></span>{line}</li>
        {/each}
      </ul>
      <a class="btn btn-primary" href={TALK_URL}>{b.cta} <span class="arrow"><Icon name="arrow" size={17} /></span></a>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="faq">
  <div class="container faq-grid">
    <div class="section-head"><h2 id="faq">{b.faqTitle}</h2></div>
    <div class="faq">
      {#each b.faq as item}
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
    <h2 id="final">{b.finalTitle}</h2>
    <p class="lead">{b.finalBody}</p>
    <div class="ctas">
      <a class="btn btn-primary" href={TALK_URL}>{b.cta} <span class="arrow"><Icon name="arrow" size={17} /></span></a>
    </div>
  </div>
</section>

<style>
  /* ── Hero ── */
  .head { padding: 64px 0 56px; border-bottom: 1px solid var(--color-border); }
  .head-inner { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
  .name {
    font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 700;
    letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--color-orange-ink);
  }
  .head h1 { max-width: 20ch; }
  .ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }

  .mark {
    display: grid; place-items: center; flex-shrink: 0;
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--tint-orange); color: var(--color-orange-ink);
    border: 1px solid color-mix(in srgb, var(--color-orange) 45%, var(--color-border));
  }
  .mark-sm { width: 22px; height: 22px; border: 0; }

  /* ── Errands: six, three across ── */
  .plus { list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px 40px; }
  .plus li { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 14px; }
  .plus h3 { font-size: 1.05rem; font-weight: 650; }
  .plus p { margin-top: 4px; color: var(--text-secondary); max-width: 36ch; }

  /* ── How it works ── */
  .how { list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; position: relative; }
  .how::before {
    content: ''; position: absolute; top: 20px; left: 20px; right: 20px; height: 1px;
    background: linear-gradient(90deg, var(--color-orange) 0%, var(--color-border) 100%);
  }
  .how li { position: relative; }
  .how-n {
    display: grid; place-items: center; position: relative;
    width: 40px; height: 40px; border-radius: 50%; margin-bottom: 22px;
    font-family: var(--font-mono); font-weight: 700; font-size: 0.95rem;
    background: var(--color-bg); color: var(--color-orange-ink);
    border: 1px solid color-mix(in srgb, var(--color-orange) 55%, var(--color-border));
  }
  .how h3 { font-size: var(--text-xl); margin-bottom: 10px; }
  .how p { color: var(--text-secondary); max-width: 32ch; }

  /* ── Trust: four, one row ── */
  .trust { list-style: none; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; }
  .trust li {
    padding: 24px; border: 1px solid var(--color-border); border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
  .ticon {
    display: grid; place-items: center; width: 36px; height: 36px; margin-bottom: 16px;
    border-radius: var(--radius); background: var(--tint-orange); color: var(--color-orange-ink);
  }
  .trust h3 { font-size: 1.05rem; font-weight: 650; }
  .trust p { margin-top: 6px; color: var(--text-secondary); }

  /* ── With ORCA + the beta ── */
  .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
  .card {
    display: flex; flex-direction: column; align-items: flex-start; gap: 14px;
    padding: 32px; border: 1px solid var(--color-border); border-radius: var(--radius-xl);
    background: var(--color-surface);
  }
  .card h2 { font-size: var(--text-2xl); }
  .card p { color: var(--text-secondary); max-width: 48ch; }
  .card-beta { border-color: color-mix(in srgb, var(--color-orange) 45%, var(--color-border)); }
  .points { list-style: none; display: grid; gap: 10px; margin-bottom: 8px; }
  .points li { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 10px; align-items: start; }
  .points .mark-sm { transform: translateY(2px); }

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

  @media (max-width: 900px) {
    .plus { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .trust { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .pair { grid-template-columns: 1fr; }
    .faq-grid { grid-template-columns: 1fr; gap: 32px; }
    .faq-grid .section-head { margin-bottom: 0; }
  }
  @media (max-width: 768px) {
    .section { padding: 40px 0; }
    .section-head { margin-bottom: 24px; }
    .head { padding: 32px 0 36px; }
    .head-inner { gap: 12px; }
    .head .lead { font-size: 1.05rem; line-height: 1.5; }
    .ctas { width: 100%; flex-direction: column; }
    .ctas .btn, .card .btn { width: 100%; }

    .plus { grid-template-columns: 1fr; gap: 0; border-top: 1px solid var(--color-border); }
    .plus li { grid-template-columns: 24px minmax(0, 1fr); column-gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--color-border); }
    .plus .mark { width: 24px; height: 24px; }
    .plus h3 { font-size: 1rem; }
    .plus p, .how p, .trust p { font-size: 0.95rem; line-height: 1.5; }

    .how { grid-template-columns: 1fr; gap: 20px; }
    .how::before { top: 20px; bottom: 20px; left: 20px; right: auto; width: 1px; height: auto; background: linear-gradient(180deg, var(--color-orange), var(--color-border)); }
    .how li { display: grid; grid-template-columns: 40px 1fr; column-gap: 18px; }
    .how-n { grid-row: span 2; margin-bottom: 0; }
    .how h3 { font-size: var(--text-lg); margin: 8px 0 4px; }

    .trust { grid-template-columns: 1fr; gap: 12px; }
    .trust li { padding: 18px; display: grid; grid-template-columns: 36px minmax(0, 1fr); column-gap: 14px; }
    .ticon { grid-row: span 2; margin-bottom: 0; }
    .trust p { margin-top: 2px; }

    .card { padding: 22px; }
    .card h2 { font-size: var(--text-xl); }

    summary { padding: 15px 0; font-size: 1rem; }
    details p { padding: 0 8px 18px 0; }
    .final { padding: 48px 0; }
    .final-inner { gap: 16px; }
  }
</style>
