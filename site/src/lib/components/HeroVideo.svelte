<script>
  // Click-to-play demo video. Before the click only the poster image loads (no <video> element
  // exists yet). The poster is always the 16:9 frame, so the phone hero stays short; phones in
  // portrait then play the 9:16 cut (with its own poster), everything else the 16:9 one.
  // Without JS the poster is a plain link to the mp4.
  import { tick } from 'svelte';

  /** @type {{ lang: string, s: { play: string, length: string, playLabel: string, label: string, close: string, captions: string, posterAlt: string } }} */
  // name: the files' prefix in /media; lazy: a video further down the page (no high-priority poster).
  let { lang, s, name = 'operio-orca', lazy = false } = $props();

  const PORTRAIT = '(max-width: 600px) and (orientation: portrait)';
  const base = $derived(`/media/${name}-${lang}`);

  let playing = $state(false);
  let cut = $state('16x9');
  /** @type {HTMLVideoElement | undefined} */
  let video = $state();
  /** @type {HTMLAnchorElement | undefined} */
  let trigger = $state();

  /** @param {MouseEvent} e */
  async function open(e) {
    e.preventDefault();
    cut = window.matchMedia(PORTRAIT).matches ? '9x16' : '16x9';
    playing = true;
    await tick();
    if (!video) return;
    video.focus({ preventScroll: true });
    // A blocked autoplay just leaves the controls showing; the visitor presses play.
    video.play().catch(() => {});
  }

  async function close() {
    video?.pause();
    playing = false;
    await tick();
    trigger?.focus({ preventScroll: true });
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (playing && e.key === 'Escape' && !document.fullscreenElement) {
      e.preventDefault();
      close();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="player" data-cut={playing ? cut : null} data-playing={playing || null}>
  {#if playing}
    <!-- svelte-ignore a11y_media_has_caption (the captions track is right below) -->
    <video
      bind:this={video}
      controls
      playsinline
      preload="none"
      poster="{base}-{cut}-poster.webp"
      aria-label={s.label}
      tabindex="-1"
      onended={close}
    >
      <source src="{base}-{cut}.mp4" type="video/mp4" />
      <track kind="captions" src="{base}-{cut}.vtt" srclang={lang} label={s.captions} />
    </video>
    <button type="button" class="close" onclick={close} aria-label={s.close}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
    </button>
  {:else}
    <a class="poster" href="{base}-16x9.mp4" onclick={open} bind:this={trigger} aria-label={s.playLabel}>
      <picture>
        <img src="{base}-16x9-poster.webp" width="1280" height="720" alt={s.posterAlt} fetchpriority={lazy ? 'auto' : 'high'} loading={lazy ? 'lazy' : 'eager'} />
      </picture>
      <span class="cue" aria-hidden="true">
        <span class="disc">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11.02-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" fill="currentColor" /></svg>
        </span>
        <span class="cue-text">{s.play}<span class="len">{s.length}</span></span>
      </span>
    </a>
  {/if}
</div>

<style>
  .player {
    position: relative;
    aspect-ratio: 16 / 9;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: #0A0A0A;
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-shot);
  }
  @media (max-width: 600px) and (orientation: portrait) {
    .player[data-cut='9x16'] {
      aspect-ratio: 9 / 16;
      /* Keep the tall cut inside one screen. */
      width: min(100%, calc(66svh * 9 / 16));
      margin-inline: auto;
    }
  }
  .player[data-cut='9x16'] { aspect-ratio: 9 / 16; }

  .poster { display: block; width: 100%; height: 100%; position: relative; color: inherit; text-decoration: none; cursor: pointer; }
  .poster:focus-visible { outline: none; }
  .poster:focus-visible .disc { box-shadow: 0 0 0 3px #0A0A0A, 0 0 0 5px var(--color-orange); }
  picture, img { display: block; width: 100%; height: 100%; }
  img { object-fit: cover; }

  /* Play cue: an orange disc and a dark label pill, bottom left, clear of the burned-in captions. */
  .cue {
    position: absolute; left: 20px; bottom: 20px;
    display: inline-flex; align-items: center; gap: 12px;
    padding: 6px 18px 6px 6px;
    border-radius: 999px;
    background: rgba(10, 10, 10, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #F0F0F0;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: transform 160ms var(--ease-out);
  }
  .disc {
    display: grid; place-items: center;
    width: 48px; height: 48px; border-radius: 50%;
    background: var(--color-orange); color: var(--on-orange);
    transition: background-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease;
  }
  .disc svg { transform: translateX(1px); }
  .cue-text { display: inline-flex; align-items: baseline; gap: 10px; font-weight: 600; font-size: 0.95rem; }
  .len { font-family: var(--font-mono); font-size: var(--text-xs); color: #A3A3A3; font-weight: 600; }
  .poster:active .cue { transform: scale(0.97); }
  @media (hover: hover) and (pointer: fine) {
    .poster:hover .disc { background: var(--color-orange-bright); box-shadow: 0 6px 24px -6px rgba(245, 166, 35, 0.6); }
  }

  video { display: block; width: 100%; height: 100%; background: #0A0A0A; object-fit: contain; }
  video:focus-visible { outline: 2px solid var(--color-orange); outline-offset: -2px; }

  .close {
    position: absolute; top: 12px; right: 12px;
    display: grid; place-items: center;
    width: 40px; height: 40px; border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(10, 10, 10, 0.78);
    color: #F0F0F0;
    cursor: pointer;
    transition: background-color var(--dur-fast) ease, transform 160ms var(--ease-out);
  }
  .close:active { transform: scale(0.95); }
  .close:focus-visible { outline: 2px solid var(--color-orange); outline-offset: 2px; }
  @media (hover: hover) and (pointer: fine) {
    .close:hover { background: rgba(40, 40, 40, 0.9); }
  }

  @media (max-width: 600px) {
    .cue { left: 12px; bottom: 12px; gap: 10px; padding-right: 14px; }
    .disc { width: 42px; height: 42px; }
  }
</style>
