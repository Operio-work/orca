<script>
  import Seo from '#lib/components/Seo.svelte';
  import CopyCommand from '#lib/components/CopyCommand.svelte';
  import HeroVideo from '#lib/components/HeroVideo.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import OperioLogo from '#lib/components/OperioLogo.svelte';
  import { freeEntries, packOutput } from '#lib/catalog.js';
  import { href, GITHUB_URL, INSTALL_CMD, TALK_URL, partnersUrl } from '#lib/site.js';

  let { data } = $props();
  const lang = $derived(data.lang);
  const t = $derived(data.t);
  const h = $derived(t.home);
  const L = (/** @type {{en:string, es:string}} */ o) => o[lang === 'es' ? 'es' : 'en'];
  const securityIcons = ['lock', 'folder', 'shield', 'phone'];

  // Pixel sizes of the demo crops in static/pains (phone crops are 2x captures).
  /** @type {Record<string, [number, number]>} */
  const SHOT = { 'needs-you': [780, 1050], board: [910, 340], phone: [780, 1050], approve: [780, 1050], team: [910, 560] };
  // Pixel sizes of the 0.3.0 captures in static/shots (talk, templates, skills, knowledge).
  /** @type {Record<string, [number, number]>} */
  const SHOT2 = { "adm-overview": [910, 560], "adm-agents": [910, 560], "adm-skills": [910, 560], browser: [910, 560], approval: [910, 560], routine: [910, 560], agents: [910, 560], admin: [910, 560], languages: [910, 560], talk: [910, 560], templates: [910, 560], skills: [910, 560], knowledge: [910, 560] };
</script>

<Seo title={h.title} description={h.description} {lang} ogLocale={t.ogLocale} />

