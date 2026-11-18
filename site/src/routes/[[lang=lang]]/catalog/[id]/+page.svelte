<script>
  import Seo from '#lib/components/Seo.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import OperioLogo from '#lib/components/OperioLogo.svelte';
  import CopyCommand from '#lib/components/CopyCommand.svelte';
  import { cta, deskFiles, deskFolders, related, usesBrowser } from '#lib/catalog.js';
  import { href, INSTALL_CMD, TALK_URL } from '#lib/site.js';

  let { data } = $props();
  const lang = $derived(data.lang);
  const t = $derived(data.t);
  const r = $derived(t.routine);
  const e = $derived(data.entry);
  const L = (/** @type {{en:string, es:string}} */ o) => o[lang === 'es' ? 'es' : 'en'];
  const free = $derived(e.tier === 'free');
  const folders = $derived(deskFolders(e.pack));
  const files = $derived(deskFiles(e.pack));
  const browser = $derived(usesBrowser(e.pack));
  const more = $derived(related(e, 3));
</script>

<Seo
  title="{L(e.name)} · {r.metaSuffix}"
  description="{L(e.problem)} {L(e.outcome)}"
  {lang}
  ogLocale={t.ogLocale}
  type="article"
/>

<article>
  <header class="head circuit-bg">
    <div class="container">
      <a class="back" href={href(lang, '/catalog')}><Icon name="back" size={16} /> {r.backToCatalog}</a>
      <div class="badges">
        <span class="tier tier-{e.tier}">{free ? t.tier.freeLong : t.tier.managedLong}</span>
      </div>
      <h1>{L(e.name)}</h1>
      <p class="lead">{L(e.problem)}</p>
    </div>
  </header>

  <div class="container layout">
    <div class="main">
      <section aria-labelledby="outcome">
        <h2 id="outcome">{r.outcome}</h2>
        <p class="outcome">{L(e.outcome)}</p>
      </section>

      <section aria-labelledby="how">
        <h2 id="how">{r.how}</h2>
        <ol class="steps-list">
          {#each e.how[lang === 'es' ? 'es' : 'en'] as step}
            <li><span>{step}</span></li>
          {/each}
        </ol>
      </section>

      <dl class="facts">
        <div>
          <dt class="label">{r.when}</dt>
          <dd>{L(e.trigger.summary)}</dd>
        </div>
        <div>
          <dt class="label">{r.approval}</dt>
          <dd>{L(e.approval)}</dd>
        </div>
        <div>
          <dt class="label">{free ? (browser ? r.toolsLive : r.toolsFree) : r.toolsManaged}</dt>
          <dd class="tools">{#each e.tools as tool}<span>{r.toolNames[tool] || tool}</span>{/each}</dd>
        </div>
        <div>
          <dt class="label">{r.verticals}</dt>
          <dd>{e.verticals.map((v) => t.verticals[v]).join(', ')}</dd>
        </div>
      </dl>

      {#if e.upgrade}
        <section class="upgrade" aria-labelledby="upgrade">
          <h2 id="upgrade">{r.upgradeTitle}</h2>
          <p>{L(e.upgrade)}</p>
          <a class="btn btn-ghost" href={TALK_URL}>{L(cta)} <span class="arrow"><Icon name="arrow" size={17} /></span></a>
        </section>
      {/if}
    </div>

    <aside class="side">
      {#if free}
        <section class="box" aria-labelledby="run">
          <h2 id="run">{r.installTitle}</h2>
          <ol class="steps-list">
            <li>
              <div class="step-body">
                <span>{r.installSteps[0]}</span>
                <CopyCommand cmd={INSTALL_CMD} strings={t.copy} />
              </div>
            </li>
            {#if browser}
              <li>
                <div class="step-body">
                  <span>{r.installStepBrowser}</span>
                  <CopyCommand cmd="operio-orca browser on" strings={t.copy} />
                </div>
              </li>
            {/if}
            <li><span>{r.installSteps[1]} <strong>{L(e.name)}</strong>.</span></li>
            {#if files.length}
              <li>
                <span>{r.installStepFile}
                  {#each files as f, i}<code>{f}</code>{i < files.length - 1 ? ', ' : ''}{/each}.
                </span>
              </li>
            {/if}
            {#if folders.length}
              <li>
                <span>{r.installSteps[2]}
                  {#each folders as f, i}<code>{f}</code>{i < folders.length - 1 ? ', ' : ''}{/each}.
                  {e.trigger.kind === 'on-demand' ? r.installStepNoFolder : ''}
                </span>
              </li>
            {:else if !files.length}
              <li><span>{r.installStepNoFolder}</span></li>
            {/if}
          </ol>
          <a class="link guide" href={href(lang, '/install')}>{r.installGuide}</a>
        </section>
      {:else}
        <section class="box box-managed" aria-labelledby="run">
          <OperioLogo height={22} />
          <h2 id="run">{r.managedTitle}</h2>
          <p>{r.managedBody}</p>
          <a class="btn btn-primary" href={TALK_URL}>{L(cta)} <span class="arrow"><Icon name="arrow" size={17} /></span></a>
          <a class="link guide" href="{href(lang, '/')}#free">{r.managedFree}</a>
        </section>
      {/if}
    </aside>
  </div>

  <section class="related" aria-labelledby="related">
    <div class="container">
      <h2 id="related">{r.related}</h2>
      <ul>
        {#each more as m}
          <li>
            <a href={href(lang, `/catalog/${m.id}`)}>
              <span class="tier tier-{m.tier}">{t.tier[m.tier]}</span>
              <span class="r-name">{L(m.name)}</span>
              <span class="r-problem">{L(m.problem)}</span>
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </section>
</article>

<style>
  .head { padding: 40px 0 48px; border-bottom: 1px solid var(--color-border); }
  .back {
    display: inline-flex; align-items: center; gap: 6px; min-height: 40px;
    font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 600; letter-spacing: var(--tracking-label); text-transform: uppercase;
    color: var(--text-secondary); text-decoration: none;
    transition: color var(--dur-fast) ease;
  }
  .back:hover { color: var(--color-orange-ink); }
  .badges { margin: 20px 0 16px; }
  h1 { max-width: 22ch; font-size: clamp(2.1rem, 4.2vw, 3.2rem); }
  .head .lead { margin-top: 18px; max-width: 44rem; font-size: 1.25rem; }

  .layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 24rem); gap: 64px; padding-top: 56px; padding-bottom: 80px; align-items: start; }
  .main { display: flex; flex-direction: column; gap: 48px; min-width: 0; }
  .main h2 { font-size: var(--text-xl); margin-bottom: 16px; }
  .outcome { font-size: 1.12rem; line-height: 1.65; max-width: 62ch; }
  .steps-list li span { max-width: 60ch; }

  .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); overflow: hidden; }
  .facts > div { padding: 20px 22px; border-top: 1px solid var(--color-border-dim); }
  .facts > div:nth-child(-n + 2) { border-top: 0; }
  .facts > div:nth-child(odd) { border-right: 1px solid var(--color-border-dim); }
  .facts dt { margin-bottom: 8px; }
  .facts dd { color: var(--text-primary); line-height: 1.5; }
  .tools { display: flex; flex-wrap: wrap; gap: 6px; }
  .tools span { font-size: 0.85rem; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-surface-2); }

  .upgrade { padding: 28px; border-radius: var(--radius-lg); background: var(--tint-orange); border: 1px solid color-mix(in srgb, var(--color-orange) 30%, var(--color-border)); }
  .upgrade h2 { margin-bottom: 10px; }
  .upgrade p { color: var(--text-secondary); max-width: 60ch; margin-bottom: 20px; }

  .side { position: sticky; top: calc(var(--nav-h) + 24px); }
  .box { padding: 26px; border-radius: var(--radius-lg); border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card); }
  .box h2 { font-size: var(--text-lg); margin-bottom: 18px; }
  .box p { color: var(--text-secondary); margin-bottom: 20px; }
  .box .steps-list { gap: 16px; }
  .box .btn { width: 100%; }
  .step-body { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .box code { display: inline-block; max-width: 100%; overflow-wrap: anywhere; }
  .box-managed :global(.op-logo) { margin-bottom: 14px; }
  .box-managed { border-color: color-mix(in srgb, var(--color-orange) 45%, var(--color-border)); }
  .guide { display: inline-block; margin-top: 18px; font-size: 0.92rem; }

  .related { border-top: 1px solid var(--color-border); padding: 56px 0 80px; background: var(--color-surface); }
  .related h2 { font-size: var(--text-xl); margin-bottom: 24px; }
  .related ul { list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .related a {
    display: flex; flex-direction: column; align-items: flex-start; gap: 8px; height: 100%;
    padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--color-border); background: var(--color-bg);
    text-decoration: none; transition: border-color var(--dur) ease;
  }
  .related a:hover { border-color: var(--color-orange-dim); }
  .r-name { font-weight: 650; }
  .r-problem { color: var(--text-secondary); font-size: 0.9rem; }

  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; gap: 40px; padding-top: 40px; }
    .side { position: static; }
    .related ul { grid-template-columns: 1fr; }
  }
  @media (max-width: 560px) {
    .facts { grid-template-columns: 1fr; }
    .facts > div:nth-child(odd) { border-right: 0; }
    .facts > div:nth-child(2) { border-top: 1px solid var(--color-border-dim); }
    .head .lead { font-size: 1.1rem; }
    .box { padding: 20px; }
  }
</style>
