<script>
  import Seo from '#lib/components/Seo.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { href, TALK_URL } from '#lib/site.js';

  let { data } = $props();
  const lang = $derived(data.lang);
  const t = $derived(data.t);
  const m = $derived(t.managedPage);
</script>

<Seo title={m.metaTitle} description={m.description} {lang} ogLocale={t.ogLocale} />

<section class="head circuit-bg">
  <div class="container head-inner">
    <span class="tier tier-managed">{t.tier.managedLong}</span>
    <h1>{m.title}</h1>
    <p class="lead">{m.lead}</p>
    <div class="ctas">
      <a class="btn btn-primary" href={TALK_URL}>{t.home.secondary} <span class="arrow"><Icon name="arrow" size={17} /></span></a>
      <a class="btn btn-ghost" href={href(lang, '/install')}>{m.installFree}</a>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="plus">
  <div class="container">
    <div class="section-head"><h2 id="plus">{m.plusTitle}</h2></div>
    <ul class="plus">
      {#each m.plus as item}
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

<section class="section chat" aria-labelledby="chat">
  <div class="container">
    <div class="section-head">
      <h2 id="chat">{m.chat.title}</h2>
      <p>{m.chat.lead}</p>
    </div>
    <div class="chat-shots">
      <figure class="shot-desk">
        <img src="/shots/chat-{lang}.webp" width="910" height="560" alt={m.chat.desktopAlt} loading="lazy" decoding="async" />
        <figcaption>{m.chat.desktopCaption}</figcaption>
      </figure>
      <figure class="shot-phone">
        <div class="stage">
          <img src="/shots/chat-phone-{lang}.webp" width="780" height="1050" alt={m.chat.phoneAlt} loading="lazy" decoding="async" />
        </div>
        <figcaption>{m.chat.phoneCaption}</figcaption>
      </figure>
    </div>
    <ul class="points">
      {#each m.chat.points as line}
        <li><span class="mark mark-sm" aria-hidden="true"><Icon name="check" size={15} /></span>{line}</li>
      {/each}
    </ul>
  </div>
</section>

<section class="section diff" aria-labelledby="diff">
  <div class="container">
    <div class="section-head"><h2 id="diff">{m.diffTitle}</h2></div>
    <div class="compare-wrap">
      <table class="compare">
        <caption class="visually-hidden">{m.diffTitle}</caption>
        <thead>
          <tr>
            <th scope="col" class="label">{m.diffHead.topic}</th>
            <th scope="col"><span class="tier tier-free">{m.diffHead.free}</span></th>
            <th scope="col"><span class="tier tier-managed">{m.diffHead.managed}</span></th>
          </tr>
        </thead>
        <tbody>
          {#each m.diffRows as [topic, free, managed]}
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
            <td><a class="btn btn-ghost" href={href(lang, '/install')}>{t.home.compareFreeCta}</a></td>
            <td><a class="btn btn-primary" href={TALK_URL}>{t.home.secondary} <span class="arrow"><Icon name="arrow" size={17} /></span></a></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="how">
  <div class="container">
    <div class="section-head"><h2 id="how">{m.howTitle}</h2></div>
    <ol class="how">
      {#each m.how as step, i}
        <li>
          <span class="how-n" aria-hidden="true">{i + 1}</span>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </li>
      {/each}
    </ol>
  </div>
</section>

<section class="section" aria-labelledby="faq">
  <div class="container faq-grid">
    <div class="section-head"><h2 id="faq">{m.faqTitle}</h2></div>
    <div class="faq">
      {#each m.faq as item}
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
    <h2 id="final">{m.finalTitle}</h2>
    <p class="lead">{m.finalBody}</p>
    <div class="ctas">
      <a class="btn btn-primary" href={TALK_URL}>{t.home.secondary} <span class="arrow"><Icon name="arrow" size={17} /></span></a>
      <a class="btn btn-ghost" href={href(lang, '/install')}>{m.installFree}</a>
    </div>
  </div>
</section>

<style>
  /* ── Hero: badge, headline, lead, two CTAs ── */
  .head { padding: 64px 0 56px; border-bottom: 1px solid var(--color-border); }
  .head-inner { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
  .head h1 { margin-top: 4px; max-width: 18ch; }
  .ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }

  /* Shared check mark (the home page's team-mark). */
  .mark {
    display: grid; place-items: center; flex-shrink: 0;
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--tint-orange); color: var(--color-orange-ink);
    border: 1px solid color-mix(in srgb, var(--color-orange) 45%, var(--color-border));
  }
  .mark-sm { width: 24px; height: 24px; border: 0; transform: translateY(5px); }

  /* ── Everything in free ORCA, plus: six items, three across ── */
  .plus { list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px 40px; }
  .plus li { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 14px; }
  .plus h3 { font-size: 1.05rem; font-weight: 650; }
  .plus p { margin-top: 4px; color: var(--text-secondary); max-width: 36ch; }

  /* ── Team chat: the desk capture and the phone crop side by side, then five lines ── */
  .chat { background: var(--color-surface); }
  .chat-shots { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 26rem); gap: 32px; margin-bottom: 40px; }
  .chat-shots figure { display: flex; flex-direction: column; min-width: 0; }
  .chat-shots figcaption {
    margin-top: 10px;
    font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 600;
    letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--text-tertiary);
  }
  .shot-desk img {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
    box-shadow: var(--shadow-card);
  }
  /* The phone crop is a 2x capture of the top of the screen: shown at half size, rising into a
     framed stage that matches the desk capture's height (same treatment as the home page pains). */
  .shot-phone .stage {
    flex: 1;
    position: relative;
    min-height: 280px;
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-border);
    background-color: var(--color-bg);
    background-image:
      linear-gradient(var(--circuit-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--circuit-line) 1px, transparent 1px);
    background-size: 24px 24px;
    overflow: hidden;
  }
  .shot-phone img {
    position: absolute;
    left: 50%; top: 32px;
    width: 390px; max-width: calc(100% - 48px);
    transform: translateX(-50%);
    border: 6px solid #0A0A0A; border-bottom: 0;
    border-radius: 28px 28px 0 0;
    background: #F4F4F5;
    box-shadow: var(--shadow-shot);
  }
  /* The captures are light; take the glare off them on a dark page. */
  :global([data-theme='dark']) .chat-shots img { filter: brightness(0.93); }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .chat-shots img { filter: brightness(0.93); }
  }
  .points { list-style: none; display: grid; gap: 14px; max-width: 64rem; }
  .points li { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 12px; align-items: baseline; color: var(--text-secondary); max-width: 70ch; }

  /* ── Every difference: the home page's compare table, with the full row set ── */
  .compare-wrap { border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); overflow: hidden; }
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

  /* ── How it starts (the home page's three steps) ── */
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
    .chat-shots { grid-template-columns: 1fr; gap: 24px; }
    .shot-phone .stage { min-height: 320px; }
    .faq-grid { grid-template-columns: 1fr; gap: 32px; }
    .faq-grid .section-head { margin-bottom: 0; }
  }
  @media (max-width: 768px) {
    /* Phone rhythm: tighter than desktop, same order and content. */
    .section { padding: 40px 0; }
    .section-head { margin-bottom: 24px; }
    .section-head h2 + p { margin-top: 10px; font-size: 1rem; line-height: 1.5; }
    .head { padding: 32px 0 36px; }
    .head-inner { gap: 12px; }
    .head .lead { font-size: 1.05rem; line-height: 1.5; }
    .ctas { width: 100%; flex-direction: column; }
    .ctas .btn { width: 100%; }

    .plus { grid-template-columns: 1fr; gap: 0; border-top: 1px solid var(--color-border); }
    .plus li { grid-template-columns: 24px minmax(0, 1fr); column-gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--color-border); }
    .plus .mark { width: 24px; height: 24px; }
    .plus h3 { font-size: 1rem; }
    .plus p, .points li, .how p { font-size: 0.95rem; line-height: 1.5; }

    /* Chat captures: flat, legible crops, no device frame (as the home page pains do on phones). */
    .chat-shots { gap: 20px; margin-bottom: 24px; }
    .chat-shots figcaption { margin-top: 8px; }
    .shot-phone .stage { flex: none; min-height: 0; aspect-ratio: 4 / 3; background-image: none; border-radius: var(--radius-lg); }
    .shot-phone img {
      position: static; transform: none;
      width: 100%; max-width: none; height: 100%;
      object-fit: cover; object-position: 50% 0;
      border: 0; border-radius: 0; box-shadow: none;
    }

    /* Compare: still three columns, set as a compact grid so the CTAs can span the width. */
    .compare { display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(0, 1fr) minmax(0, 1fr); }
    .compare thead, .compare tbody, .compare tfoot, .compare tr { display: contents; }
    .compare th, .compare td, .compare tbody th { padding: 10px 10px; font-size: 0.86rem; line-height: 1.4; width: auto; }
    .compare thead th { padding-top: 12px; padding-bottom: 10px; }
    .compare thead th { display: flex; align-items: center; }
    .compare .tier { height: auto; min-height: 22px; padding: 3px 8px; font-size: 0.6rem; letter-spacing: 0.06em; white-space: normal; line-height: 1.25; }
    .compare tfoot td:first-child { display: none; }
    .compare tfoot td { grid-column: 1 / -1; padding: 12px; }
    .compare tfoot td + td { border-top: 0; padding-top: 0; }
    .compare tfoot td:nth-child(2) { background: var(--color-surface); }
    .compare tfoot td:last-child { background: var(--color-surface) !important; padding-bottom: 14px; }
    .compare tfoot .btn { width: 100%; white-space: normal; }

    .how { grid-template-columns: 1fr; gap: 20px; }
    .how::before { top: 20px; bottom: 20px; left: 20px; right: auto; width: 1px; height: auto; background: linear-gradient(180deg, var(--color-orange), var(--color-border)); }
    .how li { display: grid; grid-template-columns: 40px 1fr; column-gap: 18px; }
    .how-n { grid-row: span 2; margin-bottom: 0; }
    .how h3 { font-size: var(--text-lg); margin: 8px 0 4px; }

    .faq-grid { gap: 20px; }
    summary { padding: 15px 0; font-size: 1rem; }
    details p { padding: 0 8px 18px 0; }

    .final { padding: 48px 0; }
    .final-inner { gap: 16px; }
  }
</style>
