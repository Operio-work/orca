<script>
  import Seo from '#lib/components/Seo.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import OperioLogo from '#lib/components/OperioLogo.svelte';
  import { href, TALK_URL, HERDR_URL, GITHUB_URL } from '#lib/site.js';
  import { TOOLS, ROWS, CHECKED, ORCA_PICK, copy } from '#lib/compare.js';

  let { data } = $props();
  const lang = $derived(data.lang);
  const t = $derived(data.t);
  const k = $derived(lang === 'es' ? copy.es : copy.en);
  const L = (/** @type {{en:string, es:string}} */ o) => o[lang === 'es' ? 'es' : 'en'];

  const orca = TOOLS[0];
  const rivals = TOOLS.slice(1);

  /** @type {Record<string, string>} */
  const ICON = { yes: 'check', no: 'x', partial: 'half', progress: 'clock', unclear: 'help' };
</script>

{#snippet cell(/** @type {import('#lib/compare.js').Cell} */ x)}
  {#if x.s === 'text'}
    <span class="v v-text">{x.note ? L(x.note) : ''}</span>
  {:else}
    <span class="v" data-s={x.s}>
      <span class="v-mark"><Icon name={ICON[x.s]} size={15} /></span>
      <span class="v-word">{k.states[x.s]}</span>
    </span>
    {#if x.note}<span class="v-note">{L(x.note)}</span>{/if}
  {/if}
{/snippet}

{#snippet sources(/** @type {typeof TOOLS[number]} */ tool)}
  {#each tool.sources as src, i}{#if i > 0}<span class="sep" aria-hidden="true">{'\u00a0·\u00a0'}</span>{/if}<a class="src" href={src.url}>{src.label}</a>{/each}
{/snippet}

<Seo title={k.metaTitle} description={k.description} {lang} ogLocale={t.ogLocale} />

<section class="head circuit-bg">
  <div class="container">
    <h1>{k.title}</h1>
    <p class="lead">{k.lead}</p>
    <p class="herdr">
      <span class="herdr-mark" aria-hidden="true"><Icon name="laptop" size={16} /></span>
      <span>{k.herdr.slice(0, k.herdr.indexOf('herdr'))}<a class="link" href={HERDR_URL}>herdr</a>{k.herdr.slice(k.herdr.indexOf('herdr') + 5)}</span>
    </p>
  </div>
</section>

<section class="section matrix-section" aria-labelledby="matrix">
  <div class="container">
    <h2 id="matrix" class="visually-hidden">{k.tableCaption}</h2>

    <ul class="legend" aria-label={k.legendLabel}>
      {#each k.legend as [s, what]}
        <li><span class="v" data-s={s}><span class="v-mark"><Icon name={ICON[s]} size={15} /></span></span>{what}</li>
      {/each}
    </ul>

    <!-- Desktop: the full matrix, ORCA pinned first. -->
    <div class="matrix-wrap">
      <table class="matrix">
        <caption class="visually-hidden">{k.tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col" class="label need">{k.need}</th>
            {#each TOOLS as tool}
              <th scope="col" class:orca={tool.id === 'orca'}>
                <span class="tname">{tool.name}</span>
                <span class="tby">{L(tool.by)}</span>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each ROWS as row}
            <tr>
              <th scope="row">{L(row.label)}</th>
              {#each row.cells as x, i}
                <td class:orca={i === 0}>{@render cell(x)}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="checked-line">
        {k.checkedCap} <time datetime={CHECKED}>{CHECKED}</time>.
        <a class="link" href="#sources">{k.sourcesTitle}</a>
      </p>
    </div>

    <!-- Phone: one "ORCA vs X" card per tool, same rows. -->
    <div class="cards">
      <p class="cards-orca">{L(ORCA_PICK)}</p>
      {#each rivals as tool, ti}
        <article class="card" aria-labelledby="vs-{tool.id}">
          <h3 id="vs-{tool.id}">
            <span class="c-orca">ORCA</span> <span class="c-vs">{k.vs}</span> {tool.name}
          </h3>
          <table class="vs">
            <caption class="visually-hidden">ORCA {k.vs} {tool.name}</caption>
            <thead>
              <tr>
                <th scope="col"><span class="visually-hidden">{k.need}</span></th>
                <th scope="col" class="orca">ORCA</th>
                <th scope="col">{tool.name}</th>
              </tr>
            </thead>
            <tbody>
              {#each ROWS as row}
                <tr>
                  <th scope="row">{L(row.label)}</th>
                  <td class="orca">{@render cell(row.cells[0])}</td>
                  <td>{@render cell(row.cells[ti + 1])}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if tool.pick}<p class="c-pick">{L(tool.pick)}</p>{/if}
          <p class="c-src">
            {k.source}: {@render sources(tool)}
            <span class="c-date">{k.checked} <time datetime={CHECKED}>{CHECKED}</time></span>
          </p>
        </article>
      {/each}
    </div>
  </div>
</section>

<section class="section pick-section" aria-labelledby="pick">
  <div class="container">
    <div class="section-head"><h2 id="pick">{k.pickTitle}</h2></div>
    <ul class="picks">
      <li class="pick-orca"><span class="p-name">ORCA</span><p>{L(ORCA_PICK)}</p></li>
      {#each rivals as tool}
        <li><span class="p-name">{tool.name}</span><p>{L(tool.pick)}</p></li>
      {/each}
    </ul>
  </div>
</section>

<section class="section choice-section" aria-labelledby="choice">
  <div class="container">
    <div class="section-head">
      <h2 id="choice">{k.choiceTitle}</h2>
      <p>{k.choiceBody}</p>
    </div>
    <div class="choice">
      <div class="opt">
        <span class="tier tier-free">{t.tier.free}</span>
        <h3>{k.local.title}</h3>
        <p>{k.local.body}</p>
        <a class="btn btn-ghost" href={href(lang, '/install')}>{k.local.cta} <span class="arrow"><Icon name="arrow" size={17} /></span></a>
      </div>
      <div class="opt opt-managed">
        <div class="opt-top">
          <span class="tier tier-managed">{t.tier.managed}</span>
          <OperioLogo height={20} />
        </div>
        <h3>{k.managed.title}</h3>
        <p>{k.managed.body}</p>
        <a class="btn btn-primary" href={TALK_URL}>{k.managed.cta} <span class="arrow"><Icon name="arrow" size={17} /></span></a>
      </div>
    </div>
  </div>
</section>

<section class="section sources-section" id="sources" aria-labelledby="sources-title">
  <div class="container">
    <div class="section-head">
      <h2 id="sources-title">{k.sourcesTitle}</h2>
      <p>{k.sourcesBody} <a class="link" href="{GITHUB_URL}/issues">{k.sourcesIssue}</a></p>
    </div>
    <dl class="srcs">
      {#each TOOLS as tool}
        <div>
          <dt>{tool.name}</dt>
          <dd>
            <span class="srcs-links">{@render sources(tool)}</span>
            <span class="c-date">{k.checked} <time datetime={CHECKED}>{CHECKED}</time></span>
          </dd>
        </div>
      {/each}
    </dl>
  </div>
</section>

<style>
  .head { padding: 64px 0 48px; border-bottom: 1px solid var(--color-border); }
  .head .lead { margin-top: 16px; }
  .herdr {
    margin-top: 28px; max-width: 46rem;
    display: flex; gap: 14px; align-items: flex-start;
    padding: 16px 18px; border-radius: var(--radius-lg);
    border: 1px solid var(--color-border); background: var(--color-surface);
    color: var(--text-secondary); font-size: 0.95rem;
  }
  .herdr-mark {
    flex-shrink: 0; display: grid; place-items: center;
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--tint-orange); color: var(--color-orange-ink);
  }
  .herdr .link { margin-left: 2px; }

  .matrix-section { padding-top: 56px; padding-bottom: 72px; }
  .pick-section { padding-top: 72px; }
  .sep { color: var(--text-tertiary); }

  /* ── Values: icon + word, optional qualifier ── */
  .v { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 0.9rem; line-height: 1.3; }
  .v-mark {
    display: grid; place-items: center; flex-shrink: 0;
    width: 22px; height: 22px; border-radius: 50%;
    border: 1px solid currentColor;
  }
  .v[data-s='yes'] { color: var(--color-green-ink); }
  .v[data-s='yes'] .v-mark { background: color-mix(in srgb, var(--color-green) 12%, transparent); border-color: color-mix(in srgb, var(--color-green) 45%, transparent); }
  .v[data-s='no'] { color: var(--text-tertiary); font-weight: 500; }
  .v[data-s='no'] .v-mark { border-color: var(--color-border); }
  .v[data-s='partial'] { color: var(--text-secondary); }
  .v[data-s='partial'] .v-mark { border-color: color-mix(in srgb, var(--text-secondary) 45%, transparent); }
  .v[data-s='progress'] { color: var(--color-orange-ink); }
  .v[data-s='progress'] .v-mark { background: var(--tint-orange); border-color: color-mix(in srgb, var(--color-orange) 45%, transparent); }
  .v[data-s='unclear'] { color: var(--text-tertiary); font-weight: 500; }
  .v[data-s='unclear'] .v-mark { border-style: dashed; border-color: var(--text-dim); }
  .v-text { display: block; font-weight: 500; font-size: 0.9rem; color: var(--text-primary); line-height: 1.4; }
  .v-note { display: block; margin-top: 4px; font-size: 0.8rem; line-height: 1.35; color: var(--text-secondary); }

  .legend {
    list-style: none; display: flex; flex-wrap: wrap; gap: 10px 24px;
    margin-bottom: 20px; font-size: 0.85rem; color: var(--text-secondary);
  }
  .legend li { display: inline-flex; align-items: center; gap: 8px; }

  /* ── Matrix (desktop) ── */
  .matrix-wrap {
    border: 1px solid var(--color-border); border-radius: var(--radius-lg);
    background: var(--color-surface); overflow: hidden;
  }
  .matrix { width: 100%; border-collapse: collapse; text-align: left; table-layout: fixed; }
  .matrix th, .matrix td { padding: 14px 14px; vertical-align: top; }
  .matrix thead th { vertical-align: bottom; border-bottom: 1px solid var(--color-border); padding-top: 18px; }
  .matrix .need { width: 19%; }
  .tname { display: block; font-weight: 700; font-size: 0.95rem; line-height: 1.25; text-wrap: balance; }
  .tby { display: block; margin-top: 3px; font-size: var(--text-xs); font-family: var(--font-mono); color: var(--text-tertiary); font-weight: 500; }
  .matrix tbody th { font-weight: 600; font-size: 0.92rem; line-height: 1.35; color: var(--text-primary); }
  .matrix tbody tr + tr > * { border-top: 1px solid var(--color-border); }
  .matrix .orca { background: var(--tint-orange); }
  .matrix thead .orca .tname { color: var(--color-orange-ink); font-family: var(--font-mono); letter-spacing: 0.02em; }
  .matrix thead .orca .tby { color: var(--color-orange-ink); font-style: italic; }
  @media (hover: hover) and (pointer: fine) {
    .matrix tbody tr:hover > th, .matrix tbody tr:hover > td:not(.orca) { background: var(--color-surface-2); }
  }
  .checked-line {
    padding: 14px 18px; border-top: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-tertiary);
  }
  .checked-line .link { margin-left: 6px; font-family: var(--font-sans); font-size: 0.85rem; }

  /* ── Cards (phone) ── */
  .cards { display: none; }
  .cards-orca { color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 20px; }
  .card {
    border: 1px solid var(--color-border); border-radius: var(--radius-lg);
    background: var(--color-surface); overflow: hidden;
  }
  .card + .card { margin-top: 16px; }
  .card h3 { padding: 16px 16px 12px; font-size: 1.15rem; line-height: 1.3; }
  .c-orca { font-family: var(--font-mono); color: var(--color-orange-ink); }
  .c-vs { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 500; color: var(--text-tertiary); margin: 0 2px; }
  .vs { width: 100%; border-collapse: collapse; table-layout: fixed; text-align: left; }
  .vs th, .vs td { padding: 10px 8px; vertical-align: top; }
  .vs thead th { font-size: var(--text-xs); font-family: var(--font-mono); font-weight: 600; color: var(--text-tertiary); padding-top: 8px; padding-bottom: 8px; border-top: 1px solid var(--color-border); line-height: 1.3; overflow-wrap: anywhere; }
  .vs thead th.orca { color: var(--color-orange-ink); }
  .vs th:first-child { width: 40%; padding-left: 16px; }
  .vs td:last-child, .vs th:last-child { padding-right: 16px; }
  .vs tbody th { font-size: 0.85rem; font-weight: 600; line-height: 1.35; }
  .vs tbody tr > * { border-top: 1px solid var(--color-border); }
  .vs .orca { background: var(--tint-orange); }
  .vs .v { font-size: 0.82rem; gap: 6px; }
  .vs .v-mark { width: 20px; height: 20px; }
  .vs .v-text { font-size: 0.82rem; }
  .vs .v-note { font-size: 0.76rem; }
  .c-pick { padding: 14px 16px 0; font-size: 0.92rem; color: var(--text-secondary); border-top: 1px solid var(--color-border); }
  .c-src { padding: 10px 16px 16px; font-size: 0.82rem; color: var(--text-secondary); overflow-wrap: anywhere; }
  .c-date { display: block; margin-top: 4px; font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-tertiary); }
  .src { color: var(--color-orange-ink); text-underline-offset: 3px; text-decoration-color: color-mix(in srgb, var(--color-orange-ink) 40%, transparent); }
  .src:hover { text-decoration-color: currentColor; }

  /* ── Pick ── */
  .picks { list-style: none; border-top: 1px solid var(--color-border); }
  .picks li {
    display: grid; grid-template-columns: minmax(0, 15rem) minmax(0, 1fr); gap: 32px;
    padding: 20px 0; border-bottom: 1px solid var(--color-border);
  }
  .p-name { font-weight: 700; font-size: 1.05rem; line-height: 1.4; }
  .picks p { color: var(--text-secondary); max-width: 62ch; }
  .pick-orca .p-name { font-family: var(--font-mono); color: var(--color-orange-ink); }
  .pick-orca p { color: var(--text-primary); }

  /* ── Local or managed ── */
  .choice-section { background: var(--color-surface); }
  .choice { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; background: var(--color-bg); }
  .opt { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 32px; }
  .opt + .opt { border-left: 1px solid var(--color-border); }
  .opt-managed { background: var(--tint-orange); }
  .opt-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; align-self: stretch; }
  .opt h3 { font-size: var(--text-xl); margin-top: 4px; }
  .opt p { color: var(--text-secondary); max-width: 44ch; flex: 1; }
  .opt .btn { margin-top: 8px; }

  /* ── Sources ── */
  .srcs { border-top: 1px solid var(--color-border); }
  .srcs > div { display: grid; grid-template-columns: minmax(0, 15rem) minmax(0, 1fr); gap: 32px; padding: 16px 0; border-bottom: 1px solid var(--color-border); }
  .srcs dt { font-weight: 600; }
  .srcs dd { font-size: 0.92rem; color: var(--text-secondary); overflow-wrap: anywhere; }

  @media (max-width: 899px) {
    .matrix-wrap, .pick-section { display: none; }
    .cards { display: block; }
  }
  @media (max-width: 768px) {
    .head { padding: 32px 0 28px; }
    .herdr { margin-top: 20px; padding: 14px; gap: 12px; font-size: 0.92rem; }
    .matrix-section { padding-top: 28px; }
    .legend { gap: 8px 16px; font-size: 0.82rem; }
    .choice { grid-template-columns: 1fr; }
    .opt { padding: 22px 18px; }
    .opt + .opt { border-left: 0; border-top: 1px solid var(--color-border); }
    .opt p { font-size: 0.95rem; }
    .srcs > div { grid-template-columns: 1fr; gap: 4px; padding: 14px 0; }
  }
</style>
