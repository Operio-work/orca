'use strict';

// ORCA — Routines tab. Lists the routine packs in ~/.config/operio-orca/routines, lets you
// turn each on or off, change its schedule, run it now, and approve or reject the drafts the
// draft-approval routines leave behind. Approving only marks the draft approved: ORCA
// never sends anything anywhere. Uses app.js's globals (T, t, lang, call, post, toast, errText).

(() => {
  Object.assign(T.en, {
    routines: 'Routines', rtReload: 'Reload',
    rtIntro: 'Routines start an agent on a schedule with a fixed task. Drafts wait here for your approval; nothing is ever sent for you. Packs live in {0}.',
    rtNone: 'No routine packs yet. Add a folder with a routine.json to {0}, then Reload.',
    rtOn: 'On', rtOff: 'Off', rtRunNow: 'Run now', rtSave: 'Save', rtReset: 'Use pack schedule',
    rtNext: 'Next', rtNever: 'not scheduled', rtSchedule: 'Schedule', rtWhen: 'Runs',
    rtFreq: 'How often', rtFreq_daily: 'Every day', rtFreq_weekdays: 'Weekdays (Mon–Fri)', rtFreq_monsat: 'Mon–Sat', rtFreq_weekly: 'One day a week', rtFreq_hourly: 'Every hour', rtFreq_custom: 'Custom (see Advanced)',
    rtDay: 'Day', rtTime: 'Time', rtMinute: 'Minute past the hour', rtAtMinute: 'at :{0}', rtAdvanced: 'Advanced', rtCron: 'Cron line: minute hour day month weekday', rtCustomHint: 'This schedule is more detailed than the picker. Edit the cron line, or pick a simpler schedule above.', rtAgent: 'Agent', rtFolder: 'Folder',
    rtDraftGate: 'Draft — you approve', rtNoGate: 'Report — no approval',
    rtPrompt: 'Prompt', rtStarted: '{0} started — watch it on the map', rtSaved: 'Schedule saved', rtEnabled: '{0} on', rtDisabled: '{0} off',
    rtRuns: 'Recent runs', rtNoRuns: 'No runs yet.', rtOpen: 'Open', rtApprove: 'Approve', rtReject: 'Reject', rtApproved: 'Draft approved', rtRejected: 'Draft rejected',
    rtInvalid: 'Packs with problems', rtEmptyDraft: 'The agent hasn’t written this file yet.',
    rtS_started: 'running', rtS_ready: 'needs approval', rtS_approved: 'approved', rtS_rejected: 'rejected', rtS_done: 'report ready', rtS_failed: 'failed',
    rtManual: 'manual', rtScheduled: 'scheduled',
    rtOnDemand: 'On demand', rtOnDemandHint: 'Runs only when you press Run now.', e_on_demand: 'This routine runs on demand; it has no schedule.',
  });
  Object.assign(T.es, {
    routines: 'Rutinas', rtReload: 'Recargar',
    rtIntro: 'Las rutinas inician un agente con una tarea fija según un horario. Los borradores esperan aquí tu aprobación; nunca se envía nada por ti. Los paquetes están en {0}.',
    rtNone: 'Aún no hay paquetes de rutinas. Agrega una carpeta con un routine.json en {0} y pulsa Recargar.',
    rtOn: 'Activa', rtOff: 'Apagada', rtRunNow: 'Ejecutar ahora', rtSave: 'Guardar', rtReset: 'Usar horario del paquete',
    rtNext: 'Próxima', rtNever: 'sin programar', rtSchedule: 'Horario', rtWhen: 'Se ejecuta',
    rtFreq: 'Frecuencia', rtFreq_daily: 'Todos los días', rtFreq_weekdays: 'Entre semana (lun–vie)', rtFreq_monsat: 'Lun–Sáb', rtFreq_weekly: 'Un día a la semana', rtFreq_hourly: 'Cada hora', rtFreq_custom: 'Personalizado (ver Avanzado)',
    rtDay: 'Día', rtTime: 'Hora', rtMinute: 'Minuto de cada hora', rtAtMinute: 'al minuto {0}', rtAdvanced: 'Avanzado', rtCron: 'Línea cron: minuto hora día mes día-de-semana', rtCustomHint: 'Este horario es más detallado que el selector. Edita la línea cron o elige un horario más simple arriba.', rtAgent: 'Agente', rtFolder: 'Carpeta',
    rtDraftGate: 'Borrador — tú apruebas', rtNoGate: 'Reporte — sin aprobación',
    rtPrompt: 'Instrucción', rtStarted: '{0} inició — síguelo en el mapa', rtSaved: 'Horario guardado', rtEnabled: '{0} activa', rtDisabled: '{0} apagada',
    rtRuns: 'Ejecuciones recientes', rtNoRuns: 'Aún no hay ejecuciones.', rtOpen: 'Abrir', rtApprove: 'Aprobar', rtReject: 'Rechazar', rtApproved: 'Borrador aprobado', rtRejected: 'Borrador rechazado',
    rtInvalid: 'Paquetes con problemas', rtEmptyDraft: 'El agente aún no escribe este archivo.',
    rtS_started: 'en curso', rtS_ready: 'por aprobar', rtS_approved: 'aprobado', rtS_rejected: 'rechazado', rtS_done: 'reporte listo', rtS_failed: 'falló',
    rtManual: 'manual', rtScheduled: 'programada',
    rtOnDemand: 'Bajo pedido', rtOnDemandHint: 'Solo corre cuando pulsas Ejecutar ahora.', e_on_demand: 'Esta rutina es bajo pedido; no tiene horario.',
  });

  const view = $('#routines-view');
  const body = $('#rt-body');
  let data = null;
  const openDraft = new Set(); // run ids whose text is shown
  const draftText = new Map();

  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const btn = (label, cls, onClick) => { const b = mk('button', cls || 'chip small', label); b.type = 'button'; b.addEventListener('click', onClick); return b; };
  const when = ms => (ms ? new Date(ms).toLocaleString(window.orcaLocale(lang), { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('rtNever'));
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

  // ── Schedule picker: plain choices on top, the cron line underneath ("Advanced").
  // Unsaved choices survive the 10 s refresh in `pending` (routine id -> picker value).
  const Cron = window.OperioOrcaCron;
  const pending = new Map();
  const pad2 = n => String(n).padStart(2, '0');
  const labelled = (text, control) => { const l = mk('label', 'rt-field'); l.append(mk('span', 'rt-field-l', text), control); return l; };
  const select = (opts, value) => {
    const s = mk('select');
    for (const [v, label] of opts) s.append(new Option(label, String(v), false, String(v) === String(value)));
    return s;
  };
  const saveSchedule = (r, schedule) => act(() => post(`/api/routines/${enc(r.id)}/schedule`, { schedule }), () => t('rtSaved'));

  function schedulePicker(r) {
    const wrap = mk('div', 'rt-sched');
    const parsed = Cron.fromCron(r.schedule);
    const v = pending.get(r.id) || (parsed ? { hour: 9, day: 1, ...parsed } : { freq: 'custom', hour: 9, minute: 0, day: 1 });
    const row = mk('div', 'rt-row rt-pick');
    const freq = select([...Cron.FREQS, 'custom'].map(f => [f, t('rtFreq_' + f)]), v.freq);
    freq.querySelector('option[value="custom"]').disabled = v.freq !== 'custom';
    const day = select([1, 2, 3, 4, 5, 6, 0].map(d => [d, Cron.DAY_NAMES[lang === 'es' ? 'es' : 'en'][d]]), v.day);
    const time = mk('input'); time.type = 'time'; time.step = 60; time.value = `${pad2(v.hour ?? 9)}:${pad2(v.minute ?? 0)}`;
    const mins = []; for (let m = 0; m < 60; m += 5) mins.push(m);
    if (!mins.includes(v.minute)) mins.push(v.minute), mins.sort((a, b) => a - b);
    const minute = select(mins.map(m => [m, t('rtAtMinute', pad2(m))]), v.minute ?? 0);
    const fDay = labelled(t('rtDay'), day), fTime = labelled(t('rtTime'), time), fMin = labelled(t('rtMinute'), minute);
    const current = () => {
      const [h, m] = (time.value || '09:00').split(':').map(Number);
      return freq.value === 'hourly' ? { freq: 'hourly', minute: Number(minute.value), hour: h, day: Number(day.value) }
        : { freq: freq.value, hour: h, minute: m, day: Number(day.value) };
    };
    const preview = mk('span', 'rt-preview');
    const save = btn(t('rtSave'), 'chip small primary', () => { let line; try { line = Cron.toCron(current()); } catch { return; } pending.delete(r.id); saveSchedule(r, line); });
    const sync = () => {
      const f = freq.value;
      fDay.hidden = f !== 'weekly'; fTime.hidden = f === 'hourly' || f === 'custom'; fMin.hidden = f !== 'hourly';
      let line = null; try { if (f !== 'custom') line = Cron.toCron(current()); } catch { /* incomplete time */ }
      save.hidden = !line || line === r.schedule;
      preview.textContent = line && line !== r.schedule ? Cron.summary(line, lang) : '';
    };
    const changed = () => { if (freq.value !== 'custom') pending.set(r.id, current()); sync(); };
    for (const x of [freq, day, time, minute]) x.addEventListener('change', changed);
    time.addEventListener('input', changed);
    freq.setAttribute('aria-label', t('rtFreq'));
    row.append(labelled(t('rtFreq'), freq), fDay, fTime, fMin, preview, save);
    if (r.schedule !== r.packSchedule) row.append(btn(t('rtReset'), 'chip small', () => { pending.delete(r.id); saveSchedule(r, ''); }));
    sync();

    const adv = mk('details', 'rt-adv');
    adv.open = !parsed;
    adv.append(mk('summary', null, t('rtAdvanced')));
    if (!parsed) adv.append(mk('p', 'rt-hint', t('rtCustomHint')));
    const advRow = mk('div', 'rt-row');
    const input = mk('input');
    input.value = r.schedule; input.spellcheck = false; input.autocomplete = 'off';
    input.setAttribute('aria-label', t('rtCron')); input.placeholder = t('rtCron');
    advRow.append(input, btn(t('rtSave'), 'chip small', () => { pending.delete(r.id); saveSchedule(r, input.value); }));
    adv.append(advRow);
    wrap.append(row, adv);
    return wrap;
  }

  function card(r) {
    const c = mk('article', 'rt-card' + (r.enabled ? ' on' : ''));
    const top = mk('div', 'rt-top');
    top.append(mk('h3', 'rt-name', loc(r.name)));
    // An on-demand pack has no schedule: no on/off switch and no picker, only Run now.
    const onDemand = !r.packSchedule;
    if (!onDemand) {
      const toggle = btn(t(r.enabled ? 'rtOn' : 'rtOff'), 'chip small', () => act(() => post(`/api/routines/${enc(r.id)}/enable`, { enabled: !r.enabled }), t(r.enabled ? 'rtDisabled' : 'rtEnabled', loc(r.name))));
      toggle.setAttribute('aria-pressed', String(r.enabled));
      top.append(toggle);
    }
    top.append(btn(t('rtRunNow'), 'chip small primary', () => act(() => post(`/api/routines/${enc(r.id)}/run`), () => t('rtStarted', loc(r.name)))));
    c.append(top, mk('p', 'rt-problem', loc(r.problem)));

    const meta = mk('div', 'rt-meta');
    const item = (k, v) => { const s = mk('span'); s.append(mk('b', null, k + ' '), document.createTextNode(v)); return s; };
    if (onDemand) meta.append(item(t('rtWhen'), t('rtOnDemand')));
    else meta.append(
      item(t('rtWhen'), Cron.summary(r.schedule, lang)),
      item(t('rtNext'), r.enabled && r.nextAt ? Cron.shortWhen(r.nextAt, lang) : t('rtNever')));
    meta.append(item(t('rtAgent'), r.agent), item(t('rtFolder'), r.cwd), mk('span', null, t(r.approval === 'draft' ? 'rtDraftGate' : 'rtNoGate')));
    c.append(meta);
    if (onDemand) c.append(mk('p', 'rt-hint', t('rtOnDemandHint')));
    else c.append(schedulePicker(r));

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
  document.addEventListener('operio-orca:lang', () => { labelStatic(); render(); });
  labelStatic();
  if (location.hash === '#routines') open();
})();
