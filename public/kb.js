'use strict';

// ORCA Knowledge — the dialog behind the Knowledge button in the header: the business's
// documents your agents search (`operio-orca kb search`) before they answer. Status, a test
// search (the same results an agent gets), upload (text read here, PDFs sent as base64) and
// remove. On ORCA Host only the client's admins and Operio staff add or remove; others search.
// Per folder (collection), admins choose which agents search it (by tag or name; default all),
// and the test search can run "as" an agent to show what that agent would get.
// Loaded after app.js and uses its globals ($, call, post, t, el, toast, lang, errText).

(() => {
  const dialog = $('#kb-dialog');
  const btn = $('#kb-btn');
  if (!dialog || !btn) return;
  const filesEl = $('#kb-files'), emptyEl = $('#kb-empty'), statusEl = $('#kb-status'), introEl = $('#kb-intro');
  const upEl = $('#kb-up'), dropEl = $('#kb-drop'), fileIn = $('#kb-file'), collIn = $('#kb-coll'), collList = $('#kb-colls');
  const tryForm = $('#kb-try'), qIn = $('#kb-q'), hitsEl = $('#kb-hits'), hitNote = $('#kb-hitnote');
  const asRow = $('#kb-asrow'), asSel = $('#kb-as'), accHint = $('#kb-acchint');

  const TYPES = ['md', 'txt', 'csv', 'json', 'html', 'htm', 'pdf'];
  const MAX = 5 * 1024 * 1024;
  const REASONS = {
    'pdftotext not installed': 'kbR_pdf', 'too large (max 5 MB)': 'kbR_large', 'unsupported type': 'kbR_type', 'not a text file': 'kbR_text',
    'pdf has no text (scanned?)': 'kbR_scan', 'pdf could not be read': 'kbR_pdfbad', 'pdf took too long to read': 'kbR_pdfbad', 'over 2,000 files': 'kbR_many',
  };
  let data = { mode: 'local', canWrite: false, status: null, files: [] };
  let sure = null;   // path waiting for "Yes, remove"
  let busy = false;
  // Per-agent access: GET /api/kb/access. editing = the folder whose picker is open.
  let acc = { canWrite: false, access: { collections: {} }, collections: [], agents: [], tags: [] };
  let editing = null, draft = null;

  const kbErr = err => T[lang]['kbE_' + err.message] || T.en['kbE_' + err.message] || errText(err);
  const reasonText = r => (REASONS[r] ? t(REASONS[r]) : r || '');
  const size = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 102.4) / 10} KB` : `${Math.round(n / 104857.6) / 10} MB`);

  async function load() {
    const [d, a] = await Promise.allSettled([call('/api/kb'), call('/api/kb/access')]);
    if (d.status === 'fulfilled') data = d.value; else toast(kbErr(d.reason), true);
    if (a.status === 'fulfilled') acc = a.value;
  }

  // ─── Who searches each folder ───────────────────────────────────────────────
  const ruleOf = c => acc.access?.collections?.[c] || null;
  const ruleText = r => (r ? t('kbAccOnly', [...r.tags.map(x => '#' + x), ...r.agents].join(', ')) : t('kbAccAll'));
  const agentNames = () => [...new Set(acc.agents.map(a => a.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  function pickChips(values, chosen, fmt) {
    const wrap = el('div', 'folder-chips kb-picks');
    for (const v of values) {
      const b = el('button', 'fchip', fmt(v));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(chosen.has(v)));
      b.addEventListener('click', () => {
        if (chosen.has(v)) chosen.delete(v); else chosen.add(v);
        b.setAttribute('aria-pressed', String(chosen.has(v)));
      });
      wrap.append(b);
    }
    return wrap;
  }

  function accessRow(c) {
    const r = ruleOf(c);
    const row = el('div', 'kb-acc');
    const sum = el('span', 'kb-accsum' + (r ? ' on' : ''), ruleText(r));
    row.append(sum);
    if (acc.canWrite && editing !== c) {
      const b = el('button', 'btn ghost', t('kbAcc'));
      b.type = 'button';
      b.setAttribute('aria-label', t('kbAccEditOf', c));
      b.addEventListener('click', () => {
        editing = c;
        draft = { tags: new Set(r?.tags || []), agents: new Set(r?.agents || []) };
        renderFiles();
        filesEl.querySelector('.kb-accedit .fchip')?.focus();
      });
      row.append(b);
    }
    if (editing !== c) return row;
    const box = el('div', 'kb-accedit');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', t('kbAccEditOf', c));
    // Offer what exists now, plus anything the rule still names (so it can be taken off).
    const tags = [...new Set([...acc.tags, ...draft.tags])].sort((a, b) => a.localeCompare(b));
    const names = [...new Set([...agentNames(), ...draft.agents])].sort((a, b) => a.localeCompare(b));
    box.append(el('span', 'kb-label', t('kbAccTags')));
    box.append(tags.length ? pickChips(tags, draft.tags, x => '#' + x) : el('p', 'hint', t('kbAccNoTags')));
    box.append(el('span', 'kb-label', t('kbAccNames')));
    box.append(names.length ? pickChips(names, draft.agents, x => x) : el('p', 'hint', t('kbAccNoAgents')));
    const acts = el('div', 'kb-accacts');
    const all = el('button', 'btn ghost', t('kbAccAll'));
    all.type = 'button';
    all.addEventListener('click', () => saveAccess(c, [], []));
    const cancel = el('button', 'btn ghost', t('cancel'));
    cancel.type = 'button';
    cancel.addEventListener('click', () => { editing = null; draft = null; renderFiles(); });
    const save = el('button', 'btn', t('save'));
    save.type = 'button';
    save.addEventListener('click', () => saveAccess(c, [...draft.agents], [...draft.tags]));
    for (const b of [all, cancel, save]) b.disabled = busy;
    acts.append(all, cancel, save);
    box.append(acts);
    row.append(box);
    return row;
  }

  async function saveAccess(c, agents, tags) {
    busy = true;
    renderFiles();
    try {
      const r = await post('/api/kb/access', { collection: c, agents, tags });
      acc.access = r.access;
      editing = null;
      draft = null;
      toast(t('kbAccSaved', c, ruleText(r.rule)));
    } catch (err) { toast(kbErr(err), true); }
    busy = false;
    renderFiles();
  }

  function renderAs() {
    const keep = asSel.value;
    const opts = [['', t('kbAsPerson')], ...acc.agents.map(a => [a.pane, a.name || a.pane])];
    asSel.replaceChildren(...opts.map(([v, label]) => { const o = document.createElement('option'); o.value = v; o.textContent = label; return o; }));
    asSel.value = opts.some(([v]) => v === keep) ? keep : '';
    asRow.hidden = !acc.agents.length;
  }

  function renderStatus() {
    const s = data.status;
    statusEl.replaceChildren();
    if (!s) return;
    statusEl.append(t('kbStatus', s.indexed, s.chunks), ' · ');
    const sem = s.semantic || {};
    if (sem.on) statusEl.append(el('span', 'on', t('kbSemOn', `${sem.provider} ${sem.model}`)));
    else statusEl.append(t(sem.why === 'no_key' ? 'kbSemNoKey' : 'kbSemFree'));
  }

  function fileRow(f) {
    const li = el('li', 'kb-file');
    const main = el('div', 'kb-fmain');
    const name = f.collection ? f.path.slice(f.collection.length + 1) : f.path;
    main.append(el('span', 'kb-fname', name));
    const ok = f.status === 'indexed';
    main.append(el('span', 'kb-fmeta' + (ok ? '' : ' no'), size(f.bytes) + ' · ' + (ok ? (f.chunks === 1 ? t('kbIndexed1') : t('kbIndexed', f.chunks)) : t('kbSkipped', reasonText(f.reason)))));
    li.append(main);
    if (data.canWrite) {
      if (sure === f.path) {
        li.append(el('span', 'tpl-sure', t('kbRemoveSure')));
        const yes = el('button', 'btn danger', t('kbYes'));
        yes.type = 'button';
        yes.disabled = busy;
        yes.addEventListener('click', () => remove(f));
        const no = el('button', 'btn ghost', t('cancel'));
        no.type = 'button';
        no.addEventListener('click', () => { sure = null; renderFiles(); });
        li.append(no, yes);
      } else {
        const b = el('button', 'btn ghost', t('kbRemove'));
        b.type = 'button';
        b.disabled = busy;
        b.addEventListener('click', () => { sure = f.path; renderFiles(); });
        li.append(b);
      }
    }
    return li;
  }

  function renderFiles() {
    const groups = new Map();
    for (const f of data.files) {
      const k = f.collection || '';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(f);
    }
    const keys = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
    filesEl.replaceChildren(...keys.map(k => {
      const g = el('section', 'kb-group');
      g.append(el('h3', '', k || t('kbRoot')));
      if (k) g.append(accessRow(k));
      const ul = el('ul');
      ul.append(...groups.get(k).map(fileRow));
      g.append(ul);
      return g;
    }));
    emptyEl.hidden = data.files.length > 0;
    accHint.hidden = !keys.some(Boolean);
    collList.replaceChildren(...(data.status?.collections || []).map(c => { const o = document.createElement('option'); o.value = c; return o; }));
  }

  function render() {
    introEl.textContent = data.canWrite ? t('kbIntro') : t('kbIntroView');
    upEl.hidden = !data.canWrite;
    renderStatus();
    renderFiles();
    renderAs();
  }

  // A file name the server accepts: letters, digits, space . _ - ; first character a letter/digit.
  function safeName(name) {
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
    let base = (dot > 0 ? name.slice(0, dot) : name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ._-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!base) base = 'document';
    return { name: `${base}.${ext}`, ext };
  }
  function safeFolder(v) {
    return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ._-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '').replace(/\.\.+/g, '.').trim().slice(0, 64);
  }
  async function toBase64(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  async function upload(files) {
    if (!data.canWrite || busy || !files.length) return;
    busy = true;
    const folder = safeFolder(collIn.value);
    let added = 0;
    for (const file of files) {
      const { name, ext } = safeName(file.name);
      if (!TYPES.includes(ext)) { toast(t('kbBadType', file.name), true); continue; }
      if (file.size > MAX) { toast(t('kbTooBig', file.name), true); continue; }
      toast(t('kbAdding', name), false, 20000);
      const rel = folder ? `${folder}/${name}` : name;
      try {
        const body = ext === 'pdf' ? { path: rel, base64: await toBase64(file) } : { path: rel, text: await file.text() };
        await post('/api/kb/upload', body);
        added++;
        toast(t('kbAdded', name));
      } catch (err) { toast(kbErr(err), true); }
    }
    busy = false;
    fileIn.value = '';
    if (added) { await load(); render(); }
  }

  async function remove(f) {
    busy = true;
    renderFiles();
    try {
      await post('/api/kb/remove', { path: f.path });
      toast(t('kbRemoved', f.path));
    } catch (err) { toast(kbErr(err), true); }
    busy = false;
    sure = null;
    await load();
    render();
  }

  async function trySearch(e) {
    e.preventDefault();
    const q = qIn.value.trim();
    if (!q) { qIn.focus(); return; }
    hitNote.hidden = false;
    hitNote.textContent = t('kbSearching');
    hitsEl.hidden = true;
    try {
      const as = asSel.value;
      const r = await call('/api/kb/search?n=5&q=' + encodeURIComponent(q) + (as ? '&as=' + encodeURIComponent(as) : ''));
      hitsEl.replaceChildren(...r.results.map(x => {
        const li = el('li', 'kb-hit');
        li.append(el('span', 'kb-src', `${x.source}:${x.lines}`), el('p', 'kb-snip', x.snippet));
        return li;
      }));
      hitsEl.hidden = !r.results.length;
      const sc = r.scope;
      const scopeNote = sc ? (sc.denied.length ? t('kbAsLeftOut', sc.agent.name, sc.denied.join(', ')) : t('kbAsAll', sc.agent.name)) : '';
      const note = [r.results.length ? '' : t('kbNoHits'), r.note || '', scopeNote].filter(Boolean).join(' ');
      hitNote.textContent = note;
      hitNote.hidden = !note;
    } catch (err) { hitNote.textContent = kbErr(err); }
  }

  async function open() {
    dialog.showModal();
    btn.setAttribute('aria-expanded', 'true');
    await load();
    render();
  }
  function close() { if (dialog.open) dialog.close(); }

  fileIn.addEventListener('change', () => upload([...fileIn.files]));
  for (const ev of ['dragenter', 'dragover']) dropEl.addEventListener(ev, e => { e.preventDefault(); dropEl.classList.add('over'); });
  for (const ev of ['dragleave', 'drop']) dropEl.addEventListener(ev, () => dropEl.classList.remove('over'));
  dropEl.addEventListener('drop', e => { e.preventDefault(); upload([...(e.dataTransfer?.files || [])]); });
  tryForm.addEventListener('submit', trySearch);
  dialog.addEventListener('close', () => { btn.setAttribute('aria-expanded', 'false'); sure = null; editing = null; draft = null; });
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); }); // backdrop
  btn.addEventListener('click', open);
  $('#kb-close').addEventListener('click', close);
  window.OrcaKnowledge = { open };
})();