<section class="hero circuit-bg">
  <div class="container hero-grid">
    <div class="hero-copy">
      <h1>{h.headline}</h1>
      <p class="lead hero-lead">{h.lead}</p>

      <div class="acro">
        <p class="visually-hidden">{h.acronymLabel}:</p>
        <ul>
          {#each h.acronym as [word, what]}
            <li>
              <span class="acro-word"><span class="acro-i">{word[0]}</span>{word.slice(1)}</span>
              <span class="acro-what">{what}</span>
            </li>
          {/each}
        </ul>
      </div>

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

<div class="proof">
  <div class="container">
    <p>
      <OperioLogo height={24} alt="" />
      <span><strong>{h.proofLead}</strong> {h.proofBody}</span>
    </p>
  </div>
</div>

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

<section class="section vs-teaser" aria-labelledby="vs">
  <div class="container vs-grid">
    <h2 id="vs">{h.vsTitle}</h2>
    <div>
      <ul class="vs-lines">
        {#each h.vsLines as line}
          <li><span class="vs-mark" aria-hidden="true"><Icon name="check" size={15} /></span>{line}</li>
        {/each}
      </ul>
      <a class="link vs-more" href={href(lang, '/compare')}>{h.vsMore} <span class="arrow" aria-hidden="true"><Icon name="arrow" size={16} /></span></a>
    </div>
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

<section class="section" aria-labelledby="whats-new">
  <div class="container">
    <div class="section-head"><h2 id="whats-new">{h.whatsNew.title}</h2></div>
    <div class="new-video"><HeroVideo {lang} s={h.whatsNew.video} name="operio-orca-0.6" lazy /></div>
    <div class="shots">
      {#each h.whatsNew.shots as s}
        <figure>
          <img
            src="/shots/{s.id}-{lang}.webp"
            width={SHOT2[s.id][0]}
            height={SHOT2[s.id][1]}
            alt={s.alt}
            loading="lazy"
            decoding="async"
          />
          <figcaption>{s.caption}</figcaption>
        </figure>
      {/each}
    </div>
    <ul class="new-list">
      {#each h.whatsNew.items as item}
        <li>
          <span class="new-mark" aria-hidden="true"><Icon name="check" size={14} /></span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        </li>
      {/each}
    </ul>
    <p class="new-note">{h.whatsNew.note} <a class="link" href="{GITHUB_URL}/blob/main/CHANGELOG.md">{h.whatsNew.changelog}</a></p>
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
      <p class="compare-more"><a class="link" href={href(lang, '/managed')}>{h.seeDifferences} <span class="arrow" aria-hidden="true"><Icon name="arrow" size={16} /></span></a></p>
      <p class="partner">{h.partnerBody} <a class="link" href={partnersUrl(lang)}>{h.partnerCta}</a></p>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="team">
  <div class="container team-grid">
    <div class="team-intro">
      <span class="tier tier-managed">{t.tier.managedLong}</span>
      <h2 id="team">{h.team.title}</h2>
      <p>{h.team.lead}</p>
      <a class="btn btn-primary" href={TALK_URL}>{h.secondary} <span class="arrow"><Icon name="arrow" size={17} /></span></a>
      <a class="link team-more" href={href(lang, '/managed')}>{h.seeDifferences} <span class="arrow" aria-hidden="true"><Icon name="arrow" size={16} /></span></a>
    </div>
    <ul class="team-list">
      {#each h.team.items as item}
        <li>
          <span class="team-mark" aria-hidden="true"><Icon name="check" size={16} /></span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        </li>
      {/each}
    </ul>
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

  /* The name, spelled out: four verbs whose initials read O-R-C-A down the line. */
  .acro { margin-top: 24px; }
  .acro ul {
    list-style: none;
    display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 20px;
    border-top: 1px solid var(--color-border);
    padding-top: 14px;
  }
  .acro li { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .acro-word {
    font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-primary);
  }
  .acro-i { color: var(--color-orange-ink); font-weight: 700; }
  .acro-what { font-size: 0.86rem; line-height: 1.4; color: var(--text-secondary); text-wrap: pretty; }
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

  /* ── Proof strip: one quiet line under the hero ── */
  .proof { border-block: 1px solid var(--color-border); }
  .proof p {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 0;
    font-size: 0.95rem; line-height: 1.5; color: var(--text-secondary);
  }
  .proof strong { color: var(--text-primary); font-weight: 650; }


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
  .stage:not([data-shot='needs-you']):not([data-shot='board']):not([data-shot='team']) img {
    top: 32px; border-bottom: 0; border-radius: 28px 28px 0 0;
  }
  .stage[data-shot='needs-you'] img {
    bottom: 32px; border-top: 0; border-radius: 0 0 28px 28px;
  }
  .stage[data-shot='board'] img,
  .stage[data-shot='team'] img {
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
  :global([data-theme='dark']) .stage img, :global([data-theme='dark']) .shots img { filter: brightness(0.93); }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .stage img,
    :global(:root:not([data-theme='light'])) .shots img { filter: brightness(0.93); }
  }

  /* ── How ORCA compares: three lines and a link, no table on the home page ── */
  .vs-teaser { padding: 64px 0; }
  .vs-grid { display: grid; grid-template-columns: minmax(0, 18rem) minmax(0, 1fr); gap: 48px; align-items: start; }
  .vs-lines { list-style: none; display: grid; gap: 14px; }
  .vs-lines li { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 12px; align-items: baseline; color: var(--text-secondary); max-width: 60ch; }
  .vs-mark {
    display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%;
    background: var(--tint-orange); color: var(--color-orange-ink);
    transform: translateY(5px);
  }
  .vs-more { display: inline-block; margin-top: 22px; margin-left: 36px; }
  .vs-more .arrow { display: inline-block; vertical-align: -3px; margin-left: 4px; transition: transform var(--dur) var(--ease-out); }
  @media (hover: hover) and (pointer: fine) {
    .vs-more:hover .arrow { transform: translateX(3px); }
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

  /* ── What's new in 0.3.0: four framed captures in two rows (2 + 2), then a two-column list ── */
  .shots { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 24px; margin-bottom: 40px; }
  .shots figure { grid-column: span 3; min-width: 0; }
  .shots img {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-card);
  }
  .shots figcaption {
    margin-top: 10px;
    font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 600;
    letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--text-tertiary);
  }
  .new-list { list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 56px; border-top: 1px solid var(--color-border); }
  .new-list li {
    display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 12px;
    padding: 18px 0; border-bottom: 1px solid var(--color-border);
  }
  .new-mark {
    display: grid; place-items: center;
    width: 24px; height: 24px; border-radius: 50%;
    background: var(--tint-orange); color: var(--color-orange-ink);
    transform: translateY(2px);
  }
  .new-list h3 { font-size: 1.05rem; font-weight: 650; }
  .new-list p { margin-top: 4px; font-size: 0.95rem; color: var(--text-secondary); max-width: 52ch; }
  .new-note { margin-top: 20px; font-size: 0.92rem; color: var(--text-secondary); }
  .new-note .link { margin-left: 4px; white-space: nowrap; }

  /* ── ORCA Managed by Operio: the panel with your team in it ── */
  .team-grid { display: grid; grid-template-columns: minmax(0, 22rem) minmax(0, 1fr); gap: 56px; align-items: start; }
  .team-intro { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
  .team-intro h2 { margin-top: 4px; }
  .team-intro p { color: var(--text-secondary); font-size: var(--text-lg); line-height: 1.55; }
  .team-intro .btn { margin-top: 8px; }
  .team-more .arrow, .compare-more .arrow { display: inline-block; vertical-align: -3px; margin-left: 4px; transition: transform var(--dur) var(--ease-out); }
  @media (hover: hover) and (pointer: fine) {
    .team-more:hover .arrow, .compare-more:hover .arrow { transform: translateX(3px); }
  }
  .team-list { list-style: none; border-top: 1px solid var(--color-border); }
  .team-list li {
    display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 14px;
    padding: 20px 0; border-bottom: 1px solid var(--color-border);
  }
  .team-mark {
    display: grid; place-items: center;
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--tint-orange); color: var(--color-orange-ink);
    border: 1px solid color-mix(in srgb, var(--color-orange) 45%, var(--color-border));
  }
  .team-list h3 { font-size: 1.05rem; font-weight: 650; }
  .team-list p { margin-top: 4px; color: var(--text-secondary); max-width: 52ch; }

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
  .compare-more { margin-top: 16px; }
  .partner { margin-top: 12px; font-size: 0.92rem; color: var(--text-secondary); }
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
    .vs-grid { grid-template-columns: 1fr; gap: 20px; }
    .pain { grid-template-columns: 1fr; gap: 24px; padding: 32px 0; }
    .biz-grid, .faq-grid, .team-grid { grid-template-columns: 1fr; gap: 32px; }
    .faq-grid .section-head { margin-bottom: 0; }
  }
  @media (max-width: 768px) {
    /* Phone rhythm: tighter than desktop, same order and content. */
    .vs-lines li, .pain-body, .fix-body, .how p, .security p, .managed-head p, .biz-grid .section-head p { font-size: 0.95rem; line-height: 1.5; }
    .hero-lead { font-size: 1.05rem; line-height: 1.5; }
    .section { padding: 40px 0; }
    .section-head { margin-bottom: 24px; }
    .section-head h2 + p { margin-top: 10px; font-size: 1rem; line-height: 1.5; }

    .hero { padding: 24px 0 36px; }
    .hero-grid { gap: 32px; }
    h1 { font-size: clamp(2rem, 8.6vw, 2.6rem); }
    .hero-lead { margin-top: 14px; }
    .acro { margin-top: 18px; }
    .acro ul { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; padding-top: 12px; }
    .acro-what { font-size: 0.82rem; }
    .install { margin-top: 24px; }
    .hero-secondary { margin-top: 16px; }

    .proof p { align-items: flex-start; gap: 12px; padding: 14px 0; font-size: 0.9rem; }

    /* Pains: a flat, legible crop of the relevant part of each screen, no device frame. */
    .pain { gap: 16px; padding: 22px 0; }
    .pain h3 { font-size: 1.3rem; }
    .pain-body { margin-top: 8px; }
    /* Fix: mark beside the title, the body takes the full width below. */
    .fix { margin-top: 16px; padding-top: 14px; grid-template-columns: 24px minmax(0, 1fr); column-gap: 10px; row-gap: 0; align-items: center; }
    .fix > div { display: contents; }
    .fix-mark { width: 24px; height: 24px; }
    .fix-title { font-size: 1.05rem; }
    .fix-body { grid-column: 1 / -1; margin-top: 6px; }
    .stage { height: auto; aspect-ratio: 2 / 1; background-image: none; }
    .stage[data-shot='board'] { aspect-ratio: 910 / 340; }
    .stage[data-shot='team'] { aspect-ratio: 910 / 560; }
    .stage img,
    .stage:not([data-shot='needs-you']):not([data-shot='board']):not([data-shot='team']) img,
    .stage[data-shot='needs-you'] img,
    .stage[data-shot='board'] img,
    .stage[data-shot='team'] img {
      position: static; transform: none;
      width: 100%; height: 100%;
      object-fit: cover; object-position: 50% var(--crop-y, 0%);
      border: 0; border-radius: 0; box-shadow: none;
      -webkit-mask-image: none; mask-image: none;
    }
    .stage[data-shot='needs-you'] { --crop-y: 74%; }
    .stage[data-shot='phone'] { --crop-y: 44%; }
    .stage[data-shot='approve'] { --crop-y: 14%; }

    .how { grid-template-columns: 1fr; gap: 20px; }
    .how::before { top: 20px; bottom: 20px; left: 20px; right: auto; width: 1px; height: auto; background: linear-gradient(180deg, var(--color-orange), var(--color-border)); }
    .how li { display: grid; grid-template-columns: 40px 1fr; column-gap: 18px; }
    .how-n { grid-row: span 2; margin-bottom: 0; }
    .how h3 { font-size: var(--text-lg); margin: 8px 0 4px; }

    /* What's new: the four captures become one swipeable row (the page does not grow with
       each capture); the list is one column. */
    .shots {
      display: flex; gap: 12px; margin: 0 calc(-1 * var(--gutter)) 24px; padding: 0 var(--gutter) 6px;
      overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: var(--gutter);
      -webkit-overflow-scrolling: touch;
    }
    .shots figure { flex: 0 0 84%; scroll-snap-align: start; }
    .shots figcaption { margin-top: 8px; }
    .new-list { grid-template-columns: 1fr; }
    .new-list li { padding: 14px 0; }
    .new-list h3 { font-size: 1rem; }
    .new-list p, .team-list p, .new-note { font-size: 0.92rem; line-height: 1.5; }

    .team-grid { gap: 24px; }
    .team-intro { gap: 12px; }
    .team-intro p { font-size: 1rem; line-height: 1.5; }
    .team-intro .btn { width: 100%; }
    .team-list li { grid-template-columns: 24px minmax(0, 1fr); column-gap: 12px; padding: 14px 0; }
    .team-mark { width: 24px; height: 24px; }
    .team-list h3 { font-size: 1rem; }

    .biz-grid { gap: 24px; }
    .free-list a { grid-template-columns: minmax(0, 1fr) 20px; gap: 8px 16px; padding: 14px 0; margin: 0; }
    .fl-meta { grid-row: 2; flex-direction: row; flex-wrap: wrap; gap: 6px 14px; align-items: baseline; }
    .fl-arrow { grid-row: 1 / span 2; grid-column: 2; align-self: center; }
    .managed { margin-top: 36px; }
    .managed-head { margin-bottom: 16px; }

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
    .compare tfoot td:nth-child(2) { background: var(--color-bg); }
    .compare tfoot td:last-child { background: var(--color-bg) !important; padding-bottom: 14px; }
    .compare tfoot .btn { width: 100%; }

    .security { grid-template-columns: 1fr; }
    .security li { grid-template-columns: 32px minmax(0, 1fr); column-gap: 12px; row-gap: 6px; align-items: center; padding: 16px 0; }
    .security li > div { display: contents; }
    .sec-icon { width: 32px; height: 32px; }
    .security h3 { margin-bottom: 0; }
    .security p { grid-column: 1 / -1; }
    .sec-more { margin-top: 16px; }

    .faq-grid { gap: 20px; }
    summary { padding: 15px 0; font-size: 1rem; }
    details p { padding: 0 8px 18px 0; }

    .final { padding: 48px 0; }
    .final-inner { gap: 16px; }
  }
  .new-video { max-width: 860px; margin: 0 auto 28px; }
</style>
