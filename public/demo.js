'use strict';

// ORCA — demo mode (`operio-orca demo` only). Adds a "Demo" badge and a switch between
// the two fictional businesses. In a normal install /api/demo answers { demo: false } and
// this file does nothing. Uses app.js's globals (T, t, lang, call, post, toast, errText, refresh).

(() => {
  Object.assign(T.en, { demoBadge: 'Demo', demoTip: 'Demo mode: fictional businesses and scripted agents. Nothing here is real.', demoClient: 'Business', demoSwitched: 'Now showing {0}' });
  Object.assign(T.es, { demoBadge: 'Demo', demoTip: 'Modo demo: negocios ficticios y agentes con guion. Nada aquí es real.', demoClient: 'Negocio', demoSwitched: 'Ahora ves {0}' });

  let info = null;
  let row = null;
  let badge = null;

  function label() {
    if (!row) return;
    badge.textContent = t('demoBadge');
    badge.title = t('demoTip');
    row.setAttribute('aria-label', t('demoClient'));
    for (const b of row.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.client === info.active));
  }

  async function pick(id) {
    if (!info || id === info.active) return;
    try {
      await post('/api/demo/client', { client: id });
      info.active = id;
      label();
      const c = info.clients.find(x => x.id === id);
      toast(t('demoSwitched', c ? c.name : id));
      if (typeof closeSheet === 'function') { try { closeSheet(); } catch { /* not open */ } }
      if (typeof refresh === 'function') await refresh();
      const rt = document.getElementById('routines-view');
      if (rt && !rt.hidden) document.getElementById('rt-reload')?.click();
    } catch (e) { toast(errText(e), true); }
  }

  async function init() {
    try { info = await call('/api/demo'); } catch { return; }
    if (!info?.demo) return;
    // The panel starts in the demo's language (`operio-orca demo --lang es`). Only when that
    // language changes: a viewer who switches with the EN/ES button keeps their choice.
    const seen = (() => { try { return localStorage.getItem('orca-demo-lang'); } catch { return null; } })();
    if (info.lang && info.lang !== seen) {
      try { localStorage.setItem('orca-demo-lang', info.lang); } catch { /* private mode */ }
      if (info.lang !== lang && T[info.lang]) document.getElementById('lang')?.click();
    }
    document.documentElement.classList.add('is-demo');
    document.title = 'ORCA · Demo';
    badge = document.createElement('span');
    badge.className = 'demo-badge';
    document.querySelector('.wordmark .wm')?.append(badge);

    row = document.createElement('div');
    row.className = 'demo-row';
    row.setAttribute('role', 'group');
    for (const c of info.clients) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'demo-client';
      b.dataset.client = c.id;
      b.textContent = c.name;
      b.addEventListener('click', () => pick(c.id));
      row.append(b);
    }
    document.querySelector('header.bar')?.append(row);
    label();
  }

  document.addEventListener('operio-orca:lang', label);
  init();
})();
