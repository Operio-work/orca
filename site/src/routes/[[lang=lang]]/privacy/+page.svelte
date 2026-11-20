<script>
  import LegalPage from '#lib/components/LegalPage.svelte';
  let { data } = $props();
</script>

<LegalPage lang={data.lang} t={data.t} kind="privacy" />
