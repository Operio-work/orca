<script>
  // A shell command with a copy button. The command is plain selectable text without JS.
  import Icon from './Icon.svelte';

  /** @type {{ cmd: string, strings: { copy: string, copied: string, label: string, done: string }, size?: 'lg' | 'md', prompt?: boolean }} */
  let { cmd, strings, size = 'md', prompt = true } = $props();

  let copied = $state(false);
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;

  async function copy() {
    try {
      await navigator.clipboard.writeText(cmd);
    } catch {
      // Older browsers or a non-secure context: fall back to a hidden textarea.
      const ta = document.createElement('textarea');
      ta.value = cmd;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* the text stays selectable */ }
      ta.remove();
    }
    copied = true;
    clearTimeout(timer);
    timer = setTimeout(() => (copied = false), 1800);
  }
</script>

<div class="cmd" class:lg={size === 'lg'}>
  <pre><code>{#each cmd.split('\n') as line, i}{#if i > 0}{'\n'}{/if}{#if prompt}<span class="prompt" aria-hidden="true">$ </span>{/if}{#each line.split(/(?<=\/)/) as part}{part}<wbr />{/each}{/each}</code></pre>
  <button type="button" class="copy" onclick={copy} aria-label={copied ? strings.copied : strings.label} data-copied={copied}>
    <span class="icons" aria-hidden="true">
      <span class="ic ic-copy"><Icon name="copy" size={16} /></span>
      <span class="ic ic-check"><Icon name="check" size={16} /></span>
    </span>
    <span class="copy-text">{copied ? strings.copied : strings.copy}</span>
  </button>
  <span class="visually-hidden" aria-live="polite">{copied ? strings.done : ''}</span>
</div>

<style>
  :global(html:not(.js)) .copy { display: none; }
  .cmd {
    display: flex; align-items: center; gap: 8px;
    background: var(--cmd-bg);
    border: 1px solid var(--cmd-border);
    border-radius: var(--radius-lg);
    padding: 6px 6px 6px 16px;
    min-width: 0;
  }
  pre {
    flex: 1; min-width: 0;
    overflow-x: auto;
    scrollbar-width: thin;
    padding: 8px 0;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.86rem;
    color: var(--cmd-text);
    white-space: pre-wrap;
    overflow-wrap: break-word;
    line-height: 1.55;
  }
  .lg code { font-size: 0.95rem; }
  .lg { padding: 8px 8px 8px 20px; }
  .prompt { color: var(--color-orange); user-select: none; }
  pre::selection, code::selection { background: var(--color-orange); color: var(--on-orange); }

  .copy {
    flex-shrink: 0;
    display: inline-flex; align-items: center; gap: 7px;
    min-height: 40px; padding: 0 14px;
    border-radius: var(--radius);
    border: 1px solid var(--cmd-border);
    background: rgba(255, 255, 255, 0.04);
    color: var(--cmd-text);
    font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
    cursor: pointer;
    transition: background-color var(--dur-fast) ease, border-color var(--dur-fast) ease, transform 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  .copy:active { transform: scale(0.97); }
  .copy[data-copied='true'] { border-color: color-mix(in srgb, var(--color-green) 50%, var(--cmd-border)); }
  @media (hover: hover) and (pointer: fine) {
    .copy:hover { background: rgba(255, 255, 255, 0.09); border-color: var(--color-orange-dim); }
  }

  /* Icon swap: crossfade with a touch of blur and scale so it reads as one morph. */
  .icons { position: relative; width: 16px; height: 16px; }
  .ic {
    position: absolute; inset: 0;
    display: grid; place-items: center;
    transition: opacity 200ms var(--ease-out), transform 200ms var(--ease-out), filter 200ms var(--ease-out);
  }
  .ic-copy { color: var(--color-orange); }
  .ic-check { color: var(--color-green); opacity: 0; transform: scale(0.6); filter: blur(2px); }
  [data-copied='true'] .ic-copy { opacity: 0; transform: scale(0.6); filter: blur(2px); }
  [data-copied='true'] .ic-check { opacity: 1; transform: scale(1); filter: blur(0); }

  @media (max-width: 480px) {
    .copy-text { display: none; }
    .copy { padding: 0 12px; }
    .cmd, .lg { padding-left: 14px; }
    code, .lg code { font-size: 0.8rem; }
  }
</style>
