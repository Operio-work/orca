'use strict';

// ORCA skills gallery — the dialog behind the Skills button in the header.
// Free panel: the open skills that come with ORCA; Install / Remove right here.
// ORCA Host: Operio's gallery for this business; an admin asks for one ("Request") and Operio
// reviews and installs it. The hosted panel never installs by itself.
// Loaded after app.js and uses its globals ($, call, post, t, el, toast, lang, errText).

(() => {
  const dialog = $('#skl-dialog');
  const btn = $('#skills-btn');
  const listEl = $('#skl-list');
  const emptyEl = $('#skl-empty');
  const introEl = $('#skl-intro');
  if (!dialog) return;

  let data = { mode: 'local', canRequest: false, items: [] };
  let busy = null; // key with a request in flight

  async function load() {
    try { data = await call('/api/skills?lang=' + lang); }
    catch (err) { toast(errText(err), true); }
  }

  function status(x) {
    if (x.installed) return { cls: 'on', text: t('skInstalled', x.installed.version) };
    const r = x.request;
    if (r?.status === 'pending') return { cls: 'wait', text: t('skRequested') };
    if (r?.status === 'rejected') return { cls: 'no', text: t('skRejected'), note: r.note };
    if (r?.status === 'failed') return { cls: 'no', text: t('skFailed'), note: r.note };
    return { cls: '', text: t('skAvailable') };
  }

  function actionBtn(x, label, cls, fn) {
    const b = el('button', 'btn ' + cls, label);
    b.type = 'button';
    b.disabled = busy === x.key;
    b.addEventListener('click', fn);
    return b;
  }

  function card(x) {
    const li = el('li', 'skl-card');
    const st = status(x);
    const head = el('div', 'skl-top');
    head.append(el('span', 'tpl-name', x.name), el('span', 'skl-status ' + st.cls, st.text));
    li.append(head, el('p', 'skl-sum', x.summary));
    if (st.note) li.append(el('p', 'skl-note', st.note));
    const foot = el('div', 'skl-foot');
    const tags = el('div', 'skl-tags');
    for (const tag of x.tags || []) tags.append(el('span', 'skl-tag', tag));
    foot.append(tags);
    if (data.mode === 'local') {
      foot.append(x.installed
        ? actionBtn(x, t('skRemove'), 'ghost', () => act('remove', x))
        : actionBtn(x, t('skInstall'), 'primary', () => act('install', x)));
    } else if (!x.installed && data.canRequest && x.request?.status !== 'pending') {
      foot.append(actionBtn(x, x.request ? t('skRequestAgain') : t('skRequest'), 'primary', () => request(x)));
    }
    li.append(foot);
    return li;
  }

  function render() {
    introEl.textContent = data.mode === 'hosted' ? (data.canRequest ? t('skIntroHosted') : t('skIntroHostedView')) : t('skIntroLocal');
    listEl.replaceChildren(...data.items.map(card));
    emptyEl.hidden = data.items.length > 0;
    emptyEl.textContent = data.mode === 'hosted' ? t('skNoneHosted') : t('skNone');
  }

  async function act(what, x) {
    busy = x.key;
    render();
    try {
      await post('/api/skills/' + what, { key: x.key });
      toast(t(what === 'install' ? 'skInstalledToast' : 'skRemovedToast', x.name));
    } catch (err) { toast(errText(err), true); }
    busy = null;
    await load();
    render();
  }

  // ORCA Host answers this one (it records the request for Operio and sends the gallery back).
  async function request(x) {
    busy = x.key;
    render();
    try {
      await post('/api/skills/request', { key: x.key });
      toast(t('skRequestedToast'));
    } catch (err) { toast(errText(err), true); }
    busy = null;
    await load();
    render();
  }

  async function open() {
    dialog.showModal();
    btn?.setAttribute('aria-expanded', 'true');
    await load();
    render();
  }
  function close() { if (dialog.open) dialog.close(); }

  dialog.addEventListener('close', () => btn?.setAttribute('aria-expanded', 'false'));
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); }); // backdrop
  btn?.addEventListener('click', open);
  $('#skl-close').addEventListener('click', close);
  const embed = orcaEmbeddable(dialog, dialog.querySelector('.tpl-wrap'), async () => { await load(); render(); });
  window.OrcaSkills = { open, mount: h => embed.mount(h), unmount: () => embed.unmount() };
})();
