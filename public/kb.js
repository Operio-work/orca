'use strict';

// ORCA Knowledge — the dialog behind the Knowledge button in the header: the business's
// documents your agents search (`operio-orca kb search`) before they answer. Status, a test
// search (the same results an agent gets), upload (text read here, PDFs sent as base64) and
// remove. On ORCA Host only the client's admins and Operio staff add or remove; others search.
// Loaded after app.js and uses its globals ($, call, post, t, el, toast, lang, errText).

(() => {
  const dialog = $('#kb-dialog');
  const btn = $('#kb-btn');
  if (!dialog || !btn) return;
  const filesEl = $('#kb-files'), emptyEl = $('#kb-empty'), statusEl = $('#kb-status'), introEl = $('#kb-intro');
  const upEl = $('#kb-up'), dropEl = $('#kb-drop'), fileIn = $('#kb-file'), collIn = $('#kb-coll'), collList = $('#kb-colls');
  const tryForm = $('#kb-try'), qIn = $('#kb-q'), hitsEl = $('#kb-hits'), hitNote = $('#kb-hitnote');

  const TYPES = ['md', 'txt', 'csv', 'json', 'html', 'htm', 'pdf'];
  const MAX = 5 * 1024 * 1024;
  const REASONS = {
    'pdftotext not installed': 'kbR_pdf', 'too large (max 5 MB)': 'kbR_large', 'unsupported type': 'kbR_type', 'not a text file': 'kbR_text',
    'pdf has no text (scanned?)': 'kbR_scan', 'pdf could not be read': 'kbR_pdfbad', 'pdf took too long to read': 'kbR_pdfbad', 'over 2,000 files': 'kbR_many',
  };
  let data = { mode: 'local', canWrite: false, status: null, files: [] };
  let sure = null;   // path waiting for "Yes, remove"
  let busy = false;

  const kbErr = err => T[lang]['kbE_' + err.message] || T.en['kbE_' + err.message] || errText(err);
  const reasonText = r => (REASONS[r] ? t(REASONS[r]) : r || '');
  const size = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 102.4) / 10} KB` : `${Math.round(n / 104857.6) / 10} MB`);

  async function load() {
    try { data = await call('/api/kb'); }
    catch (err) { toast(kbErr(err), true); }
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
      const ul = el('ul');
      ul.append(...groups.get(k).map(fileRow));
      g.append(ul);
      return g;
    }));
    emptyEl.hidden = data.files.length > 0;
    collList.replaceChildren(...(data.status?.collections || []).map(c => { const o = document.createElement('option'); o.value = c; return o; }));
  }

  function render() {
    introEl.textContent = data.canWrite ? t('kbIntro') : t('kbIntroView');
    upEl.hidden = !data.canWrite;
    renderStatus();
    renderFiles();
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
      const r = await call('/api/kb/search?n=5&q=' + encodeURIComponent(q));
      hitsEl.replaceChildren(...r.results.map(x => {
        const li = el('li', 'kb-hit');
        li.append(el('span', 'kb-src', `${x.source}:${x.lines}`), el('p', 'kb-snip', x.snippet));
        return li;
      }));
      hitsEl.hidden = !r.results.length;
      const note = [r.results.length ? '' : t('kbNoHits'), r.note || ''].filter(Boolean).join(' ');
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
  dialog.addEventListener('close', () => { btn.setAttribute('aria-expanded', 'false'); sure = null; });
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); }); // backdrop
  btn.addEventListener('click', open);
  $('#kb-close').addEventListener('click', close);
  window.OrcaKnowledge = { open };
})();
