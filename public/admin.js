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
  const SECTIONS = ['people', 'agents', 'tools', 'skills', 'knowledge', 'templates', 'activity', 'security'];
  let data = null, cur = null, draft = null, dirty = false;

  async function load() {
    try { data = await call('/api/admin'); } catch (err) { toast(errText(err), true); data = null; }
  }

  function renderNav() {
    nav.replaceChildren(...SECTIONS.filter(s => data?.sections[s]).map(s => {
      const b = el('button', 'adm-tab', t('adm_' + s));
      b.type = 'button';
      b.setAttribute('aria-current', String(s === cur));
      b.addEventListener('click', () => show(s));
      return b;
    }));
  }
  function show(s) {
    if (cur === 'people' && dirty && s !== 'people' && !confirmLeave()) return;
    cur = s;
    renderNav();
    body.replaceChildren(el('h3', 'adm-h', t('adm_' + s)), ...(VIEWS[s]?.() || []));
    dialog.classList.toggle('in-section', true);
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
  const openThen = fn => () => { dialog.close(); fn(); };

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
    const ul = el('ul', 'adm-people');
    for (const x of tdata.tools) {
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
    if (tdata.tools.length) out.push(ul); else out.push(p('hint', t('admToolNone')));
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

  const VIEWS = {
    tools: () => { const ph = [p('hint', '…')]; toolsView().then(v => { if (cur === 'tools') body.replaceChildren(el('h3', 'adm-h', t('adm_tools')), ...v); }); return ph; },
    people: peopleView,
    agents: () => [p('hint', t('admAgentsIntro', data.counts.profiles, data.counts.accounts)),
      row(action(t('agOpenBtn'), openThen(() => window.OrcaAgents?.open())), action(t('accOpen'), openThen(() => window.OrcaAgents?.accounts()), 'ghost'))],
    skills: () => [p('hint', t('admSkillsIntro', data.counts.skills)), row(action(t('skOpen'), openThen(() => window.OrcaSkills?.open())))],
    knowledge: () => [p('hint', t('admKnowledgeIntro', data.counts.docs)), row(action(t('kbOpen'), openThen(() => window.OrcaKnowledge?.open())))],
    templates: () => [p('hint', t('admTemplatesIntro'))],
    activity: () => [p('hint', t('admActivityIntro')), row(link(t('journal'), '/journal.html'), link(t('usage'), '/usage.html', 'ghost'))],
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
  function link(label, href, cls = 'primary') { const a = el('a', 'btn ' + cls, label); a.href = href; return a; }

  async function open() {
    draft = null; dirty = false; cur = null;
    dialog.showModal();
    btn.setAttribute('aria-expanded', 'true');
    await load();
    if (!data) { dialog.close(); return; }
    renderNav();
    // Phones start on the list of sections; wider screens open People & access.
    if (matchMedia('(min-width: 700px)').matches) show(SECTIONS.find(s => data.sections[s]));
    else { dialog.classList.remove('in-section'); body.replaceChildren(); }
  }
  function close() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('close', () => btn.setAttribute('aria-expanded', 'false'));
  dialog.addEventListener('cancel', e => { if (dirty) { e.preventDefault(); toast(t('admUnsaved'), true); } });
  dialog.addEventListener('click', e => { if (e.target === dialog && !dirty) close(); });
  btn.addEventListener('click', open);
  $('#adm-close').addEventListener('click', () => { if (dirty) { draft = null; dirty = false; } close(); });
  $('#adm-back').addEventListener('click', () => { if (cur === 'people' && dirty) { toast(t('admUnsaved'), true); return; } cur = null; renderNav(); dialog.classList.remove('in-section'); });
  // Only admins see the gear (the server checks every call anyway).
  const sync = () => { btn.hidden = !access.admin; };
  sync();
  setInterval(sync, 3000);
  window.OrcaAdmin = { open };
})();
