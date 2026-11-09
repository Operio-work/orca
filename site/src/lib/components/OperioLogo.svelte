<script>
  /**
   * The Operio logo (the raster from operio.work, never recolored). Its letters are dark grey,
   * so on the dark theme it sits on a light plate, like a sticker; on light it needs none.
   * Light theme: no plate and no padding, so the mark lines up with the text beside it.
   * @type {{ height?: number, alt?: string, class?: string }}
   */
  let { height = 22, alt = 'Operio', class: cls = '' } = $props();
  const width = $derived(Math.round((height * 546) / 141));
</script>

<span class="op-logo {cls}" style:--h="{height}px">
  <img src="/operio-logo.webp" {alt} {width} {height} decoding="async" />
</span>

<style>
  .op-logo {
    display: inline-flex; align-items: center; flex-shrink: 0;
    border-radius: calc(var(--h) * 0.32);
    line-height: 0;
  }
  .op-logo img { display: block; height: var(--h); width: auto; }

  :global([data-theme='dark']) .op-logo {
    padding: calc(var(--h) * 0.18) calc(var(--h) * 0.34);
    background: linear-gradient(180deg, #ECECEE, #D4D4D8);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 4px 12px -4px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .op-logo {
      padding: calc(var(--h) * 0.18) calc(var(--h) * 0.34);
    background: linear-gradient(180deg, #ECECEE, #D4D4D8);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 4px 12px -4px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }
  }
</style>
