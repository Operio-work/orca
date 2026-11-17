'use strict';

// ORCA saved agents — the dialog behind the Agents button in the header.
// A saved agent = name + instructions + skills + tools. Start it (fresh) or Resume it (Claude: the
// last conversation). One live copy at a time. Admins create, edit and delete.
// Loaded after app.js and uses its globals ($, call, post, t, el, toast, lang, errText, KIND_LABEL, select).

(() => {
  const dialog = $('#ag-dialog');
  const btn = $('#agents-btn');
  if (!dialog || !btn) return;
  const listEl = $('#ag-list'), emptyEl = $('#ag-empty'), form = $('#ag-form'), newBtn = $('#ag-new'), introEl = $('#ag-intro');

  let data = { profiles: [], canEdit: false, kinds: [], models: {}, tools: [], skills: [] };
  let editing = null;   // profile being edited (null = list view; {} = new)
  let busy = null;      // profile id with a request in flight
  let sure = null;      // profile id whose Delete was tapped once

  async function load() {
    try { data = await call('/api/profiles'); } catch (err) { toast(errText(err), true); }
  }

  const modelName = m => m ? m.charAt(0).toUpperCase() + m.slice(1) : '';
  function sub(p) {
    const bits = [KIND_LABEL(p.kind)];
    if (p.model) bits.push(p.kind === 'ollama' ? p.model : modelName(p.model));
    if (p.account) bits.push((data.accounts.find(a => a.id === p.account)?.label) || t('accUnnamed'));
    if (p.skills.length) bits.push(t('agSkillsN', p.skills.length));
    if (p.tools.builtin !== 'default') bits.push(t('agTool_' + p.tools.builtin));
    bits.push(p.folder);
    if (p.type === 'worker') bits.unshift(t('agWorkerMin', p.worker.maxMinutes));
    if (p.reportsTo) bits.push('→ ' + p.reportsTo);
    if (p.spawn?.profiles.length) bits.push(t('agCanSpawn', p.spawn.profiles.join(', ')));
    const team = data.profiles.filter(x => x.reportsTo === p.id).map(x => x.id);
    if (team.length) bits.push(t('agLeadOf', team.join(', ')));
    return bits.join(' · ');
  }
  function status(p) {
    if (p.type === 'worker') return p.workers.length ? { cls: 'wait', text: t('agWorkersN', p.workers.length) } : { cls: '', text: t('agWorkerIdle') };
    if (!p.running) return { cls: '', text: t('agOff') };
    if (p.running.status === 'blocked') return { cls: 'no', text: t('agNeedsYou') };
    return p.running.status === 'working' ? { cls: 'wait', text: t('agWorking') } : { cls: 'on', text: t('agOn') };
  }
  function button(label, cls, fn, id) {
    const b = el('button', 'btn ' + cls, label);
    b.type = 'button';
    b.disabled = busy === id;
    b.addEventListener('click', fn);
    return b;
  }

  function card(p) {
    const li = el('li', 'skl-card ag-card');
    const st = status(p);
    const head = el('div', 'skl-top');
    head.append(el('span', 'tpl-name', p.label), el('span', 'skl-status ' + st.cls, st.text));
    li.append(head, el('p', 'skl-sum ag-sub', (p.label !== p.id ? p.id + ' · ' : '') + sub(p)));
    if (p.instructions) li.append(el('p', 'skl-note ag-instr', p.instructions));
    const foot = el('div', 'skl-foot ag-foot');
    if (data.canEdit) {
      foot.append(button(t('tplEdit'), 'ghost', () => edit(p), p.id));
      if (!p.running) foot.append(button(sure === p.id ? t('tplYes') : t('tplDelete'), sure === p.id ? 'danger' : 'ghost', () => del(p), p.id));
    }
    const go = el('div', 'ag-go');
    if (p.type === 'worker') {
      for (const w of p.workers) li.append(workerRow(w));
      if (tasking === p.id) li.append(taskForm(p));
      else go.append(button(t('agStartWorker'), 'primary', () => { tasking = p.id; render(); $('#ag-task')?.focus(); }, p.id));
    } else if (p.running) go.append(button(t('agOpen'), 'primary', () => { close(); select(p.running.pane); }, p.id));
    else {
      if (p.canResume && p.kind === 'claude') go.append(button(t('agResume'), 'ghost', () => start(p, true), p.id));
      go.append(button(t('start'), 'primary', () => start(p, false), p.id));
    }
    foot.append(go);
    li.append(foot);
    return li;
  }

  // A running worker: name, what it is on, time left, Open.
  function workerRow(w) {
    const r = el('div', 'ag-worker');
    const left = Math.max(0, Math.round((w.until - Date.now()) / 60e3));
    r.append(el('span', 'ag-wname', w.name), el('span', 'ag-wtask', w.task), el('span', 'ag-wleft', t('agMinLeft', left)));
    r.append(button(t('agOpen'), 'ghost', () => { close(); select(w.pane); }, null));
    return r;
  }
  let tasking = null; // worker setup whose "Start worker" form is open
  function taskForm(p) {
    const fm = el('form', 'ag-taskform');
    const ta = el('textarea');
    ta.id = 'ag-task'; ta.required = true; ta.maxLength = 4000; ta.rows = 4; ta.placeholder = t('agTaskPh');
    const lead = el('select');
    lead.append(new Option(t('agNoLeadWorker'), ''), ...data.leads.map(x => new Option(t('agReportTo', x.name), x.pane)));
    const go = el('button', 'btn primary', t('start'));
    const cancel = button(t('cancel'), 'ghost', () => { tasking = null; render(); }, null);
    const row = el('div', 'ag-go'); row.append(cancel, go);
    fm.append(ta, lead, row);
    fm.addEventListener('submit', async e => {
      e.preventDefault();
      go.disabled = true;
      toast(t('agStarting', p.label), false, 60000);
      try {
        const r = await post('/api/workers', { profile: p.id, task: ta.value, lead: lead.value || undefined });
        toast(t('agWorkerStarted', r.name));
        tasking = null;
        await load(); render();
      } catch (err) { toast(errText(err), true); go.disabled = false; }
    });
    return fm;
  }
  // A lead asked for a worker: whoever holds the lead (or an admin) approves or declines.
  function spawnRow(r) {
    const li = el('li', 'skl-card ag-spawn-req');
    li.append(el('div', 'tpl-name', t('agSpawnAsk', r.lead, r.profile)), el('p', 'skl-sum', r.task));
    const go = el('div', 'ag-go');
    if (r.canApprove) {
      go.append(button(t('agDecline'), 'ghost', () => decide(r, 'deny'), r.id), button(t('agApprove'), 'primary', () => decide(r, 'approve'), r.id));
    } else go.append(el('span', 'hint', t('agSpawnOther')));
    li.append(go);
    return li;
  }
  async function decide(r, what) {
    busy = r.id; render();
    try { const x = await post('/api/spawns/' + what, { id: r.id }); toast(what === 'approve' ? t('agWorkerStarted', x.name) : t('agDeclined')); }
    catch (err) { toast(errText(err), true); }
    busy = null;
    await load(); render();
  }

  function render() {
    const sp = $('#ag-spawns');
    sp.hidden = !!editing || !data.spawns?.length;
    if (!sp.hidden) sp.replaceChildren(...data.spawns.map(spawnRow));
    const inForm = !!editing;
    form.hidden = !inForm;
    listEl.hidden = inForm;
    introEl.hidden = inForm;
    newBtn.hidden = inForm || !data.canEdit;
    $('#ag-accounts').hidden = inForm || !data.canEdit;
    emptyEl.hidden = inForm || data.profiles.length > 0;
    emptyEl.textContent = data.canEdit ? t('agNone') : t('agNoneView');
    introEl.textContent = t('agIntro');
    if (!inForm) listEl.replaceChildren(...data.profiles.map(card));
  }

  async function start(p, resume) {
    busy = p.id; render();
    toast(t('agStarting', p.label), false, 60000);
    try {
      const r = await post('/api/profiles/start', { id: p.id, resume });
      toast(r.blocked ? t('agStartedBlocked', p.label) : t('agStarted', p.label));
      close();
      if (r.pane) setTimeout(() => select(r.pane), 400);
    } catch (err) { toast(errText(err), true); }
    busy = null;
    if (dialog.open) { await load(); render(); }
  }

  async function del(p) {
    if (sure !== p.id) { sure = p.id; render(); return; }
    busy = p.id; sure = null; render();
    try { await post('/api/profiles/delete', { id: p.id }); toast(t('agDeleted', p.label)); } catch (err) { toast(errText(err), true); }
    busy = null;
    await load(); render();
  }

  // ── Editor
  const f = name => form.elements[name];
  function fillModels(kind, value, account) {
    const models = data.models[kind] || [];
    f('model').replaceChildren(new Option(t('agModelDefault'), ''), ...models.map(m => new Option(kind === 'ollama' ? m : modelName(m), m)));
    f('model').value = models.includes(value) ? value : '';
    $('#ag-model-row').hidden = !models.length;
    $('#ag-kind-note').hidden = kind === 'claude';
    const accs = (data.accounts || []).filter(a => (a.kinds || [a.kind]).includes(kind));
    f('account').replaceChildren(...accs.map(a => new Option((a.id === 'default' ? (a.label ? a.label + ' · ' : '') + t('accDefault') : a.label) + (a.signedIn ? '' : ` (${t('accNeedsSignIn')})`), a.id)));
    f('account').value = accs.some(a => a.id === account) ? account : 'default';
    $('#ag-account-row').hidden = !(accs.length > 1 || (accs.length === 1 && accs[0].id !== 'default'));
    if (!accs.some(a => a.id === f('account').value) && accs[0]) f('account').value = accs[0].id;
  }
  function edit(p) {
    sure = null;
    editing = p || {};
    const isNew = !p;
    f('id').value = p?.id || '';
    f('id').disabled = !isNew;
    f('label').value = p?.label && p.label !== p.id ? p.label : '';
    f('kind').replaceChildren(...data.kinds.map(k => new Option(KIND_LABEL(k), k)));
    f('kind').value = p?.kind || (data.kinds.includes('claude') ? 'claude' : data.kinds[0]);
    fillModels(f('kind').value, p?.model || '', p?.account || 'default');
    f('folder').value = p?.folder || '~';
    f('instructions').value = p?.instructions || '';
    f('builtin').replaceChildren(...data.tools.map(k => new Option(t('agTool_' + k), k)));
    f('builtin').value = p?.tools?.builtin || 'default';
    toolHint();
    const mineMcp = new Set(p?.tools?.mcp || []);
    $('#ag-mcp').replaceChildren(...(data.mcp || []).map(x => {
      const lab = el('label', 'ag-skill');
      const cb = el('input');
      cb.type = 'checkbox'; cb.name = 'mcp'; cb.value = x.id; cb.checked = mineMcp.has(x.id);
      lab.append(cb, el('span', null, x.name + (x.ready ? '' : ' ⚠')));
      return lab;
    }));
    f('mcpOnly').checked = !!p?.tools?.mcpOnly;
    $('#ag-mcp-hint').textContent = (data.mcp || []).length ? t('agMcpHint') : t('agMcpNone');
    // Reports to: only agents that report to no one; none at all when others report to this one.
    const team = isNew ? [] : data.profiles.filter(x => x.reportsTo === p.id).map(x => x.id);
    const leads = data.profiles.filter(x => !x.reportsTo && x.type !== 'worker' && x.id !== p?.id);
    f('reportsTo').replaceChildren(new Option(t('agNoLead'), ''), ...leads.map(x => new Option(x.label + (x.label !== x.id ? ` (${x.id})` : ''), x.id)));
    f('reportsTo').value = p?.reportsTo && leads.some(x => x.id === p.reportsTo) ? p.reportsTo : '';
    f('reportsTo').disabled = team.length > 0;
    f('type').value = p?.type || 'agent';
    f('type').disabled = !isNew && (team.length > 0 || !!p?.spawn?.profiles.length);
    f('minutes').value = p?.worker?.maxMinutes || 120;
    const workers = data.profiles.filter(x => x.type === 'worker' && x.id !== p?.id);
    const can = new Set(p?.spawn?.profiles || []);
    $('#ag-spawn').replaceChildren(...workers.map(w => {
      const lab = el('label', 'ag-skill');
      const cb = el('input');
      cb.type = 'checkbox'; cb.name = 'spawnp'; cb.value = w.id; cb.checked = can.has(w.id);
      lab.append(cb, el('span', null, w.label));
      return lab;
    }));
    $('#ag-spawn-none').hidden = workers.length > 0;
    f('spawnMax').value = String(p?.spawn?.max || 2);
    typeRows();
    $('#ag-reports-hint').textContent = team.length ? t('agLeadsHint', team.join(', ')) : t('agReportsHint');
    const box = $('#ag-skills');
    const mine = new Set(p?.skills || []);
    box.replaceChildren(...data.skills.map(s => {
      const lab = el('label', 'ag-skill');
      const cb = el('input');
      cb.type = 'checkbox'; cb.name = 'skill'; cb.value = s.key; cb.checked = mine.has(s.key);
      lab.append(cb, el('span', null, s.name));
      return lab;
    }));
    $('#ag-skills-none').hidden = data.skills.length > 0;
    count();
    render();
    (isNew ? f('id') : f('instructions')).focus();
  }
  function count() { $('#ag-count').textContent = `${f('instructions').value.length} / 8000`; }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const isNew = !editing.id;
    const body = {
      id: isNew ? f('id').value.trim() : editing.id, create: isNew, rev: isNew ? undefined : editing.rev,
      label: f('label').value.trim(), kind: f('kind').value, model: f('model').value, account: f('account').value, folder: f('folder').value.trim(),
      instructions: f('instructions').value, tools: { builtin: f('builtin').value, mcp: [...form.querySelectorAll('input[name=mcp]:checked')].map(x => x.value), mcpOnly: f('mcpOnly').checked },
      skills: [...form.querySelectorAll('input[name=skill]:checked')].map(x => x.value),
      type: f('type').value, reportsTo: f('reportsTo').value || null, worker: { maxMinutes: Number(f('minutes').value) || 120 },
      spawn: { profiles: [...form.querySelectorAll('input[name=spawnp]:checked')].map(x => x.value), max: Number(f('spawnMax').value) },
    };
    const save = $('#ag-save');
    save.disabled = true;
    try {
      await post('/api/profiles', body);
      toast(t('agSaved', body.label || body.id));
      editing = null;
      await load();
      render();
    } catch (err) { toast(errText(err), true); }
    save.disabled = false;
  });
  f('kind').addEventListener('change', () => fillModels(f('kind').value, '', 'default'));
  // Workers have a time limit and never ask for workers; agents may.
  function typeRows() { const w = f('type').value === 'worker'; $('#ag-minutes-row').hidden = !w; $('#ag-spawn-row').hidden = w; }
  f('type').addEventListener('change', typeRows);
  const toolHint = () => { $('#ag-tools-hint').textContent = t('agToolHint_' + f('builtin').value); };
  f('builtin').addEventListener('change', toolHint);
  f('instructions').addEventListener('input', count);
  $('#ag-cancel').addEventListener('click', () => { editing = null; render(); });
  newBtn.addEventListener('click', () => edit(null));

  async function open() {
    editing = null; sure = null;
    dialog.showModal();
    btn.setAttribute('aria-expanded', 'true');
    await load();
    render();
  }
  function close() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('close', () => btn.setAttribute('aria-expanded', 'false'));
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
  btn.addEventListener('click', open);
  $('#ag-close').addEventListener('click', close);
  // ── Accounts: several logins per agent kind (admins)
  const accDialog = $('#acc-dialog'), accList = $('#acc-list'), accForm = $('#acc-form');
  let accData = [], accSure = null;
  async function accLoad() { try { accData = (await call('/api/accounts')).accounts; } catch (err) { toast(errText(err), true); } }
  function accRow(a) {
    const li = el('li', 'skl-card acc-card');
    const head = el('div', 'skl-top');
    head.append(el('span', 'tpl-name', `${a.key ? t('accGoogle') : KIND_LABEL(a.kind)} · ${a.id === 'default' ? (a.label ? a.label + ' · ' : '') + t('accDefault') : a.label}`),
      el('span', 'skl-status ' + (a.signedIn ? 'on' : 'wait'), a.signedIn == null ? '' : a.signedIn ? t('accSignedIn') : a.key ? t('accKeyMissing') : t('accNeedsSignIn')));
    li.append(head);
    if (a.key) {
      // API-key account: paste or replace the key (write-only; the page never gets it back).
      const kf = el('form', 'acc-keyform');
      const inp = el('input');
      inp.type = 'password'; inp.name = 'key'; inp.autocomplete = 'off'; inp.placeholder = t('accKeyPh'); inp.required = true;
      const save = el('button', 'btn ' + (a.signedIn ? 'ghost' : 'primary'), a.signedIn ? t('accSetKey') : t('accSaveKey'));
      kf.append(inp, save);
      kf.addEventListener('submit', async e => {
        e.preventDefault();
        save.disabled = true;
        try { await post('/api/accounts/key', { id: a.id, key: inp.value }); inp.value = ''; toast(t('accKeySaved', a.label)); accOpen(); }
        catch (err) { toast(errText(err), true); save.disabled = false; }
      });
      if (!a.signedIn) li.append(el('p', 'hint acc-how', t('accKeyHow')));
      li.append(kf);
    } else if (a.login && (!a.signedIn || a.id !== 'default')) {
      const cmd = el('div', 'acc-cmd');
      const code = el('code', null, a.login);
      const copy = el('button', 'btn ghost', t('accCopy'));
      copy.type = 'button';
      copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(a.login.replace(/\s+\(then.*$/, '')); toast(t('accCopied')); } catch { /* no clipboard */ } });
      cmd.append(code, copy);
      li.append(el('p', 'hint acc-how', t('accSignIn')), cmd);
    }
    const foot = el('div', 'skl-foot');
    const ren = el('button', 'btn ghost', t('accRename'));
    ren.type = 'button';
    ren.addEventListener('click', () => {
      const v = prompt(t('accName'), a.label || '');
      if (v == null) return;
      post('/api/accounts/rename', { kind: a.kind, id: a.id, label: v }).then(accOpen, err => toast(errText(err), true));
    });
    foot.append(ren);
    if (a.id !== 'default') {
      const rm = el('button', 'btn ' + (accSure === a.id ? 'danger' : 'ghost'), accSure === a.id ? t('accRemoveSure') : t('accRemove'));
      rm.type = 'button';
      rm.addEventListener('click', async () => {
        if (accSure !== a.id) { accSure = a.id; accRender(); return; }
        accSure = null;
        try { await post('/api/accounts/delete', { id: a.id }); toast(t('accRemoved', a.label)); } catch (err) { toast(errText(err), true); }
        accOpen();
      });
      foot.append(rm);
    }
    li.append(foot);
    return li;
  }
  function accRender() { accList.replaceChildren(...accData.map(accRow)); }
  async function accOpen() {
    if (!accDialog.open) accDialog.showModal();
    await accLoad(); accRender();
    const keep = accForm.elements.kind.value;
    accForm.elements.kind.replaceChildren(...['claude', 'codex', 'gemini'].map(k => new Option(k === 'gemini' ? t('accGoogle') : KIND_LABEL(k), k)));
    if (keep) accForm.elements.kind.value = keep;
    keyField();
  }
  accForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const r = await post('/api/accounts', { kind: accForm.elements.kind.value, label: accForm.elements.label.value, key: accForm.elements.key.value || undefined });
      accForm.elements.key.value = '';
      toast(t('accAdded', r.account.label));
      accForm.elements.label.value = '';
    } catch (err) { toast(errText(err), true); }
    accOpen();
  });
  // Gemini and Antigravity accounts are API keys; Claude and Codex sign in with a browser.
  function keyField() { const k = accForm.elements.kind.value === 'gemini'; accForm.elements.key.hidden = !k; accForm.elements.key.required = k; $('#acc-key-how').hidden = !k; }
  accForm.elements.kind.addEventListener('change', keyField);
  $('#acc-close').addEventListener('click', () => accDialog.close());
  accDialog.addEventListener('click', e => { if (e.target === accDialog) accDialog.close(); });
  accDialog.addEventListener('close', async () => { if (dialog.open) { await load(); render(); } });
  $('#ag-accounts').addEventListener('click', accOpen);

  // The New dialog links here too (on phones it is the only way in: the header has no room).
  $('#new-saved')?.addEventListener('click', () => { $('#new-dialog')?.close(); open(); });
  // A push about a worker request opens this dialog.
  if (location.hash === '#spawn') { history.replaceState(null, '', location.pathname); setTimeout(open, 600); }
  addEventListener('hashchange', () => { if (location.hash === '#spawn') { history.replaceState(null, '', location.pathname); open(); } });
  window.OrcaAgents = { open, accounts: accOpen };
})();
