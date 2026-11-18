'use strict';

// Web browser approvals: an agent wants to click, press Enter or send a form. One card per request,
// pinned above the agents, until the person holding that agent (or an admin) answers.
// Loaded after app.js and uses its globals (el, t, post, toast, errText, sfx). app.js calls
// window.OrcaBrowserAsks(list) on every refresh.

(() => {
  const box = el('section', 'bra-stack');
  box.id = 'browser-asks';
  box.setAttribute('aria-live', 'polite');
  box.hidden = true;
  document.body.append(box);
  let seen = new Set();
  const busy = new Set();

  function card(r) {
    const c = el('article', 'bra-card');
    c.dataset.id = r.id;
    const what = r.tool === 'click' ? t('braClick', r.real || r.element || '?')
      : r.tool === 'press_key' ? t('braKey', r.key || 'Enter')
      : r.tool === 'handle_dialog' ? t('braDialog')
      : t('braSubmit');
    const head = el('header', 'bra-head');
    head.append(el('strong', null, r.name), el('span', null, ' ' + what));
    c.append(head);
    const where = el('p', 'bra-url');
    where.append(el('span', 'bra-title', r.title || ''), el('code', null, r.url || '?'));
    c.append(where);
    // The agent describes the element itself; show the page's own label next to it when they differ.
    const label = (r.real || '').match(/"([^"]+)"/)?.[1] || r.real || '';
    if (r.tool === 'click' && r.element && r.real && !r.element.toLowerCase().includes(label.toLowerCase()))
      c.append(el('p', 'hint bra-diff', t('braDiff', r.element, r.real)));
    if (r.tool === 'click' && !r.real) c.append(el('p', 'hint bra-diff', t('braUnverified')));
    if (r.fields?.length) {
      const dl = el('dl', 'bra-fields');
      for (const f of r.fields) dl.append(el('dt', null, f.label), el('dd', f.hidden ? 'bra-hidden' : null, f.value || '—'));
      c.append(el('p', 'bra-sub', t('braFields')), dl);
    }
    if (r.hasShot) {
      const a = el('a', 'bra-shot');
      a.href = '/api/browser/shot?id=' + encodeURIComponent(r.id); a.target = '_blank'; a.rel = 'noopener';
      const img = el('img'); img.src = a.href; img.alt = t('braShotAlt'); img.loading = 'lazy';
      a.append(img); c.append(a);
    }
    const row = el('div', 'bra-actions');
    const no = el('button', 'btn', t('braDecline')); no.type = 'button';
    const yes = el('button', 'btn primary', t('braApprove')); yes.type = 'button';
    const answer = async what => {
      if (busy.has(r.id)) return;
      busy.add(r.id); yes.disabled = no.disabled = true;
      try { await post('/api/browser/' + what, { id: r.id }); toast(what === 'approve' ? t('braApproved') : t('braDeclined')); c.remove(); if (!box.children.length) box.hidden = true; }
      catch (err) { toast(errText(err), true); yes.disabled = no.disabled = false; }
      busy.delete(r.id);
    };
    no.addEventListener('click', () => answer('decline'));
    yes.addEventListener('click', () => answer('approve'));
    row.append(no, yes);
    c.append(row);
    return c;
  }

  window.OrcaBrowserAsks = list => {
    list = Array.isArray(list) ? list : [];
    const ids = new Set(list.map(r => r.id));
    if (list.some(r => !seen.has(r.id)) && seen.size + list.length > 0 && typeof sfx === 'function') sfx('needs');
    seen = ids;
    // Keep cards that are still pending (so a half-read card does not jump), add new ones.
    for (const c of [...box.children]) if (!ids.has(c.dataset.id)) c.remove();
    const have = new Set([...box.children].map(c => c.dataset.id));
    for (const r of list) if (!have.has(r.id)) box.append(card(r));
    box.hidden = !box.children.length;
  };

  const jump = () => { if (location.hash === '#browser') { history.replaceState(null, '', location.pathname); box.scrollIntoView({ block: 'start' }); box.querySelector('.btn.primary')?.focus(); } };
  addEventListener('hashchange', jump);
  setTimeout(jump, 800);
})();
