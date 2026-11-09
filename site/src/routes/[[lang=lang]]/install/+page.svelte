<script>
  import Seo from '#lib/components/Seo.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import CopyCommand from '#lib/components/CopyCommand.svelte';
  import { INSTALL_CMD, TALK_URL, GITHUB_URL } from '#lib/site.js';

  let { data } = $props();
  const lang = $derived(data.lang);
  const t = $derived(data.t);
  const i = $derived(t.install);

  const toc = $derived([
    ['requirements', i.reqTitle],
    ['install', i.installTitle],
    ['phone', i.phoneTitle],
    ['commands', i.commandsTitle],
    ['update', i.updateTitle],
    ['demo', i.demoTitle],
    ['uninstall', i.uninstallTitle]
  ]);
  const READ_FIRST = 'curl -fsSLo install.sh https://make.operio.work/install.sh\nless install.sh\nbash install.sh';
  const FROM_GIT = `git clone ${GITHUB_URL}\ncd free-orca && bash install.sh`;
</script>

<Seo title={i.metaTitle} description={i.description} {lang} ogLocale={t.ogLocale} />

<section class="head circuit-bg">
  <div class="container">
    <h1>{i.title}</h1>
    <p class="lead">{i.lead}</p>
    <div class="hero-cmd"><CopyCommand cmd={INSTALL_CMD} strings={t.copy} size="lg" /></div>
  </div>
</section>

