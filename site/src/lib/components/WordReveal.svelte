<script>
  // Big tagline whose words go from muted to full colour one at a time as they cross the middle of the screen.
  // One IntersectionObserver for all words; reduced motion shows the final colour at once.
  import { onMount } from 'svelte';

  /** @type {{ lines: string[], tag?: string }} */
  let { lines, tag = 'p' } = $props();
  /** @type {HTMLElement | undefined} */
  let root = $state();

  onMount(() => {
    if (!root) return;
    const words = [...root.querySelectorAll('.w')];
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') {
      words.forEach((w) => w.classList.add('on'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
      },
      // A thin trigger line a little below the middle of the screen.
      { rootMargin: '0px 0px -40% 0px', threshold: 1 }
    );
    words.forEach((w) => io.observe(w));
    return () => io.disconnect();
  });
</script>

<svelte:element this={tag} class="reveal-words" bind:this={root}>
  {#each lines as line, li}
    <span class="line">
      {#each line.split(' ') as word, wi}
        <span class="w">{word}</span>{wi < line.split(' ').length - 1 ? ' ' : ''}
      {/each}
    </span>{li < lines.length - 1 ? ' ' : ''}
  {/each}
</svelte:element>

<style>
  .reveal-words {
    max-width: 880px; margin: 0 auto;
    font-size: 3.75rem; line-height: 1; font-weight: 600; letter-spacing: -0.03em; text-wrap: balance;
    color: var(--text);
  }
  .line { display: block; }
  .line + .line { margin-top: 8px; }
  .w { opacity: 0.3; transition: opacity 600ms cubic-bezier(0.22, 1, 0.36, 1); }
  .w:global(.on) { opacity: 1; }
  @media (max-width: 640px) {
    .reveal-words { font-size: 2.25rem; line-height: 2.5rem; }
    .line + .line { margin-top: 0; }
  }
</style>
