<script>
  // A small ORCA board a visitor can use: answer an agent's question with one tap, then approve a routine's
  // draft. Fictional restaurant, nothing leaves the page.
  /** @type {{ s: any }} */
  let { s } = $props();

  let step = $state(0); // 0 = agent asks, 1 = routine draft waits, 2 = all done
  let notif = $state('');
  let answer = $state('');
  let busy = $state(false);

  // Tile states per step: [reservations, menu post, review replies]
  const TILE = [
    ['needs', 'working', 'waiting'],
    ['working', 'working', 'needs'],
    ['working', 'done', 'done'],
  ];
  const status = $derived(s.status[step]);

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  /** @param {string} msg */
  function show(msg) {
    notif = msg;
    clearTimeout(timer);
    timer = setTimeout(() => (notif = ''), 3200);
  }
  /** @param {string} [a] */
  function next(a) {
    if (busy) return;
    busy = true;
    if (a) answer = a;
    show(step === 0 ? s.notif[0].replace('{answer}', a ?? '') : s.notif[1]);
    setTimeout(() => {
      step += 1;
      busy = false;
    }, 450);
  }
  function again() {
    step = 0;
    answer = '';
    notif = '';
  }
</script>

<div class="demo" role="region" aria-label={s.label}>
  <div class="bar">
    <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="win">ORCA · 127.0.0.1:7171</span>
    <span class="tag">{s.demoTag}</span>
  </div>

  <ul class="tiles">
    {#each s.tiles as tile, i}
      {@const st = TILE[step][i]}
      <li class="tile {st}">
        <span class="t-name">{tile}</span>
        <span class="t-st"><span class="led" aria-hidden="true"></span>{s.states[st]}</span>
      </li>
    {/each}
  </ul>

  <div class="stage">
    {#key step}
      <article class="card" class:ok={step === 2}>
        {#if step === 0}
          <p class="from"><b>{s.tiles[0]}</b> · {s.asks}</p>
          <h4>{s.question}</h4>
          <p class="text">{s.context}</p>
          <div class="answers">
            {#each s.answers as a, i}
              <button class="ans" class:first={i === 0} onclick={() => next(a)} disabled={busy}>
                <span class="k" aria-hidden="true">{i + 1}</span>{a}
              </button>
            {/each}
          </div>
          <p class="hint">{s.hint}</p>
        {:else if step === 1}
          <p class="from"><b>{s.tiles[2]}</b> · {s.routine}</p>
          <h4>{s.draftTitle}</h4>
          <p class="text">{s.draft}</p>
          <div class="actions">
            <button class="approve pulse" onclick={() => next()} disabled={busy}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{s.approve}
            </button>
          </div>
        {:else}
          <p class="from"><b>{s.doneTag}</b></p>
          <h4>{s.doneTitle}</h4>
          <p class="text">{s.doneBody.replace('{answer}', answer)}</p>
          <div class="actions"><button class="ghost" onclick={again}>{s.again}</button></div>
        {/if}
      </article>
    {/key}

    <div class="phone" aria-hidden="true">
      <span class="notch"></span>
      {#if notif}
        <div class="notif"><span class="n-icon">O</span><span class="n-text"><b>ORCA</b>{notif}</span></div>
      {/if}
    </div>
  </div>
  <p class="visually-hidden" aria-live="polite">{status}</p>
</div>

<style>
  .demo {
    --e: cubic-bezier(0.22, 1, 0.36, 1);
    --panel: #181818; --panel-2: #1f1f1f; --line: #313131; --ink: #f2f2f2; --ink-2: #b4b4b4; --acc: var(--orange, #f5a623);
    position: relative; border-radius: 16px; border: 1px solid var(--line); background: var(--panel); color: var(--ink);
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.3); overflow: hidden; font-size: 0.875rem; line-height: 1.25rem; text-align: left;
  }
  .bar { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); background: #131313; }
  .dots { display: inline-flex; gap: 4px; }
  .dots i { width: 8px; height: 8px; border-radius: 9999px; background: #313131; }
  .win { flex: 1; font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.75rem; line-height: 1rem; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tag { padding: 2px 8px; border-radius: 9999px; border: 1px solid var(--line); font-size: 0.75rem; line-height: 1rem; color: var(--ink-2); }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0; padding: 16px 16px 0; list-style: none; }
  .tile { display: flex; flex-direction: column; gap: 4px; padding: 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel-2); transition: border-color 500ms var(--e), background-color 500ms var(--e); }
  .t-name { font-family: var(--font-mono, ui-monospace, monospace); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .t-st { display: inline-flex; align-items: center; gap: 8px; font-size: 0.75rem; line-height: 1rem; color: var(--ink-2); }
  .led { width: 8px; height: 8px; border-radius: 9999px; background: #6b6b6b; flex: none; transition: background-color 500ms var(--e); }
  .tile.working .led { background: #4aa3ff; }
  .tile.needs { border-color: #e5484d; background: #2a1718; }
  .tile.needs .led { background: #e5484d; animation: blink 1.6s var(--e) infinite; }
  .tile.done { border-color: #2f6f46; background: #142219; }
  .tile.done .led { background: #3dd68c; }
  @keyframes blink { 50% { opacity: 0.3; } }
  .stage { position: relative; display: grid; grid-template-columns: 1fr 156px; gap: 16px; padding: 16px; min-height: 290px; }
  .card { display: flex; flex-direction: column; padding: 16px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel-2); animation: rise 500ms var(--e) both; }
  .card.ok { border-color: #2f6f46; }
  @keyframes rise { from { opacity: 0; transform: translateY(16px); } }
  .from { font-size: 0.75rem; line-height: 1rem; color: var(--ink-2); }
  .from b { color: var(--acc); font-weight: 600; font-family: var(--font-mono, ui-monospace, monospace); }
  h4 { margin: 4px 0 0; font-size: 1rem; line-height: 1.5rem; font-weight: 600; text-wrap: balance; }
  .text { margin: 8px 0 0; color: var(--ink-2); text-wrap: pretty; }
  .answers { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
  button { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; cursor: pointer; font: inherit; font-size: 0.875rem; line-height: 1.25rem; font-weight: 600; transition: transform 300ms var(--e), background-color 300ms var(--e), border-color 300ms var(--e); }
  button:active { transform: scale(0.98); }
  button:focus-visible { outline: 2px solid var(--acc); outline-offset: 2px; }
  button:disabled { opacity: 0.6; cursor: default; }
  .ans { border: 1px solid var(--line); background: #131313; color: var(--ink); text-align: left; }
  .ans:hover { border-color: var(--acc); }
  .ans.first { border-color: var(--acc); }
  .k { display: inline-flex; width: 20px; height: 20px; flex: none; align-items: center; justify-content: center; border-radius: 4px; background: #313131; font-size: 0.75rem; line-height: 1rem; }
  .hint { margin: 8px 0 0; font-size: 0.75rem; line-height: 1rem; color: var(--acc); }
  .actions { display: flex; gap: 8px; margin-top: auto; padding-top: 16px; }
  .approve { border: 0; background: var(--acc); color: #111; }
  .approve svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  .pulse { animation: ring 2s var(--e) infinite; }
  @keyframes ring { 0% { box-shadow: 0 0 0 0 rgba(245, 166, 35, 0.6); } 70%, 100% { box-shadow: 0 0 0 12px rgba(245, 166, 35, 0); } }
  .ghost { border: 1px solid var(--line); background: transparent; color: var(--ink); }
  .ghost:hover { border-color: var(--acc); }
  .phone { position: relative; align-self: end; height: 240px; border-radius: 24px; border: 2px solid #313131; background: #000; overflow: hidden; }
  .notch { position: absolute; top: 8px; left: 50%; width: 40px; height: 8px; margin-left: -20px; border-radius: 9999px; background: #1f1f1f; }
  .notif { position: absolute; top: 24px; left: 8px; right: 8px; display: flex; gap: 8px; padding: 8px; border-radius: 12px; background: #272727; animation: drop 500ms var(--e) both; }
  @keyframes drop { from { opacity: 0; transform: translateY(-16px); } }
  .n-icon { flex: none; display: inline-flex; width: 20px; height: 20px; align-items: center; justify-content: center; border-radius: 4px; background: var(--acc); color: #111; font-size: 0.75rem; font-weight: 700; }
  .n-text { display: flex; flex-direction: column; font-size: 0.75rem; line-height: 1rem; color: var(--ink-2); }
  .n-text b { color: var(--ink); }
  @media (max-width: 640px) {
    .tiles { padding: 12px 12px 0; gap: 4px; }
    .tile { padding: 8px; }
    .stage { grid-template-columns: 1fr; padding: 12px; min-height: 0; }
    .phone { position: absolute; top: 0; left: 12px; right: 12px; height: auto; border: 0; background: none; overflow: visible; pointer-events: none; z-index: 1; }
    .notch { display: none; }
    .notif { top: 8px; left: 0; right: 0; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); }
  }
  @media (prefers-reduced-motion: reduce) {
    .card, .notif, .pulse, .tile.needs .led { animation: none; }
  }
</style>
