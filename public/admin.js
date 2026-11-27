'use strict';

// ORCA Admin — one page for everything an admin sets up. The same sections exist in every ORCA
// (SAMIX, open source, Hosted); the server says which ones this panel shows (/api/admin).
// People & access is edited here; the other sections open their managers.
// Loaded after app.js and uses its globals ($, call, post, t, el, toast, errText, access).

(() => {
  const dialog = $('#admin-dialog');
  const btn = $('#admin-btn');
  if (!dialog || !btn) return;
  const nav = $('#adm-nav'), body = $('#adm-body');
  // Grouped like the sidebar shows them. Sections a panel doesn't offer are left out (/api/admin).
  const GROUPS = [
    ['', ['overview']],
    ['admG_team', ['people', 'agents', 'accounts']],
    ['admG_work', ['tools', 'skills', 'knowledge', 'templates', 'routines']],
    ['admG_setup', ['keys', 'activity', 'security', 'shortcuts']],
  ];
  const ICON = { overview: 'i-map', people: 'i-team', agents: 'i-team', accounts: 'i-link', tools: 'i-gear', skills: 'i-skill', knowledge: 'i-book', templates: 'i-tpl', routines: 'i-clock', keys: 'i-key', activity: 'i-journal', security: 'i-power', shortcuts: 'i-kbd' };
  // These sections are the managers themselves (their dialog's content moves in here).
  const EMBED = {
    agents: () => window.OrcaAgents, accounts: () => window.OrcaAgents?.acc, skills: () => window.OrcaSkills,
    knowledge: () => window.OrcaKnowledge, templates: () => window.OrcaTemplates, routines: () => window.OrcaRoutines, keys: () => window.OrcaKeys,
  };
  let data = null, cur = null, draft = null, dirty = false, mounted = null;
  const has = s => s === 'overview' || (s === 'shortcuts' && !!window.OrcaShortcuts) || !!data?.sections[s];

  async function load() {
    try { data = await call('/api/admin'); } catch (err) { toast(errText(err), true); data = null; }
  }

  function renderNav() {
    const kids = [];
    for (const [g, list] of GROUPS) {
      const shown = list.filter(has);
      if (!shown.length) continue;
      if (g) kids.push(el('div', 'adm-group', t(g)));
      for (const s of shown) {
        const b = el('button', 'adm-tab');
        b.type = 'button';
        b.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#${ICON[s]}"/></svg>`;
        b.append(el('span', null, t('adm_' + s)));
        b.setAttribute('aria-current', String(s === cur));
        b.addEventListener('click', () => show(s));
        kids.push(b);
      }
    }
    nav.replaceChildren(...kids);
  }
  function unmount() { if (mounted) { try { mounted.unmount(); } catch { /* gone */ } mounted = null; } }
  function show(s) {
    if (cur === 'people' && dirty && s !== 'people' && !confirmLeave()) return;
    unmount();
    cur = s;
    renderNav();
    dialog.classList.toggle('in-section', true);
    body.scrollTop = 0;
    const api = EMBED[s]?.();
    if (api?.mount) {
      body.replaceChildren(el('h3', 'adm-h', t('adm_' + s)));
      body.classList.add('adm-embed');
      mounted = api;
      Promise.resolve(api.mount(body)).catch(err => toast(errText(err), true));
      return;
    }
    body.classList.remove('adm-embed');
    body.replaceChildren(el('h3', 'adm-h', t('adm_' + s)), ...(VIEWS[s]?.() || []));
  }
  function confirmLeave() { toast(t('admUnsaved'), true); return false; }

  const p = (cls, text) => el('p', cls, text);
  function action(label, fn, cls = 'primary') {
    const b = el('button', 'btn ' + cls, label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  const row = (...kids) => { const d = el('div', 'adm-actions'); d.append(...kids); return d; };
  const stat = (label, value, ok) => { const d = el('div', 'adm-stat'); d.append(el('span', 'adm-k', label), el('span', 'adm-v ' + (ok === true ? 'ok' : ok === false ? 'warn' : ''), value)); return d; };

  // ── People & access (edited here)
  function peopleView() {
    draft = draft || structuredClone(data.access);
    const out = [p('hint', t('admPeopleIntro'))];
    const sw = el('label', 'adm-switch');
    const cb = el('input');
    cb.type = 'checkbox'; cb.checked = draft.allowlist;
    cb.addEventListener('change', () => { draft.allowlist = cb.checked; dirty = true; show('people'); });
    sw.append(cb, el('span', null, t('admAllowlist')));
    out.push(sw, p('hint adm-state ' + (draft.allowlist ? 'ok' : 'warn'), draft.allowlist ? t('admAllowOn') : t('admAllowOff')));
    const list = el('ul', 'adm-people');
    draft.people.forEach((x, i) => list.append(personRow(x, i)));
    out.push(list);
    const add = el('form', 'adm-add');
    const inp = el('input');
    inp.type = 'email'; inp.required = true; inp.placeholder = t('admLoginPh'); inp.autocomplete = 'off'; inp.spellcheck = false;
    add.append(inp, el('button', 'btn', t('admAdd')));
    add.addEventListener('submit', e => {
      e.preventDefault();
      draft.people.push({ login: inp.value.trim().toLowerCase(), name: '', role: 'member', folders: [] });
      dirty = true; show('people');
    });
    out.push(add, p('hint', t('admRolesHint')));
    const save = action(t('save'), savePeople);
    save.disabled = !dirty;
    out.push(row(action(t('cancel'), () => { draft = null; dirty = false; show('people'); }, 'ghost'), save));
    return out;
  }
  function personRow(x, i) {
    const li = el('li', 'adm-person');
    const top = el('div', 'adm-ptop');
    const name = el('input');
    name.value = x.name; name.placeholder = t('admNamePh'); name.maxLength = 40; name.setAttribute('aria-label', t('name'));
    name.addEventListener('input', () => { x.name = name.value; markDirty(); });
    const role = el('select');
    role.append(new Option(t('admRoleAdmin'), 'admin'), new Option(t('admRoleMember'), 'member'));
    role.value = x.role;
    role.addEventListener('change', () => { x.role = role.value; dirty = true; show('people'); });
    const rm = el('button', 'icon-btn');
    rm.type = 'button'; rm.title = t('admRemove'); rm.setAttribute('aria-label', t('admRemove'));
    rm.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg>';
    rm.addEventListener('click', () => { draft.people.splice(i, 1); dirty = true; show('people'); });
    top.append(name, role, rm);
    li.append(top, el('div', 'adm-login', x.login + (x.login === data.me ? ' · ' + t('admYou') : '')));
    if (x.role === 'member') {
      const f = el('input');
      f.value = (x.folders || []).join(', '); f.placeholder = t('admFoldersPh'); f.setAttribute('aria-label', t('admFolders'));
      f.addEventListener('input', () => { x.folders = f.value.split(',').map(s => s.trim()).filter(Boolean); markDirty(); });
      li.append(f);
    }
    return li;
  }
  function markDirty() { if (!dirty) { dirty = true; const b = body.querySelector('.adm-actions .btn.primary'); if (b) b.disabled = false; } }
  async function savePeople() {
    try {
      await post('/api/admin/access', draft);
      toast(t('admSaved'));
      draft = null; dirty = false;
      await load(); show('people');
    } catch (err) { toast(errText(err), true); }
  }

  // ── Tools: MCP servers for saved agents + their secrets (values are write-only)
  let tdata = null;
  async function toolsView() {
    try { tdata = await call('/api/tools'); } catch (err) { toast(errText(err), true); return [p('hint', errText(err))]; }
    const out = [p('hint', t('admToolsIntro'))];
    if (data.edition === 'free') out.push(p('hint adm-state warn', t('admToolsFreeWarn')));
    if (tdata.browser) out.push(browserCard(tdata.browser));
    const ul = el('ul', 'adm-people');
    const own = tdata.tools.filter(x => x.id !== 'web-browser');
    for (const x of own) {
      const li = el('li', 'adm-person');
      const top = el('div', 'adm-ptop');
      top.append(el('span', 'tpl-name', `${x.name} · ${x.type === 'http' ? 'HTTP' : t('admToolLocal')}`),
        el('span', 'skl-status ' + (x.missing.length ? 'wait' : 'on'), x.missing.length ? t('admToolMissing', x.missing.join(', ')) : t('admToolReady')));
      const rm = el('button', 'icon-btn');
      rm.type = 'button'; rm.title = t('admRemove'); rm.setAttribute('aria-label', t('admRemove'));
      rm.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg>';
      rm.addEventListener('click', async () => { try { await post('/api/tools/delete', { id: x.id }); show('tools'); } catch (err) { toast(errText(err), true); } });
      top.append(rm);
      const used = tdata.usedBy[x.id] || [];
      li.append(top, el('div', 'adm-login', `${x.id} · ${x.type === 'http' ? x.url : [x.command, ...x.args].join(' ')}${used.length ? ' · ' + t('admToolUsedBy', used.join(', ')) : ''}`));
      ul.append(li);
    }
    if (own.length) out.push(ul); else out.push(p('hint', t('admToolNone')));
    // Add a server
    const fm = el('form', 'adm-toolform');
    const inp = (name, ph, type = 'text') => { const i = el('input'); i.name = name; i.placeholder = ph; i.type = type; i.autocomplete = 'off'; i.spellcheck = false; return i; };
    const ta = (name, ph) => { const x = el('textarea'); x.name = name; x.placeholder = ph; x.rows = 3; x.spellcheck = false; return x; };
    const type = el('select'); type.name = 'type'; type.append(new Option(t('admToolLocal'), 'stdio'), new Option('HTTP', 'http'));
    const local = el('div', 'adm-toolsub'), http = el('div', 'adm-toolsub');
    local.append(inp('command', t('admToolCmdPh')), ta('args', t('admToolArgsPh')), ta('env', t('admToolEnvPh')));
    http.append(inp('url', 'https://…/mcp'), ta('headers', t('admToolHeadPh')));
    const sync = () => { local.hidden = type.value !== 'stdio'; http.hidden = type.value !== 'http'; };
    type.addEventListener('change', sync); sync();
    const idI = inp('id', t('admToolIdPh')); idI.required = true; idI.pattern = '[a-z0-9][a-z0-9-]{0,39}';
    fm.append(el('h4', 'adm-sub', t('admToolAdd')), idI, inp('name', t('admToolNamePh')), type, local, http, p('hint', t('admToolSecretHint')));
    const lines = v => v.split('\n').map(s => s.trim()).filter(Boolean);
    const pairs = (v, sep) => Object.fromEntries(lines(v).map(l => { const i = l.indexOf(sep); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : null; }).filter(Boolean));
    fm.append(row(el('button', 'btn primary', t('save'))));
    fm.addEventListener('submit', async e => {
      e.preventDefault();
      const f = fm.elements;
      const body = { id: f.id.value.trim(), name: f.name.value.trim(), type: type.value,
        ...(type.value === 'stdio' ? { command: f.command.value.trim(), args: lines(f.args.value), env: pairs(f.env.value, '=') } : { url: f.url.value.trim(), headers: pairs(f.headers.value, ':') }) };
      try { await post('/api/tools', body); toast(t('admSaved2', body.name || body.id)); show('tools'); } catch (err) { toast(errText(err), true); }
    });
    out.push(fm);
    // Secrets: names only; set or clear
    const sec = el('div', 'adm-secrets');
    sec.append(el('h4', 'adm-sub', t('admSecrets')), p('hint', tdata.secrets.length ? t('admSecretsHave', tdata.secrets.join(', ')) : t('admSecretsNone')));
    const sf = el('form', 'adm-add');
    const sn = inp('name', t('admSecretNamePh')); sn.required = true; sn.pattern = '[A-Z_][A-Z0-9_]{0,63}';
    const sv = inp('value', t('admSecretValPh'), 'password');
    sf.append(sn, sv, el('button', 'btn', t('save')));
    sf.addEventListener('submit', async e => {
      e.preventDefault();
      try { await post('/api/tools/secret', { name: sn.value.trim(), value: sv.value }); sv.value = ''; toast(t('admSecretSaved', sn.value.trim())); show('tools'); }
      catch (err) { toast(errText(err), true); }
    });
    sec.append(sf, p('hint', t('admSecretHow')));
    out.push(sec);
    return out;
  }

  // The built-in Web browser: on/off and a test page. Turning it on installs the engine (can take a minute).
  function browserCard(b) {
    const box = el('div', 'adm-browser');
    const used = tdata.usedBy['web-browser'] || [];
    const broken = b.enabled && (!b.executableOk || !b.engineOk);
    const top = el('div', 'adm-ptop');
    top.append(el('span', 'tpl-name', t('admBrowser')),
      el('span', 'skl-status ' + (broken ? 'wait' : b.enabled ? 'on' : 'off'), broken ? t('admBrowserBroken') : b.enabled ? (b.level === 'forms' ? t('admBrowserOnForms') : t('admBrowserOn')) : t('admBrowserOff')));
    box.append(top, p('hint', t('admBrowserIntro')));
    if (b.enabled) box.append(el('div', 'adm-login', [b.executable, b.engine ? 'engine ' + b.engine : '', used.length ? t('admToolUsedBy', used.join(', ')) : t('admBrowserNoAgent'), b.inUse ? t('admBrowserInUse') : ''].filter(Boolean).join(' · ')));
    const outp = el('pre', 'adm-browser-out'); outp.hidden = true;
    const show2 = (text, ok) => { outp.hidden = false; outp.textContent = text; outp.classList.toggle('bad', !ok); };
    const act = el('button', 'btn' + (b.enabled ? '' : ' primary'), b.enabled ? t('admBrowserTurnOff') : t('admBrowserTurnOn'));
    act.type = 'button';
    act.addEventListener('click', async () => {
      act.disabled = true; act.textContent = b.enabled ? t('admBrowserTurningOff') : t('admBrowserTurningOn');
      try {
        const r = await post('/api/browser', { action: b.enabled ? 'off' : 'on' });
        if (r.ok) { toast(r.browser?.enabled ? t('admBrowserOn') : t('admBrowserOff')); show('tools'); }
        else { show2(r.output, false); act.disabled = false; act.textContent = b.enabled ? t('admBrowserTurnOff') : t('admBrowserTurnOn'); }
      } catch (err) { toast(errText(err), true); act.disabled = false; }
    });
    const row2 = el('div', 'adm-browser-row');
    row2.append(act);
    if (b.enabled && !broken) {
      const tf = el('form', 'adm-add');
      const u = el('input'); u.type = 'url'; u.name = 'url'; u.required = true; u.placeholder = 'https://example.com'; u.autocomplete = 'off'; u.spellcheck = false;
      const go = el('button', 'btn', t('admBrowserTest'));
      tf.append(u, go);
      tf.addEventListener('submit', async e => {
        e.preventDefault();
        go.disabled = true; show2(t('admBrowserTesting'), true);
        try { const r = await post('/api/browser', { action: 'test', url: u.value.trim() }); show2(r.output, r.ok); }
        catch (err) { show2(errText(err), false); }
        go.disabled = false;
      });
      row2.append(tf);
    }
    if (b.enabled && !broken) {
      const lab = el('label', 'ag-skill adm-browser-forms');
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = b.level === 'forms';
      cb.addEventListener('change', async () => {
        cb.disabled = true;
        try { await post('/api/browser', { action: 'forms', on: cb.checked }); show('tools'); }
        catch (err) { toast(errText(err), true); cb.checked = !cb.checked; cb.disabled = false; }
      });
      lab.append(cb, el('span', null, t('admBrowserForms')));
      box.append(lab);
    }
    box.append(row2, outp);
    return box;
  }

  const VIEWS = {
    tools: () => { const ph = [p('hint', '…')]; toolsView().then(v => { if (cur === 'tools') body.replaceChildren(el('h3', 'adm-h', t('adm_tools')), ...v); }); return ph; },
    people: peopleView,
    shortcuts: () => [p('hint', t('admShortcutsIntro')), window.OrcaShortcuts.list()],
    overview: overviewView,
    activity: () => [p('hint', t('admActivityIntro')), row(link(t('journal'), '/journal.html'))],
    // Each ORCA reports what applies to it: SAMIX the access list, sandbox and PIN; the others less.
    security: () => {
      const s = data.security, a = data.access, out = [];
      if (a) out.push(stat(t('admSecList'), a.single ? t('admSecSingle') : a.allowlist ? t('admSecOn', a.people.length) : t('admSecOffN', a.people.length), a.allowlist));
      else out.push(p('hint', data.edition === 'hosted' ? t('admSecHosted') : t('admSecFree')));
      if ('sandbox' in s) out.push(stat(t('admSecSandbox'), s.sandbox ? t('admYes') : t('admNo'), s.sandbox));
      if ('pin' in s) out.push(stat(t('admSecPin'), s.pin ? t('admYes') : t('admNo'), s.pin));
      out.push(stat(t('admSecPush'), String(s.pushDevices)));
      return out;
    },
  };
  // Overview: one card per area with its count; a tap opens the section.
  function overviewView() {
    const c = data.counts || {};
    const cards = [
      ['agents', c.profiles], ['accounts', c.accounts], ['tools', c.tools], ['skills', c.skills],
      ['knowledge', c.docs], ['templates', null], ['routines', c.routines], ['people', data.access?.people?.length],
    ].filter(([s]) => has(s));
    const grid = el('div', 'adm-cards');
    for (const [s, n] of cards) {
      const b = el('button', 'adm-card');
      b.type = 'button';
      b.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#${ICON[s]}"/></svg>`;
      b.append(el('span', 'adm-card-n', n == null ? '' : String(n)), el('span', 'adm-card-t', t('adm_' + s)), el('span', 'adm-card-d', t('admD_' + s)));
      b.addEventListener('click', () => show(s));
      grid.append(b);
    }
    return [p('hint', t('admOverviewIntro')), grid];
  }
  function link(label, href, cls = 'primary') { const a = el('a', 'btn ' + cls, label); a.href = href; return a; }

  async function open(want) {
    if (typeof want !== 'string') want = null;
    draft = null; dirty = false; cur = null;
    dialog.showModal();
    btn.setAttribute('aria-expanded', 'true');
    await load();
    if (!data) { dialog.close(); return; }
    renderNav();
    // A requested section opens directly; otherwise phones start on the list, wider screens on Overview.
    if (want && has(want)) show(want);
    else if (matchMedia('(min-width: 700px)').matches) show('overview');
    else { dialog.classList.remove('in-section'); body.replaceChildren(); }
  }
  function close() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('close', () => { unmount(); btn.setAttribute('aria-expanded', 'false'); });
  dialog.addEventListener('cancel', e => { if (dirty) { e.preventDefault(); toast(t('admUnsaved'), true); } });
  dialog.addEventListener('click', e => { if (e.target === dialog && !dirty) close(); });
  btn.addEventListener('click', open);
  $('#adm-close').addEventListener('click', () => { if (dirty) { draft = null; dirty = false; } close(); });
  $('#adm-back').addEventListener('click', () => { if (cur === 'people' && dirty) { toast(t('admUnsaved'), true); return; } unmount(); cur = null; renderNav(); dialog.classList.remove('in-section'); });
  // Only admins see the gear (the server checks every call anyway).
  const sync = () => { btn.hidden = !access.admin; };
  sync();
  setInterval(sync, 3000);
  // open('accounts') jumps straight to a section (also when Admin is already open).
  window.OrcaAdmin = { open: want => (dialog.open && data && has(want) ? show(want) : open(want)), close };
})();
