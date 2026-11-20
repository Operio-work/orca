<script>
  import Seo from './Seo.svelte';
  import { legal } from '#lib/legal.js';

  /** @type {{ lang: string, t: any, kind: 'terms' | 'privacy' }} */
  let { lang, t, kind } = $props();
  const L = $derived(legal[lang === 'es' ? 'es' : 'en']);
  const d = $derived(L[kind]);
</script>

<Seo title={d.metaTitle} description={d.description} {lang} ogLocale={t.ogLocale} />

<article class="section legal">
  <div class="container narrow">
    <p class="eyebrow">{L.eyebrow}</p>
    <h1>{d.title}</h1>
    <p class="updated">{d.updated}</p>
    <div class="body">
      {@html d.intro}
      {#each d.sections as s}
        {#if s.part}
          <h2 class="part">{s.heading}</h2>
        {:else}
          <section>
            <h3>{s.heading}</h3>
            {@html s.html}
          </section>
        {/if}
      {/each}
      <section>
        <h3>{d.contactHeading}</h3>
        {@html d.contactHtml}
      </section>
    </div>
  </div>
</article>

<style>
  .narrow { max-width: 46rem; }
  .eyebrow {
    font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 600;
    letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--color-orange-ink);
  }
  h1 { margin-top: 8px; }
  .updated { margin-top: 8px; color: var(--text-tertiary); font-size: var(--text-sm); }
  .body { margin-top: 32px; display: grid; gap: 20px; color: var(--text-secondary); }
  .body :global(p) { max-width: 70ch; }
  .body :global(ul) { display: grid; gap: 8px; padding-left: 1.25rem; max-width: 70ch; }
  .body :global(strong) { color: var(--text-primary); }
  .body :global(a) { color: var(--color-orange-ink); }
  .body :global(code) { font-family: var(--font-mono); font-size: 0.92em; }
  .part {
    margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--color-border);
    font-size: 1.35rem; color: var(--text-primary);
  }
  section { display: grid; gap: 8px; }
  h3 { font-size: 1.05rem; font-weight: 650; color: var(--text-primary); }
</style>
