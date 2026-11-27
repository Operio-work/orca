<script>
  // A terminal that types the install line when it scrolls into view and prints an abridged copy of what
  // install.sh really says, then a board appears. The version comes from package.json, so it never drifts.
  import { onMount } from 'svelte';
  import pkg from '../../../../package.json';
  import { INSTALL_CMD } from '#lib/site.js';

  /** @type {{ s: any }} */
  let { s } = $props();
  const V = pkg.version;

  const LINES = $derived([
    `operio-orca: downloading the panel ${V}`,
    `operio-orca: panel ${V} verified (sha256)`,
    `operio-orca: installing the panel's one dependency (npm ci)`,
    `operio-orca: service enabled and started`,
    ``,
    `  ORCA ${V} is installed.`,
    `  Open:      http://127.0.0.1:7171`,
  ]);

  let typed = $state('');
  let shown = $state(0);
  let board = $state(false);
  /** @type {HTMLElement | undefined} */
  let root = $state();

  onMount(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      typed = INSTALL_CMD;
      shown = LINES.length;
      board = true;
      return;
    }
    /** @type {ReturnType<typeof setTimeout>[]} */
    const timers = [];
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        let t = 300;
        for (let i = 1; i <= INSTALL_CMD.length; i++) {
          timers.push(setTimeout(() => (typed = INSTALL_CMD.slice(0, i)), t));
          t += 28;
        }
        t += 400;
        for (let i = 1; i <= LINES.length; i++) {
          timers.push(setTimeout(() => (shown = i), t));
          t += i === 1 ? 700 : 380;
        }
        timers.push(setTimeout(() => (board = true), t + 300));
      },
      { threshold: 0.5 }
    );
    if (root) io.observe(root);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  });
</script>

<div class="term-wrap" bind:this={root}>
  <div class="term" role="img" aria-label={s.label}>
    <div class="bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span>bash</span></div>
    <pre><span class="p">$</span> {typed}<span class="caret" class:off={shown > 0}></span>{#each LINES.slice(0, shown) as line}
<span class:ok={line.startsWith('  ')}>{line}</span>{/each}</pre>
  </div>
  <div class="board" class:on={board} aria-hidden="true">
    <div class="b-bar"><span>127.0.0.1:7171</span><span class="b-ok">{s.ready}</span></div>
    <div class="b-tiles">
      {#each s.tiles as tile, i}
        <span class="b-tile" style={`--d:${i * 120}ms`}><b>{tile}</b><i><span class="led"></span>{s.working}</i></span>
      {/each}
    </div>
  </div>
</div>

<style>
  .term-wrap { position: relative; padding-bottom: 64px; }
  .term { border-radius: 12px; border: 1px solid var(--cmd-border, #313131); background: var(--cmd-bg, #131313); color: var(--cmd-text, #e6e6e6); overflow: hidden; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25); }
  .bar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--cmd-border, #313131); font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.75rem; line-height: 1rem; color: var(--cmd-dim, #8a8a8a); }
  .dots { display: inline-flex; gap: 4px; }
  .dots i { width: 8px; height: 8px; border-radius: 9999px; background: #313131; }
  pre { margin: 0; padding: 16px; min-height: 216px; font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.75rem; line-height: 1.25rem; white-space: pre-wrap; word-break: break-all; color: var(--cmd-dim, #a0a0a0); }
  .p { color: var(--orange, #f5a623); }
  pre > :global(span.ok) { color: #3dd68c; }
  .caret { display: inline-block; width: 8px; height: 14px; margin-left: 2px; vertical-align: -2px; background: var(--orange, #f5a623); animation: caret 1s steps(1) infinite; }
  .caret.off { display: none; }
  @keyframes caret { 50% { opacity: 0; } }
  .board {
    position: absolute; right: -8px; bottom: 0; width: 78%; padding: 12px; border-radius: 12px; border: 1px solid #313131; background: #181818; color: #f2f2f2;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.4); opacity: 0; transform: translateY(24px);
    transition: opacity 600ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .board.on { opacity: 1; transform: none; }
  .b-bar { display: flex; justify-content: space-between; gap: 8px; font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.75rem; line-height: 1rem; color: #b4b4b4; }
  .b-ok { color: #3dd68c; }
  .b-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
  .b-tile { display: flex; flex-direction: column; gap: 4px; padding: 8px; border-radius: 8px; border: 1px solid #313131; background: #1f1f1f; font-size: 0.75rem; line-height: 1rem; opacity: 0; transform: translateY(8px); transition: opacity 500ms cubic-bezier(0.22, 1, 0.36, 1) var(--d), transform 500ms cubic-bezier(0.22, 1, 0.36, 1) var(--d); }
  .board.on .b-tile { opacity: 1; transform: none; }
  .b-tile b { font-family: var(--font-mono, ui-monospace, monospace); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .b-tile i { display: inline-flex; align-items: center; gap: 4px; font-style: normal; color: #b4b4b4; }
  .led { width: 8px; height: 8px; border-radius: 9999px; background: #4aa3ff; }
  @media (max-width: 640px) {
    .term-wrap { padding-bottom: 0; }
    .board { position: relative; right: auto; bottom: auto; width: auto; margin: -16px 8px 0; }
  }
  @media (prefers-reduced-motion: reduce) { .caret { animation: none; } .board, .b-tile { transition: none; } }
</style>