<div class="container layout">
  <nav class="toc" aria-labelledby="toc-title">
    <p class="label" id="toc-title">{i.toc}</p>
    <ul>
      {#each toc as [id, label]}
        <li><a href="#{id}">{label}</a></li>
      {/each}
    </ul>
  </nav>

  <div class="doc">
    <section id="requirements">
      <h2>{i.reqTitle}</h2>
      <ul class="checks">
        {#each i.req as item}
          <li><span class="tick"><Icon name="check" size={16} /></span>{item}</li>
        {/each}
      </ul>
    </section>

    <section id="install">
      <h2>{i.installTitle}</h2>
      <CopyCommand cmd={INSTALL_CMD} strings={t.copy} />
      <p class="after">{i.installAfter} <a class="link" href="http://127.0.0.1:7171">http://127.0.0.1:7171</a></p>
      <h3>{i.installWhat}</h3>
      <ol class="steps-list">
        {#each i.installSteps as s}<li><span>{s}</span></li>{/each}
      </ol>
      <h3>{i.sourceTitle}</h3>
      <p>{i.sourceBody}</p>
      <div class="stack">
        <CopyCommand cmd={READ_FIRST} strings={t.copy} />
        <CopyCommand cmd={FROM_GIT} strings={t.copy} />
      </div>
    </section>

    <section id="phone">
      <h2>{i.phoneTitle}</h2>
      <p>{i.phoneBody}</p>
      <h3>{i.tailscaleTitle}</h3>
      <ol class="steps-list">
        <li>
          <div class="step-body">
            <span>{i.tailscaleSteps[0]}</span>
            <CopyCommand cmd="tailscale serve --bg 7171" strings={t.copy} />
          </div>
        </li>
        <li>
          <div class="step-body">
            <span>{i.tailscaleSteps[1]}</span>
            <CopyCommand cmd="FREE_ORCA_ALLOWED_HOSTS=<machine>.<tailnet>.ts.net" strings={t.copy} prompt={false} />
          </div>
        </li>
        <li>
          <div class="step-body">
            <span>{i.tailscaleSteps[2]}</span>
            <CopyCommand cmd="free-orca restart" strings={t.copy} />
          </div>
        </li>
      </ol>
      <p class="note">{i.tailscaleNote}</p>
      <h3>{i.sshTitle}</h3>
      <p>{i.sshBody}</p>
      <CopyCommand cmd="ssh -N -L 7171:127.0.0.1:7171 you@this-computer" strings={t.copy} />
      <p class="warn"><span class="warn-icon"><Icon name="alert" size={18} /></span>{i.phoneWarn}</p>
    </section>

    <section id="commands">
      <h2>{i.commandsTitle}</h2>
      <dl class="cmds">
        {#each i.commands as [cmd, what]}
          <div><dt><code>{cmd}</code></dt><dd>{what}</dd></div>
        {/each}
      </dl>
    </section>

    <section id="update">
      <h2>{i.updateTitle}</h2>
      <CopyCommand cmd="free-orca update" strings={t.copy} />
      <p>{i.updateBody}</p>
    </section>

    <section id="demo">
      <h2>{i.demoTitle}</h2>
      <p>{i.demoBody}</p>
      <dl class="cmds">
        {#each i.demoCmds as [cmd, what]}
          <div><dt><code>{cmd}</code></dt><dd>{what}</dd></div>
        {/each}
      </dl>
    </section>

    <section id="uninstall">
      <h2>{i.uninstallTitle}</h2>
      <CopyCommand cmd="free-orca uninstall" strings={t.copy} />
      <p>{i.uninstallBody}</p>
    </section>

    <section class="help" aria-labelledby="help">
      <h2 id="help">{i.helpTitle}</h2>
      <p>{i.helpBody}</p>
      <a class="btn btn-primary" href={TALK_URL}>{t.footer.talk} <span class="arrow"><Icon name="arrow" size={17} /></span></a>
    </section>
  </div>
</div>

<style>
  .head { padding: 64px 0 48px; border-bottom: 1px solid var(--color-border); }
  .head .lead { margin-top: 16px; }
  .hero-cmd { margin-top: 28px; max-width: 40rem; }

  .layout { display: grid; grid-template-columns: 13rem minmax(0, 1fr); gap: 64px; padding-top: 48px; padding-bottom: 96px; align-items: start; }
  .toc { position: sticky; top: calc(var(--nav-h) + 24px); }
  .toc ul { list-style: none; margin-top: 12px; border-left: 1px solid var(--color-border); }
  .toc a {
    display: block; padding: 6px 0 6px 14px; margin-left: -1px;
    border-left: 1px solid transparent;
    color: var(--text-secondary); text-decoration: none; font-size: 0.9rem;
    transition: color var(--dur-fast) ease, border-color var(--dur-fast) ease;
  }
  .toc a:hover { color: var(--text-primary); border-left-color: var(--color-orange); }

  .doc { max-width: 46rem; display: flex; flex-direction: column; gap: 56px; min-width: 0; }
  .doc section { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .doc h2 { font-size: var(--text-xl); }
  .doc h3 { font-size: 1.05rem; margin-top: 12px; }
  .doc p { color: var(--text-secondary); }
  .after { font-size: 0.95rem; }
  .stack { display: flex; flex-direction: column; gap: 10px; }
  .step-body { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .note { font-size: 0.92rem; }

  .checks { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .checks li { display: flex; gap: 12px; align-items: baseline; }
  .tick { color: var(--color-green-ink); transform: translateY(3px); flex-shrink: 0; }

  .warn {
    display: flex; gap: 12px; align-items: flex-start;
    padding: 16px 18px; border-radius: var(--radius-lg);
    border: 1px solid color-mix(in srgb, var(--color-red) 35%, var(--color-border));
    background: color-mix(in srgb, var(--color-red) 6%, var(--color-surface));
    color: var(--text-primary) !important; font-size: 0.95rem;
  }
  .warn-icon { color: var(--color-red-ink); flex-shrink: 0; display: grid; padding-top: 2px; }

  .cmds { border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); overflow: hidden; }
  .cmds > div { display: grid; grid-template-columns: minmax(0, 15rem) 1fr; gap: 16px; padding: 14px 18px; align-items: baseline; }
  .cmds > div + div { border-top: 1px solid var(--color-border-dim); }
  .cmds code { background: none; border: 0; padding: 0; font-size: 0.86rem; color: var(--text-primary); }
  .cmds dd { color: var(--text-secondary); font-size: 0.93rem; }

  .help { padding: 28px; border-radius: var(--radius-lg); background: var(--tint-orange); border: 1px solid color-mix(in srgb, var(--color-orange) 30%, var(--color-border)); align-items: flex-start; }

  @media (max-width: 860px) {
    .layout { grid-template-columns: 1fr; gap: 32px; padding-top: 32px; }
    .toc { position: static; }
    .toc ul { display: flex; flex-wrap: wrap; gap: 6px; border: 0; }
    .toc a { border: 1px solid var(--color-border); border-radius: 999px; padding: 6px 12px; margin: 0; font-size: 0.85rem; background: var(--color-surface); }
  }
  @media (max-width: 560px) {
    .head { padding: 40px 0 32px; }
    .cmds > div { grid-template-columns: 1fr; gap: 4px; }
    .help { padding: 20px; }
  }
</style>
