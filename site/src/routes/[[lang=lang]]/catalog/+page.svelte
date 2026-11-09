<script>
  import Seo from '#lib/components/Seo.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { entries, VERTICALS } from '#lib/catalog.js';
  import { href } from '#lib/site.js';

  let { data } = $props();
  const lang = $derived(data.lang);
  const t = $derived(data.t);
  const c = $derived(t.catalog);
  const L = (/** @type {{en:string, es:string}} */ o) => o[lang === 'es' ? 'es' : 'en'];

  let vertical = $state('all');
  let tier = $state('all');

  /** Routines for "any business" count for every business type. */
  const matches = (/** @type {import('#lib/catalog.js').Entry} */ e) =>
    (tier === 'all' || e.tier === tier) &&
    (vertical === 'all' || e.verticals.includes(vertical) || e.verticals.includes('any'));
  const count = $derived(entries.filter(matches).length);

  const verticalOptions = $derived(['all', ...VERTICALS.filter((v) => v !== 'any')]);
  const tierOptions = ['all', 'free', 'managed'];
</script>

<Seo title={c.metaTitle} description={c.description} {lang} ogLocale={t.ogLocale} />

<section class="head circuit-bg">
  <div class="container">
    <h1>{c.title}</h1>
    <p class="lead">{c.lead}</p>
  </div>
</section>

<section class="container body">
  <div class="filters" role="group" aria-label={c.filterVertical + ', ' + c.filterTier}>
    <div class="fgroup">
      <span class="label" id="f-vertical">{c.filterVertical}</span>
      <div class="chips" role="group" aria-labelledby="f-vertical">
        {#each verticalOptions as v}
          <button type="button" class="chip" aria-pressed={vertical === v} onclick={() => (vertical = v)}>
            {v === 'all' ? c.all : t.verticals[v]}
          </button>
        {/each}
      </div>
    </div>
    <div class="fgroup">
      <span class="label" id="f-tier">{c.filterTier}</span>
      <div class="chips" role="group" aria-labelledby="f-tier">
        {#each tierOptions as v}
          <button type="button" class="chip" aria-pressed={tier === v} onclick={() => (tier = v)} data-tier={v}>
            {v === 'all' ? c.all : t.tier[v]}
          </button>
        {/each}
      </div>
    </div>
    <p class="count" aria-live="polite">{c.showing(count, entries.length)}</p>
  </div>

  <ul class="grid">
    {#each entries as e (e.id)}
      <li hidden={!matches(e)}>
        <a href={href(lang, `/catalog/${e.id}`)}>
          <span class="top">
            <span class="tier tier-{e.tier}">{t.tier[e.tier]}</span>
            <span class="verts">{e.verticals.map((v) => t.verticals[v]).join(' · ')}</span>
          </span>
          <h2>{L(e.name)}</h2>
          <p class="problem">{L(e.problem)}</p>
          <span class="when"><span class="label">{t.routine.when}</span> {L(e.trigger.summary)}</span>
          <span class="go" aria-hidden="true"><Icon name="arrow" size={18} /></span>
        </a>
      </li>
    {/each}
  </ul>
  {#if count === 0}
    <div class="empty">
      <p>{c.none}</p>
      <button type="button" class="btn btn-ghost" onclick={() => { vertical = 'all'; tier = 'all'; }}>{c.reset}</button>
    </div>
  {/if}
</section>

<style>
  .head { padding: 64px 0 48px; border-bottom: 1px solid var(--color-border); }
  .head .lead { margin-top: 16px; }
  .body { padding-top: 32px; padding-bottom: 96px; }

  .filters { display: flex; flex-wrap: wrap; gap: 20px 40px; align-items: flex-end; margin-bottom: 32px; }
  :global(html:not(.js)) .fgroup { display: none; }
  .fgroup { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    min-height: 40px; padding: 0 14px;
    border-radius: 999px; border: 1px solid var(--color-border);
    background: var(--color-surface); color: var(--text-secondary);
    font-size: 0.88rem; font-weight: 500; cursor: pointer;
    transition: background-color var(--dur-fast) ease, color var(--dur-fast) ease, border-color var(--dur-fast) ease, transform 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  .chip:active { transform: scale(0.97); }
  .chip[aria-pressed='true'] { background: var(--color-orange); border-color: var(--color-orange); color: var(--on-orange); font-weight: 600; }
  @media (hover: hover) and (pointer: fine) {
    .chip[aria-pressed='false']:hover { border-color: var(--color-orange-dim); color: var(--text-primary); }
  }
  .count { margin-left: auto; font-family: var(--font-mono); font-size: var(--text-sm); color: var(--text-tertiary); padding-bottom: 10px; }

  .grid { list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .grid li[hidden] { display: none; }
  .grid a {
    position: relative;
    display: flex; flex-direction: column; gap: 10px; height: 100%;
    padding: 22px 22px 20px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    text-decoration: none;
    transition: border-color var(--dur) ease, box-shadow var(--dur) ease;
  }
  .top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .verts { font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-tertiary); }
  h2 { font-size: 1.15rem; font-weight: 650; letter-spacing: -0.01em; margin-top: 4px; padding-right: 20px; }
  .problem { color: var(--text-secondary); font-size: 0.93rem; flex: 1; }
  .when { font-size: 0.85rem; color: var(--text-secondary); padding-top: 12px; border-top: 1px solid var(--color-border-dim); }
  .when .label { margin-right: 6px; font-size: 0.64rem; }
  .go { position: absolute; top: 22px; right: 20px; color: var(--text-tertiary); transition: transform var(--dur) var(--ease-out), color var(--dur-fast) ease; }
  @media (hover: hover) and (pointer: fine) {
    .grid a:hover { border-color: var(--color-orange-dim); box-shadow: 0 8px 28px -12px var(--glow-orange); }
    .grid a:hover .go { transform: translateX(3px); color: var(--color-orange-ink); }
  }

  .empty { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; padding: 32px 0; color: var(--text-secondary); }

  @media (max-width: 960px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 640px) {
    .head { padding: 40px 0 32px; }
    .grid { grid-template-columns: 1fr; gap: 12px; }
    .count { margin-left: 0; padding-bottom: 0; }
    .chips { flex-wrap: nowrap; overflow-x: auto; margin: 0 calc(var(--gutter) * -1); padding: 2px var(--gutter); scrollbar-width: none; }
    .chips::-webkit-scrollbar { display: none; }
    .chip { flex-shrink: 0; }
    .fgroup { width: 100%; }
  }
</style>
