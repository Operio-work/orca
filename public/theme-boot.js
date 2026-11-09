// Runs before first paint: pick the Operio v3 theme (saved choice, else the system's).
(function () {
  var t = null;
  try { t = localStorage.getItem('herdr-theme'); } catch (e) { /* private mode */ }
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  var term = null;
  try { term = localStorage.getItem('orca-term'); } catch (e) { /* private mode */ }
  if (term === 'light' || term === 'dark') document.documentElement.dataset.term = term;
})();
