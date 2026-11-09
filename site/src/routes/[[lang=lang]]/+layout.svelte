<script>
  import Nav from '#lib/components/Nav.svelte';
  import Footer from '#lib/components/Footer.svelte';
  let { data, children } = $props();
</script>

<Nav lang={data.lang} t={data.t} />
<main id="main" tabindex="-1">
  {@render children()}
</main>
<Footer lang={data.lang} t={data.t} />

<style>
  main:focus { outline: none; }
</style>
