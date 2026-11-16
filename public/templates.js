'use strict';

// ORCA prompt templates — the picker behind the button in an agent's prompt box.
// Picking one only fills the prompt box (at the cursor); nothing is sent until you press Send.
// Scopes: Mine (personal), Company (admins edit), Operio library (read-only). The free panel
// shows Mine only. Loaded after app.js and uses its globals ($, call, post, t, el, toast,
// lang, selected, drafts, promptEl, autoGrow, errText).

(() => {
  const dialog = $('#tpl-dialog');
  const listEl = $('#tpl-list');
  const emptyEl = $('#tpl-empty');
  const tabsEl = $('#tpl-tabs');
  const searchEl = $('#tpl-search');
  const form = $('#tpl-form');
  const btn = $('#tpl-btn');
  if (!dialog || !btn) return;

  let data = { personal: [], company: [], operio: [], scopes: ['personal'], canEditCompany: false };
  let tab = 'personal';
  let editing = null;      // { id?, scope } while the form is open
  let confirmDel = null;   // id waiting for "Yes, delete"
  let caret = null;        // prompt selection when the picker opened

  async function load() {
    try { data = await call('/api/templates?lang=' + lang); }
    catch (err) { toast(errText(err), true); }
    if (!data.scopes.includes(tab)) tab = 'personal';
  }

  function renderTabs() {
    tabsEl.hidden = data.scopes.length < 2;
    tabsEl.replaceChildren(...data.scopes.map(s => {
      const b = el('button', 'tpl-tab', t('tpl_' + s));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(s === tab));
      const n = (data[s] || []).length;
      if (n) b.append(el('span', 'tpl-n', String(n)));
      b.addEventListener('click', () => { tab = s; confirmDel = null; render(); });
      return b;
    }));
  }

  function render() {
    renderTabs();
    const q = searchEl.value.trim().toLowerCase();
    // Search looks across every scope; without a query, only the open tab.
    const rows = q
      ? data.scopes.flatMap(s => data[s] || []).filter(x => (x.title + '\n' + x.body).toLowerCase().includes(q))
      : data[tab] || [];
    listEl.replaceChildren(...rows.map(row));
    emptyEl.hidden = rows.length > 0;
    emptyEl.textContent = q ? t('tplNoMatch') : t('tplNone_' + tab);
  }

  function row(x) {
    const li = el('li', 'tpl-row');
    const use = el('button', 'tpl-use');
    use.type = 'button';
    use.append(el('span', 'tpl-name', x.title), el('span', 'tpl-body', x.body));
    if (searchEl.value.trim() && x.scope !== tab) use.append(el('span', 'tpl-scope', t('tpl_' + x.scope)));
    if (x.scope === 'operio') use.title = t('tplReadOnly');
    use.addEventListener('click', () => fill(x.body));
    li.append(use);
    if (x.canEdit) {
      const acts = el('div', 'tpl-acts');
      if (confirmDel === x.id) {
        acts.append(el('span', 'tpl-sure', t('tplDeleteSure')));
        const yes = el('button', 'btn danger', t('tplYes'));
        yes.type = 'button';
        yes.addEventListener('click', () => remove(x));
        const no = el('button', 'btn', t('cancel'));
        no.type = 'button';
        no.addEventListener('click', () => { confirmDel = null; render(); });
        acts.append(no, yes);
      } else {
        const ed = el('button', 'btn ghost', t('tplEdit'));
        ed.type = 'button';
        ed.addEventListener('click', () => openForm(x));
        const del = el('button', 'btn ghost', t('tplDelete'));
        del.type = 'button';
        del.addEventListener('click', () => { confirmDel = x.id; render(); });
        acts.append(ed, del);
      }
      li.append(acts);
    }
    return li;
  }

  // Insert at the cursor the prompt had when the picker opened, then select the first {…}.
  function fill(text) {
    const v = promptEl.value;
    const [a, b] = caret || [v.length, v.length];
    const before = v.slice(0, a), after = v.slice(b);
    const pad = before && !/\s$/.test(before) ? '\n' : '';
    promptEl.value = before + pad + text + after;
    if (selected) drafts.set(selected, promptEl.value);
    close();
    autoGrow();
    promptEl.focus();
    const start = (before + pad).length;
    const m = /\{[^{}\n]{1,40}\}/.exec(text);
    if (m) promptEl.setSelectionRange(start + m.index, start + m.index + m[0].length);
    else promptEl.setSelectionRange(start + text.length, start + text.length);
    toast(t('tplFilled'));
  }

  function openForm(x) {
    const scopes = ['personal', ...(data.canEditCompany ? ['company'] : [])];
    editing = x ? { id: x.id, scope: x.scope } : { scope: data.canEditCompany && tab === 'company' ? 'company' : 'personal' };
    form.title.value = x ? x.title : '';
    // New from a written prompt: keep what was typed as the text.
    form.body.value = x ? x.body : promptEl.value.trim();
    const sel = form.scope;
    sel.replaceChildren(...scopes.map(s => { const o = el('option', '', t(s === 'personal' ? 'tplScopeMine' : 'tplScopeCompany')); o.value = s; return o; }));
    sel.value = editing.scope;
    sel.disabled = !!x; // moving a template between scopes = make a new one
    $('#tpl-scope-row').hidden = scopes.length < 2;
    form.hidden = false;
    listEl.hidden = emptyEl.hidden = tabsEl.hidden = searchEl.hidden = true;
    form.title.focus();
  }

  function closeForm() {
    editing = null;
    form.hidden = true;
    listEl.hidden = searchEl.hidden = false;
    render();
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!editing) return;
    const save = form.querySelector('[type="submit"]');
    save.disabled = true;
    try {
      const r = await post('/api/templates', { id: editing.id || undefined, scope: editing.id ? editing.scope : form.scope.value, title: form.title.value, body: form.body.value });
      toast(t('tplSaved'));
      tab = r.template.scope;
      await load();
      closeForm();
    } catch (err) { toast(errText(err), true); }
    finally { save.disabled = false; }
  });
  $('#tpl-cancel').addEventListener('click', closeForm);

  async function remove(x) {
    try {
      await post('/api/templates/delete', { id: x.id, scope: x.scope });
      toast(t('tplDeleted'));
      confirmDel = null;
      await load();
      render();
    } catch (err) { toast(errText(err), true); }
  }

  async function open() {
    caret = document.activeElement === promptEl || promptEl.value ? [promptEl.selectionStart, promptEl.selectionEnd] : null;
    searchEl.value = '';
    confirmDel = null;
    form.hidden = true;
    listEl.hidden = searchEl.hidden = false;
    dialog.showModal();
    btn.setAttribute('aria-expanded', 'true');
    await load();
    render();
    searchEl.focus();
  }
  function close() { if (dialog.open) dialog.close(); }

  dialog.addEventListener('close', () => { btn.setAttribute('aria-expanded', 'false'); editing = null; });
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); }); // backdrop
  btn.addEventListener('click', open);
  $('#tpl-close').addEventListener('click', close);
  $('#tpl-new').addEventListener('click', () => openForm(null));
  searchEl.addEventListener('input', () => { confirmDel = null; render(); });
  searchEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); listEl.querySelector('.tpl-use')?.click(); }
  });
  window.OrcaTemplates = { open: () => { if (btn.offsetParent !== null) open(); } };
})();
