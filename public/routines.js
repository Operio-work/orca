'use strict';

// Free-ORCA — Routines tab. Lists the routine packs in ~/.config/free-orca/routines, lets you
// turn each on or off, change its schedule, run it now, and approve or reject the drafts the
// draft-approval routines leave behind. Approving only marks the draft approved: Free-ORCA
// never sends anything anywhere. Uses app.js's globals (T, t, lang, call, post, toast, errText).

(() => {
  Object.assign(T.en, {
    routines: 'Routines', rtReload: 'Reload',
    rtIntro: 'Routines start an agent on a schedule with a fixed task. Drafts wait here for your approval; nothing is ever sent for you. Packs live in {0}.',
    rtNone: 'No routine packs yet. Add a folder with a routine.json to {0}, then Reload.',
    rtOn: 'On', rtOff: 'Off', rtRunNow: 'Run now', rtSave: 'Save', rtReset: 'Use pack schedule',
    rtNext: 'Next', rtNever: 'not scheduled', rtSchedule: 'Schedule (cron)', rtAgent: 'Agent', rtFolder: 'Folder',
    rtDraftGate: 'Draft — you approve', rtNoGate: 'Report — no approval',
    rtPrompt: 'Prompt', rtStarted: '{0} started — watch it on the map', rtSaved: 'Schedule saved', rtEnabled: '{0} on', rtDisabled: '{0} off',
    rtRuns: 'Recent runs', rtNoRuns: 'No runs yet.', rtOpen: 'Open', rtApprove: 'Approve', rtReject: 'Reject', rtApproved: 'Draft approved', rtRejected: 'Draft rejected',
    rtInvalid: 'Packs with problems', rtEmptyDraft: 'The agent hasn’t written this file yet.',
    rtS_started: 'running', rtS_ready: 'needs approval', rtS_approved: 'approved', rtS_rejected: 'rejected', rtS_done: 'report ready', rtS_failed: 'failed',
    rtManual: 'manual', rtScheduled: 'scheduled',
  });
  Object.assign(T.es, {
    routines: 'Rutinas', rtReload: 'Recargar',
    rtIntro: 'Las rutinas inician un agente con una tarea fija según un horario. Los borradores esperan aquí tu aprobación; nunca se envía nada por ti. Los paquetes están en {0}.',
    rtNone: 'Aún no hay paquetes de rutinas. Agrega una carpeta con un routine.json en {0} y pulsa Recargar.',
    rtOn: 'Activa', rtOff: 'Apagada', rtRunNow: 'Ejecutar ahora', rtSave: 'Guardar', rtReset: 'Usar horario del paquete',
    rtNext: 'Próxima', rtNever: 'sin programar', rtSchedule: 'Horario (cron)', rtAgent: 'Agente', rtFolder: 'Carpeta',
    rtDraftGate: 'Borrador — tú apruebas', rtNoGate: 'Reporte — sin aprobación',
    rtPrompt: 'Instrucción', rtStarted: '{0} inició — síguelo en el mapa', rtSaved: 'Horario guardado', rtEnabled: '{0} activa', rtDisabled: '{0} apagada',
    rtRuns: 'Ejecuciones recientes', rtNoRuns: 'Aún no hay ejecuciones.', rtOpen: 'Abrir', rtApprove: 'Aprobar', rtReject: 'Rechazar', rtApproved: 'Borrador aprobado', rtRejected: 'Borrador rechazado',
    rtInvalid: 'Paquetes con problemas', rtEmptyDraft: 'El agente aún no escribe este archivo.',
    rtS_started: 'en curso', rtS_ready: 'por aprobar', rtS_approved: 'aprobado', rtS_rejected: 'rechazado', rtS_done: 'reporte listo', rtS_failed: 'falló',
    rtManual: 'manual', rtScheduled: 'programada',
  });

  const view = $('#routines-view');
  const body = $('#rt-body');
  let data = null;
  const openDraft = new Set(); // run ids whose text is shown
  const draftText = new Map();

  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const btn = (label, cls, onClick) => { const b = mk('button', cls || 'chip small', label); b.type = 'button'; b.addEventListener('click', onClick); return b; };
  const when = ms => (ms ? new Date(ms).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('rtNever'));
  const loc = v => (v && (v[lang] || v.en)) || '';

  function labelStatic() {
    document.querySelectorAll('#routines-btn [data-i18n], #routines-view [data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll('#routines-view [data-i18n-title]').forEach(n => { n.title = t(n.dataset.i18nTitle); n.setAttribute('aria-label', n.title); });
  }

  async function load() {
    try { data = await call('/api/routines'); }
    catch (e) { toast(errText(e), true); return; }
    render();
  }

  async function act(fn, okMsg) {
    try { const r = await fn(); if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg); }
    catch (e) { toast(errText(e), true); }
    await load();
  }

  function card(r) {
    const c = mk('article', 'rt-card' + (r.enabled ? ' on' : ''));
    const top = mk('div', 'rt-top');
    top.append(mk('h3', 'rt-name', loc(r.name)));
    const toggle = btn(t(r.enabled ? 'rtOn' : 'rtOff'), 'chip small', () => act(() => post(`/api/routines/${enc(r.id)}/enable`, { enabled: !r.enabled }), t(r.enabled ? 'rtDisabled' : 'rtEnabled', loc(r.name))));
    toggle.setAttribute('aria-pressed', String(r.enabled));
    top.append(toggle, btn(t('rtRunNow'), 'chip small primary', () => act(() => post(`/api/routines/${enc(r.id)}/run`), () => t('rtStarted', loc(r.name)))));
    c.append(top, mk('p', 'rt-problem', loc(r.problem)));

    const meta = mk('div', 'rt-meta');
    const item = (k, v) => { const s = mk('span'); s.append(mk('b', null, k + ' '), document.createTextNode(v)); return s; };
    meta.append(item(t('rtNext'), r.enabled ? when(r.nextAt) : t('rtNever')), item(t('rtAgent'), r.agent), item(t('rtFolder'), r.cwd), mk('span', null, t(r.approval === 'draft' ? 'rtDraftGate' : 'rtNoGate')));
    c.append(meta);

    const row = mk('div', 'rt-row');
    const input = mk('input');
    input.value = r.schedule; input.spellcheck = false; input.autocomplete = 'off';
    input.setAttribute('aria-label', t('rtSchedule')); input.placeholder = t('rtSchedule');
    row.append(input, btn(t('rtSave'), 'chip small', () => act(() => post(`/api/routines/${enc(r.id)}/schedule`, { schedule: input.value }), t('rtSaved'))));
    if (r.schedule !== r.packSchedule) row.append(btn(t('rtReset'), 'chip small', () => act(() => post(`/api/routines/${enc(r.id)}/schedule`, { schedule: '' }), t('rtSaved'))));
    c.append(row);

    const det = mk('details', 'rt-prompt');
    det.append(mk('summary', null, t('rtPrompt')), mk('pre', null, r.prompt));
    c.append(det);
    return c;
  }

  function runRow(run) {
    const r = (data.routines || []).find(x => x.id === run.id);
    const c = mk('article', 'rt-card rt-draft');
    const top = mk('div', 'rt-top');
    top.append(mk('h3', 'rt-name', r ? loc(r.name) : run.id), mk('span', 'rt-badge ' + run.state, t('rtS_' + run.state)));
    const canOpen = ['ready', 'approved', 'rejected', 'done'].includes(run.state);
    if (canOpen) top.append(btn(t('rtOpen'), 'chip small', async () => {
      if (openDraft.has(run.run)) openDraft.delete(run.run);
      else {
        openDraft.add(run.run);
        try { draftText.set(run.run, (await call(`/api/routines/runs/${enc(run.run)}`)).text); } catch (e) { toast(errText(e), true); }
      }
      render();
    }));
    if (run.state === 'ready') {
      top.append(
        btn(t('rtApprove'), 'chip small primary', () => act(() => post(`/api/routines/runs/${enc(run.run)}/decide`, { action: 'approve' }), t('rtApproved'))),
        btn(t('rtReject'), 'chip small', () => act(() => post(`/api/routines/runs/${enc(run.run)}/decide`, { action: 'reject' }), t('rtRejected'))));
    }
    c.append(top);
    const meta = mk('div', 'rt-meta');
    meta.append(mk('span', null, when(run.at)), mk('span', null, t(run.trigger === 'manual' ? 'rtManual' : 'rtScheduled')), mk('code', null, run.output));
    c.append(meta);
    if (openDraft.has(run.run)) c.append(mk('pre', null, draftText.get(run.run) || t('rtEmptyDraft')));
    return c;
  }

  function render() {
    if (!data || view.hidden) return;
    const out = [mk('p', 'rt-intro', t('rtIntro', data.dir))];
    if (!data.routines.length) out.push(mk('p', 'rt-empty', t('rtNone', data.dir)));
    for (const r of data.routines) out.push(card(r));
    if (data.invalid.length) {
      out.push(mk('h2', 'rt-h', t('rtInvalid')));
      for (const bad of data.invalid) {
        const c = mk('article', 'rt-card');
        c.append(mk('h3', 'rt-name', bad.id));
        for (const e of bad.errors) c.append(mk('p', 'rt-bad', e));
        out.push(c);
      }
    }
    out.push(mk('h2', 'rt-h', t('rtRuns')));
    if (!data.runs.length) out.push(mk('p', 'rt-empty', t('rtNoRuns')));
    for (const run of data.runs) out.push(runRow(run));
    body.replaceChildren(...out);
  }

  let timer = null;
  function open() {
    view.hidden = false;
    labelStatic();
    load();
    clearInterval(timer);
    timer = setInterval(() => { if (!view.hidden && !body.contains(document.activeElement)) load(); }, 10000);
    $('#rt-back').focus();
  }
  function close() { view.hidden = true; clearInterval(timer); timer = null; $('#routines-btn').focus(); }

  $('#routines-btn').addEventListener('click', open);
  $('#rt-back').addEventListener('click', close);
  $('#rt-reload').addEventListener('click', load);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !view.hidden) { e.stopPropagation(); close(); } }, true);
  document.addEventListener('free-orca:lang', () => { labelStatic(); render(); });
  labelStatic();
  if (location.hash === '#routines') open();
})();
